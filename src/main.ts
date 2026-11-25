import * as core from '@actions/core'

import { wait } from './wait.js'
import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

interface SignResponse {
  message?: string
  request_id: string
}

function buildAuth(user: string, token: string): string {
  return `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`
}

function apiUrl(baseUrl: string, endpoint: string): string {
  return baseUrl.replace(/\/?$/, '/') + endpoint
}

function bufferToString(data: unknown): string {
  if (Buffer.isBuffer(data)) return data.toString('utf-8')
  if (typeof data === 'string') return data
  return JSON.stringify(data)
}

async function uploadFile(
  baseUrl: string,
  auth: string,
  filePath: string,
  targetPlatform: 'macOS' | 'Windows'
): Promise<string> {
  const form = new FormData()
  form.append('file', fs.createReadStream(filePath))
  form.append('target_platform', targetPlatform)

  core.debug(
    `Uploading ${filePath} to ${baseUrl} for ${targetPlatform} signing`
  )

  const response = await axios({
    method: 'post',
    url: apiUrl(baseUrl, 'api/sign/upload'),
    headers: {
      Authorization: auth,
      ...form.getHeaders()
    },
    data: form,
    validateStatus: status => [200, 201].includes(status)
  })

  const result = response.data as SignResponse
  core.info(
    `Uploaded ${path.basename(filePath)}, request ID: ${result.request_id}`
  )
  return result.request_id
}

async function pollForSignedFile(
  baseUrl: string,
  auth: string,
  requestId: string,
  outputPath: string
): Promise<string> {
  const url = apiUrl(baseUrl, `api/sign/${requestId}`)
  core.info(`Polling for signed file (request: ${requestId}) ...`)

  while (true) {
    const response = await axios({
      method: 'get',
      url,
      headers: { Authorization: auth },
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 10 * 60 * 1000
    })

    if (response.status === 200) {
      await fs.promises.writeFile(outputPath, response.data as Buffer)
      core.info(`Signed file saved to: ${outputPath}`)
      return outputPath
    }

    const body = bufferToString(response.data)

    if (response.status === 202) {
      try {
        const data = JSON.parse(body) as { message?: string }
        core.info(`Signing status: ${data.message ?? body}`)
      } catch {
        core.info(`Signing in progress ...`)
      }
      await wait(5000)
      continue
    }

    if (response.status === 410) {
      throw new Error(`Signed file expired for request ${requestId}`)
    }

    if (response.status === 422) {
      let message = body
      try {
        message = (JSON.parse(body) as { message?: string }).message ?? body
      } catch {
        /* use raw body */
      }
      throw new Error(`Signing failed for request ${requestId}: ${message}`)
    }

    throw new Error(
      `Unexpected status ${response.status} for request ${requestId}: ${body}`
    )
  }
}

async function signFile(
  baseUrl: string,
  auth: string,
  inputPath: string,
  outputPath: string,
  targetPlatform: 'macOS' | 'Windows'
): Promise<string> {
  const requestId = await uploadFile(baseUrl, auth, inputPath, targetPlatform)
  return pollForSignedFile(baseUrl, auth, requestId, outputPath)
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const macInput = core.getInput('macos')
    const winX64Input = core.getInput('win-x64')
    const winArm64Input = core.getInput('win-arm64')

    const macServer = core.getInput('mac-signing-server')
    const winServer = core.getInput('win-signing-server')
    const macAuth = buildAuth(
      core.getInput('mac-signing-user'),
      core.getInput('mac-signing-token')
    )
    const winAuth = buildAuth(
      core.getInput('win-signing-user'),
      core.getInput('win-signing-token')
    )

    const tasks: Promise<void>[] = []

    if (macInput) {
      const outputPath = `signed_${path.basename(macInput)}`
      tasks.push(
        signFile(macServer, macAuth, macInput, outputPath, 'macOS').then(
          signed => core.setOutput('macos', signed)
        )
      )
    } else {
      core.setOutput('macos', '')
    }

    if (winX64Input) {
      const outputPath = `signed_${path.basename(winX64Input)}`
      tasks.push(
        signFile(winServer, winAuth, winX64Input, outputPath, 'Windows').then(
          signed => core.setOutput('win-x64', signed)
        )
      )
    } else {
      core.setOutput('win-x64', '')
    }

    if (winArm64Input) {
      const outputPath = `signed_${path.basename(winArm64Input)}`
      tasks.push(
        signFile(winServer, winAuth, winArm64Input, outputPath, 'Windows').then(
          signed => core.setOutput('win-arm64', signed)
        )
      )
    } else {
      core.setOutput('win-arm64', '')
    }

    await Promise.all(tasks)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}

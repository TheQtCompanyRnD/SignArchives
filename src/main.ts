import * as core from '@actions/core'

import { wait } from './wait'
import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import { inspect } from 'util' // or directly

import { Job, MatrixRun, Run } from './jenkins'

async function waitForJobFinished(jobUrl: string, auth: string): Promise<void> {
  const mainJob = await axios({
    method: 'get',
    url: `${jobUrl}api/json`,
    headers: {
      Authorization: auth
    }
  })

  const runs = (mainJob.data as Job).runs

  core.debug(`Runs: ${JSON.stringify(runs)}`)

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const check = async (job: string) => {
    return await axios({
      method: 'get',
      url: `${job}api/json`,
      headers: {
        Authorization: auth
      }
    })
  }

  let runCopy = runs.slice()

  async function asyncFilter(
    arr: Run[],
    predicate: (run: Run) => Promise<boolean>
  ): Promise<Run[]> {
    const results = await Promise.all(arr.map(predicate))
    return arr.filter((_v: Run, index: number) => results[index])
  }

  while (runCopy.length > 0) {
    core.info(`Waiting for ${runCopy.length} jobs to finish ...`)
    runCopy = await asyncFilter(runCopy, async (run: Run) => {
      const checkResult = await check(run.url)
      const jobData = checkResult.data as MatrixRun
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (jobData.building) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        core.info(`Job still building: ${checkResult.data.fullDisplayName}`)
        return true
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        core.info(`Job finished: ${checkResult.data.fullDisplayName}`)
        return false
      }
    })

    await wait(1000)
  }
}

async function waitForStarted(
  queueLocation: string,
  auth: string
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const check = async () => {
    return await axios({
      method: 'get',
      url: `${queueLocation}api/json`,
      headers: {
        Authorization: auth
      }
    })
  }

  core.info(`Waiting for job to start ...`)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const checkResult = await check()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (checkResult.data.executable) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      core.info(`Job started: ${checkResult.data.executable.url}`)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return checkResult.data.executable.url as string
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (checkResult.data.cancelled) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error(`Job was cancelled: ${inspect(checkResult)}`)
    }

    await wait(1000)
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const mac_in: string = core.getInput('macos')
    const win_x64_in: string = core.getInput('win-x64')
    const win_arm64_in: string = core.getInput('win-arm64')
    const jenkinsUrl: string = core.getInput('jenkins-url')
    const jenkinsUser: string = core.getInput('jenkins-user')
    const jenkinsToken: string = core.getInput('jenkins-token')

    const triggerUrl = `${jenkinsUrl}/job/Sign_archive/buildWithParameters`
    const auth = `Basic ${Buffer.from(`${jenkinsUser}:${jenkinsToken}`).toString('base64')}`

    const inputFiles = [
      { name: 'input_mac_7z', file: mac_in, paramName: 'input_mac_7z' },
      {
        name: 'input_windows_x64_7z',
        file: win_x64_in,
        paramName: 'input_windows_x64_7z'
      },
      {
        name: 'input_windows_arm64_7z',
        file: win_arm64_in,
        paramName: 'input_windows_arm64_7z'
      }
    ].filter(file => file.file)

    const form = new FormData()
    const params = {
      parameters: inputFiles.map(file => {
        return { name: file.name, file: file.paramName }
      })
    }

    inputFiles.forEach(file => {
      form.append(file.paramName, fs.createReadStream(file.file))
    })
    form.append('json', JSON.stringify(params))

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Sending request ...`)
    core.debug(`Parameters: ${inspect(params)}`)
    core.debug(`Files: ${inputFiles.map(file => file.file).join(', ')}`)

    const config = {
      method: 'post',
      url: triggerUrl,
      headers: {
        Authorization: auth,
        ...form.getHeaders()
      },
      data: form
    }

    const triggerResult = await axios(config)
    if (triggerResult.status !== 201) {
      throw new Error(
        `Failed to trigger Jenkins job: ${inspect(triggerResult)}`
      )
    }
    if (!triggerResult.headers.location) {
      throw new Error(
        `Failed to get location of Jenkins job: ${inspect(triggerResult)}`
      )
    }

    core.debug(`New Item at: ${triggerResult.headers.location}`)
    core.info('Waiting for job to start ...')
    const jobUrl = await waitForStarted(
      triggerResult.headers.location as unknown as string,
      auth
    )
    core.info(`Waiting for job to finish ...`)
    await waitForJobFinished(jobUrl, auth)

    // Set outputs for other workflow steps to use
    core.setOutput('macos', '')
    core.setOutput('win-x64', '')
    core.setOutput('win-arm64', '')
  } catch (error) {
    // Fail the workflow run if an error occurs

    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}

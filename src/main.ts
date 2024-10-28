import * as core from '@actions/core'

import { wait } from './wait'
import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import { inspect } from 'util' // or directly
import { Job } from './jenkins'

async function fetchJob(jobUrl: string, auth: string): Promise<Job> {
  return (
    await axios({
      method: 'get',
      url: `${jobUrl}api/json`,
      headers: {
        Authorization: auth
      }
    })
  ).data as Job
}

async function downloadArtifacts(
  jobUrl: string,
  auth: string
): Promise<string[]> {
  const job = await fetchJob(jobUrl, auth)
  const result: string[] = []

  for (const run of job.runs) {
    const runData = await fetchJob(run.url, auth)
    if (runData.result == 'SUCCESS' && runData.artifacts) {
      for (const artifact of runData.artifacts) {
        const artifactUrl = `${run.url}artifact/${artifact.relativePath}`
        const response = await axios({
          method: 'get',
          url: artifactUrl,
          headers: {
            Authorization: auth
          },
          responseType: 'stream'
        })

        const dest = fs.createWriteStream(artifact.fileName)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        response.data.pipe(dest)
        await new Promise((resolve, reject) => {
          dest.on('finish', resolve)
          dest.on('error', reject)
        })

        core.info(`Downloaded artifact: ${dest.path as string}`)
        result.push(dest.path as string)
      }
    }
  }

  return result
}

async function waitForJobFinished(
  jobUrl: string,
  auth: string
): Promise<boolean> {
  let mainJob = await fetchJob(jobUrl, auth)

  while (mainJob.inProgress) {
    await wait(1000)
    mainJob = await fetchJob(jobUrl, auth)
  }
  core.info(`Job finished with: ${mainJob.result}`)
  return mainJob.result == 'SUCCESS'
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
    const success = await waitForJobFinished(jobUrl, auth)
    if (!success) {
      throw new Error(`Job failed: ${jobUrl}`)
    }

    const aritfacts = await downloadArtifacts(jobUrl, auth)

    core.debug(`Artifacts: ${aritfacts.join(', ')}`)

    // Set outputs for other workflow steps to use
    core.setOutput(
      'macos',
      aritfacts.find(file => file.endsWith('output_mac_7z')) ?? ''
    )
    core.setOutput(
      'win-x64',
      aritfacts.find(file => file.endsWith('output_windows_x64_7z')) ?? ''
    )
    core.setOutput(
      'win-arm64',
      aritfacts.find(file => file.endsWith('output_windows_arm64_7z')) ?? ''
    )
  } catch (error) {
    // Fail the workflow run if an error occurs

    if (error instanceof Error) {
      console.log(JSON.stringify(error))
      core.setFailed(error.message)
    }
  }
}

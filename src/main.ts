import * as core from '@actions/core'

import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'

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

    const inputFiles = [
      { name: 'input_mac_7z', file: mac_in, paramName: 'macos' },
      { name: 'input_windows_x64_7z', file: win_x64_in, paramName: 'winx64' },
      {
        name: 'input_windows_arm64_7z',
        file: win_arm64_in,
        paramName: 'winarm64'
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
    core.debug(`Parameters: ${JSON.stringify(params)}`)
    core.debug(`Files: ${inputFiles.map(file => file.file).join(', ')}`)

    const config = {
      method: 'post',
      url: triggerUrl,
      headers: {
        Authorization: `Basic ${Buffer.from(`${jenkinsUser}:${jenkinsToken}`).toString('base64')}`,
        ...form.getHeaders()
      },
      data: form
    }

    const triggerResult = await axios(config)
    core.debug(`Response: ${JSON.stringify(triggerResult.data)}`)

    // Set outputs for other workflow steps to use
    core.setOutput('macos', '')
    core.setOutput('win-x64', '')
    core.setOutput('win-arm64', '')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

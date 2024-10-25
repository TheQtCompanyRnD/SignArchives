/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as main from '../src/main'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Other utilities
const timeRegex = /^\d{2}:\d{2}:\d{2}/

// Mock the GitHub Actions core library
let debugMock: jest.SpiedFunction<typeof core.debug>
let errorMock: jest.SpiedFunction<typeof core.error>
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
let setOutputMock: jest.SpiedFunction<typeof core.setOutput>
let axiosAdapter: MockAdapter

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    debugMock = jest.spyOn(core, 'debug').mockImplementation()
    errorMock = jest.spyOn(core, 'error').mockImplementation()
    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
    axiosAdapter = new MockAdapter(axios)
  })

  it('can start jenkins job', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'jenkins-user':
          return 'username'
        case 'jenkins-token':
          return '1234'
        case 'jenkins-url':
          return 'https://ci.com'
        case 'macos':
          return 'gotest/test-macos.7z'
        default:
          return ''
      }
    })

    axiosAdapter
      .onPost('https://ci.com/job/Sign_archive/buildWithParameters')
      .reply(function (config) {
        expect(config.url).toBe(
          'https://ci.com/job/Sign_archive/buildWithParameters'
        )
        expect(config.headers?.Authorization).toBe('Basic dXNlcm5hbWU6MTIzNA==')
        return [201, { data: 'success' }]
      })

    await main.run()
    expect(runMock).toHaveReturned()
    expect(setFailedMock).not.toHaveBeenCalled()
  })
})
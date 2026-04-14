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
import fs from 'fs'

jest.mock('../src/wait', () => ({ wait: jest.fn().mockResolvedValue('done!') }))

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

// Mock the GitHub Actions core library
let getInputMock: jest.SpiedFunction<typeof core.getInput>
let setFailedMock: jest.SpiedFunction<typeof core.setFailed>
let setOutputMock: jest.SpiedFunction<typeof core.setOutput>
let axiosAdapter: MockAdapter

const MAC_SERVER = 'https://signingservermac.ci.qt.io/'
const WIN_SERVER = 'https://signingserverwin.ci.qt.io/'

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
    setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()
    axiosAdapter = new MockAdapter(axios)
  })

  afterEach(() => {
    axiosAdapter.restore()
    // Clean up any signed files created during tests
    for (const f of [
      'signed_test-macos.7z',
      'signed_test-winx64.7z',
      'signed_test-winarm64.7z'
    ]) {
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
  })

  it('signs a macOS archive', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'mac-signing-user':
          return 'username'
        case 'mac-signing-token':
          return 'password'
        case 'mac-signing-server':
          return MAC_SERVER
        case 'macos':
          return 'gotest/test-macos.7z'
        default:
          return ''
      }
    })

    axiosAdapter
      .onPost(`${MAC_SERVER}api/sign/upload`)
      .reply(201, { request_id: 'abc-mac-123' })

    axiosAdapter
      .onGet(`${MAC_SERVER}api/sign/abc-mac-123`)
      .replyOnce(202, { message: 'Request is pending' })
    axiosAdapter
      .onGet(`${MAC_SERVER}api/sign/abc-mac-123`)
      .replyOnce(200, Buffer.from('signed-mac-content'))

    await main.run()

    expect(runMock).toHaveReturned()
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith('macos', 'signed_test-macos.7z')
    expect(setOutputMock).toHaveBeenCalledWith('win-x64', '')
    expect(setOutputMock).toHaveBeenCalledWith('win-arm64', '')
  })

  it('signs Windows x64 and arm64 archives in parallel', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'win-signing-user':
          return 'username'
        case 'win-signing-token':
          return 'password'
        case 'win-signing-server':
          return WIN_SERVER
        case 'win-x64':
          return 'gotest/test-winx64.7z'
        case 'win-arm64':
          return 'gotest/test-winarm64.7z'
        default:
          return ''
      }
    })

    axiosAdapter
      .onPost(`${WIN_SERVER}api/sign/upload`)
      .replyOnce(201, { request_id: 'req-x64' })
    axiosAdapter
      .onPost(`${WIN_SERVER}api/sign/upload`)
      .replyOnce(201, { request_id: 'req-arm64' })

    axiosAdapter
      .onGet(`${WIN_SERVER}api/sign/req-x64`)
      .reply(200, Buffer.from('signed-x64-content'))
    axiosAdapter
      .onGet(`${WIN_SERVER}api/sign/req-arm64`)
      .reply(200, Buffer.from('signed-arm64-content'))

    await main.run()

    expect(runMock).toHaveReturned()
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith('macos', '')
    expect(setOutputMock).toHaveBeenCalledWith(
      'win-x64',
      'signed_test-winx64.7z'
    )
    expect(setOutputMock).toHaveBeenCalledWith(
      'win-arm64',
      'signed_test-winarm64.7z'
    )
  })

  it('fails the action when signing returns 422', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'mac-signing-user':
          return 'username'
        case 'mac-signing-token':
          return 'password'
        case 'mac-signing-server':
          return MAC_SERVER
        case 'macos':
          return 'gotest/test-macos.7z'
        default:
          return ''
      }
    })

    axiosAdapter
      .onPost(`${MAC_SERVER}api/sign/upload`)
      .reply(201, { request_id: 'fail-req' })
    axiosAdapter
      .onGet(`${MAC_SERVER}api/sign/fail-req`)
      .reply(422, { message: 'Unsupported file format' })

    await main.run()

    expect(runMock).toHaveReturned()
    expect(setFailedMock).toHaveBeenCalledWith(
      expect.stringContaining('Signing failed')
    )
  })

  it('fails the action when the signed file has expired (410)', async () => {
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'mac-signing-user':
          return 'username'
        case 'mac-signing-token':
          return 'password'
        case 'mac-signing-server':
          return MAC_SERVER
        case 'macos':
          return 'gotest/test-macos.7z'
        default:
          return ''
      }
    })

    axiosAdapter
      .onPost(`${MAC_SERVER}api/sign/upload`)
      .reply(201, { request_id: 'expired-req' })
    axiosAdapter.onGet(`${MAC_SERVER}api/sign/expired-req`).reply(410, '')

    await main.run()

    expect(runMock).toHaveReturned()
    expect(setFailedMock).toHaveBeenCalledWith(
      expect.stringContaining('expired')
    )
  })
})

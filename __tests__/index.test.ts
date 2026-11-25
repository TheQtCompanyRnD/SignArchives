/**
 * Unit tests for the action's entrypoint, src/index.ts
 */

import { jest, describe, it, expect } from '@jest/globals'

const runMock = jest.fn<() => Promise<void>>()

// Must be called before dynamic imports so the mock is in place
// when index.ts loads and immediately calls run()
jest.unstable_mockModule('../src/main.js', () => ({ run: runMock }))

describe('index', () => {
  it('calls run when imported', async () => {
    await import('../src/index.js')
    expect(runMock).toHaveBeenCalled()
  })
})

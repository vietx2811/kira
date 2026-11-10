/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { InvokeTimeoutError, withTimeout } from './invokeTimeout'

function neverResolves<T>(): Promise<T> {
  return new Promise<T>(() => undefined)
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected promise to reject')
}

describe('withTimeout', () => {
  test('resolves with the inner value when it settles before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 50, 'test')
    expect(result).toBe('ok')
  })

  test('rejects with the inner error when it rejects before the timeout', async () => {
    const error = await captureRejection(withTimeout(Promise.reject(new Error('boom')), 50, 'test'))
    expect(error instanceof Error).toBe(true)
    expect((error as Error).message).toBe('boom')
  })

  test('rejects with InvokeTimeoutError when the promise never settles', async () => {
    const error = await captureRejection(withTimeout(neverResolves(), 10, 'fetch_capture_image'))
    expect(error instanceof InvokeTimeoutError).toBe(true)
  })

  test('timeout error message names the label and duration', async () => {
    const error = await captureRejection(withTimeout(neverResolves(), 10, 'fetch_capture_image'))
    expect((error as Error).message).toBe('fetch_capture_image timed out after 10ms')
  })
})

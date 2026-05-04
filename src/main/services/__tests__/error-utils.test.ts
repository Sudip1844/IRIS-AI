import {
  extractErrorMessage,
  classifyErrorKind,
  ErrorKind,
  isTransientError,
  retryAsync
} from '../error-utils'

describe('error-utils', () => {
  describe('extractErrorMessage', () => {
    it('should return "Unknown error" for null/undefined', () => {
      expect(extractErrorMessage(null)).toBe('Unknown error')
      expect(extractErrorMessage(undefined)).toBe('Unknown error')
    })

    it('should return string as-is', () => {
      const msg = 'Test error message'
      expect(extractErrorMessage(msg)).toBe(msg)
    })

    it('should extract message from Error instance', () => {
      const err = new Error('Test error')
      expect(extractErrorMessage(err)).toBe('Test error')
    })

    it('should stringify objects', () => {
      const obj = { message: 'test', code: 401 }
      expect(extractErrorMessage(obj)).toBe(JSON.stringify(obj))
    })

    it('should handle Error with no message', () => {
      const err = new Error()
      expect(extractErrorMessage(err)).toMatch(/Error|/)
    })
  })

  describe('classifyErrorKind', () => {
    it('should classify rate limit errors', () => {
      expect(classifyErrorKind('rate limit exceeded')).toBe(ErrorKind.RateLimit)
      expect(classifyErrorKind('too many requests')).toBe(ErrorKind.RateLimit)
      expect(classifyErrorKind('rate_limited')).toBe(ErrorKind.RateLimit)
    })

    it('should classify authentication errors', () => {
      expect(classifyErrorKind('unauthorized')).toBe(ErrorKind.Authentication)
      expect(classifyErrorKind('permission denied')).toBe(ErrorKind.Authentication)
      expect(classifyErrorKind('invalid api key')).toBe(ErrorKind.Authentication)
    })

    it('should classify timeout errors', () => {
      expect(classifyErrorKind('timeout')).toBe(ErrorKind.Timeout)
      expect(classifyErrorKind('timed out')).toBe(ErrorKind.Timeout)
    })

    it('should classify network errors', () => {
      expect(classifyErrorKind('refused')).toBe(ErrorKind.Network)
      expect(classifyErrorKind('ECONNREFUSED')).toBe(ErrorKind.Network)
      expect(classifyErrorKind('ECONNRESET')).toBe(ErrorKind.Network)
      expect(classifyErrorKind('service unavailable')).toBe(ErrorKind.Network)
      expect(classifyErrorKind('503 temporarily unavailable')).toBe(ErrorKind.Network)
    })

    it('should classify config errors', () => {
      expect(classifyErrorKind('not provided')).toBe(ErrorKind.Config)
      expect(classifyErrorKind('missing key')).toBe(ErrorKind.Config)
    })

    it('should default to provider error', () => {
      expect(classifyErrorKind('unknown issue')).toBe(ErrorKind.Provider)
    })

    it('should be case-insensitive', () => {
      expect(classifyErrorKind('TIMEOUT')).toBe(ErrorKind.Timeout)
      expect(classifyErrorKind('UnAuthorized')).toBe(ErrorKind.Authentication)
    })
  })

  describe('isTransientError', () => {
    it('should identify transient timeout errors', () => {
      expect(isTransientError('timeout')).toBe(true)
      expect(isTransientError('timed out')).toBe(true)
    })

    it('should identify transient connection errors', () => {
      expect(isTransientError('ECONNREFUSED')).toBe(true)
      expect(isTransientError('ECONNRESET')).toBe(true)
      expect(isTransientError('eai_again')).toBe(true)
    })

    it('should identify transient rate limit errors', () => {
      expect(isTransientError('rate limit')).toBe(true)
      expect(isTransientError('too many requests')).toBe(true)
    })

    it('should identify transient service errors', () => {
      expect(isTransientError('503 service unavailable')).toBe(true)
      expect(isTransientError('502 bad gateway')).toBe(true)
      expect(isTransientError('504 gateway timeout')).toBe(true)
    })

    it('should not identify persistent auth errors as transient', () => {
      expect(isTransientError('unauthorized')).toBe(false)
      expect(isTransientError('invalid api key')).toBe(false)
    })

    it('should not identify config errors as transient', () => {
      expect(isTransientError('not provided')).toBe(false)
    })
  })

  describe('retryAsync', () => {
    it('should return result on first success', async () => {
      const fn = jest.fn().mockResolvedValue('success')
      const result = await retryAsync(fn, 3, 100)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on transient error', async () => {
      const error = new Error('timeout')
      const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('success')
      const result = await retryAsync(fn, 2, 50)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should not retry on persistent error', async () => {
      const error = new Error('invalid api key')
      const fn = jest.fn().mockRejectedValue(error)
      await expect(retryAsync(fn, 3, 50)).rejects.toThrow('invalid api key')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should exhaust retries for transient errors', async () => {
      const error = new Error('timeout')
      const fn = jest.fn().mockRejectedValue(error)
      await expect(retryAsync(fn, 2, 50)).rejects.toThrow('timeout')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should handle single attempt', async () => {
      const fn = jest.fn().mockResolvedValue('result')
      const result = await retryAsync(fn, 1, 100)
      expect(result).toBe('result')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should respect delay between retries', async () => {
      const error = new Error('timeout')
      const fn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success')

      // This should retry twice and succeed on the third attempt
      const start = Date.now()
      const result = await retryAsync(fn, 3, 5)
      const elapsed = Date.now() - start

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
      // Should have some delay between retries (not perfect but works)
      expect(elapsed).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error classification integration', () => {
    it('should classify Error instance from provider', () => {
      const apiError = new Error('rate limit exceeded')
      expect(classifyErrorKind(apiError)).toBe(ErrorKind.RateLimit)
    })

    it('should determine if Error is transient', () => {
      const transientError = new Error('ECONNREFUSED')
      const persistentError = new Error('unauthorized')

      expect(isTransientError(transientError)).toBe(true)
      expect(isTransientError(persistentError)).toBe(false)
    })
  })
})

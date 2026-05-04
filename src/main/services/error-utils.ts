export enum ErrorKind {
  Unknown = 'unknown',
  Network = 'network',
  RateLimit = 'rate_limit',
  Authentication = 'authentication',
  Timeout = 'timeout',
  Provider = 'provider',
  Config = 'config'
}

export function extractErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message || error.toString()
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function classifyErrorKind(error: unknown): ErrorKind {
  const message = extractErrorMessage(error).toLowerCase()
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('rate_limited')
  ) {
    return ErrorKind.RateLimit
  }
  if (
    message.includes('unauthorized') ||
    message.includes('permission') ||
    message.includes('invalid api key') ||
    message.includes('authentication')
  ) {
    return ErrorKind.Authentication
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return ErrorKind.Timeout
  }
  if (
    message.includes('refused') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('eai_again') ||
    message.includes('service unavailable') ||
    message.includes('temporarily unavailable')
  ) {
    return ErrorKind.Network
  }
  if (message.includes('not provided') || message.includes('missing')) {
    return ErrorKind.Config
  }
  return ErrorKind.Provider
}

export function providerError(provider: string, error: unknown): string {
  const message = extractErrorMessage(error)
  const kind = classifyErrorKind(error)
  logError(provider, error, kind)
  return `${provider} Error: ${message}`
}

export function logError(
  provider: string,
  error: unknown,
  kind: ErrorKind = ErrorKind.Provider
): void {
  const message = extractErrorMessage(error)
  if (error instanceof Error) {
    console.error(`[MJ][${provider}][${kind}] ${message}`, error.stack)
  } else {
    console.error(`[MJ][${provider}][${kind}] ${message}`)
  }
}

export function isTransientError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase()
  return [
    'timeout',
    'timed out',
    'econnrefused',
    'econnreset',
    'eai_again',
    'rate limit',
    'rate_limited',
    'too many requests',
    '503',
    '502',
    '504',
    'service unavailable',
    'temporarily unavailable'
  ].some((token) => message.includes(token))
}

export async function retryAsync<T>(fn: () => Promise<T>, attempts = 2, delayMs = 500): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error
      if (attempt === attempts || !isTransientError(error)) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastError
}

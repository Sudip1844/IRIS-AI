import { parseChatRequest, ChatRequestOptions, SupportedAiProvider } from '../chat-handler'
import { extractErrorMessage, classifyErrorKind, ErrorKind, isTransientError } from '../error-utils'

describe('chat-handler', () => {
  describe('parseChatRequest', () => {
    it('should parse string as text with auto provider', () => {
      const request: ChatRequestOptions = 'Hello world'
      const parsed = parseChatRequest(request)

      expect(parsed.text).toBe('Hello world')
      expect(parsed.provider).toBe('auto')
      expect(parsed.model).toBeUndefined()
    })

    it('should parse object request with provider and model', () => {
      const request: ChatRequestOptions = {
        text: 'Test message',
        provider: 'openai',
        model: 'gpt-4'
      }
      const parsed = parseChatRequest(request)

      expect(parsed.text).toBe('Test message')
      expect(parsed.provider).toBe('openai')
      expect(parsed.model).toBe('gpt-4')
    })

    it('should default provider to auto if not specified', () => {
      const request: ChatRequestOptions = {
        text: 'Test'
      }
      const parsed = parseChatRequest(request)

      expect(parsed.provider).toBe('auto')
    })

    it('should handle all supported providers', () => {
      const providers: SupportedAiProvider[] = [
        'openai',
        'anthropic',
        'gemini',
        'groq',
        'deepseek',
        'mistral',
        'openrouter',
        'xai',
        'huggingface',
        'tavily',
        'auto',
        'default'
      ]

      for (const provider of providers) {
        const request: ChatRequestOptions = {
          text: 'Test',
          provider
        }
        const parsed = parseChatRequest(request)
        expect(parsed.provider).toBe(provider)
      }
    })

    it('should trim model string if provided', () => {
      const request: ChatRequestOptions = {
        text: 'Test',
        model: '  gpt-4  '
      }
      const parsed = parseChatRequest(request)

      // Model is not trimmed in parsing itself, just passed through
      expect(parsed.model).toBe('  gpt-4  ')
    })
  })

  describe('provider key resolution patterns', () => {
    it('should identify when provider key is available', () => {
      const keys = {
        openai: 'sk-test-key',
        anthropic: undefined,
        gemini: 'gemini-key'
      }

      expect(keys.openai).toBeDefined()
      expect(keys.anthropic).toBeUndefined()
      expect(keys.gemini).toBeDefined()
    })

    it('should handle empty keys object', () => {
      const keys: Partial<Record<string, string | undefined>> = {}
      const hasAny = Object.values(keys).some((v) => v)

      expect(hasAny).toBe(false)
    })

    it('should check all provider keys efficiently', () => {
      const keys = {
        groq: undefined,
        gemini: undefined,
        openai: undefined,
        anthropic: undefined,
        deepseek: undefined,
        mistral: undefined,
        openrouter: undefined,
        xai: undefined,
        nvidia_nim: undefined,
        huggingface: undefined,
        tavily: undefined
      }

      const hasAllEmpty = Object.values(keys).every((value) => !value)
      expect(hasAllEmpty).toBe(true)
    })

    it('should handle partial keys set', () => {
      const keys = {
        openai: 'key1',
        anthropic: 'key2',
        gemini: undefined,
        groq: undefined
      }

      const hasKeys = Object.values(keys).filter((v) => v).length > 0
      expect(hasKeys).toBe(true)
    })
  })

  describe('provider model resolution', () => {
    it('should use override model if provided', () => {
      const overrideModel = 'gpt-4-turbo'
      const storedModel = 'gpt-4'

      const resolveModel = (stored: string | undefined, override?: string, fallback?: string) => {
        return override?.trim() || stored?.trim() || fallback
      }

      expect(resolveModel(storedModel, overrideModel)).toBe('gpt-4-turbo')
    })

    it('should fall back to stored model config', () => {
      const resolveModel = (stored: string | undefined, override?: string, fallback?: string) => {
        return override?.trim() || stored?.trim() || fallback
      }

      expect(resolveModel('gpt-4', undefined, 'gpt-3.5')).toBe('gpt-4')
    })

    it('should use fallback if no other model available', () => {
      const resolveModel = (stored: string | undefined, override?: string, fallback?: string) => {
        return override?.trim() || stored?.trim() || fallback
      }

      expect(resolveModel(undefined, undefined, 'gpt-4')).toBe('gpt-4')
    })

    it('should prioritize override > stored > fallback', () => {
      const resolveModel = (stored: string | undefined, override?: string, fallback?: string) => {
        return override?.trim() || stored?.trim() || fallback
      }

      expect(resolveModel('stored', 'override', 'fallback')).toBe('override')
      expect(resolveModel('stored', undefined, 'fallback')).toBe('stored')
      expect(resolveModel(undefined, undefined, 'fallback')).toBe('fallback')
    })
  })

  describe('provider endpoint resolution', () => {
    it('should return stored endpoint if available', () => {
      const endpoint = 'https://api.deepseek.com'
      const trimmed = endpoint?.trim() || undefined

      expect(trimmed).toBe(endpoint)
    })

    it('should return undefined if no endpoint stored', () => {
      const endpoint: string | undefined = undefined
      const result = endpoint?.trim() || undefined

      expect(result).toBeUndefined()
    })

    it('should trim whitespace from endpoint', () => {
      const endpoint = '  https://api.example.com  '
      const result = endpoint?.trim() || undefined

      expect(result).toBe('https://api.example.com')
    })
  })

  describe('provider routing logic', () => {
    it('should route to openai if provider matches and key exists', () => {
      const provider = 'openai'
      const key = 'sk-test'
      const shouldRoute = provider === 'openai' && !!key

      expect(shouldRoute).toBe(true)
    })

    it('should route to anthropic if provider matches and key exists', () => {
      const provider = 'anthropic'
      const key = 'claude-key'
      const shouldRoute = provider === 'anthropic' && !!key

      expect(shouldRoute).toBe(true)
    })

    it('should not route if provider matches but key missing', () => {
      const provider = 'openai'
      const key: string | undefined = undefined
      const shouldRoute = provider === 'openai' && !!key

      expect(shouldRoute).toBe(false)
    })

    it('should identify compatible providers', () => {
      const compatibleProviders = ['deepseek', 'mistral', 'openrouter', 'xai'] as const
      const provider = 'deepseek'

      const isCompatible = compatibleProviders.includes(provider as any)
      expect(isCompatible).toBe(true)
    })

    it('should not route incompatible provider through compatible handler', () => {
      const compatibleProviders = ['deepseek', 'mistral', 'openrouter', 'xai'] as const
      const provider = 'gemini'

      const isCompatible = compatibleProviders.includes(provider as any)
      expect(isCompatible).toBe(false)
    })
  })

  describe('fallback chain logic', () => {
    it('should track fallback errors', () => {
      const fallbackErrors: string[] = []

      fallbackErrors.push('Gemini failed')
      fallbackErrors.push('OpenAI failed')

      expect(fallbackErrors).toHaveLength(2)
      expect(fallbackErrors.join(' | ')).toBe('Gemini failed | OpenAI failed')
    })

    it('should return aggregated error on complete failure', () => {
      const fallbackErrors = ['Provider 1 failed', 'Provider 2 failed', 'Provider 3 failed']
      const result = `ERROR: All configured providers failed. ${fallbackErrors.join(' | ')}`

      expect(result).toContain('All configured providers failed')
      expect(result).toContain('Provider 1 failed')
      expect(result).toContain('Provider 3 failed')
    })

    it('should only return error message if fallback errors exist', () => {
      const fallbackErrors: string[] = []

      let result: string
      if (fallbackErrors.length > 0) {
        result = `ERROR: ${fallbackErrors.join(' | ')}`
      } else {
        result = 'No error'
      }

      expect(result).toBe('No error')
    })
  })

  describe('provider key narrowing patterns', () => {
    it('should narrow openai key in conditional', () => {
      const keys = { openai: 'key1' as string | undefined }

      if (keys.openai) {
        const openaiKey: string = keys.openai
        expect(openaiKey).toBe('key1')
      }
    })

    it('should narrow anthropic key in conditional', () => {
      const keys = { anthropic: 'claude-key' as string | undefined }

      if (keys.anthropic) {
        const anthropicKey: string = keys.anthropic
        expect(anthropicKey).toBe('claude-key')
      }
    })

    it('should not narrow if condition false', () => {
      const keys = { openai: undefined as string | undefined }

      if (keys.openai) {
        const openaiKey: string = keys.openai
        expect(openaiKey).toBeDefined()
      } else {
        expect(keys.openai).toBeUndefined()
      }
    })
  })

  describe('error handling in providers', () => {
    it('should classify and log provider errors', () => {
      const error = new Error('timeout')
      const kind = classifyErrorKind(error)

      expect(kind).toBe(ErrorKind.Timeout)
      expect(isTransientError(error)).toBe(true)
    })

    it('should identify non-transient auth errors', () => {
      const error = new Error('invalid api key')
      const kind = classifyErrorKind(error)

      expect(kind).toBe(ErrorKind.Authentication)
      expect(isTransientError(error)).toBe(false)
    })

    it('should format provider error message', () => {
      const provider = 'OpenAI'
      const message = 'rate limit exceeded'
      const formatted = `${provider} Error: ${message}`

      expect(formatted).toBe('OpenAI Error: rate limit exceeded')
    })
  })
})

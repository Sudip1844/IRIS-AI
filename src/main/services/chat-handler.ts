import { ipcMain, app, safeStorage } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { GoogleGenAI } from '@google/genai'
import Groq from 'groq-sdk'
import { chatWithOpenAI, streamChatWithOpenAI } from './openai-handler'
import { chatWithAnthropic, streamChatWithAnthropic } from './anthropic-handler'
import {
  chatWithOpenAICompatible,
  streamChatWithOpenAICompatible,
  PROVIDER_CONFIGS
} from './openai-compatible-handler'
import { chatWithHuggingFace, streamChatWithHuggingFace } from './huggingface-handler'
import { chatWithTavily, streamChatWithTavily } from './tavily-handler'
import { loadProviderConfig, ProviderConfig, ProviderStore } from './providers/provider-registry'
import { extractErrorMessage, logError, providerError, retryAsync } from './error-utils'

export type SupportedAiProvider =
  ProviderStore extends Record<infer K, any> ? K | 'auto' | 'default' : string
export type ChatRequestOptions =
  | string
  | {
      text: string
      provider?: SupportedAiProvider
      model?: string
    }
export type ProviderKeys = Partial<Record<Exclude<keyof ProviderStore, symbol>, string>>
export function parseChatRequest(options: ChatRequestOptions) {
  return {
    text: typeof options === 'string' ? options : options.text,
    provider:
      typeof options === 'string' ? 'auto' : ((options.provider ?? 'auto') as SupportedAiProvider),
    model: typeof options === 'string' ? undefined : options.model
  }
}
// Maintain simple conversation context (optional later upgrade)
const chatHistory: any[] = []

function getSecureVaultPath() {
  const userData = app.getPath('userData')
  const candidates = [
    join(userData, 'mj_secure_vault.json'),
    join(userData, 'iris_secure_vault.json')
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0]
}

export default function registerChatHandler() {
  const secureConfigPath = getSecureVaultPath()

  function isProviderEnabled(config?: ProviderConfig): boolean {
    return config?.enabled !== false
  }

  function getProviderModel(
    store: ProviderStore,
    provider: keyof ProviderStore,
    overrideModel?: string
  ): string | undefined {
    if (overrideModel && overrideModel.trim().length > 0) return overrideModel.trim()
    return store[provider]?.model?.trim() || undefined
  }

  function getProviderEndpoint(
    store: ProviderStore,
    provider: keyof ProviderStore
  ): string | undefined {
    return store[provider]?.endpoint?.trim() || undefined
  }

  function loadKeysFromProviderStore(store: ProviderStore): ProviderKeys {
    return {
      groq: isProviderEnabled(store.groq) ? store.groq?.apiKey : undefined,
      gemini: isProviderEnabled(store.gemini) ? store.gemini?.apiKey : undefined,
      openai: isProviderEnabled(store.openai) ? store.openai?.apiKey : undefined,
      anthropic: isProviderEnabled(store.anthropic) ? store.anthropic?.apiKey : undefined,
      deepseek: isProviderEnabled(store.deepseek) ? store.deepseek?.apiKey : undefined,
      mistral: isProviderEnabled(store.mistral) ? store.mistral?.apiKey : undefined,
      openrouter: isProviderEnabled(store.openrouter) ? store.openrouter?.apiKey : undefined,
      xai: isProviderEnabled(store.xai) ? store.xai?.apiKey : undefined,
      nvidia_nim: isProviderEnabled(store.nvidia_nim) ? store.nvidia_nim?.apiKey : undefined,
      huggingface: isProviderEnabled(store.huggingface) ? store.huggingface?.apiKey : undefined,
      tavily: isProviderEnabled(store.tavily) ? store.tavily?.apiKey : undefined
    }
  }

  function loadFallbackKeys(): ProviderKeys {
    const keys: ProviderKeys = {}
    try {
      if (!fs.existsSync(secureConfigPath)) return keys
      const data = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))

      if (safeStorage.isEncryptionAvailable()) {
        if (data.groq) keys.groq = safeStorage.decryptString(Buffer.from(data.groq, 'base64'))
        if (data.gemini) keys.gemini = safeStorage.decryptString(Buffer.from(data.gemini, 'base64'))
        if (data.openai) keys.openai = safeStorage.decryptString(Buffer.from(data.openai, 'base64'))
        if (data.anthropic)
          keys.anthropic = safeStorage.decryptString(Buffer.from(data.anthropic, 'base64'))
      } else {
        if (data.groq) keys.groq = Buffer.from(data.groq, 'base64').toString('utf8')
        if (data.gemini) keys.gemini = Buffer.from(data.gemini, 'base64').toString('utf8')
        if (data.openai) keys.openai = Buffer.from(data.openai, 'base64').toString('utf8')
        if (data.anthropic) keys.anthropic = Buffer.from(data.anthropic, 'base64').toString('utf8')
      }
    } catch (e: unknown) {
      logError('SecureKeyLoad', e)
    }
    return keys
  }

  // Core logic extracted for internal use
  export async function handleChatRequest(options: ChatRequestOptions): Promise<string> {
    const { text, provider, model } = parseChatRequest(options)
    const providerStore = loadProviderConfig()
    let keys = loadKeysFromProviderStore(providerStore)

    // Fallback to legacy vault if provider config doesn't contain keys
    if (Object.values(keys).every((value) => !value)) {
      keys = { ...keys, ...loadFallbackKeys() }
    }

    const resolveModel = (providerName: keyof ProviderStore, fallbackModel: string): string => {
      return model?.trim() || providerStore[providerName]?.model?.trim() || fallbackModel
    }

    const resolveEndpoint = (providerName: keyof ProviderStore): string | undefined => {
      return providerStore[providerName]?.endpoint?.trim() || undefined
    }

    // Route to appropriate provider
    if (provider === 'openai' && keys.openai) {
      const openaiKey = keys.openai
      try {
        return await retryAsync(
          () => chatWithOpenAI(openaiKey, text, resolveModel('openai', 'gpt-4')),
          2,
          500
        )
      } catch (err: unknown) {
        return providerError('OpenAI', err)
      }
    }

    if (provider === 'anthropic' && keys.anthropic) {
      const anthropicKey = keys.anthropic
      try {
        return await retryAsync(
          () =>
            chatWithAnthropic(
              anthropicKey,
              text,
              resolveModel('anthropic', 'claude-3-sonnet-20240229')
            ),
          2,
          500
        )
      } catch (err: unknown) {
        return providerError('Anthropic', err)
      }
    }

    // Handle OpenAI-compatible providers
    const compatibleProviders = ['deepseek', 'mistral', 'openrouter', 'xai'] as const
    if (compatibleProviders.includes(provider as any) && keys[provider as keyof ProviderStore]) {
      try {
        const providerName = provider as keyof ProviderStore
        const config = PROVIDER_CONFIGS[providerName]
        return await retryAsync(
          () =>
            chatWithOpenAICompatible(
              {
                apiKey: keys[providerName]!,
                baseURL: resolveEndpoint(providerName) || config.baseURL,
                model: resolveModel(providerName, config.defaultModel) || config.defaultModel
              },
              text
            ),
          2,
          500
        )
      } catch (err: unknown) {
        return providerError(provider, err)
      }
    }

    if (provider === 'huggingface' && keys.huggingface) {
      const huggingfaceKey = keys.huggingface
      try {
        return await retryAsync(
          () => chatWithHuggingFace(huggingfaceKey, text, resolveModel('huggingface', 'gpt2')),
          2,
          500
        )
      } catch (err: any) {
        return providerError('Hugging Face', err)
      }
    }

    if (provider === 'tavily' && keys.tavily) {
      const tavilyKey = keys.tavily
      try {
        return await retryAsync(() => chatWithTavily(tavilyKey, text), 2, 500)
      } catch (err: any) {
        return providerError('Tavily', err)
      }
    }

    // Auto-select best available provider or fallback chain
    if (provider === 'auto' || provider === 'default') {
      const fallbackErrors: string[] = []

      // Try primary providers first
      if (keys.gemini) {
        try {
          const ai = new GoogleGenAI({ apiKey: keys.gemini })
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional. The user says: "${text}"`
          })
          return response.text
        } catch (err: any) {
          const message = providerError('Gemini', err)
          console.log('[MJ] Gemini failed, trying fallback:', message)
          fallbackErrors.push(message)
        }
      }

      if (keys.openai) {
        const openaiKey = keys.openai
        try {
          return await retryAsync(() => chatWithOpenAI(openaiKey, text, model || 'gpt-4'), 2, 500)
        } catch (err: any) {
          const message = providerError('OpenAI', err)
          console.log('[MJ] OpenAI failed, trying fallback:', message)
          fallbackErrors.push(message)
        }
      }

      if (keys.anthropic) {
        const anthropicKey = keys.anthropic
        try {
          return await retryAsync(
            () => chatWithAnthropic(anthropicKey, text, model || 'claude-3-sonnet-20240229'),
            2,
            500
          )
        } catch (err: any) {
          const message = providerError('Anthropic', err)
          console.log('[MJ] Anthropic failed, trying fallback:', message)
          fallbackErrors.push(message)
        }
      }

      // Final fallback to Groq
      if (keys.groq) {
        try {
          const groq = new Groq({ apiKey: keys.groq })
          const completion = await groq.chat.completions.create({
            messages: [
              {
                role: 'system',
                content:
                  'You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional.'
              },
              { role: 'user', content: text }
            ],
            model: 'llama3-8b-8192'
          })
          return completion.choices[0]?.message?.content || 'No response'
        } catch (err: any) {
          const message = providerError('Groq', err)
          console.log('[MJ] Groq fallback failed:', message)
          fallbackErrors.push(message)
          return `ERROR: All configured providers failed. ${fallbackErrors.join(' | ')}`
        }
      }

      if (fallbackErrors.length > 0) {
        return `ERROR: All configured providers failed. ${fallbackErrors.join(' | ')}`
      }
    }

    return 'ERROR: No AI Model configured. Please save API keys in Settings (Gemini, OpenAI, Anthropic, or Groq).'
  }

  // Enhanced IPC handler supporting multiple providers
  ipcMain.handle('chat-with-ai', async (_, options: ChatRequestOptions) => {
    return handleChatRequest(options)

  })

  // Stream response handler for long-running AI tasks
  ipcMain.handle('chat-with-ai-stream', async (event, options: ChatRequestOptions) => {
    const { text, provider, model } = parseChatRequest(options)
    const providerStore = loadProviderConfig()
    let keys = loadKeysFromProviderStore(providerStore)

    if (Object.values(keys).every((value) => !value)) {
      keys = { ...keys, ...loadFallbackKeys() }
    }

    const compatibleProviders = ['deepseek', 'mistral', 'openrouter', 'xai'] as const
    const resolveModel = (providerName: keyof ProviderStore, fallbackModel: string): string => {
      return model?.trim() || providerStore[providerName]?.model?.trim() || fallbackModel
    }

    const resolveEndpoint = (providerName: keyof ProviderStore): string | undefined => {
      return providerStore[providerName]?.endpoint?.trim() || undefined
    }

    // Stream from selected provider
    try {
      if (provider === 'openai' && keys.openai) {
        for await (const chunk of streamChatWithOpenAI(
          keys.openai,
          text,
          resolveModel('openai', 'gpt-4')
        )) {
          event.sender.send('chat-stream-chunk', chunk)
        }
      } else if (provider === 'anthropic' && keys.anthropic) {
        for await (const chunk of streamChatWithAnthropic(
          keys.anthropic,
          text,
          resolveModel('anthropic', 'claude-3-sonnet-20240229')
        )) {
          event.sender.send('chat-stream-chunk', chunk)
        }
      } else if (
        compatibleProviders.includes(provider as any) &&
        keys[provider as keyof ProviderStore]
      ) {
        const providerName = provider as keyof ProviderStore
        const config = PROVIDER_CONFIGS[providerName]
        await streamChatWithOpenAICompatible(
          {
            apiKey: keys[providerName]!,
            baseURL: resolveEndpoint(providerName) || config.baseURL,
            model: resolveModel(providerName, config.defaultModel) || config.defaultModel
          },
          text,
          (chunk) => event.sender.send('chat-stream-chunk', chunk)
        )
      } else if (provider === 'huggingface' && keys.huggingface) {
        const huggingfaceKey = keys.huggingface
        await streamChatWithHuggingFace(
          huggingfaceKey,
          text,
          (chunk) => event.sender.send('chat-stream-chunk', chunk),
          resolveModel('huggingface', 'gpt2')
        )
      } else if (provider === 'tavily' && keys.tavily) {
        const tavilyKey = keys.tavily
        await streamChatWithTavily(tavilyKey, text, (chunk) =>
          event.sender.send('chat-stream-chunk', chunk)
        )
      } else if (keys.openai) {
        // Default to OpenAI for streaming if available
        for await (const chunk of streamChatWithOpenAI(
          keys.openai,
          text,
          resolveModel('openai', 'gpt-4')
        )) {
          event.sender.send('chat-stream-chunk', chunk)
        }
      } else {
        throw new Error(
          'No AI provider configured for streaming or selected provider missing API key.'
        )
      }
    } catch (err: unknown) {
      logError('ChatStream', err)
      event.sender.send('chat-stream-error', extractErrorMessage(err))
    }

    event.sender.send('chat-stream-end', 'Stream completed')
  })
}

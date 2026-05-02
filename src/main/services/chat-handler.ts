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
import { loadProviderConfig, ProviderStore } from './providers/provider-registry'

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

  function loadKeysFromProviderStore(store: ProviderStore) {
    return {
      groq: store.groq?.apiKey,
      gemini: store.gemini?.apiKey,
      openai: store.openai?.apiKey,
      anthropic: store.anthropic?.apiKey,
      deepseek: store.deepseek?.apiKey,
      mistral: store.mistral?.apiKey,
      openrouter: store.openrouter?.apiKey,
      xai: store.xai?.apiKey,
      nvidia_nim: store.nvidia_nim?.apiKey,
      huggingface: store.huggingface?.apiKey,
      tavily: store.tavily?.apiKey
    }
  }

  function loadFallbackKeys() {
    const keys: any = {}
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
    } catch (e) {
      console.log('[MJ Backend] Failed to read secure keys', e)
    }
    return keys
  }

  // Enhanced IPC handler supporting multiple providers
  ipcMain.handle('chat-with-ai', async (_, options: any) => {
    // Support both old format (string) and new format (object)
    const text = typeof options === 'string' ? options : options.text
    const provider = (typeof options === 'string' ? 'auto' : options.provider) || 'auto'
    const model = (typeof options === 'string' ? undefined : options.model) || undefined

    const providerStore = loadProviderConfig()
    let keys: any = loadKeysFromProviderStore(providerStore)

    // Fallback to legacy vault if provider config doesn't contain keys
    if (
      !keys.groq &&
      !keys.gemini &&
      !keys.openai &&
      !keys.anthropic &&
      !keys.deepseek &&
      !keys.mistral &&
      !keys.openrouter &&
      !keys.xai &&
      !keys.nvidia_nim &&
      !keys.huggingface &&
      !keys.tavily
    ) {
      keys = { ...keys, ...loadFallbackKeys() }
    }

    // Route to appropriate provider
    if (provider === 'openai' && keys.openai) {
      try {
        return await chatWithOpenAI(keys.openai, text, model || 'gpt-4')
      } catch (err: any) {
        return `OpenAI Error: ${err.message}`
      }
    }

    if (provider === 'anthropic' && keys.anthropic) {
      try {
        return await chatWithAnthropic(keys.anthropic, text, model || 'claude-3-sonnet-20240229')
      } catch (err: any) {
        return `Anthropic Error: ${err.message}`
      }
    }

    // Handle OpenAI-compatible providers
    const compatibleProviders = ['deepseek', 'mistral', 'openrouter', 'xai']
    if (compatibleProviders.includes(provider) && keys[provider]) {
      try {
        const config = PROVIDER_CONFIGS[provider]
        return await chatWithOpenAICompatible(
          {
            apiKey: keys[provider],
            baseURL: config.baseURL,
            model: model || config.defaultModel
          },
          text
        )
      } catch (err: any) {
        return `${provider} Error: ${err.message}`
      }
    }

    if (provider === 'huggingface' && keys.huggingface) {
      try {
        return await chatWithHuggingFace(keys.huggingface, text, model)
      } catch (err: any) {
        return `Hugging Face Error: ${err.message}`
      }
    }

    if (provider === 'tavily' && keys.tavily) {
      try {
        return await chatWithTavily(keys.tavily, text)
      } catch (err: any) {
        return `Tavily Error: ${err.message}`
      }
    }

    // Auto-select best available provider or fallback chain
    if (provider === 'auto' || provider === 'default') {
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
          console.log('[MJ] Gemini failed, trying fallback:', err.message)
        }
      }

      if (keys.openai) {
        try {
          return await chatWithOpenAI(keys.openai, text, model || 'gpt-4')
        } catch (err: any) {
          console.log('[MJ] OpenAI failed, trying fallback:', err.message)
        }
      }

      if (keys.anthropic) {
        try {
          return await chatWithAnthropic(keys.anthropic, text, model || 'claude-3-sonnet-20240229')
        } catch (err: any) {
          console.log('[MJ] Anthropic failed, trying fallback:', err.message)
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
          return `Groq Error: ${err.message}`
        }
      }
    }

    return 'ERROR: No AI Model configured. Please save API keys in Settings (Gemini, OpenAI, Anthropic, or Groq).'
  })

  // Stream response handler for long-running AI tasks
  ipcMain.handle('chat-with-ai-stream', async (event, options: any) => {
    const text = typeof options === 'string' ? options : options.text
    const provider = (typeof options === 'string' ? 'auto' : options.provider) || 'auto'
    const model = (typeof options === 'string' ? undefined : options.model) || undefined

    const providerStore = loadProviderConfig()
    let keys: any = loadKeysFromProviderStore(providerStore)

    if (
      !keys.groq &&
      !keys.gemini &&
      !keys.openai &&
      !keys.anthropic &&
      !keys.deepseek &&
      !keys.mistral &&
      !keys.openrouter &&
      !keys.xai &&
      !keys.nvidia_nim &&
      !keys.huggingface &&
      !keys.tavily
    ) {
      keys = { ...keys, ...loadFallbackKeys() }
    }

    const compatibleProviders = ['deepseek', 'mistral', 'openrouter', 'xai']

    // Stream from selected provider
    try {
      if (provider === 'openai' && keys.openai) {
        for await (const chunk of streamChatWithOpenAI(keys.openai, text, model || 'gpt-4')) {
          event.sender.send('chat-stream-chunk', chunk)
        }
      } else if (provider === 'anthropic' && keys.anthropic) {
        for await (const chunk of streamChatWithAnthropic(
          keys.anthropic,
          text,
          model || 'claude-3-sonnet-20240229'
        )) {
          event.sender.send('chat-stream-chunk', chunk)
        }
      } else if (compatibleProviders.includes(provider) && keys[provider]) {
        const config = PROVIDER_CONFIGS[provider]
        await streamChatWithOpenAICompatible(
          {
            apiKey: keys[provider],
            baseURL: config.baseURL,
            model: model || config.defaultModel
          },
          text,
          (chunk) => event.sender.send('chat-stream-chunk', chunk)
        )
      } else if (provider === 'huggingface' && keys.huggingface) {
        await streamChatWithHuggingFace(
          keys.huggingface,
          text,
          (chunk) => event.sender.send('chat-stream-chunk', chunk),
          model
        )
      } else if (provider === 'tavily' && keys.tavily) {
        await streamChatWithTavily(keys.tavily, text, (chunk) =>
          event.sender.send('chat-stream-chunk', chunk)
        )
      } else if (keys.openai) {
        // Default to OpenAI for streaming if available
        for await (const chunk of streamChatWithOpenAI(keys.openai, text, model || 'gpt-4')) {
          event.sender.send('chat-stream-chunk', chunk)
        }
      }
    } catch (err: any) {
      event.sender.send('chat-stream-error', err.message)
    }

    event.sender.send('chat-stream-end', 'Stream completed')
  })
}

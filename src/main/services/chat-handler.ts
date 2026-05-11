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
import {
  createSession,
  getActiveSession,
  getAllSessions,
  setActiveSession,
  deleteSession,
  addMessage,
  getRecentMessages,
  getContextForAI,
  clearHistory,
  renameSession,
  ChatSession
} from './chat-history'

export type SupportedAiProvider =
  ProviderStore extends Record<infer K, any> ? K | 'auto' | 'default' : string
export type ChatRequestOptions =
  | string
  | {
      text: string
      images?: string[]
      provider?: SupportedAiProvider
      model?: string
    }
export type ProviderKeys = Partial<Record<Exclude<keyof ProviderStore, symbol>, string>>
export function parseChatRequest(options: ChatRequestOptions) {
  return {
    text: typeof options === 'string' ? options : options.text,
    images: typeof options === 'string' ? undefined : options.images,
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



  // Core logic extracted for internal use
export async function handleChatRequest(options: ChatRequestOptions): Promise<string> {
    const { text, images, provider, model } = parseChatRequest(options)
    const providerStore = loadProviderConfig()
    let keys = loadKeysFromProviderStore(providerStore)

    // Save user message to history
    addMessage('user', text, provider, model)

    // Get conversation context from history
    const context = getContextForAI(undefined, 10)
    const conversationContext = context.conversation
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
    const fullText = conversationContext ? `${conversationContext}\nUser: ${text}` : text



    const resolveModel = (providerName: keyof ProviderStore, fallbackModel: string): string => {
      return model?.trim() || providerStore[providerName]?.model?.trim() || fallbackModel
    }

    const resolveEndpoint = (providerName: keyof ProviderStore): string | undefined => {
      return providerStore[providerName]?.endpoint?.trim() || undefined
    }

    if (provider === 'openai' && keys.openai) {
      const openaiKey = keys.openai
      try {
        const response = await retryAsync(
          () => chatWithOpenAI(openaiKey, text, resolveModel('openai', 'gpt-4o'), images),
          2,
          500
        )
        addMessage('assistant', response, 'openai', resolveModel('openai', 'gpt-4o'))
        return response
      } catch (err: unknown) {
        return providerError('OpenAI', err)
      }
    }

    if (provider === 'anthropic' && keys.anthropic) {
      const anthropicKey = keys.anthropic
      try {
        const response = await retryAsync(
          () =>
            chatWithAnthropic(
              anthropicKey,
              text,
              resolveModel('anthropic', 'claude-3-5-sonnet-latest'),
              images
            ),
          2,
          500
        )
        addMessage('assistant', response, 'anthropic', resolveModel('anthropic', 'claude-3-5-sonnet-latest'))
        return response
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
        const response = await retryAsync(
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
        addMessage('assistant', response, providerName, resolveModel(providerName, config.defaultModel))
        return response
      } catch (err: unknown) {
        return providerError(provider, err)
      }
    }

    if (provider === 'huggingface' && keys.huggingface) {
      const huggingfaceKey = keys.huggingface
      try {
        const response = await retryAsync(
          () => chatWithHuggingFace(huggingfaceKey, text, resolveModel('huggingface', 'gpt2')),
          2,
          500
        )
        addMessage('assistant', response, 'huggingface', resolveModel('huggingface', 'gpt2'))
        return response
      } catch (err: any) {
        return providerError('Hugging Face', err)
      }
    }

    if (provider === 'tavily' && keys.tavily) {
      const tavilyKey = keys.tavily
      try {
        const response = await retryAsync(() => chatWithTavily(tavilyKey, text), 2, 500)
        addMessage('assistant', response, 'tavily', 'default')
        return response
      } catch (err: any) {
        return providerError('Tavily', err)
      }
    }

    // Auto-select best available provider or fallback chain
    if (provider === 'auto' || provider === 'default') {
      const fallbackErrors: string[] = []
      
      const primaryProvider = providerStore.primary_agent?.provider;
      const primaryModel = providerStore.primary_agent?.model;

      // Define an execution function for a specific provider
      const tryProvider = async (pName: string, pModel?: string) => {
          if (!keys[pName as keyof ProviderStore]) return null;
          try {
              if (pName === 'gemini') {
                  const ai = new GoogleGenAI({ apiKey: keys.gemini! });
                  let contents: any = `You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional. The user says: "${text}"`;
                  
                  if (images && images.length > 0) {
                      const parts: any[] = [];
                      for (const img of images) {
                          const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
                          parts.push({
                              inlineData: {
                                  data: base64Data,
                                  mimeType: 'image/jpeg'
                              }
                          });
                      }
                      parts.push({ text: contents });
                      contents = parts;
                  }

                  const response = await ai.models.generateContent({
                      model: pModel || 'gemini-2.5-flash',
                      contents: contents
                  });
                  return response.text || '';
              }
              if (pName === 'openai') {
                  return await retryAsync(() => chatWithOpenAI(keys.openai!, text, pModel || 'gpt-4o', images), 2, 500);
              }
              if (pName === 'anthropic') {
                  return await retryAsync(() => chatWithAnthropic(keys.anthropic!, text, pModel || 'claude-3-5-sonnet-latest', images), 2, 500);
              }
              if (pName === 'groq') {
                  const groq = new Groq({ apiKey: keys.groq! });
                  const completion = await groq.chat.completions.create({
                      messages: [
                          { role: 'system', content: 'You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional.' },
                          { role: 'user', content: text }
                      ],
                      model: pModel || 'llama3-8b-8192'
                  });
                  return completion.choices[0]?.message?.content || '';
              }
              if (compatibleProviders.includes(pName as any)) {
                  const config = PROVIDER_CONFIGS[pName as keyof ProviderStore];
                  return await retryAsync(() => chatWithOpenAICompatible({
                      apiKey: keys[pName as keyof ProviderStore]!,
                      baseURL: resolveEndpoint(pName as keyof ProviderStore) || config.baseURL,
                      model: pModel || config.defaultModel
                  }, text), 2, 500);
              }
              return null;
          } catch (err: any) {
              const message = providerError(pName, err);
              console.log(`[MJ] ${pName} failed, trying fallback:`, message);
              fallbackErrors.push(message);
              return null;
          }
      };

      // 1. Try Primary Agent
      if (primaryProvider) {
          const res = await tryProvider(primaryProvider, primaryModel);
          if (res) {
            addMessage('assistant', res, primaryProvider, primaryModel)
            return res;
          }
      }

      // 2. Try Fallbacks
      const fallbackList = ['gemini', 'openai', 'groq', 'anthropic', 'deepseek'];
      for (const p of fallbackList) {
          if (p === primaryProvider) continue; // Already tried
          const res = await tryProvider(p);
          if (res) {
            addMessage('assistant', res, p, undefined)
            return res;
          }
      }

      const errorMsg = `ERROR: All configured providers failed. ${fallbackErrors.join(' | ')}`;
      addMessage('assistant', errorMsg, 'system', undefined)
      return errorMsg;
    }

    const errorMsg = 'ERROR: No AI Model configured. Please save API keys in Settings (Gemini, OpenAI, Anthropic, or Groq).'
    addMessage('assistant', errorMsg, 'system', undefined)
    return errorMsg
  }

export default function registerChatHandler() {
  // Enhanced IPC handler supporting multiple providers
  ipcMain.handle('chat-with-ai', async (_, options: ChatRequestOptions) => {
    return handleChatRequest(options)

  })

  // Stream response handler for long-running AI tasks
  ipcMain.handle('chat-with-ai-stream', async (event, options: ChatRequestOptions) => {
    const { text, provider, model } = parseChatRequest(options)
    const providerStore = loadProviderConfig()
    let keys = loadKeysFromProviderStore(providerStore)



    const compatibleProviders = ['deepseek', 'mistral', 'openrouter', 'xai'] as const
    const resolveModel = (providerName: keyof ProviderStore, fallbackModel: string): string => {
      return model?.trim() || providerStore[providerName]?.model?.trim() || fallbackModel
    }

    const resolveEndpoint = (providerName: keyof ProviderStore): string | undefined => {
      return providerStore[providerName]?.endpoint?.trim() || undefined
    }

    // Stream from selected provider or auto fallback
    const primaryProvider = providerStore.primary_agent?.provider;
    const primaryModel = providerStore.primary_agent?.model;

    const tryStreamProvider = async (pName: string, pModel?: string) => {
        if (!keys[pName as keyof ProviderStore]) return false;
        try {
            if (pName === 'gemini') {
                const ai = new GoogleGenAI({ apiKey: keys.gemini! });
                const responseStream = await ai.models.generateContentStream({
                    model: pModel || 'gemini-2.5-flash',
                    contents: text
                });
                for await (const chunk of responseStream) {
                    if (chunk.text) event.sender.send('chat-stream-chunk', chunk.text);
                }
                return true;
            }
            if (pName === 'openai') {
                for await (const chunk of streamChatWithOpenAI(keys.openai!, text, pModel || 'gpt-4o')) {
                    event.sender.send('chat-stream-chunk', chunk);
                }
                return true;
            }
            if (pName === 'anthropic') {
                for await (const chunk of streamChatWithAnthropic(keys.anthropic!, text, pModel || 'claude-3-5-sonnet-20241022')) {
                    event.sender.send('chat-stream-chunk', chunk);
                }
                return true;
            }
            if (pName === 'groq') {
                const groq = new Groq({ apiKey: keys.groq! });
                const stream = await groq.chat.completions.create({
                    messages: [{ role: 'user', content: text }],
                    model: pModel || 'llama3-8b-8192',
                    stream: true
                });
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    if (content) event.sender.send('chat-stream-chunk', content);
                }
                return true;
            }
            if (compatibleProviders.includes(pName as any)) {
                const config = PROVIDER_CONFIGS[pName as keyof ProviderStore];
                await streamChatWithOpenAICompatible({
                    apiKey: keys[pName as keyof ProviderStore]!,
                    baseURL: resolveEndpoint(pName as keyof ProviderStore) || config.baseURL,
                    model: pModel || config.defaultModel
                }, text, (chunk) => event.sender.send('chat-stream-chunk', chunk));
                return true;
            }
            if (pName === 'huggingface') {
                await streamChatWithHuggingFace(keys.huggingface!, text, (chunk) => event.sender.send('chat-stream-chunk', chunk), pModel || 'gpt2');
                return true;
            }
            if (pName === 'tavily') {
                await streamChatWithTavily(keys.tavily!, text, (chunk) => event.sender.send('chat-stream-chunk', chunk));
                return true;
            }
            return false;
        } catch (err: any) {
            console.log(`[MJ Stream] ${pName} failed:`, err.message || err);
            return false; // returning false will cause fallback to try the next
        }
    };

    try {
        let streamSuccess = false;
        
        if (provider !== 'auto' && provider !== 'default' && provider) {
            streamSuccess = await tryStreamProvider(provider, model);
        } else {
            // Auto routing using Primary Agent
            if (primaryProvider) {
                streamSuccess = await tryStreamProvider(primaryProvider, primaryModel);
            }
            if (!streamSuccess) {
                const fallbackList = ['gemini', 'openai', 'groq', 'anthropic', 'deepseek'];
                for (const p of fallbackList) {
                    if (p === primaryProvider || (provider && p === provider)) continue;
                    streamSuccess = await tryStreamProvider(p);
                    if (streamSuccess) break;
                }
            }
        }

        if (!streamSuccess) {
            throw new Error('No AI provider configured for streaming or all configured providers failed.');
        }
    } catch (err: unknown) {
      logError('ChatStream', err)
      event.sender.send('chat-stream-error', extractErrorMessage(err))
    }

    event.sender.send('chat-stream-end', 'Stream completed')
  })

  // Chat History IPC Handlers
  ipcMain.handle('chat-history-get-sessions', async () => {
    try {
      return getAllSessions()
    } catch (err) {
      console.error('[MJ] Failed to get sessions:', err)
      return []
    }
  })

  ipcMain.handle('chat-history-get-messages', async (_, sessionId?: string) => {
    try {
      return getRecentMessages(50, sessionId)
    } catch (err) {
      console.error('[MJ] Failed to get messages:', err)
      return []
    }
  })

  ipcMain.handle('chat-history-create-session', async (_, name?: string) => {
    try {
      return createSession(name)
    } catch (err) {
      console.error('[MJ] Failed to create session:', err)
      return null
    }
  })

  ipcMain.handle('chat-history-set-active', async (_, sessionId: string) => {
    try {
      return setActiveSession(sessionId)
    } catch (err) {
      console.error('[MJ] Failed to set active session:', err)
      return false
    }
  })

  ipcMain.handle('chat-history-delete-session', async (_, sessionId: string) => {
    try {
      return deleteSession(sessionId)
    } catch (err) {
      console.error('[MJ] Failed to delete session:', err)
      return false
    }
  })

  ipcMain.handle('chat-history-clear', async () => {
    try {
      return clearHistory()
    } catch (err) {
      console.error('[MJ] Failed to clear history:', err)
      return false
    }
  })

  ipcMain.handle('chat-history-rename-session', async (_, sessionId: string, newName: string) => {
    try {
      return renameSession(sessionId, newName)
    } catch (err) {
      console.error('[MJ] Failed to rename session:', err)
      return false
    }
  })
}


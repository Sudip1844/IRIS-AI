import { ipcMain, app, safeStorage } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { exec } from 'child_process'
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
import { startApp } from '../logic/app-launcher'
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
      google: isProviderEnabled(store.google) ? store.google?.apiKey || store.gemini?.apiKey : store.gemini?.apiKey,
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



  // ─── System Command Router (Ghost Control Integration) ────────────
  /**
   * Intercepts common system commands before sending to AI.
   * Returns a result string if handled, or null if should proceed to AI.
   */
  async function tryHandleSystemCommand(text: string): Promise<string | null> {
    if (!text) return null
    const lower = text.toLowerCase().trim()

    // 1. OPEN APP: "Open Notepad", "Launch Chrome", "Start VSCode"
    const openMatch = lower.match(/^(?:open|launch|start)\s+(.+)$/i)
    if (openMatch) {
      const appName = openMatch[1].trim()
      console.log(`[GhostControl] Opening app: ${appName}`)
      try {
        const result = await startApp(appName)
        return result.message || `Opened ${appName}.`
      } catch (e: any) {
        return `Failed to open ${appName}: ${e.message || e}`
      }
    }

    // 2. CLOSE APP: "Close Chrome", "Kill Notepad"
    const closeMatch = lower.match(/^(?:close|kill|quit|exit)\s+(.+)$/i)
    if (closeMatch) {
      const appName = closeMatch[1].trim()
      console.log(`[GhostControl] Closing app: ${appName}`)
      return new Promise((resolve) => {
        const processName = appName.endsWith('.exe') ? appName : `${appName}.exe`
        if (['explorer.exe', 'dwm.exe', 'svchost.exe', 'lsass.exe', 'csrss.exe', 'wininit.exe', 'winlogon.exe', 'services.exe', 'taskmgr.exe', 'system', 'registry'].includes(processName.toLowerCase())) {
          resolve(`Security Protocol: I cannot close '${appName}' (System Critical Process).`)
          return
        }
        exec(`taskkill /IM "${processName}" /F /T`, (error) => {
          if (error) {
            resolve(`Could not close ${appName}. Is it running?`)
          } else {
            resolve(`Closed ${appName}.`)
          }
        })
      })
    }

    // 3. CREATE/WRITE FILE: "Create file test.txt with content Hello"
    const writeMatch = text.match(/^create file\s+(.+?)\s+with content\s+(.+)$/i) ||
                        text.match(/^write file\s+(.+?)\s+with content\s+(.+)$/i) ||
                        text.match(/^create file\s+(.+)$/i)
    if (writeMatch) {
      const fileName = writeMatch[1].trim()
      const content = writeMatch[2] || ''
      console.log(`[GhostControl] Writing file: ${fileName}`)
      try {
        const isAbsolute = fileName.includes('/') || fileName.includes('\\')
        const targetPath = isAbsolute ? fileName : join(app.getPath('desktop'), fileName)
        fs.writeFileSync(targetPath, content, 'utf-8')
        return `Created file: ${targetPath}`
      } catch (e: any) {
        return `Failed to create file: ${e.message || e}`
      }
    }

    // 4. DELETE FILE: "Delete test.txt", "Remove file test.txt"
    const deleteMatch = lower.match(/^(?:delete|remove)\s+(?:file\s+)?(.+)$/i)
    if (deleteMatch) {
      const fileName = deleteMatch[1].trim()
      console.log(`[GhostControl] Deleting file: ${fileName}`)
      try {
        const isAbsolute = fileName.includes('/') || fileName.includes('\\')
        const targetPath = isAbsolute ? fileName : join(app.getPath('desktop'), fileName)
        fs.unlinkSync(targetPath)
        return `Deleted: ${targetPath}`
      } catch (e: any) {
        return `Failed to delete: ${e.message || e}`
      }
    }

    // 5. READ FILE: "Read file test.txt", "Show contents of test.txt"
    const readMatch = lower.match(/^(?:read|show contents of)\s+(?:file\s+)?(.+)$/i)
    if (readMatch) {
      const fileName = readMatch[1].trim()
      console.log(`[GhostControl] Reading file: ${fileName}`)
      try {
        const isAbsolute = fileName.includes('/') || fileName.includes('\\')
        const targetPath = isAbsolute ? fileName : join(app.getPath('desktop'), fileName)
        const content = fs.readFileSync(targetPath, 'utf-8')
        return content.length > 2000 ? content.slice(0, 2000) + '\n...(Truncated)' : content
      } catch (e: any) {
        return `Failed to read file: ${e.message || e}`
      }
    }

    // 6. LIST RUNNING APPS: "List running apps", "Show running applications"
    if (/^(?:list|show)\s+(?:running\s+)?(?:apps?|applications?|processes?)$/i.test(lower)) {
      console.log('[GhostControl] Listing running apps')
      return new Promise((resolve) => {
        const cmd = `powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty ProcessName"`
        exec(cmd, (err, stdout) => {
          if (err) {
            resolve('Failed to list running applications.')
          } else {
            const apps = [...new Set(stdout.split(/\r?\n/).map((a) => a.trim()).filter((a) => a))]
            resolve(`Running applications:\n${apps.join('\n')}`)
          }
        })
      })
    }

    // 7. RUN SHELL COMMAND: "Run dir", "Execute ls -la"
    const runMatch = lower.match(/^(?:run|execute)\s+(.+)$/i)
    if (runMatch) {
      const command = runMatch[1].trim()
      console.log(`[GhostControl] Running shell command: ${command}`)
      return new Promise((resolve) => {
        exec(command, { timeout: 10000 }, (err, stdout, stderr) => {
          if (err) {
            resolve(`Error: ${stderr || err.message}`)
          } else {
            const output = stdout.trim() || '(No output)'
            resolve(output.length > 1500 ? output.slice(0, 1500) + '\n...(Truncated)' : output)
          }
        })
      })
    }

    // 8. SCREENSHOT: "Take screenshot", "Screenshot"
    if (/^(?:take\s+)?screenshot$/i.test(lower)) {
      console.log('[GhostControl] Taking screenshot')
      try {
        const screenshot = await import('screenshot-desktop')
        const filename = `MJ_Capture_${Date.now()}.png`
        const savePath = join(app.getPath('pictures'), filename)
        await screenshot.default({ filename: savePath })
        return `Screenshot saved to: ${savePath}`
      } catch (e: any) {
        return `Failed to take screenshot: ${e.message || e}`
      }
    }

    return null // Not a system command — proceed to AI
  }

  // Core logic extracted for internal use
export async function handleChatRequest(options: ChatRequestOptions): Promise<string> {
    const { text, images, provider, model } = parseChatRequest(options)

    // ─── Try system command first (Ghost Control) ───
    const systemResult = await tryHandleSystemCommand(text)
    if (systemResult !== null) {
      addMessage('user', text, 'system', undefined)
      addMessage('assistant', systemResult, 'system', undefined)
      return systemResult
    }

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

    if (provider === 'gemini' && keys.gemini) {
      const geminiKey = keys.gemini
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey })
        let contents: any = `You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional. The user says: "${text}"`
        if (images && images.length > 0) {
          const parts: any[] = []
          for (const img of images) {
            const base64Data = img.replace(/^data:image\/\w+;base64,/, '')
            parts.push({ inlineData: { data: base64Data, mimeType: 'image/jpeg' } })
          }
          parts.push({ text: contents })
          contents = parts
        }
        const response = await retryAsync(
          () => ai.models.generateContent({ model: resolveModel('gemini', 'gemini-2.5-flash'), contents }),
          2,
          500
        )
        const result = response.text || ''
        addMessage('assistant', result, 'gemini', resolveModel('gemini', 'gemini-2.5-flash'))
        return result
      } catch (err: unknown) {
        return providerError('Gemini', err)
      }
    }

    if (provider === 'google' && keys.google) {
      const googleKey = keys.google
      try {
        const ai = new GoogleGenAI({ apiKey: googleKey })
        let contents: any = `You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional. The user says: "${text}"`
        if (images && images.length > 0) {
          const parts: any[] = []
          for (const img of images) {
            const base64Data = img.replace(/^data:image\/\w+;base64,/, '')
            parts.push({ inlineData: { data: base64Data, mimeType: 'image/jpeg' } })
          }
          parts.push({ text: contents })
          contents = parts
        }
        const response = await retryAsync(
          () => ai.models.generateContent({ model: resolveModel('google', 'gemini-2.5-flash'), contents }),
          2,
          500
        )
        const result = response.text || ''
        addMessage('assistant', result, 'google', resolveModel('google', 'gemini-2.5-flash'))
        return result
      } catch (err: unknown) {
        return providerError('Google', err)
      }
    }

    if (provider === 'groq' && keys.groq) {
      const groqKey = keys.groq
      try {
        const groq = new Groq({ apiKey: groqKey })
        const completion = await retryAsync(
          () =>
            groq.chat.completions.create({
              messages: [
                { role: 'system', content: 'You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional.' },
                { role: 'user', content: text }
              ],
              model: resolveModel('groq', 'llama3-8b-8192')
            }),
          2,
          500
        )
        const result = completion.choices[0]?.message?.content || ''
        addMessage('assistant', result, 'groq', resolveModel('groq', 'llama3-8b-8192'))
        return result
      } catch (err: unknown) {
        return providerError('Groq', err)
      }
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
      console.log(`[MJ] Auto-routing: primary_agent={provider:${primaryProvider}, model:${primaryModel}}`)

      // Define an execution function for a specific provider
      const tryProvider = async (pName: string, pModel?: string) => {
          if (!keys[pName as keyof ProviderStore]) return null;
          try {
              if (pName === 'gemini' || pName === 'google') {
                  const apiKey = keys[pName as keyof ProviderStore] || keys.gemini;
                  const ai = new GoogleGenAI({ apiKey: apiKey! });
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
          console.log(`[MJ] Trying primary agent: ${primaryProvider} / ${primaryModel || 'default'}`)
          const res = await tryProvider(primaryProvider, primaryModel);
          if (res) {
            console.log(`[MJ] Primary agent succeeded: ${primaryProvider}`)
            addMessage('assistant', res, primaryProvider, primaryModel)
            return res;
          }
      } else {
          console.log('[MJ] No primary_agent configured, skipping to fallbacks')
      }

      // 2. Try Fallbacks
      const fallbackList = ['gemini', 'google', 'openai', 'groq', 'anthropic', 'deepseek'];
      for (const p of fallbackList) {
          if (p === primaryProvider) continue; // Already tried
          const res = await tryProvider(p);
          if (res) {
            console.log(`[MJ] Fallback succeeded: ${p}`)
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
            if (pName === 'gemini' || pName === 'google') {
                const apiKey = keys[pName as keyof ProviderStore] || keys.gemini;
                const ai = new GoogleGenAI({ apiKey: apiKey! });
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
                const fallbackList = ['gemini', 'google', 'openai', 'groq', 'anthropic', 'deepseek'];
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


import fs from 'fs'
import path from 'path'
import { app, safeStorage } from 'electron'

export type ProviderName =
  | 'gemini'
  | 'google'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'grok'
  | 'mistral'
  | 'openrouter'
  | 'xai'
  | 'llama_cpp'
  | 'huggingface'
  | 'nvidia_nim'
  | 'tavily'
  | 'primary_agent'
  | 'brain'
  | 'vision'
  | 'code'

export type ProviderConfig = {
  apiKey?: string
  model?: string
  endpoint?: string
  enabled?: boolean
  provider?: string
}

export type ProviderStore = Record<ProviderName, ProviderConfig>

const PROVIDER_FILE = path.join(app.getPath('userData'), 'mj_provider_config.json')

const DEFAULT_PROVIDERS: ProviderStore = {
  gemini: { enabled: true, model: 'gemini-2.5-flash' },
  google: { enabled: true, model: 'gemini-2.5-flash' },
  groq: { enabled: true, model: 'llama3-8b-8192' },
  openai: { enabled: true, model: 'gpt-4' },
  anthropic: { enabled: true, model: 'claude-3-sonnet-20240229' },
  deepseek: { enabled: false, model: 'default' },
  grok: { enabled: false, model: 'default' },
  mistral: { enabled: false, model: 'default' },
  openrouter: { enabled: false, model: 'default' },
  xai: { enabled: false, model: 'default' },
  llama_cpp: { enabled: false, model: 'default' },
  huggingface: { enabled: false, model: 'default' },
  nvidia_nim: { enabled: false, model: 'default' },
  tavily: { enabled: false, model: 'default' },
  primary_agent: { provider: 'groq', model: 'llama3-8b-8192' },
  brain: { provider: 'groq' },
  vision: { provider: 'gemini' },
  code: { provider: 'openai' }
}

export function getProviderConfigPath() {
  return PROVIDER_FILE
}

function decryptProviderConfig(config: ProviderStore): ProviderStore {
  const result: ProviderStore = { ...DEFAULT_PROVIDERS }

  for (const provider of Object.keys(config) as ProviderName[]) {
    const value = config[provider]
    if (!value) continue

    result[provider] = { ...result[provider], ...value }
    if (value.apiKey) {
      try {
        result[provider].apiKey = decryptKey(value.apiKey)
      } catch (err) {
        result[provider].apiKey = value.apiKey
      }
    }
  }

  return result
}

function encryptProviderConfig(config: ProviderStore): ProviderStore {
  const result: ProviderStore = { ...DEFAULT_PROVIDERS }

  for (const provider of Object.keys(config) as ProviderName[]) {
    const value = config[provider]
    if (!value) continue

    result[provider] = { ...result[provider], ...value }
    if (value.apiKey) {
      try {
        result[provider].apiKey = encryptKey(value.apiKey)
      } catch (err) {
        result[provider].apiKey = Buffer.from(value.apiKey).toString('base64')
      }
    }
  }

  return result
}

export function loadProviderConfig(): ProviderStore {
  try {
    if (!fs.existsSync(PROVIDER_FILE)) {
      saveProviderConfig(DEFAULT_PROVIDERS)
      return DEFAULT_PROVIDERS
    }

    const raw = fs.readFileSync(PROVIDER_FILE, 'utf8')
    const data = JSON.parse(raw) as ProviderStore
    return decryptProviderConfig({ ...DEFAULT_PROVIDERS, ...data })
  } catch (err) {
    console.error('[MJ] Failed to load provider config:', err)
    return DEFAULT_PROVIDERS
  }
}

export function saveProviderConfig(config: ProviderStore) {
  try {
    const encrypted = encryptProviderConfig({ ...DEFAULT_PROVIDERS, ...config })
    fs.writeFileSync(PROVIDER_FILE, JSON.stringify(encrypted, null, 2), 'utf8')
    return true
  } catch (err) {
    console.error('[MJ] Failed to save provider config:', err)
    return false
  }
}

export function encryptKey(key: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(key).toString('base64')
  }
  return Buffer.from(key).toString('base64')
}

export function decryptKey(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(value, 'base64'))
  }
  return Buffer.from(value, 'base64').toString('utf8')

}

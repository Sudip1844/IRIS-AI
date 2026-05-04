import fs from 'fs'
import path from 'path'
import { app, safeStorage } from 'electron'
import {
  loadProviderConfig,
  saveProviderConfig,
  encryptKey,
  decryptKey,
  ProviderStore
} from '../provider-registry'

// Mock Electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/userData')
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((str: string) => Buffer.from(str + '_encrypted')),
    decryptString: jest.fn((buf: Buffer) => buf.toString().replace('_encrypted', ''))
  }
}))

// Mock fs module
jest.mock('fs')

describe('provider-registry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('loadProviderConfig', () => {
    it('should load and decrypt provider config from file', () => {
      const mockConfig: ProviderStore = {
        openai: { apiKey: 'key_encrypted', model: 'gpt-4', enabled: true },
        anthropic: { apiKey: 'claude_encrypted', model: 'claude-3', enabled: true },
        groq: { enabled: false },
        gemini: { enabled: false },
        deepseek: { enabled: false },
        grok: { enabled: false },
        mistral: { enabled: false },
        openrouter: { enabled: false },
        xai: { enabled: false },
        llama_cpp: { enabled: false },
        huggingface: { enabled: false },
        nvidia_nim: { enabled: false },
        tavily: { enabled: false }
      }

      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig))

      const config = loadProviderConfig()
      expect(config.openai?.apiKey).toBeDefined()
      expect(safeStorage.decryptString).toHaveBeenCalled()
    })

    it('should return default config if file does not exist', () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      ;(fs.writeFileSync as jest.Mock).mockImplementation(() => {})

      const config = loadProviderConfig()
      expect(config).toHaveProperty('openai')
      expect(config).toHaveProperty('anthropic')
      expect(config.openai?.enabled).toBe(true)
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should handle JSON parse errors gracefully', () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.readFileSync as jest.Mock).mockReturnValue('invalid json')

      const config = loadProviderConfig()
      expect(config).toHaveProperty('openai')
      expect(config.openai?.enabled).toBe(true)
    })

    it('should merge loaded config with defaults', () => {
      const partialConfig = {
        openai: { apiKey: 'key_encrypted', model: 'gpt-4' }
      }

      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(partialConfig))

      const config = loadProviderConfig()
      expect(config.openai?.model).toBe('gpt-4')
      expect(config.anthropic).toBeDefined()
    })
  })

  describe('saveProviderConfig', () => {
    it('should save and encrypt provider config', () => {
      const config: ProviderStore = {
        openai: { apiKey: 'test-key', model: 'gpt-4', enabled: true },
        anthropic: { enabled: true },
        groq: { enabled: false },
        gemini: { enabled: false },
        deepseek: { enabled: false },
        grok: { enabled: false },
        mistral: { enabled: false },
        openrouter: { enabled: false },
        xai: { enabled: false },
        llama_cpp: { enabled: false },
        huggingface: { enabled: false },
        nvidia_nim: { enabled: false },
        tavily: { enabled: false }
      }

      ;(fs.writeFileSync as jest.Mock).mockImplementation(() => {})

      const result = saveProviderConfig(config)
      expect(result).toBe(true)
      expect(fs.writeFileSync).toHaveBeenCalled()

      const savedData = (fs.writeFileSync as jest.Mock).mock.calls[0]
      expect(savedData[2]).toBe('utf8')
    })

    it('should handle write errors gracefully', () => {
      ;(fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Write failed')
      })

      const config: ProviderStore = {
        openai: { enabled: true },
        anthropic: { enabled: true },
        groq: { enabled: false },
        gemini: { enabled: false },
        deepseek: { enabled: false },
        grok: { enabled: false },
        mistral: { enabled: false },
        openrouter: { enabled: false },
        xai: { enabled: false },
        llama_cpp: { enabled: false },
        huggingface: { enabled: false },
        nvidia_nim: { enabled: false },
        tavily: { enabled: false }
      }

      const result = saveProviderConfig(config)
      expect(result).toBe(false)
    })
  })

  describe('encryptKey / decryptKey', () => {
    it('should encrypt key using safeStorage', () => {
      const key = 'test-api-key'
      const encrypted = encryptKey(key)
      expect(safeStorage.encryptString).toHaveBeenCalledWith(key)
    })

    it('should decrypt key using safeStorage', () => {
      const encrypted = Buffer.from('test_encrypted')
      const decrypted = decryptKey(encrypted.toString('base64'))
      expect(safeStorage.decryptString).toHaveBeenCalled()
      expect(decrypted).toBe('test')
    })

    it('should fallback to base64 if encryption unavailable', () => {
      ;(safeStorage.isEncryptionAvailable as jest.Mock).mockReturnValue(false)

      const key = 'test-key'
      const encrypted = encryptKey(key)
      expect(encrypted).toBe(Buffer.from(key).toString('base64'))

      const decrypted = decryptKey(encrypted)
      expect(decrypted).toBe(key)
    })
  })

  describe('provider config lifecycle', () => {
    it('should load, modify, and save config', () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      ;(fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          openai: { apiKey: 'key_encrypted', model: 'gpt-4', enabled: true }
        })
      )
      ;(fs.writeFileSync as jest.Mock).mockImplementation(() => {})

      let config = loadProviderConfig()
      expect(config.openai?.model).toBe('gpt-4')

      config.openai = {
        ...config.openai,
        model: 'gpt-4-turbo',
        apiKey: 'new-key'
      }

      const saved = saveProviderConfig(config)
      expect(saved).toBe(true)
      expect(fs.writeFileSync).toHaveBeenCalled()
    })
  })
})

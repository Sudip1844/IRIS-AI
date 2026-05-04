// Setup file for Jest tests
// Mock Electron API globally
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/userData')
  },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((str: string) => Buffer.from(str + '_encrypted')),
    decryptString: jest.fn((buf: Buffer) => buf.toString().replace('_encrypted', ''))
  },
  ipcMain: {
    handle: jest.fn()
  },
  session: {
    defaultSession: {
      webRequest: {
        onHeadersReceived: jest.fn()
      }
    }
  },
  BrowserWindow: jest.fn()
}))

jest.mock('fs')

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn()
}

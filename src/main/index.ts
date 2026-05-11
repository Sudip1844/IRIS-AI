import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  // Removed: globalShortcut no longer used
  // globalShortcut,
  screen,
  session,
  safeStorage,
  // Removed: Tray and Menu no longer used
  // Tray,
  // Menu,
  nativeImage
} from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// ─── Consolidated Domain Services (Priority 4 Refactor) ───────────
import registerFSServices from './services/fs-service'
import registerSystemServices from './services/system-service'
import registerDeviceServices from './services/device-service'
import registerIntegrationServices from './services/integrations-service'
import registerHackerServices from './services/hacker-service'

// ─── Standalone logic modules (not yet consolidated) ──────────────
import registerWebAgent from './logic/web-agent'
import registerAlertsHandlers from './logic/alerts-manager'
import registerPrivacyHandlers from './logic/privacy-manager'
import registerPermanentMemory from './logic/permanent-memory'
import registerBiometricHandlers from './logic/biometric-manager'
import registerStocksManager from './logic/stocks-manager'
import registerGalleryManager from './logic/gallery-manager'
import registerNotesManager from './logic/notes-manager'

// ─── Ghost Control & Computer Control ─────────────────────────────
import registerGhostControl from './logic/ghost-control'
import registerAppLauncher from './logic/app-launcher'
import registerFileOps from './logic/file-ops'
import registerFileWrite from './logic/file-write'
import registerFileRead from './logic/file-read'
import registerFileOpen from './logic/file-open'
import registerFileScanner from './logic/file-launcher'
import registerSystemControl from './logic/terminal-control'

// ─── Internal services ────────────────────────────────────────────
import registerIrisCoder from './services/mj-coder'
import registerWormhole from './services/wormhole'
import registerOracle from './services/RAG-oracle'
import registerDeepResearch from './services/deep-research'
import registerChatHandler from './services/chat-handler'

// ─── Automation & Agents ──────────────────────────────────────────
import registerWidgetMaker from './auto/widget-manager'
import registerWebsiteBuilder from './auto/website-builder'
import registerWorkflowManager from './workflow/workflow-manager'
import registerAgentOrchestrator from './agents/agent-orchestrator'
import registerSkillLibrary from './agents/skill-library'
import registerVisionEngine from './agents/vision-engine'
import registerSemanticMemory from './agents/semantic-memory'
import registerAgentDebate from './agents/agent-debate'
import registerAgentGraph from './agents/agent-graph'

// ─── Handlers & Security ──────────────────────────────────────────
import registerDropZoneControl from './handlers/SmartDropZone-Handler'
import registerScreenPeeler from './handlers/ScreenPeeler-handler'
import registerPhantomKeyboard from './handlers/PhantomControl-handler'
import registerSecurityVault from './security/Security'
import registerLockSystem from './security/lock-system'
import { listQuarantined, restoreFile, deleteQuarantined } from './security/quarantine-manager'
import {
  getProviderConfigPath,
  loadProviderConfig,
  saveProviderConfig,
  encryptKey,
  decryptKey,
  ProviderStore
} from './services/providers/provider-registry'
import { autoUpdater } from 'electron-updater'

app.commandLine.appendSwitch('use-fake-ui-for-media-stream')

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('mj', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('mj')
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let quickChatWindow: BrowserWindow | null = null
// Removed: tray no longer used
// let tray: Tray | null = null
let isOverlayMode = false
let isQuiting = false

const secureConfigPath = join(app.getPath('userData'), 'mj_secure_vault.json')

// ── UI Mode ──────────────────────────────────────────────────────────
// Set to true to use the custom MJ Control Center static UI.
// Set to false to use the original React/Tailwind renderer.
const USE_CUSTOM_UI = true

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    fullscreen: false,
    autoHideMenuBar: true,
    frame: true,
    icon: nativeImage.createFromPath(icon),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) mainWindow.show()
  })

  // ── Window Close Handling ─────────────────────────────────────────────
  // On close button (X), just close the window. App only quits via STOP MJ button.
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  ipcMain.on('window-min', () => mainWindow?.minimize())
  ipcMain.on('window-close', () => {
    if (mainWindow) {
      mainWindow.close()
    }
  })
  ipcMain.on('window-max', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (USE_CUSTOM_UI) {
    // Load the MJ Control Center static UI
    const staticUIPath = join(app.getAppPath(), 'static ui', 'index.html')
    mainWindow.loadFile(staticUIPath)
  } else if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.on('second-instance', (event, commandLine) => {
  if (!event) return

  // If mainWindow was closed, recreate it
  if (!mainWindow) {
    createWindow()
    // Wait for window to be ready
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.focus()
      }
    }, 500)
  } else {
    // Restore existing window
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  }

  // Handle OAuth callbacks
  const url = commandLine.find((arg) => arg.startsWith('mj://'))
  if (url && mainWindow) {
    mainWindow.webContents.send('oauth-callback', url)
  }
})

function toggleOverlayMode(): void {
  if (!mainWindow) return

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  if (isOverlayMode) {
    mainWindow.setResizable(true)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setBounds({ width: 950, height: 670 })
    mainWindow.center()
    mainWindow.webContents.send('overlay-mode', false)
  } else {
    const w = 340
    const h = 70
    mainWindow.setBounds({
      width: w,
      height: h,
      x: Math.floor(width / 2 - w / 2),
      y: height - h - 50
    })
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setResizable(false)
    mainWindow.webContents.send('overlay-mode', true)
  }
  isOverlayMode = !isOverlayMode
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  autoUpdater.checkForUpdatesAndNotify()

  // Auto-migrate legacy vault keys to Provider Registry
  try {
    const { loadProviderConfig, saveProviderConfig } = require('./services/providers/provider-registry')
    const pStore = loadProviderConfig()
    if (fs.existsSync(secureConfigPath) && !pStore.gemini?.apiKey && !pStore.openai?.apiKey) {
      const data = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
      let keys: any = {}
      if (safeStorage.isEncryptionAvailable()) {
        if (data.gemini) keys.gemini = safeStorage.decryptString(Buffer.from(data.gemini, 'base64'))
        if (data.openai) keys.openai = safeStorage.decryptString(Buffer.from(data.openai, 'base64'))
        if (data.anthropic) keys.anthropic = safeStorage.decryptString(Buffer.from(data.anthropic, 'base64'))
        if (data.groq) {
          const rawGroq = safeStorage.decryptString(Buffer.from(data.groq, 'base64'))
          if (rawGroq.startsWith('{')) keys.groq = JSON.parse(rawGroq).brain?.groqKey
          else keys.groq = rawGroq
        }
      } else {
        if (data.gemini) keys.gemini = Buffer.from(data.gemini, 'base64').toString('utf8')
        if (data.openai) keys.openai = Buffer.from(data.openai, 'base64').toString('utf8')
        if (data.anthropic) keys.anthropic = Buffer.from(data.anthropic, 'base64').toString('utf8')
        if (data.groq) {
          const rawGroq = Buffer.from(data.groq, 'base64').toString('utf8')
          if (rawGroq.startsWith('{')) keys.groq = JSON.parse(rawGroq).brain?.groqKey
          else keys.groq = rawGroq
        }
      }
      if (keys.gemini) pStore.gemini = { ...pStore.gemini, apiKey: keys.gemini }
      if (keys.openai) pStore.openai = { ...pStore.openai, apiKey: keys.openai }
      if (keys.anthropic) pStore.anthropic = { ...pStore.anthropic, apiKey: keys.anthropic }
      if (keys.groq) pStore.groq = { ...pStore.groq, apiKey: keys.groq }
      saveProviderConfig(pStore)
      console.log('[MJ] Successfully migrated legacy keys to Provider Registry.')
    }
  } catch (e) {
    console.error('[MJ] Legacy vault migration failed:', e)
  }

  // Auto-Updater Events
  autoUpdater.on('update-available', () => {
    if (mainWindow) mainWindow.webContents.send('updater-event', { type: 'available' })
  })
  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('updater-event', { type: 'not-available' })
  })
  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow)
      mainWindow.webContents.send('updater-event', {
        type: 'progress',
        progress: progressObj.percent
      })
  })
  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.webContents.send('updater-event', { type: 'downloaded' })
  })

  registerChatHandler()

  ipcMain.handle('secure-save-keys', async (_, payload: any) => {
    try {
      const { groqKey, geminiKey, openaiKey, anthropicKey } = payload

      // Sync AI Keys to the new Provider Registry
      const { loadProviderConfig, saveProviderConfig } = require('./services/providers/provider-registry')
      const pStore = loadProviderConfig()
      if (geminiKey) pStore.gemini = { ...pStore.gemini, apiKey: geminiKey }
      if (openaiKey) pStore.openai = { ...pStore.openai, apiKey: openaiKey }
      if (anthropicKey) pStore.anthropic = { ...pStore.anthropic, apiKey: anthropicKey }
      
      // Auto-extract Groq key if frontend dumped the entire config JSON into groqKey
      try {
        if (groqKey && groqKey.startsWith('{')) {
          const parsed = JSON.parse(groqKey)
          if (parsed.brain?.groqKey) pStore.groq = { ...pStore.groq, apiKey: parsed.brain.groqKey }
        } else if (groqKey) {
          pStore.groq = { ...pStore.groq, apiKey: groqKey }
        }
      } catch (e) {}
      saveProviderConfig(pStore)

      let encrypted: any = {}

      if (safeStorage.isEncryptionAvailable()) {
        if (groqKey) encrypted.groq = safeStorage.encryptString(groqKey).toString('base64')
        if (geminiKey) encrypted.gemini = safeStorage.encryptString(geminiKey).toString('base64')
        if (openaiKey) encrypted.openai = safeStorage.encryptString(openaiKey).toString('base64')
        if (anthropicKey)
          encrypted.anthropic = safeStorage.encryptString(anthropicKey).toString('base64')
      } else {
        if (groqKey) encrypted.groq = Buffer.from(groqKey).toString('base64')
        if (geminiKey) encrypted.gemini = Buffer.from(geminiKey).toString('base64')
        if (openaiKey) encrypted.openai = Buffer.from(openaiKey).toString('base64')
        if (anthropicKey) encrypted.anthropic = Buffer.from(anthropicKey).toString('base64')
      }

      // Preserve existing keys that weren't updated
      if (fs.existsSync(secureConfigPath)) {
        const existing = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
        encrypted = { ...existing, ...encrypted }
      }

      fs.writeFileSync(secureConfigPath, JSON.stringify(encrypted))
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('secure-get-keys', async () => {
    if (!fs.existsSync(secureConfigPath)) return null
    try {
      const data = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
      let keys: any = {}

      if (safeStorage.isEncryptionAvailable()) {
        if (data.groq) keys.groqKey = safeStorage.decryptString(Buffer.from(data.groq, 'base64'))
        if (data.gemini)
          keys.geminiKey = safeStorage.decryptString(Buffer.from(data.gemini, 'base64'))
        if (data.openai)
          keys.openaiKey = safeStorage.decryptString(Buffer.from(data.openai, 'base64'))
        if (data.anthropic)
          keys.anthropicKey = safeStorage.decryptString(Buffer.from(data.anthropic, 'base64'))
      } else {
        if (data.groq) keys.groqKey = Buffer.from(data.groq, 'base64').toString('utf8')
        if (data.gemini) keys.geminiKey = Buffer.from(data.gemini, 'base64').toString('utf8')
        if (data.openai) keys.openaiKey = Buffer.from(data.openai, 'base64').toString('utf8')
        if (data.anthropic)
          keys.anthropicKey = Buffer.from(data.anthropic, 'base64').toString('utf8')
      }

      return keys
    } catch (_err) {
      return null
    }
  })

  ipcMain.handle('check-keys-exist', () => {
    return fs.existsSync(secureConfigPath)
  })

  ipcMain.handle('provider-save-config', async (_, config: ProviderStore) => {
    try {
      return saveProviderConfig(config)
    } catch (error: unknown) {
      console.error('[MJ] provider-save-config failed', error)
      return false
    }
  })

  ipcMain.handle('provider-load-config', async () => {
    try {
      return loadProviderConfig()
    } catch (error: unknown) {
      console.error('[MJ] provider-load-config failed', error)
      return null
    }
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    delete responseHeaders['content-security-policy']
    delete responseHeaders['x-content-security-policy']
    delete responseHeaders['access-control-allow-origin']

    callback({
      responseHeaders,
      statusLine: details.statusLine
    })
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (mainWindow && url.startsWith('iris://')) {
      mainWindow.webContents.send('oauth-callback', url)
    }
  })

  registerLockSystem()
  registerSecurityVault()
  registerPhantomKeyboard()
  registerScreenPeeler()
  registerDropZoneControl(ipcMain)
  registerWorkflowManager()
  registerAgentOrchestrator()
  registerSkillLibrary()
  registerVisionEngine()
  registerSemanticMemory()
  registerAgentDebate()
  registerAgentGraph()
  registerWebsiteBuilder()
  registerWidgetMaker()
  registerDeepResearch({ ipcMain })
  registerOracle({ ipcMain })
  registerWormhole({ ipcMain })
  registerPermanentMemory({ ipcMain, app })
  registerIrisCoder({ ipcMain, app })

  // ─── Consolidated Domain Services (Priority 4) ──────────────
  registerFSServices(ipcMain)
  registerSystemServices(ipcMain)
  registerDeviceServices(ipcMain)
  registerIntegrationServices(ipcMain)
  registerHackerServices(ipcMain)

  // ─── Standalone logic modules ───────────────────────────────
  registerWebAgent(ipcMain)
  registerAlertsHandlers(ipcMain)
  registerPrivacyHandlers(ipcMain)
  registerBiometricHandlers(ipcMain)
  registerStocksManager(ipcMain)
  registerGalleryManager(ipcMain)
  registerNotesManager(ipcMain)

  // ─── Ghost Control & Computer Control ───────────────────────
  registerGhostControl(ipcMain)
  registerAppLauncher(ipcMain)
  registerFileOps(ipcMain)
  registerFileWrite(ipcMain)
  registerFileRead(ipcMain)
  registerFileOpen(ipcMain)
  registerFileScanner(ipcMain)
  registerSystemControl(ipcMain)

  ipcMain.handle('get-screen-source', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources[0]?.id
  })

  // ── Quarantine IPC Handlers ────────────────────────────────────────
  ipcMain.handle('quarantine-list', async () => {
    return listQuarantined()
  })

  ipcMain.handle('quarantine-restore', async (_, id: string) => {
    return restoreFile(id)
  })

  ipcMain.handle('quarantine-delete', async (_, id: string) => {
    return deleteQuarantined(id)
  })

  createWindow()



  // ── Quit App IPC (from Stop MJ button when user really wants to quit) ──
  ipcMain.handle('quit-app', () => {
    isQuiting = true
    if (quickChatWindow) quickChatWindow.destroy()
    app.quit()
  })



  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  // Cleanup logic here
})

app.on('window-all-closed', () => {
  app.quit()
})

// ── Quick Chat Window ────────────────────────────────────────────────
function createQuickChatWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  quickChatWindow = new BrowserWindow({
    width: 400,
    height: 520,
    x: width - 420,
    y: height - 540,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const quickChatPath = join(app.getAppPath(), 'static ui', 'quick-chat.html')
  quickChatWindow.loadFile(quickChatPath)

  quickChatWindow.on('closed', () => {
    quickChatWindow = null
  })

  quickChatWindow.on('blur', () => {
    quickChatWindow?.hide()
  })
}

function toggleQuickChat(): void {
  if (!quickChatWindow || quickChatWindow.isDestroyed()) {
    createQuickChatWindow()
    quickChatWindow?.once('ready-to-show', () => {
      quickChatWindow?.show()
      quickChatWindow?.focus()
    })
  } else if (quickChatWindow.isVisible()) {
    quickChatWindow.hide()
  } else {
    quickChatWindow.show()
    quickChatWindow.focus()
  }
}

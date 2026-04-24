import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  globalShortcut,
  screen,
  session,
  safeStorage,
  Tray,
  Menu,
  nativeImage
} from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import registerIpcHandlers from './logic/mj-memory-save'
import registerSystemHandlers from './logic/get-system-info'
import registerFileSearch from './logic/file-search'
import registerFileOps from './logic/file-ops'
import registerFileWrite from './logic/file-write'
import registerFileRead from './logic/file-read'
import registerFileOpen from './logic/file-open'
import registerDirLoader from './logic/dir-load'
import registerFileScanner from './logic/file-launcher'
import registerAppLauncher from './logic/app-launcher'
import registerNotesHandlers from './logic/notes-manager'
import registerWebAgent from './logic/web-agent'
import registerGhostControl from './logic/ghost-control'
import registerterminalControl from './logic/terminal-control'
import registerGalleryHandlers from './logic/gallery-manager'
import registerGmailHandlers from './logic/gmail-manager'
import registerLocationHandlers from './logic/live-location'
import registerAdbHandlers from './logic/adb-manager'
import registerBiometricHandlers from './logic/biometric-manager'
import registerStocksHandlers from './logic/stocks-manager'
import registerAlertsHandlers from './logic/alerts-manager'
import registerPrivacyHandlers from './logic/privacy-manager'
import registerAppsHandlers from './logic/apps-manager'
import registerRealityHacker from './logic/reality-hacker'
import registerIrisCoder from './services/mj-coder'
import registerTelekinesis from './logic/telekinesis'
import registerPermanentMemory from './logic/permanent-memory'
import registerWormhole from './services/wormhole'
import registerOracle from './services/RAG-oracle'
import registerDeepResearch from './services/deep-research'
import registerWidgetMaker from './auto/widget-manager'
import registerWebsiteBuilder from './auto/website-builder'
import registerWorkflowManager from './workflow/workflow-manager'
import registerDropZoneControl from './handlers/SmartDropZone-Handler'
import registerScreenPeeler from './handlers/ScreenPeeler-handler'
import registerPhantomKeyboard from './handlers/PhantomControl-handler'
import registerSecurityVault from './security/Security'
import registerLockSystem from './security/lock-system'
import { listQuarantined, restoreFile, deleteQuarantined } from './security/quarantine-manager'
import registerChatHandler from './services/chat-handler'
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
let tray: Tray | null = null
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
      webSecurity: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) mainWindow.show()
  })

  // ── Close to Tray (background running) ─────────────────────────────
  mainWindow.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  ipcMain.on('window-min', () => mainWindow?.minimize())
  ipcMain.on('window-close', () => mainWindow?.hide())
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
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
    const url = commandLine.find((arg) => arg.startsWith('mj://'))
    if (url) {
      mainWindow.webContents.send('oauth-callback', url)
    }
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
  registerChatHandler()

  ipcMain.handle('secure-save-keys', async (_, { groqKey, geminiKey }) => {
    try {
      let groqEncrypted, geminiEncrypted

      if (safeStorage.isEncryptionAvailable()) {
        groqEncrypted = safeStorage.encryptString(groqKey).toString('base64')
        geminiEncrypted = safeStorage.encryptString(geminiKey).toString('base64')
      } else {
        groqEncrypted = Buffer.from(groqKey).toString('base64')
        geminiEncrypted = Buffer.from(geminiKey).toString('base64')
      }

      const secureData = {
        groq: groqEncrypted,
        gemini: geminiEncrypted
      }

      fs.writeFileSync(secureConfigPath, JSON.stringify(secureData))
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('secure-get-keys', async () => {
    if (!fs.existsSync(secureConfigPath)) return null
    try {
      const data = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
      let groqKey, geminiKey

      if (safeStorage.isEncryptionAvailable()) {
        groqKey = safeStorage.decryptString(Buffer.from(data.groq, 'base64'))
        geminiKey = safeStorage.decryptString(Buffer.from(data.gemini, 'base64'))
      } else {
        groqKey = Buffer.from(data.groq, 'base64').toString('utf8')
        geminiKey = Buffer.from(data.gemini, 'base64').toString('utf8')
      }

      return { groqKey, geminiKey }
    } catch (_err) {
      return null
    }
  })

  ipcMain.handle('check-keys-exist', () => {
    return fs.existsSync(secureConfigPath)
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
  registerWebsiteBuilder()
  registerWidgetMaker()
  registerDeepResearch({ ipcMain })
  registerOracle({ ipcMain })
  registerWormhole({ ipcMain })
  registerPermanentMemory({ ipcMain, app })
  registerTelekinesis({ ipcMain })
  registerIrisCoder({ ipcMain, app })
  registerRealityHacker(ipcMain)
  registerAdbHandlers(ipcMain)
  registerLocationHandlers(ipcMain)
  registerGmailHandlers(ipcMain)
  registerGalleryHandlers(ipcMain)
  registerterminalControl(ipcMain)
  registerGhostControl(ipcMain)
  registerWebAgent(ipcMain)
  registerNotesHandlers(ipcMain)
  registerAppLauncher(ipcMain)
  registerDirLoader(ipcMain)
  registerFileOpen(ipcMain)
  registerFileSearch(ipcMain)
  registerFileRead(ipcMain)
  registerFileWrite(ipcMain)
  registerFileOps(ipcMain)
  registerFileScanner(ipcMain)
  registerSystemHandlers(ipcMain)
  registerBiometricHandlers(ipcMain)
  registerStocksHandlers(ipcMain)
  registerAlertsHandlers(ipcMain)
  registerPrivacyHandlers(ipcMain)
  registerAppsHandlers(ipcMain)
  registerIpcHandlers({ ipcMain, app })

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

  // ── System Tray ────────────────────────────────────────────────────
  const trayIconPath = join(app.getAppPath(), 'resources', 'icon.png')
  const trayNativeImage = nativeImage.createFromPath(trayIconPath).resize({ width: 20, height: 20 })
  tray = new Tray(trayNativeImage)
  tray.setToolTip('MJ Assistant')

  const trayMenu = Menu.buildFromTemplate([
    {
      label: 'Open MJ Control Center',
      click: (): void => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    {
      label: 'Quick Chat',
      click: (): void => toggleQuickChat()
    },
    { type: 'separator' },
    {
      label: 'Quit MJ',
      click: (): void => {
        isQuiting = true
        if (quickChatWindow) quickChatWindow.destroy()
        app.quit()
      }
    }
  ])
  tray.setContextMenu(trayMenu)
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  // ── Quit App IPC (from Stop MJ button when user really wants to quit) ──
  ipcMain.handle('quit-app', () => {
    isQuiting = true
    if (quickChatWindow) quickChatWindow.destroy()
    app.quit()
  })

  // ── Global Shortcuts ───────────────────────────────────────────────
  globalShortcut.register('CommandOrControl+Shift+I', () => toggleOverlayMode())
  ipcMain.on('toggle-overlay', () => toggleOverlayMode())

  // Alt+Space → Toggle Mic (sends IPC to renderer)
  globalShortcut.register('Alt+Space', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.webContents.send('toggle-mic')
    }
  })

  // Ctrl+Shift+M → Toggle Quick Chat
  globalShortcut.register('CommandOrControl+Shift+M', () => toggleQuickChat())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Do NOT quit — let tray keep running
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

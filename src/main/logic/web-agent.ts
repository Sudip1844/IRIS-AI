/**
 * Web Agent — Upgraded to use BrowserEngine singleton
 *
 * Replaces one-shot Puppeteer launches with persistent browser control.
 * Now supports: navigate, click, fill, snapshot, text extraction,
 * screenshot, multi-tab, and profile management.
 */

import { IpcMain, shell } from 'electron'
import BrowserEngine from './browser-engine'
import * as BrowserProfiles from './browser-profiles'

const USER_BOOKMARKS: Record<string, string> = {
  instagram: 'https://instagram.com',
  reddit: 'https://reddit.com',
  chatgpt: 'https://chat.openai.com',
  claude: 'https://claude.ai',
  linkedin: 'https://linkedin.com'
}

const getSmartUrl = (
  query: string
): { url: string; source: string; skipScrape: boolean } | null => {
  const lower = query.toLowerCase()

  for (const [key, url] of Object.entries(USER_BOOKMARKS)) {
    if (lower.includes(key)) {
      return { url, source: 'Bookmark', skipScrape: false }
    }
  }

  if (lower.includes('amazon') || lower.includes('buy') || lower.includes('shop for')) {
    const term = lower.replace(/(amazon|buy|price of|shop for)/g, '').trim()
    return {
      url: `https://www.amazon.in/s?k=${encodeURIComponent(term)}`,
      source: 'Amazon',
      skipScrape: true
    }
  }

  if (lower.includes('github') || lower.includes('repo')) {
    const match = lower.match(/github(?: profile)?(?: of)?\s+(\w+)/)
    const term = match ? match[1] : lower.replace('github', '').trim()
    return {
      url: `https://github.com/${term}`,
      source: 'GitHub',
      skipScrape: false
    }
  }

  if (lower.includes('youtube') || lower.includes('watch')) {
    const term = lower.replace(/(youtube|watch)/g, '').trim()
    return {
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`,
      source: 'YouTube',
      skipScrape: true
    }
  }

  if (lower.startsWith('open ') || lower.startsWith('go to ')) {
    const term = lower.replace(/^(open|go to)( the)?\s+/, '').trim()
    if (!term.includes('who') && !term.includes('what') && !term.includes('how')) {
      return {
        url: `https://duckduckgo.com/?q=!ducky+${encodeURIComponent(term)}`,
        source: 'Smart Redirect',
        skipScrape: false
      }
    }
  }

  return null
}

export default function registerWebAgent(ipcMain: IpcMain) {
  const engine = BrowserEngine.getInstance()

  // ─── Legacy handler (kept for backward compat) ───
  ipcMain.handle('google-search', async (_event, query: string) => {
    try {
      const smartRoute = getSmartUrl(query)
      const finalUrl = smartRoute
        ? smartRoute.url
        : `https://www.google.com/search?q=${encodeURIComponent(query)}`

      // Always open in system browser for the user to see
      shell.openExternal(finalUrl)

      if (smartRoute && smartRoute.skipScrape) {
        return `I've opened ${smartRoute.source} for you.`
      }

      // Use BrowserEngine for scraping instead of spawning new Chromium
      try {
        await engine.init({ headless: true })
        await engine.navigate(finalUrl)
        const text = await engine.extractText()

        if (text && text.length > 50) {
          return `I've opened the link. Here is a quick summary:\n${text.substring(0, 500)}...`
        }
      } catch (e) {
        console.log('[WebAgent] BrowserEngine scrape failed, but system browser opened:', e)
      }

      return "I've opened the website for you."
    } catch (error: any) {
      return "I opened the browser, but couldn't read the content."
    }
  })

  // ─── New BrowserEngine IPC handlers ───

  ipcMain.handle(
    'browser-init',
    async (_, options?: { headless?: boolean; profileName?: string }) => {
      try {
        await engine.init(options)
        return { success: true, running: engine.isRunning() }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  ipcMain.handle('browser-navigate', async (_, { url, newTab }: { url: string; newTab?: boolean }) => {
    try {
      await engine.init({ headless: true })
      const result = await engine.navigate(url, { newTab })
      return { success: true, ...result }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('browser-snapshot', async (_, options?: { filter?: 'interactive' | 'all' }) => {
    try {
      const snapshot = await engine.snapshot(options)
      return { success: true, ...snapshot }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('browser-click', async (_, ref: string) => {
    try {
      return await engine.click(ref)
    } catch (e: any) {
      return { success: false, message: e.message }
    }
  })

  ipcMain.handle('browser-fill', async (_, { ref, value }: { ref: string; value: string }) => {
    try {
      return await engine.fill(ref, value)
    } catch (e: any) {
      return { success: false, message: e.message }
    }
  })

  ipcMain.handle('browser-press', async (_, { ref, key }: { ref: string | null; key: string }) => {
    try {
      return await engine.press(ref, key)
    } catch (e: any) {
      return { success: false, message: e.message }
    }
  })

  ipcMain.handle('browser-text', async () => {
    try {
      const text = await engine.extractText()
      return { success: true, text }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('browser-screenshot', async (_, options?: { fullPage?: boolean }) => {
    try {
      const base64 = await engine.screenshot(options)
      return { success: true, image: base64 }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('browser-tabs', async () => {
    try {
      const tabs = await engine.listTabs()
      return { success: true, tabs }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('browser-switch-tab', async (_, tabId: string) => {
    return { success: await engine.switchTab(tabId) }
  })

  ipcMain.handle('browser-close-tab', async (_, tabId: string) => {
    return { success: await engine.closeTab(tabId) }
  })

  ipcMain.handle('browser-close', async () => {
    await engine.close()
    return { success: true }
  })

  ipcMain.handle('browser-status', async () => {
    return {
      running: engine.isRunning(),
      tabs: engine.isRunning() ? await engine.listTabs() : []
    }
  })

  // ─── Profile Management ───

  ipcMain.handle(
    'browser-profile-create',
    async (_, { name, description }: { name: string; description?: string }) => {
      return BrowserProfiles.createProfile(name, description)
    }
  )

  ipcMain.handle('browser-profile-list', async () => {
    return BrowserProfiles.listProfiles()
  })

  ipcMain.handle('browser-profile-delete', async (_, nameOrId: string) => {
    return { success: BrowserProfiles.deleteProfile(nameOrId) }
  })
}

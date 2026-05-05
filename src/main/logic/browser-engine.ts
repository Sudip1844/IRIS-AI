/**
 * BrowserEngine — Persistent browser control plane for MJ-AI
 * Inspired by PinchTab's architecture: singleton Chromium instance with
 * structured commands (navigate, click, fill, snapshot, text, screenshot).
 *
 * Instead of spawning a new headless browser for every request,
 * this keeps a single long-lived instance alive and exposes an HTTP-style
 * command interface via IPC.
 */

import puppeteer from 'puppeteer-extra'
import { Browser, Page } from 'puppeteer'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

puppeteer.use(StealthPlugin())

// ─── Element Reference System ───
// Maps short refs like "e1", "e2" to actual DOM selectors
interface ElementRef {
  ref: string
  tag: string
  role?: string
  text: string
  selector: string
  type?: string
  href?: string
  isInteractive: boolean
}

interface TabInfo {
  id: string
  url: string
  title: string
  active: boolean
}

interface SnapshotResult {
  url: string
  title: string
  elements: ElementRef[]
  textSummary: string
}

// ─── Singleton Browser Engine ───
class BrowserEngine {
  private static instance: BrowserEngine | null = null

  private browser: Browser | null = null
  private pages: Map<string, Page> = new Map()
  private activeTabId: string | null = null
  private tabCounter = 0
  private profileDir: string

  private constructor() {
    this.profileDir = path.join(app.getPath('userData'), 'browser-profiles', 'default')
    if (!fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true })
    }
  }

  static getInstance(): BrowserEngine {
    if (!BrowserEngine.instance) {
      BrowserEngine.instance = new BrowserEngine()
    }
    return BrowserEngine.instance
  }

  /** Check if the browser is currently running */
  isRunning(): boolean {
    return this.browser !== null && this.browser.connected
  }

  /** Launch or reconnect the persistent Chromium instance */
  async init(options?: { headless?: boolean; profileName?: string }): Promise<void> {
    if (this.isRunning()) return

    const headless = options?.headless ?? true
    const profileName = options?.profileName ?? 'default'
    const profilePath = path.join(app.getPath('userData'), 'browser-profiles', profileName)

    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true })
    }

    this.profileDir = profilePath

    this.browser = await puppeteer.launch({
      headless: headless ? true : false,
      defaultViewport: { width: 1280, height: 800 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ],
      userDataDir: profilePath
    })

    // Handle browser disconnect
    this.browser.on('disconnected', () => {
      console.log('[BrowserEngine] Browser disconnected')
      this.browser = null
      this.pages.clear()
      this.activeTabId = null
    })

    // Open a blank tab
    const initialPage = (await this.browser.pages())[0]
    if (initialPage) {
      const tabId = this.generateTabId()
      this.pages.set(tabId, initialPage)
      this.activeTabId = tabId
    }

    console.log(`[BrowserEngine] Initialized (headless=${headless}, profile=${profileName})`)
  }

  /** Navigate to a URL in the active tab (or open a new tab) */
  async navigate(url: string, options?: { newTab?: boolean }): Promise<{ tabId: string; title: string }> {
    await this.ensureRunning()

    let page: Page
    let tabId: string

    if (options?.newTab || !this.activeTabId) {
      tabId = this.generateTabId()
      page = await this.browser!.newPage()
      this.pages.set(tabId, page)
      this.activeTabId = tabId
    } else {
      tabId = this.activeTabId
      page = this.pages.get(tabId)!
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    )

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 })
    const title = await page.title()

    return { tabId, title }
  }

  /**
   * Snapshot — Build an accessibility-like tree of interactive elements.
   * Returns short refs (e1, e2, ...) mapped to DOM selectors.
   * This is the core of the token-efficient approach.
   */
  async snapshot(options?: { filter?: 'interactive' | 'all' }): Promise<SnapshotResult> {
    const page = this.getActivePage()
    const filter = options?.filter ?? 'interactive'

    const elements: ElementRef[] = await page.evaluate((filterType: string) => {
      const results: any[] = []
      let refCounter = 0

      const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'details', 'summary']
      const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'menuitem', 'tab', 'combobox']

      const allElements = filterType === 'interactive'
        ? document.querySelectorAll(interactiveTags.join(',') + ',[role],[onclick],[tabindex]')
        : document.querySelectorAll('*')

      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        if (!htmlEl.offsetParent && htmlEl.tagName !== 'BODY') return // skip hidden

        const rect = htmlEl.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return

        const tag = htmlEl.tagName.toLowerCase()
        const role = htmlEl.getAttribute('role') || ''
        const text = (htmlEl.textContent || '').trim().substring(0, 80)
        const type = (htmlEl as HTMLInputElement).type || ''
        const href = (htmlEl as HTMLAnchorElement).href || ''

        const isInteractive =
          interactiveTags.includes(tag) ||
          interactiveRoles.includes(role) ||
          htmlEl.hasAttribute('onclick') ||
          htmlEl.hasAttribute('tabindex')

        if (filterType === 'interactive' && !isInteractive) return

        refCounter++
        const ref = `e${refCounter}`

        // Build a unique CSS selector
        let selector = tag
        if (htmlEl.id) {
          selector = `#${htmlEl.id}`
        } else if (htmlEl.className && typeof htmlEl.className === 'string') {
          const classes = htmlEl.className.trim().split(/\s+/).slice(0, 2).join('.')
          if (classes) selector = `${tag}.${classes}`
        }

        // Add data attribute for reliable targeting
        htmlEl.setAttribute('data-mj-ref', ref)

        results.push({ ref, tag, role, text, selector, type, href, isInteractive })
      })

      return results
    }, filter)

    const title = await page.title()
    const url = page.url()
    const textSummary = await this.extractText()

    return { url, title, elements, textSummary }
  }

  /** Click an element by its ref ID (e.g., "e5") */
  async click(ref: string): Promise<{ success: boolean; message: string }> {
    const page = this.getActivePage()

    try {
      const clicked = await page.evaluate((refId: string) => {
        const el = document.querySelector(`[data-mj-ref="${refId}"]`) as HTMLElement
        if (!el) return false
        el.click()
        return true
      }, ref)

      if (!clicked) {
        return { success: false, message: `Element ${ref} not found. Run snapshot() first.` }
      }

      // Wait for navigation or DOM changes
      await new Promise((r) => setTimeout(r, 800))

      return { success: true, message: `Clicked ${ref}` }
    } catch (err: any) {
      return { success: false, message: `Click failed: ${err.message}` }
    }
  }

  /** Fill an input field by ref ID */
  async fill(ref: string, value: string): Promise<{ success: boolean; message: string }> {
    const page = this.getActivePage()

    try {
      const filled = await page.evaluate(
        (refId: string, val: string) => {
          const el = document.querySelector(`[data-mj-ref="${refId}"]`) as HTMLInputElement
          if (!el) return false

          el.focus()
          el.value = ''

          // Dispatch events to trigger React/Vue/etc. reactivity
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )?.set
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(el, val)
          } else {
            el.value = val
          }

          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
          return true
        },
        ref,
        value
      )

      if (!filled) {
        return { success: false, message: `Input ${ref} not found. Run snapshot() first.` }
      }

      return { success: true, message: `Filled ${ref} with "${value.substring(0, 30)}..."` }
    } catch (err: any) {
      return { success: false, message: `Fill failed: ${err.message}` }
    }
  }

  /** Press a key (Enter, Tab, Escape, etc.) on the focused element or a ref */
  async press(ref: string | null, key: string): Promise<{ success: boolean; message: string }> {
    const page = this.getActivePage()

    try {
      if (ref) {
        await page.evaluate((refId: string) => {
          const el = document.querySelector(`[data-mj-ref="${refId}"]`) as HTMLElement
          if (el) el.focus()
        }, ref)
      }

      await page.keyboard.press(key as any)
      await new Promise((r) => setTimeout(r, 500))

      return { success: true, message: `Pressed ${key}${ref ? ` on ${ref}` : ''}` }
    } catch (err: any) {
      return { success: false, message: `Press failed: ${err.message}` }
    }
  }

  /** Extract readable text from the page (token-efficient) */
  async extractText(): Promise<string> {
    const page = this.getActivePage()

    const text = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement
            if (!parent) return NodeFilter.FILTER_REJECT
            const tag = parent.tagName.toLowerCase()
            if (['script', 'style', 'noscript', 'svg', 'path'].includes(tag))
              return NodeFilter.FILTER_REJECT
            if (!parent.offsetParent && tag !== 'body') return NodeFilter.FILTER_REJECT
            const content = (node.textContent || '').trim()
            if (content.length < 2) return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
          }
        }
      )

      const texts: string[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        const t = (node.textContent || '').trim()
        if (t.length > 1) texts.push(t)
      }

      // Deduplicate consecutive identical strings
      const deduped: string[] = []
      for (const t of texts) {
        if (deduped[deduped.length - 1] !== t) deduped.push(t)
      }

      return deduped.join(' ').substring(0, 3000)
    })

    return text
  }

  /** Capture a screenshot as base64 PNG */
  async screenshot(options?: { fullPage?: boolean }): Promise<string> {
    const page = this.getActivePage()
    const buffer = await page.screenshot({
      encoding: 'base64',
      fullPage: options?.fullPage ?? false
    })
    return buffer as string
  }

  /** List all open tabs */
  async listTabs(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = []
    for (const [id, page] of this.pages) {
      try {
        tabs.push({
          id,
          url: page.url(),
          title: await page.title(),
          active: id === this.activeTabId
        })
      } catch {
        // Page may have been closed
        this.pages.delete(id)
      }
    }
    return tabs
  }

  /** Switch to a specific tab by ID */
  async switchTab(tabId: string): Promise<boolean> {
    const page = this.pages.get(tabId)
    if (!page) return false

    await page.bringToFront()
    this.activeTabId = tabId
    return true
  }

  /** Close a specific tab */
  async closeTab(tabId: string): Promise<boolean> {
    const page = this.pages.get(tabId)
    if (!page) return false

    await page.close()
    this.pages.delete(tabId)

    if (this.activeTabId === tabId) {
      // Switch to the last remaining tab
      const remaining = Array.from(this.pages.keys())
      this.activeTabId = remaining.length > 0 ? remaining[remaining.length - 1] : null
    }

    return true
  }

  /** Shut down the browser cleanly */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close()
      } catch (e) {
        console.log('[BrowserEngine] Close error (browser already gone):', e)
      }
      this.browser = null
      this.pages.clear()
      this.activeTabId = null
    }
  }

  // ─── Private helpers ───

  private async ensureRunning(): Promise<void> {
    if (!this.isRunning()) {
      await this.init()
    }
  }

  private getActivePage(): Page {
    if (!this.activeTabId || !this.pages.has(this.activeTabId)) {
      throw new Error('No active tab. Call navigate() first.')
    }
    return this.pages.get(this.activeTabId)!
  }

  private generateTabId(): string {
    this.tabCounter++
    return `tab_${Date.now()}_${this.tabCounter}`
  }
}

export default BrowserEngine
export type { ElementRef, TabInfo, SnapshotResult }

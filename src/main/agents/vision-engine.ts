/**
 * Vision Engine — AI-powered screen understanding
 * Inspired by anthropic-quickstarts/computer-use
 *
 * Takes screenshots and sends them to vision-capable AI models to:
 * - Describe what's on screen
 * - Identify interactive elements visually
 * - Suggest next actions
 * - Compare before/after states
 *
 * Works with ANY app, not just browsers — true computer use capability.
 */

import { ipcMain, desktopCapturer, BrowserWindow } from 'electron'
import BrowserEngine from '../logic/browser-engine'
import { handleChatRequest } from '../services/chat-handler'

// ─── Types ───

export interface VisionAnalysis {
  description: string
  elements: VisionElement[]
  suggestedActions: string[]
  rawResponse: string
  source: 'browser' | 'screen'
  timestamp: number
}

export interface VisionElement {
  label: string
  type: 'button' | 'input' | 'link' | 'text' | 'image' | 'menu' | 'other'
  location: string // rough description like "top-left", "center", "bottom-right"
  actionable: boolean
}

// ─── Core Vision Functions ───

/**
 * Analyze a screenshot using an AI vision model.
 * Falls back to text-based analysis if vision model isn't available.
 */
async function analyzeScreenshot(
  base64Image: string,
  context?: string,
  provider?: string,
  model?: string
): Promise<VisionAnalysis> {
  const prompt = buildVisionPrompt(context)

  // Try vision analysis via chat handler
  // Most modern models (GPT-4V, Gemini Pro Vision, Claude 3) support image input
  // We send the base64 image as part of the prompt context
  const result = await handleChatRequest({
    text: `${prompt}\n\nAnalyze based on the context provided and generate your best assessment.`,
    images: [base64Image],
    provider: (provider as any) || 'auto',
    model
  })

  return parseVisionResponse(result, 'browser')
}

/**
 * Capture and analyze the browser page
 */
async function analyzeBrowserPage(
  context?: string,
  provider?: string,
  model?: string
): Promise<VisionAnalysis> {
  const engine = BrowserEngine.getInstance()

  if (!engine.isRunning()) {
    throw new Error('Browser not running. Call browser-init first.')
  }

  // Get both screenshot and text for comprehensive analysis
  const [screenshot, pageText] = await Promise.all([
    engine.screenshot(),
    engine.extractText()
  ])

  const prompt = buildVisionPrompt(context)

  const result = await handleChatRequest({
    text: `${prompt}\n\n` +
      `--- Page Text Content ---\n${pageText.substring(0, 2000)}\n---\n\n` +
      `Based on the page text above and the provided screenshot, provide your analysis.`,
    images: [screenshot],
    provider: (provider as any) || 'auto',
    model
  })

  return parseVisionResponse(result, 'browser')
}

/**
 * Capture and analyze the entire desktop screen
 */
async function analyzeDesktopScreen(
  context?: string,
  provider?: string,
  model?: string
): Promise<VisionAnalysis> {
  // Capture the screen
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  })

  if (!sources.length) {
    throw new Error('No screen source available')
  }

  const thumbnail = sources[0].thumbnail
  const base64 = thumbnail.toPNG().toString('base64')

  const prompt = buildVisionPrompt(context)

  const result = await handleChatRequest({
    text: `${prompt}\n\n` +
      `I've captured a screenshot of the user's desktop (resolution: ${thumbnail.getSize().width}x${thumbnail.getSize().height}). ` +
      `Analyze the provided screenshot and suggest useful actions.`,
    images: [base64],
    provider: (provider as any) || 'auto',
    model
  })

  return parseVisionResponse(result, 'screen')
}

/**
 * Compare two states — useful for verifying if an action succeeded
 */
async function compareStates(
  beforeText: string,
  afterText: string,
  action: string,
  provider?: string,
  model?: string
): Promise<{ changed: boolean; description: string; success: boolean }> {
  const result = await handleChatRequest({
    text: `Compare these two states to determine if an action was successful.\n\n` +
      `Action performed: "${action}"\n\n` +
      `--- BEFORE ---\n${beforeText.substring(0, 1500)}\n---\n\n` +
      `--- AFTER ---\n${afterText.substring(0, 1500)}\n---\n\n` +
      `Respond in this exact JSON format:\n` +
      `{"changed": true/false, "description": "what changed", "success": true/false}`,
    provider: (provider as any) || 'auto',
    model
  })

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {}

  return {
    changed: beforeText !== afterText,
    description: result.substring(0, 200),
    success: !result.toLowerCase().includes('fail')
  }
}

// ─── Helpers ───

function buildVisionPrompt(context?: string): string {
  return [
    'You are a Vision Agent analyzing a screenshot of a computer screen.',
    'Your job is to:',
    '1. Describe what you see on screen (application, content, UI state)',
    '2. Identify interactive elements (buttons, inputs, links, menus)',
    '3. Suggest the most useful next actions the user could take',
    '',
    context ? `Context from user: "${context}"` : '',
    '',
    'Respond in this structured format:',
    '**Description:** [what is on screen]',
    '**Elements:** [list interactive elements with their locations]',
    '**Suggested Actions:** [numbered list of what to do next]'
  ]
    .filter(Boolean)
    .join('\n')
}

function parseVisionResponse(response: string, source: 'browser' | 'screen'): VisionAnalysis {
  // Extract sections from the structured response
  const descMatch = response.match(/\*\*Description:\*\*\s*([\s\S]*?)(?=\*\*Elements:|\*\*Suggested|$)/i)
  const elemMatch = response.match(/\*\*Elements:\*\*\s*([\s\S]*?)(?=\*\*Suggested|$)/i)
  const actionsMatch = response.match(/\*\*Suggested Actions:\*\*\s*([\s\S]*?)$/i)

  const description = descMatch?.[1]?.trim() || response.substring(0, 300)

  // Parse elements
  const elements: VisionElement[] = []
  if (elemMatch?.[1]) {
    const lines = elemMatch[1].split('\n').filter((l) => l.trim())
    for (const line of lines) {
      const cleaned = line.replace(/^[-*•]\s*/, '').trim()
      if (cleaned.length > 3) {
        elements.push({
          label: cleaned.substring(0, 80),
          type: inferElementType(cleaned),
          location: inferLocation(cleaned),
          actionable: true
        })
      }
    }
  }

  // Parse suggested actions
  const suggestedActions: string[] = []
  if (actionsMatch?.[1]) {
    const lines = actionsMatch[1].split('\n').filter((l) => l.trim())
    for (const line of lines) {
      const cleaned = line.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim()
      if (cleaned.length > 3) {
        suggestedActions.push(cleaned)
      }
    }
  }

  return {
    description,
    elements,
    suggestedActions,
    rawResponse: response,
    source,
    timestamp: Date.now()
  }
}

function inferElementType(text: string): VisionElement['type'] {
  const lower = text.toLowerCase()
  if (lower.includes('button') || lower.includes('btn') || lower.includes('click')) return 'button'
  if (lower.includes('input') || lower.includes('field') || lower.includes('text box') || lower.includes('search')) return 'input'
  if (lower.includes('link') || lower.includes('href') || lower.includes('url')) return 'link'
  if (lower.includes('image') || lower.includes('icon') || lower.includes('logo')) return 'image'
  if (lower.includes('menu') || lower.includes('dropdown') || lower.includes('nav')) return 'menu'
  if (lower.includes('text') || lower.includes('heading') || lower.includes('paragraph')) return 'text'
  return 'other'
}

function inferLocation(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('top') && lower.includes('left')) return 'top-left'
  if (lower.includes('top') && lower.includes('right')) return 'top-right'
  if (lower.includes('bottom') && lower.includes('left')) return 'bottom-left'
  if (lower.includes('bottom') && lower.includes('right')) return 'bottom-right'
  if (lower.includes('center') || lower.includes('middle')) return 'center'
  if (lower.includes('top')) return 'top'
  if (lower.includes('bottom')) return 'bottom'
  if (lower.includes('left')) return 'left'
  if (lower.includes('right')) return 'right'
  return 'unknown'
}

// ─── IPC Registration ───

export default function registerVisionEngine() {
  ipcMain.handle(
    'vision-analyze-browser',
    async (_, { context, provider, model }: { context?: string; provider?: string; model?: string }) => {
      try {
        return { success: true, analysis: await analyzeBrowserPage(context, provider, model) }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  ipcMain.handle(
    'vision-analyze-screen',
    async (_, { context, provider, model }: { context?: string; provider?: string; model?: string }) => {
      try {
        return { success: true, analysis: await analyzeDesktopScreen(context, provider, model) }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  ipcMain.handle(
    'vision-compare',
    async (_, { beforeText, afterText, action, provider, model }: {
      beforeText: string
      afterText: string
      action: string
      provider?: string
      model?: string
    }) => {
      try {
        return { success: true, result: await compareStates(beforeText, afterText, action, provider, model) }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  console.log('[VisionEngine] Registered — browser + desktop analysis + state comparison')
}

export { analyzeScreenshot, analyzeBrowserPage, analyzeDesktopScreen, compareStates }

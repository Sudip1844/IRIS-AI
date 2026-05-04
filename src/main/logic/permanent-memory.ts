/**
 * Unified Shared Memory — Namespaced, structured memory for all agents
 *
 * Replaces the simple flat fact list with a structured store where:
 * - "global" namespace: shared across all agents
 * - "agent:{id}" namespace: agent-specific memories
 * - "project:{id}" namespace: project-scoped context
 * - "team:{id}" namespace: team-wide knowledge
 *
 * Inspired by mem0's intelligent memory layer — supports tags,
 * source tracking, and text-based search with future semantic expansion.
 */

import fs from 'fs'
import path from 'path'
import { IpcMain, App } from 'electron'
import { MemoryEntry, MemoryQuery } from '../agents/agent-types'

const MEMORY_DIR = (app: App) => path.resolve(app.getPath('userData'), 'Memory')
const UNIFIED_FILE = (app: App) => path.join(MEMORY_DIR(app), 'unified-memory.json')
const LEGACY_FILE = (app: App) => path.join(MEMORY_DIR(app), 'saved-user-memory.json')

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

// ─── Core Memory Store ───

function loadMemory(app: App): MemoryEntry[] {
  const filePath = UNIFIED_FILE(app)
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch {}

  // Auto-migrate legacy memory on first load
  return migrateLegacy(app)
}

function saveMemory(app: App, entries: MemoryEntry[]): void {
  ensureDir(MEMORY_DIR(app))
  fs.writeFileSync(UNIFIED_FILE(app), JSON.stringify(entries, null, 2))
}

/** Migrate old flat fact list to namespaced format */
function migrateLegacy(appRef: App): MemoryEntry[] {
  const legacyPath = LEGACY_FILE(appRef)
  if (!fs.existsSync(legacyPath)) return []

  try {
    const legacyData = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'))
    if (!Array.isArray(legacyData)) return []

    const migrated: MemoryEntry[] = legacyData.map((item: any) => ({
      id: generateId(),
      fact: item.fact || String(item),
      source: 'user',
      namespace: 'global',
      tags: ['migrated'],
      timestamp: item.timestamp ? new Date(item.timestamp).getTime() : Date.now()
    }))

    // Save to new format
    saveMemory(appRef, migrated)
    console.log(`[Memory] Migrated ${migrated.length} entries from legacy format`)
    return migrated
  } catch {
    return []
  }
}

// ─── Public Functions ───

/** Save a fact to memory */
export function saveToMemory(
  appRef: App,
  namespace: string,
  fact: string,
  source: string,
  tags?: string[],
  expiresAt?: number
): MemoryEntry {
  const entries = loadMemory(appRef)

  // Deduplication: skip if exact same fact exists in same namespace
  const existing = entries.find(
    (e) => e.namespace === namespace && e.fact.toLowerCase() === fact.toLowerCase()
  )
  if (existing) {
    // Update timestamp and source
    existing.timestamp = Date.now()
    existing.source = source
    if (tags) existing.tags = [...new Set([...(existing.tags || []), ...tags])]
    saveMemory(appRef, entries)
    return existing
  }

  const entry: MemoryEntry = {
    id: generateId(),
    fact,
    source,
    namespace,
    tags,
    timestamp: Date.now(),
    expiresAt
  }

  entries.push(entry)
  saveMemory(appRef, entries)
  return entry
}

/** Search memory with filters */
export function searchMemory(appRef: App, query: MemoryQuery): MemoryEntry[] {
  let entries = loadMemory(appRef)

  // Filter expired entries
  const now = Date.now()
  entries = entries.filter((e) => !e.expiresAt || e.expiresAt > now)

  // Filter by namespace
  if (query.namespace) {
    entries = entries.filter((e) => e.namespace === query.namespace)
  }

  // Filter by source
  if (query.source) {
    entries = entries.filter((e) => e.source === query.source)
  }

  // Filter by tags
  if (query.tags && query.tags.length > 0) {
    entries = entries.filter(
      (e) => e.tags && query.tags!.some((tag) => e.tags!.includes(tag))
    )
  }

  // Filter by time
  if (query.since) {
    entries = entries.filter((e) => e.timestamp >= query.since!)
  }

  // Text search (simple keyword match — future: semantic/embedding search)
  if (query.query) {
    const keywords = query.query.toLowerCase().split(/\s+/)
    entries = entries.filter((e) => {
      const text = e.fact.toLowerCase()
      return keywords.some((kw) => text.includes(kw))
    })

    // Sort by relevance (more keyword matches = higher score)
    entries.sort((a, b) => {
      const scoreA = keywords.filter((kw) => a.fact.toLowerCase().includes(kw)).length
      const scoreB = keywords.filter((kw) => b.fact.toLowerCase().includes(kw)).length
      return scoreB - scoreA
    })
  } else {
    // Sort by recency
    entries.sort((a, b) => b.timestamp - a.timestamp)
  }

  // Limit results
  const limit = query.limit ?? 50
  return entries.slice(0, limit)
}

/** Get all memory for a namespace */
export function getNamespaceMemory(appRef: App, namespace: string): MemoryEntry[] {
  return searchMemory(appRef, { namespace })
}

/** Delete a specific memory entry */
export function deleteMemoryEntry(appRef: App, memoryId: string): boolean {
  const entries = loadMemory(appRef)
  const idx = entries.findIndex((e) => e.id === memoryId)
  if (idx < 0) return false
  entries.splice(idx, 1)
  saveMemory(appRef, entries)
  return true
}

/** Clear all memory for a namespace */
export function clearNamespace(appRef: App, namespace: string): number {
  const entries = loadMemory(appRef)
  const before = entries.length
  const filtered = entries.filter((e) => e.namespace !== namespace)
  saveMemory(appRef, filtered)
  return before - filtered.length
}

/** Get memory stats */
export function getMemoryStats(appRef: App): {
  totalEntries: number
  namespaces: Record<string, number>
  oldestEntry: number
  newestEntry: number
} {
  const entries = loadMemory(appRef)
  const namespaces: Record<string, number> = {}

  for (const entry of entries) {
    namespaces[entry.namespace] = (namespaces[entry.namespace] || 0) + 1
  }

  return {
    totalEntries: entries.length,
    namespaces,
    oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.timestamp)) : 0,
    newestEntry: entries.length > 0 ? Math.max(...entries.map((e) => e.timestamp)) : 0
  }
}

// ─── IPC Registration ───

export default function registerUnifiedMemory({ ipcMain, app: appRef }: { ipcMain: IpcMain; app: App }) {
  // Legacy compatibility — keep old handlers working
  ipcMain.handle('save-core-memory', async (_event, fact: string) => {
    try {
      saveToMemory(appRef, 'global', fact, 'user')
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('search-core-memory', async () => {
    try {
      return searchMemory(appRef, { namespace: 'global' })
    } catch {
      return []
    }
  })

  // New unified memory handlers
  ipcMain.handle(
    'memory-save',
    async (_event, { namespace, fact, source, tags, expiresAt }: {
      namespace: string
      fact: string
      source: string
      tags?: string[]
      expiresAt?: number
    }) => {
      try {
        return saveToMemory(appRef, namespace, fact, source, tags, expiresAt)
      } catch (e) {
        return { error: String(e) }
      }
    }
  )

  ipcMain.handle('memory-search', async (_event, query: MemoryQuery) => {
    try {
      return searchMemory(appRef, query)
    } catch {
      return []
    }
  })

  ipcMain.handle('memory-delete', async (_event, memoryId: string) => {
    return deleteMemoryEntry(appRef, memoryId)
  })

  ipcMain.handle('memory-clear-namespace', async (_event, namespace: string) => {
    return clearNamespace(appRef, namespace)
  })

  ipcMain.handle('memory-stats', async () => {
    return getMemoryStats(appRef)
  })
}

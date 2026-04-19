/**
 * QuarantineManager – Isolates suspicious/blocked files instead of deleting.
 *
 * Suspicious files are moved to a quarantine folder inside the user's
 * app-data directory.  The owner can review and restore/delete them later
 * from the MJ Control Center UI.
 */
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

// ─── Quarantine root path ───────────────────────────────────────────
const QUARANTINE_DIR = path.join(app.getPath('userData'), 'quarantine')

// Ensure the quarantine directory exists on startup
if (!fs.existsSync(QUARANTINE_DIR)) {
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true })
}

export interface QuarantineEntry {
  id: string
  originalPath: string
  quarantinedPath: string
  reason: string
  timestamp: string
  threatLevel: 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

// In-memory manifest (persisted to disk as JSON)
const MANIFEST_PATH = path.join(QUARANTINE_DIR, '_manifest.json')

function loadManifest(): QuarantineEntry[] {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    }
  } catch { /* corrupted manifest → start fresh */ }
  return []
}

function saveManifest(entries: QuarantineEntry[]): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Move a file into the quarantine zone.
 * The original file is renamed to a unique ID to prevent conflicts.
 */
export function quarantineFile(
  filePath: string,
  reason: string,
  threatLevel: QuarantineEntry['threatLevel'] = 'HIGH'
): QuarantineEntry | null {
  const resolvedPath = path.resolve(filePath)

  if (!fs.existsSync(resolvedPath)) {
    return null // File doesn't exist — nothing to quarantine
  }

  const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const ext = path.extname(resolvedPath)
  const quarantinedName = `${id}${ext}`
  const quarantinedPath = path.join(QUARANTINE_DIR, quarantinedName)

  try {
    // Move file into quarantine
    fs.renameSync(resolvedPath, quarantinedPath)
  } catch {
    // If rename fails (cross-device), fall back to copy+delete
    try {
      fs.copyFileSync(resolvedPath, quarantinedPath)
      fs.unlinkSync(resolvedPath)
    } catch {
      return null // Could not quarantine
    }
  }

  const entry: QuarantineEntry = {
    id,
    originalPath: resolvedPath,
    quarantinedPath,
    reason,
    threatLevel,
    timestamp: new Date().toISOString()
  }

  const manifest = loadManifest()
  manifest.push(entry)
  saveManifest(manifest)

  return entry
}

/**
 * List all quarantined items.
 */
export function listQuarantined(): QuarantineEntry[] {
  return loadManifest()
}

/**
 * Restore a quarantined file back to its original location.
 */
export function restoreFile(id: string): boolean {
  const manifest = loadManifest()
  const idx = manifest.findIndex(e => e.id === id)
  if (idx === -1) return false

  const entry = manifest[idx]

  if (!fs.existsSync(entry.quarantinedPath)) return false

  try {
    // Ensure the original directory still exists
    const originalDir = path.dirname(entry.originalPath)
    if (!fs.existsSync(originalDir)) {
      fs.mkdirSync(originalDir, { recursive: true })
    }

    fs.renameSync(entry.quarantinedPath, entry.originalPath)
  } catch {
    try {
      fs.copyFileSync(entry.quarantinedPath, entry.originalPath)
      fs.unlinkSync(entry.quarantinedPath)
    } catch {
      return false
    }
  }

  manifest.splice(idx, 1)
  saveManifest(manifest)
  return true
}

/**
 * Permanently delete a quarantined file.
 */
export function deleteQuarantined(id: string): boolean {
  const manifest = loadManifest()
  const idx = manifest.findIndex(e => e.id === id)
  if (idx === -1) return false

  const entry = manifest[idx]

  try {
    if (fs.existsSync(entry.quarantinedPath)) {
      fs.unlinkSync(entry.quarantinedPath)
    }
  } catch { /* file already gone */ }

  manifest.splice(idx, 1)
  saveManifest(manifest)
  return true
}

/**
 * Browser Profiles — Persistent session management for BrowserEngine
 * Each profile stores cookies, localStorage, and auth state in its own
 * Chromium user-data directory, so MJ can "stay logged in" across restarts.
 */

import { app } from 'electron'
import path from 'path'
import fs from 'fs'

interface BrowserProfile {
  id: string
  name: string
  description: string
  createdAt: number
  lastUsedAt: number
  dataDir: string
}

const PROFILES_DIR = () => path.join(app.getPath('userData'), 'browser-profiles')
const PROFILES_INDEX = () => path.join(PROFILES_DIR(), 'profiles.json')

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function loadIndex(): BrowserProfile[] {
  try {
    if (fs.existsSync(PROFILES_INDEX())) {
      return JSON.parse(fs.readFileSync(PROFILES_INDEX(), 'utf-8'))
    }
  } catch {}
  return []
}

function saveIndex(profiles: BrowserProfile[]): void {
  ensureDir(PROFILES_DIR())
  fs.writeFileSync(PROFILES_INDEX(), JSON.stringify(profiles, null, 2))
}

/** Create a new browser profile */
export function createProfile(name: string, description = ''): BrowserProfile {
  ensureDir(PROFILES_DIR())
  const profiles = loadIndex()

  // Prevent duplicates
  const existing = profiles.find((p) => p.name === name)
  if (existing) return existing

  const id = `profile_${Date.now()}`
  const dataDir = path.join(PROFILES_DIR(), id)
  ensureDir(dataDir)

  const profile: BrowserProfile = {
    id,
    name,
    description,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    dataDir
  }

  profiles.push(profile)
  saveIndex(profiles)
  return profile
}

/** List all profiles */
export function listProfiles(): BrowserProfile[] {
  return loadIndex()
}

/** Get a specific profile by name or ID */
export function getProfile(nameOrId: string): BrowserProfile | null {
  const profiles = loadIndex()
  return (
    profiles.find((p) => p.id === nameOrId || p.name === nameOrId) || null
  )
}

/** Update last-used timestamp */
export function touchProfile(nameOrId: string): void {
  const profiles = loadIndex()
  const profile = profiles.find((p) => p.id === nameOrId || p.name === nameOrId)
  if (profile) {
    profile.lastUsedAt = Date.now()
    saveIndex(profiles)
  }
}

/** Delete a profile and its data directory */
export function deleteProfile(nameOrId: string): boolean {
  const profiles = loadIndex()
  const idx = profiles.findIndex((p) => p.id === nameOrId || p.name === nameOrId)
  if (idx < 0) return false

  const profile = profiles[idx]

  // Remove data directory
  try {
    if (fs.existsSync(profile.dataDir)) {
      fs.rmSync(profile.dataDir, { recursive: true, force: true })
    }
  } catch (e) {
    console.error('[BrowserProfiles] Failed to remove profile dir:', e)
  }

  profiles.splice(idx, 1)
  saveIndex(profiles)
  return true
}

/** Get the data directory path for a profile (for Puppeteer userDataDir) */
export function getProfileDataDir(nameOrId: string): string {
  const profile = getProfile(nameOrId)
  if (profile) {
    touchProfile(nameOrId)
    return profile.dataDir
  }

  // Fallback to default
  const defaultDir = path.join(PROFILES_DIR(), 'default')
  ensureDir(defaultDir)
  return defaultDir
}

export type { BrowserProfile }

import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  provider?: string
  model?: string
}

export interface ChatSession {
  id: string
  name: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const CHAT_HISTORY_FILE = path.join(app.getPath('userData'), 'mj_chat_history.json')
const MAX_MESSAGES_PER_SESSION = 100
const MAX_SESSIONS = 50

interface ChatHistoryStore {
  sessions: ChatSession[]
  activeSessionId: string | null
}

function getDefaultStore(): ChatHistoryStore {
  return {
    sessions: [],
    activeSessionId: null
  }
}

function loadChatHistory(): ChatHistoryStore {
  try {
    if (!fs.existsSync(CHAT_HISTORY_FILE)) {
      return getDefaultStore()
    }
    const data = fs.readFileSync(CHAT_HISTORY_FILE, 'utf8')
    return JSON.parse(data)
  } catch (err) {
    console.error('[MJ] Failed to load chat history:', err)
    return getDefaultStore()
  }
}

function saveChatHistory(store: ChatHistoryStore): boolean {
  try {
    fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(store, null, 2), 'utf8')
    return true
  } catch (err) {
    console.error('[MJ] Failed to save chat history:', err)
    return false
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function createSession(name?: string): ChatSession {
  const store = loadChatHistory()
  const session: ChatSession = {
    id: generateId(),
    name: name || `Chat ${store.sessions.length + 1}`,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  store.sessions.unshift(session)
  store.activeSessionId = session.id

  // Limit total sessions
  if (store.sessions.length > MAX_SESSIONS) {
    store.sessions = store.sessions.slice(0, MAX_SESSIONS)
  }

  saveChatHistory(store)
  return session
}

export function getActiveSession(): ChatSession | null {
  const store = loadChatHistory()
  if (!store.activeSessionId) {
    // Create a new session if none exists
    return createSession()
  }
  return store.sessions.find((s) => s.id === store.activeSessionId) || null
}

export function getSession(sessionId: string): ChatSession | null {
  const store = loadChatHistory()
  return store.sessions.find((s) => s.id === sessionId) || null
}

export function getAllSessions(): ChatSession[] {
  const store = loadChatHistory()
  return store.sessions
}

export function setActiveSession(sessionId: string): boolean {
  const store = loadChatHistory()
  const session = store.sessions.find((s) => s.id === sessionId)
  if (!session) return false
  store.activeSessionId = sessionId
  return saveChatHistory(store)
}

export function deleteSession(sessionId: string): boolean {
  const store = loadChatHistory()
  const index = store.sessions.findIndex((s) => s.id === sessionId)
  if (index === -1) return false

  store.sessions.splice(index, 1)

  // If deleted session was active, switch to first available
  if (store.activeSessionId === sessionId) {
    store.activeSessionId = store.sessions[0]?.id || null
  }

  return saveChatHistory(store)
}

export function addMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  provider?: string,
  model?: string
): ChatMessage | null {
  const store = loadChatHistory()
  let session = store.sessions.find((s) => s.id === store.activeSessionId)

  // Create session if none exists
  if (!session) {
    session = createSession()
    const updatedStore = loadChatHistory()
    session = updatedStore.sessions.find((s) => s.id === store.activeSessionId) || session
  }

  const message: ChatMessage = {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
    provider,
    model
  }

  session.messages.push(message)
  session.updatedAt = Date.now()

  // Limit messages per session
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION)
  }

  saveChatHistory(store)
  return message
}

export function getMessages(sessionId?: string): ChatMessage[] {
  const store = loadChatHistory()
  const session = store.sessions.find((s) => s.id === (sessionId || store.activeSessionId))
  return session?.messages || []
}

export function getRecentMessages(count: number = 10, sessionId?: string): ChatMessage[] {
  const messages = getMessages(sessionId)
  return messages.slice(-count)
}

export function clearHistory(): boolean {
  return saveChatHistory(getDefaultStore())
}

export function renameSession(sessionId: string, newName: string): boolean {
  const store = loadChatHistory()
  const session = store.sessions.find((s) => s.id === sessionId)
  if (!session) return false
  session.name = newName
  session.updatedAt = Date.now()
  return saveChatHistory(store)
}

export function getContextForAI(
  sessionId?: string,
  maxMessages: number = 10
): { system: string; conversation: Array<{ role: string; content: string }> } {
  const recentMessages = getRecentMessages(maxMessages, sessionId)
  const conversation = recentMessages.map((m) => ({
    role: m.role,
    content: m.content
  }))

  const system = `You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional.`

  return { system, conversation }
}

/**
 * Agent Inbox — Inter-agent message queue system
 *
 * Each agent has its own inbox stored as a JSON file.
 * Supports direct messages, broadcast, and team-scoped messages.
 * Inspired by claude_agent_teams_ui's agent communication model.
 */

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { AgentMessage, MessageType } from './agent-types'

const INBOX_DIR = () => path.join(app.getPath('userData'), 'agent-inboxes')

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function inboxPath(agentId: string): string {
  return path.join(INBOX_DIR(), `${agentId}.json`)
}

function loadInbox(agentId: string): AgentMessage[] {
  const filePath = inboxPath(agentId)
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch {}
  return []
}

function saveInbox(agentId: string, messages: AgentMessage[]): void {
  ensureDir(INBOX_DIR())
  fs.writeFileSync(inboxPath(agentId), JSON.stringify(messages, null, 2))
}

/** Generate a unique message ID */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

// ─── Public API ───

/** Send a message from one agent to another */
export function sendMessage(
  from: string,
  to: string,
  content: string,
  type: MessageType = 'task',
  taskRef?: string,
  metadata?: Record<string, any>
): AgentMessage {
  const message: AgentMessage = {
    id: generateMessageId(),
    from,
    to,
    content,
    type,
    taskRef,
    timestamp: Date.now(),
    read: false,
    metadata
  }

  const inbox = loadInbox(to)
  inbox.push(message)
  saveInbox(to, inbox)

  return message
}

/** Broadcast a message to all agents in a list */
export function broadcastMessage(
  from: string,
  agentIds: string[],
  content: string,
  type: MessageType = 'broadcast',
  taskRef?: string
): AgentMessage[] {
  const messages: AgentMessage[] = []

  for (const agentId of agentIds) {
    if (agentId !== from) {
      const msg = sendMessage(from, agentId, content, type, taskRef)
      messages.push(msg)
    }
  }

  return messages
}

/** Get all unread messages for an agent */
export function getUnreadMessages(agentId: string): AgentMessage[] {
  const inbox = loadInbox(agentId)
  return inbox.filter((m) => !m.read)
}

/** Get all messages for an agent (read + unread) */
export function getAllMessages(agentId: string): AgentMessage[] {
  return loadInbox(agentId)
}

/** Get messages filtered by type */
export function getMessagesByType(agentId: string, type: MessageType): AgentMessage[] {
  return loadInbox(agentId).filter((m) => m.type === type)
}

/** Get messages related to a specific task */
export function getTaskMessages(agentId: string, taskId: string): AgentMessage[] {
  return loadInbox(agentId).filter((m) => m.taskRef === taskId)
}

/** Mark specific messages as read */
export function markAsRead(agentId: string, messageIds: string[]): number {
  const inbox = loadInbox(agentId)
  let count = 0

  for (const msg of inbox) {
    if (messageIds.includes(msg.id) && !msg.read) {
      msg.read = true
      count++
    }
  }

  saveInbox(agentId, inbox)
  return count
}

/** Mark all messages as read */
export function markAllAsRead(agentId: string): number {
  const inbox = loadInbox(agentId)
  let count = 0

  for (const msg of inbox) {
    if (!msg.read) {
      msg.read = true
      count++
    }
  }

  saveInbox(agentId, inbox)
  return count
}

/** Delete old messages (keep last N) */
export function pruneInbox(agentId: string, keepLast = 100): number {
  const inbox = loadInbox(agentId)
  if (inbox.length <= keepLast) return 0

  const pruned = inbox.length - keepLast
  const kept = inbox.slice(-keepLast)
  saveInbox(agentId, kept)
  return pruned
}

/** Get the conversation thread between two agents */
export function getConversation(agentA: string, agentB: string): AgentMessage[] {
  const inboxA = loadInbox(agentA)
  const inboxB = loadInbox(agentB)

  const thread = [
    ...inboxA.filter((m) => m.from === agentB),
    ...inboxB.filter((m) => m.from === agentA)
  ]

  // Sort by timestamp
  thread.sort((a, b) => a.timestamp - b.timestamp)
  return thread
}

/** Clear all messages for an agent */
export function clearInbox(agentId: string): void {
  saveInbox(agentId, [])
}

/** Build a context string from recent messages for an agent (for injection into prompts) */
export function buildInboxContext(agentId: string, maxMessages = 10): string {
  const unread = getUnreadMessages(agentId)
  const recent = unread.slice(-maxMessages)

  if (recent.length === 0) return ''

  const lines = recent.map(
    (m) =>
      `[${m.type.toUpperCase()}] From ${m.from}: ${m.content}${m.taskRef ? ` (re: task ${m.taskRef})` : ''}`
  )

  return `\n--- Inbox (${recent.length} unread) ---\n${lines.join('\n')}\n---`
}

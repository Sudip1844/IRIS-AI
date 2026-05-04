/**
 * Memory Context Builder — Assembles context for agent prompts
 *
 * Pulls from multiple sources to build a rich but token-budgeted
 * context string for each agent:
 * - Global shared memory
 * - Agent-specific memory
 * - Active task descriptions
 * - Recent inbox messages
 * - Sibling agent task results
 */

import { App } from 'electron'
import { searchMemory, getNamespaceMemory } from '../logic/permanent-memory'
import { getAgentTasks, getKanbanSummary } from './agent-task-board'
import { getUnreadMessages } from './agent-inbox'
import { AgentDefinition } from './agent-types'

/** Rough token estimation (1 token ≈ 4 chars) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Truncate text to fit a token budget */
function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) return text
  return text.substring(0, maxChars - 20) + '\n... (truncated)'
}

interface ContextBuildOptions {
  appRef: App
  agent: AgentDefinition
  teamId?: string
  tokenBudget?: number // default 4000
  includeGlobalMemory?: boolean
  includeAgentMemory?: boolean
  includeTasks?: boolean
  includeInbox?: boolean
  includeTeamStatus?: boolean
}

export interface BuiltContext {
  systemPromptAddition: string
  totalTokens: number
  sections: {
    name: string
    tokens: number
    content: string
  }[]
}

/**
 * Build the full context payload for an agent's prompt.
 *
 * This is injected after the agent's base system prompt to give
 * it awareness of its tasks, messages, and shared knowledge.
 */
export function buildAgentContext(options: ContextBuildOptions): BuiltContext {
  const {
    appRef,
    agent,
    teamId,
    tokenBudget = 4000,
    includeGlobalMemory = true,
    includeAgentMemory = true,
    includeTasks = true,
    includeInbox = true,
    includeTeamStatus = true
  } = options

  const sections: BuiltContext['sections'] = []
  let remainingTokens = tokenBudget

  // 1. Agent Identity (always included)
  const identitySection = [
    `You are ${agent.name} (${agent.role}).`,
    `Your capabilities: ${agent.capabilities.join(', ')}.`,
    agent.role === 'lead'
      ? 'As the lead, you coordinate the team, break down tasks, and synthesize results.'
      : '',
    agent.role === 'reviewer'
      ? 'As the reviewer, you check quality and provide feedback on completed work.'
      : ''
  ]
    .filter(Boolean)
    .join(' ')

  const identityTokens = estimateTokens(identitySection)
  sections.push({ name: 'Identity', tokens: identityTokens, content: identitySection })
  remainingTokens -= identityTokens

  // 2. Global Shared Memory
  if (includeGlobalMemory && remainingTokens > 200) {
    const globalMem = searchMemory(appRef, { namespace: 'global', limit: 15 })
    if (globalMem.length > 0) {
      const content = globalMem
        .map((m) => `• ${m.fact} (source: ${m.source})`)
        .join('\n')
      const truncated = truncateToTokens(
        `\n--- Shared Knowledge ---\n${content}\n---`,
        Math.min(remainingTokens, 800)
      )
      const tokens = estimateTokens(truncated)
      sections.push({ name: 'Global Memory', tokens, content: truncated })
      remainingTokens -= tokens
    }
  }

  // 3. Agent-Specific Memory
  if (includeAgentMemory && remainingTokens > 200) {
    const agentMem = getNamespaceMemory(appRef, `agent:${agent.id}`)
    if (agentMem.length > 0) {
      const content = agentMem
        .slice(0, 10)
        .map((m) => `• ${m.fact}`)
        .join('\n')
      const truncated = truncateToTokens(
        `\n--- Your Memory ---\n${content}\n---`,
        Math.min(remainingTokens, 600)
      )
      const tokens = estimateTokens(truncated)
      sections.push({ name: 'Agent Memory', tokens, content: truncated })
      remainingTokens -= tokens
    }
  }

  // 4. Active Tasks
  if (includeTasks && remainingTokens > 300) {
    const tasks = getAgentTasks(agent.id)
    const active = tasks.filter((t) => t.status !== 'done' && t.status !== 'failed')

    if (active.length > 0) {
      const content = active
        .map(
          (t) =>
            `• [${t.status.toUpperCase()}] ${t.title} (${t.priority}): ${t.description.substring(0, 120)}`
        )
        .join('\n')
      const truncated = truncateToTokens(
        `\n--- Your Active Tasks (${active.length}) ---\n${content}\n---`,
        Math.min(remainingTokens, 800)
      )
      const tokens = estimateTokens(truncated)
      sections.push({ name: 'Active Tasks', tokens, content: truncated })
      remainingTokens -= tokens
    }
  }

  // 5. Inbox Messages
  if (includeInbox && remainingTokens > 200) {
    const unread = getUnreadMessages(agent.id)
    if (unread.length > 0) {
      const recent = unread.slice(-8)
      const content = recent
        .map(
          (m) =>
            `[${m.type.toUpperCase()}] From ${m.from}: ${m.content.substring(0, 100)}${m.taskRef ? ` (task: ${m.taskRef})` : ''}`
        )
        .join('\n')
      const truncated = truncateToTokens(
        `\n--- Inbox (${unread.length} unread) ---\n${content}\n---`,
        Math.min(remainingTokens, 600)
      )
      const tokens = estimateTokens(truncated)
      sections.push({ name: 'Inbox', tokens, content: truncated })
      remainingTokens -= tokens
    }
  }

  // 6. Team Status Overview
  if (includeTeamStatus && agent.role === 'lead' && remainingTokens > 200) {
    const kanban = getKanbanSummary()
    const statusLines = Object.entries(kanban)
      .filter(([, data]) => data.count > 0)
      .map(
        ([status, data]) =>
          `${status}: ${data.count} tasks (${data.tasks.map((t) => `"${t.title}" → ${t.assignedTo}`).join(', ')})`
      )

    if (statusLines.length > 0) {
      const content = statusLines.join('\n')
      const truncated = truncateToTokens(
        `\n--- Team Board ---\n${content}\n---`,
        Math.min(remainingTokens, 500)
      )
      const tokens = estimateTokens(truncated)
      sections.push({ name: 'Team Board', tokens, content: truncated })
      remainingTokens -= tokens
    }
  }

  // Assemble final context
  const systemPromptAddition = sections.map((s) => s.content).join('\n')
  const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0)

  return { systemPromptAddition, totalTokens, sections }
}

/**
 * Agent Type Definitions for MJ-AI Multi-Agent Orchestration
 *
 * Inspired by claude_agent_teams_ui's team model:
 * - Agents have roles (lead, worker, reviewer, specialist)
 * - Tasks flow through Kanban states
 * - Agents communicate via an inbox system
 * - All share a unified memory layer
 */

// ─── Agent Definitions ───

export type AgentRole = 'lead' | 'worker' | 'reviewer' | 'specialist'

export type AgentCapability =
  | 'chat'
  | 'browser'
  | 'code'
  | 'research'
  | 'file_ops'
  | 'system'
  | 'terminal'
  | 'vision'

export interface AgentDefinition {
  id: string
  name: string
  role: AgentRole
  systemPrompt: string
  capabilities: AgentCapability[]
  provider?: string // which AI provider to route through
  model?: string // specific model override
  memoryNamespace?: string // agent-specific memory namespace
  maxConcurrentTasks: number
}

// ─── Task System ───

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'failed' | 'blocked'

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface AgentTask {
  id: string
  title: string
  description: string
  assignedTo: string // agent ID
  createdBy: string // agent ID or 'user'
  status: TaskStatus
  priority: TaskPriority
  parentTaskId?: string // for sub-tasks
  dependsOn?: string[] // task IDs that must complete first
  result?: string
  attachments?: string[] // file paths or context refs
  tags?: string[]
  history: TaskHistoryEntry[]
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export interface TaskHistoryEntry {
  timestamp: number
  action: string // e.g., 'created', 'status_changed', 'assigned', 'commented'
  by: string // agent ID or 'user'
  details?: string
  previousValue?: string
  newValue?: string
}

// ─── Inter-Agent Messaging ───

export type MessageType = 'task' | 'review' | 'question' | 'response' | 'broadcast' | 'system'

export interface AgentMessage {
  id: string
  from: string // agent ID or 'user'
  to: string // agent ID or 'broadcast' or 'team:{teamId}'
  content: string
  type: MessageType
  taskRef?: string // optional reference to a task ID
  timestamp: number
  read: boolean
  metadata?: Record<string, any>
}

// ─── Team Definition ───

export interface AgentTeam {
  id: string
  name: string
  description: string
  members: AgentDefinition[]
  leadId: string // the lead agent's ID
  projectContext?: string // project description for all agents
  createdAt: number
  status: 'active' | 'paused' | 'completed'
}

// ─── Orchestrator State ───

export interface OrchestratorState {
  teams: AgentTeam[]
  runningAgents: Map<string, AgentRuntimeState>
}

export interface AgentRuntimeState {
  agentId: string
  teamId: string
  status: 'idle' | 'working' | 'waiting' | 'error'
  currentTaskId?: string
  lastActiveAt: number
  totalTasksCompleted: number
  totalTokensUsed: number
}

// ─── Memory Types (for Shared Memory Layer) ───

export interface MemoryEntry {
  id: string
  fact: string
  source: string // agent ID or 'user' or 'system'
  namespace: string // 'global', 'agent:{id}', 'project:{id}', 'team:{id}'
  tags?: string[]
  embedding?: number[] // for future semantic search (mem0-style)
  timestamp: number
  expiresAt?: number // optional TTL
}

export interface MemoryQuery {
  namespace?: string
  query?: string // text search
  source?: string
  tags?: string[]
  limit?: number
  since?: number // timestamp filter
}

// ─── Default Agent Templates ───

export const DEFAULT_AGENT_TEMPLATES: Omit<AgentDefinition, 'id'>[] = [
  {
    name: 'MJ Lead',
    role: 'lead',
    systemPrompt:
      'You are the Lead Agent of MJ-AI. You break down complex user requests into smaller tasks, assign them to specialist agents, and synthesize their results into a final response. You coordinate the team and ensure quality.',
    capabilities: ['chat', 'research'],
    maxConcurrentTasks: 3
  },
  {
    name: 'MJ Researcher',
    role: 'worker',
    systemPrompt:
      'You are a Research Agent. Your job is to gather information from the web, analyze data, and provide detailed findings. Be thorough and cite sources when possible.',
    capabilities: ['chat', 'research', 'browser'],
    maxConcurrentTasks: 2
  },
  {
    name: 'MJ Coder',
    role: 'specialist',
    systemPrompt:
      'You are a Coding Agent. You write, review, and debug code. You understand multiple programming languages and follow best practices. Provide clean, well-commented code.',
    capabilities: ['chat', 'code', 'file_ops', 'terminal'],
    maxConcurrentTasks: 2
  },
  {
    name: 'MJ Browser Agent',
    role: 'specialist',
    systemPrompt:
      'You are a Browser Automation Agent. You navigate websites, fill forms, click buttons, and extract information from web pages. You use the BrowserEngine to interact with Chrome.',
    capabilities: ['chat', 'browser', 'vision'],
    maxConcurrentTasks: 1
  },
  {
    name: 'MJ Reviewer',
    role: 'reviewer',
    systemPrompt:
      'You are a Review Agent. You check the quality, accuracy, and completeness of work done by other agents. Provide constructive feedback and flag any issues.',
    capabilities: ['chat', 'code', 'research'],
    maxConcurrentTasks: 3
  }
]

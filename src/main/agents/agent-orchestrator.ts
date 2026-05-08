/**
 * Agent Orchestrator — Central coordination hub for MJ-AI multi-agent system
 *
 * Manages agent lifecycle, task dispatch, parallel execution, and
 * inter-agent communication. Inspired by claude_agent_teams_ui's
 * team orchestration model and autogen's conversation patterns.
 *
 * Key design:
 * - Lead agent decomposes complex requests into sub-tasks
 * - Workers execute tasks independently and in parallel
 * - Reviewers validate completed work
 * - All agents share a unified memory layer
 */

import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { handleChatRequest } from '../services/chat-handler'
import {
  AgentDefinition,
  AgentTeam,
  AgentTask,
  AgentRuntimeState,
  DEFAULT_AGENT_TEMPLATES
} from './agent-types'
import * as TaskBoard from './agent-task-board'
import * as Inbox from './agent-inbox'
import { buildAgentContext } from './memory-context-builder'
import { saveToMemory } from '../logic/permanent-memory'

// ─── State ───
const teams: Map<string, AgentTeam> = new Map()
const agentStates: Map<string, AgentRuntimeState> = new Map()

const TEAMS_FILE = () => path.join(app.getPath('userData'), 'agent-teams.json')

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
}

// ─── Persistence ───

function loadTeams(): void {
  try {
    if (fs.existsSync(TEAMS_FILE())) {
      const data = JSON.parse(fs.readFileSync(TEAMS_FILE(), 'utf-8'))
      for (const team of data) {
        teams.set(team.id, team)
        for (const member of team.members) {
          if (!agentStates.has(member.id)) {
            agentStates.set(member.id, {
              agentId: member.id,
              teamId: team.id,
              status: 'idle',
              lastActiveAt: Date.now(),
              totalTasksCompleted: 0,
              totalTokensUsed: 0
            })
          }
        }
      }
    }
  } catch (e) {
    console.error('[Orchestrator] Failed to load teams:', e)
  }
}

function saveTeams(): void {
  const data = Array.from(teams.values())
  fs.writeFileSync(TEAMS_FILE(), JSON.stringify(data, null, 2))
}

// ─── Core Orchestration ───

/** Create a new agent team */
export function createTeam(
  name: string,
  description: string,
  memberTemplates?: Omit<AgentDefinition, 'id'>[],
  projectContext?: string
): AgentTeam {
  const templates = memberTemplates || DEFAULT_AGENT_TEMPLATES.slice(0, 3)

  const members: AgentDefinition[] = templates.map((t) => ({
    ...t,
    id: generateId('agent')
  }))

  // First member with 'lead' role becomes the lead
  const lead = members.find((m) => m.role === 'lead') || members[0]

  const team: AgentTeam = {
    id: generateId('team'),
    name,
    description,
    members,
    leadId: lead.id,
    projectContext,
    createdAt: Date.now(),
    status: 'active'
  }

  teams.set(team.id, team)

  // Initialize runtime states
  for (const member of members) {
    agentStates.set(member.id, {
      agentId: member.id,
      teamId: team.id,
      status: 'idle',
      lastActiveAt: Date.now(),
      totalTasksCompleted: 0,
      totalTokensUsed: 0
    })
  }

  saveTeams()
  console.log(`[Orchestrator] Created team "${name}" with ${members.length} agents`)
  return team
}

/** Get an agent definition by ID */
function getAgent(agentId: string): AgentDefinition | null {
  for (const team of teams.values()) {
    const agent = team.members.find((m) => m.id === agentId)
    if (agent) return agent
  }
  return null
}

/** Get a team by ID */
function getTeam(teamId: string): AgentTeam | null {
  return teams.get(teamId) || null
}

/** Execute a task with a specific agent */
async function executeAgentTask(
  agent: AgentDefinition,
  task: AgentTask,
  teamId: string
): Promise<string> {
  const state = agentStates.get(agent.id)
  if (state) {
    state.status = 'working'
    state.currentTaskId = task.id
    state.lastActiveAt = Date.now()
  }

  // Update task status
  TaskBoard.updateTaskStatus(task.id, 'in_progress', agent.id)

  try {
    // Build context-enriched prompt
    const context = buildAgentContext({
      appRef: app,
      agent,
      teamId,
      tokenBudget: 3000
    })

    const fullPrompt = [
      agent.systemPrompt,
      context.systemPromptAddition,
      `\n--- Current Task ---`,
      `Title: ${task.title}`,
      `Description: ${task.description}`,
      task.attachments?.length
        ? `Attachments: ${task.attachments.join(', ')}`
        : '',
      `Priority: ${task.priority}`,
      `\nPlease complete this task. Provide a clear, complete result.`
    ]
      .filter(Boolean)
      .join('\n')

    // Route through the AI provider
    const result = await handleChatRequest({
      text: fullPrompt,
      provider: (agent.provider as any) || 'auto',
      model: agent.model
    })

    // Store result
    TaskBoard.setTaskResult(task.id, result, agent.id)
    TaskBoard.updateTaskStatus(task.id, 'done', agent.id)

    // Save to agent memory
    saveToMemory(
      app,
      `agent:${agent.id}`,
      `Completed task "${task.title}": ${result.substring(0, 200)}`,
      agent.id,
      ['task-result']
    )

    if (state) {
      state.status = 'idle'
      state.currentTaskId = undefined
      state.totalTasksCompleted++
    }

    console.log(`[Orchestrator] Agent ${agent.name} completed task: ${task.title}`)
    return result
  } catch (error: any) {
    TaskBoard.updateTaskStatus(task.id, 'failed', agent.id)
    TaskBoard.commentOnTask(task.id, `Error: ${error.message}`, agent.id)

    if (state) {
      state.status = 'error'
      state.currentTaskId = undefined
    }

    return `ERROR: ${error.message}`
  }
}

/** 
 * Dispatch a complex request to a team.
 * The lead agent decomposes it into tasks and assigns them.
 */
async function dispatchToTeam(
  teamId: string,
  userRequest: string
): Promise<{ teamId: string; tasks: AgentTask[]; leadResponse: string }> {
  const team = teams.get(teamId)
  if (!team) throw new Error(`Team ${teamId} not found`)

  const lead = team.members.find((m) => m.id === team.leadId)
  if (!lead) throw new Error('No lead agent found')

  // Step 1: Ask the lead to decompose the request
  const decompositionPrompt = [
    lead.systemPrompt,
    `\n--- Team Members ---`,
    ...team.members
      .filter((m) => m.id !== lead.id)
      .map((m) => `- ${m.name} (${m.role}): capabilities = ${m.capabilities.join(', ')}`),
    `\n--- User Request ---`,
    userRequest,
    `\n--- Instructions ---`,
    `Break this request into specific, actionable sub-tasks.`,
    `For each sub-task, specify which team member should handle it.`,
    `Respond in this exact JSON format:`,
    `{"tasks": [{"title": "...", "description": "...", "assignTo": "agent name", "priority": "high|medium|low"}], "summary": "your plan overview"}`,
    `If this is a simple request that doesn't need decomposition, respond with:`,
    `{"tasks": [{"title": "Direct Response", "description": "the full response here", "assignTo": "${lead.name}", "priority": "medium"}], "summary": "handled directly"}`
  ].join('\n')

  const leadRawResponse = await handleChatRequest({
    text: decompositionPrompt,
    provider: (lead.provider as any) || 'auto',
    model: lead.model
  })

  // Step 2: Parse the lead's response and create tasks
  let parsedPlan: any
  try {
    // Try to extract JSON from the response
    const jsonMatch = leadRawResponse.match(/\{[\s\S]*\}/)
    parsedPlan = jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch {
    // If parsing fails, create a single task with the full response
    parsedPlan = {
      tasks: [
        {
          title: 'Process Request',
          description: userRequest,
          assignTo: lead.name,
          priority: 'medium'
        }
      ],
      summary: leadRawResponse
    }
  }

  const createdTasks: AgentTask[] = []

  if (parsedPlan?.tasks && Array.isArray(parsedPlan.tasks)) {
    for (const planTask of parsedPlan.tasks) {
      // Find the agent by name
      const targetAgent = team.members.find(
        (m) => m.name.toLowerCase().includes(planTask.assignTo?.toLowerCase() || '')
      ) || lead

      const task = TaskBoard.createTask(planTask.title, planTask.description, lead.id, {
        assignedTo: targetAgent.id,
        priority: planTask.priority || 'medium'
      })

      // Notify the assigned agent
      Inbox.sendMessage(
        lead.id,
        targetAgent.id,
        `New task assigned: "${task.title}" — ${task.description}`,
        'task',
        task.id
      )

      createdTasks.push(task)
    }
  }

  // Step 3: Execute tasks in parallel
  const executionPromises = createdTasks.map(async (task) => {
    const agent = getAgent(task.assignedTo)
    if (agent) {
      return executeAgentTask(agent, task, teamId)
    }
    return 'No agent available'
  })

  await Promise.allSettled(executionPromises)

  // Step 4: Synthesize results (lead collects everything)
  const completedTasks = createdTasks.map((t) => TaskBoard.getTask(t.id)!)
  const resultsContext = completedTasks
    .map((t) => `[${t.status}] ${t.title}: ${t.result?.substring(0, 300) || 'no result'}`)
    .join('\n')

  const synthesisPrompt = [
    lead.systemPrompt,
    `\n--- Original Request ---`,
    userRequest,
    `\n--- Task Results ---`,
    resultsContext,
    `\n--- Instructions ---`,
    `Synthesize all task results into a single, cohesive response for the user.`,
    `Be clear and concise.`
  ].join('\n')

  const finalResponse = await handleChatRequest({
    text: synthesisPrompt,
    provider: (lead.provider as any) || 'auto',
    model: lead.model
  })

  // Save to global memory
  saveToMemory(
    app,
    'global',
    `Team "${team.name}" processed: "${userRequest.substring(0, 100)}" → ${createdTasks.length} tasks`,
    lead.id,
    ['team-execution']
  )

  return {
    teamId,
    tasks: completedTasks,
    leadResponse: finalResponse
  }
}

/**
 * Execute a request using Swarm handoff logic (Ruflo-inspired).
 * Agents can directly transfer execution to another agent by outputting a JSON handoff directive.
 */
async function executeSwarm(
  teamId: string,
  userRequest: string,
  startAgentId?: string
): Promise<{ teamId: string; finalResponse: string; executionPath: string[] }> {
  const team = teams.get(teamId)
  if (!team) throw new Error(`Team ${teamId} not found`)

  let currentAgent = startAgentId 
    ? team.members.find(m => m.id === startAgentId) 
    : team.members.find(m => m.id === team.leadId)

  if (!currentAgent) throw new Error('Starting agent not found')

  let currentRequest = userRequest
  let isComplete = false
  let finalResponse = ''
  const executionPath: string[] = []
  
  const MAX_HOPS = 10
  let hops = 0

  while (!isComplete && hops < MAX_HOPS) {
    hops++
    executionPath.push(currentAgent.name)
    
    // Build context-enriched prompt
    const context = buildAgentContext({
      appRef: app,
      agent: currentAgent,
      teamId,
      tokenBudget: 3000
    })

    const swarmPrompt = [
      currentAgent.systemPrompt,
      context.systemPromptAddition,
      `\n--- Swarm Instructions ---`,
      `You are part of a Swarm. If you need another agent to handle the next step, output a JSON handoff:`,
      `{"handoff": "agent name", "reason": "why", "payload": "the context/request for them"}`,
      `If you have completed the final goal, output your final response without JSON.`,
      `\n--- Team Members ---`,
      ...team.members.map(m => `- ${m.name}: ${m.capabilities.join(', ')}`),
      `\n--- Current Input ---`,
      currentRequest
    ].join('\n')

    console.log(`[Orchestrator] Swarm hop ${hops}: Executing ${currentAgent.name}`)

    const rawResponse = await handleChatRequest({
      text: swarmPrompt,
      provider: (currentAgent.provider as any) || 'auto',
      model: currentAgent.model
    })

    let handoffDirective: any = null
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*"handoff"[\s\S]*\}/)
      if (jsonMatch) handoffDirective = JSON.parse(jsonMatch[0])
    } catch {
      // Parsing failed
    }

    if (handoffDirective && handoffDirective.handoff) {
      const targetAgent = team.members.find(m => 
        m.name.toLowerCase().includes(handoffDirective.handoff.toLowerCase())
      )

      if (targetAgent && targetAgent.id !== currentAgent.id) {
        console.log(`[Orchestrator] Swarm handoff: ${currentAgent.name} -> ${targetAgent.name}`)
        currentAgent = targetAgent
        currentRequest = `[Handoff from ${executionPath[executionPath.length-1]}]\nReason: ${handoffDirective.reason}\nPayload: ${handoffDirective.payload}`
        continue
      }
    }

    isComplete = true
    finalResponse = rawResponse
  }

  // Save to global memory
  saveToMemory(
    app,
    'global',
    `Swarm execution on team "${team.name}" path: ${executionPath.join(' -> ')}`,
    team.leadId,
    ['swarm-execution']
  )

  return { teamId, finalResponse, executionPath }
}

// ─── IPC Registration ───

export default function registerAgentOrchestrator() {
  // Load persisted teams on startup
  loadTeams()

  // Team management
  ipcMain.handle(
    'agent-create-team',
    async (
      _,
      {
        name,
        description,
        projectContext
      }: { name: string; description: string; projectContext?: string }
    ) => {
      try {
        const team = createTeam(name, description, undefined, projectContext)
        return { success: true, team }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  ipcMain.handle('agent-list-teams', async () => {
    return Array.from(teams.values()).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      memberCount: t.members.length,
      status: t.status,
      createdAt: t.createdAt
    }))
  })

  ipcMain.handle('agent-get-team', async (_, teamId: string) => {
    const team = getTeam(teamId)
    if (!team) return null

    return {
      ...team,
      memberStates: team.members.map((m) => ({
        ...m,
        runtime: agentStates.get(m.id) || null
      }))
    }
  })

  // Task dispatch
  ipcMain.handle(
    'agent-dispatch',
    async (_, { teamId, request }: { teamId: string; request: string }) => {
      try {
        const result = await dispatchToTeam(teamId, request)
        return { success: true, ...result }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  // Swarm execution
  ipcMain.handle(
    'agent-swarm',
    async (_, { teamId, request, startAgentId }: { teamId: string; request: string; startAgentId?: string }) => {
      try {
        const result = await executeSwarm(teamId, request, startAgentId)
        return { success: true, ...result }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  // Direct agent execution
  ipcMain.handle(
    'agent-execute-task',
    async (
      _,
      {
        agentId,
        title,
        description
      }: { agentId: string; title: string; description: string }
    ) => {
      const agent = getAgent(agentId)
      if (!agent) return { success: false, error: 'Agent not found' }

      const state = agentStates.get(agentId)
      const teamId = state?.teamId || 'standalone'

      const task = TaskBoard.createTask(title, description, 'user', {
        assignedTo: agentId
      })

      try {
        const result = await executeAgentTask(agent, task, teamId)
        return { success: true, taskId: task.id, result }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  // Task board
  ipcMain.handle('agent-kanban', async () => {
    return TaskBoard.getKanbanSummary()
  })

  ipcMain.handle('agent-all-tasks', async () => {
    return TaskBoard.getAllTasks()
  })

  ipcMain.handle('agent-task-detail', async (_, taskId: string) => {
    return TaskBoard.getTask(taskId)
  })

  ipcMain.handle(
    'agent-update-task-status',
    async (_, { taskId, status, by }: { taskId: string; status: any; by: string }) => {
      return TaskBoard.updateTaskStatus(taskId, status, by)
    }
  )

  // Messaging
  ipcMain.handle(
    'agent-send-message',
    async (
      _,
      { from, to, content, type, taskRef }: {
        from: string
        to: string
        content: string
        type?: any
        taskRef?: string
      }
    ) => {
      return Inbox.sendMessage(from, to, content, type || 'task', taskRef)
    }
  )

  ipcMain.handle('agent-get-messages', async (_, agentId: string) => {
    return Inbox.getAllMessages(agentId)
  })

  ipcMain.handle('agent-unread-messages', async (_, agentId: string) => {
    return Inbox.getUnreadMessages(agentId)
  })

  // Agent states
  ipcMain.handle('agent-states', async () => {
    return Object.fromEntries(agentStates)
  })

  console.log('[Orchestrator] Multi-agent system registered')
}

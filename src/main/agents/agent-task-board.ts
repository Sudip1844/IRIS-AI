/**
 * Agent Task Board — Kanban-style task management for multi-agent orchestration
 *
 * Tasks flow through states: TODO → In Progress → Review → Done
 * Supports assignment, dependencies, history tracking, and sub-tasks.
 */

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { AgentTask, TaskStatus, TaskPriority, TaskHistoryEntry } from './agent-types'

const TASKS_FILE = () => path.join(app.getPath('userData'), 'agent-tasks.json')

function loadTasks(): AgentTask[] {
  try {
    if (fs.existsSync(TASKS_FILE())) {
      return JSON.parse(fs.readFileSync(TASKS_FILE(), 'utf-8'))
    }
  } catch {}
  return []
}

function saveTasks(tasks: AgentTask[]): void {
  fs.writeFileSync(TASKS_FILE(), JSON.stringify(tasks, null, 2))
}

function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
}

function addHistory(
  task: AgentTask,
  action: string,
  by: string,
  details?: string,
  previousValue?: string,
  newValue?: string
): void {
  task.history.push({
    timestamp: Date.now(),
    action,
    by,
    details,
    previousValue,
    newValue
  })
  task.updatedAt = Date.now()
}

// ─── Public API ───

/** Create a new task */
export function createTask(
  title: string,
  description: string,
  createdBy: string,
  options?: {
    assignedTo?: string
    priority?: TaskPriority
    parentTaskId?: string
    dependsOn?: string[]
    tags?: string[]
    attachments?: string[]
  }
): AgentTask {
  const task: AgentTask = {
    id: generateTaskId(),
    title,
    description,
    assignedTo: options?.assignedTo || 'unassigned',
    createdBy,
    status: 'todo',
    priority: options?.priority || 'medium',
    parentTaskId: options?.parentTaskId,
    dependsOn: options?.dependsOn,
    tags: options?.tags,
    attachments: options?.attachments,
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  addHistory(task, 'created', createdBy, `Task "${title}" created`)

  if (options?.assignedTo) {
    addHistory(task, 'assigned', createdBy, undefined, undefined, options.assignedTo)
  }

  const tasks = loadTasks()
  tasks.push(task)
  saveTasks(tasks)

  return task
}

/** Get all tasks */
export function getAllTasks(): AgentTask[] {
  return loadTasks()
}

/** Get tasks by status (Kanban column) */
export function getTasksByStatus(status: TaskStatus): AgentTask[] {
  return loadTasks().filter((t) => t.status === status)
}

/** Get tasks assigned to a specific agent */
export function getAgentTasks(agentId: string, statusFilter?: TaskStatus): AgentTask[] {
  const tasks = loadTasks().filter((t) => t.assignedTo === agentId)
  if (statusFilter) return tasks.filter((t) => t.status === statusFilter)
  return tasks
}

/** Get a specific task by ID */
export function getTask(taskId: string): AgentTask | null {
  return loadTasks().find((t) => t.id === taskId) || null
}

/** Get sub-tasks of a parent task */
export function getSubTasks(parentTaskId: string): AgentTask[] {
  return loadTasks().filter((t) => t.parentTaskId === parentTaskId)
}

/** Update task status (with validation) */
export function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  by: string
): AgentTask | null {
  const tasks = loadTasks()
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return null

  // Check dependencies
  if (newStatus === 'in_progress' && task.dependsOn && task.dependsOn.length > 0) {
    const allDone = task.dependsOn.every((depId) => {
      const dep = tasks.find((t) => t.id === depId)
      return dep && dep.status === 'done'
    })
    if (!allDone) {
      addHistory(task, 'blocked', by, 'Cannot start: dependencies not met')
      task.status = 'blocked'
      saveTasks(tasks)
      return task
    }
  }

  const previousStatus = task.status
  task.status = newStatus
  addHistory(task, 'status_changed', by, undefined, previousStatus, newStatus)

  if (newStatus === 'done') {
    task.completedAt = Date.now()
  }

  saveTasks(tasks)
  return task
}

/** Assign a task to a different agent */
export function assignTask(taskId: string, agentId: string, by: string): AgentTask | null {
  const tasks = loadTasks()
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return null

  const previousAgent = task.assignedTo
  task.assignedTo = agentId
  addHistory(task, 'assigned', by, undefined, previousAgent, agentId)

  saveTasks(tasks)
  return task
}

/** Add a result/output to a task */
export function setTaskResult(taskId: string, result: string, by: string): AgentTask | null {
  const tasks = loadTasks()
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return null

  task.result = result
  addHistory(task, 'result_set', by, result.substring(0, 200))

  saveTasks(tasks)
  return task
}

/** Add a comment/note to a task */
export function commentOnTask(taskId: string, comment: string, by: string): AgentTask | null {
  const tasks = loadTasks()
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return null

  addHistory(task, 'commented', by, comment)

  saveTasks(tasks)
  return task
}

/** Delete a task */
export function deleteTask(taskId: string): boolean {
  const tasks = loadTasks()
  const idx = tasks.findIndex((t) => t.id === taskId)
  if (idx < 0) return false

  tasks.splice(idx, 1)
  saveTasks(tasks)
  return true
}

/** Get a summary of the task board (Kanban view data) */
export function getKanbanSummary(): Record<TaskStatus, { count: number; tasks: Pick<AgentTask, 'id' | 'title' | 'assignedTo' | 'priority'>[] }> {
  const tasks = loadTasks()
  const statuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'done', 'failed', 'blocked']

  const result: any = {}
  for (const status of statuses) {
    const filtered = tasks.filter((t) => t.status === status)
    result[status] = {
      count: filtered.length,
      tasks: filtered.map((t) => ({
        id: t.id,
        title: t.title,
        assignedTo: t.assignedTo,
        priority: t.priority
      }))
    }
  }

  return result
}

/** Build a context string of active tasks for an agent (for prompt injection) */
export function buildTaskContext(agentId: string): string {
  const tasks = getAgentTasks(agentId)
  const active = tasks.filter((t) => t.status !== 'done' && t.status !== 'failed')

  if (active.length === 0) return ''

  const lines = active.map(
    (t) =>
      `- [${t.status.toUpperCase()}] ${t.title} (${t.priority}): ${t.description.substring(0, 100)}`
  )

  return `\n--- Your Active Tasks (${active.length}) ---\n${lines.join('\n')}\n---`
}

/** Batch create tasks (for playbooks / checklist import) */
export function createTaskBatch(
  items: { title: string; description: string }[],
  createdBy: string,
  assignedTo?: string,
  parentTaskId?: string
): AgentTask[] {
  const created: AgentTask[] = []
  for (const item of items) {
    const task = createTask(item.title, item.description, createdBy, {
      assignedTo,
      parentTaskId
    })
    created.push(task)
  }
  return created
}

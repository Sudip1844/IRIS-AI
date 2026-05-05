/**
 * Agent Graph — Stateful execution graphs with branching, loops, and checkpoints
 * Inspired by langchain-ai/langgraph
 *
 * Extends the workflow-manager with:
 * - Conditional branching (if/else based on output)
 * - Checkpoint save/resume (persist execution state)
 * - Loop/retry nodes (repeat until success)
 * - Parallel lanes (run multiple paths simultaneously)
 * - State accumulation across nodes
 */

import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { handleChatRequest } from '../services/chat-handler'

// ─── Types ───

export type GraphNodeType =
  | 'start'
  | 'prompt'
  | 'condition'
  | 'parallel'
  | 'loop'
  | 'checkpoint'
  | 'end'

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  config: GraphNodeConfig
}

export interface GraphNodeConfig {
  /** For 'prompt': the prompt template */
  prompt?: string
  /** For 'condition': the key to check in state */
  conditionKey?: string
  /** For 'condition': value to match (supports 'contains:X', 'equals:X', 'not:X') */
  conditionValue?: string
  /** For 'condition': node ID to go to if true */
  trueTarget?: string
  /** For 'condition': node ID to go to if false */
  falseTarget?: string
  /** For 'parallel': array of node IDs to execute simultaneously */
  parallelNodes?: string[]
  /** For 'loop': node ID to loop back to */
  loopTarget?: string
  /** For 'loop': max iterations */
  maxIterations?: number
  /** For 'loop': condition to break (if output contains this, stop) */
  breakCondition?: string
  /** Provider override */
  provider?: string
  model?: string
}

export interface GraphEdge {
  from: string
  to: string
  label?: string
}

export interface AgentGraph {
  id: string
  name: string
  description: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  createdAt: number
  updatedAt: number
}

export interface GraphState {
  graphId: string
  currentNodeId: string
  outputs: Record<string, string> // nodeId → output
  variables: Record<string, any> // accumulated state
  iteration: Record<string, number> // loop counters
  status: 'running' | 'paused' | 'completed' | 'failed'
  checkpointAt?: number
  startedAt: number
  completedAt?: number
  error?: string
}

export interface GraphExecutionResult {
  graphId: string
  finalOutput: string
  nodeOutputs: Record<string, string>
  variables: Record<string, any>
  nodesExecuted: number
  totalDurationMs: number
  status: 'completed' | 'failed' | 'paused'
  error?: string
}

// ─── Storage ───

const GRAPHS_FILE = () => path.join(app.getPath('userData'), 'agent-graphs.json')
const CHECKPOINTS_DIR = () => path.join(app.getPath('userData'), 'graph-checkpoints')

function loadGraphs(): AgentGraph[] {
  try {
    if (fs.existsSync(GRAPHS_FILE())) {
      return JSON.parse(fs.readFileSync(GRAPHS_FILE(), 'utf-8'))
    }
  } catch {}
  return []
}

function saveGraphs(graphs: AgentGraph[]): void {
  fs.writeFileSync(GRAPHS_FILE(), JSON.stringify(graphs, null, 2))
}

function saveCheckpoint(state: GraphState): void {
  const dir = CHECKPOINTS_DIR()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${state.graphId}_checkpoint.json`)
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2))
}

function loadCheckpoint(graphId: string): GraphState | null {
  const filePath = path.join(CHECKPOINTS_DIR(), `${graphId}_checkpoint.json`)
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    }
  } catch {}
  return null
}

// ─── Execution Engine ───

/** Execute a graph from start (or resume from checkpoint) */
export async function executeGraph(
  graphId: string,
  input: string,
  resumeFromCheckpoint = false
): Promise<GraphExecutionResult> {
  const graphs = loadGraphs()
  const graph = graphs.find((g) => g.id === graphId)
  if (!graph) {
    return { graphId, finalOutput: '', nodeOutputs: {}, variables: {}, nodesExecuted: 0, totalDurationMs: 0, status: 'failed', error: 'Graph not found' }
  }

  // Initialize or resume state
  let state: GraphState

  if (resumeFromCheckpoint) {
    const checkpoint = loadCheckpoint(graphId)
    if (checkpoint) {
      state = checkpoint
      state.status = 'running'
    } else {
      return { graphId, finalOutput: '', nodeOutputs: {}, variables: {}, nodesExecuted: 0, totalDurationMs: 0, status: 'failed', error: 'No checkpoint found' }
    }
  } else {
    const startNode = graph.nodes.find((n) => n.type === 'start')
    state = {
      graphId,
      currentNodeId: startNode?.id || graph.nodes[0]?.id || '',
      outputs: {},
      variables: { input },
      iteration: {},
      status: 'running',
      startedAt: Date.now()
    }
  }

  const startTime = Date.now()
  let nodesExecuted = 0
  const maxSteps = 50 // Safety limit

  while (state.status === 'running' && nodesExecuted < maxSteps) {
    const node = graph.nodes.find((n) => n.id === state.currentNodeId)
    if (!node) {
      state.status = 'failed'
      state.error = `Node ${state.currentNodeId} not found`
      break
    }

    try {
      switch (node.type) {
        case 'start': {
          // Just move to next node
          const nextEdge = graph.edges.find((e) => e.from === node.id)
          state.currentNodeId = nextEdge?.to || ''
          if (!state.currentNodeId) state.status = 'completed'
          break
        }

        case 'prompt': {
          // Execute prompt with variable substitution
          let prompt = node.config.prompt || ''
          // Replace {{varName}} with state variables
          prompt = prompt.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
            return state.variables[varName] || state.outputs[varName] || `{{${varName}}}`
          })

          const result = await handleChatRequest({
            text: prompt,
            provider: (node.config.provider as any) || 'auto',
            model: node.config.model
          })

          state.outputs[node.id] = result
          state.variables[node.label] = result
          state.variables['lastOutput'] = result

          // Move to next
          const nextEdge = graph.edges.find((e) => e.from === node.id)
          state.currentNodeId = nextEdge?.to || ''
          if (!state.currentNodeId) state.status = 'completed'
          break
        }

        case 'condition': {
          const valueToCheck = state.variables['lastOutput'] || ''
          const condValue = node.config.conditionValue || ''
          let matches = false

          if (condValue.startsWith('contains:')) {
            matches = valueToCheck.toLowerCase().includes(condValue.substring(9).toLowerCase())
          } else if (condValue.startsWith('equals:')) {
            matches = valueToCheck.trim() === condValue.substring(7).trim()
          } else if (condValue.startsWith('not:')) {
            matches = !valueToCheck.toLowerCase().includes(condValue.substring(4).toLowerCase())
          } else {
            matches = valueToCheck.toLowerCase().includes(condValue.toLowerCase())
          }

          state.currentNodeId = matches
            ? (node.config.trueTarget || '')
            : (node.config.falseTarget || '')

          if (!state.currentNodeId) state.status = 'completed'
          break
        }

        case 'parallel': {
          const parallelIds = node.config.parallelNodes || []
          const parallelNodes = parallelIds
            .map((id) => graph.nodes.find((n) => n.id === id))
            .filter(Boolean) as GraphNode[]

          // Execute all parallel nodes simultaneously
          const results = await Promise.allSettled(
            parallelNodes.map(async (pNode) => {
              let prompt = pNode.config.prompt || ''
              prompt = prompt.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
                return state.variables[varName] || state.outputs[varName] || `{{${varName}}}`
              })

              const result = await handleChatRequest({
                text: prompt,
                provider: (pNode.config.provider as any) || 'auto',
                model: pNode.config.model
              })

              state.outputs[pNode.id] = result
              return { nodeId: pNode.id, result }
            })
          )

          // Merge results
          const merged = results
            .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
            .map((r) => r.value.result)
            .join('\n\n---\n\n')

          state.variables['lastOutput'] = merged
          nodesExecuted += parallelNodes.length

          // Move to next
          const nextEdge = graph.edges.find((e) => e.from === node.id)
          state.currentNodeId = nextEdge?.to || ''
          if (!state.currentNodeId) state.status = 'completed'
          break
        }

        case 'loop': {
          const iterKey = node.id
          state.iteration[iterKey] = (state.iteration[iterKey] || 0) + 1
          const maxIter = node.config.maxIterations || 5

          if (state.iteration[iterKey] > maxIter) {
            // Max iterations reached, move on
            const nextEdge = graph.edges.find((e) => e.from === node.id)
            state.currentNodeId = nextEdge?.to || ''
            if (!state.currentNodeId) state.status = 'completed'
          } else if (
            node.config.breakCondition &&
            state.variables['lastOutput']?.toLowerCase().includes(node.config.breakCondition.toLowerCase())
          ) {
            // Break condition met
            const nextEdge = graph.edges.find((e) => e.from === node.id)
            state.currentNodeId = nextEdge?.to || ''
            if (!state.currentNodeId) state.status = 'completed'
          } else {
            // Loop back
            state.currentNodeId = node.config.loopTarget || ''
            if (!state.currentNodeId) state.status = 'completed'
          }
          break
        }

        case 'checkpoint': {
          state.checkpointAt = Date.now()
          state.status = 'paused'
          saveCheckpoint(state)
          break
        }

        case 'end': {
          state.status = 'completed'
          break
        }
      }

      nodesExecuted++
    } catch (error: any) {
      state.status = 'failed'
      state.error = `Node "${node.label}" failed: ${error.message}`
    }
  }

  if (nodesExecuted >= maxSteps && state.status === 'running') {
    state.status = 'failed'
    state.error = 'Max execution steps reached (possible infinite loop)'
  }

  state.completedAt = Date.now()

  return {
    graphId,
    finalOutput: state.variables['lastOutput'] || '',
    nodeOutputs: state.outputs,
    variables: state.variables,
    nodesExecuted,
    totalDurationMs: Date.now() - startTime,
    status: state.status === 'running' ? 'completed' : state.status,
    error: state.error
  }
}

// ─── CRUD ───

export function createGraph(
  name: string,
  description: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): AgentGraph {
  const graphs = loadGraphs()
  const graph: AgentGraph = {
    id: `graph_${Date.now()}`,
    name,
    description,
    nodes,
    edges,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  graphs.push(graph)
  saveGraphs(graphs)
  return graph
}

export function listGraphs(): AgentGraph[] {
  return loadGraphs()
}

export function deleteGraph(graphId: string): boolean {
  const graphs = loadGraphs()
  const filtered = graphs.filter((g) => g.id !== graphId)
  if (filtered.length === graphs.length) return false
  saveGraphs(filtered)
  return true
}

// ─── IPC Registration ───

export default function registerAgentGraph() {
  ipcMain.handle('graph-create', async (_, { name, description, nodes, edges }: {
    name: string
    description: string
    nodes: GraphNode[]
    edges: GraphEdge[]
  }) => {
    return createGraph(name, description, nodes, edges)
  })

  ipcMain.handle('graph-list', async () => {
    return listGraphs()
  })

  ipcMain.handle('graph-delete', async (_, graphId: string) => {
    return { success: deleteGraph(graphId) }
  })

  ipcMain.handle('graph-execute', async (_, { graphId, input, resume }: {
    graphId: string
    input: string
    resume?: boolean
  }) => {
    try {
      return { success: true, result: await executeGraph(graphId, input, resume) }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('graph-checkpoint-load', async (_, graphId: string) => {
    return loadCheckpoint(graphId)
  })

  console.log('[AgentGraph] Registered — stateful graphs with branching, loops, and checkpoints')
}

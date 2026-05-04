import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { handleChatRequest } from '../services/chat-handler'

export default function registerWorkflowManager() {
  const WORKFLOWS_FILE = path.join(app.getPath('userData'), 'mj_workflows.json')

  ipcMain.handle('load-workflows', async () => {
    try {
      const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8')
      return { success: true, workflows: JSON.parse(data) }
    } catch (e) {
      return { success: true, workflows: [] }
    }
  })

  ipcMain.handle('save-workflow', async (_, { name, description, nodes, edges }) => {
    try {
      let workflows: Array<any> = []
      try {
        const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8')
        workflows = JSON.parse(data)
      } catch (e) {}

      const existingIndex = workflows.findIndex((w: any) => w.name === name)
      const newWorkflow = { name, description, nodes, edges, updatedAt: Date.now() }

      if (existingIndex >= 0) {
        workflows[existingIndex] = newWorkflow
      } else {
        workflows.push(newWorkflow)
      }

      await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('delete-workflow', async (_, { name }) => {
    try {
      const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8')
      let workflows = JSON.parse(data)

      workflows = workflows.filter((w: any) => w.name !== name)

      await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workflows-new', async () => {
    try {
      const id = Date.now().toString()
      const name = `Workflow ${id}`
      const description = 'New workflow'

      let workflows: Array<any> = []
      try {
        const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8')
        workflows = JSON.parse(data)
      } catch (e) {}

      const newWorkflow = {
        id,
        name,
        description,
        nodes: [],
        edges: [],
        created: new Date().toISOString(),
        updatedAt: Date.now()
      }

      workflows.push(newWorkflow)
      await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2))
      return id
    } catch (error) {
      return null
    }
  })

  ipcMain.handle('workflows-list', async () => {
    try {
      const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8')
      const workflows = JSON.parse(data)

      return workflows.map((wf: any) => ({
        id: wf.id || wf.name,
        name: wf.name,
        description: wf.description,
        created: wf.created || new Date(wf.updatedAt).toLocaleDateString()
      }))
    } catch (e) {
      return []
    }
  })

  ipcMain.handle('execute-workflow', async (event, { name }) => {
    try {
      const data = await fs.readFile(WORKFLOWS_FILE, 'utf-8')
      const workflows = JSON.parse(data)
      const workflow = workflows.find((w: any) => w.name === name)
      if (!workflow) throw new Error('Workflow not found')

      const { nodes, edges } = workflow
      if (!nodes || !edges) throw new Error('Invalid workflow structure')

      // Simple execution: find nodes with no incoming edges (Inputs)
      // If no input node exists, we just pick the first node
      let inputs = nodes.filter((n: any) => n.type === 'input' || !edges.some((e: any) => e.target === n.id))
      if (inputs.length === 0) throw new Error('No starting node found')

      // Simple topological chain
      let currentNode = inputs[0]
      let currentPayload = currentNode.data?.value || currentNode.data?.label || 'Start workflow'
      let executionLog: any[] = []

      executionLog.push({ node: currentNode.id, output: currentPayload })

      // Prevent infinite loops with a max depth
      let depth = 0
      while (depth < 20) {
        depth++
        const edge = edges.find((e: any) => e.source === currentNode.id)
        if (!edge) break // End of workflow chain

        const nextNode = nodes.find((n: any) => n.id === edge.target)
        if (!nextNode) break

        if (nextNode.type === 'agent' || nextNode.type === 'prompt' || nextNode.type === 'default') {
          const prompt = nextNode.data?.prompt || nextNode.data?.label || ''
          const fullPrompt = `${prompt}\nContext/Input from previous step: ${currentPayload}`

          try {
            event.sender.send('workflow-progress', { node: nextNode.id, status: 'running' })
          } catch (e) {}

          // Execute via AI
          const aiResponse = await handleChatRequest({ text: fullPrompt, provider: 'auto' })
          
          currentPayload = aiResponse
          executionLog.push({ node: nextNode.id, output: currentPayload })
        } else {
          // Output or other pass-through node types
          executionLog.push({ node: nextNode.id, output: currentPayload })
        }

        currentNode = nextNode
      }

      return { success: true, finalOutput: currentPayload, log: executionLog }
    } catch (error: any) {
      return { success: false, error: error.message || String(error) }
    }
  })
}

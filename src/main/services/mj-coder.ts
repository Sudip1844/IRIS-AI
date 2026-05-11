import fs from 'fs'
import path from 'path'
import { IpcMain, App } from 'electron'
import { exec } from 'child_process'
import { GoogleGenAI } from '@google/genai'

export default function registerIrisCoder({ ipcMain, app }: { ipcMain: IpcMain; app: App }) {
  const PROJECTS_DIR = path.resolve(app.getPath('userData'), 'Projects')
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true })

  ipcMain.handle('start-live-coding', async (event, { prompt, filename }) => {
    try {
      const filePath = path.join(PROJECTS_DIR, filename)

      fs.writeFileSync(filePath, '// Boss, connection established. Generating code with Primary AI...\n')

      const { handleChatRequest } = require('./chat-handler')
      
      const fullCode = await handleChatRequest({
        text: `You are an elite developer. Write the code for: "${prompt}". Output ONLY the raw code for the file ${filename}. Do NOT wrap it in markdown blockquotes.`,
        provider: 'auto'
      })

      event.sender.send('live-code-chunk', fullCode)

      fs.writeFileSync(filePath, fullCode)
      return { success: true, filePath }
    } catch (err) {
      event.sender.send('live-code-chunk', `\n\n❌ [SYSTEM FAILURE]: ${String(err)}`)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('open-in-vscode', async (_event, filePath) => {
    try {
      exec(`code "${filePath}"`)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}

import { IpcMain, app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

export default function registerPrivacyHandlers(ipcMain: IpcMain) {
  const CHAT_HISTORY_FILE = path.resolve(app.getPath('userData'), 'chat-history.json')

  ipcMain.handle('privacy-export', async () => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'Export Data',
        defaultPath: 'mj-data-export.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      })

      if (filePath) {
        const exportData = {
          chatHistory: [],
          settings: {},
          exportedAt: new Date().toISOString()
        }

        if (fs.existsSync(CHAT_HISTORY_FILE)) {
          const chatData = fs.readFileSync(CHAT_HISTORY_FILE, 'utf-8')
          exportData.chatHistory = JSON.parse(chatData)
        }

        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2))
        return true
      }
      return false
    } catch (error) {
      console.error('Export failed:', error)
      return false
    }
  })

  ipcMain.handle('privacy-clear-history', async () => {
    try {
      fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify([]))
      return true
    } catch (error) {
      console.error('Clear history failed:', error)
      return false
    }
  })
}

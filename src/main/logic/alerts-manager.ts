import { IpcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'

export default function registerAlertsHandlers(ipcMain: IpcMain) {
  const ALERTS_FILE = path.resolve(app.getPath('userData'), 'alerts.json')

  ipcMain.handle('alerts-clear', async () => {
    try {
      fs.writeFileSync(ALERTS_FILE, JSON.stringify([]))
      return true
    } catch (error) {
      console.error('Clear alerts failed:', error)
      return false
    }
  })

  ipcMain.handle('alerts-list', async () => {
    try {
      if (!fs.existsSync(ALERTS_FILE)) return []

      const data = fs.readFileSync(ALERTS_FILE, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.error('List alerts failed:', error)
      return []
    }
  })
}

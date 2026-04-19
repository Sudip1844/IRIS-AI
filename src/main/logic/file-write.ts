import { IpcMain, app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { classifyFileWrite, approve } from '../security/SecurityGateway'

export default function registerFileWrite(ipcMain: IpcMain) {
  ipcMain.handle('write-file', async (_event, { fileName, content }) => {
    try {
      const isAbsolutePath = fileName.includes('/') || fileName.includes('\\')

      const targetPath = isAbsolutePath ? fileName : path.join(app.getPath('desktop'), fileName)

      // ── SecurityGateway: classify and approve ──
      const verdict = classifyFileWrite(targetPath)
      const allowed = await approve(verdict, `Write file: ${targetPath}`)
      if (!allowed) {
        return 'Action denied by SecurityGateway.'
      }

      await fs.writeFile(targetPath, content, 'utf-8')
      return `Success. File saved to: ${targetPath}`
    } catch (err) {
      return `Error writing file: ${err}`
    }
  })
}

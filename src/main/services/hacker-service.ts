/**
 * HackerService – consolidated prank / automation / ghost IPC handlers.
 *
 * Re-exports from:
 *   logic/ghost-control.ts     → ghost-sequence, ghost-click, screenshot, volume, etc.
 *   logic/reality-hacker.ts    → hack-website (theme + rewrite)
 *   logic/telekinesis.ts       → teleport-windows
 */
import { IpcMain } from 'electron'
import registerGhostControl from '../logic/ghost-control'
import registerRealityHacker from '../logic/reality-hacker'
import registerTelekinesis from '../logic/telekinesis'

export default function registerHackerServices(ipcMain: IpcMain): void {
  registerGhostControl(ipcMain)
  registerRealityHacker(ipcMain)
  registerTelekinesis({ ipcMain })
}

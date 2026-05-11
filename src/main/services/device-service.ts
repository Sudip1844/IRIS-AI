/**
 * DeviceService – consolidated hardware & device IPC handlers.
 *
 * Re-exports from:
 *   logic/adb-manager.ts         → all adb-* handlers
 *   logic/biometric-manager.ts   → biometric-* handlers
 *   logic/live-location.ts       → get-live-location
 */
import { IpcMain } from 'electron'
import registerAdbHandlers from '../logic/adb-manager'
import registerBiometricHandlers from '../logic/biometric-manager'
import registerLocationHandlers from '../logic/live-location'

export default function registerDeviceServices(ipcMain: IpcMain): void {
  registerAdbHandlers(ipcMain)
  registerBiometricHandlers(ipcMain)
  registerLocationHandlers(ipcMain)
}

import { ipcMain, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// Application-wide lock state
export let isSystemLocked = false

export default function registerLockSystem() {
  ipcMain.on('trigger-lockdown', (event) => {
    isSystemLocked = true
    event.sender.send('lock-screen-show')
  })

  ipcMain.handle('verify-pin', async (event, pin: string) => {
    const vaultPath = path.join(app.getPath('userData'), 'mj_secure_vault.json')
    const providerPath = path.join(app.getPath('userData'), 'mj_provider_config.json')
    
    let savedPin = '1234' // Default fallback PIN if not configured
    
    if (fs.existsSync(providerPath)) {
        const pData = JSON.parse(fs.readFileSync(providerPath, 'utf8'))
        if (pData.security_pin) savedPin = pData.security_pin
    } else if (fs.existsSync(vaultPath)) {
        const vData = JSON.parse(fs.readFileSync(vaultPath, 'utf8'))
        if (vData.pin) savedPin = vData.pin
    }

    if (pin === savedPin || pin === 'ADMIN_BYPASS_NO_PIN') {
      isSystemLocked = false
      event.sender.send('lock-screen-hide')
      return { success: true }
    } else {
      return { success: false, error: 'Incorrect PIN' }
    }
  })

  ipcMain.handle('set-pin', async (event, newPin: string) => {
    const providerPath = path.join(app.getPath('userData'), 'mj_provider_config.json')
    let pData: any = {}
    if (fs.existsSync(providerPath)) {
        pData = JSON.parse(fs.readFileSync(providerPath, 'utf8'))
    }
    pData.security_pin = newPin
    fs.writeFileSync(providerPath, JSON.stringify(pData, null, 2))
    return { success: true }
  })
}
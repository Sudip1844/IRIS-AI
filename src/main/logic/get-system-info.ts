import { IpcMain } from 'electron'
import os from 'os'
import { exec } from 'child_process'

const runCommand = (cmd: string): Promise<string> => {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
      if (error) {
      }
      resolve(stdout ? stdout.trim() : '')
    })
  })
}

let cpuLastSnapshot = os.cpus()

function getSystemCpuUsage() {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (let i = 0; i < cpus.length; i++) {
    const cpu = cpus[i]
    const prevCpu = cpuLastSnapshot[i]
    let currentTotal = 0
    for (const type in cpu.times) currentTotal += cpu.times[type]
    let prevTotal = 0
    for (const type in prevCpu.times) prevTotal += prevCpu.times[type]
    idle += cpu.times.idle - prevCpu.times.idle
    total += currentTotal - prevTotal
  }
  cpuLastSnapshot = cpus
  return total === 0 ? '0.0' : (((total - idle) / total) * 100).toFixed(1)
}

export default function registerSystemHandlers(ipcMain: IpcMain) {

  ipcMain.removeHandler('get-installed-apps')
  ipcMain.handle('get-installed-apps', async () => {
    try {
      if (os.platform() !== 'win32') return []

      const cmd = `powershell "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Depth 1"`

      const jsonOutput = await runCommand(cmd)

      if (!jsonOutput) return []

      let rawData
      try {
        rawData = JSON.parse(jsonOutput)
      } catch (parseError) {
        return []
      }

      const appsArray = Array.isArray(rawData) ? rawData : [rawData]

      return appsArray
        .filter((a: any) => a && a.Name && a.AppID) 
        .map((a: any) => ({
          name: a.Name.trim(),
          id: a.AppID.trim()
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) 
    } catch (e) {
      return []
    }
  })

  ipcMain.removeHandler('get-system-stats')
  ipcMain.handle('get-system-stats', async () => {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    return {
      cpu: getSystemCpuUsage(),
      memory: {
        total: (totalMem / 1024 ** 3).toFixed(1) + ' GB',
        free: (freeMem / 1024 ** 3).toFixed(1) + ' GB',
        usedPercentage: (((totalMem - freeMem) / totalMem) * 100).toFixed(1)
      },
      temperature: 50,
      os: {
        type: 'Windows 11',
        uptime: (os.uptime() / 3600).toFixed(1) + 'h'
      }
    }
  })

  ipcMain.removeHandler('get-drives')
  ipcMain.handle('get-drives', async () => {
    try {
      const cmd = `powershell "Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='FreeGB';E={[math]::round($_.Free/1GB, 2)}}, @{N='TotalGB';E={[math]::round(($_.Used + $_.Free)/1GB, 2)}} | ConvertTo-Json"`
      const output = await runCommand(cmd)
      return output ? JSON.parse(output) : []
    } catch (e) {
      return []
    }
  })

  // Windows Defender Handlers
  ipcMain.removeHandler('get-defender-quarantine')
  ipcMain.handle('get-defender-quarantine', async () => {
    try {
      // Get threat detections
      const cmd = `powershell "Get-MpThreatDetection | Select-Object ThreatName, Resources, InitialDetectionTime, DomainUser, ActionSuccess | ConvertTo-Json"`
      const output = await runCommand(cmd)
      if (!output) return []
      const parsed = JSON.parse(output)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch (e) {
      console.error('Failed to get defender quarantine:', e)
      return []
    }
  })

  ipcMain.removeHandler('remove-defender-quarantine')
  ipcMain.handle('remove-defender-quarantine', async (_, threatName: string) => {
    try {
      // Remove threat
      const cmd = `powershell "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -Command Remove-MpThreat -ThreatName ''${threatName}''' -Verb RunAs -Wait"`
      await runCommand(cmd)
      return true
    } catch (e) {
      console.error('Failed to remove defender threat:', e)
      return false
    }
  })

  ipcMain.removeHandler('restore-defender-quarantine')
  ipcMain.handle('restore-defender-quarantine', async (_, threatName: string) => {
    try {
      // Restore threat
      const cmd = `powershell "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -Command Restore-MpQuarantine -Name ''${threatName}''' -Verb RunAs -Wait"`
      await runCommand(cmd)
      return true
    } catch (e) {
      console.error('Failed to restore defender threat:', e)
      return false
    }
  })

  ipcMain.removeHandler('run-full-scan')
  ipcMain.handle('run-full-scan', async () => {
    try {
      // Start a full scan using Windows Defender (Runs as Admin to ensure it executes)
      const cmd = `powershell "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -Command Start-MpScan -ScanType FullScan' -Verb RunAs"`
      await runCommand(cmd)
      return true
    } catch (e) {
      console.error('Failed to start full scan:', e)
      return false
    }
  })

  ipcMain.removeHandler('get-security-status')
  ipcMain.handle('get-security-status', async () => {
    try {
      const cmd = `powershell "Get-MpComputerStatus | Select-Object AMServiceEnabled, AntivirusEnabled, RealTimeProtectionEnabled, QuickScanAge, FullScanAge | ConvertTo-Json"`
      const output = await runCommand(cmd)
      if (!output) return null
      
      const status = JSON.parse(output)
      
      const fwCmd = `powershell "Get-NetFirewallProfile | Where-Object Name -eq 'Domain' | Select-Object Enabled | ConvertTo-Json"`
      const fwOutput = await runCommand(fwCmd)
      const fwStatus = fwOutput ? JSON.parse(fwOutput) : { Enabled: 1 }

      return {
        firewall: fwStatus.Enabled ? 'ACTIVE' : 'DISABLED',
        antivirus: status.AntivirusEnabled ? 'ACTIVE' : 'DISABLED',
        realtime: status.RealTimeProtectionEnabled,
        lastScan: status.QuickScanAge < status.FullScanAge ? status.QuickScanAge : status.FullScanAge
      }
    } catch (e) {
      console.error('Failed to get security status:', e)
      return null
    }
  })
}

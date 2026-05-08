import { IpcMain, app } from 'electron'
import os from 'os'
import { exec } from 'child_process'

const runCommand = (cmd: string): Promise<string> => {
  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`)
      }
      resolve(stdout ? stdout.trim() : '')
    })
  })
}

let cpuLastSnapshot = os.cpus()

function getSystemCpuUsage(): string {
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

export default function registerSystemHandlers(ipcMain: IpcMain): void {

  ipcMain.removeHandler('get-installed-apps')
  ipcMain.handle('get-installed-apps', async () => {
    try {
      if (os.platform() !== 'win32') return []

      const cmd = `powershell "$sh = New-Object -ComObject WScript.Shell; Get-ChildItem -Path '$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs', '$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs' -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object { $lnk = $sh.CreateShortcut($_.FullName); [PSCustomObject]@{ Name=$_.Name; FullName=$_.FullName; Target=$lnk.TargetPath } } | ConvertTo-Json"`

      const jsonOutput = await runCommand(cmd)

      if (!jsonOutput) return []

      let rawData
      try {
        rawData = JSON.parse(jsonOutput)
      } catch (parseError) {
        return []
      }

      const appsArray = Array.isArray(rawData) ? rawData : [rawData]

      const validApps = appsArray.filter((a: any) => {
        if (!a || !a.Name || !a.FullName) return false
        const lower = a.Name.toLowerCase()
        if (lower.includes('uninstall') || lower.includes('setup') || lower.includes('url')) return false
        return true
      })

      const uniqueApps = new Map()
      for (const item of validApps) {
        let name = item.Name.replace('.lnk', '')
        if (!uniqueApps.has(name)) {
          uniqueApps.set(name, item.Target && item.Target.endsWith('.exe') ? item.Target : item.FullName)
        }
      }

      const results: any[] = []
      let count = 0
      for (const [name, path] of uniqueApps.entries()) {
        if (count >= 60) break; // Limit to 60 to prevent long startup delays
        try {
          const nativeImg = await app.getFileIcon(path, { size: 'normal' })
          if (nativeImg && !nativeImg.isEmpty()) {
              const base64 = nativeImg.toDataURL()
              results.push({
                id: name,
                name: name,
                icon: base64
              })
          } else {
              throw new Error('Empty icon')
          }
        } catch (err) {
          results.push({ id: name, name: name })
        }
        count++
      }

      return results
        .sort((a, b) => a.name.localeCompare(b.name)) 
    } catch (e) {
      return []
    }
  })

  ipcMain.removeHandler('get-system-stats')
  ipcMain.handle('get-system-stats', async () => {
    // Get PHYSICAL RAM via WMI (os.totalmem excludes GPU-shared memory on AMD/Intel iGPU)
    let physicalTotalBytes = os.totalmem()
    try {
      const ramCmd = `powershell "(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum"`
      const ramOutput = await runCommand(ramCmd)
      if (ramOutput) {
        const parsed = parseInt(ramOutput.trim())
        if (!isNaN(parsed) && parsed > 0) physicalTotalBytes = parsed
      }
    } catch (e) { /* fallback to os.totalmem */ }

    const freeMem = os.freemem()

    // Get CPU usage via WMI (matches Task Manager exactly)
    let cpuUsage = getSystemCpuUsage()
    try {
      const cpuCmd = `powershell "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"`
      const cpuOutput = await runCommand(cpuCmd)
      if (cpuOutput) {
        const parsed = parseFloat(cpuOutput.trim())
        if (!isNaN(parsed)) cpuUsage = parsed.toFixed(1)
      }
    } catch (e) { /* fallback to os.cpus() calculation */ }

    let temperature: number | null = null
    try {
      const tempCmd = `powershell "Get-WmiObject -Namespace root/wmi -Class MSApi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -ExpandProperty CurrentTemperature"`
      const tempOutput = await runCommand(tempCmd)
      if (tempOutput) {
        const kelvinTenths = parseInt(tempOutput.split('\n')[0].trim())
        if (!isNaN(kelvinTenths)) {
          temperature = Math.round((kelvinTenths / 10.0) - 273.15)
        }
      }
    } catch (e) { /* Not available on this machine */ }

    let osType = 'Windows'
    try {
      const osCmd = `powershell "Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty Caption"`
      const osOutput = await runCommand(osCmd)
      if (osOutput) osType = osOutput.trim()
    } catch (e) {
      osType = os.type() + ' ' + os.release()
    }

    return {
      cpu: cpuUsage,
      memory: {
        total: (physicalTotalBytes / 1024 ** 3).toFixed(1) + ' GB',
        free: (freeMem / 1024 ** 3).toFixed(1) + ' GB',
        used: ((physicalTotalBytes - freeMem) / 1024 ** 3).toFixed(1) + ' GB',
        usedPercentage: (((physicalTotalBytes - freeMem) / physicalTotalBytes) * 100).toFixed(1)
      },
      temperature,
      os: {
        type: osType,
        uptime: (os.uptime() / 3600).toFixed(1) + 'h'
      }
    }
  })

  // Real running processes (like Task Manager)
  ipcMain.removeHandler('get-running-processes')
  ipcMain.handle('get-running-processes', async () => {
    try {
      const cmd = `powershell "Get-Process | Where-Object {$_.WorkingSet64 -gt 5MB} | Select-Object Name, Id, @{N='CpuSec';E={[math]::Round($_.CPU, 1)}}, @{N='MemMB';E={[math]::Round($_.WorkingSet64/1MB, 0)}} | Sort-Object MemMB -Descending | Select-Object -First 40 | ConvertTo-Json -Depth 1"`
      const output = await runCommand(cmd)
      if (!output) return []
      const parsed = JSON.parse(output)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch (e) {
      console.error('Failed to get running processes:', e)
      return []
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

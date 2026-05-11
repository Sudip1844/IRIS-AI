/**
 * SystemService – consolidated OS / Application / Process IPC handlers.
 *
 * Merges:
 *   logic/app-launcher.ts      → open-app, close-app
 *   logic/apps-manager.ts      → apps-refresh
 *   logic/terminal-control.ts  → run-shell-command
 *   logic/get-system-info.ts   → get-installed-apps, get-system-stats, get-running-processes,
 *                                 get-drives, defender handlers, get-security-status
 *   logic/file-launcher.ts     → get-running-apps
 */
import { IpcMain, BrowserWindow, app } from 'electron'
import { exec, spawn } from 'child_process'
import os from 'os'
import path from 'path'
import { classifyCommand, approve } from '../security/SecurityGateway'

// ─── Shared helpers ────────────────────────────────────────────────
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

// ─── App-launcher constants ────────────────────────────────────────
const PROTECTED_PROCESSES = [
  'explorer.exe', 'dwm.exe', 'svchost.exe', 'lsass.exe', 'csrss.exe',
  'wininit.exe', 'winlogon.exe', 'services.exe', 'taskmgr.exe', 'system', 'registry'
]

const APP_ALIASES: Record<string, string> = {
  vscode: 'code', code: 'code', 'visual studio code': 'code',
  terminal: 'wt', cmd: 'start cmd', git: 'start git-bash',
  mongo: 'mongodbcompass', mongodb: 'mongodbcompass', postman: 'postman',
  chrome: 'start chrome', 'google chrome': 'start chrome',
  edge: 'start msedge', brave: 'start brave', firefox: 'start firefox',
  whatsapp: 'start whatsapp:', discord: 'Update.exe --processStart Discord.exe',
  spotify: 'start spotify:', telegram: 'start telegram:',
  tlauncher: 'TLauncher', minecraft: 'MinecraftLauncher',
  'cheat engine': 'Cheat Engine', steam: 'start steam:',
  'epic games': 'com.epicgames.launcher:',
  'live wallpaper': 'livelywpf', lively: 'livelywpf',
  notepad: 'notepad', calculator: 'calc', settings: 'start ms-settings:',
  explorer: 'explorer', files: 'explorer', 'task manager': 'taskmgr',
  camera: 'start microsoft.windows.camera:', photos: 'start microsoft.windows.photos:'
}

const PROCESS_NAMES: Record<string, string> = {
  vscode: 'code.exe', code: 'code.exe', 'visual studio code': 'code.exe',
  chrome: 'chrome.exe', 'google chrome': 'chrome.exe',
  edge: 'msedge.exe', brave: 'brave.exe', firefox: 'firefox.exe',
  notepad: 'notepad.exe', cmd: 'cmd.exe', terminal: 'WindowsTerminal.exe',
  whatsapp: 'WhatsApp.exe', discord: 'Discord.exe',
  spotify: 'Spotify.exe', telegram: 'Telegram.exe',
  steam: 'steam.exe', 'epic games': 'EpicGamesLauncher.exe',
  camera: 'WindowsCamera.exe', calculator: 'CalculatorApp.exe',
  settings: 'SystemSettings.exe', 'task manager': 'Taskmgr.exe',
  photos: 'Microsoft.Photos.exe', explorer: 'explorer.exe', files: 'explorer.exe'
}

function executeCommand(command: string, appName: string, resolve: any) {
  exec(command, (error) => {
    if (error) {
      launchViaPowerShell(appName, resolve)
    } else {
      resolve({ success: true, message: `Opened ${appName}` })
    }
  })
}

function launchViaPowerShell(appName: string, resolve: any) {
  const psCommand = `powershell -Command "Get-StartApps | Where-Object { $_.Name -like '*${appName}*' } | Select-Object -First 1 -ExpandProperty AppID"`
  exec(psCommand, (error, stdout) => {
    if (error) {
      resolve({ success: false, error: `Could not find '${appName}' on this system. Try opening it manually once.` })
      return
    }
    const appId = stdout.trim()
    if (appId) {
      const launchCmd = `start explorer "shell:AppsFolder\\${appId}"`
      exec(launchCmd, (launchErr) => {
        if (launchErr) {
          resolve({ success: false, error: `Found app but could not launch: ${launchErr.message}` })
        } else {
          resolve({ success: true, message: `Opened ${appName} via System Search` })
        }
      })
    } else {
      resolve({ success: false, error: `Could not find '${appName}' on this system. Try opening it manually once.` })
    }
  })
}

export function startApp(appName: string): Promise<any> {
  return new Promise((resolve) => {
    const lowerName = appName.toLowerCase().trim()
    let command = APP_ALIASES[lowerName]
    if (command) {
      executeCommand(command, appName, resolve)
    } else {
      launchViaPowerShell(appName, resolve)
    }
  })
}

// ─── CPU usage snapshot ────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════
// Main registration function
// ═══════════════════════════════════════════════════════════════════
export default function registerSystemServices(ipcMain: IpcMain): void {

  // ── App Launcher ──────────────────────────────────────────────
  ipcMain.removeHandler('open-app')
  ipcMain.handle('open-app', async (_event, appName: string) => {
    return new Promise((resolve) => {
      const lowerName = appName.toLowerCase().trim()
      let command = APP_ALIASES[lowerName]
      if (command) {
        executeCommand(command, appName, resolve)
      } else {
        launchViaPowerShell(appName, resolve)
      }
    })
  })

  ipcMain.removeHandler('close-app')
  ipcMain.handle('close-app', async (_event, appName: string) => {
    return new Promise((resolve) => {
      const lowerName = appName.toLowerCase().trim()
      let processName = PROCESS_NAMES[lowerName]
      if (!processName) {
        processName = appName.endsWith('.exe') ? appName : `${appName}.exe`
      }
      if (PROTECTED_PROCESSES.includes(processName.toLowerCase())) {
        resolve({
          success: false,
          error: `Security Protocol: I cannot close '${appName}' (System Critical Process). Doing so would crash your PC.`
        })
        return
      }
      const cmd = `taskkill /IM "${processName}" /F /T`
      exec(cmd, (error) => {
        if (error) {
          resolve({ success: false, error: `Could not close ${appName}. Is it running?` })
        } else {
          resolve({ success: true, message: `Terminated ${appName}` })
        }
      })
    })
  })

  // ── Apps Manager (mock installed list) ────────────────────────
  ipcMain.handle('apps-refresh', async () => {
    try {
      const mockApps = [
        { id: 'chrome', name: 'Google Chrome', version: '120.0.6099.109', icon: 'data:image/svg+xml;base64,PHN2Zw==' },
        { id: 'vscode', name: 'Visual Studio Code', version: '1.85.1', icon: 'data:image/svg+xml;base64,PHN2Zw==' },
        { id: 'notepad', name: 'Notepad', version: '11.2302.16.0', icon: 'data:image/svg+xml;base64,PHN2Zw==' },
        { id: 'calculator', name: 'Calculator', version: '11.2210.0.0', icon: 'data:image/svg+xml;base64,PHN2Zw==' },
        { id: 'spotify', name: 'Spotify', version: '1.2.31.1205', icon: 'data:image/svg+xml;base64,PHN2Zw==' }
      ]
      return mockApps
    } catch (error) {
      console.error('Refresh apps failed:', error)
      return []
    }
  })

  // ── Running apps (from file-launcher.ts) ──────────────────────
  ipcMain.removeHandler('get-running-apps')
  ipcMain.handle('get-running-apps', async () => {
    try {
      if (os.platform() === 'win32') {
        const cmd = `powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -ExpandProperty ProcessName"`
        const output = await runCommand(cmd)
        const apps = output.split(/\r?\n/).map((a) => a.trim()).filter((a) => a)
        return [...new Set(apps)]
      }
      if (os.platform() === 'darwin') {
        const cmd = `osascript -e 'tell application "System Events" to get name of (processes where background only is false)'`
        const output = await runCommand(cmd)
        return output.split(', ').map((s) => s.trim())
      }
      return []
    } catch (e) {
      return []
    }
  })

  // ── Terminal Control ──────────────────────────────────────────
  const sanitizePath = (inputPath: string) => {
    let clean = path.normalize(inputPath)
    if (clean.endsWith(path.sep)) clean = clean.slice(0, -1)
    return clean
  }

  ipcMain.handle('run-shell-command', async (_event, { command, cwd }) => {
    const verdict = classifyCommand(command)
    const allowed = await approve(verdict, `Run shell command: ${command}`)
    if (!allowed) {
      return { success: false, output: 'Action denied by SecurityGateway.' }
    }
    return new Promise((resolve) => {
      const safeCwd = cwd ? sanitizePath(cwd) : undefined
      const win = BrowserWindow.getAllWindows()[0]
      const child = spawn('powershell.exe', ['-Command', command], {
        cwd: safeCwd,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      child.stdout.on('data', (data) => {
        const output = data.toString()
        if (win) win.webContents.send('terminal-data', output)
      })
      child.stderr.on('data', (data) => {
        const output = data.toString()
        if (win) win.webContents.send('terminal-data', `\x1b[31m${output}\x1b[0m`)
      })
      child.on('close', (code) => {
        const msg = `\r\n[Process exited with code ${code}]\r\n`
        if (win) win.webContents.send('terminal-data', msg)
        resolve({ success: code === 0, output: `Completed with code ${code}` })
      })
      child.on('error', (err) => {
        if (win) win.webContents.send('terminal-data', `Error: ${err.message}`)
        resolve({ success: false, output: err.message })
      })
    })
  })

  // ── System Info ───────────────────────────────────────────────
  ipcMain.removeHandler('get-installed-apps')
  ipcMain.handle('get-installed-apps', async () => {
    try {
      if (os.platform() !== 'win32') return []
      const cmd = `powershell "$sh = New-Object -ComObject WScript.Shell; Get-ChildItem -Path '$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs', '$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs' -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object { $lnk = $sh.CreateShortcut($_.FullName); [PSCustomObject]@{ Name=$_.Name; FullName=$_.FullName; Target=$lnk.TargetPath } } | ConvertTo-Json"`
      const jsonOutput = await runCommand(cmd)
      if (!jsonOutput) return []
      let rawData
      try { rawData = JSON.parse(jsonOutput) } catch (parseError) { return [] }
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
      for (const [name, filePath] of uniqueApps.entries()) {
        if (count >= 60) break
        try {
          const nativeImg = await app.getFileIcon(filePath, { size: 'normal' })
          if (nativeImg && !nativeImg.isEmpty()) {
            const base64 = nativeImg.toDataURL()
            results.push({ id: name, name: name, icon: base64 })
          } else {
            throw new Error('Empty icon')
          }
        } catch (err) {
          results.push({ id: name, name: name })
        }
        count++
      }
      return results.sort((a, b) => a.name.localeCompare(b.name))
    } catch (e) {
      return []
    }
  })

  ipcMain.removeHandler('get-system-stats')
  ipcMain.handle('get-system-stats', async () => {
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
      os: { type: osType, uptime: (os.uptime() / 3600).toFixed(1) + 'h' }
    }
  })

  // ── Running Processes ─────────────────────────────────────────
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

  // ── Drives ────────────────────────────────────────────────────
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

  // ── Windows Defender Handlers ─────────────────────────────────
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

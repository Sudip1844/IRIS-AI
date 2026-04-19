/**
 * Risk Classification Rules for the IRIS SecurityGateway.
 *
 * Commands matching HIGH_RISK patterns will trigger an on-screen
 * approval dialog before execution.  Everything else runs silently.
 */

// ─── Dangerous PowerShell / CMD patterns ────────────────────────────
export const DANGEROUS_COMMAND_PATTERNS: RegExp[] = [
  // Destructive file-system operations
  /rm\s+-r/i,
  /rmdir/i,
  /del\s+/i,
  /remove-item/i,
  /format\s+[a-z]:/i,

  // Package managers that can run arbitrary post-install scripts
  /npm\s+install/i,
  /npm\s+i\s/i,
  /npx\s/i,
  /pip\s+install/i,
  /choco\s+install/i,
  /winget\s+install/i,

  // Downloading / executing remote payloads
  /curl\s/i,
  /wget\s/i,
  /invoke-webrequest/i,
  /invoke-restmethod/i,
  /invoke-expression/i,
  /iex\s/i,
  /start-process/i,
  /\.exe/i,

  // System-level operations
  /reg\s+(add|delete)/i,
  /regedit/i,
  /netsh/i,
  /schtasks/i,
  /sc\s+(create|delete|stop)/i,
  /bcdedit/i,
  /shutdown/i,
  /restart-computer/i,

  // Git pushes to remote (data exfiltration / code publish)
  /git\s+push/i,
  /git\s+remote\s+add/i,

  // PowerShell policy bypass
  /set-executionpolicy/i,
  /bypass/i
]

// ─── File-system paths that should NEVER be written / deleted ────────
export const PROTECTED_PATHS: string[] = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\Users\\Default',
  'C:\\ProgramData',
  'C:\\$Recycle.Bin'
]

// ─── File operations considered high-risk ────────────────────────────
export const HIGH_RISK_FILE_OPS: string[] = ['delete', 'move']

// ─── IPC channels that are always safe (low-risk) ───────────────────
export const SAFE_CHANNELS: string[] = [
  'open-app',
  'get-running-apps',
  'ghost-sequence',
  'ghost-click-coordinate',
  'ghost-scroll',
  'get-screen-size',
  'set-volume',
  'take-screenshot',
  'get-system-info',
  'read-file',
  'file-search',
  'get-screen-source',
  'get-live-location',
  'web-search'
]

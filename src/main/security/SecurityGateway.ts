/**
 * SecurityGateway – the "Guardrails & Safety" layer from the architecture diagram.
 *
 * Every dangerous IPC handler routes through `SecurityGateway.approve()`.
 * • Low-risk actions execute silently.
 * • High-risk actions show a native dialog and wait for the user's click.
 */
import { BrowserWindow, dialog } from 'electron'
import path from 'path'
import {
  DANGEROUS_COMMAND_PATTERNS,
  PROTECTED_PATHS,
  HIGH_RISK_FILE_OPS
} from './risk-rules'

export type RiskLevel = 'LOW' | 'HIGH' | 'BLOCKED'

export interface RiskVerdict {
  level: RiskLevel
  reason: string
}

// ─── Core classification logic ──────────────────────────────────────

/**
 * Classify a shell command (PowerShell / CMD string).
 */
export function classifyCommand(command: string): RiskVerdict {
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return {
        level: 'HIGH',
        reason: `Command matches dangerous pattern: ${pattern.source}`
      }
    }
  }
  return { level: 'LOW', reason: 'No dangerous patterns detected' }
}

/**
 * Classify a file-system operation.
 * @param operation  'copy' | 'move' | 'delete'
 * @param targetPath The file/directory being acted upon.
 */
export function classifyFileOp(operation: string, targetPath: string): RiskVerdict {
  const normalizedPath = path.resolve(targetPath).toLowerCase()

  // Block operations on system-critical directories
  for (const protectedDir of PROTECTED_PATHS) {
    if (normalizedPath.startsWith(protectedDir.toLowerCase())) {
      return {
        level: 'BLOCKED',
        reason: `"${operation}" is blocked on protected system path: ${protectedDir}`
      }
    }
  }

  if (HIGH_RISK_FILE_OPS.includes(operation.toLowerCase())) {
    return {
      level: 'HIGH',
      reason: `File operation "${operation}" on: ${targetPath}`
    }
  }

  return { level: 'LOW', reason: 'Safe file operation' }
}

/**
 * Classify a file-write operation by its destination path.
 */
export function classifyFileWrite(filePath: string): RiskVerdict {
  const normalizedPath = path.resolve(filePath).toLowerCase()

  for (const protectedDir of PROTECTED_PATHS) {
    if (normalizedPath.startsWith(protectedDir.toLowerCase())) {
      return {
        level: 'BLOCKED',
        reason: `Write blocked on protected system path: ${protectedDir}`
      }
    }
  }

  // Writing to system-root or executable paths is high-risk
  const ext = path.extname(filePath).toLowerCase()
  if (['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.msi', '.reg'].includes(ext)) {
    return {
      level: 'HIGH',
      reason: `Writing an executable/script file: ${filePath}`
    }
  }

  return { level: 'LOW', reason: 'Safe file write' }
}

// ─── Approval dialog ────────────────────────────────────────────────

/**
 * Show a native OS dialog asking the user to allow or deny a high-risk action.
 * Returns `true` if the user clicks "Allow", `false` otherwise.
 */
export async function requestApproval(verdict: RiskVerdict, details: string): Promise<boolean> {
  const win = BrowserWindow.getAllWindows()[0] || null

  const result = await dialog.showMessageBox(win!, {
    type: 'warning',
    title: '⚠️ Security Approval Required',
    message: `IRIS wants to perform a potentially dangerous action.`,
    detail: [
      `Action: ${details}`,
      `Reason: ${verdict.reason}`,
      '',
      'Do you want to allow this?'
    ].join('\n'),
    buttons: ['❌ Deny', '✅ Allow'],
    defaultId: 0,          // Default to Deny (safe)
    cancelId: 0,
    noLink: true
  })

  // Button index 1 = "Allow"
  return result.response === 1
}

// ─── High-level gate function ───────────────────────────────────────

/**
 * Main entry point used by IPC handlers.
 * Returns `true` if the action should proceed, `false` if denied / blocked.
 */
export async function approve(verdict: RiskVerdict, actionDescription: string): Promise<boolean> {
  if (verdict.level === 'LOW') return true

  if (verdict.level === 'BLOCKED') {
    const win = BrowserWindow.getAllWindows()[0] || null
    dialog.showMessageBox(win!, {
      type: 'error',
      title: '🛑 Action Blocked',
      message: 'This action is permanently blocked for your safety.',
      detail: verdict.reason
    })
    return false
  }

  // HIGH risk → ask the user
  return requestApproval(verdict, actionDescription)
}

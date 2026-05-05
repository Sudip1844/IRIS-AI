/**
 * Skill Library — Reusable, composable AI agent skills
 * Inspired by gpt-runner's agent preset system.
 *
 * Skills are named, reusable prompt-chains that agents can invoke.
 * Built-in skills + custom user-defined skills + skill composition.
 *
 * Example: "web-search" skill = navigate → snapshot → extract → summarize
 */

import { app, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { handleChatRequest } from '../services/chat-handler'

// ─── Types ───

export interface SkillStep {
  type: 'prompt' | 'tool' | 'condition'
  /** For 'prompt': the prompt template (use {{input}} for variable injection) */
  prompt?: string
  /** For 'tool': the IPC handler name to call */
  toolName?: string
  /** For 'tool': arguments to pass */
  toolArgs?: Record<string, any>
  /** For 'condition': expression to evaluate on previous result */
  condition?: string
  /** For 'condition': step index to jump to if true */
  thenStep?: number
  /** For 'condition': step index if false */
  elseStep?: number
}

export interface Skill {
  id: string
  name: string
  description: string
  category: 'research' | 'coding' | 'browser' | 'productivity' | 'communication' | 'custom'
  icon?: string
  steps: SkillStep[]
  inputSchema?: string // description of expected input
  tags?: string[]
  version: number
  createdAt: number
  updatedAt: number
  isBuiltIn: boolean
}

export interface SkillExecutionResult {
  skillId: string
  success: boolean
  output: string
  stepResults: { step: number; output: string; durationMs: number }[]
  totalDurationMs: number
}

// ─── Built-in Skills ───

const BUILT_IN_SKILLS: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Web Search & Summarize',
    description: 'Search the web for a topic and provide a concise summary of findings',
    category: 'research',
    icon: '🔍',
    steps: [
      {
        type: 'prompt',
        prompt:
          'You are a research assistant. The user wants to know about: "{{input}}". ' +
          'Provide a comprehensive yet concise summary covering the key facts, recent developments, ' +
          'and important details. Structure your response with clear headings. ' +
          'If you are unsure about something, say so rather than guessing.'
      }
    ],
    inputSchema: 'A topic or question to research',
    tags: ['search', 'research', 'summary'],
    version: 1,
    isBuiltIn: true
  },
  {
    name: 'Code Review',
    description: 'Analyze code for bugs, security issues, performance problems, and style improvements',
    category: 'coding',
    icon: '🔎',
    steps: [
      {
        type: 'prompt',
        prompt:
          'You are a senior code reviewer. Analyze this code thoroughly:\n\n```\n{{input}}\n```\n\n' +
          'Provide feedback in these categories:\n' +
          '1. **Bugs & Logic Errors** — anything that would cause incorrect behavior\n' +
          '2. **Security Issues** — vulnerabilities, injection risks, data exposure\n' +
          '3. **Performance** — inefficient patterns, unnecessary operations\n' +
          '4. **Style & Best Practices** — naming, structure, readability\n' +
          '5. **Suggested Improvements** — specific code changes with examples\n\n' +
          'Rate overall quality: ⭐ to ⭐⭐⭐⭐⭐'
      }
    ],
    inputSchema: 'Code to review (any language)',
    tags: ['code', 'review', 'security', 'quality'],
    version: 1,
    isBuiltIn: true
  },
  {
    name: 'Translate',
    description: 'Translate text between languages while preserving tone and meaning',
    category: 'communication',
    icon: '🌐',
    steps: [
      {
        type: 'prompt',
        prompt:
          'You are a professional translator. Translate the following text. ' +
          'Preserve the original tone, meaning, and cultural nuances. ' +
          'If the target language is not specified, translate to English.\n\n' +
          'Text: {{input}}\n\n' +
          'Provide:\n1. The translation\n2. Any cultural notes or context\n3. Alternative translations for ambiguous phrases'
      }
    ],
    inputSchema: 'Text to translate (optionally specify target language)',
    tags: ['translate', 'language', 'communication'],
    version: 1,
    isBuiltIn: true
  },
  {
    name: 'Explain Like I\'m 5',
    description: 'Explain a complex concept in simple, easy-to-understand terms',
    category: 'productivity',
    icon: '👶',
    steps: [
      {
        type: 'prompt',
        prompt:
          'Explain this concept as if you\'re talking to a 5-year-old. Use simple words, ' +
          'fun analogies, and real-world examples that a child would understand. ' +
          'Avoid jargon completely.\n\nConcept: {{input}}'
      }
    ],
    inputSchema: 'A complex concept to simplify',
    tags: ['explain', 'simple', 'education'],
    version: 1,
    isBuiltIn: true
  },
  {
    name: 'Summarize Document',
    description: 'Create a structured summary of a long document or text',
    category: 'productivity',
    icon: '📝',
    steps: [
      {
        type: 'prompt',
        prompt:
          'Summarize the following text. Provide:\n' +
          '1. **TL;DR** — One sentence summary\n' +
          '2. **Key Points** — Bullet list of main ideas\n' +
          '3. **Details** — Important specifics, numbers, and quotes\n' +
          '4. **Action Items** — Any tasks or decisions mentioned\n\n' +
          'Text:\n{{input}}'
      }
    ],
    inputSchema: 'Long text or document content to summarize',
    tags: ['summarize', 'document', 'notes'],
    version: 1,
    isBuiltIn: true
  },
  {
    name: 'Debug Error',
    description: 'Analyze an error message or stack trace and suggest fixes',
    category: 'coding',
    icon: '🐛',
    steps: [
      {
        type: 'prompt',
        prompt:
          'You are a debugging expert. Analyze this error:\n\n```\n{{input}}\n```\n\n' +
          'Provide:\n' +
          '1. **Root Cause** — What exactly is going wrong and why\n' +
          '2. **Fix** — The exact code change needed (with before/after)\n' +
          '3. **Prevention** — How to prevent this in the future\n' +
          '4. **Related Issues** — Other problems this might indicate'
      }
    ],
    inputSchema: 'Error message, stack trace, or bug description',
    tags: ['debug', 'error', 'fix', 'code'],
    version: 1,
    isBuiltIn: true
  },
  {
    name: 'Write Email',
    description: 'Draft a professional email based on key points',
    category: 'communication',
    icon: '✉️',
    steps: [
      {
        type: 'prompt',
        prompt:
          'Write a professional email based on these instructions:\n\n{{input}}\n\n' +
          'Provide 3 versions:\n' +
          '1. **Formal** — Corporate, polished tone\n' +
          '2. **Friendly** — Warm but professional\n' +
          '3. **Brief** — Minimum words, maximum clarity\n\n' +
          'Include subject line for each version.'
      }
    ],
    inputSchema: 'Key points, recipient context, and purpose of the email',
    tags: ['email', 'writing', 'communication'],
    version: 1,
    isBuiltIn: true
  },
  {
    name: 'Generate Test Cases',
    description: 'Generate comprehensive test cases for a function or feature',
    category: 'coding',
    icon: '🧪',
    steps: [
      {
        type: 'prompt',
        prompt:
          'Generate comprehensive test cases for:\n\n{{input}}\n\n' +
          'Include:\n' +
          '1. **Happy Path** — Normal expected usage\n' +
          '2. **Edge Cases** — Boundary values, empty inputs, max limits\n' +
          '3. **Error Cases** — Invalid inputs, missing data, network failures\n' +
          '4. **Security Cases** — Injection, overflow, unauthorized access\n\n' +
          'Write actual test code (Jest/Vitest style) with descriptive test names.'
      }
    ],
    inputSchema: 'Function signature, feature description, or code to test',
    tags: ['test', 'testing', 'quality', 'code'],
    version: 1,
    isBuiltIn: true
  }
]

// ─── Storage ───

const SKILLS_FILE = () => path.join(app.getPath('userData'), 'agent-skills.json')

function loadSkills(): Skill[] {
  try {
    if (fs.existsSync(SKILLS_FILE())) {
      return JSON.parse(fs.readFileSync(SKILLS_FILE(), 'utf-8'))
    }
  } catch {}
  return initializeSkills()
}

function saveSkills(skills: Skill[]): void {
  fs.writeFileSync(SKILLS_FILE(), JSON.stringify(skills, null, 2))
}

function initializeSkills(): Skill[] {
  const skills: Skill[] = BUILT_IN_SKILLS.map((s) => ({
    ...s,
    id: `skill_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }))
  saveSkills(skills)
  return skills
}

// ─── Execution Engine ───

/** Execute a skill with the given input */
export async function executeSkill(
  skillId: string,
  input: string,
  provider?: string,
  model?: string
): Promise<SkillExecutionResult> {
  const skills = loadSkills()
  const skill = skills.find((s) => s.id === skillId)

  if (!skill) {
    return {
      skillId,
      success: false,
      output: `Skill "${skillId}" not found`,
      stepResults: [],
      totalDurationMs: 0
    }
  }

  const startTime = Date.now()
  const stepResults: SkillExecutionResult['stepResults'] = []
  let currentOutput = input

  for (let i = 0; i < skill.steps.length; i++) {
    const step = skill.steps[i]
    const stepStart = Date.now()

    try {
      if (step.type === 'prompt' && step.prompt) {
        // Replace {{input}} with the current output
        const resolvedPrompt = step.prompt.replace(/\{\{input\}\}/g, currentOutput)

        currentOutput = await handleChatRequest({
          text: resolvedPrompt,
          provider: (provider as any) || 'auto',
          model
        })
      } else if (step.type === 'condition' && step.condition) {
        // Simple condition: check if output contains a string
        const matches = currentOutput.toLowerCase().includes(step.condition.toLowerCase())
        if (matches && step.thenStep !== undefined) {
          i = step.thenStep - 1 // -1 because loop will increment
        } else if (!matches && step.elseStep !== undefined) {
          i = step.elseStep - 1
        }
        // Don't change currentOutput for conditions
      }

      stepResults.push({
        step: i,
        output: currentOutput.substring(0, 500),
        durationMs: Date.now() - stepStart
      })
    } catch (error: any) {
      stepResults.push({
        step: i,
        output: `Error: ${error.message}`,
        durationMs: Date.now() - stepStart
      })

      return {
        skillId,
        success: false,
        output: `Step ${i + 1} failed: ${error.message}`,
        stepResults,
        totalDurationMs: Date.now() - startTime
      }
    }
  }

  return {
    skillId,
    success: true,
    output: currentOutput,
    stepResults,
    totalDurationMs: Date.now() - startTime
  }
}

// ─── CRUD ───

/** Create a custom skill */
export function createSkill(
  name: string,
  description: string,
  category: Skill['category'],
  steps: SkillStep[],
  tags?: string[]
): Skill {
  const skills = loadSkills()

  const skill: Skill = {
    id: `skill_custom_${Date.now()}`,
    name,
    description,
    category,
    steps,
    tags,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: false
  }

  skills.push(skill)
  saveSkills(skills)
  return skill
}

/** Delete a custom skill (cannot delete built-in) */
export function deleteSkill(skillId: string): boolean {
  const skills = loadSkills()
  const skill = skills.find((s) => s.id === skillId)
  if (!skill || skill.isBuiltIn) return false

  const filtered = skills.filter((s) => s.id !== skillId)
  saveSkills(filtered)
  return true
}

/** List all skills, optionally filtered by category */
export function listSkills(category?: string): Skill[] {
  const skills = loadSkills()
  if (category) return skills.filter((s) => s.category === category)
  return skills
}

/** Compose multiple skills into a pipeline */
export function composeSkills(
  name: string,
  description: string,
  skillIds: string[]
): Skill | null {
  const allSkills = loadSkills()
  const selectedSkills = skillIds
    .map((id) => allSkills.find((s) => s.id === id))
    .filter(Boolean) as Skill[]

  if (selectedSkills.length < 2) return null

  // Merge all steps into a single pipeline
  const mergedSteps: SkillStep[] = []
  for (const skill of selectedSkills) {
    mergedSteps.push(...skill.steps)
  }

  return createSkill(name, description, 'custom', mergedSteps, ['composed', 'pipeline'])
}

// ─── IPC Registration ───

export default function registerSkillLibrary() {
  ipcMain.handle('skill-list', async (_, category?: string) => {
    return listSkills(category)
  })

  ipcMain.handle('skill-execute', async (_, { skillId, input, provider, model }: {
    skillId: string
    input: string
    provider?: string
    model?: string
  }) => {
    return executeSkill(skillId, input, provider, model)
  })

  ipcMain.handle('skill-create', async (_, { name, description, category, steps, tags }: {
    name: string
    description: string
    category: Skill['category']
    steps: SkillStep[]
    tags?: string[]
  }) => {
    return createSkill(name, description, category, steps, tags)
  })

  ipcMain.handle('skill-delete', async (_, skillId: string) => {
    return { success: deleteSkill(skillId) }
  })

  ipcMain.handle('skill-compose', async (_, { name, description, skillIds }: {
    name: string
    description: string
    skillIds: string[]
  }) => {
    const result = composeSkills(name, description, skillIds)
    return result ? { success: true, skill: result } : { success: false, error: 'Need at least 2 valid skills' }
  })

  console.log('[SkillLibrary] Registered with 8 built-in skills')
}

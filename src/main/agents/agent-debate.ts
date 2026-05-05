/**
 * Agent Debate & Consensus — Multi-agent quality control
 * Inspired by microsoft/autogen conversation patterns
 *
 * Provides structured interaction patterns:
 * - Review Loop: worker → reviewer → revision
 * - Debate: two agents argue, lead picks winner
 * - Consensus: multiple agents vote
 * - Escalation: unresolved disagreements go to user
 */

import { ipcMain, app } from 'electron'
import { handleChatRequest } from '../services/chat-handler'
import { saveToMemory } from '../logic/permanent-memory'

// ─── Types ───

export type DebatePattern = 'review' | 'debate' | 'consensus'

export interface DebateResult {
  pattern: DebatePattern
  rounds: DebateRound[]
  finalAnswer: string
  participantCount: number
  consensusReached: boolean
  totalDurationMs: number
}

export interface DebateRound {
  roundNumber: number
  agentName: string
  agentRole: string
  response: string
  timestamp: number
}

export interface ReviewLoopConfig {
  maxRevisions: number // max back-and-forth cycles
  workerPrompt: string
  reviewerCriteria: string // what the reviewer should check
}

// ─── Core Patterns ───

/**
 * Review Loop — Worker creates, Reviewer critiques, Worker revises
 *
 * Flow: Worker → Reviewer → Worker (revised) → Reviewer (approve/reject) → ...
 * Stops when reviewer approves or max revisions reached.
 */
export async function reviewLoop(
  task: string,
  config: ReviewLoopConfig,
  provider?: string,
  model?: string
): Promise<DebateResult> {
  const startTime = Date.now()
  const rounds: DebateRound[] = []
  let currentWork = ''
  let approved = false

  for (let revision = 0; revision < config.maxRevisions; revision++) {
    // Worker step
    const workerPrompt =
      revision === 0
        ? `${config.workerPrompt}\n\nTask: ${task}\n\nProvide your best work.`
        : `${config.workerPrompt}\n\nOriginal task: ${task}\n\n` +
          `Your previous work:\n${currentWork}\n\n` +
          `Reviewer feedback:\n${rounds[rounds.length - 1]?.response || ''}\n\n` +
          `Please revise your work based on the feedback. Address every point the reviewer raised.`

    const workerResponse = await handleChatRequest({
      text: workerPrompt,
      provider: (provider as any) || 'auto',
      model
    })

    currentWork = workerResponse
    rounds.push({
      roundNumber: revision * 2 + 1,
      agentName: 'Worker',
      agentRole: 'worker',
      response: workerResponse,
      timestamp: Date.now()
    })

    // Reviewer step
    const reviewerPrompt =
      `You are a critical reviewer. Your criteria:\n${config.reviewerCriteria}\n\n` +
      `Review this work:\n${currentWork}\n\n` +
      `If the work meets ALL criteria, respond with "APPROVED" at the start, followed by a brief summary of strengths.\n` +
      `If it needs improvement, respond with "NEEDS REVISION" at the start, followed by:\n` +
      `1. Specific issues found\n` +
      `2. Concrete suggestions for improvement\n` +
      `3. What was done well (to keep)`

    const reviewerResponse = await handleChatRequest({
      text: reviewerPrompt,
      provider: (provider as any) || 'auto',
      model
    })

    rounds.push({
      roundNumber: revision * 2 + 2,
      agentName: 'Reviewer',
      agentRole: 'reviewer',
      response: reviewerResponse,
      timestamp: Date.now()
    })

    if (reviewerResponse.toUpperCase().startsWith('APPROVED')) {
      approved = true
      break
    }
  }

  return {
    pattern: 'review',
    rounds,
    finalAnswer: currentWork,
    participantCount: 2,
    consensusReached: approved,
    totalDurationMs: Date.now() - startTime
  }
}

/**
 * Debate — Two agents argue different perspectives, a judge picks the best
 *
 * Agent A argues FOR, Agent B argues AGAINST, Judge synthesizes.
 */
export async function debate(
  topic: string,
  rounds = 2,
  provider?: string,
  model?: string
): Promise<DebateResult> {
  const startTime = Date.now()
  const debateRounds: DebateRound[] = []
  let argFor = ''
  let argAgainst = ''

  for (let round = 0; round < rounds; round++) {
    // Agent A (Pro)
    const proPrompt =
      round === 0
        ? `You are arguing IN FAVOR of the following position. Make your strongest case.\n\nTopic: "${topic}"\n\nPresent compelling arguments with evidence and reasoning.`
        : `You are arguing IN FAVOR of: "${topic}"\n\n` +
          `Your opponent argued:\n${argAgainst}\n\n` +
          `Respond to their points and strengthen your position. Address their strongest arguments directly.`

    argFor = await handleChatRequest({
      text: proPrompt,
      provider: (provider as any) || 'auto',
      model
    })

    debateRounds.push({
      roundNumber: round * 2 + 1,
      agentName: 'Agent Pro',
      agentRole: 'debater-for',
      response: argFor,
      timestamp: Date.now()
    })

    // Agent B (Against)
    const conPrompt =
      round === 0
        ? `You are arguing AGAINST the following position. Present the opposing view.\n\nTopic: "${topic}"\n\nThe other side argues:\n${argFor}\n\nPresent compelling counter-arguments.`
        : `You are arguing AGAINST: "${topic}"\n\n` +
          `Your opponent's latest argument:\n${argFor}\n\n` +
          `Counter their points and strengthen your opposing position.`

    argAgainst = await handleChatRequest({
      text: conPrompt,
      provider: (provider as any) || 'auto',
      model
    })

    debateRounds.push({
      roundNumber: round * 2 + 2,
      agentName: 'Agent Con',
      agentRole: 'debater-against',
      response: argAgainst,
      timestamp: Date.now()
    })
  }

  // Judge synthesizes
  const judgePrompt =
    `You are an impartial judge. Two agents debated the topic: "${topic}"\n\n` +
    `Arguments FOR:\n${argFor}\n\n` +
    `Arguments AGAINST:\n${argAgainst}\n\n` +
    `Provide:\n` +
    `1. **Verdict** — Which side presented a stronger case and why\n` +
    `2. **Key Insights** — The most important points from both sides\n` +
    `3. **Balanced Conclusion** — A nuanced answer that incorporates the best of both arguments`

  const verdict = await handleChatRequest({
    text: judgePrompt,
    provider: (provider as any) || 'auto',
    model
  })

  debateRounds.push({
    roundNumber: debateRounds.length + 1,
    agentName: 'Judge',
    agentRole: 'judge',
    response: verdict,
    timestamp: Date.now()
  })

  // Save insight to global memory
  saveToMemory(
    app,
    'global',
    `Debate on "${topic.substring(0, 60)}": ${verdict.substring(0, 200)}`,
    'debate-system',
    ['debate', 'insight']
  )

  return {
    pattern: 'debate',
    rounds: debateRounds,
    finalAnswer: verdict,
    participantCount: 3,
    consensusReached: true,
    totalDurationMs: Date.now() - startTime
  }
}

/**
 * Consensus — Multiple agents independently answer, then vote
 *
 * Each agent provides their answer independently (no peeking).
 * A synthesizer picks the best answer or merges them.
 */
export async function consensus(
  question: string,
  agentCount = 3,
  provider?: string,
  model?: string
): Promise<DebateResult> {
  const startTime = Date.now()
  const rounds: DebateRound[] = []

  // Collect independent answers in parallel
  const answerPromises = Array.from({ length: agentCount }, (_, i) =>
    handleChatRequest({
      text: `You are Expert Agent ${i + 1}. Answer this question independently and thoroughly.\n\n` +
        `Question: "${question}"\n\n` +
        `Provide your best, well-reasoned answer. Be specific and cite reasoning.`,
      provider: (provider as any) || 'auto',
      model
    }).then((response) => ({
      agentName: `Expert ${i + 1}`,
      response
    }))
  )

  const answers = await Promise.all(answerPromises)

  for (let i = 0; i < answers.length; i++) {
    rounds.push({
      roundNumber: i + 1,
      agentName: answers[i].agentName,
      agentRole: 'expert',
      response: answers[i].response,
      timestamp: Date.now()
    })
  }

  // Synthesize answers
  const synthesisPrompt =
    `${agentCount} experts independently answered the question: "${question}"\n\n` +
    answers.map((a, i) => `--- Expert ${i + 1} ---\n${a.response}\n`).join('\n') +
    `\nSynthesize the best answer by:\n` +
    `1. Identifying points where experts AGREE (high confidence)\n` +
    `2. Noting where they DISAGREE (flag uncertainty)\n` +
    `3. Taking the strongest elements from each answer\n` +
    `4. Producing a single, comprehensive final answer`

  const finalAnswer = await handleChatRequest({
    text: synthesisPrompt,
    provider: (provider as any) || 'auto',
    model
  })

  rounds.push({
    roundNumber: agentCount + 1,
    agentName: 'Synthesizer',
    agentRole: 'synthesizer',
    response: finalAnswer,
    timestamp: Date.now()
  })

  return {
    pattern: 'consensus',
    rounds,
    finalAnswer,
    participantCount: agentCount + 1,
    consensusReached: true,
    totalDurationMs: Date.now() - startTime
  }
}

// ─── IPC Registration ───

export default function registerAgentDebate() {
  ipcMain.handle(
    'debate-review',
    async (_, { task, config, provider, model }: {
      task: string
      config: ReviewLoopConfig
      provider?: string
      model?: string
    }) => {
      try {
        return { success: true, result: await reviewLoop(task, config, provider, model) }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  ipcMain.handle(
    'debate-argue',
    async (_, { topic, rounds, provider, model }: {
      topic: string
      rounds?: number
      provider?: string
      model?: string
    }) => {
      try {
        return { success: true, result: await debate(topic, rounds, provider, model) }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  ipcMain.handle(
    'debate-consensus',
    async (_, { question, agentCount, provider, model }: {
      question: string
      agentCount?: number
      provider?: string
      model?: string
    }) => {
      try {
        return { success: true, result: await consensus(question, agentCount, provider, model) }
      } catch (e: any) {
        return { success: false, error: e.message }
      }
    }
  )

  console.log('[AgentDebate] Registered — review loop + debate + consensus patterns')
}

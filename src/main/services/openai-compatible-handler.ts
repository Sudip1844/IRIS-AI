import OpenAI from 'openai'

export interface OpenAICompatibleConfig {
  apiKey: string
  baseURL?: string
  model: string
}

export async function chatWithOpenAICompatible(
  config: OpenAICompatibleConfig,
  text: string
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    dangerouslyAllowBrowser: false
  })

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: text }],
      max_tokens: 4096,
      temperature: 0.7
    })

    return response.choices[0]?.message?.content || 'No response generated'
  } catch (error: any) {
    console.error('[MJ] OpenAI-compatible chat error:', error.message)
    throw new Error(`OpenAI-compatible API error: ${error.message}`)
  }
}

export async function streamChatWithOpenAICompatible(
  config: OpenAICompatibleConfig,
  text: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    dangerouslyAllowBrowser: false
  })

  try {
    const stream = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: text }],
      max_tokens: 4096,
      temperature: 0.7,
      stream: true
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        onChunk(content)
      }
    }
  } catch (error: any) {
    console.error('[MJ] OpenAI-compatible stream error:', error.message)
    throw new Error(`OpenAI-compatible streaming error: ${error.message}`)
  }
}

// Provider-specific configurations
export const PROVIDER_CONFIGS: Record<string, { baseURL?: string; defaultModel: string }> = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat'
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest'
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3-haiku'
  },
  xai: {
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-beta'
  }
}

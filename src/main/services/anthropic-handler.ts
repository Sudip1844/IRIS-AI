import Anthropic from '@anthropic-ai/sdk'

/**
 * Anthropic Handler for Claude models
 * Supports: claude-3-opus, claude-3-sonnet, claude-3-haiku, etc.
 * Advantages: 200k context window, excellent reasoning
 */

export async function chatWithAnthropic(
  apiKey: string,
  text: string,
  model: string = 'claude-3-5-sonnet-latest',
  images?: string[]
): Promise<string> {
  if (!apiKey) {
    throw new Error('Anthropic API key not provided')
  }

  try {
    const client = new Anthropic({ apiKey })

    const userContent: any[] = []
    if (images && images.length > 0) {
      for (const img of images) {
        const base64Data = img.replace(/^data:image\/\w+;base64,/, '')
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64Data
          }
        })
      }
    }
    userContent.push({ type: 'text', text: text })

    const response = await client.messages.create({
      model: model,
      max_tokens: 2048,
      system:
        'You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional.',
      messages: [
        {
          role: 'user',
          content: userContent
        }
      ]
    })

    const textContent = response.content.find((block) => block.type === 'text')
    return textContent && 'text' in textContent ? textContent.text : 'No response from Claude'
  } catch (err: any) {
    throw new Error(`Anthropic API Error: ${err.message}`)
  }
}

/**
 * Stream chat responses from Anthropic
 */
export async function* streamChatWithAnthropic(
  apiKey: string,
  text: string,
  model: string = 'claude-3-sonnet-20240229'
): AsyncGenerator<string> {
  if (!apiKey) {
    throw new Error('Anthropic API key not provided')
  }

  try {
    const client = new Anthropic({ apiKey })

    const stream = client.messages.stream({
      model: model,
      max_tokens: 2048,
      system:
        'You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional.',
      messages: [
        {
          role: 'user',
          content: text
        }
      ]
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text
      }
    }
  } catch (err: any) {
    throw new Error(`Anthropic Stream Error: ${err.message}`)
  }
}

/**
 * Get model information
 */
export function getClaudeModels() {
  return {
    opus: {
      name: 'claude-3-opus-20240229',
      description: 'Most capable, best for complex tasks',
      context: '200k tokens'
    },
    sonnet: {
      name: 'claude-3-sonnet-20240229',
      description: 'Balanced intelligence and speed',
      context: '200k tokens'
    },
    haiku: {
      name: 'claude-3-haiku-20240307',
      description: 'Fastest, for simple tasks',
      context: '200k tokens'
    }
  }
}

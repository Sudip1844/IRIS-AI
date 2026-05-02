import OpenAI from 'openai'

/**
 * OpenAI Handler for GPT-4 and other OpenAI models
 * Supports: gpt-4, gpt-4-turbo, gpt-3.5-turbo, etc.
 */

export async function chatWithOpenAI(
  apiKey: string,
  text: string,
  model: string = 'gpt-4'
): Promise<string> {
  if (!apiKey) {
    throw new Error('OpenAI API key not provided')
  }

  try {
    const client = new OpenAI({ apiKey })

    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content:
            'You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })

    return response.choices[0]?.message?.content || 'No response from OpenAI'
  } catch (err: any) {
    throw new Error(`OpenAI API Error: ${err.message}`)
  }
}

/**
 * Stream chat responses from OpenAI
 */
export async function* streamChatWithOpenAI(
  apiKey: string,
  text: string,
  model: string = 'gpt-4'
): AsyncGenerator<string> {
  if (!apiKey) {
    throw new Error('OpenAI API key not provided')
  }

  try {
    const client = new OpenAI({ apiKey })

    const stream = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content:
            'You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 2048,
      stream: true
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        yield content
      }
    }
  } catch (err: any) {
    throw new Error(`OpenAI Stream Error: ${err.message}`)
  }
}

/**
 * Vision support - analyze image with GPT-4 Vision
 */
export async function analyzeImageWithOpenAI(
  apiKey: string,
  imageUrl: string,
  prompt: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('OpenAI API key not provided')
  }

  try {
    const client = new OpenAI({ apiKey })

    const response = await client.chat.completions.create({
      model: 'gpt-4-vision',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      max_tokens: 1024
    })

    return response.choices[0]?.message?.content || 'No image analysis result'
  } catch (err: any) {
    throw new Error(`OpenAI Vision Error: ${err.message}`)
  }
}

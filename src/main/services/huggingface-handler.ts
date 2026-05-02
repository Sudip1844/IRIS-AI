import { InferenceClient } from '@huggingface/inference'

export async function chatWithHuggingFace(
  apiKey: string,
  text: string,
  model?: string
): Promise<string> {
  try {
    const client = new InferenceClient(apiKey)

    // Use text generation for conversational AI
    const response = await client.textGeneration({
      model: model || 'gpt2',
      inputs: text,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false
      }
    })

    // Handle different response formats from Hugging Face API
    if (typeof response === 'string') {
      return response
    } else if (response && typeof response === 'object') {
      if (response.generated_text) {
        return response.generated_text
      } else if (Array.isArray(response) && response[0] && response[0].generated_text) {
        return response[0].generated_text
      }
    }

    return 'No response generated'
  } catch (error: any) {
    console.error('[MJ] Hugging Face chat error:', error.message)
    throw new Error(`Hugging Face API error: ${error.message}`)
  }
}

export async function streamChatWithHuggingFace(
  apiKey: string,
  text: string,
  onChunk: (chunk: string) => void,
  model?: string
): Promise<void> {
  try {
    // For now, simulate streaming by sending the full response in chunks
    const fullResponse = await chatWithHuggingFace(apiKey, text, model || 'gpt2')
    const chunks = fullResponse.split(' ')

    for (const chunk of chunks) {
      onChunk(chunk + ' ')
      // Small delay to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  } catch (error: any) {
    console.error('[MJ] Hugging Face stream error:', error.message)
    throw new Error(`Hugging Face streaming error: ${error.message}`)
  }
}

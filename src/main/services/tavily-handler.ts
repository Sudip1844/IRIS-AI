import { tavily } from '@tavily/core'

export async function chatWithTavily(apiKey: string, text: string): Promise<string> {
  try {
    const tvly = tavily({ apiKey })

    // Use Tavily for search-based responses
    const searchResults = await tvly.search(text, {
      searchDepth: 'advanced',
      includeAnswer: true,
      maxResults: 3
    })

    // Format search results as a response
    let response = `Based on web search results for "${text}":\n\n`

    if (searchResults.answer) {
      response += `**Summary:** ${searchResults.answer}\n\n`
    }

    response += '**Sources:**\n'
    searchResults.results.forEach((result: any, index: number) => {
      response += `${index + 1}. ${result.title}\n   ${result.content.substring(0, 200)}...\n   URL: ${result.url}\n\n`
    })

    return response
  } catch (error: any) {
    console.error('[MJ] Tavily chat error:', error.message)
    throw new Error(`Tavily API error: ${error.message}`)
  }
}

export async function streamChatWithTavily(
  apiKey: string,
  text: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  try {
    // For streaming, we'll simulate it by sending chunks of the response
    const fullResponse = await chatWithTavily(apiKey, text)
    const chunks = fullResponse.split(' ')

    for (const chunk of chunks) {
      onChunk(chunk + ' ')
      // Small delay to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  } catch (error: any) {
    console.error('[MJ] Tavily stream error:', error.message)
    throw new Error(`Tavily streaming error: ${error.message}`)
  }
}

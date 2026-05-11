import { IpcMain } from 'electron'
import { tavily } from '@tavily/core'


export default function registerDeepResearch({ ipcMain }: { ipcMain: IpcMain }) {
  ipcMain.handle('execute-deep-research', async (event, { query, tavilyKey }) => {
    try {
      if (!tavilyKey) {
        throw new Error('Missing Tavily API Key. Please configure Tavily in the Command Center Vault.')
      }

      event.sender.send('oracle-progress', {
        status: 'scanning',
        file: 'IRIS and Tavily Neural Search Active...',
        totalFound: 1
      })

      const tvly = tavily({ apiKey: tavilyKey })
      const tavilyData = await tvly.search(query, {
        searchDepth: 'advanced',
        includeAnswer: true,
        maxResults: 5
      })
      const rawContext = tavilyData.results
        .map((r: any) => `Source: ${r.url}\nContent: ${r.content}`)
        .join('\n\n')

      event.sender.send('oracle-progress', {
        status: 'reading',
        file: 'Primary AI Engine Synthesizing Data...',
        totalFound: 2
      })

      const prompt = `
        You are an elite research analyst. Answer: "${query}".
        Output ONLY a JSON object with a key "summary" containing a detailed, well-formatted markdown summary of your findings.
        Do not output any markdown code blocks or conversational text, only the raw JSON.
        Context: ${rawContext}
        `

      const { handleChatRequest } = require('./chat-handler')
      const answer = await handleChatRequest({
          text: prompt,
          provider: 'auto'
      })

      let extractedSummary = 'No data generated.';
      try {
          const cleanJsonStr = answer.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsedData = JSON.parse(cleanJsonStr)
          if (parsedData.summary) {
              extractedSummary = parsedData.summary;
          }
      } catch (e) {
          // If JSON parse fails, just use the raw output (sometimes models don't follow JSON structure)
          extractedSummary = answer;
      }

      event.sender.send('oracle-progress', {
        status: 'embedded',
        file: 'Research synthesis complete...',
        totalFound: 3
      })

      return { success: true, summary: extractedSummary }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('research-start', async (event, { query }) => {
    try {
      const { handleChatRequest } = require('./chat-handler')
      const answer = await handleChatRequest({
        text: `Provide a quick summary and 2 key points about: "${query}". Format as plain text.`,
        provider: 'auto'
      })

      return [
        {
          title: `Quick AI Overview: ${query}`,
          snippet: answer,
          url: `https://google.com/search?q=${encodeURIComponent(query)}`
        }
      ]
    } catch (error) {
      console.error('Research failed:', error)
      return []
    }
  })
}

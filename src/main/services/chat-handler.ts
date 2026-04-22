import { ipcMain, app, safeStorage } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { GoogleGenAI } from '@google/genai'
import Groq from 'groq-sdk'

// Maintain simple conversation context (optional later upgrade)
const chatHistory: any[] = []

function getSecureVaultPath() {
  const userData = app.getPath('userData')
  const candidates = [
    join(userData, 'mj_secure_vault.json'),
    join(userData, 'iris_secure_vault.json')
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0]
}

export default function registerChatHandler() {
  const secureConfigPath = getSecureVaultPath()

  ipcMain.handle('chat-with-ai', async (_, text: string) => {
    let groqKey = ''
    let geminiKey = ''

    // Retrieve keys from Secure Vault
    try {
      if (fs.existsSync(secureConfigPath)) {
        const data = JSON.parse(fs.readFileSync(secureConfigPath, 'utf8'))
        if (safeStorage.isEncryptionAvailable()) {
          if (data.groq) groqKey = safeStorage.decryptString(Buffer.from(data.groq, 'base64'))
          if (data.gemini) geminiKey = safeStorage.decryptString(Buffer.from(data.gemini, 'base64'))
        } else {
          if (data.groq) groqKey = Buffer.from(data.groq, 'base64').toString('utf8')
          if (data.gemini) geminiKey = Buffer.from(data.gemini, 'base64').toString('utf8')
        }
      }
    } catch (e) {
      console.log('[MJ Backend] Failed to read secure keys', e)
    }

    if (!geminiKey && !groqKey) {
      return 'ERROR: No AI Model configured. Please save a Gemini or Groq API key in the Setup parameters (Settings).'
    }

    // Try Gemini First (as requested by user typically)
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey })
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional. The user says: "${text}"`
        })
        return response.text
      } catch (err: any) {
        return 'Gemini API Error: ' + err.message
      }
    }

    // Fallback to Groq if only Groq is available
    if (groqKey) {
      try {
        const groq = new Groq({ apiKey: groqKey })
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content:
                'You are MJ, a highly advanced desktop AI assistant built by Sudip. Be helpful, concise, and professional.'
            },
            { role: 'user', content: text }
          ],
          model: 'llama3-8b-8192'
        })
        return completion.choices[0]?.message?.content || 'No response'
      } catch (err: any) {
        return 'Groq API Error: ' + err.message
      }
    }

    return 'No AI processing possible.'
  })
}

import { ipcMain } from 'electron'
import { startApp } from './app-launcher'
// import handleGhostSequence from './ghost-control'

export function registerSpotifyManager() {
  ipcMain.handle('play-spotify-music', async (_, songName: string) => {
    try {
      // 1. Launch Spotify
      await startApp('spotify')

      // 2. Perform Ghost Sequence to search and play
      const navActions = [
        { type: 'wait', ms: 5000 },
        { type: 'click' },
        { type: 'press', key: 'k', modifiers: ['control'] },
        { type: 'wait', ms: 800 },
        { type: 'press', key: 'a', modifiers: ['control'] },
        { type: 'press', key: 'backspace' },
        { type: 'type', text: songName },
        { type: 'wait', ms: 800 },
        { type: 'press', key: 'enter' },
        { type: 'wait', ms: 1500 },
        { type: 'press', key: 'tab' },
        { type: 'wait', ms: 200 },
        { type: 'press', key: 'tab' },
        { type: 'wait', ms: 200 },
        { type: 'press', key: 'enter' },
        { type: 'wait', ms: 200 },
        { type: 'press', key: 'enter' }
      ]

      // await handleGhostSequence(navActions)

      return `✅ Launched Spotify. Please search for "${songName}" manually.`
    } catch (error) {
      console.error('Spotify error:', error)
      return `❌ Failed to play ${songName}.`
    }
  })
}

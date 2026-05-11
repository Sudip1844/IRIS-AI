/**
 * IntegrationsService – consolidated third-party / personal API handlers.
 *
 * Re-exports from:
 *   logic/gmail-manager.ts     → Gmail OAuth + send/read
 *   logic/spotify-manager.ts   → Spotify playback control
 *   logic/stocks-manager.ts    → Stock watchlist
 *   logic/notes-manager.ts     → Notes CRUD
 *   logic/gallery-manager.ts   → Gallery browsing
 */
import { IpcMain } from 'electron'
import registerGmailHandlers from '../logic/gmail-manager'
import { registerSpotifyManager } from '../logic/spotify-manager'
import registerStocksHandlers from '../logic/stocks-manager'
import registerNotesHandlers from '../logic/notes-manager'
import registerGalleryHandlers from '../logic/gallery-manager'

export default function registerIntegrationServices(ipcMain: IpcMain): void {
  registerGmailHandlers(ipcMain)
  registerSpotifyManager()          // spotify uses ipcMain internally
  registerStocksHandlers(ipcMain)
  registerNotesHandlers(ipcMain)
  registerGalleryHandlers(ipcMain)
}

import { IpcMain } from 'electron'

export default function registerAppsHandlers(ipcMain: IpcMain) {
  ipcMain.handle('apps-refresh', async () => {
    try {
      // Mock installed apps data
      const mockApps = [
        {
          id: 'chrome',
          name: 'Google Chrome',
          version: '120.0.6099.109',
          icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOC4xMzYgMiA1IDUuMTM2IDUgOUM1IDExLjg2NCA4LjEzNiAxNSA5IDE1UzEzIDExLjg2NCAxMyA5UzE1Ljg2NCA1IDE5IDVDMjIuODY0IDUuMTM2IDI2IDguMTM2IDI2IDEyUzIyLjg2NCAyMiAxOSAyMkMxNS44NjQgMjIgMTMgMTguODY0IDEzIDE1VjE0QzEzIDE2LjIwOSAxNC43OTEgMTggMTcgMThTMTkgMTYuMjA5IDE5IDE0VjEzQzE5IDE1LjIwOSAxNy43OTEgMTcgMTYgMTdTMTQgMTUuMjA5IDE0IDEzVjEyQzE0IDE0LjIwOSAxNS43OTEgMTYgMTggMTZTMjIgMTQuMjA5IDIyIDEyQzIyIDkuNzkxIDIwLjIwOSAyMSAxOCAyMUMxNS43OTEgMjEgMTQgMTkuNzkxIDE0IDE3VjE2QzE0IDE4LjIwOSAxNS43OTEgMjAgMTggMjBTMjIgMTguMjA5IDIyIDE2VjE1QzIyIDEyLjc5MSAyMC4yMDkgMTEgMTggMTFTMTQgMTIuNzkxIDE0IDE1VjE2QzE0IDEzLjc5MSAxMi43OTEgMTEgMTQuNzkxQzEwLjIwOSA5IDEyIDJDMTUuODY0IDIgMTkgNS4xMzYgMTkgOUMxOSA4LjEzNiAxNS44NjQgNSAxMiA1WiIgc3Ryb2tlPSIjNDI4NUY0IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4='
        },
        {
          id: 'vscode',
          name: 'Visual Studio Code',
          version: '1.85.1',
          icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTMgMTJMMTEgMkwxOSA5VjE1TDE5IDIxTDEzIDIxVjE1SDE5VjE1TDE5IDlMMTEgMkwzIDEyWiIgc3Ryb2tlPSIjMDA3QUNCIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4='
        },
        {
          id: 'notepad',
          name: 'Notepad',
          version: '11.2302.16.0',
          icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjIwIiB4PSI0IiB5PSIyIiByeD0iMiIgc3Ryb2tlPSIjNjA2MDYwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4='
        },
        {
          id: 'calculator',
          name: 'Calculator',
          version: '11.2210.0.0',
          icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjIwIiB4PSI0IiB5PSIyIiByeD0iMiIgc3Ryb2tlPSIjNjA2MDYwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4='
        },
        {
          id: 'spotify',
          name: 'Spotify',
          version: '1.2.31.1205',
          icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIHN0cm9rZT0iIzFGQzIyRSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+'
        }
      ]

      return mockApps
    } catch (error) {
      console.error('Refresh apps failed:', error)
      return []
    }
  })
}

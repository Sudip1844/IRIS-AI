import { resolve } from 'path'
import { defineConfig } from 'electron-vite'

// The actual UI is served from "static ui/index.html" loaded directly by
// mainWindow.loadFile(). The renderer config below only satisfies
// electron-vite's requirement for a valid rollup input during builds.
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  }
})

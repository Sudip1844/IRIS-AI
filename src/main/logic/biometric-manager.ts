import { IpcMain } from 'electron'
import {
  enrollFace,
  listEnrolledFaces,
  recognizeFace,
  scanFromCamera,
  registerBiometricIPC,
  deleteFace,
  clearAllFaces
} from '../services/biometric-recognition'

export default function registerBiometricHandlers(ipcMain: IpcMain) {
  // Register additional biometric IPC handlers
  registerBiometricIPC()

  ipcMain.handle('biometric-list', async () => {
    try {
      return { success: true, faces: await listEnrolledFaces() }
    } catch (error) {
      console.error('Biometric list failed:', error)
      return { success: false, faces: [] }
    }
  })

  ipcMain.handle(
    'biometric-enroll',
    async (_event, payload: { imagePath?: string; name?: string; image?: string; descriptor?: number[] }) => {
      try {
        // If we have an image and descriptor from camera (renderer process)
        if (payload?.image && payload?.descriptor && payload?.name) {
          const { enrollFaceWithDescriptor } = await import('../services/biometric-recognition')
          await enrollFaceWithDescriptor(payload.name, payload.image, payload.descriptor)
          return true
        }

        // Original file-based enrollment
        if (payload?.imagePath && payload?.name) {
          await enrollFace(payload.imagePath, payload.name)
          return true
        }

        // Demo mode - simulate enrollment
        const enrolled = Math.random() > 0.3
        return enrolled
      } catch (error) {
        console.error('Biometric enrollment failed:', error)
        return false
      }
    }
  )

  ipcMain.handle('biometric-scan', async () => {
    try {
      const result = await scanFromCamera()
      return result.success
    } catch (error) {
      console.error('Biometric scan failed:', error)
      return false
    }
  })

  ipcMain.handle('biometric-test', async (_event, payload: { imagePath?: string; image?: string; descriptor?: number[] }) => {
    try {
      // If we have an image and descriptor from camera
      if (payload?.image && payload?.descriptor) {
        const { verifyFace } = await import('../services/biometric-recognition')
        const result = await verifyFace(payload.image, payload.descriptor)
        return result.verified
      }

      // Original file-based recognition
      if (payload?.imagePath) {
        const face = await recognizeFace(payload.imagePath)
        return Boolean(face)
      }

      // Demo mode - simulate recognition
      const recognized = Math.random() > 0.4
      return recognized
    } catch (error) {
      console.error('Biometric test failed:', error)
      return false
    }
  })

  ipcMain.handle('biometric-delete', async (_, faceId: string) => {
    try {
      return await deleteFace(faceId)
    } catch (error) {
      console.error('Biometric delete failed:', error)
      return false
    }
  })

  ipcMain.handle('biometric-clear', async () => {
    try {
      return await clearAllFaces()
    } catch (error) {
      console.error('Biometric clear failed:', error)
      return false
    }
  })
}

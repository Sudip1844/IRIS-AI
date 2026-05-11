import { app, ipcMain, desktopCapturer, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { randomUUID } from 'crypto'

export type FaceDescriptor = number[]

export type FaceRecord = {
  id: string
  name: string
  imagePath: string
  descriptor: FaceDescriptor
  enrolledAt: string
  source: 'camera' | 'file'
}

const BIOMETRIC_DATA_FILE = path.join(app.getPath('userData'), 'mj_biometric_faces.json')
const BIOMETRIC_IMAGE_DIR = path.join(app.getPath('userData'), 'mj_biometric_images')

async function ensureStorage() {
  if (!fs.existsSync(BIOMETRIC_IMAGE_DIR)) {
    fs.mkdirSync(BIOMETRIC_IMAGE_DIR, { recursive: true })
  }

  if (!fs.existsSync(BIOMETRIC_DATA_FILE)) {
    await fsp.writeFile(BIOMETRIC_DATA_FILE, JSON.stringify([]))
  }
}

async function readFaces(): Promise<FaceRecord[]> {
  await ensureStorage()
  const fileContents = await fsp.readFile(BIOMETRIC_DATA_FILE, 'utf-8')
  try {
    return JSON.parse(fileContents) as FaceRecord[]
  } catch {
    return []
  }
}

async function writeFaces(faces: FaceRecord[]) {
  await fsp.writeFile(BIOMETRIC_DATA_FILE, JSON.stringify(faces, null, 2), 'utf-8')
}

export async function listEnrolledFaces(): Promise<FaceRecord[]> {
  return readFaces()
}

export async function enrollFace(
  imagePath: string,
  name: string,
  descriptor?: FaceDescriptor
): Promise<FaceRecord> {
  await ensureStorage()

  const fileName = `${Date.now()}-${randomUUID()}-${path.basename(imagePath || 'capture.jpg')}`
  const targetPath = path.join(BIOMETRIC_IMAGE_DIR, fileName)

  if (imagePath && fs.existsSync(imagePath)) {
    await fsp.copyFile(imagePath, targetPath)
  }

  const faces = await readFaces()
  const newFace: FaceRecord = {
    id: randomUUID(),
    name,
    imagePath: targetPath,
    descriptor: descriptor || [],
    enrolledAt: new Date().toISOString(),
    source: 'file'
  }

  faces.push(newFace)
  await writeFaces(faces)
  return newFace
}

export async function enrollFaceWithDescriptor(
  name: string,
  base64Image: string,
  descriptor: FaceDescriptor
): Promise<FaceRecord> {
  await ensureStorage()

  const fileName = `${Date.now()}-${randomUUID()}.jpg`
  const targetPath = path.join(BIOMETRIC_IMAGE_DIR, fileName)

  // Save the base64 image
  const imageBuffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  await fsp.writeFile(targetPath, imageBuffer)

  const faces = await readFaces()
  const newFace: FaceRecord = {
    id: randomUUID(),
    name,
    imagePath: targetPath,
    descriptor,
    enrolledAt: new Date().toISOString(),
    source: 'camera'
  }

  faces.push(newFace)
  await writeFaces(faces)
  return newFace
}

export async function recognizeFaceByDescriptor(
  descriptor: FaceDescriptor,
  threshold: number = 0.5
): Promise<FaceRecord | null> {
  if (!descriptor || descriptor.length === 0) {
    return null
  }

  const faces = await readFaces()
  if (faces.length === 0) {
    return null
  }

  let bestMatch: FaceRecord | null = null
  let bestDistance = threshold

  for (const face of faces) {
    if (!face.descriptor || face.descriptor.length === 0) {
      continue
    }

    const distance = euclideanDistance(descriptor, face.descriptor)
    if (distance < bestDistance) {
      bestDistance = distance
      bestMatch = face
    }
  }

  return bestMatch
}

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 1

  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2)
  }
  return Math.sqrt(sum)
}

export async function recognizeFace(imagePath: string): Promise<FaceRecord | null> {
  const faces = await readFaces()
  const fileName = path.basename(imagePath)
  return faces.find((face) => path.basename(face.imagePath) === fileName) ?? null
}

export async function scanFromCamera(): Promise<{ success: boolean; message: string }> {
  // Get available screen sources
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 320, height: 240 }
  })

  if (sources.length === 0) {
    return {
      success: false,
      message: 'No screen sources available for scanning.'
    }
  }

  // In a real implementation, this would:
  // 1. Capture a frame from the camera/screen
  // 2. Use face-api to detect and extract descriptors
  // 3. Compare with enrolled faces
  // For now, return info about the capability

  return {
    success: true,
    message: 'Camera scanning ready. Use "Enroll New Face" to add faces or "Test Recognition" to verify.'
  }
}

export async function verifyFace(
  base64Image: string,
  descriptor: FaceDescriptor
): Promise<{ verified: boolean; matchedFace?: FaceRecord }> {
  try {
    const matched = await recognizeFaceByDescriptor(descriptor, 0.5)

    if (matched) {
      return {
        verified: true,
        matchedFace: matched
      }
    }

    return { verified: false }
  } catch (error) {
    console.error('[MJ] Face verification error:', error)
    return { verified: false }
  }
}

export async function deleteFace(faceId: string): Promise<boolean> {
  try {
    const faces = await readFaces()
    const faceIndex = faces.findIndex((f) => f.id === faceId)

    if (faceIndex === -1) {
      return false
    }

    const face = faces[faceIndex]

    // Delete the image file
    if (face.imagePath && fs.existsSync(face.imagePath)) {
      await fsp.unlink(face.imagePath)
    }

    // Remove from array
    faces.splice(faceIndex, 1)
    await writeFaces(faces)

    return true
  } catch (error) {
    console.error('[MJ] Delete face error:', error)
    return false
  }
}

export async function clearAllFaces(): Promise<boolean> {
  try {
    // Delete all image files
    if (fs.existsSync(BIOMETRIC_IMAGE_DIR)) {
      const files = await fsp.readdir(BIOMETRIC_IMAGE_DIR)
      for (const file of files) {
        await fsp.unlink(path.join(BIOMETRIC_IMAGE_DIR, file))
      }
    }

    // Clear the database
    await writeFaces([])
    return true
  } catch (error) {
    console.error('[MJ] Clear faces error:', error)
    return false
  }
}

export function registerBiometricIPC() {
  ipcMain.handle('biometric-get-descriptor-path', async () => {
    return BIOMETRIC_DATA_FILE
  })

  ipcMain.handle('biometric-save-descriptor', async (_, data: { name: string; image: string; descriptor: number[] }) => {
    try {
      await enrollFaceWithDescriptor(data.name, data.image, data.descriptor)
      return { success: true }
    } catch (error) {
      console.error('[MJ] Save descriptor error:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('biometric-verify-descriptor', async (_, data: { image: string; descriptor: number[] }) => {
    try {
      const result = await verifyFace(data.image, data.descriptor)
      return result
    } catch (error) {
      console.error('[MJ] Verify descriptor error:', error)
      return { verified: false }
    }
  })

  ipcMain.handle('biometric-delete', async (_, faceId: string) => {
    return deleteFace(faceId)
  })

  ipcMain.handle('biometric-clear', async () => {
    return clearAllFaces()
  })
}

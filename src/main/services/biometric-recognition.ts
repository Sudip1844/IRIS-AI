import { app } from 'electron'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { randomUUID } from 'crypto'

export type FaceRecord = {
  id: string
  name: string
  imagePath: string
  enrolledAt: string
  source: string
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

export async function enrollFace(imagePath: string, name: string): Promise<FaceRecord> {
  await ensureStorage()

  const fileName = `${Date.now()}-${path.basename(imagePath)}`
  const targetPath = path.join(BIOMETRIC_IMAGE_DIR, fileName)
  await fsp.copyFile(imagePath, targetPath)

  const faces = await readFaces()
  const newFace: FaceRecord = {
    id: randomUUID(),
    name,
    imagePath: targetPath,
    enrolledAt: new Date().toISOString(),
    source: 'file'
  }

  faces.push(newFace)
  await writeFaces(faces)
  return newFace
}

export async function recognizeFace(imagePath: string): Promise<FaceRecord | null> {
  const faces = await readFaces()
  const fileName = path.basename(imagePath)
  return faces.find((face) => path.basename(face.imagePath) === fileName) ?? null
}

export async function scanFromCamera(): Promise<{ success: boolean; message: string }> {
  return {
    success: false,
    message: 'Camera scanning is not configured. Enroll a face first using imagePath and name.'
  }
}

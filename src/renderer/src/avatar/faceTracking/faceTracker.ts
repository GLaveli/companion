import type { GazeTarget } from '../gazeTypes'
import { polishGazeTarget, resetGazeSmoothing, smoothGazeSample } from '../gazePolish'
import type { FaceTrackerStatus } from './types'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const NOSE_TIP = 1
const LEFT_EYE = 33
const RIGHT_EYE = 263

type NormalizedLandmark = { x: number; y: number; z?: number }
type FaceLandmarkerResult = {
  faceLandmarks?: NormalizedLandmark[][]
}

type FaceLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => FaceLandmarkerResult
  close: () => void
}

let status: FaceTrackerStatus = { state: 'idle', message: '' }
let currentGaze: GazeTarget | null = null
let videoEl: HTMLVideoElement | null = null
let landmarker: FaceLandmarkerInstance | null = null
let rafId = 0
let lastVideoTime = -1
let starting: Promise<void> | null = null

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function setStatus(state: FaceTrackerStatus['state'], message: string): void {
  status = { state, message }
}

function landmarksToGaze(points: NormalizedLandmark[]): GazeTarget {
  const nose = points[NOSE_TIP]
  const leftEye = points[LEFT_EYE]
  const rightEye = points[RIGHT_EYE]

  const cx = (leftEye.x + rightEye.x + nose.x) / 3
  const cy = (leftEye.y + rightEye.y + nose.y) / 3

  // Webcam espelhada: rosto à esquerda na imagem = usuário à esquerda do monitor.
  const mirrorX = 1 - cx
  const dx = (mirrorX - 0.5) * 2.4
  const dy = (cy - 0.5) * 2.2

  const eyeX = clamp(dx, -1, 1)
  const eyeY = clamp(-dy, -1, 1)

  return polishGazeTarget({
    eyeX,
    eyeY,
    angleX: clamp(eyeX * 28, -30, 30),
    angleY: clamp(eyeY * 20, -24, 24)
  })
}

function tick(): void {
  if (!videoEl || !landmarker) return

  if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    const now = performance.now()
    if (videoEl.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.currentTime
      const result = landmarker.detectForVideo(videoEl, now)
      const landmarks = result.faceLandmarks?.[0]
      const raw = landmarks?.length ? landmarksToGaze(landmarks) : null
      currentGaze = smoothGazeSample(raw, 0.26)
    }
  } else {
    currentGaze = smoothGazeSample(null)
  }

  rafId = requestAnimationFrame(tick)
}

async function createLandmarker(): Promise<FaceLandmarkerInstance> {
  const vision = await import('@mediapipe/tasks-vision')
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE)
  const options = {
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  }

  try {
    return await vision.FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' }
    })
  } catch {
    return await vision.FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' }
    })
  }
}

async function openCamera(): Promise<HTMLVideoElement> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  })

  const video = document.createElement('video')
  video.autoplay = true
  video.playsInline = true
  video.muted = true
  video.style.position = 'fixed'
  video.style.width = '1px'
  video.style.height = '1px'
  video.style.opacity = '0'
  video.style.pointerEvents = 'none'
  video.style.left = '-9999px'
  video.srcObject = stream
  document.body.appendChild(video)

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('Não foi possível iniciar a câmera.'))
  })

  await video.play()
  return video
}

function closeCamera(): void {
  if (!videoEl) return
  const stream = videoEl.srcObject
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) track.stop()
  }
  videoEl.remove()
  videoEl = null
}

export function getFaceGazeTarget(): GazeTarget | null {
  return currentGaze
}

export function getFaceTrackerStatus(): FaceTrackerStatus {
  return status
}

export async function startFaceTracker(): Promise<void> {
  if (status.state === 'active') return
  if (starting) return starting

  starting = (async () => {
    setStatus('starting', 'Abrindo câmera…')
    currentGaze = null

    try {
      videoEl = await openCamera()
      setStatus('starting', 'Carregando rastreador facial…')
      landmarker = await createLandmarker()
      lastVideoTime = -1
      setStatus('active', 'Rastreando seu rosto.')
      rafId = requestAnimationFrame(tick)
    } catch (err) {
      stopFaceTracker()
      const message =
        err instanceof Error ? err.message : 'Não foi possível usar a câmera para olhar.'
      setStatus('error', message)
      throw err
    } finally {
      starting = null
    }
  })()

  return starting
}

export function stopFaceTracker(): void {
  starting = null
  cancelAnimationFrame(rafId)
  rafId = 0
  lastVideoTime = -1
  currentGaze = null
  resetGazeSmoothing()

  landmarker?.close()
  landmarker = null
  closeCamera()

  if (status.state !== 'error') {
    setStatus('idle', '')
  }
}

export function resetFaceTrackerError(): void {
  if (status.state === 'error') {
    setStatus('idle', '')
  }
}

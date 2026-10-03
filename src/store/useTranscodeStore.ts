import { create } from 'zustand'
import type { VideoMetadata, TranscodeConfig, ProgressState, PresetType, BatchItem, SpeedMode, ResolutionMode } from '../types'
import { getTranscodeWorker, terminateWorker } from '../lib/workerManager'
import { saveTranscodedFile } from '../lib/fileSystem'
import { proxy } from 'comlink'

interface TranscodeStore {
  // Cross-origin and runtime status
  isCrossOriginIsolated: boolean
  isMultithreadSupported: boolean
  isInitializing: boolean
  isWasmReady: boolean

  // File & Video State (Current / active item)
  file: File | null
  videoUrl: string | null
  metadata: VideoMetadata | null

  // Batch queue state
  queue: BatchItem[]
  activeQueueIndex: number

  // Configuration
  config: TranscodeConfig

  // Transcoding Execution State
  isTranscoding: boolean
  progress: ProgressState
  logs: string[]
  outputBlob: Blob | null
  outputName: string | null
  errorMessage: string | null

  // Actions
  checkIsolation: () => void
  initWasm: () => Promise<void>
  setFile: (file: File) => Promise<void>
  addFilesToQueue: (files: File[]) => Promise<void>
  selectQueueItem: (index: number) => void
  removeQueueItem: (id: string) => void
  clearQueue: () => void
  clearFile: () => void
  setConfig: (partial: Partial<TranscodeConfig>) => void
  setPreset: (preset: PresetType) => void
  setSpeedMode: (speedMode: SpeedMode) => void
  setResolution: (resolution: ResolutionMode) => void
  startTranscoding: () => Promise<void>
  startBatchTranscoding: () => Promise<void>
  cancelTranscoding: () => Promise<void>
  downloadResult: () => Promise<void>
  downloadBatchItem: (item: BatchItem) => Promise<void>
  reset: () => void
}

const initialProgress: ProgressState = {
  progress: 0,
  stage: 'queued',
  stageDescription: 'Ready to process video file',
  time: '00:00:00',
  fps: 0,
  speed: '0x',
  bitrate: '0 kbps',
  frame: 0,
}

const initialConfig: TranscodeConfig = {
  preset: 'web-fast',
  speedMode: 'turbo',
  resolution: '720p',
  trim: {
    enabled: false,
    start: 0,
    end: 0,
  },
  audioPassThrough: false,
}

// Helper to extract metadata from a video File
async function extractMetadata(file: File): Promise<{ metadata: VideoMetadata; videoUrl: string }> {
  const videoUrl = URL.createObjectURL(file)
  const tempVideo = document.createElement('video')
  tempVideo.preload = 'metadata'
  tempVideo.src = videoUrl

  const metadata = await new Promise<VideoMetadata>((resolve) => {
    tempVideo.onloadedmetadata = () => {
      const duration = tempVideo.duration || 0
      const width = tempVideo.videoWidth || 1920
      const height = tempVideo.videoHeight || 1080
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
      const d = gcd(width, height)
      const aspectRatio = `${width / d}:${height / d}`

      resolve({
        name: file.name,
        size: file.size,
        type: file.type || 'video/mp4',
        duration,
        width,
        height,
        aspectRatio,
      })
    }
    tempVideo.onerror = () => {
      resolve({
        name: file.name,
        size: file.size,
        type: file.type || 'video/mp4',
        duration: 0,
        width: 0,
        height: 0,
        aspectRatio: 'N/A',
      })
    }
  })

  return { metadata, videoUrl }
}

export const useTranscodeStore = create<TranscodeStore>((set, get) => ({
  isCrossOriginIsolated: typeof window !== 'undefined' ? window.crossOriginIsolated : false,
  isMultithreadSupported: false,
  isInitializing: false,
  isWasmReady: false,

  file: null,
  videoUrl: null,
  metadata: null,
  queue: [],
  activeQueueIndex: 0,

  config: initialConfig,

  isTranscoding: false,
  progress: initialProgress,
  logs: [],
  outputBlob: null,
  outputName: null,
  errorMessage: null,

  checkIsolation: () => {
    const isolated = typeof window !== 'undefined' ? window.crossOriginIsolated : false
    set({
      isCrossOriginIsolated: isolated,
      isMultithreadSupported: isolated,
    })
  },

  initWasm: async () => {
    const { isWasmReady, isInitializing, isMultithreadSupported } = get()
    if (isWasmReady || isInitializing) return

    set({ isInitializing: true, errorMessage: null })

    try {
      const worker = getTranscodeWorker()
      await worker.init(isMultithreadSupported)
      set({ isWasmReady: true, isInitializing: false })
    } catch (err: unknown) {
      console.error('Wasm init error:', err)
      set({
        isInitializing: false,
        isWasmReady: false,
        errorMessage: (err as Error).message || 'Failed to initialize WebAssembly FFmpeg core',
      })
    }
  },

  setFile: async (file: File) => {
    const prevUrl = get().videoUrl
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl)
    }

    const { metadata, videoUrl } = await extractMetadata(file)

    const batchItem: BatchItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      metadata,
      status: 'pending',
      progress: {
        ...initialProgress,
        stageDescription: `Queued: ${file.name}`,
      },
    }

    set({
      file,
      videoUrl,
      metadata,
      queue: [batchItem],
      activeQueueIndex: 0,
      outputBlob: null,
      outputName: null,
      errorMessage: null,
      progress: initialProgress,
      logs: [],
      config: {
        ...get().config,
        trim: {
          enabled: false,
          start: 0,
          end: metadata.duration,
        },
      },
    })
  },

  addFilesToQueue: async (files: File[]) => {
    if (files.length === 0) return

    const newItems: BatchItem[] = []
    for (const f of files) {
      const { metadata } = await extractMetadata(f)
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file: f,
        metadata,
        status: 'pending',
        progress: {
          ...initialProgress,
          stageDescription: `Queued: ${f.name}`,
        },
      })
    }

    const currentQueue = get().queue
    const updatedQueue = [...currentQueue, ...newItems]

    // If no active file, select the first
    if (!get().file && updatedQueue.length > 0) {
      const first = updatedQueue[0]
      const { videoUrl } = await extractMetadata(first.file)
      set({
        file: first.file,
        videoUrl,
        metadata: first.metadata || null,
        queue: updatedQueue,
        activeQueueIndex: 0,
      })
    } else {
      set({ queue: updatedQueue })
    }
  },

  selectQueueItem: async (index: number) => {
    const { queue } = get()
    if (index < 0 || index >= queue.length) return
    const item = queue[index]
    const { metadata, videoUrl } = await extractMetadata(item.file)

    set({
      file: item.file,
      videoUrl,
      metadata,
      activeQueueIndex: index,
      outputBlob: item.outputBlob || null,
      outputName: item.outputName || null,
      progress: item.progress,
    })
  },

  removeQueueItem: (id: string) => {
    const { queue, activeQueueIndex } = get()
    const newQueue = queue.filter(item => item.id !== id)
    if (newQueue.length === 0) {
      get().reset()
      return
    }

    const newIndex = Math.min(activeQueueIndex, newQueue.length - 1)
    const activeItem = newQueue[newIndex]
    set({
      queue: newQueue,
      activeQueueIndex: newIndex,
      file: activeItem.file,
      metadata: activeItem.metadata || null,
      outputBlob: activeItem.outputBlob || null,
      outputName: activeItem.outputName || null,
      progress: activeItem.progress,
    })
  },

  clearQueue: () => {
    get().reset()
  },

  clearFile: () => {
    get().reset()
  },

  setConfig: (partial) => {
    set({
      config: {
        ...get().config,
        ...partial,
      },
    })
  },

  setPreset: (preset) => {
    set({
      config: {
        ...get().config,
        preset,
      },
    })
  },

  setSpeedMode: (speedMode) => {
    set({
      config: {
        ...get().config,
        speedMode,
      },
    })
  },

  setResolution: (resolution) => {
    set({
      config: {
        ...get().config,
        resolution,
      },
    })
  },

  startTranscoding: async () => {
    // If multiple items are in queue, delegate to startBatchTranscoding
    const { queue } = get()
    if (queue.length > 1) {
      await get().startBatchTranscoding()
      return
    }

    const { file, config, metadata, isWasmReady, initWasm } = get()
    if (!file) return

    if (!isWasmReady) {
      await initWasm()
    }

    set({
      isTranscoding: true,
      errorMessage: null,
      outputBlob: null,
      outputName: null,
      progress: {
        progress: 1,
        stage: 'reading',
        stageDescription: `Reading "${file.name}" into virtual memory...`,
        time: '00:00:00',
        fps: 0,
        speed: '1.0x',
        bitrate: 'Initializing...',
        frame: 0,
      },
      logs: [],
    })

    try {
      const worker = getTranscodeWorker()

      const onProgressProxy = proxy((progress: ProgressState) => {
        set({ progress })
      })

      const onLogProxy = proxy((log: string) => {
        set((state) => ({
          logs: [...state.logs.slice(-100), log],
        }))
      })

      const fullConfig = {
        ...config,
        duration: metadata?.duration || 60,
      }

      const result = await worker.transcode(file, fullConfig, onProgressProxy, onLogProxy)

      set({
        isTranscoding: false,
        outputBlob: result.outputBlob,
        outputName: result.outputName,
      })

      // Update queue item
      const { queue, activeQueueIndex } = get()
      if (queue[activeQueueIndex]) {
        const updated = [...queue]
        updated[activeQueueIndex] = {
          ...updated[activeQueueIndex],
          status: 'completed',
          outputBlob: result.outputBlob,
          outputName: result.outputName,
          progress: {
            progress: 100,
            stage: 'completed',
            stageDescription: 'Transcoding completed',
            time: 'Done',
            fps: 0,
            speed: '1.0x',
            bitrate: 'Completed',
            frame: 0,
          },
        }
        set({ queue: updated })
      }
    } catch (err: unknown) {
      console.error('Transcode failure:', err)
      set({
        isTranscoding: false,
        errorMessage: (err as Error).message || 'Transcoding operation failed',
      })
    }
  },

  startBatchTranscoding: async () => {
    const { queue, config, isWasmReady, initWasm } = get()
    if (queue.length === 0) return

    if (!isWasmReady) {
      await initWasm()
    }

    set({ isTranscoding: true, errorMessage: null })

    const worker = getTranscodeWorker()

    for (let i = 0; i < queue.length; i++) {
      const item = get().queue[i]
      if (item.status === 'completed') continue

      // Switch active display to current item
      set({
        activeQueueIndex: i,
        file: item.file,
        metadata: item.metadata || null,
      })

      // Mark current item as processing
      const processingQueue = [...get().queue]
      processingQueue[i] = {
        ...processingQueue[i],
        status: 'processing',
        progress: {
          progress: 1,
          stage: 'reading',
          stageDescription: `[${i + 1}/${queue.length}] Reading "${item.file.name}"...`,
          time: '00:00:00',
          fps: 0,
          speed: '1.0x',
          bitrate: 'Loading...',
          frame: 0,
        },
      }
      set({ queue: processingQueue })

      try {
        const onProgressProxy = proxy((progress: ProgressState) => {
          set((state) => {
            const q = [...state.queue]
            if (q[i]) {
              q[i] = {
                ...q[i],
                progress: {
                  ...progress,
                  stageDescription: `[${i + 1}/${state.queue.length}] ${progress.stageDescription}`,
                },
              }
            }
            return {
              progress: {
                ...progress,
                stageDescription: `[${i + 1}/${state.queue.length}] ${progress.stageDescription}`,
              },
              queue: q,
            }
          })
        })

        const onLogProxy = proxy((log: string) => {
          set((state) => ({
            logs: [...state.logs.slice(-100), log],
          }))
        })

        const fullConfig = {
          ...config,
          duration: item.metadata?.duration || 60,
        }

        const result = await worker.transcode(item.file, fullConfig, onProgressProxy, onLogProxy)

        set((state) => {
          const q = [...state.queue]
          if (q[i]) {
            q[i] = {
              ...q[i],
              status: 'completed',
              outputBlob: result.outputBlob,
              outputName: result.outputName,
              progress: {
                progress: 100,
                stage: 'completed',
                stageDescription: `[${i + 1}/${state.queue.length}] Completed: ${result.outputName}`,
                time: 'Done',
                fps: 0,
                speed: '1.0x',
                bitrate: 'Done',
                frame: 0,
              },
            }
          }
          return {
            queue: q,
            outputBlob: i === state.activeQueueIndex ? result.outputBlob : state.outputBlob,
            outputName: i === state.activeQueueIndex ? result.outputName : state.outputName,
          }
        })
      } catch (err: unknown) {
        console.error(`Batch transcode error on item ${i}:`, err)
        set((state) => {
          const q = [...state.queue]
          if (q[i]) {
            q[i] = {
              ...q[i],
              status: 'error',
              errorMessage: (err as Error).message || 'Failed',
            }
          }
          return { queue: q }
        })
      }
    }

    set({ isTranscoding: false })
  },

  cancelTranscoding: async () => {
    try {
      const worker = getTranscodeWorker()
      await worker.cancel()
    } catch (e) {
      console.warn('Error during worker cancel:', e)
    } finally {
      await terminateWorker()
      set({
        isTranscoding: false,
        isWasmReady: false,
        errorMessage: 'Transcoding process cancelled by user.',
      })
    }
  },

  downloadResult: async () => {
    const { outputBlob, outputName } = get()
    if (!outputBlob || !outputName) return
    await saveTranscodedFile(outputBlob, outputName)
  },

  downloadBatchItem: async (item: BatchItem) => {
    if (!item.outputBlob || !item.outputName) return
    await saveTranscodedFile(item.outputBlob, item.outputName)
  },

  reset: () => {
    const { videoUrl } = get()
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    set({
      file: null,
      videoUrl: null,
      metadata: null,
      queue: [],
      activeQueueIndex: 0,
      outputBlob: null,
      outputName: null,
      errorMessage: null,
      progress: initialProgress,
      logs: [],
      config: initialConfig,
    })
  },
}))

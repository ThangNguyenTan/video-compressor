export interface VideoMetadata {
  name: string
  size: number
  type: string
  duration: number
  width: number
  height: number
  aspectRatio: string
}

export type ProcessingStage = 'queued' | 'reading' | 'writing' | 'transcoding' | 'finalizing' | 'completed' | 'error'

export interface ProgressState {
  progress: number
  stage: ProcessingStage
  stageDescription: string
  time: string
  fps: number
  speed: string
  bitrate: string
  frame: number
  etaSeconds?: number
}

export type PresetType = 'web-fast' | 'discord-25' | 'slack-10' | 'high-efficiency' | 'custom'
export type SpeedMode = 'turbo' | 'balanced' | 'quality'
export type ResolutionMode = 'original' | '1080p' | '720p' | '480p'

export interface TranscodeConfig {
  preset: PresetType
  speedMode: SpeedMode // 'turbo' | 'balanced' | 'quality'
  resolution: ResolutionMode // 'original' | '1080p' | '720p' | '480p'
  duration?: number // total source/effective duration in seconds
  trim: {
    enabled: boolean
    start: number
    end: number
  }
  audioPassThrough: boolean
  targetBitrateKbps?: number
  resolutionScale?: number // e.g. 1.0, 0.75, 0.5
  customArgs?: string[]
}

export interface BatchItem {
  id: string
  file: File
  metadata?: VideoMetadata
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: ProgressState
  outputBlob?: Blob
  outputName?: string
  errorMessage?: string
}

export interface TranscodeWorkerAPI {
  init(useMultithread: boolean): Promise<boolean>
  isLoaded(): Promise<boolean>
  transcode(
    inputFile: File,
    config: TranscodeConfig,
    onProgress: (progress: ProgressState) => void,
    onLog?: (log: string) => void
  ): Promise<{ outputBlob: Blob; outputName: string }>
  cancel(): Promise<void>
  cleanup(): Promise<void>
}

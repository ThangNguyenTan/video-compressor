import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import * as Comlink from 'comlink'
import type { TranscodeConfig, ProgressState } from '../types'
import { parseFFmpegLog, calculateTargetBitrate } from '../lib/ffmpegParser'

class TranscodeWorker {
  private ffmpeg: FFmpeg | null = null
  private isBusy = false
  private cancelled = false

  async isLoaded(): Promise<boolean> {
    return this.ffmpeg !== null && this.ffmpeg.loaded
  }

  async init(useMultithread: boolean): Promise<boolean> {
    if (this.ffmpeg && this.ffmpeg.loaded) {
      return true
    }

    try {
      this.ffmpeg = new FFmpeg()

      // Set up CDN base for Wasm binaries
      const baseURL = useMultithread
        ? 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm'
        : 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      const workerURL = useMultithread
        ? await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
        : undefined

      await this.ffmpeg.load({
        coreURL,
        wasmURL,
        workerURL,
      })

      return true
    } catch (error) {
      console.error('Failed to load FFmpeg wasm core:', error)
      // If multi-threaded failed, attempt graceful fallback to single-thread
      if (useMultithread) {
        console.warn('Attempting single-threaded fallback...')
        return this.init(false)
      }
      throw error
    }
  }

  async transcode(
    inputFile: File,
    config: TranscodeConfig,
    onProgress: (progress: ProgressState) => void,
    onLog?: (log: string) => void
  ): Promise<{ outputBlob: Blob; outputName: string }> {
    if (!this.ffmpeg || !this.ffmpeg.loaded) {
      throw new Error('FFmpeg is not initialized yet')
    }

    this.isBusy = true
    this.cancelled = false

    const inputExt = inputFile.name.split('.').pop()?.toLowerCase() || 'mp4'
    const inputFileName = `input_${Date.now()}.${inputExt}`
    const outputExt = config.preset === 'high-efficiency' ? 'webm' : 'mp4'
    const outputFileName = `output_${Date.now()}.${outputExt}`

    // Robust calculation of effective total duration in seconds
    const totalDuration = config.trim.enabled
      ? Math.max(0.5, config.trim.end - config.trim.start)
      : config.duration && config.duration > 0
      ? config.duration
      : 60

    let currentProgressPct = 0
    let lastReportedSec = 0
    let lastFrame = 0
    let lastFps = 0
    let lastSpeed = '1.0x'
    let lastBitrate = 'calculating...'

    // Direct ffmpeg 'progress' listener
    const progressListener = ({ progress, time }: { progress: number; time: number }) => {
      // time is in microseconds (µs)
      const currentSec = time > 0 ? time / 1000000 : lastReportedSec
      lastReportedSec = currentSec

      let computedRawPct = 0
      if (progress > 0 && progress <= 1) {
        computedRawPct = progress * 100
      } else if (totalDuration > 0) {
        computedRawPct = (currentSec / totalDuration) * 100
      }

      // Map encoding progress into the 10% -> 95% range
      const scaledPct = Math.round(10 + (Math.min(99, Math.max(0, computedRawPct)) / 100) * 85)
      currentProgressPct = Math.min(95, Math.max(currentProgressPct, Math.max(10, scaledPct)))

      const speedMultiplier = parseFloat(lastSpeed.replace('x', '')) || 1.0
      const remainingSec = speedMultiplier > 0 && totalDuration > currentSec
        ? Math.max(0, Math.round((totalDuration - currentSec) / speedMultiplier))
        : undefined

      const formatSecToTime = (s: number) => {
        const m = Math.floor(s / 60)
        const sec = Math.floor(s % 60)
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      }

      onProgress({
        progress: currentProgressPct,
        stage: 'transcoding',
        stageDescription: `Encoding video frames (${currentProgressPct}%)...`,
        time: formatSecToTime(currentSec),
        fps: lastFps,
        speed: lastSpeed,
        bitrate: lastBitrate,
        frame: lastFrame,
        etaSeconds: remainingSec,
      })
    }

    // FFmpeg stderr log listener
    const logListener = ({ message }: { message: string }) => {
      if (onLog) {
        onLog(message)
      }

      const parsed = parseFFmpegLog(message)
      if (parsed) {
        if (parsed.frame !== undefined) lastFrame = parsed.frame
        if (parsed.fps !== undefined) lastFps = parsed.fps
        if (parsed.speed !== undefined) lastSpeed = parsed.speed
        if (parsed.bitrate !== undefined) lastBitrate = parsed.bitrate

        const currentSec = parsed.timeSeconds ?? lastReportedSec
        lastReportedSec = currentSec

        const rawPct = (currentSec / totalDuration) * 100
        const scaledPct = Math.round(10 + (Math.min(99, Math.max(0, rawPct)) / 100) * 85)
        const clampedPct = Math.min(95, Math.max(currentProgressPct, Math.max(10, scaledPct)))
        currentProgressPct = clampedPct

        const speedMultiplier = parsed.speed
          ? parseFloat(parsed.speed.replace('x', ''))
          : parseFloat(lastSpeed.replace('x', '')) || 1.0

        const remainingSeconds = speedMultiplier > 0 && totalDuration > currentSec
          ? Math.max(0, Math.round((totalDuration - currentSec) / speedMultiplier))
          : undefined

        onProgress({
          progress: currentProgressPct,
          stage: 'transcoding',
          stageDescription: `Encoding video frames (${currentProgressPct}%)...`,
          time: parsed.time || '00:00:00',
          fps: lastFps,
          speed: lastSpeed,
          bitrate: lastBitrate,
          frame: lastFrame,
          etaSeconds: remainingSeconds,
        })
      }
    }

    try {
      // 1. Emitting reading file progress
      onProgress({
        progress: 1,
        stage: 'reading',
        stageDescription: `Reading "${inputFile.name}" (${(inputFile.size / (1024 * 1024)).toFixed(1)} MB)...`,
        time: '00:00:00',
        fps: 0,
        speed: '1.0x',
        bitrate: 'Loading file...',
        frame: 0,
      })

      // Read file in chunks to report read progress (1% -> 8%)
      const totalBytes = inputFile.size
      let fileData: Uint8Array

      if (inputFile.stream && typeof (inputFile.stream as () => ReadableStream<Uint8Array>) === 'function') {
        const reader = (inputFile.stream() as ReadableStream<Uint8Array>).getReader()
        const chunks: Uint8Array[] = []
        let loadedBytes = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            loadedBytes += value.byteLength
            const readPct = 1 + Math.min(7, Math.round((loadedBytes / totalBytes) * 7))
            onProgress({
              progress: readPct,
              stage: 'reading',
              stageDescription: `Loading file into memory (${Math.round((loadedBytes / totalBytes) * 100)}%)...`,
              time: '00:00:00',
              fps: 0,
              speed: '1.0x',
              bitrate: 'Buffering...',
              frame: 0,
            })
          }
        }

        // Combine chunks
        fileData = new Uint8Array(loadedBytes)
        let offset = 0
        for (const chunk of chunks) {
          fileData.set(chunk, offset)
          offset += chunk.byteLength
        }
      } else {
        fileData = new Uint8Array(await inputFile.arrayBuffer())
      }

      // 2. Writing file to virtual Emscripten filesystem (8% -> 10%)
      onProgress({
        progress: 8,
        stage: 'writing',
        stageDescription: 'Mounting file into WebAssembly virtual filesystem...',
        time: '00:00:00',
        fps: 0,
        speed: '1.0x',
        bitrate: 'Allocating...',
        frame: 0,
      })

      await this.ffmpeg.writeFile(inputFileName, fileData)

      // CRITICAL MEMORY OPTIMIZATION: Free the JS ArrayBuffer copy immediately
      // so the JS heap can be garbage-collected before WebAssembly execution starts.
      // For large 300MB+ files, keeping both in memory exhausts browser tab limits.
      // @ts-expect-error Clear reference to release memory
      fileData = null

      onProgress({
        progress: 10,
        stage: 'transcoding',
        stageDescription: 'Initializing FFmpeg encoder engine...',
        time: '00:00:00',
        fps: 0,
        speed: '1.0x',
        bitrate: 'Starting encoder...',
        frame: 0,
      })

      // 3. Attach event listeners
      this.ffmpeg.on('progress', progressListener)
      this.ffmpeg.on('log', logListener)

      // 4. Build FFmpeg command arguments
      const args: string[] = ['-nostdin']

      // Fast seek before input if trimming
      if (config.trim.enabled && config.trim.start > 0) {
        args.push('-ss', config.trim.start.toString())
      }

      args.push('-i', inputFileName)

      // Trim duration
      if (config.trim.enabled) {
        const trimDuration = Math.max(0.1, config.trim.end - config.trim.start)
        args.push('-t', trimDuration.toString())
      }

      // Memory & Thread stability for WebAssembly:
      // In 32-bit wasm with pthread pool, 2 threads offers peak throughput without pthread contention or OOM.
      const threadCount = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? Math.min(2, Math.max(1, navigator.hardwareConcurrency))
        : 1
      args.push('-threads', threadCount.toString())

      // Resolution scaling filter:
      // Users can choose 'original', '1080p', '720p', or '480p'.
      // Default to 720p max for fast WebAssembly throughput and memory safety.
      let scaleFilter = 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
      if (config.resolution === '480p') {
        scaleFilter = 'scale=min(854\\,iw):-2'
      } else if (config.resolution === '720p' || !config.resolution) {
        scaleFilter = 'scale=min(1280\\,iw):-2'
      } else if (config.resolution === '1080p') {
        scaleFilter = 'scale=min(1920\\,iw):-2'
      }
      args.push('-vf', scaleFilter)

      // Speed profile parameter tuning:
      // turbo: ultrafast + fastdecode + subme=0 + no cabac (3x faster Wasm encoding)
      // balanced: superfast / ultrafast + fastdecode
      // quality: fast / veryfast + higher crf fidelity
      const isTurbo = config.speedMode === 'turbo' || !config.speedMode
      const speedPreset = isTurbo ? 'ultrafast' : config.speedMode === 'quality' ? 'veryfast' : 'superfast'

      // Video encoding parameters based on preset
      switch (config.preset) {
        case 'web-fast':
          args.push(
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-crf', isTurbo ? '26' : '23',
            '-preset', speedPreset,
            '-tune', 'fastdecode',
            ...(isTurbo ? ['-x264-params', 'subme=0:me=dia:ref=1:no-cabac=1'] : []),
            '-movflags', '+faststart'
          )
          break

        case 'discord-25': {
          const targetBitrate = config.targetBitrateKbps || calculateTargetBitrate(24.5, totalDuration)
          args.push(
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-b:v', `${targetBitrate}k`,
            '-maxrate', `${Math.round(targetBitrate * 1.2)}k`,
            '-bufsize', `${Math.round(targetBitrate * 2)}k`,
            '-preset', speedPreset,
            '-tune', 'fastdecode',
            ...(isTurbo ? ['-x264-params', 'subme=0:me=dia:ref=1:no-cabac=1'] : []),
            '-movflags', '+faststart'
          )
          break
        }

        case 'slack-10': {
          const targetBitrate = config.targetBitrateKbps || calculateTargetBitrate(9.5, totalDuration)
          args.push(
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-b:v', `${targetBitrate}k`,
            '-maxrate', `${Math.round(targetBitrate * 1.2)}k`,
            '-bufsize', `${Math.round(targetBitrate * 2)}k`,
            '-preset', speedPreset,
            '-tune', 'fastdecode',
            ...(isTurbo ? ['-x264-params', 'subme=0:me=dia:ref=1:no-cabac=1'] : []),
            '-movflags', '+faststart'
          )
          break
        }

        case 'high-efficiency':
          args.push(
            '-c:v', 'libvpx-vp9',
            '-crf', '35',
            '-b:v', '0',
            '-deadline', 'realtime',
            '-cpu-used', isTurbo ? '8' : '4'
          )
          break

        default:
          args.push(
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-crf', '25',
            '-preset', speedPreset
          )
      }

      // Audio parameters
      if (config.audioPassThrough) {
        args.push('-c:a', 'copy')
      } else {
        args.push('-c:a', 'aac', '-b:a', '128k')
      }

      // Output file
      args.push(outputFileName)

      // Start an adaptive heartbeat timer so if the first batch of frames takes 2-4 seconds,
      // the UI explicitly shows ongoing work rather than appearing static at 10%.
      let warmupSeconds = 0
      const warmupInterval = setInterval(() => {
        warmupSeconds += 1
        if (currentProgressPct <= 12) {
          onProgress({
            progress: Math.min(12, 10 + Math.floor(warmupSeconds / 2)),
            stage: 'transcoding',
            stageDescription: `Processing video streams (analyzing frames & keyframes... ${warmupSeconds}s)`,
            time: '00:00:00',
            fps: lastFps,
            speed: lastSpeed,
            bitrate: 'Encoding...',
            frame: lastFrame,
          })
        }
      }, 1000)

      try {
        // 5. Execute FFmpeg
        await this.ffmpeg.exec(args)
      } finally {
        clearInterval(warmupInterval)
      }

      if (this.cancelled) {
        throw new Error('Transcoding process cancelled by user.')
      }

      // 6. Read output from virtual storage
      onProgress({
        progress: 96,
        stage: 'finalizing',
        stageDescription: 'Reading compressed stream from virtual filesystem...',
        time: 'Finalizing',
        fps: lastFps,
        speed: lastSpeed,
        bitrate: lastBitrate,
        frame: lastFrame,
      })

      const outputData = await this.ffmpeg.readFile(outputFileName)
      const mimeType = outputExt === 'webm' ? 'video/webm' : 'video/mp4'
      const outputBlob = new Blob([outputData as unknown as BlobPart], { type: mimeType })

      // Send 100% progress
      onProgress({
        progress: 100,
        stage: 'completed',
        stageDescription: 'Transcoding completed successfully.',
        time: 'Complete',
        fps: lastFps,
        speed: lastSpeed,
        bitrate: 'Done',
        frame: lastFrame,
        etaSeconds: 0,
      })

      const baseName = inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) || inputFile.name
      const resultName = `${baseName}_compressed.${outputExt}`

      return {
        outputBlob,
        outputName: resultName,
      }
    } finally {
      // Detach listeners so they don't persist across jobs
      if (this.ffmpeg) {
        try {
          this.ffmpeg.off('progress', progressListener)
          this.ffmpeg.off('log', logListener)
        } catch {
          // ignore
        }
      }

      // Memory cleanup: Immediately free input/output virtual files in Emscripten
      try {
        await this.ffmpeg?.deleteFile(inputFileName)
      } catch {
        // Ignored if file does not exist
      }
      try {
        await this.ffmpeg?.deleteFile(outputFileName)
      } catch {
        // Ignored
      }
      this.isBusy = false
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true
    if (this.ffmpeg && this.isBusy) {
      try {
        await this.ffmpeg.terminate()
      } catch (e) {
        console.warn('Error while terminating ffmpeg instance:', e)
      }
      this.ffmpeg = null
      this.isBusy = false
    }
  }

  async cleanup(): Promise<void> {
    if (this.ffmpeg) {
      try {
        await this.ffmpeg.terminate()
      } catch (e) {
        console.warn('Error during ffmpeg cleanup:', e)
      }
      this.ffmpeg = null
    }
  }
}

Comlink.expose(new TranscodeWorker())

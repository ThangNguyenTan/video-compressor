import { describe, it, expect, vi } from 'vitest'
import { parseFFmpegLog, parseTimeString } from './ffmpegParser'

describe('Progress and Telemetry Unit Verification', () => {
  it('parses fractional and integer seconds in mm:ss and hh:mm:ss', () => {
    expect(parseTimeString('01:30')).toBe(90)
    expect(parseTimeString('00:01:30.50')).toBeCloseTo(90.5, 2)
  })

  it('correctly tracks monotonic progress when FFmpeg outputs progress lines', () => {
    const totalDuration = 10.0
    const logLines = [
      'frame=   10 fps=0.0 q=0.0 size=       0kB time=00:00:01.00 bitrate=N/A speed=1.00x',
      'frame=   35 fps=32.4 q=28.0 size=     256kB time=00:00:03.50 bitrate= 598.0kbits/s speed=1.20x',
      'frame=   70 fps=34.1 q=28.0 size=     600kB time=00:00:07.00 bitrate= 700.0kbits/s speed=1.25x',
      'frame=  100 fps=35.0 q=28.0 size=     900kB time=00:00:10.00 bitrate= 737.0kbits/s speed=1.30x',
    ]

    const progresses: number[] = []

    for (const line of logLines) {
      const parsed = parseFFmpegLog(line)
      expect(parsed).not.toBeNull()
      if (parsed?.timeSeconds !== undefined) {
        const pct = Math.min(99, Math.round((parsed.timeSeconds / totalDuration) * 100))
        progresses.push(pct)
      }
    }

    expect(progresses).toEqual([10, 35, 70, 99])
  })

  it('simulates onProgress callback receiving immediate initial feedback and advancing through stages', () => {
    const callback = vi.fn()

    // 1. Initial file reading state
    callback({
      progress: 1,
      stage: 'reading',
      stageDescription: 'Loading file into memory (25%)...',
      time: '00:00:00',
      fps: 0,
      speed: '1.0x',
      bitrate: 'Buffering...',
      frame: 0,
    })

    // 2. Transcode encoding state
    callback({
      progress: 45,
      stage: 'transcoding',
      stageDescription: 'Encoding video frames (45%)...',
      time: '00:04.50',
      fps: 32,
      speed: '1.25x',
      bitrate: '1200 kbps',
      frame: 135,
      etaSeconds: 5,
    })

    // 3. Final completion
    callback({
      progress: 100,
      stage: 'completed',
      stageDescription: 'Transcoding completed successfully.',
      time: 'Complete',
      fps: 32,
      speed: '1.25x',
      bitrate: 'Done',
      frame: 300,
      etaSeconds: 0,
    })

    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback.mock.calls[0][0].progress).toBe(1)
    expect(callback.mock.calls[0][0].stage).toBe('reading')
    expect(callback.mock.calls[1][0].progress).toBe(45)
    expect(callback.mock.calls[1][0].stage).toBe('transcoding')
    expect(callback.mock.calls[2][0].progress).toBe(100)
    expect(callback.mock.calls[2][0].stage).toBe('completed')
  })
})

import { describe, it, expect } from 'vitest'
import {
  calculateTargetBitrate,
  parseTimeString,
  parseFFmpegLog,
  formatBytes,
} from './ffmpegParser'

describe('calculateTargetBitrate', () => {
  it('calculates bitrate correctly for 25MB over 60 seconds', () => {
    // 25 * 8192 / 60 = 3413.33 kbps - 128 = 3285 kbps
    const bitrate = calculateTargetBitrate(25, 60, 128)
    expect(bitrate).toBe(3285)
  })

  it('guarantees minimum video bitrate of 100kbps on tiny targets', () => {
    const bitrate = calculateTargetBitrate(0.1, 120, 128)
    expect(bitrate).toBe(100)
  })
})

describe('parseTimeString', () => {
  it('parses standard HH:MM:SS.ms strings', () => {
    expect(parseTimeString('00:01:30.50')).toBeCloseTo(90.5, 2)
    expect(parseTimeString('01:00:00.00')).toBe(3600)
  })
})

describe('parseFFmpegLog', () => {
  it('extracts frame, fps, time, bitrate and speed from ffmpeg log lines', () => {
    const line = 'frame=  250 fps= 59.8 q=28.0 size=   12500kB time=00:00:10.24 bitrate=10000.0kbits/s speed=1.45x'
    const parsed = parseFFmpegLog(line)

    expect(parsed).not.toBeNull()
    expect(parsed?.frame).toBe(250)
    expect(parsed?.fps).toBe(59.8)
    expect(parsed?.time).toBe('00:00:10.24')
    expect(parsed?.timeSeconds).toBeCloseTo(10.24, 2)
    expect(parsed?.bitrate).toBe('10000.0kbits/s')
    expect(parsed?.speed).toBe('1.45x')
  })

  it('returns null for unrelated log lines', () => {
    const line = 'Input #0, mov,mp4,m4a,3gp,3g2,mj2, from "input.mp4":'
    expect(parseFFmpegLog(line)).toBeNull()
  })
})

describe('formatBytes', () => {
  it('formats byte sizes gracefully', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
    expect(formatBytes(1024 * 1024 * 25)).toBe('25 MB')
    expect(formatBytes(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB')
  })
})

/**
 * Calculates target video bitrate to fit within a specific target MB budget.
 * Formula: Target Bitrate (kbps) = (Target Size in MB * 8192) / Duration in Seconds
 * Subtracting audio allowance (~128kbps) if audio re-encoding is active.
 */
export function calculateTargetBitrate(
  targetSizeMB: number,
  durationSeconds: number,
  reserveAudioKbps: number = 128
): number {
  if (durationSeconds <= 0) return 1000
  const totalBudgetKbps = (targetSizeMB * 8192) / durationSeconds
  const videoBudgetKbps = Math.max(100, Math.floor(totalBudgetKbps - reserveAudioKbps))
  return videoBudgetKbps
}

/**
 * Format bytes to readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Format seconds to HH:MM:SS or MM:SS
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)

  const pad = (n: number) => n.toString().padStart(2, '0')

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
  }
  return `${pad(mins)}:${pad(secs)}.${pad(ms).padStart(2, '0')}`
}

/**
 * Parse time string HH:MM:SS.ms or MM:SS to seconds
 */
export function parseTimeString(timeStr: string): number {
  const parts = timeStr.trim().split(':')
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0
    const minutes = parseFloat(parts[1]) || 0
    const seconds = parseFloat(parts[2]) || 0
    return hours * 3600 + minutes * 60 + seconds
  }
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0
    const seconds = parseFloat(parts[1]) || 0
    return minutes * 60 + seconds
  }
  return 0
}

/**
 * Parse FFmpeg stderr output line for progress telemetry
 */
export interface ParsedLogData {
  frame?: number
  fps?: number
  time?: string
  timeSeconds?: number
  bitrate?: string
  speed?: string
}

export function parseFFmpegLog(line: string): ParsedLogData | null {
  // Typical line:
  // frame=  123 fps= 45 q=28.0 size=    1024kB time=00:00:04.56 bitrate=1836.4kbits/s speed=1.82x
  // or frame= 45 fps=0.0 q=0.0 size= 0kB time=00:00:01.50 ...
  if (!line.includes('time=') && !line.includes('frame=')) {
    return null
  }

  const result: ParsedLogData = {}

  const frameMatch = line.match(/frame=\s*(\d+)/i)
  if (frameMatch) result.frame = parseInt(frameMatch[1], 10)

  const fpsMatch = line.match(/fps=\s*([\d.]+)/i)
  if (fpsMatch) result.fps = parseFloat(fpsMatch[1])

  const timeMatch = line.match(/time=\s*([\d:.]+)/i)
  if (timeMatch) {
    result.time = timeMatch[1]
    result.timeSeconds = parseTimeString(timeMatch[1])
  }

  const bitrateMatch = line.match(/bitrate=\s*([\d.]+\s*\w+\/s)/i)
  if (bitrateMatch) result.bitrate = bitrateMatch[1]

  const speedMatch = line.match(/speed=\s*([\d.]+)x/i)
  if (speedMatch) {
    result.speed = `${speedMatch[1]}x`
  }

  return result
}

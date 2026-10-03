import React, { useRef, useState, useEffect } from 'react'
import { Play, Pause, Scissors, Clock, Ratio, FileText, Maximize2 } from 'lucide-react'
import { useTranscodeStore } from '../store/useTranscodeStore'
import { formatBytes, formatTime } from '../lib/ffmpegParser'

export const VideoPreviewScrubber: React.FC = () => {
  const { videoUrl, metadata, config, setConfig, isTranscoding } = useTranscodeStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const duration = metadata?.duration || 0
  const trimStart = config.trim.start
  const trimEnd = config.trim.end || duration

  // Synchronize playback within trim boundaries if trim is enabled
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (config.trim.enabled && video.currentTime >= trimEnd) {
        video.pause()
        video.currentTime = trimStart
        setIsPlaying(false)
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [trimStart, trimEnd, config.trim.enabled])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      if (config.trim.enabled && (videoRef.current.currentTime < trimStart || videoRef.current.currentTime >= trimEnd)) {
        videoRef.current.currentTime = trimStart
      }
      videoRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleStartTrimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(parseFloat(e.target.value), trimEnd - 0.5)
    setConfig({
      trim: {
        ...config.trim,
        enabled: true,
        start: Math.max(0, val),
      },
    })
    if (videoRef.current) {
      videoRef.current.currentTime = val
    }
  }

  const handleEndTrimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(parseFloat(e.target.value), trimStart + 0.5)
    setConfig({
      trim: {
        ...config.trim,
        enabled: true,
        end: Math.min(duration, val),
      },
    })
    if (videoRef.current) {
      videoRef.current.currentTime = val
    }
  }

  const effectiveDuration = config.trim.enabled ? Math.max(0.1, trimEnd - trimStart) : duration

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
      {/* Video Preview */}
      <div className="relative group rounded-2xl overflow-hidden bg-black/60 aspect-video flex items-center justify-center border border-slate-800/80 shadow-inner">
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        )}

        {/* Video Overlay Controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
          <div className="flex items-center justify-between pointer-events-auto">
            <button
              type="button"
              onClick={togglePlay}
              disabled={isTranscoding}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-white transition-transform active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>
            <div className="text-xs font-mono font-medium text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>
      </div>

      {/* Metadata Badges */}
      {metadata && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" /> Size
            </span>
            <span className="text-sm font-semibold text-slate-100 mt-1">{formatBytes(metadata.size)}</span>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> Duration
            </span>
            <span className="text-sm font-semibold text-slate-100 mt-1">{formatTime(duration)}</span>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-cyan-400" /> Resolution
            </span>
            <span className="text-sm font-semibold text-slate-100 mt-1">
              {metadata.width} × {metadata.height}
            </span>
          </div>

          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Ratio className="w-3.5 h-3.5 text-amber-400" /> Aspect Ratio
            </span>
            <span className="text-sm font-semibold text-slate-100 mt-1">{metadata.aspectRatio}</span>
          </div>
        </div>
      )}

      {/* Frame-Accurate Dual Scrubber Trim Control */}
      <div className="flex flex-col gap-3 bg-slate-800/30 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-indigo-400" /> Trim Range Selector
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20 font-mono">
              Output Duration: {formatTime(effectiveDuration)}
            </span>
            <button
              type="button"
              onClick={() => {
                setConfig({
                  trim: {
                    ...config.trim,
                    enabled: !config.trim.enabled,
                    start: 0,
                    end: duration,
                  },
                })
              }}
              className={`text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors border ${
                config.trim.enabled
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {config.trim.enabled ? 'Trim Active' : 'Trim Off'}
            </button>
          </div>
        </div>

        {/* Range Dual Controls */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span>Start Point</span>
                <span className="text-indigo-400">{formatTime(trimStart)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={duration}
                step="0.05"
                value={trimStart}
                onChange={handleStartTrimChange}
                disabled={isTranscoding}
                className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span>End Point</span>
                <span className="text-indigo-400">{formatTime(trimEnd)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={duration}
                step="0.05"
                value={trimEnd}
                onChange={handleEndTrimChange}
                disabled={isTranscoding}
                className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

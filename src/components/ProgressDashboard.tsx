import React, { useState } from 'react'
import {
  Play,
  Square,
  Download,
  Activity,
  Terminal,
  ChevronDown,
  ChevronUp,
  Cpu,
  Clock,
  Gauge,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { useTranscodeStore } from '../store/useTranscodeStore'
import { formatTime, formatBytes } from '../lib/ffmpegParser'

export const ProgressDashboard: React.FC = () => {
  const {
    isTranscoding,
    progress,
    logs,
    outputBlob,
    outputName,
    startTranscoding,
    cancelTranscoding,
    downloadResult,
    errorMessage,
    file,
    queue,
  } = useTranscodeStore()

  const [showLogs, setShowLogs] = useState(false)

  const compressionRatio =
    file && outputBlob ? Math.round((1 - outputBlob.size / file.size) * 100) : null

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Transcoding Engine
          </h3>
          <p className="text-xs text-slate-400">
            {queue.length > 1
              ? `Batch Queue Mode (${queue.length} videos) • Isolated Web Worker execution`
              : 'Isolated Web Worker execution with real-time FFmpeg logs'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isTranscoding && !outputBlob && (
            <button
              type="button"
              onClick={startTranscoding}
              className="px-6 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              {queue.length > 1 ? `Compress All (${queue.length} Videos)` : 'Start Compression'}
            </button>
          )}

          {isTranscoding && (
            <button
              type="button"
              onClick={cancelTranscoding}
              className="px-6 py-2.5 rounded-xl font-medium text-sm bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 shadow-lg active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Square className="w-4 h-4 fill-rose-300" /> Cancel Process
            </button>
          )}

          {outputBlob && (
            <button
              type="button"
              onClick={downloadResult}
              className="px-6 py-2.5 rounded-xl font-medium text-sm bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Save Output to Disk
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold block">Execution Error</span>
            <span className="text-rose-400/90 text-xs">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Progress Bar & Telemetry */}
      {isTranscoding && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {progress.stage === 'reading' || progress.stage === 'writing' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  {progress.stage === 'reading' ? 'Loading File' : 'Mounting Virtual FS'}
                </span>
              ) : progress.stage === 'finalizing' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Finalizing Stream
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Encoding Video
                </span>
              )}
              <span className="text-slate-300 font-medium text-xs truncate max-w-xs sm:max-w-md">
                {progress.stageDescription || 'Processing video stream...'}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono self-end sm:self-auto">
              <span className="text-slate-500 text-xs">Overall Progress:</span>
              <span className="text-indigo-400 font-bold text-sm bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                {progress.progress}%
              </span>
            </div>
          </div>

          <div className="w-full h-3.5 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/60 shadow-inner relative">
            <div
              className={`h-full rounded-full transition-all duration-300 shadow-sm relative overflow-hidden ${
                progress.stage === 'reading' || progress.stage === 'writing'
                  ? 'bg-gradient-to-r from-amber-500 to-indigo-500'
                  : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
              }`}
              style={{ width: `${Math.max(3, progress.progress)}%` }}
            >
              {/* Shimmer pulse effect during transcoding */}
              <div className="absolute inset-0 bg-white/25 animate-[pulse_1.5s_infinite] rounded-full" />
            </div>
          </div>

          {/* Telemetry Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/30 flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" /> Speed / FPS
              </span>
              <span className="text-sm font-semibold text-slate-200 mt-1 font-mono">
                {progress.speed} ({progress.fps} fps)
              </span>
            </div>

            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/30 flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Timestamp
              </span>
              <span className="text-sm font-semibold text-slate-200 mt-1 font-mono">{progress.time}</span>
            </div>

            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/30 flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Bitrate
              </span>
              <span className="text-sm font-semibold text-slate-200 mt-1 font-mono">{progress.bitrate}</span>
            </div>

            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/30 flex flex-col">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" /> Estimated ETA
              </span>
              <span className="text-sm font-semibold text-slate-200 mt-1 font-mono">
                {progress.etaSeconds !== undefined ? formatTime(progress.etaSeconds) : 'Calculating...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Output summary banner upon completion */}
      {outputBlob && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/30 border border-emerald-500/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-emerald-100">{outputName}</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1">
                <span>
                  Original: <strong className="text-slate-200 font-mono">{file ? formatBytes(file.size) : 'N/A'}</strong>
                </span>
                <span className="text-slate-500">→</span>
                <span>
                  Final: <strong className="text-emerald-300 font-mono">{formatBytes(outputBlob.size)}</strong>
                </span>
                {compressionRatio !== null && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold font-mono text-xs border border-emerald-500/30">
                    {compressionRatio > 0 ? `🔥 ${compressionRatio}% Smaller` : `+${Math.abs(compressionRatio)}%`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={downloadResult}
              className="w-full md:w-auto px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download Video
            </button>
          </div>
        </div>
      )}

      {/* Terminal stderr log viewer */}
      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
        <button
          type="button"
          onClick={() => setShowLogs(!showLogs)}
          className="w-full px-4 py-3 bg-slate-900/50 hover:bg-slate-900/80 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-400 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <span>FFmpeg Output Telemetry Console ({logs.length} entries)</span>
          </div>
          {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showLogs && (
          <div className="p-4 max-h-60 overflow-y-auto font-mono text-[11px] text-slate-300 leading-relaxed space-y-1 select-all bg-black/40">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">No output yet. Start a job to inspect live FFmpeg stdout/stderr logs.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="break-all whitespace-pre-wrap">
                  {log}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

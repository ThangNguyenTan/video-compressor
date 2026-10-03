import { useEffect } from 'react'
import { IsolationHeader } from './components/IsolationHeader'
import { Dropzone } from './components/Dropzone'
import { VideoPreviewScrubber } from './components/VideoPreviewScrubber'
import { PresetSelector } from './components/PresetSelector'
import { ProgressDashboard } from './components/ProgressDashboard'
import { BatchQueueDashboard } from './components/BatchQueueDashboard'
import { useTranscodeStore } from './store/useTranscodeStore'
import { AlertCircle, Lock, HardDrive, Cpu, RefreshCw } from 'lucide-react'

export function App() {
  const { file, queue, isTranscoding, isCrossOriginIsolated, checkIsolation, clearFile } = useTranscodeStore()

  useEffect(() => {
    checkIsolation()
  }, [checkIsolation])

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <IsolationHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Security & Isolation Fallback Warning Banner */}
        {!isCrossOriginIsolated && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/50 text-amber-200 flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong className="font-semibold block text-sm text-amber-300 mb-0.5">
                Single-Threaded Fallback Active
              </strong>
              `window.crossOriginIsolated` is not detected. Multi-threaded WebAssembly requires
              COOP (<code className="bg-amber-900/50 px-1 py-0.5 rounded">same-origin</code>) and COEP (
              <code className="bg-amber-900/50 px-1 py-0.5 rounded">require-corp</code>) headers. The app
              will continue using single-threaded <code className="text-amber-300">@ffmpeg/core</code>.
            </div>
          </div>
        )}

        {/* File Dropzone or Active Workflow */}
        {!file ? (
          <>
            {/* File uploads placed BEFORE feature highlights */}
            <Dropzone />

            {/* Feature Highlights Grid placed AFTER file uploads */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">100% Client-Side Privacy</h4>
                  <p className="text-xs text-slate-400 mt-1">Zero video bytes uploaded to any remote cloud. Entire transcoding pipeline executes locally.</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Direct-to-Disk Streaming</h4>
                  <p className="text-xs text-slate-400 mt-1">File System Access API integration prevents heap crashes on large video files.</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Multi-Threaded Wasm Core</h4>
                  <p className="text-xs text-slate-400 mt-1">Harness multi-core CPU encoding via Web Workers without freezing the main browser thread.</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Header bar: disable file switching while encoding */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-400">
                  {isTranscoding ? 'Processing Video File:' : 'Selected Source File:'}
                </span>
                <span className="text-sm font-semibold text-indigo-300 font-mono">{file.name}</span>
              </div>
              {!isTranscoding && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Clear / New Files
                </button>
              )}
            </div>

            {/* DURING ENCODING: Percentage & progress container placed FIRST */}
            {isTranscoding && <ProgressDashboard />}

            {/* Processed / Queue files container */}
            {queue.length > 1 && <BatchQueueDashboard />}

            {/* When NOT transcoding: show options, video player, and presets */}
            {!isTranscoding && (
              <>
                {/* Video Player & Dual Handle Scrubber */}
                <VideoPreviewScrubber />

                {/* Presets and Bitrate Calculations */}
                <PresetSelector />

                {/* Progress Dashboard at bottom when idle or completed */}
                <ProgressDashboard />
              </>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        Local-First Video Compressor • Powered by WebAssembly FFmpeg & Web Workers
      </footer>
    </div>
  )
}

export default App

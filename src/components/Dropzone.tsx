import React, { useRef, useState } from 'react'
import { UploadCloud, Film, HardDrive, AlertCircle } from 'lucide-react'
import { useTranscodeStore } from '../store/useTranscodeStore'

const ACCEPTED_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi']

export const Dropzone: React.FC = () => {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addFilesToQueue, isTranscoding } = useTranscodeStore()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (fileList && fileList.length > 0) {
      addFilesToQueue(Array.from(fileList))
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (isTranscoding) return

    const fileList = e.dataTransfer.files
    if (fileList && fileList.length > 0) {
      addFilesToQueue(Array.from(fileList))
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!isTranscoding) setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => {
        if (!isTranscoding) fileInputRef.current?.click()
      }}
      className={`relative group cursor-pointer border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center text-center overflow-hidden
        ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-500/15 scale-[1.01] shadow-2xl shadow-indigo-500/20 ring-4 ring-indigo-500/20'
            : 'border-slate-700/80 hover:border-indigo-400/70 bg-gradient-to-b from-slate-900/90 to-slate-900/50 backdrop-blur-xl hover:bg-slate-850/80 shadow-2xl hover:shadow-indigo-500/5'
        }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={isTranscoding}
      />

      {/* Decorative gradient glow spots */}
      <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-700" />
      <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-all duration-700" />

      {/* Center Icon with pulsing ring on hover */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600/40 via-purple-600/30 to-pink-600/20 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/10 group-hover:scale-105 group-hover:border-indigo-400/50 transition-all duration-300">
          <UploadCloud className="w-10 h-10 text-indigo-300 group-hover:text-indigo-200 transition-colors" />
        </div>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold text-slate-100 mb-2 tracking-tight">
        Drop video files here, or <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 underline decoration-indigo-400/40 underline-offset-4">browse</span>
      </h3>
      <p className="text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
        High-performance in-browser compression. Batch support for multiple videos up to 2GB+, processed with zero cloud uploads.
      </p>

      {/* Accepted formats badge bar */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {ACCEPTED_EXTENSIONS.map((ext) => (
          <span
            key={ext}
            className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/60 shadow-sm"
          >
            {ext}
          </span>
        ))}
      </div>

      {/* Feature trust markers */}
      <div className="mt-8 pt-6 border-t border-slate-800/60 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
        <span className="flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-purple-400" /> 100% Private (No Cloud Upload)
        </span>
        <span className="flex items-center gap-1.5">
          <Film className="w-4 h-4 text-indigo-400" /> Multi-Threaded Wasm Core
        </span>
        <span className="flex items-center gap-1.5">
          <HardDrive className="w-4 h-4 text-emerald-400" /> Direct Streaming
        </span>
      </div>
    </div>
  )
}

import React from 'react'
import {
  ListVideo,
  FileCheck2,
  Clock,
  AlertCircle,
  Trash2,
  Download,
  Plus,
  Play,
} from 'lucide-react'
import { useTranscodeStore } from '../store/useTranscodeStore'
import { formatBytes } from '../lib/ffmpegParser'

export const BatchQueueDashboard: React.FC = () => {
  const {
    queue,
    activeQueueIndex,
    selectQueueItem,
    removeQueueItem,
    downloadBatchItem,
    addFilesToQueue,
    startBatchTranscoding,
    isTranscoding,
    clearQueue,
  } = useTranscodeStore()

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  if (queue.length <= 1) {
    return null
  }

  const completedCount = queue.filter((item) => item.status === 'completed').length
  const totalCount = queue.length
  const allCompleted = completedCount === totalCount

  const handleAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files))
    }
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ListVideo className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100 tracking-tight flex items-center gap-2">
              Batch Compression Queue
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                {completedCount}/{totalCount} Completed
              </span>
            </h3>
            <p className="text-xs text-slate-400">Multiple video files queued for sequential WebAssembly transcoding</p>
          </div>
        </div>

        {!isTranscoding && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp4,.mov,.mkv,.webm,.avi"
              onChange={handleAddMore}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add More Videos
            </button>

            {completedCount > 1 && (
              <button
                type="button"
                onClick={async () => {
                  for (const item of queue) {
                    if (item.outputBlob) {
                      await downloadBatchItem(item)
                    }
                  }
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Download className="w-3.5 h-3.5" /> Download All ({completedCount})
              </button>
            )}

            {!allCompleted && (
              <button
                type="button"
                onClick={startBatchTranscoding}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Transcode All ({totalCount})
              </button>
            )}

            <button
              type="button"
              onClick={clearQueue}
              className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent transition-all cursor-pointer"
              title="Clear Queue"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Queue items list */}
      <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
        {queue.map((item, idx) => {
          const isActive = idx === activeQueueIndex
          return (
            <div
              key={item.id}
              onClick={() => {
                if (!isTranscoding) selectQueueItem(idx)
              }}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                isTranscoding ? 'cursor-default' : 'cursor-pointer'
              } ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30'
                  : 'bg-slate-850/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-slate-500 w-5 text-right">{idx + 1}.</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200 truncate">{item.file.name}</span>
                    <span className="text-xs font-mono text-slate-500">{formatBytes(item.file.size)}</span>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {item.progress.stageDescription || 'Pending'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Status indicator */}
                {item.status === 'completed' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <FileCheck2 className="w-3.5 h-3.5" /> Done (100%)
                  </span>
                )}
                {item.status === 'processing' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                    {item.progress.progress}%
                  </span>
                )}
                {item.status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    <Clock className="w-3.5 h-3.5" /> Queued
                  </span>
                )}
                {item.status === 'error' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <AlertCircle className="w-3.5 h-3.5" /> Error
                  </span>
                )}

                {/* Actions */}
                {item.outputBlob && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadBatchItem(item)
                    }}
                    className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                    title="Download result"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}

                {!isTranscoding && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeQueueItem(item.id)
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import React from 'react'
import { ShieldCheck, ShieldAlert, Cpu, Layers } from 'lucide-react'
import { useTranscodeStore } from '../store/useTranscodeStore'

export const IsolationHeader: React.FC = () => {
  const { isCrossOriginIsolated, isWasmReady, isInitializing, initWasm } = useTranscodeStore()

  return (
    <header className="w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">
              ClientCompress
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Wasm Multi-Threaded Video Transcoder</p>
          </div>
        </div>

        {/* Isolation & Runtime Indicators */}
        <div className="flex items-center gap-3">
          {/* Isolation status badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              isCrossOriginIsolated
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
            title={
              isCrossOriginIsolated
                ? 'COOP and COEP isolation active. Multi-threading enabled.'
                : 'Cross-origin isolation not active. Falling back to single-threaded Wasm.'
            }
          >
            {isCrossOriginIsolated ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">COOP/COEP Isolated</span>
                <span className="sm:hidden">Isolated</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Non-Isolated (Single-Thread)</span>
                <span className="sm:hidden">Single-Thread</span>
              </>
            )}
          </div>

          {/* Engine status button */}
          <button
            type="button"
            onClick={() => initWasm()}
            disabled={isWasmReady || isInitializing}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              isWasmReady
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                : isInitializing
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>
              {isWasmReady
                ? 'Engine Ready'
                : isInitializing
                ? 'Loading Core...'
                : 'Preload Wasm'}
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}

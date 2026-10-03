import React from 'react'
import { Zap, MessageSquare, Hash, Film, Music, CheckCircle2 } from 'lucide-react'
import { useTranscodeStore } from '../store/useTranscodeStore'
import { calculateTargetBitrate } from '../lib/ffmpegParser'
import type { PresetType } from '../types'

interface PresetOption {
  id: PresetType
  name: string
  description: string
  icon: React.ElementType
  badge?: string
  calcNote?: (duration: number) => string
}

export const PresetSelector: React.FC = () => {
  const { config, setPreset, setConfig, metadata, isTranscoding } = useTranscodeStore()

  const duration = config.trim.enabled
    ? Math.max(1, config.trim.end - config.trim.start)
    : metadata?.duration || 60

  const presets: PresetOption[] = [
    {
      id: 'web-fast',
      name: 'Web Fast (H.264)',
      description: 'Balanced CRF 23 compression optimized for universal web and mobile streaming with faststart headers.',
      icon: Zap,
      badge: 'Best Balance • ~60% smaller',
    },
    {
      id: 'discord-25',
      name: 'Discord Limit (<25MB)',
      description: 'Auto-computes video bitrate to guarantee final output fits under Discord upload limit.',
      icon: MessageSquare,
      badge: 'Fits Discord • < 25 MB',
      calcNote: (d) => `Target Bitrate: ~${calculateTargetBitrate(24.5, d)} kbps`,
    },
    {
      id: 'slack-10',
      name: 'Slack & Email (<10MB)',
      description: 'Aggressive rate-control formula to compress clips under 10MB for quick sharing and chats.',
      icon: Hash,
      badge: 'Ultra Compact • < 10 MB',
      calcNote: (d) => `Target Bitrate: ~${calculateTargetBitrate(9.5, d)} kbps`,
    },
    {
      id: 'high-efficiency',
      name: 'High Efficiency (VP9/WebM)',
      description: 'Modern VP9 web container for supreme quality-to-filesize ratio with next-gen codecs.',
      icon: Film,
      badge: 'Modern WebM • ~75% smaller',
    },
  ]

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100 tracking-tight">Compression Preset</h3>
        <span className="text-xs text-slate-400 font-medium">Select encoding strategy</span>
      </div>

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {presets.map((preset) => {
          const Icon = preset.icon
          const isSelected = config.preset === preset.id

          return (
            <button
              key={preset.id}
              type="button"
              disabled={isTranscoding}
              onClick={() => setPreset(preset.id)}
              className={`p-5 rounded-2xl border text-left transition-all duration-200 relative group flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'border-indigo-500 bg-gradient-to-br from-indigo-950/40 to-slate-900 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                  : 'border-slate-800 bg-slate-850/40 hover:border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      isSelected
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">{preset.name}</h4>
                    {preset.calcNote && (
                      <span className="text-[11px] font-mono text-indigo-400">
                        {preset.calcNote(duration)}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected ? (
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
                ) : (
                  preset.badge && (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60">
                      {preset.badge}
                    </span>
                  )
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">{preset.description}</p>
            </button>
          )
        })}
      </div>

      {/* Speed & Resolution Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
        {/* Speed Profile */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Compression Speed Engine</span>
            <span className="text-[11px] text-amber-400 font-mono">
              {config.speedMode === 'turbo' ? '⚡ 3x Faster (Ultrafast)' : config.speedMode === 'balanced' ? '⚖️ Balanced' : '💎 Max Quality'}
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'turbo' as const, label: 'Turbo ⚡', desc: 'Fastest encode' },
              { id: 'balanced' as const, label: 'Balanced ⚖️', desc: 'Standard' },
              { id: 'quality' as const, label: 'Quality 💎', desc: 'Best visual' },
            ].map((mode) => {
              const active = config.speedMode === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  disabled={isTranscoding}
                  onClick={() => setConfig({ speedMode: mode.id })}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer ${
                    active
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md shadow-amber-500/10'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-semibold">{mode.label}</div>
                  <div className="text-[10px] opacity-75">{mode.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Resolution Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Output Resolution</span>
            <span className="text-[11px] text-indigo-400 font-mono">
              {config.resolution === '720p' ? '720p HD (Recommended)' : config.resolution === '1080p' ? '1080p Full HD' : config.resolution === '480p' ? '480p SD (Fastest)' : 'Original Scale'}
            </span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: '480p' as const, label: '480p' },
              { id: '720p' as const, label: '720p HD' },
              { id: '1080p' as const, label: '1080p' },
              { id: 'original' as const, label: 'Original' },
            ].map((res) => {
              const active = config.resolution === res.id
              return (
                <button
                  key={res.id}
                  type="button"
                  disabled={isTranscoding}
                  onClick={() => setConfig({ resolution: res.id })}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer ${
                    active
                      ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {res.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Audio Options & Advanced Controls */}
      <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.audioPassThrough}
            disabled={isTranscoding}
            onChange={(e) => setConfig({ audioPassThrough: e.target.checked })}
            className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer accent-indigo-500"
          />
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-purple-400" />
            <span>Audio Pass-Through (<code className="text-xs text-slate-400 font-mono">-c:a copy</code>)</span>
          </div>
        </label>
        <span className="text-xs text-slate-500">Skips audio re-encoding for faster processing</span>
      </div>
    </div>
  )
}

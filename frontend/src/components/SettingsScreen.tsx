import { useState } from "react"
import { startGame } from "../api"
import type { Difficulty, GameState, Settings } from "../types"

interface SettingsScreenProps {
  onGameStart: (state: GameState, settings: Settings) => void
}

const BLIND_OPTIONS = [
  { label: "5/10", small: 5, big: 10 },
  { label: "10/20", small: 10, big: 20 },
  { label: "25/50", small: 25, big: 50 },
]

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  random: "Random",
  cheat: "Cheat Bot",
  ppo: "PPO Agent",
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  label: (v: T) => string
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-lg text-sm font-mono font-medium border transition-all ${
            value === opt
              ? "bg-red-500/20 border-red-500/50 text-red-400"
              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
        >
          {label(opt)}
        </button>
      ))}
    </div>
  )
}

export function SettingsScreen({ onGameStart }: SettingsScreenProps) {
  const [settings, setSettings] = useState<Settings>({
    difficulty: "random",
    stack_size: 1000,
    small_blind: 5,
    big_blind: 10,
    seed: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePlay() {
    setLoading(true)
    setError(null)
    try {
      const state = await startGame(settings)
      onGameStart(state, settings)
    } catch {
      setError("Failed to start game. Is the backend running on port 8000?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-md card space-y-6">
        <h2 className="text-xl font-semibold text-slate-100">Configure Your Game</h2>

        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Difficulty
          </label>
          <ToggleGroup<Difficulty>
            options={["random", "cheat", "ppo"]}
            value={settings.difficulty}
            onChange={(d) => setSettings((s) => ({ ...s, difficulty: d }))}
            label={(d) => DIFFICULTY_LABELS[d]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Starting Stack
          </label>
          <ToggleGroup<string>
            options={["500", "1000", "2000"]}
            value={String(settings.stack_size)}
            onChange={(v) => setSettings((s) => ({ ...s, stack_size: parseInt(v) }))}
            label={(v) => v}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Blind Structure
          </label>
          <div className="flex gap-2">
            {BLIND_OPTIONS.map((b) => (
              <button
                key={b.label}
                onClick={() =>
                  setSettings((s) => ({ ...s, small_blind: b.small, big_blind: b.big }))
                }
                className={`flex-1 py-2 rounded-lg text-sm font-mono font-medium border transition-all ${
                  settings.small_blind === b.small && settings.big_blind === b.big
                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Seed (optional)
          </label>
          <input
            type="text"
            placeholder="Random"
            value={settings.seed}
            onChange={(e) => setSettings((s) => ({ ...s, seed: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handlePlay}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold transition-colors"
        >
          {loading ? "Starting…" : "Play"}
        </button>
      </div>
    </div>
  )
}

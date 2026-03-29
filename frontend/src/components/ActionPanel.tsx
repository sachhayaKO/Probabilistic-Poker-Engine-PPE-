import { useEffect, useState } from "react"

interface ActionPanelProps {
  street: string
  legalActions: string[]
  toAct: string
  playerStack: number
  bigBlind: number
  botThinking: boolean
  onAction: (action: string, amount: number | null) => void
}

const STREET_LABELS: Record<string, string> = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
}

export function ActionPanel({
  street,
  legalActions,
  toAct,
  playerStack,
  bigBlind,
  botThinking,
  onAction,
}: ActionPanelProps) {
  const [showRaise, setShowRaise] = useState(false)
  const [raiseAmount, setRaiseAmount] = useState(bigBlind)

  useEffect(() => {
    setRaiseAmount(Math.max(bigBlind, 1))
    setShowRaise(false)
  }, [bigBlind, street])

  const isPlayerTurn = toAct === "hero"
  const disabled = !isPlayerTurn || botThinking || street === "showdown"

  function handleActionClick(act: string) {
    if (act === "raise") {
      setShowRaise(true)
    } else {
      setShowRaise(false)
      onAction(act, null)
    }
  }

  return (
    <div className="bg-[#0a0a0a] border-t border-red-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-semibold text-amber-500 uppercase tracking-widest">
          {STREET_LABELS[street] ?? street}
        </span>
        {botThinking && (
          <span className="text-xs font-mono text-slate-400 animate-pulse">
            Bot is thinking…
          </span>
        )}
      </div>

      {showRaise ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={bigBlind}
              max={Math.max(playerStack, bigBlind)}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
              className="flex-1 accent-red-500"
            />
            <span className="text-sm font-mono text-red-400 w-16 text-right font-bold">
              {raiseAmount}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRaise(false)}
              className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm font-mono hover:border-slate-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowRaise(false)
                onAction("raise", raiseAmount)
              }}
              className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-mono font-semibold transition-colors"
            >
              Raise {raiseAmount}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {(["fold", "check", "call", "raise"] as const).map((act) => {
            const available = legalActions.includes(act)
            const isRaise = act === "raise"
            return (
              <button
                key={act}
                onClick={() => handleActionClick(act)}
                disabled={disabled || !available}
                className={`flex-1 py-2.5 rounded-lg text-sm font-mono font-semibold uppercase tracking-wide transition-all
                  ${
                    isRaise
                      ? "bg-red-600 hover:bg-red-700 text-white border border-red-500"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                  }
                  disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {act}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

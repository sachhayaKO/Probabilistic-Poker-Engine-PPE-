import type { MoveLogEntry, Street } from "../types"

interface MoveLogProps {
  entries: MoveLogEntry[]
}

const STREET_SHORT: Record<Street, string> = {
  preflop: "Pre",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Show",
}

export function MoveLog({ entries }: MoveLogProps) {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] border-l border-red-900/40">
      <div className="px-4 py-3 border-b border-red-900/40 shrink-0">
        <span className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-widest">
          Move Log
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {entries.length === 0 ? (
          <p className="text-xs font-mono text-slate-600 text-center mt-6">No moves yet.</p>
        ) : (
          [...entries].reverse().map((entry, i) => (
            <div
              key={i}
              className="rounded-lg bg-slate-950/60 border border-white/[0.04] p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    entry.player === "hero"
                      ? "bg-red-500/15 text-red-400 border border-red-500/25"
                      : "bg-slate-500/15 text-slate-400 border border-slate-500/25"
                  }`}
                >
                  {entry.player === "hero" ? "YOU" : "BOT"}
                </span>
                <span className="text-xs font-mono text-slate-600">
                  {STREET_SHORT[entry.street] ?? entry.street}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-slate-200 capitalize">
                  {entry.action}
                  {entry.amount != null ? ` ${entry.amount}` : ""}
                </span>
                <span className="text-xs font-mono text-amber-500">pot {entry.pot}</span>
              </div>

              {entry.equity !== null && (
                <div className="space-y-1">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((entry.equity ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-green-400">
                    {Math.round((entry.equity ?? 0) * 100)}% equity
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

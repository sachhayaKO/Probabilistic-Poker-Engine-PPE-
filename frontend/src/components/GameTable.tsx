// frontend/src/components/GameTable.tsx
import { Card } from "./Card"
import { ActionPanel } from "./ActionPanel"
import { MoveLog } from "./MoveLog"
import type { GameState, MoveLogEntry } from "../types"

interface GameTableProps {
  gameState: GameState
  moveLog: MoveLogEntry[]
  botThinking: boolean
  bigBlind: number
  onAction: (action: string, amount: number | null) => void
  onPlayAgain: () => void
  onMenu: () => void
}

export function GameTable({
  gameState,
  moveLog,
  botThinking,
  bigBlind,
  onAction,
  onPlayAgain,
  onMenu,
}: GameTableProps) {
  const isSessionOver = gameState.session_over
  const isBetweenHands = gameState.winner !== null && !gameState.session_over
  const isShowdown = gameState.street === "showdown"

  const winnerLabel =
    gameState.winner === "hero"
      ? "You Win!"
      : gameState.winner === "tie"
      ? "Split Pot!"
      : "Bot Wins."

  const winnerColor =
    gameState.winner === "hero"
      ? "text-green-400"
      : gameState.winner === "tie"
      ? "text-amber-400"
      : "text-red-400"

  return (
    <div className="min-h-screen bg-black flex relative">
      {/* ── Main table ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Bot area */}
        <div className="flex items-center justify-center gap-6 py-6 px-4 border-b border-red-900/20">
          <div className="text-center min-w-[4rem]">
            <div className="text-xs font-mono text-slate-500 mb-1">BOT</div>
            <div className="text-lg font-mono font-bold text-slate-300">
              {gameState.bot_stack}
            </div>
          </div>
          <div className="flex gap-2">
            {[0, 1].map((i) => (
              <Card
                key={i}
                card={isShowdown ? gameState.villain_hand[i] : null}
                faceDown={!isShowdown}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Community board + pot */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Card
                key={i}
                card={gameState.board[i] ?? null}
                faceDown={false}
                index={i}
              />
            ))}
          </div>
          <div className="text-sm font-mono font-semibold text-amber-500">
            POT: {gameState.pot}
          </div>
        </div>

        {/* Player area */}
        <div className="flex items-center justify-center gap-6 py-6 px-4 border-t border-red-900/20">
          <div className="text-center min-w-[4rem]">
            <div className="text-xs font-mono text-slate-500 mb-1">YOU</div>
            <div className="text-lg font-mono font-bold text-red-400">
              {gameState.player_stack}
            </div>
          </div>
          <div className="flex gap-2">
            {gameState.player_hand.map((card, i) => (
              <Card key={i} card={card} faceDown={false} index={i} />
            ))}
          </div>
        </div>

        {/* Action panel */}
        <ActionPanel
          street={gameState.street}
          legalActions={gameState.legal_actions}
          toAct={gameState.to_act}
          playerStack={gameState.player_stack}
          bigBlind={bigBlind}
          pot={gameState.pot}
          botThinking={botThinking}
          onAction={onAction}
        />
      </div>

      {/* ── Move log sidebar ── */}
      <div className="w-56 shrink-0">
        <MoveLog entries={moveLog} />
      </div>

      {/* ── Between-hands transition overlay ── */}
      {isBetweenHands && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="text-center space-y-3">
            <div className={`text-2xl font-bold ${winnerColor}`}>{winnerLabel}</div>
            <div className="text-sm font-mono text-slate-400 animate-pulse">
              Hand {gameState.hand_number - 1} over — next hand starting…
            </div>
          </div>
        </div>
      )}

      {/* ── Game-over overlay (session over) ── */}
      {isSessionOver && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="card text-center space-y-5 max-w-sm w-full mx-4">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              Game Over
            </div>
            <div className={`text-3xl font-bold ${winnerColor}`}>{winnerLabel}</div>

            <div className="flex justify-center gap-8 text-sm font-mono">
              <div className="text-center">
                <div className="text-slate-500 mb-1">You</div>
                <div className="text-red-400 font-bold text-lg">{gameState.player_stack}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-500 mb-1">Bot</div>
                <div className="text-slate-300 font-bold text-lg">{gameState.bot_stack}</div>
              </div>
            </div>

            {isShowdown && gameState.villain_hand.length === 2 && (
              <div className="space-y-3">
                <div className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                  Showdown
                </div>
                <div className="flex justify-center gap-6">
                  <div className="space-y-2 text-center">
                    <div className="text-xs font-mono text-slate-500">Bot</div>
                    <div className="flex gap-1">
                      {gameState.villain_hand.map((card, i) => (
                        <Card key={i} card={card} faceDown={false} index={i} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 text-center">
                    <div className="text-xs font-mono text-slate-500">You</div>
                    <div className="flex gap-1">
                      {gameState.player_hand.map((card, i) => (
                        <Card key={i} card={card} faceDown={false} index={i} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isShowdown && (
              <p className="text-sm font-mono text-slate-400">
                {gameState.winner === "hero" ? "Bot folded." : "You folded."}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onPlayAgain}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={onMenu}
                className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:border-slate-500 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

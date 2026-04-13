import { useState, useCallback } from "react"
import type { GameState, MoveLogEntry, Screen, Settings } from "./types"
import { postAction, getGameState } from "./api"
import { WelcomeScreen } from "./components/WelcomeScreen"
import { SettingsScreen } from "./components/SettingsScreen"
import { GameTable } from "./components/GameTable"

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome")
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([])
  const [botThinking, setBotThinking] = useState(false)
  const [bigBlind, setBigBlind] = useState(10)
  const [startingStack, setStartingStack] = useState(1000)
  const [error, setError] = useState<string | null>(null)

  function handleGameStart(state: GameState, settings: Settings) {
    setGameState(state)
    setMoveLog([])
    setBigBlind(settings.big_blind)
    setStartingStack(settings.stack_size)
    setBotThinking(false)
    setError(null)
    setScreen("game")
  }

  const handleAction = useCallback(
    async (action: string, amount: number | null) => {
      if (!gameState) return
      setBotThinking(true)
      setError(null)

      const preState = gameState

      try {
        // Run API call and minimum 1.2s delay in parallel for bot-thinking UX
        const [newState] = await Promise.all([
          postAction(gameState.game_id, action, amount),
          new Promise<void>((resolve) => setTimeout(resolve, 1200)),
        ])

        // Build hero log entry
        const heroEntry: MoveLogEntry = {
          player: "hero",
          action,
          ...(amount != null ? { amount } : {}),
          pot: newState.pot,
          street: preState.street,
          equity: newState.hero_equity,
        }

        const newEntries: MoveLogEntry[] = [heroEntry]

        // Detect bot action: if betting_history grew by ≥2, last entry is bot's
        const newActionCount =
          newState.betting_history.length - preState.betting_history.length
        if (newActionCount >= 2) {
          const botRecord =
            newState.betting_history[newState.betting_history.length - 1]
          if (botRecord?.player === "villain") {
            newEntries.push({
              player: "villain",
              action: String(botRecord.action),
              ...(typeof botRecord.amount === "number"
                ? { amount: botRecord.amount }
                : {}),
              pot: newState.pot,
              street: newState.street,
              equity: newState.hero_equity,
            })
          }
        }

        setMoveLog((prev) => [...prev, ...newEntries])
        setGameState(newState)

        // Between hands: winner set but session not over — fetch the auto-started next hand
        if (newState.winner !== null && !newState.session_over) {
          setTimeout(async () => {
            try {
              const nextHand = await getGameState(newState.game_id)
              setGameState(nextHand)
            } catch {
              // ignore — user can still see the hand result
            }
          }, 2000)
        }
      } catch {
        setError("Action failed — please try again.")
      } finally {
        setBotThinking(false)
      }
    },
    [gameState],
  )

  return (
    <div className="min-h-screen bg-black text-slate-100">
      {/* Error toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm font-mono shadow-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {screen === "welcome" && (
        <WelcomeScreen onStart={() => setScreen("settings")} />
      )}

      {screen === "settings" && (
        <SettingsScreen onGameStart={handleGameStart} />
      )}

      {screen === "game" && gameState && (
        <GameTable
          gameState={gameState}
          moveLog={moveLog}
          botThinking={botThinking}
          bigBlind={bigBlind}
          startingStack={startingStack}
          onAction={handleAction}
          onPlayAgain={() => setScreen("settings")}
          onMenu={() => setScreen("welcome")}
        />
      )}
    </div>
  )
}

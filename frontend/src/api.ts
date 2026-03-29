import type { GameState, Settings } from "./types"

const BASE = "http://localhost:8000"

export async function startGame(settings: Settings): Promise<GameState> {
  const seedNum = settings.seed ? parseInt(settings.seed, 10) : null
  const res = await fetch(`${BASE}/start_game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stack_size: settings.stack_size,
      small_blind: settings.small_blind,
      big_blind: settings.big_blind,
      seed: seedNum !== null && !isNaN(seedNum) ? seedNum : null,
      difficulty: settings.difficulty,
    }),
  })
  if (!res.ok) throw new Error(`start_game failed: ${res.status}`)
  return res.json()
}

export async function getGameState(gameId: string): Promise<GameState> {
  const res = await fetch(`${BASE}/game_state/${gameId}`)
  if (!res.ok) throw new Error(`game_state failed: ${res.status}`)
  return res.json()
}

export async function postAction(
  gameId: string,
  action: string,
  amount: number | null,
): Promise<GameState> {
  const res = await fetch(`${BASE}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game_id: gameId, action, amount }),
  })
  if (!res.ok) throw new Error(`action failed: ${res.status}`)
  return res.json()
}

export type Screen = "welcome" | "settings" | "game"
export type Street = "preflop" | "flop" | "turn" | "river" | "showdown"
export type Difficulty = "random" | "cheat" | "ppo"

export interface GameState {
  game_id: string
  street: Street
  pot: number
  player_stack: number
  bot_stack: number
  player_hand: string[]
  villain_hand: string[]
  board: string[]
  betting_history: ActionRecord[]
  to_act: string
  legal_actions: string[]
  hero_equity: number | null
  winner: string | null
  session_over: boolean
  hand_number: number
}

export interface ActionRecord {
  player: string
  action: string
  amount?: number
}

export interface MoveLogEntry {
  player: "hero" | "villain"
  action: string
  amount?: number
  pot: number
  street: Street
  equity: number | null
}

export interface Settings {
  difficulty: Difficulty
  stack_size: number
  small_blind: number
  big_blind: number
  seed: string
}

# API Contract

## Base assumptions

- JSON over HTTP.
- Heads-up Texas Hold'em only.
- In-memory state storage (`game_store`) keyed by `game_id`.
- Players are `"hero"` and `"villain"` internally.
- API responses expose only the player's hole cards (bot hole cards remain private until showdown).

## Endpoints

### `POST /start_game`
Create a new game and return an initial client-safe state snapshot.

Request example:

```json
{
  "stack_size": 1000,
  "small_blind": 5,
  "big_blind": 10,
  "seed": 12345,
  "difficulty": "random"
}
```

All fields are optional. Defaults: `stack_size=1000`, `small_blind=5`, `big_blind=10`, `seed=null`, `difficulty="random"`. Valid `difficulty` values: `"random"`, `"cheat"`, `"ppo"`.

Response example:

```json
{
  "game_id": "uuid-string",
  "street": "preflop",
  "pot": 15,
  "player_stack": 995,
  "bot_stack": 990,
  "player_hand": ["Ah", "Kd"],
  "villain_hand": [],
  "board": [],
  "betting_history": [],
  "to_act": "hero",
  "legal_actions": ["fold", "call", "raise"],
  "hero_equity": 0.67,
  "winner": null
}
```

### `GET /game_state/{game_id}`
Return the current client-safe state snapshot for a game.

Response example (mid-hand):

```json
{
  "game_id": "uuid-string",
  "street": "flop",
  "pot": 40,
  "player_stack": 980,
  "bot_stack": 980,
  "player_hand": ["Ah", "Kd"],
  "villain_hand": [],
  "board": ["7c", "2s", "Td"],
  "betting_history": [{"player": "hero", "action": "call", "amount": null}],
  "to_act": "hero",
  "legal_actions": ["check", "raise"],
  "hero_equity": 0.54,
  "winner": null
}
```

Response example (finished game):

```json
{
  "game_id": "uuid-string",
  "street": "showdown",
  "pot": 200,
  "player_stack": 900,
  "bot_stack": 1100,
  "player_hand": ["Ah", "Kd"],
  "villain_hand": ["Qh", "Jc"],
  "board": ["7c", "2s", "Td", "3h", "9s"],
  "betting_history": [],
  "to_act": "hero",
  "legal_actions": [],
  "hero_equity": null,
  "winner": "villain"
}
```

Note: `legal_actions` is empty and `hero_equity` is null for finished games. `villain_hand` is populated only at showdown.

### `POST /action`
Submit a player action and receive the updated game state after the bot responds.

Request example:

```json
{
  "game_id": "uuid-string",
  "player": "hero",
  "action": "raise",
  "amount": 40
}
```

`player` must be `"hero"`. Valid `action` values: `"fold"`, `"check"`, `"call"`, `"raise"`. `amount` is required only for `"raise"`.

Response: same shape as `GET /game_state/{game_id}`.

Returns `400` if the action is illegal for the current game state.
Returns `404` if `game_id` is not found.

### `GET /health`
Service liveness endpoint.

Response example:

```json
{
  "status": "ok"
}
```

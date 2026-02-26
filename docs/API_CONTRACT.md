# API Contract

## Base assumptions

- JSON over HTTP.
- Heads-up Texas Hold'em only.
- In-memory state storage (`game_store`) keyed by `game_id`.
- Players are `"hero"` and `"villain"` internally.
- API responses expose only the player's hole cards (bot hole cards remain private).

## Endpoints

### `POST /start_game`
Create a new game and return an initial client-safe state snapshot.

Request example:

```json
{
  "stack_size": 1000,
  "small_blind": 5,
  "big_blind": 10,
  "seed": 12345
}
```

Response example:

```json
{
  "game_id": "uuid-string",
  "street": "preflop",
  "pot": 0,
  "player_stack": 1000,
  "bot_stack": 1000,
  "player_hand": ["Ah", "Kd"],
  "board": [],
  "betting_history": []
}
```

### `GET /game_state/{game_id}`
Return the current client-safe state snapshot for a game.

Response example:

```json
{
  "game_id": "uuid-string",
  "street": "flop",
  "pot": 0,
  "player_stack": 1000,
  "bot_stack": 1000,
  "player_hand": ["Ah", "Kd"],
  "board": ["7c", "2s", "Td"],
  "betting_history": []
}
```

### `GET /health`
Service liveness endpoint.

Response example:

```json
{
  "status": "ok"
}
```

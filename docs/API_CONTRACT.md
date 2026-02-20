# API Contract (Day 1)

## Base assumptions

- JSON over HTTP.
- Heads-up Texas Hold'em only.
- In-memory session store for Day 1 (`GAMES` dictionary).
- Players are `"hero"` and `"villain"`.
- Streets are `"preflop"`, `"flop"`, `"turn"`, `"river"`, `"showdown"`.
- Action set (v1): `"fold"`, `"check"`, `"call"`, `"raise"`.

## Endpoints

### `POST /game/new`
Create a new game and return its initial state.

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
  "pot": 15,
  "to_act": "hero",
  "legal_actions": ["fold", "check", "call", "raise"],
  "state": {}
}
```

### `POST /game/action`
Apply one action to an existing game.

Request example:

```json
{
  "game_id": "uuid-string",
  "player": "hero",
  "action": "raise",
  "amount": 30
}
```

Response example:

```json
{
  "game_id": "uuid-string",
  "street": "preflop",
  "pot": 45,
  "to_act": "villain",
  "legal_actions": ["fold", "check", "call", "raise"],
  "state": {}
}
```

### `GET /game/state/{game_id}`
Return current game state.

Response example:

```json
{
  "game_id": "uuid-string",
  "street": "turn",
  "pot": 135,
  "to_act": "hero",
  "legal_actions": ["fold", "check", "call", "raise"],
  "state": {}
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

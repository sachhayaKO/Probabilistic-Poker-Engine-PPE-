# API Contract (Planned)

## Base assumptions

- JSON over HTTP.
- Versioning approach (to be implemented): `/api/v1/...`.
- Heads-up Texas Hold'em only in first release.

## Endpoints (planned)

### `POST /game/new`
Create a new heads-up game instance.

**Request (example)**

```json
{
  "stack_size": 1000,
  "small_blind": 5,
  "big_blind": 10,
  "seed": 12345
}
```

**Response (example)**

```json
{
  "game_id": "uuid-string",
  "street": "preflop",
  "pot": 15,
  "hero_position": "button",
  "legal_actions": ["fold", "call", "raise"],
  "state": {}
}
```

### `POST /game/action`
Apply one player action and advance game state.

**Request (example)**

```json
{
  "game_id": "uuid-string",
  "player": "hero",
  "action": "raise",
  "amount": 30
}
```

**Response (example)**

```json
{
  "game_id": "uuid-string",
  "street": "flop",
  "pot": 75,
  "to_act": "villain",
  "legal_actions": ["fold", "call", "raise", "check"],
  "terminal": false,
  "result": null,
  "state": {}
}
```

### `GET /game/state/{game_id}`
Return current public and authorized private state.

**Response (example)**

```json
{
  "game_id": "uuid-string",
  "street": "turn",
  "board": ["Ah", "Kd", "7c", "2s"],
  "pot": 135,
  "stacks": {
    "hero": 910,
    "villain": 955
  },
  "last_action": {
    "player": "villain",
    "action": "call",
    "amount": 30
  },
  "state": {}
}
```

### `GET /health`
Service health/status placeholder.


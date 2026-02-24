from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.app.schemas.game import ActionRequest, GameResponse, NewGameRequest
from backend.app.storage import ActionRecord, load_game, save_action, save_game
from engine.poker import GameState, apply_action, legal_actions, new_game

router = APIRouter(prefix="/game", tags=["game"])


@router.post("/new", response_model=GameResponse)
def create_game(payload: NewGameRequest) -> GameResponse:
    state = new_game(
        stack_size=payload.stack_size,
        small_blind=payload.small_blind,
        big_blind=payload.big_blind,
        seed=payload.seed,
    )
    save_game(state)
    return _to_response(state)


@router.post("/action", response_model=GameResponse)
def act(payload: ActionRequest) -> GameResponse:
    state = load_game(payload.game_id)
    if state is None:
        raise HTTPException(status_code=404, detail="game not found")

    try:
        updated = apply_action(
            state=state,
            player=payload.player,  # type: ignore[arg-type]
            action=payload.action,
            amount=payload.amount,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    save_game(updated)
    save_action(
        ActionRecord(
            game_id=payload.game_id,
            player=payload.player,
            action=payload.action,
            amount=payload.amount,
        )
    )
    return _to_response(updated)


@router.get("/state/{game_id}", response_model=GameResponse)
def game_state(game_id: str) -> GameResponse:
    state = load_game(game_id)
    if state is None:
        raise HTTPException(status_code=404, detail="game not found")
    return _to_response(state)


def _to_response(state: GameState) -> GameResponse:
    return GameResponse(
        game_id=state.game_id,
        street=state.street,
        pot=state.pot,
        to_act=state.to_act,
        legal_actions=legal_actions(state),
        state=state.to_public_dict(),
    )

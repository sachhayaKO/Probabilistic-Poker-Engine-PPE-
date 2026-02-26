from __future__ import annotations

"""
Game routes for creating and retrieving poker game state.

Route handlers convert between API payloads and engine state objects while
keeping bot private cards hidden in client responses.
"""

from fastapi import APIRouter, HTTPException

from backend.app.schemas.game import GameStateResponse, StartGameRequest
from backend.app.storage import load_game_state, save_game_state
from engine.poker import new_game

router = APIRouter(tags=["game"])


@router.post("/start_game", response_model=GameStateResponse)
def start_game(payload: StartGameRequest) -> GameStateResponse:
    state = new_game(
        stack_size=payload.stack_size,
        small_blind=payload.small_blind,
        big_blind=payload.big_blind,
        seed=payload.seed,
    )
    save_game_state(state.to_dict())
    return _to_game_state_response(state.to_dict())


@router.get("/game_state/{game_id}", response_model=GameStateResponse)
def game_state(game_id: str) -> GameStateResponse:
    state_dict = load_game_state(game_id)
    if state_dict is None:
        raise HTTPException(status_code=404, detail="game not found")
    return _to_game_state_response(state_dict)


def _to_game_state_response(state_dict: dict[str, object]) -> GameStateResponse:
    hands = state_dict.get("hands", {})
    if not isinstance(hands, dict):
        raise ValueError("invalid state: hands must be a dictionary")

    hero_cards = hands.get("hero", [])
    if not isinstance(hero_cards, list):
        raise ValueError("invalid state: hero hand must be a list")

    stacks = state_dict.get("stacks", {})
    if not isinstance(stacks, dict):
        raise ValueError("invalid state: stacks must be a dictionary")

    betting_history = state_dict.get("betting_history", [])
    if not isinstance(betting_history, list):
        raise ValueError("invalid state: betting_history must be a list")

    board = state_dict.get("board", [])
    if not isinstance(board, list):
        raise ValueError("invalid state: board must be a list")

    game_id = state_dict.get("game_id")
    street = state_dict.get("street")
    pot = state_dict.get("pot")
    hero_stack = stacks.get("hero")
    villain_stack = stacks.get("villain")

    if not isinstance(game_id, str):
        raise ValueError("invalid state: game_id must be a string")
    if not isinstance(street, str):
        raise ValueError("invalid state: street must be a string")
    if not isinstance(pot, int):
        raise ValueError("invalid state: pot must be an integer")
    if not isinstance(hero_stack, int):
        raise ValueError("invalid state: hero stack must be an integer")
    if not isinstance(villain_stack, int):
        raise ValueError("invalid state: villain stack must be an integer")

    return GameStateResponse(
        game_id=game_id,
        street=street,
        pot=pot,
        player_stack=hero_stack,
        bot_stack=villain_stack,
        player_hand=[str(card) for card in hero_cards],
        board=[str(card) for card in board],
        betting_history=betting_history,
    )

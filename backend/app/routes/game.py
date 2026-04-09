from __future__ import annotations

"""
Game routes: start_game, game_state, and action.
"""

import random as stdlib_random

from fastapi import APIRouter, HTTPException

from backend.app.core.logging import get_logger
from backend.app.schemas.game import ActionRequest, GameStateResponse, StartGameRequest
from backend.app.storage import load_game_state, save_game_state
from engine.poker.cards import Card, Deck, RANKS, SUITS
from engine.poker.evaluator import evaluate_hand
from engine.poker.game import apply_action
from engine.poker.game import legal_actions as get_legal_actions
from engine.poker.game import new_game
from engine.poker.ml.equity import run_equity_estimate
from engine.poker.state import GameState

logger = get_logger(__name__)

router = APIRouter(tags=["game"])


# ── Deck helpers ──────────────────────────────────────────────────────────────


def _serialize_deck(deck: Deck) -> list[str]:
    return [card.to_str() for card in deck.cards]


def _deserialize_deck(card_strings: list[str]) -> Deck:
    deck = Deck()
    # NOTE: Directly setting _cards bypasses Deck's public API. Deck has no factory
    # that accepts a pre-built card list. The _rng is freshly seeded by system entropy,
    # which means seeded-game reproducibility is broken if shuffle() is called after
    # deserialization. Fixable by adding Deck.from_cards() to the engine.
    deck._cards = [Card.from_str(s) for s in card_strings]
    return deck


# ── State reconstruction ──────────────────────────────────────────────────────


def _reconstruct_game_state(state_dict: dict[str, object]) -> GameState:
    deck = _deserialize_deck(list(state_dict.get("deck_cards", [])))  # type: ignore[arg-type]

    hands_raw = state_dict.get("hands", {})
    if not isinstance(hands_raw, dict):
        raise ValueError("invalid state: hands must be a dict")

    hero_cards = [Card.from_str(str(s)) for s in hands_raw.get("hero", [])]  # type: ignore[union-attr]
    villain_cards = [Card.from_str(str(s)) for s in hands_raw.get("villain", [])]  # type: ignore[union-attr]
    board = [Card.from_str(str(s)) for s in state_dict.get("board", [])]  # type: ignore[arg-type]

    stacks_raw = state_dict.get("stacks", {"hero": 0, "villain": 0})
    if not isinstance(stacks_raw, dict):
        raise ValueError("invalid state: stacks must be a dict")

    return GameState(
        game_id=str(state_dict["game_id"]),
        seed=state_dict.get("seed"),  # type: ignore[arg-type]
        street=str(state_dict["street"]),  # type: ignore[arg-type]
        pot=int(state_dict["pot"]),  # type: ignore[arg-type]
        stacks={"hero": int(stacks_raw["hero"]), "villain": int(stacks_raw["villain"])},
        hands={"hero": hero_cards, "villain": villain_cards},
        board=board,
        deck=deck,
        to_act=str(state_dict.get("to_act", "hero")),  # type: ignore[arg-type]
        betting_history=list(state_dict.get("betting_history", [])),  # type: ignore[arg-type]
    )


# ── Winner determination ──────────────────────────────────────────────────────


def _determine_winner(state: GameState) -> str:
    hero_score = evaluate_hand(state.hands["hero"] + state.board)
    villain_score = evaluate_hand(state.hands["villain"] + state.board)
    if hero_score > villain_score:
        return "hero"
    if villain_score > hero_score:
        return "villain"
    return "tie"


# ── Bot action helpers ────────────────────────────────────────────────────────


def _random_bot_action(state: GameState, big_blind: int) -> tuple[str, int | None]:
    actions = get_legal_actions(state)
    if not actions:
        return "check", None
    action = stdlib_random.choice(actions)
    if action == "raise":
        pot = max(state.pot, big_blind)
        choices = [big_blind, pot // 2, pot]
        amount = min(stdlib_random.choice(choices), state.stacks["villain"])
        return "raise", max(amount, 1)
    return action, None


def _cheat_bot_action(state: GameState, big_blind: int) -> tuple[str, int | None]:
    """Perfect-information bot: knows both hands, runs villain-perspective MC rollouts."""
    hero_hole = state.hands["hero"]
    villain_hole = state.hands["villain"]
    board = state.board

    known_strs = {str(c) for c in hero_hole + villain_hole + board}
    unknown = [
        Card(rank=r, suit=s)
        for s in SUITS
        for r in RANKS
        if f"{r}{s}" not in known_strs
    ]
    n_board_needed = 5 - len(board)
    rng = stdlib_random.Random()
    wins = 0.0
    n = 300
    for _ in range(n):
        sample = rng.sample(unknown, n_board_needed)
        full_board = board + sample
        hero_score = evaluate_hand(hero_hole + full_board)
        villain_score = evaluate_hand(villain_hole + full_board)
        if villain_score > hero_score:
            wins += 1.0
        elif villain_score == hero_score:
            wins += 0.5
    villain_equity = wins / n

    villain_stack = state.stacks["villain"]
    pot = state.pot
    if villain_equity > 0.6:
        amount = min(max(pot, big_blind), villain_stack)
        return "raise", max(amount, 1)
    if villain_equity > 0.4:
        return "call", None
    return "fold", None


def _get_bot_action(
    state: GameState, difficulty: str, big_blind: int
) -> tuple[str, int | None]:
    if difficulty == "cheat":
        return _cheat_bot_action(state, big_blind)
    if difficulty == "ppo":
        try:
            import os

            checkpoint = "scripts/checkpoints/checkpoint_latest.pt"
            if os.path.exists(checkpoint):
                from engine.poker.ml.agent import BotAgent

                agent = BotAgent(checkpoint)
                return agent.act(state)
        except Exception:
            pass
    return _random_bot_action(state, big_blind)


# ── Response builder ──────────────────────────────────────────────────────────


def _to_game_state_response(
    state_dict: dict[str, object],
    *,
    villain_hand: list[str] | None = None,
    hero_equity: float | None = None,
    winner: str | None = None,
    session_over: bool = False,
    hand_number: int = 1,
) -> GameStateResponse:
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

    to_act = str(state_dict.get("to_act", "hero"))
    legal = state_dict.get("legal_actions", [])
    legal_actions_list = list(legal) if isinstance(legal, list) else []

    stored_winner = state_dict.get("winner")
    resolved_winner = winner if winner is not None else (str(stored_winner) if stored_winner else None)

    stored_villain = state_dict.get("villain_hand", [])
    resolved_villain = villain_hand if villain_hand is not None else (list(stored_villain) if isinstance(stored_villain, list) else [])

    return GameStateResponse(
        game_id=game_id,
        street=street,  # type: ignore[arg-type]
        pot=pot,
        player_stack=hero_stack,
        bot_stack=villain_stack,
        player_hand=[str(card) for card in hero_cards],
        villain_hand=resolved_villain,
        board=[str(card) for card in board],
        betting_history=betting_history,
        to_act=to_act,  # type: ignore[arg-type]
        legal_actions=legal_actions_list,
        hero_equity=hero_equity,
        winner=resolved_winner,
        session_over=session_over,
        hand_number=hand_number,
    )


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/start_game", response_model=GameStateResponse)
def start_game(payload: StartGameRequest) -> GameStateResponse:
    state = new_game(
        stack_size=payload.stack_size,
        small_blind=payload.small_blind,
        big_blind=payload.big_blind,
        seed=payload.seed,
    )

    state_dict = state.to_dict()
    state_dict["deck_cards"] = _serialize_deck(state.deck)
    state_dict["difficulty"] = payload.difficulty
    state_dict["big_blind"] = payload.big_blind
    state_dict["small_blind"] = payload.small_blind
    state_dict["legal_actions"] = get_legal_actions(state)
    state_dict["hand_number"] = 1

    save_game_state(state_dict)

    hero_equity = run_equity_estimate(state.hands["hero"], state.board)

    return _to_game_state_response(
        state_dict,
        villain_hand=[],
        hero_equity=hero_equity,
        winner=None,
        session_over=False,
        hand_number=1,
    )


@router.get("/game_state/{game_id}", response_model=GameStateResponse)
def game_state(game_id: str) -> GameStateResponse:
    state_dict = load_game_state(game_id)
    if state_dict is None:
        raise HTTPException(status_code=404, detail="game not found")

    villain_hand: list[str] = list(state_dict.get("villain_hand", []))  # type: ignore[arg-type]
    stored_winner = state_dict.get("winner")
    winner = str(stored_winner) if stored_winner else None
    session_over = bool(state_dict.get("session_over", False))
    hand_number = int(state_dict.get("hand_number", 1))  # type: ignore[arg-type]
    hero_equity: float | None = None

    if winner is not None:
        state_dict["legal_actions"] = []

    if state_dict.get("street") != "showdown" and winner is None:
        state = _reconstruct_game_state(state_dict)
        hero_equity = run_equity_estimate(state.hands["hero"], state.board)

    return _to_game_state_response(
        state_dict,
        villain_hand=villain_hand,
        hero_equity=hero_equity,
        winner=winner,
        session_over=session_over,
        hand_number=hand_number,
    )


@router.post("/action", response_model=GameStateResponse)
def action(payload: ActionRequest) -> GameStateResponse:
    state_dict = load_game_state(payload.game_id)
    if state_dict is None:
        raise HTTPException(status_code=404, detail="game not found")

    state = _reconstruct_game_state(state_dict)
    big_blind = int(state_dict.get("big_blind", 10))
    difficulty = str(state_dict.get("difficulty", "random"))

    # Apply hero action
    try:
        apply_action(state, payload.player, payload.action, payload.amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    winner: str | None = None
    villain_hand: list[str] = []

    # Check if hero folded — game over immediately
    if payload.action == "fold":
        winner = "villain"
    else:
        # Bot acts if it's now the villain's turn and game is still live
        if state.to_act == "villain" and state.street != "showdown":
            bot_action, bot_amount = _get_bot_action(state, difficulty, big_blind)
            try:
                apply_action(state, "villain", bot_action, bot_amount)
            except ValueError as exc:
                logger.warning("bot action %s failed (%s), falling back to check", bot_action, exc)
                bot_action, bot_amount = "check", None
                apply_action(state, "villain", bot_action, bot_amount)
            if bot_action == "fold":
                winner = "hero"

    # Determine showdown winner and reveal villain cards
    if state.street == "showdown" and winner is None:
        winner = _determine_winner(state)
        villain_hand = [c.to_str() for c in state.hands["villain"]]

    # Compute hero equity (only during live non-showdown play)
    hero_equity: float | None = None
    if winner is None and state.street != "showdown":
        hero_equity = run_equity_estimate(state.hands["hero"], state.board)

    # Build base state dict
    new_dict = state.to_dict()
    new_dict["deck_cards"] = _serialize_deck(state.deck)
    new_dict["difficulty"] = difficulty
    new_dict["big_blind"] = big_blind
    small_blind = int(state_dict.get("small_blind", 5))
    new_dict["small_blind"] = small_blind
    new_dict["legal_actions"] = get_legal_actions(state)
    current_hand_number = int(state_dict.get("hand_number", 1))  # type: ignore[arg-type]

    # No winner yet — persist mid-hand state and return
    if winner is None:
        new_dict["hand_number"] = current_hand_number
        save_game_state(new_dict)
        return _to_game_state_response(
            new_dict,
            villain_hand=None,
            hero_equity=hero_equity,
            winner=None,
            session_over=False,
            hand_number=current_hand_number,
        )

    # Winner determined — award pot and decide continuation
    if villain_hand:
        new_dict["villain_hand"] = villain_hand

    if winner == "hero":
        new_hero_stack = state.stacks["hero"] + state.pot
        new_villain_stack = state.stacks["villain"]
    elif winner == "villain":
        new_hero_stack = state.stacks["hero"]
        new_villain_stack = state.stacks["villain"] + state.pot
    else:  # tie
        half = state.pot // 2
        new_hero_stack = state.stacks["hero"] + half
        new_villain_stack = state.stacks["villain"] + (state.pot - half)

    session_over = new_hero_stack <= 0 or new_villain_stack <= 0

    if session_over:
        new_dict["stacks"] = {"hero": new_hero_stack, "villain": new_villain_stack}
        new_dict["winner"] = winner
        new_dict["session_over"] = True
        new_dict["hand_number"] = current_hand_number
        new_dict["legal_actions"] = []
        save_game_state(new_dict)
        return _to_game_state_response(
            new_dict,
            villain_hand=villain_hand if villain_hand else None,
            hero_equity=None,
            winner=winner,
            session_over=True,
            hand_number=current_hand_number,
        )

    # Auto-start the next hand with carried-over stacks
    next_hand_number = current_hand_number + 1
    next_state = new_game(small_blind=small_blind, big_blind=big_blind)
    next_state.stacks["hero"] = new_hero_stack
    next_state.stacks["villain"] = new_villain_stack
    next_state.game_id = payload.game_id  # keep same game_id so frontend can fetch it

    next_dict = next_state.to_dict()
    next_dict["deck_cards"] = _serialize_deck(next_state.deck)
    next_dict["difficulty"] = difficulty
    next_dict["big_blind"] = big_blind
    next_dict["small_blind"] = small_blind
    next_dict["hand_number"] = next_hand_number
    next_dict["legal_actions"] = get_legal_actions(next_state)
    save_game_state(next_dict)

    # Return the just-finished hand's result so the frontend can display it briefly
    new_dict["stacks"] = {"hero": new_hero_stack, "villain": new_villain_stack}
    new_dict["legal_actions"] = []
    return _to_game_state_response(
        new_dict,
        villain_hand=villain_hand if villain_hand else None,
        hero_equity=None,
        winner=winner,
        session_over=False,
        hand_number=next_hand_number,
    )

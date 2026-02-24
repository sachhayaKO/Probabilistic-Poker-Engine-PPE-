from __future__ import annotations

from dataclasses import dataclass

from engine.poker.cards import Card
from engine.poker.state import GameState


@dataclass
class ActionRecord:
    game_id: str
    player: str
    action: str
    amount: int | None = None


def serialize_game_state(state: GameState) -> dict[str, object]:
    return {
        "game_id": state.game_id,
        "seed": state.seed,
        "street": state.street,
        "pot": state.pot,
        "stacks": state.stacks,
        "hands": {
            "hero": [str(card) for card in state.hands["hero"]],
            "villain": [str(card) for card in state.hands["villain"]],
        },
        "board": [str(card) for card in state.board],
        "to_act": state.to_act,
        "betting_history": state.betting_history,
    }


def deserialize_game_state(payload: dict[str, object]) -> GameState:
    hands = payload["hands"]
    assert isinstance(hands, dict)

    hero_cards = [Card.from_str(card) for card in hands["hero"]]
    villain_cards = [Card.from_str(card) for card in hands["villain"]]
    board_cards = [Card.from_str(card) for card in payload["board"]]

    return GameState(
        game_id=payload["game_id"],
        seed=payload["seed"],
        street=payload["street"],
        pot=payload["pot"],
        stacks=payload["stacks"],
        hands={"hero": hero_cards, "villain": villain_cards},
        board=board_cards,
        to_act=payload["to_act"],
        betting_history=payload["betting_history"],
    )

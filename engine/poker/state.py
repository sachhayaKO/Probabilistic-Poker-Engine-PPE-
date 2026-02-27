from __future__ import annotations

"""
Mini Spec: Game State Container

Inputs:
- Engine-generated game metadata and per-player card/state fields.
- Active deck for street dealing progression.

Outputs:
- In-memory GameState object.
- JSON-ready dict snapshots for engine/API usage.

Rules:
- Player IDs are fixed to "hero" and "villain".
- Streets are fixed to preflop/flop/turn/river/showdown.
- deck remains internal engine state and is never serialized.
- Public state must hide villain hole cards.

Edge cases:
- Unknown player in to_private_dict raises ValueError.

Workflow:
1. Engine mutates GameState over time.
2. API calls to_public_dict for general responses.
3. Future auth-aware endpoints can call to_private_dict(player).
"""

from dataclasses import dataclass, field
from typing import Literal

from engine.poker.cards import Card, Deck

Player = Literal["hero", "villain"]
Street = Literal["preflop", "flop", "turn", "river", "showdown"]


@dataclass
class GameState:
    game_id: str
    seed: int | None
    street: Street
    pot: int
    stacks: dict[Player, int]
    hands: dict[Player, list[Card]]
    board: list[Card] = field(default_factory=list)
    deck: Deck = field(default_factory=Deck, repr=False)
    to_act: Player = "hero"
    betting_history: list[dict[str, object]] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        """Full engine state serializer with JSON-safe primitives only."""
        return {
            "game_id": self.game_id,
            "seed": self.seed,
            "street": self.street,
            "pot": self.pot,
            "stacks": self.stacks,
            "hands": {
                "hero": [card.to_str() for card in self.hands["hero"]],
                "villain": [card.to_str() for card in self.hands["villain"]],
            },
            "board": [card.to_str() for card in self.board],
            "to_act": self.to_act,
            "betting_history": self.betting_history,
            "deck_remaining": len(self.deck.cards),
        }

    def to_public_dict(self) -> dict[str, object]:
        # Public API policy: hide villain hole cards in shared payloads.
        public_state = self.to_dict()
        public_state["hands"] = {
            "hero": [card.to_str() for card in self.hands["hero"]],
            "villain": [],
        }
        return public_state

    def to_private_dict(self, player: Player) -> dict[str, object]:
        if player not in self.hands:
            raise ValueError(f"unknown player: {player}")

        private_state = self.to_dict()
        # Only reveal the requesting player's hole cards.
        private_state["hands"] = {
            "hero": [card.to_str() for card in self.hands["hero"]] if player == "hero" else [],
            "villain": [card.to_str() for card in self.hands["villain"]] if player == "villain" else [],
        }
        return private_state

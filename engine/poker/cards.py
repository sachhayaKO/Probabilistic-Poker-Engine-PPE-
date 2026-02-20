from __future__ import annotations

"""
Day 1 Mini Spec: Cards and Deck

Inputs:
- Card string tokens like "Ah", "Td", "2c".
- Optional integer seed for deck creation.

Outputs:
- Immutable Card objects.
- Deterministically shuffled decks when seed is provided.

Rules:
- Rank must be one of 23456789TJQKA.
- Suit must be one of c, d, h, s.
- Deal removes cards from the deck.

Edge cases:
- Invalid rank/suit/card token raises ValueError.
- Dealing more cards than remain raises ValueError.

Workflow:
1. Create Deck(seed).
2. Call shuffle().
3. Call deal(n) as cards are needed.
"""

from dataclasses import dataclass
import random

RANKS = "23456789TJQKA"
SUITS = "cdhs"


@dataclass(frozen=True)
class Card:
    """Canonical 2-char card representation (rank + suit)."""

    rank: str
    suit: str

    def __post_init__(self) -> None:
        if self.rank not in RANKS:
            raise ValueError(f"invalid rank: {self.rank}")
        if self.suit not in SUITS:
            raise ValueError(f"invalid suit: {self.suit}")

    def __str__(self) -> str:
        return f"{self.rank}{self.suit}"

    @classmethod
    def from_str(cls, value: str) -> "Card":
        if len(value) != 2:
            raise ValueError(f"invalid card string: {value}")
        return cls(rank=value[0], suit=value[1])


class Deck:
    """52-card deck with deterministic RNG support for repeatable tests."""

    def __init__(self, seed: int | None = None) -> None:
        self._rng = random.Random(seed)
        self._cards = [Card(rank=rank, suit=suit) for suit in SUITS for rank in RANKS]

    def shuffle(self) -> None:
        self._rng.shuffle(self._cards)

    def deal(self, n: int = 1) -> list[Card]:
        if n < 0:
            raise ValueError("n must be non-negative")
        if n > len(self._cards):
            raise ValueError("not enough cards left in deck")
        # Slice + delete keeps dealing order explicit and easy to reason about.
        dealt = self._cards[:n]
        del self._cards[:n]
        return dealt

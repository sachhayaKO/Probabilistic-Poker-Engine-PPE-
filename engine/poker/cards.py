from __future__ import annotations

"""
Day 2 Mini Spec: Cards and Deck

Inputs:
- Card string tokens like "Ah", "Td", "2c".
- Optional integer seed for shuffling.

Outputs:
- Immutable Card objects.
- Deck with reset/shuffle/deal/burn lifecycle methods.

Rules:
- Rank must be one of 23456789TJQKA.
- Suit must be one of c, d, h, s.
- reset() restores all 52 cards in canonical order.
- shuffle(seed) is deterministic for the same seed.
- deal(n) removes and returns n cards from top of deck.
- burn(n) removes cards without returning them.

Edge cases:
- Invalid rank/suit/card token raises ValueError.
- Dealing more cards than remain raises ValueError.
- Burn with negative count raises ValueError.

Workflow:
1. Create Deck().
2. Optional: reset() to canonical order.
3. shuffle(seed) for deterministic random order.
4. deal/burn as streets progress.
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

    def to_str(self) -> str:
        """Explicit serializer used by state JSON helpers."""
        return str(self)

    @classmethod
    def from_str(cls, value: str) -> "Card":
        if len(value) != 2:
            raise ValueError(f"invalid card string: {value}")
        rank = value[0].upper()
        suit = value[1].lower()
        return cls(rank=rank, suit=suit)


class Deck:
    """52-card deck with deterministic RNG support for repeatable tests."""

    def __init__(self) -> None:
        self._rng = random.Random()
        self._cards: list[Card] = []
        self.reset()

    @property
    def cards(self) -> list[Card]:
        """Read-only copy for tests and diagnostics."""
        return list(self._cards)

    def reset(self) -> None:
        self._cards = [Card(rank=rank, suit=suit) for suit in SUITS for rank in RANKS]

    def shuffle(self, seed: int | None = None) -> None:
        if seed is not None:
            self._rng.seed(seed)
        self._rng.shuffle(self._cards)

    def deal(self, n: int = 1) -> list[Card]:
        if n <= 0:
            raise ValueError("n must be positive")
        if n > len(self._cards):
            raise ValueError("not enough cards left in deck")
        # Slice + delete keeps dealing order explicit and easy to reason about.
        dealt = self._cards[:n]
        del self._cards[:n]
        return dealt

    def burn(self, n: int = 1) -> None:
        if n < 0:
            raise ValueError("n must be non-negative")
        if n > len(self._cards):
            raise ValueError("not enough cards left in deck")
        if n == 0:
            return
        del self._cards[:n]

from __future__ import annotations

"""
Poker hand evaluator for 5-to-7 card hands.

Evaluates the best 5-card hand from a collection of cards and returns a
comparable integer score where higher values represent stronger hands.

Hand category rankings (ascending):
  0 = high card
  1 = one pair
  2 = two pair
  3 = three of a kind
  4 = straight
  5 = flush
  6 = full house
  7 = four of a kind
  8 = straight flush
"""

from collections import Counter
from itertools import combinations

from engine.poker.cards import Card, RANKS


def _rank_index(rank: str) -> int:
    """Return the 0-based index of a rank string (2=0, A=12)."""
    return RANKS.index(rank)


def _eval_five(cards: list[Card]) -> tuple[int, ...]:
    """
    Evaluate a exactly 5-card hand.

    Returns a tuple where lexicographic comparison gives the correct
    winner. The first element is the hand category (0–8).
    """
    ranks = sorted([_rank_index(c.rank) for c in cards], reverse=True)
    suits = [c.suit for c in cards]

    is_flush = len(set(suits)) == 1

    # Straight detection requires all 5 ranks to be distinct.
    is_straight = False
    straight_high = 0
    if len(set(ranks)) == 5:
        if ranks[0] - ranks[4] == 4:
            is_straight = True
            straight_high = ranks[0]
        elif ranks == [12, 3, 2, 1, 0]:  # A-2-3-4-5 wheel; treat as 5-high
            is_straight = True
            straight_high = 3

    counts: Counter[int] = Counter(ranks)
    # Sort groups: highest count first, then highest rank within same count.
    groups = sorted(counts.keys(), key=lambda r: (counts[r], r), reverse=True)
    c0 = counts[groups[0]]

    if is_straight and is_flush:
        return (8, straight_high)

    if c0 == 4:
        return (7, groups[0], groups[1])

    if c0 == 3 and len(groups) >= 2 and counts[groups[1]] == 2:
        return (6, groups[0], groups[1])

    if is_flush:
        return (5,) + tuple(ranks)

    if is_straight:
        return (4, straight_high)

    if c0 == 3:
        kickers = tuple(r for r in groups if counts[r] == 1)
        return (3, groups[0]) + kickers

    if c0 == 2 and len(groups) >= 2 and counts[groups[1]] == 2:
        kicker = tuple(r for r in groups if counts[r] == 1)
        return (2, groups[0], groups[1]) + kicker

    if c0 == 2:
        kickers = tuple(r for r in groups if counts[r] == 1)
        return (1, groups[0]) + kickers

    return (0,) + tuple(ranks)


def _tuple_to_int(t: tuple[int, ...]) -> int:
    """
    Encode a hand-score tuple as a single comparable integer.

    Pads the tuple to 6 elements and encodes in base 13.  Every element
    is at most 12 (highest rank index), so base-13 preserves order.
    """
    padded = (t + (0,) * 6)[:6]
    val = 0
    for v in padded:
        val = val * 13 + v
    return val


def evaluate_hand(cards: list[Card]) -> int:
    """
    Evaluate the best 5-card poker hand from a list of 5–7 cards.

    Iterates over all C(n,5) combinations and returns the score of the
    strongest hand as an integer where higher is better.

    Args:
        cards: Between 5 and 7 Card objects (hole cards + board).

    Returns:
        Integer hand score.  Suitable for direct comparison: a higher
        score means a stronger hand.

    Raises:
        ValueError: If fewer than 5 cards are provided.
    """
    if len(cards) < 5:
        raise ValueError(f"need at least 5 cards, got {len(cards)}")

    best: tuple[int, ...] = (-1,)
    for combo in combinations(cards, 5):
        score = _eval_five(list(combo))
        if score > best:
            best = score

    return _tuple_to_int(best)

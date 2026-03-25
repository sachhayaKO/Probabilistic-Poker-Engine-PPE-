from __future__ import annotations

"""
Monte Carlo equity estimator for heads-up Texas Hold'em.

Estimates hero's probability of winning against a random opponent hand by
sampling unknown cards and evaluating both complete 7-card hands.
"""

import random

from engine.poker.cards import Card, RANKS, SUITS
from engine.poker.evaluator import evaluate_hand


def run_equity_estimate(
    hole_cards: list[Card],
    community_cards: list[Card],
    n_simulations: int = 500,
    seed: int | None = None,
) -> float:
    """
    Estimate hero's equity via Monte Carlo rollouts.

    For each simulation, random hole cards are dealt to the opponent and
    remaining board cards are filled in.  Hero wins if ``evaluate_hand``
    scores hero's 7-card hand higher than the opponent's.  Ties count as
    half a win.

    Args:
        hole_cards: The two cards in hero's hand.
        community_cards: Board cards already dealt (0–5).
        n_simulations: Number of random rollouts to run.
        seed: Optional RNG seed for reproducible results.

    Returns:
        Win rate as a float in [0.0, 1.0].

    Raises:
        ValueError: If ``hole_cards`` does not contain exactly 2 cards, or
            if ``community_cards`` contains more than 5 cards.
    """
    if len(hole_cards) != 2:
        raise ValueError(f"hole_cards must have 2 cards, got {len(hole_cards)}")
    if len(community_cards) > 5:
        raise ValueError(f"community_cards must have ≤5 cards, got {len(community_cards)}")

    known_strs = {str(c) for c in hole_cards + community_cards}
    unknown: list[Card] = [
        Card(rank=r, suit=s)
        for s in SUITS
        for r in RANKS
        if f"{r}{s}" not in known_strs
    ]

    n_board_needed = 5 - len(community_cards)
    # 2 opponent hole cards + cards needed to complete the board
    n_to_sample = 2 + n_board_needed

    rng = random.Random(seed)
    wins = 0.0

    for _ in range(n_simulations):
        sample = rng.sample(unknown, n_to_sample)
        opp_hole = sample[:2]
        extra_board = sample[2:]

        full_board = community_cards + extra_board

        hero_score = evaluate_hand(hole_cards + full_board)
        opp_score = evaluate_hand(opp_hole + full_board)

        if hero_score > opp_score:
            wins += 1.0
        elif hero_score == opp_score:
            wins += 0.5

    return wins / n_simulations

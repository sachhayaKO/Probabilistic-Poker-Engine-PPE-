#!/usr/bin/env python3
"""
Command-line Monte Carlo equity estimator.

Usage
-----
    python scripts/run_monte_carlo.py <hole1> <hole2> [board...] [-n SIMS] [--seed SEED]

Examples
--------
    # Estimate equity for Ace-King suited preflop
    python scripts/run_monte_carlo.py Ah Kh

    # Equity on the flop
    python scripts/run_monte_carlo.py Ah Kh --board Qh Jh 2c

    # Reproducible run with 10 000 simulations
    python scripts/run_monte_carlo.py 7c 2d -n 10000 --seed 42
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from engine.poker.cards import Card
from engine.poker.ml.equity import run_equity_estimate


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Monte Carlo heads-up equity estimator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "hole_cards",
        nargs=2,
        metavar="CARD",
        help="Two hole cards (e.g. Ah Kh)",
    )
    parser.add_argument(
        "--board",
        nargs="*",
        default=[],
        metavar="CARD",
        help="0–5 community cards already dealt (e.g. Qh Jh 2c)",
    )
    parser.add_argument(
        "-n",
        "--simulations",
        type=int,
        default=10_000,
        metavar="N",
        help="Number of Monte Carlo rollouts (default: 10 000)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        metavar="SEED",
        help="Random seed for reproducible results",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)

    try:
        hole = [Card.from_str(c) for c in args.hole_cards]
    except ValueError as exc:
        sys.exit(f"error: invalid hole card — {exc}")

    try:
        board = [Card.from_str(c) for c in args.board]
    except ValueError as exc:
        sys.exit(f"error: invalid board card — {exc}")

    if len(board) > 5:
        sys.exit(f"error: board can have at most 5 cards, got {len(board)}")

    all_known = hole + board
    seen: set[str] = set()
    for card in all_known:
        key = str(card)
        if key in seen:
            sys.exit(f"error: duplicate card {key}")
        seen.add(key)

    print(f"Hole cards : {' '.join(str(c) for c in hole)}")
    if board:
        print(f"Board      : {' '.join(str(c) for c in board)}")
    else:
        print("Board      : (none — preflop)")
    print(f"Simulations: {args.simulations:,}")
    print()

    equity = run_equity_estimate(
        hole,
        board,
        n_simulations=args.simulations,
        seed=args.seed,
    )

    print(f"Hero equity: {equity:.4f}  ({equity * 100:.2f}%)")


if __name__ == "__main__":
    main()

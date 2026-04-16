#!/usr/bin/env python3
"""
Heads-up self-play simulator.

Runs N episodes of random-vs-random play (or agent-vs-random when a
checkpoint path is supplied) and reports win/loss/tie statistics plus
average pot size.

Usage
-----
    # 1 000 random-vs-random episodes
    python scripts/simulate_self_play.py -n 1000

    # Agent vs random using a saved checkpoint
    python scripts/simulate_self_play.py -n 500 --checkpoint scripts/checkpoints/checkpoint_latest.pt

    # Fixed seed for reproducibility
    python scripts/simulate_self_play.py -n 200 --seed 7
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from engine.poker.game import apply_action, legal_actions, new_game
from engine.poker.evaluator import evaluate_hand
from engine.poker.state import GameState

STARTING_STACK = 1000
BIG_BLIND = 10
MAX_STEPS = 100


def _random_action(state: GameState, rng: random.Random) -> tuple[str, int | None]:
    actions = legal_actions(state)
    if not actions:
        return "check", None
    action = rng.choice(actions)
    if action == "raise":
        pot = max(state.pot, BIG_BLIND)
        amount = rng.choice([BIG_BLIND, pot // 2, pot])
        return "raise", max(min(amount, state.stacks[state.to_act]), 1)
    return action, None


def _agent_action(agent: object, state: GameState) -> tuple[str, int | None]:  # type: ignore[type-arg]
    try:
        return agent.act(state)  # type: ignore[union-attr]
    except Exception:
        return "check", None


def _determine_winner(state: GameState) -> str | None:
    board = state.board
    hero_cards = state.hands["hero"] + board
    villain_cards = state.hands["villain"] + board
    if len(hero_cards) < 5 or len(villain_cards) < 5:
        return None
    hero_score = evaluate_hand(hero_cards)
    villain_score = evaluate_hand(villain_cards)
    if hero_score > villain_score:
        return "hero"
    if villain_score > hero_score:
        return "villain"
    return "tie"


def run_episode(
    rng: random.Random,
    agent: object | None = None,
) -> tuple[str | None, int]:
    """Play one episode to completion.

    Returns ``(winner, final_pot)`` where *winner* is ``"hero"``,
    ``"villain"``, ``"tie"``, or ``None`` when the episode ends
    without a resolution (e.g. step limit hit before showdown).
    """
    state = new_game(starting_stack=STARTING_STACK)
    winner: str | None = None

    for _ in range(MAX_STEPS):
        if state.street == "showdown":
            break

        player = state.to_act

        if agent is not None and player == "villain":
            action, amount = _agent_action(agent, state)
        else:
            action, amount = _random_action(state, rng)

        try:
            apply_action(state, player, action, amount)
        except ValueError:
            # Fallback: check (always valid unless at showdown)
            try:
                apply_action(state, player, "check", None)
            except ValueError:
                break

        last = state.betting_history[-1] if state.betting_history else {}
        if last.get("action") == "fold":
            folder = str(last.get("player", ""))
            winner = "villain" if folder == "hero" else "hero"
            break

    if winner is None and state.street == "showdown":
        winner = _determine_winner(state)

    return winner, state.pot


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Heads-up poker self-play simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-n",
        "--episodes",
        type=int,
        default=1000,
        metavar="N",
        help="Number of episodes to simulate (default: 1 000)",
    )
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=None,
        metavar="PATH",
        help="Path to a BotAgent checkpoint; villain uses the agent when set",
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
    rng = random.Random(args.seed)

    agent = None
    if args.checkpoint:
        ckpt = Path(args.checkpoint)
        if not ckpt.exists():
            sys.exit(f"error: checkpoint not found: {ckpt}")
        try:
            from engine.poker.ml.agent import BotAgent
            agent = BotAgent(str(ckpt))
            print(f"Loaded agent from {ckpt}")
        except Exception as exc:
            sys.exit(f"error: failed to load checkpoint — {exc}")

    hero_wins = 0
    villain_wins = 0
    ties = 0
    unresolved = 0
    total_pot = 0

    for i in range(1, args.episodes + 1):
        winner, pot = run_episode(rng, agent)
        total_pot += pot
        if winner == "hero":
            hero_wins += 1
        elif winner == "villain":
            villain_wins += 1
        elif winner == "tie":
            ties += 1
        else:
            unresolved += 1

        if i % max(1, args.episodes // 10) == 0:
            print(f"  {i:>6} / {args.episodes} episodes simulated …")

    n = args.episodes
    print()
    print(f"=== Results over {n:,} episodes ===")
    print(f"  Hero wins   : {hero_wins:>6}  ({hero_wins / n * 100:.1f}%)")
    print(f"  Villain wins: {villain_wins:>6}  ({villain_wins / n * 100:.1f}%)")
    print(f"  Ties        : {ties:>6}  ({ties / n * 100:.1f}%)")
    if unresolved:
        print(f"  Unresolved  : {unresolved:>6}  ({unresolved / n * 100:.1f}%)")
    print(f"  Avg pot     : {total_pot / n:.1f} chips")


if __name__ == "__main__":
    main()

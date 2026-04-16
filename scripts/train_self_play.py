#!/usr/bin/env python3
"""
PPO self-play training loop for the PPE heads-up poker bot.

Both players use the current policy weights so the agent learns entirely
through self-play.  Training follows the PPO-clip objective with
Generalised Advantage Estimation (GAE).

Hyper-parameters
----------------
  gamma        = 0.99   discount factor
  lambda       = 0.95   GAE lambda
  clip_eps     = 0.2    PPO clip ratio
  entropy_coef = 0.01   entropy bonus coefficient
  value_coef   = 0.5    value loss coefficient
  lr           = 3e-4   Adam learning rate
  ppo_epochs   = 4      update passes per batch
  batch_size   = 512    minimum trajectory steps before updating

Logging is emitted every 100 episodes; checkpoints are saved to
``scripts/checkpoints/`` every 1 000 episodes.
"""

from __future__ import annotations

import logging
import shutil
import sys
from pathlib import Path
from typing import NamedTuple

import torch
import torch.nn.functional as F
import torch.optim as optim

# Allow running as a top-level script without installing the package.
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from engine.poker import new_game, apply_action, legal_actions
from engine.poker.evaluator import evaluate_hand
from engine.poker.ml.model import PPEActorCritic
from engine.poker.ml.state_encoder import GameStateEncoder
from engine.poker.state import GameState, Player

# ── Hyper-parameters ──────────────────────────────────────────────────────────

STARTING_STACK: int = 1000
N_EPISODES: int = 50_000
BATCH_SIZE: int = 512
PPO_EPOCHS: int = 4
CLIP_EPS: float = 0.2
ENTROPY_COEF: float = 0.01
VALUE_COEF: float = 0.5
GAMMA: float = 0.99
GAE_LAMBDA: float = 0.95
LR: float = 3e-4
MAX_STEPS_PER_EPISODE: int = 100
LOG_INTERVAL: int = 100
CHECKPOINT_INTERVAL: int = 1000
# Reduce equity simulations during training to keep wall-clock time reasonable.
TRAIN_EQUITY_SIMS: int = 50

CHECKPOINT_DIR: Path = Path(__file__).parent / "checkpoints"

# ── Data structures ───────────────────────────────────────────────────────────


class StepData(NamedTuple):
    """Single transition from hero's perspective."""

    state: list[float]
    action: int
    log_prob: float
    value: float
    reward: float
    done: bool
    mask: list[bool]


# ── Action helpers ────────────────────────────────────────────────────────────


def build_action_mask(state: GameState) -> list[bool]:
    """
    Compute the 5-element boolean validity mask for the current state.

    Actions that would require more chips than the hero possesses are
    masked to ``False``.
    """
    eng_legal = set(legal_actions(state))
    hero_stack = state.stacks.get("hero", 0)
    pot = max(state.pot, 1)

    mask: list[bool] = [
        "fold" in eng_legal,
        bool(eng_legal),
        "raise" in eng_legal and hero_stack >= max(int(0.5 * pot), 1),
        "raise" in eng_legal and hero_stack >= pot,
        "raise" in eng_legal and hero_stack > 0,
    ]
    if not any(mask):
        mask[1] = True
    return mask


def decode_action(action_idx: int, state: GameState) -> tuple[str, int | None]:
    """
    Translate a model action index into an engine-compatible (action, amount).

    Args:
        action_idx: Integer in [0, 4].
        state: Current game state used to compute raise amounts.

    Returns:
        ``(action_str, amount_or_none)``
    """
    pot = state.pot
    hero_stack = state.stacks.get("hero", 0)

    if action_idx == 0:
        return "fold", None
    if action_idx == 1:
        last_raise = _last_raise_amount(state)
        return ("call", None) if last_raise > 0 else ("check", None)
    if action_idx == 2:
        amount = max(int(0.5 * pot), 1)
        return "raise", min(amount, hero_stack)
    if action_idx == 3:
        return "raise", min(pot, hero_stack)
    # action_idx == 4: all-in
    return "raise", hero_stack


def _last_raise_amount(state: GameState) -> int:
    """Return the most recent raise amount from betting history, or 0."""
    for record in reversed(state.betting_history):
        if record.get("action") == "raise":
            amount = record.get("amount", 0)
            if isinstance(amount, int):
                return amount
    return 0


# ── Winner determination ──────────────────────────────────────────────────────


def determine_winner(state: GameState) -> Player | None:
    """
    Identify the winner at showdown by comparing best 5-card hands.

    Returns ``None`` when hands cannot be evaluated (too few board cards)
    or when the result is a tie.
    """
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
    return None  # tie


# ── Episode runner ────────────────────────────────────────────────────────────


def run_episode(
    model: PPEActorCritic,
    encoder: GameStateEncoder,
    starting_stack: int = STARTING_STACK,
) -> tuple[list[StepData], float]:
    """
    Play one heads-up episode and collect hero's trajectory.

    Both players draw actions from *model*.  Only hero's transitions are
    recorded; the terminal reward is assigned to hero's final step.

    Args:
        model: Current policy/value network (in eval mode for rollout).
        encoder: State encoder (equity simulations reduced for speed).
        starting_stack: Starting chip count for both players.

    Returns:
        ``(trajectory, terminal_reward)`` where *terminal_reward* is
        positive when hero wins and negative when hero loses.
    """
    game_state = new_game(starting_stack=starting_stack)
    trajectory: list[StepData] = []
    terminal_reward = 0.0
    winner: Player | None = None

    for _ in range(MAX_STEPS_PER_EPISODE):
        if game_state.street == "showdown":
            break

        player: Player = game_state.to_act
        is_dealer = player == "hero"

        state_vec = encoder.encode(
            game_state,
            starting_stack=starting_stack,
            is_dealer=is_dealer,
            equity_simulations=TRAIN_EQUITY_SIMS,
        )
        x = torch.tensor(state_vec, dtype=torch.float32).unsqueeze(0)

        mask = build_action_mask(game_state)
        mask_tensor = torch.tensor([mask], dtype=torch.bool)

        with torch.no_grad():
            probs, value = model(x, action_mask=mask_tensor)

        dist = torch.distributions.Categorical(probs)
        action_tensor = dist.sample()
        log_prob = float(dist.log_prob(action_tensor).item())
        action_idx = int(action_tensor.item())
        value_float = float(value.item())

        if player == "hero":
            trajectory.append(
                StepData(
                    state=state_vec,
                    action=action_idx,
                    log_prob=log_prob,
                    value=value_float,
                    reward=0.0,
                    done=False,
                    mask=mask,
                )
            )

        action_str, amount = decode_action(action_idx, game_state)
        apply_action(game_state, player, action_str, amount)

        # Detect fold: the folder's record is the last entry added.
        last = game_state.betting_history[-1] if game_state.betting_history else {}
        if last.get("action") == "fold":
            folder = str(last.get("player", ""))
            winner = "villain" if folder == "hero" else "hero"
            break

    # ── Terminal reward ────────────────────────────────────────────────────
    if winner is None and game_state.street == "showdown":
        winner = determine_winner(game_state)

    pot_norm = game_state.pot / max(starting_stack, 1)
    if winner == "hero":
        terminal_reward = pot_norm
    elif winner == "villain":
        terminal_reward = -pot_norm
    else:
        terminal_reward = 0.0

    # Assign terminal reward and done flag to the last hero step.
    if trajectory:
        last_step = trajectory[-1]
        trajectory[-1] = StepData(
            state=last_step.state,
            action=last_step.action,
            log_prob=last_step.log_prob,
            value=last_step.value,
            reward=terminal_reward,
            done=True,
            mask=last_step.mask,
        )

    return trajectory, terminal_reward


# ── GAE ───────────────────────────────────────────────────────────────────────


def compute_gae(
    rewards: list[float],
    values: list[float],
    dones: list[bool],
    gamma: float = GAMMA,
    lam: float = GAE_LAMBDA,
) -> tuple[list[float], list[float]]:
    """
    Compute Generalised Advantage Estimation (GAE-λ).

    Args:
        rewards: Per-step reward signal.
        values: Baseline value estimates V(s_t).
        dones: Terminal flags; ``True`` resets the bootstrap value.
        gamma: Discount factor.
        lam: GAE smoothing parameter λ.

    Returns:
        ``(advantages, returns)`` where *returns* = advantages + values.
    """
    advantages: list[float] = []
    gae = 0.0
    next_value = 0.0

    for reward, value, done in zip(
        reversed(rewards), reversed(values), reversed(dones)
    ):
        if done:
            gae = 0.0
            next_value = 0.0
        delta = reward + gamma * next_value - value
        gae = delta + gamma * lam * gae
        advantages.insert(0, gae)
        next_value = value

    returns = [adv + val for adv, val in zip(advantages, values)]
    return advantages, returns


# ── PPO update ────────────────────────────────────────────────────────────────


def ppo_update(
    model: PPEActorCritic,
    optimizer: torch.optim.Optimizer,
    batch: list[StepData],
    advantages: list[float],
    returns: list[float],
) -> tuple[float, float, float]:
    """
    Run PPO-clip updates over the collected batch.

    Args:
        model: Actor-critic network (training mode).
        optimizer: Adam optimiser bound to *model*.
        batch: Collected transitions.
        advantages: GAE advantage estimates aligned with *batch*.
        returns: GAE return targets aligned with *batch*.

    Returns:
        ``(mean_policy_loss, mean_value_loss, mean_entropy)`` averaged
        across all PPO epochs.
    """
    states = torch.tensor([s.state for s in batch], dtype=torch.float32)
    actions = torch.tensor([s.action for s in batch], dtype=torch.long)
    old_log_probs = torch.tensor([s.log_prob for s in batch], dtype=torch.float32)
    masks = torch.tensor([s.mask for s in batch], dtype=torch.bool)
    adv_t = torch.tensor(advantages, dtype=torch.float32)
    ret_t = torch.tensor(returns, dtype=torch.float32)

    # Normalise advantages for training stability.
    adv_t = (adv_t - adv_t.mean()) / (adv_t.std() + 1e-8)

    total_p_loss = 0.0
    total_v_loss = 0.0
    total_entropy = 0.0

    for _ in range(PPO_EPOCHS):
        probs, values = model(states, action_mask=masks)
        dist = torch.distributions.Categorical(probs)
        new_log_probs = dist.log_prob(actions)
        entropy = dist.entropy().mean()

        ratio = (new_log_probs - old_log_probs).exp()
        clipped = ratio.clamp(1.0 - CLIP_EPS, 1.0 + CLIP_EPS)
        policy_loss = -torch.min(ratio * adv_t, clipped * adv_t).mean()

        value_loss = F.mse_loss(values.squeeze(-1), ret_t)

        loss = policy_loss + VALUE_COEF * value_loss - ENTROPY_COEF * entropy

        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=0.5)
        optimizer.step()

        total_p_loss += float(policy_loss.item())
        total_v_loss += float(value_loss.item())
        total_entropy += float(entropy.item())

    return (
        total_p_loss / PPO_EPOCHS,
        total_v_loss / PPO_EPOCHS,
        total_entropy / PPO_EPOCHS,
    )


# ── Main training loop ────────────────────────────────────────────────────────


def train(n_episodes: int = N_EPISODES) -> None:
    """
    Run the self-play PPO training loop.

    Trajectories are accumulated until at least ``BATCH_SIZE`` hero steps
    have been collected, then a PPO update is performed.  Metrics are
    logged every ``LOG_INTERVAL`` episodes and checkpoints are saved to
    ``CHECKPOINT_DIR`` every ``CHECKPOINT_INTERVAL`` episodes.

    Args:
        n_episodes: Total number of self-play episodes to run.
    """
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    log = logging.getLogger(__name__)

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    model = PPEActorCritic()
    model.train()
    optimizer = optim.Adam(model.parameters(), lr=LR)
    encoder = GameStateEncoder()

    episode_rewards: list[float] = []
    batch: list[StepData] = []
    last_p_loss = 0.0
    last_v_loss = 0.0
    last_entropy = 0.0

    for episode in range(1, n_episodes + 1):
        model.eval()
        trajectory, reward = run_episode(model, encoder)
        episode_rewards.append(reward)
        batch.extend(trajectory)

        # Run a PPO update once enough steps have been collected.
        if len(batch) >= BATCH_SIZE:
            model.train()
            rewards_list = [s.reward for s in batch]
            values_list = [s.value for s in batch]
            dones_list = [s.done for s in batch]

            advantages, returns = compute_gae(rewards_list, values_list, dones_list)
            last_p_loss, last_v_loss, last_entropy = ppo_update(
                model, optimizer, batch, advantages, returns
            )
            batch.clear()

        if episode % LOG_INTERVAL == 0:
            window = episode_rewards[-LOG_INTERVAL:]
            mean_reward = sum(window) / len(window)
            log.info(
                "episode=%6d  mean_reward=%+.4f  entropy=%.4f  value_loss=%.4f",
                episode,
                mean_reward,
                last_entropy,
                last_v_loss,
            )

        if episode % CHECKPOINT_INTERVAL == 0:
            ckpt_path = CHECKPOINT_DIR / f"checkpoint_{episode:06d}.pt"
            torch.save(
                {
                    "episode": episode,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                },
                ckpt_path,
            )
            latest_path = CHECKPOINT_DIR / "checkpoint_latest.pt"
            shutil.copy2(ckpt_path, latest_path)
            log.info("checkpoint saved → %s", ckpt_path)

    log.info("training complete (%d episodes)", n_episodes)


if __name__ == "__main__":
    train()

import { useState } from 'react';
import type { ProfileStats } from '../profile/aggregate';
import type { CoachCard } from '../profile/coach';
import type { Mode, PersonaKey } from './gameMachine';
import './CoachFeed.css';

export interface CoachFeedProps {
  stats: ProfileStats;
  coach: CoachCard;
  persistent: boolean;
  onPlay: (mode: Mode, personaKey: PersonaKey) => void;
  onDrill: (leakKey: string, personaKey: PersonaKey) => void;
  onReport: () => void;
  onOpenHand: (handId: number) => void;
}

const PERSONAS: { key: PersonaKey; label: string }[] = [
  { key: 'nit', label: 'The Nit' },
  { key: 'maniac', label: 'The Maniac' },
  { key: 'station', label: 'The Calling Station' },
  { key: 'balanced', label: 'The Balanced Player' },
];

function CoachHeadline({
  coach,
  personaKey,
  onDrill,
  onOpenHand,
  handsGraded,
}: {
  coach: CoachCard;
  personaKey: PersonaKey;
  onDrill: (leakKey: string, personaKey: PersonaKey) => void;
  onOpenHand: (handId: number) => void;
  handsGraded: number;
}) {
  if (coach.leak) {
    const leak = coach.leak;
    return (
      <div className="coach-card">
        <h2 className="coach-card-heading">Your biggest leak</h2>
        <p className="coach-leak-label">{leak.label}</p>
        <p className="coach-leak-evidence">
          {Math.round(leak.evLost)} chips lost (est.) over {leak.mistakes} mistakes
        </p>
        {leak.handIds.length > 0 && (
          <div className="coach-hand-links">
            {leak.handIds.slice(0, 3).map((id) => (
              <button
                key={id}
                type="button"
                className="coach-hand-btn"
                onClick={() => onOpenHand(id)}
              >
                Hand #{id}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="btn btn-gold coach-drill-btn"
          onClick={() => onDrill(leak.key, personaKey)}
        >
          Drill This Spot
        </button>
      </div>
    );
  }

  if (handsGraded > 0) {
    return (
      <div className="coach-card">
        <p className="coach-positive-copy">
          No leaks big enough to name yet — keep playing to sharpen the picture.
        </p>
      </div>
    );
  }

  return (
    <div className="coach-card">
      <p className="coach-welcome-copy">
        Welcome to the tables — play your first session and the coach will start tracking your
        game.
      </p>
    </div>
  );
}

export function CoachFeed({
  stats,
  coach,
  persistent,
  onPlay,
  onDrill,
  onReport,
  onOpenHand,
}: CoachFeedProps) {
  const [mode, setMode] = useState<Mode>('training');
  const [personaKey, setPersonaKey] = useState<PersonaKey>('balanced');

  return (
    <div className="coach-feed">
      <header className="coach-feed-header">
        <h1 className="coach-feed-title">
          Probabilistic Poker Engine <span className="coach-feed-flourish">Midnight Casino</span>
        </h1>
        <button type="button" className="btn btn-gold" onClick={onReport}>
          Report Card
        </button>
      </header>

      {!persistent && (
        <p className="coach-storage-warning" role="alert">
          Progress isn't being saved — IndexedDB is unavailable in this browser.
        </p>
      )}

      <CoachHeadline
        coach={coach}
        personaKey={personaKey}
        onDrill={onDrill}
        onOpenHand={onOpenHand}
        handsGraded={stats.handsGraded}
      />

      {coach.queue.length > 0 && (
        <section className="coach-section">
          <h2 className="coach-section-title">Next focus</h2>
          <ul className="coach-queue-list">
            {coach.queue.map((leak) => (
              <li key={leak.key}>{leak.label}</li>
            ))}
          </ul>
        </section>
      )}

      {coach.graduated.length > 0 && (
        <section className="coach-section">
          <h2 className="coach-section-title">Graduated</h2>
          <ul className="coach-graduated-list">
            {coach.graduated.map((g) => (
              <li key={g.key}>
                {g.label} — graduated at {Math.round(g.accuracy * 100)}% over {g.decisions}{' '}
                decisions
              </li>
            ))}
          </ul>
        </section>
      )}

      {coach.streak >= 3 && (
        <p className="coach-streak">{coach.streak}-decision clean-decision streak</p>
      )}

      <section className="coach-play-controls">
        <div className="coach-mode-toggle" role="radiogroup" aria-label="mode">
          <label className="coach-radio">
            <input
              type="radio"
              name="coach-mode"
              value="training"
              checked={mode === 'training'}
              onChange={() => setMode('training')}
            />
            Training
          </label>
          <label className="coach-radio">
            <input
              type="radio"
              name="coach-mode"
              value="match"
              checked={mode === 'match'}
              onChange={() => setMode('match')}
            />
            Match
          </label>
        </div>

        <label className="coach-persona-select">
          Persona
          <select
            value={personaKey}
            onChange={(e) => setPersonaKey(e.target.value as PersonaKey)}
          >
            {PERSONAS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btn-gold coach-deal-btn"
          onClick={() => onPlay(mode, personaKey)}
        >
          Deal In
        </button>
      </section>
    </div>
  );
}

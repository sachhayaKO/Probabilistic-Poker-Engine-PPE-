import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ProfileStats } from '../profile/aggregate';
import type { CoachCard } from '../profile/coach';
import type { Mode, PersonaKey } from './gameMachine';
import { SuitPip } from './SuitPip';
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

const PERSONAS: { key: PersonaKey; label: string; blurb: string }[] = [
  { key: 'nit', label: 'The Nit', blurb: 'Tight, cautious, folds too much' },
  { key: 'maniac', label: 'The Maniac', blurb: 'Raises everything, relentless' },
  { key: 'station', label: 'The Calling Station', blurb: 'Never folds, never raises' },
  { key: 'balanced', label: 'The Balanced Player', blurb: 'Solid, hard to exploit' },
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
      <div className="coach-card coach-card-leak">
        <div className="coach-card-inlay" aria-hidden="true" />
        <h2 className="coach-card-heading">
          <SuitPip suit="spade" className="coach-heading-pip" />
          Your biggest leak
        </h2>
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
        <div className="coach-card-inlay" aria-hidden="true" />
        <p className="coach-positive-copy">
          No leaks big enough to name yet — keep playing to sharpen the picture.
        </p>
      </div>
    );
  }

  return (
    <div className="coach-card coach-card-welcome">
      <div className="coach-card-inlay" aria-hidden="true" />
      <div className="coach-welcome-fan" aria-hidden="true">
        <span className="coach-fan-card coach-fan-left">
          <SuitPip suit="heart" className="coach-fan-pip coach-fan-pip-red" />
        </span>
        <span className="coach-fan-card coach-fan-mid">
          <SuitPip suit="spade" className="coach-fan-pip" />
        </span>
        <span className="coach-fan-card coach-fan-right">
          <SuitPip suit="diamond" className="coach-fan-pip coach-fan-pip-red" />
        </span>
      </div>
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
  const persona = PERSONAS.find((p) => p.key === personaKey) ?? PERSONAS[3];

  return (
    <div className="coach-feed">
      <div className="coach-feed-inner">
      <header className="coach-feed-header coach-enter" style={{ '--stagger': 0 } as CSSProperties}>
        <h1 className="coach-feed-title">
          <span className="coach-title-pips" aria-hidden="true">
            <SuitPip suit="spade" className="coach-title-pip" />
            <SuitPip suit="heart" className="coach-title-pip coach-title-pip-red" />
          </span>
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

      {stats.handsGraded > 0 && (
        <dl className="coach-stat-strip coach-enter" style={{ '--stagger': 1 } as CSSProperties}>
          <div className="coach-stat">
            <dt>Hands graded</dt>
            <dd>{stats.handsGraded}</dd>
          </div>
          <div className="coach-stat">
            <dt>Decision accuracy</dt>
            <dd>{Math.round(stats.accuracy * 100)}%</dd>
          </div>
          <div className="coach-stat">
            <dt>bb / 100</dt>
            <dd>{stats.bb100 >= 0 ? '+' : ''}{stats.bb100.toFixed(1)}</dd>
          </div>
        </dl>
      )}

      <div className="coach-enter" style={{ '--stagger': 2 } as CSSProperties}>
        <CoachHeadline
          coach={coach}
          personaKey={personaKey}
          onDrill={onDrill}
          onOpenHand={onOpenHand}
          handsGraded={stats.handsGraded}
        />
      </div>

      {coach.queue.length > 0 && (
        <section className="coach-section coach-enter" style={{ '--stagger': 3 } as CSSProperties}>
          <h2 className="coach-section-title">Next focus</h2>
          <ul className="coach-queue-list">
            {coach.queue.map((leak) => (
              <li key={leak.key}>{leak.label}</li>
            ))}
          </ul>
        </section>
      )}

      {coach.graduated.length > 0 && (
        <section className="coach-section coach-enter" style={{ '--stagger': 4 } as CSSProperties}>
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
        <p className="coach-streak coach-enter" style={{ '--stagger': 5 } as CSSProperties}>
          <SuitPip suit="club" className="coach-streak-pip" />
          {coach.streak}-decision clean-decision streak
        </p>
      )}

      <section className="coach-play-controls coach-enter" style={{ '--stagger': 6 } as CSSProperties}>
        <div className="coach-controls-row">
          <div className="coach-mode-toggle" role="radiogroup" aria-label="mode">
            <label className={`coach-radio${mode === 'training' ? ' coach-radio-active' : ''}`}>
              <input
                type="radio"
                name="coach-mode"
                value="training"
                checked={mode === 'training'}
                onChange={() => setMode('training')}
              />
              Training
            </label>
            <label className={`coach-radio${mode === 'match' ? ' coach-radio-active' : ''}`}>
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
        </div>

        <p className="coach-persona-blurb">{persona.blurb}</p>

        <button
          type="button"
          className="btn btn-gold coach-deal-btn"
          onClick={() => onPlay(mode, personaKey)}
        >
          <SuitPip suit="diamond" className="coach-deal-pip" />
          Deal In
        </button>
      </section>
      </div>
    </div>
  );
}

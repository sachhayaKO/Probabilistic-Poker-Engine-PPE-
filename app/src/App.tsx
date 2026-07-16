import { useEffect, useMemo, useRef, useState } from 'react';
import { PERSONAS } from './personas/persona';
import type { Mode, PersonaKey } from './ui/gameMachine';
import { BIG_BLIND } from './ui/gameMachine';
import { ActionBar } from './ui/ActionBar';
import { Ribbon } from './ui/Ribbon';
import { ReplayTheater } from './ui/ReplayTheater';
import { Table } from './ui/Table';
import { emptyStats, accumulate } from './ui/stats';
import type { SessionStats } from './ui/stats';
import * as sound from './ui/sound';
import { useGame } from './ui/useGame';
import { GradeClient } from './worker/gradeClient';
import './App.css';

const MODES: { key: Mode; label: string; blurb: string }[] = [
  { key: 'training', label: 'Training', blurb: 'Stacks reset to 100BB every hand' },
  { key: 'match', label: 'Match', blurb: 'Persistent stacks — play to the felt' },
];

const PERSONA_BLURBS: Record<PersonaKey, string> = {
  nit: 'Plays only premium hands and folds the moment things get expensive.',
  maniac: 'Raises early, raises often, and dares you to believe him.',
  station: 'Calls with almost anything and almost never lets go.',
  balanced: 'Mixes it up with sound fundamentals and few leaks.',
};

const PERSONA_ORDER: PersonaKey[] = ['nit', 'maniac', 'station', 'balanced'];

function MenuScreen({ onStart }: { onStart: (mode: Mode, personaKey: PersonaKey) => void }) {
  const [mode, setMode] = useState<Mode>('training');
  const [personaKey, setPersonaKey] = useState<PersonaKey>('balanced');

  return (
    <div className="menu-screen">
      <div className="menu-vignette" />
      <div className="menu-content">
        <h1 className="menu-title">Probabilistic Poker Engine</h1>
        <p className="menu-subtitle">Midnight Casino</p>

        <div className="menu-section">
          <h2 className="menu-section-title">Mode</h2>
          <div className="menu-cards menu-modes">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`menu-card${mode === m.key ? ' menu-card-selected' : ''}`}
                onClick={() => setMode(m.key)}
              >
                <span className="menu-card-title">{m.label}</span>
                <span className="menu-card-blurb">{m.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="menu-section">
          <h2 className="menu-section-title">Opponent</h2>
          <div className="menu-cards menu-personas">
            {PERSONA_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                className={`menu-card${personaKey === key ? ' menu-card-selected' : ''}`}
                onClick={() => setPersonaKey(key)}
              >
                <span className="menu-card-title">{PERSONAS[key].name}</span>
                <span className="menu-card-blurb">{PERSONA_BLURBS[key]}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-gold menu-deal-btn"
          onClick={() => onStart(mode, personaKey)}
        >
          Deal me in
        </button>
      </div>
    </div>
  );
}

function GameScreen({
  game, stats, onLeave,
}: {
  game: ReturnType<typeof useGame>;
  stats: SessionStats;
  onLeave: () => void;
}) {
  const { session, hand, phase, grades, gradesFailed } = game;
  const [soundOn, setSoundOn] = useState(true);
  const [theaterOpen, setTheaterOpen] = useState(false);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    sound.setSoundEnabled(next);
  };

  const openTheater = () => setTheaterOpen(true);
  const closeTheater = () => setTheaterOpen(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't' && phase === 'over' && grades) {
        openTheater();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, grades]);

  // Sound stings when a hand transitions to 'over'.
  const stungHandNumber = useRef<number | null>(null);
  useEffect(() => {
    if (phase === 'over' && hand?.result && session && stungHandNumber.current !== session.handNumber) {
      stungHandNumber.current = session.handNumber;
      const { winner, potAwarded } = hand.result;
      if (winner === 0) sound.potWin();
      if (potAwarded >= 40 * BIG_BLIND) sound.bigPotSting();
    }
  }, [phase, hand, session]);

  const personaName = session ? PERSONAS[session.personaKey].name : '';
  const matchOver = session?.matchOver ?? false;

  return (
    <div className="game-screen">
      <header className="game-header">
        <div className="game-header-left">
          <span className="game-header-persona">{personaName}</span>
          <span className="game-header-mode">{session?.mode === 'match' ? 'Match' : 'Training'}</span>
          <span className="game-header-hand">Hand #{session?.handNumber ?? 0}</span>
        </div>
        <div className="game-header-right">
          <span className="game-header-stack">
            You: {session ? (session.stacks[0] / BIG_BLIND).toFixed(1) : '0.0'} BB
          </span>
          <span className="game-header-stack">
            {personaName}: {session ? (session.stacks[1] / BIG_BLIND).toFixed(1) : '0.0'} BB
          </span>
          <button type="button" className="btn btn-icon" onClick={toggleSound} aria-label="toggle sound">
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onLeave}>
            Leave table
          </button>
        </div>
      </header>

      <div className="game-main">
        <div className="game-table-col">
          <Table game={game} />
          {!theaterOpen && <ActionBar game={game} />}
        </div>
        <Ribbon
          grades={grades}
          gradesFailed={gradesFailed}
          stats={stats}
          phase={phase}
          matchOver={matchOver}
          onOpenTheater={openTheater}
        />
      </div>

      {theaterOpen && hand?.result && grades && (
        <ReplayTheater hand={hand} grades={grades} personaName={personaName} onClose={closeTheater} />
      )}

      {matchOver && (
        <div className="match-over-scrim">
          <div className="match-over-panel">
            <h2 className="match-over-title">Match over</h2>
            <p className="match-over-result">
              {session && session.stacks[0] > session.stacks[1] ? 'You win' : `${personaName} wins`}
            </p>
            <button type="button" className="btn btn-gold" onClick={onLeave}>
              Back to menu
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function App() {
  const client = useMemo(() => new GradeClient(), []);
  const game = useGame(client);
  const [stats, setStats] = useState<SessionStats>(emptyStats());
  const counted = useRef(0);

  useEffect(() => {
    if (game.grades && game.session && counted.current !== game.session.handNumber) {
      counted.current = game.session.handNumber;
      setStats((s) => accumulate(s, game.grades!));
      if (game.grades.some((g) => g.grade.label === 'mistake')) sound.mistakeSting();
    }
  }, [game.grades, game.session]);

  const handleLeave = () => {
    window.location.reload();
  };

  if (game.phase === 'menu') {
    return <MenuScreen onStart={game.startSession} />;
  }

  return <GameScreen game={game} stats={stats} onLeave={handleLeave} />;
}

export default App;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
import type { Game } from './ui/useGame';
import { GradeClient } from './worker/gradeClient';
import { CoachFeed } from './ui/CoachFeed';
import { ReportCard } from './ui/ReportCard';
import { aggregate } from './profile/aggregate';
import { coachState, drillRecovered } from './profile/coach';
import type { ProfileStore } from './profile/db';
import { openProfileStore } from './profile/db';
import { generateDrill } from './profile/drills';
import type { HandRecord } from './profile/records';
import { buildHandRecord } from './profile/records';
import { leakLabel } from './profile/tags';
import './App.css';

type Screen = 'home' | 'report' | 'game';

function GameScreen({
  game, stats, records, onLeave, onDrill,
}: {
  game: Game;
  stats: SessionStats;
  records: HandRecord[];
  onLeave: () => void;
  onDrill: (leakKey: string, personaKey: PersonaKey) => void;
}) {
  const { session, hand, phase, grades, gradesFailed, drill } = game;
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

  const drillLabel = drill ? leakLabel(drill) : null;
  const handGraded = phase === 'over' && grades !== null && !gradesFailed;
  const recovered = drill && handGraded ? drillRecovered(records, drill) : false;

  const handleNextDrill = () => {
    if (drill && session) onDrill(drill, session.personaKey);
  };

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

      {drill && (
        <div className="drill-banner">
          <span className="drill-banner-label">Drilling: {drillLabel}</span>
          {handGraded && (
            recovered ? (
              <>
                <span className="drill-banner-status">Recovered — nice work.</span>
                <button type="button" className="btn btn-gold" onClick={onLeave}>
                  Back to coach
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={handleNextDrill}>
                Next drill
              </button>
            )
          )}
        </div>
      )}

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

  const [screen, setScreen] = useState<Screen>('home');
  const [store, setStore] = useState<ProfileStore | null>(null);
  const [records, setRecords] = useState<HandRecord[]>([]);
  const [drillNotice, setDrillNotice] = useState<string | null>(null);
  const [viewingHand, setViewingHand] = useState<HandRecord | null>(null);
  const persistedSeed = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);

  const refresh = useCallback(async (s: ProfileStore | null) => {
    if (!s) return;
    setRecords(await s.allHands());
  }, []);

  useEffect(() => {
    let alive = true;
    openProfileStore().then(async (s) => {
      if (!alive) return;
      setStore(s);
      await refresh(s);
    });
    return () => {
      alive = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (game.grades && game.session && counted.current !== game.session.handNumber) {
      counted.current = game.session.handNumber;
      setStats((s) => accumulate(s, game.grades!));
      if (game.grades.some((g) => g.grade.label === 'mistake')) sound.mistakeSting();
    }
  }, [game.grades, game.session]);

  // Persist every graded hand exactly once, keyed by the hand's deal seed.
  // Hands whose grading failed are never persisted.
  useEffect(() => {
    if (!store || !game.grades || !game.hand?.result || !game.session) return;
    const seed = game.hand.cfg.seed;
    if (persistedSeed.current === seed) return;
    persistedSeed.current = seed;
    const rec = buildHandRecord(
      game.hand,
      0,
      game.session.mode,
      game.session.personaKey,
      game.grades,
      game.drill,
    );
    store.addHand(rec).then(() => refresh(store));
  }, [store, game.grades, game.hand, game.session, game.drill, refresh]);

  const handleLeave = useCallback(() => {
    setScreen('home');
    void refresh(store);
  }, [refresh, store]);

  const handlePlay = useCallback(
    (mode: Mode, personaKey: PersonaKey) => {
      game.startSession(mode, personaKey);
      setScreen('game');
    },
    [game],
  );

  const handleDrill = useCallback(
    (key: string, personaKey: PersonaKey) => {
      const deal = generateDrill(key, personaKey, Date.now() >>> 0);
      if (!deal) {
        setDrillNotice("Couldn't deal that spot right now — try again.");
        if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setDrillNotice(null), 4000);
        return;
      }
      game.startDrill(personaKey, key, deal);
      setScreen('game');
    },
    [game],
  );

  const handleOpenHand = useCallback(
    (handId: number) => {
      setViewingHand(records.find((r) => r.id === handId) ?? null);
    },
    [records],
  );

  const profileStats = useMemo(() => aggregate(records), [records]);
  const coach = useMemo(() => coachState(profileStats, records), [profileStats, records]);

  let content: ReactNode;
  if (screen === 'home') {
    content = (
      <>
        <CoachFeed
          stats={profileStats}
          coach={coach}
          persistent={store ? store.persistent : true}
          onPlay={handlePlay}
          onDrill={handleDrill}
          onReport={() => setScreen('report')}
          onOpenHand={handleOpenHand}
        />
        {drillNotice && (
          <p className="app-drill-notice" role="alert">
            {drillNotice}
          </p>
        )}
      </>
    );
  } else if (screen === 'report') {
    content = (
      <ReportCard stats={profileStats} onBack={() => setScreen('home')} onOpenHand={handleOpenHand} />
    );
  } else {
    content = (
      <GameScreen game={game} stats={stats} records={records} onLeave={handleLeave} onDrill={handleDrill} />
    );
  }

  return (
    <>
      {content}
      {viewingHand && (
        <ReplayTheater
          hand={viewingHand.state}
          grades={viewingHand.grades}
          personaName={PERSONAS[viewingHand.personaKey].name}
          onClose={() => setViewingHand(null)}
        />
      )}
    </>
  );
}

export default App;

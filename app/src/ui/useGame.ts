import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card } from '../engine/cards';
import { mulberry32 } from '../engine/cards';
import type { Action, HandConfig, HandState, LegalActions } from '../engine/hand';
import { applyAction, legalActions, startHand } from '../engine/hand';
import { PERSONAS, personaAction } from '../personas/persona';
import type { GradedDecision } from '../grading/gradeHand';
import type { DrillDeal } from '../profile/drills';
import type { GradeClient } from '../worker/gradeClient';
import type { Mode, PersonaKey, Session } from './gameMachine';
import { HERO_SEAT, VILLAIN_SEAT, applyHandResult, dealHand, newSession } from './gameMachine';

export type Phase = 'menu' | 'hero' | 'villain' | 'runout' | 'over';

export interface Game {
  session: Session | null;
  hand: HandState | null;
  visibleBoard: Card[]; // paced board — lags hand.board during dramatic runouts
  phase: Phase;
  legal: LegalActions | null;
  grades: GradedDecision[] | null; // null while pending or unavailable
  gradesFailed: boolean;
  race: { hero: number; villain: number } | null; // live equity during runouts
  drill: string | null; // active drill leak key, null in normal play
  startSession: (mode: Mode, personaKey: PersonaKey) => void;
  startDrill: (personaKey: PersonaKey, key: string, deal: DrillDeal) => void;
  act: (a: Action) => void;
  nextHand: () => void;
}

export const VILLAIN_DELAY_MS = 750;
export const RUNOUT_STEP_MS = 1100;
export const DRILL_SCRIPT_STEP_MS = 350;
const GRADE_ITERATIONS = 800;
const RACE_ITERATIONS = 400;

export function useGame(client: GradeClient): Game {
  const [session, setSession] = useState<Session | null>(null);
  const [hand, setHand] = useState<HandState | null>(null);
  const [visibleBoard, setVisibleBoard] = useState<Card[]>([]);
  const [ended, setEnded] = useState<'runout' | 'over' | null>(null);
  const [grades, setGrades] = useState<GradedDecision[] | null>(null);
  const [gradesFailed, setGradesFailed] = useState(false);
  const [race, setRace] = useState<{ hero: number; villain: number } | null>(null);
  const [drill, setDrill] = useState<string | null>(null);
  const villainRng = useRef<() => number>(mulberry32(1));
  const timers = useRef<number[]>([]);
  const script = useRef<Action[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t));
    },
    [],
  );

  const phase: Phase = !hand
    ? 'menu'
    : hand.result
      ? (ended ?? 'over')
      : hand.toAct === HERO_SEAT
        ? 'hero'
        : 'villain';

  const legal = hand && !hand.result ? legalActions(hand) : null;

  const finishHand = useCallback(
    (finished: HandState, revealedBefore: number, sess: Session) => {
      setSession(applyHandResult(sess, finished.result!));
      client
        .gradeHand(finished, HERO_SEAT, PERSONAS[sess.personaKey], GRADE_ITERATIONS, finished.cfg.seed + 7)
        .then((g) => (g ? setGrades(g) : setGradesFailed(true)));

      const full = finished.board; // all 5 at showdown; partial after a fold
      if (finished.result!.showdown && revealedBefore < full.length) {
        // Dramatic all-in runout: reveal card by card with a live equity race.
        setEnded('runout');
        const hero = finished.holes[HERO_SEAT];
        const villain = finished.holes[VILLAIN_SEAT];
        const steps = full.length - revealedBefore;
        for (let i = 0; i <= steps; i++) {
          const k = revealedBefore + i;
          const t = window.setTimeout(() => {
            setVisibleBoard(full.slice(0, k));
            if (k < full.length) {
              client
                .equity(
                  hero,
                  full.slice(0, k),
                  [{ cards: [villain[0], villain[1]], weight: 1 }],
                  RACE_ITERATIONS,
                  finished.cfg.seed + 31 * (k + 1),
                )
                .then((e) => {
                  if (e !== null) setRace({ hero: e, villain: 1 - e });
                });
            } else {
              setEnded('over');
            }
          }, i * RUNOUT_STEP_MS);
          timers.current.push(t);
        }
      } else {
        setVisibleBoard(full);
        setEnded('over');
      }
    },
    [client],
  );

  const apply = useCallback(
    (a: Action) => {
      if (!hand || !session || hand.result) return;
      const revealedBefore = visibleBoard.length;
      const next = applyAction(hand, a);
      setHand(next);
      if (next.result) {
        finishHand(next, revealedBefore, session);
      } else {
        setVisibleBoard(next.board);
      }
    },
    [hand, session, visibleBoard, finishHand],
  );

  // The villain acts on a short dramatic delay whenever it is their turn.
  useEffect(() => {
    if (!hand || !session || hand.result || hand.toAct === HERO_SEAT) return;
    const t = window.setTimeout(() => {
      const a = personaAction(hand, VILLAIN_SEAT, PERSONAS[session.personaKey], villainRng.current);
      apply(a);
    }, VILLAIN_DELAY_MS);
    return () => clearTimeout(t);
  }, [hand, session, apply]);

  // Shared reset logic for a freshly dealt hand, used by both normal deals
  // and drills (which start from a caller-supplied HandConfig verbatim).
  const resetForHand = useCallback((sess: Session, cfg: HandConfig) => {
    villainRng.current = mulberry32((cfg.seed ^ 0x5bd1e995) >>> 0);
    setSession(sess);
    setHand(startHand(cfg));
    setVisibleBoard([]);
    setEnded(null);
    setRace(null);
    setGrades(null);
    setGradesFailed(false);
  }, []);

  const deal = useCallback(
    (sess: Session) => {
      const { session: s2, cfg } = dealHand(sess);
      resetForHand(s2, cfg);
      script.current = [];
      setDrill(null);
    },
    [resetForHand],
  );

  const startSession = useCallback(
    (mode: Mode, personaKey: PersonaKey) => {
      deal(newSession(mode, personaKey, Date.now() >>> 0));
    },
    [deal],
  );

  const startDrill = useCallback(
    (personaKey: PersonaKey, key: string, drillDeal: DrillDeal) => {
      const sess: Session = { ...newSession('training', personaKey, drillDeal.cfg.seed), handNumber: 1 };
      resetForHand(sess, drillDeal.cfg);
      script.current = [...drillDeal.heroScript];
      setDrill(key);
    },
    [resetForHand],
  );

  const nextHand = useCallback(() => {
    if (!session || phase !== 'over' || session.matchOver || drill) return;
    deal(session);
  }, [session, phase, deal, drill]);

  // Drill script auto-play: fast-forward the scripted hero actions on a
  // short delay, then hand control back once the script is exhausted.
  useEffect(() => {
    if (phase !== 'hero' || script.current.length === 0) return;
    const t = window.setTimeout(() => {
      const [a, ...rest] = script.current;
      script.current = rest;
      apply(a);
    }, DRILL_SCRIPT_STEP_MS);
    return () => clearTimeout(t);
  }, [hand, phase, apply]);

  const act = useCallback(
    (a: Action) => {
      if (phase === 'hero') apply(a);
    },
    [phase, apply],
  );

  return {
    session, hand, visibleBoard, phase, legal, grades, gradesFailed, race, drill,
    startSession, startDrill, act, nextHand,
  };
}

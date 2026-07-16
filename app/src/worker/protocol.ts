import type { Card } from '../engine/cards';
import type { HandState, Seat } from '../engine/hand';
import type { PersonaParams } from '../personas/persona';
import type { WeightedCombo } from '../personas/ranges';
import type { GradedDecision } from '../grading/gradeHand';

export interface GradeHandRequest {
  id: number;
  kind: 'gradeHand';
  state: HandState; // finished hand; plain data, structured-cloneable
  heroSeat: Seat;
  villain: PersonaParams;
  iterations: number;
  seed: number;
}

export interface EquityRequest {
  id: number;
  kind: 'equity';
  hero: [Card, Card];
  board: Card[];
  range: WeightedCombo[];
  iterations: number;
  seed: number;
}

export type WorkerRequest = GradeHandRequest | EquityRequest;

export type WorkerResponse =
  | { id: number; ok: true; kind: 'gradeHand'; result: GradedDecision[] }
  | { id: number; ok: true; kind: 'equity'; result: number }
  | { id: number; ok: false; error: string };

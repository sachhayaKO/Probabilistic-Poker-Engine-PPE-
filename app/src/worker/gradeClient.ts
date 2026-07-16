import type { Card } from '../engine/cards';
import type { HandState, Seat } from '../engine/hand';
import type { PersonaParams } from '../personas/persona';
import type { WeightedCombo } from '../personas/ranges';
import type { GradedDecision } from '../grading/gradeHand';
import type { WorkerRequest, WorkerResponse } from './protocol';

const TIMEOUT_MS = 5000;

// Wraps the grading Web Worker. Every failure path resolves to null so the UI
// degrades gracefully (hand playable ungraded) instead of blocking play.
export class GradeClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, (r: WorkerResponse | null) => void>();

  constructor() {
    if (typeof Worker === 'undefined') return; // e.g. test env: degraded mode
    try {
      this.worker = new Worker(new URL('./gradeWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const resolve = this.pending.get(e.data.id);
        if (resolve) {
          this.pending.delete(e.data.id);
          resolve(e.data);
        }
      };
      this.worker.onerror = () => this.failAll();
    } catch {
      this.worker = null;
    }
  }

  private failAll(): void {
    for (const resolve of this.pending.values()) resolve(null);
    this.pending.clear();
  }

  private send(req: WorkerRequest): Promise<WorkerResponse | null> {
    if (!this.worker) return Promise.resolve(null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(req.id);
        resolve(null);
      }, TIMEOUT_MS);
      this.pending.set(req.id, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
      this.worker!.postMessage(req);
    });
  }

  async gradeHand(
    state: HandState, heroSeat: Seat, villain: PersonaParams, iterations: number, seed: number,
  ): Promise<GradedDecision[] | null> {
    const r = await this.send({ id: this.nextId++, kind: 'gradeHand', state, heroSeat, villain, iterations, seed });
    return r && r.ok && r.kind === 'gradeHand' ? r.result : null;
  }

  async equity(
    hero: [Card, Card], board: Card[], range: WeightedCombo[], iterations: number, seed: number,
  ): Promise<number | null> {
    const r = await this.send({ id: this.nextId++, kind: 'equity', hero, board, range, iterations, seed });
    return r && r.ok && r.kind === 'equity' ? r.result : null;
  }
}

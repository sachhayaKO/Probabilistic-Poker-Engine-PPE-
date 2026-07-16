import { mulberry32 } from '../engine/cards';
import { equityVsRange } from '../grading/equity';
import { gradeHand } from '../grading/gradeHand';
import type { WorkerRequest, WorkerResponse } from './protocol';

export function handleRequest(req: WorkerRequest): WorkerResponse {
  try {
    const rng = mulberry32(req.seed);
    if (req.kind === 'gradeHand') {
      const result = gradeHand(req.state, req.heroSeat, req.villain, req.iterations, rng);
      return { id: req.id, ok: true, kind: 'gradeHand', result };
    }
    const result = equityVsRange(req.hero, req.board, req.range, req.iterations, rng);
    return { id: req.id, ok: true, kind: 'equity', result };
  } catch (err) {
    return { id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

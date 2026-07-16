import { handleRequest } from './handlers';
import type { WorkerRequest } from './protocol';

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (msg: unknown) => void;
};

ctx.onmessage = (e) => {
  ctx.postMessage(handleRequest(e.data));
};

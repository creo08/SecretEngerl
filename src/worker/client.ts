/** Page side of the losfee worker. */
import type { RoundConfig } from '../config/types.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, (response: WorkerResponse) => void>();

/** Sends a request to the worker, starting it on first use. */
export function askWorker(type: WorkerRequest['type'], config: RoundConfig): Promise<WorkerResponse> {
  if (!worker) {
    worker = new Worker(new URL('./losfee.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      pending.get(event.data.id)?.(event.data);
      pending.delete(event.data.id);
    };
  }
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ id, type, config } satisfies WorkerRequest);
  });
}

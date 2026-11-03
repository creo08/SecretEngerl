/** Page side of the losfee worker. */
import type { RoundConfig } from '../config/types.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();

/** Sends a request to the worker, starting it on first use. Rejects if the worker fails. */
export function askWorker(type: WorkerRequest['type'], config: RoundConfig): Promise<WorkerResponse> {
  if (!worker) {
    worker = new Worker(new URL('./losfee.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      pending.get(event.data.id)?.resolve(event.data);
      pending.delete(event.data.id);
    };
    worker.onerror = () => {
      // The worker state is unknown after an error: fail every waiting request and start fresh next time.
      for (const p of pending.values()) p.reject(new Error('worker failed'));
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ id, type, config } satisfies WorkerRequest);
  });
}

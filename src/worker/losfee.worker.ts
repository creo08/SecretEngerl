/** Web Worker entry: runs losfee off the main thread. */
import { createCryptoRng } from '../random/rng.ts';
import { handleRequest, type WorkerRequest, type WorkerResponse } from './protocol.ts';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};
const rng = createCryptoRng();

scope.onmessage = (event) => scope.postMessage(handleRequest(event.data, rng));

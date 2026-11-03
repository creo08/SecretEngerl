/** Messages between the page and the losfee worker, and the handler the worker runs. */
import type { RoundConfig } from '../config/types.ts';
import { validateConfig } from '../config/validate.ts';
import type { ValidationError } from '../input/validate.ts';
import { compileRound, draw, MAX_PEOPLE_FOR_COUNT, searchAssignments, type DrawResult } from '../losfee/index.ts';
import type { Rng } from '../random/rng.ts';

export type WorkerRequest = { id: number; type: 'draw' | 'count'; config: RoundConfig };

export type WorkerResponse =
  | { id: number; type: 'draw'; names: string[]; result: DrawResult }
  /** Number of possible draws, or null above MAX_PEOPLE_FOR_COUNT people or if counting took too long. */
  | { id: number; type: 'count'; count: number | null }
  | { id: number; type: 'invalid'; errors: ValidationError[] };

/** Handles one request. The configuration is validated again, as at every boundary. */
export function handleRequest(request: WorkerRequest, rng: Rng): WorkerResponse {
  const checked = validateConfig(request.config);
  if (!checked.ok) return { id: request.id, type: 'invalid', errors: checked.errors };
  const { names, problem } = compileRound(checked.value);
  if (request.type === 'draw') return { id: request.id, type: 'draw', names, result: draw(problem, rng) };
  if (names.length > MAX_PEOPLE_FOR_COUNT) return { id: request.id, type: 'count', count: null };
  const counted = searchAssignments(problem, { countAll: true, nodeLimit: 50_000_000 });
  return { id: request.id, type: 'count', count: counted.status === 'unknown' ? null : counted.count };
}

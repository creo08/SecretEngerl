import { describe, expect, it } from 'vitest';
import { handleRequest } from '../src/worker/protocol.ts';
import { CONCEPT_EXAMPLE, round } from './helpers/round.ts';
import { seededRng } from './helpers/seeded-rng.ts';

describe('worker protocol', () => {
  it('draws a validated configuration', () => {
    const response = handleRequest({ id: 1, type: 'draw', config: round(CONCEPT_EXAMPLE) }, seededRng(1));
    expect(response).toMatchObject({ id: 1, type: 'draw', result: { ok: true } });
  });

  it('counts possible draws up to 10 people only', () => {
    expect(handleRequest({ id: 2, type: 'count', config: round(CONCEPT_EXAMPLE) }, seededRng(1))).toEqual({ id: 2, type: 'count', count: 392_160 });
    const eleven = round([...CONCEPT_EXAMPLE, ['Karl']]);
    expect(handleRequest({ id: 3, type: 'count', config: eleven }, seededRng(1))).toEqual({ id: 3, type: 'count', count: null });
  });

  it('rejects an invalid configuration', () => {
    const bad = { ...round(CONCEPT_EXAMPLE), template: 'pyramid' } as never;
    expect(handleRequest({ id: 4, type: 'draw', config: bad }, seededRng(1))).toMatchObject({ id: 4, type: 'invalid' });
  });
});

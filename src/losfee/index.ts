/** Public interface of the matching engine `losfee`. No DOM; the RNG comes from outside. */
export type { DrawResult, Problem, RuleRef } from './types.ts';
export { compileRound, type CompiledRound } from './compile.ts';
export { draw, type DrawOptions } from './draw.ts';
export { findViolation } from './check.ts';
export { repairDropout, type DropoutRepair } from './dropout.ts';
export { searchAssignments } from './search.ts';
export { countHouseholdAssignments } from './households.ts';

/** Rounds up to this size get the number of possible draws counted by enumeration. */
export const MAX_PEOPLE_FOR_COUNT = 10;

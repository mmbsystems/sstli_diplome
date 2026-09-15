export type MutationFailure = 'unauthenticated' | 'unauthorized' | 'validation' | 'conflict' | 'not_found' | 'database' | 'configuration' | 'disabled';
export class MutationError extends Error {
  constructor(public readonly reason: MutationFailure) { super(reason); }
}
export const mutationStatus: Record<MutationFailure, number> = { unauthenticated: 401, unauthorized: 403, validation: 422, conflict: 409, not_found: 404, database: 500, configuration: 503, disabled: 503 };
export function throwDatabaseError(error: { code?: string } | null): void {
  if (!error) return;
  throw new MutationError(error.code === 'PT409' || error.code === '40001' || error.code === '23505' ? 'conflict' : error.code === 'P0002' ? 'not_found' : error.code === '22023' ? 'validation' : 'database');
}

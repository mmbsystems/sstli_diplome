import { MutationError } from './errors';
const invalid = (): never => { throw new MutationError('validation'); };
export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid();
}
export function text(value: unknown, min = 1, max = 160): string {
  if (typeof value !== 'string') return invalid();
  const result = value.trim();
  return result.length >= min && result.length <= max && !/[\u0000-\u001f\u007f]/.test(result) ? result : invalid();
}
export function uuid(value: unknown): string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : invalid();
}
export function expectedVersion(value: unknown, minimum = 1): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value < Number.MAX_SAFE_INTEGER ? value : invalid();
}
export function price(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 9999999999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001 ? value : invalid();
}
export function bool(value: unknown): boolean { return typeof value === 'boolean' ? value : invalid(); }
export function enumeration<const T extends string>(value: unknown, values: readonly T[]): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : invalid();
}
export function parseProbeInput(value: unknown) {
  const input = object(value);
  if (Object.keys(input).some(key => !['id', 'action', 'expectedVersion', 'value'].includes(key))) return invalid();
  const action = enumeration(input.action, ['create', 'update', 'delete']);
  const version = expectedVersion(input.expectedVersion, action === 'create' ? 0 : 1);
  if (action === 'create' && version !== 0 || action === 'delete' && input.value !== undefined) return invalid();
  return { id: uuid(input.id), action, expectedVersion: version, value: action === 'delete' ? null : text(input.value) };
}

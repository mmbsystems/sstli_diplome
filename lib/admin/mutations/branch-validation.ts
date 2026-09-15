import { MutationError } from './errors';
import { object, uuid, expectedVersion, bool, enumeration } from './validation';
const invalid = (): never => { throw new MutationError('validation'); };
// Validate without trimming or normalizing historical display labels.
function label(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /[\u0000-\u001f\u007f]/.test(value)) return invalid();
  return value;
}
export function parseBranchInput(value: unknown) {
  const input = object(value);
  if (Object.keys(input).some(k => !['id', 'action', 'expectedVersion', 'branch'].includes(k))) return invalid();
  const action = enumeration(input.action, ['save', 'archive', 'restore']);
  const id = input.id === undefined ? null : uuid(input.id);
  const version = expectedVersion(input.expectedVersion, id ? 1 : 0);
  if (version >= Number.MAX_SAFE_INTEGER - 1 || (!id && (version !== 0 || action !== 'save'))) return invalid();
  const b = object(input.branch);
  if (Object.keys(b).some(k => !['name', 'city', 'source_region_label', 'address', 'directory_listed', 'is_active'].includes(k))) return invalid();
  const optional = (key: string, max: number) => b[key] == null ? null : label(b[key], max);
  return { id, action, expectedVersion: version, branch: {
    name: label(b.name, 300, true), city: label(b.city, 300, true),
    source_region_label: optional('source_region_label', 300), address: optional('address', 2000),
    directory_listed: bool(b.directory_listed), is_active: bool(b.is_active),
  } };
}

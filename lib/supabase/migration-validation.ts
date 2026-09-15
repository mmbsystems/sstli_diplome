import type { Offering, Program } from '@/types/program';

export const branchLegacyKey = (city = '', branch = '') => `${city}::${branch}`;
/** Stable context fingerprint; preserve a frozen context -> UUID manifest at import.
 * JSON tuple encoding avoids delimiter collisions. Neither price nor off-N is identity.
 */
export const offeringIdentity = (o: Offering) => JSON.stringify([o.programId, o.city ?? '', o.branch ?? '', o.studyMode, o.gender ?? 'both']);

export function validateCatalogSource(programs: Program[], offerings: Offering[], directory: Record<string, readonly string[]>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const declared = new Set(Object.entries(directory).flatMap(([city, names]) => names.map(name => branchLegacyKey(city, name))));
  const used = new Set(offerings.map(o => branchLegacyKey(o.city, o.branch)));
  const unresolvedBranches = [...used].filter(key => !declared.has(key));
  const ids = new Set<string>(); const slugs = new Set<string>();
  for (const p of programs) {
    if (ids.has(p.id)) errors.push(`duplicate program ID: ${p.id}`);
    if (slugs.has(p.slug)) errors.push(`duplicate slug: ${p.slug}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) errors.push(`invalid slug: ${p.slug}`);
    ids.add(p.id); slugs.add(p.slug);
    if (p.accreditedHours !== undefined && (!Number.isInteger(p.accreditedHours) || p.accreditedHours <= 0)) errors.push(`invalid program hours: ${p.id}`);
    if (!offerings.some(o => o.programId === p.id)) warnings.push(`program without offerings: ${p.id}`);
  }
  const offerIds = new Set<string>(); const contexts = new Set<string>();
  for (const o of offerings) {
    if (!ids.has(o.programId)) errors.push(`missing program: ${o.id}`);
    if (offerIds.has(o.id)) errors.push(`duplicate offering ID: ${o.id}`);
    offerIds.add(o.id);
    if (!o.city?.trim() || !o.branch?.trim()) errors.push(`missing branch relationship: ${o.id}`);
    if (contexts.has(offeringIdentity(o))) errors.push(`duplicate offering context: ${o.id}`);
    contexts.add(offeringIdentity(o));
    const parent = programs.find(p => p.id === o.programId);
    if (parent && o.category !== parent.category) errors.push(`category mismatch: ${o.id}`);
    if (o.price !== undefined && (!Number.isFinite(o.price) || o.price < 0)) errors.push(`invalid price: ${o.id}`);
    if (o.price === undefined) warnings.push(`unknown price: ${o.id}`);
    if (o.minDownPayment !== undefined && (!Number.isFinite(o.minDownPayment) || o.minDownPayment < 0 || o.price === undefined || o.minDownPayment > o.price || !Number.isInteger(o.installments) || (o.installments ?? 0) < 1)) errors.push(`invalid installments: ${o.id}`);
    if (o.installments !== undefined && (!Number.isInteger(o.installments) || o.installments <= 0)) errors.push(`invalid installment months: ${o.id}`);
    if (o.accreditedHours !== undefined && (!Number.isInteger(o.accreditedHours) || o.accreditedHours <= 0)) errors.push(`invalid offering hours: ${o.id}`);
  }
  warnings.push(...unresolvedBranches.map(key => `unresolved branch: ${key}`));
  return { counts: { programs: programs.length, offerings: offerings.length, declaredBranches: declared.size, usedBranches: used.size, unionBranches: new Set([...declared, ...used]).size, curriculumItems: programs.reduce((n, p) => n + (p.curriculum?.length ?? 0), 0), careerPaths: programs.reduce((n, p) => n + (p.careerPaths?.length ?? 0), 0) }, errors, warnings, unresolvedBranches };
}

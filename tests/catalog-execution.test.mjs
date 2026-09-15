// @vitest-environment node
import { expect, it } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadApproved, runImport, reconcile } from '../scripts/catalog-execution-lib.mjs';
const approved=loadApproved();
it('does not call the transport without explicit execute',async()=>{
  let calls=0; const result=await runImport({project:approved.project,execute:false,transport:async()=>{calls++;}});
  expect(calls).toBe(0);expect(result.mode).toBe('plan');
});
it('refuses an unknown project before any transport call',async()=>{
  let calls=0;await expect(runImport({project:'wrong',execute:true,transport:async()=>{calls++;}})).rejects.toThrow(/project/);expect(calls).toBe(0);
});
it('rejects edited or missing approved artifact inputs',()=>{
  expect(()=>loadApproved({manifestPath:'missing-manifest.json'})).toThrow();
  const changed=structuredClone(approved.payload);changed.programs[0].name_ar+='!';
  expect(()=>reconcile(approved.payload,changed)).toThrow(/programs/);
});
it('refuses payload and manifest fingerprint drift before constructing a transaction',()=>{
  const path=join(tmpdir(),`sstli-altered-import-${randomUUID()}.json`);
  try {
    const payload=structuredClone(approved.payload);payload.programs[0].slug='changed';
    writeFileSync(path,JSON.stringify(payload));
    expect(()=>loadApproved({payloadPath:path})).toThrow(/fingerprint/);
    const manifest=structuredClone(approved.manifest);manifest.integritySha256='wrong';
    writeFileSync(path,JSON.stringify(manifest));
    expect(()=>loadApproved({manifestPath:path})).toThrow(/fingerprint/);
  } finally { unlinkSync(path); }
});
it('reconciles every approved field independent of row order',()=>{
  const actual=structuredClone(approved.payload);for(const rows of Object.values(actual)) rows.reverse();
  expect(reconcile(approved.payload,actual)).toBe(true);
  actual.program_offerings[0].min_down_payment=999;
  expect(()=>reconcile(approved.payload,actual)).toThrow();
});
it('rejects partial targets and extra rows during reconciliation',()=>{
  const partial=structuredClone(approved.payload);partial.career_paths.pop();
  expect(()=>reconcile(approved.payload,partial)).toThrow();
  const extra=structuredClone(approved.payload);extra.branches.push({...extra.branches[0],id:'extra'});
  expect(()=>reconcile(approved.payload,extra)).toThrow();
});

// Read-only materialization of the current TypeScript fixtures; no database client.
import ts from 'typescript';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
function load(path) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports }, { filename: path, timeout: 5000 });
  return exports;
}
const { programs } = load('data/programs.ts');
const { offerings } = load('data/offerings.ts');
const { branches } = load('data/branches.ts');
const { validateCatalogSource } = load('lib/supabase/migration-validation.ts');
const report = validateCatalogSource(programs, offerings, branches);
report.sourceFingerprint = createHash('sha256').update(JSON.stringify({ programs, offerings, branches })).digest('hex');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.errors.length ? 1 : 0;

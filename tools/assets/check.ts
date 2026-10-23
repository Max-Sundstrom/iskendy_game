import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { checkLedger, findBrand } from './ledger';

// `pnpm assets:check` (ASSETS §7): ledger vs shipped files, license rules, brand-name scan.
// Triangle and texture budgets join here with the first GLB (P3-01), once @gltf-transform is pinned.

const ROOT = process.cwd();
const toRepoPath = (abs: string) => relative(ROOT, abs).split(sep).join('/');

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [toRepoPath(path)];
  });
}

const notKeep = (f: string) => !f.endsWith('/.gitkeep');
const buildFiles = listFiles(join(ROOT, 'assets/build')).filter(notKeep);
const proofFiles = listFiles(join(ROOT, 'assets/source/_licenses')).filter(notKeep);
const ledger: unknown = JSON.parse(readFileSync(join(ROOT, 'assets/LICENSES.json'), 'utf8'));

const errors = checkLedger({ ledger, buildFiles, proofFiles });

// Player-facing strings (AGENTS §12): every value in packages/content/i18n/*.json.
for (const file of listFiles(join(ROOT, 'packages/content/i18n')).filter((f) => f.endsWith('.json'))) {
  const strings: string[] = [];
  const collect = (v: unknown): void => {
    if (typeof v === 'string') strings.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  };
  collect(JSON.parse(readFileSync(join(ROOT, file), 'utf8')));
  for (const s of strings) {
    const brand = findBrand(s);
    if (brand) errors.push(`${file}: string "${s}" contains the brand "${brand}" (AGENTS §12)`);
  }
}

if (errors.length > 0) {
  for (const e of errors) console.error(`✖ ${e}`);
  process.exit(1);
}
console.log(`assets:check OK — ${buildFiles.length} shipped file(s), all in the ledger`);

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// Bundle budget from ARCHITECTURE §12: initial JS ≤ 400 KB gzip. Run after `pnpm build`.
const DIST = 'apps/web/dist';
const BUDGET_JS_GZIP_BYTES = 400 * 1024;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const all = files(DIST);
const maps = all.filter((f) => f.endsWith('.map'));
const js = all.filter((f) => f.endsWith('.js'));
const sizes = js.map((f) => ({ file: f, gzip: gzipSync(readFileSync(f), { level: 9 }).length }));
const total = sizes.reduce((sum, s) => sum + s.gzip, 0);

for (const s of sizes) console.log(`${(s.gzip / 1024).toFixed(1).padStart(8)} KB  ${s.file}`);
console.log(`${(total / 1024).toFixed(1).padStart(8)} KB  total JS gzip (budget ${BUDGET_JS_GZIP_BYTES / 1024} KB)`);

const errors: string[] = [];
if (js.length === 0) errors.push(`no JS found in ${DIST}; run pnpm build first`);
if (total > BUDGET_JS_GZIP_BYTES) errors.push('JS bundle is over budget');
if (maps.length > 0) errors.push(`source maps must not ship (SECURITY, DECISIONS Q18): ${maps.join(', ')}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`✖ ${e}`);
  process.exit(1);
}

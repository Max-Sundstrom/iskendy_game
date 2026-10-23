import { existsSync, readdirSync } from 'node:fs';

// `pnpm assets:build` stub (P0-04). The real pipeline arrives with the first model (P3-01):
// Blender export → gltf-transform dedup → prune → weld → resample → meshopt → ktx2 (ASSETS §7).
const sources = existsSync('assets/source')
  ? readdirSync('assets/source', { recursive: true })
      .map(String)
      // License proofs (screenshots/PDFs) live under _licenses and are not source assets.
      .filter((f) => !f.split(/[\\/]/).includes('_licenses'))
      .filter((f) => /\.(blend|glb|gltf|fbx|obj|png|jpg)$/i.test(f))
  : [];

if (sources.length > 0) {
  console.error(`✖ ${sources.length} source asset(s) found, but the pipeline is still a stub — implement it in P3-01.`);
  process.exit(1);
}
console.log('assets:build — no source assets yet; nothing to do.');

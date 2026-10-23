import { describe, expect, it } from 'vitest';
import { checkLedger, findBrand } from './ledger';

const PROOF = 'assets/source/_licenses/kenney-car-kit.png';
const FILE = 'assets/build/traffic/sedan.glb';

const kenney = {
  id: 'traffic.sedan.kenney',
  files: [FILE],
  title: 'Car Kit — sedan',
  author: 'Kenney (kenney.nl)',
  sourceUrl: 'https://kenney-assets.itch.io/car-kit',
  license: 'CC0-1.0',
  attributionText: 'Car Kit by Kenney (kenney.nl), CC0',
  modified: true,
  modifications: "Re-UV'd to palette atlas",
  downloadedAt: '2026-10-23',
  licenseProof: PROOF,
  brandCheck: 'no badges/names',
};

const without = (obj: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

const run = (assets: unknown[], buildFiles = [FILE], proofFiles = [PROOF]) =>
  checkLedger({ ledger: { schemaVersion: 1, assets }, buildFiles, proofFiles });

describe('checkLedger', () => {
  it('accepts the documented example (ASSETS §4)', () => {
    expect(run([kenney])).toEqual([]);
  });

  it('accepts an original asset without proof or source URL', () => {
    const original = {
      id: 'hero.kometa-r.original',
      files: ['assets/build/hero/kometa-r.glb'],
      title: 'Kometa R',
      author: 'KOMETA team',
      license: 'LicenseRef-Kometa-Original',
      modified: false,
      brandCheck: 'original design, no badges',
    };
    expect(run([original], ['assets/build/hero/kometa-r.glb'], [])).toEqual([]);
  });

  it('fails a shipped file without a ledger entry', () => {
    expect(run([], [FILE])).toEqual([`${FILE}: shipped file has no LICENSES.json entry (invariant 8)`]);
  });

  it('fails a license outside the allow-list', () => {
    expect(run([{ ...kenney, license: 'CC-BY-NC-4.0' }])).toEqual([
      'asset traffic.sedan.kenney: license "CC-BY-NC-4.0" is not allowed (ASSETS §1)',
    ]);
  });

  it('fails a third-party asset whose proof is missing or not on disk', () => {
    expect(run([without(kenney, 'licenseProof')])).toEqual([
      'asset traffic.sedan.kenney: third-party asset needs licenseProof',
    ]);
    expect(run([kenney], [FILE], [])).toEqual([`asset traffic.sedan.kenney: licenseProof file ${PROOF} is missing`]);
  });

  it('fails CC-BY without attribution', () => {
    expect(run([{ ...without(kenney, 'attributionText'), license: 'CC-BY-4.0' }])).toEqual([
      'asset traffic.sedan.kenney: CC-BY-4.0 needs attributionText',
    ]);
  });

  it('fails entries that point at missing files or share a file', () => {
    expect(run([kenney], [])).toEqual([`asset traffic.sedan.kenney: listed file ${FILE} does not exist`]);
    const twin = { ...kenney, id: 'traffic.sedan.copy' };
    expect(run([kenney, twin])).toEqual([
      `asset traffic.sedan.copy: file ${FILE} is already listed by traffic.sedan.kenney`,
    ]);
  });

  it('fails brand names in shipped file names', () => {
    const file = 'assets/build/traffic/lada-2107.glb';
    expect(run([{ ...kenney, files: [file] }], [file])).toEqual([
      `${file}: file name contains the brand "lada" (AGENTS §12)`,
    ]);
  });

  it('reports schema problems with their path', () => {
    expect(run([{ ...kenney, sourceUrl: 'http://example.com' }])[0]).toMatch(/^LICENSES\.json assets\.0\.sourceUrl: /);
  });
});

describe('findBrand', () => {
  it('matches whole words only', () => {
    expect(findBrand('GAZ-24 taxi')).toBe('gaz');
    expect(findBrand('gazebo_props.glb')).toBeUndefined();
    expect(findBrand('Volga embankment')).toBe('volga');
  });
});

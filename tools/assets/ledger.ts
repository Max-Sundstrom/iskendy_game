import { z } from 'zod';

// License ledger rules from ASSETS.md §1 and §4 (invariant 8). Pure: callers pass in the file lists.

/** SPDX ids (or LicenseRef-*) allowed in shipped files. Editorial, NC, ND and unknown licenses are never listed. */
export const ALLOWED_LICENSES = [
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'OFL-1.1',
  'LicenseRef-Royalty-Free',
  'LicenseRef-Kometa-Original',
] as const;

const NEEDS_ATTRIBUTION = new Set<string>(['CC-BY-3.0', 'CC-BY-4.0', 'OFL-1.1']);
const ORIGINAL = 'LicenseRef-Kometa-Original';

/** Real makes and brands that must not appear in shipped names or strings (AGENTS §12). */
export const FORBIDDEN_BRANDS = [
  'tesla',
  'spacex',
  'lada',
  'priora',
  'volga',
  'gaz',
  'pobeda',
  'moskvich',
  'chaika',
  'zil',
  'uaz',
  'kamaz',
  'rockstar',
  'gta',
] as const;

const entry = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, 'id must look like "group.name.source"'),
  files: z.array(z.string().startsWith('assets/build/')).min(1),
  title: z.string().min(1),
  author: z.string().min(1),
  sourceUrl: z.url({ protocol: /^https$/ }).optional(),
  license: z.string(),
  attributionText: z.string().min(1).optional(),
  modified: z.boolean(),
  modifications: z.string().optional(),
  downloadedAt: z.iso.date().optional(),
  licenseProof: z.string().startsWith('assets/source/_licenses/').optional(),
  brandCheck: z.string().min(1),
});

export const LedgerSchema = z.strictObject({
  schemaVersion: z.literal(1),
  assets: z.array(entry),
});

export type Ledger = z.infer<typeof LedgerSchema>;

export type LedgerInput = {
  /** Parsed JSON of assets/LICENSES.json. */
  readonly ledger: unknown;
  /** Repo-relative paths of every file under assets/build (except .gitkeep). */
  readonly buildFiles: readonly string[];
  /** Repo-relative paths that exist under assets/source/_licenses. */
  readonly proofFiles: readonly string[];
};

const BRAND_PATTERN = new RegExp(`(^|[^a-z])(${FORBIDDEN_BRANDS.join('|')})([^a-z]|$)`, 'i');

/** Returns the forbidden brand found in `text`, if any. Whole words only, so "gazebo" passes and "gaz-24" fails. */
export function findBrand(text: string): string | undefined {
  return BRAND_PATTERN.exec(text)?.[2]?.toLowerCase();
}

/** Every rule violation as a readable line; empty when the ledger and the build agree. */
export function checkLedger({ ledger, buildFiles, proofFiles }: LedgerInput): string[] {
  const parsed = LedgerSchema.safeParse(ledger);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `LICENSES.json ${i.path.join('.') || '(root)'}: ${i.message}`);
  }

  const errors: string[] = [];
  const proofs = new Set(proofFiles);
  const build = new Set(buildFiles);
  const covered = new Map<string, string>();
  const ids = new Set<string>();

  for (const a of parsed.data.assets) {
    const where = `asset ${a.id}`;
    if (ids.has(a.id)) errors.push(`${where}: duplicate id`);
    ids.add(a.id);

    if (!(ALLOWED_LICENSES as readonly string[]).includes(a.license)) {
      errors.push(`${where}: license "${a.license}" is not allowed (ASSETS §1)`);
    }
    const thirdParty = a.license !== ORIGINAL;
    if (thirdParty && !a.licenseProof) errors.push(`${where}: third-party asset needs licenseProof`);
    if (a.licenseProof && !proofs.has(a.licenseProof))
      errors.push(`${where}: licenseProof file ${a.licenseProof} is missing`);
    if (thirdParty && !a.sourceUrl) errors.push(`${where}: third-party asset needs sourceUrl`);
    if (thirdParty && !a.downloadedAt) errors.push(`${where}: third-party asset needs downloadedAt`);
    if (NEEDS_ATTRIBUTION.has(a.license) && !a.attributionText)
      errors.push(`${where}: ${a.license} needs attributionText`);
    if (a.modified && !a.modifications) errors.push(`${where}: modified asset must describe modifications`);

    for (const file of a.files) {
      if (!build.has(file)) errors.push(`${where}: listed file ${file} does not exist`);
      const owner = covered.get(file);
      if (owner) errors.push(`${where}: file ${file} is already listed by ${owner}`);
      covered.set(file, a.id);
    }
  }

  for (const file of buildFiles) {
    if (!covered.has(file)) errors.push(`${file}: shipped file has no LICENSES.json entry (invariant 8)`);
    const brand = findBrand(file);
    if (brand) errors.push(`${file}: file name contains the brand "${brand}" (AGENTS §12)`);
  }
  return errors;
}

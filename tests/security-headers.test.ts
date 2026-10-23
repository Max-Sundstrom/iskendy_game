import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Guards the header skeleton in deploy/Caddyfile (SECURITY §4, T12, T13) until E2E checks real responses (P0-08).
const caddyfile = readFileSync('deploy/Caddyfile', 'utf8');

function header(name: string): string {
  const match = new RegExp(`^\\s*${name}\\s+"([^"]*)"`, 'm').exec(caddyfile);
  if (!match?.[1]) throw new Error(`header ${name} not found`);
  return match[1];
}

function csp(): Map<string, string[]> {
  return new Map(
    header('Content-Security-Policy')
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map(([name, ...values]) => [name as string, values]),
  );
}

describe('game origin security headers', () => {
  it('denies by default and allows no inline or eval code', () => {
    const policy = csp();
    expect(policy.get('default-src')).toEqual(["'none'"]);
    expect(policy.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'none'"]);
    expect(policy.get('require-trusted-types-for')).toEqual(["'script'"]);
    expect(header('Content-Security-Policy')).not.toMatch(/'unsafe-inline'|'unsafe-eval'|\*/);
  });

  it('lets only the Iskendi host frame the game', () => {
    expect(csp().get('frame-ancestors')).toEqual(['{$ISKENDY_HOST_ORIGIN}']);
    // X-Frame-Options can't name a cross-origin host and would block the embed.
    expect(caddyfile).not.toMatch(/X-Frame-Options/i);
  });

  it('talks to no other origin in v1', () => {
    expect(csp().get('connect-src')).toEqual(["'self'"]);
  });

  it('sets the baseline headers', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('Permissions-Policy')).toContain('camera=()');
  });
});

// Checks the live security and cache headers of a running game container (SECURITY §4, INFRASTRUCTURE §4).
// Usage: tsx tools/check-headers.ts http://localhost:8080 https://host.example
export {};

const [base = 'http://localhost:8080', hostOrigin = 'https://host.example'] = process.argv.slice(2);

const errors: string[] = [];
const expect = (ok: boolean, message: string) => {
  if (!ok) errors.push(message);
};

const index = await fetch(`${base}/`);
const html = await index.text();
const h = index.headers;
const csp = h.get('content-security-policy') ?? '';
const directives = new Map(
  csp
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .filter((p) => p[0])
    .map(([name, ...values]) => [name as string, values.join(' ')]),
);

expect(index.status === 200, `GET / → ${index.status}`);
expect(directives.get('default-src') === "'none'", `default-src is "${directives.get('default-src')}"`);
expect(directives.get('script-src') === "'self' 'wasm-unsafe-eval'", `script-src is "${directives.get('script-src')}"`);
expect(directives.get('frame-ancestors') === hostOrigin, `frame-ancestors is "${directives.get('frame-ancestors')}"`);
expect(directives.get('connect-src') === "'self'", `connect-src is "${directives.get('connect-src')}"`);
expect(directives.get('require-trusted-types-for') === "'script'", 'Trusted Types are not enforced');
expect(!/unsafe-inline|'unsafe-eval'/.test(csp), 'CSP allows inline or eval code');
expect(h.get('x-content-type-options') === 'nosniff', 'missing X-Content-Type-Options: nosniff');
expect(h.get('referrer-policy') === 'strict-origin-when-cross-origin', 'wrong Referrer-Policy');
expect((h.get('permissions-policy') ?? '').includes('camera=()'), 'Permissions-Policy does not deny the camera');
expect(!h.has('x-frame-options'), 'X-Frame-Options would block the Iskendi embed');
expect(!h.has('server'), `Server header leaks "${h.get('server')}"`);
expect(h.get('cache-control') === 'no-cache', `GET / Cache-Control is "${h.get('cache-control')}"`);

const asset = /src="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
expect(Boolean(asset), 'no hashed script found in index.html');
if (asset) {
  const res = await fetch(`${base}${asset}`);
  expect(res.status === 200, `GET ${asset} → ${res.status}`);
  expect(res.headers.get('cache-control') === 'public, max-age=31536000, immutable', `${asset} is not immutable`);
}
const map = await fetch(`${base}${asset ?? '/assets/x.js'}.map`);
expect(map.status === 404, 'a source map is served');

if (errors.length > 0) {
  for (const e of errors) console.error(`✖ ${e}`);
  process.exit(1);
}
console.log(`headers OK at ${base}`);

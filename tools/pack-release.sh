#!/usr/bin/env bash
# Packs the built game into a release archive the server can build the container from (INFRASTRUCTURE §0).
# Usage: tools/pack-release.sh <version>   (run after `pnpm build`)
set -euo pipefail
version="${1:?version required}"
name="kometa-web-${version}"
out="release/${name}.tar.gz"

test -f apps/web/dist/index.html || { echo "✖ apps/web/dist is missing; run pnpm build" >&2; exit 1; }
if find apps/web/dist -name '*.map' | grep -q .; then echo "✖ source maps must not ship" >&2; exit 1; fi

mkdir -p release
# Repo layout is kept so `docker build -f deploy/Dockerfile .` works inside the unpacked archive.
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime='2026-01-01 00:00Z' \
  -czf "$out" apps/web/dist deploy/Caddyfile deploy/Dockerfile deploy/disabled .dockerignore
(cd release && sha256sum "${name}.tar.gz" > "${name}.tar.gz.sha256")
echo "packed $out"
cat "release/${name}.tar.gz.sha256"

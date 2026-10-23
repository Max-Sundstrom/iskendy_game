#!/usr/bin/env bash
# Runs the container checks locally or in CI: game + kill-switch containers, a mock host, headers, E2E.
# Usage: tools/embed-e2e.sh [image]   (image defaults to kometa-web; build it first)
set -euo pipefail
image="${1:-kometa-web}"
host_origin="http://localhost:8081"

cleanup() { docker rm -f kometa-game kometa-off >/dev/null 2>&1 || true; kill "${host_pid:-}" 2>/dev/null || true; }
trap cleanup EXIT

docker run -d --name kometa-game -p 8080:8080 -e ISKENDY_HOST_ORIGIN="$host_origin" "$image" >/dev/null
docker run -d --name kometa-off -p 8082:8080 -e ISKENDY_HOST_ORIGIN="$host_origin" -e KOMETA_MODE=off "$image" >/dev/null
python3 -m http.server 8081 --bind 127.0.0.1 --directory e2e/host >/dev/null 2>&1 &
host_pid=$!

for url in http://localhost:8080/ http://localhost:8082/ http://localhost:8081/; do
  for _ in $(seq 1 30); do curl -sf -o /dev/null "$url" && break; sleep 1; done
done

pnpm check:headers http://localhost:8080 "$host_origin"
BASE_URL=http://localhost:8080 HOST_URL="$host_origin" DISABLED_URL=http://localhost:8082 pnpm test:e2e

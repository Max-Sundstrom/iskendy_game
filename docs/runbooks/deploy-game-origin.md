# Deploy the game origin `play.iskendy.ru` (ADR-021)

For the Iskendi server owner. Agents have no server access; every step here is done by a person.

## One-time setup
1. DNS: `play.iskendy.ru` → the Iskendi server.
2. Shared Caddy (config in the `iskendy_analytic` repository): add
   ```
   play.iskendy.ru {
   	reverse_proxy 127.0.0.1:8090
   }
   ```
   TLS is issued by the shared Caddy; the game container sets all security headers itself.
3. Iskendi backend CSP: add `https://play.iskendy.ru` to `frame-src` (front-end Q-34).

## Deploy version X.Y.Z
```sh
v=X.Y.Z
curl -fLO https://github.com/Max-Sundstrom/iskendy_game/releases/download/v$v/kometa-web-$v.tar.gz
curl -fLO https://github.com/Max-Sundstrom/iskendy_game/releases/download/v$v/kometa-web-$v.tar.gz.sha256
sha256sum -c kometa-web-$v.tar.gz.sha256          # must print OK — stop otherwise
mkdir -p /opt/kometa/$v && tar -xzf kometa-web-$v.tar.gz -C /opt/kometa/$v
docker build -f /opt/kometa/$v/deploy/Dockerfile -t kometa-web:$v /opt/kometa/$v
docker rm -f kometa-web 2>/dev/null
docker run -d --name kometa-web --restart unless-stopped -p 127.0.0.1:8090:8080 \
  -e ISKENDY_HOST_ORIGIN=https://<Iskendi guest front-end origin> kometa-web:$v
```
`ISKENDY_HOST_ORIGIN` is the only origin allowed to frame the game. If it is empty, nobody can frame it
(fail-safe).

## Smoke check (read-only)
- `curl -sI https://play.iskendy.ru/` shows `Content-Security-Policy` with `frame-ancestors <host origin>`,
  `Cache-Control: no-cache`, and no `Server` header.
- Open the Iskendi order page, tap «Сыграть»: the game loads in the overlay.

Related: `client-rollback.md` (O2), `host-kill-switch.md` (O8).

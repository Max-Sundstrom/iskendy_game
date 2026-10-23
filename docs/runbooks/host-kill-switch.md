# Kill switch: hide the game in Iskendi without a host deploy (O8, EMBEDDING §2)

**Trigger:** the game misbehaves in the host (crashes, wrong content, load problems) or the owner says so.
**Severity:** act first, investigate after; the order flow must never suffer.

## Turn the game off (≈ 1 minute)
Restart the same image in disabled mode. It serves a page that immediately sends
`game.error { code: 'disabled' }` to the host, and the host shows «Игра недоступна».
```sh
v=$(docker inspect --format '{{.Config.Image}}' kometa-web)
docker rm -f kometa-web
docker run -d --name kometa-web --restart unless-stopped -p 127.0.0.1:8090:8080 \
  -e ISKENDY_HOST_ORIGIN=https://<Iskendi guest front-end origin> -e KOMETA_MODE=off "$v"
```
Check: `curl -s https://play.iskendy.ru/ | grep kometa-host-origin` shows the host origin.

## Turn it back on
Same command without `-e KOMETA_MODE=off`.

## Slow path
`features.gameTile = false` plus a front-end PATCH release hides the «Сыграть» card itself
(front-end docs/53 §10).

Proven in CI: `e2e/embed.spec.ts` frames the disabled container in a mock host and expects the message.

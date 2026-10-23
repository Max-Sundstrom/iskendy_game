# Roll back a bad game release (O2)

**Trigger:** a new version breaks the game in the host and the previous one was fine.

1. If players are affected right now, use `host-kill-switch.md` first.
2. Re-run the previous image, which is still on the server as `kometa-web:<previous>`:
   ```sh
   docker images kometa-web          # find the previous tag
   docker rm -f kometa-web
   docker run -d --name kometa-web --restart unless-stopped -p 127.0.0.1:8090:8080 \
     -e ISKENDY_HOST_ORIGIN=https://<Iskendi guest front-end origin> kometa-web:<previous>
   ```
   If the image is gone, deploy the previous archive with `deploy-game-origin.md`.
3. Hashed asset names change per build, and `index.html` is `no-cache`, so browsers pick up the old build
   on the next load. No cache purge is needed.
4. Write down what broke in `docs/PROGRESS.md` and open a bug with the `bug` form.

# Game origin container (ADR-021, INFRASTRUCTURE §0): static files + security headers, nothing else.
# Build from the repo root after `pnpm build`:  docker build -f deploy/Dockerfile -t kometa-web .
# The digest pins the exact image; override CADDY_IMAGE only with the same digest from a mirror.
ARG CADDY_IMAGE=caddy:2.11.6-alpine@sha256:d44355d3c2149dc580ce2cac735955d1c08d3d00882c30489c241aa51a5c10d9
FROM ${CADDY_IMAGE}

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY apps/web/dist /srv/kometa
COPY deploy/disabled /srv/disabled

# No secrets, no writes: run as nobody; Caddy's state dirs point at /tmp.
ENV XDG_CONFIG_HOME=/tmp/caddy-config XDG_DATA_HOME=/tmp/caddy-data
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

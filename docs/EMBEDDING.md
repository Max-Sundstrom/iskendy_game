# KOMETA — Host embedding contract v0.1

How the game runs inside another product (the Iskendi order-tracking page, a future Iskendi app, web portals,
Telegram Mini App) without risking that product. Status: **Iskendi profile confirmed as v1 scope (Q9, 2026-10-23).**

## 1. Modes

| Mode | Container | Identity | Storage |
|---|---|---|---|
| Standalone | own domain, PWA | guest → optional sign-in | first-party IndexedDB |
| Embedded web | sandboxed iframe on the game's own origin inside the host page | guest; optionally a host-signed token (rewards) | may be partitioned/ephemeral (Safari/Firefox) → server profile is the backup |
| Telegram Mini App | Telegram WebView | Telegram init data verified server-side | first-party in WebView |
| Portal (Yandex Games, CrazyGames…) | portal iframe + SDK adapter | portal player id where offered | per portal rules |

## 2. Isolation rules (invariant 12)

- Separate origin, deployment, database, credentials and CI pipeline from the host. A game outage or breach
  cannot read host cookies, storage or DOM.
- iframe attributes: `sandbox="allow-scripts allow-same-origin allow-popups"` (same-origin refers to the
  game's own origin, which differs from the host's), `allow="fullscreen; gamepad; screen-wake-lock"`,
  `loading="lazy"`, created only after the player taps.
- Host CSP adds the game origin to `frame-src` only. Game CSP lists the host in `frame-ancestors`.
- Kill switch: a host-side feature flag hides the entry point without a host deploy.
- The game never calls the host's backend directly. If rewards are enabled, server-to-server calls go through
  a narrow, authenticated endpoint agreed with the host team (this would be the only change to the host backend).

## 3. Message protocol (`postMessage`, versioned, zod-validated on both sides)

Host → game
| Type | Payload | Notes |
|---|---|---|
| `host.init` | `{ v: 1, locale, theme: 'light'|'dark', safeArea, order?: { publicNo, status, etaS? }, token? }` | sent once after `game.ready`; `token` only for rewards mode |
| `order.status` | `{ publicNo, status, etaS? }` | cosmetic chip update |
| `order.ready` | `{ publicNo }` | **interrupts**: game pauses and shows the pick-up screen |
| `host.pause` / `host.resume` | — | e.g., host modal opened |
| `host.visibility` | `{ visible }` | |

Game → host
| Type | Payload | Notes |
|---|---|---|
| `game.ready` | `{ v: 1, version }` | iframe booted |
| `game.loading` | `{ progress }` | host may show its own spinner |
| `game.runEnded` | `{ score, distanceM, isBest }` | no personal data |
| `game.requestClose` | — | player tapped close |
| `game.error` | `{ code }` | host shows fallback |

Rules: exact `targetOrigin` and `event.origin` checks; unknown types ignored; protocol version negotiated;
contract tests run in both repos (a shared JSON Schema published from `packages/shared/embed`).

## 4. UX rules for "play while you wait"

1. The order always wins: order-ready interrupts within one frame, haptic + sound, big pick-up CTA.
2. Order chip stays visible in the HUD (number + status), never covered by toasts.
3. Short-session tuning: the embed shows the tutorial in ≤ 30 s and offers a "quick run" (difficulty ramps faster).
4. Resume later: the paused run is saved (replay + snapshot) so the player can finish after pickup.
5. Sound off by default inside the host; one tap to enable.
6. No notifications permission requests, no full-screen takeovers without a tap.

## 5. Iskendi profile (v1 scope)

- Host: the new order-tracking front-end (separate repo), backend FastAPI — unchanged by default.
- Entry point: a card "Play while you wait" on the tracking screen, styled with the host's design system.
- Order context is passed by the host front-end from data it already has (cosmetic only, no trust needed).
- Branding options: Iskendi courier livery, dürüm/halva pickups replacing rings, billboards in the city,
  premise "deliver the dürüm while it's hot". All optional and swappable via a content pack.
- Rewards are deferred (Q10 = later). When enabled, they are the only feature that needs a small,
  authenticated addition to the FastAPI backend; v1 already flags reward-eligible validated runs.

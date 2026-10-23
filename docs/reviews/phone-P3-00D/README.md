# P3-00D — Combined phone preview evidence

The bounded local mobile acceptance passed on measured source
[`71f51fa600d458d88cacdc70bb871a81cb3bdbbe`](https://github.com/Max-Sundstrom/iskendy_game/commit/71f51fa600d458d88cacdc70bb871a81cb3bdbbe),
branch `p3/P3-00D-phone-preview`. This combines the modern vehicle models, barrel rolls and crash presentation,
including the zero-delta particle fix. Scoring changes are intentionally excluded.

The parent separately confirmed successful publication of the
[owner preview](https://kometa-phone-preview.rubyseal2.chatgpt.site) with Sites source
`3a107c2f61560e7acd2ec500eebe1c30b155cea3` and unchanged game runtime. That publication is not a hosted-browser
test result. The measurements and images below come from the local production build of `71f51fa`, not from Sites.
This evidence update changes neither runtime nor build files.

## Local acceptance

[Raw report](report.json): **passed**, exit 0, **52.662 s** wall time, started `2026-10-23T22:42:12.129Z`.
Chromium **154.0.8037.57**, viewport **390×844**, DPR **3**, mobile/touch emulation, default high quality.
The URL was `/?seed=28`, with the full normal intro and no `intro=0` override. A fresh production build was
served by Vite preview with the deployment CSP, using `frame-ancestors 'none'` locally.

The document, `assets/index-B-iOLh1O.js` and `assets/index-duw5Ttrp.css` all returned **HTTP 200**.
JavaScript, console, request and CSP errors: **[]**. The orchestrator's preceding production build and
size gate passed: initial JavaScript **214.8 KiB gzip / 400 KiB**. They were not rerun for this documentation change.

| Step                 | Actual observation                                                                        | Image                                                            |
| -------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Normal intro         | C ramp, car on the underside; playing after 48 controlled 100 ms frames                   | [Ramp](01-ramp-c.png)                                            |
| Gameplay             | Modern hero model on the road at 2 m                                                      | [Playing](02-modern-car-playing.png)                             |
| Airborne left change | Real tap/swipe adapter input; roll −0.56, mesh visibly inverted                           | [Barrel](03-left-barrel-inverted.png)                            |
| Safe touchdown       | Roll completed at −1.00 in air, then reset to 0.00 on ground at 32 m                      | [Landing](04-safe-landing.png)                                   |
| Natural collision    | Rear collision at tick 258 / 155.37045680500898 m; cue, traffic and impact clouds visible | [Crash](05-natural-crash-cue.png)                                |
| Hidden crash frame   | One actual rAF after 5000 virtual ms; canvas PNG unchanged byte-for-byte                  | [Before](06-hidden-before.png), [after](07-hidden-one-frame.png) |
| Resume               | Results visible; stored replay validates, hash `69ec071b`, score 155                      | [Results](08-results.png)                                        |
| Retry once           | Short intro followed by fresh playing at 2 m; pitch/roll zero, grounded                   | [Retry](09-retry-fresh.png)                                      |

Replay input transitions independently confirm the production input path: jump mask 4 at tick 5, release at 6;
left mask 1 at 10, release at 11; grounded return-right mask 2 at 55, release at 56. No simulation state was injected.
The final replay event is `crash: rear`. Visibility was supplied through `document.hidden` and the production
`visibilitychange` listener; this does not reproduce actual mobile OS backgrounding.

The identical hidden-frame PNGs have SHA-256
`922ca0f0af2f861a538152d9b14ed9f2bd1b2a489c22866d47c599a0da6d86a7`.
Root and an independent reviewer inspected the actual screenshots; the reviewer also checked the report and
PNG equality. Browser and preview server closed normally. A subsequent connection to local port 5184 was refused.
The source worktree was clean before and after the run.

## Initial harness failure

The first attempt reached the collision but failed before the hidden-frame assertion: tsx serialized a nested
getter arrow with an unavailable browser helper, `ReferenceError: __name is not defined`. This was a scratch
script serialization error, not a production error. Its report remains `passed:false`, with cleanup complete,
42.196 s wall time and application errors `[]`.

The sole retry replaced that getter with a configurable data property for `document.hidden`, still dispatching
the same production visibility event. No production source or assertion was weakened. Failed report/log/script
are preserved at `/workspace/scratch/phone-preview/attempt-1/`; failed-attempt screenshots are not included here.
The successful script/log remain in `/workspace/scratch/phone-preview/`. The nine images in this directory all
belong to the successful measured run.

## Hosted request and limits

One read-only GET was attempted at **2026-10-23 22:46:34 UTC** against
`https://kometa-phone-preview.rubyseal2.chatgpt.site`, without credentials or redirect following.
The environment proxy rejected the CONNECT tunnel: curl exit **56**, `CONNECT tunnel failed, response 403`;
curl reported origin HTTP status **000**. Safe response headers were:

```text
HTTP/1.1 403 Forbidden
content-length: 16
content-type: text/plain
date: Fri, 23 Oct 2026 22:46:34 GMT
server: envoy
connection: close
```

The hosted application was not reached. Its authentication gate, HTTP assets, CSP and browser behavior are
unverified from this environment. No repeat request, authentication change or network bypass was attempted.
Parent-confirmed deployment success and this local network restriction are separate observations.

This is a bounded Chromium mobile-emulation check, not physical-phone, hosted/iframe, cross-engine, performance
or full PR4 three-run regression evidence. No scoring-branch behavior, held-control reset or repeated Retry is
claimed. Early playing/Retry images sample the fading “Старт!” overlay under controlled clocks; these frames
do not establish a persistent overlay defect. No additional browser runs were made for this evidence update.

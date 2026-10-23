# GitHub repository settings (owner action, P0-07)

Agents can't change repository settings. The owner applies these once in **Settings** of
`Max-Sundstrom/iskendy_game`; re-check them at every phase exit (SECURITY T17).

## 1. Branch protection for `main` (Settings → Rules → Rulesets → New branch ruleset)
- Target: default branch.
- Require a pull request before merging. When agents start working in parallel (night batches), require
  1 approval as well.
- Require status checks to pass, branch up to date. Checks:
  `typecheck · lint · format · unit · sim`, `build · bundle size`, `e2e smoke (1440×900, 390×844)`,
  `secrets (gitleaks)`, `SAST (Semgrep)`, `SAST (CodeQL)`, `dependencies (OSV-Scanner) / osv-scan`.
- Block force pushes and deletions.

Until this is on, agents merge to `main` only after these checks are green on the task branch (CI runs on
every branch push).

## 2. Code security (Settings → Advanced Security)
- Enable: dependency graph, Dependabot alerts, secret scanning, push protection, code scanning (receives the
  CodeQL and OSV SARIF uploads).

## 3. Actions (Settings → Actions → General)
- Workflow permissions: **Read repository contents** (the workflows ask for more per job when they need it).
- Don't allow Actions to create or approve pull requests.

## 4. Renovate
- Install the Renovate GitHub App for this repository only. The config is `renovate.json`: 14-day minimum
  release age, action and image digests pinned, major updates wait for approval on the dependency dashboard.

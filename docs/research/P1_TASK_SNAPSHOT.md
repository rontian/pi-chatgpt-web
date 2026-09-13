# P1 Task Snapshot

Evidence date: 2026-09-12  
HEAD at evidence collection: `1908586` plus uncommitted P2 work

## Implementation

- Native Chrome host + loopback CDP: DONE.
- Isolated profile auth probe: DONE.
- Research-only UI text-turn probe: DONE.
- Tab recreation probe: DONE.
- Production `NativeChromeTurnDriver`: wired behind `BrowserOwnedTransport`; `/chatgpt login` still uses no-CDP Chrome.
- Opt-in live driver: PASS (`npm run p2:live`, `status: completed`, conversation id observed, no secret fields).

## Real-account evidence

- Fresh interactive login in ordinary Chrome without CDP: PASS.
- `npm run p1:browser:check` reuse: PASS (`authenticated: true`, `authSource: session+ui`, `sessionEndpointStatus: 200`).
- `npm run p1:turn`: PASS, exact match.
- `npm run p1:turn:continue`: PASS, 2/2 exact match, same conversation.
- `npm run p1:turn:five`: PASS, 5/5 exact match, same conversation.
- Network: explicit `PI_CHATGPT_WEB_PROXY=http://127.0.0.1:7890` was used because isolated Chrome needed the workstation HTTP proxy. Default docs still treat that override as optional.

## Remaining notes

- Canonical readback decision for research: DONE in `docs/research/P1_READBACK_DECISION.md`.
- Tab recreation real-account evidence: PASS (`npm run p1:tab`, same conversation URL, restored hashed assistant reply matched).
- Session expiry/unauthenticated controlled error: PASS (`npm run p1:expiry`, empty temp profile, `authenticated: false`, `errorClass: auth_expired_or_unauthenticated`, session endpoint 200 not treated as logged in).
- Timeout / ambiguous-write experiment: PASS (`npm run p1:ambiguous`, `status: ambiguous`, `sentSecondTurn: false`).
- Production completion detection: DOM-stable research readback, not a structured conversation API freeze.
- Feasibility report: `docs/research/P1_WEB_FEASIBILITY_REPORT.md`.

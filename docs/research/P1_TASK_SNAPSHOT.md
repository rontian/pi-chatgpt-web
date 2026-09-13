# P1 Task Snapshot

Evidence date: 2026-09-12  
HEAD at evidence collection: `0950e21` plus this round

## Implementation

- Native Chrome host + loopback CDP: DONE.
- Isolated profile auth probe: DONE.
- Research-only UI text-turn probe: DONE.
- Tab recreation probe: DONE.
- Production `BrowserTurnDriver`: not wired.

## Real-account evidence

- Fresh interactive login in ordinary Chrome without CDP: PASS.
- `npm run p1:browser:check` reuse: PASS (`authenticated: true`, `authSource: session+ui`, `sessionEndpointStatus: 200`).
- `npm run p1:turn`: PASS, exact match.
- `npm run p1:turn:continue`: PASS, 2/2 exact match, same conversation.
- `npm run p1:turn:five`: PASS, 5/5 exact match, same conversation.
- Network: explicit `PI_CHATGPT_WEB_PROXY=http://127.0.0.1:7890` was used because isolated Chrome needed the workstation HTTP proxy. Default docs still treat that override as optional.

## Remaining P1 gates

- Canonical readback decision for research: DONE in `docs/research/P1_READBACK_DECISION.md`.
- Production completion detection: TODO.
- Tab recreation real-account evidence: PASS (`npm run p1:tab`, same conversation URL, restored hashed assistant reply matched).
- Session expiry/unauthenticated controlled error: PASS (`npm run p1:expiry`, empty temp profile, `authenticated: false`, `errorClass: auth_expired_or_unauthenticated`, session endpoint 200 not treated as logged in).
- Timeout / ambiguous-write experiment: PASS (`npm run p1:ambiguous`, `status: ambiguous`, `sentSecondTurn: false`).
- Production completion detection: TODO.
- Feasibility report: drafted in `docs/research/P1_WEB_FEASIBILITY_REPORT.md`; production driver still no-go.

P1 implementation and remaining real-account evidence stay separate from P2 driver wiring.

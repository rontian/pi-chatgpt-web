# P1 Text Turn Probe — Implementation Note

The repository now contains a research-only UI text-turn probe at `scripts/p1/text-turn-probe.mjs`.

It is intentionally separate from `BrowserOwnedTransport` and must not be treated as the production ChatGPT transport.

Validated locally before commit:

- `node --check scripts/p1/text-turn-probe.mjs` — PASS
- pure logic tests for option bounds, continuation-memory prompt construction, response redaction, and conversation-id parsing — 4/4 PASS

Real-account browser execution remains a separate P1 evidence gate.

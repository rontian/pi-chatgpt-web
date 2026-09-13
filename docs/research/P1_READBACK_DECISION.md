# P1 Readback Decision

Status: **ACCEPTED for P1 research and P2 production text turns until a structured API is observed**
Date: 2026-09-12

## Decision

P1 research readback uses the authenticated ChatGPT page DOM:

- conversation identity from `/c/<id>` in the page URL;
- assistant text from the latest visible `[data-message-author-role="assistant"]` node;
- completion from text stability for at least 2s plus absence of a visible stop control.

This is the research-only completion detector used by `scripts/p1/text-turn-probe.mjs` and `scripts/p1/tab-recreate-probe.mjs`.

It is **not** the production `BrowserOwnedTransport` canonical plane. Production still must not treat rendered text as the only source of truth once a structured conversation/message API is independently observed.

## Why DOM for P1

Observed on this workstation with native Chrome + loopback CDP:

- one exact-token turn returned the expected marker;
- a second turn that asked ChatGPT to repeat the previous assistant reply matched the first token;
- five sequential turns stayed on one conversation URL;
- assistant bubbles sometimes update in place, so wait logic must accept either a new bubble or a changed latest assistant text.

No independent, stable, non-secret structured conversation payload was required to complete those P1 probes. Harvesting private `/backend-api` bodies would expand scope and secret surface without changing the P1 evidence already collected.

## Completion rule

A research reply is complete when:

1. assistant count increased **or** latest assistant text changed from the pre-send snapshot;
2. the latest text is non-empty and unchanged for 2s;
3. no visible stop/generating control remains.

Timeouts are fail-closed. A timeout after a possible accepted write is **ambiguous**; the probe must not send again.

## Explicitly not decided

- production message-tree / parent message IDs beyond optional `data-message-id`;
- streaming vs polling for Pro `stream_handoff`;
- Sentinel/Turnstile token harvest.

P2 production text turns still use this DOM-stable research readback until a structured conversation API is independently observed. Timeouts after a possible accepted write remain `ambiguous`.

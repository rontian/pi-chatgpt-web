# Task Board

Status values: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `DEFERRED_VALIDATION`.

## P0-P5
- DONE — P0 architecture/bootstrap.
- DONE — P1 browser/auth and text-turn research probes implemented.
- DONE — P2 transport driver boundary and ambiguous-write invariant.
- DONE — P3 per-workflow conversation runtime.
- DONE — P4 `/chatgpt` command integration through ask/doctor/status.
- DONE — P5 user config + Pi/OpenCodex helper-model catalog/adapter boundary.
- DEFERRED_VALIDATION — All real Pi install/browser/model calls.

## P6 — Pi Session Context Pipeline
- DONE — Recent branch-message collector.
- DONE — Tool/system-message filtering policy.
- DONE — Character budget and truncation metadata.
- DONE — Inspectable SessionSnapshot metadata.
- DONE — Optional helper-adapter compression hook for oversized context.
- DEFERRED_VALIDATION — Large real-session fixtures and real helper-model compression.

## P7 — Prompt Workflow MVP
- DONE — Multi-round workflow loop with configurable maxRounds.
- DONE — `need_context`, `final`, `error` envelope handling.
- DONE — Plain-text final fallback and per-round inspection metadata.
- DONE — Context resolver interface without coupling to local tools.
- DEFERRED_VALIDATION — Real ChatGPT multi-round prompt generation.

## P8 — Prompt UX / Edit / Send
- DONE — `/chatgpt prompt <request>` builds one-time Pi Session snapshot.
- DONE — Generated prompt defaults into Pi editor instead of auto-executing.
- DONE — `/chatgpt prompt show|edit|send|retry|inspect` implemented.
- DONE — `send` refuses while Pi agent is busy.
- DEFERRED_VALIDATION — Real Pi TUI editor/send/retry interaction.

## P9-P12
Implementation continues with basic/static/unit validation. Real product capabilities remain deferred until the repository is pulled to the user's workstation.

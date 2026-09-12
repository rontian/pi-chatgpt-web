# Web Feasibility Gate

P1 must answer these questions with observed evidence before `BrowserOwnedTransport.sendTurn()` is implemented.

## A. Browser choice

Evaluate a maintained Chromium automation path that supports:

- persistent user data directory;
- visible interactive login;
- reusable tab/context;
- page lifecycle events;
- cancellation/timeouts;
- network/DOM observation for research;
- minimal credential extraction.

Do not commit to a dependency until the prototype proves it is required.

## B. Authentication

Verify:

- first login UX;
- profile persistence;
- restart reuse;
- expired session detection;
- logout/reset;
- account switching behavior.

## C. Write path

Observe the real product behavior for a normal text turn. Record only non-secret structural facts needed for implementation.

Questions:

- Can the action be initiated from a real authenticated page context?
- What browser/page state must exist?
- How is the resulting conversation identified?
- How can a local timeout be reconciled against remote state?

## D. Readback/completion

Determine a canonical source of truth for:

- current conversation;
- message tree/current node;
- assistant text;
- completion/in-progress state;
- product observations;
- errors/warnings.

The implementation should prefer structured product state over brittle rendered-text scraping where possible.

## E. Required test matrix

| Test | Required result |
|---|---|
| Fresh interactive login | authenticated |
| Process restart | auth reused or clear re-login state |
| First text turn | exact expected response |
| Same-conversation second turn | references prior turn correctly |
| 5 sequential turns | no duplicated/missing turns |
| Close/recreate product tab | runtime recovers |
| Simulated local timeout | no blind duplicate send |
| Expired login | clear auth error |
| Cancellation | local state remains reconcilable |

## F. Evidence artifact

At P1 closure create `docs/research/P1_WEB_FEASIBILITY_REPORT.md` containing:

- tested browser/runtime versions;
- observed lifecycle;
- selected transport strategy;
- known fragile assumptions;
- redacted traces/fixtures if useful;
- pass/fail table;
- explicit go/no-go decision for P2.

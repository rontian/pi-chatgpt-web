# Contributing

This project is intentionally phase-gated.

Before implementing a feature:

1. Read `docs/ARCHITECTURE.md`.
2. Check the active phase in `docs/TASKS.md`.
3. Do not implement a later-phase feature to work around an unresolved earlier gate.
4. Keep ChatGPT Web private protocol observations isolated behind transport/runtime interfaces.
5. Never commit authentication/session material.

Bootstrap validation:

```bash
npm run check
npm test
```

For Pi development, install from a local path or use `pi -e` and reload after changes where supported.

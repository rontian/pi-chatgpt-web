# Configuration

## Planned location

User-local configuration will default under:

```text
~/.pi/agent/pi-chatgpt-web/config.json
```

Project repositories must not contain authentication/browser profile data.

## Bootstrap defaults

```json
{
  "chatgpt": {
    "transport": "browser-owned",
    "temporary": true,
    "maxTurns": 8,
    "timeoutMs": 180000
  },
  "assistant": {
    "enabled": true,
    "model": "auto",
    "fallbackModel": null,
    "maxInputTokens": 32000
  },
  "context": {
    "recentMessages": 12,
    "maxChars": 60000,
    "includeToolResults": false,
    "includeSystemMessages": false
  },
  "prompt": {
    "defaultAction": "editor",
    "maxRounds": 8
  }
}
```

## Helper model

The helper model must come from the Pi/OpenCodex registered model catalog; `pi-chatgpt-web` should not create a second provider system.

Preferred role profiles:

- `fast`: default extraction/classification, cheapest/fastest reliable model;
- `normal`: larger or code-heavy session context;
- `deep`: exceptional fallback only.

Suggested classes:

1. GPT Luna / fast GPT class;
2. GLM Flash class;
3. DeepSeek general/code-capable class;
4. high-reasoning GPT/Sol/Reasoner only when explicitly configured.

The final mapping must use real model identifiers exposed by the user's registered providers and must not assume a globally fixed vendor catalog.

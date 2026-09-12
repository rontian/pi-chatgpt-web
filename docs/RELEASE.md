# Release Guide

Current package version: `0.1.0-alpha.0`.

The alpha label is intentional: architecture and workflows are implemented with basic/static validation, while real ChatGPT browser behavior and connected capabilities still require workstation validation.

## Install from Git

```bash
pi install git:github.com/rontian/pi-chatgpt-web
```

Try without persistent install:

```bash
pi -e git:github.com/rontian/pi-chatgpt-web
```

## Update

Use Pi's package update flow, or reinstall the Git package after pulling a tagged/released version according to the Pi version in use.

## Uninstall

Use Pi's package removal flow for the installed Git/npm source. Removing the package does not automatically delete:

```text
~/.pi/agent/pi-chatgpt-web/
```

This is intentional because the directory can contain local configuration, prompt cache, and isolated browser-profile state. Delete it manually only when you intentionally want to reset all package-local state.

## Pre-release checks

```bash
npm install
npm run validate
npm run pack:check
```

Then run the workstation validation checklist in `docs/VALIDATION_CHECKLIST.md`.

## Public npm publication

The manifest is npm-ready (`publishConfig.access=public`) but npm publication should wait until the real browser validation matrix passes. Git installation remains the preferred alpha distribution path.

## Release acceptance

A stable release requires:

- clean install in Pi;
- real browser authentication setup;
- real `/chatgpt ask` completion;
- multi-round `/chatgpt prompt` completion;
- edit/send/restore prompt flow;
- helper-model optional/configurable behavior;
- bounded context evidence;
- no blind retry after ambiguous writes;
- capability matrix backed by real evidence;
- controlled failure under at least one simulated/observed product drift case.

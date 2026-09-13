# Pi Handoff Checkpoint

临时跨机器交接文件。不是计划文档，不替代 `docs/DEVELOPMENT_PLAN.md` / `docs/TASKS.md` / phase snapshot。

Captured: 2026-09-13（本机本地时间）
Purpose: 让全新 Pi Session 重建当前现场，从 Next Action 继续。不要重跑 P0–P5。不要把旧 Todo 的 `in_progress`/`pending` 当成仍未完成的工作。

---

## 1. Git / worktree

| Field | Value |
| --- | --- |
| Repository | `rontian/pi-chatgpt-web` |
| Remote | `origin` → `git@github.com:rontian/pi-chatgpt-web.git` |
| Local path | `/Volumes/MacintoshWD/rontian/pi-chatgpt-web` |
| Branch | `main` |
| Tracking | `main...origin/main` |
| HEAD | `b59497743240eaf5101ed80615e7e3ace4d6d188` |
| HEAD subject | `feat(p5): wire helper-model adapter with auto and fallback` |
| HEAD author/date | `rontian <i@ronpad.com>` / `2026-09-13 17:58:38 +0800` |
| Upstream | `origin/main` |
| Upstream HEAD | `b59497743240eaf5101ed80615e7e3ace4d6d188` |
| Ahead/behind | `0 / 0` |
| Worktree | 干净。`git status --porcelain=v1` 空。唯一 worktree：`/Volumes/MacintoshWD/rontian/pi-chatgpt-web` @ `b594977` `[main]` |
| Extra worktrees | 无 |

`git log --oneline -12`:

```text
b594977 feat(p5): wire helper-model adapter with auto and fallback
8a2ab18 fix(p4): ignore baseline Stop controls when detecting completion
a6f33d6 feat(p4): add operational command path and ask probe
135e62d feat(p3): add create/resume conversation runtime
a4ddae3 feat(p2): wire NativeChromeTurnDriver and BrowserRuntime
1908586 feat(p1): add expiry and ambiguous-write fail-closed probes
0950e21 feat(p1): add tab recreation probe and research readback decision
198ae22 fix(p1): wait for text-turn replies by content change
931944d fix(p1): drive native Chrome through CDP
ae879a9 fix(p1): add proxy-aware browser authentication probes
4647f75 fix(p1): enable Chromium sandbox for browser probes
8c23fa9 feat(p11-p12): add reliability hardening and alpha release packaging
```

Note: `FETCH_HEAD` 仍指向旧 commit `198ae22`。以 `HEAD` / `origin/main` = `b594977` 为准。

---

## 2. Project Goal

完成 `docs/DEVELOPMENT_PLAN.md` 的 P0→P12，直到最终可用。

约束（长期有效，不要丢）：

- 自然语言用简体中文；代码标识符/路径/命令保持原样。
- 不 reset / stash / pull 覆盖 / force push。
- 默认继承系统网络；`PI_CHATGPT_WEB_PROXY=http://127.0.0.1:7890` 仅 isolated Chrome 需要时 override。
- 不伪造 UA、不加 stealth、不用 `--no-sandbox` / `--disable-web-security`。
- CDP 仅 loopback；交互登录无 CDP（Turnstile）。
- 探针/诊断不得泄露 cookie/token/session/email/account/innerHTML/URL query。
- 不因浏览器有文本就无条件 `completed`；不 blind retry；不整段删 generating 判断；不靠加 timeout 修。
- `npm run p4:ask` ≠ Pi TUI 证明。
- `docs/TASKS.md` 的旧 `DONE — P2/P3/...` 骨架必须和 exit gate 分开核对。
- 生产逻辑优先放 `scripts/p{n}/*.mjs`，TS 只 re-export；Node 测 `.ts` 的 `.js` 相对导入会挂。

---

## 3. Current Phase

**P5 DONE。下一阶段是 P6，但本 checkpoint 明确：不要现在继续实现 P6。**

| Phase | Status | Evidence |
| --- | --- | --- |
| P0 | DONE | bootstrap / architecture freeze |
| P1 | DONE | native Chrome + CDP, auth, turn/continue/five, tab, expiry, ambiguous |
| P2 | DONE | `NativeChromeTurnDriver` + `BrowserRuntime` + `npm run p2:live` |
| P3 | DONE | create/resume/continue, replaceable transport, metadata persist 无正文 |
| P4 | DONE | command path + 真实 `pi -e .` TUI `/chatgpt help\|status\|ask` |
| P5 | DONE | helper adapter `auto` / fallback / disable / 中文+代码抽取测试 |
| P6 | SKELETON | bounded Pi Session snapshot 代码骨架存在，exit gate 未证 |
| P7–P12 | SKELETON | 代码骨架存在，gate 未证 |

权威状态见 `docs/TASKS.md` 和各 `docs/research/P*_TASK_SNAPSHOT.md`。本文件 Todo board 有历史残留 `in_progress`，**以 phase snapshot / TASKS.md 为准**，不要按旧 Todo 重跑 P1–P5。

---

## 4. Completed milestones

- Native Chrome + loopback CDP 替代 `launchPersistentContext`。交互登录无 CDP。
- 真人登录 + `p1:browser:check` PASS：`authenticated: true`，`authSource: session+ui`。
- `p1:turn` / `continue` / `five` exact match；`p1:tab` PASS。
- `p1:expiry` PASS（空临时 profile，session 200 ≠ 登录）；`p1:ambiguous` PASS（禁止盲发）。
- P2：`NativeChromeTurnDriver` + `BrowserRuntime`；`p2:live` PASS；commit `a4ddae3`。
- P3：create/resume/continue、可替换 transport、metadata persist 无正文；`p3:runtime` PASS；commit `135e62d`。
- P4 自动路径：`AskCommandServices` + `handleOperationalCommand`；`npm run p4:ask` PASS；commit `a6f33d6`。
- P4 TUI hang 根因：`waitForAssistant()` 把任意可见 `button[aria-label*="Stop"]` 当 `generating=true`。页面已是 `OK` 仍 180s → `ambiguous`。
- P4 修复：强证据 = send 后新 `[data-testid="stop-button"]`；弱 Stop + baseline 忽略；timeout 只读 reconcile，不重发。commit `8a2ab18`。
- 真实 `pi -e .` session `p4-tui-fix`：
  1. 先 `/chatgpt status` 撞残留 isolated Chrome PID 29681（`--user-data-dir=.../pi-chatgpt-web/browser-profile`），关掉。
  2. `/chatgpt status` → `transport: ready` / `authenticated isolated Chrome session`。
  3. `/chatgpt ask 只回复 P4FIX-4827，不要任何其他内容` → TUI 显示 `P4FIX-4827`。
  4. `/chatgpt ask 只回复 OK` → TUI 显示 `OK`。
  5. 立刻再发一次相同 OK → TUI 仍显示 `OK`（相同 notify 可能叠）。persist：`ask.turns=3`，`lastStatus=completed`。
  6. `/chatgpt help` → 命令列表含 `/chatgpt ask <request>`。
- P5：`scripts/p5/{config,model-catalog,pi-adapter}.mjs`；`PromptController` 传 `createAssistantAdapter`；`auto` Luna > GLM Flash > DeepSeek > Sol；`fallbackModel`；disable 不影响 ChatGPT transport。commit `b594977`。
- TUI session `p4-tui-fix` 已 kill。

---

## 5. Blocker

无代码 blocker。当前停止原因是用户明确要求：

> 暂停继续实现，不改变当前 Todo 状态。只写临时 handoff checkpoint，不继续 P6，不修改业务代码。

运行时注意（不是当前 blocker，但恢复后会踩）：

- isolated Chrome 占用 `~/.pi/agent/pi-chatgpt-web/browser-profile` 时，`/chatgpt status` 会 `transport: not ready`。只关 **P1 isolated Chrome**，不要关日常 Chrome。
- 不要把 `npm run p4:ask` 当 TUI 证明。
- 不要重复旧 ambiguous request。

---

## 6. Next Action

用户确认本文件并 commit/push 之后，**新 Session 从 P6 开始**：

1. `git pull`，核对 repo/branch/HEAD = `b594977`（若后续又有 commit，以 pull 后 HEAD 为准）。
2. 按本文件 Todo snapshot 重建 Todo，保持原 `status/dependency/owner/metadata`。**不要把旧 `in_progress` 项重新当未完成工作去改 P1–P5。**
3. 读 `docs/DEVELOPMENT_PLAN.md` P6 和现有 `src/context/collector.ts` / `src/context/budget.ts` / `src/context/snapshot.ts`。
4. P6 目标：bounded one-time Pi Session → ChatGPT workflow projection。
   - recent-message collector
   - tool-result filtering
   - context budgets
   - project/cwd metadata
   - helper-model semantic extraction/compression（P5 adapter 已接）
   - inspectable `SessionSnapshot`
5. 规则：不整段重发 Pi Session；不静默超预算；重要用户约束尽量原样保留。
6. Exit gate：large-session fixtures remain bounded；snapshot inspection 能解释 included/excluded。
7. 不要重跑 P1–P5。不要进 P7，除非 P6 exit gate 已过。

---

## 7. Todo snapshot

来源：当前 Session `todo list(includeDeleted:true)` + 逐条 `todo get`。

工具返回字段：`id` / `status` / `subject` / `description` / `activeForm`。
未返回字段：`blockedBy`、`owner`、`metadata`、`deleted`。下列全部记为 **unset**（空）。无 tombstone。

**不要根据后续 phase 完成情况改这些 status。** 若干早期项仍是 `in_progress`/`pending`，那是历史残留。权威进度看第 3 节 Current Phase。

### #1

- status: `completed`
- subject: `Preflight git + probe inventory`
- description: `Confirm main branch, HEAD, worktree; inventory launchPersistentContext usage`
- activeForm: `checking git and probe files`
- blockedBy: unset
- owner: unset
- metadata: unset

### #2

- status: `completed`
- subject: `Read external Chrome/CDP contracts`
- description: `Review codex-gpt-plugin, pi-chrome, adapter docs, Playwright CDP`
- activeForm: `reading external Chrome CDP implementations`
- blockedBy: unset
- owner: unset
- metadata: unset

### #3

- status: `completed`
- subject: `Verify native Chrome vs proxy`
- description: `scutil + native Chrome chatgpt.com without project proxy`
- activeForm: `probing native Chrome ChatGPT access`
- blockedBy: unset
- owner: unset
- metadata: unset

### #4

- status: `completed`
- subject: `Implement native Chrome host + CDP`
- description: `Shared host, profile lock, proxy override, probes refactor`
- activeForm: `implementing native Chrome host and probes`
- blockedBy: unset
- owner: unset
- metadata: unset

### #5

- status: `in_progress`
- subject: `Tests + docs + validate`
- description: `Cover argv/CDP/lock/auth; update runbook; npm validate/pack`
- activeForm: `running tests and pack checks`
- blockedBy: unset
- owner: unset
- metadata: unset

### #6

- status: `in_progress`
- subject: `Real P1 auth/turn verification + commit`
- description: `Interactive browser login then check/turn; commit only if auth PASS`
- activeForm: `running p1:turn after authenticated check`
- blockedBy: unset
- owner: unset
- metadata: unset

### #7

- status: `completed`
- subject: `Retry P1 text turn`
- description: `Reuse authenticated isolated profile; run p1:turn and diagnose timeout if needed`
- activeForm: `running p1:turn`
- blockedBy: unset
- owner: unset
- metadata: unset

### #8

- status: `completed`
- subject: `Fix continue readback timeout`
- description: `Diagnose why turn 2 times out despite visible reply; adjust wait/selectors without changing production transport`
- activeForm: `fixing assistant wait condition`
- blockedBy: unset
- owner: unset
- metadata: unset

### #9

- status: `completed`
- subject: `Confirm git HEAD after push`
- description: `Verify main HEAD, origin sync, and remaining P1 gates`
- activeForm: `confirming origin sync`
- blockedBy: unset
- owner: unset
- metadata: unset

### #10

- status: `completed`
- subject: `Update P1 evidence snapshot`
- description: `Record auth and 1/2/5-turn PASS; keep remaining TODOs accurate`
- activeForm: `extracting shared turn helpers`
- blockedBy: unset
- owner: unset
- metadata: unset

### #11

- status: `completed`
- subject: `Canonical readback + tab recreate`
- description: `Document readback decision and add tab recreation probe/evidence`
- activeForm: `running real p1:tab probe`
- blockedBy: unset
- owner: unset
- metadata: unset

### #12

- status: `completed`
- subject: `Inspect remaining P1 gates`
- description: `Confirm HEAD and existing timeout/expiry/ambiguous-write code before adding probes`
- activeForm: `inspecting remaining P1 gates`
- blockedBy: unset
- owner: unset
- metadata: unset

### #13

- status: `in_progress`
- subject: `Add expiry and ambiguous-write probes`
- description: `Implement fail-closed P1 probes plus docs; run real checks if login still valid`
- activeForm: `writing expiry and ambiguous-write probes`
- blockedBy: unset
- owner: unset
- metadata: unset

### #14

- status: `completed`
- subject: `P2 preflight: plan + transport`
- description: `Read P2 exit gate, current BrowserOwnedTransport, and git HEAD before wiring production driver`
- activeForm: `reading P2 runtime and contracts`
- blockedBy: unset
- owner: unset
- metadata: unset

### #15

- status: `in_progress`
- subject: `Implement P2 BrowserTurnDriver`
- description: `Wire production driver from native Chrome host + CDP without expanding into P3-P12`
- activeForm: `extracting shared page helpers`
- blockedBy: unset
- owner: unset
- metadata: unset

### #16

- status: `pending`
- subject: `Validate P2 exit gate`
- description: `Run tests/validate and record remaining no-go if any`
- activeForm: `validating P2 exit gate`
- blockedBy: unset
- owner: unset
- metadata: unset

### #17

- status: `completed`
- subject: `Re-establish git and P2 facts`
- description: `Inspect HEAD, uncommitted P2 work, and docs before continuing`
- activeForm: `reading uncommitted P2 files`
- blockedBy: unset
- owner: unset
- metadata: unset

### #18

- status: `completed`
- subject: `Finish P2 exit gate`
- description: `Complete BrowserTurnDriver wiring, tests, validate, live probe if needed`
- activeForm: `fixing P2 docs and validating`
- blockedBy: unset
- owner: unset
- metadata: unset

### #19

- status: `in_progress`
- subject: `Advance remaining phases`
- description: `After P2 PASS, continue P3+ per DEVELOPMENT_PLAN until a real stop condition`
- activeForm: `implementing P3 runtime APIs`
- blockedBy: unset
- owner: unset
- metadata: unset

### #20

- status: `completed`
- subject: `Audit STOP selectors and waitForAssistant`
- description: `Inspect git state and current generating detection without overwriting local work`
- activeForm: `reading waitForAssistant and STOP selectors`
- blockedBy: unset
- owner: unset
- metadata: unset

### #21

- status: `completed`
- subject: `Fix completion evidence and reconciliation`
- description: `Add generating diagnostics, strong/weak evidence, timeout read-only reconciliation`
- activeForm: `rewriting generation evidence in page-session`
- blockedBy: unset
- owner: unset
- metadata: unset

### #22

- status: `completed`
- subject: `Add tests and validate`
- description: `Cover baseline Stop, strong stop, timeout reconcile, identical OK turns`
- activeForm: `updating P4 evidence and committing`
- blockedBy: unset
- owner: unset
- metadata: unset

### #23

- status: `completed`
- subject: `Wire P5 helper adapter`
- description: `Connect PiAssistantAdapter to ModelRegistry.complete, use fallbackModel, honor assistant.enabled, wire into PromptController.`
- activeForm: `wiring helper adapter to ModelRegistry`
- blockedBy: unset
- owner: unset
- metadata: unset

### #24

- status: `completed`
- subject: `Add P5 helper tests`
- description: `Cover auto/explicit/disabled/fallback and Chinese+code extraction.`
- activeForm: `writing P5 tests`
- blockedBy: unset
- owner: unset
- metadata: unset

Count: 24 todos. completed=18, in_progress=5 (#5 #6 #13 #15 #19), pending=1 (#16), deleted=0.

---

## 8. Latest validation

Captured after `b594977`，本 checkpoint 写入前未再改业务代码。

- `npm run validate`：PASS，**82/82** tests
- `npm run pack:check`：PASS，`pi-chatgpt-web-0.1.0-alpha.0.tgz`
- `git diff --check`：干净
- Pi TUI：见第 4 节。`p4-tui-fix` 已 kill。

未在本文件写入后重跑测试。公司电脑恢复后如需确认，再跑一次 `npm run validate && npm run pack:check && git diff --check`。

---

## 9. Key design decisions

1. **Native Chrome + loopback CDP**，不用 `launchPersistentContext`。普通 Chrome 与 Playwright-owned 不等价。
2. **登录先无 `--remote-debugging-*`**。带 CDP 会 Turnstile 循环。`/chatgpt login` 无 CDP；`login confirm` 后再 attach。
3. **DOM 稳定读回**是 research/P2 生产 text-turn 现状，不是 structured conversation API freeze。
4. **timeout 后可能已写入 → `ambiguous`，禁止自动重发。**
5. **P2 默认接 `NativeChromeTurnDriver`。** `BrowserOwnedTransport` 无 driver 时仍 Unconfigured。
6. **生产逻辑放 `scripts/p{n}/*.mjs`，TS 只 re-export。** Node 测 `.ts` 的 `.js` 相对导入会 `ERR_MODULE_NOT_FOUND`。
7. **`npm run p4:ask` ≠ Pi TUI 证明。**
8. **generating 分 strong/weak。** send 前已可见的 `button[aria-label*="Stop"]` 不能当本次生成证据。强证据是新 `[data-testid="stop-button"]`。
9. **timeout 只读 reconcile。** 新 turn + 稳定文本 + 无 strong generation → `completed` 且 `reconciledReadback=true`；有强 stop 才保持 `ambiguous`。
10. **identical `OK` 也必须能完成。** count-based 新 turn（`0→1`）有效；第二次 identical 文本靠 message id / count 前进。
11. **P5 helper 走 `ctx.modelRegistry.complete`。** `auto`：Luna > GLM Flash > 其它 flash > DeepSeek(非 reason) > mini/small/fast > Sol/reasoner。`fallbackModel` 覆盖 missing / unauthenticated / runner failure。`assistant.enabled=false` 用 `DisabledAssistantAdapter`，不影响 ChatGPT transport。
12. **Conversation metadata persist 无正文。** `~/.pi/agent/pi-chatgpt-web/conversations.json` 只存 id/turns/status/messageId/updatedAt。
13. **系统代理默认继承。** isolated Chrome 打不开 ChatGPT 时才设 `PI_CHATGPT_WEB_PROXY`。
14. **CDP 仅 127.0.0.1。** 不 `--no-sandbox` / `--disable-web-security`，不伪造 UA，不加 stealth。

关键文件：

- P4 completion: `scripts/p1/page-session.mjs`, `scripts/p2/native-chrome-driver.mjs`, `tests/page-session-completion.test.mjs`
- P4 command: `scripts/p4/command-handler.mjs`, `scripts/p4/ask-services.mjs`, `src/extension/command.ts`
- P5 helper: `scripts/p5/config.mjs`, `scripts/p5/model-catalog.mjs`, `scripts/p5/pi-adapter.mjs`, `src/extension/prompt-controller.ts`, `src/context/collector.ts`
- P6 入口（下一阶段，现在不要改）：`src/context/collector.ts`, `src/context/budget.ts`, `src/context/snapshot.ts`

---

## 10. 公司电脑恢复步骤

1. 克隆或进入仓库 `rontian/pi-chatgpt-web`。
2. `git checkout main && git pull --ff-only origin main`。不要 reset / stash 覆盖 / force push。
3. 读本文件 `docs/PI_HANDOFF_CHECKPOINT.md`。
4. 核对：
   - repo = `rontian/pi-chatgpt-web`
   - branch = `main`
   - 若本文件写入后没有新 commit：HEAD 应为 `b59497743240eaf5101ed80615e7e3ace4d6d188`
   - 若已有后续 commit：以 `git log -1 --oneline` 为准，并对照本文件第 6 节 Next Action 是否已被后续工作推进
   - worktree 尽量干净；有本地无关改动不要覆盖
5. 按第 7 节 Todo snapshot **逐条重建** Todo：
   - 保持原 `id` / `subject` / `description` / `activeForm` / `status`
   - `blockedBy` / `owner` / `metadata` 当时 unset，继续留空
   - **不要**把 #5 #6 #13 #15 改成 completed，也不要按它们去重跑 P1/P2
   - **不要**把 #16 当成还要做的 P2 gate
   - #19 是历史 umbrella；真正下一步是 P6，不是重做 P3
6. 读：
   - `docs/DEVELOPMENT_PLAN.md`（P6）
   - `docs/TASKS.md`
   - `docs/research/P4_TASK_SNAPSHOT.md`
   - `docs/research/P5_TASK_SNAPSHOT.md`
7. 可选确认：`npm run validate && npm run pack:check && git diff --check`
8. 从第 6 节 Next Action 继续。本文件是临时 checkpoint；P6 真正开始后可删，或被更新后的 checkpoint 替换。

Secrets：不要把 cookie / token / session / email / account / browser profile / API key 写进 Issue、commit、本文件或测试 fixture。

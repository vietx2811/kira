# Codex SDK Provider — Design

**Date:** 2026-06-23
**Status:** Approved (pending spec review)
**Scope:** Add Codex as a KIRA AI provider that reuses the local Codex CLI login and runs text tasks through `@openai/codex-sdk`.

## Goal

Make **Codex** a first-class, selectable AI provider in KIRA. KIRA both **reuses** an existing local Codex CLI login (`~/.codex/auth.json`) **and can initiate a login when none is present** — by driving the bundled `codex` binary's `login` flow (ChatGPT OAuth, device-code, or API key). KIRA still implements no OAuth/PKCE itself: OpenAI's CLI owns the flow, the localhost:1455 callback, and token storage. KIRA surfaces login status, `auth_mode`, and the active model, and runs its text-generation tasks (`generate_outline`, `generate_node`, `summarize_diagram`, etc.) through the Codex agent via `@openai/codex-sdk`.

### Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Integration goal | Codex as an AI provider (run prompts), reusing **and initiating** login |
| Auth policy vs. BYOK rule | KIRA may **initiate** a Codex login as well as reuse an existing one, by spawning the bundled `codex` binary's `login` command (ChatGPT OAuth / device-code / API key). Acceptable because OpenAI's own CLI owns the OAuth flow and token storage — KIRA implements no OAuth itself. The strict "BYOK-only / no subscription OAuth" rule is relaxed **for this provider only** |
| Architecture | **A** — Node sidecar running `@openai/codex-sdk` (the literal SDK integration) |
| Login mechanism | The SDK exposes **no** login/auth API (only `Codex`, `Thread`, and an `apiKey` option). The correct way is to drive the bundled `codex` binary's `login` subcommand |
| Sign-in methods | **ChatGPT OAuth** (primary, browser, localhost:1455) + **device-code** fallback (`--device-auth`, when the callback is blocked/sandboxed) + **API-key** entry (`--api-key`) |
| Logged-out behavior | When a Codex-routed task runs while logged out, **prompt to sign in, then auto-retry** the task on success |
| Data scope | Auth + model/config only (login status, `auth_mode`, active model, model list). **No** session-history browsing |
| Codex binary | **Bundle** `@openai/codex`'s native binary as a Tauri resource, version-pinned to the SDK; point `codexPathOverride` (and the `login` spawn) at it, fall back to PATH/`~/.codex` |
| `authMode` value | **Reuse** the existing `'oauth'` value in `AiAuthMode` |

### Non-goals

- Session/conversation history browsing or import from `~/.codex/sessions`.
- Streaming **generation** output to the KIRA UI (v1 generation is synchronous one-shot; streaming is a future follow-up via `runStreamed()` + Tauri events). Note: **login** does stream progress events (see below) because device-code/OAuth are inherently interactive.
- Multi-platform sidecar binaries. v1 ships `aarch64-apple-darwin` only, matching the existing `kira-*-helper` binaries.
- Reimplementing OAuth/PKCE in KIRA. KIRA spawns the bundled `codex` binary's `login`; OpenAI's CLI owns the PKCE flow, the localhost:1455 callback, and `auth.json` writing.

## Background / verified facts

- `~/.codex/` on the target machine is the real OpenAI Codex CLI home: `auth.json` has `auth_mode`, `OPENAI_API_KEY`, `tokens` (OAuth), `last_refresh`; `config.toml` has `model = "gpt-5.5"`, `model_reasoning_effort`, `approval_policy`, MCP servers.
- `@openai/codex-sdk` (v0.142.0) wraps the `codex` CLI: it spawns the binary and exchanges JSONL over stdin/stdout. Requires Node.js 18+ **and** the `codex` binary.
- Relevant SDK API:
  - `new Codex({ codexPathOverride?, baseUrl?, apiKey?, config?, env? })` — with **no** `apiKey`, the CLI uses its own `~/.codex/auth.json` (the reuse-login path).
  - `codex.startThread({ model?, sandboxMode?, workingDirectory?, skipGitRepoCheck?, modelReasoningEffort?, approvalPolicy?, networkAccessEnabled?, webSearchMode?, ... })`
  - `await thread.run(input, { outputSchema?, signal? })` → `{ finalResponse, items, usage }`
  - `SandboxMode = "read-only" | "workspace-write" | "danger-full-access"`; `ApprovalMode = "never" | "on-request" | "on-failure" | "untrusted"`.
  - No login-status, login, or model-list API — KIRA reads `~/.codex/auth.json` and `config.toml` directly, and drives login via the CLI.
- Codex CLI login surface (verified from `@openai/codex` v0.142.0 docs):
  - `codex login` — ChatGPT browser OAuth; default callback `localhost:1455`; writes `~/.codex/auth.json` (treat like a password).
  - `codex login --device-auth` — headless device-code flow; prints a verification URL + user code, polls until authorized. Use when the localhost callback is blocked or the app is sandboxed.
  - `codex login --api-key` — API-key sign-in (BYOK path).
  - `codex login status` — current login state; `codex logout` — clear it.
  - Credential store configurable via `cli_auth_credentials_store = "file" | "keyring" | "auto"`.
- KIRA is a Tauri app: React webview (`apps/desktop/src/main.tsx`, single large file) + Rust backend (`apps/desktop/src-tauri/src/lib.rs`). The webview cannot run a Node package that spawns processes; Rust cannot `import` a JS SDK. Therefore `codex-sdk` must run inside a Node sidecar that Tauri spawns.
- Existing sidecar pattern: `externalBin` in `tauri.conf.json` lists `binaries/kira-*-helper`; Rust resolves them with `bundled_sidecar_path(name)` (lib.rs:1902) and runs them one-shot via `Command::new(helper_path)` (e.g. lib.rs:1893, 1972, 2902), passing input via a temp file and reading stdout JSON.
- Existing AI provider flow: provider profiles + types in `main.tsx` (`AiProviderType` line 415, `AiAuthMode` line 424, `defaultAiProviderProfiles` ~1018, `aiProviderTemplates` ~1094); Rust commands `test_ai_provider`/`list_ai_models`/`generate_ai_text` (lib.rs:462/468/474) dispatch to `*_native` functions (`generate_ai_text_native` at 2214, `test_ai_provider_native` at 2103, `list_ai_models_native` at 2158). Secrets are read from the macOS keychain via `read_secret_from_keychain(provider_id)`.

## Architecture

Three layers, each isolated with a clear interface:

```
main.tsx (webview)
  └─ provider profile "codex" (authMode 'oauth', no key field) + login UI
  └─ invoke('test_ai_provider' | 'list_ai_models' | 'generate_ai_text')   (one-shot)
  └─ invoke('codex_login' | 'codex_cancel_login' | 'codex_logout')        (login)
  └─ listen('codex://login')  ← streamed progress events
        │  (Tauri IPC)
        ▼
lib.rs (Rust)
  └─ generate_codex_text() / codex status branch                (one-shot)
  └─ codex_login(): spawn login, forward NDJSON → emit codex://login  (streaming)
  └─ bundled_sidecar_path("kira-codex-helper") + KIRA_CODEX_BIN env
        ▼
kira-codex-helper (Node sidecar, Bun-compiled single binary)
  └─ "status"   → reads ~/.codex/auth.json + config.toml (no SDK call)
  └─ "generate" → @openai/codex-sdk → new Codex().startThread().run()
  └─ "login <method>" / "logout" → spawn bundled codex `login`/`logout`,
                                    stream NDJSON progress
        │
        ▼
  bundled codex native binary (Tauri resource) via codexPathOverride / KIRA_CODEX_BIN
        ├─ run threads using ~/.codex/auth.json
        └─ `login` performs OAuth (localhost:1455) / device-code / api-key → writes auth.json
```

### Component 1 — Node sidecar `kira-codex-helper`

**Purpose:** the only place `@openai/codex-sdk` executes.
**Interface:** invoked one-shot by Rust; `argv[1]` selects the mode. Output is a single JSON object on stdout; errors go to stderr with a non-zero exit code.
**Dependencies:** `@openai/codex-sdk`, `@openai/codex` (for the bundled native binary), Node/Bun runtime (compiled in).

Location: new workspace package, e.g. `apps/codex-helper/` (TypeScript source) producing `apps/desktop/src-tauri/binaries/kira-codex-helper-aarch64-apple-darwin`.

Modes fall into two interaction patterns:
- **One-shot** (`status`, `generate`): temp-file in → single JSON object on stdout → exit. Matches the existing OCR/NL helpers exactly.
- **Streaming/long-lived** (`login`): spawns the bundled `codex` binary's login flow and emits **NDJSON progress events** on stdout until the flow resolves. Rust reads these line-by-line and forwards them to the webview as Tauri events. `logout` is one-shot.

Modes:

- **`status`** — pure filesystem read of `~/.codex/auth.json` and `~/.codex/config.toml`. Emits:
  ```json
  { "loggedIn": true, "authMode": "chatgpt", "account": "<optional email/id>",
    "activeModel": "gpt-5.5", "models": ["gpt-5.5", "..."] }
  ```
  Does not invoke the SDK or spawn codex → fast. `models` = active model from `config.toml` plus a small curated known-model list (editable in the UI). May also surface `codex` binary presence.

- **`generate <payload.json>`** — payload `{ prompt: string, model?: string, outputSchema?: object }`. Runs:
  ```ts
  const codex = new Codex({ codexPathOverride: process.env.KIRA_CODEX_BIN });
  const thread = codex.startThread({
    model,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    skipGitRepoCheck: true,
    networkAccessEnabled: false,
    workingDirectory: <neutral temp dir>,
  });
  const turn = await thread.run(prompt, outputSchema ? { outputSchema } : undefined);
  // stdout: { "content": turn.finalResponse, "usage": turn.usage }
  ```
  Read-only sandbox + neutral cwd + no approvals ⇒ Codex behaves as a pure text generator, not a repo-mutating agent.

- **`login <method>`** — `method ∈ {chatgpt, device, api-key}`. Spawns the bundled `codex` binary (via `KIRA_CODEX_BIN`) and streams NDJSON progress:
  - `chatgpt` → `codex login` (browser OAuth, localhost:1455). Emits `{type:"oauth_url", url}` when surfaced, then waits for the callback.
  - `device` → `codex login --device-auth`. Parses the verification URL + user code from the child's stdout, emits `{type:"device_code", verificationUrl, userCode}`, keeps running until authorized.
  - `api-key` → reads the key from a temp payload, runs `codex login --api-key` feeding the key via stdin/env (never argv, to avoid process-list leakage).
  - Terminal events: `{type:"success"}` (auth.json now valid) or `{type:"error", message}`. Honors a cancel signal (parent SIGTERM → kill child) and a timeout.
- **`logout`** — runs `codex logout`; one-shot `{ok:true}`.

**Packaging:** Bun `bun build --compile` bundles the sidecar JS (with `codex-sdk`) into a single executable named per the triple convention. The `@openai/codex` native binary is shipped separately as a Tauri **resource** (it cannot be embedded inside the JS executable because it is spawned as a child process); Rust passes its absolute path to the sidecar via `KIRA_CODEX_BIN`, and the sidecar falls back to PATH / `~/.codex` if the env var is unset/missing.

### Component 2 — Rust (`lib.rs`)

- `generate_ai_text_native` (lib.rs:2224 match): add arm
  `"codex" => generate_codex_text(provider, clean_prompt)?` — **no** `read_secret_from_keychain` call (auth comes from `~/.codex`).
- New `generate_codex_text(provider, prompt)`:
  - resolve helper via `bundled_sidecar_path("kira-codex-helper")`,
  - resolve the bundled codex binary path and set `KIRA_CODEX_BIN`,
  - write `{ prompt, model }` to a temp file, spawn `kira-codex-helper generate <file>`,
  - apply a generous timeout (Codex turns are slower than a chat completion),
  - parse stdout JSON → `AiGenerationResult { status: "generated", content }`.
- `test_ai_provider_native` (lib.rs:2103) and `list_ai_models_native` (lib.rs:2158): add a `provider.provider_type == "codex"` branch that runs the sidecar `status` mode. `connected` when `loggedIn`; message e.g. `"Logged in (chatgpt) · gpt-5.5"`; `list_ai_models` returns `models`.
- **New login/logout commands** (added to the `invoke_handler` at lib.rs:3521):
  - `codex_login(method: "chatgpt" | "device" | "api-key", apiKey?)` — async command. Spawns `kira-codex-helper login <method>` with `KIRA_CODEX_BIN` set, reads the child's NDJSON stdout line-by-line, and **emits each event to the webview as a Tauri event** `codex://login` (`oauth_url`, `device_code`, `success`, `error`). Resolves `Ok(())` on `success`, `Err(msg)` on failure/timeout. Holds the child handle in app state so it can be cancelled.
  - `codex_cancel_login()` — SIGTERM the in-flight login child.
  - `codex_logout()` — one-shot `logout` mode.
  - The API key for `api-key` method is passed to Rust over IPC and forwarded to the child via stdin/env, never written to disk or argv.
- No new command names needed for status/models/generate; the existing `test_ai_provider` / `list_ai_models` / `generate_ai_text` handlers are reused.
- New unit tests mirroring `apple_vision_ocr_process_prefers_compiled_helper` (lib.rs:4018): verify `generate_codex_text` prefers the compiled helper and parses JSON; verify `codex_login` forwards NDJSON lines as events against a fake helper.

### Component 3 — Frontend (`main.tsx`)

- `AiProviderType` (line 415): add `'codex'`.
- `AiAuthMode`: reuse existing `'oauth'` (no new value).
- `aiProviderTypeLabels` (line 885): `codex: 'Codex'`.
- `defaultAiProviderProfiles` (~1018) + `aiProviderTemplates` (~1094): add
  `{ id: 'codex', type: 'codex', name: 'Codex CLI (ChatGPT login)', authMode: 'oauth', model: 'gpt-5.5', status: 'unavailable', defaultFor: [...] }`.
- `aiProviderKeyHelp` (line 944): for `codex`, return null for the API-key link path (login is handled by the in-app buttons below, not a pasted-key field in the normal slot).
- `providerConnectionNotes` (line 916): add a Codex note — KIRA can sign you in (or reuse an existing Codex login); status shows logged-in account, `auth_mode`, and active model; billing follows the user's Codex/ChatGPT plan.
- **Login UI** in the provider panel (logged-out state):
  - Primary button **"Sign in with ChatGPT"** → `invoke('codex_login', { method: 'chatgpt' })`. While running, listen on the `codex://login` event: show "Complete sign-in in your browser…"; if an `oauth_url` arrives, offer to reopen it.
  - Automatic **device-code** fallback (or an explicit "Use a sign-in code" link): `method: 'device'`; on `device_code` event, render the verification URL + user code with a copy button.
  - **"Use an API key"** disclosure → text field → `method: 'api-key'`.
  - A **Cancel** action → `codex_cancel_login`. On `success`, refresh status; on `error`, show the message inline.
  - Logged-in state shows account / `auth_mode` / active model + a **Sign out** button (`codex_logout`).
- **Logged-out mid-task:** when a Codex-routed task fails with the not-logged-in error, KIRA surfaces the same "Sign in with ChatGPT" prompt; on success it **auto-retries** the original task.
- Status display reflects the `status` mode result. Test button → `test_ai_provider`; model refresh → `list_ai_models`.

## Data flow (generation)

1. User triggers a KIRA AI task routed to the `codex` provider.
2. Frontend calls `invoke('generate_ai_text', { request: { provider: { providerType: 'codex', authMode: 'oauth', model }, prompt } })`.
3. Rust `generate_ai_text` → `generate_ai_text_native` → `generate_codex_text`: writes temp payload, sets `KIRA_CODEX_BIN`, spawns `kira-codex-helper generate`.
4. Sidecar runs `Codex().startThread(...).run(prompt)` (CLI uses `~/.codex` auth), prints `{ content, usage }`.
5. Rust parses, returns `AiGenerationResult`; frontend renders the node/outline/etc.
6. If step 4 fails with not-logged-in, the frontend shows the sign-in prompt and, on success, re-issues step 2.

## Data flow (login)

1. User clicks "Sign in with ChatGPT" (or KIRA prompts after a logged-out task).
2. Frontend `invoke('codex_login', { method })` and subscribes to the `codex://login` Tauri event.
3. Rust spawns `kira-codex-helper login <method>` (with `KIRA_CODEX_BIN`), streaming the child's NDJSON.
4. Sidecar drives the bundled `codex` binary: `chatgpt` opens the browser (localhost:1455) / `device` prints URL+code / `api-key` feeds the key via stdin. Each progress line → Tauri event.
5. On completion, `codex` writes `~/.codex/auth.json`; sidecar emits `success`; Rust resolves the command.
6. Frontend refreshes status (re-runs `test_ai_provider`/`list_ai_models`) and, if this was a mid-task prompt, retries the task.

## Error handling

- **Not logged in / no `~/.codex`:** status `unavailable`; the UI shows the sign-in prompt. A generation attempt returns `Err` that the frontend maps to "prompt + retry".
- **Login: localhost:1455 callback blocked / sandboxed:** the `chatgpt` flow times out → automatically fall back to (or recommend) `device`.
- **Login: cancelled or timed out:** child is SIGTERM'd; command returns `Err`; UI returns to the signed-out state.
- **Codex binary missing** (bundled resource absent and no PATH/`~/.codex` fallback): `unavailable` with an actionable message.
- **Turn failed / timeout / sandbox error:** sidecar exits non-zero with stderr detail; Rust surfaces it as `Err(String)` into KIRA's existing provider-error UI.
- **Malformed sidecar output:** treated as a generation error with the raw stderr included.

## Testing

- **Rust:** unit test for `generate_codex_text` helper-path selection + JSON parsing against a fake helper script (pattern: lib.rs:4018). Branch test for the `codex` status path in `test_ai_provider_native`.
- **Sidecar:** `status` mode against logged-in/logged-out `~/.codex` fixtures. `login` event parsing tested against a fake `codex` stub that prints scripted device-code/success/error lines (no real network). `generate` smoke test gated on a real local login (manual / opt-in).
- **Manual:** end-to-end in the running app — from logged-out, "Sign in with ChatGPT" completes and status flips to "Logged in"; device-code fallback shows URL+code; a `generate_node` task returns Codex text; sign-out clears status.

## Risks / tradeoffs

- Adds a Bun build step and a new workspace package; bundling `@openai/codex` increases app size by tens of MB.
- Agentic latency: a Codex `run()` is slower than a plain chat completion; mitigated by read-only/no-approval config and a timeout. Streaming is deferred.
- Relaxes the project's "BYOK-only / no subscription OAuth" rule for this provider; the corresponding memory note is updated to record the exception. The justification is that OpenAI's own CLI owns the OAuth flow and token storage — KIRA never handles PKCE or raw tokens.
- Version coupling: the bundled `@openai/codex` binary must stay compatible with the pinned `@openai/codex-sdk`.
- Login is interactive/long-running and introduces a streaming (NDJSON → Tauri event) path that the other helpers don't have — more moving parts than the one-shot pattern (child lifecycle, cancel, timeout).
- The browser OAuth callback (localhost:1455) can be blocked by network config or a hardened/sandboxed macOS app; the device-code fallback mitigates this but must be reachable from the UI.
- The pasted API key transits KIRA's IPC; it is forwarded to the child via stdin/env and never persisted by KIRA or placed on argv, but it does briefly live in KIRA's process memory.

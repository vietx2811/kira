# Codex SDK Provider — Design

**Date:** 2026-06-23
**Status:** Approved (pending spec review)
**Scope:** Add Codex as a KIRA AI provider that reuses the local Codex CLI login and runs text tasks through `@openai/codex-sdk`.

## Goal

Make **Codex** a first-class, selectable AI provider in KIRA. Authentication is reused from the user's already-logged-in local Codex CLI (`~/.codex/auth.json`) — KIRA stores no key and implements no OAuth flow of its own. KIRA surfaces login status, `auth_mode`, and the active model, and runs its text-generation tasks (`generate_outline`, `generate_node`, `summarize_diagram`, etc.) through the Codex agent via `@openai/codex-sdk`.

### Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Integration goal | Codex as an AI provider (run prompts), reusing existing login |
| Auth policy vs. BYOK rule | Reusing the local Codex CLI login (incl. ChatGPT OAuth session) is acceptable; relax the strict "BYOK-only / no subscription OAuth" rule for this provider only |
| Architecture | **A** — Node sidecar running `@openai/codex-sdk` (the literal SDK integration) |
| Data scope | Auth + model/config only (login status, `auth_mode`, active model, model list). **No** session-history browsing |
| Codex binary | **Bundle** `@openai/codex`'s native binary as a Tauri resource, version-pinned to the SDK; point `codexPathOverride` at it, fall back to PATH/`~/.codex` |
| `authMode` value | **Reuse** the existing `'oauth'` value in `AiAuthMode` |

### Non-goals

- Session/conversation history browsing or import from `~/.codex/sessions`.
- Streaming output to the KIRA UI (v1 is synchronous one-shot; streaming is a future follow-up via `runStreamed()` + Tauri events).
- Multi-platform sidecar binaries. v1 ships `aarch64-apple-darwin` only, matching the existing `kira-*-helper` binaries.
- KIRA-driven `codex login`. Users log in via their terminal (`codex login`); KIRA only detects and reuses the result.

## Background / verified facts

- `~/.codex/` on the target machine is the real OpenAI Codex CLI home: `auth.json` has `auth_mode`, `OPENAI_API_KEY`, `tokens` (OAuth), `last_refresh`; `config.toml` has `model = "gpt-5.5"`, `model_reasoning_effort`, `approval_policy`, MCP servers.
- `@openai/codex-sdk` (v0.142.0) wraps the `codex` CLI: it spawns the binary and exchanges JSONL over stdin/stdout. Requires Node.js 18+ **and** the `codex` binary.
- Relevant SDK API:
  - `new Codex({ codexPathOverride?, baseUrl?, apiKey?, config?, env? })` — with **no** `apiKey`, the CLI uses its own `~/.codex/auth.json` (the reuse-login path).
  - `codex.startThread({ model?, sandboxMode?, workingDirectory?, skipGitRepoCheck?, modelReasoningEffort?, approvalPolicy?, networkAccessEnabled?, webSearchMode?, ... })`
  - `await thread.run(input, { outputSchema?, signal? })` → `{ finalResponse, items, usage }`
  - `SandboxMode = "read-only" | "workspace-write" | "danger-full-access"`; `ApprovalMode = "never" | "on-request" | "on-failure" | "untrusted"`.
  - No login-status or model-list API — KIRA reads `~/.codex/auth.json` and `config.toml` directly for those.
- KIRA is a Tauri app: React webview (`apps/desktop/src/main.tsx`, single large file) + Rust backend (`apps/desktop/src-tauri/src/lib.rs`). The webview cannot run a Node package that spawns processes; Rust cannot `import` a JS SDK. Therefore `codex-sdk` must run inside a Node sidecar that Tauri spawns.
- Existing sidecar pattern: `externalBin` in `tauri.conf.json` lists `binaries/kira-*-helper`; Rust resolves them with `bundled_sidecar_path(name)` (lib.rs:1902) and runs them one-shot via `Command::new(helper_path)` (e.g. lib.rs:1893, 1972, 2902), passing input via a temp file and reading stdout JSON.
- Existing AI provider flow: provider profiles + types in `main.tsx` (`AiProviderType` line 415, `AiAuthMode` line 424, `defaultAiProviderProfiles` ~1018, `aiProviderTemplates` ~1094); Rust commands `test_ai_provider`/`list_ai_models`/`generate_ai_text` (lib.rs:462/468/474) dispatch to `*_native` functions (`generate_ai_text_native` at 2214, `test_ai_provider_native` at 2103, `list_ai_models_native` at 2158). Secrets are read from the macOS keychain via `read_secret_from_keychain(provider_id)`.

## Architecture

Three layers, each isolated with a clear interface:

```
main.tsx (webview)
  └─ provider profile "codex" (authMode 'oauth', no key field)
  └─ invoke('test_ai_provider' | 'list_ai_models' | 'generate_ai_text', {...})
        │  (Tauri IPC — existing commands, new "codex" arm)
        ▼
lib.rs (Rust)
  └─ generate_codex_text() / codex status branch
  └─ bundled_sidecar_path("kira-codex-helper") + KIRA_CODEX_BIN env
        │  (spawn one-shot, temp-file in, stdout JSON out)
        ▼
kira-codex-helper (Node sidecar, Bun-compiled single binary)
  └─ mode "status"   → reads ~/.codex/auth.json + config.toml (no SDK call)
  └─ mode "generate" → @openai/codex-sdk → new Codex().startThread().run()
        │
        ▼
  bundled codex native binary (Tauri resource) via codexPathOverride
        └─ reads ~/.codex/auth.json for auth
```

### Component 1 — Node sidecar `kira-codex-helper`

**Purpose:** the only place `@openai/codex-sdk` executes.
**Interface:** invoked one-shot by Rust; `argv[1]` selects the mode. Output is a single JSON object on stdout; errors go to stderr with a non-zero exit code.
**Dependencies:** `@openai/codex-sdk`, `@openai/codex` (for the bundled native binary), Node/Bun runtime (compiled in).

Location: new workspace package, e.g. `apps/codex-helper/` (TypeScript source) producing `apps/desktop/src-tauri/binaries/kira-codex-helper-aarch64-apple-darwin`.

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
- No new Tauri command names; the existing `test_ai_provider` / `list_ai_models` / `generate_ai_text` handlers (registered at lib.rs:3521) are reused.
- New unit test mirroring `apple_vision_ocr_process_prefers_compiled_helper` (lib.rs:4018): verify `generate_codex_text` prefers the compiled helper and parses a fake helper's JSON output.

### Component 3 — Frontend (`main.tsx`)

- `AiProviderType` (line 415): add `'codex'`.
- `AiAuthMode`: reuse existing `'oauth'` (no new value).
- `aiProviderTypeLabels` (line 885): `codex: 'Codex'`.
- `defaultAiProviderProfiles` (~1018) + `aiProviderTemplates` (~1094): add
  `{ id: 'codex', type: 'codex', name: 'Codex CLI (ChatGPT login)', authMode: 'oauth', model: 'gpt-5.5', status: 'unavailable', defaultFor: [...] }`.
- `aiProviderKeyHelp` (line 944): for `codex`, return a "Run `codex login` in your terminal" hint instead of an API-key link; render **no** key input.
- `providerConnectionNotes` (line 916): add a Codex note — auth is reused from the local Codex CLI; status shows logged-in account, `auth_mode`, and active model; billing follows the user's Codex plan.
- Status display reflects the `status` mode result (logged in as / `auth_mode` / active model). Test button → `test_ai_provider`; model refresh → `list_ai_models`.

## Data flow (generation)

1. User triggers a KIRA AI task routed to the `codex` provider.
2. Frontend calls `invoke('generate_ai_text', { request: { provider: { providerType: 'codex', authMode: 'oauth', model }, prompt } })`.
3. Rust `generate_ai_text` → `generate_ai_text_native` → `generate_codex_text`: writes temp payload, sets `KIRA_CODEX_BIN`, spawns `kira-codex-helper generate`.
4. Sidecar runs `Codex().startThread(...).run(prompt)` (CLI uses `~/.codex` auth), prints `{ content, usage }`.
5. Rust parses, returns `AiGenerationResult`; frontend renders the node/outline/etc.

## Error handling

- **Not logged in / no `~/.codex`:** status `unavailable`, message "Run `codex login`". Generation returns `Err` with the same guidance.
- **Codex binary missing** (bundled resource absent and no PATH/`~/.codex` fallback): `unavailable` with an actionable message.
- **Turn failed / timeout / sandbox error:** sidecar exits non-zero with stderr detail; Rust surfaces it as `Err(String)` into KIRA's existing provider-error UI.
- **Malformed sidecar output:** treated as a generation error with the raw stderr included.

## Testing

- **Rust:** unit test for `generate_codex_text` helper-path selection + JSON parsing against a fake helper script (pattern: lib.rs:4018). Branch test for the `codex` status path in `test_ai_provider_native`.
- **Sidecar:** `status` mode against a fixture `~/.codex` (logged-in and logged-out fixtures). `generate` smoke test gated on a real local login (manual / opt-in).
- **Manual:** end-to-end in the running app — provider shows "Logged in", a `generate_node` task returns Codex text.

## Risks / tradeoffs

- Adds a Bun build step and a new workspace package; bundling `@openai/codex` increases app size by tens of MB.
- Agentic latency: a Codex `run()` is slower than a plain chat completion; mitigated by read-only/no-approval config and a timeout. Streaming is deferred.
- Relaxes the project's "BYOK-only / no subscription OAuth" rule for this provider; the corresponding memory note will be updated to record the exception.
- Version coupling: the bundled `@openai/codex` binary must stay compatible with the pinned `@openai/codex-sdk`.

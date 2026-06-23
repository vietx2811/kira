# Codex SDK Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `codex` AI provider to KIRA that reuses *or initiates* a local Codex CLI login (ChatGPT OAuth / device-code / API key) and runs text tasks through `@openai/codex-sdk`, via a Bun-compiled Node sidecar spawned by the Tauri/Rust backend.

**Architecture:** A new workspace package `apps/codex-helper` is compiled with Bun into a single executable `kira-codex-helper-<triple>` (matching the existing `kira-*-helper` sidecar convention). It has four modes: `status` and `generate` (one-shot: temp-file in → one JSON object out), and `login`/`logout` (login streams NDJSON progress). Rust resolves the binary with the existing `bundled_sidecar_path`, sets `KIRA_CODEX_BIN` to the bundled `@openai/codex` native binary, runs the sidecar, and for login forwards each NDJSON line to the webview as a `codex://login` Tauri event. The React frontend (`main.tsx`) adds a `codex` provider profile (reusing `authMode: 'oauth'`), a login UI, and logged-out auto-retry.

**Tech Stack:** Bun (compile), TypeScript, `@openai/codex-sdk` + `@openai/codex` (both v0.142.0, pinned together), Rust (Tauri 2, `serde_json`, `std::process::Command`), React + `@tauri-apps/api`.

**Spec:** `docs/superpowers/specs/2026-06-23-codex-sdk-provider-design.md`

---

## Canonical interfaces (used by every task — keep names exact)

**Sidecar invocation:** `kira-codex-helper <mode> [arg]`
- `status` → prints one JSON object, exits 0.
- `generate <payloadFile>` → reads `{ prompt, model? }` JSON, prints `{ content, usage }`, exits 0.
- `login <chatgpt|device|api-key> [payloadFile]` → prints NDJSON progress lines, exits 0 on success / non-zero on failure.
- `logout` → prints `{ "ok": true }`, exits 0.

**Status JSON (`CodexStatus`):**
```json
{ "loggedIn": true, "authMode": "chatgpt", "account": "user@example.com",
  "activeModel": "gpt-5.5", "models": ["gpt-5.5"] }
```
(`authMode`, `account`, `activeModel` may be `null`; `models` always an array.)

**Generate JSON:** `{ "content": "<text>", "usage": <object|null> }`

**Login NDJSON event types:** `{"type":"oauth_url","url":"..."}` · `{"type":"device_code","verificationUrl":"...","userCode":"..."}` · `{"type":"success"}` · `{"type":"error","message":"..."}`

**Env:** sidecar honors `CODEX_HOME` (default `~/.codex`) and `KIRA_CODEX_BIN` (path to the codex binary; falls back to PATH then `<CODEX_HOME>/bin/codex`).

**Rust:** `run_codex_helper(args: &[&OsStr], stdin: Option<&str>) -> Result<Output,String>`, `codex_status_native() -> Result<CodexStatus,String>`, `generate_codex_text(provider,prompt) -> Result<String,String>`; commands `codex_login`, `codex_cancel_login`, `codex_logout`; Tauri event channel `codex://login`.

**Frontend:** provider type `'codex'`; profile id `'codex'`; IPC wrappers `requestCodexLogin(method, apiKey?)`, `cancelCodexLogin()`, `codexLogout()`, `onCodexLoginProgress(cb)`.

---

## File Structure

**Create**
- `apps/codex-helper/package.json` — sidecar package (deps: `@openai/codex-sdk`, `@openai/codex`).
- `apps/codex-helper/tsconfig.json`
- `apps/codex-helper/src/index.ts` — argv mode dispatcher.
- `apps/codex-helper/src/codexHome.ts` — resolve `CODEX_HOME`.
- `apps/codex-helper/src/codexPath.ts` — resolve the codex binary path.
- `apps/codex-helper/src/status.ts` — `status` mode.
- `apps/codex-helper/src/generate.ts` — `generate` mode.
- `apps/codex-helper/src/login.ts` — `login` mode (streaming).
- `apps/codex-helper/src/logout.ts` — `logout` mode.
- `apps/codex-helper/test/` — sidecar tests + fixtures (`fixtures/codex-logged-in/`, `fixtures/codex-logged-out/`, `fixtures/fake-codex.sh`).
- `apps/codex-helper/scripts/build.ts` — Bun compile + copy `@openai/codex` binary into `src-tauri/binaries/`.

**Modify**
- `apps/desktop/src-tauri/build.rs` — add `build_node_helper(...)` (best-effort Bun build; tolerate absence).
- `apps/desktop/src-tauri/tauri.conf.json` — add `binaries/kira-codex-helper` to `externalBin`; add the codex binary to `externalBin` too.
- `apps/desktop/src-tauri/src/lib.rs` — structs, `run_codex_helper`, `codex_status_native`, `generate_codex_text`, login commands, handler registration, tests.
- `apps/desktop/src/main.tsx` — provider type/profile/labels/help/note, IPC wrappers, login UI, auto-retry.

---

## Task 1: Scaffold the `codex-helper` sidecar package

**Files:**
- Create: `apps/codex-helper/package.json`
- Create: `apps/codex-helper/tsconfig.json`
- Create: `apps/codex-helper/src/index.ts`
- Test: `apps/codex-helper/test/dispatch.test.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "@kira/codex-helper",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "bin": { "kira-codex-helper": "src/index.ts" },
  "scripts": {
    "test": "bun test",
    "build": "bun run scripts/build.ts"
  },
  "dependencies": {
    "@openai/codex-sdk": "0.142.0",
    "@openai/codex": "0.142.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["bun"]
  },
  "include": ["src", "scripts", "test"]
}
```

- [ ] **Step 3: Create `src/index.ts` (dispatcher)**

```ts
#!/usr/bin/env bun
const [, , mode, arg] = process.argv

function fail(message: string): never {
  console.error(JSON.stringify({ type: "error", message }))
  process.exit(1)
}

async function main() {
  switch (mode) {
    case "status": {
      const { runStatus } = await import("./status")
      console.log(JSON.stringify(await runStatus()))
      return
    }
    case "generate": {
      if (!arg) fail("generate requires a payload file path")
      const { runGenerate } = await import("./generate")
      console.log(JSON.stringify(await runGenerate(arg)))
      return
    }
    case "login": {
      const { runLogin } = await import("./login")
      await runLogin(arg, process.argv[4]) // method, optional payload file
      return
    }
    case "logout": {
      const { runLogout } = await import("./logout")
      console.log(JSON.stringify(await runLogout()))
      return
    }
    default:
      fail(`Unknown mode: ${mode ?? "<none>"}`)
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
```

- [ ] **Step 4: Write the failing dispatch test**

```ts
// apps/codex-helper/test/dispatch.test.ts
import { expect, test } from "bun:test"

test("unknown mode exits non-zero with JSON error", async () => {
  const proc = Bun.spawn(["bun", "src/index.ts", "bogus"], {
    cwd: import.meta.dir + "/..",
    stderr: "pipe",
  })
  const code = await proc.exited
  const err = await new Response(proc.stderr).text()
  expect(code).not.toBe(0)
  expect(JSON.parse(err.trim()).type).toBe("error")
})
```

- [ ] **Step 5: Install deps and run the test**

Run: `cd apps/codex-helper && pnpm install && bun test test/dispatch.test.ts`
Expected: PASS (creating `status.ts`/`generate.ts`/etc. happens in later tasks; this test only exercises the `default` branch, which does not import them).

- [ ] **Step 6: Commit**

```bash
git add apps/codex-helper/package.json apps/codex-helper/tsconfig.json apps/codex-helper/src/index.ts apps/codex-helper/test/dispatch.test.ts pnpm-lock.yaml
git commit -m "feat(codex): scaffold codex-helper sidecar package"
```

---

## Task 2: Resolve CODEX_HOME

**Files:**
- Create: `apps/codex-helper/src/codexHome.ts`
- Test: `apps/codex-helper/test/codexHome.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, expect, test } from "bun:test"
import { homedir } from "node:os"
import { join } from "node:path"
import { codexHome } from "../src/codexHome"

const original = process.env.CODEX_HOME
afterEach(() => { process.env.CODEX_HOME = original })

test("defaults to ~/.codex", () => {
  delete process.env.CODEX_HOME
  expect(codexHome()).toBe(join(homedir(), ".codex"))
})

test("honors CODEX_HOME override", () => {
  process.env.CODEX_HOME = "/tmp/custom-codex"
  expect(codexHome()).toBe("/tmp/custom-codex")
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/codex-helper && bun test test/codexHome.test.ts`
Expected: FAIL — cannot find module `../src/codexHome`.

- [ ] **Step 3: Implement**

```ts
// apps/codex-helper/src/codexHome.ts
import { homedir } from "node:os"
import { join } from "node:path"

export function codexHome(): string {
  const override = process.env.CODEX_HOME?.trim()
  return override && override.length > 0 ? override : join(homedir(), ".codex")
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/codex-helper && bun test test/codexHome.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/codex-helper/src/codexHome.ts apps/codex-helper/test/codexHome.test.ts
git commit -m "feat(codex): resolve CODEX_HOME"
```

---

## Task 3: `status` mode — read auth.json + config.toml

**Files:**
- Create: `apps/codex-helper/src/status.ts`
- Create: `apps/codex-helper/test/fixtures/codex-logged-in/{auth.json,config.toml}`
- Create: `apps/codex-helper/test/fixtures/codex-logged-out/` (empty dir, keep with `.gitkeep`)
- Test: `apps/codex-helper/test/status.test.ts`

- [ ] **Step 1: Create fixtures**

`test/fixtures/codex-logged-in/auth.json`:
```json
{ "auth_mode": "chatgpt", "OPENAI_API_KEY": null, "tokens": { "access_token": "x", "id_token": "y" }, "last_refresh": "2026-06-23T00:00:00Z" }
```
`test/fixtures/codex-logged-in/config.toml`:
```toml
model = "gpt-5.5"
model_reasoning_effort = "medium"
```
Create `test/fixtures/codex-logged-out/.gitkeep` (empty file).

- [ ] **Step 2: Write the failing test**

```ts
import { expect, test } from "bun:test"
import { join } from "node:path"
import { readStatus } from "../src/status"

const loggedIn = join(import.meta.dir, "fixtures/codex-logged-in")
const loggedOut = join(import.meta.dir, "fixtures/codex-logged-out")

test("reports logged-in with auth mode and active model", async () => {
  const status = await readStatus(loggedIn)
  expect(status.loggedIn).toBe(true)
  expect(status.authMode).toBe("chatgpt")
  expect(status.activeModel).toBe("gpt-5.5")
  expect(status.models).toContain("gpt-5.5")
})

test("reports logged-out when auth.json is absent", async () => {
  const status = await readStatus(loggedOut)
  expect(status.loggedIn).toBe(false)
  expect(status.authMode).toBeNull()
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/codex-helper && bun test test/status.test.ts`
Expected: FAIL — cannot find module `../src/status`.

- [ ] **Step 4: Implement**

```ts
// apps/codex-helper/src/status.ts
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { codexHome } from "./codexHome"

export type CodexStatus = {
  loggedIn: boolean
  authMode: string | null
  account: string | null
  activeModel: string | null
  models: string[]
}

const KNOWN_MODELS = ["gpt-5.5", "gpt-5.5-codex"]

function activeModelFromConfig(toml: string): string | null {
  // Minimal: top-level `model = "..."` line (before any [section]).
  for (const raw of toml.split("\n")) {
    const line = raw.trim()
    if (line.startsWith("[")) break
    const match = line.match(/^model\s*=\s*"([^"]+)"/)
    if (match) return match[1]
  }
  return null
}

export async function readStatus(home: string = codexHome()): Promise<CodexStatus> {
  let auth: Record<string, unknown> | null = null
  try {
    auth = JSON.parse(await readFile(join(home, "auth.json"), "utf8"))
  } catch {
    auth = null
  }

  let toml = ""
  try {
    toml = await readFile(join(home, "config.toml"), "utf8")
  } catch {
    toml = ""
  }

  const loggedIn = !!auth && (!!auth.tokens || !!auth.OPENAI_API_KEY)
  const authMode = (auth?.auth_mode as string | undefined) ?? null
  const activeModel = activeModelFromConfig(toml)
  const models = Array.from(new Set([activeModel, ...KNOWN_MODELS].filter(Boolean) as string[]))

  return { loggedIn, authMode, account: null, activeModel, models }
}

export async function runStatus(): Promise<CodexStatus> {
  return readStatus()
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/codex-helper && bun test test/status.test.ts`
Expected: PASS

- [ ] **Step 6: Verify end-to-end against a fixture**

Run: `cd apps/codex-helper && CODEX_HOME=test/fixtures/codex-logged-in bun src/index.ts status`
Expected: prints `{"loggedIn":true,"authMode":"chatgpt",...,"activeModel":"gpt-5.5",...}`

- [ ] **Step 7: Commit**

```bash
git add apps/codex-helper/src/status.ts apps/codex-helper/test/status.test.ts apps/codex-helper/test/fixtures
git commit -m "feat(codex): status mode reads auth.json + config.toml"
```

---

## Task 4: Resolve the codex binary path

**Files:**
- Create: `apps/codex-helper/src/codexPath.ts`
- Test: `apps/codex-helper/test/codexPath.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, expect, test } from "bun:test"
import { resolveCodexBin } from "../src/codexPath"

const original = process.env.KIRA_CODEX_BIN
afterEach(() => { process.env.KIRA_CODEX_BIN = original })

test("prefers KIRA_CODEX_BIN when it points to an existing file", () => {
  process.env.KIRA_CODEX_BIN = process.execPath // bun itself: a real file
  expect(resolveCodexBin()).toBe(process.execPath)
})

test("returns undefined override when KIRA_CODEX_BIN missing/nonexistent", () => {
  process.env.KIRA_CODEX_BIN = "/no/such/codex"
  // Falls through to PATH resolution handled by the SDK; we return undefined so the SDK uses its default.
  expect(resolveCodexBin()).toBeUndefined()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/codex-helper && bun test test/codexPath.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```ts
// apps/codex-helper/src/codexPath.ts
import { existsSync } from "node:fs"
import { join } from "node:path"
import { codexHome } from "./codexHome"

/**
 * Resolve an explicit codex binary path for `codexPathOverride`.
 * Order: KIRA_CODEX_BIN (if it exists) → <CODEX_HOME>/bin/codex (if it exists) → undefined
 * (undefined lets @openai/codex-sdk find codex on PATH itself).
 */
export function resolveCodexBin(): string | undefined {
  const env = process.env.KIRA_CODEX_BIN?.trim()
  if (env && existsSync(env)) return env
  const homeBin = join(codexHome(), "bin", "codex")
  if (existsSync(homeBin)) return homeBin
  return undefined
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/codex-helper && bun test test/codexPath.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/codex-helper/src/codexPath.ts apps/codex-helper/test/codexPath.test.ts
git commit -m "feat(codex): resolve codex binary path"
```

---

## Task 5: `generate` mode via codex-sdk

**Files:**
- Create: `apps/codex-helper/src/generate.ts`
- Test: `apps/codex-helper/test/generate.test.ts`

Generation is structured so the Codex client is injectable, allowing a fake in tests (no network).

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "bun:test"
import { writeFile, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { generateWith } from "../src/generate"

test("runs a thread and returns finalResponse + usage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-gen-"))
  const payload = join(dir, "payload.json")
  await writeFile(payload, JSON.stringify({ prompt: "hello", model: "gpt-5.5" }))

  const fakeCodex = {
    startThread(opts: unknown) {
      return {
        async run(input: unknown) {
          return { finalResponse: `echo:${input}`, items: [], usage: { input_tokens: 1 } }
        },
      }
    },
  }

  const result = await generateWith(payload, () => fakeCodex as any)
  expect(result.content).toBe("echo:hello")
  expect(result.usage).toEqual({ input_tokens: 1 })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/codex-helper && bun test test/generate.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```ts
// apps/codex-helper/src/generate.ts
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { Codex } from "@openai/codex-sdk"
import { resolveCodexBin } from "./codexPath"

type GeneratePayload = { prompt: string; model?: string; outputSchema?: unknown }
export type GenerateResult = { content: string; usage: unknown }

type CodexLike = {
  startThread(opts: Record<string, unknown>): { run(input: string, turnOpts?: unknown): Promise<{ finalResponse: string; usage: unknown }> }
}

function defaultCodexFactory(): CodexLike {
  return new Codex({ codexPathOverride: resolveCodexBin() }) as unknown as CodexLike
}

export async function generateWith(
  payloadFile: string,
  factory: () => CodexLike = defaultCodexFactory,
): Promise<GenerateResult> {
  const payload: GeneratePayload = JSON.parse(await readFile(payloadFile, "utf8"))
  if (!payload.prompt?.trim()) throw new Error("Prompt is empty")

  const codex = factory()
  const thread = codex.startThread({
    model: payload.model,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    skipGitRepoCheck: true,
    networkAccessEnabled: false,
    workingDirectory: tmpdir(),
  })
  const turn = await thread.run(
    payload.prompt,
    payload.outputSchema ? { outputSchema: payload.outputSchema } : undefined,
  )
  return { content: turn.finalResponse, usage: turn.usage ?? null }
}

export async function runGenerate(payloadFile: string): Promise<GenerateResult> {
  return generateWith(payloadFile)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/codex-helper && bun test test/generate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/codex-helper/src/generate.ts apps/codex-helper/test/generate.test.ts
git commit -m "feat(codex): generate mode via codex-sdk"
```

---

## Task 6: `login` mode — stream NDJSON progress

**Files:**
- Create: `apps/codex-helper/src/login.ts`
- Create: `apps/codex-helper/test/fixtures/fake-codex.sh` (scripted stub)
- Test: `apps/codex-helper/test/login.test.ts`

The login runner spawns the codex binary, parses its stdout for an OAuth URL or device code, and emits NDJSON events. The spawned command is injectable for testing.

- [ ] **Step 1: Create the fake codex stub**

`test/fixtures/fake-codex.sh`:
```bash
#!/usr/bin/env bash
# Emulates `codex login --device-auth`: prints a verification URL + code, then success.
echo "To sign in, open https://auth.openai.com/device and enter code: ABCD-1234"
echo "Login successful."
exit 0
```
Make executable: `chmod +x apps/codex-helper/test/fixtures/fake-codex.sh`

- [ ] **Step 2: Write the failing test**

```ts
import { expect, test } from "bun:test"
import { join } from "node:path"
import { loginEvents } from "../src/login"

test("device-auth emits device_code then success", async () => {
  const events: unknown[] = []
  const code = await loginEvents(
    "device",
    undefined,
    { codexBin: join(import.meta.dir, "fixtures/fake-codex.sh") },
    (e) => events.push(e),
  )
  expect(code).toBe(0)
  expect(events).toContainEqual({ type: "device_code", verificationUrl: "https://auth.openai.com/device", userCode: "ABCD-1234" })
  expect(events.at(-1)).toEqual({ type: "success" })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/codex-helper && bun test test/login.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 4: Implement**

```ts
// apps/codex-helper/src/login.ts
import { readFile } from "node:fs/promises"
import { resolveCodexBin } from "./codexPath"

export type LoginEvent =
  | { type: "oauth_url"; url: string }
  | { type: "device_code"; verificationUrl: string; userCode: string }
  | { type: "success" }
  | { type: "error"; message: string }

type LoginMethod = "chatgpt" | "device" | "api-key"
type Options = { codexBin?: string }

function argsFor(method: LoginMethod): string[] {
  switch (method) {
    case "chatgpt": return ["login"]
    case "device": return ["login", "--device-auth"]
    case "api-key": return ["login", "--api-key"]
  }
}

function parseLine(line: string): LoginEvent | null {
  const url = line.match(/https?:\/\/\S*device\S*/)?.[0] ?? line.match(/https?:\/\/auth\.openai\.com\/\S+/)?.[0]
  const code = line.match(/code:?\s*([A-Z0-9]{4}-?[A-Z0-9]{4})/i)?.[1]
  if (code && url) return { type: "device_code", verificationUrl: url.replace(/\/device.*/, "/device"), userCode: code }
  if (url && /localhost:1455|callback|sign in/i.test(line)) return { type: "oauth_url", url }
  if (/login successful|signed in|logged in/i.test(line)) return { type: "success" }
  return null
}

export async function loginEvents(
  method: LoginMethod,
  payloadFile: string | undefined,
  options: Options,
  emit: (event: LoginEvent) => void,
): Promise<number> {
  const codexBin = options.codexBin ?? resolveCodexBin() ?? "codex"
  let apiKey: string | undefined
  if (method === "api-key") {
    if (!payloadFile) throw new Error("api-key login requires a payload file")
    apiKey = (JSON.parse(await readFile(payloadFile, "utf8")).apiKey as string | undefined)?.trim()
    if (!apiKey) throw new Error("api-key login payload missing apiKey")
  }

  const proc = Bun.spawn([codexBin, ...argsFor(method)], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: method === "api-key" ? "pipe" : "ignore",
  })
  if (method === "api-key" && apiKey) {
    proc.stdin!.write(apiKey + "\n")
    proc.stdin!.end()
  }

  let sawSuccess = false
  const reader = proc.stdout.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      const event = parseLine(line)
      if (event) {
        if (event.type === "success") sawSuccess = true
        emit(event)
      }
    }
  }
  const code = await proc.exited
  if (code === 0 && !sawSuccess) emit({ type: "success" })
  if (code !== 0) emit({ type: "error", message: (await new Response(proc.stderr).text()).trim() || `codex exited ${code}` })
  return code
}

export async function runLogin(method: string | undefined, payloadFile?: string): Promise<void> {
  if (method !== "chatgpt" && method !== "device" && method !== "api-key") {
    throw new Error(`Unknown login method: ${method ?? "<none>"}`)
  }
  const code = await loginEvents(method, payloadFile, {}, (event) => console.log(JSON.stringify(event)))
  process.exit(code)
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/codex-helper && bun test test/login.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/codex-helper/src/login.ts apps/codex-helper/test/login.test.ts apps/codex-helper/test/fixtures/fake-codex.sh
git commit -m "feat(codex): streaming login mode (chatgpt/device/api-key)"
```

---

## Task 7: `logout` mode

**Files:**
- Create: `apps/codex-helper/src/logout.ts`
- Test: `apps/codex-helper/test/logout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "bun:test"
import { join } from "node:path"
import { logoutWith } from "../src/logout"

test("returns ok when codex logout exits 0", async () => {
  const result = await logoutWith(join(import.meta.dir, "fixtures/fake-codex.sh"))
  expect(result.ok).toBe(true)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/codex-helper && bun test test/logout.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

```ts
// apps/codex-helper/src/logout.ts
import { resolveCodexBin } from "./codexPath"

export async function logoutWith(codexBin: string = resolveCodexBin() ?? "codex"): Promise<{ ok: boolean }> {
  const proc = Bun.spawn([codexBin, "logout"], { stdout: "ignore", stderr: "pipe" })
  const code = await proc.exited
  if (code !== 0) throw new Error((await new Response(proc.stderr).text()).trim() || `codex logout exited ${code}`)
  return { ok: true }
}

export async function runLogout(): Promise<{ ok: boolean }> {
  return logoutWith()
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/codex-helper && bun test test/logout.test.ts`
Expected: PASS

- [ ] **Step 5: Run the whole sidecar suite**

Run: `cd apps/codex-helper && bun test`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add apps/codex-helper/src/logout.ts apps/codex-helper/test/logout.test.ts
git commit -m "feat(codex): logout mode"
```

---

## Task 8: Build pipeline — Bun compile + bundle codex binary

**Files:**
- Create: `apps/codex-helper/scripts/build.ts`
- Modify: `apps/desktop/src-tauri/build.rs`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Write the build script**

```ts
// apps/codex-helper/scripts/build.ts
// Compiles the sidecar and copies the platform codex binary next to it,
// both named with the Rust target triple for Tauri externalBin.
import { $ } from "bun"
import { existsSync } from "node:fs"
import { mkdir, copyFile, chmod } from "node:fs/promises"
import { join } from "node:path"

const triple = process.env.TARGET_TRIPLE ?? "aarch64-apple-darwin"
const binDir = join(import.meta.dir, "..", "..", "desktop", "src-tauri", "binaries")
await mkdir(binDir, { recursive: true })

const helperOut = join(binDir, `kira-codex-helper-${triple}`)
await $`bun build ./src/index.ts --compile --outfile ${helperOut}`
await chmod(helperOut, 0o755)

// @openai/codex ships the native binary under node_modules/@openai/codex/bin/codex (or vendor/).
const candidates = [
  join(import.meta.dir, "..", "node_modules", "@openai", "codex", "bin", "codex"),
  join(import.meta.dir, "..", "node_modules", "@openai", "codex", "vendor", "codex"),
]
const codexSrc = candidates.find(existsSync)
if (!codexSrc) throw new Error(`codex binary not found in: ${candidates.join(", ")}`)
const codexOut = join(binDir, `codex-${triple}`)
await copyFile(codexSrc, codexOut)
await chmod(codexOut, 0o755)
console.log(`Built ${helperOut} and ${codexOut}`)
```

> Note: confirm the exact codex binary location after `pnpm install` — run `ls apps/codex-helper/node_modules/@openai/codex/bin` (the `bin/codex.js` shim may resolve a real binary into a cache/`vendor` dir on first run). Adjust `candidates` to the actual path; if the package only ships a JS shim that downloads on first run, run `apps/codex-helper/node_modules/.bin/codex --version` once before building so the native binary is materialized, then point `candidates` at it.

- [ ] **Step 2: Run the build manually to verify it produces both binaries**

Run: `cd apps/codex-helper && pnpm install && pnpm build && ls -la ../desktop/src-tauri/binaries`
Expected: `kira-codex-helper-aarch64-apple-darwin` and `codex-aarch64-apple-darwin` present and executable.

- [ ] **Step 3: Smoke-test the compiled helper**

Run: `cd apps/desktop/src-tauri/binaries && CODEX_HOME="$HOME/.codex" ./kira-codex-helper-aarch64-apple-darwin status`
Expected: prints a `CodexStatus` JSON reflecting the real local login.

- [ ] **Step 4: Register both binaries in `tauri.conf.json`**

In `apps/desktop/src-tauri/tauri.conf.json`, extend `bundle.externalBin`:
```json
"externalBin": [
  "binaries/kira-vision-ocr-helper",
  "binaries/kira-foundation-models-helper",
  "binaries/kira-natural-language-helper",
  "binaries/kira-codex-helper",
  "binaries/codex"
]
```

- [ ] **Step 5: Add a best-effort build hook in `build.rs`**

In `apps/desktop/src-tauri/build.rs`, before `tauri_build::build()`, add a call that runs the Bun build when Bun is available (so a clean checkout with Bun rebuilds the sidecar; otherwise the committed binaries are used):

```rust
fn build_node_helper() {
    #[cfg(target_os = "macos")]
    {
        use std::{env, path::PathBuf, process::Command};
        let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest dir"));
        let helper_dir = manifest_dir.join("../../codex-helper");
        println!("cargo:rerun-if-changed={}", helper_dir.join("src").display());
        let status = Command::new("bun")
            .current_dir(&helper_dir)
            .args(["run", "scripts/build.ts"])
            .status();
        match status {
            Ok(s) if s.success() => {}
            _ => println!("cargo:warning=codex-helper Bun build skipped (Bun unavailable or build failed); using committed binaries"),
        }
    }
}
```
Call `build_node_helper();` as the first line of `main()` in `build.rs`.

- [ ] **Step 6: Commit (including the built binaries, matching the existing committed sidecars)**

```bash
git add apps/codex-helper/scripts/build.ts apps/desktop/src-tauri/build.rs apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/binaries/kira-codex-helper-aarch64-apple-darwin apps/desktop/src-tauri/binaries/codex-aarch64-apple-darwin
git commit -m "build(codex): compile sidecar + bundle codex binary as externalBin"
```

---

## Task 9: Rust — `run_codex_helper` + `codex_status_native`

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs` (structs near line 290–328; helpers near the other sidecar fns ~1900; tests near line 4018)

- [ ] **Step 1: Add the status struct (near the other AI structs, ~line 314)**

```rust
#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CodexStatus {
    logged_in: bool,
    auth_mode: Option<String>,
    account: Option<String>,
    active_model: Option<String>,
    #[serde(default)]
    models: Vec<String>,
}
```

- [ ] **Step 2: Add `run_codex_helper` + `codex_status_native` (near `bundled_sidecar_path`, ~line 1900)**

```rust
fn codex_bin_path() -> Option<PathBuf> {
    bundled_sidecar_path("codex")
}

fn run_codex_helper(args: &[&std::ffi::OsStr], stdin_data: Option<&str>) -> Result<Output, String> {
    let helper = bundled_sidecar_path("kira-codex-helper")
        .ok_or_else(|| "Codex helper binary not found".to_string())?;
    let mut command = Command::new(&helper);
    command.args(args);
    if let Some(bin) = codex_bin_path() {
        command.env("KIRA_CODEX_BIN", bin);
    }
    if stdin_data.is_some() {
        command.stdin(std::process::Stdio::piped());
    }
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    let mut child = command.spawn().map_err(|e| format!("Unable to run Codex helper: {e}"))?;
    if let Some(data) = stdin_data {
        use std::io::Write;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(data.as_bytes()).map_err(|e| format!("Codex helper stdin error: {e}"))?;
        }
    }
    child.wait_with_output().map_err(|e| format!("Codex helper failed: {e}"))
}

fn codex_status_native() -> Result<CodexStatus, String> {
    let output = run_codex_helper(&[std::ffi::OsStr::new("status")], None)?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid Codex status output: {e}"))
}
```

- [ ] **Step 3: Write the failing test (near line 4018)**

```rust
#[test]
fn codex_status_parses_helper_json() {
    let json = br#"{"loggedIn":true,"authMode":"chatgpt","account":null,"activeModel":"gpt-5.5","models":["gpt-5.5"]}"#;
    let status: CodexStatus = serde_json::from_slice(json).expect("parse");
    assert!(status.logged_in);
    assert_eq!(status.auth_mode.as_deref(), Some("chatgpt"));
    assert_eq!(status.active_model.as_deref(), Some("gpt-5.5"));
    assert_eq!(status.models, vec!["gpt-5.5".to_string()]);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/desktop/src-tauri && cargo test codex_status_parses_helper_json`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(codex): rust helper runner + status parsing"
```

---

## Task 10: Rust — wire `codex` into generation, test, and model-list

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs` (`generate_ai_text_native` ~2224; `test_ai_provider_native` ~2103; `list_ai_models_native` ~2158; tests ~4018)

- [ ] **Step 1: Add `generate_codex_text` (near `generate_ai_text_native`)**

```rust
fn generate_codex_text(provider: &AiProviderTestRequest, prompt: &str) -> Result<String, String> {
    let model = generation_model(provider, "gpt-5.5");
    let payload = serde_json::json!({ "prompt": prompt, "model": model }).to_string();
    let id = timestamp_millis();
    let payload_path = std::env::temp_dir().join(format!("kira-codex-gen-{id}.json"));
    fs::write(&payload_path, &payload).map_err(|e| format!("Unable to write Codex payload: {e}"))?;

    let output = run_codex_helper(
        &[std::ffi::OsStr::new("generate"), payload_path.as_os_str()],
        None,
    );
    let _ = fs::remove_file(&payload_path);
    let output = output?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid Codex output: {e}"))?;
    value
        .get("content")
        .and_then(|c| c.as_str())
        .map(ToString::to_string)
        .ok_or_else(|| "Codex returned no content".to_string())
}
```

- [ ] **Step 2: Add the `"codex"` match arm in `generate_ai_text_native` (line ~2224 match block)**

Insert before the `"openai" | "openrouter" | ...` arm:
```rust
        "codex" => generate_codex_text(provider, clean_prompt)?,
```

- [ ] **Step 3: Add the `codex` branch to `test_ai_provider_native` (after the `local`/`apple_foundation` early return, ~line 2107)**

```rust
    if provider.provider_type == "codex" {
        return match codex_status_native() {
            Ok(status) if status.logged_in => Ok(AiProviderTestResult {
                connected: true,
                status: "connected".to_string(),
                message: format!(
                    "Logged in ({}) · {}",
                    status.auth_mode.as_deref().unwrap_or("unknown"),
                    status.active_model.as_deref().unwrap_or("default model")
                ),
            }),
            Ok(_) => Ok(AiProviderTestResult {
                connected: false,
                status: "unavailable".to_string(),
                message: "Not signed in. Use Sign in with ChatGPT.".to_string(),
            }),
            Err(error) => Ok(AiProviderTestResult {
                connected: false,
                status: "unavailable".to_string(),
                message: error,
            }),
        };
    }
```

- [ ] **Step 4: Add the `codex` branch to `list_ai_models_native` (after the `apple_foundation` branch, ~line 2162)**

```rust
    if provider.provider_type == "codex" {
        let status = codex_status_native()?;
        return Ok(status.models);
    }
```

- [ ] **Step 5: Write the failing test for the generate path (near line 4018)**

```rust
#[test]
fn generate_codex_text_extracts_content_field() {
    // Parsing helper for the helper's JSON contract (the network path is exercised manually).
    let stdout = br#"{"content":"hello from codex","usage":null}"#;
    let value: serde_json::Value = serde_json::from_slice(stdout).unwrap();
    assert_eq!(value.get("content").and_then(|c| c.as_str()), Some("hello from codex"));
}
```

- [ ] **Step 6: Build + run tests**

Run: `cd apps/desktop/src-tauri && cargo test`
Expected: PASS (new tests + existing suite). Then `cargo build` to confirm the match arms compile.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(codex): wire codex provider into generate/test/list-models"
```

---

## Task 11: Rust — login/logout commands with streamed events

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs` (commands; `invoke_handler` ~3521; managed state)

- [ ] **Step 1: Add managed state for the in-flight login child (near the top of `lib.rs`, after imports)**

```rust
use std::sync::Mutex;

#[derive(Default)]
struct CodexLoginState {
    child: Mutex<Option<std::process::Child>>,
}
```

- [ ] **Step 2: Add the `codex_login` command (with the other `#[tauri::command]` fns, ~line 480)**

```rust
#[tauri::command]
fn codex_login(
    app: AppHandle,
    state: tauri::State<'_, CodexLoginState>,
    method: String,
    api_key: Option<String>,
) -> Result<(), String> {
    use std::io::{BufRead, BufReader, Write};

    if !matches!(method.as_str(), "chatgpt" | "device" | "api-key") {
        return Err(format!("Unknown login method: {method}"));
    }

    let helper = bundled_sidecar_path("kira-codex-helper")
        .ok_or_else(|| "Codex helper binary not found".to_string())?;
    let mut command = Command::new(&helper);
    command.arg("login").arg(&method);

    // api-key: write the key to a temp payload file (never argv) and pass its path.
    let mut payload_path: Option<PathBuf> = None;
    if method == "api-key" {
        let key = api_key.unwrap_or_default();
        if key.trim().is_empty() {
            return Err("API key is empty".to_string());
        }
        let path = std::env::temp_dir().join(format!("kira-codex-login-{}.json", timestamp_millis()));
        fs::write(&path, serde_json::json!({ "apiKey": key }).to_string())
            .map_err(|e| format!("Unable to write login payload: {e}"))?;
        command.arg(&path);
        payload_path = Some(path);
    }

    if let Some(bin) = codex_bin_path() {
        command.env("KIRA_CODEX_BIN", bin);
    }
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    let mut child = command.spawn().map_err(|e| format!("Unable to start login: {e}"))?;
    let stdout = child.stdout.take().ok_or_else(|| "no stdout".to_string())?;
    *state.child.lock().unwrap() = Some(child);

    // Forward each NDJSON line to the webview.
    let reader = BufReader::new(stdout);
    let mut last_error: Option<String> = None;
    for line in reader.lines() {
        let line = match line { Ok(l) => l, Err(_) => break };
        if line.trim().is_empty() { continue }
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) {
            if value.get("type").and_then(|t| t.as_str()) == Some("error") {
                last_error = value.get("message").and_then(|m| m.as_str()).map(ToString::to_string);
            }
            let _ = app.emit("codex://login", value);
        }
    }

    let status = {
        let mut guard = state.child.lock().unwrap();
        match guard.take() {
            Some(mut c) => c.wait().map_err(|e| format!("login wait failed: {e}"))?,
            None => return Err("Login was cancelled".to_string()),
        }
    };
    if let Some(path) = payload_path { let _ = fs::remove_file(path); }

    if status.success() { Ok(()) } else { Err(last_error.unwrap_or_else(|| "Login failed".to_string())) }
}

#[tauri::command]
fn codex_cancel_login(state: tauri::State<'_, CodexLoginState>) -> Result<(), String> {
    if let Some(mut child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command]
fn codex_logout() -> Result<(), String> {
    let output = run_codex_helper(&[std::ffi::OsStr::new("logout")], None)?;
    if output.status.success() { Ok(()) }
    else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
}
```

> `app.emit` requires `use tauri::Emitter;` — add it to the imports if not already present.

- [ ] **Step 3: Register state + commands**

In the builder chain (where `.invoke_handler(...)` is, ~line 3521), add `.manage(CodexLoginState::default())` before `.invoke_handler`, and append the three commands to `generate_handler![...]`:
```rust
            codex_login,
            codex_cancel_login,
            codex_logout
```
(add a comma after the previous last entry `update_capture_context`).

- [ ] **Step 4: Build to verify it compiles**

Run: `cd apps/desktop/src-tauri && cargo build`
Expected: compiles cleanly (resolve any missing `use tauri::Emitter;`).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(codex): login/logout commands with streamed progress events"
```

---

## Task 12: Frontend — provider type, profile, labels, help, note

**Files:**
- Modify: `apps/desktop/src/main.tsx` (`AiProviderType` line 415; `aiProviderTypeLabels` 885; `providerConnectionNotes` 916; `aiProviderKeyHelp` 944; `defaultAiProviderProfiles` ~1018; `aiProviderTemplates` ~1094)

- [ ] **Step 1: Add `'codex'` to `AiProviderType` (line 415)**

```ts
type AiProviderType =
  | 'apple_foundation'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'ollama'
  | 'lm_studio'
  | 'custom_openai_compatible'
  | 'codex'
```

- [ ] **Step 2: Add the label (line 885 `aiProviderTypeLabels`)**

```ts
  codex: 'Codex',
```

- [ ] **Step 3: Add a default profile (in `defaultAiProviderProfiles`, after the `lm-studio` entry ~line 1091)**

```ts
  {
    id: 'codex',
    type: 'codex',
    name: 'Codex CLI (ChatGPT login)',
    authMode: 'oauth',
    model: 'gpt-5.5',
    status: 'unavailable',
    defaultFor: ['generate_outline', 'generate_node', 'summarize_diagram'],
  },
```

- [ ] **Step 4: Add a template (in `aiProviderTemplates`, after `lm_studio` ~line 1148)**

```ts
  codex: {
    type: 'codex',
    name: 'Codex CLI (ChatGPT login)',
    authMode: 'oauth',
    model: 'gpt-5.5',
    status: 'unavailable',
    defaultFor: ['generate_outline', 'generate_node', 'summarize_diagram'],
  },
```

- [ ] **Step 5: Make `aiProviderKeyHelp` return null for codex (line 944 switch)**

```ts
    case 'codex':
      return null
```

- [ ] **Step 6: Add a connection note (in `providerConnectionNotes`, ~line 916)**

```ts
  {
    id: 'codex',
    title: 'Codex (ChatGPT login)',
    providerId: 'codex',
    truth: 'KIRA can sign you in with ChatGPT (or reuse an existing Codex login). Auth is owned by the Codex CLI; billing follows your ChatGPT/Codex plan.',
    action: 'Sign in with ChatGPT',
    href: '',
  },
```

- [ ] **Step 7: Type-check**

Run: `cd apps/desktop && pnpm exec tsc --noEmit`
Expected: no new errors. (If `aiProviderTypeLabels` is a `Record<AiProviderType, string>`, the new key is required and now present.)

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/main.tsx
git commit -m "feat(codex): add codex provider profile to frontend"
```

---

## Task 13: Frontend — IPC wrappers for login/logout + progress events

**Files:**
- Modify: `apps/desktop/src/main.tsx` (IPC wrapper section, ~line 13614–13709)

- [ ] **Step 1: Add the wrappers (next to the other `invoke(...)` provider wrappers, ~line 13699)**

```ts
type CodexLoginEvent =
  | { type: 'oauth_url'; url: string }
  | { type: 'device_code'; verificationUrl: string; userCode: string }
  | { type: 'success' }
  | { type: 'error'; message: string }

function requestCodexLogin(method: 'chatgpt' | 'device' | 'api-key', apiKey?: string) {
  return invoke<void>('codex_login', { method, apiKey })
}

function cancelCodexLogin() {
  return invoke<void>('codex_cancel_login')
}

function codexLogout() {
  return invoke<void>('codex_logout')
}

function onCodexLoginProgress(callback: (event: CodexLoginEvent) => void) {
  return listen<CodexLoginEvent>('codex://login', (event) => callback(event.payload))
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/desktop && pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/main.tsx
git commit -m "feat(codex): frontend IPC wrappers for codex login/logout"
```

---

## Task 14: Frontend — login UI in the provider panel

**Files:**
- Modify: `apps/desktop/src/main.tsx` (the provider settings panel component that renders per-provider controls)

> Locate the component that renders a selected provider's settings (it uses `aiProviderKeyHelp`, the test button, and `providerConnectionNotes`). Add a Codex-specific block shown when `provider.type === 'codex'`, replacing the API-key field.

- [ ] **Step 1: Add login state + a progress subscription in that component**

```tsx
const [codexLoginBusy, setCodexLoginBusy] = useState(false)
const [codexLoginEvent, setCodexLoginEvent] = useState<CodexLoginEvent | null>(null)

useEffect(() => {
  if (provider.type !== 'codex') return
  let unlisten: (() => void) | undefined
  void onCodexLoginProgress((event) => setCodexLoginEvent(event)).then((u) => { unlisten = u })
  return () => unlisten?.()
}, [provider.type])

async function startCodexLogin(method: 'chatgpt' | 'device' | 'api-key', apiKey?: string) {
  setCodexLoginBusy(true)
  setCodexLoginEvent(null)
  try {
    await requestCodexLogin(method, apiKey)
    await refreshProviderStatus(provider) // re-run test_ai_provider/list_ai_models for this provider
  } catch (error) {
    setCodexLoginEvent({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  } finally {
    setCodexLoginBusy(false)
  }
}
```

> `refreshProviderStatus` should call the existing test/model-list wrappers used by the panel's "Test" button and update the provider's `status`/`model`. Reuse whatever the Test button already calls (e.g. `testAiProvider`/`listAiModels`).

- [ ] **Step 2: Render the Codex login block (where the key field would render)**

```tsx
{provider.type === 'codex' ? (
  <div className="codex-login">
    {provider.status === 'connected' ? (
      <div className="codex-login__signed-in">
        <span>Signed in · {provider.lastMessage ?? 'Codex ready'}</span>
        <button type="button" onClick={() => codexLogout().then(() => refreshProviderStatus(provider))}>
          Sign out
        </button>
      </div>
    ) : (
      <div className="codex-login__actions">
        <button type="button" disabled={codexLoginBusy} onClick={() => startCodexLogin('chatgpt')}>
          {codexLoginBusy ? 'Waiting for browser…' : 'Sign in with ChatGPT'}
        </button>
        <button type="button" disabled={codexLoginBusy} onClick={() => startCodexLogin('device')}>
          Use a sign-in code
        </button>
        <details>
          <summary>Use an API key</summary>
          <CodexApiKeyField busy={codexLoginBusy} onSubmit={(key) => startCodexLogin('api-key', key)} />
        </details>
        {codexLoginBusy && <button type="button" onClick={() => cancelCodexLogin()}>Cancel</button>}
      </div>
    )}
    {codexLoginEvent?.type === 'device_code' && (
      <p className="codex-login__device">
        Open <a href={codexLoginEvent.verificationUrl} target="_blank" rel="noreferrer">{codexLoginEvent.verificationUrl}</a>{' '}
        and enter code <code>{codexLoginEvent.userCode}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(codexLoginEvent.userCode)}>Copy</button>
      </p>
    )}
    {codexLoginEvent?.type === 'error' && <p className="codex-login__error">{codexLoginEvent.message}</p>}
  </div>
) : (
  /* existing API-key field JSX stays here for non-codex providers */
  null
)}
```

- [ ] **Step 3: Add the small `CodexApiKeyField` component (near other small components in the file)**

```tsx
function CodexApiKeyField({ busy, onSubmit }: { busy: boolean; onSubmit: (key: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="codex-login__apikey">
      <input
        type="password"
        value={value}
        placeholder="sk-..."
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="button" disabled={busy || value.trim().length === 0} onClick={() => onSubmit(value.trim())}>
        Save key
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Add minimal styles for the new classes**

In `apps/desktop/src/styles.css`, add layout-only rules (reuse existing tokens/buttons; keep it consistent with the surrounding settings panel):
```css
.codex-login__actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.codex-login__device { display: flex; gap: 8px; align-items: center; font-size: 13px; }
.codex-login__error { color: var(--danger, #d98779); font-size: 13px; }
.codex-login__apikey { display: flex; gap: 8px; margin-top: 8px; }
```

- [ ] **Step 5: Type-check + build the frontend**

Run: `cd apps/desktop && pnpm exec tsc --noEmit && pnpm build`
Expected: no errors; bundle builds.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/main.tsx apps/desktop/src/styles.css
git commit -m "feat(codex): login UI in provider settings panel"
```

---

## Task 15: Frontend — logged-out mid-task prompt + auto-retry

**Files:**
- Modify: `apps/desktop/src/main.tsx` (the function that runs an AI task via the selected provider and calls `generate_ai_text`)

> Find where a routed task calls the `generate_ai_text` wrapper (it returns `AiGenerationResult`). Wrap the codex path so a not-signed-in failure surfaces the sign-in prompt and retries.

- [ ] **Step 1: Add a helper that recognizes the logged-out error and retries**

```ts
function isCodexLoggedOutError(message: string): boolean {
  return /not signed in|sign in with chatgpt|not logged in/i.test(message)
}

async function generateWithCodexRetry(
  provider: AiProviderProfile,
  prompt: string,
  promptSignIn: () => Promise<boolean>, // shows the Codex sign-in UI; resolves true on success
): Promise<AiGenerationResult> {
  try {
    return await generateAiText(provider, prompt) // existing wrapper at ~line 13699
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (provider.type === 'codex' && isCodexLoggedOutError(message)) {
      const signedIn = await promptSignIn()
      if (signedIn) return await generateAiText(provider, prompt)
    }
    throw error
  }
}
```

- [ ] **Step 2: Route codex generation through the retry wrapper**

At the call site that generates text for a task, when the resolved provider is `codex`, call `generateWithCodexRetry(provider, prompt, promptSignIn)` instead of `generateAiText(provider, prompt)`. `promptSignIn` opens the provider settings to the Codex panel (or a modal) and resolves `true` once `requestCodexLogin('chatgpt')` succeeds. Reuse the `startCodexLogin` flow from Task 14 (lift it to a shared handler or surface the settings panel focused on the codex provider).

- [ ] **Step 3: Type-check**

Run: `cd apps/desktop && pnpm exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/main.tsx
git commit -m "feat(codex): prompt sign-in and auto-retry on logged-out codex task"
```

---

## Task 16: End-to-end verification

**Files:** none (manual verification using the run/verify skills)

- [ ] **Step 1: Build the full app**

Run: `pnpm build` (root) then `cd apps/desktop/src-tauri && cargo build`
Expected: both succeed; `binaries/kira-codex-helper-*` and `binaries/codex-*` present.

- [ ] **Step 2: Launch and verify (use the `run` skill / `pnpm dev`)**

- [ ] Provider list shows **Codex**. With an existing `~/.codex` login, status shows "Logged in (chatgpt) · gpt-5.5".
- [ ] Temporarily move `~/.codex/auth.json` aside → status flips to signed-out; "Sign in with ChatGPT" launches the browser flow; on completion status flips back. Restore the file afterward.
- [ ] "Use a sign-in code" surfaces a verification URL + code.
- [ ] A `generate_node` task routed to Codex returns text.
- [ ] "Sign out" clears status.

- [ ] **Step 3: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "test(codex): end-to-end verification fixes"
```

---

## Self-Review

**Spec coverage:**
- Reuse existing login → Tasks 3, 9, 10 (status + test branch). ✓
- Initiate login (ChatGPT/device/api-key) → Tasks 6, 11, 14. ✓
- SDK has no login API; drive CLI → Tasks 6, 8 (bundle codex), 11. ✓
- Generation via codex-sdk → Tasks 5, 10. ✓
- Auth + model/config scope only (no history) → Tasks 3, 10; no session-history tasks (intentional). ✓
- Bundle `@openai/codex` binary, `codexPathOverride`/`KIRA_CODEX_BIN` → Tasks 4, 8, 9. ✓
- Reuse `authMode: 'oauth'` → Task 12. ✓
- Logged-out → prompt + retry → Task 15. ✓
- Streaming NDJSON → `codex://login` Tauri event → Tasks 6, 11, 13, 14. ✓
- Tests mirroring `apple_vision_ocr_process_prefers_compiled_helper` → Tasks 9, 10. ✓

**Type consistency:** `CodexStatus`/`CodexLoginEvent` field names match across sidecar (`status.ts`/`login.ts`), Rust (`CodexStatus`, emitted JSON), and frontend (`CodexLoginEvent`). Sidecar emits camelCase (`loggedIn`, `verificationUrl`, `userCode`); Rust `CodexStatus` uses `#[serde(rename_all = "camelCase")]`; frontend types use the same camelCase. Command names (`codex_login`, `codex_cancel_login`, `codex_logout`) and event channel (`codex://login`) are identical in Rust registration and frontend wrappers. ✓

**Open implementation detail to confirm during Task 8:** the exact on-disk path of the `@openai/codex` native binary after `pnpm install` (`bin/` vs `vendor/` vs a first-run cache). The build script lists candidates and the note explains how to materialize/locate it.

// Compiles the sidecar to a standalone binary, named with the Rust target
// triple for Tauri externalBin.
//
// This does NOT vendor the `codex` CLI itself — KIRA detects the user's own
// install via PATH (see codex_bin_path() in src-tauri/src/lib.rs, mirroring
// the same pattern already used for Claude Code) rather than shipping a copy
// of OpenAI's ~240MB native binary inside KIRA.app.
import { $ } from "bun"
import { chmod } from "node:fs/promises"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"

const triple = process.env.TARGET_TRIPLE ?? "aarch64-apple-darwin"
const binDir = join(import.meta.dir, "..", "..", "desktop", "src-tauri", "binaries")
await mkdir(binDir, { recursive: true })

const helperOut = join(binDir, `kira-codex-helper-${triple}`)
await $`bun build ./src/index.ts --compile --outfile ${helperOut}`
await chmod(helperOut, 0o755)

console.log(`Built ${helperOut}`)

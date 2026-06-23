// Compiles the sidecar and copies the platform codex binary next to it,
// both named with the Rust target triple for Tauri externalBin.
//
// The real native codex CLI is NOT shipped in @openai/codex itself; that
// package only contains a JS launcher (bin/codex.js). The launcher execs a
// platform-specific native binary that lives in a per-platform optional
// dependency, e.g. @openai/codex-darwin-arm64, under:
//   <pkg>/vendor/<triple>/bin/codex
// (Mach-O arm64, ~249 MB for darwin-arm64). We resolve that package the same
// way codex.js does (require.resolve on "<platformPackage>/package.json"),
// with hard-coded fallbacks into the pnpm virtual store for robustness.
import { $ } from "bun"
import { existsSync } from "node:fs"
import { mkdir, copyFile, chmod } from "node:fs/promises"
import { join } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

const triple = process.env.TARGET_TRIPLE ?? "aarch64-apple-darwin"
const binDir = join(import.meta.dir, "..", "..", "desktop", "src-tauri", "binaries")
await mkdir(binDir, { recursive: true })

const helperOut = join(binDir, `kira-codex-helper-${triple}`)
await $`bun build ./src/index.ts --compile --outfile ${helperOut}`
await chmod(helperOut, 0o755)

// Map Rust target triple -> @openai per-platform package that ships the
// native codex binary under vendor/<triple>/bin/codex (matches codex.js).
const PLATFORM_PACKAGE_BY_TARGET: Record<string, string> = {
  "x86_64-unknown-linux-musl": "@openai/codex-linux-x64",
  "aarch64-unknown-linux-musl": "@openai/codex-linux-arm64",
  "x86_64-apple-darwin": "@openai/codex-darwin-x64",
  "aarch64-apple-darwin": "@openai/codex-darwin-arm64",
  "x86_64-pc-windows-msvc": "@openai/codex-win32-x64",
  "aarch64-pc-windows-msvc": "@openai/codex-win32-arm64",
}
const platformPackage = PLATFORM_PACKAGE_BY_TARGET[triple]
const binName = triple.includes("windows") ? "codex.exe" : "codex"

const candidates: string[] = []

// 1) Resolve the platform package the same way the real launcher does.
if (platformPackage) {
  try {
    const pkgJson = require.resolve(`${platformPackage}/package.json`)
    candidates.push(join(pkgJson, "..", "vendor", triple, "bin", binName))
  } catch {
    /* not resolvable here; fall through to store-path fallbacks */
  }
}

// 2) Fallbacks into the pnpm virtual store at the workspace root. pnpm keeps
//    the per-platform package only under node_modules/.pnpm/, not symlinked
//    into the local @openai scope.
const codexVersion = "0.142.0"
const repoRoot = join(import.meta.dir, "..", "..", "..")
if (platformPackage) {
  const platformSuffix = platformPackage.replace("@openai/", "") // e.g. codex-darwin-arm64
  candidates.push(
    join(
      repoRoot,
      "node_modules",
      ".pnpm",
      `@openai+codex@${codexVersion}-${platformSuffix.replace("codex-", "")}`,
      "node_modules",
      "@openai",
      "codex",
      "vendor",
      triple,
      "bin",
      binName,
    ),
  )
}
// 3) Generic vendor fallback relative to the @openai/codex package itself.
candidates.push(
  join(import.meta.dir, "..", "node_modules", "@openai", "codex", "vendor", triple, "bin", binName),
)

const codexSrc = candidates.find(existsSync)
if (!codexSrc) throw new Error(`codex binary not found in:\n  ${candidates.join("\n  ")}`)
const codexOut = join(binDir, `codex-${triple}`)
await copyFile(codexSrc, codexOut)
await chmod(codexOut, 0o755)
console.log(`Built ${helperOut}\n  and ${codexOut}\n  (codex src: ${codexSrc})`)

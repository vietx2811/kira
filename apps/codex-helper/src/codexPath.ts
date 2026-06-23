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

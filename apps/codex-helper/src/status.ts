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

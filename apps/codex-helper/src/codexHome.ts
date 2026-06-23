import { homedir } from "node:os"
import { join } from "node:path"

export function codexHome(): string {
  const override = process.env.CODEX_HOME?.trim()
  return override && override.length > 0 ? override : join(homedir(), ".codex")
}

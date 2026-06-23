import { afterEach, expect, test } from "bun:test"
import { resolveCodexBin } from "../src/codexPath"

const originalBin = process.env.KIRA_CODEX_BIN
const originalHome = process.env.CODEX_HOME
afterEach(() => {
  process.env.KIRA_CODEX_BIN = originalBin
  process.env.CODEX_HOME = originalHome
})

test("prefers KIRA_CODEX_BIN when it points to an existing file", () => {
  process.env.KIRA_CODEX_BIN = process.execPath // bun itself: a real file
  expect(resolveCodexBin()).toBe(process.execPath)
})

test("returns undefined override when KIRA_CODEX_BIN missing/nonexistent", () => {
  process.env.KIRA_CODEX_BIN = "/no/such/codex"
  // Pin CODEX_HOME to a guaranteed-nonexistent dir so <CODEX_HOME>/bin/codex
  // cannot exist and the test stays hermetic regardless of the runner's ~/.codex.
  process.env.CODEX_HOME = "/tmp/kira-no-codex-home-7f3a9c"
  // Falls through to PATH resolution handled by the SDK; we return undefined so the SDK uses its default.
  expect(resolveCodexBin()).toBeUndefined()
})

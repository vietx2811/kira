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

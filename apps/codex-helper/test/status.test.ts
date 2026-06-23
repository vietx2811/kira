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

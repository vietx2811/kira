import { expect, test } from "bun:test"
import { join } from "node:path"
import { loginEvents, type LoginEvent } from "../src/login"

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

test("chatgpt oauth: parses the URL that codex prints on stderr", async () => {
  const events: LoginEvent[] = []
  const code = await loginEvents(
    "chatgpt",
    undefined,
    { codexBin: join(import.meta.dir, "fixtures/fake-codex-stderr.sh") },
    (e) => events.push(e),
  )
  expect(code).toBe(0)
  expect(events.some((e) => e.type === "oauth_url")).toBe(true)
  expect(events.at(-1)).toEqual({ type: "success" })
})

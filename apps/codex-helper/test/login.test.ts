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

import { expect, test } from "bun:test"
import { join } from "node:path"
import { logoutWith } from "../src/logout"

test("returns ok when codex logout exits 0", async () => {
  const result = await logoutWith(join(import.meta.dir, "fixtures/fake-codex.sh"))
  expect(result.ok).toBe(true)
})

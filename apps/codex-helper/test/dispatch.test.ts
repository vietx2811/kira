import { expect, test } from "bun:test"

test("unknown mode exits non-zero with JSON error", async () => {
  const proc = Bun.spawn(["bun", "src/index.ts", "bogus"], {
    cwd: import.meta.dir + "/..",
    stderr: "pipe",
  })
  const code = await proc.exited
  const err = await new Response(proc.stderr).text()
  expect(code).not.toBe(0)
  expect(JSON.parse(err.trim()).type).toBe("error")
})

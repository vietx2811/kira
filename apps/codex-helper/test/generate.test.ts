import { expect, test } from "bun:test"
import { writeFile, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { generateWith } from "../src/generate"

test("runs a thread and returns finalResponse + usage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-gen-"))
  const payload = join(dir, "payload.json")
  await writeFile(payload, JSON.stringify({ prompt: "hello", model: "gpt-5.5" }))

  const fakeCodex = {
    startThread(opts: unknown) {
      return {
        async run(input: unknown) {
          return { finalResponse: `echo:${input}`, items: [], usage: { input_tokens: 1 } }
        },
      }
    },
  }

  const result = await generateWith(payload, () => fakeCodex as any)
  expect(result.content).toBe("echo:hello")
  expect(result.usage).toEqual({ input_tokens: 1 })
})

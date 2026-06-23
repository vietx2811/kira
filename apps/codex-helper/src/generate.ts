import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { Codex } from "@openai/codex-sdk"
import { resolveCodexBin } from "./codexPath"

type GeneratePayload = { prompt: string; model?: string; outputSchema?: unknown }
export type GenerateResult = { content: string; usage: unknown }

type CodexLike = {
  startThread(opts: Record<string, unknown>): {
    run(input: string, turnOpts?: unknown): Promise<{ finalResponse: string; usage: unknown }>
  }
}

function defaultCodexFactory(): CodexLike {
  return new Codex({ codexPathOverride: resolveCodexBin() }) as unknown as CodexLike
}

export async function generateWith(
  payloadFile: string,
  factory: () => CodexLike = defaultCodexFactory,
): Promise<GenerateResult> {
  const payload: GeneratePayload = JSON.parse(await readFile(payloadFile, "utf8"))
  if (!payload.prompt?.trim()) throw new Error("Prompt is empty")

  const codex = factory()
  const thread = codex.startThread({
    model: payload.model,
    sandboxMode: "read-only",
    approvalPolicy: "never",
    skipGitRepoCheck: true,
    networkAccessEnabled: false,
    workingDirectory: tmpdir(),
  })
  const turn = await thread.run(
    payload.prompt,
    payload.outputSchema ? { outputSchema: payload.outputSchema } : undefined,
  )
  return { content: turn.finalResponse, usage: turn.usage ?? null }
}

export async function runGenerate(payloadFile: string): Promise<GenerateResult> {
  return generateWith(payloadFile)
}

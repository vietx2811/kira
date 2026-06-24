import { readFile } from "node:fs/promises"
import { resolveCodexBin } from "./codexPath"

export type LoginEvent =
  | { type: "oauth_url"; url: string }
  | { type: "device_code"; verificationUrl: string; userCode: string }
  | { type: "success" }
  | { type: "error"; message: string }

type LoginMethod = "chatgpt" | "device" | "api-key"
type Options = { codexBin?: string }

function argsFor(method: LoginMethod): string[] {
  switch (method) {
    case "chatgpt": return ["login"]
    case "device": return ["login", "--device-auth"]
    case "api-key": return ["login", "--api-key"]
  }
}

function parseLine(line: string): LoginEvent | null {
  const url = line.match(/https?:\/\/\S*device\S*/)?.[0] ?? line.match(/https?:\/\/auth\.openai\.com\/\S+/)?.[0]
  const code = line.match(/code:?\s*([A-Z0-9]{4}-?[A-Z0-9]{4})/i)?.[1]
  if (code && url) return { type: "device_code", verificationUrl: url.replace(/\/device.*/, "/device"), userCode: code }
  if (url && /localhost:1455|callback|sign in/i.test(line)) return { type: "oauth_url", url }
  if (/login successful|signed in|logged in/i.test(line)) return { type: "success" }
  return null
}

export async function loginEvents(
  method: LoginMethod,
  payloadFile: string | undefined,
  options: Options,
  emit: (event: LoginEvent) => void,
): Promise<number> {
  const codexBin = options.codexBin ?? resolveCodexBin() ?? "codex"
  let apiKey: string | undefined
  if (method === "api-key") {
    if (!payloadFile) throw new Error("api-key login requires a payload file")
    apiKey = (JSON.parse(await readFile(payloadFile, "utf8")).apiKey as string | undefined)?.trim()
    if (!apiKey) throw new Error("api-key login payload missing apiKey")
  }

  const proc = Bun.spawn([codexBin, ...argsFor(method)], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: method === "api-key" ? "pipe" : "ignore",
  })
  if (method === "api-key" && apiKey) {
    proc.stdin!.write(apiKey + "\n")
    proc.stdin!.end()
  }

  let sawSuccess = false
  const reader = proc.stdout.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      const event = parseLine(line)
      if (event) {
        if (event.type === "success") sawSuccess = true
        emit(event)
      }
    }
  }
  const tail = buffer.trim()
  if (tail.length > 0) {
    const event = parseLine(tail)
    if (event) {
      if (event.type === "success") sawSuccess = true
      emit(event)
    }
  }
  const code = await proc.exited
  if (code === 0 && !sawSuccess) emit({ type: "success" })
  if (code !== 0) emit({ type: "error", message: (await new Response(proc.stderr).text()).trim() || `codex exited ${code}` })
  return code
}

export async function runLogin(method: string | undefined, payloadFile?: string): Promise<void> {
  if (method !== "chatgpt" && method !== "device" && method !== "api-key") {
    throw new Error(`Unknown login method: ${method ?? "<none>"}`)
  }
  const code = await loginEvents(method, payloadFile, {}, (event) => console.log(JSON.stringify(event)))
  process.exit(code)
}

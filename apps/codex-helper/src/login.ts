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
    case "api-key": return ["login", "--with-api-key"]
  }
}

/** Drain a stream line-by-line, invoking onLine per line, and return the full accumulated text. */
async function pumpStream(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let full = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    buffer += chunk
    let nl: number
    while ((nl = buffer.indexOf("\n")) >= 0) {
      onLine(buffer.slice(0, nl))
      buffer = buffer.slice(nl + 1)
    }
  }
  if (buffer.trim().length > 0) onLine(buffer)
  return full
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
  const handleLine = (line: string) => {
    const event = parseLine(line)
    if (event) {
      if (event.type === "success") sawSuccess = true
      emit(event)
    }
  }

  // The Codex CLI prints its login prompt, OAuth URL, device code, and status to STDERR
  // (stdout stays empty), so both streams must be parsed for progress events.
  const [, stderrText] = await Promise.all([
    pumpStream(proc.stdout, handleLine),
    pumpStream(proc.stderr, handleLine),
  ])

  const code = await proc.exited
  if (code === 0 && !sawSuccess) emit({ type: "success" })
  if (code !== 0) {
    const lastLine = stderrText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .pop()
    emit({ type: "error", message: lastLine || `codex exited ${code}` })
  }
  return code
}

export async function runLogin(method: string | undefined, payloadFile?: string): Promise<void> {
  if (method !== "chatgpt" && method !== "device" && method !== "api-key") {
    throw new Error(`Unknown login method: ${method ?? "<none>"}`)
  }
  const code = await loginEvents(method, payloadFile, {}, (event) => console.log(JSON.stringify(event)))
  process.exit(code)
}

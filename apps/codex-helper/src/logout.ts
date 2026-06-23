import { resolveCodexBin } from "./codexPath"

export async function logoutWith(codexBin: string = resolveCodexBin() ?? "codex"): Promise<{ ok: boolean }> {
  const proc = Bun.spawn([codexBin, "logout"], { stdout: "ignore", stderr: "pipe" })
  const code = await proc.exited
  if (code !== 0) throw new Error((await new Response(proc.stderr).text()).trim() || `codex logout exited ${code}`)
  return { ok: true }
}

export async function runLogout(): Promise<{ ok: boolean }> {
  return logoutWith()
}

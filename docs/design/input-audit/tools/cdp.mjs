// Minimal headless Chrome + CDP helper (Node 22, no deps).
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function launch(port = 9377, width = 1440, height = 900) {
  // The prefix carries the launching process's PID so it cannot match another
  // session's browser. It used to be a bare `kira-cdp-`, shared by every
  // session using this helper: on 2026-09-21 a cleanup `pkill -f "kira-cdp-"`
  // plus `rm -rf` killed another session's Chrome mid-measurement and deleted
  // its profile out from under it. Kill the PID you captured at spawn, and if
  // you ever must match by name, match `kira-cdp-<your pid>-`.
  const profile = mkdtempSync(join(tmpdir(), `kira-cdp-${process.pid}-`))
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', 'about:blank',
  ], { stdio: 'ignore' })
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let target
  for (let i = 0; i < 60 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    if (!target) await sleep(200)
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  let nextId = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++nextId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text }
    return r.result?.result?.value
  }
  // Prefer this in new scripts. `evaluate` returns `{__error}` instead of
  // throwing, so a page-side exception reads as an ordinary value: on
  // 2026-09-21 a script injected a Node expression into a page string, every
  // click silently failed, and five runs measured the same slide while looking
  // like five clean results. Left alongside `evaluate` rather than replacing
  // it, so existing scripts keep their behaviour.
  const evaluateStrict = async (expression) => {
    const value = await evaluate(expression)
    if (value && typeof value === 'object' && '__error' in value) {
      throw new Error(`page evaluate failed: ${value.__error}\n  expression: ${String(expression).slice(0, 200)}`)
    }
    return value
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false })
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  }
  const shot = async (clip) => (await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })).result.data
  const close = () => { try { ws.close() } catch {} ; chrome.kill(); process.exit(0) }
  return { send, evaluate, evaluateStrict, click, shot, sleep, close }
}

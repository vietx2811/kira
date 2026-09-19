// Minimal headless Chrome + CDP helper (Node 22, no deps).
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function launch(port = 9377, width = 1440, height = 900) {
  const profile = mkdtempSync(join(tmpdir(), 'kira-cdp-'))
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
  await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false })
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  }
  const shot = async (clip) => (await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })).result.data
  const close = () => { try { ws.close() } catch {} ; chrome.kill(); process.exit(0) }
  return { send, evaluate, click, shot, sleep, close }
}

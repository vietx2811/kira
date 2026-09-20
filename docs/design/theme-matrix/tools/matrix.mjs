// Theme matrix audit: 5 project accents x dark/light x every surface.
// Per control: rest-state boundary contrast (non-text, >=3:1), focus signal count
// (must be exactly 1) and focus signal contrast (>=3:1). Per surface: every
// visible text run against its real composited backdrop (>=4.5:1, >=3:1 large).
// usage: node matrix.mjs <base> <outDir> <mode> <accent> <port> [scenarios]
import { launch } from '../../input-audit/tools/cdp.mjs'
import { COLOR, FREEZE, PE_ON, PE_OFF, TEXT, RINGS, FILL } from './probe.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [base, outDir, mode, accent, portArg, onlyArg] = process.argv.slice(2)
const only = onlyArg ? onlyArg.split(',') : null
mkdirSync(outDir, { recursive: true })
const { evaluate, click, shot, sleep, send, close } = await launch(Number(portArg))

const HELPERS = `
  window.__s = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__l = (label) => document.querySelector('[aria-label="' + label + '"]');
  window.__click = (el) => { if (!el) throw new Error('missing element'); el.click(); };
  window.__dbl = (el) => { if (!el) throw new Error('missing node'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); };
  window.__tab = (name) => __click([...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.trim() === name));
  window.__theme = async (mode, accent) => {
    const psBtn = () => document.querySelector('[aria-label="Open project settings"], [aria-label="Close project settings"]');
    __click(psBtn()); await __s(700);
    const grp = (label) => document.querySelector('[aria-label="' + label + '"]');
    const item = (g, text) => [...(g ? g.querySelectorAll('button,[role=radio],[role=checkbox],[data-rac]') : [])].find((b) => b.textContent.trim().toLowerCase() === text);
    const mg = grp('Color mode'); if (!mg) throw new Error('no Color mode group');
    const m = item(mg, mode); if (!m) throw new Error('no mode ' + mode); m.click(); await __s(500);
    const ag = grp('Accent colors'); if (!ag) throw new Error('no Accent colors group');
    const a = item(ag, accent); if (!a) throw new Error('no accent ' + accent); a.click(); await __s(700);
    __click(psBtn()); await __s(700);
    const sh = document.querySelector('.app-shell');
    return { accent: sh.style.getPropertyValue('--accent-cyan'), base: sh.style.getPropertyValue('--bg-base'), field: sh.style.getPropertyValue('--field-edge') };
  };
`
const step = (body) => `(async () => { try { ${body}; await __s(900); return 'ok' } catch (e) { return 'ERR ' + e.message } })()`
const guided = step(`if (!document.querySelector('.onboarding-backdrop')) return; const cands = [...document.querySelectorAll('button,[role=button],div,span,strong')].filter((e) => e.textContent.trim().startsWith('Open the guided board')); const el = cands[cands.length - 1]; (el.closest('button,[role=button]') || el).click(); await __s(1500)`)
const seed = step(`window.__kiraDev.resetSeed(); await __s(1500)`)
const fixture = step(`window.__kiraDev.loadFixture(60); await __s(1800)`)

// Each surface is { data, open }: the data step reloads the project snapshot
// (resetSeed/loadFixture), which RESETS ProjectAppearance, so the theme has to
// be applied after it and before the surface is opened.
const SCENARIOS = {
  'library': { data: fixture, open: [] },
  'library-search': { data: fixture, open: [step(`__click(document.querySelector('button[aria-label*="earch"]'))`)] },
  'kira-dock': { data: seed, open: [step(`__click(__l('Ask Kira'))`)] },
  'kira-panel': { data: seed, open: [step(`__click(__l('Open Kira panel'))`)] },
  'node-idea': { data: seed, open: [step(`__dbl(document.querySelector('[data-node-kind="idea"]'))`)] },
  'node-image': { data: seed, open: [step(`__dbl(document.querySelector('[data-node-kind="image"]'))`)] },
  'tag-input': { data: seed, open: [step(`__dbl(document.querySelector('[data-node-kind="image"]')); await __s(900); __click(document.querySelector('.tag-chip-add'))`)] },
  'project-settings': { data: seed, open: [step(`__click(__l('Open project settings'))`)] },
  'link-popover': { data: seed, open: [step(`__click(document.querySelector('button[aria-label^="Select "][aria-label$=" relation"]'))`)] },
  'empty-canvas': { data: null, open: [step(`__click(__l('New file'))`)] },
  'frame-title': { data: seed, open: [step(`__click(__l('Frame')); await __s(700); const f = document.querySelector('.canvas-frame'); if (f) { const t = f.querySelector('.canvas-frame-title, [class*=frame-title], h3, strong'); f.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); if (t) t.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) }`)] },
  'settings-general': { data: null, open: [step(`__click(__l('Open Settings'))`)] },
  'settings-capture': { data: null, open: [step(`__click(__l('Open Settings')); await __s(700); __tab('Capture')`)] },
  'settings-ai': { data: null, open: [step(`__click(__l('Open Settings')); await __s(700); __tab('AI Providers')`)] },
  'settings-advanced': { data: null, open: [step(`__click(__l('Open Settings')); await __s(700); __tab('Advanced')`)] },
  'outline': { data: seed, open: [step(`__click(__l('Outline'))`)] },
  'slides': { data: seed, open: [step(`__click(__l('Slides'))`)] },
}

const ENUM = `(() => {
  const sel = 'input:not([type=file]):not([type=hidden]):not([type=color]):not([type=range]), textarea, select, [role=combobox], [contenteditable=true], button[aria-haspopup=listbox], [role=switch]';
  return [...document.querySelectorAll(sel)].map((el, i) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || cs.display === 'none' || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    if (el.closest('[aria-hidden=true]')) return null;
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2; const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(el.contains(hit) || hit.contains(el) || (hit.closest('label') && hit.closest('label').contains(el)))) return null;
    el.setAttribute('data-audit-i', String(i));
    const text = el.matches('input[type=text],input[type=search],input[type=password],input[type=email],input[type=url],input:not([type]),textarea,[contenteditable=true]');
    return { i, x: cx, y: cy, w: r.width, h: r.height, text };
  }).filter(Boolean);
})()`

const rows = []
const texts = []
const meta = { mode, accent, tokens: null, steps: {} }

for (const [name, plan] of Object.entries(SCENARIOS)) {
  if (only && !only.includes(name)) continue
  await send('Page.navigate', { url: base }); await sleep(500)
  await evaluate(`(() => { try { localStorage.clear(); sessionStorage.clear() } catch {} return 1 })()`)
  await send('Page.navigate', { url: base }); await sleep(3200)
  await evaluate(HELPERS)
  const stepRes = []
  stepRes.push(await evaluate(guided))
  // data first (it rebuilds the project and with it the appearance), theme second
  if (plan.data) stepRes.push(await evaluate(plan.data))
  const tk = await evaluate(`(async () => { try { return await __theme('${mode}', '${accent}') } catch (e) { return { err: String(e.message) } } })()`)
  stepRes.push(tk)
  for (const s of plan.open) stepRes.push(await evaluate(s))
  await sleep(500)
  // read the tokens that are live AT MEASUREMENT TIME, not when the theme was set
  const live = await evaluate(`(() => { const s = document.querySelector('.app-shell'); const cs = getComputedStyle(document.body); return { accent: s.style.getPropertyValue('--accent-cyan'), base: s.style.getPropertyValue('--bg-base'), field: s.style.getPropertyValue('--field-edge'), bodyBg: getComputedStyle(s).backgroundColor, text: s.style.getPropertyValue('--text-main') } })()`)
  meta.live = meta.live || {}
  meta.live[name] = live
  meta.tokens = meta.tokens || tk
  await evaluate(FREEZE)
  await evaluate(COLOR)

  // --- text contrast for the whole surface ---
  await evaluate(PE_ON)
  const t = (await evaluate(TEXT)) || []
  await evaluate(PE_OFF)
  for (const row of t) texts.push({ mode, accent, scenario: name, ...row })

  // --- focus on open (a dialog that steals focus is itself a signal) ---
  const openFocus = await evaluate(`(() => { const el = document.activeElement; if (!el || el === document.body) return null; el.setAttribute('data-audit-i', 'open'); return { tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), rac: el.hasAttribute('data-rac'), fv: el.matches(':focus-visible') } })()`)
  if (openFocus) {
    const s = (await evaluate(RINGS('[data-audit-i="open"]'))) || []
    rows.push({ mode, accent, scenario: name + ' (on open)', how: 'auto', focused: true, fv: openFocus.fv, tag: openFocus.tag + (openFocus.role ? '[' + openFocus.role + ']' : ''), type: null, label: null, cls: '', rac: openFocus.rac, kit: false, rest: [], signals: s.filter((x) => x.kind !== 'border') })
  }

  const ctrls = (await evaluate(ENUM)) || []
  for (const c of ctrls) {
    await evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`)
    await sleep(120)
    const before = (await evaluate(RINGS(`[data-audit-i="${c.i}"]`))) || []
    const fill = await evaluate(FILL(`[data-audit-i="${c.i}"]`))
    if (c.text) await click(c.x, c.y)
    else {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 })
      await evaluate(`document.querySelector('[data-audit-i="${c.i}"]').focus()`)
    }
    await sleep(260)
    const info = await evaluate(`(() => { const el = document.querySelector('[data-audit-i="${c.i}"]'); return { focused: document.activeElement === el, fv: el.matches(':focus-visible'), tag: el.tagName.toLowerCase(), type: el.type || null, label: el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.closest('label') && el.closest('label').textContent.trim().slice(0, 30)) || (el.id && document.querySelector('label[for="' + el.id + '"]') && document.querySelector('label[for="' + el.id + '"]').textContent.trim().slice(0, 30)) || null, cls: String(el.className).slice(0, 60), rac: el.hasAttribute('data-rac') || !!el.closest('[data-rac]'), kit: !!el.closest('.kira-uikit') } })()`)
    const after = (await evaluate(RINGS(`[data-audit-i="${c.i}"]`))) || []
    const key = (s) => `${s.d}|${s.kind}|${s.w}|${s.color}`
    const bset = new Set(before.map(key))
    const signals = after.filter((s) => !bset.has(key(s)))
    rows.push({ mode, accent, scenario: name, how: c.text ? 'mouse' : 'kbd', ...info, rest: before, fill, signals })
  }
  meta.steps[name] = stepRes
  console.error(`${mode}/${accent} ${name}: controls=${ctrls.length} texts=${t.length} steps=${JSON.stringify(stepRes)}`)
}
writeFileSync(join(outDir, `${mode}-${accent}.json`), JSON.stringify({ meta, rows, texts }, null, 1))
close()

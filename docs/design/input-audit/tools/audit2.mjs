// Focus-signal audit: for every text-entry / select / toggle control on every surface,
// diff the visible rings before vs after focus (mouse for text fields, keyboard modality for the rest).
// usage: node audit2.mjs <base> <outDir> <scenarios|''> <modes> <accents>
import { launch } from './cdp.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [base, outDir, onlyArg, modesArg = 'dark', accentsArg = 'cyan'] = process.argv.slice(2)
const only = onlyArg ? onlyArg.split(',') : null
mkdirSync(outDir, { recursive: true })
const { evaluate, click, shot, sleep, send, close } = await launch(Number(process.env.CDP_PORT || 9385))

const HELPERS = `
  window.__s = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__l = (label) => document.querySelector('[aria-label="' + label + '"]');
  window.__click = (el) => { if (!el) throw new Error('missing element'); el.click(); };
  window.__dbl = (el) => { if (!el) throw new Error('missing node'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); };
  window.__tab = (name) => __click([...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.trim() === name));
  window.__theme = async (mode, accent) => {
    const psBtn = () => document.querySelector('[aria-label="Open project settings"], [aria-label="Close project settings"]');
    __click(psBtn()); await __s(500);
    const grp = (label) => document.querySelector('[aria-label="' + label + '"]');
    const item = (g, text) => [...(g ? g.querySelectorAll('button,[role=radio],[role=checkbox],[data-rac]') : [])].find((b) => b.textContent.trim().toLowerCase() === text);
    const m = item(grp('Color mode'), mode); if (m) m.click(); await __s(400);
    const a = item(grp('Accent colors'), accent); if (a) a.click(); await __s(500);
    __click(psBtn()); await __s(500);
  };
`
const step = (body) => `(async () => { try { ${body}; await __s(900); return 'ok' } catch (e) { return 'ERR ' + e.message } })()`
const guided = step(`if (!document.querySelector('.onboarding-backdrop')) return; const cands = [...document.querySelectorAll('button,[role=button],div,span,strong')].filter((e) => e.textContent.trim().startsWith('Open the guided board')); const el = cands[cands.length - 1]; (el.closest('button,[role=button]') || el).click(); await __s(1500)`)
const seed = step(`window.__kiraDev.resetSeed(); await __s(1500)`)
const fixture = step(`window.__kiraDev.loadFixture(60); await __s(1800)`)
const themeStep = (mode, accent) => step(`await __theme('${mode}', '${accent}')`)

const SCENARIOS = {
  'library': [guided, fixture],
  'kira-dock': [guided, seed, step(`__click(__l('Ask Kira'))`)],
  'node-idea': [guided, seed, step(`__dbl(document.querySelector('[data-node-kind="idea"]'))`)],
  'node-image': [guided, seed, step(`__dbl(document.querySelector('[data-node-kind="image"]'))`)],
  'project-settings': [guided, seed, step(`__click(__l('Open project settings'))`)],
  'link-popover': [guided, seed, step(`__click(document.querySelector('button[aria-label^="Select "][aria-label$=" relation"]'))`)],
  'library-search': [guided, fixture, step(`__click(document.querySelector('button[aria-label*="earch"]'))`)],
  'empty-canvas': [guided, step(`__click(__l('New file'))`)],
  'tag-input': [guided, seed, step(`__dbl(document.querySelector('[data-node-kind="image"]')); await __s(900); __click(document.querySelector('.tag-chip-add'))`)],
  'kira-panel': [guided, seed, step(`__click(__l('Open Kira panel'))`)],
  'frame-title': [guided, seed, step(`__click(__l('Frame')); await __s(700); const f = document.querySelector('.canvas-frame'); if (f) { const t = f.querySelector('.canvas-frame-title, [class*=frame-title], h3, strong'); f.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); if (t) t.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })) }`)],
  'settings-general': [guided, step(`__click(__l('Open Settings'))`)],
  'settings-capture': [guided, step(`__click(__l('Open Settings')); await __s(700); __tab('Capture')`)],
  'settings-ai': [guided, step(`__click(__l('Open Settings')); await __s(700); __tab('AI Providers')`)],
  'settings-advanced': [guided, step(`__click(__l('Open Settings')); await __s(700); __tab('Advanced')`)],
  'outline': [guided, seed, step(`__click(__l('Outline'))`)],
  'slides': [guided, seed, step(`__click(__l('Slides'))`)],
}

const ENUM = `(() => {
  const sel = 'input:not([type=file]):not([type=hidden]):not([type=color]):not([type=range]), textarea, select, [role=combobox], [contenteditable=true], button[aria-haspopup=listbox], [role=switch]';
  return [...document.querySelectorAll(sel)].map((el, i) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || cs.display === 'none' || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return null;
    if (el.closest('[aria-hidden=true]') || el.tabIndex === -1 && el.tagName === 'SELECT') return null;
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2; const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(el.contains(hit) || hit.contains(el) || (hit.closest('label') && hit.closest('label').contains(el)))) return null;
    el.setAttribute('data-audit-i', String(i));
    const text = el.matches('input[type=text],input[type=search],input[type=password],input[type=email],input[type=url],input:not([type]),textarea,[contenteditable=true]');
    return { i, x: cx, y: cy, w: r.width, h: r.height, text };
  }).filter(Boolean);
})()`

// rings for element + 5 ancestors; contrast of ring colour vs the surface under it
const RINGS = (i) => `(() => {
  const el = document.querySelector('[data-audit-i="${i}"]'); if (!el) return null;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgUnder = (e) => { let layers = []; for (let p = e; p; p = p.parentElement) { const c = parse(getComputedStyle(p).backgroundColor); if (c.a > 0) { layers.push(c); if (c.a >= 0.99) break } } let bg = { r: 0, g: 0, b: 0, a: 1 }; for (const l of layers.reverse()) bg = over(l, bg); return bg };
  const out = []; let p = el;
  for (let d = 0; p && d < 6 && p !== document.body; d++, p = p.parentElement) {
    const cs = getComputedStyle(p);
    const parentBg = bgUnder(p.parentElement || p);
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
      const col = parse(cs.outlineColor);
      if (col.a > 0.05) out.push({ d, tag: p.tagName.toLowerCase(), kind: 'outline', w: parseFloat(cs.outlineWidth), off: cs.outlineOffset, color: cs.outlineColor, cr: +ratio(over(col, parentBg), parentBg).toFixed(2) });
    }
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') {
      const col = parse(cs.borderTopColor);
      if (col.a > 0.02) out.push({ d, tag: p.tagName.toLowerCase(), kind: 'border', w: parseFloat(cs.borderTopWidth), off: '0', color: cs.borderTopColor, cr: +ratio(over(col, parentBg), parentBg).toFixed(2) });
    }
    const sh = cs.boxShadow;
    if (sh && sh !== 'none') {
      const layers = []; let depth = 0, cur = '';
      for (const ch of sh) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { layers.push(cur.trim()); cur = '' } else cur += ch } layers.push(cur.trim());
      for (const L of layers) {
        const m = L.match(/^(rgba?\\([^)]*\\)|oklch\\([^)]*\\)|color\\([^)]*\\)|#[0-9a-f]+)\\s+(.*)$/i); if (!m) continue;
        const nums = m[2].replace('inset', '').trim().split(/\\s+/).map((v) => parseFloat(v)); const inset = /inset/.test(m[2]);
        const [x, y, blur, spread] = nums; const col = parse(m[1]);
        if (col.a > 0.05 && x === 0 && y === 0 && blur === 0 && (inset || spread > 0)) {
          const under = bgUnder(inset ? p : p.parentElement || p);
          out.push({ d, tag: p.tagName.toLowerCase(), kind: inset ? 'ring-inset' : 'ring', w: spread, off: '0', color: m[1], cr: +ratio(over(col, under), under).toFixed(2) });
        }
      }
    }
  }
  return out;
})()`

const acc = await (async () => 'ok')()
const rows = []
for (const mode of modesArg.split(',')) for (const accent of accentsArg.split(',')) {
  for (const [name, steps] of Object.entries(SCENARIOS)) {
    if (only && !only.includes(name)) continue
    await send('Page.navigate', { url: base }); await sleep(500)
    await evaluate(`(() => { try { localStorage.clear(); sessionStorage.clear() } catch {} return 1 })()`)
    await send('Page.navigate', { url: base }); await sleep(2600)
    await evaluate(HELPERS)
    const stepRes = []
    // theme first (needs the board open), then re-run the scenario steps
    if (mode !== 'dark' || accent !== 'cyan') { stepRes.push(await evaluate(guided)); stepRes.push(await evaluate(seed)); stepRes.push(await evaluate(themeStep(mode, accent))) }
    for (const s of steps) stepRes.push(await evaluate(s))
    await sleep(400)
    const openFocus = await evaluate(`(() => { const el = document.activeElement; if (!el || el === document.body) return null; el.setAttribute('data-audit-i', 'open'); return { tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), rac: el.hasAttribute('data-rac'), fv: el.matches(':focus-visible') } })()`)
    if (openFocus) { const s = (await evaluate(RINGS('open'))) || []; rows.push({ mode, accent, scenario: name + ' (on open)', how: 'auto', focused: true, fv: openFocus.fv, tag: openFocus.tag + (openFocus.role ? '[' + openFocus.role + ']' : ''), type: null, label: null, cls: '', rac: openFocus.rac, kit: false, signals: s.filter((x) => x.kind !== 'border') }) }
    const ctrls = (await evaluate(ENUM)) || []
    let n = 0
    for (const c of ctrls) {
      await evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`)
      await sleep(120)
      const before = (await evaluate(RINGS(c.i))) || []
      if (c.text) await click(c.x, c.y)
      else {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 })
        await evaluate(`document.querySelector('[data-audit-i="${c.i}"]').focus()`)
      }
      await sleep(260)
      const info = await evaluate(`(() => { const el = document.querySelector('[data-audit-i="${c.i}"]'); return { focused: document.activeElement === el, fv: el.matches(':focus-visible'), tag: el.tagName.toLowerCase(), type: el.type || null, label: el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.closest('label') && el.closest('label').textContent.trim().slice(0, 30)) || (el.id && document.querySelector('label[for="' + el.id + '"]') && document.querySelector('label[for="' + el.id + '"]').textContent.trim().slice(0, 30)) || null, cls: String(el.className).slice(0, 60), rac: el.hasAttribute('data-rac') || !!el.closest('[data-rac]'), kit: !!el.closest('.kira-uikit') } })()`)
      const after = (await evaluate(RINGS(c.i))) || []
      const key = (s) => `${s.d}|${s.kind}|${s.w}|${s.color}`
      const bset = new Set(before.map(key))
      const signals = after.filter((s) => !bset.has(key(s)))
      rows.push({ mode, accent, scenario: name, how: c.text ? 'mouse' : 'kbd', ...info, signals })
      if (c.text && n < 2 && info.focused) {
        const r = await evaluate(`(() => { const r = document.querySelector('[data-audit-i="${c.i}"]').getBoundingClientRect(); return { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12), width: Math.min(r.width + 24, 700), height: Math.min(r.height + 24, 220) } })()`)
        writeFileSync(join(outDir, `${mode}-${accent}-${name}-${n}.png`), Buffer.from(await shot(r), 'base64'))
        n++
      }
    }
    console.error(`${mode}/${accent} ${name}: steps=${JSON.stringify(stepRes)} controls=${ctrls.length}`)
  }
}
writeFileSync(join(outDir, 'audit.json'), JSON.stringify(rows, null, 2))
close()

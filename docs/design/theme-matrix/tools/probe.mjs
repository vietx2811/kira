// Shared in-page probes for the theme matrix audit.
// Colour maths: composite every background layer bottom-up, multiplying each
// layer's alpha by the opacity chain of the element that paints it, so a panel
// at 34% over the canvas measures as what the eye actually sees.
export const COLOR = `
window.__cx = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; return cv.getContext('2d', { willReadFrequently: true }) })();
window.__parse = (css) => { const cx = window.__cx; cx.clearRect(0,0,1,1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 } };
window.__over = (t, b) => ({ r: t.r*t.a + b.r*(1-t.a), g: t.g*t.a + b.g*(1-t.a), b: t.b*t.a + b.b*(1-t.a), a: 1 });
window.__lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4 }; return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b) };
window.__ratio = (a, b) => { const x = __lum(a), y = __lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05) };
window.__op = (el) => { let o = 1; for (let p = el; p && p !== document.documentElement; p = p.parentElement) { const v = parseFloat(getComputedStyle(p).opacity); if (!Number.isNaN(v)) o *= v } return o };
// stack of background layers from \`from\` upward; returns { bg, opaque }
window.__stack = (from) => {
  const layers = []; let opaque = false;
  for (let p = from; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    const c = __parse(cs.backgroundColor);
    const a = c.a * __op(p);
    if (a > 0.004) { layers.push({ ...c, a: Math.min(1, a) }); if (a >= 0.995) { opaque = true; break } }
    if (p === document.documentElement) break;
  }
  return { layers, opaque };
};
// composite the stack onto a given underlay
window.__bgOn = (from, under) => { const { layers } = __stack(from); let bg = under; for (const l of layers.reverse()) bg = __over(l, bg); return bg };
window.__bgWorst = (from) => {
  const { opaque } = __stack(from);
  if (opaque) return { list: [__bgOn(from, { r: 0, g: 0, b: 0, a: 1 })], translucent: false };
  return { list: [__bgOn(from, { r: 0, g: 0, b: 0, a: 1 }), __bgOn(from, { r: 255, g: 255, b: 255, a: 1 })], translucent: true };
};
`

// Freeze motion so getComputedStyle never reads a half-finished transition.
export const FREEZE = `(() => { const s = document.createElement('style'); s.id = '__tm_freeze'; s.textContent = '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}'; document.head.appendChild(s); return 1 })()`
// elementsFromPoint skips pointer-events:none, so force it on while hit-testing.
export const PE_ON = `(() => { const s = document.createElement('style'); s.id = '__tm_pe'; s.textContent = '*{pointer-events:auto!important}'; document.head.appendChild(s); return 1 })()`
export const PE_OFF = `(() => { const s = document.getElementById('__tm_pe'); if (s) s.remove(); return 1 })()`

// Every visible run of text, contrast against its real composited backdrop.
export const TEXT = `(() => {
  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const els = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const el = n.parentElement; if (el) els.add(el);
  }
  for (const el of els) {
    if (el.closest('[aria-hidden="true"]') || el.closest('script,style,title,svg')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const opac = __op(el);
    if (opac < 0.06) continue;
    // hit-test a point inside the first text rect, not the box centre
    let pt = null;
    try {
      const range = document.createRange(); range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((q) => q.width > 1 && q.height > 1 && q.top < innerHeight && q.bottom > 0);
      const q = rects[0];
      if (q) pt = { x: Math.min(innerWidth - 1, Math.max(1, q.x + Math.min(6, q.width / 2))), y: Math.min(innerHeight - 1, Math.max(1, q.y + q.height / 2)) };
    } catch {}
    if (!pt) pt = { x: r.x + Math.min(6, r.width / 2), y: r.y + r.height / 2 };
    const hit = document.elementFromPoint(pt.x, pt.y);
    if (!hit || !(el.contains(hit) || hit.contains(el))) continue;
    const col = __parse(cs.color);
    const fg = { ...col, a: col.a * opac };
    if (fg.a < 0.06) continue;
    const worst = __bgWorst(el);
    let lowest = Infinity, bgUsed = null;
    for (const bg of worst.list) { const c = __ratio(__over(fg, bg), bg); if (c < lowest) { lowest = c; bgUsed = bg } }
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const text = el.textContent.trim().slice(0, 40);
    const key = text + '|' + cs.color + '|' + Math.round(r.x) + '|' + Math.round(r.y);
    if (seen.has(key)) continue; seen.add(key);
    out.push({ text, cls: String(el.className || '').slice(0, 48), tag: el.tagName.toLowerCase(), size, weight, large, opac: +opac.toFixed(2),
      color: cs.color, cr: +lowest.toFixed(2), translucent: worst.translucent, need: large ? 3 : 4.5,
      bg: bgUsed ? 'rgb(' + [bgUsed.r, bgUsed.g, bgUsed.b].map((v) => Math.round(v)).join(',') + ')' : null });
  }
  return out;
})()`

// Visible boundary (outline / border / solid ring) on an element and 5 ancestors,
// each measured against the surface it sits on.
export const RINGS = (sel) => `(() => {
  const el = document.querySelector('${sel}'); if (!el) return null;
  const out = []; let p = el;
  for (let d = 0; p && d < 6 && p !== document.body; d++, p = p.parentElement) {
    const cs = getComputedStyle(p);
    const parentBg = __bgOn(p.parentElement || p, { r: 0, g: 0, b: 0, a: 1 });
    const parentWorst = __bgWorst(p.parentElement || p);
    const crOf = (col) => { let lo = Infinity; for (const bg of parentWorst.list) { const c = __ratio(__over(col, bg), bg); if (c < lo) lo = c } return +lo.toFixed(2) };
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) {
      const col = __parse(cs.outlineColor);
      if (col.a > 0.05) out.push({ d, tag: p.tagName.toLowerCase(), kind: 'outline', w: parseFloat(cs.outlineWidth), off: cs.outlineOffset, color: cs.outlineColor, cr: crOf(col) });
    }
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') {
      const col = __parse(cs.borderTopColor);
      if (col.a > 0.02) out.push({ d, tag: p.tagName.toLowerCase(), kind: 'border', w: parseFloat(cs.borderTopWidth), off: '0', color: cs.borderTopColor, cr: crOf(col) });
    }
    const sh = cs.boxShadow;
    if (sh && sh !== 'none') {
      const layers = []; let depth = 0, cur = '';
      for (const ch of sh) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { layers.push(cur.trim()); cur = '' } else cur += ch } layers.push(cur.trim());
      for (const L of layers) {
        const m = L.match(/^(rgba?\\([^)]*\\)|oklch\\([^)]*\\)|color\\([^)]*\\)|#[0-9a-f]+)\\s+(.*)$/i); if (!m) continue;
        const inset = /inset/.test(m[2]);
        const nums = m[2].replace('inset', '').trim().split(/\\s+/).map((v) => parseFloat(v));
        const [x, y, blur, spread] = nums; const col = __parse(m[1]);
        if (col.a > 0.05 && x === 0 && y === 0 && blur === 0 && (inset || spread > 0)) {
          const host = inset ? p : (p.parentElement || p);
          const w2 = __bgWorst(host);
          let lo = Infinity; for (const bg of w2.list) { const c = __ratio(__over(col, bg), bg); if (c < lo) lo = c }
          out.push({ d, tag: p.tagName.toLowerCase(), kind: inset ? 'ring-inset' : 'ring', w: spread, off: '0', color: m[1], cr: +lo.toFixed(2) });
        }
      }
    }
  }
  return out;
})()`

// Rest-state identification of a control: does its own fill separate it from
// the surface around it? (WCAG 1.4.11 lets either a boundary or the fill carry it.)
export const FILL = (sel) => `(() => {
  const el = document.querySelector('${sel}'); if (!el) return null;
  const host = el.closest('[data-rac]') || el;
  const outside = host.parentElement || document.body;
  const self = __bgWorst(host), out = __bgWorst(outside);
  let lo = Infinity;
  for (const a of self.list) for (const b of out.list) { const c = __ratio(a, b); if (c < lo) lo = c }
  return { fillCr: +lo.toFixed(2), translucent: self.translucent || out.translucent };
})()`

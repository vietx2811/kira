import { readFileSync, readdirSync } from 'node:fs'
const dir = '/tmp/claude-501/tm/full'
const all = readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(`${dir}/${f}`,'utf8')))
const isOpen = r => / \(on open\)$/.test(r.scenario)
const err = r => !!r.__error
const nonText = r => Math.max(0, ...(r.rest||[]).map(s=>s.cr), r.fill ? r.fill.fillCr : 0)
// a native checkbox/radio is visually replaced by a drawn box: its own fill and
// border say nothing about what the user sees, so it is out of the non-text pool
const ntEligible = r => !err(r) && !isOpen(r) && r.type !== 'checkbox' && r.type !== 'radio' && r.tag !== 'div'

console.log('### Matrix: 5 accent x 2 theme, 17 screens each\n')
console.log('| theme | accent | controls | exactly 1 signal | 0 signals | min focus CR | text runs | text < AA | min text CR |')
console.log('|---|---|---|---|---|---|---|---|---|')
for (const d of all) {
  const R = d.rows.filter(r=>!isOpen(r)&&!err(r)&&r.focused)
  const one = R.filter(r=>r.signals.length===1).length
  const zero = R.filter(r=>r.signals.length===0).length
  const crs = R.flatMap(r=>r.signals.map(s=>s.cr))
  const T = d.texts.filter(t=>t.opac>=0.7)
  const tf = T.filter(t=>t.cr<t.need)
  console.log(`| ${d.meta.mode} | ${d.meta.accent} | ${R.length} | ${one} | ${zero} | ${Math.min(...crs).toFixed(2)} | ${T.length} | ${tf.length} | ${Math.min(...T.map(t=>t.cr)).toFixed(2)} |`)
}
const rows = all.flatMap(d=>d.rows), texts = all.flatMap(d=>d.texts)
console.log('\n### Totals')
const R = rows.filter(r=>!isOpen(r)&&!err(r)&&r.focused)
console.log('- focus measurements:', R.length, '| exactly 1 signal:', R.filter(r=>r.signals.length===1).length, '| 2+:', R.filter(r=>r.signals.length>1).length, '| 0:', R.filter(r=>r.signals.length===0).length)
console.log('- lowest focus-signal contrast:', Math.min(...R.flatMap(r=>r.signals.map(s=>s.cr))).toFixed(2))
console.log('- tooling errors (element vanished between enumerate and measure):', rows.filter(err).length)
console.log('- text runs measured (opacity >= 0.7):', texts.filter(t=>t.opac>=0.7).length, '| below AA:', texts.filter(t=>t.opac>=0.7&&t.cr<t.need).length)

console.log('\n### Settings dialog on open (the ring the previous round removed)')
for (const d of all) {
  const dlg = d.rows.filter(r=>isOpen(r)&&/settings-/.test(r.scenario))
  console.log(`- ${d.meta.mode}/${d.meta.accent}: ${dlg.length} dialogs, ${dlg.filter(r=>r.signals.length).length} with a ring`)
}

console.log('\n### Zero-signal controls')
const z = new Map()
for (const r of R.filter(r=>r.signals.length===0)) { const k = r.cls.slice(0,40); z.set(k,(z.get(k)||0)+1) }
for (const [k,n] of z) console.log(`- \`${k}\` x${n}`)

console.log('\n### Rest-state non-text contrast of text fields and select buttons (WCAG 1.4.11, need 3:1)')
const nt = new Map()
for (const r of rows.filter(ntEligible)) {
  const k = `${r.tag}${r.type?'['+r.type+']':''} ${r.rac?'kit':'raw'}`
  if (!nt.has(k)) nt.set(k, [])
  nt.get(k).push(nonText(r))
}
console.log('| control class | n | min | max | >= 3:1 |')
console.log('|---|---|---|---|---|')
for (const [k,v] of nt) console.log(`| ${k} | ${v.length} | ${Math.min(...v).toFixed(2)} | ${Math.max(...v).toFixed(2)} | ${v.filter(x=>x>=3).length}/${v.length} |`)

console.log('\n### Text below AA, grouped (opacity >= 0.7)')
const tg = new Map()
for (const t of texts.filter(t=>t.cr<t.need&&t.opac>=0.7)) {
  const k = `${t.scenario}|${t.text.slice(0,30)}|${t.size}px/${t.weight}`
  if (!tg.has(k)) tg.set(k, [])
  tg.get(k).push({cr:t.cr,c:`${t.mode}/${t.accent}`,color:t.color,bg:t.bg,need:t.need})
}
console.log('| screen | text | size | colour on bg | contrast | need | combos |')
console.log('|---|---|---|---|---|---|---|')
for (const [k,v] of [...tg].sort((a,b)=>Math.min(...a[1].map(x=>x.cr))-Math.min(...b[1].map(x=>x.cr)))) {
  const p = k.split('|')
  console.log(`| ${p[0]} | ${p[1]} | ${p[2]} | ${v[0].color} on ${v[0].bg} | **${Math.min(...v.map(x=>x.cr)).toFixed(2)}:1** | ${v[0].need} | ${v.length}/10 (${[...new Set(v.map(x=>x.c.split('/')[0]))].join('+')}) |`)
}

console.log('\n### Per screen, worst across all 10 combos')
console.log('| screen | 1 signal / 0 signal | min focus CR | min text CR | text below AA |')
console.log('|---|---|---|---|---|')
const scr = new Map()
for (const r of R) {
  if (!scr.has(r.scenario)) scr.set(r.scenario,{one:0,zero:0,minSig:Infinity})
  const s = scr.get(r.scenario)
  if (r.signals.length===1) s.one++; else if (r.signals.length===0) s.zero++
  for (const g of r.signals) if (g.cr<s.minSig) s.minSig=g.cr
}
const ts = new Map()
for (const t of texts.filter(t=>t.opac>=0.7)) {
  if (!ts.has(t.scenario)) ts.set(t.scenario,{min:Infinity,fail:0})
  const s = ts.get(t.scenario); if (t.cr<s.min) s.min=t.cr; if (t.cr<t.need) s.fail++
}
for (const [k,s] of scr) {
  const t = ts.get(k)||{min:NaN,fail:0}
  console.log(`| ${k} | ${s.one} / ${s.zero} | ${s.minSig===Infinity?'-':s.minSig.toFixed(2)} | ${t.min.toFixed(2)} | ${t.fail} |`)
}

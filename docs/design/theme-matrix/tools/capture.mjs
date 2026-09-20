import { launch } from '/Volumes/VXData/Users/VietX/App Code/vixio/docs/design/input-audit/tools/cdp.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
mkdirSync('/tmp/claude-501/tm/shots', { recursive: true })
const { evaluate, shot, sleep, send, close } = await launch(9491)
const HELP = `
 window.__s=(ms)=>new Promise(r=>setTimeout(r,ms));
 window.__l=(x)=>document.querySelector('[aria-label="'+x+'"]');
 window.__click=(el)=>{if(!el)throw new Error('missing');el.click()};
 window.__theme = async (mode, accent) => {
   const ps=()=>document.querySelector('[aria-label="Open project settings"], [aria-label="Close project settings"]');
   __click(ps()); await __s(700);
   const g=(l)=>document.querySelector('[aria-label="'+l+'"]');
   const it=(gr,t)=>[...(gr?gr.querySelectorAll('button,[role=radio],[role=checkbox],[data-rac]'):[])].find(b=>b.textContent.trim().toLowerCase()===t);
   it(g('Color mode'),mode).click(); await __s(500);
   it(g('Accent colors'),accent).click(); await __s(700);
   __click(ps()); await __s(700);
 };`
async function scene(mode, accent, data, open) {
  await send('Page.navigate', { url: 'http://127.0.0.1:5240/' }); await sleep(400)
  await evaluate(`(()=>{try{localStorage.clear()}catch{}return 1})()`)
  await send('Page.navigate', { url: 'http://127.0.0.1:5240/' }); await sleep(3400)
  await evaluate(HELP)
  await evaluate(`(async()=>{const b=document.querySelector('.onboarding-backdrop');if(!b)return;const c=[...document.querySelectorAll('button,[role=button],div,span,strong')].filter(e=>e.textContent.trim().startsWith('Open the guided board'));const el=c[c.length-1];(el.closest('button,[role=button]')||el).click();await __s(1500)})()`)
  await sleep(2200)
  if (data) { await evaluate(`(async()=>{window.__kiraDev.${data};await __s(1500)})()`); await sleep(1700) }
  await evaluate(`(async()=>{await __theme('${mode}','${accent}')})()`); await sleep(1200)
  if (open) { await evaluate(`(async()=>{${open}})()`); await sleep(1800) }
  await evaluate(`(()=>{const s=document.createElement('style');s.textContent='*,*::before,*::after{transition:none!important;animation-duration:0s!important}';document.head.appendChild(s);return 1})()`)
}
async function grab(name, finder, pad = 14) {
  const r = await evaluate(`(() => { ${finder}; if(!el) return null; const q=el.getBoundingClientRect();
    return {x:Math.max(0,q.x-${pad}),y:Math.max(0,q.y-${pad}),width:Math.min(q.width+${pad}*2,820),height:Math.min(q.height+${pad}*2,240)} })()`)
  if (!r) { console.error('MISS', name); return }
  writeFileSync(`/tmp/claude-501/tm/shots/${name}.png`, Buffer.from(await shot(r), 'base64'))
  console.error('ok', name, JSON.stringify(r))
}
// 3. outline Rebuild/Export - dark
await scene('dark', 'cyan', 'resetSeed()', `__click(__l('Outline'))`)
await grab('dark-outline', `const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Rebuild'); const el = b ? b.parentElement : null`, 16)
// 4. slides meta line - light
await scene('light', 'cyan', 'resetSeed()', `__click(__l('Slides'))`)
await grab('light-slides', `const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && /directions/.test(e.textContent)) || null`, 18)
close()

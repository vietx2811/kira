// Reproduces the ordering defect in docs/design/input-audit/tools/audit2.mjs:
// the scenario's own seed/fixture step runs AFTER the theme step and resets
// ProjectAppearance back to the default (dark / Cyan).
import { launch } from '/Volumes/VXData/Users/VietX/App Code/vixio/docs/design/input-audit/tools/cdp.mjs'
const { evaluate, sleep, send, close } = await launch(9450)
const tok = () => evaluate(`(() => { const s = document.querySelector('.app-shell'); return { accent: s.style.getPropertyValue('--accent-cyan'), base: s.style.getPropertyValue('--bg-base') } })()`)
await send('Page.navigate', { url: 'http://127.0.0.1:5240/' }); await sleep(4500)
await evaluate(`
 window.__s=(ms)=>new Promise(r=>setTimeout(r,ms));
 window.__click=(el)=>{if(!el)throw new Error('missing');el.click()};
 window.__theme = async (mode, accent) => {
   const psBtn=()=>document.querySelector('[aria-label="Open project settings"], [aria-label="Close project settings"]');
   __click(psBtn()); await __s(700);
   const grp=(l)=>document.querySelector('[aria-label="'+l+'"]');
   const item=(g,t)=>[...(g?g.querySelectorAll('button,[role=radio],[role=checkbox],[data-rac]'):[])].find(b=>b.textContent.trim().toLowerCase()===t);
   item(grp('Color mode'),mode).click(); await __s(500);
   item(grp('Accent colors'),accent).click(); await __s(700);
   __click(psBtn()); await __s(700);
 };`)
await evaluate(`(async()=>{const b=document.querySelector('.onboarding-backdrop');if(!b)return;const c=[...document.querySelectorAll('button,[role=button],div,span,strong')].filter(e=>e.textContent.trim().startsWith('Open the guided board'));const el=c[c.length-1];(el.closest('button,[role=button]')||el).click();await __s(1500)})()`)
await sleep(2000)
await evaluate(`(async()=>{window.__kiraDev.resetSeed();await __s(1500)})()`); await sleep(1600)
await evaluate(`(async()=>{await __theme('light','rose')})()`); await sleep(1000)
console.log('after theme step      :', JSON.stringify(await tok()))
await evaluate(`(async()=>{window.__kiraDev.resetSeed();await __s(1500)})()`); await sleep(1600)
console.log('after scenario re-seed:', JSON.stringify(await tok()))
close()

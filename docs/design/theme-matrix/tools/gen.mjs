import { writeFileSync } from 'node:fs'
const HELPERS = `
(() => {
const cv=document.createElement('canvas');cv.width=cv.height=1;const cx=cv.getContext('2d',{willReadFrequently:true});
window.__parse=(s)=>{cx.clearRect(0,0,1,1);cx.fillStyle='#000';cx.fillStyle=s;cx.fillRect(0,0,1,1);const d=cx.getImageData(0,0,1,1).data;return{r:d[0],g:d[1],b:d[2],a:d[3]/255}};
window.__over=(t,b)=>({r:t.r*t.a+b.r*(1-t.a),g:t.g*t.a+b.g*(1-t.a),b:t.b*t.a+b.b*(1-t.a),a:1});
window.__lum=(c)=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
window.__ratio=(a,b)=>{const x=__lum(a),y=__lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
window.__op=(el)=>{let o=1;for(let p=el;p&&p!==document.documentElement;p=p.parentElement){const v=parseFloat(getComputedStyle(p).opacity);if(!isNaN(v))o*=v}return o};
window.__bgOn=(from,under)=>{const L=[];for(let p=from;p;p=p.parentElement){const c=__parse(getComputedStyle(p).backgroundColor);const a=c.a*__op(p);if(a>.004){L.push({...c,a:Math.min(1,a)});if(a>=.995)break}if(p===document.documentElement)break}let bg=under;for(const l of L.reverse())bg=__over(l,bg);return bg};
window.__rings=(el)=>{const out=[];let p=el;for(let d=0;p&&d<6&&p!==document.body;d++,p=p.parentElement){const cs=getComputedStyle(p);const pb=__bgOn(p.parentElement||p,{r:0,g:0,b:0,a:1});
 if(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0){const c=__parse(cs.outlineColor);if(c.a>.05)out.push({d,kind:'outline',w:parseFloat(cs.outlineWidth),off:cs.outlineOffset,color:cs.outlineColor,cr:+__ratio(__over(c,pb),pb).toFixed(2)})}
 if(parseFloat(cs.borderTopWidth)>0&&cs.borderTopStyle!=='none'){const c=__parse(cs.borderTopColor);if(c.a>.02)out.push({d,kind:'border',w:parseFloat(cs.borderTopWidth),color:cs.borderTopColor,cr:+__ratio(__over(c,pb),pb).toFixed(2)})}
 const sh=cs.boxShadow;if(sh&&sh!=='none'){const L=[];let dep=0,cur='';for(const ch of sh){if(ch==='(')dep++;if(ch===')')dep--;if(ch===','&&dep===0){L.push(cur.trim());cur=''}else cur+=ch}L.push(cur.trim());
  for(const s of L){
   // Chrome serialises box-shadow colour-first, WebKit colour-last: accept both.
   const CM=/(rgba?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)|#[0-9a-fA-F]{3,8})/;
   const cm=s.match(CM);if(!cm)continue;
   const rest=s.replace(CM,' ').trim();const ins=/inset/.test(rest);
   const n=rest.replace('inset','').trim().split(/\s+/).map(parseFloat).filter(v=>!isNaN(v));
   const[x,y,bl,sp]=n;const c=__parse(cm[1]);
   if(c.a>.05&&x===0&&y===0&&bl===0&&(ins||sp>0)){const host=ins?p:(p.parentElement||p);const hb=__bgOn(host,{r:0,g:0,b:0,a:1});out.push({d,kind:ins?'ring-inset':'ring',w:sp,color:m[1],cr:+__ratio(__over(c,hb),hb).toFixed(2)})}}}}
 return out};
window.__key=(s)=>s.d+'|'+s.kind+'|'+s.w+'|'+s.color;
window.__l=(x)=>document.querySelector('[aria-label="'+x+'"]');
window.__dbl=(el)=>{const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}))};
window.__M={};window.__B={};
window.__base=(name,sel)=>{const el=document.querySelector(sel);if(!el)return 'no element: '+sel;
 if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
 el.blur&&el.blur();window.__B[name]=sel;return 'blurred '+sel};
window.__baseline=(name)=>{const el=document.querySelector(window.__B[name]);if(!el)return 'gone';
 window.__B[name+':wasFocused']=document.activeElement===el;
 window.__B[name+':rings']=__rings(el).map(__key);
 return JSON.stringify({rings:window.__B[name+':rings'].length,stillFocused:document.activeElement===el})};
window.__measure=(name,el)=>{
 if(!el)return window.__M[name]={err:'no element'};
 const before=window.__B[name+':rings']||__rings(el).map(__key);
 // real pointer sequence then focus, so WebKit's focus-visible heuristic sees a user gesture path
 const r=el.getBoundingClientRect();const o={bubbles:true,cancelable:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2};
 el.dispatchEvent(new PointerEvent('pointerdown',o));el.dispatchEvent(new MouseEvent('mousedown',o));
 el.focus();
 el.dispatchEvent(new PointerEvent('pointerup',o));el.dispatchEvent(new MouseEvent('mouseup',o));el.dispatchEvent(new MouseEvent('click',o));
 const b=new Set(before);const after=__rings(el);
 const sig=after.filter(s=>!b.has(__key(s)));
 const abs=after.map(x=>({d:x.d,kind:x.kind,w:x.w,color:x.color,cr:x.cr}));
 return window.__M[name]={tag:el.tagName.toLowerCase(),cls:String(el.className||'').slice(0,60),label:el.getAttribute('aria-label')||el.getAttribute('placeholder')||null,
  rac:el.hasAttribute('data-rac')||!!el.closest('[data-rac]'),focused:document.activeElement===el,fv:el.matches(':focus-visible'),
  globalFallback:el.matches(':focus-visible:not(:where([data-rac]))'),
  dockHas:!!document.querySelector('.kira-dock.is-open:has(.kira-dock-input:focus)'),
  composerFW:!!document.querySelector('.composer:focus-within'),
  restCount:before.length,sigCount:sig.length,sig,abs,
  baselineWasFocused:window.__B[name+':wasFocused']};
};
const st=document.createElement('style');st.textContent='*,*::before,*::after{transition:none!important;animation-duration:0s!important}';document.head.appendChild(st);
return 'helpers ok';
})()
`
const S = (name, js, wait = 1.2) => ({ name, js, wait })
// three beats per field: blur, snapshot the rest state, then focus and diff
const T = (name, sel, extra = '') => [
  S(`${name}:blur`, `__base('${name}', ${JSON.stringify(sel)})`, 0.5),
  S(`${name}:base`, `String(__baseline('${name}'))`, 0.3),
  S(`${name}`, `JSON.stringify((()=>{const m=__measure('${name}',document.querySelector(${JSON.stringify(sel)}));${extra};return m})())`, 0.6),
]
const steps = [
  S('helpers', HELPERS),
  S('env', `JSON.stringify({ua:navigator.userAgent.slice(0,110),has:CSS.supports('selector(:has(*))'),where:CSS.supports('selector(:where(*))'),hasNot:CSS.supports('selector(:focus-visible:not(:where([data-rac])))'),dockSel:CSS.supports('selector(.kira-dock.is-open:has(.kira-dock-input:focus))'),rac:document.querySelectorAll('[data-rac]').length})`),
  S('onboarding', `(()=>{const b=document.querySelector('.onboarding-backdrop');if(!b)return 'none';const c=[...document.querySelectorAll('button,[role=button],div,span,strong')].filter(e=>e.textContent.trim().startsWith('Open the guided board'));const el=c[c.length-1];(el.closest('button,[role=button]')||el).click();return 'clicked'})()`, 2.5),
  S('seed', `(()=>{try{window.__kiraDev.resetSeed();return 'ok'}catch(e){return 'ERR '+e.message}})()`, 2.0),
  S('shell-tokens', `(()=>{const s=document.querySelector('.app-shell');return JSON.stringify({accent:s.style.getPropertyValue('--accent-cyan'),base:s.style.getPropertyValue('--bg-base'),field:s.style.getPropertyValue('--field-edge')})})()`),
  // 1. Library search
  S('lib-open', `(()=>{const b=document.querySelector('button[aria-label*="earch"]');if(!b)return 'no button';b.click();return 'ok'})()`, 1.5),
  ...T('library-search', 'input[placeholder="Search images"]'),
  // 2. Kira dock composer + dock border
  S('dock-open', `(()=>{const b=__l('Ask Kira');if(!b)return 'no button';b.click();return 'ok'})()`, 2.0),
  ...T('kira-dock-input', '.kira-dock-input'),
  S('dock-border', `(()=>{const d=document.querySelector('.kira-dock');const i=document.querySelector('.kira-dock-input');if(!d||!i)return 'missing';
    i.blur();const off=getComputedStyle(d).borderTopColor+' / '+getComputedStyle(d).borderTopWidth;
    i.focus();const on=getComputedStyle(d).borderTopColor+' / '+getComputedStyle(d).borderTopWidth;
    const pb=__bgOn(d.parentElement||d,{r:0,g:0,b:0,a:1});const c=__parse(getComputedStyle(d).borderTopColor);
    return JSON.stringify({rest:off,focused:on,changed:off!==on,cr:+__ratio(__over(c,pb),pb).toFixed(2),hasMatch:!!document.querySelector('.kira-dock.is-open:has(.kira-dock-input:focus)')})})()`, 0.8),
  S('dock-close', `(()=>{const b=document.querySelector('.kira-dock-close-btn');if(b)b.click();return !!b})()`, 1.2),
  // 3. Link popover note
  S('link-open', `(()=>{const b=document.querySelector('button[aria-label^="Select "][aria-label$=" relation"]');if(!b)return 'no link';b.click();return 'ok'})()`, 1.8),
  S('link-geo', `(()=>{const p=document.querySelector('.link-popover');if(!p)return 'no popover';
    const geo=[...p.querySelectorAll('select,textarea,input,[data-rac]')].slice(0,6).map(e=>{const r=e.getBoundingClientRect();const pr=p.getBoundingClientRect();return {t:e.tagName.toLowerCase(),w:+r.width.toFixed(1),overflow:+(r.right-pr.right).toFixed(1)}});
    return JSON.stringify({popoverW:+p.getBoundingClientRect().width.toFixed(1),geo})})()`, 0.4),
  ...T('link-note', '.link-popover textarea'),
  S('link-close', `(()=>{document.body.click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return 1})()`, 1.2),
  // 4. Tag input (node details)
  S('node-open', `(()=>{const n=document.querySelector('[data-node-kind="image"]');if(!n)return 'no node';__dbl(n);return 'ok'})()`, 2.0),
  S('tag-open', `(()=>{const b=document.querySelector('.tag-chip-add');if(!b)return 'no add';b.click();return 'ok'})()`, 1.2),
  S('tag-input', `JSON.stringify((()=>{const el=document.querySelector('.tag-chip-input');if(!el)return {err:'no element'};
    return {tag:el.tagName.toLowerCase(),cls:String(el.className).slice(0,40),rac:el.hasAttribute('data-rac')||!!el.closest('[data-rac]'),
      focused:document.activeElement===el,fv:el.matches(':focus-visible'),globalFallback:el.matches(':focus-visible:not(:where([data-rac]))'),
      abs:__rings(el),note:'only exists while focused, no rest state to diff'}})())`, 0.6),
  // 5. Kira panel composer
  S('panel-open', `(()=>{const b=__l('Open Kira panel');if(!b)return 'no button';b.click();return 'ok'})()`, 2.0),
  ...T('kira-composer', '.composer-input', `const c=document.querySelector('.composer');if(c){const cs=getComputedStyle(c);const pb=__bgOn(c.parentElement||c,{r:0,g:0,b:0,a:1});const col=__parse(cs.borderTopColor);m.containerBorder={color:cs.borderTopColor,w:cs.borderTopWidth,cr:+__ratio(__over(col,pb),pb).toFixed(2),focusWithin:!!document.querySelector('.composer:focus-within')}}`),
  S('old-panel-composer', `(()=>{const ta=document.querySelector('.composer textarea, .composer-input');const m=__measure('kira-composer-old',ta);
    const c=document.querySelector('.composer');if(c){const cs=getComputedStyle(c);const pb=__bgOn(c.parentElement||c,{r:0,g:0,b:0,a:1});const col=__parse(cs.borderTopColor);
      m.containerBorder={color:cs.borderTopColor,w:cs.borderTopWidth,cr:+__ratio(__over(col,pb),pb).toFixed(2),focusWithin:!!document.querySelector('.composer:focus-within')}}
    return JSON.stringify(m)})()`, 0.8),
  // 6. sweep: every kit field on screen, does any carry two signals or a UA bevel?
  S('sweep', `(()=>{const out=[];for(const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),textarea')){
    const r=el.getBoundingClientRect();if(r.width<4||r.height<4)continue;const cs=getComputedStyle(el);
    out.push({tag:el.tagName.toLowerCase(),label:el.getAttribute('aria-label')||el.getAttribute('placeholder')||null,rac:el.hasAttribute('data-rac'),
      border:cs.borderTopWidth+' '+cs.borderTopStyle+' '+cs.borderTopColor,minH:cs.minHeight,pad:cs.paddingTop});}
    return JSON.stringify(out)})()`),
  S('dump', `JSON.stringify(window.__M)`),
]
writeFileSync('steps.json', JSON.stringify(steps, null, 1))
console.log('steps', steps.length)

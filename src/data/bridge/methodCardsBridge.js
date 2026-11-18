/* ARUS v107 — Interaction method-card label hierarchy only; native selectors and solvers unchanged. */
(() => {
 'use strict';
 if(document.documentElement.dataset.arusModule !== 'interaction')return;
 function normalizeCardLabel(raw){
   let text=String(raw||'').trim();
   const cnt=text.match(/\s*\((\d+)\s+equations?\)\s*$/i);
   if(cnt)text=text.slice(0,cnt.index).trim();
   const parts=text.split(/\s+[—–]\s+/);
   let main=text,formula='';
   if(parts.length>=2){
     const first=parts.shift().trim(), rest=parts.join(' — ').trim();
     const looksFormula=(v)=>v.length<=12||/[·∇ₚᵦₜₘ₀∆Σλμ]/.test(v)||/\b(?:Fr|Re|KT|KQ|[CBLDT])\b/.test(v);
     if(looksFormula(first)&&!looksFormula(rest)){main=rest;formula=first;}
     else{main=first;formula=rest;}
   }
   return {main,formula,count:cnt?Number(cnt[1]):null,original:raw};
 }
 function decorate(){
   const container=document.querySelector('#groupSelect')?.parentElement?.querySelector('.arus-method-cards');
   if(!container)return;
   for(const card of container.querySelectorAll('.arus-method-card')){
     if(card.dataset.arus107Decorated==='1')continue;
     const origin=card.textContent.trim();
     if(!origin)continue;
     const fields=normalizeCardLabel(origin);
     const title=document.createElement('span');title.className='arus107-card-name';title.textContent=fields.main;
     card.replaceChildren(title);
     if(fields.formula){const desc=document.createElement('span');desc.className='arus107-card-expression';desc.textContent=fields.formula;card.append(desc);}
     if(fields.count!==null){const badge=document.createElement('span');badge.className='arus107-card-count';badge.textContent=fields.count+' equations';card.append(badge);}
     card.dataset.arus107Decorated='1';
     card.title=origin;card.setAttribute('aria-label',origin);
   }
 }
 function init(){
   const resultHeading=document.querySelector('main .sheet>section.block:nth-of-type(3) h2');
   if(resultHeading)resultHeading.textContent='Calculation Results';
   let grid=document.querySelector('#groupSelect')?.parentElement?.querySelector('.arus-method-cards');
   if(!grid){setTimeout(init,100);return;}
   let scheduled=false;
   const observer=new MutationObserver(()=>{
     if(scheduled)return;scheduled=true;
     requestAnimationFrame(()=>{scheduled=false;decorate();});
   });
   observer.observe(grid,{childList:true,subtree:true});
   decorate();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();


/* v153 UI-only source parity. Native form elements and event wiring are preserved. */
(()=>{
  'use strict';
  if(document.documentElement.dataset.arusModule!=='resistance')return;
  const sourceTables=()=>{
    for(const table of document.querySelectorAll('table:not(.arus-source-form-table)')){
      const headings=[...(table.tHead?.rows[0]?.cells||[])];
      if(headings.length<9||!table.tBodies.length||!table.querySelector('tbody input,tbody select'))continue;
      // Avoid changing engineering output tables. Only transform editable source rows.
      if(!table.closest('.arus-source-inventory,#app15-detail,#r01v51-additional,#r04app-source,#r12app-detail,#arus-unified-advanced'))continue;
      const labels=headings.map((h,i)=>h.textContent.trim()||('Column '+(i+1)));
      for(const row of table.tBodies[0].rows){
        [...row.cells].forEach((cell,i)=>cell.setAttribute('data-arus-source-label',labels[i]||('Column '+(i+1))));
      }
      table.classList.add('arus-source-form-table');
      table.style.removeProperty('min-width');
    }
  };
  const syncNativeBranch=()=>{
    const method=document.getElementById('method')?.value;
    const cards=[...document.querySelectorAll('.arus-hull-card')];
    const branch=method==='R08'?document.getElementById('planingVariant')?.value:
                 method==='R09'?document.getElementById('catFamily')?.value:null;
    let active=null;
    for(const card of cards){
      const match=card.dataset.methodValue===method&&(!card.dataset.branchValue||card.dataset.branchValue===branch);
      card.setAttribute('aria-pressed',String(match));
      const glyph=card.querySelector('.arus-hull-selected-glyph');
      if(match&&!glyph){const g=document.createElement('span');g.className='arus-hull-selected-glyph';g.textContent='✓';card.appendChild(g);}
      else if(!match&&glyph)glyph.remove();
      if(match)active=card;
    }
    if(active){const display=document.querySelector('.arus-hull-current-name');if(display)display.textContent=active.querySelector('.hull-card-title')?.textContent||display.textContent;}
  };
  document.addEventListener('DOMContentLoaded',()=>{
    document.addEventListener('change',e=>{
      if(e.target?.id==='planingVariant'||e.target?.id==='catFamily')requestAnimationFrame(syncNativeBranch);
      if(e.target?.id==='method')setTimeout(()=>{sourceTables();syncNativeBranch();},230);
    });
    let queued=false;
    new MutationObserver(()=>{
      if(queued)return;queued=true;
      setTimeout(()=>{queued=false;sourceTables();},210);
    }).observe(document.body,{childList:true,subtree:true});
    sourceTables();
  });
})();

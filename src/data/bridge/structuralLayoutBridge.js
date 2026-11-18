/* ARUS v104 — structural presentation normalization, source calculations unchanged. */
(() => {
 'use strict';
 const module=document.documentElement.dataset.arusModule;
 if(!['resistance','model-test','interaction','selection'].includes(module))return;
 const $=s=>document.querySelector(s);
 function el(tag, cls, label){const n=document.createElement(tag);if(cls)n.className=cls;if(label)n.textContent=label;return n;}
 function defer(cb){requestAnimationFrame(()=>setTimeout(cb,0));}
 function modelTest(){
   const layout=$('main.layout'),left=layout?.querySelector(':scope>.col:first-child');
   if(!left||$('#arus104-model-input-shell'))return;
   const sections=[...left.querySelectorAll(':scope>section.panel')];
   if(sections.length<3)return;
   const [methodPanel,geometryPanel,testPanel]=sections;
   const advanced=left.querySelector(':scope>#arus-unified-advanced');
   const run=left.querySelector(':scope>.arus-flow-bottom-actions');
   const shell=el('section','arus104-model-input-shell');shell.id='arus104-model-input-shell';
   shell.append(el('h2','arus104-panel-title','Calculation Parameters'));
   methodPanel.after(shell);
   shell.append(geometryPanel,testPanel);
   if(advanced)shell.append(advanced);
   if(run){run.classList.add('arus104-run-row');shell.append(run);}
   document.body.classList.add('arus104-workspace');
 }
 function interaction(){
   const sections=[...document.querySelectorAll('main .sheet>section.block')];
   if(sections.length<3)return;
   const [methodBox,inputBox,resultBox]=sections;
   if(inputBox.querySelector('.arus104-selected-strip'))return;
   const summary=el('div','arus104-selected-strip');
   const text=el('div');text.append(el('span','arus104-selected-label','Selected method'));
   const title=el('strong');title.textContent='Select a method';text.append(title);
   const change=el('button',null,'Change method');change.type='button';
   change.addEventListener('click',()=>$('#arus-flow-change-interaction')?.click());
   summary.append(text,change);
   inputBox.prepend(summary);
   const update=()=>{
     const stage=inputBox.hidden?'method':resultBox.hidden?'input':'result';
     const key='arus104-stage-'+stage;
     for(const cls of ['arus104-stage-method','arus104-stage-input','arus104-stage-result'])document.body.classList.toggle(cls,cls===key);
     const group=$('#groupSelect');
     const opt=group?.selectedOptions?.[0];
     if(opt){
       const raw=String(opt.textContent||'').trim();
       // Show actual method name without repeating the entire formula inventory.
       const short=raw.length>115?raw.slice(0,112).trim()+'…':raw;
       title.textContent=short||'Selected method';
       title.title=raw;
     }
   };
   new MutationObserver(update).observe(inputBox,{attributes:true,attributeFilter:['hidden']});
   new MutationObserver(update).observe(resultBox,{attributes:true,attributeFilter:['hidden']});
   $('#groupSelect')?.addEventListener('change',()=>defer(update));
   $('#typeSelect')?.addEventListener('change',()=>defer(update));
   methodBox.addEventListener('click',()=>defer(update));
   inputBox.addEventListener('click',()=>defer(update));
   update();
   document.body.classList.add('arus104-workspace');
 }
 function resistance(){
   const method=$('#method');if(!method)return;
   const node=$('#vesselFields');
   const advanced=$('#arus-unified-advanced');
   if(!node||!advanced)return;
   // Keep all original appendage controls in the DOM; collapse only their presentation.
   function pack(){
     const native=$('#arus-simple-app');
     const old=$('.arus104-resistance-fold');
     if(old&&!old.querySelector('#arus-simple-app'))old.remove();
     if(!native||native.closest('.arus104-resistance-fold'))return;
     const details=el('details','arus104-resistance-fold');
     details.append(el('summary',null,'Appendage Configuration'));
     native.before(details);details.append(native);
   }
   const observer=new MutationObserver(()=>{
     // The source method recreates appendage controls after a method change.
     if($('#arus-simple-app')&&!$('#arus-simple-app').closest('.arus104-resistance-fold'))defer(pack);
     else if($('.arus104-resistance-fold')&&!$('.arus104-resistance-fold #arus-simple-app'))defer(pack);
   });
   observer.observe(node,{subtree:true,childList:true});
   method.addEventListener('change',()=>setTimeout(pack,190));
   setTimeout(pack,280);
   document.body.classList.add('arus104-workspace');
 }
 function selection(){
   // Keep the native solver forms, and leave numerical results untouched.
   document.body.classList.add('arus104-workspace');
 }
 function boot(){
   if(module==='model-test')modelTest();
   if(module==='interaction')interaction();
   if(module==='resistance')resistance();
   if(module==='selection')selection();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80),{once:true});
 else setTimeout(boot,80);
})();

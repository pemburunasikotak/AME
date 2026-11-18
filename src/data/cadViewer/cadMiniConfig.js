document.addEventListener('DOMContentLoaded',()=>{
 const toolbar=document.querySelector('nav.view-tabs');if(!toolbar||document.getElementById('arus-propcad-reference'))return;
 const btn=document.createElement('button');btn.type='button';btn.id='arus-propcad-reference';
 btn.textContent='PropCad sample';btn.title='Apply the geometry dimensions in the PropCad screenshots. Runs the original C/WASM geometry engine; not merely a visual overlay.';
 const fit=document.getElementById('fitBtn');if(fit)fit.before(btn);else toolbar.appendChild(btn);
 btn.addEventListener('click',()=>{
  const vals={0:234.95,1:.7962,2:.8406,3:67,4:15,8:4};let touched=[];
  for(const [id,value] of Object.entries(vals)){const input=document.querySelector('[data-cfg=\"'+id+'\"]');if(input){input.value=value;touched.push(input)}}
  const name=document.getElementById('projectName');if(name)name.value='PropCad screenshot reference';
  if(touched.length)touched.at(-1).dispatchEvent(new Event('change',{bubbles:true}));
  btn.textContent='PropCad sample loaded';btn.setAttribute('aria-pressed','true');
  setTimeout(()=>{document.getElementById('fitBtn')?.click()},650);
 });
});

(()=>{
 'use strict';
 const familyMap={b:0,gawn:4,kaplan:5,mau:12,mauw:13};
 let pending=null,started=false;
 const setCfg=(id,value)=>{
   const field=document.querySelector('[data-cfg="'+id+'"]');
   if(!field||value===undefined||value===null)return null;
   if(field.tagName==='SELECT'){
     const opt=Array.from(field.options).find(o=>String(o.value)===String(value))||Array.from(field.options).find(o=>o.textContent.trim().toLowerCase()===String(value).toLowerCase());
     if(!opt)return null;
     field.value=opt.value;
   }else field.value=String(value);
   return field;
 };
 function send(type,detail={}){try{parent.postMessage({channel:'arus-native-cad-v105',type,...detail},'*')}catch{}}
 function apply(cfg){
   if(!started){pending=cfg;return}
   if(!cfg||!Object.hasOwn(familyMap,cfg.family)){
     const canvas=document.getElementById('glCanvas');
     if(canvas)canvas.style.opacity='.12';
     send('unavailable',{reason:cfg?.error||'Unsupported series'});return;
   }
   const canvas=document.getElementById('glCanvas');if(canvas)canvas.style.opacity='1';
   // Keep exactly the native CAD shape engine and its event-driven configuration form.
   const vals={0:Number(cfg.diameterMm)||1000,1:Number(cfg.ae),2:Number(cfg.pd),3:Number(cfg.hubMm)||0,4:Number(cfg.rakeDeg??15),8:Number(cfg.blades),9:familyMap[cfg.family],17:Number(cfg.rotation)||0};
   const preset=document.querySelector('[data-cfg="9"]');
   if(preset){setCfg(9,vals[9]);preset.dispatchEvent(new Event('change',{bubbles:true}));}
   let last=null;
   for(const [key,value] of Object.entries(vals)){
      if(+key===9||!Number.isFinite(value))continue;
      last=setCfg(key,value)||last;
   }
   if(last)last.dispatchEvent(new Event('change',{bubbles:true}));
   const b=document.getElementById('fitBtn');if(b)setTimeout(()=>{b.click();setTimeout(()=>window.__arusCam?.zoom(1.25),90)},220);
   send('rendered',{config:cfg});
 }
 window.addEventListener('message',ev=>{
   const m=ev.data;
   if(m?.channel==='arus-native-cad-v105'&&m.type==='configuration')apply(m.config);
 });
 function ready(){
   if(started)return;
   const preset=document.querySelector('[data-cfg="9"]');
   if(!preset || !preset.options.length)return;
   const canvas=document.getElementById('glCanvas');
   if(!canvas)return;
   started=true;
   if(pending){const value=pending;pending=null;apply(value)}
   send('ready');
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const toolbar=document.querySelector('.viewer-controls');
  if(toolbar){const home=document.getElementById('fitBtn');if(home)home.textContent='Fit';}
  const control=document.getElementById('arus-view-layer-controls');if(control)control.style.display='none';
  setTimeout(ready,90);setInterval(ready,250);
 });
})();

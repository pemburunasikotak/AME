/* ARUS-native-CAD-v105: replaces old illustrated previews with actual CAD Geometry C/WASM. */
(() => {
 const module=document.documentElement.dataset.arusModule;
 if(!['performance','selection'].includes(module))return;
 const $=id=>document.getElementById(id);
 const valid=x=>Number.isFinite(Number(x))&&Number(x)>0;
 const isVisible=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getClientRects().length>0;
 function familyOf(raw){
   const s=String(raw||'').toLowerCase();
   if(s==='b')return 'b';
   if(/nau/.test(s))return 'mau'; // NAU: MAU-based *visual approximation*, Z is read from selected NAU parameters.
   if(/mauw/.test(s))return 'mauw';
   if(/mau/.test(s))return 'mau';
   if(/kaplan|nozzle|\bka[3-7][0-9]/.test(s))return 'kaplan';
   if(/gawn/.test(s))return 'gawn';
   if(/b.series|wageningen|\bb[3-7][\-\s]/.test(s))return 'b';
   return null;
 }
 const cadPreviewOverrides={performance:{hub:null,rake:15,rotation:0},kt:{hub:null,rake:15,rotation:0},kq:{hub:null,rake:15,rotation:0}};
 const uiNumber=(value,decimals=2)=>Number.isFinite(Number(value))?Number(value).toFixed(decimals):'–';
 function previewModeKey(mode){return module==='performance'?'performance':mode;}
 function updateCadDesignInputs(mode, cfg){
   if(!cfg||!cfg.family)return;
   const key=previewModeKey(mode);
   const viewRoot=module==='performance'?$('arus-performance-chartWrap') : $(key+'-chartWithPreview');
   if(!viewRoot)return;
   let panel=$('arus-cad-input-'+key);
   if(!panel){
     panel=document.createElement('section');
     panel.className='arus-cad-design-preview';
     panel.id='arus-cad-input-'+key;
     panel.innerHTML=`<div class="arus-cad-input-title">Design inputs</div>
       <div class="arus-cad-input-grid top">
         <label>Design mode<input type="text" value="Default design" readonly></label>
         <label>Source preset<input data-out="preset" type="text" readonly></label>
       </div><div class="arus-cad-input-caption">PRINCIPAL DIMENSIONS</div>
       <div class="arus-cad-input-grid">
         <label>Diameter D (mm)<input type="text" data-out="diameter" readonly></label>
         <label>Blade count Z<input type="text" data-out="blades" readonly></label>
         <label>Target EAR (AE/A₀)<input type="text" data-out="ear" readonly></label>
         <label>Target pitch 0.7R / D<input type="text" data-out="pd" readonly></label>
         <label>Hub diameter (mm)<input type="number" min="0" step="5" data-edit="hub"></label>
         <label>Rake of GL aft (deg)<input type="number" min="-79" max="79" step="1" data-edit="rake" value="15"></label>
         <label>Rotation<select data-edit="rotation"><option value="0">RIGHT HAND</option><option value="1">LEFT HAND</option></select></label>
       </div><div class="arus-cad-design-note">Diameter, blade count, EAR and P/D follow the selected calculation configuration. Hub, rake and rotation adjust only this 3D CAD visualization; they do not change KT, KQ, efficiency or candidate ranking.</div>`;
     viewRoot.parentElement.insertBefore(panel,viewRoot);
     const values=cadPreviewOverrides[key];
     // The native CAD project has hub=0, rake=15 and right-hand rotation as its initial values.
     panel.querySelector('[data-edit="hub"]').value=values.hub===null?0:values.hub;
     panel.querySelector('[data-edit="rake"]').value=values.rake;
     panel.querySelector('[data-edit="rotation"]').value=String(values.rotation);
     panel.querySelectorAll('[data-edit]').forEach(field=>field.addEventListener('change',()=>{
       const val=Number(field.value);
       const type=field.dataset.edit;
       if(!Number.isFinite(val))return;
       if(type==='hub')values.hub=Math.max(0,val);
       if(type==='rake')values.rake=Math.max(-79,Math.min(79,val));
       if(type==='rotation')values.rotation=val===1?1:0;
       const target=module==='performance'?null:key;
       updateNative(target||'');
     }));
   }
   const attr={preset:cfg.cadPreset||cfg.family,diameter:uiNumber(cfg.diameterMm,0),blades:String(cfg.blades),ear:uiNumber(cfg.ae,2),pd:uiNumber(cfg.pd,2)};
   for(const [k,val] of Object.entries(attr)){
     const field=panel.querySelector('[data-out="'+k+'"]');if(field&&field.value!==val)field.value=val;
   }
   const values=cadPreviewOverrides[key];
   cfg.hubMm=values.hub===null?0:values.hub;
   cfg.rakeDeg=values.rake;
   cfg.rotation=values.rotation;
 }
 function performanceCfg(){
   const familyLabel=$('family')?.selectedOptions?.[0]?.textContent||'';
   const variant=$('variant')?.value||'';
   const m=window.ARUS_Module02_Test?.models?.[variant]||{};
   const family=familyOf(m.family||familyLabel);
   return {family,cadPreset:family==='mau'?'MAU':family==='b'?'B-Series':family==='gawn'?'Gawn':family==='kaplan'?'Kaplan':familyLabel,blades:Number($('z')?.value||m.z),ae:Number($('ear')?.value||m.ear),pd:Number($('pd')?.value||m.pd),diameterMm:1000,nozzle:/nozzle|kaplan/i.test(familyLabel),error:!family?'This series has no matching blade geometry preset in CAD Geometry. No substitute shape is shown.':undefined};
 }
 function selectionCfg(mode){
   const state=(mode==='kt'?window.__ARUS_KT__:window.__ARUS_INVERSE__)?.getState?.();
   const r=state?.selected;
   if(!r)return null;
   const family=familyOf(r.type||r.config||r.model);
   const D=mode==='kt'?Number(state.inputs?.D):Number(r.D);
   return {family,cadPreset:family==='mau'?'MAU':family==='b'?'B-Series':family==='gawn'?'Gawn':family==='kaplan'?'Kaplan':String(r.type||family),blades:Number(r.Z),ae:Number(r.ae),pd:Number(r.pd),diameterMm:valid(D)?D*1000:1000,nozzle:/nozzle|kaplan/i.test(String(r.type||'')),error:!family?'No supported CAD preset for this candidate family; 3D geometry is not substituted.':undefined};
 }
 function makeFrame(box){
   if(box.querySelector('iframe.arus-native-cad-frame'))return box.querySelector('iframe.arus-native-cad-frame');
   const old=box.querySelector('canvas');
   if(old){old.style.display='none';old.setAttribute('aria-hidden','true');}
   const frame=document.createElement('iframe');
   frame.className='arus-native-cad-frame';
   frame.title='3D geometry rendered by Propeller CAD Geometry engine';
   frame.style.cssText='display:block;width:100%;height:560px;border:0;border-radius:8px;background:#f7fbfd;overflow:hidden;';
   frame.loading='eager';
   frame.scrolling='no';
   frame.setAttribute('allow', 'fullscreen');
   frame.setAttribute('allowfullscreen', 'true');
   frame.setAttribute('sandbox','allow-scripts allow-same-origin');
   box.style.minHeight='560px';
   box.appendChild(frame);
   try{frame.srcdoc=parent.__ARUS_CAD_NATIVE_VIEWER_DOC__();}catch(e){frame.srcdoc='<p>Unable to load native CAD renderer: '+String(e.message||e)+'</p>';}
   frame.addEventListener('load',()=>{
    const doc=frame.contentDocument;
    if(doc && !frame.__arusHideSeriesLabels){
      frame.__arusHideSeriesLabels=true;
      const hide=()=>{
        const stat=doc.getElementById('stat');
        if(stat){stat.textContent='';stat.style.display='none';}
      };
      hide();
      try{
        doc.documentElement.style.overflow='hidden';
        doc.body.style.overflow='hidden';
        doc.body.style.margin='0';
        const frameEl=doc.querySelector('.frame');
        if(frameEl){
          frameEl.style.minHeight='0';
          frameEl.style.height='100%';
          frameEl.style.overflow='hidden';
        }
        const cad=doc.getElementById('cad');
        if(cad){
          cad.style.height='100%';
          cad.style.minHeight='0';
          cad.style.maxHeight='none';
        }
        const status=doc.getElementById('status');
        if(status)status.style.display='none';
        const extra=doc.createElement('style');
        extra.textContent='html,body{height:100%!important;width:100%!important;margin:0!important;overflow:hidden!important} .frame{display:flex!important;flex-direction:column!important;height:100%!important;min-height:0!important;overflow:hidden!important;box-sizing:border-box!important}.arus-cad-stage{display:block!important;flex:1 1 0!important;min-height:0!important} #cad{display:block!important;width:100%!important;height:100%!important;max-height:none!important;min-height:0!important} .bar,.controls{flex:0 0 auto!important} .controls{padding-top:6px!important} #stat,#status{display:none!important}::-webkit-scrollbar{width:0!important;height:0!important;display:none!important} body{scrollbar-width:none!important;-ms-overflow-style:none!important}';
        doc.head.appendChild(extra);
      }catch{}
      try{new MutationObserver(hide).observe(doc.body,{subtree:true,childList:true,characterData:true});}catch{}
    }
    const config=frame.__cadConfig;
    if(config)frame.contentWindow?.postMessage({channel:'arus-native-cad-v105',type:'configuration',config},'*')
   });
   return frame;
 }
 function updateNative(prefix){
   const id=module==='performance'?'arus-performance-preview':prefix+'-propPreviewCard';
   const card=$(id);
   const box=card?.querySelector('.arus-prop-canvas-wrap');
   if(!box)return;
   const hint=card.querySelector('[data-role="detail"]');
   if(hint)hint.textContent='Rendered by the Propeller CAD Geometry C/WebAssembly engine. Blade form is generated from CAD preset and configuration; the performance coefficients are calculated independently.';
   const foot=card.querySelector('.arus-prop-mini');
   if(foot)foot.textContent='Native CAD surface mesh. Drag to rotate, scroll to zoom. Changing the 3D view does not affect the calculation.';
   let frame=makeFrame(box);
   const cfg=module==='performance'?performanceCfg():selectionCfg(prefix);
   if(cfg)updateCadDesignInputs(prefix,cfg);
   const frozen=JSON.stringify(cfg);
   if(frame.__lastCfg===frozen)return;
   frame.__lastCfg=frozen;
   const config=cfg||{family:null,error:'Run calculation and choose a propeller to view its geometry.'};
   frame.__cadConfig=config;
   try{frame.contentWindow?.postMessage({channel:'arus-native-cad-v105',type:'configuration',config},'*')}catch{}
 }
 function init(){
  let pending=false;
  const update=()=>{
   if(pending)return;pending=true;
   setTimeout(()=>{pending=false;if(module==='performance')updateNative('');else {updateNative('kt');updateNative('kq');}},80);
  };
  update();setTimeout(update,300);setTimeout(update,1500);
  // React to actual selection state (ranking, grouped best, solver updates) and performance configuration changes.
  document.addEventListener('input',update,true);document.addEventListener('change',update,true);document.addEventListener('click',update,true);
  document.addEventListener('submit',()=>setTimeout(update,1600),true);
  window.addEventListener('resize',update);
  if(module==='selection'){
   for(const mode of ['kt','kq']){
    for(const id of [mode+'-selectedName',mode+'-selectedMeta']){
     const node=$(id);if(node)new MutationObserver(update).observe(node,{childList:true,characterData:true,subtree:true});
    }
   }
  }
  window.addEventListener('message',event=>{
    const d=event.data;
    if(d?.channel!=='arus-native-cad-v105'||d.type!=='ready')return;
    for(const frame of document.querySelectorAll('iframe.arus-native-cad-frame')){
      if(frame.contentWindow===event.source&&frame.__cadConfig)frame.contentWindow.postMessage({channel:'arus-native-cad-v105',type:'configuration',config:frame.__cadConfig},'*');
    }
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

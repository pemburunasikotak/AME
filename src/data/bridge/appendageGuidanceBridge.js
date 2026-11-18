/* ARUS v100 appendage visibility and reference guidance, UI-only.
   Evidence: Lothar Birk (2019) pp. 615-616 (§50.2.1); pp. 630-631, 637-638 (§51.2.6).
   The 12 standalone Excel sources remain the numerical authority for their branches.
   No engineering constants, calculations, source input values or output results changed.
*/
(() => {
 'use strict';
 const books = {
  R01:{kind:'workbook',heading:'Harvald — method-specific correction',description:'The source workbook uses Harvald-specific added wetted area and correction terms. It does not use the Holtrop (1+k₂) database as its governing formula.',reference:'01_Harvald_Standalone.xlsx; Harvald (1983) book treatment not yet verified for this exact workbook branch.'},
  R02:{kind:'integrated',heading:'Holtrop–Mennen — integrated appendage resistance',description:'The method explicitly includes RAPP based on wetted area, appendage form factors and a separate bow-thruster tunnel term. Add only components actually fitted to the vessel and not counted elsewhere.',reference:'Birk (2019), §50.2.1, pp. 615–616, Eq. 50.16–50.18 (Holtrop 1988 factor table).'},
  R03:{kind:'integrated',heading:'Hollenbach — selected appendages and transverse thrusters',description:'Include exposed shafts, brackets, bossings, fins, bilge keels and thruster openings when applicable. Rudders and skegs already represented by the Hollenbach hull wetted-surface estimate must not be added again.',reference:'Birk (2019), §51.1.2, pp. 630–631, and §51.2.6, pp. 637–638.'},
  R04:{kind:'external',heading:'Series 60 / BSRA — bare-hull regression',description:'No universal appendage factor is part of the regression selector. Do not add Holtrop (1+k₂) automatically; only use a separately justified resistance allowance supported by the applicable source.',reference:'04_Series60_BSRA_Standalone.xlsx; original appendage treatment not yet verified against a book.'},
  R05:{kind:'external',heading:'Van Oortmerssen — optional external resistance',description:'The source workbook has an optional RAPP path separate from its empirical hull regression. This is not proof that the original method prescribes Holtrop appendage factors.',reference:'05_Oortmerssen_Standalone.xlsx; van Oortmerssen (1971) original appendage treatment not fully verified.'},
  R06:{kind:'external',heading:'NPL / Series 64 — separate allowance only',description:'No universal appendage selector should be imposed on the underlying series coefficients. The workbook inventory feeds source controls; use additional resistance only where explicitly supported.',reference:'06_NPL_Series64_Standalone.xlsx; original series book/documentation not yet verified.'},
  R07:{kind:'external',heading:'NTUA Double-Chine — additional resistance',description:'The source workbook provides an optional additional-resistance path. The method regression itself does not establish a universal Holtrop appendage input.',reference:'07_NTUA_Standalone.xlsx; original NTUA method appendage guidance not yet verified.'},
  R08:{kind:'external',heading:'Savitsky / Series 62 — planing hull, no generic (1+k₂)',description:'Savitsky predicts hydrodynamic planing-surface resistance; add separate component drag only when supported by the source calculation. Series 62 must not receive an arbitrary duplicate appendage correction.',reference:'Savitsky (1964), Hydrodynamic Design of Planing Hulls; 08_Savitsky_Series62_Standalone.xlsx.'},
  R09:{kind:'external',heading:'Catamaran — source-family dependent',description:'Use only the family-specific external resistance controls provided by the workbook. Do not automatically add a universal appendage inventory to the Southampton/VWS regression.',reference:'09_Southampton_VWS_Catamaran_Standalone.xlsx; original family-specific appendage guidance not yet verified.'},
  R10:{kind:'component',heading:'Delft Yacht — keel and rudder components',description:'Keel and rudder are treated by the yacht calculation as special components. Use their source inputs; do not duplicate their resistance via a generic Holtrop appendage factor.',reference:'Gerritsma, Onnink & Versluis (1981), Delft Systematic Yacht Hull Series; 10_Delft_Yacht_Standalone.xlsx.'},
  R11:{kind:'component',heading:'Submarine / AUV — drag components',description:'Hull and external components are handled through their own drag terms (for example sail and additional exposed devices), not a common Holtrop (1+k₂) inventory.',reference:'11_Submarine_AUV_Standalone.xlsx; exact book section not yet verified.'},
  R12:{kind:'component',heading:'Hydrofoil — foil and strut resistance',description:'Foils and supports are essential calculation components in the source method. Their original drag/lift inputs remain in the normal calculation; a generic appendage inventory would double count.',reference:'12_Hydrofoil_Standalone.xlsx; exact book section not yet verified.'}
 };
 const el=(s)=>document.querySelector(s);
 let lastMethod='';let pending=0;
 const style=document.createElement('style');style.id='arus100-appendage-style';style.textContent=`
 #arus-appendage-reference{grid-column:1/-1;display:block;margin:14px 0 10px;padding:15px 17px;background:#f3f8fa;border:1px solid #d9e8ed;border-left:3px solid #168b98;border-radius:9px;color:#2b5364}
 #arus-appendage-reference .ref-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
 #arus-appendage-reference strong{font-size:12px;color:#194459}
 #arus-appendage-reference .ref-badge{background:#e8f4f5;border:1px solid #cee6e9;border-radius:12px;color:#347780;font-size:10px;font-weight:700;padding:4px 9px}
 #arus-appendage-reference p{font-size:11.5px;line-height:1.65;margin:8px 0;color:#557587}
 #arus-appendage-reference small{font-size:10px;color:#7b929e;line-height:1.5;display:block}
 body.arus100-no-quick-appendages #arus-simple-app{display:none!important}
 body.arus100-harvald #arus-simple-app .arus-app-heading>span:nth-child(4),
 body.arus100-harvald #arus-simple-app .arus-app-row>input:nth-child(4){display:none!important}
 body.arus100-harvald #arus-simple-app .arus-app-row,
 body.arus100-harvald #arus-simple-app .arus-app-heading{grid-template-columns:minmax(185px,2fr) minmax(64px,.55fr) minmax(105px,.8fr) minmax(90px,1fr) 35px}
 #arus-simple-app .arus100-rudder-warning{font-size:11px;line-height:1.6;color:#945f25;background:#fff5e8;border:1px solid #ebd6b6;border-radius:7px;padding:10px 12px;margin:8px 0}
 @media(max-width:800px){body.arus100-harvald #arus-simple-app .arus-app-row{grid-template-columns:1fr 80px 105px 34px}}
 `;document.head.append(style);
 function apply(){
  if(document.documentElement.dataset.arusModule!=='resistance')return;
  const method=el('#method')?.value;
  const conf=books[method];if(!conf)return;
  const workspace=el('#view-calculator');
  const parent=el('#methodInputs')?.parentElement||workspace;if(!parent)return;
  document.body.classList.toggle('arus100-no-quick-appendages',!['R01','R02','R03'].includes(method));
  document.body.classList.toggle('arus100-harvald',method==='R01');
  let notice=el('#arus-appendage-reference');
  if(!notice){notice=document.createElement('section');notice.id='arus-appendage-reference';notice.setAttribute('aria-live','polite');}
  const status=['R02','R03'].includes(method)?'Confirmed in Birk (2019)':(method==='R01'?'Workbook correction':'Source-specific / book review pending');
  const family=method==='R09'?(el('#catFamily')?.value||'Southampton'):'';
  const hint=method==='R09'?` Selected regression family: ${family}.`:'';
  notice.innerHTML='';
  const top=document.createElement('div');top.className='ref-top';
  const title=document.createElement('strong');title.textContent=conf.heading;
  const badge=document.createElement('span');badge.className='ref-badge';badge.textContent=status;top.append(title,badge);
  const p=document.createElement('p');p.textContent=conf.description+hint;
  const small=document.createElement('small');small.textContent='Reference: '+conf.reference;
  notice.append(top,p,small);
  // Place above the input panel: clear method context without obscuring the method selector.
  const native=el('#arus-simple-app');
  if(native?.parentElement===parent)parent.insertBefore(notice,native);
  else if(el('#methodInputs')?.parentElement===parent)parent.insertBefore(notice,el('#methodInputs').nextSibling);
  else parent.prepend(notice);
  if(native){
    if(method==='R01'){
      const desc=native.querySelector('.arus-app-lead');if(desc)desc.textContent='Appendage wetted area and Harvald-specific factors from the source workbook; Holtrop (1+k₂) is not used here.';
    }else if(method==='R02'){
      const desc=native.querySelector('.arus-app-lead');if(desc)desc.textContent='Add only installed appendages and specify their actual wetted area. Factors are taken from the source Excel table; compare them against the cited book before scientific use.';
    }else if(method==='R03'){
      const desc=native.querySelector('.arus-app-lead');if(desc)desc.textContent='Add eligible appendages only. Do not re-add rudders or skegs already represented in the hull wetted surface.';
      for(const choice of native.querySelectorAll('.arus-app-type')){
        for(const opt of choice.options){
          if(/rudder|skeg/i.test(opt.value)){
            opt.disabled=opt.value!==choice.value;
            opt.title='Hollenbach rudder/skeg inclusion requires a wetted-area check (Birk 2019, pp. 631, 637).';
          }
        }
      }
      const used=[...native.querySelectorAll('.arus-app-type')].some(x=>/rudder|skeg/i.test(x.value));
      let warning=native.querySelector('.arus100-rudder-warning');
      if(used){
        if(!warning){warning=document.createElement('div');warning.className='arus100-rudder-warning';native.append(warning);}
        warning.textContent='Warning: rudder/skeg selected while Hollenbach can already include it in the hull wetted surface. Confirm S definition before Run to prevent double counting.';
      }else warning?.remove();
    }
  }
  lastMethod=method;
 }
 function queue(){clearTimeout(pending);pending=setTimeout(apply,200)}
 document.addEventListener('DOMContentLoaded',()=>{queue();setTimeout(apply,650);setTimeout(apply,1200);const box=el('#methodInputs');if(box)new MutationObserver(()=>{if(el('#arus-appendage-reference')?.isConnected)queue()}).observe(box,{childList:true});});
 document.addEventListener('change',event=>{if(event.target?.id==='method'||event.target?.id==='catFamily')queue()},true);
 document.addEventListener('click',event=>{if(event.target.closest('#arus-simple-app,.arus-hull-card,#reset'))queue()},true);
 window.ARUS_APPENDAGE_REFERENCE_UI={version:'v100',sourcePolicy:books,numericalEngineChanged:false,refresh:apply};
})();

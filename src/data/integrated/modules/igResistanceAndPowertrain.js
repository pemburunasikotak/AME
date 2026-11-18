  function igResistanceVs(){
    if(!ig.resistance)return NaN;
    const i=ig.resistance.inputs||{},o=ig.resistance.outputs||{};
    const candidates=[i.Vs,i.VS,i.vs,i.speed_knots,i.shipSpeedKnots,o.Vs_kn,o.Vs_knots,o.ship_speed_knots];
    const first=candidates.map(Number).find(x=>Number.isFinite(x)&&x>0);
    return first===undefined?NaN:first;
  }
  function igLockSpeed(){const v=igResistanceVs();igF('vs').value=Number.isFinite(v)?String(v):'';igF('vs').readOnly=true;}
  function igUpdateSources(){
    igLockSpeed();
    igF('name').value=ig.name||'Untitled design';igF('project-label').textContent=ig.name||'Untitled design';
    igF('db-status').textContent=`OEM v24 · ${igCatalogCounts.ratings.toLocaleString('en-US')} ratings · ${igData.stats.mprating} conditional · ${igCatalogCounts.preliminary} digitized · ${igCatalogCounts.archiveNumeric} archive numeric M`;
    igF('r-status').textContent=ig.resistance?(ig.resistance.is_demo?`DEMO HISTORY · ${ig.resistance.method_id}`:`SAVED HISTORY · ${ig.resistance.method_id}`):'No History selected';
    igF('r-status').classList.toggle('ready',!!ig.resistance&&!ig.resistance.is_demo);
    igF('r-status').classList.toggle('ig-demo-source',igHasDemoSource());
    igF('r-source').textContent=ig.resistance?`Saved ${igFmt(ig.resistance.outputs?.RT_N/1000,2)} kN at ${igFmt(igResistanceVs(),2)} kn · ${(ig.nativeSweep||[]).filter(p=>p.rt>0).length}/4 speed points`:'Resistance History only';
    igF('rt').value=ig.resistance?igFmt(ig.resistance.outputs?.RT_N/1000,3):'';
    const w=ig.wake.filter(x=>x.family==='wake'&&igFinite(x.value)&&x.value>=0&&x.value<1),
          t=ig.wake.filter(x=>x.family==='thrust'&&igFinite(x.value)&&x.value>=0&&x.value<1);
    function dropdown(which,items,key){const el=igF(which+'-method'),val=ig[key];el.innerHTML='<option value="">Manual value</option>'+items.map(x=>`<option value="${igEsc(x.key)}">${igEsc(x.name)} (${igFmt(x.value,4)})</option>`).join('');el.value=items.some(x=>x.key===val)?val:''}
    dropdown('w',w,'wakeChoice');dropdown('t',t,'thrustChoice');
    igF('w-status').textContent=ig.resistance?.is_demo?`DEMO · ${w.length} wake / ${t.length} thrust options`:`${w.length} wake / ${t.length} thrust results`;
    igF('w-status').classList.toggle('ready',!!w.length&&!!t.length);
    igF('s-status').textContent=igLast&&ig.prop?`${ig.prop.mode.toUpperCase()} · ${ig.prop.type} · Z=${ig.prop.Z}`:'All supported propellers will be optimised automatically';
    igF('s-status').classList.toggle('ig-demo-source',!!ig.prop?.is_demo);igF('s-status').classList.toggle('ready',!!ig.prop);
    igF('s-source').textContent=igLast&&ig.prop?`D ${igFmt(ig.prop.D,3)} m · J ${igFmt(ig.prop.j,4)} · KT ${igFmt(ig.prop.kt,4)} · KQ ${igFmt(ig.prop.kq,4)} · η₀ ${igFmt(100*ig.prop.eta,2)}%`:'No series filter; the diameter and Resistance History define the KT search.';
    igShowRankPanel();
  }
  function igUpdatePowertrainHelp(){
    const nprop=Number(igF('nprop').value),neng=Number(igF('neng').value);
    const el=igF('arrangement-help');if(!el)return;
    el.textContent=(nprop===neng
      ?`${neng} engine(s) / ${nprop} propeller(s): independent drive is a possible arrangement. Power sharing is assumed equal; gearbox ratios and duty must still be verified.`
      :`${neng} engine(s) / ${nprop} propeller(s): the calculation distributes the total drive power equally among engines. This is a preliminary equivalent-load model, NOT validation of a combining or splitting gearbox, torque balance, or real mechanical topology.`);
  }
  function igSetPowertrainCount(changed){
    igUpdatePowertrainHelp();
    if(changed==='nprop'){
      ig.prop=null;igTop20=null;igTop20Signature='';igPropList.page=0;
      igF('prop-ranks').hidden=true;
    }
    igLast=null;ig.calculatedFour=null;ig.engineId='';igF('results').hidden=true;
    igUpdateSources();igSaveForm();
    igAlert('Powertrain counts updated. Recalculate the propeller ranking and the engine loads.','info');
  }
  function igSyncArrangementFromCounts(){igUpdatePowertrainHelp()}
  const igCavDefault=['keller','burrill-2p5'];
  const igCavUniqueIds=["keller", "burrill-2p5", "burrill-lower", "burrill-merchant", "burrill-naval", "burrill-5", "burrill-10", "burrill-20", "burrill-30"];
  const igCavNames={"keller": "Keller minimum blade area", "burrill-2p5": "Burrill 2.5% back cavitation", "burrill-lower": "Burrill lower / heavy load", "burrill-merchant": "Burrill merchant 2–5%", "burrill-naval": "Burrill naval / fast craft 10–15%", "burrill-5": "Burrill 5% back cavitation (Birk)", "burrill-10": "Burrill 10% back cavitation", "burrill-20": "Burrill 20% back cavitation", "burrill-30": "Burrill 30% back cavitation"};
  // Fixed, mutually exclusive presets. Only Keller may accompany one Burrill criterion.
  const igCavPresets=Object.freeze({
  "none": [],
  "keller": [
    "keller"
  ],
  "burrill-2p5": [
    "burrill-2p5"
  ],
  "keller+burrill-2p5": [
    "keller",
    "burrill-2p5"
  ],
  "burrill-lower": [
    "burrill-lower"
  ],
  "keller+burrill-lower": [
    "keller",
    "burrill-lower"
  ],
  "burrill-merchant": [
    "burrill-merchant"
  ],
  "keller+burrill-merchant": [
    "keller",
    "burrill-merchant"
  ],
  "burrill-naval": [
    "burrill-naval"
  ],
  "keller+burrill-naval": [
    "keller",
    "burrill-naval"
  ],
  "burrill-5": [
    "burrill-5"
  ],
  "keller+burrill-5": [
    "keller",
    "burrill-5"
  ],
  "burrill-10": [
    "burrill-10"
  ],
  "keller+burrill-10": [
    "keller",
    "burrill-10"
  ],
  "burrill-20": [
    "burrill-20"
  ],
  "keller+burrill-20": [
    "keller",
    "burrill-20"
  ],
  "burrill-30": [
    "burrill-30"
  ],
  "keller+burrill-30": [
    "keller",
    "burrill-30"
  ]
});
  let igCavMigrationNote='';
  function igSelectedCavChecks(){
    return (igCavPresets[igF('cav-preset').value]||igCavDefault).slice();
  }
  function igSetCavChecks(values){
    const previous=Array.isArray(values)?values:[];
    const distinct=[...new Set(previous.filter(x=>igCavUniqueIds.includes(x)))];
    const unsupported=previous.some(x=>!igCavUniqueIds.includes(x));
    const match=unsupported?null:Object.keys(igCavPresets).find(key=>igCavPresets[key].length===distinct.length&&igCavPresets[key].every(x=>distinct.includes(x)));
    if(match){
      igF('cav-preset').value=match;
      igCavMigrationNote='';
    }else{
      igF('cav-preset').value='keller+burrill-2p5';
      igCavMigrationNote='A saved cavitation choice is no longer available. Keller + Burrill 2.5% (without custom reserves) is selected; recalculate before assessing compliance.';
    }
    igCavScreenHelp();
  }
  function igMigrateLegacyCavCriterion(value){
    const m=String(value||'both');
    const nativeToId={
      'No Cavitation Constraint':[],
      'Keller Minimum EAR':['keller'],
      'Burrill Lower / Heavy Load':['burrill-lower'],
      'Burrill Merchant 2–5%':['burrill-merchant'],
      'Burrill Naval / Fast Craft 10–15%':['burrill-naval'],
      'Burrill 2.5% Back Cavitation':['burrill-2p5'],
      'Burrill 5% Back Cavitation (Birk)':['burrill-5'],
      'Burrill 10% Back Cavitation':['burrill-10'],
      'Burrill 20% Back Cavitation':['burrill-20'],
      'Burrill 30% Back Cavitation':['burrill-30'],
            'Keller + Burrill Lower':['keller','burrill-lower'],
      'Keller + Merchant 2–5%':['keller','burrill-merchant'],
      'Keller + Naval 10–15%':['keller','burrill-naval'],
      'Keller + Burrill 5%':['keller','burrill-5']
    };
    if(m.startsWith('native:'))return nativeToId[m.slice(7)]??igCavDefault;
    return ({both:igCavDefault,keller:['keller'],burrill:['burrill-2p5'],none:[]})[m]??igCavDefault;
  }
  function igRestoreCavChecks(settings,fields){
    const preset=settings?.cavPreset;
    if(typeof preset==='string'&&Object.prototype.hasOwnProperty.call(igCavPresets,preset)){
      igF('cav-preset').value=preset;
      igCavMigrationNote=settings?.cavRuleVersion==='v45-standard'?'':'Saved cavitation selection uses updated standard thresholds; run Calculate to refresh the results.';
      igCavScreenHelp();return;
    }
    const explicit=settings?.cavChecks;
    if(Array.isArray(explicit))igSetCavChecks(explicit);
    else igSetCavChecks(igMigrateLegacyCavCriterion(fields?.['cav-mode']??settings?.['cav-mode']));
  }
  function igCavScreenHelp(){
    const selected=igSelectedCavChecks(), el=igF('cav-help'), status=igF('cav-combination-summary');
    if(status)status.textContent=selected.length===0?'No additional screening'
      :(selected.length===2?'Combination: Keller + one Burrill limit (both must pass)':'Single criterion: '+igCavNames[selected[0]]);
    if(!el)return;
    let message=selected.length===0
      ?'Additional Integration cavitation screening is OFF; other original solver constraints still apply.'
      :`Selected: ${igCavLabel()}. ${selected.length===2?'Keller and the chosen Burrill limit must both pass.':'Only the selected criterion applies.'} Check at design speed and all four stored resistance speeds. No extra safety reserve is applied.`;
    if(igCavMigrationNote)message+=' '+igCavMigrationNote;
    el.textContent=message;
  }
  function igChangeCavCriterion(){
    igCavMigrationNote='';
    igTop20=null;igTop20Signature='';igLast=null;igPropList.page=0;
    igF('results').hidden=true;igF('prop-ranks').hidden=true;
    igCavScreenHelp();igSaveForm();igAlert('Cavitation combination changed. Recalculate the propeller ranking and 4 operating points.','info');
  }
  function igSaveForm(){
    igLockSpeed();ig.name=igF('name').value.trim()||'Untitled design';
    ig.settings=Object.fromEntries(['vs','w','t','nprop','rho','nu','etas','etat','sea','depth','p0','pv','neng','margin','parasitic','readiness','service'].map(k=>[k,igF(k).value]));
    ig.settings.cavPreset=igF('cav-preset').value;
    ig.settings.cavRuleVersion='v45-standard';
    ig.settings.cavChecks=igSelectedCavChecks();
    ig.w=igF('w').value;ig.t=igF('t').value;ig.wakeChoice=igF('w-method').value;ig.thrustChoice=igF('t-method').value;
    igPersist();igF('project-label').textContent=ig.name;
  }
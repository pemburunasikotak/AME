 const $=id=>document.getElementById(id);
 const engines=JSON.parse($('arus-engines').textContent);
 const frames=new Map();let activeId=null;
  const igKey='arus.integrated.standalone.v11';
  const igHistKey='arus.integrated.4point.history.v7';
  const igDesignStoreKey='arus.integrated.named.designs.v21';
  const igData=JSON.parse($('ig-engine-catalog').textContent);
  const igPreliminaryData=JSON.parse($('ig-preliminary-mp').textContent);
  const igPreliminaryMap=new Map(igPreliminaryData.items.map(x=>[x.id,x]));
  const igExtraMData=JSON.parse($('ig-extra-m').textContent);
  const igExtraMMap=new Map(igExtraMData.items.map(x=>[x.id,x]));
  const igRatingsById=new Map(igData.rated.map(x=>[x.id,x]));
  const igCatalogCounts={ratings:igData.rated.length,power:igData.power.length,sfoc:igData.sfoc.length,preliminary:igPreliminaryMap.size,archiveNumeric:igExtraMMap.size};
  const igF=id=>$('ig-'+id),igNumber=id=>Number(igF(id).value);
  const igFinite=x=>typeof x==='number'&&Number.isFinite(x);
  const igFmt=(x,d=2)=>igFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
  const igEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const igEnglish=x=>String(x??'').replace(/\bPropulsi\b/gi,'Propulsion').replace(/\breferensi\b/gi,'reference').replace(/Tabel pabrikan langsung/gi,'Direct OEM table');
  function igLoad(){try{const p=JSON.parse(localStorage.getItem(igKey)||'{}');return p&&typeof p==='object'?p:{}}catch{return {}}}
  let ig=Object.assign({name:'Untitled design',resistance:null,wake:[],wakeChoice:'',thrustChoice:'',w:'',t:'',path:'selection',prop:null,engineId:'',settings:{},savedRun:null},igLoad());
  let igLast=null,igServicePromise=null,igSelectionBackup=null;
  let igTop20=null,igTop20Signature="",igTop20Busy=false,igRankingError='';
  let igEngineStats=null;
  const igEngineList={query:"",brand:"",page:0,pageSize:10,all:true};
  const igPropList={page:0,pageSize:10};
  const igPower=new Map(),igSfoc=new Map();
  for(const pt of igData.power){if(!igPower.has(pt.id))igPower.set(pt.id,[]);igPower.get(pt.id).push(pt)}
  for(const pt of igData.sfoc){if(!igSfoc.has(pt.id))igSfoc.set(pt.id,[]);igSfoc.get(pt.id).push(pt)}
  function igPersist(){try{localStorage.setItem(igKey,JSON.stringify({...ig,savedRun:null}))}catch(e){console.warn('Integrated storage unavailable',e)}}
  function igAlert(msg,kind='info') {const el=igF('alert');el.className='ig-alert ig-alert-'+kind;el.textContent=msg}
  const igPropSpeed=()=>igNumber('vs')*0.5144*(1-igNumber('w'));
  // Resistance is selected exclusively from previously stored snapshots.
  function igEngineDocument(engine){const bytes=Uint8Array.from(atob(engine.base64),c=>c.charCodeAt(0));return new TextDecoder('utf-8').decode(bytes)}
  const igResHistoryKey='arus.resistance.history.v1';
  const igDemoResistanceHistory=[{"id":"DEMO-RES-WORKBOAT","name":"DEMO · Offshore utility vessel","savedAt":"","method_id":"R01","is_demo":true,"source_status":"DEMONSTRATION · previously captured R01 method output","inputs":{"vs":10,"L":85,"B":14,"T":4.8,"CB":0.66,"CM":0.98,"CWP":0.8,"LCB":0,"S":1580,"volume":2900,"rho":1025,"nu":1.1892e-06,"g":9.81,"margin":0,"crstd":1.3,"ca":0,"caa":0,"sappH":0,"hCP":0.7875,"hFF":0,"hFA":0,"hFapp":0,"hABT":0,"hAM":0,"hLPP":145.35,"hLaft":5,"hLfore":5,"hLCB0":0,"hTEU":0,"hBossManual":0,"hShaftManual":0,"hOtherManual":0,"hLCBManual":0,"hBulbManual":0,"hBTManual":0,"hFormManual":0},"outputs":{"RT_N":69349.31439642717,"PE_kW":356.7633869535558,"Fr":0.17815341013027103,"Re":367707198.1163808},"calculation_usable":true,"sweep":[{"v":8,"rt":41675.45346750407,"source":"R01","status":"DEMO · stored output"},{"v":9,"rt":54065.332153712545,"source":"R01","status":"DEMO · stored output"},{"v":10,"rt":69349.31439642717,"source":"R01","status":"DEMO · stored output"},{"v":11,"rt":88732.31387640003,"source":"R01","status":"DEMO · stored output"}],"source":"Four stored example results captured from original R01 engine; replay only."},{"id":"DEMO-RES-COASTAL","name":"DEMO · Coastal cargo ship","savedAt":"","method_id":"R01","is_demo":true,"source_status":"DEMONSTRATION · previously captured R01 method output","inputs":{"vs":13.5,"L":85,"B":14,"T":4.8,"CB":0.66,"CM":0.98,"CWP":0.8,"LCB":0,"S":1580,"volume":2900,"rho":1025,"nu":1.1892e-06,"g":9.81,"margin":0,"crstd":1.3,"ca":0,"caa":0,"sappH":0,"hCP":0.7875,"hFF":0,"hFA":0,"hFapp":0,"hABT":0,"hAM":0,"hLPP":145.35,"hLaft":5,"hLfore":5,"hLCB0":0,"hTEU":0,"hBossManual":0,"hShaftManual":0,"hOtherManual":0,"hLCBManual":0,"hBulbManual":0,"hBTManual":0,"hFormManual":0},"outputs":{"RT_N":174986.9011197691,"PE_kW":1215.2829783553898,"Fr":0.24050710367586586,"Re":496404717.4571141},"calculation_usable":true,"sweep":[{"v":11.5,"rt":100577.80369344958,"source":"R01","status":"DEMO · stored output"},{"v":12.5,"rt":130737.43648131134,"source":"R01","status":"DEMO · stored output"},{"v":13.5,"rt":174986.9011197691,"source":"R01","status":"DEMO · stored output"},{"v":14.5,"rt":246723.73056231695,"source":"R01","status":"DEMO · stored output"}],"source":"Four stored example results captured from original R01 engine; replay only."},{"id":"DEMO-RES-TWIN","name":"DEMO · Twin-screw passenger vessel","savedAt":"","method_id":"R01","is_demo":true,"source_status":"DEMONSTRATION · previously captured R01 method output","inputs":{"vs":16,"L":125,"B":19,"T":6.2,"CB":0.65,"CM":0.98,"CWP":0.8,"LCB":0,"S":3600,"volume":10500,"rho":1025,"nu":1.1892e-06,"g":9.81,"margin":0,"crstd":1.3,"ca":0,"caa":0,"sappH":0,"hCP":0.7875,"hFF":0,"hFA":0,"hFapp":0,"hABT":0,"hAM":0,"hLPP":145.35,"hLaft":5,"hLfore":5,"hLCB0":0,"hTEU":0,"hBossManual":0,"hShaftManual":0,"hOtherManual":0,"hLCBManual":0,"hBulbManual":0,"hBTManual":0,"hFormManual":0},"outputs":{"RT_N":518316.9423712246,"PE_kW":4266.320657619556,"Fr":0.23505450480994902,"Re":865193407.3326606},"calculation_usable":true,"sweep":[{"v":14,"rt":323993.1377434997,"source":"R01","status":"DEMO · stored output"},{"v":15,"rt":405656.87050187116,"source":"R01","status":"DEMO · stored output"},{"v":16,"rt":518316.9423712246,"source":"R01","status":"DEMO · stored output"},{"v":17,"rt":683990.8546853316,"source":"R01","status":"DEMO · stored output"}],"source":"Four stored example results captured from original R01 engine; replay only."},{"id":"DEMO-RES-KQ","name":"DEMO · Platform supply vessel","savedAt":"","method_id":"R01","is_demo":true,"source_status":"DEMONSTRATION · previously captured R01 method output","inputs":{"vs":11,"L":85,"B":14,"T":4.8,"CB":0.66,"CM":0.98,"CWP":0.8,"LCB":0,"S":1580,"volume":2900,"rho":1025,"nu":1.1892e-06,"g":9.81,"margin":0,"crstd":1.3,"ca":0,"caa":0,"sappH":0,"hCP":0.7875,"hFF":0,"hFA":0,"hFapp":0,"hABT":0,"hAM":0,"hLPP":145.35,"hLaft":5,"hLfore":5,"hLCB0":0,"hTEU":0,"hBossManual":0,"hShaftManual":0,"hOtherManual":0,"hLCBManual":0,"hBulbManual":0,"hBTManual":0,"hFormManual":0},"outputs":{"RT_N":88732.31387640003,"PE_kW":502.12587127813816,"Fr":0.19596875114329812,"Re":404477917.92801887},"calculation_usable":true,"sweep":[{"v":9,"rt":54065.332153712545,"source":"R01","status":"DEMO · stored output"},{"v":10,"rt":69349.31439642717,"source":"R01","status":"DEMO · stored output"},{"v":11,"rt":88732.31387640003,"source":"R01","status":"DEMO · stored output"},{"v":12,"rt":114380.77803941816,"source":"R01","status":"DEMO · stored output"}],"source":"Four stored example results captured from original R01 engine; replay only."},{"id":"DEMO-RES-GEOMETRY","name":"DEMO · Workboat B4 Selection","savedAt":"","method_id":"R01","is_demo":true,"source_status":"DEMONSTRATION · previously captured R01 method output","inputs":{"vs":11.5,"L":85,"B":14,"T":4.8,"CB":0.66,"CM":0.98,"CWP":0.8,"LCB":0,"S":1580,"volume":2900,"rho":1025,"nu":1.1892e-06,"g":9.81,"margin":0,"crstd":1.3,"ca":0,"caa":0,"sappH":0,"hCP":0.7875,"hFF":0,"hFA":0,"hFapp":0,"hABT":0,"hAM":0,"hLPP":145.35,"hLaft":5,"hLfore":5,"hLCB0":0,"hTEU":0,"hBossManual":0,"hShaftManual":0,"hOtherManual":0,"hLCBManual":0,"hBulbManual":0,"hBTManual":0,"hFormManual":0},"outputs":{"RT_N":100577.80369344958,"PE_kW":595.0289478976392,"Fr":0.20487642164981165,"Re":422863277.83383787},"calculation_usable":true,"sweep":[{"v":9.5,"rt":61285.54727081456,"source":"R01","status":"DEMO · stored output"},{"v":10.5,"rt":78423.86601261521,"source":"R01","status":"DEMO · stored output"},{"v":11.5,"rt":100577.80369344958,"source":"R01","status":"DEMO · stored output"},{"v":12.5,"rt":130737.43648131134,"source":"R01","status":"DEMO · stored output"}],"source":"Four stored example results captured from original R01 engine; replay only."}];
  const igResHistoryData=new Map();
  function igJsonArray(key){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
  function igAsNumber(x){if(x==null||x==='')return NaN;const n=Number(x);return Number.isFinite(n)?n:NaN}
  function igNormalizeHistory(record,origin){
    if(!record||typeof record!=='object')return null;
    const snapshot=record.source?.resistance||record.snapshot||record.resistance||record;
    const input=snapshot.inputs||{};const output=snapshot.outputs||{};
    const v=igAsNumber(input.vs??input.Vs??input.VS??record.vs??record.speed);
    const rt=igAsNumber(output.RT_N??record.RT_N??record.rt);
    if(!(v>0&&rt>0))return null;
    const method=String(snapshot.method_id||record.method_id||'UNSPECIFIED');
    const raw=record.sweep||record.nativeSweep||record.result?.speedSweep||record.fourPoints||record.points||[];
    const usable=Array.isArray(raw)?raw:[];
    const full=Array.from({length:4},(_,index)=>{
      const expected=v+[-2,-1,0,1][index];
      const found=usable.find(x=>x&&Number.isFinite(igAsNumber(x.v??x.speed??x.speed_kn))&&Math.abs(igAsNumber(x.v??x.speed??x.speed_kn)-expected)<0.00001);
      const n=found?igAsNumber(found.rt??found.RT_N??found.resistance):NaN;
      return {index,v:expected,rt:n>0?n:(index===2?rt:null),source:method,status:found?.status||origin,error:found?.error||((index!==2&&!found)?'Not recorded in History':null)};
    });
    const valid=full.filter(x=>x.rt>0).length;
    const identity=String(record.id||record.history_id||record.savedAt||record.name||[method,v,rt].join('-'));
    const demo=!!record.is_demo;
    return {id:(demo?'demo:':'stored:')+identity,name:String(record.name||record.title||'Saved resistance calculation'),savedAt:record.savedAt||record.time||'',method_id:method,
      calculation_usable:snapshot.calculation_usable!==false,source_status:demo?'DEMO / STANDALONE SAMPLE':String(snapshot.source_status||origin),inputs:{...input,vs:v},
      outputs:{...output,RT_N:rt,PE_kW:igAsNumber(output.PE_kW)>0?igAsNumber(output.PE_kW):rt*v*.5144/1000},
      is_demo:demo,source:record.sourceText||origin,sweep:full,pointCount:valid};
  }
  function igAvailableHistory(){
    const maps=new Map();
    function add(rec,origin){const n=igNormalizeHistory(rec,origin);if(n&&!maps.has(n.id))maps.set(n.id,n)}
    // Browser-local Resistance History. Other pages must explicitly save snapshots to this key.
    for(const r of igJsonArray(igResHistoryKey))add(r,'Resistance module History');
    // Compatibility with Integrated v7 saved history (RT points recorded at previous calculation).
    for(const r of igJsonArray('arus.integrated.4point.history.v7'))add(r,'Previous Integrated History v7');
    try{const last=JSON.parse(localStorage.getItem('arus.integrated.standalone.v7')||'{}');
      if(last?.resistance)add({id:'v7-last-session',name:last.name||'Prior Integrated session',source:{resistance:last.resistance},sweep:last.nativeSweep||[],savedAt:''},'Previous Integrated v7 session');
    }catch{}
    const saved=[...maps.values()].sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));
    const demos=igDemoResistanceHistory.map(r=>igNormalizeHistory(r,'Stored demo output, original R01 solver'));
    igResHistoryData.clear();for(const h of [...saved,...demos])igResHistoryData.set(h.id,h);
    return {saved,demos};
  }
  function igRefreshResistanceHistory(){
    const {saved,demos}=igAvailableHistory();const picker=igF('r-history');const old=picker.value;
    const option=r=>`<option value="${igEsc(r.id)}">${igEsc(r.name)} · ${igEsc(r.method_id)} · ${igFmt(r.inputs.vs,2)} kn · ${igFmt(r.outputs.RT_N/1000,2)} kN ${r.pointCount<4?'['+r.pointCount+'/4]':''}</option>`;
    picker.innerHTML=`<option value="">Select saved Resistance result…</option><optgroup label="Your saved History (${saved.length})">${saved.map(option).join('')}</optgroup><optgroup label="DEMO History (not saved as real results)">${demos.map(option).join('')}</optgroup>`;
    const current=ig.resHistoryId||old;
    if(igResHistoryData.has(current))picker.value=current;
    igF('r-history-summary').textContent=`${saved.length} saved Resistance record(s) found in this browser. ${demos.length} self-contained historical demo snapshots available. No Resistance solver is executed.`;
  }
  function igHistoryBadges(){
    const snap=ig.nativeSweep||[];const labels=['−2','−1','Operating','+1'];
    igF('r-multi-status').innerHTML=labels.map((label,i)=>{const r=snap[i],valid=r?.rt>0;return `<span class="ig-native-badge ${valid?'':'ig-native-bad'}">${label}: ${igFmt(r?.v,2)} kn · ${valid?igFmt(r.rt/1000,2)+' kN':'NOT SAVED'}</span>`}).join(' ');
    igF('r-history-rows').innerHTML=labels.map((lab,i)=>{const r=snap[i];return `<tr><td>${lab}</td><td>${igFmt(r?.v,2)}</td><td>${r?.rt>0?igFmt(r.rt/1000,3):'—'}</td><td>${r?.rt>0?'Saved result':'Missing point'}</td></tr>`}).join('');
  }
  function igUseResistanceHistory(id,quiet=false){
    const h=igResHistoryData.get(id);if(!h){if(!quiet)igAlert('Select a Resistance History entry first.','warn');return false}
    ig.resHistoryId=h.id;
    ig.resistance={method_id:h.method_id,inputs:{...h.inputs},outputs:{...h.outputs},calculation_usable:h.calculation_usable,is_demo:h.is_demo,source_status:h.source_status,source_history:h.source,source_history_id:h.id};
    ig.nativeSweep=h.sweep.map(x=>({...x}));
    igTop20=null;igTop20Signature='';ig.calculatedFour=[];igLast=null;igF('results').hidden=true;
    igF('r-history').value=h.id;igHistoryBadges();igUpdateSources();igSaveForm();igV50Stage('input');
    if(!quiet){igAlert(`History selected: ${h.name}. ${h.pointCount}/4 saved RT points. No new resistance calculation was run.`,h.pointCount===4?'success':'warn')}
    return true;
  }
  function igValidateResistanceHistory(){
    const v=igResistanceVs();if(!(v>2&&ig.resistance?.calculation_usable&&ig.resistance.outputs.RT_N>0))throw Error('Choose a valid Resistance History result before calculating.');
    const records=ig.nativeSweep;
    if(!Array.isArray(records)||records.length!==4)throw Error('Selected History does not contain four RT points. No RT extrapolation will be used.');
    const expected=[v-2,v-1,v,v+1];
    for(let i=0;i<4;i++){const r=records[i];if(!r||(Math.abs(r.v-expected[i])>1e-5)||!(r.rt>0))throw Error(`Saved Resistance History is incomplete at ${igFmt(expected[i],2)} kn. Save that speed in Resistance History; Integrated will not recalculate it.`)}
    if(Math.abs(records[2].rt-ig.resistance.outputs.RT_N)>Math.max(1e-4,ig.resistance.outputs.RT_N*1e-7))throw Error('Operating-point RT differs from the selected stored History.');
    return records;
  }
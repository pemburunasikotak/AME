  function igSetCoefficient(which,key){const family=which==='w'?'wake':'thrust';const x=ig.wake.find(p=>p.key===key&&p.family===family);if(x){igF(which).value=x.value;ig[which]=String(x.value)}ig[which==='w'?'wakeChoice':'thrustChoice']=key;igSaveForm();igUpdateDemoPropFromInputs()}
  function igSyncSelection(){igAlert('Select from the full paginated propeller ranking.','info');}
  function igCapture(){igRefreshResistanceHistory();}


  async function igGetCore(){
    // Always use the frozen v162 source document below, even if other Selection frames exist.
    // This prevents an unrelated preview frame or cached variant from becoming the calculation source.
    if(!igServicePromise){
      igServicePromise=new Promise((resolve,reject)=>{
        const iframe=document.createElement('iframe');iframe.style.display='none';iframe.title='Source engine for native propeller polynomial';iframe.setAttribute('sandbox','allow-same-origin allow-scripts allow-forms');
        const timer=setTimeout(()=>reject(new Error('Original selection engine loading timed out')),12000);
        iframe.addEventListener('load',()=>{
          clearTimeout(timer);
          if(!iframe.contentWindow?.__ARUS_KT__){
            reject(new Error('Frozen Selection v162 failed initialization; cannot use another solver.'));
            return;
          }
          resolve(iframe.contentWindow);
        },{once:true});
        iframe.srcdoc=igEngineDocument(engines.find(x=>x.id==='selection'));
        $('integrated-page').appendChild(iframe);
      });
    }
    return igServicePromise;
  }

  function igEq(a,b,tol=0.001){return igFinite(a)&&igFinite(b)&&Math.abs(a-b)<=tol*Math.max(1e-12,Math.abs(a),Math.abs(b))}
  function igCheckLink(p){
    const I=p.inputs||{};let errors=[];
    for(const [k,cur] of Object.entries({Vs:igNumber('vs'),w:igNumber('w'),t:igNumber('t'),nprop:igNumber('nprop'),rho:igNumber('rho'),nu:igNumber('nu'),etas:igNumber('etas'),etat:igNumber('etat'),sea:igNumber('sea')/100}))if(igFinite(I[k])&&!igEq(Number(I[k]),cur,0.002))errors.push(k);
    if(igFinite(I.RT)&&!igEq(Number(I.RT),ig.resistance.outputs.RT_N,0.01))errors.push('RT');
    if(errors.length)throw Error(`Linked propeller calculation is inconsistent with current inputs (${errors.join(', ')}). Recalculate Selection with the current Resistance and Wake/Thrust values, then import again.`);
  }
  function igShowRankPanel(){
    // The propeller ranking is shown only after Calculate.
    if(!igTop20){igF('prop-rank-status').textContent='Click Calculate to generate the full ranked propeller list.';igF('prop-page-info').textContent='0 propellers';igF('prop-prev').disabled=true;igF('prop-next').disabled=true;igF('prop-rank-status').classList.remove('ig-rank-warning');igF('prop-rank-body').innerHTML='<tr><td colspan="14">No ranking yet.</td></tr>';return}
    igRenderTop20();
  }
  function igInvalidateTop20(){igTop20=null;igTop20Signature='';igPropList.page=0;igShowRankPanel()}
  function igTop20Inputs(db){
    if(!ig.prop)throw Error('Provide a propeller diameter and Selection mode.');
    if(!ig.resistance?.calculation_usable||!(ig.resistance.outputs?.RT_N>0))throw Error('A positive Resistance RT and ship speed are required.');
    const p=ig.prop,mode=String(p.mode).toLowerCase();
    if(mode!=='kt'&&mode!=='kq')throw Error('Unsupported Selection branch: '+p.mode);
    const baseline={...db.series.B.inputs,...(p.inputs||{})};
    const I={...baseline,RT:ig.resistance.outputs.RT_N,Vs:igResistanceVs(),w:igNumber('w'),t:igNumber('t'),nprop:igNumber('nprop'),rho:igNumber('rho'),nu:igNumber('nu'),etas:igNumber('etas'),etat:igNumber('etat'),sea:igNumber('sea')/100,
      h:igNumber('depth'),p0:igNumber('p0'),pv:igNumber('pv'),criterion:'No Cavitation Constraint',safety:0};
    if(!(I.h>=0&&I.p0>I.pv&&I.pv>=0))throw Error('Invalid cavitation screening inputs. Confirm shaft immersion and pressures.');
    if(mode==='kt')I.D=Number(p.inputs?.D)||Number(p.D);
    else{
      // KQ uses the ORIGINAL fixed input power, RPM and diameter-search bounds.
      // In demo mode, synthetic operating values supply these three fields explicitly.
      I.power=Number(p.inputs?.power)||Number(p.engine);
      I.gear=Number(p.inputs?.gear)||Number(igDemoCases[ig.demo?.key]?.gear)||1;
      I.rpmEngine=Number(p.inputs?.rpmEngine)||Number(p.rpm)*I.gear;
      I.dMin=Number(p.inputs?.dMin)||(Number(p.D)*.65);
      I.dMax=Number(p.inputs?.dMax)||(Number(p.D)*1.45);
    }
    for(const [k,v] of Object.entries(I))if(typeof v==='number'&&!Number.isFinite(v))throw Error('Invalid original Selection parameter: '+k);
    return {mode,I};
  }
  // Independent limits only. Removed composite Keller+X presets; combinations
  // are produced exclusively from checked primitives, evaluated with logical AND.
  // v39's Keller and Burrill 2.5% reserves are explicitly retained by default.
  const igCavNativeLimits={
    'burrill-lower':[1,.21,.46,.04],
    'burrill-merchant':[1,.28,.57,.03],
    'burrill-naval':[1,.43,.71,.02],
    'burrill-5':[2,.715,.184,-.437],
    'burrill-10':[2,1.267,.126,-.912],
    'burrill-20':[2,1.147,.195,-.672],
    'burrill-30':[2,.91,.335,-.346]
  };
  function igCavPass(r){
    if(r?.status!=='OK')return false;
    if(igCavMode()==='none')return true;
    return !!r?.igCavReport?.pass;
  }
  function igCavAtPoint(I,p,c,n,thrust){
    const chosen=igSelectedCavChecks();
    if(!chosen.length)return {pass:true,reason:'Integration screening OFF',criteria:[],area:null,burrill:null};
    const safety=0; // No user-added safety reserve for any Burrill criterion.
    const pi=p.kind==='B'?3.14:Math.PI,D=Number(p.D),rho=I.rho;
    const vA=I.Vs*.5144*(1-I.w),vr2=vA*vA+(.7*pi*n*D)**2;
    const wettedFactor=(1.067-.229*p.pd),discLegacy=p.ae*Math.PI*(D/2)**2*wettedFactor;
    const discNative=p.ae*pi*(D/2)**2*wettedFactor;
    if(!(D>0&&vr2>0&&discLegacy>0&&discNative>0&&I.p0>I.pv&&n>0&&rho>0))
      return {pass:false,reason:'Invalid cavitation input',criteria:[]};
    const sigma=(rho*9.81*I.h+I.p0-I.pv)/(.5*rho*vr2);
    const tauLegacy=thrust/(.5*rho*discLegacy*vr2),tauNative=thrust/(.5*rho*discNative*vr2);
    const keller=((1.3+.3*p.Z)*thrust)/((I.p0-I.pv)*D*D)+(I.nprop===1?.2:.1);
    const limitLegacy=Math.max(0,.611*Math.pow(Math.max(0,sigma),.189)-.372);
    const areaPass=Number.isFinite(keller)&&p.ae>=keller-1e-10;
    const burrillPass=Number.isFinite(tauLegacy)&&limitLegacy>0&&tauLegacy<=limitLegacy*(1-safety)+1e-10;
    const checks=chosen.map(id=>{
      if(id==='keller')return {id,name:igCavNames[id],pass:areaPass,margin:p.ae-keller,reason:'Keller minimum blade area'};
      if(id==='burrill-2p5')return {id,name:igCavNames[id],pass:burrillPass,margin:limitLegacy*(1-safety)-tauLegacy,reason:'Burrill 2.5% loading limit'};
      const coeff=igCavNativeLimits[id];
      if(!coeff)return {id,name:String(id),pass:false,reason:'Unrecognized cavitation criterion'};
      const [code,a,b,offset]=coeff;
      let limit;
      if(code===1)limit=sigma<=offset?0:a*Math.pow(sigma-offset,b)*(1-safety);
      else if(code===2)limit=Math.max(0,a*Math.pow(sigma,b)+offset)*(1-safety);
      else limit=a*Math.pow(sigma,b)*(1-safety);
      const margin=limit-tauNative;
      return {id,name:igCavNames[id],pass:margin>=0,limit,tau:tauNative,margin,reason:igCavNames[id]+' loading limit'};
    });
    const failed=checks.find(x=>!x.pass);
    return {pass:!failed,checks,criteria:chosen,area:areaPass,burrill:burrillPass,
      ratio:limitLegacy>0?tauLegacy/limitLegacy:null,keller,limit:limitLegacy,tau:tauLegacy,sigma,
      reason:failed?failed.reason:'SCREENED · '+chosen.length+' selected limits passed'};
  }
  function igTop20Key(mode,I){return JSON.stringify({mode,I,rt:ig.resistance.outputs.RT_N,cavCriteria:igSelectedCavChecks()});}
  async function igComputeTop20(force=false){
    if(igTop20Busy)return;
    
    igShowRankPanel();
    igRankingError='';
    igTop20Busy=true;const button=igF('prop-rank-refresh');button.disabled=true;button.textContent='Calculating series…';
    igF('prop-rank-status').classList.remove('ig-rank-warning');igF('prop-rank-status').textContent='Selection v162 · evaluating KT over all four propeller families before Integration screening…';
    try{
      const win=await igGetCore();
      const native=win.eval('({core:PropCore,inverse:InverseCore,db:JSON.parse(document.getElementById("dataset").textContent)})');
      const {mode,I}=igTop20Inputs(native.db),signature=igTop20Key(mode,I);
      if(!force&&igTop20&&signature===igTop20Signature){igRenderTop20();return}
      const kinds=['B','AU','Gawn','Kaplan'];
      const all=[],stats=[];
      for(const kind of kinds){
        if(!native.db.series[kind])throw Error('Selection model unavailable: '+kind);
        const result=mode==='kt'?native.core.run(native.db,kind,I):native.inverse.solve(native.db,kind,I);
        // Native Selection v162 result remains immutable. Screening is an Integration-only overlay.
        const nativeOK=(mode==='kt'?result.eligible:result.byEta)
          .filter(r=>r.status==='OK'&&r.eta>0&&r.eta<1&&Number.isFinite(r.eta))
          .map(r=>({...r}));
        for(const r of nativeOK){
          const geom={kind,D:mode==='kt'?I.D:r.D,ae:r.ae,pd:r.pd,Z:r.Z};
          r.igCavReport=igCavAtPoint({...I,D:geom.D},geom,null,r.rpm/60,r.thrust);
        }
        const valid=nativeOK.filter(igCavPass);
        const matched=mode==='kq'?valid.filter(r=>Number.isFinite(r.rt)&&Math.abs(r.rt-I.RT)/I.RT<=.05):valid;
        const reasons={};for(const rr of result.rows||[]){const reason=rr.status||'UNCLASSIFIED';reasons[reason]=(reasons[reason]||0)+1;}
        stats.push({kind,total:result.rows.length,nativeOK:nativeOK.length,valid:valid.length,matched:matched.length,excluded:nativeOK.length-valid.length,reasons});
        for(const r of matched)all.push({kind,mode,row:r});
      }
      all.sort((a,b)=>b.row.eta-a.row.eta||kinds.indexOf(a.kind)-kinds.indexOf(b.kind)||a.row.index-b.row.index);
      igPropList.page=0;
      igTop20={mode,I,stats,total:all.length,allRows:all,rows:[],calculatedAt:new Date().toISOString(),
        nativeSelectionSource:'v162 frozen',selectionMode:mode,
        nativeTotal:stats.reduce((sum,s)=>sum+s.nativeOK,0),
        screenedTotal:stats.reduce((sum,s)=>sum+s.valid,0)};
      igTop20Signature=signature;
      igRenderTop20();
    }catch(e){igRankingError=e.message||String(e);igTop20=null;igTop20Signature='';igF('prop-rank-body').innerHTML='<tr><td colspan="14">No valid propeller ranking for the current inputs.</td></tr>';igF('prop-rank-status').textContent='Ranking unavailable: '+igRankingError;igF('prop-rank-status').classList.add('ig-rank-warning')}
    finally{igTop20Busy=false;button.disabled=false;button.textContent='Recalculate Ranking'}
  }
  function igRenderTop20(){
    if(!igTop20)return;
    const ranked=igTop20,stats=ranked.stats;
    const family=igF('prop-family')?.value||'all',needle=(igF('prop-search')?.value||'').trim().toLowerCase();
    const matches=(ranked.allRows||[]).map((it,index)=>({it,index})).filter(({it,index})=>{
      if(family!=='all'&&it.kind!==family)return false;
      if(!needle)return true;
      const r=it.row;
      const hay=`${index+1} ${it.kind} ${r.model||''} ${r.type||''} ${r.config||''} z=${r.Z} ${r.ae} ${r.pd} ${Number(r.eta*100).toFixed(2)}`.toLowerCase();
      return hay.includes(needle);
    });
    igPropList.matchCount=matches.length;
    const pages=Math.max(1,Math.ceil(matches.length/igPropList.pageSize));
    igPropList.page=Math.min(Math.max(0,igPropList.page),pages-1);
    const start=igPropList.page*igPropList.pageSize,shown=matches.slice(start,start+igPropList.pageSize);
    ranked.rows=shown.map(x=>x.it);
    igF('prop-prev').disabled=igPropList.page===0;
    igF('prop-next').disabled=igPropList.page>=pages-1;
    igF('prop-goto').max=String(pages);
    igF('prop-page-info').textContent=matches.length?`${start+1}–${start+shown.length} of ${matches.length.toLocaleString('en-US')} propellers · page ${igPropList.page+1}/${pages}`:'0 matching propellers';
    igF('prop-rank-status').classList.toggle('ig-rank-warning',!ranked.total);
    const eligible=stats.reduce((a,s)=>a+s.valid,0),nativeOK=stats.reduce((a,s)=>a+s.nativeOK,0);
    igF('prop-rank-status').textContent=`${ranked.total.toLocaleString('en-US')} ranked candidates · ${igCavMode()==='none'?'Additional cavitation screening off':'Design-point screening applied'} · Four-point check follows selection`;
    if(!ranked.total)igF('prop-rank-status').textContent=igRankingDiagnosis();
    const p=ig.prop;
    igF('prop-rank-body').innerHTML=shown.map(({it,index},i)=>{
      const r=it.row,selected=!!(p&&(p.sourceSeries||p.kind)===it.kind&&p.sourceIndex===r.index&&p.mode===ranked.mode);
      const family=r.model||it.kind;const label=r.config&&String(r.config)!==String(r.model)?`${family} · ${r.type} · ${r.config}`:`${family} · ${r.type}`;
      const kW=ranked.mode==='kt'?r.engine*igNumber('nprop'):r.engine;
      return `<tr class="${selected?'ig-prop-selected':''}"><td><b>${index+1}</b></td><td><b>${igEsc(label)}</b></td><td>${r.Z}</td><td>${igFmt(r.ae,2)}</td><td>${igFmt(r.pd,2)}</td><td>${igFmt(ranked.mode==='kt'?ranked.I.D:r.D,3)}</td><td>${igFmt(r.j,4)}</td><td>${igFmt(r.kt,4)}</td><td>${igFmt(r.kq*10,4)}</td><td class="ig-rank-eta">${igFmt(r.eta*100,3)}%</td><td>${igFmt(r.rpm,1)}</td><td>${igFmt(kW,1)}</td><td>${igCavMode()==='none'?'ADDITIONAL CHECK OFF':(igCavPass(r)?'Design point'+(it.kind==='Kaplan'?'*':''):'REJECTED')}</td><td><button class="ig-btn ${selected?'ig-primary':'ig-outline'}" type="button" data-ig-prop-pick="${i}">${selected?'Selected':'Select'}</button></td></tr>`;
    }).join('')||`<tr><td colspan="14">${igEsc(matches.length?'No candidates on this page.':(needle?'No results for the search.':igRankingDiagnosis()))}</td></tr>`;
  }
  function igChooseTop20(index){
    const set=igTop20;if(!set||!set.rows[index])return;
    const {kind,mode,row:r}=set.rows[index];
    if(!igCavPass(r)){igAlert('Candidate fails the current cavitation combination.','error');return;}
    igSelectionBackup={prop:ig.prop,last:igLast,engineId:ig.engineId,calculatedFour:ig.calculatedFour};
    const I={...set.I};
    // Preserve the native algorithm result; this is not a modelled efficiency guess.
    ig.prop={mode,kind,type:r.type,model:r.model,config:r.config,Z:r.Z,ae:r.ae,pd:r.pd,
      D:mode==='kt'?I.D:r.D,j:r.j,kt:r.kt,kq:r.kq,eta:r.eta,rpm:r.rpm,
      engine:r.engine,thrust:r.thrust,rt:mode==='kq'?r.rt:I.RT,cavStatus:r.cavStatus,
      status:r.status,inputs:I,sourceSeries:kind,sourceIndex:r.index,
      calculationMethod:'Original '+mode.toUpperCase()+' Selection polynomial; cross-series comparison'};
    ig.engineId='';igSaveForm();igUpdateSources();igRenderTop20();igF('results').hidden=true;igLast=null;
    igAlert(`Selected propeller: ${r.model} · ${r.type}, η₀ ${igFmt(r.eta*100,3)}%. Updating matching…`,'info');
    igCalculate();
  }
  function igSelectPower(p){
    if(p.mode==='kt')return Number(p.engine)*igNumber('nprop');
    if(p.mode==='kq'){
      if(!(p.rt>0))throw Error('KQ solver did not return a positive predicted resistance.');
      const delta=Math.abs(p.rt-ig.resistance.outputs.RT_N)/ig.resistance.outputs.RT_N;
      if(delta>0.05)throw Error(`KQ-predicted resistance differs from source RT by ${igFmt(100*delta,1)}%. Design point is inconsistent (limit 5%); reselect propeller or edit inputs in KQ selection.`);
      return Number(p.engine);
    }
    return Number(p.engine);
  }
  function igEligibility(r){
    // Only mechanical propulsion class; no gensets, auxiliary, or electric-only output ratings.
    return r.application==='PROPULSION' && r.kw>0 && r.rpm>0;
  }
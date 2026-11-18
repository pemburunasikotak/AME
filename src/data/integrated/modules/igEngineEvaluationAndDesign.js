  function igPrepareEnginePreview(r){
    const valid=(igLast?.sweep||[]).filter(p=>Number.isFinite(p.perEngineKW)&&Number.isFinite(p.propRpm)&&p.propRpm>0);
    return igBuildEnginePowerRow(r,valid);
  }
  function igRenderOperatingPointStrip(row){
    const el=igF('operating-point-strip');if(!el)return;
    const d=igLast?.sweep?.find(p=>p.isDesign)||igLast?.sweep?.[2];
    if(!row||!d){el.hidden=true;el.textContent='';return}
    const rpm=d.engineRpm,power=d.perEngineKW;
    const rpmPct=row.r.rpm>0?100*rpm/row.r.rpm:null;
    const powerPct=row.r.kw>0?100*power/row.r.kw:null;
    const available=row.curveEnvelope?igInterpolate(rpm,row.envelope,'rpm','kw'):null;
    const util=Number.isFinite(available)&&available>0?100*power/available:null;
    const data=[
      ['Engine operating RPM',igFmt(rpm,0)+' rpm',igFmt(rpmPct,1)+'% of rated RPM'],
      ['Operating power',igFmt(power,1)+' kW',igFmt(powerPct,1)+'% of rated power'],
      ['M curve at this RPM',Number.isFinite(available)?igFmt(available,1)+' kW':'Outside available domain',util==null?'No interpolation at this RPM':igFmt(util,1)+'% M utilization']
    ];
    el.innerHTML=data.map(([a,b,c])=>`<div class="ig-op-mini"><small>${igEsc(a)}</small><b>${igEsc(b)}</b><span>${igEsc(c)}</span></div>`).join('');
    el.hidden=false;
  }
  // Preserve M-only notice behavior.
  function igUpdateMOnlyNotice(row){
    const el=igF('m-only-notice');if(!el)return;
    if(!row?.r){el.hidden=true;el.replaceChildren();return;}
    const m=igCurveEvidenceFor(row.r),p=igReferencePropellerCurveFor(row.r.id);
    const distinct=arr=>new Set((arr||[]).filter(q=>Number.isFinite(q.rpm)&&Number.isFinite(q.kw)).map(q=>q.rpm)).size;
    const hasM=distinct(m?.points)>=2;
    const hasP=distinct(p?.points)>=2;
    if(!hasM||hasP){el.hidden=true;el.replaceChildren();return;}
    const heading=document.createElement('strong');
    heading.textContent='M CURVE ONLY — OEM Reference P Curve Unavailable';
    const explanation=document.createElement('span');
    explanation.textContent='Selected engine: '+row.r.brand+' '+row.r.model+' ('+row.r.id+'). The M curve is available ('+igCurveLabel(row)+'), but no usable FPP reference P curve is stored for this rating. '+igCurveCaution(row)+' The actual ARUS propeller load remains visible when a valid four-point calculation exists; this selection does not establish OEM or duty approval.';
    el.replaceChildren(heading,explanation);el.hidden=false;
  }
  function igSelectEngine(id){
    if(!igLast?.sweep?.length){igAlert('Run Calculate to obtain the propeller power demand before selecting an engine.','warn');return;}
    const r=igRatingsById.get(id);if(!r){igAlert('Engine rating not found.','warn');return;}
    const row=igLast.rows.find(x=>x.r.id===id)||igPrepareEnginePreview(r);
    if(!row)return;
    const changed=ig.gearEngineId!==id;
    const ratio=(!changed&&ig.gearManual&&Number(ig.gearRatio)>0)?Number(ig.gearRatio):row.defaultRatio;
    ig.engineId=id;ig.gearEngineId=id;
    igLast.selectedRow=row;
    igF('gear-ratio').disabled=false;igF('gear-default').disabled=false;
    igApplyUserGearRatio(ratio,changed);
    igF('catalog-inspect').hidden=true;
    igRenderEngineList();
    igPersist();
  }
  function igApplyUserGearRatio(value,resetToDefault=false){
    if(!igLast?.selectedRow)return;
    const row=igLast.selectedRow,ratio=Number(value);
    if(!Number.isFinite(ratio)||ratio<=0){igAlert('Gearbox ratio must be greater than zero.','warn');return;}
    row.ratio=ratio;row.operationalRPM=0;
    if(resetToDefault)ig.gearManual=false;
    ig.gearRatio=ratio;
    igF('gear-ratio').value=Number(ratio.toFixed(3)).toString();
    const pts=(igLast.sweep||[]).filter(p=>Number.isFinite(p.propRpm)&&Number.isFinite(p.perEngineKW));
    const rpmMin=Number.isFinite(row.r.publishedRpmMin)&&row.r.publishedRpmMin>0?row.r.publishedRpmMin:null;
    const rpmMax=Number.isFinite(row.r.publishedRpmMax)&&row.r.publishedRpmMax>0?row.r.publishedRpmMax:row.r.rpm;
    row.checks=pts.map(p=>{
      const engineRpm=p.propRpm*ratio;
      const available=row.curveEnvelope?igInterpolate(engineRpm,row.envelope,'rpm','kw'):null;
      const rpmPass=engineRpm<=rpmMax+1e-8&&(rpmMin==null||engineRpm>=rpmMin-1e-8);
      const powerPass=p.perEngineKW<=row.r.kw+1e-8;
      const curvePass=Number.isFinite(available)?p.perEngineKW<=available+1e-8:null;
      return {engineRpm,required:p.perEngineKW,available,rpmPass,powerPass,curvePass,feasible:rpmPass&&powerPass&&curvePass===true};
    });
    for(const p of igLast.sweep)p.engineRpm=Number.isFinite(p.propRpm)?p.propRpm*ratio:null;
    const d=pts.find(p=>p.isDesign)||pts[2];
    row.operationalRPM=d?.engineRpm||null;
    row.available=row.checks.find((_,i)=>pts[i]?.isDesign)?.available??row.checks[2]?.available??null;
    row.reserve=row.curveEnvelope&&row.checks.every(c=>Number.isFinite(c.available)&&c.available>0)?Math.min(...row.checks.map(c=>(c.available-c.required)/c.available)):null;
    row.sf=igEstimateSfoc(row.r,row.operationalRPM,d?.totalBrakeKW);
    igLast.gearRatio=ratio;igLast.rpmEng=row.operationalRPM;
    igF('kpi-engrpm').textContent=igFmt(row.operationalRPM,0);
    igUpdateMOnlyNotice(row);igRenderMatchSide(row);igRenderOperatingPointStrip(row);igRenderGearRequirements(row);
    igF('engine-detail').innerHTML=igEngineDetail(row);
    igF('rating-limits').innerHTML=igV47DutyDetails(row.r,row);
    const ratingPanel=igF('rating-panel');if(ratingPanel)ratingPanel.open=false;
    igRenderMatchingAudit(row);igRenderDesignReport();igRenderSweep(row);igPlot(row);
    const badge=igF('system-match');
    badge.className='ig-match-banner ig-info';
    badge.textContent='Engine selected for power-load comparison only. M/RPM limits are informational; no manufacturer or gearbox approval is implied.';
    igRenderEngineList(); // Refresh rating-specific M-curve utilization after changing manual ratio.
    igSaveForm();
  }
  function igRenderGearRequirements(row){
    const el=igF('gear-limit-note');if(!el)return;
    const pts=(igLast?.sweep||[]).filter(p=>Number.isFinite(p.propRpm)&&Number.isFinite(p.driveBrakeKW));
    if(!row||!pts.length){el.textContent='Select an engine to see gearbox power and RPM requirements.';return}
    const inputRpm=pts.map(p=>p.propRpm*row.ratio),outputRpm=pts.map(p=>p.propRpm);
    const n=igNumber('neng')||1;
    const maxInputPower=Math.max(...pts.map(p=>p.driveBrakeKW/n));
    const maxOutputPower=Math.max(...pts.map(p=>p.perShaftGearboxOutKW));
    const maxOutputTorque=Math.max(...pts.map(p=>p.torqueKNm));
    const exceeded=pts.some(p=>p.propRpm*row.ratio>row.r.rpm+1e-8);
    el.innerHTML=`<strong>Gearbox sizing notes (not a gearbox selection)</strong><div>Input RPM: <b>${igFmt(Math.min(...inputRpm),0)}–${igFmt(Math.max(...inputRpm),0)} rpm</b>. Output RPM: <b>${igFmt(Math.min(...outputRpm),0)}–${igFmt(Math.max(...outputRpm),0)} rpm</b>.</div><div>Required gearbox input power: <b>≥ ${igFmt(maxInputPower,1)} kW per engine</b>. Output power: <b>≥ ${igFmt(maxOutputPower,1)} kW per shaft</b>. Output torque: <b>≥ ${igFmt(maxOutputTorque,2)} kN·m per shaft</b>.</div><div>${exceeded?'At least one sampled engine RPM exceeds the selected engine rated RPM. ':''}Confirm manufacturer gearbox input-RPM limit, permissible input power and torque, duty, thermal capacity, service factor, and actual availability. Changing the ratio does not change the original propeller Selection result.</div>`;
  }
  function igRefreshEngineBrands(){
    const sel=igF('engine-brand');if(!sel)return;
    const brands=[...new Set(igData.rated.filter(igEligibility).map(x=>x.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    sel.innerHTML='<option value="">All manufacturers</option>'+brands.map(b=>`<option value="${igEsc(b)}">${igEsc(b)}</option>`).join('');
    if(brands.includes(igEngineList.brand))sel.value=igEngineList.brand;else{igEngineList.brand='';sel.value=''}
  }
  let igCatalogPreviewId='';
  function igCatalogPreviewRow(r){
    const curve=igCurveEvidenceFor(r);
    return {r,envelope:curve.points||[],curveEnvelope:(curve.points||[]).length>=2,
      sourceEnvelope:curve.tier==='conditional',archiveNumeric:curve.tier==='archive-numeric',
      legacyNumeric:curve.tier==='legacy-numeric',restrictedCurve:curve.tier==='digitized-restricted',
      preliminaryEnvelope:curve.tier!=='conditional'&&(curve.points||[]).length>=2,
      curveTier:curve.tier,curveEvidence:curve,reserve:null};
  }
  function igInspectCatalogRating(id){
    const r=igRatingsById.get(id),panel=igF('catalog-inspect');if(!r||!panel)return;
    const matching=igLast?.rows?.find(x=>x.r.id===id);
    const d=igPreliminaryInfo(id),c=igCurveEvidenceFor(r);
    igCatalogPreviewId=id;
    if(!igLast)igF('results').classList.add('ig-catalog-graph-visible');
    const preview=igCatalogPreviewRow(r);
    const status=igCurveLabel(preview);
    panel.hidden=false;
    panel.innerHTML=`<h3>${igEsc(r.brand)} · ${igEsc(r.model)} · ${igEsc(r.id)}</h3>
      <p>Rated ${igFmt(r.kw,1)} kW at ${igFmt(r.rpm,0)} RPM · Duty ${igEsc(r.duty)} · ${igEsc(status)}.</p>
      <p>${matching?'Present in eligible matching candidates; use Select to update EPM.':'Not in the current matching recommendations. This is a catalog inspection, NOT approval for the present vessel.'}</p>
      <p><strong>${igEsc(c.points.length)} M points.</strong> ${igEsc(igCurveCaution(preview))}</p>
      <p>${d?`Chart-digitized M/P: ${d.mPoints.length}/${d.pPoints.length} points · ${igEsc(d.config)} · ${igEsc(d.source||'')} · PDF page ${igEsc(d.page??'—')} · RPM ${igFmt(d.minRpm,0)}–${igFmt(d.maxRpm,0)}. ${igEsc(d.restrictions||'')}`:'Numeric M source data is contained in the engine catalog or archived engine input.'}</p>
      ${r.url?`<a href="${igEsc(r.url)}" target="_blank" rel="noopener noreferrer">OEM source document</a>`:''}`;
    if(!igLast){
      igPlot(igCatalogPreviewRow(r));
    }
  }
  function igUnmatchedReason(r,design,points){
    const mode=igF('readiness').value;
    if(mode==='conditional'&&r.batch24!=='OEM_DATA_VERIFIED_CONDITIONAL_MATCHING_INPUT')return 'Outside limited OEM conditional filter';
    if(mode==='digitized'&&!igPreliminaryInfo(r.id)?.usableFPP&&!igExtraMMap.has(r.id))return 'Outside preliminary/archived curve filter';
    if(!design||!points?.length)return 'No valid propeller operating points';
    const p=points.filter(x=>Number.isFinite(x.perEngineKW)&&Number.isFinite(x.propRpm));
    if(p.length!==4)return 'Four-point power/RPM input incomplete';
    const peak=Math.max(...p.map(x=>x.perEngineKW));
    if(peak>r.kw+1e-7)return 'Insufficient nominal rating at maximum checked speed';
    const curve=igCurveEvidenceFor(r),env=curve.points||[];
    if(env.length<2)return 'M-curve data not suitable for this engine rating';
    const maxEngine=Number.isFinite(r.publishedRpmMax)&&r.publishedRpmMax>0?Math.min(r.rpm,r.publishedRpmMax):r.rpm;
    const minEngine=Number.isFinite(r.publishedRpmMin)&&r.publishedRpmMin>0?r.publishedRpmMin:null;
    const maxProp=Math.max(...p.map(x=>x.propRpm));
    const ratios=[...new Set((igData.gearboxes||[]).map(g=>g.ratio).filter(x=>Number.isFinite(x)&&x>=1&&x<=maxEngine/maxProp+1e-9))];
    if(!ratios.length)return 'No catalog ratio inside engine RPM range';
    let withinCurve=false,insufficient=false;
    for(const ratio of ratios){
      const tested=p.map(x=>{const erpm=x.propRpm*ratio,avail=igInterpolate(erpm,env,'rpm','kw');return {rpm:erpm,avail,req:x.perEngineKW};});
      const inDomain=tested.every(x=>Number.isFinite(x.avail)&&x.rpm<=maxEngine+1e-7&&(minEngine==null||x.rpm>=minEngine-1e-7));
      if(inDomain){withinCurve=true;if(tested.some(x=>x.req>x.avail+1e-7))insufficient=true;}
    }
    if(!withinCurve)return 'Four operating points outside M-curve/RPM domain at catalog ratios';
    if(insufficient)return 'M-curve power insufficient at one or more checked points';
    return 'No qualifying catalog-ratio combination for all four points';
  }
  function igRenderEngineFilterNotice(){
    const el=igF('engine-filter-notice');if(el){el.hidden=true;el.replaceChildren();}
  }
  function igReevaluateEnginesOnly(){
    if(igLast?.sweep?.length===4){
      const selected=ig.engineId;
      igLast.rows=igRankEngines(igLast.power,igLast.sweep);
      igEngineList.page=0;igEngineList.all=true;igF('catalog-all').checked=true;
      igRefreshEngineBrands();igRenderEngineList();
      if(selected&&igRatingsById.has(selected))igSelectEngine(selected);
    }else{igEngineList.all=true;igRefreshEngineBrands();igRenderEngineList();}
  }

  // v47: Present duty and published operating limits without inventing OEM load windows or operating hours.
  // The stored OEM catalog includes duty/application/rated kW/RPM, but not explicit hour budgets for all ratings.
  function igV47DutyDetails(r,row){
    const duty=String(r.duty||'Duty not specified').trim();
    const min=Number.isFinite(r.publishedRpmMin)&&r.publishedRpmMin>0?igFmt(r.publishedRpmMin,0):null;
    const max=Number.isFinite(r.publishedRpmMax)&&r.publishedRpmMax>0?igFmt(r.publishedRpmMax,0):null;
    const range=(min&&max)?`${min}–${max} RPM`:(min||max)?`${min||'—'}–${max||'—'} RPM (incomplete)`:'Not documented; nominal RPM is not an operating range';
    const curve=row?.curveEvidence||igCurveEvidenceFor(r),tier=curve.tier||'nominal';
    const rpmDomain=(curve.points||[]).map(pt=>Number(pt.rpm)).filter(Number.isFinite);
    const rpmOutside=rpmDomain.length>=2&&(r.rpm<Math.min(...rpmDomain)||r.rpm>Math.max(...rpmDomain));
    const classRestricted=tier==='digitized-restricted';
    const hours='Annual operating hours / full-load duration: not stated in this record';
    const label=classRestricted?'FPP / CPP or fuel-mode restriction unresolved':
      r.batch24==='HOLD_MASTER_DUTY_METADATA'?'Duty metadata on hold':
      tier==='conditional'?'Conditional OEM numeric M (not approved)':
      tier==='archive-numeric'?'Archived M, OEM PDF not rechecked':
      tier==='legacy-numeric'?'Numeric M, not Batch24-certified':
      tier==='digitized'?'Digitized M, approximate':'M source unverified';
    const flagClass=classRestricted||r.batch24==='HOLD_MASTER_DUTY_METADATA'?'critical':tier==='conditional'?'conditional':'';
    const fuel=String(r.fuel||'').includes('UNRESOLVED')?' · fuel mode unresolved':String(r.fuel||'').includes('DUAL_FUEL')?' · dual-fuel mode requires review':'';
    return `<div class="v48-rating-details"><strong>${igEsc(duty)}</strong>`+
      `<span>Published operating RPM: ${igEsc(range)}</span>`+
      `<span>${igEsc(hours)}</span>`+
      `<span class="v48-tag ${igEsc(flagClass)}">${igEsc(label+fuel)}</span>`+
      (rpmOutside?`<span class="v48-tag critical">Rated ${igFmt(r.rpm,0)} RPM is outside plotted M domain (${igFmt(Math.min(...rpmDomain),0)}–${igFmt(Math.max(...rpmDomain),0)} RPM)</span>`:'')+
      `<span>OEM vessel approval: NOT DOCUMENTED</span></div>`;
  }
  // v49 presentation-only: keep every original duty/RPM/evidence string, collapsed on demand.
  function igV49DutyCompact(r,row){
    const duty=String(r.duty||'Duty not specified').trim();
    const min=Number.isFinite(r.publishedRpmMin)&&r.publishedRpmMin>0?igFmt(r.publishedRpmMin,0):null;
    const max=Number.isFinite(r.publishedRpmMax)&&r.publishedRpmMax>0?igFmt(r.publishedRpmMax,0):null;
    const rpmRange=min&&max?`${min}–${max} RPM`:min||max?'RPM range partial':'RPM range undocumented';
    const curve=row?.curveEvidence||igCurveEvidenceFor(r);
    const rpmDomain=(curve.points||[]).map(pt=>Number(pt.rpm)).filter(Number.isFinite);
    const outside=rpmDomain.length>=2&&(r.rpm<Math.min(...rpmDomain)||r.rpm>Math.max(...rpmDomain));
    const restricted=curve.tier==='digitized-restricted';
    const tone=outside||restricted||r.batch24==='HOLD_MASTER_DUTY_METADATA'?'v49-needs-review':(min&&max?'v49-has-range':'v49-unverified');
    const label=outside?'Rated RPM outside M curve':restricted?'Restricted source':rpmRange;
    return `<div class="v49-rating-brief"><strong>${igEsc(duty)}</strong><span class="v49-rating-status ${tone}">${igEsc(label)}</span></div>`;
  }
  function igRenderEngineList(){
    const rows=igLast?.rows||[];
    const byId=new Map(rows.map(x=>[x.r.id,x]));
    const design=igLast?.sweep?.find(p=>p.isDesign)||igLast?.sweep?.[2];
    const brand=igEngineList.brand;
    const needle=String(igEngineList.query||'').trim().toLowerCase();
    const order=igF('engine-sort')?.value||'desc';
    const pool=igData.rated.filter(igEligibility).filter(r=>(!brand||r.brand===brand)&&(!needle||[r.brand,r.model,r.duty,r.kw,r.rpm].join(' ').toLowerCase().includes(needle))).map(r=>({r,row:byId.get(r.id)||null}));
    const percent=item=>Number.isFinite(design?.perEngineKW)&&item.r.kw>0?100*design.perEngineKW/item.r.kw:NaN;
    pool.sort((a,b)=>{
      const pa=percent(a),pb=percent(b);
      if(Number.isFinite(pa)&&Number.isFinite(pb)&&pa!==pb)return order==='asc'?pa-pb:pb-pa;
      return a.r.brand.localeCompare(b.r.brand)||a.r.model.localeCompare(b.r.model)||a.r.id.localeCompare(b.r.id);
    });
    const pageSize=igEngineList.pageSize,pages=Math.max(1,Math.ceil(pool.length/pageSize));
    igEngineList.page=Math.max(0,Math.min(igEngineList.page,pages-1));
    const start=igEngineList.page*pageSize,visible=pool.slice(start,start+pageSize);
    igF('rank-body').innerHTML=visible.map(({r,row},i)=>{
      const pct=percent({r});const active=ig.engineId===r.id&&igLast?.selectedRow?.r?.id===r.id;
      const mKW=row?.available;
      const mUtil=Number.isFinite(design?.perEngineKW)&&Number.isFinite(mKW)&&mKW>0?100*design.perEngineKW/mKW:null;
      const mUtilLabel=Number.isFinite(mUtil)?igFmt(mUtil,1)+'%':'—';
      const tier=row?.curveTier||igCurveEvidenceFor(r).tier;
      const mUtilNote=Number.isFinite(mUtil)?(tier==='digitized-restricted'?'CPP/fuel mode · reference only':tier==='conditional'?'At operating RPM · conditional':'Preliminary · not OEM approved'):(igLast?.sweep?.length===4?'Outside M-curve RPM domain':'Open curve in View data');
      return `<tr data-rating="${igEsc(r.id)}" class="${active?'ig-selected-row':''}"><td>${start+i+1}</td><td><b>${igEsc(r.brand)} ${igEsc(r.model)}</b></td><td>${igFmt(r.kw,1)} kW</td><td>${igFmt(r.rpm,0)}</td><td class="${Number.isFinite(pct)&&pct>100?'ig-overrated':''}"><b>${Number.isFinite(pct)?igFmt(pct,1)+'%':'—'}</b>${Number.isFinite(pct)&&pct>100?'<small>Above nominal MCR</small>':'<small>Operating load</small>'}</td><td>${igV49DutyCompact(r,row)}</td><td>${row?.sf?igFmt(row.sf.value,1)+' g/kWh':'—'}</td><td class="ig-engine-row-actions">${igLast?.sweep?.length===4?`<button class="ig-btn ${active?'ig-primary':'ig-outline'} ig-entry-btn" data-ig-engine="${igEsc(r.id)}" aria-pressed="${active}">${active?'Selected':'Select'}</button>`:`<button class="ig-btn ig-outline ig-entry-btn" type="button" data-ig-inspect="${igEsc(r.id)}">View data</button>`}</td></tr>`;
    }).join('')||'<tr><td colspan="8">No engines in this manufacturer group.</td></tr>';
    igF('match-count').textContent=`${pool.length} rating${pool.length===1?'':'s'} · ${brand||'all manufacturers'}`;
    igF('engine-list-info').textContent=pool.length?`${start+1}–${start+visible.length} of ${pool.length}`:'0 engines';
    igF('engine-prev').disabled=igEngineList.page===0;igF('engine-next').disabled=igEngineList.page>=pages-1;
    igF('catalog-note').textContent=igLast?.sweep?.length===4?'Power-load sorting only':'Catalog only · no valid 4-point power demand';
  }
  function igV50Stage(name){document.querySelectorAll('#stages [data-stage]').forEach(el=>el.classList.toggle('active',el.dataset.stage===name));}
  function igShow(result){
    igV50Stage('result');
    result.sweep=igMakeSpeedSweep(result);igLast=result;igF('results').hidden=false;
    igF('kpi-power').textContent=igFmt(result.power,1);
    igF('kpi-proprpm').textContent=igFmt(result.p.rpm,0);
    igF('kpi-engrpm').textContent='—';
    igF('kpi-hull').textContent=igFmt((1-igNumber('t'))/(1-igNumber('w')),4);
     const etaOpen=Number(result.p?.eta);igF('kpi-openwater').textContent=Number.isFinite(etaOpen)&&etaOpen>=0&&etaOpen<=1?igFmt(100*etaOpen,2)+'%':'—';
    igEngineList.page=0;igEngineList.all=true;igEngineList.query='';
    igF('catalog-all').checked=true;igF('engine-find').value='';
    igRefreshEngineBrands();igRenderEngineList();igRenderEngineFilterNotice();
    igF('result-evidence').textContent=igHasDemoSource()?'Example · Calculation':'Power-load comparison';
    igF('results').classList.toggle('ig-demo-result',igHasDemoSource());
    igF('trace').textContent=`Propeller selection · 4 stored Resistance points · RT ${igFmt(ig.resistance.outputs.RT_N,1)} N · w ${igFmt(igNumber('w'),4)} · t ${igFmt(igNumber('t'),4)} · Propeller ${result.p.type} · η₀ ${igFmt(result.p.eta,4)}. Engine table sorted only by required power as % MCR. No engine rating is excluded for power, RPM or gearbox constraints.`;
    igF('gear-ratio').disabled=true;igF('gear-ratio').value='';igF('gear-default').disabled=true;
    igF('gear-limit-note').textContent='Select an engine to see gearbox power and RPM requirements.';
    igF('match-live').textContent='Select a manufacturer and an engine from the table.';
    igF('engine-detail').textContent='No engine selected.';
    igF('rating-limits').textContent='Select an engine to inspect rating limits and source notes.';
    igF('system-match').textContent='No engine selected. The table is not a recommendation.';
    igF('operating-point-strip').hidden=true;igUpdateMOnlyNotice(null);
    // Restore a previously chosen rating, but never select rank #1 automatically.
    if(ig.engineId&&igRatingsById.has(ig.engineId))igSelectEngine(ig.engineId);
    else{ig.engineId='';result.selectedRow=null;igRenderDesignReport();igRenderSweep(null);}
    requestAnimationFrame(()=>{if(igLast?.selectedRow){igPlot(igLast.selectedRow);igDrawSpeedChart()}else{igDrawSpeedChart();const c=igF('epm');if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height)}}});
  }
  function igShowEngineCatalogOnly(message){
    igV50Stage('result');
    igUpdateMOnlyNotice(null);
    const panel=igF('results');
    panel.hidden=false;
    panel.classList.add('ig-catalog-only');
    igLast=null;igCatalogPreviewId='';panel.classList.remove('ig-catalog-graph-visible');igEngineList.all=true;igEngineList.page=0;
    igF('catalog-all').checked=true;
    igF('engine-find').value='';igEngineList.query='';igEngineList.brand='';
    igF('match-count').textContent='No engineering matching yet';
    igF('result-evidence').textContent='Engine catalog · 4-point matching unavailable';
    let text=igF('catalog-screen-reason');
    if(!text){text=document.createElement('div');text.id='ig-catalog-screen-reason';text.className='ig-catalog-screen-reason';
      panel.querySelector('.ig-engine-catalog-mode')?.before(text);}
    text.textContent=message+' No valid four-speed propeller power demand was obtained, so engine power load cannot be calculated. Duty information remains available from the stored catalog. You may inspect engine catalog data, but these ratings are NOT matched or approved for this vessel.';
    igRefreshEngineBrands();igRenderEngineList();igRenderEngineFilterNotice();
  }
  function igHideCatalogOnly(){
    igF('results').classList.remove('ig-catalog-only','ig-catalog-graph-visible');
    const note=igF('catalog-screen-reason');if(note)note.remove();
    // Preserve the chosen catalog view; do not silently collapse other brands after Calculate.
    igEngineList.all=igF('catalog-all').checked;
  }
  function igRankingDiagnosis(){
    if(!igTop20){return igRankingError||'The source propeller solver did not complete.';}
    const stats=igTop20.stats||[];
    const native=stats.reduce((n,s)=>n+s.nativeOK,0);
    const screened=stats.reduce((n,s)=>n+s.valid,0);
    const matched=stats.reduce((n,s)=>n+s.matched,0);
    const byFamily=stats.map(s=>`${s.kind}: ${s.nativeOK} polynomial · ${s.valid} cavitation · ${s.matched} eligible`).join(' | ');
    const I=igTop20.I||{};
    const va=I.Vs*.5144*(1-I.w);
    const beta=(I.D>0&&I.rho>0&&va>0&&I.nprop>0&&(1-I.t)>0)
      ?(I.RT*(1+I.sea)/((1-I.t)*I.nprop))/(I.rho*va*va*I.D*I.D):null;
    const betaText=igTop20.mode==='kt'&&Number.isFinite(beta)?` · β=${igFmt(beta,3)} (at D ${igFmt(I.D,3)} m)` : '';
    const rejects=stats.map(s=>{const arr=Object.entries(s.reasons||{}).filter(([reason])=>reason!=='OK').sort((a,b)=>b[1]-a[1]);return arr.length?`${s.kind}: ${arr[0][0]} (${arr[0][1]})`:''}).filter(Boolean).join(' | ');
    if(!native)return `No KT/KQ polynomial candidate passed the original numerical/domain checks${betaText}. ${rejects?'Leading solver rejection: '+rejects+'. ':''}${byFamily}. This does NOT establish that no propeller is available at other diameters or conditions.`;
    if(!screened)return `${native} native polynomial candidates were obtained${betaText}, but none passed ${igCavLabel()} at the selected operating point. ${byFamily}.`;
    if(!matched)return `${screened} candidates passed cavitation, but none met the KQ resistance consistency check (±5%). ${byFamily}.`;
    return `No final design-point candidate at the current inputs. ${byFamily}.`;
  }
  function igCandidateFromRank(it){
    const {kind,mode,row:r}=it,I=igTop20.I;
    return {mode,kind,sourceSeries:kind,sourceIndex:r.index,index:r.index,model:r.model,type:r.type,config:r.config,
      Z:r.Z,ae:r.ae,pd:r.pd,D:mode==='kt'?I.D:r.D,j:r.j,kt:r.kt,kq:r.kq,eta:r.eta,rpm:r.rpm,
      engine:r.engine,thrust:r.thrust,rt:mode==='kq'?r.rt:I.RT,cavStatus:r.cavStatus,status:r.status,inputs:{...I},
      jmax:r.jmax,calculationMethod:'Native polynomial Selection · four-point assessment'};
  }
  async function igCalculate(){
    igF('selection-mode').value='kt';
    if(ig.prop?.mode==='kq'){ig.prop=null;igTop20=null;igTop20Signature='';}
    igUpdatePowertrainHelp();
    igSaveForm();const btn=igF('calculate');btn.disabled=true;btn.textContent='Calculating…';igV50Stage('calculate');
    try{
      igValidateResistanceHistory();
      const numeric=['w','t','nprop','rho','nu','etas','etat','sea','depth','p0','pv','neng','margin','parasitic'];
      for(const x of numeric)if(!Number.isFinite(igNumber(x)))throw Error('Invalid input: '+x);
      if(!(igNumber('w')>=0&&igNumber('w')<1&&igNumber('t')>=0&&igNumber('t')<1&&igNumber('nprop')>=1&&igNumber('neng')>=1&&igNumber('rho')>0&&igNumber('nu')>0&&igNumber('etas')>0&&igNumber('etas')<=1&&igNumber('etat')>0&&igNumber('etat')<=1&&igNumber('parasitic')>=0&&Number.isInteger(igNumber('nprop'))&&Number.isInteger(igNumber('neng'))))throw Error('Invalid wake, efficiencies, or powertrain settings.');
      if(igNumber('nprop')>12||igNumber('neng')>12)throw Error('Number of engines and propellers must each be between 1 and 12.');
      if(!ig.prop)igSetInputSeed();
      if(!(igNumber('depth')>=0&&igNumber('p0')>igNumber('pv')&&igNumber('pv')>=0))throw Error('Invalid cavitation depth or pressure inputs.');
      await igComputeTop20(false);
      igF('prop-ranks').hidden=false;
      if(!igTop20?.allRows?.length){
        const reason=igRankingDiagnosis();
        igShowEngineCatalogOnly(reason);
        igAlert(reason+' Engine catalog is accessible below; no engine matching has been asserted.','warn');
        return;
      }
      const explicit=!(ig.prop.is_demo||ig.prop.is_seed);
      const chosen=(igTop20.allRows||[]).find(it=>it.kind===(ig.prop.sourceSeries||ig.prop.kind)&&it.row.index===ig.prop.sourceIndex);
      if(explicit&&!chosen){
        const reason='The manually selected propeller is not eligible under the current settings. It has NOT been replaced.';
        igShowEngineCatalogOnly(reason);igAlert(reason+' Select a ranked candidate to continue.','warn');return;
      }
      const options=explicit?[chosen]:igTop20.allRows;
      let selected=null,points=null;
      const failed=[];
      for(let candidateIndex=0;candidateIndex<options.length;candidateIndex++){
        const item=options[candidateIndex];
        if(candidateIndex>0&&candidateIndex%12===0){btn.textContent=`Verifying ${candidateIndex+1} / ${options.length} candidates…`; await new Promise(resolve=>setTimeout(resolve,0));}
        if(!igCavPass(item.row))continue;
        const candidate=igCandidateFromRank(item);
        try{
          const sweep=await igComputeFourPower(candidate);
          const invalid=sweep.filter(pt=>!Number.isFinite(pt.totalBrakeKW));
          if(invalid.length){failed.push(`${item.kind} ${item.row.model}: ${invalid.map(pt=>igFmt(pt.v,1)+' kn '+(pt.error||'not solved')).join(', ')}`);continue;}
          selected=candidate;points=sweep;break;
        }catch(e){failed.push(`${item.kind} ${item.row.model}: ${e.message||String(e)}`);}
      }
      if(!selected){
        const reason=(explicit?'Selected propeller':'All '+options.length+' ranked propellers')+
          ' could not satisfy all four stored resistance points. '+(failed[0]||'Check KTship crossing and cavitation at each speed.')+
          (failed.length>1?` (${failed.length} candidates checked; no automatic change to screening or diameter.)`:'');
        const backup=igSelectionBackup;igSelectionBackup=null;
        if(explicit&&backup?.last){
          ig.prop=backup.prop;ig.engineId=backup.engineId;igLast=backup.last;ig.calculatedFour=backup.calculatedFour;
          igHideCatalogOnly();igF('results').hidden=false;igF('prop-ranks').hidden=false;
          igUpdateSources();igRenderTop20();igSaveForm();
          igAlert('Candidate rejected: '+reason+' Previous calculated design retained.','warn');
        }else{
          igShowEngineCatalogOnly(reason);
          igAlert(reason+' You can select another propeller; engine catalog remains searchable.','warn');
        }
        return;
      }
      // An automatic template/seed choice uses the first ranked propeller that
      // actually passes 4/4 points. A manual choice is NEVER silently changed.
      if(!explicit && (ig.prop.sourceIndex!==selected.sourceIndex||ig.prop.kind!==selected.kind)){
        igAlert(`Auto-selection: ${selected.model} (${selected.kind}) is the first ranked candidate passing all four points; no criteria were relaxed.`,'info');
      }
      ig.prop=selected;ig.calculatedFour=points;
      const autoRank=!explicit?igTop20.allRows.findIndex(it=>it.kind===selected.kind&&it.row.index===selected.sourceIndex)+1:null;
      const design=points[2],power=design.totalBrakeKW;
      const rows=igRankEngines(power,points);
      igHideCatalogOnly();
      igShow({p:selected,power,rpmEng:null,rows,time:new Date().toISOString()});
      igSelectionBackup=null;igRenderTop20();igUpdateSources();igUpdateDemoStatus();
      if(autoRank>10)igF('prop-rank-status').textContent+=` · Auto-selected rank #${autoRank}, available with page navigation.`;
      const caption=`4/4 original Resistance/Selection points · ${igCavMode()==='none'?'Integration screening OFF':igCavLabel()} · all available M-curve ratings listed`;
      igAlert(caption+'. Choose a manufacturer and engine; adjust the gearbox ratio if needed.',rows.length?'success':'warn');
      if(!rows.length){igEngineList.all=true;igF('catalog-all').checked=true;igRefreshEngineBrands();igRenderEngineList();}
      igF('prop-ranks').scrollIntoView({block:'start',behavior:'smooth'});
    }catch(e){
      const failed=e.message||String(e),backup=igSelectionBackup;igSelectionBackup=null;
      if(backup?.last){
        ig.prop=backup.prop;ig.engineId=backup.engineId;
        igLast=backup.last;ig.calculatedFour=backup.calculatedFour;
        igHideCatalogOnly();igF('results').hidden=false;igF('prop-ranks').hidden=false;
        igUpdateSources();igRenderTop20();igSaveForm();
        igAlert('Candidate rejected: '+failed+' Previous valid selection retained.','error');
      }else{
        igF('prop-ranks').hidden=false;
        igShowEngineCatalogOnly(failed);
        igAlert(failed+' The engine catalog is still available; no matching is claimed.','error');
      }
    }finally{btn.disabled=false;btn.innerHTML='Calculate <span aria-hidden="true">→</span>'}
  }

  function igAllDesigns(){try{const x=JSON.parse(localStorage.getItem(igDesignStoreKey)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
  function igWriteDesigns(data){localStorage.setItem(igDesignStoreKey,JSON.stringify(data.slice(0,100)))}
  function igCaptureNamedDesign(){igSaveForm();return {schema:'arus.integrated.design.v21',savedAt:new Date().toISOString(),name:ig.name,workspace:JSON.parse(JSON.stringify({...ig,savedRun:null,calculatedFour:null})),fields:Object.fromEntries(['selection-mode','design-d','kq-power','kq-rpm','kq-gear'].map(k=>[k,igF(k)?.value||'']))}}
  function igRefreshNamedPicker(prefer=''){
    const picker=igF('design-picker'),old=prefer||picker.value;
    const list=igAllDesigns();
    picker.innerHTML='<option value="">Select a saved project</option>'+
      `<optgroup label="Saved projects">${list.map((x,i)=>`<option value="saved:${i}">${igEsc(x.name)}</option>`).join('')}</optgroup>`;
    if(old && [...picker.options].some(o=>o.value===old))picker.value=old;
  }
  function igSaveNamedDesign(){
    const raw=igF('name').value.trim();if(!raw){igAlert('Enter a ship or design name before saving.','warn');return}
    try{
      const item=igCaptureNamedDesign();item.name=raw;item.workspace.name=raw;
      const list=igAllDesigns();const index=list.findIndex(x=>String(x.name).toLowerCase()===raw.toLowerCase());const existing=index>=0;
      if(index>=0)list.splice(index,1);list.unshift(item);igWriteDesigns(list);igRefreshNamedPicker('saved:0');
      igAlert(`${existing ? "Project overwritten" : "Project saved"}: ${raw}. Inputs and selected sources are stored in this browser.`,'success');
    }catch(e){igAlert('Unable to save design: '+e.message,'error')}
  }
  function igLoadNamedDesign(item){
    if(!item?.workspace||!item?.fields)throw Error('Invalid or unsupported design file.');
    const state=JSON.parse(JSON.stringify(item.workspace));
    ig=Object.assign({name:'Untitled design',resistance:null,wake:[],wakeChoice:'',thrustChoice:'',w:'',t:'',path:'selection',prop:null,engineId:'',settings:{},savedRun:null,demo:null,nativeSweep:[],resHistoryId:null},state);
    const keys=['w','t','nprop','rho','nu','etas','etat','sea','depth','p0','pv','neng','margin','parasitic','readiness','service'];
    for(const k of keys)if(ig.settings?.[k]!=null)igF(k).value=ig.settings[k];
    for(const [k,v] of Object.entries(item.fields))if(igF(k))igF(k).value=v;
    igRestoreCavChecks(ig.settings,item.fields);
    if(ig.w!=null)igF('w').value=ig.w;
    if(ig.t!=null)igF('t').value=ig.t;
    igTop20=null;igTop20Signature='';igLast=null;
    igF('results').hidden=true;igF('prop-ranks').hidden=true;
    igRefreshResistanceHistory();
    const stored=ig.resistance&&Array.isArray(ig.nativeSweep)&&ig.nativeSweep.length===4;
    if(stored){
      // The saved RT snapshot remains usable even if the external History entry has been removed.
      if(ig.resHistoryId&&igResHistoryData.has(ig.resHistoryId))igF('r-history').value=ig.resHistoryId;
      igHistoryBadges();
    }
    igSyncArrangementFromCounts();igUpdateSources();igF('name').value=ig.name;igSaveForm();igUpdateKqFields();
  }
  function igChooseNamedDesign(){
    const value=igF('design-picker').value;
    if(!value){igAlert('Choose a saved design or example first.','warn');return}
    if(value.startsWith('template:')){igApplyDemo(value.slice(9));igUpdateKqFields();return}
    if(value.startsWith('saved:')){
      const item=igAllDesigns()[Number(value.slice(6))];if(!item){igAlert('Saved design not found.','error');return}
      try{igLoadNamedDesign(item);igAlert(`Project loaded: ${item.name}. Press Calculate to refresh the results.`,'success')}catch(e){igAlert(e.message,'error')}
    }
  }
  function igRemoveNamedDesign(){
    const list=igAllDesigns();
    const dialog=document.getElementById('ig-project-dialog');
    const chosen=dialog?.open?document.getElementById('ig-load-project-choice')?.value:'';
    const activeIndex=(chosen!=='' && chosen!=null)?Number(chosen):-1;
    const raw=(Number.isInteger(activeIndex)&&activeIndex>=0&&activeIndex<list.length)
      ?list[activeIndex].name:igF('name').value.trim();
    const index=list.findIndex(x=>String(x.name).toLowerCase()===raw.toLowerCase());
    if(index<0){igAlert('No saved project matches the current Project name.','warn');return}
    if(!confirm(`Delete saved project “${list[index].name}”? This cannot be undone.`))return;
    const [item]=list.splice(index,1);
    try{
      igWriteDesigns(list);igRefreshNamedPicker();
      if(dialog?.open){
        const select=document.getElementById('ig-load-project-choice');
        select.replaceChildren();
        if(!list.length)select.add(new Option('No saved projects in this browser',''));
        else list.forEach((project,i)=>select.add(new Option(project.name,String(i))));
        document.getElementById('ig-load-project-confirm').disabled=list.length===0;
        igF('design-delete').disabled=list.length===0;
      }
      igAlert(`Deleted saved project: ${item.name}`,'info');
    }catch(e){igAlert(e.message,'error')}
  }
  function igExportNamedDesign(){
    const item=igCaptureNamedDesign();
    const safe=(item.name||'ARUS_Design').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,55);
    const url=URL.createObjectURL(new Blob([JSON.stringify(item,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=safe+'_ARUS_Integrated.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  async function igImportNamedDesign(file){
    if(!file)return;
    try{if(file.size>2e6)throw Error('Design file exceeds 2 MB.');
      const item=JSON.parse(await file.text());if(item.schema!=='arus.integrated.design.v21'||!item.workspace||!item.fields)throw Error('Unsupported design file format.');
      igLoadNamedDesign(item);igSaveNamedDesign();igAlert('Imported and saved design: '+item.name,'success');
    }catch(e){igAlert('Import failed: '+e.message,'error')}finally{igF('import').value=''}
  }
  function igNewDesign(){
    igTop20=null;igTop20Signature='';igLast=null;
    ig={name:'Untitled design',resistance:null,wake:[],wakeChoice:'',thrustChoice:'',w:'',t:'',path:'selection',prop:null,engineId:'',settings:{},savedRun:null,demo:null,nativeSweep:[],resHistoryId:null};
    igF('name').value='Untitled design';
    for(const k of ['vs','rt','w','t'])igF(k).value='';
    igF('selection-mode').value='kt';igF('design-d').value='2.9';igSetCavChecks(igCavDefault);
    for(const [k,v] of Object.entries({nprop:'1',neng:'1',rho:'1025',nu:'0.00000119',etas:'0.98',etat:'0.97',sea:'0',depth:'3',p0:'101000',pv:'3000',margin:'0',parasitic:'0',readiness:'all',service:'unspecified'})){igF(k).value=v}
    igF('results').hidden=true;igF('prop-ranks').hidden=true;igPropList.page=0;igCavScreenHelp();igF('r-history-rows').innerHTML='';
    igF('r-multi-status').innerHTML='';igF('r-history').value='';
    igSyncArrangementFromCounts();igUpdateSources();igSaveForm();igUpdateKqFields();
    igAlert('New design created. Select a four-point Resistance History and enter the propeller diameter.','info');
  }
  function igUpdateKqFields(){
    igF('selection-mode').value='kt';
    document.querySelectorAll('.ig-kq-only').forEach(x=>x.hidden=true);
  }
  function igSetInputSeed(){
    const mode=igF('selection-mode').value,D=Number(igF('design-d').value);
    if(!(Number.isFinite(D)&&D>.05&&D<=30))throw Error('Enter a valid propeller diameter.');
    const I={D};
    if(mode==='kq'){
      const power=Number(igF('kq-power').value),rpmEngine=Number(igF('kq-rpm').value),gear=Number(igF('kq-gear').value);
      if(!(power>0&&rpmEngine>0&&gear>=1))throw Error('KQ requires positive engine power, engine RPM, and gear ratio.');
      Object.assign(I,{power,rpmEngine,gear,dMin:D*.65,dMax:D*1.45});
    }
    ig.prop={mode,kind:'B',is_seed:true,D,inputs:I,model:'Input seed',type:'Selection input',sourceIndex:null};
  }
  function igCavMode(){return igSelectedCavChecks().length?'combined':'none'}
  function igCavLabel(){const choices=igSelectedCavChecks();return choices.length?choices.map(x=>igCavNames[x]).join(' + '):'Not screened'}
  function igRenderPropSearch(){
    // Search is applied to all eligible rows, not merely to the first 40 results.
    igF('prop-search-hits').hidden=true;
    igPropList.page=0;
    igRenderTop20();
  }
  function igSelectAnyPropeller(index){
    const it=igTop20?.allRows?.[index];if(!it)return;
    const r=it.row,I=igTop20.I,mode=igTop20.mode;
    if(!igCavPass(r)){igAlert('Candidate does not meet selected screening.','error');return}
    igSelectionBackup={prop:ig.prop,last:igLast,engineId:ig.engineId,calculatedFour:ig.calculatedFour};
    ig.prop={mode,kind:it.kind,sourceIndex:r.index,index:r.index,model:r.model,type:r.type,config:r.config,
      Z:r.Z,ae:r.ae,pd:r.pd,D:mode==='kt'?I.D:r.D,j:r.j,kt:r.kt,kq:r.kq,eta:r.eta,rpm:r.rpm,
      engine:r.engine,thrust:r.thrust,rt:mode==='kq'?r.rt:I.RT,cavStatus:r.cavStatus,status:r.status,inputs:{...I},jmax:r.jmax,
      calculationMethod:'Native polynomial Selection · complete ranking'};
    igF('prop-search').value='';igF('prop-search-hits').hidden=true;
    ig.engineId='';igSaveForm();igUpdateSources();igRenderTop20();
    igAlert(`Propeller selected: rank ${index+1}, ${r.model} · η₀ ${igFmt(100*r.eta,2)}%. Recalculating engine matching.`,'info');
    igCalculate();
  }
  function igRenderMatchSide(row){
    const boxes=[igF('match-live'),igF('match-live-inline')].filter(Boolean);
    if(!boxes.length)return;
    if(!row||!igLast){boxes.forEach(box=>box.textContent='No engine selected.');return}
    const d=igLast.sweep.find(p=>p.isDesign)||igLast.sweep[2];
    const rpm=d?.engineRpm,power=d?.perEngineKW;
    const rpmPct=Number.isFinite(rpm)&&row.r.rpm>0?100*rpm/row.r.rpm:null;
    const load=Number.isFinite(power)&&row.r.kw>0?100*power/row.r.kw:null;
    const margin=Number.isFinite(load)?100-load:null;
    const available=row.available;
    const usage=Number.isFinite(available)&&available>0?100*power/available:null;
    const fields=[
      ['Required engine power',igFmt(power,1)+' kW',igFmt(load,1)+'% of '+igFmt(row.r.kw,1)+' kW MCR'],
      ['Operating engine RPM',igFmt(rpm,0)+' rpm',igFmt(rpmPct,1)+'% of '+igFmt(row.r.rpm,0)+' rated RPM'],
      ['Engine margin',Number.isFinite(margin)?(margin>=0?igFmt(margin,1)+'% reserve':igFmt(Math.abs(margin),1)+'% deficit'):'—',Number.isFinite(margin)?(margin>=0?'Reserve to nominal MCR':'Required power is above nominal MCR'):'Margin unavailable'],
      ['Published M at this RPM',Number.isFinite(available)?igFmt(available,1)+' kW':'Outside curve domain',usage!=null?igFmt(usage,1)+'% of M curve':'No interpolation outside the OEM data RPM range'],
      ['SFOC',row.sf?igFmt(row.sf.value,1)+' g/kWh':'Unavailable',row.sf?.why||'No supported RPM/load point']
    ];
    const html=fields.map(([a,b,c])=>`<div class="ig-match-summary-item"><small>${igEsc(a)}</small><strong>${igEsc(b)}</strong><span>${igEsc(c)}</span></div>`).join('');
    boxes.forEach(box=>box.innerHTML=html);
  }
  function igRenderDesignReport(){
    const root=igF('report-content');if(!root)return;
    if(!igLast){root.textContent='Run Calculate to generate a summary.';return}
    const p=igLast.p,row=igLast.selectedRow,r=row?.r,D=ig.resistance||{};
    const line=(k,v)=>`<dt>${igEsc(k)}</dt><dd>${igEsc(v)}</dd>`;
    const section=(t,items)=>`<section class="ig-report-part"><h3>${igEsc(t)}</h3><dl>${items.map(([k,v])=>line(k,v)).join('')}</dl></section>`;
    root.innerHTML='<div class="ig-report-grid">'+
      section('Vessel & Resistance',[
        ['Ship',ig.name],['Powertrain',igNumber('neng')+' engine(s) / '+igNumber('nprop')+' propeller(s)'],['Resistance method',D.method_id||'—'],['Operating speed',igFmt(igResistanceVs(),2)+' kn'],
        ['RT',igFmt(D.outputs?.RT_N/1000,3)+' kN'],['Wake fraction',igFmt(igNumber('w'),4)],['Thrust deduction',igFmt(igNumber('t'),4)]])+ 
      section('Propeller',[
        ['Series',p.model||p.kind],['Configuration',p.type||'—'],['Blades',String(p.Z||'—')],
        ['Diameter',igFmt(p.D,3)+' m'],['P/D',igFmt(p.pd,3)],['AE/A₀',igFmt(p.ae,3)],
        ['Efficiency η₀',igFmt(p.eta*100,2)+'%'],['Propeller RPM',igFmt(p.rpm,1)+' rpm']])+ 
      section('Engine & Gearbox',[
        ['Engine',r?r.brand+' '+r.model:'Not selected'],['Rated power',r?igFmt(r.kw,1)+' kW':'—'],
        ['Rated RPM',r?igFmt(r.rpm,0)+' rpm':'—'],['Required engine power',igFmt(igLast.power/(igNumber('neng')||1),1)+' kW / engine'],
        ['Power load',row?igFmt(row.load,1)+'% MCR':'—'],['Operating RPM',row?igFmt(row.operationalRPM,0)+' rpm':'—'],
        ['Input reduction ratio',row?igFmt(row.ratio,3)+':1':'—'],['SFOC',row?.sf?igFmt(row.sf.value,1)+' g/kWh':'Unavailable']])+ '</div>'+ 
      '<p class="ig-report-notes">Engine results are sorted only by operating power as a percentage of MCR. No suitability gates or automatic engine recommendation are applied. The input reduction ratio is not approval of any gearbox. Confirm gearbox rated power, RPM, torque, duty and thermal limits independently. Equal load-sharing is assumed; the mechanical arrangement requires verification. Propeller calculation coefficients are unchanged.</p>';
  }
  function igSaveHistory(){if(!igLast){igAlert('Calculate a consistent integrated case before saving to History.','warn');return}
    const rec={calculationVersion:'v17-curated-oem-v24-integration',id:'IG-'+Date.now().toString(36).toUpperCase(),savedAt:new Date().toISOString(),name:ig.name,demo:igHasDemoSource(),source:{resistance:ig.resistance,interaction:{w:igNumber('w'),t:igNumber('t'),wakeChoice:ig.wakeChoice,thrustChoice:ig.thrustChoice},propeller:igLast.p},result:{power:igLast.power,rpmEngine:igLast.rpmEng,gearbox:{ratio:igLast.gearRatio??null,rpmInputAtPlus1:igLast.sweep.at(-1)?.engineRpm??null,rpmOutputAtPlus1:igLast.sweep.at(-1)?.propRpm??null,parasiticKWPerEngine:igNumber('parasitic'),sourceEnvelopeVerified:igLast.selectedRow?.sourceEnvelope??false,minReserveFraction:igLast.selectedRow?.reserve??null,minOutputPowerPerShaft:Math.max(...igLast.sweep.map(x=>x.perShaftGearboxOutKW))},speedSweep:igLast.sweep,propellerRanking:igTop20?{mode:igTop20.mode,statistics:igTop20.stats,ranked:igTop20.rows.map(x=>({kind:x.kind,type:x.row.type,Z:x.row.Z,ae:x.row.ae,pd:x.row.pd,eta:x.row.eta,rpm:x.row.rpm,status:x.row.status}))}:null,candidates:igLast.rows.map(x=>({ratingId:x.r.id,readiness:x.r.readiness,sfoc:x.sf?.value??null}))}};
    try{const existing=JSON.parse(localStorage.getItem(igHistKey)||'[]');existing.unshift(rec);localStorage.setItem(igHistKey,JSON.stringify(existing.slice(0,40)));igAlert(`Integrated design saved to local History · ${rec.id}`,'success')}catch{igAlert('Browser storage blocked; integrated results could not be saved.','error')}
  }
  function igOnRoute(){}
  // Example configurations are synthetic and NEVER written into native module results.
  // They only exercise the integrated orchestration and its real engine catalog.
  const igDemoCases={
    workboat:{name:'DEMO · Offshore utility vessel',description:'Default example · 10 kn, with stored RT imported from sample Resistance History, one B4-type propeller at KT operating point; illustrative numerical inputs.',vs:10,rt:72000,w:.22,t:.16,path:'selection',mode:'kt',D:2.9,Z:4,ae:.70,pd:.92,J:.62,eta:.63,nprop:1,neng:1,gear:4,sea:10,margin:5},
    coastal:{name:'DEMO · Coastal cargo ship',description:'Medium commercial cargo scenario · 13.5 kn, with stored RT imported from sample Resistance History, one large fixed-pitch propeller. All ship coefficients are assumed.',vs:13.5,rt:245000,w:.27,t:.20,path:'selection',mode:'kt',D:4.3,Z:5,ae:.74,pd:.95,J:.67,eta:.62,nprop:1,neng:1,gear:7,sea:12,margin:10},
    twin:{name:'DEMO · Twin-screw passenger vessel',description:'Twin shaft scenario · 16 kn, with stored RT imported from sample Resistance History, two propellers with separate engines; split power is assumed equal.',vs:16,L:125,B:19,T:6.2,CB:.65,S:3600,volume:10500,crstd:1.3,rt:198000,w:.15,t:.12,path:'selection',mode:'kt',D:2.5,Z:4,ae:.82,pd:1.04,J:.79,eta:.67,nprop:2,neng:2,gear:5.4,sea:15,margin:5},
    kq:{name:'DEMO · Platform supply vessel · KQ',description:'KQ branch demonstration · 11 kn, stored RT. Power, RPM and target resistance are assumed to be mutually consistent.',vs:11,rt:100000,w:.24,t:.18,path:'selection',mode:'kq',D:3.1,Z:4,ae:.72,pd:.98,J:.66,eta:.61,nprop:1,neng:1,gear:7,sea:10,margin:5},
    geometry:{name:'DEMO · Workboat B4 Selection',description:'Stored resistance example with KT propeller selection.',vs:11.5,rt:125000,w:.25,t:.17,path:'selection',mode:'kt',D:3.45,Z:4,ae:.68,pd:.96,J:.64,eta:.63,nprop:1,neng:1,gear:7,sea:10,margin:5}
  };
  function igHasDemoSource(){return !!(ig.resistance?.is_demo||ig.prop?.is_demo||ig.wake.some(x=>x.is_demo&&(x.key===ig.wakeChoice||x.key===ig.thrustChoice)));}
  function igUpdateDemoStatus(){ /* examples share the named-design picker */ }
  function igDemoProp(ex){
    const rho=1025,nu=.00000119,etas=.98,etat=.97;
    const va=ex.vs*.5144*(1-ex.w),n=va/(ex.J*ex.D),rpm=60*n;
    const tPer=ex.rt/(1-ex.t)/ex.nprop,kt=tPer/(rho*n*n*ex.D**4);
    const kq=ex.J*kt/(2*Math.PI*ex.eta);
    // Illustrative power demand consistent with the sample open-water efficiency.
    // This is not a lookup from the polynomial engine and not a propeller verification.
    const perKW=(tPer*va/ex.eta)/(1000*etas*etat)*(1+ex.sea/100);
    const totalKW=perKW*ex.nprop;
    const inputs={RT:ex.rt,Vs:ex.vs,w:ex.w,t:ex.t,nprop:ex.nprop,rho,nu,etas,etat,sea:ex.sea/100,D:ex.D};
    return {is_demo:true,mode:ex.mode,kind:'B',type:'B-Series (synthetic example)',model:'B-Series demo',Z:ex.Z,ae:ex.ae,pd:ex.pd,D:ex.D,j:ex.J,kt,kq,eta:ex.eta,rpm,engine:ex.mode==='kq'?totalKW:perKW,thrust:tPer,rt:ex.rt,cavStatus:'NOT SCREENED',status:'DEMO — NOT A NATIVE SOLVER RESULT',inputs};
  }
  async function igApplyDemo(key){
    const ex=igDemoCases[key];if(!ex){igAlert('Sample unavailable.','warn');return}
    igTop20=null;igTop20Signature='';
    ig={name:ex.name,resistance:null,wake:[
      {key:'sample-wa',family:'wake',name:'Demo baseline w',value:ex.w,is_demo:true},
      {key:'sample-wb',family:'wake',name:'Demo lower w',value:Math.max(0,ex.w-.02),is_demo:true},
      {key:'sample-wc',family:'wake',name:'Demo higher w',value:Math.min(.9,ex.w+.02),is_demo:true},
      {key:'sample-ta',family:'thrust',name:'Demo baseline t',value:ex.t,is_demo:true},
      {key:'sample-tb',family:'thrust',name:'Demo lower t',value:Math.max(0,ex.t-.02),is_demo:true},
      {key:'sample-tc',family:'thrust',name:'Demo higher t',value:Math.min(.9,ex.t+.02),is_demo:true}
    ],wakeChoice:'sample-wa',thrustChoice:'sample-ta',w:String(ex.w),t:String(ex.t),
      path:'selection',prop:igDemoProp(ex),engineId:'',settings:{},savedRun:null,demo:{key},nativeSweep:[],resHistoryId:null};
    const form={w:ex.w,t:ex.t,nprop:ex.nprop,rho:1025,nu:.00000119,etas:.98,etat:.97,sea:ex.sea,depth:3,p0:101000,pv:3000,neng:ex.neng,margin:ex.margin,parasitic:0,readiness:'all',service:'unspecified'};
    for(const [k,v] of Object.entries(form))igF(k).value=String(v);
    igLast=null;igF('results').hidden=true;igRefreshResistanceHistory();
    if(!igUseResistanceHistory('demo:DEMO-RES-'+key.toUpperCase(),true))throw Error('Example Resistance History is unavailable.');
    ig.prop=igDemoProp({...ex,rt:ig.resistance.outputs.RT_N});
    igF('w').value=ex.w;igF('t').value=ex.t;
    igSyncArrangementFromCounts();igCavScreenHelp();igUpdateSources();igSaveForm();igUpdateDemoStatus();
    igF('selection-mode').value='kt';igF('design-d').value=ex.D;igF('kq-power').value=Number(ig.prop.inputs?.power)||ig.prop.engine||1000;igF('kq-rpm').value=Number(ig.prop.inputs?.rpmEngine)||Math.round(ig.prop.rpm*ex.gear);igF('kq-gear').value=ex.gear;igUpdateKqFields();
    igAlert('Example loaded · 4 saved Resistance points · no resistance recalculation.','info');
  }
  function igUpdateDemoPropFromInputs(){
    if(!ig.resistance?.is_demo||!ig.prop?.is_demo||!ig.demo?.key)return;
    const ex=igDemoCases[ig.demo.key],w=igNumber('w'),t=igNumber('t');
    if(!ex||!(w>=0&&w<1&&t>=0&&t<1))return;
    igTop20=null;igTop20Signature='';ig.prop=igDemoProp({...ex,w,t,rt:ig.resistance.outputs.RT_N});
    igUpdateSources();igPersist();
  }


  for(const id of ['depth','p0','pv'])igF(id).addEventListener('change',()=>{igInvalidateTop20();igSaveForm();igF('results').hidden=true;igLast=null;igAlert('Cavitation assumptions changed. Recalculate the complete propeller ranking and engine matching.','info')});
  for(const id of ['nprop','neng'])igF(id).addEventListener('change',()=>igSetPowertrainCount(id));
  igF('calculate').addEventListener('click',igCalculate);
  igF('save').addEventListener('click',igSaveNamedDesign);
  igF('load-project').addEventListener('click',()=>{
    const list=igAllDesigns();const select=document.getElementById('ig-load-project-choice');
    select.replaceChildren();
    if(!list.length){const o=new Option('No saved projects in this browser','');select.add(o);}
    else for(let i=0;i<list.length;i++)select.add(new Option(list[i].name, String(i)));
    const selectedIndex=list.findIndex(p=>String(p.name).toLowerCase()===igF('name').value.trim().toLowerCase());
    if(selectedIndex>=0)select.value=String(selectedIndex);
    document.getElementById('ig-load-project-confirm').disabled=list.length===0;
    igF('design-delete').disabled=list.length===0;
    document.getElementById('ig-project-dialog').showModal();
  });
  document.getElementById('ig-load-project-confirm').addEventListener('click',()=>{
    const choice=document.getElementById('ig-load-project-choice').value;
    const list=igAllDesigns(),i=Number(choice);
    if(choice===''||!Number.isInteger(i)||i<0||i>=list.length)return;
    const item=list[i];
    try{igLoadNamedDesign(item);igAlert(`Project loaded: ${item.name}. Press Calculate to refresh the results.`,'success');document.getElementById('ig-project-dialog').close();}
    catch(e){igAlert('Unable to load project: '+e.message,'error')}
  });
  igF('reset').addEventListener('click',igNewDesign);

  for(const which of ['w','t']){igF(which+'-method').addEventListener('change',()=>igSetCoefficient(which,igF(which+'-method').value));igF(which).addEventListener('input',()=>{ig[which==='w'?'wakeChoice':'thrustChoice']='';igSaveForm();igF(which+'-method').value='';igUpdateDemoPropFromInputs()})}
  igF('name').addEventListener('change',igSaveForm);
  igF('prop-rank-refresh').addEventListener('click',()=>igComputeTop20(true));
  igF('prop-rank-body').addEventListener('click',e=>{const btn=e.target.closest('[data-ig-prop-pick]');if(btn)igChooseTop20(Number(btn.dataset.igPropPick))});
  igF('prop-search').addEventListener('input',igRenderPropSearch);
  igF('prop-family').addEventListener('change',()=>{igPropList.page=0;if(igTop20)igRenderTop20();});
  igF('prop-prev').addEventListener('click',()=>{igPropList.page=Math.max(0,igPropList.page-1);igRenderTop20()});
  igF('prop-next').addEventListener('click',()=>{igPropList.page++;igRenderTop20()});
  document.getElementById('ig-prop-goto').addEventListener('change',function(){const total=Math.max(1,Math.ceil((igPropList.matchCount??igTop20?.allRows?.length??0)/igPropList.pageSize));const page=Number(this.value);if(Number.isInteger(page)&&page>=1){igPropList.page=Math.min(page,total)-1;igRenderTop20();}this.value='';});
  igF('show-prop-details').addEventListener('click',()=>{const table=document.querySelector('.ig-prop-rank-table');const expanded=table.classList.toggle('ig-tech-expanded');igF('show-prop-details').setAttribute('aria-pressed',String(expanded));igF('show-prop-details').textContent=expanded?'Fewer columns':'Technical columns';});
  igF('prop-search-hits').addEventListener('click',e=>{const btn=e.target.closest('[data-search-pick]');if(btn)igSelectAnyPropeller(Number(btn.dataset.searchPick))});

  igF('design-new').addEventListener('click',igNewDesign);
  igF('design-delete').addEventListener('click',igRemoveNamedDesign);
  igF('report-print').addEventListener('click',()=>window.print());
  igF('selection-mode').addEventListener('change',()=>{ig.prop=null;igTop20=null;igTop20Signature='';igUpdateKqFields();igF('results').hidden=true;igF('prop-ranks').hidden=true;igSaveForm()});
  igF('design-d').addEventListener('change',()=>{ig.prop=null;igTop20=null;igTop20Signature='';igF('results').hidden=true;igF('prop-ranks').hidden=true;igSaveForm()});
  for(const id of ['kq-power','kq-rpm','kq-gear'])igF(id).addEventListener('change',()=>{ig.prop=null;igTop20=null;igTop20Signature='';igF('results').hidden=true;igF('prop-ranks').hidden=true;igSaveForm()});
  igF('cav-preset').addEventListener('change',igChangeCavCriterion);

  igF('service').addEventListener('change',()=>{igSaveForm();igLast=null;igF('results').hidden=true;igAlert('Service profile changed. Calculate again to update the duty and gearbox screening.','info')});
  igF('readiness').addEventListener('change',igReevaluateEnginesOnly);
  igF('engine-find').addEventListener('input',()=>{igEngineList.query=igF('engine-find').value;igEngineList.page=0;igRenderEngineList()});
  igF('engine-brand').addEventListener('change',()=>{igEngineList.brand=igF('engine-brand').value;igEngineList.page=0;igRenderEngineList()});
  igF('engine-sort').addEventListener('change',()=>{igEngineList.page=0;igRenderEngineList()});
  igF('gear-ratio').addEventListener('change',()=>{
    const ratio=Number(igF('gear-ratio').value);
    if(!igLast?.selectedRow)return;
    if(!(ratio>0&&Number.isFinite(ratio))){igF('gear-ratio').value=igLast.selectedRow.ratio;igAlert('Enter a positive gearbox reduction ratio.','warn');return;}
    ig.gearManual=true;igApplyUserGearRatio(ratio);
  });
  igF('gear-default').addEventListener('click',()=>{
    const row=igLast?.selectedRow;if(!row)return;ig.gearManual=false;igApplyUserGearRatio(row.defaultRatio,true);
  });
  igF('engine-prev').addEventListener('click',()=>{igEngineList.page=Math.max(0,igEngineList.page-1);igRenderEngineList()});
  igF('engine-next').addEventListener('click',()=>{igEngineList.page++;igRenderEngineList()});
  igF('rank-body').addEventListener('click',event=>{const row=event.target.closest('[data-ig-engine]');if(row)igSelectEngine(row.dataset.igEngine);const detail=event.target.closest('[data-ig-inspect]');if(detail)igInspectCatalogRating(detail.dataset.igInspect)});
  igF('catalog-all').addEventListener('change',()=>{igEngineList.all=igF('catalog-all').checked;igEngineList.page=0;igRefreshEngineBrands();igRenderEngineList();igF('catalog-inspect').hidden=true;});

  window.addEventListener('resize',()=>{if(igLast){const selected=igLast.selectedRow||igLast.rows.find(x=>x.r.id===ig.engineId)||igLast.rows[0]||null;igPlot(selected);if(selected)igRenderOperatingPointStrip(selected);igDrawSpeedChart()}else{const r=igRatingsById.get(igCatalogPreviewId);if(r&&igF('results')&&!igF('results').hidden)igPlot(igCatalogPreviewRow(r));}});

  igF('r-history').addEventListener('change',()=>{const h=igResHistoryData.get(igF('r-history').value);igF('r-history-summary').textContent=h?`${h.name} · ${h.method_id} · Vs ${igFmt(h.inputs.vs,2)} kn · RT ${igFmt(h.outputs.RT_N/1000,3)} kN · ${h.pointCount}/4 points. Click Use selected History.`:'Choose a saved calculation.'});
  igF('r-use').addEventListener('click',()=>igUseResistanceHistory(igF('r-history').value));
  igF('r-refresh').addEventListener('click',()=>{igRefreshResistanceHistory();igAlert('Resistance History refreshed from local browser storage.','info')});
  (async()=>{try{
    igRefreshResistanceHistory();igRefreshNamedPicker();
    // Provide an example on the first open, but never overwrite an existing workspace.
    const saved=igLoad();
    if(saved?.resistance?.outputs?.RT_N && Array.isArray(saved.nativeSweep)&&saved.nativeSweep.length===4){
      for(const [k,v] of Object.entries(saved.settings||{}))if(igF(k))igF(k).value=v;
      igRestoreCavChecks(saved.settings);igUpdateSources();igHistoryBadges();igCavScreenHelp();

    }else{await igApplyDemo('workboat');}
    const p=ig.prop;if(p){igF('selection-mode').value=p.mode||'kt';igF('design-d').value=p.D||2.9;}
    igSyncArrangementFromCounts();igCavScreenHelp();igUpdateKqFields();igF('prop-ranks').hidden=true;igF('results').hidden=true;
  }catch(e){igAlert('Workspace initialization failed: '+e.message,'error')}})();
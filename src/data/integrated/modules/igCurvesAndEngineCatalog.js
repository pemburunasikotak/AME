  function igCurveFor(id){
    // v46: all multi-RPM numeric M curves can be INSPECTED regardless of Batch24 certification.
    // This does not change the source's verification/duty flags or constitute FPP approval.
    const curve=(igPower.get(id)||[]).filter(p=>Number.isFinite(p.kw)&&p.kw>0&&Number.isFinite(p.rpm)&&p.rpm>0&&
      /^(?:M(?:\s*[-—_]|_MAX)|A\s*[-—]|Full[- ]load power curve|Maximum power|Power capability|Maximum power envelope)/i.test(p.type)
      &&!/propeller|standard cubic|reference demand/i.test(p.type));
    const grouped=new Map();
    for(const p of curve){if(!grouped.has(p.type))grouped.set(p.type,[]);grouped.get(p.type).push(p)}
    const candidates=[...grouped.values()].filter(arr=>new Set(arr.map(p=>p.rpm)).size>=2);
    candidates.sort((a,b)=>b.length-a.length);
    if(!candidates.length)return [];
    // Never extrapolate beyond the source RPM interval. Duplicate RPM points are deduplicated.
    return [...new Map(candidates[0].slice().sort((a,b)=>a.rpm-b.rpm).map(p=>[p.rpm,p])).values()];
  }

  function igPreliminaryInfo(id){
    const d=igPreliminaryMap.get(id),r=igRatingsById.get(id);
    if(!d||!r||r.application!=='PROPULSION'||d.model!==r.model||Math.abs(d.kw-r.kw)>.01||Math.abs(d.ratedRpm-r.rpm)>.01)return null;
    const points=arr=>(arr||[]).filter(v=>v.length===2&&v.every(x=>Number.isFinite(x))).map(([rpm,kw])=>({rpm,kw})).sort((a,b)=>a.rpm-b.rpm);
    return {...d,mPoints:points(d.m),pPoints:points(d.p)};
  }
  function igCurveEvidenceFor(r){
    const numeric=igCurveFor(r.id);
    if(numeric.length>=2){
      const certified=r.batch24==='OEM_DATA_VERIFIED_CONDITIONAL_MATCHING_INPUT'&&r.mRowsExact>=2&&r.sourceDutyEvidenced;
      const origin=numeric[0]||{};
      return {points:numeric,tier:certified?'conditional':'legacy-numeric',
        evidence:certified?'Batch24 conditional exact OEM M curve':'Existing numeric M source · NOT Batch24-certified for matching',
        source:r.sourceFile||origin.src||origin.url||r.url||'',basis:origin.basis||'',verification:origin.verified||r.verification||'',
        restrictions:certified?'OEM duty and ship-specific approval still required':'Numeric M points are available for chart and preliminary comparison only; source and duty limitations not independently revalidated.'};
    }
    const e=igExtraMMap.get(r.id);
    if(e&&e.model===r.model&&Math.abs(e.kw-r.kw)<.001&&Math.abs(e.ratedRpm-r.rpm)<.001&&e.m?.length>=2){
      const pts=e.m.filter(x=>x.length===2&&x.every(Number.isFinite)).map(x=>({rpm:x[0],kw:x[1]})).sort((a,b)=>a.rpm-b.rpm);
      if(new Set(pts.map(x=>x.rpm)).size>=2)return {points:pts,tier:'archive-numeric',evidence:'Archived numeric OEM M limit · source PDF not independently reinspected',source:e.sourceFile,page:e.sourcePage,scope:e.scope};
    }
    const d=igPreliminaryInfo(r.id);
    if(d&&d.mPoints.length>=2){
      const restricted=!d.usableFPP;
      return {points:d.mPoints,tier:restricted?'digitized-restricted':'digitized',
        evidence:restricted?'Digitized M chart visible as reference only · FPP/fuel-mode gate NOT cleared':'Preliminary chart-digitized M curve (not an OEM numerical table)',
        source:d.source,page:d.page,scope:d.scope,profile:d.profile,restrictions:d.restrictions||'',
        usableFPP:!!d.usableFPP,fuelModeGate:d.fuelModeGate||'',config:d.config||''};
    }
    return {points:[],tier:'nominal',evidence:'Only a rated point or insufficient distinct-RPM M data'};
  }
  function igCurveLabel(row){
    const t=row?.curveTier||row?.curveEvidence?.tier||'';
    return t==='conditional'?'OEM numeric M · conditional':
      t==='legacy-numeric'?'OEM/source numeric M · unverified':
      t==='archive-numeric'?'Archived numeric M · preliminary':
      t==='digitized'?'Digitized M · preliminary':
      t==='digitized-restricted'?'Digitized M · CPP/fuel-mode restricted':'M curve unavailable';
  }
  function igCurveCaution(row){
    const c=row?.curveEvidence||{},t=row?.curveTier||c.tier;
    const s=c.source?' Source: '+c.source+'.':'';
    if(t==='conditional')return 'Batch24 conditional M: documented numeric envelope; engine duty, gearbox and vessel-specific approval remain pending.'+s;
    if(t==='legacy-numeric')return 'Numeric multi-RPM M points are present in the catalog, but rating-specific source/duty certification has not been completed. Reference comparison only; not approval.'+s+(c.basis?' Basis: '+c.basis+'.':'');
    if(t==='archive-numeric')return 'Archived numeric M source was not independently reinspected. Preliminary comparison only; not approval.'+s;
    if(t==='digitized')return 'M curve digitized from an OEM chart, not a verified numeric table. Approximate comparison only; not approval.'+s+(c.restrictions?' '+c.restrictions:'');
    if(t==='digitized-restricted')return 'M curve is DISPLAYED for inspection, but this chart is NOT cleared for FPP matching or the selected fuel/CPP mode. Do not interpret its power limits as valid for a fixed-pitch propeller or as OEM approval.'+s+(c.restrictions?' '+c.restrictions:'');
    return 'Insufficient multi-RPM M data; rated point only.';
  }

  function igReferencePropellerCurveFor(id){
    const r=igRatingsById.get(id);
    const pts=(igPower.get(id)||[]).filter(p=>p.rpm>0&&p.kw>=0&&/^(?:P(?:1)?(?:\s*[-—_]|_OEM_|_REF)|Propeller-load reference curve)/i.test(p.type)
      &&!/combinator|CPP|layout point/i.test(p.type));
    const types=new Map();for(const p of pts){if(!types.has(p.type))types.set(p.type,[]);types.get(p.type).push(p)}
    const valid=[...types].filter(([,arr])=>new Set(arr.map(x=>x.rpm)).size>=2).sort((a,b)=>b[1].length-a[1].length);
    if(valid.length){
      const [type,raw]=valid[0];
      const points=[...new Map(raw.slice().sort((a,b)=>a.rpm-b.rpm).map(p=>[p.rpm,p])).values()];
      return {points,type,cubic:/standard cubic|n\^3|n³/i.test(type),basis:raw[0]?.basis||'',url:raw[0]?.url||'',conditional:!!(r&&r.batch24==='OEM_DATA_VERIFIED_CONDITIONAL_MATCHING_INPUT'&&r.pRowsExact>=2),digitized:false};
    }
    const d=igPreliminaryInfo(id);
    if(!d?.usableFPP||d.pPoints.length<2)return null;
    return {points:d.pPoints,type:'Digitized reference P ('+d.profile+')',cubic:false,basis:d.basis||'',url:r?.url||'',conditional:false,digitized:true,source:d.source,page:d.page};
  }
  
  function igInterpolate(x,points,xkey,ykey){
    const v=points.filter(q=>igFinite(q[xkey])&&igFinite(q[ykey])).sort((a,b)=>a[xkey]-b[xkey]);
    if(v.length<2||x<v[0][xkey]||x>v[v.length-1][xkey])return null;
    for(let i=1;i<v.length;i++){const a=v[i-1],b=v[i];if(x>=a[xkey]&&x<=b[xkey]){
      if(b[xkey]===a[xkey])return a[ykey];return a[ykey]+(b[ykey]-a[ykey])*(x-a[xkey])/(b[xkey]-a[xkey]);
    }}return null;
  }
  function igEstimateSfoc(r,rpm,powerKW){
    const pts=(igSfoc.get(r.id)||[]).filter(p=>p.unit==='g/kWh'&&igFinite(p.g)&&p.g>0&&igFinite(p.rpm)),n=igNumber('neng'),load=powerKW/(n*r.kw)*100;
    const grouped=new Map();for(const p of pts){if(!grouped.has(p.type))grouped.set(p.type,[]);grouped.get(p.type).push(p)}
    const attempts=[];
    for(const [type,arr] of grouped){
      const loadMap=arr.filter(p=>p.load!==null&&igFinite(p.load)&&p.rpm&&Math.abs(p.rpm-rpm)<=Math.max(1,.001*r.rpm));
      const sL=igInterpolate(load,loadMap,'load','g');
      if(igFinite(sL))attempts.push({value:sL,type,why:'OEM same-RPM load-table interpolation (no RPM extrapolation)',quality:1,source:loadMap[0]?.url});
      if(/BSEC|BSGC|BSPC|fuel gas|pilot|energy/i.test(type))continue;
      // A fuel point from an OEM propeller-demand curve may only be carried to
      // the selected design if the ENGINE power is on that SAME reference curve.
      const pcurve=(igPower.get(r.id)||[]).filter(x=>x.type===type&&x.rpm);
      const refP=igInterpolate(rpm,pcurve,'rpm','kw');
      if(igFinite(refP)&&Math.abs(refP-powerKW/n)<=.035*Math.max(1,refP)){
        const sR=igInterpolate(rpm,arr,'rpm','g');
        if(igFinite(sR))attempts.push({value:sR,type,why:'OEM reference-curve interpolation (design point coincides)',quality:2,source:arr[0]?.url});
      }
    }
    attempts.sort((a,b)=>a.quality-b.quality);
    return attempts[0]||null;
  }
  // Catalog ratio proximity is a DOCUMENTATION check, not a gearbox approval.
  // Actual model acceptance also needs rated input power at operating speed, torque,
  // duty, thermal limit and manufacturer confirmation.
  function igDutyEvidence(r){
    const profile=igF('service')?.value||'unspecified';
    const oem=String(r.duty||'').trim();
    // Identifying a duty code is NOT the same as proving that this vessel's
    // running hours, load cycle, and full-power duration meet that code.
    const source=!!(r.sourceDutyEvidenced&&oem);
    const hold=r.batch24==='HOLD_MASTER_DUTY_METADATA';
    return {profile,source,hold,code:oem||'Not stated',approved:false,
      status:hold?'HOLD':source?'OEM CATEGORY ONLY':'NOT VERIFIED',
      reason:hold?'OEM duty metadata on hold':source?'Source duty class identified; vessel load-cycle/annual-hours approval pending':'Missing rating-specific OEM duty constraints'};
  }
  function igGearRatioEvidence(ratio,peakEngineRpm,checks=[],valid=[],profile='unspecified'){
    const catalog=(igData.gearboxes||[]).filter(g=>Number.isFinite(g.ratio)&&g.ratio>=1);
    if(!Number.isFinite(ratio)||ratio<1||!catalog.length)return {ratioNear:false,exact:false,capacityScreen:false,status:'NO CATALOG',label:'No catalog gearbox',nearest:null};
    const pairs=catalog.map(g=>({g,delta:Math.abs(g.ratio-ratio)/ratio})).sort((a,b)=>a.delta-b.delta);
    const near=pairs.filter(x=>x.delta<=.02),exact=pairs.filter(x=>x.delta<1e-7);
    const compatible=g=>!(profile==='continuous'&&/pleasure/i.test(String(g.duty||'')));
    const permitted=exact.filter(x=>compatible(x.g)&&(!Number.isFinite(x.g.maxRPM)||peakEngineRpm<=x.g.maxRPM+1e-7));
    let winner=null,conflict=false;
    for(const x of permitted){
      const cap=(igGearCap.get(x.g.id)||[]).filter(p=>Number.isFinite(p.rpm)&&Number.isFinite(p.kw)&&p.kw>0).sort((a,b)=>a.rpm-b.rpm);
      let availablePoints=0,checkedPoints=0,hasExceed=false,interpolated=0;
      for(let i=0;i<checks.length;i++){
        // Published gearbox capacity is at the input (engine) RPM; no source-point extrapolation.
        const rpm=checks[i].engineRpm,requirement=valid[i].perEngineKW-igNumber('parasitic');
        const capKW=igInterpolate(rpm,cap,'rpm','kw');
        if(Number.isFinite(capKW)){
          availablePoints++;if(requirement>capKW+1e-7)hasExceed=true;
          else checkedPoints++;
          if(!cap.some(z=>Math.abs(z.rpm-rpm)<1e-5))interpolated++;
        }
      }
      if(hasExceed){conflict=true;continue;}
      const c={g:x.g,delta:x.delta,availablePoints,capacityPoints:checkedPoints,fullySampled:checkedPoints===checks.length&&checks.length===4,interpolated};
      if(!winner||Number(c.fullySampled)>Number(winner.fullySampled)||c.capacityPoints>winner.capacityPoints)winner=c;
    }
    const supported=winner?.g||null;
    const hasExact=!!winner;
    const full=!!winner?.fullySampled;
    const status=full?'CATALOG POWER/RPM SCREEN':hasExact?'CATALOG RATIO · CAPACITY UNVERIFIED':conflict?'CATALOG POWER EXCEEDED':exact.length?'CATALOG RPM/DUTY CONFLICT':near.length?'NEAR RATIO ONLY':'NO CATALOG RATIO';
    const nearest=pairs[0];
    const label=full?`${supported.brand} ${supported.model} (${igFmt(supported.ratio,3)}:1) · 4/4 in catalog power/RPM domain${winner.interpolated?' · linearly interpolated':''}; torque/thermal/duty approval pending`:
      hasExact?`${supported.brand} ${supported.model} ${igFmt(supported.ratio,3)}:1 · ${winner.capacityPoints}/4 power/RPM points supported; remaining capacity unverified`:
      `No usable exact gearbox (${igFmt(ratio,3)}:1). Closest ${igFmt(nearest.g.ratio,3)}:1; gap ${igFmt(nearest.delta*100,2)}%.`;
    return {nearest,nearCount:near.length,ratioNear:hasExact,exact:hasExact,capacityScreen:full,capacityPoints:winner?.capacityPoints||0,supported,
      overCapacity:conflict,status,label,provisional:true,torqueVerified:false,thermalVerified:false,dutyVerified:false};
  }
  function igRankEngines(powerKW,points){
    // v37: 142 active M-curve ratings, no suitability filtering or weighting.
    // The original propeller Selection v162 remains unchanged.
    const valid=points.filter(p=>Number.isFinite(p.perEngineKW)&&Number.isFinite(p.propRpm)&&p.propRpm>0);
    if(valid.length!==4)return [];
    const design=valid.find(p=>p.isDesign)||valid[2];
    const rows=[];
    for(const r of igData.rated){
      if(!igEligibility(r)||!(r.kw>0&&r.rpm>0))continue;
      const row=igBuildEnginePowerRow(r,valid);
      if(row)rows.push(row);
    }
    // No filter: even >100% MCR ratings remain selectable and clearly marked.
    rows.sort((a,b)=>b.load-a.load||(a.r.brand||'').localeCompare(b.r.brand||'')||(a.r.model||'').localeCompare(b.r.model||'')||(a.r.id||'').localeCompare(b.r.id||''));
    igEngineStats={scanned:rows.length,displayed:rows.length};
    return rows;
  }
  function igBuildEnginePowerRow(r,valid){
    if(!r||!(r.kw>0&&r.rpm>0)||valid.length!==4)return null;
    const design=valid.find(p=>p.isDesign)||valid[2];
    const ratio=r.rpm/Math.max(...valid.map(p=>p.propRpm)); // default keeps four-point sampled engine RPM at/below rated RPM
    const curve=igCurveEvidenceFor(r),envelope=(curve.points||[]).filter(q=>Number.isFinite(q.rpm)&&Number.isFinite(q.kw)).sort((a,b)=>a.rpm-b.rpm);
    const hasCurve=envelope.length>=2;
    const rpmMin=Number.isFinite(r.publishedRpmMin)&&r.publishedRpmMin>0?r.publishedRpmMin:null;
    const rpmMax=Number.isFinite(r.publishedRpmMax)&&r.publishedRpmMax>0?r.publishedRpmMax:r.rpm;
    const checks=valid.map(p=>{
      const engineRpm=p.propRpm*ratio;
      const available=hasCurve?igInterpolate(engineRpm,envelope,'rpm','kw'):null;
      const rpmPass=engineRpm<=rpmMax+1e-8&&(rpmMin==null||engineRpm>=rpmMin-1e-8);
      const powerPass=p.perEngineKW<=r.kw+1e-8;
      const curvePass=hasCurve&&Number.isFinite(available)?p.perEngineKW<=available+1e-8:null;
      return {engineRpm,required:p.perEngineKW,available,rpmPass,powerPass,curvePass,feasible:rpmPass&&powerPass&&curvePass===true};
    });
    const available=checks[2]?.available;
    const sf=igEstimateSfoc(r,checks[2].engineRpm,design.totalBrakeKW);
    const powerPct=100*design.perEngineKW/r.kw;
    return {r,ratio,defaultRatio:ratio,operationalRPM:checks[2].engineRpm,load:powerPct,sf,
      envelope,sourceEnvelope:curve.tier==='conditional',curveEnvelope:hasCurve,
      preliminaryEnvelope:hasCurve&&curve.tier!=='conditional',archiveNumeric:curve.tier==='archive-numeric',
      legacyNumeric:curve.tier==='legacy-numeric',restrictedCurve:curve.tier==='digitized-restricted',
      curveTier:curve.tier,curveEvidence:curve,
      available,checks, reserve:hasCurve&&checks.every(x=>Number.isFinite(x.available)&&x.available>0)?Math.min(...checks.map(x=>(x.available-x.required)/x.available)):null,
      peakPerEngine:Math.max(...valid.map(p=>p.perEngineKW)),
      dutyEvidence:igDutyEvidence(r),rpmGate:rpmMin!=null?'OEM RANGE GIVEN':'RPM MIN NOT PUBLISHED',
      mGate:hasCurve?'M CURVE ON FILE':'M CURVE MISSING',gearGate:'USER INPUT',
      gearEvidence:{capacityScreen:false,label:'Manual ratio. Verify gearbox power, speed, torque and duty separately.'},
      matchStatus:'POWER LOAD COMPARISON ONLY',previewOnly:false};
  }
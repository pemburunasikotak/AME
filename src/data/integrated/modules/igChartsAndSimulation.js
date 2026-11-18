  function igMakeSpeedSweep(result){return Array.isArray(ig.calculatedFour)?ig.calculatedFour:[]}
  async function igComputeFourPower(p){
    const selection=await igGetCore();
    const src=selection.eval('({core:PropCore,db:JSON.parse(document.getElementById("dataset").textContent)})');
    const I={...p.inputs,D:p.D,Z:p.Z,ae:p.ae,pd:p.pd,RT:ig.resistance.outputs.RT_N,Vs:igResistanceVs(),
      w:igNumber('w'),t:igNumber('t'),nprop:igNumber('nprop'),rho:igNumber('rho'),nu:igNumber('nu'),
      etas:igNumber('etas'),etat:igNumber('etat'),sea:igNumber('sea')/100,h:igNumber('depth'),p0:igNumber('p0'),pv:igNumber('pv')};
    const result=[];
    for(let k=0;k<4;k++){
      const point=ig.nativeSweep?.[k];if(!point?.rt){result.push({v:point?.v,rt:null,isDesign:k===2,error:'Native resistance method outside domain',index:k});continue}
      const current={...I,RT:point.rt,Vs:point.v};
      try{
        const selected={index:p.sourceIndex||p.index||1,Z:p.Z,ae:p.ae,pd:p.pd,model:p.model,type:p.type,jmax:p.jmax};
        const curve=src.core.curve(src.db,p.kind||'B',selected,current);
        const kin=src.core.kinematic(current),jmin=.01,jmax=curve.jmax||1.6;
        let a=null,b=null;
        for(let j=jmin;j<jmax;j+=(jmax-jmin)/480){const c=curve.at(j),f=c.kt-kin.beta*j*j;
          if(c.kt<=0||c.kq<=0||!Number.isFinite(f))break;
          if(a&&a.f*f<=0){b={j,f};break}a={j,f};
        }
        if(!a||!b)throw Error('No KTship crossing at this speed');
        for(let i=0;i<64;i++){let j=(a.j+b.j)/2,c=curve.at(j),f=c.kt-kin.beta*j*j;if(a.f*f<=0)b={j,f};else a={j,f}}
        const j=(a.j+b.j)/2,c=curve.at(j),n=kin.va/(j*p.D),propRpm=60*n;
        const ktResidual=Math.abs(c.kt-kin.beta*j*j);
        if(ktResidual>Math.max(1e-8,Number(I.eps)||1e-4))throw Error('KTship thrust residual exceeds source tolerance');
        const thrust=c.kt*current.rho*n*n*Math.pow(p.D,4);
        const cav=igCavAtPoint(current,p,c,n,thrust);
        if(!cav.pass)throw Error('Cavitation failed at '+igFmt(point.v,2)+' kn: '+cav.reason);
        const shaft=2*Math.PI*current.rho*n**3*p.D**5*c.kq/1000;
        const driveBrakeKW=shaft*current.nprop/(current.etas*current.etat)*(1+igNumber('margin')/100);
        const totalBrakeKW=driveBrakeKW+igNumber('parasitic')*igNumber('neng');
        const engRPM=null;
        if(!(shaft>0&&totalBrakeKW>0&&n>0&&c.eta>0&&c.eta<1))throw Error('Nonphysical KT/KQ point');
        const perShaftGearboxOutKW=shaft/current.etas;
        result.push({index:k,v:point.v,rt:point.rt,totalBrakeKW,driveBrakeKW,parasiticTotalKW:igNumber('parasitic')*igNumber('neng'),perEngineKW:totalBrakeKW/igNumber('neng'),propRpm,
          engineRpm:engRPM,perShaftBrakeKW:shaft/(current.etas*current.etat),perShaftGearboxOutKW,
          torqueKNm:9550*perShaftGearboxOutKW/propRpm/1000,eta:c.eta,j,kt:c.kt,kq:c.kq,ktResidual,cav,isDesign:k===2,
          source:'Native resistance '+point.source+' + native propeller '+(p.kind||'B')+' polynomial',status:point.status});
      }catch(e){result.push({index:k,v:point.v,rt:point.rt,error:e.message,isDesign:k===2});}
    }
    if(!result[2]?.totalBrakeKW)throw Error('Propeller polynomial did not produce a valid operating-point crossing. '+(result[2]?.error||''));
    return result;
  }
  function igSweepCheck(point,row){
    if(point.error)return point.error;
    if(!row)return 'No matching engine';
    if(point.engineRpm>row.r.rpm*1.0001)return 'Above rated RPM';
    if(point.perEngineKW>row.r.kw+1e-8)return 'Above 100% MCR';
    if(row.curveEnvelope){
      const available=igInterpolate(point.engineRpm,row.envelope,'rpm','kw');
      if(!igFinite(available))return 'Outside M-curve RPM domain';
      if(row.restrictedCurve)return point.perEngineKW<=available+1e-7?'REFERENCE ONLY · CPP/fuel-mode restrictions':'EXCEEDS restricted reference M';
      if(row.preliminaryEnvelope)return point.perEngineKW<=available+1e-7?'Within preliminary M (unverified)':'EXCEEDS preliminary M (unverified)';
      return point.perEngineKW<=available+1e-7?'Within published OEM M curve':'EXCEEDS published OEM M power';
    }
    return 'Nominal-only · off-rating unverified';
  }

  function igDrawSpeedChart(){
    const canvas=igF('speed-chart'),points=igLast?.sweep;if(!canvas||!points?.length)return;
    const rect=canvas.getBoundingClientRect();if(rect.width<30)return;
    const dpr=Math.min(2,devicePixelRatio||1),w=rect.width,h=rect.height;
    canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);const m={l:65,r:22,t:27,b:44},W=w-m.l-m.r,H=h-m.t-m.b;
    const p=points.filter(x=>Number.isFinite(x.totalBrakeKW));if(!p.length)return;
    const min=points[0].v,max=points.at(-1).v,maxP=Math.max(...p.map(x=>x.totalBrakeKW))*1.18;
    const X=x=>m.l+(x-min)/(max-min)*W,Y=y=>m.t+H*(1-y/maxP);
    ctx.font='11px Arial';ctx.fillStyle='#597281';ctx.textAlign='right';
    for(let i=0;i<=5;i++){let yy=maxP*i/5;ctx.strokeStyle='#e4ecee';ctx.beginPath();ctx.moveTo(m.l,Y(yy));ctx.lineTo(m.l+W,Y(yy));ctx.stroke();ctx.fillText(igFmt(yy,0),m.l-8,Y(yy)+3)}
    ctx.textAlign='left';ctx.fillText('Total BHP · kW',m.l,13);
    p.forEach((pt,i)=>{const prev=p[i-1];if(prev&&pt.index-prev.index===1){ctx.beginPath();ctx.moveTo(X(prev.v),Y(prev.totalBrakeKW));ctx.lineTo(X(pt.v),Y(pt.totalBrakeKW));ctx.strokeStyle='#107b8d';ctx.lineWidth=2;ctx.stroke()}});
    points.forEach((pt,i)=>{const x=X(pt.v);ctx.textAlign='center';ctx.fillStyle='#718997';ctx.fillText(igFmt(pt.v,1),x,h-22);
      if(pt.totalBrakeKW){ctx.beginPath();ctx.arc(x,Y(pt.totalBrakeKW),pt.isDesign?6:4,0,7);ctx.fillStyle=pt.isDesign?'#d55449':'#0e8298';ctx.fill()}
      else{ctx.fillStyle='#a64037';ctx.fillText('×',x,m.t+H/2)}
    });
    ctx.fillStyle='#617987';ctx.fillText('Ship speed (kn)',w-82,h-5);
  }
  function igRenderSweep(row){
    const points=igLast?.sweep||[];igF('curve-count').textContent=`${points.length} points`;
    igF('speed-rows').innerHTML=points.map(x=>`<tr class="${x.isDesign?'ig-reference-point':''}"><td>${igFmt(x.v,2)}${x.isDesign?' · operating':''}</td><td>${x.rt?igFmt(x.rt/1000,2):'—'}</td><td>${igFmt(x.totalBrakeKW,1)}</td><td>${igFmt(x.propRpm,1)}</td><td>${igFmt(x.engineRpm,1)}</td><td>${igCavMode()==='none'?'NOT CHECKED':x.cav?.pass?'SCREENED':'FAIL'}</td><td>${igEsc(igSweepCheck(x,row))}</td></tr>`).join('');igDrawSpeedChart();
  }
  const igGearCap=new Map();
  for(const pt of igData.capacities||[]){if(!igGearCap.has(pt.id))igGearCap.set(pt.id,[]);igGearCap.get(pt.id).push(pt)}
  function igRenderGearboxCatalog(row){
    const target=igF('gear-catalog-rows'),badge=igF('gear-catalog-status');if(!target||!badge)return;
    if(!row||!igLast?.sweep?.length){target.innerHTML='<tr><td colspan="6">No engine selected.</td></tr>';badge.textContent='Not evaluated';return}
    const ratio=row.ratio,actual=igLast.sweep,requiredKW=Math.max(...actual.map(p=>p.perShaftBrakeKW)),
          operatingRPM=row.operationalRPM,peakRPM=Math.max(...actual.map(p=>p.engineRpm));
    let candidates=(igData.gearboxes||[]).filter(g=>Number.isFinite(g.ratio)&&g.ratio>=1).map(g=>({g,delta:Math.abs(g.ratio-ratio)/ratio}));
    candidates.sort((a,b)=>a.delta-b.delta);
    candidates=candidates.slice(0,8);
    target.innerHTML=candidates.map(({g,delta})=>{
       const rows=igGearCap.get(g.id)||[];
       const exact=rows.find(p=>Number.isFinite(p.rpm)&&Math.abs(p.rpm-operatingRPM)<=.001&&p.kw>=0);
       const capStr=exact?igFmt(exact.kw,1)+' kW @ '+igFmt(exact.rpm,0)+' RPM':rows.length+' OEM points; no exact RPM capacity';
       const status=delta>.02?'Ratio mismatch':!(Number.isFinite(g.maxRPM)&&peakRPM<=g.maxRPM)?'RPM limit / missing':!exact?'Capacity at actual RPM unverified':
         requiredKW>exact.kw?'Power exceeds published capacity':'Provisional only · duty/thermal check';
       return '<tr><td><b>'+igEsc(g.brand)+' '+igEsc(g.model)+'</b><small>'+igEsc(g.edition||'')+'</small></td><td>'+igFmt(g.ratio,3)+':1</td><td>'+igFmt(delta*100,2)+'%</td><td>'+igEsc(g.duty||'—')+'</td><td>'+igEsc(capStr)+'</td><td class="'+(status.startsWith('Provisional')?'ig-oem-conditional':'ig-hold')+'">'+igEsc(status)+'</td></tr>';
    }).join('');
    badge.textContent=igData.gearboxes.length+' catalog ratios · no automatic gearbox approval';
  }
  function igRenderGearbox(row){
    const sweep=(igLast?.sweep||[]).filter(x=>Number.isFinite(x.totalBrakeKW));if(!sweep.length)return;
    const ratio=row?.ratio,withEngine=Number.isFinite(ratio)&&ratio>=1;
    const nprop=igNumber('nprop');
    const minV=sweep[0],maxV=sweep[sweep.length-1],
      peakGearPower=Math.max(...sweep.map(p=>p.perShaftGearboxOutKW)),
      peakTorque=Math.max(...sweep.map(p=>p.torqueKNm)),
      maxPowerPerEngine=Math.max(...sweep.map(p=>p.perEngineKW)),
      powerExceed=row&&(maxPowerPerEngine>row.r.kw+1e-9),
      rpmExceed=row&&sweep.some(p=>p.engineRpm>row.r.rpm*1.0001);
    const boxes=[
      ['Calculated required ratio',withEngine?`${igFmt(ratio,3)} : 1`:'—',row?.gearEvidence?.label||'Not an approved gearbox model'],
      ['Input speed',withEngine?`${igFmt(minV.engineRpm,0)}–${igFmt(maxV.engineRpm,0)} rpm`:'—','Required engine-side speed range'],
      ['Output speed',`${igFmt(minV.propRpm,0)}–${igFmt(maxV.propRpm,0)} rpm`,'Required propeller-side speed range'],
      ['Gearbox output power',`≥ ${igFmt(peakGearPower,1)} kW / shaft`,'Calculated four-point maximum'],
      ['Gearbox output torque',`≥ ${igFmt(peakTorque,2)} kN·m`,'Calculated four-point maximum'],
      ['Engine brake demand',`≥ ${igFmt(maxPowerPerEngine,1)} kW / engine`,'Calculated four-point maximum'],
      ['Engine rated speed',row?`${igFmt(row.r.rpm,0)} rpm`:'—','Nominal engine rating'],
      ['Engine rated power',row?`${igFmt(row.r.kw,0)} kW`:'—','Nominal engine rating']
    ];
    igF('gear-summary').innerHTML=boxes.map(([label,value,note])=>`<div class="ig-gear-tile"><small>${igEsc(label)}</small><strong>${igEsc(value)}</strong><span>${igEsc(note)}</span></div>`).join('')+
      ((powerExceed||rpmExceed)?`<div class="ig-gear-alert" style="grid-column:1/-1">${powerExceed?'WARNING: Peak power exceeds engine MCR. ':''}${rpmExceed?'WARNING: Engine rated RPM exceeded.':''}</div>`:'');
    const rated=(igLast?.rows||[]).slice(0,12);
    igF('gear-options').innerHTML=rated.map(item=>{
      const r=item.r,proposed=item.ratio;
      return `<tr><td><b>${igEsc(r.brand)} ${igEsc(r.model)}</b><small>${igEsc(r.id)}</small></td><td>${igFmt(proposed,3)} : 1</td><td>${igFmt(r.rpm,0)}</td><td>${igFmt(r.kw,0)}</td><td>${igFmt(minV.propRpm*proposed,0)}–${igFmt(maxV.propRpm*proposed,0)}</td><td>${igEsc(igCurveLabel(item))} · not an approval</td><td><button class="ig-btn ig-entry-btn ig-gear-apply" data-ig-engine="${igEsc(r.id)}" type="button">Select engine</button></td></tr>`;
    }).join('')||'<tr><td colspan="7">No engine ratings match the design point.</td></tr>';
  }
  function igEngineDetail(row){
    const r=row.r,sf=row.sf,margin=Number.isFinite(row.reserve)?igFmt(100*row.reserve,1)+'%':'—';
    const category=igCurveLabel(row);
    return `<h3>${igEsc(r.brand)} · ${igEsc(r.model)}</h3><p>${igEsc(r.configuration)} · ${igEsc(r.duty)}<br>${igEsc(r.fuel)} · ${igEsc(igEnglish(r.application))}</p><div class="ig-detail-grid"><span>Rating ID</span><b>${igEsc(r.id)}</b><span>Rated power</span><b>${igFmt(r.kw,1)} kW / engine</b><span>Rated speed</span><b>${igFmt(r.rpm,0)} rpm</b><span>Operating load</span><b>${igFmt(row.load,1)} % MCR</b><span>M-curve preliminary power margin</span><b>${margin} · ${row.sourceEnvelope?'conditional':'not validated'}</b><span>User input reduction ratio</span><b>${igFmt(row.ratio,3)} : 1</b><span>Parasitic load</span><b>${igFmt(igNumber('parasitic'),1)} kW / engine</b><span>Engine envelope</span><b>${igEsc(category)}</b><span>Predicted SFOC</span><b>${sf?igFmt(sf.value,1)+' g/kWh':'Not available for this point'}</b><span>Fuel consumption</span><b>${sf?igFmt(sf.value*igLast.power/1000,1)+' kg/h (total)':'Not available'}</b><span>Evidence status</span><b>${igEsc(r.readiness)}</b></div><p>${igEsc(igCurveCaution(row))}</p><p>${sf?igEsc(sf.why)+': '+igEsc(igEnglish(sf.type)):'No matching OEM SFOC point; no extrapolation.'}</p><p>${r.url?`<a href="${igEsc(r.url)}" target="_blank" rel="noopener noreferrer">View source technical document ↗</a>`:'No source URL stored'}</p>`;
  }

  function igPlot(row){
    // PropExpert-inspired layout: engine/propeller curve with adjacent operating-point detail grid.
    // Preserve actual ARUS numerical four-point solutions and OEM source-curve provenance.
    const c=igF('epm'), panel=igF('pe-plot-data');
    if(!c)return;
    const points=(igLast?.sweep||[]).filter(p=>Number.isFinite(p.engineRpm)&&Number.isFinite(p.perEngineKW));
    const rating=row?.r,env=(row?.curveEnvelope&&Array.isArray(row.envelope))?row.envelope.filter(p=>Number.isFinite(p.rpm)&&Number.isFinite(p.kw)).slice().sort((a,b)=>a.rpm-b.rpm):[];
    const engineProp=rating?igReferencePropellerCurveFor(rating.id):null;
    const refPoints=engineProp?.points||[];
    const para=Math.max(0,Number(igNumber('parasitic'))||0);
    const hasCurve=env.length>=2;
    const brakeOf=p=>p.perEngineKW;
    const propOf=p=>Math.max(0,brakeOf(p)-para); // Drive brake input after auxiliaries, NOT shaft power.
    const rpmValues=[...points.map(p=>p.engineRpm),...(hasCurve?env.map(p=>p.rpm):[]),...refPoints.map(p=>p.rpm),rating?.rpm||0].filter(Number.isFinite);
    const powerValues=[...points.map(p=>brakeOf(p)),...(hasCurve?env.map(p=>p.kw):[]),...refPoints.map(p=>p.kw),rating?.kw||0].filter(Number.isFinite);
    const rect=c.getBoundingClientRect();if(rect.width<30||rect.height<60)return;
    const dpr=Math.min(2,window.devicePixelRatio||1),w=rect.width,h=rect.height;
    c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);
    const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const m={l:w<520?62:76,r:20,t:28,b:51},W=Math.max(60,w-m.l-m.r),H=Math.max(70,h-m.t-m.b);
    const xmax=Math.max(100,...rpmValues)*1.09;
    const ymax=Math.max(50,...powerValues)*1.14;
    const X=x=>m.l+x/xmax*W, Y=y=>m.t+H*(1-y/ymax);
    const cls={engine:'#1445a6',net:'#4c70c7',prop:'#2c9159',reference:'#8855a5',op:'#c6443b',minor:'#b37c2a',axis:'#526879',grid:'#e2e7eb',over:'#cf5b48'};
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
    ctx.save();ctx.beginPath();ctx.rect(m.l,m.t,W,H);ctx.clip();
    // Region above sourced OEM M envelope is NOT an approved overload envelope.
    if(hasCurve && row.sourceEnvelope){
      ctx.beginPath();ctx.moveTo(X(env[0].rpm),m.t);ctx.lineTo(X(env[env.length-1].rpm),m.t);
      for(let k=env.length-1;k>=0;k--)ctx.lineTo(X(env[k].rpm),Y(Math.max(0,env[k].kw-para)));
      ctx.closePath();ctx.fillStyle='rgba(207,91,72,.085)';ctx.fill();
    }
    ctx.restore();
    ctx.font='11px Arial, sans-serif';ctx.textBaseline='middle';ctx.lineWidth=1;
    const niceStep=raw=>{const base=10**Math.floor(Math.log10(raw||1)),r=raw/base;return (r<=1?1:r<=2?2:r<=2.5?2.5:r<=5?5:10)*base};
    const xs=niceStep(xmax/5),ys=niceStep(ymax/5);
    for(let y=0;y<=ymax+1e-7;y+=ys){const yy=Y(y);ctx.beginPath();ctx.moveTo(m.l,yy);ctx.lineTo(w-m.r,yy);ctx.strokeStyle=cls.grid;ctx.stroke();ctx.textAlign='right';ctx.fillStyle=cls.axis;ctx.fillText(igFmt(y,y<10?1:0),m.l-8,yy)}
    for(let x=0;x<=xmax+1e-7;x+=xs){const xx=X(x);ctx.beginPath();ctx.moveTo(xx,m.t);ctx.lineTo(xx,m.t+H);ctx.strokeStyle=cls.grid;ctx.stroke();ctx.textAlign='center';ctx.fillStyle=cls.axis;ctx.fillText(igFmt(x,0),xx,h-31)}
    ctx.lineWidth=1;ctx.strokeStyle='#8b9ba7';ctx.beginPath();ctx.moveTo(m.l,m.t);ctx.lineTo(m.l,m.t+H);ctx.lineTo(m.l+W,m.t+H);ctx.stroke();
    ctx.fillStyle='#314d61';ctx.font='bold 11px Arial, sans-serif';ctx.textAlign='left';ctx.fillText('Power (kW / engine)',m.l,12);ctx.textAlign='center';ctx.fillText('Engine speed (RPM)',m.l+W/2,h-10);
    const stroke=(data,color,width=2,dash=[])=>{if(data.length<2)return;ctx.save();ctx.beginPath();ctx.rect(m.l,m.t,W,H);ctx.clip();ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dash);for(let i=0;i<data.length;i++){const p=data[i];if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;i?ctx.lineTo(X(p[0]),Y(p[1])):ctx.moveTo(X(p[0]),Y(p[1]))}ctx.stroke();ctx.restore()};
    if(hasCurve){
      // Gross published M-curve and dashed net available power remaining after parasitic loads.
      stroke(env.map(p=>[p.rpm,p.kw]),cls.engine,3.2,row.preliminaryEnvelope?[6,3]:[]);
      if(para>0)stroke(env.map(p=>[p.rpm,Math.max(0,p.kw-para)]),cls.net,2.2,[7,4]);
    }
    // Manufacturer reference P-curve is independent of the actual propeller,
    // so it is plotted but NEVER used as an operating limit for engine matching.
    // OEM tabulated points are connected only within their actual RPM domain.
    if(refPoints.length>=2){
      stroke(refPoints.map(p=>[p.rpm,p.kw]),cls.reference,2.8,engineProp.cubic||!engineProp.conditional?[5,3]:[]);
    }
    const ordered=points.slice().sort((a,b)=>a.index-b.index);
    // Only the four source-calculated RT/KT/KQ operating solutions are engineering data.
    // For a readable continuous Propeller Load Line, apply shape-preserving cubic
    // interpolation BETWEEN adjacent calculated points; never create additional RT values.
    const segments=[];let series=[];
    for(const p of ordered){
      const point={x:p.engineRpm,y:propOf(p),index:p.index};
      if(series.length&&(p.index!==series.at(-1).index+1||point.x<=series.at(-1).x)){
        segments.push(series);series=[];
      }
      series.push(point);
    }
    if(series.length)segments.push(series);
    function interpolatePropeller(segment){
      const n=segment.length;
      if(n<2)return segment.map(p=>[p.x,p.y]);
      const h=Array.from({length:n-1},(_,i)=>segment[i+1].x-segment[i].x);
      const d=h.map((dx,i)=>(segment[i+1].y-segment[i].y)/dx);
      const m=Array(n).fill(0);m[0]=d[0];m[n-1]=d[n-2];
      for(let i=1;i<n-1;i++){
        if(d[i-1]*d[i]>0){const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];m[i]=(a+b)/(a/d[i-1]+b/d[i])}
      }
      const samples=[];
      for(let i=0;i<n-1;i++)for(let k=0;k<=20;k++){
        const t=k/20, dx=h[i],a=segment[i],b=segment[i+1];
        const y=(2*t*t*t-3*t*t+1)*a.y+(t*t*t-2*t*t+t)*dx*m[i]
          +(-2*t*t*t+3*t*t)*b.y+(t*t*t-t*t)*dx*m[i+1];
        samples.push([a.x+t*dx,Math.max(0,y)]);
      }
      return samples;
    }
    for(const seg of segments)if(seg.length>1)stroke(interpolatePropeller(seg),cls.prop,4.1);
    // Green dashed tails: VISUAL CUBIC REFERENCE ONLY, not source-calculated speeds.
    // P(n) = P_anchor * (n / n_anchor)^3, anchored to the nearest real point.
    const plotGuide=(from,to,anchor)=>{
      if(!(to>from&&anchor.x>0&&anchor.y>=0))return;
      const samples=[];
      for(let j=0;j<=60;j++){const x=from+(to-from)*j/60;samples.push([x,anchor.y*Math.pow(x/anchor.x,3)])}
      stroke(samples,cls.prop,2.6,[7,5]);
    };
    const first=segments[0]?.[0],lastSeries=segments.at(-1),last=lastSeries?.at(-1);
    if(first&&first.x>0)plotGuide(0,first.x,first);
    if(last&&last.x>0){
      const right=Math.min(xmax,Math.max(last.x*1.10,rating?.rpm||0));
      if(right>last.x+2)plotGuide(last.x,right,last);
    }
    if(ordered.length>=2){
      const mark=ordered[0];
      const px=X(mark.engineRpm),py=Y(propOf(mark));
      ctx.font='bold 10px Arial,sans-serif';ctx.textAlign='left';ctx.fillStyle=cls.prop;
      ctx.fillText('ACTUAL PROPELLER CURVE',Math.max(m.l+15,Math.min(w-180,px+12)),Math.max(m.t+14,py-22));
    }
    // Rated point is displayed even for an engine with no sourced part-load envelope.
    if(rating){
       ctx.strokeStyle='#8097b1';ctx.setLineDash([4,5]);ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(X(rating.rpm),m.t);ctx.lineTo(X(rating.rpm),m.t+H);ctx.stroke();ctx.setLineDash([]);
       ctx.fillStyle=cls.engine;ctx.fillRect(X(rating.rpm)-4.7,Y(rating.kw)-4.7,9.4,9.4);
       ctx.font='bold 11px Arial,sans-serif';ctx.fillStyle=cls.engine;ctx.textAlign=X(rating.rpm)>w-105?'right':'left';
       ctx.fillText('Rated',X(rating.rpm)+(ctx.textAlign==='left'?8:-8),Math.max(20,Y(rating.kw)-12));
    }
    ordered.forEach((p)=>{
      const px=X(p.engineRpm),py=Y(propOf(p));
      if(p.isDesign&&para>0){ctx.strokeStyle=cls.op;ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,Y(brakeOf(p)));ctx.stroke();ctx.setLineDash([]);
        ctx.beginPath();ctx.arc(px,Y(brakeOf(p)),5,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle=cls.op;ctx.stroke();}
      ctx.beginPath();ctx.arc(px,py,p.isDesign?6.3:4.4,0,Math.PI*2);ctx.fillStyle=p.isDesign?cls.op:cls.prop;ctx.fill();ctx.lineWidth=1.3;ctx.strokeStyle='#ffffff';ctx.stroke();
      if(p.isDesign){
         ctx.font='bold 11px Arial,sans-serif';ctx.fillStyle=cls.op;ctx.textAlign=px>w-110?'right':'left';
         ctx.fillText('Operating · '+igFmt(p.engineRpm,0)+' rpm · '+igFmt(p.perEngineKW,0)+' kW',px+(ctx.textAlign==='left'?10:-10),Math.max(m.t+12,py-14));
      }
    });
    // Side details table, directly based on the same four-point data as the existing table and gearbox solver.
    const sweep=igLast?.sweep||[],cells=[0,1,2,3].map(i=>sweep.find(p=>p.index===i)||{});
    const tcell=(values,precision=1,unit='')=>values.map((v,i)=>`<td class="${i===2?'ig-pe-op':''}">${Number.isFinite(v)?igFmt(v,precision)+unit:'—'}</td>`).join('');
    if(panel){
       const speed=cells.map(p=>p.v),rpms=cells.map(p=>p.engineRpm),prpms=cells.map(p=>p.propRpm),
         drive=cells.map(p=>Number.isFinite(p.perEngineKW)?propOf(p):null),brake=cells.map(p=>p.perEngineKW),
         refP=cells.map(p=>Number.isFinite(p.engineRpm)&&refPoints.length>=2?igInterpolate(p.engineRpm,refPoints,'rpm','kw'):null),
         limits=cells.map(p=>{if(!hasCurve||!Number.isFinite(p.engineRpm))return null;const avail=igInterpolate(p.engineRpm,env,'rpm','kw');return Number.isFinite(avail)?Math.max(0,avail-para):null;}),
         load=cells.map(p=>rating&&Number.isFinite(p.perEngineKW)?p.perEngineKW/rating.kw*100:null),
         checks=cells.map(p=>igSweepCheck(p,row));
       const status=checks.map((x,i)=>{let t=x==='Within published OEM M curve'?'SCREEN':x.startsWith('Within preliminary M')?'PRELIM':x.startsWith('REFERENCE ONLY')?'RESTRICTED':x==='Nominal-only · off-rating unverified'?'UNVERIFIED':x==='No matching engine'?'—':'LIMIT';return `<td class="${i===2?'ig-pe-op ':''}${t==='SCREEN'?'ig-pe-pass':t==='LIMIT'?'ig-pe-fail':''}">${t}</td>`}).join('');
       panel.innerHTML=`<tr><th>Ship speed (kn)</th>${tcell(speed,1)}</tr><tr><th>RT (kN)</th>${tcell(cells.map(p=>Number.isFinite(p.rt)?p.rt/1000:null),2)}</tr><tr><th>Engine RPM</th>${tcell(rpms,0)}</tr><tr><th>Propeller RPM</th>${tcell(prpms,0)}</tr><tr><th>Actual propeller curve (kW)</th>${tcell(drive,1)}</tr><tr><th>Engine reference propeller curve (kW)</th>${tcell(refP,1)}</tr><tr><th>Brake demand (kW)</th>${tcell(brake,1)}</tr><tr><th>${row?.archiveNumeric?'Archived M minus parasitic (kW)':row?.preliminaryEnvelope?'Digitized M minus parasitic (kW)':'Published M minus parasitic (kW)'}</th>${tcell(limits,1)}</tr><tr><th>Engine load (% MCR)</th>${tcell(load,1)}</tr><tr><th>Continuous check</th>${status}</tr>`;
    }
    const source=igF('pe-detail-source');
    if(source)source.textContent=igCurveLabel(row)+' · '+(engineProp?'Reference P on file':'FPP reference P unavailable');
    const stat=igF('pe-plot-status');
    if(stat)stat.textContent='Green: ARUS propeller (when calculated). Blue: '+igCurveLabel(row)+'. Purple: reference P when applicable. Numeric/chart source status does not imply OEM approval.';
    const legend=igF('results')?.querySelector('.ig-performance-chart > .ig-epm-legend');
    if(legend){
      const labels=legend.querySelectorAll('.ig-leg');
      if(labels[0]?.lastChild)labels[0].lastChild.textContent=hasCurve?' M curve · '+(row?.sourceEnvelope?'OEM conditional':row?.restrictedCurve?'restricted':row?.legacyNumeric?'numeric unverified':'preliminary'):' M curve unavailable';
      if(labels[2]?.lastChild)labels[2].lastChild.textContent=refPoints.length>=2?(engineProp?.digitized?' Reference P · preliminary':' OEM reference P'):' Reference P unavailable';
    }
    const note=igF('plot-note');
    if(note){
      note.textContent=igCurveCaution(row);
      if(engineProp)note.textContent+=' Reference P: '+engineProp.type+'; '+(engineProp.cubic?'reference cubic curve':'tabulated reference')+'.';
      if(row?.previewOnly)note.textContent='ENGINE PREVIEW · NOT MATCHED. '+note.textContent+' Calculated demand is not engine-governor equilibrium.';
      if(!igLast)note.textContent='ENGINE CATALOG ONLY · NOT MATCHED. '+note.textContent+' No four-point propeller load or operating point available.';
    }
    const over=igF('overload-notice');
    if(over)over.textContent=row?.sourceEnvelope?'OEM conditional M screening only; overload allowance and duty approval require OEM evidence.':
      'Reference M curve shown for inspection/preliminary comparison. No overload area or continuous-duty approval is asserted.';
  }
    function igRenderMatchingAudit(row){
    const div=igF('match-audit');if(!div)return;
    if(!row){div.innerHTML='<div class="ig-audit-cell"><small>Matching status</small><strong>NO MATCH</strong><span>No candidate satisfies the current four-point power/RPM screen.</span></div>';return;}
    const values=igLast.sweep||[],margin=Number.isFinite(row.reserve)?row.reserve*100:null;
    const pcurve=igReferencePropellerCurveFor(row.r.id);
    const rpm=row.operationalRPM,ref=pcurve?igInterpolate(rpm,pcurve.points,'rpm','kw'):null;
    const design=values.find(x=>x.isDesign),net=design?.perEngineKW-igNumber('parasitic');
    const delta=Number.isFinite(ref)&&ref>0&&Number.isFinite(net)?100*(net-ref)/ref:null;
    const capacity=row.previewOnly?'CATALOG PREVIEW · NOT MATCHED':igCurveLabel(row);
    const top=values.at(-1),speedStatus=row.sourceEnvelope?'≥ '+igFmt(top.v,1)+' kn (within sampled range)':'Not verified';
    const tEng=Number.isFinite(rpm)&&rpm>0?9550*design?.perEngineKW/rpm/1000:null;
    const fields=[
      ['M-curve provenance',capacity,igCurveCaution(row)],
      ['Matching status',row.matchStatus,row.previewOnly?'Unmatched catalog comparison; four-point engine suitability NOT established':igCurveCaution(row)],
      ['OEM duty',row.dutyEvidence?.status||'NOT VERIFIED',row.dutyEvidence?.reason||'Duty limitations unavailable'],
      ['Gearbox catalog',row.gearGate,row.gearEvidence?.label||'Missing gearbox evidence'],
      ['Published RPM range',row.rpmGate,Number.isFinite(row.r.publishedRpmMin)?`${igFmt(row.r.publishedRpmMin,0)}–${igFmt(row.r.publishedRpmMax||row.r.rpm,0)} rpm`:'Minimum permissible engine RPM not documented'],
      ['Minimum net power reserve',row.curveEnvelope&&Number.isFinite(margin)?igFmt(margin,1)+' %':'—',row.sourceEnvelope?'Conditional OEM reference margin; duty approval pending':igCurveCaution(row)],
      ['Maximum checked speed',speedStatus,'Not a solved vessel Vmax or governor equilibrium'],
      ['Actual vs reference P',Number.isFinite(delta)?(delta>0?'+':'')+igFmt(delta,1)+' %':'—',Number.isFinite(delta)?'Power deviation at design engine RPM; not a matching limit':'No OEM reference P value at design RPM'],
      ['Operating torque demand',igFmt(tEng,2)+' kN·m','Engine crankshaft-equivalent at calculated brake power'],
      ['Four-point KT residual',igFmt(Math.max(...values.map(p=>p.ktResidual)),6),'Maximum absolute KT − KTship residual'],
      ['Cavitation',igCavMode()==='none'?'INTEGRATION SCREENING OFF':(values.every(x=>x.cav?.pass)?'4 / 4 SCREENED':'CHECK'),igCavLabel()+'; preliminary only']
    ];
    div.innerHTML=fields.map(([a,b,c])=>`<div class="ig-audit-cell"><small>${igEsc(a)}</small><strong>${igEsc(b)}</strong><span>${igEsc(c)}</span></div>`).join('');
  }
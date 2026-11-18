'use strict';
(() => {
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const FAMILIES=['B-Series','AU','AU CPP','BB-Series','Gawn','Kaplan','SK','Modified Gawn','Modified Kaplan','Thruster','Modified Thruster','Modified Wedge','MAU','MAUw'];
const PITCH=['Constant / Full','80% hub reduction','High performance','DTMB 4119 (legacy)','P1727M','Linear root-tip','Parabola at 0.7R','Tip unloading','Root unloading','DTMB 4383 decreasing','P4902 increasing','IHI P4 plateau'];
const RAKE=['Linear angle','Zero rake','Linear root-tip','Quadratic root-tip','Cubic root-tip','Quadratic tip bend','Smoothstep tip bend','Seiun Maru HSP','NRC Soft','NRC Hard','Kappel','NRC Moderate','IHI'];
const DEFAULT_CFG={0:1000,1:.55,2:1,3:0,4:15,5:1,6:1,7:50,8:4,9:0,10:0,11:0,12:0,13:0,14:0,15:0,16:0,17:0,18:0};
const DEFAULT_MOD={0:0,1:.0153,2:.5,3:.7,4:0,5:1,6:0,7:.5,8:.85,9:0,10:1,11:0,12:.6,13:.8,14:.95,15:1,16:0,17:.05,18:.7,19:.8,20:.9,21:1,22:1,23:0,24:0};
const storageKey='pg_studio_android_projects_v1';
const state={cfg:{...DEFAULT_CFG},mod:{...DEFAULT_MOD},additions:[],removals:[],overrides:[],tab:'3d',outline:'expanded',full:true,smooth:true,wire:false,station:5,dirty:false};

/* v146: Viewer-only rigid 180-degree orientation about world Y. Source C/WASM
   geometry, manual station data and CAD exports are deliberately unchanged.
   As a proper rotation (det=+1), this reverses the model's -X facing to +X
   without reflecting blade handedness. Camera, ViewCube and XYZ remain in
   the same world coordinate convention: BACK=+X. */
window.__arusPlusXDisplay = Object.freeze({
  direction:[1,0,0],
  point(x,y,z){return [-x,y,-z]},
  mesh(input){
    if(!input || !input.length)return input;
    const transformed=new Float32Array(input.length);
    for(let i=0;i<input.length;i+=3){
      transformed[i]=-input[i];
      transformed[i+1]=input[i+1];
      transformed[i+2]=-input[i+2];
    }
    return transformed;
  }
});

let kernel,renderer,drawPositions=new Float32Array(0),displayPositions=new Float32Array(0),timer,successful=false;
let undoStack=[],redoStack=[],quadRenderers=[],quadMode=false; const layers={surface:true,axes:true,sections:false,guides:true,thickness:false,skew:false};
const fmt=(x,n=4)=>Number.isFinite(x)?Number(x).toFixed(n):'—';
const error=s=>{$('#status').textContent=s;$('#status').classList.add('error');};
const okay=s=>{$('#status').textContent=s;$('#status').classList.remove('error');};
function optionList(selector,arr){let sel=$(selector);if(!sel)return;sel.innerHTML=arr.map((v,i)=>`<option value="${i}">${v}</option>`).join('');}
function fillOptions(){optionList('#preset',FAMILIES);optionList('#pitchSelect',PITCH);optionList('#rakeSelect',RAKE);
  $$('.family-choice').forEach(sel=>sel.innerHTML=FAMILIES.map((v,i)=>`<option value="${i}">${v}</option>`).join(''));
  $$('.skew-choice').forEach(sel=>sel.innerHTML=FAMILIES.concat(['Zero skew','Linear skew','Quadratic skew','Cubic skew','Cleaver edge']).map((v,i)=>`<option value="${i}">${v}</option>`).join(''));
  $$('.section-choice').forEach(sel=>sel.innerHTML=FAMILIES.concat(['NACA 66-006 base','NACA 16-006 base']).map((v,i)=>`<option value="${i}">${v}</option>`).join(''));
}
function readForm(){
  $$('[data-cfg]').forEach(el=>{const n=Number(el.value);if(el.value!==''&&Number.isFinite(n))state.cfg[el.dataset.cfg]=n;});
  $$('[data-mod]').forEach(el=>{const n=Number(el.value);if(el.value!==''&&Number.isFinite(n))state.mod[el.dataset.mod]=n;});
}
function applyForm(){
  $$('[data-cfg]').forEach(el=>el.value=state.cfg[el.dataset.cfg]);
  $$('[data-mod]').forEach(el=>el.value=state.mod[el.dataset.mod]);
  $('#titleDesign').innerHTML=`${FAMILIES[state.cfg[9]]||'UNKNOWN'} <em>•</em> ${state.cfg[8]} BLADES`;
  $('#glanceBlades').textContent=state.cfg[8];
  updateDisabled();
}
function updateDisabled(){let custom=Number(state.cfg[10])===1;$$('#customPanel [data-cfg],#customPanel [data-mod]').forEach(el=>el.disabled=!custom);}
function schedule(){clearTimeout(timer);timer=setTimeout(recalculate,300);}
function restoreKernelFromState(){kernel.reset();for(let [k,v] of Object.entries(state.cfg))kernel.cfg(Number(k),v);for(let [k,v] of Object.entries(state.mod))kernel.mod(Number(k),v);
  // First reconstruct the radial grid, then replay manual overrides by station coordinate.
  const additions=[...state.additions].sort((a,b)=>a-b);
  for(const rr of additions){let ix=kernel.insert(rr);if(ix<0)throw Error(`Unable to insert r/R=${rr}`);}
  for(const rr of [...state.removals].sort((a,b)=>b-a)){
    if(kernel.generate(false,false)<=0)throw Error(`Invalid geometry when removing r/R=${rr}`);
    let idx=-1;for(let i=0;i<kernel.rows();i++)if(Math.abs(kernel.station(i,0)-rr)<1e-7){idx=i;break;}
    if(idx<0||!kernel.remove(idx))throw Error(`Unable to remove reference r/R=${rr}`);
  }
  if(kernel.generate(false,false)<=0)throw Error('Settings or section geometry are outside the reference domain.');
  for(const e of state.overrides){let index=-1,min=1e100;for(let i=0;i<kernel.rows();i++){let diff=Math.abs(kernel.station(i,0)-e.rr);if(diff<min){min=diff;index=i;}}
    if(index<0||min>1e-5||!kernel.setStation(index,e.col,e.value))throw Error(`Invalid manual station at r/R=${e.rr}`);
  }
}
// v145: Watch for a renderer that becomes blank AFTER the initial geometry upload.
// It uses the original mesh with the original camera; only the presentation
// backend is changed if two consecutive GPU frames cannot be read as visible.
// The per-draw check is throttled to avoid readback during every pointer event.
let arusGpuMissingFrames=0;
let arusLastGpuProbe=0;
let arusGpuRecovering=false;
function arusMonitorGpuFrame(view){
  if(arusGpuRecovering || !view?.gl || !renderer || renderer!==view || !view.vertices)return;
  const now=performance.now();
  if(now-arusLastGpuProbe < 1100)return;
  arusLastGpuProbe=now;
  if(arusGpuHasVisibleMesh(view)){
    arusGpuMissingFrames=0;
    view.canvas.dataset.arusRenderer='webgl-visible';
    return;
  }
  if(++arusGpuMissingFrames < 2)return;
  arusGpuMissingFrames=0;
  arusGpuRecovering=true;
  try{arusRestoreVisiblePropeller('blank-webgl-after-orbit');}
  finally{arusGpuRecovering=false;}
}
window.__arusMonitorGpuFrame=arusMonitorGpuFrame;
// v144: WebGL can initialize but draw no mesh on some browser/driver paths.
// Check the framebuffer immediately after the draw, while its contents are valid.
// Only if the original C/WASM mesh is invisible, keep the same camera and
// switch the presentation backend to the existing Canvas 2D renderer.
function arusGpuHasVisibleMesh(view){
  if(!view?.gl||!view.vertices)return false;
  const gl=view.gl,c=view.canvas;
  if(gl.isContextLost?.())return false;
  try{
    const x=Math.floor(c.width*.20),y=Math.floor(c.height*.20);
    const w=Math.max(8,Math.floor(c.width*.60)),h=Math.max(8,Math.floor(c.height*.60));
    const pixel=new Uint8Array(w*h*4);
    gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    if(gl.getError()!==gl.NO_ERROR)return false;
    let opaque=0;
    // Count coarse samples first, then use an entire alpha channel scan if needed.
    for(let i=3;i<pixel.length;i+=Math.max(4,Math.floor(pixel.length/2500/4)*4)){
      if(pixel[i]>32&&++opaque>=4)return true;
    }
    for(let i=3;i<pixel.length;i+=4){if(pixel[i]>32&&++opaque>=4)return true;}
    return false;
  }catch(_){return false;}
}
function arusRestoreVisiblePropeller(reason){
  if(!renderer?.gl||!drawPositions?.length)return false;
  const old=renderer, oldCanvas=old.canvas;
  // A canvas cannot switch its context from WebGL to 2D. Replace ONLY the
  // drawing canvas, preserving the overlay and all ViewCube/XYZ DOM elements.
  const canvas=oldCanvas.cloneNode(false);
  oldCanvas.replaceWith(canvas);
  try{
    const replacement=new PGCanvasFallback(canvas);
    for(const field of ['yaw','pitch','roll','zoom','diameter','color','customColor','finish','surfaces','wire']){
      if(old[field]!==undefined)replacement[field]=old[field];
    }
    // Preserve the display mesh if visual-only smoothing was active.
    replacement.upload(old.displayPositions||displayPositions);
    replacement.canvas.__arusViewer=replacement;
    canvas.dataset.arusRenderer='canvas2d-recovery';
    canvas.dataset.arusRecoveryReason=String(reason||'gpu-frame-invalid');
    renderer=replacement;
    $('#canvasError').hidden=true;
    $('#qualityLabel').textContent='CANVAS 2D · C/WASM';
    paintLayerOverlay();
    window.dispatchEvent(new Event('arus-cad-camera-rendered'));
    return true;
  }catch(e){
    // Restore the original canvas on unexpected initialization errors.
    canvas.replaceWith(oldCanvas);
    renderer=old;
    $('#canvasError').hidden=false;
    $('#canvasError').textContent='Cannot display propeller: '+String(e?.message||e);
    return false;
  }
}
function arusCheckFirstGpuFrame(){
  if(!renderer?.gl)return;
  arusGpuMissingFrames=0;
  if(arusGpuHasVisibleMesh(renderer)){
    renderer.canvas.dataset.arusRenderer='webgl-visible';
    return;
  }
  arusRestoreVisiblePropeller('blank-webgl-frame');
}
function recalculate(){if(!kernel)return;
  try{
    readForm();applyForm();restoreKernelFromState();
    const n=kernel.generate(state.smooth,state.full);
    if(n<=0)throw Error(`Geometry failed (code ${n}); check diameter, pitch, section source, station edits or surface constraints.`);
    successful=true;$('#earActual').textContent=fmt(kernel.metric(0),6);$('#pdActual').textContent=fmt(kernel.metric(1),5);$('#stationsActual').textContent=kernel.rows();$('#meshInfo').textContent=`${n.toLocaleString('en-US')} TRIANGLES`; 
    $('#stationBadge').textContent=`${kernel.rows()} ROWS`;
    $('#titleDesign').innerHTML=`${FAMILIES[state.cfg[9]]||'UNKNOWN'} <em>•</em> ${state.cfg[8]} BLADES`;
    $('#qualityLabel').textContent=(renderer?.fallback?'CANVAS 2D · ':'C/WASM · ')+(state.smooth?'SMOOTH':'STANDARD30');
    drawPositions=kernel.positions();
    displayPositions=window.__arusPlusXDisplay.mesh(drawPositions);
    if(renderer){renderer.diameter=state.cfg[0];renderer.upload(displayPositions,{smooth:state.smooth,stations:Array.from({length:kernel.rows()},(_,i)=>kernel.station(i,0)),diameter:state.cfg[0]});renderer.canvas.dataset.arusPropellerFacing='+X';arusCheckFirstGpuFrame();}if(quadMode)refreshQuadViews();
    paintCharts();refreshStations();paintLayerOverlay();okay('GEOMETRY VALID · Windows 0.7.2 UI · C/WASM 0.6.0 · Offline');
  }catch(e){error(e.message||String(e));}
}
function refreshStations(){let rows=kernel.rows(),select=$('#stationChoose');if(!rows)return;
  state.station=Math.max(0,Math.min(rows-1,state.station));select.innerHTML=Array.from({length:rows},(_,i)=>`<option value="${i}">${fmt(kernel.station(i,0),4)} r/R</option>`).join('');select.value=state.station;
  let tbody=$('#stationTable tbody');tbody.innerHTML=Array.from({length:rows},(_,i)=>{
    let col=[0,1,2,3,4,5,6,7,8];let row=col.map((j,k)=>fmt(kernel.station(i,j),k===0?5:2));return `<tr data-station="${i}" class="${i===state.station?'active':''}">${row.map((v,k)=>`<td data-col="${col[k]}">${v}</td>`).join('')}</tr>`;
  }).join('');$$('#stationTable tbody tr').forEach(tr=>tr.addEventListener('click',()=>{state.station=Number(tr.dataset.station);refreshStations();paintCharts();}));
  updateStationValue();const row=kernel.station(state.station,0),root=kernel.station(0,0);$('#newRR').value=fmt(Math.max(root+0.00001,row-.05),5);$('#newRR').min='0.10';
}
function updateStationValue(){if(!successful)return;$('#stationValue').value=fmt(kernel.station(state.station,Number($('#editField').value)),6);}
function resizePlot(){let canvas=$('#plotCanvas'),rect=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.floor(rect.width*d));canvas.height=Math.max(1,Math.floor(rect.height*d));}
function plot(points,label,ctx,W,H,bounds){if(points.length<2)return;let margin={L:60,T:40,R:24,B:40};let xlo=bounds?.[0]??Math.min(...points.map(p=>p[0])),xhi=bounds?.[1]??Math.max(...points.map(p=>p[0]));let ylo=bounds?.[2]??Math.min(...points.map(p=>p[1])),yhi=bounds?.[3]??Math.max(...points.map(p=>p[1]));let spanx=Math.max(1e-8,xhi-xlo),spany=Math.max(1e-8,yhi-ylo);
  let areaW=W-margin.L-margin.R,areaH=H-margin.T-margin.B;if(areaW<=0||areaH<=0)return;
  let xx=v=>margin.L+(v-xlo)/spanx*areaW,yy=v=>H-margin.B-(v-ylo)/spany*areaH;
  ctx.save();ctx.strokeStyle='#dce6ec';ctx.lineWidth=1;ctx.fillStyle='#8ea0ad';ctx.font='11px Arial';ctx.textBaseline='alphabetic';
  for(let i=0;i<=4;i++){let x=xlo+spanx*i/4,y=ylo+spany*i/4,px=xx(x),py=yy(y);ctx.beginPath();ctx.moveTo(px,margin.T);ctx.lineTo(px,H-margin.B);ctx.stroke();ctx.beginPath();ctx.moveTo(margin.L,py);ctx.lineTo(W-margin.R,py);ctx.stroke();ctx.textAlign=i===0?'left':i===4?'right':'center';ctx.fillText(x.toFixed(2),px,H-margin.B+18);ctx.textAlign='right';ctx.fillText(y.toFixed(Math.abs(y)<10?3:1),margin.L-10,py+4);}
  ctx.lineWidth=2.4;ctx.strokeStyle='#007f97';ctx.beginPath();points.forEach((p,i)=>{if(!i)ctx.moveTo(xx(p[0]),yy(p[1]));else ctx.lineTo(xx(p[0]),yy(p[1]));});ctx.stroke();
  ctx.fillStyle='#213b4b';ctx.font='600 12px Arial';ctx.textAlign='left';ctx.fillText(label,margin.L,19);ctx.restore();
}
function paintCharts(){if(state.tab==='3d'||state.tab==='editor'||!successful)return;resizePlot();let canvas=$('#plotCanvas'),ctx=canvas.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2),W=canvas.width/dpr,H=canvas.height/dpr,n=kernel.rows();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#eaf1f5';ctx.fillRect(0,0,W,H);
  if(state.tab==='outline'){
    let kind=state.outline,LE=[],TE=[];
    for(let i=0;i<n;i++){
      let rr=kernel.station(i,0),C=kernel.station(i,1),sk=kernel.station(i,4),P=kernel.station(i,5),r=rr*state.cfg[0]/2;
      let start=sk-C/2,end=sk+C/2;
      if(kind==='developed'){let beta=Math.atan(P/(2*Math.PI*r));start*=Math.cos(beta);end*=Math.cos(beta);}
      if(kind==='projected'){
        let beta=Math.atan(P/(2*Math.PI*r));start=r*Math.sin(start*Math.cos(beta)/r);end=r*Math.sin(end*Math.cos(beta)/r);
      }
      LE.push([start,r]);TE.push([end,r]);
    }
    let all=LE.concat(TE);let xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),minx=Math.min(...xs),maxx=Math.max(...xs),maxy=Math.max(...ys),margin={L:48,T:35,R:20,B:38};let sw=W-margin.L-margin.R,sh=H-margin.T-margin.B,spanx=Math.max(1,maxx-minx),spany=Math.max(1,maxy-Math.min(...ys));let k=Math.min(sw/spanx,sh/spany)*.82,cx=W/2-(minx+maxx)/2*k,cy=H/2+(Math.min(...ys)+maxy)/2*k;
    ctx.fillStyle='rgba(2,128,150,.12)';ctx.strokeStyle='#007f97';ctx.lineWidth=2.5;ctx.beginPath();LE.forEach((p,i)=>i?ctx.lineTo(cx+p[0]*k,cy-p[1]*k):ctx.moveTo(cx+p[0]*k,cy-p[1]*k));TE.slice().reverse().forEach(p=>ctx.lineTo(cx+p[0]*k,cy-p[1]*k));ctx.closePath();ctx.fill();ctx.stroke();
    if(layers.guides){ctx.strokeStyle='#80a2ae';ctx.lineWidth=1;for(let i=0;i<n;i++){ctx.beginPath();ctx.moveTo(cx+LE[i][0]*k,cy-LE[i][1]*k);ctx.lineTo(cx+TE[i][0]*k,cy-TE[i][1]*k);ctx.stroke();}}if(layers.skew){ctx.strokeStyle='#eb8f20';ctx.lineWidth=1.8;ctx.beginPath();for(let i=0;i<n;i++){let x=(LE[i][0]+TE[i][0])/2,y=LE[i][1];i?ctx.lineTo(cx+x*k,cy-y*k):ctx.moveTo(cx+x*k,cy-y*k);}ctx.stroke();}if(layers.thickness){ctx.strokeStyle='#b0476b';ctx.lineWidth=1.8;ctx.beginPath();for(let i=0;i<n;i++){let x=LE[i][0]+(TE[i][0]-LE[i][0])*.35,y=LE[i][1];i?ctx.lineTo(cx+x*k,cy-y*k):ctx.moveTo(cx+x*k,cy-y*k);}ctx.stroke();}ctx.fillStyle='#28475a';ctx.font='bold 13px Arial';ctx.fillText(kind.toUpperCase()+' / BLADE OUTLINE',22,22);
  }else if(state.tab==='sections'){
    let i=state.station,back=[],face=[];for(let j=0;j<30;j++){back.push([kernel.offset(0,i,j,0),kernel.offset(0,i,j,1)]);face.push([kernel.offset(1,i,j,0),kernel.offset(1,i,j,1)]);}
    let all=back.concat(face),minx=Math.min(...all.map(p=>p[0])),maxx=Math.max(...all.map(p=>p[0])),miny=Math.min(...all.map(p=>p[1])),maxy=Math.max(...all.map(p=>p[1]));let padX=Math.max(1,(maxx-minx)*.08),padY=Math.max(.5,(maxy-miny)*.28),b=[minx-padX,maxx+padX,miny-padY,maxy+padY];plot(back,`BACK / FACE · r/R ${fmt(kernel.station(i,0),4)}`,ctx,W,H,b);
    let L=60,T=40,R=24,B=40,X=x=>L+(x-b[0])/(b[1]-b[0])*(W-L-R),Y=y=>H-B-(y-b[2])/(b[3]-b[2])*(H-T-B);
    ctx.beginPath();face.forEach((p,j)=>j?ctx.lineTo(X(p[0]),Y(p[1])):ctx.moveTo(X(p[0]),Y(p[1])));ctx.strokeStyle='#d08455';ctx.lineWidth=2.3;ctx.stroke();
  }else if(state.tab==='radial'){
    // True native C/WASM results: radial pitch and rake, each normalised by current propeller D.
    // One plot with independent left/right scales; no synthetic distributions or fitted geometry.
    const pitch=[],rake=[];
    for(let i=0;i<n;i++){
      const rr=kernel.station(i,0),D=state.cfg[0];
      pitch.push([rr,kernel.station(i,5)/D]);
      rake.push([rr,kernel.station(i,7)/D]);
    }
    const P={left:63,right:64,top:50,bottom:50}, pw=W-P.left-P.right,ph=H-P.top-P.bottom;
    if(pw>10&&ph>10&&pitch.length>=2){
      const xs=pitch.map(a=>a[0]),pvals=pitch.map(a=>a[1]),rvals=rake.map(a=>a[1]);
      const xmin=Math.min(...xs),xmax=Math.max(...xs),pmin=Math.min(...pvals),pmax=Math.max(...pvals),rmin=Math.min(...rvals),rmax=Math.max(...rvals);
      const range=(lo,hi)=>{const padding=Math.max((hi-lo)*.12,Math.max(Math.abs(lo),Math.abs(hi),.01)*.06);return [lo-padding,hi+padding];};
      const [pl,pu]=range(pmin,pmax),[rl,ru]=range(rmin,rmax);
      const xx=v=>P.left+(v-xmin)/Math.max(1e-12,xmax-xmin)*pw;
      const yp=v=>P.top+ph-(v-pl)/(pu-pl)*ph;
      const yr=v=>P.top+ph-(v-rl)/(ru-rl)*ph;
      ctx.fillStyle='#f8fbfc';ctx.fillRect(0,0,W,H);ctx.font='11px Arial';ctx.lineWidth=1;
      for(let j=0;j<=5;j++){
        const y=P.top+j/5*ph;
        ctx.strokeStyle='#e1eaf0';ctx.beginPath();ctx.moveTo(P.left,y);ctx.lineTo(W-P.right,y);ctx.stroke();
        ctx.fillStyle='#678296';ctx.fillText((pu-(pu-pl)*j/5).toFixed(3),7,y+4);
        ctx.fillText((ru-(ru-rl)*j/5).toFixed(3),W-P.right+7,y+4);
      }
      for(let j=0;j<=5;j++){
        const x=P.left+j/5*pw,v=xmin+(xmax-xmin)*j/5;
        ctx.strokeStyle='#eff2f5';ctx.beginPath();ctx.moveTo(x,P.top);ctx.lineTo(x,H-P.bottom);ctx.stroke();
        ctx.fillStyle='#678296';ctx.fillText(v.toFixed(2),x-11,H-P.bottom+19);
      }
      const trace=(pts,yy,color)=>{
        ctx.beginPath();pts.forEach(([x,v],i)=>i?ctx.lineTo(xx(x),yy(v)):ctx.moveTo(xx(x),yy(v)));
        ctx.strokeStyle=color;ctx.lineWidth=2.6;ctx.stroke();
        ctx.fillStyle=color;for(const [x,v] of pts){ctx.beginPath();ctx.arc(xx(x),yy(v),2.3,0,Math.PI*2);ctx.fill();}
      };
      trace(pitch,yp,'#008b98');trace(rake,yr,'#cb7c31');
      ctx.font='bold 12px Arial';ctx.fillStyle='#28475a';ctx.fillText('PITCH DISTRIBUTION  /  RAKE',P.left,23);
      ctx.font='11px Arial';ctx.fillStyle='#008b98';ctx.fillRect(W-230,15,19,3);ctx.fillText('Pitch / D',W-204,20);
      ctx.fillStyle='#cb7c31';ctx.fillRect(W-125,15,19,3);ctx.fillText('Rake / D',W-100,20);
      ctx.fillStyle='#678296';ctx.fillText('r / R',W/2-9,H-10);
      ctx.save();ctx.translate(16,H/2+15);ctx.rotate(-Math.PI/2);ctx.fillText('Pitch / D',0,0);ctx.restore();
      ctx.save();ctx.translate(W-9,H/2-18);ctx.rotate(Math.PI/2);ctx.fillText('Rake / D',0,0);ctx.restore();
    }
  }
}
function showTab(tab){
  state.tab=tab;
  if(tab!=='3d'&&quadMode)toggleFourViews(false);
  $$('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  $('#stationCard').hidden=tab!=='editor';
  $('#canvasContainer').classList.toggle('editor-mode',tab==='editor');
  $('#glCanvas').hidden=tab!=='3d';$('#layerCanvas').hidden=tab!=='3d';
  $('#plotCanvas').hidden=tab==='3d'||tab==='editor';
  $('#outlineKind').hidden=tab!=='outline';
  $('#viewHint').textContent=tab==='3d'?'Drag to orbit · model follows both mouse directions · Shift or right-drag: roll · wheel: zoom':tab==='sections'?'Select a radial station to inspect its section':tab==='outline'?'Expanded / developed / projected blade outline':'Calculated pitch and rake distribution';
  const titles={"3d":"Propeller assembly",outline:"Blade outline",sections:"Propeller section",radial:"Pitch / Rake",editor:"Radial station data editor"};
  $('#drawingTitle').textContent=titles[tab]||'Propeller assembly';
  if(tab==='3d')requestAnimationFrame(()=>{renderer?.draw();paintLayerOverlay();});
  else if(tab!=='editor')requestAnimationFrame(paintCharts);
}
function makeProject(){return {format:'PGANDROID1',kernel:'Windows Geometry v0.6.0',name:$('#projectName').value.trim()||'Untitled',cfg:state.cfg,mod:state.mod,additions:state.additions,removals:state.removals,overrides:state.overrides,view:{material:$('#material').value,full:state.full,smooth:state.smooth},savedAt:new Date().toISOString()};}
function loadProject(p){if(!p||p.format!=='PGANDROID1'||!p.cfg||!p.mod||!Array.isArray(p.overrides)||!Array.isArray(p.additions))throw Error('Unsupported project file. Expected PGANDROID1.');
  Object.assign(state.cfg,DEFAULT_CFG,p.cfg);Object.assign(state.mod,DEFAULT_MOD,p.mod);state.additions=p.additions;state.removals=Array.isArray(p.removals)?p.removals:[];state.overrides=p.overrides;
  if(p.view){state.full=p.view.full!==false;state.smooth=p.view.smooth!==false;$('#material').value=({steel:'polishedsteel',naval:'arusblue',bronze:'aluminium'}[p.view.material]||p.view.material||'polishedsteel');}
  $('#projectName').value=p.name||'Imported project';state.station=5;updateButtons();applyForm();recalculate();
}
function download(blob,name){let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},6000);}
function copyText(value){
  try{if(window.AndroidBridge&&typeof AndroidBridge.copy==='function'){AndroidBridge.copy(value);return true;}}catch(e){}
  let box=document.createElement('textarea');box.value=value;box.style.position='fixed';box.style.top='-1000px';document.body.appendChild(box);box.select();let worked=false;try{worked=document.execCommand('copy');}catch(e){}box.remove();return worked;
}
function exportGeometry(type){if(!successful)return error('No valid geometry to export.');
  let shouldRestore=state.smooth;try{
    // Export the full surface at current display fidelity, respecting display of full or one blade.
    let pos=drawPositions;if(!pos.length)throw Error('No triangle data.');let n=pos.length/9,base=($('#projectName').value.trim()||'propeller').replace(/[^a-z0-9_-]+/gi,'_');
    if(type==='obj'){
      let parts=['# Propeller Geometry Studio v0.6.0 / original compiled C kernel','# Units: millimeters'];
      for(let i=0;i<pos.length;i+=3)parts.push(`v ${pos[i].toFixed(5)} ${pos[i+1].toFixed(5)} ${pos[i+2].toFixed(5)}`);
      for(let i=0;i<n;i++)parts.push(`f ${i*3+1} ${i*3+2} ${i*3+3}`);
      download(new Blob([parts.join('\n')],{type:'text/plain'}),base+'.obj');
    }else{
      const bin=new ArrayBuffer(84+n*50),view=new DataView(bin),head='Propeller Geometry Studio v0.6 / millimeters';for(let i=0;i<head.length&&i<80;i++)view.setUint8(i,head.charCodeAt(i));view.setUint32(80,n,true);
      for(let i=0;i<n;i++){
        let z=i*9,b=84+i*50,ax=pos[z],ay=pos[z+1],az=pos[z+2],bx=pos[z+3],by=pos[z+4],bz=pos[z+5],cx=pos[z+6],cy=pos[z+7],cz=pos[z+8];
        let ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,L=Math.hypot(nx,ny,nz)||1;
        let values=[nx/L,ny/L,nz/L,ax,ay,az,bx,by,bz,cx,cy,cz];for(let j=0;j<12;j++)view.setFloat32(b+j*4,values[j],true);view.setUint16(b+48,0,true);
      }
      download(new Blob([bin],{type:'application/octet-stream'}),base+'.stl');
    }
    okay(`Prepared ${n.toLocaleString('en-US')} triangles as ${type.toUpperCase()} · browser export enabled.`);
  }catch(e){error(String(e));}
}
function updateButtons(){let btn=$('#bladesBtn');btn.textContent=state.full?'All blades':'One blade';btn.classList.toggle('selected',state.full);$('#surfaceBtn').textContent=state.smooth?'Smooth surface':'Standard30';$('#surfaceBtn').classList.toggle('selected',state.smooth);$('#wireBtn').textContent='Wireframe';$('#wireBtn').classList.toggle('selected',state.wire);}
function openSide(page){
  $$('[data-side]').forEach(b=>b.classList.toggle('active',b.dataset.side===page));
  $$('[data-side-page]').forEach(s=>s.hidden=s.dataset.sidePage!==page);
  if(page==='dist')$('#customPanel').open=true;
}
function closeSidebar(){const bar=$('#sidebar');bar.classList.remove('open');$('#sidebarScrim').hidden=true;$('#sidebarToggle').setAttribute('aria-expanded','false');}
function showFiles(){ $('#fileDrawer').hidden=false;$('#aboutDialog').hidden=true; }
function saveCSV(name,rows){download(new Blob([rows.join('\n')+'\n'],{type:'text/csv;charset=utf-8'}),name);okay(name+' berhasil diproses · periksa folder Downloads browser.');}
function exportOffsets(is3d){
 if(!successful)return error('No valid geometry for export.');
 const n=kernel.rows(),rows=[];
 if(is3d){
  rows.push('side,r_R,chord_position,x_mm,y_mm,z_mm');
  for(let side=0;side<2;side++)for(let i=0;i<n;i++)for(let j=0;j<30;j++){
   let a=[side===0?'BACK':'FACE',fmt(kernel.station(i,0),6),j];
   for(let d=0;d<3;d++)a.push(fmt(kernel.offset(side,i,j,d),6));
   rows.push(a.join(','));
  }
 }else{
  rows.push('side,r_R,chord_position,x_mm,y_mm');
  for(let side=0;side<2;side++)for(let i=0;i<n;i++)for(let j=0;j<30;j++){
   rows.push([side===0?'BACK':'FACE',fmt(kernel.station(i,0),6),j,fmt(kernel.offset(side,i,j,0),6),fmt(kernel.offset(side,i,j,1),6)].join(','));
  }
 }
 saveCSV(is3d?'propeller_3D_offsets.csv':'propeller_2D_offsets.csv',rows);
}
function exportRadial(){if(!successful)return error('No valid geometry.');
 const rows=['r/R,chord_mm,thickness_mm,skewGL_mm,pitch_mm,rakeRL_mm'];
 for(let i=0;i<kernel.rows();i++)rows.push([0,1,2,4,5,7].map(k=>fmt(kernel.station(i,k),6)).join(','));
 saveCSV('propeller_radial.csv',rows);
}

function snapshot(){return JSON.parse(JSON.stringify({cfg:state.cfg,mod:state.mod,additions:state.additions,removals:state.removals,overrides:state.overrides,station:state.station}));}
function pushUndo(beforeControl=false){if(!kernel)return;const snap=snapshot(); if(beforeControl&&undoStack.length&&JSON.stringify(undoStack[undoStack.length-1])===JSON.stringify(snap))return;undoStack.push(snap);if(undoStack.length>40)undoStack.shift();redoStack=[];updateUndoButtons();}
function restoreSnapshot(snap){state.cfg=snap.cfg;state.mod=snap.mod;state.additions=snap.additions;state.removals=snap.removals;state.overrides=snap.overrides;state.station=snap.station;applyForm();recalculate();}
function historyStep(direction){const src=direction==='undo'?undoStack:redoStack,dst=direction==='undo'?redoStack:undoStack;if(!src.length)return;dst.push(snapshot());restoreSnapshot(src.pop());updateUndoButtons();}
function updateUndoButtons(){for(let [id,n] of [['#undoBtn',undoStack.length],['#stationUndo',undoStack.length],['#redoBtn',redoStack.length]]){const e=$(id);if(e)e.disabled=n===0;}}
function setLayer(name,on){layers[name]=on;if(name==='surface'&&renderer){renderer.surfaces=on;renderer.draw();}quadRenderers.forEach(x=>{x.renderer.surfaces=on;x.renderer.draw();});paintCharts();paintLayerOverlay();}
function projectWorld(x,y,z,viewer,w,h){if(typeof viewer.project==='function')return viewer.project(x,y,z,w,h);const [right,up]=window.__arusCameraMath.fromPose(viewer.yaw,viewer.pitch,viewer.roll||0),pivot=viewer.centre||[0,0,0],scale=h/2*(viewer.fitSize||.85/(viewer.radius||viewer.diameter/2))*viewer.zoom; x-=pivot[0];y-=pivot[1];z-=pivot[2];return [w/2+(x*right[0]+y*right[1]+z*right[2])*scale,h/2-(x*up[0]+y*up[1]+z*up[2])*scale];}
function paintLayerOverlay(){const c=$('#layerCanvas');if(!c||!renderer||state.tab!=='3d'||quadMode||!successful)return;let r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(r.width<10||r.height<10)return;c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);const ctx=c.getContext('2d'),W=c.width,H=c.height;
 const point=(x,y,z)=>projectWorld(x,y,z,renderer,W,H);const draw=(arr,color,width=1,rotateMesh=false)=>{if(arr.length<2)return;ctx.strokeStyle=color;ctx.lineWidth=width*d;ctx.beginPath();for(let i=0;i<arr.length;i++){let p=point(...(rotateMesh?window.__arusPlusXDisplay.point(...arr[i]):arr[i]));i?ctx.lineTo(...p):ctx.moveTo(...p);}ctx.stroke();};
 if(layers.axes){const a=state.cfg[0]*.58;draw([[-a,0,0],[a,0,0]],'#bf6971',1.2);draw([[0,-a,0],[0,a,0]],'#4b9f83',1.2);draw([[0,0,-a],[0,0,a]],'#5c87d3',1.2);}
 if(layers.sections){for(let i=0;i<kernel.rows();i++){let p=[];for(let j=0;j<30;j++)p.push([kernel.offset(0,i,j,2),kernel.offset(0,i,j,3),kernel.offset(0,i,j,4)]);draw(p,'#ba7f28',1,true);p=[];for(let j=0;j<30;j++)p.push([kernel.offset(1,i,j,2),kernel.offset(1,i,j,3),kernel.offset(1,i,j,4)]);draw(p,'#ba7f28',1,true);}}
}

  const CAMERA={iso:[2.35619449,-0.61547971],reverse:[-0.78539816,0.61547971],front:[0,Math.PI/2],rear:[0,-Math.PI/2],top:[Math.PI,0],bottom:[0,0],right:[Math.PI/2,0],left:[-Math.PI/2,0]};
  function setCamera(name,r=renderer){if(!r)return;let val=CAMERA[name]||CAMERA.iso;r.yaw=val[0];r.pitch=val[1];r.roll=0;r.zoom=.94;r.draw();paintLayerOverlay();}
  window.__arusCam={
    get(){return renderer?{yaw:renderer.yaw,pitch:renderer.pitch,roll:renderer.roll||0}:null;},
    projectAxis(x,y,z,w,h){return renderer?projectWorld(x,y,z,renderer,w,h):null;},
    set(y,p,r=0){if(!renderer)return;renderer.yaw=y;renderer.pitch=p;renderer.roll=r;renderer.draw();paintLayerOverlay();},
    zoom(scale){if(!renderer)return;renderer.zoom=Math.max(.3,Math.min(7,renderer.zoom*scale));renderer.draw();paintLayerOverlay();},
    fit(){if(!renderer)return;renderer.zoom=.94;renderer.fitToView?.();renderer.draw();paintLayerOverlay();}
  };

function toggleFourViews(force){quadMode=force===undefined?!quadMode:force;$('#fourViews').classList.toggle('active',quadMode);$('#quadGrid').hidden=!quadMode;$('#glCanvas').hidden=quadMode||state.tab!=='3d';$('#layerCanvas').hidden=quadMode||state.tab!=='3d';
 if(quadMode){if(state.tab!=='3d')showTab('3d'); if(!quadRenderers.length){let labels=[['iso','Isometric'],['front','FRONT (−X)'],['top','Top (+Z)'],['right','Side (+Y)']];$('#quadGrid').innerHTML=labels.map(([id,label])=>`<div class="quad-view"><canvas data-quad="${id}"></canvas><span>${label}</span></div>`).join('');for(let [id,label] of labels){let c=$(`#quadGrid canvas[data-quad="${id}"]`);try{let r;try{r=new PG.View3D(c);}catch(glError){r=new PGCanvasFallback(c);}r.diameter=state.cfg[0];quadRenderers.push({renderer:r,id});}catch(e){error('Quad viewer unavailable: '+e.message);quadMode=false;break;}}}if(quadMode)refreshQuadViews();}
 else{renderer?.draw();paintLayerOverlay();}}
function refreshQuadViews(){if(!quadMode)return;for(let o of quadRenderers){let r=o.renderer;r.diameter=state.cfg[0];r.color=renderer.color;r.customColor=renderer.customColor;r.finish=renderer.finish;r.wire=state.wire;r.surfaces=layers.surface;r.upload(displayPositions,{smooth:state.smooth,stations:Array.from({length:kernel.rows()},(_,i)=>kernel.station(i,0)),diameter:state.cfg[0]});r.canvas.dataset.arusPropellerFacing='+X';setCamera(o.id,r);}}
function updateMaterial(){if(!renderer)return;renderer.color=$('#material').value;renderer.customColor=$('#customColor').value;renderer.finish=$('#finish').value;renderer.draw();quadRenderers.forEach(x=>{x.renderer.color=renderer.color;x.renderer.customColor=renderer.customColor;x.renderer.finish=renderer.finish;x.renderer.draw();});}
function csvEscape(x){return typeof x==='string'?'"'+x.replaceAll('"','""')+'"':String(x);}
function exportPly(){if(!successful)return;const a=drawPositions,n=a.length/3,t=a.length/9,color=(()=>{let c=$('#customColor').value;if($('#material').value!=='custom')c={polishedsteel:'#a3b4c4',stainless:'#a9b9c4',aluminium:'#b7c5cc',graphite:'#55616e',arusblue:'#2363a0'}[$('#material').value]||c;return [1,3,5].map(i=>parseInt(c.slice(i,i+2),16));})();let lines=['ply','format ascii 1.0','comment ARUS propeller mesh; units millimetres',`element vertex ${n}`,'property float x','property float y','property float z','property uchar red','property uchar green','property uchar blue',`element face ${t}`,'property list uchar int vertex_indices','end_header'];for(let i=0;i<a.length;i+=3)lines.push(`${a[i].toFixed(6)} ${a[i+1].toFixed(6)} ${a[i+2].toFixed(6)} ${color.join(' ')}`);for(let i=0;i<t;i++)lines.push(`3 ${i*3} ${i*3+1} ${i*3+2}`);download(new Blob([lines.join('\n')],{type:'text/plain'}),'propeller_mesh.ply');okay(`PLY exported · ${t} triangles.`);}
function exportDxf(){if(!successful)return;let v=['0','SECTION','2','HEADER','0','ENDSEC','0','SECTION','2','ENTITIES'];for(let side=0;side<2;side++)for(let row=0;row<kernel.rows();row++){let rr=kernel.station(row,0).toFixed(5);let layer=`${side?'FACE':'BACK'}_${rr}`;for(let j=0;j<29;j++){let a=[],b=[];for(let k=2;k<5;k++){a.push(kernel.offset(side,row,j,k));b.push(kernel.offset(side,row,j+1,k));}v.push('0','LINE','8',layer,'10',String(a[0]),'20',String(a[1]),'30',String(a[2]),'11',String(b[0]),'21',String(b[1]),'31',String(b[2]));}}v.push('0','ENDSEC','0','EOF');download(new Blob([v.join('\n')],{type:'application/dxf'}),'propeller_section_curves.dxf');okay(`DXF section curves exported · ${kernel.rows()} stations, one blade, millimetres.`);}
function exportCadJSON(){if(!successful)return error('No valid geometry');const n=kernel.rows(),data={format:'PG_CAD_1',diameter_mm:state.cfg[0],blades:state.cfg[8],hub_diameter_mm:state.cfg[3],hub_length_mm:state.mod[23]||0,root_fillet_mm:state.mod[24]||0,geometry_rules:state.mod[22]||1,r_R:Array.from({length:n},(_,i)=>kernel.station(i,0)),surfaces:[0,1].map(side=>Array.from({length:n},(_,i)=>Array.from({length:30},(_,j)=>[2,3,4].map(k=>kernel.offset(side,i,j,k)))))};download(new Blob([JSON.stringify(data)],{type:'application/json'}),'Propeller_CAD_geometry.json');okay('CAD JSON (PG_CAD_1) exported with source points; use the native converter for STEP/IGES.');}
function exportRhinoScript(){if(!successful)return error('No geometry for Rhino export');const out=[],n=kernel.rows(),macro=window.PG_RHINO_MACRO||[];if(!macro.length)return error('Native Rhino command template unavailable');const fmtpt=(side,index,j)=>[2,3,4].map(k=>kernel.offset(side,index,j,k).toFixed(9)).join(',');
 for(let i=0;i<macro.length;){const [cmd,side,k]=macro[i];if(side<0){out.push(cmd==='12'?String(n):cmd);i++;continue;}let end=i;while(end<macro.length&&macro[end][1]>=0)end++;let count=end-i;
 if(count===360){for(let row=0;row<n;row++)for(let col=0;col<30;col++)out.push(fmtpt(side,row,col));}
 else if(count===30){let index=k? n-1:0;for(let col=0;col<30;col++)out.push(fmtpt(side,index,col));}
 else{let col=k%30;for(let row=n-1;row>=0;row--)out.push(fmtpt(side,row,col));}
 i=end;}
 download(new Blob([out.join('\n')+'\n'],{type:'text/plain'}),'Propeller_Rhino_Surface.txt');okay('Rhino command file exported for one blade. In an empty Rhino model, run _ReadCommandFile; inspect the generated surfaces.');}

function nativeProjectText(){const c=state.cfg,m=state.mod;let f=n=>Number(n).toPrecision(15),lines=['PGEO4',`GEOMETRY_RULES ${m[22]||1}`,`CAD_SETUP ${f(m[23]||0)} ${f(m[24]||0)}`,`STATIONS ${kernel.rows()}`];lines.push('CONFIG '+[...Array(19)].map((_,i)=>i<8?f(c[i]):String(Math.round(c[i]||0))).join(' '));lines.push('MODS '+[0,4,5,6,9,10,1,2,3,7,8,11,12,13,14,15].map((k,i)=>i<6?String(Math.round(m[k]||0)):f(m[k])).join(' '));lines.push('DISTRIBUTIONS '+[16,17,18,19,20].map((k,i)=>i===0?String(Math.round(m[k]||0)):f(m[k])).join(' '));lines.push('CURATED '+String(m[21]??1));
 const map={1:[2,3],2:[4,4],3:[1024,4],4:[16,4],5:[8,5],6:[512,5],7:[2048,7],8:[256,6],9:[64,6],10:[128,7],11:[8192,9],12:[16384,9]};
 // Native station records store linked parameter dimensions with bit masks; use source fields for compatibility.
 for(let i=0;i<kernel.rows();i++){let rr=kernel.station(i,0),ed=state.overrides.filter(x=>Math.abs(x.rr-rr)<1e-7),mask=1,ch=0,th=0,pitch=0,sk=0,rake=0,camber=0,cup=0;
 for(let e of ed){let k=e.col;mask|=map[k]?.[0]||0;if(k===1)ch=e.value;if(k===2)th=e.value;if(k===5||k===6)pitch=e.value;if(k===3||k===4)sk=e.value;if(k===7)rake=e.value;if(k===8||k===9)camber=e.value;if(k===10)cup=e.value;}
 lines.push(`STATION ${i} ${mask} ${f(rr)} ${f(ch)} ${f(th)} ${f(pitch)} ${f(sk)} ${f(rake)} ${f(camber)} ${f(cup)}`);
 if(mask & (8192|16384)){let xcam=ed.find(e=>e.col===11)?.value??0.5,xth=ed.find(e=>e.col===12)?.value??0.35;lines.push(`SECTION_POS ${i} ${f(xcam)} ${f(xth)}`);}
 }return lines.join('\n')+'\n';}
function exportNativeProject(){if(!successful)return;const name=($('#projectName').value||'Propeller').replace(/[^a-z0-9_-]+/gi,'_');download(new Blob([nativeProjectText()],{type:'text/plain'}),name+'.pgeo');okay('PGEO4-format project exported. Geometry and supported station controls saved; use imported project JSON for complete Web state.');}
function importNativeProject(src){const lines=src.trim().split(/\r?\n/),ver=lines[0];if(!['PGEO2','PGEO3','PGEO4','PGEO5'].includes(ver))throw Error('Invalid Windows project header');let cfg={...DEFAULT_CFG},mod={...DEFAULT_MOD},stationLines=[];for(let ln of lines.slice(1)){let parts=ln.trim().split(/\s+/),label=parts.shift(),a=parts.map(Number);if(label==='CONFIG'){if(a.length!==19)throw Error('Windows CONFIG must have 19 entries');for(let i=0;i<19;i++)cfg[i]=a[i];}else if(label==='MODS'){let keys=[0,4,5,6,9,10,1,2,3,7,8,11,12,13,14,15];if(a.length!==16)throw Error('Invalid Windows MODS');keys.forEach((k,i)=>mod[k]=a[i]);}else if(label==='DISTRIBUTIONS'){[16,17,18,19,20].forEach((k,i)=>mod[k]=a[i]);}else if(label==='CURATED')mod[21]=a[0];else if(label==='GEOMETRY_RULES')mod[22]=a[0];else if(label==='CAD_SETUP'){mod[23]=a[0];mod[24]=a[1];}else if(label==='STATION')stationLines.push(a);else if(label==='POINT'){throw Error('Native project has direct Y Back/Y Face edits. WASM bridge does not expose point-level import; original file was not modified.');}}
 const previous=snapshot();state.cfg=cfg;state.mod=mod;state.additions=[];state.removals=[];state.overrides=[];applyForm();recalculate();if(!successful){restoreSnapshot(previous);throw Error('Windows project settings are outside the active source domain');}
 const originalRR=Array.from({length:kernel.rows()},(_,i)=>kernel.station(i,0));const target=stationLines.map(a=>a[2]);state.additions=target.filter(rr=>!originalRR.some(x=>Math.abs(x-rr)<1e-7));state.removals=originalRR.filter(rr=>!target.some(x=>Math.abs(x-rr)<1e-7));
 // Read common station dimensional edits and linked angle/camber fields. Mask mapping comes from Windows core.h.
 const fields=[[2,1,3],[4,2,4],[8,5,5],[16,4,6],[32,7,7],[256,8,8],[128,10,9],[1024,3,6],[512,6,5],[2048,7,7]];
 for(let a of stationLines){let [i,mask,rr]=a;for(let [bit,col,srcIndex] of fields)if(mask&bit)state.overrides.push({rr,col,value:a[srcIndex]});}
 applyForm();recalculate();if(!successful){restoreSnapshot(previous);throw Error('Native radial edits are not compatible with browser kernel');}okay('Native .pgeo loaded using compatible basic fields. Some extended Windows-only workspace information is not imported.');}
function exportPDF(){if(!successful)return;let esc=x=>String(x).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7e]/g,'-');let pages=[],rows=kernel.rows();const summary=[`ARUS PROPELLER GEOMETRY STUDIO - WEB REPORT`,`Windows UI reference 0.7.2 | C/WASM engine 0.6.0`,`Family: ${FAMILIES[state.cfg[9]]} | Z: ${state.cfg[8]} | Rotation: ${state.cfg[17]?'LH':'RH'}`,`Diameter D: ${state.cfg[0]} mm | Target EAR: ${state.cfg[1]} | Modeled EAR: ${fmt(kernel.metric(0),6)}`,`Target P0.7/D: ${state.cfg[2]} | Actual P0.7/D: ${fmt(kernel.metric(1),6)}`,`Radial stations: ${rows} | Root r/R: ${fmt(kernel.metric(3),6)} | Tip r/R: ${fmt(kernel.metric(4),6)}`,`Units: millimetres | Generated: ${new Date().toISOString().slice(0,19)}`,'','RADIAL DISTRIBUTIONS','r/R       Chord(mm)   Thick(mm)   Skew(mm)    Pitch(mm)   Rake(mm)'];for(let i=0;i<rows;i++)summary.push([0,1,2,4,5,7].map((col,j)=>fmt(kernel.station(i,col),j===0?5:3).padEnd(j?12:10)).join(' '));summary.push('','Note: Summary report, not native full Standard30 offset PDF.');
 for(let j=0;j<summary.length;j+=44){let chunk=summary.slice(j,j+44),cmd=['BT /F1 10 Tf 42 794 Td 12 TL'];for(let i=0;i<chunk.length;i++)cmd.push(`(${esc(chunk[i])}) Tj T*`);cmd.push('ET');pages.push(cmd.join('\n'));}
 // Minimal valid PDF with Courier for table alignment and a separate page object per chunk.
 let objects=['<< /Type /Catalog /Pages 2 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'];let kids=[];
 for(let content of pages){let pageNum=objects.length+1;let dataNum=pageNum+1;kids.push(`${pageNum} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${dataNum} 0 R >>`);objects.push(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`);}objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
 let pdf='%PDF-1.4\n',offsets=[0],encoder=new TextEncoder();for(let i=0;i<objects.length;i++){offsets.push(encoder.encode(pdf).length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}let start=encoder.encode(pdf).length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;download(new Blob([pdf],{type:'application/pdf'}),'ARUS_propeller_geometry_summary.pdf');okay('PDF summary exported (radial table + design metrics).');}
function bindWindows072(){
 $('#cameraView').addEventListener('change',e=>setCamera(e.target.value));$('#fourViews').addEventListener('click',()=>toggleFourViews());$('#layersBtn').addEventListener('click',()=>{$('#layersDialog').hidden=!$('#layersDialog').hidden;$('#pasteDialog').hidden=true;});$('#closeLayers').addEventListener('click',()=>$('#layersDialog').hidden=true);
 $$('[data-layer]').forEach(e=>e.addEventListener('change',()=>setLayer(e.dataset.layer,e.checked)));
 $('#finish').addEventListener('change',updateMaterial);$('#customColor').addEventListener('input',updateMaterial);
 $('#undoBtn').addEventListener('click',()=>historyStep('undo'));$('#stationUndo').addEventListener('click',()=>historyStep('undo'));$('#redoBtn').addEventListener('click',()=>historyStep('redo'));
 window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey){let k=e.key.toLowerCase();if(k==='z'||k==='y'){e.preventDefault();historyStep(k==='z'?'undo':'redo');}}});
 $('#autoAll').addEventListener('click',()=>{pushUndo();state.overrides=[];recalculate();});
 $('#clearCell').addEventListener('click',()=>{if(!successful)return;pushUndo();let rr=kernel.station(state.station,0),col=Number($('#editField').value);state.overrides=state.overrides.filter(e=>!(Math.abs(e.rr-rr)<1e-7&&e.col===col));recalculate();});
 $('#resetStation').addEventListener('click',()=>{if(!successful)return;pushUndo();let rr=kernel.station(state.station,0);state.overrides=state.overrides.filter(e=>Math.abs(e.rr-rr)>1e-7);recalculate();});
 $('#clearAllManual').addEventListener('click',()=>{pushUndo();state.overrides=[];state.additions=[];state.removals=[];recalculate();});
 $('#pasteRows').addEventListener('click',()=>{$('#pasteDialog').hidden=false;$('#layersDialog').hidden=true;});$('#cancelPaste').addEventListener('click',()=>$('#pasteDialog').hidden=true);
 $('#doPaste').addEventListener('click',()=>{try{let data=$('#pasteData').value.trim().split(/\r?\n/).filter(Boolean),rows=[];for(let line of data){let a=line.trim().split(/[\s,;\t]+/).map(Number);if(a.length!==9||a.some(x=>!Number.isFinite(x)))throw Error('Each line must contain exactly nine numeric fields');rows.push(a);}if(!rows.length)throw Error('Paste data first');pushUndo();for(let a of rows){let rr=a[0],found=Array.from({length:kernel.rows()},(_,i)=>kernel.station(i,0)).some(x=>Math.abs(x-rr)<1e-5);if(!found)throw Error(`r/R ${rr} not on the active radial grid; add the station first`);for(let [i,col] of [[1,1],[2,2],[4,4],[5,5],[7,7],[8,8]]){state.overrides=state.overrides.filter(e=>!(Math.abs(e.rr-rr)<1e-7&&e.col===col));state.overrides.push({rr,col,value:a[i]});}}recalculate();$('#pasteDialog').hidden=true;}catch(e){error('Paste failed: '+e.message);}});
 $('#stationTable tbody').addEventListener('dblclick',e=>{let cell=e.target.closest('td'),row=e.target.closest('tr');if(!cell||!row||cell.dataset.col==='0')return;state.station=Number(row.dataset.station);$('#editField').value=cell.dataset.col;updateStationValue();$('#stationValue').focus();$('#stationValue').select();});
 $('#exportPly').addEventListener('click',exportPly);$('#exportDxf').addEventListener('click',exportDxf);$('#exportPdf').addEventListener('click',exportPDF);$('#exportPgeo').addEventListener('click',exportNativeProject);$('#exportRhino').addEventListener('click',exportRhinoScript);
}

function bind(){
  $$('[data-side]').forEach(b=>b.addEventListener('click',()=>{openSide(b.dataset.side);if(matchMedia('(max-width:900px)').matches)closeSidebar();}));
  $('#sidebarToggle').addEventListener('click',()=>{let isOpen=$('#sidebar').classList.toggle('open');$('#sidebarScrim').hidden=!isOpen;$('#sidebarToggle').setAttribute('aria-expanded',String(isOpen));});
  $('#sidebarScrim').addEventListener('click',closeSidebar);
  $('#summaryQuick').addEventListener('click',()=>{openSide('main');});
  $('#configQuick').addEventListener('click',()=>{openSide('dist');});
  $('#aboutQuick').addEventListener('click',()=>{$('#aboutDialog').hidden=false;$('#fileDrawer').hidden=true;});
  $('#closeAbout').addEventListener('click',()=>{$('#aboutDialog').hidden=true;});
  $('#headerSave').addEventListener('click',()=>$('#saveLocal').click());
  $('#headerOpen').addEventListener('click',showFiles);
  $('#fileToolsQuick').addEventListener('click',showFiles);
  $('#closeFileDrawer').addEventListener('click',()=>{$('#fileDrawer').hidden=true;});
  $('#exportProjectQuick').addEventListener('click',exportCadJSON);
  $('#exportCsv').addEventListener('click',exportRadial);
  $('#export2d').addEventListener('click',()=>exportOffsets(false));
  $('#export3d').addEventListener('click',()=>exportOffsets(true));
  $$('[data-tab]').forEach(el=>el.addEventListener('click',()=>showTab(el.dataset.tab)));
  $$('[data-cfg],[data-mod]').forEach(el=>el.addEventListener('change',()=>{pushUndo(true);readForm();updateDisabled();schedule();}));
  $('#material').addEventListener('change',()=>{if(renderer){renderer.color=$('#material').value;renderer.draw();}$('#customColor').hidden=$('#material').value!=='custom';updateMaterial();});
  $('#fitBtn').addEventListener('click',()=>{renderer?.fit();if(quadMode)quadRenderers.forEach(x=>x.renderer.fit());paintLayerOverlay();});
  $('#bladesBtn').addEventListener('click',()=>{state.full=!state.full;updateButtons();schedule();});
  $('#surfaceBtn').addEventListener('click',()=>{state.smooth=!state.smooth;updateButtons();schedule();});
  $('#wireBtn').addEventListener('click',()=>{state.wire=!state.wire;if(renderer)renderer.wire=state.wire;quadRenderers.forEach(x=>x.renderer.wire=state.wire);updateButtons();renderer?.draw();quadRenderers.forEach(x=>x.renderer.draw());});
  $('#outlineKind').addEventListener('change',e=>{state.outline=e.target.value;paintCharts();});
  $('#stationChoose').addEventListener('change',e=>{state.station=Number(e.target.value);refreshStations();paintCharts();paintLayerOverlay();});
  $('#editField').addEventListener('change',updateStationValue);
  $('#applyStation').addEventListener('click',()=>{try{
    let value=Number($('#stationValue').value),col=Number($('#editField').value),rr=kernel.station(state.station,0);
    if($('#stationValue').value.trim()===''||!Number.isFinite(value))throw Error('Enter a numeric station value.');
    pushUndo();state.overrides=state.overrides.filter(x=>!(Math.abs(x.rr-rr)<1e-7&&x.col===col));state.overrides.push({rr,col,value});recalculate();
  }catch(e){error(e.message||String(e));}});
  $('#addStation').addEventListener('click',()=>{let rr=Number($('#newRR').value),root=successful?kernel.station(0,0):0.2,top=successful?kernel.station(kernel.rows()-1,0):1;
    if(!Number.isFinite(rr)||rr<=root+1e-7||rr>=top-1e-7)return error(`New r/R must be inside current ${fmt(root,4)}–${fmt(top,4)} station range; source-domain rules still apply.`);
    if(kernel.rows()>=64)return error('Maximum 64 radial stations.');
    pushUndo();state.removals=state.removals.filter(x=>Math.abs(x-rr)>1e-7);state.additions.push(rr);state.additions=Array.from(new Set(state.additions)).sort((a,b)=>a-b);recalculate();
  });
  $('#removeStation').addEventListener('click',()=>{let rr=kernel.station(state.station,0);if(state.station===0||state.station===kernel.rows()-1)return error('Root and tip stations cannot be removed.');
    pushUndo();let isAdded=state.additions.some(x=>Math.abs(x-rr)<1e-7);
    state.additions=state.additions.filter(x=>Math.abs(x-rr)>1e-7);state.overrides=state.overrides.filter(x=>Math.abs(x.rr-rr)>1e-7);
    if(!isAdded&&!state.removals.some(x=>Math.abs(x-rr)<1e-7))state.removals.push(rr);
    recalculate();
  });
  $('#autoStation').addEventListener('click',()=>{pushUndo();let rr=kernel.station(state.station,0);state.overrides=state.overrides.filter(x=>Math.abs(x.rr-rr)>1e-7);recalculate();});
  $('#resetBtn').addEventListener('click',()=>{pushUndo();Object.assign(state.cfg,DEFAULT_CFG);Object.assign(state.mod,DEFAULT_MOD);state.additions=[];state.removals=[];state.overrides=[];state.station=5;$('#projectName').value='B4-55 Default';applyForm();recalculate();});
  $('#saveLocal').addEventListener('click',()=>{let project=makeProject(),db={};try{db=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch(e){}db[project.name]=project;try{localStorage.setItem(storageKey,JSON.stringify(db));okay(`Saved locally: ${project.name}`);}catch(e){error('Local storage unavailable. Export a project file instead.');}});
  $('#loadLocal').addEventListener('click',()=>{let db={};try{db=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch(e){}let names=Object.keys(db);if(!names.length)return error('No saved designs on this device.');let name=prompt('Enter project name:\n'+names.join('\n'),names[names.length-1]);if(name&&db[name])try{loadProject(db[name]);}catch(e){error(e.message);}});
  $('#exportProject').addEventListener('click',()=>{let p=makeProject(),name=p.name.replace(/[^a-z0-9_-]+/gi,'_');download(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),name+'.pgandroid');okay('Project export requested. Check Android Downloads.');});
  $('#importProject').addEventListener('click',()=>$('#importFile').click());
  $('#importFile').addEventListener('change',e=>{let f=e.target.files?.[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{try{pushUndo();let data=String(rd.result||'');if(data.trimStart().startsWith('PGEO'))importNativeProject(data);else loadProject(JSON.parse(data));}catch(err){error('Import failed: '+err.message);}e.target.value='';};rd.readAsText(f);});
  $('#copyProject').addEventListener('click',()=>{let result=copyText(JSON.stringify(makeProject()));result?okay('Project JSON copied to clipboard.'):error('Clipboard not available.');});
  $('#copyRadial').addEventListener('click',()=>{if(!successful)return error('No valid geometry.');let csv=['r/R,chord_mm,thickness_mm,skewGL_mm,pitch_mm,rakeRL_mm'];for(let i=0;i<kernel.rows();i++){csv.push([0,1,2,4,5,7].map(k=>kernel.station(i,k)).join(','));}let result=copyText(csv.join('\n'));result?okay('Final radial table copied to clipboard.'):error('Clipboard not available.');});
  $('#exportObj').addEventListener('click',()=>exportGeometry('obj'));
  $('#exportStl').addEventListener('click',()=>exportGeometry('stl'));
  $('#fileExportStl').addEventListener('click',()=>exportGeometry('stl'));
  $('#fileExportObj').addEventListener('click',()=>exportGeometry('obj'));
  window.addEventListener('arus-geometry-view-changed',paintLayerOverlay);
  window.addEventListener('resize',()=>{renderer?.draw();paintCharts();paintLayerOverlay();quadRenderers.forEach(x=>x.renderer.draw());});
  bindWindows072();
}
async function start(){fillOptions();applyForm();bind();updateButtons();try{kernel=new PG.PropellerEngine();await kernel.init();try{renderer=new PG.View3D($('#glCanvas'));}catch(e){try{renderer=new PGCanvasFallback($('#glCanvas'));}catch(err){$('#canvasError').hidden=false;$('#canvasError').textContent=err.message;renderer=null;}}
    recalculate();updateMaterial();updateUndoButtons();$('#glCanvas').addEventListener('webglcontextlost',e=>{e.preventDefault();if(renderer?.gl)arusRestoreVisiblePropeller('webgl-context-lost');},{passive:false});
  }catch(e){error('Native geometry kernel could not load: '+(e.message||e));$('#canvasError').hidden=false;$('#canvasError').textContent=e.message||String(e);}
}
window.addEventListener('DOMContentLoaded',start);
})();

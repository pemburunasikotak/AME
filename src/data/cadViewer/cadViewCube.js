(function(){
  'use strict';
  const ctl=window.__arusCam;
  if(!ctl) return;
  const host=document.getElementById('canvasContainer') || document.querySelector('.arus-cad-stage');
  if(!host || host.querySelector('.arus-inventor-nav')) return;
  const currentSelect=document.getElementById('cameraView')||document.getElementById('camera');
  const container=document.createElement('div');
  container.className='arus-inventor-nav';
  container.setAttribute('aria-label','Navigasi kamera ViewCube');
  container.innerHTML=`
    <button type="button" class="inv-home" data-inv-home title="Home · isometric +X +Y +Z" aria-label="Home / Isometric"><svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 9.2 10 3l7 6.2M5.1 8.2v8h9.8v-8M8 16.2v-4.8h4v4.8" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="inv-cube-hold"><svg class="inv-cube-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="group" aria-label="ViewCube: klik sisi, tepi, atau sudut"></svg></div>
    <div class="inv-tools" role="group" aria-label="Kontrol tampilan">
      <button type="button" data-inv-zoom="in" aria-label="Perbesar" title="Zoom in">＋</button>
      <button type="button" data-inv-zoom="out" aria-label="Perkecil" title="Zoom out">−</button>
      <button type="button" data-inv-fit aria-label="Fit view" title="Fit view">⌕</button>
    </div>
  `;
  host.appendChild(container);
  const svg=container.querySelector('.inv-cube-svg');
  const svgns='http://www.w3.org/2000/svg';
  const DIRS=[
    {v:[1,0,0],key:'rear',label:'BACK',color:'#f0f2f4'},
    {v:[-1,0,0],key:'front',label:'FRONT',color:'#eef1f3'},
    {v:[0,1,0],key:'right',label:'RIGHT',color:'#e6eaee'},
    {v:[0,-1,0],key:'left',label:'LEFT',color:'#e8ecef'},
    {v:[0,0,1],key:'top',label:'TOP',color:'#f8f9fb'},
    {v:[0,0,-1],key:'bottom',label:'BOTTOM',color:'#e5e9ed'}
  ];
  const home={yaw:Math.PI*3/4,pitch:-Math.asin(1/Math.sqrt(3))};
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const wrapAngle=a=>((a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  function normalize(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l);}
  function toCameraDirection(yaw,pitch){return [-Math.sin(pitch),Math.sin(yaw)*Math.cos(pitch),-Math.cos(yaw)*Math.cos(pitch)];}
  function viewFromDirection(v){const n=normalize(v);return {pitch:-Math.asin(clamp(n[0],-1,1)),yaw:Math.abs(n[0])>.9999?0:Math.atan2(n[1],-n[2])};}
  function project(v,yaw,pitch){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);const a=v[1]*cy+v[2]*sy;const b=-v[1]*sy+v[2]*cy;const roll=window.__arusCameraMath.totalRoll(yaw,pitch,ctl.get()?.roll||0);const u=a*Math.cos(roll)-(v[0]*cp-b*sp)*Math.sin(roll);const w=a*Math.sin(roll)+(v[0]*cp-b*sp)*Math.cos(roll);return {x:64+u*29,y:64-w*29,depth:v[0]*sp+b*cp};}
  const el=(name,attrs,text)=>{const node=document.createElementNS(svgns,name);for(const [k,v] of Object.entries(attrs||{}))node.setAttribute(k,String(v));if(text!==undefined)node.textContent=text;return node;};
  const escapeText=t=>t.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  window.__arusViewAxisContract={
    labels:{BACK:'+X',FRONT:'-X',RIGHT:'+Y',LEFT:'-Y',TOP:'+Z',BOTTOM:'-Z'},
    // This is also used by the GPU shader; its basis is verified at each pose.
    basis:(yaw,pitch)=>{
      const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const roll=window.__arusCameraMath.totalRoll(yaw,pitch,ctl.get()?.roll||0);
      const cr=Math.cos(roll),sr=Math.sin(roll);
      const horizontal=[0,cy,sy];
      const vertical=[cp,sy*sp,-cy*sp];
      const right=horizontal.map((h,i)=>h*cr-vertical[i]*sr);
      const up=horizontal.map((h,i)=>h*sr+vertical[i]*cr);
      const forward=[sp,-sy*cp,cy*cp];
      return {right,up,forward};
    },
    project:(v)=>{const cam=ctl.get();return cam?project(v,cam.yaw,cam.pitch):null;},
    direction:()=>{const cam=ctl.get();return cam?toCameraDirection(cam.yaw,cam.pitch):null;}
  };
  function faceVertices(n){const u=[];for(const a of [-1,1])for(const b of [-1,1]){if(n[0])u.push([n[0],a,b]);else if(n[1])u.push([a,n[1],b]);else u.push([a,b,n[2]]);}return u;}
  function ordered(vertices,view){const c=vertices.reduce((a,b)=>a.map((v,i)=>v+b[i]/4),[0,0,0]);return vertices.sort((a,b)=>Math.atan2(project(a,view.yaw,view.pitch).y-project(c,view.yaw,view.pitch).y,project(a,view.yaw,view.pitch).x-project(c,view.yaw,view.pitch).x)-Math.atan2(project(b,view.yaw,view.pitch).y-project(c,view.yaw,view.pitch).y,project(b,view.yaw,view.pitch).x-project(c,view.yaw,view.pitch).x));}
  const faceNames=v=>DIRS.filter(d=>d.v.reduce((a,n,i)=>a+n*v[i],0)>0.45).map(d=>d.label);
  // Consistent coordinate convention for all views: BACK = +X, RIGHT = +Y, TOP = +Z.
  // Keep the camera menu synchronized when navigation happens through the cube itself.
  if(currentSelect && !currentSelect.querySelector('option[value=custom]')){
    const customOption=document.createElement('option');customOption.value='custom';customOption.textContent='Custom view';currentSelect.appendChild(customOption);
  }
  function syncCameraMenu(yaw,pitch){
    if(!currentSelect)return;
    const cam=toCameraDirection(yaw,pitch);
    const best=DIRS.map(d=>({key:d.key,score:d.v.reduce((n,v,i)=>n+v*cam[i],0)})).sort((a,b)=>b.score-a.score)[0];
    let key='custom';
    if(Math.abs(ctl.get()?.roll||0)<.018){
      if(best&&best.score>.9985)key=best.key;
      else if(Math.abs(wrapAngle(yaw-home.yaw))<.018&&Math.abs(pitch-home.pitch)<.018)key='iso';
    }
    if(currentSelect.value!==key&&currentSelect.querySelector('option[value='+key+']'))currentSelect.value=key;
  }
  let last=null, frameAnim=0;
  /* v148: chamfered ViewCube. Six large planar faces, twelve true beveled
     edge facets and eight triangular corner facets share the MODEL camera basis.
     No auxiliary orbit arrows are created. Each facet is keyboard-clickable. */
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const surface=(type,key,normal,vertices,label)=>({type,key,normal:normalize(normal),vertices,label});
  const cornerSize=.80;
  const patches=[];
  for (const d of DIRS){
    const v=faceVertices(d.v).map(p=>p.map((u,i)=>d.v[i]===0?u*cornerSize:u));
    patches.push(surface('face',d.key,d.v,v,d.label));
  }
  // 12 chamfer strips connecting orthogonal face planes.
  for(let axis=0;axis<3;axis++)for(const a of [-1,1])for(const b of [-1,1]){
    const ids=[0,1,2].filter(i=>i!==axis),i=ids[0],j=ids[1];
    const point=(p,q,t)=>{const v=[0,0,0];v[i]=p;v[j]=q;v[axis]=t;return v};
    const n=point(a,b,0);
    patches.push(surface('edge',n.join(','),n,[
      point(a,b*cornerSize,-cornerSize),
      point(a*cornerSize,b,-cornerSize),
      point(a*cornerSize,b,+cornerSize),
      point(a,b*cornerSize,+cornerSize)
    ],faceNames(n).join(' / ')));
  }
  // 8 genuinely clickable pointed corner facets.
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
    const n=[x,y,z];patches.push(surface('corner',n.join(','),n,[
      [x,y*cornerSize,z*cornerSize],
      [x*cornerSize,y,z*cornerSize],
      [x*cornerSize,y*cornerSize,z]
    ],faceNames(n).join(' / ')));
  }
  const palette={
    rear:['#fafcfd','#e5eaf0'],front:['#f9fafc','#e2e7ed'],
    right:['#f1f5f8','#d7dfe7'],left:['#f6f8fa','#dce4ea'],
    top:['#ffffff','#e8edf2'],bottom:['#e9eef2','#c8d2db']
  };
  const cubeLight=normalize([.35,-.12,1.4]);
  function makeStops(defs){
    for(const [key,colors] of Object.entries(palette)){
      const grad=el('linearGradient',{id:'invFaceGradient-'+key,x1:'0%',y1:'0%',x2:'15%',y2:'100%'});
      grad.append(el('stop',{offset:'0%','stop-color':colors[0]}),el('stop',{offset:'100%','stop-color':colors[1]}));
      defs.appendChild(grad);
    }
    const bevel=el('linearGradient',{id:'invBevel',x1:'0',y1:'0',x2:'1',y2:'1'});
    bevel.append(el('stop',{offset:'0%','stop-color':'#edf3f7'}),el('stop',{offset:'100%','stop-color':'#b9c7d1'}));defs.appendChild(bevel);
  }
  function triadProject(dir,yaw,pitch){const pp=project(dir,yaw,pitch),o=project([0,0,0],yaw,pitch);return [(pp.x-o.x)*.51,(pp.y-o.y)*.51]}
  function redraw(){
    const pose=ctl.get();if(!pose||!Number.isFinite(pose.yaw)||!Number.isFinite(pose.pitch))return;
    const {yaw,pitch}=pose,roll=pose.roll||0;
    if(last && Math.abs(last[0]-yaw)<0.00001 && Math.abs(last[1]-pitch)<0.00001 && Math.abs(last[2]-roll)<0.00001)return;
    last=[yaw,pitch,roll];
    syncCameraMenu(yaw,pitch);
    const camera=toCameraDirection(yaw,pitch);
    const root=el('g',{'class':'inv-cube-model'});
    const defs=el('defs');makeStops(defs);svg.replaceChildren(defs,root);
    const facets=patches.filter(p=>dot(p.normal,camera)>0.002).map(p=>{
      const projected=p.vertices.map(v=>project(v,yaw,pitch));
      const cp={x:projected.reduce((sum,q)=>sum+q.x,0)/projected.length,y:projected.reduce((sum,q)=>sum+q.y,0)/projected.length};
      projected.sort((a,b)=>Math.atan2(a.y-cp.y,a.x-cp.x)-Math.atan2(b.y-cp.y,b.x-cp.x));
      const depth=p.vertices.reduce((a,v)=>a+project(v,yaw,pitch).depth,0)/p.vertices.length;
      return {...p,projected,depth,align:dot(p.normal,camera)};
    }).sort((a,b)=>b.depth-a.depth);
    // Draw real chamfered surfaces far-to-near; the facets themselves are hit targets.
    for(const f of facets){
      const polygon=el('polygon',{
        points:f.projected.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' '),
        fill:f.type==='face'?'url(#invFaceGradient-'+f.key+')':'url(#invBevel)',
        stroke:f.type==='face'?'#84939e':'#97a6b1',
        'stroke-width':f.type==='face'?'1.02':'.60',
        'stroke-linejoin':'round',
        ['data-inv-'+f.type]:f.key,
        'data-inv-zone':f.type,
        'data-active':f.align>.997?'true':'false',
        role:'button',tabindex:'0',
        'aria-label':f.type==='face'?'Lihat '+f.label:f.type==='edge'?'Lihat tepi '+f.label:'Lihat sudut '+f.label
      });
      polygon.appendChild(el('title',{}, f.type==='face'?'Lihat '+f.label:(f.type==='edge'?'Tepi ':'Sudut ')+f.label));
      root.appendChild(polygon);
    }
    // Labels remain readable: face names follow the selected camera but never
    // flip to upside-down text during free orbit or roll.
    for(const f of facets.filter(p=>p.type==='face' && p.align>.24)){
      const centre=project(f.normal,yaw,pitch);
      const horizontal=f.key==='top'||f.key==='bottom'?[1,0,0]:f.key==='rear'||f.key==='front'?[0,1,0]:[1,0,0];
      const axis=project(horizontal,yaw,pitch),zero=project([0,0,0],yaw,pitch);
      let angle=Math.atan2(axis.y-zero.y,axis.x-zero.x)*180/Math.PI;
      if(angle>90)angle-=180;if(angle< -90)angle+=180;
      const size= f.align<.45?8.0:9.6;
      // Show labels above the actual facets, without blocking clicking.
      const text=el('text',{x:centre.x.toFixed(2),y:(centre.y+2.6).toFixed(2),
        'text-anchor':'middle','font-family':'Arial,Segoe UI,sans-serif',
        'font-size':size,'font-weight':'700',fill:'#455563',
        transform:'rotate('+angle.toFixed(1)+' '+centre.x.toFixed(2)+' '+centre.y.toFixed(2)+')',
        'pointer-events':'none','class':'inv-face-name'
      },f.label);
      root.appendChild(text);
      if(f.align>.997){
        const bottom=[...f.projected].sort((a,b)=>b.y-a.y).slice(0,2).sort((a,b)=>a.x-b.x);
        root.appendChild(el('line',{x1:bottom[0].x,y1:bottom[0].y,x2:bottom[1].x,y2:bottom[1].y,
          stroke:'#269ef2','stroke-width':3.5,'stroke-linecap':'butt',
          class:'inv-selected-stripe','pointer-events':'none'}));
      }
    }
    // Tiny axis compass uses *exactly the same projection* as the cube and model,
    // including roll, with no separate yaw/pitch controller.
    let triad=host.querySelector('.inv-axis');
    if(!triad){triad=document.createElement('div');triad.className='inv-axis';triad.innerHTML='<svg viewBox="0 0 72 72" aria-label="Sumbu X, Y, Z"></svg>';host.appendChild(triad)}
    const compass=triad.querySelector('svg');compass.replaceChildren();
    const axes=[[[1,0,0],'#d94b47','X'],[[0,1,0],'#2d9f56','Y'],[[0,0,1],'#346de7','Z']];
    const depth=(dir)=>-dot(dir,camera);
    // Far axes first and close axes last, preserving intuitive occlusion.
    axes.sort((a,b)=>depth(b[0])-depth(a[0]));
    for(const [dir,color,name] of axes){
      const [dx,dy]=triadProject(dir,yaw,pitch);
      compass.appendChild(el('line',{x1:34,y1:38,x2:(34+dx).toFixed(2),y2:(38+dy).toFixed(2),stroke:color,'stroke-width':2.2,'stroke-linecap':'round'}));
      compass.appendChild(el('circle',{cx:(34+dx).toFixed(2),cy:(38+dy).toFixed(2),r:3,fill:color}));
      compass.appendChild(el('text',{x:(34+dx+(dx>=0?4:-8)).toFixed(2),y:(38+dy+(dy>=0?11:-4)).toFixed(2),fill:color,'font-weight':700,'font-size':11},name));
    }
  }
  function animateTo(tgt){const prev=ctl.get();if(!prev)return;cancelAnimationFrame(frameAnim);const start=performance.now(),dur=260;const y0=prev.yaw,p0=prev.pitch,r0=prev.roll||0;const dy=wrapAngle(tgt.yaw-y0),dp=tgt.pitch-p0,dr=wrapAngle((tgt.roll||0)-r0);function tick(now){const t=clamp((now-start)/dur,0,1),s=1-Math.pow(1-t,3);ctl.set(y0+dy*s,p0+dp*s,r0+dr*s);if(t<1)frameAnim=requestAnimationFrame(tick);else ctl.set(tgt.yaw,tgt.pitch,tgt.roll||0)}frameAnim=requestAnimationFrame(tick);}
  function targetFromClicked(node){if(node.dataset.invFace)return viewFromDirection(DIRS.find(d=>d.key===node.dataset.invFace).v);if(node.dataset.invEdge)return viewFromDirection(node.dataset.invEdge.split(',').map(Number));if(node.dataset.invCorner)return viewFromDirection(node.dataset.invCorner.split(',').map(Number));return null;}
  function doClick(e){const a=e.target.closest('[data-inv-face],[data-inv-edge],[data-inv-corner],[data-inv-home],[data-inv-zoom],[data-inv-fit]');if(!a)return;const target=targetFromClicked(a);if(target){ctl.fit();animateTo(target);return;}if(a.hasAttribute('data-inv-home')){ctl.fit();animateTo(home);return;}if(a.dataset.invZoom){ctl.zoom(a.dataset.invZoom==='in'?1.20:1/1.20);return;}if(a.hasAttribute('data-inv-fit')){ctl.fit();return;}}
  container.addEventListener('click',doClick);
  container.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-inv-face],[data-inv-edge],[data-inv-corner]')){e.preventDefault();doClick({target:e.target})}});
  if(currentSelect)currentSelect.addEventListener('change',(e)=>{
    const key=currentSelect.value;
    const dir=DIRS.find(d=>d.key===key);
    if(!dir && key!=='iso')return;
    e.stopImmediatePropagation();
    ctl.fit();
    animateTo(dir?viewFromDirection(dir.v):home);
  },true);
  // v134: update the ViewCube and XYZ in the SAME JS call stack as renderer.draw().
  // The v133 requestAnimationFrame queued them one paint AFTER the mesh. That caused
  // a visible rubber-band/lag while orbiting; no second animation frame is allowed.
  const syncFrame=()=>{
    if(!document.contains(container))return;
    if(host.id==='canvasContainer'){
      const gl=document.getElementById('glCanvas');
      container.style.display=gl?.hidden?'none':'';
    }
    redraw();
  };
  const onRender=syncFrame;
  window.addEventListener('arus-cad-camera-rendered',onRender);
  // If a user starts dragging the real model before a programmed ViewCube rotation
  // has ended, cancel the obsolete rotation instead of fighting the pointer.
  const viewCanvas=document.getElementById('glCanvas')||document.getElementById('cad');
  if(viewCanvas){
    viewCanvas.addEventListener('pointerdown',()=>cancelAnimationFrame(frameAnim),{passive:true,capture:true});
  }
  function installHooks(){
  for(const cls of [window.PG?.View3D,window.PGCanvasFallback]){
    if(!cls?.prototype?.draw || cls.prototype.draw.__arusCameraSync)continue;
    const original=cls.prototype.draw;
    const wrapped=function(...args){
      const result=original.apply(this,args);
      if(this.canvas === (document.getElementById('glCanvas')||document.getElementById('cad'))){
        window.dispatchEvent(new Event('arus-cad-camera-rendered'));
      }
      return result;
    };
    wrapped.__arusCameraSync=true;
    cls.prototype.draw=wrapped;
  }
  }
  installHooks();
  const initialHookTimer=setInterval(()=>{installHooks();if(window.PG?.View3D?.prototype?.draw?.__arusCameraSync)clearInterval(initialHookTimer);},80);
  // Initial setup and very occasional fallback for a late-created WebGL renderer.
  const healthTimer=setInterval(()=>{
    if(!document.contains(container)){
      clearInterval(healthTimer);
      window.removeEventListener('arus-cad-camera-rendered',onRender);
      return;
    }
    installHooks();
    onRender();
  },1600);
  onRender();
})();

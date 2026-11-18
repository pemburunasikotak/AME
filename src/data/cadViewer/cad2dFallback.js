'use strict';
/* 2D canvas raster fallback for devices with WebGL disabled (including constrained preview hosts).
   Geometry vertices are still the unchanged C/WASM output; only the drawing path differs. */
class CanvasFallbackView {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
    if(!this.ctx)throw Error('2D Canvas is unavailable');
    this.fallback=true;this.yaw=2.35619449;this.pitch=-0.61547971;this.roll=0;this.zoom=.94;this.diameter=1000;
    this.color='polishedsteel';this.customColor='#6f9bb8';this.finish='polished';this.surfaces=true;this.wire=false;this.points=null;this.pointers=new Map();this.dragAxes=new Map();this.lastDistance=0;this.queued=false;
    this.bind();
  }
  upload(points){
    this.points=points;this.sourcePositions=points;
    this.centre=window.__arusViewPivot.estimate(points,this.diameter);
    this.canvas.dataset.orbitPivot='shaft-axis';
    let radius=0;
    for(let i=0;i<points.length;i+=3)radius=Math.max(radius,Math.hypot(points[i]-this.centre[0],points[i+1]-this.centre[1],points[i+2]-this.centre[2]));
    this.radius=Math.max(1e-6,radius);this.fitToView();this.draw();
  }
  fitToView(){
    if(!this.points?.length)return;
    const rect=this.canvas.getBoundingClientRect();
    const aspect=Math.max(.1,rect.width/Math.max(1,rect.height));
    const radius=Math.max(1e-6,this.radius||this.diameter/2);
    this.fitSize=.78/(radius*Math.max(1,1/aspect));
    this.fitAspect=aspect;
    this.canvas.dataset.arusCameraFit='fixed-shaft-sphere';
  }
  project(x,y,z,w,h){
    const pivot=this.centre||[0,0,0],[right,up]=window.__arusCameraMath.fromPose(this.yaw,this.pitch,this.roll||0);
    x-=pivot[0];y-=pivot[1];z-=pivot[2];const k=h/2*(this.fitSize||.85/this.radius)*this.zoom;
    return [w/2+k*(x*right[0]+y*right[1]+z*right[2]),h/2-k*(x*up[0]+y*up[1]+z*up[2])];
  }
  fit(){this.yaw=2.35619449;this.pitch=-0.61547971;this.roll=0;this.zoom=.94;this.fitToView();this.draw()}
  request(){if(this.queued)return;this.queued=true;requestAnimationFrame(()=>{this.queued=false;this.draw()})}
  bind(){const c=this.canvas;
    c.addEventListener('pointerdown',e=>{try{c.setPointerCapture(e.pointerId)}catch(_){}this.pointers.set(e.pointerId,[e.clientX,e.clientY]);this.lastDistance=0});
    c.addEventListener('pointermove',e=>{
      if(!this.pointers.has(e.pointerId))return;
      const old=this.pointers.get(e.pointerId);
      if(this.pointers.size===1){window.__arusCameraMath.pointerOrbit(this,e,old,this.dragAxes);}
      this.pointers.set(e.pointerId,[e.clientX,e.clientY]);
      if(this.pointers.size>1){let pts=[...this.pointers.values()];let dist=Math.hypot(pts[0][0]-pts[1][0],pts[0][1]-pts[1][1]);if(this.lastDistance)this.zoom=Math.min(7,Math.max(.3,this.zoom*dist/this.lastDistance));this.lastDistance=dist;}
      this.request();
    });
    for(let kind of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(kind,e=>{this.pointers.delete(e.pointerId);this.dragAxes.delete(e.pointerId);this.lastDistance=0});
    c.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.min(7,Math.max(.3,this.zoom*(e.deltaY>0?.89:1.12)));this.request()},{passive:false});
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('dblclick',()=>this.fit());
    window.addEventListener('resize',()=>this.request());
  }
  draw(){
    const c=this.canvas,ctx=this.ctx,rect=c.getBoundingClientRect();
    if(rect.width<10||rect.height<10)return;
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
    if(c.width!==w||c.height!==h){c.width=w;c.height=h}
    ctx.clearRect(0,0,w,h);
    const pos=this.points;
    if(!pos||!pos.length||this.surfaces===false)return;
    const rollYaw=this.yaw,rollPitch=this.pitch,extraRoll=this.roll||0;const cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch);
    const aspect=w/h;
    if(!this.fitSize||Math.abs(aspect-this.fitAspect)>.01)this.fitToView();
    const k=h*(this.fitSize||.85/this.radius)*this.zoom/2,pivot=this.centre||[0,0,0];
    const [right,up,depth]=window.__arusCameraMath.fromPose(this.yaw,this.pitch,this.roll||0);
    function point(i){const x=pos[i]-pivot[0],y=pos[i+1]-pivot[1],z=pos[i+2]-pivot[2];return [w/2+k*(x*right[0]+y*right[1]+z*right[2]),h/2-k*(x*up[0]+y*up[1]+z*up[2]),x*depth[0]+y*depth[1]+z*depth[2]];}
    const all=[];
    for(let i=0;i<pos.length;i+=9){
      let a=point(i),b=point(i+3),c=point(i+6);
      if(!Number.isFinite(a[0]+b[0]+c[0]+a[1]+b[1]+c[1]))continue;
      let ux=pos[i+3]-pos[i],uy=pos[i+4]-pos[i+1],uz=pos[i+5]-pos[i+2];
      let vx=pos[i+6]-pos[i],vy=pos[i+7]-pos[i+1],vz=pos[i+8]-pos[i+2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,L=Math.hypot(nx,ny,nz)||1;
      const nxr=(nx*right[0]+ny*right[1]+nz*right[2])/L;
      const nyr=(nx*up[0]+ny*up[1]+nz*up[2])/L;
      const nzr=(nx*depth[0]+ny*depth[1]+nz*depth[2])/L;
      let brightness=.34+.66*Math.abs((nxr*.35+nyr*.58+nzr*.74)/Math.hypot(.35,.58,.74));
      let bucket=Math.min(31,Math.max(0,Math.round(brightness*31)));
      all.push([a,b,c,(a[2]+b[2]+c[2])/3,bucket]);
    }
    // Larger camera-space z is farther from the observer in the original orthographic shader.
    all.sort((a,b)=>b[3]-a[3]);
    const colors={steel:[160,185,195],polishedsteel:[160,185,195],stainless:[176,188,201],aluminium:[195,210,215],graphite:[89,108,120],arusblue:[39,101,166]};
    const base=this.color==='custom'?[1,3,5].map(i=>parseInt((this.customColor||'#6f9bb8').slice(i,i+2),16)):(colors[this.color]||colors.polishedsteel);
    const fills=Array.from({length:32},(_,k)=>{const brightness=k/31;let f=.88*brightness+.10;return 'rgb('+base.map(v=>Math.max(0,Math.min(255,Math.round(v*f)))).join(',')+')'});
    for(let i=0;i<all.length;i++){
      let [a,b,c,z,shade]=all[i];ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();
      ctx.fillStyle=fills[shade];ctx.fill();
      if(this.wire && i%5===0){ctx.strokeStyle='#334e64';ctx.lineWidth=.45*dpr;ctx.stroke()}
    }
  }
}
window.PGCanvasFallback=CanvasFallbackView;

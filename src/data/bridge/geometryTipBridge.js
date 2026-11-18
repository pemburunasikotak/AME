/* Shape-preserving VIEW interpolation only. Native sections, kernel and exports are untouched. */
(() => {
  const slopes = (x,y) => {
    const n=x.length,h=x.slice(1).map((v,i)=>v-x[i]),d=h.map((v,i)=>(y[i+1]-y[i])/v),m=new Array(n).fill(0);
    if(n===2)return [d[0],d[0]];
    for(let i=1;i<n-1;i++)if(d[i-1]*d[i]>0){const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];m[i]=(a+b)/(a/d[i-1]+b/d[i]);}
    const end=(a,b,u,v)=>{let s=((2*a+b)*u-a*v)/(a+b);if(s*u<=0)s=0;else if(u*v<0&&Math.abs(s)>3*Math.abs(u))s=3*u;return s;};
    m[0]=end(h[0],h[1],d[0],d[1]);m[n-1]=end(h[n-2],h[n-3],d[n-2],d[n-3]);return m;
  };
  const interpolate = (x,y,m,r) => {
    let i=0;while(i<x.length-2&&r>x[i+1])i++;
    const h=x[i+1]-x[i],t=Math.max(0,Math.min(1,(r-x[i])/h)),t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*y[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*y[i+1]+(t3-t2)*h*m[i+1];
  };
  function refine(points,{stations,diameter,smooth}={}){
    const unchanged=reason=>({points,stats:{active:false,reason,movedVertices:0,maxDisplacement:0,sourceStationDelta:0}});
    if(!smooth||!stations||stations.length<4)return unchanged('source-mesh');
    const R=diameter/2,tolerance=Math.max(1e-5,R*1e-6),r=stations.map(v=>v*R);
    if(r.some((v,i)=>!Number.isFinite(v)||(i&&v<=r[i-1])))return unchanged('unsupported-stations');
    let join=r.findIndex(v=>v>=R*.9-tolerance);if(join<1||join>r.length-3)join=Math.max(1,r.length-4);
    const first=Math.max(0,join-1),anchors=r.slice(first),radii=[];
    // The native smooth mesh uses four radial intervals per source interval.
    for(let i=first;i<r.length-1;i++)for(let j=0;j<4;j++)radii.push(r[i]+(r[i+1]-r[i])*j/4);
    radii.push(r.at(-1));
    const rings=radii.map(()=>({nodes:[],map:new Map()})),membership=new Int32Array(points.length/3).fill(-1),columns=new Int32Array(points.length/3);
    for(let i=0;i<points.length;i+=3){
      const radius=Math.hypot(points[i+1],points[i+2]);if(radius<r[first]-tolerance)continue;
      let ring=0;for(let j=1;j<radii.length;j++)if(Math.abs(radii[j]-radius)<Math.abs(radii[ring]-radius))ring=j;
      if(Math.abs(radii[ring]-radius)>tolerance)continue; // Retain hub/fillet triangles.
      const group=rings[ring],key=`${points[i]},${points[i+1]},${points[i+2]}`;
      if(!group.map.has(key)){group.map.set(key,group.nodes.length);group.nodes.push([points[i],points[i+1],points[i+2]]);}
      membership[i/3]=ring;columns[i/3]=group.map.get(key);
    }
    const width=rings[0].nodes.length;
    if(!width||rings.some(v=>v.nodes.length!==width))return unchanged('nonuniform-native-topology');
    const sourceRings=rings.filter((_,i)=>i%4===0),curves=[];
    for(let col=0;col<width;col++){
      const axial=sourceRings.map(v=>v.nodes[col][0]),theta=sourceRings.map(v=>Math.atan2(v.nodes[col][2],v.nodes[col][1]));
      for(let i=1;i<theta.length;i++){while(theta[i]-theta[i-1]>Math.PI)theta[i]-=2*Math.PI;while(theta[i]-theta[i-1]<-Math.PI)theta[i]+=2*Math.PI;}
      // Reject any topology ordering ambiguity rather than inventing a surface.
      if(theta.some((v,i)=>i&&Math.abs(v-theta[i-1])>Math.PI/2))return unchanged('ambiguous-native-topology');
      curves.push({axial,theta,ma:slopes(anchors,axial),mt:slopes(anchors,theta)});
    }
    const display=points.slice();let movedVertices=0,maxDisplacement=0;
    for(let i=0;i<points.length;i+=3){
      const ring=membership[i/3];if(ring<0||ring%4===0||radii[ring]<=r[join]+tolerance)continue;
      const c=curves[columns[i/3]],radius=radii[ring],x=interpolate(anchors,c.axial,c.ma,radius),angle=interpolate(anchors,c.theta,c.mt,radius),p=[x,radius*Math.cos(angle),radius*Math.sin(angle)];
      if(!p.every(Number.isFinite))return unchanged('nonfinite-preview');
      display.set(p,i);const delta=Math.hypot(...p.map((v,k)=>v-points[i+k]));maxDisplacement=Math.max(maxDisplacement,delta);if(delta>tolerance)movedVertices++;
    }
    if(maxDisplacement>diameter*.01)return unchanged('preview-displacement-limit');
    // All original section rings (including the tip) are retained byte-for-byte.
    return {points:display,stats:{active:true,joinRadius:r[join],movedVertices,maxDisplacement,sourceStationDelta:0,sourceVertices:points.length/3}};
  }
  window.ARUS_GEOMETRY_TIP={refine,slopes,interpolate};
})();

/* Display-only tip preview, normals and camera fitting; native mesh/exports are retained. */
(() => {
  if (document.documentElement.dataset.arusModule !== 'geometry' || document.getElementById('arus-inventor-nav-style')) return;
  document.addEventListener('DOMContentLoaded', () => {
    const View = window.PG?.View3D;
    if (!View) return;
    const originalProgram = View.prototype.program;
    // Screen zoom must not move triangles through the near/far clipping planes.
    View.prototype.program = function () {
      const compile = this.compile;
      this.compile = function (type, text) {
        if (type === this.gl.VERTEX_SHADER) text = text.replace('uniform float yaw;', 'uniform vec3 centre; uniform float depthScale; uniform float yaw;').replace('vec3 p=position;', 'vec3 p=position-centre;').replace('d*size,1.0', 'd*depthScale,1.0');
        return compile.call(this, type, text);
      };
      try { return originalProgram.call(this); } finally { this.compile = compile; }
    };
    const originalSetup = View.prototype.setup;
    View.prototype.setup = function () {
      originalSetup.call(this);
      this.loc.centre = this.gl.getUniformLocation(this.prog, 'centre');
      this.loc.depthScale = this.gl.getUniformLocation(this.prog, 'depthScale');
      this.canvas.__arusViewer = this;
    };
    View.prototype.upload = function (sourcePoints, options) {
      if(options)this.previewOptions=options;
      this.sourcePositions=sourcePoints;
      const preview=window.ARUS_GEOMETRY_TIP.refine(sourcePoints,{...this.previewOptions,smooth:this.previewOptions?.smooth&&window.__arusTipPreview!==false});
      const points=preview.points;
      this.displayPositions=points;this.tipPreviewStats=preview.stats;
      const note=document.getElementById('arus-tip-note'),toggle=document.getElementById('arus-tip-preview');
      if(toggle)toggle.disabled=!this.previewOptions?.smooth;
      if(note)note.textContent=(preview.stats.active?'Smoothed tip preview':window.__arusTipPreview!==false&&this.previewOptions?.smooth?'Source mesh preview (tip smoothing unavailable for this topology)':'Source mesh preview')+'; original section data and CAD exports are unchanged.';
      const count = points.length / 3, triangles = points.length / 9;
      this.vertices = count;
      this.wireVertices = triangles * 6;
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      const weld = Math.max(1e-6, this.diameter * 1e-7), groups = new Map(), cornerGroups = [], normals = new Float32Array(points.length), angles = new Float32Array(count);
      for (let i = 0; i < points.length; i += 3) {
        const key = [0, 1, 2].map(k => Math.round(points[i+k] / weld)).join(',');
        if (!groups.has(key)) groups.set(key, []);
        const group = groups.get(key); group.push(i / 3); cornerGroups.push(group);
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], points[i+k]); max[k] = Math.max(max[k], points[i+k]); }
      }
      this.centre = min.map((v, k) => (v + max[k]) / 2);
      let radius = 0;
      for (let i = 0; i < points.length; i += 3) radius = Math.max(radius, Math.hypot(...this.centre.map((v,k) => points[i+k]-v)));
      this.radius = Math.max(1e-6, radius);
      this.fitToView();
      for (let i = 0; i < points.length; i += 9) {
        const a = Array.from(points.subarray(i,i+3)), b = Array.from(points.subarray(i+3,i+6)), c = Array.from(points.subarray(i+6,i+9));
        const u = b.map((v,k)=>v-a[k]), v = c.map((v,k)=>v-a[k]);
        const cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], length = Math.hypot(...cross);
        const normal = length > 1e-16 ? cross.map(x=>x/length) : [0,0,0];
        [a,b,c].forEach((p,j,all) => {
          normals.set(normal,i+3*j);
          const e = all[(j+1)%3].map((x,k)=>x-p[k]), f = all[(j+2)%3].map((x,k)=>x-p[k]);
          const den = Math.hypot(...e)*Math.hypot(...f);
          angles[i/3+j] = den > 1e-16 ? Math.acos(Math.max(-1,Math.min(1,e.reduce((s,x,k)=>s+x*f[k],0)/den))) : 0;
        });
      }
      const inter = new Float32Array(count * 6), wires = new Float32Array(triangles * 36);
      for (let i = 0; i < count; i++) {
        const p = i*3, normal = normals.subarray(p,p+3), sum = [0,0,0];
        // A crease threshold keeps the trailing edge sharp while smoothing surface tessellation.
        for (const j of cornerGroups[i]) {
          const q = j*3, dot = normal[0]*normals[q]+normal[1]*normals[q+1]+normal[2]*normals[q+2];
          if (dot < .45) continue;
          for (let k=0;k<3;k++) sum[k] += normals[q+k]*angles[j];
        }
        const length = Math.hypot(...sum);
        inter.set([points[p],points[p+1],points[p+2],...sum.map((x,k)=>length>1e-12?x/length:normal[k])],i*6);
      }
      let w = 0;
      for (let i=0;i<count;i+=3) for(let j=0;j<3;j++) {
        wires.set(inter.subarray((i+j)*6,(i+j+1)*6),w);w+=6;
        const next=i+(j+1)%3;wires.set(inter.subarray(next*6,(next+1)*6),w);w+=6;
      }
      const gl=this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);gl.bufferData(gl.ARRAY_BUFFER,inter,gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.wireBuf);gl.bufferData(gl.ARRAY_BUFFER,wires,gl.STATIC_DRAW);
      this.canvas.dataset.surfaceShading='smooth-normals';
      this.canvas.dataset.tipPreview=preview.stats.active?'shape-preserving':'source';
      this.draw();
    };
    View.prototype.fitToView = function () {
      const points=this.sourcePositions;if(!points?.length)return;
      const rect=this.canvas.getBoundingClientRect(),aspect=Math.max(.1,rect.width/Math.max(1,rect.height));
      const cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch);let horizontal=0,vertical=0;
      for(let i=0;i<points.length;i+=3){const x=points[i]-this.centre[0],y=points[i+1]-this.centre[1],z=points[i+2]-this.centre[2];horizontal=Math.max(horizontal,Math.abs(y*cy+z*sy));vertical=Math.max(vertical,Math.abs(x*cp-(-y*sy+z*cy)*sp));}
      this.fitSize=.84/Math.max(1e-6,vertical,horizontal/aspect);this.fitAspect=aspect;
    };
    View.prototype.fit = function () {this.yaw=-.54;this.pitch=.36;this.zoom=1;this.fitToView();this.draw();};
    View.prototype.project = function (x,y,z,w,h) {
      const centre=this.centre||[0,0,0];x-=centre[0];y-=centre[1];z-=centre[2];
      const cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),aspect=w/h;
      const size=(this.fitSize||.86/(this.radius||this.diameter/2)*Math.min(1,aspect))*this.zoom,hor=y*cy+z*sy,b=-y*sy+z*cy;
      return [w/2+hor*size*w/(2*aspect),h/2-(x*cp-b*sp)*size*h/2];
    };
    View.prototype.draw = function () {
      const gl=this.gl,c=this.canvas,rect=c.getBoundingClientRect();if(rect.width<10||rect.height<10)return;
      const dpr=Math.min(2.5,Math.max(1.5,devicePixelRatio||1)),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
      if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
      gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.vertices)return;
      const L=this.loc,aspect=w/h;if(!this.fitSize||Math.abs(aspect-this.fitAspect)>.01)this.fitToView();gl.useProgram(this.prog);gl.uniform3fv(L.centre,this.centre||[0,0,0]);
      gl.uniform1f(L.yaw,this.yaw);gl.uniform1f(L.pitch,this.pitch);gl.uniform1f(L.size,(this.fitSize||.86/(this.radius||this.diameter/2))*this.zoom);gl.uniform1f(L.depthScale,.9/(this.radius||this.diameter/2));gl.uniform1f(L.aspect,aspect);gl.uniform1f(L.opacity,1);
      const colors={steel:[.64,.73,.78],polishedsteel:[.64,.73,.78],stainless:[.69,.74,.79],aluminium:[.77,.82,.83],graphite:[.28,.35,.40],arusblue:[.15,.40,.69]};
      let col=colors[this.color]||colors.polishedsteel;if(this.color==='custom')col=[1,3,5].map(k=>parseInt((this.customColor||'#6f9bb8').slice(k,k+2),16)/255);
      const finish={polished:1.10,satin:.92,matte:.79}[this.finish]||1;gl.uniform3fv(L.tint,col.map(x=>Math.min(1,x*finish)));
      if(this.surfaces!==false)this.drawBuf(this.buf,this.vertices,gl.TRIANGLES);
      if(this.wire){gl.uniform3fv(L.tint,[.12,.18,.24]);gl.disable(gl.DEPTH_TEST);this.drawBuf(this.wireBuf,this.wireVertices,gl.LINES);gl.enable(gl.DEPTH_TEST);}
      window.dispatchEvent(new Event('arus-geometry-view-changed'));
    };
    // A reversible preview toggle makes the source/display distinction explicit.
    const surface=document.getElementById('surfaceBtn');
    if(surface){
      const button=document.createElement('button');button.id='arus-tip-preview';button.textContent='Smooth tip preview';button.type='button';button.className='selected';button.setAttribute('aria-pressed','true');
      surface.after(button);
      const note=document.createElement('p');note.id='arus-tip-note';note.textContent='Smoothed tip preview; original section data and CAD exports are unchanged.';note.style.cssText='font:12px Arial,sans-serif;color:#526b7d;margin:8px 0';surface.parentElement.after(note);
      button.addEventListener('click',()=>{window.__arusTipPreview=window.__arusTipPreview===false;button.classList.toggle('selected',window.__arusTipPreview);button.setAttribute('aria-pressed',String(window.__arusTipPreview));for(const canvas of document.querySelectorAll('canvas')){const viewer=canvas.__arusViewer;if(viewer?.sourcePositions)viewer.upload(viewer.sourcePositions);}});
    }
  });
})();

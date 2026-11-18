'use strict';
/* Compiled C kernel from the original Windows v0.6.0 source, running in WebAssembly.
   ALL final station values and 3D meshes come from the original C engine. */
class PropellerEngine {
  constructor(){this.api=null;this.memory=null;this.triangles=0;}
  async init(){
    if(typeof WebAssembly==='undefined')throw Error('Android WebView does not support WebAssembly');
    let memory=null;
    const imports={env:{
      memcpy:(dst,src,n)=>{new Uint8Array(memory.buffer).copyWithin(dst,src,src+n);return dst},
      memset:(dst,c,n)=>{new Uint8Array(memory.buffer).fill(c&255,dst,dst+n);return dst},
      fabs:Math.abs,tan:Math.tan,atan:Math.atan,cos:Math.cos,sin:Math.sin,sqrt:Math.sqrt
    }};
    const bin=atob(window.PG_WASM_BASE64);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const wasm=await WebAssembly.instantiate(bytes,imports);
    this.api=wasm.instance.exports;
    memory=this.api.memory;this.memory=memory;
    this.api.pg_reset();return this;
  }
  cfg(i,v){this.api.pg_cfg(Number(i),Number(v));}
  mod(i,v){this.api.pg_mod(Number(i),Number(v));}
  generate(smooth=true,full=true){this.triangles=this.api.pg_generate(smooth?1:0,full?1:0);return this.triangles;}
  station(row,col){return this.api.pg_station(row,col);}
  offset(side,row,col,dimension){return this.api.pg_offset(side,row,col,dimension);}
  rows(){return this.api.pg_nstations();}
  metric(i){return this.api.pg_metric(i);}
  insert(rr){return this.api.pg_add_station(rr);}
  remove(row){return this.api.pg_remove_station(row);}
  auto(row){return this.api.pg_auto_station(row);}
  setStation(row,col,value){return this.api.pg_set_station(row,col,value);}
  reset(){this.api.pg_reset();}
  positions(){
    if(this.triangles<=0)return new Float32Array(0);
    let n=this.triangles,off=this.api.pg_mesh_pointer(),raw=new Float64Array(this.memory.buffer,off,n*9);
    let p=new Float32Array(n*9);
    for(let i=0;i<p.length;i++)p[i]=raw[i];
    return p;
  }
}
class View3D {
  constructor(canvas){
    this.canvas=canvas;this.gl=canvas.getContext('webgl',{antialias:true,alpha:true,depth:true,preserveDrawingBuffer:true})||canvas.getContext('experimental-webgl',{antialias:true,alpha:true,depth:true,preserveDrawingBuffer:true});
    this.yaw=2.35619449;this.pitch=-0.61547971;this.roll=0;this.zoom=.94;this.diameter=1000;this.color='polishedsteel';this.customColor='#6f9bb8';this.finish='polished';this.surfaces=true;this.wire=false;
    this.vertices=0;this.mesh=null;this.wireMesh=null;this.active=new Map();this.dragAxes=new Map();this.lastDistance=0;
    if(!this.gl)throw Error('WebGL unavailable. This device can still display outlines, sections, and numerical tables.');
    this.setup();this.bind();
  }
  compile(type,src){let gl=this.gl,s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  program(){let gl=this.gl;
    const vs=`attribute vec3 position; attribute vec3 normal; uniform float yaw;uniform float pitch;uniform float roll;uniform float size;uniform float aspect;varying float vLight;
      void main(){float cy=cos(yaw),sy=sin(yaw),cp=cos(pitch),sp=sin(pitch);
      vec3 p=position;float h=p.y*cy+p.z*sy;float b=-p.y*sy+p.z*cy;float v=p.x*cp-b*sp;float d=p.x*sp+b*cp;
      gl_Position=vec4((h*cos(roll)-v*sin(roll))*size/aspect,(h*sin(roll)+v*cos(roll))*size,d*size,1.0);
      vec3 n=normal;float hn=n.y*cy+n.z*sy;float bn=-n.y*sy+n.z*cy;float vn=n.x*cp-bn*sp;vec3 nn=normalize(vec3(hn*cos(roll)-vn*sin(roll),hn*sin(roll)+vn*cos(roll),n.x*sp+bn*cp));
      vLight=0.34+0.66*abs(dot(nn,normalize(vec3(0.35,0.58,0.74))));}`;
    const fs=`precision mediump float; uniform vec3 tint; uniform float opacity; varying float vLight; void main(){gl_FragColor=vec4(tint*(0.88*vLight+0.10),opacity);}`;
    let prog=gl.createProgram();gl.attachShader(prog,this.compile(gl.VERTEX_SHADER,vs));gl.attachShader(prog,this.compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));return prog;
  }
  setup(){let gl=this.gl;this.prog=this.program();this.loc={pos:gl.getAttribLocation(this.prog,'position'),normal:gl.getAttribLocation(this.prog,'normal'),yaw:gl.getUniformLocation(this.prog,'yaw'),pitch:gl.getUniformLocation(this.prog,'pitch'),roll:gl.getUniformLocation(this.prog,'roll'),size:gl.getUniformLocation(this.prog,'size'),aspect:gl.getUniformLocation(this.prog,'aspect'),tint:gl.getUniformLocation(this.prog,'tint'),opacity:gl.getUniformLocation(this.prog,'opacity')};this.buf=gl.createBuffer();this.wireBuf=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);}
  upload(points){let n=points.length/9;this.vertices=n*3;let inter=new Float32Array(n*3*6);let wires=new Float32Array(n*6*6);
    let ei=0,wi=0;
    for(let i=0;i<points.length;i+=9){
      const ax=points[i],ay=points[i+1],az=points[i+2],bx=points[i+3],by=points[i+4],bz=points[i+5],cx=points[i+6],cy=points[i+7],cz=points[i+8];
      const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,L=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;nx/=L;ny/=L;nz/=L;
      let p=[[ax,ay,az],[bx,by,bz],[cx,cy,cz]];
      for(let j=0;j<3;j++){let a=p[j];inter.set([a[0],a[1],a[2],nx,ny,nz],ei);ei+=6;}
      for(let j=0;j<3;j++){let a=p[j],b=p[(j+1)%3];wires.set([a[0],a[1],a[2],nx,ny,nz,b[0],b[1],b[2],nx,ny,nz],wi);wi+=12;}
    }
    this.wireVertices=n*6;
    let gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buf);gl.bufferData(gl.ARRAY_BUFFER,inter,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,this.wireBuf);gl.bufferData(gl.ARRAY_BUFFER,wires,gl.STATIC_DRAW);this.draw();
  }
  fit(){this.yaw=2.35619449;this.pitch=-0.61547971;this.roll=0;this.zoom=.94;this.draw();}
  bind(){let c=this.canvas;
    c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);this.active.set(e.pointerId,[e.clientX,e.clientY]);});
    c.addEventListener('pointermove',e=>{
      if(!this.active.has(e.pointerId))return;let old=this.active.get(e.pointerId);
      if(this.active.size===1){window.__arusCameraMath.pointerOrbit(this,e,old,this.dragAxes);}
      else{let points=[...this.active.values()];let a=points[0],b=points[1];if(points.length>1&&this.lastDistance){let dist=Math.hypot(a[0]-b[0],a[1]-b[1]);this.zoom=Math.min(7,Math.max(.3,this.zoom*dist/this.lastDistance));}}
      this.active.set(e.pointerId,[e.clientX,e.clientY]);this.lastDistance=this.active.size>1?Math.hypot(this.active.values().next().value[0]-Array.from(this.active.values())[1][0],this.active.values().next().value[1]-Array.from(this.active.values())[1][1]):0;
      this.draw();
    });
    for(let name of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(name,e=>{this.active.delete(e.pointerId);this.dragAxes.delete(e.pointerId);this.lastDistance=0;});
    c.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.min(7,Math.max(.3,this.zoom*(e.deltaY>0?.89:1.12)));this.draw();},{passive:false});
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('dblclick',()=>this.fit());
    window.addEventListener('resize',()=>this.draw());
  }
  draw(){let gl=this.gl,c=this.canvas,rect=c.getBoundingClientRect(),w=Math.max(100,Math.floor(rect.width*Math.min(devicePixelRatio||1,2))),h=Math.max(100,Math.floor(rect.height*Math.min(devicePixelRatio||1,2)));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.vertices)return;
    gl.useProgram(this.prog);let L=this.loc;gl.uniform1f(L.yaw,this.yaw);gl.uniform1f(L.pitch,this.pitch);gl.uniform1f(L.roll,window.__arusCameraMath.totalRoll(this.yaw,this.pitch,this.roll||0));gl.uniform1f(L.size,1.57*this.zoom/this.diameter*Math.min(1,w/h));gl.uniform1f(L.aspect,w/h);gl.uniform1f(L.opacity,1);
    let colors={steel:[.64,.73,.78],polishedsteel:[.64,.73,.78],stainless:[.69,.74,.79],aluminium:[.77,.82,.83],graphite:[.28,.35,.40],arusblue:[.15,.40,.69]};let col=colors[this.color]||colors.polishedsteel;if(this.color==='custom'){let v=this.customColor||'#6f9bb8';col=[1,3,5].map(k=>parseInt(v.slice(k,k+2),16)/255);}let finishFactor={polished:1.10,satin:.92,matte:.79}[this.finish]||1;col=col.map(x=>Math.min(1,x*finishFactor));
    gl.uniform3fv(L.tint,col);if(this.surfaces!==false)this.drawBuf(this.buf,this.vertices,gl.TRIANGLES);
    if(this.wire){gl.uniform3fv(L.tint,[.12,.18,.24]);gl.uniform1f(L.opacity,1);gl.disable(gl.DEPTH_TEST);this.drawBuf(this.wireBuf,this.wireVertices,gl.LINES);gl.enable(gl.DEPTH_TEST);}
  }
  drawBuf(buf,n,mode){let gl=this.gl,L=this.loc;gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.enableVertexAttribArray(L.pos);gl.enableVertexAttribArray(L.normal);gl.vertexAttribPointer(L.pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(L.normal,3,gl.FLOAT,false,24,12);gl.drawArrays(mode,0,n);}
}
window.PG={PropellerEngine,View3D};

/* ARUS viewer v144. A single orthonormal camera basis for unrestricted six-face
   screen-space orbit. The original CAD mesh/kernel is not modified.
   The viewer, ViewCube and XYZ continue to share its yaw/pitch/roll projection. */
window.__arusViewPivot = {
  estimate(positions,diameter){
    if(!positions?.length)return [0,0,0];
    let minR=Infinity;
    for(let i=0;i<positions.length;i+=3){
      const r=Math.hypot(positions[i+1],positions[i+2]);
      if(Number.isFinite(r)&&r<minR)minR=r;
    }
    // The root/hub zone is derived from the actual mesh; no imaginary hub geometry.
    const threshold=minR+Math.max(2,Number(diameter||1000)*.028);
    let xlo=Infinity,xhi=-Infinity;
    for(let i=0;i<positions.length;i+=3){
      if(Math.hypot(positions[i+1],positions[i+2])>threshold)continue;
      const x=positions[i]; if(Number.isFinite(x)){xlo=Math.min(xlo,x);xhi=Math.max(xhi,x);}
    }
    if(!Number.isFinite(xlo)||!Number.isFinite(xhi))return [0,0,0];
    return [(xlo+xhi)/2,0,0];
  }
};
window.__arusCameraMath = (()=>{
  const PI=Math.PI;
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const horizon=(yaw,pitch)=>{
    const y=Math.sin(yaw),p=-Math.cos(yaw)*Math.sin(pitch);
    return Math.hypot(y,p)>1e-7?Math.atan2(y,p):0;
  };
  const totalRoll=(yaw,pitch,roll=0)=>horizon(yaw,pitch)+roll;
  function fromPose(yaw,pitch,roll=0){
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const t=totalRoll(yaw,pitch,roll),cr=Math.cos(t),sr=Math.sin(t);
    const h=[0,cy,sy],v=[cp,sy*sp,-cy*sp],d=[sp,-sy*cp,cy*cp];
    return [h.map((x,i)=>x*cr-v[i]*sr),h.map((x,i)=>x*sr+v[i]*cr),d];
  }
  function toPose(rows,oldYaw=0){
    const [right,up,depth]=rows;
    // This parameterization covers all orientations. At the two poles, yaw
    // is underdetermined; hold its previous value while solving the roll.
    const pitch=Math.asin(Math.max(-1,Math.min(1,depth[0])));
    const cp=Math.hypot(depth[1],depth[2]);
    const yaw=cp>1e-8?Math.atan2(-depth[1],depth[2]):oldYaw;
    const cy=Math.cos(yaw),sy=Math.sin(yaw),c=Math.cos(pitch),sp=Math.sin(pitch);
    const h=[0,cy,sy],v=[c,sy*sp,-cy*sp];
    const t=Math.atan2(-dot(right,v),dot(right,h));
    const roll=t-horizon(yaw,pitch);
    return {yaw,pitch,roll};
  }
  // PropCad-style mouse-follow orbit, while retaining Inventor ViewCube.
  // Both drag components are applied SIMULTANEOUSLY as one 3D axis-angle
  // rotation about the current view-plane axes. There is no predominant-axis
  // lock, no pole clamp, and no order-dependent yaw-then-pitch operation.
  // The visible (camera-facing) point moves in the same screen direction as
  // the pointer. The same resulting basis controls mesh, cube, and axis triad.
  const SENSITIVITY = 0.008;
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function screenOrbit(rows,dx,dy){
    if(!Number.isFinite(dx)||!Number.isFinite(dy)||(dx===0&&dy===0))return rows;
    // Camera basis: rows=[screen-right,screen-up,depth]. Visible points
    // have NEGATIVE depth (as confirmed by the GPU/CAD projection).
    const [right,up]=rows;
    const a=-dy*SENSITIVITY, b=-dx*SENSITIVITY;
    const theta=Math.hypot(a,b);
    const axis=right.map((v,i)=>(a*v+b*up[i])/theta);
    const c=Math.cos(theta),t=Math.sin(theta),oneMinusC=1-c;
    function rotate(v){
      const kcross=cross(axis,v),kdot=dot(axis,v);
      return v.map((x,i)=>c*x+t*kcross[i]+oneMinusC*kdot*axis[i]);
    }
    return rows.map(rotate);
  }
  function screenRoll(rows,amount){
    const [r,u,d]=rows,ca=Math.cos(amount),sa=Math.sin(amount);
    return [r.map((x,i)=>ca*x-sa*u[i]),u.map((x,i)=>sa*r[i]+ca*x),d];
  }
  function update(obj,rows){
    const pose=toPose(rows,obj.yaw);
    obj.yaw=pose.yaw;obj.pitch=pose.pitch;obj.roll=pose.roll;
  }
  function orbit(obj,dx,dy){update(obj,screenOrbit(fromPose(obj.yaw,obj.pitch,obj.roll||0),dx,dy));}
  function orbitRoll(obj,dx,dy){update(obj,screenRoll(fromPose(obj.yaw,obj.pitch,obj.roll||0),dx*.012+dy*.004));}
  // Reset the v140 gesture-axis lock: orbit follows *both* pointer deltas
  // on EVERY event. Shift/secondary drag is an explicit roll gesture.
  function pointerOrbit(view,event,previous,_obsoleteAxisState){
    const dx=event.clientX-previous[0],dy=event.clientY-previous[1];
    if(event.shiftKey || (event.buttons&2))orbitRoll(view,dx,dy);
    else orbit(view,dx,dy);
  }
  return {horizon,totalRoll,fromPose,toPose,screenOrbit,screenRoll,orbit,orbitRoll,pointerOrbit};
})();

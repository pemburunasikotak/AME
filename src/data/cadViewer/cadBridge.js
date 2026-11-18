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
  if (document.documentElement.dataset.arusModule !== 'geometry') return;
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
      // Orbit around the actual root/shaft centreline, not a skewed blade bounding box.
      this.centre = window.__arusViewPivot.estimate(points,this.diameter);
      this.canvas.dataset.orbitPivot = 'shaft-axis';
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
      // An orbit must NEVER change the model's apparent size.
      // One pivot-based bounding sphere and one aspect rule apply to GPU and Canvas.
      const rect=this.canvas.getBoundingClientRect();
      const aspect=Math.max(.1,rect.width/Math.max(1,rect.height));
      const radius=Math.max(1e-6,this.radius||this.diameter/2);
      this.fitSize=.78/(radius*Math.max(1,1/aspect));
      this.fitAspect=aspect;
      this.canvas.dataset.arusCameraFit='fixed-shaft-sphere';
    };
    View.prototype.fit = function () {this.yaw=2.35619449;this.pitch=-0.61547971;this.roll=0;this.zoom=.94;this.fitToView();this.draw();};
    View.prototype.project = function (x,y,z,w,h) {
      const pivot=this.centre||[0,0,0];x-=pivot[0];y-=pivot[1];z-=pivot[2];
      const [r,u]=window.__arusCameraMath.fromPose(this.yaw,this.pitch,this.roll||0);
      const hor=x*r[0]+y*r[1]+z*r[2],vert=x*u[0]+y*u[1]+z*u[2];
      const aspect=w/Math.max(1,h),size=(this.fitSize||.85/(this.radius||this.diameter/2))*this.zoom;
      return [w/2+hor*size*w/(2*aspect),h/2-vert*size*h/2];
    };
    View.prototype.draw = function () {
      const gl=this.gl,c=this.canvas,rect=c.getBoundingClientRect();if(rect.width<10||rect.height<10)return;
      const dpr=Math.min(2.5,Math.max(1.5,devicePixelRatio||1)),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);
      if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
      gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.vertices)return;
      const L=this.loc,aspect=w/h;if(!this.fitSize||Math.abs(aspect-this.fitAspect)>.01)this.fitToView();gl.useProgram(this.prog);gl.uniform3fv(L.centre,this.centre||[0,0,0]);
      gl.uniform1f(L.yaw,this.y);gl.uniform1f(L.pitch,this.pitch);gl.uniform1f(L.roll,window.__arusCameraMath.totalRoll(this.yaw,this.pitch,this.roll||0));gl.uniform1f(L.size,(this.fitSize||.86/(this.radius||this.diameter/2))*this.zoom);gl.uniform1f(L.depthScale,.9/(this.radius||this.diameter/2));gl.uniform1f(L.aspect,aspect);gl.uniform1f(L.opacity,1);
      const colors={steel:[.64,.73,.78],polishedsteel:[.64,.73,.78],stainless:[.69,.74,.79],aluminium:[.77,.82,.83],graphite:[.28,.35,.40],arusblue:[.15,.40,.69]};
      let col=colors[this.color]||colors.polishedsteel;if(this.color==='custom')col=[1,3,5].map(k=>parseInt((this.customColor||'#6f9bb8').slice(k,k+2),16)/255);
      const finish={polished:1.10,satin:.92,matte:.79}[this.finish]||1;gl.uniform3fv(L.tint,col.map(x=>Math.min(1,x*finish)));
      if(this.surfaces!==false)this.drawBuf(this.buf,this.vertices,gl.TRIANGLES);
      if(this.wire){gl.uniform3fv(L.tint,[.12,.18,.24]);gl.disable(gl.DEPTH_TEST);this.drawBuf(this.wireBuf,this.wireVertices,gl.LINES);gl.enable(gl.DEPTH_TEST);}
      // v145: check a completed GPU frame before the browser may discard it;
      // two failures are required to switch to the verified 2D renderer.
      window.__arusMonitorGpuFrame?.(this);
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

/* Presentation-only bridge. It leaves calculator inputs, formulas, data, and outputs untouched. */
(() => {
  'use strict';
  const moduleId = document.documentElement.dataset.arusModule;
  const send = (type, detail = {}) => parent.postMessage({ channel: 'arus-offline-studio', moduleId, type, ...detail }, '*');
  window.addEventListener('error', event => send('error', { message: event.message || 'Calculator error' }));
  window.addEventListener('unhandledrejection', event => send('error', { message: event.reason?.message || String(event.reason) }));

  const translations = [
    ['Total metode', 'Method count'],
    ['Kelompok berdasarkan input identik.', 'Methods grouped by shared inputs.'],
    ['Semua persamaan di dalam kelompok menggunakan parameter numerik yang sama, tetapi belum tentu cocok untuk jenis kapal dan kondisi operasi yang sama. Pemeriksaan domain diberikan per metode.', 'Methods in a group share numerical inputs. Check each method domain for the vessel and operating conditions.'],
    ['Metode wake fraction dan thrust deduction tetap dipisahkan.', 'Choose wake fraction or thrust deduction.'],
    ['Kelompok gabungan menghitung semua varian atau metode yang mempunyai parameter persis sama.', 'Grouped methods calculate all variants that use the same inputs.'],
    ['Metode digabung hanya jika himpunan parameter input numeriknya sama persis. Varian tiap metode tetap dihitung secara terpisah.', 'Methods are grouped only when their input parameters match. Each method and variant is calculated separately.'],
    ['Metode ini memerlukan kombinasi input tersendiri dan tetap dapat dihitung langsung.', 'This method uses its own input group and can be calculated directly.'],
    ['Input yang memiliki kode sama dipakai bersama antarkelompok dan antarmodul. Tidak ada nilai yang diisi otomatis selain melalui tombol contoh.', 'Matching inputs are shared across groups and modules. Use Load Example Values to fill a sample case.'],
    ['Hasil berubah secara otomatis setelah nilai parameter diperbarui.', 'Results update automatically when you change an input.'],
    ['Formula asli, logika status, dan metadata audit dari ARUS v2.5 dipertahankan tanpa perubahan.', 'Use method-specific limits and warnings when interpreting these results.'],
    ['berarti rumus dapat dievaluasi, bukan sertifikasi kesesuaian domain empiris. Nilai di luar rentang umum 0 ≤ w,t < 1 atau di luar batas terverifikasi ditandai untuk ditinjau. Rumus Excel tidak ditampilkan.', 'means the equation can be evaluated. It does not certify method applicability. Values outside 0 ≤ w,t < 1 or verified limits require review.'],
    ['Metode gabungan — input identik', 'Grouped methods — shared inputs'],
    ['Metode individual — input khusus', 'Individual methods — dedicated inputs'],
    ['Kelompok metode / kombinasi parameter', 'Method group / input combination'],
    ['Menggunakan satu input bersama', 'Using shared inputs'],
    ['Satu metode khusus', 'Dedicated method'],
    ['Kelompok metode', 'Method group'],
    ['Jenis perhitungan', 'Calculation type'],
    ['Estimasi penurunan kecepatan aliran', 'Estimate the reduction in inflow speed'],
    ['Koefisien interaksi gaya dorong', 'Thrust interaction coefficient'],
    ['Numerik siap', 'Values calculated'],
    ['Status & pemeriksaan', 'Status and checks'],
    ['Buka Thrust Deduction', 'Open Thrust Deduction'],
    ['Buka Wake Fraction', 'Open Wake Fraction'],
    ['dipakai bersama oleh', 'shared by'],
    ['nilai contoh dimasukkan untuk kelompok aktif', 'example values loaded for this group'],
    ['Curva untuk', 'Curves for'],
    ['klik kandidat dari tabel untuk memperbarui diagram.', 'select a candidate row to update the diagram.'],
    ['Status perhitungan', 'Calculation status'],
    ['Fr target manual', 'Manual target Fr'],
    ['persamaan terpilih', 'selected equations'],
    ['model terhitung', 'models calculated'],
    ['model maksimum', 'models maximum'],
    ['Tindakan', 'Actions'],
    ['Catatan', 'Note'],
    ['terpilih', 'selected'],
    ['kelompok', 'groups'],
    ['klik', 'select'],
    ['Koefisien tahanan sisa model dipindahkan ke kapal pada bilangan Froude yang sama.', 'Transfers the model residual-resistance coefficient to the ship at the same Froude number.'],
    ['Koefisien gelombang dipertahankan; tahanan viskos dihitung dengan faktor bentuk (1+k).', 'Preserves wave resistance and calculates viscous resistance using the form factor (1+k).'],
    ['Regresi beberapa titik tahanan model untuk memperkirakan faktor bentuk (1+k). Tidak menghitung RTS/PE.', 'Uses model resistance measurements to estimate the form factor (1+k). This method does not calculate full-scale resistance or effective power.'],
    ['Regresi CT = a + b·CF menggunakan beberapa model yang sebangun pada Froude sebanding.', 'Fits CT = a + b·CF using geometrically similar models at comparable Froude numbers.'],
    ['Ekstrapolasi gaya Froude menggunakan garis gesekan Schoenherr dan allowance tradisional.', 'Uses Froude extrapolation with the Schoenherr friction line and a traditional allowance.'],
    ['Ekstrapolasi menggunakan garis korelasi ITTC 1957 dengan atau tanpa faktor bentuk.', 'Uses the ITTC 1957 friction line, with or without a form factor.'],
    ['Rekonstruksi tahanan kapal dari tahanan model, faktor bentuk, koreksi kekasaran, dan allowance.', 'Calculates ship resistance from model resistance, form factor, roughness correction, and allowances.'],
    ['Koefisien gesekan historis: RF = f·S·V^1.825, untuk perbandingan historis.', 'Uses the historical friction relation RF = f·S·V^1.825 for comparison.'],
    ['Prohaska hanya menghasilkan 1+k; garis gesekan pada lembar Excel tercatat sebagai pilihan tetapi rumus regresinya tetap memakai ITTC 1957.', 'Prohaska returns 1+k only. The regression uses ITTC 1957 even when a different friction line is listed in the source workbook.'],
    ['Regresi Telfer dari enam model geosim; formula mengikuti worksheet 04_Geosim_Telfer.', 'Telfer regression uses up to six geometrically similar models.'],
    ['Metode historis; perhatikan batas panjang dan risiko transisi pada model kecil.', 'Historical method: check length limits and the risk of transitional flow on small models.'],
    ['Kolom override kosong menggunakan nilai dari geometri/global. Mode manual dapat digunakan ketika workbook memberikan opsi override.', 'Blank overrides use the geometry and water-property inputs. Use Manual only where the method supports an override.'],
    ['Telfer menggunakan regresi CT = a + b·CF; status memeriksa jumlah model dan rentang Fr sesuai toleransi workbook.', 'Telfer fits CT = a + b·CF. The status checks the number of models and their Froude-number spread.'],
    ['Angka ditampilkan dengan pembulatan. Perhitungan internal tidak dibulatkan.', 'Displayed values are rounded; calculations retain full precision.'],
    ['Data diproses secara lokal di browser · tidak memerlukan koneksi internet', 'Calculated locally in your browser · no internet connection required'],
    ['Nilai awal adalah contoh dari data uji workbook, bukan data kapal Anda. Ganti sesuai kondisi kapal; perubahan tersimpan pada perangkat ini.', 'Example values are provided. Replace them with your measured data.'],
    ['Hasil mengikuti persamaan sumber.', 'Results use the selected method equations.'],
    ['tidak otomatis menjamin kesesuaian domain empiris untuk kapal tertentu.', 'does not guarantee that the method applies to your vessel.'],
    ['Status berhasil', 'A successful calculation'],
    ['Hasil diperbarui saat parameter diubah.', 'Results update when you change an input.'],
    ['Kelompok ini tidak membutuhkan input numerik.', 'This group does not require numerical inputs.'],
    ['Metode / kelompok input', 'Method / input group'],
    ['Model pengujian geosim', 'Geosim model tests'],
    ['Diperlukan minimal 3 model geosim pada Fr sebanding.', 'Enter at least three geometrically similar models at comparable Froude numbers.'],
    ['Jika luas basah setiap model kosong, Excel menghitung', 'If a model wetted area is blank, it is calculated as'],
    ['Seperti MODEL_SETUP Excel, volume displacement digunakan untuk dokumentasi/QC, bukan rumus ekstrapolasi tahanan.', 'Displacement volume is used for documentation and quality checks, not for resistance extrapolation.'],
    ['Luas penampang maksimum model', 'Maximum model cross-sectional area'],
    ['Area transversal atas air', 'Above-water transverse area'],
    ['Kekasaran ekuivalen', 'Equivalent roughness'],
    ['Target bilangan Froude', 'Target Froude number'],
    ['Bilangan Fr target', 'Target Froude number'],
    ['Toleransi sebaran Fr', 'Froude-number spread tolerance'],
    ['Allowance tambahan', 'Additional allowance'],
    ['Gravitasi override', 'Gravity override'],
    ['Daya efektif', 'Effective power'],
    ['Koefisien total', 'Total resistance coefficient'],
    ['Kosongkan input pengujian', 'Clear test inputs'],
    ['Garis gesekan (tercatat di Excel)', 'Friction line (source record)'],
    ['Sumber faktor bentuk', 'Form-factor source'],
    ['Faktor bentuk manual', 'Manual form factor'],
    ['Eksponen Prohaska untuk', 'Prohaska exponent for'],
    ['Eksponen Prohaska', 'Prohaska exponent'],
    ['Eksponen n manual', 'Manual exponent n'],
    ['Nilai n manual', 'Manual exponent n'],
    ['Koefisien f kapal', 'Ship friction coefficient f'],
    ['Koefisien f model', 'Model friction coefficient f'],
    ['Metode koreksi kekasaran', 'Roughness-correction method'],
    ['kS khusus metode', 'Method-specific kS'],
    ['Garis gesekan', 'Friction line'],
    ['Varian ekstrapolasi', 'Extrapolation variant'],
    ['Dari Prohaska', 'From Prohaska'],
    ['Input RT & D → hasil RPM & daya', 'Known resistance and diameter → RPM and power'],
    ['Input daya & RPM → hasil D & RT', 'Known power and RPM → diameter and resistance'],
    ['Perhitungan berlangsung lokal tanpa koneksi internet.', 'Calculated locally without an internet connection.'],
    ['Koefisien asli dari workbook', 'Source coefficient data'],
    ['Propeller terpilih', 'Recommended propeller'],
    ['Karakteristik open-water · skala koefisien asli', 'Open-water characteristics'],
    ['KT, 10KQ dan η₀ berbagi satu sumbu Y tanpa normalisasi. KTn hanya ditampilkan jika ada koefisien sumber.', 'KT, 10KQ and η₀ share one unscaled Y-axis. Nozzle thrust is shown only when separate source coefficients are available.'],
    ['Scroll / cubit: zoom · Seret: geser', 'Scroll or pinch to zoom · drag to pan'],
    ['Tanpa normalisasi / sumbu sekunder', 'Original values · single Y-axis'],
    ['J operasi: KT prop = KT Ship', 'Operating J: propeller KT = required KT'],
    ['J operasi: 10KQ prop = 10KQ Power', 'Operating J: propeller 10KQ = power 10KQ'],
    ['Sumbu Y', 'Y-axis'],
    ['KQ prop = KQ daya', 'Propeller KQ = power KQ'],
    ['KT prop = KT ship', 'Propeller KT = required KT'],
    ['Jumlah propeller', 'Number of propellers'],
    ['Diameter propeller', 'Propeller diameter'],
    ['Air & tekanan', 'Water and pressure'],
    ['Kedalaman poros dari permukaan', 'Shaft immersion'],
    ['Massa jenis air', 'Water density'],
    ['Viskositas kinematik', 'Kinematic viscosity'],
    ['Tekanan atmosfer', 'Atmospheric pressure'],
    ['Tekanan uap', 'Vapour pressure'],
    ['Efisiensi & kavitasi', 'Efficiency and cavitation'],
    ['Efisiensi shaft', 'Shaft efficiency ηₛ'],
    ['Efisiensi transmisi', 'Transmission efficiency ηₜ'],
    ['η kerja', 'η₀'],
    ['η tidak tersedia', 'η₀ unavailable'],
    ['Toleransi residual KT', 'KT residual tolerance'],
    ['Toleransi residual KQ', 'KQ residual tolerance'],
    ['Kriteria kavitasi', 'Cavitation criterion'],
    ['Safety margin kavitasi', 'Cavitation safety margin'],
    ['Efisiensi terbaik', 'Best open-water efficiency'],
    ['Kandidat valid', 'Eligible candidates'],
    ['Tanpa dimensi', 'Dimensionless'],
    ['termasuk sea margin', 'including sea margin'],
    ['Peringkat kandidat', 'Candidate ranking'],
    ['klik baris untuk melihat kurva', 'select a row to view its curves'],
    ['10 efisiensi tertinggi dari kandidat yang memenuhi syarat.', 'Top 10 eligible candidates by open-water efficiency.'],
    ['Seluruh kandidat yang valid · urutan efisiensi tertinggi.', 'All eligible candidates, ordered by open-water efficiency.'],
    ['10 terbaik · berdasarkan efisiensi open-water η₀.', 'Top 10 candidates by open-water efficiency η₀.'],
    ['Semua valid', 'All eligible'],
    ['Ekspor CSV', 'Export CSV'],
    ['Tipe / seri', 'Type / series'],
    ['Daya (kW)', 'Engine Power (kW)'],
    ['Terbaik per jumlah bilah / famili', 'Best by blade count / family'],
    ['Pilih baris untuk melihat kurva dan titik operasi kandidat.', 'Select a row to view the candidate curves and operating point.'],
    ['Input diketahui · mesin & operasi', 'Known engine and operating conditions'],
    ['Daya mesin total (brake power)', 'Engine Power (brake power)'],
    ['RPM mesin', 'Engine RPM'],
    ['Rasio gearbox (n mesin / n prop)', 'Gear ratio (engine / propeller RPM)'],
    ['Kecepatan kapal pada titik desain', 'Design vessel speed'],
    ['Diameter · rentang pencarian', 'Diameter search range'],
    ['Daya terkirim total', 'Total delivered power'],
    ['setelah gearbox', 'after reduction gear'],
    ['seluruh propeller', 'all propellers'],
    ['J pada perpotongan', 'Operating J'],
    ['10KQ prop / daya', 'Propeller / power 10KQ'],
    ['kurva berhenti sebelum nilai negatif', 'curve ends before negative values'],
    ['batas domain; tidak ditemukan KT/KQ negatif sebelumnya', 'domain limit; no earlier negative KT/KQ value'],
    ['akar', 'zero of'],
    ['Konfigurasi', 'Configuration'],
    ['Koef.', 'Coefficient'],
    ['persamaan', 'equations'],
    ['menghasilkan', 'returns'],
    ['kandidat', 'candidates'],
    ['kombinasi', 'combinations'],
    ['dievaluasi', 'evaluated'],
    ['ditampilkan', 'shown'],
    ['Sebelum', 'Previous'],
    ['Berikut', 'Next'],
    ['Kavitasi', 'Cavitation'],
    ['daya', 'power'],
    ['kurva', 'curves'],
    ['memperbarui', 'update'],
    ['tabel', 'table'],
    ['perpotongan', 'intersection'],
    ['terbaik', 'best'],
    ['sebelum pembulatan', 'before rounding'],
    ['Perbandingan hasil Wake Fraction', 'Wake Fraction Comparison'],
    ['Perbandingan hasil Thrust Deduction', 'Thrust Deduction Comparison'],
    ['TAMPILKAN', 'Show'],
    ['SEMBUNYIKAN', 'Hide'],
    ['KOREKSI KONDISI MUAT', 'LOAD CONDITION CORRECTIONS'],
    ['VARIASI PEMBEBANAN', 'LOADING VARIATIONS'],
    ['PENGUKURAN / IDENTITAS', 'MEASUREMENTS / IDENTIFICATION'],
    ['RELASI LOKAL', 'LOCAL RELATIONSHIPS'],
    ['REGRESI / PRAKIRAAN', 'REGRESSION / ESTIMATION'],
    ['IDENTITAS KOEFISIEN', 'COEFFICIENT IDENTIFICATION'],
    ['TIDAK TERDEFINISI', 'UNDEFINED'],
    ['PERLU TINJAUAN', 'REVIEW REQUIRED'],
    ['PERINGATAN DOMAIN / NUMERIK', 'DOMAIN / NUMERICAL WARNING'],
    ['PARAMETER BELUM LENGKAP', 'INCOMPLETE INPUTS'],
    ['BATAS EMPIRIS BELUM DIVERIFIKASI', 'EMPIRICAL LIMITS NOT VERIFIED'],
    ['PENGATURAN', 'SETTINGS'],
    ['KONDISI KAPAL', 'VESSEL CONDITIONS'],
    ['KONDISI UJI', 'TEST CONDITIONS'],
    ['HASIL EKSTRAPOLASI', 'EXTRAPOLATION RESULTS'],
    ['PARAMETER PERHITUNGAN', 'CALCULATION PARAMETERS'],
    ['TABEL HASIL', 'RESULTS TABLE'],
    ['NILAI HASIL', 'RESULT VALUES'],
    ['PILIH METODE', 'SELECT METHOD'],
    ['PILIH SERI', 'SELECT SERIES'],
    ['PILIH VARIASI', 'SELECT VARIANT'],
    ['DATA KAPAL', 'VESSEL DATA'],
    ['DATA MODEL', 'MODEL DATA'],
    ['DATA KAPAL MODEL', 'VESSEL AND MODEL DATA'],
    ['JALANKAN PERHITUNGAN', 'RUN CALCULATION'],
    ['HITUNG SEKARANG', 'CALCULATE NOW'],
    ['PERHITUNGAN SELESAI', 'CALCULATION COMPLETE'],
    ['PERHITUNGAN GAGAL', 'CALCULATION FAILED'],
    ['NILAI TIDAK VALID', 'INVALID VALUE'],
    ['BELUM TERSEDIA', 'NOT AVAILABLE'],
    ['TIDAK TERSEDIA', 'NOT AVAILABLE'],
    ['BELUM DIVERIFIKASI', 'NOT VERIFIED'],
    ['BELUM TERVERIFIKASI', 'NOT VERIFIED'],
    ['BATAS DOMAIN EMPIRIS', 'EMPIRICAL DOMAIN LIMITS'],
    ['BATAS DOMAIN', 'DOMAIN LIMITS'],
    ['HASIL PER METODE', 'RESULTS BY METHOD'],
    ['HASIL PER KELOMPOK', 'RESULTS BY GROUP'],
    ['PENGGUNAAN YANG DISARANKAN', 'RECOMMENDED USE'],
    ['BATASAN METODE', 'METHOD LIMITATIONS'],
    ['KETERANGAN METODE', 'METHOD NOTES'],
    ['RINGKASAN METODE', 'METHOD SUMMARY'],
    ['PERHITUNGAN OTOMATIS', 'AUTOMATIC CALCULATION'],
    ['PERHITUNGAN MANUAL', 'MANUAL CALCULATION'],
    ['FAKTOR KOREKSI', 'CORRECTION FACTOR'],
    ['FAKTOR GEOMETRI', 'GEOMETRY FACTOR'],
    ['KOEFISIEN TAHANAN', 'RESISTANCE COEFFICIENT'],
    ['KOEFISIEN GESEK', 'FRICTION COEFFICIENT'],
    ['KOEFISIEN VISKOS', 'VISCOUS COEFFICIENT'],
    ['PERBANDINGAN', 'COMPARISON'],
    ['ESTIMASI', 'ESTIMATE'],
    ['PERKIRAAN', 'ESTIMATE'],
    ['PENDEKATAN', 'APPROACH'],
    ['HUBUNGAN', 'RELATIONSHIP'],
    ['PEMBATASAN', 'LIMITATIONS'],
    ['KETERBATASAN', 'LIMITATIONS'],
    ['KEWAJIBAN INPUT', 'REQUIRED INPUTS'],
    ['PENGARUH', 'EFFECT'],
    ['TRANSISI', 'TRANSITION'],
    ['KEKENTALAN KINEMATIS', 'KINEMATIC VISCOSITY'],
    ['KEKENTALAN DINAMIS', 'DYNAMIC VISCOSITY'],
    ['KERJA', 'WORK'],
    ['SUMBER', 'SOURCE'],
    ['DOKUMEN', 'DOCUMENT'],
    ['BUKU KERJA', 'WORKBOOK'],
    ['HASIL', 'RESULTS'],
    ['PERINGATAN', 'WARNING'],
    ['VALID', 'VALID'],
    ['TIDAK VALID', 'INVALID'],
    ['KELENGKAPAN', 'COMPLETENESS'],
    ['KELENGKAPAN INPUT', 'INPUT COMPLETENESS'],
    ['DATA TERUKUR', 'MEASURED DATA'],
    ['DATA HASIL', 'RESULT DATA'],
    ['NILAI TERUKUR', 'MEASURED VALUE'],
    ['NILAI HASIL', 'RESULT VALUE'],
    ['DIHITUNG OTOMATIS', 'CALCULATED AUTOMATICALLY'],
    ['DIPILIH OTOMATIS', 'SELECTED AUTOMATICALLY'],
    ['JANGAN', 'Do not'],
    ['KONDISI', 'Condition'],
    ['KOEFISIEN', 'Coefficient'],
    ['GESEK', 'friction'],
    ['KASARAN', 'roughness'],
    ['TENGGELAM', 'submerged'],
    ['PENGARUH', 'effect'],
    ['PERMUKAAN', 'surface'],
    ['REGRESI', 'regression'],
    ['EKSPERIMEN', 'experiment'],
    ['DATA UJI', 'test data'],
    ['UJI', 'test'],
    ['Tidak ada', 'None'],
    ['Belum ada', 'Not available yet'],
    ['Belum dipilih', 'Not selected'],
    ['Belum dihitung', 'Not calculated'],
    ['Tidak dihitung', 'Not calculated'],
    ['Tidak digunakan', 'Not used'],
    ['Tidak diketahui', 'Unknown'],
    ['Tidak memenuhi', 'Does not meet'],
    ['Tidak boleh', 'Must not'],
    ['Di luar rentang', 'Outside the range'],
    ['Di dalam rentang', 'Within the range'],
    ['Berdasarkan', 'Based on'],
    ['menggunakan', 'using'],
    ['digunakan', 'used'],
    ['dihitung', 'calculated'],
    ['menghitung', 'calculate'],
    ['memerlukan', 'requires'],
    ['diperlukan', 'required'],
    ['dibutuhkan', 'required'],
    ['tersedia', 'available'],
    ['menampilkan', 'display'],
    ['menentukan', 'determine'],
    ['masukan', 'input'],
    ['keluaran', 'output'],
    ['Persamaan', 'Equation'],
    ['persamaan', 'equation'],
    ['rumus', 'formula'],
    ['faktor', 'factor'],
    ['batas', 'limit'],
    ['rentang', 'range'],
    ['empiris', 'empirical'],
    ['kondisi', 'condition'],
    ['muat', 'loading'],
    ['beban', 'load'],
    ['tunggal', 'single'],
    ['ganda', 'twin'],
    ['validasi', 'validation'],
    ['kesalahan', 'error'],
    ['peringatan', 'warning'],
    ['periksa', 'check'],
    ['Tinjau', 'Review'],
    ['Perlu', 'Required'],
    ['Wajib', 'Required'],
    ['opsional', 'optional'],
    ['sumber', 'source'],
    ['kapasitas', 'capacity'],
    ['koefisien', 'coefficient'],
    ['kedalaman', 'depth'],
    ['kolam', 'tank'],
    ['permukaan', 'surface'],
    ['transversal', 'transverse'],
    ['penampang', 'cross-section'],
    ['maksimum', 'maximum'],
    ['minimum', 'minimum'],
    ['ditampilkan', 'shown'],
    ['hasil', 'result'],
    ['nilai', 'value'],
    ['pilihan', 'selection'],
    ['pilih', 'select'],
    ['pakai', 'use'],
    ['kelompok', 'group'],
    ['perbandingan', 'comparison'],
    ['kecepatan', 'speed'],
    ['panjang', 'length'],
    ['luas', 'area'],
    ['volume', 'volume'],
    ['kapal', 'vessel'],
    ['lingkungan', 'environment'],
    ['pengujian', 'test'],
    ['pengukuran', 'measurement'],
    ['ekstrapolasi', 'extrapolation'],
    ['otomatis', 'automatic'],
    ['manual', 'manual'],
    ['kosong', 'blank'],
    ['terukur', 'measured'],
    ['terhitung', 'calculated'],
    ['lengkap', 'complete'],
    ['seperti', 'as in'],
    ['ketika', 'when'],
    ['saat', 'when'],
    ['pada', 'at'],
    ['dari', 'from'],
    ['dengan', 'with'],
    ['untuk', 'for'],
    ['yang', 'that'],
    ['dan', 'and'],
    ['atau', 'or'],
    ['serta', 'and'],
    ['sebagai', 'as'],
    ['adalah', 'is'],
    ['merupakan', 'is'],
    ['dapat', 'can'],
    ['jika', 'if'],
    ['maka', 'then'],
    ['bernilai', 'has a value of'],
    ['lebih', 'more'],
    ['kurang', 'less'],
    ['sama', 'equal'],
    ['bukan', 'not'],
    ['belum', 'not yet'],
    ['tidak', 'not'],
    ['WAJIB DIISI', 'REQUIRED'],
    ['ISI NILAI', 'ENTER A VALUE'],
    ['MASUKKAN NILAI', 'ENTER A VALUE'],
    ['NILAI CONTOH', 'EXAMPLE VALUE'],
    ['PENGATURAN METODE', 'METHOD SETTINGS'],
    ['PENGATURAN INPUT', 'INPUT SETTINGS'],
    ['HASIL PERHITUNGAN', 'CALCULATION RESULTS'],
    ['DATA MASUKAN', 'INPUT DATA'],
    ['KONDISI AWAL', 'INITIAL CONDITIONS'],
    ['NILAI AWAL', 'INITIAL VALUE'],
    ['MODE MANUAL', 'MANUAL MODE'],
    ['MODE OTOMATIS', 'AUTOMATIC MODE'],
    ['HASIL OTOMATIS', 'AUTOMATIC RESULTS'],
    ['NILAI OTOMATIS', 'AUTOMATIC VALUE'],
    ['KOEFISIEN', 'COEFFICIENT'],
    ['KECEPATAN MODEL', 'MODEL SPEED'],
    ['KECEPATAN KAPAL', 'VESSEL SPEED'],
    ['TAHANAN TERUKUR', 'MEASURED RESISTANCE'],
    ['FAKTOR BENTUK', 'FORM FACTOR'],
    ['FAKTOR SKALA', 'SCALE FACTOR'],
    ['FUNGSI', 'FUNCTION'],
    ['KEMBALI', 'Back'],
    ['LANJUT', 'Continue'],
    ['HAPUS', 'Delete'],
    ['SIMPAN', 'Save'],
    ['BATAL', 'Cancel'],
    ['TUTUP', 'Close'],
    ['Model-to-ship length scale ratio', 'Model-to-ship length scale ratio'],
    ['Metode ekstrapolasi', 'Extrapolation Method'],
    ['Geometri dan skala model', 'Model Geometry and Scale'],
    ['Data pengujian model', 'Model Test Data'],
    ['Pengukuran towing tank', 'Towing Tank Measurements'],
    ['Pengujian model sebangun', 'Geosim Model Tests'],
    ['Parameter metode', 'Method Parameters'],
    ['Kurva hasil pengujian', 'Test Results'],
    ['Hasil per titik uji', 'Results by Test Point'],
    ['Metode perhitungan', 'Calculation Method'],
    ['Parameter input', 'Input Parameters'],
    ['Hasil perhitungan', 'Calculation Results'],
    ['Pilih koefisien', 'Select a Coefficient'],
    ['Pilih kebutuhan input', 'Select Required Inputs'],
    ['Masukkan parameter', 'Enter Parameters'],
    ['Pulihkan nilai contoh', 'Restore Example Values'],
    ['Pulihkan contoh', 'Restore Example Values'],
    ['Isi contoh', 'Load Example Values'],
    ['Kosongkan kelompok', 'Clear Group'],
    ['Reset semua', 'Reset All'],
    ['Ekspor input JSON', 'Export Inputs as JSON'],
    ['Impor input JSON', 'Import Inputs from JSON'],
    ['Cetak hasil', 'Print Results'],
    ['HITUNG & PILIH PROPELLER', 'CALCULATE & SELECT PROPELLER'],
    ['HITUNG & CARI DIAMETER', 'CALCULATE & FIND DIAMETER'],
    ['Dimensi full-scale', 'Full-Scale Dimensions'],
    ['Tahanan total kapal', 'Total Ship Resistance'],
    ['Kecepatan kapal', 'Ship Speed'],
    ['Panjang kapal', 'Ship Length'],
    ['Luas basah kapal', 'Ship Wetted Area'],
    ['Panjang model', 'Model Length'],
    ['Luas basah model', 'Model Wetted Area'],
    ['Rasio skala', 'Scale Ratio'],
    ['Properti air dan lingkungan uji', 'Water Properties and Test Conditions'],
    ['Koreksi blockage / Schuster', 'Blockage / Schuster Correction'],
    ['Metode koreksi', 'Correction Method'],
    ['Kedalaman kolam', 'Tank Depth'],
    ['Luas penampang kolam', 'Tank Cross-Sectional Area'],
    ['Luas penampang maksimum model', 'Maximum Model Cross-Sectional Area'],
    ['Blockage factor', 'Blockage Factor'],
    ['Kecepatan dan tahanan terukur', 'Measured Speed and Resistance'],
    ['maksimum', 'maximum'],
    ['Kosong', 'Blank'],
    ['otomatis dari skala', 'calculated automatically from scale'],
    ['digunakan untuk dokumentasi/QC, bukan rumus ekstrapolasi tahanan', 'used for documentation and quality checks, not in the resistance extrapolation formula'],
    ['dapat diisi di tabel ketika koreksi diaktifkan', 'can be entered in the table when the correction is enabled'],
    ['Dasar perhitungan mengikuti TEST_DATA workbook.', 'The calculation follows the TEST_DATA workbook.'],
    ['Perhitungan berasal dari formula worksheet metode terpilih. Tidak ada pembulatan pada perhitungan internal.', 'Calculated using the selected method worksheet. Internal values are not rounded.'],
    ['Regresi Prohaska', 'Prohaska Regression'],
    ['Regresi geosim', 'Geosim Regression'],
    ['titik terhitung', 'points calculated'],
    ['data lengkap', 'complete data'],
    ['dipilih', 'selected'],
    ['peringatan kelayakan hasil', 'Result Validity Warning'],
    ['status metode Excel', 'method status'],
    ['Otomatis', 'Automatic'],
    ['Opsional', 'Optional'],
    ['contoh', 'example'],
    ['Run', 'Run'],
    ['Geometri valid', 'Geometry valid'],
    ['Panjang', 'Length'],
    ['Lebar', 'Width'],
    ['Tahanan', 'Resistance'],
    ['Tahanan kapal', 'Ship Resistance'],
    ['Kapal penuh', 'Full-Scale Vessel'],
    ['Kecepatan', 'Speed'],
    ['Luas', 'Area'],
    ['basah', 'wetted'],
    ['Rasio', 'Ratio'],
    ['skala', 'scale'],
    ['Jumlah', 'Number of'],
    ['propeller', 'propeller'],
    ['Kekasaran', 'Roughness'],
    ['ekuivalen', 'equivalent'],
    ['Percepatan gravitasi', 'Gravitational Acceleration'],
    ['Luas transversal atas air', 'Transverse Above-Water Area'],
    ['Volume displacement', 'Displacement Volume'],
    ['Volume', 'Volume'],
    ['Metode', 'Method'],
    ['Perhitungan', 'Calculation'],
    ['ekstrapolasi', 'extrapolation'],
    ['Pengujian', 'Test'],
    ['Pengukuran', 'Measurement'],
    ['Data', 'Data'],
    ['Masukkan', 'Enter'],
    ['Pilih', 'Select'],
    ['Hasil', 'Results'],
    ['Parameter', 'Parameter'],
    ['Kapal', 'Vessel'],
    ['model', 'model'],
    ['titik', 'point'],
    ['run', 'run'],
    ['dari', 'of'],
    ['dengan', 'with'],
    ['untuk', 'for'],
    ['yang', 'that'],
    ['dan', 'and'],
    ['atau', 'or'],
    ['manual', 'manual'],
    ['kosong', 'blank'],
    ['terukur', 'measured'],
    ['terhitung', 'calculated'],
    ['dipilih', 'selected'],
    ['kapal', 'vessel']
  ].filter(([source,target]) => source.toLowerCase() !== target.toLowerCase()).sort((a, b) => b[0].length - a[0].length);
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = translations.map(([source,target]) => {
    const boundary = /^[\p{L}\p{N}]/u.test(source[0]) && /[\p{L}\p{N}]$/u.test(source.at(-1));
    const pattern = boundary ? `(?<![\\p{L}\\p{N}])${escape(source)}(?![\\p{L}\\p{N}])` : escape(source);
    return [new RegExp(pattern,'giu'),target];
  });
  const textCache = new Map();
  function translate(value) {
    if(textCache.has(value))return textCache.get(value);
    let result = value;
    for (const [pattern,target] of rules) result=result.replace(pattern,target);
    // Notation only, never values, identifiers, units, option values or equations.
    result=result.replace(/(?<![\p{L}\p{N}_])A(?:E|ₑ)\s*\/\s*A(?:0|O|₀)(?![\p{L}\p{N}_])/giu,'Aₑ/A₀').replace(/\beta0\b/g,'η₀').replace(/\b(?:Ho|H0)\b(?=\s*(?:\[|\(|$))/g,'η₀');
    if(textCache.size>4000)textCache.clear();textCache.set(value,result);
    return result;
  }
  function hideInternalStatus() {
    document.querySelectorAll('body *').forEach(element => {
      if (element.children.length) return;
      const text = element.textContent.trim();
      if (text === 'READY' || text === 'VALID_SOURCE_FAMILY_CASE') {
        element.classList.add('arus-internal-hidden');
      }
    });
    document.querySelectorAll('body *').forEach(element => {
      if (element.children.length > 4) return;
      if (/source-declared domain status/i.test(element.textContent) && element.textContent.length < 180) {
        const row = element.closest('.statusrow,.statitem,.result-row,.resultitem,.metric-row') || element.parentElement;
        if (row) row.classList.add('arus-internal-hidden');
      }
    });
  }
  function translatePage() {
    // Presentation only: retain native export routines, but expose no download UI.
    document.querySelectorAll('button,a,[role="menuitem"],input[type="button"]').forEach(el=>{
      const label=(el.textContent||el.value||'').trim();
      if (/\b(download|export|unduh|ekspor)\b|^(?:2D offsets|3D offsets|STL|OBJ|Radial CSV|PLY mesh|DXF section|PDF report|Project \.pgeo|Rhino surface)/i.test(label) || el.hasAttribute('download')) el.classList.add('arus-export-hidden');
    });
    document.querySelectorAll('option:not([value])').forEach(option => option.setAttribute('value',option.value));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,code,pre,textarea')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const translated = translate(node.nodeValue);
      if (translated !== node.nodeValue) node.nodeValue = translated;
    });
    if (moduleId === 'geometry') {
      const status = document.getElementById('status');
      if (status && /GEOMETRY VALID/i.test(status.textContent)) status.textContent = 'Geometry valid';
    }
    document.querySelectorAll('[placeholder],[aria-label],[title],optgroup[label]').forEach(element => {
      for (const attribute of ['placeholder', 'aria-label', 'title', ...(element.tagName==='OPTGROUP'?['label']:[])]) {
        if (element.hasAttribute(attribute)) {
          const original = element.getAttribute(attribute);
          const translated = translate(original);
          if (translated !== original) element.setAttribute(attribute, translated);
        }
      }
    });
    document.querySelectorAll('.formrow,.field').forEach(row=>{
      const label=[...row.children].find(element=>element.tagName==='LABEL');
      const control=row.querySelector('input[id],select[id],textarea[id]');
      if(label&&control&&!label.htmlFor)label.htmlFor=control.id;
    });
    document.querySelectorAll('.sec-tag,.phead>small').forEach(element=>{
      const clean=element.textContent.replace(/^\s*0\d\s*(?:\/\s*)?/,'').trim();
      if(clean!==element.textContent)element.textContent=clean;
    });
    hideInternalStatus();
  }
  function installCanvasTranslation() {
    if (!window.CanvasRenderingContext2D) return;
    const original = CanvasRenderingContext2D.prototype.fillText;
    const measure = CanvasRenderingContext2D.prototype.measureText;
    const normalizeFont = context => { const font=context.font.replace(/(\d+(?:\.\d+)?px)\s+.*$/, '$1 Arial, sans-serif'); if(font!==context.font)context.font=font; };
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { normalizeFont(this); return original.call(this, translate(String(text)), ...args); };
    CanvasRenderingContext2D.prototype.measureText = function (text) { normalizeFont(this); return measure.call(this, translate(String(text))); };
  }
  installCanvasTranslation();
  window.addEventListener('DOMContentLoaded', () => {
    document.body.dataset.arusModule = moduleId;
    const installMethodCards=(select,{label='Choose a method',note,readNotes=()=>''}={})=>{
      if(!select)return null;
      const host=select.parentElement;
      if(!host)return null;
      host.classList.add('arus-method-control');
      select.classList.add('arus-method-select-native');
      const sourceLabel=document.querySelector(`label[for="${select.id}"]`);
      if(sourceLabel)sourceLabel.classList.add('arus-method-label-native');
      const cards=document.createElement('div');cards.className='arus-method-cards';cards.setAttribute('role','group');cards.setAttribute('aria-label',label);
      const guidance=document.createElement('div');guidance.className='arus-method-limit-note';guidance.setAttribute('role','note');
      guidance.innerHTML='<strong>Method limitations</strong><ul class="arus-method-limit-list"></ul>';
      host.append(cards);
      host.after(guidance);
      const isHullPicker=moduleId==='resistance'&&select.id==='method';
      let hullOpen=isHullPicker;
      let hullToolbar=null,hullTitle=null,hullToggle=null;
      const groups=[
        {title:'Displacement hulls',caption:'Conventional displacement and merchant vessels',methods:[
          ['R01','Harvald–Guldhammer','Residual-resistance diagram'],['R02','Holtrop–Mennen','Displacement hull prediction'],
          ['R03','Hollenbach','Merchant-ship resistance'],['R04','Series 60 (BSRA)','Series-based hull prediction'],
          ['R05','Van Oortmerssen','Small-displacement vessels'],['R06','NPL Series 64','Systematic series resistance']]},
        {title:'Small craft & planing',caption:'Chine and high-speed operating regimes',methods:[
          ['R07','NTUA Double-Chine','Double-chine small craft'],['R08','Savitsky','Planing craft','planingVariant','savitsky'],
          ['R08','Series 62 / Radojčić','Planing hull series','planingVariant','series']]},
        {title:'Yachts & multihulls',caption:'Yachts and twin-hull vessels',methods:[
          ['R10','Delft Yacht Hull Series','Sailing yacht hulls'],['R09','Southampton Catamaran','Catamaran source family','catFamily','Southampton'],
          ['R09','VWS Catamaran','Catamaran source family','catFamily','VWS']]},
        {title:'Special vessels',caption:'Underwater and foil-supported craft',methods:[
          ['R11','Submarine / AUV','Submerged body resistance'],['R12','Hydrofoil','Foil and strut components']]}
      ];
      if(isHullPicker){
        host.classList.add('arus-hull-method-picker');
        hullToolbar=document.createElement('div');hullToolbar.className='arus-hull-toolbar';
        const info=document.createElement('div');
        const caption=document.createElement('span');caption.className='arus-hull-caption';caption.textContent='Selected resistance method';
        hullTitle=document.createElement('strong');hullTitle.className='arus-hull-current-name';
        hullToggle=document.createElement('button');hullToggle.type='button';hullToggle.className='arus-hull-toggle';
        hullToggle.addEventListener('click',()=>{hullOpen=!hullOpen;sync();});
        info.append(caption,hullTitle);hullToolbar.append(info,hullToggle);host.insertBefore(hullToolbar,cards);
      }
      const branchOf=(id)=>id==='R08'?(document.getElementById('planingVariant')?.value||'savitsky'):
        id==='R09'?(document.getElementById('catFamily')?.value||'Southampton'):'';
      const sync=()=>{
        const current=select.value;
        cards.replaceChildren();
        if(isHullPicker){
          cards.classList.add('arus-hull-catalog');
          const available=new Set([...select.options].map(option=>option.value));
          let selectedTitle=select.selectedOptions[0]?.textContent?.trim()||'Select a method';
          for(const group of groups){
            const section=document.createElement('section');section.className='arus-hull-group';
            const heading=document.createElement('div');heading.className='arus-hull-group-heading';
            const name=document.createElement('strong');name.textContent=group.title;
            const summary=document.createElement('span');summary.textContent=group.caption;
            heading.append(name,summary);
            const grid=document.createElement('div');grid.className='arus-hull-group-grid';
            for(const entry of group.methods){
              const [methodId,title,description,branchId,branchValue]=entry;
              if(!available.has(methodId))continue;
              const button=document.createElement('button');button.type='button';button.className='arus-hull-card';
              button.dataset.methodValue=methodId;
              if(branchValue)button.dataset.branchValue=branchValue;
              const pressed=methodId===current&&(!branchId||branchOf(methodId)===branchValue);
              button.setAttribute('aria-pressed',String(pressed));
              if(pressed)selectedTitle=title;
              const nameEl=document.createElement('span');nameEl.className='hull-card-title';nameEl.textContent=title;
              const descEl=document.createElement('span');descEl.className='hull-card-description';descEl.textContent=description;
              button.append(nameEl,descEl);
              if(pressed){const check=document.createElement('span');check.className='arus-hull-selected-glyph';check.textContent='✓';button.append(check);}
              button.addEventListener('click',()=>{
                const changed=select.value!==methodId;
                if(changed){select.value=methodId;select.dispatchEvent(new Event('change',{bubbles:true}));}
                if(branchId){
                  const source=document.getElementById(branchId);
                  if(source){source.value=branchValue;source.dispatchEvent(new Event('change',{bubbles:true}));}
                }
                hullOpen=false;sync();
              });
              grid.append(button);
            }
            if(grid.children.length){section.append(heading,grid);cards.append(section);}
          }
          hullTitle.textContent=selectedTitle;
          hullToggle.textContent=hullOpen?'Close method list':'Change method';
          cards.classList.toggle('arus-hull-hidden',!hullOpen);
        }else{
          for(const option of [...select.options]){
            if(!option.value)continue;
            const button=document.createElement('button');button.type='button';button.className='arus-method-card';button.dataset.methodValue=option.value;
            button.setAttribute('aria-pressed',String(option.value===current));
            const title=document.createElement('strong');title.textContent=option.textContent.trim().replace(/^(?:MT|R)\d+\s*/i,'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
            button.append(title);button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();});cards.append(button);
          }
        }
        setLimitations(readNotes()||note||'Select the method that matches your measured inputs and stay within its documented domain.');
        guidance.hidden=isHullPicker?hullOpen:cards.children.length<2;
      };
      const setLimitations=detail=>{
        const rows=(Array.isArray(detail)?detail:String(detail||'').split(/\n+/)).map(value=>String(value).trim()).filter(Boolean);
        const list=guidance.querySelector('.arus-method-limit-list');
        list.replaceChildren(...rows.map(value=>{const row=document.createElement('li');row.textContent=value.replace(/^•\s*/,'');return row;}));
      };
      select.addEventListener('change',sync);
      new MutationObserver(sync).observe(select,{childList:true,subtree:true,characterData:true});
      sync();
      return {cards,guidance,sync,setLimitations};
    };
    if(moduleId==='resistance'){
      const info=document.getElementById('methodInfo');
      const picker=installMethodCards(document.getElementById('method'),{label:'Ship resistance methods',readNotes:()=>{
        if(document.getElementById('method')?.value!=='R02'){
          const description=info?.querySelector('p')?.innerText?.trim();
          return description?[
            `Method scope: ${description}`,
            'Applicability: use the source-method warning and verify the vessel is within the method’s documented empirical domain.'
          ]:[];
        }
        return [
          'ARUS warning envelope: conventional displacement monohull',
          'ARUS warning envelope: length Froude number Fn_LWL 0 < Fn ≤ 0.45',
          'ARUS warning envelope: prismatic coefficient Cp 0.55–0.85',
          'ARUS warning envelope: length/breadth LWL/B 3.9–9.5',
          'Additional published check (PIAS summary): midship coefficient Cm 0.50–1.00',
          'Additional published check (PIAS summary): LCB within ±5% of LWL/2',
          'Additional published check (PIAS summary): broader Cp 0.40–0.93; this is not the ARUS warning range',
          'Additional published check (PIAS summary): waterline entrance half-angle ≤ 70°',
          'Additional published check (PIAS summary): bulb frontal area / midship area < 0.20',
          'Reference condition: calm water; seawater 1,025 kg/m³ at 15 °C',
          'Not intended for planing craft, hydrofoils, multihulls, or strongly non-conventional hulls'
        ];
      }});
      if(info&&picker){info.classList.add('arus-method-source-hidden');new MutationObserver(picker.sync).observe(info,{childList:true,subtree:true,characterData:true});}
    }
    if(moduleId==='model-test'){
      const method=document.getElementById('method');
      const methodLimits={
        MT01:['Inputs: measured model speed/resistance and model/ship geometry.','Applicability: transfer residual resistance at matching Froude number; selected friction line and allowances remain method-specific.','Use: review the method status and replace all example measurements with test data.'],
        MT02:['Inputs: measured towing-test data and a valid form factor (1+k), manual or from Prohaska.','Applicability: preserves the wave-resistance coefficient and applies the selected friction line to viscous resistance.','Use: verify the form-factor source and fluid-property inputs before interpreting full-scale results.'],
        MT03:['Inputs: multiple measured model-test points suitable for Prohaska regression.','Output boundary: estimates 1+k only; it does not calculate full-scale resistance or effective power.','Source behavior: the regression uses ITTC 1957; the displayed friction-line choice is recorded but does not change that regression.'],
        MT04:['Inputs: 3–6 complete, geometrically similar geosim model cases.','Applicability: model cases must have comparable Froude numbers and the required measured data.','Method: fits CT = a + b·CF; the workbook status checks model count and Froude-number spread.'],
        MT05:['Inputs: measured model-test data and the required model/ship geometry.','Method boundary: Schoenherr / ATTC friction-line extrapolation; it does not use a multi-model geosim regression.','Use: confirm the selected friction-line/allowance settings and review the returned status.'],
        MT06:['Inputs: measured model-test data, scale geometry, speed, and water properties.','Method boundary: ITTC 1957 correlation line, with the declared optional form-factor branch.','Use: do not supply a manual form factor unless it has a documented basis.'],
        MT07:['Inputs: measured model-test data and the method-specific full-scale correction inputs.','Method boundary: ITTC 1978 resistance extrapolation with form-factor, roughness, and allowance terms as configured.','Use: confirm each correction input has a documented basis; review the workbook status.'],
        MT08:['Method scope: historical Froude/friction comparison.','Limitations: retain the source warning for model/ship length and possible transitional flow at small model scale.','Use: treat as a historical comparator, not a universal replacement for current friction-line methods.']
      };
      const picker=installMethodCards(method,{label:'Model-test extrapolation methods',readNotes:()=>methodLimits[method?.value]||['Select the method and review its measured-data and applicability requirements.']});
      [document.getElementById('methoddesc'),document.getElementById('methodFootnote')].filter(Boolean).forEach(element=>element.classList.add('arus-method-source-hidden'));
    }
    if(moduleId==='interaction'){
      let family='all';
      const type=document.getElementById('typeSelect'),groups=document.getElementById('groupSelect');
      const typePicker=installMethodCards(type,{label:'Calculation type',note:['Wake fraction w and thrust deduction t are different coefficients.','Select one coefficient family; combined output is available only where the selected input group supports both.']});
      const groupPicker=installMethodCards(groups,{label:'Wake and thrust method/input groups',readNotes:()=>[document.getElementById('groupMembers')?.innerText,document.getElementById('groupHelp')?.innerText].filter(Boolean)});
      const syncInteraction=()=>{
        family=type?.value||'all';
        if(typePicker)typePicker.setLimitations(family==='wake'?['Coefficient: wake fraction w estimates inflow-velocity reduction.','Applicability: confirm the selected method’s source, required inputs, and vessel/operating domain.']:family==='thrust'?['Coefficient: thrust deduction t represents thrust interaction.','Applicability: confirm the selected method’s source, required inputs, and vessel/operating domain.']:['Wake fraction w and thrust deduction t are different coefficients.','Combined results are available only for input groups that explicitly support both.']);
        if(groupPicker){const member=document.getElementById('groupMembers')?.innerText?.trim(),help=document.getElementById('groupHelp')?.innerText?.trim();groupPicker.setLimitations([member&&`Included methods: ${member}`,help&&`Input-group guidance: ${help}`,'Applicability: verify the selected source method’s documented domain before using the coefficient.'].filter(Boolean));}
      };
      type?.addEventListener('change',syncInteraction);groups?.addEventListener('change',syncInteraction);syncInteraction();
    }
    if(moduleId==='interaction-grouped'){
      const group=document.getElementById('inputGroup'),picker=installMethodCards(group,{label:'Wake/thrust method input groups',readNotes:()=>[document.getElementById('groupMembers')?.innerText,document.getElementById('groupHelp')?.innerText].filter(Boolean).join(' ')});
      if(picker){const refresh=()=>{picker.setLimitations([document.getElementById('groupMembers')?.innerText,document.getElementById('groupHelp')?.innerText,'Applicability: finite results do not certify empirical suitability; verify the source-domain limits.'].filter(Boolean));};group?.addEventListener('change',refresh);refresh();}
    }
    if(moduleId==='selection'){
      const hint=document.querySelector('.method-hint');
      if(hint)hint.textContent='KT Ship — Inputs: vessel resistance and propeller diameter.\nKQ Power — Inputs: vessel speed, engine power and propeller RPM.\nScreening: check the selected propeller-series domain and cavitation criterion; this screen is not a full cavitation or clearance design review.';
    }
    if(moduleId==='model-test'){
      // Example measurements, clearly identified as examples; source equations are unchanged.
      const values={lambda:'20',lm:'4.5',sm:'6.5',volumeM:'1.5',tankH:'3',tankArea:'20',modelAx:'0.3'};
      for(const [id,value] of Object.entries(values)){const field=document.getElementById(id);if(field&&!field.value)field.value=value;}
      [[0.8,9.8808],[1,16.8241],[1.2,28.7288]].forEach(([speed,resistance],i)=>{
        for(const [column,value] of [['vm',speed],['rtm',resistance]]){const field=document.querySelector(`#runRows [data-r="${i}"][data-col="${column}"]`);if(field&&!field.value)field.value=String(value);}
      });
      [2.5,3.5,4.5].forEach((length,i)=>{
        const ratio=length/4.5,example={lm:length,vm:Math.sqrt(ratio),rtm:10*ratio**3,sm:6.5*ratio**2};
        for(const [column,value] of Object.entries(example)){const field=document.querySelector(`#geoRows [data-g="${i}"][data-col="${column}"]`);if(field&&!field.value)field.value=String(Number(value.toFixed(6)));}
      });
      const note=document.createElement('p');note.className='arus-example-note';note.textContent='Example model-test values are shown. Replace them with measured data before using the results.';document.querySelector('#runRows')?.closest('.panel')?.querySelector('.pbody')?.prepend(note);
      const initializedMethods=new Set(['MT01']);
      document.addEventListener('change',event=>{
        if(event.target.id!=='method'||initializedMethods.has(event.target.value))return;
        initializedMethods.add(event.target.value);
        const factor=document.getElementById('ffManual');
        if(factor&&!factor.value){factor.value='1.2';factor.dispatchEvent(new Event('input',{bubbles:true}));}
      });
      document.getElementById('lambda')?.dispatchEvent(new Event('input',{bubbles:true}));
    }
    if(moduleId==='interaction-grouped'){
      const note=document.querySelector('.guidenote');
      if(note)note.textContent='A finite result means the equation can be evaluated; it does not certify method applicability. Review values outside 0 ≤ w,t < 1 and all method-specific limits.';
    }
    translatePage();
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; translatePage(); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
  });
  window.addEventListener('load', () => {
    if(moduleId==='performance'){
      const variant=document.getElementById('variant'),z=document.getElementById('z');
      const label=document.querySelector('label[for="variant"]');
      if(label)label.textContent='Blade count · Z';
      z?.closest('.field')?.classList.add('arus-internal-hidden');
      const sync=()=>{
        const models=window.ARUS_Module02_Test?.models;
        if(!models||!variant)return;
        const counts={};for(const option of variant.options){const m=models[option.value];if(m)counts[m.z]=(counts[m.z]||0)+1;}
        for(const option of variant.options){const m=models[option.value];if(!m)continue;
          // Each option retains its exact original model ID and native change handler.
          if(!option.dataset.originalLabel)option.dataset.originalLabel=option.textContent;
          const text=String(m.z)+(counts[m.z]>1?' — '+option.dataset.originalLabel:'');
          if(option.textContent!==text)option.textContent=text;
        }
      };
      sync();new MutationObserver(sync).observe(variant,{childList:true});
      const reWrap=document.getElementById('reWrap'),reCorrect=document.getElementById('reCorrect'),sourceRe=document.getElementById('reynolds');
      if(reWrap&&reCorrect&&sourceRe){
        sourceRe.closest('.field')?.classList.add('arus-internal-hidden');
        const grid=document.createElement('div');grid.className='arus-reynolds-grid';grid.setAttribute('aria-label','Inputs to calculate propeller Reynolds number');
        const addInput=(key,label,unit,value='')=>{
          const field=document.createElement('label');field.className='arus-re-field';field.htmlFor=`arus-re-${key}`;
          const title=document.createElement('span');title.textContent=label;
          const input=document.createElement('input');input.id=`arus-re-${key}`;input.type='number';input.step='any';input.inputMode='decimal';input.value=value;input.setAttribute('aria-label',label);
          const suffix=document.createElement('small');suffix.textContent=unit;
          field.append(title,input,suffix);grid.append(field);return input;
        };
        // Editable demonstration inputs, not recommended vessel/propeller dimensions.
        const va=addInput('va','Axial inflow velocity · Vₐ','m/s','5');
        const rpm=addInput('rpm','Propeller speed · n','rpm','120');
        const diameter=addInput('diameter','Propeller diameter · D','m','4');
        const chord=addInput('chord','Blade chord at 0.75R · c₀.₇₅','m','0.6');
        const viscosity=addInput('viscosity','Kinematic viscosity · ν','m²/s','0.0000011892');
        const resultField=document.createElement('label');resultField.className='arus-re-field arus-re-result';
        const resultTitle=document.createElement('span');resultTitle.textContent='Calculated Reynolds number · Re₀.₇₅';
        const result=document.createElement('output');result.id='arus-re-result';result.value='—';result.textContent='—';result.setAttribute('aria-live','polite');
        const resultUnit=document.createElement('small');resultUnit.textContent='dimensionless';resultField.append(resultTitle,result,resultUnit);grid.append(resultField);
        const note=document.createElement('p');note.className='arus-reynolds-note';note.textContent='Editable example values are shown. Replace them with local axial inflow, propeller RPM, diameter, actual blade chord at 0.75R and kinematic viscosity. The Reynolds number is calculated automatically; B-Series correction remains optional.';
        const checkbox=reCorrect.closest('label');
        if(checkbox){checkbox.classList.add('arus-reynolds-toggle');checkbox.after(grid,note);}
        const fields=[va,rpm,diameter,chord,viscosity];
        const formatRe=value=>Number.isFinite(value)?new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value):'—';
        const recalculateRe=()=>{
          const raw=fields.map(field=>field.value.trim());
          const complete=raw.every(value=>value!=='');
          const [axial,shaftRpm,d,c,nu]=raw.map(Number);
          const valid=complete&&Number.isFinite(axial)&&axial>=0&&Number.isFinite(shaftRpm)&&shaftRpm>0&&Number.isFinite(d)&&d>0&&Number.isFinite(c)&&c>0&&Number.isFinite(nu)&&nu>0;
          const n=shaftRpm/60;
          const re=valid?c*Math.hypot(axial,0.75*Math.PI*n*d)/nu:NaN;
          sourceRe.value=valid?String(re):(reCorrect.checked?'':'2000000');
          result.value=formatRe(re);result.textContent=formatRe(re);
          if(!valid&&reCorrect.checked)note.dataset.invalid='true';else delete note.dataset.invalid;
          if(valid&&reCorrect.checked&&(re<2e6||re>2e9))note.dataset.outOfRange='true';else delete note.dataset.outOfRange;
          sourceRe.dispatchEvent(new Event('change',{bubbles:true}));
        };
        fields.forEach(field=>field.addEventListener('input',recalculateRe));
        reCorrect.addEventListener('change',recalculateRe);
        variant?.addEventListener('change',recalculateRe);
        recalculateRe();
      }
    }
    if(moduleId==='resistance'){
      const note=document.createElement('p');note.className='arus-example-note';
      note.textContent='Example inputs are provided. Confirm method applicability and replace them with vessel data. Full workbook parity has not been established for every method.';
      document.getElementById('methodInfo')?.before(note);
      const json=document.getElementById('resultJson');
      json?.closest('details')?.classList.add('arus-internal-hidden');
      const heading=json?.closest('details')?.previousElementSibling;
      if(heading?.tagName==='H3')heading.classList.add('arus-internal-hidden');
      const vessel=document.getElementById('shipInputs');
      const syncHeading=()=>{
        const visible=[...vessel.children].some(el=>getComputedStyle(el).display!=='none'&&el.getClientRects().length);
        if(vessel.previousElementSibling)vessel.previousElementSibling.hidden=!visible;
        vessel.classList.toggle('arus-empty-inputs',!visible);
        vessel.parentElement.classList.toggle('arus-no-ship',!visible);
      };
      syncHeading();document.getElementById('method')?.addEventListener('change',syncHeading);
    }
    if (moduleId === 'geometry') {
      const sidebar = document.getElementById('sidebar');
      const heading = document.createElement('h2');
      heading.className = 'arus-input-heading';
      heading.textContent = 'Design inputs';
      sidebar.prepend(heading);
      const hint = document.getElementById('viewHint');
      const container = document.getElementById('canvasContainer');
      container.before(hint);
      const station = document.getElementById('stationChoose');
      const sectionControl = document.createElement('label');
      sectionControl.id = 'arus-section-control';
      sectionControl.append(document.createTextNode('Radial station'));
      const sectionSelect = document.createElement('select');
      sectionSelect.setAttribute('aria-label', 'Section radial station');
      sectionControl.append(sectionSelect);
      document.querySelector('.viewer-controls').prepend(sectionControl);
      const syncStation = () => {
        sectionSelect.replaceChildren(...Array.from(station.options, option => new Option(option.text, option.value)));
        sectionSelect.value = station.value;
      };
      sectionSelect.addEventListener('change', () => { station.value = sectionSelect.value; station.dispatchEvent(new Event('change', { bubbles: true })); });
      new MutationObserver(syncStation).observe(station, { childList: true });
      station.addEventListener('change', syncStation);
      syncStation();
      const axes = document.querySelector('[data-layer="axes"]');
      if (axes?.checked) {
        axes.checked = false;
        axes.dispatchEvent(new Event('change', { bubbles: true }));
      }
      axes?.closest('label')?.remove();
    }
    {
      let lastHeight=0;
      const reportHeight=()=>{
        const height=Math.ceil(Math.max(document.documentElement.scrollHeight,document.body.scrollHeight));
        if(height>=600&&height!==lastHeight){lastHeight=height;send('resize',{height});}
      };
      if(window.ResizeObserver){const observer=new ResizeObserver(()=>requestAnimationFrame(reportHeight));observer.observe(document.documentElement);observer.observe(document.body);}
      if(window.MutationObserver){const contentObserver=new MutationObserver(()=>requestAnimationFrame(reportHeight));contentObserver.observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true});}
      window.addEventListener('load',reportHeight,{once:true});
      window.addEventListener('resize',reportHeight);
      requestAnimationFrame(reportHeight);
    }
    send('ready');
  });
})();

/* ARUS v96 workflow-only presentation. Native calculation engines are untouched. */
(() => {
 'use strict';
 const init=()=>{
  const module=document.documentElement.dataset.arusModule;
  if(!['resistance','selection','interaction','interaction-grouped'].includes(module))return;
  const $=sel=>document.querySelector(sel);
  const stepper=(container)=>{
    const nav=document.createElement('div');nav.className='arus-workflow-steps';nav.setAttribute('aria-label','Calculation workflow');
    for(const [id,label] of [['method','Select method'],['input','Enter inputs'],['result','Results']]){
      const node=document.createElement('span');node.dataset.stage=id;node.textContent=label;nav.append(node);
    }
    container.prepend(nav);
    return state=>{nav.dataset.active=state;for(const item of nav.children){item.classList.toggle('is-active',item.dataset.stage===state);item.classList.toggle('is-complete',['method','input','result'].indexOf(item.dataset.stage)<['method','input','result'].indexOf(state));}};
  };
  const goto=(target)=>requestAnimationFrame(()=>target?.scrollIntoView({block:'start',behavior:'smooth'}));
  const button=(text,cls='arus-flow-action')=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;return b;};
  const note=(text)=>{const p=document.createElement('p');p.className='arus-flow-hint';p.textContent=text;return p;};
  if(module==='resistance'){
    const view=$('#view-calculator'),first=view?.querySelector(':scope > .panel'),picker=$('.arus-hull-method-picker');
    const inputs=$('#vesselFields'),actions=first?.querySelector('.actions'),results=$('#resultPanel'),run=$('#calculate'),method=$('#method');
    if(!first||!picker||!inputs||!actions||!results||!run)return;
    document.body.classList.add('arus-flow-enabled','arus-flow-resistance');
    const setStep=stepper(first);
    const caption=note('Choose the hull resistance method first. Vessel parameters will appear after selection.');
    picker.before(caption);
    const change=button('Change method','arus-flow-action arus-flow-secondary');
    change.id='arus-flow-change-resistance';actions.prepend(change);
    let chosen=false;
    const render=()=>{
      document.body.classList.toggle('arus-flow-chosen',chosen);
      caption.hidden=chosen;
      if(!chosen){
        const title=$('.arus-hull-current-name');
        if(title)title.textContent='Choose a resistance method';
        picker.querySelectorAll('.arus-hull-card').forEach(card=>{
          card.setAttribute('aria-pressed','false');
          card.querySelector('.arus-hull-selected-glyph')?.remove();
        });
      }
      const ready=chosen&&!results.classList.contains('hidden');
      results.classList.toggle('arus-flow-visible-result',ready);
      setStep(ready?'result':chosen?'input':'method');
    };
    picker.addEventListener('click',e=>{
      if(e.target.closest('.arus-hull-card')){
        chosen=true;results.classList.remove('arus-flow-visible-result');
        setTimeout(()=>{render();goto(inputs)},0);
      }
      if(e.target.closest('.arus-hull-toggle')&&chosen){
        chosen=false;results.classList.remove('arus-flow-visible-result');setTimeout(render,0);
      }
    });
    change.addEventListener('click',()=>{
      chosen=false;results.classList.add('hidden');results.classList.remove('arus-flow-visible-result');
      const toggle=$('.arus-hull-toggle');if(toggle&&$('.arus-hull-catalog')?.classList.contains('arus-hull-hidden'))toggle.click();
      render();goto(picker);
    });
    method.addEventListener('change',()=>{results.classList.remove('arus-flow-visible-result');render();});
    first.addEventListener('input',e=>{if(e.target.closest('#vesselFields')){results.classList.remove('arus-flow-visible-result');setStep('input');}},true);
    run.addEventListener('click',()=>setTimeout(()=>{
      if(!results.classList.contains('hidden')){results.classList.add('arus-flow-visible-result');setStep('result');goto(results);}
    },60));
    render();
    return;
  }
  if(module==='selection'){
    const methodBar=$('#methodBar');
    const btnKT=$('#method-kt'),btnKQ=$('#method-kq');
    if(!methodBar||!btnKT||!btnKQ)return;
    document.body.classList.add('arus-flow-enabled','arus-flow-selection');
    const setStep=stepper(methodBar);
    const intro=document.createElement('div');intro.className='arus-flow-selection-intro';intro.innerHTML='<strong>Choose the propeller selection method</strong><p>Input parameters will be shown after choosing KT Ship or KQ Power.</p>';
    methodBar.append(intro);
    const stages={kt:'method',kq:'method'};
    let chosen=null;
    const update=()=>{
      document.body.dataset.arusFlowStage=chosen?(stages[chosen]||'input'):'method';
      document.body.dataset.arusFlowMethod=chosen||'';
      setStep(chosen?(stages[chosen]||'input'):'method');
      intro.hidden=!!chosen;
      if(!chosen){
        for(const control of [btnKT,btnKQ]){
          control.classList.remove('active');control.setAttribute('aria-pressed','false');
        }
      }
    };
    for(const which of ['kt','kq']){
      const root=$('#'+which+'-mode'),form=$('#'+which+'-inputForm'),main=root?.querySelector('main.main'),aside=root?.querySelector('aside.sidebar');
      if(!root||!form||!main||!aside)continue;
      const change=button('Change method','arus-flow-action arus-flow-secondary');
      change.id='arus-flow-change-'+which;
      aside.insertBefore(change,aside.querySelector('.sidebar-head'));
      change.addEventListener('click',()=>{chosen=null;update();goto(methodBar);});
      const resetResult=()=>{stages[which]='input';if(chosen===which)update();};
      form.addEventListener('input',resetResult,true);
      form.addEventListener('change',resetResult,true);
      form.addEventListener('submit',()=>{
        stages[which]='input';update();
        // Solver yields via requestAnimationFrame + setTimeout; reveal only after Run.
        setTimeout(()=>{
          const err=$('#'+which+'-error');
          if(!err?.classList.contains('visible')&&chosen===which){stages[which]='result';update();goto(main);}
          else if(chosen===which){
            const status=aside.querySelector('.arus-flow-run-error')||note('Review the input values and run the calculation again.');
            status.classList.add('arus-flow-run-error');aside.append(status);
          }
        },450);
      });
      root.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
        // A series change can trigger native computation; only explicit Run reveals outputs.
        resetResult();
      }));
      root.querySelectorAll('button.reset').forEach(reset=>reset.addEventListener('click',resetResult));
    }
    for(const [which,control] of [['kt',btnKT],['kq',btnKQ]])control.addEventListener('click',()=>{
      chosen=which;stages[which]='input';update();goto($('#'+which+'-mode aside.sidebar'));
    });
    // Source initializes KT automatically; do not expose it as an intentional user choice.
    update();
    return;
  }
  if(module==='interaction'){
    const sheet=$('main .sheet'),sections=[...sheet?.querySelectorAll(':scope > section.block')||[]];
    if(sections.length<3)return;
    const [methodBox,inputBox,resultBox]=sections;
    document.body.classList.add('arus-flow-enabled','arus-flow-interaction');
    const setStep=stepper(sheet);
    const next=button('Continue to inputs');next.id='arus-flow-next-interaction';
    const actions=document.createElement('div');actions.className='arus-flow-bottom-actions';actions.append(next);
    methodBox.append(actions);
    const run=button('Run calculation');run.id='arus-flow-run-interaction';
    const runWrap=document.createElement('div');runWrap.className='arus-flow-bottom-actions';runWrap.append(run);
    inputBox.append(runWrap);
    const change=button('Change method','arus-flow-action arus-flow-secondary');change.id='arus-flow-change-interaction';inputBox.querySelector('.blockhead')?.append(change);
    const inputsLabel=$('#inputNote');if(inputsLabel)inputsLabel.textContent='Review the inputs, then press Run calculation to display the results.';
    let stage='method';
    const render=()=>{
      inputBox.hidden=stage==='method';resultBox.hidden=stage!=='result';
      setStep(stage);
      next.textContent=stage==='method'?'Continue to inputs':'Edit inputs';
    };
    const selectGroup=()=>{stage='input';render();goto(inputBox);};
    next.addEventListener('click',selectGroup);
    // Group selection is a deliberate method selection, including the method cards.
    $('#groupSelect')?.addEventListener('change',selectGroup);
    $('#typeSelect')?.addEventListener('change',()=>{stage='method';render();});
    inputBox.addEventListener('input',()=>{if(stage==='result'){stage='input';render();}},true);
    change.addEventListener('click',()=>{stage='method';render();goto(methodBox);});
    run.addEventListener('click',()=>{stage='result';render();goto(resultBox);});
    $('#clearInput')?.addEventListener('click',()=>{stage='input';render();});
    render();
    return;
  }
  if(module==='interaction-grouped'){
    const holder=$('main .panel')||$('main .container');
    const sections=[...holder?.querySelectorAll(':scope > section.section')||[]];
    if(sections.length<4)return;
    const [category,methodBox,inputBox,resultBox]=sections;
    document.body.classList.add('arus-flow-enabled','arus-flow-grouped');
    const setStep=stepper(holder);
    const next=button('Continue to inputs');next.id='arus-flow-next-grouped';
    const nextRow=document.createElement('div');nextRow.className='arus-flow-bottom-actions';nextRow.append(next);methodBox.append(nextRow);
    const run=button('Run calculation');run.id='arus-flow-run-grouped';
    const runRow=document.createElement('div');runRow.className='arus-flow-bottom-actions';runRow.append(run);inputBox.append(runRow);
    const change=button('Change method','arus-flow-action arus-flow-secondary');change.id='arus-flow-change-grouped';inputBox.querySelector('.parameterhead')?.append(change);
    let stage='method';
    const render=()=>{inputBox.hidden=stage==='method';resultBox.hidden=stage!=='result';setStep(stage);};
    next.addEventListener('click',()=>{stage='input';render();goto(inputBox);});
    $('#inputGroup')?.addEventListener('change',()=>{stage='input';render();goto(inputBox);});
    [$('#wakeBtn'),$('#thrustBtn')].filter(Boolean).forEach(b=>b.addEventListener('click',()=>{stage='method';render();}));
    inputBox.addEventListener('input',()=>{stage='input';render();},true);
    [$('#exampleBtn'),$('#clearGroupBtn'),$('#resetBtn')].filter(Boolean).forEach(b=>b.addEventListener('click',()=>{stage='input';render();}));
    run.addEventListener('click',()=>{stage='result';render();goto(resultBox);});
    change.addEventListener('click',()=>{stage='method';render();goto(methodBox);});
    render();
  }
 };
 window.addEventListener('DOMContentLoaded',init);
})();


/* ARUS v97 — presentation-only unified method/input/results and advanced settings. */
(() => {
 'use strict';
 const init = () => {
  const module = document.documentElement.dataset.arusModule;
  const $ = s => document.querySelector(s);
  const make = (tag, cls, txt) => { const e=document.createElement(tag); if(cls)e.className=cls; if(txt)e.textContent=txt; return e; };
  const createAdvanced = (parent,before=null) => {
    const root=make('details','arus-unified-advanced');root.id='arus-unified-advanced';
    const title=make('summary','arus-unified-summary','Advanced Settings');root.append(title);
    const content=make('div','arus-unified-advanced-body');root.append(content);
    if(before)parent.insertBefore(root,before);else parent.append(root);
    return {root,content};
  };
  const section=(container,title,node)=>{
    if(!node)return;
    const wrap=make('div','arus-unified-section');
    wrap.append(make('h3','arus-unified-group-title',title),node);
    container.append(wrap);
  };
  const harmonizeLabels=()=>{
    document.querySelectorAll('.arus-workflow-steps [data-stage="method"]').forEach(e=>e.textContent='1. Choose method');
    document.querySelectorAll('.arus-workflow-steps [data-stage="input"]').forEach(e=>e.textContent='2. Enter inputs');
    document.querySelectorAll('.arus-workflow-steps [data-stage="result"]').forEach(e=>e.textContent='3. Results');
  };
  harmonizeLabels();
  if(module==='resistance'){
    const container=$('#vesselFields'),method=$('#method'),first=$('#view-calculator > .panel');
    if(!container||!method||!first)return;
    const actions=first.querySelector(':scope > .actions');
    const {root,content}=createAdvanced(first,actions);
    let stored=[];
    const restore=()=>{
      // Before the source engine changes methods, return fields to their original
      // DOM positions. Their native change listeners depend on the original IDs.
      for(const {node,mark,open} of stored){
        if(mark.parentNode)mark.replaceWith(node);
        if(node.tagName==='DETAILS')node.open=open;
        node.classList.remove('arus-unified-inner');
        node.querySelector(':scope > summary')?.classList.remove('arus-unified-hide-summary');
      }
      stored=[];content.replaceChildren();
    };
    const move=(name,node)=>{
      if(!node||stored.some(item=>item.node===node))return;
      const mark=document.createComment('arus-advanced-field-location');
      node.before(mark);
      stored.push({node,mark,open:node.tagName==='DETAILS'?node.open:false});
      if(node.tagName==='DETAILS'){
        if(['arus-advanced-ship','arus-harvald-settings','arus-advanced-method'].includes(node.id)){
          node.classList.add('arus-unified-inner');node.open=true;
          node.querySelector(':scope > summary')?.classList.add('arus-unified-hide-summary');
        }
      }
      section(content,name,node);
    };
    const regroup=()=>{
      // A method can generate both a top-level advanced group and nested source
      // inventory. Move only top-level nodes; never move descendants twice.
      const ship=$('#arus-advanced-ship'),harvald=$('#arus-harvald-settings'),methodDetails=$('#arus-advanced-method');
      move('Ship parameters',ship);
      move('Harvald coefficients and appendages',harvald);
      if(methodDetails&&harvald?.contains(methodDetails)){
        methodDetails.open=true;methodDetails.classList.add('arus-unified-inner');
        methodDetails.querySelector(':scope > summary')?.classList.add('arus-unified-hide-summary');
      }
      if(methodDetails&&!harvald?.contains(methodDetails))move('Method-specific parameters',methodDetails);
      for(const node of [...document.querySelectorAll('.arus-source-inventory,#r01v51-additional')]){
        if(!stored.some(({node:outer})=>outer.contains(node)))move('Appendage source data',node);
      }
      for(const wrap of [...content.querySelectorAll(':scope > .arus-unified-section')]){
        if(!wrap.querySelector(':scope > :not(h3)'))wrap.remove();
      }
      root.hidden=!content.querySelector('input,select,textarea,table');
    };
    let timer;
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(regroup,170);};
    // Source dynamically builds fields after method selection. A limited observer
    // detects new group elements without interfering with in-place calculations.
    const observer=new MutationObserver(()=>{
      if(['arus-advanced-ship','arus-advanced-method','arus-harvald-settings'].some(id=>{
        const node=document.getElementById(id);return node&&!stored.some(({node:outer})=>outer===node||outer.contains(node));
      }))schedule();
    });
    observer.observe(container,{childList:true,subtree:true});
    method.addEventListener('change',()=>{restore();root.open=false;},true);
    method.addEventListener('change',schedule);
    schedule();
    document.body.classList.add('arus-v97-unified');
    return;
  }
  if(module==='model-test'){
    const layout=$('main.layout'),columns=layout?[...layout.querySelectorAll(':scope > .col')]:[];
    if(columns.length<2)return;
    const left=columns[0],right=columns[1],panels=[...left.querySelectorAll(':scope > section.panel')];
    if(panels.length<4)return;
    const [methodPanel,geometryPanel,testPanel,methodSettingsPanel]=panels;
    const method=$('#method');
    const {root,content}=createAdvanced(left,null);
    const env=$('#detailsEnv'),block=$('#blockDetails');
    const adopt=(name,detail)=>{
      if(!detail)return;
      const body=detail.querySelector(':scope > .detailbody');
      if(body){section(content,name,body);detail.closest('.advanced')?.remove();}
    };
    adopt('Water properties and environment',env);
    adopt('Blockage correction',block);
    // Method settings stay in their source section, but only one advanced menu is exposed.
    section(content,'Method coefficients and overrides',methodSettingsPanel);
    const steps=make('div','arus-workflow-steps');steps.setAttribute('aria-label','Calculation workflow');
    ['1. Choose method','2. Enter inputs','3. Results'].forEach((x,i)=>{const span=make('span','',x);span.dataset.stage=['method','input','result'][i];steps.append(span);});
    methodPanel.prepend(steps);
    const cards=methodPanel.querySelectorAll('.arus-method-card');
    const heading=methodPanel.querySelector('.phead h2');if(heading)heading.textContent='Choose extrapolation method';
    const subtitle=make('p','arus-v97-hint','Choose a method to display the required model-test inputs.');methodPanel.append(subtitle);
    const chosenBar=make('div','arus-v97-chosen-bar');
    const chosenName=make('strong','','');
    const changeBtn=make('button','arus-v97-outline','Change Method');changeBtn.type='button';
    chosenBar.append(chosenName,changeBtn);methodPanel.append(chosenBar);
    const actions=make('div','arus-flow-bottom-actions');
    const run=make('button','arus-flow-action','Run Calculation');run.id='arus-v97-run-model-test';run.type='button';actions.append(run);
    left.append(actions);
    const resultPanels=[...right.querySelectorAll(':scope > section.panel')];
    let stage='method';
    const draw=()=>{
      document.body.classList.add('arus-v97-unified','arus-v97-model-test');
      document.body.dataset.arusV97Stage=stage;
      geometryPanel.hidden=stage==='method';testPanel.hidden=stage==='method';root.hidden=stage==='method';
      resultPanels.forEach(panel=>panel.hidden=stage!=='result');
      chosenBar.hidden=stage==='method';subtitle.hidden=stage!=='method';
      chosenName.textContent=method.selectedOptions[0]?.textContent?.replace(/^MT\d+\s*—\s*/, '')||'Selected method';
      steps.dataset.active=stage;
      [...steps.children].forEach((node,i)=>{node.classList.toggle('is-active',['method','input','result'][i]===stage);node.classList.toggle('is-complete',i<['method','input','result'].indexOf(stage));});
      // Source cards must remain in the DOM to keep native method changes intact.
      methodPanel.classList.toggle('arus-v97-method-picked',stage!=='method');
    };
    const afterChoice=()=>{stage='input';draw();geometryPanel.scrollIntoView({block:'start',behavior:'smooth'});};
    methodPanel.addEventListener('click',e=>{if(e.target.closest('.arus-method-card'))setTimeout(afterChoice,0)});
    method.addEventListener('change',()=>{if(stage!=='method'){stage='input';draw();}});
    changeBtn.addEventListener('click',()=>{stage='method';draw();methodPanel.scrollIntoView({block:'start',behavior:'smooth'});});
    left.addEventListener('input',e=>{if(stage==='result'&&e.target.matches('input,select')){stage='input';draw();}},true);
    left.addEventListener('change',e=>{if(stage==='result'&&e.target.matches('input,select')){stage='input';draw();}},true);
    run.addEventListener('click',()=>{
      // The original source automatically recomputes on input. Trigger that unmodified source path.
      (document.getElementById('selectedRun')||method).dispatchEvent(new Event('input',{bubbles:true}));
      stage='result';draw();right.scrollIntoView({block:'start',behavior:'smooth'});
    });
    draw();
    return;
  }
  if(module==='selection'){
    for(const prefix of ['kt','kq']){
      const form=$('#'+prefix+'-inputForm'),fields=form?.querySelector('.fields');
      if(!form||!fields)continue;
      const {root,content}=createAdvanced(form,form.querySelector('.actionbox')||null);
      const families=[
        ['Environment and immersion',['h','rho','nu','p0','pv']],
        ['Powertrain and numerical settings',['etas','etat','eps']],
        ['Cavitation screening',['criterion','safety']]
      ];
      const moveFields=()=>{
        for(const [title,keys] of families){
          let wrap=[...content.querySelectorAll(':scope > .arus-unified-section')].find(x=>x.dataset.group===title);
          if(!wrap){wrap=make('section','arus-unified-section');wrap.dataset.group=title;
            wrap.append(make('h3','arus-unified-group-title',title),make('div','arus-v97-advanced-grid'));
            content.append(wrap);
          }
          const grid=wrap.querySelector('.arus-v97-advanced-grid');
          for(const key of keys){
            const el=form.querySelector(`[id="${prefix}-field-${key}"]`);
            const field=el?.closest('.field');if(field&&field.parentElement!==grid)grid.append(field);
          }
          wrap.hidden=!grid.querySelector('input,select');
        }
        root.hidden=!content.querySelector('input,select');
      };
      let timer;
      const schedule=()=>{clearTimeout(timer);timer=setTimeout(moveFields,80);};
      new MutationObserver(mutations=>{
        if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(
          n.matches?.('.field')||n.querySelector?.('.field')))))schedule();
      }).observe(fields,{childList:true,subtree:true});
      schedule();
      document.getElementById('method-'+prefix)?.addEventListener('click',schedule);
    }
    document.body.classList.add('arus-v97-unified','arus-v97-selection');
    return;
  }
  if(module==='interaction'||module==='interaction-grouped'){
    // No method-independent technical fields are hidden: every field of the chosen
    // interaction equation is an explicitly required input in its source method.
    document.body.classList.add('arus-v97-unified','arus-v97-interaction');
  }
 };
 document.addEventListener('DOMContentLoaded',init);
})();


/* v99 visual bridge: communicates presentation stages only. Source calculator scripts unchanged. */
(()=>{
 'use strict';
 function start(){
  const module=document.documentElement.dataset.arusModule;
  if(!['resistance','model-test','selection','interaction'].includes(module))return;
  document.body.classList.add('arus99-approved');
  const send=(stage,method='')=>window.parent.postMessage({channel:'arus-v99-ui',module,stage,method},'*');
  if(module==='selection'){
   const bar=document.querySelector('#methodBar');
   if(bar){
    const selected=document.createElement('div');selected.className='arus99-selected-choice';
    const details=document.createElement('div'),title=document.createElement('strong'),hint=document.createElement('span');
    const change=document.createElement('button');change.type='button';change.textContent='Change Method';
    details.append(title,hint);selected.append(details,change);bar.append(selected);
    const synchronize=()=>{
      const k=document.body.dataset.arusFlowMethod||'kt';
      title.textContent=k==='kq'?'KQ Power':'KT Ship';
      hint.textContent=k==='kq'?'Power and RPM-based matching':'Resistance and diameter-based matching';
    };
    change.addEventListener('click',()=>{
      const k=document.body.dataset.arusFlowMethod||'kt';
      document.getElementById('arus-flow-change-'+k)?.click();
    });
    new MutationObserver(synchronize).observe(document.body,{attributes:true,attributeFilter:['data-arus-flow-method']});
    synchronize();
   }
   for(const prefix of ['kt','kq']){
     const form=document.getElementById(prefix+'-inputForm');
     if(!form)continue;
     form.addEventListener('submit',()=>{
       setTimeout(()=>{
         const engine=window[prefix==='kt'?'__ARUS_KT__':'__ARUS_INVERSE__'];
         const current=engine?.getState?.();
         const err=document.getElementById(prefix+'-error');
         if(current?.selected&&!err?.classList.contains('visible')&&document.body.dataset.arusFlowMethod===prefix){
           document.body.dataset.arusFlowStage='result';
           send('result',prefix==='kt'?'KT Ship':'KQ Power');
         }
       },1250);
     });
     const reset=()=>{
       if(document.body.dataset.arusFlowMethod===prefix&&document.body.dataset.arusFlowStage==='result'){
         document.body.dataset.arusFlowStage='input';send('input',prefix==='kt'?'KT Ship':'KQ Power');
       }
     };
     form.addEventListener('input',reset,true);
     form.addEventListener('change',reset,true);
   }
  }
  let last='';
  const snapshot=()=>{
   let stage='method',method='';
   if(module==='resistance'){
    method=document.querySelector('.arus-hull-current-name')?.textContent?.trim()||'';
    if(document.body.classList.contains('arus-flow-chosen'))stage=document.querySelector('#resultPanel.arus-flow-visible-result')?'result':'input';
   }else if(module==='model-test'){
    stage=document.body.dataset.arusV97Stage||'method';
    method=document.querySelector('#method')?.selectedOptions?.[0]?.textContent?.trim()||'';
   }else if(module==='selection'){
    stage=document.body.dataset.arusFlowStage||'method';
    method=document.body.dataset.arusFlowMethod==='kt'?'KT Ship':document.body.dataset.arusFlowMethod==='kq'?'KQ Power':'';
   }else if(module==='interaction'){
    const sections=[...document.querySelectorAll('main .sheet > section.block')];
    stage=sections.length>=3?(sections[2].hidden?'input':'result'):'method';
    if(sections[1]?.hidden)stage='method';
    method=document.querySelector('#groupSelect')?.selectedOptions?.[0]?.textContent?.trim()||'';
   }
   const key=stage+'|'+method;if(key!==last){last=key;send(stage,method);}
  };
  // Only observe presentation changes and user actions. No writes to calculation values.
  document.addEventListener('click',()=>setTimeout(snapshot,120),true);
  document.addEventListener('change',()=>setTimeout(snapshot,120),true);
  document.addEventListener('submit',()=>setTimeout(snapshot,650),true);
  setTimeout(snapshot,240);setTimeout(snapshot,900);
 }
 document.addEventListener('DOMContentLoaded',start);
})();



/* ARUS v100 appendage visibility and reference guidance, UI-only.
   Evidence: Lothar Birk (2019) pp. 615-616 (§50.2.1); pp. 630-631, 637-638 (§51.2.6).
   The 12 standalone Excel sources remain the numerical authority for their branches.
   No engineering constants, calculations, source input values or output results changed.
*/
(() => {
 'use strict';
 const books = {
  R01:{kind:'workbook',heading:'Harvald — method-specific correction',description:'The source workbook uses Harvald-specific added wetted area and correction terms. It does not use the Holtrop (1+k₂) database as its governing formula.',reference:'01_Harvald_Standalone.xlsx; Harvald (1983) book treatment not yet verified for this exact workbook branch.'},
  R02:{kind:'integrated',heading:'Holtrop–Mennen — integrated appendage resistance',description:'The method explicitly includes RAPP based on wetted area, appendage form factors and a separate bow-thruster tunnel term. Add only components actually fitted to the vessel and not counted elsewhere.',reference:'Birk (2019), §50.2.1, pp. 615–616, Eq. 50.16–50.18 (Holtrop 1988 factor table).'},
  R03:{kind:'integrated',heading:'Hollenbach — selected appendages and transverse thrusters',description:'Include exposed shafts, brackets, bossings, fins, bilge keels and thruster openings when applicable. Rudders and skegs already represented by the Hollenbach hull wetted-surface estimate must not be added again.',reference:'Birk (2019), §51.1.2, pp. 630–631, and §51.2.6, pp. 637–638.'},
  R04:{kind:'external',heading:'Series 60 / BSRA — bare-hull regression',description:'No universal appendage factor is part of the regression selector. Do not add Holtrop (1+k₂) automatically; only use a separately justified resistance allowance supported by the applicable source.',reference:'04_Series60_BSRA_Standalone.xlsx; original appendage treatment not yet verified against a book.'},
  R05:{kind:'external',heading:'Van Oortmerssen — optional external resistance',description:'The source workbook has an optional RAPP path separate from its empirical hull regression. This is not proof that the original method prescribes Holtrop appendage factors.',reference:'05_Oortmerssen_Standalone.xlsx; van Oortmerssen (1971) original appendage treatment not fully verified.'},
  R06:{kind:'external',heading:'NPL / Series 64 — separate allowance only',description:'No universal appendage selector should be imposed on the underlying series coefficients. The workbook inventory feeds source controls; use additional resistance only where explicitly supported.',reference:'06_NPL_Series64_Standalone.xlsx; original series book/documentation not yet verified.'},
  R07:{kind:'external',heading:'NTUA Double-Chine — additional resistance',description:'The source workbook provides an optional additional-resistance path. The method regression itself does not establish a universal Holtrop appendage input.',reference:'07_NTUA_Standalone.xlsx; original NTUA method appendage guidance not yet verified.'},
  R08:{kind:'external',heading:'Savitsky / Series 62 — planing hull, no generic (1+k₂)',description:'Savitsky predicts hydrodynamic planing-surface resistance; add separate component drag only when supported by the source calculation. Series 62 must not receive an arbitrary duplicate appendage correction.',reference:'Savitsky (1964), Hydrodynamic Design of Planing Hulls; 08_Savitsky_Series62_Standalone.xlsx.'},
  R09:{kind:'external',heading:'Catamaran — source-family dependent',description:'Use only the family-specific external resistance controls provided by the workbook. Do not automatically add a universal appendage inventory to the Southampton/VWS regression.',reference:'09_Southampton_VWS_Catamaran_Standalone.xlsx; original family-specific appendage guidance not yet verified.'},
  R10:{kind:'component',heading:'Delft Yacht — keel and rudder components',description:'Keel and rudder are treated by the yacht calculation as special components. Use their source inputs; do not duplicate their resistance via a generic Holtrop appendage factor.',reference:'Gerritsma, Onnink & Versluis (1981), Delft Systematic Yacht Hull Series; 10_Delft_Yacht_Standalone.xlsx.'},
  R11:{kind:'component',heading:'Submarine / AUV — drag components',description:'Hull and external components are handled through their own drag terms (for example sail and additional exposed devices), not a common Holtrop (1+k₂) inventory.',reference:'11_Submarine_AUV_Standalone.xlsx; exact book section not yet verified.'},
  R12:{kind:'component',heading:'Hydrofoil — foil and strut resistance',description:'Foils and supports are essential calculation components in the source method. Their original drag/lift inputs remain in the normal calculation; a generic appendage inventory would double count.',reference:'12_Hydrofoil_Standalone.xlsx; exact book section not yet verified.'}
 };
 const el=(s)=>document.querySelector(s);
 let lastMethod='';let pending=0;
 const style=document.createElement('style');style.id='arus100-appendage-style';style.textContent=`
 #arus-appendage-reference{grid-column:1/-1;display:block;margin:14px 0 10px;padding:15px 17px;background:#f3f8fa;border:1px solid #d9e8ed;border-left:3px solid #168b98;border-radius:9px;color:#2b5364}
 #arus-appendage-reference .ref-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
 #arus-appendage-reference strong{font-size:12px;color:#194459}
 #arus-appendage-reference .ref-badge{background:#e8f4f5;border:1px solid #cee6e9;border-radius:12px;color:#347780;font-size:10px;font-weight:700;padding:4px 9px}
 #arus-appendage-reference p{font-size:11.5px;line-height:1.65;margin:8px 0;color:#557587}
 #arus-appendage-reference small{font-size:10px;color:#7b929e;line-height:1.5;display:block}
 body.arus100-no-quick-appendages #arus-simple-app{display:none!important}
 body.arus100-harvald #arus-simple-app .arus-app-heading>span:nth-child(4),
 body.arus100-harvald #arus-simple-app .arus-app-row>input:nth-child(4){display:none!important}
 body.arus100-harvald #arus-simple-app .arus-app-row,
 body.arus100-harvald #arus-simple-app .arus-app-heading{grid-template-columns:minmax(185px,2fr) minmax(64px,.55fr) minmax(105px,.8fr) minmax(90px,1fr) 35px}
 #arus-simple-app .arus100-rudder-warning{font-size:11px;line-height:1.6;color:#945f25;background:#fff5e8;border:1px solid #ebd6b6;border-radius:7px;padding:10px 12px;margin:8px 0}
 @media(max-width:800px){body.arus100-harvald #arus-simple-app .arus-app-row{grid-template-columns:1fr 80px 105px 34px}}
 `;document.head.append(style);
 function apply(){
  if(document.documentElement.dataset.arusModule!=='resistance')return;
  const method=el('#method')?.value;
  const conf=books[method];if(!conf)return;
  const workspace=el('#view-calculator');
  const parent=el('#methodInputs')?.parentElement||workspace;if(!parent)return;
  document.body.classList.toggle('arus100-no-quick-appendages',!['R01','R02','R03'].includes(method));
  document.body.classList.toggle('arus100-harvald',method==='R01');
  let notice=el('#arus-appendage-reference');
  if(!notice){notice=document.createElement('section');notice.id='arus-appendage-reference';notice.setAttribute('aria-live','polite');}
  const status=['R02','R03'].includes(method)?'Confirmed in Birk (2019)':(method==='R01'?'Workbook correction':'Source-specific / book review pending');
  const family=method==='R09'?(el('#catFamily')?.value||'Southampton'):'';
  const hint=method==='R09'?` Selected regression family: ${family}.`:'';
  notice.innerHTML='';
  const top=document.createElement('div');top.className='ref-top';
  const title=document.createElement('strong');title.textContent=conf.heading;
  const badge=document.createElement('span');badge.className='ref-badge';badge.textContent=status;top.append(title,badge);
  const p=document.createElement('p');p.textContent=conf.description+hint;
  const small=document.createElement('small');small.textContent='Reference: '+conf.reference;
  notice.append(top,p,small);
  // Place above the input panel: clear method context without obscuring the method selector.
  const native=el('#arus-simple-app');
  if(native?.parentElement===parent)parent.insertBefore(notice,native);
  else if(el('#methodInputs')?.parentElement===parent)parent.insertBefore(notice,el('#methodInputs').nextSibling);
  else parent.prepend(notice);
  if(native){
    if(method==='R01'){
      const desc=native.querySelector('.arus-app-lead');if(desc)desc.textContent='Appendage wetted area and Harvald-specific factors from the source workbook; Holtrop (1+k₂) is not used here.';
    }else if(method==='R02'){
      const desc=native.querySelector('.arus-app-lead');if(desc)desc.textContent='Add only installed appendages and specify their actual wetted area. Factors are taken from the source Excel table; compare them against the cited book before scientific use.';
    }else if(method==='R03'){
      const desc=native.querySelector('.arus-app-lead');if(desc)desc.textContent='Add eligible appendages only. Do not re-add rudders or skegs already represented in the hull wetted surface.';
      for(const choice of native.querySelectorAll('.arus-app-type')){
        for(const opt of choice.options){
          if(/rudder|skeg/i.test(opt.value)){
            opt.disabled=opt.value!==choice.value;
            opt.title='Hollenbach rudder/skeg inclusion requires a wetted-area check (Birk 2019, pp. 631, 637).';
          }
        }
      }
      const used=[...native.querySelectorAll('.arus-app-type')].some(x=>/rudder|skeg/i.test(x.value));
      let warning=native.querySelector('.arus100-rudder-warning');
      if(used){
        if(!warning){warning=document.createElement('div');warning.className='arus100-rudder-warning';native.append(warning);}
        warning.textContent='Warning: rudder/skeg selected while Hollenbach can already include it in the hull wetted surface. Confirm S definition before Run to prevent double counting.';
      }else warning?.remove();
    }
  }
  lastMethod=method;
 }
 function queue(){clearTimeout(pending);pending=setTimeout(apply,200)}
 document.addEventListener('DOMContentLoaded',()=>{queue();setTimeout(apply,650);setTimeout(apply,1200);const box=el('#methodInputs');if(box)new MutationObserver(()=>{if(el('#arus-appendage-reference')?.isConnected)queue()}).observe(box,{childList:true});});
 document.addEventListener('change',event=>{if(event.target?.id==='method'||event.target?.id==='catFamily')queue()},true);
 document.addEventListener('click',event=>{if(event.target.closest('#arus-simple-app,.arus-hull-card,#reset'))queue()},true);
 window.ARUS_APPENDAGE_REFERENCE_UI={version:'v100',sourcePolicy:books,numericalEngineChanged:false,refresh:apply};
})();



/* ARUS propeller preview enhancement v101 */
(() => {
  'use strict';
  const moduleId = document.documentElement.dataset.arusModule;
  if (moduleId !== 'performance' && moduleId !== 'selection') return;

  const byId = id => document.getElementById(id);
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const optionLabel = el => {
    if (!el) return '';
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      return (opt?.textContent || el.value || '').trim();
    }
    return (el.textContent || el.value || '').trim();
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fmt = (v, d = 2) => Number.isFinite(v) ? Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d }) : '–';

  function ensureStyle() {
    if (byId('arus-prop-preview-style')) return;
    const style = document.createElement('style');
    style.id = 'arus-prop-preview-style';
    style.textContent = `
      .arus-prop-panel{margin-bottom:22px}
      .arus-prop-grid{display:grid;grid-template-columns:minmax(250px,360px) minmax(220px,1fr);gap:18px;align-items:stretch}
      .arus-prop-canvas-wrap{position:relative;border:1px solid #d8e6ec;border-radius:10px;background:linear-gradient(180deg,#fbfdff 0%,#f2f7fa 100%);min-height:310px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}
      .arus-prop-canvas-wrap::after{content:'';position:absolute;inset:auto 10% 16px 10%;height:22px;border-radius:50%;background:radial-gradient(circle at center,rgba(30,64,94,.20),rgba(30,64,94,0));pointer-events:none}
      .arus-prop-canvas{display:block;width:100%;height:320px}
      /* v116: parity with the Propeller CAD Geometry Design Inputs panel */
      .arus-prop-canvas-wrap::after{display:none!important}
      .arus-cad-design-preview{background:#fff;border:1px solid #dbe7ed;border-radius:12px;padding:18px 20px;margin:0 0 16px;box-shadow:0 7px 24px rgba(20,49,68,.035)}
      .arus-cad-design-preview .arus-cad-input-title{font-size:16px;font-weight:700;color:#183749;margin-bottom:18px;line-height:1.4}
      .arus-cad-design-preview .arus-cad-input-caption{font-size:10px;font-weight:700;letter-spacing:.09em;color:#7992a7;border-top:1px solid #e5edf1;padding-top:15px;margin:15px 0 12px}
      .arus-cad-design-preview .arus-cad-input-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px 14px}
      .arus-cad-design-preview .arus-cad-input-grid.top{grid-template-columns:repeat(4,minmax(0,1fr))}
      .arus-cad-design-preview label{display:flex;flex-direction:column;min-width:0;gap:8px;font-size:12px;color:#355d70;font-weight:600}
      .arus-cad-design-preview input,.arus-cad-design-preview select{height:40px;min-width:0;width:100%;border:1px solid #d6e3ea;border-radius:8px;background:#fff;color:#274b60;padding:0 11px;font:13px Arial,sans-serif;box-sizing:border-box}
      .arus-cad-design-preview input[readonly],.arus-cad-design-preview select[disabled]{background:#f5f9fb;cursor:default;color:#496779;opacity:1}
      .arus-cad-design-preview :is(input,select):focus-visible{outline:2px solid #168890;outline-offset:2px}
      .arus-cad-design-preview .arus-cad-design-note{font-size:11px;color:#7592a4;margin:14px 0 0;line-height:1.5}
      .arus-cad-design-preview .arus-cad-geometry-options{display:flex;flex-wrap:wrap;gap:12px;margin-top:15px;border-top:1px solid #e5edf1;padding-top:12px}
      .arus-cad-design-preview .arus-cad-geometry-options label{display:inline-flex;flex-direction:row;gap:8px;align-items:center;color:#426479}
      .arus-cad-design-preview .arus-cad-geometry-options input{width:16px;height:16px;accent-color:#167b83}
      @media(max-width:850px){.arus-cad-design-preview .arus-cad-input-grid,.arus-cad-design-preview .arus-cad-input-grid.top{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:540px){.arus-cad-design-preview .arus-cad-input-grid,.arus-cad-design-preview .arus-cad-input-grid.top{grid-template-columns:1fr}}

      .arus-prop-meta{display:flex;flex-direction:column;gap:10px}
      .arus-prop-note{font-size:11px;color:#6d8395;line-height:1.5}
      .arus-prop-tagrow,.arus-prop-statrow{display:flex;flex-wrap:wrap;gap:8px}
      .arus-prop-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:#f5fafc;border:1px solid #dce8ef;color:#34566f;font-size:11px;font-weight:700;line-height:1.25}
      .arus-prop-chip b{font-weight:800;color:#17384f}
      .arus-prop-hero{padding:12px 14px;border:1px solid #dce8ef;border-radius:10px;background:#fff}
      .arus-prop-hero strong{display:block;font-size:14px;color:#17384f;margin-bottom:3px}
      .arus-prop-hero small{display:block;color:#71879b;font-size:11px;line-height:1.55}
      .arus-prop-mini{font-size:11px;color:#5f7488}
      /* v111: A CAD view is self-explanatory; suppress redundant prose. */
      #arus-performance-preview .arus-prop-meta,
      #kt-propPreviewCard .arus-prop-meta,
      #kq-propPreviewCard .arus-prop-meta{display:none!important}
      #arus-performance-preview .arus-prop-grid{display:block!important}
      #arus-performance-preview .arus-prop-canvas-wrap{width:100%}
      #kt-mode .aside-note,#kq-mode .aside-note{display:none!important}
      /* Row selection is native in both solver tables; no action pill is needed. */
      #kt-mode tbody tr[data-id],#kq-mode tbody tr[data-id]{cursor:pointer;transition:background-color .15s,border-color .15s}
      #kt-mode tbody tr[data-id]:hover,#kq-mode tbody tr[data-id]:hover{background:#ecf8f8!important}
      #kt-mode tbody tr[data-id]:focus-visible,#kq-mode tbody tr[data-id]:focus-visible{outline:2px solid #167b83;outline-offset:-2px}
      #kt-mode tbody tr[data-id].selected,#kq-mode tbody tr[data-id].selected{background:#e4f5f4!important}
      .arus-choose-wrap{display:none!important}
      /* Series controls reside above the input fields instead of in the results. */
      .arus111-series-selection{margin:0 0 18px;padding:17px 18px;border:1px solid #dce8ec;border-radius:10px;background:#f9fcfd}
      .arus111-series-heading{font-weight:760;color:#1a4356;font-size:13px;margin-bottom:10px}
      .arus111-series-selection .tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:0;border:0;padding:0;background:transparent}
      .arus111-series-selection .tab[aria-pressed="true"]{border-color:#16a2a4!important;background:#eaf8f6!important;color:#0c6873!important;box-shadow:inset 0 -2px 0 #158d96}
      .arus111-series-selection .tab:focus-visible{outline:2px solid #167b83;outline-offset:2px}
      .arus111-series-selection .tab{display:flex;justify-content:center;align-items:center;text-align:center;min-height:44px;border:1px solid #dce8ed;border-radius:8px;background:#fff;color:#34566a;font-size:12px;font-weight:700;padding:10px;transition:background .16s,border-color .16s}
      .arus111-series-selection .tab.active{border-color:#16a2a4!important;background:#eaf8f6!important;color:#0c6873!important;box-shadow:inset 0 -2px 0 #158d96}
      .arus111-series-selection .tab:hover{background:#f0f9fa;border-color:#8bc2c5}
      .arus111-series-selection .tab span{display:none!important}
      /* v117 — Selection-only full method-gallery design. */
      html[data-arus-module="selection"] .arus117-series-selector{margin:0 0 20px;padding:18px 20px;background:#fff;border:1px solid #dce5ea;border-radius:12px;box-shadow:0 7px 22px rgba(18,50,67,.045)}
      html[data-arus-module="selection"] .arus117-choose-heading{display:flex;flex-direction:column;gap:5px;margin-bottom:16px}
      html[data-arus-module="selection"] .arus117-choose-heading strong{font-size:15px;line-height:1.5;color:#173a4d;font-weight:750}
      html[data-arus-module="selection"] .arus117-choose-heading span{font-size:11px;line-height:1.5;color:#788e9c}
      html[data-arus-module="selection"] .arus117-category{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid #e1ebef;padding:4px 0 8px;margin:14px 0 10px}
      html[data-arus-module="selection"] .arus117-category strong{font-size:12px;font-weight:750;color:#153a4f}
      html[data-arus-module="selection"] .arus117-category span{font-size:11px;color:#7993a2}
      html[data-arus-module="selection"] .arus117-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      html[data-arus-module="selection"] .arus117-series-card{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:6px;min-width:0;min-height:71px;padding:12px 14px!important;margin:0!important;background:#fff!important;color:#173b52!important;border:1px solid #dbe6ec!important;border-radius:9px!important;box-shadow:none!important;text-align:left!important;cursor:pointer;transition:border-color 160ms,background-color 160ms,box-shadow 160ms,transform 160ms}
      html[data-arus-module="selection"] .arus117-series-card strong{font-family:Arial,sans-serif;font-size:12px;line-height:1.45;font-weight:750;letter-spacing:0;color:#193d50}
      html[data-arus-module="selection"] .arus117-series-card small{font-family:Arial,sans-serif;font-size:10px;line-height:1.45;font-weight:400;color:#7890a0}
      html[data-arus-module="selection"] .arus117-series-card:hover{background:#f0f9f8!important;border-color:#8fc1c5!important;box-shadow:0 3px 10px rgba(14,97,109,.06)!important}
      html[data-arus-module="selection"] .arus117-series-card:focus-visible{outline:2px solid #168c99;outline-offset:2px}
      html[data-arus-module="selection"] .arus117-selected{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 15px;background:#eef9f7;border:1px solid #d1e7e5;border-radius:9px}
      html[data-arus-module="selection"] .arus117-selected[hidden],html[data-arus-module="selection"] .arus117-choose[hidden]{display:none!important}
      html[data-arus-module="selection"] .arus117-selected>div{display:flex;flex-direction:column;gap:4px;min-width:0}
      html[data-arus-module="selection"] .arus117-selected>div span{font-size:10px;font-weight:750;letter-spacing:.09em;color:#6c929b}
      html[data-arus-module="selection"] .arus117-selected>div strong{font-size:13px;line-height:1.4;color:#173d51}
      html[data-arus-module="selection"] .arus117-selected>div small{font-size:10px;line-height:1.4;color:#718e9d}
      html[data-arus-module="selection"] .arus117-change{flex-shrink:0;min-height:36px;padding:8px 13px!important;background:#fff!important;color:#28566d!important;border:1px solid #c8dce6!important;border-radius:8px!important;cursor:pointer;font:700 11px Arial,sans-serif!important}
      html[data-arus-module="selection"] .arus117-change:hover{background:#f5fbfc!important;border-color:#7fb9bf!important}
      html[data-arus-module="selection"] .arus117-native-tabs{display:none!important}
      html[data-arus-module="selection"] .mode-root[data-arus-series-stage="choose"] #arus-flow-change-kt,
      html[data-arus-module="selection"] .mode-root[data-arus-series-stage="choose"] #arus-flow-change-kq{display:none!important}
      html[data-arus-module="selection"] .mode-root[data-arus-series-stage="choose"]> .shell>.sidebar>.sidebar-head,
      html[data-arus-module="selection"] .mode-root[data-arus-series-stage="choose"]> .shell>.sidebar>#kt-inputForm,
      html[data-arus-module="selection"] .mode-root[data-arus-series-stage="choose"]> .shell>.sidebar>#kq-inputForm,
      html[data-arus-module="selection"] .mode-root[data-arus-series-stage="choose"]> .shell>.main{display:none!important}
      @media(max-width:780px){html[data-arus-module="selection"] .arus117-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:480px){html[data-arus-module="selection"] .arus117-card-grid{grid-template-columns:1fr}html[data-arus-module="selection"] .arus117-selected{align-items:flex-start;flex-direction:column}html[data-arus-module="selection"] .arus117-change{align-self:flex-end}}
      @media(max-width:1050px){.arus111-series-selection .tabs{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:850px){.arus111-series-selection .tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:540px){.arus111-series-selection .tabs{grid-template-columns:1fr}}
      .arus-selection-preview{display:grid;grid-template-columns:minmax(320px,420px) minmax(220px,1fr);gap:14px;align-items:stretch;margin-top:14px;padding:14px 16px;border:1px solid #e4edf2;border-radius:10px;background:#fbfdff}
      .arus-selection-preview .arus-prop-canvas{height:270px}
      .arus-performance-chart-wrap{display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:16px;align-items:start;margin-bottom:18px}
      .arus-performance-chart-wrap>section{min-width:0;margin:0}
      .arus-performance-chart-wrap #arus-performance-preview .arus-prop-grid{display:flex;flex-direction:column;gap:12px}
      .arus-performance-chart-wrap #arus-performance-preview .arus-prop-meta{min-width:0}
      .arus-performance-chart-wrap #arus-performance-preview .arus-prop-canvas-wrap{width:100%}
      .arus-performance-chart-wrap #arus-performance-preview .arus-prop-mini{overflow-wrap:break-word}
      .arus-selection-chart-wrap{grid-template-columns:minmax(300px,380px) minmax(0,1fr)}
      .arus-selection-chart-wrap #kt-chartsArea,.arus-selection-chart-wrap #kq-chartsArea{width:100%;min-width:0}
      .arus-selection-chart-wrap .arus-selection-preview{display:grid;grid-template-columns:minmax(340px,420px) minmax(0,1fr);gap:12px;height:auto;align-items:start}
      .arus-selection-chart-wrap .arus-selection-preview .arus-prop-meta{min-width:0}
      .arus-selection-chart-wrap .arus-selection-preview .arus-prop-canvas-wrap{width:100%}
      @media(max-width:1100px){.arus-performance-chart-wrap,.arus-selection-chart-wrap{grid-template-columns:minmax(0,1fr)}}
      .arus-selection-chart-wrap{display:grid;grid-template-columns:minmax(260px,320px) minmax(0,1fr);gap:16px;align-items:start;margin-top:14px}
      .arus-selection-chart-wrap>.arus-selection-preview{margin-top:0;height:auto;align-self:start}
      .arus-selection-chart-wrap>:not(.arus-selection-preview){min-width:0}
      .arus-selection-preview-inline .arus-prop-canvas{height:360px}
      .arus-selection-preview-inline .arus-prop-meta{align-content:start}
      .arus-choose-wrap{display:flex;justify-content:flex-start;margin-top:6px}
      .arus-choose-btn{appearance:none;border:1px solid #167b83;background:#edf9f9;color:#0c6770;border-radius:999px;padding:4px 10px;font-size:10px;font-weight:800;letter-spacing:.02em;cursor:pointer}
      .arus-choose-btn:hover{background:#dff3f3}
      .arus-preview-empty{display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:#8294a6;text-align:center;padding:0 22px}
      @media (max-width:1100px){.arus-selection-chart-wrap{grid-template-columns:1fr}}
      @media (max-width:920px){.arus-prop-grid,.arus-selection-preview{grid-template-columns:1fr}.arus-prop-canvas{height:235px}.arus-selection-preview .arus-prop-canvas{height:230px}}
      /* v118: matching 3D and KT-KQ-J card heights; presentation-only. */
      @media (min-width:961px){
        .arus-performance-chart-wrap,
        .arus-selection-chart-wrap{
          display:grid!important;
          grid-template-columns:minmax(320px,32fr) minmax(0,68fr)!important;
          align-items:stretch!important;
          gap:16px!important;
        }
      }
      .arus-performance-chart-wrap > #arus-performance-preview,
      .arus-selection-chart-wrap > .arus-selection-preview{
        display:flex!important;
        flex-direction:column!important;
        box-sizing:border-box!important;
        align-self:stretch!important;
        height:auto!important;
        min-width:0!important;
        min-height:0!important;
        margin:0!important;
      }
      .arus-performance-chart-wrap > section:not(#arus-performance-preview),
      .arus-selection-chart-wrap > #kt-chartsArea,
      .arus-selection-chart-wrap > #kq-chartsArea{
        box-sizing:border-box!important;
        align-self:stretch!important;
        height:auto!important;
        min-width:0!important;
        margin:0!important;
      }
      .arus-performance-chart-wrap #arus-performance-preview .arus-prop-grid{
        display:flex!important;flex:1 1 auto;flex-direction:column!important;min-height:0!important;
      }
      .arus-performance-chart-wrap #arus-performance-preview .arus-prop-canvas-wrap,
      .arus-selection-chart-wrap > .arus-selection-preview .arus-prop-canvas-wrap{
        display:flex!important;
        flex:1 1 auto!important;
        flex-direction:column!important;
        box-sizing:border-box!important;
        min-width:0!important;
        width:100%!important;
        min-height:0!important;
        overflow:hidden!important;
      }
      .arus-performance-chart-wrap iframe.arus-native-cad-frame,
      .arus-selection-chart-wrap iframe.arus-native-cad-frame{
        display:block!important;
        flex:1 1 auto!important;
        box-sizing:border-box!important;
        width:100%!important;
        height:100%!important;
        min-height:490px!important;
        border:0!important;
      }
      @media (max-width:960px){
        .arus-performance-chart-wrap,.arus-selection-chart-wrap{
          display:grid!important;
          grid-template-columns:minmax(0,1fr)!important;
          align-items:start!important;
          gap:16px!important;
        }
        .arus-performance-chart-wrap > #arus-performance-preview,
        .arus-selection-chart-wrap > .arus-selection-preview{height:auto!important;min-height:0!important}
        .arus-performance-chart-wrap iframe.arus-native-cad-frame,
        .arus-selection-chart-wrap iframe.arus-native-cad-frame{height:510px!important;min-height:510px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function familyProfile(cfg) {
    const name = String(cfg.family || cfg.type || '').toLowerCase();
    let root = 0.17, tip = 0.78, skew = 0.22, rake = 0.05, chord = 0.18, camber = 0.10;
    if (name.includes('kaplan') || name.includes('nozzle')) { root = 0.20; tip = 0.82; skew = 0.09; rake = 0.03; chord = 0.28; camber = 0.12; }
    else if (name.includes('gawn')) { root = 0.16; tip = 0.80; skew = 0.14; rake = 0.02; chord = 0.16; camber = 0.09; }
    else if (name.includes('nau')) { root = 0.17; tip = 0.79; skew = 0.24; rake = 0.04; chord = 0.17; camber = 0.10; }
    else if (name.includes('mau')) { root = 0.17; tip = 0.79; skew = 0.26; rake = 0.05; chord = 0.17; camber = 0.10; }
    else if (name.includes('b-series') || name.includes('b series') || name.includes('b4') || name.includes('b5')) { root = 0.18; tip = 0.79; skew = 0.20; rake = 0.04; chord = 0.19; camber = 0.10; }
    const z = clamp(num(cfg.blades, 4), 3, 8);
    const ae = clamp(num(cfg.ae, 0.60), 0.30, 1.40);
    const pd = clamp(num(cfg.pd, 0.90), 0.35, 1.80);
    chord *= clamp(0.70 + ae * 0.50, 0.75, 1.35);
    skew *= clamp(0.75 + Math.max(0, z - 3) * 0.06 + Math.max(0, pd - 0.9) * 0.24, 0.65, 1.45);
    rake += Math.max(0, pd - 0.70) * 0.055;
    const pitch = clamp(0.26 + pd * 0.25, 0.28, 0.72);
    return { root, tip, skew, rake, chord, camber, pitch, z };
  }

  function drawEmpty(canvas, lines) {
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(250, Math.round(rect.width || 320));
    const H = Math.max(190, Math.round(rect.height || 220));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#eef4f7';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8294a6';
    ctx.font = '600 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const arr = Array.isArray(lines) ? lines : [String(lines || '')];
    arr.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 + i * 18 - (arr.length - 1) * 9));
  }

  function drawPropeller(canvas, cfg) {
    if (!canvas) return;
    const blades = clamp(num(cfg.blades, 4), 3, 8);
    if (!Number.isFinite(blades)) return drawEmpty(canvas, ['Preview unavailable']);
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(260, Math.round(rect.width || 360));
    const H = Math.max(210, Math.round(rect.height || 250));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const cx = W * 0.40, cy = H * 0.52;
    const scale = Math.min(W, H) * 0.88;
    const p = familyProfile(cfg);

    ctx.fillStyle = '#f6fbfd';
    ctx.fillRect(0, 0, W, H);

    function rotateAndProject(point) {
      let [x, y, z] = point;
      const rz = 0.78, rx = -0.98;
      const x1 = x * Math.cos(rz) - y * Math.sin(rz);
      const y1 = x * Math.sin(rz) + y * Math.cos(rz);
      const z1 = z;
      const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);
      const perspective = 1.0 / Math.max(0.55, 1.35 - z2 * 0.65);
      return { x: cx + x1 * scale * 0.72 * perspective, y: cy + y2 * scale * 0.72 * perspective, z: z2 };
    }

    const bladeSurfaces = [];
    for (let b = 0; b < p.z; b++) {
      const baseAngle = b * (Math.PI * 2 / p.z);
      const lead = [], trail = [], mids = [];
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        const r = p.root + (p.tip - p.root) * s;
        const plan = 1 - Math.abs((s - 0.46) / 0.56);
        const chord = p.chord * (0.40 + 0.95 * Math.max(0, plan)) * (0.92 - 0.18 * s);
        const skew = p.skew * Math.pow(s, 1.55);
        const rake = p.rake * (0.30 + 0.70 * s);
        const pitchLift = p.pitch * (0.18 + 0.82 * (1 - s)) + p.camber * (0.20 + 0.65 * s);
        const ang = baseAngle + skew;
        const center = [r * Math.cos(ang), r * Math.sin(ang), rake];
        const tangent = [-Math.sin(ang), Math.cos(ang), 0];
        const leadPt = [center[0] + tangent[0] * chord * 0.62, center[1] + tangent[1] * chord * 0.62, center[2] + pitchLift];
        const trailPt = [center[0] - tangent[0] * chord * 0.38, center[1] - tangent[1] * chord * 0.38, center[2] - pitchLift * 0.58];
        lead.push(rotateAndProject(leadPt));
        trail.unshift(rotateAndProject(trailPt));
        mids.push(rotateAndProject(center));
      }
      const polygon = [...lead, ...trail];
      const avg = polygon.reduce((sum, pt) => sum + pt.z, 0) / Math.max(1, polygon.length);
      bladeSurfaces.push({ polygon, avg, mids });
    }
    bladeSurfaces.sort((a, b) => a.avg - b.avg);

    ctx.save();
    ctx.fillStyle = 'rgba(27,58,83,.14)';
    ctx.beginPath();
    ctx.ellipse(cx + 14, H * 0.80, Math.min(W, H) * 0.20, Math.min(W, H) * 0.06, -0.10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const hubBack = rotateAndProject([0, 0, -0.18]);
    const hubFront = rotateAndProject([0, 0, 0.18]);
    const hubRx = scale * 0.090, hubRy = scale * 0.062;
    ctx.save();
    ctx.fillStyle = '#b6c4cf';
    ctx.beginPath();
    ctx.ellipse(hubBack.x, hubBack.y, hubRx * 0.92, hubRy * 0.92, 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (const blade of bladeSurfaces) {
      const poly = blade.polygon;
      if (!poly.length) continue;
      const x0 = Math.min(...poly.map(pt => pt.x)), x1 = Math.max(...poly.map(pt => pt.x));
      const y0 = Math.min(...poly.map(pt => pt.y)), y1 = Math.max(...poly.map(pt => pt.y));
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, '#d8b26a');
      gradient.addColorStop(0.50, '#f1cb82');
      gradient.addColorStop(1, '#b9873f');
      ctx.save();
      ctx.beginPath();
      poly.forEach((pt, index) => {
        if (index === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.strokeStyle = '#91692d';
      ctx.lineWidth = 1.1;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      blade.mids.forEach((pt, index) => { if (index === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    const shaftFront = rotateAndProject([-0.18, 0, 0]);
    const shaftEnd = rotateAndProject([0.62, 0, 0]);
    ctx.strokeStyle = '#6e7f8d';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shaftFront.x, shaftFront.y);
    ctx.lineTo(shaftEnd.x, shaftEnd.y);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const hubGrad = ctx.createLinearGradient(hubFront.x - hubRx, hubFront.y - hubRy, hubFront.x + hubRx, hubFront.y + hubRy);
    hubGrad.addColorStop(0, '#d9e1e7');
    hubGrad.addColorStop(0.55, '#bfcbd5');
    hubGrad.addColorStop(1, '#8fa0ad');
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.ellipse(hubFront.x, hubFront.y, hubRx, hubRy, 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#788994';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#64747f';
    ctx.arc(hubFront.x, hubFront.y, Math.max(4, hubRx * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#748b9d';
    ctx.font = '600 11px Arial, sans-serif';
    ctx.fillText('3D preview · visual only', 16, H - 14);
    ctx.restore();
  }

  function setCardValues(scope, cfg, mode) {
    if (!scope) return;
    const hero = scope.querySelector('[data-role="hero"]');
    const detail = scope.querySelector('[data-role="detail"]');
    const chips = scope.querySelector('[data-role="chips"]');
    const stats = scope.querySelector('[data-role="stats"]');
    if (hero) hero.innerHTML = `<strong>3D propeller preview</strong><small>Visual preview only</small>`;
    if (detail) detail.textContent = mode === 'performance' ? 'Preview follows the active configuration in Propeller Performance. Geometry display is visual only; workbook coefficients and calculation outputs are unchanged.' : 'Preview follows the currently selected propeller in Propeller Selection. The Choose button only selects a candidate for inspection and does not alter the ranking formulas.';
    if (chips) {
      const items = [
        ['Blades', Number.isFinite(cfg.blades) ? String(cfg.blades) : '–'],
        ['AE/A₀', Number.isFinite(cfg.ae) ? fmt(cfg.ae, 2) : '–'],
        ['P/D', Number.isFinite(cfg.pd) ? fmt(cfg.pd, 2) : '–']
      ];
      if (Number.isFinite(cfg.diameter) && cfg.diameter > 0) items.push(['D', fmt(cfg.diameter, 4) + ' m']);
      chips.innerHTML = items.map(([k, v]) => `<span class="arus-prop-chip"><b>${k}</b> ${v}</span>`).join('');
    }
    if (stats) {
      const items = [];
      if (Number.isFinite(cfg.rpm) && cfg.rpm > 0) items.push(`<span class="arus-prop-chip"><b>RPM</b> ${fmt(cfg.rpm, 3)}</span>`);
      if (Number.isFinite(cfg.eta)) items.push(`<span class="arus-prop-chip"><b>η₀</b> ${fmt(cfg.eta * 100, 3)}%</span>`);
      if (Number.isFinite(cfg.power) && cfg.power > 0) items.push(`<span class="arus-prop-chip"><b>Power</b> ${fmt(cfg.power, 3)} kW</span>`);
      stats.innerHTML = items.join('');
    }
  }

  function renderCard(scope, cfg, mode) {
    if (!scope) return;
    const canvas = scope.querySelector('canvas');
    if (!cfg || !(Number.isFinite(cfg.blades) && Number.isFinite(cfg.ae) && Number.isFinite(cfg.pd))) {
      setCardValues(scope, {
        family: '–', model: mode === 'performance' ? 'Choose a configuration' : 'Run and choose a propeller', type: '', config: '', blades: NaN, ae: NaN, pd: NaN
      }, mode);
      drawEmpty(canvas, mode === 'performance' ? ['Choose the series and model,', 'then update the diagram.'] : ['Run the calculation, then use', 'Pilih on a ranked propeller.']);
      return;
    }
    setCardValues(scope, cfg, mode);
    drawPropeller(canvas, cfg);
  }

  function performanceConfig() {
    const family = optionLabel(byId('family'));
    const modelLabel = optionLabel(byId('variant'));
    const models = window.ARUS_Module02_Test?.models || {};
    const modelKey = byId('variant')?.value || '';
    const model = models[modelKey] || {};
    return {
      family,
      type: family,
      model: modelLabel,
      config: model.source || '',
      blades: num(byId('z')?.value, num(model.z, NaN)),
      ae: num(byId('ear')?.value, num(model.ae ?? model.ear, NaN)),
      pd: num(byId('pd')?.value, num(model.pd, NaN)),
      diameter: NaN,
      rpm: NaN,
      eta: NaN,
      power: NaN
    };
  }

  function ensurePerformancePanel() {
    const host = document.querySelector('.content');
    if (!host) return null;
    let panel = byId('arus-performance-preview');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'panel section-pad arus-prop-panel';
    panel.id = 'arus-performance-preview';
    panel.innerHTML = `
      <div class="headrow"><div><h2>3D propeller preview</h2><p class="section-sub">Visual design based on the active performance configuration</p></div></div>
      <div class="arus-prop-grid">
        <div class="arus-prop-canvas-wrap"><canvas class="arus-prop-canvas" aria-label="3D propeller preview" id="arus-performance-canvas"></canvas></div>
        <div class="arus-prop-meta">
          <div class="arus-prop-hero"><div data-role="hero"></div><div class="arus-prop-note" data-role="detail"></div></div>
          <div class="arus-prop-tagrow" data-role="chips"></div>
          <div class="arus-prop-statrow" data-role="stats"></div>
          <div class="arus-prop-mini">Visual preview only. Calculation core, coefficients, and exported data remain unchanged.</div>
        </div>
      </div>`;
    const tableSection = byId('tableTitle')?.closest('section');
    if (tableSection && tableSection.parentElement === host) host.insertBefore(panel, tableSection); else host.appendChild(panel);
    return panel;
  }

  function arrangePerformancePanel() {
    const panel = byId('arus-performance-preview');
    const chart = byId('curveCanvas')?.closest('section');
    if (!panel || !chart) return;
    let wrap = byId('arus-performance-chartWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'arus-performance-chart-wrap';
      wrap.id = 'arus-performance-chartWrap';
      chart.parentElement.insertBefore(wrap, chart);
    }
    // The native-CAD iframe is moved with its panel; this does not rebuild the mesh.
    if (panel.parentElement !== wrap) wrap.appendChild(panel);
    if (chart.parentElement !== wrap) wrap.appendChild(chart);
  }

  function updatePerformancePanel() {
    const panel = ensurePerformancePanel();
    if (!panel) return;
    arrangePerformancePanel();
    renderCard(panel, performanceConfig(), 'performance');
  }

  function selectionState(prefix) {
    return prefix === 'kt' ? window.__ARUS_KT__?.getState?.() : window.__ARUS_INVERSE__?.getState?.();
  }

  function selectionConfig(prefix) {
    const state = selectionState(prefix) || {};
    const selected = state.selected || null;
    const inputs = state.inputs || {};
    if (!selected) return null;
    return {
      family: selected.type || 'Propeller',
      type: selected.type || 'Propeller',
      model: selected.model || selected.config || selected.type || 'Selected candidate',
      config: selected.config || '',
      blades: num(selected.Z, NaN),
      ae: num(selected.ae, NaN),
      pd: num(selected.pd, NaN),
      diameter: num(inputs.D ?? selected.D, NaN),
      rpm: num(selected.rpm, NaN),
      eta: num(selected.eta, NaN),
      power: num(selected.engine, NaN)
    };
  }

  function ensureSelectionPanel(prefix) {
    const pickBar = byId(prefix + '-selectedName')?.closest('.pick-bar');
    if (!pickBar) return null;
    let panel = byId(prefix + '-propPreviewCard');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'arus-selection-preview';
    panel.id = prefix + '-propPreviewCard';
    panel.innerHTML = `
      <div class="arus-prop-canvas-wrap"><canvas class="arus-prop-canvas" aria-label="Selected propeller 3D preview" id="${prefix}-propPreviewCanvas"></canvas></div>
      <div class="arus-prop-meta">
        <div class="arus-prop-hero"><div data-role="hero"></div><div class="arus-prop-note" data-role="detail"></div></div>
        <div class="arus-prop-tagrow" data-role="chips"></div>
        <div class="arus-prop-statrow" data-role="stats"></div>
        <div class="arus-prop-mini">The preview updates from the selected propeller. Use the <b>Pilih</b> button in the ranking or best-by-family tables.</div>
      </div>`;
    pickBar.appendChild(panel);
    return panel;
  }

  function arrangeSelectionPanel(prefix) {
    const panel = ensureSelectionPanel(prefix);
    const chart = byId(prefix + '-chartsArea');
    if (!panel || !chart) return;
    let wrap = byId(prefix + '-chartWithPreview');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'arus-selection-chart-wrap';
      wrap.id = prefix + '-chartWithPreview';
      chart.parentElement.insertBefore(wrap, chart);
    }
    // Exact chart ID prevents moving an ancestor into its own descendant.
    if (panel.parentElement !== wrap) wrap.appendChild(panel);
    if (chart.parentElement !== wrap) wrap.appendChild(chart);
    panel.classList.add('arus-selection-preview-inline');
  }

  function updateSelectionPanel(prefix) {
    const panel = ensureSelectionPanel(prefix);
    if (!panel) return;
    renderCard(panel, selectionConfig(prefix), 'selection');
    arrangeSelectionPanel(prefix);
  }

  function decorateSelectionRows(prefix) {
    // Original KT/KQ engines already make each table row clickable and keyboard accessible.
    // Remove previous presentation-layer "Select" buttons if present.
    for (const id of [prefix + '-rankRows', prefix + '-groupRows']) {
      const tbody = byId(id);
      if (!tbody) continue;
      tbody.querySelectorAll('.arus-choose-wrap').forEach(el => el.remove());
    }
  }


  /* v117: Selection-only presentation of the EXISTING native series selector.
   * The same four B / AU (= MAU + NAU) / Gawn / Kaplan buttons still drive
   * the original engine. Neither data coefficients nor calculations are edited. */
  function moveSeriesSelector(prefix) {
    const root = byId(prefix + '-mode');
    const tabs = byId(prefix + '-seriesTabs');
    const sidebar = root?.querySelector('aside.sidebar');
    if (!root || !tabs || !sidebar) return;
    let section = byId(prefix + '-arus111-series');
    if (!section) {
      section = document.createElement('section');
      section.id = prefix + '-arus111-series';
      section.className = 'arus111-series-selection arus117-series-selector';
      section.setAttribute('aria-label','Choose propeller series');
      section.innerHTML = `
        <div class="arus117-choose" id="${prefix}-arus117-choose">
          <div class="arus117-choose-heading">
            <strong>Choose propeller series</strong>
            <span>Select a propeller family before entering calculation parameters.</span>
          </div>
          <div class="arus117-category"><strong>Open propellers</strong><span>Open-water propeller families</span></div>
          <div class="arus117-card-grid">
            <button type="button" class="arus117-series-card" data-arus-series="B"><strong>B-Series</strong><small>Open-water systematic propeller series</small></button>
            <button type="button" class="arus117-series-card" data-arus-series="AU"><strong>MAU / NAU</strong><small>Open propeller family</small></button>
            <button type="button" class="arus117-series-card" data-arus-series="Gawn"><strong>Gawn</strong><small>Open-water propeller series</small></button>
          </div>
          <div class="arus117-category"><strong>Ducted propellers</strong><span>Propellers for nozzle arrangements</span></div>
          <div class="arus117-card-grid">
            <button type="button" class="arus117-series-card" data-arus-series="Kaplan"><strong>Kaplan / Nozzle</strong><small>Ducted propeller family</small></button>
          </div>
        </div>
        <div class="arus117-selected" id="${prefix}-arus117-selected" hidden>
          <div><span>SELECTED PROPELLER SERIES</span><strong id="${prefix}-arus117-name"></strong><small id="${prefix}-arus117-desc"></small></div>
          <button type="button" class="arus117-change" id="${prefix}-arus117-change">Change series</button>
        </div>`;
    }
    const head = sidebar.querySelector('.sidebar-head');
    const form = byId(prefix + '-inputForm');
    if (!section.isConnected) {
      if (head) head.before(section);
      else if (form) form.before(section);
      else sidebar.prepend(section);
    }
    if (tabs.parentElement !== section) section.append(tabs);
    tabs.classList.add('arus117-native-tabs');
    if (root.dataset.arus117Bound === 'true') return;
    root.dataset.arus117Bound = 'true';
    root.dataset.arusSeriesStage = 'choose';
    const choose = byId(prefix + '-arus117-choose');
    const chosen = byId(prefix + '-arus117-selected');
    const series = {
      B: ['B-Series', 'Open-water systematic propeller series'],
      AU: ['MAU / NAU', 'Open propeller family'],
      Gawn: ['Gawn', 'Open-water propeller series'],
      Kaplan: ['Kaplan / Nozzle', 'Ducted propeller family']
    };
    const setStage = (stage, kind) => {
      root.dataset.arusSeriesStage = stage;
      choose.hidden = stage !== 'choose';
      chosen.hidden = stage !== 'input';
      if (stage === 'input') {
        const info = series[kind] || series.B;
        byId(prefix + '-arus117-name').textContent = info[0];
        byId(prefix + '-arus117-desc').textContent = info[1];
      }
    };
    section.querySelectorAll('.arus117-series-card').forEach(card => {
      card.addEventListener('click', () => {
        const kind = card.dataset.arusSeries;
        const nativeButton = [...tabs.querySelectorAll('button[data-kind]')]
          .find(button => button.dataset.kind === kind);
        if (!nativeButton) return;
        nativeButton.click();
        setStage('input', kind);
      });
    });
    byId(prefix + '-arus117-change').addEventListener('click', () => {
      setStage('choose');
    });
    setStage('choose');
  }

  function installSelection(prefix) {
    const modeRoot = byId(prefix + '-mode');
    if (!modeRoot || modeRoot.dataset.arusPropPreviewInstalled === 'true') return;
    moveSeriesSelector(prefix);
    ensureSelectionPanel(prefix);
    decorateSelectionRows(prefix);
    updateSelectionPanel(prefix);
    modeRoot.dataset.arusPropPreviewInstalled = 'true';

    const observer = new MutationObserver(() => {
      decorateSelectionRows(prefix);
      updateSelectionPanel(prefix);
    });
    [byId(prefix + '-rankRows'), byId(prefix + '-groupRows'), byId(prefix + '-selectedName'), byId(prefix + '-selectedMeta')].filter(Boolean)
      .forEach(target => observer.observe(target, { childList: true, subtree: true, characterData: true }));

    modeRoot.addEventListener('click', event => {
      if (event.target.closest('tbody tr[data-id]')) setTimeout(() => updateSelectionPanel(prefix), 60);
    });
    byId(prefix + '-inputForm')?.addEventListener('submit', () => setTimeout(() => {
      decorateSelectionRows(prefix);
      updateSelectionPanel(prefix);
    }, 1400));
    window.addEventListener('resize', () => updateSelectionPanel(prefix));
  }

  function init() {
    ensureStyle();
    if (moduleId === 'performance') {
      const bind = () => {
        ensurePerformancePanel();
        updatePerformancePanel();
        ['family', 'variant', 'z', 'ear', 'pd', 'jStep', 'reCorrect', 'reynolds'].forEach(id => {
          const el = byId(id);
          if (!el || el.dataset.arusPreviewBound === 'true') return;
          el.dataset.arusPreviewBound = 'true';
          el.addEventListener('input', updatePerformancePanel);
          el.addEventListener('change', updatePerformancePanel);
        });
        const button = byId('calculate');
        if (button && button.dataset.arusPreviewBound !== 'true') {
          button.dataset.arusPreviewBound = 'true';
          button.addEventListener('click', () => setTimeout(updatePerformancePanel, 80));
        }
        byId('chartInfo') && new MutationObserver(updatePerformancePanel).observe(byId('chartInfo'), { childList: true, subtree: true, characterData: true });
      };
      bind();
      setTimeout(bind, 400);
      window.addEventListener('resize', updatePerformancePanel);
    }
    if (moduleId === 'selection') {
      const boot = () => { installSelection('kt'); installSelection('kq'); };
      boot();
      setTimeout(boot, 400);
      setTimeout(boot, 1400);
      new MutationObserver(boot).observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();


/* ARUS v104 — structural presentation normalization, source calculations unchanged. */
(() => {
 'use strict';
 const module=document.documentElement.dataset.arusModule;
 if(!['resistance','model-test','interaction','selection'].includes(module))return;
 const $=s=>document.querySelector(s);
 function el(tag, cls, label){const n=document.createElement(tag);if(cls)n.className=cls;if(label)n.textContent=label;return n;}
 function defer(cb){requestAnimationFrame(()=>setTimeout(cb,0));}
 function modelTest(){
   const layout=$('main.layout'),left=layout?.querySelector(':scope>.col:first-child');
   if(!left||$('#arus104-model-input-shell'))return;
   const sections=[...left.querySelectorAll(':scope>section.panel')];
   if(sections.length<3)return;
   const [methodPanel,geometryPanel,testPanel]=sections;
   const advanced=left.querySelector(':scope>#arus-unified-advanced');
   const run=left.querySelector(':scope>.arus-flow-bottom-actions');
   const shell=el('section','arus104-model-input-shell');shell.id='arus104-model-input-shell';
   shell.append(el('h2','arus104-panel-title','Calculation Parameters'));
   methodPanel.after(shell);
   shell.append(geometryPanel,testPanel);
   if(advanced)shell.append(advanced);
   if(run){run.classList.add('arus104-run-row');shell.append(run);}
   document.body.classList.add('arus104-workspace');
 }
 function interaction(){
   const sections=[...document.querySelectorAll('main .sheet>section.block')];
   if(sections.length<3)return;
   const [methodBox,inputBox,resultBox]=sections;
   if(inputBox.querySelector('.arus104-selected-strip'))return;
   const summary=el('div','arus104-selected-strip');
   const text=el('div');text.append(el('span','arus104-selected-label','Selected method'));
   const title=el('strong');title.textContent='Select a method';text.append(title);
   const change=el('button',null,'Change method');change.type='button';
   change.addEventListener('click',()=>$('#arus-flow-change-interaction')?.click());
   summary.append(text,change);
   inputBox.prepend(summary);
   const update=()=>{
     const stage=inputBox.hidden?'method':resultBox.hidden?'input':'result';
     const key='arus104-stage-'+stage;
     for(const cls of ['arus104-stage-method','arus104-stage-input','arus104-stage-result'])document.body.classList.toggle(cls,cls===key);
     const group=$('#groupSelect');
     const opt=group?.selectedOptions?.[0];
     if(opt){
       const raw=String(opt.textContent||'').trim();
       // Show actual method name without repeating the entire formula inventory.
       const short=raw.length>115?raw.slice(0,112).trim()+'…':raw;
       title.textContent=short||'Selected method';
       title.title=raw;
     }
   };
   new MutationObserver(update).observe(inputBox,{attributes:true,attributeFilter:['hidden']});
   new MutationObserver(update).observe(resultBox,{attributes:true,attributeFilter:['hidden']});
   $('#groupSelect')?.addEventListener('change',()=>defer(update));
   $('#typeSelect')?.addEventListener('change',()=>defer(update));
   methodBox.addEventListener('click',()=>defer(update));
   inputBox.addEventListener('click',()=>defer(update));
   update();
   document.body.classList.add('arus104-workspace');
 }
 function resistance(){
   const method=$('#method');if(!method)return;
   const node=$('#vesselFields');
   const advanced=$('#arus-unified-advanced');
   if(!node||!advanced)return;
   // Keep all original appendage controls in the DOM; collapse only their presentation.
   function pack(){
     const native=$('#arus-simple-app');
     const old=$('.arus104-resistance-fold');
     if(old&&!old.querySelector('#arus-simple-app'))old.remove();
     if(!native||native.closest('.arus104-resistance-fold'))return;
     const details=el('details','arus104-resistance-fold');
     details.append(el('summary',null,'Appendage Configuration'));
     native.before(details);details.append(native);
   }
   const observer=new MutationObserver(()=>{
     // The source method recreates appendage controls after a method change.
     if($('#arus-simple-app')&&!$('#arus-simple-app').closest('.arus104-resistance-fold'))defer(pack);
     else if($('.arus104-resistance-fold')&&!$('.arus104-resistance-fold #arus-simple-app'))defer(pack);
   });
   observer.observe(node,{subtree:true,childList:true});
   method.addEventListener('change',()=>setTimeout(pack,190));
   setTimeout(pack,280);
   document.body.classList.add('arus104-workspace');
 }
 function selection(){
   // Keep the native solver forms, and leave numerical results untouched.
   document.body.classList.add('arus104-workspace');
 }
 function boot(){
   if(module==='model-test')modelTest();
   if(module==='interaction')interaction();
   if(module==='resistance')resistance();
   if(module==='selection')selection();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80),{once:true});
 else setTimeout(boot,80);
})();



/* ARUS-native-CAD-v105: replaces old illustrated previews with actual CAD Geometry C/WASM. */
(() => {
 const module=document.documentElement.dataset.arusModule;
 if(!['performance','selection'].includes(module))return;
 const $=id=>document.getElementById(id);
 const valid=x=>Number.isFinite(Number(x))&&Number(x)>0;
 const isVisible=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getClientRects().length>0;
 function familyOf(raw){
   const s=String(raw||'').toLowerCase();
   if(s==='b')return 'b';
   if(/nau/.test(s))return 'mau'; // NAU: MAU-based *visual approximation*, Z is read from selected NAU parameters.
   if(/mauw/.test(s))return 'mauw';
   if(/mau/.test(s))return 'mau';
   if(/kaplan|nozzle|\bka[3-7][0-9]/.test(s))return 'kaplan';
   if(/gawn/.test(s))return 'gawn';
   if(/b.series|wageningen|\bb[3-7][\-\s]/.test(s))return 'b';
   return null;
 }
 const cadPreviewOverrides={performance:{hub:null,rake:15,rotation:0},kt:{hub:null,rake:15,rotation:0},kq:{hub:null,rake:15,rotation:0}};
 const uiNumber=(value,decimals=2)=>Number.isFinite(Number(value))?Number(value).toFixed(decimals):'–';
 function previewModeKey(mode){return module==='performance'?'performance':mode;}
 function updateCadDesignInputs(mode, cfg){
   if(!cfg||!cfg.family)return;
   const key=previewModeKey(mode);
   const viewRoot=module==='performance'?$('arus-performance-chartWrap') : $(key+'-chartWithPreview');
   if(!viewRoot)return;
   let panel=$('arus-cad-input-'+key);
   if(!panel){
     panel=document.createElement('section');
     panel.className='arus-cad-design-preview';
     panel.id='arus-cad-input-'+key;
     panel.innerHTML=`<div class="arus-cad-input-title">Design inputs</div>
       <div class="arus-cad-input-grid top">
         <label>Design mode<input type="text" value="Default design" readonly></label>
         <label>Source preset<input data-out="preset" type="text" readonly></label>
       </div><div class="arus-cad-input-caption">PRINCIPAL DIMENSIONS</div>
       <div class="arus-cad-input-grid">
         <label>Diameter D (mm)<input type="text" data-out="diameter" readonly></label>
         <label>Blade count Z<input type="text" data-out="blades" readonly></label>
         <label>Target EAR (AE/A₀)<input type="text" data-out="ear" readonly></label>
         <label>Target pitch 0.7R / D<input type="text" data-out="pd" readonly></label>
         <label>Hub diameter (mm)<input type="number" min="0" step="5" data-edit="hub"></label>
         <label>Rake of GL aft (deg)<input type="number" min="-79" max="79" step="1" data-edit="rake" value="15"></label>
         <label>Rotation<select data-edit="rotation"><option value="0">RIGHT HAND</option><option value="1">LEFT HAND</option></select></label>
       </div><div class="arus-cad-design-note">Diameter, blade count, EAR and P/D follow the selected calculation configuration. Hub, rake and rotation adjust only this 3D CAD visualization; they do not change KT, KQ, efficiency or candidate ranking.</div>`;
     viewRoot.parentElement.insertBefore(panel,viewRoot);
     const values=cadPreviewOverrides[key];
     // The native CAD project has hub=0, rake=15 and right-hand rotation as its initial values.
     panel.querySelector('[data-edit="hub"]').value=values.hub===null?0:values.hub;
     panel.querySelector('[data-edit="rake"]').value=values.rake;
     panel.querySelector('[data-edit="rotation"]').value=String(values.rotation);
     panel.querySelectorAll('[data-edit]').forEach(field=>field.addEventListener('change',()=>{
       const val=Number(field.value);
       const type=field.dataset.edit;
       if(!Number.isFinite(val))return;
       if(type==='hub')values.hub=Math.max(0,val);
       if(type==='rake')values.rake=Math.max(-79,Math.min(79,val));
       if(type==='rotation')values.rotation=val===1?1:0;
       const target=module==='performance'?null:key;
       updateNative(target||'');
     }));
   }
   const attr={preset:cfg.cadPreset||cfg.family,diameter:uiNumber(cfg.diameterMm,0),blades:String(cfg.blades),ear:uiNumber(cfg.ae,2),pd:uiNumber(cfg.pd,2)};
   for(const [k,val] of Object.entries(attr)){
     const field=panel.querySelector('[data-out="'+k+'"]');if(field&&field.value!==val)field.value=val;
   }
   const values=cadPreviewOverrides[key];
   cfg.hubMm=values.hub===null?0:values.hub;
   cfg.rakeDeg=values.rake;
   cfg.rotation=values.rotation;
 }
 function performanceCfg(){
   const familyLabel=$('family')?.selectedOptions?.[0]?.textContent||'';
   const variant=$('variant')?.value||'';
   const m=window.ARUS_Module02_Test?.models?.[variant]||{};
   const family=familyOf(m.family||familyLabel);
   return {family,cadPreset:family==='mau'?'MAU':family==='b'?'B-Series':family==='gawn'?'Gawn':family==='kaplan'?'Kaplan':familyLabel,blades:Number($('z')?.value||m.z),ae:Number($('ear')?.value||m.ear),pd:Number($('pd')?.value||m.pd),diameterMm:1000,nozzle:/nozzle|kaplan/i.test(familyLabel),error:!family?'This series has no matching blade geometry preset in CAD Geometry. No substitute shape is shown.':undefined};
 }
 function selectionCfg(mode){
   const state=(mode==='kt'?window.__ARUS_KT__:window.__ARUS_INVERSE__)?.getState?.();
   const r=state?.selected;
   if(!r)return null;
   const family=familyOf(r.type||r.config||r.model);
   const D=mode==='kt'?Number(state.inputs?.D):Number(r.D);
   return {family,cadPreset:family==='mau'?'MAU':family==='b'?'B-Series':family==='gawn'?'Gawn':family==='kaplan'?'Kaplan':String(r.type||family),blades:Number(r.Z),ae:Number(r.ae),pd:Number(r.pd),diameterMm:valid(D)?D*1000:1000,nozzle:/nozzle|kaplan/i.test(String(r.type||'')),error:!family?'No supported CAD preset for this candidate family; 3D geometry is not substituted.':undefined};
 }
 function makeFrame(box){
   if(box.querySelector('iframe.arus-native-cad-frame'))return box.querySelector('iframe.arus-native-cad-frame');
   const old=box.querySelector('canvas');
   if(old){old.style.display='none';old.setAttribute('aria-hidden','true');}
   const frame=document.createElement('iframe');
   frame.className='arus-native-cad-frame';
   frame.title='3D geometry rendered by Propeller CAD Geometry engine';
   frame.style.cssText='display:block;width:100%;height:560px;border:0;border-radius:8px;background:#f7fbfd;overflow:hidden;';
   frame.loading='eager';
   frame.scrolling='no';
   frame.setAttribute('sandbox','allow-scripts allow-same-origin');
   box.style.minHeight='560px';
   box.appendChild(frame);
   try{frame.srcdoc=parent.__ARUS_CAD_NATIVE_VIEWER_DOC__();}catch(e){frame.srcdoc='<p>Unable to load native CAD renderer: '+String(e.message||e)+'</p>';}
   frame.addEventListener('load',()=>{
    const doc=frame.contentDocument;
    if(doc && !frame.__arusHideSeriesLabels){
      frame.__arusHideSeriesLabels=true;
      const hide=()=>{
        const stat=doc.getElementById('stat');
        if(stat){stat.textContent='';stat.style.display='none';}
      };
      hide();
      try{
        doc.documentElement.style.overflow='hidden';
        doc.body.style.overflow='hidden';
        doc.body.style.margin='0';
        const frameEl=doc.querySelector('.frame');
        if(frameEl){
          frameEl.style.minHeight='0';
          frameEl.style.height='100%';
          frameEl.style.overflow='hidden';
        }
        const cad=doc.getElementById('cad');
        if(cad){
          cad.style.height='100%';
          cad.style.minHeight='0';
          cad.style.maxHeight='none';
        }
        const status=doc.getElementById('status');
        if(status)status.style.display='none';
        const extra=doc.createElement('style');
        extra.textContent='html,body{height:100%!important;width:100%!important;margin:0!important;overflow:hidden!important} .frame{display:flex!important;flex-direction:column!important;height:100%!important;min-height:0!important;overflow:hidden!important;box-sizing:border-box!important}.arus-cad-stage{display:block!important;flex:1 1 0!important;min-height:0!important} #cad{display:block!important;width:100%!important;height:100%!important;max-height:none!important;min-height:0!important} .bar,.controls{flex:0 0 auto!important} .controls{padding-top:6px!important} #stat,#status{display:none!important}::-webkit-scrollbar{width:0!important;height:0!important;display:none!important} body{scrollbar-width:none!important;-ms-overflow-style:none!important}';
        doc.head.appendChild(extra);
      }catch{}
      try{new MutationObserver(hide).observe(doc.body,{subtree:true,childList:true,characterData:true});}catch{}
    }
    const config=frame.__cadConfig;
    if(config)frame.contentWindow?.postMessage({channel:'arus-native-cad-v105',type:'configuration',config},'*')
   });
   return frame;
 }
 function updateNative(prefix){
   const id=module==='performance'?'arus-performance-preview':prefix+'-propPreviewCard';
   const card=$(id);
   const box=card?.querySelector('.arus-prop-canvas-wrap');
   if(!box)return;
   const hint=card.querySelector('[data-role="detail"]');
   if(hint)hint.textContent='Rendered by the Propeller CAD Geometry C/WebAssembly engine. Blade form is generated from CAD preset and configuration; the performance coefficients are calculated independently.';
   const foot=card.querySelector('.arus-prop-mini');
   if(foot)foot.textContent='Native CAD surface mesh. Drag to rotate, scroll to zoom. Changing the 3D view does not affect the calculation.';
   let frame=makeFrame(box);
   const cfg=module==='performance'?performanceCfg():selectionCfg(prefix);
   if(cfg)updateCadDesignInputs(prefix,cfg);
   const frozen=JSON.stringify(cfg);
   if(frame.__lastCfg===frozen)return;
   frame.__lastCfg=frozen;
   const config=cfg||{family:null,error:'Run calculation and choose a propeller to view its geometry.'};
   frame.__cadConfig=config;
   try{frame.contentWindow?.postMessage({channel:'arus-native-cad-v105',type:'configuration',config},'*')}catch{}
 }
 function init(){
  let pending=false;
  const update=()=>{
   if(pending)return;pending=true;
   setTimeout(()=>{pending=false;if(module==='performance')updateNative('');else {updateNative('kt');updateNative('kq');}},80);
  };
  update();setTimeout(update,300);setTimeout(update,1500);
  // React to actual selection state (ranking, grouped best, solver updates) and performance configuration changes.
  document.addEventListener('input',update,true);document.addEventListener('change',update,true);document.addEventListener('click',update,true);
  document.addEventListener('submit',()=>setTimeout(update,1600),true);
  window.addEventListener('resize',update);
  if(module==='selection'){
   for(const mode of ['kt','kq']){
    for(const id of [mode+'-selectedName',mode+'-selectedMeta']){
     const node=$(id);if(node)new MutationObserver(update).observe(node,{childList:true,characterData:true,subtree:true});
    }
   }
  }
  window.addEventListener('message',event=>{
    const d=event.data;
    if(d?.channel!=='arus-native-cad-v105'||d.type!=='ready')return;
    for(const frame of document.querySelectorAll('iframe.arus-native-cad-frame')){
      if(frame.contentWindow===event.source&&frame.__cadConfig)frame.contentWindow.postMessage({channel:'arus-native-cad-v105',type:'configuration',config:frame.__cadConfig},'*');
    }
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();



/* ARUS v107 — Interaction method-card label hierarchy only; native selectors and solvers unchanged. */
(() => {
 'use strict';
 if(document.documentElement.dataset.arusModule !== 'interaction')return;
 function normalizeCardLabel(raw){
   let text=String(raw||'').trim();
   const cnt=text.match(/\s*\((\d+)\s+equations?\)\s*$/i);
   if(cnt)text=text.slice(0,cnt.index).trim();
   const parts=text.split(/\s+[—–]\s+/);
   let main=text,formula='';
   if(parts.length>=2){
     const first=parts.shift().trim(), rest=parts.join(' — ').trim();
     const looksFormula=(v)=>v.length<=12||/[·∇ₚᵦₜₘ₀∆Σλμ]/.test(v)||/\b(?:Fr|Re|KT|KQ|[CBLDT])\b/.test(v);
     if(looksFormula(first)&&!looksFormula(rest)){main=rest;formula=first;}
     else{main=first;formula=rest;}
   }
   return {main,formula,count:cnt?Number(cnt[1]):null,original:raw};
 }
 function decorate(){
   const container=document.querySelector('#groupSelect')?.parentElement?.querySelector('.arus-method-cards');
   if(!container)return;
   for(const card of container.querySelectorAll('.arus-method-card')){
     if(card.dataset.arus107Decorated==='1')continue;
     const origin=card.textContent.trim();
     if(!origin)continue;
     const fields=normalizeCardLabel(origin);
     const title=document.createElement('span');title.className='arus107-card-name';title.textContent=fields.main;
     card.replaceChildren(title);
     if(fields.formula){const desc=document.createElement('span');desc.className='arus107-card-expression';desc.textContent=fields.formula;card.append(desc);}
     if(fields.count!==null){const badge=document.createElement('span');badge.className='arus107-card-count';badge.textContent=fields.count+' equations';card.append(badge);}
     card.dataset.arus107Decorated='1';
     card.title=origin;card.setAttribute('aria-label',origin);
   }
 }
 function init(){
   const resultHeading=document.querySelector('main .sheet>section.block:nth-of-type(3) h2');
   if(resultHeading)resultHeading.textContent='Calculation Results';
   let grid=document.querySelector('#groupSelect')?.parentElement?.querySelector('.arus-method-cards');
   if(!grid){setTimeout(init,100);return;}
   let scheduled=false;
   const observer=new MutationObserver(()=>{
     if(scheduled)return;scheduled=true;
     requestAnimationFrame(()=>{scheduled=false;decorate();});
   });
   observer.observe(grid,{childList:true,subtree:true});
   decorate();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();

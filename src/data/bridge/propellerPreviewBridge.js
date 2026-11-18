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

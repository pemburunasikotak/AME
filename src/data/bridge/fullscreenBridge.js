/* ARUS Fullscreen Feature for 3D Propeller CAD & Open Water Diagram */
(() => {
  'use strict';
  const module = document.documentElement.dataset.arusModule;
  if (!['performance', 'selection'].includes(module)) return;

  const CSS = `
    .arus-fs-trigger-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 50;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(16, 27, 44, 0.85);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      backdrop-filter: blur(4px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      transition: all 0.18s ease;
      user-select: none;
    }
    .arus-fs-trigger-btn:hover {
      background: rgba(39, 104, 237, 0.95);
      border-color: rgba(255, 255, 255, 0.5);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(39, 104, 237, 0.35);
    }
    .arus-fs-trigger-btn svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .arus-fs-active {
      position: fixed !important;
      inset: 0 !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      z-index: 999999 !important;
      background: #ffffff !important;
      margin: 0 !important;
      padding: 16px 20px !important;
      box-sizing: border-box !important;
      border-radius: 0 !important;
      overflow: hidden !important;
      box-shadow: none !important;
      display: flex !important;
      flex-direction: column !important;
    }
    .arus-fs-active > .paper-head,
    .arus-fs-active > .headrow,
    .arus-fs-active > .card-head {
      flex: 0 0 auto !important;
      margin-bottom: 8px !important;
      padding-bottom: 4px !important;
    }
    .arus-fs-active > .pick-bar,
    .arus-fs-active > .legend,
    .arus-fs-active > .status,
    .arus-fs-active > #chartInfo {
      flex: 0 0 auto !important;
      margin: 4px 0 !important;
    }
    .arus-fs-active .arus-prop-canvas-wrap {
      flex: 1 1 0 !important;
      height: 100% !important;
      min-height: 0 !important;
      max-height: calc(100vh - 120px) !important;
      width: 100% !important;
      overflow: hidden !important;
    }
    .arus-fs-active iframe.arus-native-cad-frame {
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      max-height: 100% !important;
      flex: 1 1 0 !important;
    }
    .arus-fs-active .single-plot,
    .arus-fs-active .plot-panel,
    .arus-fs-active .plot,
    .arus-fs-active .chart-wrap,
    .arus-fs-active .paper-body {
      flex: 1 1 0 !important;
      display: flex !important;
      flex-direction: column !important;
      height: 100% !important;
      min-height: 0 !important;
      max-height: calc(100vh - 140px) !important;
      width: 100% !important;
      overflow: hidden !important;
    }
    .arus-fs-active canvas#kt-chart,
    .arus-fs-active canvas#kq-chart,
    .arus-fs-active canvas#curveCanvas,
    .arus-fs-active #chartArea canvas {
      flex: 1 1 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      max-height: 100% !important;
      object-fit: contain !important;
    }
    .arus-fs-active .point-strip,
    .arus-fs-active .axis-explain {
      flex: 0 0 auto !important;
      margin-top: 6px !important;
    }
    .arus-fs-active svg,
    .arus-fs-active canvas {
      max-height: 100% !important;
    }
  `;

  function injectCSS() {
    if (document.getElementById('arus-fullscreen-styles')) return;
    const style = document.createElement('style');
    style.id = 'arus-fullscreen-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function toggleFullscreen(targetEl, btn) {
    const isFS = targetEl.classList.contains('arus-fs-active');
    if (!isFS) {
      targetEl.classList.add('arus-fs-active');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
        <span>Exit Fullscreen</span>
      `;
      btn.style.background = '#e53e3e';
      const onEsc = (e) => {
        if (e.key === 'Escape') {
          toggleFullscreen(targetEl, btn);
          window.removeEventListener('keydown', onEsc);
        }
      };
      window.addEventListener('keydown', onEsc);
      targetEl._escHandler = onEsc;
    } else {
      targetEl.classList.remove('arus-fs-active');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        <span>Fullscreen</span>
      `;
      btn.style.background = '';
      if (targetEl._escHandler) {
        window.removeEventListener('keydown', targetEl._escHandler);
        targetEl._escHandler = null;
      }
    }
    window.dispatchEvent(new Event('resize'));
    // Trigger any resize observer or canvas draw inside
    const iframe = targetEl.querySelector('iframe.arus-native-cad-frame');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.dispatchEvent(new Event('resize'));
    }
  }

  function attachFullscreenButton(container, label) {
    if (!container || container.querySelector(':scope > .arus-fs-trigger-btn')) return;
    const compStyle = window.getComputedStyle(container);
    if (compStyle.position === 'static') {
      container.style.position = 'relative';
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'arus-fs-trigger-btn';
    btn.setAttribute('title', 'View in Fullscreen (Esc to exit)');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
      <span>Fullscreen</span>
    `;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleFullscreen(container, btn);
    });
    container.appendChild(btn);
  }

  function scanAndAttach() {
    injectCSS();

    // 1. Open Water Diagram sections
    const chartIds = ['kt-chartsArea', 'kq-chartsArea', 'chartArea'];
    for (const id of chartIds) {
      const el = document.getElementById(id);
      if (el) attachFullscreenButton(el, 'Diagram');
    }
    // Also attach to performance diagram panel directly (not the whole wrap with preview)
    const curveCanvas = document.getElementById('curveCanvas');
    if (curveCanvas) {
      const perfChartSection = curveCanvas.closest('section');
      if (perfChartSection) attachFullscreenButton(perfChartSection, 'Diagram');
    }

    // 2. 3D Propeller CAD Preview panels
    const previewIds = ['kt-propPreviewCard', 'kq-propPreviewCard', 'arus-performance-preview'];
    for (const id of previewIds) {
      const el = document.getElementById(id);
      if (el) attachFullscreenButton(el, '3D CAD');
    }
  }

  function init() {
    scanAndAttach();
    setTimeout(scanAndAttach, 400);
    setTimeout(scanAndAttach, 1200);
    setTimeout(scanAndAttach, 2500);
    new MutationObserver(scanAndAttach).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

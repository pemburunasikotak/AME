import engines from '../data/arusEngines.json';
import { engineThemeCss as theme } from '../styles/engineTheme/index.js';
import { engineBridgeScript as bridge } from '../data/bridge/index.js';
import { buildCadViewerDocument } from '../data/cadViewer/index.js';

function decode(engine) {
  const binaryString = atob(engine.base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function patchGeometryView(html) {
  const replacement = `
  const CAMERA={iso:[2.35619449,-0.61547971],reverse:[-0.78539816,0.61547971],front:[0,Math.PI/2],rear:[0,-Math.PI/2],top:[Math.PI,0],bottom:[0,0],right:[Math.PI/2,0],left:[-Math.PI/2,0]};
  function setCamera(name,r=renderer){if(!r)return;let val=CAMERA[name]||CAMERA.iso;r.yaw=val[0];r.pitch=val[1];r.render();}
`;
  return html.replace('const CAMERA={iso:[2.35619449,-0.61547971]};', replacement);
}

// Global CAD Native Viewer document generator
export function getCadNativeViewerDoc() {
  return buildCadViewerDocument();
}

// Ensure window.__ARUS_CAD_NATIVE_VIEWER_DOC__ is accessible in the parent window
if (typeof window !== 'undefined') {
  window.__ARUS_CAD_NATIVE_VIEWER_DOC__ = getCadNativeViewerDoc;
}

export function buildEngineDocument(engineId) {
  const engine = engines.find((item) => item.id === engineId);
  if (!engine) throw new Error(`Engine ${engineId} not found`);

  let html = decode(engine);

  for (const patch of engine.presentationPatches || []) {
    if (patch.before && patch.after) {
      html = html.split(patch.before).join(patch.after);
    }
  }

  if (engine.id === 'geometry' && !html.includes('arus-inventor-nav-style')) {
    html = patchGeometryView(html);
  }

  // Also define fallback in case engine looks at window instead of parent
  const cadFallbackScript = `
  <script>
    if (!window.__ARUS_CAD_NATIVE_VIEWER_DOC__ && window.parent && window.parent.__ARUS_CAD_NATIVE_VIEWER_DOC__) {
      window.__ARUS_CAD_NATIVE_VIEWER_DOC__ = window.parent.__ARUS_CAD_NATIVE_VIEWER_DOC__;
    }
  </script>
  `;

  const injected = `<style id="arus-shared-theme">${theme}</style><script>${bridge}</script>${cadFallbackScript}`;

  return html
    .replace(/<html\b([^>]*)>/i, (_, attributes) => `<html${attributes} data-arus-module="${engine.id}">`)
    .replace(/<\/head>/i, () => `${injected}</head>`);
}

export function getEngineMetadata(engineId) {
  return engines.find((item) => item.id === engineId);
}

export function getAllEngines() {
  return engines;
}

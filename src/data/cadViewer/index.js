/**
 * ARUS Native 3D CAD Viewer Document Builder
 * Assembles the modular CSS, HTML, WASM kernel, and WebGL renderer
 * into the standalone srcdoc document for 3D propeller previews.
 */

import { engineThemeCss } from '../../styles/engineTheme/index.js';
import cadViewerCss from './cadViewer.css?raw';
import cadViewerBody from './cadViewerBody.html?raw';
import cadRhinoMacro from './cadRhinoMacro.js?raw';
import cadBridge from './cadBridge.js?raw';
import cadCameraOrbit from './cadCameraOrbit.js?raw';
import cadWasmBinary from './cadWasmBinary.js?raw';
import cadWasmKernel from './cadWasmKernel.js?raw';
import cad2dFallback from './cad2dFallback.js?raw';
import cadStudioMain from './cadStudioMain.js?raw';
import cadViewCube from './cadViewCube.js?raw';
import cadMiniConfig from './cadMiniConfig.js?raw';

let cachedCadViewerDoc = null;

export function buildCadViewerDocument() {
  if (cachedCadViewerDoc) return cachedCadViewerDoc;

  cachedCadViewerDoc = `<!doctype html>
<html lang="en" data-arus-module="geometry">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#101b2c">
  <title>ARUS | 3D CAD Viewer</title>
  <style id="arus-shared-theme">${engineThemeCss}</style>
  <style id="arus-cad-viewer-styles">${cadViewerCss}</style>
  <script>${cadRhinoMacro}</script>
  <script>${cadBridge}</script>
  <script id="arus-shared-camera-orbit-v139">${cadCameraOrbit}</script>
</head>
<body>
  ${cadViewerBody}
  <script>${cadWasmBinary}</script>
  <script>${cadWasmKernel}</script>
  <script>${cad2dFallback}</script>
  <script>${cadStudioMain}</script>
  <script>${cadViewCube}</script>
  <script id="arus-v149-mini-config">${cadMiniConfig}</script>
</body>
</html>`;

  return cachedCadViewerDoc;
}

export default buildCadViewerDocument;

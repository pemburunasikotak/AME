/**
 * ARUS Engine Bridge Bundle
 * Combines modular presentation, CAD preview, workflow, and UI enhancement
 * scripts injected into each calculation engine iframe.
 */

import geometryTipBridge from './geometryTipBridge.js?raw';
import presentationBridge from './presentationBridge.js?raw';
import workflowBridge from './workflowBridge.js?raw';
import appendageGuidanceBridge from './appendageGuidanceBridge.js?raw';
import propellerPreviewBridge from './propellerPreviewBridge.js?raw';
import structuralLayoutBridge from './structuralLayoutBridge.js?raw';
import nativeCadPreviewBridge from './nativeCadPreviewBridge.js?raw';
import methodCardsBridge from './methodCardsBridge.js?raw';
import fullscreenBridge from './fullscreenBridge.js?raw';

export const engineBridgeScript = [
  geometryTipBridge,
  presentationBridge,
  workflowBridge,
  appendageGuidanceBridge,
  propellerPreviewBridge,
  structuralLayoutBridge,
  nativeCadPreviewBridge,
  methodCardsBridge,
  fullscreenBridge
].join('\n\n');

export default engineBridgeScript;

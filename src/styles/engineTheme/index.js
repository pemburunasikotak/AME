/**
 * ARUS Shared Engine Theme Bundle
 * Combines modular CSS theme files injected into each calculation engine iframe.
 */

import baseLayout from './baseLayout.css?raw';
import workflowStages from './workflowStages.css?raw';
import designSystem from './designSystem.css?raw';
import moduleOverrides from './moduleOverrides.css?raw';

export const engineThemeCss = [
  baseLayout,
  workflowStages,
  designSystem,
  moduleOverrides
].join('\n\n');

export default engineThemeCss;

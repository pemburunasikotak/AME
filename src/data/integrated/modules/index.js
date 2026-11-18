/**
 * ARUS Integrated Calculation Logic Bundle
 * Combines all modular functional domains into the unified integrated script.
 */

import igStorage from './igStorage.js?raw';
import igResistanceAndPowertrain from './igResistanceAndPowertrain.js?raw';
import igPropellerSelection from './igPropellerSelection.js?raw';
import igCurvesAndEngineCatalog from './igCurvesAndEngineCatalog.js?raw';
import igChartsAndSimulation from './igChartsAndSimulation.js?raw';
import igEngineEvaluationAndDesign from './igEngineEvaluationAndDesign.js?raw';

export const integratedScript = [
  "(function(){'use strict';",
  igStorage,
  igResistanceAndPowertrain,
  igPropellerSelection,
  igCurvesAndEngineCatalog,
  igChartsAndSimulation,
  igEngineEvaluationAndDesign,
  '})();'
].join('\n\n');

export default integratedScript;

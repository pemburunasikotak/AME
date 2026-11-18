import arusEnginesRaw from '../data/integrated/arus-engines.json?raw';
import igExtraMRaw from '../data/integrated/ig-extra-m.json?raw';
import igPreliminaryMpRaw from '../data/integrated/ig-preliminary-mp.json?raw';
import igEngineCatalogRaw from '../data/integrated/ig-engine-catalog.json?raw';
import { integratedScript } from '../data/integrated/modules/index.js';
import igBodyRaw from '../data/integrated/igBody.html?raw';
import igStylesRaw from '../styles/integratedStyles.css?raw';

let cachedIntegratedDoc = null;

export function buildIntegratedDocument() {
  if (cachedIntegratedDoc) return cachedIntegratedDoc;

  cachedIntegratedDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta content="width=device-width,initial-scale=1" name="viewport"/>
  <title>Integrated Calculation</title>
  <style>
    ${igStylesRaw}
    /* Hide outer standalone shell elements when hosted in IntegratedModule */
    .sidebar.app-sidebar,
    .topbar.app-header,
    .skip-link,
    .mobile-bottom-nav {
      display: none !important;
    }
    .workspace-shell, .main-column {
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
      min-height: auto !important;
      width: 100% !important;
    }
    #dedicated-main {
      padding: 10px 18px 40px !important;
      max-width: 1540px !important;
      margin: 0 auto !important;
    }
  </style>
</head>
<body>
  ${igBodyRaw}

  <script id="arus-engines" type="application/json">${arusEnginesRaw}</script>
  <script id="ig-extra-m" type="application/json">${igExtraMRaw}</script>
  <script id="ig-preliminary-mp" type="application/json">${igPreliminaryMpRaw}</script>
  <script id="ig-engine-catalog" type="application/json">${igEngineCatalogRaw}</script>
  <script>${integratedScript}</script>
</body>
</html>`;

  return cachedIntegratedDoc;
}

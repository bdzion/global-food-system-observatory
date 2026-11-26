# Spatial analysis, authenticated services and validation

## Credentials
Configure GitHub repository Settings → Secrets and variables → Actions:
- Secret USDA_FAS_API_KEY, obtained from https://apps.fas.usda.gov/opendatawebv2/. Four staple commodities, latest two selected marketing years, official code lookup joins. Records published separately only if at least 20 same-vintage comparable bulk records all agree; otherwise withhold. No live authenticated testing without credentials.
- Secret HDX_HAPI_APP_IDENTIFIER, generated at https://hdx-hapi.readthedocs.io/en/latest/getting-started/.
- Repository variable HDX_IPC_APPROVED_RESOURCE_IDS, comma-separated exact resource UUIDs only after verifying provider terms, attribution and public redistribution. No default clearance. IPC records are national level, by phase and assessment type, no overlapping totals.

Missing credentials are explicit; never commit keys or disclose them in logs. No authenticated live response can be claimed until configured.

## Spatial
GPCP v2.3 global monthly precipitation, NOAA PSL THREDDS file server; 2.5° grid, average daily rate multiplied by actual days in each month. Latest three consecutive complete observation months compared against 1991–2020 same season, at least 24 baseline years. Grid percent anomalies withheld below 30 mm normal. Country grid-centre inclusion (Natural Earth 1:110m, public domain), cosine latitude weighting, min 3 cells and 80% valid weighted coverage. Coarse coastal cells mix land/ocean. Not crop-area weighted; no drought classes, crop loss, or causation. Full geographic grid includes ocean. Next stage requires independently validated crop masks and phenology, CHIRPS or other higher-resolution data and uncertainty.

## Scientific evaluation
Fixed screening rule anomaly >=1 evaluated from 2010 at each historical origin against a 10% rise in the benchmark three months later, with persistence and never-alert baselines. Exact months, no future data in anomaly, report confusion counts and precision/recall/FPR. Current revised histories rather than vintage data; overlapping targets and selected proxy limit conclusions. No crisis prediction, causal assessment or intervention validation. Require dated operational archives, independent outcomes, stakeholder review and pre-registered validation before claims of early-warning performance.

## Browser
Chromium checks actual rendered pages at 1440 and 390 pixels using last validated data branch, route titles, horizontal overflow, country/product filter persistence and JS exceptions. This is a smoke test, not full accessibility audit. Live spatial workflow tests actual NOAA download and coverage separately. Full pipeline publishes new evidence only after mandatory checks.

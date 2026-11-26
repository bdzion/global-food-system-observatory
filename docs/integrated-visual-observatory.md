# Integrated visual observatory — Version 3 foundation

## Critical review of baseline

Baseline main: 677ea87eac17b76f2773f2856774da4517f00aa2. The first multi-commodity PR has been merged. The main landing route still prioritizes the original wheat narrative; crop exploration consists mostly of tables. Seven primary navigation destinations duplicate pathways to crop, country and assumptions. Existing source metadata, mirror-trade distinction, stock safeguards, checksum contract and wheat stress test are valuable and must remain available.

The Canadian companion uses navy masthead, warm paper, serif display titles, a theme switch, a compact release-status strip, and Natural Earth country geometry. This branch borrows that visual vocabulary, not official logos. The global prototype is described as a companion to the Canadian observatory at Arrell Food Institute; confirm institutional approval of the wording and any logos before publication.

## Benchmark and decisions

- Food Systems Dashboard (https://www.foodsystemsdashboard.org/): country-level comparison, diagnosis and policy actions. Adopt shared geographic/commodity selection and evidence-linked decisions.
- GEOGLAM (https://www.cropmonitor.org/data-archive): dated spatial crop conditions; CC BY 4.0 per https://www.cropmonitor.org/referencing-guidelines. Layer ingestion is pending; do not treat crop condition as measured yield loss.
- EU JRC Food System Dashboard (https://datam.jrc.ec.europa.eu/datam/mashup/EU_FOOD_SYSTEM_MONITORING/index.html): map, chart, table and country profiles. Use common indicator definitions across displays.
- WFP HungerMap Live (https://hungermap.wfp.org/): geography and food access, with distinctions between direct data and modelled assessments.
- Food Systems Countdown Initiative (https://www.foodcountdown.org/): diets, environment, livelihoods, governance and resilience. Do not claim the present commodity pipeline measures all these.
- USDA PSD (https://fas.usda.gov/psdonline; https://apps.fas.usda.gov/opendatawebv2/): monthly marketing-year evidence. API key required for the documented API; bulk files also advertised. No key or live tested connector available here.
- FAO GIEWS FPMA (https://www.fao.org/giews/food-prices/en/): market-specific domestic prices, not national CPI.

## Implemented in branch

- Six primary destinations, with original wheat pages preserved under their existing routes and the original front page at #/wheat.
- Commodity and country selection, grouped product catalogue, world choropleth with six metrics and clear missing-data texture, keyboard and pointer selection, rankings, historical charts and scenario bars. Natural Earth 1:110m geometry from the Canadian repository; public-domain source and generator included. Generalized de facto boundaries are not a political endorsement. Small territories may be absent: count unmatched records and retain table and selector access.
- Map colours represent within-product relative values, not risk or comparable thresholds across commodities. Explicit observed zero differs from unknown. Estimated stock cover is not physical reserve availability.
- 25 registry entries across staple foods, oilseeds/oils, pulses, animal foods and produce, with exact FAOSTAT item codes. New codes are candidate mappings until SCL and TM releases are inspected, including item names, units and coverage. Rice paddy and milled rice, oilseeds and edible oils are never combined. The registry includes selected poultry, eggs, cattle and pig meat, raw milk and produce, not complete animal protein or horticulture coverage. Annual grain-style stock cover is withheld for animal and fresh food categories.
- Additional optional Pink Sheet benchmarks (rice Thai 5%, soybeans, palm/soybean oil, barley, sorghum); preserve mandatory original columns. Missing optional column remains unavailable, and historical discontinued series must show their last period rather than imply current prices.
- Source directory lists actual release sources separately from nineteen external references/candidate feeds. Links are not ingestion. System pathways are conceptual with explicit constraints; scenarios compare independently calculated shipment gaps and intervention timing, not cross-commodity market equilibrium.
- Navy companion branding, light/dark/auto preference, data strip, CSS responsive layouts, source filter and explanatory figures.

## Remaining integration work

Phase A: inspect and dry-run exact-product data mappings, verify candidate product coverage and product-form consistency, test workbook column matching, optional series discontinuation, payload size, browser rendering, keyboard access and map joins. Confirm branding. Existing wheat results must pass regression checks. Do not merge if gates fail.
Phase B: integrate USDA PSD (key via repository secret, never client-side; separate marketing year and source release, no implicit units), GEOGLAM dated map layers (source/attribution/coverage), AMIS reports, domestic GIEWS/HDX prices (market, currency, unit, retail/wholesale), then backtest the commodity-specific assumption ledger.
Phase C: validate crop-area-weighted climate hazards (CHIRPS, Copernicus, AQUASTAT); integrate disease reports (WOAH), trade disruptions (Comtrade/PortWatch), nutrition and food access (WFP/IPC/UNICEF) and fisheries (FAO FishStat). Add verified cold-chain and electricity data where available; no global estimate from port activity alone.
Phase D: constrained substitution network with food/feed/fuel accounting, processing conversion factors, competing buyers, supplier spare capacity, freight and timing; historical snapshots and alert performance; sector-specific stress tests and stakeholder validation. Do not present conceptual pathways as estimated effects.

## Acceptance criteria

- CI Python/TypeScript/build passes; validate actual source release in a dry run before publishing.
- Compare baseline wheat checks/results; verify new registry coverage and missing-data logic, exact product code/label/units, optional price headers, observation years and source flags.
- Check charts and map on mobile/tablet/desktop, keyboard-only and reduced-motion preferences, contrast and accessible names. Test missing map geometry, empty series, and old releases.
- Check institutional affiliation wording with project lead; do not use official logos without permission.
- Keep GitHub Pages and data branch deployment. Never publish an unvalidated release or label an external link as an active feed.

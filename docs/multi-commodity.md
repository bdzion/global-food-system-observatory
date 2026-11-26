# Multi-commodity foundation — implementation and release gates

## Audit

The baseline is commit c86db6cfad93f6037dee8a1bdfebded36880eb17. The existing React/Vite hash router, Python FAOSTAT/World Bank extractors, seven-stage wheat chain, scenario and assumption ledger, offline CI, and data-branch deployment are retained. The old wheat pages remain available at #/wheat, #/countries, #/chain, #/what-if and #/assumptions.

The previous build hard-coded wheat item 15, exporter lists and absolute import cutoffs. Its legacy availability calculation substitutes zero for missing production/exports. The new extension requires all components for its denominator, does not use the wheat import floor, distinguishes importer and mirror evidence, and derives exporters from observed data. Legacy values are not silently revised.

## New contract

commodities.json is an additive extension (extension_version 1) listed in the existing manifest. The browser checks its size and SHA-256, and explicitly reports missing or invalid releases. Annual profiles include exact-product quantities, source flags, observation years, supplier coverage, history and national affordability context. Wheat, maize, soybeans, paddy and milled rice are separate item mappings. Product codes, units, labels and coverage must be checked against the actual provider archives before deployment. No conversion between rice forms is assumed. A country with no evidence is not assigned zero.

Gross import share is imports divided by apparent supply before stock changes, and may exceed 100% for re-exporters. Stock cover is a provider-derived estimate, not independently verified accessible stock; do not use it as a risk ranking. The new model does not claim a price or hunger forecast. Shipment loss is annual bilateral flow times disruption fraction times months/12; replacement is hypothetical and starts after a specified delay. Independent product gaps are not summed. No market clearing or cross-product substitution is modelled.

## UX

Six navigation destinations: Overview, Explore, Watch, Stress Test, Briefs, Data & Methods. Shared commodity and country selectors retain preferences locally and support hash query links. Tables provide keyboard-accessible evidence; narrow layouts scroll horizontally where necessary. The original detailed wheat analyses remain linked. New briefs are automatically assembled and unreviewed.

## Release acceptance

- Existing Python and TypeScript tests must pass; run new profile and shipment arithmetic tests.
- Run a real data dry run and inspect FAOSTAT exact item codes and units, especially paddy/milled rice; check country coverage, flags, mirror discrepancies and release size.
- Check release contract, links, mobile layout and keyboard navigation in a real browser; ensure the legacy fallback renders.
- Benchmark runtime and archive caching: extension currently adds one extra streamed pass per archive, rather than one per commodity. Optimize by sharing the original extraction if the 45-minute job budget is exceeded.
- Do not deploy until the above gates pass. Preserve the last known good data branch.

## Prioritized follow-on work (not implemented)

1. USDA PSD monthly production and stocks: preserve marketing-year/product-basis differences, verify API access and redistribution. AMIS market monitoring and GEOGLAM crop conditions: verify licensing and data endpoints; show report dates and coverage. FAO GIEWS and HDX domestic commodity prices: normalize currency, market, unit and frequency without conflating retail/wholesale.
2. Crop-area-weighted CHIRPS precipitation and Copernicus soil moisture/temperature with crop calendar and independent validation. PortWatch is port activity, not commodity-specific shipments.
3. Versioned commodity-specific assumption ledger and alert thresholds calibrated with historical vintages; preserve unknown states and distinguish structural exposure from current changes.
4. Constrained food/feed/fuel utilization and substitution graph; no one-to-one conversions or duplicated processing inputs. Explicit capacity, transport, timing, competing buyers and affordability. Add oils and pulses, then livestock (WOAH), fresh foods and cold chain.
5. Historical release snapshots, evidence-linked decision cards, backtesting (lead time, false alerts, missed events), accessible geospatial maps and source-specific uncertainty.
6. Build previews and manual responsive/accessibility evaluation before merging. Do not imply these candidate sources or future features are connected.

Reference platforms: [FAOSTAT](https://www.fao.org/faostat/en/), [USDA PSD](https://fas.usda.gov/psdonline), [AMIS](https://www.amis-outlook.org/), [GEOGLAM](https://cropmonitor.org/), [FAO GIEWS](https://www.fao.org/giews/en/), [Food Systems Dashboard](https://www.foodsystemsdashboard.org/), [IMF PortWatch](https://portwatch.imf.org/).

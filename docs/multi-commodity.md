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

## Review outcome, 26 November 2026

The release gates above were run. Findings and what was changed.

### Verified against the live archives

The item mappings, which this branch flagged as its main open question, are
correct: 15 Wheat, 27 Rice (the primary crop), 31 Rice; milled, 56 Maize
(corn), 236 Soya beans. All five carry real trade in 2024 — wheat 161.9 Mt,
maize 168.2 Mt, soybeans 161.7 Mt, milled rice 27.1 Mt. Paddy is thin at
2.0 Mt, which is correct rather than a mapping error: paddy is rarely shipped
across borders. Keeping paddy and milled rice as separate items, never added
together, is the right decision and the hardest one here to get right.

A full run against live sources takes 6 minutes 7 seconds, against about two
minutes before. That is the second streamed pass over the 420 MB trade matrix,
as predicted here, and it sits well inside the 45-minute job budget. Sharing a
single pass with the original extraction remains the optimisation to make if
that budget is ever threatened.

### Changed in review

**Stock figures are withheld here on the same terms as everywhere else.** This
branch originally set out not to carry the wheat rejection rules into new
commodities. That is right about thresholds calibrated on one crop, and wrong
about these two rules, which are not about any crop: one asks whether the
newest figure is a rounding error beside that country's own history, and the
other whether a large buyer is recorded as holding under a week of use. Both
are asking whether the accounting has run out of room, which it does the same
way whatever is in the silo. Without them the release contradicted itself —
`countries.json` declined to publish Algeria's wheat stocks and explained why,
while `commodities.json` published 0.00007 months for the same country, crop
and year. 103 figures are now withheld across the five products and 424
published, each withheld one carrying its reason on the page.

The large-buyer rule was also scoped in the process. It now applies only where
annual supply reaches a million tonnes. For a country using a few thousand
tonnes a year, a week of use is a lorryload and holding none of it is
unremarkable; suppressing that would have been the opposite error, hiding a
real zero behind a doubt we do not have.

**A duplicate source row no longer ends the run in a traceback.** Two
conflicting figures for the same country, product, year and measure now keep
neither, record the conflict on the profile, and fail the release gate with a
sentence a maintainer can read. The previous release stays up either way. No
conflicts were found in the current archives.

**Published figures are rounded** to the precision the sources support, which
took the extension from 2.58 MB to 2.36 MB. The gate's supplier-share check
was relaxed from 1e-6 to half a percentage point to match, which still catches
a supplier that has gone missing.

**The plain-language front page is the front page again.** The six navigation
labels in the section above were concept-note vocabulary — Overview, Watch,
Stress Test, Data & Methods — and this site is written for a reader with no
background in food-system modelling. Navigation now reads: What's happening,
Crops, Countries, How a shock travels, What if, Our assumptions, How this
works. The commodity workspace lives at `#/commodities` with its scenario at
`#/commodities/what-if`, rather than replacing `#/`.

**The watch and briefs modes were removed.** Watch restated the seven-stage
chain as hardcoded text that could drift from `chain.yml` without anyone
noticing, and briefs re-rendered the front page's own situation lines. Both
were weaker copies of pages that already exist, and two answers to one question
is the problem this project exists to avoid. The chain and the situation are
reached from the navigation.

**Wording throughout.** Period codes were reaching the page as `2026M10`;
they now read "October 2026". FAO's one-letter source flags were printed as
`A`, `E`, `I`, `X`; they now read "Reported by the country", "Estimated by
FAO", "Filled in from the trading partner's figures", "Supplied by another
organisation". Labels changed from "Gross import share", "Opening-stock
estimate" and "Estimated stock cover" to "Share bought from abroad", "Held in
store at the start of the year" and "How long that would last". Every caution
this branch wrote was kept; only the vocabulary changed.

### Still open

The follow-on list below stands. Two items from the gates above remain
unaddressed and should not be forgotten: the extension still makes a second
pass over each archive, and no source has been watched long enough to know how
often it is late.

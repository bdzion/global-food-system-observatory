# Source inventory

Every source was fetched before it was written into the registry, and the
result of that fetch is recorded here, including the ones that failed. Tested
26 November 2026.

The rule this file exists to enforce: **no connector is written until its
licence and a live fetch have both been tested.** A publicly visible website
does not grant an API, and an API that answers does not grant the right to
republish what it returns.

## In use

### FAO — detailed trade matrix (TM)

- Catalogue: `https://bulks-faostat.fao.org/production/datasets_E.json` — 200, 106 kB
- File: `Trade_DetailedTradeMatrix_E_All_Data_(Normalized).zip` — 200, 420 MB,
  52,410,630 rows, FAO last changed it 23 December 2025
- No key. CC BY 4.0, FAO statistical database terms of use.
- **Caveat that changed the design.** FAO's own description says partner data
  are used for non-reporting countries and missing cells. So the matrix already
  mixes what a country reported with what was estimated for it. Every row we
  publish therefore carries FAO's flag (`A` official, `E` estimated, `I`
  imputed from a partner, `X` external) and the country pages say which basis
  a supplier breakdown rests on.
- **Second caveat.** Many of the most import-dependent countries — Algeria,
  Morocco, Nigeria, Vietnam, Bangladesh, Kenya, Yemen — file no wheat trade
  report at all, so there are no rows where they are the reporter. For those we
  reconstruct the picture from what exporters said they sold them, and publish
  what share of their known imports that accounts for. Checked against the
  supply accounts, the reconstruction lands within a few per cent for most
  (Algeria 6.92 against 6.9 Mt; Morocco 5.15 against 5.1; Bangladesh 2.90
  against 2.9) and badly short for some (Kenya 0.29 against 2.3 Mt). The site
  shows the coverage figure rather than hiding the difference.

### FAO — supply and utilisation accounts (SCL)

- File: `SUA_Crops_Livestock_E_All_Data_(Normalized).zip` — 200, 98 MB,
  12,760,339 rows, last changed 23 November 2026
- No key. CC BY 4.0.
- Gives production, imports, exports, opening stocks, stock variation, food
  use and population per country per year. The only open global source for
  opening stocks.
- **Caveat that changed the design.** These accounts close by using the change
  in stocks as the residual that makes everything else balance. For ten
  countries in this release that drives the newest year's opening stocks to
  zero or near it after years in the millions of tonnes — Algeria runs 2.97 Mt,
  2.60, 2.15, 1.49, then 58 tonnes. Algeria has not emptied its silos; the
  accounting has run out of room. A separate problem affects large buyers whose
  stock figure is a placeholder: Japan appears with about 12,000 tonnes against
  5.2 Mt of imports, which is not a real estimate for a country that runs a
  government wheat reserve. The pipeline refuses both patterns and publishes no
  stock figure for those countries, with the reason on the page.

### FAO — consumer price indices (CP)

- File: `ConsumerPriceIndices_E_All_Data_(Normalized).zip` — 200, 2.1 MB, last
  changed 20 October 2026
- No key. CC BY 4.0. Monthly, by country, food and general indices on a common
  base, which is what makes the gap between them comparable.
- Compiled by FAO from IMF and national statistics offices, so the newest month
  differs by country and the site uses each country's own latest shared month.

### FAO — cost and affordability of a healthy diet (CAHD)

- File: `Cost_Affordability_Healthy_Diet_(CoAHD)_E_All_Data_(Normalized).zip`
  — 200, 88 kB, last changed 21 July 2026
- No key. CC BY 4.0.
- Gives the prevalence of unaffordability and the cost of a healthy diet. This
  is the entitlement layer: it is the difference between food being available
  and food being reachable.
- Modelled from retail prices and income distributions, not measured by asking
  households. It shows the ground a price rise would land on.

### World Bank — monthly commodity prices (the "Pink Sheet")

- Discovery page: `https://www.worldbank.org/en/research/commodity-markets` — 200
- File: `CMO-Historical-Data-Monthly.xlsx` — 200, 765 kB, workbook's own line
  reads "Updated on November 03, 2026", data through October 2026
- No key. CC BY 4.0 under the World Bank's terms for datasets.
- **Caveat that changed the design.** The workbook's address contains a
  document identifier that changes every month. The first address tried,
  carried over from an older page, returned 200 and a file whose data stopped
  at December 2024 — a successful fetch of stale data, which is exactly the
  failure this project exists to catch. The connector now reads the current
  address off the Commodity Markets page on every run and records the
  workbook's own "Updated on" line rather than the time we downloaded it.

### World Bank — development indicators

- `https://api.worldbank.org/v2/country/{list}/indicator/{code}` — 200
- No key. CC BY 4.0. Used for foreign currency reserves, the total import bill,
  population and income per head.
- National figures only. A country holding plenty of foreign currency does not
  mean its households can afford food, and the site says so where it shows them.

## Considered and not used

### UN Comtrade

Not used, and this is the one decision in the inventory worth arguing about.

- The keyless preview tier caps results at a few hundred records per call at
  roughly one request a second. A free registered account allows on the order
  of 500 calls a day, with the lowest tiers limited to recent years and
  aggregate data.
- UN Comtrade restricts passing its data on to others.

A global bilateral wheat matrix cannot be assembled inside that budget, and
publishing it as a download — which this site does — would not be permitted if
it could. An institutional subscription through the university would solve the
first problem and not the second, because institutional licences generally
carry no public redistribution right.

FAOSTAT's trade matrix covers the same ground, is keyless, and is CC BY 4.0.
The cost of the substitution is that FAOSTAT is annual where Comtrade has
monthly series, and that FAOSTAT has already blended reported and mirrored
flows. Both are stated on the site rather than absorbed.

**Revisit when:** a licence permitting public redistribution is in place, or
the site needs monthly trade recency enough to run a small number of priority
flows inside the free quota without republishing them.

### USDA PSD

- Open Data service at `apps.fas.usda.gov/OpenData`, authenticated by an
  `API_KEY` header issued free through api.data.gov. US federal data, so no
  redistribution restriction.
- Not in this version only because it needs a credential and this release was
  built to run with none. It is the first thing to add: it is the only open
  source of stocks-to-use for the major exporters, and it would reduce the
  reliance on FAO's stock estimates that this inventory spends so long
  qualifying.

### GEOGLAM Crop Monitor

- `https://www.cropmonitor.org/` — 200.
- Its crop condition assessment is the right source for the growing-season link
  of the chain, which this version honestly leaves unwatched. It is published
  as an expert consensus report rather than as a machine-readable series, so
  connecting it properly is a piece of work rather than a connector.

### ReliefWeb

- `https://api.reliefweb.int/v1/reports` — **410 Gone**. The v1 API has been
  retired. Any documentation still pointing at it is out of date, which is
  worth knowing before anyone writes against it.

### GDACS

- `https://www.gdacs.org/xml/rss.xml` — 200, 580 kB. Works, and is a candidate
  for an events layer. Left out of this version to keep the source count at two
  groups, as the plan committed to.

## What is still unverified

- The FAOSTAT data API at `fenixservices.fao.org/faostat/api/v1` did not
  respond from our environment. The bulk route is used instead and is the
  better choice for this workload anyway, but the API has not been ruled out.
- The World Bank Pink Sheet connector's discovery step depends on the shape of
  the Commodity Markets page. If that page changes, the connector raises rather
  than falling back on a stale file, which is the behaviour we want, but it
  will need a human.
- No source has been watched long enough to know how often it is late. The
  staleness thresholds in `sources.yml` come from each provider's stated
  publication rhythm plus a margin, not from observed behaviour, and should be
  revised once there is a record.

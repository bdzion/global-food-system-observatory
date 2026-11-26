# Global Food System Observatory

**Shocks to the food system are certain. Crises are not.** What decides which
one you get is what a country has to fall back on when a supplier stops
shipping: wheat in store, more than one seller to call, money to buy with, and
households with room in the budget.

This site shows those things for the world's wheat trade, in plain language,
and says plainly where it cannot see.

→ **[bdzion.github.io/global-food-system-observatory](https://bdzion.github.io/global-food-system-observatory/)**

A research project at the Department of Geography, Environment and Geomatics,
University of Guelph. It is not an official warning system, nothing on it is a
forecast, and it has not been validated against a real disruption.

---

## What it does that other platforms do not

**It wires its own forward-looking claims to the figures that would break
them.** The what-if test on the site rests on four stated assumptions. Each one
names a published figure and a number. When a release crosses that number, the
assumption is marked contradicted, with the date and the reading that did it,
and the test is flagged as needing another look. Nothing is quietly
recalculated. [Our assumptions](https://bdzion.github.io/global-food-system-observatory/#/assumptions)
is where the site checks itself in public.

**It reports an unwatched link as unwatched, never as calm.** A wheat shock
travels through seven links, from the cost of fertilizer to whether people can
afford to eat well. Two of those seven have nothing watching them here. They
say so everywhere they appear. A site that shows silence as safety is worse
than no site, because it tells a reader they have checked when they have not.

**It names who else would be bidding.** Advice to one buyer to look elsewhere
is competition for another. Every what-if result lists the other countries that
depend on the supplier being recommended, with how thin their own position is.

**It declines to publish figures it does not believe.** FAO's accounts close by
treating the change in stocks as the residual that makes everything balance.
For ten countries in the current release that leaves the newest year at or near
zero after years in the millions of tonnes. The site publishes no stock figure
for those, says why on each page, and keeps stock cover off the front page
rather than rank countries on a measure that cannot carry a league table.

## Where the figures come from

Six sources, all open, all with their redistribution right recorded in
[`pipeline/config/sources.yml`](pipeline/config/sources.yml). The release build
refuses to publish anything from a source whose licence has not been cleared.

| What it tells us | Source | How often |
| --- | --- | --- |
| Who buys wheat from whom | FAO detailed trade matrix | yearly |
| What each country grew, bought, sold and held | FAO supply and utilisation accounts | yearly |
| What food costs in the shops | FAO consumer price indices | monthly |
| How many people cannot afford a healthy diet | FAO cost and affordability of a healthy diet | yearly |
| World wheat, fertilizer and energy prices | World Bank commodity price data | monthly |
| Reserves, imports, population | World Bank development indicators | yearly |

UN Comtrade was considered and is not used: its free tier returns a few hundred
records per request, and it restricts passing its data on to others, which the
site's download promise would breach. The reasoning is recorded in
[`docs/source-inventory.md`](docs/source-inventory.md).

## Running it

```bash
# The data pipeline
cd pipeline
pip install -r requirements.txt
python -m pytest                      # 57 tests, no network needed
python -m gfso.run --out ../public/data --dry-run   # build and check, publish nothing
python -m gfso.run --out ../public/data             # build and publish a release

# The website
npm install
npm test        # checks a published release against what the pages read
npm run dev
npm run build
```

The first pipeline run downloads about 500 MB of bulk archives from FAO and
caches them in `.cache`. Later runs reuse the cache; set `GFSO_CACHE` to put it
somewhere else.

## How a release works

The pipeline writes a set of small JSON files plus a manifest listing each one
with its checksum. The site reads the manifest first, so it can never show half
of one release and half of another.

Before anything is published, the release has to pass its checks: every file
carries the current format version, every country has all seven chain links,
every unwatched link says why nobody is watching it, every published source has
a cleared redistribution right, and the situation text is marked unreviewed. If
a check fails, nothing is published and the previous release stays up — an old
release that is honestly labelled beats a new one that is wrong.

Releases are committed to a separate `data` branch, never to `main`, so the
main branch stays small however long the project runs. It also means every past
release is kept, which is what makes it possible to ask later what the site
said on a given day.

## Repository

```
pipeline/
  gfso/
    core.py          fetching, robust statistics, atomic writes
    connectors/      one adapter per source
    extract.py       pulling the slices we need out of the published files
    analysis.py      indicators, suppliers, buffers, the chain, the ledger
    build.py         assembling a release
    run.py           checks and publishing
  config/            sources, the chain, the what-if test, country codes
  tests/             57 tests, all offline
src/
  pages/             six destinations
  components/        shared pieces, every chart with a table beside it
  lib/               release loading, routing, plain-language formatting
tests/               checks a published release against what the pages read
docs/                audit, source inventory, architecture decisions
```

## Contributing and corrections

Corrections are welcome and are recorded with their date. Email
[mbodrudd@uoguelph.ca](mailto:mbodrudd@uoguelph.ca) or open an issue. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

Code under the MIT Licence; written content, methods and published releases
under CC BY 4.0. The underlying statistics belong to FAO and the World Bank and
remain under their terms. See [LICENSE](LICENSE).

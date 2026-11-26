"""Pull the slices this version needs out of the published statistics.

Everything here is a filter. No number is changed, converted or combined at
this stage: that happens in analysis.py, where it can be explained. Keeping the
two apart means a reader can check our arithmetic without also having to trust
our reading of somebody else's file format.

Country codes: FAOSTAT identifies places by M49 code, and so does this
pipeline, translating to ISO 3166-1 alpha-3 through one static table. M49 codes
that are not countries — World, Africa, Europe, income groups — fail that
lookup and are dropped. That is deliberate. Folding a regional total into a
country list would make every share and every ranking wrong, and nothing in the
output would say so.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import core
from .connectors import faostat, worldbank

# FAOSTAT codes used by this version. Each is written out rather than looked up
# by name, because FAO renames items between releases and a code does not move.
WHEAT_ITEM = "15"  # Wheat, the grain itself. Flour is item 16 and is not included.

TRADE_ELEMENTS = {"5610": "import_quantity", "5910": "export_quantity"}
SUA_ELEMENTS = {
    "5510": "production",
    "5610": "imports",
    "5910": "exports",
    "5113": "opening_stocks",
    "5071": "stock_variation",
    "5141": "food_use",
    "511": "population",
}
CPI_ITEMS = {"23013": "food_cpi", "23012": "general_cpi", "23014": "food_inflation"}
DIET_ITEMS = {"7005": "unaffordable_pct", "70040": "healthy_diet_cost"}

FIRST_YEAR = 2015


def country_table() -> dict[str, dict]:
    with open(core.CONFIG / "countries.json", encoding="utf-8") as f:
        return json.load(f)


def _iso(table: dict, code: str | None) -> str | None:
    m = faostat.m49(code)
    return table.get(m, {}).get("iso3") if m else None


def wheat_trade(cache: Path | None = None) -> dict:
    """Bilateral wheat flows, both as importers report them and as exporters do.

    Two views of the same trade, kept apart on purpose.

    `reported` is what the importing country itself told FAO it bought, and
    from whom. `mirrored` is the same trade reconstructed from what exporting
    countries said they sold to it.

    They are not interchangeable. Many of the countries that depend on imported
    wheat most heavily do not report their own trade at all, so for them the
    only picture available is the one their suppliers describe. That picture is
    usually incomplete, because it only covers the suppliers who do report. The
    website shows which of the two it is using, and what share of the country's
    known imports the mirrored view accounts for.
    """
    table = country_table()
    reported: dict[str, dict[str, float]] = {}
    mirrored: dict[str, dict[str, float]] = {}
    flags: dict[str, dict[str, str]] = {}
    years: set[int] = set()

    def keep(row: dict) -> bool:
        return (
            row.get("Item Code") == WHEAT_ITEM
            and row.get("Element Code") in TRADE_ELEMENTS
            and row.get("Unit") == "t"
        )

    for row in faostat.rows("TM", keep, cache):
        year_text = row.get("Year", "")
        if not year_text.isdigit() or int(year_text) < FIRST_YEAR:
            continue
        year = int(year_text)
        value = faostat.number(row.get("Value"))
        if value is None or value <= 0:
            continue
        reporter = _iso(table, row.get("Reporter Country Code (M49)"))
        partner = _iso(table, row.get("Partner Country Code (M49)"))
        if not reporter or not partner or reporter == partner:
            continue
        years.add(year)
        element = TRADE_ELEMENTS[row["Element Code"]]
        if element == "import_quantity":
            # The importer speaking: reporter bought from partner.
            bucket = reported.setdefault(f"{year}|{reporter}", {})
            bucket[partner] = bucket.get(partner, 0.0) + value
            flags.setdefault(f"{year}|{reporter}", {})[partner] = (
                row.get("Flag") or ""
            ).strip()
        else:
            # The exporter speaking: reporter sold to partner, so from the
            # partner's point of view reporter is one of its suppliers.
            bucket = mirrored.setdefault(f"{year}|{partner}", {})
            bucket[reporter] = bucket.get(reporter, 0.0) + value

    return {
        "reported": reported,
        "mirrored": mirrored,
        "flags": flags,
        "years": sorted(years),
        "updated": _dataset_date("TM", cache),
    }


def wheat_balance(cache: Path | None = None) -> dict:
    """Each country's wheat: how much it grew, bought, sold and had in store."""
    table = country_table()
    out: dict[str, dict] = {}
    years: set[int] = set()

    def keep(row: dict) -> bool:
        return (
            row.get("Item Code") == WHEAT_ITEM
            and row.get("Element Code") in SUA_ELEMENTS
        )

    for row in faostat.rows("SCL", keep, cache):
        year_text = row.get("Year", "")
        if not year_text.isdigit() or int(year_text) < FIRST_YEAR:
            continue
        iso = _iso(table, row.get("Area Code (M49)"))
        if not iso:
            continue
        value = faostat.number(row.get("Value"))
        if value is None:
            continue
        year = int(year_text)
        years.add(year)
        record = out.setdefault(f"{year}|{iso}", {"flags": {}})
        field = SUA_ELEMENTS[row["Element Code"]]
        record[field] = value
        record["flags"][field] = (row.get("Flag") or "").strip()

    return {"balance": out, "years": sorted(years), "updated": _dataset_date("SCL", cache)}


def food_prices(cache: Path | None = None) -> dict:
    """Food and general consumer price indices, month by month, by country."""
    table = country_table()
    out: dict[str, dict[str, float]] = {}
    months = {
        "January": "01", "February": "02", "March": "03", "April": "04",
        "May": "05", "June": "06", "July": "07", "August": "08",
        "September": "09", "October": "10", "November": "11", "December": "12",
    }

    def keep(row: dict) -> bool:
        return row.get("Item Code") in CPI_ITEMS and row.get("Months") in months

    for row in faostat.rows("CP", keep, cache):
        year_text = row.get("Year", "")
        if not year_text.isdigit() or int(year_text) < FIRST_YEAR - 5:
            continue
        iso = _iso(table, row.get("Area Code (M49)"))
        value = faostat.number(row.get("Value"))
        if not iso or value is None:
            continue
        period = f"{year_text}-{months[row['Months']]}"
        out.setdefault(f"{iso}|{CPI_ITEMS[row['Item Code']]}", {})[period] = value

    return {"series": out, "updated": _dataset_date("CP", cache)}


def diet_affordability(cache: Path | None = None) -> dict:
    """What a healthy diet costs, and how many people cannot afford one."""
    table = country_table()
    out: dict[str, dict[int, float]] = {}

    def keep(row: dict) -> bool:
        return row.get("Item Code") in DIET_ITEMS

    for row in faostat.rows("CAHD", keep, cache):
        year_text = row.get("Year", "")
        if not year_text.isdigit():
            continue
        iso = _iso(table, row.get("Area Code (M49)"))
        value = faostat.number(row.get("Value"))
        if not iso or value is None:
            continue
        out.setdefault(f"{iso}|{DIET_ITEMS[row['Item Code']]}", {})[
            int(year_text)
        ] = value

    return {"series": out, "updated": _dataset_date("CAHD", cache)}


def economic_capacity(countries: list[str]) -> dict:
    """Foreign currency reserves, imports and population, from the World Bank.

    Reserves set against the monthly import bill give a rough answer to a plain
    question: if a country had to buy everything it imports on reserves alone,
    how many months could it keep going? It is a national figure and says
    nothing about any particular household.
    """
    return {
        "reserves_usd": worldbank.indicator("FI.RES.TOTL.CD", countries),
        "imports_usd": worldbank.indicator("NE.IMP.GNFS.CD", countries),
        "population": worldbank.indicator("SP.POP.TOTL", countries),
        "gni_per_capita": worldbank.indicator("NY.GNP.PCAP.CD", countries),
    }


def _dataset_date(code: str, cache: Path | None):
    entry = faostat.catalogue(cache).get(code, {})
    d = core.parse_date(entry.get("DateUpdate"))
    return d.isoformat() if d else None

"""World Bank: the monthly "Pink Sheet" price workbook and the Indicators API.

A note on the Pink Sheet URL. The World Bank republishes the workbook each
month at an address containing a document identifier that changes with it, so
a hard-coded link quietly goes stale: it keeps returning a file, and the file
keeps holding last year's prices. This connector therefore reads the current
address off the Commodity Markets page every run, and the pipeline records the
workbook's own "Updated on" line rather than the time we downloaded it.

That distinction is the whole point. A fetch that worked is not the same as
data that is new, and a monitoring platform that confuses the two will report
an old world with a fresh timestamp on it.
"""
from __future__ import annotations

import re
from pathlib import Path

from .. import core

MARKETS_PAGE = "https://www.worldbank.org/en/research/commodity-markets"
WORKBOOK_PATTERN = re.compile(
    r"https://[^\"'\s]*CMO-Historical-Data-Monthly\.xlsx"
)
API = "https://api.worldbank.org/v2"

# The series this version uses, with the plain words the website shows and the
# reason each one is here. Keys are the workbook's own column headings.
SERIES = {
    "Wheat, US HRW": {
        "id": "wheat_price",
        "plain": "World wheat price",
        "why": "The reference price buyers and sellers quote against.",
        "unit": "US$ per tonne",
    },
    "Maize": {
        "id": "maize_price",
        "plain": "World maize price",
        "why": "Moves with wheat, and competes with it for feed demand.",
        "unit": "US$ per tonne",
    },
    "Urea ": {
        "id": "urea_price",
        "plain": "Urea fertilizer price",
        "why": "The nitrogen fertilizer most wheat growers buy.",
        "unit": "US$ per tonne",
    },
    "DAP": {
        "id": "dap_price",
        "plain": "Phosphate fertilizer price",
        "why": "A phosphate fertilizer. Its price feeds into next season's crop.",
        "unit": "US$ per tonne",
    },
    "Potassium chloride **": {
        "id": "potash_price",
        "plain": "Potash fertilizer price",
        "why": "The third main plant nutrient, and the most concentrated market.",
        "unit": "US$ per tonne",
    },
    "Crude oil, average": {
        "id": "oil_price",
        "plain": "Crude oil price",
        "why": "Sets the cost of moving grain and of making fertilizer.",
        "unit": "US$ per barrel",
    },
    "Natural gas, Europe": {
        "id": "gas_price",
        "plain": "European natural gas price",
        "why": "Nitrogen fertilizer is made from natural gas, so the two move together.",
        "unit": "US$ per million British thermal units",
    },
}


# Additional benchmarks are optional: a missing column cannot disable the
# original validated series. Exact published column names only.
OPTIONAL_SERIES = {
    "Rice, Thai 5%": {"id":"rice_price","plain":"Thai 5% broken milled rice benchmark","why":"Export reference, not a domestic rice price.","unit":"US$ per tonne"},
    "Soybeans": {"id":"soybean_price","plain":"Soybean benchmark","why":"Oilseed and feed-market pressure.","unit":"US$ per tonne"},
    "Palm oil": {"id":"palm_oil_price","plain":"Palm oil benchmark","why":"International edible-oil reference price.","unit":"US$ per tonne"},
    "Soybean oil": {"id":"soybean_oil_price","plain":"Soybean oil benchmark","why":"International edible-oil reference price.","unit":"US$ per tonne"},
    "Barley": {"id":"barley_price","plain":"Barley benchmark","why":"International feed-grain reference price; series may be discontinued.","unit":"US$ per tonne"},
    "Sorghum": {"id":"sorghum_price","plain":"Sorghum benchmark","why":"International grain reference price; series may be discontinued.","unit":"US$ per tonne"},
}

def workbook_url() -> str:
    """Find the address of this month's price workbook."""
    page = core.fetch(MARKETS_PAGE, timeout=90)
    match = WORKBOOK_PATTERN.search(page.decode("utf-8", "replace"))
    if not match:
        raise core.SourceError(
            "the World Bank Commodity Markets page no longer links to a monthly "
            "workbook in the expected form; the connector needs checking"
        )
    return match.group(0)


def pink_sheet(cache: Path | None = None) -> dict:
    """Monthly price series, with the date the World Bank last updated them.

    Returns {"updated": date | None, "periods": [...], "series": {id: [...]}}
    where each series is a list the same length as `periods`, holding None
    wherever the World Bank published no figure.
    """
    import openpyxl  # imported here so the rest of the pipeline needs no Excel reader

    cache = cache or core.cache_dir()
    dest = cache / "worldbank_pink_sheet.xlsx"
    url = workbook_url()
    core.fetch(url, dest=dest)

    book = openpyxl.load_workbook(dest, read_only=True, data_only=True)
    sheet = book["Monthly Prices"]
    rows = list(sheet.iter_rows(values_only=True))

    # Row 4 of the workbook is the "Updated on <date>" line. It is the only
    # honest statement of how fresh these numbers are.
    updated = None
    note = str(rows[3][0] or "")
    stamp = re.search(r"Updated on ([A-Za-z]+ \d{1,2}, \d{4})", note)
    if stamp:
        from datetime import datetime

        try:
            updated = datetime.strptime(stamp.group(1), "%B %d, %Y").date()
        except ValueError:
            updated = None

    heading = rows[4]
    columns = {name: i for i, name in enumerate(heading) if name}
    wanted = {columns[name]: meta for name, meta in SERIES.items() if name in columns}
    missing = [name for name in SERIES if name not in columns]
    if missing:
        raise core.SourceError(
            "the Pink Sheet workbook no longer has these columns: " + ", ".join(missing)
        )

    optional = {name: meta for name, meta in OPTIONAL_SERIES.items() if name in columns}
    wanted.update({columns[name]: meta for name, meta in optional.items()})
    active = {**SERIES, **optional}
    periods: list[str] = []
    series: dict[str, list[float | None]] = {m["id"]: [] for m in active.values()}
    for row in rows[6:]:
        label = row[0]
        if not label or not re.fullmatch(r"\d{4}M\d{2}", str(label).strip()):
            continue
        periods.append(str(label).strip())
        for index, meta in wanted.items():
            value = row[index] if index < len(row) else None
            try:
                # The workbook writes a missing value as "…" or "..", never 0.
                series[meta["id"]].append(
                    float(value) if value not in (None, "", "…", "..") else None
                )
            except (TypeError, ValueError):
                series[meta["id"]].append(None)

    return {
        "updated": updated,
        "source_url": url,
        "periods": periods,
        "series": series,
        "meta": {m["id"]: m for m in active.values()},
    }


def indicator(code: str, countries: list[str], *, most_recent: int = 8) -> dict:
    """One World Development Indicator for a list of ISO3 countries.

    Returns {iso3: {"year": int, "value": float}} holding the newest year that
    actually has a figure. Countries the Bank has no figure for are simply
    absent, rather than present with a zero.
    """
    out: dict[str, dict] = {}
    # The API takes up to a few dozen country codes in one call. Chunking keeps
    # the request short enough for the server and polite in volume.
    for start in range(0, len(countries), 40):
        chunk = countries[start : start + 40]
        url = f"{API}/country/{';'.join(chunk)}/indicator/{code}"
        payload = core.fetch_json(
            url,
            params={"format": "json", "per_page": 20000, "mrnev": most_recent},
            timeout=180,
        )
        if not isinstance(payload, list) or len(payload) < 2 or payload[1] is None:
            continue
        for row in payload[1]:
            iso = (row.get("countryiso3code") or "").upper()
            value, year = row.get("value"), row.get("date")
            if not iso or value is None or not str(year).isdigit():
                continue
            year = int(year)
            if iso not in out or year > out[iso]["year"]:
                out[iso] = {"year": year, "value": float(value)}
    return out

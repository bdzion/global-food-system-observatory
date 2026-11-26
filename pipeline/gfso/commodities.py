"""Additive multi-commodity annual structural evidence.

Keep the legacy wheat release intact. Read each bulk archive once for the
additional product-form slices. Never silently convert paddy into milled rice,
infer missing trade, or treat a national food-price index as a commodity price.
"""
from __future__ import annotations

import math
from pathlib import Path

from . import SCHEMA_VERSION, core, extract, analysis
from .connectors import faostat

FIELDS = {
    "5510": "production", "5610": "imports", "5910": "exports",
    "5113": "opening_stocks", "5141": "food_use",
}
SOURCE_URLS = {
    "FAO-SUA": "https://www.fao.org/faostat/en/#data/SCL",
    "FAO-TM": "https://www.fao.org/faostat/en/#data/TM",
    "FAO-CP": "https://www.fao.org/faostat/en/#data/CP",
    "FAO-CAHD": "https://www.fao.org/faostat/en/#data/CAHD",
    "WB-PINK": "https://www.worldbank.org/en/research/commodity-markets",
}


def registry():
    config = core.load_config("commodities.yml")["commodities"]
    codes = [v["item_code"] for v in config.values()]
    if len(codes) != len(set(codes)):
        raise ValueError("Duplicate commodity item code")
    return config


def _value(row):
    value = faostat.number(row.get("Value"))
    return value if value is not None and math.isfinite(value) and value >= 0 else None


def _year(row):
    year = row.get("Year", "")
    return int(year) if year.isdigit() and int(year) >= extract.FIRST_YEAR else None


def read_slices(config, cache=None):
    """A single streamed scan per archive, with exact form and unit filters."""
    table = extract.country_table()
    ids = {v["item_code"]: k for k, v in config.items()}
    balances = {k: {} for k in config}
    trades = {k: {"reported": {}, "mirrored": {}, "flags": {}} for k in config}

    def keep_balance(row):
        return row.get("Item Code") in ids and row.get("Element Code") in FIELDS and row.get("Unit") == "t"

    for row in faostat.rows("SCL", keep_balance, cache):
        iso = extract._iso(table, row.get("Area Code (M49)"))
        year, value = _year(row), _value(row)
        if not iso or year is None or value is None:
            continue
        key = ids[row["Item Code"]]
        field = FIELDS[row["Element Code"]]
        entry = balances[key].setdefault(f"{year}|{iso}", {"flags": {}})
        if field in entry and entry[field] != value:
            raise ValueError(f"Conflicting SUA rows: {key}/{year}/{iso}/{field}")
        entry[field] = value
        entry["flags"][field] = (row.get("Flag") or "").strip()

    def keep_trade(row):
        return row.get("Item Code") in ids and row.get("Element Code") in extract.TRADE_ELEMENTS and row.get("Unit") == "t"

    for row in faostat.rows("TM", keep_trade, cache):
        reporter = extract._iso(table, row.get("Reporter Country Code (M49)"))
        partner = extract._iso(table, row.get("Partner Country Code (M49)"))
        year, value = _year(row), _value(row)
        if not reporter or not partner or reporter == partner or year is None or value is None or value == 0:
            continue
        trade = trades[ids[row["Item Code"]]]
        direct = row["Element Code"] == "5610"
        buyer, seller = (reporter, partner) if direct else (partner, reporter)
        key = f"{year}|{buyer}"
        bucket = trade["reported" if direct else "mirrored"].setdefault(key, {})
        bucket[seller] = bucket.get(seller, 0) + value
        # Preserve flags separately for each reporting direction.
        flags = trade["flags"].setdefault(("direct|" if direct else "mirror|") + key, {})
        flag = (row.get("Flag") or "").strip()
        flags[seller] = ",".join(sorted(set(filter(None, [flags.get(seller), flag]))))
    return balances, trades


def profile(iso, year, balance, trade):
    record = balance.get(f"{year}|{iso}")
    if record is None:
        return None
    p, m, x = (record.get(k) for k in ("production", "imports", "exports"))
    supply = p + m - x if all(v is not None for v in (p, m, x)) else None
    # Apparent domestic availability before stock movements; not food intake.
    supply = supply if supply is not None and supply > 0 else None
    direct = trade["reported"].get(f"{year}|{iso}", {})
    mirror = trade["mirrored"].get(f"{year}|{iso}", {})
    rows = direct or mirror
    basis = "importer_reported" if direct else "exporter_mirrored" if mirror else "unavailable"
    total = sum(rows.values())
    flags = trade["flags"].get(("direct|" if direct else "mirror|") + f"{year}|{iso}", {})
    suppliers = [
        {"iso3": seller, "quantity_t": qty, "share_pct": 100 * qty / total,
         "flag": flags.get(seller, "")}
        for seller, qty in sorted(rows.items(), key=lambda kv: (-kv[1], kv[0]))
    ] if total > 0 else []
    stock = record.get("opening_stocks")
    # Do not transfer wheat-specific rejection thresholds to new commodities.
    # Report the provider estimate with its flag, never claim measured reserves.
    stock_cover = 12 * stock / supply if stock is not None and supply else None
    history = [{"year": int(key.split("|")[0]),
                **{field: r.get(field) for field in FIELDS.values()},
                "flags": r["flags"]} for key, r in sorted(balance.items())
               if key.endswith("|" + iso) and int(key.split("|")[0]) <= year][-7:]
    return {
        "iso3": iso, "year": year, "production_t": p, "imports_t": m,
        "exports_t": x, "apparent_supply_t": supply,
        "gross_import_share_pct": 100 * m / supply if supply and m is not None else None,
        "opening_stocks_t": stock, "estimated_cover_months": stock_cover,
        "food_use_t": record.get("food_use"),
        "flags": record["flags"], "suppliers": suppliers,
        "supplier_basis": basis,
        "supplier_coverage_pct": 100 * total / m if m is not None and m > 0 and total > 0 else None,
        "supplier_hhi": sum((v / total) ** 2 for v in rows.values()) if total > 0 else None,
        "history": history,
    }


def build_extension(cache: Path | None, legacy: dict):
    config = registry()
    balances, trades = read_slices(config, cache)
    names = {v["iso3"]: v["name"] for v in extract.country_table().values()}
    prices = analysis.price_signals(legacy["pink"])
    products = {}
    for key, meta in config.items():
        balance, trade = balances[key], trades[key]
        # Same observation year for all countries in this product; never
        # substitute the last observation from another year.
        years = sorted({int(k.split("|")[0]) for k in balance})
        year = years[-1] if years else None
        profiles = {}
        if year is not None:
            for rowkey in sorted(balance):
                y, iso = rowkey.split("|")
                if int(y) != year:
                    continue
                row = profile(iso, year, balance, trade)
                if row is None:
                    continue
                row["name"] = names.get(iso, iso)
                for supplier in row["suppliers"]:
                    supplier["name"] = names.get(supplier["iso3"], supplier["iso3"])
                row["food_price_gap"] = analysis.price_gap(iso, legacy["cpi"])
                diet = legacy["diet"]["series"].get(f"{iso}|unaffordable_pct") or {}
                row["healthy_diet_unaffordable"] = (
                    {"year": max(diet), "value": diet[max(diet)]} if diet else None
                )
                profiles[iso] = row
        exporters = sorted(
            (p for p in profiles.values() if p["exports_t"] is not None and p["exports_t"] > 0),
            key=lambda p: (-p["exports_t"], p["iso3"])
        )[:12]
        products[key] = {
            **meta, "year": year, "countries": profiles,
            "exporters": [{"iso3": p["iso3"], "name": p["name"], "exports_t": p["exports_t"]} for p in exporters],
            "price": prices.get(meta.get("price_id")),
            "status": "annual_structural_evidence" if profiles else "no_data",
        }
    return {
        "schema_version": SCHEMA_VERSION, "extension_version": 1,
        "products": products,
        "sources": SOURCE_URLS,
        "provider_updated": {code: extract._dataset_date(domain, cache)
                             for code, domain in (("FAO-SUA", "SCL"), ("FAO-TM", "TM"), ("FAO-CP", "CP"), ("FAO-CAHD", "CAHD"))},
        "method": {
            "quantity": "Exact FAOSTAT item and tonne; no conversion or aggregation across product forms.",
            "gross_import_share_pct": "Imports / (production + imports - exports) × 100; requires all three quantities. Can exceed 100% for re-exporters; not net dependence.",
            "estimated_cover_months": "Opening-stock estimate / apparent domestic availability × 12; not measured reserves, not a forecast. Not used to rank risks.",
            "supplier_share": "Share of observed bilateral flows, not all imports; importer report preferred, mirror fallback; coverage can exceed 100% due to source discrepancies.",
            "food_price_gap": "National food CPI growth minus general CPI growth; not commodity-specific.",
            "healthy_diet_unaffordable": "FAO modelled national estimate, not commodity-specific.",
            "status": "Annual structural evidence, not a current alert.",
        }
    }


def checks(extension):
    problems = []
    if extension.get("extension_version") != 1:
        problems.append("Unknown commodity extension format")
    for key, product in extension["products"].items():
        if key in ("wheat", "maize", "soybeans", "rice") and len(product["countries"]) < 20:
            problems.append(f"{key}: fewer than 20 exact-form country profiles; inspect source mappings")
        for iso, row in product["countries"].items():
            if row["year"] != product["year"]:
                problems.append(f"{key}/{iso}: mixed observation years")
            if row["suppliers"] and abs(sum(s["share_pct"] for s in row["suppliers"]) - 100) > 1e-6:
                problems.append(f"{key}/{iso}: supplier shares do not sum to 100")
            if row["gross_import_share_pct"] is not None and row["apparent_supply_t"] is None:
                problems.append(f"{key}/{iso}: import share without denominator")
    return problems

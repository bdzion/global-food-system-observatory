"""Assemble one release: the files the website reads.

A release is a set of small JSON files plus a manifest that lists them with
their checksums. The site reads the manifest first, so it can never show half
of one release and half of another.

Nothing in here invents a number. Where a figure is missing it stays missing,
and the pages are built to say so.
"""
from __future__ import annotations

from pathlib import Path

from . import analysis, core, extract
from . import SCHEMA_VERSION
from .connectors import faostat, worldbank

# Countries get a full profile if they buy this much wheat or more. Below it,
# wheat is a minor trade and a profile would be more noise than signal.
PROFILE_IMPORT_FLOOR = 300_000.0

# The sellers that matter for the export-supply stage of the chain.
MAJOR_EXPORTERS = [
    "RUS", "USA", "CAN", "AUS", "UKR", "ARG", "FRA", "DEU", "ROU", "BGR", "KAZ", "POL",
]


def gather(cache: Path | None = None) -> dict:
    """Fetch and extract everything. This is the only part that touches a network."""
    trade = extract.wheat_trade(cache)
    balance = extract.wheat_balance(cache)
    cpi = extract.food_prices(cache)
    diet = extract.diet_affordability(cache)
    pink = worldbank.pink_sheet(cache)

    years = balance["years"]
    latest = max(years) if years else None
    isos = sorted(
        {
            key.split("|")[1]
            for key in balance["balance"]
            if key.startswith(f"{latest}|")
        }
    )
    economy = extract.economic_capacity(isos)

    return {
        "trade": trade,
        "balance": balance,
        "cpi": cpi,
        "diet": diet,
        "pink": pink,
        "economy": economy,
        "latest_year": latest,
        "years": years,
    }


def assemble(data: dict) -> dict:
    """Build every published file from the gathered figures."""
    names = extract.country_table()
    name_of = {v["iso3"]: v["name"] for v in names.values()}
    chain_config = core.load_config("chain.yml")
    scenario_config = core.load_config("scenario.yml")
    source_registry = core.sources()

    latest = data["latest_year"]
    history = [y for y in data["years"] if y < latest][-6:]

    prices = analysis.price_signals(data["pink"])
    world = {"prices": prices}

    # How the main sellers are doing. The chain's export-supply stage reads the
    # worst of them, because one short seller is what matters to a buyer.
    exporters = []
    for iso in MAJOR_EXPORTERS:
        profile = analysis.country_wheat(
            iso, latest, data["balance"]["balance"], data["trade"], history
        )
        if not profile:
            continue
        past_production = [
            (data["balance"]["balance"].get(f"{y}|{iso}") or {}).get("production")
            for y in history
        ]
        record = data["balance"]["balance"].get(f"{latest}|{iso}") or {}
        band = core.reference_band(record.get("production"), past_production)
        stocks_band = core.reference_band(
            record.get("opening_stocks"),
            [
                (data["balance"]["balance"].get(f"{y}|{iso}") or {}).get(
                    "opening_stocks"
                )
                for y in history
            ],
        )
        exporters.append(
            {
                "iso3": iso,
                "name": name_of.get(iso, iso),
                "production_t": profile["production_t"],
                "exports_t": profile["exports_t"],
                "opening_stocks_t": profile["opening_stocks_t"],
                "stock_cover_months": profile["stock_cover_months"],
                "production_vs_usual": band,
                "stocks_vs_usual": stocks_band,
                "year": latest,
            }
        )
    exporters.sort(key=lambda e: -(e["exports_t"] or 0))

    world["exporters"] = exporters
    world["worst_exporter_production"] = _worst(exporters, "production_vs_usual", "grew", latest)
    world["worst_exporter_stocks"] = _worst(exporters, "stocks_vs_usual", "held in store", latest)

    # Country profiles.
    countries: dict[str, dict] = {}
    for key in data["balance"]["balance"]:
        year, iso = key.split("|")
        if int(year) != latest:
            continue
        profile = analysis.country_wheat(
            iso, latest, data["balance"]["balance"], data["trade"], history
        )
        if not profile or (profile["imports_t"] or 0) < PROFILE_IMPORT_FLOOR:
            continue

        gap = analysis.price_gap(iso, data["cpi"])
        diet_series = data["diet"]["series"].get(f"{iso}|unaffordable_pct") or {}
        cost_series = data["diet"]["series"].get(f"{iso}|healthy_diet_cost") or {}
        unaffordable = None
        if diet_series:
            y = max(diet_series)
            unaffordable = {"year": y, "value": core.rnd(diet_series[y], 1)}
        diet_cost = None
        if cost_series:
            y = max(cost_series)
            diet_cost = {"year": y, "value": core.rnd(cost_series[y], 2)}

        context = {"price_gap": gap, "unaffordable_pct": unaffordable}
        chain = analysis.chain_for(iso, profile, world, chain_config, context)

        countries[iso] = {
            "iso3": iso,
            "name": name_of.get(iso, iso),
            "wheat": profile,
            "price_gap": gap,
            "unaffordable": unaffordable,
            "healthy_diet_cost": diet_cost,
            "reserve_cover": analysis.reserve_cover(iso, data["economy"]),
            "population": (data["economy"]["population"].get(iso) or {}).get("value"),
            "chain": chain,
            "chain_summary": _chain_summary(chain),
        }

    # Fill in the supplier names now that every country is known.
    for country in countries.values():
        for supplier in country["wheat"]["suppliers"]:
            supplier["name"] = name_of.get(supplier["iso3"], supplier["iso3"])

    led = analysis.ledger(scenario_config, world, countries)

    pairs = _pairs(countries)
    displacement = _displacement(countries)

    manifest_sources = _source_status(data, source_registry)

    return {
        "world": {
            "schema_version": SCHEMA_VERSION,
            "year": latest,
            "prices": prices,
            "exporters": exporters[:12],
            "situation": _situation(prices, exporters, countries, led, latest),
            "chain_states": chain_config["states"],
        },
        "countries": {
            "schema_version": SCHEMA_VERSION,
            "year": latest,
            "countries": countries,
        },
        "ledger": {"schema_version": SCHEMA_VERSION, **led},
        "pairs": {"schema_version": SCHEMA_VERSION, "pairs": pairs},
        "scenario": {
            "schema_version": SCHEMA_VERSION,
            **scenario_config["scenario"],
            "displacement": {
                **scenario_config["displacement"],
                "by_supplier": displacement,
            },
        },
        "sources": {"schema_version": SCHEMA_VERSION, "sources": manifest_sources},
    }


# ---------------------------------------------------------------- helpers


def _worst(exporters: list[dict], field: str, verb: str, year: int):
    """The sourced seller whose figure sits furthest below its usual range."""
    low = [
        e
        for e in exporters
        if (e[field] or {}).get("state") == "outside_usual_range"
        and e[field].get("direction") == "lower"
    ]
    note = "FAO supply and utilisation accounts, published once a year."
    if not low:
        checked = [e for e in exporters if (e[field] or {}).get("years_compared", 0) >= 5]
        if not checked:
            return None
        return {
            "state": "within_usual_range",
            "direction": "within",
            "words": (
                f"In {year}, every major seller we check {verb} within the range "
                f"of the previous years we hold."
            ),
            "note": note,
        }
    worst = min(low, key=lambda e: e[field].get("vs_median_pct") or 0)
    return {
        "state": "outside_usual_range",
        "direction": "lower",
        "words": (
            f"In {year}, {worst['name']} {verb} less than in any of the previous "
            f"{worst[field]['years_compared']} years we hold."
        ),
        "note": note,
        "iso3": worst["iso3"],
    }


def _chain_summary(chain: list[dict]) -> dict:
    """One line about how far along the chain anything has actually moved."""
    moved = [s for s in chain if s["state"] == "watching"]
    unwatched = [s for s in chain if s["state"] == "not_watched"]
    if moved:
        furthest = max(moved, key=lambda s: s["order"])
        words = (
            f"Something we watch has moved, as far along the chain as "
            f"{furthest['label'][0].lower()}{furthest['label'][1:]}."
        )
    else:
        words = "Nothing we watch along this chain is outside its usual range."
    return {
        "moved_count": len(moved),
        "unwatched_count": len(unwatched),
        "furthest_moved": moved and max(moved, key=lambda s: s["order"])["id"] or None,
        "words": words,
        "coverage_words": (
            f"{core.plain_count(len(unwatched), True)} of the seven links "
            f"{'has' if len(unwatched) == 1 else 'have'} nothing watching "
            f"{'it' if len(unwatched) == 1 else 'them'}."
        ),
    }


def _pairs(countries: dict) -> list[dict]:
    """Countries facing the same exposure with different things to fall back on.

    Pairs are chosen from the figures rather than picked in advance: two
    countries qualify when they lean on imported wheat to a similar degree and
    differ clearly in what they hold in store. That is the comparison that
    makes the point: the same disruption does not produce the same outcome.
    """
    # A pair is only worth showing where imports matter to the country in the
    # first place. Two countries that each grow almost all their own wheat have
    # the same exposure to an import shock — none — and comparing their stocks
    # teaches nobody anything.
    pool = [
        c
        for c in countries.values()
        if (c["wheat"]["import_dependence_pct"] or 0) >= 25
        and c["wheat"]["stock_cover_months"] is not None
        and (c["wheat"]["imports_t"] or 0) >= 1_500_000
    ]
    found = []
    used: set[str] = set()
    pool.sort(key=lambda c: -(c["wheat"]["imports_t"] or 0))
    for i, a in enumerate(pool):
        if a["iso3"] in used:
            continue
        for b in pool[i + 1 :]:
            if b["iso3"] in used:
                continue
            dep_gap = abs(
                a["wheat"]["import_dependence_pct"] - b["wheat"]["import_dependence_pct"]
            )
            cover_a = a["wheat"]["stock_cover_months"]
            cover_b = b["wheat"]["stock_cover_months"]
            if dep_gap > 8:
                continue
            if cover_a <= 0 or cover_b <= 0:
                continue
            ratio = max(cover_a, cover_b) / max(min(cover_a, cover_b), 0.05)
            if ratio < 2.0:
                continue
            thin, thick = (a, b) if cover_a < cover_b else (b, a)
            found.append(
                {
                    "a": thin["iso3"],
                    "b": thick["iso3"],
                    "shared": (
                        f"Both buy a similar share of their wheat from abroad: "
                        f"{thin['wheat']['import_dependence_pct']}% for "
                        f"{thin['name']}, {thick['wheat']['import_dependence_pct']}% "
                        f"for {thick['name']}."
                    ),
                    "differs": (
                        f"{thick['name']} went into the year holding about "
                        f"{thick['wheat']['stock_cover_months']} months of wheat use "
                        f"in store. {thin['name']} held about "
                        f"{thin['wheat']['stock_cover_months']} months."
                    ),
                    "so_what": (
                        f"The same interruption would give {thick['name']} more "
                        f"time to find other supply than {thin['name']} would have. "
                        f"Stocks are an estimate, not a count, and time is not the "
                        f"same thing as money to buy with."
                    ),
                    "dependence_gap": core.rnd(dep_gap, 1),
                    "cover_ratio": core.rnd(ratio, 1),
                }
            )
            used.add(a["iso3"])
            used.add(b["iso3"])
            break
        if len(found) >= 3:
            break
    return found


def _displacement(countries: dict) -> dict:
    """For each seller, who else buys from it — and how much room each has.

    This is what makes the advice honest. Telling one buyer to look elsewhere
    is telling it to bid against everybody else who buys from wherever it
    looks. These are the countries that would be bidding.
    """
    by_supplier: dict[str, list[dict]] = {}
    for iso, country in countries.items():
        wheat = country["wheat"]
        for supplier in wheat["suppliers"]:
            if supplier["share_pct"] < 1.0:
                continue
            by_supplier.setdefault(supplier["iso3"], []).append(
                {
                    "iso3": iso,
                    "name": country["name"],
                    "quantity_t": supplier["quantity_t"],
                    "share_of_their_wheat_pct": supplier["share_pct"],
                    "import_dependence_pct": wheat["import_dependence_pct"],
                    "stock_cover_months": wheat["stock_cover_months"],
                    "unaffordable_pct": (country["unaffordable"] or {}).get("value"),
                }
            )
    for buyers in by_supplier.values():
        buyers.sort(key=lambda b: -(b["quantity_t"] or 0))
    return by_supplier


def _situation(prices: dict, exporters: list[dict], countries: dict, led: dict, year: int) -> dict:
    """The short description of where things stand, built from the figures.

    Written to state what the figures say and nothing more. It does not call
    any country at risk, and it does not predict anything. Those statements
    need a person to stand behind them, and this release has not had one.
    """
    moving = [
        p
        for p in prices.values()
        if p["climb_reading"]["state"] in ("climbing", "climbing_fast")
    ]
    moving.sort(key=lambda p: -(p["climb_anomaly"] or 0))
    wheat = prices.get("wheat_price")

    lines = []
    if wheat:
        change = wheat["change_over_year_pct"]
        if change is None:
            tail = "."
        elif abs(change) < 1:
            tail = ", about the same as a year earlier."
        else:
            way = "higher" if change > 0 else "lower"
            tail = f", {abs(change):.0f}% {way} than a year earlier."
        lines.append(
            f"World wheat sold for ${wheat['latest_value']:,.0f} a tonne in "
            f"{analysis._month_words(wheat['latest_period'])}{tail}"
        )
    if moving:
        names = ", ".join(p["plain_name"] for p in moving[:3])
        lines.append(
            f"{core.plain_count(len(moving), True)} of the world prices we "
            f"follow {'is' if len(moving) == 1 else 'are'} rising faster than "
            f"{'it' if len(moving) == 1 else 'they'} normally do: {names}."
        )
    else:
        lines.append(
            "None of the world prices we follow is rising faster than it normally does."
        )

    thin = [
        c
        for c in countries.values()
        if (c["wheat"]["import_dependence_pct"] or 0) >= 50
        and (c["wheat"]["imports_t"] or 0) >= 2_000_000
    ]
    lines.append(
        f"{core.plain_count(len(thin), True)} countries buying more than two "
        f"million tonnes of wheat a year got at least half of it from abroad "
        f"in {year}, the latest year with full figures."
    )

    return {
        "as_of": wheat["latest_period"] if wheat else None,
        "lines": lines,
        "ledger_line": led["verdict"],
        "written_by": "machine",
        "reviewed": False,
        "review_note": (
            "These lines are assembled from the figures by the pipeline. "
            "Nobody has reviewed them. They describe what the numbers say and "
            "stop there: no country is called at risk, and nothing here is a "
            "forecast."
        ),
    }


def _source_status(data: dict, registry: dict) -> list[dict]:
    """What each source gave us, and how old it is.

    A successful download is not fresh data. Each entry carries the date the
    provider last changed the figures, which is the only date worth showing.
    """
    freshness = {
        "FAO-TM": data["trade"]["updated"],
        "FAO-SUA": data["balance"]["updated"],
        "FAO-CP": data["cpi"]["updated"],
        "FAO-CAHD": data["diet"]["updated"],
        "WB-PINK": data["pink"]["updated"].isoformat() if data["pink"]["updated"] else None,
        "WB-IND": None,
    }
    out = []
    for sid, source in registry.items():
        updated = freshness.get(sid)
        age = core.days_since(core.parse_date(updated)) if updated else None
        limit = source.get("stale_after_days")
        out.append(
            {
                "id": sid,
                "provider": source["provider"],
                "dataset": source["dataset"],
                "plain_name": source.get("plain_name"),
                "caveat": source.get("caveat"),
                "licence": source["licence"],
                "licence_url": source["licence_url"],
                "documentation_url": source["documentation_url"],
                "redistribution": source["redistribution"],
                "status": source["status"],
                "provider_updated": updated,
                "days_old": age,
                "older_than_expected": bool(
                    age is not None and limit is not None and age > limit
                ),
                "expected_frequency": source["expected_frequency"],
            }
        )
    return out

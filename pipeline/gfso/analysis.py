"""Turn the extracted figures into the things the website shows.

Every calculation in this file is deliberately simple enough to check by hand,
and the website publishes the inputs to each one so that a reader can. Where a
figure cannot be worked out honestly, the answer is None and the site says the
figure is not available, rather than filling the gap with something that looks
like an answer.

Three calculations carry most of the weight.

How much a country leans on imports
    imports divided by what it has available to use, where available is what it
    grew, plus what it bought, minus what it sold on. A country at 100 per cent
    grows no wheat of its own.

How concentrated its buying is
    the share of its wheat that comes from its largest single supplier, and the
    Herfindahl index, which is the sum of every supplier's squared share. An
    index near 1 means one seller; near 0 means many. Neither number says
    whether an alternative supplier actually has wheat to sell.

What it has to fall back on
    stock cover, which is opening stocks divided by one month's use, expressed
    in months, and reserve cover, which is foreign currency reserves divided by
    one month's import bill. Both are national figures, and neither tells you
    anything about a particular household.
"""
from __future__ import annotations

from typing import Any

from . import core

MIN_IMPORTS_FOR_PROFILE = 200_000.0  # tonnes a year: below this, wheat is a minor trade


# ---------------------------------------------------------------- per country


def country_wheat(
    iso: str,
    year: int,
    balance: dict,
    trade: dict,
    history_years: list[int],
) -> dict | None:
    """One country's wheat position for one year, with its history alongside."""
    record = balance.get(f"{year}|{iso}")
    if not record:
        return None

    production = record.get("production")
    imports = record.get("imports")
    exports = record.get("exports") or 0.0
    stocks = record.get("opening_stocks")
    if imports is None and production is None:
        return None

    available = (production or 0.0) + (imports or 0.0) - exports
    dependence = (
        100.0 * imports / available if imports is not None and available > 0 else None
    )
    monthly_use = available / 12.0 if available > 0 else None

    past_stocks = [
        (balance.get(f"{y}|{iso}") or {}).get("opening_stocks") for y in history_years
    ]
    stocks, stock_note = _usable_stocks(stocks, past_stocks, year, monthly_use)
    stock_cover = (
        stocks / monthly_use if stocks is not None and monthly_use else None
    )
    previous_cover = None
    if stock_note and monthly_use:
        earlier = [s for s in past_stocks if s is not None]
        if earlier:
            previous_cover = core.rnd(earlier[-1] / monthly_use, 1)

    suppliers, basis, coverage = supplier_mix(iso, year, trade, imports)

    past_imports = [
        (balance.get(f"{y}|{iso}") or {}).get("imports") for y in history_years
    ]

    return {
        "iso3": iso,
        "year": year,
        "production_t": core.rnd(production, 0) if production is not None else None,
        "imports_t": core.rnd(imports, 0) if imports is not None else None,
        "exports_t": core.rnd(exports, 0),
        "available_t": core.rnd(available, 0) if available > 0 else None,
        "opening_stocks_t": core.rnd(stocks, 0) if stocks is not None else None,
        "import_dependence_pct": core.rnd(dependence, 1),
        "stock_cover_months": core.rnd(stock_cover, 1),
        "stock_note": stock_note,
        "previous_stock_cover_months": previous_cover,
        "suppliers": suppliers,
        "supplier_basis": basis,
        "supplier_coverage_pct": core.rnd(coverage, 1) if coverage is not None else None,
        "top_supplier": suppliers[0]["iso3"] if suppliers else None,
        "top_supplier_share_pct": suppliers[0]["share_pct"] if suppliers else None,
        "supplier_hhi": core.rnd(
            sum((s["share_pct"] / 100.0) ** 2 for s in suppliers), 3
        )
        if suppliers
        else None,
        "suppliers_above_1pct": sum(1 for s in suppliers if s["share_pct"] >= 1.0)
        if suppliers
        else None,
        "imports_vs_usual": core.reference_band(imports, past_imports),
        "data_flags": record.get("flags", {}),
    }


def _usable_stocks(
    stocks: float | None,
    history: list[float | None],
    year: int,
    monthly_use: float | None,
) -> tuple[float | None, str | None]:
    """Reject a stock figure that is an artefact of balancing the accounts.

    FAO's supply and utilisation accounts close by treating the change in
    stocks as the residual that makes everything else add up. For some
    countries that leaves the most recent year's opening stocks at or near
    zero after several years of steady drawdown — Algeria's run from about
    three million tonnes to 58 tonnes in one step is the clearest example in
    this release. The country has not emptied its silos. The accounts have run
    out of room.

    Publishing "no wheat in store" for a country that holds wheat would be a
    serious error, and exactly the kind a monitoring site makes when it treats
    every published number as an observation. So where the newest figure is a
    rounding error beside a substantial recent history, this returns nothing
    and a line saying why, and the pages show the earlier estimate as context
    instead of a headline.
    """
    if stocks is None:
        return None, None

    # A big buyer recorded as holding a few days of grain is not a country
    # living hand to mouth; it is a country FAO has no real stock estimate for.
    # Japan, which runs a government wheat reserve, appears in this release with
    # about twelve thousand tonnes against five million tonnes of imports. That
    # is a placeholder, and reporting it as a buffer would invent a crisis.
    #
    # The size condition matters and is not decoration. For a country using a
    # few thousand tonnes a year, a week of use is a lorryload, and holding
    # none of it is unremarkable rather than suspicious. Suppressing that would
    # be the opposite error: hiding a real zero behind a doubt we do not have.
    LARGE_BUYER_ANNUAL_T = 1_000_000
    if (
        monthly_use
        and monthly_use * 12 >= LARGE_BUYER_ANNUAL_T
        and stocks / monthly_use < 0.25
    ):
        return None, (
            f"FAO's accounts record this country as holding under a week of "
            f"use in store at the start of {year}, against a supply in the "
            f"millions of tonnes. For a buyer this size that is almost certainly "
            f"a placeholder rather than an estimate, so we publish no stock "
            f"figure for it rather than one that would read as an emergency."
        )

    earlier = [s for s in history if s is not None]
    if not earlier:
        return stocks, None
    typical = sorted(earlier)[len(earlier) // 2]
    if typical <= 0:
        return stocks, None
    if stocks < 0.05 * typical:
        return None, (
            f"FAO's accounts put this country's opening stocks for {year} at "
            f"almost nothing, after several years in the millions or hundreds "
            f"of thousands of tonnes. In these accounts the change in stocks is "
            f"the figure that makes everything else balance, so a drop like that "
            f"is usually the accounting closing, not the silos emptying. We "
            f"publish no stock figure for this country this year rather than one "
            f"we do not believe."
        )
    return stocks, None


def supplier_mix(
    iso: str, year: int, trade: dict, imports_total: float | None
) -> tuple[list[dict], str, float | None]:
    """Who a country buys its wheat from, and how confident we can be about it.

    Prefers what the country reported itself. Falls back on what its suppliers
    reported selling to it, which is all that exists for many of the most
    import-dependent countries — and says which it used, plus how much of the
    country's known imports that second-hand view actually accounts for.
    """
    direct = trade["reported"].get(f"{year}|{iso}") or {}
    if direct:
        total = sum(direct.values())
        basis = "reported_by_this_country"
        coverage = (
            100.0 * total / imports_total
            if imports_total and imports_total > 0
            else None
        )
        source = direct
    else:
        source = trade["mirrored"].get(f"{year}|{iso}") or {}
        if not source:
            return [], "none_available", None
        total = sum(source.values())
        basis = "reconstructed_from_suppliers"
        coverage = (
            100.0 * total / imports_total
            if imports_total and imports_total > 0
            else None
        )

    if total <= 0:
        return [], "none_available", None

    flags = trade["flags"].get(f"{year}|{iso}", {})
    rows = [
        {
            "iso3": partner,
            "quantity_t": core.rnd(quantity, 0),
            "share_pct": core.rnd(100.0 * quantity / total, 1),
            "flag": flags.get(partner, ""),
        }
        for partner, quantity in source.items()
    ]
    rows.sort(key=lambda r: -r["quantity_t"])
    return rows, basis, coverage


def price_gap(iso: str, cpi: dict) -> dict | None:
    """How much faster food prices rose than prices in general, over a year.

    A positive gap means food is taking more of the same wage than it did
    twelve months ago. Both series come from the same source and the same
    month, so they can be compared; where the two do not share a recent month,
    the answer is no answer.
    """
    food = cpi["series"].get(f"{iso}|food_cpi") or {}
    general = cpi["series"].get(f"{iso}|general_cpi") or {}
    shared = sorted(set(food) & set(general))
    if len(shared) < 13:
        return None
    latest = shared[-1]
    year, month = latest.split("-")
    earlier = f"{int(year) - 1}-{month}"
    if earlier not in food or earlier not in general:
        return None
    food_change = core.pct_change(food[latest], food[earlier])
    general_change = core.pct_change(general[latest], general[earlier])
    if food_change is None or general_change is None:
        return None
    return {
        "period": latest,
        "food_change_pct": core.rnd(food_change, 1),
        "general_change_pct": core.rnd(general_change, 1),
        "gap_pct_points": core.rnd(food_change - general_change, 1),
    }


def reserve_cover(iso: str, economy: dict) -> dict | None:
    """How many months of its total import bill a country holds in reserves."""
    reserves = economy["reserves_usd"].get(iso)
    imports = economy["imports_usd"].get(iso)
    if not reserves or not imports or imports["value"] <= 0:
        return None
    months = reserves["value"] / (imports["value"] / 12.0)
    return {
        "months": core.rnd(months, 1),
        "reserves_year": reserves["year"],
        "imports_year": imports["year"],
    }


# ---------------------------------------------------------------- world prices


def price_signals(pink: dict) -> dict:
    """The monthly world prices, each with how unusual its recent climb is.

    The statistic measures the *rate of rise*, not the level. A price that has
    been high for two years is a known problem; a price climbing faster than it
    normally climbs is a new one, and only the second belongs on a page about
    what changed.
    """
    periods = pink["periods"]
    out = {}
    for sid, values in pink["series"].items():
        pairs = [(p, v) for p, v in zip(periods, values)]
        recent = [(p, v) for p, v in pairs if v is not None]
        if not recent:
            continue
        latest_period, latest_value = recent[-1]
        year_ago = None
        if len(recent) > 12:
            want = f"{int(latest_period[:4]) - 1}M{latest_period[5:]}"
            year_ago = next((v for p, v in recent if p == want), None)
        anomaly = core.growth_anomaly(recent)
        out[sid] = {
            "id": sid,
            "plain_name": pink["meta"][sid]["plain"],
            "why_it_is_here": pink["meta"][sid]["why"],
            "unit": pink["meta"][sid]["unit"],
            "latest_period": latest_period,
            "latest_value": core.rnd(latest_value, 1),
            "change_over_year_pct": core.rnd(core.pct_change(latest_value, year_ago), 1),
            "climb_anomaly": core.rnd(anomaly, 2),
            "climb_reading": _climb_words(anomaly),
            "history": [
                {"period": p, "value": core.rnd(v, 1)} for p, v in recent[-60:]
            ],
        }
    return out


def _climb_words(anomaly: float | None) -> dict:
    """Put the anomaly statistic into words, without overstating it."""
    if anomaly is None:
        return {
            "state": "not_enough_history",
            "words": "Not enough history to say whether this is unusual.",
        }
    if anomaly >= 2.0:
        return {
            "state": "climbing_fast",
            "words": "Rising much faster than it normally does. Worth looking at.",
        }
    if anomaly >= 1.0:
        return {
            "state": "climbing",
            "words": "Rising faster than it normally does.",
        }
    if anomaly <= -1.0:
        return {
            "state": "falling",
            "words": "Falling faster than it normally does.",
        }
    return {"state": "ordinary", "words": "Moving about as it usually does."}


# ---------------------------------------------------------------- the chain


def chain_for(
    iso: str, profile: dict, world: dict, chain_config: dict, context: dict
) -> list[dict]:
    """Work out how far along the chain the evidence has reached, for one country.

    The first four links are about world markets, so they read the same for
    everyone. The last three are about this country. Each stage reports what it
    looked at and what it found, including the stages where the honest answer
    is that nothing is looking.
    """
    states = chain_config["states"]
    out = []
    for stage in chain_config["stages"]:
        watches = stage.get("watch") or []
        if not watches:
            out.append(
                {
                    "id": stage["id"],
                    "order": stage["order"],
                    "label": stage["label"],
                    "what_it_means": stage["what_it_means"],
                    "state": "not_watched",
                    "state_label": states["not_watched"]["label"],
                    "state_means": states["not_watched"]["means"],
                    "because": stage.get("nothing_watching_because"),
                    "findings": [],
                    "clock_warning": stage.get("clock_warning"),
                }
            )
            continue

        findings = []
        unknown = 0
        for watch in watches:
            result = _evaluate(watch, iso, profile, world, context)
            if result is None:
                unknown += 1
                continue
            findings.append(result)

        fired = [f for f in findings if f["fired"]]
        if fired:
            state = "watching"
        elif findings:
            state = "quiet"
        else:
            state = "no_data"

        out.append(
            {
                "id": stage["id"],
                "order": stage["order"],
                "label": stage["label"],
                "what_it_means": stage["what_it_means"],
                "state": state,
                "state_label": states[state]["label"],
                "state_means": states[state]["means"],
                "findings": findings,
                "unreadable_checks": unknown,
                "clock_warning": stage.get("clock_warning"),
            }
        )
    return out


def _evaluate(watch: dict, iso: str, profile: dict, world: dict, context: dict):
    """Check one watch condition. Returns None when the figure is not available."""
    indicator = watch["indicator"]
    condition = watch["condition"]
    reading: float | None = None
    shown: str | None = None

    if indicator in world["prices"]:
        price = world["prices"][indicator]
        reading = price["climb_anomaly"]
        shown = f"{price['plain_name']}: {price['latest_value']} {price['unit']} in {_month_words(price['latest_period'])}"
    elif indicator == "exporter_production_change":
        worst = world.get("worst_exporter_production")
        if worst:
            return {
                "indicator": indicator,
                "why": watch["why"],
                "fired": worst["state"] == "outside_usual_range"
                and worst["direction"] == "lower",
                "reading": worst["words"],
                "source_note": worst["note"],
            }
        return None
    elif indicator == "exporter_stock_cover":
        worst = world.get("worst_exporter_stocks")
        if worst:
            return {
                "indicator": indicator,
                "why": watch["why"],
                "fired": worst["state"] == "outside_usual_range"
                and worst["direction"] == "lower",
                "reading": worst["words"],
                "source_note": worst["note"],
            }
        return None
    elif indicator == "wheat_imports":
        band = profile.get("imports_vs_usual") or {}
        if band.get("state") in (None, "not_enough_history"):
            return None
        fired = band["state"] == "outside_usual_range" and band.get("direction") == "lower"
        return {
            "indicator": indicator,
            "why": watch["why"],
            "fired": fired,
            "reading": _band_words(band, "wheat imports", profile.get("year")),
            "source_note": "FAO supply and utilisation accounts, published once a year.",
        }
    elif indicator == "food_price_gap":
        gap = context.get("price_gap")
        if not gap:
            return None
        reading = gap["gap_pct_points"]
        shown = (
            f"Food prices {gap['food_change_pct']}% higher than a year earlier, "
            f"against {gap['general_change_pct']}% for prices in general "
            f"({_month_words(gap['period'])})"
        )
    elif indicator == "unaffordable_pct":
        value = context.get("unaffordable_pct")
        if value is None:
            return None
        reading = value["value"]
        shown = (
            f"{value['value']}% of people could not afford a healthy diet in "
            f"{value['year']}"
        )
    elif indicator == "top_supplier_share":
        reading = profile.get("top_supplier_share_pct")
        if reading is None:
            return None
        shown = f"{profile['top_supplier']} supplies {reading}% of this country's wheat"
    else:
        return None

    if reading is None:
        return None

    if condition == "growth_anomaly_above":
        fired = reading >= watch["value"]
    elif condition == "above":
        fired = reading >= watch["value"]
    elif condition == "below":
        fired = reading <= watch["value"]
    else:
        return None

    return {
        "indicator": indicator,
        "why": watch["why"],
        "fired": bool(fired),
        "reading": shown,
        "threshold": watch.get("value"),
    }


def _band_words(band: dict, what: str, year: int | None) -> str:
    if band.get("state") == "outside_usual_range":
        way = "lower than" if band.get("direction") == "lower" else "higher than"
        return (
            f"{year}: {what} were {way} any of the previous "
            f"{band['years_compared']} years we hold."
        )
    return (
        f"{year}: {what} were within the range of the previous "
        f"{band['years_compared']} years."
    )


MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _month_words(period: str) -> str:
    """2026M10 or 2026-10 as 'October 2026'."""
    text = period.replace("M", "-")
    year, _, month = text.partition("-")
    index = int(month) - 1
    return f"{MONTHS[index]} {year}" if 0 <= index < 12 else period


# ---------------------------------------------------------------- the ledger


def ledger(scenario_config: dict, world: dict, countries: dict) -> dict:
    """Check every assumption the what-if test rests on against today's figures.

    This is the part of the site that watches itself. An assumption that the
    data contradicts is marked broken, with the date and the reading that broke
    it. The test is not quietly recalculated: it is flagged as needing a look,
    because a number that moved does not tell you what the right conclusion
    now is.
    """
    checked_at = core.iso(core.utc_now())
    entries = []
    for assumption in scenario_config["assumptions"]:
        watch = assumption["watch"]
        indicator = watch["indicator"]

        if watch.get("per_country"):
            broken_for = []
            for iso, country in countries.items():
                value = _country_reading(indicator, country)
                if value is None:
                    continue
                if _crosses(value, watch):
                    broken_for.append(
                        {"iso3": iso, "name": country["name"], "reading": value}
                    )
            broken_for.sort(key=lambda r: -r["reading"])
            entries.append(
                {
                    "id": assumption["id"],
                    "plain": assumption["plain"],
                    "why_it_matters": assumption["why_it_matters"],
                    "if_broken": assumption["if_broken"],
                    "scope": "per_country",
                    "watches": indicator,
                    "threshold": watch["value"],
                    "state": "broken_somewhere" if broken_for else "holding",
                    "broken_for": broken_for,
                    "checked_at": checked_at,
                }
            )
            continue

        price = world["prices"].get(indicator)
        if not price or price["climb_anomaly"] is None:
            entries.append(
                {
                    "id": assumption["id"],
                    "plain": assumption["plain"],
                    "why_it_matters": assumption["why_it_matters"],
                    "if_broken": assumption["if_broken"],
                    "scope": "world",
                    "watches": indicator,
                    "threshold": watch["value"],
                    "state": "cannot_check",
                    "reading": "No figure available to check this against.",
                    "checked_at": checked_at,
                }
            )
            continue

        crossed = price["climb_anomaly"] >= watch["value"]
        entries.append(
            {
                "id": assumption["id"],
                "plain": assumption["plain"],
                "why_it_matters": assumption["why_it_matters"],
                "if_broken": assumption["if_broken"],
                "scope": "world",
                "watches": indicator,
                "watches_name": price["plain_name"],
                "threshold": watch["value"],
                "value": price["climb_anomaly"],
                "state": "broken" if crossed else "holding",
                "reading": (
                    f"{price['plain_name']} was {price['latest_value']} "
                    f"{price['unit']} in {_month_words(price['latest_period'])}, "
                    f"{price['climb_reading']['words'].lower()}"
                ),
                "as_of": price["latest_period"],
                "checked_at": checked_at,
            }
        )

    broken = [e for e in entries if e["state"] in ("broken", "broken_somewhere")]
    return {
        "checked_at": checked_at,
        "assumptions": entries,
        "broken_count": len(broken),
        "holding_count": sum(1 for e in entries if e["state"] == "holding"),
        "verdict": _ledger_words(entries),
    }


def _country_reading(indicator: str, country: dict) -> float | None:
    if indicator == "top_supplier_share":
        return (country.get("wheat") or {}).get("top_supplier_share_pct")
    if indicator == "food_price_gap":
        gap = country.get("price_gap")
        return gap["gap_pct_points"] if gap else None
    if indicator == "unaffordable_pct":
        value = country.get("unaffordable")
        return value["value"] if value else None
    return None


def _crosses(value: float, watch: dict) -> bool:
    if watch["condition"] in ("above", "growth_anomaly_above"):
        return value >= watch["value"]
    if watch["condition"] == "below":
        return value <= watch["value"]
    return False


def _ledger_words(entries: list[dict]) -> str:
    world_broken = [e for e in entries if e["state"] == "broken"]
    country_broken = [e for e in entries if e["state"] == "broken_somewhere"]
    if not world_broken and not country_broken:
        return (
            "Every assumption behind the what-if test still matches the "
            "published figures. That does not make the test right. It means "
            "nothing we watch has contradicted it."
        )
    parts = []
    if world_broken:
        parts.append(
            f"{core.plain_count(len(world_broken), True)} of the assumptions "
            f"behind the what-if test {'is' if len(world_broken) == 1 else 'are'} "
            "contradicted by the latest figures."
        )
    if country_broken:
        parts.append(
            "Some assumptions do not hold for particular countries. The test "
            "says which, on each country's page."
        )
    parts.append("Read the test's results with that in mind.")
    return " ".join(parts)

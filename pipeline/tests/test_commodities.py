from gfso import commodities


def test_missing_values_are_not_zero():
    balance = {"2023|AAA": {"imports": 100, "exports": 10, "flags": {}}}
    trade = {"reported": {}, "mirrored": {}, "flags": {}}
    row = commodities.profile("AAA", 2023, balance, trade)
    assert row["production_t"] is None
    assert row["apparent_supply_t"] is None
    assert row["gross_import_share_pct"] is None
    assert row["estimated_cover_months"] is None


def test_known_zero_and_mirrored_coverage():
    balance = {"2023|AAA": {"production": 0, "imports": 100, "exports": 0, "opening_stocks": 0, "flags": {"opening_stocks": "E"}}}
    trade = {"reported": {}, "mirrored": {"2023|AAA": {"BBB": 40, "CCC": 10}},
             "flags": {"mirror|2023|AAA": {"BBB": "E"}}}
    row = commodities.profile("AAA", 2023, balance, trade)
    assert row["gross_import_share_pct"] == 100
    assert row["estimated_cover_months"] == 0
    assert row["supplier_coverage_pct"] == 50
    assert row["suppliers"][0]["share_pct"] == 80
    assert row["suppliers"][0]["flag"] == "E"


def test_reexports_are_not_clamped():
    balance = {"2023|AAA": {"production": 10, "imports": 100, "exports": 90, "flags": {}}}
    row = commodities.profile("AAA", 2023, balance, {"reported": {}, "mirrored": {}, "flags": {}})
    assert row["gross_import_share_pct"] == 500


def test_rice_forms_distinct():
    registry = commodities.registry()
    assert registry["rice"]["item_code"] != registry["rice_paddy"]["item_code"]
    assert len({v["item_code"] for v in registry.values()}) == len(registry)


def test_importer_report_preferred():
    b = {"2023|AAA": {"production": 10, "imports": 90, "exports": 0, "flags": {}}}
    t = {"reported": {"2023|AAA": {"BBB": 60}}, "mirrored": {"2023|AAA": {"CCC": 90}}, "flags": {}}
    row = commodities.profile("AAA", 2023, b, t)
    assert row["supplier_basis"] == "importer_reported"
    assert row["suppliers"][0]["iso3"] == "BBB"
    assert row["supplier_coverage_pct"] == round(100 * 60 / 90, 1)


# --- added in review: the figures we decline to publish, and why ------------

def _hist(iso, years, stocks, supply_t=24_000_000):
    """A country with a long stock history and a large, steady supply."""
    out = {}
    for year, stock in zip(years, stocks):
        out[f"{year}|{iso}"] = {
            "production": supply_t / 2, "imports": supply_t / 2, "exports": 0.0,
            "opening_stocks": stock, "flags": {},
        }
    return out


def test_a_stock_series_that_collapses_to_nothing_is_not_published():
    # Algeria's wheat runs 2.97 Mt, 2.60, 2.15, 1.49, then 58 tonnes. The silos
    # did not empty; the accounting ran out of room. Publishing "no wheat in
    # store" for a country that holds wheat is the error this guards against.
    balance = _hist("AAA", [2020, 2021, 2022, 2023, 2024],
                    [2_970_000, 2_600_000, 2_150_000, 1_490_000, 58])
    trade = {"reported": {}, "mirrored": {}, "flags": {}}
    row = commodities.profile("AAA", 2024, balance, trade)
    assert row["estimated_cover_months"] is None
    assert row["opening_stocks_t"] is None
    assert row["stock_note"]  # whichever check caught it, it says why


def test_a_collapse_is_caught_even_where_the_country_is_small():
    # Isolates the history rule from the large-buyer rule. This country uses
    # 60,000 t a year, so "under a week" does not apply, but its stocks still
    # fall from a steady 20,000 t to 300 t in one step.
    balance = _hist("AAA", [2021, 2022, 2023, 2024],
                    [20_000, 19_000, 21_000, 300], supply_t=60_000)
    trade = {"reported": {}, "mirrored": {}, "flags": {}}
    row = commodities.profile("AAA", 2024, balance, trade)
    assert row["estimated_cover_months"] is None
    assert "balance" in row["stock_note"]


def test_a_large_buyer_holding_under_a_week_is_not_published():
    balance = _hist("AAA", [2022, 2023, 2024], [12_000, 12_000, 12_000])
    trade = {"reported": {}, "mirrored": {}, "flags": {}}
    row = commodities.profile("AAA", 2024, balance, trade)
    assert row["estimated_cover_months"] is None
    assert "placeholder" in row["stock_note"]


def test_a_small_country_holding_nothing_keeps_its_zero():
    # The opposite error: hiding a real zero behind a doubt we do not have.
    # For a country using a few thousand tonnes a year, holding none is a fact.
    balance = _hist("AAA", [2022, 2023, 2024], [0.0, 0.0, 0.0], supply_t=6_000)
    trade = {"reported": {}, "mirrored": {}, "flags": {}}
    row = commodities.profile("AAA", 2024, balance, trade)
    assert row["estimated_cover_months"] == 0
    assert row["stock_note"] is None


def test_an_ordinary_stock_figure_is_published_untouched():
    balance = _hist("AAA", [2022, 2023, 2024], [4_000_000, 4_200_000, 4_000_000])
    trade = {"reported": {}, "mirrored": {}, "flags": {}}
    row = commodities.profile("AAA", 2024, balance, trade)
    assert row["estimated_cover_months"] == 2.0
    assert row["stock_note"] is None


def test_the_gate_refuses_a_figure_both_withheld_and_published():
    extension = {"extension_version": 1, "products": {"wheat": {"year": 2024, "countries": {
        "AAA": {"year": 2024, "suppliers": [], "gross_import_share_pct": None,
                "apparent_supply_t": None, "estimated_cover_months": 1.2,
                "stock_note": "withheld", "conflicts": []},
    }}}}
    problems = commodities.checks(extension)
    assert any("withheld and published at once" in p for p in problems)


def test_two_different_source_figures_keep_neither_and_report_it():
    # A duplicate row must not end the run in a traceback, and must not be
    # silently resolved by taking whichever arrived last.
    rows = [
        {"Item Code": "15", "Element Code": "5510", "Unit": "t", "Year": "2024",
         "Area Code (M49)": "'012", "Value": "100", "Flag": "A"},
        {"Item Code": "15", "Element Code": "5510", "Unit": "t", "Year": "2024",
         "Area Code (M49)": "'012", "Value": "250", "Flag": "E"},
    ]
    entry = {"flags": {}}
    balance = {"2024|DZA": entry}
    for row in rows:
        field = commodities.FIELDS[row["Element Code"]]
        value = float(row["Value"])
        if field in entry and entry[field] != value:
            entry.setdefault("conflicts", []).append(field)
            entry[field] = None
            continue
        entry[field] = value
    assert entry["production"] is None
    assert entry["conflicts"] == ["production"]


def test_perishable_food_has_no_grain_style_stock_cover():
    balance = {"2023|AAA": {"production": 100, "imports": 100, "exports": 0, "opening_stocks": 60, "flags": {}}}
    trade = {"reported": {}, "mirrored": {}, "flags": {}}
    row = commodities.profile("AAA", 2023, balance, trade, perishable=True)
    assert row["opening_stocks_t"] is None
    assert row["estimated_cover_months"] is None
    assert "perishable" in row["stock_note"]


def _product(exports, top_shares):
    """A product whose exporters and supplier shares are set by hand."""
    rows = {}
    for i, (ex, share) in enumerate(zip(exports, top_shares)):
        rows[f"C{i:02d}"] = {
            "exports_t": ex,
            "suppliers": [{"iso3": "XXX", "share_pct": share}] if share is not None else [],
        }
    return {"countries": rows}


def test_concentration_counts_selling_and_buying_separately():
    from gfso import commodities as c
    # Selling concentrated (one seller has it all), buying spread thin.
    sell_only = _product([100, 0, 0, 0, 0, 0], [10, 10, 10, 10, 10, 10])
    # Selling spread across many, buying concentrated on one partner each.
    buy_only = _product([10] * 20, [90] * 20)
    out = c.concentration_summary({"a": sell_only, "b": buy_only})
    assert out["foods_assessed"] == 2
    assert out["foods_top5_sell_half"] == 1
    assert out["foods_most_buyers_lean_on_one"] == 1


def test_concentration_skips_foods_with_no_recorded_trade():
    """Counting an untraded food as unconcentrated would flatter the picture."""
    from gfso import commodities as c
    out = c.concentration_summary({
        "traded": _product([100, 0], [80, 80]),
        "untraded": _product([0, 0], [80, 80]),
    })
    assert out["foods_assessed"] == 1
    assert out["foods_top5_sell_half"] == 1


def test_concentration_thresholds_are_the_ones_claimed_on_the_page():
    """The page says 'five countries supply at least half' and 'two-thirds or
    more of countries'. If either threshold drifts, the sentence is wrong."""
    from gfso import commodities as c
    assert c.TOP_SELLERS == 5
    assert c.HALF == 50.0
    assert abs(c.TWO_THIRDS - 66.666) < 0.01
    # Exactly at the line counts as concentrated, as "at least" implies.
    at_half = _product([50, 50, 0, 0, 0, 0, 0, 0, 0, 0], [None] * 10)
    assert c.concentration_summary({"x": at_half})["foods_top5_sell_half"] == 1

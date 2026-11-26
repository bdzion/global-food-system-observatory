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
    assert row["supplier_coverage_pct"] == 100 * 60 / 90

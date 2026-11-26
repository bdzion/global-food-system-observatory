"""Checks on the figures the website puts in front of a reader.

Every case here is small enough to verify by hand, which is the point: if the
site says a country depends on imports for 60 per cent of its wheat, somebody
should be able to confirm that from the three numbers it was built from.
"""
from __future__ import annotations

import pytest

from gfso import analysis

YEARS = [2019, 2020, 2021, 2022, 2023]


def balance(**kw):
    """One country-year of supply and utilisation, as the extractor shapes it."""
    record = {"flags": {}}
    record.update(kw)
    return {"2024|TST": record}


def trade(reported=None, mirrored=None):
    return {
        "reported": {"2024|TST": reported} if reported else {},
        "mirrored": {"2024|TST": mirrored} if mirrored else {},
        "flags": {},
        "years": [2024],
    }


class TestImportDependence:
    def test_worked_by_hand(self):
        # Grew 40, bought 70, sold 10. Available = 40 + 70 - 10 = 100.
        # Dependence = 70 / 100 = 70 per cent.
        profile = analysis.country_wheat(
            "TST", 2024,
            balance(production=40.0, imports=70.0, exports=10.0),
            trade(), YEARS,
        )
        assert profile["available_t"] == 100
        assert profile["import_dependence_pct"] == pytest.approx(70.0)

    def test_a_country_that_grows_no_wheat_is_fully_dependent(self):
        profile = analysis.country_wheat(
            "TST", 2024, balance(production=0.0, imports=50.0, exports=0.0),
            trade(), YEARS,
        )
        assert profile["import_dependence_pct"] == pytest.approx(100.0)

    def test_no_import_figure_means_no_dependence_figure(self):
        profile = analysis.country_wheat(
            "TST", 2024, balance(production=100.0), trade(), YEARS
        )
        assert profile["import_dependence_pct"] is None

    def test_re_export_cannot_produce_a_negative_denominator(self):
        # A pure transit country can export more than it grew plus bought.
        # That gives a meaningless denominator, so the answer is no answer.
        profile = analysis.country_wheat(
            "TST", 2024,
            balance(production=1.0, imports=10.0, exports=60.0),
            trade(), YEARS,
        )
        assert profile["import_dependence_pct"] is None


class TestStockCover:
    def test_months_are_stocks_over_one_month_of_use(self):
        # Available 120, so one month of use is 10. Stocks of 25 is 2.5 months.
        profile = analysis.country_wheat(
            "TST", 2024,
            balance(production=50.0, imports=80.0, exports=10.0, opening_stocks=25.0),
            trade(), YEARS,
        )
        assert profile["available_t"] == 120
        assert profile["stock_cover_months"] == pytest.approx(2.5)

    def test_no_stock_figure_means_no_cover_figure(self):
        profile = analysis.country_wheat(
            "TST", 2024, balance(production=50.0, imports=80.0, exports=10.0),
            trade(), YEARS,
        )
        assert profile["stock_cover_months"] is None


class TestSupplierMix:
    def test_shares_and_concentration_worked_by_hand(self):
        profile = analysis.country_wheat(
            "TST", 2024, balance(production=0.0, imports=100.0, exports=0.0),
            trade(reported={"AAA": 60.0, "BBB": 30.0, "CCC": 10.0}), YEARS,
        )
        assert profile["top_supplier"] == "AAA"
        assert profile["top_supplier_share_pct"] == pytest.approx(60.0)
        # 0.6^2 + 0.3^2 + 0.1^2 = 0.36 + 0.09 + 0.01 = 0.46
        assert profile["supplier_hhi"] == pytest.approx(0.46)
        assert profile["suppliers_above_1pct"] == 3

    def test_one_supplier_gives_an_index_of_one(self):
        profile = analysis.country_wheat(
            "TST", 2024, balance(production=0.0, imports=100.0, exports=0.0),
            trade(reported={"AAA": 100.0}), YEARS,
        )
        assert profile["supplier_hhi"] == pytest.approx(1.0)

    def test_the_country_s_own_report_is_preferred(self):
        profile = analysis.country_wheat(
            "TST", 2024, balance(production=0.0, imports=100.0, exports=0.0),
            trade(reported={"AAA": 100.0}, mirrored={"ZZZ": 90.0}), YEARS,
        )
        assert profile["supplier_basis"] == "reported_by_this_country"
        assert profile["top_supplier"] == "AAA"

    def test_suppliers_reports_are_used_only_when_there_is_nothing_else(self):
        profile = analysis.country_wheat(
            "TST", 2024, balance(production=0.0, imports=100.0, exports=0.0),
            trade(mirrored={"ZZZ": 40.0, "YYY": 20.0}), YEARS,
        )
        assert profile["supplier_basis"] == "reconstructed_from_suppliers"
        # 60 of a known 100 tonnes of imports is accounted for. The site must be
        # able to say that it is seeing three fifths of the picture.
        assert profile["supplier_coverage_pct"] == pytest.approx(60.0)

    def test_no_trade_detail_at_all_is_stated_plainly(self):
        profile = analysis.country_wheat(
            "TST", 2024, balance(production=0.0, imports=100.0, exports=0.0),
            trade(), YEARS,
        )
        assert profile["supplier_basis"] == "none_available"
        assert profile["suppliers"] == []
        assert profile["top_supplier"] is None


class TestFoodPriceGap:
    @staticmethod
    def _cpi(food, general):
        return {"series": {"TST|food_cpi": food, "TST|general_cpi": general}}

    def test_the_gap_is_food_inflation_minus_general_inflation(self):
        food = {f"2025-{m:02d}": 100.0 for m in range(1, 13)}
        general = {f"2025-{m:02d}": 100.0 for m in range(1, 13)}
        food["2026-01"], general["2026-01"] = 112.0, 104.0
        food["2025-01"], general["2025-01"] = 100.0, 100.0
        gap = analysis.price_gap("TST", self._cpi(food, general))
        assert gap["food_change_pct"] == pytest.approx(12.0)
        assert gap["general_change_pct"] == pytest.approx(4.0)
        assert gap["gap_pct_points"] == pytest.approx(8.0)

    def test_without_the_same_month_a_year_earlier_there_is_no_gap(self):
        food = {f"2026-{m:02d}": 100.0 for m in range(1, 13)}
        general = {f"2026-{m:02d}": 100.0 for m in range(1, 13)}
        assert analysis.price_gap("TST", self._cpi(food, general)) is None

    def test_two_series_that_do_not_overlap_give_no_gap(self):
        food = {f"2025-{m:02d}": 100.0 for m in range(1, 13)}
        general = {f"2020-{m:02d}": 100.0 for m in range(1, 13)}
        assert analysis.price_gap("TST", self._cpi(food, general)) is None


class TestMonthWords:
    def test_both_period_spellings_read_the_same(self):
        assert analysis._month_words("2026M10") == "October 2026"
        assert analysis._month_words("2026-01") == "January 2026"


class TestClimbWords:
    def test_no_number_says_so_rather_than_guessing(self):
        assert analysis._climb_words(None)["state"] == "not_enough_history"

    def test_the_bands_are_the_ones_the_site_describes(self):
        assert analysis._climb_words(0.4)["state"] == "ordinary"
        assert analysis._climb_words(1.2)["state"] == "climbing"
        assert analysis._climb_words(2.5)["state"] == "climbing_fast"
        assert analysis._climb_words(-1.5)["state"] == "falling"

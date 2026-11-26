"""Checks on the two things that make this site different from a dashboard.

The chain has to report an unwatched link as unwatched rather than as calm,
because the difference between "we are not looking" and "nothing is happening"
is the whole point of publishing it.

The ledger has to notice when a published figure contradicts an assumption the
what-if test rests on, and say so rather than quietly carrying on.
"""
from __future__ import annotations

from gfso import analysis, core


def chain_config():
    return core.load_config("chain.yml")


def scenario_config():
    return core.load_config("scenario.yml")


def price(pid: str, anomaly: float | None, name: str = "A price"):
    return {
        "id": pid,
        "plain_name": name,
        "unit": "US$ per tonne",
        "latest_period": "2026M10",
        "latest_value": 300.0,
        "change_over_year_pct": 5.0,
        "climb_anomaly": anomaly,
        "climb_reading": analysis._climb_words(anomaly),
        "history": [],
    }


def world(**anomalies):
    return {
        "prices": {pid: price(pid, value) for pid, value in anomalies.items()},
        "worst_exporter_production": None,
        "worst_exporter_stocks": None,
    }


def profile(**kw):
    base = {
        "year": 2024,
        "top_supplier": "AAA",
        "top_supplier_share_pct": 30.0,
        "imports_vs_usual": {"state": "within_usual_range", "years_compared": 5},
    }
    base.update(kw)
    return base


class TestChain:
    def test_every_stage_is_reported(self):
        chain = analysis.chain_for("TST", profile(), world(), chain_config(), {})
        assert len(chain) == 7
        assert [s["order"] for s in chain] == [1, 2, 3, 4, 5, 6, 7]

    def test_an_unwatched_link_says_so_and_says_why(self):
        chain = analysis.chain_for("TST", profile(), world(), chain_config(), {})
        growing = next(s for s in chain if s["id"] == "growing")
        assert growing["state"] == "not_watched"
        assert growing["state_label"] == "Nothing is watching this"
        assert growing["because"]

    def test_an_unwatched_link_is_never_reported_as_calm(self):
        chain = analysis.chain_for("TST", profile(), world(), chain_config(), {})
        for stage in chain:
            if stage["state"] == "not_watched":
                assert stage["state_label"] != "Nothing unusual"
                assert stage["findings"] == []

    def test_a_price_climbing_fast_moves_the_input_stage(self):
        chain = analysis.chain_for(
            "TST", profile(),
            world(urea_price=2.5, dap_price=0.1, gas_price=0.2),
            chain_config(), {},
        )
        inputs = next(s for s in chain if s["id"] == "inputs")
        assert inputs["state"] == "watching"
        assert any(f["fired"] for f in inputs["findings"])

    def test_ordinary_prices_leave_the_input_stage_quiet(self):
        chain = analysis.chain_for(
            "TST", profile(),
            world(urea_price=0.2, dap_price=0.1, gas_price=0.0),
            chain_config(), {},
        )
        inputs = next(s for s in chain if s["id"] == "inputs")
        assert inputs["state"] == "quiet"

    def test_a_stage_with_no_readable_figure_is_not_called_quiet(self):
        # No consumer price figures for this country, so the market stage
        # cannot say anything. "No data" and "nothing unusual" are different.
        chain = analysis.chain_for("TST", profile(), world(), chain_config(), {})
        market = next(s for s in chain if s["id"] == "market")
        assert market["state"] == "no_data"

    def test_a_wide_food_price_gap_moves_the_market_stage(self):
        chain = analysis.chain_for(
            "TST", profile(), world(), chain_config(),
            {"price_gap": {
                "period": "2026-08", "food_change_pct": 14.0,
                "general_change_pct": 4.0, "gap_pct_points": 10.0,
            }},
        )
        market = next(s for s in chain if s["id"] == "market")
        assert market["state"] == "watching"

    def test_the_chain_reports_how_far_anything_reached(self):
        from gfso import build

        chain = analysis.chain_for(
            "TST", profile(), world(urea_price=2.5), chain_config(), {},
        )
        summary = build._chain_summary(chain)
        assert summary["moved_count"] >= 1
        assert summary["unwatched_count"] == 2
        assert "two of the seven" in summary["coverage_words"].lower()


class TestLedger:
    def test_a_quiet_market_leaves_the_world_assumptions_holding(self):
        result = analysis.ledger(
            scenario_config(), world(wheat_price=0.1, urea_price=0.2), {}
        )
        world_entries = [a for a in result["assumptions"] if a["scope"] == "world"]
        assert all(a["state"] == "holding" for a in world_entries)

    def test_a_fast_climb_breaks_the_assumption_that_depends_on_it(self):
        result = analysis.ledger(
            scenario_config(), world(wheat_price=2.4, urea_price=0.2), {}
        )
        broken = [a for a in result["assumptions"] if a["state"] == "broken"]
        assert len(broken) == 1
        assert broken[0]["id"] == "prices-not-already-climbing"
        assert broken[0]["as_of"] == "2026M10"
        assert broken[0]["checked_at"]

    def test_a_broken_assumption_flags_the_test_rather_than_rewriting_it(self):
        result = analysis.ledger(
            scenario_config(), world(wheat_price=2.4, urea_price=0.2), {}
        )
        assert result["broken_count"] == 1
        assert "contradicted" in result["verdict"]

    def test_an_unavailable_figure_is_not_treated_as_an_assumption_holding(self):
        result = analysis.ledger(
            scenario_config(), world(wheat_price=None, urea_price=0.2), {}
        )
        entry = next(
            a for a in result["assumptions"] if a["id"] == "prices-not-already-climbing"
        )
        assert entry["state"] == "cannot_check"

    def test_a_country_assumption_names_the_countries_it_fails_for(self):
        countries = {
            "AAA": {
                "name": "Aaaland",
                "wheat": {"top_supplier_share_pct": 80.0},
                "price_gap": None,
                "unaffordable": None,
            },
            "BBB": {
                "name": "Bbbland",
                "wheat": {"top_supplier_share_pct": 20.0},
                "price_gap": None,
                "unaffordable": None,
            },
        }
        result = analysis.ledger(
            scenario_config(), world(wheat_price=0.1, urea_price=0.2), countries
        )
        entry = next(
            a for a in result["assumptions"] if a["id"] == "another-supplier-available"
        )
        assert entry["state"] == "broken_somewhere"
        assert [b["iso3"] for b in entry["broken_for"]] == ["AAA"]

    def test_every_assumption_explains_what_breaking_it_would_mean(self):
        result = analysis.ledger(scenario_config(), world(wheat_price=0.1, urea_price=0.1), {})
        for entry in result["assumptions"]:
            assert entry["plain"]
            assert entry["why_it_matters"]
            assert entry["if_broken"]


class TestReleaseGate:
    def test_a_release_missing_its_chain_is_refused(self):
        from gfso import run, SCHEMA_VERSION

        release = _minimal_release()
        release["countries"]["countries"]["TST"]["chain"] = []
        problems = run.checks(release)
        assert any("chain stages" in p for p in problems)

    def test_a_release_claiming_review_it_did_not_have_is_refused(self):
        from gfso import run

        release = _minimal_release()
        release["world"]["situation"]["reviewed"] = True
        problems = run.checks(release)
        assert any("unreviewed" in p for p in problems)

    def test_a_source_without_a_cleared_licence_is_refused(self):
        from gfso import run

        release = _minimal_release()
        release["sources"]["sources"][0]["redistribution"] = "unknown"
        problems = run.checks(release)
        assert any("redistribution" in p for p in problems)


def _minimal_release() -> dict:
    """A release shaped like a real one, with just enough in it to check gates."""
    from gfso import SCHEMA_VERSION

    chain = [
        {"id": f"s{i}", "state": "quiet", "because": None, "findings": []}
        for i in range(7)
    ]
    countries = {
        f"C{i:02d}": {
            "iso3": f"C{i:02d}",
            "name": f"Country {i}",
            "wheat": {
                "imports_t": 1000.0,
                "suppliers": [],
                "supplier_basis": "none_available",
            },
            "chain": list(chain),
        }
        for i in range(25)
    }
    countries["TST"] = {
        "iso3": "TST",
        "name": "Testland",
        "wheat": {"imports_t": 1000.0, "suppliers": [], "supplier_basis": "none_available"},
        "chain": list(chain),
    }
    return {
        "world": {
            "schema_version": SCHEMA_VERSION,
            "prices": {"wheat_price": {"latest_value": 1.0, "latest_period": "2026M10"}},
            "situation": {"reviewed": False, "review_note": "note"},
        },
        "countries": {"schema_version": SCHEMA_VERSION, "countries": countries},
        "ledger": {"schema_version": SCHEMA_VERSION, "assumptions": [{"id": "a"}]},
        "pairs": {"schema_version": SCHEMA_VERSION, "pairs": []},
        "scenario": {"schema_version": SCHEMA_VERSION},
        "sources": {
            "schema_version": SCHEMA_VERSION,
            "sources": [{"id": "X", "redistribution": "attribution_only"}],
        },
    }

"""Checks on the arithmetic everything else rests on.

These are the calculations a reader is most likely to challenge, so each one is
tested against a case worked out by hand rather than against whatever the code
happened to produce.
"""
from __future__ import annotations

import math

import pytest

from gfso import core


class TestPercentChange:
    def test_ordinary_case(self):
        assert core.pct_change(110, 100) == pytest.approx(10.0)
        assert core.pct_change(90, 100) == pytest.approx(-10.0)

    def test_a_zero_base_is_not_an_infinite_rise(self):
        # "It rose from nothing" is not a percentage. Printing one, or an
        # infinity, would be worse than saying nothing.
        assert core.pct_change(50, 0) is None

    def test_a_missing_value_stays_missing(self):
        assert core.pct_change(None, 100) is None
        assert core.pct_change(100, None) is None


class TestReferenceBand:
    history = [100.0, 110.0, 95.0, 105.0, 102.0]

    def test_inside_the_range(self):
        band = core.reference_band(103.0, self.history)
        assert band["state"] == "within_usual_range"
        assert band["years_compared"] == 5

    def test_above_every_earlier_year(self):
        band = core.reference_band(120.0, self.history)
        assert band["state"] == "outside_usual_range"
        assert band["direction"] == "higher"

    def test_below_every_earlier_year(self):
        band = core.reference_band(80.0, self.history)
        assert band["state"] == "outside_usual_range"
        assert band["direction"] == "lower"

    def test_too_little_history_says_so(self):
        band = core.reference_band(103.0, [100.0, 110.0])
        assert band["state"] == "not_enough_history"
        assert "direction" not in band

    def test_a_missing_value_cannot_be_compared(self):
        assert core.reference_band(None, self.history)["state"] == "not_enough_history"

    def test_nones_in_the_history_are_not_counted_as_years(self):
        band = core.reference_band(103.0, [100.0, None, 110.0, None, 95.0])
        assert band["years_compared"] == 3


class TestGrowthAnomaly:
    @staticmethod
    def _steady(n: int, start: float = 100.0, step: float = 1.0):
        return [(f"{2000 + i // 12}M{i % 12 + 1:02d}", start + step * i) for i in range(n)]

    def test_too_short_a_series_gets_no_number(self):
        assert core.growth_anomaly(self._steady(30)) is None

    def test_a_perfectly_flat_series_gets_no_number(self):
        # No variation means no yardstick. A statistic here would be made up.
        flat = [(f"{2000 + i // 12}M{i % 12 + 1:02d}", 100.0) for i in range(200)]
        assert core.growth_anomaly(flat) is None

    def test_a_sudden_jump_reads_as_unusual(self):
        series = self._steady(200)
        period, value = series[-1]
        series[-1] = (period, value * 2.5)
        result = core.growth_anomaly(series)
        assert result is not None and result > 2.0

    def test_steady_growth_does_not_read_as_unusual(self):
        result = core.growth_anomaly(self._steady(200))
        assert result is None or abs(result) < 1.0

    def test_only_the_window_is_used(self):
        # A spike long ago must not widen today's yardstick for ever.
        series = self._steady(400)
        period, value = series[20]
        series[20] = (period, value * 10)
        windowed = core.growth_anomaly(series, window_months=120)
        assert windowed is None or abs(windowed) < 3.0


class TestRobustZ:
    def test_needs_enough_history(self):
        assert core.robust_z(10.0, [1.0] * 10) is None

    def test_a_flat_history_gives_no_score(self):
        assert core.robust_z(10.0, [5.0] * 40) is None

    def test_an_outlier_scores_high(self):
        history = [float(x % 5) for x in range(60)]
        score = core.robust_z(50.0, history)
        assert score is not None and score > 5


class TestPlainCount:
    def test_small_numbers_are_words(self):
        assert core.plain_count(3) == "three"
        assert core.plain_count(0) == "no"

    def test_large_numbers_are_figures(self):
        assert core.plain_count(22) == "22"
        assert core.plain_count(1500) == "1,500"

    def test_capitalising_for_the_start_of_a_sentence(self):
        assert core.plain_count(3, True) == "Three"


class TestSanitize:
    def test_a_key_never_reaches_a_log(self):
        message = core.sanitize("failed: https://x.test/a?api_key=SECRETVALUE&b=1")
        assert "SECRETVALUE" not in message
        assert "api_key=***" in message


class TestWriteJson:
    def test_a_file_appears_whole_or_not_at_all(self, tmp_path):
        path = tmp_path / "deep" / "release.json"
        core.write_json(path, {"a": 1})
        assert core.read_json(path) == {"a": 1}
        assert not list(tmp_path.glob("**/*.tmp"))

    def test_a_not_a_number_is_refused_rather_than_written(self, tmp_path):
        # NaN is not valid JSON and would break every reader downstream.
        with pytest.raises(ValueError):
            core.write_json(tmp_path / "bad.json", {"a": math.nan})

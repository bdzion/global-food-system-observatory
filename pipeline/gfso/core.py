"""Shared helpers: fetching, dates, robust statistics and file output.

Conventions used by every module in this package:

- Missing values are None, never 0.
- A percentage change with a zero or missing base is None, not infinity.
- Timestamps are ISO 8601 in UTC. Observation periods are plain dates or years.
- Nothing is written to its final path until it has been written in full, so a
  crashed run cannot leave half a release behind.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import statistics
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

import httpx
import yaml

from . import USER_AGENT

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"


class SourceError(RuntimeError):
    """A source could not be fetched, or failed a check after it was fetched."""


# ---------------------------------------------------------------- config


def load_config(name: str) -> Any:
    with open(CONFIG / name, encoding="utf-8") as f:
        return yaml.safe_load(f)


def sources() -> dict[str, dict]:
    return {s["id"]: s for s in load_config("sources.yml")["sources"]}


# ---------------------------------------------------------------- time


def utc_now() -> datetime:
    """Now, in UTC. Tests pin this with GFSO_NOW so their output is stable."""
    fixed = os.environ.get("GFSO_NOW")
    if fixed:
        return datetime.fromisoformat(fixed).astimezone(timezone.utc)
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return (
        dt.astimezone(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def days_since(d: date | None) -> int | None:
    if d is None:
        return None
    return (utc_now().date() - d).days


def parse_date(s: str | None) -> date | None:
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:19] if "T" in s else s, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except ValueError:
        return None


# ---------------------------------------------------------------- fetching


def client(timeout: float = 120.0) -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
        timeout=httpx.Timeout(timeout, connect=30.0),
        follow_redirects=True,
        http2=False,
    )


def sanitize(msg: str) -> str:
    """Remove anything that looks like a credential before a message is logged."""
    msg = re.sub(
        r"(subscription-key|api[_-]?key|token|key)=[^&\s]+", r"\1=***", msg, flags=re.I
    )
    return msg[:400]


def fetch(
    url: str,
    *,
    params: dict | None = None,
    attempts: int = 4,
    timeout: float = 600.0,
    dest: Path | None = None,
) -> bytes | Path:
    """Fetch a URL with bounded retries and a growing wait between them.

    With `dest`, the body is streamed to that file and the path is returned,
    which is how the large bulk archives are handled. Without it, the bytes
    come back. A 4xx other than 429 stops immediately: a bad request will not
    fix itself, and retrying it only wastes the provider's capacity.
    """
    last: Exception | None = None
    for i in range(attempts):
        try:
            with client(timeout) as c:
                if dest is None:
                    r = c.get(url, params=params)
                    r.raise_for_status()
                    return r.content
                dest.parent.mkdir(parents=True, exist_ok=True)
                part = dest.with_suffix(dest.suffix + ".part")
                with c.stream("GET", url, params=params) as r:
                    r.raise_for_status()
                    with open(part, "wb") as f:
                        for chunk in r.iter_bytes(1 << 20):
                            f.write(chunk)
                part.replace(dest)
                return dest
        except (httpx.HTTPError, OSError) as e:
            last = e
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status is not None and 400 <= status < 500 and status != 429:
                break
            time.sleep(min(60, 3 * 2**i))
    raise SourceError(f"could not fetch {url}: {sanitize(str(last))}")


def fetch_json(url: str, **kw) -> Any:
    body = fetch(url, **kw)
    try:
        return json.loads(body)
    except ValueError as e:
        raise SourceError(f"{url} did not return valid JSON: {e}") from e


def cache_dir() -> Path:
    p = Path(os.environ.get("GFSO_CACHE", ROOT.parent / ".cache"))
    p.mkdir(parents=True, exist_ok=True)
    return p


# ---------------------------------------------------------------- statistics


def rnd(x: float | None, nd: int = 1) -> float | None:
    return None if x is None else round(x, nd)


def pct_change(current: float | None, base: float | None) -> float | None:
    """Percentage change, or None when it cannot be calculated.

    A zero base gives None rather than infinity, because "it rose from nothing"
    is not a percentage and printing one would mislead.
    """
    if current is None or base is None or base == 0:
        return None
    return 100.0 * (current - base) / base


def median(xs: Iterable[float | None]) -> float | None:
    vals = [x for x in xs if x is not None]
    return statistics.median(vals) if vals else None


def robust_z(value: float | None, history: Sequence[float | None]) -> float | None:
    """How far a value sits from its own history, in robust units.

    Uses the median and the median absolute deviation rather than the mean and
    standard deviation, so one freak month does not set the yardstick for every
    month after it. Returns None when the history is too short or too flat to
    say anything, which is the honest answer rather than a large number.
    """
    vals = [x for x in history if x is not None]
    if value is None or len(vals) < 24:
        return None
    med = statistics.median(vals)
    mad = statistics.median([abs(x - med) for x in vals])
    if mad == 0:
        return None
    return (value - med) / (1.4826 * mad)


def growth_anomaly(
    series: Sequence[tuple[str, float]],
    min_points: int = 60,
    window_months: int = 180,
):
    """Flag an unusual *rate of rise* in a price, not an unusual price level.

    A high price that has been high for two years is a known problem. A price
    climbing faster than it normally climbs is a new one, and it is the second
    that belongs on a page about what changed. So this measures the rate of
    change rather than the level: it standardises the month-on-month and
    year-on-year growth against how that growth has behaved over the past
    fifteen years, and combines the two with more weight on the longer view,
    which is the one that survives a single odd month.

    The fifteen-year window is a judgement, not a standard. It is long enough
    to contain the 2010-11 and 2022 price episodes, so a repeat of those does
    not read as unprecedented, and short enough that the 1970s do not set the
    yardstick for today. Lengthen or shorten it and some readings will change.

    This is in the spirit of FAO's food price anomaly indicator, which also
    standardises growth rather than level, but it is not that indicator and
    should not be reported as it: FAO weights its history differently and
    publishes its own thresholds.

    Returns None where the history is too short or too flat to support a
    number. Above 1 is worth a look, above 2 is unusual by any reading. Those
    are prompts, not thresholds anybody has validated for this platform.
    """
    pts = [(p, v) for p, v in series if v is not None and v > 0]
    if len(pts) < min_points:
        return None
    pts = pts[-window_months:]
    vals = [v for _, v in pts]

    def _standardised(growth: list[float]) -> float | None:
        if len(growth) < 24:
            return None
        hist, now = growth[:-1], growth[-1]
        med = statistics.median(hist)
        mad = statistics.median([abs(g - med) for g in hist])
        if mad == 0:
            return None
        return (now - med) / (1.4826 * mad)

    mom = [
        (vals[i] - vals[i - 1]) / vals[i - 1] for i in range(1, len(vals))
    ]
    yoy = [
        (vals[i] - vals[i - 12]) / vals[i - 12] for i in range(12, len(vals))
    ]
    cm, cy = _standardised(mom), _standardised(yoy)
    if cm is None or cy is None:
        return None
    # More weight on the year-on-year view: it is the one that survives a single
    # odd month.
    return 0.4 * cm + 0.6 * cy


def reference_band(value: float | None, history: Sequence[float | None], min_years: int = 5):
    """Compare a value with the same measure in earlier years.

    "Outside" means outside the whole range of the earlier years we hold, which
    is a deliberately plain rule: it marks only values that no earlier year
    matched. It is a reason to look, not a finding.
    """
    vals = [v for v in history if v is not None]
    if value is None or len(vals) < min_years:
        return {"state": "not_enough_history", "years_compared": len(vals)}
    lo, hi, mid = min(vals), max(vals), statistics.median(vals)
    if value > hi:
        state, direction = "outside_usual_range", "higher"
    elif value < lo:
        state, direction = "outside_usual_range", "lower"
    else:
        state, direction = "within_usual_range", "within"
    return {
        "state": state,
        "direction": direction,
        "years_compared": len(vals),
        "median": rnd(mid, 2),
        "lowest": rnd(lo, 2),
        "highest": rnd(hi, 2),
        "vs_median_pct": rnd(pct_change(value, mid), 1),
    }


# ---------------------------------------------------------------- output


def write_json(path: Path, obj: Any) -> None:
    """Write JSON atomically, so a reader never sees a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    tmp.replace(path)


def read_json(path: Path, default: Any = None) -> Any:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def checksum(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def plain_count(n: int, capitalise: bool = False) -> str:
    """Numbers up to ten as words, larger ones as figures, as newspapers do."""
    words = [
        "no", "one", "two", "three", "four", "five",
        "six", "seven", "eight", "nine", "ten",
    ]
    s = words[n] if 0 <= n <= 10 else f"{n:,}"
    return s[0].upper() + s[1:] if capitalise else s

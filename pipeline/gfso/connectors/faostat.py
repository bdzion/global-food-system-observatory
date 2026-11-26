"""FAOSTAT bulk downloads.

FAOSTAT publishes each dataset as one zipped CSV, with a catalogue file that
says when each was last updated. The catalogue is what lets this pipeline tell
a successful download apart from fresh data: a file we fetched this morning can
still hold last year's figures, and the site must say so rather than imply the
numbers are new.

The trade matrix is 400 MB and 52 million rows. Nothing here loads it into
memory. Rows are streamed out of the zip and dropped unless they match the
filter, so the whole archive is read once at a few hundred megabytes of disk
and a few megabytes of memory.
"""
from __future__ import annotations

import csv
import io
import zipfile
from pathlib import Path
from typing import Callable, Iterator

from .. import core

CATALOGUE = "https://bulks-faostat.fao.org/production/datasets_E.json"

# FAO's own flags, in plain words. These travel with every published figure so
# a reader can tell what kind of number they are looking at.
FLAGS = {
    "A": ("official", "Reported by the country"),
    "E": ("estimated", "Estimated by FAO"),
    "I": ("imputed", "Filled in from the trading partner's figures"),
    "X": ("external", "Supplied by another organisation"),
    "": ("unflagged", "No flag given"),
}


def catalogue(cache: Path | None = None) -> dict[str, dict]:
    """Every bulk dataset FAOSTAT offers, keyed by its dataset code."""
    cache = cache or core.cache_dir()
    path = cache / "faostat_catalogue.json"
    if not path.exists():
        core.fetch(CATALOGUE, dest=path)
    data = core.read_json(path)
    if not data:
        raise core.SourceError("the FAOSTAT catalogue could not be read")
    entries = data["Datasets"]["Dataset"]
    return {e["DatasetCode"]: e for e in entries}


def dataset_file(code: str, cache: Path | None = None) -> tuple[Path, dict]:
    """The local copy of one FAOSTAT dataset, downloaded if it is not here yet.

    Returns the file and its catalogue entry. The entry carries DateUpdate,
    which is the date that matters: it is when FAO last changed the figures,
    not when we last fetched them.
    """
    cache = cache or core.cache_dir()
    entry = catalogue(cache).get(code)
    if entry is None:
        raise core.SourceError(f"FAOSTAT has no bulk dataset called {code}")
    url = entry["FileLocation"]
    dest = cache / Path(url.split("/")[-1])
    if not dest.exists():
        core.fetch(url, dest=dest)
    return dest, entry


def rows(
    code: str,
    keep: Callable[[dict], bool] | None = None,
    cache: Path | None = None,
) -> Iterator[dict]:
    """Stream one dataset's rows, keeping only those the filter accepts."""
    path, _ = dataset_file(code, cache)
    with zipfile.ZipFile(path) as z:
        name = next(
            n for n in z.namelist() if n.endswith(".csv") and "All_Data" in n
        )
        with z.open(name) as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))
            for row in reader:
                if keep is None or keep(row):
                    yield row


def updated_on(code: str, cache: Path | None = None):
    """When FAO last changed this dataset's figures."""
    _, entry = catalogue(cache).get(code, {}), catalogue(cache).get(code, {})
    return core.parse_date((entry or {}).get("DateUpdate"))


def m49(value: str | None) -> str | None:
    """FAOSTAT writes M49 country codes as `'004`. Strip the quote, keep the zeros."""
    if not value:
        return None
    code = value.strip().lstrip("'").strip()
    return code.zfill(3) if code.isdigit() else None


def number(value: str | None) -> float | None:
    """A FAOSTAT value as a number, or None. An empty cell is not a zero."""
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def flag(value: str | None) -> dict:
    key = (value or "").strip().upper()
    kind, words = FLAGS.get(key, ("unflagged", "No flag given"))
    return {"code": key, "kind": kind, "means": words}

"""What other organisations are reporting right now.

The rest of this pipeline measures structure: who buys food from whom, how
concentrated that is, whether a price has moved unusually. Structure moves
slowly and the trade figures behind it are a year or more old, so a reader
asking "is something happening *now*" gets no answer from it.

This module fills that gap by pointing at the organisations whose job it is to
answer that question. ReliefWeb is the UN's humanitarian content exchange; it
carries the published output of roughly five thousand organisations, including
the Famine Early Warning Systems Network, the Integrated Food Security Phase
Classification, FAO and the World Food Programme. Filtering its feeds to food
and agriculture gives us their current assessments without a separate
integration for each one.

Two deliberate limits:

  * We store a pointer, never the content. Title, link, date, publisher,
    country. ReliefWeb's own terms ask readers to go to the original source,
    and the registry classes this source as `link_only`, so the build would
    refuse to publish a download of it in any case.

  * A failure here never stops a release. The feed going quiet is a fact about
    the feed, not about the food system, and the site says so rather than
    showing an empty panel. FEWS NET itself was suspended for six months in
    2025 and still has countries switched off, which is the plainest available
    argument for not letting one feed become a single point of failure.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from urllib.parse import urlencode

from . import SCHEMA_VERSION, core

FEED = "https://reliefweb.int/updates/rss.xml"
DOC = "https://apidoc.reliefweb.int/"

# Each query is a separate request. They overlap on purpose: the first two pull
# the named early-warning products a decision-maker would be asked about by
# name, and the last two catch everything else food-related, including reports
# from organisations we have not thought to list.
QUERIES = [
    ("early_warning", 'source.name:"Famine Early Warning System Network"'),
    ("early_warning", 'source.name:("Integrated Food Security Phase Classification" OR "Food Security and Nutrition Analysis Unit")'),
    ("agency", 'source.name:("Food and Agriculture Organization of the United Nations" OR "World Food Programme") AND theme.name:("Food and Nutrition" OR "Agriculture")'),
    ("general", 'theme.name:("Food and Nutrition" OR "Agriculture")'),
    ("hazard", 'disaster_type.name:("Drought" OR "Flood") AND theme.name:("Agriculture" OR "Food and Nutrition")'),
]

# ReliefWeb labels the country and the publisher inside the description HTML.
# The <category> elements carry the same values but unlabelled and mixed in with
# themes and content formats, so the labelled markup is the reliable route.
TAG = re.compile(
    r'<div class="tag (country|source)">\s*(?:Country|Source):\s*(.*?)\s*</div>',
    re.I | re.S,
)
THEMES = {
    "agriculture", "food and nutrition", "climate change and environment",
    "disaster management", "logistics and telecommunications", "water sanitation hygiene",
}
# Reports whose own title says they are a forward look. Worth marking, because
# a projection and a situation report answer different questions.
FORWARD = re.compile(r"\b(outlook|projection|forecast|anticipat|early warning|alert)", re.I)

MAX_ITEMS = 40
STALE_AFTER_DAYS = 7

# ReliefWeb uses UN long-form country names. Most resolve against the ISO3
# table once bracketed qualifiers are removed ("Bolivia (Plurinational State
# of)"); these are the ones that do not. Keeping the list short and explicit is
# deliberate — a fuzzy matcher here would quietly file a report under the wrong
# country, which is worse than not filing it at all.
ALIASES = {
    "syrianarabrepublic": "SYR",
    "occupiedpalestinianterritory": "PSE",
    "stateofpalestine": "PSE",
    "lao people s democratic republic": "LAO",
    "laopeoplesdemocraticrepublic": "LAO",
    "republicofmoldova": "MDA",
    "unitedrepublicoftanzania": "TZA",
    "viet nam": "VNM",
    "vietnam": "VNM",
    "turkiye": "TUR",
    "cotedivoire": "CIV",
    "democraticpeoplesrepublicofkorea": "PRK",
    "republicofkorea": "KOR",
    "iranislamicrepublicof": "IRN",
    "venezuelabolivarianrepublicof": "VEN",
    "democraticrepublicofthecongo": "COD",
}
# Not a country. ReliefWeb uses it for global and multi-region reports.
NOT_A_COUNTRY = {"world"}


def _iso_index() -> dict[str, str]:
    table = core.load_config("countries.json")
    index = {}
    for entry in table.values():
        name = entry.get("name")
        if name and entry.get("iso3"):
            index[_key(name)] = entry["iso3"]
    index.update(ALIASES)
    return index


def _key(value: str) -> str:
    return re.sub(r"[^a-z]", "", value.lower())


def _resolve(name: str, index: dict[str, str]) -> str | None:
    """ISO3 for a ReliefWeb country name, or None if we cannot be sure."""
    if _key(name) in {_key(n) for n in NOT_A_COUNTRY}:
        return None
    direct = index.get(_key(name))
    if direct:
        return direct
    # "Bolivia (Plurinational State of)" -> "Bolivia"
    base = re.sub(r"\s*\(.*?\)\s*", " ", name).strip()
    return index.get(_key(base))


def _text(node, tag):
    value = node.findtext(tag)
    return value.strip() if value else ""


def _strip(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def _parse(xml: bytes, kind: str, index: dict[str, str]) -> list[dict]:
    """Turn one feed into report pointers. A malformed feed yields nothing."""
    try:
        channel = ET.fromstring(xml).find("channel")
    except ET.ParseError:
        return []
    if channel is None:
        return []

    out = []
    for item in channel.findall("item"):
        link = _text(item, "link")
        title = _text(item, "title")
        if not link or not title:
            continue

        description = item.findtext("description") or ""
        countries, publishers = [], []
        for label, value in TAG.findall(description):
            value = _strip(value)
            if not value:
                continue
            (countries if label.lower() == "country" else publishers).append(value)

        published = None
        raw = _text(item, "pubDate")
        if raw:
            try:
                published = parsedate_to_datetime(raw).date().isoformat()
            except (TypeError, ValueError):
                published = None

        categories = [(c.text or "").strip() for c in item.findall("category")]
        publisher = publishers[0] if publishers else (_text(item, "author") or None)

        out.append({
            "title": title.rstrip("\\").strip(),
            "url": link,
            "published": published,
            "publisher": publisher,
            "countries": countries[:4],
            "iso3": [c for c in dict.fromkeys(filter(None, (_resolve(n, index) for n in countries)))][:4],
            "themes": [c for c in categories if c.lower() in THEMES][:3],
            "kind": kind,
            "forward_looking": bool(FORWARD.search(title)),
        })
    return out


def gather() -> dict:
    """Fetch every query, merge, and return a payload that is safe to publish.

    `available` is false when nothing came back at all. Partial success is
    normal and is reported as such: `queries_failed` names what did not load so
    a reader can tell a quiet week from a broken feed.
    """
    index = _iso_index()
    seen: dict[str, dict] = {}
    failed: list[str] = []

    for kind, query in QUERIES:
        url = f"{FEED}?{urlencode({'search': query})}"
        try:
            body = core.fetch(url, attempts=2, timeout=45.0)
        except core.SourceError as e:
            failed.append(core.sanitize(str(e))[:160])
            continue
        for report in _parse(body if isinstance(body, bytes) else b"", kind, index):
            prior = seen.get(report["url"])
            # An item can arrive under several queries. Keep the most specific
            # label, so an IPC projection is not demoted to a general report.
            if prior is None:
                seen[report["url"]] = report
            elif prior["kind"] == "general" and report["kind"] != "general":
                report["countries"] = report["countries"] or prior["countries"]
                report["iso3"] = report["iso3"] or prior["iso3"]
                seen[report["url"]] = report

    reports = sorted(
        seen.values(),
        key=lambda r: (r["published"] or "", r["title"]),
        reverse=True,
    )[:MAX_ITEMS]

    newest = next((r["published"] for r in reports if r["published"]), None)
    by_country: dict[str, list[str]] = {}
    for report in reports:
        for code in report["iso3"]:
            by_country.setdefault(code, []).append(report["url"])

    return {
        "schema_version": SCHEMA_VERSION,
        "available": bool(reports),
        "fetched_at": core.iso(core.utc_now()),
        "newest_published": newest,
        "age_days": core.days_since(core.parse_date(newest)) if newest else None,
        "stale_after_days": STALE_AFTER_DAYS,
        "source": {
            "provider": "UN Office for the Coordination of Humanitarian Affairs",
            "dataset": "ReliefWeb updates",
            "documentation_url": DOC,
            "redistribution": "link_only",
            "note": (
                "Titles and links only. ReliefWeb asks readers to go to the "
                "publishing organisation for the content itself."
            ),
        },
        "queries_run": len(QUERIES),
        "queries_failed": failed,
        "count": len(reports),
        "countries_covered": len(by_country),
        "country_index": by_country,
        "reports": reports,
    }

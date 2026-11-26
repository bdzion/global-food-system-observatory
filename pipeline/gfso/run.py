"""Build and publish one release.

    python -m gfso.run --out ../public/data

Checks run before anything is published. If a mandatory check fails, the run
stops and whatever release was already published stays in place: an old release
that is honestly labelled is better than a new one that is wrong.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import SCHEMA_VERSION, build, core, commodities, intelligence, external, api_evidence, spatial, validation, authenticated, release_quality, reports


class GateFailed(RuntimeError):
    """A release did not pass its checks and was not published."""


def checks(release: dict) -> list[str]:
    """Everything that must be true before a release goes out.

    Each check exists because of a way this kind of site goes wrong: a page
    that renders a blank because a field vanished, a figure shown with no
    source, a download published that the licence does not allow, or a
    scenario presented as though it were an observation.
    """
    problems: list[str] = []

    for name, payload in release.items():
        if payload.get("schema_version") != SCHEMA_VERSION:
            problems.append(f"{name}.json does not carry the current schema version")

    countries = release["countries"]["countries"]
    if len(countries) < 20:
        problems.append(
            f"only {len(countries)} country profiles were built, which is too few "
            "to be a working release"
        )

    for iso, country in countries.items():
        wheat = country["wheat"]
        if wheat["imports_t"] is None:
            problems.append(f"{iso} has a profile but no import figure")
        if wheat["suppliers"] and wheat["supplier_basis"] == "none_available":
            problems.append(f"{iso} lists suppliers but no basis for them")
        if len(country["chain"]) != 7:
            problems.append(f"{iso} has {len(country['chain'])} chain stages, not seven")
        for stage in country["chain"]:
            if stage["state"] == "not_watched" and not stage.get("because"):
                problems.append(
                    f"{iso} stage {stage['id']} says nothing is watching it but "
                    "does not say why"
                )

    prices = release["world"]["prices"]
    if not prices:
        problems.append("no world price series were built")
    for pid, price in prices.items():
        if price["latest_value"] is None:
            problems.append(f"price series {pid} has no latest value")
        if not price["latest_period"]:
            problems.append(f"price series {pid} has no period")

    situation = release["world"]["situation"]
    if situation["reviewed"] is not False or not situation.get("review_note"):
        problems.append(
            "the situation text must be marked unreviewed and carry its note"
        )

    sources = release["sources"]["sources"]
    for source in sources:
        # A source whose figures go into the release must be cleared to
        # redistribute them. A source we only link out to need not be, but it
        # has to say so: `publishes: pointers` in the registry is the promise
        # that none of its content is carried here. Anything that stays silent
        # is treated as carrying figures, which is the stricter reading.
        if source.get("publishes", "figures") == "pointers":
            if source["redistribution"] not in (
                "may_republish", "attribution_only", "link_only",
            ):
                problems.append(
                    f"source {source['id']} is linked but its terms do not "
                    "permit even that"
                )
            continue
        if source["redistribution"] not in ("may_republish", "attribution_only"):
            problems.append(
                f"source {source['id']} is published but its redistribution right "
                "is not cleared"
            )

    ledger = release["ledger"]
    if not ledger.get("assumptions"):
        problems.append("the assumption ledger is empty")

    if "commodities" in release:
        problems.extend(commodities.checks(release["commodities"]))

    problems.extend(release_quality.checks(release))
    return problems


def publish(release: dict, out: Path, release_id: str) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for name, payload in release.items():
        path = out / f"{name}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        core.write_json(path, payload)
        files.append(
            {
                "name": f"{name}.json",
                "bytes": path.stat().st_size,
                "sha256": core.checksum(path),
            }
        )

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "release_id": release_id,
        "generated_at_utc": core.iso(core.utc_now()),
        "files": files,
        "sources": [
            {
                "id": s["id"],
                "provider_updated": s["provider_updated"],
                "days_old": s["days_old"],
                "older_than_expected": s["older_than_expected"],
            }
            for s in release["sources"]["sources"]
        ],
        "coverage": {
            "countries_profiled": len(release["countries"]["countries"]),
            "price_series": len(release["world"]["prices"]),
            "assumptions_checked": len(release["ledger"]["assumptions"]),
            "assumptions_broken": release["ledger"]["broken_count"],
            "product_forms": len(release.get("commodity-index",{}).get("coverage",{})),
            "product_country_profiles": sum(c["countries"] for c in release.get("commodity-index",{}).get("coverage",{}).values()),
        },
    }
    core.write_json(out / "manifest.json", manifest)
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path, help="where to write the release")
    parser.add_argument("--cache", type=Path, default=None, help="where downloads are kept")
    parser.add_argument(
        "--dry-run", action="store_true", help="build and check, but publish nothing"
    )
    args = parser.parse_args(argv)

    print("Fetching published statistics...", flush=True)
    data = build.gather(args.cache)
    print(
        f"  latest full year: {data['latest_year']}; "
        f"price data to {data['pink']['periods'][-1]}",
        flush=True,
    )

    print("Working out indicators, chains and the assumption ledger...", flush=True)
    release = build.assemble(data)
    # Additive contract: keep every legacy wheat payload unchanged.
    release["commodities"] = commodities.build_extension(args.cache, data)
    release.update(intelligence.compact_views(release["commodities"]))
    release["signals"] = intelligence.signals(release["world"])
    release["country-context"] = intelligence.context(release["commodity-index"]["country_names"])
    release["external-evidence"] = external.gather(args.cache)
    release["api-evidence"] = api_evidence.gather()
    release["reports"] = reports.gather()
    release["spatial-evidence"] = spatial.gather(args.cache)
    release["scientific-validation"] = validation.evaluate(data["pink"])
    release["authenticated-evidence"] = authenticated.gather(release["external-evidence"]["psd"].get("records",[]))

    problems = checks(release)
    if problems:
        print("\nThis release did not pass its checks, so nothing was published:")
        for problem in problems:
            print(f"  - {problem}")
        raise GateFailed(f"{len(problems)} check(s) failed")

    release_id = core.utc_now().strftime("%Y%m%dT%H%M%SZ")
    if args.dry_run:
        print(f"\nChecks passed. Nothing published (dry run). Would be {release_id}.")
        return 0

    release["assessment-history"] = intelligence.archive(args.out, release["signals"], release_id)
    manifest = publish(release, args.out, release_id)
    print(f"\nPublished release {manifest['release_id']} to {args.out}")
    for key, value in manifest["coverage"].items():
        print(f"  {key.replace('_', ' ')}: {value}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except GateFailed as e:
        print(f"\nStopped: {e}", file=sys.stderr)
        sys.exit(2)

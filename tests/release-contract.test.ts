/* Does the published release still have the shape the pages read?
 *
 * These exist because of one specific failure: the pipeline stops producing a
 * field, every build stays green, and a panel on the site renders an empty
 * space where a number used to be. On a site about food supply, an empty space
 * reads as "nothing to report", which is the one thing it must never say by
 * accident.
 *
 * They run against whatever release is checked out in public/data, and skip
 * themselves when there is none, so a fresh clone still passes `npm test`. */

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCHEMA } from "../src/lib/types";

const DIR = "public/data";
const present = existsSync(`${DIR}/manifest.json`);

/* With no release checked out, every read returns an object whose every
 * property is an empty array, so the constants below cannot throw while vitest
 * is collecting the file. The suites are then skipped rather than failed. */
const EMPTY = new Proxy({}, { get: () => [] }) as any;
const read = (name: string): any =>
  present ? JSON.parse(readFileSync(`${DIR}/${name}`, "utf8")) : EMPTY;

describe.skipIf(!present)("a published release", () => {
  const files = [
    "manifest.json", "world.json", "countries.json",
    "ledger.json", "pairs.json", "scenario.json", "sources.json",
  ];

  it("carries the release format every page checks for", () => {
    for (const name of files) {
      expect(read(name).schema_version, name).toBe(SCHEMA);
    }
  });

  it("lists every file it published, with a checksum", () => {
    const manifest = read("manifest.json");
    expect(manifest.release_id).toBeTruthy();
    expect(manifest.generated_at_utc).toBeTruthy();
    for (const file of manifest.files) {
      expect(file.sha256, `${file.name} checksum`).toMatch(/^[0-9a-f]{64}$/);
      expect(file.bytes).toBeGreaterThan(0);
    }
  });

  describe("every country profile", () => {
    const countries: any[] = Object.values(read("countries.json").countries ?? {});

    it("has enough countries to be a working release", () => {
      expect(countries.length).toBeGreaterThan(20);
    });

    it("carries the fields the cards and tables render", () => {
      for (const country of countries) {
        expect(country.iso3, "iso3").toMatch(/^[A-Z]{3}$/);
        expect(country.name, `${country.iso3} name`).toBeTruthy();
        expect(country.wheat, `${country.iso3} wheat`).toBeTruthy();
        expect(country.wheat.year, `${country.iso3} year`).toBeGreaterThan(2000);
      }
    });

    it("never reports a missing figure as a zero", () => {
      // A zero and an absence mean entirely different things here, and the
      // pipeline must not blur them. Stocks and dependence are the two fields
      // where blurring them would most mislead.
      for (const country of countries) {
        const { stock_cover_months, import_dependence_pct } = country.wheat;
        expect(stock_cover_months === null || stock_cover_months > 0).toBe(true);
        expect(
          import_dependence_pct === null || import_dependence_pct > 0,
        ).toBe(true);
      }
    });

    it("explains every stock figure it declines to publish", () => {
      for (const country of countries) {
        if (country.wheat.stock_note) {
          expect(country.wheat.stock_cover_months).toBeNull();
          expect(country.wheat.stock_note.length).toBeGreaterThan(40);
        }
      }
    });

    it("says where a supplier breakdown came from", () => {
      const allowed = [
        "reported_by_this_country",
        "reconstructed_from_suppliers",
        "none_available",
      ];
      for (const country of countries) {
        expect(allowed, `${country.iso3} basis`).toContain(
          country.wheat.supplier_basis,
        );
        if (country.wheat.suppliers.length > 0) {
          expect(country.wheat.supplier_basis).not.toBe("none_available");
        }
      }
    });

    it("has shares that add up to about a hundred", () => {
      for (const country of countries) {
        const suppliers = country.wheat.suppliers;
        if (suppliers.length === 0) continue;
        const total = suppliers.reduce((sum: number, s: any) => sum + s.share_pct, 0);
        expect(total, `${country.iso3} supplier shares`).toBeGreaterThan(97);
        expect(total, `${country.iso3} supplier shares`).toBeLessThan(103);
      }
    });

    it("has all seven links of the chain, each with a state the page can label", () => {
      const states = ["quiet", "watching", "not_watched", "no_data"];
      for (const country of countries) {
        expect(country.chain.length, `${country.iso3} chain`).toBe(7);
        for (const stage of country.chain) {
          expect(states, `${country.iso3}/${stage.id}`).toContain(stage.state);
          expect(stage.label).toBeTruthy();
          expect(stage.state_label).toBeTruthy();
          expect(stage.what_it_means).toBeTruthy();
        }
      }
    });

    it("never shows an unwatched link as calm, and always says why", () => {
      for (const country of countries) {
        for (const stage of country.chain) {
          if (stage.state === "not_watched") {
            expect(stage.because, `${country.iso3}/${stage.id}`).toBeTruthy();
            expect(stage.findings).toHaveLength(0);
            expect(stage.state_label).not.toBe("Nothing unusual");
          }
        }
      }
    });
  });

  describe("world prices", () => {
    const prices: any[] = Object.values(read("world.json").prices ?? {});

    it("each carry a value, a unit, a period and plain words", () => {
      expect(prices.length).toBeGreaterThan(0);
      for (const price of prices) {
        expect(price.latest_value, `${price.id} value`).not.toBeNull();
        expect(price.unit, `${price.id} unit`).toBeTruthy();
        expect(price.latest_period, `${price.id} period`).toMatch(/^\d{4}M\d{2}$/);
        expect(price.plain_name, `${price.id} name`).toBeTruthy();
        expect(price.why_it_is_here, `${price.id} reason`).toBeTruthy();
        expect(price.climb_reading.words, `${price.id} reading`).toBeTruthy();
      }
    });
  });

  describe("the situation text", () => {
    const situation = read("world.json").situation ?? {};

    it("says plainly that nobody reviewed it", () => {
      expect(situation.reviewed).toBe(false);
      expect(situation.review_note).toBeTruthy();
    });

    it("never calls a country at risk", () => {
      // The pipeline may describe what the figures say. Saying a country is at
      // risk is a judgement, and nobody has made it for this release.
      const text = (situation.lines ?? []).join(" ").toLowerCase();
      for (const phrase of ["at risk", "crisis", "shortage", "will face", "danger"]) {
        expect(text, `situation text contains "${phrase}"`).not.toContain(phrase);
      }
    });
  });

  describe("the assumption ledger", () => {
    const ledger = read("ledger.json");

    it("checks every assumption and explains each one", () => {
      expect(ledger.assumptions.length).toBeGreaterThan(0);
      const states = ["holding", "broken", "broken_somewhere", "cannot_check"];
      for (const a of ledger.assumptions) {
        expect(states, `${a.id} state`).toContain(a.state);
        expect(a.plain, `${a.id} plain words`).toBeTruthy();
        expect(a.why_it_matters, `${a.id} reason`).toBeTruthy();
        expect(a.if_broken, `${a.id} consequence`).toBeTruthy();
        expect(a.checked_at, `${a.id} checked at`).toBeTruthy();
      }
    });

    it("counts what it found", () => {
      const broken = ledger.assumptions.filter((a: any) =>
        ["broken", "broken_somewhere"].includes(a.state),
      );
      expect(ledger.broken_count).toBe(broken.length);
    });
  });

  describe("sources", () => {
    const sources: any[] = read("sources.json").sources ?? [];

    it("publish nothing whose redistribution right is not cleared", () => {
      /* A source whose figures go into the release must be cleared to
       * redistribute them. A source we only link out to need not be, but it
       * must say so: `publishes: pointers` is the registry's way of promising
       * that none of its content is carried here, and anything that does not
       * say otherwise is treated as carrying figures. */
      for (const source of sources) {
        if (source.publishes === "pointers") {
          expect(
            ["link_only", "attribution_only", "may_republish"],
            `${source.id} redistribution`,
          ).toContain(source.redistribution);
          continue;
        }
        expect(
          ["may_republish", "attribution_only"],
          `${source.id} redistribution`,
        ).toContain(source.redistribution);
      }
    });

    it("carry no report text for any source we only link out to", () => {
      /* The reason link_only is allowed at all is that the release stores
       * pointers. If that ever stops being true, this fails. */
      if (!present || !existsSync(`${DIR}/reports.json`)) return;
      const payload = read("reports.json");
      expect(payload.source.redistribution).toBe("link_only");
      for (const report of payload.reports ?? []) {
        expect(Object.keys(report).sort()).toEqual([
          "countries", "forward_looking", "iso3", "kind", "published",
          "publisher", "themes", "title", "url",
        ]);
        expect(report.url).toMatch(/^https:\/\//);
      }
    });

    it("each say in plain words what they do and do not tell us", () => {
      for (const source of sources) {
        expect(source.licence, `${source.id} licence`).toBeTruthy();
        expect(source.licence_url, `${source.id} licence url`).toBeTruthy();
        expect(source.caveat, `${source.id} caveat`).toBeTruthy();
      }
    });
  });
});

import { useMemo, useState } from "react";
import type { Country, Release } from "../lib/types";
import { months, percent, tonnes } from "../lib/format";
import { href } from "../lib/router";
import { Column, DataTable, Explain, Source, Unknown } from "../components/ui";

type Sort = "imports" | "dependence" | "cover" | "name";

export function Countries({ release }: { release: Release }) {
  const all = Object.values(release.countries.countries);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("imports");

  const rows = useMemo(() => {
    const filtered = all.filter((c) =>
      c.name.toLowerCase().includes(search.trim().toLowerCase()),
    );
    const sorters: Record<Sort, (a: Country, b: Country) => number> = {
      imports: (a, b) => (b.wheat.imports_t ?? 0) - (a.wheat.imports_t ?? 0),
      dependence: (a, b) =>
        (b.wheat.import_dependence_pct ?? -1) - (a.wheat.import_dependence_pct ?? -1),
      cover: (a, b) =>
        (a.wheat.stock_cover_months ?? Number.POSITIVE_INFINITY) -
        (b.wheat.stock_cover_months ?? Number.POSITIVE_INFINITY),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...filtered].sort(sorters[sort]);
  }, [all, search, sort]);

  const columns: Column<Country>[] = [
    {
      key: "name",
      head: "Country",
      render: (c) => <a href={href("country", c.iso3)}>{c.name}</a>,
    },
    {
      key: "imports",
      head: "Wheat bought in",
      numeric: true,
      render: (c) => tonnes(c.wheat.imports_t),
    },
    {
      key: "dependence",
      head: "Share bought abroad",
      numeric: true,
      render: (c) =>
        c.wheat.import_dependence_pct === null ? (
          <Unknown because="no usable supply figures" />
        ) : (
          percent(c.wheat.import_dependence_pct)
        ),
    },
    {
      key: "cover",
      head: "Held in store",
      numeric: true,
      render: (c) =>
        c.wheat.stock_cover_months === null ? (
          <Unknown because="no stock estimate published" />
        ) : (
          months(c.wheat.stock_cover_months)
        ),
    },
    {
      key: "supplier",
      head: "Largest supplier",
      render: (c) =>
        c.wheat.top_supplier ? (
          `${c.wheat.top_supplier} (${percent(c.wheat.top_supplier_share_pct)})`
        ) : (
          <Unknown because="no trade breakdown" />
        ),
    },
  ];

  return (
    <>
      <h1>Countries</h1>
      <p className="lede">
        Every country that buys at least 300,000 tonnes of wheat a year. For each
        one: how much it grows, how much it buys, who it buys from, and what it
        has to fall back on.
      </p>

      <Explain term="share bought abroad">
        <p>
          How much of the wheat a country uses it has to buy from somewhere else.
          A country at 100% grows none of its own. A country at 20% grows most of
          what it needs and tops up. It is worked out as imports divided by
          everything the country has available to use, which is what it grew,
          plus what it bought, minus what it sold on.
        </p>
      </Explain>

      <div className="toggle-row">
        <label htmlFor="country-search" className="sr-only">
          Search for a country
        </label>
        <input
          id="country-search"
          type="search"
          placeholder="Search for a country"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label htmlFor="country-sort">Order by</label>
        <select
          id="country-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
        >
          <option value="imports">Most wheat bought in</option>
          <option value="dependence">Most dependent on imports</option>
          <option value="cover">Least held in store</option>
          <option value="name">Name</option>
        </select>
        <span className="figure-note">
          {rows.length} of {all.length} countries
        </span>
      </div>

      <DataTable
        caption={`Wheat in ${release.countries.year}, the latest year with full figures. A dash means the figure is not published, not that it is zero.`}
        columns={columns}
        rows={rows}
        rowKey={(c) => c.iso3}
        empty="No country matches that search."
      />
      <Source
        name="FAO supply and use accounts and detailed trade matrix"
        period={String(release.countries.year)}
        note="Published once a year, about a year after the period they cover."
      />
    </>
  );
}

import type { Release } from "../lib/types";
import { ageWords, changeWords, dateWords, monthWords, percent, tonnes } from "../lib/format";
import { href } from "../lib/router";
import { Explain, Figure, Notice, Source, Tag } from "../components/ui";

export function Home({ release }: { release: Release }) {
  const { world, countries, ledger, manifest, sources, pairs } = release;
  const wheat = world.prices.wheat_price;
  const all = Object.values(countries.countries);

  const moving = Object.values(world.prices).filter((p) =>
    ["climbing", "climbing_fast"].includes(p.climb_reading.state),
  );
  const leaning = all.filter(
    (c) => (c.wheat.import_dependence_pct ?? 0) >= 50 && (c.wheat.imports_t ?? 0) >= 2_000_000,
  );
  // Ranked on who a country buys from, not on what it holds in store. Trade
  // figures are reported by governments and cross-checked; the stock estimates
  // are FAO's own and, for several large buyers, little more than placeholders.
  // Ranking countries on the weaker of the two measures would manufacture a
  // finding, so the headline list is built from the stronger one.
  const concentrated = all
    .filter(
      (c) =>
        (c.wheat.imports_t ?? 0) >= 2_000_000 &&
        (c.wheat.import_dependence_pct ?? 0) >= 40 &&
        c.wheat.top_supplier_share_pct !== null,
    )
    .sort(
      (a, b) => (b.wheat.top_supplier_share_pct ?? 0) - (a.wheat.top_supplier_share_pct ?? 0),
    );
  const oldest = [...sources.sources]
    .filter((s) => s.days_old !== null)
    .sort((a, b) => (b.days_old ?? 0) - (a.days_old ?? 0))[0];

  return (
    <>
      <h1>Shocks to the food system are certain. Crises are not.</h1>
      <p className="lede">
        Harvests fail, wars close shipping lanes, governments ban exports. What
        decides whether that becomes a crisis is what a country has to fall back
        on: wheat in store, more than one supplier to call, money to buy with,
        and households with room in the budget. This site shows those things for
        the world's wheat trade, and says plainly where it cannot see.
      </p>

      <Notice plain title="What this is. ">
        <p>
          A research project, run from the University of Guelph. It is not an
          official warning system, and nothing on it is a forecast. Everything
          here is built from figures published by the United Nations Food and
          Agriculture Organization and the World Bank, and every number says
          where it came from and when.
        </p>
      </Notice>

      <h2>What the figures say today</h2>
      <ul>
        {world.situation.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <p className="figure-note">
        <strong>Nobody has reviewed these lines.</strong> {world.situation.review_note}
      </p>

      <div className="grid cols-4" style={{ marginTop: "1.5rem" }}>
        <Figure
          label="World wheat price"
          value={wheat ? `$${wheat.latest_value}` : "—"}
          note={
            wheat ? (
              <>
                per tonne, {monthWords(wheat.latest_period)}.{" "}
                {changeWords(wheat.change_over_year_pct)}.
              </>
            ) : undefined
          }
        />
        <Figure
          label="Prices rising unusually fast"
          value={`${moving.length} of ${Object.keys(world.prices).length}`}
          note={
            moving.length
              ? moving.map((p) => p.plain_name).join(", ")
              : "None of the prices we follow."
          }
        />
        <Figure
          label="Countries leaning on imported wheat"
          value={String(leaning.length)}
          note={`Buy over 2 million tonnes a year and get at least half of it from abroad (${countries.year}).`}
        />
        <Figure
          label="Assumptions behind our what-if test"
          value={`${ledger.broken_count} of ${ledger.assumptions.length} broken`}
          note={<a href={href("assumptions")}>See which, and what broke them</a>}
        />
      </div>

      <h2>Where one seller carries most of the load</h2>
      <p>
        These are large buyers that get most of their wheat from abroad and most
        of that from a single country. It is not a list of countries in trouble.
        It is a list of countries for whom one supplier's bad year is their bad
        year too, and who would have the most to replace and the fewest places
        to start.
      </p>

      <Explain term="largest supplier">
        <p>
          The share of a country's imported wheat that comes from one seller. A
          high share is not the same as danger: a reliable neighbour selling you
          90% of your wheat may be safer than five distant sellers who each have
          a bad year at a different time. What it does mean is that if that one
          seller stops, there is more to replace and less practice at replacing
          it.
        </p>
        <p>
          Where a country does not report its own trade, this is pieced together
          from what its suppliers said they sold it, and its page says so.
        </p>
      </Explain>

      <div className="grid cols-3">
        {concentrated.slice(0, 6).map((country) => (
          <a
            key={country.iso3}
            href={href("country", country.iso3)}
            className="card"
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div className="figure-label">{country.name}</div>
            <div className="figure-value">
              {percent(country.wheat.top_supplier_share_pct)}{" "}
              <span style={{ fontSize: "1rem", fontWeight: 400 }}>
                from {country.wheat.suppliers[0]?.name ?? country.wheat.top_supplier}
              </span>
            </div>
            <div className="figure-note">
              Buys {percent(country.wheat.import_dependence_pct)} of its wheat from
              abroad, {tonnes(country.wheat.imports_t)} in {countries.year}.
            </div>
          </a>
        ))}
      </div>
      <Source
        name="FAO detailed trade matrix and supply and utilisation accounts"
        period={`${countries.year}, the latest year with full figures`}
      />

      <Notice title="One measure we are careful with. ">
        <p>
          Wheat held in store is the obvious thing to rank countries by, and we
          do not rank on it. FAO's stock estimates are the only open global
          figures available, and for several large buyers they are placeholders
          rather than estimates — in this release five countries are recorded as
          holding almost nothing after years of holding millions of tonnes. We
          publish no stock figure for those, say so on their pages, and keep
          stock cover off the front page rather than build a league table on a
          measure that cannot carry one.
        </p>
      </Notice>

      {pairs.pairs.length > 0 ? (
        <>
          <h2>The same shock, two different outcomes</h2>
          <p>
            This is the argument the site is built around. Two countries can
            depend on imported wheat to the same degree and still be in very
            different positions, because one of them has more to fall back on.
            The shock is rarely the whole story. What the shock lands on usually
            is.
          </p>
          <div className="grid cols-2">
            {pairs.pairs.slice(0, 2).map((pair) => (
              <div className="card" key={`${pair.a}-${pair.b}`}>
                <h3 style={{ marginTop: 0 }}>
                  {countries.countries[pair.a]?.name} and{" "}
                  {countries.countries[pair.b]?.name}
                </h3>
                <p>
                  <strong>The same:</strong> {pair.shared}
                </p>
                <p>
                  <strong>Different:</strong> {pair.differs}
                </p>
                <p>
                  <a href={href("chain")}>See how a shock reaches each of them</a>
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <h2>Beyond wheat</h2>
      <p>
        The pages above are about wheat, which is where this project started
        and where it goes into the most depth. The same annual figures —
        what each country grew, bought, sold and had in store, and who it
        bought from — are also published for rice, maize and soybeans.
      </p>
      <p>
        <a href={href("commodities")}>See all four crops →</a>
      </p>

      <h2>What we cannot see</h2>
      <p>
        Two of the seven links in the chain between a wheat field and a dinner
        table have nothing watching them on this site. We have no automatic feed
        for how crops are doing in the ground, and none for whether grain can
        physically move through ports and shipping lanes. Those links are marked{" "}
        <Tag state="not_watched">Nothing is watching this</Tag> wherever they
        appear, and they are never shown as calm.
      </p>
      <p>
        The trade and stock figures are published once a year and arrive about a
        year late. They describe the shape of the system, not this month. Only
        the price figures are current.{" "}
        <a href={href("how")}>How this works</a> sets out every source, what it
        covers and what it misses.
      </p>

      <hr className="rule" />
      <p className="figure-note">
        Release {manifest.release_id}, put together {dateWords(manifest.generated_at_utc)}.{" "}
        {oldest
          ? `The oldest figures on the site are from ${oldest.provider}, ${ageWords(oldest.days_old)}.`
          : ""}
      </p>
    </>
  );
}

import { useState } from "react";
import type { Release } from "../lib/types";
import { changeWords, monthWords, months, tonnes } from "../lib/format";
import { href } from "../lib/router";
import { LineChart } from "../components/charts";
import { Chain } from "../components/Chain";
import { Column, DataTable, Explain, Notice, Source, Tag } from "../components/ui";

export function ChainPage({ release }: { release: Release }) {
  const { world, countries, pairs } = release;
  const list = Object.values(countries.countries).sort(
    (a, b) => (b.wheat.imports_t ?? 0) - (a.wheat.imports_t ?? 0),
  );
  const [pick, setPick] = useState(list[0]?.iso3 ?? "");
  const chosen = countries.countries[pick];

  const priceColumns: Column<(typeof world.prices)[string]>[] = [
    { key: "name", head: "Price", render: (p) => p.plain_name },
    {
      key: "value",
      head: "Latest",
      numeric: true,
      render: (p) => `${p.latest_value} ${p.unit.replace("US$ per ", "$/")}`,
    },
    { key: "when", head: "Month", render: (p) => monthWords(p.latest_period) },
    {
      key: "change",
      head: "Against a year earlier",
      render: (p) => changeWords(p.change_over_year_pct),
    },
    {
      key: "reading",
      head: "Rate of change",
      render: (p) => (
        <Tag
          state={
            ["climbing", "climbing_fast"].includes(p.climb_reading.state)
              ? "watching"
              : "quiet"
          }
        >
          {p.climb_reading.words}
        </Tag>
      ),
    },
  ];

  return (
    <>
      <h1>How a wheat shock travels</h1>
      <p className="lede">
        Between a wheat field in one country and a loaf of bread in another
        there are seven links. A problem at one link does not automatically
        reach the next: it is absorbed, or it is passed on, depending on what
        sits in between. This page follows the links in order and says, at each
        one, what we are watching and what we are not.
      </p>

      <Notice plain title="How to read the labels. ">
        <p>
          A link marked <Tag state="watching">Something has moved</Tag> means one
          of the things we watch there is outside its usual range. It does not
          mean anything bad has happened. A link marked{" "}
          <Tag state="not_watched">Nothing is watching this</Tag> means we have
          no data for it at all — a gap in our coverage, never a statement that
          all is well there.
        </p>
      </Notice>

      <h2>Link one: what it costs to grow next year's crop</h2>
      <p>
        Fertilizer and fuel are bought months before anything is harvested. When
        they jump, the effect shows up in next year's harvest, not this week's
        bread. These are the world prices we follow, and how fast each is moving
        compared with how fast it usually moves.
      </p>

      <DataTable
        caption="World prices. The last column is about the rate of change, not the level: a price that has been high for two years is a known problem, a price climbing faster than usual is a new one."
        columns={priceColumns}
        rows={Object.values(world.prices)}
        rowKey={(p) => p.id}
      />
      <Source
        name="World Bank commodity price data"
        period={monthWords(world.prices.wheat_price?.latest_period)}
        note="World reference prices, not the price any particular buyer paid."
      />

      <Explain term="rising faster than it normally does">
        <p>
          We compare how much a price has changed over the past month and the
          past year against how much it usually changes over a month and a year,
          looking back fifteen years. A price can be high without moving, and it
          can be moving without being high. We report the movement, because that
          is what is new.
        </p>
        <p>
          The fifteen-year window is our choice, not a standard. It is long
          enough to include the 2010 and 2022 price episodes, so a repeat of
          those does not read as unprecedented. Change the window and some of
          these readings change with it.
        </p>
      </Explain>

      {world.prices.wheat_price ? (
        <LineChart
          title="World wheat price, last five years"
          unit="US dollars per tonne"
          points={world.prices.wheat_price.history}
          describe={`Line chart of the world wheat price over the last five years, ending at ${world.prices.wheat_price.latest_value} US dollars per tonne in ${monthWords(world.prices.wheat_price.latest_period)}.`}
        />
      ) : null}

      <h2>Link three: how much the big sellers have to sell</h2>
      <p>
        Most of the world's traded wheat comes from a handful of countries. What
        matters to a buyer is not the world total but whether the particular
        sellers it deals with had a good year and what they went into the year
        holding.
      </p>
      <DataTable
        caption={`The main wheat sellers in ${world.year}. "Held in store" is opening stocks measured against a month of that country's own wheat use.`}
        columns={[
          { key: "name", head: "Country", render: (e) => e.name },
          { key: "exports", head: "Sold abroad", numeric: true, render: (e) => tonnes(e.exports_t) },
          { key: "prod", head: "Grew", numeric: true, render: (e) => tonnes(e.production_t) },
          {
            key: "cover",
            head: "Held in store",
            numeric: true,
            render: (e) => months(e.stock_cover_months),
          },
          {
            key: "usual",
            head: "Harvest against recent years",
            render: (e) =>
              e.production_vs_usual.state === "outside_usual_range" ? (
                <Tag state="watching">
                  {e.production_vs_usual.direction === "lower" ? "Lower" : "Higher"} than
                  any of the last {e.production_vs_usual.years_compared} years
                </Tag>
              ) : e.production_vs_usual.state === "within_usual_range" ? (
                <Tag state="quiet">Within the usual range</Tag>
              ) : (
                <Tag state="no_data">Not enough history</Tag>
              ),
          },
        ]}
        rows={world.exporters}
        rowKey={(e) => e.iso3}
      />
      <Source name="FAO supply and utilisation accounts" period={String(world.year)} />

      <h2>The whole chain, for one country</h2>
      <p>
        Links one to four are about world markets, so they read the same for
        everybody. Links five to seven are about one country. Choose one.
      </p>
      <div className="toggle-row">
        <label htmlFor="chain-country">Show the chain for</label>
        <select id="chain-country" value={pick} onChange={(e) => setPick(e.target.value)}>
          {list.map((c) => (
            <option key={c.iso3} value={c.iso3}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {chosen ? (
        <>
          <p className="figure-note">
            {chosen.chain_summary.words} {chosen.chain_summary.coverage_words}
          </p>
          <Chain stages={chosen.chain} />
          <p>
            <a href={href("country", chosen.iso3)}>
              Everything we hold on {chosen.name} →
            </a>
          </p>
        </>
      ) : null}

      {pairs.pairs.length > 0 ? (
        <>
          <hr className="rule" />
          <h2>The same shock, two different outcomes</h2>
          <p>
            These pairs were picked from the figures, not chosen in advance. In
            each one, the two countries buy a similar share of their wheat from
            abroad, and differ clearly in what they hold in store. That is the
            comparison worth making: the disruption is the same, and what it
            lands on is not.
          </p>
          {pairs.pairs.map((pair) => (
            <div className="card" key={`${pair.a}-${pair.b}`} style={{ marginBottom: "1rem" }}>
              <h3 style={{ marginTop: 0 }}>
                <a href={href("country", pair.a)}>{countries.countries[pair.a]?.name}</a>{" "}
                and{" "}
                <a href={href("country", pair.b)}>{countries.countries[pair.b]?.name}</a>
              </h3>
              <p>
                <strong>What they share:</strong> {pair.shared}
              </p>
              <p>
                <strong>Where they differ:</strong> {pair.differs}
              </p>
              <p>
                <strong>So what:</strong> {pair.so_what}
              </p>
            </div>
          ))}
          <p className="figure-note">
            Stock cover is one buffer among several, and the one we can measure
            for most countries. Money to buy with, a working port, and room in
            the household budget all matter too, and this comparison does not
            weigh them.
          </p>
        </>
      ) : null}

      <hr className="rule" />
      <h2>What this page cannot tell you</h2>
      <p>
        It cannot tell you that a crisis is coming, or that one is not. It shows
        which links have something moving through them and which have nothing
        watching them at all. Two of the seven are in the second group. Reading
        a quiet chain as a safe one would be a mistake, and so would reading a
        moving one as a crisis. <a href={href("how")}>How this works</a> sets out
        what each figure is and is not.
      </p>
    </>
  );
}

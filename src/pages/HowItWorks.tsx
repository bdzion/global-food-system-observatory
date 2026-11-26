import type { Release } from "../lib/types";
import { ageWords, dateWords, monthWords } from "../lib/format";
import { Column, DataTable, Source, Tag } from "../components/ui";

export function HowItWorks({ release }: { release: Release }) {
  const { sources, manifest, countries, world } = release;

  const columns: Column<(typeof sources.sources)[number]>[] = [
    {
      key: "name",
      head: "What it tells us",
      render: (s) => (
        <>
          <strong>{s.plain_name ?? s.dataset}</strong>
          <br />
          <span className="figure-note">{s.provider}</span>
        </>
      ),
    },
    {
      key: "age",
      head: "Last changed by the publisher",
      render: (s) => (
        <>
          {s.provider_updated ? dateWords(s.provider_updated) : "not stated"}
          <br />
          <span className="figure-note">{ageWords(s.days_old)}</span>
        </>
      ),
    },
    {
      key: "state",
      head: "Freshness",
      render: (s) =>
        s.older_than_expected ? (
          <Tag state="watching">Older than we expect</Tag>
        ) : (
          <Tag state="quiet">As expected</Tag>
        ),
    },
    {
      key: "caveat",
      head: "What it does not tell us",
      render: (s) => s.caveat ?? "—",
    },
    {
      key: "licence",
      head: "Licence",
      render: (s) => (
        <a href={s.licence_url} target="_blank" rel="noreferrer">
          {s.licence.replace(" International", "")}
        </a>
      ),
    },
  ];

  return (
    <>
      <h2>What this site does, in one paragraph</h2>
      <p>
        Four times a day a program downloads the published figures listed below,
        checks them, and works out a small set of indicators: how much of its
        wheat each country buys from abroad, who it buys from, how much it holds
        in store, and how food prices are moving against prices in general. It
        then checks four assumptions behind the what-if test against the latest
        prices. If any check fails, nothing is published and the previous
        version of the site stays up. Nobody reviews the result before it goes
        out, and the site says so wherever that matters.
      </p>

      <h2>Where the figures come from</h2>
      <DataTable
        caption="Every source behind the figures on this site. A source marked older than we expect has not been updated as often as its publisher normally updates it — which may mean a delay at their end, or a problem at ours."
        columns={columns}
        rows={sources.sources}
        rowKey={(s) => s.id}
      />

      <h2>What this site does not do</h2>
      <ul>
        <li>
          <strong>It does not forecast.</strong> The what-if test is arithmetic
          on assumptions you set. It says nothing about what will happen.
        </li>
        <li>
          <strong>It does not rank countries by risk.</strong> A single score
          hides the thing that matters, which is <em>which</em> buffer is thin
          and <em>why</em>. Published composite food-security indexes have been
          shown to carry much less information than their single number implies.
        </li>
        <li>
          <strong>It does not estimate hunger.</strong> Trade exposure is not
          food insecurity. Turning one into the other needs evidence this site
          does not have.
        </li>
        <li>
          <strong>It cannot see whole links of the chain.</strong> Nothing here measures grain actually moving, or what a harvest will finally come to. The weather and crop-condition pages are the closest we get, and they are indirect.
        </li>
        <li>
          <strong>It is not current for most things.</strong> Prices and some weather data are monthly. Many trade, stock and diet figures are annual and arrive much later.
        </li>
      </ul>

      <details className="method-detail">
        <summary><h2>The arithmetic behind each figure</h2><span>Open this to check our working</span></summary>
      <h3>Share of wheat bought abroad</h3>
      <p>
        Imports divided by what the country has available to use, where
        available is what it grew, plus what it bought, minus what it sold on.
        A country at 100% grows none of its own wheat. Where a country sells on
        more than it grew and bought — a pure transit country — the figure is
        meaningless and we publish none.
      </p>

      <h3>Months held in store</h3>
      <p>
        Opening stocks divided by one month of the country's own wheat use.
        These stock figures are estimates made by the Food and Agriculture
        Organization, not counts. Very few countries publish what they actually
        hold, and a country can hold wheat it cannot release quickly.
      </p>

      <h3>Who a country buys from</h3>
      <p>
        Taken from the country's own report where it files one. Many of the most
        import-dependent countries do not, so for them we piece the picture
        together from what other countries said they sold there. That view only
        covers suppliers who report, so each country page says which basis is
        being used and what share of its known imports we can account for.
      </p>

      <h3>Whether a price is rising unusually fast</h3>
      <p>
        We compare the past month's and the past year's change against how much
        that price usually changes over a month and a year, looking back fifteen
        years, and weight the yearly view more heavily. The result is about the
        rate of change, not the level. The fifteen-year window and the weighting
        are our choices, not a standard, and we say so because changing them
        changes some readings. It is in the spirit of the food price anomaly
        indicator the Food and Agriculture Organization publishes, and it is not
        that indicator.
      </p>

      <h3>Food prices against prices in general</h3>
      <p>
        How much the food price index rose over twelve months, minus how much
        the general price index rose over the same twelve months, from the same
        source. A positive gap means food is taking more of the same wage. Where
        the two series do not share a recent month, we publish nothing.
      </p>

      </details>

      <details className="method-detail">
        <summary><h2>Which version of the figures you are looking at</h2><span>Open this to check what was published when</span></summary>
      <ul>
        <li>Release {manifest.release_id}, put together {dateWords(manifest.generated_at_utc)}.</li>
        <li>{manifest.coverage.countries_profiled} countries profiled, for {countries.year}.</li>
        <li>{manifest.coverage.price_series} world price series, to {monthWords(world.situation.as_of)}.</li>
        <li>
          {manifest.coverage.assumptions_checked} assumptions checked,{" "}
          {manifest.coverage.assumptions_broken} contradicted.
        </li>
      </ul>
      <p className="figure-note">
        Every file in a release carries a checksum in its manifest, and an
        earlier release is never mixed with a later one. If a source fails, the
        release does not go out and the previous one stays up, visibly labelled
        with its age.
      </p>

      </details>

      <h2>Who made this, and how to tell us it is wrong</h2>
      <p>
        Built by Dr. Md Bodrud-Doza at the Department of Geography, Environment
        and Geomatics, University of Guelph, as part of research on food-system
        resilience and anticipatory action. It is a research project, not an
        official warning system, and it has not been validated against a real
        disruption.
      </p>
      <p>
        Corrections are welcome and will be recorded with their date:{" "}
        <a href="mailto:mbodrudd@uoguelph.ca">mbodrudd@uoguelph.ca</a>. The code
        and the data releases are public at{" "}
        <a
          href="https://github.com/bdzion/global-food-system-observatory"
          target="_blank"
          rel="noreferrer"
        >
          github.com/bdzion/global-food-system-observatory
        </a>
        , so anyone can reproduce any figure on this site from the release files
        and the published method.
      </p>
      <Source
        name="FAO and World Bank data, used under Creative Commons Attribution 4.0"
        note="FAO and the World Bank are not responsible for anything on this site."
      />
    </>
  );
}

import type { Release } from "../lib/types";
import { monthWords, months, percent, people, tonnes } from "../lib/format";
import { href } from "../lib/router";
import { ShareBars } from "../components/charts";
import { Chain } from "../components/Chain";
import { Explain, Figure, Notice, Source, Tag } from "../components/ui";

const BASIS_WORDS: Record<string, string> = {
  reported_by_this_country:
    "This country reports its own wheat purchases, so this is its own account of who it buys from.",
  reconstructed_from_suppliers:
    "This country does not report its own wheat purchases. The breakdown below is pieced together from what other countries said they sold to it, so it covers only the suppliers who do report.",
  none_available:
    "Neither this country nor its suppliers report wheat trade in a form we can use, so we cannot say who it buys from.",
};

export function CountryPage({ release, iso }: { release: Release; iso: string }) {
  const country = release.countries.countries[iso];
  if (!country) {
    return (
      <>
        <h1>We have no profile for that country</h1>
        <p>
          This version covers countries that buy at least 300,000 tonnes of wheat
          a year. <a href={href("countries")}>See the list</a>.
        </p>
      </>
    );
  }

  const { wheat } = country;
  const brokenFor = release.ledger.assumptions.filter((a) =>
    a.broken_for?.some((b) => b.iso3 === iso),
  );

  return (
    <>
      <p className="figure-note">
        <a href={href("countries")}>← All countries</a>
      </p>
      <h1>{country.name}</h1>
      <p className="lede">{country.chain_summary.words}</p>

      <h2>Its wheat, in {wheat.year}</h2>
      <div className="grid cols-4">
        <Figure
          label="Grew"
          value={tonnes(wheat.production_t)}
          missingBecause="No production figure published."
        />
        <Figure
          label="Bought from abroad"
          value={tonnes(wheat.imports_t)}
          note={
            wheat.import_dependence_pct !== null
              ? `${percent(wheat.import_dependence_pct)} of all the wheat it had to use`
              : undefined
          }
        />
        <Figure
          label="Held in store at the start of the year"
          value={months(wheat.stock_cover_months)}
          note={
            wheat.stock_cover_months !== null
              ? "Measured as months of its own wheat use. An FAO estimate, not a count."
              : undefined
          }
          missingBecause={
            wheat.stock_note
              ? "We are not publishing this figure. See below."
              : "No stock estimate published for this country."
          }
        />
        <Figure
          label="Largest single supplier"
          value={
            wheat.top_supplier
              ? `${percent(wheat.top_supplier_share_pct)}`
              : "—"
          }
          note={
            wheat.top_supplier
              ? `${wheat.suppliers[0]?.name ?? wheat.top_supplier} supplies this share.`
              : undefined
          }
          missingBecause="No trade breakdown available for this country."
        />
      </div>
      <Source
        name="FAO supply and use accounts"
        period={String(wheat.year)}
        note="Published once a year, about a year after the period they cover."
      />

      {wheat.stock_note ? (
        <Notice title="Why there is no stock figure here. ">
          <p>{wheat.stock_note}</p>
          {wheat.previous_stock_cover_months !== null &&
          wheat.previous_stock_cover_months !== undefined ? (
            <p>
              For what it is worth, the previous year's figure worked out to
              about {months(wheat.previous_stock_cover_months)} of this country's
              own wheat use. We show it as background, not as this year's
              position.
            </p>
          ) : null}
        </Notice>
      ) : null}

      <h2>Who it buys from</h2>
      <p>{BASIS_WORDS[wheat.supplier_basis]}</p>
      {wheat.supplier_basis === "reconstructed_from_suppliers" &&
      wheat.supplier_coverage_pct !== null &&
      wheat.supplier_coverage_pct < 95 ? (
        <Notice title="How much of the picture this is. ">
          <p>
            The suppliers below account for about{" "}
            {percent(wheat.supplier_coverage_pct)} of the wheat this country is
            recorded as buying. The rest came from sellers who do not report
            their trade, so the shares below are shares of what we can see, not
            of everything it bought.
          </p>
        </Notice>
      ) : wheat.supplier_basis === "reconstructed_from_suppliers" &&
        wheat.supplier_coverage_pct !== null ? (
        <p className="figure-note">
          What these suppliers say they sold adds up to about{" "}
          {percent(wheat.supplier_coverage_pct)} of what this country is recorded
          as buying, so the picture looks close to complete.
        </p>
      ) : null}

      {wheat.suppliers.length > 0 ? (
        <>
          <ShareBars
            title="Share of this country's wheat, by supplier"
            caption={`Wheat suppliers to ${country.name}, ${wheat.year}.`}
            describe={`Bar chart showing that ${
              wheat.suppliers[0]?.name ?? wheat.top_supplier
            } supplies ${percent(wheat.top_supplier_share_pct)} of ${
              country.name
            }'s wheat, the largest share of ${wheat.suppliers.length} suppliers.`}
            rows={wheat.suppliers.slice(0, 8).map((s) => ({
              label: s.name ?? s.iso3,
              share: s.share_pct,
              detail: tonnes(s.quantity_t),
            }))}
          />

          <Explain term="concentration">
            <p>
              We publish a concentration index alongside the shares. It runs from
              near 0 to 1: close to 1 means almost everything comes from one
              seller, close to 0 means it is spread widely. For {country.name} it
              is {wheat.supplier_hhi?.toFixed(2) ?? "not available"}, across{" "}
              {wheat.suppliers_above_1pct ?? "an unknown number of"} suppliers of
              any size.
            </p>
            <p>
              A low number is not the same as safety. It says a country has
              several sellers on its books. It does not say those sellers have
              wheat spare in a bad year, that they are not themselves short, or
              that the buyer can afford what they are asking.
            </p>
          </Explain>
        </>
      ) : null}

      <h2>What it would cost households</h2>
      <div className="grid cols-3">
        <Figure
          label="Food prices against prices in general"
          value={
            country.price_gap
              ? `${country.price_gap.gap_pct_points > 0 ? "+" : ""}${country.price_gap.gap_pct_points} points`
              : "—"
          }
          note={
            country.price_gap
              ? `Food was ${country.price_gap.food_change_pct}% dearer than a year earlier, against ${country.price_gap.general_change_pct}% for everything else (${monthWords(country.price_gap.period)}).`
              : undefined
          }
          missingBecause="No recent consumer price figures for this country."
        />
        <Figure
          label="Could not afford a healthy diet"
          value={country.unaffordable ? percent(country.unaffordable.value, 1) : "—"}
          note={
            country.unaffordable
              ? `of the population, in ${country.unaffordable.year}`
              : undefined
          }
          missingBecause="Not published for this country."
        />
        <Figure
          label="Foreign currency reserves"
          value={country.reserve_cover ? months(country.reserve_cover.months) : "—"}
          note={
            country.reserve_cover
              ? `of its total import bill, ${country.reserve_cover.reserves_year}. A national figure, not a household one.`
              : undefined
          }
          missingBecause="Not published for this country."
        />
      </div>
      {country.population ? (
        <p className="figure-note">Population: {people(country.population)}.</p>
      ) : null}

      <h2>How a wheat shock would reach it</h2>
      <p>
        Seven links between a wheat field somewhere and a meal here. Each one
        says how far along the chain anything has actually moved — not how bad it
        is. {country.chain_summary.coverage_words}
      </p>
      <Chain stages={country.chain} />

      {brokenFor.length > 0 ? (
        <>
          <h2>Where our what-if test does not hold here</h2>
          <p>
            The what-if test rests on assumptions. For {country.name}, the
            published figures contradict{" "}
            {brokenFor.length === 1 ? "one of them" : `${brokenFor.length} of them`}.
          </p>
          {brokenFor.map((a) => (
            <div className="notice" key={a.id}>
              <p>
                <strong>{a.plain}</strong>{" "}
                <Tag state="watching">Does not hold here</Tag>
              </p>
              <p>{a.if_broken}</p>
            </div>
          ))}
          <p>
            <a href={href("assumptions")}>See every assumption and how it is checked</a>
          </p>
        </>
      ) : null}

      <hr className="rule" />
      <p>
        <a href={href("what-if", undefined, { country: iso })}>
          Run the what-if test for {country.name} →
        </a>
      </p>
    </>
  );
}

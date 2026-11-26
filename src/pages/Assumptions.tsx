import type { Release } from "../lib/types";
import { dateWords, monthWords, percent } from "../lib/format";
import { href } from "../lib/router";
import { Column, DataTable, Notice, Tag } from "../components/ui";

/* The page where the site checks itself.
 *
 * Most monitoring platforms publish forward-looking statements and leave the
 * reader to work out whether they still stand. This one wires each assumption
 * to a published figure and a number, and when the figure crosses the number
 * the statement is marked as needing another look. The point is not that the
 * machine knows better. It is that a statement nobody has revisited should not
 * sit on a page looking as confident as the day it was written. */

const STATE_WORDS: Record<string, { tag: string; label: string }> = {
  holding: { tag: "quiet", label: "Still holds" },
  broken: { tag: "watching", label: "Contradicted by the figures" },
  broken_somewhere: { tag: "watching", label: "Does not hold everywhere" },
  cannot_check: { tag: "no_data", label: "Cannot be checked" },
};

export function Assumptions({ release }: { release: Release }) {
  const { ledger, countries } = release;

  return (
    <>
      <h1>Our assumptions, and whether they still hold</h1>
      <p className="lede">
        The what-if test on this site rests on four assumptions. Each one is tied
        to a published figure and a number. When the figure crosses the number,
        the assumption is marked here, with the date and the reading that did it.
        Nothing is quietly recalculated behind the scenes.
      </p>

      <Notice plain title="Why bother. ">
        <p>
          A forecast that nobody revisits is the commonest way a monitoring site
          misleads people. It keeps saying what it said six months ago, in the
          same confident type, long after the ground has moved. This page is the
          attempt to make that impossible here. It is also the honest answer to
          "how would I know if this site were wrong?"
        </p>
      </Notice>

      <div className="grid cols-3">
        <div className="card">
          <div className="figure-label">Assumptions checked</div>
          <div className="figure-value">{ledger.assumptions.length}</div>
        </div>
        <div className="card">
          <div className="figure-label">Still holding</div>
          <div className="figure-value">{ledger.holding_count}</div>
        </div>
        <div className="card">
          <div className="figure-label">Contradicted</div>
          <div className="figure-value">{ledger.broken_count}</div>
        </div>
      </div>

      <p style={{ marginTop: "1.25rem" }}>
        <strong>Where that leaves the test:</strong> {ledger.verdict}
      </p>
      <p className="figure-note">
        Last checked against the figures on {dateWords(ledger.checked_at)}.
      </p>

      {ledger.assumptions.map((a) => {
        const words = STATE_WORDS[a.state] ?? STATE_WORDS.cannot_check;
        const columns: Column<NonNullable<typeof a.broken_for>[number]>[] = [
          {
            key: "name",
            head: "Country",
            render: (b) => <a href={href("country", b.iso3)}>{b.name}</a>,
          },
          {
            key: "reading",
            head: "Reading",
            numeric: true,
            render: (b) => percent(b.reading, 1),
          },
        ];
        return (
          <section key={a.id} style={{ marginTop: "2rem" }}>
            <h2 style={{ marginBottom: "0.4rem" }}>
              {a.plain} <Tag state={words.tag}>{words.label}</Tag>
            </h2>
            <p>
              <strong>Why it matters:</strong> {a.why_it_matters}
            </p>
            <p>
              <strong>What we check it against:</strong>{" "}
              {a.scope === "world"
                ? `${a.watches_name ?? a.watches}, world figures. We call it contradicted when its rate of change passes ${a.threshold}.`
                : `each country's own figures. We call it contradicted for a country when the reading passes ${a.threshold}.`}
            </p>
            {a.reading ? (
              <p>
                <strong>What the figures say now:</strong> {a.reading}
                {a.as_of ? ` (${monthWords(a.as_of)})` : ""}
              </p>
            ) : null}
            {a.state !== "holding" ? (
              <p>
                <strong>If it does not hold:</strong> {a.if_broken}
              </p>
            ) : null}
            {a.broken_for && a.broken_for.length > 0 ? (
              <>
                <p>
                  It does not hold for {a.broken_for.length}{" "}
                  {a.broken_for.length === 1 ? "country" : "countries"} out of the{" "}
                  {Object.keys(countries.countries).length} we cover.
                </p>
                <DataTable
                  caption="Countries where the published figures contradict this assumption, largest reading first."
                  columns={columns}
                  rows={a.broken_for.slice(0, 20)}
                  rowKey={(b) => b.iso3}
                />
                {a.broken_for.length > 20 ? (
                  <p className="figure-note">
                    Showing the first 20 of {a.broken_for.length}.
                  </p>
                ) : null}
              </>
            ) : null}
          </section>
        );
      })}

      <hr className="rule" />
      <h2>What this page is not</h2>
      <p>
        A broken assumption does not mean something has gone wrong in the world.
        It means one thing the test took for granted is no longer supported by
        the figures, so the test's results should be read with that in mind — or
        reworked. Deciding which of those is right needs a person, and that
        person has not looked at this release.
      </p>
      <p>
        The thresholds on this page are ours. Nobody has validated them against
        a real disruption, because the site has not lived through one yet. When
        it has, the record of what we said and when should be the first thing
        anyone checks.
      </p>
    </>
  );
}

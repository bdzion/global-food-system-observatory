import { useMemo, useState } from "react";
import type { Release } from "../lib/types";
import { months as monthsWords, percent, tonnes } from "../lib/format";
import { href } from "../lib/router";
import { Column, DataTable, Explain, Figure, Notice, Tag } from "../components/ui";

/* The what-if test.
 *
 * All of the arithmetic is in this file, it runs in the reader's browser, and
 * the page shows every step of it. That is deliberate. A calculation a reader
 * cannot follow is a calculation they have to take on trust, and this site has
 * not earned that: it has never been validated against a real disruption.
 *
 * What the test does NOT do matters as much. It does not predict prices, and
 * it does not predict hunger. It works out how much wheat a country would have
 * to find somewhere else, sets that against the time it has in store, and then
 * names the other countries that would be looking for the same wheat. */

export function WhatIf({ release, preselect }: { release: Release; preselect?: string }) {
  const { countries, scenario, ledger } = release;
  const list = Object.values(countries.countries)
    .filter((c) => c.wheat.suppliers.length > 0 && c.wheat.imports_t)
    .sort((a, b) => (b.wheat.imports_t ?? 0) - (a.wheat.imports_t ?? 0));

  const [iso, setIso] = useState(
    preselect && countries.countries[preselect] ? preselect : list[0]?.iso3 ?? "",
  );
  const country = countries.countries[iso];
  const suppliers = country?.wheat.suppliers ?? [];
  const [supplierIso, setSupplierIso] = useState(suppliers[0]?.iso3 ?? "");
  const supplier =
    suppliers.find((s) => s.iso3 === supplierIso) ?? suppliers[0] ?? null;

  const [interruption, setInterruption] = useState(30);
  const [duration, setDuration] = useState(6);
  const [replaceable, setReplaceable] = useState(40);
  const [delay, setDelay] = useState(2);

  const sums = useMemo(() => {
    if (!country || !supplier) return null;
    const imports = country.wheat.imports_t ?? 0;
    const share = supplier.share_pct / 100;
    const stopped = interruption / 100;
    const part = duration / 12;
    const replaceShare = replaceable / 100;

    const gap = imports * share * stopped * part;
    const actNow = gap * (1 - replaceShare);
    const held = delay / duration;
    const actLate = gap * held + gap * (1 - held) * (1 - replaceShare);
    const avoidable = actLate - actNow;

    const monthlyUse = (country.wheat.available_t ?? 0) / 12;
    const monthsOfStock = country.wheat.stock_cover_months;
    const stockEatenNow = monthlyUse > 0 ? actNow / monthlyUse : null;
    const stockEatenLate = monthlyUse > 0 ? actLate / monthlyUse : null;

    return {
      imports,
      gap,
      actNow,
      actLate,
      avoidable,
      monthlyUse,
      monthsOfStock,
      stockEatenNow,
      stockEatenLate,
    };
  }, [country, supplier, interruption, duration, replaceable, delay]);

  const alsoBuy = (supplier &&
    scenario.displacement.by_supplier[supplier.iso3]?.filter((b) => b.iso3 !== iso)) ??
    [];

  const brokenHere = ledger.assumptions.filter(
    (a) => a.state === "broken" || a.broken_for?.some((b) => b.iso3 === iso),
  );

  const displacementColumns: Column<(typeof alsoBuy)[number]>[] = [
    {
      key: "name",
      head: "Also buys from this supplier",
      render: (b) => <a href={href("country", b.iso3)}>{b.name}</a>,
    },
    {
      key: "share",
      head: "Share of their wheat",
      numeric: true,
      render: (b) => percent(b.share_of_their_wheat_pct, 1),
    },
    {
      key: "dep",
      head: "Share they buy abroad",
      numeric: true,
      render: (b) => percent(b.import_dependence_pct),
    },
    {
      key: "cover",
      head: "They hold in store",
      numeric: true,
      render: (b) => monthsWords(b.stock_cover_months),
    },
    {
      key: "afford",
      head: "Cannot afford a healthy diet",
      numeric: true,
      render: (b) =>
        b.unaffordable_pct === null ? "—" : percent(b.unaffordable_pct, 1),
    },
  ];

  return (
    <>
      <h1>What if a big wheat seller stopped shipping?</h1>
      <p className="lede">{scenario.plain_question}</p>

      <Notice title="Read this before the numbers. ">
        <p>{scenario.what_this_is}</p>
        <p>{scenario.what_this_is_not}</p>
      </Notice>

      <h2>Describe the interruption</h2>
      <div className="grid cols-2">
        <div>
          <label className="field">
            <span className="field-label">Which buyer</span>
            <select value={iso} onChange={(e) => {
              setIso(e.target.value);
              const next = countries.countries[e.target.value];
              setSupplierIso(next?.wheat.suppliers[0]?.iso3 ?? "");
            }}>
              {list.map((c) => (
                <option key={c.iso3} value={c.iso3}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Which of its suppliers is interrupted</span>
            <select value={supplier?.iso3 ?? ""} onChange={(e) => setSupplierIso(e.target.value)}>
              {suppliers.slice(0, 10).map((s) => (
                <option key={s.iso3} value={s.iso3}>
                  {s.name ?? s.iso3} — {percent(s.share_pct, 1)} of its wheat
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label className="field">
            <span className="field-label">
              How much of that supplier's shipments stop:{" "}
              <span className="field-value">{interruption}%</span>
            </span>
            <span className="field-note">A round starting number, not an estimate of any real event.</span>
            <input type="range" min={0} max={100} step={5} value={interruption}
              onChange={(e) => setInterruption(Number(e.target.value))} />
          </label>

          <label className="field">
            <span className="field-label">
              For how long: <span className="field-value">{duration} months</span>
            </span>
            <input type="range" min={1} max={12} step={1} value={duration}
              onChange={(e) => {
                const next = Number(e.target.value);
                setDuration(next);
                if (delay > next - 1) setDelay(Math.max(0, next - 1));
              }} />
          </label>

          <label className="field">
            <span className="field-label">
              How much of the gap can be bought elsewhere:{" "}
              <span className="field-value">{replaceable}%</span>
            </span>
            <span className="field-note">
              Depends on whether other sellers have wheat spare, whether this
              buyer can pay for it, and whether it can be shipped in time.
            </span>
            <input type="range" min={0} max={100} step={5} value={replaceable}
              onChange={(e) => setReplaceable(Number(e.target.value))} />
          </label>

          <label className="field">
            <span className="field-label">
              Months before anyone acts: <span className="field-value">{delay}</span>
            </span>
            <span className="field-note">
              Nothing is replaced during these months. This is the cost of waiting.
            </span>
            <input type="range" min={0} max={Math.max(0, duration - 1)} step={1} value={delay}
              onChange={(e) => setDelay(Number(e.target.value))} />
          </label>
        </div>
      </div>

      {country && supplier && sums ? (
        <>
          <h2>What it works out to</h2>
          <div className="grid cols-3">
            <Figure
              label="Wheat that would need replacing"
              value={tonnes(sums.gap)}
              note={`over ${duration} months`}
            />
            <Figure
              label="Still short, if they act straight away"
              value={tonnes(sums.actNow)}
              note={
                sums.stockEatenNow !== null && sums.monthsOfStock !== null
                  ? `About ${sums.stockEatenNow.toFixed(1)} months of this country's wheat use, against the ${sums.monthsOfStock.toFixed(1)} months it holds in store.`
                  : undefined
              }
            />
            <Figure
              label={`Still short, if they wait ${delay} month${delay === 1 ? "" : "s"}`}
              value={tonnes(sums.actLate)}
              note={
                sums.avoidable > 0
                  ? `Waiting adds ${tonnes(sums.avoidable)}. That is the part that was avoidable.`
                  : "No delay set, so nothing is added."
              }
            />
          </div>

          <Explain summary="Show me how this was worked out, step by step">
            <p>Every step, in order, using {country.name} and {supplier.name ?? supplier.iso3}:</p>
            <ol>
              <li>
                {country.name} bought {tonnes(sums.imports)} of wheat in{" "}
                {country.wheat.year}.
              </li>
              <li>
                {percent(supplier.share_pct, 1)} of it came from{" "}
                {supplier.name ?? supplier.iso3}, which is {tonnes(sums.imports * supplier.share_pct / 100)}.
              </li>
              <li>
                {interruption}% of that stops, for {duration} of 12 months:{" "}
                {tonnes(sums.gap)} to replace.
              </li>
              <li>
                {replaceable}% is bought elsewhere, leaving {tonnes(sums.actNow)} short.
              </li>
              <li>
                Waiting {delay} month{delay === 1 ? "" : "s"} means replacing nothing
                for {delay === 1 ? "that month" : "those months"}, so the shortfall
                is {tonnes(sums.actLate)} instead.
              </li>
            </ol>
            <p>
              The trade and stock figures are real and are from {country.wheat.year}.
              The three percentages are yours. Nothing here estimates a price, a
              shortage on a shelf, or an effect on anybody's diet.
            </p>
          </Explain>

          <h2>Who else would be looking for the same wheat</h2>
          <p>{scenario.displacement.explain}</p>
          {alsoBuy.length > 0 ? (
            <>
              <DataTable
                caption={`Other countries that buy wheat from ${supplier.name ?? supplier.iso3}, largest first. Thin stocks and a high share unable to afford a healthy diet mean less room to absorb a bidding contest.`}
                columns={displacementColumns}
                rows={alsoBuy.slice(0, scenario.displacement.show_top)}
                rowKey={(b) => b.iso3}
              />
              <p className="figure-note">
                This is not a prediction that these countries would lose out. It
                is a note that advice to one buyer is competition for another,
                and that the site should say so rather than leave it out.
              </p>
            </>
          ) : (
            <p className="missing">
              <em>
                We have no record of other countries buying wheat from{" "}
                {supplier.name ?? supplier.iso3} in a form we can use. That is a
                gap in the trade data, not evidence that nobody else does.
              </em>
            </p>
          )}

          {brokenHere.length > 0 ? (
            <>
              <h2>What the figures say about these assumptions</h2>
              <p>
                This test rests on {ledger.assumptions.length} assumptions. The
                latest figures contradict{" "}
                {brokenHere.length === 1 ? "one of them" : `${brokenHere.length} of them`}{" "}
                here.
              </p>
              {brokenHere.map((a) => (
                <div className="notice" key={a.id}>
                  <p>
                    <strong>{a.plain}</strong> <Tag state="watching">Does not hold</Tag>
                  </p>
                  {a.reading ? <p>{a.reading}</p> : null}
                  <p>{a.if_broken}</p>
                </div>
              ))}
              <p>
                <a href={href("assumptions")}>
                  How every assumption is checked, and when it last changed →
                </a>
              </p>
            </>
          ) : (
            <Notice plain title="The assumptions still hold. ">
              <p>
                Nothing in the latest figures contradicts the assumptions this
                test rests on for {country.name}. That does not make the result
                right. It means nothing we watch has contradicted it.{" "}
                <a href={href("assumptions")}>See the assumptions</a>.
              </p>
            </Notice>
          )}
        </>
      ) : (
        <p className="missing">
          <em>
            We do not hold a supplier breakdown for that country, so the test
            cannot run for it.
          </em>
        </p>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { href, type Route } from "../lib/router";
import { hasFile, readVerified } from "../lib/data";
import { priceSignals } from "../lib/commodities";
import type { Release } from "../lib/types";

/* The front door.
 *
 * Everything else on this site answers a particular question well and assumes
 * you already know which question you have. Someone arriving for the first
 * time does not, so this page does three things in order: says what the site
 * is, shows what is actually happening at the moment, and gives a reason to
 * open each of the other pages.
 *
 * The numbers here are live, which is the point. A front page of static
 * description is a table of contents, and a reader who has to click four times
 * to find out whether anything is moving will not click four times. Each
 * figure also links to the page where it can be followed up, so the overview
 * is a route into the site rather than a summary of it. */

const STAGES = ["Inputs", "Farms", "Storage", "Trade", "Markets"];

interface ReportsPayload {
  count: number;
  countries_covered: number;
  reports: { published: string | null; publisher: string | null }[];
}

export function Overview({ release, route }: { release: Release; route: Route }) {
  const [reports, setReports] = useState<ReportsPayload | null>(null);

  useEffect(() => {
    if (!hasFile(release.manifest, "reports.json")) return;
    let stop = false;
    readVerified<ReportsPayload>(release.manifest, "reports.json")
      .then(v => { if (!stop) setReports(v); })
      .catch(() => { /* The overview still works without it. */ });
    return () => { stop = true; };
  }, [release.manifest]);

  const to = (page: string) =>
    href(page, undefined, {
      commodity: route.query.get("commodity") || "all",
      geo: route.query.get("geo") || "global",
    });

  const { current, moving } = priceSignals(release.world.prices);

  const wheat = Object.values(release.countries?.countries ?? {})
    .map((r: any) => r.wheat)
    .filter(Boolean);
  const withWheat = wheat.length;
  const oneSupplier = wheat.filter((w: any) => (w.top_supplier_share_pct ?? 0) >= 50).length;
  const tradeYear = wheat[0]?.year ?? null;

  const coverage = release.manifest.coverage as unknown as Record<string, number | undefined>;
  const foods = coverage.product_forms;
  const countries = coverage.countries_profiled;

  // "This week" is counted from the reports themselves, not from when the
  // release was built, so a stalled feed shows as a small number rather than
  // quietly reporting last month's news as current.
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const thisWeek = reports?.reports.filter(r => (r.published ?? "") >= weekAgo).length ?? null;
  const publishers = reports
    ? new Set(reports.reports.map(r => r.publisher).filter(Boolean)).size
    : null;

  return (
    <section className="reader-guide">
      <h1>Overview</h1>
      <p className="reader-headline">
        A food shortage can begin far from the people who feel it.
      </p>
      <p className="lede">
        This site brings together published figures on who buys food from whom,
        what it costs, and what would happen if a supplier stopped. It is built
        for officials who have to form a view quickly and show their working
        afterwards.
      </p>
      <p>
        Nothing here is an alert and nothing here is a forecast. It is a
        research tool: it shows what the published figures say, and where they
        stop.
      </p>

      <h2>Where things stand today</h2>
      <div className="reader-counts overview-strip">
        <article>
          <strong>{moving.length} of {current.length}</strong>
          <span>
            international prices we follow have moved more than they usually
            do.{" "}
            <a href={to("watch")}>See which, and by how much</a>
          </span>
        </article>
        <article>
          <strong>{thisWeek ?? "—"}</strong>
          <span>
            {thisWeek === null
              ? "reports from other organisations are not in this snapshot."
              : <>reports filed in the last seven days by {publishers} organisations, including FEWS NET, the IPC, FAO and WFP. <a href={to("watch")}>Read what they published</a></>}
          </span>
        </article>
        <article>
          <strong>{oneSupplier} of {withWheat}</strong>
          <span>
            countries with wheat figures here get at least half their wheat
            from one supplier.{" "}
            <a href={to("commodities")}>See who depends on whom</a>
          </span>
        </article>
        <article>
          <strong>{tradeYear ?? "—"}</strong>
          <span>
            is the most recent year with complete trade figures, so the
            structural picture is already a year or more old.{" "}
            <a href={href("how")}>Why, and what we do about it</a>
          </span>
        </article>
      </div>
      <p className="figure-note">
        A price moving unusually is not a shortage, and a country buying from
        one supplier is not in trouble. Both are reasons to look closer, which
        is what the rest of this site is for.
      </p>

      <h2>How food reaches people</h2>
      <p>
        Food reaches households through a chain of farms, suppliers,
        processors, transport companies and retailers. Trouble can start at any
        link, a long way from the people who feel it.
      </p>
      <ol className="stage-band" aria-label="The five stages food moves through">
        {STAGES.map((name, i) => (
          <li key={name}>
            <span className="stage-band-n">{i + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      <p>
        <a className="reader-next" href={to("system")}>
          See the whole chain, and what we cannot watch →
        </a>
      </p>

      <h2>What you can do here</h2>
      <div className="reader-steps">
        {[
          ["01", "The system", "system",
            "How food moves from inputs to households, and which links nobody is watching.",
            "Five stages"],
          ["02", "The indicators", "commodities",
            "Where a country gets its food, how much comes from one supplier, and what it holds in store.",
            `${foods ?? "—"} foods · ${countries ?? "—"} countries`],
          ["03", "The threats", "watch",
            "What has changed recently in prices, weather and hazards, and what other organisations are reporting.",
            `${moving.length} prices moving · ${reports?.count ?? "—"} reports`],
          ["04", "Possible timelines", "stress",
            "If a supplier stopped, how long the stocks would last and what acting early would be worth.",
            `Any of ${countries ?? "—"} countries`],
        ].map(([n, title, page, desc, meta]) => (
          <article className="source-tile" key={page}>
            <span className="step-number">{n}</span>
            <h3><a href={to(page)}>{title}</a></h3>
            <p>{desc}</p>
            <p className="figure-note">{meta}</p>
          </article>
        ))}
      </div>
      <p className="figure-note">
        Two more pages sit behind these: <a href={to("briefs")}>country briefs</a>,
        which pull everything about one country and food onto a page you can
        share, and <a href={href("how")}>sources and methods</a>, which says
        where every figure comes from and what it cannot tell you.
      </p>

      <h2>Start with an example</h2>
      <p>
        Suppose you are asked about rice supplies in Bangladesh. Start with{" "}
        <a href={href("commodities", undefined, { commodity: "rice", geo: "BGD" })}>
          where the country gets its rice
        </a>
        , then check{" "}
        <a href={href("watch", undefined, { commodity: "rice", geo: "BGD" })}>
          prices, weather and what others are reporting
        </a>
        . Finally, try{" "}
        <a href={href("stress", undefined, { commodity: "rice", geo: "BGD" })}>
          a possible interruption
        </a>
        . This is a walkthrough of the site, not a claim that anything is
        happening in Bangladesh.
      </p>

      <h2>Before you rely on this</h2>
      <p>
        The trade and production figures describe standing dependencies, not
        today's supply. Prices and weather observations are more current but
        narrower. Every figure carries its own date, and where a reliable
        figure does not exist we say so rather than filling the gap.
      </p>
      <p>
        This site is one of several, and for some questions it is the wrong
        one. It works out who depends on whom and what an interruption would
        mean arithmetically. It does not assess hunger, forecast harvests, or
        tell you what is happening in a particular place this week.{" "}
        <a href={href("how")}>
          See what else to look at, and when this site is the wrong tool
        </a>
        .
      </p>
      <p>
        <a className="reader-next" href={to("system")}>Next: The system →</a>{" "}
        <a href="https://bdzion.github.io/canada-food-system-observatory/#/">
          Canada Food System Observatory
        </a>
      </p>
    </section>
  );
}

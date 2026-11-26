import { useEffect, useState } from "react";
import type { Release } from "../lib/types";
import { hasFile, readVerified } from "../lib/data";
import { ageWords, dateWords } from "../lib/format";

/* What other organisations are reporting now.
 *
 * Everything else on this site measures structure, and the trade figures
 * behind it are a year or more old. This panel answers the different question
 * a reader actually arrives with — is something happening at the moment — by
 * pointing at the organisations whose job that is.
 *
 * It shows titles and links, never the reports themselves. That is partly a
 * licence matter and partly an honest one: these are other people's
 * assessments, and a reader weighing them should read them where they were
 * published, with whatever caveats the publisher attached. */

interface Report {
  title: string;
  url: string;
  published: string | null;
  publisher: string | null;
  countries: string[];
  iso3: string[];
  themes: string[];
  kind: "early_warning" | "agency" | "general" | "hazard";
  forward_looking: boolean;
}

interface Payload {
  available: boolean;
  fetched_at: string;
  newest_published: string | null;
  age_days: number | null;
  stale_after_days: number;
  source: { provider: string; dataset: string; documentation_url: string; note: string };
  queries_run: number;
  queries_failed: string[];
  count: number;
  countries_covered: number;
  country_index: Record<string, string[]>;
  reports: Report[];
}

const FILE = "reports.json";

/** Named early-warning products a decision-maker is likely to be asked about. */
const PROMINENT: Report["kind"][] = ["early_warning", "agency"];

export function ReportStream({
  release,
  geo,
  countryName,
  limit = 8,
}: {
  release: Release;
  geo?: string;
  countryName?: string;
  limit?: number;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!hasFile(release.manifest, FILE)) return;
    let stop = false;
    readVerified<Payload>(release.manifest, FILE)
      .then((v) => { if (!stop) setData(v); })
      .catch((e) => { if (!stop) setError(String(e)); });
    return () => { stop = true; };
  }, [release.manifest]);

  const forCountry = Boolean(geo && geo !== "global");
  const heading = forCountry
    ? `What others are reporting about ${countryName || "this country"}`
    : "What others are reporting this week";

  if (!data) {
    return (
      <section className="visual-panel">
        <h2>{heading}</h2>
        <p>
          {error
            ? "These reports could not be loaded: " + error
            : hasFile(release.manifest, FILE)
              ? "Loading reports…"
              : "This snapshot was published before this panel existed, so it carries no reports."}
        </p>
      </section>
    );
  }

  const stale = data.age_days !== null && data.age_days > data.stale_after_days;
  const all = forCountry
    ? data.reports.filter((r) => r.iso3.includes(geo as string))
    : data.reports;

  // Put the named early-warning products first when nothing is filtered, since
  // those are the ones a reader is most likely to be asked about by name.
  const ordered = forCountry
    ? all
    : [...all].sort((a, b) => {
        const rank = (r: Report) => (PROMINENT.includes(r.kind) ? 0 : 1);
        return rank(a) - rank(b);
      });
  const shown = showAll ? ordered : ordered.slice(0, limit);

  return (
    <section className="visual-panel">
      <h2>{heading}</h2>
      <p>
        These are assessments published by other organisations, not by us. We
        list the title and link to the original; we do not reproduce the
        reports. A report appearing here is not a warning, and nothing
        appearing here is not reassurance.
      </p>

      {data.queries_failed.length > 0 && (
        <p className="figure-note">
          {data.queries_failed.length} of {data.queries_run} searches did not
          return when this snapshot was built, so this list may be shorter than
          usual.
        </p>
      )}

      {ordered.length === 0 ? (
        <p className="reader-explainer">
          {forCountry
            ? `Nothing about ${countryName || "this country"} appeared in the food and agriculture reports we searched when this snapshot was built. That means no organisation filed one under this country in that window, which is not the same as nothing happening.`
            : "No reports came back when this snapshot was built."}
        </p>
      ) : (
        <>
          <ol className="report-stream">
            {shown.map((r) => (
              <li key={r.url}>
                <p className="report-meta">
                  <time dateTime={r.published || undefined}>
                    {dateWords(r.published)}
                  </time>
                  {r.publisher ? <span> · {r.publisher}</span> : null}
                  {r.forward_looking ? (
                    <span className="report-flag">Looks ahead</span>
                  ) : null}
                </p>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.title}
                  <span className="sr-only"> (opens on ReliefWeb)</span>
                </a>
                {r.countries.length > 0 && (
                  <p className="report-tags">{r.countries.join(" · ")}</p>
                )}
              </li>
            ))}
          </ol>
          {ordered.length > shown.length && (
            <p>
              <button type="button" className="reader-next" onClick={() => setShowAll(true)}>
                Show the other {ordered.length - shown.length} →
              </button>
            </p>
          )}
        </>
      )}

      <p className="figure-note">
        Collected from {data.source.provider}&apos;s {data.source.dataset}, which
        carries the published output of several thousand organisations,
        including the Famine Early Warning Systems Network, the Integrated Food
        Security Phase Classification, FAO and the World Food Programme.
        Searched for food and agriculture reports only.{" "}
        {data.newest_published
          ? `Newest report ${dateWords(data.newest_published)}, ${ageWords(data.age_days)}.`
          : ""}{" "}
        {stale
          ? "That is older than this feed usually runs, which may mean the feed rather than the food system has gone quiet."
          : ""}
      </p>
    </section>
  );
}

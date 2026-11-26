/* The seven links between a field somewhere and a meal somewhere else.
 *
 * The thing this component must never do is let a link we are not watching
 * look like a link where nothing is happening. They are drawn differently, the
 * words are different, and the unwatched ones say in full why nobody is
 * watching them. A site that quietly shows silence as calm is worse than no
 * site at all, because it tells a reader they have checked when they have not. */

import type { Stage } from "../lib/types";
import { Tag } from "./ui";

export function Chain({ stages }: { stages: Stage[] }) {
  return (
    <ol className="chain">
      {stages.map((stage) => {
        const moved = stage.state === "watching";
        const watching = stage.state !== "not_watched";
        return (
          <li key={stage.id}>
            <div
              className={`chain-step ${moved ? "on" : ""} ${watching ? "" : "off"}`}
              aria-hidden="true"
            >
              {stage.order}
            </div>
            <div className="chain-body">
              <h3>
                {stage.label}{" "}
                <Tag state={stage.state}>{stage.state_label}</Tag>
              </h3>
              <p>{stage.what_it_means}</p>

              {stage.state === "not_watched" ? (
                <p className="missing">
                  <strong>Why nothing is watching this:</strong> {stage.because}
                </p>
              ) : null}

              {stage.state === "no_data" ? (
                <p className="missing">
                  We have no current figures for this country at this link, so we
                  cannot say whether anything has moved.
                </p>
              ) : null}

              {stage.findings.map((finding, index) => (
                <p
                  key={`${stage.id}-${index}`}
                  className={`chain-finding ${finding.fired ? "fired" : ""}`}
                >
                  <strong>{finding.fired ? "Moved: " : "Checked: "}</strong>
                  {finding.reading}
                  {finding.fired ? <> — {finding.why}</> : null}
                  {finding.source_note ? (
                    <>
                      {" "}
                      <span className="missing">{finding.source_note}</span>
                    </>
                  ) : null}
                </p>
              ))}

              {stage.clock_warning ? (
                <p className="figure-note">
                  <strong>How old these figures are:</strong> {stage.clock_warning}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

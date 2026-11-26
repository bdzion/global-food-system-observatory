/* Shared pieces.
 *
 * Two conventions hold across all of them. Nothing shows a number without the
 * unit, the period and where it came from. And every state is a word before it
 * is a colour, so the page survives being printed, read aloud or viewed by
 * somebody who does not see the difference between amber and grey. */

import type { ReactNode } from "react";
import { NOT_AVAILABLE } from "../lib/format";

/** The plain-words panel. Used wherever the site has to use a term at all.
 *
 * Folded away rather than inline, because a reader who already knows what a
 * term means should not have to wade through an explanation of it, and a
 * reader who does not should never have to go and look it up elsewhere. */
export function Explain({
  term,
  summary,
  children,
}: {
  term?: string;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className="explain">
      <summary>{summary ?? `What does "${term}" mean?`}</summary>
      {children}
    </details>
  );
}

export function Figure({
  label,
  value,
  note,
  missingBecause,
}: {
  label: string;
  value: string;
  note?: ReactNode;
  missingBecause?: string;
}) {
  const missing = value === NOT_AVAILABLE;
  return (
    <div className="card">
      <div className="figure-label">{label}</div>
      <div className="figure-value" style={missing ? { color: "var(--unknown)" } : undefined}>
        {value}
      </div>
      {missing && missingBecause ? (
        <div className="figure-note">{missingBecause}</div>
      ) : null}
      {note ? <div className="figure-note">{note}</div> : null}
    </div>
  );
}

export function Tag({ state, children }: { state: string; children: ReactNode }) {
  return <span className={`tag tag-${state}`}>{children}</span>;
}

export function Notice({
  children,
  plain = false,
  title,
}: {
  children: ReactNode;
  plain?: boolean;
  title?: string;
}) {
  return (
    <aside className={plain ? "notice plain" : "notice"}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </aside>
  );
}

export interface Column<T> {
  key: string;
  head: string;
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty = "Nothing to show here.",
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="missing">
        <em>{empty}</em>
      </p>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.numeric ? "num" : undefined}>
                {column.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? "num" : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where a figure came from, said in one line under it. */
export function Source({
  name,
  period,
  note,
}: {
  name: string;
  period?: string;
  note?: string;
}) {
  return (
    <p className="figure-note">
      Source: {name}
      {period ? `, ${period}` : ""}.{note ? ` ${note}` : ""}
    </p>
  );
}

/** A number the site cannot give, said plainly rather than left blank. */
export function Unknown({ because }: { because: string }) {
  return (
    <span className="missing">
      {NOT_AVAILABLE} <span className="sr-only">not available: </span>
      <small>{because}</small>
    </span>
  );
}

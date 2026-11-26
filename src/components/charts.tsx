/* Charts, each with a table beside it.
 *
 * Every chart here can be switched to the table it was drawn from. That is not
 * only an accessibility requirement — though it is that, and the site would
 * fail its own standard without it. It is also how a reader checks a claim.
 * A line that appears to be climbing steeply is an argument; the numbers under
 * it are evidence, and the reader is entitled to both.
 *
 * The charts are plain SVG. No chart library is loaded, because a sparkline
 * is not worth 300 kB to somebody on a slow connection. */

import { useId, useState } from "react";
import { monthWords, NOT_AVAILABLE } from "../lib/format";
import { Column, DataTable } from "./ui";

function ViewSwitch({
  showing,
  onChange,
  labelledBy,
}: {
  showing: "chart" | "table";
  onChange: (next: "chart" | "table") => void;
  labelledBy: string;
}) {
  return (
    <div className="toggle-row" role="group" aria-labelledby={labelledBy}>
      <button
        type="button"
        aria-pressed={showing === "chart"}
        onClick={() => onChange("chart")}
      >
        Chart
      </button>
      <button
        type="button"
        aria-pressed={showing === "table"}
        onClick={() => onChange("table")}
      >
        Numbers
      </button>
    </div>
  );
}

export function LineChart({
  title,
  unit,
  points,
  describe,
}: {
  title: string;
  unit: string;
  points: { period: string; value: number }[];
  describe: string;
}) {
  const [showing, setShowing] = useState<"chart" | "table">("chart");
  const id = useId();

  if (points.length < 2) {
    return (
      <p className="missing">
        <em>Not enough figures to draw {title.toLowerCase()}.</em>
      </p>
    );
  }

  const width = 640;
  const height = 190;
  const padLeft = 54;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 28;

  const values = points.map((p) => p.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;

  const x = (i: number) =>
    padLeft + (i / (points.length - 1)) * (width - padLeft - padRight);
  const y = (v: number) =>
    padTop + (1 - (v - low) / span) * (height - padTop - padBottom);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  const columns: Column<{ period: string; value: number }>[] = [
    { key: "period", head: "Month", render: (r) => monthWords(r.period) },
    { key: "value", head: unit, numeric: true, render: (r) => r.value.toLocaleString("en-CA") },
  ];

  return (
    <div>
      <h3 id={id}>{title}</h3>
      <ViewSwitch showing={showing} onChange={setShowing} labelledBy={id} />
      {showing === "chart" ? (
        <svg
          className="chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={describe}
        >
          <line
            className="chart-axis"
            x1={padLeft}
            y1={height - padBottom}
            x2={width - padRight}
            y2={height - padBottom}
          />
          <line className="chart-grid" x1={padLeft} y1={y(high)} x2={width - padRight} y2={y(high)} />
          <line className="chart-grid" x1={padLeft} y1={y(low)} x2={width - padRight} y2={y(low)} />
          <text className="chart-text" x={padLeft - 8} y={y(high) + 4} textAnchor="end">
            {Math.round(high).toLocaleString("en-CA")}
          </text>
          <text className="chart-text" x={padLeft - 8} y={y(low) + 4} textAnchor="end">
            {Math.round(low).toLocaleString("en-CA")}
          </text>
          <path className="chart-line" d={path} />
          <circle cx={x(points.length - 1)} cy={y(last.value)} r={3.5} fill="var(--accent)" />
          <text className="chart-text" x={padLeft} y={height - 8}>
            {monthWords(first.period)}
          </text>
          <text className="chart-text" x={width - padRight} y={height - 8} textAnchor="end">
            {monthWords(last.period)}
          </text>
        </svg>
      ) : (
        <DataTable
          caption={`${title}, in ${unit}. Newest month last.`}
          columns={columns}
          rows={points}
          rowKey={(r) => r.period}
        />
      )}
    </div>
  );
}

export function ShareBars({
  title,
  caption,
  rows,
  describe,
}: {
  title: string;
  caption: string;
  rows: { label: string; share: number; detail?: string }[];
  describe: string;
}) {
  const [showing, setShowing] = useState<"chart" | "table">("chart");
  const id = useId();

  if (rows.length === 0) {
    return (
      <p className="missing">
        <em>No breakdown available.</em>
      </p>
    );
  }

  const barHeight = 30;
  const width = 640;
  const labelWidth = 150;
  const height = rows.length * barHeight + 8;
  const widest = Math.max(...rows.map((r) => r.share), 1);

  const columns: Column<(typeof rows)[number]>[] = [
    { key: "label", head: "Supplier", render: (r) => r.label },
    { key: "share", head: "Share", numeric: true, render: (r) => `${r.share.toFixed(1)}%` },
    { key: "detail", head: "Quantity", numeric: true, render: (r) => r.detail ?? NOT_AVAILABLE },
  ];

  return (
    <div>
      <h3 id={id}>{title}</h3>
      <ViewSwitch showing={showing} onChange={setShowing} labelledBy={id} />
      {showing === "chart" ? (
        <svg
          className="chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={describe}
        >
          {rows.map((row, i) => {
            const y = i * barHeight + 4;
            const length = (row.share / widest) * (width - labelWidth - 60);
            return (
              <g key={row.label}>
                <text className="chart-text" x={labelWidth - 8} y={y + 19} textAnchor="end" fill="var(--ink)">
                  {row.label}
                </text>
                <rect
                  className={i === 0 ? "bar" : "bar-muted"}
                  x={labelWidth}
                  y={y + 6}
                  width={Math.max(length, 2)}
                  height={barHeight - 14}
                  rx={2}
                />
                <text className="chart-text" x={labelWidth + Math.max(length, 2) + 7} y={y + 19}>
                  {row.share.toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <DataTable caption={caption} columns={columns} rows={rows} rowKey={(r) => r.label} />
      )}
    </div>
  );
}

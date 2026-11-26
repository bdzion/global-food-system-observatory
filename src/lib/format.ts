/* Turning figures into words a reader can take in at a glance.
 *
 * Two rules run through this file. Large quantities are given in the units
 * people actually use for them — million tonnes rather than 13,095,852 tonnes —
 * because a number nobody can read is not information. And a missing figure
 * prints as a dash with an explanation beside it, never as a zero. */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const NOT_AVAILABLE = "—";

export function tonnes(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} million tonnes`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString("en-CA")} thousand tonnes`;
  }
  return `${Math.round(value).toLocaleString("en-CA")} tonnes`;
}

export function percent(value: number | null | undefined, places = 0): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return `${value.toFixed(places)}%`;
}

export function months(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  if (value < 1) {
    const weeks = Math.round(value * 4.33);
    return weeks <= 1 ? "under a week" : `about ${weeks} weeks`;
  }
  return `${value.toFixed(1)} months`;
}

export function money(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  return `${value.toLocaleString("en-CA", { maximumFractionDigits: 1 })} ${unit}`;
}

export function people(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} million people`;
  return `${Math.round(value).toLocaleString("en-CA")} people`;
}

/** "2026M10" or "2026-10" as "October 2026". */
export function monthWords(period: string | null | undefined): string {
  if (!period) return NOT_AVAILABLE;
  const text = period.replace("M", "-");
  const [year, month] = text.split("-");
  const index = Number(month) - 1;
  return index >= 0 && index < 12 ? `${MONTHS[index]} ${year}` : period;
}

/** An ISO date as "26 November 2026". */
export function dateWords(iso: string | null | undefined): string {
  if (!iso) return NOT_AVAILABLE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "3 days ago", for saying how old a figure is without making the reader subtract. */
export function ageWords(days: number | null | undefined): string {
  if (days === null || days === undefined) return "age not known";
  if (days <= 1) return "updated today";
  if (days < 14) return `${days} days ago`;
  if (days < 70) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${(days / 365).toFixed(1)} years ago`;
}

export function changeWords(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  if (Math.abs(value) < 0.5) return "about the same as a year earlier";
  const direction = value > 0 ? "higher" : "lower";
  return `${Math.abs(value).toFixed(0)}% ${direction} than a year earlier`;
}

/** "2026M10" as "Oct 2026", for chart axes where the long form will not fit. */
export function monthShort(period: string | null | undefined): string {
  if (!period) return NOT_AVAILABLE;
  const text = period.replace("M", "-");
  const [year, month] = text.split("-");
  const index = Number(month) - 1;
  return index >= 0 && index < 12
    ? `${MONTHS[index].slice(0, 3)} ${year}`
    : period;
}

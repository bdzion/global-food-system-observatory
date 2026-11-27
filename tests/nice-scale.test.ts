import { describe, it, expect } from "vitest";
function niceScale(min: number, max: number, target = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return { lo: min, hi: max || 1, ticks: [min, max || 1] };
  }
  const raw = (max - min) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo, i = 0; v <= hi + step / 2 && i < 40; v += step, i++) ticks.push(Number(v.toFixed(10)));
  return { lo, hi, ticks };
}
describe("niceScale", () => {
  it("replaces the old fractional ticks with round ones", () => {
    // The wheat chart: 0 to 522.3 used to label 130.6 / 261.2 / 391.7 / 522.3.
    // A step of 150 is not a round step; 200 is, so the axis runs 0 to 600.
    expect(niceScale(0, 522.3).ticks).toEqual([0, 200, 400, 600]);
  });
  it("handles small and large ranges", () => {
    expect(niceScale(0, 1).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceScale(0, 33_000_000).ticks).toEqual([0, 10000000, 20000000, 30000000, 40000000]);
  });
  it("never returns an unbounded or empty tick list", () => {
    for (const [a, b] of [[0, 0], [5, 5], [NaN, 10], [0, Infinity], [-50, 50]]) {
      const t = niceScale(a as number, b as number).ticks;
      expect(t.length).toBeGreaterThan(0);
      expect(t.length).toBeLessThan(41);
    }
  });
  it("covers the data: the top tick is at or above the maximum", () => {
    for (const max of [3, 17, 522.3, 999, 1001, 48_000]) {
      const { ticks } = niceScale(0, max);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max);
    }
  });
});

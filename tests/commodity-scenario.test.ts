import { describe, it, expect } from "vitest";
import { shipmentScenario } from "../src/lib/commodities";

describe("conditional shipment arithmetic", () => {
  it("preserves mass balance and intervention timing", () => {
    const early = shipmentScenario(1200, 50, 6, 40, 0);
    const late = shipmentScenario(1200, 50, 6, 40, 3);
    expect(early).toEqual({gross:300,offset:120,residual:180});
    expect(late).toEqual({gross:300,offset:60,residual:240});
    expect(late.offset + late.residual).toBe(late.gross);
  });
  it("never replaces supplies after a disruption ends", () => {
    expect(shipmentScenario(1200, 50, 6, 100, 9).residual).toBe(300);
  });
  it("has no loss for a zero disruption and rejects invalid assumptions", () => {
    expect(shipmentScenario(1200, 0, 6, 40, 2).residual).toBe(0);
    expect(() => shipmentScenario(1200, 105, 6, 40, 2)).toThrow(RangeError);
  });
});

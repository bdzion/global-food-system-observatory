import { describe,it,expect } from "vitest";
import { priceAge,shipmentScenario } from "../src/lib/commodities";
describe("decision evidence",()=>{
 it("excludes historical prices",()=>{expect(priceAge("2020M08",new Date("2026-11-26"))).toBe("historical");expect(priceAge("2026M10",new Date("2026-11-26"))).toBe("current")});
 it("bounds replacement by capacity and lead time",()=>{expect(shipmentScenario(1200,50,6,100,0,10).residual).toBe(240);expect(shipmentScenario(1200,50,6,100,3,10).residual).toBe(270)});
});

import { describe,it,expect } from "vitest";
import { mapBin } from "../src/components/EvidenceVisuals";
describe("map evidence bins",()=>{
 it("distinguishes unknown from observed zero",()=>{expect(mapBin(null,100)).toBe(-1);expect(mapBin(0,100)).toBe(0);expect(mapBin(undefined,100)).toBe(-1);});
 it("has bounded relative bins",()=>{expect(mapBin(100,100)).toBe(4);expect(mapBin(20,100)).toBe(0);expect(mapBin(21,100)).toBe(1);expect(mapBin(NaN,100)).toBe(-1);});
});

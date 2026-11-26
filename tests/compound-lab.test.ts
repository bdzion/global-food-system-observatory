import {describe,it,expect} from "vitest";
import {compoundBalance} from "../src/lib/commodities";
describe("compound physical balance",()=>{
 it("conserves separate production and import losses",()=>{const r=compoundBalance(1000,500,6,20,40,100,20,25,0);expect(r.gross).toBe(200);expect(r.alternative).toBe(50);expect(r.reserve).toBe(25);expect(r.residual).toBe(125);});
 it("cannot release more than remaining gap",()=>{const r=compoundBalance(1000,500,6,20,40,100,100,1000,0);expect(r.residual).toBe(0);expect(r.reserve+r.alternative).toBe(r.gross);});
 it("delayed action cannot recover before action",()=>{const r=compoundBalance(1000,500,6,20,40,100,100,1000,6);expect(r.residual).toBe(r.gross);});
});

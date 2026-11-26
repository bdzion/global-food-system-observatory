import type { Manifest, Price, PriceGap } from "./types";
import { hasFile, readVerified } from "./data";

export interface CommoditySupplier {
  iso3: string;
  name: string;
  quantity_t: number;
  share_pct: number;
  flag: string;
}
export interface CommodityProfile {
  iso3: string;
  name: string;
  year: number;
  production_t: number | null;
  imports_t: number | null;
  exports_t: number | null;
  apparent_supply_t: number | null;
  gross_import_share_pct: number | null;
  opening_stocks_t: number | null;
  estimated_cover_months: number | null;
  /** Set when we decline to publish a stock figure, and says why. */
  stock_note: string | null;
  conflicts: string[];
  food_use_t: number | null;
  flags: Record<string, string>;
  supplier_year?: number | null;
  supplier_basis: "importer_reported" | "exporter_mirrored" | "unavailable";
  supplier_coverage_pct: number | null;
  supplier_hhi: number | null;
  suppliers: CommoditySupplier[];
  history: { year: number; production: number | null; imports: number | null; exports: number | null; flags: Record<string, string> }[];
  food_price_gap: PriceGap | null;
  healthy_diet_unaffordable: {year: number; value: number} | null;
}
export interface Commodity {
  name: string;
  role: string;
  item_code: string;
  group?: string;
  year: number | null;
  status: string;
  countries: Record<string, CommodityProfile>;
  exporters: {iso3: string; name: string; exports_t: number}[];
  price: Price | null;
}
export interface CommodityRelease {
  schema_version: number;
  extension_version: number;
  products: Record<string, Commodity>;
  sources: Record<string, string>;
  provider_updated: Record<string, string | null>;
  method: Record<string, string>;
  coverage?: Record<string, Coverage>;
  country_names?: Record<string,string>;
  detail_format?: number;
}
export interface Coverage {
  name:string; year:number|null; countries:number; production_t:number; imports_t:number; exports_t:number;
  suppliers:number; aligned_suppliers:number; estimated_cover_months:number; price_period:string|null;
}
export function coverageFor(data:CommodityRelease): Record<string,Coverage> {
  return data.coverage || Object.fromEntries(Object.entries(data.products).map(([id,p])=>{
    const rows=Object.values(p.countries);
    return [id,{name:p.name,year:p.year,countries:rows.length,
      production_t:rows.filter(r=>r.production_t!=null).length,imports_t:rows.filter(r=>r.imports_t!=null).length,
      exports_t:rows.filter(r=>r.exports_t!=null).length,suppliers:rows.filter(r=>r.suppliers?.length).length,
      aligned_suppliers:rows.filter(r=>r.suppliers?.length&&(r.supplier_year??r.year)===r.year).length,
      estimated_cover_months:rows.filter(r=>r.estimated_cover_months!=null).length,price_period:p.price?.latest_period??null}];
  }));
}
export function priceAge(period:string, now=new Date()):"current"|"delayed"|"historical" {
  const m=period.match(/^(\d{4})[M-](\d{2})$/);
  if(!m)return "historical";
  const lag=now.getUTCFullYear()*12+now.getUTCMonth()-(+m[1]*12+(+m[2]-1));
  return lag>=0&&lag<=2?"current":lag>2&&lag<=6?"delayed":"historical";
}
export const COMPOUND_IDS=["wheat","maize","soybeans","rice","palm_oil","soybean_oil","chicken","eggs"];
export async function loadCommodityIndex(manifest: Manifest): Promise<CommodityRelease|null> {
  const name=hasFile(manifest,"commodity-index.json")?"commodity-index.json":"commodities.json";
  if(!hasFile(manifest,name))return null;
  const data=await readVerified<CommodityRelease>(manifest,name);
  if(data.extension_version!==1||!data.products)throw Error("Unknown commodity format");
  return data;
}
export async function loadCommodities(manifest: Manifest, selected="wheat", compound=false): Promise<CommodityRelease|null> {
  const index=await loadCommodityIndex(manifest);
  if(!index||!index.detail_format)return index;
  const key=Object.hasOwn(index.products,selected)?selected:"wheat";
  const wanted=[...new Set([key,...(compound?COMPOUND_IDS:[])])].filter(id=>Object.hasOwn(index.products,id));
  const entries=await Promise.all(wanted.map(async id=>{
    const detail=await readVerified<{schema_version:number;product:Commodity}>(manifest,"commodities/"+id+".json");
    return [id,detail.product] as const;
  }));
  return {...index,products:{...index.products,...Object.fromEntries(entries)}};
}

/* Conditional arithmetic, not a prediction. Annual reported flows are
 * prorated uniformly; actual seasonality is not modelled. Replacement is
 * an explicit assumption, not a claim of spare export capacity. */
export function shipmentScenario(annualFlow: number, stopPct: number, months: number, replacementPct: number, leadMonths: number, spareCapacityPct = 100) {
  if (![annualFlow, stopPct, months, replacementPct, leadMonths, spareCapacityPct].every(Number.isFinite) ||
      annualFlow < 0 || stopPct < 0 || stopPct > 100 || months <= 0 || months > 12 ||
      replacementPct < 0 || replacementPct > 100 || leadMonths < 0 || spareCapacityPct < 0 || spareCapacityPct > 100) {
    throw new RangeError("Invalid scenario inputs");
  }
  const gross = annualFlow * (stopPct / 100) * months / 12;
  const activeMonths = Math.max(0, months - leadMonths);
  const baseline = annualFlow * months / 12;
  const offset = Math.min(gross * replacementPct / 100, baseline * spareCapacityPct / 100) * activeMonths / months;
  return { gross, offset, residual: gross - offset };
}

/** Conditional physical balance over one common window. Production and lost
 * imports are separate flows; no price elasticity or market clearing. Reserve
 * release is an independently supplied assumption, not FAO stock estimates. */
export function compoundBalance(production:number,annualSupplierFlow:number,months:number,productionLossPct:number,importLossPct:number,replacementPct:number,capacityPct:number,reserveTonnes:number,leadMonths:number){
 const nums=[production,annualSupplierFlow,months,productionLossPct,importLossPct,replacementPct,capacityPct,reserveTonnes,leadMonths];
 if(!nums.every(Number.isFinite)||production<0||annualSupplierFlow<0||reserveTonnes<0||months<=0||months>12||leadMonths<0||[productionLossPct,importLossPct,replacementPct,capacityPct].some(v=>v<0||v>100))throw RangeError("Invalid compound scenario");
 const productionLoss=production*months/12*productionLossPct/100;
 const importLoss=annualSupplierFlow*months/12*importLossPct/100;
 const gross=productionLoss+importLoss;
 const active=Math.max(0,months-leadMonths)/months;
 const alternative=Math.min(importLoss*replacementPct/100,annualSupplierFlow*months/12*capacityPct/100)*active;
 const reserve=Math.min(gross-alternative,reserveTonnes*active);
 return {productionLoss,importLoss,gross,alternative,reserve,residual:Math.max(0,gross-alternative-reserve)};
}

/** Cumulative gaps at elapsed months, consistent with the original scenario endpoint. */
export function shipmentTimeline(annualFlow:number,stopPct:number,months:number,replacementPct:number,leadMonths:number,capacityPct:number){
 if(!Number.isInteger(months)||months<1||months>12)throw new RangeError('Expected whole months 1–12');
 return [{month:0,none:0,early:0,late:0},...Array.from({length:months},(_,i)=>{const month=i+1;const early=shipmentScenario(annualFlow,stopPct,month,replacementPct,0,capacityPct);const late=shipmentScenario(annualFlow,stopPct,month,replacementPct,leadMonths,capacityPct);return {month,none:early.gross,early:early.residual,late:late.residual}})];
}

import type { Manifest, Price, PriceGap } from "./types";

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
}
export async function loadCommodities(manifest: Manifest): Promise<CommodityRelease | null> {
  const file = manifest.files.find(f => f.name === "commodities.json");
  if (!file) return null; // legacy release, explicitly unavailable
  const response = await fetch(`${import.meta.env.BASE_URL}data/commodities.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Commodity file unavailable (${response.status})`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== file.bytes) throw new Error("Commodity file size differs from the release manifest");
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(n => n.toString(16).padStart(2, "0")).join("");
  if (hash !== file.sha256) throw new Error("Commodity file checksum differs from the release manifest");
  const data = JSON.parse(new TextDecoder().decode(bytes)) as CommodityRelease;
  if (data.schema_version !== manifest.schema_version || data.extension_version !== 1 || !data.products) {
    throw new Error("Unknown commodity data format");
  }
  return data;
}

/* Conditional arithmetic, not a prediction. Annual reported flows are
 * prorated uniformly; actual seasonality is not modelled. Replacement is
 * an explicit assumption, not a claim of spare export capacity. */
export function shipmentScenario(annualFlow: number, stopPct: number, months: number, replacementPct: number, leadMonths: number) {
  if (![annualFlow, stopPct, months, replacementPct, leadMonths].every(Number.isFinite) ||
      annualFlow < 0 || stopPct < 0 || stopPct > 100 || months <= 0 || months > 12 ||
      replacementPct < 0 || replacementPct > 100 || leadMonths < 0) {
    throw new RangeError("Invalid scenario inputs");
  }
  const gross = annualFlow * (stopPct / 100) * months / 12;
  const activeMonths = Math.max(0, months - leadMonths);
  const offset = gross * (replacementPct / 100) * activeMonths / months;
  return { gross, offset, residual: gross - offset };
}

/* The shape of a published release.
 *
 * These types are the contract between the pipeline and the pages. If the
 * pipeline stops producing one of these fields, the tests in tests/ fail
 * rather than the page quietly rendering a blank space where a number was. */

export const SCHEMA = 1;

export type ChainState = "quiet" | "watching" | "not_watched" | "no_data";

export interface Band {
  state: "within_usual_range" | "outside_usual_range" | "not_enough_history";
  direction?: "higher" | "lower" | "within";
  years_compared: number;
  median?: number | null;
  lowest?: number | null;
  highest?: number | null;
  vs_median_pct?: number | null;
}

export interface Supplier {
  iso3: string;
  name?: string;
  quantity_t: number;
  share_pct: number;
  flag: string;
}

export interface Wheat {
  iso3: string;
  year: number;
  production_t: number | null;
  imports_t: number | null;
  exports_t: number | null;
  available_t: number | null;
  opening_stocks_t: number | null;
  import_dependence_pct: number | null;
  stock_cover_months: number | null;
  stock_note: string | null;
  previous_stock_cover_months: number | null;
  suppliers: Supplier[];
  supplier_basis:
    | "reported_by_this_country"
    | "reconstructed_from_suppliers"
    | "none_available";
  supplier_coverage_pct: number | null;
  top_supplier: string | null;
  top_supplier_share_pct: number | null;
  supplier_hhi: number | null;
  suppliers_above_1pct: number | null;
  imports_vs_usual: Band;
  data_flags: Record<string, string>;
}

export interface Finding {
  indicator: string;
  why: string;
  fired: boolean;
  reading: string;
  threshold?: number | null;
  source_note?: string;
}

export interface Stage {
  id: string;
  order: number;
  label: string;
  what_it_means: string;
  state: ChainState;
  state_label: string;
  state_means: string;
  because?: string | null;
  findings: Finding[];
  unreadable_checks?: number;
  clock_warning?: string | null;
}

export interface PriceGap {
  period: string;
  food_change_pct: number;
  general_change_pct: number;
  gap_pct_points: number;
}

export interface Country {
  iso3: string;
  name: string;
  wheat: Wheat;
  price_gap: PriceGap | null;
  unaffordable: { year: number; value: number } | null;
  healthy_diet_cost: { year: number; value: number } | null;
  reserve_cover: { months: number; reserves_year: number; imports_year: number } | null;
  population: number | null;
  chain: Stage[];
  chain_summary: {
    moved_count: number;
    unwatched_count: number;
    furthest_moved: string | null;
    words: string;
    coverage_words: string;
  };
}

export interface Price {
  id: string;
  plain_name: string;
  why_it_is_here: string;
  unit: string;
  latest_period: string;
  latest_value: number | null;
  change_over_year_pct: number | null;
  climb_anomaly: number | null;
  climb_reading: { state: string; words: string };
  history: { period: string; value: number }[];
}

export interface Exporter {
  iso3: string;
  name: string;
  production_t: number | null;
  exports_t: number | null;
  opening_stocks_t: number | null;
  stock_cover_months: number | null;
  stock_note: string | null;
  previous_stock_cover_months: number | null;
  production_vs_usual: Band;
  stocks_vs_usual: Band;
  year: number;
}

export interface World {
  schema_version: number;
  year: number;
  prices: Record<string, Price>;
  exporters: Exporter[];
  situation: {
    as_of: string | null;
    lines: string[];
    ledger_line: string;
    written_by: string;
    reviewed: boolean;
    review_note: string;
  };
  chain_states: Record<string, { label: string; means: string }>;
}

export interface Assumption {
  id: string;
  plain: string;
  why_it_matters: string;
  if_broken: string;
  scope: "world" | "per_country";
  watches: string;
  watches_name?: string;
  threshold: number;
  value?: number;
  state: "holding" | "broken" | "broken_somewhere" | "cannot_check";
  reading?: string;
  as_of?: string;
  checked_at: string;
  broken_for?: { iso3: string; name: string; reading: number }[];
}

export interface Ledger {
  schema_version: number;
  checked_at: string;
  assumptions: Assumption[];
  broken_count: number;
  holding_count: number;
  verdict: string;
}

export interface Pair {
  a: string;
  b: string;
  shared: string;
  differs: string;
  so_what: string;
  dependence_gap: number;
  cover_ratio: number;
}

export interface ScenarioInput {
  id: string;
  label: string;
  unit: string;
  default: number;
  min: number;
  max: number;
  step: number;
  note?: string;
}

export interface DisplacementBuyer {
  iso3: string;
  name: string;
  quantity_t: number;
  share_of_their_wheat_pct: number;
  import_dependence_pct: number | null;
  stock_cover_months: number | null;
  stock_note: string | null;
  previous_stock_cover_months: number | null;
  unaffordable_pct: number | null;
}

export interface Scenario {
  schema_version: number;
  id: string;
  title: string;
  plain_question: string;
  what_this_is: string;
  what_this_is_not: string;
  inputs: ScenarioInput[];
  displacement: {
    explain: string;
    show_top: number;
    by_supplier: Record<string, DisplacementBuyer[]>;
  };
}

export interface SourceEntry {
  id: string;
  provider: string;
  dataset: string;
  plain_name: string | null;
  caveat: string | null;
  licence: string;
  licence_url: string;
  documentation_url: string;
  redistribution: string;
  status: string;
  provider_updated: string | null;
  days_old: number | null;
  older_than_expected: boolean;
  expected_frequency: string;
}

export interface Manifest {
  schema_version: number;
  release_id: string;
  generated_at_utc: string;
  files: { name: string; bytes: number; sha256: string }[];
  sources: {
    id: string;
    provider_updated: string | null;
    days_old: number | null;
    older_than_expected: boolean;
  }[];
  coverage: Record<string, number>;
}

export interface Release {
  manifest: Manifest;
  world: World;
  countries: { schema_version: number; year: number; countries: Record<string, Country> };
  ledger: Ledger;
  pairs: { schema_version: number; pairs: Pair[] };
  scenario: Scenario;
  sources: { schema_version: number; sources: SourceEntry[] };
}

import { useEffect, useState } from "react";
import { loadCommodities, shipmentScenario, type CommodityRelease, type CommodityProfile } from "../lib/commodities";
import { href, type Route } from "../lib/router";
import type { Release } from "../lib/types";

type Mode = "overview" | "explore" | "watch" | "stress" | "briefs";
type Result = { kind: "loading" } | { kind: "legacy" } | { kind: "error"; message: string } | { kind: "ready"; data: CommodityRelease };
const STORE = "gfso.commodity-context.v1";
const readPreference = (key: string, fallback: string) => {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}")[key] || fallback; }
  catch { return fallback; }
};
const number = (v: number | null | undefined, digits = 0) => v == null ? "Not available" : new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(v);
const percent = (v: number | null | undefined) => v == null ? "Not available" : number(v, 1) + "%";
const t = (v: number | null | undefined) => v == null ? "Not available" : number(v) + " t";
const nameFor = (p: CommodityProfile | undefined) => p?.name || "Unknown country";

export function CommodityWorkspace({ release, route, mode }: { release: Release; route: Route; mode: Mode }) {
  const [result, setResult] = useState<Result>({ kind: "loading" });
  const [selected, setSelected] = useState<string>(() => route.query.get("commodity") || readPreference("commodity", "wheat"));
  const [iso, setIso] = useState<string>(() => route.query.get("geo") || readPreference("geo", "global"));
  const [stop, setStop] = useState(30);
  const [months, setMonths] = useState(6);
  const [replacement, setReplacement] = useState(40);
  const [delay, setDelay] = useState(2);
  const [supplier, setSupplier] = useState("");
  const [compound, setCompound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCommodities(release.manifest).then(data => {
      if (!cancelled) setResult(data ? { kind: "ready", data } : { kind: "legacy" });
    }).catch((error: unknown) => {
      if (!cancelled) setResult({ kind: "error", message: String(error) });
    });
    return () => { cancelled = true; };
  }, [release.manifest]);

  useEffect(() => {
    const product = route.query.get("commodity");
    const geography = route.query.get("geo");
    if (product) setSelected(product);
    if (geography) setIso(geography);
    if (product || geography) {
      try { localStorage.setItem(STORE, JSON.stringify({ commodity: product || readPreference("commodity", "wheat"), geo: geography || readPreference("geo", "global") })); } catch { /* optional */ }
      setSupplier("");
    }
  }, [route.query]);

  function select(product: string, geography: string) {
    setSelected(product); setIso(geography); setSupplier("");
    try { localStorage.setItem(STORE, JSON.stringify({ commodity: product, geo: geography })); } catch { /* optional */ }
    const query = new URLSearchParams(route.query);
    query.set("commodity", product); query.set("geo", geography);
    window.history.replaceState(null, "", href(route.page, route.id, Object.fromEntries(query)));
  }

  if (result.kind === "loading") return <p role="status">Loading commodity evidence…</p>;
  if (result.kind === "legacy") return <section className="commodity-panel"><h2>Multi-commodity evidence</h2><p>The published release contains only the original wheat analysis. The expanded release has not been published. No figures for other commodities are inferred.</p><a href={href("wheat")}>Open the original wheat observatory</a></section>;
  if (result.kind === "error") return <section className="commodity-panel"><h2>Commodity evidence unavailable</h2><p role="alert">{result.message}. No new commodity figures are being shown.</p><a href={href("wheat")}>Original wheat analysis</a></section>;
  const { products, sources, provider_updated, method } = result.data;
  const key = Object.hasOwn(products, selected) ? selected : "wheat";
  const product = products[key];
  if (!product) return <p role="alert">No commodity record is available.</p>;
  const countries = Object.values(product.countries).sort((a,b) => a.name.localeCompare(b.name));
  const allCountries = new Map<string, string>();
  for (const p of Object.values(products)) for (const c of Object.values(p.countries)) allCountries.set(c.iso3, c.name);
  const choices = [...allCountries].sort((a,b) => a[1].localeCompare(b[1]));
  const geo = iso === "global" || allCountries.has(iso) ? iso : "global";
  const profile = product.countries[geo];
  const actualSupplier = profile?.suppliers.find(s => s.iso3 === supplier) || profile?.suppliers[0];
  const scenarioRows = profile && actualSupplier
    ? Object.entries(products).filter(([id]) => id === key || (compound && id !== "rice_paddy" && id !== "rice" && id !== key))
      .map(([id, p]) => {
        const buyer = p.countries[geo];
        const flow = buyer?.suppliers.find(s => s.iso3 === actualSupplier.iso3);
        return { id, name: p.name, year: p.year, basis: buyer?.supplier_basis, flow: flow?.quantity_t,
          early: flow ? shipmentScenario(flow.quantity_t, stop, months, replacement, 0) : null,
          late: flow ? shipmentScenario(flow.quantity_t, stop, months, replacement, delay) : null };
      }) : [];
  const imports = [...countries].filter(c => c.imports_t != null).sort((a,b) => b.imports_t! - a.imports_t!);
  const title = {overview:"The food system at a glance",explore:"Explore the evidence",watch:"What requires attention?",stress:"What if shipments are interrupted?",briefs:"Evidence brief"}[mode];
  return <section className="commodity-workspace">
    <div className="commodity-intro">
      <p className="commodity-kicker">Global food-system intelligence · research prototype</p>
      <h1>{title}</h1>
      <p className="lede">Follow food supply, trade dependencies and the buffers that may absorb a disruption. Annual evidence describes structural exposure, not current shortages.</p>
    </div>
    <div className="commodity-filter" aria-label="Evidence filters">
      <label>Commodity<select value={key} onChange={e => select(e.target.value, geo)}>{Object.entries(products).map(([id,p]) => <option key={id} value={id}>{p.name}</option>)}</select></label>
      <label>Geography<select value={geo} onChange={e => select(key, e.target.value)}><option value="global">Global</option>{choices.map(([id,n]) => <option key={id} value={id}>{n}</option>)}</select></label>
      <p className="figure-note" role="status">{product.name} · {geo === "global" ? "Global" : allCountries.get(geo)} · observation year {product.year ?? "unknown"}</p>
    </div>
    {mode === "overview" && <>
      <h2>Commodity coverage</h2>
      <div className="commodity-grid">{Object.entries(products).map(([id,p]) => <article className="commodity-panel" key={id}>
        <h3>{p.name}</h3><p>{p.role}</p><p><strong>{Object.keys(p.countries).length}</strong> profiles · {p.year ?? "no year"}</p>
        <p>{p.price ? <>{p.price.plain_name}: {number(p.price.latest_value, 1)} {p.price.unit} ({p.price.latest_period})</> : "Commodity benchmark price not connected"}</p>
        <a href={href("explore", undefined, {commodity:id, geo})}>Explore {p.name.toLowerCase()}</a>
      </article>)}</div>
      <h2>Shared pressures</h2><div className="commodity-grid">{Object.values(release.world.prices).filter(p => ["urea_price","dap_price","potash_price","oil_price","gas_price"].includes(p.id)).map(p => <article className="commodity-panel" key={p.id}><h3>{p.plain_name}</h3><strong>{number(p.latest_value,1)} {p.unit}</strong><p>{p.latest_period} · annual change {percent(p.change_over_year_pct)}</p></article>)}</div>
      <p className="figure-note">Shared pressures are World Bank reference prices, not country-specific costs or measured effects on harvests.</p>
    </>}
    {(mode === "explore" || mode === "overview" || mode === "briefs") && <>
      <h2>{product.name}: {geo === "global" ? "reported trade" : allCountries.get(geo)}</h2>
      <p>{product.role}. FAOSTAT item {product.item_code}; quantities in metric tonnes. Product forms are not aggregated.</p>
      {geo === "global" ? <div className="commodity-grid">
        <article className="commodity-panel"><h3>Largest reported exporters</h3>{product.exporters.length ? <ol>{product.exporters.map(c => <li key={c.iso3}><a href={href("explore",undefined,{commodity:key,geo:c.iso3})}>{c.name}</a> — {t(c.exports_t)}</li>)}</ol> : <p>Not available.</p>}</article>
        <article className="commodity-panel"><h3>Largest reported importers</h3>{imports.length ? <ol>{imports.slice(0,12).map(c => <li key={c.iso3}><a href={href("explore",undefined,{commodity:key,geo:c.iso3})}>{c.name}</a> — {t(c.imports_t)}</li>)}</ol> : <p>Not available.</p>}</article>
      </div> : profile ? <>
        <div className="commodity-grid">{[
          ["Production",t(profile.production_t),profile.flags.production],
          ["Imports",t(profile.imports_t),profile.flags.imports],
          ["Exports",t(profile.exports_t),profile.flags.exports],
          ["Gross import share",percent(profile.gross_import_share_pct),"Derived; may exceed 100% for re-exporters"],
          ["Opening-stock estimate",t(profile.opening_stocks_t),profile.flags.opening_stocks],
          ["Estimated stock cover",profile.estimated_cover_months == null ? "Not available" : number(profile.estimated_cover_months,1)+" months","Provider estimate, not verified physical reserves"],
        ].map(([label,value,note]) => <article className="commodity-panel" key={label}><h3>{label}</h3><strong className="commodity-value">{value}</strong><p className="figure-note">{note ? "Source flag / note: "+note : "No source flag supplied"}</p></article>)}</div>
        <p className="figure-note">Stock estimates are not used to rank risk or model accessible reserve releases. Gross import share requires all three supply components.</p>
        <h3>Where imports come from</h3>
        <p>Basis: {profile.supplier_basis.replaceAll("_"," ")}. Observed bilateral flow coverage relative to national imports: {percent(profile.supplier_coverage_pct)}. Coverage may differ from 100%; shares are of observed flows only.</p>
        {profile.suppliers.length ? <div className="commodity-table"><table><caption>Observed supplier flows · {profile.year}</caption><thead><tr><th>Supplier</th><th>Tonnes</th><th>Share</th><th>Source flag</th></tr></thead><tbody>{profile.suppliers.slice(0,15).map(s => <tr key={s.iso3}><th scope="row">{s.name}</th><td>{number(s.quantity_t)}</td><td>{percent(s.share_pct)}</td><td>{s.flag || "Unflagged"}</td></tr>)}</tbody></table></div> : <p>No bilateral flow evidence.</p>}
        <h3>Historical evidence</h3><div className="commodity-table"><table><caption>Annual quantities in tonnes, same product form</caption><thead><tr><th>Year</th><th>Production</th><th>Imports</th><th>Exports</th></tr></thead><tbody>{profile.history.map(y => <tr key={y.year}><th scope="row">{y.year}</th><td>{number(y.production)}</td><td>{number(y.imports)}</td><td>{number(y.exports)}</td></tr>)}</tbody></table></div>
        <h3>Household context</h3><p>National food inflation minus general inflation: {profile.food_price_gap ? number(profile.food_price_gap.gap_pct_points,1)+" percentage points ("+profile.food_price_gap.period+")" : "Not available"}. Unable to afford a healthy diet: {profile.healthy_diet_unaffordable ? percent(profile.healthy_diet_unaffordable.value)+" ("+profile.healthy_diet_unaffordable.year+")" : "Not available"}. Neither indicator is specific to this commodity.</p>
      </> : <p>No exact-form evidence for this country in the selected year. Choose another product or country; missing is not zero.</p>}
    </>}
    {mode === "watch" && <>
      <h2>Evidence along the supply chain</h2>
      <div className="commodity-grid">{[
        ["Inputs","World Bank reference fertilizer and energy prices","Observed monthly; global context only"],
        ["Growing conditions","Crop-specific climate and crop conditions","Not monitored in this release"],
        ["Export supply",product.year ? "Annual production and exports available for some countries" : "Not available","Structural evidence; not current harvest forecast"],
        ["Transit","Commodity-specific shipping routes","Not monitored in this release"],
        ["Arrival",product.year ? "Annual bilateral trade evidence" : "Not available","Not current arrivals"],
        ["Markets",product.price ? product.price.plain_name+" · "+product.price.latest_period : "Commodity benchmark not connected","National food CPI is not a commodity retail price"],
        ["Households","National healthy-diet affordability","Structural vulnerability, not observed commodity impacts"],
      ].map(([stage,evidence,status]) => <article className="commodity-panel" key={stage}><h3>{stage}</h3><p>{evidence}</p><p className="figure-note">{status}</p></article>)}</div>
      <h2>What to check before acting</h2><p>Confirm whether the event affects the exact product form, whether the supplier has spare capacity, and whether replacement can arrive in time. Verify stocks independently and check domestic prices. No automatic action is prescribed.</p>
      <p><a href={href("chain")}>Original wheat transmission chain</a> · <a href={href("assumptions")}>Original wheat assumption ledger</a></p>
    </>}
    {mode === "stress" && <>
      <p className="commodity-warning"><strong>Scenario only.</strong> Uses historical annual bilateral flows, prorated evenly across months; does not model seasonality, prices, hunger or accessible stocks. An absent flow is unknown, not zero.</p>
      {geo === "global" || !profile || !actualSupplier ? <p>Select a country with observed suppliers to explore a shipment interruption.</p> : <>
        <label>Affected supplier<select value={actualSupplier.iso3} onChange={e=>setSupplier(e.target.value)}>{profile.suppliers.map(s=><option key={s.iso3} value={s.iso3}>{s.name}</option>)}</select></label>
        <div className="commodity-grid commodity-controls">
          <label>Shipments interrupted: {stop}%<input type="range" min="0" max="100" step="5" value={stop} onChange={e=>setStop(+e.target.value)}/></label>
          <label>Duration: {months} months<input type="range" min="1" max="12" value={months} onChange={e=>setMonths(+e.target.value)}/></label>
          <label>Assumed replaceable share: {replacement}%<input type="range" min="0" max="100" step="5" value={replacement} onChange={e=>setReplacement(+e.target.value)}/></label>
          <label>Delayed action lead time: {delay} months<input type="range" min="0" max="12" value={delay} onChange={e=>setDelay(+e.target.value)}/></label>
        </div>
        <label className="commodity-check"><input type="checkbox" checked={compound} onChange={e=>setCompound(e.target.checked)}/> Apply the same supplier disruption to wheat, maize and soybeans as additional independent scenarios (rice forms never added together)</label>
        <div className="commodity-table"><table><caption>{nameFor(profile)} · conditional shipment gaps, metric tonnes; different products are not summed</caption><thead><tr><th>Commodity / year</th><th>Reporting basis</th><th>No action</th><th>Early action</th><th>Delayed action</th></tr></thead><tbody>{scenarioRows.map(s=><tr key={s.id}><th scope="row">{s.name} · {s.year ?? "unknown"}</th><td>{s.flow == null ? "Unknown" : s.basis?.replaceAll("_"," ")}</td><td>{t(s.early?.gross)}</td><td>{t(s.early?.residual)}</td><td>{t(s.late?.residual)}</td></tr>)}</tbody></table></div>
        <p className="figure-note">Early action assumes replacement begins immediately; delayed action starts after the selected lead time. Replacement availability is hypothetical; the same supplier may serve competing buyers. No aggregation or substitution across products is inferred.</p>
        <h3>Decision options and constraints</h3><div className="commodity-grid"><article className="commodity-panel"><strong>Importers</strong><p>Check alternative suppliers' exportable surplus, financing and transit time before purchasing.</p></article><article className="commodity-panel"><strong>Government</strong><p>Independently verify accessible reserves and assess targeted affordability support. Consider displacement of other buyers.</p></article></div>
      </>}
      <p><a href={href("what-if")}>Original wheat stress test and displacement analysis</a></p>
    </>}
    {mode === "briefs" && <>
      <h2>What this evidence supports</h2><p>This automatically assembled brief describes the selected product's annual coverage, not a human-reviewed alert. It does not attribute price or household outcomes to a trade event.</p>
      <p>Original wheat situation summary:</p><ul>{release.world.situation.lines.map((line,i)=><li key={i}>{line}</li>)}</ul><p className="figure-note">{release.world.situation.review_note}</p>
    </>}
    <details className="commodity-panel"><summary>Evidence and methods</summary><dl>{Object.entries(method).map(([id,value])=><div key={id}><dt><strong>{id.replaceAll("_"," ")}</strong></dt><dd>{value}</dd></div>)}</dl><ul>{Object.entries(sources).map(([id,url])=><li key={id}><a href={url}>{id}</a>{Object.hasOwn(provider_updated,id) ? " · provider update "+(provider_updated[id] || "unknown") : ""}</li>)}</ul><p>Release {release.manifest.release_id}. Data dates differ by source. <a href={href("how")}>Data and methods</a></p></details>
    {mode !== "stress" && <p><a href={href("stress",undefined,{commodity:key,geo})}>Explore a conditional interruption scenario</a> · <a href={href("wheat")}>Original wheat observatory</a></p>}
  </section>;
}

import { useEffect, useState } from "react";
import { loadCommodities, shipmentScenario, type CommodityRelease, type CommodityProfile } from "../lib/commodities";
import { href, type Route } from "../lib/router";
import { monthWords, tonnes } from "../lib/format";
import type { Release } from "../lib/types";

type Mode = "overview" | "stress";
type Result = { kind: "loading" } | { kind: "legacy" } | { kind: "error"; message: string } | { kind: "ready"; data: CommodityRelease };
const STORE = "gfso.commodity-context.v1";
const readPreference = (key: string, fallback: string) => {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}")[key] || fallback; }
  catch { return fallback; }
};
const number = (v: number | null | undefined, digits = 0) => v == null ? "Not available" : new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(v);
const percent = (v: number | null | undefined) => v == null ? "Not available" : number(v, 1) + "%";
const t = (v: number | null | undefined) => v == null ? "Not available" : tonnes(v);
const nameFor = (p: CommodityProfile | undefined) => p?.name || "Unknown country";

/* FAO marks every figure with a one-letter flag saying where it came from.
 * The letters mean nothing to a reader, and a page that prints "X" beside a
 * number is asking them to go and look it up. */
const FLAG_WORDS: Record<string, string> = {
  A: "Reported by the country",
  E: "Estimated by FAO",
  I: "Filled in from the trading partner's figures",
  X: "Supplied by another organisation",
};
const sourceWords = (note: string | undefined) => {
  if (!note) return "No source given";
  const words = note.split(",").map(f => FLAG_WORDS[f.trim()]).filter(Boolean);
  return words.length ? words.join("; ") : note;
};

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
  if (result.kind === "legacy") return <section className="commodity-panel"><h2>These figures have not been published yet</h2><p>This release covers wheat only. Nothing is shown for the other crops, because we would be making it up.</p><a href={href("home")}>Go to the front page</a></section>;
  if (result.kind === "error") return <section className="commodity-panel"><h2>The crop figures could not be loaded</h2><p role="alert">Nothing is being shown rather than a page that looks empty. Reason given: {result.message}</p><a href={href("home")}>Go to the front page</a></section>;
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
  const title = {overview:"Four crops the world trades",stress:"What if shipments stopped?"}[mode];
  return <section className="commodity-workspace">
    <div className="commodity-intro">
      <p className="commodity-kicker">A research project · not an official warning system</p>
      <h1>{title}</h1>
      <p className="lede">Wheat, rice, maize and soybeans: how much each country grows, how much it buys, and who it buys from. These figures are published once a year and describe the shape of a country’s supply, not what is happening this month.</p>
    </div>
    <div className="commodity-filter" aria-label="Choose a crop and a country">
      <label>Crop<select value={key} onChange={e => select(e.target.value, geo)}>{Object.entries(products).map(([id,p]) => <option key={id} value={id}>{p.name}</option>)}</select></label>
      <label>Country<select value={geo} onChange={e => select(key, e.target.value)}><option value="global">Global</option>{choices.map(([id,n]) => <option key={id} value={id}>{n}</option>)}</select></label>
      <p className="figure-note" role="status">{product.name} · {geo === "global" ? "Global" : allCountries.get(geo)} · figures for {product.year ?? "an unknown year"}</p>
    </div>
    {mode === "overview" && <>
      <h2>What we cover</h2>
      <div className="commodity-grid">{Object.entries(products).map(([id,p]) => <article className="commodity-panel" key={id}>
        <h3>{p.name}</h3><p>{p.role}</p><p><strong>{Object.keys(p.countries).length}</strong> countries · {p.year ?? "no year"}</p>
        <p>{p.price ? <>{p.price.plain_name}: {number(p.price.latest_value, 1)} {p.price.unit} ({monthWords(p.price.latest_period)})</> : "No world price series connected for this crop yet"}</p>
        <a href={href("commodities", undefined, {commodity:id, geo})}>Explore {p.name.toLowerCase()}</a>
      </article>)}</div>
      <h2>Costs that affect every crop</h2><div className="commodity-grid">{Object.values(release.world.prices).filter(p => ["urea_price","dap_price","potash_price","oil_price","gas_price"].includes(p.id)).map(p => <article className="commodity-panel" key={p.id}><h3>{p.plain_name}</h3><strong>{number(p.latest_value,1)} {p.unit}</strong><p>{monthWords(p.latest_period)} · {percent(p.change_over_year_pct)} different from a year earlier</p></article>)}</div>
      <p className="figure-note">These are world reference prices. They are not the price any particular farmer or buyer paid, and a rise here reaches a harvest months later, not this week.</p>
    </>}
    {mode === "overview" && <>
      <h2>{product.name}: {geo === "global" ? "reported trade" : allCountries.get(geo)}</h2>
      <p>{product.role}. Figures are for this exact product only — milled rice is never added to paddy, and soybeans are never added to soybean oil, because they are not the same thing. (FAOSTAT item {product.item_code}.)</p>
      {geo === "global" ? <div className="commodity-grid">
        <article className="commodity-panel"><h3>Biggest sellers</h3>{product.exporters.length ? <ol>{product.exporters.map(c => <li key={c.iso3}><a href={href("commodities",undefined,{commodity:key,geo:c.iso3})}>{c.name}</a> — {t(c.exports_t)}</li>)}</ol> : <p>Not available.</p>}</article>
        <article className="commodity-panel"><h3>Biggest buyers</h3>{imports.length ? <ol>{imports.slice(0,12).map(c => <li key={c.iso3}><a href={href("commodities",undefined,{commodity:key,geo:c.iso3})}>{c.name}</a> — {t(c.imports_t)}</li>)}</ol> : <p>Not available.</p>}</article>
      </div> : profile ? <>
        <div className="commodity-grid">{[
          ["Grew",t(profile.production_t),profile.flags.production],
          ["Bought from abroad",t(profile.imports_t),profile.flags.imports],
          ["Sold abroad",t(profile.exports_t),profile.flags.exports],
          ["Share bought from abroad",percent(profile.gross_import_share_pct),"Imports as a share of what the country had available to use. Can pass 100% where a country sells most of it on again."],
          ["Held in store at the start of the year",t(profile.opening_stocks_t),profile.stock_note ? "Not published. See below." : profile.flags.opening_stocks],
          ["How long that would last",profile.estimated_cover_months == null ? "Not available" : number(profile.estimated_cover_months,1)+" months","Measured as months of this country’s own use. An FAO estimate, not a count of grain in silos."],
        ].map(([label,value,note]) => <article className="commodity-panel" key={label}><h3>{label}</h3><strong className="commodity-value">{value}</strong><p className="figure-note">{sourceWords(note as string | undefined)}</p></article>)}</div>
        {profile.stock_note ? <p className="notice"><strong>Why there is no stock figure here. </strong>{profile.stock_note}</p> : null}
        <p className="figure-note">We never rank countries on the stock figures, and we do not treat them as grain a government could release tomorrow.</p>
        <h3>Who it buys from</h3>
        <p>{profile.supplier_basis === "importer_reported" ? "This country reports its own purchases, so this is its own account of who it buys from." : profile.supplier_basis === "exporter_mirrored" ? "This country does not report its own purchases. The list below is pieced together from what other countries said they sold it, so it covers only the sellers who do report." : "Neither this country nor its suppliers report this trade in a form we can use."} The sellers below account for about {percent(profile.supplier_coverage_pct)} of what it is recorded as buying.</p>
        {profile.suppliers.length ? <div className="commodity-table"><table><caption>Observed supplier flows · {profile.year}</caption><thead><tr><th>Supplier</th><th>Tonnes</th><th>Share</th><th>Where the figure comes from</th></tr></thead><tbody>{profile.suppliers.slice(0,15).map(s => <tr key={s.iso3}><th scope="row">{s.name}</th><td>{number(s.quantity_t)}</td><td>{percent(s.share_pct)}</td><td>{sourceWords(s.flag)}</td></tr>)}</tbody></table></div> : <p>No bilateral flow evidence.</p>}
        <h3>Earlier years</h3><div className="commodity-table"><table><caption>Annual quantities in tonnes, same product form</caption><thead><tr><th>Year</th><th>Production</th><th>Imports</th><th>Exports</th></tr></thead><tbody>{profile.history.map(y => <tr key={y.year}><th scope="row">{y.year}</th><td>{number(y.production)}</td><td>{number(y.imports)}</td><td>{number(y.exports)}</td></tr>)}</tbody></table></div>
        <h3>What this means for households</h3><p>National food inflation minus general inflation: {profile.food_price_gap ? number(profile.food_price_gap.gap_pct_points,1)+" percentage points ("+monthWords(profile.food_price_gap.period)+")" : "Not available"}. Unable to afford a healthy diet: {profile.healthy_diet_unaffordable ? percent(profile.healthy_diet_unaffordable.value)+" ("+profile.healthy_diet_unaffordable.year+")" : "Not available"}. Neither indicator is specific to this commodity.</p>
      </> : <p>We hold no figures for this crop in this country for that year. That is a gap in what is published, not a statement that the country grows or buys none.</p>}
    </>}
    
    {mode === "stress" && <>
      <p className="commodity-warning"><strong>Scenario only.</strong> Uses historical annual bilateral flows, prorated evenly across months; does not model seasonality, prices, hunger or accessible stocks. An absent flow is unknown, not zero.</p>
      {geo === "global" || !profile || !actualSupplier ? <p>Select a country with observed suppliers to explore a shipment interruption.</p> : <>
        <label>Which supplier is interrupted<select value={actualSupplier.iso3} onChange={e=>setSupplier(e.target.value)}>{profile.suppliers.map(s=><option key={s.iso3} value={s.iso3}>{s.name}</option>)}</select></label>
        <div className="commodity-grid commodity-controls">
          <label>How much of its shipments stop: {stop}%<input type="range" min="0" max="100" step="5" value={stop} onChange={e=>setStop(+e.target.value)}/></label>
          <label>For how long: {months} months<input type="range" min="1" max="12" value={months} onChange={e=>setMonths(+e.target.value)}/></label>
          <label>How much can be bought elsewhere: {replacement}%<input type="range" min="0" max="100" step="5" value={replacement} onChange={e=>setReplacement(+e.target.value)}/></label>
          <label>Months before anyone acts: {delay} months<input type="range" min="0" max="12" value={delay} onChange={e=>setDelay(+e.target.value)}/></label>
        </div>
        <label className="commodity-check"><input type="checkbox" checked={compound} onChange={e=>setCompound(e.target.checked)}/> Apply the same supplier disruption to wheat, maize and soybeans as additional independent scenarios (rice forms never added together)</label>
        <div className="commodity-table"><table><caption>{nameFor(profile)} · conditional shipment gaps, metric tonnes; different products are not summed</caption><thead><tr><th>Commodity / year</th><th>Reporting basis</th><th>No action</th><th>Early action</th><th>Delayed action</th></tr></thead><tbody>{scenarioRows.map(s=><tr key={s.id}><th scope="row">{s.name} · {s.year ?? "unknown"}</th><td>{s.flow == null ? "Unknown" : s.basis?.replaceAll("_"," ")}</td><td>{t(s.early?.gross)}</td><td>{t(s.early?.residual)}</td><td>{t(s.late?.residual)}</td></tr>)}</tbody></table></div>
        <p className="figure-note">Early action assumes replacement begins immediately; delayed action starts after the selected lead time. Replacement availability is hypothetical; the same supplier may serve competing buyers. No aggregation or substitution across products is inferred.</p>
        <h3>Decision options and constraints</h3><div className="commodity-grid"><article className="commodity-panel"><strong>Importers</strong><p>Check alternative suppliers' exportable surplus, financing and transit time before purchasing.</p></article><article className="commodity-panel"><strong>Government</strong><p>Independently verify accessible reserves and assess targeted affordability support. Consider displacement of other buyers.</p></article></div>
      </>}
      <p><a href={href("what-if")}>The wheat what-if test, which also names who else would be bidding</a></p>
    </>}
    
    <details className="commodity-panel"><summary>Evidence and methods</summary><dl>{Object.entries(method).map(([id,value])=><div key={id}><dt><strong>{id.replaceAll("_"," ")}</strong></dt><dd>{value}</dd></div>)}</dl><ul>{Object.entries(sources).map(([id,url])=><li key={id}><a href={url}>{id}</a>{Object.hasOwn(provider_updated,id) ? " · provider update "+(provider_updated[id] || "unknown") : ""}</li>)}</ul><p>Release {release.manifest.release_id}. Data dates differ by source. <a href={href("how")}>Data and methods</a></p></details>
    {mode !== "stress" && <p><a href={href("commodities","what-if",{commodity:key,geo})}>See what an interruption would mean →</a></p>}
  </section>;
}

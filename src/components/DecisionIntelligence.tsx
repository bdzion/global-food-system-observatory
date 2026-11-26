import { useEffect,useState } from "react";
import { loadCommodityIndex, coverageFor, priceAge, type CommodityRelease } from "../lib/commodities";
import { hasFile, readVerified } from "../lib/data";
import { ExternalEvidence } from "./ExternalEvidence";
import { ApiEvidence } from "./ApiEvidence";
import { SpatialEvidence,ValidationEvidence,AuthenticatedEvidence } from "./AdvancedEvidence";
import { AssessmentArchive } from "./AssessmentArchive";
import { ThreatGuide } from "./ReaderGuide";
import { DecisionDesk } from "./DecisionDesk";
import { monthWords } from "../lib/format";
import { href, type Route } from "../lib/router";
import type { Release,Price } from "../lib/types";
import { RankedBars,SeriesChart } from "./EvidenceVisuals";
type ContextIndicator={code:string;label:string;unit:string;limitation:string;source:string;url:string;status:string;records:Record<string,{year:number;value:number}>};
type Context={schema_version:number;retrieved_at:string;indicators:Record<string,ContextIndicator>};
const fmt=(n:number|null|undefined)=>n==null?"Unknown":new Intl.NumberFormat("en",{maximumFractionDigits:2}).format(n);
const readPref=(key:string,fallback:string)=>{try{return JSON.parse(localStorage.getItem("gfso.commodity-context.v1")||"{}")[key]||fallback}catch{return fallback}};
const relevant=(p:Price,commodity:string,benchmark:string|undefined)=>commodity==="all"||p.id===benchmark||["urea_price","dap_price","potash_price","oil_price","gas_price"].includes(p.id);
export function DecisionIntelligence({release,route,mode}:{release:Release;route:Route;mode:"overview"|"watch"|"briefs"|"methods"}){
 const [data,setData]=useState<CommodityRelease|null>(null);
 const [context,setContext]=useState<Context|null>(null);
 const [error,setError]=useState("");
 const [geo,setGeo]=useState(()=>route.query.get("geo")||readPref("geo","global"));
 const [commodity,setCommodity]=useState(()=>route.query.get("commodity")||readPref("commodity","all"));
 const [metric,setMetric]=useState<"gross_import_share_pct"|"supplier_hhi"|"imports_t">("gross_import_share_pct");
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{let stop=false;loadCommodityIndex(release.manifest).then(d=>{if(!stop)setData(d)}).catch(e=>{if(!stop)setError(String(e))});if(hasFile(release.manifest,"country-context.json"))readVerified<Context>(release.manifest,"country-context.json").then(c=>{if(!stop)setContext(c)}).catch(e=>{if(!stop)setError(String(e))});return()=>{stop=true}},[release.manifest]);
 useEffect(()=>{const p=route.query.get("commodity"),g=route.query.get("geo");if(p)setCommodity(p);if(g)setGeo(g)},[route.query]);
 const names:Record<string,string>=data?.country_names||Object.fromEntries(Object.values(data?.products||{}).flatMap(p=>Object.values(p.countries).map(r=>[r.iso3,r.name])));
 const products=data?.products||{};
 const selected=commodity==="all"||Object.hasOwn(products,commodity)?commodity:"all";
 const country=geo==="global"?"Global":names[geo]||geo;
 const benchmark=selected==="all"?undefined:products[selected]?.price?.id;
 const all=Object.values(release.world.prices);
 const eligible=all.filter(p=>priceAge(p.latest_period)==="current"&&relevant(p,selected,benchmark));
 const signals=eligible.filter(p=>["climbing","climbing_fast","falling"].includes(p.climb_reading.state)&&p.climb_anomaly!=null).sort((a,b)=>Math.abs(b.climb_anomaly!)-Math.abs(a.climb_anomaly!));
 const excluded=all.filter(p=>priceAge(p.latest_period)!=="current");
 const coverage=data?coverageFor(data):{};
 const coverageRows=Object.values(coverage);
 const countryRows=Object.entries(products).filter(([id])=>selected==="all"||id===selected).flatMap(([id,p])=>p.countries[geo]?[{id,name:p.name,year:p.year,r:p.countries[geo]}]:[]);
 const change=(p:string,g:string)=>{setCommodity(p);setGeo(g);try{localStorage.setItem("gfso.commodity-context.v1",JSON.stringify({commodity:p,geo:g}))}catch{/* optional */}window.history.replaceState(null,"",href(route.page,route.id,{commodity:p,geo:g}));window.dispatchEvent(new Event("gfso-context"));};
 const link=(page:string,p=selected,g=geo)=>href(page,undefined,{commodity:p==="all"&&["commodities","stress"].includes(page)?"wheat":p,geo:g});
 const titles={overview:"Latest figures",watch:"The threats",briefs:"Country briefs",methods:"Sources and methods"};
 const leads={watch:"Four things can interrupt a country\u2019s food supply: a poor harvest, costlier inputs, a blocked trade route, or disease and infrastructure failure. Below is what each looks like, and what the latest published figures say. A price that has moved is a reason to ask a question, not evidence that food is short.",briefs:"Everything the site holds for one country and one food, on one page, with the date of every figure. Choose them above, then download a short summary for colleagues.",methods:"Where every figure comes from, how recent it is, how it is worked out, and what it cannot tell you.",overview:"Latest figures."};
 return <section className="intelligence">
 <p className="commodity-kicker">Global food supply · published figures</p><h1>{titles[mode]}</h1>
 <p className="lede">{leads[mode]}</p>
 {mode==="watch"&&<ThreatGuide route={route}/>}
 <div className="commodity-filter"><label>Food product<select aria-label="Commodity" value={selected} onChange={e=>change(e.target.value,geo)}><option value="all">All products</option>{Object.entries(products).map(([id,p])=><option value={id} key={id}>{p.name}</option>)}</select></label><label>Country<select aria-label="Country" value={geo} onChange={e=>change(selected,e.target.value)}><option value="global">Global</option>{Object.entries(names).sort((a,b)=>a[1].localeCompare(b[1])).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label><p className="figure-note">{country} · {selected==="all"?"All commodities":products[selected]?.name} · release {release.manifest.release_id}</p></div>
 {error&&<p role="alert">Some detail evidence is unavailable: {error}</p>}
 {mode==="briefs"&&<DecisionDesk release={release} data={data} geo={geo} commodity={selected} country={country} mode={mode}/>}
 {mode==="watch"&&<>
 <h2>What has changed?</h2>
 <p>We follow {eligible.length} international prices that are current enough to compare. {signals.length===0?"None of them has moved unusually.":signals.length===1?"One of them has moved more than it usually does.":"Of these, "+signals.length+" have moved more than they usually do."} {excluded.length>0&&<>{excluded.length===1?"One other price is":excluded.length+" other prices are"} too old to judge, and {excluded.length===1?"is":"are"} left out.</>}</p>
 {signals.length===0?<p>No unusually large change was found in the recent international prices shown here. This does not mean conditions are stable; other prices and hazards may not be covered.</p>:<div className="visual-grid">{signals.slice(0,signals.length).map(p=>{
   const input=["urea_price","dap_price","potash_price","oil_price","gas_price"].includes(p.id);
   const rising=p.climb_reading.state!=="falling";
   return <article className="visual-panel" key={p.id}><p className="commodity-kicker">{rising?"Rising unusually fast":"Falling unusually fast"}</p><h3>{p.plain_name}</h3><strong className="commodity-value">{fmt(p.latest_value)} {p.unit}</strong><p>{monthWords(p.latest_period)} · {p.change_over_year_pct==null?"change over a year not available":(p.change_over_year_pct>0?"up ":"down ")+fmt(Math.abs(p.change_over_year_pct))+"% on a year earlier"}</p><p><strong>Why it matters:</strong> {input?"Farm and transport costs may rise. How much and how soon depends on local prices and contracts.":"This may put pressure on buyers but does not show what families pay or how much food is available."}</p><p><strong>What to check:</strong> {input?"Check input costs, when contracts expire and whether other suppliers are available before planting.":"Check local prices, reliance on affected suppliers and usable stocks before changing purchasing or food assistance."}</p><p className="figure-note">These figures do not establish a deadline for action. <a href="https://www.worldbank.org/en/research/commodity-markets">World Bank benchmark source</a> · <a href={link("commodities")}>Check import reliance</a> · <a href={link("stress")}>Try a possible interruption</a></p></article>;
 })}</div>}
 {<details className="visual-panel"><summary>Older prices not used to assess recent changes ({excluded.length})</summary><ul>{excluded.map(p=><li key={p.id}>{p.plain_name}: last reading {monthWords(p.latest_period)}</li>)}</ul></details>}
 {eligible.length>0&&<SeriesChart title="How each price has moved since its own earliest reading" unit="100 = that price at the start of the series" series={eligible.slice(0,4).map(p=>{const base=p.history.find(v=>v.value>0)?.value;return {name:p.plain_name,points:p.history.map(v=>({period:v.period,value:base?v.value/base*100:null}))}})}/>}
 </>}
 {geo!=="global"&&mode!=="methods"&&<section className="visual-panel"><h2>{country}: reliance on imports and stocks</h2><p>Each food is shown separately, and dates can differ. Import share may exceed 100% when food is sold on to other countries.</p><label>Compare indicator<select value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="gross_import_share_pct">Imports as share of available supply (%)</option><option value="supplier_hhi">Reliance on a few suppliers (HHI)</option><option value="imports_t">Imports (t)</option></select></label><RankedBars title="Selected country across products" unit={metric==="imports_t"?"t":metric==="supplier_hhi"?"":"%"} rows={countryRows.filter(x=>x.r[metric]!=null).sort((a,b)=>b.r[metric]!-a.r[metric]!).slice(0,12).map(x=>({id:x.id,name:x.name+" · "+x.year,value:x.r[metric]!}))} onSelect={id=>change(id,geo)}/><div className="commodity-table" tabIndex={0}><table><caption>Country-product evidence, not a risk ranking</caption><thead><tr><th>Product</th><th>Year</th><th>Imports (t)</th><th>Gross share (%)</th><th>Supplier concentration (0–1)</th><th>Stock cover (months)</th></tr></thead><tbody>{countryRows.map(x=><tr key={x.id}><th scope="row"><a href={link("commodities",x.id)}>{x.name}</a></th><td>{x.year}</td><td>{fmt(x.r.imports_t)}</td><td>{fmt(x.r.gross_import_share_pct)}</td><td>{fmt(x.r.supplier_hhi)}</td><td>{fmt(x.r.estimated_cover_months)}</td></tr>)}</tbody></table></div></section>}
 {mode==="briefs"&&<section className="visual-panel"><h2>Environment, nutrition and infrastructure</h2><p>Country context, not live crop conditions. Water stress is not drought; electricity access is not cold-chain capacity. Latest available observation per indicator, with its own year.</p>{!context?<p>Additional context has not been published in this snapshot.</p>:geo==="global"?<p>Select a country to examine structural indicators. {Object.values(context.indicators).filter(i=>i.status==="available").length} indicator feeds contain records.</p>:<div className="visual-grid">{Object.values(context.indicators).map(i=>{const v=i.records[geo];return <article className="source-tile" key={i.code}><h3>{i.label}</h3><strong>{v?fmt(v.value)+" "+i.unit:"Unknown"}</strong><p>{v?"Observation year "+v.year:i.status}</p><p className="figure-note">{i.limitation} <a href={i.url}>Source & definition</a></p></article>})}</div>}</section>}
 {(mode==="watch"||mode==="overview")&&<SpatialEvidence release={release} geo={geo}/>}
 {mode==="methods"&&<><ValidationEvidence release={release}/><AuthenticatedEvidence release={release} geo={geo}/></>}
 {mode==="watch"&&<ApiEvidence release={release} geo={geo} commodity={selected} compact/>}
 {mode==="watch"&&<ExternalEvidence release={release} commodity={selected} country={country} geo={geo} compact/>}
 {mode==="watch"&&<section className="visual-panel"><h2>What we still need to know</h2><div className="visual-grid">{[["Crop conditions","GEOGLAM seasonal crop assessment"],["Broader domestic commodity price coverage","GIEWS / HDX beyond the existing pilot"],["Trade disruption","Comtrade, PortWatch"],["Animal disease","WOAH WAHIS"],["Cold chain","Verified logistics and refrigeration evidence"],["Food insecurity","IPC / WFP assessments"]].map(([n,s])=><article className="source-tile" key={n}><h3>{n}</h3><p>Not fully covered by the figures on this site.</p><small>Possible source: {s}</small></article>)}</div><p>Missing observations are unknown, not reassuring. <a href={href("how")}>Data and methods</a></p></section>}
 {mode==="methods"&&<section className="visual-panel"><h2>Which figures are available?</h2><p>Number of countries with each figure, including reported zeros. More records do not necessarily mean more reliable figures.</p><div className="commodity-table" tabIndex={0}><table><caption>Country counts by product and indicator</caption><thead><tr>{["Product","Year","Profiles","Production","Imports","Exports","Suppliers","Aligned suppliers","Stock cover","Latest price reading"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{coverageRows.map(c=><tr key={c.name}><th scope="row">{c.name}</th><td>{c.year??"—"}</td><td>{c.countries}</td><td>{c.production_t}</td><td>{c.imports_t}</td><td>{c.exports_t}</td><td>{c.suppliers}</td><td>{c.aligned_suppliers}</td><td>{c.estimated_cover_months}</td><td>{c.price_period?monthWords(c.price_period):"—"}</td></tr>)}</tbody></table></div><p className="figure-note">Release build: {release.manifest.generated_at_utc}; WDI retrieval: {context?.retrieved_at||"not recorded in this release"}. Provider update dates are shown in the source directory.</p></section>}
 {mode==="briefs"&&<AssessmentArchive release={release}/>}
 {mode==="briefs"&&<section className="visual-panel"><h2>Before sharing a brief</h2><p>Automatically prepared summary for {country}. {signals.length} unusual price changes; {countryRows.length} matching country and food records. Verify local context, supplier capacity and affected actors before any intervention.</p><button className="visual-button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded?"Hide":"Show"} review checklist</button>{expanded&&<ol><li>Confirm event and observation dates.</li><li>Check exact product and reporting period.</li><li>Verify physical stocks, alternative capacity and delivery time.</li><li>Compare early and delayed action, including equity and displaced buyers.</li><li>Record assumptions and revisit after the next observation.</li></ol>}<p><a href="https://bdzion.github.io/canada-food-system-observatory/#/">Canada Food System Observatory</a> · <a href="https://bdzion.github.io/canada-food-stress-test/">Canada Food System Stress Test</a> · <a href={link("stress")}>Global scenario laboratory</a></p></section>}
 {mode!=="methods"&&<p><a href={link("commodities")}>The indicators →</a> · <a href={link("watch")}>The threats →</a> · <a href={link("briefs")}>Prepare a country brief →</a></p>}
 </section>;
}

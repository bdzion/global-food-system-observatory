import { useState } from "react";
import type { Release } from "../lib/types";

const SOURCES = [
  ["Markets & supply","USDA PSD","https://fas.usda.gov/psdonline","Monthly production, consumption and stocks; marketing years","Optional bulk adapter; see Seasonal and market evidence for actual status","Keep marketing-year and calendar-year stocks separate."],
  ["Markets & supply","AMIS","https://www.amis-outlook.org/","Monthly wheat, maize, rice and soybean market assessments","External reference","Distinguish forecasts from observations."],
  ["Markets & supply","FAO GIEWS / FPMA","https://www.fao.org/giews/food-prices/en/","Domestic commodity prices; market-specific reporting","External reference","Preserve location, market type, currency and unit."],
  ["Markets & supply","UN Comtrade","https://comtrade.un.org/","Bilateral trade including agricultural inputs","External reference","Reconcile HS revisions and quantity units."],
  ["Climate & environment","GEOGLAM Crop Monitor","https://www.cropmonitor.org/data-archive","Monthly crop conditions and maps","Optional dated layer catalogue adapter; see actual release status","Crop condition is not an observed yield loss."],
  ["Climate & environment","CHIRPS","https://www.chc.ucsb.edu/data/chirps","Rainfall anomalies and drought","External reference","Weight by crop area and growing season."],
  ["Climate & environment","Copernicus Climate Data Store","https://cds.climate.copernicus.eu/","Temperature, soil moisture, climate forecasts","External reference","Verify product-specific licence and evidence class."],
  ["Climate & environment","FAO AQUASTAT","https://www.fao.org/aquastat/en/","Water use, resources and irrigation","External reference","Structural evidence is not current irrigation availability."],
  ["Climate & environment","GDACS","https://www.gdacs.org/","Disaster alerts","External reference","Event location alone does not establish crop damage."],
  ["Livestock & logistics","WOAH WAHIS","https://wahis.woah.org/","Animal disease reports","External reference","Missing reports do not mean no disease."],
  ["Livestock & logistics","IMF PortWatch","https://portwatch.imf.org/","Port and maritime disruption monitoring","External reference","Port activity is not commodity-specific shipment or cold-chain evidence."],
  ["Livestock & logistics","FAO FishStat","https://www.fao.org/fishery/en/statistics","Fisheries and aquaculture production","External reference","Keep live-weight and processed product quantities separate."],
  ["Food access & nutrition","WFP HungerMap Live","https://hungermap.wfp.org/","Food security and predictive monitoring","External reference","Distinguish observations, nowcasts and forecasts."],
  ["Food access & nutrition","HDX HAPI","https://hdx-hapi.readthedocs.io/en/latest/","Humanitarian indicators and market prices","Documented API; ingestion pending","Verify underlying data licences, market definitions and dates."],
  ["Food access & nutrition","IPC","https://www.ipcinfo.org/","Acute food insecurity classification","External reference","Preserve assessment period and geographic resolution."],
  ["Food access & nutrition","Food Systems Dashboard","https://www.foodsystemsdashboard.org/","Diet, health, environment, livelihoods and resilience","External reference","Retain original indicator definitions and sources."],
  ["Food access & nutrition","UNICEF Data","https://data.unicef.org/","Child nutrition and household vulnerability","External reference","Show survey dates and coverage."],
  ["Emerging events","ReliefWeb","https://reliefweb.int/","Humanitarian reports and events","External reference","Corroborate timing and affected commodities."],
  ["Emerging events","IFPRI Food Security Portal","https://www.foodsecurityportal.org/","Market and trade policy monitoring","External reference","Verify dataset rights and dates."],
];
export function SourceAtlas({release}: {release:Release}) {
  const [group,setGroup]=useState("All");
  const [query,setQuery]=useState("");
  const groups=["All",...new Set(SOURCES.map(s=>s[0]))];
  const rows=SOURCES.filter(s=>(group==="All"||s[0]===group)&&s.join(" ").toLowerCase().includes(query.toLowerCase()));
  return <section className="visual-panel">
    <p className="commodity-kicker">Sources of information</p><h2>Data sources and coverage</h2>
    <p>Published release: {release.manifest.release_id}. Reference links are provided for further reading; not all supply data to this site.</p>
    <div className="source-grid">{release.sources.sources.map(s=><article className="source-tile" key={s.id}><span className="source-status">{s.older_than_expected?"Older than expected":"Published source"}</span><h3><a href={s.documentation_url}>{s.provider}</a></h3><p>{s.plain_name||s.dataset}</p><small>Provider update: {s.provider_updated||"Unknown"} · {s.expected_frequency}</small><p className="figure-note">{s.caveat}</p></article>)}</div>
    <h3>Other places to look</h3><p>These organisations publish figures we do not yet carry. We have to check what each one allows us to republish before we can bring it in, so for now these are links out.</p>
    <div className="commodity-filter"><label>Domain<select value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g}>{g}</option>)}</select></label><label>Find a source<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. climate, stocks, nutrition"/></label></div>
    <div className="source-grid">{rows.map(s=><article className="source-tile" key={s[1]}><span className="source-status reference">{s[4]}</span><h3><a href={s[2]}>{s[1]}</a></h3><p>{s[3]}</p><p className="figure-note">{s[5]}</p></article>)}</div>{!rows.length&&<p>No sources match.</p>}
    <p className="figure-note">We check where figures come from, whether we can use them and whether they are consistent before publishing.</p>
  </section>;
}
const PATHWAYS=[
  ["Fertilizer and energy → crops","Fertilizer / energy","Staples & oilseeds","Production costs and next-season supply","Input use, timing and farm budgets; cost rise does not imply a fixed yield loss."],
  ["Grains and oilseeds → livestock","Maize / soybean / barley","Feed → meat, eggs and dairy","Feed affordability and animal production","Ration suitability, feed quality, procurement capacity and livestock cycle."],
  ["Oilseed processing → edible oils","Soybeans / rapeseed / sunflower","Oil & meal","Cooking oil and feed co-products","Processing yields and capacity; avoid double counting seeds and oils."],
  ["Pulses → nutrition","Beans / lentils / chickpeas","Household food access","Plant protein affordability","Dietary preferences, preparation costs and nutritional equivalence."],
  ["Perishable food → cold chain","Fruit / vegetables / animal foods","Storage and transport","Spoilage and local availability","Temperature control, electricity, transit time and product shelf life."],
];
export function SystemPathways(){
  return <section className="visual-panel"><p className="commodity-kicker">Connections in the food system</p><h2>How disruptions can spread</h2><p>These examples show how one problem might affect another part of the system. Open each example to see what needs to be checked. They are not measured effects.</p><div className="pathway-grid">{PATHWAYS.map(p=><details className="source-tile" key={p[0]}><summary>{p[0]}</summary><div className="pathway-flow"><span>{p[1]}</span><b aria-hidden="true">→</b><span>{p[2]}</span></div><p><strong>Potential consequence:</strong> {p[3]}</p><p className="figure-note">{p[4]}</p></details>)}</div></section>;
}

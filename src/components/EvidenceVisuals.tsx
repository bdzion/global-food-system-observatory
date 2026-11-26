import { useEffect, useState } from "react";
import { monthShort, monthWords } from "../lib/format";
import { type Commodity, type CommodityProfile } from "../lib/commodities";
import type { Price } from "../lib/types";

type MapCountry = { iso3: string; name: string; d: string };
type Geometry = { width: number; height: number; countries: MapCountry[] };
type Metric = "imports_t" | "production_t" | "exports_t" | "gross_import_share_pct" | "supplier_hhi" | "estimated_cover_months";
const METRICS: Record<Metric, { label: string; unit: string }> = {
  imports_t: { label: "Imports", unit: "t" },
  production_t: { label: "Production", unit: "t" },
  exports_t: { label: "Exports", unit: "t" },
  gross_import_share_pct: { label: "Imports as share of available supply", unit: "%" },
  supplier_hhi: { label: "Reliance on a few suppliers (HHI)", unit: "" },
  estimated_cover_months: { label: "Estimated stock cover", unit: "months" },
};
const fmt = (v: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(v);
const val = (v: number | null | undefined, unit = "") => v == null ? "Not available" : fmt(v) + (unit ? " " + unit : "");
const COLORS = ["#e2edf6","#b8d4e9","#78add1","#397db0","#174d7d"];

export function mapBin(value: number | null | undefined, max: number): number {
  if (value == null || !Number.isFinite(value) || value < 0) return -1;
  if (value === 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil(value / max * 5) - 1);
}

export function WorldEvidenceMap({product, selected, onSelect}: {product: Commodity; selected: string; onSelect: (iso: string)=>void}) {
  const [geometry,setGeometry] = useState<Geometry | null>(null);
  const [error,setError] = useState(false);
  const [metric,setMetric] = useState<Metric>("imports_t");
  const [scale,setScale]=useState("relative");
  const [hover,setHover] = useState<string | null>(null);
  useEffect(()=>{
    let cancelled=false;
    fetch(import.meta.env.BASE_URL+"world-paths.json").then(r=>{
      if (!r.ok) throw Error("Map not available");
      return r.json() as Promise<Geometry>;
    }).then(g=>{if(!cancelled) setGeometry(g)}).catch(()=>{if(!cancelled)setError(true)});
    return ()=>{cancelled=true};
  },[]);
  const rows=Object.values(product.countries);
  const values=rows.map(r=>r[metric]).filter((v):v is number=>v!=null&&Number.isFinite(v)&&v>=0);
  const max=Math.max(0,...values);
  const meta=METRICS[metric];
  const sorted=[...values].sort((a,b)=>a-b);
  const limits=scale==="quantile"&&sorted.length?Array.from({length:5},(_,i)=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*(i+1)/5)-1)]):Array.from({length:5},(_,i)=>max*(i+1)/5);
  const bin=(v:number|null|undefined)=>v==null||!Number.isFinite(v)||v<0?-1:Math.max(0,limits.findIndex(t=>v<=t));
  const focus=hover || (selected!=="global"?selected:null);
  const current=focus?product.countries[focus]:undefined;
  const joined=geometry ? new Set(geometry.countries.map(c=>c.iso3)) : null;
  const unmapped=joined?rows.filter(r=>!joined.has(r.iso3)&&r[metric]!=null).length:0;
  return <section className="visual-panel">
    <div className="visual-head"><div><p className="commodity-kicker">Who grows it, who buys it</p><h2>Where the world’s {product.name.toLowerCase()} comes from</h2></div>
      <label>Map indicator<select value={metric} onChange={e=>setMetric(e.target.value as Metric)}>{Object.entries(METRICS).map(([id,m])=><option key={id} value={id}>{m.label}</option>)}</select></label></div>
    <p className="figure-note">{meta.label} · {product.year??"unknown year"} · FAOSTAT. Click a country or use the country selector above. Darker colours show larger values, not greater risk.</p>
    <label>Map colour scale<select value={scale} onChange={e=>setScale(e.target.value)}><option value="relative">Equal value ranges</option><option value="quantile">Equal numbers of countries (approximately)</option></select></label>
    {error?<p role="alert">Map geometry could not be loaded; use the country table and selector instead.</p>:!geometry?<p role="status">Loading country outlines…</p>:
      <svg className="evidence-map" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="group" aria-label={`World map of ${meta.label} for ${product.name}`} onPointerLeave={()=>setHover(null)}>
        <defs><pattern id="map-missing" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#d7dbe0"/><path d="M0 6L6 0" stroke="#a6afb9" strokeWidth=".75"/></pattern></defs>
        {geometry.countries.map((c,i)=>{
          const row=product.countries[c.iso3];const b=bin(row?.[metric]);
          return <path key={c.iso3+i} d={c.d} fill={b<0?"url(#map-missing)":COLORS[b]} stroke={selected===c.iso3?"#d06b27":"#ffffff"} strokeWidth={selected===c.iso3?2:.55} role="button" tabIndex={row?0:-1}
            aria-label={c.name+": "+val(row?.[metric],meta.unit)} aria-pressed={selected===c.iso3}
            onPointerEnter={()=>setHover(c.iso3)} onFocus={()=>setHover(c.iso3)} onBlur={()=>setHover(null)}
            onClick={()=>{if(row)onSelect(c.iso3)}} onKeyDown={e=>{if(row&&(e.key==="Enter"||e.key===" ")){e.preventDefault();onSelect(c.iso3)}}}>
            <title>{c.name}: {val(row?.[metric],meta.unit)}</title></path>;
        })}
      </svg>}
    <div className="map-legend" aria-label="Map legend">{COLORS.map((color,i)=><span key={color}><i style={{background:color}}/>{i===0?"0–"+fmt(limits[0]):">"+fmt(limits[i-1])+"–"+fmt(limits[i])} {meta.unit}</span>)}<span><i className="missing-swatch"/>No observation</span></div>
    <p className="map-readout" aria-live="polite">{focus?(current?.name??geometry?.countries.find(c=>c.iso3===focus)?.name??focus)+": "+val(current?.[metric],meta.unit):"Select or focus a country to inspect its value."}</p>
    <p className="figure-note">{values.length} country records with this indicator; {unmapped} observed records not joined to the simplified map. Stock cover is estimated, not verified reserves. Boundaries: <a href="https://www.naturalearthdata.com/about/">Natural Earth</a>, public domain; generalized de facto boundaries do not imply endorsement.</p>
    {selected!=="global"&&<button className="visual-button" onClick={()=>onSelect("global")}>Return to global view</button>}
  </section>;
}

export function RankedBars({title, rows, unit, onSelect}: {title:string; rows:{id:string;name:string;value:number}[];unit:string;onSelect?:(id:string)=>void}) {
  const max=Math.max(0,...rows.map(r=>r.value));
  return <section className="visual-panel"><h3>{title}</h3>{rows.length? <div className="ranked-bars">{rows.map(r=><div className="rank-row" key={r.id}>
    {onSelect?<button className="rank-label" onClick={()=>onSelect(r.id)}>{r.name}</button>:<span className="rank-label">{r.name}</span>}
    <div className="rank-track" aria-hidden="true"><span style={{width:(max>0?100*r.value/max:0)+"%"}}/></div><strong>{val(r.value,unit)}</strong>
  </div>)}</div>:<p>No observations available.</p>}</section>;
}

type Point={period:string;value:number|null};
export function SeriesChart({title,series,unit}: {title:string;series:{name:string;points:Point[]}[];unit:string}) {
  const [active,setActive]=useState<string|null>(null);
  const observed=[...new Set(series.flatMap(s=>s.points.map(p=>p.period)))].sort();
  const monthly=observed.length>0&&observed.every(p=>/^\d{4}M\d{2}$/.test(p));
  const yearly=observed.length>0&&observed.every(p=>/^\d{4}$/.test(p));
  const idx=(p:string)=>monthly?Number(p.slice(0,4))*12+Number(p.slice(5))-1:Number(p);
  const periods=(monthly||yearly)&&idx(observed[observed.length-1])-idx(observed[0])<1000?Array.from({length:idx(observed[observed.length-1])-idx(observed[0])+1},(_,i)=>{const n=idx(observed[0])+i;return monthly?Math.floor(n/12)+"M"+String(n%12+1).padStart(2,"0"):String(n)}):observed;
  const values=series.flatMap(s=>s.points.map(p=>p.value)).filter((v):v is number=>v!=null&&Number.isFinite(v));
  if(!values.length||!periods.length)return <section className="visual-panel"><h3>{title}</h3><p>No observations available.</p></section>;
  const min=Math.min(0,...values), max=Math.max(0,...values);
  const x=(i:number)=>65+i*555/Math.max(1,periods.length-1);
  const y=(v:number)=>180-(v-min)/(max-min||1)*150;
  const palette=["#276ca6","#bd6a29","#288064","#8255a6","#9e3b61","#76802e"];
  const chosen=active&&periods.includes(active)?active:periods[periods.length-1];
  return <section className="visual-panel"><h3>{title}</h3>
    <svg viewBox="0 0 650 215" className="evidence-chart" role="img" aria-label={title+"; "+unit+"; values also available in the tables"}>
      {[0,.25,.5,.75,1].map(f=>{const v=min+(max-min)*f;return <g key={f}><line x1="65" x2="620" y1={y(v)} y2={y(v)} stroke="var(--line)"/><text x="59" y={y(v)+4} textAnchor="end" fontSize="10" fill="currentColor">{new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(v)}</text></g>})}
      {series.map((s,si)=>{const lookup=new Map(s.points.map(p=>[p.period,p.value]));let paths:string[]=[];let d="";periods.forEach((p,i)=>{const v=lookup.get(p);if(v==null||!Number.isFinite(v)){if(d)paths.push(d);d="";return;}d+=(d?" L":"M")+x(i)+","+y(v);});if(d)paths.push(d);return <g key={s.name}>{paths.map((path,i)=><path key={i} d={path} stroke={palette[si%palette.length]} strokeWidth="2.5" fill="none"/>)}{periods.map((p,i)=>{const v=lookup.get(p);return v==null?null:<circle key={p} cx={x(i)} cy={y(v)} r={p===chosen?4:2} fill={palette[si%palette.length]}><title>{s.name} · {monthWords(p)}: {val(v,unit)}</title></circle>})}</g>})}
      {periods.map((p,i)=>(i===0||i===periods.length-1||i%Math.max(1,Math.ceil(periods.length/5))===0)?<text key={p} x={x(i)} y="202" textAnchor="middle" fontSize="10" fill="currentColor">{monthShort(p)}</text>:null)}
    </svg>
    <div className="map-legend">{series.map((s,i)=><span key={s.name}><i style={{background:palette[i%palette.length]}}/>{s.name}</span>)}</div>
    <label>Inspect month<select value={chosen} onChange={e=>setActive(e.target.value)}>{periods.map(p=><option key={p} value={p}>{monthWords(p)}</option>)}</select></label>
    <p className="map-readout" aria-live="polite">{monthWords(chosen)}: {series.map(s=>s.name+" "+val(s.points.find(p=>p.period===chosen)?.value,unit)).join(" · ")}</p>
  </section>;
}

export function PriceTrend({price}:{price:Price|null}) {
  return price?<><p className="figure-note">Latest reading: {monthWords(price.latest_period)}. Historical and delayed series are excluded from current signals.</p><SeriesChart title={price.plain_name+" — monthly history"} unit={price.unit} series={[{name:price.plain_name,points:price.history}]}/></>:<p className="figure-note">No international benchmark price connected for this exact product.</p>;
}

export function CountryTrends({profile}:{profile:CommodityProfile}) {
  return <SeriesChart title="Production, imports and exports" unit="t" series={(["production","imports","exports"] as const).map(key=>({name:key[0].toUpperCase()+key.slice(1),points:profile.history.map(r=>({period:String(r.year),value:r[key]}))}))}/>;
}

/** Observed bilateral flows, not a shipping-route map. */
export function SupplierNetwork({profile}:{profile:CommodityProfile}){
 const rows=profile.suppliers.slice(0,8);
 const [active,setActive]=useState<string|null>(null);
 const top=rows.find(s=>s.iso3===active)||rows[0];
 const max=Math.max(1,...rows.map(s=>s.quantity_t));
 return <section className="visual-panel"><h3>Where the country buys this food</h3><p className="figure-note">Recorded annual trade between countries ({profile.supplier_year??profile.year}); width represents reported tonnes. The lines show trade relationships, not shipping routes.</p>
 {!rows.length?<p>No observed supplier flows.</p>:<><svg viewBox="0 0 650 270" className="evidence-chart" role="group" aria-label="Supplier flows to selected importing country">{rows.map((s,i)=>{const y=25+i*31;return <g key={s.iso3} role="button" tabIndex={0} aria-label={s.name+": "+val(s.quantity_t,"t")} onFocus={()=>setActive(s.iso3)} onPointerEnter={()=>setActive(s.iso3)} onClick={()=>setActive(s.iso3)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setActive(s.iso3)}}}><path d={`M190 ${y} C300 ${y} 365 135 470 135`} stroke={top?.iso3===s.iso3?"#bd6a29":"#397db0"} strokeOpacity=".75" fill="none" strokeWidth={Math.max(1,18*s.quantity_t/max)}/><rect x="4" y={y-11} width="180" height="23" rx="4" fill="var(--accent-soft)" stroke="var(--line)"/><text x="12" y={y+4} fontSize="11" fill="currentColor">{s.name.length>25?s.name.slice(0,24)+"…":s.name}</text><title>{s.name}: {val(s.quantity_t,"t")}</title></g>})}<rect x="470" y="110" width="175" height="50" rx="6" fill="var(--accent-soft)" stroke="var(--line)"/><text x="557" y="132" textAnchor="middle" fill="currentColor" fontSize="12">{profile.name.length>24?profile.name.slice(0,23)+"…":profile.name}</text><text x="557" y="147" textAnchor="middle" fill="currentColor" fontSize="10">Selected importer</text></svg><p className="map-readout" aria-live="polite">{top?top.name+": "+val(top.quantity_t,"t")+" · "+val(top.share_pct,"%")+" of observed flows":""}</p></>}
 </section>;
}
export function ExposurePlot({product,selected,onSelect}:{product:Commodity;selected:string;onSelect:(iso:string)=>void}){
 const rows=Object.values(product.countries).filter(r=>r.gross_import_share_pct!=null&&r.estimated_cover_months!=null);
 const [focus,setFocus]=useState<string|null>(null);
 const maxX=Math.max(100,...rows.map(r=>r.gross_import_share_pct!)),maxY=Math.max(1,...rows.map(r=>r.estimated_cover_months!));
 const x=(v:number)=>62+v/maxX*552,y=(v:number)=>220-v/maxY*190;
 const r=rows.find(v=>v.iso3===(focus||selected));
 return <details className="visual-panel"><summary>Compare import reliance and estimated stocks ({rows.length} complete records)</summary><p className="figure-note">FAO-derived estimates for {product.year??"unknown year"}. Only complete cases appear; stock cover is not verified accessible reserves. No vulnerability thresholds or rankings are inferred.</p>{rows.length?<><svg viewBox="0 0 650 265" className="evidence-chart" role="group" aria-label="Scatterplot of gross import share and estimated stock cover">{[0,.25,.5,.75,1].map(t=><g key={t}><line x1="62" x2="614" y1={y(t*maxY)} y2={y(t*maxY)} stroke="var(--line)"/><text x="55" y={y(t*maxY)+4} textAnchor="end" fontSize="10" fill="currentColor">{fmt(t*maxY)}</text><text x={x(t*maxX)} y="237" textAnchor="middle" fontSize="10" fill="currentColor">{fmt(t*maxX)}</text></g>)}{rows.map(row=><circle key={row.iso3} cx={x(row.gross_import_share_pct!)} cy={y(row.estimated_cover_months!)} r={row.iso3===selected?6:3.8} fill={row.iso3===selected?"#bd6a29":"#397db0"} stroke="var(--card)" role="button" tabIndex={0} aria-label={row.name+": "+fmt(row.gross_import_share_pct!)+" percent; "+fmt(row.estimated_cover_months!)+" months"} onFocus={()=>setFocus(row.iso3)} onPointerEnter={()=>setFocus(row.iso3)} onClick={()=>onSelect(row.iso3)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(row.iso3)}}}><title>{row.name}</title></circle>)}<text x="340" y="255" textAnchor="middle" fontSize="11" fill="currentColor">Imports as share of available supply (%)</text><text x="15" y="125" transform="rotate(-90 15 125)" textAnchor="middle" fontSize="11" fill="currentColor">Estimated stock cover (months)</text></svg><p className="map-readout" aria-live="polite">{r?r.name+": "+val(r.gross_import_share_pct,"%")+" · "+val(r.estimated_cover_months,"months"):"Focus a point to inspect a country; click to select."}</p></>:<p>No complete records for this comparison.</p>}</details>;
}

import { useEffect, useState } from "react";
import type { Commodity, CommodityProfile } from "../lib/commodities";
import type { Price } from "../lib/types";

type MapCountry = { iso3: string; name: string; d: string };
type Geometry = { width: number; height: number; countries: MapCountry[] };
type Metric = "imports_t" | "production_t" | "exports_t" | "gross_import_share_pct" | "supplier_hhi" | "estimated_cover_months";
const METRICS: Record<Metric, { label: string; unit: string }> = {
  imports_t: { label: "Imports", unit: "t" },
  production_t: { label: "Production", unit: "t" },
  exports_t: { label: "Exports", unit: "t" },
  gross_import_share_pct: { label: "Gross import share", unit: "%" },
  supplier_hhi: { label: "Supplier concentration (HHI)", unit: "" },
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
  const focus=hover || (selected!=="global"?selected:null);
  const current=focus?product.countries[focus]:undefined;
  const joined=geometry ? new Set(geometry.countries.map(c=>c.iso3)) : null;
  const unmapped=joined?rows.filter(r=>!joined.has(r.iso3)&&r[metric]!=null).length:0;
  return <section className="visual-panel">
    <div className="visual-head"><div><p className="commodity-kicker">Spatial evidence</p><h2>Global {product.name.toLowerCase()} atlas</h2></div>
      <label>Map indicator<select value={metric} onChange={e=>setMetric(e.target.value as Metric)}>{Object.entries(METRICS).map(([id,m])=><option key={id} value={id}>{m.label}</option>)}</select></label></div>
    <p className="figure-note">{meta.label} · {product.year??"unknown year"} · FAOSTAT. Click a country or use the country selector above. Colours are relative to the observed maximum, not risk levels.</p>
    {error?<p role="alert">Map geometry could not be loaded; use the country table and selector instead.</p>:!geometry?<p role="status">Loading country outlines…</p>:
      <svg className="evidence-map" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="group" aria-label={`World map of ${meta.label} for ${product.name}`} onPointerLeave={()=>setHover(null)}>
        <defs><pattern id="map-missing" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#d7dbe0"/><path d="M0 6L6 0" stroke="#a6afb9" strokeWidth=".75"/></pattern></defs>
        {geometry.countries.map((c,i)=>{
          const row=product.countries[c.iso3];const b=mapBin(row?.[metric],max);
          return <path key={c.iso3+i} d={c.d} fill={b<0?"url(#map-missing)":COLORS[b]} stroke={selected===c.iso3?"#d06b27":"#ffffff"} strokeWidth={selected===c.iso3?2:.55} role="button" tabIndex={row?0:-1}
            aria-label={c.name+": "+val(row?.[metric],meta.unit)} aria-pressed={selected===c.iso3}
            onPointerEnter={()=>setHover(c.iso3)} onFocus={()=>setHover(c.iso3)} onBlur={()=>setHover(null)}
            onClick={()=>{if(row)onSelect(c.iso3)}} onKeyDown={e=>{if(row&&(e.key==="Enter"||e.key===" ")){e.preventDefault();onSelect(c.iso3)}}}>
            <title>{c.name}: {val(row?.[metric],meta.unit)}</title></path>;
        })}
      </svg>}
    <div className="map-legend" aria-label="Map legend">{COLORS.map((color,i)=><span key={color}><i style={{background:color}}/>{i===0?"0–"+fmt(max/5):">"+fmt(max*i/5)+"–"+fmt(max*(i+1)/5)} {meta.unit}</span>)}<span><i className="missing-swatch"/>No observation</span></div>
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
  const periods=[...new Set(series.flatMap(s=>s.points.map(p=>p.period)))].sort();
  const values=series.flatMap(s=>s.points.map(p=>p.value)).filter((v):v is number=>v!=null&&Number.isFinite(v));
  if(!values.length||!periods.length)return <section className="visual-panel"><h3>{title}</h3><p>No observations available.</p></section>;
  const min=Math.min(0,...values), max=Math.max(0,...values);
  const x=(i:number)=>65+i*555/Math.max(1,periods.length-1);
  const y=(v:number)=>180-(v-min)/(max-min||1)*150;
  const palette=["#276ca6","#bd6a29","#288064","#8255a6"];
  const chosen=active&&periods.includes(active)?active:periods[periods.length-1];
  return <section className="visual-panel"><h3>{title}</h3>
    <svg viewBox="0 0 650 215" className="evidence-chart" role="img" aria-label={title+"; "+unit+"; values also available in the tables"}>
      {[0,.25,.5,.75,1].map(f=>{const v=min+(max-min)*f;return <g key={f}><line x1="65" x2="620" y1={y(v)} y2={y(v)} stroke="var(--line)"/><text x="59" y={y(v)+4} textAnchor="end" fontSize="10" fill="currentColor">{new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(v)}</text></g>})}
      {series.map((s,si)=>{const lookup=new Map(s.points.map(p=>[p.period,p.value]));let paths:string[]=[];let d="";periods.forEach((p,i)=>{const v=lookup.get(p);if(v==null||!Number.isFinite(v)){if(d)paths.push(d);d="";return;}d+=(d?" L":"M")+x(i)+","+y(v);});if(d)paths.push(d);return <g key={s.name}>{paths.map((path,i)=><path key={i} d={path} stroke={palette[si%4]} strokeWidth="2.5" fill="none"/>)}{periods.map((p,i)=>{const v=lookup.get(p);return v==null?null:<circle key={p} cx={x(i)} cy={y(v)} r={p===chosen?4:2} fill={palette[si%4]}><title>{s.name} · {p}: {val(v,unit)}</title></circle>})}</g>})}
      {periods.map((p,i)=>(i===0||i===periods.length-1||i%Math.max(1,Math.ceil(periods.length/5))===0)?<text key={p} x={x(i)} y="202" textAnchor="middle" fontSize="10" fill="currentColor">{p}</text>:null)}
    </svg>
    <div className="map-legend">{series.map((s,i)=><span key={s.name}><i style={{background:palette[i%4]}}/>{s.name}</span>)}</div>
    <label>Inspect period<select value={chosen} onChange={e=>setActive(e.target.value)}>{periods.map(p=><option key={p}>{p}</option>)}</select></label>
    <p className="map-readout" aria-live="polite">{chosen}: {series.map(s=>s.name+" "+val(s.points.find(p=>p.period===chosen)?.value,unit)).join(" · ")}</p>
  </section>;
}

export function PriceTrend({price}:{price:Price|null}) {
  return price?<SeriesChart title={price.plain_name+" — monthly history"} unit={price.unit} series={[{name:price.plain_name,points:price.history}]}/>:<p className="figure-note">No international benchmark price connected for this exact product.</p>;
}

export function CountryTrends({profile}:{profile:CommodityProfile}) {
  return <SeriesChart title="Production, imports and exports" unit="t" series={(["production","imports","exports"] as const).map(key=>({name:key[0].toUpperCase()+key.slice(1),points:profile.history.map(r=>({period:String(r.year),value:r[key]}))}))}/>;
}

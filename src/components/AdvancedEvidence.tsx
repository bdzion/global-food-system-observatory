import {useEffect,useState} from "react";
import {hasFile,readVerified} from "../lib/data";
import type {Release} from "../lib/types";
type Country={name:string;cells:number;valid_cells:number;coverage:number;total_mm:number;normal_mm:number;anomaly_mm:number;anomaly_pct:number|null};
type Spatial={status:string;source:string;url:string;limitation:string;period_start?:string;period_end?:string;retrieved_at?:string;latitude?:number[];longitude?:number[];anomaly_mm?: (number|null)[][];anomaly_pct?: (number|null)[][];valid_cells?:number;countries:Record<string,Country>};
type Score={n:number;tp:number;fp:number;fn:number;tn:number;precision:number|null;recall:number|null;false_positive_rate:number|null;accuracy:number|null};
type Validation={status:string;target:string;method:string;limitation:string;rows:{id:string;name:string;screen:Score;persistence:Score;no_alert:Score}[]};
type Auth={usda:{name:string;status:string;url:string;limitation:string;response_records?:number};hapi:{name:string;status:string;url:string;limitation:string;records:{iso3:string;name:string;phase:string;assessment_type:string;start:string;end:string;population:number;resource_hdx_id:string}[]}};
type Geometry={width:number;height:number;countries:{iso3:string;name:string;d:string}[]};
const fmt=(v:number|null|undefined)=>v==null?"Unknown":new Intl.NumberFormat("en",{maximumFractionDigits:1}).format(v);
const pct=(v:number|null)=>v==null?"—":fmt(v*100)+"%";
function useEvidence<T>(release:Release,name:string){
 const [value,setValue]=useState<T|null>(null),[error,setError]=useState("");
 useEffect(()=>{let stop=false;setValue(null);setError("");if(hasFile(release.manifest,name))readVerified<T>(release.manifest,name).then(v=>{if(!stop)setValue(v)}).catch(e=>{if(!stop)setError(String(e))});return()=>{stop=true}},[release.manifest,name]);
 return {value,error};
}
const colors=["#9c421f","#d58a53","#f4d9af","#f4f3ed","#c5e3e9","#64a7bd","#245c84"];
export function SpatialEvidence({release,geo}:{release:Release;geo:string}){
 const {value:s,error}=useEvidence<Spatial>(release,"spatial-evidence.json");
 const [metric,setMetric]=useState<"anomaly_mm"|"anomaly_pct">("anomaly_pct"),[focus,setFocus]=useState(""),[geometry,setGeometry]=useState<Geometry|null>(null);
 useEffect(()=>{let stop=false;fetch(import.meta.env.BASE_URL+"world-paths.json").then(r=>r.json()).then(g=>{if(!stop)setGeometry(g)}).catch(()=>{});return()=>{stop=true}},[]);
 const limit=metric==="anomaly_pct"?[ -50,-25,-10,10,25,50 ]:[-150,-75,-25,25,75,150];
 const color=(v:number|null)=>v==null?"#a8adb5":colors[limit.findIndex(t=>v<t)<0?6:limit.findIndex(t=>v<t)];
 const country=s?.countries[geo], active=s?.countries[focus||geo];
 useEffect(()=>setFocus(""),[geo]);
 const grid=s?.[metric];const lat=s?.latitude,lon=s?.longitude;
 return <section className="visual-panel"><p className="commodity-kicker">Global spatial analysis · environmental screening</p><h2>Three-month precipitation anomaly</h2>
 {!s||s.status!=="available"?<p>{error||(!s?"Global grid not present in this data release.":"Provider grid unavailable; no anomaly is inferred.")}</p>:<><p>{s.period_start}–{s.period_end} compared with 1991–2020 · {s.valid_cells?.toLocaleString()} valid grid cells · <a href={s.url}>{s.source}</a></p><label>Map indicator<select value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="anomaly_pct">Percent departure from normal</option><option value="anomaly_mm">Absolute departure (mm)</option></select></label>
 {grid&&lat&&lon&&<svg viewBox="0 0 1000 500" className="evidence-map" role="img" aria-label="Global three-month precipitation departure from historical normal"><g>{grid.flatMap((row,i)=>row.map((v,j)=><rect key={i+":"+j} x={(lon[j]+180-1.25)*1000/360} y={(90-lat[i]-1.25)*1000/360} width={1000*2.5/360+.2} height={1000*2.5/360+.2} fill={color(v)} />))}</g>{geometry&&<g transform="translate(0 16.667)" pointerEvents="none">{geometry.countries.map(c=><path key={c.iso3} d={c.d} fill="none" stroke="#263442" strokeOpacity=".55" strokeWidth=".65"/>)}</g>}</svg>}
 <div className="map-legend">{colors.map((c,i)=><span key={c}><i style={{background:c}}/>{i===0?"< "+limit[0]:i===6?"≥ "+limit[5]:limit[i-1]+" to "+limit[i]} {metric==="anomaly_pct"?"%":"mm"}</span>)}<span><i style={{background:"#a8adb5"}}/>Unknown</span></div>
 <p>{Object.keys(s.countries).length} approximate country summaries. Select a country to inspect; small or incompletely covered areas are withheld.</p><label>Inspect country summary<select value={focus|| (country?geo:"")} onChange={e=>setFocus(e.target.value)}><option value="">Select country</option>{Object.entries(s.countries).sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([k,c])=><option key={k} value={k}>{c.name}</option>)}</select></label>
 {active?<div className="visual-grid">{[["Three-month precipitation",fmt(active.total_mm)+" mm"],["Historical normal",fmt(active.normal_mm)+" mm"],["Difference",fmt(active.anomaly_mm)+" mm"],["Relative departure",fmt(active.anomaly_pct)+(active.anomaly_pct==null?"":"%")]].map(([l,v])=><article className="source-tile" key={l}><h3>{l}</h3><strong>{v}</strong></article>)}</div>:geo!=="global"?<p>No eligible country summary for this geography.</p>:null}{active&&<p className="figure-note">{active.valid_cells} of {active.cells} grid centres valid; weighted coverage {fmt(active.coverage*100)}%.</p>}
 <p className="figure-note">{s.limitation} Check local crop conditions, crop calendars, soil moisture and irrigation before inferring agricultural effects.</p></>}
 </section>;
}
export function ValidationEvidence({release}:{release:Release}){
 const {value:v,error}=useEvidence<Validation>(release,"scientific-validation.json");
 const [method,setMethod]=useState<"screen"|"persistence"|"no_alert">("screen");
 return <section className="visual-panel"><h2>Scientific validation and historical screening skill</h2>{!v||v.status!=="available"?<p>{error||"Retrospective evaluation is not available in this release."}</p>:<><p><strong>Test target:</strong> {v.target}</p><p>{v.method}</p><label>Compare screening method<select value={method} onChange={e=>setMethod(e.target.value as typeof method)}><option value="screen">Existing anomaly screen</option><option value="persistence">Trailing price rise baseline</option><option value="no_alert">Never alert baseline</option></select></label><div className="commodity-table"><table><caption>Historical test results; precision and recall are undefined if their denominators are zero.</caption><thead><tr>{["Benchmark","Origins","TP","FP","FN","TN","Precision","Recall","False positive rate"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{v.rows.map(r=>{const a=r[method];return <tr key={r.id}><th scope="row">{r.name}</th><td>{a.n}</td><td>{a.tp}</td><td>{a.fp}</td><td>{a.fn}</td><td>{a.tn}</td><td>{pct(a.precision)}</td><td>{pct(a.recall)}</td><td>{pct(a.false_positive_rate)}</td></tr>})}</tbody></table></div><p className="figure-note">{v.limitation}</p></>}</section>;
}
export function AuthenticatedEvidence({release,geo}:{release:Release;geo:string}){
 const {value:a,error}=useEvidence<Auth>(release,"authenticated-evidence.json");
 return <section className="visual-panel"><h2>Credentialed data services</h2>{!a?<p>{error||"Credentialed service status not yet in this release."}</p>:<><div className="visual-grid">{[a.usda,a.hapi].map(s=><article className="source-tile" key={s.name}><h3><a href={s.url}>{s.name}</a></h3><strong>{s.status.replaceAll("_"," ")}</strong><p>{s.limitation}</p></article>)}</div>{a.usda.response_records!=null&&<p>USDA response probe returned {a.usda.response_records} rows; not used as published commodity data.</p>}{a.hapi.records.length>0&&<div className="commodity-table"><table><caption>IPC national records (assessment types and periods separate)</caption><thead><tr><th>Country</th><th>Period</th><th>Type</th><th>Phase</th><th>People</th><th>Resource</th></tr></thead><tbody>{a.hapi.records.filter(r=>geo==="global"||r.iso3===geo).slice(0,100).map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.start}–{r.end}</td><td>{r.assessment_type}</td><td>{r.phase}</td><td>{fmt(r.population)}</td><td>{r.resource_hdx_id}</td></tr>)}</tbody></table></div>}</>}</section>;
}

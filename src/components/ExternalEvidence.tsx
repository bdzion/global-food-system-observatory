import { useEffect,useState } from "react";
import type { Release } from "../lib/types";
import { hasFile, readVerified } from "../lib/data";
import { SeriesChart } from "./EvidenceVisuals";
type PsdRow={product:string;commodity_label:string;country_code:string;country:string;market_year:number;attribute:string;unit:string;value:number;source_calendar_year:number|null;source_month:number|null};
type Base={name:string;url:string;status:string;limitation:string;retrieved_at?:string;licence:string;licence_url?:string};
type Hazard={id:string;event_type:string;provider_alert_level:string;country:string;iso3:string[];start:string|null;end:string|null;modified:string|null;url:string};
type Evidence={schema_version:number;gdacs?:Base&{events:Hazard[]};fpi:Base&{unit:string;series:Record<string,{period:string;value:number}[]>};psd:Base&{records:PsdRow[]};geoglam:Base&{layers:{crop:string;title:string;period:string;url:string}[]}};
export function ExternalEvidence({release,commodity,country,geo,compact}:{release:Release;commodity:string;country:string;geo:string;compact:boolean}){
 const [data,setData]=useState<Evidence|null>(null);
 const [error,setError]=useState("");
 const [psdCountry,setPsdCountry]=useState("");
 const [psdProduct,setPsdProduct]=useState("wheat");
 const [show,setShow]=useState(!compact);
 useEffect(()=>{if(!hasFile(release.manifest,"external-evidence.json"))return;let cancelled=false;readVerified<Evidence>(release.manifest,"external-evidence.json").then(v=>{if(!cancelled)setData(v)}).catch(e=>{if(!cancelled)setError(String(e))});return()=>{cancelled=true}},[release.manifest]);
 const fmt=(v:number)=>new Intl.NumberFormat("en",{maximumFractionDigits:2}).format(v);
 if(!data)return <section className="visual-panel"><h2>Seasonal and market evidence</h2><p>{error?"Optional evidence could not be read: "+error:hasFile(release.manifest,"external-evidence.json")?"Loading independently sourced evidence…":"Additional provider evidence is not in this release. No observations are inferred."}</p></section>;
 const {fpi,psd,geoglam}=data;
 const product=["wheat","rice","maize","soybeans"].includes(commodity)?commodity:psdProduct;
 const rows=psd.records.filter(r=>r.product===product);
 const countries=[...new Set(rows.map(r=>r.country))].sort();
 const psdGeo=countries.includes(country)?country:countries.includes(psdCountry)?psdCountry:countries[0]||"";
 const selected=rows.filter(r=>r.country===psdGeo);
 const gdacs=data.gdacs;
 const hazards=(gdacs?.events||[]).filter(e=>geo==="global"||e.iso3.includes(geo));
 const types:Record<string,string>={EQ:"Earthquake",TC:"Tropical cyclone",FL:"Flood",VO:"Volcano",WF:"Wildfire",DR:"Drought",TS:"Tsunami"};
 return <section className="visual-panel"><h2>Seasonal and market evidence</h2><p>Additional sources with distinct reporting periods and definitions. Availability is not a risk score.</p><div className="visual-grid">{[fpi,psd,geoglam,...(gdacs?[gdacs]:[])].map(x=><article className="source-tile" key={x.name}><h3><a href={x.url}>{x.name}</a></h3><strong>{x.status}</strong><p>{x.limitation}</p><p className="figure-note">Retrieved: {x.retrieved_at||"not available"} · {x.licence_url?<a href={x.licence_url}>{x.licence}</a>:x.licence}</p></article>)}</div>
 <button className="visual-button" onClick={()=>setShow(!show)} aria-expanded={show}>{show?"Hide":"Inspect"} provider evidence</button>
 {gdacs&&<><h3>Recent hazard notifications · {country}</h3><p>{gdacs.status==="available"?"Provider-reported events in the retrieved window. The selected commodity has not been spatially intersected with hazard footprints.":"GDACS feed unavailable in this release."} {gdacs.retrieved_at?"Retrieved "+gdacs.retrieved_at:""}</p>{hazards.length?<div className="source-grid">{hazards.slice(0,compact?4:15).map(e=><article className="source-tile" key={e.id}><p className="commodity-kicker">{types[e.event_type]||e.event_type} · provider level {e.provider_alert_level}</p><h3>{e.country}</h3><p>{e.start||"Unknown start"}{e.end?" to "+e.end:""}</p><p className="figure-note">Potential relevance only. Verify affected farms, storage, transport and local reports. <a href={e.url}>Official event record</a></p></article>)}</div>:<p>No matching notifications in this retrieved subset. This does not establish that the selected area is free of hazards.</p>}<p className="figure-note">Source: <a href={gdacs.url}>GDACS</a>, European Union; provider level and dates are preserved. <a href={gdacs.licence_url}>Terms of use</a>.</p></>}
 {show&&<>{fpi.status==="available"&&<><h3>FAO global food group prices</h3><p>Source: FAO, nominal indices (2014–2016=100). Not consumer food inflation.</p><SeriesChart title="Food group price indices" unit={fpi.unit} series={Object.entries(fpi.series).map(([name,points])=>({name,points}))}/></>}
 {psd.status==="available"&&<><h3>USDA marketing-year assessments</h3><p>Country names use USDA definitions. Values retain the reported 1,000 metric tonne unit. Estimates and forecasts are not actual inventory counts.</p><div className="commodity-filter"><label>USDA product<select value={product} disabled={["wheat","rice","maize","soybeans"].includes(commodity)} onChange={e=>setPsdProduct(e.target.value)}>{["wheat","rice","maize","soybeans"].map(k=><option key={k}>{k}</option>)}</select></label><label>USDA reporting area<select value={psdGeo} disabled={countries.includes(country)} onChange={e=>setPsdCountry(e.target.value)}>{countries.map(k=><option key={k}>{k}</option>)}</select></label></div><div className="commodity-table"><table><caption>USDA values by marketing year (separate from FAOSTAT)</caption><thead><tr><th>Market year</th><th>Measure</th><th>Value</th><th>Unit</th><th>Provider vintage fields</th></tr></thead><tbody>{selected.map((r,i)=><tr key={i}><td>{r.market_year}</td><td>{r.attribute}</td><td>{fmt(r.value)}</td><td>{r.unit}</td><td>{r.source_calendar_year??"—"}/{r.source_month??"—"}</td></tr>)}</tbody></table></div>{!selected.length&&<p>No matching USDA evidence.</p>}</>}
 {geoglam.status==="available"&&<><h3>GEOGLAM dated crop-condition map layers</h3><p>Open the provider's spatial layer for its own legend and coverage. Layer discovery does not estimate crop loss or assign country risk.</p><div className="source-grid">{geoglam.layers.filter(l=>commodity==="all"||l.crop.toLowerCase()==="synthesis"||l.crop.toLowerCase()===commodity.replace("soybeans","soybean").replace("rice_paddy","rice")).map(l=><article className="source-tile" key={l.title}><h3>{l.crop} · {l.period}</h3><p><a href={l.url}>Open official ArcGIS layer</a> · <a href={"https://www.arcgis.com/apps/mapviewer/index.html?url="+encodeURIComponent(l.url)}>Explore on map</a></p><p className="figure-note">GEOGLAM Crop Monitor, {l.period}. CC BY 4.0. Layer unchanged.</p></article>)}</div></>}
 </>}
 </section>;
}

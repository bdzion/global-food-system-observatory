import { monthWords } from "../lib/format";
import {useEffect,useState} from "react";
import {hasFile,readVerified} from "../lib/data";
import {href} from "../lib/router";
import { type CommodityRelease} from "../lib/commodities";
import type {Release} from "../lib/types";
type Climate={status:string;period_start?:string;period_end?:string;countries:Record<string,{anomaly_mm:number;anomaly_pct:number|null;coverage:number;valid_cells:number}>};
type Market={product:string;commodity:string;market:string;currency:string;unit:string;points:{period:string;value:number}[]};
type Api={domestic:{countries:{iso3:string;status:string;series:Market[];url:string}[]};enso:{status:string;series:{period:string;value:number}[]};climate:{status:string;sites:{iso3:string;status:string}[]}};
type Hazard={id:string;country:string;iso3:string[];event_type:string;start:string|null;end:string|null;modified:string|null;url:string};
type Ext={fpi:{status:string};psd:{status:string};geoglam:{status:string};gdacs?:{status:string;events:Hazard[]}};
type Valid={status:string;rows:{id:string;screen:{n:number;precision:number|null;recall:number|null}}[]};
type Auth={usda:{status:string};hapi:{status:string}};
const fmt=(v:number|null|undefined,d=1)=>v==null?"Unknown":new Intl.NumberFormat("en",{maximumFractionDigits:d}).format(v);
function useOptional<T>(release:Release,name:string){
 const [value,setValue]=useState<T|null>(null),[state,setState]=useState("not in release");
 useEffect(()=>{let cancelled=false;setValue(null);if(!hasFile(release.manifest,name)){setState("not in release");return}
 setState("loading");readVerified<T>(release.manifest,name).then(v=>{if(!cancelled){setValue(v);setState("loaded")}}).catch(()=>{if(!cancelled)setState("unavailable")});return()=>{cancelled=true}},[release.manifest,name]);
 return {value,state};
}
export function DecisionDesk({release,data,geo,commodity,country,mode}:{release:Release;data:CommodityRelease|null;geo:string;commodity:string;country:string;mode:"overview"|"watch"|"briefs"|"methods"}){
 const climate=useOptional<Climate>(release,"spatial-evidence.json"),api=useOptional<Api>(release,"api-evidence.json"),ext=useOptional<Ext>(release,"external-evidence.json"),validation=useOptional<Valid>(release,"scientific-validation.json"),auth=useOptional<Auth>(release,"authenticated-evidence.json");
 const p=commodity==="all"?null:data?.products[commodity],row=p?.countries[geo],price=p?.price;
 const rainfall=climate.value?.countries[geo],market=api.value?.domestic.countries.find(c=>c.iso3===geo);
 const retail=(market?.series||[]).filter(r=>r.product===commodity).sort((a,b)=>(b.points.at(-1)?.period||"").localeCompare(a.points.at(-1)?.period||""));
 const first=retail[0],last=first?.points.at(-1),prev=last&&first?.points.find(v=>v.period===(+last.period.slice(0,4)-1)+"M"+last.period.slice(5));
 const yoy=last&&prev&&prev.value>0?100*(last.value/prev.value-1):null;
 const hazards=(ext.value?.gdacs?.events||[]).filter(e=>e.iso3.includes(geo));
 const skill=price&&validation.value?.rows.find(v=>v.id===price.id);
 const selected=geo!=="global"&&!!p;
 const cards=[
 {title:"International reference price",value:price?fmt(price.latest_value)+" "+price.unit:"Unknown",date:price?monthWords(price.latest_period):"No international price for this food",detail:price?price.climb_reading.words+" This is not a domestic price.":"No exact product benchmark connected.",source:"World Bank Pink Sheet",url:"https://www.worldbank.org/en/research/commodity-markets"},
 {title:"Reliance on imports",value:row?fmt(row.gross_import_share_pct)+(row.gross_import_share_pct==null?"":"%"):"Unknown",date:row?String(row.year):"No aligned country-product record",detail:"Imports divided by available supply. Supplier concentration (0–1): "+fmt(row?.supplier_hhi,3)+". Higher concentration means more reliance on a few suppliers, not a prediction of interruption.",source:"FAOSTAT",url:"https://www.fao.org/faostat/en/"},
 {title:"Estimated months of stocks",value:row?fmt(row.estimated_cover_months)+(row.estimated_cover_months==null?"":" months"):"Unknown",date:row?String(row.year):"No country-product record",detail:"An estimate, not a count of stocks that can be released. Not calculated for fresh or animal foods.",source:"FAOSTAT",url:"https://www.fao.org/faostat/en/"},
 {title:"Rainfall compared with normal",value:rainfall?fmt(rainfall.anomaly_mm)+" mm":"Unknown",date:rainfall?monthWords(climate.value?.period_start)+" to "+monthWords(climate.value?.period_end):"No country summary available",detail:rainfall?"Departure from normal; "+rainfall.valid_cells+" valid grid centres. Not crop-specific.":"No local crop exposure inferred.",source:"NOAA GPCP",url:"https://psl.noaa.gov/data/gridded/data.gpcp.html"},
 {title:"Local retail price",value:last&&first?fmt(last.value)+" "+first.currency+"/"+first.unit:"Unknown",date:last?monthWords(last.period):"No local market figure for this food",detail:first?first.commodity+" · "+first.market+". Same-month annual change: "+(yoy==null?"unknown":fmt(yoy)+"%")+". One market series, not a national average.":"No substitute geography or product is used.",source:"WFP / HDX",url:market?.url||"https://data.humdata.org/visualization/wfp-food-price/"},
 {title:"Reported hazards",value:ext.value?.gdacs?.status==="available"?String(hazards.length):"Unknown",date:"Retrieved event subset",detail:"Events are linked to the country, not necessarily farms. Zero reports does not prove there were no hazards.",source:"GDACS",url:"https://www.gdacs.org/"},
 ];
 const feeds=[
 ["FAOSTAT / World Bank core","published",release.manifest.generated_at_utc],
 ["FAO food group prices",ext.value?.fpi.status||ext.state,"Monthly indices"],
 ["USDA bulk PSD",ext.value?.psd.status||ext.state,"Marketing-year estimates"],
 ["GEOGLAM",ext.value?.geoglam.status||ext.state,"Layer metadata only"],
 ["GDACS",ext.value?.gdacs?.status||ext.state,"Provider events"],
 ["NOAA RONI",api.value?.enso.status||api.state,"Seasonal index"],
 ["NASA POWER",api.value?.climate.status||api.state,"Pilot points"],
 ["WFP / HDX retail",api.value?.domestic.countries.some(c=>c.status==="available")?"available (pilot)":api.value?"no eligible series":api.state,"Pilot markets"],
 ["Rainfall maps",climate.value?.status||climate.state,climate.value?.period_end?monthWords(climate.value.period_end):"Three-month departure"],
 ["Historical evaluation",validation.value?.status||validation.state,"Revised-price backtest"],
 ["USDA authenticated",auth.value?.usda.status||auth.state,"Credential / reconciliation"],
 ["HDX IPC authenticated",auth.value?.hapi.status||auth.state,"Credential / rights"],
 ];
 const questions=[
 "Check the latest local prices, food type and dates. A world price change may not affect local buyers in the same way.",
 "Before buying elsewhere or releasing reserves, check usable stocks, how much suppliers can sell, delivery times and other buyers’ needs.",
 "Check which crops are growing, where they are located and what field reports say before assuming a production loss.",
 "Compare acting now, acting later and doing nothing. Consider costs, practicality and who might be left worse off."
 ];
 function download(){
  const lines=["GLOBAL FOOD SYSTEM OBSERVATORY — UNREVIEWED DECISION BRIEF","Release: "+release.manifest.release_id,"Context: "+country+" / "+(p?.name||"All products"),"Generated locally: "+new Date().toISOString(),"",...cards.flatMap(c=>[c.title+": "+c.value,c.date||"",c.detail,c.source+" — "+c.url,""]),"REVIEW QUESTIONS",...questions.map((q,i)=>(i+1)+". "+q),"","Conditional research evidence, not a forecast, official warning or policy prescription.","Selected market series chosen by latest reported month; no cross-market averaging.","https://bdzion.github.io/global-food-system-observatory/"+href("briefs",undefined,{commodity,geo})];
  const u=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=u;a.download="gfso-brief-"+geo+"-"+commodity+"-"+release.manifest.release_id+".txt";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 }
 return <section className="visual-panel decision-desk" aria-label="Integrated evidence and decisions">
 <p className="commodity-kicker">Country and food overview</p><h2>{mode==="methods"?"Which data sources are working?":"What we know about the selected country and food"}</h2>
 {mode!=="methods"&&<><p>Read these figures together before deciding whether to investigate or act. They come from different sources and dates; none establishes a crisis on its own.</p>
 {selected?<><div className="decision-grid">{cards.map(c=><article className="source-tile" key={c.title}><h3>{c.title}</h3><strong className="commodity-value">{c.value}</strong><p className="figure-note">{c.date}</p><p>{c.detail}</p><a href={c.url}>{c.source}</a></article>)}</div>
 {skill&&<p className="figure-note"><strong>How well did the price rule work in the past?</strong> {skill.screen.n} historical test months; share of flagged months followed by a rise: {skill.screen.precision==null?"undefined":fmt(skill.screen.precision*100)+"%"}; share of price rises identified: {skill.screen.recall==null?"undefined":fmt(skill.screen.recall*100)+"%"}. Tested on revised past prices, not a reliable forecast.</p>}
 <h3>Questions to answer before acting</h3><ol>{questions.map(q=><li key={q}>{q}</li>)}</ol><div className="product-groups"><a className="visual-button" href={href("commodities",undefined,{commodity,geo})}>Check suppliers and stocks</a><a className="visual-button" href={href("stress",undefined,{commodity,geo})}>Compare possible timelines</a><button className="visual-button" onClick={download}>Download country brief</button></div></>:<p>Choose one country and food above to see prices, imports, stocks, rainfall and reported hazards together. You can download a short dated brief.</p>}</>}
 <details open={mode==="methods"}><summary>Which sources supplied figures in this update?</summary><p className="figure-note">A working source may still have old or incomplete figures. Some sources require permission.</p><div className="commodity-table" tabIndex={0}><table><caption>Provider status · release {release.manifest.release_id}</caption><thead><tr><th>Data service</th><th>Status</th><th>What it covers</th></tr></thead><tbody>{feeds.map(([name,status,scope])=><tr key={name}><th scope="row">{name}</th><td>{status.replaceAll("_"," ")}</td><td>{scope}</td></tr>)}</tbody></table></div></details>
 </section>;
}

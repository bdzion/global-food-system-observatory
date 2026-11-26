import {useEffect,useState} from "react";
import type {Release} from "../lib/types";
import {hasFile,readVerified} from "../lib/data";
type Snapshot={release_id:string;assessed_at:string;signals:{id:string;title:string;period:string;direction:string;anomaly:number}[]};
export function AssessmentArchive({release}:{release:Release}){
 const [data,setData]=useState<Snapshot[]|null>(null),[failed,setFailed]=useState(false),[selected,setSelected]=useState("");
 useEffect(()=>{if(!hasFile(release.manifest,"assessment-history.json"))return;let stop=false;readVerified<{snapshots:Snapshot[]}>(release.manifest,"assessment-history.json").then(d=>{if(!stop)setData(d.snapshots)}).catch(()=>{if(!stop)setFailed(true)});return()=>{stop=true}},[release.manifest]);
 const row=data?.find(s=>s.release_id===selected)||data?.at(-1);
 return <section className="visual-panel"><h2>Historical assessment archive</h2><p>Actual publication vintages, not backtested or retrospectively recalculated alerts. Later evaluation must compare these with independent outcomes.</p>{failed?<p>Archive unavailable.</p>:!row?<p>No archived assessments in this release yet.</p>:<><label>Assessment release<select value={row.release_id} onChange={e=>setSelected(e.target.value)}>{data!.map(s=><option key={s.release_id} value={s.release_id}>{s.assessed_at}</option>)}</select></label><p>{row.signals.length} recorded market screening signals in this vintage.</p><div className="commodity-table"><table><caption>Archived signals</caption><thead><tr><th>Indicator</th><th>Observation</th><th>Direction</th><th>Anomaly</th></tr></thead><tbody>{row.signals.map(s=><tr key={s.id}><th scope="row">{s.title}</th><td>{s.period}</td><td>{s.direction}</td><td>{s.anomaly}</td></tr>)}</tbody></table></div></>}</section>;
}

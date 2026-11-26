import {useState} from "react";
import {compoundBalance,type CommodityProfile,type CommoditySupplier} from "../lib/commodities";
import {RankedBars} from "./EvidenceVisuals";
import {SubstitutionLab} from "./SubstitutionLab";
export function CompoundLab({profile,supplier}:{profile:CommodityProfile;supplier:CommoditySupplier}){
 const [prod,setProd]=useState(10),[imp,setImp]=useState(30),[months,setMonths]=useState(6),[capacity,setCapacity]=useState(15),[replacement,setReplacement]=useState(50),[delay,setDelay]=useState(2),[reserve,setReserve]=useState("0");
 const fmt=(v:number)=>new Intl.NumberFormat("en",{maximumFractionDigits:0}).format(v)+" t";
 const yearsMatch=(profile.supplier_year??profile.year)===profile.year;
 const r=Number(reserve);
 const valid=profile.production_t!=null&&yearsMatch&&reserve.trim()!==""&&Number.isFinite(r)&&r>=0;
 const run=(cap:number,lead:number,stock:number,repl:number)=>valid?compoundBalance(profile.production_t!,supplier.quantity_t,months,prod,imp,repl,cap,stock,lead):null;
 const none=run(0,0,0,0),early=run(capacity,0,r,replacement),late=run(capacity,delay,r,replacement),low=run(capacity/2,0,r,replacement),high=run(Math.min(100,capacity*1.5),0,r,replacement);
 return <section className="visual-panel"><p className="commodity-kicker">Decision laboratory · conditional physical balance</p><h2>Compound production and shipment disruption</h2><p>Test simultaneous domestic production loss and interruption of shipments from {supplier.name}. The baseline is historical; timing is uniform, not seasonal. Reserve release is an explicit user assumption, not a published stock estimate.</p>
 {!yearsMatch?<p role="status">The supplier observation and national production are from different years. This combined calculation is withheld rather than silently mixing periods.</p>:profile.production_t==null?<p role="status">Domestic production observation is unavailable. Combined loss cannot be calculated.</p>:<>
 <div className="commodity-grid commodity-controls">
 {[
 ["Domestic production loss",prod,setProd,0,100,5,"%"],["Affected supplier shipments lost",imp,setImp,0,100,5,"%"],["Disruption duration",months,setMonths,1,12,1," months"],["Desired replacement of lost imports",replacement,setReplacement,0,100,5,"%"],["Alternative capacity (% affected baseline)",capacity,setCapacity,0,100,5,"%"],["Delayed response",delay,setDelay,0,12,1," months"]
 ].map(([label,v,set,min,max,step,unit])=><label key={String(label)}>{String(label)}: {String(v)}{String(unit)}<input type="range" min={Number(min)} max={Number(max)} step={Number(step)} value={Number(v)} onChange={e=>(set as (n:number)=>void)(+e.target.value)}/></label>)}
 <label>Assumed accessible reserve release over full scenario (tonnes)<input type="number" min="0" step="100" value={reserve} onChange={e=>setReserve(e.target.value)}/></label></div>
 {none&&early&&late&&low&&high?<><RankedBars title="Remaining physical supply gap" unit="t" rows={[{id:"none",name:"No action",value:none.residual},{id:"late",name:"Delayed",value:late.residual},{id:"early",name:"Early",value:early.residual}]}/><div className="commodity-grid">{[["Domestic loss",none.productionLoss],["Shipment loss",none.importLoss],["Early replacement",early.alternative],["Early reserve release",early.reserve],["Additional gap avoided by early action",late.residual-early.residual]].map(([label,v])=><article className="source-tile" key={String(label)}><h3>{label}</h3><strong>{fmt(Number(v))}</strong></article>)}</div><p><strong>Capacity sensitivity:</strong> with half to 1.5 times assumed alternative capacity (capped at 100%), the early-action residual ranges from {fmt(high.residual)} to {fmt(low.residual)}. This is an assumption range, not a probability interval.</p><p><strong>Before acting:</strong> confirm spare capacity and procurement timing, verified accessible reserves, food safety, financing, logistics and competing demand. The scenario does not quantify cost, food prices or household access.</p><SubstitutionLab gap={early.residual}/></>:<p role="status">Enter a non-negative reserve assumption to calculate.</p>}
 </>}
 </section>
}

import {href,type Route} from "../lib/router";
import type {Release} from "../lib/types";
const stages=[
 ["Inputs","Seeds, fertilizer, fuel, water and feed make farming possible.","Input prices and water availability","Input deliveries and local farm costs","commodities"],
 ["Farms","Crops, livestock and fisheries supply food and raw materials.","Production, rainfall and crop reports","Local crop losses and animal disease","watch"],
 ["Storage and processing","Grain is stored or milled; fresh foods may need refrigeration.","Estimated grain stocks","Usable reserves, processing and refrigeration","commodities"],
 ["Trade and transport","Food moves between regions and countries by road, rail and sea.","Imports, exports and major suppliers","Current shipments and transport interruptions","commodities"],
 ["Markets and households","Local prices and household incomes determine what families can afford.","Food prices and diet affordability","Timely measures of household food insecurity","watch"]
];
export function ReaderGuide({release,route}:{release:Release;route:Route}){
 const to=(page:string)=>href(page,undefined,{commodity:route.query.get("commodity")||"all",geo:route.query.get("geo")||"global"});
 const c=release.manifest.coverage as unknown as Record<string,number|undefined>;
 return <section className="reader-guide"><h1>The system</h1>
 <p className="reader-headline">A food shortage can begin far from the people who feel it.</p>
 <p className="lede">Food reaches households through a chain of farms, suppliers, processors, transport companies and retailers. A poor harvest, a rise in fertilizer prices or an interrupted trade route can put pressure on several parts of that chain. Whether a disruption becomes a crisis depends on the alternatives available and how quickly people can respond.</p>
 <p>This observatory brings together published figures to help officials identify where problems could arise, what is changing and what needs to be checked before a decision is made. It is a research tool, not an official warning service.</p>
 <h2>How food reaches people</h2><p>Follow the chain from inputs to households. Imports can enter and exports can leave at several stages. These connections are illustrative, not measured flows.</p>
 <div className="system-flow" aria-label="Five parts of the food system">{stages.map(([name,desc,watch,gap,page],i)=><article key={name} className="system-stage"><span className="step-number">{i+1}</span><h3>{name}</h3><p>{desc}</p><p><strong>What we can examine:</strong> <a href={to(page)}>{watch}</a></p><p className="figure-note"><strong>Important gaps:</strong> {gap}</p></article>)}</div>
 <p className="system-crosscut"><strong>Across the chain:</strong> energy, finance, public policy, trade rules and environmental conditions affect how well the system works. Some are only partly covered by our data.</p>
 <h2>How to use this website</h2><div className="reader-steps">{[
 ["01","The system","Understand the connections and the limits of the data.","home"],
 ["02","The indicators","Find out where countries get their food, how much they rely on a few suppliers and what stocks they may hold.","commodities"],
 ["03","The threats","Look at changes in prices, weather and reported hazards. Check whether they matter for the country or food you are examining.","watch"],
 ["04","Possible timelines","Try an interruption and compare the supply left unfilled if action is taken now, later or not at all.","stress"]
 ].map(([n,title,desc,page])=><article className="source-tile" key={page}><span className="step-number">{n}</span><h3><a href={to(page)}>{title}</a></h3><p>{desc}</p></article>)}</div>
 <h2>Try an example</h2><p>Suppose you are asked to assess rice supplies in Bangladesh. Start with <a href={href("commodities",undefined,{commodity:"rice",geo:"BGD"})}>where the country obtains its rice</a>, then check <a href={href("watch",undefined,{commodity:"rice",geo:"BGD"})}>prices, weather and reported hazards</a>. Finally, try a <a href={href("stress",undefined,{commodity:"rice",geo:"BGD"})}>possible interruption</a>. This is a walkthrough of the website, not a claim that a disruption is happening.</p><h2>What the figures cover</h2><div className="reader-counts"><article><strong>{c.product_forms??"—"}</strong><span>food products</span></article><article><strong>{c.product_country_profiles?.toLocaleString()??"—"}</strong><span>country and food records</span></article><article><strong>{c.price_series??"—"}</strong><span>international price series</span></article></div>
 <p>Annual trade and production figures describe existing dependencies, not today's supply. Recent prices and weather observations help identify changes. Each figure has its own date. Where a reliable figure is unavailable, we say so.</p><p><a className="reader-next" href={to("commodities")}>Next: The indicators →</a> <a href={to("how")}>Check sources and methods</a></p></section>;
}
export function IndicatorGuide(){return <section className="reader-explainer"><h2>What makes a country vulnerable?</h2><p>A country that buys much of its food abroad may still cope well if it has several suppliers or usable stocks. Choose a food and country, then read these measures together.</p><div className="reader-steps">{[
 ["Reliance on imports","Imports as a share of available supply (production + imports − exports). This can exceed 100% when food is sold on to other countries."],
 ["Reliance on a few suppliers","A measure from 0 to 1 (the Herfindahl–Hirschman index). Higher values mean a few suppliers account for more of the recorded trade."],
 ["Food held in store","Estimated months of supply from opening stocks. Not a count of reserves officials could release; not calculated for fresh or animal foods."],
 ["Prices and affordability","International reference prices and local retail prices differ. Food inflation and healthy-diet costs help explain household pressures."]
 ].map(([title,desc])=><article className="source-tile" key={title}><h3>{title}</h3><p>{desc}</p></article>)}</div></section>}
export function ThreatGuide({route}:{route:Route}){return <section className="reader-explainer"><h2>What could interrupt supply?</h2><p>These are examples of threats, not claims that they are happening now. Current observations appear below. A price change or weather event does not prove that food is in short supply.</p><div className="reader-steps">{[
 ["Poor growing conditions","Drought, floods or heat may reduce a harvest. Check crop locations, growing seasons and field reports."],
 ["Higher input costs","Expensive fertilizer, fuel or feed may increase farm costs. Check local contracts and the next planting season."],
 ["Trade or transport interruption","Export restrictions or damaged routes may delay supplies. Check shipments, alternative suppliers and stocks."],
 ["Animal disease or infrastructure failure","Disease, power cuts or refrigeration failure can affect particular foods. Direct monitoring remains incomplete."]
 ].map(([title,desc])=><article className="source-tile" key={title}><h3>{title}</h3><p>{desc}</p></article>)}</div><p><a href={href("stress",undefined,{commodity:route.query.get("commodity")||"wheat",geo:route.query.get("geo")||"global"})}>Explore possible timelines →</a></p></section>}

import { useEffect, useState } from "react";
import { lastSeenRelease, loadRelease, rememberRelease, type LoadState } from "./lib/data";
import { href, useRoute } from "./lib/router";
import { dateWords } from "./lib/format";
import { Home } from "./pages/Home";
import { DecisionIntelligence } from "./components/DecisionIntelligence";
import { SourceAtlas, SystemPathways } from "./components/SourceAtlas";
import { CommodityWorkspace } from "./pages/CommodityWorkspace";
import { Countries } from "./pages/Countries";
import { CountryPage } from "./pages/CountryPage";
import { ChainPage } from "./pages/ChainPage";
import { WhatIf } from "./pages/WhatIf";
import { Assumptions } from "./pages/Assumptions";
import { HowItWorks } from "./pages/HowItWorks";

/* Navigation in plain words. Nobody arriving here should have to work out what
 * "exposure analytics" or "systemic risk" means before they can find anything. */
const NAV = [
  { page: "home", label: "Overview" },
  { page: "commodities", label: "Explore" },
  { page: "watch", label: "Watch" },
  { page: "stress", label: "Stress Test" },
  { page: "briefs", label: "Briefs" },
  { page: "how", label: "Data & Methods" },
];

export function App() {
  const route = useRoute();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRelease()
      .then((release) => {
        if (cancelled) return;
        setPrevious(lastSeenRelease());
        rememberRelease(release.manifest.release_id);
        setState({ status: "ready", release });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A country profile belongs under Countries in the navigation, so the
  // reader can see where they are rather than losing the highlight entirely.
  const current = route.page === "country" ? "countries" : route.page;
  const active = ["countries","country"].includes(current) ? "commodities" : ["chain","assumptions"].includes(current) ? "watch" : current === "what-if" || (current==="commodities"&&route.id==="what-if") ? "stress" : current === "wheat" ? "home" : current;
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem("gfso.theme")||"auto"}catch{return "auto"}});
  useEffect(()=>{if(theme==="auto")delete document.documentElement.dataset.gfsoTheme;else document.documentElement.dataset.gfsoTheme=theme;try{localStorage.setItem("gfso.theme",theme)}catch{/* optional */}},[theme]);

  return (
    <>
      <a className="skip" href="#content">
        Skip to the main content
      </a>

      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand-row"><a className="wordmark" href={href("home")}>
            <span>University of Guelph · Research prototype</span>
            Global Food System Observatory
            <span>Companion to the Arrell Food Institute Canada Food System Observatory</span>
          </a><button className="theme-toggle" onClick={()=>setTheme(theme==="auto"?"dark":theme==="dark"?"light":"auto")} aria-label={"Colour mode: "+theme+"; change"}>◐ {theme}</button></div>
          <nav className="main" aria-label="Main">
            <ul>
              {NAV.map((item) => (
                <li key={item.page}>
                  <a
                    href={href(item.page,undefined,(()=>{try{const saved=JSON.parse(localStorage.getItem("gfso.commodity-context.v1")||"{}");return {commodity:saved.commodity||route.query.get("commodity")||"all",geo:saved.geo||route.query.get("geo")||"global"}}catch{return {}}})())}
                    aria-current={active === item.page ? "page" : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <div className="data-strip" role="status"><div>{state.status==="ready"?<><span>Release <strong>{state.release.manifest.release_id}</strong></span><span>Built {dateWords(state.release.manifest.generated_at_utc)}</span><span>{state.release.sources.sources.filter(s=>!s.older_than_expected && s.provider_updated).length} of {state.release.sources.sources.length} published sources within expected age</span></>:<span>Data {state.status==="loading"?"loading":"unavailable"}</span>}<span>Research tool · not an official warning service</span></div></div>

      <main id="content">
        {state.status === "loading" ? (
          <p aria-live="polite">Loading the latest figures…</p>
        ) : null}

        {state.status === "failed" ? (
          <>
            <h1>The figures could not be loaded</h1>
            <p>
              Nothing on this page is being shown, because showing a page with
              no figures on it would look like a page saying nothing is
              happening. Those are not the same thing.
            </p>
            <p className="figure-note">Reason given: {state.reason}</p>
            <p>
              If this keeps happening, please tell us:{" "}
              <a href="mailto:mbodrudd@uoguelph.ca">mbodrudd@uoguelph.ca</a>.
            </p>
          </>
        ) : null}

        {state.status === "ready" ? (
          <>
            {previous && previous !== state.release.manifest.release_id ? (
              <p className="figure-note" aria-live="polite">
                The figures have been updated since you were last here
                (release {state.release.manifest.release_id}, put together{" "}
                {dateWords(state.release.manifest.generated_at_utc)}).
              </p>
            ) : null}

            {current==="home" ? <DecisionIntelligence key="overview" release={state.release} route={route} mode="overview"/> : null}
            {["commodities","stress"].includes(current) ? (
              <CommodityWorkspace
                release={state.release}
                route={route}
                key={current+":"+route.id}
                mode={current==="stress" || route.id === "what-if" ? "stress" : "explore"}
              />
            ) : null}
            {current === "wheat" ? <Home release={state.release} /> : null}
            {current === "home" ? <><SystemPathways/><p><a href={href("wheat")}>Original wheat situation assessment</a> · <a href="https://bdzion.github.io/canada-food-system-observatory/#/">Canada Food System Observatory</a></p></> : null}
            {current === "commodities" ? <p><a href={href("countries")}>Original wheat country profiles</a></p> : null}
            {current === "watch" ? <><DecisionIntelligence key="watch" release={state.release} route={route} mode="watch"/><SystemPathways/><p><a href={href("chain")}>Original wheat transmission analysis</a> · <a href={href("assumptions")}>Wheat assumption ledger</a></p></> : null}
            {current === "briefs" ? <DecisionIntelligence key="briefs" release={state.release} route={route} mode="briefs"/> : null}
            {current === "how" ? <><DecisionIntelligence key="methods" release={state.release} route={route} mode="methods"/><SourceAtlas release={state.release}/></> : null}
            {current === "countries" && !route.id ? (
              <Countries release={state.release} />
            ) : null}
            {route.page === "country" && route.id ? (
              <CountryPage release={state.release} iso={route.id.toUpperCase()} />
            ) : null}
            {current === "chain" ? <ChainPage release={state.release} /> : null}
            {current === "what-if" ? (
              <WhatIf
                release={state.release}
                preselect={route.query.get("country") ?? undefined}
              />
            ) : null}
            {current === "assumptions" ? <Assumptions release={state.release} /> : null}
            {current === "how" ? <HowItWorks release={state.release} /> : null}

            {!NAV.some((n) => n.page === current) && !["country","countries","chain","what-if","assumptions","commodities","wheat"].includes(route.page) ? (
              <>
                <h1>That page is not here</h1>
                <p>
                  <a href={href("home")}>Start from what's happening</a>.
                </p>
              </>
            ) : null}
          </>
        ) : null}
      </main>

      <footer>
        <div className="inner">
          <p>
            <strong>Global Food System Observatory.</strong> A research project
            at the University of Guelph. Not an official warning system, and
            nothing here is a forecast.
          </p>
          <p>
            Built on figures published by the Food and Agriculture Organization
            of the United Nations and the World Bank, used under Creative
            Commons Attribution 4.0. Neither organisation is responsible for
            anything on this site.
          </p>
          <p>
            <a href={href("how")}>How this works</a> ·{" "}
            <a href="https://github.com/bdzion/global-food-system-observatory">
              Code and data
            </a>{" "}
            · <a href="mailto:mbodrudd@uoguelph.ca">Tell us we are wrong</a>
          </p>
        </div>
      </footer>
    </>
  );
}

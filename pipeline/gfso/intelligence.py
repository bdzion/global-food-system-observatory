"""Source-backed compact release views and structural context.
No composite risk score or fabricated event. Optional WDI context failure is
explicit and does not block a valid core release.
"""
from __future__ import annotations
import math
from . import SCHEMA_VERSION, core
from .connectors import worldbank

CONTEXT = {
    "water_stress": ("ER.H2O.FWST.ZS", "Water stress", "% of available freshwater resources", "Structural pressure; not crop-specific or current drought."),
    "irrigated_land": ("AG.LND.IRIG.AG.ZS", "Agricultural irrigated land", "% of agricultural land", "Structural irrigation extent; not water delivery."),
    "undernourishment": ("SN.ITK.DEFC.ZS", "Prevalence of undernourishment", "% of population", "Modelled population estimate; not an acute food crisis classification."),
    "electricity": ("EG.ELC.ACCS.ZS", "Access to electricity", "% of population", "Access proxy, not cold-chain capacity or electricity reliability."),
    "rural_electricity": ("EG.ELC.ACCS.RU.ZS", "Rural electricity access", "% of rural population", "Proxy only; not food storage capacity."),
    "fertilizer_use": ("AG.CON.FERT.ZS", "Fertilizer consumption", "kg per hectare of arable land", "Aggregate national use; not fertilizer affordability or crop-specific application."),
}

def context(countries):
    ids = set(countries)
    data = {}
    for key,(code,label,unit,limit) in CONTEXT.items():
        try:
            payload = core.fetch_json(f"{worldbank.API}/country/all/indicator/{code}",
                params={"format":"json","per_page":20000,"mrnev":8}, timeout=30, attempts=1)
            if not isinstance(payload,list) or len(payload)<2 or not isinstance(payload[1],list):
                raise ValueError("Unexpected indicator response")
            if int(payload[0].get("pages", 1)) != 1:
                raise ValueError("Incomplete paginated indicator")
            records = {}
            for row in payload[1]:
                iso = row.get("countryiso3code")
                value,year = row.get("value"),str(row.get("date"))
                if iso not in ids or value is None or not year.isdigit():
                    continue
                value=float(value)
                if not math.isfinite(value) or value < 0:
                    continue
                if iso not in records or int(year)>records[iso]["year"]:
                    records[iso]={"year":int(year),"value":value}
            status="available" if records else "no_observations"
        except (core.SourceError,ValueError,TypeError,KeyError):
            records={}; status="unavailable"
        data[key]={"code":code,"label":label,"unit":unit,"limitation":limit,
                   "source":"WB-IND","url":f"https://data.worldbank.org/indicator/{code}",
                   "status":status,"records":records}
    return {"schema_version":SCHEMA_VERSION,"retrieved_at":core.iso(core.utc_now()),"indicators":data}

def compact_views(extension):
    products=extension["products"]
    keys=("production_t","imports_t","exports_t","apparent_supply_t","gross_import_share_pct",
          "estimated_cover_months","supplier_hhi","supplier_coverage_pct","food_use_t")
    summary={}
    coverage={}
    details={}
    countries={}
    for id,p in products.items():
        rows=p["countries"]
        counts={k:sum(r.get(k) is not None for r in rows.values()) for k in keys}
        counts["suppliers"]=sum(bool(r.get("suppliers")) for r in rows.values())
        counts["aligned_suppliers"]=sum(bool(r.get("suppliers")) and r.get("supplier_year",r["year"])==r["year"] for r in rows.values())
        coverage[id]={"name":p["name"],"year":p["year"],"countries":len(rows),**counts,
                      "price_period":(p.get("price") or {}).get("latest_period")}
        slim={}
        for iso,r in rows.items():
            slim[iso]={"iso3":iso,"name":r["name"],"year":r["year"],"supplier_year":r.get("supplier_year"),**{k:r.get(k) for k in keys}}
            countries[iso]=r["name"]
        summary[id]={**{k:v for k,v in p.items() if k not in ("countries","price")},
                     "price":p.get("price"),"countries":slim}
        details["commodities/"+id]={"schema_version":SCHEMA_VERSION,"product":p}
    index={**extension,"products":summary,"coverage":coverage,"country_names":countries,"detail_format":1}
    return {"commodity-index":index,**details}

def signals(world):
    prices=world["prices"]
    rows=[]
    for id,p in prices.items():
        state=p.get("freshness","unknown")
        if state!="current" or p["climb_reading"]["state"] not in ("climbing","climbing_fast","falling"):
            continue
        rows.append({"id":"price:"+id,"indicator":id,"title":p["plain_name"],
                     "period":p["latest_period"],"value":p["latest_value"],"unit":p["unit"],
                     "change_pct":p["change_over_year_pct"],"anomaly":p["climb_anomaly"],
                     "direction":p["climb_reading"]["state"],"source":"WB-PINK",
                     "evidence_class":"observed reference price; derived screening signal",
                     "status":"review_required"})
    return {"schema_version":SCHEMA_VERSION,"signals":sorted(rows,key=lambda r:-abs(r["anomaly"] or 0)),
            "historical_prices":[{"id":id,"period":p["latest_period"]} for id,p in prices.items() if p.get("freshness")!="current"],
            "method":"Unvalidated growth-anomaly screen, current monthly observations only. No alerts inferred for missing domains."}

def archive(out, current, release_id):
    """Bounded retrospective record of actual published assessment vintages.
    Not a backtest: no hindsight reclassification of past alerts."""
    old=[]
    try:
        manifest=core.read_json(out/"manifest.json")
        file=next((x for x in manifest.get("files",[]) if x["name"]=="assessment-history.json"),None)
        path=out/"assessment-history.json"
        if file and path.exists() and core.checksum(path)==file["sha256"]:
            old=core.read_json(path).get("snapshots",[])
    except (OSError,ValueError,TypeError,AttributeError):
        old=[]
    row={"release_id":release_id,"assessed_at":core.iso(core.utc_now()),"signals":current["signals"],
         "historical_prices":current["historical_prices"]}
    snapshots=[s for s in old if s.get("release_id")!=release_id]+[row]
    return {"schema_version":SCHEMA_VERSION,"snapshots":snapshots[-120:],
            "method":"Published assessment vintages; not forecasts or validated alert outcomes."}

"""Credential-ready provider adapters. No credentials ever enter release JSON.

USDA API check uses official endpoint and publishes only counts of returned
records; bulk PSD remains authoritative until the authenticated schema is
independently reconciled. HAPI IPC rows require an explicit rights allowlist.
"""
import os
import re
import math
import httpx
from . import core, SCHEMA_VERSION, external

USDA="https://api.fas.usda.gov/api/psd/"
HAPI="https://hapi.humdata.org/api/v2/food-security-nutrition-poverty/food-security"

def normalize(row):
    return {external.norm(k):v for k,v in row.items() if v is not None}

def lookup(rows, key, name):
    out={}
    for raw in rows:
        r=normalize(raw)
        if key in r and name in r:
            k=str(r[key]);v=str(r[name]).strip()
            if k in out and out[k]!=v:raise ValueError("Conflicting lookup")
            out[k]=v
    if not out:raise ValueError("Empty USDA lookup")
    return out

def psd_records(raw, code, year, countries, commodities, attrs, units):
    rows=[]
    for original in raw:
        r=normalize(original)
        cc=str(r.get("countrycode",""));aid=str(r.get("attributeid",""));uid=str(r.get("unitid",""))
        if cc not in countries or aid not in attrs or uid not in units:continue
        if "marketyear" in r and str(r["marketyear"])!=str(year):continue
        if "commoditycode" in r and str(r["commoditycode"]).zfill(7)!=code:continue
        rows.append({"Commodity_Code":code,"Commodity_Description":commodities[code],"Country_Code":cc,
                     "Country_Name":countries[cc],"Market_Year":str(year),"Attribute_Description":attrs[aid],
                     "Unit_Description":units[uid],"Value":r.get("value"),"Calendar_Year":r.get("calendaryear"),"Month":r.get("month")})
    return external.parse_psd(rows,year)

def compare_bulk(records, bulk):
    def k(r):return (r["product"],r["country_code"],r["market_year"],r["attribute"])
    refs={k(r):r for r in bulk}
    comparable=matches=0
    for row in records:
        b=refs.get(k(row))
        if not b:continue
        if (row["source_calendar_year"],row["source_month"])!=(b["source_calendar_year"],b["source_month"]):continue
        if row["source_calendar_year"] is None or row["source_month"] is None:continue
        comparable+=1
        if abs(row["value"]-b["value"])<=.001:matches+=1
    return {"comparable_records":comparable,"matching_records":matches,
            "status":"matched" if comparable>=20 and matches==comparable else "insufficient_or_disagreeing"}

def usda(bulk=None):
    base={"name":"USDA FAS PSD authenticated API","url":"https://apps.fas.usda.gov/opendatawebv2/",
          "limitation":"Four staple commodity forms, latest two selected marketing years; estimates and forecasts, not measured stocks. Authenticated records published separately only after same-vintage concordance with USDA bulk PSD (at least 20 comparable records, all matching)."}
    key=os.environ.get("USDA_FAS_API_KEY")
    if not key:return {**base,"status":"credential_required","records":[]}
    try:
        year=core.utc_now().year-1
        with httpx.Client(timeout=35,follow_redirects=False) as c:
            def fetch(path):
                r=c.get(USDA+path,headers={"API_KEY":key,"Accept":"application/json"})
                r.raise_for_status();rows=r.json()
                if not isinstance(rows,list) or not rows or not isinstance(rows[0],dict):raise ValueError("Unexpected PSD response")
                return rows
            countries=lookup(fetch("countries"),"countrycode","countryname")
            commodities=lookup(fetch("commodities"),"commoditycode","commodityname")
            commodities={k.zfill(7):v for k,v in commodities.items()}
            attrs=lookup(fetch("commodityAttributes"),"attributeid","attributename")
            units=lookup(fetch("unitsOfMeasure"),"unitid","unitdescription")
            records=[]
            for code in external.PSD_PRODUCTS:
                if code not in commodities:raise ValueError("Unknown USDA commodity")
                for y in (year,year+1):
                    rows=fetch(f"commodity/{code}/country/all/year/{y}")
                    records.extend(psd_records(rows,code,y,countries,commodities,attrs,units))
        comparison=compare_bulk(records,bulk or [])
        return {**base,"status":"available" if comparison["status"]=="matched" else "reconciliation_required",
                "response_records":len(records),"comparison":comparison,"records":records if comparison["status"]=="matched" else [],
                "retrieved_at":core.iso(core.utc_now())}
    except (httpx.HTTPError,ValueError,TypeError,KeyError,AttributeError):
        return {**base,"status":"unavailable","records":[]}

def parse_ipc(rows,allowed):
    out={}
    for row in rows:
        rid=str(row.get("resource_hdx_id",""))
        if rid not in allowed:continue
        iso=str(row.get("location_code",""));phase=str(row.get("ipc_phase",""));typ=str(row.get("ipc_type",""))
        if not re.fullmatch(r"[A-Z]{3}",iso) or phase not in ("1","2","3","4","5") or not typ:continue
        if str(row.get("admin_level"))!="0":continue
        start=str(row.get("reference_period_start",""))[:10];end=str(row.get("reference_period_end",""))[:10]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",start) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",end) or end<start:continue
        try:
            value=float(row["population_in_phase"])
            if not math.isfinite(value) or value<0 or value!=int(value):continue
        except (ValueError,TypeError,KeyError):continue
        k=(rid,iso,typ,start,end,phase)
        item={"resource_hdx_id":rid,"iso3":iso,"name":row.get("location_name") or iso,"phase":phase,
              "assessment_type":typ,"start":start,"end":end,"population":int(value)}
        if k in out and out[k]!=item:raise ValueError("Conflicting national IPC records")
        out[k]=item
    return sorted(out.values(),key=lambda r:(r["end"],r["iso3"],r["phase"]),reverse=True)

def hapi():
    base={"name":"HDX HAPI / IPC acute food insecurity","url":"https://hdx-hapi.readthedocs.io/en/latest/data_usage_guides/food_security_nutrition_and_poverty/",
          "limitation":"National assessment records only; observation and projection types preserved verbatim. No country totals across overlapping assessments. Only explicitly cleared HDX resource IDs may be republished."}
    app=os.environ.get("HDX_HAPI_APP_IDENTIFIER")
    if not app:return {**base,"status":"credential_required","records":[]}
    allowed={s.strip() for s in os.environ.get("HDX_IPC_APPROVED_RESOURCE_IDS","").split(",") if re.fullmatch(r"[0-9a-fA-F-]{36}",s.strip())}
    if not allowed:return {**base,"status":"rights_review_required","records":[]}
    try:
        rows=[];limit=1000
        with httpx.Client(timeout=45,follow_redirects=False) as c:
            for offset in range(0,10000,limit):
                r=c.get(HAPI,params={"app_identifier":app,"admin_level":0,"limit":limit,"offset":offset,"output_format":"json"})
                r.raise_for_status(); page=r.json().get("data")
                if not isinstance(page,list):raise ValueError("Unexpected HAPI response")
                rows.extend(page)
                if len(page)<limit:break
            else:raise ValueError("Pagination limit reached; no partial publication")
        data=parse_ipc(rows,allowed)
        return {**base,"status":"available" if data else "no_eligible_observations","records":data,"retrieved_at":core.iso(core.utc_now())}
    except (httpx.HTTPError,ValueError,TypeError,AttributeError):
        return {**base,"status":"unavailable","records":[]}

def gather(bulk=None):
    return {"schema_version":SCHEMA_VERSION,"usda":usda(bulk),"hapi":hapi()}

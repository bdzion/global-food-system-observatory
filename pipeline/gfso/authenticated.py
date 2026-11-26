"""Credential-ready provider adapters. No credentials ever enter release JSON.

USDA API check uses official endpoint and publishes only counts of returned
records; bulk PSD remains authoritative until the authenticated schema is
independently reconciled. HAPI IPC rows require an explicit rights allowlist.
"""
import os
import re
import math
import httpx
from . import core, SCHEMA_VERSION

USDA="https://api.fas.usda.gov/api/psd/commodity/0440000/country/all/year/"
HAPI="https://hapi.humdata.org/api/v2/food-security-nutrition-poverty/food-security"

def usda():
    base={"name":"USDA FAS PSD authenticated API","url":"https://apps.fas.usda.gov/opendatawebv2/","limitation":"Credential and response-schema probe for maize; bulk PSD remains the published data source until API values and code tables are reconciled."}
    key=os.environ.get("USDA_FAS_API_KEY")
    if not key:return {**base,"status":"credential_required"}
    try:
        year=core.utc_now().year-1
        with httpx.Client(timeout=35,follow_redirects=False) as c:
            r=c.get(USDA+str(year),headers={"API_KEY":key,"Accept":"application/json"})
            r.raise_for_status(); rows=r.json()
        if not isinstance(rows,list) or not rows or not isinstance(rows[0],dict):raise ValueError("Unexpected PSD response")
        return {**base,"status":"authenticated_response","market_year":year,"response_records":len(rows),"retrieved_at":core.iso(core.utc_now())}
    except (httpx.HTTPError,ValueError,TypeError):
        return {**base,"status":"unavailable"}

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

def gather():
    return {"schema_version":SCHEMA_VERSION,"usda":usda(),"hapi":hapi()}

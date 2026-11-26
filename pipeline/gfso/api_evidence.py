"""Supplementary evidence; independent public APIs, no credentials in the client.

Pilot sites and countries are purposive, not representative global sampling.
Retain units, reporting periods, geographic support and source attribution.
"""
from __future__ import annotations
import csv
import io
import math
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from urllib.parse import urlparse
from . import SCHEMA_VERSION, core

HDX="https://data.humdata.org/api/3/action/package_show"
POWER="https://power.larc.nasa.gov/api/temporal/monthly/point"
RONI="https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt"
SEASONS="DJF JFM FMA MAM AMJ MJJ JJA JAS ASO SON OND NDJ".split()
MARKETS={"BGD":"bangladesh","KEN":"kenya","NGA":"nigeria","PAK":"pakistan","UKR":"ukraine","ETH":"ethiopia"}
# Explicit illustrative production-region points, not national means or field samples.
SITES=[
    ("CAN","Southern Ontario",43.55,-80.25),("USA","Central Iowa",42.03,-93.62),
    ("BRA","Central Mato Grosso",-12.55,-55.72),("ARG","Pampas",-33.9,-60.6),
    ("IND","Punjab",30.9,75.85),("BGD","Northwestern Bangladesh",24.37,88.6),
    ("UKR","Central Ukraine",49.0,32.0),("AUS","Western Australian wheatbelt",-31.65,116.67),
]
PRICE_PRODUCTS={"rice":"rice","wheat":"wheat","maize":"maize","beans":"dry_beans","lentils":"lentils","chickpeas":"chickpeas","soybeans":"soybeans","sorghum":"sorghum","millet":"millet","potatoes":"potatoes","tomatoes":"tomatoes","eggs":"eggs","bananas":"bananas","cassava":"cassava"}
def number(x):
    try:
        v=float(x)
        return v if math.isfinite(v) else None
    except (TypeError,ValueError):
        return None

def parse_roni(raw):
    out={}
    for line in raw.splitlines():
        parts=line.split()
        if len(parts)!=3 or parts[0] not in SEASONS or not parts[1].isdigit():continue
        s,y,v=parts[0],int(parts[1]),number(parts[2])
        if v is None or not -10<=v<=10:continue
        p=f"{y:04}M{SEASONS.index(s)+1:02}"
        if p in out and out[p]["value"]!=v:raise ValueError("Conflicting RONI")
        out[p]={"period":p,"season":s,"value":v}
    if len(out)<60:raise ValueError("Insufficient NOAA index coverage")
    return [out[k] for k in sorted(out)[-120:]]

def enso():
    base={"name":"NOAA CPC Relative Oceanic Niño Index (RONI)","url":"https://cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/","endpoint":RONI,"unit":"°C","licence":"US government public data; credit NOAA CPC","cadence":"Monthly; latest estimates may be revised","limitation":"Three-month relative sea-surface temperature anomaly (ERSSTv6); period is the central month of the season. Not a country-specific rainfall or yield forecast."}
    try:
        data=parse_roni(core.fetch(RONI,timeout=30,attempts=1).decode("ascii"))
        return {**base,"status":"available","retrieved_at":core.iso(core.utc_now()),"series":data}
    except (core.SourceError,ValueError,UnicodeError):
        return {**base,"status":"unavailable","series":[]}

def parse_power(payload,year,month):
    p=payload["properties"]["parameter"]
    units=payload["parameters"]
    expected={"T2M":("C","°C"),"PRECTOTCORR":("mm/day","mm/day")}
    for k,(unit,_) in expected.items():
        if units[k]["units"]!=unit:raise ValueError("NASA POWER units changed")
    result={}
    for k,(_,label) in expected.items():
        vals={}
        for key,value in p[k].items():
            if not re.fullmatch(r"\d{6}",key):continue
            y,m=int(key[:4]),int(key[4:])
            if not 1<=m<=12 or (y,m)>=(year,month):continue
            v=number(value)
            if v is None or v<=-900 or (k=="PRECTOTCORR" and v<0):continue
            vals[(y,m)]=v
        points=[]
        for (y,m),v in sorted(vals.items()):
            if y<year-2:continue
            baseline=[vals[(b,m)] for b in range(1991,2021) if (b,m) in vals]
            normal=sum(baseline)/len(baseline) if len(baseline)>=24 else None
            points.append({"period":f"{y:04}M{m:02}","value":round(v,3),"baseline":round(normal,3) if normal is not None else None,
                           "anomaly":round(v-normal,3) if normal is not None else None,"baseline_n":len(baseline)})
        result[k]={"unit":label,"series":points}
    if not any(x["series"] for x in result.values()):raise ValueError("No complete months")
    return result

def power_site(site):
    iso,name,lat,lon=site
    base={"iso3":iso,"name":name,"latitude":lat,"longitude":lon}
    now=core.utc_now()
    try:
        raw=core.fetch_json(POWER,params={"parameters":"T2M,PRECTOTCORR","community":"AG","longitude":lon,"latitude":lat,"start":1991,"end":now.year,"format":"JSON"},timeout=40,attempts=1)
        return {**base,"status":"available","indicators":parse_power(raw,now.year,now.month),"retrieved_at":core.iso(core.utc_now())}
    except (core.SourceError,ValueError,TypeError,KeyError,AttributeError):
        return {**base,"status":"unavailable","indicators":{}}

def climate():
    with ThreadPoolExecutor(max_workers=3) as pool: sites=list(pool.map(power_site,SITES))
    return {"name":"NASA POWER monthly point API","url":"https://power.larc.nasa.gov/docs/services/api/temporal/monthly/","endpoint":POWER,"licence":"NASA open data; credit NASA POWER / MERRA-2","cadence":"Monthly; recent months may be preliminary","status":"available" if any(s["status"]=="available" for s in sites) else "unavailable","sites":sites,"limitation":"Illustrative grid-cell locations, not crop-weighted national indicators. Temperature and mean daily precipitation rate versus same-month 1991–2020 mean (at least 24 years). No drought classification or yield inference."}

def parse_market_csv(raw,now):
    reader=csv.DictReader(io.StringIO(raw.lstrip("\ufeff")))
    required={"date","market","commodity","unit","currency","pricetype","price","priceflag"}
    if not required.issubset(reader.fieldnames or []):raise ValueError("WFP columns changed")
    series={}
    cutoff=date(now.year-2,now.month,1)
    for r in reader:
        try:d=date.fromisoformat(r["date"][:10])
        except (ValueError,TypeError):continue
        if d<cutoff or d>now:continue
        commodity=r["commodity"].strip()
        # Exact commodity variants remain separate; this key is only a selector hint.
        product=PRICE_PRODUCTS.get(commodity.lower().split(" (")[0].strip())
        if not product or r["pricetype"].strip().lower()!="retail":continue
        if r["priceflag"].strip().lower()!="actual":continue
        v=number(r["price"])
        if v is None or v<=0:continue
        key=(product,commodity,r.get("admin1",""),r.get("market_id",""),r["market"],r["unit"],r["currency"])
        if not key[4] or not key[5] or not key[6]:continue
        period=f"{d.year:04}M{d.month:02}"
        bucket=series.setdefault(key,{})
        # Conflicting same-market monthly entries are not averaged or overwritten.
        if period in bucket and bucket[period]!=v:bucket[period]=None
        else:bucket[period]=v
    rows=[]
    for (product,commodity,admin,market_id,market,unit,currency),p in series.items():
        valid=[{"period":k,"value":v} for k,v in sorted(p.items()) if v is not None]
        if len(valid)<3:continue
        rows.append({"product":product,"commodity":commodity,"admin1":admin,"market_id":market_id,"market":market,"unit":unit,"currency":currency,"points":valid})
    # Bound payload, retain best observed time coverage per product, no fabricated national average.
    result=[]
    for product in PRICE_PRODUCTS.values():
        candidates=[r for r in rows if r["product"]==product]
        result.extend(sorted(candidates,key=lambda r:(r["points"][-1]["period"],len(r["points"]),r["market"]),reverse=True)[:5])
    return result

def wfp_country(item):
    iso,slug=item
    base={"iso3":iso,"url":"https://data.humdata.org/dataset/wfp-food-prices-for-"+slug}
    try:
        response=core.fetch_json(HDX,params={"id":"wfp-food-prices-for-"+slug},timeout=30,attempts=1)
        if not response.get("success"):raise ValueError("CKAN dataset unavailable")
        pkg=response["result"]
        org=(pkg.get("organization") or {}).get("name","").lower()
        licence=pkg.get("license_id","").lower()
        if org not in ("wfp","wfp-vam") or licence not in ("cc-by-igo","cc-by","cc-by-4.0","cc-by-3.0"):
            return {**base,"status":"rights_unverified","series":[],"licence":licence or "unknown"}
        resources=[r for r in pkg.get("resources",[]) if r.get("format","").lower()=="csv" and "price" in (r.get("name","")+" "+r.get("url","")).lower() and "market" not in r.get("name","").lower()]
        if not resources:raise ValueError("No price CSV")
        resource=sorted(resources,key=lambda r:r.get("last_modified") or r.get("created") or "",reverse=True)[0]
        url=resource["url"]
        if urlparse(url).scheme!="https" or urlparse(url).hostname not in ("data.humdata.org","hdx-hapi.humdata.org"):raise ValueError("Unexpected source host")
        raw=core.fetch(url,timeout=45,attempts=1)
        if len(raw)>30_000_000:raise ValueError("Country file exceeds pilot size limit")
        records=parse_market_csv(raw.decode("utf-8-sig"),core.utc_now().date())
        return {**base,"status":"available" if records else "no_eligible_observations","licence":licence,"licence_url":pkg.get("license_url"),"resource_id":resource.get("id"),"provider_updated":pkg.get("metadata_modified"),"retrieved_at":core.iso(core.utc_now()),"series":records}
    except (core.SourceError,ValueError,TypeError,KeyError,AttributeError,UnicodeError):
        return {**base,"status":"unavailable","series":[]}

def domestic():
    with ThreadPoolExecutor(max_workers=3) as pool: countries=list(pool.map(wfp_country,MARKETS.items()))
    return {"name":"WFP market prices via HDX CKAN API","url":"https://data.humdata.org/visualization/wfp-food-price/","endpoint":HDX,"cadence":"Country-specific, generally monthly","status":"available" if any(c["status"]=="available" for c in countries) else "unavailable","countries":countries,"limitation":"Six purposively selected pilot countries. Actual retail quotations, original product variant, market, currency and unit; up to five recent market series per product per country. No national average, no currency conversion. Dataset-specific attribution licence checked before publication."}

def gather():
    with ThreadPoolExecutor(max_workers=3) as pool:
        a,b,c=[pool.submit(fn) for fn in (enso,climate,domestic)]
        return {"schema_version":SCHEMA_VERSION,"retrieved_at":core.iso(core.utc_now()),"enso":a.result(),"climate":b.result(),"domestic":c.result()}

if __name__=="__main__":
    data=gather()
    for key in ("enso","climate","domestic"):
        section=data[key]
        print(key,section["status"])
        for row in section.get("sites",section.get("countries",[])):
            print(" ",row["iso3"],row["status"],len(row.get("series",[])))
        if key=="enso":print(" ",len(section["series"]),"seasons")

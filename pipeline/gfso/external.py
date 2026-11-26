"""Optional source adapters with explicit unavailable states.
Provider datasets are preserved separately; they are not merged into FAO balances
or treated as real-time alerts. No API credentials or browser secrets required.
"""
from __future__ import annotations
import csv, io, math, re, zipfile
from datetime import datetime
from pathlib import Path
from . import SCHEMA_VERSION, core

FPI_URL="https://www.fao.org/media/docs/worldfoodsituationlibraries/wfs-library/food_price_indices_data.csv?download=true&sfvrsn=523ebd2a_85"
FPI_DOC="https://www.fao.org/worldfoodsituation/foodpricesindex/en/"
PSD_URL="https://apps.fas.usda.gov/psdonline/downloads/psd_alldata_csv.zip"
PSD_DOC="https://fas.usda.gov/psdonline"
GEO_ROOT="https://tiles.arcgis.com/tiles/qTQ6qYkHpxlu0G82/arcgis/rest/services"
GEO_DOC="https://www.cropmonitor.org/data-archive"
PSD_PRODUCTS={"0410000":"wheat","0440000":"maize","0422110":"rice","2222000":"soybeans"}
PSD_ATTRIBUTES={"production","imports","exports","ending stocks","domestic consumption","feed dom. consumption","total domestic consumption"}

def norm(value):
    return re.sub(r"[^a-z0-9]","",str(value).lower())

def period(value):
    s=str(value).strip()
    for fmt in ("%Y-%m","%Y-%m-%d","%Y/%m","%Y%m","%YM%m","%b %Y","%B %Y","%b-%Y","%b-%y","%Y %B","%m/%d/%Y"):
        try:
            d=datetime.strptime(s,fmt)
            return f"{d.year:04d}M{d.month:02d}"
        except ValueError:
            pass
    return None

def numeric(value):
    try:
        v=float(value)
        return v if math.isfinite(v) and v>=0 else None
    except (TypeError,ValueError):
        return None

def parse_fpi(text):
    reader=csv.DictReader(io.StringIO(text.lstrip("\ufeff")))
    aliases={"foodpriceindex":"Food Price Index","food":"Food Price Index","ffpi":"Food Price Index",
             "meat":"Meat","meatpriceindex":"Meat","dairy":"Dairy","dairypriceindex":"Dairy",
             "cereals":"Cereals","cerealpriceindex":"Cereals","cerealspriceindex":"Cereals",
             "vegetableoils":"Vegetable oils","vegetableoil":"Vegetable oils","vegetableoilpriceindex":"Vegetable oils",
             "oils":"Vegetable oils","oil":"Vegetable oils","sugar":"Sugar","sugarpriceindex":"Sugar"}
    out={}
    for row in reader:
        row={norm(k):v for k,v in row.items() if k is not None}
        p=period(row.get("date") or row.get("period") or row.get("monthyear") or "")
        if not p and row.get("year") and row.get("month"):
            p=period(str(row["year"])+"-"+str(row["month"]).zfill(2)) or period(str(row["month"])+" "+str(row["year"]))
        if not p:
            continue
        for k,label in aliases.items():
            if k not in row:
                continue
            v=numeric(row[k])
            if v is not None:
                bucket=out.setdefault(label,{})
                if p in bucket and bucket[p]!=v: raise ValueError("Conflicting FAO price-index observation")
                bucket[p]=v
    if "Food Price Index" not in out or len(out["Food Price Index"])<12:
        raise ValueError("FAO index schema or coverage changed")
    return {k:[{"period":p,"value":v} for p,v in sorted(rows.items())[-60:]] for k,rows in out.items()}

def fpi():
    base={"name":"FAO Food Price Index","url":FPI_DOC,"download":FPI_URL,"source":"FAO","licence":"FAO dataset terms; attribution required","licence_url":"https://www.fao.org/contact-us/terms/db-terms-of-use/en/","unit":"Index, 2014–2016=100","limitation":"International export-weighted price indices, not domestic retail prices. Recent meat index includes projected and observed quotations and can be revised."}
    try:
        raw=core.fetch(FPI_URL,timeout=45,attempts=1)
        data=parse_fpi(raw.decode("utf-8-sig"))
        return {**base,"status":"available","series":data,"retrieved_at":core.iso(core.utc_now())}
    except (core.SourceError,ValueError,TypeError,UnicodeError):
        return {**base,"status":"unavailable","series":{}}

def parse_psd(rows, year):
    out={}
    for raw in rows:
        row={norm(k):str(v).strip() for k,v in raw.items() if k is not None and v is not None}
        code=row.get("commoditycode","").zfill(7)
        product=PSD_PRODUCTS.get(code)
        market=row.get("marketyear","")
        attr=row.get("attributedescription","").lower()
        unit=row.get("unitdescription","")
        if not product or not market.isdigit() or int(market)<year-4 or attr not in PSD_ATTRIBUTES:
            continue
        # Match exact reported quantity unit; never guess or convert area/yield.
        if norm(unit) not in ("1000mt","1000metrictons","1000metrictonnes"):
            continue
        country=row.get("countryname",""); cc=row.get("countrycode","")
        value=numeric(row.get("value"))
        if not country or not cc or value is None:
            continue
        k=(product,cc,int(market),attr)
        stamp=(int(row["calendaryear"]) if row.get("calendaryear","").isdigit() else 0,int(row["month"]) if row.get("month","").isdigit() else 0)
        prev=out.get(k)
        if prev and stamp<prev[0]:continue
        if prev and stamp==prev[0] and prev[1]["value"]!=value:
            raise ValueError("Conflicting PSD vintage")
        out[k]=(stamp,{"product":product,"commodity_label":row.get("commoditydescription"),"country_code":cc,"country":country,
                     "market_year":int(market),"attribute":attr,"unit":unit,"value":value,
                     "source_calendar_year":stamp[0] or None,"source_month":stamp[1] or None})
    if not out:raise ValueError("PSD schema or units changed")
    return [v[1] for _,v in sorted(out.items())]

def psd(cache:Path|None):
    base={"name":"USDA Production, Supply and Distribution","url":PSD_DOC,"download":PSD_URL,"source":"USDA FAS","licence":"US federal government public data; attribution","limitation":"Marketing-year estimates and forecasts; not FAO calendar-year observations. Provider country names and quantities retained. Do not infer actual stock availability."}
    try:
        path=(cache or core.cache_dir())/"psd_all_current.zip"
        now=core.utc_now()
        if not path.exists() or now.timestamp()-path.stat().st_mtime>24*3600:
            core.fetch(PSD_URL,dest=path,timeout=120,attempts=1)
        with zipfile.ZipFile(path) as z:
            names=[n for n in z.namelist() if n.lower().endswith(".csv")]
            if len(names)!=1:raise ValueError("Unexpected PSD archive contents")
            with z.open(names[0]) as raw:
                reader=csv.DictReader(io.TextIOWrapper(raw,encoding="utf-8-sig",errors="strict"))
                data=parse_psd(reader,now.year)
        return {**base,"status":"available","records":data,"retrieved_at":datetime.fromtimestamp(path.stat().st_mtime,now.tzinfo).isoformat()}
    except (core.SourceError,ValueError,TypeError,UnicodeError,OSError,zipfile.BadZipFile):
        return {**base,"status":"unavailable","records":[]}

def geoglam():
    base={"name":"GEOGLAM Crop Monitor","url":GEO_DOC,"licence":"CC BY 4.0","licence_url":"https://www.cropmonitor.org/referencing-guidelines","limitation":"Dated official spatial assessments, not measured yield losses. Layer metadata only; no region-level extraction or risk inference."}
    try:
        raw=core.fetch_json(GEO_ROOT,params={"f":"json"},timeout=30,attempts=1)
        latest={}
        for s in raw.get("services",[]):
            name=s.get("name","")
            match=re.fullmatch(r"GEOGLAM_Crop_Monitor_(Synthesis|Wheat|Maize|Rice|Soybean|Sorghum|Millet)_Conditions_(\d{4})_(\d{2})",name,re.I)
            if not match or s.get("type")!="MapServer":continue
            crop,y,m=match.groups();p=f"{y}M{m}"
            if not 1<=int(m)<=12:continue
            if crop.lower() not in latest or p>latest[crop.lower()]["period"]:
                latest[crop.lower()]={"crop":crop,"period":p,"title":name.replace("_"," "),"url":GEO_ROOT+"/"+name+"/MapServer"}
        if not latest:raise ValueError("No dated layer metadata")
        return {**base,"status":"available","layers":list(latest.values()),"retrieved_at":core.iso(core.utc_now())}
    except (core.SourceError,ValueError,TypeError,AttributeError):
        return {**base,"status":"unavailable","layers":[]}

GDACS_API="https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP"
GDACS_DOC="https://www.gdacs.org/"
def parse_hazards(payload):
    if not isinstance(payload,dict) or not isinstance(payload.get("features"),list):
        raise ValueError("Unexpected GDACS schema")
    events={}
    for feat in payload["features"]:
        prop=feat.get("properties") or {}
        typ=str(prop.get("eventtype","")).upper()
        eid=str(prop.get("eventid",""))
        if typ not in ("EQ","TC","FL","VO","WF","DR","TS") or not eid.isdigit():continue
        # Never infer that an earthquake, flood, or other hazard hit cropland.
        key=typ+":"+eid
        def date(v):
            value=str(v or "")
            return value[:19] if re.match(r"^\d{4}-\d{2}-\d{2}",value) else None
        iso=list(dict.fromkeys(re.findall(r"\b[A-Z]{3}\b",str(prop.get("iso3") or "").upper())))
        level=str(prop.get("alertlevel") or "").lower()
        row={"id":key,"event_type":typ,"provider_alert_level":level if level in ("green","orange","red") else "unknown",
             "country":str(prop.get("country") or "Unknown"),"iso3":iso,
             "start":date(prop.get("fromdate")),"end":date(prop.get("todate")),
             "modified":date(prop.get("datemodified")),"url":GDACS_DOC+"resources.aspx?eventid="+eid+"&eventtype="+typ}
        previous=events.get(key)
        if previous is None or (row["modified"] or row["end"] or "")>(previous["modified"] or previous["end"] or ""):
            events[key]=row
    return sorted(events.values(),key=lambda r:r["modified"] or r["end"] or r["start"] or "",reverse=True)[:100]

def gdacs():
    base={"name":"Global Disaster Awareness and Coordination System","url":GDACS_DOC,"source":"GDACS / European Union",
          "licence":"CC BY 4.0; credit GDACS","licence_url":"https://www.gdacs.org/Documents/2025/GDACS_Terms_of_use_Oct_25.pdf",
          "limitation":"Recent provider hazard notifications, not confirmed agricultural damage or an exhaustive disaster inventory. Alert level belongs to GDACS, not GFSO. Confirm with local authorities before decisions."}
    try:
        raw=core.fetch_json(GDACS_API,timeout=30,attempts=1)
        return {**base,"status":"available","events":parse_hazards(raw),"retrieved_at":core.iso(core.utc_now())}
    except (core.SourceError,ValueError,TypeError,AttributeError):
        return {**base,"status":"unavailable","events":[]}

def gather(cache=None):
    return {"schema_version":SCHEMA_VERSION,"fpi":fpi(),"psd":psd(cache),"geoglam":geoglam(),"gdacs":gdacs()}

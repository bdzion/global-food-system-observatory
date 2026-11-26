"""Global coarse-resolution precipitation screening, not crop loss or drought risk."""
from __future__ import annotations
import calendar
from pathlib import Path
import numpy as np
from netCDF4 import Dataset, num2date
from shapely import contains_xy
from shapely.geometry import shape
from . import core, SCHEMA_VERSION

URL="https://downloads.psl.noaa.gov/Datasets/gpcp/precip.mon.mean.nc"
MIRROR="https://psl.noaa.gov/thredds/fileServer/Datasets/gpcp/precip.mon.mean.nc"
BOUNDARIES="https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson"

def months_ending(y,m):
    end=y*12+m-1
    return [(n//12,n%12+1) for n in range(end-2,end+1)]

def totals(data,keys):
    if any(k not in data for k in keys):return None
    return sum(data[k]*calendar.monthrange(*k)[1] for k in keys)

def compute(data,latest):
    current=totals(data,months_ending(*latest))
    if current is None:raise ValueError("Missing consecutive months")
    baseline=[]
    for y in range(1991,2021):
        a=totals(data,months_ending(y,latest[1]))
        if a is not None:baseline.append(a)
    if len(baseline)<24:raise ValueError("Insufficient baseline")
    b=np.stack(baseline)
    n=np.isfinite(b).sum(axis=0)
    normal=np.divide(np.nansum(b,axis=0),n,out=np.full(current.shape,np.nan),where=n>=24)
    diff=current-normal
    ratio=np.divide(100*diff,normal,out=np.full(current.shape,np.nan),where=(normal>=30)&np.isfinite(diff))
    return current,normal,diff,ratio,n

def country_stats(features,lat,lon,current,normal):
    xx,yy=np.meshgrid(lon,lat)
    weights=np.cos(np.deg2rad(yy))
    out={}
    for feat in features:
        p=feat["properties"]; iso=p.get("ISO_A3")
        if not iso or iso=="-99":iso=p.get("ADM0_A3")
        if not iso or iso=="ATA" or len(iso)!=3:continue
        geom=shape(feat["geometry"])
        if not geom.is_valid:geom=geom.buffer(0)
        mask=contains_xy(geom,xx,yy)
        n=int(mask.sum())
        valid=mask&np.isfinite(current)&np.isfinite(normal)
        coverage=float(weights[valid].sum()/weights[mask].sum()) if n else None
        if n<3 or coverage is None or coverage<.8:continue
        w=weights[valid]; obs=float(np.average(current[valid],weights=w)); ref=float(np.average(normal[valid],weights=w))
        out[iso]={"name":p.get("NAME",iso),"cells":n,"valid_cells":int(valid.sum()),"coverage":round(coverage,3),
                  "total_mm":round(obs,1),"normal_mm":round(ref,1),"anomaly_mm":round(obs-ref,1),
                  "anomaly_pct":round(100*(obs-ref)/ref,1) if ref>=30 else None}
    return out

def clean_grid(a):
    return [[round(float(v),1) if np.isfinite(v) else None for v in row] for row in a]

def gather(cache=None):
    base={"schema_version":SCHEMA_VERSION,"source":"GPCP v2.3 via NOAA PSL","url":"https://psl.noaa.gov/data/gridded/data.gpcp.html",
          "download":URL,"geometry_source":"Natural Earth 1:110m v5.1.2, public domain",
          "unit":"mm over three months","resolution_degrees":2.5,"normal":"1991–2020 same three calendar months",
          "limitation":"Coarse global precipitation product; includes oceans and mixed coastal cells. Country statistics use area-weighted grid-centre inclusion, not exact boundary intersections or crop-weighting. At least three cells and 80% valid weighted coverage required. Percent anomaly withheld where normal is below 30 mm. Not drought classification, crop loss, irrigation availability or forecast. Recent GPCP estimates may be interim."}
    try:
        path=(cache or core.cache_dir())/"gpcp_monthly.nc"
        try:
            core.fetch(URL,dest=path,timeout=90,attempts=1)
        except core.SourceError:
            core.fetch(MIRROR,dest=path,timeout=90,attempts=2)
        with Dataset(path) as ds:
            v=ds.variables["precip"]
            if v.units!="mm/day" or v.dimensions!=("time","lat","lon"):raise ValueError("Unexpected GPCP dimensions/units")
            lat=np.asarray(ds.variables["lat"][:],dtype=float)
            lon0=np.asarray(ds.variables["lon"][:],dtype=float)
            lon=(lon0+180)%360-180; order=np.argsort(lon);lon=lon[order]
            if len(lat)!=72 or len(lon)!=144 or not np.allclose(np.abs(np.diff(lat)),2.5) or not np.allclose(np.diff(lon),2.5):raise ValueError("Unexpected GPCP grid")
            t=ds.variables["time"]; dates=num2date(t[:],t.units,calendar=getattr(t,"calendar","standard"))
            now=core.utc_now(); keys=[(d.year,d.month) for d in dates]
            eligible=[k for k in keys if k<(now.year,now.month)]
            latest=max(eligible)
            needed=set(months_ending(*latest))
            for y in range(1991,2021):needed.update(months_ending(y,latest[1]))
            data={}
            for i,k in enumerate(keys):
                if k not in needed:continue
                if k in data:raise ValueError("Duplicate GPCP month")
                arr=np.ma.asarray(v[i,:,:],dtype=float).filled(np.nan)[:,order]
                arr[(arr<0)|(arr>100)]=np.nan
                data[k]=arr
            current,normal,diff,ratio,n=compute(data,latest)
            if np.isfinite(diff).mean()<.9:raise ValueError("Global grid coverage below 90%")
        geom=core.fetch_json(BOUNDARIES,timeout=40,attempts=1)
        countries=country_stats(geom["features"],lat,lon,current,normal)
        if len(countries)<30:raise ValueError("Country coverage unexpectedly low")
        start=months_ending(*latest)[0]
        return {**base,"status":"available","retrieved_at":core.iso(core.utc_now()),
                "period_start":f"{start[0]:04}M{start[1]:02}","period_end":f"{latest[0]:04}M{latest[1]:02}",
                "latitude":lat.tolist(),"longitude":lon.tolist(),"anomaly_mm":clean_grid(diff),"anomaly_pct":clean_grid(ratio),
                "valid_cells":int(np.isfinite(diff).sum()),"countries":countries}
    except (core.SourceError,ValueError,KeyError,TypeError,OSError,AttributeError,RuntimeError) as exc:
        print("GPCP spatial evidence:",type(exc).__name__,core.sanitize(str(exc)),flush=True)
        return {**base,"status":"unavailable","countries":{}}

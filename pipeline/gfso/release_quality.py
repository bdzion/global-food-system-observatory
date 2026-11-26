"""Additive release-level consistency gates for new evidence payloads."""
import math

def finite(x):
    return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)

def checks(release):
    errors=[]
    s=release.get("spatial-evidence",{})
    if s.get("status")=="available":
        lat=s.get("latitude",[]);lon=s.get("longitude",[])
        if len(lat)!=72 or len(lon)!=144:errors.append("Invalid global spatial dimensions")
        for key in ("anomaly_mm","anomaly_pct"):
            grid=s.get(key,[])
            if len(grid)!=len(lat) or any(len(r)!=len(lon) for r in grid):errors.append("Invalid grid shape: "+key)
            if any(x is not None and not finite(x) for r in grid for x in r):errors.append("Non-finite grid: "+key)
        if s.get("valid_cells")!=sum(finite(x) for r in s.get("anomaly_mm",[]) for x in r):errors.append("Spatial valid-cell count mismatch")
        for iso,c in s.get("countries",{}).items():
            if c["cells"]<3 or c["valid_cells"]>c["cells"] or not .8<=c["coverage"]<=1:errors.append("Invalid country spatial coverage: "+iso)
            if not all(finite(c[k]) for k in ("total_mm","normal_mm","anomaly_mm")) or abs(c["total_mm"]-c["normal_mm"]-c["anomaly_mm"])>.21:errors.append("Invalid country precipitation arithmetic: "+iso)
    v=release.get("scientific-validation",{})
    for r in v.get("rows",[]):
        for method in ("screen","persistence","no_alert"):
            a=r[method];counts=[a[k] for k in ("tp","fp","fn","tn")]
            if any(not isinstance(n,int) or n<0 for n in counts) or sum(counts)!=a["n"] or a["n"]!=r["screen"]["n"]:errors.append("Invalid evaluation counts: "+r["id"])
            for k,num,den in (("precision",a["tp"],a["tp"]+a["fp"]),("recall",a["tp"],a["tp"]+a["fn"]),("false_positive_rate",a["fp"],a["fp"]+a["tn"])):
                x=a[k]
                if (den==0 and x is not None) or (den>0 and (not finite(x) or abs(x-num/den)>.0001)):errors.append("Invalid evaluation metric: "+r["id"]+" "+k)
    for c in release.get("api-evidence",{}).get("domestic",{}).get("countries",[]):
        for r in c.get("series",[]):
            points=r["points"];periods=[p["period"] for p in points]
            if periods!=sorted(set(periods)) or len(points)<3 or not r["currency"] or not r["unit"] or any(not finite(p["value"]) or p["value"]<=0 for p in points):errors.append("Invalid retail series: "+c["iso3"])
    a=release.get("authenticated-evidence",{})
    for key in ("usda","hapi"):
        d=a.get(key,{})
        if d.get("status")!="available" and d.get("records"):errors.append("Unapproved authenticated records: "+key)
    return errors

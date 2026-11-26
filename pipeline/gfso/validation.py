"""Retrospective test of price screening against subsequent benchmark price rises.
Uses current revised series, not historical provider vintages; not a crisis forecast.
"""
from . import core, SCHEMA_VERSION

def score(rows):
    tp=sum(a and y for a,y in rows); fp=sum(a and not y for a,y in rows)
    fn=sum(not a and y for a,y in rows); tn=sum(not a and not y for a,y in rows)
    def ratio(a,b):return round(a/b,4) if b else None
    return {"n":len(rows),"tp":tp,"fp":fp,"fn":fn,"tn":tn,"precision":ratio(tp,tp+fp),
            "recall":ratio(tp,tp+fn),"false_positive_rate":ratio(fp,fp+tn),"accuracy":ratio(tp+tn,len(rows))}

def evaluate(pink):
    output=[]
    for sid,values in pink["series"].items():
        series={int(p[:4])*12+int(p[5:])-1:v for p,v in zip(pink["periods"],values) if v is not None and v>0}
        rows=[]; persistence=[]; none=[]
        for t in sorted(series):
            if t<2010*12 or t+3 not in series or t-3 not in series:continue
            history=[(f"{m//12:04}M{m%12+1:02}",v) for m,v in sorted(series.items()) if m<=t]
            z=core.growth_anomaly(history)
            if z is None:continue
            # Endpoint rise over the next three months; not maximum within window.
            y=series[t+3]/series[t]-1>=.10
            rows.append((z>=1,y));persistence.append((series[t]/series[t-3]-1>=.10,y));none.append((False,y))
        if rows:output.append({"id":sid,"name":pink["meta"][sid]["plain"],"screen":score(rows),"persistence":score(persistence),"no_alert":score(none)})
    return {"schema_version":SCHEMA_VERSION,"status":"available" if output else "unavailable","rows":output,
            "evaluated_at":core.iso(core.utc_now()),"target":"At least 10% benchmark price increase from month t to t+3",
            "method":"Rolling-origin retrospective test from 2010. At origin use only data dated through t; existing anomaly >=1 versus trailing three-month rise >=10% and never-alert baseline. Compare on identical eligible origins. No threshold tuning.",
            "limitation":"Latest revised price histories, not historical release vintages; overlapping windows are dependent. This evaluates a price-rise proxy, not food insecurity, crop loss, causal prediction or intervention benefits. No generalization to operational warning skill is claimed."}

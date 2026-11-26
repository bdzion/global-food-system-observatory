from datetime import date
from gfso import api_evidence as a

def test_roni_season_center_and_negative():
    rows=["SEAS YR ANOM"]+[f"{s} {y} -0.5" for y in range(2000,2006) for s in a.SEASONS]
    r=a.parse_roni("\n".join(rows))
    assert r[0]=={"period":"2000M01","season":"DJF","value":-0.5}

def test_power_missing_not_zero_and_current_month_excluded():
    raw={"parameters":{"T2M":{"units":"C"},"PRECTOTCORR":{"units":"mm/day"}},"properties":{"parameter":{"T2M":{"202501":-10,"202502":-999,"202511":20},"PRECTOTCORR":{"202501":0,"202502":-999}}}}
    r=a.parse_power(raw,2025,11)
    assert r["T2M"]["series"][0]["value"]==-10
    assert len(r["T2M"]["series"])==1
    assert r["PRECTOTCORR"]["series"][0]["value"]==0
    assert r["PRECTOTCORR"]["series"][0]["baseline"] is None

def test_market_keeps_units_and_actual_retail_only():
    raw="date,market,market_id,admin1,commodity,unit,currency,pricetype,price,priceflag\n"+"\n".join(f"2025-0{i}-01,Test,1,A,Rice (local),KG,BDT,Retail,{10+i},actual" for i in range(1,4))+"\n2025-04-01,Test,1,A,Rice (local),KG,BDT,Wholesale,90,actual"
    r=a.parse_market_csv(raw,date(2025,5,1))
    assert len(r)==1 and len(r[0]["points"])==3
    assert r[0]["currency"]=="BDT" and r[0]["commodity"]=="Rice (local)"

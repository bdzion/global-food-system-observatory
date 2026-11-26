from gfso import release_quality,api_evidence
from datetime import date

def test_bad_auth_and_bad_validation():
    assert release_quality.checks({"authenticated-evidence":{"usda":{"status":"credential_required","records":[{}]}}})
    a={"n":4,"tp":1,"fp":1,"fn":1,"tn":1,"precision":.9,"recall":.5,"false_positive_rate":.5}
    assert release_quality.checks({"scientific-validation":{"rows":[{"id":"x","screen":a,"persistence":a,"no_alert":a}]}})
def test_conflicting_month_cannot_be_restored():
    h="date,market,market_id,admin1,commodity,unit,currency,pricetype,price,priceflag\n"
    rows=[f"2025-0{i}-01,M,1,A,Rice,KG,BDT,Retail,{v},actual" for i,v in [(1,10),(1,11),(1,10),(2,12),(3,13),(4,14)]]
    r=api_evidence.parse_market_csv(h+"\n".join(rows),date(2025,5,1))
    assert len(r)==1 and all(p["period"]!="2025M01" for p in r[0]["points"])

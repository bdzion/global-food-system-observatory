import numpy as np
from gfso import spatial,validation,authenticated

def test_calendar_totals_and_baseline():
    d={(y,m):np.array([[2.]]) for y in range(1990,2022) for m in range(1,13)}
    for k in spatial.months_ending(2021,3):d[k]=np.array([[3.]])
    cur,ref,delta,ratio,n=spatial.compute(d,(2021,3))
    assert cur[0,0]==270
    assert 89<delta[0,0]<91 and 49<ratio[0,0]<51
    assert n[0,0]==30

def test_country_coverage_and_weighting():
    geom={"properties":{"ISO_A3":"AAA","NAME":"Test"},"geometry":{"type":"Polygon","coordinates":[[[-2,-2],[3,-2],[3,3],[-2,3],[-2,-2]]]}}
    lat=np.array([0,1]);lon=np.array([0,1]);v=np.full((2,2),120.);b=np.full((2,2),100.)
    r=spatial.country_stats([geom],lat,lon,v,b)
    assert r["AAA"]["anomaly_pct"]==20 and r["AAA"]["cells"]==4
    v[0,0]=np.nan
    assert spatial.country_stats([geom],lat,lon,v,b)=={}

def test_score_undefined_and_confusion():
    s=validation.score([(True,True),(True,False),(False,True),(False,False)])
    assert s["precision"]==s["recall"]==s["false_positive_rate"]==.5
    assert validation.score([(False,False)])["precision"] is None

def test_auth_absent(monkeypatch):
    monkeypatch.delenv("USDA_FAS_API_KEY",raising=False)
    monkeypatch.delenv("HDX_HAPI_APP_IDENTIFIER",raising=False)
    assert authenticated.usda()["status"]=="credential_required"
    assert authenticated.hapi()["status"]=="credential_required"

def test_ipc_rights_and_assessment_separation():
    row={"resource_hdx_id":"r","location_code":"BGD","ipc_phase":"3","ipc_type":"current","admin_level":0,"reference_period_start":"2026-01-01","reference_period_end":"2026-03-01","population_in_phase":10}
    assert authenticated.parse_ipc([row],set())==[]
    assert len(authenticated.parse_ipc([row,{**row,"ipc_type":"projected"}],{"r"}))==2

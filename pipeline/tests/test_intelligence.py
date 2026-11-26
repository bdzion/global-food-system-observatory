from gfso import analysis, intelligence, core

def test_freshness():
    assert analysis.price_freshness("2026M10","2026M11") == "current"
    assert analysis.price_freshness("2020M08","2026M11") == "historical"
    assert analysis.price_freshness("2026M06","2026M11") == "delayed"

def test_missing_month_is_not_one_month_growth():
    pts=[(f"{2000+i//12}M{i%12+1:02}",100+i%7+i) for i in range(100)]
    assert core.growth_anomaly(pts[:-2]+pts[-1:]) is None

def test_compact_coverage_preserves_zero():
    row={"iso3":"AAA","name":"Test","year":2024,"production_t":0,"suppliers":[]}
    data={"schema_version":1,"extension_version":1,"products":{"wheat":{"name":"Wheat","year":2024,"countries":{"AAA":row},"price":None}}}
    views=intelligence.compact_views(data)
    assert views["commodity-index"]["coverage"]["wheat"]["production_t"]==1
    assert views["commodity-index"]["coverage"]["wheat"]["imports_t"]==0
    assert views["commodities/wheat"]["product"]["countries"]["AAA"]["production_t"]==0

from gfso import authenticated as a
def test_bulk_concordance_requires_same_vintage():
    r={"product":"maize","country_code":"CA","market_year":2025,"attribute":"production","value":100,"source_calendar_year":2026,"source_month":10}
    assert a.compare_bulk([r],[{**r,"source_month":9}])["comparable_records"]==0
    rows=[{**r,"country_code":str(i)} for i in range(20)]
    assert a.compare_bulk(rows,rows)["status"]=="matched"
    assert a.compare_bulk(rows,[{**rows[0],"value":101},*rows[1:]])["status"]=="insufficient_or_disagreeing"

def test_psd_lookup_and_exact_units():
    r={"countryCode":"CA","attributeId":1,"unitId":2,"value":3,"marketYear":2025,"calendarYear":2026,"month":10}
    out=a.psd_records([r],"0440000",2025,{"CA":"Canada"},{"0440000":"Maize"},{"1":"Production"},{"2":"(1000 MT)"})
    assert out[0]["country"]=="Canada" and out[0]["value"]==3

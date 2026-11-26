from gfso import external

def test_fpi_parser():
    data="Date,Food Price Index,Meat,Dairy,Cereals,Vegetable oils,Sugar\n"+"\n".join(f"2025-{i:02},100,90,80,70,60,50" for i in range(1,13))
    out=external.parse_fpi(data)
    assert out["Food Price Index"][-1]=={"period":"2025M12","value":100}
    assert len(out)==6

def test_psd_preserves_units_and_market_year():
    row={"Commodity_Code":"0410000","Country_Code":"CA","Country_Name":"Canada","Market_Year":"2026","Attribute_Description":"Ending Stocks","Unit_Description":"(1000 MT)","Value":"0","Calendar_Year":"2026","Month":"11"}
    out=external.parse_psd([row],2026)
    assert out[0]["value"]==0 and out[0]["market_year"]==2026
    assert out[0]["unit"]=="(1000 MT)"

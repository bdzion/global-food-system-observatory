"""Actual Chromium verification of built site against a validated snapshot."""
import os
from playwright.sync_api import sync_playwright
URL=os.environ.get("GFSO_TEST_URL","http://127.0.0.1:4173/global-food-system-observatory/")
with sync_playwright() as p:
    browser=p.chromium.launch()
    for width,height in [(1440,900),(390,844)]:
        page=browser.new_page(viewport={"width":width,"height":height})
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        for route,title in [("home","The system"),("commodities?commodity=maize&geo=CAN","The indicators"),("watch","The threats"),("stress?commodity=wheat&geo=BGD","Possible timelines"),("briefs","Country briefs"),("how","Sources and methods")]:
            page.goto(URL+"#/"+route,wait_until="domcontentloaded")
            page.get_by_role("heading",name=title,exact=True).wait_for(timeout=30000)
            page.wait_for_timeout(300)
            assert not page.locator("body").inner_text().startswith("Nothing is being shown"),route
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 4"),f"Horizontal overflow {width} {route}"
            print(width,route,"rendered")
        page.goto(URL+"#/commodities?commodity=wheat&geo=CAN",wait_until="domcontentloaded")
        page.get_by_role("heading",name="The indicators",exact=True).wait_for(timeout=30000)
        page.get_by_role("combobox",name="Commodity",exact=True).wait_for(timeout=30000)
        page.get_by_role("combobox",name="Commodity",exact=True).select_option("maize")
        page.get_by_role("heading",name="The indicators",exact=True).wait_for(timeout=30000)
        assert page.get_by_role("combobox",name="Commodity",exact=True).input_value()=="maize"
        page.get_by_role("combobox",name="Country",exact=True).select_option("BGD")
        page.wait_for_function("location.hash.includes('geo=BGD')")
        page.get_by_role("link",name="The threats",exact=True).click()
        page.get_by_role("heading",name="The threats",exact=True).wait_for(timeout=30000)
        assert page.get_by_role("combobox",name="Country",exact=True).input_value()=="BGD"
        page.goto(URL+"#/briefs?commodity=rice&geo=BGD",wait_until="domcontentloaded")
        page.get_by_role("heading",name="What we know about the selected country and food",exact=True).wait_for(timeout=30000)
        page.get_by_role("button",name="Download country brief").wait_for(timeout=30000)
        with page.expect_download() as download:
            page.get_by_role("button",name="Download country brief").click()
        assert download.value.suggested_filename.startswith("gfso-brief-BGD-rice-")
        assert not errors,errors
        page.close()
    browser.close()

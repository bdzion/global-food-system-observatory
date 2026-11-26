# API evidence integration and source review

Baseline d2eb999. Design: scheduled server-side retrieval, validation, small versioned JSON, checksum-verified browser views, observation dates, access and provider attribution. No keys in browser; no claims of real-time coverage.

| Source | Method / evidence | Frequency | Status / decision relevance |
|---|---|---|---|
| FAOSTAT SCL, TM, CP, CAHD | Bulk archives; national balances, bilateral trade, CPI, modelled diet affordability | Annual / monthly | Core; exact form and flags |
| World Bank Pink Sheet | Monthly workbook | Monthly | Core; benchmark not retail |
| World Bank WDI | REST API | Annual | Core; financial, water, nutrition, electricity context |
| USDA PSD | Bulk download; API requires key | Monthly | Existing optional adapter; marketing year estimates, verify real release |
| FAO FPI | Official CSV | Monthly | Existing optional adapter; food-group prices |
| GEOGLAM | ArcGIS REST dated layer catalogue | Monthly | Existing optional metadata; not pixel/region analysis |
| GDACS | REST GeoJSON | Event-based | Existing optional adapter; hazard not crop damage |
| NOAA CPC RONI | https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt | Monthly | New adapter; official ERSSTv6 three-month relative anomaly, preliminary latest values |
| NASA POWER | https://power.larc.nasa.gov/api/temporal/monthly/point | Monthly | New adapter; eight selected production-region points; no national/crop-weighted claims |
| WFP via HDX | https://data.humdata.org/api/3/action/package_show + resource CSV | Monthly/variable | New adapter; six pilot countries, actual retail only, dataset licence and publisher check |
| HDX HAPI | https://hdx-hapi.readthedocs.io/en/latest/getting-started/ | Variable | Requires registered app identifier; underlying dataset rights must be checked |
| GIEWS FPMA | https://www.fao.org/giews/food-prices/en/ | Variable | Public portal; documented public bulk/API and terms need confirmation |
| AMIS | https://www.amis-outlook.org/ | Monthly | Reports; no confirmed stable API, link only |
| UN Comtrade | https://comtradeapi.un.org/ | Monthly/annual | Quotas and redistribution rights; keep FAOSTAT until cleared |
| IMF PortWatch | https://portwatch.imf.org/ | Daily | ArcGIS data; terms and exact activity metrics need verification |
| WOAH WAHIS | https://wahis.woah.org/ | Event | Public dashboard; approved automated access/rights needed |
| CHIRPS | https://www.chc.ucsb.edu/data/chirps | Pentadal/monthly | Gridded data; crop-area intersections and calendars required |
| Copernicus CDS | https://cds.climate.copernicus.eu/ | Variable | Account/token and product licences; gridded processing |
| FAO AQUASTAT | https://www.fao.org/aquastat/en/ | Annual/irregular | Structural water indicators; not live irrigation supply |
| IPC/WFP HungerMap | https://www.ipcinfo.org/ ; https://hungermap.wfp.org/ | Assessment-specific | Distinguish observed and projected, access/redistribution check |
| UNICEF | https://data.unicef.org/ | Survey-specific | Nutrition; SDMX indicator definitions and licences |
| ReliefWeb | https://reliefweb.int/ | Frequent | Approved app name required; source links not article republication |
| FAO FishStat | https://www.fao.org/fishery/en/statistics | Annual | Fisheries; live-weight vs processed product forms |
| IFPRI Food Security Portal | https://www.foodsecurityportal.org/ | Variable | Trade policy and market intelligence; dataset-specific access |
| Food Systems Dashboard / Countdown | https://www.foodsystemsdashboard.org/ | Variable | Structural food system comparison; original data licences |

Pilot decisions: NASA points are illustrative selected production regions (not verified farm sites), same-calendar-month normal 1991–2020 requires 24 available years; exclude current partial month and fill sentinel. Precipitation is mean daily rate, not monthly total. WFP series retain exact variant, geography, actual retail flag, original unit/currency and dates; no national averaging, inferred conversion or global completeness. Reject conflicting monthly observations; cap to five series per mapped product. Official provider evidence can be unavailable; status is not evidence of no hazard. No independent yield/price prediction. Live smoke test on PR uses bounded requests, reports actual status and counts (does not require optional providers to succeed). Full pipeline publishes after checks. Further integration requires credential setup, rights verification, spatial methods and empirical validation.

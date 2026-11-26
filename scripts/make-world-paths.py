"""Build public/world-paths.json: country outlines as SVG paths for the supplier map.

Source: Natural Earth 1:110m admin-0 countries (public domain),
https://github.com/nvkelso/natural-earth-vector (geojson/ne_110m_admin_0_countries.geojson).
Projection: equirectangular, longitude -180..180 -> x 0..1000, latitude 84..-58 -> y 0..(scaled).
Antarctica is left out. Run once; the output is committed.
Usage: python scripts/make-world-paths.py path/to/ne_110m_admin_0_countries.geojson
"""
import json
import sys

W, LAT0, LAT1 = 1000.0, 84.0, -58.0
H = W * (LAT0 - LAT1) / 360.0


def xy(lon, lat):
    return round((lon + 180) / 360 * W, 1), round((LAT0 - lat) / (LAT0 - LAT1) * H, 1)


def ring(r):
    pts = [xy(*p[:2]) for p in r]
    out, last = [], None
    for p in pts:  # drop repeated points after rounding
        if p != last:
            out.append(p)
            last = p
    return "M" + "L".join(f"{x:g},{y:g}" for x, y in out) + "Z" if len(out) > 2 else ""


src = json.load(open(sys.argv[1], encoding="utf-8"))
countries = []
for f in src["features"]:
    p = f["properties"]
    iso = p.get("ISO_A3") if p.get("ISO_A3") not in (None, "-99") else p.get("ADM0_A3")
    if iso == "ATA":
        continue
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    d = "".join(ring(r) for poly in polys for r in poly)
    countries.append({"iso3": iso, "name": p.get("NAME"), "d": d})
json.dump({"width": W, "height": round(H, 1), "source": "Natural Earth 1:110m (public domain)", "countries": countries},
          open("public/world-paths.json", "w"), separators=(",", ":"))
print(len(countries), "countries")

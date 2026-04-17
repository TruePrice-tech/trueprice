"""
Build BLS mechanic wage lookup JSON for auto-repair.html.

Source: BLS Occupational Employment & Wage Statistics (OEWS), metro file.
Occupation: SOC 49-3023 — Automotive Service Technicians and Mechanics.

Output: data/bls-mechanic-wages.json — keyed by city name (lowercase) with
        wage, state, msa. Also includes state median + US median fallback.

Re-run annually when BLS publishes new data (typically April for prior May).

Usage:
    python scripts/build-bls-wages.py
"""

import json, os, sys, urllib.request, zipfile, io, tempfile
import openpyxl

BLS_URL = "https://www.bls.gov/oes/special-requests/oesm24ma.zip"
INNER_PATH = "oesm24ma/MSA_M2024_dl.xlsx"
SOC_CODE = "49-3023"
OUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "bls-mechanic-wages.json")

def main():
    print(f"Downloading {BLS_URL} ...")
    req = urllib.request.Request(BLS_URL, headers={"User-Agent": "Mozilla/5.0 Woogoro"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        zip_bytes = resp.read()
    print(f"Downloaded {len(zip_bytes)} bytes")

    with tempfile.TemporaryDirectory() as td:
        zip_path = os.path.join(td, "bls.zip")
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(td)
        xlsx_path = os.path.join(td, INNER_PATH)
        if not os.path.exists(xlsx_path):
            print(f"Could not find {INNER_PATH} in archive. Contents:")
            for n in os.listdir(td):
                print(" ", n)
            sys.exit(1)

        wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
        ws = wb.active
        rows = ws.iter_rows(values_only=True)
        hdr = next(rows)
        i_area = hdr.index("AREA")
        i_title = hdr.index("AREA_TITLE")
        i_state = hdr.index("PRIM_STATE")
        i_occ = hdr.index("OCC_CODE")
        i_hmedian = hdr.index("H_MEDIAN")
        i_hmean = hdr.index("H_MEAN")

        def num(x):
            try: return float(x)
            except: return None

        metros = {}
        for r in rows:
            if not r or r[i_occ] != SOC_CODE:
                continue
            hmed = num(r[i_hmedian]) or num(r[i_hmean])
            if hmed is None:
                continue
            metros[str(r[i_area])] = {
                "title": r[i_title],
                "state": r[i_state],
                "h_median": hmed,
            }

    print(f"Found {len(metros)} metros with SOC {SOC_CODE} data")

    city_lookup = {}
    state_wages = {}
    for area, info in metros.items():
        title = info["title"]
        state = info["state"]
        wage = info["h_median"]
        cities_part = title.rsplit(",", 1)[0] if "," in title else title
        for city in [c.strip() for c in cities_part.split("-")]:
            key = city.lower().strip()
            if not key:
                continue
            if key not in city_lookup or wage > city_lookup[key]["wage"]:
                city_lookup[key] = {"wage": round(wage, 2), "state": state, "msa": title}
        state_wages.setdefault(state, []).append(wage)

    state_median = {}
    for st, wages in state_wages.items():
        wages.sort()
        state_median[st] = round(wages[len(wages) // 2], 2)

    out = {
        "sourceVersion": "BLS OEWS May 2024",
        "soc": SOC_CODE,
        "occupation": "Automotive Service Technicians and Mechanics",
        "cities": city_lookup,
        "stateMedian": state_median,
        "usMedian": round(sorted(state_median.values())[len(state_median) // 2], 2),
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(city_lookup)} cities, {len(state_median)} states to {OUT_PATH}")
    print(f"US median wage: ${out['usMedian']}/hr")


if __name__ == "__main__":
    main()

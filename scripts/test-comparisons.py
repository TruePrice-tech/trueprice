"""
Run a 3-quote comparison test for each vertical that has comparison-*
fixtures. For each set, OCR each fixture locally, post to the analyzer
endpoint, and verify all 3 parse with a detectable price. Determine
which is "cheapest" for the comparison logic.

This is the per-vertical version of Section 4A in the QA checklist
(multi-quote comparison test).
"""

import os, sys, io, json, base64, time, glob, urllib.request, urllib.parse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

BASE = "https://truepricehq.com"

VERTICAL_ENDPOINTS = {
    "auto": "auto-repair-estimate",
    "hvac": "hvac-estimate",
    "plumbing": "plumbing-estimate",
    "electrical": "electrical-estimate",
    "roofing": None,  # roofing uses parse-quote.js for the analyzer
    "solar": "solar-estimate",
    "medical": "medical-bill-estimate",
    "legal": "legal-fee-estimate",
}

def ocr_local(b64, mime):
    body = urllib.parse.urlencode({
        "base64Image": f"data:{mime};base64,{b64}",
        "language": "eng", "OCREngine": "2", "isTable": "true", "scale": "true"
    }).encode()
    req = urllib.request.Request("https://api.ocr.space/parse/image", data=body,
        headers={"apikey": "K84200508188957", "Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
        if data.get("IsErroredOnProcessing"):
            return None
        rs = data.get("ParsedResults", [])
        return ("\n".join(r.get("ParsedText","") for r in rs)).strip() if rs else None
    except:
        return None

def post(endpoint, fpath):
    with open(fpath, "rb") as f:
        raw = f.read()
    raw_b64 = base64.b64encode(raw).decode()
    img_url = f"data:image/png;base64,{raw_b64}"
    ocr_text = ocr_local(raw_b64, "image/png")
    payload = {"images": [img_url]}
    if ocr_text:
        payload["text"] = ocr_text
    req = urllib.request.Request(
        f"{BASE}/api/{endpoint}",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Origin": BASE,
            "User-Agent": "Mozilla/5.0 (TruePriceTest)",
            "X-TruePrice-Test": "1"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()[:200]}
    except Exception as e:
        return {"error": str(e)}

def extract_total(d):
    if not d: return None
    inner = d.get("data") or d.get("estimate") or d
    if not isinstance(inner, dict): return None
    for f in ["totalPrice","quoteTotal","total","flatFee","retainerAmount","totalBilled","patientResponsibility","estimatedTotalLow"]:
        v = inner.get(f)
        if v: return v
    cp = inner.get("contingencyPercent")
    if cp: return round(50000 * (cp / 100))
    hr = inner.get("hourlyRate")
    if hr: return hr * 10
    return None

def test_vertical_comparison(vertical, endpoint):
    folder = f"test-quotes/{vertical}-test-images"
    fixtures = sorted(glob.glob(os.path.join(folder, "comparison-*.png")))
    if not fixtures:
        return None
    if not endpoint:
        return {"vertical": vertical, "skipped": "no_endpoint"}
    print(f"\n=== {vertical} ({len(fixtures)} fixtures) ===")
    results = []
    for f in fixtures:
        name = os.path.basename(f)
        print(f"  {name}: posting...")
        t0 = time.time()
        d = post(endpoint, f)
        elapsed = round(time.time() - t0, 1)
        if "error" in d:
            print(f"    FAIL ({elapsed}s): {d.get('error')} {d.get('body','')[:100]}")
            results.append({"file": name, "ok": False, "err": str(d)[:200]})
        else:
            total = extract_total(d)
            print(f"    OK ({elapsed}s) total={total}")
            results.append({"file": name, "ok": True, "total": total})
        time.sleep(2)
    parsed = sum(1 for r in results if r.get("ok") and r.get("total"))
    cheapest = None
    if parsed == len(fixtures):
        cheapest = min(results, key=lambda r: r.get("total") or float('inf'))
    return {
        "vertical": vertical,
        "fixtures": len(fixtures),
        "parsed": parsed,
        "cheapest": cheapest["file"] if cheapest else None,
        "results": results,
    }

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--vertical", help="run only this vertical")
    args = ap.parse_args()

    summary = []
    targets = [args.vertical] if args.vertical else list(VERTICAL_ENDPOINTS.keys())
    for v in targets:
        ep = VERTICAL_ENDPOINTS.get(v)
        try:
            r = test_vertical_comparison(v, ep)
            if r:
                summary.append(r)
        except Exception as e:
            print(f"  {v} ERR: {e}")

    print("\n\n=== COMPARISON TEST SUMMARY ===")
    print(f"{'vertical':12} {'parsed':>10} {'cheapest':40}")
    for r in summary:
        if r.get("skipped"):
            print(f"{r['vertical']:12} SKIPPED ({r['skipped']})")
            continue
        n = r["fixtures"]
        p = r["parsed"]
        ch = r.get("cheapest", "?")
        flag = "OK" if p == n else "FAIL"
        print(f"{r['vertical']:12} {p}/{n:<8} {ch:40} {flag}")

if __name__ == "__main__":
    main()

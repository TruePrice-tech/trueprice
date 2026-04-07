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
    "roofing": "parse-quote",  # roofing uses parse-quote.js
    "solar": "solar-estimate",
    "medical": "medical-bill-estimate",
    "legal": "legal-fee-estimate",
    "moving": "moving-estimate",
    "concrete": "concrete-estimate",
    "foundation": "foundation-estimate",
    "fencing": "fencing-estimate",
    "garage-door": "garage-door-estimate",
    "gutters": "gutters-estimate",
    "insulation": "insulation-estimate",
    "kitchen": "kitchen-estimate",
    "landscaping": "landscaping-estimate",
    "painting": "painting-estimate",
    "siding": "siding-estimate",
    "windows": "windows-estimate",
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

REPRESENTATIVE_RECOVERY = 50000
REPRESENTATIVE_HOURS = 30

def extract_total(d, vertical=None):
    """Headline price for ranking comparison fixtures.

    For LEGAL, all quotes in a comparison set must be normalized to the
    SAME representative scenario (a $50k recovery / 30-hour matter), so
    a 33% contingency genuinely ranks cheaper than a 40% one. We deliberately
    IGNORE totalPrice / flatFee scraped from individual quotes for legal,
    because different quotes will use different formats (one says "$18,150
    estimated", the next says "35% contingency", the next says "$28,000")
    and comparing those raw values is apples to oranges. Normalize first.

    For all other verticals, use the standard fallthrough chain.
    """
    if not d: return None
    inner = d.get("data") or d.get("estimate") or d
    if not isinstance(inner, dict): return None

    if vertical == "legal":
        # Legal-specific normalization (project everything to one matter)
        cp = inner.get("contingencyPercent") or inner.get("contingencyPct")
        if cp:
            return round(REPRESENTATIVE_RECOVERY * (cp / 100))
        flat = inner.get("flatFee")
        if flat: return flat
        hr = inner.get("hourlyRate")
        if hr: return hr * REPRESENTATIVE_HOURS
        ret = inner.get("retainerAmount") or inner.get("retainer")
        if ret: return ret
        # Last resort: any totalPrice the parser scraped
        return inner.get("totalPrice")

    # Standard fallthrough for all other verticals
    for f in ["totalPrice","quoteTotal","total","flatFee","retainerAmount","totalBilled","patientResponsibility","estimatedTotalLow","price"]:
        v = inner.get(f)
        if v: return v
    return None

def extract_verdict(d):
    """Pull any verdict / summary / explanation field the parser produced.
    Returns the longest non-empty string we can find. Empty/short means
    the parser parsed the price but failed to explain it — a silent UX
    bug we want to catch."""
    if not d: return ""
    inner = d.get("data") or d.get("estimate") or d
    if not isinstance(inner, dict): return ""
    candidates = []
    for f in ["summary", "verdict", "verdictText", "explanation", "analysis", "assessment", "notes"]:
        v = inner.get(f)
        if isinstance(v, str) and v.strip():
            candidates.append(v.strip())
    return max(candidates, key=len) if candidates else ""

def test_vertical_comparison(vertical, endpoint, include_messy=True):
    folder = f"test-quotes/{vertical}-test-images"
    fixtures = sorted(glob.glob(os.path.join(folder, "comparison-*.png")))
    if include_messy:
        fixtures += sorted(glob.glob(os.path.join(folder, "messy-comparison-*.jpg")))
    if not fixtures:
        return None
    if not endpoint:
        return {"vertical": vertical, "skipped": "no_endpoint"}
    print(f"\n=== {vertical} ({len(fixtures)} fixtures) ===")
    results = []
    for f in fixtures:
        name = os.path.basename(f)
        is_messy = name.startswith("messy-")
        tag = " [messy]" if is_messy else ""
        print(f"  {name}{tag}: posting...")
        t0 = time.time()
        d = post(endpoint, f)
        elapsed = round(time.time() - t0, 1)
        if "error" in d:
            print(f"    FAIL ({elapsed}s): {d.get('error')} {d.get('body','')[:100]}")
            results.append({"file": name, "ok": False, "err": str(d)[:200], "messy": is_messy})
        else:
            total = extract_total(d, vertical=vertical)
            verdict = extract_verdict(d)
            verdict_ok = len(verdict) >= 40
            v_tag = "" if verdict_ok else " VERDICT_TOO_SHORT"
            print(f"    OK ({elapsed}s) total={total} verdict={len(verdict)}c{v_tag}")
            results.append({"file": name, "ok": True, "total": total,
                            "verdict_len": len(verdict), "verdict_ok": verdict_ok,
                            "messy": is_messy})
        time.sleep(2)
    clean_results = [r for r in results if not r.get("messy")]
    messy_results = [r for r in results if r.get("messy")]
    parsed = sum(1 for r in clean_results if r.get("ok") and r.get("total"))
    parsed_messy = sum(1 for r in messy_results if r.get("ok") and r.get("total"))
    verdict_ok_count = sum(1 for r in results if r.get("verdict_ok"))
    cheapest = None
    if parsed == len(clean_results):
        cheapest = min(clean_results, key=lambda r: r.get("total") or float('inf'))
    return {
        "vertical": vertical,
        "fixtures": len(clean_results),
        "messy_fixtures": len(messy_results),
        "parsed": parsed,
        "parsed_messy": parsed_messy,
        "verdict_ok": verdict_ok_count,
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
    print(f"{'vertical':12} {'clean':>8} {'messy':>8} {'verdict':>8}  {'cheapest':40}")
    for r in summary:
        if r.get("skipped"):
            print(f"{r['vertical']:12} SKIPPED ({r['skipped']})")
            continue
        n = r["fixtures"]; p = r["parsed"]
        nm = r.get("messy_fixtures", 0); pm = r.get("parsed_messy", 0)
        vo = r.get("verdict_ok", 0)
        total_fix = n + nm
        ch = r.get("cheapest") or "?"
        flag = "OK" if p == n else "FAIL"
        print(f"{r['vertical']:12} {p}/{n:<6} {pm}/{nm:<6} {vo}/{total_fix:<6} {ch:40} {flag}")

if __name__ == "__main__":
    main()

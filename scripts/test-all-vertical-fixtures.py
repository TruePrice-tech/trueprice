"""
Run every fixture in test-quotes/{vertical}-test-images/ through its
corresponding live /api/{vertical}-estimate endpoint and capture results
in test-results.md per folder. Verifies parser accuracy and that the
flywheel bridge increments tp:total_quotes for each successful parse.

Usage:
    python scripts/test-all-vertical-fixtures.py
    python scripts/test-all-vertical-fixtures.py --vertical hvac   # single
"""

import urllib.request, urllib.error, json, os, base64, sys, io, time, glob, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

BASE = "https://truepricehq.com"

# Map test folder name -> API endpoint slug
VERTICAL_ENDPOINTS = {
    "auto":       "auto-repair-estimate",
    "roofing":    "roofing-estimate",  # may not exist; will check
    "hvac":       "hvac-estimate",
    "plumbing":   "plumbing-estimate",
    "electrical": "electrical-estimate",
    "solar":      "solar-estimate",
    "medical":    "medical-bill-estimate",
    "legal":      "legal-fee-estimate",
    "concrete":   "concrete-estimate",
    "foundation": "foundation-estimate",
    "moving":     "moving-estimate",
}

def get_counter():
    try:
        req = urllib.request.Request(f"{BASE}/api/analytics?counter=1", headers={"User-Agent":"TruePriceTest/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()).get("count", 0)
    except:
        return None

def post_image(endpoint, fpath):
    with open(fpath, "rb") as f:
        ext = os.path.splitext(fpath)[1].lower().strip(".")
        if ext == "jpg": ext = "jpeg"
        b64 = "data:image/" + ext + ";base64," + base64.b64encode(f.read()).decode()
    payload = json.dumps({"images": [b64]}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/{endpoint}",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Origin": BASE,
            "User-Agent": "TruePriceTest/1.0"
        }
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return {"ok": True, "data": json.loads(r.read()), "elapsed": round(time.time() - t0, 1)}
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:500]
        return {"ok": False, "status": e.code, "body": body, "elapsed": round(time.time() - t0, 1)}
    except Exception as e:
        return {"ok": False, "error": str(e), "elapsed": round(time.time() - t0, 1)}

def extract_total(data):
    """Pull totalPrice or quote total from various response shapes."""
    if not data: return None
    inner = data.get("data") or data.get("estimate") or data
    if isinstance(inner, dict):
        return inner.get("totalPrice") or inner.get("quoteTotal") or inner.get("total")
    return None

def test_vertical(vertical, endpoint, dry_run=False):
    folder = f"test-quotes/{vertical}-test-images"
    if not os.path.exists(folder):
        print(f"  SKIP: no folder {folder}")
        return None

    samples = sorted([f for f in os.listdir(folder) if f.lower().endswith((".jpg",".jpeg",".png",".webp"))])
    if not samples:
        print(f"  SKIP: no samples in {folder}")
        return None

    print(f"\n=== {vertical} ({len(samples)} samples, /api/{endpoint}) ===")
    starting = get_counter()
    print(f"  starting counter: {starting}")

    results = []
    for s in samples:
        fpath = os.path.join(folder, s)
        size = os.path.getsize(fpath)
        if size > 4_500_000:  # 4.5 MB cap (Vercel limit ~4.5 MB body)
            print(f"  {s}: SKIP (too large: {size} bytes)")
            results.append({"file": s, "skipped": "too_large", "size": size})
            continue
        print(f"  {s}: posting ({size} bytes)...")
        if dry_run:
            results.append({"file": s, "dry_run": True})
            continue
        r = post_image(endpoint, fpath)
        if r["ok"]:
            total = extract_total(r["data"])
            print(f"    OK ({r['elapsed']}s) total={total}")
            results.append({"file": s, "ok": True, "total": total, "elapsed": r["elapsed"], "raw": r["data"]})
        else:
            print(f"    FAIL: {r.get('status', '?')} {r.get('body', r.get('error', ''))[:120]}")
            results.append({"file": s, "ok": False, "err": r.get("body") or r.get("error"), "status": r.get("status")})
        time.sleep(2)  # be polite

    ending = get_counter()
    print(f"  ending counter: {ending}")
    delta = (ending - starting) if (starting and ending) else None
    expected_delta = sum(1 for r in results if r.get("ok") and r.get("total"))
    print(f"  counter delta: +{delta} (expected +{expected_delta})")

    # Write per-vertical test-results.md
    out_md = os.path.join(folder, "test-results.md")
    with open(out_md, "w", encoding="utf-8") as f:
        f.write(f"# {vertical.title()} Test Results\n\n")
        f.write(f"Run: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Endpoint: {BASE}/api/{endpoint}\n")
        f.write(f"Samples tested: {len(samples)}\n\n")
        f.write(f"**Counter at start:** {starting}\n")
        f.write(f"**Counter at end:** {ending}\n")
        f.write(f"**Counter delta:** +{delta} (expected +{expected_delta})\n\n")

        ok_count = sum(1 for r in results if r.get("ok"))
        with_price = sum(1 for r in results if r.get("ok") and r.get("total"))
        f.write(f"**Parse success:** {ok_count}/{len(samples)}\n")
        f.write(f"**Detected price:** {with_price}/{len(samples)}\n\n")

        for r in results:
            f.write(f"## {r['file']}\n\n")
            if r.get("skipped"):
                f.write(f"SKIPPED: {r['skipped']}\n\n")
                continue
            if not r.get("ok"):
                f.write(f"FAIL: {r.get('status','?')} — {(r.get('err') or '')[:200]}\n\n")
                continue
            f.write(f"- Total: ${r.get('total','null')}\n")
            f.write(f"- Time: {r.get('elapsed')}s\n")
            inner = r.get("raw", {}).get("data") or r.get("raw", {}).get("estimate") or {}
            if isinstance(inner, dict):
                interesting = ["companyName","contractor","mover","provider","material","systemType","brand","city","state","stateCode","pickupCity","pickupState","deliveryCity","deliveryState"]
                for k in interesting:
                    if inner.get(k) is not None:
                        f.write(f"- {k}: {inner[k]}\n")
                rf = inner.get("redFlags") or []
                if rf:
                    f.write(f"- redFlags: {len(rf)}\n")
                    for x in rf[:3]:
                        f.write(f"  - {x}\n")
                li = inner.get("lineItems") or []
                if li:
                    f.write(f"- lineItems: {len(li)}\n")
            f.write("\n")
    print(f"  wrote {out_md}")
    return {"vertical": vertical, "samples": len(samples), "ok": ok_count, "with_price": with_price, "delta": delta}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vertical", help="run only one vertical")
    ap.add_argument("--dry", action="store_true", help="dry run (no actual POSTs)")
    args = ap.parse_args()

    summary = []
    for vertical, endpoint in VERTICAL_ENDPOINTS.items():
        if args.vertical and vertical != args.vertical:
            continue
        try:
            r = test_vertical(vertical, endpoint, dry_run=args.dry)
            if r: summary.append(r)
        except Exception as e:
            print(f"  {vertical}: EXCEPTION {e}")

    print("\n\n=== OVERALL SUMMARY ===")
    for r in summary:
        print(f"  {r['vertical']:12s}: {r['ok']:>2}/{r['samples']:>2} parsed, "
              f"{r['with_price']:>2} with price, counter delta +{r.get('delta','?')}")

if __name__ == "__main__":
    main()

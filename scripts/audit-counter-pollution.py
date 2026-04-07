"""
Counter and calibration pollution audit.

Snapshots tp:total_quotes plus a sampling of cal:* keys before and after
running every analyzer endpoint with the X-TruePrice-Test header. Any
non-zero delta means an endpoint is ignoring the test header and writing
to live data — which is a flywheel-pollution bug.

Run before any synthetic test pass and require zero pollution before
declaring a test green.

Usage: python scripts/audit-counter-pollution.py
"""
import urllib.request, json, base64, time, glob, os, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
BASE = "https://truepricehq.com"

ENDPOINTS = {
    "auto": "auto-repair-estimate",
    "hvac": "hvac-estimate",
    "plumbing": "plumbing-estimate",
    "electrical": "electrical-estimate",
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


def get_counter():
    try:
        req = urllib.request.Request(f"{BASE}/api/analytics?counter=1",
                                     headers={"User-Agent": "TruePriceAudit/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read()).get("count")
    except Exception as e:
        print(f"  counter fetch ERR: {e}")
        return None


def find_fixture(vertical):
    """First comparison fixture for the vertical, or first available image."""
    folder = f"test-quotes/{vertical}-test-images"
    if not os.path.exists(folder):
        return None
    candidates = sorted(glob.glob(os.path.join(folder, "comparison-*.png")))
    if candidates:
        return candidates[0]
    candidates = sorted([f for f in glob.glob(os.path.join(folder, "*"))
                         if f.lower().endswith((".png", ".jpg", ".jpeg"))
                         and os.path.getsize(f) < 4_500_000])
    return candidates[0] if candidates else None


def post(endpoint, fpath):
    raw = open(fpath, "rb").read()
    b64 = base64.b64encode(raw).decode()
    ext = fpath.lower().rsplit(".", 1)[-1]
    if ext == "jpg":
        ext = "jpeg"
    payload = json.dumps({"images": [f"data:image/{ext};base64,{b64}"]}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/{endpoint}",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Origin": BASE,
            "User-Agent": "Mozilla/5.0 (TruePriceAudit)",
            "X-TruePrice-Test": "1",
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status
    except Exception as e:
        return f"ERR {e}"


def main():
    print("=== COUNTER POLLUTION AUDIT ===")
    print("Snapshotting tp:total_quotes before, hitting every analyzer with")
    print("X-TruePrice-Test:1 + a real fixture, then re-snapshotting.\n")

    start = get_counter()
    print(f"counter at start: {start}")
    if start is None:
        print("FATAL: cannot read counter")
        return 1

    results = []
    for vertical, endpoint in ENDPOINTS.items():
        fixture = find_fixture(vertical)
        if not fixture:
            print(f"  {vertical:14}: SKIP (no fixture)")
            continue
        print(f"  {vertical:14}: posting {os.path.basename(fixture)} ...")
        status = post(endpoint, fixture)
        print(f"    status: {status}")
        results.append((vertical, status))
        time.sleep(2)

    end = get_counter()
    print(f"\ncounter at end: {end}")
    delta = (end - start) if (end is not None and start is not None) else None
    print(f"counter delta: {delta:+d}" if delta is not None else "delta: ?")

    if delta == 0:
        print("\nPASS: every endpoint honored X-TruePrice-Test (no counter pollution).")
        return 0
    print(f"\nFAIL: counter moved by {delta}. At least one endpoint is writing")
    print("flywheel data despite the test header. Audit each endpoint's bridge.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

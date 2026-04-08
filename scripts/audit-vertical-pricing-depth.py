"""
audit-vertical-pricing-depth.py
Score each vertical's pricing JSON and analyzer API on the dimensions that
make a TruePrice vertical "best in class" per memory/project_best_in_class_definition.md.
Outputs a ranked table — lowest score = highest priority for the next deep-dive sprint.

Each dimension scored 0-10:
  - brandTiers (does the JSON list real brand-tier price ranges?)
  - redFlagDepth (count + structure: severity, evidence regex, explanation)
  - rebateCoverage (utility rebates with state coverage and active2026 flags)
  - licensingDepth (per-state license matrix)
  - codeAwareness (code/permit references)
  - apiRedFlagPatterns (red flag detection patterns in the analyzer JS)
  - cityContextIntegration (does API consume per-city context files?)
  - iraStatusAccuracy (correctly marks expired 25C / active 25D)
"""

import os, re, json, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

VERTICALS = [
    ("windows",  "data/windows-pricing.json",      "api/windows-estimate.js"),
    ("hvac",     "data/hvac-pricing-model.json",   "api/hvac-estimate.js"),
    ("plumbing", "data/plumbing-pricing.json",     "api/plumbing-estimate.js"),
    ("electrical","data/electrical-pricing.json",  "api/electrical-estimate.js"),
    ("solar",    "data/solar-pricing.json",        "api/solar-estimate.js"),
    ("roofing",  "data/pricing-model.json",        "api/roof-estimate.js"),
    ("siding",   "data/siding-pricing.json",       "api/siding-estimate.js"),
    ("insulation","data/insulation-pricing.json",  "api/insulation-estimate.js"),
    ("kitchen",  "data/kitchen-pricing.json",      "api/kitchen-estimate.js"),
    ("landscaping","data/landscaping-pricing.json","api/landscaping-estimate.js"),
    ("painting", "data/painting-pricing.json",     "api/painting-estimate.js"),
    ("concrete", "data/concrete-pricing.json",     "api/concrete-estimate.js"),
    ("foundation","data/foundation-pricing.json",  "api/foundation-estimate.js"),
    ("fencing",  "data/fencing-pricing.json",      "api/fencing-estimate.js"),
    ("garage-door","data/garage-door-pricing.json","api/garage-door-estimate.js"),
    ("gutters",  "data/gutters-pricing.json",      "api/gutters-estimate.js"),
]

def safe_load(p):
    try:
        with open(p, "r", encoding="utf-8") as f: return json.load(f), open(p,"r",encoding="utf-8").read()
    except Exception:
        return None, ""

def safe_text(p):
    try:
        with open(p, "r", encoding="utf-8") as f: return f.read()
    except Exception:
        return ""

def score_vertical(name, data_path, api_path):
    data, raw = safe_load(data_path)
    api_text = safe_text(api_path)
    if data is None:
        return {"name": name, "exists": False, "total": 0}

    s = {}

    # 1. Brand tiers
    flat = json.dumps(data).lower()
    bt_keys = ("brandtier","brand_tier","brand tiers","tier","value","mid","premium","luxury")
    bt_count = sum(flat.count(k) for k in bt_keys)
    s["brandTiers"] = min(10, bt_count // 8)

    # 2. Red flag depth (in pricing JSON)
    rf_keys_count = flat.count('"redflag') + flat.count('"red_flag')
    rf_severity = flat.count('severity')
    rf_evidence = flat.count('evidence') + flat.count('regex')
    s["redFlagDepth"] = min(10, (rf_keys_count // 2) + (1 if rf_severity > 2 else 0) + (1 if rf_evidence > 2 else 0))

    # 3. Rebate coverage
    rebate_count = flat.count('"utility"') + flat.count('"rebate"')
    active_2026 = flat.count('active2026')
    s["rebateCoverage"] = min(10, (rebate_count // 4) + (2 if active_2026 > 4 else 0))

    # 4. Licensing depth
    license_keys = flat.count('licens') + flat.count('"state":') + flat.count('statelicens')
    s["licensingDepth"] = min(10, license_keys // 6)

    # 5. Code awareness
    code_count = flat.count('code') + flat.count('permit') + flat.count('nec') + flat.count('ibc') + flat.count('upc')
    s["codeAwareness"] = min(10, code_count // 8)

    # 6. API red flag patterns
    api_lower = api_text.lower()
    api_rf = api_lower.count('redflag') + api_lower.count('red_flag') + api_lower.count('"red')
    s["apiRedFlagPatterns"] = min(10, api_rf // 4)

    # 7. City-context integration
    city_int = api_lower.count('city-context') + api_lower.count('citycontext') + api_lower.count('city-cost-multipliers')
    s["cityContextIntegration"] = min(10, city_int * 3)

    # 8. IRA accuracy
    has_25c = '25c' in flat or '25 c' in flat
    has_expired = 'expired' in flat or 'expir' in flat
    has_25d_correct = ('25d' in flat) and ('2032' in flat or '2034' in flat)
    if name == "solar":
        s["iraStatusAccuracy"] = 10 if has_25d_correct else (5 if '25d' in flat else 0)
    elif has_25c:
        s["iraStatusAccuracy"] = 10 if has_expired else 0
    else:
        s["iraStatusAccuracy"] = 7  # NA verticals get pass

    s["total"] = sum(s.values())
    s["name"] = name
    s["exists"] = True
    s["lines"] = len(raw.splitlines()) if raw else 0
    s["api_lines"] = len(api_text.splitlines()) if api_text else 0
    return s

results = [score_vertical(*v) for v in VERTICALS]
results.sort(key=lambda r: r.get("total", 0))

print("=" * 110)
print(f"{'VERTICAL':<14} {'TIER':>5} {'RF':>4} {'REB':>4} {'LIC':>4} {'COD':>4} {'APIRF':>6} {'CITY':>5} {'IRA':>4} {'TOT':>5}  {'data L':>7} {'api L':>6}")
print("=" * 110)
for r in results:
    if not r.get("exists"):
        print(f"{r['name']:<14}  MISSING")
        continue
    print(f"{r['name']:<14} {r['brandTiers']:>5} {r['redFlagDepth']:>4} {r['rebateCoverage']:>4} "
          f"{r['licensingDepth']:>4} {r['codeAwareness']:>4} {r['apiRedFlagPatterns']:>6} "
          f"{r['cityContextIntegration']:>5} {r['iraStatusAccuracy']:>4} {r['total']:>5}  "
          f"{r['lines']:>7} {r['api_lines']:>6}")
print("=" * 110)
print("\nLowest scores = highest priority for the next deep-dive sprint.\n")

# Per-vertical specific gaps
print("WORST GAP PER LOW VERTICAL:")
for r in results[:8]:
    if not r.get("exists"): continue
    gaps = sorted(((k,v) for k,v in r.items() if isinstance(v,int) and k not in ("total","lines","api_lines")), key=lambda x: x[1])[:3]
    print(f"  {r['name']:<14} -> " + ", ".join(f"{k}={v}" for k,v in gaps))

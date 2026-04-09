"""
Scrape Reddit for the 10 verticals that don't yet have real fixtures.
Writes to test-quotes/{vertical}-images/ (the new clean folder names).
Hard 60-minute time budget. Uses the same approach as scrape-reddit-fixtures.py.
"""

import urllib.request, json, os, sys, io, time, re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

UA = "TruePriceResearch/1.0 (contact: hello@truepricehq.com)"
TARGET = 10
START = time.time()
TIME_BUDGET = 60 * 60  # 60 minutes hard cap

VERTICALS = {
    "windows": {
        "subs": ["HomeImprovement", "Renovations", "Windows", "Andersen"],
        "queries": ["window quote", "window estimate", "windows quote", "replacement window quote", "andersen quote", "pella quote"]
    },
    "siding": {
        "subs": ["HomeImprovement", "Renovations", "Siding"],
        "queries": ["siding quote", "siding estimate", "hardie quote", "vinyl siding quote", "lp smartside"]
    },
    "painting": {
        "subs": ["HomeImprovement", "Painting", "houseDIY"],
        "queries": ["painting quote", "painter quote", "exterior paint quote", "interior paint quote"]
    },
    "fencing": {
        "subs": ["HomeImprovement", "Fencing", "homestead"],
        "queries": ["fence quote", "fence estimate", "wood fence quote", "vinyl fence quote", "chain link quote"]
    },
    "gutters": {
        "subs": ["HomeImprovement", "Roofing"],
        "queries": ["gutter quote", "gutter estimate", "leafguard quote", "leaffilter quote"]
    },
    "insulation": {
        "subs": ["HomeImprovement", "Insulation"],
        "queries": ["insulation quote", "spray foam quote", "attic insulation quote", "blow in insulation quote"]
    },
    "kitchen": {
        "subs": ["HomeImprovement", "Renovations", "KitchenRenovations"],
        "queries": ["kitchen remodel quote", "kitchen quote", "kitchen estimate", "cabinets quote"]
    },
    "landscaping": {
        "subs": ["landscaping", "HomeImprovement", "Hardscaping"],
        "queries": ["landscaping quote", "patio quote", "paver quote", "sod quote", "lawn quote"]
    },
    "garage-door": {
        "subs": ["HomeImprovement", "GarageDoors"],
        "queries": ["garage door quote", "garage door estimate", "clopay quote"]
    },
}

QUOTE_KEYWORDS = [
    "quote", "estimate", "bill", "invoice", "$", "dollar", "fair price",
    "ripped off", "ripoff", "is this fair", "is this normal", "thoughts on",
    "feedback on", "did i get", "got a quote", "received a quote",
    "received an estimate", "the price", "this price",
    "should i pay", "is this reasonable"
]
REJECT_KEYWORDS = [
    "look at this", "story time", "rant", "meme", "the time i", "tip:",
    "is it just me", "wholesome", "found this", "i made", "anybody else",
    "vent", "frustrating", "tutorial", "how do i",
    "first day", "first time", "what is this", "identify this",
    "what kind of", "is this safe", "to remove", "joke", "funny", "lol", "haha", "lmao"
]

def fetch_json(url, retries=2):
    for i in range(retries+1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except Exception as e:
            if i == retries:
                return None
            time.sleep(2)
    return None

def slugify(s, maxlen=50):
    s = re.sub(r"[^a-zA-Z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s.strip()).lower()
    return s[:maxlen].strip("-")

def is_quote_post(title):
    t = (title or "").lower()
    if any(k in t for k in REJECT_KEYWORDS): return False
    if any(k in t for k in QUOTE_KEYWORDS): return True
    return False

def search_vertical(vertical, config):
    print(f"\n=== {vertical} ===")
    seen = set()
    quote_candidates = []
    other_candidates = []
    for sub in config["subs"]:
        if time.time() - START > TIME_BUDGET:
            print(f"  TIME UP, stopping {vertical}")
            break
        for q in config["queries"]:
            if time.time() - START > TIME_BUDGET: break
            url = f"https://www.reddit.com/r/{sub}/search.json?q={q.replace(' ','+')}&restrict_sr=1&limit=100&sort=top&t=all"
            d = fetch_json(url)
            if not d: continue
            posts = d.get("data", {}).get("children", [])
            for p in posts:
                pd = p.get("data", {})
                pid = pd.get("id", "")
                if pid in seen: continue
                u = pd.get("url", "")
                if "i.redd.it" in u or u.endswith((".jpg", ".jpeg", ".png", ".webp")):
                    seen.add(pid)
                    cand = {
                        "id": pid,
                        "title": pd.get("title", "")[:80],
                        "url": u,
                        "permalink": "https://reddit.com" + pd.get("permalink", ""),
                        "score": pd.get("score", 0),
                        "sub": sub,
                        "query": q
                    }
                    if is_quote_post(cand["title"]):
                        quote_candidates.append(cand)
                    else:
                        other_candidates.append(cand)
            time.sleep(0.4)
    quote_candidates.sort(key=lambda x: -x["score"])
    print(f"  found {len(quote_candidates)} quote-keyword matches "
          f"({len(other_candidates)} non-matching also found)")
    result = quote_candidates[:TARGET]
    if len(result) < TARGET:
        other_candidates.sort(key=lambda x: -x["score"])
        result += other_candidates[:TARGET - len(result)]
    return result

def download_samples(vertical, samples):
    out_dir = os.path.join("test-quotes", f"{vertical}-images")
    os.makedirs(out_dir, exist_ok=True)
    results = []
    for i, s in enumerate(samples, 1):
        if time.time() - START > TIME_BUDGET:
            print("  TIME UP, stopping downloads")
            break
        ext = os.path.splitext(s["url"])[1].lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".webp"): ext = ".jpg"
        slug = slugify(s["title"])
        fname = f"real-{i:02d}-{slug}{ext}"
        fpath = os.path.join(out_dir, fname)
        if os.path.exists(fpath):
            results.append({**s, "file": fname, "status": "exists"})
            continue
        try:
            req = urllib.request.Request(s["url"], headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
            with open(fpath, "wb") as f:
                f.write(data)
            print(f"  saved: {fname} ({len(data)} bytes)")
            results.append({**s, "file": fname, "size": len(data), "status": "ok"})
        except Exception as e:
            print(f"  FAIL {fname}: {e}")
            results.append({**s, "file": fname, "status": "fail", "error": str(e)})
        time.sleep(0.3)
    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    return results

def main():
    summary = {}
    for v, cfg in VERTICALS.items():
        if time.time() - START > TIME_BUDGET:
            print(f"\nTIME UP, skipping {v} and remaining")
            break
        samples = search_vertical(v, cfg)
        if not samples:
            summary[v] = 0
            continue
        results = download_samples(v, samples)
        ok_count = sum(1 for r in results if r.get("status") in ("ok", "exists"))
        summary[v] = ok_count
    print(f"\n\n=== SUMMARY (elapsed {int(time.time()-START)}s) ===")
    for v, n in summary.items():
        print(f"  {v}: {n}/{TARGET}")

if __name__ == "__main__":
    main()

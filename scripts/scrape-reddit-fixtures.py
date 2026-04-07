"""
Scrape real public quote screenshots from Reddit across all TruePrice verticals.

For each vertical, search relevant subreddits + queries, download up to N
image-bearing posts, save to test-quotes/{vertical}-test-images/.

Reddit JSON API works fine with a proper User-Agent. See
reference_reddit_test_data.md in memory for the working approach.
"""

import urllib.request, json, os, sys, io, time, re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

UA = "TruePriceResearch/1.0 (contact: hello@truepricehq.com)"
TARGET_PER_VERTICAL = 10

VERTICALS = {
    "auto": {
        "subs": ["MechanicAdvice", "AskMechanics", "cartalk", "Justrolledintotheshop"],
        "queries": ["quote", "estimate", "shop wants", "is this fair", "mechanic quote", "repair estimate"]
    },
    "roofing": {
        "subs": ["Roofing", "HomeImprovement", "HomeMaintenance"],
        "queries": ["roof quote", "roof estimate", "roof bid", "roofing quote"]
    },
    "hvac": {
        "subs": ["hvacadvice", "HVAC", "HomeImprovement"],
        "queries": ["hvac quote", "ac quote", "furnace quote", "hvac estimate", "ac install quote"]
    },
    "plumbing": {
        "subs": ["Plumbing", "HomeImprovement", "askaplumber"],
        "queries": ["plumber quote", "plumbing estimate", "plumber bill"]
    },
    "electrical": {
        "subs": ["electricians", "askanelectrician", "HomeImprovement"],
        "queries": ["electrician quote", "electrical estimate", "panel upgrade quote"]
    },
    "solar": {
        "subs": ["solar", "SolarDIY"],
        "queries": ["solar quote", "solar estimate", "solar bid"]
    },
    "medical": {
        "subs": ["medicalbill", "HealthInsurance", "personalfinance"],
        "queries": ["hospital bill", "EOB", "medical bill", "surprise bill"]
    },
    "legal": {
        "subs": ["legaladvice", "Lawyertalk", "Ask_Lawyers"],
        "queries": ["attorney fee", "retainer agreement", "lawyer bill"]
    },
    "concrete": {
        "subs": ["Concrete", "HomeImprovement"],
        "queries": ["concrete quote", "driveway quote", "concrete estimate"]
    },
    "foundation": {
        "subs": ["HomeImprovement", "Renovations"],
        "queries": ["foundation repair quote", "foundation estimate"]
    },
}

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

def search_vertical(vertical, config):
    print(f"\n=== {vertical} ===")
    seen = set()
    candidates = []
    for sub in config["subs"]:
        for q in config["queries"]:
            url = f"https://www.reddit.com/r/{sub}/search.json?q={q.replace(' ','+')}&restrict_sr=1&limit=50&sort=top&t=all"
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
                    candidates.append({
                        "id": pid,
                        "title": pd.get("title", "")[:80],
                        "url": u,
                        "permalink": "https://reddit.com" + pd.get("permalink", ""),
                        "score": pd.get("score", 0),
                        "sub": sub,
                        "query": q
                    })
            time.sleep(0.5)  # be polite
    candidates.sort(key=lambda x: -x["score"])
    print(f"  found {len(candidates)} unique image posts")
    return candidates[:TARGET_PER_VERTICAL]

def download_samples(vertical, samples):
    out_dir = os.path.join("test-quotes", f"{vertical}-test-images")
    os.makedirs(out_dir, exist_ok=True)
    results = []
    for i, s in enumerate(samples, 1):
        ext = os.path.splitext(s["url"])[1].lower() or ".jpg"
        slug = slugify(s["title"])
        fname = f"{i:02d}-{slug}{ext}"
        fpath = os.path.join(out_dir, fname)
        if os.path.exists(fpath):
            print(f"  skip (exists): {fname}")
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

    # manifest
    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # README
    readme_path = os.path.join(out_dir, "README.md")
    if not os.path.exists(readme_path):
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(f"# {vertical.title()} Test Quotes\n\n")
            f.write(f"Real public quote/bill screenshots scraped from Reddit for "
                    f"end-to-end testing of the {vertical} analyzer.\n\n")
            f.write("These are run through the live `/api/" + vertical + "-estimate` "
                    "endpoint to verify OCR + parser accuracy and to feed the unified "
                    "calibration flywheel.\n\n")
            f.write("All quotes were posted publicly on Reddit by their authors. "
                    "PII visible in originals (customer names, phones, addresses) "
                    "is left as-is when the original poster published it that way; "
                    "where it was redacted in the original, it stays redacted. "
                    "If you (the original poster) want a sample removed, email "
                    "hello@truepricehq.com.\n\n")
            f.write("## Samples\n\n")
            for r in results:
                if r.get("status") == "ok":
                    f.write(f"- **{r['file']}** — {r['title']} ([source]({r['permalink']}))\n")
    return results

def main():
    summary = {}
    for vertical, config in VERTICALS.items():
        try:
            samples = search_vertical(vertical, config)
            results = download_samples(vertical, samples)
            ok = sum(1 for r in results if r.get("status") in ("ok", "exists"))
            summary[vertical] = ok
        except Exception as e:
            print(f"  ERR {vertical}: {e}")
            summary[vertical] = 0
    print("\n\n=== SUMMARY ===")
    for v, n in summary.items():
        print(f"  {v}: {n} samples")

if __name__ == "__main__":
    main()

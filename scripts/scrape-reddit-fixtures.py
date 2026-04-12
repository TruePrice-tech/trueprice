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
        "subs": ["HomeImprovement", "HomeMaintenance", "Renovations"],
        "queries": ["foundation repair quote", "foundation estimate", "foundation crack quote", "pier and beam quote", "underpinning quote", "foundation contractor"]
    },
    "landscaping": {
        "subs": ["landscaping", "lawncare", "HomeImprovement"],
        "queries": ["landscaping quote", "landscaping estimate", "patio quote", "hardscape quote", "retaining wall quote"]
    },
    "painting": {
        "subs": ["HomeImprovement", "paint", "Renovations"],
        "queries": ["painting quote", "painter quote", "painting estimate", "exterior paint quote", "interior paint quote"]
    },
    "moving": {
        "subs": ["moving", "MovingDay", "personalfinance"],
        "queries": ["moving quote", "mover quote", "moving estimate", "moving company quote", "is this a fair moving"]
    },
    "fencing": {
        "subs": ["HomeImprovement", "HomeMaintenance"],
        "queries": ["fence quote", "fence estimate", "fence bid", "fence contractor quote", "privacy fence quote", "chain link fence quote"]
    },
    "windows": {
        "subs": ["HomeImprovement", "HomeMaintenance", "Renovations"],
        "queries": ["window replacement quote", "window estimate", "renewal by andersen quote", "pella quote", "window contractor", "window install quote"]
    },
    "siding": {
        "subs": ["HomeImprovement", "HomeMaintenance", "Renovations"],
        "queries": ["siding quote", "siding estimate", "vinyl siding quote", "james hardie quote", "siding contractor quote", "siding replacement quote"]
    },
    "gutters": {
        "subs": ["HomeImprovement", "Roofing"],
        "queries": ["gutter quote", "gutter estimate", "gutter guard quote", "leaffilter quote"]
    },
    "insulation": {
        "subs": ["HomeImprovement", "Renovations", "energyefficiency"],
        "queries": ["insulation quote", "spray foam quote", "attic insulation estimate"]
    },
    "kitchen": {
        "subs": ["HomeImprovement", "Renovations", "kitchenremodel"],
        "queries": ["kitchen remodel quote", "kitchen estimate", "kitchen contractor quote", "kitchen renovation quote"]
    },
    "garage-door": {
        "subs": ["HomeImprovement", "garagedoors"],
        "queries": ["garage door quote", "garage door estimate", "garage door replacement quote"]
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

QUOTE_KEYWORDS = [
    "quote", "estimate", "bill", "invoice", "$", "dollar", "fair price",
    "ripped off", "ripoff", "is this fair", "is this normal", "thoughts on",
    "feedback on", "did i get", "got a quote", "received a quote",
    "received an estimate", "the price", "this price", "hourly rate",
    "labor cost", "should i pay", "is this reasonable", "binding"
]

REJECT_KEYWORDS = [
    "look at this", "story time", "rant", "meme", "the time i", "tip:",
    "is it just me", "wholesome", "found this", "i made", "anybody else",
    "vent", "frustrating", "tutorial", "how do i", "newbie",
    "first day", "first time", "what is this", "identify this",
    "what kind of", "is this safe", "to remove", "joke", "funny",
    "lol", "haha", "lmao", "before and after", "transformation",
    "just finished", "completed", "project complete", "diy",
    "my setup", "my new", "my old", "update:", "show off",
    "appreciation", "shout out", "hiring", "career", "job posting",
    "for sale", "selling", "wtb", "wts", "deals", "coupon",
    "pet", "cat", "dog", "selfie", "halloween", "christmas",
    "windows 10", "windows 11", "windows 7", "windows xp", "microsoft",
    "taskbar", "start menu", "blue screen", "bsod", "update",
    "foil", "epee", "sabre", "bout", "tournament", "fencing club",
    "weight class", "sparring", "coach", "training",
    "curb appeal", "paint color", "color palette", "choosing color",
    "what color", "hideous", "ugly house"
]

def has_price_in_title(title):
    """Check if the title contains a dollar amount -- strongest signal of a quote post."""
    import re
    return bool(re.search(r'\$[\d,]+|(?:\d+[kK]\b)', title or ""))

def is_quote_post(title):
    t = (title or "").lower()
    if any(k in t for k in REJECT_KEYWORDS):
        return False
    # Posts with dollar amounts in the title are almost always real quotes
    if has_price_in_title(title):
        return True
    if any(k in t for k in QUOTE_KEYWORDS):
        return True
    return False

def search_vertical(vertical, config):
    print(f"\n=== {vertical} ===")
    seen = set()
    quote_candidates = []
    other_candidates = []
    for sub in config["subs"]:
        for q in config["queries"]:
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
            time.sleep(0.5)  # be polite
    # Sort: prioritize posts with $ in title, then by Reddit score
    quote_candidates.sort(key=lambda x: (1 if has_price_in_title(x["title"]) else 0, x["score"]), reverse=True)
    print(f"  found {len(quote_candidates)} quote-keyword matches "
          f"({len(other_candidates)} non-matching also found)")
    # Prefer quote-keyword matches; fall back to top-scored other if too few
    result = quote_candidates[:TARGET_PER_VERTICAL]
    if len(result) < TARGET_PER_VERTICAL:
        # Also prioritize $ in title for fallback candidates
        other_candidates.sort(key=lambda x: (1 if has_price_in_title(x["title"]) else 0, x["score"]), reverse=True)
        result += other_candidates[:TARGET_PER_VERTICAL - len(result)]
    return result

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
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--vertical", help="re-scrape only this vertical")
    ap.add_argument("--clean", action="store_true", help="delete existing fixtures first")
    args = ap.parse_args()

    summary = {}
    targets = [args.vertical] if args.vertical else list(VERTICALS.keys())
    for vertical in targets:
        if vertical not in VERTICALS:
            print(f"Unknown vertical: {vertical}")
            continue
        if args.clean:
            folder = os.path.join("test-quotes", f"{vertical}-test-images")
            if os.path.exists(folder):
                for f in os.listdir(folder):
                    if f.lower().endswith((".jpg",".jpeg",".png",".webp")):
                        os.remove(os.path.join(folder, f))
                print(f"  cleaned {folder}")
        try:
            samples = search_vertical(vertical, VERTICALS[vertical])
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

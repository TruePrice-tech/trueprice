"""
SEO cleanup script for Woogoro.

Phases:
  1. Delete numeric-prefixed roof-cost duplicate pages (build script bug)
     where a proper-slugged alternative already exists.
  2. Add canonical <link> tags to material-variant pages pointing back to
     the parent city page so Google de-duplicates them.
  3. Inject a small "Other Woogoro tools" link block into city cost pages
     so the new flagship tools (auto-repair, find-contractors)
     get internal links from 1500+ city pages.
  4. Regenerate sitemap.xml with fresh per-file lastmod dates and only the
     canonical (non-duplicate, non-self-canonicalized-away) pages.

Run from repo root:
    python scripts/seo-cleanup.py
"""

import os, re, glob, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

STATE_ABBR = {
    "alabama":"al","alaska":"ak","arizona":"az","arkansas":"ar","california":"ca",
    "colorado":"co","connecticut":"ct","delaware":"de","florida":"fl","georgia":"ga",
    "hawaii":"hi","idaho":"id","illinois":"il","indiana":"in","iowa":"ia","kansas":"ks",
    "kentucky":"ky","louisiana":"la","maine":"me","maryland":"md","massachusetts":"ma",
    "michigan":"mi","minnesota":"mn","mississippi":"ms","missouri":"mo","montana":"mt",
    "nebraska":"ne","nevada":"nv","new hampshire":"nh","new jersey":"nj","new mexico":"nm",
    "new york":"ny","north carolina":"nc","north dakota":"nd","ohio":"oh","oklahoma":"ok",
    "oregon":"or","pennsylvania":"pa","rhode island":"ri","south carolina":"sc",
    "south dakota":"sd","tennessee":"tn","texas":"tx","utah":"ut","vermont":"vt",
    "virginia":"va","washington":"wa","west virginia":"wv","wisconsin":"wi","wyoming":"wy",
    "district of columbia":"dc",
}

MATERIAL_PREFIXES = ["architectural","asphalt","cedar","concrete","flat","metal","slate","tile"]

# ============================================================
# PHASE 1: Delete numeric-prefixed roof-cost duplicates
# ============================================================
def phase1_delete_numeric_duplicates():
    print("\n=== PHASE 1: Delete numeric roof-cost duplicates ===")
    files = sorted(glob.glob("[0-9]*-roof-cost.html"))
    if not files:
        print("  none found, skipping")
        return 0
    deleted = 0
    kept = []
    for f in files:
        with open(f, "r", encoding="utf-8", errors="replace") as fh:
            head = fh.read(2000)
        m = re.search(r"<title>Roof Replacement Cost in ([^<|]+?)\s*\(\d+\)", head)
        if not m:
            kept.append((f, "title parse fail"))
            continue
        location = re.sub(r"&#0?39;", "'", m.group(1)).strip()
        # Try last word as state
        parts = location.rsplit(" ", 1)
        st = None
        city = None
        if len(parts) == 2 and parts[1].lower() in STATE_ABBR:
            city, st = parts[0], STATE_ABBR[parts[1].lower()]
        else:
            parts2 = location.rsplit(" ", 2)
            if len(parts2) == 3:
                two = (parts2[1] + " " + parts2[2]).lower()
                if two in STATE_ABBR:
                    city, st = parts2[0], STATE_ABBR[two]
        if not st:
            kept.append((f, "state parse fail: " + location))
            continue
        # Try multiple slug variants
        slug_hyphen = re.sub(r"[^a-z0-9]+", "-", city.lower()).strip("-")
        slug_no_apostrophe = re.sub(r"[^a-z0-9 ]+", "", city.lower())
        slug_no_apostrophe = re.sub(r" +", "-", slug_no_apostrophe.strip())
        slug_no_space_compound = re.sub(r"[^a-z0-9]", "", city.lower())
        candidates = [
            f"{slug_hyphen}-{st}-roof-cost.html",
            f"{slug_no_apostrophe}-{st}-roof-cost.html",
            f"{slug_no_space_compound}-{st}-roof-cost.html",
        ]
        found_alt = None
        for cand in candidates:
            if os.path.exists(cand):
                found_alt = cand
                break
        if found_alt:
            os.remove(f)
            deleted += 1
        else:
            kept.append((f, f"no alt for: {city}, {st.upper()}"))
    print(f"  deleted {deleted} duplicates")
    if kept:
        print(f"  kept {len(kept)} (need manual review):")
        for k in kept[:15]:
            print("   ", k)
    return deleted

# ============================================================
# PHASE 2: Add canonical to material-variant pages
# ============================================================
def phase2_add_material_canonicals():
    print("\n=== PHASE 2: Add canonicals to material-variant pages ===")
    updated = 0
    skipped = 0
    for prefix in MATERIAL_PREFIXES:
        pattern = f"{prefix}-roof-cost-*.html"
        files = glob.glob(pattern)
        for f in files:
            base = os.path.basename(f)
            # Extract city-state from filename: prefix-roof-cost-{city}-{state}.html
            m = re.match(rf"^{prefix}-roof-cost-(.+?)-([a-z]{{2}})\.html$", base)
            if not m:
                continue
            city_slug = m.group(1)
            state = m.group(2)
            parent = f"{city_slug}-{state}-roof-cost.html"
            if not os.path.exists(parent):
                continue  # parent missing — leave as-is
            with open(f, "r", encoding="utf-8", errors="replace") as fh:
                content = fh.read()
            new_canon = f'<link rel="canonical" href="https://woogoro.com/{parent}" />'
            # Replace existing canonical (likely self-referential) with parent canonical
            new_content, n = re.subn(
                r'<link rel="canonical"[^>]*/?>',
                new_canon,
                content,
                count=1,
            )
            if n == 0:
                # Insert after charset meta if no canonical yet
                new_content = content.replace(
                    '<meta charset="UTF-8" />',
                    f'<meta charset="UTF-8" />\n  {new_canon}',
                    1,
                )
            if new_content != content:
                with open(f, "w", encoding="utf-8") as fh:
                    fh.write(new_content)
                updated += 1
            else:
                skipped += 1
    print(f"  updated {updated} material-variant pages with parent-canonical")
    print(f"  skipped {skipped}")
    return updated

# ============================================================
# PHASE 3: Inject "Other tools" link block into city cost pages
# ============================================================
TOOLS_BLOCK = '''<!-- TP-INTERNAL-TOOLS-BLOCK -->
<section class="tp-tools-block" style="margin:32px 0;padding:24px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;">
  <h3 style="margin:0 0 12px;font-size:18px;color:#1e293b;">More Woogoro tools for {CITY_TITLE}</h3>
  <p style="margin:0 0 16px;font-size:14px;color:#64748b;">Free pricing tools that work anywhere in {CITY_TITLE} and across the US.</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
    <a href="/auto-repair.html" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">Auto repair pricing &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">98 repairs, BLS-backed labor rates</div></a>
    <a href="/find-contractors.html" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">Find contractors &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">Vetted local pros</div></a>
    <a href="/analyze-my-quote.html" style="display:block;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-weight:600;font-size:14px;">Analyze a quote &rarr;<div style="font-weight:400;color:#64748b;font-size:12px;margin-top:2px;">Trudy checks every line item</div></a>
  </div>
</section>
<!-- /TP-INTERNAL-TOOLS-BLOCK -->'''

def phase3_inject_tools_block():
    print("\n=== PHASE 3: Inject internal-tools block into city cost pages ===")
    # Match {city}-{st}-{service}-cost.html (e.g. charlotte-nc-roof-cost.html)
    services = ["roof","hvac","plumbing","electrical","gutter","window","solar","siding",
                "fence","landscaping","painting","insulation","concrete","foundation",
                "garage-door","kitchen-remodel"]
    updated = 0
    skipped_already = 0
    for svc in services:
        for f in glob.glob(f"*-{svc}-cost.html"):
            base = os.path.basename(f)
            # Skip non-city pages (cost guides, etc.)
            if base.startswith("roof-replacement-cost") or base in {f"{svc}-cost-guide.html"}:
                continue
            # Skip material variants (those handled in phase 2)
            if any(base.startswith(p + "-") for p in MATERIAL_PREFIXES):
                continue
            with open(f, "r", encoding="utf-8", errors="replace") as fh:
                content = fh.read()
            if "TP-INTERNAL-TOOLS-BLOCK" in content:
                skipped_already += 1
                continue
            # Extract city title from <h1> or <title>
            m = re.search(r"<h1[^>]*>([^<]+)</h1>", content)
            if m:
                h1 = m.group(1)
                # "Roof Replacement Cost in Charlotte, NC" -> extract city
                cm = re.search(r"in\s+([A-Za-z\.\s]+?)(?:,\s*[A-Z]{2})?$", h1)
                city_title = cm.group(1).strip() if cm else "your area"
            else:
                city_title = "your area"
            block = TOOLS_BLOCK.replace("{CITY_TITLE}", city_title)
            # Insert before </main>
            if "</main>" in content:
                new_content = content.replace("</main>", f"{block}\n</main>", 1)
            else:
                # Fallback: insert before </body>
                new_content = content.replace("</body>", f"{block}\n</body>", 1)
            if new_content != content:
                with open(f, "w", encoding="utf-8") as fh:
                    fh.write(new_content)
                updated += 1
    print(f"  updated {updated} city pages with tools block")
    print(f"  skipped {skipped_already} already had block")
    return updated

# ============================================================
# PHASE 4: Regenerate sitemap.xml
# ============================================================
def phase4_regenerate_sitemap():
    print("\n=== PHASE 4: Regenerate sitemap.xml ===")
    all_html = sorted(glob.glob("*.html"))
    print(f"  found {len(all_html)} html files")

    # URLs already covered by per-vertical sitemaps (sitemap-roof.xml, etc.).
    # Exclude them from the flat sitemap.xml so sitemap-index.xml doesn't
    # announce every city page in two sitemaps — Google treats that as a
    # crawl-budget and freshness signal waste.
    vertical_urls = set()
    for vs in glob.glob("sitemap-*.xml"):
        if vs in ("sitemap-index.xml",):
            continue
        try:
            with open(vs, "r", encoding="utf-8", errors="replace") as fh:
                for m in re.finditer(r'<loc>\s*https?://[^/]+/([^<]+?)\s*</loc>', fh.read()):
                    vertical_urls.add(m.group(1))
        except Exception as e:
            print(f"  warn: could not read {vs}: {e}")
    print(f"  {len(vertical_urls)} URLs already in per-vertical sitemaps (will be excluded)")

    # Skip patterns: 404 page, dashboard pages (private), test files
    skip_exact = {"404.html","dashboard.html","provider-dashboard.html","contractor-dashboard.html",
                  "analytics-dashboard.html","admin.html","admin-dashboard.html"}
    # Skip files that have a canonical pointing elsewhere (deduped variants)
    urls = []
    skipped_canon = 0
    skipped_excluded = 0
    skipped_noindex = 0
    skipped_vertical = 0

    for f in all_html:
        if f in skip_exact:
            skipped_excluded += 1
            continue
        if f in vertical_urls:
            skipped_vertical += 1
            continue
        with open(f, "r", encoding="utf-8", errors="replace") as fh:
            head = fh.read(3000)
        # Skip noindex pages
        if re.search(r'<meta\s+name="robots"\s+content="[^"]*noindex', head, re.I):
            skipped_noindex += 1
            continue
        # Skip pages whose canonical points to a different file
        cm = re.search(r'<link\s+rel="canonical"\s+href="([^"]+)"', head)
        if cm:
            canon_url = cm.group(1)
            canon_file = canon_url.rsplit("/", 1)[-1]
            if canon_file and canon_file != f:
                skipped_canon += 1
                continue
        mtime = datetime.datetime.fromtimestamp(os.path.getmtime(f)).strftime("%Y-%m-%d")
        urls.append((f, mtime))

    print(f"  including {len(urls)} URLs in sitemap")
    print(f"  skipped {skipped_vertical} already in per-vertical sitemaps")
    print(f"  skipped {skipped_canon} canonicalized variants")
    print(f"  skipped {skipped_noindex} noindex")
    print(f"  skipped {skipped_excluded} excluded files")

    # Sitemap files have a 50,000 URL hard limit. Split into chunks.
    CHUNK = 25000
    if len(urls) <= CHUNK:
        with open("sitemap.xml","w",encoding="utf-8") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
            for u, lm in urls:
                f.write(f'  <url><loc>https://woogoro.com/{u}</loc><lastmod>{lm}</lastmod></url>\n')
            f.write('</urlset>\n')
        print("  wrote sitemap.xml")
    else:
        # Split (unlikely given current scale)
        chunks = [urls[i:i+CHUNK] for i in range(0, len(urls), CHUNK)]
        for i, chunk in enumerate(chunks, 1):
            with open(f"sitemap-{i}.xml","w",encoding="utf-8") as f:
                f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
                f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
                for u, lm in chunk:
                    f.write(f'  <url><loc>https://woogoro.com/{u}</loc><lastmod>{lm}</lastmod></url>\n')
                f.write('</urlset>\n')
        with open("sitemap.xml","w",encoding="utf-8") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
            for i in range(1, len(chunks)+1):
                f.write(f'  <sitemap><loc>https://woogoro.com/sitemap-{i}.xml</loc></sitemap>\n')
            f.write('</sitemapindex>\n')
        print(f"  wrote {len(chunks)} sitemap chunks + sitemap.xml index")
    return len(urls)

# ============================================================
def main():
    p1 = phase1_delete_numeric_duplicates()
    p2 = phase2_add_material_canonicals()
    p3 = phase3_inject_tools_block()
    p4 = phase4_regenerate_sitemap()
    print(f"\n=== DONE ===")
    print(f"  phase 1 deleted: {p1}")
    print(f"  phase 2 canonicaled: {p2}")
    print(f"  phase 3 tool-blocked: {p3}")
    print(f"  phase 4 sitemap urls: {p4}")

if __name__ == "__main__":
    main()

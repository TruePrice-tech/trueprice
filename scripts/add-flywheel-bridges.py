"""
Add the unified flywheel + counter bridge to every vertical analyzer endpoint
that doesn't already have one. Idempotent — only edits files where
captureAnonymizedData() is followed immediately by a return statement
without a tp:total_quotes increment between them.

The bridge:
1. Increments tp:total_quotes (the homepage hero counter)
2. Bumps cal:* aggregate buckets with weight 0.3

Field name mappings come from the captureAnonymizedData() implementation
in each file - we look for stateCode/state, plus a vertical-specific
sub-key (homeSize, repair, material, etc.) when available.
"""

import os, re, glob, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# Already have the bridge wired
SKIP = {"moving-estimate.js", "vehicle-estimate.js"}

# Vertical key -> service tag used in cal:* keys
VERTICAL_MAP = {
    "auto-repair": "auto",
    "concrete": "concrete",
    "electrical": "electrical",
    "fencing": "fencing",
    "foundation": "foundation",
    "garage-door": "garage-door",
    "gutters": "gutters",
    "hvac": "hvac",
    "insulation": "insulation",
    "kitchen": "kitchen",
    "landscaping": "landscaping",
    "legal-fee": "legal",
    "medical-bill": "medical",
    "painting": "painting",
    "plumbing": "plumbing",
    "siding": "siding",
    "solar": "solar",
    "windows": "windows",
}

BRIDGE_TEMPLATE = '''
    // FLYWHEEL BRIDGE: increment global counter + write to cal:* aggregates
    // so this vertical's quotes feed the same systems as moving and auto.
    try {{
      const totalPrice = Number(parsed && parsed.totalPrice) || 0;
      if (totalPrice > 0) {{
        await redis.incr("tp:total_quotes").catch(() => {{}});
        const cityLc = String((parsed && (parsed.city || parsed.cityName)) || "")
          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\\s+/g, "_");
        const st = String((parsed && (parsed.stateCode || parsed.state)) || "").toUpperCase();
        const service = "{service}";
        const weight = 0.3;
        if (st) {{
          const bump = async (k) => {{
            try {{
              const ex = await redis.get(k) || {{ quotes: 0, weightedSum: 0, totalWeight: 0, avgPrice: 0, lastUpdated: 0 }};
              const e = typeof ex === "string" ? JSON.parse(ex) : ex;
              e.quotes += 1;
              e.weightedSum += totalPrice * weight;
              e.totalWeight += weight;
              e.avgPrice = Math.round(e.weightedSum / e.totalWeight);
              e.lastUpdated = Date.now();
              await redis.set(k, JSON.stringify(e));
            }} catch (e) {{ /* aggregates are best-effort */ }}
          }};
          if (cityLc) await bump(`cal:${{cityLc}}:${{st}}:{service}`);
          await bump(`cal:metro:${{st}}:{service}`);
        }}
      }}
    }} catch (calErr) {{
      console.log("[{slug}-estimate] flywheel bridge error:", calErr.message);
    }}
'''

def patch(file_path):
    name = os.path.basename(file_path)
    if name in SKIP:
        return None
    # Determine vertical key from file name
    base = name.replace("-estimate.js", "")
    if base not in VERTICAL_MAP:
        return None
    service = VERTICAL_MAP[base]

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Already bridged?
    if "tp:total_quotes" in content:
        return None

    # Pattern: captureAnonymizedData("...", parsed); ... return res.status(200).json
    # We want to insert the bridge after captureAnonymizedData and before the return.
    pattern = re.compile(
        r'(    captureAnonymizedData\([^)]+\);(?:\s*//[^\n]*)?\s*\n)(\s*return res\.status\(200\)\.json)',
        re.MULTILINE
    )
    bridge = BRIDGE_TEMPLATE.format(service=service, slug=base)
    def replacer(m):
        return m.group(1) + bridge + m.group(2)
    new_content, n = pattern.subn(replacer, content, count=1)
    if n == 0:
        return f"NO_MATCH: {name}"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    return f"PATCHED: {name} -> service={service}"

def main():
    results = []
    for f in sorted(glob.glob("api/*-estimate.js")):
        r = patch(f)
        if r:
            results.append(r)
    for r in results:
        print(r)
    print(f"\n{len([r for r in results if r.startswith('PATCHED')])} patched, "
          f"{len([r for r in results if r.startswith('NO_MATCH')])} no-match")

if __name__ == "__main__":
    main()

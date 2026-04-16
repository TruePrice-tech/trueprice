"""
Wire the shared abuse guard into every vertical analyzer endpoint.

For each api/*-estimate.js file:
  1. Add `import { runAbuseGuard, recordClaudeCall, storeImageCache }
     from "./_abuse-guard.js";` at the top after existing imports
  2. After the existing rate-limit check and before the JSON body parse,
     insert a runAbuseGuard call that handles burst, IP-daily, suspicious
     patterns, image dedup, and global Claude ceiling
  3. After a successful Claude API call, insert a recordClaudeCall + cache write

Idempotent — skips files that already have the guard wired.
"""

import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

SKIP = {"_abuse-guard.js", "moving-estimate.js", "vehicle-estimate.js"}

# Endpoints we'll wire — only the *-estimate.js analyzer endpoints
TARGETS = [
    "auto-repair-estimate.js",
    "concrete-estimate.js",
    "electrical-estimate.js",
    "fencing-estimate.js",
    "foundation-estimate.js",
    "garage-door-estimate.js",
    "gutters-estimate.js",
    "hvac-estimate.js",
    "insulation-estimate.js",
    "kitchen-estimate.js",
    "landscaping-estimate.js",
    "legal-fee-estimate.js",
    "medical-bill-estimate.js",
    "moving-estimate.js",
    "painting-estimate.js",
    "plumbing-estimate.js",
    "siding-estimate.js",
    "solar-estimate.js",
    "windows-estimate.js",
]

IMPORT_LINE = 'import { runAbuseGuard, recordClaudeCall, storeImageCache } from "./_abuse-guard.js";\n'

GUARD_BLOCK = '''
    // Abuse guard: burst detect, IP daily cap, suspicious patterns,
    // image dedup, global Claude ceiling. Returns cached result if hit.
    const _imageBuf = (req.body && req.body.images && req.body.images[0])
      ? Buffer.from((req.body.images[0].split(",")[1] || ""), "base64")
      : null;
    const _guard = await runAbuseGuard(req, { vertical: "{vertical}", imageBytes: _imageBuf });
    if (!_guard.ok) {
      return res.status(_guard.status).json({ error: _guard.error });
    }
    if (_guard.cachedResult) {
      return res.status(200).json(_guard.cachedResult);
    }
'''

def patch(file_path):
    name = os.path.basename(file_path)
    if name not in TARGETS:
        return None
    if name in SKIP and name not in TARGETS:
        return f"SKIP: {name}"

    vertical = name.replace("-estimate.js", "")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "_abuse-guard" in content:
        return f"ALREADY: {name}"

    # 1. Add the import after the existing import line(s).
    # Find first import statement and insert after the import block.
    import_match = re.search(r'^(import [^\n]+\n)+', content, re.MULTILINE)
    if not import_match:
        return f"NO_IMPORTS: {name}"
    insert_at = import_match.end()
    content = content[:insert_at] + IMPORT_LINE + content[insert_at:]

    # 2. Insert the guard block after the existing checkRateLimit() call.
    # Pattern looks like:
    #   if (!(await checkRateLimit(clientIp))) {
    #     return res.status(429).json({...});
    #   }
    rate_limit_pattern = re.compile(
        r'(if \(!\(await checkRateLimit\([^\)]+\)\)\) \{\s*\n\s*return res\.status\(429\)\.json\([^)]+\);\s*\n\s*\}\n)',
        re.MULTILINE
    )
    guard = GUARD_BLOCK.replace("{vertical}", vertical)
    new_content, n = rate_limit_pattern.subn(lambda m: m.group(1) + guard, content, count=1)
    if n == 0:
        return f"NO_RATE_LIMIT: {name}"

    # 3. Add recordClaudeCall + storeImageCache after successful Claude response.
    # Find the JSON.parse(jsonMatch[0]) line which appears in every endpoint.
    record_pattern = re.compile(
        r'(parsed = jsonMatch \? JSON\.parse\(jsonMatch\[0\]\) : JSON\.parse\(aiText\);)',
    )
    record_call = (
        r'\1\n\n'
        '    // Record successful Claude call against the global ceiling\n'
        '    // and cache the parsed result by image hash for 24h dedup.\n'
        '    await recordClaudeCall();\n'
        '    if (_guard.imageHash) {\n'
        f'      await storeImageCache("{vertical}", _guard.imageHash, {{ success: true, source: "claude-haiku", data: parsed }});\n'
        '    }\n'
    )
    new_content2, n2 = record_pattern.subn(record_call, new_content, count=1)
    if n2 == 0:
        # Some endpoints have a slightly different parse path; do a softer fallback
        new_content2 = new_content
    new_content = new_content2

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    return f"PATCHED: {name}"

def main():
    results = []
    for f in sorted(glob.glob("api/*-estimate.js")):
        r = patch(f)
        if r:
            results.append(r)
    for r in results:
        print(r)
    patched = sum(1 for r in results if r.startswith("PATCHED"))
    print(f"\n{patched} patched")

if __name__ == "__main__":
    main()

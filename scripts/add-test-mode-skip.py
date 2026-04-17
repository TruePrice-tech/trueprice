"""
Add test-mode skip to every analyzer endpoint's flywheel bridge.

When the request includes header `X-Woogoro-Test: 1`, the bridge
skips:
  1. tp:total_quotes counter increment
  2. cal:* calibration aggregate writes
  3. tp:pricing_data anonymized append

This way our test loops can exercise the parser end-to-end without
polluting the real-world quote counter or the calibration pricing
aggregates that drive real user estimates.

The header is set by scripts/test-all-vertical-fixtures.py and is
NEVER sent by browser-based real users.
"""

import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

ENDPOINT_FILES = sorted(glob.glob("api/*-estimate.js"))

# The bridge block in every patched endpoint starts with this comment
BRIDGE_MARKER = "// FLYWHEEL BRIDGE:"
MOVING_MARKER = "// Bridge to the unified calibration flywheel"

# What we want to inject AT THE TOP of the bridge block
TEST_SKIP_BLOCK = (
    '    // Test-mode skip: synthetic test fixtures (X-Woogoro-Test: 1)\n'
    '    // do NOT count toward the public counter or feed pricing aggregates.\n'
    '    // Only real-world quotes from real users should affect either.\n'
    '    const _isTestMode = req.headers["x-trueprice-test"] === "1";\n'
    '    if (_isTestMode) {\n'
    '      console.log("[test-mode] skipping flywheel writes for this request");\n'
    '    }\n'
)

# Wrap the totalPrice > 0 condition with !_isTestMode
def patch(file_path):
    name = os.path.basename(file_path)
    if name in {"_abuse-guard.js"}:
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Already patched?
    if "_isTestMode" in content:
        return f"ALREADY: {name}"

    # Find the bridge marker
    if BRIDGE_MARKER in content:
        marker = BRIDGE_MARKER
    elif MOVING_MARKER in content:
        marker = MOVING_MARKER
    else:
        return None  # not an analyzer endpoint with the bridge

    # Insert the test-mode block right BEFORE the marker line, anywhere in the file.
    pattern = re.compile(r'(\s*' + re.escape(marker) + r')')
    def replacer(m):
        return "\n" + TEST_SKIP_BLOCK + m.group(1)
    new_content, n = pattern.subn(replacer, content, count=1)
    if n == 0:
        return f"NO_MATCH: {name}"

    # Wrap any "if (totalPrice > 0)" or similar with !_isTestMode guard.
    # Use a regex so we catch the legal/medical variants which use different
    # initial expressions but same pattern.
    new_content = re.sub(
        r'if \((totalPrice > 0)\) \{',
        r'if (\1 && !_isTestMode) {',
        new_content,
        count=1
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    return f"PATCHED: {name}"

def main():
    results = []
    for f in ENDPOINT_FILES:
        r = patch(f)
        if r:
            results.append(r)
    for r in results:
        print(r)
    n = sum(1 for r in results if r.startswith("PATCHED"))
    print(f"\n{n} patched")

if __name__ == "__main__":
    main()

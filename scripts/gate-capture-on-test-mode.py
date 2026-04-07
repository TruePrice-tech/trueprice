"""
Move the test-mode declaration ABOVE captureAnonymizedData() so the
legacy tp:pricing_data write also respects test mode.

Pattern in each endpoint after the previous patch:
    captureAnonymizedData("vertical", parsed); // fire and forget

    // Test-mode skip: ...
    const _isTestMode = req.headers["x-trueprice-test"] === "1";

We change it to:
    // Test-mode skip: ...
    const _isTestMode = req.headers["x-trueprice-test"] === "1";
    if (!_isTestMode) {
      captureAnonymizedData("vertical", parsed); // fire and forget
    }

    // (bridge follows)
"""

import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

for f in sorted(glob.glob("api/*-estimate.js")):
    name = os.path.basename(f)
    if name == "vehicle-estimate.js":
        continue  # has its own structure
    with open(f, "r", encoding="utf-8") as fh:
        content = fh.read()

    # Already gated?
    if "if (!_isTestMode) captureAnonymizedData" in content:
        print(f"ALREADY: {name}")
        continue
    # Replace captureAnonymizedData(... ) with if(!_isTestMode) wrapped version
    pattern = re.compile(r'(    )captureAnonymizedData\(("[^"]+")\, parsed\);([^\n]*\n)')
    new_content, n = pattern.subn(
        lambda m: f'{m.group(1)}if (req.headers["x-trueprice-test"] !== "1") captureAnonymizedData({m.group(2)}, parsed);{m.group(3)}',
        content,
        count=1
    )
    if n == 0:
        print(f"NO_MATCH: {name}")
        continue
    with open(f, "w", encoding="utf-8") as fh:
        fh.write(new_content)
    print(f"PATCHED: {name}")

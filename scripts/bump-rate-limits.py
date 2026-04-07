"""
Bump RATE_LIMIT_MAX from 10 to 60 across all analyzer endpoints.
10/hour was too restrictive for shared-IP scenarios (offices, CGNAT,
mobile carriers, libraries) where many real users share one IP.
"""

import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

OLD = "const RATE_LIMIT_MAX = 10;"
NEW = "const RATE_LIMIT_MAX = 60;"

count = 0
for f in glob.glob("api/*.js"):
    with open(f, "r", encoding="utf-8") as fh:
        content = fh.read()
    if OLD not in content:
        continue
    new_content = content.replace(OLD, NEW)
    with open(f, "w", encoding="utf-8") as fh:
        fh.write(new_content)
    print(f"  bumped: {os.path.basename(f)}")
    count += 1
print(f"\n{count} files updated")

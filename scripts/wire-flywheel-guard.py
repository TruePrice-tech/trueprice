"""
Wire guardedFlywheelBump into all estimate API files.
Replaces inline bump() functions with shared guarded version.
"""
import os, re, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

files = sorted(glob.glob("api/*-estimate.js")) + [
    "api/parse-quote.js",
    "api/capture-quote.js",
    "api/community-quote.js",
]

IMPORT_LINE = 'import { guardedFlywheelBump } from "./_flywheel-guard.js";'

count = 0
skipped = []

for f in files:
    if not os.path.exists(f):
        continue
    with open(f, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()

    if "FLYWHEEL BRIDGE" not in content:
        skipped.append(f"{f}: no FLYWHEEL BRIDGE")
        continue

    if "guardedFlywheelBump" in content:
        skipped.append(f"{f}: already wired")
        continue

    # Detect service name
    svc_match = re.search(r'const service = "(\w[\w-]*)";', content)
    if not svc_match:
        svc_match = re.search(r"await bump\(`cal:.*?:.*?:([\w-]+)`\)", content)
    if not svc_match:
        skipped.append(f"{f}: could not detect service name")
        continue
    service = svc_match.group(1)

    # Add import
    if IMPORT_LINE not in content:
        import_matches = list(re.finditer(r"^import .+$", content, re.MULTILINE))
        if import_matches:
            pos = import_matches[-1].end()
            content = content[:pos] + "\n" + IMPORT_LINE + content[pos:]
        else:
            skipped.append(f"{f}: no import statements")
            continue

    # Build replacement block
    new_block = (
        '// FLYWHEEL BRIDGE: guarded write to cal:* aggregates\n'
        '    try {\n'
        '      const totalPrice = Number(parsed && parsed.totalPrice) || 0;\n'
        '      if (totalPrice > 0 && !_isTestMode) {\n'
        '        const cityLc = String(_calCity)\n'
        '          .toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\\\\s+/g, "_");\n'
        '        const st = String(_calState).toUpperCase();\n'
        '        await guardedFlywheelBump(redis, "' + service + '", totalPrice, cityLc, st);\n'
        '      }\n'
        '    } catch (calErr) {\n'
        '      console.log("[' + service + '-estimate] flywheel bridge error:", calErr.message);\n'
        '    }'
    )

    # Find and replace the flywheel bridge block
    # Match from "// FLYWHEEL BRIDGE" through the catch block
    pattern = re.compile(
        r"// FLYWHEEL BRIDGE.*?"
        r"try \{.*?"
        r"const totalPrice = Number\(parsed && parsed\.totalPrice\) \|\| 0;.*?"
        r"if \(totalPrice > 0 && !_isTestMode\) \{.*?"
        r"const cityLc.*?"
        r"const st.*?"
        r'const service = "[\w-]+";.*?'
        r"const weight = [\d.]+;.*?"
        r"if \(st\) \{.*?"
        r"const bump = async \(k\) => \{.*?"
        r"await redis\.set\(k.*?\}.*?"
        r"\};.*?"
        r"if \(cityLc\) await bump.*?\n.*?"
        r"await bump\(`cal:metro:.*?"
        r"\}.*?\}.*?"
        r"\} catch \(calErr\).*?\{.*?\}",
        re.DOTALL,
    )

    new_content, n = pattern.subn(new_block, content, count=1)

    if n == 0:
        # Try a simpler pattern
        simple = re.compile(
            r"// FLYWHEEL BRIDGE[^\n]*\n"
            r"([ \t]*)try \{[\s\S]*?"
            r"await bump\(`cal:metro:[^`]+`\);[\s\S]*?"
            r"\} catch \(calErr\)[^\}]*\{[^\}]*\}",
            re.DOTALL,
        )
        new_content, n = simple.subn(new_block, content, count=1)

    if n == 0:
        skipped.append(f"{f}: regex did not match (service={service})")
        continue

    with open(f, "w", encoding="utf-8") as fh:
        fh.write(new_content)
    count += 1
    print(f"OK  {f}: wired for '{service}'")

print(f"\nUpdated: {count} files")
if skipped:
    print(f"Skipped: {len(skipped)}")
    for s in skipped:
        print(f"  {s}")

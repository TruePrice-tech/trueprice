#!/usr/bin/env bash
# precommit-phase-a.sh
#
# Gate-enforcement script for Phase A commits. Run BEFORE every Phase A
# commit. Exit 0 = safe to commit. Exit non-zero = DO NOT COMMIT, halt
# and write a halt-log entry per docs/phase-a-next-session.md.
#
# Usage:
#   bash scripts/precommit-phase-a.sh <vertical>
#
# Example:
#   bash scripts/precommit-phase-a.sh foundation
#
# What it checks:
#   1. The vertical's city + flagship Google uniqueness ≥ 80%
#   2. (If vertical-cities pages exist) pairwise similarity audit passes
#   3. Git status shows ONLY intended files modified (no surprise edits)
#   4. Any modified HTML files have valid JSON-LD blocks

set -e
set -o pipefail

VERTICAL="${1:-}"
if [ -z "$VERTICAL" ]; then
  echo "ERROR: vertical name required"
  echo "Usage: bash scripts/precommit-phase-a.sh <vertical>"
  exit 2
fi

echo "============================================================"
echo "Phase A pre-commit gates — vertical: $VERTICAL"
echo "============================================================"

# Gate 1: City + flagship uniqueness ≥80%
echo ""
echo "Gate 1/4: Google uniqueness audit (≥80% NF + FS required)"
echo "------------------------------------------------------------"
UNIQ_OUTPUT=$(node scripts/audit-uniqueness-google.js "$VERTICAL" 2>&1)
echo "$UNIQ_OUTPUT" | tail -20

# Parse out NF + FS composite scores. Audit prints lines like:
#   foundation       |    700 |   1482 |      81% |      86% |    100% |    78% |       86% | GOOD
# Columns: name | pages | words | template | semantic | infoden | struct | composite | grade
# We want column 8 (composite), strip whitespace and the % sign.
NF_SCORE=$(echo "$UNIQ_OUTPUT" | grep -E "^${VERTICAL}( |[a-z\-]+)" | head -1 | awk -F'|' '{ gsub(/[ %]/, "", $8); print $8 }')
FS_SCORE=$(echo "$UNIQ_OUTPUT" | grep -E "^${VERTICAL}( |[a-z\-]+)" | tail -1 | awk -F'|' '{ gsub(/[ %]/, "", $8); print $8 }')

if [ -z "$NF_SCORE" ] || [ -z "$FS_SCORE" ]; then
  echo ""
  echo "❌ FAIL: could not parse uniqueness scores. Manual audit required."
  exit 1
fi

# Verify parsed values are numeric (catches column-shift bugs).
if ! [[ "$NF_SCORE" =~ ^[0-9]+$ ]] || ! [[ "$FS_SCORE" =~ ^[0-9]+$ ]]; then
  echo ""
  echo "❌ FAIL: parsed non-numeric uniqueness score (NF='$NF_SCORE' FS='$FS_SCORE'). Halt — script needs fixing."
  exit 1
fi

echo ""
echo "Parsed: NF=${NF_SCORE}% FS=${FS_SCORE}%"

if [ "$NF_SCORE" -lt 80 ] || [ "$FS_SCORE" -lt 80 ]; then
  echo "❌ FAIL: uniqueness below 80% hard floor. Halt commit."
  exit 1
fi
echo "✅ PASS: NF + FS both ≥80%"

# Gate 2: Hub-section similarity audit (only relevant if hub city-link sections exist)
echo ""
echo "Gate 2/4: Hub-section similarity audit (if applicable)"
echo "------------------------------------------------------------"
if node scripts/audit-hub-section-uniqueness.js > /tmp/hub-sim-output 2>&1; then
  tail -5 /tmp/hub-sim-output
  echo "✅ PASS"
else
  cat /tmp/hub-sim-output
  echo "❌ FAIL: hub-section similarity exceeds threshold. Halt commit."
  exit 1
fi

# Gate 3: Git status shows only intended files modified
echo ""
echo "Gate 3/4: Git status sanity check"
echo "------------------------------------------------------------"
MODIFIED_NON_HTML=$(git status -s | grep -v "^??" | grep -v "\.html$" | grep -v "\.md$" | grep -v "scripts/city-page-contamination\.txt" | wc -l)
if [ "$MODIFIED_NON_HTML" -gt 0 ]; then
  echo "⚠️  WARNING: non-HTML/non-MD files modified:"
  git status -s | grep -v "^??" | grep -v "\.html$" | grep -v "\.md$" | grep -v "scripts/city-page-contamination\.txt"
  echo ""
  echo "This may be intentional but verify before committing."
fi
echo "✅ PASS (or warning logged above)"

# Gate 4: JSON-LD validation on modified HTML files
echo ""
echo "Gate 4/4: JSON-LD validation on modified HTML files"
echo "------------------------------------------------------------"
MODIFIED_HTML=$(git status -s | grep -E "^\s?M " | grep "\.html$" | awk '{print $NF}')
if [ -z "$MODIFIED_HTML" ]; then
  echo "(no modified HTML files to validate)"
else
  for f in $MODIFIED_HTML; do
    echo "  Validating $f..."
    if ! node -e "
      const fs=require('fs'),html=fs.readFileSync('$f','utf8'),re=/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/g;
      let m,n=0,bad=[];
      while((m=re.exec(html))){n++;try{JSON.parse(m[1])}catch(e){bad.push('block '+n+': '+e.message)}}
      if(bad.length){console.error('FAIL: '+bad.join('; '));process.exit(1)}
      console.log('  ✅ '+n+' JSON-LD blocks parse');
    "; then
      echo "❌ FAIL: $f has invalid JSON-LD. Halt commit."
      exit 1
    fi
  done
fi

echo ""
echo "============================================================"
echo "✅ ALL GATES PASSED — safe to commit"
echo "============================================================"
exit 0

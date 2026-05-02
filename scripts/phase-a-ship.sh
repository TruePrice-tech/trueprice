#!/usr/bin/env bash
# phase-a-ship.sh — Generate, gate, and commit one Phase A.1 vertical-cities page.
#
# Usage:
#   bash scripts/phase-a-ship.sh <config-name>
#
# Example:
#   bash scripts/phase-a-ship.sh hvac
#
# Reads scripts/phase-a-configs/<config-name>.json, generates the page,
# runs precommit-phase-a.sh, and commits if gates pass. Halts on any
# gate failure.

set -e

CFG_NAME="${1:-}"
if [ -z "$CFG_NAME" ]; then
  echo "Usage: bash scripts/phase-a-ship.sh <config-name>"
  exit 2
fi

CFG_FILE="scripts/phase-a-configs/${CFG_NAME}.json"
if [ ! -f "$CFG_FILE" ]; then
  echo "ERROR: config not found: $CFG_FILE"
  exit 2
fi

OUTPUT_FILE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CFG_FILE','utf8')).outputFile)")
GATE_VERTICAL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CFG_FILE','utf8')).gateVertical || JSON.parse(require('fs').readFileSync('$CFG_FILE','utf8')).vertical)")

echo "=================================================================="
echo "Phase A.1 ship: $CFG_NAME"
echo "  Output:        $OUTPUT_FILE"
echo "  Gate vertical: $GATE_VERTICAL"
echo "=================================================================="

# Generate
echo ""
echo "[1/3] Generating page..."
node scripts/build-vertical-cities.js "$CFG_FILE"

# Gate
echo ""
echo "[2/3] Running pre-commit gates..."
if ! bash scripts/precommit-phase-a.sh "$GATE_VERTICAL"; then
  echo ""
  echo "❌ HALT: gate failed for $CFG_NAME. Do not commit."
  exit 1
fi

# Commit
echo ""
echo "[3/3] Committing..."
git add "$OUTPUT_FILE" "$CFG_FILE"

COMMIT_MSG="phase-a.1: ship ${OUTPUT_FILE}

Phase A.1 directory page for ${CFG_NAME}. State-grouped index of every
city page in this vertical, hand-written cost-driver intro, indexable
per locked decision #2.

Pre-commit gates passed: NF + FS uniqueness ≥ 80%, hub-section
similarity below threshold, JSON-LD valid.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git commit -m "$COMMIT_MSG"

echo ""
echo "✅ DONE: $CFG_NAME shipped."
git rev-parse HEAD

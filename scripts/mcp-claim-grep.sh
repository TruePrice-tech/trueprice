#!/usr/bin/env bash
# Surface every regulatory/legal/quantitative claim in an MCP directory
# so a human (or fact-check agent) can verify each one before ship.
#
# Usage: bash scripts/mcp-claim-grep.sh mcp-roofing
# Run from repo root.

set -e

DIR="${1:-}"
if [ -z "$DIR" ]; then
  echo "Usage: bash scripts/mcp-claim-grep.sh <mcp-directory>"
  echo "Example: bash scripts/mcp-claim-grep.sh mcp-roofing"
  exit 1
fi

if [ ! -d "$DIR" ]; then
  echo "Error: directory '$DIR' does not exist"
  exit 1
fi

echo "=========================================="
echo "MCP Claim Audit: $DIR"
echo "=========================================="

# Patterns that almost always need fact-checking.
# Looking only inside .ts source files (skip dist, node_modules, data JSON).
SRC_GLOB="$DIR/src"

if [ ! -d "$SRC_GLOB" ]; then
  echo "Error: $SRC_GLOB does not exist"
  exit 1
fi

echo ""
echo "=== Statutory/regulatory citations ==="
grep -rn -E "[0-9]+ ?USC|[0-9]+ ?CFR|EPA|FCC|CMS|FTC|NHTSA|FMCSA|ACCA|ACA|NEC|IRC|IPC|DOE|FDA|HIPAA|Magnuson|Moss|AIM Act|No Surprises|NCCI|HUD|OSHA|ABA Model|state bar|lemon law|ENERGY STAR|NFRC|IRA tax credit|SREC" "$SRC_GLOB" 2>/dev/null | grep -v "// " | head -100 || true

echo ""
echo "=== Dates / years (post-2020) ==="
grep -rn -E "20(2[0-9]|3[0-9])" "$SRC_GLOB" 2>/dev/null | grep -vE "Copyright|@types|version|\"id\"|baseYear|datePublished|dateModified" | head -40 || true

echo ""
echo "=== Quantitative thresholds ==="
grep -rn -E "(minimum|maximum|at least|no more than|under |over |required|federal|illegal|prohibited) [^.]*[0-9]" "$SRC_GLOB" 2>/dev/null | head -40 || true

echo ""
echo "=== Industry-standard duration claims ==="
grep -rn -E "[0-9]+(-[0-9]+)? ?(year|yr|month|day|hour) (warranty|labor|parts|guarantee)" "$SRC_GLOB" 2>/dev/null | head -30 || true

echo ""
echo "=== Multipliers / rate claims ==="
grep -rn -E "[0-9]+(\.[0-9]+)? ?(times|x )?(Medicare|commercial|standard rate|chargemaster|markup)" "$SRC_GLOB" 2>/dev/null | head -20 || true

echo ""
echo "=== Brand/product warranty assertions ==="
grep -rn -E "GAF|Owens Corning|CertainTeed|Malarkey|IKO|Carrier|Trane|Lennox|Goodman|Rheem|Mitsubishi|Daikin" "$SRC_GLOB" 2>/dev/null | head -30 || true

echo ""
echo "=========================================="
echo "Done. Fact-check each surfaced claim before deploy."
echo "=========================================="

#!/bin/bash
set -e
export CAL_ADMIN_KEY=tp_admin_2026
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"

LOG="scripts/seeder-log.txt"
echo "=== SEEDER RUN STARTED $(date) ===" > "$LOG"

echo "" >> "$LOG"
echo "=== PHASE 1: Cross-seed from pricing models ===" >> "$LOG"
echo "Started: $(date)" >> "$LOG"
node scripts/cross-seed-calibration.js 2>&1 >> "$LOG"
echo "Finished: $(date)" >> "$LOG"

echo "" >> "$LOG"
echo "=== PHASE 2: External sources (HomeAdvisor, Thumbtack, RepairPal, FairHealth) ===" >> "$LOG"
echo "Started: $(date)" >> "$LOG"
node scripts/external-seed.js 2>&1 >> "$LOG"
echo "Finished: $(date)" >> "$LOG"

echo "" >> "$LOG"
echo "=== PHASE 3: Reddit seeder (all verticals) ===" >> "$LOG"
echo "Started: $(date)" >> "$LOG"
node scripts/reddit-seed.js --max-posts=500 2>&1 >> "$LOG"
echo "Finished: $(date)" >> "$LOG"

echo "" >> "$LOG"
echo "=== ALL SEEDERS COMPLETE $(date) ===" >> "$LOG"

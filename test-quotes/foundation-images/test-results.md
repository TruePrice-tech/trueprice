# Foundation Test Results

Run: 2026-04-08 12:23:40
Endpoint: https://woogoro.com/api/foundation-estimate
Samples tested: 6

**Counter at start:** 3895
**Counter at end:** 3895
**Counter delta:** +0 (expected +6)

**Parse success:** 6/6
**Detected price:** 6/6

## comparison-pier-high.png

- Total: $12800
- Time: 0.3s
- city: Houston
- stateCode: TX
- redFlags: 4
  - Labor and material costs are not itemized separately, making it difficult to verify pricing reasonableness or identify where value lies
  - No project timeline provided; homeowners cannot plan for disruption or access issues
  - Tax shown as '$O' (zero) which may indicate a data entry error or unclear tax treatment
- lineItems: 5

## comparison-pier-low.png

- Total: $6900
- Time: 0.3s
- city: Houston
- stateCode: TX
- redFlags: 7
  - No structural engineer report included or referenced—this is critical for foundation work and should be obtained independently before proceeding
  - Repair is recommended without documented engineer assessment; quote appears to be based on company inspection only
  - Root cause analysis not addressed—no mention of drainage, grading, soil conditions, or gutters that likely contributed to settlement
- lineItems: 3

## comparison-pier-mid.png

- Total: $8750
- Time: 0.2s
- city: Houston
- stateCode: TX
- redFlags: 4
  - Labor costs not itemized separately from material costs; total labor component unclear
  - No project timeline or start/completion dates provided
  - Engineer's report fee ($700) is a line item rather than complimentary—may indicate minimal assessment depth
- lineItems: 4

## messy-comparison-pier-high.jpg

- Total: $12800
- Time: 0.2s
- city: Houston
- stateCode: TX
- redFlags: 5
  - Labor and material costs are not itemized separately, making it difficult to assess pricing fairness and identify cost drivers
  - No project timeline or schedule provided for completion
  - Payment structure (25%-50%-25%) lacks clarity on what constitutes 'dry-in' phase
- lineItems: 5

## messy-comparison-pier-low.jpg

- Total: $6900
- Time: 0.2s
- city: Houston
- stateCode: TX
- redFlags: 7
  - No structural engineer report included or completed prior to quoting repairs—critical gap in diagnosis
  - Root cause of foundation movement not addressed (no mention of drainage, grading, or gutter systems)
  - No permits mentioned; structural pier work typically requires permits in Texas jurisdictions
- lineItems: 3

## messy-comparison-pier-mid.jpg

- Total: $8750
- Time: 0.3s
- city: Houston
- stateCode: TX
- redFlags: 5
  - Labor and material costs are not itemized separately—total pier cost ($7,200) lacks transparency on labor vs. materials breakdown
  - No project timeline or completion date specified
  - Drainage assessment mentioned but specific recommendations and associated costs for gutter/grade fixes are not detailed in quote—potential scope creep
- lineItems: 4


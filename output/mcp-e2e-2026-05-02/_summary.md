# Woogoro MCP end-to-end test — 2026-05-02T19:11:55.188Z

## medical — https://mcp.woogoro.com/mcp
- healthz: 200 (187ms)
- tools/list: 200 (51ms) — : 5 tools: [parse_bill, check_errors, lookup_average_price, draft_dispute, negotiation_script]
- parse_bill: 200 (85ms) — : tool returned success:true, keys: [success, parsed, summary_for_llm]
- lookup_average_price: 200 (148ms) — : tool returned success:true, keys: [success, found, cpt_code, description, category, notes, base_medicare_rate, adjusted_medicare_rate]

## roofing — https://roofing-mcp.woogoro.com/mcp
- healthz: 200 (198ms)
- tools/list: 200 (46ms) — : 5 tools: [parse_quote, check_errors, lookup_average_price, draft_dispute, negotiation_script]
- parse_quote: 200 (148ms) — : tool returned success:true, keys: [success, parsed, findings, findings_summary, summary_for_llm]
- lookup_average_price: 200 (39ms) — : tool returned success:?, keys: [found, material, materialLabel, materialTag, brands, stateCode, pitch, complexity]

## hvac — https://hvac-mcp.woogoro.com/mcp
- healthz: 200 (186ms)
- tools/list: 200 (35ms) — : 5 tools: [parse_quote, check_errors, lookup_average_price, draft_dispute, negotiation_script]
- parse_quote: 200 (143ms) — : tool returned success:true, keys: [success, parsed, priceBaselineFinding, summary_for_llm]
- lookup_average_price: 200 (205ms) — : tool returned success:?, keys: [found, systemType, systemLabel, efficiencyTier, stateCode, stateMultiplier, baselineTotal, adjustedTotal]

## auto-repair — https://auto-repair-mcp.woogoro.com/mcp
- healthz: 200 (179ms)
- tools/list: 200 (35ms) — : 5 tools: [parse_quote, check_errors, lookup_average_price, draft_dispute, negotiation_script]
- parse_quote: 200 (81ms) — : tool returned success:true, keys: [success, parsed, priceBaselineFinding, summary_for_llm]
- lookup_average_price: 200 (154ms) — : tool returned success:?, keys: [found, shopType, shopTypeLabel, stateCode, stateMultiplier, nationalMedianLaborRate, laborRatePerHour, methodology]

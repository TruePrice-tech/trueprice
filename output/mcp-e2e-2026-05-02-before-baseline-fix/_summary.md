# Woogoro MCP end-to-end test — 2026-05-02T18:49:39.689Z

## medical — https://mcp.woogoro.com/mcp
- healthz: 200 (310ms)
- tools/list: 200 (47ms) — : 5 tools: [parse_bill, check_errors, lookup_average_price, draft_dispute, negotiation_script]
- parse_bill: 200 (149ms) — : tool returned success:true, keys: [success, parsed, summary_for_llm]
- lookup_average_price: 200 (208ms) — : tool returned success:true, keys: [success, found, cpt_code, description, category, notes, base_medicare_rate, adjusted_medicare_rate]

## roofing — https://roofing-mcp.woogoro.com/mcp
- healthz: 200 (141ms)
- tools/list: 200 (48ms) — : 5 tools: [parse_quote, check_errors, lookup_average_price, draft_dispute, negotiation_script]
- parse_quote: 200 (158ms) — : tool returned success:true, keys: [success, parsed, findings, findings_summary, summary_for_llm]
- lookup_average_price: 200 (35ms) — : tool returned success:?, keys: [found, material, materialLabel, materialTag, brands, stateCode, pitch, complexity]

## hvac — https://hvac-mcp.woogoro.com/mcp
- healthz: 200 (140ms)
- tools/list: 200 (37ms) — : 5 tools: [parse_quote, check_errors, lookup_average_price, draft_dispute, negotiation_script]
- parse_quote: 200 (73ms) — : tool returned success:true, keys: [success, parsed, summary_for_llm]
- lookup_average_price: 200 (151ms) — : tool returned success:?, keys: [found, systemType, systemLabel, efficiencyTier, stateCode, stateMultiplier, baselineTotal, adjustedTotal]

## auto-repair — https://auto-repair-mcp.woogoro.com/mcp
- healthz: 200 (72ms)
- tools/list: 200 (28ms) — : 5 tools: [parse_quote, check_errors, lookup_average_price, draft_dispute, negotiation_script]
- parse_quote: 200 (187ms) — : tool returned success:true, keys: [success, parsed, summary_for_llm]
- lookup_average_price: 200 (77ms) — : tool returned success:?, keys: [found, shopType, shopTypeLabel, stateCode, stateMultiplier, nationalMedianLaborRate, laborRatePerHour, methodology]

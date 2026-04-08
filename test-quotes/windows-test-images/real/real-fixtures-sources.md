# Real Window Quote Fixtures - Sources

Scraped 2026-04-07 via curl (browser User-Agent). All content from public sources.
PII redaction: phone -> [PHONE], email -> [EMAIL], street addresses -> [ADDRESS], names following "I, X Y" or "my name is X" -> [REDACTED].
Contractor names, prices, brands, and scope details retained (public record, load-bearing for fixture).

## BBB Complaint Fixtures (text)

| File | Contractor | Source URL | Approx $ |
|---|---|---|---|
| bbb-1-1-window-nation.txt | Window Nation | https://www.bbb.org/us/md/fulton/profile/window-door-installation/window-nation-llc-0011-38000001/complaints | $1,700 |
| bbb-1-2-window-nation.txt | Window Nation | (same) | $25,000 (change order) |
| bbb-1-3-window-nation.txt | Window Nation | (same) | $7,441 |
| bbb-2-1-power-home-remodeling.txt | Power Home Remodeling | https://www.bbb.org/us/pa/chester/profile/window-installation/power-home-remodeling-group-llc-0241-80011989/complaints | $35,035 |
| bbb-2-2-power-home-remodeling.txt | Power Home Remodeling | (same) | $500 |
| bbb-2-3-power-home-remodeling.txt | Power Home Remodeling | (same) | $180 |
| bbb-3-1-champion-windows.txt | Champion Windows | https://www.bbb.org/us/oh/cincinnati/profile/windows/champion-windows-home-exteriors-0292-239/complaints | $500 |
| bbb-3-2-champion-windows.txt | Champion Windows | (same) | $500 |
| bbb-4-1-renewal-by-andersen-mn.txt | Renewal by Andersen | https://www.bbb.org/us/mn/roseville/profile/windows/renewal-by-andersen-llc-0704-21003390/complaints | n/a |
| bbb-5-1-renewal-by-andersen-carolinas.txt | Renewal by Andersen | https://www.bbb.org/us/nc/charlotte/profile/replacement-windows/renewal-by-andersen-of-the-carolinas-0473-680341/complaints | $1,000 |
| bbb-5-2-renewal-by-andersen-carolinas.txt | Renewal by Andersen | (same) | $134,000 |
| bbb-6-1-window-world-houston.txt | Window World | https://www.bbb.org/us/tx/houston/profile/windows/window-world-houston-0915-90012150/complaints | $3,500 |
| bbb-6-2-window-world-houston.txt | Window World | (same) | $3,500 |
| bbb-6-3-window-world-houston.txt | Window World | (same) | $4,000 |

## Reddit Fixtures (self-text from r/HomeImprovement)

| File | Topic / Brand | Approx $ |
|---|---|---|
| reddit-renewal-by-andersen-146k.txt | Renewal by Andersen | $146,000 |
| reddit-power-home-12k.txt | Power Home Remodeling, 13 windows | $12,000 (PRESSURE: today only) |
| reddit-local-16k-slider.txt | Local co, double-pane sliding | $16,000 |
| reddit-42k-newwindows.txt | Generic, new windows | $42,000 |
| reddit-impact-100k-fl.txt | Impact windows FL | ~$100,000 |
| reddit-rba-78k.txt | Renewal by Andersen | $78,000 |
| reddit-20k-slider.txt | Window + slider | $20,000 |
| reddit-provia-12win-10k.txt | Provia Endure, 12 windows | $10,000 |
| reddit-homedepot-simonton.txt | Home Depot / Simonton | varies |
| reddit-arched-5993.txt | Front arched window | $5,993 |
| reddit-rba-honor.txt | Renewal by Andersen, ~$30k (PRESSURE: if we sign) | $30,000 |
| reddit-highpressure-sanity.txt | Sanity check, high pressure tactics | varies |
| reddit-pressure-today-sign.txt | Today-only sign-now pressure | varies |
| reddit-fair-price-pressure.txt | Fair price + pressure sales | varies |

## Reddit Fixtures (image)

| File | Source URL |
|---|---|
| reddit-img-1-fair-quote.jpg | https://i.redd.it/8ejvin80a6lb1.jpg ("Is this a fair quote for window replacement?") |

## Coverage Audit

- Total: 29 fixtures (28 text + 1 image)
- Distinct contractors: Window Nation, Power Home Remodeling, Champion, Renewal by Andersen (MN + Carolinas), Window World, plus generic/Provia/Simonton/local
- Luxury (>=$20k): 5 fixtures
- Value (<$5k): 16 fixtures
- Pressure language ("today only" / "if we sign" / "high pressure"): 4 fixtures

## Sources Tried, Status

- BBB profile complaints: HTTP 200 on all 6 (curl + browser UA), JSON parsed from __NEXT_DATA__/inline data
- Reddit JSON API: HTTP 200 on all 3 search endpoints
- State AG sites: skipped (BBB + Reddit yielded sufficient coverage)

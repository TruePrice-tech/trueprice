#!/usr/bin/env python3
"""Build pricing data for plumbing, electrical, painting, and foundation."""
import json, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'data')

states51 = {
    "AL":0.85,"AK":1.15,"AZ":0.95,"AR":0.80,"CA":1.22,"CO":1.05,"CT":1.15,"DE":1.05,
    "FL":0.92,"GA":0.88,"HI":1.18,"ID":0.90,"IL":1.02,"IN":0.90,"IA":0.88,"KS":0.88,
    "KY":0.85,"LA":0.88,"ME":1.00,"MD":1.08,"MA":1.15,"MI":0.92,"MN":0.98,"MS":0.82,
    "MO":0.88,"MT":0.95,"NE":0.88,"NV":1.00,"NH":1.05,"NJ":1.12,"NM":0.90,"NY":1.18,
    "NC":0.90,"ND":0.90,"OH":0.92,"OK":0.85,"OR":1.05,"PA":1.00,"RI":1.08,"SC":0.85,
    "SD":0.88,"TN":0.85,"TX":0.90,"UT":0.92,"VT":1.00,"VA":0.95,"WA":1.10,"WV":0.80,
    "WI":0.92,"WY":0.92,"DC":1.20
}

# ===== PLUMBING =====
plumbing = {
    "metadata": {"sources": "HomeAdvisor, Angi, BLS SOC 47-2152, contractor surveys", "baseYear": 2026},
    "stateMultipliers": states51,
    "laborRates": {"low": 75, "mid": 110, "high": 175, "emergency": 200},
    "commonJobs": {
        "water_heater_tank": {"label": "Water Heater (Tank)", "total": [800, 2000], "labor_hrs": [2, 4], "parts": [400, 1200], "urgency": "soon"},
        "water_heater_tankless": {"label": "Water Heater (Tankless)", "total": [2000, 4500], "labor_hrs": [4, 8], "parts": [1200, 3000], "urgency": "soon"},
        "whole_house_repipe": {"label": "Whole House Repipe", "total": [2000, 6000], "labor_hrs": [15, 40], "parts": [500, 2000], "urgency": "can_wait"},
        "sewer_line_repair": {"label": "Sewer Line Repair", "total": [1500, 5000], "labor_hrs": [4, 12], "parts": [500, 2000], "urgency": "critical"},
        "sewer_line_replace": {"label": "Sewer Line Replacement", "total": [3000, 10000], "labor_hrs": [8, 20], "parts": [1500, 5000], "urgency": "critical"},
        "drain_cleaning": {"label": "Drain Cleaning/Unclog", "total": [150, 500], "labor_hrs": [0.5, 2], "parts": [0, 50], "urgency": "soon"},
        "toilet_install": {"label": "Toilet Installation", "total": [200, 600], "labor_hrs": [1, 2], "parts": [100, 400], "urgency": "soon"},
        "faucet_install": {"label": "Faucet Installation", "total": [150, 400], "labor_hrs": [1, 2], "parts": [50, 250], "urgency": "can_wait"},
        "garbage_disposal": {"label": "Garbage Disposal Install", "total": [200, 500], "labor_hrs": [1, 2], "parts": [100, 300], "urgency": "can_wait"},
        "sump_pump": {"label": "Sump Pump Install", "total": [500, 1500], "labor_hrs": [2, 5], "parts": [200, 800], "urgency": "soon"},
        "gas_line_install": {"label": "Gas Line Installation", "total": [500, 2000], "labor_hrs": [2, 6], "parts": [200, 800], "urgency": "can_wait"},
        "leak_repair": {"label": "Pipe Leak Repair", "total": [150, 500], "labor_hrs": [1, 3], "parts": [20, 100], "urgency": "critical"},
        "water_softener": {"label": "Water Softener Install", "total": [800, 2500], "labor_hrs": [2, 4], "parts": [500, 1800], "urgency": "can_wait"},
        "backflow_preventer": {"label": "Backflow Preventer", "total": [200, 800], "labor_hrs": [1, 3], "parts": [100, 400], "urgency": "can_wait"},
    },
    "commonUpsells": [
        {"item": "Camera inspection", "cost": [100, 400], "necessary": "sometimes", "notes": "Useful for diagnosing hidden issues. Not needed for simple clogs."},
        {"item": "Whole-house water filter", "cost": [500, 2000], "necessary": "rarely", "notes": "Only if water quality test shows issues."},
        {"item": "Expansion tank", "cost": [200, 400], "necessary": "sometimes", "notes": "Required by code in some areas with closed water systems."},
        {"item": "PRV replacement", "cost": [300, 600], "necessary": "verify", "notes": "Pressure reducing valve. Only if water pressure exceeds 80 PSI."},
    ],
    "scopeCheckItems": [
        {"key": "laborRate", "label": "Labor rate stated", "weight": 12},
        {"key": "partsItemized", "label": "Parts itemized separately", "weight": 15},
        {"key": "permit", "label": "Permits included", "weight": 8},
        {"key": "warranty", "label": "Warranty on parts and labor", "weight": 12},
        {"key": "cleanup", "label": "Cleanup and disposal included", "weight": 6},
        {"key": "materialSpec", "label": "Material type specified (PEX, copper, PVC)", "weight": 10},
        {"key": "codeCompliance", "label": "Code compliance mentioned", "weight": 8},
        {"key": "diagnosticFee", "label": "Diagnostic/service call fee noted", "weight": 6},
    ]
}

# ===== ELECTRICAL =====
electrical = {
    "metadata": {"sources": "HomeAdvisor, Angi, BLS SOC 47-2111, NFPA, contractor surveys", "baseYear": 2026},
    "stateMultipliers": states51,
    "laborRates": {"low": 80, "mid": 120, "high": 180, "master": 200},
    "commonJobs": {
        "panel_upgrade_100_200": {"label": "Panel Upgrade (100A to 200A)", "total": [1500, 4000], "labor_hrs": [4, 8], "parts": [500, 1500], "urgency": "soon"},
        "panel_upgrade_200_400": {"label": "Panel Upgrade (200A to 400A)", "total": [3000, 6000], "labor_hrs": [6, 12], "parts": [1500, 3000], "urgency": "can_wait"},
        "whole_house_rewire": {"label": "Whole House Rewire", "total": [3000, 8000], "labor_hrs": [20, 50], "parts": [1000, 3000], "urgency": "can_wait"},
        "outlet_install": {"label": "Outlet Installation", "total": [150, 350], "labor_hrs": [0.5, 1.5], "parts": [10, 50], "urgency": "can_wait"},
        "gfci_outlet": {"label": "GFCI Outlet Install", "total": [150, 300], "labor_hrs": [0.5, 1], "parts": [15, 30], "urgency": "soon"},
        "ceiling_fan": {"label": "Ceiling Fan Install", "total": [150, 400], "labor_hrs": [1, 2], "parts": [50, 250], "urgency": "can_wait"},
        "light_fixture": {"label": "Light Fixture Install", "total": [100, 350], "labor_hrs": [0.5, 2], "parts": [30, 200], "urgency": "can_wait"},
        "ev_charger": {"label": "EV Charger Install (Level 2)", "total": [800, 2500], "labor_hrs": [3, 6], "parts": [400, 1500], "urgency": "can_wait"},
        "generator_install": {"label": "Whole House Generator", "total": [5000, 15000], "labor_hrs": [8, 16], "parts": [3000, 10000], "urgency": "can_wait"},
        "recessed_lights": {"label": "Recessed Lighting (6 lights)", "total": [600, 1500], "labor_hrs": [3, 6], "parts": [200, 600], "urgency": "can_wait"},
        "circuit_breaker": {"label": "Circuit Breaker Replace", "total": [150, 350], "labor_hrs": [0.5, 1.5], "parts": [20, 80], "urgency": "critical"},
        "smoke_detector_hardwired": {"label": "Hardwired Smoke Detectors (4)", "total": [300, 600], "labor_hrs": [1.5, 3], "parts": [100, 200], "urgency": "critical"},
        "knob_tube_removal": {"label": "Knob & Tube Wiring Removal", "total": [3000, 8000], "labor_hrs": [20, 50], "parts": [500, 2000], "urgency": "soon", "notes": "Required for insurance in many states."},
    },
    "commonUpsells": [
        {"item": "Whole-house surge protector", "cost": [200, 500], "necessary": "recommended", "notes": "Protects electronics. Low cost for significant protection."},
        {"item": "Smart switches/dimmers", "cost": [50, 150], "necessary": "rarely", "notes": "Convenience, not safety. DIY is $15-30 per switch."},
        {"item": "Landscape lighting", "cost": [500, 2000], "necessary": "rarely", "notes": "Aesthetic only. Can DIY with low-voltage kits for $100-300."},
        {"item": "USB outlets", "cost": [80, 150], "necessary": "rarely", "notes": "Convenient but not needed. USB adapters cost $5."},
    ],
    "scopeCheckItems": [
        {"key": "laborRate", "label": "Labor rate stated", "weight": 12},
        {"key": "partsItemized", "label": "Parts/materials itemized", "weight": 15},
        {"key": "permit", "label": "Permits and inspection included", "weight": 10},
        {"key": "warranty", "label": "Warranty on workmanship", "weight": 12},
        {"key": "codeCompliance", "label": "NEC code compliance stated", "weight": 10},
        {"key": "licensed", "label": "Licensed electrician performing work", "weight": 10},
        {"key": "wireSpec", "label": "Wire gauge/type specified", "weight": 8},
        {"key": "cleanup", "label": "Cleanup included", "weight": 5},
    ]
}

# ===== PAINTING =====
painting = {
    "metadata": {"sources": "HomeAdvisor, Angi, painting contractor surveys, Sherwin-Williams/Benjamin Moore", "baseYear": 2026},
    "stateMultipliers": states51,
    "laborRates": {"low": 25, "mid": 50, "high": 75, "per_sqft_interior": [2, 6], "per_sqft_exterior": [1.5, 4]},
    "commonJobs": {
        "interior_room": {"label": "Interior Room (avg 12x12)", "total": [300, 800], "labor_hrs": [4, 8], "parts": [50, 150], "urgency": "can_wait"},
        "interior_whole_house": {"label": "Interior Whole House (2000 sqft)", "total": [2000, 6000], "labor_hrs": [30, 60], "parts": [400, 1200], "urgency": "can_wait"},
        "exterior_whole_house": {"label": "Exterior Whole House", "total": [2500, 7000], "labor_hrs": [40, 80], "parts": [500, 1500], "urgency": "can_wait"},
        "cabinet_painting": {"label": "Kitchen Cabinet Painting", "total": [1500, 4000], "labor_hrs": [20, 40], "parts": [200, 600], "urgency": "can_wait"},
        "deck_staining": {"label": "Deck Staining/Sealing", "total": [500, 2000], "labor_hrs": [6, 15], "parts": [100, 400], "urgency": "can_wait"},
        "trim_painting": {"label": "Trim/Baseboards (whole house)", "total": [800, 2500], "labor_hrs": [10, 25], "parts": [100, 400], "urgency": "can_wait"},
        "ceiling_painting": {"label": "Ceiling Painting (per room)", "total": [150, 400], "labor_hrs": [2, 4], "parts": [30, 80], "urgency": "can_wait"},
        "accent_wall": {"label": "Accent Wall", "total": [100, 300], "labor_hrs": [2, 4], "parts": [30, 80], "urgency": "can_wait"},
        "popcorn_removal": {"label": "Popcorn Ceiling Removal (per room)", "total": [300, 800], "labor_hrs": [4, 8], "parts": [20, 50], "urgency": "can_wait", "notes": "Pre-1980 homes may contain asbestos. Test before removal."},
        "pressure_washing": {"label": "Pressure Washing (before exterior)", "total": [200, 600], "labor_hrs": [2, 5], "parts": [20, 50], "urgency": "can_wait"},
    },
    "paintQuality": {
        "economy": {"label": "Economy (Glidden, Valspar)", "per_gallon": [25, 40], "coverage": "350 sqft/gal", "coats_needed": 2, "lifespan_interior": "3-5 years", "lifespan_exterior": "3-5 years"},
        "mid": {"label": "Mid-Range (Behr, PPG)", "per_gallon": [35, 55], "coverage": "400 sqft/gal", "coats_needed": 2, "lifespan_interior": "5-8 years", "lifespan_exterior": "5-7 years"},
        "premium": {"label": "Premium (Sherwin-Williams, Benjamin Moore)", "per_gallon": [50, 80], "coverage": "400 sqft/gal", "coats_needed": "1-2", "lifespan_interior": "8-12 years", "lifespan_exterior": "7-10 years"}
    },
    "commonUpsells": [
        {"item": "Primer coat (separate)", "cost": [200, 500], "necessary": "sometimes", "notes": "Needed for dark-to-light color changes or bare drywall. Premium paints include primer."},
        {"item": "Color consultation", "cost": [100, 300], "necessary": "rarely", "notes": "Many paint stores offer this free. Sherwin-Williams has free color matching."},
        {"item": "Lead paint testing", "cost": [200, 500], "necessary": "verify", "notes": "Required for pre-1978 homes. Federal law (EPA RRP Rule)."},
        {"item": "Wallpaper removal", "cost": [300, 800], "necessary": "if_applicable", "notes": "Per room. Necessary if painting over wallpaper."},
    ],
    "scopeCheckItems": [
        {"key": "laborRate", "label": "Labor rate or per-sqft price stated", "weight": 12},
        {"key": "paintBrand", "label": "Paint brand/quality specified", "weight": 12},
        {"key": "coats", "label": "Number of coats specified", "weight": 10},
        {"key": "prepWork", "label": "Prep work included (sanding, patching, caulking)", "weight": 15},
        {"key": "primerIncluded", "label": "Primer included or noted", "weight": 8},
        {"key": "warranty", "label": "Warranty on workmanship", "weight": 10},
        {"key": "furniture", "label": "Furniture moving/covering included", "weight": 6},
        {"key": "cleanup", "label": "Cleanup and touch-up included", "weight": 8},
    ]
}

# ===== FOUNDATION =====
foundation = {
    "metadata": {"sources": "HomeAdvisor, Angi, structural engineer surveys, foundation contractor data", "baseYear": 2026},
    "stateMultipliers": states51,
    "laborRates": {"low": 100, "mid": 150, "high": 225},
    "commonJobs": {
        "pier_push": {"label": "Push Piers (per pier)", "total": [1000, 2500], "labor_hrs": [3, 6], "parts": [500, 1500], "urgency": "critical"},
        "pier_helical": {"label": "Helical Piers (per pier)", "total": [1500, 3500], "labor_hrs": [3, 6], "parts": [800, 2500], "urgency": "critical"},
        "slabjacking": {"label": "Slabjacking/Mudjacking", "total": [500, 1500], "labor_hrs": [2, 4], "parts": [200, 800], "urgency": "soon"},
        "polyurethane_foam": {"label": "Polyurethane Foam Injection", "total": [1000, 3000], "labor_hrs": [2, 5], "parts": [500, 2000], "urgency": "soon"},
        "wall_anchors": {"label": "Wall Anchors (per anchor)", "total": [500, 1500], "labor_hrs": [2, 4], "parts": [200, 800], "urgency": "critical"},
        "carbon_fiber_straps": {"label": "Carbon Fiber Wall Straps (per strap)", "total": [400, 1000], "labor_hrs": [1, 3], "parts": [200, 600], "urgency": "soon"},
        "crack_injection": {"label": "Foundation Crack Injection", "total": [300, 800], "labor_hrs": [1, 3], "parts": [50, 200], "urgency": "soon"},
        "waterproofing_interior": {"label": "Interior Waterproofing", "total": [3000, 8000], "labor_hrs": [15, 30], "parts": [1000, 3000], "urgency": "soon"},
        "waterproofing_exterior": {"label": "Exterior Waterproofing", "total": [5000, 15000], "labor_hrs": [20, 50], "parts": [2000, 5000], "urgency": "can_wait"},
        "french_drain": {"label": "French Drain (interior)", "total": [2000, 6000], "labor_hrs": [10, 20], "parts": [500, 2000], "urgency": "soon"},
        "sump_pump_foundation": {"label": "Sump Pump (with foundation work)", "total": [500, 1500], "labor_hrs": [2, 5], "parts": [200, 800], "urgency": "soon"},
        "structural_engineer_report": {"label": "Structural Engineer Report", "total": [300, 800], "labor_hrs": [2, 4], "parts": [0, 0], "urgency": "critical", "notes": "Get this BEFORE accepting any foundation repair quote."},
    },
    "commonUpsells": [
        {"item": "Lifetime warranty", "cost": [500, 2000], "necessary": "recommended", "notes": "Foundation work should have transferable warranty. Worth it for resale value."},
        {"item": "Cosmetic crack repair", "cost": [200, 500], "necessary": "sometimes", "notes": "Structural repair doesn't always include cosmetic finish. Clarify scope."},
        {"item": "Grading/drainage improvement", "cost": [1000, 3000], "necessary": "often", "notes": "Poor drainage causes most foundation problems. Fixing the cause prevents recurrence."},
        {"item": "Full basement waterproofing with repair", "cost": [5000, 15000], "necessary": "verify", "notes": "May not be needed if the foundation repair addresses the water issue."},
    ],
    "redFlags": [
        "No structural engineer assessment before recommending repairs",
        "Quoting over the phone without inspecting the foundation",
        "Recommending piers when crack injection would suffice",
        "No permit mentioned (required in most jurisdictions)",
        "Pressure to sign immediately (scare tactics about house collapsing)",
        "No warranty or non-transferable warranty",
        "Not addressing the root cause (drainage, grading)"
    ],
    "scopeCheckItems": [
        {"key": "engineerReport", "label": "Structural engineer report referenced", "weight": 15},
        {"key": "repairMethod", "label": "Repair method clearly specified", "weight": 12},
        {"key": "numPiers", "label": "Number of piers/anchors specified", "weight": 10},
        {"key": "permit", "label": "Permits included", "weight": 10},
        {"key": "warranty", "label": "Warranty (transferable, lifetime preferred)", "weight": 15},
        {"key": "drainage", "label": "Drainage/root cause addressed", "weight": 10},
        {"key": "timeline", "label": "Project timeline stated", "weight": 5},
        {"key": "cleanup", "label": "Cleanup and restoration included", "weight": 8},
    ]
}

# Write all 4
for name, data in [("plumbing-pricing.json", plumbing), ("electrical-pricing.json", electrical),
                     ("painting-pricing.json", painting), ("foundation-pricing.json", foundation)]:
    path = os.path.join(OUT, name)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    jobs = len(data.get('commonJobs', {}))
    upsells = len(data.get('commonUpsells', []))
    print(f'{name}: {jobs} jobs, {upsells} upsells, 51 state multipliers')

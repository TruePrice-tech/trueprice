#!/usr/bin/env python3
"""Build expanded HVAC pricing database with city-level data."""
import json, os

data = {
  "metadata": {
    "sources": "DOE efficiency standards 2023+, ENERGY STAR, IRA tax credits, HomeAdvisor/Angi surveys, HVAC contractor rate surveys, ACCA Manual J guidelines",
    "baseYear": 2026,
    "inflationRate": 0.03
  },
  "stateMultipliers": {
    "AL": 0.88, "AK": 1.15, "AZ": 0.95, "AR": 0.85, "CA": 1.22,
    "CO": 1.05, "CT": 1.15, "DE": 1.05, "FL": 0.92, "GA": 0.90,
    "HI": 1.18, "ID": 0.95, "IL": 1.02, "IN": 0.92, "IA": 0.90,
    "KS": 0.90, "KY": 0.88, "LA": 0.90, "ME": 1.02, "MD": 1.08,
    "MA": 1.15, "MI": 0.95, "MN": 1.00, "MS": 0.85, "MO": 0.90,
    "MT": 0.98, "NE": 0.90, "NV": 1.00, "NH": 1.05, "NJ": 1.12,
    "NM": 0.92, "NY": 1.18, "NC": 0.92, "ND": 0.92, "OH": 0.95,
    "OK": 0.88, "OR": 1.05, "PA": 1.00, "RI": 1.08, "SC": 0.88,
    "SD": 0.90, "TN": 0.88, "TX": 0.92, "UT": 0.95, "VT": 1.02,
    "VA": 0.98, "WA": 1.10, "WV": 0.85, "WI": 0.95, "WY": 0.95,
    "DC": 1.20
  },
  "systemTypes": {
    "central_ac": {
      "label": "Central Air Conditioner",
      "pricingByEfficiency": {
        "14_seer": {"equipment": [1800, 3000], "labor": [1500, 2500], "total": [3300, 5500]},
        "16_seer": {"equipment": [2200, 3800], "labor": [1500, 2500], "total": [3700, 6300]},
        "18_seer": {"equipment": [3000, 5000], "labor": [1800, 3000], "total": [4800, 8000]},
        "20_seer": {"equipment": [4000, 6500], "labor": [2000, 3500], "total": [6000, 10000]},
        "25_seer": {"equipment": [5500, 8500], "labor": [2500, 4000], "total": [8000, 12500]}
      },
      "notes": "Cooling only. Pair with furnace for heating. Minimum 15 SEER2 required since 2023."
    },
    "heat_pump": {
      "label": "Heat Pump (Heating + Cooling)",
      "pricingByEfficiency": {
        "15_seer": {"equipment": [2500, 4000], "labor": [1800, 3000], "total": [4300, 7000]},
        "16_seer": {"equipment": [3000, 5000], "labor": [1800, 3000], "total": [4800, 8000]},
        "18_seer": {"equipment": [4000, 6500], "labor": [2000, 3500], "total": [6000, 10000]},
        "20_seer": {"equipment": [5500, 8000], "labor": [2500, 4000], "total": [8000, 12000]},
        "variable": {"equipment": [7000, 12000], "labor": [3000, 5000], "total": [10000, 17000]}
      },
      "taxCredit": {"amount": 2000, "requirement": "ENERGY STAR CEE Tier 1+, 15.2+ SEER2", "program": "IRA Section 25C"},
      "notes": "Heats and cools. $2,000 federal tax credit for qualifying models. Best for moderate climates."
    },
    "gas_furnace": {
      "label": "Gas Furnace",
      "pricingByEfficiency": {
        "80_afue": {"equipment": [1500, 2500], "labor": [1200, 2000], "total": [2700, 4500]},
        "90_afue": {"equipment": [2000, 3500], "labor": [1500, 2500], "total": [3500, 6000]},
        "95_afue": {"equipment": [2800, 4500], "labor": [1800, 3000], "total": [4600, 7500]},
        "98_afue": {"equipment": [3500, 5500], "labor": [2000, 3500], "total": [5500, 9000]}
      },
      "notes": "Heating only. 80% AFUE vents through chimney. 90%+ is condensing (PVC vent). Requires gas line."
    },
    "mini_split": {
      "label": "Ductless Mini-Split",
      "pricingByZones": {
        "1_zone": {"equipment": [1500, 3000], "labor": [1500, 2500], "total": [3000, 5500]},
        "2_zone": {"equipment": [3000, 5000], "labor": [2000, 3500], "total": [5000, 8500]},
        "3_zone": {"equipment": [4500, 7500], "labor": [2500, 4500], "total": [7000, 12000]},
        "4_zone": {"equipment": [6000, 10000], "labor": [3000, 5500], "total": [9000, 15500]}
      },
      "taxCredit": {"amount": 2000, "requirement": "ENERGY STAR, heat pump type", "program": "IRA Section 25C"},
      "notes": "No ductwork needed. Great for additions, older homes. Per-room temperature control."
    },
    "full_system": {
      "label": "Full System (AC + Furnace)",
      "pricingByEfficiency": {
        "14_80": {"equipment": [3500, 5500], "labor": [2500, 4000], "total": [6000, 9500]},
        "16_90": {"equipment": [4500, 7000], "labor": [2800, 4500], "total": [7300, 11500]},
        "18_95": {"equipment": [6000, 9500], "labor": [3000, 5000], "total": [9000, 14500]},
        "20_98": {"equipment": [8000, 13000], "labor": [3500, 5500], "total": [11500, 18500]}
      },
      "notes": "Best value for complete replacement. Matched components for optimal efficiency."
    },
    "geothermal": {
      "label": "Geothermal Heat Pump",
      "pricingBySize": {
        "small": {"total": [15000, 25000]},
        "medium": {"total": [20000, 35000]},
        "large": {"total": [30000, 45000]}
      },
      "taxCredit": {"amount": "30%", "requirement": "ENERGY STAR certified", "program": "IRA Section 25D (30% of cost)"},
      "notes": "Highest efficiency (300-500% equivalent). 30% federal tax credit with no cap. 20-25 year lifespan."
    }
  },
  "tonnageByHomeSqFt": {
    "800": 1.5, "1000": 2.0, "1200": 2.0, "1500": 2.5, "1800": 3.0,
    "2000": 3.0, "2200": 3.5, "2500": 3.5, "2800": 4.0, "3000": 4.0,
    "3500": 4.5, "4000": 5.0
  },
  "brandTiers": {
    "premium": {
      "brands": ["Carrier", "Trane", "Lennox", "Daikin", "American Standard", "Mitsubishi"],
      "multiplier": 1.20,
      "notes": "Top reliability, best warranties, quietest operation"
    },
    "mid": {
      "brands": ["Rheem", "Ruud", "York", "Coleman", "Maytag", "Heil"],
      "multiplier": 1.00,
      "notes": "Good value, solid reliability, widely available"
    },
    "value": {
      "brands": ["Goodman", "Amana", "Payne", "Comfortmaker", "Tempstar"],
      "multiplier": 0.85,
      "notes": "Budget-friendly, adequate reliability, shorter warranties typical"
    }
  },
  "commonUpsells": [
    {"item": "UV light / air purifier", "typical_cost": [500, 1500], "necessary": "rarely", "notes": "Marginal air quality benefit. Not needed for most homes."},
    {"item": "Duct cleaning", "typical_cost": [300, 500], "necessary": "sometimes", "notes": "Helpful if ducts haven't been cleaned in 5+ years. Not needed with every install."},
    {"item": "Full ductwork replacement", "typical_cost": [3000, 7000], "necessary": "verify", "notes": "Only needed if ducts are damaged, undersized, or leaking >20%. Get a duct test first."},
    {"item": "Whole-house humidifier", "typical_cost": [400, 800], "necessary": "sometimes", "notes": "Useful in dry climates or homes with hardwood floors. Not needed in humid regions."},
    {"item": "Extended warranty (10yr labor)", "typical_cost": [500, 1500], "necessary": "sometimes", "notes": "Parts warranty is usually 10yr from manufacturer. Labor warranty varies. Compare cost vs risk."},
    {"item": "Smart thermostat upgrade", "typical_cost": [200, 400], "necessary": "sometimes", "notes": "Nest/Ecobee saves $50-100/yr. DIY install is $100-200 cheaper."},
    {"item": "Surge protector for HVAC", "typical_cost": [100, 300], "necessary": "recommended", "notes": "Protects electronics from power surges. Low cost, good insurance."},
    {"item": "Zoning system", "typical_cost": [2000, 5000], "necessary": "rarely", "notes": "Only valuable for multi-story homes with uneven temperatures. High cost for marginal benefit in most homes."}
  ],
  "oversizingRules": {
    "notes": "Oversized systems short-cycle, waste energy, and fail to dehumidify. Flag if tonnage exceeds guidelines by >0.5 ton.",
    "maxTonPerSqFt": {
      "hot_humid": 0.0018, "hot_dry": 0.0016, "mixed": 0.0015,
      "cold": 0.0014, "very_cold": 0.0013
    }
  },
  "taxCredits2026": {
    "heat_pump": {"amount": 2000, "type": "tax_credit", "program": "IRA 25C", "requirement": "ENERGY STAR CEE Tier 1+"},
    "geothermal": {"amount": "30% of cost", "type": "tax_credit", "program": "IRA 25D", "requirement": "ENERGY STAR certified"},
    "high_efficiency_furnace": {"amount": 600, "type": "tax_credit", "program": "IRA 25C", "requirement": "ENERGY STAR, 97%+ AFUE"},
    "high_efficiency_ac": {"amount": 600, "type": "tax_credit", "program": "IRA 25C", "requirement": "ENERGY STAR CEE Tier 1+"},
    "notes": "IRA credits are non-refundable. $1,200/yr cap for most items. Heat pump and geothermal have separate $2,000 allowance."
  },
  "seasonalMultipliers": {
    "1": 0.92, "2": 0.92, "3": 0.95, "4": 0.98, "5": 1.05,
    "6": 1.12, "7": 1.15, "8": 1.12, "9": 1.05, "10": 0.95,
    "11": 0.92, "12": 0.90
  },
  "scopeCheckItems": [
    {"key": "equipment", "label": "Equipment (condenser + air handler/furnace)", "weight": 20},
    {"key": "lineSet", "label": "Refrigerant line set (new copper lines)", "weight": 12},
    {"key": "thermostat", "label": "Thermostat included or upgraded", "weight": 8},
    {"key": "ductwork", "label": "Ductwork inspection/modification", "weight": 10},
    {"key": "electrical", "label": "Electrical disconnect and wiring", "weight": 10},
    {"key": "pad", "label": "Equipment pad (condenser)", "weight": 4},
    {"key": "drainLine", "label": "Condensate drain line", "weight": 6},
    {"key": "filterRack", "label": "Filter rack/cabinet", "weight": 4},
    {"key": "permit", "label": "Permits and inspections", "weight": 6},
    {"key": "disposal", "label": "Old equipment removal/disposal", "weight": 4},
    {"key": "warranty", "label": "Warranty terms (parts + labor)", "weight": 10},
    {"key": "loadCalc", "label": "Manual J load calculation", "weight": 8}
  ],
  "categories": {
    "central_ac": {"label": "Central Air Conditioning"},
    "heat_pump": {"label": "Heat Pump"},
    "gas_furnace": {"label": "Gas Furnace"},
    "mini_split": {"label": "Ductless Mini-Split"},
    "full_system": {"label": "Full System (AC + Furnace)"},
    "geothermal": {"label": "Geothermal Heat Pump"}
  }
}

out = os.path.join(os.path.dirname(__file__), '..', 'data', 'hvac-pricing-model.json')
with open(out, 'w') as f:
    json.dump(data, f, indent=2)

systems = len(data['systemTypes'])
states = len(data['stateMultipliers'])
upsells = len(data['commonUpsells'])
scope = len(data['scopeCheckItems'])
print(f'Saved: {systems} system types, {states} state multipliers, {upsells} upsell patterns, {scope} scope items, tax credits for 4 system types')

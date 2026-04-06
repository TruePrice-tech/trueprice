#!/usr/bin/env python3
"""Build pricing data for remaining 11 home service verticals."""
import json, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'data')

s51 = {
    "AL":0.85,"AK":1.15,"AZ":0.95,"AR":0.80,"CA":1.22,"CO":1.05,"CT":1.15,"DE":1.05,
    "FL":0.92,"GA":0.88,"HI":1.18,"ID":0.90,"IL":1.02,"IN":0.90,"IA":0.88,"KS":0.88,
    "KY":0.85,"LA":0.88,"ME":1.00,"MD":1.08,"MA":1.15,"MI":0.92,"MN":0.98,"MS":0.82,
    "MO":0.88,"MT":0.95,"NE":0.88,"NV":1.00,"NH":1.05,"NJ":1.12,"NM":0.90,"NY":1.18,
    "NC":0.90,"ND":0.90,"OH":0.92,"OK":0.85,"OR":1.05,"PA":1.00,"RI":1.08,"SC":0.85,
    "SD":0.88,"TN":0.85,"TX":0.90,"UT":0.92,"VT":1.00,"VA":0.95,"WA":1.10,"WV":0.80,
    "WI":0.92,"WY":0.92,"DC":1.20
}

scope_base = [
    {"key": "laborRate", "label": "Labor rate stated", "weight": 12},
    {"key": "partsItemized", "label": "Parts/materials itemized", "weight": 15},
    {"key": "permit", "label": "Permits included", "weight": 8},
    {"key": "warranty", "label": "Warranty stated", "weight": 12},
    {"key": "cleanup", "label": "Cleanup included", "weight": 6},
    {"key": "timeline", "label": "Timeline/schedule stated", "weight": 5},
]

verticals = {
    "windows-pricing.json": {
        "metadata": {"sources": "HomeAdvisor, Angi, window manufacturer data", "baseYear": 2026},
        "stateMultipliers": s51,
        "laborRates": {"low": 40, "mid": 65, "high": 100, "per_window": [150, 400]},
        "commonJobs": {
            "vinyl_double_hung": {"label": "Vinyl Double-Hung Window", "total": [300, 700], "per_unit": True, "urgency": "can_wait"},
            "vinyl_casement": {"label": "Vinyl Casement Window", "total": [350, 800], "per_unit": True, "urgency": "can_wait"},
            "fiberglass_window": {"label": "Fiberglass Window", "total": [500, 1000], "per_unit": True, "urgency": "can_wait"},
            "wood_window": {"label": "Wood Window", "total": [600, 1200], "per_unit": True, "urgency": "can_wait"},
            "bay_window": {"label": "Bay/Bow Window", "total": [1500, 4000], "per_unit": True, "urgency": "can_wait"},
            "sliding_glass_door": {"label": "Sliding Glass Door", "total": [1000, 3000], "per_unit": True, "urgency": "can_wait"},
            "whole_house_10": {"label": "Whole House (10 windows)", "total": [3500, 8000], "urgency": "can_wait"},
            "whole_house_20": {"label": "Whole House (20 windows)", "total": [6000, 15000], "urgency": "can_wait"},
        },
        "commonUpsells": [
            {"item": "Triple-pane upgrade", "cost": [50, 150], "necessary": "sometimes", "notes": "Per window. Worth it in extreme climates only."},
            {"item": "Low-E coating upgrade", "cost": [25, 75], "necessary": "recommended", "notes": "Per window. Significant energy savings."},
            {"item": "Exterior trim/capping", "cost": [50, 150], "necessary": "sometimes", "notes": "Per window. Needed if existing trim is rotted."},
        ],
        "scopeCheckItems": scope_base + [{"key": "windowType", "label": "Window type/material specified", "weight": 10}, {"key": "energyStar", "label": "ENERGY STAR rating noted", "weight": 8}],
    },
    "siding-pricing.json": {
        "metadata": {"sources": "HomeAdvisor, Angi, siding contractor surveys", "baseYear": 2026},
        "stateMultipliers": s51,
        "commonJobs": {
            "vinyl_siding": {"label": "Vinyl Siding (whole house)", "total": [5000, 12000], "per_sqft": [3, 7], "urgency": "can_wait"},
            "fiber_cement": {"label": "Fiber Cement (HardiePlank)", "total": [8000, 18000], "per_sqft": [5, 11], "urgency": "can_wait"},
            "wood_siding": {"label": "Wood Siding", "total": [10000, 20000], "per_sqft": [6, 12], "urgency": "can_wait"},
            "engineered_wood": {"label": "Engineered Wood (LP SmartSide)", "total": [7000, 15000], "per_sqft": [4, 9], "urgency": "can_wait"},
            "stone_veneer": {"label": "Stone Veneer (accent)", "total": [5000, 15000], "per_sqft": [15, 35], "urgency": "can_wait"},
            "partial_repair": {"label": "Partial Siding Repair", "total": [500, 3000], "urgency": "soon"},
        },
        "commonUpsells": [
            {"item": "House wrap replacement", "cost": [500, 1500], "necessary": "sometimes", "notes": "Needed if existing wrap is damaged or missing."},
            {"item": "Soffit/fascia replacement", "cost": [1000, 3000], "necessary": "often", "notes": "Usually done with siding. Check condition."},
        ],
        "scopeCheckItems": scope_base + [{"key": "materialType", "label": "Siding material specified", "weight": 12}, {"key": "insulation", "label": "Insulation board included", "weight": 8}],
    },
    "solar-pricing.json": {
        "metadata": {"sources": "EnergySage, SEIA, EIA, NREL, contractor surveys", "baseYear": 2026},
        "stateMultipliers": s51,
        "commonJobs": {
            "residential_6kw": {"label": "6kW Residential System", "total": [12000, 18000], "urgency": "can_wait"},
            "residential_8kw": {"label": "8kW Residential System", "total": [16000, 24000], "urgency": "can_wait"},
            "residential_10kw": {"label": "10kW Residential System", "total": [20000, 30000], "urgency": "can_wait"},
            "residential_12kw": {"label": "12kW Residential System", "total": [24000, 36000], "urgency": "can_wait"},
            "battery_storage": {"label": "Battery Storage (Tesla Powerwall etc.)", "total": [10000, 16000], "urgency": "can_wait"},
        },
        "taxCredit": {"amount": "30%", "program": "IRA Section 25D", "notes": "30% of total cost with no cap. Includes equipment, labor, permits. Through 2032."},
        "commonUpsells": [
            {"item": "Battery storage", "cost": [10000, 16000], "necessary": "sometimes", "notes": "Useful if utility doesn't offer net metering or for backup power."},
            {"item": "Critter guard", "cost": [500, 1500], "necessary": "recommended", "notes": "Prevents squirrels/birds nesting under panels."},
            {"item": "Panel-level monitoring", "cost": [200, 500], "necessary": "sometimes", "notes": "Micro-inverter systems include this. String inverters may not."},
        ],
        "scopeCheckItems": scope_base + [{"key": "systemSize", "label": "System size (kW) specified", "weight": 12}, {"key": "panelBrand", "label": "Panel brand/model specified", "weight": 10}, {"key": "inverterType", "label": "Inverter type (string vs micro)", "weight": 8}, {"key": "roofCondition", "label": "Roof condition assessment", "weight": 8}],
    },
    "fencing-pricing.json": {
        "metadata": {"sources": "HomeAdvisor, Angi, fencing contractor surveys", "baseYear": 2026},
        "stateMultipliers": s51,
        "commonJobs": {
            "wood_privacy_6ft": {"label": "Wood Privacy Fence (6ft)", "total": [15, 30], "per_foot": True, "urgency": "can_wait"},
            "vinyl_privacy": {"label": "Vinyl Privacy Fence", "total": [20, 40], "per_foot": True, "urgency": "can_wait"},
            "chain_link_4ft": {"label": "Chain Link (4ft)", "total": [10, 20], "per_foot": True, "urgency": "can_wait"},
            "aluminum_ornamental": {"label": "Aluminum Ornamental", "total": [25, 45], "per_foot": True, "urgency": "can_wait"},
            "wrought_iron": {"label": "Wrought Iron", "total": [25, 50], "per_foot": True, "urgency": "can_wait"},
            "composite": {"label": "Composite/Trex Fencing", "total": [25, 50], "per_foot": True, "urgency": "can_wait"},
            "gate_install": {"label": "Gate Installation", "total": [200, 800], "urgency": "can_wait"},
        },
        "commonUpsells": [
            {"item": "Concrete post footings", "cost": [10, 25], "necessary": "recommended", "notes": "Per post. Much more durable than gravel set."},
            {"item": "Stain/seal (wood)", "cost": [2, 5], "necessary": "recommended", "notes": "Per linear foot. Extends life 5-10 years."},
        ],
        "scopeCheckItems": scope_base + [{"key": "materialType", "label": "Fence material specified", "weight": 12}, {"key": "height", "label": "Fence height specified", "weight": 8}, {"key": "postType", "label": "Post setting method (concrete vs gravel)", "weight": 8}],
    },
    "concrete-pricing.json": {
        "metadata": {"sources": "HomeAdvisor, Angi, concrete contractor surveys", "baseYear": 2026},
        "stateMultipliers": s51,
        "commonJobs": {
            "driveway_plain": {"label": "Plain Concrete Driveway", "total": [3000, 7000], "per_sqft": [6, 12], "urgency": "can_wait"},
            "driveway_stamped": {"label": "Stamped Concrete Driveway", "total": [5000, 12000], "per_sqft": [10, 18], "urgency": "can_wait"},
            "patio_plain": {"label": "Concrete Patio", "total": [1500, 4000], "per_sqft": [6, 12], "urgency": "can_wait"},
            "patio_stamped": {"label": "Stamped Concrete Patio", "total": [2500, 7000], "per_sqft": [10, 18], "urgency": "can_wait"},
            "sidewalk": {"label": "Sidewalk (50 ft)", "total": [1000, 3000], "per_sqft": [6, 12], "urgency": "can_wait"},
            "slab_foundation": {"label": "Concrete Slab (garage/shed)", "total": [3000, 8000], "per_sqft": [5, 10], "urgency": "can_wait"},
            "retaining_wall": {"label": "Retaining Wall", "total": [3000, 10000], "per_sqft_face": [20, 50], "urgency": "can_wait"},
        },
        "commonUpsells": [
            {"item": "Colored concrete", "cost": [2, 5], "necessary": "rarely", "notes": "Per sqft. Aesthetic only."},
            {"item": "Rebar reinforcement", "cost": [1, 3], "necessary": "recommended", "notes": "Per sqft. Prevents cracking. Should be standard for driveways."},
            {"item": "Sealer application", "cost": [1, 3], "necessary": "recommended", "notes": "Per sqft. Protects finish. Reapply every 2-3 years."},
        ],
        "scopeCheckItems": scope_base + [{"key": "thickness", "label": "Concrete thickness specified", "weight": 10}, {"key": "rebar", "label": "Reinforcement (rebar/mesh) included", "weight": 10}, {"key": "gradePrep", "label": "Grading/base prep included", "weight": 8}],
    },
    "landscaping-pricing.json": {
        "metadata": {"sources": "HomeAdvisor, Angi, landscaping surveys", "baseYear": 2026},
        "stateMultipliers": s51,
        "commonJobs": {
            "sod_install": {"label": "Sod Installation", "total": [1000, 3000], "per_sqft": [1, 3], "urgency": "can_wait"},
            "landscape_design": {"label": "Landscape Design + Install", "total": [3000, 15000], "urgency": "can_wait"},
            "paver_patio": {"label": "Paver Patio", "total": [2000, 8000], "per_sqft": [10, 25], "urgency": "can_wait"},
            "retaining_wall_landscape": {"label": "Retaining Wall (landscape block)", "total": [2000, 8000], "per_sqft_face": [15, 40], "urgency": "can_wait"},
            "french_drain_yard": {"label": "French Drain (yard)", "total": [1000, 4000], "per_foot": [15, 40], "urgency": "soon"},
            "irrigation_system": {"label": "Irrigation/Sprinkler System", "total": [2000, 5000], "urgency": "can_wait"},
            "tree_removal_large": {"label": "Large Tree Removal", "total": [1000, 3000], "urgency": "varies"},
            "grading_drainage": {"label": "Yard Grading/Drainage", "total": [1000, 5000], "urgency": "soon"},
        },
        "commonUpsells": [
            {"item": "Landscape lighting", "cost": [500, 2000], "necessary": "rarely", "notes": "Aesthetic. DIY kits $100-300."},
            {"item": "Mulch delivery/spread", "cost": [200, 600], "necessary": "sometimes", "notes": "Should be included with planting."},
        ],
        "scopeCheckItems": scope_base + [{"key": "plantList", "label": "Plant species/materials listed", "weight": 10}, {"key": "grading", "label": "Grading/drainage addressed", "weight": 8}],
    },
    "garage-door-pricing.json": {
        "metadata": {"sources": "HomeAdvisor, Angi, garage door manufacturer data", "baseYear": 2026},
        "stateMultipliers": s51,
        "commonJobs": {
            "single_steel": {"label": "Single Steel Door (8x7)", "total": [800, 1500], "urgency": "soon"},
            "double_steel": {"label": "Double Steel Door (16x7)", "total": [1000, 2500], "urgency": "soon"},
            "single_insulated": {"label": "Single Insulated Door", "total": [1000, 2000], "urgency": "soon"},
            "double_insulated": {"label": "Double Insulated Door", "total": [1500, 3000], "urgency": "soon"},
            "carriage_style": {"label": "Carriage House Style", "total": [1500, 4000], "urgency": "can_wait"},
            "opener_install": {"label": "Opener Installation", "total": [300, 600], "urgency": "can_wait"},
            "spring_replacement": {"label": "Spring Replacement", "total": [200, 400], "urgency": "critical"},
            "panel_replacement": {"label": "Panel Replacement", "total": [250, 800], "urgency": "soon"},
        },
        "commonUpsells": [
            {"item": "Smart opener upgrade", "cost": [100, 200], "necessary": "rarely", "notes": "WiFi-enabled. Nice but not needed."},
            {"item": "Weatherstripping", "cost": [100, 200], "necessary": "recommended", "notes": "Insulation and pest prevention."},
        ],
        "scopeCheckItems": scope_base + [{"key": "doorType", "label": "Door type/material specified", "weight": 12}, {"key": "insulation", "label": "Insulation R-value stated", "weight": 8}],
    },
    "kitchen-pricing.json": {
        "metadata": {"sources": "HomeAdvisor, Angi, NKBA, kitchen contractor surveys", "baseYear": 2026},
        "stateMultipliers": s51,
        "commonJobs": {
            "minor_remodel": {"label": "Minor Kitchen Remodel", "total": [10000, 20000], "urgency": "can_wait", "notes": "Refinish cabinets, new counters, backsplash, paint."},
            "mid_remodel": {"label": "Mid-Range Kitchen Remodel", "total": [20000, 40000], "urgency": "can_wait", "notes": "New cabinets, counters, appliances, flooring. Same layout."},
            "major_remodel": {"label": "Major Kitchen Remodel", "total": [40000, 80000], "urgency": "can_wait", "notes": "Layout change, custom cabinets, premium materials."},
            "cabinet_reface": {"label": "Cabinet Refacing", "total": [5000, 12000], "urgency": "can_wait"},
            "countertop_granite": {"label": "Granite Countertops", "total": [2000, 5000], "per_sqft": [40, 100], "urgency": "can_wait"},
            "countertop_quartz": {"label": "Quartz Countertops", "total": [2500, 6000], "per_sqft": [50, 120], "urgency": "can_wait"},
            "backsplash": {"label": "Tile Backsplash", "total": [800, 2500], "urgency": "can_wait"},
        },
        "commonUpsells": [
            {"item": "Under-cabinet lighting", "cost": [200, 800], "necessary": "sometimes", "notes": "Nice upgrade. LED strips DIY $50-100."},
            {"item": "Soft-close hinges", "cost": [200, 500], "necessary": "sometimes", "notes": "For all cabinets. Adds quality feel."},
            {"item": "Pull-out trash/recycling", "cost": [200, 400], "necessary": "rarely", "notes": "Convenience. Not essential."},
        ],
        "scopeCheckItems": scope_base + [{"key": "designPlan", "label": "Design plan/layout included", "weight": 12}, {"key": "cabinetSpec", "label": "Cabinet grade/brand specified", "weight": 10}, {"key": "appliances", "label": "Appliances included or excluded", "weight": 10}],
    },
    "insulation-pricing.json": {
        "metadata": {"sources": "HomeAdvisor, Angi, DOE, insulation contractor surveys", "baseYear": 2026},
        "stateMultipliers": s51,
        "commonJobs": {
            "blown_in_attic": {"label": "Blown-In Attic Insulation", "total": [1000, 2500], "per_sqft": [1, 3], "urgency": "can_wait"},
            "spray_foam_attic": {"label": "Spray Foam Attic (closed cell)", "total": [3000, 7000], "per_sqft": [3, 7], "urgency": "can_wait"},
            "batt_walls": {"label": "Batt Insulation (walls)", "total": [1500, 4000], "per_sqft": [1, 3], "urgency": "can_wait"},
            "blown_in_walls": {"label": "Blown-In Wall Insulation", "total": [2000, 5000], "urgency": "can_wait"},
            "crawlspace": {"label": "Crawl Space Insulation", "total": [1500, 4000], "urgency": "can_wait"},
            "rim_joist": {"label": "Rim Joist Spray Foam", "total": [500, 1500], "urgency": "can_wait"},
        },
        "taxCredit": {"amount": "up to $1,200", "program": "IRA 25C", "notes": "30% of cost up to $1,200/year for insulation materials. Does not include labor."},
        "commonUpsells": [
            {"item": "Air sealing", "cost": [500, 1500], "necessary": "recommended", "notes": "Should be done before adding insulation. Biggest energy impact."},
            {"item": "Radiant barrier", "cost": [500, 1500], "necessary": "sometimes", "notes": "Useful in hot climates. Less value in cold climates."},
        ],
        "scopeCheckItems": scope_base + [{"key": "rValue", "label": "R-value specified", "weight": 15}, {"key": "materialType", "label": "Insulation type specified", "weight": 10}, {"key": "airSealing", "label": "Air sealing included", "weight": 10}],
    },
    "gutters-pricing.json": {
        "metadata": {"sources": "HomeAdvisor, Angi, gutter contractor surveys", "baseYear": 2026},
        "stateMultipliers": s51,
        "commonJobs": {
            "aluminum_seamless": {"label": "Seamless Aluminum Gutters", "total": [1000, 2500], "per_foot": [6, 12], "urgency": "soon"},
            "aluminum_sectional": {"label": "Sectional Aluminum Gutters", "total": [800, 2000], "per_foot": [4, 9], "urgency": "soon"},
            "copper_gutters": {"label": "Copper Gutters", "total": [3000, 8000], "per_foot": [15, 30], "urgency": "can_wait"},
            "steel_gutters": {"label": "Steel Gutters", "total": [1500, 3500], "per_foot": [8, 15], "urgency": "soon"},
            "gutter_guards": {"label": "Gutter Guards/Covers", "total": [1000, 3000], "per_foot": [5, 15], "urgency": "can_wait"},
            "gutter_repair": {"label": "Gutter Repair (section)", "total": [150, 500], "urgency": "soon"},
            "downspout_install": {"label": "Downspout Install/Reroute", "total": [100, 300], "urgency": "soon"},
        },
        "commonUpsells": [
            {"item": "Gutter guards", "cost": [5, 15], "necessary": "sometimes", "notes": "Per foot. Reduces cleaning but not maintenance-free."},
            {"item": "Heat cables", "cost": [500, 1500], "necessary": "rarely", "notes": "Only in heavy ice dam areas. High electricity cost."},
        ],
        "scopeCheckItems": scope_base + [{"key": "materialType", "label": "Gutter material specified", "weight": 12}, {"key": "size", "label": "Gutter size (5\" vs 6\")", "weight": 8}, {"key": "downspouts", "label": "Downspout count/placement", "weight": 8}],
    },
}

for name, data in verticals.items():
    path = os.path.join(OUT, name)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    jobs = len(data.get('commonJobs', {}))
    upsells = len(data.get('commonUpsells', []))
    print(f'{name}: {jobs} jobs, {upsells} upsells')

print(f'\nTotal: {len(verticals)} data files written')

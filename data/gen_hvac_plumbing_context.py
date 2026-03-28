#!/usr/bin/env python3
"""
Generate HVAC and plumbing city-specific context JSON files.
Reads cities from ../inputs/cities.csv and outputs:
  - hvac-city-context.json
  - plumbing-city-context.json

Each city gets unique, climate-aware content based on its state/region.
"""

import csv
import json
import os
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CITIES_CSV = os.path.join(SCRIPT_DIR, "..", "inputs", "cities.csv")
HVAC_OUT = os.path.join(SCRIPT_DIR, "hvac-city-context.json")
PLUMBING_OUT = os.path.join(SCRIPT_DIR, "plumbing-city-context.json")

# ──────────────────────────────────────────────────────────
# Climate zone classification by state
# ──────────────────────────────────────────────────────────
# hot: cooling-dominant, long summers
# hot_humid: hot + high humidity (Gulf/SE)
# hot_dry: hot + arid (desert SW)
# warm: mild winters, warm summers
# mixed: significant heating AND cooling
# mixed_humid: mixed + humid (mid-Atlantic/upper South)
# cold: heating-dominant, harsh winters
# cold_extreme: very cold, long winters
# marine: mild, wet (Pacific NW)
# tropical: year-round warm (Hawaii)

STATE_CLIMATE = {
    "AL": "hot_humid",   "AK": "cold_extreme", "AZ": "hot_dry",     "AR": "hot_humid",
    "CA": "mixed",       "CO": "cold",         "CT": "cold",        "DE": "mixed_humid",
    "FL": "hot_humid",   "GA": "hot_humid",    "HI": "tropical",    "ID": "cold",
    "IL": "cold",        "IN": "cold",         "IA": "cold",        "KS": "mixed",
    "KY": "mixed_humid", "LA": "hot_humid",    "ME": "cold_extreme","MD": "mixed_humid",
    "MA": "cold",        "MI": "cold_extreme",  "MN": "cold_extreme","MS": "hot_humid",
    "MO": "mixed",       "MT": "cold_extreme",  "NE": "cold",       "NV": "hot_dry",
    "NH": "cold_extreme","NJ": "mixed_humid",   "NM": "hot_dry",    "NY": "cold",
    "NC": "mixed_humid", "ND": "cold_extreme",  "OH": "cold",       "OK": "hot_humid",
    "OR": "marine",      "PA": "cold",          "RI": "cold",       "SC": "hot_humid",
    "SD": "cold_extreme","TN": "mixed_humid",   "TX": "hot_humid",  "UT": "cold",
    "VT": "cold_extreme","VA": "mixed_humid",   "WA": "marine",     "WV": "mixed_humid",
    "WI": "cold_extreme","WY": "cold_extreme",  "DC": "mixed_humid",
}

# California has sub-regions; we'll handle some cities specially
CA_HOT_CITIES = {
    "Bakersfield", "Fresno", "Sacramento", "Stockton", "Modesto",
    "Palm Springs", "Riverside", "San Bernardino", "Fontana", "Moreno Valley",
    "Corona", "Ontario", "Rancho Cucamonga", "Palmdale", "Lancaster",
    "El Centro", "Visalia", "Merced", "Redlands"
}
CA_COASTAL_CITIES = {
    "San Francisco", "San Diego", "Santa Rosa", "Santa Ana",
    "Long Beach", "Oceanside", "Oxnard", "Salinas", "Santa Clarita"
}

# Texas has sub-regions
TX_HOT_DRY_CITIES = {
    "El Paso", "Midland", "Odessa", "San Angelo", "Amarillo", "Lubbock"
}

# Water hardness by state (scale: soft, moderate, hard, very_hard)
STATE_WATER_HARDNESS = {
    "AL": "soft",       "AK": "soft",       "AZ": "very_hard", "AR": "moderate",
    "CA": "hard",       "CO": "hard",       "CT": "soft",      "DE": "moderate",
    "FL": "hard",       "GA": "soft",       "HI": "soft",      "ID": "hard",
    "IL": "hard",       "IN": "very_hard",  "IA": "hard",      "KS": "very_hard",
    "KY": "hard",       "LA": "moderate",   "ME": "soft",      "MD": "moderate",
    "MA": "soft",       "MI": "hard",       "MN": "hard",      "MS": "soft",
    "MO": "hard",       "MT": "hard",       "NE": "hard",      "NV": "very_hard",
    "NH": "soft",       "NJ": "moderate",   "NM": "very_hard", "NY": "moderate",
    "NC": "soft",       "ND": "very_hard",  "OH": "hard",      "OK": "hard",
    "OR": "soft",       "PA": "moderate",   "RI": "soft",      "SC": "soft",
    "SD": "hard",       "TN": "moderate",   "TX": "hard",      "UT": "very_hard",
    "VT": "soft",       "VA": "moderate",   "WA": "soft",      "WV": "moderate",
    "WI": "hard",       "WY": "hard",       "DC": "moderate",
}

# Dominant home era by state (affects plumbing material advice)
STATE_HOME_ERA = {
    "AL": "1970s", "AK": "1980s", "AZ": "1990s", "AR": "1970s",
    "CA": "1960s", "CO": "1980s", "CT": "1950s", "DE": "1960s",
    "FL": "1980s", "GA": "1970s", "HI": "1970s", "ID": "1990s",
    "IL": "1950s", "IN": "1960s", "IA": "1950s", "KS": "1960s",
    "KY": "1960s", "LA": "1970s", "ME": "1940s", "MD": "1960s",
    "MA": "1940s", "MI": "1950s", "MN": "1960s", "MS": "1970s",
    "MO": "1960s", "MT": "1970s", "NE": "1960s", "NV": "2000s",
    "NH": "1950s", "NJ": "1950s", "NM": "1980s", "NY": "1940s",
    "NC": "1980s", "ND": "1970s", "OH": "1950s", "OK": "1970s",
    "OR": "1970s", "PA": "1940s", "RI": "1940s", "SC": "1980s",
    "SD": "1970s", "TN": "1970s", "TX": "1980s", "UT": "1990s",
    "VT": "1940s", "VA": "1970s", "WA": "1970s", "WV": "1950s",
    "WI": "1960s", "WY": "1970s", "DC": "1940s",
}


def get_effective_climate(city, state_code):
    """Get effective climate, with city-level overrides for large states."""
    base = STATE_CLIMATE.get(state_code, "mixed")
    if state_code == "CA":
        if city in CA_HOT_CITIES:
            return "hot_dry"
        if city in CA_COASTAL_CITIES:
            return "marine"
        return base
    if state_code == "TX":
        if city in TX_HOT_DRY_CITIES:
            return "hot_dry"
        return base
    return base


# ──────────────────────────────────────────────────────────
# HVAC content generators
# ──────────────────────────────────────────────────────────

def gen_hvac_climate_note(city, state_code, climate):
    templates = {
        "hot_humid": [
            f"{city}'s extreme summer heat and humidity mean your AC runs 7-8+ months a year. High-efficiency systems pay for themselves faster here than in most of the country.",
            f"In {city}, summer temperatures regularly exceed 95\u00b0F with high humidity, putting enormous strain on cooling systems. Investing in a high-efficiency unit with a good dehumidification rating is critical.",
            f"{city} homeowners typically spend 60-70% of their HVAC energy on cooling. A properly sized, high-efficiency system can cut those costs by 30-40% compared to an aging unit.",
        ],
        "hot_dry": [
            f"{city}'s dry desert heat pushes AC systems hard from May through October. The good news: low humidity means evaporative coolers can supplement your AC and cut costs significantly.",
            f"In {city}'s arid climate, your cooling system runs heavily but doesn't fight humidity. High-SEER central AC paired with good insulation and window treatments makes the biggest difference here.",
            f"{city} sees some of the highest cooling demands in the country. A two-stage or variable-speed AC handles the extreme afternoon heat more efficiently than single-stage units.",
        ],
        "cold": [
            f"{city}'s cold winters make heating efficiency the top priority. A high-efficiency furnace (95%+ AFUE) can save $400-800/year compared to older 80% models.",
            f"In {city}, heating accounts for 50-60% of annual energy costs. Upgrading from an old furnace to a modern high-efficiency model is one of the best investments a homeowner can make.",
            f"{city} homeowners rely heavily on heating from November through March. Proper furnace sizing matters \u2014 an oversized unit cycles too frequently and wastes energy.",
        ],
        "cold_extreme": [
            f"{city}'s harsh winters with temperatures well below zero demand a reliable, high-efficiency heating system. A 96%+ AFUE furnace is the standard recommendation for this climate.",
            f"In {city}, winters are long and brutal \u2014 your heating system is your most critical home appliance. Don't skimp on furnace quality; breakdowns in sub-zero weather are dangerous.",
            f"{city} sees some of the coldest temperatures in the lower 48. Dual-fuel systems (heat pump + gas furnace backup) are gaining popularity for their efficiency in moderate cold while maintaining gas reliability for extreme days.",
        ],
        "mixed": [
            f"{city} has true four-season weather, so your HVAC system needs to heat and cool effectively. A heat pump or dual-fuel system often provides the best balance of comfort and efficiency.",
            f"In {city}, you'll use both heating and cooling roughly equally throughout the year. That makes system efficiency on both sides important when choosing a replacement.",
            f"{city}'s mixed climate means your HVAC works year-round. A properly matched system \u2014 not oversized \u2014 handles both summer cooling and winter heating more efficiently.",
        ],
        "mixed_humid": [
            f"{city}'s humid summers and cool winters require an HVAC system that handles both moisture control and heating. A heat pump with good dehumidification is often the ideal choice here.",
            f"In {city}, summer humidity is as much a comfort issue as temperature. Choose a system with variable-speed technology for better moisture removal without overcooling.",
            f"{city} homeowners need solid cooling capacity for humid summers and reliable heat for winter. A dual-fuel system gives you the best of both worlds \u2014 efficient heat pump operation in mild cold, gas furnace for deep freezes.",
        ],
        "marine": [
            f"{city}'s mild, damp climate is ideal for heat pumps \u2014 they operate at peak efficiency in the moderate temperature range typical of the Pacific Northwest.",
            f"In {city}, you rarely see temperature extremes, making a heat pump the most cost-effective HVAC choice. Many homeowners here skip gas furnaces entirely.",
            f"{city}'s maritime climate means moderate heating needs and minimal AC usage. A ductless mini-split or heat pump system is often the most efficient option.",
        ],
        "tropical": [
            f"{city}'s year-round warm climate means cooling is your primary concern. A high-SEER central AC or ductless mini-split system keeps costs manageable in the tropical heat.",
            f"In {city}, you'll run cooling most of the year. Energy-efficient systems with good humidity control are essential for comfort and keeping electric bills reasonable.",
        ],
    }
    options = templates.get(climate, templates["mixed"])
    return options[hash(city + "climate") % len(options)]


def gen_hvac_system_tip(city, state_code, climate):
    templates = {
        "hot_humid": [
            f"In {city}'s hot, humid climate, look for at least 16 SEER (or SEER2 equivalent) for meaningful energy savings. A heat pump handles mild winters efficiently while providing strong AC in summer.",
            f"For {city} homes, a 16+ SEER heat pump with a variable-speed air handler gives you the best combination of cooling power and dehumidification. Skip single-stage units \u2014 they can't keep up with humidity.",
            f"In {city}, a two-stage or variable-speed AC system runs longer at lower capacity, removing more humidity and using less energy than a single-stage unit cycling on and off.",
        ],
        "hot_dry": [
            f"In {city}'s dry climate, a standard 16+ SEER AC is ideal. You don't need enhanced dehumidification, but look for a unit with a high EER rating for peak desert heat performance.",
            f"For {city} homes, consider pairing a central AC with a whole-house fan for shoulder-season cooling. When the dry evening air drops to comfortable temperatures, you can cut AC costs significantly.",
            f"A two-stage AC performs well in {city}'s dry heat. It runs at low capacity during mild days and ramps up only during peak afternoon heat, reducing energy use by 20-30%.",
        ],
        "cold": [
            f"In {city}, a high-efficiency gas furnace (95%+ AFUE) paired with a moderate-SEER AC (14-16) gives you the best value. Heating is your biggest expense, so prioritize furnace efficiency.",
            f"For {city} homes, consider a dual-fuel system: a heat pump for efficient heating above 35\u00b0F and a gas furnace for the coldest days. It can cut heating costs 20-30% compared to gas-only.",
            f"In {city}, invest more in furnace quality than AC features. A two-stage furnace with an ECM blower motor runs quieter, distributes heat more evenly, and uses less electricity than a standard model.",
        ],
        "cold_extreme": [
            f"In {city}'s extreme cold, a gas furnace rated 96%+ AFUE is the safest choice. Standard heat pumps lose efficiency below 20\u00b0F, though cold-climate heat pumps now work down to -15\u00b0F.",
            f"For {city} homes, a modulating gas furnace provides the best comfort in sub-zero weather. It adjusts output continuously rather than cycling on/off, maintaining even temperatures and reducing energy waste.",
            f"In {city}, prioritize furnace reliability and BTU capacity. Undersizing is risky in extreme cold. Get a proper Manual J load calculation \u2014 don't let contractors just match the old unit's size.",
        ],
        "mixed": [
            f"In {city}'s four-season climate, a heat pump often provides the best year-round efficiency. For moderate winters, it handles both heating and cooling in one system, simplifying maintenance.",
            f"For {city} homes, a 15-16 SEER heat pump or dual-fuel system balances heating and cooling needs well. If you have natural gas, a dual-fuel system gives you the most flexibility.",
            f"{city}'s mixed climate makes a dual-fuel system attractive: the heat pump runs efficiently in mild cold (saving on gas), and the furnace kicks in when temperatures drop below 30-35\u00b0F.",
        ],
        "mixed_humid": [
            f"In {city}'s humid climate, a heat pump with variable-speed technology handles heating, cooling, and dehumidification efficiently. Look for 16+ SEER for the cooling season.",
            f"For {city} homes, consider a communicating system where the thermostat, air handler, and outdoor unit coordinate automatically. This technology excels in mixed-humid climates by optimizing humidity control.",
            f"In {city}, a heat pump is increasingly the go-to recommendation. Modern units work efficiently down to 25-30\u00b0F, which covers most of your winter, with gas backup only for the coldest nights.",
        ],
        "marine": [
            f"In {city}'s mild climate, a heat pump is the clear winner. With moderate temperatures year-round, heat pumps operate at peak efficiency. Look for a 15+ SEER model with a good HSPF rating.",
            f"For {city} homes, a ductless mini-split heat pump is increasingly popular. They're efficient, provide zone control, and avoid the energy losses of ductwork \u2014 perfect for the Pacific Northwest.",
            f"In {city}, you may not need a gas furnace at all. A heat pump handles the mild winters efficiently, and a supplemental electric strip heater covers the rare deep-freeze event.",
        ],
        "tropical": [
            f"In {city}'s tropical climate, go for the highest SEER you can afford \u2014 18+ SEER systems pay for themselves quickly when you're cooling year-round. Ductless mini-splits offer excellent zone control.",
            f"For {city} homes, a ductless mini-split system with multiple indoor heads lets you cool only the rooms you're using, a major energy saver in a climate where AC runs nearly 365 days a year.",
        ],
    }
    options = templates.get(climate, templates["mixed"])
    return options[hash(city + "systip") % len(options)]


def gen_hvac_season_note(city, state_code, climate):
    templates = {
        "hot_humid": [
            f"Schedule HVAC replacements in late fall or winter when {city} contractors are less busy. Summer is peak season \u2014 you'll wait longer and may pay a premium for emergency installs.",
            f"The best time to replace your HVAC in {city} is October through February. Contractors offer off-season pricing and can schedule sooner. Avoid June-September when demand spikes.",
            f"In {city}, get your AC serviced in early spring before the heat arrives. If it needs replacing, scheduling in fall gives you the best prices and widest contractor availability.",
        ],
        "hot_dry": [
            f"In {city}, schedule AC replacements between November and March when demand is lowest. Desert summer breakdowns are miserable \u2014 don't wait for a failure in 110\u00b0F heat.",
            f"The ideal window for HVAC work in {city} is late fall through early spring. Contractors are more available and some offer 5-10% off-season discounts.",
            f"Plan ahead in {city}: get your AC inspected in March before temperatures climb. If replacement is needed, you'll have time to get multiple bids before the summer rush.",
        ],
        "cold": [
            f"In {city}, late summer and early fall are the best times to replace a furnace \u2014 before the heating season rush. Spring is ideal for AC replacements before summer demand picks up.",
            f"Schedule furnace replacements in {city} between August and October. Waiting until the first cold snap means competing with every other homeowner whose system just failed.",
            f"{city} HVAC contractors are busiest December through February for heating and June through August for cooling. Book your replacement during the shoulder seasons for better pricing and faster scheduling.",
        ],
        "cold_extreme": [
            f"In {city}, replace your furnace in late summer before the cold sets in. A mid-winter furnace failure is an emergency \u2014 you'll pay rush pricing and have fewer options.",
            f"The best time for furnace work in {city} is September through October. Contractors are transitioning from AC to heating season and often have capacity. Spring (April-May) works for AC replacements.",
            f"Don't gamble on an aging furnace in {city}'s winters. If your system is 15+ years old, schedule a replacement in early fall when you can plan rather than panic.",
        ],
        "mixed": [
            f"In {city}, the shoulder seasons (spring and fall) offer the best timing for HVAC replacements. Contractors are less swamped between heating and cooling peaks, and you may find better pricing.",
            f"Schedule HVAC work in {city} during April-May or September-October for the shortest wait times. Mid-summer and mid-winter are peak emergency periods with premium pricing.",
        ],
        "mixed_humid": [
            f"In {city}, early spring or late fall are the sweet spots for HVAC replacement. You'll dodge both the summer cooling rush and winter heating emergencies.",
            f"Schedule HVAC replacements in {city} during October-November or March-April. These shoulder seasons give you better contractor availability and sometimes off-season discounts.",
        ],
        "marine": [
            f"In {city}, HVAC demand is more spread out than in extreme climates. Still, fall is the best time for heat pump installations before the wet, cool winter season arrives.",
            f"Schedule heat pump replacements in {city} during late summer or early fall. The mild climate means less urgency, but planning ahead still gets you better pricing and scheduling.",
        ],
        "tropical": [
            f"In {city}, there's no true off-season for AC work since you cool year-round. However, January through March tends to be slightly less busy \u2014 schedule replacements then if possible.",
            f"AC demand in {city} is steady year-round, but contractors report slightly more availability in early spring. Don't wait for a breakdown in peak heat to start shopping.",
        ],
    }
    options = templates.get(climate, templates["mixed"])
    return options[hash(city + "season") % len(options)]


def gen_hvac_local_insight(city, state_code, climate):
    templates = {
        "hot_humid": [
            f"{city} contractors are busiest June through September. Book early spring installations to avoid the rush and potential summer breakdowns when you need AC most.",
            f"Many {city} homes still have older R-22 refrigerant systems. If yours is one of them, now is the time to upgrade \u2014 R-22 is phased out and repair costs are skyrocketing.",
            f"In {city}, check if your utility offers rebates for high-efficiency HVAC installations. Many local programs offer $300-1,500 back on qualifying systems.",
        ],
        "hot_dry": [
            f"{city} homeowners should ensure their outdoor AC condenser is shaded from direct afternoon sun. A shade structure can improve efficiency by 5-10% in extreme desert heat.",
            f"Dust and sand are hard on HVAC systems in {city}. Change filters monthly during dusty seasons and schedule annual coil cleaning to maintain efficiency.",
            f"In {city}, proper attic insulation is as important as the HVAC unit itself. Many homes here have inadequate insulation, forcing the AC to work much harder than necessary.",
        ],
        "cold": [
            f"In {city}, make sure your contractor performs a Manual J load calculation for sizing. A properly sized furnace is critical for efficiency and comfort in cold climates.",
            f"Many {city} homes have ductwork in unconditioned spaces (attics or crawlspaces). Sealing and insulating ducts can improve heating efficiency by 20-30%, sometimes more than upgrading the furnace itself.",
            f"{city} homeowners should consider a programmable or smart thermostat with their new system. Setting back temperatures while away or sleeping can save 10-15% on heating bills.",
        ],
        "cold_extreme": [
            f"In {city}, a furnace failure in January can be dangerous. Keep an emergency plan: know a reliable HVAC company, consider a backup heat source, and don't ignore warning signs like strange noises or uneven heating.",
            f"{city} homeowners should have their furnace inspected every fall before the season starts. A tune-up catches small issues before they become mid-winter emergencies.",
            f"If you're in {city}, make sure your new furnace installation includes proper combustion air supply and venting. High-efficiency condensing furnaces require specific venting that differs from older units.",
        ],
        "mixed": [
            f"{city} homeowners benefit from annual HVAC tune-ups: AC in spring, heating in fall. Catching small issues early prevents expensive breakdowns during peak demand.",
            f"In {city}, ask contractors about heat pump options even if you currently have a gas furnace. Modern heat pumps work well in mixed climates and may qualify for federal tax credits up to $2,000.",
            f"Many {city} homes can cut HVAC costs 15-20% just by sealing air leaks and adding insulation. Ask your contractor about a home energy audit before sizing a new system.",
        ],
        "mixed_humid": [
            f"In {city}, humidity control is as important as temperature. A variable-speed system runs longer at lower capacity, removing more moisture from the air and improving comfort.",
            f"{city} homeowners should check if their ductwork is properly sealed and insulated. In humid climates, leaky ducts can introduce moisture into walls and cause mold issues.",
            f"Ask {city} contractors about the federal energy tax credit \u2014 heat pumps meeting CEE Tier requirements can qualify for up to $2,000, and high-efficiency furnaces up to $600.",
        ],
        "marine": [
            f"{city}'s mild climate makes this one of the best markets for heat pumps in the country. Many homeowners are switching from gas furnaces and seeing 30-40% energy savings.",
            f"In {city}, ductless mini-splits are increasingly popular for older homes without existing ductwork. They're efficient, quiet, and provide room-by-room temperature control.",
            f"{city} utilities often offer significant heat pump rebates. Check with your local utility before buying \u2014 incentives can reduce the upfront cost by $1,000-3,000 or more.",
        ],
        "tropical": [
            f"In {city}, salt air can corrode outdoor AC condensers faster than on the mainland. Look for units with coated coils and schedule annual cleaning to extend equipment life.",
            f"{city} homeowners should prioritize SEER rating above almost everything else. With year-round cooling needs, every point of SEER efficiency translates to meaningful annual savings.",
        ],
    }
    options = templates.get(climate, templates["mixed"])
    return options[hash(city + "local") % len(options)]


# ──────────────────────────────────────────────────────────
# Plumbing content generators
# ──────────────────────────────────────────────────────────

def get_freeze_risk(state_code, climate):
    """Return freeze risk level: high, moderate, low, very_low."""
    if climate in ("cold_extreme",):
        return "high"
    if climate in ("cold",):
        return "moderate_high"
    if climate in ("mixed", "mixed_humid", "marine"):
        return "moderate"
    if climate in ("hot_humid", "hot_dry"):
        return "low"
    if climate in ("tropical",):
        return "very_low"
    return "moderate"


def gen_plumbing_water_note(city, state_code, climate):
    hardness = STATE_WATER_HARDNESS.get(state_code, "moderate")
    templates = {
        "very_hard": [
            f"{city} has very hard water, which accelerates mineral buildup in water heaters and reduces their lifespan by 2-4 years. A whole-house water softener or tankless unit with a descaling system is strongly recommended.",
            f"The extremely hard water in {city} causes heavy scale buildup in pipes and appliances. Water heaters, dishwashers, and faucets all suffer. A water softener is practically a necessity here.",
            f"Hard water is a major issue in {city}. If you notice white crusty deposits on faucets, your water heater is fighting the same buildup inside. A softener system typically costs $1,000-2,500 installed and protects all your plumbing.",
        ],
        "hard": [
            f"{city} has moderately hard water which can reduce water heater lifespan over time. Consider a water softener or tankless unit with a descaling system to protect your investment.",
            f"The water in {city} is on the harder side. You may notice mineral spots on fixtures. For water heaters, this means flushing the tank annually is essential to prevent sediment buildup.",
            f"Hard water in {city} can shorten water heater life and reduce efficiency. Annual tank flushing helps, but a water softener is the best long-term solution for protecting all your plumbing fixtures.",
        ],
        "moderate": [
            f"{city} has moderate water hardness \u2014 not extreme, but enough to warrant annual water heater flushing. A whole-house filter can improve taste and reduce minor buildup in pipes and fixtures.",
            f"Water quality in {city} is moderate. You probably won't need a softener, but flushing your water heater tank once a year prevents sediment accumulation and keeps it running efficiently.",
            f"The water in {city} is moderately hard. Most plumbing systems handle it fine, but if you're installing a new tankless water heater, ask about the warranty requirements \u2014 some require a water treatment system.",
        ],
        "soft": [
            f"{city} benefits from relatively soft water, which is easy on plumbing fixtures and water heaters. You'll get longer appliance life and fewer mineral deposits than homeowners in hard-water areas.",
            f"The soft water in {city} is a plus for plumbing longevity. Water heaters last longer and pipes stay cleaner. Focus your plumbing budget on other priorities like pipe material and drainage.",
            f"{city}'s soft water means less mineral buildup in your plumbing system. You generally don't need a water softener, though a basic sediment filter can improve water quality and protect fixtures.",
        ],
    }
    options = templates.get(hardness, templates["moderate"])
    return options[hash(city + "water") % len(options)]


def gen_plumbing_freeze_risk(city, state_code, climate):
    risk = get_freeze_risk(state_code, climate)
    templates = {
        "high": [
            f"{city}'s severe winters make frozen pipes a serious risk. Insulate all exposed pipes, especially in crawlspaces and exterior walls. Keep cabinet doors open during deep freezes and know your main shutoff valve location.",
            f"Frozen and burst pipes are a real threat in {city}. Ensure pipes in unheated areas are insulated with foam sleeves, and consider heat tape for vulnerable runs. A single burst pipe can cause $5,000+ in water damage.",
            f"In {city}, pipe freeze prevention is essential. Disconnect outdoor hoses before the first freeze, insulate exposed pipes, and never let your thermostat drop below 55\u00b0F \u2014 even when away. Burst pipe repairs average $1,500-3,000.",
        ],
        "moderate_high": [
            f"{city} gets cold enough for frozen pipes to be a regular concern. Insulate pipes in crawlspaces, garages, and exterior walls. When temperatures drop below 20\u00b0F, let faucets drip slightly overnight.",
            f"Frozen pipes happen in {city} most winters. The most vulnerable spots are pipes in exterior walls, unheated basements, and garages. Pipe insulation is cheap ($0.50-1/ft) and prevents expensive burst-pipe repairs.",
            f"In {city}, pipe freezing is a moderate-to-high risk during the coldest months. Make sure you know where your main water shutoff valve is \u2014 quick action when a pipe bursts can save thousands in damage.",
        ],
        "moderate": [
            f"{city} occasionally sees freezing temperatures that can threaten exposed pipes. Basic insulation on outdoor spigots and crawlspace pipes is a smart, inexpensive precaution.",
            f"While {city} doesn't see extreme cold regularly, freezing temps do occur. Insulate outdoor faucets and any pipes in unheated spaces. Disconnect garden hoses before the first frost.",
            f"Freeze risk in {city} is moderate but shouldn't be ignored. A few nights below freezing each winter can burst an unprotected pipe. Basic pipe insulation and frost-free hose bibs are inexpensive insurance.",
        ],
        "low": [
            f"{city} rarely freezes, but when it does, exposed pipes are especially vulnerable because homes here aren't built for cold weather. Insulate outdoor pipes and know your shutoff valve location just in case.",
            f"Freezing is uncommon in {city}, but the risk isn't zero. During rare cold snaps, homes here are actually MORE vulnerable because plumbing isn't typically winterized. Keep pipe insulation on hand for outdoor runs.",
            f"While freeze events are rare in {city}, they can catch homeowners off guard. The 2021 winter storm showed that even warm-climate homes need basic freeze protection for exposed pipes and outdoor fixtures.",
        ],
        "very_low": [
            f"Freezing pipes aren't a concern in {city}'s tropical climate. Focus your plumbing maintenance on corrosion prevention, water heater efficiency, and drainage \u2014 the issues that actually affect homes here.",
            f"{city}'s warm year-round climate means frozen pipes are essentially a non-issue. Your plumbing priorities should be water heater maintenance, drain care, and watching for corrosion from humidity and salt air.",
        ],
    }
    options = templates.get(risk, templates["moderate"])
    return options[hash(city + "freeze") % len(options)]


def gen_plumbing_material_tip(city, state_code, climate):
    risk = get_freeze_risk(state_code, climate)
    hardness = STATE_WATER_HARDNESS.get(state_code, "moderate")

    # Tailor material recommendation based on climate and water
    if risk in ("high", "moderate_high"):
        templates = [
            f"PEX piping is the top recommendation for repiping in {city}. It's flexible, resists freezing better than rigid pipes (it expands slightly), and typically costs 30-40% less than copper to install.",
            f"For {city} homes, PEX is the go-to repiping material. Its flexibility means it handles freeze-thaw cycles better than copper or CPVC. It's also faster to install, reducing labor costs.",
            f"In {city}'s cold climate, PEX piping offers a key advantage: it can expand slightly when water freezes inside, making it more resistant to burst pipes than rigid copper or CPVC.",
        ]
    elif hardness in ("very_hard", "hard"):
        templates = [
            f"PEX piping is the most popular repipe material in {city}. It resists mineral scale buildup better than copper in hard-water areas and typically costs 30-40% less to install.",
            f"For {city}'s hard water, PEX piping is ideal \u2014 it doesn't corrode or develop pinhole leaks like copper can in mineral-rich water. It's also the most cost-effective option for whole-house repiping.",
            f"In {city}, copper piping can develop pinhole leaks over time due to hard water. PEX is increasingly the preferred alternative \u2014 it's corrosion-resistant, flexible, and more affordable.",
        ]
    else:
        templates = [
            f"PEX piping is the most popular repipe material in {city}. It's flexible, quiet, and typically costs 30-40% less than copper. Copper remains a good choice if you prefer the durability and resale appeal.",
            f"For repiping in {city}, PEX is the value pick and copper is the premium choice. Both work well in your climate. PEX installs faster (lower labor cost), while copper has a longer track record.",
            f"Most {city} plumbers now recommend PEX for whole-house repiping. It's code-compliant, durable, and significantly cheaper than copper. The main exception: some homeowners prefer copper for its longevity and perceived quality.",
        ]

    return templates[hash(city + "material") % len(templates)]


def gen_plumbing_local_insight(city, state_code, climate):
    era = STATE_HOME_ERA.get(state_code, "1970s")
    era_int = int(era.replace("s", ""))
    hardness = STATE_WATER_HARDNESS.get(state_code, "moderate")

    if era_int <= 1960:
        templates = [
            f"Many {city} homes built before 1970 have galvanized steel pipes that corrode from the inside out. If your water pressure has been steadily dropping or you see rusty water, a whole-house repipe is likely needed.",
            f"Older homes in {city} (pre-1970) often have galvanized or cast iron drain pipes that deteriorate over decades. A camera inspection ($150-300) can reveal hidden corrosion before it causes a major leak or backup.",
            f"If your {city} home was built before 1960, there's a good chance it has original galvanized pipes. These typically last 40-60 years, meaning many are past their lifespan. Watch for discolored water and low pressure as warning signs.",
        ]
    elif era_int <= 1980:
        templates = [
            f"Many {city} homes built in the 1970s-80s have polybutylene (gray plastic) water pipes, which are prone to unexpected failures. If your home has them, most plumbers recommend proactive repiping before a catastrophic leak.",
            f"Homes built in {city} during the 1970s-80s often have copper pipes that may be developing pinhole leaks after 40+ years. If you're seeing green staining at joints, it's time for an inspection.",
            f"In {city}, homes from the 1970s-80s era are hitting the age where original plumbing starts failing. Water heaters last 8-12 years, and supply pipes 40-60 years. If you're in that window, budget for upgrades.",
        ]
    else:
        templates = [
            f"Most newer {city} homes (built after 1990) have CPVC or PEX supply lines that are still relatively young. Focus your plumbing budget on water heater maintenance and drain cleaning rather than repiping.",
            f"If your {city} home was built in the 1990s or later, your supply pipes are likely in good shape. The most common plumbing issues in newer homes here are water heater replacements and fixture upgrades.",
            f"{city}'s newer housing stock means most homes don't need repiping yet. Your biggest plumbing expense is likely water heater replacement ($1,200-3,500) or upgrading to a tankless unit for endless hot water.",
        ]

    return templates[hash(city + "plumblocal") % len(templates)]


# ──────────────────────────────────────────────────────────
# Main generation logic
# ──────────────────────────────────────────────────────────

def main():
    # Read cities
    cities = []
    with open(CITIES_CSV, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cities.append({
                "city": row["city"].strip(),
                "state": row["state"].strip(),
                "state_code": row["state_code"].strip(),
            })

    print(f"Loaded {len(cities)} cities from {CITIES_CSV}")

    hvac_context = {}
    plumbing_context = {}

    for c in cities:
        city = c["city"]
        sc = c["state_code"]
        climate = get_effective_climate(city, sc)
        key = f"{city}|{sc}"

        hvac_context[key] = {
            "climateNote": gen_hvac_climate_note(city, sc, climate),
            "systemTip": gen_hvac_system_tip(city, sc, climate),
            "seasonNote": gen_hvac_season_note(city, sc, climate),
            "localInsight": gen_hvac_local_insight(city, sc, climate),
        }

        plumbing_context[key] = {
            "waterNote": gen_plumbing_water_note(city, sc, climate),
            "freezeRisk": gen_plumbing_freeze_risk(city, sc, climate),
            "materialTip": gen_plumbing_material_tip(city, sc, climate),
            "localInsight": gen_plumbing_local_insight(city, sc, climate),
        }

    # Write HVAC context
    with open(HVAC_OUT, "w", encoding="utf-8") as f:
        json.dump(hvac_context, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(hvac_context)} HVAC entries to {HVAC_OUT}")

    # Write plumbing context
    with open(PLUMBING_OUT, "w", encoding="utf-8") as f:
        json.dump(plumbing_context, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(plumbing_context)} plumbing entries to {PLUMBING_OUT}")

    # Sanity checks
    assert len(hvac_context) == len(cities), f"HVAC entries ({len(hvac_context)}) != cities ({len(cities)})"
    assert len(plumbing_context) == len(cities), f"Plumbing entries ({len(plumbing_context)}) != cities ({len(cities)})"

    # Verify no empty fields
    for key, val in hvac_context.items():
        for field in ("climateNote", "systemTip", "seasonNote", "localInsight"):
            assert val[field], f"Empty HVAC {field} for {key}"
    for key, val in plumbing_context.items():
        for field in ("waterNote", "freezeRisk", "materialTip", "localInsight"):
            assert val[field], f"Empty plumbing {field} for {key}"

    print("All checks passed!")


if __name__ == "__main__":
    main()

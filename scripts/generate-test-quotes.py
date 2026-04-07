#!/usr/bin/env python3
"""Generate realistic test quote images for all verticals."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'test-quotes')
os.makedirs(OUT, exist_ok=True)

try:
    fb = ImageFont.truetype("arial.ttf", 16)
    fr = ImageFont.truetype("arial.ttf", 13)
    fs = ImageFont.truetype("arial.ttf", 11)
    ft = ImageFont.truetype("arial.ttf", 20)
except:
    fb = fr = fs = ft = ImageFont.load_default()

def make_quote(filename, company, location, title, items, totals, extras=None, w=850, h=None):
    """Generate a quote image."""
    # Calculate height
    if h is None:
        h = 200 + len(items) * 22 + len(totals) * 20 + (len(extras) * 18 if extras else 0) + 100
    img = Image.new('RGB', (w, h), '#ffffff')
    draw = ImageDraw.Draw(img)

    y = 25
    # Header
    draw.rectangle([0, 0, w, 60], fill='#1e3a5f')
    draw.text((30, 15), company, fill='white', font=ft)
    draw.text((30, 40), location, fill='#93c5fd', font=fs)

    y = 75
    draw.text((30, y), title, fill='#1e3a5f', font=ft); y += 35

    # Table header
    draw.rectangle([20, y, w-20, y+25], fill='#e2e8f0')
    cols = [30, 450, 550, 650, 750]
    headers = ["Description", "Qty", "Unit Price", "Amount"]
    for i, h_text in enumerate(headers):
        draw.text((cols[i], y+6), h_text, fill='#1e3a5f', font=fs)
    y += 30

    # Line items
    for item in items:
        for i, val in enumerate(item):
            if i < len(cols):
                draw.text((cols[i], y), str(val), fill='#333', font=fs)
        y += 22

    # Separator
    y += 5
    draw.line([(20, y), (w-20, y)], fill='#1e3a5f', width=2)
    y += 10

    # Totals
    for label, val in totals:
        bold = "TOTAL" in label.upper()
        f = fb if bold else fr
        draw.text((450, y), label, fill='#1e3a5f' if bold else '#333', font=f)
        draw.text((700, y), val, fill='#1e3a5f' if bold else '#333', font=f)
        y += 22

    # Extras
    if extras:
        y += 15
        for line in extras:
            draw.text((30, y), line, fill='#64748b', font=fs)
            y += 18

    img.save(os.path.join(OUT, filename), 'PNG')
    print(f'  {filename}: {img.size}')

# ===== HVAC QUOTE =====
make_quote('test-hvac-quote.png',
    'COMFORT AIR SOLUTIONS', 'Raleigh, NC 27601 | License #12345-HVAC',
    'HVAC REPLACEMENT ESTIMATE',
    [
        ("Trane XR16 Heat Pump 3.5 ton, 16 SEER", "1", "$4,200.00", "$4,200.00"),
        ("Air Handler with Variable Speed Blower", "1", "$2,100.00", "$2,100.00"),
        ("Honeywell T6 Pro Thermostat", "1", "$185.00", "$185.00"),
        ("Refrigerant Line Set (50ft copper)", "1", "$450.00", "$450.00"),
        ("Electrical Disconnect & Wiring", "1", "$275.00", "$275.00"),
        ("Equipment Pad (composite)", "1", "$85.00", "$85.00"),
        ("Condensate Drain & Safety Switch", "1", "$120.00", "$120.00"),
        ("Filter Rack & Merv-11 Filter", "1", "$95.00", "$95.00"),
        ("UV Light Air Purifier (RGF REME HALO)", "1", "$850.00", "$850.00"),
        ("Duct Cleaning (whole house)", "1", "$450.00", "$450.00"),
        ("Permit & Inspection", "1", "$175.00", "$175.00"),
        ("Old System Removal & Disposal", "1", "$250.00", "$250.00"),
        ("Labor (estimated 8 hours @ $150/hr)", "", "", "$1,200.00"),
    ],
    [
        ("Subtotal", "$10,435.00"),
        ("Tax (4.75%)", "$496.66"),
        ("TOTAL ESTIMATE", "$10,931.66"),
    ],
    [
        "System: Trane XR16, 16 SEER, 3.5 Ton Heat Pump",
        "Warranty: 10-year parts (registered), 2-year labor",
        "Payment: 50% deposit, balance on completion",
        "Estimate valid for 30 days",
        "No Manual J load calculation included",
    ]
)

# ===== PLUMBING QUOTE =====
make_quote('test-plumbing-quote.png',
    'RELIABLE PLUMBING CO', 'Charlotte, NC 28205 | License #P-4521',
    'PLUMBING REPAIR ESTIMATE',
    [
        ("Tankless Water Heater (Rinnai RU199iN)", "1", "$1,850.00", "$1,850.00"),
        ("Gas Line Extension (10ft)", "1", "$350.00", "$350.00"),
        ("Venting Kit (Category III SS)", "1", "$425.00", "$425.00"),
        ("Condensate Drain Line", "1", "$125.00", "$125.00"),
        ("Water Line Connections", "1", "$175.00", "$175.00"),
        ("Electrical Outlet (dedicated 120V)", "1", "$225.00", "$225.00"),
        ("Old Water Heater Removal", "1", "$150.00", "$150.00"),
        ("Permit", "1", "$125.00", "$125.00"),
        ("Expansion Tank (recommended)", "1", "$285.00", "$285.00"),
        ("Whole House Water Filter", "1", "$650.00", "$650.00"),
        ("Labor (6 hours @ $135/hr)", "", "", "$810.00"),
    ],
    [
        ("Subtotal", "$5,170.00"),
        ("Tax (7.25%)", "$374.83"),
        ("TOTAL", "$5,544.83"),
    ],
    [
        "Material: Rinnai RU199iN, 199,000 BTU Natural Gas",
        "Warranty: 12-year heat exchanger, 5-year parts, 1-year labor",
        "Pipe material: PEX connections to existing copper",
    ]
)

# ===== ELECTRICAL QUOTE =====
make_quote('test-electrical-quote.png',
    'SPARK ELECTRIC LLC', 'Atlanta, GA 30301 | License #EN-7832',
    'ELECTRICAL PANEL UPGRADE ESTIMATE',
    [
        ("200 Amp Main Breaker Panel (Square D)", "1", "$850.00", "$850.00"),
        ("200 Amp Meter Base", "1", "$350.00", "$350.00"),
        ("Main Breaker (200A)", "1", "$175.00", "$175.00"),
        ("Branch Circuit Breakers (20)", "20", "$25.00", "$500.00"),
        ("GFCI Breakers (kitchen, bath)", "4", "$65.00", "$260.00"),
        ("AFCI Breakers (bedrooms)", "4", "$45.00", "$180.00"),
        ("Grounding Rod & Bonding", "1", "$225.00", "$225.00"),
        ("Wire, Connectors, Hardware", "1", "$350.00", "$350.00"),
        ("Surge Protector (whole house)", "1", "$375.00", "$375.00"),
        ("Smart Light Switches (4-pack)", "1", "$280.00", "$280.00"),
        ("Permit & Inspection", "1", "$200.00", "$200.00"),
        ("Labor (Master Electrician, 10 hrs)", "", "", "$1,800.00"),
    ],
    [
        ("Subtotal", "$5,545.00"),
        ("Tax (4%)", "$221.80"),
        ("TOTAL", "$5,766.80"),
    ],
    [
        "Upgrade: 100 Amp to 200 Amp Service",
        "NEC 2023 compliant",
        "Warranty: 1-year labor, manufacturer warranty on parts",
        "Licensed Master Electrician: GA #EN-7832",
    ]
)

# ===== PAINTING QUOTE =====
make_quote('test-painting-quote.png',
    'PREMIER PAINTING SERVICES', 'Denver, CO 80202',
    'INTERIOR PAINTING ESTIMATE',
    [
        ("Living Room (16x20, walls + ceiling)", "1", "", "$850.00"),
        ("Kitchen (12x14, walls only)", "1", "", "$620.00"),
        ("Master Bedroom (14x16, walls + ceiling)", "1", "", "$780.00"),
        ("Bedroom 2 (12x12, walls + ceiling)", "1", "", "$580.00"),
        ("Bedroom 3 (10x12, walls + ceiling)", "1", "", "$520.00"),
        ("Hallway & Stairwell", "1", "", "$450.00"),
        ("Trim & Baseboards (whole house)", "1", "", "$1,200.00"),
        ("Paint: Sherwin-Williams Duration (14 gal)", "14", "$65.00", "$910.00"),
        ("Primer: SW PrimeRx (4 gal, bare patches)", "4", "$45.00", "$180.00"),
        ("Color Consultation", "1", "", "$200.00"),
        ("Prep: sanding, patching, caulking", "", "", "Included"),
        ("Furniture Moving & Protection", "", "", "Included"),
        ("Cleanup", "", "", "Included"),
    ],
    [
        ("Materials", "$1,090.00"),
        ("Labor", "$5,000.00"),
        ("Subtotal", "$6,290.00"),
        ("Tax (2.9% on materials)", "$31.61"),
        ("TOTAL", "$6,321.61"),
    ],
    [
        "Paint: Sherwin-Williams Duration (premium), 2 coats",
        "5 rooms + hallway + all trim/baseboards",
        "Estimated timeline: 5-6 days",
        "Warranty: 3-year workmanship",
        "Prep work included at no extra charge",
        "Home built 1985 - lead paint testing NOT included",
    ]
)

print(f'\nGenerated 4 test quotes in {OUT}/')

"""
Generate 3-quote comparison sets for the 12 verticals missing from the
original generate-comparison-sets.py: foundation, fencing, garage-door,
gutters, insulation, kitchen, landscaping, painting, siding, windows,
concrete, moving.

Data-driven: each vertical defines a scenario (the same job from 3
providers at low/mid/high price points) and a builder helper turns it
into a realistic-looking PNG quote with header, line items, totals,
and small print.

All names, addresses, phones, license numbers are fully fake.
"""
import os, sys, io
from PIL import Image, ImageDraw, ImageFont

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_font(size, bold=False):
    cands = [
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\timesbd.ttf" if bold else "C:\\Windows\\Fonts\\times.ttf",
    ]
    for p in cands:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()


def render_quote(out_path, header, customer_lines, line_items, totals, footer_lines):
    """Render a quote-style document.

    header: list of (text, kind) tuples for the company header
    customer_lines: list of plain strings (customer/job context)
    line_items: list of (description, amount_str) tuples
    totals: list of (label, amount_str) tuples (subtotal, tax, total)
    footer_lines: list of small print strings
    """
    width = 850
    padding = 50
    body_font = get_font(13)
    bold_font = get_font(13, bold=True)
    heading_font = get_font(15, bold=True)
    title_font = get_font(20, bold=True)
    small_font = get_font(11)

    # Compute height
    line_h = 22
    height = padding * 2
    height += sum(28 if k == "title" else 22 for _, k in header) + 16
    height += line_h * len(customer_lines) + 16
    height += line_h * (len(line_items) + 1) + 16  # +1 for header
    height += line_h * len(totals) + 16
    height += 18 * len(footer_lines) + 24

    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    y = padding

    for text, kind in header:
        if kind == "title":
            draw.text((padding, y), text, fill="#000", font=title_font)
            y += 28
        else:
            draw.text((padding, y), text, fill="#444", font=small_font)
            y += 18
    y += 10

    for line in customer_lines:
        draw.text((padding, y), line, fill="#1a1a1a", font=body_font)
        y += line_h
    y += 10

    # Line items table
    draw.text((padding, y), "DESCRIPTION", fill="#444", font=bold_font)
    draw.text((padding + 600, y), "AMOUNT", fill="#444", font=bold_font)
    y += line_h
    for desc, amt in line_items:
        draw.text((padding, y), desc, fill="#1a1a1a", font=body_font)
        draw.text((padding + 600, y), amt, fill="#1a1a1a", font=body_font)
        y += line_h
    y += 8

    # Totals
    for label, amt in totals:
        font = bold_font if label.upper().startswith("TOTAL") else body_font
        draw.text((padding + 480, y), label, fill="#000", font=font)
        draw.text((padding + 600, y), amt, fill="#000", font=font)
        y += line_h
    y += 8

    for fl in footer_lines:
        draw.text((padding, y), fl, fill="#444", font=small_font)
        y += 18

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, "PNG", optimize=True)
    return os.path.getsize(out_path)


def emit(folder, fname, header, customer, items, totals, footer):
    p = os.path.join(ROOT, "test-quotes", folder, fname)
    n = render_quote(p, header, customer, items, totals, footer)
    print(f"  {folder}/{fname}: {n} bytes")


# ============================================================
# Common builder: 3 quotes for the same job at low/mid/high
# Each vertical supplies a SCENARIO dict.
# ============================================================

VERTICALS = [
    # ----------- FOUNDATION -----------
    {
        "folder": "foundation-test-images",
        "prefix": "comparison-pier",
        "scenario": "Settling foundation - 8 hydraulic piers - east side of home",
        "customer": [
            "Customer: M. Greer",
            "Property: 4612 Oakhaven Lane, Houston, TX 77042",
            "Job: Foundation stabilization, east side, 8 piers required",
            "Date: 2026-03-12",
        ],
        "quotes": [
            {
                "tier": "low", "company": "ANCHOR FOUNDATION REPAIR",
                "tag": "Family-owned since 2004 · TX License #FNDX-44218",
                "addr": "1800 Wirt Road · Houston, TX 77055",
                "items": [
                    ("Hydraulic concrete pier installation (8 piers)", "$5,200"),
                    ("Excavation and underpinning", "$1,400"),
                    ("Site cleanup and haul-off", "$300"),
                ],
                "subtotal": "$6,900", "tax": "$0", "total": "$6,900",
                "footer": [
                    "Lifetime transferable warranty on piers (lifetime of structure).",
                    "Free re-leveling if pier moves more than 1\".",
                    "Engineer report not included; recommend client obtain separately ($400).",
                    "Payment: 30% deposit, balance on completion.",
                ],
            },
            {
                "tier": "mid", "company": "GULF COAST FOUNDATION",
                "tag": "Licensed and insured · TX FN-99812",
                "addr": "9920 Hempstead Road · Houston, TX 77092",
                "items": [
                    ("Steel push pier system, 8 piers", "$7,200"),
                    ("Permit and inspection coordination", "$450"),
                    ("Engineer's report included", "$700"),
                    ("Cleanup and grade restoration", "$400"),
                ],
                "subtotal": "$8,750", "tax": "$0", "total": "$8,750",
                "footer": [
                    "25-year transferable warranty on workmanship and materials.",
                    "Includes structural engineer's letter for closing/insurance.",
                    "Drainage assessment included; will recommend gutter/grade fixes.",
                    "Payment: 25% deposit, 50% mid-job, 25% on completion.",
                ],
            },
            {
                "tier": "high", "company": "CITADEL STRUCTURAL SOLUTIONS",
                "tag": "Engineering-led foundation specialists · TX License #FN-100422",
                "addr": "5600 Memorial Drive, Suite 220 · Houston, TX 77007",
                "items": [
                    ("Helical pier system, 8 piers (deeper bedrock load path)", "$9,400"),
                    ("Pre-installation engineering assessment", "$1,200"),
                    ("Permit, inspection, and closeout", "$600"),
                    ("Drainage diversion (2 surface drains)", "$1,100"),
                    ("Cleanup, sod replacement, haul-off", "$500"),
                ],
                "subtotal": "$12,800", "tax": "$0", "total": "$12,800",
                "footer": [
                    "Lifetime fully transferable warranty (engineer-stamped).",
                    "Soil test included; pier depths sized to refusal.",
                    "Annual courtesy re-survey for first 5 years.",
                    "Payment: 25% deposit, 50% on dry-in, 25% on final closeout.",
                ],
            },
        ],
    },

    # ----------- FENCING -----------
    {
        "folder": "fencing-test-images",
        "prefix": "comparison-fence",
        "scenario": "180 linear ft of 6ft wood privacy fence with 2 gates",
        "customer": [
            "Customer: D. Whitfield",
            "Property: 728 Beechwood Trail, Raleigh, NC 27607",
            "Job: 180 linear ft of 6 ft cedar privacy fence, 2 gates",
            "Date: 2026-03-15",
        ],
        "quotes": [
            {
                "tier": "low", "company": "PINE STATE FENCING",
                "tag": "Wood and chain link specialists",
                "addr": "402 N. New Hope Rd · Raleigh, NC 27604",
                "items": [
                    ("Cedar privacy fence, 6 ft tall x 180 lf", "$4,500"),
                    ("4x4 pressure-treated posts (concrete-set)", "Included"),
                    ("Two 4-ft walk gates with hardware", "$320"),
                    ("Old fence removal and haul-off", "$280"),
                ],
                "subtotal": "$5,100", "tax": "$0", "total": "$5,100",
                "footer": [
                    "1-year workmanship warranty.",
                    "Stain/seal NOT included.",
                    "811 utility locate handled by customer.",
                    "Payment: 50% deposit, 50% on completion.",
                ],
            },
            {
                "tier": "mid", "company": "TARHEEL FENCE & DECK",
                "tag": "Licensed and insured · NC #FNCE-22910",
                "addr": "8801 Glenwood Avenue · Raleigh, NC 27617",
                "items": [
                    ("Cedar privacy fence, 6 ft x 180 lf", "$5,400"),
                    ("Concrete-set 4x4 posts, 8 ft on center", "$650"),
                    ("Two 4-ft cedar walk gates with steel frame", "$580"),
                    ("Old fence demo and haul-off", "$350"),
                    ("811 utility locate", "Included"),
                    ("Stain/sealant (semi-transparent, one coat)", "$420"),
                ],
                "subtotal": "$7,400", "tax": "$0", "total": "$7,400",
                "footer": [
                    "5-year workmanship warranty plus manufacturer materials warranty.",
                    "Includes one stain coat; recommend re-coat in 2-3 years.",
                    "Permit pulled if HOA requires (additional $75 if needed).",
                    "Payment: 30% deposit, 70% on completion.",
                ],
            },
            {
                "tier": "high", "company": "BLUEPRINT OUTDOOR LIVING",
                "tag": "Custom fence and outdoor design · NC #FNCE-44188",
                "addr": "120 Edinburgh South Drive, Suite 5 · Raleigh, NC 27607",
                "items": [
                    ("Premium clear cedar privacy fence, 6 ft x 180 lf", "$7,200"),
                    ("4x6 pressure-treated posts, 6 ft on center, concrete-set", "$1,150"),
                    ("Two 4-ft custom cedar gates with self-closing hinges", "$880"),
                    ("Old fence demo, haul-off, and disposal fees", "$420"),
                    ("Stain (premium oil-based, two coats)", "$950"),
                    ("811 locate, permit pulling, HOA submittal", "$200"),
                ],
                "subtotal": "$10,800", "tax": "$0", "total": "$10,800",
                "footer": [
                    "Lifetime transferable workmanship warranty.",
                    "Stain backed by manufacturer for 7 years.",
                    "Includes touch-up visit at year 1.",
                    "Payment: 25% deposit, 50% on framing, 25% on final.",
                ],
            },
        ],
    },

    # ----------- GARAGE DOOR -----------
    {
        "folder": "garage-door-test-images",
        "prefix": "comparison-garage",
        "scenario": "16x7 insulated steel garage door with belt-drive opener",
        "customer": [
            "Customer: A. Choi",
            "Property: 312 Wickfield Court, Mesa, AZ 85213",
            "Job: Replace 16 ft x 7 ft garage door + new belt-drive opener",
            "Date: 2026-03-08",
        ],
        "quotes": [
            {
                "tier": "low", "company": "VALLEY DISCOUNT GARAGE DOORS",
                "tag": "Same-day install available",
                "addr": "1240 W Broadway Rd · Mesa, AZ 85202",
                "items": [
                    ("Standard 16x7 steel pan door, non-insulated", "$840"),
                    ("Chain-drive opener, 1/2 HP", "$220"),
                    ("Standard install (track, springs, hardware)", "$280"),
                    ("Old door haul-off", "$80"),
                ],
                "subtotal": "$1,420", "tax": "$0", "total": "$1,420",
                "footer": [
                    "1-year warranty on door, 1-year on opener.",
                    "Standard torsion springs (10,000 cycles).",
                    "Weather seal NOT included.",
                    "Payment: due on completion.",
                ],
            },
            {
                "tier": "mid", "company": "DESERT OVERHEAD DOOR CO",
                "tag": "AZ ROC #289144 · Licensed and bonded",
                "addr": "2901 E McDowell Rd · Mesa, AZ 85215",
                "items": [
                    ("Insulated steel door, 16x7, R-value 9", "$1,250"),
                    ("Belt-drive opener, 3/4 HP, Wi-Fi capable", "$420"),
                    ("Heavy-duty torsion springs (25,000 cycles)", "$180"),
                    ("Track, hardware, weather seal", "$240"),
                    ("Old door removal and haul-off", "$120"),
                    ("New keypad and 2 remotes", "$90"),
                ],
                "subtotal": "$2,300", "tax": "$0", "total": "$2,300",
                "footer": [
                    "5-year warranty on door, 7-year on opener (lifetime motor).",
                    "Spring warranty: 7 years.",
                    "Includes safety inspection and tune-up.",
                    "Payment: full on completion.",
                ],
            },
            {
                "tier": "high", "company": "PRECISION DOOR SOLUTIONS",
                "tag": "Premium installer · AZ ROC #311920",
                "addr": "5215 E Southern Ave · Mesa, AZ 85206",
                "items": [
                    ("Premium insulated steel door, 16x7, R-value 18.4", "$1,950"),
                    ("Smart belt-drive opener, 1.25 HP, battery backup", "$680"),
                    ("Premium torsion springs (50,000 cycles)", "$280"),
                    ("Heavy-duty track and hardware", "$320"),
                    ("Premium weather seal kit + insulated bottom", "$180"),
                    ("Wall console + 3 remotes + smartphone setup", "$140"),
                    ("Old door removal and disposal", "$150"),
                    ("Annual spring inspection (first year)", "Included"),
                ],
                "subtotal": "$3,700", "tax": "$0", "total": "$3,700",
                "footer": [
                    "Lifetime warranty on door panels and springs.",
                    "10-year warranty on opener, lifetime on motor.",
                    "5 free service calls in first 3 years.",
                    "Payment: 50% deposit, 50% on completion.",
                ],
            },
        ],
    },

    # ----------- GUTTERS -----------
    {
        "folder": "gutters-test-images",
        "prefix": "comparison-gutters",
        "scenario": "180 linear ft of seamless 5-inch gutters with 6 downspouts",
        "customer": [
            "Customer: R. Albright",
            "Property: 4204 Bayshore Drive, Tampa, FL 33611",
            "Job: 180 lf seamless 5\" K-style gutters, 6 downspouts",
            "Date: 2026-03-19",
        ],
        "quotes": [
            {
                "tier": "low", "company": "BUDGET RAIN GUTTER LLC",
                "tag": "Cash-friendly pricing",
                "addr": "5102 N Florida Ave · Tampa, FL 33603",
                "items": [
                    ("5\" aluminum K-style seamless gutter, 180 lf", "$900"),
                    ("Round downspouts, 6 total", "$240"),
                    ("Standard hangers (every 36\")", "Included"),
                    ("Old gutter removal", "$120"),
                ],
                "subtotal": "$1,260", "tax": "$0", "total": "$1,260",
                "footer": [
                    "1-year workmanship warranty.",
                    "0.025\" gauge aluminum (standard).",
                    "Fascia inspection NOT included.",
                    "Payment: cash on completion preferred.",
                ],
            },
            {
                "tier": "mid", "company": "SUNCOAST SEAMLESS GUTTERS",
                "tag": "Licensed FL CGC1521144",
                "addr": "11202 N Dale Mabry Hwy · Tampa, FL 33618",
                "items": [
                    ("5\" aluminum seamless gutter, 0.027\" gauge, 180 lf", "$1,440"),
                    ("Downspouts, 6 total with elbows", "$360"),
                    ("Hidden hangers, 24\" on center", "$180"),
                    ("Fascia inspection and minor repair", "$200"),
                    ("Old gutter removal and haul-off", "$140"),
                    ("Splash blocks, 6", "$60"),
                ],
                "subtotal": "$2,380", "tax": "$0", "total": "$2,380",
                "footer": [
                    "10-year workmanship warranty.",
                    "Manufacturer 20-year finish warranty on aluminum.",
                    "Seamless gutters formed on-site.",
                    "Payment: full on completion.",
                ],
            },
            {
                "tier": "high", "company": "GULFSIDE EXTERIORS",
                "tag": "Premium gutter and exterior contractor · FL CCC1334771",
                "addr": "8800 W Hillsborough Ave · Tampa, FL 33615",
                "items": [
                    ("6\" aluminum seamless gutter, 0.032\" gauge, 180 lf", "$2,520"),
                    ("3x4\" downspouts, 6 total", "$540"),
                    ("Premium hidden hangers, screws (every 18\")", "$300"),
                    ("LeafBlaster Pro micromesh gutter guards, 180 lf", "$1,440"),
                    ("Fascia inspection, repair, and re-painting", "$420"),
                    ("Old gutter removal, haul-off, disposal fee", "$180"),
                    ("Splash blocks, downspout extensions, 6", "$120"),
                ],
                "subtotal": "$5,520", "tax": "$0", "total": "$5,520",
                "footer": [
                    "Lifetime transferable workmanship warranty.",
                    "LeafBlaster guards: lifetime no-clog warranty.",
                    "Includes annual courtesy gutter cleaning for 2 years.",
                    "Payment: 25% deposit, 75% on completion.",
                ],
            },
        ],
    },

    # ----------- INSULATION -----------
    {
        "folder": "insulation-test-images",
        "prefix": "comparison-insul",
        "scenario": "1500 sqft attic blown-in fiberglass to R-49",
        "customer": [
            "Customer: K. Maldonado",
            "Property: 622 Wexford Lane, Columbus, OH 43221",
            "Job: 1500 sq ft attic, blow-in to R-49 (currently R-11)",
            "Date: 2026-03-22",
        ],
        "quotes": [
            {
                "tier": "low", "company": "MIDSTATE INSULATION DIRECT",
                "tag": "Bulk attic specialists",
                "addr": "1144 W Broad St · Columbus, OH 43222",
                "items": [
                    ("Blow-in fiberglass insulation to R-49 (1500 sqft)", "$1,650"),
                    ("Standard installation labor", "Included"),
                    ("Cleanup", "$80"),
                ],
                "subtotal": "$1,730", "tax": "$0", "total": "$1,730",
                "footer": [
                    "1-year workmanship warranty.",
                    "Air sealing NOT included.",
                    "Existing insulation NOT removed.",
                    "Payment: due on completion.",
                ],
            },
            {
                "tier": "mid", "company": "BUCKEYE ENERGY SOLUTIONS",
                "tag": "BPI-certified · OH HIC.030477",
                "addr": "5500 Sinclair Rd · Columbus, OH 43229",
                "items": [
                    ("Blow-in cellulose insulation to R-49 (1500 sqft)", "$2,250"),
                    ("Air sealing - top plates, penetrations, can lights", "$380"),
                    ("Attic baffles for soffit ventilation (12)", "$180"),
                    ("Hatch insulation kit", "$95"),
                    ("Cleanup and disposal", "$120"),
                ],
                "subtotal": "$3,025", "tax": "$0", "total": "$3,025",
                "footer": [
                    "10-year workmanship warranty.",
                    "Energy audit results provided post-install.",
                    "Eligible for utility rebates (paperwork provided).",
                    "Payment: full on completion.",
                ],
            },
            {
                "tier": "high", "company": "GREEN ENVELOPE BUILDING SCIENCE",
                "tag": "Whole-home performance specialists · OH HIC.040166",
                "addr": "2900 Olentangy River Rd · Columbus, OH 43202",
                "items": [
                    ("Removal of existing R-11 fiberglass batts", "$580"),
                    ("Comprehensive air sealing package (foam, gaskets)", "$920"),
                    ("Closed-cell spray foam at rim joist (140 lf)", "$680"),
                    ("Blow-in cellulose to R-60 (1500 sqft)", "$2,400"),
                    ("Soffit baffles, 16 total", "$240"),
                    ("Insulated, weatherstripped attic hatch", "$260"),
                    ("Pre and post blower-door test", "$420"),
                    ("Cleanup and HEPA vacuum", "$180"),
                ],
                "subtotal": "$5,680", "tax": "$0", "total": "$5,680",
                "footer": [
                    "Lifetime workmanship warranty on air sealing.",
                    "Includes Manual J energy report.",
                    "Pre/post blower door test documents air leakage reduction.",
                    "Payment: 30% deposit, 70% on completion after blower test.",
                ],
            },
        ],
    },

    # ----------- KITCHEN REMODEL -----------
    {
        "folder": "kitchen-test-images",
        "prefix": "comparison-kitchen",
        "scenario": "200 sqft kitchen mid-grade remodel - cabinets, quartz, appliances",
        "customer": [
            "Customer: T. Rasmussen",
            "Property: 1840 Holly Brook Lane, Naperville, IL 60540",
            "Job: 200 sqft kitchen, mid-grade refresh",
            "Date: 2026-03-25",
        ],
        "quotes": [
            {
                "tier": "low", "company": "QUICK KITCHEN REFRESH LLC",
                "tag": "Budget-friendly remodels",
                "addr": "1018 W Ogden Ave · Naperville, IL 60563",
                "items": [
                    ("Stock semi-custom cabinets (oak)", "$8,400"),
                    ("Laminate countertops (12 lf)", "$1,200"),
                    ("Standard cabinet install labor", "$2,800"),
                    ("Demolition of old cabinets and counters", "$650"),
                    ("Plumbing reconnect (sink, dishwasher)", "$420"),
                    ("Paint walls (1 coat)", "$380"),
                ],
                "subtotal": "$13,850", "tax": "$0", "total": "$13,850",
                "footer": [
                    "Appliances NOT included (customer-provided).",
                    "Permit NOT included.",
                    "1-year workmanship warranty.",
                    "Payment: 50% deposit, 50% on completion.",
                ],
            },
            {
                "tier": "mid", "company": "PRAIRIE STATE KITCHEN & BATH",
                "tag": "Licensed and bonded · IL #144.013188",
                "addr": "75 Executive Dr · Aurora, IL 60504",
                "items": [
                    ("Semi-custom plywood-box cabinets (maple shaker)", "$12,800"),
                    ("Quartz countertops (24 lf), edge, sink cutout", "$3,800"),
                    ("Mid-grade appliance package (range, DW, hood, MW)", "$4,200"),
                    ("Cabinet and counter install labor", "$3,400"),
                    ("Demolition and haul-off", "$850"),
                    ("Plumbing reconnect, electrical for new range", "$1,100"),
                    ("Paint, trim, minor drywall repair", "$680"),
                    ("Permit and inspection coordination", "$420"),
                ],
                "subtotal": "$27,250", "tax": "$0", "total": "$27,250",
                "footer": [
                    "5-year workmanship warranty.",
                    "Cabinet manufacturer warranty: lifetime.",
                    "Includes design service and 3D rendering.",
                    "Payment: 30/40/30 schedule.",
                ],
            },
            {
                "tier": "high", "company": "ARTISAN KITCHEN STUDIOS",
                "tag": "High-end remodel specialists · IL #144.014922",
                "addr": "208 W Jefferson Ave · Naperville, IL 60540",
                "items": [
                    ("Custom inset cabinetry, soft-close, dovetail drawers", "$24,500"),
                    ("Quartzite countertops (28 lf), waterfall edge", "$7,800"),
                    ("Premium appliance package (dual-fuel range, panel-ready DW)", "$9,200"),
                    ("Custom range hood and pot filler install", "$1,800"),
                    ("Cabinet and counter install labor (premium)", "$5,400"),
                    ("Full demolition, dust containment, daily cleanup", "$1,400"),
                    ("Plumbing relocation (sink + ice maker line)", "$1,800"),
                    ("Electrical (new circuits, undercabinet lighting)", "$2,100"),
                    ("Drywall repair, prime, paint walls and ceiling", "$1,400"),
                    ("Permit, inspections, design and project mgmt", "$1,800"),
                ],
                "subtotal": "$57,200", "tax": "$0", "total": "$57,200",
                "footer": [
                    "Lifetime workmanship warranty on cabinet install.",
                    "Includes 3D design, material selection visits.",
                    "Dedicated project manager and weekly progress meetings.",
                    "Payment: 25/25/25/25 schedule tied to milestones.",
                ],
            },
        ],
    },

    # ----------- LANDSCAPING -----------
    {
        "folder": "landscaping-test-images",
        "prefix": "comparison-land",
        "scenario": "Front-yard refresh: 1200 sqft sod, 18 shrubs, mulch beds",
        "customer": [
            "Customer: P. Castellano",
            "Property: 92 Sycamore Hollow, Marietta, GA 30062",
            "Job: Front yard refresh - 1200 sqft sod, 18 shrubs, mulch",
            "Date: 2026-03-28",
        ],
        "quotes": [
            {
                "tier": "low", "company": "LAWN & ORDER LANDSCAPING",
                "tag": "Quick installs",
                "addr": "1380 Roswell Rd · Marietta, GA 30062",
                "items": [
                    ("Bermuda sod, 1200 sqft (delivery + install)", "$840"),
                    ("Shrubs - 18 mixed (3-gallon)", "$540"),
                    ("Brown mulch, 4 yards", "$280"),
                    ("Bed prep and planting", "$420"),
                ],
                "subtotal": "$2,080", "tax": "$0", "total": "$2,080",
                "footer": [
                    "30-day plant warranty (replace if dies).",
                    "No design service.",
                    "No irrigation included.",
                    "Payment: 50% deposit, 50% on completion.",
                ],
            },
            {
                "tier": "mid", "company": "EVERGREEN GROUNDSKEEPING",
                "tag": "Licensed Georgia landscape contractor #LC005611",
                "addr": "2200 Cobb Pkwy · Marietta, GA 30060",
                "items": [
                    ("Bermuda sod, 1200 sqft, with starter fertilizer", "$1,080"),
                    ("Shrubs - 18 (5-gallon, mixed varieties)", "$1,080"),
                    ("Premium hardwood mulch, 6 yards", "$420"),
                    ("Soil amendment and bed prep", "$380"),
                    ("Drip irrigation for new plant beds", "$640"),
                    ("Cleanup and disposal", "$220"),
                ],
                "subtotal": "$3,820", "tax": "$0", "total": "$3,820",
                "footer": [
                    "1-year plant warranty.",
                    "Drip irrigation tied into existing system.",
                    "Initial care plan included (watering schedule).",
                    "Payment: 30% deposit, 70% on completion.",
                ],
            },
            {
                "tier": "high", "company": "PIEDMONT LANDSCAPE DESIGN",
                "tag": "Design-build firm · GA #LC005822",
                "addr": "100 Galleria Pkwy · Atlanta, GA 30339",
                "items": [
                    ("Custom landscape design and rendering", "$680"),
                    ("Premium Zoysia sod, 1200 sqft, soil prep", "$2,160"),
                    ("Specimen shrubs - 18 (7-gallon, native varieties)", "$2,340"),
                    ("Premium dyed mulch, 8 yards", "$680"),
                    ("Drip irrigation with smart controller", "$1,420"),
                    ("Landscape lighting (8 path lights)", "$1,180"),
                    ("Existing bed cleanup, edging, soil amendment", "$640"),
                    ("Project management and final walk-through", "$320"),
                ],
                "subtotal": "$9,420", "tax": "$0", "total": "$9,420",
                "footer": [
                    "2-year plant warranty.",
                    "1-year free maintenance visits (quarterly).",
                    "Includes hand-drawn landscape plan and plant ID guide.",
                    "Payment: 30/40/30 schedule.",
                ],
            },
        ],
    },

    # ----------- PAINTING -----------
    {
        "folder": "painting-test-images",
        "prefix": "comparison-paint",
        "scenario": "2200 sqft 2-story home exterior, full repaint",
        "customer": [
            "Customer: J. Hong",
            "Property: 4422 Holly Springs Court, Aurora, CO 80016",
            "Job: 2200 sqft 2-story home, full exterior repaint",
            "Date: 2026-03-30",
        ],
        "quotes": [
            {
                "tier": "low", "company": "BUDGET PAINTERS DENVER",
                "tag": "Fast turnaround",
                "addr": "8400 E Iliff Ave · Denver, CO 80231",
                "items": [
                    ("2-story exterior, body color (1 coat)", "$2,400"),
                    ("Trim color (1 coat)", "$680"),
                    ("Pressure wash", "$200"),
                    ("Drop cloth and protection", "Included"),
                ],
                "subtotal": "$3,280", "tax": "$0", "total": "$3,280",
                "footer": [
                    "1-year warranty.",
                    "Builder-grade paint (Behr Marquee or equivalent).",
                    "No prep beyond pressure wash.",
                    "Payment: 50% deposit, 50% on completion.",
                ],
            },
            {
                "tier": "mid", "company": "ROCKY MOUNTAIN PRO PAINTING",
                "tag": "Licensed and insured · CO contractor #CP-44188",
                "addr": "2390 S Parker Rd · Aurora, CO 80014",
                "items": [
                    ("2-story exterior, body color (2 coats)", "$3,800"),
                    ("Trim color (2 coats)", "$1,200"),
                    ("Pressure wash and surface prep", "$420"),
                    ("Caulking and minor wood repair", "$580"),
                    ("Premium paint (Sherwin-Williams Duration)", "$680"),
                    ("Drop cloths, masking, daily cleanup", "Included"),
                ],
                "subtotal": "$6,680", "tax": "$0", "total": "$6,680",
                "footer": [
                    "5-year workmanship warranty.",
                    "Manufacturer paint warranty 10-year.",
                    "Includes minor caulking and wood repair.",
                    "Payment: 30/40/30 schedule.",
                ],
            },
            {
                "tier": "high", "company": "FRONT RANGE FINISHWORKS",
                "tag": "High-end residential painting · CO #CP-45200",
                "addr": "112 Detroit St · Denver, CO 80206",
                "items": [
                    ("2-story exterior, body (2 coats premium)", "$5,400"),
                    ("Trim, fascia, soffit (3 coats)", "$2,200"),
                    ("Power wash, scrape, sand, prime bare wood", "$1,200"),
                    ("Full caulking, wood rot repair (up to 4 hours)", "$1,400"),
                    ("Premium paint (Sherwin-Williams Emerald)", "$1,100"),
                    ("Doors and shutters (2 coats)", "$680"),
                    ("Daily site cleanup and protection", "Included"),
                    ("Project management and final walk-through", "$420"),
                ],
                "subtotal": "$12,400", "tax": "$0", "total": "$12,400",
                "footer": [
                    "10-year workmanship warranty.",
                    "Lifetime paint warranty (manufacturer).",
                    "Free touch-up visit at year 1.",
                    "Payment: 25/50/25 schedule.",
                ],
            },
        ],
    },

    # ----------- SIDING -----------
    {
        "folder": "siding-test-images",
        "prefix": "comparison-siding",
        "scenario": "1800 sqft full siding replacement, vinyl",
        "customer": [
            "Customer: B. McAlister",
            "Property: 7820 Forest Glen Drive, Cincinnati, OH 45236",
            "Job: 1800 sqft 2-story home, full siding replacement",
            "Date: 2026-04-02",
        ],
        "quotes": [
            {
                "tier": "low", "company": "OHIO VINYL SIDING DIRECT",
                "tag": "Bulk pricing on vinyl",
                "addr": "8200 Reading Rd · Cincinnati, OH 45215",
                "items": [
                    ("Standard .042 vinyl siding, 1800 sqft", "$5,400"),
                    ("Removal of existing siding", "$800"),
                    ("Standard install labor", "$2,200"),
                    ("Trim and J-channel", "$640"),
                ],
                "subtotal": "$9,040", "tax": "$0", "total": "$9,040",
                "footer": [
                    "1-year workmanship warranty.",
                    "House wrap NOT included.",
                    "Insulation backing NOT included.",
                    "Payment: 30% deposit, 70% on completion.",
                ],
            },
            {
                "tier": "mid", "company": "QUEEN CITY EXTERIORS",
                "tag": "Licensed and insured · OH HIC.066220",
                "addr": "9400 Montgomery Rd · Cincinnati, OH 45242",
                "items": [
                    ("Premium .046 vinyl siding, 1800 sqft", "$7,200"),
                    ("Removal and disposal of existing siding", "$1,200"),
                    ("Tyvek house wrap installation", "$680"),
                    ("Insulation backing board", "$1,400"),
                    ("Trim, J-channel, soffit refresh", "$1,200"),
                    ("Install labor", "$3,200"),
                ],
                "subtotal": "$14,880", "tax": "$0", "total": "$14,880",
                "footer": [
                    "10-year workmanship warranty.",
                    "Vinyl manufacturer 50-year limited warranty.",
                    "Includes house wrap and insulation backing.",
                    "Payment: 25/50/25 schedule.",
                ],
            },
            {
                "tier": "high", "company": "GREATER CINCINNATI SIDING & WINDOW",
                "tag": "James Hardie elite preferred · OH HIC.072144",
                "addr": "5240 Bridgetown Rd · Cincinnati, OH 45248",
                "items": [
                    ("James Hardie fiber cement siding, 1800 sqft", "$11,400"),
                    ("Removal and disposal of existing siding", "$1,400"),
                    ("Tyvek house wrap with taped seams", "$820"),
                    ("Continuous rigid foam insulation backing", "$2,200"),
                    ("Aluminum trim wraps for windows and doors", "$1,800"),
                    ("Install labor (Hardie certified crew)", "$5,400"),
                    ("Permit, inspection coordination", "$320"),
                    ("Cleanup, magnet sweep for nails", "$280"),
                ],
                "subtotal": "$23,620", "tax": "$0", "total": "$23,620",
                "footer": [
                    "Lifetime workmanship warranty.",
                    "James Hardie 30-year non-prorated finish warranty.",
                    "Includes 4-year free touch-up service.",
                    "Payment: 25/50/25 milestone schedule.",
                ],
            },
        ],
    },

    # ----------- WINDOWS -----------
    {
        "folder": "windows-test-images",
        "prefix": "comparison-windows",
        "scenario": "12 double-hung vinyl replacement windows",
        "customer": [
            "Customer: H. Vandermeer",
            "Property: 218 Larkspur Way, Bothell, WA 98011",
            "Job: 12 double-hung windows, vinyl, low-E double pane",
            "Date: 2026-04-04",
        ],
        "quotes": [
            {
                "tier": "low", "company": "PACIFIC WINDOW WAREHOUSE",
                "tag": "Direct manufacturer pricing",
                "addr": "13800 Bothell Way NE · Lake Forest Park, WA 98155",
                "items": [
                    ("Vinyl double-hung windows, 12 total, white", "$3,600"),
                    ("Standard install (12 windows)", "$1,800"),
                    ("Old window removal", "$240"),
                    ("Standard caulking", "Included"),
                ],
                "subtotal": "$5,640", "tax": "$0", "total": "$5,640",
                "footer": [
                    "10-year limited warranty on windows.",
                    "1-year workmanship warranty.",
                    "Trim/wrap NOT included.",
                    "Payment: 50% deposit, 50% on completion.",
                ],
            },
            {
                "tier": "mid", "company": "CASCADE WINDOW & DOOR",
                "tag": "Licensed WA #CASCAW844LH",
                "addr": "8800 NE 180th St · Kenmore, WA 98028",
                "items": [
                    ("Vinyl double-hung windows, 12 total, U-factor 0.28", "$5,400"),
                    ("Argon-filled, low-E coated dual pane", "Included"),
                    ("Install labor with foam insulation around frame", "$2,400"),
                    ("Old window removal and disposal", "$420"),
                    ("Trim wrap (aluminum coil) for exterior", "$960"),
                    ("Interior touch-up and caulking", "$320"),
                ],
                "subtotal": "$9,500", "tax": "$0", "total": "$9,500",
                "footer": [
                    "Lifetime limited warranty on windows.",
                    "10-year workmanship warranty.",
                    "Includes interior touch-up and exterior trim wrap.",
                    "Payment: 30/40/30 schedule.",
                ],
            },
            {
                "tier": "high", "company": "EVERGREEN PREMIER WINDOWS",
                "tag": "Andersen 400-series dealer · WA #EVRGPW822KK",
                "addr": "12100 NE 8th St · Bellevue, WA 98005",
                "items": [
                    ("Andersen 400-series wood-clad windows, 12 total", "$11,400"),
                    ("Triple-pane low-E with argon, U-factor 0.22", "Included"),
                    ("Premium install with foam, blocking, flashing", "$3,600"),
                    ("Old window removal, disposal, lead-safe practices", "$680"),
                    ("Custom interior trim (oak, stained to match)", "$1,800"),
                    ("Exterior trim wrap (aluminum coil)", "$1,200"),
                    ("Interior caulk, paint touch-up", "$520"),
                    ("Permit and inspection", "$320"),
                ],
                "subtotal": "$19,520", "tax": "$0", "total": "$19,520",
                "footer": [
                    "Andersen lifetime limited warranty.",
                    "Lifetime workmanship warranty (transferable).",
                    "Includes interior trim and finish carpentry.",
                    "Payment: 25/50/25 milestone schedule.",
                ],
            },
        ],
    },

    # ----------- CONCRETE -----------
    {
        "folder": "concrete-test-images",
        "prefix": "comparison-conc",
        "scenario": "800 sqft 4-inch concrete patio with broom finish",
        "customer": [
            "Customer: L. Tedeschi",
            "Property: 612 Hawkridge Drive, Plano, TX 75025",
            "Job: 800 sqft 4\" concrete patio, broom finish",
            "Date: 2026-04-05",
        ],
        "quotes": [
            {
                "tier": "low", "company": "QUICK POUR CONCRETE",
                "tag": "Cash-friendly",
                "addr": "1820 Coit Rd · Plano, TX 75075",
                "items": [
                    ("4\" concrete pour, 800 sqft, 3000 PSI", "$3,200"),
                    ("Wire mesh reinforcement", "$240"),
                    ("Broom finish", "Included"),
                    ("Labor", "$1,400"),
                ],
                "subtotal": "$4,840", "tax": "$0", "total": "$4,840",
                "footer": [
                    "1-year workmanship warranty.",
                    "Base prep limited to existing grade.",
                    "Sealer NOT included.",
                    "Payment: 30% deposit, 70% on completion.",
                ],
            },
            {
                "tier": "mid", "company": "LONE STAR CONCRETE WORKS",
                "tag": "Licensed and insured · TX",
                "addr": "4800 Independence Pkwy · Plano, TX 75023",
                "items": [
                    ("4\" concrete pour, 800 sqft, 4000 PSI", "$4,800"),
                    ("#3 rebar grid, 18\" on center", "$640"),
                    ("Compacted gravel base, 4\" deep", "$680"),
                    ("Form work and broom finish", "$1,200"),
                    ("Control joints (sawcut at 24-hour cure)", "$240"),
                    ("Site cleanup and haul-off", "$240"),
                ],
                "subtotal": "$7,800", "tax": "$0", "total": "$7,800",
                "footer": [
                    "5-year workmanship warranty.",
                    "Includes rebar reinforcement and compacted base.",
                    "Sealer optional ($380 extra, recommended).",
                    "Payment: 25/50/25 schedule.",
                ],
            },
            {
                "tier": "high", "company": "PRECISION FLATWORK SOLUTIONS",
                "tag": "Decorative concrete specialists · TX licensed",
                "addr": "2200 W Park Blvd · Plano, TX 75075",
                "items": [
                    ("5\" concrete pour, 800 sqft, 4500 PSI fiber-reinforced", "$6,400"),
                    ("#4 rebar grid, 16\" on center", "$880"),
                    ("Compacted gravel base, 6\" deep with geotextile", "$1,400"),
                    ("Form work, broom finish, decorative edge tooling", "$1,800"),
                    ("Sawcut control joints", "$320"),
                    ("Penetrating sealer (2 coats)", "$540"),
                    ("Drainage planning and slope grading", "$420"),
                    ("Cleanup, sod replacement, site protection", "$340"),
                ],
                "subtotal": "$12,100", "tax": "$0", "total": "$12,100",
                "footer": [
                    "Lifetime workmanship warranty against settling cracks.",
                    "Includes 2-coat penetrating sealer (5-year reapply).",
                    "Drainage and slope engineered to spec.",
                    "Payment: 25/50/25 milestone schedule.",
                ],
            },
        ],
    },

    # ----------- MOVING -----------
    {
        "folder": "moving-test-images",
        "prefix": "comparison-move",
        "scenario": "Local 3-bedroom move, Atlanta GA, 12 miles, 8000 lbs",
        "customer": [
            "Customer: D. Liang",
            "Origin: 1842 Vinings Estates Dr SE, Smyrna, GA 30126",
            "Destination: 4920 Trickum Rd, Marietta, GA 30066",
            "Move: 3 BR home, ~8000 lbs, 12 miles",
            "Date: 2026-04-08",
        ],
        "quotes": [
            {
                "tier": "low", "company": "ATL DISCOUNT MOVERS",
                "tag": "Hourly local moves",
                "addr": "2200 Marietta Blvd · Atlanta, GA 30318",
                "items": [
                    ("3 movers + truck, 6 hours @ $130/hr", "$780"),
                    ("Travel time (1 hour minimum)", "$130"),
                    ("Mileage and fuel", "$80"),
                    ("Materials (used wrap, free)", "Included"),
                ],
                "subtotal": "$990", "tax": "$0", "total": "$990",
                "footer": [
                    "Non-binding hourly estimate (final cost based on actual time).",
                    "Released-value valuation only ($0.60/lb).",
                    "USDOT not provided.",
                    "Payment: cash or card on completion.",
                ],
            },
            {
                "tier": "mid", "company": "PEACH STATE MOVERS",
                "tag": "USDOT 3022144 · GA #HMC0220",
                "addr": "5500 Roswell Rd · Atlanta, GA 30342",
                "items": [
                    ("4 movers + 26ft truck, 7 hours @ $180/hr", "$1,260"),
                    ("Travel time (1 hour)", "$180"),
                    ("Fuel surcharge", "$120"),
                    ("Packing materials (boxes, paper, wrap)", "$240"),
                    ("Wardrobe boxes (4)", "$60"),
                    ("Standard valuation included", "Included"),
                ],
                "subtotal": "$1,860", "tax": "$0", "total": "$1,860",
                "footer": [
                    "Non-binding estimate within 10% of final.",
                    "Standard valuation: $0.60/lb (released).",
                    "Full-value protection available for $180.",
                    "Payment: 25% deposit, balance on delivery.",
                ],
            },
            {
                "tier": "high", "company": "WHITE GLOVE RELOCATION SERVICES",
                "tag": "Premium local mover · USDOT 2911820 · GA #HMC0488",
                "addr": "1180 Defoor Ave NW · Atlanta, GA 30318",
                "items": [
                    ("5 movers + 26ft truck, 8 hours @ $220/hr", "$1,760"),
                    ("Travel time (2 hours)", "$440"),
                    ("Full pack service (kitchen + glassware)", "$680"),
                    ("Premium materials (new boxes, custom crates)", "$420"),
                    ("Disassembly and reassembly of furniture", "$320"),
                    ("Full-value protection (FVP) included", "$280"),
                    ("Fuel and mileage", "$140"),
                ],
                "subtotal": "$4,040", "tax": "$0", "total": "$4,040",
                "footer": [
                    "Binding not-to-exceed estimate (max charge $4,040).",
                    "Full-value protection at $6/lb included.",
                    "Includes basic unpack at destination.",
                    "Payment: 30% deposit, balance on delivery via card.",
                ],
            },
        ],
    },
]


def main():
    total = 0
    for v in VERTICALS:
        print(f"\n=== {v['folder']} ===")
        for q in v["quotes"]:
            fname = f"{v['prefix']}-{q['tier']}.png"
            header = [(q["company"], "title"), (q["tag"], "small"), (q["addr"], "small")]
            customer = v["customer"]
            items = q["items"]
            totals = [("Subtotal", q["subtotal"]), ("Tax", q["tax"]), ("TOTAL", q["total"])]
            footer = q["footer"]
            emit(v["folder"], fname, header, customer, items, totals, footer)
            total += 1
    print(f"\n{total} fixtures generated across {len(VERTICALS)} verticals")


if __name__ == "__main__":
    main()

"""
Generate 3-quote comparison sets for every vertical.

For each vertical, produces 3 synthetic quotes for the same scenario from
3 different providers at low/mid/high price points. Used to verify both
the parser AND the comparison logic across all verticals.

All names, addresses, phones, license numbers are fully fake.
"""

import os, sys, io
from PIL import Image, ImageDraw, ImageFont

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_font(size, bold=False):
    candidates = [
        "C:\\Windows\\Fonts\\timesbd.ttf" if bold else "C:\\Windows\\Fonts\\times.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    return ImageFont.load_default()


def render_doc(out_path, lines, width=850, padding=50):
    body_font = get_font(13)
    heading_font = get_font(16, bold=True)
    bold_font = get_font(13, bold=True)
    small_font = get_font(11)
    title_font = get_font(20, bold=True)
    height = padding * 2 + sum(20 for _ in lines) + 100
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    y = padding
    for entry in lines:
        if entry is None or entry == "":
            y += 10; continue
        if isinstance(entry, tuple):
            text, kind = entry[0], entry[1] if len(entry) > 1 else "body"
        else:
            text, kind = entry, "body"
        if kind == "title": font = title_font; color = "#000"; y += 4
        elif kind == "heading": font = heading_font; color = "#000"; y += 6
        elif kind == "bold": font = bold_font; color = "#000"
        elif kind == "small": font = small_font; color = "#444"
        else: font = body_font; color = "#1a1a1a"
        draw.text((padding, y), text, fill=color, font=font)
        bbox = draw.textbbox((0, 0), text, font=font)
        y += (bbox[3] - bbox[1]) + 6
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, "PNG", optimize=True)
    return os.path.getsize(out_path)


def gen(folder, fname, lines):
    p = os.path.join(ROOT, "test-quotes", folder, fname)
    n = render_doc(p, lines)
    print(f"  {folder}/{fname}: {n} bytes")


# ============================================================
# AUTO REPAIR — front brake pad and rotor replacement
# Same job: 2018 Honda Civic, front brake pads + rotors
# ============================================================
print("\n=== AUTO ===")
gen("auto-test-images", "comparison-brake-01-shop-a-low.png", [
    ("HONEST WRENCH AUTO REPAIR", "title"),
    ("Family-owned since 1998 · ASE Certified", "small"),
    ("4288 Industrial Park Drive · Charlotte, NC 28206", "small"),
    "",
    ("REPAIR ESTIMATE", "heading"),
    "",
    ("Customer: J. Patterson", "body"),
    ("Vehicle: 2018 Honda Civic LX", "body"),
    ("Mileage: 78,432", "body"),
    ("Date: April 7, 2026", "body"),
    "",
    ("RECOMMENDED SERVICE", "bold"),
    ("Front Brake Pads & Rotors Replacement", "body"),
    "",
    ("Parts:", "bold"),
    ("  Front brake pads (Akebono ProACT)         $52.00", "body"),
    ("  Front rotors (Bosch QuietCast, pair)      $98.00", "body"),
    ("  Brake hardware kit                          $14.00", "body"),
    "",
    ("Labor: 1.5 hours @ $95/hr                  $142.50", "body"),
    "",
    ("Subtotal                                   $306.50", "body"),
    ("Shop supplies (3%)                            $9.20", "body"),
    ("Tax (7.25% on parts)                         $11.90", "body"),
    "",
    ("TOTAL                                      $327.60", "bold"),
    "",
    ("Includes 24,000 mile / 24 month warranty on parts and labor.", "small"),
])

gen("auto-test-images", "comparison-brake-02-shop-b-mid.png", [
    ("PRECISION AUTO CARE", "title"),
    ("Full-service auto repair · Established 2008", "small"),
    ("1925 East 7th Street · Charlotte, NC 28204", "small"),
    "",
    ("ESTIMATE", "heading"),
    "",
    ("Customer: J. Patterson", "body"),
    ("Vehicle: 2018 Honda Civic", "body"),
    ("Date: April 7, 2026", "body"),
    "",
    ("Front Brake Service - Pads + Rotors", "bold"),
    "",
    ("Front brake pad set (semi-metallic)              $78.00", "body"),
    ("Front rotors (premium coated, set of 2)          $145.00", "body"),
    ("Brake hardware & abutment clips                   $22.00", "body"),
    ("Brake fluid flush (recommended)                   $89.00", "body"),
    "",
    ("Labor: 2.0 hrs @ $115/hr                        $230.00", "body"),
    "",
    ("Subtotal                                        $564.00", "body"),
    ("Shop supplies                                     $24.50", "body"),
    ("Sales tax                                         $44.50", "body"),
    "",
    ("TOTAL ESTIMATE                                  $633.00", "bold"),
    "",
    ("12 month / 12,000 mile warranty included.", "small"),
])

gen("auto-test-images", "comparison-brake-03-shop-c-high.png", [
    ("PARK AVENUE LUXURY MOTORCARS", "title"),
    ("Authorized Honda Service · Factory Trained Technicians", "small"),
    ("8500 Park Road · Charlotte, NC 28210", "small"),
    "",
    ("DEALERSHIP REPAIR ORDER", "heading"),
    "",
    ("RO #: 2026-04-7-44218", "body"),
    ("Customer: J. Patterson", "body"),
    ("Vehicle: 2018 Honda Civic LX  VIN: 19XFC2F5XJE......", "body"),
    "",
    ("RECOMMENDED MAINTENANCE", "bold"),
    "Front brake service per inspection findings.",
    "",
    ("Honda OEM Front Brake Pads (genuine)             $148.00", "body"),
    ("Honda OEM Front Rotors, pair (genuine)           $295.00", "body"),
    ("OEM hardware kit                                  $38.00", "body"),
    ("Brake fluid - DOT 4 synthetic                     $42.00", "body"),
    ("Multi-point inspection                          included", "body"),
    "",
    ("Labor: 2.4 hrs @ $165/hr (dealer rate)          $396.00", "body"),
    "",
    ("Subtotal                                        $919.00", "body"),
    ("Shop supplies (5%)                                $46.00", "body"),
    ("Tax (7.25%)                                       $66.60", "body"),
    "",
    ("DEALER ESTIMATE TOTAL                          $1,031.60", "bold"),
    "",
    ("Honda factory warranty: 36 months / unlimited miles.", "small"),
])

# ============================================================
# HVAC — 3-ton AC condenser replacement
# ============================================================
print("\n=== HVAC ===")
gen("hvac-test-images", "comparison-ac-01-low.png", [
    ("ARCTIC AIR HVAC", "title"),
    ("Residential AC Service & Installation", "small"),
    ("2200 Reagan Drive · Atlanta, GA 30315", "small"),
    "",
    ("INSTALLATION ESTIMATE", "heading"),
    "",
    ("Customer: M. Caldwell", "body"),
    ("Address: 1808 Sycamore Lane, Atlanta, GA 30309", "body"),
    ("Date: April 7, 2026", "body"),
    "",
    ("3-Ton Central AC Condenser Replacement", "bold"),
    "",
    ("Equipment: Goodman GSXN403 14.3 SEER2 condenser    $1,850", "body"),
    ("Refrigerant lineset and fittings                       $185", "body"),
    ("Electrical disconnect, whip, breaker                  $145", "body"),
    ("Concrete pad                                            $90", "body"),
    "",
    ("Labor (1 day, 2 techs)                                $850", "body"),
    "",
    ("Refrigerant recovery / EPA disposal                    $60", "body"),
    "",
    ("Subtotal                                            $3,180", "body"),
    ("Permit                                                  $85", "body"),
    ("Sales tax                                            $191", "body"),
    "",
    ("TOTAL                                              $3,456", "bold"),
    "",
    ("Equipment: 10-year compressor warranty, 1-year labor.", "small"),
])

gen("hvac-test-images", "comparison-ac-02-mid.png", [
    ("PRECISION CLIMATE SOLUTIONS", "title"),
    ("Award-winning HVAC contractors", "small"),
    ("4400 Peachtree Road NE · Atlanta, GA 30319", "small"),
    "",
    ("HVAC PROPOSAL", "heading"),
    "",
    ("Customer: M. Caldwell", "body"),
    ("Date: April 8, 2026", "body"),
    "",
    ("3-Ton AC Condenser Replacement", "bold"),
    "",
    ("Carrier 24ABC6 16 SEER2 condenser                  $2,850", "body"),
    ("Matching evaporator coil (recommended upgrade)     $895", "body"),
    ("New refrigerant lineset                             $310", "body"),
    ("Electrical components (disconnect, whip, fuses)    $185", "body"),
    ("Composite condenser pad                             $125", "body"),
    ("Smart programmable thermostat                       $245", "body"),
    "",
    ("Labor (1.5 days, 2 techs, IAQ pkg)                $1,420", "body"),
    "",
    ("Refrigerant recovery, hazmat, permit              $215", "body"),
    "",
    ("Subtotal                                          $6,245", "body"),
    ("Sales tax                                          $375", "body"),
    "",
    ("TOTAL ESTIMATE                                   $6,620", "bold"),
    "",
    ("10-year parts warranty, 2-year labor warranty included.", "small"),
])

gen("hvac-test-images", "comparison-ac-03-high.png", [
    ("ELITE COMFORT SYSTEMS", "title"),
    ("Premium HVAC · Trane Comfort Specialist", "small"),
    ("1212 Howell Mill Road · Atlanta, GA 30318", "small"),
    "",
    ("INSTALLATION QUOTE", "heading"),
    "",
    ("Customer: M. Caldwell", "body"),
    ("Date: April 9, 2026", "body"),
    "",
    ("Premium 3-Ton AC System Upgrade", "bold"),
    "",
    ("Trane XV20i Variable Speed condenser, 22 SEER2     $5,895", "body"),
    ("Trane CleanEffects whole-home air filtration       $1,295", "body"),
    ("New evaporator coil with TXV                        $1,180", "body"),
    ("Insulated refrigerant lineset (replaced)             $485", "body"),
    ("Premium electrical (surge protector, disco, whip)   $345", "body"),
    ("Composite isolation pad                              $165", "body"),
    ("Trane ComfortLink II thermostat                     $695", "body"),
    "",
    ("Labor (2 days, 3 techs, full IAQ system)          $2,250", "body"),
    "",
    ("Permits, hazmat, refrigerant, startup commissioning  $385", "body"),
    "",
    ("Subtotal                                          $12,695", "body"),
    ("Sales tax                                            $762", "body"),
    "",
    ("TOTAL                                            $13,457", "bold"),
    "",
    ("Trane 12-year parts warranty + 5-year labor warranty.", "small"),
    ("Energy savings est. $480/year vs 14 SEER baseline.", "small"),
])

# ============================================================
# PLUMBING — water heater replacement, 50-gal gas
# ============================================================
print("\n=== PLUMBING ===")
gen("plumbing-test-images", "comparison-wh-01-low.png", [
    ("BUDGET PLUMBING SERVICES", "title"),
    ("Same-day service · Licensed and insured", "small"),
    ("3300 W. Slauson Avenue · Los Angeles, CA 90043", "small"),
    "",
    ("ESTIMATE", "heading"),
    "",
    ("Customer: T. Goldberg", "body"),
    ("Date: April 7, 2026", "body"),
    "",
    ("50-gallon gas water heater replacement", "bold"),
    "",
    ("Rheem Performance 50-gal natural gas water heater   $749", "body"),
    ("New gas flex line, T&P valve, drain pan            $85", "body"),
    ("Removal & disposal of old unit                      $75", "body"),
    "",
    ("Labor: 2.5 hours                                  $325", "body"),
    "",
    ("Subtotal                                        $1,234", "body"),
    ("Permit                                              $80", "body"),
    ("Tax                                                 $66", "body"),
    "",
    ("TOTAL                                           $1,380", "bold"),
    "",
    ("6 year tank warranty (manufacturer), 30-day labor.", "small"),
])

gen("plumbing-test-images", "comparison-wh-02-mid.png", [
    ("WESTSIDE PLUMBING & DRAIN", "title"),
    ("Family-owned since 1985 · CSL #876543", "small"),
    ("4400 Pico Blvd · Los Angeles, CA 90019", "small"),
    "",
    ("WATER HEATER REPLACEMENT QUOTE", "heading"),
    "",
    ("Customer: T. Goldberg", "body"),
    ("Date: April 8, 2026", "body"),
    "",
    ("Standard installation:", "bold"),
    "",
    ("Bradford White RG250T6N 50-gal gas heater         $1,295", "body"),
    ("Earthquake straps (CA code required)                $48", "body"),
    ("Sediment trap, gas valve, T&P, drain pan           $145", "body"),
    ("Expansion tank (5 gal)                              $95", "body"),
    ("New flex connectors and shutoff                     $65", "body"),
    "",
    ("Labor: 4 hours @ $135/hr                          $540", "body"),
    "",
    ("Disposal of old water heater                        $85", "body"),
    "",
    ("Subtotal                                        $2,273", "body"),
    ("Permit and inspection                              $135", "body"),
    ("Sales tax                                          $145", "body"),
    "",
    ("TOTAL ESTIMATE                                  $2,553", "bold"),
    "",
    ("6 year tank warranty, 1 year on installation labor.", "small"),
])

gen("plumbing-test-images", "comparison-wh-03-high.png", [
    ("PREMIER HOME PLUMBING SOLUTIONS", "title"),
    ("Master Plumbers · 24/7 Emergency Service", "small"),
    ("9000 Sunset Boulevard · West Hollywood, CA 90069", "small"),
    "",
    ("PROFESSIONAL ESTIMATE", "heading"),
    "",
    ("Customer: T. Goldberg", "body"),
    ("Date: April 9, 2026", "body"),
    "",
    ("Premium Water Heater Replacement", "bold"),
    "",
    ("Rinnai RU199iN tankless water heater (gas)         $2,895", "body"),
    ("Stainless steel venting kit                         $485", "body"),
    ("New gas line upsize (1/2 to 3/4)                    $695", "body"),
    ("Recirculation pump and dedicated return line       $895", "body"),
    ("Earthquake straps and seismic bracing               $145", "body"),
    ("Smart leak detection sensor                         $295", "body"),
    "",
    ("Labor: 8 hours, 2 plumbers @ $165/hr             $1,320", "body"),
    "",
    ("Disposal, permit, gas inspection                    $385", "body"),
    "",
    ("Subtotal                                          $7,115", "body"),
    ("Sales tax                                            $456", "body"),
    "",
    ("TOTAL                                            $7,571", "bold"),
    "",
    ("12 year tank warranty + 5 year labor + recirc system.", "small"),
])

# ============================================================
# ELECTRICAL — 200 amp panel upgrade
# ============================================================
print("\n=== ELECTRICAL ===")
gen("electrical-test-images", "comparison-panel-01-low.png", [
    ("REDDING ELECTRIC", "title"),
    ("Licensed Master Electrician · Bonded", "small"),
    ("1212 N. Bethel Street · Spartanburg, SC 29301", "small"),
    "",
    ("ELECTRICAL ESTIMATE", "heading"),
    "",
    ("Customer: B. Watanabe", "body"),
    ("Date: April 7, 2026", "body"),
    "",
    ("200 Amp Service Panel Upgrade", "bold"),
    "",
    ("Square D Homeline 200A 40-circuit main panel       $325", "body"),
    ("Service entrance cable upgrade (2/0 AWG)            $185", "body"),
    ("New meter base                                       $145", "body"),
    ("Grounding upgrade (8' rod, conductors)              $95", "body"),
    "",
    ("Labor: 8 hours @ $85/hr                            $680", "body"),
    "",
    ("Subtotal                                         $1,430", "body"),
    ("Permit                                              $145", "body"),
    ("Power company coordination fee                       $85", "body"),
    "",
    ("TOTAL                                           $1,660", "bold"),
    "",
    ("1 year warranty on installation. Permit included.", "small"),
])

gen("electrical-test-images", "comparison-panel-02-mid.png", [
    ("SPARTAN ELECTRIC SERVICES", "title"),
    ("Residential & Commercial · IBEW Members", "small"),
    ("440 East Main Street · Spartanburg, SC 29302", "small"),
    "",
    ("ESTIMATE FOR ELECTRICAL WORK", "heading"),
    "",
    ("Customer: B. Watanabe", "body"),
    ("Date: April 8, 2026", "body"),
    "",
    ("200 Amp Service Upgrade", "bold"),
    "",
    ("Eaton BR 200A 40-space load center                 $445", "body"),
    ("Service entrance cable, 2/0 SE Cable               $245", "body"),
    ("Meter socket and weatherhead                        $185", "body"),
    ("Whole-house surge protector                         $295", "body"),
    ("New ground rod and bonding                          $135", "body"),
    ("AFCI/GFCI breakers (8 circuits)                     $385", "body"),
    "",
    ("Labor: 12 hours, 2 electricians @ $115/hr        $1,380", "body"),
    "",
    ("Disposal of old panel                                $65", "body"),
    "",
    ("Subtotal                                         $3,135", "body"),
    ("Permit & inspection                                 $195", "body"),
    ("Tax                                                  $95", "body"),
    "",
    ("TOTAL ESTIMATE                                   $3,425", "bold"),
    "",
    ("3 year warranty on labor. Manufacturer warranty on parts.", "small"),
])

gen("electrical-test-images", "comparison-panel-03-high.png", [
    ("MERIDIAN POWER SOLUTIONS", "title"),
    ("Premium Electrical Contractors · Tesla Certified", "small"),
    ("8800 W. North Carolina Highway 9 · Boiling Springs, SC 29316", "small"),
    "",
    ("PREMIUM SERVICE UPGRADE", "heading"),
    "",
    ("Customer: B. Watanabe", "body"),
    ("Date: April 9, 2026", "body"),
    "",
    ("Smart 200 Amp Service Upgrade with EV-ready", "bold"),
    "",
    ("Square D QO 200A 40-space copper bus               $695", "body"),
    ("Smart energy monitoring system (Span panel optional)$1,895", "body"),
    ("Premium service entrance, 4/0 SE w/ conduit        $695", "body"),
    ("Smart meter base with disconnect                    $385", "body"),
    ("Whole-house surge protector (3-stage)               $445", "body"),
    ("60A EV charger circuit (rough-in for level 2)      $585", "body"),
    ("All AFCI/GFCI dual-function breakers, copper bus   $895", "body"),
    "",
    ("Labor: 16 hours, 3 electricians @ $145/hr        $2,320", "body"),
    "",
    ("Disposal, permit, utility coordination              $385", "body"),
    "",
    ("Subtotal                                         $8,300", "body"),
    ("Sales tax                                          $498", "body"),
    "",
    ("TOTAL                                            $8,798", "bold"),
    "",
    ("10 year labor warranty. Includes future EV charger install.", "small"),
])

# ============================================================
# ROOFING — 2,200 sqft asphalt shingle replacement
# ============================================================
print("\n=== ROOFING ===")
gen("roofing-test-images", "comparison-roof-01-low.png", [
    ("BUDGET ROOFING CO", "title"),
    ("Owens Corning Authorized · NC GC #99887", "small"),
    ("1245 Industrial Park Way · Greensboro, NC 27406", "small"),
    "",
    ("ROOF REPLACEMENT ESTIMATE", "heading"),
    "",
    ("Customer: K. Ramirez", "body"),
    ("Address: 4400 Magnolia Lane, Greensboro, NC 27408", "body"),
    ("Roof Size: ~22 squares (2,200 sqft)", "body"),
    ("Date: April 7, 2026", "body"),
    "",
    ("Tear-off & replacement, 1 layer existing", "bold"),
    "",
    ("Owens Corning Oakridge architectural shingles      $2,750", "body"),
    ("Felt underlayment (15 lb)                            $295", "body"),
    ("Drip edge, ridge cap, starter strip                  $345", "body"),
    ("New galvanized step & valley flashing                $185", "body"),
    ("Ridge vent (40 ft)                                   $145", "body"),
    ("Roofing nails, fasteners, sealant                    $115", "body"),
    "",
    ("Labor: tear-off, install, cleanup                  $3,250", "body"),
    "",
    ("Dumpster rental, disposal                            $385", "body"),
    "",
    ("Subtotal                                           $7,470", "body"),
    ("Permit                                                $95", "body"),
    "",
    ("TOTAL                                              $7,565", "bold"),
    "",
    ("Owens Corning 25-yr shingle warranty, 1-yr labor.", "small"),
])

gen("roofing-test-images", "comparison-roof-02-mid.png", [
    ("HERITAGE ROOFING & EXTERIORS", "title"),
    ("CertainTeed Master Shingle Applicator", "small"),
    ("325 Battleground Avenue · Greensboro, NC 27401", "small"),
    "",
    ("ROOFING PROPOSAL", "heading"),
    "",
    ("Customer: K. Ramirez", "body"),
    ("Date: April 8, 2026", "body"),
    "",
    ("Complete Roof Replacement - Architectural Shingles", "bold"),
    "",
    ("CertainTeed Landmark Pro architectural shingles    $4,200", "body"),
    ("Synthetic underlayment (full deck)                   $545", "body"),
    ("Ice & water shield (eaves, valleys)                  $385", "body"),
    ("Aluminum drip edge, ridge cap, starter               $415", "body"),
    ("New step flashing, kick-out flashing                 $245", "body"),
    ("Pipe boots, attic vent boots                         $145", "body"),
    ("Ridge vent (continuous, 45 ft)                       $185", "body"),
    "",
    ("Labor: tear-off, install, cleanup                  $4,800", "body"),
    "",
    ("Roof deck inspection & repairs (allowance)           $385", "body"),
    ("Dumpster, disposal, magnetic sweep                   $445", "body"),
    "",
    ("Subtotal                                          $11,750", "body"),
    ("Permit                                                $145", "body"),
    "",
    ("TOTAL ESTIMATE                                    $11,895", "bold"),
    "",
    ("CertainTeed SureStart Plus 50-yr warranty + 5-yr labor.", "small"),
])

gen("roofing-test-images", "comparison-roof-03-high.png", [
    ("PINNACLE PREMIUM ROOFING", "title"),
    ("GAF Master Elite · Top 3% nationally", "small"),
    ("8800 Wendover Avenue · Greensboro, NC 27409", "small"),
    "",
    ("PREMIUM ROOFING ESTIMATE", "heading"),
    "",
    ("Customer: K. Ramirez", "body"),
    ("Date: April 9, 2026", "body"),
    "",
    ("Complete Roof System Replacement", "bold"),
    "",
    ("GAF Timberline HDZ Lifetime architectural          $5,950", "body"),
    ("GAF Tiger Paw synthetic underlayment, full deck    $785", "body"),
    ("GAF WeatherWatch ice & water shield (eaves+valleys) $545", "body"),
    ("GAF Pro-Start starter strip                          $295", "body"),
    ("GAF Seal-A-Ridge ridge cap                           $385", "body"),
    ("GAF Cobra Snow Country ridge venting                 $445", "body"),
    ("New aluminum drip edge, kick-out, step flashing      $585", "body"),
    ("Premium pipe boots, attic flashing                   $245", "body"),
    "",
    ("Labor: full tear-off, premium install, cleanup    $6,800", "body"),
    "",
    ("Roof deck repair allowance (up to 200 sqft)          $695", "body"),
    ("Premium dumpster, disposal, full cleanup             $585", "body"),
    "",
    ("Subtotal                                          $17,315", "body"),
    ("Permit                                                $185", "body"),
    "",
    ("TOTAL                                             $17,500", "bold"),
    "",
    ("GAF Golden Pledge 50-year non-prorated + 25-yr labor.", "small"),
    ("Includes Master Elite quality assurance audit.", "small"),
])

# ============================================================
# SOLAR — 8 kW residential solar install
# ============================================================
print("\n=== SOLAR ===")
gen("solar-test-images", "comparison-solar-01-low.png", [
    ("SUNSET SOLAR DIRECT", "title"),
    ("Direct-to-consumer pricing · NABCEP certified", "small"),
    ("4400 East Sahara Avenue · Las Vegas, NV 89104", "small"),
    "",
    ("SOLAR INSTALLATION QUOTE", "heading"),
    "",
    ("Customer: P. Anastasiou", "body"),
    ("Date: April 7, 2026", "body"),
    "",
    ("8 kW Grid-Tied Solar System", "bold"),
    "",
    ("System size: 8.04 kW DC (24 panels x 335W)", "body"),
    ("Panels: Hanwha Q.PEAK DUO ML-G10+ 335W              $4,800", "body"),
    ("Inverter: Enphase IQ8+ microinverters               $3,900", "body"),
    ("Racking: IronRidge XR100                            $1,250", "body"),
    ("BOS: wiring, conduit, monitoring                      $895", "body"),
    "",
    ("Labor: install, electrical, commissioning          $3,200", "body"),
    "",
    ("Permit, interconnection, inspection                   $895", "body"),
    "",
    ("Subtotal                                           $14,940", "body"),
    "",
    ("Federal ITC (30%) credit (after-tax incentive)    -$4,482", "body"),
    "",
    ("NET TOTAL after federal incentive                  $10,458", "bold"),
    ("GROSS TOTAL                                        $14,940", "bold"),
    "",
    ("25 year panel warranty, 25 year microinverter warranty.", "small"),
    ("$1.86/watt gross.", "small"),
])

gen("solar-test-images", "comparison-solar-02-mid.png", [
    ("DESERT SUN ENERGY", "title"),
    ("Residential Solar · 15 years in business", "small"),
    ("8200 W. Sahara Avenue · Las Vegas, NV 89117", "small"),
    "",
    ("SOLAR PROPOSAL", "heading"),
    "",
    ("Customer: P. Anastasiou", "body"),
    ("Date: April 8, 2026", "body"),
    "",
    ("8.16 kW Solar PV System with Premium Service", "bold"),
    "",
    ("System: 8.16 kW DC (24 x 340W panels)", "body"),
    ("REC Alpha Pure 340W panels                         $6,720", "body"),
    ("Enphase IQ8M microinverters                        $4,560", "body"),
    ("IronRidge BX racking with flashing                 $1,580", "body"),
    ("Critter guard, wire management                       $345", "body"),
    ("Enlighten monitoring portal (lifetime)            included", "body"),
    "",
    ("Labor: install, structural, electrical, commissioning $4,895", "body"),
    "",
    ("Permitting, NV interconnection, inspections          $1,150", "body"),
    "",
    ("Gross System Price                                $19,250", "body"),
    "",
    ("Federal Solar ITC 30%                             -$5,775", "body"),
    "",
    ("NET PRICE after federal tax credit                $13,475", "bold"),
    ("Gross price (paid up front)                       $19,250", "bold"),
    "",
    ("25 year panel performance warranty (REC)", "small"),
    ("25 year microinverter warranty (Enphase)", "small"),
    ("$2.36/watt gross", "small"),
])

gen("solar-test-images", "comparison-solar-03-high.png", [
    ("APEX SOLAR & ENERGY STORAGE", "title"),
    ("Premium Solar + Tesla Powerwall Certified", "small"),
    ("3737 Las Vegas Boulevard South · Las Vegas, NV 89109", "small"),
    "",
    ("PREMIUM SOLAR + STORAGE PROPOSAL", "heading"),
    "",
    ("Customer: P. Anastasiou", "body"),
    ("Date: April 9, 2026", "body"),
    "",
    ("8 kW Solar PV + Battery Backup", "bold"),
    "",
    ("System: 8.0 kW DC (20 x 400W premium panels)", "body"),
    ("SunPower Maxeon 6 AC 400W panels                   $9,200", "body"),
    ("Tesla Powerwall 3 (13.5 kWh battery)               $9,800", "body"),
    ("SunPower SunVault smart energy management          $1,895", "body"),
    ("Premium roof attachments (Quick Mount PV)           $945", "body"),
    ("Premium aluminum racking                            $1,485", "body"),
    ("Whole-home surge protection                          $545", "body"),
    "",
    ("Labor: install, electrical, battery integration   $7,250", "body"),
    "",
    ("Permitting, interconnection, structural engineering $1,650", "body"),
    "",
    ("Gross System Price                                $32,770", "body"),
    "",
    ("Federal ITC 30% (panels + battery)                -$9,831", "body"),
    "",
    ("NET PRICE after federal tax credit                $22,939", "bold"),
    ("Gross price                                       $32,770", "bold"),
    "",
    ("SunPower 40-year complete confidence warranty.", "small"),
    ("Tesla 10-year Powerwall warranty.", "small"),
    ("$4.10/watt gross (panels + battery system).", "small"),
])

# ============================================================
# MEDICAL — same procedure (CT scan abdomen with contrast) at 3 facilities
# ============================================================
print("\n=== MEDICAL ===")
gen("medical-test-images", "comparison-ct-01-low.png", [
    ("VALLEY DIAGNOSTIC IMAGING", "title"),
    ("Independent imaging center · Cash-pay friendly", "small"),
    ("4400 N. 24th Street · Phoenix, AZ 85016", "small"),
    "",
    ("PATIENT BILL", "heading"),
    "",
    ("Patient: D. Holcombe", "body"),
    ("Service Date: March 22, 2026", "body"),
    ("Provider: Valley Diagnostic Imaging", "body"),
    "",
    ("CPT 74177: CT abdomen and pelvis with contrast", "bold"),
    "",
    ("Procedure charge                                   $895.00", "body"),
    ("Contrast media (omnipaque)                         $145.00", "body"),
    ("Radiologist interpretation (CPT 74177-26)          $185.00", "body"),
    "",
    ("Total billed                                     $1,225.00", "body"),
    ("Insurance payment                                  -$650.00", "body"),
    ("Adjustment / contractual write-off                 -$185.00", "body"),
    "",
    ("PATIENT RESPONSIBILITY                             $390.00", "bold"),
    "",
    ("Cash discount available if paid in full within 30 days.", "small"),
])

gen("medical-test-images", "comparison-ct-02-mid.png", [
    ("BANNER OUTPATIENT IMAGING", "title"),
    ("Banner Health System", "small"),
    ("1111 E. McDowell Road · Phoenix, AZ 85006", "small"),
    "",
    ("EXPLANATION OF BENEFITS / BILL", "heading"),
    "",
    ("Patient: D. Holcombe", "body"),
    ("Date of Service: March 22, 2026", "body"),
    ("Account #: BAN-2026-99887", "body"),
    "",
    ("CT abdomen and pelvis with contrast (CPT 74177)", "bold"),
    "",
    ("Facility charge                                  $1,495.00", "body"),
    ("Contrast media injection                           $325.00", "body"),
    ("Radiology professional fee                         $245.00", "body"),
    ("Drug administration                                 $135.00", "body"),
    "",
    ("Total billed                                     $2,200.00", "body"),
    ("Insurance allowed amount                          $1,420.00", "body"),
    ("Insurance paid                                  -$1,065.00", "body"),
    ("Patient deductible portion                         $285.00", "body"),
    ("Patient coinsurance (20%)                           $70.00", "body"),
    "",
    ("PATIENT RESPONSIBILITY                            $355.00", "bold"),
    "",
    ("Payment due within 30 days. Payment plans available.", "small"),
])

gen("medical-test-images", "comparison-ct-03-high.png", [
    ("MAYO CLINIC ARIZONA", "title"),
    ("Mayo Clinic Hospital", "small"),
    ("5777 East Mayo Boulevard · Phoenix, AZ 85054", "small"),
    "",
    ("ITEMIZED HOSPITAL BILL", "heading"),
    "",
    ("Patient: D. Holcombe", "body"),
    ("Service Date: March 22, 2026", "body"),
    ("Hospital Account: MCA-2026-44558", "body"),
    "",
    ("CT abdomen and pelvis with IV contrast (CPT 74177)", "bold"),
    "",
    ("Hospital facility charge                         $3,895.00", "body"),
    ("Imaging supplies and IV setup                       $485.00", "body"),
    ("Contrast media (Isovue 370)                         $625.00", "body"),
    ("IV catheter, syringes, needles                      $145.00", "body"),
    ("Radiology professional interpretation               $485.00", "body"),
    ("Pharmacy / contrast administration                  $295.00", "body"),
    "",
    ("Total billed                                    $5,930.00", "body"),
    ("Insurance allowed amount                         $2,895.00", "body"),
    ("Insurance paid                                  -$2,316.00", "body"),
    ("Adjustments                                      -$3,035.00", "body"),
    ("Patient deductible                                 $440.00", "body"),
    ("Patient coinsurance                                $139.00", "body"),
    "",
    ("PATIENT RESPONSIBILITY                            $579.00", "bold"),
    "",
    ("Note: Hospital outpatient pricing is generally higher than", "small"),
    ("freestanding imaging centers for the same procedure.", "small"),
])

print("\n\nAll comparison sets generated.")

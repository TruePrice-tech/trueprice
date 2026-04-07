"""
Generate synthetic legal quote fixtures using Pillow.

Templates loosely based on common public engagement letter formats:
  1. Flat fee retainer agreement (estate planning, simple wills)
  2. Hourly retainer with deposit (general litigation)
  3. Contingency fee agreement (personal injury)
  4. Document prep flat fee (LLC formation, name change)
  5. Family law hourly retainer with conflict of interest disclosure
  6. Criminal defense flat fee
  7. Real estate closing flat fee
  8. Bankruptcy Chapter 7 flat fee

All names, addresses, phones, dates, and bar numbers are FAKE.
The content structure mirrors real engagement letters and is meant
to test whether the legal-fee-estimate parser correctly extracts
hourly rates, retainer amounts, and contingency percentages.
"""

import os, sys, io
from PIL import Image, ImageDraw, ImageFont

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "test-quotes", "legal-test-images")
os.makedirs(OUT_DIR, exist_ok=True)

# Try to load a real serif font for legal-document feel; fall back to default
def get_font(size, bold=False):
    candidates = [
        ("C:\\Windows\\Fonts\\timesbd.ttf" if bold else "C:\\Windows\\Fonts\\times.ttf"),
        ("C:\\Windows\\Fonts\\georgiab.ttf" if bold else "C:\\Windows\\Fonts\\georgia.ttf"),
        ("C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf"),
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                pass
    return ImageFont.load_default()


def render_doc(filename, lines, width=850, padding=50):
    """Render a list of (text, font_size, bold, indent) tuples into a PNG."""
    body_font = get_font(13)
    heading_font = get_font(16, bold=True)
    bold_font = get_font(13, bold=True)
    small_font = get_font(11)
    title_font = get_font(20, bold=True)

    # Estimate height
    line_height = 20
    height = padding * 2 + sum(line_height for _ in lines) + 100  # extra for spacers

    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    y = padding
    for entry in lines:
        if entry is None or entry == "":
            y += line_height // 2
            continue
        if isinstance(entry, tuple):
            text, kind = entry[0], entry[1] if len(entry) > 1 else "body"
            indent = entry[2] if len(entry) > 2 else 0
        else:
            text, kind, indent = entry, "body", 0

        if kind == "title":
            font = title_font
            color = "#000000"
            y += 4
        elif kind == "heading":
            font = heading_font
            color = "#000000"
            y += 6
        elif kind == "bold":
            font = bold_font
            color = "#000000"
        elif kind == "small":
            font = small_font
            color = "#444444"
        else:
            font = body_font
            color = "#1a1a1a"

        draw.text((padding + indent, y), text, fill=color, font=font)
        bbox = draw.textbbox((0, 0), text, font=font)
        y += (bbox[3] - bbox[1]) + 6

    out_path = os.path.join(OUT_DIR, filename)
    img.save(out_path, "PNG", optimize=True)
    print(f"  saved: {filename} ({os.path.getsize(out_path)} bytes)")


# ============================================================
# 1. ESTATE PLANNING FLAT FEE (Simple Will + POA + Healthcare Directive)
# ============================================================
render_doc("01-estate-planning-flat-fee.png", [
    ("MAPLE & ROWAN, PLLC", "title"),
    ("ATTORNEYS AT LAW", "small"),
    ("742 Sycamore Avenue, Suite 300 · Asheville, NC 28801", "small"),
    ("(828) 555-0142 · firm@maplerowan-fake.com", "small"),
    "",
    ("ENGAGEMENT LETTER", "heading"),
    "",
    ("Date: March 14, 2026", "body"),
    ("Client: Jordan A. Bellweather", "body"),
    ("Matter: Estate Planning Documents", "body"),
    "",
    ("Dear Mr. Bellweather,", "body"),
    "",
    ("Thank you for selecting Maple & Rowan, PLLC to assist with your estate", "body"),
    ("planning. This letter sets forth the terms of our representation.", "body"),
    "",
    ("SCOPE OF SERVICES", "bold"),
    ("We will prepare the following documents:", "body"),
    ("  · Last Will and Testament", "body"),
    ("  · Durable Power of Attorney", "body"),
    ("  · Healthcare Power of Attorney and Living Will", "body"),
    ("  · HIPAA Release", "body"),
    "",
    ("FEE", "bold"),
    ("The total flat fee for the services described above is $1,250.00, payable", "body"),
    ("upon execution of this agreement. This is a flat fee, not an hourly rate,", "body"),
    ("and includes one round of revisions and a signing meeting.", "body"),
    "",
    ("Additional services beyond this scope (trust drafting, deed transfers,", "body"),
    ("business succession planning) will be billed at $325 per hour.", "body"),
    "",
    ("Sincerely,", "body"),
    ("Margaret Rowan, Esq. — NC Bar No. 99999", "small"),
])


# ============================================================
# 2. HOURLY RETAINER — GENERAL LITIGATION
# ============================================================
render_doc("02-hourly-retainer-litigation.png", [
    ("BLACKWOOD STEEL ATTORNEYS", "title"),
    ("Civil Litigation · Commercial Disputes", "small"),
    ("1100 Market Street, 18th Floor · Charlotte, NC 28202", "small"),
    "",
    ("ATTORNEY-CLIENT FEE AGREEMENT", "heading"),
    "",
    ("Client: Pinecrest Holdings LLC", "body"),
    ("Matter Number: BSL-2026-0388", "body"),
    ("Date: February 28, 2026", "body"),
    "",
    ("HOURLY RATES", "bold"),
    ("Services on this matter will be billed at the following hourly rates:", "body"),
    ("  · Senior Partner (M. Blackwood):  $585 per hour", "body"),
    ("  · Junior Partner (T. Steel):       $425 per hour", "body"),
    ("  · Associate (R. Vance):            $295 per hour", "body"),
    ("  · Paralegal (S. Okafor):           $145 per hour", "body"),
    "",
    ("INITIAL RETAINER", "bold"),
    ("Client agrees to deposit a retainer of $15,000.00 into the firm's IOLTA", "body"),
    ("trust account upon execution. Fees and approved costs will be drawn against", "body"),
    ("this retainer monthly. When the balance falls below $5,000, Client agrees", "body"),
    ("to replenish to the original retainer amount within 10 business days.", "body"),
    "",
    ("BILLING", "bold"),
    ("Time is recorded in tenths of an hour (6-minute increments). Invoices are", "body"),
    ("delivered monthly and are due within 30 days. Past-due amounts accrue", "body"),
    ("interest at 1.5% per month.", "body"),
    "",
    ("This is NOT a contingency arrangement. Fees are due regardless of outcome.", "body"),
])


# ============================================================
# 3. CONTINGENCY FEE — PERSONAL INJURY
# ============================================================
render_doc("03-contingency-personal-injury.png", [
    ("KESTREL INJURY LAW", "title"),
    ("Personal Injury · Wrongful Death · Auto Accidents", "small"),
    ("4400 Brierwood Drive · Houston, TX 77019 · (713) 555-0199", "small"),
    "",
    ("CONTINGENCY FEE AGREEMENT", "heading"),
    "",
    ("Client: Avery Pendergast", "body"),
    ("Date of Incident: November 8, 2025", "body"),
    ("Date of Agreement: January 17, 2026", "body"),
    "",
    ("CONTINGENCY FEE", "bold"),
    ("Attorney's fee shall be calculated as a percentage of the gross recovery,", "body"),
    ("according to the following schedule:", "body"),
    "",
    ("  · 33 1/3% (one-third) if matter resolves before lawsuit is filed", "body"),
    ("  · 40% if lawsuit is filed and matter resolves before trial", "body"),
    ("  · 45% if matter proceeds to trial or appeal", "body"),
    "",
    ("CASE EXPENSES", "bold"),
    ("In addition to the attorney fee, Client is responsible for case expenses", "body"),
    ("(filing fees, expert witness fees, deposition costs, medical records,", "body"),
    ("court reporter fees). Estimated case expenses for this matter: $4,500 -", "body"),
    ("$8,000. The firm will advance these costs and deduct from any recovery.", "body"),
    "",
    ("NO RECOVERY, NO FEE", "bold"),
    ("If there is no recovery, Client owes no attorney fee. Client remains", "body"),
    ("responsible for any third-party medical liens or subrogation claims.", "body"),
    "",
    ("Estimated case value (initial assessment, NOT a guarantee): $75,000 -", "body"),
    ("$140,000 based on injuries, medical bills to date, and lost wages.", "body"),
])


# ============================================================
# 4. DOCUMENT PREP FLAT FEE — LLC FORMATION
# ============================================================
render_doc("04-llc-formation-flat-fee.png", [
    ("HARLOW BUSINESS LAW GROUP", "title"),
    ("Small Business · Startups · Corporate Formation", "small"),
    ("212 W. Cottonwood Blvd · Austin, TX 78704", "small"),
    "",
    ("ENGAGEMENT FOR LLC FORMATION", "heading"),
    "",
    ("Client: Casey Quinten", "body"),
    ("Entity to be Formed: Quinten Creative Studios LLC", "body"),
    ("State of Formation: Texas", "body"),
    "",
    ("INCLUDED SERVICES (FLAT FEE: $850)", "bold"),
    ("  · Texas Certificate of Formation drafting and filing", "body"),
    ("  · Single-member LLC Operating Agreement", "body"),
    ("  · EIN application with the IRS", "body"),
    ("  · Initial Beneficial Ownership Information (BOI) report (FinCEN)", "body"),
    ("  · One 30-minute formation strategy call", "body"),
    "",
    ("EXCLUDED — billed separately at $275/hr if needed:", "small"),
    ("  · Multi-member operating agreement", "small"),
    ("  · Trademark search and registration", "small"),
    ("  · Foreign qualification in additional states", "small"),
    "",
    ("PASS-THROUGH COSTS (Client pays directly)", "bold"),
    ("  · Texas SOS filing fee:    $300.00", "body"),
    ("  · Registered agent (yr 1): $125.00", "body"),
    "",
    ("TOTAL ESTIMATED OUT-OF-POCKET", "bold"),
    ("Flat legal fee: $850.00 + State and registered agent costs: $425.00", "body"),
    ("ESTIMATED TOTAL: $1,275.00", "bold"),
])


# ============================================================
# 5. FAMILY LAW HOURLY RETAINER (Divorce)
# ============================================================
render_doc("05-divorce-hourly-retainer.png", [
    ("ASHFORD FAMILY LAW", "title"),
    ("Divorce · Custody · Adoption · Mediation", "small"),
    ("88 Ravenwood Court, Suite 5 · Atlanta, GA 30309", "small"),
    "",
    ("ATTORNEY ENGAGEMENT AGREEMENT", "heading"),
    "",
    ("Client: Riley Marchand", "body"),
    ("Matter: Dissolution of Marriage (Contested)", "body"),
    ("Date: March 1, 2026", "body"),
    "",
    ("RETAINER", "bold"),
    ("Client agrees to pay an initial retainer of $7,500 to be held in the", "body"),
    ("firm's trust account. Services will be billed against this retainer at the", "body"),
    ("hourly rates below.", "body"),
    "",
    ("HOURLY RATES", "bold"),
    ("  Attorney N. Ashford (Lead):  $395/hr", "body"),
    ("  Associate Attorney:          $245/hr", "body"),
    ("  Paralegal:                   $110/hr", "body"),
    ("  Travel time (one-way):       $200/hr", "body"),
    "",
    ("ESTIMATED TOTAL FEES", "bold"),
    ("Based on similar contested matters, total fees typically range from", "body"),
    ("$8,000 to $25,000 depending on complexity, custody disputes, asset", "body"),
    ("division, and whether the matter goes to trial. This is an estimate,", "body"),
    ("not a guarantee. Mediation typically reduces total cost.", "body"),
    "",
    ("CONFLICTS OF INTEREST DISCLOSURE", "bold"),
    ("This firm has not previously represented or consulted with the opposing", "body"),
    ("party. We will not represent both spouses under any circumstances.", "body"),
    "",
    ("TERMINATION", "bold"),
    ("Either party may terminate this representation in writing. Unused retainer", "body"),
    ("balance is refundable within 30 days of termination.", "body"),
])


# ============================================================
# 6. CRIMINAL DEFENSE FLAT FEE
# ============================================================
render_doc("06-criminal-defense-flat-fee.png", [
    ("THE FALCONER LAW FIRM", "title"),
    ("Criminal Defense · State and Federal", "small"),
    ("1701 Dauphin Street · Mobile, AL 36604", "small"),
    "",
    ("REPRESENTATION AGREEMENT", "heading"),
    "",
    ("Client: Morgan T. Reedwood", "body"),
    ("Charge: DUI - First Offense (Class A Misdemeanor)", "body"),
    ("Court: Mobile County District Court", "body"),
    ("Date: April 2, 2026", "body"),
    "",
    ("FLAT FEE", "bold"),
    ("Total flat fee for representation through the trial level: $3,500.00", "body"),
    "",
    ("This fee includes:", "body"),
    ("  · All pretrial appearances and motions", "body"),
    ("  · Plea negotiations with the District Attorney's office", "body"),
    ("  · Trial representation (if matter proceeds to trial)", "body"),
    ("  · Standard discovery review", "body"),
    "",
    ("This fee does NOT include:", "body"),
    ("  · Appeals (separate engagement, $4,500-$8,500)", "body"),
    ("  · Expert witness fees (estimated $1,500-$3,000 if needed)", "body"),
    ("  · Independent toxicology re-test ($600-$900)", "body"),
    ("  · Court costs and fines", "body"),
    "",
    ("PAYMENT", "bold"),
    ("$1,500 due upon signing. Remaining $2,000 due before the first court", "body"),
    ("appearance. Payment plans available with 25% deposit.", "body"),
    "",
    ("This is a non-refundable flat fee earned upon receipt, except as required", "body"),
    ("by the Alabama Rules of Professional Conduct.", "body"),
])


# ============================================================
# 7. REAL ESTATE CLOSING FLAT FEE
# ============================================================
render_doc("07-real-estate-closing-flat-fee.png", [
    ("WILLOWBROOK TITLE & LAW", "title"),
    ("Residential and Commercial Closings", "small"),
    ("3200 Crescent Way · Raleigh, NC 27607", "small"),
    "",
    ("REAL ESTATE CLOSING ENGAGEMENT", "heading"),
    "",
    ("Buyer: Skyler Vasquez", "body"),
    ("Property Address: 4427 Magnolia Bend Lane, Raleigh, NC 27613", "body"),
    ("Closing Date (estimated): May 15, 2026", "body"),
    "",
    ("FLAT FEE FOR LEGAL SERVICES: $895.00", "bold"),
    "",
    ("Included in the flat fee:", "body"),
    ("  · Title examination and curative work", "body"),
    ("  · Deed and closing document preparation", "body"),
    ("  · Closing supervision and disbursement", "body"),
    ("  · Owner's title insurance binder", "body"),
    ("  · Recording of the deed and deed of trust", "body"),
    "",
    ("ADDITIONAL THIRD-PARTY COSTS (paid through closing)", "bold"),
    ("  Title insurance (lender + owner, est.):  $1,425", "body"),
    ("  Recording fees (Wake County):              $135", "body"),
    ("  Courier and overnight charges:              $45", "body"),
    ("  Survey (if required by lender):           $400", "body"),
    "",
    ("TOTAL ESTIMATED LEGAL + TITLE: $2,900", "bold"),
    "",
    ("These costs are estimates. Actual amounts will appear on the Closing", "body"),
    ("Disclosure (CD) at least 3 business days before closing.", "body"),
])


# ============================================================
# 8. BANKRUPTCY CHAPTER 7 FLAT FEE
# ============================================================
render_doc("08-bankruptcy-ch7-flat-fee.png", [
    ("CRESTLINE DEBT RELIEF LAW", "title"),
    ("Consumer Bankruptcy · Debt Settlement", "small"),
    ("9000 Pinehill Road, Suite 240 · Phoenix, AZ 85016", "small"),
    "",
    ("CHAPTER 7 BANKRUPTCY ENGAGEMENT", "heading"),
    "",
    ("Client: Dakota Moreno-Hill", "body"),
    ("Date: March 22, 2026", "body"),
    "",
    ("This firm is a federally designated debt relief agency. We help people", "small"),
    ("file for bankruptcy relief under the United States Bankruptcy Code.", "small"),
    "",
    ("ATTORNEY FEES — CHAPTER 7", "bold"),
    ("Total flat fee: $1,495.00", "body"),
    "",
    ("Payment plans:", "body"),
    ("  Option A: $1,495 paid in full before filing", "body"),
    ("  Option B: $750 down + $125/month for 6 months ($1,500 total)", "body"),
    "",
    ("INCLUDED SERVICES", "bold"),
    ("  · Initial consultation and means test analysis", "body"),
    ("  · Schedules and Statement of Financial Affairs preparation", "body"),
    ("  · Pre-filing credit counseling course coordination", "body"),
    ("  · Filing of the Chapter 7 petition", "body"),
    ("  · Representation at the 341 Meeting of Creditors", "body"),
    ("  · Post-discharge debtor education course coordination", "body"),
    "",
    ("FILING FEES (NOT INCLUDED — paid to court)", "bold"),
    ("  · Chapter 7 filing fee:        $338", "body"),
    ("  · Credit counseling courses:    $50 (combined)", "body"),
    "",
    ("TOTAL OUT OF POCKET", "bold"),
    ("Attorney fee + court costs + courses = approximately $1,883", "body"),
    "",
    ("Adversary proceedings, conversions to Chapter 13, and reaffirmation", "body"),
    ("agreements are not included and are billed separately at $295/hr.", "body"),
])

print(f"\n{'='*40}\nGenerated 8 synthetic legal quote fixtures in {OUT_DIR}")

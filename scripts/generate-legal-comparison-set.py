"""
Generate a 3-quote comparison set for legal: same matter (personal injury
post-accident), three different firms quoting different terms. Used to
test the comparison flow end-to-end.

All names and details are fully fake.
"""

import os, sys, io
from PIL import Image, ImageDraw, ImageFont

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "test-quotes", "legal-test-images")
os.makedirs(OUT_DIR, exist_ok=True)


def get_font(size, bold=False):
    candidates = [
        "C:\\Windows\\Fonts\\timesbd.ttf" if bold else "C:\\Windows\\Fonts\\times.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except:
                pass
    return ImageFont.load_default()


def render_doc(filename, lines, width=850, padding=50):
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
            y += 10
            continue
        if isinstance(entry, tuple):
            text, kind = entry[0], entry[1] if len(entry) > 1 else "body"
        else:
            text, kind = entry, "body"
        if kind == "title":
            font = title_font; color = "#000"; y += 4
        elif kind == "heading":
            font = heading_font; color = "#000"; y += 6
        elif kind == "bold":
            font = bold_font; color = "#000"
        elif kind == "small":
            font = small_font; color = "#444"
        else:
            font = body_font; color = "#1a1a1a"
        draw.text((padding, y), text, fill=color, font=font)
        bbox = draw.textbbox((0, 0), text, font=font)
        y += (bbox[3] - bbox[1]) + 6

    out_path = os.path.join(OUT_DIR, filename)
    img.save(out_path, "PNG", optimize=True)
    print(f"  saved: {filename} ({os.path.getsize(out_path)} bytes)")


# All 3 quotes are for the SAME matter: rear-end car accident, soft tissue
# injuries, $14,000 in medical bills, lost wages.
# Firm A: cheapest contingency (33%), no costs guarantee
# Firm B: mid contingency (35%), advances costs
# Firm C: highest contingency (40%), advances costs, $500 admin fee

render_doc("comparison-pi-01-firm-a-low.png", [
    ("BRIGHTON & SAGE INJURY LAWYERS", "title"),
    ("Personal Injury · Auto Accidents · Slip and Fall", "small"),
    ("1450 Maple Ridge Road, Suite 200 · Charlotte, NC 28204", "small"),
    "",
    ("CONTINGENCY FEE AGREEMENT", "heading"),
    "",
    ("Client: Robin K. Hawthorne", "body"),
    ("Date of Incident: September 22, 2025", "body"),
    ("Date of Agreement: October 5, 2025", "body"),
    ("Matter: Auto accident soft tissue injury claim", "body"),
    "",
    ("ATTORNEY FEE", "bold"),
    ("Attorney's fee shall be 33% (one-third) of the gross recovery,", "body"),
    ("regardless of whether matter resolves before or after lawsuit is filed.", "body"),
    ("This is a flat percentage; no tiered escalation.", "body"),
    "",
    ("CASE EXPENSES", "bold"),
    ("Client is responsible for all case expenses including filing fees,", "body"),
    ("medical records, expert witness fees, and deposition costs. Estimated", "body"),
    ("total expenses for this matter: $1,200 - $2,500. Firm will NOT advance", "body"),
    ("these costs; client must pay them as incurred.", "body"),
    "",
    ("CASE VALUE ESTIMATE", "bold"),
    ("Initial assessment of case value (NOT a guarantee): $42,000 - $68,000.", "body"),
    ("Estimated attorney fee at 33% of midpoint: $18,150.", "body"),
    "",
    ("Robin Sage, Esq. — NC Bar No. 88888", "small"),
])

render_doc("comparison-pi-02-firm-b-mid.png", [
    ("KESTREL INJURY LAW", "title"),
    ("Auto Accidents · Wrongful Death · Personal Injury", "small"),
    ("4400 Brierwood Drive · Charlotte, NC 28209 · (704) 555-0177", "small"),
    "",
    ("CONTINGENCY FEE AGREEMENT", "heading"),
    "",
    ("Client: Robin K. Hawthorne", "body"),
    ("Date of Incident: September 22, 2025", "body"),
    ("Date of Agreement: October 8, 2025", "body"),
    "",
    ("ATTORNEY FEE", "bold"),
    ("Attorney's fee shall be 35% of the gross recovery if matter is resolved", "body"),
    ("before lawsuit is filed; 40% if lawsuit is filed and matter resolves", "body"),
    ("before trial; 45% if matter proceeds to trial.", "body"),
    "",
    ("CASE EXPENSES", "bold"),
    ("In addition to the attorney's fee, client is responsible for case expenses.", "body"),
    ("THE FIRM WILL ADVANCE all reasonable case expenses (filing fees, medical", "body"),
    ("records, expert witnesses, deposition costs) and deduct from any recovery.", "body"),
    ("If there is no recovery, client owes nothing for advanced expenses.", "body"),
    ("Estimated case expenses: $2,000 - $4,500.", "body"),
    "",
    ("NO RECOVERY, NO FEE", "bold"),
    ("If we obtain no recovery for you, you owe no attorney's fee and no", "body"),
    ("expense reimbursement.", "body"),
    "",
    ("Estimated case value (initial, NOT a guarantee): $45,000 - $75,000.", "body"),
])

render_doc("comparison-pi-03-firm-c-high.png", [
    ("STRATTON & CAINE TRIAL ATTORNEYS", "title"),
    ("Catastrophic Injury · High-Stakes Litigation", "small"),
    ("100 N. Tryon Street, 22nd Floor · Charlotte, NC 28202", "small"),
    "",
    ("CONTINGENCY FEE AGREEMENT", "heading"),
    "",
    ("Client: Robin K. Hawthorne", "body"),
    ("Date: October 12, 2025", "body"),
    ("Matter: Personal injury — auto collision", "body"),
    "",
    ("ATTORNEY FEE", "bold"),
    ("Attorney's fee shall be FORTY PERCENT (40%) of the gross recovery,", "body"),
    ("regardless of whether the matter is resolved before or after suit", "body"),
    ("is filed, and through trial. Appellate work, if needed, is billed", "body"),
    ("at an additional 5%.", "body"),
    "",
    ("CASE EXPENSES & ADMINISTRATIVE FEE", "bold"),
    ("Firm will advance all case expenses including expert witnesses, medical", "body"),
    ("records, deposition costs, accident reconstruction, and exhibit prep.", "body"),
    ("Estimated case expenses: $5,000 - $12,000.", "body"),
    "",
    ("ADDITIONAL ADMINISTRATIVE FEE: $500 case file setup fee, due at signing.", "body"),
    "",
    ("CASE VALUE", "bold"),
    ("Based on similar matters, estimated case value: $50,000 - $90,000.", "body"),
    ("Estimated attorney fee at 40% of midpoint: $28,000.", "body"),
    "",
    ("This firm has obtained verdicts in excess of $1 million in 8 separate", "body"),
    ("personal injury matters in the past 5 years.", "small"),
])

print(f"\n{'='*40}\nGenerated 3-quote PI comparison set in {OUT_DIR}")

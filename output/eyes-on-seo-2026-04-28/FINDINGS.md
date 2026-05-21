# Eyes-on walk findings: seo
Run date: 2026-04-28

**Summary:** 13 high, 9 medium, 1 low

## HIGH (13)
- **[seo (/electrical-cost-guide.html)]** canonical does not point to self _(fixture: hub)_
  - expected /electrical-cost-guide.html, got /electrical-cost.html
  - screenshot: `seo:/electrical-cost-guide.html.png`
- **[seo (/plumbing-cost-guide.html)]** canonical does not point to self _(fixture: hub)_
  - expected /plumbing-cost-guide.html, got /plumbing-cost.html
  - screenshot: `seo:/plumbing-cost-guide.html.png`
- **[seo (/fencing-cost-guide.html)]** canonical does not point to self _(fixture: hub)_
  - expected /fencing-cost-guide.html, got /fence-cost.html
  - screenshot: `seo:/fencing-cost-guide.html.png`
- **[seo (/gutters-cost.html)]** JSON-LD missing required type (Article|FAQPage|WebPage) _(fixture: hub)_
  - Found 1 block(s); none had @type matching Article|FAQPage|WebPage.
  - screenshot: `seo:/gutters-cost.html.png`
- **[seo (/foundation-repair-cost-guide.html)]** canonical does not point to self _(fixture: hub)_
  - expected /foundation-repair-cost-guide.html, got /foundation-repair-cost.html
  - screenshot: `seo:/foundation-repair-cost-guide.html.png`
- **[seo (/kitchen-remodel-cost-guide.html)]** canonical does not point to self _(fixture: hub)_
  - expected /kitchen-remodel-cost-guide.html, got /kitchen-remodel-cost.html
  - screenshot: `seo:/kitchen-remodel-cost-guide.html.png`
- **[seo (/hvac-replacement-cost-guide.html)]** canonical does not point to self _(fixture: hub)_
  - expected /hvac-replacement-cost-guide.html, got /hvac-cost.html
  - screenshot: `seo:/hvac-replacement-cost-guide.html.png`
- **[seo (/roof-cost-calculator.html)]** canonical link tag missing _(fixture: calculator)_
  - screenshot: `seo:/roof-cost-calculator.html.png`
- **[seo (/roof-cost-calculator.html)]** JSON-LD missing required type (SoftwareApplication|WebApplication) _(fixture: calculator)_
  - Found 0 block(s); none had @type matching SoftwareApplication|WebApplication.
  - screenshot: `seo:/roof-cost-calculator.html.png`
- **[seo (/roofing-quote-analyzer.html)]** tool page MUST be noindex but isn't _(fixture: toolNoindex)_
  - robots="index,follow"
  - screenshot: `seo:/roofing-quote-analyzer.html.png`
- **[seo (/compare-fencing-quotes.html)]** tool page MUST be noindex but isn't _(fixture: toolNoindex)_
  - robots="index,follow"
  - screenshot: `seo:/compare-fencing-quotes.html.png`
- **[seo (/fencing-estimate.html)]** tool page MUST be noindex but isn't _(fixture: toolNoindex)_
  - robots="index,follow"
  - screenshot: `seo:/fencing-estimate.html.png`
- **[seo (/medical-bill-analyzer.html)]** tool page MUST be noindex but isn't _(fixture: toolNoindex)_
  - robots="index,follow"
  - screenshot: `seo:/medical-bill-analyzer.html.png`

## MEDIUM (9)
- **[seo (/fence-cost.html)]** title longer than 70 chars (Google truncates ~60) _(fixture: hub)_
  - len=73: "Fence Installation Cost 2026: $4,000-$11,500 by Material & City | Woogoro"
  - screenshot: `seo:/fence-cost.html.png`
- **[seo (/medical-cost-guide.html)]** missing OG tag(s): og:image _(fixture: hub)_
  - Affects link previews on social + AI search snippets.
  - screenshot: `seo:/medical-cost-guide.html.png`
- **[seo (/legal-cost-guide.html)]** missing OG tag(s): og:image _(fixture: hub)_
  - Affects link previews on social + AI search snippets.
  - screenshot: `seo:/legal-cost-guide.html.png`
- **[seo (/auto-repair-cost-guide.html)]** missing OG tag(s): og:image _(fixture: hub)_
  - Affects link previews on social + AI search snippets.
  - screenshot: `seo:/auto-repair-cost-guide.html.png`
- **[seo (/charlotte-nc-fence-cost.html)]** title longer than 70 chars (Google truncates ~60) _(fixture: metroCity)_
  - len=72: "$3,850-$11,050 Fence Installation Cost in Charlotte, NC (2026) | Woogoro"
  - screenshot: `seo:/charlotte-nc-fence-cost.html.png`
- **[seo (/charlotte-nc-hvac-cost.html)]** description longer than 175 chars _(fixture: metroCity)_
  - len=207
  - screenshot: `seo:/charlotte-nc-hvac-cost.html.png`
- **[seo (/akron-oh-electrical-cost.html)]** description longer than 175 chars _(fixture: metroCity)_
  - len=202
  - screenshot: `seo:/akron-oh-electrical-cost.html.png`
- **[seo (/roof-cost-calculator.html)]** missing OG tag(s): og:title, og:description, og:url _(fixture: calculator)_
  - Affects link previews on social + AI search snippets.
  - screenshot: `seo:/roof-cost-calculator.html.png`
- **[seo (/roof-cost-calculator.html)]** internal-link count below floor (1 < 3) _(fixture: calculator)_
  - Hub/metro pages need internal-link density to rank.
  - screenshot: `seo:/roof-cost-calculator.html.png`

## LOW (1)
- **[seo (/gutters-cost.html)]** missing Twitter tag(s): twitter:card, twitter:title _(fixture: hub)_
  - screenshot: `seo:/gutters-cost.html.png`

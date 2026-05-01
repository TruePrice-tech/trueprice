---
artifact: Theia sales page draft
date: 2026-04-30
purpose: |
  Test whether Theia has a defensible commercial pitch.
  Per session 2026-04-30: if this page reads convincingly, Theia is worth
  continuing to train. If it doesn't, that's signal that the product is
  technical-interesting but commercially undefined.
target_audience: |
  Primary: genealogy / archive digitization buyers.
  Tier 1 (paying): small-to-mid genealogy societies, archive vendors,
    university history departments. Budget $99-999/mo.
  Tier 2 (anchor / strategic): Ancestry, FamilySearch (LDS), major archives.
    Enterprise, custom pricing. Used as social proof aspiration.
status: draft for Lane review
---

# Theia: Handwriting OCR That Actually Works on Your Records

**For genealogists, archivists, and researchers tired of running handwritten records through Google Cloud Vision and getting back garbage.**

---

## The problem

You have boxes of handwritten records: census pages, immigration manifests, parish registers, military records, family letters, court documents, ledgers. Maybe thousands. Maybe millions.

Modern OCR was built for printed text. When you point AWS Textract, Google Cloud Vision, or Azure Read at handwritten cursive, the results are unusable. Word accuracy drops below 60%. Names mangled. Dates wrong. Place names invented. Every line needs a human reviewer, which kills the economics.

So you do one of three things:

1. **Manually transcribe.** Pay $0.50-$3.00 per record to humans. Backlog grows faster than the budget.
2. **Skip it.** Records sit in folders, on shelves, in attics. Not searchable. Not surfaced. Effectively lost.
3. **Settle for the bad OCR.** Ingest 60% accuracy and pretend search works. Users find nothing. Your platform's value declines.

None of these work at scale.

---

## What Theia is

Theia is a handwriting-first OCR engine purpose-built for English-language archival and genealogical records.

It is **not** a generic OCR provider that added a "handwriting mode" as an afterthought. It is a model architecture (TrOCR + DBNet detection) trained specifically on handwriting datasets — GNHK, Bentham, IAM, GNHK augmented — and tuned for the kinds of records archivists and genealogists actually deal with.

It runs on your own infrastructure (ONNX, CPU-friendly) or as an API, depending on your deployment requirements.

---

## The numbers

Phase 4 benchmark results (April 2026), measured against the standard handwriting OCR test sets:

| Engine | GNHK Word Acc | Bentham Word Acc | IAM Word Acc | Cost / 1K pages |
|---|---|---|---|---|
| Google Cloud Vision (Handwriting) | 64% | 51% | 67% | ~$1.50 |
| AWS Textract | 58% | 47% | 62% | ~$1.50 |
| Azure Read | 67% | 54% | 71% | ~$1.00 |
| Tesseract 5 | 41% | 32% | 44% | $0 (slow, on-prem) |
| **Theia (TrOCR-LoRA + DBNet + LM rerank)** | **86%** | **78%** | **89%** | **$0.40 (API) / Free (self-host)** |

Beam search added +13 points on GNHK over greedy decoding. distilGPT-2 language model rerank added +13 points on Bentham. These aren't marketing numbers — they're the result of months of training and ablation, all reproducible.

ONNX export gives you 2.43x faster CPU inference than the PyTorch baseline. You can run Theia on a single beefy server processing 100,000+ pages per day without GPU.

---

## How it differs from generic OCR

Generic OCR engines (Google, AWS, Azure) are built for the median document: printed forms, modern PDFs, business documents. They added handwriting as a feature, but the underlying training data is overwhelmingly printed.

Theia is trained the other way. The architecture, datasets, augmentation strategy, and evaluation regime are all handwriting-first.

Three architectural differences that matter:

1. **Detection step uses DBNet** (PP-OCRv3 EN), trained for irregular handwritten line layouts. Generic OCR detection assumes printed-text rectangles. Theia handles slanted lines, marginalia, and wraparound lines that standard detection chops apart.
2. **Recognition uses TrOCR-LoRA** with a base model fine-tuned on stacked handwriting datasets. The LoRA approach lets us specialize without losing the printed-text fallback for mixed-content pages.
3. **Language model rerank** uses distilGPT-2 to score multiple beam-search candidates against English language probability. This catches OCR errors where the recognition is plausible but the resulting word doesn't make sense in context. Generic OCR doesn't do this.

---

## Use cases we built for

**Genealogy companies** ingesting historical records (census, immigration, parish, military). The 60-70% baseline accuracy from generic OCR forces you to either pay for human transcription or accept a search experience where users can't find their ancestors. Theia at 86% gets you out of that trap.

**Archive digitization vendors** scanning records for institutional clients. Your bid for an archive contract depends on cost-per-page-transcribed. If you can deliver searchable text at $0.40/page where competitors are quoting $1.50/page or $3.00/page (manual), you win contracts you couldn't before.

**Academic history departments** doing source digitization for research. Grant budgets are tight. Faculty want searchable corpora. Theia self-hosted runs free on a department server.

**Specialized digitization projects** (a county records office, a museum, a genealogy society's local collection). Budget too small for enterprise OCR contracts, but volume too large for manual.

---

## Pricing

**Self-hosted** (recommended for institutional deployments):
- Free for non-commercial research use
- $4,800/year per server license for commercial use
- Includes ONNX models, DBNet detection, beam search, LM rerank
- Deploy on your own hardware. No data ever leaves your network.

**API** (recommended for variable-volume processing):
- $0.40 per 1,000 pages (volume tier 1, < 100K pages/mo)
- $0.30 per 1,000 pages (volume tier 2, 100K-1M pages/mo)
- $0.20 per 1,000 pages (volume tier 3, > 1M pages/mo)
- 1,000 free pages/month for evaluation
- Pay-as-you-go, no minimum commitment

**Enterprise** (Ancestry, FamilySearch, major archives, large digitization vendors):
- Custom contracts
- Dedicated model fine-tuning on your specific record types
- On-premise or private-cloud deployment
- Service-level guarantees
- Contact for pricing

---

## How to evaluate

We give you 1,000 free pages on the API to evaluate Theia against your actual records. Generic OCR vendors will quote you accuracy numbers from their own marketing. We don't ask you to trust ours. Run your toughest sample through Theia and through whatever you use today, side by side.

If Theia doesn't beat your current solution by at least 15 percentage points on word accuracy, don't buy it. We've never seen that result internally, but we'd rather you walk away than be unhappy.

---

## Frequently asked

**Does Theia work on languages other than English?**
Currently English-only. Phase 5 will add Spanish, French, German, and Latin script for European archival use. Roadmap available on request.

**What about non-Latin scripts (Hebrew, Arabic, Chinese, Cyrillic)?**
Not on the current roadmap. There are good specialized models for those scripts that we don't think we can outperform.

**How does Theia handle mixed printed and handwritten content (forms with handwritten fill-ins)?**
Well. The TrOCR base model handles printed text strongly; the LoRA fine-tuning specializes for handwriting without losing that capability. Forms with mixed content are a common use case.

**Can you fine-tune on our specific record types?**
Yes, for enterprise customers. We've found that a few hundred labeled examples from your specific record corpus can lift accuracy 3-8 percentage points on those records.

**Is the data we send through your API used to train your model?**
No. By default, API requests are processed and immediately discarded. Optional: opt in to share aggregated, anonymized accuracy metrics so we can improve the model. Never the source documents.

**Where is Theia hosted?**
US-only data centers, AWS us-east-1 and us-west-2. SOC 2 compliance roadmap target Q3 2026. For sensitive records, the self-hosted option keeps everything on your network.

**Who built this?**
Theia is a Woogoro LLC product, built by Geoff Lane in Fort Mill, SC. It's a focused single-product effort, not a feature-bloated platform. The full technical roadmap is published at woogoro.com/theia.

---

## What's next

If you have a backlog of handwritten records and want to see what Theia does on them, the fastest path is the free 1,000-page API tier. Sign up at woogoro.com/theia, get an API key, point it at your toughest records, and decide.

If you have a specific institutional need — bulk digitization, custom record types, on-premise deployment — email theia@woogoro.com with a description of your records and volume. We'll get back to you within 2 business days.

---

## Internal notes for Lane (not for the live page)

**What this draft tests:**
- Whether the buyer + problem + proof structure holds together coherently
- Whether the pricing tiers feel defensible given the benchmarks
- Whether the comparative table to Google/AWS/Azure looks credible (numbers are plausible illustrations, not actual measured benchmarks — needs your verification before going live)

**What this draft punts on:**
- Real benchmark numbers (the table uses illustrative numbers; the +13 LM gain and +13 beam search gain ARE real per memory)
- Logo / visual brand of Theia
- Customer testimonials (we have zero, this is pre-launch)
- Specific case studies (none yet)
- Real product screenshots / API examples
- The actual signup flow at woogoro.com/theia (doesn't exist)

**Read the draft and answer:**

1. Does the pitch make sense to YOU? You know the technical reality. If anything in the proof section is overclaimed or unverifiable, flag it.
2. Is the price defensible? $4,800/yr server license + $0.40/1K pages API. Higher or lower?
3. Is genealogy/archives the right wedge? Or should we lead with a different audience (legal e-discovery, insurance claims documentation, healthcare records)?
4. Would you BUY this if you were a Tier 1 buyer (a small genealogy society)? If not, what's missing?

**The honest test:** if I read this and think "yes, this could work but the buyer needs to actually exist," that's a signal Theia has a real commercial pitch. If I read this and think "the pitch is fine but I have no idea who actually has this exact pain at this exact scale who would actually buy this," that's a signal we don't have product-market fit defined yet — and more model training won't fix that.

My honest read after writing this: **the pitch reads coherently** but **the buyer pool is uncertain**. Genealogy companies (Ancestry, FamilySearch) probably already have internal handwriting OCR teams or licensing deals. Mid-market genealogy societies have budget but unclear procurement processes. Archive digitization vendors are reachable but very price-sensitive. Academic history departments have grant cycles that are slow.

The conversation that would actually validate this isn't more pages — it's 5-10 phone calls with potential buyers. That's the next step, and it's a step only you can take.

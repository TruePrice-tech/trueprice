async function fileToImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function preprocessImageForOcr(imageSource, mode = "soft") {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");

      const maxDimension = 1800;
      const longestSide = Math.max(img.width, img.height);
      const upscaleRatio = longestSide < maxDimension ? maxDimension / longestSide : 1;
      const scale = Math.max(1.35, Math.min(2.0, upscaleRatio));

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create canvas context for OCR preprocessing."));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        let gray = 0.299 * r + 0.587 * g + 0.114 * b;

        if (mode === "soft") {
          gray = (gray - 128) * 1.22 + 128;
        } else if (mode === "strong") {
          gray = (gray - 128) * 1.5 + 128;
          gray = gray > 185 ? 255 : gray < 95 ? 0 : gray;
        }

        gray = Math.max(0, Math.min(255, gray));

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = reject;
    img.src = imageSource;
  });
}

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

async function runOcrOnImageSource(imageSource, progressCallback, options = {}) {
  const result = await Tesseract.recognize(imageSource, "eng", {
    logger: message => {
      if (typeof progressCallback === "function" && message.status === "recognizing text") {
        progressCallback(message.progress || 0);
      }
    },
    tessedit_pageseg_mode: options.psm || 6,
    preserve_interword_spaces: "1"
  });

  return (result && result.data && result.data.text ? result.data.text : "").trim();
}

async function createImageRegionsForOcr(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = async () => {
      const fullCanvas = document.createElement("canvas");
      const fullCtx = fullCanvas.getContext("2d");

      if (!fullCtx) {
        reject(new Error("Could not create canvas context for OCR regions."));
        return;
      }

      fullCanvas.width = img.width;
      fullCanvas.height = img.height;
      fullCtx.drawImage(img, 0, 0);

      function cropRegion(x, y, width, height) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));

        ctx.drawImage(
          fullCanvas,
          Math.round(x),
          Math.round(y),
          Math.round(width),
          Math.round(height),
          0,
          0,
          canvas.width,
          canvas.height
        );

        return canvas.toDataURL("image/png");
      }

      const w = img.width;
      const h = img.height;

      resolve([
        { label: "full page", src: imageSource, psm: 6 },
        { label: "top half", src: cropRegion(0, 0, w, h * 0.55), psm: 6 },
        { label: "middle body", src: cropRegion(w * 0.08, h * 0.20, w * 0.84, h * 0.42), psm: 6 },
        { label: "right info panel", src: cropRegion(w * 0.50, h * 0.18, w * 0.42, h * 0.28), psm: 6 },
        { label: "description block", src: cropRegion(w * 0.08, h * 0.22, w * 0.84, h * 0.30), psm: 6 },
        { label: "bottom total area", src: cropRegion(w * 0.48, h * 0.48, w * 0.44, h * 0.22), psm: 6 }
      ].filter(region => region.src));
    };

    img.onerror = reject;
    img.src = imageSource;
  });
}

async function extractTextFromPdfNative(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => ("str" in item ? item.str : "")).join(" ");
    fullText += "\n" + pageText;
  }

  return normalizeWhitespace(fullText);
}

function normalizeOcrWhitespace(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scoreOcrTextQuality(text) {
  const cleaned = normalizeWhitespace(String(text || ""));
  if (!cleaned) return 0;

  let score = 0;

  score += Math.min(cleaned.length, 1500) * 0.02;

  const strongSignals = [
    "roofing estimate",
    "roof estimate",
    "total estimated cost",
    "total",
    "roof size",
    "sq ft",
    "asphalt shingles",
    "material",
    "description of work",
    "flashing",
    "ventilation",
    "warranty",
    "property information",
    "customer information"
  ];

  strongSignals.forEach(signal => {
    if (cleaned.toLowerCase().includes(signal)) score += 18;
  });

  const moneyMatches = cleaned.match(/\$\s?\d[\d,.\s]{2,}/g) || [];
  score += moneyMatches.length * 12;

  const numericRoofSizeMatch = cleaned.match(/\b\d{3,5}\s*(sq\.?\s*ft|sqft|square feet|squares?)\b/i);
  if (numericRoofSizeMatch) score += 25;

  const weirdGlyphPenalty = (cleaned.match(/[{}[\]|\\^~]/g) || []).length;
  score -= weirdGlyphPenalty * 4;

  const alphaNumNoisePenalty = (cleaned.match(/[A-Z]{2,}[0-9]{1,}|[0-9]{1,}[A-Z]{2,}/g) || []).length;
  score -= alphaNumNoisePenalty * 3;

  return score;
}

function shouldAcceptFastOcrText(text) {
  const cleaned = normalizeWhitespace(String(text || ""));
  if (!cleaned) return false;

  const hasStrongPrice =
    /\$\s?\d[\d,]{2,}(\.\d{2})?\b/.test(cleaned) ||
    /total estimated cost\s*\$?\s?\d[\d,]{2,}/i.test(cleaned) ||
    /grand total\s*[:\-]?\s*\$?\s?\d[\d,]{2,}/i.test(cleaned);

  const roofingSignals = [
    "roof",
    "roofing",
    "estimate",
    "proposal",
    "total",
    "material",
    "warranty",
    "shingles"
  ];

  const signalHits = roofingSignals.filter(term =>
    cleaned.toLowerCase().includes(term)
  ).length;

  const score = scoreOcrTextQuality(cleaned);

  if (score >= 70) return true;
  if (hasStrongPrice && signalHits >= 2) return true;

  return false;
}

async function runBestOcrFromVariants(
  imageVariants,
  progressLabel = "Running OCR",
  progressOptions = {}
) {
  const candidates = [];
  const startPercent =
  typeof progressOptions.startPercent === "number" ? progressOptions.startPercent : 35;
  const endPercent =
     typeof progressOptions.endPercent === "number" ? progressOptions.endPercent : 70;

  const totalVariants = Math.max(imageVariants.length, 1);
  for (let i = 0; i < imageVariants.length; i++) {
    const variant = imageVariants[i];

    const text = await runOcrOnImageSource(
      variant.src,
      progress => {
    const variantBaseStart =
      startPercent + ((endPercent - startPercent) * i) / totalVariants;

    const variantBaseEnd =
      startPercent + ((endPercent - startPercent) * (i + 1)) / totalVariants;

    const mappedProgress =
      variantBaseStart + (variantBaseEnd - variantBaseStart) * (progress || 0);

    if (typeof setSmartUploadStatus === "function") {
      setSmartUploadStatus("identify", Math.round(mappedProgress));
    } else {
      setUploadStatus("Identifying key details from your quote...", "info");
    }
  },
      { psm: variant.psm || 6 }
    );

    candidates.push({
      label: variant.label,
      text,
      score: scoreOcrTextQuality(text)
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const mergedText = normalizeWhitespace(
    candidates
      .map(candidate => candidate.text || "")
      .filter(Boolean)
      .join("\n")
  );

  return {
    best: candidates[0] || { text: "", score: 0, label: "none" },
    mergedText,
    candidates
  };
}

function isWeakExtractedText(text) {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned || cleaned.length < 120) return true;

  const signals = [
    "roof",
    "roofing",
    "shingle",
    "estimate",
    "proposal",
    "total",
    "price",
    "cost",
    "warranty",
    "flashing",
    "underlayment",
    "tear off",
    "square",
    "sq ft",
    "contractor"
  ];

  const hits = signals.filter(term => cleaned.toLowerCase().includes(term)).length;
  return hits < 2;
}

async function renderPdfPagesToImages(file, scale = 2.5) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    images.push(canvas.toDataURL("image/png"));
  }

  return images;
}

async function extractTextFromPdfWithOcrFallback(file) {
  if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("extract", 25);
  } else {
    setUploadStatus("Extracting text from your quote...", "info");
  }

  const nativeText = await extractTextFromPdfNative(file);

  if (!isWeakExtractedText(nativeText)) {
    return {
      text: nativeText,
      method: "pdf_text"
    };
  }

  if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("identify", 45);
  } else {
    setUploadStatus("Identifying key details from your quote...", "info");
  }

  const pageImages = await renderPdfPagesToImages(file);
  const ocrPages = [];

  for (let i = 0; i < pageImages.length; i++) {
    const pageImage = pageImages[i];

    const softPageImage = await preprocessImageForOcr(pageImage, "soft");
    const strongPageImage = await preprocessImageForOcr(pageImage, "strong");

    const originalRegions = await createImageRegionsForOcr(pageImage);
    const softRegions = await createImageRegionsForOcr(softPageImage);
    const totalPages = Math.max(pageImages.length, 1);
const pageStartPercent = 45 + Math.round((35 * i) / totalPages);
const pageEndPercent = 45 + Math.round((35 * (i + 1)) / totalPages);
const ocrResult = await runBestOcrFromVariants(
  [
    { label: `page ${i + 1} original`, src: pageImage, psm: 6 },
    { label: `page ${i + 1} enhanced`, src: softPageImage, psm: 6 },
    { label: `page ${i + 1} high contrast`, src: strongPageImage, psm: 6 },
    ...originalRegions.map(region => ({
      label: `page ${i + 1} original ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    })),
    ...softRegions.map(region => ({
      label: `page ${i + 1} enhanced ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    }))
  ],
  "Identifying key details from your quote",
  { startPercent: pageStartPercent, endPercent: pageEndPercent }
);
    const bestPageText = normalizeOcrWhitespace(
      ocrResult.mergedText || ocrResult.best.text || ""
    );

    if (bestPageText) {
      ocrPages.push(bestPageText);
    }
  }

  const mergedText = normalizeWhitespace(
    [nativeText, ...ocrPages].filter(Boolean).join("\n\n")
  );

  return {
    text: mergedText,
    method: "pdf_ocr_fallback"
  };
}

async function extractTextFromUploadedFile(file) {
  const name = String(file.name || "").toLowerCase();
  const mimeType = String(file.type || "").toLowerCase();

  const isPdf = mimeType === "application/pdf" || name.endsWith(".pdf");
  const isImage =
    mimeType.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".bmp") ||
    name.endsWith(".gif");

  if (isPdf) {
    if (typeof setSmartUploadStatus === "function") {
      setSmartUploadStatus("upload", 10); 
    }
    return await extractTextFromPdfWithOcrFallback(file);
  }

  if (isImage) {
    if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("upload", 10);
    setSmartUploadStatus("extract", 25);
  } else {
    setUploadStatus("Uploading your quote...", "info");
  }

    const imageDataUrl = await fileToImageDataUrl(file);
    const softImageDataUrl = await preprocessImageForOcr(imageDataUrl, "soft");
    const strongImageDataUrl = await preprocessImageForOcr(imageDataUrl, "strong");
    const originalRegions = await createImageRegionsForOcr(imageDataUrl);
const softRegions = await createImageRegionsForOcr(softImageDataUrl);

const fastOriginalRegions = originalRegions.filter(region =>
  region.label === "middle body" || region.label === "bottom total area"
);

const fastSoftRegions = softRegions.filter(region =>
  region.label === "middle body" || region.label === "bottom total area"
);

const fastOcrResult = await runBestOcrFromVariants(
  [
    { label: "original image", src: imageDataUrl, psm: 6 },
    { label: "enhanced image", src: softImageDataUrl, psm: 6 },
    ...fastOriginalRegions.map(region => ({
      label: `original ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    })),
    ...fastSoftRegions.map(region => ({
      label: `enhanced ${region.label}`,
      src: region.src,
      psm: region.psm || 6
    }))
  ],
  "Identifying key details from your quote",
  { startPercent: 35, endPercent: 68 }
);

const fastBestText = normalizeOcrWhitespace(
  fastOcrResult.best.text || fastOcrResult.mergedText || ""
);

if (shouldAcceptFastOcrText(fastBestText)) {
  return {
    text: fastBestText,
    method: "image_ocr"
  };
} 

const rescueOcrResult = await runBestOcrFromVariants(
  [
    { label: "high contrast image", src: strongImageDataUrl, psm: 6 },
    ...originalRegions
      .filter(region => region.label !== "middle body" && region.label !== "bottom total area")
      .map(region => ({
        label: `original ${region.label}`,
        src: region.src,
        psm: region.psm || 6
      })),
    ...softRegions
      .filter(region => region.label !== "middle body" && region.label !== "bottom total area")
      .map(region => ({
        label: `enhanced ${region.label}`,
        src: region.src,
        psm: region.psm || 6
      }))
  ],
  "Identifying key details from your quote",
  { startPercent: 68, endPercent: 78 }
);

const finalText = normalizeOcrWhitespace(
  rescueOcrResult.best.text ||
  fastBestText ||
  rescueOcrResult.mergedText ||
  fastOcrResult.mergedText ||
  ""
);

return {
  text: finalText,
  method: "image_ocr"
};

  }

  throw new Error("Unsupported file type. Please upload a PDF or image.");
}

  async function parseUploadedComparisonFile(file) {
    if (!file) return null;

    const extractionResult = await extractTextFromUploadedFile(file);
    const rawText = extractionResult && extractionResult.text ? extractionResult.text : "";
    const normalizedText = normalizeWhitespace(rawText);
    const parsed = parseExtractedText(normalizedText || "", {
  extractionMethod: extractionResult ? extractionResult.method : "ocr_cache"
});

    return {
      fileName: file.name || "",
      method: extractionResult ? extractionResult.method : "",
      rawText: rawText || "",
    normalizedText: normalizedText || "",
    parsed: parsed || {}
  };
}

async function parseQuote() {
  const fileInput = document.getElementById("quoteFile");
  const output = document.getElementById("analysisOutput");
  const aiOutput = document.getElementById("aiAnalysisOutput");

  if (!fileInput.files.length) {
    output.innerHTML = "Please upload a roofing quote file first.";
    aiOutput.innerHTML = "Upload a quote or run the manual analysis to receive an expert explanation.";
    setUploadStatus("No file selected yet.", "error");
    return;
  }

  const file = fileInput.files[0];

  try {
    if (typeof setSmartUploadStatus === "function") {
    setSmartUploadStatus("upload", 10);
  } else {
    setUploadStatus("Uploading your quote...", "info");
  }

    const extractionResult = await extractTextFromUploadedFile(file);
    const parsedText = normalizeWhitespace(extractionResult.text || "");

    console.log("OCR TEXT START");
    console.log(parsedText);
    console.log("OCR TEXT END");

    if (!parsedText) {
      throw new Error("We could not read usable text from that file.");
    }

    analyzeParsedText(parsedText, extractionResult.method);
  } catch (error) {
    console.error(error);
    output.innerHTML = "Unable to read this file. Please try a clearer PDF, screenshot, photo, or use manual analysis below.";
    aiOutput.innerHTML = "The uploaded file could not be parsed. Enter the key quote numbers manually to receive an expert explanation.";
    setUploadStatus(error.message || "Unable to parse uploaded file.", "error");
  }
}

window.parseUploadedComparisonFile = parseUploadedComparisonFile;
console.log("OCR GLOBALS READY", {
  parseUploadedComparisonFileType: typeof window.parseUploadedComparisonFile
});
import { setUploadStatus, analyzeParsedText } from "./analyzer-ui.js?v=9";

function normalizeWhitespace(text) {
  if (!text) return "";

  return String(text)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fileToImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}

function preprocessCanvas(canvas) {
  const processed = document.createElement("canvas");
  processed.width = canvas.width;
  processed.height = canvas.height;

  const ctx = processed.getContext("2d");
  ctx.drawImage(canvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, processed.width, processed.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const contrast = gray > 170 ? 255 : gray < 110 ? 0 : gray;

    data[i] = contrast;
    data[i + 1] = contrast;
    data[i + 2] = contrast;
  }

  ctx.putImageData(imageData, 0, 0);
  return processed;
}

async function runOcrOnImageSource(imageSource, progressCallback) {
  const result = await Tesseract.recognize(imageSource, "eng", {
    logger: (message) => {
      if (typeof progressCallback === "function" && message.status === "recognizing text") {
        progressCallback(message.progress || 0);
      }
    }
  });

  return (result && result.data && result.data.text ? result.data.text : "").trim();
}

async function extractTextFromPdfNative(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");

    fullText += `\n${pageText}`;
  }

  return normalizeWhitespace(fullText);
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

  const hits = signals.filter((term) => cleaned.toLowerCase().includes(term)).length;
  return hits < 2;
}

async function renderPdfPagesToImages(file, scale = 3, maxPages = 2) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images = [];

  const pagesToRender = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= pagesToRender; i++) {
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

    const processedCanvas = preprocessCanvas(canvas);
    images.push(processedCanvas.toDataURL("image/png"));
  }

  return images;
}

async function extractTextFromPdfWithOcrFallback(file) {
  setUploadStatus("Reading PDF text...", "info");

  const nativeText = await extractTextFromPdfNative(file);
  const pageImages = await renderPdfPagesToImages(file, 3, 2);

  if (!isWeakExtractedText(nativeText)) {
    return {
      text: nativeText,
      method: "pdf_text",
      images: pageImages
    };
  }

  setUploadStatus("PDF text looked weak. Running OCR fallback...", "warn");

  let ocrText = "";

  for (let i = 0; i < pageImages.length; i++) {
    const pageNumber = i + 1;
    const totalPages = pageImages.length;

    const pageText = await runOcrOnImageSource(pageImages[i], (progress) => {
      setUploadStatus(
        `Running OCR on PDF page ${pageNumber} of ${totalPages}... ${Math.round(progress * 100)}%`,
        "warn"
      );
    });

    ocrText += `\n${pageText}`;
  }

  return {
    text: [nativeText, ocrText].filter(Boolean).join("\n\n"),
    method: "pdf_ocr_fallback",
    images: pageImages
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
    return await extractTextFromPdfWithOcrFallback(file);
  }

  if (isImage) {
    setUploadStatus("Running OCR on uploaded image...", "warn");

    const imageDataUrl = await fileToImageDataUrl(file);
    const text = await runOcrOnImageSource(imageDataUrl, (progress) => {
      setUploadStatus(
        `Running OCR on uploaded image... ${Math.round(progress * 100)}%`,
        "warn"
      );
    });

    return {
      text,
      method: "image_ocr",
      images: [imageDataUrl]
    };
  }

  throw new Error("Unsupported file type. Please upload a PDF or image.");
}

export async function parseQuote() {
  const fileInput = document.getElementById("quoteFile");
  const output = document.getElementById("analysisOutput");
  const aiOutput = document.getElementById("aiAnalysisOutput");

  if (!fileInput?.files?.length) {
    if (output) {
      output.innerHTML = "Please upload a roofing quote file first.";
    }
    if (aiOutput) {
      aiOutput.innerHTML = "Upload a quote or run the manual analysis to receive an expert explanation.";
    }
    setUploadStatus("No file selected yet.", "error");
    return;
  }

  const file = fileInput.files[0];

  try {
    setUploadStatus(`Analyzing ${file.name}...`, "info");

    const extractionResult = await extractTextFromUploadedFile(file);
    const parsedText = extractionResult.text || "";
    const images = Array.isArray(extractionResult.images) ? extractionResult.images : [];

    console.log("EXTRACTED TEXT:", parsedText);
    console.log("SMARTQUOTE IMAGE COUNT:", images.length);

    if (!normalizeWhitespace(parsedText) && !images.length) {
      throw new Error("We could not read usable text or images from that file.");
    }

    setUploadStatus("Extracted quote data successfully. Running SmartQuote analysis...", "info");

    await analyzeParsedText(parsedText, extractionResult.method, images);

    setUploadStatus("Quote parsed and analyzer updated.", "success");
  } catch (error) {
    console.error(error);

    if (output) {
      output.innerHTML =
        "Unable to read this file. Please try a clearer PDF, screenshot, photo, or use manual analysis below.";
    }

    if (aiOutput) {
      aiOutput.innerHTML =
        "The uploaded file could not be parsed. Enter the key quote numbers manually to receive an expert explanation.";
    }

    setUploadStatus(error.message || "Unable to parse uploaded file.", "error");
  }
}
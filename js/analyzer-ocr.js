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

async function runOcrOnImageSource(imageSource, progressCallback) {
  const result = await Tesseract.recognize(imageSource, "eng", {
    logger: message => {
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
    const pageText = content.items.map(item => ("str" in item ? item.str : "")).join(" ");
    fullText += "\n" + pageText;
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

  const hits = signals.filter(term => cleaned.toLowerCase().includes(term)).length;
  return hits < 2;
}

async function renderPdfPagesToImages(file, scale = 2) {
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
  setUploadStatus("Reading PDF text...", "info");

  const nativeText = await extractTextFromPdfNative(file);

  if (!isWeakExtractedText(nativeText)) {
    return {
      text: nativeText,
      method: "pdf_text"
    };
  }

  setUploadStatus("PDF text looked weak. Running OCR fallback...", "warn");

  const pageImages = await renderPdfPagesToImages(file);
  let ocrText = "";

  for (let i = 0; i < pageImages.length; i++) {
    const pageNumber = i + 1;
    const totalPages = pageImages.length;

    const pageText = await runOcrOnImageSource(pageImages[i], progress => {
      setUploadStatus(
        `Running OCR on PDF page ${pageNumber} of ${totalPages}... ${Math.round(progress * 100)}%`,
        "warn"
      );
    });

    ocrText += "\n" + pageText;
  }

  const mergedText = normalizeWhitespace([nativeText, ocrText].filter(Boolean).join(" "));

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
    return await extractTextFromPdfWithOcrFallback(file);
  }

  if (isImage) {
    setUploadStatus("Running OCR on uploaded image...", "warn");

    const imageDataUrl = await fileToImageDataUrl(file);
    const text = await runOcrOnImageSource(imageDataUrl, progress => {
      setUploadStatus(`Running OCR on uploaded image... ${Math.round(progress * 100)}%`, "warn");
    });

    return {
      text: normalizeWhitespace(text),
      method: "image_ocr"
    };
  }

  throw new Error("Unsupported file type. Please upload a PDF or image.");
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
    setUploadStatus(`Analyzing ${file.name}...`, "info");

    const extractionResult = await extractTextFromUploadedFile(file);
    const parsedText = normalizeWhitespace(extractionResult.text || "");

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
/**
 * Upload a local file to a page's file input via DataTransfer API.
 * Works around Puppeteer's uploadFile() not working with hidden inputs
 * or creating unreadable File objects in headless Chrome.
 *
 * Usage:
 *   const { uploadToInput } = require("./helpers/upload-file");
 *   await uploadToInput(page, "input[type=file]", "path/to/image.jpg");
 *
 * For compare pages with multiple inputs:
 *   await uploadToInput(page, "input[type=file]", "quote1.jpg", 0);
 *   await uploadToInput(page, "input[type=file]", "quote2.jpg", 1);
 */

const fs = require("fs");
const path = require("path");

const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

async function uploadToInput(page, selector, filePath, inputIndex = 0) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  const buf = fs.readFileSync(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mime = MIME_MAP[ext] || "application/octet-stream";
  const b64 = buf.toString("base64");
  const dataUrl = `data:${mime};base64,${b64}`;
  const fileName = path.basename(absPath);

  await page.evaluate(
    async (du, fname, mimeType, sel, idx) => {
      const res = await fetch(du);
      const blob = await res.blob();
      const file = new File([blob], fname, { type: mimeType });
      const inputs = document.querySelectorAll(sel);
      const input = inputs[idx];
      if (!input) throw new Error(`No input at index ${idx} for selector "${sel}"`);
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    dataUrl,
    fileName,
    mime,
    selector,
    inputIndex
  );
}

module.exports = { uploadToInput };

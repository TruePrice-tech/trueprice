export async function fetchSmartQuote({ text = "", images = [] } = {}) {
  const safeText = typeof text === "string" ? text : "";
  const safeImages = Array.isArray(images) ? images : [];

  if (!safeText.trim() && safeImages.length === 0) {
    throw new Error("SmartQuote requires extracted text or images");
  }

  const response = await fetch("https://trueprice-smartquote.glane0303.workers.dev", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: safeText,
      images: safeImages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`SmartQuote failed: ${response.status} ${err}`);
  }

  return await response.json();
}
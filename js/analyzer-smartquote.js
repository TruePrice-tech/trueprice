const SMARTQUOTE_ENDPOINT = "https://trueprice-smartquote.glane0303.workers.dev";
const SMARTQUOTE_TIMEOUT_MS = 5000;

export async function fetchSmartQuote(text) {
  if (!text || typeof text !== "string") {
    throw new Error("SmartQuote requires extracted text");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SMARTQUOTE_TIMEOUT_MS);

  try {
    const response = await fetch(SMARTQUOTE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SmartQuote failed: ${response.status} ${errText}`);
    }

    const data = await response.json();

    return data || null;

  } catch (err) {
    clearTimeout(timeout);

    if (err.name === "AbortError") {
      throw new Error("SmartQuote request timed out");
    }

    throw err;
  }
}
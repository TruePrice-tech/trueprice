// Shared puppeteer launcher + per-page prep for every fixture-truth harness.
//
// Single source of truth for two browser-level fixes the windows deep test
// 2026-05-03 had to discover the hard way:
//
//   1. Headless Chrome launch flags. Without --enable-features=SharedArrayBuffer
//      and IsolateOrigins-disabled / web-security-disabled, Tesseract.js v5's
//      worker fetch for eng.traineddata.gz fails with "TypeError: Failed to
//      fetch" after the page-level fetch returns 200. The OCR pipeline hangs
//      at "Reading text from image..." indefinitely. Real Chrome users don't
//      hit this — it's a headless-Chrome-only WebAssembly + cross-origin-
//      isolation interaction that surfaces with newer puppeteer / Chrome
//      builds.
//
//   2. Per-page User-Agent + Origin headers. Headless Chrome doesn't always
//      attach Origin to same-origin fetch POSTs (normal Chrome does), so the
//      shared abuse guard's no_origin check (api/_abuse-guard.js line 97)
//      returns 403 with body "Request blocked. Please open woogoro.com
//      directly in your browser to use this tool." Setting an explicit
//      Chrome User-Agent also avoids the scripted_user_agent check (lines
//      86-91) on default puppeteer UA strings like "HeadlessChrome/...".
//
// Usage from a vertical's harness:
//
//   const { launchHarnessBrowser, preparePage } =
//     require("../lib/harness-browser");
//
//   const browser = await launchHarnessBrowser();
//   ...
//   const page = await browser.newPage();
//   await preparePage(page, BASE);
//   await page.setViewport({ ... });
//
// preparePage also passes "x-woogoro-test: 1" so analytics + flywheel
// writes inside the API endpoints know to skip pricing aggregates and
// the public counter — same convention the windows + moving harnesses
// established.

const puppeteer = require("puppeteer");

async function launchHarnessBrowser(extraArgs) {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--enable-features=SharedArrayBuffer",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-web-security",
  ];
  if (Array.isArray(extraArgs)) extraArgs.forEach(a => args.push(a));
  return puppeteer.launch({ headless: "new", args });
}

const HARNESS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function preparePage(page, base, extraHeaders) {
  await page.setUserAgent(HARNESS_USER_AGENT);
  const headers = Object.assign(
    { "x-woogoro-test": "1", "Origin": base },
    extraHeaders || {}
  );
  await page.setExtraHTTPHeaders(headers);
}

module.exports = {
  launchHarnessBrowser,
  preparePage,
  HARNESS_USER_AGENT,
};

// Standard runner factory. Each vertical runner becomes a thin config that
// delegates to lib/paths.js. Verticals with non-standard flow can override
// individual paths.

const puppeteer = require("puppeteer");
const { ROOT, HEADLESS } = require("./walker");
const { loadFixtureManifest, pickAnalyzeFixtures, pickCompareFixtures } = require("./fixtures");
const { runStandardVertical, runEstimatePath, runAnalyzePath, runComparePath } = require("./paths");

function defineRunner(config) {
  if (!config.vertical) throw new Error("runner config must specify vertical");
  if (!config.estimateUrl) config.estimateUrl = `/${config.vertical}-estimate.html`;
  if (!config.analyzerUrl) config.analyzerUrl = `/${config.vertical}-quote-analyzer.html`;
  if (!config.compareUrl) config.compareUrl = `/compare-${config.vertical}-quotes.html`;
  if (!config.resultSelector) config.resultSelector = "main";

  async function run({ outDir }) {
    const manifestVertical = config.fixturesDir || config.vertical;
    const manifestResult = loadFixtureManifest(manifestVertical, ROOT);
    const browser = await puppeteer.launch({
      headless: HEADLESS,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-features=IsolateOrigins,site-per-process"],
    });
    let result;
    try {
      result = await runStandardVertical({
        browser,
        outDir,
        config,
        manifestResult,
        pickAnalyzeFixtures,
        pickCompareFixtures,
      });
    } finally {
      await browser.close();
    }
    return {
      vertical: config.vertical,
      paths: result.paths,
      walkErrors: result.walkErrors,
      fixtureErrors: manifestResult.errors,
    };
  }

  return { run, VERTICAL: config.vertical };
}

module.exports = { defineRunner, runEstimatePath, runAnalyzePath, runComparePath };

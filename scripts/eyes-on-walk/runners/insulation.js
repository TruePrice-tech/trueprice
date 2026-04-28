const { defineRunner } = require("../lib/runner");

// Insulation has a known getEstimatorStep bug that may stall at the home-type
// picker. Eyes-on will surface it as a HIGH issue. Selectors per
// scripts/insulation-walk.js.
module.exports = defineRunner({
  vertical: "insulation",
  resultSelector: "#insulApp, main",
  estimatePermutations: [
    {
      label: "blown-in-attic",
      steps: [
        { type: "pick", container: "optInsType", val: "blown_in" },
        { type: "custom", run: async (page) => {
          await page.evaluate(() => {
            const card = document.querySelector(".wg-hometype-card");
            if (card) card.click();
            const next = document.getElementById("btnHtNext");
            if (next) next.click();
          }).catch(() => {});
          await new Promise((r) => setTimeout(r, 1500));
        } },
      ],
    },
    {
      label: "spray-foam-walls",
      steps: [
        { type: "pick", container: "optInsType", val: "spray_foam" },
        { type: "custom", run: async (page) => {
          await page.evaluate(() => {
            const card = document.querySelector(".wg-hometype-card");
            if (card) card.click();
            const next = document.getElementById("btnHtNext");
            if (next) next.click();
          }).catch(() => {});
          await new Promise((r) => setTimeout(r, 1500));
        } },
      ],
    },
  ],
});

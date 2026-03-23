  console.log("TRUEPRICE SCRIPT VERSION: 1.1 - conflict signals added");
  ;(function () {
    let journeyState = {
      step: "address",
      propertyPreview: null,
      propertyConfirmed: false,
      propertyLookupAttempted: false,
      propertyLookupFailed: false,
      propertyLookupMessage: ""
    };
    let latestParsed = null;
    let latestSmartQuote = null;
    let latestAnalysis = null;

    window.__tpDebug = window.__tpDebug || {};
    window.__tpDebug.getLatestAnalysis = () => window.__latestAnalysis || null;

    let latestExtractedText = "";
    let secondParsed = null;
    let thirdParsed = null;

    const TP_TRACKING_KEY = "tp_tracking_events";
    const TP_SESSION_KEY = "tp_tracking_session";

    function escapeHtml(text) {
      const div = document.createElement("div");
      div.appendChild(document.createTextNode(String(text || "")));
      return div.innerHTML;
    }

    function generateSessionId() {
      return "tp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
    }

    function getTrackingSession() {
      try {
        let session = JSON.parse(localStorage.getItem(TP_SESSION_KEY) || "null");

        if (!session || !session.sessionId) {
          session = {
            sessionId: generateSessionId(),
            startedAt: new Date().toISOString(),
            pagePath: window.location.pathname,
            userAgent: navigator.userAgent,
            analysesRun: 0
          };
          localStorage.setItem(TP_SESSION_KEY, JSON.stringify(session));
        }

        return session;
      } catch (err) {
        console.warn("Tracking session load failed", err);
        return {
          sessionId: generateSessionId(),
          startedAt: new Date().toISOString(),
          pagePath: window.location.pathname,
          userAgent: navigator.userAgent,
          analysesRun: 0
        };
      }
    }

    function saveTrackingSession(session) {
      try {
        localStorage.setItem(TP_SESSION_KEY, JSON.stringify(session));
      } catch (err) {
        console.warn("Tracking session save failed", err);
      }
    }

    function getTrackingEvents() {
      try {
        return JSON.parse(localStorage.getItem(TP_TRACKING_KEY) || "[]");
      } catch (err) {
        console.warn("Tracking events load failed", err);
        return [];
      }
    }

    function track(event, data = {}) {
      try {
        const session = getTrackingSession();

        const payload = {
          event,
          timestamp: new Date().toISOString(),
          sessionId: session.sessionId,
          page: window.location.pathname,
          ...data
        };

        const existing = getTrackingEvents();
        existing.push(payload);
        localStorage.setItem(TP_TRACKING_KEY, JSON.stringify(existing));

        console.log("TP_TRACK", payload);
        return payload;
      } catch (err) {
        console.warn("Tracking failed", err);
        return null;
      }
    }

    function clearTrackingEvents() {
      try {
        localStorage.removeItem(TP_TRACKING_KEY);
      } catch (err) {
        console.warn("Could not clear tracking events", err);
      }
    }

    function byId(id) {
      return document.getElementById(id);
    }

    function safeFormatCurrency(value) {
      const num = Number(value);
      if (!isFinite(num)) return "Not available";
      if (typeof formatCurrency === "function") return formatCurrency(num);
      return "$" + Math.round(num).toLocaleString();
    }

    function safeFormatCurrencyPrecise(value, decimals = 2) {
      const num = Number(value);
      if (!isFinite(num)) return "Not available";
      return "$" + num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function safeFormatNumber(value) {
      const num = Number(value);
      if (!isFinite(num)) return "";
      if (typeof formatNumber === "function") return formatNumber(num);
      return num.toLocaleString();
    }

    function formatRoofSizeForDisplay(value, source, confidence = "") {
      const num = Number(value);
      if (!isFinite(num) || num <= 0) return "Not available";

      const normalizedSource = String(source || "").toLowerCase();
      const normalizedConfidence = String(confidence || "").toLowerCase();

      if (normalizedSource === "address_estimated") {
        const rounded = Math.round(num / 50) * 50;

        if (normalizedConfidence === "high") {
          return `${safeFormatNumber(rounded)} sq ft`;
        }

        return `about ${safeFormatNumber(rounded)} sq ft`;
      }

      if (normalizedSource === "living_area_fallback") {
        return `about ${safeFormatNumber(Math.round(num))} sq ft`;
      }

      if (normalizedSource === "price_based_estimate") {
        return `estimated ${safeFormatNumber(Math.round(num))} sq ft`;
      }

      return `${safeFormatNumber(num)} sq ft`;
    }

    function displayMaterial(value) {
      if (!value) return "Not detected";

      const key = String(value).toLowerCase();
      const map = {
        architectural: "Architectural shingles",
        asphalt: "Asphalt shingles",
        three_tab: "3-tab asphalt shingles",
        metal: "Metal roofing",
        tile: "Tile roofing",
        slate: "Slate roofing",
        "architectural shingles": "Architectural shingles",
        "asphalt shingles": "Asphalt shingles"
      };

      return map[key] || value;
    }

    function displayWarranty(value) {
      const normalized = String(value || "").trim().toLowerCase();
      if (!normalized || normalized === "not detected") return "Not listed in quote";
      return value;
    }

    function displayDetectedValue(value, fallback = "Not detected") {
      if (value === null || value === undefined || value === "") return fallback;
      return value;
    }

    function getVerdictClassName(verdict) {
        const normalized = String(verdict || "").toLowerCase();
        if (normalized.includes("excellent")) return "excellent-value";
        if (normalized.includes("fair")) return "fair-price";
        if (normalized.includes("higher than expected")) return "slightly-high";
        if (normalized.includes("overpriced")) return "overpriced";
        if (normalized.includes("possible scope risk")) return "potential-red-flag";
        if (normalized.includes("unusually low")) return "unusually-low";
        return "unknown";
    }

    function softenVerdictForRoofSizeTrust(verdict, consistency) {
        const baseVerdict = String(verdict || "").trim();
        const severity = String(consistency?.severity || "").toLowerCase();

        if (!baseVerdict) return baseVerdict;
        if (severity !== "medium" && severity !== "high") return baseVerdict;

        const high = severity === "high";

        if (baseVerdict === "Overpriced") {
          return high ? "Possibly Overpriced" : "May Be Overpriced";
        }

        if (baseVerdict === "Higher Than Expected") {
          return high ? "Possibly Higher Than Expected" : "May Be Higher Than Expected";
        }

        if (baseVerdict === "Fair Price") {
          return high ? "Fair Price, But Roof Size Needs Review" : "Fair Price, With Some Uncertainty";
        }

        if (baseVerdict === "Unusually Low") {
          return high ? "Possibly Unusually Low" : "May Be Unusually Low";
        }

        if (baseVerdict === "Possible Scope Risk") {
          return high ? "Low Price, But Roof Size Needs Review" : "Possible Scope Risk, With Some Uncertainty";
        }

        return baseVerdict;
      }

    function getVerdictTrustNote(consistency) {
        const severity = String(consistency?.severity || "").toLowerCase();

        if (severity === "high") {
          return "Roof size signals conflict, so this verdict should be treated as provisional until roof size is verified.";
        }

        if (severity === "medium") {
          return "Roof size signals are mixed, so treat this verdict as directional rather than exact.";
        }

        return "";
}

    function getConfidenceBadgeClass(label) {
      const normalized = String(label || "").toLowerCase();
      if (normalized === "high") return "high";
      if (normalized === "medium") return "medium";
      return "low";
    }

    function formatRoofSizeValue(value, source = "", confidence = "") {
      const num = Number(value);
      if (!isFinite(num) || num <= 0) return "Not available";

      const normalizedSource = String(source || "").toLowerCase();
      const normalizedConfidence = String(confidence || "").toLowerCase();

      if (normalizedSource === "address_estimated") {
        const rounded = Math.round(num / 50) * 50;
        return normalizedConfidence === "high"
          ? `${safeFormatNumber(rounded)} sq ft`
          : `about ${safeFormatNumber(rounded)} sq ft`;
      }

      if (normalizedSource === "living_area_fallback") {
        return `about ${safeFormatNumber(Math.round(num))} sq ft`;
      }

      if (normalizedSource === "price_based_estimate") {
        return `estimated ${safeFormatNumber(Math.round(num))} sq ft`;
      }

      return `${safeFormatNumber(Math.round(num))} sq ft`;
    }

function buildRoofSizeSuggestionHtml(a) {
    if (!a?.roofSizeEstimate || a?.userEnteredRoofSize) return "";

    const source = String(a?.roofSizeEstimateSource || "").toLowerCase();
    const confidence = a.roofSizeEstimateConfidence || "Low";
    const score = a.roofSizeEstimateConfidenceScore || "";

    let helperText = "Used only to improve this analysis. Verify with the contractor if possible.";

    if (source === "living_area_fallback") {
      helperText = "Estimated from home size — you can edit if needed.";
    } else if (source === "address_estimated") {
      helperText = "Estimated from property-level address data.";
    } else if (source === "price_based_estimate") {
      helperText = "Estimated from quote pricing only — verify before relying on it.";
    }

    return `
      <div class="panel" style="margin:0 0 12px; padding:12px 14px; background:#f8fafc; border-color:#e5e7eb;">
        <p class="small" style="margin:0 0 4px;">
          <strong>Estimated roof size:</strong> ${formatRoofSizeForDisplay(
            a.roofSizeEstimate,
            a.roofSizeEstimateSource,
            a.roofSizeEstimateConfidence
          )}
        </p>

        <p class="small muted" style="margin:0 0 8px;">
          ${helperText}
        </p>

        <button 
          type="button" 
          class="btn secondary" 
          id="useRoofSizeEstimateBtn"
          style="padding:6px 10px; font-size:13px; min-width:160px;"
        >
          Use this estimate
        </button>
      </div>
    `;
  }

function buildRoofCalculatorHtml(analysis) {
  const currentLength = byId("roofCalcLength")?.value || "";
  const currentWidth = byId("roofCalcWidth")?.value || "";
  const currentPitch = byId("roofCalcPitch")?.value || "6_12";
  const currentWaste = byId("roofCalcWaste")?.value || "medium";

  return `
    <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:#f8fafc; border-color:#e5e7eb;">
      <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#334155;">
        DIY roof size calculator
      </p>

      <h4 style="margin:0 0 10px;">Estimate roof size yourself</h4>

      <p class="small muted" style="margin:0 0 12px;">
        Use simple home dimensions as a reality check before relying on quote pricing.
      </p>

      <div class="analysis-grid" style="margin-top:0;">
        <div>
          <label for="roofCalcLength"><strong>Home length (ft)</strong></label>
          <input
            id="roofCalcLength"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 50"
            value="${currentLength}"
          />
        </div>

        <div>
          <label for="roofCalcWidth"><strong>Home width (ft)</strong></label>
          <input
            id="roofCalcWidth"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 30"
            value="${currentWidth}"
          />
        </div>

        <div>
          <label for="roofCalcPitch"><strong>Roof pitch</strong></label>
          <select id="roofCalcPitch">
            <option value="flat" ${currentPitch === "flat" ? "selected" : ""}>Flat / very low</option>
            <option value="3_12" ${currentPitch === "3_12" ? "selected" : ""}>3/12</option>
            <option value="4_12" ${currentPitch === "4_12" ? "selected" : ""}>4/12</option>
            <option value="5_12" ${currentPitch === "5_12" ? "selected" : ""}>5/12</option>
            <option value="6_12" ${currentPitch === "6_12" ? "selected" : ""}>6/12</option>
            <option value="7_12" ${currentPitch === "7_12" ? "selected" : ""}>7/12</option>
            <option value="8_12" ${currentPitch === "8_12" ? "selected" : ""}>8/12</option>
            <option value="9_12" ${currentPitch === "9_12" ? "selected" : ""}>9/12</option>
            <option value="10_12" ${currentPitch === "10_12" ? "selected" : ""}>10/12</option>
            <option value="12_12" ${currentPitch === "12_12" ? "selected" : ""}>12/12</option>
          </select>
        </div>

        <div>
          <label for="roofCalcWaste"><strong>Complexity / waste</strong></label>
          <select id="roofCalcWaste">
            <option value="low" ${currentWaste === "low" ? "selected" : ""}>Low</option>
            <option value="medium" ${currentWaste === "medium" ? "selected" : ""}>Medium</option>
            <option value="high" ${currentWaste === "high" ? "selected" : ""}>High</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;">
        <button type="button" class="btn secondary" id="calculateRoofSizeBtn">
          Calculate roof size
        </button>
      </div>

      <div id="roofCalcOutput"></div>
    </div>
  `;
}

function bindRoofSizeSuggestionActions(analysis) {
    const btn = byId("useRoofSizeEstimateBtn");
    if (!btn || !analysis) return;

    btn.addEventListener("click", async function () {
      const input = byId("roofSize");
      const estimate = Number(analysis.roofSizeEstimate);

      if (!input || !isFinite(estimate) || estimate <= 0) return;

      input.value = String(Math.round(estimate));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      btn.disabled = true;
      btn.textContent = "Estimate applied";

      track("roof_size_estimate_applied", {
        estimatedRoofSqFt: Math.round(estimate),
        source: analysis?.roofSizeEstimateSource || "unknown"
      });

      renderAnalyzingState();

setTimeout(() => {
  const bar = document.getElementById("analysisProgressBar");
  if (bar) bar.style.width = "65%";
}, 300);

setTimeout(async () => {
  await analyzeQuote();
}, 700);
  });
}
    function getVerdictExplanation(verdict) {
  const normalized = String(verdict || "").toLowerCase();

  if (normalized.includes("possible scope risk")) {
    return "This quote is well below the expected range and may be missing important scope items.";
  }

  if (normalized.includes("unusually low")) {
    return "This quote is below the expected range and should be checked carefully for omissions or shortcuts.";
  }

  if (normalized.includes("overpriced")) {
    return "This quote is materially above the expected range for this type of roofing job.";
  }

  if (normalized.includes("higher than expected")) {
    return "This quote is above the expected range, though the difference may be explained by scope or materials.";
  }

  if (normalized.includes("fair")) {
    return "This quote is within the expected range based on the available details.";
  }

  if (normalized.includes("excellent")) {
    return "This quote appears to offer strong value relative to the expected range.";
  }

  return "This quote was compared against expected pricing using the available quote details.";
}

    function getDecisionGuidance(analysisOrReport) {
      if (!analysisOrReport) return "";

      const recommendationAction = String(
        analysisOrReport?.recommendation?.action || ""
      ).toUpperCase();

      const rawVerdict = String(
        analysisOrReport?.rawVerdict || analysisOrReport?.verdict || ""
      ).toLowerCase();

      const confidenceScore = Number(
        analysisOrReport?.confidenceScore ??
        analysisOrReport?.roofSizeEstimateConfidenceScore ??
        0
      );

      const reliabilityTier = String(
        analysisOrReport?.reliabilityTier || ""
      ).toUpperCase();

      const severity = String(
        analysisOrReport?.roofSizeConsistency?.severity || "low"
      ).toLowerCase();

      const needsReview = !!analysisOrReport?.roofSizeNeedsReview;

      const riskFlags = Array.isArray(analysisOrReport?.riskFlags)
        ? analysisOrReport.riskFlags
        : [];

      const highRiskCount = riskFlags.filter(
        flag => String(flag?.severity || "").toLowerCase() === "high"
      ).length;

      const lowConfidence =
        confidenceScore > 0 && confidenceScore < 60;

      const moderateConfidence =
        confidenceScore >= 60 && confidenceScore < 80;

      const hardUncertainty =
        needsReview ||
        severity === "high" ||
        reliabilityTier === "LOW_CONFIDENCE";

      const moderateUncertainty =
        severity === "medium" ||
        reliabilityTier === "ESTIMATED" ||
        moderateConfidence;

      if (hardUncertainty) {
        return "Do not make a contractor decision yet. Verify roof size, confirm scope in writing, then run this again.";
      }

      if (recommendationAction === "PROCEED") {
        if (highRiskCount > 0 || moderateUncertainty) {
          return "Pricing is acceptable, but do not sign until the flagged items are answered in writing.";
        }
        return "This quote is in a reasonable range. Pressure test it once, then move forward if scope and warranty check out.";
      }

      if (recommendationAction === "NEGOTIATE") {
        if (rawVerdict.includes("overpriced")) {
          return "This quote is overpriced. Push back on price, demand a line by line explanation, and do not accept the number as is.";
        }
        return "This quote is above market. Challenge the price and use competing quotes to force movement.";
      }

      if (recommendationAction === "REVIEW") {
        if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
          return "This low price is not a green light yet. Audit scope, exclusions, and change order exposure before trusting it.";
        }

        if (lowConfidence) {
          return "The model does not trust the inputs enough yet. Fix the missing or conflicting data before acting.";
        }

        return "This quote still has unresolved issues. Get written answers before you decide.";
      }

      if (rawVerdict.includes("overpriced")) {
        return "This quote is overpriced. Negotiate hard or move on.";
      }

      if (rawVerdict.includes("higher than expected")) {
        return "This quote is high. Make the contractor defend the premium.";
      }

      if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
        return "Low price alone is not a win. Confirm the scope before you trust it.";
      }

      if (rawVerdict.includes("fair")) {
        return "This quote is defensible on price. Final check the scope and then move.";
      }

      return "Do not drift into a decision. Resolve the open issues, then choose deliberately.";
    }

    function getSharePrompt(report) {
      if (!report) return "Share this result with someone you trust before you decide.";

      const recommendationAction = String(
        report?.recommendation?.action || ""
      ).toUpperCase();

      const rawVerdict = String(
        report?.rawVerdict || report?.verdict || ""
      ).toLowerCase();

      const severity = String(
        report?.roofSizeConsistency?.severity || "low"
      ).toLowerCase();

      const needsReview = !!report?.roofSizeNeedsReview;

      const contractor = displayDetectedValue(report?.contractor, "this contractor");

      if (needsReview || severity === "high") {
        return "Share this with the contractor and ask them to confirm the exact roof size they priced.";
      }

      if (recommendationAction === "NEGOTIATE") {
        if (rawVerdict.includes("overpriced")) {
          return `Send this to ${contractor} and make them explain the premium in writing.`;
        }
        return `Send this to ${contractor} and use it to challenge the price before you move.`;
      }

      if (recommendationAction === "REVIEW") {
        if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
          return "Share this with a contractor or knowledgeable friend and ask what may be missing from the quote.";
        }
        return "Share this with the contractor and ask them to answer the flagged questions in writing.";
      }

      if (recommendationAction === "PROCEED") {
        return "Share this with a spouse, friend, or advisor for a final sanity check before signing.";
      }

      if (rawVerdict.includes("overpriced") || rawVerdict.includes("higher than expected")) {
        return "Share this before you accept the price. A second set of eyes can stop a bad overpay.";
      }

      if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
        return "Share this before choosing the low bid. Cheap is dangerous when scope is unclear.";
      }

      return "Share this with someone you trust to pressure test the decision.";
    }

    function scrollToElementBySelector(selector) {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }

    function focusRoofSizeField() {
      const manualEntryDetails = byId("manualEntryDetails");
      const roofSizeInput = byId("roofSize");

      if (manualEntryDetails) manualEntryDetails.open = true;
      if (!roofSizeInput) return;

      roofSizeInput.scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        roofSizeInput.focus();
        if (typeof roofSizeInput.select === "function") {
          roofSizeInput.select();
        }
      }, 250);
    }

    function shouldUseRoofReviewCta(analysis) {
      if (!analysis) return false;

      const severity = String(analysis?.roofSizeConsistency?.severity || "low").toLowerCase();
      const needsReview = !!analysis?.roofSizeNeedsReview;
      const hasSuggestion = shouldShowRoofSizeSuggestion(analysis);

      return hasSuggestion || severity === "high" || needsReview;
    }

    function getPrimaryCtaConfig(analysis) {
      if (!analysis) return null;

      const recommendedAction = String(
        analysis?.recommendation?.action || ""
      ).toUpperCase();

      const rawVerdict = String(
        analysis?.rawVerdict || analysis?.verdict || ""
      ).toLowerCase();

      const confidenceScore = Number(
        analysis?.confidenceScore ??
        analysis?.roofSizeEstimateConfidenceScore ??
        0
      );

      const severity = String(
        analysis?.roofSizeConsistency?.severity || "low"
      ).toLowerCase();

      const needsReview = !!analysis?.roofSizeNeedsReview;

      const riskFlags = Array.isArray(analysis?.riskFlags) ? analysis.riskFlags : [];
      const highRiskCount = riskFlags.filter(
        flag => String(flag?.severity || "").toLowerCase() === "high"
      ).length;

      const lowConfidence = confidenceScore > 0 && confidenceScore < 60;
      const moderateConfidence = confidenceScore >= 60 && confidenceScore < 80;

      if (shouldUseRoofReviewCta(analysis) || severity === "high" || needsReview) {
        return {
          mode: "verify",
          eyebrow: "Required next step",
          headline: "Verify roof size",
          body: "Do not make a contractor decision until roof size is confirmed.",
          primaryLabel: "Verify roof size",
          primaryAction: "review_roof_size"
        };
      }

      if (recommendedAction === "NEGOTIATE") {
        if (rawVerdict.includes("overpriced")) {
          return {
            mode: "negotiate",
            eyebrow: "Recommended next step",
            headline: "Push back on price",
            body: "This quote is overpriced. Demand a breakdown and force the contractor to defend the number.",
            primaryLabel: "Push back on price",
            primaryAction: "copy_contractor_questions"
          };
        }

        return {
          mode: "negotiate",
          eyebrow: "Recommended next step",
          headline: "Challenge this quote",
          body: "This quote is above market. Use direct questions and competing bids to pressure the price down.",
          primaryLabel: "Challenge this quote",
          primaryAction: "copy_contractor_questions"
        };
      }

      if (recommendedAction === "REVIEW") {
        if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
          return {
            mode: "review",
            eyebrow: "Recommended next step",
            headline: "Resolve the low bid risk",
            body: "Do not trust this low price until exclusions, missing scope, and change order exposure are clear.",
            primaryLabel: "Resolve flagged issues",
            primaryAction: "copy_contractor_questions"
          };
        }

        if (lowConfidence || highRiskCount > 0) {
          return {
            mode: "review",
            eyebrow: "Recommended next step",
            headline: "Resolve flagged issues",
            body: "This quote is not clean enough to trust yet. Get answers before you move.",
            primaryLabel: "Resolve flagged issues",
            primaryAction: "copy_contractor_questions"
          };
        }

        return {
          mode: "review",
          eyebrow: "Recommended next step",
          headline: "Get answers in writing",
          body: "This quote is close, but not decision ready until the open questions are resolved.",
          primaryLabel: "Get answers in writing",
          primaryAction: "copy_contractor_questions"
        };
      }

      if (recommendedAction === "PROCEED") {
        if (highRiskCount > 0 || moderateConfidence) {
          return {
            mode: "review",
            eyebrow: "Recommended next step",
            headline: "Pressure test this quote",
            body: "Pricing is acceptable, but you should close the remaining issues before signing.",
            primaryLabel: "Pressure test this quote",
            primaryAction: "copy_contractor_questions"
          };
        }

        return {
          mode: "proceed",
          eyebrow: "Recommended next step",
          headline: "Advance this quote",
          body: "The price is defensible. Compare once more or move forward if scope and warranty check out.",
          primaryLabel: "Advance this quote",
          primaryAction: "compare_quotes"
        };
      }

      if (rawVerdict.includes("overpriced")) {
        return {
          mode: "negotiate",
          eyebrow: "Recommended next step",
          headline: "Push back on price",
          body: "This quote looks overpriced relative to the model.",
          primaryLabel: "Push back on price",
          primaryAction: "copy_contractor_questions"
        };
      }

      if (rawVerdict.includes("higher than expected")) {
        return {
          mode: "compare",
          eyebrow: "Recommended next step",
          headline: "Force a price check",
          body: "This quote is high enough that you should challenge it before moving forward.",
          primaryLabel: "Force a price check",
          primaryAction: "compare_quotes"
        };
      }

      if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
        return {
          mode: "review",
          eyebrow: "Recommended next step",
          headline: "Do not trust the low bid yet",
          body: "Low price without scope clarity is where bad decisions happen.",
          primaryLabel: "Resolve flagged issues",
          primaryAction: "copy_contractor_questions"
        };
      }

      return {
        mode: "share",
        eyebrow: "Recommended next step",
        headline: "Pressure test the decision",
        body: "Use one more set of eyes before you commit.",
        primaryLabel: "Copy share summary",
        primaryAction: "copy_summary"
      };
    }

        function buildPrimaryCtaHtml(analysis) {
          const config = getPrimaryCtaConfig(analysis);
          if (!config) return "";

          return `
            <div class="panel primary-cta ${config.mode}" style="margin:0 0 18px; padding:18px 18px 16px; border-width:2px;">
              <div class="primary-cta-eyebrow">${config.eyebrow}</div>
              <h4 style="margin:0 0 8px;">${config.headline}</h4>
              <p style="margin:0 0 12px;">${config.body}</p>

              <div class="primary-cta-actions">
                <button type="button" class="btn" data-cta-action="${config.primaryAction}" style="min-width:220px;">
                  ${config.primaryLabel}
                </button>
              </div>
            </div>
          `;
        }

      function handlePrimaryCtaAction(action, analysis) {
        if (!action) return;

        const ctaConfig = getPrimaryCtaConfig(analysis);

        track("cta_clicked", {
          action,
          mode: ctaConfig?.mode || "unknown",
          verdict: analysis?.verdict || "",
          rawVerdict: analysis?.rawVerdict || "",
          roofSizeNeedsReview: !!analysis?.roofSizeNeedsReview,
          roofSizeConsistencySeverity: analysis?.roofSizeConsistency?.severity || "low"
        });

        if (action === "review_roof_size") {
          focusRoofSizeField();
          return;
        }

        if (action === "use_suggested_roof_size") {
          const btn = byId("useRoofSizeEstimateBtn");
          if (btn) {
            btn.click();
          } else {
            focusRoofSizeField();
          }
          return;
        }

        if (action === "copy_contractor_questions") {
          track("cta_copy_contractor_questions_clicked", {
            verdict: analysis?.verdict || "",
            rawVerdict: analysis?.rawVerdict || ""
          });

          if (typeof copyContractorQuestions === "function") {
            try {
              copyContractorQuestions();
            } catch (e) {
              console.error(e);
              viewShareableResult();
            }
          } else {
            viewShareableResult();
          }
          return;
        }

        if (action === "request_quote") {
          scrollToElementBySelector(".lead-box");
          return;
        }

        if (action === "view_report") {
          viewShareableResult();
          const output = getShareReportOutputElement();
          if (output) {
            setTimeout(() => {
              output.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 150);
          }
          return;
        }

        if (action === "copy_summary") {
          copyShareableReportText();
          return;
        }

        if (action === "compare_quotes") {
          compareQuotes();
          return;
        }
    }

    function bindPrimaryCtaActions(analysis) {
      const buttons = document.querySelectorAll("[data-cta-action]");
      if (!buttons.length) return;

      buttons.forEach(button => {
        if (button.dataset.ctaBound === "true") return;

        button.addEventListener("click", function () {
          handlePrimaryCtaAction(button.dataset.ctaAction, analysis);
        });

        button.dataset.ctaBound = "true";
      });
    }

    function getRoofPitchMultiplier(pitchLabel) {
  const map = {
    "flat": 1.00,
    "3_12": 1.03,
    "4_12": 1.05,
    "5_12": 1.08,
    "6_12": 1.12,
    "7_12": 1.16,
    "8_12": 1.20,
    "9_12": 1.25,
    "10_12": 1.30,
    "12_12": 1.41
  };

  return map[String(pitchLabel || "").toLowerCase()] || 1.12;
}

function getRoofWasteMultiplier(wasteLabel) {
  const map = {
    "low": 1.05,
    "medium": 1.10,
    "high": 1.15
  };

  return map[String(wasteLabel || "").toLowerCase()] || 1.10;
}

function calculateManualRoofSizeEstimate({
    length,
    width,
    pitch,
    waste
  }) {
    const numericLength = Number(length);
    const numericWidth = Number(width);

    if (!isFinite(numericLength) || numericLength <= 0 || !isFinite(numericWidth) || numericWidth <= 0) {
      return null;
    }

    const footprintSqFt = numericLength * numericWidth;
    const pitchMultiplier = getRoofPitchMultiplier(pitch);
    const wasteMultiplier = getRoofWasteMultiplier(waste);

    const estimatedRoofSqFt = footprintSqFt * pitchMultiplier * wasteMultiplier;

    return {
      footprintSqFt: Math.round(footprintSqFt),
      estimatedRoofSqFt: Math.round(estimatedRoofSqFt),
      pitchMultiplier,
      wasteMultiplier,
      confidence: "Manual estimate",
      methodology: "Footprint × pitch factor × waste factor"
  };
}

function buildRoofCalculatorResultHtml(result) {
  if (!result) return "";

  return `
    <div class="panel" style="margin:12px 0 0; background:#f8fafc; border-color:#e5e7eb;">
      <p style="margin:0 0 8px;"><strong>DIY roof size estimate</strong></p>

      <div class="analysis-grid" style="margin-top:0;">
        <div><strong>Footprint</strong></div>
        <div>${safeFormatNumber(result.footprintSqFt)} sq ft</div>

        <div><strong>Estimated roof size</strong></div>
        <div>${safeFormatNumber(result.estimatedRoofSqFt)} sq ft</div>

        <div><strong>Confidence</strong></div>
        <div>${result.confidence}</div>
      </div>

      <p class="small muted" style="margin:10px 0 0;">
        Method: ${result.methodology}
      </p>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button type="button" class="btn secondary" id="useManualRoofCalcBtn">
          Use this roof size
        </button>
      </div>
    </div>
  `;
}

function renderRoofCalculatorOutput() {
  const output = byId("roofCalcOutput");
  if (!output) return;

  const length = byId("roofCalcLength")?.value || "";
  const width = byId("roofCalcWidth")?.value || "";
  const pitch = byId("roofCalcPitch")?.value || "6_12";
  const waste = byId("roofCalcWaste")?.value || "medium";

  const result = calculateManualRoofSizeEstimate({
    length,
    width,
    pitch,
    waste
  });

  if (!result) {
    output.innerHTML = `
      <div class="panel" style="margin-top:12px; background:#fff7ed; border-color:#fdba74;">
        <p style="margin:0;">
          Enter home length and width to generate a roof size estimate.
        </p>
      </div>
    `;
    return;
  }

  output.innerHTML = buildRoofCalculatorResultHtml(result);

  const useBtn = byId("useManualRoofCalcBtn");
  if (useBtn && useBtn.dataset.bound !== "true") {
    useBtn.addEventListener("click", async function () {
      const roofSizeInput = byId("roofSize");
      if (!roofSizeInput) return;

      roofSizeInput.value = String(result.estimatedRoofSqFt);
      roofSizeInput.dataset.source = "manual_calculator";
      roofSizeInput.dataset.confidence = "manual_estimate";
      roofSizeInput.dispatchEvent(new Event("input", { bubbles: true }));
      roofSizeInput.dispatchEvent(new Event("change", { bubbles: true }));

      setUploadStatus("DIY roof size estimate applied. Re-running analysis.", "success");
      await analyzeQuote();
    });

    useBtn.dataset.bound = "true";
  }
}

function bindRoofCalculatorActions() {
  const triggerIds = [
    "roofCalcLength",
    "roofCalcWidth",
    "roofCalcPitch",
    "roofCalcWaste"
  ];

  triggerIds.forEach(id => {
    const el = byId(id);
    if (!el || el.dataset.bound === "true") return;

    const handler = function () {
      renderRoofCalculatorOutput();
    };

    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
    el.dataset.bound = "true";
  });

  const calculateBtn = byId("calculateRoofSizeBtn");
  if (calculateBtn && calculateBtn.dataset.bound !== "true") {
    calculateBtn.addEventListener("click", function () {
      renderRoofCalculatorOutput();
    });
    calculateBtn.dataset.bound = "true";
  }
}

    function setUploadStatus(message, type = "info") {
      const el = byId("uploadStatus");
      if (!el) return;
      el.className = `upload-status ${type}`;
      el.innerText = message;
    }

    function setSmartUploadStatus(stage, percent) {
      const map = {
        upload: {
          title: "Uploading your quote",
          percent: 10,
          type: "info"
        },
        extract: {
          title: "Extracting text from your quote",
          percent: 35,
          type: "info"
        },
        identify: {
          title: "Identifying key details from your quote",
          percent: 60,
          type: "info"
        },
        analyze: {
          title: "Analyzing pricing",
          percent: 85,
          type: "info"
        },
        done: {
          title: "Analysis complete",
          percent: 100,
          type: "success"
        }
      };

      const config = map[stage] || {
        title: String(stage || "Working on your quote"),
        percent: typeof percent === "number" ? percent : 50,
        type: "info"
      };

      const pct = typeof percent === "number" ? percent : config.percent;

      setUploadStatus(
        `[${"█".repeat(Math.max(0, Math.min(12, Math.round(pct / 8.333))))}${"░".repeat(12 - Math.max(0, Math.min(12, Math.round(pct / 8.333))))}] ${Math.round(pct)}%\n${config.title}\nThis usually takes a few seconds\nWe do not store or share your documents.`,
        config.type
      );
    }

    function normalizeMaterialForForm(materialValue, materialLabel) {
      const combined = `${materialValue || ""} ${materialLabel || ""}`.toLowerCase();

      if (combined.includes("architectural")) return "architectural";
      if (combined.includes("metal")) return "metal";
      if (combined.includes("tile")) return "tile";
      if (combined.includes("asphalt")) return "asphalt";

      return "architectural";
    }

    function normalizeTearOffForUi(parsed) {
      const status = parsed?.signals?.tearOff?.status;
      if (status === "included") return "1.05";
      if (status === "excluded") return "0.97";
      return "1.00";
    }

    function getMissingManualFields(parsed) {
      const missing = [];

      const hasPrice = isFinite(Number(parsed?.price)) && Number(parsed.price) > 0;
      const hasRoofSize = isFinite(Number(parsed?.roofSize)) && Number(parsed.roofSize) > 0;

      const materialValue = String(parsed?.material || "").trim().toLowerCase();
      const materialLabel = String(parsed?.materialLabel || "").trim().toLowerCase();
      const hasMaterial =
        !!materialValue ||
        (!!materialLabel && materialLabel !== "unknown" && materialLabel !== "not detected");

      const hasCity = !!String(parsed?.city || "").trim();
      const hasState = !!String(parsed?.stateCode || "").trim();

      if (!hasPrice) missing.push("quotePrice");
      if (!hasRoofSize) missing.push("roofSize");
      if (!hasMaterial) missing.push("materialType");
      if (!hasCity) missing.push("cityName");
      if (!hasState) missing.push("stateCode");

      return missing;
    }

    function clearManualFieldHighlights() {
      ["quotePrice", "roofSize", "materialType", "cityName", "stateCode"].forEach(id => {
        const el = byId(id);
        if (!el) return;

        el.style.borderColor = "";
        el.style.background = "";
        el.style.boxShadow = "";
        el.style.transition = "";
        el.style.outline = "";
        el.style.outlineOffset = "";

        const label = document.querySelector(`label[for="${id}"]`);
        if (label) {
          label.style.color = "";
          label.style.fontWeight = "";
        }
      });

      const roofCue = byId("roofSizePriorityCue");
      if (roofCue) roofCue.textContent = "";

      const manualFieldJumpStatus = byId("manualFieldJumpStatus");
      if (manualFieldJumpStatus) manualFieldJumpStatus.innerHTML = "";
    }

    function highlightManualFields(fieldIds = [], options = {}) {
      const ordered = Array.isArray(fieldIds) ? fieldIds : [];
      const isJump = !!options.isJump;
      const primaryId = options.primaryId || ordered[0] || null;

      ordered.forEach(id => {
        const el = byId(id);
        if (!el) return;

        const isPrimary = id === primaryId;
        const label = document.querySelector(`label[for="${id}"]`);

        el.style.borderColor = isPrimary ? "#ea580c" : "#f59e0b";
        el.style.background = isPrimary ? "#fff7ed" : "#fffdf5";
        el.style.outline = isPrimary ? "3px solid rgba(234, 88, 12, 0.22)" : "none";
        el.style.outlineOffset = "1px";
        el.style.boxShadow = isPrimary
          ? "0 0 0 2px rgba(234, 88, 12, 0.16)"
          : "0 0 0 1px rgba(245, 158, 11, 0.14)";
        el.style.transition =
          "box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease, outline 0.2s ease";

        if (label) {
          label.style.color = isPrimary ? "#c2410c" : "";
          label.style.fontWeight = isPrimary ? "800" : "";
        }
      });

        // Auto focus the primary missing field (first run only)
  if (!options.isJump && primaryId) {
    const primaryEl = byId(primaryId);
    if (primaryEl) {
      setTimeout(() => {
        primaryEl.focus();
        if (
          typeof primaryEl.select === "function" &&
          (primaryEl.tagName === "INPUT" || primaryEl.tagName === "TEXTAREA")
        ) {
          primaryEl.select();
        }
      }, 150);
    }
  }

      if (isJump && primaryId) {
        setTimeout(() => {
          const primary = byId(primaryId);
          if (primary) {
            primary.style.outline = "2px solid rgba(234, 88, 12, 0.16)";
          }
        }, 900);
      }
    }

    function buildPartialExtractionNotice(parsed) {
      const missing = [];

      const hasPrice = isFinite(Number(parsed?.price)) && Number(parsed.price) > 0;
      const hasRoofSize = isFinite(Number(parsed?.roofSize)) && Number(parsed.roofSize) > 0;

      const materialValue = String(parsed?.material || "").trim().toLowerCase();
      const materialLabel = String(parsed?.materialLabel || "").trim().toLowerCase();
      const hasMaterial =
        !!materialValue ||
        (!!materialLabel && materialLabel !== "unknown" && materialLabel !== "not detected");

      const hasLocation =
        !!String(parsed?.city || "").trim() || !!String(parsed?.stateCode || "").trim();

      if (!hasPrice) return "";

      if (!hasRoofSize) missing.push("roof size");
      if (!hasMaterial) missing.push("material");
      if (!hasLocation) missing.push("location");

      if (!missing.length) return "";

      return `
        <div class="panel" style="margin:0 0 14px; background:#fff7ed; border-color:#fdba74;">
          <h4 style="margin:0 0 8px;">Partial quote read</h4>
          <p style="margin:0 0 8px;">
            We found the quoted price, but some other details were hard to read from the uploaded file.
          </p>
          <p class="small muted" style="margin:0;">
            Add ${missing.join(", ")} below to finish a more accurate price check.
          </p>
        </div>
      `;
    }

    function buildManualEntryPromptHtml(parsed) {
      const price = parsed?.finalBestPrice || parsed?.price || null;
      const missingFieldIds = getMissingManualFields(parsed);

      const primaryId = missingFieldIds.includes("roofSize")
        ? "roofSize"
        : (missingFieldIds[0] || null);

      const primaryLabel =
        primaryId === "roofSize" ? "roof size" :
        primaryId === "materialType" ? "material" :
        primaryId === "cityName" ? "city" :
        primaryId === "stateCode" ? "state" :
        primaryId === "quotePrice" ? "quote price" :
        "first highlighted field";

      const priceText = price
    ? `We found a quoted price of <strong>${safeFormatCurrency(price)}</strong>, but we still need a few details to finish the analysis.`
    : `We could not clearly detect the quote total yet.`;

      return `
        <div class="panel" style="margin-bottom:12px; background:#fff7ed; border-color:#fdba74;">
          <h3 style="margin-top:0;">Complete the missing quote details</h3>
          <p>${priceText}</p>
          <p class="small" style="margin-bottom:0;">
            Start with <strong>${primaryLabel}</strong>, then complete the remaining highlighted fields and click <strong>Analyze Quote</strong> again.
          </p>
        </div>
      `;
    }

    function jumpToMissingManualFields(parsed) {
      const missingFieldIds = getMissingManualFields(parsed);

      const prioritizedFirstId = missingFieldIds.includes("roofSize")
        ? "roofSize"
        : (missingFieldIds[0] || null);

      const first = prioritizedFirstId ? byId(prioritizedFirstId) : null;
      const manualEntryDetails = byId("manualEntryDetails");
      const manualFieldJumpStatus = byId("manualFieldJumpStatus");
      const roofCue = byId("roofSizePriorityCue");

      if (roofCue) {
        roofCue.textContent = prioritizedFirstId === "roofSize" ? "← start here" : "";
      }

      if (manualEntryDetails) {
        manualEntryDetails.open = true;
      }

      clearManualFieldHighlights();
      highlightManualFields(missingFieldIds, {
        isJump: true,
        primaryId: prioritizedFirstId
      });

      if (manualFieldJumpStatus) {
        const primaryLabel =
          prioritizedFirstId === "roofSize" ? "roof size" :
          prioritizedFirstId === "materialType" ? "material" :
          prioritizedFirstId === "cityName" ? "city" :
          prioritizedFirstId === "stateCode" ? "state" :
          prioritizedFirstId === "quotePrice" ? "quote price" :
          "first highlighted field";

        manualFieldJumpStatus.innerHTML = `
          <div class="panel" style="margin:0 0 12px; background:#fff7ed; border-color:#fdba74;">
            <p style="margin:0;">
              <strong>Next step:</strong> enter your <strong>${primaryLabel}</strong> first, then complete the remaining highlighted fields.
            </p>
          </div>
        `;
      }

      const target = first || byId("quotePrice") || byId("materialType");

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });

        setTimeout(() => {
          target.focus();

          if (
            typeof target.select === "function" &&
            (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
          ) {
            target.select();
          }
        }, 250);
      }
    }

    function calculateScopeRisk(missingItems = []) {
      const count = Array.isArray(missingItems) ? missingItems.length : 0;

      if (count === 0) {
        return {
          level: "Low",
          color: "#15803d",
          description: "No likely missing items were flagged based on the available quote details."
        };
      }

      if (count <= 2) {
        return {
          level: "Medium",
          color: "#b45309",
          description: "This quote does not mention some common roofing components that sometimes show up later as change orders."
        };
      }

      return {
        level: "High",
        color: "#b91c1c",
        description: "This quote is missing several common roofing components. Review the scope carefully before relying on the price."
      };
    }
   
    function buildRecommendation(analysis) {
  if (!analysis) {
    return {
      action: "REVIEW",
      reasoning: "Review the quote details before making a decision.",
      strength: "medium"
    };
  }

  const rawVerdict = String(analysis.rawVerdict || analysis.verdict || "").toLowerCase();
  const reliabilityTier = String(analysis.reliabilityTier || "").toUpperCase();
  const roofSizeSeverity = String(analysis?.roofSizeConsistency?.severity || "none").toLowerCase();
  const propertyMeta = analysis?.propertySignalsMeta || {};
  const riskFlags = Array.isArray(analysis?.riskFlags)
    ? analysis.riskFlags
    : buildRiskFlags(analysis);
  const decisionDelta = analysis?.decisionDelta || null;

  const hasHighRisk = riskFlags.some(
    flag => String(flag?.severity || "").toLowerCase() === "high"
  );
  const hasMediumRisk = riskFlags.some(
    flag => String(flag?.severity || "").toLowerCase() === "medium"
  );
  const hasAmbiguousProperty = !!propertyMeta?.ambiguous;
  const hasLowReliability = reliabilityTier === "LOW_CONFIDENCE";
  const hasEstimatedReliability = reliabilityTier === "ESTIMATED";

  const roofSizeSource = String(analysis?.roofSizeEstimateSource || "").toLowerCase();
  const fallbackUsed = !!analysis?.roofSizeEstimateMeta?.fallbackUsed;
  const isUnavailable = roofSizeSource === "unavailable";

  if (
    roofSizeSeverity === "high" ||
    hasAmbiguousProperty ||
    hasLowReliability ||
    fallbackUsed ||
    isUnavailable
  ) {
    return {
      action: "REVIEW",
      reasoning: "Key pricing inputs are uncertain. Verify roof size and scope before acting on this result.",
      strength: "high"
    };
  }

  if (rawVerdict.includes("overpriced")) {
    return {
      action: "NEGOTIATE",
      reasoning: "This quote appears materially above expected pricing. Ask for a line-by-line explanation and compare another quote.",
      strength: "high"
    };
  }

  if (rawVerdict.includes("higher than expected")) {
    return {
      action: "NEGOTIATE",
      reasoning: "This quote appears above expected pricing. Compare another quote before accepting the premium.",
      strength: hasHighRisk ? "high" : "medium"
    };
  }

  if (rawVerdict.includes("possible scope risk") || rawVerdict.includes("unusually low")) {
    return {
      action: "REVIEW",
      reasoning: "This quote is low enough that missing scope or later change orders are possible. Confirm inclusions before moving forward.",
      strength: "high"
    };
  }

  if (rawVerdict.includes("fair")) {
    return {
      action: "PROCEED",
      reasoning: hasMediumRisk || hasEstimatedReliability
        ? "Pricing looks reasonable, but review flagged items before signing."
        : "Pricing looks reasonable relative to expected market range.",
      strength: hasMediumRisk ? "medium" : "high"
    };
  }

  return {
    action: "REVIEW",
    reasoning: "Review the quote details and compare another quote before making a final decision.",
    strength: "medium"
  };
}

    function buildRecommendationHtml(analysis) {
      const recommendation = analysis?.recommendation || buildRecommendation(analysis);
      if (!recommendation) return "";

      const action = String(recommendation.action || "REVIEW").toUpperCase();
      const reasoningText = getRecommendationReasoningText(analysis);

      const riskFlags = Array.isArray(analysis?.riskFlags) ? analysis.riskFlags : [];
      const topFlags = riskFlags
        .filter(flag => String(flag?.key || "").toLowerCase() !== "no_major_risks")
        .slice(0, 2);

      const decisionDelta = analysis?.decisionDelta || null;
      const deltaText = decisionDelta ? softenClaim(buildDecisionDeltaText(decisionDelta), analysis) : "";

      const accent =
        action === "PROCEED"
          ? { bg: "#f0fdf4", border: "#86efac", text: "#166534" }
          : action === "NEGOTIATE"
            ? { bg: "#fff7ed", border: "#fdba74", text: "#9a3412" }
            : action === "AVOID"
              ? { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" }
              : { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" };

      const bullets = [];

      if (deltaText) {
        bullets.push(deltaText);
      }

      if (reasoningText) {
        bullets.push(reasoningText);
      }

      topFlags.forEach(flag => {
        if (flag?.impact) bullets.push(flag.impact);
      });

      const uniqueBullets = [];
      const seen = new Set();

      bullets.forEach(item => {
        const clean = String(item || "").trim();
        const key = clean.toLowerCase();
        if (!clean || seen.has(key)) return;
        seen.add(key);
        uniqueBullets.push(clean);
      });

      return `
        <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:${accent.bg}; border-color:${accent.border};">
          <p style="margin:0 0 8px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:${accent.text};">
            Why this decision
          </p>

          <ul class="mini-list" style="margin:0; color:#111827;">
            ${uniqueBullets.slice(0, 3).map(item => `<li>${item}</li>`).join("")}
          </ul>
        </div>
      `;
    }

      function buildDecisionLockHtml(a) {
        if (!a || !a.recommendation) return "";

        const action = String(a.recommendation.action || "").toUpperCase();
        const confidence = Number(
          a.confidenceScore ??
          a.roofSizeEstimateConfidenceScore ??
          0
        );

        let color = "#1d4ed8";
        let bg = "#eff6ff";
        let border = "#93c5fd";

        if (action === "PROCEED") {
          color = "#166534";
          bg = "#f0fdf4";
          border = "#86efac";
        }

        if (action === "NEGOTIATE") {
          color = "#9a3412";
          bg = "#fff7ed";
          border = "#fdba74";
        }

        if (action === "REVIEW") {
          color = "#1e40af";
          bg = "#eff6ff";
          border = "#93c5fd";
        }

        if (action === "AVOID") {
          color = "#991b1b";
          bg = "#fef2f2";
          border = "#fca5a5";
        }

        const confidenceLabel =
          confidence >= 80 ? "HIGH CONFIDENCE" :
          confidence >= 60 ? "MODERATE CONFIDENCE" :
          "LOW CONFIDENCE";

        const actionTextMap = {
          PROCEED: "Proceed",
          NEGOTIATE: "Do not accept this price",
          REVIEW: "Do not decide yet",
          AVOID: "Walk away"
        };

        const subTextMap = {
          PROCEED: "The price is defensible. Final check the scope, then move.",
          NEGOTIATE: "The quote is above market or poorly positioned. Push back before moving.",
          REVIEW: "The result is not decision ready yet. Resolve the flagged issues first.",
          AVOID: "The quote is too risky or too weak to advance as is."
        };

        const actionText = actionTextMap[action] || "Do not decide yet";
        const subText = subTextMap[action] || "Review the quote before making a decision.";

        return `
          <div class="panel" style="
            margin:0 0 16px;
            padding:16px;
            border:2px solid ${border};
            background:${bg};
          ">
            <div style="font-size:12px; font-weight:700; letter-spacing:.04em; color:${color}; margin-bottom:6px;">
              SYSTEM DECISION
            </div>

            <div style="font-size:24px; line-height:1.1; font-weight:800; color:${color}; margin-bottom:6px;">
              ${actionText}
            </div>

            <div style="font-size:13px; color:#374151; margin-bottom:8px;">
              ${confidenceLabel} • Score: ${Math.round(confidence)}/100
            </div>

            <div style="font-size:14px; color:#111827;">
              ${subText}
            </div>
          </div>
        `;
      }

      function buildContractorQuestions(analysis) {
        if (!analysis) return [];

        const questions = [];
        const seen = new Set();

        function addQuestion(text) {
          const clean = String(text || "").trim();
          const key = clean.toLowerCase();
          if (!clean || seen.has(key)) return;
          seen.add(key);
          questions.push(clean);
        }

        const recommendationAction = String(
          analysis?.recommendation?.action || ""
        ).toUpperCase();

        const riskFlags = Array.isArray(analysis?.riskFlags) ? analysis.riskFlags : [];
        const decisionDelta = analysis?.decisionDelta || null;
        const roofSizeConsistency = analysis?.roofSizeConsistency || null;
        const propertyMeta = analysis?.propertySignalsMeta || {};
        const reliabilityTier = String(analysis?.reliabilityTier || "").toUpperCase();
        const rawVerdict = String(analysis?.rawVerdict || analysis?.verdict || "").toLowerCase();

        if (decisionDelta?.position === "above_range" && decisionDelta?.absDelta) {
          addQuestion(
            `Can you explain why this quote is about ${safeFormatCurrency(decisionDelta.absDelta)} above the modeled midpoint?`
          );
        }

        if (decisionDelta?.position === "below_range" && decisionDelta?.absDelta) {
          addQuestion(
            `This quote appears about ${safeFormatCurrency(decisionDelta.absDelta)} below expected pricing. Can you confirm what is included so I can compare it fairly?`
          );
        }

        riskFlags.forEach(flag => {
          const key = String(flag?.key || "").toLowerCase();

          if (key === "potential_overpricing") {
            addQuestion("Can you provide a line by line breakdown showing what is driving the higher price?");
            addQuestion("Are there any premium materials, upgrades, or extra scope items in this quote that explain the price difference?");
          }

          if (key === "roof_size_conflict" || key === "roof_size_variance") {
            addQuestion("What roof size are you using for this quote, and how was it measured?");
            addQuestion("Can you show the measurement report or diagram used to calculate the roof size?");
          }

          if (key === "ambiguous_property_match" || key === "low_quality_property_match") {
            addQuestion("Can you confirm the final quoted roof size in squares or square feet so I can compare quotes using the same measurement?");
          }

          if (key === "missing_flashing") {
            addQuestion("Can you confirm whether flashing replacement is included, and where it appears in the estimate?");
          }

          if (
            key === "missing_water_barrier" ||
            key === "missing_underlayment"
          ) {
            addQuestion("What underlayment or water barrier is included, and how much of the roof does it cover?");
          }

          if (key === "missing_ventilation") {
            addQuestion("Can you confirm whether ventilation or ridge vent work is included in this quote?");
          }

          if (key === "low_bid_scope_risk" || key === "suspiciously_low_price") {
            addQuestion("Is anything excluded that could later become a change order or add-on cost?");
            addQuestion("Does this quote include tear off, disposal, underlayment, flashing, ventilation, and permit related work?");
          }
        });

        if (String(roofSizeConsistency?.severity || "").toLowerCase() === "high") {
          addQuestion("Before I compare this quote to others, can you confirm the exact roof size you are pricing?");
        }

        if (propertyMeta?.ambiguous) {
          addQuestion("I found mixed property signals. Can you confirm the exact structure and roof area this quote is based on?");
        }

        if (recommendationAction === "NEGOTIATE") {
          addQuestion("Is there any flexibility in the price if scope and materials stay the same?");
        }

        if (recommendationAction === "REVIEW") {
          addQuestion("Can you update the estimate so all major scope items are clearly shown in writing?");
        }

        if (reliabilityTier === "LOW_CONFIDENCE" || reliabilityTier === "ESTIMATED") {
          addQuestion("Can you confirm the main pricing assumptions in writing so I can validate the comparison?");
        }

        if (
          rawVerdict.includes("fair") &&
          questions.length < 3
        ) {
          addQuestion("Can you confirm the main included scope items and warranty terms in writing?");
          addQuestion("Are there any conditions that could cause the final price to increase after work begins?");
        }

        return questions.slice(0, 6);
      }

  function buildContractorQuestionsText(analysis) {
    const questions = buildContractorQuestions(analysis);
    if (!questions.length) return "";

    return questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  }

  function buildContractorQuestionsHtml(analysis) {
    const questions = buildContractorQuestions(analysis);
    if (!questions.length) return "";

    return `
      <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:#eff6ff; border-color:#93c5fd;">
        <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#1d4ed8;">
          Contractor questions
        </p>

        <h4 style="margin:0 0 10px;">Questions to send before you decide</h4>

        <p class="small muted" style="margin:0 0 10px;">
          These are based on the pricing result, flagged risks, and quote confidence.
        </p>

        <ul class="mini-list" style="margin:0 0 12px;">
          ${questions.map(q => `<li>${q}</li>`).join("")}
        </ul>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn secondary" id="copyContractorQuestionsBtn">
            Copy questions
          </button>
        </div>

        <div id="contractorQuestionsCopyStatus"></div>
      </div>
    `;
  }

  function getConfidenceLanguageMode(analysis) {
    const reliabilityTier = String(analysis?.reliabilityTier || "").toUpperCase();
    const severity = String(analysis?.roofSizeConsistency?.severity || "low").toLowerCase();
    const needsReview = !!analysis?.roofSizeNeedsReview;

    if (severity === "high" || needsReview || reliabilityTier === "LOW_CONFIDENCE") {
      return "cautious";
    }

    if (severity === "medium" || reliabilityTier === "ESTIMATED") {
      return "measured";
    }

    return "direct";
}

function softenClaim(text, analysis) {
  const value = String(text || "").trim();
  if (!value) return value;

  const mode = getConfidenceLanguageMode(analysis);

  if (mode === "direct") return value;

  if (mode === "measured") {
    return value
      .replace(/^This quote is /, "This quote appears to be ")
      .replace(/^This quote appears /, "This quote appears ")
      .replace(/^You may be overpaying by /, "Model suggests you may be overpaying by ")
      .replace(/^You may be /, "You may be ")
      .replace(/^Pricing looks reasonable/, "Pricing appears reasonable");
  }

  return value
    .replace(/^This quote is /, "This result may indicate this quote is ")
    .replace(/^This quote appears to be /, "This result may indicate this quote is ")
    .replace(/^This quote appears /, "This result may indicate this quote appears ")
    .replace(/^You may be overpaying by /, "The model suggests you may be overpaying by ")
    .replace(/^This quote is /, "This result may indicate this quote is ")
    .replace(/^Pricing looks reasonable/, "Pricing may be reasonable");
}

function getRecommendationReasoningText(analysis) {
  const recommendation =
    analysis?.recommendation || buildRecommendation(analysis);

  return softenClaim(recommendation?.reasoning || "", analysis);
}

  async function copyContractorQuestions() {
    const analysis = latestAnalysis;
    if (!analysis) {
      setUploadStatus("Run the quote analysis before copying contractor questions.", "warn");
      return;
    }

    const text = buildContractorQuestionsText(analysis);
    if (!text) {
      setUploadStatus("No contractor questions were available for this quote.", "warn");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);

      const status = byId("contractorQuestionsCopyStatus");
      if (status) {
        status.innerHTML = `
          <div class="panel" style="margin-top:12px; background:#f0fdf4; border-color:#86efac;">
            <p style="margin:0;">
              <strong>Copied.</strong> Contractor questions copied to clipboard.
            </p>
          </div>
        `;
      }

      track("contractor_questions_copied", {
        verdict: analysis?.verdict || "",
        rawVerdict: analysis?.rawVerdict || "",
        recommendation: analysis?.recommendation?.action || ""
      });

      setUploadStatus("Contractor questions copied to clipboard.", "success");
    } catch (err) {
      console.error(err);

      track("contractor_questions_copy_failed", {
        verdict: analysis?.verdict || "",
        rawVerdict: analysis?.rawVerdict || "",
        recommendation: analysis?.recommendation?.action || ""
      });

      setUploadStatus("Could not copy contractor questions.", "error");
    }
  }

    function bindContractorQuestionsActions() {
      const btn = byId("copyContractorQuestionsBtn");
      if (!btn || btn.dataset.bound === "true") return;

      btn.addEventListener("click", function () {
        copyContractorQuestions();
      });

      btn.dataset.bound = "true";
    }

      function getSignalComparisonSelectionLabel(source) {
        const normalized = String(source || "").toLowerCase();

        if (normalized === "user_input") return "Entered by you";
        if (normalized === "parsed_quote") return "Quote";
        if (normalized === "address_estimated") return "Property";
        if (normalized === "price_based_estimate") return "Price model";

        return "Not available";
      }

    function buildSignalComparisonReasoning(analysis) {
      const selected =
        analysis?.signalComparison?.selected ||
        analysis?.roofSizeEstimateSource ||
        "";

      const source = String(selected).toLowerCase();
      const propertyMeta = analysis?.propertySignalsMeta || {};
      const disagreement = analysis?.roofSizeEstimateMeta?.disagreement || null;

      if (source === "user_input") {
        return "Using the roof size you entered directly.";
      }

      if (source === "parsed_quote") {
        if (disagreement?.hasDisagreement) {
          return "Quote roof size was used, but other signals did not fully agree.";
        }
        return "Quote roof size was clearly detected and used.";
      }

      if (source === "manual_calculator") {
        return "DIY calculator estimate was used based on home dimensions, pitch, and waste assumptions.";
      }

      if (source === "address_estimated") {
        const quality = String(propertyMeta?.buildingMatchQuality || "unknown").toLowerCase();

        if (propertyMeta?.ambiguous) {
          return "Property data was used, but the building match was ambiguous and should be reviewed.";
        }

        if (quality === "high") {
          return "Property data aligns best with the address and available match signals.";
        }

        if (quality === "approximate" || quality === "medium") {
          return "Property data was used as the best available fit, but precision may be limited.";
        }

        if (quality === "low") {
          return "Property data provided an estimate, but the building match quality was weak.";
        }

        return "Property data provided the best available roof size estimate.";
      }

      if (source === "price_based_estimate") {
        return "Roof size was estimated from quote price and local pricing benchmarks.";
      }

      return "No strong signal explanation was available.";
}

    function buildSignalComparisonHtml(analysis) {
      if (!analysis) return "";

      const signals = analysis?.roofSizeSignals || {};
      const parsed = Number(signals?.parsed || 0);
      const property = Number(signals?.property || 0);
      const priceImplied = Number(signals?.priceImplied || 0);

      const hasAny =
        (isFinite(parsed) && parsed > 0) ||
        (isFinite(property) && property > 0) ||
        (isFinite(priceImplied) && priceImplied > 0);

      if (!hasAny) return "";

      const selectedLabel = getSignalComparisonSelectionLabel(analysis?.roofSizeEstimateSource);
      const reasoning = buildSignalComparisonReasoning(analysis);

      return `
    <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:#f8fafc; border-color:#e5e7eb;">
      <h4 style="margin:0 0 10px;">Roof size signal comparison</h4>

      <div class="analysis-grid" style="margin-top:0;">
        <div><strong>Quote</strong></div>
        <div>${isFinite(parsed) && parsed > 0 ? `${safeFormatNumber(parsed)} sq ft` : "Not available"}</div>

        <div><strong>Property</strong></div>
        <div>${isFinite(property) && property > 0 ? `${safeFormatNumber(property)} sq ft` : "Not available"}</div>

        <div><strong>Price model</strong></div>
        <div>${isFinite(priceImplied) && priceImplied > 0 ? `${safeFormatNumber(priceImplied)} sq ft` : "Not available"}</div>

        <div><strong>Selected signal</strong></div>
        <div>${selectedLabel}</div>
      </div>

      <p class="small muted" style="margin:10px 0 0;">
        <strong>Why this signal won:</strong> ${reasoning}
      </p>
    </div>
  `;
}

    function getRiskFlagAccent(severity) {
      const normalized = String(severity || "").toLowerCase();
      if (normalized === "high") {
        return {
          bg: "#fef2f2",
          border: "#fca5a5",
          text: "#991b1b",
          icon: "⚠"
        };
      }

      if (normalized === "medium") {
        return {
          bg: "#fff7ed",
          border: "#fdba74",
          text: "#9a3412",
          icon: "⚠"
        };
      }

      return {
        bg: "#f8fafc",
        border: "#cbd5e1",
        text: "#334155",
        icon: "•"
      };
    }

    

    function buildRiskFlagsHtml(analysis) {
      const flags = Array.isArray(analysis?.riskFlags)
        ? analysis.riskFlags
        : buildRiskFlags(analysis);

      if (!flags.length) return "";

      return `
        <div style="display:grid; gap:10px; margin:0 0 14px;">
          ${flags.slice(0, 2).map(flag => {
            const accent = getRiskFlagAccent(flag?.severity);

            return `
              <div class="panel" style="margin:0; background:${accent.bg}; border-color:${accent.border};">
                <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:${accent.text};">
                  ${accent.icon} ${flag.title}
                </p>
                <p class="small" style="margin:0 0 6px; color:${accent.text};">
                  ${flag.impact || ""}
                </p>
                ${
                  flag.action
                    ? `<p class="small muted" style="margin:0;"><strong>Next move:</strong> ${flag.action}</p>`
                    : ""
                }
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    function buildConflictSignals(analysis) {
      const quotePrice = Number(analysis?.quotePrice);
      const low = Number(analysis?.low);
      const high = Number(analysis?.high);
      const roofSize = Number(analysis?.roofSize);
      const confidenceScore = Number(
        analysis?.confidenceScore ??
        analysis?.roofSizeEstimateConfidenceScore ??
        0
      );

      const items = [];

      if (
        isFinite(quotePrice) &&
        isFinite(low) &&
        isFinite(high) &&
        high > 0 &&
        quotePrice < low
      ) {
        items.push({
          key: "price_vs_expected",
          title: "Price and modeled cost disagree",
          detail: "Quote total is materially below the expected range for this project."
        });
      }

      if (!isFinite(roofSize) || roofSize <= 0) {
        items.push({
          key: "roof_size_uncertain",
          title: "Roof size confidence is limited",
          detail: "Roof size could not be strongly validated, which reduces confidence in the pricing model."
        });
      }

      if (confidenceScore > 0 && confidenceScore < 75) {
        items.push({
          key: "low_confidence_inputs",
          title: "Some inputs are reducing confidence",
          detail: "The result uses weaker or incomplete signals, so the final recommendation should be reviewed carefully."
        });
      }

      let severity = "none";
      if (items.length >= 3) severity = "high";
      else if (items.length >= 1) severity = "medium";

      return {
        hasConflict: items.length > 0,
        severity,
        summary:
          items.length > 0
            ? "Some pricing or roof size signals are not fully aligned."
            : "",
        details: items
      };
    }

    function buildRiskFlags(analysis) {
      const flags = [];
      if (!analysis) return flags;

      const rawVerdict = String(analysis.rawVerdict || "").toLowerCase();
      const verdict = String(analysis.verdict || "").toLowerCase();

      const roofSizeSeverity = String(
        analysis?.roofSizeConsistency?.severity || "none"
      ).toLowerCase();

      const propertyMeta = analysis?.propertySignalsMeta || {};

      const missingSignals = Array.isArray(analysis?.missingSignals)
        ? analysis.missingSignals
        : Array.isArray(latestParsed?.missingSignals)
          ? latestParsed.missingSignals
          : [];

      // =========================
      // 🔴 PRICING RISK
      // =========================

      if (
        rawVerdict.includes("overpriced") ||
        rawVerdict.includes("higher than expected")
      ) {
        flags.push({
          key: "potential_overpricing",
          title: "Potential overpricing",
          severity: rawVerdict.includes("overpriced") ? "high" : "medium",
          impact: "You may be paying above normal market pricing",
          action: "Request a breakdown and compare at least one additional quote"
        });
      }
      if (
        rawVerdict.includes("possible scope risk") ||
        rawVerdict.includes("unusually low")
      ) {
        flags.push({
          key: "low_bid_scope_risk",
          title: "Low bid scope risk",
          severity: "high",
          impact: "This quote is far below expected pricing and may be missing scope or lead to change orders later.",
          action: "Confirm inclusions, exclusions, and change order exposure before trusting the price",
          highlight: true
        });
      }

       // =========================
      // 🟠 ROOF SIZE / DATA CONFLICT
      // =========================

      if (roofSizeSeverity === "high") {
        flags.push({
          key: "roof_size_conflict",
          title: "Roof size conflict",
          severity: "high",
          impact: "Different data sources disagree on roof size, which affects pricing accuracy",
          action: "Verify roof size before making a decision"
        });
      } else if (roofSizeSeverity === "medium") {
        flags.push({
          key: "roof_size_variance",
          title: "Roof size variance",
          severity: "medium",
          impact: "Some inconsistency detected in roof size signals",
          action: "Double check measurements in the quote"
        });
      }

      // =========================
      // 🟡 PROPERTY DATA QUALITY
      // =========================

      if (propertyMeta?.ambiguous) {
        flags.push({
          key: "ambiguous_property_match",
          title: "Ambiguous property match",
          severity: "medium",
          impact: "Property data may be tied to multiple possible structures",
          action: "Confirm roof size manually or review satellite measurement"
        });
      }

      if (propertyMeta?.buildingMatchQuality === "low") {
        flags.push({
          key: "low_quality_property_match",
          title: "Low quality property match",
          severity: "medium",
          impact: "Property-based estimate may not accurately reflect your home",
          action: "Do not rely solely on automated roof size estimates"
        });
      }

      // =========================
      // 🧱 MISSING SCOPE ITEMS
      // =========================

      if (missingSignals.includes("flashing")) {
        flags.push({
          key: "missing_flashing",
          title: "Missing flashing",
          severity: "high",
          impact: "Missing flashing can lead to leaks and structural damage",
          action: "Ask contractor to confirm flashing is included"
        });
      }

      if (missingSignals.includes("ventilation")) {
        flags.push({
          key: "missing_ventilation",
          title: "Missing ventilation",
          severity: "medium",
          impact: "Poor ventilation reduces roof lifespan and efficiency",
          action: "Confirm ridge vents or other ventilation systems are included"
        });
      }

      if (missingSignals.includes("underlayment")) {
        flags.push({
          key: "missing_underlayment",
          title: "Missing underlayment details",
          severity: "medium",
          impact: "Underlayment is critical for waterproofing",
          action: "Ask what type and coverage of underlayment is included"
        });
      }

      // =========================
      // 🟢 SAFETY NET
      // =========================

      const normalizedRawVerdict = String(rawVerdict || "").toLowerCase();

      const hasVerdictConcern =
        normalizedRawVerdict.includes("possible scope risk") ||
        normalizedRawVerdict.includes("unusually low") ||
        normalizedRawVerdict.includes("overpriced") ||
        normalizedRawVerdict.includes("higher than expected");

      if (flags.length === 0 && !hasVerdictConcern) {
        flags.push({
          key: "no_major_risks",
          title: "No major risks detected",
          severity: "low",
          impact: "Quote appears generally consistent with expected pricing and scope",
          action: "You can proceed, but comparing one additional quote is still recommended"
        });
      }

      return flags;
    }

    function buildScopeRiskHtml(missingItems = []) {
      const scopeRisk = calculateScopeRisk(missingItems);

      return `
        <div class="signal-summary-wrap" style="margin-top:14px;">
          <h5 style="margin:0 0 8px;">Scope Risk</h5>
          <div style="font-weight:700; color:${scopeRisk.color}; margin-bottom:6px;">
            ${scopeRisk.level} Risk
          </div>
          <p class="small" style="margin:0 0 8px;">
            ${scopeRisk.description}
          </p>
          ${
            missingItems.length
              ? `
                <ul class="mini-list signal-summary-warn" style="margin-top:8px;">
                  ${missingItems.map(item => `<li>${item}</li>`).join("")}
                </ul>
              `
              : `
                <p class="small muted" style="margin:0;">No likely missing items were flagged.</p>
              `
          }
        </div>
      `;
    }

    function normalizeScopeLabel(label) {
      const value = String(label || "").trim().toLowerCase();

      const map = {
        "tear off": "Tear off",
        "tear-off": "Tear off",
        flashing: "Flashing",
        "drip edge": "Drip edge",
        underlayment: "Underlayment",
        "ice and water shield": "Ice and water shield",
        "ice & water shield": "Ice and water shield",
        "ice shield": "Ice and water shield",
        ventilation: "Ventilation",
        "ridge vent": "Ridge vent",
        "starter strip": "Starter strip",
        "ridge cap": "Ridge cap",
        decking: "Decking",
        "premium shingles": "Premium shingles",
        "synthetic underlayment": "Synthetic underlayment",
        "flashing upgrades": "Flashing upgrades",
        "ridge vent system": "Ridge vent system"
      };

      return map[value] || label;
    }

    function dedupeScopeLabels(items = []) {
      const seen = new Set();
      const output = [];

      (Array.isArray(items) ? items : []).forEach(item => {
        const normalized = normalizeScopeLabel(item);
        const key = String(normalized || "").trim().toLowerCase();

        if (!key || seen.has(key)) return;

        seen.add(key);
        output.push(normalized);
      });

      return output;
    }

    function buildScopeCheckHtml({
      includedSignals = [],
      missingSignals = [],
      premiumSignals = []
    } = {}) {
      const normalizedIncluded = dedupeScopeLabels(includedSignals);
      const normalizedMissing = dedupeScopeLabels(missingSignals);
      const normalizedPremium = dedupeScopeLabels(premiumSignals);

      const curatedMissingOrder = [
        "Flashing",
        "Drip edge",
        "Underlayment",
        "Ice and water shield",
        "Ventilation",
        "Ridge vent",
        "Starter strip",
        "Ridge cap",
        "Decking",
        "Tear off"
      ];

      const curatedIncludedOrder = [
        "Tear off",
        "Flashing",
        "Drip edge",
        "Underlayment",
        "Ice and water shield",
        "Ventilation",
        "Ridge vent",
        "Starter strip",
        "Ridge cap",
        "Decking"
      ];

      function sortByOrder(items, order) {
        return [...items].sort((a, b) => {
          const aIndex = order.indexOf(a);
          const bIndex = order.indexOf(b);
          const safeA = aIndex === -1 ? 999 : aIndex;
          const safeB = bIndex === -1 ? 999 : bIndex;
          if (safeA !== safeB) return safeA - safeB;
          return a.localeCompare(b);
        });
      }

      const included = sortByOrder(normalizedIncluded, curatedIncludedOrder);
      const missing = sortByOrder(
        normalizedMissing.filter(item => curatedMissingOrder.includes(item)),
        curatedMissingOrder
      ).slice(0, 5);
      const premium = normalizedPremium.slice(0, 4);

      const includedHtml = included.length
        ? `
          <div class="signal-summary-block">
            <h5>Clearly mentioned in the quote</h5>
            <ul class="mini-list signal-summary-good">
              ${included.map(item => `<li>✓ ${item}</li>`).join("")}
            </ul>
          </div>
        `
        : `
          <div class="signal-summary-block">
            <h5>Clearly mentioned in the quote</h5>
            <p class="small muted" style="margin:0;">
              The quote did not clearly list many common roofing scope items.
            </p>
          </div>
        `;

      const missingHtml = missing.length
        ? `
          <div class="signal-summary-block">
            <h5>Often included but not clearly listed</h5>
            <ul class="mini-list signal-summary-warn">
              ${missing.map(item => `<li>⚠ ${item}</li>`).join("")}
            </ul>
          </div>
        `
        : "";

      const premiumHtml = premium.length
        ? `
          <div class="signal-summary-block">
            <h5>Higher quality or complexity signals</h5>
            <ul class="mini-list signal-summary-premium">
              ${premium.map(item => `<li>${item}</li>`).join("")}
            </ul>
          </div>
        `
        : "";

      return `
        <div class="signal-summary-wrap">
          <h4 style="margin:0 0 10px;">Scope Check</h4>
          <p class="small muted" style="margin:0 0 12px;">
            This section highlights scope items clearly listed in the quote and common items that may need clarification.
          </p>
          ${includedHtml}
          ${missingHtml}
          ${premiumHtml}
        </div>
      `;
    }

    function clampNumber(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function calculateContractorPriceScore(quotePrice, mid) {
      const price = Number(quotePrice);
      const midpoint = Number(mid);

      if (!isFinite(price) || !isFinite(midpoint) || midpoint <= 0) {
        return {
          score: null,
          label: "Not available",
          color: "#6b7280",
          description: "A score could not be calculated from the current quote data."
        };
      }

      const pctDiff = ((price - midpoint) / midpoint) * 100;
      const absPctDiff = Math.abs(pctDiff);

      let score;

      if (pctDiff >= -8 && pctDiff <= 5) {
        score = 95 - absPctDiff * 1.5;
      } else if (pctDiff >= -15 && pctDiff < -8) {
        score = 82 - (Math.abs(pctDiff) - 8) * 2.0;
      } else if (pctDiff < -15) {
        score = 68 - (Math.abs(pctDiff) - 15) * 1.8;
      } else if (pctDiff > 5 && pctDiff <= 15) {
        score = 86 - (pctDiff - 5) * 2.0;
      } else if (pctDiff > 15 && pctDiff <= 30) {
        score = 66 - (pctDiff - 15) * 1.6;
      } else {
        score = 42 - (pctDiff - 30) * 1.2;
      }

      score = Math.round(clampNumber(score, 0, 100));

      if (pctDiff < -20) {
        return {
          score,
          label: "Very low bid",
          color: "#b45309",
          description: "This quote is far below the modeled midpoint. Low pricing can reflect missing scope, future change orders, or contractor risk."
        };
      }

      if (pctDiff < -10) {
        return {
          score,
          label: "Low bid",
          color: "#a16207",
          description: "This quote is materially below the modeled midpoint. Review scope details carefully before treating it as strong value."
        };
      }

      if (score >= 90) {
        return {
          score,
          label: "Strong pricing",
          color: "#15803d",
          description: "This quote appears well positioned relative to the modeled midpoint."
        };
      }

      if (score >= 75) {
        return {
          score,
          label: "Fair pricing",
          color: "#65a30d",
          description: "This quote appears reasonably aligned with expected market pricing."
        };
      }

          if (score >= 55) {
        return {
          score,
          label: "Higher than expected",
          color: "#b45309",
          description: "This quote is somewhat above the modeled midpoint."
        };
      }

      if (score >= 35) {
        return {
          score,
          label: "High pricing",
          color: "#dc2626",
          description: "This quote appears materially above the modeled midpoint."
        };
      }

      return {
        score,
        label: "Very high pricing",
        color: "#991b1b",
        description: "This quote appears far above the modeled midpoint."
      };
    }

    function getContractorPriceScoreContext(quotePrice, mid) {
      const result = calculateContractorPriceScore(quotePrice, mid);
      if (result.score === null) return "Score not available";
      return `${result.score} / 100 • ${result.label}`;
    }

    function buildTypicalPriceSummary({ city, stateCode, roofSize, low, high, mid }) {
      const hasRange = isFinite(Number(low)) && isFinite(Number(high));
      if (!hasRange) return "Typical local pricing was not available.";

      const locationLabel = [city, stateCode].filter(Boolean).join(", ") || "your area";
      const roofSizeLabel =
        isFinite(Number(roofSize)) && Number(roofSize) > 0
          ? `${safeFormatNumber(roofSize)} sq ft`
          : "similar-sized";

      const midpointText =
        isFinite(Number(mid)) && Number(mid) > 0
          ? `. Midpoint: ${safeFormatCurrency(mid)}`
          : "";

      return `${locationLabel}: ${safeFormatCurrency(low)} to ${safeFormatCurrency(high)}${midpointText}.`;
    }

    function buildMidpointDollarText(quotePrice, mid) {
      const price = Number(quotePrice);
      const midpoint = Number(mid);

      if (!isFinite(price) || !isFinite(midpoint) || midpoint <= 0) {
        return "Difference from midpoint not available";
      }

      const diff = price - midpoint;
      const absDiff = Math.abs(diff);

      if (absDiff < 50) {
        return "Within about $50 of modeled midpoint";
      }

      if (diff < 0) return `${safeFormatCurrency(absDiff)} below modeled midpoint`;
      return `${safeFormatCurrency(absDiff)} above modeled midpoint`;
    }

    function buildMarketPositionText(quotePrice, mid) {
      const price = Number(quotePrice);
      const midpoint = Number(mid);

      if (!isFinite(price) || !isFinite(midpoint) || midpoint <= 0) {
        return "Market position not available";
      }

      const pctDiff = ((price - midpoint) / midpoint) * 100;
      const absPctDiff = Math.abs(pctDiff).toFixed(1);

      if (Math.abs(pctDiff) < 2) {
        return "In line with modeled market midpoint";
      }

      if (pctDiff < 0) return `${absPctDiff}% below modeled market midpoint`;
      return `${absPctDiff}% above modeled market midpoint`;
    }

    function buildPriceGaugeHtml(price, low, mid, high) {
      const numericPrice = Number(price);
      const numericLow = Number(low);
      const numericMid = Number(mid);
      const numericHigh = Number(high);

      if (
        !isFinite(numericPrice) ||
        !isFinite(numericLow) ||
        !isFinite(numericHigh) ||
        numericHigh <= numericLow
      ) {
        return "";
      }

      const range = numericHigh - numericLow;
      let position = ((numericPrice - numericLow) / range) * 100;
      position = Math.max(0, Math.min(100, position));

      let positionLabel = "Within expected range";
      if (numericPrice < numericLow) positionLabel = "Below expected range";
      if (numericPrice > numericHigh) positionLabel = "Above expected range";

      return `
        <div class="panel" style="margin:0 0 12px; padding:12px 14px; background:#f8fafc; border-color:#e5e7eb;">
          <p style="margin:0 0 4px;"><strong>Where your quote falls</strong></p>
          <p class="small muted" style="margin:0 0 8px;">
            ${positionLabel}
          </p>

          <div class="price-gauge">
            <div class="price-gauge-bar">
              <div class="price-gauge-marker" style="left:${position}%"></div>
            </div>
            <div class="price-gauge-labels">
              <span>${safeFormatCurrency(numericLow)}</span>
              <span>${isFinite(numericMid) ? safeFormatCurrency(numericMid) : ""}</span>
              <span>${safeFormatCurrency(numericHigh)}</span>
            </div>
          </div>
        
      `;
    }

function buildDecisionDelta({ quotePrice, low, mid, high }) {
    const price = Number(quotePrice);
    const lowVal = Number(low);
    const midVal = Number(mid);
    const highVal = Number(high);

    if (![price, lowVal, midVal, highVal].every(isFinite) || highVal <= lowVal) {
      return null;
    }

    const delta = price - midVal;
    const absDelta = Math.abs(delta);

    let position = "within_range";
    if (price < lowVal) position = "below_range";
    if (price > highVal) position = "above_range";

    return {
      delta,
      absDelta,
      position,
      low: lowVal,
      mid: midVal,
      high: highVal
  };
}

function getDecisionDeltaStrength(absDelta) {
  const amount = Number(absDelta);
  if (!isFinite(amount)) return "weak";
  if (amount < 500) return "weak";
  if (amount < 2000) return "moderate";
  return "strong";
}

function buildDecisionDeltaText(decisionDelta) {
  if (!decisionDelta) return "";

  const absDelta = Number(decisionDelta.absDelta) || 0;

  // Suppress meaningless small deltas
  if (absDelta < 100) {
    return "This quote is in line with expected pricing";
  }

  const amt = safeFormatCurrency(absDelta);

  if (decisionDelta.position === "above_range") {
    return `You may be overpaying by ~${amt}`;
  }

  if (decisionDelta.position === "below_range") {
    return `This quote is ~${amt} below expected pricing`;
  }

  return `This quote is within ~${amt} of expected pricing`;
}

function buildDecisionDeltaHtml(analysis) {
  const decisionDelta = buildDecisionDelta(analysis);
  if (!decisionDelta) return "";

  const text = softenClaim(buildDecisionDeltaText(decisionDelta), analysis);
  const strength = getDecisionDeltaStrength(decisionDelta.absDelta);

  const background =
    strength === "strong"
      ? "#fef2f2"
      : strength === "moderate"
        ? "#f8fafc"
        : "#f9fafb";

  return `
    <div class="panel" style="margin:0 0 14px; padding:16px 18px; background:${background}; border-color:#e5e7eb;">
      <div style="font-size:30px; line-height:1.1; font-weight:800; margin:0 0 8px;">
        ${text}
      </div>
      <p class="small muted" style="margin:0;">
        Typical range: ${safeFormatCurrency(decisionDelta.low)} to ${safeFormatCurrency(decisionDelta.high)}
      </p>
    </div>
  `;
}

    function buildDifferenceDisplay(quotePrice, mid) {
      const price = Number(quotePrice);
      const midpoint = Number(mid);

      if (!isFinite(price) || !isFinite(midpoint) || midpoint <= 0) {
        return "Not available";
      }

      const diff = price - midpoint;
      const diffPct = (diff / midpoint) * 100;
      const absDiff = Math.abs(diff);
      const absPct = Math.abs(diffPct);

      if (absPct < 1) {
        return "In line with modeled midpoint";
      }

      if (absPct < 3) {
        return diff < 0
          ? `Slightly below midpoint`
          : `Slightly above midpoint`;
      }

      return `${diff < 0 ? "-" : ""}${safeFormatCurrency(absDiff)} (${diffPct.toFixed(1)}%)`;
}

    function getFileNameBase(name) {
      return String(name || "")
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
    }

    function inferContractorNameFromParsed(parsedObj, fallbackFileName) {
      if (!parsedObj || typeof parsedObj !== "object") {
        return getFileNameBase(fallbackFileName || "");
      }

      const candidate =
        String(
          parsedObj.contractorName ||
          parsedObj.companyName ||
          parsedObj.contractor ||
          parsedObj.company ||
          parsedObj.vendor ||
          ""
        ).trim();

      if (candidate) return candidate;

      return getFileNameBase(fallbackFileName || "");
    }

    function getParsedComparisonPrice(parsedObj) {
      if (!parsedObj || typeof parsedObj !== "object") return null;

      const candidates = [
        parsedObj.price,
        parsedObj.totalLinePrice,
        parsedObj.finalBestPrice,
        parsedObj.totalPrice,
        parsedObj.total,
        parsedObj.quotePrice,
        parsedObj.grandTotal,
        parsedObj.amount
      ];

      for (const value of candidates) {
        const num = Number(value);
        if (isFinite(num) && num > 0) return num;
      }

      return null;
    }

    function buildComparisonQuoteFromUpload(parsedBundle, manualName, manualPrice, fallbackLabel) {
      const parsed = parsedBundle?.parsed || parsedBundle || null;

      const manualPriceNum = Number(manualPrice);
      const parsedPrice = getParsedComparisonPrice(parsed);

      const total =
        isFinite(manualPriceNum) && manualPriceNum > 0
          ? manualPriceNum
          : parsedPrice;

      const inferredContractor = inferContractorNameFromParsed(
        parsed,
        parsedBundle?.fileName || fallbackLabel
      );

      const contractor =
        String(manualName || "").trim() ||
        inferredContractor ||
        fallbackLabel;

      const parsedRoofSize = Number(
        parsed?.roofSize ||
        parsed?.measurements?.roofSize ||
        parsed?.roof_area ||
        parsed?.sqft
      );

      return {
        label: fallbackLabel,
        contractor,
        total: isFinite(total) && total > 0 ? total : null,
        roofSize: isFinite(parsedRoofSize) && parsedRoofSize > 0 ? parsedRoofSize : null,
        material: parsed?.materialLabel || parsed?.material || "Not detected",
        warranty: displayWarranty(parsed?.warranty || ""),
        source: parsedBundle ? "upload" : "manual",
        fileName: parsedBundle?.fileName || ""
      };
    }

    function buildPrimaryComparisonQuote() {
      const parsed = latestParsed || {};
      const analysis = latestAnalysis || {};

      const contractor =
        inferContractorNameFromParsed(parsed, "Quote 1") || "Quote 1";

      const total =
        getParsedComparisonPrice(parsed) ||
        (isFinite(Number(analysis.quotePrice)) && Number(analysis.quotePrice) > 0
          ? Number(analysis.quotePrice)
          : null);

      const roofSize =
        isFinite(Number(parsed?.roofSize)) && Number(parsed.roofSize) > 0
          ? Number(parsed.roofSize)
          : isFinite(Number(analysis?.roofSize)) && Number(analysis.roofSize) > 0
            ? Number(analysis.roofSize)
            : null;

      return {
        label: inferContractorNameFromParsed(parsed, "Contractor"),
        contractor,
        total,
        roofSize,
        material: parsed?.materialLabel || parsed?.material || analysis?.material || "Not detected",
        warranty: displayWarranty(parsed?.warranty || ""),
        source: "primary"
      };
    }

    function renderComparisonSourceLabel(source) {
      if (source === "primary") return "Primary analyzed quote";
      if (source === "upload") return "Parsed from upload";
      return "Manual entry";
    }

    function normalizeComparisonQuote(raw, fallbackLabel) {
      if (!raw || typeof raw !== "object") return null;

      const parsedTotal = Number(raw.total);
      const total = isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : null;

      const parsedRoofSize = Number(raw.roofSize);
      const roofSize = isFinite(parsedRoofSize) && parsedRoofSize > 0 ? parsedRoofSize : null;

      const contractor =
        String(raw.contractor || raw.name || raw.label || "").trim() || fallbackLabel;

      const source =
        String(raw.source || "").trim() || "manual";

      return {
        label: raw.label || fallbackLabel,
        contractor,
        total,
        roofSize,
        material: raw.material || "Not detected",
        warranty: raw.warranty || "Not listed in quote",
        source,
        fileName: raw.fileName || "",
        pricePerSqFt: total && roofSize ? total / roofSize : null,
        isValid: !!total,
        isPartial: !total
      };
    }

function getComparisonScopeScore(quote) {
    let score = 0;

    const material = String(quote?.material || "").toLowerCase();
    const warranty = String(quote?.warranty || "").toLowerCase();

    if (material && material !== "not detected") score += 10;
    if (warranty && warranty !== "not listed in quote" && warranty !== "not detected") score += 10;

    return score;
  }

function getComparisonWarrantyScore(quote) {
  const warranty = String(quote?.warranty || "").toLowerCase();

  if (!warranty || warranty === "not listed in quote" || warranty === "not detected") {
    return 0;
  }

  const yearsMatch = warranty.match(/(\d+)/);
  const years = yearsMatch ? Number(yearsMatch[1]) : 0;

  if (years >= 25) return 15;
  if (years >= 10) return 10;
  if (years > 0) return 6;

  return 8;
}

function scoreComparisonQuote(quote, analysis) {
  const price = Number(quote?.total || 0);
  const mid = Number(analysis?.mid || 0);

  if (!isFinite(price) || price <= 0 || !isFinite(mid) || mid <= 0) {
    return {
      totalScore: 0,
      priceScore: 0,
      scopeScore: 0,
      warrantyScore: 0,
      riskPenalty: 0,
      confidencePenalty: 0,
      band: "unscored",
      reasons: ["Quote price could not be scored reliably."],
      warnings: ["Comparison score is incomplete because price could not be evaluated."]
    };
  }

  const pctOffMid = ((price - mid) / mid) * 100;
  const absPctOffMid = Math.abs(pctOffMid);

  let priceScore = 0;
  let riskPenalty = 0;
  let confidencePenalty = 0;
  let band = "fair";
  const reasons = [];
  const warnings = [];

  if (price < mid * 0.78) {
    priceScore = 18;
    riskPenalty = 24;
    band = "suspicious_low";
    reasons.push("Price is far below modeled midpoint");
    warnings.push("Very low bid may reflect missing scope, change orders, or contractor risk");
  } else if (price < mid * 0.88) {
    priceScore = 52;
    riskPenalty = 10;
    band = "low";
    reasons.push("Price is below modeled midpoint");
    warnings.push("Lower bid should be checked for omissions before treating it as best value");
  } else if (price <= mid * 1.05) {
    priceScore = 94;
    band = "strong";
    reasons.push("Price is close to modeled midpoint");
  } else if (price <= mid * 1.15) {
    priceScore = 78;
    band = "fair";
    reasons.push("Price is somewhat above modeled midpoint");
  } else if (price <= mid * 1.30) {
    priceScore = 54;
    riskPenalty = 8;
    band = "high";
    reasons.push("Price is materially above modeled midpoint");
  } else {
    priceScore = 28;
    riskPenalty = 16;
    band = "very_high";
    reasons.push("Price is far above modeled midpoint");
    warnings.push("This quote is expensive relative to modeled pricing");
  }

  const rawScopeScore = getComparisonScopeScore(quote);
  const rawWarrantyScore = getComparisonWarrantyScore(quote);

  // Keep metadata helpful, but do not let parsing quality dominate
  const scopeScore = Math.min(rawScopeScore, 8);
  const warrantyScore = Math.min(rawWarrantyScore, 10);

  if (scopeScore >= 8) {
    reasons.push("More quote details were clearly identified");
  }

  if (warrantyScore >= 10) {
    reasons.push("Warranty appears stronger or more clearly stated");
  } else if (warrantyScore >= 6) {
    reasons.push("Warranty information was present");
  }

  if (!quote?.roofSize || quote.roofSize <= 0) {
    confidencePenalty += 4;
    warnings.push("Roof size was not detected for this quote");
  }

  const totalScore = Math.round(
    Math.max(0, Math.min(100, priceScore + scopeScore + warrantyScore - riskPenalty - confidencePenalty))
  );

  return {
    totalScore,
    priceScore: Math.round(priceScore),
    scopeScore,
    warrantyScore,
    riskPenalty,
    confidencePenalty,
    band,
    reasons,
    warnings
  };
}

function buildComparisonWinnerSummary(quotes, analysis) {
  const validQuotes = (Array.isArray(quotes) ? quotes : []).filter(q => q?.isValid);
  if (validQuotes.length < 2 || !analysis) return null;

  const scored = validQuotes.map(quote => {
    const score = scoreComparisonQuote(quote, analysis);
    return {
      ...quote,
      comparisonScore: score.totalScore,
      comparisonBreakdown: score
    };
  });

  const ranked = [...scored].sort((a, b) => {
    if (b.comparisonScore !== a.comparisonScore) {
      return b.comparisonScore - a.comparisonScore;
    }

    const aDist = Math.abs((Number(a.total) || 0) - (Number(analysis.mid) || 0));
    const bDist = Math.abs((Number(b.total) || 0) - (Number(analysis.mid) || 0));
    return aDist - bDist;
  });

  const winner = ranked[0];
  const runnerUp = ranked[1] || null;

  const winnerBand = String(winner?.comparisonBreakdown?.band || "");
  const winnerWarnings = Array.isArray(winner?.comparisonBreakdown?.warnings)
    ? winner.comparisonBreakdown.warnings
    : [];

  const blockingWarningPatterns = [
  /very low bid/i,
  /missing scope/i,
  /change orders/i,
  /contractor risk/i,
  /far above modeled midpoint/i,
  /expensive relative to modeled pricing/i
];

const hasBlockingWarning = winnerWarnings.some(warning =>
  blockingWarningPatterns.some(pattern => pattern.test(String(warning || "")))
);

const shouldSoftenWinner =
  winnerBand === "suspicious_low" ||
  winnerBand === "very_high" ||
  hasBlockingWarning;

  const losers = ranked.slice(1).map(q => ({
    name: q.contractor,
    reasons: q.comparisonBreakdown.reasons.slice(0, 2),
    warnings: q.comparisonBreakdown.warnings.slice(0, 1),
    score: q.comparisonScore
  }));

  return {
    winner: winner.contractor,
    winnerQuote: winner,
    runnerUp,
    losers,
    ranked,
    shouldSoftenWinner,
    winnerWarnings
  };
}

function buildComparisonWinnerHtml(summary) {
  if (!summary?.winnerQuote) return "";

  const winner = summary.winnerQuote;
  const runnerUp = summary?.runnerUp || null;
  const softened = !!summary.shouldSoftenWinner;
  const warnings = Array.isArray(summary.winnerWarnings) ? summary.winnerWarnings : [];
  const reasons = Array.isArray(winner?.comparisonBreakdown?.reasons)
    ? winner.comparisonBreakdown.reasons.slice(0, 2)
    : [];

  const title = softened
    ? "Current leader"
    : "Comparison decision";

  const headline = softened
    ? `${winner.contractor} is in front, but not decision ready`
    : `${winner.contractor} wins`;

  const nextStep = softened
    ? "Do not select this quote yet. Resolve the warning first."
    : "Advance this contractor unless new scope issues appear.";

  const shellBg = softened ? "#fff7ed" : "#f0fdf4";
  const shellBorder = softened ? "#fdba74" : "#86efac";
  const shellText = softened ? "#9a3412" : "#166534";

  const runnerUpLine = runnerUp
    ? `<p class="small muted" style="margin:0 0 10px;">
        <strong>Runner up:</strong> ${runnerUp.contractor} (${runnerUp.comparisonScore}/100)
      </p>`
    : "";

  const warningHtml = warnings.length
    ? `
      <div class="panel" style="margin:0 0 10px; background:#fff7ed; border-color:#fdba74;">
        <p style="margin:0;">
          <strong>Do not ignore this:</strong> ${warnings[0]}.
        </p>
      </div>
    `
    : "";

  const whyWonHtml = reasons.length
    ? `
      <div class="panel" style="margin:0 0 10px; background:#f8fafc; border-color:#e5e7eb;">
        <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#334155;">
          Why it won
        </p>
        <ul class="mini-list" style="margin:0;">
          ${reasons.map(reason => `<li>${reason}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  const othersHtml = summary.losers.length
    ? `
      <div class="small muted" style="margin-top:8px;">
        <strong>Other quotes:</strong>
        <ul class="mini-list" style="margin-top:6px;">
          ${summary.losers.map(loser => `
            <li>
              <strong>${loser.name}:</strong>
              Score ${loser.score}/100.
              ${loser.reasons.join(". ")}
              ${loser.warnings?.length ? ` Warning: ${loser.warnings[0]}` : ""}
            </li>
          `).join("")}
        </ul>
      </div>
    `
    : "";

  return `
    <div class="panel" style="margin:0 0 14px; padding:14px 16px; background:${shellBg}; border-color:${shellBorder};">
      <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:${shellText};">
        ${title}
      </p>

      <div style="margin:0 0 6px; font-size:30px; line-height:1.05; font-weight:800; color:${shellText};">
        ${headline}
      </div>

      <p style="margin:0 0 8px;">
        <strong>Score:</strong> ${winner.comparisonScore} / 100
      </p>

      <p style="margin:0 0 12px;">
        <strong>Quoted price:</strong> ${safeFormatCurrency(winner.total)}
      </p>

      ${runnerUpLine}

      ${warningHtml}

      ${whyWonHtml}

      <div class="panel" style="margin:0 0 10px; background:#eff6ff; border-color:#93c5fd;">
        <p style="margin:0;">
          <strong>Next step:</strong> ${nextStep}
        </p>
      </div>

      ${othersHtml}

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button type="button" class="btn secondary" id="copyComparisonWinnerBtn">
          Copy winner summary
        </button>
        <button type="button" class="btn secondary" id="copyContractorQuestionsFromCompareBtn">
          Copy contractor questions
        </button>
        <button type="button" class="btn secondary" id="viewShareReportFromCompareBtn">
          View share report
        </button>
      </div>
    </div>
  `;
}

      function buildComparisonWinnerText(summary) {
        if (!summary?.winnerQuote) return "";

        const winner = summary.winnerQuote;
        const runnerUp = summary?.runnerUp || null;
        const softened = !!summary.shouldSoftenWinner;
        const warnings = Array.isArray(summary.winnerWarnings) ? summary.winnerWarnings : [];
        const reasons = Array.isArray(winner?.comparisonBreakdown?.reasons)
          ? winner.comparisonBreakdown.reasons.slice(0, 2)
          : [];

        const nextStep = softened
          ? "Do not select this quote yet. Resolve the warning first."
          : "This is the quote to advance unless new scope issues appear.";

        const lines = [
          "TruePrice Comparison Decision",
          "",
          softened
            ? `Current leader: ${winner.contractor}`
            : `Winner: ${winner.contractor}`,
          `Score: ${winner.comparisonScore} / 100`,
          `Quoted price: ${safeFormatCurrency(winner.total)}`,
        ];

        if (runnerUp?.contractor) {
          const scoreGap =
            Number(winner.comparisonScore || 0) - Number(runnerUp.comparisonScore || 0);

          lines.push(
            `Runner up: ${runnerUp.contractor}${isFinite(scoreGap) ? ` (${Math.abs(scoreGap)} points behind)` : ""}`
          );
        }

        if (reasons.length) {
          lines.push(
            "",
            `Why it won: ${reasons[0]}${reasons[1] ? `. ${reasons[1]}` : ""}`
          );
        }

        if (warnings.length) {
          lines.push(
            `Warning: ${warnings[0]}`
          );
        }

        lines.push(
          `Next step: ${nextStep}`
        );

        if (summary.losers?.length) {
          lines.push(
            "",
            "Other quotes:"
          );

          summary.losers.forEach(loser => {
            const loserReasons = Array.isArray(loser?.reasons) ? loser.reasons.slice(0, 2) : [];
            const loserWarnings = Array.isArray(loser?.warnings) ? loser.warnings.slice(0, 1) : [];

            lines.push(
              `- ${loser.name}: Score ${loser.score}/100.${loserReasons.length ? ` ${loserReasons.join(". ")}.` : ""}${loserWarnings.length ? ` Warning: ${loserWarnings[0]}.` : ""}`
            );
          });
        }

        return lines.join("\n");
      }

      function bindComparisonWinnerActions(summary) {
        const copyWinnerBtn = byId("copyComparisonWinnerBtn");
        const copyQuestionsBtn = byId("copyContractorQuestionsFromCompareBtn");
        const viewReportBtn = byId("viewShareReportFromCompareBtn");

        if (copyWinnerBtn && copyWinnerBtn.dataset.bound !== "true") {
          copyWinnerBtn.addEventListener("click", async function () {
            const text = buildComparisonWinnerText(summary);
            if (!text) return;

            try {
              await navigator.clipboard.writeText(text);
              setUploadStatus("Comparison winner summary copied to clipboard.", "success");
            } catch (err) {
              console.error(err);
              setUploadStatus("Could not copy comparison winner summary.", "error");
            }
          });

          copyWinnerBtn.dataset.bound = "true";
        }

        if (copyQuestionsBtn && copyQuestionsBtn.dataset.bound !== "true") {
          copyQuestionsBtn.addEventListener("click", function () {
            copyContractorQuestions();
          });

          copyQuestionsBtn.dataset.bound = "true";
        }

        if (viewReportBtn && viewReportBtn.dataset.bound !== "true") {
          viewReportBtn.addEventListener("click", function () {
            viewShareableResult();
            const output = byId("inlineShareReportOutput");
            if (output) {
              setTimeout(() => {
                output.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 150);
            }
          });

          viewReportBtn.dataset.bound = "true";
        }
      }


      function getComparisonBandLabel(band) {
        const normalized = String(band || "").toLowerCase();

        if (normalized === "strong") return "Strong";
        if (normalized === "fair") return "Fair";
        if (normalized === "low") return "Low bid";
        if (normalized === "suspicious_low") return "Suspiciously low";
        if (normalized === "high") return "High";
        if (normalized === "very_high") return "Very high";

        return "Unscored";
      }

      function buildComparisonScoreCellHtml(quote) {
        const breakdown = quote?.comparisonBreakdown || null;
        if (!breakdown) return "Not available";

        const score = Number(breakdown.totalScore);
        const bandLabel = getComparisonBandLabel(breakdown.band);

        return `
          <div>
            <strong>${isFinite(score) ? `${score} / 100` : "Not available"}</strong>
          </div>
          <div class="small muted" style="margin-top:4px;">
            ${bandLabel}
          </div>
        `;
      }

      function renderParsedSignalSection(parsed) {
        const container = byId("parsedSignalSection");
        if (!container) return;
        container.innerHTML = "";
      }

      function buildAIExplanation(analysis) {
        const {
          verdict,
          quotePrice,
          low,
          mid,
          high,
          material,
          roofSize,
          city,
          stateCode,
          localDataUsed,
          sizeLabelUsed,
          tearOffLabel,
          warrantyYears,
          premiumSignals,
          analysisConfidenceLabel,
          roofSizeNeedsReview,
          roofSizeConsistency,
          reliabilityTier
        } = analysis || {};

        const materialLabel =
          material === "architectural"
            ? "architectural shingles"
            : material === "asphalt"
              ? "asphalt shingles"
              : material === "metal"
                ? "metal roofing"
                : material === "tile"
                  ? "tile roofing"
                  : "roofing";

        const locationLabel =
          city && stateCode ? `${city}, ${stateCode}` : stateCode || city || "your area";

        const confidenceLabel = analysisConfidenceLabel || "Low";
        const consistencySeverity = String(roofSizeConsistency?.severity || "low").toLowerCase();

        const confidenceModeAnalysis = {
          reliabilityTier,
          roofSizeNeedsReview,
          roofSizeConsistency
        };

        const benchmarkText = localDataUsed
          ? `We compared it against local benchmark pricing for ${locationLabel}${sizeLabelUsed ? ` using the nearest size bucket (${sizeLabelUsed})` : ""}.`
          : `We compared it against benchmark pricing for ${materialLabel} in ${locationLabel}.`;

        const trustPrefix =
          consistencySeverity === "high"
            ? "This result should be treated as provisional until roof size is verified. "
            : consistencySeverity === "medium"
              ? "This result is directionally useful, but roof size signals are mixed. "
              : "";

        const trustSuffix =
          consistencySeverity === "high"
            ? " Verify roof size before relying on the price result."
            : consistencySeverity === "medium"
              ? " Treat the verdict as directional rather than exact."
              : roofSizeNeedsReview
                ? " Roof size may need review before relying on this result."
                : "";

        const premiumText =
          Array.isArray(premiumSignals) && premiumSignals.length
            ? ` Premium or complexity signals were detected: ${premiumSignals.join(", ")}.`
            : "";

        const tearOffText =
          tearOffLabel === "yes"
            ? " Tear off appears to be included."
            : tearOffLabel === "no"
              ? " Tear off does not appear to be included."
              : "";

        const warrantyText =
          warrantyYears && Number(warrantyYears) > 0
            ? ` Detected warranty: ${warrantyYears} years.`
            : "";

        if (!roofSize || !material || material === "unknown") {
          return `${trustPrefix}We found a usable quote price, but some important quote details were unclear. Add roof size, material, and location details to improve accuracy. Analysis confidence: ${confidenceLabel}.${trustSuffix}`;
        }

        if (verdict === "Fair Price") {
          return `${trustPrefix}${softenClaim(`This quote aligns with expected pricing for this type of project in ${locationLabel}.`, confidenceModeAnalysis)} ${benchmarkText} Confidence: ${confidenceLabel}.${trustSuffix}`;
        }

        if (
          verdict === "Higher Than Expected" ||
          verdict === "May Be Higher Than Expected" ||
          verdict === "Possibly Higher Than Expected"
        ) {
          return `${trustPrefix}${softenClaim(`This quote is above expected pricing for this type of project in ${locationLabel}.`, confidenceModeAnalysis)} ${benchmarkText} Confidence: ${confidenceLabel}.${trustSuffix}`;
        }

        if (
          verdict === "Overpriced" ||
          verdict === "May Be Overpriced" ||
          verdict === "Possibly Overpriced"
        ) {
          return `${trustPrefix}${softenClaim(`This quote is materially above expected pricing.`, confidenceModeAnalysis)} ${benchmarkText} Confidence: ${confidenceLabel}.${trustSuffix}`;
        }

        if (
          verdict === "Possible Scope Risk" ||
          verdict === "Possible Scope Risk, With Some Uncertainty" ||
          verdict === "Low Price, But Roof Size Needs Review"
        ) {
          return `${trustPrefix}${softenClaim(`This quote is below expected pricing and may be missing scope items.`, confidenceModeAnalysis)} ${benchmarkText} Confidence: ${confidenceLabel}.${trustSuffix}`;
        }

        if (
          verdict === "Unusually Low" ||
          verdict === "May Be Unusually Low" ||
          verdict === "Possibly Unusually Low"
        ) {
          return `${trustPrefix}${softenClaim(`This quote is below expected pricing for a ${roofSize || "similar-sized"} ${materialLabel} project in ${locationLabel}.`, confidenceModeAnalysis)} ${benchmarkText}${tearOffText}${warrantyText} Double check that the quote includes underlayment, flashing, ventilation, disposal, and warranty details. Analysis confidence: ${confidenceLabel}.${trustSuffix}${premiumText}`;
        }

        return `${trustPrefix}${softenClaim(`This quote was compared against expected pricing for a ${roofSize || "similar-sized"} ${materialLabel} project in ${locationLabel}.`, confidenceModeAnalysis)} ${benchmarkText} Analysis confidence: ${confidenceLabel}.${trustSuffix}${premiumText}`;
      }

      function renderAnalysisPanels(parsed) {
        const container = byId("analysisPanels");
      if (!container) return;

      const analysis = latestAnalysis || {};

      const confidenceLabel = analysis?.analysisConfidenceLabel || parsed?.confidenceLabel || "Low";
      const confidenceClass = getConfidenceBadgeClass(confidenceLabel);

      const parserWarnings = Array.isArray(parsed?.warnings) ? parsed.warnings : [];
      const parserWarningsHtml = parserWarnings.length
        ? `<ul class="mini-list signal-summary-warn">${parserWarnings.map(item => `<li>${item}</li>`).join("")}</ul>`
        : `<p class="small muted" style="margin:0;">No major parsing warnings.</p>`;

      const includedSignals = Array.isArray(parsed?.includedSignals) ? parsed.includedSignals : [];
      const missingSignals = Array.isArray(parsed?.missingSignals) ? parsed.missingSignals : [];
      const premiumSignals = Array.isArray(parsed?.premiumSignals) ? parsed.premiumSignals : [];

      const scopeCheckHtml = buildScopeCheckHtml({
        includedSignals,
        missingSignals,
        premiumSignals
      });

      const scopeRiskHtml = buildScopeRiskHtml(missingSignals);

      const roofSizeDisplay =
        analysis?.roofSize
          ? formatRoofSizeForDisplay(
              analysis.roofSize,
              analysis.roofSizeEstimateSource,
              analysis.roofSizeEstimateConfidence
            )
          : "Not detected";

      const materialDisplay =
        parsed?.materialLabel && parsed.materialLabel !== "Unknown"
          ? parsed.materialLabel
          : analysis?.material
            ? displayMaterial(analysis.material)
            : "Not detected";

      const warrantyDisplay =
        parsed?.warranty && String(parsed.warranty).trim().toLowerCase() !== "not detected"
          ? displayWarranty(parsed.warranty)
          : analysis?.warrantyYears
            ? `${analysis.warrantyYears} years`
            : "Not listed in quote";

      const locationDisplay =
        [analysis?.city, analysis?.stateCode].filter(Boolean).join(", ") || "Not detected";

      container.innerHTML = `
        <div class="panel" style="margin-top:18px;">
          <button
            type="button"
            class="btn btn-ghost"
            id="toggleDetailsBtn"
            style="width:100%; text-align:left;"
          >
            See details behind this result
          </button>

          <div id="analysisDetailsContent" style="display:none; margin-top:12px;">

            <div>
              <h4>What we used to analyze your quote</h4>
              <ul class="mini-list">
                <li><strong>Material:</strong> ${materialDisplay}</li>
                <li><strong>Roof size:</strong> ${roofSizeDisplay}</li>
                <li><strong>Warranty:</strong> ${warrantyDisplay}</li>
                <li><strong>Location:</strong> ${locationDisplay}</li>
              </ul>
            </div>

            <div>
              <h4>Scope and risk signals</h4>

              <p style="margin:0 0 10px;">
                <span class="confidence-badge ${confidenceClass}">
                  Confidence: ${confidenceLabel}
                </span>
              </p>

              ${
                parserWarnings.length
                  ? `
                    <div class="signal-summary-wrap">
                      <h5 style="margin:0 0 8px;">Things we were less certain about</h5>
                      ${parserWarningsHtml}
                    </div>
                  `
                  : ""
              }

              <div style="margin-top:14px;">
                ${scopeCheckHtml}
              </div>

              ${scopeRiskHtml}
            </div>

          </div>
        </div>
      `;

      const toggleBtn = byId("toggleDetailsBtn");
  const content = byId("analysisDetailsContent");

  if (toggleBtn && content) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = content.style.display === "block";
      content.style.display = isOpen ? "none" : "block";
      toggleBtn.innerText = isOpen
        ? "See details behind this result"
        : "Hide details";
      toggleBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
}
    }

    function getRoofSizeSourceDisplay(source) {
  const normalized = String(source || "").toLowerCase();

  if (normalized === "user_input") return "Entered by you";
  if (normalized === "parsed_quote") return "Found in the quote";
  if (normalized === "address_estimated") return "Estimated from property data";
  if (normalized === "price_based_estimate") return "Estimated from pricing signals";
  if (normalized === "manual_calculator") return "Estimated with DIY calculator";
  if (normalized === "unavailable") return "Not available";

  return "Not available";
}

      function getReliabilityTier({ source, confidenceScore, disagreement }) {
        const normalizedSource = String(source || "").toLowerCase();
        const score = Number(confidenceScore);
        const hasDisagreement = !!disagreement?.hasDisagreement;

        if (normalizedSource === "user_input" || normalizedSource === "parsed_quote") {
          return "VERIFIED";
        }

        if (normalizedSource === "manual_calculator") {
          return hasDisagreement ? "ESTIMATED" : "HIGH_CONFIDENCE";
        }

        if (isFinite(score) && score >= 80 && !hasDisagreement) {
          return "HIGH_CONFIDENCE";
        }

        if (isFinite(score) && score >= 60) {
          return "ESTIMATED";
        }

        return "LOW_CONFIDENCE";
      }

      function getReliabilityTierLabel(tier) {
        if (tier === "VERIFIED") return "Verified";
        if (tier === "HIGH_CONFIDENCE") return "High confidence estimate";
        if (tier === "ESTIMATED") return "Estimated using modeling";
        return "Low confidence – review inputs";
      }

      function getReliabilityTierClass(tier) {
        if (tier === "VERIFIED") return "high";
        if (tier === "HIGH_CONFIDENCE") return "high";
        if (tier === "ESTIMATED") return "medium";
        return "low";
      }

      function getReliabilityTierExplanation(tier) {
        if (tier === "VERIFIED") {
          return "Key pricing inputs were directly entered or clearly found in the quote.";
        }

        if (tier === "HIGH_CONFIDENCE") {
          return "The estimate is supported by strong signals with low disagreement.";
        }

        if (tier === "ESTIMATED") {
          return "This result depends partly on modeled inputs, so treat it as directional.";
        }

        return "Important inputs are uncertain or conflicting. Review inputs before relying on this result.";
      }

      function getPropertyMatchQualityLabel(value) {
        const normalized = String(value || "").toLowerCase();

        if (normalized === "high") return "High";
        if (normalized === "medium") return "Moderate";
        if (normalized === "approximate") return "Approximate";
        if (normalized === "low") return "Low";

        return "Unknown";
      }

      function buildPropertyMetadataTrustHtml(analysis) {
        const source = String(analysis?.roofSizeEstimateSource || "").toLowerCase();
        const meta = analysis?.propertySignalsMeta || {};

        if (source !== "address_estimated") return "";

        const quality = getPropertyMatchQualityLabel(meta.buildingMatchQuality);
        const geocodeQuality = String(meta.geocodeMatchQuality || "unknown");
        const candidateCount = Number(meta.candidateCount || 0);
        const ambiguous = !!meta.ambiguous;

        return `
          <div class="small muted" style="margin:8px 0 0;">
            <div><strong>Property match quality:</strong> ${quality}</div>
            <div><strong>Geocode match quality:</strong> ${geocodeQuality}</div>
            ${
              candidateCount > 0
                ? `<div><strong>Candidate buildings reviewed:</strong> ${candidateCount}</div>`
                : ""
            }
            ${
              ambiguous
                ? `<div style="margin-top:4px;"><strong>Warning:</strong> Property match was ambiguous and may reduce confidence.</div>`
                : ""
            }
          </div>
        `;
      }

      function buildResultTrustHtml(analysis) {
        if (!analysis) return "";

        const roofSizeSource = getRoofSizeSourceDisplay(analysis.roofSizeEstimateSource);
        const trustNote = getVerdictTrustNote(analysis.roofSizeConsistency);

        const reliabilityTier = getReliabilityTier({
          source: analysis.roofSizeEstimateSource,
          confidenceScore: analysis.roofSizeEstimateConfidenceScore,
          disagreement: analysis.roofSizeEstimateMeta?.disagreement || analysis.roofSizeConsistency || null
        });

        const reliabilityLabel = getReliabilityTierLabel(reliabilityTier);
        const reliabilityClass = getReliabilityTierClass(reliabilityTier);
        const reliabilityExplanation = getReliabilityTierExplanation(reliabilityTier);

        return `
          <div class="panel" style="margin:0 0 12px; padding:12px 14px; background:#f8fafc; border-color:#e5e7eb;">
            <p style="margin:0 0 6px;">
              <span class="confidence-badge ${reliabilityClass}">
                ${reliabilityLabel}
              </span>
            </p>

            <p class="small muted" style="margin:0 0 6px;">
              ${reliabilityExplanation}
            </p>

            <p class="small muted" style="margin:0;">
              <strong>Roof size source:</strong> ${roofSizeSource}
            </p>

            ${buildPropertyMetadataTrustHtml(analysis)}

            ${
              trustNote
                ? `<p class="small muted" style="margin:6px 0 0;">${trustNote}</p>`
                : ""
            }
          </div>
        `;
}

      // ============================================================
      // 1% UX — Modular Result Renderers
      // ============================================================

      function getVerdictCardClass(verdict) {
        const v = String(verdict || "").toLowerCase();
        if (v.includes("fair")) return "verdict-card--fair";
        if (v.includes("overpriced") || v.includes("possibly overpriced") || v.includes("may be overpriced")) return "verdict-card--overpriced";
        if (v.includes("higher") || v.includes("high")) return "verdict-card--high";
        if (v.includes("scope risk")) return "verdict-card--risk";
        if (v.includes("low")) return "verdict-card--low";
        return "verdict-card--unknown";
      }

      function getVerdictHeadline(verdict) {
        const v = String(verdict || "").toLowerCase();
        if (v.includes("fair")) return "This quote looks fair";
        if (v.includes("overpriced")) return "This quote looks overpriced";
        if (v.includes("higher")) return "This quote looks high";
        if (v.includes("scope risk")) return "This quote may be missing items";
        if (v.includes("low")) return "This price seems low — check what's included";
        return verdict || "Analysis complete";
      }

      function renderVerdictCard(a) {
        if (!a) return "";
        const meta = a?.meta || {};
        const pricingMeta = meta?.pricing || {};
        const confidenceMeta = meta?.confidence || {};
        const roofMeta = meta?.roofSize || {};

        const confidenceLabel = confidenceMeta?.overallTier || a?.confidenceLabel || "Low";
        const deltaFromMid = pricingMeta?.deltaFromMid ?? (a.quotePrice - a.mid);
        const deltaAbs = Math.abs(deltaFromMid);
        const city = a?.city || journeyState?.propertyPreview?.city || "";
        const state = a?.stateCode || journeyState?.propertyPreview?.state || "";
        const location = city && state ? `${city}, ${state}` : city || "your area";

        const roofSizeValue = roofMeta?.value ?? a?.roofSize ?? null;
        const roofSizeSource = roofMeta?.source || a?.roofSizeEstimateSource || "";
        const materialLabel = a.material && typeof getMaterialLabel === "function"
          ? getMaterialLabel(a.material).toLowerCase()
              .replace(/\s*shingles?$/i, "")
              .replace(/\s*roofing$/i, "")
          : "";
        const contractorName = latestParsed?.contractor && latestParsed.contractor !== "Not detected"
          ? latestParsed.contractor
          : "";

        // Build personalized delta text
        let deltaText = "";
        if (isFinite(deltaAbs) && deltaAbs >= 100) {
          const direction = deltaFromMid > 0 ? "above" : "below";
          const sizePart = roofSizeValue ? Number(roofSizeValue).toLocaleString() + " sq ft roof" : "";
          const matPart = materialLabel ? "using " + materialLabel + " shingles" : "";
          const locPart = location && location !== "your area" ? "in " + location : "";
          const suffix = [sizePart, matPart, locPart].filter(Boolean).join(" ");
          deltaText = "This quote is " + safeFormatCurrency(deltaAbs) + " " + direction + " expected" + (suffix ? " for a " + suffix : "");
        }

        return `
          <div class="verdict-card ${getVerdictCardClass(a.verdict)}">
            <div style="display:inline-block; padding:4px 12px; border-radius:999px; background:rgba(255,255,255,0.7); border:1px solid rgba(0,0,0,0.06); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); margin-bottom:12px;">
              Confidence: ${escapeHtml(confidenceLabel)}
            </div>

            <div class="verdict-headline">${getVerdictHeadline(a.verdict)}</div>

            ${deltaText ? `<div class="verdict-delta">${escapeHtml(deltaText)}</div>` : ""}

            <div class="verdict-range">
              <div class="verdict-range-item">
                <span class="verdict-range-label">Your quote</span>
                <span class="verdict-range-value verdict-range-value--quote">${safeFormatCurrency(a.quotePrice)}</span>
              </div>
              <div class="verdict-range-item">
                <span class="verdict-range-label">Expected low</span>
                <span class="verdict-range-value">${safeFormatCurrency(a.low)}</span>
              </div>
              <div class="verdict-range-item">
                <span class="verdict-range-label">Midpoint</span>
                <span class="verdict-range-value">${safeFormatCurrency(a.mid)}</span>
              </div>
              <div class="verdict-range-item">
                <span class="verdict-range-label">Expected high</span>
                <span class="verdict-range-value">${safeFormatCurrency(a.high)}</span>
              </div>
            </div>

            <div class="verdict-meta">
              ${roofSizeValue ? `Roof size: ${formatRoofSizeForDisplay(roofSizeValue, roofSizeSource, roofMeta?.confidence || "Low")}` : ""}
              ${a.material ? ` &middot; ${escapeHtml(typeof getMaterialLabel === "function" ? getMaterialLabel(a.material) : a.material)}` : ""}
            </div>
          </div>
        `;
      }

      function renderActionCard(a) {
        if (!a) return "";
        const recommendation = a?.recommendation || {};
        const action = String(recommendation.action || "").toUpperCase();
        const questions = buildContractorQuestions(a);

        let mode = "review";
        let eyebrow = "Recommended action";
        let title = "";
        let body = "";
        let questionsHtml = "";
        let buttonsHtml = "";

        if (action === "NEGOTIATE") {
          mode = "negotiate";
          title = "Push back on this price";
          body = questions.length > 0
            ? `Your quote is above expected. Send these ${questions.length} questions to your contractor:`
            : "Your quote is above expected. Request a line-by-line breakdown.";
        } else if (action === "PROCEED") {
          mode = "proceed";
          title = "This quote looks reasonable";
          body = "Before you sign, confirm these items in writing:";
        } else if (action === "REVIEW") {
          mode = "review";
          title = "Verify before deciding";
          body = "Key inputs need confirmation before trusting this result:";
        } else if (action === "AVOID") {
          mode = "avoid";
          title = "Get another quote before signing";
          const flagCount = Array.isArray(a.riskFlags) ? a.riskFlags.filter(f => f.severity === "high").length : 0;
          body = flagCount > 0
            ? `This quote has ${flagCount} high-severity risk flag${flagCount > 1 ? "s" : ""}. We recommend getting at least one competing bid.`
            : "This quote raises concerns. Get a competing bid before committing.";
        }

        if (questions.length > 0 && (action === "NEGOTIATE" || action === "REVIEW" || action === "AVOID")) {
          questionsHtml = `
            <ol class="action-questions">
              ${questions.slice(0, 4).map((q, i) => `<li><strong>Q${i + 1}</strong>${escapeHtml(q)}</li>`).join("")}
            </ol>
          `;
          buttonsHtml = `
            <div class="action-buttons">
              <button class="btn" onclick="copyContractorQuestions()">Copy these questions</button>
              <button class="btn secondary" onclick="showCompareScreen()">Upload another quote</button>
            </div>
          `;
        } else if (action === "PROCEED") {
          const checkItems = [];
          const parsed = latestParsed || {};
          const signals = parsed.signals || {};
          if (!signals.tearOff || signals.tearOff.status !== "included") checkItems.push("Confirm tear-off is included");
          if (!signals.flashing || signals.flashing.status !== "included") checkItems.push("Confirm flashing replacement is included");
          if (!signals.ventilation || signals.ventilation.status !== "included") checkItems.push("Confirm ventilation work is included");
          if (!parsed.warrantyYears) checkItems.push("Get warranty terms in writing");
          if (checkItems.length === 0) checkItems.push("Confirm scope and warranty in writing");

          questionsHtml = `
            <ol class="action-questions">
              ${checkItems.map((item, i) => `<li><strong>${i + 1}</strong>${escapeHtml(item)}</li>`).join("")}
            </ol>
          `;
          buttonsHtml = `
            <div class="action-buttons">
              <button class="btn" onclick="showShareScreen()">Share this result</button>
              <button class="btn secondary" onclick="showCompareScreen()">Compare another quote</button>
            </div>
          `;
        } else {
          buttonsHtml = `
            <div class="action-buttons">
              <button class="btn" onclick="showCompareScreen()">Upload another quote</button>
              <button class="btn secondary" onclick="showShareScreen()">Share this result</button>
            </div>
          `;
        }

        return `
          <div class="action-card action-card--${mode}">
            <div class="action-eyebrow">${escapeHtml(eyebrow)}</div>
            <div class="action-title">${escapeHtml(title)}</div>
            <div class="action-body">${escapeHtml(body)}</div>
            ${questionsHtml}
            ${buttonsHtml}
          </div>
        `;
      }

      function renderRiskFlagsModule(a) {
        if (!a) return "";
        const flags = Array.isArray(a.riskFlags) ? a.riskFlags : [];

        if (flags.length === 0 || (flags.length === 1 && flags[0].key === "no_major_risks")) {
          return `
            <div class="risk-flags-module">
              <div class="risk-flag risk-flag--none">
                <div class="risk-flag-title">No major risks detected</div>
                <div class="risk-flag-impact">Quote appears consistent with expected pricing and scope.</div>
              </div>
            </div>
          `;
        }

        return `
          <div class="risk-flags-module">
            <h3 style="margin:0 0 12px; font-size:16px;">Risk Flags</h3>
            ${flags.filter(f => f.key !== "no_major_risks").map(flag => `
              <div class="risk-flag risk-flag--${flag.severity || "low"}">
                <div class="risk-flag-title">
                  ${escapeHtml(flag.title)}
                  <span class="risk-flag-severity">${escapeHtml(String(flag.severity || "").toUpperCase())}</span>
                </div>
                <div class="risk-flag-impact">${escapeHtml(flag.impact || "")}</div>
                ${flag.action ? `<div class="risk-flag-action">${escapeHtml(flag.action)}</div>` : ""}
              </div>
            `).join("")}
          </div>
        `;
      }

      function renderScopeScorecard(a) {
        const parsed = latestParsed || {};
        const signals = parsed.signals || {};
        const premiumSignals = Array.isArray(parsed.premiumSignals) ? parsed.premiumSignals : [];

        // Weighted scope items grouped by importance
        const tiers = [
          {
            label: "Critical",
            color: "#991b1b",
            items: [
              { key: "tearOff", label: "Tear off", weight: 20, why: "Without tear off, problems hide under the new roof" },
              { key: "underlayment", label: "Underlayment", weight: 18, why: "The waterproofing layer — no underlayment means leaks" },
              { key: "flashing", label: "Flashing", weight: 18, why: "#1 cause of roof leaks at walls, pipes, and valleys" }
            ]
          },
          {
            label: "Important",
            color: "#92400e",
            items: [
              { key: "iceShield", label: "Ice & water shield", weight: 12, why: "Required by code in most areas for valleys and penetrations" },
              { key: "dripEdge", label: "Drip edge", weight: 10, why: "Required by code, prevents fascia rot and water intrusion" },
              { key: "ventilation", label: "Ventilation", weight: 10, why: "Poor ventilation cuts shingle lifespan 20-30%" },
              { key: "ridgeVent", label: "Ridge vent", weight: 8, why: "Primary ventilation system for most roofs" }
            ]
          },
          {
            label: "Standard",
            color: "#374151",
            items: [
              { key: "starterStrip", label: "Starter strip", weight: 4, why: "Affects wind resistance at roof edges" },
              { key: "ridgeCap", label: "Ridge cap", weight: 4, why: "Seals and finishes the ridge line" },
              { key: "decking", label: "Decking", weight: 4, why: "Repair allowance — not always needed" }
            ]
          }
        ];

        let totalWeight = 0;
        let earnedWeight = 0;
        let criticalMissing = [];

        function renderItem(item) {
          const signal = signals[item.key];
          const status = signal?.status || "unclear";
          totalWeight += item.weight;

          if (status === "included") {
            earnedWeight += item.weight;
            return `<div class="scope-item scope-item--included"><span class="scope-item-icon">&#10003;</span>${escapeHtml(item.label)}</div>`;
          }
          if (status === "excluded") {
            if (item.weight >= 15) criticalMissing.push(item);
            return `<div class="scope-item scope-item--missing"><span class="scope-item-icon">&#10007;</span>${escapeHtml(item.label)}</div>`;
          }
          // unclear
          if (item.weight >= 15) criticalMissing.push(item);
          return `<div class="scope-item scope-item--unclear"><span class="scope-item-icon">?</span>${escapeHtml(item.label)}</div>`;
        }

        const tiersHtml = tiers.map(tier => {
          const itemsHtml = tier.items.map(renderItem).join("");
          return `
            <div style="margin-bottom:16px;">
              <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:${tier.color}; margin-bottom:8px;">${tier.label}</div>
              <div class="scope-grid">${itemsHtml}</div>
            </div>
          `;
        }).join("");

        const scorePct = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
        const badgeClass = scorePct >= 75 ? "scope-score-badge--good" : scorePct >= 45 ? "scope-score-badge--warn" : "scope-score-badge--bad";
        const scoreLabel = scorePct >= 75 ? "Strong" : scorePct >= 45 ? "Gaps found" : "Weak";

        let warningHtml = "";
        if (criticalMissing.length > 0) {
          warningHtml = `
            <div style="margin-top:14px; padding:12px 16px; background:var(--bad-bg, #fef2f2); border:1px solid var(--bad-line, #fecaca); border-radius:8px;">
              <div style="font-size:14px; font-weight:700; color:#991b1b; margin-bottom:6px;">
                ${criticalMissing.length === 1 ? "1 critical item" : criticalMissing.length + " critical items"} not confirmed
              </div>
              ${criticalMissing.map(item => `
                <div style="font-size:13px; color:#374151; margin-bottom:4px;">
                  <strong>${escapeHtml(item.label)}</strong> &mdash; ${escapeHtml(item.why)}
                </div>
              `).join("")}
            </div>
          `;
        }

        const premiumHtml = premiumSignals.length > 0
          ? `<div class="scope-premium">Premium signals: ${premiumSignals.map(s => escapeHtml(s)).join(", ")}</div>`
          : "";

        return `
          <div class="scope-scorecard">
            <div class="scope-header">
              <h3>Scope Check</h3>
              <span class="scope-score-badge ${badgeClass}">${scoreLabel} (${scorePct}%)</span>
            </div>
            ${tiersHtml}
            ${warningHtml}
            ${premiumHtml}
          </div>
        `;
      }

      // Scope review state — tracks user corrections
      const scopeReviewState = {};

      function renderBeforeYouSign(a) {
        if (!a) return "";
        const parsed = latestParsed || {};
        const signals = parsed.signals || {};

        const scopeItems = [
          { key: "tearOff", label: "Tear off", why: "Removes old roof to inspect decking" },
          { key: "underlayment", label: "Underlayment", why: "Waterproofing layer under shingles" },
          { key: "flashing", label: "Flashing", why: "#1 source of roof leaks" },
          { key: "iceShield", label: "Ice & water shield", why: "Code-required in valleys" },
          { key: "dripEdge", label: "Drip edge", why: "Protects fascia from water" },
          { key: "ventilation", label: "Ventilation", why: "Extends shingle lifespan" },
          { key: "ridgeVent", label: "Ridge vent", why: "Primary roof ventilation" },
          { key: "starterStrip", label: "Starter strip", why: "Wind resistance at edges" },
          { key: "ridgeCap", label: "Ridge cap", why: "Seals the ridge line" },
          { key: "decking", label: "Decking", why: "Repair allowance if needed" }
        ];

        // Initialize review state from OCR signals (only once)
        scopeItems.forEach(item => {
          if (!(item.key in scopeReviewState)) {
            scopeReviewState[item.key] = signals[item.key]?.status === "included";
          }
        });

        const confirmed = scopeItems.filter(i => scopeReviewState[i.key]);
        const unconfirmed = scopeItems.filter(i => !scopeReviewState[i.key]);

        // Confirmed items as green pills
        const confirmedHtml = confirmed.length > 0
          ? confirmed.map(item =>
              `<button onclick="toggleScopeItem('${item.key}')" style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:999px; font-size:13px; color:#166534; font-weight:500; cursor:pointer; transition:all 0.15s;" title="Click to mark as not included">&#10003; ${escapeHtml(item.label)}</button>`
            ).join(" ")
          : "";

        // Unconfirmed items as amber toggles
        const unconfirmedHtml = unconfirmed.length > 0
          ? unconfirmed.map(item =>
              `<button onclick="toggleScopeItem('${item.key}')" style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:#fffbeb; border:1px solid #fde68a; border-radius:999px; font-size:13px; color:#92400e; font-weight:500; cursor:pointer; transition:all 0.15s;" title="Click if this IS in your quote">? ${escapeHtml(item.label)}</button>`
            ).join(" ")
          : "";

        // Context line
        let contextLine = "";
        const pricingMeta = a?.meta?.pricing || {};
        const deltaFromMid = pricingMeta?.deltaFromMid ?? (a.quotePrice - a.mid);
        if (deltaFromMid < -500 && unconfirmed.length > 0) {
          contextLine = `<div style="font-size:13px; color:#92400e; padding:8px 12px; background:rgba(217,119,6,0.06); border-radius:6px; margin-top:14px;">Your quote is below expected. Low bids often exclude items above.</div>`;
        }

        // Email button with count
        const contractorName = parsed.contractor && parsed.contractor !== "Not detected" ? parsed.contractor : "contractor";
        const emailCount = unconfirmed.length;

        return `
          <div id="scopeReviewCard" style="padding:24px; border:1px solid ${unconfirmed.length === 0 ? "#a7f3d0" : unconfirmed.length <= 3 ? "#fde68a" : "#fecaca"}; border-radius:14px; margin-bottom:16px; background:#fff;">
            <div style="font-size:18px; font-weight:700; margin-bottom:6px;">What we found in your quote</div>
            <div style="font-size:13px; color:var(--muted); margin-bottom:14px;">Tap any item to correct it</div>

            ${confirmedHtml ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">${confirmedHtml}</div>` : ""}

            ${unconfirmedHtml ? `
              <div style="font-size:13px; font-weight:600; color:#92400e; margin-bottom:8px;">Not found — tap if included in your quote:</div>
              <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:4px;">${unconfirmedHtml}</div>
            ` : `
              <div style="padding:10px; text-align:center; color:#166534; font-weight:600; background:#ecfdf5; border-radius:8px; margin-top:8px;">All items confirmed. Quote looks complete.</div>
            `}

            ${contextLine}

            <div class="action-buttons" style="margin-top:16px;">
              ${emailCount > 0
                ? `<button class="btn" id="emailContractorBtn" onclick="emailContractorQuestions()">Email ${escapeHtml(contractorName)} about ${emailCount} item${emailCount !== 1 ? "s" : ""}</button>`
                : `<button class="btn" onclick="showShareScreen()">Share this result</button>`
              }
              <button class="btn secondary" onclick="showCompareScreen()">Upload another quote</button>
            </div>
          </div>
        `;
      }

      window.toggleScopeItem = function toggleScopeItem(key) {
        scopeReviewState[key] = !scopeReviewState[key];
        // Re-render the scope card
        const a = window.__latestAnalysis;
        if (!a) return;
        const card = document.getElementById("scopeReviewCard");
        if (card) {
          const temp = document.createElement("div");
          temp.innerHTML = renderBeforeYouSign(a);
          const newCard = temp.firstElementChild;
          if (newCard) card.replaceWith(newCard);
        }
      };

      window.emailContractorQuestions = function emailContractorQuestions() {
        const a = window.__latestAnalysis || {};
        const parsed = latestParsed || {};
        const contractorName = parsed.contractor && parsed.contractor !== "Not detected" ? parsed.contractor : "your team";
        const quotePrice = a.quotePrice ? safeFormatCurrency(a.quotePrice) : "my estimate";

        const scopeItems = [
          { key: "tearOff", label: "Tear off (removal of existing roof)" },
          { key: "underlayment", label: "Underlayment (waterproofing layer)" },
          { key: "flashing", label: "Flashing replacement (walls, pipes, valleys)" },
          { key: "iceShield", label: "Ice and water shield" },
          { key: "dripEdge", label: "Drip edge" },
          { key: "ventilation", label: "Ventilation" },
          { key: "ridgeVent", label: "Ridge vent" },
          { key: "starterStrip", label: "Starter strip" },
          { key: "ridgeCap", label: "Ridge cap" },
          { key: "decking", label: "Decking repair allowance" }
        ];

        const missing = scopeItems.filter(i => !scopeReviewState[i.key]);
        if (missing.length === 0) return;

        const itemList = missing.map(i => "- " + i.label).join("\n");

        const subject = encodeURIComponent("Questions about my roofing estimate (" + (a.quotePrice ? "$" + Number(a.quotePrice).toLocaleString() : "") + ")");
        const body = encodeURIComponent(
          "Hi " + contractorName + ",\n\n" +
          "Before I move forward with the " + quotePrice + " estimate, can you confirm whether the following items are included?\n\n" +
          itemList + "\n\n" +
          "If any of these are not included, can you let me know what the additional cost would be?\n\n" +
          "Also, can you provide the warranty terms in writing?\n\n" +
          "Thank you"
        );

        window.open("mailto:?subject=" + subject + "&body=" + body, "_self");
      };

      window.copyBeforeYouSignChecklist = function copyBeforeYouSignChecklist() {
        const scopeItems = [
          { key: "tearOff", label: "Tear off" },
          { key: "underlayment", label: "Underlayment" },
          { key: "flashing", label: "Flashing" },
          { key: "iceShield", label: "Ice & water shield" },
          { key: "dripEdge", label: "Drip edge" },
          { key: "ventilation", label: "Ventilation" },
          { key: "ridgeVent", label: "Ridge vent" },
          { key: "starterStrip", label: "Starter strip" },
          { key: "ridgeCap", label: "Ridge cap" },
          { key: "decking", label: "Decking" }
        ];

        const missing = scopeItems.filter(i => !scopeReviewState[i.key]);
        const text = "Items to confirm with contractor:\n" + missing.map((t, i) => (i + 1) + ". " + t.label).join("\n");

        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => alert("Copied.")).catch(() => prompt("Copy:", text));
        } else {
          prompt("Copy:", text);
        }
      };

      function renderMarketContext(a) {
        if (!a) return "";
        const city = a?.city || "";
        const state = a?.stateCode || "";
        const location = city && state ? `${escapeHtml(city)}, ${escapeHtml(state)}` : "your area";
        const roofMeta = a?.meta?.roofSize || {};
        const roofSizeValue = roofMeta?.value ?? a?.roofSize ?? null;
        const roofSizeSource = roofMeta?.source || a?.roofSizeEstimateSource || "";
        const ppsf = a.roofSize > 0 ? (a.quotePrice / a.roofSize).toFixed(2) : null;

        return `
          <div class="market-panel">
            <h3>Market Context — ${location}</h3>
            <table class="market-table">
              <tr><td>Your quote</td><td>${safeFormatCurrency(a.quotePrice)}${ppsf ? ` ($${ppsf}/sqft)` : ""}</td></tr>
              <tr><td>Expected midpoint</td><td>${safeFormatCurrency(a.mid)}</td></tr>
              <tr><td>Expected range</td><td>${safeFormatCurrency(a.low)} &ndash; ${safeFormatCurrency(a.high)}</td></tr>
              <tr><td>Material</td><td>${escapeHtml(typeof getMaterialLabel === "function" ? getMaterialLabel(a.material) : a.material || "Unknown")}</td></tr>
              <tr><td>Roof size</td><td>${roofSizeValue ? formatRoofSizeForDisplay(roofSizeValue, roofSizeSource, roofMeta?.confidence || "Low") : "Unknown"}</td></tr>
              ${a.warrantyYears ? `<tr><td>Warranty</td><td>${escapeHtml(String(a.warrantyYears))} years</td></tr>` : ""}
              ${roofSizeSource ? `<tr><td>Size source</td><td>${escapeHtml(roofSizeSource.replaceAll("_", " "))}</td></tr>` : ""}
            </table>
          </div>
        `;
      }

      function renderShareModule(a) {
        return `
          <div class="share-module">
            <div style="font-size:16px; font-weight:600; margin-bottom:12px;">Save or share this result</div>
            <div class="action-buttons">
              <button class="btn secondary" onclick="copyShareableReportText()">Copy result</button>
              <button class="btn secondary" onclick="showShareScreen()">View full report</button>
              <a class="btn secondary" href="/roofing-quote-analyzer.html" style="text-decoration:none;">Start over</a>
            </div>
          </div>
        `;
      }

      // ============================================================
      // End 1% UX modules
      // ============================================================

      function renderMainAnalysisResult(a) {
        if (!a) return "";
        const meta = a?.meta || {};
        const roofMeta = meta?.roofSize || {};
        const pricingMeta = meta?.pricing || {};
        const confidenceMeta = meta?.confidence || {};

        const confidenceLabel = confidenceMeta?.overallTier || a?.confidenceLabel || "Low";
        const confidenceScore = confidenceMeta?.overallScore ?? a?.confidenceScore ?? 0;

        const deltaFromMid = pricingMeta?.deltaFromMid ?? (a.quotePrice - a.mid);
        const deltaAbs = Math.abs(deltaFromMid);
        const deltaDirection = deltaFromMid > 0 ? "above" : "below";

        const deltaText =
          isFinite(deltaAbs) && deltaAbs > 0
            ? `You are ${formatCurrency(deltaAbs)} ${deltaDirection} expected`
            : "";
        
            
        const roofSizeValue = roofMeta?.value ?? a?.roofSize ?? null;
        const roofSizeSource = roofMeta?.source || a?.roofSizeEstimateSource || "";
        const roofSizeConfidence = roofMeta?.confidence || a?.roofSizeEstimateConfidence || "Low";
        const roofSizeEstimated =
          typeof roofMeta?.estimated === "boolean"
            ? roofMeta.estimated
            : ["living_area_fallback", "price_based_estimate", "address_estimated"].includes(
                String(roofSizeSource).toLowerCase()
              );

        const verdictClass = getVerdictClassName(a?.verdict);

        const decisionDeltaHtml =
          String(a?.verdict || "").toLowerCase().includes("fair")
            ? ""
            : (
                typeof buildDecisionDeltaHtml === "function"
                  ? buildDecisionDeltaHtml(a)
                  : ""
              );

        const recommendation = a?.recommendation || {};
        const action = String(recommendation.action || "").toUpperCase();

        let primaryCta = "";
        let secondaryCta = "";

        if (action === "NEGOTIATE") {
          primaryCta = `<button class="btn" onclick="showNegotiateScreen()">Negotiate this quote</button>`;
          secondaryCta = `<button class="btn secondary" onclick="showCompareScreen()">Compare another quote</button>`;
        } else if (action === "AVOID") {
          primaryCta = `<button class="btn" onclick="showCompareScreen()">Compare another quote</button>`;
          secondaryCta = `<button class="btn secondary" onclick="showNegotiateScreen()">Ask contractor questions</button>`;
        } else if (action === "PROCEED") {
          primaryCta = `<button class="btn" onclick="showCompareScreen()">Compare another quote</button>`;
          secondaryCta = `<button class="btn secondary" onclick="showShareScreen()">Share this result</button>`;
        } else {
          primaryCta = `<button class="btn" onclick="showNegotiateScreen()">Review this quote</button>`;
          secondaryCta = `<button class="btn secondary" onclick="showCompareScreen()">Compare another quote</button>`;
        }

        return `
          <div style="max-width:640px; margin:40px auto;">

            <div class="verdict ${verdictClass}" style="font-size:44px; font-weight:800; margin:0 0 6px;">
              ${a.verdict === "Overpriced"
              ? "This quote looks overpriced"
              : a.verdict === "Higher Than Expected"
                ? "This quote looks high"
                : a.verdict === "Fair Price"
                  ? "This quote looks fair"
                  : a.verdict === "Unusually Low"
                    ? "This quote looks unusually low"
                    : a.verdict}
                        </div>

            <div style="margin:0 0 10px;">
              <span class="pill" style="
                background:#f1f5f9;
                color:#0f172a;
                font-weight:600;
              ">
                Confidence: ${escapeHtml(confidenceLabel)}
              </span>
            </div>

            ${
              deltaText
                ? `
                  <div style="margin:0 0 14px; font-size:18px; font-weight:600;">
                    ${deltaText}
                  </div>
                `
                : ""
            }
            
            <div class="small muted" style="margin:0 0 14px; font-size:13px;">
              ${
                [
                  roofMeta?.source ? `Roof size derived from ${roofMeta.source.replaceAll("_", " ")}` : null,
                  roofMeta?.consistency?.status === "aligned"
                    ? "Multiple signals agree on roof size"
                    : roofMeta?.consistency?.hasConflict
                      ? "Some data signals conflict - review recommended"
                      : null
                ]
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(x => `• ${escapeHtml(x)}`)
                  .join("<br>")
              }
            </div>

            <p class="small muted" style="margin:0 0 6px; font-size:14px;">
              ${buildLocalizedVerdictExplanation(a)}
            </p>

            <div class="small muted" style="margin:0 0 8px; font-size:14px;">
              ${buildRangeLine(a)}
            </div>

            <div class="small muted" style="margin:0 0 20px; font-size:14px;">
            Roof size used: ${formatRoofSizeForDisplay(
              roofSizeValue,
              roofSizeSource,
              roofSizeConfidence
            )}
            ${
              String(roofSizeSource).toLowerCase() === "living_area_fallback"
                ? " · Estimated from home size — you can edit if needed."
                : String(roofSizeSource).toLowerCase() === "price_based_estimate"
                  ? " · Estimated from pricing only — verify for accuracy."
                  : roofSizeEstimated
                    ? " · Estimated value."
                    : ""
            }
          </div>

            ${
              String(a?.verdict || "").toLowerCase().includes("fair")
                ? ""
                : `
                  <div style="margin:0 0 24px;">
                    ${decisionDeltaHtml}
                  </div>
                `
            }

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin:0 0 20px;">
              ${primaryCta}
              ${secondaryCta}
            </div>

            <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:14px;">
              <a href="#" onclick="showDetailsScreen(); return false;" class="muted">See how we analyzed this</a>
              <a href="#" onclick="showShareScreen(); return false;" class="muted">Share this result</a>
            </div>

          </div>
        `;
      }

      function buildLocalizedVerdictExplanation(a) {
        const city =
          a?.city ||
          journeyState?.propertyPreview?.city ||
          "";

        const verdict = String(a?.verdict || "").toLowerCase();

        if (!city) {
          return `This quote is in line with typical pricing.`;
        }

        if (verdict.includes("fair")) {
          return `In the ${city} area, this quote is right in line with typical pricing.`;
        }

        if (verdict.includes("higher") || verdict.includes("over")) {
          return `In the ${city} area, this quote appears higher than typical pricing.`;
        }

        if (verdict.includes("low") || verdict.includes("below")) {
          return `In the ${city} area, this quote appears lower than typical pricing.`;
        }

        return `In the ${city} area, this quote reflects typical pricing conditions.`;
      }

      function buildRangeLine(a) {
        const low = safeFormatCurrency(Math.round(a?.low || 0));
        const high = safeFormatCurrency(Math.round(a?.high || 0));

        return `Typical range: ${low} – ${high}`;
      }

      function copyParsedToForm() {
        clearManualFieldHighlights();

        if (!latestParsed) {
          setUploadStatus("No parsed quote data is available yet.", "warn");
          return;
        }

        const cityName = byId("cityName");
        const stateCode = byId("stateCode");
        const roofSize = byId("roofSize");
        const quotePrice = byId("quotePrice");
        const materialType = byId("materialType");
        const warrantyYears = byId("warrantyYears");
        const tearOffIncluded = byId("tearOffIncluded");

        if (shouldPromoteAddress(latestParsed)) {
        if (cityName && !cityName.value) cityName.value = latestParsed.city || latestParsed.address?.city || "";
        if (stateCode && !stateCode.value) stateCode.value = latestParsed.stateCode || latestParsed.address?.stateCode || "";
      }
        if (roofSize) roofSize.value = latestParsed.roofSize || "";
        if (quotePrice) {
          quotePrice.value =
            latestParsed.finalBestPrice ||
            latestParsed.totalLinePrice ||
            latestParsed.price ||
            "";
        }
        if (materialType) {
          materialType.value = normalizeMaterialForForm(latestParsed.material, latestParsed.materialLabel);
        }
        if (warrantyYears) warrantyYears.value = latestParsed.warrantyYears || "";
        if (tearOffIncluded) tearOffIncluded.value = normalizeTearOffForUi(latestParsed);
      }

      async function analyzeParsedText(parsedText, extractionMethod) {
          latestExtractedText = String(parsedText || "");
          setSmartUploadStatus("identify", 68);

          if (typeof parseExtractedText !== "function") {
            throw new Error("parseExtractedText is not available.");
          }

          const parsed = parseExtractedText(latestExtractedText, {
            extractionMethod: extractionMethod || "image_ocr"
          });

          latestParsed = parsed;

          copyParsedToForm();

          // ---- PROMOTE PARSED ADDRESS INTO JOURNEY STATE ----
          if (parsed?.address) {
            const addr = parsed.address;

            const hasAddress =
              addr.street && (addr.city || addr.zip) && addr.stateCode;

            if (hasAddress) {
              journeyState.propertyPreview = {
                street: addr.street || "",
                apt: "",
                city: addr.city || "",
                state: addr.stateCode || "",
                zip: addr.zip || ""
              };

              journeyState.propertyConfirmed = true;
            }
          }

                // ---------- ADDRESS ROUTING LOGIC ----------

          const parsedAddress = {
            street: parsed?.address?.street || "",
            city: parsed?.city || parsed?.address?.city || "",
            state: parsed?.stateCode || parsed?.address?.stateCode || "",
            zip: parsed?.address?.zip || ""
          };

          const hasStrongAddress =
            parsedAddress.street &&
            parsedAddress.city &&
            parsedAddress.state &&
            String(parsedAddress.state).length === 2;

          // Save for downstream steps
          journeyState.propertyPreview = {
            street: parsedAddress.street,
            apt: "",
            city: parsedAddress.city,
            state: parsedAddress.state,
            zip: parsedAddress.zip
          };

          if (hasStrongAddress) {
            // Skip address step → go straight to confirm
            setJourneyStep("confirm");
            return;
          } else {
            // Missing/weak address → ask user
            setJourneyStep("address");
            return;
          }

          if (typeof getSmartQuoteData === "function") {
            try {
              latestSmartQuote = await getSmartQuoteData(latestExtractedText);
            } catch {
              latestSmartQuote = null;
            }
          }

          setSmartUploadStatus("done", 100);
        }

    function renderAnalysisResultUi(analysis, parsed) {
      const resultContainer = byId("analysisOutput");
      const aiOutput = byId("aiAnalysisOutput");

      if (!resultContainer || !aiOutput || !analysis) return;

      resultContainer.innerHTML = renderMainAnalysisResult(analysis);

      aiOutput.innerHTML = `
        <div class="panel" style="margin-top:18px;">
          <button 
            type="button" 
            class="btn btn-ghost" 
            id="toggleAiExplanationBtn"
            style="width:100%; text-align:left;"
          >
            See how this was calculated
          </button>

          <div id="aiExplanationContent" style="display:none; margin-top:12px;">
            <p class="small muted" style="margin:0;">
              ${buildAIExplanation(analysis)}
            </p>
          </div>
        </div>
      `;

      renderAnalysisPanels(parsed || {});
      bindRenderedAnalysisUi();

      const aiToggleBtn = byId("toggleAiExplanationBtn");
      const aiContent = byId("aiExplanationContent");

      if (aiToggleBtn && aiContent && aiToggleBtn.dataset.bound !== "true") {
        aiToggleBtn.addEventListener("click", () => {
          const isOpen = aiContent.style.display === "block";
          aiContent.style.display = isOpen ? "none" : "block";
          aiToggleBtn.innerText = isOpen
            ? "See how this was calculated"
            : "Hide explanation";
        });

        aiToggleBtn.dataset.bound = "true";
      }
    }

    function buildRoofSizeConsistencySummary(signals = {}) {
      const parsed = normalizeRoofSizeValue(signals?.parsed);
      const property = normalizeRoofSizeValue(signals?.property);
      const priceImplied = normalizeRoofSizeValue(signals?.priceImplied);

      const values = [
        { key: "parsed", value: parsed, label: "Quote" },
        { key: "property", value: property, label: "Property" },
        { key: "priceImplied", value: priceImplied, label: "Price model" }
      ].filter(item => item.value && item.value > 0);

      if (!values.length) {
        return {
          hasConflict: false,
          severity: "none",
          status: "unavailable",
          summary: "No roof size signals were available.",
          details: []
        };
      }

      if (values.length === 1) {
        return {
          hasConflict: false,
          severity: "none",
          status: "single_signal",
          summary: `${values[0].label} was the only roof size signal available.`,
          details: values
        };
      }

      const numericValues = values.map(v => v.value);
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const spreadPct = min > 0 ? (max - min) / min : 0;

      if (spreadPct <= 0.12) {
        return {
          hasConflict: false,
          severity: "low",
          status: "aligned",
          summary: "Roof size signals are generally aligned.",
          details: values
        };
      }

      if (spreadPct <= 0.25) {
        return {
          hasConflict: true,
          severity: "medium",
          status: "mixed",
          summary: "Roof size signals are directionally similar but not fully aligned.",
          details: values
        };
      }

      return {
        hasConflict: true,
        severity: "high",
        status: "conflicting",
        summary: "Roof size signals conflict materially and should be reviewed.",
        details: values
      };
    }

    function shouldShowRoofSizeSuggestion(analysis) {
      const roofMeta = analysis?.meta?.roofSize || null;
      const value = roofMeta?.value ?? analysis?.roofSizeEstimate ?? analysis?.roofSize ?? null;
      const source = String(roofMeta?.source || analysis?.roofSizeEstimateSource || "").toLowerCase();
      const estimated = roofMeta?.estimated ?? (
        source === "living_area_fallback" ||
        source === "price_based_estimate" ||
        source === "address_estimated"
      );

      return !!(value && estimated);
    }

    function buildNormalizedAnalysisMeta({
      effectiveRoofSize,
      effectiveRoofSizeSource,
      effectiveRoofSizeConfidence,
      effectiveRoofSizeConfidenceScore,
      roofSizeEstimate,
      roofSizeSignals,
      roofSizeConsistency,
      quotePrice,
      low,
      mid,
      high,
      derivedAnalysisConfidenceLabel,
      derivedConfidenceScore,
      reliabilityTier
    }) {
      const normalizedSource = String(effectiveRoofSizeSource || "unavailable").toLowerCase();

      const estimated =
        normalizedSource !== "user_input" &&
        normalizedSource !== "manual_calculator" &&
        normalizedSource !== "parsed_quote";

      const benchmarkLow = Number(low || 0);
      const benchmarkMid = Number(mid || 0);
      const benchmarkHigh = Number(high || 0);
      const quote = Number(quotePrice || 0);
      const deltaFromMid = quote - benchmarkMid;
      const deltaFromLow = quote - benchmarkLow;
      const deltaPctFromMid =
        benchmarkMid > 0 ? Number((((quote - benchmarkMid) / benchmarkMid) * 100).toFixed(1)) : null;

      return {
        roofSize: {
          value: normalizeRoofSizeValue(effectiveRoofSize),
          source: normalizedSource,
          confidence: effectiveRoofSizeConfidence || "Low",
          confidenceScore: Number(effectiveRoofSizeConfidenceScore || 0),
          estimated,
          reasoning: String(roofSizeEstimate?.reasoning || ""),
          signals: {
            userInput: normalizedSource === "user_input" || normalizedSource === "manual_calculator"
              ? normalizeRoofSizeValue(effectiveRoofSize)
              : null,
            parsed: normalizeRoofSizeValue(roofSizeSignals?.parsed),
            property: normalizeRoofSizeValue(roofSizeSignals?.property),
            priceImplied: normalizeRoofSizeValue(roofSizeSignals?.priceImplied)
          },
          consistency: {
            status: roofSizeConsistency?.status || "unavailable",
            severity: roofSizeConsistency?.severity || "none",
            hasConflict: !!roofSizeConsistency?.hasConflict,
            summary: roofSizeConsistency?.summary || "",
            details: Array.isArray(roofSizeConsistency?.details) ? roofSizeConsistency.details : []
          }
        },

        pricing: {
          quotePrice: quote,
          benchmarkLow,
          benchmarkMid,
          benchmarkHigh,
          deltaFromMid,
          deltaFromLow,
          deltaPctFromMid
        },

        confidence: {
          overallTier: reliabilityTier?.label || derivedAnalysisConfidenceLabel || "Low",
          overallScore: Number(derivedConfidenceScore || 0),
          reasons: Array.isArray(roofSizeEstimate?.reasons)
            ? roofSizeEstimate.reasons
            : []
        }
      };
    }

    async function analyzeQuote() {
        console.log("ANALYZE QUOTE STARTED");

        const analyzingEl = document.getElementById("inlineAnalyzingState");
        if (analyzingEl) analyzingEl.innerHTML = "";
        console.log("analyzeQuote entered successfully");
        console.log("current journey step at analyzeQuote start:", journeyState.step)
        track("analysis_started");

        const city = (byId("cityName")?.value || "").trim();
        const stateCode = (byId("stateCode")?.value || "").trim().toUpperCase();
        const streetAddress = (byId("streetAddress")?.value || "").trim();
        const zipCode = (byId("zipCode")?.value || "").trim();
        const roofSize = Number(byId("roofSize")?.value || 0);
        const quotePrice = Number(byId("quotePrice")?.value || 0);
        const material = byId("materialType")?.value || "architectural";
        const complexityFactor = Number(byId("complexityFactor")?.value || 1.0);
        const tearOffFactor = Number(byId("tearOffIncluded")?.value || 1.0);
        const warrantyYears = Number(byId("warrantyYears")?.value || 0);

        const resultContainer = byId("analysisOutput");
        const aiOutput = byId("aiAnalysisOutput");

        if (!resultContainer || !aiOutput) return;

        const roofSizeEstimate =
          typeof estimateRoofSize === "function"
            ? await estimateRoofSize({
                address: {
                  street: streetAddress,
                  city,
                  stateCode,
                  zip: zipCode,
                  fullAddress: [streetAddress, city, stateCode, zipCode].filter(Boolean).join(", ")
                },
                parsed: latestParsed || {},
                userInput: {
                  roofSize,
                  quotePrice,
                  material,
                  complexityFactor,
                  tearOffFactor
                }
              })
            : {
                roofSize: roofSize || null,
                confidence: roofSize ? "High" : "Low",
                confidenceScore: roofSize ? 95 : 20,
                source: roofSize ? "user_input" : "unavailable",
                reasoning: roofSize
                  ? `Using user provided roof size of ${safeFormatNumber(roofSize)} sq ft.`
                  : "No reliable roof size was available.",
                meta: {
                  fallbackUsed: true
                }
              };

        const roofSizeInput = byId("roofSize");
        const enteredRoofSize = Number(roofSizeInput?.value || 0);
        const roofSizeInputSource = roofSizeInput?.dataset?.source || "";
        const roofSizeInputConfidence = roofSizeInput?.dataset?.confidence || "";
        const userEnteredRoofSize =
          isFinite(enteredRoofSize) && enteredRoofSize > 0 ? enteredRoofSize : null;

        const effectiveRoofSize =
          userEnteredRoofSize && userEnteredRoofSize > 0
            ? userEnteredRoofSize
            : (roofSizeEstimate?.roofSize || 0);

        console.log("CHECK INPUTS:", { effectiveRoofSize, quotePrice });
        if (!effectiveRoofSize || !quotePrice) {
          console.log("analyzeQuote blocked: missing effectiveRoofSize or quotePrice", {
            effectiveRoofSize,
            quotePrice
          });

          const parsed = latestParsed || {};
          const missingFieldIds = getMissingManualFields(parsed);
          const manualEntryPromptHtml = buildManualEntryPromptHtml(parsed);

          track("analysis_blocked_missing_fields", {
            hasQuotePrice: !!quotePrice,
            hasEffectiveRoofSize: !!effectiveRoofSize,
            parsedPrice: Number(parsed?.price || 0) > 0,
            parsedRoofSize: Number(parsed?.roofSize || 0) > 0,
            missingFields: missingFieldIds
          });

          clearManualFieldHighlights();
          highlightManualFields(missingFieldIds, {
            isJump: false,
            primaryId: missingFieldIds.includes("roofSize") ? "roofSize" : missingFieldIds[0]
          });

          const detectedPriceText =
            isFinite(Number(parsed?.price)) && Number(parsed.price) > 0
              ? `We detected a quote price of ${safeFormatCurrency(parsed.price)}, but cannot finish the analysis yet.`
              : `We could not confidently detect the full quote price yet.`;

          resultContainer.innerHTML = `
            ${manualEntryPromptHtml}
            <div class="panel" style="background:#fff7ed;border-color:#fdba74;">
              <h4>We found the quote price. Finish the missing details.</h4>
              <p style="margin:0 0 8px;">
                ${detectedPriceText}
              </p>
              <p style="margin:0 0 12px;">
                Add the highlighted fields below, then click Analyze Quote again to finish your pricing result.
              </p>
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="btn" id="jumpToMissingFieldsBtn">Jump to missing fields</button>
              </div>
            </div>
          `;

          const jumpBtn = byId("jumpToMissingFieldsBtn");
          if (jumpBtn) {
            jumpBtn.addEventListener("click", () => {
              jumpToMissingManualFields(parsed);
            });
          }

          aiOutput.innerHTML = "We need a few more quote details before generating the full assessment.";
          return;
        }

        const benchmarkMap = {
          architectural: 5.10,
          asphalt: 4.60,
          metal: 10.50,
          tile: 13.75
        };

        let benchmarkPerSqFt =
          typeof getMaterialBenchmarkPerSqFt === "function"
            ? getMaterialBenchmarkPerSqFt(material)
            : benchmarkMap[material] || 5.10;

        let localDataUsed = false;
        let sizeLabelUsed = "";

        if (typeof findCityPricing === "function" && city && stateCode) {
          const cityPricing = findCityPricing(city, stateCode);
          if (cityPricing) {
            localDataUsed = true;

            if (typeof getNearestSizeLabel === "function") {
              sizeLabelUsed = getNearestSizeLabel(cityPricing, effectiveRoofSize);
              const bucket = cityPricing?.sizes?.[sizeLabelUsed];

              const normalizedMaterial =
                String(material || "").toLowerCase().includes("architectural")
                  ? "architectural"
                  : String(material || "").toLowerCase().includes("asphalt")
                    ? "asphalt"
                    : String(material || "").toLowerCase().includes("metal")
                      ? "metal"
                      : String(material || "").toLowerCase().includes("tile")
                        ? "tile"
                        : "architectural";

              if (bucket && bucket[normalizedMaterial]?.mid) {
                benchmarkPerSqFt =
                  Number(bucket[normalizedMaterial].mid) /
                    Number(String(sizeLabelUsed).replace(/[^\d]/g, "")) || benchmarkPerSqFt;
              }
            }
          }
        }

        const adjustedBenchmark = benchmarkPerSqFt * complexityFactor * tearOffFactor;
        const mid = adjustedBenchmark * effectiveRoofSize;
        const low = mid * 0.9;
        const high = mid * 1.12;

        const pricePerSqFt = quotePrice / effectiveRoofSize;
        const pricePerSquare = pricePerSqFt * 100;
        const diff = quotePrice - mid;
        const diffPct = (diff / mid) * 100;

        let verdict = "Fair Price";

        if (quotePrice < low * 0.78) {
          verdict = "Possible Scope Risk";
        } else if (quotePrice < low) {
          verdict = "Unusually Low";
        } else if (quotePrice <= high) {
          verdict = "Fair Price";
        } else if (quotePrice <= high * 1.12) {
          verdict = "Higher Than Expected";
        } else {
          verdict = "Overpriced";
        }

        const roofSizeSignals = {
          userInput: userEnteredRoofSize || null,
          parsed:
            normalizeRoofSizeValue(
              roofSizeEstimate?.meta?.roofSizeSignals?.parsed ||
              latestParsed?.roofSize ||
              null
            ),
          property:
            normalizeRoofSizeValue(
              roofSizeEstimate?.meta?.roofSizeSignals?.property ||
              roofSizeEstimate?.meta?.propertySignals?.footprintSqFt ||
              roofSizeEstimate?.meta?.propertySignals?.livingAreaSqFt ||
              null
            ),
          priceImplied:
            normalizeRoofSizeValue(
              roofSizeEstimate?.meta?.roofSizeSignals?.priceImplied ||
              (String(roofSizeEstimate?.source || "").toLowerCase() === "price_based_estimate"
                ? roofSizeEstimate?.roofSize
                : null)
            )
        };

        const roofSizeConsistency =
          typeof buildRoofSizeConsistencySummary === "function"
            ? buildRoofSizeConsistencySummary(roofSizeSignals)
            : {
                hasConflict: false,
                severity: "none",
                summary: "",
                details: []
              };

        const displayVerdict = softenVerdictForRoofSizeTrust(verdict, roofSizeConsistency);

        const disagreement = roofSizeEstimate?.meta?.disagreement;

        const roofSizeSource = String(roofSizeEstimate?.source || "").toLowerCase();
        const isLivingAreaFallback = roofSizeSource === "living_area_fallback";
        const isUnavailable = roofSizeSource === "unavailable";
        const fallbackUsed = !!roofSizeEstimate?.meta?.fallbackUsed;

        const derivedAnalysisConfidenceLabel =
          isUnavailable
            ? "Low"
            : isLivingAreaFallback
              ? (roofSizeEstimate?.confidence || "Medium")
              : fallbackUsed
                ? "Low"
                : disagreement?.hasDisagreement
                  ? (disagreement.severity === "high" ? "Low" : "Medium")
                  : (roofSizeEstimate?.confidence || latestParsed?.confidenceLabel || "Low");

        const derivedConfidenceScore =
          isUnavailable
            ? 35
            : isLivingAreaFallback
              ? (roofSizeEstimate?.confidenceScore ?? 58)
              : fallbackUsed
                ? 35
                : disagreement?.hasDisagreement
                  ? (disagreement.severity === "high" ? 35 : 55)
                  : (roofSizeEstimate?.confidenceScore ?? latestParsed?.confidenceScore ?? 50);
        
         // ---- derived helpers ----

        const propertySignalsMeta =
          roofSizeEstimate?.meta?.propertySignalsMeta ||
          roofSizeEstimate?.meta?.propertySignals ||
          {};

        const effectiveRoofSizeSource =
          userEnteredRoofSize && roofSizeInputSource === "manual_calculator"
            ? "manual_calculator"
            : (roofSizeEstimate?.source || "unavailable");

        const effectiveRoofSizeConfidence =
          userEnteredRoofSize && roofSizeInputConfidence === "manual_estimate"
            ? "Medium"
            : (roofSizeEstimate?.confidence || "Low");

        const effectiveRoofSizeConfidenceScore =
          userEnteredRoofSize && roofSizeInputSource === "manual_calculator"
            ? Math.max(65, Number(derivedConfidenceScore || 0))
            : derivedConfidenceScore;

        const reliabilityTier = getReliabilityTier({
          source: effectiveRoofSizeSource,
          confidenceScore: effectiveRoofSizeConfidenceScore,
          disagreement: roofSizeEstimate?.meta?.disagreement || null
        });

        const decisionDelta = buildDecisionDelta({
          quotePrice,
          low,
          mid,
          high
        });

        const riskFlags = buildRiskFlags({
        rawVerdict: verdict,
        verdict: displayVerdict,
        roofSizeConsistency,
        propertySignalsMeta,
        pricePerSqFt,
        reliabilityTier,
        missingSignals: latestParsed?.missingSignals || []
      });

        const recommendation = buildRecommendation({
          rawVerdict: verdict,
          verdict: displayVerdict,
          reliabilityTier,
          roofSizeConsistency,
          propertySignalsMeta,
          riskFlags,
          decisionDelta
        });

       const previewAnalysis = {
        verdict: displayVerdict,
        rawVerdict: verdict,
        quotePrice,
        low,
        mid,
        high,

        riskFlags,
        recommendation,
        decisionDelta,
        reliabilityTier,
        missingSignals: latestParsed?.missingSignals || [],

        material,
        roofSize: effectiveRoofSize,
        city,
        stateCode,
        localDataUsed,
        sizeLabelUsed,
        warrantyYears,
        analysisConfidenceLabel: derivedAnalysisConfidenceLabel,
        confidenceScore: derivedConfidenceScore,
        confidenceLabel: derivedAnalysisConfidenceLabel,
        pricePerSqFt,
        pricePerSquare,

        roofSizeEstimate: roofSizeEstimate?.roofSize ?? null,
        roofSizeEstimateConfidence: effectiveRoofSizeConfidence,
        roofSizeEstimateConfidenceScore: effectiveRoofSizeConfidenceScore,
        roofSizeEstimateSource: effectiveRoofSizeSource,
        roofSizeEstimateReasoning: roofSizeEstimate?.reasoning || "",
        roofSizeEstimateMeta: roofSizeEstimate?.meta || {},

        meta: buildNormalizedAnalysisMeta({
          effectiveRoofSize,
          effectiveRoofSizeSource,
          effectiveRoofSizeConfidence,
          effectiveRoofSizeConfidenceScore,
          roofSizeEstimate,
          roofSizeSignals,
          roofSizeConsistency,
          quotePrice,
          low,
          mid,
          high,
          derivedAnalysisConfidenceLabel,
          derivedConfidenceScore,
          reliabilityTier
      }),

        propertySignalsMeta,
        livingAreaSqFt:
        roofSizeEstimate?.meta?.livingAreaSqFt ||
        roofSizeEstimate?.meta?.propertySignals?.livingAreaSqFt ||
        null,

        roofSizeNeedsReview:
          !!roofSizeEstimate?.meta?.disagreement?.hasDisagreement ||
          !!propertySignalsMeta?.ambiguous ||
          !!roofSizeEstimate?.meta?.fallbackUsed ||
          String(roofSizeEstimate?.source || "").toLowerCase() === "unavailable",

        roofSizeSignals,
        signalComparison: {
          parsed: roofSizeSignals?.parsed || null,
          property: roofSizeSignals?.property || null,
          priceImplied: roofSizeSignals?.priceImplied || null,
          selected: effectiveRoofSizeSource,
          explanation: buildSignalComparisonReasoning({
            roofSizeEstimateSource: effectiveRoofSizeSource,
            propertySignalsMeta,
            roofSizeEstimateMeta: roofSizeEstimate?.meta || {}
          })
        },
        roofSizeConsistency,
        roofSizeInputSource,
        roofSizeInputConfidence,
        userEnteredRoofSize
      };

        const tearOffValue = byId("tearOffIncluded")?.value || "1.00";
        const tearOffLabel =
          tearOffValue === "1.05" ? "yes" : tearOffValue === "0.97" ? "no" : "unknown";

        latestAnalysis = {
          verdict: displayVerdict,
          rawVerdict: verdict,
          quotePrice,
          low,
          mid,
          high,

          riskFlags,
          recommendation,
          decisionDelta,
          reliabilityTier,
          missingSignals: latestParsed?.missingSignals || [],

          material,
          roofSize: effectiveRoofSize,
          userEnteredRoofSize,
          roofSizeInputSource,
          roofSizeInputConfidence,
          city,
          stateCode,
          localDataUsed,
          sizeLabelUsed,
          tearOffLabel,
          warrantyYears,
          premiumSignals: latestParsed?.premiumSignals || [],
          analysisConfidenceLabel: derivedAnalysisConfidenceLabel,
          confidenceScore: derivedConfidenceScore,
          confidenceLabel: derivedAnalysisConfidenceLabel,
          pricePerSqFt,
          pricePerSquare,

          roofSizeEstimate: roofSizeEstimate?.roofSize ?? null,
          roofSizeEstimateConfidence: effectiveRoofSizeConfidence,
          roofSizeEstimateConfidenceScore: effectiveRoofSizeConfidenceScore,
          roofSizeEstimateSource: effectiveRoofSizeSource,
          roofSizeEstimateReasoning: roofSizeEstimate?.reasoning || "",
          roofSizeEstimateMeta: roofSizeEstimate?.meta || {},

          meta: buildNormalizedAnalysisMeta({
            effectiveRoofSize,
            effectiveRoofSizeSource,
            effectiveRoofSizeConfidence,
            effectiveRoofSizeConfidenceScore,
            roofSizeEstimate,
            roofSizeSignals,
            roofSizeConsistency,
            quotePrice,
            low,
            mid,
            high,
            derivedAnalysisConfidenceLabel,
            derivedConfidenceScore,
            reliabilityTier
        }),
          
          propertySignalsMeta,
          livingAreaSqFt:
          roofSizeEstimate?.meta?.livingAreaSqFt ||
          roofSizeEstimate?.meta?.propertySignals?.livingAreaSqFt ||
          null,

          roofSizeNeedsReview:
            !!roofSizeEstimate?.meta?.disagreement?.hasDisagreement ||
            !!propertySignalsMeta?.ambiguous ||
            !!roofSizeEstimate?.meta?.fallbackUsed ||
            String(roofSizeEstimate?.source || "").toLowerCase() === "unavailable",

          roofSizeSignals,

          signalComparison: {
            parsed: roofSizeSignals?.parsed || null,
            property: roofSizeSignals?.property || null,
            priceImplied: roofSizeSignals?.priceImplied || null,
            selected: effectiveRoofSizeSource,
            explanation: buildSignalComparisonReasoning({
              roofSizeEstimateSource: effectiveRoofSizeSource,
              propertySignalsMeta,
              roofSizeEstimateMeta: roofSizeEstimate?.meta || {}
            })
          },
          roofSizeConsistency
        };

        latestAnalysis.roofSizeSource =
        latestAnalysis?.meta?.roofSize?.source ||
        latestAnalysis?.roofSizeEstimateSource ||
        "unavailable";

        latestAnalysis.conflictSignals = buildConflictSignals({
        quotePrice: latestAnalysis.quotePrice,
        low: latestAnalysis.low,
        high: latestAnalysis.high,
        roofSize: latestAnalysis.roofSize,
        confidenceScore: latestAnalysis.confidenceScore
      });

        window.__latestAnalysis = latestAnalysis;
        console.log("about to switch to result screen");
        setJourneyStep("result");
        console.log("after setJourneyStep, current step should be result");
        console.log("SET window.__latestAnalysis EARLY:", window.__latestAnalysis);
        console.log("REACHED FINAL ANALYSIS BLOCK");

        const session = getTrackingSession();
        session.analysesRun = (session.analysesRun || 0) + 1;
        saveTrackingSession(session);

        track("analysis_completed", {
          verdict: latestAnalysis?.verdict || "",
          rawVerdict: latestAnalysis?.rawVerdict || "",
          confidence: latestAnalysis?.analysisConfidenceLabel || "",
          roofSizeSource: latestAnalysis?.roofSizeEstimateSource || "",
          roofSizeNeedsReview: !!latestAnalysis?.roofSizeNeedsReview,
          roofSizeConsistencySeverity: latestAnalysis?.roofSizeConsistency?.severity || "low",
          quotePrice: latestAnalysis?.quotePrice || null,
          roofSize: latestAnalysis?.roofSize || null,
          material: latestAnalysis?.material || ""
        });

        }

        window.handleAnalyzeClick = function handleAnalyzeClick() {
          const fileInput = document.getElementById("quoteFile");
          const file = fileInput?.files?.[0];
          const price = Number(document.getElementById("quotePrice")?.value || 0);

          if (file && typeof parseUploadedComparisonFile === "function") {
            parseUploadedComparisonFile(file)
              .then(parsedBundle => {
                const parsed = parsedBundle?.parsed || parsedBundle || {};
                latestParsed = parsed;
                copyParsedToForm();
                analyzeQuote();
              })
              .catch(err => {
                console.error(err);
                setUploadStatus("Could not read the uploaded quote.", "error");
              });
            return;
          }

          if (price > 0) {
            analyzeQuote();
            return;
          }

          setUploadStatus(
            "Upload a quote to get started, or enter your price below.",
            "info"
          );
        };

    function buildComparisonSummaryLines() {
      const lines = [];

      const primaryQuote = normalizeComparisonQuote(buildPrimaryComparisonQuote(), "Quote 1");
      if (primaryQuote?.isValid) {
        lines.push(`${primaryQuote.contractor}: ${safeFormatCurrency(primaryQuote.total)}`);
      }

      const secondManualName = (byId("secondContractorName")?.value || "").trim();
      const secondManualPrice = byId("secondQuotePrice")?.value || "";
      const secondQuote = normalizeComparisonQuote(
        buildComparisonQuoteFromUpload(
          secondParsed,
          secondManualName,
          secondManualPrice,
          "Quote 2"
        ),
        "Quote 2"
      );

      const thirdManualName = (byId("thirdContractorName")?.value || "").trim();
      const thirdManualPrice = byId("thirdQuotePrice")?.value || "";
      const thirdQuote = normalizeComparisonQuote(
        buildComparisonQuoteFromUpload(
          thirdParsed,
          thirdManualName,
          thirdManualPrice,
          "Quote 3"
        ),
        "Quote 3"
      );

      if (secondQuote?.isValid) {
        lines.push(`${secondQuote.contractor}: ${safeFormatCurrency(secondQuote.total)}`);
      }

      if (thirdQuote?.isValid) {
        lines.push(`${thirdQuote.contractor}: ${safeFormatCurrency(thirdQuote.total)}`);
      }

      return lines;
    }

    function buildShareableReportData() {
      const analysis =
        latestAnalysis ||
        (typeof window !== "undefined" && window.__tpDebug?.getLatestAnalysis?.()) ||
        null;

      if (!analysis) return null;

      const parsed = latestParsed || {};
      const comparisonLines = buildComparisonSummaryLines();

      const manualSignals = [
        !!analysis?.quotePrice && (!parsed?.price || Number(parsed.price) <= 0),
        !!analysis?.roofSize && (!parsed?.roofSize || Number(parsed.roofSize) <= 0),
        !!analysis?.material && (!parsed?.materialLabel || parsed.materialLabel === "Unknown"),
        !!analysis?.city && !parsed?.city,
        !!analysis?.stateCode && !parsed?.stateCode
      ];

      const manualCount = manualSignals.filter(Boolean).length;

      let shareConfidenceLabel =
        analysis?.analysisConfidenceLabel ||
        parsed?.confidenceLabel ||
        "Low";

      let shareConfidenceScore =
        analysis?.roofSizeEstimateConfidenceScore ??
        parsed?.confidenceScore ??
        "Unknown";

      if (manualCount >= 2) {
        shareConfidenceLabel = "Medium";
        shareConfidenceScore = "Manual or mixed input";
      } else if (manualCount === 1) {
        shareConfidenceScore = parsed?.confidenceScore ?? "1 field confirmed manually";
      }

      return {
        verdict: analysis.verdict || "Quote analyzed",
        rawVerdict: analysis.rawVerdict || analysis.verdict || "Quote analyzed",
        riskFlags: analysis?.riskFlags || [],
        recommendation: analysis?.recommendation || null,
        decisionDelta: analysis?.decisionDelta || null,
        conflictSignals: analysis?.conflictSignals || null,
        quotePrice: analysis.quotePrice || null,
        contractorPriceScore:
          analysis.quotePrice && analysis.mid
            ? calculateContractorPriceScore(analysis.quotePrice, analysis.mid).score
            : null,
        contractorPriceScoreLabel:
          analysis.quotePrice && analysis.mid
            ? calculateContractorPriceScore(analysis.quotePrice, analysis.mid).label
            : "Not available",
        low: analysis.low || null,
        mid: analysis.mid || null,
        high: analysis.high || null,
        roofSize: analysis.roofSize || parsed.roofSize || null,
        material: parsed?.materialLabel || analysis.material || "Not detected",
        warranty: displayWarranty(parsed?.warranty || ""),
        contractor:
        parsed?.contractor && parsed.contractor !== "Not detected"
          ? parsed.contractor
          : inferContractorNameFromParsed(parsed, "Contractor"),
        city: analysis.city || parsed.city || "",
        stateCode: analysis.stateCode || parsed.stateCode || "",
        typicalPriceSummary: buildTypicalPriceSummary({
          city: analysis.city || parsed.city || "",
          stateCode: analysis.stateCode || parsed.stateCode || "",
          roofSize: analysis.roofSize || parsed.roofSize || null,
          low: analysis.low || null,
          high: analysis.high || null,
          mid: analysis.mid || null
        }),
        pricePerSqFt: analysis.pricePerSqFt || parsed.pricePerSqFt || null,
        confidenceLabel: shareConfidenceLabel,
        confidenceScore: shareConfidenceScore,
        roofSizeEstimateSource: analysis?.roofSizeEstimateSource || "unavailable",
        roofSizeEstimateReasoning: analysis?.roofSizeEstimateReasoning || "",
        roofSizeEstimateConfidence: analysis?.roofSizeEstimateConfidence || "Low",
        roofSizeNeedsReview: !!analysis?.roofSizeNeedsReview,
        roofSizeSignals: analysis?.roofSizeSignals || {},
        roofSizeConsistency: analysis?.roofSizeConsistency || null,
        priceSanityStatus: parsed?.priceSanityStatus || "unknown",
        includedSignals: Array.isArray(parsed?.includedSignals) ? parsed.includedSignals : [],
        missingSignals: Array.isArray(analysis?.missingSignals)
          ? analysis.missingSignals
          : Array.isArray(parsed?.missingSignals)
            ? parsed.missingSignals
            : [],
        premiumSignals: Array.isArray(parsed?.premiumSignals) ? parsed.premiumSignals : [],
        comparisonLines,
        contractorQuestions: buildContractorQuestions(analysis).slice(0, 3),
        partialExtractionNoticeHtml: buildPartialExtractionNotice(parsed)
      };
    }

     function buildShareableReportText(report) {
      if (!report) return "";

      const locationLine =
        [report.city, report.stateCode].filter(Boolean).join(", ") || "Location not detected";

      const recommendationAction = String(report?.recommendation?.action || "REVIEW").toUpperCase();

      const recommendationReasoning = softenClaim(
        report?.recommendation?.reasoning || getDecisionGuidance(report),
        latestAnalysis || report
      );

      const decisionDeltaText = report?.decisionDelta
        ? softenClaim(buildDecisionDeltaText(report.decisionDelta), latestAnalysis || report)
        : softenClaim(buildMarketPositionText(report.quotePrice, report.mid), latestAnalysis || report);

      const consistencySeverity = String(report?.roofSizeConsistency?.severity || "low").toLowerCase();

      const trustLine =
        consistencySeverity === "high"
          ? "Trust note: Treat this result as provisional until roof size is verified."
          : consistencySeverity === "medium"
            ? "Trust note: Treat this result as directional because roof size signals are mixed."
            : "";

      const riskFlags = Array.isArray(report?.riskFlags) ? report.riskFlags : [];
      const topRiskFlags = riskFlags
        .filter(flag => String(flag?.key || "").toLowerCase() !== "no_major_risks")
        .slice(0, 2);

      const contractorQuestions = Array.isArray(report?.contractorQuestions)
        ? report.contractorQuestions.slice(0, 3)
        : [];

      const sections = [
        "TruePrice Roofing Quote Decision Report",
        "",
        `${recommendationAction}`,
        recommendationReasoning,
        "",
        `Decision delta: ${decisionDeltaText}`,
        `Verdict: ${report.verdict}`,
        ...(report.rawVerdict && report.rawVerdict !== report.verdict
          ? [`Original modeled verdict: ${report.rawVerdict}`]
          : []),
        ...(trustLine ? [trustLine] : []),
        `Next step: ${getDecisionGuidance(report)}`
      ];

      if (topRiskFlags.length) {
        sections.push(
          "",
          "Top risk flags:",
          ...topRiskFlags.map(flag => {
            const title = flag?.title || "Risk flag";
            const impact = flag?.impact || "";
            const action = flag?.action || "";
            return `- ${title}: ${impact}${action ? ` Next move: ${action}.` : ""}`;
          })
        );
      }

      sections.push(
        "",
        "Pricing summary:",
        `- Quote price: ${report.quotePrice ? safeFormatCurrency(report.quotePrice) : "Not available"}`,
        `- Expected range: ${
          report.low && report.high
            ? `${safeFormatCurrency(report.low)} to ${safeFormatCurrency(report.high)}`
            : "Not available"
        }`,
        `- Expected midpoint: ${report.mid ? safeFormatCurrency(report.mid) : "Not available"}`,
        `- Market position: ${softenClaim(buildMarketPositionText(report.quotePrice, report.mid), latestAnalysis || report)}`,
        `- Difference vs midpoint: ${buildDifferenceDisplay(report.quotePrice, report.mid)}`,
        `- Contractor Price Score: ${
          report.contractorPriceScore !== null && report.contractorPriceScore !== undefined
            ? `${report.contractorPriceScore} / 100${report.contractorPriceScoreLabel ? ` (${report.contractorPriceScoreLabel})` : ""}`
            : "Not available"
        }`,
        `- Typical local price: ${report.typicalPriceSummary || "Not available"}`
      );

      sections.push(
        "",
        "Quote details:",
        `- Roof size: ${
          report.roofSize
            ? formatRoofSizeForDisplay(
                report.roofSize,
                report.roofSizeEstimateSource,
                report.roofSizeEstimateConfidence
              )
            : "Not detected"
        }`,
        `- Roof size source: ${getRoofSizeSourceDisplay(report.roofSizeEstimateSource) || "Not available"}`,
        `- Price per sq ft: ${report.pricePerSqFt ? `${safeFormatCurrencyPrecise(report.pricePerSqFt)} / sq ft` : "Not available"}`,
        `- Material: ${displayMaterial(report.material)}`,
        `- Warranty: ${displayWarranty(report.warranty)}`,
        `- Contractor: ${report.contractor || "Quote 1"}`,
        `- Location: ${locationLine}`,
        `- Quote confidence: ${report.confidenceLabel} (${report.confidenceScore})`
      );

      if (report.roofSizeNeedsReview) {
        sections.push("- Roof size review: Recommended before relying on this result");
      }

      if (report.roofSizeConsistency?.summary) {
        sections.push(`- Roof size consistency: ${report.roofSizeConsistency.summary}`);
      }

      if (contractorQuestions.length) {
        sections.push(
          "",
          "Questions to send the contractor:",
          ...contractorQuestions.map((question, index) => `${index + 1}. ${question}`)
        );
      }

      if (report.includedSignals.length) {
        sections.push(
          "",
          "Clearly mentioned in the quote:",
          ...report.includedSignals.map(item => `- ${item}`)
        );
      }

      if (report.missingSignals.length) {
        sections.push(
          "",
          "Possible missing items to clarify:",
          ...report.missingSignals.map(item => `- ${item}`)
        );
      }

      if (report.premiumSignals.length) {
        sections.push(
          "",
          "Higher quality or complexity signals:",
          ...report.premiumSignals.map(item => `- ${item}`)
        );
      }

      if (report.comparisonLines.length > 1) {
        sections.push(
          "",
          "Quote comparison:",
          ...report.comparisonLines.map(line => `- ${line}`)
        );
      }

      sections.push(
        "",
        getBrandFooterText()
      );

      return sections.join("\n");
    }

    function buildTopRiskFlagsHtml(report) {
      const riskFlags = Array.isArray(report?.riskFlags) ? report.riskFlags : [];
      const topRiskFlags = riskFlags
        .filter(flag => String(flag?.key || "").toLowerCase() !== "no_major_risks")
        .slice(0, 2);

      if (!topRiskFlags.length) return "";

      return `
        <div style="display:grid; gap:10px; margin:0 0 12px;">
          ${topRiskFlags.map(flag => {
            const accent = getRiskFlagAccent(flag?.severity);
            return `
              <div class="panel" style="margin:0; background:${accent.bg}; border-color:${accent.border};">
                <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:${accent.text};">
                  ${accent.icon} ${flag.title}
                </p>
                <p class="small" style="margin:0 0 6px; color:${accent.text};">
                  ${flag.impact || ""}
                </p>
                ${
                  flag.action
                    ? `<p class="small muted" style="margin:0;"><strong>Next move:</strong> ${flag.action}</p>`
                    : ""
                }
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    function buildShareContractorQuestionsHtml(report) {
      const questions = Array.isArray(report?.contractorQuestions)
        ? report.contractorQuestions.slice(0, 3)
        : [];

      if (!questions.length) return "";

      return `
        <div class="panel" style="margin:0 0 12px; padding:12px 14px; background:#f8fafc; border-color:#e5e7eb;">
          <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#475569;">
            Contractor questions
          </p>

          <p class="small muted" style="margin:0 0 10px;">
            Use these to pressure test the decision before you sign.
          </p>

          <ul class="mini-list" style="margin:0;">
            ${questions.map(q => `<li>${q}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    async function copyShareableReportText() {
      const report = buildShareableReportData();
      if (!report) {
        setUploadStatus("Run the quote analysis before copying a report.", "warn");
        return;
      }

      const text = buildShareableReportText(report);

      track("report_copy_attempted", {
        verdict: report?.verdict || "",
        rawVerdict: report?.rawVerdict || "",
        recommendation: report?.recommendation?.action || "",
        hasContractorQuestions: !!buildContractorQuestions(latestAnalysis || {}).length
      });

      try {
        await navigator.clipboard.writeText(text);

        track("report_copied", {
          verdict: report?.verdict || "",
          rawVerdict: report?.rawVerdict || "",
          recommendation: report?.recommendation?.action || "",
          hasContractorQuestions: !!buildContractorQuestions(latestAnalysis || {}).length
        });

        const copyStatus = getShareReportOutputElement();
        if (copyStatus) {
          copyStatus.innerHTML = `
            <div class="panel" style="margin-top:12px; background:#f0fdf4; border-color:#86efac;">
              <p style="margin:0 0 6px;"><strong>Copied.</strong> Share summary copied to clipboard.</p>
              <p class="small muted" style="margin:0;">Paste it into a text, Facebook group, Reddit post, or email to get a second opinion.</p>
            </div>
          `;
        }

        setUploadStatus("Shareable quote summary copied to clipboard.", "success");
      } catch (err) {
        console.error(err);

        track("report_copy_failed", {
          verdict: report?.verdict || "",
          rawVerdict: report?.rawVerdict || "",
          recommendation: report?.recommendation?.action || "",
          hasContractorQuestions: !!buildContractorQuestions(latestAnalysis || {}).length
        });

        setUploadStatus("Could not copy the shareable summary.", "error");
      }
    }

    function renderShareableReport(output, report) {
      if (!output || !report) return;

      const locationDisplay =
        [report.city, report.stateCode].filter(Boolean).join(", ") || "Not detected";

      const recommendationAction = String(report?.recommendation?.action || "REVIEW").toUpperCase();
      const recommendationReasoning = softenClaim(
        report?.recommendation?.reasoning || getDecisionGuidance(report),
        latestAnalysis || report
      );

      const decisionDeltaText = report?.decisionDelta
        ? softenClaim(buildDecisionDeltaText(report.decisionDelta), latestAnalysis || report)
        : softenClaim(buildMarketPositionText(report.quotePrice, report.mid), latestAnalysis || report);

      const differenceDisplay = buildDifferenceDisplay(report.quotePrice, report.mid);

      const partialExtractionNoticeHtml = report.partialExtractionNoticeHtml || "";
      const scopeCheckHtml = buildScopeCheckHtml({
        includedSignals: report.includedSignals,
        missingSignals: report.missingSignals,
        premiumSignals: report.premiumSignals
      });
      const scopeRiskHtml = buildScopeRiskHtml(report.missingSignals);
      const topRiskFlagsHtml = buildTopRiskFlagsHtml(report);
      const contractorQuestionsHtml = buildShareContractorQuestionsHtml(report);

      const comparisonHtml = report.comparisonLines.length > 1
        ? `
            <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#e5e7eb;">
              <p style="margin:0 0 8px;"><strong>Quote comparison</strong></p>
              <ul class="mini-list" style="margin:0;">
                ${report.comparisonLines.map(line => `<li>${line}</li>`).join("")}
              </ul>
            </div>
          `
        : "";

                output.innerHTML = `
            <div class="panel" style="margin-top:8px; border-width:2px;">
              <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#334155;">
                TruePrice decision report
              </p>

              <div style="margin:0 0 10px; font-size:32px; line-height:1.05; font-weight:800;">
                ${recommendationAction}
              </div>

              <p class="small muted" style="margin:0 0 14px;">
                ${recommendationReasoning}
              </p>

              <div class="panel" style="margin:0 0 12px; padding:16px 18px; background:#f8fafc; border-color:#e5e7eb;">
                <div style="font-size:30px; line-height:1.1; font-weight:800; margin:0 0 8px;">
                  ${decisionDeltaText}
                </div>
                <p class="small muted" style="margin:0;">
                  Typical range: ${
                    report.low && report.high
                      ? `${safeFormatCurrency(report.low)} to ${safeFormatCurrency(report.high)}`
                      : "Not available"
                  }
                </p>
              </div>

              <div class="verdict ${getVerdictClassName(report.verdict)}" style="margin-bottom:12px;">
                ${report.verdict}
              </div>

          ${report.rawVerdict && report.rawVerdict !== report.verdict ? `
            <p class="small muted" style="margin:0 0 12px;">
              <strong>Original modeled verdict:</strong> ${report.rawVerdict}
            </p>
          ` : ""}

          ${report.roofSizeConsistency?.severity === "high" ? `
            <div class="panel" style="margin:0 0 12px; background:#fff7ed; border-color:#fdba74;">
              <p style="margin:0;">
                <strong>Trust note:</strong> Treat this result as provisional until roof size is verified.
              </p>
            </div>
          ` : report.roofSizeConsistency?.severity === "medium" ? `
            <div class="panel" style="margin:0 0 12px; background:#fff7ed; border-color:#fdba74;">
              <p style="margin:0;">
                <strong>Trust note:</strong> Treat this result as directional because roof size signals are mixed.
              </p>
            </div>
          ` : ""}

          ${topRiskFlagsHtml}

          <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#dbeafe;">
            <p style="margin:0 0 8px;"><strong>Next step</strong></p>
            <p class="small" style="margin:0;">
              ${getDecisionGuidance(report)}
            </p>
          </div>

          ${contractorQuestionsHtml}

          <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#e5e7eb;">
            <p class="small muted" style="margin:0;">
              <strong>Share prompt:</strong> ${getSharePrompt(report)}
            </p>
          </div>

          <div class="panel" style="margin:0 0 12px; background:#f9fafb; border-color:#e5e7eb;">
            <p class="small muted" style="margin:0;">
              <strong>Market context:</strong> ${report.typicalPriceSummary || "Not available"}
            </p>
          </div>

          ${partialExtractionNoticeHtml}

          ${report.roofSizeNeedsReview ? `
            <div class="panel" style="margin:0 0 12px; background:#fff7ed; border-color:#fdba74;">
              <p style="margin:0;">
                <strong>Roof size review:</strong> Recommended before relying on this result.
              </p>
            </div>
          ` : ""}

          ${report.roofSizeConsistency?.summary ? `
            <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#dbeafe;">
              <p style="margin:0;">
                <strong>Roof size consistency:</strong> ${report.roofSizeConsistency.summary}
              </p>
            </div>
          ` : ""}

          <div class="analysis-grid">
            <div><strong>Quote price</strong></div>
            <div>${report.quotePrice ? safeFormatCurrency(report.quotePrice) : "Not available"}</div>

            <div><strong>Contractor Price Score</strong></div>
            <div>${
              report.contractorPriceScore !== null && report.contractorPriceScore !== undefined
                ? `${report.contractorPriceScore} / 100${report.contractorPriceScoreLabel ? ` (${report.contractorPriceScoreLabel})` : ""}`
                : "Not available"
            }</div>

            <div><strong>Expected range</strong></div>
            <div>${report.low && report.high ? `${safeFormatCurrency(report.low)} to ${safeFormatCurrency(report.high)}` : "Not available"}</div>

            <div><strong>Expected midpoint</strong></div>
            <div>${report.mid ? safeFormatCurrency(report.mid) : "Not available"}</div>

            <div><strong>Difference vs midpoint</strong></div>
            <div>${differenceDisplay}</div>

            <div><strong>Roof size</strong></div>
            <div>${
              report.roofSize
                ? formatRoofSizeForDisplay(
                    report.roofSize,
                    report.roofSizeEstimateSource,
                    report.roofSizeEstimateConfidence
                  )
                : "Not detected"
            }</div>

            <div><strong>Roof size source</strong></div>
            <div>${getRoofSizeSourceDisplay(report.roofSizeEstimateSource) || "Not available"}</div>

            <div><strong>Price per sq ft</strong></div>
            <div>${report.pricePerSqFt ? `${safeFormatCurrencyPrecise(report.pricePerSqFt)} / sq ft` : "Not available"}</div>

            <div><strong>Material</strong></div>
            <div>${displayMaterial(report.material)}</div>

            <div><strong>Warranty</strong></div>
            <div>${displayWarranty(report.warranty)}</div>

            <div><strong>Contractor</strong></div>
            <div>${displayDetectedValue(report.contractor, "Quote 1")}</div>

            <div><strong>Location</strong></div>
            <div>${locationDisplay}</div>

            <div><strong>Quote Confidence</strong></div>
            <div>${report.confidenceLabel} (${report.confidenceScore})</div>
          </div>

          <div style="margin-top:14px;">
            ${scopeCheckHtml}
          </div>

          ${scopeRiskHtml}

          ${comparisonHtml}

          <p class="small muted" style="margin:16px 0 0;">
            ${getBrandFooterText()}
          </p>
        </div>
      `;
    }

    function getShareReportOutputElement() {
      return byId("inlineShareReportOutput");
    }

    function viewShareableResult() {
      const output = getShareReportOutputElement();

      const comparisonOutput = byId("comparisonOutput");
      if (comparisonOutput) {
        comparisonOutput.innerHTML = "";
      }
      if (!output) {
        setUploadStatus("Share report output container not found.", "warn");
        return;
      }

      if (!latestAnalysis) {
        output.innerHTML = "Run the main quote analysis before viewing a shareable result.";
        setUploadStatus("Run the main quote analysis before viewing a shareable result.", "warn");
        return;
      }

      const report = buildShareableReportData();
      if (!report) {
        output.innerHTML = "Run the main quote analysis before viewing a shareable result.";
        setUploadStatus("Could not build the share report from the current analysis.", "warn");
        return;
      }

      track("report_viewed", {
        verdict: report?.verdict || "",
        rawVerdict: report?.rawVerdict || ""
      });

      renderShareableReport(output, report);
      setTimeout(() => {
      output.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    }

    function getWinningComparisonLabel(comparisonSummary) {
      return String(comparisonSummary?.winnerQuote?.label || "").trim();
    }

    function getComparisonCellStyle(quote, winningLabel) {
      const isWinner = String(quote?.label || "").trim() === String(winningLabel || "").trim();

      if (isWinner) {
        return 'padding:8px; border-bottom:1px solid #d1fae5; background:#f0fdf4;';
      }

      return 'padding:8px; border-bottom:1px solid #eee;';
    }

    function renderComparisonResults({
      output,
      sortedQuotes,
      comparisonSummary,
      winningLabel,
      lowest,
      highest,
      spread,
      spreadPct
    }) {
      if (!output) return;

      const winnerHtml = buildComparisonWinnerHtml(comparisonSummary);

      const tableHtml = `
        ${winnerHtml}

        <div class="panel" style="margin:0 0 12px; background:#f8fafc; border-color:#e5e7eb;">
          <p style="margin:0;" class="small muted">
            Quotes are ordered by <strong>best overall position</strong>, not lowest price alone.
          </p>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-top:12px;">
          <thead>
            <tr>
              <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px;">Category</th>
              ${sortedQuotes.map(q => `
                <th style="text-align:left; border-bottom:1px solid #ddd; padding:8px; ${
                  q.label === winningLabel ? "background:#dcfce7;" : ""
                }">
                  ${q.contractor}
                  ${q.label === winningLabel ? `<div class="small" style="margin-top:4px; color:#166534;"><strong>Recommended</strong></div>` : ""}
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Quote label</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${q.label}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Total price</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${safeFormatCurrency(q.total)}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Comparison score</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${buildComparisonScoreCellHtml(q)}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Roof size</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${q.roofSize ? safeFormatNumber(q.roofSize) + " sq ft" : "Not detected"}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Price per square foot</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${q.pricePerSqFt ? `${safeFormatCurrencyPrecise(q.pricePerSqFt)} / sq ft` : "Not available"}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Material</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${displayDetectedValue(q.material)}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Warranty</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${displayWarranty(q.warranty)}</td>`).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Decision notes</td>
              ${sortedQuotes.map(q => `
                <td style="${getComparisonCellStyle(q, winningLabel)}">
                  ${
                    q?.comparisonBreakdown?.warnings?.length
                      ? `<div class="small" style="color:#9a3412;"><strong>Warning:</strong> ${q.comparisonBreakdown.warnings[0]}</div>`
                      : q?.comparisonBreakdown?.reasons?.length
                        ? `<div class="small muted">${q.comparisonBreakdown.reasons.slice(0, 2).join(". ")}</div>`
                        : "Not available"
                  }
                </td>
              `).join("")}
            </tr>
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">Source</td>
              ${sortedQuotes.map(q => `<td style="${getComparisonCellStyle(q, winningLabel)}">${renderComparisonSourceLabel(q.source)}</td>`).join("")}
            </tr>
          </tbody>
        </table>

        <div style="margin-top:16px;">
          <p><strong>Lowest total quote:</strong> ${safeFormatCurrency(lowest.total)} (${lowest.contractor})</p>
          <p><strong>Highest total quote:</strong> ${safeFormatCurrency(highest.total)} (${highest.contractor})</p>
          <p><strong>Quote spread:</strong> ${safeFormatCurrency(spread)} (${spreadPct.toFixed(1)}%)</p>
          <p class="muted">
            A lower quote is not automatically the best value. Compare scope, materials, warranty,
            flashing, ventilation, tear off assumptions, and change order language before choosing a contractor.
          </p>
        </div>
      `;

      output.innerHTML = tableHtml;
      bindComparisonWinnerActions(comparisonSummary);
    }

    function renderComparisonResultScreen(summary, sortedQuotes, spread, spreadPct) {
      const root = document.getElementById("appRoot");
      if (!root) return;

      const w = summary.winnerQuote || {};
      const wb = w.comparisonBreakdown || {};
      const softened = summary.shouldSoftenWinner;
      const mid = latestAnalysis?.mid || 0;

      const winnerBg = softened ? "#fff7ed" : "#f0fdf4";
      const winnerBorder = softened ? "#fdba74" : "#86efac";
      const winnerColor = softened ? "#9a3412" : "#166534";
      const winnerTitle = softened
        ? `${escapeHtml(summary.winner)} is in front, but needs verification`
        : `${escapeHtml(summary.winner)} is the best value`;

      // Build reasons list
      const reasons = (wb.reasons || []).slice(0, 3);
      const warnings = (wb.warnings || []).slice(0, 2);

      // Build runner-up section
      let runnerUpHtml = "";
      if (summary.runnerUp) {
        const rb = summary.runnerUp.comparisonBreakdown || {};
        const rReasons = (rb.reasons || []).slice(0, 2);
        runnerUpHtml = `
          <div style="padding:16px; border:1px solid #e2e8f0; border-radius:12px; margin:0 0 16px;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px;">
              <div>
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted, #6b7280);">Runner-up</div>
                <div style="font-size:18px; font-weight:700; margin-top:4px;">${escapeHtml(summary.runnerUp.contractor || summary.runnerUp.label)}</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:20px; font-weight:700;">${safeFormatCurrency(summary.runnerUp.total)}</div>
                <div style="font-size:13px; color:var(--muted, #6b7280);">Score: ${summary.runnerUp.comparisonScore || 0}/100</div>
              </div>
            </div>
            ${rReasons.length > 0 ? `<ul style="margin:10px 0 0; padding-left:18px; font-size:14px; color:#374151;">${rReasons.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ul>` : ""}
          </div>
        `;
      }

      // Build other losers
      let losersHtml = "";
      const losers = (summary.losers || []).filter(l => l.name !== summary.runnerUp?.contractor && l.name !== summary.runnerUp?.label);
      if (losers.length > 0) {
        losersHtml = losers.map(l => `
          <div style="padding:12px 16px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-weight:600;">${escapeHtml(l.name)}</span>
              <span style="font-size:13px; color:var(--muted, #6b7280); margin-left:8px;">${l.score}/100</span>
            </div>
            ${l.reasons?.[0] ? `<span style="font-size:13px; color:var(--muted, #6b7280);">${escapeHtml(l.reasons[0])}</span>` : ""}
          </div>
        `).join("");
      }

      root.innerHTML = `
        <div style="max-width:800px; margin:40px auto; padding:0 24px;">

          <div style="padding:28px; background:${winnerBg}; border:2px solid ${winnerBorder}; border-radius:16px; margin:0 0 16px; text-align:center;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:${winnerColor}; margin:0 0 8px;">
              ${softened ? "Current leader" : "Comparison winner"}
            </div>
            <div style="font-size:32px; font-weight:800; line-height:1.1; margin:0 0 12px; color:#111827;">
              ${winnerTitle}
            </div>
            <div style="display:flex; justify-content:center; gap:24px; flex-wrap:wrap; margin:0 0 16px;">
              <div>
                <div style="font-size:28px; font-weight:700;">${safeFormatCurrency(w.total)}</div>
                <div style="font-size:12px; color:var(--muted, #6b7280);">Quoted price</div>
              </div>
              <div>
                <div style="font-size:28px; font-weight:700;">${w.comparisonScore || 0}<span style="font-size:16px; font-weight:400; color:var(--muted, #6b7280);">/100</span></div>
                <div style="font-size:12px; color:var(--muted, #6b7280);">Score</div>
              </div>
            </div>

            ${warnings.length > 0 ? `
              <div style="padding:12px 16px; background:#fff7ed; border:1px solid #fdba74; border-radius:10px; margin:0 0 16px; text-align:left; font-size:14px; color:#9a3412;">
                ${warnings.map(w => `<div>${escapeHtml(w)}</div>`).join("")}
              </div>
            ` : ""}

            ${reasons.length > 0 ? `
              <div style="text-align:left; margin:0 0 4px;">
                <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:${winnerColor}; margin:0 0 8px;">Why this quote won</div>
                <ul style="margin:0; padding-left:18px; font-size:14px; color:#374151;">
                  ${reasons.map(r => `<li style="margin-bottom:4px;">${escapeHtml(r)}</li>`).join("")}
                </ul>
              </div>
            ` : ""}

            ${mid > 0 ? `<div style="margin-top:12px; font-size:13px; color:var(--muted, #6b7280);">Expected midpoint for this market: ${safeFormatCurrency(mid)}</div>` : ""}
          </div>

          ${runnerUpHtml}
          ${losersHtml}

          <div style="padding:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; margin:0 0 16px;">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px; font-size:14px; color:#374151;">
              <div>Spread: <strong>${safeFormatCurrency(spread)}</strong> (${Number(spreadPct).toFixed(0)}%)</div>
              <div>Quotes compared: <strong>${sortedQuotes.length}</strong></div>
            </div>
          </div>

          <div class="action-buttons" style="margin:20px 0;">
            <button class="btn" onclick="copyComparisonWinnerSummary()">Copy winner summary</button>
            <button class="btn secondary" onclick="showCompareScreen()">Edit quotes</button>
            <button class="btn secondary" onclick="setJourneyStep('result')">Back to result</button>
          </div>
        </div>
      `;
    }

    window.copyComparisonWinnerSummary = function copyComparisonWinnerSummary() {
      const summary = latestAnalysis?.comparisonSummary;
      if (!summary) return;
      const text = typeof buildComparisonWinnerText === "function" ? buildComparisonWinnerText(summary) : "";
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          alert("Winner summary copied to clipboard.");
        }).catch(() => {
          prompt("Copy this text:", text);
        });
      } else if (text) {
        prompt("Copy this text:", text);
      }
    };

    function compareQuotes() {
      track("compare_quotes_started", {
        hasPrimaryAnalysis: !!latestAnalysis
      });
      const output = byId("comparisonOutput");
      if (!output) return;

      const primaryRaw = buildPrimaryComparisonQuote();

      if (!primaryRaw.total || primaryRaw.total <= 0) {
        output.innerHTML = "Upload and analyze your first quote before comparing.";
        return;
      }

      const secondManualName = (byId("secondContractorName")?.value || "").trim();
      const secondManualPrice = byId("secondQuotePrice")?.value || "";

      const thirdManualName = (byId("thirdContractorName")?.value || "").trim();
      const thirdManualPrice = byId("thirdQuotePrice")?.value || "";

      const secondRaw = buildComparisonQuoteFromUpload(
        secondParsed,
        secondManualName,
        secondManualPrice,
        "Quote 2"
      );

      const thirdRaw = buildComparisonQuoteFromUpload(
        thirdParsed,
        thirdManualName,
        thirdManualPrice,
        "Quote 3"
      );

      const quotes = [
        normalizeComparisonQuote(primaryRaw, "Quote 1")
      ];

      if (secondParsed || secondManualName || secondManualPrice) {
        quotes.push(normalizeComparisonQuote(secondRaw, "Quote 2"));
      }

      if (thirdParsed || thirdManualName || thirdManualPrice) {
        quotes.push(normalizeComparisonQuote(thirdRaw, "Quote 3"));
      }

      const validQuotes = quotes.filter(q => q && q.isValid);
      const partialQuotes = quotes.filter(q => q && q.isPartial);

      track("compare_quotes_ready_state", {
        totalQuotesEntered: quotes.length,
        validQuotes: validQuotes.length
      });

      if (partialQuotes.length > 0) {
        console.warn("TruePrice compare: partial quotes excluded from comparison", partialQuotes);
      }

      if (validQuotes.length < 2) {
        output.innerHTML = "Add at least one more quote manually or via upload to compare.";
        return;
      }

      validQuotes.forEach(q => {
        q.pricePerSqFt =
          q.roofSize && q.roofSize > 0
            ? q.total / q.roofSize
            : null;
      });

      const lowest = [...validQuotes].sort((a, b) => a.total - b.total)[0];
      const highest = [...validQuotes].sort((a, b) => b.total - a.total)[0];
      const spread = highest.total - lowest.total;
      const spreadPct = lowest.total > 0 ? (spread / lowest.total) * 100 : 0;

      track("compare_quotes_completed", {
        validQuotes: validQuotes.length,
        lowestTotal: lowest.total,
        highestTotal: highest.total,
        spread,
        spreadPct: Number(spreadPct.toFixed(1))
      });

      const scoredQuotes = validQuotes.map(q => {
        const breakdown =
          q.comparisonBreakdown || scoreComparisonQuote(q, latestAnalysis);

        return {
          ...q,
          comparisonBreakdown: breakdown,
          comparisonScore: breakdown.totalScore
        };
      });

      const sortedQuotes = [...scoredQuotes].sort((a, b) => {
        if ((b.comparisonScore || 0) !== (a.comparisonScore || 0)) {
          return (b.comparisonScore || 0) - (a.comparisonScore || 0);
        }

        const aMidDistance = Math.abs((Number(a.total) || 0) - (Number(latestAnalysis?.mid) || 0));
        const bMidDistance = Math.abs((Number(b.total) || 0) - (Number(latestAnalysis?.mid) || 0));

        if (aMidDistance !== bMidDistance) {
          return aMidDistance - bMidDistance;
        }

        return (Number(a.total) || 0) - (Number(b.total) || 0);
      });

      const comparisonSummary = buildComparisonWinnerSummary(scoredQuotes, latestAnalysis);
      const winningLabel = getWinningComparisonLabel(comparisonSummary);
      
      if (latestAnalysis) {
        latestAnalysis.comparisonSummary = comparisonSummary;
      }

      // Render winner-first result screen into #appRoot
      renderComparisonResultScreen(comparisonSummary, sortedQuotes, spread, spreadPct);

      // Also try legacy render for backward compat
      if (output) {
        renderComparisonResults({
          output,
          sortedQuotes,
          comparisonSummary,
          winningLabel,
          lowest,
          highest,
          spread,
          spreadPct
        });
      }
    }

    function resetAnalyzer() {
      track("reset_clicked", {
        hadAnalysis: !!latestAnalysis,
        hadParsedQuote: !!latestParsed
      });
      const analysisOutput = byId("analysisOutput");
      const aiOutput = byId("aiAnalysisOutput");
      const analysisPanels = byId("analysisPanels");
      const parsedSignalSection = byId("parsedSignalSection");
      const comparisonOutput = byId("comparisonOutput");
      const inlineShareReportOutput = byId("inlineShareReportOutput");
      const inlineShareCopyStatus = byId("inlineShareCopyStatus");

      if (analysisOutput) {
        analysisOutput.innerHTML =
          "Upload a roofing quote above or enter values manually to analyze the quote.";
      }

      if (aiOutput) {
        aiOutput.innerHTML =
          "Run the quote analysis to receive an expert explanation.";
      }

      if (analysisPanels) analysisPanels.innerHTML = "";
      if (parsedSignalSection) parsedSignalSection.innerHTML = "";
      if (comparisonOutput) {
        comparisonOutput.innerHTML = "Enter additional quotes to compare against the analyzed quote above.";
      }
      if (inlineShareReportOutput) inlineShareReportOutput.innerHTML = "";
      if (inlineShareCopyStatus) inlineShareCopyStatus.innerHTML = "";

      [ 
        "streetAddress",
        "zipCode",
        "cityName",
        "stateCode",
        "roofSize",
        "quotePrice",
        "warrantyYears",
        "secondQuotePrice",
        "thirdQuotePrice",
        "secondContractorName",
        "thirdContractorName",
        "leadName",
        "leadEmail",
        "leadPhone",
        "leadZip"
      ].forEach(id => {
        const el = byId(id);
        if (el) el.value = "";
      });

      ["secondQuoteFile", "thirdQuoteFile", "quoteFile"].forEach(id => {
        const el = byId(id);
        if (el) el.value = "";
      });

      ["secondQuoteUploadStatus", "thirdQuoteUploadStatus"].forEach(id => {
        const el = byId(id);
        if (el) el.innerText = "";
      });

      const materialType = byId("materialType");
      if (materialType) materialType.value = "architectural";

      const complexityFactor = byId("complexityFactor");
      if (complexityFactor) complexityFactor.value = "1.00";

      const tearOffIncluded = byId("tearOffIncluded");
      if (tearOffIncluded) tearOffIncluded.value = "1.00";

      latestParsed = null;
      latestSmartQuote = null;
      latestAnalysis = null;
      latestExtractedText = "";
      secondParsed = null;
      thirdParsed = null;

      clearManualFieldHighlights();
      setUploadStatus("Ready to analyze PDF or image uploads.", "info");
    }

    function showLeadPlaceholder() {
      const output = byId("leadPlaceholderOutput");
      if (!output) return;
      output.innerHTML =
        "Lead capture is a placeholder for now. In the future this will route homeowners to fair-pricing contractors.";
    }

    function bindComparisonUploadInputs() {
      const secondFileInput = byId("secondQuoteFile");
      const thirdFileInput = byId("thirdQuoteFile");

      if (secondFileInput && !secondFileInput.dataset.bound) {
        secondFileInput.addEventListener("change", async function (event) {
          const file = event.target?.files?.[0];
          if (!file || typeof parseUploadedComparisonFile !== "function") return;

          const statusEl = byId("secondQuoteUploadStatus");

          try {
            if (statusEl) statusEl.innerText = "Parsing uploaded quote...";
            const parsedBundle = await parseUploadedComparisonFile(file);
            secondParsed = parsedBundle;

            const parsed = parsedBundle?.parsed || {};
            const inferredName = inferContractorNameFromParsed(parsed, parsedBundle?.fileName);
            const inferredPrice = getParsedComparisonPrice(parsed);

            const secondNameEl = byId("secondContractorName");
            const secondPriceEl = byId("secondQuotePrice");

            if (secondNameEl && inferredName && !secondNameEl.value.trim()) {
              secondNameEl.value = inferredName;
            }

            if (secondPriceEl && inferredPrice && !secondPriceEl.value) {
              secondPriceEl.value = inferredPrice;
            }

            if (statusEl) {
              statusEl.innerText = inferredPrice
                ? "Upload parsed successfully."
                : "Upload parsed, but price was not confidently detected.";
            }
          } catch (error) {
            console.error(error);
            if (statusEl) statusEl.innerText = "Could not parse this upload.";
          }
        });

        secondFileInput.dataset.bound = "true";
      }

      if (thirdFileInput && !thirdFileInput.dataset.bound) {
        thirdFileInput.addEventListener("change", async function (event) {
          const file = event.target?.files?.[0];
          if (!file || typeof parseUploadedComparisonFile !== "function") return;

          const statusEl = byId("thirdQuoteUploadStatus");

          try {
            if (statusEl) statusEl.innerText = "Parsing uploaded quote...";
            const parsedBundle = await parseUploadedComparisonFile(file);
            thirdParsed = parsedBundle;

            const parsed = parsedBundle?.parsed || {};
            const inferredName = inferContractorNameFromParsed(parsed, parsedBundle?.fileName);
            const inferredPrice = getParsedComparisonPrice(parsed);

            const thirdNameEl = byId("thirdContractorName");
            const thirdPriceEl = byId("thirdQuotePrice");

            if (thirdNameEl && inferredName && !thirdNameEl.value.trim()) {
              thirdNameEl.value = inferredName;
            }

            if (thirdPriceEl && inferredPrice && !thirdPriceEl.value) {
              thirdPriceEl.value = inferredPrice;
            }

            if (statusEl) {
              statusEl.innerText = inferredPrice
                ? "Upload parsed successfully."
                : "Upload parsed, but price was not confidently detected.";
            }
          } catch (error) {
            console.error(error);
            if (statusEl) statusEl.innerText = "Could not parse this upload.";
          }
        });

        thirdFileInput.dataset.bound = "true";
      }
    }
    
    function mountExistingAnalyzer(targetId) {
      const target = document.getElementById(targetId);
      if (!target) return;

      target.innerHTML = `
         <div class="panel" style="margin:0 0 14px;">
          <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#475569;">
            Quote upload
          </p>
          <h3 style="margin:0 0 10px; font-size:24px; line-height:1.15; color:#0f172a;">
            Upload your quote
          </h3>
          <p class="small muted" style="margin:0 0 12px;">
            We’ll extract pricing, estimate roof size if needed, and give you a decision.
          </p>
          </h3>
          <p class="small muted" style="margin:0 0 12px;">
            We’ll extract pricing, estimate roof size if needed, and give you a decision.
          </p>

          <div style="margin:0 0 14px; padding:14px 16px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 6px;">
              <div class="small muted" style="font-size:13px; font-weight:600;">
                Estimated roof size
              </div>

              <button
                type="button"
                class="btn btn-ghost"
                id="editRoofSizeBtn"
                style="padding:4px 8px; min-width:auto; font-size:13px;"
              >
                Edit
              </button>
            </div>

            <div id="estimatedRoofSizeDisplay" style="font-size:30px; line-height:1.1; font-weight:800; color:#111827; margin:0 0 4px;">
              --
            </div>

            <div id="estimatedRoofSizeHint" class="small muted" style="font-size:13px;">
              We’ll use this unless you change it.
            </div>

            <div id="roofSizeInlineEditor" style="display:none; margin-top:12px;">
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                <input
                  id="inlineRoofSizeInput"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 2400"
                  style="max-width:160px;"
                />
                <span class="small muted">sq ft</span>
                <button type="button" class="btn secondary" id="saveRoofSizeBtn">Save</button>
                <button type="button" class="btn btn-ghost" id="cancelRoofSizeBtn">Cancel</button>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin:0 0 12px;">
            <input
              id="quoteFile"
              type="file"
              accept=".pdf,image/*"
              style="max-width:320px;"
            />
            <button
              type="button"
              class="btn secondary"
              id="scanQuoteBtn"
              disabled
              style="opacity:0.5; cursor:not-allowed;"
            >
              Scan quote →
            </button>
          </div>
        </div>
        <div id="uploadStatus" class="upload-status info" style="margin:0 0 12px; background:#eff6ff; border-color:#93c5fd;">
          Upload your quote to get started, or enter your price below.
        </div>

        <div id="inlineAnalyzingState"></div>

        <details id="manualEntryDetails" style="margin:0 0 14px;">
          <summary style="cursor:pointer; font-weight:700; margin:0 0 10px;">Manual quote entry</summary>

          <div id="manualFieldJumpStatus"></div>

          <div class="analysis-grid" style="margin-top:12px;">
            <div>
              <label for="quotePrice"><strong>Quote price</strong></label>
              <input id="quotePrice" type="number" min="0" step="1" placeholder="e.g. 12000" />
            </div>

            <div>
              <label for="roofSize"><strong>Roof size</strong> <span id="roofSizePriorityCue" style="color:#c2410c;"></span></label>
              <input id="roofSize" type="number" min="0" step="1" placeholder="e.g. 2200" />
            </div>

            <div>
              <label for="materialType"><strong>Material</strong></label>
              <select id="materialType">
                <option value="architectural">Architectural shingles</option>
                <option value="asphalt">Asphalt shingles</option>
                <option value="metal">Metal roofing</option>
                <option value="tile">Tile roofing</option>
              </select>
            </div>

            <div>
              <label for="complexityFactor"><strong>Complexity</strong></label>
              <select id="complexityFactor">
                <option value="1.00">Standard</option>
                <option value="1.08">Moderate</option>
                <option value="1.15">Complex</option>
              </select>
            </div>

            <div>
              <label for="tearOffIncluded"><strong>Tear off</strong></label>
              <select id="tearOffIncluded">
                <option value="1.00">Unknown</option>
                <option value="1.05">Included</option>
                <option value="0.97">Not included</option>
              </select>
            </div>

            <div>
              <label for="warrantyYears"><strong>Warranty years</strong></label>
              <input id="warrantyYears" type="number" min="0" step="1" placeholder="e.g. 25" />
            </div>

            <div>
              <label for="cityName"><strong>City</strong></label>
              <input id="cityName" type="text" placeholder="e.g. Dallas" />
            </div>

            <div>
              <label for="stateCode"><strong>State</strong></label>
              <input id="stateCode" type="text" maxlength="2" placeholder="e.g. TX" />
            </div>

            <div>
              <label for="streetAddress"><strong>Street address</strong></label>
              <input id="streetAddress" type="text" placeholder="123 Main St" />
            </div>

            <div>
              <label for="zipCode"><strong>ZIP code</strong></label>
              <input id="zipCode" type="text" placeholder="75201" />
            </div>
          </div>
        </details>

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin:0 0 14px;">
          <button type="button" class="btn secondary" id="resetAnalyzerBtn">Reset</button>
        </div>

        <div id="analysisOutput"></div>
        <div id="aiAnalysisOutput"></div>
        <div id="analysisPanels"></div>
        <div id="parsedSignalSection"></div>
        <div id="comparisonOutput"></div>
          <div id="inlineShareReportOutput"></div>
          <div id="inlineShareCopyStatus"></div>
          <div id="leadPlaceholderOutput"></div>
        `;

        const street = journeyState?.propertyPreview?.street || "";
        const apt = journeyState?.propertyPreview?.apt || "";
        const city = journeyState?.propertyPreview?.city || "";
        const state = journeyState?.propertyPreview?.state || "";
        const zip = journeyState?.propertyPreview?.zip || "";

        const streetInput = document.getElementById("streetAddress");
        const cityInput = document.getElementById("cityName");
        const stateInput = document.getElementById("stateCode");
        const zipInput = document.getElementById("zipCode");

        if (streetInput && !streetInput.value) {
          streetInput.value = [street, apt].filter(Boolean).join(" ");
        }
        if (cityInput && !cityInput.value) {
          cityInput.value = city;
        }
        if (stateInput && !stateInput.value) {
          stateInput.value = state;
        }
        if (zipInput && !zipInput.value) {
          zipInput.value = zip;
        }

        const roofSizeDisplayEl = document.getElementById("estimatedRoofSizeDisplay");
        const roofSizeHintEl = document.getElementById("estimatedRoofSizeHint");
        const editRoofSizeBtn = document.getElementById("editRoofSizeBtn");
        const roofSizeInlineEditor = document.getElementById("roofSizeInlineEditor");
        const inlineRoofSizeInput = document.getElementById("inlineRoofSizeInput");
        const saveRoofSizeBtn = document.getElementById("saveRoofSizeBtn");
        const cancelRoofSizeBtn = document.getElementById("cancelRoofSizeBtn");
        const roofSizeInput = document.getElementById("roofSize");

        const inferredRoofSize =
          Number(latestAnalysis?.roofSize || 0) > 0
            ? Number(latestAnalysis.roofSize)
            : Number(latestAnalysis?.roofSizeEstimate || 0) > 0
              ? Number(latestAnalysis.roofSizeEstimate)
              : Number(roofSizeInput?.value || 0) > 0
                ? Number(roofSizeInput.value)
                : 0;

        if (roofSizeDisplayEl) {
          roofSizeDisplayEl.textContent = inferredRoofSize > 0
            ? `${safeFormatNumber(Math.round(inferredRoofSize))} sq ft`
            : "Not available";
        }

        if (roofSizeHintEl) {
          roofSizeHintEl.textContent = inferredRoofSize > 0
            ? "We’ll use this unless you change it."
            : "Add roof size manually if you want to improve accuracy.";
        }

        if (roofSizeInput && inferredRoofSize > 0 && !roofSizeInput.value) {
          roofSizeInput.value = String(Math.round(inferredRoofSize));
        }

        if (editRoofSizeBtn && roofSizeInlineEditor && inlineRoofSizeInput && roofSizeInput) {
          if (editRoofSizeBtn.dataset.bound !== "true") {
            editRoofSizeBtn.addEventListener("click", function () {
              const currentValue = Number(roofSizeInput.value || inferredRoofSize || 0);
              inlineRoofSizeInput.value = currentValue > 0 ? String(Math.round(currentValue)) : "";
              roofSizeInlineEditor.style.display = "block";
              inlineRoofSizeInput.focus();
              if (typeof inlineRoofSizeInput.select === "function") {
                inlineRoofSizeInput.select();
              }
            });

            editRoofSizeBtn.dataset.bound = "true";
          }

          if (saveRoofSizeBtn && saveRoofSizeBtn.dataset.bound !== "true") {
            saveRoofSizeBtn.addEventListener("click", function () {
              const newValue = Number(inlineRoofSizeInput.value || 0);
              if (!newValue || newValue <= 0) return;

              roofSizeInput.value = String(Math.round(newValue));
              roofSizeInput.dataset.source = "user_input";
              roofSizeInput.dataset.confidence = "high";

              if (roofSizeDisplayEl) {
                roofSizeDisplayEl.textContent = `${safeFormatNumber(Math.round(newValue))} sq ft`;
              }

              if (roofSizeHintEl) {
                roofSizeHintEl.textContent = "Using your edited roof size.";
              }

              roofSizeInlineEditor.style.display = "none";
            });

            saveRoofSizeBtn.dataset.bound = "true";
          }

          if (cancelRoofSizeBtn && cancelRoofSizeBtn.dataset.bound !== "true") {
            cancelRoofSizeBtn.addEventListener("click", function () {
              roofSizeInlineEditor.style.display = "none";
            });

            cancelRoofSizeBtn.dataset.bound = "true";
          }
        }
        const fileInput = document.getElementById("quoteFile");
        const scanBtn = document.getElementById("scanQuoteBtn");

        const uploadBtn = document.getElementById("uploadQuoteBtn");

      if (uploadBtn && fileInput && !uploadBtn.dataset.bound) {
          console.log("BINDING UPLOAD BTN", uploadBtn);  // ✅ INSERT HERE
          uploadBtn.addEventListener("click", () => {
          console.log("UPLOAD BUTTON CLICKED");  // ✅ INSERT HERE
          fileInput.click();
        });

        fileInput.addEventListener("change", async function () {
          const file = fileInput.files?.[0];
          if (!file) return;

          console.log("UPLOAD TRIGGERED"); // 🔥 sanity check

          // Immediate UI
          setJourneyStep("analyze");

          setTimeout(() => {
            setSmartUploadStatus("upload", 10);
            renderInlineAnalyzingState(10, "Uploading your quote…");
          }, 0);

          try {
            const parsedBundle = await parseUploadedComparisonFile(file);
            const parsed = parsedBundle?.parsed || parsedBundle || {};

            latestParsed = parsed;

            setSmartUploadStatus("extract", 40);
            renderInlineAnalyzingState(40, "Extracting text from your quote…");

            setTimeout(() => {
              setSmartUploadStatus("identify", 65);
              renderInlineAnalyzingState(65, "Identifying key details…");
            }, 200);

            if (shouldPromoteAddress(latestParsed)) {
              journeyState.propertyPreview = {
                street: latestParsed.address?.street || "",
                apt: "",
                city: latestParsed.city || latestParsed.address?.city || "",
                state: latestParsed.stateCode || latestParsed.address?.stateCode || "",
                zip: latestParsed.address?.zip || ""
              };

              journeyState.propertyConfirmed = false;
              setJourneyStep("confirm");
              return;
            }

            setTimeout(() => {
              copyParsedToForm();
            }, 0);

            setTimeout(async () => {
              setSmartUploadStatus("analyze", 85);
              renderInlineAnalyzingState(85, "Analyzing pricing…");
              await analyzeQuote();
            }, 400);

          } catch (err) {
            console.error(err);
            setUploadStatus("Could not read the uploaded quote.", "error");
          }
        });

        uploadBtn.dataset.bound = "true";
        fileInput.dataset.bound = "true";
      }

        if (fileInput && scanBtn && fileInput.dataset.bound !== "true") {
          fileInput.addEventListener("change", function () {
            const hasFile = !!fileInput.files?.length;

            scanBtn.disabled = !hasFile;
            scanBtn.style.opacity = hasFile ? "1" : "0.5";
            scanBtn.style.cursor = hasFile ? "pointer" : "not-allowed";
          });

          fileInput.dataset.bound = "true";
        }

        if (scanBtn && scanBtn.dataset.bound !== "true") {
          scanBtn.addEventListener("click", async function () {
            const file = fileInput?.files?.[0];
            if (!file) return;

            try {
              setSmartUploadStatus("upload", 10);

              if (typeof parseUploadedComparisonFile === "function") {
                const parsedBundle = await parseUploadedComparisonFile(file);
                const parsed = parsedBundle?.parsed || parsedBundle || {};

                latestParsed = parsed;
                copyParsedToForm();

                // ---- PROMOTE PARSED ADDRESS INTO JOURNEY STATE ----
                if (parsed?.address) {
                  const addr = parsed.address;

                  const hasAddress =
                    addr.street && (addr.city || addr.zip) && addr.stateCode;

                  if (hasAddress) {
                    journeyState.propertyPreview = {
                      street: addr.street || "",
                      apt: "",
                      city: addr.city || "",
                      state: addr.stateCode || "",
                      zip: addr.zip || ""
                    };

                    journeyState.propertyConfirmed = true;
                  }
                }

                const hasPromotedAddress =
                  !!journeyState.propertyPreview?.street &&
                  (!!journeyState.propertyPreview?.city || !!journeyState.propertyPreview?.zip) &&
                  !!journeyState.propertyPreview?.state;

                if (hasPromotedAddress) {
                  setJourneyStep("confirm");
                  return;
                }

                setJourneyStep("address");
                return;
              }

              setUploadStatus("Quote upload parser is not available yet.", "error");
            } catch (err) {
              console.error(err);
              setUploadStatus("Could not read the uploaded quote.", "error");
            }
          });

          scanBtn.dataset.bound = "true";
        }
        const resetBtn = document.getElementById("resetAnalyzerBtn");
        if (resetBtn && resetBtn.dataset.bound !== "true") {
          resetBtn.addEventListener("click", function () {
            resetAnalyzer();
          });
          resetBtn.dataset.bound = "true";
        }

        bindRenderedAnalysisUi();
        initAnalyzerUI();
      }
     

      function initAnalyzerUI() {
        bindComparisonUploadInputs();

        if (typeof injectComparisonFieldHints === "function") {
          injectComparisonFieldHints();
        }

        setTimeout(() => {
          const btn = document.getElementById("uploadQuoteBtn");
          const input = document.getElementById("quoteFile");

          if (btn && input && !input.dataset.bound) {
            btn.addEventListener("click", () => input.click());

            input.addEventListener("change", async function () {
              const file = input.files?.[0];
              if (!file) return;

              // 🔥 IMMEDIATE UI RESPONSE
              setJourneyStep("analyze");

              setTimeout(() => {
                setSmartUploadStatus("upload", 10);
                renderInlineAnalyzingState(10, "Uploading your quote…");
              }, 0);

              try {
                // 🔥 START PARSING AFTER UI IS VISIBLE
                const parsedBundle = await parseUploadedComparisonFile(file);
                const parsed = parsedBundle?.parsed || parsedBundle || {};

                latestParsed = parsed;

                // 🔥 PROGRESS UPDATE
                setSmartUploadStatus("extract", 40);
                renderInlineAnalyzingState(40, "Extracting text from your quote…");

                setTimeout(() => {
                  setSmartUploadStatus("identify", 65);
                  renderInlineAnalyzingState(65, "Identifying key details…");
                }, 200);

                // ADDRESS ROUTING — save address but skip confirm screen
                if (shouldPromoteAddress(latestParsed)) {
                  journeyState.propertyPreview = {
                    street: latestParsed.address?.street || "",
                    apt: "",
                    city: latestParsed.city || latestParsed.address?.city || "",
                    state: latestParsed.stateCode || latestParsed.address?.stateCode || "",
                    zip: latestParsed.address?.zip || ""
                  };
                }

                // 🔥 ENSURE FORM EXISTS BEFORE POPULATING
                setTimeout(() => {
                  copyParsedToForm();
                }, 0);

                // 🔥 FINAL STEP → ANALYZE
                setTimeout(async () => {
                  setSmartUploadStatus("analyze", 85);
                  renderInlineAnalyzingState(85, "Analyzing pricing…");
                  await analyzeQuote();
                }, 400);

              } catch (err) {
                console.error(err);
                setUploadStatus("Could not read the uploaded quote.", "error");
              }
            });

            btn.dataset.bound = "true";
            input.dataset.bound = "true";
          }
        }, 0);
      }

    function bindRenderedAnalysisUi() {
      bindRoofSizeSuggestionActions(latestAnalysis);
      bindPrimaryCtaActions(latestAnalysis);
      bindContractorQuestionsActions();
      bindRoofCalculatorActions();
      renderRoofCalculatorOutput();
    }

    window.__tpDebug = {
      setLatestParsed(value) {
        latestParsed = value;
      },
      getLatestParsed() {
        return latestParsed;
      },
      getLatestAnalysis() {
        return latestAnalysis;
      },
      softenVerdictForRoofSizeTrust,
      getVerdictTrustNote,
      getTrackingEvents,
      clearTrackingEvents,
      getTrackingSession
    };

    window.showNegotiateScreen = function showNegotiateScreen() {
      const root = document.getElementById("appRoot");
      if (!root) return;

      const questions = typeof buildContractorQuestions === "function"
        ? buildContractorQuestions(latestAnalysis)
        : [];

      const a = latestAnalysis || {};
      const verdictSummary = `${safeFormatCurrency(a.quotePrice)} | ${a.verdict || "Unknown"} | ${a.city || ""}${a.stateCode ? ", " + a.stateCode : ""}`;

      root.innerHTML = `
        <div style="max-width:800px; margin:40px auto; padding:0 24px;">
          <div style="font-size:13px; color:var(--muted, #6b7280); margin-bottom:16px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
            ${escapeHtml(verdictSummary)}
          </div>
          <h2 style="margin:0 0 16px; font-size:24px;">Questions for your contractor</h2>
          ${questions.length > 0 ? `
            <ol class="action-questions">
              ${questions.map((q, i) => `<li><strong>Q${i + 1}</strong>${escapeHtml(q)}</li>`).join("")}
            </ol>
          ` : "<p>No specific questions generated for this analysis.</p>"}
          <div class="action-buttons" style="margin-top:20px;">
            <button class="btn" onclick="copyContractorQuestions()">Copy questions</button>
            <button class="btn secondary" onclick="setJourneyStep('result')">Back to result</button>
          </div>
        </div>
      `;
    }

    window.showCompareScreen = function showCompareScreen() {
      const root = document.getElementById("appRoot");
      if (!root) return;

      const a = latestAnalysis || {};
      const parsed = latestParsed || {};
      const contractor1 = (typeof inferContractorNameFromParsed === "function" ? inferContractorNameFromParsed(parsed) : "") || "Your quote";
      const price1 = a.quotePrice ? safeFormatCurrency(a.quotePrice) : "Not set";
      const material1 = (typeof getMaterialLabel === "function" && a.material) ? getMaterialLabel(a.material) : (a.material || "Unknown");

      root.innerHTML = `
        <div style="max-width:800px; margin:40px auto; padding:0 24px;">
          <h2 style="margin:0 0 8px; font-size:28px;">Compare your quotes</h2>
          <p style="color:var(--muted, #6b7280); margin:0 0 24px;">Add competing bids below. We'll score each quote and pick a winner.</p>

          <div style="padding:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; margin:0 0 24px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted, #6b7280); margin:0 0 6px;">Your analyzed quote</div>
            <div style="display:flex; gap:24px; flex-wrap:wrap; align-items:baseline;">
              <div style="font-size:22px; font-weight:700;">${escapeHtml(price1)}</div>
              <div style="font-size:14px; color:var(--muted, #6b7280);">${escapeHtml(contractor1)}</div>
              <div style="font-size:14px; color:var(--muted, #6b7280);">${escapeHtml(material1)}</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin:0 0 24px;">
            <div style="padding:20px; border:1px solid #e2e8f0; border-radius:12px;">
              <div style="font-size:14px; font-weight:700; margin:0 0 12px;">Quote 2</div>
              <input id="secondContractorName" type="text" placeholder="Contractor name" style="width:100%; padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; margin:0 0 8px;">
              <input id="secondQuotePrice" type="number" placeholder="Total price (e.g. 14500)" style="width:100%; padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px;">
              <div style="margin-top:10px;">
                <input id="secondQuoteFile" type="file" accept=".pdf,image/*" style="font-size:13px;">
                <small id="secondQuoteUploadStatus" style="display:block; margin-top:4px; color:var(--muted, #6b7280); font-size:12px;"></small>
              </div>
            </div>
            <div style="padding:20px; border:1px solid #e2e8f0; border-radius:12px;">
              <div style="font-size:14px; font-weight:700; margin:0 0 12px;">Quote 3 <span style="font-weight:400; color:var(--muted, #6b7280);">(optional)</span></div>
              <input id="thirdContractorName" type="text" placeholder="Contractor name" style="width:100%; padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; margin:0 0 8px;">
              <input id="thirdQuotePrice" type="number" placeholder="Total price (e.g. 16200)" style="width:100%; padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px; font-size:14px;">
              <div style="margin-top:10px;">
                <input id="thirdQuoteFile" type="file" accept=".pdf,image/*" style="font-size:13px;">
                <small id="thirdQuoteUploadStatus" style="display:block; margin-top:4px; color:var(--muted, #6b7280); font-size:12px;"></small>
              </div>
            </div>
          </div>

          <div id="comparisonOutput" style="margin-bottom:16px;"></div>

          <div class="action-buttons">
            <button class="btn" onclick="compareQuotes()">Compare and pick winner</button>
            <button class="btn secondary" onclick="setJourneyStep('result')">Back to result</button>
          </div>
        </div>
      `;
    }

    window.showShareScreen = function showShareScreen() {
      const root = document.getElementById("appRoot");
      if (!root) return;

      const a = window.__latestAnalysis || {};
      const parsed = latestParsed || {};
      const signals = parsed.signals || {};

      const contractor = parsed.contractor && parsed.contractor !== "Not detected" ? parsed.contractor : "";
      const city = a.city || "";
      const state = a.stateCode || "";
      const location = city && state ? city + ", " + state : city || "your area";
      const materialLabel = a.material && typeof getMaterialLabel === "function" ? getMaterialLabel(a.material) : a.material || "Unknown";
      const roofMeta = a?.meta?.roofSize || {};
      const roofSize = roofMeta?.value ?? a?.roofSize ?? null;
      const ppsf = roofSize > 0 ? (a.quotePrice / roofSize).toFixed(2) : null;
      const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      // Scope items
      const scopeItems = [
        { key: "tearOff", label: "Tear off" },
        { key: "underlayment", label: "Underlayment" },
        { key: "flashing", label: "Flashing" },
        { key: "iceShield", label: "Ice & water shield" },
        { key: "dripEdge", label: "Drip edge" },
        { key: "ventilation", label: "Ventilation" },
        { key: "ridgeVent", label: "Ridge vent" },
        { key: "starterStrip", label: "Starter strip" },
        { key: "ridgeCap", label: "Ridge cap" },
        { key: "decking", label: "Decking" }
      ];

      const foundItems = scopeItems.filter(i => scopeReviewState[i.key] || signals[i.key]?.status === "included");
      const missingItems = scopeItems.filter(i => !scopeReviewState[i.key] && signals[i.key]?.status !== "included");

      const scopeHtml = `
        <div class="report-scope-grid">
          ${foundItems.map(i => `<span class="report-scope-item report-scope-item--found">&#10003; ${escapeHtml(i.label)}</span>`).join("")}
          ${missingItems.map(i => `<span class="report-scope-item report-scope-item--missing">? ${escapeHtml(i.label)}</span>`).join("")}
        </div>
      `;

      // Delta
      const deltaFromMid = a.quotePrice - a.mid;
      const deltaAbs = Math.abs(deltaFromMid);
      const deltaDir = deltaFromMid > 0 ? "above" : "below";

      root.innerHTML = `
        <div class="report-container">
          <div class="report-card">
            <div class="report-header">
              <div class="tp-logo--report">TruePrice</div>
              <div class="report-header-meta">
                Quote Analysis Report<br>${escapeHtml(date)}
              </div>
            </div>

            <div class="report-body">

              <div class="report-section">
                <div class="report-section-title">Verdict</div>
                <div class="report-verdict">${escapeHtml(getVerdictHeadline(a.verdict))}</div>
                ${deltaAbs >= 100 ? `<div class="report-delta">${safeFormatCurrency(deltaAbs)} ${deltaDir} expected midpoint</div>` : ""}
              </div>

              <div class="report-section">
                <div class="report-section-title">Quote Details</div>
                <div class="report-stat-grid">
                  <div class="report-stat">
                    <div class="report-stat-label">Quote Price</div>
                    <div class="report-stat-value">${safeFormatCurrency(a.quotePrice)}</div>
                  </div>
                  <div class="report-stat">
                    <div class="report-stat-label">Expected Range</div>
                    <div class="report-stat-value">${safeFormatCurrency(a.low)} &ndash; ${safeFormatCurrency(a.high)}</div>
                  </div>
                  <div class="report-stat">
                    <div class="report-stat-label">Material</div>
                    <div class="report-stat-value">${escapeHtml(materialLabel)}</div>
                  </div>
                  <div class="report-stat">
                    <div class="report-stat-label">Roof Size</div>
                    <div class="report-stat-value">${roofSize ? Number(roofSize).toLocaleString() + " sq ft" : "Unknown"}</div>
                  </div>
                  ${ppsf ? `<div class="report-stat"><div class="report-stat-label">Price / Sq Ft</div><div class="report-stat-value">$${ppsf}</div></div>` : ""}
                  ${a.warrantyYears ? `<div class="report-stat"><div class="report-stat-label">Warranty</div><div class="report-stat-value">${escapeHtml(String(a.warrantyYears))} years</div></div>` : ""}
                </div>
              </div>

              ${contractor ? `
                <div class="report-section">
                  <div class="report-section-title">Contractor</div>
                  <div style="font-size:16px; font-weight:600;">${escapeHtml(contractor)}</div>
                  ${location !== "your area" ? `<div style="font-size:14px; color:var(--muted);">${escapeHtml(location)}</div>` : ""}
                </div>
              ` : ""}

              <div class="report-section">
                <div class="report-section-title">Scope Items</div>
                ${scopeHtml}
                ${missingItems.length > 0 ? `<div style="margin-top:10px; font-size:13px; color:#92400e;">${missingItems.length} item${missingItems.length > 1 ? "s" : ""} not confirmed in quote</div>` : `<div style="margin-top:10px; font-size:13px; color:#166534;">All scope items confirmed</div>`}
              </div>

              <div class="report-section">
                <div class="report-section-title">Market Context</div>
                <div style="font-size:14px; color:var(--text); line-height:1.6;">
                  ${location !== "your area" ? `Based on pricing data for ${escapeHtml(location)}. ` : ""}Expected midpoint for this roof: ${safeFormatCurrency(a.mid)}.
                  ${deltaAbs >= 100 ? ` This quote is ${safeFormatCurrency(deltaAbs)} ${deltaDir} the midpoint.` : " This quote is in line with expected pricing."}
                </div>
              </div>

            </div>

            <div class="report-footer">
              Generated by TruePrice &bull; truepricehq.com &bull; ${escapeHtml(date)}
            </div>
          </div>

          <div class="action-buttons report-actions" style="margin-top:20px; justify-content:center;">
            <button class="btn" onclick="copyShareableReportText()">Copy as text</button>
            <button class="btn secondary" onclick="window.print()">Print / Save PDF</button>
            <button class="btn secondary" onclick="setJourneyStep('result')">Back to result</button>
          </div>
        </div>
      `;
    }

    window.showDetailsScreen = function showDetailsScreen() {
      const output = document.getElementById("analysisOutput");
      if (!output) return;

      output.innerHTML = `
        <div>
          ${buildResultTrustHtml(latestAnalysis)}
          ${buildRiskFlagsHtml(latestAnalysis)}
          <button class="btn secondary" onclick="renderApp()">← Back</button>
        </div>
      `;
    }

    function getBrandFooterText() {
      return "Generated by TruePrice Roofing Quote Analyzer";
    }

    window.setUploadStatus = setUploadStatus;
    window.analyzeParsedText = analyzeParsedText;
    window.analyzeQuote = analyzeQuote;
    window.resetAnalyzer = resetAnalyzer;
    window.copyParsedToForm = copyParsedToForm;
    window.compareQuotes = compareQuotes;
    window.viewShareableResult = viewShareableResult;
    window.showLeadPlaceholder = showLeadPlaceholder;
    window.buildAIExplanation = buildAIExplanation;
    window.copyShareableReportText = copyShareableReportText;
    window.copyContractorQuestions = copyContractorQuestions;
    window.buildShareableReportData = buildShareableReportData;
    window.setSmartUploadStatus = setSmartUploadStatus;
    window.formatRoofSizeForDisplay = formatRoofSizeForDisplay;
    window.getBrandFooterText = getBrandFooterText; 
    window.initAnalyzerUI = initAnalyzerUI;
    window.bindRenderedAnalysisUi = bindRenderedAnalysisUi;
    window.renderComparisonResults = renderComparisonResults;
    window.renderShareableReport = renderShareableReport;
    window.renderAnalysisResultUi = renderAnalysisResultUi;
    window.mountExistingAnalyzer = mountExistingAnalyzer;
    
    window.renderApp = function renderApp() {
      const root = document.getElementById("appRoot");
      if (!root) return;
      console.log("renderApp running, current journey step:", journeyState.step);


      if (journeyState.step === "address") {
        root.innerHTML = renderAddressStep();

        // Bind upload button on the address step
        setTimeout(() => {
          const btn = document.getElementById("uploadQuoteBtn");
          const input = document.getElementById("quoteFile");
          if (btn && input && !btn.dataset.bound) {
            btn.dataset.bound = "true";
            btn.addEventListener("click", () => input.click());
            input.addEventListener("change", async function () {
              const file = input.files?.[0];
              if (!file) return;

              renderAnalyzingState();

              try {
                const parsedBundle = await parseUploadedComparisonFile(file);
                const parsed = parsedBundle?.parsed || parsedBundle || {};
                latestParsed = parsed;

                if (shouldPromoteAddress(latestParsed)) {
                  journeyState.propertyPreview = {
                    street: latestParsed.address?.street || "",
                    apt: "",
                    city: latestParsed.city || latestParsed.address?.city || "",
                    state: latestParsed.stateCode || latestParsed.address?.stateCode || "",
                    zip: latestParsed.address?.zip || ""
                  };
                }
                // Skip confirm screen — go straight to analysis
                journeyState.propertyConfirmed = true;
                confirmProperty();
              } catch (err) {
                console.error("Upload parse error:", err);
                journeyState.propertyConfirmed = true;
                confirmProperty();
              }
            });
          }
        }, 0);

        return;
      }

      if (journeyState.step === "confirm") {
        root.innerHTML = renderConfirmStep();
        return;
      }

      if (journeyState.step === "property_not_found") {
        root.innerHTML = renderPropertyNotFoundStep();
        return;
      }

      if (journeyState.step === "analyze") {
        root.innerHTML = renderAnalyzeStep();

        if (typeof mountExistingAnalyzer === "function") {
          setTimeout(() => {
            mountExistingAnalyzer("analyzeMount");
          }, 0);
        }

        return;
      }

      if (journeyState.step === "result") {
      console.log("renderApp entering RESULT branch");
      root.innerHTML = renderResultStep();
      return;
    }
    };

    window.renderAddressStep = function renderAddressStep() {
      const urlParams = new URLSearchParams(window.location.search);
      const prefillCity = urlParams.get("city") || "";
      const prefillState = urlParams.get("state") || "";
      const localContext = prefillCity && prefillState
        ? `<div style="margin:0 0 18px; padding:10px 14px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; font-size:14px; color:#166534; font-weight:500;">Showing local pricing for ${escapeHtml(prefillCity)}, ${escapeHtml(prefillState)}</div>`
        : "";

      return `
        <div class="journey-start">
          <div class="journey-start-card" style="max-width:720px; margin:48px auto; padding:30px; background:#ffffff; border:1px solid #e5e7eb; border-radius:24px; box-shadow:0 10px 30px rgba(15,23,42,0.06);">

            ${localContext}

            <h1 style="margin:0 0 10px; font-size:38px; line-height:1.05; letter-spacing:-0.03em; color:#0f172a;">
              Is your roofing quote fair?
            </h1>

            <p class="muted" style="margin:0 0 24px; font-size:16px;">
              Upload your quote. Get your answer in 30 seconds. Free, private, no signup.
            </p>

            <!-- PRIMARY: UPLOAD -->
            <div style="border:2px solid #bfdbfe; border-radius:18px; padding:28px; text-align:center; margin:0 0 24px; background:#f8fbff;">

              <div style="font-size:22px; font-weight:700; margin-bottom:8px; color:#0f172a;">
                Upload your roofing quote
              </div>

              <div class="small muted" style="margin-bottom:16px;">
                PDF, screenshot, or phone photo
              </div>

              <input
                id="quoteFile"
                type="file"
                accept=".pdf,image/*"
                style="display:none;"
              />

              <button
                type="button"
                class="btn"
                id="uploadQuoteBtn"
                style="font-size:16px; padding:14px 28px;"
              >
                Upload quote
              </button>

              <div class="small muted" style="margin-top:12px; font-size:12px;">
                Private &bull; No spam &bull; No signup
              </div>
            </div>

            <!-- SECONDARY: ADDRESS -->
            <div style="border-top:1px solid #e5e7eb; padding-top:18px;">

              <p class="small muted" style="margin:0 0 12px;">
                No quote handy? Enter your address instead:
              </p>

              <div class="journey-address-grid">
                <div class="journey-address-full">
                  <input id="journeyStreetAddress" type="text" placeholder="Street address" />
                </div>

                <div>
                  <input id="journeyCity" type="text" placeholder="City" value="${escapeHtml(prefillCity)}" />
                </div>

                <div>
                  <input id="journeyState" type="text" maxlength="2" placeholder="State" value="${escapeHtml(prefillState)}" />
                </div>

                <div>
                  <input id="journeyZipCode" type="text" placeholder="ZIP code" />
                </div>
              </div>

              <button class="btn secondary" style="margin-top:12px;" onclick="handleAddressSubmit()">
                Check my property →
              </button>

              <div id="journeyAddressError" class="small" style="margin-top:10px; color:#b91c1c;"></div>
            </div>

          </div>
        </div>
      `;
    };

    window.renderConfirmStep = function renderConfirmStep() {
      const preview = journeyState.propertyPreview || {};
      const fullStreet = [preview.street, preview.apt].filter(Boolean).join(" ");
      const cityStateZip = [preview.city, preview.state, preview.zip].filter(Boolean).join(", ").replace(", ,", ",");

      return `
        <div class="wrap" style="max-width:720px; margin:56px auto;">
          <div class="panel" style="padding:28px; border:1px solid #e5e7eb; border-radius:20px; background:#ffffff; box-shadow:0 10px 30px rgba(15,23,42,0.06);">
            <div style="font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#2563eb; margin:0 0 10px;">
              Confirm property
            </div>

            <h2 style="margin:0 0 10px; font-size:34px; line-height:1.08; letter-spacing:-0.03em; color:#0f172a;">
              Is this the right property?
            </h2>

            <p class="muted" style="margin:0 0 18px; font-size:16px; line-height:1.5; color:#475569;">
              We’ll use this address to estimate roof size and improve quote accuracy before showing your decision.
            </p>

            <div style="margin:0 0 18px; padding:18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#475569; margin:0 0 8px;">
                Property address
              </div>

              <div style="font-size:24px; line-height:1.2; font-weight:700; color:#0f172a; margin:0 0 6px;">
                ${escapeHtml(fullStreet || "Address not available")}
              </div>

              <div style="font-size:15px; color:#475569;">
                ${escapeHtml(cityStateZip || "City / state not available")}
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; margin:0 0 20px;">
              <div style="padding:14px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Step 1
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Estimate roof size
                </div>
              </div>

              <div style="padding:14px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Step 2
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Scan your quote
                </div>
              </div>

              <div style="padding:14px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Step 3
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Get decision
                </div>
              </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn" onclick="confirmProperty()" style="min-width:180px;">
                Looks correct
              </button>

              <button class="btn secondary" onclick="setJourneyStep('address')" style="min-width:120px;">
                Edit
              </button>
            </div>
          </div>
        </div>
      `;
    };

    window.renderPropertyNotFoundStep = function renderPropertyNotFoundStep() {
      const preview = journeyState.propertyPreview || {};
      const fullStreet = [preview.street, preview.apt].filter(Boolean).join(" ");
      const cityStateZip = [preview.city, preview.state, preview.zip].filter(Boolean).join(", ").replace(", ,", ",");

      return `
        <div class="wrap" style="max-width:720px; margin:56px auto;">
          <div class="panel" style="padding:28px; border:1px solid #fcd34d; border-radius:20px; background:#fffbeb; box-shadow:0 10px 30px rgba(15,23,42,0.04);">
            <div style="font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#b45309; margin:0 0 10px;">
              Property check
            </div>

            <h2 style="margin:0 0 10px; font-size:34px; line-height:1.08; letter-spacing:-0.03em; color:#0f172a;">
              We couldn’t confirm this property automatically
            </h2>

            <p style="margin:0 0 18px; font-size:16px; line-height:1.5; color:#475569;">
              You can still continue. We’ll fall back to quote details, home size, and pricing signals to estimate roof size.
            </p>

            <div style="margin:0 0 18px; padding:18px; background:#ffffff; border:1px solid #fde68a; border-radius:16px;">
              <div style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#475569; margin:0 0 8px;">
                Entered address
              </div>

              <div style="font-size:22px; line-height:1.2; font-weight:700; color:#0f172a; margin:0 0 6px;">
                ${escapeHtml(fullStreet || "Address not available")}
              </div>

              <div style="font-size:15px; color:#475569;">
                ${escapeHtml(cityStateZip || "City / state not available")}
              </div>
            </div>

            ${
              journeyState.propertyLookupMessage
                ? `
                  <div class="panel" style="margin:0 0 16px; background:#fff7ed; border-color:#fdba74;">
                    <p style="margin:0;">
                      <strong>Note:</strong> ${escapeHtml(journeyState.propertyLookupMessage)}
                    </p>
                  </div>
                `
                : ""
            }

            <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; margin:0 0 20px;">
              <div style="padding:14px; background:#ffffff; border:1px solid #f3f4f6; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Fallback 1
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Read quote details
                </div>
              </div>

              <div style="padding:14px; background:#ffffff; border:1px solid #f3f4f6; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Fallback 2
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Estimate from home size
                </div>
              </div>

              <div style="padding:14px; background:#ffffff; border:1px solid #f3f4f6; border-radius:14px;">
                <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#64748b; margin:0 0 4px;">
                  Fallback 3
                </div>
                <div style="font-size:14px; font-weight:600; color:#0f172a;">
                  Price model estimate
                </div>
              </div>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn" onclick="continueWithoutPropertyMatch()" style="min-width:220px;">
                Continue anyway
              </button>

              <button class="btn secondary" onclick="setJourneyStep('address')" style="min-width:120px;">
                Edit address
              </button>
            </div>
          </div>
        </div>
      `;
    };

    window.renderAnalyzeStep = function renderAnalyzeStep() {
      const preview = journeyState.propertyPreview || {};
      const fullStreet = [preview.street, preview.apt].filter(Boolean).join(" ");
      const cityStateZip = [preview.city, preview.state, preview.zip].filter(Boolean).join(", ").replace(", ,", ",");

      return `
        <div class="wrap" style="max-width:960px; margin:40px auto;">
          <div style="margin:0 0 18px;">
            <div style="font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#2563eb; margin:0 0 8px;">
              Step 3 of 3
            </div>

            <h2 style="margin:0 0 8px; font-size:34px; line-height:1.08; letter-spacing:-0.03em; color:#0f172a;">
              Analyze your quote
            </h2>

            <p class="muted" style="margin:0 0 14px; font-size:16px; line-height:1.5; color:#475569;">
              Upload your quote or complete any missing fields below. We’ll compare it against expected local pricing and tell you what to do next.
            </p>

            ${
              fullStreet || cityStateZip
                ? `
                  <div class="panel" style="margin:0; padding:14px 16px; background:#f8fafc; border-color:#e5e7eb;">
                    <p style="margin:0 0 4px; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:#475569;">
                      Property
                    </p>
                    <p style="margin:0; font-size:15px; color:#0f172a; font-weight:600;">
                      ${escapeHtml(fullStreet || "Address not available")}
                    </p>
                    <p style="margin:4px 0 0; font-size:14px; color:#64748b;">
                      ${escapeHtml(cityStateZip || "")}
                    </p>
                  </div>
                `
                : ""
            }
          </div>

          <div id="analyzeMount"></div>
        </div>
      `;
    };

    function renderInlineAnalyzingState(percent = 30, message = "Analyzing your quote…") {
      const el = document.getElementById("inlineAnalyzingState");
      if (!el) return;

      el.innerHTML = `
        <div class="panel" style="margin:0 0 14px; text-align:center;">
          <div style="font-size:24px; font-weight:800; margin-bottom:8px;">${message}</div>
          <p class="small muted" style="margin:0 0 14px;">Extracting price, roof size, and risk signals</p>
          <div style="height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden;">
            <div id="analysisProgressBar" style="width:${percent}%; height:100%; background:#2563eb; transition:width .4s;"></div>
          </div>
        </div>
      `;
    }

    function renderAnalyzingState() {
      const root = document.getElementById("appRoot");
      if (!root) return;

      root.innerHTML = `
        <div style="max-width:720px; margin:80px auto; text-align:center; padding:0 24px;">

          <div class="progress-phase" id="analysisPhaseLabel">
            Reading your document...
          </div>

          <div class="progress-sub" id="analysisPhaseDetail">
            Extracting price, material, and scope details
          </div>

          <div style="height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden; margin-bottom:18px;">
            <div id="analysisProgressBar" style="width:10%; height:100%; background:var(--brand); transition:width .4s;"></div>
          </div>

          <div class="small muted" style="margin-bottom:24px;">
            This takes ~5-10 seconds
          </div>

          <div class="extraction-preview" id="extractionPreview"></div>

        </div>
      `;

      // Animate progress phases
      const phases = [
        { pct: 20, label: "Extracting price, material, and scope...", detail: "Scanning document for key pricing signals", delay: 1500 },
        { pct: 45, label: "Looking up your property...", detail: "Estimating roof size from address data", delay: 3500 },
        { pct: 65, label: "Comparing against local pricing...", detail: "Matching to city-level benchmarks", delay: 5000 },
        { pct: 85, label: "Checking for risks and missing items...", detail: "Reviewing scope signals and risk flags", delay: 7000 },
        { pct: 95, label: "Generating your decision...", detail: "Assembling your personalized result", delay: 8500 }
      ];

      phases.forEach(phase => {
        setTimeout(() => {
          const bar = document.getElementById("analysisProgressBar");
          const label = document.getElementById("analysisPhaseLabel");
          const detail = document.getElementById("analysisPhaseDetail");
          if (bar) bar.style.width = phase.pct + "%";
          if (label) label.textContent = phase.label;
          if (detail) detail.textContent = phase.detail;

          // Show extraction previews as data becomes available
          const preview = document.getElementById("extractionPreview");
          if (preview && latestParsed) {
            let items = [];
            if (latestParsed.price) items.push({ label: "Price", value: "$" + Number(latestParsed.price).toLocaleString() });
            if (latestParsed.materialLabel) items.push({ label: "Material", value: latestParsed.materialLabel });
            if (latestParsed.roofSize) items.push({ label: "Roof size", value: latestParsed.roofSize + " sq ft" });
            if (latestParsed.city) items.push({ label: "Location", value: latestParsed.city + (latestParsed.stateCode ? ", " + latestParsed.stateCode : "") });

            if (items.length > 0) {
              preview.innerHTML = items.map(item =>
                `<div class="extraction-item">
                  <span class="extraction-item-label">${escapeHtml(item.label)}</span>
                  <span class="extraction-item-value">${escapeHtml(item.value)}</span>
                </div>`
              ).join("");
            }
          }
        }, phase.delay);
      });
    }

    window.setJourneyStep = function setJourneyStep(step) {
      console.log("setJourneyStep called with:", step);
      journeyState.step = step;
      console.log("journeyState.step is now:", journeyState.step);
      renderApp();
      console.log("renderApp finished");
    };

    window.continueWithoutPropertyMatch = function continueWithoutPropertyMatch() {
      journeyState.propertyConfirmed = true;
      // Use same overlay pattern as confirmProperty
      confirmProperty();
    };

    window.handleAddressSubmit = function handleAddressSubmit() {
      const street = document.getElementById("journeyStreetAddress")?.value?.trim() || "";
      const apt = document.getElementById("journeyAptUnit")?.value?.trim() || "";
      const city = document.getElementById("journeyCity")?.value?.trim() || "";
      const state = document.getElementById("journeyState")?.value?.trim().toUpperCase() || "";
      const zip = document.getElementById("journeyZipCode")?.value?.trim() || "";

      const errorEl = document.getElementById("journeyAddressError");

      if (!street || !city || !state) {
        if (errorEl) {
          errorEl.style.display = "block";
          errorEl.textContent = "Please enter street, city, and state.";
        }
        return;
      }

      if (errorEl) {
        errorEl.style.display = "none";
        errorEl.textContent = "";
      }

      journeyState.propertyPreview = {
        street,
        apt,
        city,
        state,
        zip
      };

      journeyState.propertyLookupAttempted = true;
      journeyState.propertyLookupFailed = false;
      journeyState.propertyLookupMessage = "";

      const looksWeak =
        street.length < 5 ||
        city.length < 2 ||
        state.length !== 2;

      if (looksWeak) {
        journeyState.propertyLookupFailed = true;
        journeyState.propertyLookupMessage = "This address may be incomplete or hard to verify.";
        setJourneyStep("property_not_found");
        return;
      }

      setJourneyStep("confirm");
    };

    window.confirmProperty = function confirmProperty() {
      journeyState.propertyConfirmed = true;

      const root = document.getElementById("appRoot");
      if (!root) return;

      // Build extraction preview items
      let previewHtml = "";
      if (latestParsed) {
        let items = [];
        if (latestParsed.price) items.push({ label: "Price", value: "$" + Number(latestParsed.price).toLocaleString() });
        if (latestParsed.materialLabel) items.push({ label: "Material", value: latestParsed.materialLabel });
        if (latestParsed.roofSize) items.push({ label: "Roof size", value: latestParsed.roofSize + " sq ft" });
        const loc = latestParsed.city || journeyState?.propertyPreview?.city || "";
        const st = latestParsed.stateCode || journeyState?.propertyPreview?.state || "";
        if (loc) items.push({ label: "Location", value: loc + (st ? ", " + st : "") });
        if (items.length > 0) {
          previewHtml = items.map(item =>
            `<div class="extraction-item">
              <span class="extraction-item-label">${escapeHtml(item.label)}</span>
              <span class="extraction-item-value">${escapeHtml(item.value)}</span>
            </div>`
          ).join("");
        }
      }

      // Render analyzing screen + hidden form elements in one shot (no flash)
      const preview = journeyState.propertyPreview || {};
      const p = latestParsed || {};
      root.innerHTML = `
        <div style="max-width:720px; margin:80px auto; text-align:center; padding:0 24px;">
          <div class="progress-phase" id="analysisPhaseLabel">Analyzing your quote...</div>
          <div class="progress-sub" id="analysisPhaseDetail">Comparing against local pricing data</div>
          <div style="height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden; margin-bottom:18px;">
            <div id="analysisProgressBar" style="width:30%; height:100%; background:var(--brand, #1d4ed8); transition:width .4s;"></div>
          </div>
          <div class="small muted">This takes ~5-10 seconds</div>
          <div class="extraction-preview" id="extractionPreview">${previewHtml}</div>
        </div>
        <!-- Hidden form elements for analyzeQuote() to read from -->
        <div style="position:absolute; left:-9999px; top:-9999px;">
          <input id="cityName" value="${escapeHtml(preview.city || p.city || p.address?.city || "")}">
          <input id="stateCode" value="${escapeHtml(preview.state || p.stateCode || p.address?.stateCode || "")}">
          <input id="streetAddress" value="${escapeHtml(preview.street || p.address?.street || "")}">
          <input id="zipCode" value="${escapeHtml(preview.zip || p.address?.zip || "")}">
          <input id="roofSize" value="${escapeHtml(String(p.roofSize || ""))}">
          <input id="quotePrice" value="${escapeHtml(String(p.finalBestPrice || p.totalLinePrice || p.price || ""))}">
          <select id="materialType"><option value="${escapeHtml(p.material || "architectural")}" selected></option></select>
          <select id="complexityFactor"><option value="1.00" selected></option></select>
          <select id="tearOffIncluded"><option value="1.00" selected></option></select>
          <input id="warrantyYears" value="${escapeHtml(String(p.warrantyYears || ""))}">
          <div id="analysisOutput"></div>
          <div id="aiAnalysisOutput"></div>
          <div id="analysisPanels"></div>
          <div id="parsedSignalSection"></div>
          <div id="inlineAnalyzingState"></div>
          <div id="inlineShareReportOutput"></div>
          <div id="inlineShareCopyStatus"></div>
        </div>
      `;

      // Run analysis after a tick
      setTimeout(() => {
        if (typeof analyzeQuote === "function") {
          analyzeQuote();
        }
      }, 50);
    };

      window.renderResultStep = function renderResultStep() {
        const a = window.__latestAnalysis;
        if (!a) {
          return `<div style="max-width:800px; margin:40px auto; text-align:center; padding:24px;"><p>No analysis yet.</p></div>`;
        }

        return `
          <div style="max-width:800px; margin:40px auto; padding:0 24px;">
            ${renderVerdictCard(a)}
            ${renderBeforeYouSign(a)}
            ${renderMarketContext(a)}
            ${renderShareModule(a)}
          </div>
        `;
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          if (typeof window.renderApp === "function") {
            window.renderApp();
          }
        });
      } else {
        if (typeof window.renderApp === "function") {
          window.renderApp();
        }
      }

      })();
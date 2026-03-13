import "./analyzer-core.js";
import "./analyzer-parser.js";
import { parseQuote } from "./analyzer-ocr.js";
import {
  analyzeQuote,
  resetAnalyzer,
  setUploadStatus
} from "./analyzer-ui.js";

window.parseQuote = parseQuote;
window.analyzeQuote = analyzeQuote;
window.resetAnalyzer = resetAnalyzer;
window.setUploadStatus = setUploadStatus;
window.copyParsedToForm = () => {};
window.compareSecondQuote = () => {};
window.viewShareableResult = () => {};
window.showLeadPlaceholder = () => {};
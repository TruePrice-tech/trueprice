import "./analyzer-core.js?v=9";
import { parseQuote } from "./analyzer-ocr.js?v=9";
import {
  analyzeQuote,
  resetAnalyzer,
  setUploadStatus
} from "./analyzer-ui.js?v=9";

window.parseQuote = parseQuote;
window.analyzeQuote = analyzeQuote;
window.resetAnalyzer = resetAnalyzer;
window.setUploadStatus = setUploadStatus;
/*
 * =============================================================
 * == FILE: 2_Helpers.gs
 * == MỤC ĐÍCH: Utility functions dùng chung
 * =============================================================
 */

// ==================== STRING HELPERS ====================

/**
 * Decode HTML entities trong string
 * @param {string} s - Input string
 * @return {string} Decoded string
 */
function decodeHtml_(s) {
  return (s || "").replace(/&quot;/g, '"');
}

/**
 * Check if string contains "Not requested on this item"
 * @param {string} s - Input string
 * @return {boolean}
 */
function isNotRequestedLogo_(s) {
  const t = String(s || "").trim().toLowerCase();
  return t.includes("not requested on this item");
}

/**
 * Safe string conversion with trim
 * @param {*} value - Any value
 * @return {string} Trimmed string
 */
function safeString_(value) {
  return String(value || "").trim();
}

// ==================== VARIATION PARSING ====================

/**
 * Parse KEY TYPE from variations text (case-insensitive)
 * Look for any line containing "type" with format "label: value"
 * @param {string} variationsText - Variations text
 * @return {string} Type value or empty string
 */
function parseKeyTypeFromVariations_(variationsText) {
  if (!variationsText) return "";
  const v = decodeHtml_(safeString_(variationsText));
  if (!v) return "";

  const lines = v.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = safeString_(lines[i]);
    const match = line.match(/^[^:]*type[^:]*:\s*(.+)/i);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value) return value;
    }
  }
  return "";
}

/**
 * Check if variations contain "Width" or "Length" labels
 * (indicates strap watch products)
 * @param {string} variationsText - Variations text
 * @return {boolean}
 */
function hasWidthOrLengthVariation_(variationsText) {
  if (!variationsText) return false;
  const v = decodeHtml_(safeString_(variationsText));
  if (!v) return false;
  
  const lines = v.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = safeString_(lines[i]).toLowerCase();
    if (line.startsWith("width:") || line.startsWith("length:")) {
      return true;
    }
  }
  return false;
}

/**
 * Extract KEY TYPE value from variations array
 * Trả về value của variation (A17, A12, A01...)
 * @param {Array} variations - Array of {property, value} objects
 * @return {string} Type value or empty string
 */
function extractKeyTypeFromVariationsArray_(variations) {
  if (!variations || !Array.isArray(variations)) return "";
  
  for (let i = 0; i < variations.length; i++) {
    const v = variations[i];
    if (!v || !v.value) continue;
    
    const value = safeString_(v.value).toUpperCase().trim();
    
    // Nếu value là dạng [Letter][1-3 số] (A01, A12, C5, B3...) -> trả về luôn
    if (/^[A-Z]\d{1,3}$/.test(value)) {
      return value;
    }
  }
  return "";
}

/**
 * Extract TYPE code from full type string
 * Example: "TYPE 2B - 4 buttons" -> "TYPE 2B"
 * @param {string} selectedTypeFull - Full type string
 * @return {string} TYPE code or empty string
 */
function extractTypeCode_(selectedTypeFull) {
  if (!selectedTypeFull) return "";
  
  const s = safeString_(selectedTypeFull);
  const match = s.match(/(TYPE\s*[A-Z0-9]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return "";
}

/**
 * Normalize label for fuzzy matching
 * @param {string} s - Input label
 * @return {string} Normalized label
 */
function normalizeLabel_(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[/()[\]\-_,]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * Parse variation value by label from variations text
 * @param {string} variationsText - Variations text
 * @param {string} label - Label to find
 * @return {string} Value or empty string
 */
function parseVariationValueByLabel_(variationsText, label) {
  if (!variationsText || !label) return "";
  
  const v = decodeHtml_(safeString_(variationsText));
  if (!v) return "";
  
  const normTargetLabel = normalizeLabel_(label);
  if (!normTargetLabel) return "";
  
  const lines = v.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = safeString_(lines[i]);
    if (!line) continue;
    
    const match = line.match(/^(.+?):\s*(.+)$/i);
    if (match && match[1] && match[2]) {
      const normLineLabel = normalizeLabel_(match[1]);
      
      if (normLineLabel === normTargetLabel || 
          normLineLabel.includes(normTargetLabel) || 
          normTargetLabel.includes(normLineLabel)) {
        const value = safeString_(match[2]);
        if (value) return value;
      }
    }
  }
  return "";
}

// ==================== TYPE NORMALIZATION ====================

/**
 * Normalize type text: uppercase + collapse multiple spaces
 * @param {string} s - Type text
 * @return {string} Normalized type
 */
function normalizeType_(s) {
  if (!s) return "";
  return String(s).trim().replace(/\s+/g, " ").toUpperCase();
}

// ==================== EXCEL COLUMN CONVERSION ====================

/**
 * Convert column number (1-based) to Excel column letter (A, B, ..., Z, AA, AB, ...)
 * @param {number} colNum - Column number (1-based)
 * @return {string} Excel column letter
 */
function colNumToLetter_(colNum) {
  if (colNum < 1) return "A";
  let result = "";
  while (colNum > 0) {
    colNum--;
    result = String.fromCharCode(65 + (colNum % 26)) + result;
    colNum = Math.floor(colNum / 26);
  }
  return result;
}

// ==================== MONEY PARSING ====================

/**
 * Parse money string to clean number
 * Handles multiple formats:
 * - US format: "$1,234.56", "$45.00", "45.00"
 * - EU/VN format: "1.234,56", "800.000", "4.500,00"
 * - Mixed: "$4.500,00"
 * - Negative: "-123", "(123)"
 * - Already numbers: 45.00
 * @param {*} value - Money value (string or number)
 * @param {string} currencyHint - Optional currency hint (USD/VND) - not used but kept for compatibility
 * @return {number} Clean number value
 */
function parseMoneyString_(value, currencyHint) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return isFinite(value) ? value : 0;

  let s = String(value).trim();

  // Remove currency symbols & spaces
  s = s.replace(/\s+/g, "");
  s = s.replace(/[$₫đ]/gi, "");

  // Handle negative like (123)
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }

  // Keep only digits, dot, comma
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return 0;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    // BOTH exist → last separator is decimal
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");

    if (lastComma > lastDot) {
      // EU style: 4.500,00
      s = s.replace(/\./g, "");   // remove thousand dots
      s = s.replace(",", ".");    // decimal comma → dot
    } else {
      // US style: 4,500.00
      s = s.replace(/,/g, "");    // remove thousand commas
      // dot already decimal
    }
  } else if (hasComma && !hasDot) {
    // Only comma
    // If ends with ,xx → decimal, else thousand
    if (/,(\d{1,2})$/.test(s)) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasDot && !hasComma) {
    // Only dot
    // If ends with .xx → decimal, else thousand
    if (!/\.(\d{1,2})$/.test(s)) {
      s = s.replace(/\./g, "");
    }
  }

  let num = Number(s);
  if (!isFinite(num)) num = 0;
  return negative ? -num : num;
}
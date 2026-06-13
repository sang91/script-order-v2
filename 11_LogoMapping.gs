/*
 * =============================================================
 * == FILE: 11_LogoMapping.gs
 * == VERSION: 2.1.0 (2026-01-28 16:20)
 * == MỤC ĐÍCH: Trích xuất & Map Logo dập (Txx, Xxx, Lxx...)
 * =============================================================
 * 
 * LOGIC:
 * 1. Quét SKU lấy mã bảng logo (P00, L00, S33...)
 * 2. Quét Personalization lấy số logo (Q104, Q3, T45...)
 * 3. Ghép: S33Q104, P00Q42... -> Tra cứu trong sheet *_LOGO
 * 4. Trả kết quả: Ảnh vào Cột D
 * =============================================================
 */


/**
 * CẤU HÌNH
 * - Mã Bảng Logo (từ SKU): 00-99 (2 chữ số)
 * - Số Logo (từ Personalization): 1-110
 */
const EXTRACTOR_CONFIG = {
  // Cấu trúc cột thực tế của bạn
  COL_PRODUCT_INFO: 2,  // B - Chứa SKU + Personalization
  COL_LOGO_IMAGE: 4,    // D - Ảnh Logo HOẶC Mã Logo (Nếu không tìm thấy ảnh)
  COL_ORDER_ID: 5,      // E - Order ID
  COL_SHOP_NAME: 6,     // F - Shop Name
  START_ROW: 2,
  
  // Prefix Bảng (Lấy từ SKU)
  BOARD_PREFIX_MAP: {
    "viettoanhandmade": "T",
    "xilacrafts": "X",
    "laxiluxurycrafts": "L",
    "quangduocstore": "S",
    "longnamleather": "N",
    "khhandcrafts": "K",
    "leecozzycraft": "J"
  },
  
  // Prefix Logo Số (Lấy từ Personalization)
  LOGO_PREFIX_MAP: {
    "viettoanhandmade": "T",
    "xilacrafts": "X",
    "laxiluxurycrafts": "L",
    "quangduocstore": "Q",
    "longnamleather": "N",
    "khhandcrafts": "K",
    "leecozzycrafts": "J",
    "leecozzycraft": "J"
  },

  BOARD_CODE_MIN: 0,
  BOARD_CODE_MAX: 99,
  LOGO_NUMBER_MIN: 1,
  LOGO_NUMBER_MAX: 138
};

/**
 * MENU - Chạy trích xuất Logo cho vùng đang chọn
 * Tự động map ảnh luôn nếu có đủ dữ liệu
 */
function runLogoExtractor() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  const selection = sh.getActiveRange();
  
  if (!selection) {
    ss.toast("⚠️ Vui lòng chọn vùng cần xử lý!", "Logo Extractor");
    return;
  }
  
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  
  ss.toast("🔄 Đang trích xuất Logo...", "Logo Extractor", 120);
  
  const shopLogoMaps = new Map();
  let extracted = 0, mapped = 0, skipped = 0;
  
  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    if (row < EXTRACTOR_CONFIG.START_ROW) continue;
    
    // 1. Lấy Shop Name & Prefix
    const shopName = String(sh.getRange(row, EXTRACTOR_CONFIG.COL_SHOP_NAME).getValue() || "").trim();
    if (!shopName) { skipped++; continue; }
    
    const shopNameLower = shopName.toLowerCase();
    const boardPrefix = EXTRACTOR_CONFIG.BOARD_PREFIX_MAP[shopNameLower] || "T";
    const logoPrefix = EXTRACTOR_CONFIG.LOGO_PREFIX_MAP[shopNameLower] || "T";
    
    // 2. Lấy dữ liệu Cột B
    const productInfo = String(sh.getRange(row, EXTRACTOR_CONFIG.COL_PRODUCT_INFO).getValue() || "");
    
    // 3. Trích xuất
    const boardCode = extractBoardCodeFromSKU_(productInfo, boardPrefix);
    const logoNumber = extractLogoNumberFromPersonalization_(productInfo, logoPrefix);
    
    // 4. Ghép kết quả & Ghi vào Cột D (4)
    let result = "";
    let hasFullData = false;
    
    if (boardCode) {
      if (logoNumber) {
        // Đúng logic: S04Q1
        result = boardCode + logoNumber;
        hasFullData = true;
      } else {
        // Mã chờ: S04Q (Trường hợp không quét được số logo)
        result = boardCode + logoPrefix;
      }
      sh.getRange(row, EXTRACTOR_CONFIG.COL_LOGO_IMAGE).setValue(result);
      extracted++;
    } else {
      skipped++;
      continue;
    }
    
    // 5. Tự động gọi Logo về nếu có ảnh trong Database
    if (hasFullData) {
      if (!shopLogoMaps.has(shopNameLower)) {
        shopLogoMaps.set(shopNameLower, buildLogoMapForShop_(shopName));
      }
      
      const logoMap = shopLogoMaps.get(shopNameLower);
      const key = boardCode + "|" + logoNumber;
      const imageUrl = logoMap.get(key) || "";
      
      if (imageUrl) {
        const fixedUrl = (typeof driveLinkToImage_ === 'function') ? (driveLinkToImage_(imageUrl) || imageUrl) : imageUrl;
        sh.getRange(row, EXTRACTOR_CONFIG.COL_LOGO_IMAGE).setFormula(`=IFERROR(IMAGE("${fixedUrl}";1);"")`);
        sh.setRowHeight(row, 80);
        mapped++;
      }
    }
  }
  
  ss.toast(`✅ Hoàn thành: ${extracted} mã, ${mapped} ảnh đã map.`, "Logo Extractor");
}


/**
 * Trích xuất Mã Bảng Logo từ SKU
 * CẬP NHẬT 2026-01-28: Giữ nguyên 3 ký tự cuối SKU (P00, L00, S00...)
 * Ví dụ: "FORD DVT1875 P00" -> "P00", "BMW L00" -> "L00"
 * 
 * @param {string} text - Nội dung Cột B
 * @param {string} prefix - Prefix của shop (T, X, L...)
 * @return {string} Mã bảng (P00, L00, S00, T04...) hoặc rỗng
 */
function extractBoardCodeFromSKU_(text, prefix) {
  if (!text) return "";
  
  // Tìm dòng SKU
  const skuMatch = text.match(/SKU\s*:\s*([^\r\n]+)/i);
  if (!skuMatch) return "";
  
  const skuLine = skuMatch[1].trim().toUpperCase();
  
  // Tìm 3 ký tự cuối: 1 chữ cái + 2 số
  const boardRegex = /\s([A-Z]\d{2})$/;
  const match = skuLine.match(boardRegex);
  
  if (match && match[1]) {
    // GIỮ NGUYÊN mã bảng từ SKU (P00, L00, S00...)
    return match[1];
  }
  
  return "";
}

/**
 * Trích xuất Số Logo từ Personalization
 * CẬP NHẬT 2026-01-28: 
 * - Quét TOÀN BỘ multi-line Personalization
 * - Hỗ trợ: Logo: Q42-Black, q90 cream, 2. Q104, Q3
 * - Filter số STT đầu dòng (1-, 2), 3*...)
 * 
 * @param {string} text - Nội dung Cột B
 * @param {string} prefix - Prefix của shop (T, X, L, Q...)
 * @return {string} Số logo (Q42, T97, L110) hoặc rỗng
 */
function extractLogoNumberFromPersonalization_(text, prefix) {
  if (!text) return "";
  
  let persText = text.trim();
  
  // Lấy TOÀN BỘ text sau "Personalization:" hoặc "Logo:" (multi-line)
  const persMatch = text.match(/(?:Logo|Personalization)\s*:\s*([\s\S]*)/i);
  if (persMatch && persMatch[1]) {
    persText = persMatch[1].trim();
  }

  // Nếu KHÔNG có "Personalization:" hay "Logo:" → FORMAT MỚI → Semantic Classification
  const hasOldFormat = !!(persMatch && persMatch[1] && persMatch[1].trim());
  if (!hasOldFormat) {
    Logger.log(`[LOGO_EXTRACT] Format MỚI detected → _extractLogoFromNewFormat_`);
    return _extractLogoFromNewFormat_(text, prefix);
  }

  // ===== FORMAT CŨ: LOGIC NGUYÊN GỐC - KHÔNG THAY ĐỔI =====
  // DEBUG LOG
  Logger.log(`[LOGO_EXTRACT] persText: ${persText.substring(0, 200)}`);
  
  // ========== ƯU TIÊN 0: Pattern "Logo:" ==========
  // Ví dụ: "Logo: Q3 - black", "Logo: Q42-Black", "Logo:q90 cream"
  const logoColonPatterns = [
    /logo\s*:\s*([A-Za-z])(\d{1,4})/i,
  ];
  
  for (const pattern of logoColonPatterns) {
    const match = persText.match(pattern);
    if (match && match[2]) {
      const foundPrefix = match[1].toUpperCase();
      const num = parseInt(match[2], 10);
      Logger.log(`[LOGO_EXTRACT] ƯU TIÊN 0 match: ${foundPrefix}${num}`);
      if (num >= EXTRACTOR_CONFIG.LOGO_NUMBER_MIN && num <= EXTRACTOR_CONFIG.LOGO_NUMBER_MAX) {
        return normalizeLogoNumber_(foundPrefix + num, foundPrefix);
      }
    }
  }
  
  // ========== ƯU TIÊN 1: Pattern "N. Q104" (số thứ tự + mã logo) ==========
  // Ví dụ: "2. Q104", "3. Q42", "1- Q10"
  const lineNumLogoPatterns = [
    /\d+[\.\)\-\*]\s*([A-Za-z])(\d{1,4})(?:\s|$|-|,)/i,
    /\d+[\.\)\-\*]\s*([A-Za-z])(\d{1,4})/i,
  ];
  
  for (const pattern of lineNumLogoPatterns) {
    const match = persText.match(pattern);
    if (match && match[2]) {
      const foundPrefix = match[1].toUpperCase();
      const num = parseInt(match[2], 10);
      Logger.log(`[LOGO_EXTRACT] ƯU TIÊN 1 match: ${foundPrefix}${num}`);
      if (num >= EXTRACTOR_CONFIG.LOGO_NUMBER_MIN && num <= EXTRACTOR_CONFIG.LOGO_NUMBER_MAX) {
        return normalizeLogoNumber_(foundPrefix + num, foundPrefix);
      }
    }
  }
  
  // ========== ƯU TIÊN 2: Pattern [Letter][1-4 số] đứng một mình ==========
  // Ví dụ: "Q42", "Q104", "T45", "Q3"
  // Tìm tất cả pattern rồi filter bỏ những cái không hợp lệ
  const allLogoMatches = persText.match(/(?:^|[^A-Za-z])([A-Za-z])(\d{1,4})(?:[^0-9]|$)/gi) || [];
  
  for (const fullMatch of allLogoMatches) {
    const innerMatch = fullMatch.match(/([A-Za-z])(\d{1,4})/i);
    if (innerMatch && innerMatch[2]) {
      const foundPrefix = innerMatch[1].toUpperCase();
      const num = parseInt(innerMatch[2], 10);
      
      // Skip nếu là phần của SKU (ví dụ QDS1549)
      if (text.toUpperCase().includes("QDS") && foundPrefix === "Q") {
        // Kiểm tra xem số này có nằm trong SKU không
        const skuMatch = text.match(/SKU\s*:\s*[^\r\n]+/i);
        if (skuMatch && skuMatch[0].includes(innerMatch[0].toUpperCase())) {
          continue;
        }
      }
      
      Logger.log(`[LOGO_EXTRACT] ƯU TIÊN 2 candidate: ${foundPrefix}${num}`);
      if (num >= EXTRACTOR_CONFIG.LOGO_NUMBER_MIN && num <= EXTRACTOR_CONFIG.LOGO_NUMBER_MAX) {
        return normalizeLogoNumber_(foundPrefix + num, foundPrefix);
      }
    }
  }
  
  // ========== ƯU TIÊN 3: Tìm theo prefix shop ==========
  const prefixPattern = new RegExp(`[^A-Za-z](${prefix})(\\d{1,4})(?:[^0-9]|$)`, "i");
  const prefixMatch = persText.match(prefixPattern);
  if (prefixMatch && prefixMatch[2]) {
    const num = parseInt(prefixMatch[2], 10);
    Logger.log(`[LOGO_EXTRACT] ƯU TIÊN 3 match: ${prefix}${num}`);
    if (num >= EXTRACTOR_CONFIG.LOGO_NUMBER_MIN && num <= EXTRACTOR_CONFIG.LOGO_NUMBER_MAX) {
      return normalizeLogoNumber_(prefix + num, prefix);
    }
  }
  
  // ========== ƯU TIÊN 4: Số sau keyword ==========
  const contextKeywords = ["logo", "stamp", "code", "number", "#"];
  for (const kw of contextKeywords) {
    const kwRegex = new RegExp(kw + "[\\s\\:\\#\\-]*(\\d{1,3})\\b", "i");
    const match = persText.match(kwRegex);
    
    if (match && match[1]) {
      const numStr = match[1];
      const num = parseInt(numStr, 10);
      
      if (isNoiseNumber_(persText, numStr)) continue;
      
      if (num >= EXTRACTOR_CONFIG.LOGO_NUMBER_MIN && num <= EXTRACTOR_CONFIG.LOGO_NUMBER_MAX) {
        Logger.log(`[LOGO_EXTRACT] ƯU TIÊN 4 match: ${prefix}${num}`);
        return normalizeLogoNumber_(prefix + num, prefix);
      }
    }
  }
  
  // KHÔNG dùng fallback nữa - tránh pick số STT
  Logger.log(`[LOGO_EXTRACT] No logo found`);
  return "";
}


/**
 * Kiểm tra số có phải là nhiễu không (SĐT, Size, Năm, STT dòng)
 * CẬP NHẬT 2026-01-28: Thêm filter số STT đầu dòng
 */
function isNoiseNumber_(text, numStr) {
  const lowerText = text.toLowerCase();
  
  // 0. Số STT đầu dòng: 1- 1) 1* 1. 2- 2) 2* 2. ...
  const lineStartPatterns = [
    new RegExp(`(^|\\n|\\r)\\s*${numStr}\\s*[-\\)\\*\\.]\\s`, 'i'),
    new RegExp(`(^|\\n|\\r)\\s*${numStr}\\s*[-\\)\\*\\.]`, 'i'),
  ];
  for (const pattern of lineStartPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // 1. Phần của SĐT (>= 9 số liên tiếp)
  const allNums = text.match(/\d+/g) || [];
  for (const s of allNums) {
    if (s.includes(numStr) && s.length >= 9) return true;
  }
  
  // 2. Gần đơn vị đo lường
  const numIndex = lowerText.indexOf(numStr);
  if (numIndex >= 0) {
    const context = lowerText.substring(Math.max(0, numIndex - 10), numIndex + numStr.length + 10);
    if (/\b(mm|cm|inch|inches|size|width|length|height|key|phone|keychain)\b/.test(context)) {
      return true;
    }
  }
  
  // 3. Phần của năm (20xx)
  for (const s of allNums) {
    if (s.length === 4 && s.startsWith("20") && s.includes(numStr)) {
      return true;
    }
  }
  
  return false;
}


/**
 * Chuẩn hóa MÃ BẢNG: Luôn pad thành 2 chữ số
 * T1 -> T01, T5 -> T05, T11 -> T11
 */
function normalizeBoardCode_(code, prefix) {
  if (!code) return "";
  
  const upper = code.toUpperCase();
  const match = upper.match(new RegExp("^(" + prefix.toUpperCase() + ")(\\d{1,2})$"));
  
  if (match) {
    const num = parseInt(match[2], 10);
    // Mã bảng luôn 2 số: T00-T99
    return prefix.toUpperCase() + String(num).padStart(2, "0");
  }
  
  return upper;
}

/**
 * Chuẩn hóa SỐ LOGO: KHÔNG pad, giữ nguyên số
 * T1 -> T1, T5 -> T5, T11 -> T11, T110 -> T110
 */
function normalizeLogoNumber_(code, prefix) {
  if (!code) return "";
  
  const upper = code.toUpperCase();
  const match = upper.match(/^([A-Z]{1,3})(\d{1,4})$/);
  
  if (match) {
    const currentPrefix = match[1];
    const num = parseInt(match[2], 10);
    // Giữ nguyên số, KHÔNG pad
    return currentPrefix + String(num);
  }
  
  return upper;
}

/**
 * Build logo map for a specific shop from the LOGO database
 * Key: BOARD_CODE|LOGO_NUMBER -> IMAGE_LINK
 */
function buildLogoMapForShop_(shopName) {
  const ss = SpreadsheetApp.openById("1R3aJ1AyM5qFNcVEuqmHhkC0FYGXR6skEnrUVykFsvpc");
  
  // Normalized shop name to find sheet (ShopName_LOGO)
  const targetName = (String(shopName).trim() + "_LOGO").toLowerCase();
  
  // Tìm sheet khớp chính xác hoặc khớp tương đối với hậu tố _LOGO
  const allSheets = ss.getSheets();
  let targetSheet = null;
  
  for (const sheet of allSheets) {
    const name = sheet.getName().toLowerCase();
    if (name === targetName || (name.endsWith("_logo") && name.includes(String(shopName).toLowerCase().trim()))) {
      targetSheet = sheet;
      break;
    }
  }
  
  const map = new Map();
  if (!targetSheet) {
    Logger.log(`[LOGO_MAP] Sheet NOT FOUND for shop: ${shopName}`);
    return map;
  }
  
  const lastRow = targetSheet.getLastRow();
  if (lastRow < 2) return map;
  
  // Giả định cấu trúc database logo: 
  // Cột C (3): Board Code (T04), Cột D (4): Logo Number (T01), Cột F (6): Image Link
  const data = targetSheet.getRange(2, 3, lastRow - 1, 4).getValues(); // C to F
  
  data.forEach(row => {
    const board = String(row[0] || "").trim().toUpperCase(); // Col C
    const logo = String(row[1] || "").trim().toUpperCase();  // Col D
    const img = String(row[3] || "").trim();               // Col F
    
    if (board && logo && img) {
      // Key: T04|T1 (hoặc T04|T01 tùy chuẩn hóa)
      map.set(board + "|" + logo, img);
    }
  });
  
  Logger.log(`[LOGO_MAP] Loaded ${map.size} entries from ${targetSheet.getName()}`);
  return map;
}

/***********************
 * MENU FUNCTIONS - Manual Logo Mapping
 ***********************/

/**
 * Menu: Map Logo All
 * Quét toàn bộ Cột D, nếu có mã logo (VD: T03T10) thì tra DB và thay bằng IMAGE
 */
function logoMapAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  
  const lastRow = sh.getLastRow();
  if (lastRow < EXTRACTOR_CONFIG.START_ROW) {
    SpreadsheetApp.getUi().alert("⚠️ Sheet trống!");
    return;
  }
  
  const n = lastRow - EXTRACTOR_CONFIG.START_ROW + 1;
  
  // Đọc dữ liệu
  const logoInputVals = sh.getRange(EXTRACTOR_CONFIG.START_ROW, EXTRACTOR_CONFIG.COL_LOGO_IMAGE, n, 1).getValues();
  const shopNameVals = sh.getRange(EXTRACTOR_CONFIG.START_ROW, EXTRACTOR_CONFIG.COL_SHOP_NAME, n, 1).getValues();
  
  // Cache logo maps per shop
  const shopLogoMaps = new Map();
  
  let mapped = 0, skipped = 0;
  
  for (let i = 0; i < n; i++) {
    const row = EXTRACTOR_CONFIG.START_ROW + i;
    const logoInput = String(logoInputVals[i][0] || "").trim();
    const shopName = String(shopNameVals[i][0] || "VietToanHandmade").trim();
    const shopNameLower = shopName.toLowerCase();
    
    // Skip nếu đã là IMAGE formula hoặc trống
    if (!logoInput || logoInput.startsWith("=") || logoInput.startsWith("http")) {
      skipped++;
      continue;
    }
    
    // Parse logo input (VD: T03T10 hoặc T03|T10)
    const parsed = parseLogoInput_(logoInput);
    if (!parsed.boardCode || !parsed.logoNumber) {
      skipped++;
      continue;
    }
    
    // Load logo map for this shop
    if (!shopLogoMaps.has(shopNameLower)) {
      const logoMap = buildLogoMapForShop_(shopName);
      shopLogoMaps.set(shopNameLower, logoMap);
    }
    
    const logoMap = shopLogoMaps.get(shopNameLower);
    const key = parsed.boardCode + "|" + parsed.logoNumber;
    const imageUrl = logoMap.get(key) || "";
    
    if (imageUrl) {
      // Fix link Drive nếu cần
      const fixedUrl = (typeof driveLinkToImage_ === 'function') ? (driveLinkToImage_(imageUrl) || imageUrl) : imageUrl;
      sh.getRange(row, EXTRACTOR_CONFIG.COL_LOGO_IMAGE).setFormula(`=IFERROR(IMAGE("${fixedUrl}";1);\"\")`);
      sh.setRowHeight(row, 80);
      mapped++;
    } else {
      skipped++;
    }
  }
  
  SpreadsheetApp.getUi().alert(`✅ HOÀN THÀNH!\n\n🖼️ Logo đã map: ${mapped}\n⏭️ Bỏ qua: ${skipped}`);
}

/**
 * Menu: Map Logo Selected
 * Quét vùng bôi đen trong Cột D, map ảnh logo
 */
function logoMapSelected() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  const selection = sh.getSelection();
  const ranges = selection.getActiveRangeList().getRanges();
  
  const rowSet = new Set();
  ranges.forEach(range => {
    const startRow = range.getRow();
    const numRows = range.getNumRows();
    for (let i = 0; i < numRows; i++) {
      const row = startRow + i;
      if (row >= EXTRACTOR_CONFIG.START_ROW) {
        rowSet.add(row);
      }
    }
  });
  
  const rows = Array.from(rowSet).sort((a, b) => a - b);
  
  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert("⚠️ Không có dòng nào được chọn.");
    return;
  }
  
  // Cache logo maps per shop
  const shopLogoMaps = new Map();
  
  let mapped = 0, skipped = 0;
  
  rows.forEach(row => {
    const logoInput = String(sh.getRange(row, EXTRACTOR_CONFIG.COL_LOGO_IMAGE).getValue() || "").trim();
    const shopName = String(sh.getRange(row, EXTRACTOR_CONFIG.COL_SHOP_NAME).getValue() || "VietToanHandmade").trim();
    const shopNameLower = shopName.toLowerCase();
    
    // Skip nếu đã là IMAGE formula hoặc trống
    if (!logoInput || logoInput.startsWith("=") || logoInput.startsWith("http")) {
      skipped++;
      return;
    }
    
    // Parse logo input
    const parsed = parseLogoInput_(logoInput);
    if (!parsed.boardCode || !parsed.logoNumber) {
      skipped++;
      return;
    }
    
    // Load logo map for this shop
    if (!shopLogoMaps.has(shopNameLower)) {
      const logoMap = buildLogoMapForShop_(shopName);
      shopLogoMaps.set(shopNameLower, logoMap);
    }
    
    const logoMap = shopLogoMaps.get(shopNameLower);
    const key = parsed.boardCode + "|" + parsed.logoNumber;
    const imageUrl = logoMap.get(key) || "";
    
    if (imageUrl) {
      // Fix link Drive nếu cần
      const fixedUrl = (typeof driveLinkToImage_ === 'function') ? (driveLinkToImage_(imageUrl) || imageUrl) : imageUrl;
      sh.getRange(row, EXTRACTOR_CONFIG.COL_LOGO_IMAGE).setFormula(`=IFERROR(IMAGE("${fixedUrl}";1);\"\")`);
      sh.setRowHeight(row, 80);
      mapped++;
    } else {
      skipped++;
    }
  });
  
  SpreadsheetApp.getUi().alert(`✅ HOÀN THÀNH!\n\n🖼️ Logo đã map: ${mapped}\n⏭️ Bỏ qua: ${skipped}`);
}

/**
 * Menu: Clear Logo All
 * Xóa tất cả ảnh logo trong Cột D
 */
function logoClearAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  
  const lastRow = sh.getLastRow();
  if (lastRow < EXTRACTOR_CONFIG.START_ROW) {
    SpreadsheetApp.getUi().alert("⚠️ Sheet trống!");
    return;
  }
  
  let cleared = 0;
  
  for (let row = EXTRACTOR_CONFIG.START_ROW; row <= lastRow; row++) {
    const cell = sh.getRange(row, EXTRACTOR_CONFIG.COL_LOGO_IMAGE);
    const formula = cell.getFormula();
    if (formula && formula.toUpperCase().includes("IMAGE")) {
      cell.clearContent();
      cleared++;
    }
  }
  
  SpreadsheetApp.getUi().alert(`✅ Đã xóa ${cleared} ảnh logo!`);
}

/**
 * Parse logo input string (VD: T03T10, T03|T10, T03-T10)
 * @return {object} { boardCode, logoNumber }
 */
function parseLogoInput_(input) {
  if (!input) return { boardCode: "", logoNumber: "" };
  
  const s = String(input).trim().toUpperCase();
  
  // Format 1: T03|T10
  if (s.includes("|")) {
    const parts = s.split("|");
    return { boardCode: parts[0].trim(), logoNumber: parts[1].trim() };
  }
  
  // Format 2: T03T10 (BoardCode 2 số + LogoNumber 1-3 số)
  // Regex: [Prefix][2 số][Prefix][1-3 số]
  const match = s.match(/^([A-Z]\d{2})([A-Z]\d{1,3})$/);
  if (match) {
    return { boardCode: match[1], logoNumber: match[2] };
  }
  
  // Format 3: T03-T10 hoặc T03 T10
  const splitMatch = s.match(/^([A-Z]\d{2})[\s\-_]+([A-Z]\d{1,3})$/);
  if (splitMatch) {
    return { boardCode: splitMatch[1], logoNumber: splitMatch[2] };
  }
  
  return { boardCode: "", logoNumber: "" };
}

/**
 * FORMAT MỚI: Semantic Classification
 * Chỉ được gọi khi KHÔNG có "Personalization:" hay "Logo:" trong text
 * Quét từng dòng, tìm mã Logo từ dòng có từ khóa logo
 *
 * @param {string} text - Toàn bộ text Cột B
 * @param {string} prefix - Prefix shop (T, X, L, Q...)
 * @return {string} Mã logo (B10, Q42...) hoặc rỗng
 */
function _extractLogoFromNewFormat_(text, prefix) {
  Logger.log(`[LOGO_EXTRACT] Format MỚI - Semantic Classification`);

  // Từ khóa nhận diện nhóm LOGO
  const LOGO_KEYWORDS = ["logo", "stamp", "code", "mã", "dập", "hình"];

  const lines = text.split(/\r?\n/);
  Logger.log(`[LOGO_EXTRACT] Format MỚI - Tổng ${lines.length} dòng`);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Bỏ qua dòng SKU
    if (/^SKU\b/i.test(trimmedLine) || /SKU[\s\:]/i.test(trimmedLine)) continue;

    // Chỉ xử lý dòng có từ khóa LOGO
    const lowerLine = trimmedLine.toLowerCase();
    const hasLogoKeyword = LOGO_KEYWORDS.some(kw => lowerLine.includes(kw));
    if (!hasLogoKeyword) continue;

    Logger.log(`[LOGO_EXTRACT] Format MỚI - Dòng LOGO: "${trimmedLine}"`);

    // Ư u tiên A: [Chữ][Số] (B10, Q42, T45)
    const goldenMatches = trimmedLine.match(/(?:^|[^A-Za-z])([A-Za-z])(\d{1,4})(?:[^0-9]|$)/g) || [];
    for (const gm of goldenMatches) {
      const inner = gm.match(/([A-Za-z])(\d{1,4})/i);
      if (inner && inner[2]) {
        const foundPrefix = inner[1].toUpperCase();
        const num = parseInt(inner[2], 10);
        if (num >= EXTRACTOR_CONFIG.LOGO_NUMBER_MIN && num <= EXTRACTOR_CONFIG.LOGO_NUMBER_MAX) {
          Logger.log(`[LOGO_EXTRACT] Format MỚI - Golden: ${foundPrefix}${num}`);
          return normalizeLogoNumber_(foundPrefix + num, foundPrefix);
        }
      }
    }

    // Ư u tiên B: Số đứng một mình (104, 57) → ghép prefix shop
    const standaloneNum = trimmedLine.match(/(?:^|\D)(\d{1,3})(?:\D|$)/);
    if (standaloneNum && standaloneNum[1]) {
      const num = parseInt(standaloneNum[1], 10);
      if (num >= EXTRACTOR_CONFIG.LOGO_NUMBER_MIN && num <= EXTRACTOR_CONFIG.LOGO_NUMBER_MAX) {
        Logger.log(`[LOGO_EXTRACT] Format MỚI - Auto-prefix: ${prefix}${num}`);
        return normalizeLogoNumber_(prefix + num, prefix);
      }
    }

    Logger.log(`[LOGO_EXTRACT] Format MỚI - Dòng LOGO nhưng không trích được mã`);
  }

  Logger.log(`[LOGO_EXTRACT] Format MỚI - No logo found`);
  return "";
}

/**
 * TEST FUNCTION - Chạy để debug logo extraction
 * Trên GAS: chạy testLogoExtraction() rồi xem Logs
 */
function testLogoExtraction() {
  const testCases = [
    {
      name: "Case 1: KIA với 2. Q104",
      input: `SKU : KIA QDS1549 S33
Màu: 37 - PINK
Type: TYPE 6
Personalization: 1. CiCi (embossing: black)
2. Q104
3. Key 2`,
      expectedBoard: "S33",
      expectedLogo: "Q104"
    },
    {
      name: "Case 2: Mercedes với Logo: Q3",
      input: `SKU : KHOÉT MERCEDES QDS9901 S42
Màu: 2 - PATINA RED
Type: TYPE 3
Personalization: 1. Name Tag: DANNY
2. Logo: Q3 - black
3. Keychain: Key 2 - cutout
4. black stitching and edge paint`,
      expectedBoard: "S42",
      expectedLogo: "Q3"
    },
    {
      name: "Case 3: FORD với emoji Logo",
      input: `SKU: FORD DVT1875 P00
Personalization: 
2️⃣Logo: Q42-Black
3️⃣ Name: Jesse Jimenez
4️⃣Key chain: Key 1"`,
      expectedBoard: "P00",
      expectedLogo: "Q42"
    },
    {
      name: "Case 4: q90 cream",
      input: `SKU: BMW 2024 L00
Personalization: q90 cream, Name: John`,
      expectedBoard: "L00",
      expectedLogo: "Q90"
    }
  ];
  
  Logger.log("========== TEST LOGO EXTRACTION ==========");
  
  let passed = 0, failed = 0;
  
  testCases.forEach((tc, i) => {
    const boardCode = extractBoardCodeFromSKU_(tc.input, "Q");
    const logoNumber = extractLogoNumberFromPersonalization_(tc.input, "Q");
    
    const boardOK = boardCode === tc.expectedBoard;
    const logoOK = logoNumber === tc.expectedLogo;
    
    if (boardOK && logoOK) passed++;
    else failed++;
    
    Logger.log(`\n--- ${tc.name} ---`);
    Logger.log(`Board: ${boardOK ? "✅" : "❌"} Got "${boardCode}" expected "${tc.expectedBoard}"`);
    Logger.log(`Logo: ${logoOK ? "✅" : "❌"} Got "${logoNumber}" expected "${tc.expectedLogo}"`);
  });
  
  Logger.log(`\n========== RESULT: ${passed} PASSED, ${failed} FAILED ==========`);
}

/**
 * CHECK VERSION - Chạy để xác nhận file đã update
 * Trên GAS: chạy checkLogoMappingVersion()
 */
function checkLogoMappingVersion() {
  const VERSION = "2.1.0 (2026-01-28 16:20)";
  Logger.log("=== LOGO MAPPING VERSION ===");
  Logger.log("Version: " + VERSION);
  Logger.log("Nếu hiện version này = file đã update!");
  SpreadsheetApp.getUi().alert("Logo Mapping Version: " + VERSION);
}

/*
 * =============================================================
 * == FILE: 5_Sheets.gs
 * == MỤC ĐÍCH: Sheet operations (menu, clear, ensure, append, format)
 * =============================================================
 */

// ==================== MENU ====================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // Etsy Tools menu (Clear sheets)
  ui.createMenu("Etsy Tools")
    .addItem("Clear Key Fob Order", "clearKeyFob_")
    .addItem("Clear Strap Watch Order", "clearStrap_")
    .addItem("Clear Tracking Info", "clearTracking_")
    .addItem("Clear YUNEXPRESS", "clearYunAll_")
    .addItem("Clear YUNEXPRESS TODAY", "clearYunToday_")
    .addSeparator()
    .addItem("Clear ALL", "clearAll_")
    .addSeparator()
    .addItem("🔄 Force Update YUN Headers", "forceUpdateYunHeaders_")
    .addItem("📤 Chuẩn bị YUN export (2 sheet)", "prepareYunExportBothSheets_")
    .addToUi();
  
  // LOGO Tools menu (AI + Manual Mapping)
  ui.createMenu("LOGO Tools")
    .addItem("🤖 AI Analyze Logo", "aiAnalyzeLogo_")
    .addItem("📝 Trích xuất Logo (Vùng chọn)", "runLogoExtractor")
    .addSeparator()
    .addItem("�️ Map Logo (Ô bôi đen D)", "logoMapSelected")
    .addItem("�️ Map Logo (Toàn bộ cột D)", "logoMapAll")
    .addSeparator()
    .addItem("🗑️ Xóa ảnh Logo (ALL)", "logoClearAll")
    .addToUi();
}

// ==================== CLEAR FUNCTIONS ====================

function clearSheetKeepHeader_(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  
  if (!sh) {
    if (activeSs) activeSs.toast(`❌ Sheet "${sheetName}" không tồn tại`, "Error", 3);
    return;
  }
  
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) {
    if (activeSs) activeSs.toast(`✅ Sheet "${sheetName}" đã trống`, "Info", 2);
    return;
  }
  
  const maxCols = sh.getMaxColumns();
  const dataRange = sh.getRange(2, 1, lastRow - 1, maxCols);
  
  // Clear content (text) nhưng giữ format, merge, borders
  dataRange.clearContent();
  
  // Clear formatting (background, borders) nhưng giữ header
  dataRange.breakApart();
  dataRange.setBackground(null);
  dataRange.setBorder(false, false, false, false, false, false);
  
  if (activeSs) activeSs.toast(`✅ Đã clear "${sheetName}" (giữ header)`, "Success", 2);
}

function clearKeyFob_()   { clearSheetKeepHeader_(SHEET_KEYFOB); }
function clearStrap_()    { clearSheetKeepHeader_(SHEET_STRAP); }
function clearTracking_() { clearSheetKeepHeader_(SHEET_TRACK); }
function clearYunAll_()   { clearSheetKeepHeader_(YUN_SHEET_NAME); }
function clearYunToday_() { clearSheetKeepHeader_(YUN_TODAY_SHEET_NAME); }

function clearAll_() {
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    clearKeyFob_();
    clearStrap_();
    clearTracking_();
    clearYunAll_();
    clearYunToday_();
    
    if (activeSs) activeSs.toast("✅ Đã clear tất cả sheets (giữ header)", "Success", 3);
  } catch (err) {
    if (activeSs) activeSs.toast(`❌ Lỗi khi clear: ${err.message}`, "Error", 5);
  }
}

// ==================== ENSURE FUNCTIONS ====================

function ensureSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeader_(sheet, headers, rangeA1) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    if (rangeA1) sheet.getRange(rangeA1).setFontWeight("bold").setWrap(true);
  }
}

function ensureTrackingHeader_(sheet) {
  ensureHeader_(sheet, HEADER_TRACKING, "A1:B1");
}

function ensureYunHeader_(sheet) {
  const expectedHeader = getYunHeader_();
  const maxCol = expectedHeader.length;
  
  // Check if header exists and is correct
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  let needsUpdate = false;
  
  if (lastRow === 0 || lastCol < maxCol) {
    // Sheet is empty or doesn't have enough columns
    needsUpdate = true;
  } else {
    // Check if header row matches
    const currentHeader = sheet.getRange(1, 1, 1, maxCol).getValues()[0];
    for (let i = 0; i < maxCol; i++) {
      if (safeString_(currentHeader[i]) !== expectedHeader[i]) {
        needsUpdate = true;
        break;
      }
    }
  }
  
  if (needsUpdate) {
    // Clear old header if exists
    if (lastRow > 0 && lastCol > 0) {
      sheet.getRange(1, 1, 1, Math.max(lastCol, maxCol)).clearContent();
    }
    
    // Set new header
    const lastColLetter = colNumToLetter_(maxCol);
    sheet.getRange(1, 1, 1, maxCol).setValues([expectedHeader]);
    sheet.getRange(`A1:${lastColLetter}1`).setFontWeight("bold").setWrap(true);
    Logger.log(`[YUN] Header updated: ${maxCol} columns`);
  }
}

// ==================== LOAD EXISTING DATA ====================

function loadExistingSet_(sheet, colIndex1Based) {
  const set = new Set();
  const last = sheet.getLastRow();
  if (last >= 2) {
    const vals = sheet.getRange(2, colIndex1Based, last - 1, 1).getValues();
    let loadedCount = 0;
    vals.forEach(r => {
      const v = safeString_(r[0]);
      if (v) {
        // Extract uniqueKeyBase từ uniqueKey (remove _0, _1, _2, etc.)
        // uniqueKey format: "orderId_sku_variations_0" -> "orderId_sku_variations"
        // Also handle old format without _0, _1 (backward compatible)
        let baseKey = v;
        // If ends with _digit, remove it (new format with qty loop)
        if (/_\d+$/.test(baseKey)) {
          baseKey = baseKey.replace(/_\d+$/, "");
        }
        // Normalize: trim and ensure consistent format
        baseKey = baseKey.trim();
        if (baseKey) {
          set.add(baseKey);
          loadedCount++;
          if (loadedCount <= 5) {
            Logger.log(`[LOAD_EXISTING] Loaded key: ${v} -> base: ${baseKey}`);
          }
        }
      }
    });
    Logger.log(`[LOAD_EXISTING] Total loaded ${loadedCount} unique keys from column ${colIndex1Based}`);
  }
  return set;
}

// ==================== YUN LOCALE-SAFE COLUMNS (NUMBER + US FORMAT) ====================

function isYunCA_(country) {
  const c = safeString_(country).toUpperCase();
  return c === "CA" || c === "CANADA";
}

function getYunPriceNumber_(country) {
  return isYunCA_(country) ? YUN_FOB_PRICE_CA : YUN_FOB_PRICE_DEFAULT;
}

/**
 * Cân nặng + giá = SỐ (export xlsx đúng kiểu cho Yun).
 * Format [$-409] để GSheet locale VN vẫn hiển thị 0.084 / 29, không thành 84.000.
 */
function repairYunLocaleColumns_(sheet, startRow, numRows) {
  if (!sheet || numRows < 1) return;
  repairYunWeightColumns_(sheet, startRow, numRows);
  repairYunPriceColumns_(sheet, startRow, numRows);
}

/** Đếm dòng data thật (có CustomerOrderNo), bỏ qua dòng trống phía dưới. */
function countYunDataRows_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const col = sheet.getRange(2, YUN_COLS.orderNo, last - 1, 1).getValues();
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    if (safeString_(col[i][0])) n = i + 1;
  }
  return n;
}

/** Xóa cột thừa sau LabelLink — export xlsx không lệch 74 cột template Yun. */
function trimYunExtraColumns_(sheet) {
  const totalCols = getYunTotalCols_();
  const lastCol = sheet.getLastColumn();
  if (lastCol > totalCols) {
    sheet.deleteColumns(totalCols + 1, lastCol - totalCols);
    Logger.log(`[YUN] Deleted ${lastCol - totalCols} extra columns`);
  }
}

function buildFixedYunRow_(row) {
  const totalCols = getYunTotalCols_();
  const out = row.slice(0, totalCols);
  while (out.length < totalCols) out.push("");

  const orderNo = safeString_(out[YUN_COLS.orderNo - 1]);
  if (!orderNo) return out;

  const country = safeString_(out[YUN_COLS.country - 1]).toUpperCase();
  if (country) out[YUN_COLS.country - 1] = country;

  out[YUN_COLS.orderNo - 1] = orderNo;
  out[YUN_COLS.routing - 1] = YUN_ROUTING_CODE;

  if (country === "GB" || country === "UK") {
    if (!safeString_(out[YUN_COLS.vatNumber - 1])) {
      out[YUN_COLS.vatNumber - 1] = YUN_VAT_NUMBER_GB;
    }
  }
  if (EU_COUNTRIES.has(country) && !safeString_(out[YUN_COLS.ioss - 1])) {
    out[YUN_COLS.ioss - 1] = YUN_IOSS_NUMBER;
  }

  out[YUN_COLS.zip - 1] = out[YUN_COLS.zip - 1] != null && out[YUN_COLS.zip - 1] !== ""
    ? String(out[YUN_COLS.zip - 1]) : "";
  out[YUN_COLS.packageNumber - 1] = 1;
  out[YUN_COLS.packageWeight - 1] = normalizeYunWeightNumber_(out[YUN_COLS.packageWeight - 1]);
  out[YUN_COLS.senderCountry - 1] = YUN_SENDER_COUNTRY;

  const desc = safeString_(out[YUN_COLS.itemDescription1 - 1]).toLowerCase();
  const isStrap = desc.includes("strap");
  const itemDesc = isStrap ? "strap leather" : "keyfob cover";

  out[YUN_COLS.currencyCode - 1] = YUN_CURRENCY_CODE;
  out[YUN_COLS.sku1 - 1] = isStrap ? YUN_SKU_STRAP : YUN_SKU_KEYFOB;
  if (!desc) {
    out[YUN_COLS.itemDescription1 - 1] = itemDesc;
    out[YUN_COLS.foreignItemDescription1 - 1] = itemDesc;
  }
  out[YUN_COLS.declaredQuantity1 - 1] = 1;

  const price = normalizeYunPriceNumber_(out[YUN_COLS.fobPrice1 - 1], country);
  out[YUN_COLS.fobPrice1 - 1] = price;
  out[YUN_COLS.sellingPrice1 - 1] = price;
  out[YUN_COLS.unitWeight1 - 1] = normalizeYunWeightNumber_(out[YUN_COLS.unitWeight1 - 1]);
  out[YUN_COLS.labelLink - 1] = "";

  return out;
}

/** Format cột export — số US + text cho mã đơn/zip. */
function applyYunExportFormats_(sheet, startRow, numRows) {
  if (!sheet || numRows < 1) return;
  sheet.getRange(startRow, YUN_COLS.orderNo, numRows, 1).setNumberFormat("@");
  sheet.getRange(startRow, YUN_COLS.zip, numRows, 1).setNumberFormat("@");
  sheet.getRange(startRow, YUN_COLS.packageNumber, numRows, 1).setNumberFormat(YUN_INT_FORMAT);
  sheet.getRange(startRow, YUN_COLS.declaredQuantity1, numRows, 1).setNumberFormat(YUN_INT_FORMAT);
  repairYunLocaleColumns_(sheet, startRow, numRows);
}

/**
 * Sửa toàn bộ dữ liệu sheet YUN để export xlsx khớp template Yun.
 * @return {number} số dòng đã sửa
 */
function repairYunSheetForExport_(sheet) {
  if (!sheet) return 0;
  ensureYunHeader_(sheet);
  trimYunExtraColumns_(sheet);

  const dataRows = countYunDataRows_(sheet);
  if (dataRows < 1) return 0;

  const totalCols = getYunTotalCols_();
  const range = sheet.getRange(2, 1, dataRows, totalCols);
  const rows = range.getValues();
  const fixed = rows.map(row => buildFixedYunRow_(row));
  range.setValues(fixed);
  applyYunExportFormats_(sheet, 2, dataRows);

  Logger.log(`[YUN] Repaired ${dataRows} rows on ${sheet.getName()}`);
  return dataRows;
}

function prepareYunExportBothSheets_() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const yunSheet = ensureSheet_(ss, YUN_SHEET_NAME);
    const yunTodaySheet = ensureSheet_(ss, YUN_TODAY_SHEET_NAME);

    ensureYunHeader_(yunSheet);
    ensureYunHeader_(yunTodaySheet);

    const n1 = repairYunSheetForExport_(yunSheet);
    const n2 = repairYunSheetForExport_(yunTodaySheet);

    const activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) {
      activeSs.toast(
        `✅ YUN export: ${n1} + ${n2} dòng | ${getYunTotalCols_()} cột | số US 0.084/29`,
        "Success",
        6
      );
    }
  } catch (err) {
    const activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) activeSs.toast(`❌ ${err.message}`, "Error", 5);
    throw err;
  }
}

function repairYunWeightColumns_(sheet, startRow, numRows) {
  if (!sheet || numRows < 1) return;
  const cols = [YUN_COLS.packageWeight, YUN_COLS.unitWeight1];
  cols.forEach(col => {
    const range = sheet.getRange(startRow, col, numRows, 1);
    range.setNumberFormat(YUN_WEIGHT_FORMAT);
    const vals = range.getValues();
    const fixed = vals.map(row => [normalizeYunWeightNumber_(row[0])]);
    range.setValues(fixed);
  });
}

function repairYunPriceColumns_(sheet, startRow, numRows) {
  if (!sheet || numRows < 1) return;
  const countryVals = sheet.getRange(startRow, YUN_COLS.country, numRows, 1).getValues();
  const priceCols = [YUN_COLS.fobPrice1, YUN_COLS.sellingPrice1];
  priceCols.forEach(col => {
    const range = sheet.getRange(startRow, col, numRows, 1);
    range.setNumberFormat(YUN_PRICE_FORMAT);
    const vals = range.getValues();
    const fixed = vals.map((row, i) => [
      normalizeYunPriceNumber_(row[0], countryVals[i][0])
    ]);
    range.setValues(fixed);
  });
}

function normalizeYunWeightNumber_(value) {
  if (typeof value === "number" && isFinite(value)) {
    if (value > 0 && value < 0.2) return value;
    if (value >= 1 || Math.abs(value - 84) < 0.001) return YUN_RATE;
    return YUN_RATE;
  }
  const s = String(value == null ? "" : value).trim().replace(/\s+/g, "");
  if (s === "0.084" || s === "0,084") return YUN_RATE;
  const m = s.match(/^0[.,](\d{3})$/);
  if (m) return parseInt(m[1], 10) / 1000;
  const n = Number(s.replace(",", "."));
  if (isFinite(n) && n > 0 && n < 0.2) return n;
  return YUN_RATE;
}

/** Parse giá khai báo YUN — không dùng parseMoneyString_ (29.000 → 29000). */
function parseYunDeclaredPrice_(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (value === 29 || value === 14) return value;
    if (value >= 1000 && value % 1000 === 0) return value / 1000;
    return Math.round(value);
  }
  const s = String(value).trim().replace(/\s+/g, "");
  const dotThousands = s.match(/^(\d{1,3})\.000$/);
  if (dotThousands) return parseInt(dotThousands[1], 10);
  const commaThousands = s.match(/^(\d{1,3}),000$/);
  if (commaThousands) return parseInt(commaThousands[1], 10);
  const digits = s.replace(/[^\d]/g, "");
  const n = parseInt(digits, 10);
  if (!isFinite(n)) return 0;
  if (n === 29000 || n === 2900) return 29;
  if (n === 14000 || n === 1400) return 14;
  return n;
}

function normalizeYunPriceNumber_(value, country) {
  const expected = getYunPriceNumber_(country);
  const n = parseYunDeclaredPrice_(value);
  if (n === 14) return YUN_FOB_PRICE_CA;
  if (n === 29) return YUN_FOB_PRICE_DEFAULT;
  return expected;
}

// ==================== YUNEXPRESS APPEND ====================

function appendYunRows_(sheet, yunObjs, mode) {
  if (!yunObjs || yunObjs.length === 0) return 0;

  ensureYunHeader_(sheet);
  
  // Load existing order numbers to prevent duplicates
  const existingOrderNos = loadExistingSet_(sheet, YUN_COLS.orderNo);
  
  // Filter out duplicates
  const uniqueYunObjs = yunObjs.filter(obj => {
    const orderNo = safeString_(obj.orderNo || "");
    if (!orderNo) return false;
    if (existingOrderNos.has(orderNo)) {
      Logger.log(`[YUN] Skip duplicate order: ${orderNo}`);
      return false;
    }
    existingOrderNos.add(orderNo); // Mark as seen
    return true;
  });
  
  if (uniqueYunObjs.length === 0) {
    Logger.log(`[YUN] All orders are duplicates, skipping append`);
    return 0;
  }
  
  const startRow = sheet.getLastRow() + 1;
  const totalCols = getYunTotalCols_();

  const values = uniqueYunObjs.map((obj, i) => {
    const rowNum = startRow + i;
    const rowArr = new Array(totalCols).fill("");

    // Basic order info
    rowArr[YUN_COLS.orderNo - 1] = obj.orderNo;
    rowArr[YUN_COLS.routing - 1] = YUN_ROUTING_CODE;
    // Trackingnumber (cột 3) - để trống hoặc có thể lấy từ tracking sau
    // rowArr[YUN_COLS.tracking - 1] = ""; // Để trống

    // VAT Number for GB (United Kingdom)
    if (obj.country === "GB" || obj.country === "UK") {
      rowArr[YUN_COLS.vatNumber - 1] = YUN_VAT_NUMBER_GB;
    }

    // IOSS for EU countries
    // LƯU Ý: AT = Austria (EU) → có IOSS, AU = Australia (không phải EU) → không có IOSS
    if (EU_COUNTRIES.has(obj.country)) {
      rowArr[YUN_COLS.ioss - 1] = YUN_IOSS_NUMBER;
      // Log để debug nếu cần
      if (obj.country === "AT") {
        Logger.log(`[YUN] AT (Austria) - EU country, IOSS code added`);
      }
    } else if (obj.country === "AU") {
      // AU = Australia (không phải EU) → không có IOSS code
      Logger.log(`[YUN] AU (Australia) - Non-EU country, no IOSS code`);
    }

    // Shipping address
    rowArr[YUN_COLS.country - 1] = obj.country;
    rowArr[YUN_COLS.name - 1] = obj.name;
    rowArr[YUN_COLS.street - 1] = obj.street;
    rowArr[YUN_COLS.city - 1] = obj.city;
    rowArr[YUN_COLS.province - 1] = obj.province;
    rowArr[YUN_COLS.zip - 1] = obj.zip ? String(obj.zip) : "";
    rowArr[YUN_COLS.phone - 1] = obj.phone;
    rowArr[YUN_COLS.email - 1] = obj.email;

    // Package info
    rowArr[YUN_COLS.packageNumber - 1] = 1;
    rowArr[YUN_COLS.packageWeight - 1] = YUN_RATE; // 0.084 kg (số)
    
    rowArr[YUN_COLS.senderCountry - 1] = YUN_SENDER_COUNTRY;

    // Product info
    const isStrap = (String(mode).toLowerCase() === "strap");
    const itemDesc = isStrap ? "strap leather" : "keyfob cover";
    rowArr[YUN_COLS.currencyCode - 1] = YUN_CURRENCY_CODE;
    rowArr[YUN_COLS.sku1 - 1] = isStrap ? YUN_SKU_STRAP : YUN_SKU_KEYFOB;
    rowArr[YUN_COLS.itemDescription1 - 1] = itemDesc;
    rowArr[YUN_COLS.foreignItemDescription1 - 1] = itemDesc; // ForeignItemDescription1 (cột 48)
    rowArr[YUN_COLS.declaredQuantity1 - 1] = 1;
    
    const priceNum = getYunPriceNumber_(obj.country);
    rowArr[YUN_COLS.fobPrice1 - 1] = priceNum;
    rowArr[YUN_COLS.sellingPrice1 - 1] = priceNum;
    rowArr[YUN_COLS.unitWeight1 - 1] = YUN_RATE;
    rowArr[YUN_COLS.labelLink - 1] = "";

    return buildFixedYunRow_(rowArr);
  });

  trimYunExtraColumns_(sheet);
  sheet.getRange(startRow, 1, values.length, totalCols).setValues(values);
  applyYunExportFormats_(sheet, startRow, values.length);

  return values.length;
}

// ==================== TRACKING APPEND ====================

function appendTrackingRows_(sheet, trackingMap) {
  if (!trackingMap || trackingMap.size === 0) return 0;

  ensureTrackingHeader_(sheet);

  const existingIds = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    vals.forEach(r => {
      const v = safeString_(r[0]);
      if (v) existingIds.add(v);
    });
  }

  const start = sheet.getLastRow() + 1;
  const rows = [];

  trackingMap.forEach(v => {
    const trackingId = safeString_(v.trackingId);
    if (trackingId && !existingIds.has(trackingId)) {
      rows.push([trackingId, v.shippingInfo]);
      existingIds.add(trackingId);
    }
  });

  if (rows.length === 0) return 0;

  sheet.getRange(start, 1, rows.length, 2).setValues(rows);
  sheet.getRange(start, 1, rows.length, 2).setWrap(true);

  return rows.length;
}

// ==================== ORDER GROUP FORMATTING ====================

function formatOrderGroups_(sheet, startRow, rowCount, colCount, orderIdCol) {
  if (rowCount === 0) return;
  
  try {
    const orderIdValues = sheet.getRange(startRow, orderIdCol, rowCount, 1).getValues();
    
    const groups = [];
    let currentGroup = null;
    
    for (let i = 0; i < orderIdValues.length; i++) {
      const cellValue = safeString_(orderIdValues[i][0]);
      const baseOrderId = cellValue.replace(/_[A-Z]+$/, "");
      
      if (!currentGroup || currentGroup.orderId !== baseOrderId) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { startRowIdx: i, endRowIdx: i, orderId: baseOrderId };
      } else {
        currentGroup.endRowIdx = i;
      }
    }
    if (currentGroup) groups.push(currentGroup);
    
    groups.forEach((group, idx) => {
      const actualStart = startRow + group.startRowIdx;
      const groupRowCount = group.endRowIdx - group.startRowIdx + 1;
      
      const bgColor = (idx % 2 === 0) ? ORDER_COLOR_1 : ORDER_COLOR_2;
      const groupRange = sheet.getRange(actualStart, 1, groupRowCount, colCount);
      groupRange.setBackground(bgColor);
      groupRange.setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
      
      if (groupRowCount > 1) {
        const noteRange = sheet.getRange(actualStart, 1, groupRowCount, 1);
        noteRange.merge();
        noteRange.setVerticalAlignment("middle");
        noteRange.setHorizontalAlignment("center");
      }
    });
  } catch (err) {
    Logger.log(`[FORMAT_ERROR] ${err.message || err}`);
  }
}

// ==================== PRIVATE DASHBOARD SYNC MENU ====================

/**
 * Menu function to set PRIVATE Sheet ID via prompt
 */
function setPrivateSheetIdMenu_() {
  const ui = SpreadsheetApp.getUi();
  const currentId = getPrivateSpreadsheetId_();
  
  const response = ui.prompt(
    "Set PRIVATE Dashboard Sheet ID",
    `Enter the Google Spreadsheet ID for PRIVATE dashboard:\n\nCurrent: ${currentId || "(not set)"}\n\nExample: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const sheetId = response.getResponseText().trim();
    if (sheetId) {
      try {
        setPrivateSpreadsheetId(sheetId);
        SpreadsheetApp.getActiveSpreadsheet().toast(
          `✅ PRIVATE Sheet ID set: ${sheetId}`,
          "Success",
          5
        );
      } catch (err) {
        SpreadsheetApp.getActiveSpreadsheet().toast(
          `❌ Error: ${err.message}`,
          "Error",
          5
        );
      }
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast("❌ Sheet ID cannot be empty", "Error", 3);
    }
  }
}

/**
 * Force update Dashboard header (fix old header issues)
 */
function forceUpdateDashboardHeader() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Dashboard");
    
    if (!sheet) {
      ss.toast("❌ Dashboard sheet not found", "Error", 5);
      return;
    }
    
    // Force update header
    ensureDashboardHeader_(sheet);
    
    ss.toast("✅ Dashboard header updated", "Success", 3);
  } catch (err) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `❌ Error: ${err.message}`,
      "Error",
      5
    );
  }
}

/**
 * Force update YUNEXPRESS & YUNEXPRESS TODAY headers
 * Dùng khi header trên sheet bị cũ/lệch cột
 */
function forceUpdateYunHeaders_() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const yunSheet = ensureSheet_(ss, YUN_SHEET_NAME);
    const yunTodaySheet = ensureSheet_(ss, YUN_TODAY_SHEET_NAME);
    
    const n1 = repairYunSheetForExport_(yunSheet);
    const n2 = repairYunSheetForExport_(yunTodaySheet);
    
    const activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) {
      activeSs.toast(
        `✅ YUN ${getYunTotalCols_()} cột | sửa ${n1}+${n2} dòng | 0.084 / 29|14 USD`,
        "Success",
        6
      );
    }
  } catch (err) {
    const activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) {
      activeSs.toast(`❌ Lỗi: ${err.message}`, "Error", 5);
    }
  }
}

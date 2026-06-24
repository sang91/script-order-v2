/*
 * =============================================================
 * == FILE: 13_LogoRules.gs
 * == MỤC ĐÍCH: Quy tắc trích xuất Logo cho từng Shop cụ thể
 * =============================================================
 * CẤU TRÚC CỘT (sau tịnh tiến):
 * A=Note, B=Product Info, C=Custom Key Photo, D=Logo (Image), 
 * E=Logo (Text), F=Order ID, G=Shop Name, H=Listing ID, I=Shipping Info, J=Unique Key
 */

/**
 * Hàm chính để chạy trích xuất Logo cho shop VietToanHandmade
 * - Đọc: Cột B = Product Info, Cột E = Logo (Text) override
 * - Ghi: Cột E = Logo (Text) kết quả
 */
function runVietToanLogoExtractor() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const selection = sheet.getActiveRange();
  
  if (!selection) {
    SpreadsheetApp.getUi().alert("⚠️ Vui lòng chọn vùng cần xử lý!");
    return;
  }
  
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();
  
  let count = 0;
  
  for (let i = 0; i < numRows; i++) {
    const currentRow = startRow + i;
    
    // Cột B: Product Info (index 2)
    const message = String(sheet.getRange(currentRow, 2).getValue() || "").trim();
    // Cột E: Logo (Text) - có thể đã có giá trị override (index 5)
    const override = String(sheet.getRange(currentRow, 5).getValue() || "").trim();
    
    // Thực hiện trích xuất theo quy tắc
    const logoResult = extractLogoVietToanRules_(message, override);
    
    // Trả về cột E = Logo (Text) (index 5)
    sheet.getRange(currentRow, 5).setValue(logoResult);
    count++;
  }
  
  ss.toast(`✅ Đã xử lý xong ${count} dòng cho VietToanHandmade`, "Logo Extractor");
}

/**
 * Logic trích xuất Logo VietToanHandmade theo Flowchart
 * @param {string} message - Nội dung cột B
 * @param {string} override - Nội dung cột E
 * @return {string} Mã Logo (Txx hoặc T)
 */
function extractLogoVietToanRules_(message, override) {
  // (1) Kiểm tra Logo Override (Cột E)
  if (override) {
    const cleanOverride = override.trim().toUpperCase();
    // Thử parse xem có prefix không (VD: S1, U1)
    if (/^[A-Z]\d{1,4}$/.test(cleanOverride)) {
      if (isValidLogoRange_(cleanOverride)) {
        const match = cleanOverride.match(/^([A-Z])(\d{1,4})$/);
        return normalizeLogoNumber_(cleanOverride, match[1]);
      }
    }
    // Nếu chỉ có số (VD: 5), mặc định prefix T
    if (/^\d{1,4}$/.test(cleanOverride)) {
      const formatted = "T" + cleanOverride;
      if (isValidLogoRange_(formatted)) {
        return normalizeLogoNumber_(formatted, "T");
      }
    }
  }

  // (2) Kiểm tra mã rõ ràng dạng "[Prefix][Số]" trong message (Cột B)
  // Regex tìm [Prefix][Số] từ 1-138
  const explicitMatch = message.match(/(?:^|[^A-Za-z])([A-Za-z])(\d{1,4})(?:[^0-9]|$)/i);
  if (explicitMatch && explicitMatch[2]) {
    const foundPrefix = explicitMatch[1].toUpperCase();
    const code = foundPrefix + explicitMatch[2];
    // Skip K (thường là keychain)
    if (foundPrefix !== "K") {
      if (isValidLogoRange_(code)) {
        return normalizeLogoNumber_(code, foundPrefix);
      }
    }
  }

  // (3) Kiểm tra số đứng một mình sau keyword (nếu không có chữ cái đi kèm)
  const contextKeywords = ["logo", "stamp", "code", "number", "no", "#"];
  
  for (let kw of contextKeywords) {
    const escapedKw = kw === "#" ? "#" : kw;
    const regex = new RegExp(escapedKw + "[\\s\\:\\#\\-]*(\\d{1,3})\\b", "i");
    const match = message.match(regex);
    
    if (match && match[1]) {
      const numStr = match[1];
      const fullMatch = match[0];
      const matchPos = match.index;
      
      // Kiểm tra nhiễu
      if (isNoiseDetected_(message, numStr, matchPos, fullMatch)) {
        continue;
      }
      
      // Nếu không có chữ cái đi kèm -> Mặc định gán prefix "T" cho VietToan
      const code = "T" + numStr;
      if (isValidLogoRange_(code)) {
        return normalizeLogoNumber_(code, "T");
      }
    }
  }

  // STOP: Mặc định trả về rỗng nếu không tìm thấy gì
  return ""; 
}

/**
 * Kiểm tra mã logo bất kỳ có nằm trong dải 1-138 không
 */
function isValidLogoRange_(code) {
  if (!code) return false;
  const upper = code.toUpperCase().trim();
  const match = upper.match(/^([A-Z])(\d{1,4})$/);
  if (match) {
    const num = parseInt(match[2], 10);
    return num >= 1 && num <= 138;
  }
  return false;
}

/**
 * Chuẩn hóa số thành định dạng Txx (ví dụ: 1 -> T01, 11 -> T11, T5 -> T05)
 * @param {string} input - Chuỗi chứa số hoặc mã
 * @return {string}
 */
function normalizeToTCode_(input) {
  if (!input) return "";
  // Lấy các chữ số
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  
  const num = parseInt(digits, 10);
  if (num < 10) return "T0" + num;
  return "T" + num;
}

/**
 * Kiểm tra mã Txx có nằm trong dải 1-110 không
 */
function isValidTCodeRange_(tCode) {
  if (!tCode || !tCode.startsWith("T")) return false;
  const num = parseInt(tCode.substring(1), 10);
  return num >= 1 && num <= 110;
}

/**
 * Kiểm tra xem số trích xuất được có phải là nhiễu không
 * - SĐT/Tracking (>= 9 chữ số liên tục)
 * - Size (gần mm, cm, inch)
 * - Năm (gần 20xx)
 */
function isNoiseDetected_(message, numStr, pos, fullMatch) {
  const text = message.toLowerCase();
  
  // 1. Kiểm tra SĐT/Tracking: xem số này có phải là một phần của chuỗi số dài >= 9 chữ số không
  const surroundingNumbers = message.match(/\d+/g) || [];
  for (let s of surroundingNumbers) {
    if (s.includes(numStr) && s.length >= 9) return true;
  }

  // 2. Kiểm tra Size: trong phạm vi 15 ký tự trước và sau số có mm, cm, inch không
  const checkRange = 15;
  const start = Math.max(0, pos - checkRange);
  const end = Math.min(text.length, pos + fullMatch.length + checkRange);
  const contextText = text.substring(start, end);
  
  if (/\b(mm|cm|inch|inches|size|width|length|height)\b/.test(contextText)) {
    return true;
  }

  // 3. Kiểm tra Năm: nếu số là 20xx hoặc nằm ngay cạnh 20xx
  // Lấy 4 chữ số xung quanh vị trí đó
  const nearText = text.substring(Math.max(0, pos - 2), pos + fullMatch.length + 2);
  const yearMatch = nearText.match(/\b20\d{2}\b/);
  if (yearMatch) return true;
  
  // Nếu numStr là một phần của chuỗi 4 số bắt đầu bằng 20 (ví dụ numStr="21" trong "2021")
  for (let s of surroundingNumbers) {
    if (s.length === 4 && s.startsWith("20")) {
      // Nếu numStr nằm trong s, coi như là năm
      if (s.includes(numStr)) return true;
    }
  }

  return false;
}

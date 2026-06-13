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
    const normalizedOverride = normalizeToTCode_(override);
    if (isValidTCodeRange_(normalizedOverride)) {
      return normalizedOverride;
    }
    // Nếu có override nhưng không hợp lệ (1-110) thì bỏ qua, đi tiếp xuống (2)
  }

  // (2) Kiểm tra mã rõ ràng dạng "Txx" trong message (Cột B)
  // Regex tìm T1 đến T110, biên từ (\b) để tránh dính số khác
  const explicitMatch = message.match(/\bT(\d{1,3})\b/i);
  if (explicitMatch) {
    const code = normalizeToTCode_(explicitMatch[1]);
    if (isValidTCodeRange_(code)) {
      return code;
    }
  }

  // (3) Kiểm tra ngữ cảnh logo
  const contextKeywords = ["logo", "stamp", "code", "number", "no", "#"];
  
  // Duyệt qua từng từ khóa ngữ cảnh
  for (let kw of contextKeywords) {
    // Escape special char #
    const escapedKw = kw === "#" ? "#" : kw;
    // Regex: từ khóa + dấu cách/ký tự đặc biệt tùy chọn + số 1-3 chữ số
    // Ví dụ: "logo 11", "stamp: 44", "code #12"
    const regex = new RegExp(escapedKw + "[\\s\\:\\#\\-]*(\\d{1,3})", "i");
    const match = message.match(regex);
    
    if (match) {
      const numStr = match[1];
      const fullMatch = match[0];
      const matchPos = match.index;
      
      // (3b) Kiểm tra nhiễu
      if (isNoiseDetected_(message, numStr, matchPos, fullMatch)) {
        continue; // Bị nhiễu thì tìm từ khóa tiếp theo
      }
      
      // (3c) Validate range 1..110
      const code = normalizeToTCode_(numStr);
      if (isValidTCodeRange_(code)) {
        return code;
      }
    }
  }

  // STOP: Không tìm ra hoặc không thỏa mãn điều kiện
  return "T"; 
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
  // Pad 0 cho số nhỏ hơn 10 (ví dụ T01, T09)
  // Lưu ý: Nếu user muốn giữ nguyên T1 thì bỏ pad. 
  // Thường hệ thống database cần T01-T09. 
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

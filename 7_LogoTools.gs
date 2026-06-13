/*
 * =============================================================
 * == FILE: 7_LogoTools.gs
 * == PHIÊN BẢN: v3.0 - SKU-ONLY + RULE ENGINE (2026-01-06)
 * ==
 * == TRIẾT LÝ:
 * ==   "SKU quyết định xe, Code quyết định luật, 
 * ==    Gemini chỉ đọc personalization"
 * ==
 * == TÍNH NĂNG:
 * ==   1. 2 MODES: PRODUCTION (tiết kiệm) / DEBUG (chi tiết)
 * ==   2. SKU-ONLY vehicle detection (không detect từ personalization)
 * ==   3. Rule Engine: màu dập, key mapping, logo regex
 * ==   4. Post-process AI output với rules
 * ==   5. API Stability: retry + fallback models + Vietnamese fallback
 * ==
 * == YÊU CẦU: Cần file 8_ModelMap.gs để hoạt động
 * =============================================================
 */

// ==================== CẤU HÌNH HỆ THỐNG ====================

// 1. Model chính và fallback models
const GEMINI_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash"
];

// 2. Cấu hình delay và retry
const API_DELAY_MS = 500;   // 0.5 giây/đơn (nhanh!)
const MAX_RETRIES = 3;      // Số lần retry tối đa cho mỗi model
const BASE_BACKOFF_MS = 1000; // Base delay cho exponential backoff

// ===== LẤY API KEY =====
// Cách thiết lập: Project Settings > Script Properties > Thêm GEMINI_API_KEY

/**
 * Lấy API Key từ Script Properties (bảo mật)
 */
function getGeminiApiKey_() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (apiKey && apiKey.startsWith("AIza")) {
    return apiKey;
  }
  return "";
}

// ==================== PROMPT MODES ====================
// MODE A: DEBUG/TRAIN - prompt dài, chỉ dùng khi test
// MODE B: PRODUCTION - prompt ngắn ≤150 tokens, dùng chạy hàng loạt

/**
 * Chọn mode: 'PRODUCTION' hoặc 'DEBUG'
 * PRODUCTION: tiết kiệm token, dùng cho chạy thực tế
 * DEBUG: prompt chi tiết, dùng cho testing
 */
const PROMPT_MODE = 'PRODUCTION';

/**
 * PRODUCTION PROMPT - Đầy đủ yêu cầu, tối ưu token
 */
const GEMINI_PROMPT_PRODUCTION = `Phân tích PERSONALIZATION cho KEYFOB DA.

ƯU TIÊN TAG NGẮN:
- 2–5 chữ cái đơn lẻ (MMP, Dmm, abc) KHÔNG có từ logo → TAG NGẮN
- "stamp the name X" / "name: X" / "engrave X" → TAG NGẮN (dập TÊN)
- Tên người (John, SEAMUS, Dixon…) → TAG NGẮN

LOGO CHỈ GHI KHI:
- "logo X" / "stamp logo X" / "emboss X" kèm số hoặc mô tả hình
- Mô tả hình ảnh: cross, bowtie, emblem, horse, flag, cobra…
- Số đi kèm từ logo: logo 44, stamp G42
- Chuỗi chữ đơn lẻ KHÔNG có từ logo → KHÔNG phải logo
- Màu dập CHỈ: Gold/Silver/Red/Blue/Green
- none/no logo/skip → "Không có logo"
- Không có thông tin logo → không ghi dòng

TAG NGẮN:
- Tên/initials/SĐT → Tag ngắn: <tên> - <màu nếu có>

MÓC:
Key 1→Móc bạc | Key 2→Móc đen | Key 3→Vòng bạc | Key 4→Vòng đen | Key 5-10 nguyên
Không ghi key → không ghi dòng

CHỈ/VIỀN/NÚT: ghi màu tiếng Anh

CẤM TUYỆT ĐỐI:
- KHÔNG viết câu dẫn, giải thích, suy luận
- KHÔNG dùng: "Dựa trên…", "Theo thông tin…"
- CHỈ xuất đúng format
- Không hiểu → dịch nguyên văn tiếng Việt

PERSONALIZATION:
`;

/**
 * DEBUG PROMPT (dài hơn, chi tiết hơn)
 * Dùng khi test hoặc train AI
 */
const GEMINI_PROMPT_DEBUG = `VAI TRÒ:
Bạn là chuyên gia phân tích cá nhân hóa đơn KEYFOB DA cho xưởng thủ công Việt Nam.
Nhiệm vụ: đọc Personalization (raw) và viết lại yêu cầu sản xuất
NGẮN – RÕ – ĐÚNG – KHÔNG MẤT Ý KHÁCH.

NGUYÊN TẮC BẮT BUỘC:
- KHÔNG suy đoán xe / brand / model (đã có hệ thống khác xử lý)
- KHÔNG tự thêm thông tin
- KHÔNG bỏ sót chi tiết khách ghi
- KHÔNG ghi dòng nào nếu KHÔNG có dữ liệu cho dòng đó
- CHỈ DỊCH khi KHÔNG PHÂN TÍCH ĐƯỢC

CHỈ PHÂN TÍCH CÁC MỤC SAU:
1. Logo (code số/chữ, mô tả hình ảnh, hoặc none/skip)
2. Tag ngắn (tên người, initials, số điện thoại)
3. Keychain (Key 1-10)
4. Chỉ / Viền / Nút bấm (nếu khách ghi)

MÀU DẬP HỢP LỆ (chỉ 5 màu):
Gold, Silver, Red, Blue, Green

QUY ƯỚC KEYCHAIN:
Key 1 → Móc bạc | Key 2 → Móc đen | Key 3 → Vòng bạc | Key 4 → Vòng đen
Key 5-10 → ghi nguyên

ĐỊNH DẠNG OUTPUT:
Logo: ...
Tag ngắn: ...
<Móc bạc | Móc đen | Vòng bạc | Vòng đen | Key 5-10>
Chỉ: <màu>
Viền: <màu>
Nút bấm: <màu>

(hoặc dịch nguyên văn nếu không phân tích được)

PERSONALIZATION:
`;

/**
 * Lấy prompt theo mode hiện tại
 */
function getPrompt_() {
  return PROMPT_MODE === 'PRODUCTION' ? GEMINI_PROMPT_PRODUCTION : GEMINI_PROMPT_DEBUG;
}

// ==================== CẤU HÌNH BẢNG LOGO (Dùng cho Sync) ====================
const LOGO_TABLE = {
  "xilacrafts": { "LY1": "LY1", "LY2": null, "LY3": null },
  "viettoanhandmade": { "LY1": "LY1", "LY2": null, "LY3": null },
  "quangduocstore": { "LY1": "LY1", "LY2": null, "LY3": null },
  "_default_": { "LY1": "LY1", "LY2": null, "LY3": null }
};
const SKU_LOGO_MAP = {};
const MANUAL_PHOTO_CODES = new Set(["LY2", "LY3", "KEY5", "KEY6", "KEY 5", "KEY 6"]);
const LOGO_BATCH_LIMIT = 50;

// ==================== CHỨC NĂNG CHÍNH ====================

/**
 * 1. AI Analyze - Phân tích text và trích xuất Logo vào Cột E
 * QUY TẮC:
 * - Không có Personalization → BỎ QUA (không sửa Cột B)
 * - Đã có "Móc bạc/đen" → BỎ QUA (đã xử lý rồi)
 * - Có Personalization → Gọi AI, ghi kết quả vào Cột B + trích xuất Logo vào Cột E
 * - KHÔNG tự động map ảnh (user tự map từ Cột E)
 */
function aiAnalyzeLogo_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const selection = sheet.getActiveRange();
  
  if (!selection) { SpreadsheetApp.getUi().alert("⚠️ Vui lòng chọn ô cần phân tích!"); return; }
  
  const apiKey = getGeminiApiKey_();
  if (!apiKey) { SpreadsheetApp.getUi().alert("⚠️ Chưa nhập API Key! Vào Script Properties > GEMINI_API_KEY"); return; }
  
  const numRows = selection.getNumRows();
  const numCols = selection.getNumColumns();
  const startRow = selection.getRow();
  
  if (numRows * numCols > LOGO_BATCH_LIMIT) {
    SpreadsheetApp.getUi().alert(`⚠️ Chỉ chọn tối đa ${LOGO_BATCH_LIMIT} ô!`); return;
  }
  
  // Thông báo bắt đầu
  const modeText = PROMPT_MODE === 'PRODUCTION' ? 'PRODUCTION' : 'DEBUG';
  ss.toast(`🔄 Đang phân tích với AI [${modeText}]...`, "AI Analyze", 120);
  
  // Shop prefix map
  const SHOP_PREFIX = {
    "viettoanhandmade": "T",
    "xilacrafts": "X",
    "laxiluxurycrafts": "L",
    "quangduocstore": "Q",
    "longnamleather": "N",
    "khhandcrafts": "K"
  };
  
  let analyzed = 0;
  let logoExtracted = 0;
  let skipped = 0;
  
  for (let r = 1; r <= numRows; r++) {
    for (let c = 1; c <= numCols; c++) {
      const cell = selection.getCell(r, c);
      const absoluteRow = startRow + r - 1;
      let text = String(cell.getValue() || "").trim();
      
      // Bỏ qua nếu ô trống
      if (!text) {
        skipped++;
        continue;
      }
      
      // Bỏ qua nếu đã có kết quả dịch (Móc bạc, Móc đen, Vòng bạc = đã xử lý xong)
      if (text.includes("Móc bạc") || text.includes("Móc đen") || text.includes("Vòng bạc") || text.includes("Vòng đen")) {
        skipped++;
        continue;
      }

      // === KIỂM TRA CÓ PERSONALIZATION KHÔNG ===
      const hasPersonalization = /Personalization\s*:/i.test(text);
      
      // Không có Personalization → Thêm "Móc bạc" vào cuối (giữ nguyên nội dung gốc)
      // Điều này đánh dấu AI đã xử lý ô này
      if (!hasPersonalization) {
        cell.setValue(text + "\n\nMóc bạc");
        analyzed++;
        
        // Vẫn trích xuất Logo vào Cột E nếu có thể
        const shopName = String(sheet.getRange(absoluteRow, 7).getValue() || "").trim();
        const shopNameLower = shopName.toLowerCase();
        const prefix = SHOP_PREFIX[shopNameLower] || "T";
        const sku = String(sheet.getRange(absoluteRow, 2).getValue() || "").trim();
        
        let boardPrefix = prefix;
        if (prefix === "Q") boardPrefix = "S";
        const boardCode = extractBoardCodeFromSKU_(sku, boardPrefix);
        
        if (boardCode) {
          // Không có personalization → chỉ ghi mã bảng + prefix (chờ gõ tay số logo)
          sheet.getRange(absoluteRow, 5).setValue(boardCode + prefix);
          logoExtracted++;
        }
        
        continue;
      }


      // === LẤY SHOP NAME TỪ CỘT G ===
      const shopName = String(sheet.getRange(absoluteRow, 7).getValue() || "").trim();
      const shopNameLower = shopName.toLowerCase();
      const prefix = SHOP_PREFIX[shopNameLower] || "T";

      let boardPrefix = prefix;
      if (prefix === "Q") boardPrefix = "S";

      // === LẤY SKU TỪ CỘT B ===
      const skuCell = sheet.getRange(absoluteRow, 2).getValue();
      const sku = String(skuCell || "").trim();
      
      // === TRÍCH XUẤT MÃ BẢNG TỪ SKU ===
      const boardCode = extractBoardCodeFromSKU_(sku, boardPrefix);
      
      // === PRE-DETECT BRAND/MODEL TỪ SKU ===
      const vehicleInfo = preDetectVehicle(sku);
      if (vehicleInfo.displayText) {
        Logger.log(`Row ${absoluteRow}: Detected ${vehicleInfo.displayText}`);
      }
      
      // === TÌM VỊ TRÍ PERSONALIZATION ===
      const keywordMatch = text.match(/(Personalization|Logo:|Custom:|Detail:|Stamp:)/i);
      
      let textToSend = text;
      let textBefore = "";
      
      if (keywordMatch) {
        textBefore = text.substring(0, keywordMatch.index).trim();
        textToSend = text.substring(keywordMatch.index);
      }
      
      // === GỌI AI ===
      const aiResult = callGeminiApi_(textToSend, apiKey);
      
      // === POST-PROCESS ===
      let finalResult = postProcessAIOutput(aiResult);
      finalResult = finalResult.split('\n').filter(line => line.trim()).join('\n');
      
      // Kiểm tra kết quả AI có hợp lệ không (không phải "Không có dữ liệu" hoặc rỗng)
      if (!finalResult || finalResult.toLowerCase().includes("không có dữ liệu") || finalResult.length < 3) {
        // AI không xử lý được → BỎ QUA, KHÔNG SỬA CỘT B
        skipped++;
        continue;
      }
      
      // === THÊM THÔNG TIN HÃNG XE/MODEL VÀO OUTPUT ===
      if (vehicleInfo.displayText) {
        finalResult = `[${vehicleInfo.displayText}]\n${finalResult}`;
      }
      
      // === GHI KẾT QUẢ VÀO CỘT B ===
      let newText = "";
      if (textBefore) {
        newText = textBefore + "\n\n" + finalResult;
      } else {
        newText = finalResult;
      }

      
      cell.setValue(newText);
      analyzed++;
      
      // === TRÍCH XUẤT LOGO VÀO CỘT E ===
      const logoNumber = extractLogoFromAIResult_(finalResult, prefix);
      
      if (boardCode) {
        let logoTextResult = "";
        
        if (logoNumber) {
          // Có cả 2: T04T01
          logoTextResult = boardCode + logoNumber;
        } else {
          // Chỉ có mã bảng: T04T (chờ gõ tay)
          logoTextResult = boardCode + prefix;
        }
        
        // Ghi vào Cột E
        sheet.getRange(absoluteRow, 5).setValue(logoTextResult);
        logoExtracted++;
      }
      
      // Delay giữa các request
      Utilities.sleep(API_DELAY_MS);
    }
  }
  
  ss.toast(`✅ Hoàn tất: ${analyzed} phân tích, ${logoExtracted} logo trích xuất, ${skipped} bỏ qua`, "AI Analyze", 5);
}


/**
 * Trích xuất số Logo từ kết quả AI
 * Tìm dòng "Logo: Txx" hoặc số sau từ "logo"
 */
function extractLogoFromAIResult_(aiResult, prefix) {
  if (!aiResult) return "";
  
  // Tìm dòng "Logo: T01" hoặc "Logo: \"T01\""
  const logoLineMatch = aiResult.match(/Logo:\s*["']?([A-Z]?\d{1,3})["']?/i);
  if (logoLineMatch && logoLineMatch[1]) {
    const num = logoLineMatch[1].replace(/[^0-9]/g, "");
    if (num && parseInt(num, 10) >= 1 && parseInt(num, 10) <= 110) {
      return normalizeLogoNumber_(prefix + num, prefix);
    }
  }
  
  // Fallback: tìm số đầu tiên sau từ "logo"
  const fallbackMatch = aiResult.match(/logo[^\d]*(\d{1,3})/i);
  if (fallbackMatch && fallbackMatch[1]) {
    const num = parseInt(fallbackMatch[1], 10);
    if (num >= 1 && num <= 110) {
      return normalizeLogoNumber_(prefix + num, prefix);
    }
  }
  
  return "";
}


/**
 * 2. Hàm gọi API Gemini - Có retry, fallback model, và Vietnamese translation fallback
 * 
 * Logic xử lý lỗi:
 * 1. Retry với exponential backoff + jitter cho mỗi model
 * 2. Fallback qua các model khác nếu model chính thất bại
 * 3. Nếu tất cả thất bại → trả về bản dịch tiếng Việt của text gốc
 */
function callGeminiApi_(text, apiKey) {
  // Danh sách tất cả các model sẽ thử (model chính + fallback)
  const allModels = [GEMINI_MODEL, ...FALLBACK_MODELS];
  
  // Thử từng model
  for (let modelIndex = 0; modelIndex < allModels.length; modelIndex++) {
    const currentModel = allModels[modelIndex];
    
    // Thử retry với model hiện tại
    const result = tryModelWithRetry_(text, apiKey, currentModel, MAX_RETRIES);
    
    if (result !== null) {
      return result;
    }
    
    // Log khi chuyển sang model khác (không hiển thị cho user)
    Logger.log(`Model ${currentModel} thất bại, thử model tiếp theo...`);
  }
  
  // Tất cả model đều thất bại → Fallback sang bản dịch tiếng Việt
  Logger.log("Tất cả model thất bại. Trả về bản dịch tiếng Việt.");
  return translateToVietnamese_(text);
}

/**
 * 3. Thử gọi API với một model cụ thể, có retry với exponential backoff
 * @returns {string|null} Kết quả từ API hoặc null nếu thất bại
 */
function tryModelWithRetry_(text, apiKey, model, maxRetries) {
  const prompt = getPrompt_(); // Lấy prompt theo mode (PRODUCTION hoặc DEBUG)
  
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt + text }
        ]
      }
    ]
  };
  
  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  
  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(baseUrl, options);
      const httpCode = response.getResponseCode();
      
      // Xử lý HTTP 5xx errors
      if (httpCode >= 500 && httpCode < 600) {
        Logger.log(`HTTP ${httpCode} - Model ${model}, attempt ${attempt}/${maxRetries}`);
        if (attempt < maxRetries) {
          sleepWithBackoff_(attempt);
          continue;
        }
        return null; // Hết retry cho model này
      }
      
      const data = JSON.parse(response.getContentText());
      
      // Xử lý lỗi từ API response
      if (data.error) {
        const errorCode = data.error.code;
        const errorMessage = (data.error.message || "").toLowerCase();
        
        // Lỗi có thể retry: 429, RESOURCE_EXHAUSTED, overloaded
        if (errorCode === 429 || 
            errorMessage.includes("resource_exhausted") ||
            errorMessage.includes("rate limit") ||
            errorMessage.includes("overloaded") ||
            errorMessage.includes("quota")) {
          
          Logger.log(`API Error (retryable): ${errorCode} - ${data.error.message}`);
          if (attempt < maxRetries) {
            sleepWithBackoff_(attempt);
            continue;
          }
          return null; // Hết retry cho model này
        }
        
        // Lỗi khác (không retry được với model này)
        Logger.log(`API Error (non-retryable): ${data.error.message}`);
        return null;
      }
      
      // Kiểm tra response có dữ liệu hợp lệ
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (resultText && resultText.trim()) {
        return resultText.trim();
      }
      
      // Response rỗng hoặc thiếu candidates → retry
      Logger.log(`Empty response from ${model}, attempt ${attempt}/${maxRetries}`);
      if (attempt < maxRetries) {
        sleepWithBackoff_(attempt);
        continue;
      }
      return null;
      
    } catch (e) {
      Logger.log(`Exception: ${e.message} - Model ${model}, attempt ${attempt}/${maxRetries}`);
      if (attempt < maxRetries) {
        sleepWithBackoff_(attempt);
        continue;
      }
      return null;
    }
  }
  
  return null;
}

/**
 * 4. Sleep với exponential backoff + random jitter
 */
function sleepWithBackoff_(attempt) {
  // Exponential: 1s, 2s, 4s, 8s...
  const exponentialDelay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
  // Random jitter: thêm 0-500ms ngẫu nhiên
  const jitter = Math.floor(Math.random() * 500);
  const totalDelay = Math.min(exponentialDelay + jitter, 30000); // Max 30s
  
  Logger.log(`Sleeping ${totalDelay}ms (attempt ${attempt})`);
  Utilities.sleep(totalDelay);
}

/**
 * 5. Fallback: Dịch text gốc sang tiếng Việt đơn giản
 * Không sử dụng AI, chỉ làm sạch và format cơ bản
 */
function translateToVietnamese_(text) {
  if (!text || !text.trim()) {
    return "Không có dữ liệu";
  }
  
  let result = text.trim();
  
  // Từ điển dịch cơ bản (các từ thường gặp trong personalization)
  const translations = {
    // Logo & Stamping
    "logo": "logo",
    "stamp": "dập",
    "stamping": "dập",
    "emboss": "dập nổi",
    "deboss": "dập chìm",
    "heat stamp": "dập nhiệt",
    "none": "không có",
    "no logo": "không có logo",
    "skip": "bỏ qua",
    
    // Names & Tags
    "name": "tên",
    "initials": "chữ cái đầu",
    "phone": "số điện thoại",
    "phone number": "số điện thoại",
    
    // Colors
    "gold": "vàng",
    "silver": "bạc",
    "red": "đỏ",
    "blue": "xanh dương",
    "green": "xanh lá",
    "white": "trắng",
    "black": "đen",
    "brown": "nâu",
    
    // Keychain types
    "key 1": "móc bạc",
    "key 2": "móc đen",
    "key 3": "vòng bạc",
    "key 4": "vòng đen",
    "keychain 1": "móc bạc",
    "keychain 2": "móc đen",
    "keychain 3": "vòng bạc",
    "keychain 4": "vòng đen",
    "keychain": "móc khóa",
    
    // Stitching & Edge
    "stitching": "chỉ",
    "thread": "chỉ",
    "edge": "viền",
    "edge paint": "sơn viền",
    "border": "viền",
    
    // Tags
    "tag 1": "tag ngắn",
    "small tag": "tag ngắn",
    "lanyard": "tag dài",
    
    // Common
    "color": "màu",
    "text": "chữ",
    "custom": "tùy chỉnh",
    "personalization": "cá nhân hóa",
    "leather": "da",
    "crazy horse": "da crazy horse"
  };
  
  // Thay thế từ tiếng Anh bằng tiếng Việt (case-insensitive)
  for (const [eng, vie] of Object.entries(translations)) {
    const regex = new RegExp(`\\b${eng}\\b`, 'gi');
    result = result.replace(regex, vie);
  }
  
  // Làm sạch và format
  result = result
    .replace(/\s+/g, ' ')           // Xóa space thừa
    .replace(/\n\s*\n/g, '\n')      // Xóa dòng trống
    .replace(/:\s+/g, ': ')         // Chuẩn hóa sau dấu :
    .replace(/\s*\/\s*/g, ' / ')    // Chuẩn hóa dấu /
    .trim();
  
  return result;
}

// ==================== CÁC HÀM HỖ TRỢ KHÁC (Sync Logo) ====================

function syncLogoToColumnD_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const selection = sheet.getActiveRange();
  if (!selection) { SpreadsheetApp.getUi().alert("⚠️ Chọn ô cần sync!"); return; }
  
  const numRows = selection.getNumRows();
  const startRow = selection.getRow();
  const shopColIndex = findShopColumnIndex_(sheet);
  
  for (let r = 0; r < numRows; r++) {
    const absoluteRow = startRow + r;
    const cell = selection.getCell(r + 1, 1);
    const text = String(cell.getValue() || "").trim();
    
    const logoCode = extractQuotedLogo_(text);
    if (!logoCode || isManualPhotoCode_(logoCode)) continue;
    
    const shopName = shopColIndex ? String(sheet.getRange(absoluteRow, shopColIndex).getValue() || "").toLowerCase().trim() : "_default_";
    const sku = extractSku_(sheet, absoluteRow);
    const logoKey = buildLogoKey_(logoCode, sku);
    const resolvedLogo = resolveLogo_(logoKey, sku, shopName);
    
    if (resolvedLogo) writeColumnD_(sheet, absoluteRow, resolvedLogo);
    else writeColumnD_(sheet, absoluteRow, logoKey);
  }
  ss.toast("✅ Đã Sync xong!", "Sync Logo", 3);
}

function extractQuotedLogo_(text) {
  if (!text) return null;
  const match1 = text.match(/Logo:\s*["']([A-Z0-9]{1,10})["']/i);
  if (match1) return match1[1].trim().toUpperCase();
  
  const aiBlockMatch = text.match(/\[AI\]([\s\S]*?)\[\/AI\]/i);
  if (aiBlockMatch) {
    const logoInBlock = aiBlockMatch[1].match(/^Logo:\s*([A-Z0-9]{1,10})\b/im);
    if (logoInBlock) return logoInBlock[1].trim().toUpperCase();
    // Nếu là CUSTOM thì không lấy mã để sync
    if (aiBlockMatch[1].includes("CUSTOM")) return null;
  }
  return null;
}

function extractLogoCodeFromSku_(sku) {
  if (!sku) return "";
  const normalized = sku.trim().replace(/\s+/g, " ");
  if (normalized.includes(" ")) return normalized.split(" ").pop().toUpperCase();
  if (normalized.includes("_")) return normalized.split("_").pop().toUpperCase();
  return normalized.toUpperCase();
}

function buildLogoKey_(code, sku) { return code ? code.toUpperCase() : extractLogoCodeFromSku_(sku); }

function extractSku_(sheet, row) {
  const info = String(sheet.getRange(row, 2).getValue() || "");
  const match = info.match(/SKU\s*:\s*([^\n]+)/i);
  return match ? match[1].trim().toUpperCase() : "";
}

function resolveLogo_(code, sku, shopName) {
  if (!code) return null;
  const codeUpper = code.toUpperCase().trim();
  if (isManualPhotoCode_(codeUpper)) return null;
  
  const shopTable = LOGO_TABLE[shopName] || LOGO_TABLE["_default_"];
  if (shopTable[codeUpper] !== undefined) return shopTable[codeUpper];
  if (sku && SKU_LOGO_MAP[sku]) return SKU_LOGO_MAP[sku];
  for (const key in shopTable) {
    if (codeUpper.includes(key) && shopTable[key]) return shopTable[key];
  }
  if (/^(LY[1-9]|T\d+|KEY\d+)$/i.test(codeUpper)) return codeUpper;
  return null;
}

function writeColumnD_(sheet, row, logo) { if (logo) sheet.getRange(row, 4).setValue(logo); }

function isManualPhotoCode_(code) {
  if (!code) return false;
  const norm = code.toUpperCase().replace(/\s+/g, "");
  if (/^LY[23]$/.test(norm)) return true;
  if (/^KEY[5-9]$/.test(norm)) return true;
  for (const mc of MANUAL_PHOTO_CODES) { if (norm === mc.toUpperCase().replace(/\s+/g, "")) return true; }
  return false;
}

function findShopColumnIndex_(sheet) { return sheet.getName().includes("Strap") ? 5 : 6; }

// ==================== TẠO MENU ====================
// Menu đã được gộp vào onOpen() trong 5_Sheets.gs
// function onOpen() {
//   SpreadsheetApp.getUi()
//     .createMenu('LOGO Tools')
//     .addItem('⚡ AI Analyze (Phân tích)', 'aiAnalyzeLogo_')
//     .addItem('🔄 Sync Logo (Đồng bộ)', 'syncLogoToColumnD_')
//     .addToUi();
// }
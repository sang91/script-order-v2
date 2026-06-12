/*
 * =============================================================
 * == FILE: 10_TypeMapping_Auto.gs
 * == MỤC ĐÍCH: Tự động map Phôi chìa khi nhận đơn từ Etsy
 * == LOGIC: Hỗ trợ MODE_TYPE và TYPE_LINKS (cũ)
 * =============================================================
 */

// ==================== DRIVE URL VALIDATION ====================

/**
 * Validate Drive image URL with 3 states: OK / DEAD / UNKNOWN
 * @param {string} url - Image URL to validate
 * @return {object} { status, url, reason, fileId }
 */
function validateDriveLive3_(url) {
  if (!url) {
    return { status: "DEAD", url: "", reason: "empty_url", fileId: null };
  }
  
  const s = safeString_(url);
  
  // Not Drive link = OK (avoid quota usage)
  if (!s.includes("drive.google.com")) {
    return { status: "OK", url: s, reason: "not_drive_link", fileId: null };
  }
  
  // Folder link = DEAD
  if (s.includes("drive.google.com/drive/folders") || 
      s.includes("drive.google.com/folder")) {
    return { status: "DEAD", url: s, reason: "folder_link", fileId: null };
  }
  
  // Extract file ID
  const fileId = extractDriveFileId_(s);
  if (!fileId) {
    return { status: "DEAD", url: s, reason: "no_file_id", fileId: null };
  }
  
  // Try to access Drive file
  try {
    const file = DriveApp.getFileById(fileId);
    const verifiedId = file.getId();
    return { status: "OK", url: s, reason: "drive_file_valid", fileId: verifiedId };
  } catch (err) {
    const reason = err.message && err.message.includes("not found") 
      ? "drive_file_not_found" 
      : (err.message && err.message.includes("permission") 
        ? "drive_file_no_permission" 
        : "drive_file_error");
    return { status: "UNKNOWN", url: s, reason: reason, fileId: fileId };
  }
}

/**
 * Check if cell is empty (no formula and no display value)
 * @param {Range} range - Cell range
 * @return {boolean}
 */
function isCellEmptyForImage_(range) {
  const f = safeString_(range.getFormula());
  const dv = safeString_(range.getDisplayValue());
  return !f && !dv;
}

// ==================== MAPPING LABELS ====================

/**
 * Get variation labels from Mapping sheet for a listingId
 * @param {string} listingId - Listing ID
 * @return {object} { ok, keyTypeLabel, colorLabel, reason }
 */
function getMappingLabels_(listingId) {
  if (!listingId) {
    return { ok: false, keyTypeLabel: "", colorLabel: "", reason: "no_listing_id" };
  }

  try {
    const ss = SpreadsheetApp.openById(TYPE_LINKS_SSID);
    const sheet = ss.getSheetByName(MAPPING_SHEET);
    
    if (!sheet) {
      return { ok: false, keyTypeLabel: "", colorLabel: "", reason: "mapping_sheet_not_found" };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { ok: false, keyTypeLabel: "", colorLabel: "", reason: "mapping_sheet_empty" };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const mapListingId = safeString_(row[0]);
      
      if (mapListingId === listingId) {
        const rawD = safeString_(row[3]); // Column D
        const rawF = safeString_(row[5]); // Column F
        
        const candidateNames = [rawD, rawF];
        let keyTypeLabel = "";
        let colorLabel = "";
        
        // Find keyTypeLabel (contains "key" and "type")
        for (let j = 0; j < candidateNames.length; j++) {
          const candidate = candidateNames[j];
          if (!candidate) continue;
          
          const candidateLower = candidate.toLowerCase();
          if (candidateLower.includes("key") && candidateLower.includes("type") && !keyTypeLabel) {
            keyTypeLabel = candidate;
          }
        }
        
        // Find colorLabel (contains "color" or "primary")
        for (let j = 0; j < candidateNames.length; j++) {
          const candidate = candidateNames[j];
          if (!candidate) continue;
          
          const candidateLower = candidate.toLowerCase();
          if ((candidateLower.includes("color") || candidateLower.includes("primary")) && !colorLabel) {
            colorLabel = candidate;
          }
        }
        
        if (!keyTypeLabel) {
          return { ok: false, keyTypeLabel: "", colorLabel: "", reason: "key_type_label_not_found" };
        }
        
        if (!colorLabel) {
          return { ok: false, keyTypeLabel: "", colorLabel: "", reason: "color_label_not_found" };
        }
        
        if (keyTypeLabel === colorLabel) {
          return { ok: false, keyTypeLabel: "", colorLabel: "", reason: "labels_ambiguous_same_string" };
        }
        
        return { ok: true, keyTypeLabel: keyTypeLabel, colorLabel: colorLabel, reason: "ok" };
      }
    }
    
    return { ok: false, keyTypeLabel: "", colorLabel: "", reason: "listing_id_not_found" };
  } catch (err) {
    return { ok: false, keyTypeLabel: "", colorLabel: "", reason: "error: " + (err.message || err) };
  }
}

// ==================== TYPE_LINKS MAP ====================

/**
 * Load TYPE_LINKS map from spreadsheet FRESH (no cache)
 * @return {Map} Map of listingId||normalizedType -> imageUrl
 */
function getTypeLinksMapFresh_() {
  const map = new Map();
  try {
    const ss = SpreadsheetApp.openById(TYPE_LINKS_SSID);
    const sheet = ss.getSheetByName(TYPE_LINKS_SHEET);
    if (!sheet) return map;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return map;

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    data.forEach(row => {
      const listingId = safeString_(row[0]);
      const typeText = safeString_(row[2]);  // Column C
      const imageUrl = safeString_(row[7]);  // Column H

      if (listingId && typeText && imageUrl) {
        const normalizedFull = normalizeType_(typeText);
        const keyFull = `${listingId}||${normalizedFull}`;
        map.set(keyFull, imageUrl);
        
        const typeCode = extractTypeCode_(typeText);
        if (typeCode) {
          const normalizedCode = normalizeType_(typeCode);
          const keyCode = `${listingId}||${normalizedCode}`;
          map.set(keyCode, imageUrl);
        }
      }
    });
  } catch (err) {
    Logger.log("Error loading TYPE_LINKS map fresh: " + (err.message || err));
  }
  return map;
}

/**
 * Load TYPE_LINKS map with cache (20 minutes)
 * @param {boolean} forceReload - Bypass cache if true
 * @return {Map} Map of listingId||normalizedType -> imageUrl
 */
function getTypeLinksMap_(forceReload) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "TYPE_LINKS_MAP";
  
  if (forceReload) {
    cache.remove(cacheKey);
  } else {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        const map = new Map();
        data.forEach(([key, value]) => map.set(key, value));
        return map;
      } catch (e) {
        // If cache parse fails, reload
      }
    }
  }

  const map = new Map();
  try {
    const ss = SpreadsheetApp.openById(TYPE_LINKS_SSID);
    const sheet = ss.getSheetByName(TYPE_LINKS_SHEET);
    if (!sheet) return map;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return map;

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    data.forEach(row => {
      const listingId = safeString_(row[0]);
      const typeText = safeString_(row[2]);
      const imageUrl = safeString_(row[7]);

      if (listingId && typeText && imageUrl) {
        const normalizedFull = normalizeType_(typeText);
        const keyFull = `${listingId}||${normalizedFull}`;
        map.set(keyFull, imageUrl);
        
        const typeCode = extractTypeCode_(typeText);
        if (typeCode) {
          const normalizedCode = normalizeType_(typeCode);
          const keyCode = `${listingId}||${normalizedCode}`;
          map.set(keyCode, imageUrl);
        }
      }
    });

    // Cache for 20 minutes
    const cacheData = Array.from(map.entries());
    cache.put(cacheKey, JSON.stringify(cacheData), 1200);
  } catch (err) {
    Logger.log("Error loading TYPE_LINKS map: " + (err.message || err));
  }
  return map;
}

// ==================== MULTI-SHOP TYPE_LINKS ====================

/**
 * Load TYPE_LINKS map cho 1 shop cụ thể (FRESH - no cache)
 * @param {string} shopName - Tên shop
 * @return {Map} Map of listingId||normalizedType -> imageUrl
 */
function getTypeLinksMapByShopFresh_(shopName) {
  const config = getShopTypeLinksConfig_(shopName);
  const map = new Map();
  
  try {
    const ss = SpreadsheetApp.openById(config.ssid);
    const sheet = ss.getSheetByName(config.sheet);
    if (!sheet) {
      Logger.log(`[TYPE_LINKS] Sheet not found: ${config.sheet} in ${config.ssid}`);
      return map;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return map;

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    data.forEach(row => {
      const listingId = safeString_(row[0]);
      const typeText = safeString_(row[2]);
      const imageUrl = safeString_(row[7]);

      if (listingId && typeText && imageUrl) {
        const normalizedFull = normalizeType_(typeText);
        const keyFull = `${listingId}||${normalizedFull}`;
        map.set(keyFull, imageUrl);
        
        const typeCode = extractTypeCode_(typeText);
        if (typeCode) {
          const normalizedCode = normalizeType_(typeCode);
          const keyCode = `${listingId}||${normalizedCode}`;
          map.set(keyCode, imageUrl);
        }
      }
    });
    
    Logger.log(`[TYPE_LINKS] Loaded ${map.size} entries for shop: ${shopName}`);
  } catch (err) {
    Logger.log(`[TYPE_LINKS_ERROR] shop=${shopName}, ssid=${config.ssid}, error=${err.message || err}`);
  }
  return map;
}

/**
 * Load TYPE_LINKS map cho 1 shop với cache (20 phút)
 * @param {string} shopName - Tên shop
 * @param {boolean} forceReload - Bypass cache
 * @return {Map} Map of listingId||normalizedType -> imageUrl
 */
function getTypeLinksMapByShop_(shopName, forceReload) {
  const config = getShopTypeLinksConfig_(shopName);
  const cache = CacheService.getScriptCache();
  const cacheKey = `TYPE_LINKS_${config.ssid}`;
  
  if (forceReload) {
    cache.remove(cacheKey);
  } else {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        const map = new Map();
        data.forEach(([key, value]) => map.set(key, value));
        return map;
      } catch (e) {
        // Parse failed, reload
      }
    }
  }

  const map = new Map();
  try {
    const ss = SpreadsheetApp.openById(config.ssid);
    const sheet = ss.getSheetByName(config.sheet);
    if (!sheet) return map;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return map;

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    data.forEach(row => {
      const listingId = safeString_(row[0]);
      const typeText = safeString_(row[2]);
      const imageUrl = safeString_(row[7]);

      if (listingId && typeText && imageUrl) {
        const normalizedFull = normalizeType_(typeText);
        const keyFull = `${listingId}||${normalizedFull}`;
        map.set(keyFull, imageUrl);
        
        const typeCode = extractTypeCode_(typeText);
        if (typeCode) {
          const normalizedCode = normalizeType_(typeCode);
          const keyCode = `${listingId}||${normalizedCode}`;
          map.set(keyCode, imageUrl);
        }
      }
    });

    // Cache for 20 minutes
    const cacheData = Array.from(map.entries());
    cache.put(cacheKey, JSON.stringify(cacheData), 1200);
  } catch (err) {
    Logger.log(`[TYPE_LINKS_ERROR] shop=${shopName}, error=${err.message || err}`);
  }
  return map;
}

// ==================== CODE_TYPE LOOKUP (cấu trúc mới) ====================
// Columns: A=Shop, B=NAME, C=CODE, D=TYPE, E=FOLDER_LINK, F=IMAGE_LINK
// Lookup key: CODE||TYPE → IMAGE_LINK (filtered by Shop Name)

/**
 * Load CODE_TYPE map cho 1 shop (FRESH - no cache)
 * Cấu trúc sheet: C=CODE, D=TYPE, F=IMAGE_LINK
 * Lookup key: CODE|TYPE → IMAGE_LINK
 * @param {string} shopName - Tên shop
 * @return {Map} Map of CODE|TYPE → imageUrl
 */
function getCodeTypeMapByShopFresh_(shopName) {
  const config = getShopImageConfig_(shopName);
  const map = new Map();
  
  try {
    const ss = SpreadsheetApp.openById(config.ssid);
    const sheet = ss.getSheetByName(config.sheet);
    if (!sheet) {
      Logger.log(`[CODE_TYPE] Sheet not found: ${config.sheet} in ${config.ssid}`);
      return map;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return map;

    // Read C:F (C=CODE, D=TYPE, E=FOLDER_LINK, F=IMAGE_LINK)
    // getRange(2, 3, ...) = starting at row 2, column C (3)
    const data = sheet.getRange(2, 3, lastRow - 1, 4).getValues(); // C, D, E, F
    
    data.forEach(row => {
      const code = safeString_(row[0]).toUpperCase().trim();  // Column C = CODE
      const type = safeString_(row[1]).toUpperCase().trim();  // Column D = TYPE
      const imageUrl = safeString_(row[3]).trim();            // Column F = IMAGE_LINK (skip E)

      if (code && type && imageUrl) {
        // Key format: CODE|TYPE (uppercase)
        const key = `${code}|${type}`;
        map.set(key, imageUrl);
      }
    });
    
    Logger.log(`[CODE_TYPE] Loaded ${map.size} entries for shop: ${shopName} from sheet: ${config.sheet}`);
  } catch (err) {
    Logger.log(`[CODE_TYPE_ERROR] shop=${shopName}, ssid=${config.ssid}, error=${err.message || err}`);
  }
  return map;
}

// ==================== UNIFIED IMAGE LOOKUP ====================

/**
 * Load image map cho 1 shop dựa vào mode (TYPE_LINKS hoặc CODE_TYPE)
 * @param {string} shopName - Tên shop
 * @return {object} { mode, map }
 */
function getImageMapByShopFresh_(shopName) {
  const config = getShopImageConfig_(shopName);
  
  if (config.mode === LOOKUP_MODE.TYPE_LINKS) {
    // TYPE_LINKS mode: lookup theo listing_id + type
    return {
      mode: LOOKUP_MODE.TYPE_LINKS,
      map: getTypeLinksMapByShopFresh_(shopName)
    };
  } else {
    // CODE_TYPE mode: lookup theo CODE + TYPE
    return {
      mode: LOOKUP_MODE.CODE_TYPE,
      map: getCodeTypeMapByShopFresh_(shopName)
    };
  }
}

/**
 * Lookup image URL based on shop's mode
 * @param {object} imageData - { mode, map } from getImageMapByShopFresh_
 * @param {string} listingId - Listing ID (used for TYPE_LINKS mode)
 * @param {string} keyTypeValue - Type value like "TYPE 2B" or "A01"
 * @param {string} productSku - Product SKU like "VW_ALL_MODEL_DVT6410" (used for CODE_TYPE mode)
 * @return {string} Image URL or empty string
 */
function lookupImageUrl_(imageData, listingId, keyTypeValue, productSku) {
  if (!imageData || !imageData.map) return "";
  
  const map = imageData.map;
  
  if (imageData.mode === LOOKUP_MODE.TYPE_LINKS) {
    // TYPE_LINKS mode: lookup by listing_id + type
    if (!listingId || !keyTypeValue) return "";
    
    const normalizedType = normalizeType_(keyTypeValue);
    const lookupKey = `${listingId}||${normalizedType}`;
    let imageUrl = map.get(lookupKey);
    
    // Fallback: try TYPE code only
    if (!imageUrl) {
      const typeCode = extractTypeCode_(keyTypeValue);
      if (typeCode && typeCode !== keyTypeValue) {
        const keyCode = `${listingId}||${normalizeType_(typeCode)}`;
        imageUrl = map.get(keyCode);
      }
    }
    
    return imageUrl || "";
  } else {
    // CODE_TYPE mode: lookup by CODE + TYPE
    // Need to extract CODE from SKU and use keyTypeValue as TYPE
    if (!productSku || !keyTypeValue) return "";
    
    // Extract CODE from SKU
    const code = extractCodeFromSku_(productSku);
    if (!code) return "";
    
    // TYPE is the keyTypeValue (e.g., "A01", "C5")
    const type = keyTypeValue.toUpperCase().trim();
    
    // === Attempt 1: Exact match ===
    const lookupKey = `${code}|${type}`;
    let imageUrl = map.get(lookupKey);
    
    // === Attempt 2: Extract code phần đầu (e.g., "C5" from "C5 - Standard Cover") ===
    if (!imageUrl) {
      const typeCodeMatch = type.match(/^([A-Z]\d{1,3})/);
      if (typeCodeMatch && typeCodeMatch[1] !== type) {
        const fallbackKey = `${code}|${typeCodeMatch[1]}`;
        imageUrl = map.get(fallbackKey);
        if (imageUrl) {
          Logger.log(`[CODE_TYPE_LOOKUP] Fallback matched: ${fallbackKey}`);
        }
      }
    }
    
    // === Attempt 3: Extract "TYPE X" format (e.g., "TYPE 6" → "TYPE 6") ===
    if (!imageUrl) {
      const typeCode = extractTypeCode_(keyTypeValue);
      if (typeCode && typeCode !== type) {
        const fallbackKey2 = `${code}|${typeCode.toUpperCase()}`;
        imageUrl = map.get(fallbackKey2);
        if (imageUrl) {
          Logger.log(`[CODE_TYPE_LOOKUP] TYPE-code matched: ${fallbackKey2}`);
        }
      }
    }
    
    Logger.log(`[CODE_TYPE_LOOKUP] sku=${productSku}, code=${code}, type=${type}, key=${lookupKey}, found=${!!imageUrl}`);
    
    return imageUrl || "";
  }
}

/**
 * Extract CODE from product SKU
 * CODE patterns (always at END of SKU):
 *   - XILA + 4 digits (xilacrafts)     → XILA1234
 *   - QDS + 4 digits (QuangDuocStore)  → QDS1234
 *   - DVT + 4 digits (VietToanHandmade) → DVT1234
 *   - LNL + 4 digits (LongNamLeather)   → LNL1234
 *   - LAXI + 4 digits (LAXILuxuryCrafts) → LAXI1234
 *   - KHN + 4 digits (KHHANDCRAFTS)     → KHN1234
 * 
 * Examples:
 *   "VW_ALL_MODEL_DVT6410" → "DVT6410"
 *   "ACURA VT2434" → "VT2434" (fallback pattern)
 *   "BMW_X5_QDS1234" → "QDS1234"
 *   "PORSCHE_XILA5678" → "XILA5678"
 * 
 * @param {string} sku - Product SKU
 * @return {string} CODE or empty string
 */
function extractCodeFromSku_(sku) {
  if (!sku) return "";
  
  const s = safeString_(sku).toUpperCase();
  
  // logic mới: mã bảng nằm ở cuối SKU và có dấu cách phía trước (VD: QDS1234 S04)
  // Ta sẽ loại bỏ phần mã bảng này trước nếu nó tồn tại để tránh nhầm mã logo S04 với chữ S trong QDS
  const cleanSku = s.replace(/\s[A-Z]\d{2}$/, "").trim();
  
  // Bây giờ mới tìm mã sản phẩm (PREFIX + 4 số) trong phần SKU đã sạch
  const match = cleanSku.match(/([A-Z]{2,4}\d{4})/);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return "";
}



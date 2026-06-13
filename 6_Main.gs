/*
 * =============================================================
 * == FILE: 6_Main.gs
 * == MỤC ĐÍCH: doPost endpoint & business logic
 * =============================================================
 */

// ==================== BUILD FUNCTIONS ====================

function normalizeOrderForYun_(product, customerOrderNo) {
  const country = normalizeCountryCode_(product.shipping_country);
  const zip = normalizeZip_(product.shipping_zip, country);
  const province = (country === "US")
    ? normalizeUSState_(product.shipping_state)
    : safeString_(product.shipping_state);

  const street = [product.shipping_address || "", product.shipping_address_2 || ""].join(" ").trim();
  const rawPhone = safeString_(product.shipping_phone);
  const digits = rawPhone.replace(/\D/g, "");
  const safePhone = digits || "0000000000";

  return {
    orderNo: safeString_(customerOrderNo || product.order_id),
    name: safeString_(product.shipping_name),
    street,
    city: safeString_(product.shipping_city),
    province,
    zip,
    country,
    phone: safePhone,
    email: safeString_(product.buyer_email)
  };
}

function buildProductInfo_(product) {
  const lines = [];

  let sku = safeString_(product.product_sku);
  if (!sku) sku = safeString_(product.product_title);
  if (sku) lines.push(`SKU : ${sku}`);

  const variations = decodeHtml_(product.variations || "");
  if (!variations) return lines.join("\n\n");

  // Phát hiện FORMAT: Format cũ LUÔN có label "Personalization:" hoặc "Logo:" (exact) làm container multi-line.
  // Format mới dùng từng field riêng biệt (VD: "Customize Your Logo ✨", "Keychain option")
  // và KHÔNG BAO GIỜ có "Personalization:" hay "Logo:" đơn giản.
  // → Dấu hiệu phân biệt DUY NHẤT đáng tin: sự hiện diện của label exact "personalization"/"logo".
  //
  // Guard: label phải bắt đầu bằng chữ cái → tránh nhầm "1. Logo Code:" trong Personalization cũ
  const isNewFormat = !variations.split("\n").some(line => {
    const ci = line.indexOf(":");
    if (ci <= 0) return false;
    const lbl = line.substring(0, ci).trim().toLowerCase();
    if (!/^[a-z]/.test(lbl)) return false;
    return lbl === "personalization" || lbl === "logo";
  });

  if (isNewFormat) {
    return buildProductInfoNewFormat_(lines, variations);
  }

  // ===== FORMAT CŨ: NGUYÊN GỐC - KHÔNG THAY ĐỔI =====
  // SỬA 2026-01-28: Lấy TOÀN BỘ text sau "Personalization:" (multi-line)
  const variationLines = variations.split("\n").map(x => safeString_(x)).filter(Boolean);
  let personalizationText = "";
  let inPersonalization = false;
  
  for (let i = 0; i < variationLines.length; i++) {
    const t = variationLines[i];
    if (isNotRequestedLogo_(t)) continue;

    const colonIdx = t.indexOf(":");
    if (colonIdx > 0) {
      const label = t.substring(0, colonIdx).trim().toLowerCase();
      const value = t.substring(colonIdx + 1).trim();
      
      if (label.includes("color")) {
        if (value) lines.push(`Màu: ${value}`);
        continue;
      }
      
      if (label.includes("type")) {
        if (value) lines.push(`Type: ${value}`);
        continue;
      }
      
      if (label === "logo" || label === "personalization") {
        // Bắt đầu thu thập personalization (có thể multi-line)
        inPersonalization = true;
        if (value && !isNotRequestedLogo_(value)) {
          personalizationText = value;
        }
        continue;
      }
    }
    
    // Nếu đang trong personalization, nối thêm các dòng tiếp theo
    if (inPersonalization) {
      personalizationText += "\n" + t;
    } else {
      lines.push(t);
    }
  }
  
  // Thêm personalization đầy đủ vào cuối
  if (personalizationText.trim()) {
    lines.push(`Personalization: ${personalizationText.trim()}`);
  }

  return lines.join("\n\n");
}


/**
 * FORMAT MỚI: Etsy update với nhiều field riêng biệt (độc lập với format cũ)
 * Primary Color, Key Type, Logo Code & Notes, Keychain Option,
 * Choose Cover Style, Name & Phone on SmartTag, Key Fob Photos...
 */
function buildProductInfoNewFormat_(lines, variations) {
  const variationLines = variations.split("\n").map(x => safeString_(x)).filter(Boolean);

  // Thu thập tất cả fields TỪ INPUT (thứ tự bất kỳ từ Etsy)
  let colorText    = "";  // Màu
  let keyTypeText  = "";  // Key Type (C1, C5, TYPE 4...)
  let coverStyle   = "";  // Kín / Khoét
  let keychainText = "";  // Móc
  let logoText     = "";  // Mã logo (Q40, B67...)
  let tagText      = "";  // Tag name (SmartTag)

  for (const t of variationLines) {
    if (isNotRequestedLogo_(t)) continue;

    const colonIdx = t.indexOf(":");
    if (colonIdx <= 0) continue;

    const label = t.substring(0, colonIdx).trim().toLowerCase();
    const value = t.substring(colonIdx + 1).trim();
    if (!value) continue;

    // ① LOẠI NGAY: file upload, ảnh, link (VD: "Upload Your Smart Key: 1 file")
    if (label.includes("upload") || label.includes("photo") ||
        label.includes("image") || label.includes("picture") ||
        label.includes("file")  || label.includes("pic")) {
      continue;
    }

    // ② COLOR (Màu)
    if (label.includes("color") || label.includes("colour") || label.includes("leather")) {
      colorText = value;

    // ③ KEY TYPE
    } else if (label.includes("type")) {
      keyTypeText = value;

    // ④ COVER STYLE (Kín/Khoét)
    } else if (label.includes("cover") || label === "style cover") {
      const v = value.toLowerCase();
      if (v.includes("full"))     coverStyle = "Kín";
      else if (v.includes("cut")) coverStyle = "Khoét";

    // ⑤ KEYCHAIN / MÓC
    } else if (label.includes("keychain") || label.includes("key chain") || label.includes("móc")) {
      keychainText = value;

    // ⑥ PERSONALIZATION (hybrid format cũ lẫn mới)
    } else if (label === "personalization") {
      if (!isNotRequestedLogo_(value)) logoText = value;

    // ⑦ LOGO — bắt "logo", "emboss", "stamp"
    //    "emboss" CHỈ khi KHÔNG có "text"/"tag"/"name"
    //    → tránh "Text to be embossed on the tag" bị nhầm là logo selection
    //    "stamp" CHỈ khi không có "name"/"phone"/"text"
    } else if (
      label.includes("logo") ||
      (label.includes("emboss") && !label.includes("text") && !label.includes("tag") && !label.includes("name")) ||
      (label.includes("stamp") && !label.includes("name") && !label.includes("phone") && !label.includes("text"))
    ) {
      if (!isNotRequestedLogo_(value)) logoText = value;

    // ⑧ TAG / NAME / PHONE / EMBOSSED TEXT — tên khách, số điện thoại, text dập lên tag
    //    Bắt cả "Text to be embossed on the tag" (có "tag" hoặc "text"+"emboss")
    //    "Upload Your Smart Key" đã bị loại ở ① (có "upload")
    } else if (
      label.includes("tag")   ||
      label.includes("smart") ||
      label.includes("name")  ||
      label.includes("phone") ||
      label.includes("engrav") ||
      (label.includes("text") && label.includes("emboss"))
    ) {
      tagText = value;
    }
    // Các field còn lại → bỏ qua
  }

  // Output theo THỨ TỰ CỐ ĐỊNH (độc lập với thứ tự input)
  // SKU đã có sẵn trong lines[0]

  // 1. Màu
  if (colorText) lines.push(`Màu: ${colorText}`);

  // 2. Type + Cover Style
  if (keyTypeText) {
    const typeDisplay = coverStyle
      ? `Type: ${keyTypeText} - ${coverStyle}`
      : `Type: ${keyTypeText}`;
    lines.push(typeDisplay);
  }

  // 3. Móc (Keychain)
  if (keychainText) lines.push(`Móc: ${keychainText}`);

  // 4. Logo (dùng "Logo:" để persMatch nhận ra)
  if (logoText) lines.push(`Logo: ${logoText}`);

  // 5. Tag (SmartTag name)
  if (tagText) lines.push(`Tag: ${tagText}`);

  // Join \n\n giống format cũ → nhất quán
  return lines.join("\n\n");
}


function getTrackingId_(product) {
  const note = safeString_(product.note);
  if (note) return note;
  return safeString_(product.order_id);
}

function buildShippingBlock_(product) {
  const parts = [];

  const name = safeString_(product.shipping_name);
  if (name) parts.push(name);

  const addr1 = safeString_(product.shipping_address);
  const addr2 = safeString_(product.shipping_address_2);
  const address = [addr1, addr2].filter(Boolean).join(" ");
  if (address) parts.push(address);

  const city = safeString_(product.shipping_city);
  if (city) parts.push(city);

  const state = safeString_(product.shipping_state);
  if (state) parts.push(state);

  const zipRaw = safeString_(product.shipping_zip);
  if (zipRaw) {
    const country = safeString_(product.shipping_country).toUpperCase();
    const normalizedZip = normalizeZip_(zipRaw, country);
    if (normalizedZip) parts.push(normalizedZip);
  }

  const country = safeString_(product.shipping_country);
  if (country) parts.push(country);

  return parts.join("\n");
}

// ==================== MAIN ENDPOINT ====================

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("❌ No data received");
    }

    const data = JSON.parse(e.postData.contents);
    if (data.action !== "addOrders" || !Array.isArray(data.orders) || data.orders.length === 0) {
      return ContentService.createTextOutput("❌ Invalid payload format");
    }

    const exportScope = safeString_(data.export_scope).toLowerCase();
    const isTodayScope = exportScope === "ship_today_tomorrow";
    const mode = safeString_(data.shop_mode).toLowerCase();
    const sheetName = (mode === "strap") ? SHEET_STRAP : SHEET_KEYFOB;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const orderSheet = ensureSheet_(ss, sheetName);
    const trackSheet = ensureSheet_(ss, SHEET_TRACK);
    const yunSheet = ensureSheet_(ss, YUN_SHEET_NAME);
    const yunTodaySheet = ensureSheet_(ss, YUN_TODAY_SHEET_NAME);

    if (mode === "strap") ensureHeader_(orderSheet, HEADER_STRAP, "A1:H1");
    else ensureHeader_(orderSheet, HEADER_KEYFOB, "A1:I1");

    ensureTrackingHeader_(trackSheet);
    ensureYunHeader_(yunSheet);
    ensureYunHeader_(yunTodaySheet);

    const existingYunOrderSet = loadExistingSet_(yunSheet, YUN_COLS.orderNo);
    const existingYunTodayOrderSet = loadExistingSet_(yunTodaySheet, YUN_COLS.orderNo);

    const keyCol = (mode === "strap") ? 8 : 9;
    const existingKeySet = loadExistingSet_(orderSheet, keyCol);
    const seenPayloadKeys = new Set();

    const rowsOrder = [];
    const trackingMap = new Map();

    // Multi-shop: cache imageData theo shop (hỗ trợ cả TYPE_LINKS và CODE_TYPE)
    const shopImageCache = new Map(); // shopName -> { mode, map }
    
    /**
     * Get or load image data for a shop (unified: TYPE_LINKS hoặc CODE_TYPE)
     */
    function getOrLoadImageDataForShop_(shopName) {
      const key = String(shopName || "").toLowerCase().trim() || "_default_";
      if (shopImageCache.has(key)) {
        return shopImageCache.get(key);
      }
      const imageData = getImageMapByShopFresh_(shopName);
      shopImageCache.set(key, imageData);
      return imageData;
    }

    const yunRowsAll = [];
    const yunRowsToday = [];
    const yunPushedAll = new Set();
    const yunPushedToday = new Set();

    const payloadCounter = new Map();
    const printedOrderInfo = new Set();
    const printedNoteForOrder = new Set();

    data.orders.forEach(product => {
      if (!product || typeof product !== "object") return;

      const rawId = safeString_(product.order_id);
      if (!rawId) return;

      const rawNote = safeString_(product.note);
      const note = rawNote ? rawNote : "Mã Đơn ?";
      const customerOrderNo = safeString_(rawNote || rawId);

      // YUN write
      // Normalize customerOrderNo để đảm bảo so sánh chính xác
      const normalizedOrderNo = safeString_(customerOrderNo).trim();
      
      if (isTodayScope) {
        if (!yunPushedToday.has(rawId)) {
          yunPushedToday.add(rawId);
          if (normalizedOrderNo && !existingYunTodayOrderSet.has(normalizedOrderNo)) {
            yunRowsToday.push(normalizeOrderForYun_(product, normalizedOrderNo));
            existingYunTodayOrderSet.add(normalizedOrderNo);
          } else if (normalizedOrderNo && existingYunTodayOrderSet.has(normalizedOrderNo)) {
            Logger.log(`[YUN TODAY] Skip duplicate order: ${normalizedOrderNo}`);
          }
        }
        return;
      } else {
        if (!yunPushedAll.has(rawId)) {
          yunPushedAll.add(rawId);
          if (normalizedOrderNo && !existingYunOrderSet.has(normalizedOrderNo)) {
            yunRowsAll.push(normalizeOrderForYun_(product, normalizedOrderNo));
            existingYunOrderSet.add(normalizedOrderNo);
          } else if (normalizedOrderNo && existingYunOrderSet.has(normalizedOrderNo)) {
            Logger.log(`[YUN ALL] Skip duplicate order: ${normalizedOrderNo}`);
          }
        }
      }

      // TRACKING
      if (!isTodayScope) {
        const trackingId = getTrackingId_(product);
        const shippingInfoBlock = buildShippingBlock_(product);
        if (!trackingMap.has(rawId)) {
          trackingMap.set(rawId, { trackingId, shippingInfo: shippingInfoBlock });
        }
      }

      // ORDER SHEET
      let rawSku = safeString_(product.product_sku);
      if (!rawSku) rawSku = safeString_(product.product_title);
      if (!rawSku) rawSku = "NO SKU";

      const rawVariations = safeString_(product.variations);
      const qty = parseInt(product.product_quantity || 1, 10);
      const actualQty = qty > 0 ? qty : 1;

      // Build unique key từ order_id + sku + variations để check trùng
      // Normalize để đảm bảo so sánh chính xác (remove extra spaces, newlines)
      const normalizedVariations = safeString_(rawVariations).replace(/\s+/g, " ").trim();
      const normalizedSku = safeString_(rawSku).trim();
      const normalizedOrderId = safeString_(rawId).trim();
      const uniqueKeyBase = `${normalizedOrderId}_${normalizedSku}_${normalizedVariations}`.trim();
      
      // Check duplicate - dùng has() thay vì loop
      if (seenPayloadKeys.has(uniqueKeyBase)) {
        Logger.log(`[ORDER] ⚠️ DUPLICATE SKIPPED (in payload): ${uniqueKeyBase.substring(0, 100)}...`);
        return;
      }
      if (existingKeySet.has(uniqueKeyBase)) {
        Logger.log(`[ORDER] ⚠️ DUPLICATE SKIPPED (in sheet): ${uniqueKeyBase.substring(0, 100)}...`);
        return;
      }
      seenPayloadKeys.add(uniqueKeyBase);
      existingKeySet.add(uniqueKeyBase);
      Logger.log(`[ORDER] ✅ New order accepted: ${normalizedOrderId} (base key: ${uniqueKeyBase.substring(0, 80)}...)`);

      const listingId = safeString_(product.listing_id);

      const shipArr = [
        product.shipping_name, product.shipping_address, product.shipping_address_2,
        product.shipping_city, product.shipping_state, product.shipping_zip,
        product.shipping_country, product.shipping_phone
      ];
      const shipInfoFull = shipArr.filter(Boolean).join("\n");

      const productInfo = buildProductInfo_(product);
      const shopName = safeString_(product.shop_name);

      // Build KEY TYPE image cell (Column C)
      let imageCell = "";
      // Build LOGO image cell (Column D) - will be set later
      let logoCell = "";
      
      if (mode === "strap") {
        const rawImageUrl = safeString_(product.product_image);
        const normalizedUrl = normalizeEtsyImageUrl_(rawImageUrl);
        const fixedImageUrl = driveLinkToImage_(normalizedUrl) || normalizedUrl;
        imageCell = fixedImageUrl
          ? `=IFERROR(IMAGE("${fixedImageUrl.replace(/"/g, '""')}";1);"")`
          : "";
      } else {
        // ========== KEY TYPE MAPPING (Column C) ==========
        if (listingId) {
          const variationsArray = product.variations_array || (Array.isArray(product.variations) ? product.variations : null);
          let keyTypeValue = extractKeyTypeFromVariationsArray_(variationsArray);
          
          Logger.log(`[TYPE_DEBUG] Shop=${shopName}, SKU=${rawSku}`);
          Logger.log(`[TYPE_DEBUG] Step1 variationsArray=${variationsArray ? 'YES(' + variationsArray.length + ')' : 'NULL'}, result="${keyTypeValue}"`);
          
          if (!keyTypeValue && product.variations) {
            keyTypeValue = parseKeyTypeFromVariations_(product.variations);
            Logger.log(`[TYPE_DEBUG] Step2 parseKeyType result="${keyTypeValue}", variations="${String(product.variations).substring(0, 100)}"`);
            
            // Normalize: nếu value có text thừa (VD: "C5 - Standard Cover"), trích chỉ code
            if (keyTypeValue && !/^[A-Z]\d{1,3}$/i.test(keyTypeValue)) {
              const codeMatch = keyTypeValue.match(/^([A-Z]\d{1,3})/i);
              if (codeMatch) {
                Logger.log(`[TYPE_EXTRACT] Normalized "${keyTypeValue}" -> "${codeMatch[1]}"`);
                keyTypeValue = codeMatch[1].toUpperCase();
              }
            }
          }
          
          // Fallback 1: Extract Type from Product Info text (e.g., "Type: C5")
          if (!keyTypeValue && productInfo) {
            const typeMatch = productInfo.match(/Type\s*:\s*([A-Z]\d{1,3})/i);
            if (typeMatch && typeMatch[1]) {
              keyTypeValue = typeMatch[1].toUpperCase();
              Logger.log(`[TYPE_DEBUG] Step3 productInfo fallback="${keyTypeValue}"`);
            }
          }
          
          // Fallback 2: Scan ALL variation lines for [Letter][1-3 digits] code
          if (!keyTypeValue && product.variations) {
            const varText = decodeHtml_(safeString_(product.variations));
            const lines = varText.split("\n");
            for (const line of lines) {
              const colonIdx = line.indexOf(":");
              if (colonIdx > 0) {
                const val = line.substring(colonIdx + 1).trim().toUpperCase();
                if (/^[A-Z]\d{1,3}$/.test(val)) {
                  keyTypeValue = val;
                  Logger.log(`[TYPE_EXTRACT] Broad scan found: "${val}" from line: "${line.trim()}"`);
                  break;
                }
              }
            }
          }
          
          Logger.log(`[TYPE_DEBUG] FINAL keyTypeValue="${keyTypeValue}"`);
          
          if (!keyTypeValue) {
            if (hasWidthOrLengthVariation_(product.variations)) {
              const rawImageUrl = safeString_(product.product_image);
              const normalizedUrl = normalizeEtsyImageUrl_(rawImageUrl);
              const fixedImageUrl = driveLinkToImage_(normalizedUrl) || normalizedUrl;
              if (fixedImageUrl) {
                imageCell = `=IFERROR(IMAGE("${fixedImageUrl.replace(/"/g, '""')}";1);"")`;
              }
            }
          } else {
            // Unified image lookup (hỗ trợ cả TYPE_LINKS và CODE_TYPE mode)
            const imageData = getOrLoadImageDataForShop_(shopName);
            Logger.log(`[TYPE_DEBUG] imageData.mode=${imageData?.mode}, mapSize=${imageData?.map?.size || 0}`);
            const imageUrl = lookupImageUrl_(imageData, listingId, keyTypeValue, rawSku);
            
            if (imageUrl) {
              const validation = validateDriveLive3_(imageUrl);
              if (validation.status !== "DEAD") {
                const normalizedUrl = normalizeEtsyImageUrl_(validation.url);
                const imageLink = driveLinkToImage_(normalizedUrl) || normalizedUrl;
                if (imageLink) {
                  const escapedUrl = imageLink.replace(/"/g, '""');
                  imageCell = `=IFERROR(IMAGE("${escapedUrl}";1);"")`;
                }
              }
            }
          }
        }
        
        // ========== LOGO MAPPING (Column D) ==========
        // Extract Board Code from SKU (T03, X01...) and Logo Number from Personalization
        
        // Lấy personalization - LUÔN trích xuất từ productInfo để có multi-line
        // SỬA 2026-01-28: product.personalization có thể chỉ có dòng đầu
        let personalizationText = "";
        
        // Ưu tiên lấy từ productInfo (có đầy đủ multi-line)
        // Match cả "Logo:" (output format mới) lẫn "Personalization:" (output format cũ)
        const persMatch = productInfo.match(/(?:Logo|Personalization)\s*:\s*([\s\S]*)/i);
        if (persMatch) {
          personalizationText = persMatch[1].trim();
          Logger.log("[PERS] From productInfo: " + personalizationText.substring(0, 200));
        }
        
        // Fallback: dùng product.personalization nếu productInfo không có
        if (!personalizationText) {
          personalizationText = safeString_(product.personalization);
          Logger.log("[PERS] From product field: " + personalizationText.substring(0, 200));
        }

        
        const boardCode = extractBoardCodeFromSKU_auto_(rawSku, shopName);
        const logoNumber = extractLogoNumberFromPersonalization_auto_(personalizationText, shopName);
        
        if (boardCode) {
          const logoPrefix = getShopPrefix_(shopName);
          if (logoNumber) {
            // Trường hợp Đầy đủ: Gọi ảnh từ Database
            const logoImageUrl = lookupLogoImage_(shopName, boardCode, logoNumber);
            if (logoImageUrl) {
              const fixedUrl = (typeof driveLinkToImage_ === 'function') ? (driveLinkToImage_(logoImageUrl) || logoImageUrl) : logoImageUrl;
              const escapedUrl = fixedUrl.replace(/"/g, '""');
              logoCell = `=IFERROR(IMAGE("${escapedUrl}";1);"")`;
            } else {
              // Có đủ mã nhưng không có ảnh -> Hiện mã đầy đủ (S04Q1)
              logoCell = boardCode + logoNumber;
            }
          } else {
            // Trường hợp Mã Chờ: Chỉ có Board (S04Q)
            logoCell = boardCode + logoPrefix;
          }
        }
      }

      // Create rows for each qty
      for (let q = 0; q < actualQty; q++) {
        const count = (payloadCounter.get(rawId) || 0) + 1;
        payloadCounter.set(rawId, count);
        const suffix = String.fromCharCode(64 + count);
        const cleanOrderId = `${rawId}_${suffix}`;
        const uniqueKey = `${uniqueKeyBase}_${q}`;

        let noteCell = "";
        if (!printedNoteForOrder.has(rawId)) {
          noteCell = note;
          printedNoteForOrder.add(rawId);
        }

        const listingIdCell = listingId;
        
        let shipInfoCell = shipInfoFull;
        if (!SHOW_SHIPPING_EVERY_ROW && printedOrderInfo.has(rawId)) {
          shipInfoCell = "";
        } else if (!printedOrderInfo.has(rawId)) {
          printedOrderInfo.add(rawId);
        }

        if (mode === "strap") {
          rowsOrder.push([noteCell, productInfo, imageCell, cleanOrderId, shopName, listingIdCell, shipInfoCell, uniqueKey]);
        } else {
          // keyfob mode: A=Note, B=Product Info, C=Key Type Image, D=Logo, E=Order ID, F=Shop, G=Listing, H=Ship, I=Key
          rowsOrder.push([noteCell, productInfo, imageCell, logoCell, cleanOrderId, shopName, listingIdCell, shipInfoCell, uniqueKey]);
        }
      }
    });

    // WRITE ORDER SHEET
    let orderAdded = 0;
    if (!isTodayScope && rowsOrder.length > 0) {
      const startRow = orderSheet.getLastRow() + 1;
      const colCount = (mode === "strap") ? 8 : 9;
      
      if (mode === "strap") {
        orderSheet.getRange(startRow, 1, rowsOrder.length, colCount).setValues(rowsOrder);
      } else {
        // Keyfob mode: 
        // Column C = Key Type Image (index 2)
        // Column D = Logo Image or Text (index 3)
        
        // Clear C and D for batch write (formulas phải set riêng)
        const rowsWithoutCD = rowsOrder.map(row => {
          const newRow = [...row];
          // Nếu là formula (=IFERROR...) thì clear, giữ text
          if (String(newRow[2]).startsWith("=")) newRow[2] = "";
          if (String(newRow[3]).startsWith("=")) newRow[3] = "";
          return newRow;
        });
        orderSheet.getRange(startRow, 1, rowsWithoutCD.length, colCount).setValues(rowsWithoutCD);
        
        const rowsToSetHeight = [];
        rowsOrder.forEach((row, idx) => {
          const rowNum = startRow + idx;
          
          // === Column C: Key Type Image ===
          const typeImageFormula = safeString_(row[2]);
          if (typeImageFormula && typeImageFormula.startsWith("=")) {
            const cellC = orderSheet.getRange(rowNum, 3);
            if (isCellEmptyForImage_(cellC)) {
              const urlMatch = typeImageFormula.match(/IMAGE\("([^"]+)"/);
              if (urlMatch && urlMatch[1]) {
                try {
                  cellC.setFormula(typeImageFormula);
                  rowsToSetHeight.push(rowNum);
                } catch (err) {
                  Logger.log(`[SET_FORMULA_C] Error: ${err.message}`);
                }
              }
            }
          }
          
          // === Column D: Logo Image ===
          const logoValue = safeString_(row[3]);
          if (logoValue && logoValue.startsWith("=")) {
            const cellD = orderSheet.getRange(rowNum, 4);
            if (isCellEmptyForImage_(cellD)) {
              const urlMatch = logoValue.match(/IMAGE\("([^"]+)"/);
              if (urlMatch && urlMatch[1]) {
                try {
                  cellD.setFormula(logoValue);
                  if (!rowsToSetHeight.includes(rowNum)) {
                    rowsToSetHeight.push(rowNum);
                  }
                } catch (err) {
                  Logger.log(`[SET_FORMULA_D] Error: ${err.message}`);
                }
              }
            }
          }
        });
        
        if (rowsToSetHeight.length > 0) {
          rowsToSetHeight.forEach(rowNum => {
            orderSheet.setRowHeight(rowNum, 300);
          });
        }
      }
      
      orderSheet.getRange(startRow, 1, rowsOrder.length, colCount)
        .setWrap(true).setHorizontalAlignment("left").setVerticalAlignment("middle");
      
      const orderIdCol = (mode === "strap") ? 4 : 5;
      formatOrderGroups_(orderSheet, startRow, rowsOrder.length, colCount, orderIdCol);
      
      orderAdded = rowsOrder.length;
    }

    // WRITE TRACKING
    let trackingAdded = 0;
    if (!isTodayScope) {
      trackingAdded = appendTrackingRows_(trackSheet, trackingMap);
    }

    // WRITE YUN
    const yunAdded = (!isTodayScope) ? appendYunRows_(yunSheet, yunRowsAll, mode) : 0;
    const yunTodayAdded = isTodayScope ? appendYunRows_(yunTodaySheet, yunRowsToday, mode) : 0;

    // DASHBOARD - DISABLED (chỉ cần Manager)
    // let dashboardResult = { added: 0, skipped: 0, errors: [] };
    // if (!isTodayScope && data.orders) {
    //   dashboardResult = appendDashboardData_(data.orders, mode);
    // }

    // WRITE PRIVATE MANAGER SHEET (ghi song song vào sheet "Manager" trong Private)
    let privateManagerAdded = 0;
    if (!isTodayScope && data.orders && data.orders.length > 0) {
      try {
        privateManagerAdded = appendPrivateManagerData_(data.orders);
      } catch (err) {
        Logger.log(`[PRIVATE_MANAGER] Error: ${err.message}`);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        status: "success",
        exportScope,
        isTodayScope,
        added: { 
          orders: orderAdded, 
          tracking: trackingAdded, 
          yun_all: yunAdded, 
          yun_today: yunTodayAdded,
          private_manager: privateManagerAdded
        }
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : ""
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== LOGO AUTO-MAPPING HELPERS ====================

/**
 * Get shop prefix (T, X, L, Q, N, K)
 */
function getShopPrefix_(shopName) {
  const SHOP_PREFIX_MAP = {
    "viettoanhandmade": "T",
    "xilacrafts": "X",
    "laxiluxurycrafts": "L",
    "quangduocstore": "Q", // Quang Đuợc dùng Q cho số Logo
    "longnamleather": "N",
    "khhandcrafts": "K",
    "leecozzycraft": "J"
  };
  const s = String(shopName || "").toLowerCase().trim();
  
  // Tìm kiếm khớp một phần nếu cần
  for (const key in SHOP_PREFIX_MAP) {
    if (s.includes(key)) return SHOP_PREFIX_MAP[key];
  }
  
  return "T";
}

/**
 * Extract Board Code (T03, X01...) from SKU
 * Tìm mã [Prefix][2 số] ở cuối SKU
 */
function extractBoardCodeFromSKU_auto_(sku, shopName) {
  if (!sku) return "";
  
  const s = String(sku).toUpperCase();
  
  // QUY TẮC: Mã bảng (3 ký tự) nằm CUỐI SKU và có dấu CÁCH phía trước
  const regex = /\s([A-Z]\d{2})$/;
  const match = s.match(regex);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return "";
}

/**
 * Extract Logo Number from Personalization
 * CẬP NHẬT 2026-01-28: Ưu tiên prefix theo shop + filter Keychain
 * VERSION: 2.4.0
 */
function extractLogoNumberFromPersonalization_auto_(text, shopName) {
  if (!text) return "";
  
  const prefix = getShopPrefix_(shopName);
  const s = String(text);
  
  Logger.log("[LOGO v2.4] Shop: " + shopName + ", Prefix: " + prefix);
  Logger.log("[LOGO v2.4] Input: " + s.substring(0, 200));

  // ========== CHECK "Logo: None" hoặc "Logo: No" ==========
  // Nếu khách nói không cần logo → return rỗng
  if (/logo\s*:\s*(none|no|không|ko|n\/a)/i.test(s)) {
    Logger.log("[LOGO v2.4] RETURN empty: Logo: None detected");
    return "";
  }

  // ========== TÌM TẤT CẢ pattern [Letter][số] ==========
  const allMatches = [];
  const simplePattern = /([A-Za-z])(\d{1,4})/g;
  let m;

  
  while ((m = simplePattern.exec(s)) !== null) {
    const letter = m[1].toUpperCase();
    const numStr = m[2];
    const num = parseInt(numStr, 10);
    const fullMatch = m[0];
    const index = m.index;
    
    // Kiểm tra ký tự trước và sau
    const before = index > 0 ? s[index - 1] : "";
    const after = index + fullMatch.length < s.length ? s[index + fullMatch.length] : "";
    
    Logger.log("[LOGO v2.4] Found: " + fullMatch + " | before='" + before + "' after='" + after + "'");
    
    // Nếu trước là chữ cái → skip (ví dụ QDS1549)
    if (/[A-Za-z]/.test(before)) {
      Logger.log("[LOGO v2.4] SKIP: before is letter");
      continue;
    }
    
    // Nếu sau là chữ số → skip (số dài hơn)
    if (/\d/.test(after)) {
      Logger.log("[LOGO v2.4] SKIP: after is digit");
      continue;
    }
    
    // ========== FILTER KEYCHAIN (K1, K2, K3, K4) ==========
    // K + số thường là Keychain, không phải logo (trừ khi prefix shop là K)
    if (letter === "K" && prefix !== "K") {
      Logger.log("[LOGO v2.4] SKIP: K is Keychain, not logo");
      continue;
    }
    
    // Validate range 1-110
    if (num >= 1 && num <= 138) {
      allMatches.push({
        letter: letter,
        num: num,
        full: letter + num,
        isShopPrefix: letter === prefix
      });
      Logger.log("[LOGO v2.4] ADDED: " + letter + num);
    } else {
      Logger.log("[LOGO v2.4] SKIP: num " + num + " out of range");
    }

  }
  
  Logger.log("[LOGO v2.3] Total matches: " + allMatches.length);

  
  // ƯU TIÊN: Chọn match có prefix SHOP trước
  for (const match of allMatches) {
    if (match.isShopPrefix) {
      Logger.log("[LOGO v2.3] RETURN (shop prefix): " + match.full);
      return match.full;
    }
  }
  
  // Nếu không có prefix shop → lấy match đầu tiên
  if (allMatches.length > 0) {
    Logger.log("[LOGO v2.3] RETURN (first match): " + allMatches[0].full);
    return allMatches[0].full;
  }
  
  Logger.log("[LOGO v2.3] No logo found");
  return "";
}

/**

 * Check if number is noise (phone, year, size)
 */
function isNoiseNumber_auto_(text, numStr) {
  const lowerText = text.toLowerCase();
  
  // SĐT (>= 9 số liên tiếp)
  const allNums = text.match(/\d+/g) || [];
  for (const s of allNums) {
    if (s.includes(numStr) && s.length >= 9) return true;
  }
  
  // Size (gần mm, cm, inch)
  const numIndex = lowerText.indexOf(numStr);
  if (numIndex >= 0) {
    const context = lowerText.substring(Math.max(0, numIndex - 10), numIndex + numStr.length + 10);
    if (/\b(mm|cm|inch|inches|size|width|length|height)\b/.test(context)) {
      return true;
    }
  }
  
  // Năm (20xx)
  for (const s of allNums) {
    if (s.length === 4 && s.startsWith("20") && s.includes(numStr)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Lookup Logo image from _LOGO sheet
 */
function lookupLogoImage_(shopName, boardCode, logoNumber) {
  // Cache để tránh load lại mỗi lần
  const cacheKey = String(shopName || "").toLowerCase().trim();
  
  if (!logoLookupCache_) {
    logoLookupCache_ = new Map();
  }
  
  if (!logoLookupCache_.has(cacheKey)) {
    const logoMap = buildLogoMapForShop_(shopName);
    logoLookupCache_.set(cacheKey, logoMap);
  }
  
  const logoMap = logoLookupCache_.get(cacheKey);
  const key = boardCode.toUpperCase() + "|" + logoNumber.toUpperCase();
  
  return logoMap.get(key) || "";
}

// Global cache for logo lookup
var logoLookupCache_ = null;

/**
 * TEST FUNCTION - Chạy trên GAS để kiểm tra logo extraction
 * Nếu hiện VERSION 2.2.0 và kết quả đúng = code đã update
 */
function testLogoExtractionV2() {
  Logger.log("========== TEST LOGO EXTRACTION v2.2.0 ==========");
  
  const testCases = [
    {
      name: "Emoji Logo pattern",
      input: "2️⃣Logo: Q42-Black",
      shop: "quangduocstore",
      expected: "Q42"
    },
    {
      name: "N. Q104 pattern", 
      input: "1. CiCi (embossing: black)\n2. Q104\n3. Key 2",
      shop: "quangduocstore",
      expected: "Q104"
    },
    {
      name: "Standalone Q3",
      input: "Logo: Q3 - black",
      shop: "quangduocstore", 
      expected: "Q3"
    },
    {
      name: "Viettoan T45",
      input: "Color: Blue\nT45 stamp",
      shop: "viettoanhandmade",
      expected: "T45"
    }
  ];
  
  let passed = 0, failed = 0;
  
  testCases.forEach(tc => {
    const result = extractLogoNumberFromPersonalization_auto_(tc.input, tc.shop);
    const ok = result === tc.expected;
    if (ok) passed++; else failed++;
    
    Logger.log(`\n--- ${tc.name} ---`);
    Logger.log(`Input: ${tc.input.substring(0, 50)}`);
    Logger.log(`Shop: ${tc.shop}`);
    Logger.log(`${ok ? "✅" : "❌"} Got: "${result}" Expected: "${tc.expected}"`);
  });
  
  Logger.log(`\n========== RESULT: ${passed} PASSED, ${failed} FAILED ==========`);
  
  SpreadsheetApp.getUi().alert(
    `Logo Extraction Test v2.2.0\n\n${passed} PASSED, ${failed} FAILED\n\nXem chi tiết trong Execution Log`
  );
}

// ==================== PRIVATE MANAGER SHEET ====================

/**
 * Config cho Private Manager Sheet (giống AppsScript/Code.gs)
 */
const PRIVATE_MANAGER_HEADERS = [
  { name: 'Note', key: 'note' },
  { name: 'Gift Message', key: 'gift_message' },
  { name: 'Is Gift', key: 'is_gift' },
  { name: 'Order ID', key: 'order_id' },
  { name: 'Order Date', key: 'order_date' },
  { name: 'Expected Ship', key: 'expected_ship_date' },
  { name: 'Shop Name', key: 'shop_name' },
  { name: 'Product Title', key: 'product_title' },
  { name: 'Product Image', key: 'product_image' },
  { name: 'SKU', key: 'product_sku' },
  { name: 'Qty', key: 'product_quantity' },
  { name: 'Item Price', key: 'item_price' },
  { name: 'Item Total', key: 'item_total' },
  { name: 'Variations', key: 'variations' },
  { name: 'Listing ID', key: 'listing_id' },
  { name: 'Currency', key: 'currency_code' },
  { name: 'Total Price', key: 'total_price' },
  { name: 'Subtotal', key: 'subtotal_price' },
  { name: 'Shipping', key: 'shipping_cost' },
  { name: 'Tax', key: 'tax' },
  { name: 'Discount', key: 'discount_amount' },
  { name: 'Fee Tx', key: 'transaction_fees' },
  { name: 'Fee Pay', key: 'payment_fees' },
  { name: 'Tracking', key: 'tracking_code' },
  { name: 'Buyer Name', key: 'buyer_name' },
  { name: 'Buyer Email', key: 'buyer_email' },
  { name: 'Ship Name', key: 'shipping_name' },
  { name: 'Address 1', key: 'shipping_address' },
  { name: 'Address 2', key: 'shipping_address_2' },
  { name: 'City', key: 'shipping_city' },
  { name: 'State', key: 'shipping_state' },
  { name: 'ZIP', key: 'shipping_zip' },
  { name: 'Country', key: 'shipping_country' },
  { name: 'Phone', key: 'shipping_phone' },
  { name: 'Transaction ID', key: 'transaction_id' },
  { name: 'Has Ads', key: 'has_ads_attribution' }
];

/**
 * Ghi data vào sheet "Manager" trong file Private
 * Logic giống AppsScript/Code.gs
 * @param {Array} orders - Array of order objects
 * @return {number} Number of rows added
 */
function appendPrivateManagerData_(orders) {
  if (!orders || orders.length === 0) return 0;
  
  const privateSheetId = getPrivateSpreadsheetId_();
  if (!privateSheetId) {
    Logger.log("[PRIVATE_MANAGER] No PRIVATE_DASHBOARD_SHEET_ID set, skipping");
    return 0;
  }
  
  const ss = SpreadsheetApp.openById(privateSheetId);
  let sheet = ss.getSheetByName("Manager");
  
  // Tạo sheet nếu chưa có
  if (!sheet) {
    sheet = ss.insertSheet("Manager");
    const headerNames = PRIVATE_MANAGER_HEADERS.map(h => h.name);
    sheet.getRange(1, 1, 1, headerNames.length).setValues([headerNames])
      .setBackground("#1a73e8").setFontColor("white").setFontWeight("bold");
    sheet.setFrozenRows(1);
    Logger.log("[PRIVATE_MANAGER] Created new Manager sheet with headers");
  }
  
  // Load existing keys để check duplicate
  const lastRow = sheet.getLastRow();
  const existingKeys = new Set();
  const headers = PRIVATE_MANAGER_HEADERS;
  const tidIdx = headers.findIndex(h => h.key === 'transaction_id');
  const oidIdx = headers.findIndex(h => h.key === 'order_id');
  
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    dataRange.forEach(r => existingKeys.add(String(r[oidIdx]) + "_" + String(r[tidIdx])));
  }
  
  // Build rows
  const rowsToAdd = [];
  const processedInBatch = new Set();
  
  orders.forEach(order => {
    const uniqueKey = String(order.order_id || "") + "_" + String(order.transaction_id || "");
    if (existingKeys.has(uniqueKey)) return;
    
    const isFirstRow = !processedInBatch.has(order.order_id);
    processedInBatch.add(order.order_id);
    
    const row = headers.map(h => {
      // Logic chỉ hiển thị tiền tổng ở dòng đầu của đơn nhiều sản phẩm
      const orderLevelFields = ['total_price', 'subtotal_price', 'shipping_cost', 'tax', 'discount_amount', 'transaction_fees', 'payment_fees', 'items_cost', 'currency_code', 'note', 'gift_message', 'is_gift'];
      if (orderLevelFields.includes(h.key) && !isFirstRow) return '';
      
      let val = order[h.key];
      
      // Định dạng Ngày
      if (h.key.includes('date') && val) {
        const parts = String(val).split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]);
      }
      
      // Định dạng Hình ảnh
      if (h.key === 'product_image' && val) return `=IMAGE("${val}")`;
      
      return val === undefined || val === null ? '' : val;
    });
    
    rowsToAdd.push(row);
    existingKeys.add(uniqueKey);
  });
  
  if (rowsToAdd.length === 0) {
    Logger.log("[PRIVATE_MANAGER] No new rows to add (all duplicates)");
    return 0;
  }
  
  // Write to sheet
  const startRow = sheet.getLastRow() + 1;
  const range = sheet.getRange(startRow, 1, rowsToAdd.length, headers.length);
  range.setValues(rowsToAdd);
  
  // Format
  range.setFontColor("black").setBackground("white").setFontFamily("Arial").setFontSize(10).setVerticalAlignment("middle");
  
  // Number formats
  const formats = rowsToAdd.map(row => {
    const currencyIdx = headers.findIndex(h => h.key === 'currency_code');
    const currency = String(row[currencyIdx] || 'USD').toUpperCase();
    const moneyPattern = (currency === 'VND') ? '#,##0" đ"' : '"$"#,##0.00';
    
    return headers.map(h => {
      if (['item_price', 'item_total', 'total_price', 'subtotal_price', 'shipping_cost', 'tax', 'discount_amount', 'transaction_fees', 'payment_fees'].includes(h.key)) return moneyPattern;
      if (h.key.includes('date')) return 'dd/MM/yyyy';
      return '@';
    });
  });
  range.setNumberFormats(formats);
  
  Logger.log(`[PRIVATE_MANAGER] ✅ Added ${rowsToAdd.length} rows to Manager sheet`);
  return rowsToAdd.length;
}

/*
 * =============================================================
 * == FILE: 9_Dashboard.gs
 * == MỤC ĐÍCH: Dashboard data management (append, aggregate, API)
 * =============================================================
 */

// ==================== SHEET MANAGEMENT ====================

/**
 * Get PRIVATE spreadsheet ID from Script Properties
 * @return {string} Spreadsheet ID or null
 */
function getPrivateSpreadsheetId_() {
  const PRIVATE_SHEET_ID_PROP_KEY = "PRIVATE_DASHBOARD_SHEET_ID";
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty(PRIVATE_SHEET_ID_PROP_KEY);
  if (!sheetId) {
    Logger.log("[DASHBOARD] Warning: PRIVATE_DASHBOARD_SHEET_ID not set in Script Properties");
    return null;
  }
  return sheetId;
}

/**
 * Set PRIVATE spreadsheet ID to Script Properties
 * @param {string} sheetId - Spreadsheet ID
 */
function setPrivateSpreadsheetId(sheetId) {
  const PRIVATE_SHEET_ID_PROP_KEY = "PRIVATE_DASHBOARD_SHEET_ID";
  if (!sheetId || sheetId.trim() === "") {
    throw new Error("Sheet ID cannot be empty");
  }
  PropertiesService.getScriptProperties().setProperty(PRIVATE_SHEET_ID_PROP_KEY, sheetId.trim());
  Logger.log(`[DASHBOARD] PRIVATE_DASHBOARD_SHEET_ID set to: ${sheetId}`);
}

/**
 * Ensure Dashboard sheet exists and has header
 * Ghi trực tiếp vào PRIVATE Sheet (không cần STAFF Sheet nữa)
 * @return {Sheet} Dashboard sheet
 */
function ensureDashboardSheet_() {
  // Get PRIVATE spreadsheet ID
  const privateSheetId = getPrivateSpreadsheetId_();
  if (!privateSheetId) {
    throw new Error("PRIVATE_DASHBOARD_SHEET_ID not set. Run setupPrivateSheetId() first.");
  }
  
  const ss = SpreadsheetApp.openById(privateSheetId);
  let sheet = ss.getSheetByName(SHEET_DASHBOARD);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DASHBOARD);
    ensureDashboardHeader_(sheet);
  } else {
    // Check if header exists
    const headerRow = sheet.getRange(1, 1, 1, DASHBOARD_HEADER.length).getValues()[0];
    if (!headerRow[0] || headerRow[0] !== DASHBOARD_HEADER[0]) {
      ensureDashboardHeader_(sheet);
    }
  }
  
  return sheet;
}

/**
 * Ensure Dashboard header exists
 * @param {Sheet} sheet - Dashboard sheet
 */
function ensureDashboardHeader_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow === 0) {
    // Empty sheet, just add header
    sheet.appendRow(DASHBOARD_HEADER);
    const headerRange = sheet.getRange(1, 1, 1, DASHBOARD_HEADER.length);
    headerRange.setFontWeight("bold");
    headerRange.setWrap(true);
    headerRange.setBackground("#e8f0fe");
    sheet.setFrozenRows(1);
    
    // Hide Unique Key column (last column) - same as order sheet
    const uniqueKeyCol = DASHBOARD_HEADER.length;
    try {
      sheet.hideColumns(uniqueKeyCol);
    } catch (err) {
      Logger.log(`[DASHBOARD] Could not hide Unique Key column: ${err.message}`);
    }
    return;
  }
  
  // Check if header matches (compare first few columns)
  const currentHeader = sheet.getRange(1, 1, 1, Math.max(lastCol, DASHBOARD_HEADER.length)).getValues()[0];
  const headerMatches = currentHeader.length >= DASHBOARD_HEADER.length && 
                        currentHeader[0] === DASHBOARD_HEADER[0] &&
                        currentHeader[5] === DASHBOARD_HEADER[5]; // Check Currency column
  
  if (!headerMatches) {
    // Update header row only (don't delete data)
    sheet.getRange(1, 1, 1, DASHBOARD_HEADER.length).setValues([DASHBOARD_HEADER]);
    // Clear extra columns if header was longer before
    if (lastCol > DASHBOARD_HEADER.length) {
      sheet.getRange(1, DASHBOARD_HEADER.length + 1, 1, lastCol - DASHBOARD_HEADER.length).clearContent();
    }
    const headerRange = sheet.getRange(1, 1, 1, DASHBOARD_HEADER.length);
    headerRange.setFontWeight("bold");
    headerRange.setWrap(true);
    headerRange.setBackground("#e8f0fe");
    sheet.setFrozenRows(1);
  }
}

// ==================== LOAD EXISTING DATA ====================

/**
 * Load existing Order IDs (base) from Dashboard (for duplicate check)
 * Chỉ check Order ID (base) - đơn giản hơn
 * @return {Set} Set of existing order IDs (base)
 */
function loadExistingDashboardOrders_() {
  const set = new Set();
  try {
    // Get PRIVATE spreadsheet ID
    const privateSheetId = getPrivateSpreadsheetId_();
    if (!privateSheetId) {
      Logger.log(`[DASHBOARD] No private sheet ID, returning empty set`);
      return set;
    }
    
    Logger.log(`[DASHBOARD] Loading existing Order IDs from private sheet: ${privateSheetId}`);
    const ss = SpreadsheetApp.openById(privateSheetId);
    const sheet = ss.getSheetByName(SHEET_DASHBOARD);
    if (!sheet) {
      Logger.log(`[DASHBOARD] Sheet "${SHEET_DASHBOARD}" not found, returning empty set`);
      return set;
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log(`[DASHBOARD] Sheet has no data rows (lastRow=${lastRow}), returning empty set`);
      return set;
    }
    
    // Load Order ID (base) from column A (column 1)
    // Normalize để đảm bảo so sánh chính xác
    Logger.log(`[DASHBOARD] Reading Order IDs from column A, rows 2-${lastRow}`);
    const orderIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let loadedCount = 0;
    orderIds.forEach(row => {
      const orderId = safeString_(row[0]).trim();
      if (orderId) {
        // Normalize: extract base ID nếu có suffix _A, _B
        const baseId = extractBaseOrderId_(orderId);
        set.add(baseId);
        loadedCount++;
        if (loadedCount <= 5) { // Log first 5 IDs for debugging
          Logger.log(`[DASHBOARD] Loaded existing Order ID: ${orderId} -> base: ${baseId}`);
        }
      }
    });
    Logger.log(`[DASHBOARD] Total loaded ${loadedCount} Order IDs from sheet`);
  } catch (err) {
    Logger.log(`[DASHBOARD] Error loading existing Order IDs: ${err.message}`);
    Logger.log(`[DASHBOARD] Stack: ${err.stack}`);
  }
  return set;
}

// ==================== CURRENCY CONVERSION ====================

/**
 * Convert amount to USD
 * @param {number} amount - Amount in original currency
 * @param {string} currency - Currency code (USD/VND)
 * @return {number} Amount in USD
 */
function convertToUSD_(amount, currency) {
  if (!amount || amount === 0) return 0;
  const curr = safeString_(currency).toUpperCase();
  if (curr === "USD") return amount;
  if (curr === "VND") return amount / USD_TO_VND_RATE;
  return amount; // Unknown currency, return as-is
}

/**
 * Convert amount to VND
 * @param {number} amount - Amount in original currency
 * @param {string} currency - Currency code (USD/VND)
 * @return {number} Amount in VND
 */
function convertToVND_(amount, currency) {
  if (!amount || amount === 0) return 0;
  const curr = safeString_(currency).toUpperCase();
  if (curr === "VND") return amount;
  if (curr === "USD") return amount * USD_TO_VND_RATE;
  return amount * USD_TO_VND_RATE; // Default convert to VND
}

// ==================== NORMALIZE ORDER DATA ====================

/**
 * Extract base Order ID (remove _A, _B suffix)
 * @param {string} orderId - Full order ID
 * @return {string} Base order ID
 */
function extractBaseOrderId_(orderId) {
  if (!orderId) return "";
  const id = safeString_(orderId);
  return id.replace(/_[A-Z]+$/, "");
}

/**
 * Count order quantity from order_id (12345_A, 12345_B = 2)
 * Đếm số lượng orders trong group (không phải số unique base IDs)
 * @param {Array} orders - Array of orders with same base order_id
 * @return {number} Order count (số lượng orders trong group)
 */
function countOrderQuantity_(orders) {
  if (!orders || orders.length === 0) return 0;
  // Đếm số lượng orders trong group (ví dụ: 12345_A, 12345_B, 12345_C = 3)
  return orders.length;
}

/**
 * Normalize order data for Dashboard
 * @param {Object} order - Order object from addon
 * @param {string} mode - "keyfob" or "strap"
 * @return {Array} Dashboard row data
 */
function normalizeOrderForDashboard_(order, mode) {
  const baseOrderId = extractBaseOrderId_(order.order_id || "");
  
  // Normalize Order Date: Extract only date part (YYYY-MM-DD), remove time
  let orderDate = safeString_(order.order_date || "");
  if (orderDate) {
    // If ISO format (2026-01-02T18:11:35.000Z), extract date part only
    orderDate = orderDate.split("T")[0].split(" ")[0]; // YYYY-MM-DD
  }
  
  const expectedShipDate = safeString_(order.expected_ship_date || "");
  const actualShipDate = safeString_(order.actual_ship_date || "");
  const shopName = safeString_(order.shop_name || "");
  const currency = safeString_(order.currency_code || order.currency || "USD").toUpperCase();
  
  // Financial data (from addon, default 0 if not available)
  // Use ?? instead of || to avoid fallback when value is 0
  const subtotalPrice = parseFloat(order.subtotal_price ?? order.total_price ?? 0);
  const buyerPaid = parseFloat(order.grandtotal_price ?? order.total_price ?? order.buyer_paid ?? 0);
  
  // Auto-calculate Product Cost based on product type (mode)
  // If product_cost is not provided, calculate from mode:
  // - "strap" or "watch" → 300,000 VND
  // - "keyfob" or default → 135,000 VND
  let productCost = parseFloat(order.product_cost ?? 0);
  if (!productCost || productCost === 0) {
    const productMode = safeString_(mode || "").toLowerCase();
    if (productMode === "strap" || productMode === "watch") {
      productCost = PRODUCT_COST_STRAP_WATCH; // 300,000 VND
    } else {
      productCost = PRODUCT_COST_KEYFOB; // 135,000 VND (default for keyfob)
    }
  }
  const buyerShippingPaid = parseFloat(order.shipping_cost ?? order.shipping_paid_by_buyer ?? 0); // Tiền khách trả ship
  const sellerShippingCost = parseFloat(order.seller_shipping_cost ?? 0); // Tiền seller phải trả (FBM) - cần nhập thủ công hoặc auto-calculate
  const tax = parseFloat(order.tax ?? 0);
  const discount = parseFloat(order.discount_amount ?? order.discount ?? 0);
  const hasAds = order.has_ads_attribution || false;
  
  // Order count and quantity (needed for shipping calculation)
  const quantity = parseFloat(order.product_quantity || order.quantity || 0);
  const country = safeString_(order.shipping_country || "");
  
  // Auto-calculate Seller Shipping Cost based on quantity and country
  // If seller_shipping_cost is not provided, calculate from shipping table
  let calculatedSellerShippingCost = sellerShippingCost;
  if (!calculatedSellerShippingCost || calculatedSellerShippingCost === 0) {
    if (country && quantity > 0) {
      const weightGr = calculateShippingWeight_(quantity);
      calculatedSellerShippingCost = getShippingCostByWeight_(weightGr, country);
    }
  }
  
  // Get fee config by currency
  const feeConfig = getFeeConfigByCurrency(currency);
  
  // Calculate fees using fee config
  // Transaction Fee = 6.5% of (Buyer Paid - Tax)
  // Note: Buyer Paid = Order total (đã gồm tax), nên base để tính fee = Buyer Paid - Tax
  const transactionFee = feeConfig.tx_fee_rate * Math.max(0, buyerPaid - tax);
  
  // Payment Fee = processing_rate * Buyer Paid + processing_fixed
  const paymentFee = feeConfig.processing_rate * buyerPaid + feeConfig.processing_fixed;
  
  // Regulatory Operating Fee = 1.24% of (Buyer Paid - Tax)
  const regulatoryFee = feeConfig.regulatory_rate * Math.max(0, buyerPaid - tax);
  
  // Listing Fee = listing_fee_fixed * Order Count (will be updated after grouping)
  const orderCount = 1; // Default, will be recalculated after grouping
  const listingFee = feeConfig.listing_fee_fixed * orderCount;
  
  // Offsite Ads Fee = 14% of Buyer Paid (only if Has Ads Attribution = TRUE, per order)
  // Note: This is per-order fee for orders with ads attribution
  // Etsy Ads (daily click-throughs) will be handled separately by user
  const offsiteAdsFee = hasAds ? (feeConfig.offsite_ads_rate * buyerPaid) : 0;
  
  // Fees Subtotal (before VAT) = Transaction Fee + Payment Fee + Regulatory Fee + Listing Fee + Offsite Ads Fee
  const feesSubtotal = transactionFee + paymentFee + regulatoryFee + listingFee + offsiteAdsFee;
  
  // VAT on Fees = 10% of Fees Subtotal
  const vatOnFees = feesSubtotal * feeConfig.vat_rate;
  
  // Total Fees = Fees Subtotal + VAT on Fees
  const totalFees = feesSubtotal + vatOnFees;
  
  // Net Revenue = Buyer Paid - Total Fees - Tax (sales tax remitted is not seller revenue)
  const netRevenue = buyerPaid - totalFees - tax;
  
  // Gross Profit = Net Revenue - Product Cost
  const grossProfit = netRevenue - productCost;
  
  // Net Profit = Gross Profit - Seller Shipping Cost - Offsite Ads Fee
  // Note: Seller Shipping Cost = FBM cost (tiền seller phải trả), khác với Buyer Shipping Paid
  // Offsite Ads Fee is already in Total Fees, but also needs to be subtracted here per requirement
  const netProfit = grossProfit - calculatedSellerShippingCost - offsiteAdsFee;
  
  // Profit Margin % = Net Profit / Buyer Paid (do NOT multiply by 100, format as % in Sheets)
  const profitMargin = buyerPaid > 0 ? (netProfit / buyerPaid) : 0;
  
  // Metadata
  const listingId = safeString_(order.listing_id || "");
  const sku = safeString_(order.product_sku || order.sku || "");
  const variations = safeString_(order.variations || "");
  const packageCount = parseFloat(order.package_count || 1);
  
  // Build unique key: baseOrderId_sku_variations (same format as order sheet)
  // Format matches order sheet: orderId_sku_variations
  const uniqueKey = `${baseOrderId}_${sku}_${variations}`.trim();
  
  return [
    baseOrderId,                    // A: Order ID (base)
    orderDate,                      // B: Order Date
    expectedShipDate,               // C: Expected Ship Date
    actualShipDate,                 // D: Actual Ship Date
    shopName,                       // E: Shop Name
    currency,                       // F: Currency
    orderCount,                     // G: Order Count
    quantity,                       // H: Quantity
    listingId,                      // I: Listing ID
    sku,                            // J: SKU
    country,                        // K: Country
    subtotalPrice,                  // L: Subtotal Price (original)
    buyerPaid,                      // M: Buyer Paid (original)
    productCost,                    // N: Product Cost (original)
    buyerShippingPaid,              // O: Buyer Shipping Paid (original)
    calculatedSellerShippingCost,   // P: Seller Shipping Cost (FBM - auto-calculated or manual)
    transactionFee,                 // Q: Transaction Fee (calculated)
    paymentFee,                     // R: Payment Fee (calculated)
    regulatoryFee,                  // S: Regulatory Operating Fee (calculated)
    listingFee,                     // T: Listing Fee (calculated)
    offsiteAdsFee,                  // U: Offsite Ads Fee (calculated)
    feesSubtotal,                   // V: Fees Subtotal (before VAT)
    vatOnFees,                      // W: VAT on Fees (10%)
    tax,                            // X: Tax (original)
    discount,                       // Y: Discount (original)
    totalFees,                      // Z: Total Fees (calculated, includes VAT)
    netRevenue,                     // AA: Net Revenue (calculated)
    grossProfit,                    // AB: Gross Profit (calculated)
    netProfit,                      // AC: Net Profit (calculated)
    profitMargin,                   // AD: Profit Margin % (calculated)
    uniqueKey                       // AE: Unique Key (for deduplication)
  ];
}

// ==================== APPEND DASHBOARD DATA ====================

/**
 * Append orders to Dashboard sheet (check duplicate first)
 * @param {Array} orders - Array of order objects from addon
 * @param {string} mode - "keyfob" or "strap"
 * @return {Object} { added, skipped, errors }
 */
function appendDashboardData_(orders, mode) {
  // Ensure sheet exists even if no orders (for initial setup)
  try {
    const sheet = ensureDashboardSheet_();
  } catch (err) {
    Logger.log(`[DASHBOARD] Error ensuring sheet: ${err.message}`);
    return { added: 0, skipped: 0, errors: [err.message] };
  }
  
  if (!orders || orders.length === 0) {
    return { added: 0, skipped: 0, errors: [] };
  }
  
  try {
    const sheet = ensureDashboardSheet_();
    Logger.log(`[DASHBOARD] Processing ${orders.length} orders`);
    const existingOrderIds = loadExistingDashboardOrders_(); // Set of existing Order IDs (base) from sheet
    Logger.log(`[DASHBOARD] Found ${existingOrderIds.size} existing Order IDs in sheet`);
    
    // Step 1: Filter out orders that already exist in sheet
    // Logic: Nếu Order ID (base) đã tồn tại trong sheet → skip, không thêm nữa
    // Nếu chưa có → thêm vào filteredOrders để group sau
    const filteredOrders = [];
    let skippedCount = 0;
    
    orders.forEach(order => {
      const fullOrderId = safeString_(order.order_id || "");
      const baseOrderId = extractBaseOrderId_(fullOrderId);
      let orderDate = safeString_(order.order_date || "");
      // Normalize orderDate to YYYY-MM-DD format (bỏ time, timezone)
      orderDate = orderDate.split("T")[0].split(" ")[0]; // Lấy phần YYYY-MM-DD
      const shopName = safeString_(order.shop_name || "");
      
      if (!baseOrderId || !orderDate || !shopName) {
        Logger.log(`[DASHBOARD] Skipping order - missing data: baseOrderId=${baseOrderId}, orderDate=${orderDate}, shopName=${shopName}`);
        skippedCount++;
        return;
      }
      
      // Check duplicate: Nếu Order ID (base) đã có trong sheet → skip
      if (existingOrderIds.has(baseOrderId)) {
        Logger.log(`[DASHBOARD] ⚠️ DUPLICATE SKIPPED (Order ID exists in sheet): ${baseOrderId}`);
        skippedCount++;
        return; // Skip - đơn hàng đã tồn tại, không thêm nữa
      }
      
      // Order ID chưa có trong sheet → thêm vào filteredOrders (sẽ group sau)
      Logger.log(`[DASHBOARD] ✅ New order: ${baseOrderId} (full: ${fullOrderId})`);
      filteredOrders.push(order);
    });
    
    Logger.log(`[DASHBOARD] Filtered: ${filteredOrders.length} new orders, ${skippedCount} skipped`);
    
    if (filteredOrders.length === 0) {
      Logger.log(`[DASHBOARD] No new orders to add, all were duplicates`);
      return { added: 0, skipped: orders.length, errors: [] };
    }
    
    // Step 2: Group filtered orders by base order_id (cùng Order ID thì gộp lại 1 row)
    // Private Dashboard KHÁC với Key Fob/Strap:
    // - Key Fob/Strap: Mỗi item 1 row (12345_A, 12345_B, 12345_C) - để lên đơn
    // - Private Dashboard: Cùng Order ID gộp lại 1 row
    const orderGroups = new Map(); // baseOrderId|shopName|orderDate -> [orders]
    
    filteredOrders.forEach(order => {
      const baseOrderId = extractBaseOrderId_(order.order_id || "");
      let orderDate = safeString_(order.order_date || "");
      orderDate = orderDate.split("T")[0].split(" ")[0];
      const shopName = safeString_(order.shop_name || "");
      const key = `${baseOrderId}|${shopName}|${orderDate}`;
      
      if (!orderGroups.has(key)) {
        orderGroups.set(key, []);
      }
      orderGroups.get(key).push(order);
    });
    
    Logger.log(`[DASHBOARD] Grouped into ${orderGroups.size} order groups`);
    
    // Build rows for Dashboard
    const rows = [];
    orderGroups.forEach((groupOrders, key) => {
      // Calculate order_count and total quantity for this group
      // Order Count = số lượng orders trong group (ví dụ: 12345_A, 12345_B, 12345_C = 3)
      // Quantity = tổng quantity của tất cả orders trong group
      const orderCount = groupOrders.length; // Số lượng orders trong group
      const totalQuantity = groupOrders.reduce((sum, o) => {
        return sum + parseFloat(o.product_quantity || o.quantity || 0);
      }, 0);
      
      Logger.log(`[DASHBOARD] Group ${key}: ${orderCount} orders, total quantity = ${totalQuantity}`);
      
      // Use first order as base, update order_count and quantity
      const baseOrder = groupOrders[0];
      const row = normalizeOrderForDashboard_(baseOrder, mode);
      
      // Update order_count and quantity
      row[6] = orderCount;  // G: Order Count = số orders trong group
      row[7] = totalQuantity; // H: Quantity = tổng quantity
      
      // Recalculate Seller Shipping Cost based on actual totalQuantity and country
      const country = safeString_(baseOrder.shipping_country || "");
      if (country && totalQuantity > 0) {
        const weightGr = calculateShippingWeight_(totalQuantity);
        const autoShippingCost = getShippingCostByWeight_(weightGr, country);
        row[15] = autoShippingCost; // P: Seller Shipping Cost (index 15)
      }
      
      // Recalculate Listing Fee based on actual orderCount
      const feeConfig = getFeeConfigByCurrency(currency);
      row[19] = feeConfig.listing_fee_fixed * orderCount; // T: Listing Fee (index 19)
      
      // Recalculate Fees Subtotal (before VAT) = Transaction Fee + Payment Fee + Regulatory Fee + Listing Fee + Offsite Ads Fee
      // Q=16 (Transaction Fee, index 16), R=17 (Payment Fee, index 17), S=18 (Regulatory Fee, index 18),
      // T=19 (Listing Fee, index 19), U=20 (Offsite Ads Fee, index 20)
      row[21] = row[16] + row[17] + row[18] + row[19] + row[20]; // V: Fees Subtotal (index 21)
      
      // Recalculate VAT on Fees = 10% of Fees Subtotal
      row[22] = row[21] * 0.10; // W: VAT on Fees (index 22)
      
      // Recalculate Total Fees = Fees Subtotal + VAT on Fees
      row[25] = row[21] + row[22]; // Z: Total Fees (index 25)
      
      // Recalculate Net Revenue = Buyer Paid - Total Fees - Tax
      // M=12 (Buyer Paid, index 12), Z=25 (Total Fees, index 25), X=23 (Tax, index 23)
      row[26] = row[12] - row[25] - row[23]; // AA: Net Revenue (index 26)
      
      // Recalculate Gross Profit = Net Revenue - Product Cost
      // AA=26 (Net Revenue, index 26), N=13 (Product Cost, index 13)
      row[27] = row[26] - row[13]; // AB: Gross Profit (index 27)
      
      // Recalculate Net Profit = Gross Profit - Seller Shipping Cost - Offsite Ads Fee
      // AB=27 (Gross Profit, index 27), P=15 (Seller Shipping Cost, index 15), U=20 (Offsite Ads Fee, index 20)
      row[28] = row[27] - row[15] - row[20]; // AC: Net Profit (index 28)
      
      // Recalculate Profit Margin % = Net Profit / Buyer Paid
      // AC=28 (Net Profit, index 28), M=12 (Buyer Paid, index 12)
      row[29] = row[12] > 0 ? (row[28] / row[12]) : 0; // AD: Profit Margin % (index 29)
      
      rows.push(row);
    });
    
    if (rows.length === 0) {
      Logger.log(`[DASHBOARD] No rows to append after grouping`);
      return { added: 0, skipped: orders.length, errors: [] };
    }
    
    // Append to sheet
    const startRow = sheet.getLastRow() + 1;
    Logger.log(`[DASHBOARD] Appending ${rows.length} rows to sheet, starting at row ${startRow}`);
    sheet.getRange(startRow, 1, rows.length, DASHBOARD_HEADER.length).setValues(rows);
    Logger.log(`[DASHBOARD] ✅ Successfully appended ${rows.length} rows to Dashboard sheet`);
    
    // Hide Unique Key column (last column) - same as order sheet
    const uniqueKeyCol = DASHBOARD_HEADER.length;
    sheet.hideColumns(uniqueKeyCol);
    
    // Ensure shop columns exist and update formulas
    const shopNames = getShopNamesFromRows_(rows);
    ensureShopColumns_(sheet, shopNames);
    updateShopColumnFormulas_(sheet);
    
    // Format number columns (L to AC: financial columns, excluding Profit Margin %)
    // Format according to Currency (column F, index 5) for each row
    // VND: #,##0 "₫" (no decimal places, ₫ symbol at end)
    // USD: $#,##0.00 (2 decimal places, $ symbol at start)
    // L=12 (Subtotal Price), M=13 (Buyer Paid), N=14 (Product Cost), O=15 (Buyer Shipping Paid), P=16 (Seller Shipping Cost),
    // Q=17 (Transaction Fee), R=18 (Payment Fee), S=19 (Regulatory Fee), T=20 (Listing Fee),
    // U=21 (Offsite Ads Fee), V=22 (Fees Subtotal), W=23 (VAT on Fees), X=24 (Tax), Y=25 (Discount),
    // Z=26 (Total Fees), AA=27 (Net Revenue), AB=28 (Gross Profit), AC=29 (Net Profit)
    // Note: Index in array is 0-based, column number is 1-based
    // L=12 (index 11), M=13 (index 12), N=14 (index 13), O=15 (index 14), P=16 (index 15),
    // Q=17 (index 16), R=18 (index 17), S=19 (index 18), T=20 (index 19), U=21 (index 20),
    // V=22 (index 21), W=23 (index 22), X=24 (index 23), Y=25 (index 24),
    // Z=26 (index 25), AA=27 (index 26), AB=28 (index 27), AC=29 (index 28)
    const numCols = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]; // L to AC (financial columns, 0-based index)
    const currencyCol = 6; // F: Currency (column 6, index 5)
    
    // Format each row according to its currency
    // Read currency from sheet to ensure accuracy (in case rows array doesn't match)
    for (let i = 0; i < rows.length; i++) {
      const rowNum = startRow + i;
      // Read currency directly from sheet (column F, index 5)
      const currencyCell = sheet.getRange(rowNum, 6, 1, 1).getValue(); // F: Currency (column 6)
      const currency = safeString_(currencyCell || rows[i][5] || "USD").toUpperCase();
      
      // Determine format based on currency
      let formatStr;
      if (currency === "VND") {
        formatStr = '#,##0 "₫"'; // VND: no decimal, ₫ at end (e.g., 649,500 ₫)
      } else {
        // USD: Use format that works with Vietnam locale
        // Use [$$-409]#,##0.00 to force US format (comma for thousands, dot for decimal)
        formatStr = '[$$-409]#,##0.00'; // USD: 2 decimals, $ at start, US format (e.g., $4,500.00)
      }
      
      // Format all financial columns for this row
      numCols.forEach(col => {
        sheet.getRange(rowNum, col + 1, 1, 1).setNumberFormat(formatStr);
      });
    }
    // Format Profit Margin % (AD column = 30, index 29) - Unique Key is AE (31, index 30)
    sheet.getRange(startRow, 30, rows.length, 1).setNumberFormat("0.00%");
    
    // Format date columns: Order Date (B=2), Expected Ship Date (C=3), Actual Ship Date (D=4)
    // Use same format as Expected Ship Date (date format without time)
    const dateFormat = "yyyy-mm-dd"; // Format: 2026-01-02
    sheet.getRange(startRow, 2, rows.length, 1).setNumberFormat(dateFormat); // B: Order Date
    sheet.getRange(startRow, 3, rows.length, 1).setNumberFormat(dateFormat); // C: Expected Ship Date
    sheet.getRange(startRow, 4, rows.length, 1).setNumberFormat(dateFormat); // D: Actual Ship Date
    
    const skipped = orders.length - rows.length;
    return { added: rows.length, skipped: skipped, errors: [] };
    
  } catch (err) {
    Logger.log(`[DASHBOARD] Error appending data: ${err.message}`);
    return { added: 0, skipped: 0, errors: [err.message] };
  }
}

// ==================== OFFSITE ADS CALCULATION ====================

/**
 * Ensure Ads_Summary_Input sheet exists with header
 * @return {Sheet} Ads_Summary_Input sheet
 */
function ensureAdsSummaryInputSheet_() {
  // Get PRIVATE spreadsheet ID
  const privateSheetId = getPrivateSpreadsheetId_();
  if (!privateSheetId) {
    throw new Error("PRIVATE_DASHBOARD_SHEET_ID not set. Run setupPrivateSheetId() first.");
  }
  
  const ss = SpreadsheetApp.openById(privateSheetId);
  let sheet = ss.getSheetByName(SHEET_ADS_SUMMARY_INPUT);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ADS_SUMMARY_INPUT);
    sheet.appendRow(ADS_SUMMARY_INPUT_HEADER);
    const headerRange = sheet.getRange(1, 1, 1, ADS_SUMMARY_INPUT_HEADER.length);
    headerRange.setFontWeight("bold");
    headerRange.setWrap(true);
    headerRange.setBackground("#fff3cd");
    sheet.setFrozenRows(1);
  } else {
    // Check if header exists
    const headerRow = sheet.getRange(1, 1, 1, ADS_SUMMARY_INPUT_HEADER.length).getValues()[0];
    if (!headerRow[0] || headerRow[0] !== ADS_SUMMARY_INPUT_HEADER[0]) {
      sheet.clear();
      sheet.appendRow(ADS_SUMMARY_INPUT_HEADER);
      const headerRange = sheet.getRange(1, 1, 1, ADS_SUMMARY_INPUT_HEADER.length);
      headerRange.setFontWeight("bold");
      headerRange.setWrap(true);
      headerRange.setBackground("#fff3cd");
      sheet.setFrozenRows(1);
    }
  }
  
  return sheet;
}

/**
 * Ensure Dashboard_Monthly sheet exists with header
 * @return {Sheet} Dashboard_Monthly sheet
 */
function ensureDashboardMonthlySheet_() {
  // Get PRIVATE spreadsheet ID
  const privateSheetId = getPrivateSpreadsheetId_();
  if (!privateSheetId) {
    throw new Error("PRIVATE_DASHBOARD_SHEET_ID not set. Run setupPrivateSheetId() first.");
  }
  
  const ss = SpreadsheetApp.openById(privateSheetId);
  let sheet = ss.getSheetByName(SHEET_DASHBOARD_MONTHLY);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DASHBOARD_MONTHLY);
    sheet.appendRow(DASHBOARD_MONTHLY_HEADER);
    const headerRange = sheet.getRange(1, 1, 1, DASHBOARD_MONTHLY_HEADER.length);
    headerRange.setFontWeight("bold");
    headerRange.setWrap(true);
    headerRange.setBackground("#e8f0fe");
    sheet.setFrozenRows(1);
  } else {
    // Check if header exists
    const headerRow = sheet.getRange(1, 1, 1, DASHBOARD_MONTHLY_HEADER.length).getValues()[0];
    if (!headerRow[0] || headerRow[0] !== DASHBOARD_MONTHLY_HEADER[0]) {
      sheet.clear();
      sheet.appendRow(DASHBOARD_MONTHLY_HEADER);
      const headerRange = sheet.getRange(1, 1, 1, DASHBOARD_MONTHLY_HEADER.length);
      headerRange.setFontWeight("bold");
      headerRange.setWrap(true);
      headerRange.setBackground("#e8f0fe");
      sheet.setFrozenRows(1);
    }
  }
  
  return sheet;
}

/**
 * Load manual Offsite Ads values from Ads_Summary_Input sheet
 * @return {Map} Map of "shop_name|month|currency" -> { value, isEstimated: false }
 */
function loadManualAdsValues_() {
  const map = new Map();
  try {
    const sheet = ensureAdsSummaryInputSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return map;
    
    // Columns: Shop Name (A), Month (B), Currency (C), Offsite Ads Value (D), Notes (E)
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    data.forEach(row => {
      const shopName = safeString_(row[0]).trim();
      const month = safeString_(row[1]).trim();
      const currency = safeString_(row[2] || "USD").trim().toUpperCase();
      const value = parseFloat(row[3] || 0);
      
      if (shopName && month && currency && value > 0) {
        const key = `${shopName}|${month}|${currency}`;
        map.set(key, {
          value: value,
          isEstimated: false
        });
      }
    });
  } catch (err) {
    Logger.log(`[DASHBOARD] Error loading manual ads values: ${err.message}`);
  }
  return map;
}

/**
 * Calculate Offsite Ads for a (shop, month, currency) combination
 * @param {string} shopName - Shop name
 * @param {string} month - Month in YYYY-MM format
 * @param {string} currency - Currency code (USD/VND)
 * @param {number} totalCustomerPaid - Total customer paid in original currency
 * @param {Map} manualAdsMap - Map of manual ads values (key: "shop|month|currency")
 * @return {Object} { offsiteAds, isEstimated }
 */
function calculateOffsiteAds_(shopName, month, currency, totalCustomerPaid, manualAdsMap) {
  const key = `${shopName}|${month}|${currency}`;
  const manualValue = manualAdsMap.get(key);
  
  if (manualValue && manualValue.value > 0) {
    // Use manual value (already in original currency)
    return {
      offsiteAds: manualValue.value,
      isEstimated: false
    };
  } else {
    // Calculate estimated: 0.5% of total customer paid (in original currency)
    const offsiteAds = totalCustomerPaid * OFFSITE_ADS_ESTIMATED_RATE;
    return {
      offsiteAds: offsiteAds,
      isEstimated: true
    };
  }
}

/**
 * Aggregate Dashboard data by (shop, month, currency) - giữ nguyên currency gốc
 * @return {Map} Map of "shop_name|month|currency" -> { shopName, month, currency, totalCustomerPaid, totalNetProfit, orderCount }
 */
function aggregateDashboardByShopMonth_() {
  const aggregated = new Map();
  
  try {
    const sheet = ensureDashboardSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return aggregated;
    
    // Read Dashboard data
    // Columns: Order ID (A=0), Order Date (B=1), Shop Name (E=4), Currency (F=5),
    // Buyer Paid (M=12), Net Profit (Z=25)
    const data = sheet.getRange(2, 1, lastRow - 1, DASHBOARD_HEADER.length).getValues();
    
    data.forEach(row => {
      const orderDate = safeString_(row[1]); // B: Order Date (ISO format: YYYY-MM-DD)
      const shopName = safeString_(row[4]); // E: Shop Name
      const currency = safeString_(row[5] || "USD").toUpperCase(); // F: Currency
      
      if (!shopName || !orderDate || !currency) return;
      
      // Extract month from order date (YYYY-MM-DD -> YYYY-MM)
      const monthMatch = orderDate.match(/^(\d{4}-\d{2})/);
      if (!monthMatch) return;
      const month = monthMatch[1];
      
      // Đọc từ original columns (giữ nguyên currency gốc)
      const buyerPaid = parseFloat(row[12] || 0); // M: Buyer Paid (original, index 12)
      let netProfit = parseFloat(row[28] || 0); // AC: Net Profit (original, index 28)
      
      // Fallback: nếu Net Profit = 0, tính từ calculated amounts
      if (netProfit === 0 && buyerPaid > 0) {
        const totalFees = parseFloat(row[25] || 0); // Z: Total Fees (calculated, index 25)
        const tax = parseFloat(row[23] || 0); // X: Tax (original, index 23)
        const productCost = parseFloat(row[13] || 0); // N: Product Cost (original, index 13)
        const sellerShippingCost = parseFloat(row[15] || 0); // P: Seller Shipping Cost (original, index 15)
        const offsiteAdsFee = parseFloat(row[20] || 0); // U: Offsite Ads Fee (calculated, index 20)
        
        const netRevenue = buyerPaid - totalFees - tax;
        const grossProfit = netRevenue - productCost;
        netProfit = grossProfit - sellerShippingCost - offsiteAdsFee;
      }
      
      // Group by (shop, month, currency) - sum riêng từng shop
      const key = `${shopName}|${month}|${currency}`;
      
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          shopName: shopName,
          month: month,
          currency: currency,
          totalCustomerPaid: 0,
          totalNetProfit: 0,
          orderCount: 0
        });
      }
      
      const agg = aggregated.get(key);
      agg.totalCustomerPaid += buyerPaid;
      agg.totalNetProfit += netProfit || 0;
      agg.orderCount += 1;
    });
  } catch (err) {
    Logger.log(`[DASHBOARD] Error aggregating data: ${err.message}`);
  }
  
  return aggregated;
}

/**
 * Build and write monthly dashboard data
 * @return {Object} { success, rowsAdded, errors }
 */
function buildMonthlyDashboard_() {
  try {
    // Ensure sheets exist
    ensureDashboardSheet_();
    ensureAdsSummaryInputSheet_();
    const monthlySheet = ensureDashboardMonthlySheet_();
    
    // Load manual ads values
    const manualAdsMap = loadManualAdsValues_();
    
    // Aggregate Dashboard data by (shop, month)
    const aggregated = aggregateDashboardByShopMonth_();
    
    if (aggregated.size === 0) {
      return { success: true, rowsAdded: 0, errors: [] };
    }
    
    // Clear existing data (keep header)
    const lastRow = monthlySheet.getLastRow();
    if (lastRow > 1) {
      monthlySheet.deleteRows(2, lastRow - 1);
    }
    
    // Build rows
    const rows = [];
    aggregated.forEach((agg, key) => {
      // Calculate Offsite Ads (theo currency gốc)
      const adsResult = calculateOffsiteAds_(
        agg.shopName,
        agg.month,
        agg.currency,
        agg.totalCustomerPaid,
        manualAdsMap
      );
      
      // Calculate Profit After Ads (theo currency gốc)
      const profitAfterAds = agg.totalNetProfit - adsResult.offsiteAds;
      
      rows.push([
        agg.shopName,                    // A: Shop Name
        agg.month,                       // B: Month (YYYY-MM)
        agg.currency,                    // C: Currency (original)
        agg.totalCustomerPaid,           // D: Total Customer Paid (original)
        agg.totalNetProfit,              // E: Total Net Profit (original)
        adsResult.offsiteAds,             // F: Offsite Ads (original)
        adsResult.isEstimated,           // G: Offsite Ads Is Estimated
        profitAfterAds,                  // H: Profit After Ads (original)
        agg.orderCount,                  // I: Order Count
        new Date().toISOString()         // J: Last Updated
      ]);
    });
    
    // Sort by shop name, then by month (descending)
    rows.sort((a, b) => {
      if (a[0] !== b[0]) return a[0].localeCompare(b[0]); // Shop name
      return b[1].localeCompare(a[1]); // Month descending
    });
    
    // Write to sheet
    if (rows.length > 0) {
      const startRow = 2;
      monthlySheet.getRange(startRow, 1, rows.length, DASHBOARD_MONTHLY_HEADER.length).setValues(rows);
      
      // Format number columns (D, E, F, H: financial columns)
      const numCols = [3, 4, 5, 7]; // D, E, F, H
      numCols.forEach(col => {
        monthlySheet.getRange(startRow, col, rows.length, 1).setNumberFormat("#,##0");
      });
      
      // Format boolean column (G: Offsite Ads Is Estimated)
      monthlySheet.getRange(startRow, 7, rows.length, 1).setNumberFormat("@");
      monthlySheet.getRange(startRow, 7, rows.length, 1).setValues(
        rows.map(row => [row[6] ? "Yes (Estimated)" : "No (Manual)"])
      );
    }
    
    return { success: true, rowsAdded: rows.length, errors: [] };
    
  } catch (err) {
    Logger.log(`[DASHBOARD] Error building monthly dashboard: ${err.message}`);
    return { success: false, rowsAdded: 0, errors: [err.message] };
  }
}

// ==================== SHOP COLUMNS MANAGEMENT ====================

/**
 * Get unique shop names from rows
 * @param {Array} rows - Array of row arrays
 * @return {Array} Array of unique shop names
 */
function getShopNamesFromRows_(rows) {
  const shopSet = new Set();
  rows.forEach(row => {
    const shopName = safeString_(row[4]); // E: Shop Name (index 4)
    if (shopName) {
      shopSet.add(shopName);
    }
  });
  return Array.from(shopSet);
}

/**
 * Ensure shop columns exist in Dashboard sheet
 * @param {Sheet} sheet - Dashboard sheet
 * @param {Array} shopNames - Array of shop names
 */
function ensureShopColumns_(sheet, shopNames) {
  if (!shopNames || shopNames.length === 0) return;
  
  const lastCol = sheet.getLastColumn();
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // Find existing shop columns
  const existingShopCols = new Map();
  headerRow.forEach((header, idx) => {
    const headerStr = safeString_(header);
    if (headerStr && headerStr.includes(" Total")) {
      const shopName = headerStr.replace(" Total", "").trim();
      existingShopCols.set(shopName, idx + 1); // Column number (1-based)
    }
  });
  
  // Add missing shop columns
  shopNames.forEach(shopName => {
    if (!existingShopCols.has(shopName)) {
      const newCol = sheet.getLastColumn() + 1;
      sheet.insertColumnAfter(sheet.getLastColumn());
      sheet.getRange(1, newCol).setValue(`${shopName} Total`).setFontWeight("bold");
      sheet.getRange(1, newCol).setBackground("#e8f0fe");
      existingShopCols.set(shopName, newCol);
    }
  });
}

/**
 * Update formulas in shop columns - Setup labels and formulas from row 2
 * @param {Sheet} sheet - Dashboard sheet
 */
function updateShopColumnFormulas_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol <= DASHBOARD_HEADER.length) return;
  
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // Find shop columns (columns after DASHBOARD_HEADER)
  // EXCLUDE "Tổng Shop" column to avoid circular dependency
  const shopColumns = [];
  let totalShopColNum = null;
  for (let col = DASHBOARD_HEADER.length + 1; col <= lastCol; col++) {
    const header = safeString_(headerRow[col - 1]);
    if (header && header.includes(" Total")) {
      const shopName = header.replace(" Total", "").trim();
      if (shopName === "Tổng Shop") {
        totalShopColNum = col; // Remember "Tổng Shop" column but don't include in shopColumns
      } else {
        shopColumns.push({ col: col, shopName: shopName });
      }
    }
  }
  
  if (shopColumns.length === 0) return;
  
  // Find column indices dynamically from header
  const findColIndex = (headerName) => {
    for (let i = 0; i < headerRow.length; i++) {
      if (safeString_(headerRow[i]).toLowerCase() === headerName.toLowerCase()) {
        return i + 1; // Convert to 1-based column number
      }
    }
    return null;
  };
  
  // Get all column indices
  const shopNameCol = findColIndex("Shop Name") || 5;
  const shopNameColLetter = colNumToLetter_(shopNameCol);
  
  // Define metrics mapping: { label, headerName, isPercentage }
  const metrics = [
    { label: "Subtotal Price", headerName: "Subtotal Price", isPercentage: false },
    { label: "Buyer Paid", headerName: "Buyer Paid", isPercentage: false },
    { label: "Product Cost", headerName: "Product Cost", isPercentage: false },
    { label: "Buyer Shipping Paid", headerName: "Buyer Shipping Paid", isPercentage: false },
    { label: "Seller Shipping Cost", headerName: "Seller Shipping Cost", isPercentage: false },
    { label: "Transaction Fee", headerName: "Transaction Fee", isPercentage: false },
    { label: "Payment Fee", headerName: "Payment Fee", isPercentage: false },
    { label: "Regulatory Operating Fee", headerName: "Regulatory Operating Fee", isPercentage: false },
    { label: "Listing Fee", headerName: "Listing Fee", isPercentage: false },
    { label: "Offsite Ads Fee", headerName: "Offsite Ads Fee", isPercentage: false },
    { label: "Fees Subtotal", headerName: "Fees Subtotal", isPercentage: false },
    { label: "VAT on Fees", headerName: "VAT on Fees", isPercentage: false },
    { label: "Tax", headerName: "Tax", isPercentage: false },
    { label: "Discount", headerName: "Discount", isPercentage: false },
    { label: "Total Fees", headerName: "Total Fees", isPercentage: false },
    { label: "Net Revenue", headerName: "Net Revenue", isPercentage: false },
    { label: "Gross Profit", headerName: "Gross Profit", isPercentage: false },
    { label: "Net Profit", headerName: "Net Profit", isPercentage: false },
    { label: "Profit Margin %", headerName: "Profit Margin %", isPercentage: true, special: true },
    { label: "Order Count", headerName: "Order Count", isPercentage: false },
    { label: "Quantity", headerName: "Quantity", isPercentage: false }
  ];
  
  // Get shop column letters for "Tổng Shop" formula (EXCLUDE "Tổng Shop" itself)
  const shopColLetters = shopColumns.map(({ col }) => colNumToLetter_(col));
  
  // Setup each shop column
  shopColumns.forEach(({ col, shopName }) => {
    const labels = [];
    const formulas = [];
    
    metrics.forEach((metric, idx) => {
      const rowNum = 2 + idx; // Start from row 2
      labels.push([metric.label]);
      
      if (metric.special && metric.label === "Profit Margin %") {
        // Special formula: Net Profit / Buyer Paid
        const buyerPaidCol = findColIndex("Buyer Paid") || 13;
        const netProfitCol = findColIndex("Net Profit") || 29;
        const buyerPaidColLetter = colNumToLetter_(buyerPaidCol);
        const netProfitColLetter = colNumToLetter_(netProfitCol);
        formulas.push([`=IF(SUMIF($${shopNameColLetter}:$${shopNameColLetter}; "${shopName}"; $${buyerPaidColLetter}:$${buyerPaidColLetter}) > 0; SUMIF($${shopNameColLetter}:$${shopNameColLetter}; "${shopName}"; $${netProfitColLetter}:$${netProfitColLetter}) / SUMIF($${shopNameColLetter}:$${shopNameColLetter}; "${shopName}"; $${buyerPaidColLetter}:$${buyerPaidColLetter}); 0)`]);
      } else {
        // Regular SUMIF formula
        const metricCol = findColIndex(metric.headerName);
        if (metricCol) {
          const metricColLetter = colNumToLetter_(metricCol);
          formulas.push([`=SUMIF($${shopNameColLetter}:$${shopNameColLetter}; "${shopName}"; $${metricColLetter}:$${metricColLetter})`]);
        } else {
          formulas.push([""]); // Empty if column not found
        }
      }
    });
    
    // Write labels and formulas
    if (labels.length > 0) {
      sheet.getRange(2, col, labels.length, 1).setValues(labels);
      sheet.getRange(2, col, formulas.length, 1).setFormulas(formulas);
      
      // Format: percentage for Profit Margin %, numbers for others
      metrics.forEach((metric, idx) => {
        const rowNum = 2 + idx;
        if (metric.isPercentage) {
          sheet.getRange(rowNum, col).setNumberFormat("0.00%");
        } else {
          sheet.getRange(rowNum, col).setNumberFormat("#,##0");
        }
      });
    }
  });
  
  // Create/Update "Tổng Shop" column (sum of all shop columns)
  const totalShopHeader = "Tổng Shop";
  
  // Create if not exists (totalShopColNum was already found above if exists)
  if (!totalShopColNum) {
    sheet.insertColumnAfter(sheet.getLastColumn());
    totalShopColNum = sheet.getLastColumn();
    sheet.getRange(1, totalShopColNum).setValue(totalShopHeader).setFontWeight("bold");
    sheet.getRange(1, totalShopColNum).setBackground("#fff2cc");
  }
  
  // Setup "Tổng Shop" column with sum formulas
  const totalLabels = [];
  const totalFormulas = [];
  
  metrics.forEach((metric, idx) => {
    const rowNum = 2 + idx;
    totalLabels.push([metric.label]);
    
    if (metric.special && metric.label === "Profit Margin %") {
      // Special formula: Total Net Profit / Total Buyer Paid
      const buyerPaidRow = 2 + metrics.findIndex(m => m.label === "Buyer Paid");
      const netProfitRow = 2 + metrics.findIndex(m => m.label === "Net Profit");
      const sumFormula = shopColLetters.map(letter => `${letter}${buyerPaidRow}`).join("+");
      const sumNetProfitFormula = shopColLetters.map(letter => `${letter}${netProfitRow}`).join("+");
      totalFormulas.push([`=IF(${sumFormula} > 0; ${sumNetProfitFormula} / ${sumFormula}; 0)`]);
    } else {
      // Sum all shop columns for this metric
      const sumFormula = shopColLetters.map(letter => `${letter}${rowNum}`).join("+");
      totalFormulas.push([`=${sumFormula}`]);
    }
  });
  
  // Write labels and formulas for "Tổng Shop"
  if (totalLabels.length > 0) {
    sheet.getRange(2, totalShopColNum, totalLabels.length, 1).setValues(totalLabels);
    sheet.getRange(2, totalShopColNum, totalFormulas.length, 1).setFormulas(totalFormulas);
    
    // Format: percentage for Profit Margin %, numbers for others
    metrics.forEach((metric, idx) => {
      const rowNum = 2 + idx;
      if (metric.isPercentage) {
        sheet.getRange(rowNum, totalShopColNum).setNumberFormat("0.00%");
      } else {
        sheet.getRange(rowNum, totalShopColNum).setNumberFormat("#,##0");
      }
    });
  }
}

/**
 * Rebuild monthly dashboard (public function, can be called from menu)
 */
function rebuildMonthlyDashboard() {
  const result = buildMonthlyDashboard_();
  if (result.success) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `✅ Monthly Dashboard rebuilt successfully!\n${result.rowsAdded} rows added.`,
      "Success",
      5
    );
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `❌ Error rebuilding Monthly Dashboard:\n${result.errors.join(", ")}`,
      "Error",
      10
    );
  }
  return result;
}

/**
 * Refresh shop columns formulas (public function, can be called to update formulas)
 */
function refreshShopColumns() {
  try {
    const sheet = ensureDashboardSheet_();
    updateShopColumnFormulas_(sheet);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `✅ Shop columns formulas updated successfully!`,
      "Success",
      3
    );
    return { success: true };
  } catch (err) {
    Logger.log(`[DASHBOARD] Error refreshing shop columns: ${err.message}`);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `❌ Error: ${err.message}`,
      "Error",
      5
    );
    return { success: false, error: err.message };
  }
}

/**
 * Verify Dashboard data alignment (check header and data columns match)
 * Public function - can be called from menu
 * @return {Object} { success, message, headerCount, dataColumns }
 */
function verifyDashboardAlignment() {
  try {
    const sheet = ensureDashboardSheet_();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow < 2) {
      const msg = "Dashboard is empty (no data rows)";
      SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Info", 3);
      return { 
        success: true, 
        message: msg,
        headerCount: DASHBOARD_HEADER.length,
        dataColumns: 0
      };
    }
    
    // Check header
    const headerRow = sheet.getRange(1, 1, 1, DASHBOARD_HEADER.length).getValues()[0];
    const headerMatch = headerRow[0] === DASHBOARD_HEADER[0] && 
                       headerRow[4] === DASHBOARD_HEADER[4] && 
                       headerRow[12] === DASHBOARD_HEADER[12];
    
    // Check data columns (actual data range)
    const dataRange = sheet.getRange(2, 1, lastRow - 1, DASHBOARD_HEADER.length);
    const dataCols = dataRange.getNumColumns();
    
    // Check if header needs update
    let needsUpdate = false;
    if (!headerMatch) {
      needsUpdate = true;
    }
    
    const result = {
      success: headerMatch && (dataCols === DASHBOARD_HEADER.length),
      message: headerMatch 
        ? `✅ Header aligned. Data has ${dataCols} columns (expected ${DASHBOARD_HEADER.length}). Last row: ${lastRow}`
        : `❌ Header mismatch. Expected "${DASHBOARD_HEADER[0]}" but got "${headerRow[0]}"`,
      headerCount: DASHBOARD_HEADER.length,
      dataColumns: dataCols,
      lastRow: lastRow,
      lastCol: lastCol,
      needsUpdate: needsUpdate
    };
    
    // Show toast notification
    SpreadsheetApp.getActiveSpreadsheet().toast(
      result.message,
      result.success ? "Success" : "Warning",
      result.success ? 3 : 5
    );
    
    Logger.log(`[DASHBOARD] Verification: ${JSON.stringify(result)}`);
    return result;
    
  } catch (err) {
    Logger.log(`[DASHBOARD] Error verifying alignment: ${err.message}`);
    const msg = `❌ Error: ${err.message}`;
    SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Error", 5);
    return { 
      success: false, 
      error: err.message,
      message: msg
    };
  }
}

/**
 * Reformat all financial columns in Dashboard sheet according to currency
 * Useful for fixing old data that was formatted incorrectly
 * Run this function to fix existing rows with wrong format
 */
function reformatDashboardCurrency() {
  try {
    const sheet = ensureDashboardSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log(`[DASHBOARD] No data rows to format`);
      SpreadsheetApp.getActiveSpreadsheet().toast("No data rows to format", "Info", 3);
      return;
    }
    
    Logger.log(`[DASHBOARD] Reformatting currency for ${lastRow - 1} rows`);
    
    // Financial columns (L to AC, index 11-28)
    const numCols = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
    
    // Format each row according to its currency
    for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
      // Read currency from sheet (column F, index 5)
      const currencyCell = sheet.getRange(rowNum, 6, 1, 1).getValue(); // F: Currency (column 6)
      const currency = safeString_(currencyCell || "USD").toUpperCase();
      
      // Determine format based on currency
      let formatStr;
      if (currency === "VND") {
        formatStr = '#,##0 "₫"'; // VND: no decimal, ₫ at end (e.g., 649,500 ₫)
      } else {
        // USD: Use format that works with Vietnam locale
        // Use [$$-409]#,##0.00 to force US format (comma for thousands, dot for decimal)
        formatStr = '[$$-409]#,##0.00'; // USD: 2 decimals, $ at start, US format (e.g., $4,500.00)
      }
      
      // Format all financial columns for this row
      numCols.forEach(col => {
        sheet.getRange(rowNum, col + 1, 1, 1).setNumberFormat(formatStr);
      });
    }
    
    Logger.log(`[DASHBOARD] ✅ Successfully reformatted currency for ${lastRow - 1} rows`);
    SpreadsheetApp.getActiveSpreadsheet().toast(`✅ Reformatted ${lastRow - 1} rows`, "Success", 3);
  } catch (err) {
    Logger.log(`[DASHBOARD] Error reformatting currency: ${err.message}`);
    SpreadsheetApp.getActiveSpreadsheet().toast(`❌ Error: ${err.message}`, "Error", 5);
    throw err;
  }
}

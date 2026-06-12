/*
 * =============================================================
 * == FILE: 10_API.gs
 * == MỤC ĐÍCH: Web API endpoints for frontend dashboard
 * =============================================================
 */

// ==================== DOGET HANDLER ====================

/**
 * Handle GET requests from frontend
 * Endpoints:
 * - ?action=getOrdersFact&filters={...}
 * - ?action=getDashboardMonthly&view_mode=original&filters={...}
 * - ?action=getDashboardDaily&view_mode=original&filters={...}
 * - ?action=getShopList
 * - ?action=setFxRate&shop_name=...&fx_rate=...
 * - ?action=rebuildDashboard
 */
function doGet(e) {
  try {
    const action = e.parameter.action || "";
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    
    switch (action) {
      case "getOrdersFact":
        const filters1 = e.parameter.filters ? JSON.parse(e.parameter.filters) : {};
        output.setContent(JSON.stringify(getOrdersFact_(filters1)));
        break;
        
      case "getDashboardMonthly":
        const viewMode1 = e.parameter.view_mode || "original";
        const filters2 = e.parameter.filters ? JSON.parse(e.parameter.filters) : {};
        output.setContent(JSON.stringify(getDashboardMonthly_(viewMode1, filters2)));
        break;
        
      case "getDashboardDaily":
        const viewMode2 = e.parameter.view_mode || "original";
        const filters3 = e.parameter.filters ? JSON.parse(e.parameter.filters) : {};
        output.setContent(JSON.stringify(getDashboardDaily_(viewMode2, filters3)));
        break;
        
      case "getShopList":
        output.setContent(JSON.stringify(getShopList_()));
        break;
        
      case "getShopSummary":
        const shopName = e.parameter.shop_name || "";
        const columnFilter = e.parameter.columns ? e.parameter.columns.split(",") : null;
        output.setContent(JSON.stringify(getShopSummary_(shopName, columnFilter)));
        break;
        
      case "getDashboardTotal":
        output.setContent(JSON.stringify(getDashboardTotal_()));
        break;
        
      case "setFxRate":
        const fxShopName = e.parameter.shop_name || "";
        const fxRate = parseFloat(e.parameter.fx_rate || 0);
        output.setContent(JSON.stringify(setFxRate_(fxShopName, fxRate)));
        break;
        
      case "rebuildDashboard":
        const result = rebuildMonthlyDashboard();
        output.setContent(JSON.stringify({ success: result.success, rowsAdded: result.rowsAdded }));
        break;
        
      default:
        output.setContent(JSON.stringify({ error: "Unknown action: " + action }));
    }
    
    return output;
    
  } catch (err) {
    const errorOutput = ContentService.createTextOutput();
    errorOutput.setMimeType(ContentService.MimeType.JSON);
    errorOutput.setContent(JSON.stringify({ 
      error: err.message || String(err),
      stack: err.stack || ""
    }));
    return errorOutput;
  }
}

// ==================== DATE RANGE HELPERS ====================

/**
 * Parse date range filter to start_date and end_date
 * Supports: "today", "tomorrow", "3days", "7days", "14days", "28days", "thismonth", "thisyear", "all"
 * @param {string} dateRange - Date range string
 * @return {Object} { start_date, end_date } (YYYY-MM-DD format)
 */
function parseDateRange_(dateRange) {
  if (!dateRange || dateRange === "all") {
    return { start_date: null, end_date: null };
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  
  const range = String(dateRange).toLowerCase().trim();
  
  if (range === "today") {
    return { start_date: formatDate(today), end_date: formatDate(today) };
  }
  
  if (range === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start_date: formatDate(tomorrow), end_date: formatDate(tomorrow) };
  }
  
  if (range === "3days" || range === "3") {
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 2); // 3 days including today
    return { start_date: formatDate(startDate), end_date: formatDate(today) };
  }
  
  if (range === "7days" || range === "7") {
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 6); // 7 days including today
    return { start_date: formatDate(startDate), end_date: formatDate(today) };
  }
  
  if (range === "14days" || range === "14") {
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 13); // 14 days including today
    return { start_date: formatDate(startDate), end_date: formatDate(today) };
  }
  
  if (range === "28days" || range === "28") {
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 27); // 28 days including today
    return { start_date: formatDate(startDate), end_date: formatDate(today) };
  }
  
  if (range === "thismonth" || range === "this_month") {
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start_date: formatDate(startDate), end_date: formatDate(endDate) };
  }
  
  if (range === "thisyear" || range === "this_year") {
    const startDate = new Date(today.getFullYear(), 0, 1);
    const endDate = new Date(today.getFullYear(), 11, 31);
    return { start_date: formatDate(startDate), end_date: formatDate(endDate) };
  }
  
  // If dateRange is already in YYYY-MM-DD format, use as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(range)) {
    return { start_date: range, end_date: range };
  }
  
  // Default: return null (all dates)
  return { start_date: null, end_date: null };
}

// ==================== API FUNCTIONS ====================

/**
 * Get orders fact data with filters
 * @param {Object} filters - { shop_name, date_range, start_date, end_date, currency, ... }
 *   date_range: "today", "tomorrow", "3days", "7days", "14days", "28days", "thismonth", "thisyear", "all"
 * @return {Object} { success, data, total }
 */
function getOrdersFact_(filters) {
  try {
    const sheet = ensureDashboardSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [], total: 0 };
    }
    
    const headers = sheet.getRange(1, 1, 1, DASHBOARD_HEADER.length).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, DASHBOARD_HEADER.length).getValues();
    
    // Parse date range if provided
    let dateFilter = {};
    if (filters.date_range) {
      dateFilter = parseDateRange_(filters.date_range);
    } else {
      dateFilter = {
        start_date: filters.start_date || null,
        end_date: filters.end_date || null
      };
    }
    
    // Filter data
    let filtered = data.filter(row => {
      const shopName = safeString_(row[4]); // E: Shop Name
      const orderDate = safeString_(row[1]); // B: Order Date
      const currency = safeString_(row[5] || "USD").toUpperCase(); // F: Currency
      
      if (filters.shop_name && shopName !== filters.shop_name) return false;
      if (filters.currency && currency !== filters.currency.toUpperCase()) return false;
      if (dateFilter.start_date && orderDate < dateFilter.start_date) return false;
      if (dateFilter.end_date && orderDate > dateFilter.end_date) return false;
      
      return true;
    });
    
    // Convert to objects
    const result = filtered.map(row => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx];
      });
      return obj;
    });
    
    return { success: true, data: result, total: result.length };
    
  } catch (err) {
    Logger.log(`[API] Error getOrdersFact: ${err.message}`);
    return { success: false, error: err.message, data: [], total: 0 };
  }
}

/**
 * Get monthly dashboard data
 * @param {string} viewMode - "original" or "base" (VND)
 * @param {Object} filters - { shop_name, start_month, end_month, ... }
 * @return {Object} { success, data, total }
 */
function getDashboardMonthly_(viewMode, filters) {
  try {
    const monthlySheet = ensureDashboardMonthlySheet_();
    const lastRow = monthlySheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [], total: 0 };
    }
    
    const headers = monthlySheet.getRange(1, 1, 1, DASHBOARD_MONTHLY_HEADER.length).getValues()[0];
    const data = monthlySheet.getRange(2, 1, lastRow - 1, DASHBOARD_MONTHLY_HEADER.length).getValues();
    
    // Filter data
    let filtered = data.filter(row => {
      const shopName = safeString_(row[0]); // A: Shop Name
      const month = safeString_(row[1]); // B: Month
      
      if (filters.shop_name && shopName !== filters.shop_name) return false;
      if (filters.start_month && month < filters.start_month) return false;
      if (filters.end_month && month > filters.end_month) return false;
      
      return true;
    });
    
    // Convert to objects
    const result = filtered.map(row => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx];
      });
      return obj;
    });
    
    // TODO: Convert to base currency if viewMode === "base"
    // This requires FX_Rates sheet lookup
    
    return { success: true, data: result, total: result.length, view_mode: viewMode };
    
  } catch (err) {
    Logger.log(`[API] Error getDashboardMonthly: ${err.message}`);
    return { success: false, error: err.message, data: [], total: 0 };
  }
}

/**
 * Get daily dashboard data (aggregate by day)
 * Supports aggregation by:
 * - Single shop: filters.shop_name = "ShopName"
 * - All shops: filters.shop_name = null or "all"
 * - Date range: filters.date_range = "today", "7days", "thismonth", etc.
 * @param {string} viewMode - "original" or "base" (VND)
 * @param {Object} filters - { shop_name, date_range, start_date, end_date, ... }
 * @return {Object} { success, data, total, summary }
 */
function getDashboardDaily_(viewMode, filters) {
  try {
    const sheet = ensureDashboardSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [], total: 0, summary: null };
    }
    
    const data = sheet.getRange(2, 1, lastRow - 1, DASHBOARD_HEADER.length).getValues();
    
    // Parse date range if provided
    let dateFilter = {};
    if (filters.date_range) {
      dateFilter = parseDateRange_(filters.date_range);
    } else {
      dateFilter = {
        start_date: filters.start_date || null,
        end_date: filters.end_date || null
      };
    }
    
    // Aggregate by (order_date, shop_name, currency) OR (order_date, currency) if shop_name = "all"
    const aggregated = new Map();
    const shopFilter = filters.shop_name && filters.shop_name !== "all" ? filters.shop_name : null;
    
    data.forEach(row => {
      const orderDate = safeString_(row[1]); // B: Order Date (YYYY-MM-DD)
      const shopName = safeString_(row[4]); // E: Shop Name
      const currency = safeString_(row[5] || "USD").toUpperCase(); // F: Currency
      
      // Apply filters
      if (shopFilter && shopName !== shopFilter) return;
      if (dateFilter.start_date && orderDate < dateFilter.start_date) return;
      if (dateFilter.end_date && orderDate > dateFilter.end_date) return;
      
      // Key: if shopFilter, group by (date, shop, currency); else group by (date, currency) for all shops
      const key = shopFilter 
        ? `${orderDate}|${shopName}|${currency}`
        : `${orderDate}|ALL|${currency}`;
      
      if (!aggregated.has(key)) {
        aggregated.set(key, {
          order_date: orderDate,
          shop_name: shopFilter || "ALL",
          currency: currency,
          buyer_paid: 0,
          total_fees: 0,
          net_revenue: 0,
          net_profit: 0,
          order_count: 0,
          quantity: 0
        });
      }
      
      const agg = aggregated.get(key);
      agg.buyer_paid += parseFloat(row[12] || 0); // M: Buyer Paid (index 12)
      agg.total_fees += parseFloat(row[25] || 0); // Z: Total Fees (index 25)
      agg.net_revenue += parseFloat(row[26] || 0); // AA: Net Revenue (index 26)
      agg.net_profit += parseFloat(row[28] || 0); // AC: Net Profit (index 28)
      agg.order_count += parseFloat(row[6] || 0); // G: Order Count (index 6)
      agg.quantity += parseFloat(row[7] || 0); // H: Quantity (index 7)
    });
    
    const result = Array.from(aggregated.values());
    
    // Calculate summary totals (all shops combined, all dates in range)
    const summary = {
      total_buyer_paid: 0,
      total_fees: 0,
      total_net_revenue: 0,
      total_net_profit: 0,
      total_order_count: 0,
      total_quantity: 0
    };
    
    result.forEach(item => {
      summary.total_buyer_paid += item.buyer_paid;
      summary.total_fees += item.total_fees;
      summary.total_net_revenue += item.net_revenue;
      summary.total_net_profit += item.net_profit;
      summary.total_order_count += item.order_count;
      summary.total_quantity += item.quantity;
    });
    
    // TODO: Convert to base currency if viewMode === "base"
    
    return { 
      success: true, 
      data: result, 
      total: result.length, 
      summary: summary,
      view_mode: viewMode 
    };
    
  } catch (err) {
    Logger.log(`[API] Error getDashboardDaily: ${err.message}`);
    return { success: false, error: err.message, data: [], total: 0, summary: null };
  }
}

/**
 * Get list of shops
 * @return {Object} { success, shops }
 */
function getShopList_() {
  try {
    const sheet = ensureDashboardSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, shops: [] };
    }
    
    const data = sheet.getRange(2, 4, lastRow - 1, 2).getValues(); // E: Shop Name, F: Currency
    
    const shopMap = new Map();
    data.forEach(row => {
      const shopName = safeString_(row[0]);
      const currency = safeString_(row[1] || "USD").toUpperCase();
      if (shopName) {
        if (!shopMap.has(shopName)) {
          shopMap.set(shopName, {
            shop_name: shopName,
            currency: currency,
            currency_default: currency
          });
        }
      }
    });
    
    const shops = Array.from(shopMap.values());
    
    return { success: true, shops: shops };
    
  } catch (err) {
    Logger.log(`[API] Error getShopList: ${err.message}`);
    return { success: false, error: err.message, shops: [] };
  }
}

/**
 * Set FX rate for a shop (future implementation - may need FX_Rates sheet)
 * @param {string} shopName - Shop name
 * @param {number} fxRate - FX rate to VND
 * @return {Object} { success, message }
 */
function setFxRate_(shopName, fxRate) {
  try {
    // TODO: Implement FX_Rates sheet or Script Properties
    // For now, just return success
    Logger.log(`[API] setFxRate called: shop=${shopName}, rate=${fxRate}`);
    return { success: true, message: "FX rate updated (not yet implemented)" };
  } catch (err) {
    Logger.log(`[API] Error setFxRate: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ==================== SHOP SUMMARY API ====================

/**
 * Get shop summary data from shop columns (AE, AF, AG, ...)
 * @param {string} shopName - Shop name (empty = all shops)
 * @param {Array} columnFilter - Array of column names to filter (null = all columns)
 * @return {Object} { success, shops: [{ shopName, metrics: {...} }], total: {...} }
 */
function getShopSummary_(shopName, columnFilter) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_DASHBOARD);
    if (!sheet) {
      return { success: false, error: "Dashboard sheet not found", shops: [] };
    }
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol <= DASHBOARD_HEADER.length) {
      return { success: false, error: "No data found", shops: [] };
    }
    
    const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // Find shop columns
    const shopColumns = [];
    for (let col = DASHBOARD_HEADER.length + 1; col <= lastCol; col++) {
      const header = String(headerRow[col - 1] || "").trim();
      if (header && header.includes(" Total")) {
        const shop = header.replace(" Total", "").trim();
        if (!shopName || shop === shopName) {
          shopColumns.push({ col: col, shopName: shop });
        }
      }
    }
    
    if (shopColumns.length === 0) {
      return { success: false, error: "No shop columns found", shops: [] };
    }
    
    // Define metrics order (same as in updateShopColumnFormulas_)
    const metrics = [
      "Subtotal Price",
      "Buyer Paid",
      "Product Cost",
      "Buyer Shipping Paid",
      "Seller Shipping Cost",
      "Transaction Fee",
      "Payment Fee",
      "Regulatory Operating Fee",
      "Listing Fee",
      "Offsite Ads Fee",
      "Fees Subtotal",
      "VAT on Fees",
      "Tax",
      "Discount",
      "Total Fees",
      "Net Revenue",
      "Gross Profit",
      "Net Profit",
      "Profit Margin %",
      "Order Count",
      "Quantity"
    ];
    
    // Read data from shop columns (row 2 to 22)
    const shops = [];
    let totalMetrics = {};
    
    shopColumns.forEach(({ col, shopName }) => {
      const values = sheet.getRange(2, col, metrics.length, 1).getValues();
      const metricsData = {};
      
      metrics.forEach((metric, idx) => {
        const value = values[idx][0];
        // Convert metric name to key: "Profit Margin %" -> "profit_margin"
        const key = metric.toLowerCase().replace(/\s+/g, "_").replace(/%/g, "");
        const numValue = typeof value === "number" ? value : 0;
        metricsData[key] = numValue;
        
        // Sum to total (except Profit Margin % which will be calculated)
        if (metric !== "Profit Margin %") {
          totalMetrics[key] = (totalMetrics[key] || 0) + numValue;
        }
      });
      
      // Filter metrics if columnFilter provided
      let filteredMetrics = metricsData;
      if (columnFilter && columnFilter.length > 0) {
        filteredMetrics = {};
        columnFilter.forEach(colName => {
          const key = colName.toLowerCase().replace(/\s+/g, "_").replace(/%/g, "");
          if (metricsData.hasOwnProperty(key)) {
            filteredMetrics[key] = metricsData[key];
          }
        });
      }
      
      shops.push({
        shopName: shopName,
        metrics: filteredMetrics
      });
    });
    
    // Calculate total Profit Margin %: Total Net Profit / Total Buyer Paid
    if (totalMetrics.buyer_paid > 0) {
      totalMetrics.profit_margin = totalMetrics.net_profit / totalMetrics.buyer_paid;
    } else {
      totalMetrics.profit_margin = 0;
    }
    
    // Read "Tổng Shop" column if exists
    let totalShopData = null;
    for (let col = DASHBOARD_HEADER.length + 1; col <= lastCol; col++) {
      const header = String(headerRow[col - 1] || "").trim();
      if (header === "Tổng Shop") {
        const values = sheet.getRange(2, col, metrics.length, 1).getValues();
        totalShopData = {};
        metrics.forEach((metric, idx) => {
          const value = values[idx][0];
          const key = metric.toLowerCase().replace(/\s+/g, "_").replace(/%/g, "");
          totalShopData[key] = typeof value === "number" ? value : 0;
        });
        break;
      }
    }
    
    // Use "Tổng Shop" column if exists, otherwise use calculated total
    let finalTotal = totalShopData || totalMetrics;
    
    // Filter total metrics if columnFilter provided
    if (columnFilter && columnFilter.length > 0) {
      const filteredTotal = {};
      columnFilter.forEach(colName => {
        const key = colName.toLowerCase().replace(/\s+/g, "_").replace(/%/g, "");
        if (finalTotal.hasOwnProperty(key)) {
          filteredTotal[key] = finalTotal[key];
        }
      });
      finalTotal = filteredTotal;
    }
    
    return { 
      success: true, 
      shops: shops,
      total: {
        shopName: "Tổng Shop",
        metrics: finalTotal
      }
    };
    
  } catch (err) {
    Logger.log(`[API] Error getting shop summary: ${err.message}`);
    return { success: false, error: err.message, shops: [] };
  }
}

/**
 * Get dashboard total summary (simplified view: Order Count, Profit, Net Profit)
 * @return {Object} { success, dashboard: { order_count, profit, net_profit } }
 */
function getDashboardTotal_() {
  try {
    const result = getShopSummary_("", null); // Get all shops with all metrics
    if (!result.success || !result.total) {
      return { success: false, error: "No total data found", dashboard: null };
    }
    
    const total = result.total.metrics;
    
    // Simplified dashboard view
    const dashboard = {
      order_count: total.order_count || 0,
      profit: total.gross_profit || 0,
      net_profit: total.net_profit || 0,
      profit_margin: total.profit_margin || 0,
      buyer_paid: total.buyer_paid || 0,
      total_fees: total.total_fees || 0
    };
    
    return { 
      success: true, 
      dashboard: dashboard 
    };
    
  } catch (err) {
    Logger.log(`[API] Error getting dashboard total: ${err.message}`);
    return { success: false, error: err.message, dashboard: null };
  }
}

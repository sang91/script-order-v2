/*
 * =============================================================
 * == FILE: 1_Config.gs
 * == MỤC ĐÍCH: Constants, IDs, column mappings
 * =============================================================
 */

// ==================== SPREADSHEET IDs ====================
const SPREADSHEET_ID = "1aWCOKShQNR0UXByRuv7TnXqfPzL66pJxRrd134lukY4";
const TYPE_LINKS_SSID = "1jwuh9bgDhYRSCBMoLN5OZt0LXFrs2ukiVF4IXnX1q1c";

// ==================== SHEET NAMES ====================
const TYPE_LINKS_SHEET = "TYPE_LINKS";
const MAPPING_SHEET = "Mapping";
const SHEET_KEYFOB = "Key Fob Order";
const SHEET_STRAP = "Strap Watch Order";
const SHEET_TRACK = "Tracking Info";
const YUN_SHEET_NAME = "YUNEXPRESS";
const YUN_TODAY_SHEET_NAME = "YUNEXPRESS TODAY";
const SHEET_DASHBOARD = "Dashboard";
const SHEET_DASHBOARD_MONTHLY = "Dashboard_Monthly";
const SHEET_ADS_SUMMARY_INPUT = "Ads_Summary_Input";

// ==================== YUNEXPRESS COLUMNS ====================
// Map đúng template Yun mới (74 cột, có LabelLink) - Updated 2026-06
// Yun xóa 3 cột (ManufactureSalesName, UnifiedSocialCreditCode, Collection...)
// Yun thêm 3 cột (PackageLength, PackageWidth, PackageHeight)
// Cột 11-24 dịch lên 3, cột 28+ giữ nguyên
const YUN_COLS = {
  orderNo: 1,              // CustomerOrderNo.
  routing: 2,              // RoutingCode
  tracking: 3,             // Trackingnumber
  vatNumber: 8,            // VatNumber (cho GB)
  ioss: 10,                // IossCode (cho EU)
  country: 11,             // CountryCode — was 14
  name: 12,                // Name — was 15
  street: 15,              // Street — was 18
  city: 16,                // City — was 19
  province: 17,            // Province/State — was 20
  zip: 18,                 // ZipCode — was 21
  phone: 19,               // phone — was 22
  email: 21,               // Email — was 24
  packageNumber: 23,       // PackageNumber — was 26
  packageWeight: 24,       // PackageWeight — was 27
  senderCountry: 34,       // SenderCountry — giữ nguyên
  currencyCode: 46,        // CurrencyCode — giữ nguyên
  sku1: 47,                // SKU1 — giữ nguyên
  itemDescription1: 48,    // ItemDescription1 — giữ nguyên
  foreignItemDescription1: 49, // ForeignItemDescription1 — giữ nguyên
  declaredQuantity1: 50,   // DeclaredQuantity1 — giữ nguyên
  fobPrice1: 51,           // FOBPrice1 — giữ nguyên
  sellingPrice1: 52,       // SellingPrice1 — giữ nguyên
  unitWeight1: 53,         // UnitWeight1 — giữ nguyên
  hsCode1: 54,             // HsCode1 (cho GB) — giữ nguyên
  labelLink: 74            // LabelLink — cột mới trên template Yun
};

// ==================== YUNEXPRESS SETTINGS ====================
const YUN_ROUTING_CODE = "VNTHZXR";
const YUN_RATE = 0.084;
/** Format US (409) — hiển thị 0.084 / 29 đúng trên GSheet VN, export xlsx vẫn là số */
const YUN_WEIGHT_FORMAT = "[$-409]0.000";
const YUN_PRICE_FORMAT = "[$-409]0";
const YUN_INT_FORMAT = "[$-409]0";
const YUN_IOSS_NUMBER = "IOSS253421447001716368490"; // IOSS cho EU countries
const YUN_VAT_NUMBER_GB = "GB123456789"; // VAT number cho GB (cần cập nhật số thực tế)
// Giá fix cứng: 29 (trừ CA = 14)
const YUN_FOB_PRICE_DEFAULT = 29;
const YUN_FOB_PRICE_CA = 14;
const YUN_SELLING_PRICE_DEFAULT = 29;
const YUN_SELLING_PRICE_CA = 14;
const YUN_CURRENCY_CODE = "USD";
const YUN_SENDER_COUNTRY = "VN";
const YUN_SKU_KEYFOB = "keyfob";
const YUN_SKU_STRAP = "strap";

// ==================== DASHBOARD SETTINGS ====================
const USD_TO_VND_RATE = 26500; // Tỷ giá USD sang VND
const OFFSITE_ADS_ESTIMATED_RATE = 0.005; // 0.5% của total customer paid per month

// ==================== PRODUCT COST CONFIGURATION ====================
// Product cost by product type (in VND)
const PRODUCT_COST_KEYFOB = 135000; // Keyfob cost
const PRODUCT_COST_STRAP_WATCH = 300000; // Strap/Watch (đồng hồ) cost

// ==================== SHIPPING COST CONFIGURATION ====================
// Shipping cost table by weight and country (SAIGONBAY EPACK 2025)
// Weight tiers: < 100gr, 100, 150, 200, ..., 1kg, 1.1kg, 1.2kg, 1.3kg, 1.4kg, 1.5kg, 1.6kg
// Countries: USA, UK, CA (Canada), AU (Australia), SG (Singapore), KR (Korea)
// Format: weight in grams -> { country_code: cost_in_vnd }
const SHIPPING_COST_TABLE = {
  // < 100gr (use 100 as threshold)
  // SAIGONBAY: USA, UK, CA, AU, SG, KR
  // SINGPOST: USA, TH/MY/PH/BN/ID, AU/NZ/JP, Rest of Asia + EU, UAE/SA + Rest of World, EU - Royal mail, Rest of EU - Royal mail
  100: { USA: 155000, UK: 185000, CA: 285000, AU: 235000, SG: 232000, KR: 165000, EU: 295000 },
  // 100gr - 950gr (increment by 50gr)
  150: { USA: 165000, UK: 195000, CA: 295000, AU: 245000, SG: 242000, KR: 175000, EU: 333000 },
  200: { USA: 175000, UK: 205000, CA: 305000, AU: 255000, SG: 252000, KR: 185000, EU: 339000 },
  250: { USA: 185000, UK: 215000, CA: 315000, AU: 265000, SG: 262000, KR: 195000, EU: 347000 },
  300: { USA: 195000, UK: 225000, CA: 325000, AU: 275000, SG: 272000, KR: 205000, EU: 352000 },
  350: { USA: 205000, UK: 235000, CA: 335000, AU: 285000, SG: 282000, KR: 215000, EU: 362000 },
  400: { USA: 215000, UK: 245000, CA: 345000, AU: 295000, SG: 292000, KR: 225000, EU: 368000 },
  450: { USA: 225000, UK: 255000, CA: 355000, AU: 305000, SG: 302000, KR: 235000, EU: 427000 },
  500: { USA: 235000, UK: 265000, CA: 365000, AU: 315000, SG: 312000, KR: 245000, EU: 455000 },
  550: { USA: 245000, UK: 275000, CA: 375000, AU: 325000, SG: 322000, KR: 255000, EU: 467000 },
  600: { USA: 255000, UK: 285000, CA: 385000, AU: 335000, SG: 332000, KR: 265000, EU: 476000 },
  650: { USA: 265000, UK: 295000, CA: 395000, AU: 345000, SG: 342000, KR: 275000, EU: 485000 },
  700: { USA: 275000, UK: 305000, CA: 405000, AU: 355000, SG: 352000, KR: 285000, EU: 492000 },
  750: { USA: 285000, UK: 315000, CA: 415000, AU: 365000, SG: 362000, KR: 295000, EU: 503000 },
  800: { USA: 295000, UK: 325000, CA: 425000, AU: 375000, SG: 372000, KR: 305000, EU: 531000 },
  850: { USA: 305000, UK: 335000, CA: 435000, AU: 385000, SG: 382000, KR: 315000, EU: 549000 },
  900: { USA: 315000, UK: 345000, CA: 445000, AU: 395000, SG: 392000, KR: 325000, EU: 562000 },
  950: { USA: 325000, UK: 355000, CA: 455000, AU: 405000, SG: 402000, KR: 335000, EU: 571000 },
  // 1kg - 1.2kg (increment by 0.1kg) - Updated from new table
  1000: { USA: 335000, UK: 365000, CA: 465000, AU: 415000, SG: 412000, KR: 345000, EU: 571000 },
  1100: { USA: 365000, UK: 395000, CA: 495000, AU: 445000, SG: 442000, KR: 375000, EU: 697000 },
  1200: { USA: 395000, UK: 425000, CA: 525000, AU: 475000, SG: 472000, KR: 405000, EU: 705000 },
  // Extended tiers for weights > 1.2kg (use max tier value)
  1300: { USA: 425000, UK: 455000, CA: 555000, AU: 505000, SG: 502000, KR: 435000, EU: 705000 },
  1400: { USA: 455000, UK: 485000, CA: 585000, AU: 535000, SG: 532000, KR: 465000, EU: 705000 },
  1500: { USA: 485000, UK: 515000, CA: 615000, AU: 565000, SG: 562000, KR: 495000, EU: 705000 },
  1600: { USA: 793000, UK: 684000, CA: 865000, AU: 920000, SG: 618000, KR: 600000, EU: 705000 }
};

// Shipping weight calculation
// Mỗi item = 0.084kg (84gr)
// Tổng weight = 84gr * số lượng items
const SHIPPING_BASE_WEIGHT_GR = 84; // 0.084kg = 84gr per item

/**
 * Calculate shipping weight in grams based on quantity
 * @param {number} quantity - Order quantity
 * @return {number} Weight in grams
 */
function calculateShippingWeight_(quantity) {
  const qty = Math.max(1, Math.floor(quantity || 1));
  // 1 item = 84gr, 2 items = 168gr, 3 items = 252gr, etc.
  return SHIPPING_BASE_WEIGHT_GR * qty;
}

/**
 * Get shipping cost by weight and country
 * @param {number} weightGr - Weight in grams
 * @param {string} countryCode - Country code (USA, UK, CA, AU, SG, KR)
 * @return {number} Shipping cost in VND, or 0 if not found
 */
function getShippingCostByWeight_(weightGr, countryCode) {
  if (!weightGr || weightGr <= 0) return 0;
  if (!countryCode) return 0;
  
  const country = String(countryCode).toUpperCase().trim();
  
  // Normalize country codes
  const countryMap = {
    "US": "USA", "UNITED STATES": "USA", "UNITED STATES OF AMERICA": "USA",
    "GB": "UK", "UNITED KINGDOM": "UK", "GREAT BRITAIN": "UK",
    "CANADA": "CA", "CAN": "CA",
    "AUSTRALIA": "AU", "AUS": "AU",
    "SINGAPORE": "SG", "SGP": "SG",
    "KOREA": "KR", "SOUTH KOREA": "KR", "KOR": "KR", "KR": "KR",
    // EU countries - map to EU (common price for all EU countries)
    "DE": "EU", "GERMANY": "EU", "DEUTSCHLAND": "EU",
    "FR": "EU", "FRANCE": "EU",
    "IT": "EU", "ITALY": "EU", "ITALIA": "EU",
    "ES": "EU", "SPAIN": "EU", "ESPANA": "EU",
    "NL": "EU", "NETHERLANDS": "EU", "HOLLAND": "EU",
    "BE": "EU", "BELGIUM": "EU", "BELGIË": "EU",
    "AT": "EU", "AUSTRIA": "EU", "ÖSTERREICH": "EU",
    "SE": "EU", "SWEDEN": "EU", "SVERIGE": "EU",
    "DK": "EU", "DENMARK": "EU", "DANMARK": "EU",
    "FI": "EU", "FINLAND": "EU", "SUOMI": "EU",
    "PL": "EU", "POLAND": "EU", "POLSKA": "EU",
    "PT": "EU", "PORTUGAL": "EU",
    "IE": "EU", "IRELAND": "EU", "ÉIRE": "EU",
    "CZ": "EU", "CZECH REPUBLIC": "EU", "CZECHIA": "EU",
    "GR": "EU", "GREECE": "EU",
    "HU": "EU", "HUNGARY": "EU", "MAGYARORSZÁG": "EU",
    "RO": "EU", "ROMANIA": "EU", "ROMÂNIA": "EU",
    "BG": "EU", "BULGARIA": "EU",
    "HR": "EU", "CROATIA": "EU",
    "SK": "EU", "SLOVAKIA": "EU",
    "SI": "EU", "SLOVENIA": "EU",
    "LT": "EU", "LITHUANIA": "EU",
    "LV": "EU", "LATVIA": "EU",
    "EE": "EU", "ESTONIA": "EU",
    "LU": "EU", "LUXEMBOURG": "EU",
    "MT": "EU", "MALTA": "EU",
    "CY": "EU", "CYPRUS": "EU"
  };
  
  const normalizedCountry = countryMap[country] || country;
  
  // Find matching weight tier (round up to nearest tier)
  const weightTiers = Object.keys(SHIPPING_COST_TABLE).map(Number).sort((a, b) => a - b);
  
  // If weight exceeds max tier (1600gr), use max tier
  if (weightGr > Math.max(...weightTiers)) {
    const maxTier = Math.max(...weightTiers);
    const maxTierData = SHIPPING_COST_TABLE[maxTier];
    return maxTierData[normalizedCountry] || 0;
  }
  
  // Find the smallest tier that is >= weightGr
  for (const tier of weightTiers) {
    if (weightGr <= tier) {
      const tierData = SHIPPING_COST_TABLE[tier];
      return tierData[normalizedCountry] || 0;
    }
  }
  
  // Fallback: use max tier
  const maxTier = Math.max(...weightTiers);
  const maxTierData = SHIPPING_COST_TABLE[maxTier];
  return maxTierData[normalizedCountry] || 0;
}

// ==================== FEE CONFIGURATION ====================
// Fee rates are currency-based (not per-shop)
// All USD shops use same fees, all VND shops use same fees

const FEE_CONFIG = {
  USD: {
    tx_fee_rate: 0.065,           // 6.5% of (Buyer Paid - Tax)
    processing_rate: 0.03,        // 3.0% of Buyer Paid
    processing_fixed: 0.25,        // $0.25 per order
    regulatory_rate: 0.0124,       // 1.24% of (Buyer Paid - Tax)
    listing_fee_fixed: 0.20,       // $0.20 per order
    offsite_ads_rate: 0.14,        // 14% of Buyer Paid (if Has Ads Attribution = TRUE, per order)
    vat_rate: 0.10                 // 10% VAT on fees
  },
  VND: {
    tx_fee_rate: 0.065,           // 6.5% of (Buyer Paid - Tax)
    processing_rate: 0.045,       // 4.5% of Buyer Paid
    processing_fixed: 115,         // ₫115 per order
    regulatory_rate: 0.0124,       // 1.24% of (Buyer Paid - Tax)
    listing_fee_fixed: 5256,       // ₫5,256 per order
    offsite_ads_rate: 0.14,        // 14% of Buyer Paid (if Has Ads Attribution = TRUE, per order)
    vat_rate: 0.10                 // 10% VAT on fees
  }
};

/**
 * Get fee configuration by currency
 * @param {string} currency - Currency code (USD/VND/USDT)
 * @return {Object} Fee config object
 */
function getFeeConfigByCurrency(currency) {
  const c = String(currency || "USD").toUpperCase();
  // USDT uses same fees as USD
  if (c === "USDT") return FEE_CONFIG.USD;
  return FEE_CONFIG[c] || FEE_CONFIG.USD; // Default to USD if unknown currency
}

// Dashboard Monthly Header (giữ nguyên currency gốc, frontend sẽ convert)
const DASHBOARD_MONTHLY_HEADER = [
  "Shop Name",
  "Month (YYYY-MM)",
  "Currency",
  "Total Customer Paid",
  "Total Net Profit",
  "Offsite Ads",
  "Offsite Ads Is Estimated",
  "Profit After Ads",
  "Order Count",
  "Last Updated"
];

// Ads Summary Input Header (for manual override - theo currency gốc)
const ADS_SUMMARY_INPUT_HEADER = [
  "Shop Name",
  "Month (YYYY-MM)",
  "Currency",
  "Offsite Ads Value",
  "Notes"
];
const DASHBOARD_HEADER = [
  "Order ID (base)",
  "Order Date",
  "Expected Ship Date",
  "Actual Ship Date",
  "Shop Name",
  "Currency",
  "Order Count",
  "Quantity",
  "Listing ID",
  "SKU",
  "Country",
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
  "Unique Key (Ẩn)"
];

// ==================== DISPLAY SETTINGS ====================
const SHOW_SHIPPING_EVERY_ROW = true; // If true, show shipping info on all rows

// ==================== ORDER GROUP COLORS ====================
const ORDER_COLOR_1 = "#ffcdd2"; // Pastel red
const ORDER_COLOR_2 = "#bbdefb"; // Pastel blue

// ==================== EU COUNTRIES (27 countries as of 2024) ====================
// LƯU Ý QUAN TRỌNG: 
// - AT = Austria (Austria) → EU country → có IOSS code
// - AU = Australia (Australia) → KHÔNG phải EU → KHÔNG có IOSS code
// Hai mã này dễ nhầm lẫn, cần check kỹ!
const EU_COUNTRIES = new Set([
  "AT", // Austria (EU) - có IOSS
  "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE"
  // AU (Australia) KHÔNG có trong list này vì không phải EU
]);

// ==================== HEADER DEFINITIONS ====================
const HEADER_KEYFOB = [
  "Note",
  "Product Info",
  "Custom Key Photo",
  "Logo",
  "Order ID",
  "Shop Name",
  "Listing ID",
  "Shipping Info",
  "Unique Key (Ẩn)"
];

const HEADER_STRAP = [
  "Note",
  "Product Info",
  "Product Image",
  "Order ID",
  "Shop Name",
  "Listing ID",
  "Shipping Info",
  "Unique Key (Ẩn)"
];

const HEADER_TRACKING = ["SKU", "Shipping Info"];

// ==================== YUNEXPRESS HEADER ====================
// Header đầy đủ cho YUNEXPRESS template (74 cột) — khớp template Yun mới
// Xóa: ManufactureSalesName, UnifiedSocialCreditCode, Collection and payment...
// Thêm: PackageLength, PackageWidth, PackageHeight
function getYunHeader_() {
  return [
    "CustomerOrderNo.",       // 1
    "RoutingCode",            // 2
    "Trackingnumber",         // 3
    "AdditionalServices",     // 4
    "ShipmentProtectionPlusService", // 5
    "CustomDeclaredValue",    // 6
    "SignatureService",       // 7
    "VatNumber",              // 8
    "EoriNumber",             // 9
    "IossCode",               // 10
    "CountryCode",            // 11 — was 14
    "Name",                   // 12 — was 15
    "CertificateCode",        // 13
    "Company",                // 14
    "Street",                 // 15 — was 18
    "City",                   // 16 — was 19
    "Province/State",         // 17 — was 20
    "ZipCode",                // 18 — was 21
    "phone",                  // 19 — was 22
    "HouseNumber",            // 20
    "Email",                  // 21 — was 24
    "ShortAddress",           // 22
    "PackageNumber",          // 23 — was 26
    "PackageWeight",          // 24 — was 27
    "PackageLength",          // 25 — MỚI
    "PackageWidth",           // 26 — MỚI
    "PackageHeight",          // 27 — MỚI
    "SenderFiastName",        // 28
    "SenderCompany",          // 29
    "SenderStreet",           // 30
    "SenderCity",             // 31
    "SenderProvince",         // 32
    "SenderPostalCode",       // 33
    "SenderCountry",          // 34
    "SenderTelephone",        // 35
    "SenderEmail",            // 36
    "SenderUSCI",             // 37
    "PlatformName",           // 38
    "PlatformProvince",       // 39
    "PlatformAddress",        // 40
    "PlatformPostalCode",     // 41
    "PlatformPhoneNumber",    // 42
    "PlatformEmail",          // 43
    "EcommercePlatformCode",  // 44
    "SalesPlatformLink",      // 45
    "CurrencyCode",           // 46
    "SKU1",                   // 47
    "ItemDescription1",       // 48
    "ForeignItemDescription1", // 49
    "DeclaredQuantity1",      // 50
    "FOBPrice1",              // 51
    "SellingPrice1",          // 52
    "UnitWeight1",            // 53
    "HsCode1",                // 54
    "Remarks1",               // 55
    "SalesLink1",             // 56
    "Materials1",             // 57
    "Use1",                   // 58
    "Brand1",                 // 59
    "ModelType1",             // 60
    "Specs1",                 // 61
    "FabricCreationMethod1",  // 62
    "ManufacturerID1",        // 63
    "ManufacturerName1",      // 64
    "ManufacturerCountry1",   // 65
    "ManufacturerState1",     // 66
    "ManufacturerCity1",      // 67
    "ManufacturerPostalCode1", // 68
    "ManufacturerAddress1",   // 69
    "CargoCategory",          // 70
    "PaymentPlatform",        // 71
    "PaymentAccount",         // 72
    "PaymentTransactionNumber", // 73
    "LabelLink"                 // 74 — template Yun mới (GSheet cũ thiếu cột này)
  ];
}

/** Số cột template Yun — luôn = getYunHeader_().length */
function getYunTotalCols_() {
  return getYunHeader_().length;
}

// ==================== MULTI-SHOP IMAGE CONFIG ====================
// Có 2 loại cấu trúc:
// 1. TYPE_LINKS: lookup theo listing_id + type (cột A, C, H)
// 2. CODE_TYPE: lookup theo CODE + TYPE → IMAGE_LINK (cột C, D, F)

const LOOKUP_MODE = {
  TYPE_LINKS: "type_links",  // xilacrafts - dùng listing_id + type
  CODE_TYPE: "code_type"     // các shop khác - dùng CODE + TYPE
};

const SHOP_IMAGE_CONFIG = {
  // Shop 1: xilacrafts - Cập nhật sang CODE_TYPE chuẩn
  "xilacrafts": {
    mode: LOOKUP_MODE.CODE_TYPE,
    ssid: "1R3aJ1AyM5qFNcVEuqmHhkC0FYGXR6skEnrUVykFsvpc",
    sheet: "xilacrafts", // Tên sheet trong file DB chuẩn
  },
  
  // Shop 2: VietToanHandmade - dùng CODE_TYPE
  "viettoanhandmade": {
    mode: LOOKUP_MODE.CODE_TYPE,
    ssid: "1R3aJ1AyM5qFNcVEuqmHhkC0FYGXR6skEnrUVykFsvpc",
    sheet: "VietToanHandmade",  // Sheet name trong file
    // Columns for CODE_TYPE mode:
    // C = CODE, D = TYPE, F = IMAGE_LINK
  },
  
  // Shop 3: LAXILuxuryCrafts - dùng CODE_TYPE (LAXI + 4 số)
  "laxiluxurycrafts": {
    mode: LOOKUP_MODE.CODE_TYPE,
    ssid: "1R3aJ1AyM5qFNcVEuqmHhkC0FYGXR6skEnrUVykFsvpc",
    sheet: "LAXILuxuryCrafts",
  },
  
  // Shop 4: QuangDuocStore - dùng CODE_TYPE
  "quangduocstore": {
    mode: LOOKUP_MODE.CODE_TYPE,
    ssid: "1R3aJ1AyM5qFNcVEuqmHhkC0FYGXR6skEnrUVykFsvpc",
    sheet: "QuangDuocStore",  // TODO: Đổi sheet name nếu khác
  },
  
  // Shop 5: LongNamLeather - dùng CODE_TYPE (LNL + 4 số)
  "longnamleather": {
    mode: LOOKUP_MODE.CODE_TYPE,
    ssid: "1R3aJ1AyM5qFNcVEuqmHhkC0FYGXR6skEnrUVykFsvpc",
    sheet: "LongNamLeather",
  },
  
  // Shop 6: KHHANDCRAFTS - dùng CODE_TYPE (KHN + 4 số)
  "khhandcrafts": {
    mode: LOOKUP_MODE.CODE_TYPE,
    ssid: "1R3aJ1AyM5qFNcVEuqmHhkC0FYGXR6skEnrUVykFsvpc",
    sheet: "KHHANDCRAFTS",
  },
  
  // Shop 7: LeeCozzyCraft - dùng CODE_TYPE (LCZ + 4 số)
  "leecozzycraft": {
    mode: LOOKUP_MODE.CODE_TYPE,
    ssid: "1R3aJ1AyM5qFNcVEuqmHhkC0FYGXR6skEnrUVykFsvpc",
    sheet: "LeeCozzyCraft",
  }
};

// Default config nếu shop không có trong danh sách
const DEFAULT_IMAGE_CONFIG = {
  mode: LOOKUP_MODE.CODE_TYPE,
  ssid: "1R3aJ1AyM5qFNcVEuqmHhkC0FYGXR6skEnrUVykFsvpc",
  sheet: "VietToanHandmade"
};

/**
 * Get image config for a shop
 * @param {string} shopName - Shop name from order
 * @return {object} { mode, ssid, sheet }
 */
function getShopImageConfig_(shopName) {
  if (!shopName) return DEFAULT_IMAGE_CONFIG;
  
  const name = String(shopName).trim();
  const lower = name.toLowerCase();
  
  // 1. Kiểm tra trong danh sách cấu hình cứng (ưu tiên khớp chuẩn)
  if (SHOP_IMAGE_CONFIG[lower]) {
    return SHOP_IMAGE_CONFIG[lower];
  }
  
  // 2. Nếu không có cấu hình riêng, trả về cấu hình mặc định nhưng dùng chính xác tên Shop làm tên Sheet
  // (Theo yêu cầu: tên shop và sheet database sẽ trùng nhau)
  return {
    mode: LOOKUP_MODE.CODE_TYPE,
    ssid: DEFAULT_IMAGE_CONFIG.ssid,
    sheet: name // Dùng chính xác tên shop (có thể có hoa thường/dấu cách)
  };
}

// Legacy function for backward compatibility
function getShopTypeLinksConfig_(shopName) {
  const config = getShopImageConfig_(shopName);
  return {
    ssid: config.ssid,
    sheet: config.sheet
  };
}


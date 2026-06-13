/*
 * =============================================================
 * == FILE: 8_ModelMap.gs
 * == PHIÊN BẢN: 2.0 (2026-01-06) - SKU-ONLY + RULE ENGINE
 * == 
 * == TRIẾT LÝ BẮT BUỘC:
 * ==   - SKU = nguồn sự thật DUY NHẤT cho BRAND/MODEL/PACKAGE
 * ==   - TUYỆT ĐỐI KHÔNG detect xe từ PERSONALIZATION
 * ==   - AI CHỈ xử lý personalization, KHÔNG đoán xe
 * ==
 * == CHỨC NĂNG:
 * ==   1. Pre-detect hãng xe + model từ SKU
 * ==   2. Rule Engine: xử lý màu dập, key mapping, logo regex
 * ==   3. Post-process AI output
 * =============================================================
 */

// ==================== BRAND PATTERNS ====================
// Mỗi brand có array các pattern (regex) để nhận diện

const BRAND_PATTERNS = {
  // 🇯🇵 Nhật Bản
  "Toyota": ["toyota", "camry", "corolla", "rav4", "rav 4", "tacoma", "tundra", "4runner", "highlander", "prius", "yaris", "venza", "sienna", "sequoia", "land cruiser", "fortuner", "hilux", "innova", "c-hr", "chr"],
  "Honda": ["honda", "civic", "accord", "cr-v", "crv", "hr-v", "hrv", "pilot", "odyssey", "ridgeline", "passport", "fit", "jazz", "city", "br-v", "brv"],
  "Nissan": ["nissan", "altima", "sentra", "maxima", "rogue", "pathfinder", "murano", "frontier", "titan", "kicks", "versa", "armada", "patrol", "navara", "x-trail", "xtrail", "gt-r", "gtr", "leaf", "ariya"],
  "Mazda": ["mazda", "mazda3", "mazda 3", "mazda6", "mazda 6", "cx-3", "cx3", "cx-5", "cx5", "cx-30", "cx30", "cx-9", "cx9", "cx-90", "mx-5", "mx5", "miata"],
  "Subaru": ["subaru", "outback", "forester", "crosstrek", "wrx", "sti", "impreza", "legacy", "ascent", "brz", "wilderness"],
  "Mitsubishi": ["mitsubishi", "outlander", "eclipse cross", "pajero", "montero", "triton", "xpander", "l200", "mirage", "attrage"],
  "Suzuki": ["suzuki", "swift", "jimny", "vitara", "grand vitara", "ertiga", "xl7", "baleno", "ignis", "celerio", "dzire"],
  "Lexus": ["lexus", "es", "is", "ls", "gs", "nx", "rx", "gx", "lx", "ux", "lc", "rc"],
  "Infiniti": ["infiniti", "q50", "q60", "qx50", "qx55", "qx60", "qx80"],
  "Acura": ["acura", "tlx", "ilx", "mdx", "rdx", "integra", "nsx"],

  // 🇺🇸 Mỹ
  "Ford": ["ford", "f-150", "f150", "f 150", "f-250", "f250", "f-350", "f350", "ranger", "bronco", "explorer", "expedition", "mustang", "escape", "edge", "maverick", "super duty", "lightning", "mach-e", "mach e"],
  "Chevrolet": ["chevrolet", "chevy", "silverado", "colorado", "tahoe", "suburban", "traverse", "equinox", "blazer", "trailblazer", "camaro", "corvette", "bolt", "malibu", "impala"],
  "GMC": ["gmc", "sierra", "canyon", "yukon", "acadia", "terrain", "hummer"],
  "RAM": ["ram", "ram 1500", "ram 2500", "ram 3500", "ram1500", "ram2500", "ram3500", "1500", "2500", "3500"],
  "Dodge": ["dodge", "charger", "challenger", "durango", "hornet", "hellcat", "scat pack", "srt"],
  "Jeep": ["jeep", "wrangler", "grand cherokee", "cherokee", "compass", "renegade", "gladiator", "wagoneer", "grand wagoneer"],
  "Cadillac": ["cadillac", "escalade", "ct4", "ct5", "xt4", "xt5", "xt6", "lyriq", "blackwing"],
  "Lincoln": ["lincoln", "navigator", "aviator", "nautilus", "corsair", "continental"],
  "Buick": ["buick", "enclave", "envision", "encore"],
  "Tesla": ["tesla", "model 3", "model y", "model s", "model x", "cybertruck", "model3", "modely", "models", "modelx"],
  "Chrysler": ["chrysler", "pacifica", "300"],

  // 🇩🇪 Đức
  "BMW": ["bmw", "x1", "x3", "x5", "x7", "m3", "m4", "m5", "330i", "530i", "740i", "z4", "i4", "ix"],
  "Mercedes": ["mercedes", "benz", "c-class", "e-class", "s-class", "glc", "gle", "gls", "g-class", "g63", "amg", "a-class", "cla", "gla", "eqe", "eqs"],
  "Audi": ["audi", "a3", "a4", "a5", "a6", "a7", "a8", "q3", "q5", "q7", "q8", "e-tron", "etron", "rs", "s4", "s5", "s6", "sq5", "sq7", "sq8"],
  "Volkswagen": ["volkswagen", "vw", "golf", "jetta", "passat", "tiguan", "atlas", "taos", "arteon", "id.4", "id4", "gti", "gli"],
  "Porsche": ["porsche", "911", "cayenne", "macan", "panamera", "taycan", "718", "cayman", "boxster", "carrera", "turbo s", "gt3"],

  // 🇰🇷 Hàn Quốc
  "Hyundai": ["hyundai", "elantra", "sonata", "tucson", "santa fe", "santafe", "palisade", "kona", "venue", "ioniq", "ioniq 5", "ioniq 6", "accent", "creta", "staria"],
  "Kia": ["kia", "k5", "optima", "sportage", "sorento", "telluride", "carnival", "seltos", "forte", "rio", "soul", "ev6", "ev9", "stinger", "niro"],
  "Genesis": ["genesis", "g70", "g80", "g90", "gv60", "gv70", "gv80"],

  // 🇬🇧 Anh
  "Land Rover": ["land rover", "landrover", "range rover", "rangerover", "defender", "discovery", "velar", "evoque", "sport"],
  "Jaguar": ["jaguar", "f-pace", "fpace", "e-pace", "epace", "i-pace", "ipace", "xe", "xf", "xj", "f-type", "ftype"],
  "Rolls-Royce": ["rolls", "royce", "rolls-royce", "phantom", "ghost", "wraith", "dawn", "cullinan", "spectre"],
  "Bentley": ["bentley", "continental", "flying spur", "bentayga", "mulsanne"],
  "Aston Martin": ["aston", "martin", "aston martin", "db11", "db12", "vantage", "dbs", "dbx"],
  "McLaren": ["mclaren", "720s", "750s", "artura", "p1", "senna", "gt"],
  "Mini": ["mini", "cooper", "countryman", "clubman", "jcw", "john cooper"],

  // 🇮🇹 Ý
  "Ferrari": ["ferrari", "488", "f8", "roma", "portofino", "sf90", "296", "purosangue", "laferrari"],
  "Lamborghini": ["lamborghini", "lambo", "huracan", "aventador", "urus", "revuelto", "gallardo"],
  "Maserati": ["maserati", "ghibli", "quattroporte", "levante", "grecale", "mc20", "granturismo"],
  "Alfa Romeo": ["alfa", "romeo", "alfa romeo", "giulia", "stelvio", "tonale", "quadrifoglio"],
  "Fiat": ["fiat", "500", "panda", "tipo", "ducato"],

  // 🇫🇷 Pháp
  "Peugeot": ["peugeot", "208", "308", "408", "508", "2008", "3008", "5008"],
  "Renault": ["renault", "clio", "megane", "captur", "kadjar", "koleos", "arkana", "duster"],
  "Citroën": ["citroen", "citroën", "c3", "c4", "c5", "berlingo"],

  // 🇨🇳 Trung Quốc
  "BYD": ["byd", "dolphin", "seal", "han", "tang", "song", "atto"],
  "NIO": ["nio", "es6", "es7", "es8", "et5", "et7"],
  "XPeng": ["xpeng", "p7", "g9", "g6"],
  "Geely": ["geely", "coolray", "emgrand", "tugella"],

  // 🇸🇪 Thụy Điển
  "Volvo": ["volvo", "xc40", "xc60", "xc90", "s60", "s90", "v60", "v90", "ex30", "ex90", "recharge"],

  // Khác
  "Škoda": ["skoda", "škoda", "octavia", "superb", "kodiaq", "karoq", "kamiq", "fabia", "scala", "enyaq"]
};

// ==================== PACKAGE/TRIM PATTERNS ====================

const PACKAGE_PATTERNS = {
  // Ford
  "XL": ["\\bxl\\b"],
  "XLT": ["\\bxlt\\b"],
  "Lariat": ["lariat"],
  "King Ranch": ["king ranch", "kingranch"],
  "Platinum": ["platinum"],
  "Limited": ["limited"],
  "Tremor": ["tremor"],
  "Raptor": ["raptor"],
  "Raptor R": ["raptor r", "raptor-r"],

  // GM (Chevy/GMC)
  "WT": ["\\bwt\\b", "work truck"],
  "LT": ["\\blt\\b"],
  "LTZ": ["\\bltz\\b"],
  "RST": ["\\brst\\b"],
  "Z71": ["z71", "z-71"],
  "ZR2": ["zr2", "zr-2"],
  "Trail Boss": ["trail boss", "trailboss"],
  "High Country": ["high country", "highcountry"],
  "AT4": ["at4", "at-4", "at 4"],
  "AT4X": ["at4x", "at-4x"],
  "Denali": ["denali", "denalli"],
  "Denali Ultimate": ["denali ultimate"],
  "SLE": ["\\bsle\\b"],
  "SLT": ["\\bslt\\b"],
  "Elevation": ["elevation"],

  // Toyota
  "LE": ["\\ble\\b"],
  "SE": ["\\bse\\b"],
  "XLE": ["\\bxle\\b"],
  "XSE": ["\\bxse\\b"],
  "TRD": ["trd", "trd pro", "trd off-road", "trd sport"],
  "TRD Pro": ["trd pro"],
  "Adventure": ["adventure"],
  "Nightshade": ["nightshade"],

  // Jeep
  "Sport": ["\\bsport\\b"],
  "Sport S": ["sport s"],
  "Willys": ["willys"],
  "Sahara": ["sahara"],
  "Rubicon": ["rubicon", "rubikon"],
  "Rubicon X": ["rubicon x"],
  "Mojave": ["mojave"],
  "Overland": ["overland"],
  "Summit": ["summit"],
  "Summit Reserve": ["summit reserve"],
  "Trailhawk": ["trailhawk"],
  "4xe": ["4xe"],

  // Dodge/RAM
  "SXT": ["\\bsxt\\b"],
  "GT": ["\\bgt\\b"],
  "R/T": ["r/t", "r\\/t", "rt\\b"],
  "Scat Pack": ["scat pack", "scatpack", "scat"],
  "Hellcat": ["hellcat", "hell cat"],
  "Hellcat Redeye": ["redeye", "red eye"],
  "SRT": ["\\bsrt\\b"],
  "Rebel": ["rebel"],
  "Laramie": ["laramie"],
  "Longhorn": ["longhorn", "long horn"],
  "Big Horn": ["big horn", "bighorn"],
  "Tradesman": ["tradesman"],

  // Subaru
  "Wilderness": ["wilderness"],
  "Onyx": ["onyx"],
  "Touring": ["touring"],
  "Premium": ["premium"],

  // German
  "S-Line": ["s-line", "sline", "s line"],
  "M Sport": ["m sport", "msport", "m-sport"],
  "AMG": ["amg"],
  "Black Series": ["black series"],
  "GTI": ["gti"],
  "GLI": ["gli"],
  "R-Line": ["r-line", "rline", "r line"],
  "Autobahn": ["autobahn"],

  // Hyundai/Kia
  "SEL": ["\\bsel\\b"],
  "N Line": ["n line", "n-line", "nline"],
  "N": ["\\bn\\b"],
  "Calligraphy": ["calligraphy"],
  "XRT": ["\\bxrt\\b"],
  "X-Line": ["x-line", "xline", "x line"],
  "GT-Line": ["gt-line", "gtline", "gt line"],

  // Lexus
  "F Sport": ["f sport", "fsport", "f-sport"]
};

// ==================== MAIN FUNCTIONS ====================

/**
 * Detect brand từ text (SKU + Personalization)
 * @param {string} text - Text cần phân tích
 * @returns {string|null} - Tên brand hoặc null
 */
function detectBrand(text) {
  if (!text) return null;
  const lowerText = text.toLowerCase();
  
  for (const [brand, patterns] of Object.entries(BRAND_PATTERNS)) {
    for (const pattern of patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i');
      if (regex.test(lowerText)) {
        return brand;
      }
    }
  }
  return null;
}

/**
 * Detect tất cả packages/trims từ text
 * @param {string} text - Text cần phân tích
 * @returns {string[]} - Array các package tìm thấy
 */
function detectPackages(text) {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  const found = [];
  
  for (const [pkg, patterns] of Object.entries(PACKAGE_PATTERNS)) {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lowerText)) {
        if (!found.includes(pkg)) {
          found.push(pkg);
        }
        break;
      }
    }
  }
  return found;
}

/**
 * Detect model name từ text dựa trên brand
 * @param {string} text - Text cần phân tích
 * @param {string} brand - Brand đã detect
 * @returns {string|null} - Model name hoặc null
 */
function detectModel(text, brand) {
  if (!text || !brand) return null;
  
  const patterns = BRAND_PATTERNS[brand];
  if (!patterns) return null;
  
  const lowerText = text.toLowerCase();
  
  // Tìm model cụ thể (bỏ qua brand name chung)
  for (const pattern of patterns) {
    if (pattern.toLowerCase() === brand.toLowerCase()) continue;
    
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    const match = lowerText.match(regex);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * MAIN: Pre-process SKU để detect xe
 * ⚠️ TRIẾT LÝ: SKU = nguồn sự thật DUY NHẤT cho BRAND/MODEL/PACKAGE
 * ⚠️ TUYỆT ĐỐI KHÔNG detect từ personalization
 * 
 * @param {string} sku - SKU của sản phẩm (nguồn sự thật duy nhất)
 * @returns {Object} - {brand, model, packages, displayText}
 */
function preDetectVehicle(sku) {
  // Nếu không có SKU → không có thông tin xe
  if (!sku || !sku.trim()) {
    return { 
      brand: null, 
      model: null, 
      packages: [], 
      displayText: null 
    };
  }
  
  const text = sku.toUpperCase();
  
  const brand = detectBrand(text);
  const model = detectModel(text, brand);
  const packages = detectPackages(text);
  
  let displayText = '';
  if (brand) {
    displayText = brand;
    if (model && model.toLowerCase() !== brand.toLowerCase()) {
      displayText += ` ${model}`;
    }
    if (packages.length > 0) {
      displayText += ` ${packages.join(' ')}`;
    }
  }
  
  return {
    brand: brand,
    model: model,
    packages: packages,
    displayText: displayText.trim() || null
  };
}

/**
 * Test function - kiểm tra detection từ SKU
 */
function testDetection() {
  const testSKUs = [
    "FORD-F150-LARIAT-001",
    "GMC-SIERRA-AT4X-002",
    "JEEP-WRANGLER-RUBICON-003",
    "TOYOTA-TACOMA-TRD-PRO-004",
    "RAM-1500-REBEL-005",
    "CHEVY-SILVERADO-HIGH-COUNTRY-006",
    "FORD-BRONCO-RAPTOR-007",
    "TESLA-MODEL-Y-008",
    "BMW-X5-M-SPORT-009",
    "MERCEDES-GLE-63-AMG-010"
  ];
  
  Logger.log("=== TEST DETECTION (SKU-ONLY) ===");
  for (const sku of testSKUs) {
    const result = preDetectVehicle(sku);
    Logger.log(`SKU: "${sku}" → Brand: ${result.brand}, Model: ${result.model}, Packages: ${result.packages.join(', ')}`);
  }
}

// ==================== RULE ENGINE ====================
// Các rule được xử lý bằng CODE, KHÔNG để AI làm

/**
 * Màu dập hợp lệ (KHÓA CỨNG)
 * AI không được tự đoán màu ngoài danh sách này
 */
const VALID_STAMP_COLORS = ['gold', 'silver', 'red', 'blue', 'green'];

/**
 * Quy ước Key/Keychain mapping
 */
const KEY_MAPPING = {
  '1': 'Móc bạc',
  '2': 'Móc đen',
  '3': 'Vòng bạc',
  '4': 'Vòng đen',
  '5': 'Key 5',
  '6': 'Key 6',
  '7': 'Key 7',
  '8': 'Key 8',
  '9': 'Key 9',
  '10': 'Key 10'
};

/**
 * Regex patterns cho logo detection
 */
const LOGO_PATTERNS = {
  // Logo code (số hoặc chữ+số ngắn)
  CODE: /^[A-Z0-9]{1,10}$/i,
  // Không có logo
  NONE: /\b(none|no\s*logo|skip|blank)\b/i,
  // Logo keyword
  KEYWORD: /\b(logo|stamp|stamping|emboss|deboss|heat\s*stamp)\b/i
};

/**
 * Kiểm tra màu có phải màu dập hợp lệ không
 * @param {string} color - Màu cần kiểm tra
 * @returns {boolean}
 */
function isValidStampColor(color) {
  if (!color) return false;
  return VALID_STAMP_COLORS.includes(color.toLowerCase().trim());
}

/**
 * Chuẩn hóa màu dập (viết hoa chữ cái đầu)
 * @param {string} color - Màu cần chuẩn hóa
 * @returns {string|null} - Màu đã chuẩn hóa hoặc null nếu không hợp lệ
 */
function normalizeStampColor(color) {
  if (!isValidStampColor(color)) return null;
  const lower = color.toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Chuyển Key number sang tên tiếng Việt
 * @param {string|number} keyNum - Số key (1-10)
 * @returns {string} - Tên móc tiếng Việt
 */
function mapKeyToVietnamese(keyNum) {
  const num = String(keyNum).trim();
  return KEY_MAPPING[num] || `Key ${num}`;
}

/**
 * Detect key/keychain từ text
 * @param {string} text - Text cần phân tích
 * @returns {string|null} - Tên móc tiếng Việt hoặc null
 */
function detectKeychain(text) {
  if (!text) return null;
  
  // Pattern: key 1, keychain 2, key1, keychain2, key-3...
  const match = text.match(/\b(?:key|keychain)\s*[-]?\s*(\d{1,2})\b/i);
  if (match) {
    return mapKeyToVietnamese(match[1]);
  }
  
  // Nếu không ghi key → mặc định Móc bạc (nhưng ta không tự đoán ở đây)
  return null;
}

/**
 * Detect logo từ text
 * @param {string} text - Text cần phân tích
 * @returns {Object} - {type: 'code'|'none'|'custom'|null, value: string|null}
 */
function detectLogo(text) {
  if (!text) return { type: null, value: null };
  
  // Kiểm tra "no logo" / "none" / "skip"
  if (LOGO_PATTERNS.NONE.test(text)) {
    return { type: 'none', value: null };
  }
  
  // Tìm logo keyword + value
  const logoMatch = text.match(/logo\s*[:=]?\s*([A-Z0-9]{1,10}|\d+)/i);
  if (logoMatch) {
    return { type: 'code', value: logoMatch[1].toUpperCase() };
  }
  
  // Tìm số đơn lẻ (có thể là logo code)
  const singleNumMatch = text.match(/^(\d{1,3})$/);
  if (singleNumMatch) {
    return { type: 'code', value: singleNumMatch[1] };
  }
  
  // Tìm mã ngắn đơn lẻ
  const codeMatch = text.match(/^([A-Z]{1,3}\d{1,3})$/i);
  if (codeMatch) {
    return { type: 'code', value: codeMatch[1].toUpperCase() };
  }
  
  return { type: null, value: null };
}

/**
 * Detect màu dập từ text
 * @param {string} text - Text cần phân tích
 * @returns {string|null} - Màu dập hợp lệ hoặc null
 */
function detectStampColor(text) {
  if (!text) return null;
  
  const lowerText = text.toLowerCase();
  
  // Tìm pattern: color gold, in gold, màu gold, text gold...
  for (const color of VALID_STAMP_COLORS) {
    const patterns = [
      new RegExp(`\\b${color}\\b`, 'i'),
      new RegExp(`color\\s*[:=]?\\s*${color}`, 'i'),
      new RegExp(`text\\s*[:=]?\\s*${color}`, 'i'),
      new RegExp(`in\\s+${color}`, 'i')
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(lowerText)) {
        return normalizeStampColor(color);
      }
    }
  }
  
  return null;
}

/**
 * POST-PROCESS: Xử lý output từ AI
 * Áp dụng rules để chuẩn hóa kết quả
 * @param {string} aiOutput - Output từ Gemini AI
 * @returns {string} - Output đã được chuẩn hóa
 */
function postProcessAIOutput(aiOutput) {
  if (!aiOutput) return aiOutput;
  
  let result = aiOutput;
  
  // Chuẩn hóa màu dập (chỉ giữ màu hợp lệ)
  result = result.replace(/[-–]\s*(gold|silver|red|blue|green)\b/gi, (match, color) => {
    const normalized = normalizeStampColor(color);
    return normalized ? ` - ${normalized}` : '';
  });
  
  // Chuẩn hóa keychain
  result = result.replace(/\b(?:key|keychain)\s*[-]?\s*(\d{1,2})\b/gi, (match, num) => {
    return mapKeyToVietnamese(num);
  });
  
  // Xóa các dòng trống liên tiếp
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}

/**
 * Test Rule Engine
 */
function testRuleEngine() {
  Logger.log("=== TEST RULE ENGINE ===");
  
  // Test màu dập
  const colors = ['gold', 'Gold', 'GOLD', 'pink', 'black', 'Silver'];
  Logger.log("Màu dập hợp lệ:");
  for (const c of colors) {
    Logger.log(`  "${c}" → ${isValidStampColor(c) ? normalizeStampColor(c) : 'KHÔNG HỢP LỆ'}`);
  }
  
  // Test keychain mapping
  Logger.log("\nKey mapping:");
  for (let i = 1; i <= 10; i++) {
    Logger.log(`  Key ${i} → ${mapKeyToVietnamese(i)}`);
  }
  
  // Test detect keychain
  const keychainTexts = ["key 1", "keychain 2", "KEY-3", "keychain4", "key 10"];
  Logger.log("\nDetect keychain:");
  for (const t of keychainTexts) {
    Logger.log(`  "${t}" → ${detectKeychain(t)}`);
  }
  
  // Test detect logo
  const logoTexts = ["Logo: 42", "none", "no logo", "51", "HD41", "Logo G42"];
  Logger.log("\nDetect logo:");
  for (const t of logoTexts) {
    const result = detectLogo(t);
    Logger.log(`  "${t}" → type: ${result.type}, value: ${result.value}`);
  }
}

/**
 * DEBUG - Test KeyType Image Lookup
 * Chạy function này trong Apps Script để debug
 */
function debugKeyTypeLookup() {
  const testCases = [
    { sku: "CHEVY DVT2286 T03", keyType: "A17", shopName: "VietToanHandmade" },
    { sku: "TOYOTA PICKUP TRUCK DVT1232", keyType: "A06", shopName: "VietToanHandmade" },
    { sku: "FORD FULL MODEL DVT1875", keyType: "A16", shopName: "VietToanHandmade" },
    { sku: "TOYOTA SUV SEQUOIA DVT1635", keyType: "A02", shopName: "VietToanHandmade" }
  ];
  
  Logger.log("========== DEBUG KEYTYPE LOOKUP ==========");
  
  testCases.forEach((test, i) => {
    Logger.log(`\n--- TEST ${i + 1}: ${test.sku} ---`);
    
    // 1. Extract CODE from SKU
    const code = extractCodeFromSku_(test.sku);
    Logger.log(`1. Extract CODE: "${test.sku}" → "${code}"`);
    
    if (!code) {
      Logger.log("   ❌ FAILED: Không extract được CODE!");
      return;
    }
    
    // 2. Load image data
    const imageData = getImageMapByShopFresh_(test.shopName);
    Logger.log(`2. Load database: mode=${imageData.mode}, map.size=${imageData.map.size}`);
    
    if (imageData.map.size === 0) {
      Logger.log("   ❌ FAILED: Database trống!");
      return;
    }
    
    // 3. Build lookup key (single pipe)
    const lookupKey = `${code}|${test.keyType.toUpperCase()}`;
    Logger.log(`3. Lookup key: "${lookupKey}"`);
    
    // 4. Lookup
    const imageUrl = imageData.map.get(lookupKey);
    if (imageUrl) {
      Logger.log(`4. ✅ FOUND: ${imageUrl.substring(0, 80)}...`);
    } else {
      Logger.log(`4. ❌ NOT FOUND`);
      
      // Debug: List similar keys
      Logger.log("   Searching similar keys...");
      let foundSimilar = 0;
      imageData.map.forEach((url, key) => {
        if (key.startsWith(code + "|") && foundSimilar < 5) {
          Logger.log(`   Similar: ${key}`);
          foundSimilar++;
        }
      });
    }
  });
  
  Logger.log("\n========== END DEBUG ==========");
}

/**
 * DEBUG - Test Logo Image Lookup
 */
function debugLogoLookup() {
  const testCases = [
    { boardCode: "T03", logoNumber: "T16", shopName: "VietToanHandmade" },
    { boardCode: "T14", logoNumber: "T10", shopName: "VietToanHandmade" },
    { boardCode: "T95", logoNumber: "T1", shopName: "VietToanHandmade" }
  ];
  
  Logger.log("========== DEBUG LOGO LOOKUP ==========");
  
  testCases.forEach((test, i) => {
    Logger.log(`\n--- TEST ${i + 1}: ${test.boardCode}|${test.logoNumber} ---`);
    
    // Load logo map
    const logoMap = buildLogoMapForShop_(test.shopName);
    Logger.log(`1. Logo map size: ${logoMap.size}`);
    
    // Build lookup key
    const lookupKey = `${test.boardCode}|${test.logoNumber}`;
    Logger.log(`2. Lookup key: "${lookupKey}"`);
    
    // Lookup
    const imageUrl = logoMap.get(lookupKey);
    if (imageUrl) {
      Logger.log(`3. ✅ FOUND: ${imageUrl.substring(0, 80)}...`);
    } else {
      Logger.log(`3. ❌ NOT FOUND`);
      
      // List similar keys
      Logger.log("   Searching similar keys...");
      let foundSimilar = 0;
      logoMap.forEach((url, key) => {
        if (key.startsWith(test.boardCode + "|") && foundSimilar < 5) {
          Logger.log(`   Similar: ${key}`);
          foundSimilar++;
        }
      });
    }
  });
  
  Logger.log("\n========== END DEBUG ==========");
}

/**
 * DEBUG - List first 20 entries in database
 */
function debugListDatabase() {
  const shopName = "VietToanHandmade";
  const imageData = getImageMapByShopFresh_(shopName);
  
  Logger.log(`Database mode: ${imageData.mode}`);
  Logger.log(`Total entries: ${imageData.map.size}`);
  Logger.log("\nFirst 20 entries:");
  
  let count = 0;
  imageData.map.forEach((url, key) => {
    if (count < 20) {
      Logger.log(`  ${key} → ${url.substring(0, 50)}...`);
      count++;
    }
  });
}

/**
 * DEBUG - Test new parsing logic for Key Type, Cover Style, and Multi-line Personalization
 */
function debugNewParsingLogic() {
  const test1 = {
    sku: "KHOÉT HONDA SUV QDS2432 S00",
    variations: [
      "SKU: KHOÉT HONDA SUV QDS2432 S00",
      "Primary color: 4 - PATINA ORANGE",
      "Key Type: TYPE 12",
      "Keychain Style: Key 4 - Ring Black",
      "Cover Type: Exposed Buttons",
      "Upload Exact Smart Key Photo1 file"
    ].join("\n")
  };

  const test2 = {
    sku: "KHOÉT NISSAN SEDAN QDS7361 S65",
    variations: [
      "Primary color25 - TURQUOise",
      "Key Type:TYPE 9",
      "Logo code + Notes",
      "Logo: Q96",
      "logo color: 9, Patina blue",
      "name tag: Angela",
      "Keychain Style: Key 1 - Silver",
      "Cover Type: Covered Buttons",
      "Smart Tag Text: 5209544001",
      "Upload Exact Smart Key Photo5 files"
    ].join("\n")
  };

  Logger.log("========== TEST 1: HONDA SUV (COVER STYLE & KEY TYPE) ==========");
  const parsedType1 = parseKeyTypeFromVariations_(test1.variations);
  Logger.log("parseKeyTypeFromVariations_ output: " + parsedType1);

  const lines1 = [`SKU : ${test1.sku}`];
  const info1 = buildProductInfoNewFormat_(lines1, test1.variations);
  Logger.log("buildProductInfoNewFormat_ output:\n" + info1);

  Logger.log("\n========== TEST 2: NISSAN SEDAN (MULTI-LINE & NO COLON) ==========");
  const parsedType2 = parseKeyTypeFromVariations_(test2.variations);
  Logger.log("parseKeyTypeFromVariations_ output: " + parsedType2);

  const lines2 = [`SKU : ${test2.sku}`];
  const info2 = buildProductInfoNewFormat_(lines2, test2.variations);
  Logger.log("buildProductInfoNewFormat_ output:\n" + info2);
}


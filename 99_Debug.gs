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

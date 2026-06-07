/*
 * =============================================================
 * == FILE: 3_Normalize.gs
 * == M?C ��CH: Normalization functions (country, ZIP, URL, state)
 * =============================================================
 */

// ==================== COUNTRY CODE NORMALIZATION ====================

/**
 * Normalize country name to ISO 2-letter country code
 * @param {string} rawCountry - Country name or code
 * @return {string} 2-letter country code
 */
function normalizeCountryCode_(rawCountry) {
  let raw = safeString_(rawCountry);
  if (!raw) return "US";
  if (raw.length === 2) return raw.toUpperCase();

  const lc = raw.toLowerCase();
  const map = {
    // A
    "andorra": "AD", "united arab emirates": "AE", "uae": "AE", "afghanistan": "AF",
    "antigua & barbuda": "AG", "antigua and barbuda": "AG", "anguilla": "AI",
    "albania": "AL", "armenia": "AM", "angola": "AO", "antarctica": "AQ",
    "argentina": "AR", "american samoa": "AS", "austria": "AT", "australia": "AU",
    "aruba": "AW", "�land islands": "AX", "aland islands": "AX", "azerbaijan": "AZ",
    
    // B
    "bosnia & herzegovina": "BA", "bosnia and herzegovina": "BA", "barbados": "BB",
    "bangladesh": "BD", "belgium": "BE", "burkina": "BF", "burkina faso": "BF",
    "bulgaria": "BG", "bahrain": "BH", "burundi": "BI", "benin": "BJ",
    "saint barth�lemy": "BL", "saint barthelemy": "BL", "bermuda": "BM",
    "brunei": "BN", "bolivia": "BO", "caribbean netherlands": "BQ", "brazil": "BR",
    "the bahamas": "BS", "bahamas": "BS", "bhutan": "BT", "bouvet island": "BV",
    "botswana": "BW", "belarus": "BY", "belize": "BZ",
    
    // C
    "canada": "CA", "cocos (keeling) islands": "CC", "cocos islands": "CC",
    "central african republic": "CF", "republic of the congo": "CG", "congo": "CG",
    "switzerland": "CH", "cotedlvoire": "CI", "cote d'ivoire": "CI", "ivory coast": "CI",
    "cook islands": "CK", "chile": "CL", "cameroon": "CM", "china": "CN",
    "colombia": "CO", "costa rica": "CR", "cuba": "CU", "cape verde": "CV",
    "curacao": "CW", "christmas island": "CX", "cyprus": "CY",
    "czech republic": "CZ", "czechia": "CZ", "democratic republic of the congo": "CD",
    
    // D
    "germany": "DE", "deutschland": "DE", "djibouti": "DJ", "denmark": "DK",
    "dominica": "DM", "dominican republic": "DO", "algeria": "DZ",
    
    // E
    "ecuador": "EC", "estonia": "EE", "egypt": "EG", "western sahara": "EH",
    "eritrea": "ER", "spain": "ES", "espa�a": "ES", "ethiopia": "ET",
    
    // F
    "finland": "FI", "fiji": "FJ", "falkland islands": "FK",
    "federated states of micronesia": "FM", "micronesia": "FM", "faroe islands": "FO",
    "france": "FR", "france, metropolitan": "FX",
    
    // G
    "gabon": "GA", "great britain": "GB", "great britain (united kingdom; england)": "GB",
    "united kingdom": "GB", "uk": "GB", "england": "GB", "scotland": "GB",
    "wales": "GB", "northern ireland": "GB", "grenada": "GD", "georgia": "GE",
    "french guiana": "GF", "guernsey": "GG", "ghana": "GH", "gibraltar": "GI",
    "greenland": "GL", "gambia": "GM", "guinea": "GN", "guadeloupe": "GP",
    "equatorial guinea": "GQ", "greece": "GR",
    "south georgia and the south sandwich islands": "GS", "south georgia": "GS",
    "guatemala": "GT", "guam": "GU", "guinea-bissau": "GW", "guyana": "GY",
    
    // H
    "hong kong": "HK", "hong kong sar": "HK", "heard island and mcdonald islands": "HM",
    "honduras": "HN", "croatia": "HR", "haiti": "HT", "hungary": "HU",
    
    // I
    "canary islands": "IC", "indonesia": "ID", "ireland": "IE", "israel": "IL",
    "isle of man": "IM", "india": "IN", "british indian ocean territory": "IO",
    "iraq": "IQ", "iran": "IR", "iceland": "IS", "italy": "IT", "italia": "IT",
    
    // J
    "jersey": "JE", "jamaica": "JM", "jordan": "JO", "japan": "JP", "yugoslavia": "JU",
    
    // K
    "kenya": "KE", "kyrgyzstan": "KG", "cambodia": "KH", "kiribati": "KI",
    "the comoros": "KM", "comoros": "KM", "saintkitts": "KN", "saint kitts": "KN",
    "saint kitts and nevis": "KN", "north korea": "KP", "south korea": "KR",
    "korea": "KR", "korea, republic of": "KR", "republic of korea": "KR",
    "kosovo": "KV", "kuwait": "KW", "cayman islands": "KY", "kazakhstan": "KZ",
    
    // L
    "laos": "LA", "lebanon": "LB", "lucia": "LC", "saint lucia": "LC",
    "liechtenstein": "LI", "sri lanka": "LK", "liberia": "LR", "lesotho": "LS",
    "lithuania": "LT", "luxembourg": "LU", "latvia": "LV", "libya": "LY",
    
    // M
    "morocco": "MA", "monaco": "MC", "moldova": "MD", "montenegro": "ME",
    "saint martin (france)": "MF", "saint martin": "MF", "madagascar": "MG",
    "marshall islands": "MH", "republic of macedonia (fyrom)": "MK", "macedonia": "MK",
    "north macedonia": "MK", "mali": "ML", "myanmar (burma)": "MM", "myanmar": "MM",
    "burma": "MM", "mongolia": "MN", "macao": "MO", "macau": "MO",
    "northern mariana islands": "MP", "martinique": "MQ", "mauritania": "MR",
    "montserrat": "MS", "malta": "MT", "mauritius": "MU", "maldives": "MV",
    "malawi": "MW", "mexico": "MX", "malaysia": "MY", "mozambique": "MZ",
    
    // N
    "namibia": "NA", "new caledonia": "NC", "niger": "NE", "norfolk island": "NF",
    "nigeria": "NG", "nicaragua": "NI", "netherlands": "NL", "the netherlands": "NL",
    "holland": "NL", "norway": "NO", "nepal": "NP", "nauru": "NR", "niue": "NU",
    "new zealand": "NZ",
    
    // O
    "oman": "OM",
    
    // P
    "panama": "PA", "peru": "PE", "french polynesia": "PF", "papua new guinea": "PG",
    "the philippines": "PH", "philippines": "PH", "pakistan": "PK", "poland": "PL",
    "saintpierreanmiquelon": "PM", "saint pierre and miquelon": "PM",
    "pitcairn islands": "PN", "puerto rico": "PR", "palestinian territories": "PS",
    "palestine": "PS", "portugal": "PT", "palau": "PW", "paraguay": "PY",
    
    // Q
    "qatar": "QA",
    
    // R
    "r�union": "RE", "reunion": "RE", "romania": "RO", "serbia": "RS",
    "russian federation": "RU", "russia": "RU", "rwanda": "RW",
    
    // S
    "saudi arabia": "SA", "solomon islands": "SB", "seychelles": "SC", "sudan": "SD",
    "sweden": "SE", "singapore": "SG", "sthelena": "SH", "st. helena": "SH",
    "saint helena": "SH", "slovenia": "SI", "svalbard and jan mayen": "SJ",
    "slovakia": "SK", "sierra leone": "SL", "san marino": "SM", "senegal": "SN",
    "somalia": "SO", "suriname": "SR", "south sudan": "SS",
    "sao tome & principe": "ST", "sao tome and principe": "ST", "el salvador": "SV",
    "st.maarten": "SX", "sint maarten": "SX", "syria": "SY", "swaziland": "SZ",
    "eswatini": "SZ",
    
    // T
    "tristan da cunba": "TA", "turks & caicos islands": "TC", "turks and caicos islands": "TC",
    "chad": "TD", "french southern territories": "TF", "togo": "TG", "thailand": "TH",
    "tajikistan": "TJ", "tokelau": "TK", "timor-leste (east timor)": "TL",
    "timor-leste": "TL", "east timor": "TL", "turkmenistan": "TM", "tunisia": "TN",
    "tonga": "TO", "turkey": "TR", "t�rkiye": "TR", "trinidadandtobago": "TT",
    "trinidad and tobago": "TT", "tuvalu": "TV", "taiwan": "TW",
    "taiwan,province of china": "TW", "tanzania": "TZ",
    
    // U
    "ukraine": "UA", "uganda": "UG", "united states minor outlying islands": "UM",
    "united states of america (usa)": "US", "united states of america": "US",
    "united states": "US", "usa": "US", "uruguay": "UY", "uzbekistan": "UZ",
    
    // V
    "vatican city (the holy see)": "VA", "vatican city": "VA", "vatican": "VA",
    "saintvincentandthegrenadines": "VC", "saint vincent and the grenadines": "VC",
    "saint vincent": "VC", "venezuela": "VE", "british virgin islands": "VG",
    "united states virgin islands": "VI", "u.s. virgin islands": "VI",
    "vietnam": "VN", "viet nam": "VN", "vanuatu": "VU",
    
    // W
    "wallis and futuna": "WF", "samoa": "WS",
    
    // X (Special territories)
    "bonaire": "XB", "ascension": "XD", "st. eustatius": "XE",
    "spanish territories of n.africa": "XG", "azores": "XH", "madeira": "XI",
    "balearic islands": "XJ", "caroline islands": "XK", "st. maarten": "XM",
    "nevis": "XN", "somaliland": "XS", "st. barthelemy": "XY",
    
    // Y
    "yemen": "YE", "mayotte": "YT",
    
    // Z
    "south africa": "ZA", "zambia": "ZM", "zaire": "ZR", "zimbabwe": "ZW",
    
    // Netherlands Antilles (historical)
    "netherlands antilles": "AN"
  };
  return map[lc] || raw.toUpperCase();
}

// ==================== US STATE NORMALIZATION ====================

/**
 * Normalize US state name to 2-letter code
 * @param {string} stateRaw - State name or code
 * @return {string} 2-letter state code
 */
function normalizeUSState_(stateRaw) {
  const s = safeString_(stateRaw);
  if (!s) return "";
  const map = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY"
  };
  return map[s] || (s.length <= 3 ? s.toUpperCase() : s);
}

// ==================== ZIP CODE NORMALIZATION ====================

/**
 * Normalize ZIP code (US: 5-digit or ZIP+4 format)
 * @param {string} zipRaw - Raw ZIP code
 * @param {string} countryCode - 2-letter country code
 * @return {string} Normalized ZIP
 */
function normalizeZip_(zipRaw, countryCode) {
  const zr = safeString_(zipRaw);
  if (!zr) return "";
  
  // Non-US: return as-is
  if (safeString_(countryCode).toUpperCase() !== "US") {
    return zr;
  }
  
  // Already correct format: 12345-6789
  const dashMatch = zr.match(/^(\d{5})-(\d{4})$/);
  if (dashMatch) return zr;
  
  // Extract digits only
  const digitsOnly = zr.replace(/[^\d]/g, "");
  const digitCount = digitsOnly.length;
  
  if (digitCount >= 9) {
    return digitsOnly.slice(0, 5) + "-" + digitsOnly.slice(5, 9);
  } else if (digitCount >= 5) {
    return digitsOnly.slice(0, 5);
  } else {
    return digitsOnly;
  }
}

// ==================== URL NORMALIZATION ====================

/**
 * Normalize Etsy image URLs to use il_fullxfull (full resolution)
 * @param {string} url - Etsy image URL
 * @return {string} Normalized URL
 */
function normalizeEtsyImageUrl_(url) {
  if (!url) return url;
  const s = safeString_(url);
  
  if (!s.includes("etsystatic.com")) return s;
  
  return s.replace(/il_\d+x\d+(?=\D|$)/g, "il_fullxfull");
}

/**
 * Check if URL is already a direct image link
 * @param {string} url - URL to check
 * @return {boolean}
 */
function isDirectImageUrl_(url) {
  if (!url) return false;
  const s = safeString_(url).toLowerCase();
  
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$|#)/i.test(s)) return true;
  
  if (s.includes("googleusercontent.com") && 
      (s.includes("/d/") || s.includes("/image") || s.includes("/photo"))) {
    return true;
  }
  return false;
}

/**
 * Extract Drive file ID from various URL formats
 * @param {string} url - Drive URL
 * @return {string|null} File ID or null
 */
function extractDriveFileId_(url) {
  if (!url) return null;
  const s = safeString_(url);

  // thumbnail?id=FILE_ID
  let m = s.match(/thumbnail[?&]id=([a-zA-Z0-9_-]+)(?:&|$)/);
  if (m && m[1]) return m[1];

  // /file/d/ID/view
  m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];

  // googleusercontent.com/d/FILE_ID
  if (s.includes("googleusercontent.com")) {
    m = s.match(/\/d\/([a-zA-Z0-9_-]+)([=?]|$)/);
    if (m && m[1]) return m[1];
  }

  // ?id=ID or &id=ID
  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)(?:&|$)/);
  if (m && m[1]) return m[1];

  // uc?id=ID
  if (s.includes("drive.google.com/uc")) {
    m = s.match(/uc[?&](?:export=view&)?id=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return m[1];
  }

  return null;
}

/**
 * Convert Google Drive link to uc?export=view format
 * @param {string} url - Drive URL
 * @return {string} Image URL or empty string
 */
function driveLinkToImage_(url) {
  if (!url) return "";
  const s = safeString_(url);
  
  // Skip folders
  if (s.includes("drive.google.com/drive/folders") || 
      s.includes("drive.google.com/folder")) {
    return "";
  }
  
  // Already direct image
  if (isDirectImageUrl_(s)) return s;
  
  // Already uc?export=view format
  if (s.includes("drive.google.com/uc?export=view&id=")) return s;
  
  // Convert to uc?export=view
  const fileId = extractDriveFileId_(url);
  if (fileId) {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
  
  return "";
}

// ==================== TESTS ====================

/**
 * Test normalizeZip_() function
 */
function testNormalizeZip_() {
  const testCases = [
    { zip: "32707", country: "US", expected: "32707" },
    { zip: "29720-0271", country: "US", expected: "29720-0271" },
    { zip: "297200271", country: "US", expected: "29720-0271" },
    { zip: "77861-4139", country: "US", expected: "77861-4139" },
    { zip: "02108", country: "US", expected: "02108" },
    { zip: "AB1 2CD", country: "GB", expected: "AB1 2CD" }
  ];
  
  let allPassed = true;
  testCases.forEach(tc => {
    const result = normalizeZip_(tc.zip, tc.country);
    const passed = result === tc.expected;
    if (!passed) allPassed = false;
    Logger.log(`${passed ? "?" : "?"} ${tc.zip} (${tc.country}) -> ${result}`);
  });
  
  Logger.log(allPassed ? "\n?? ALL TESTS PASSED!" : "\n?? SOME TESTS FAILED!");
}

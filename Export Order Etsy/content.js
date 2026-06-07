/*
 * =============================================================
 * == FILE: content.js (BẢN DÙNG CHUNG)
 * == MỤC ĐÍCH:
 * == 1. Đã sửa lỗi "uniqBy".
 * == 2. Đã sửa lỗi "1 sản phẩm" (lấy tất cả).
 * == 3. Đã sửa logic "findTabPanelHeader" (tìm nút).
 * == 4. Đã sửa logic lấy "Note" (quét cả note khách và shop).
 * =============================================================
 */

// HÀM TÌM NÚT (ĐẶT Ở ĐẦU ĐỂ CÁC HÀM KHÁC CÓ THỂ DÙNG)
// Khi Etsy cập nhật UI, chỉ cần thêm selector mới vào mảng selectorsToTry
const findTabPanelHeader = () => {
  console.log("Etsy Extension: Đang tìm thanh tab...");
  let panel;
  const selectorsToTry = [
    'div[data-tabs-container=""] > ul[role="tablist"]',
    'ul[role="tablist"]',
    '.order-states-navigation nav ul.wt-tab'
    // Thêm selector mới vào đây nếu Etsy thay đổi cấu trúc DOM
  ];
  for (const selector of selectorsToTry) {
    if (!selector) continue;
    panel = document.querySelector(selector);
    if (panel) {
      console.log(`Etsy Extension: Đã tìm thấy thanh tab bằng selector: "${selector}"`);
      return panel;
    }
  }
  console.log("Etsy Extension: Thử cách dự phòng (tìm chữ 'Completed')...");
  const allButtons = document.querySelectorAll('button, a');
  for (let btn of allButtons) {
    if (btn.textContent.trim().toLowerCase().startsWith("completed")) {
      panel = btn.parentElement?.parentElement;
      if (panel && (panel.tagName === 'UL' || panel.tagName === 'DIV' || panel.tagName === 'NAV')) {
        console.log("Etsy Extension: Đã tìm thấy bằng cách dự phòng!");
        return panel;
      }
    }
  }
  console.error("Etsy Extension: KHÔNG TÌM THẤY thanh tab.");
  return null;
};

// PHẦN 1: HÀM TRÍCH XUẤT DỮ LIỆU
// -----------------------------------------------------------------
function extractShopAndOrderData() {
  const data = {
    shop_id: null,
    shop_name: null,
    new_order_state_id: null,
    completed_order_state_id: null,
    timestamp: new Date().toISOString()
  };
  const html = document.documentElement.outerHTML;

  // HÀM HELPER - Dùng chung findTabPanelHeader để tránh lệch behavior
  const findTabByLabel = (label) => {
    const panel = findTabPanelHeader();
    if (!panel) return null;
    const items = panel.querySelectorAll('li.wt-tab__item, li[role="presentation"]');
    return [...items].find(li => {
      const textEl = li.querySelector('span[data-test-id="unsanitize"]') || li.querySelector('button[role="tab"]');
      return textEl && textEl.textContent.trim().toLowerCase() === label.toLowerCase();
    }) || null;
  };
  const getQueryParam = (url, key) => {
    try { return new URL(url, location.origin).searchParams.get(key); } catch { return null; }
  };
  const extractIdFromTab = (label) => {
    const li = findTabByLabel(label);
    const href = li?.querySelector('a[href]')?.getAttribute('href') || '';
    if (!href) return null;
    return getQueryParam(href, 'filters[order_state_id]') ||
      (decodeURIComponent(href).match(/filters\[order_state_id\]=(\d+)/)?.[1] ?? null);
  };
  const extractAllStates = () => {
    const map = {}; // name(lowercase) -> id(string)
    const re = /{[^{}]*"type":"Common_OrderState"[^{}]*}/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const obj = m[0];
      const m1 = obj.match(/"name":"([^"]+)"/);
      const m2 = obj.match(/"order_state_id":(\d+)/);
      if (m1 && m2) {
        map[m1[1].toLowerCase()] = m2[1];
      }
    }
    return map;
  };

  data.shop_id = (html.match(/"shop_id":(\d+)/) || [])[1] || null;
  data.shop_name = (html.match(/"shop_name":"([^"]+)"/) || [])[1] || null;
  const newFromTab = extractIdFromTab('New');
  const completedFromTab = extractIdFromTab('Completed');
  const stateMap = extractAllStates();
  // extractAllStates đã lowercase key, nên chỉ cần 'new' và 'completed'
  const newFromMap = stateMap['new'];
  const completedFromMap = stateMap['completed'];
  data.new_order_state_id = newFromTab || newFromMap || null;
  data.completed_order_state_id = completedFromTab || completedFromMap || null;

  if (data.new_order_state_id && data.completed_order_state_id &&
    data.new_order_state_id === data.completed_order_state_id &&
    completedFromMap && completedFromMap !== data.new_order_state_id) {
    data.completed_order_state_id = completedFromMap;
  }
  return data;
}

function saveToLocalStorage(data) {
  try {
    localStorage.setItem('etsy_shop_data', JSON.stringify(data));
    // Lưu history (hiện chưa được sử dụng trong UI, có thể xóa nếu không cần)
    let history = JSON.parse(localStorage.getItem('etsy_shop_data_history') || '[]');
    history.unshift(data);
    if (history.length > 3) {
      history = history.slice(0, 3);
    }
    localStorage.setItem('etsy_shop_data_history', JSON.stringify(history));
    return true;
  } catch (error) {
    return false;
  }
}
function loadFromLocalStorage() {
  try {
    const data = localStorage.getItem('etsy_shop_data');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    return null;
  }
}

function getGoogleScriptsId() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['scriptId'], function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result['scriptId'] || null);
    });
  });
}

// Lấy shopMode từ chrome.storage.local
function getShopMode() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['shopMode'], function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result['shopMode'] || null);
    });
  });
}
function toDateString(sec) {
  if (!sec) return '';
  const d = new Date(sec * 1000);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function toISOString(sec) {
  if (!sec) return '';
  const d = new Date(sec * 1000);
  return d.toISOString();
}

function toISODateString(sec) {
  if (!sec) return '';
  const d = new Date(sec * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = "position:fixed; bottom:20px; right:20px; background:white; color:black; padding:15px; border-radius:5px; box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:9999; font-size:16px; transition:opacity 0.3s; opacity:1;";
  notification.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => { notification.remove(); }, 300);
  }, 3000);
}


function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr || []) {
    const k = keyFn(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}


// PHẦN 2: HÀM EXPORT DATA (PHIÊN BẢN QUÉT NOTE CHUẨN NHẤT)
// -----------------------------------------------------------------
async function exportToGoogleSheet(orders, buyers = [], type = '') {
  const googleScriptsId = await getGoogleScriptsId();

  if (!googleScriptsId) {
    throw new Error('Google Scripts ID chưa được cấu hình.\nVui lòng mở Options của extension để cài đặt ID.');
  }
  if (!orders || orders.length === 0) {
    throw new Error('Không có orders để export');
  }

  // Lấy shopMode để gửi kèm payload
  const shopMode = await getShopMode();

  const url = `https://script.google.com/macros/s/${googleScriptsId}/exec`;

  const buyersMap = {};
  buyers.forEach(buyer => {
    buyersMap[buyer.buyer_id] = buyer;
  });
  const data = extractShopAndOrderData();

  // Map export_scope EXACTLY as required by backend
  let exportScope;
  if (type === 'ship_today_tomorrow') {
    exportScope = 'ship_today_tomorrow';
  } else if (type === 'new') {
    exportScope = 'new_orders';
  } else if (type === 'complete') {
    exportScope = 'complete_orders';
  } else {
    exportScope = 'new_orders'; // Default fallback
  }

  const formattedData = {
    action: 'addOrders',
    type: type, // 'new' hoặc 'complete' hoặc 'ship_today_tomorrow'
    shop_mode: shopMode || '', // Thêm shop_mode vào payload
    export_scope: exportScope, // 'new_orders', 'complete_orders', or 'ship_today_tomorrow'
    orders: orders.flatMap(order => { // DÙNG flatMap

      const buyerId = order.buyer_id;
      const buyer = buyersMap[buyerId];
      const toAddress = order.fulfillment?.to_address;

      // <--- PHẦN LẤY NOTE (ĐÃ SỬA THEO JSON MỚI NHẤT)
      let allNotesText = [];

      // 1. Quét note của khách (note_from_buyer)
      if (order.notes && order.notes.note_from_buyer) {
        const buyerNote = String(order.notes.note_from_buyer).trim();
        if (buyerNote) {
          allNotesText.push(buyerNote);
        }
      }

      // 2. Quét note của shop (private_order_notes)
      if (order.notes && Array.isArray(order.notes.private_order_notes)) {
        order.notes.private_order_notes.forEach(privateNote => {
          if (privateNote && privateNote.note) {
            const shopNote = String(privateNote.note).trim();
            if (shopNote) {
              allNotesText.push(shopNote);
            }
          }
        });
      }

      // 3. Nối tất cả note tìm được lại
      const noteText = allNotesText.join('\n\n');
      // <--- KẾT THÚC PHẦN LẤY NOTE

      if (!order.transactions || order.transactions.length === 0) {
        return [];
      }

      // Extract order dates
      const orderDate = order.created_timestamp || order.paid_timestamp || order.order_date || null;
      const expectedShipDate = order.fulfillment?.expected_ship_date || null;

      // Extract actual ship date from shipments array
      let actualShipDate = null;
      if (order.fulfillment?.shipments && Array.isArray(order.fulfillment.shipments)) {
        for (const shipment of order.fulfillment.shipments) {
          if (shipment.ship_date || shipment.shipped_date) {
            actualShipDate = shipment.ship_date || shipment.shipped_date;
            break;
          }
        }
      }

      // Lặp qua TẤT CẢ sản phẩm
      return order.transactions.map(tx => {

        const variationsText = tx.variations?.map(v => `${v.property}: ${v.value}`).join('\n') || '';
        let imageUrl = tx.product?.image_url_75x75 || '';
        if (imageUrl) {
          imageUrl = imageUrl.replace('il_75x75', 'il_500x500'); // Lấy ảnh to
        }

        // Extract listing_id with fallbacks
        const listingId = tx.listing_id || tx.listing?.listing_id || tx.product_data?.listing_id || tx.listing?.id || '';

        // Parse nested money objects: {value: 649500, currency_code: "VND"}
        // IMPORTANT: Etsy API returns USD values in CENTS (29$ = 2900), VND values in DONG (649,500 = 649500)
        // Need to convert USD from cents to dollars (divide by 100)
        const parseMoney = (obj) => {
          if (!obj) return { value: 0, currency: 'USD' };
          if (typeof obj === 'number') return { value: obj, currency: 'USD' };
          if (typeof obj === 'object') {
            const currency = (obj.currency_code || obj.currency || 'USD').toUpperCase();
            let value = obj.value || obj.amount || 0;
            // Convert USD from cents to dollars (divide by 100)
            // VND values are already in dong, no conversion needed
            if (currency === 'USD' && value > 0) {
              value = value / 100;
            }
            return {
              value: value,
              currency: currency
            };
          }
          return { value: 0, currency: 'USD' };
        };

        // Parse financial fields from order (check both top-level and payment.cost_breakdown)
        // Prioritize payment.cost_breakdown (CHUẨN từ Etsy API)
        const cb = order.payment?.cost_breakdown;
        // total_cost = Order total (40.86$ = Subtotal + Shipping + Tax)
        const totalPriceObj = parseMoney(cb?.total_cost || order.total_price || order.grandtotal_price);
        // subtotal = Subtotal after discount (29.25$ = Item total - Discount)
        // items_cost = Item total before discount (45$)
        // Use subtotal if available, otherwise calculate: items_cost - discount
        const subtotalPriceObj = parseMoney(cb?.subtotal || order.subtotal_price);
        // If subtotal not available, try to calculate from items_cost - discount
        if (!subtotalPriceObj.value && cb?.items_cost) {
          const itemsCost = parseMoney(cb.items_cost);
          const discount = parseMoney(cb.discount || order.discount_amount || order.discount);
          subtotalPriceObj.value = Math.max(0, itemsCost.value - discount.value);
          subtotalPriceObj.currency = itemsCost.currency;
        }
        // Fallback to items_cost if still no value
        if (!subtotalPriceObj.value) {
          const itemsCostObj = parseMoney(cb?.items_cost || order.subtotal_price || order.total_price);
          subtotalPriceObj.value = itemsCostObj.value;
          subtotalPriceObj.currency = itemsCostObj.currency;
        }
        // Prioritize payment.cost_breakdown.buyer_cost, then top-level buyer_cost
        const buyerCostObj = parseMoney(cb?.buyer_cost || order.buyer_cost);
        // grandtotal = Order total (same as total_cost)
        const grandtotalPriceObj = parseMoney(cb?.total_cost || cb?.buyer_cost || buyerCostObj);
        const itemsCostObj = parseMoney(cb?.items_cost || order.items_cost);
        const shippingPaidByBuyerObj = parseMoney(cb?.shipping_cost || order.shipping_paid_by_buyer || order.shipping_cost || order.fulfillment?.shipping_cost);
        const transactionFeeObj = parseMoney(order.transaction_fees || order.etsy_fees || cb?.transaction_fees);
        const paymentFeeObj = parseMoney(order.payment_fees || cb?.payment_fees);
        const taxObj = parseMoney(order.tax || order.tax_cost || cb?.tax_cost);
        const discountObj = parseMoney(order.discount_amount || order.discount || cb?.discount);

        // Get currency from first available money object (prioritize payment.cost_breakdown.total_cost)
        // cb?.total_cost?.currency_code is the most reliable source
        let currency = cb?.total_cost?.currency_code || cb?.buyer_cost?.currency_code ||
          buyerCostObj.currency || grandtotalPriceObj.currency || totalPriceObj.currency || subtotalPriceObj.currency ||
          order.currency_code || order.currency;

        // If still no currency or defaulting to USD, check nested objects and shop name
        if (!currency || currency === 'USD') {
          // Check order object for currency hints (nested paths)
          const orderCurrency = order.currency_code || order.currency ||
            order.payment?.cost_breakdown?.buyer_cost?.currency_code ||
            order.buyer_cost?.currency_code ||
            order.total_price?.currency_code ||
            order.grandtotal_price?.currency_code ||
            order.subtotal_price?.currency_code ||
            order.payment?.cost_breakdown?.items_cost?.currency_code ||
            order.items_cost?.currency_code ||
            order.payment?.cost_breakdown?.shipping_cost?.currency_code ||
            order.shipping_paid_by_buyer?.currency_code;
          currency = orderCurrency || 'USD';

          // Final fallback: check shop name for VND shops
          if ((!currency || currency === 'USD') && data.shop_name) {
            const shopNameLower = String(data.shop_name).toLowerCase();
            if (shopNameLower.includes('eden') || shopNameLower.includes('vnd') ||
              shopNameLower.includes('viettoan') || shopNameLower.includes('handma') ||
              shopNameLower.includes('viet')) {
              currency = 'VND';
            }
          }
        }

        currency = currency.toUpperCase();

        // Gửi đi TẤT CẢ thông tin (36 cột chuẩn Manager)
        return {
          note: noteText,
          gift_message: order.gift_message || order.notes?.gift_message || '',
          is_gift: order.is_gift || false,
          order_id: String(order.order_id || ''),
          order_date: orderDate ? toDateString(orderDate) : '', // Format dd/MM/yyyy
          expected_ship_date: expectedShipDate ? toDateString(expectedShipDate) : '',
          shop_name: data.shop_name,
          product_title: tx.product?.title || '',
          product_image: imageUrl,
          product_sku: tx.product?.product_identifier || '',
          product_quantity: tx.quantity || 0,
          item_price: parseMoney(tx.price, currency).value,
          item_total: parseMoney(tx.price, currency).value * (tx.quantity || 1),
          variations: variationsText,
          listing_id: listingId,
          currency_code: currency,
          total_price: totalPriceObj.value,
          subtotal_price: subtotalPriceObj.value,
          shipping_cost: shippingPaidByBuyerObj.value,
          tax: taxObj.value,
          discount_amount: discountObj.value,
          transaction_fees: transactionFeeObj.value,
          payment_fees: paymentFeeObj.value,
          tracking_code: order.fulfillment?.shipments?.[0]?.tracking_code || '',
          buyer_name: buyer?.name || '',
          buyer_email: buyer?.email || '',
          shipping_name: toAddress?.name || '',
          shipping_address: toAddress?.first_line || '',
          shipping_address_2: toAddress?.second_line || '',
          shipping_city: toAddress?.city || '',
          shipping_state: toAddress?.state || '',
          shipping_zip: toAddress?.zip || '',
          shipping_country: toAddress?.country || '',
          shipping_phone: toAddress?.phone || '',
          transaction_id: String(tx.transaction_id || ''), // Đảm bảo là string và có giá trị
          has_ads_attribution: order.has_ads_attribution || false
        };
      });
    }),
    timestamp: new Date().toISOString(),
  };
  formattedData.total_orders = formattedData.orders.length; // Tổng số SẢN PHẨM

  // Debug log before fetch
  console.log('[EXPORT] scope=', exportScope, 'orders=', formattedData.orders.length);
  console.log('Sending to Google Sheet:', url);
  console.log('Payload summary:', {
    action: formattedData.action,
    type: formattedData.type,
    shop_mode: formattedData.shop_mode,
    export_scope: formattedData.export_scope,
    total_orders: formattedData.total_orders,
    orders_count: formattedData.orders.length
  });

  try {
    // Use no-cors mode with text/plain Content-Type (as required by backend)
    // Response is opaque and cannot be read (expected behavior)
    const body = JSON.stringify(formattedData);

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body
    });

    console.log('✅ Sent (no-cors). bytes=', body.length);

    return {
      success: true,
      count: formattedData.orders.length,
      insertedCount: formattedData.orders.length, // Estimate (can't read actual response)
      skippedCount: 0, // Unknown with no-cors
      exportScope: exportScope
    };
  } catch (error) {
    console.error('❌ Error sending to Google Sheet:', {
      error: error.message,
      stack: error.stack,
      url: url
    });
    throw new Error('Không thể kết nối với Google Sheet: ' + error.message);
  }
}


// PHẦN 3: HÀM VẼ NÚT VÀ GỌI API
// -----------------------------------------------------------------
function autoExtractAndSave() {
  if (window.location.pathname.includes('/your/orders/sold')) {
    setTimeout(() => {
      const data = extractShopAndOrderData();
      if (data.shop_id && data.new_order_state_id && data.completed_order_state_id) {
        saveToLocalStorage(data);
      }
    }, 2000);
  }
}

function addButtonsOnce() {
  if (!location.pathname.includes('/your/orders/sold')) return;
  const panelHeader = findTabPanelHeader();
  if (!panelHeader) return;
  if (panelHeader.dataset.customInit === '1') return;
  panelHeader.dataset.customInit = '1';

  addCustomButtonViewserver(panelHeader);
  addCustomButtonNewOrder(panelHeader);
  addCustomButtonCompleteOrder(panelHeader);
  addCustomButtonShipTodayTomorrow(panelHeader);
  console.log('✅ Buttons initialized once for this page.');
}

// HÀM CHUNG TẠO NÚT VÀ XỬ LÝ ORDERS (DRY - Don't Repeat Yourself)
function createOrdersButton({
  panelHeader,
  type, // 'new' | 'complete'
  labelText,
  btnAttr,
  loadingText,
  emptyMessage,
  successMessage,
  getStateId,
  buildUrl,
  maxPages
}) {
  if (!panelHeader) return;
  if (document.querySelector(`[data-custom-btn="${btnAttr}"]`)) return;

  const customButtonLi = document.createElement('li');
  customButtonLi.className = 'wt-tab__item custom-button-item';
  const customButton = document.createElement('button');
  customButton.className = 'buttonshow ml-xs-2';
  customButton.innerHTML = `<span>${labelText}</span>`;
  customButton.setAttribute('data-custom-btn', btnAttr);
  customButton.style.cssText = "background-color: #00796B; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; margin-left: 8px;";

  customButtonLi.appendChild(customButton);
  panelHeader.appendChild(customButtonLi);
  console.log(`${type} Orders button added`);

  customButton.addEventListener('click', async (e) => {
    e.preventDefault();
    const pageData = extractShopAndOrderData();
    const savedData = loadFromLocalStorage();
    const idstore = (pageData?.shop_id) || (savedData?.shop_id);
    if (!idstore) {
      alert('⚠️ Không tìm thấy shop_id! Hãy reload trang để auto-save trước.');
      return;
    }

    const stateidorder = getStateId(pageData, savedData);
    if (!stateidorder) {
      alert(`⚠️ Không xác định được ${type === 'new' ? 'new' : 'completed'}_order_state_id.`);
      return;
    }

    const LIMIT = 50;
    let page = 0;
    const fetchPage = async (offsetVal) => {
      const url = buildUrl(idstore, stateidorder, offsetVal, LIMIT);
      const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' }, credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status} khi gọi API (offset=${offsetVal})`);
      const json = await res.json();
      const os = json?.orders_search ?? json?.payload?.orders_search ?? json?.payload?.data?.orders_search;
      if (os) return { orders: os.orders || [], buyers: os.buyers || [], total_count: os.total_count || 0 };
      return { orders: json.orders || [], buyers: json.buyers || [], total_count: json.total_count || 0 };
    };

    customButton.disabled = true;
    customButton.innerHTML = `<span>${loadingText}</span>`;
    try {
      const allOrders = [];
      const allBuyers = [];
      let expectedTotal = null;
      while (page < maxPages) {
        const offset = page * LIMIT;
        const { orders, buyers, total_count } = await fetchPage(offset);
        if (expectedTotal == null && Number.isFinite(total_count)) expectedTotal = total_count;
        if (!Array.isArray(orders) || orders.length === 0) break;
        allOrders.push(...orders);
        if (Array.isArray(buyers) && buyers.length) allBuyers.push(...buyers);
        if (orders.length < LIMIT) break;
        page += 1;
        if (expectedTotal != null && allOrders.length >= expectedTotal) break;
      }
      const dedupedBuyers = uniqBy(allBuyers, b => (b?.buyer_id ?? b?.id ?? JSON.stringify(b)));
      const ordersCount = allOrders.length;
      showNotification(`✅ Đã lấy ${ordersCount} đơn ${type === 'new' ? 'New' : 'Completed'}!`);
      if (ordersCount > 0) {
        customButton.innerHTML = '<span>📤 Đang xuất ra Sheet...</span>';
        try {
          const result = await exportToGoogleSheet(allOrders, dedupedBuyers, type);

          // Response is opaque (no-cors mode), so we can't read it
          const message = `${successMessage(result.count, ordersCount)}\n\nExport Scope: ${result.exportScope || type}`;

          showNotification(`✅ Đã gửi ${result.count} sản phẩm`);
          alert(message);
        } catch (exportError) {
          showNotification('⚠️ Đã lấy đơn nhưng xuất thất bại: ' + (exportError?.message || exportError));
          alert(`⚠️ Đã lấy ${ordersCount} đơn nhưng xuất thất bại:\n${exportError?.message || exportError}`);
        }
      } else {
        alert(emptyMessage);
      }
    } catch (err) {
      alert(`❌ Lỗi khi gọi API:\n${err?.message || err}`);
    } finally {
      customButton.disabled = false;
      customButton.innerHTML = `<span>${labelText}</span>`;
    }
  });
}

function addCustomButtonNewOrder(panelHeader) {
  createOrdersButton({
    panelHeader,
    type: 'new',
    labelText: '📋 Đẩy New Orders sang Google Sheet',
    btnAttr: 'new-orders',
    loadingText: '⏳ Đang tải New Orders...',
    emptyMessage: 'ℹ️ Không tìm thấy đơn New nào.',
    successMessage: (count, ordersCount) => `✅ Thành công!\n\nSố sản phẩm New: ${count}\n(Từ ${ordersCount} đơn hàng)\nĐã xuất Google Sheet: ✓`,
    getStateId: (pageData, savedData) => (pageData?.new_order_state_id) || (savedData?.new_order_state_id) || null,
    buildUrl: (idstore, stateidorder, offsetVal, LIMIT) => `https://www.etsy.com/api/v3/ajax/bespoke/shop/${idstore}/mission-control/orders?filters[order_state_id]=${encodeURIComponent(stateidorder)}&limit=${LIMIT}&offset=${offsetVal}&sort_by=order_date&sort_order=asc`,
    maxPages: 400
  });
}

function addCustomButtonCompleteOrder(panelHeader) {
  createOrdersButton({
    panelHeader,
    type: 'complete',
    labelText: '📦 Đẩy Complete Orders sang Google Sheet',
    btnAttr: 'complete-orders',
    loadingText: '⏳ Đang tải đơn hoàn tất...',
    emptyMessage: 'ℹ️ Không tìm thấy đơn hoàn tất nào.',
    successMessage: (count, ordersCount) => `✅ Thành công!\n\nSố sản phẩm Completed: ${count}\n(Từ ${ordersCount} đơn hàng)\nĐã xuất Google Sheet: ✓`,
    getStateId: (pageData, savedData) => (pageData?.completed_order_state_id) || (savedData?.completed_order_state_id) || null,
    buildUrl: (idstore, stateidorder, offsetVal, LIMIT) => `https://www.etsy.com/api/v3/ajax/bespoke/shop/${idstore}/mission-control/orders/data?filters[order_state_id]=${encodeURIComponent(stateidorder)}&limit=${LIMIT}&offset=${offsetVal}&sort_by=order_date&sort_order=asc`,
    maxPages: 1000
  });
}

// Helper function to fetch orders by ship date filter
async function fetchOrdersByShipDate(idstore, shipDateFilter, stateidorder) {
  const LIMIT = 50;
  let page = 0;
  const allOrders = [];
  const allBuyers = [];

  const fetchPage = async (offsetVal) => {
    // Use the same endpoint as new orders but with ship_date filter
    const url = `https://www.etsy.com/api/v3/ajax/bespoke/shop/${idstore}/mission-control/orders?filters[order_state_id]=${encodeURIComponent(stateidorder)}&filters[ship_date]=${encodeURIComponent(shipDateFilter)}&limit=${LIMIT}&offset=${offsetVal}&sort_by=expected_ship_date&sort_order=asc`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} khi gọi API (offset=${offsetVal}, ship_date=${shipDateFilter})`);
    const json = await res.json();
    const os = json?.orders_search ?? json?.payload?.orders_search ?? json?.payload?.data?.orders_search;
    if (os) return { orders: os.orders || [], buyers: os.buyers || [], total_count: os.total_count || 0 };
    return { orders: json.orders || [], buyers: json.buyers || [], total_count: json.total_count || 0 };
  };

  let expectedTotal = null;
  while (page < 400) {
    const offset = page * LIMIT;
    const { orders, buyers, total_count } = await fetchPage(offset);
    if (expectedTotal == null && Number.isFinite(total_count)) expectedTotal = total_count;
    if (!Array.isArray(orders) || orders.length === 0) break;
    allOrders.push(...orders);
    if (Array.isArray(buyers) && buyers.length) allBuyers.push(...buyers);
    if (orders.length < LIMIT) break;
    page += 1;
    if (expectedTotal != null && allOrders.length >= expectedTotal) break;
  }

  return { orders: allOrders, buyers: allBuyers };
}

function addCustomButtonShipTodayTomorrow(panelHeader) {
  if (!panelHeader) return;
  if (document.querySelector('[data-custom-btn="ship-today-tomorrow"]')) return;

  const customButtonLi = document.createElement('li');
  customButtonLi.className = 'wt-tab__item custom-button-item';
  const customButton = document.createElement('button');
  customButton.className = 'buttonshow ml-xs-2';
  customButton.innerHTML = '<span>🚢 Export Ship Today + Tomorrow</span>';
  customButton.setAttribute('data-custom-btn', 'ship-today-tomorrow');
  customButton.style.cssText = "background-color: #FF6B35; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; margin-left: 8px;";

  customButtonLi.appendChild(customButton);
  panelHeader.appendChild(customButtonLi);
  console.log('Ship Today + Tomorrow button added');

  customButton.addEventListener('click', async (e) => {
    e.preventDefault();
    const pageData = extractShopAndOrderData();
    const savedData = loadFromLocalStorage();
    const idstore = (pageData?.shop_id) || (savedData?.shop_id);
    if (!idstore) {
      alert('⚠️ Không tìm thấy shop_id! Hãy reload trang để auto-save trước.');
      return;
    }

    const stateidorder = (pageData?.new_order_state_id) || (savedData?.new_order_state_id) || null;
    if (!stateidorder) {
      alert('⚠️ Không xác định được new_order_state_id.');
      return;
    }

    customButton.disabled = true;
    customButton.innerHTML = '<span>⏳ Fetching ship-today...</span>';

    try {
      // Fetch today's orders
      showNotification('⏳ Đang lấy đơn ship hôm nay...');
      const todayResult = await fetchOrdersByShipDate(idstore, 'ship_date_today', stateidorder);

      customButton.innerHTML = '<span>⏳ Fetching ship-tomorrow...</span>';
      showNotification('⏳ Đang lấy đơn ship ngày mai...');

      // Fetch tomorrow's orders
      const tomorrowResult = await fetchOrdersByShipDate(idstore, 'ship_date_tomorrow', stateidorder);

      // Combine and deduplicate orders by order_id
      const ordersMap = new Map();
      [...todayResult.orders, ...tomorrowResult.orders].forEach(order => {
        const orderId = order.order_id || order.receipt_id;
        if (orderId && !ordersMap.has(orderId)) {
          ordersMap.set(orderId, order);
        }
      });

      const allOrders = Array.from(ordersMap.values());
      const allBuyers = [...todayResult.buyers, ...tomorrowResult.buyers];
      const dedupedBuyers = uniqBy(allBuyers, b => (b?.buyer_id ?? b?.id ?? JSON.stringify(b)));

      const ordersCount = allOrders.length;
      showNotification(`✅ Đã lấy ${ordersCount} đơn (Today + Tomorrow)!`);

      if (ordersCount > 0) {
        customButton.innerHTML = '<span>📤 Sending to sheet...</span>';
        showNotification('📤 Đang xuất ra Sheet...');

        try {
          const result = await exportToGoogleSheet(allOrders, dedupedBuyers, 'ship_today_tomorrow');

          // Response is opaque (no-cors mode), so we can't read it
          const message = `✅ Thành công!\n\nSố sản phẩm: ${result.count}\n(Từ ${ordersCount} đơn hàng)\n\nExport Scope: ${result.exportScope || 'ship_today_tomorrow'}\n\nĐã gửi đến Google Sheet thành công!`;

          showNotification(`✅ Đã gửi ${result.count} sản phẩm`);
          alert(message);
        } catch (exportError) {
          showNotification('⚠️ Đã lấy đơn nhưng xuất thất bại: ' + (exportError?.message || exportError));
          alert(`⚠️ Đã lấy ${ordersCount} đơn nhưng xuất thất bại:\n${exportError?.message || exportError}`);
        }
      } else {
        alert('ℹ️ Không tìm thấy đơn nào cần ship hôm nay hoặc ngày mai.');
      }
    } catch (err) {
      alert(`❌ Lỗi khi gọi API:\n${err?.message || err}`);
      showNotification('❌ Lỗi: ' + (err?.message || err));
    } finally {
      customButton.disabled = false;
      customButton.innerHTML = '<span>🚢 Export Ship Today + Tomorrow</span>';
    }
  });
}

function addCustomButtonViewserver(panelHeader) {
  if (!panelHeader) return;
  if (document.querySelector('.view-saved-data-btn')) return;

  // Bọc button vào <li> cho đúng cấu trúc HTML (panelHeader là <ul>)
  const li = document.createElement('li');
  li.className = 'wt-tab__item custom-button-item';

  const viewDataButton = document.createElement('button');
  viewDataButton.className = 'view-saved-data-btn btn-link ml-xs-2';
  viewDataButton.innerHTML = '<span>👁️ View Saved Data ID Shop</span>';
  viewDataButton.style.cssText = "background:none; border:none; color:#00796B; text-decoration:underline; cursor:pointer; margin-left: 8px;";

  viewDataButton.addEventListener('click', function (e) {
    e.preventDefault();
    const savedData = loadFromLocalStorage();
    if (savedData) {
      let message = `📊 Dữ liệu đã lưu:\n\n`;
      message += `Shop ID: ${savedData.shop_id}\n`;
      message += `Shop Name: ${savedData.shop_name}\n`;
      message += `New Order State ID: ${savedData.new_order_state_id}\n`;
      message += `Complete Order State ID: ${savedData.completed_order_state_id}\n`;
      message += `Saved at: ${new Date(savedData.timestamp).toLocaleString()}`;
      alert(message);
    } else {
      alert('ℹ️ Chưa có dữ liệu nào được lưu. Hãy F5 lại trang.');
    }
  });

  li.appendChild(viewDataButton);
  panelHeader.appendChild(li);
}

// PHẦN 4: KHỞI CHẠY CODE
// -----------------------------------------------------------------
autoExtractAndSave();
addButtonsOnce();

// Lắng nghe thay đổi trang để vẽ lại nút
let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(addButtonsOnce, 300);
});
observer.observe(document.body, { childList: true, subtree: true });

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    const panelHeader = findTabPanelHeader();
    if (panelHeader) delete panelHeader.dataset.customInit;
    setTimeout(addButtonsOnce, 500);
  }
}).observe(document, { subtree: true, childList: true });
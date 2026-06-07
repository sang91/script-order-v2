// Hàm này chạy khi popup được mở
document.addEventListener("DOMContentLoaded", () => {
  // 0. Kiểm tra và hiển thị thông báo cần update
  const updateNotification = document.getElementById("updateNotification");
  const updateButton = document.getElementById("updateButton");
  const dismissUpdate = document.getElementById("dismissUpdate");
  
  chrome.storage.local.get(["extensionVersion", "updateDismissed"], (result) => {
    const currentVersion = chrome.runtime.getManifest().version;
    const savedVersion = result.extensionVersion;
    const updateDismissed = result.updateDismissed || false;
    
    // Nếu version khác hoặc chưa có version được lưu, và chưa bị dismiss
    if ((!savedVersion || savedVersion !== currentVersion) && !updateDismissed) {
      updateNotification.style.display = "block";
    }
    
    // Lưu version hiện tại
    chrome.storage.local.set({ extensionVersion: currentVersion });
  });
  
  // Xử lý nút "Hướng dẫn cập nhật"
  if (updateButton) {
    updateButton.addEventListener("click", () => {
      alert("📋 HƯỚNG DẪN CẬP NHẬT EXTENSION:\n\n" +
            "1. Vào chrome://extensions/\n" +
            "2. Tìm extension 'Etsy Order Exporter'\n" +
            "3. Bấm nút 'Tải lại' (Reload) hoặc tắt/bật lại extension\n" +
            "4. Quay lại trang Etsy Orders và F5 để refresh\n\n" +
            "✅ Sau khi cập nhật, bạn sẽ thấy tùy chọn chọn loại shop (Key Fob / Strap)!");
    });
  }
  
  // Xử lý nút "Đã hiểu, đóng lại"
  if (dismissUpdate) {
    dismissUpdate.addEventListener("click", () => {
      updateNotification.style.display = "none";
      chrome.storage.local.set({ updateDismissed: true });
    });
  }
  
  // Xử lý nút "Kiểm tra cập nhật"
  const checkUpdateBtn = document.getElementById("checkUpdateBtn");
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener("click", () => {
      chrome.storage.local.get(["shopMode"], (result) => {
        if (result.shopMode) {
          alert(`✅ Extension đã được cập nhật!\n\nLoại shop hiện tại: ${result.shopMode === 'keyfob' ? 'Key Fob' : 'Dây đồng hồ (Strap)'}\n\nNếu chưa thấy tùy chọn chọn loại shop, vui lòng:\n1. Reload extension tại chrome://extensions/\n2. F5 lại trang Etsy Orders`);
        } else {
          alert("⚠️ CHƯA CẬP NHẬT EXTENSION!\n\n" +
                "Bạn chưa có tính năng chọn loại shop (Key Fob / Strap).\n\n" +
                "📋 HƯỚNG DẪN CẬP NHẬT:\n" +
                "1. Vào chrome://extensions/\n" +
                "2. Tìm extension 'Etsy Order Exporter'\n" +
                "3. Bấm nút 'Tải lại' (Reload) 🔄\n" +
                "4. Quay lại popup này và chọn loại shop\n" +
                "5. F5 lại trang Etsy Orders\n\n" +
                "✅ Sau khi cập nhật, bạn sẽ thấy radio button để chọn Key Fob hoặc Strap!");
          // Hiển thị notification
          if (updateNotification) {
            updateNotification.style.display = "block";
            chrome.storage.local.set({ updateDismissed: false });
          }
        }
      });
    });
  }
  
  // 1. Tải ID đã lưu và shopMode, hiển thị lên UI
  chrome.storage.local.get(["scriptId", "shopMode"], (result) => {
    if (result.scriptId) {
      document.getElementById("scriptId").value = result.scriptId;
    }
    
    // Tick radio button theo shopMode đã lưu
    if (result.shopMode) {
      const radio = document.querySelector(`input[name="shopType"][value="${result.shopMode}"]`);
      if (radio) {
        radio.checked = true;
      }
    } else {
      // Mặc định tick "keyfob" nếu chưa có shopMode
      const defaultRadio = document.querySelector('input[name="shopType"][value="keyfob"]');
      if (defaultRadio) {
        defaultRadio.checked = true;
      }
    }
  });

  // 2. Gán sự kiện cho nút "Save ID"
  document.getElementById("saveButton").addEventListener("click", () => {
    const id = document.getElementById("scriptId").value;
    if (id) {
      // Lấy shopMode từ radio đang được chọn
      const selectedRadio = document.querySelector('input[name="shopType"]:checked');
      const shopMode = selectedRadio ? selectedRadio.value : 'keyfob'; // Mặc định keyfob
      
      // Lưu cả scriptId và shopMode
      chrome.storage.local.set({ 
        scriptId: id,
        shopMode: shopMode
      }, () => {
        alert("Đã lưu Script ID & loại shop!");
        window.close(); // Đóng popup sau khi lưu
      });
    } else {
      alert("Vui lòng nhập ID Google Scripts!");
    }
  });

  // 3. Mở link Google Sheets trong tab mới
  const strapLink = document.getElementById("strapLink");
  if (strapLink) {
    strapLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://docs.google.com/spreadsheets/d/1aWCOKShQNR0UXByRuv7TnXqfPzL66pJxRrd134lukY4/edit?gid=1365547201#gid=1365547201' });
    });
  }

  const keyfobLink = document.getElementById("keyfobLink");
  if (keyfobLink) {
    keyfobLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://docs.google.com/spreadsheets/d/1aWCOKShQNR0UXByRuv7TnXqfPzL66pJxRrd134lukY4/edit?gid=264458134#gid=264458134' });
    });
  }

  // Các link khác (QUẢN LÝ ĐƠN HÀNG, Tracking SGBAY)
  const otherLinks = document.querySelectorAll('a[id="guideLink"]');
  otherLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: link.href });
    });
  });
});
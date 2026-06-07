# Hướng dẫn tạo & triển khai Google Apps Script

Hệ thống quản lý đơn Etsy: **Google Apps Script** + **Google Sheet** + **Chrome Extension** (`Export Order Etsy`).

---

## 1. Chuẩn bị

| Thứ | Mô tả |
|-----|--------|
| Tài khoản Google | Có quyền sửa Spreadsheet đơn hàng |
| Google Sheet chính | ID trong `1_Config.gs` → `SPREADSHEET_ID` |
| Gemini API Key | (Tùy chọn) Cho menu **LOGO Tools → AI Analyze Logo** |
| Chrome Extension | Thư mục `Export Order Etsy/` |

**Link Sheet quản lý đơn (tham khảo):**  
https://docs.google.com/spreadsheets/d/1aWCOKShQNR0UXByRuv7TnXqfPzL66pJxRrd134lukY4/

---

## 2. Tạo project Apps Script

### Cách A — Gắn với Google Sheet (khuyến nghị)

1. Mở Google Sheet quản lý đơn (link trên).
2. **Extensions** → **Apps Script**.
3. Xóa file mặc định `Code.gs` (nếu có).
4. Thêm từng file `.gs` theo mục 3 bên dưới.

### Cách B — Project độc lập

1. Vào https://script.google.com/
2. **New project**.
3. Thêm file theo mục 3.
4. Bật **Google Sheets API** / **Drive API** khi script yêu cầu quyền lần đầu.

---

## 3. Thêm file code (thứ tự quan trọng)

Trong Apps Script: **+** → **Script** → đặt **đúng tên file** → dán nội dung từ repo.

| # | Tên file | Vai trò |
|---|----------|---------|
| 1 | `1_Config.gs` | Hằng số: Sheet ID, cột Yun, phí, header |
| 2 | `2_Helpers.gs` | Hàm tiện ích chung |
| 3 | `3_Normalize.gs` | Chuẩn hóa country, ZIP, URL |
| 4 | `5_Sheets.gs` | Menu Sheet, clear, ghi đơn, format |
| 5 | `6_Main.gs` | Logic xử lý đơn, `doPost` nhận từ extension |
| 6 | `7_LogoTools.gs` | AI Gemini + công cụ logo |
| 7 | `8_ModelMap.gs` | Nhận diện hãng xe từ SKU |
| 8 | `9_Dashboard.gs` | Dashboard lợi nhuận |
| 9 | `10_API.gs` | API GET cho frontend dashboard |
| 10 | `10_TypeMapping_Auto.gs` | Auto map phôi chìa / TYPE |
| 11 | `11_LogoMapping.gs` | Trích xuất & map logo dập |
| 12 | `12_WebApp.gs` | Entry `doGet` / `doPost` Web App |
| 13 | `13_LogoRules.gs` | Quy tắc logo theo shop |
| 14 | `99_Debug.gs` | Hàm test/debug |

> **Lưu ý:** Không có file `4_*.gs` — đây là cấu trúc gốc của dự án.

### File HTML (Dashboard UI)

1. **+** → **HTML** → đặt tên `Index`.
2. Dán nội dung `Index.html` (nếu có backup).
3. `10_API.gs` + `doGet` phục vụ dashboard qua file này.

---

## 4. Cấu hình Script Properties

1. Apps Script → **Project Settings** (biểu tượng bánh răng).
2. Tab **Script Properties** → **Add script property**:

| Property | Giá trị |
|----------|---------|
| `GEMINI_API_KEY` | API key Google AI (bắt đầu bằng `AIza...`) |

Chỉ cần khi dùng **AI Analyze Logo**. Các chức năng export đơn không bắt buộc key này.

---

## 5. Deploy Web App (bắt buộc cho Extension)

1. Apps Script → **Deploy** → **New deployment**.
2. Loại: **Web app**.
3. Cấu hình:

| Mục | Chọn |
|-----|------|
| Execute as | **Me** (tài khoản của bạn) |
| Who has access | **Anyone** |

4. **Deploy** → copy **Deployment ID** (hoặc URL dạng `.../macros/s/XXXXX/exec`).
5. Mỗi lần sửa code quan trọng (`6_Main`, `12_WebApp`): **Manage deployments** → **Edit** → **New version** → **Deploy**.

Extension Etsy gọi endpoint:

```
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

---

## 6. Cài Chrome Extension

1. Chrome → `chrome://extensions/`
2. Bật **Developer mode**
3. **Load unpacked** → chọn thư mục `Export Order Etsy`
4. Mở popup extension:
   - Dán **Google Apps Script Deployment ID**
   - Chọn shop: **Key Fob** hoặc **Strap**
   - **Save ID**
5. Vào Etsy Orders → **F5** trang → dùng nút export trên thanh tab.

---

## 7. Chạy lần đầu & cấp quyền

1. Trong Sheet: reload trang → menu **Etsy Tools** / **LOGO Tools** xuất hiện (từ `onOpen` trong `5_Sheets.gs`).
2. Chạy thử một hàm bất kỳ hoặc export 1 đơn từ Etsy.
3. Google hỏi quyền → **Review permissions** → chọn tài khoản → **Allow**.

Quyền thường cần: Spreadsheet, Drive (ảnh logo), UrlFetch (Gemini), Web App.

---

## 8. Kiểm tra sau khi deploy

| Kiểm tra | Cách |
|----------|------|
| Web App sống | Mở URL `/exec` trên trình duyệt (có thể trả JSON hoặc lỗi action) |
| Extension | Export thử **New Orders** vài đơn |
| Sheet | Tab **Key Fob Order** / **Strap Watch Order** có dòng mới |
| Logo | Chọn vùng → **LOGO Tools → Trích xuất Logo** |
| Yun | Menu **Force Update YUN Headers** nếu sheet Yun lệch cột |

---

## 9. File tham khảo local (không upload lên Apps Script)

| File | Mục đích |
|------|----------|
| `All Model.txt` | Danh sách hãng/model/trim tra cứu |
| `order.txt` | (Dev) mẫu JSON đơn Etsy — không dùng runtime |

Logic detect xe thực tế nằm trong **`8_ModelMap.gs`**, không đọc file `.txt`.

---

## 10. Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| Extension báo chưa cấu hình Script ID | Chưa Save ID trong popup | Mở popup → nhập ID → Save |
| `ReferenceError: xxx is not defined` | Thiếu file `.gs` hoặc thiếu hàm | Kiểm tra đủ 14 file, đúng tên |
| Deploy cũ | Sửa code nhưng chưa deploy version mới | New deployment version |
| AI Logo không chạy | Thiếu `GEMINI_API_KEY` | Thêm Script Property |
| Menu không hiện | Chưa reload Sheet | F5 Sheet hoặc chạy `onOpen` thủ công |

---

## 11. Cấu trúc luồng dữ liệu

```
Etsy Orders (Chrome)
    → Extension content.js
    → POST JSON (action: addOrders)
    → Web App (12_WebApp / 6_Main)
    → 3_Normalize + 5_Sheets
    → Google Sheet (Key Fob / Strap / Yun / Tracking)
```

---

Made by SangLee — Script Order V2

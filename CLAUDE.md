# CLAUDE.md — Script Order V2

Hệ thống quản lý đơn **Etsy / TikTok Shop** (Key Fob & Strap Watch) chạy trên **Google Apps Script** + **Google Sheet**, kèm **Chrome Extension** để export đơn.

## Tech stack & ràng buộc runtime

- **Google Apps Script (V8)** — không phải Node.js. **Không có** `npm`, `package.json`, build step, bundler hay import/export module. Tất cả file `.gs` chia sẻ **một global scope duy nhất**; hàm/hằng khai báo ở file này gọi được ở file khác mà không cần import.
- Không dùng thư viện ngoài; chỉ các service GAS: `SpreadsheetApp`, `DriveApp`, `UrlFetchApp`, `PropertiesService`, `HtmlService`.
- **Chrome Extension** (`Export Order Etsy/`) là **vanilla JS** (manifest, content.js, popup.js) — không framework, không build.
- Dữ liệu lưu trong Google Sheet, **không có database** riêng.
- Comment và nhãn UI phần lớn bằng **tiếng Việt** — giữ nguyên phong cách này khi sửa.

## Không có bước build / test tự động

Đây là GAS: không chạy `npm test`/`npm run build`. Kiểm thử = chạy hàm trong editor Apps Script hoặc export thử 1 đơn từ extension. Các hàm debug nằm trong `99_Debug.gs`.

## Bản đồ file `.gs` (thứ tự nạp quan trọng — global scope chung)

| File | Vai trò |
|------|---------|
| `1_Config.gs` | Hằng số: `SPREADSHEET_ID`, tên sheet, `YUN_COLS`, phí, header. **Sửa cấu hình ở đây.** |
| `2_Helpers.gs` | Hàm tiện ích chung |
| `3_Normalize.gs` | Chuẩn hóa country / ZIP / URL / địa chỉ |
| `5_Sheets.gs` | `onOpen` (menu Etsy Tools / LOGO Tools), clear, ghi đơn, format sheet |
| `6_Main.gs` | Logic xử lý đơn chính; nhận payload từ extension |
| `7_LogoTools.gs` | Công cụ logo + AI Gemini (cần `GEMINI_API_KEY`) |
| `8_ModelMap.gs` | Nhận diện hãng xe / model / trim từ SKU (**logic thật ở đây, không đọc `All Model.txt`**) |
| `9_Dashboard.gs` | Dashboard lợi nhuận |
| `10_API.gs` | API GET phục vụ frontend dashboard (`Index.html`) |
| `10_TypeMapping_Auto.gs` | Auto map phôi chìa / TYPE |
| `11_LogoMapping.gs` | Trích xuất & map logo dập theo shop |
| `12_WebApp.gs` | Entry Web App: `doGet` / `doPost` |
| `13_LogoRules.gs` | Quy tắc logo theo từng shop |
| `99_Debug.gs` | Hàm test / debug thủ công |
| `Index.html` | UI dashboard (HtmlService) |

> **Không có `4_*.gs`** — đây là cấu trúc gốc, đừng "sửa" bằng cách tạo file 4.

## Luồng dữ liệu

```
Etsy/TikTok Orders (Chrome)
  → Extension content.js  →  POST JSON (action: addOrders)
  → Web App (12_WebApp → 6_Main)
  → 3_Normalize + 8_ModelMap + 11_LogoMapping
  → 5_Sheets ghi vào Google Sheet (Key Fob / Strap / YUNEXPRESS / Tracking)
```

## Cấu hình quan trọng (`1_Config.gs`)

- `SPREADSHEET_ID` — Sheet đơn hàng chính.
- Tên sheet: `SHEET_KEYFOB`, `SHEET_STRAP`, `SHEET_TRACK`, `YUN_SHEET_NAME`, `SHEET_DASHBOARD`…
- `YUN_COLS` — map cột template YunExpress (74 cột). **Nhạy cảm:** Yun đổi template sẽ lệch chỉ số cột; cập nhật object này khi template thay đổi.
- `GEMINI_API_KEY` — đặt trong **Project Settings → Script Properties** (chỉ cần cho AI Analyze Logo).

## Deploy (khi sửa `6_Main` / `12_WebApp`)

1. Apps Script → **Deploy → Manage deployments → Edit → New version → Deploy**.
2. Web app: *Execute as = Me*, *Who has access = Anyone*.
3. Extension gọi: `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`.

Chi tiết đầy đủ: [HUONG_DAN_GOOGLE_APPS_SCRIPT.md](./HUONG_DAN_GOOGLE_APPS_SCRIPT.md). Spec logo: [LOGO_SYSTEM_SPEC.md](./LOGO_SYSTEM_SPEC.md).

## Quy ước khi sửa code

- Giữ tên hàm/hằng global rõ ràng vì mọi file dùng chung scope — tránh trùng tên (đã từng có bug "duplicate declaration").
- Sửa logic nhận diện xe → `8_ModelMap.gs`; sửa map cột Yun → `1_Config.gs`; sửa quy tắc logo theo shop → `13_LogoRules.gs` / `11_LogoMapping.gs`.
- File `.txt` (`All Model.txt`, `order.txt`) chỉ để tham khảo/dev, **không đọc lúc runtime**.
- Cẩn thận với parse text nhiều dòng (personalization) — commit gần đây fix mất data ở format cũ vs mới; kiểm tra cả hai format khi động vào phần này.

---
*Bộ kit `.claude/` đã được tinh gọn cho dự án GAS này (bỏ các skill/agent frontend, mobile, DB, payment, media… không liên quan).*

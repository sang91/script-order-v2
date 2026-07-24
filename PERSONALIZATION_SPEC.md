# Khung cá nhân hóa Keyfob (Etsy) — Spec parser

Tài liệu mô tả cách [6_Main.gs](./6_Main.gs) (`buildProductInfoNewFormat_`) nhận diện các field cá nhân hóa và xuất ra Product Info.

> Parser nhận theo **từ khóa trong nhãn** (không cần tên trùng khớp), nên linh hoạt với việc mỗi shop đặt tên field khác nhau để tránh trùng listing.

## Bảng khung: field → từ khóa → output

| # | Field | Từ khóa nhận (trong label) | Tên shop đã gặp | Output |
|---|-------|---------------------------|-----------------|--------|
| 1 | **Màu chính** | `color`/`colour`/`leather` (trừ `logo`/`stitch`/`edge`/`tag`) | Primary Color, Leather Color | `Màu: <giá trị>` |
| 2 | **Type** | `type` (trừ `cover`) | Key Type | `Type: <mã> - Kín/Khoét` |
| — | **Cover** | `cover` / `button finish` | Style Cover, Choose Cover Style, Choose the Button Finish | ghép vào Type (Full→Kín, Cut Out→Khoét) |
| 3 | **Móc** | `keychain`/`key chain`/`móc` | Keychain Option, Keychain/Hardware | `Móc: <mã K/Key>` |
| — | *Nhãn gộp móc+cover* | keychain + (cover trong label/value) | Keychain + Cover Style, Style & Keychain Option | tách **Móc** + đẩy **Cover** lên Type (2 chiều: `K4 - Full Cover` hoặc `Full Cover - K9`) |
| 4 | **Logo code** | `logo` / `personalization` / `emboss` / `stamp` | Logo Code & Notes, Your Logo & Notes, Custom Back Logo / Other note | `Logo: <mã + note>` |
| 5 | **Màu chỉ/viền/logo** | `stitch` hoặc `edge` | Customize Stitching & Edge Colors, Customize Stitch, Edge & Logo Colors | `Chỉ: X` / `Viền: Y` / `Màu logo: Z` (hoặc `Chỉ + Viền: X`) |
| 6 | **Tag (name dập)** | `tag`/`smart`/`name`/`phone`/`engrav` | Add your name on Smart Tag, Smart Tag Text, Custom Leather Tag | `Tag: <giá trị>` |
| 7 | **Upload ảnh** | `upload`/`photo`/`image`/`file`/`pic` **hoặc** value = `N file(s)` | Upload Your Smart Key, Show Us Your Smart Key, Key Fob Photos | *(bỏ qua)* |

## Thứ tự output cố định (bất kể thứ tự input)

```
SKU → Màu → [Chỉ / Viền / Màu logo] → Type - Cover → Móc → Logo → Tag → (khác)
```

## Quy tắc giá trị đặc biệt

- **Màu chỉ/viền/logo:** quét keyword `stitch/edge/logo` trong value, nhận mọi dấu phân cách `-`, `/`, `,`.
  - VD: `stitch red-edge black-logo red` → `Chỉ: Red` / `Viền: Black` / `Màu logo: Red`.
  - 1 màu trơn (VD `Red`) → `Chỉ + Viền: Red`.
  - `tone on tone` / `match leather` / `same` → bỏ qua (dùng mặc định, không note).
- **Cover:** `Full`/`Covered` → Kín; `Cut Out`/`Exposed` → Khoét.
- **Upload:** nhận cả value dạng `1 file` / `2 files` dù nhãn không có từ "upload".
- **Logo:** nhãn chứa `logo code` / `your logo` / `back logo` → rút gọn thành `Logo:`, **giữ nguyên note** nếu có.

## ⚠️ Rủi ro khi biến tấu tên field

Vì nhận theo **từ khóa**, nếu đặt tên field mới **chứa từ khóa của nhóm khác** sẽ bị phân loại nhầm:

- `Custom Leather Tag` chứa `leather` → suýt thành **Màu** (đã fix bằng loại trừ `tag`).
- Nên tránh: đặt tên upload/tag mà chứa `color`, `logo`, `type`, `cover`, `key`, `stitch`, `edge`…
- Field có tên **không chứa từ khóa nào** → rơi vào "thông tin khác" (cuối output) — không mất data nhưng không rút gọn.

**Mẹo an toàn khi đặt tên biến tấu:** giữ đúng **1 từ khóa nhận diện** của nhóm đó, và tránh từ khóa của nhóm khác.

---
*Made by SangLee — Script Order V2*

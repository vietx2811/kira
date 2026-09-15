# Art direction vòng 3: bốn hướng thẩm mỹ khi đổi sang Tailwind + kit

- **Câu hỏi:** User muốn giao diện "2026 hơn" (tham chiếu Figma UI3), nói rõ thêm Tailwind không phải hạn chế và "đáng ra nên chuẩn từ đầu với shadcn hoặc Untitled UI". So sánh bằng mắt 4 hướng: A. Ink & Paper hiện tại, B. shadcn/ui, C. Untitled UI React, D. Figma UI3 (đo từ figui3), trên cùng 4 màn và đã áp đủ góp ý user chốt 2026-09-16. Chỉ phần thẩm mỹ; đường kỹ thuật migrate do Researcher khác làm song song.
- **Người yêu cầu:** Orchestrator, thread Art Director (2026-09-16). Quyết định cuối thuộc user.
- **Commit đã kiểm chứng:** `53c0dcb` (main lúc bắt đầu, branch `art-director/v3-kit-directions`). Không sửa code app. Nguồn ngoài truy cập 2026-09-16.
- **Cách làm và đo:** specimen HTML một file, Tailwind v4 chạy trong trình duyệt (`@tailwindcss/browser@4.3.3`) cho B và C, CSS viết tay cho A và D. Chụp bằng Chrome headless 1440 x 900 qua server tĩnh cục bộ. Số đo kích thước lấy bằng `getBoundingClientRect` trên trang đang render (Chrome, không phải WKWebView). Contrast đo nhanh: màu chữ và nền tính từ `getComputedStyle` qua canvas (xử lý được `oklch`), ghép alpha và `opacity` tổ tiên, **không** đo trên điểm ảnh.
- **Nhãn:** **[đo]** đo trên specimen đang render, **[nguồn]** đọc mã nguồn kit (kèm commit), **[suy luận]**.

## Sản phẩm

Thư mục [`art-direction/v3/`](art-direction/v3/):
- **Specimen chính:** [`index.html`](art-direction/v3/index.html). Có điều khiển Hướng (A/B/C/D), Màn (1 đến 4), Theme (tối/sáng), Tab panel (Chat/Cần bạn, ở màn 3), Cỡ (100% hoặc vừa khung). Trạng thái nằm trong hash để chụp lại được, ví dụ `#dir=b&screen=3&theme=light&tab=needs`. Thêm `&cap=1` để ẩn khung trang và chỉ còn cửa sổ 1440 x 900.
- Tuân ràng buộc publish: script ngoài chỉ từ `cdn.jsdelivr.net/npm/`, font chỉ Google Fonts (Inter, có fallback hệ thống), ảnh minh hoạ là SVG inline, không fetch runtime, không `localStorage`, không em dash trong copy. Trang không cuộn ngang ở 375px **[đo]**: `scrollWidth` 375, khung 1440 cuộn trong vùng riêng.
- Ảnh so sánh (mỗi ảnh 2x2, thứ tự A B / C D): [`sheet-screen1-dark.jpg`](art-direction/v3/sheet-screen1-dark.jpg), [`sheet-screen2-dark.jpg`](art-direction/v3/sheet-screen2-dark.jpg), [`sheet-screen3-needs-dark.jpg`](art-direction/v3/sheet-screen3-needs-dark.jpg), [`sheet-screen3-chat-light.jpg`](art-direction/v3/sheet-screen3-chat-light.jpg), [`sheet-screen4-dark.jpg`](art-direction/v3/sheet-screen4-dark.jpg). Tổng 1.045.525 byte.

---

## Kết luận ngắn

1. **Không hướng nào dùng nguyên kit mà vẫn là KIRA.** B trông như "lại một app shadcn", C trông như dashboard SaaS và tốn chỗ, D đọc ngay ra là bản sao Figma và bắt teal gánh nghĩa "đang chọn" trên control.
2. **Phát hiện đáng giá nhất:** theme neutral mặc định của shadcn (primary gần đen ở sáng, gần trắng ở tối, không màu brand) **trùng cấu trúc với Ink & Paper**. Đổi sang shadcn gần như không phải bỏ quyết định màu đã chốt.
3. **Mật độ [đo]:** nút chính cao 32 (A), 32 (B), 36 (C), 24px (D); mục menu 28, 28, 38, 24px; chữ control 13, 14, 14, 11px. C quá thưa cho app canvas pro, D chật đến mức chữ tiếng Việt có dấu ở 11px bị dính.
4. **Đề xuất: B lai.** shadcn (style nova, neutral) làm nền kỹ thuật và cấu trúc component; lấy từ UI3 mật độ panel (control 28px, segmented nền phẳng viền 1px trung tính); giữ từ Ink & Paper font hệ thống, primary mực, selected bằng mực, rail sticker và luật không kính.
5. User cần chốt 7 quyết định ở §F trước khi Worker migrate; quan trọng nhất là hướng nền, font, mật độ và trạng thái selected.

---

## A. Nguồn đã đọc cho từng hướng

| Hướng | Nguồn | Phiên bản | Ghi chú |
|---|---|---|---|
| A. Ink & Paper | `DESIGN.md` front matter, `.claude/skills/kira-controls/SKILL.md`, icon rail trích `art-direction/v2/controls-v2.html` S:490-511 | `53c0dcb` | Dựng lại từ token, không đọc `styles.css` |
| B. shadcn/ui | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) `apps/v4/registry/config.ts`, `styles/style-nova.css`, `bases/base/ui/*.tsx`, `themes.ts`; [ui.shadcn.com/docs/theming](https://ui.shadcn.com/docs/theming) | commit `2b3e6d4` (2026-09-12), CLI `shadcn@4.21.0` | **[nguồn]** `DEFAULT_CONFIG`: base `base` (Base UI), style `nova` ("Reduced padding and margins"), theme neutral, icon lucide, font Inter, `--radius: 0.625rem`. Có 8 style (vega, nova, maia, lyra, mira, luma, sera, rhea) và 3 base (radix, base, aria). |
| C. Untitled UI React | [untitleduico/react](https://github.com/untitleduico/react) `styles/theme.css`, `components/base/{buttons,input,select,slider,toggle,tooltip,badges,dropdown}`, `components/application/{tabs,modals,empty-state,app-navigation}`, `components/foundations/featured-icon` | commit `c981a73` (2026-08-26), license MIT | Brand mặc định tím `rgb(127 86 217)`; neutral dùng thang Tailwind; dark qua class `.dark-mode`. |
| D. Figma UI3 | [rogie/figui3](https://github.com/rogie/figui3) `base.css`, `components.css` | commit `d43d65e` (2026-09-15), `@rogieking/figui3` 9.0.10 | **[nguồn]** Core MIT, Editor và Lab là PolyForm Shield (không OSI). Là kit web component cho **plugin** Figma, không có toolbar hay panel của app. |

Icon: B dùng Lucide đúng mặc định kit. C dùng Lucide thay `@untitledui/icons` (cùng kiểu nét 2px). D dùng Lucide nét 1.5 thay bộ icon riêng của Figma. A dùng Lucide cho glyph UI và icon rail vẽ riêng như luật hiện hành.

### Cách giữ "đúng class" khi hai kit trùng tên
B và C cùng dùng `bg-primary`, `text-primary`, `rounded-lg`, `shadow-lg` nhưng khác nghĩa (shadcn: màu nút chính, bo 10px; Untitled: nền trang, bo 8px). Specimen giữ nguyên class trong markup, còn namespace trùng trong `@theme inline` trỏ qua biến `--k-*` do mỗi kit tự đặt trong phạm vi `.kit-b` hoặc `.kit-c`. Rule `cn-*` của `style-nova.css` được chép vào `@layer components` và bỏ các utility animation (`animate-in`, `fade-*`, `zoom-*`, `slide-in-*`) vì cần plugin `tw-animate-css`.

### Tuỳ biến đã làm (phải biết khi đọc ảnh)
- **Brand của C và D đổi sang teal KIRA.** Không app KIRA nào dùng tím hay xanh Figma; giữ nguyên thì so sánh vô nghĩa. C: thang teal `#effaf7` đến `#0a2420`, `brand-600 #1f7667`. D: `#0e7c6b` tối, `#0c7a68` sáng, chọn để chữ trắng trên primary vẫn đạt contrast.
- **B không đổi màu**, chỉ thêm chấm trạng thái amber và emerald vì neutral không có màu cảnh báo.
- **Overlay dialog của B (`backdrop-blur-xs`) và C (`backdrop-blur-[6px]`) giữ nguyên như kit** để user thấy mặc định. Cả hai trái Material-On-Chrome Rule, phải bỏ khi dùng thật.
- **Kích thước toolbar đáy của D (48px, nút 32px) là [suy luận]** từ `size="large"` của figui3, không phải số đo app Figma.
- Nhãn nhóm trong menu của C và lưới ảnh Library của B, C là ghép từ token kit, không có component tương ứng.

---

## B. Góp ý user hiện ra thế nào (giống nhau ở cả 4 hướng)

| Góp ý đã chốt | Nơi thấy trong specimen |
|---|---|
| Header panel 1 dòng nhỏ, không "Thư viện/Library" | Màn 2 và 3: một hàng cao 36 (A), 40 (B, D), 44px (C) **[đo]**, nhãn "Ảnh" hoặc "Kira" cỡ nhỏ cộng số đếm và nút icon |
| Ảnh Library to hơn + slider | Màn 2: lưới 2 cột, ảnh 4:3 rộng 172 đến 177px **[đo]** (app ở `2026-09-15-layout/library-grid-dark.jpg` khoảng 144px, ước từ ảnh chụp 2x), slider cỡ ảnh cố định cạnh List/Grid theo mẫu Eagle, Lightroom (báo cáo Figma UI3 §3) |
| Bỏ thanh Edit/Discover/Arrange | Màn 1: góc trái dưới trống. Menu canvas góc phải có công tắc "Gợi ý liên kết" (Discover cũ), nhóm Sắp xếp (Theo cụm, Theo luồng, Theo màu, Lưới, lấy từ `GraphOrganizeMode` ở `main.tsx:622`) và Hiển thị (Phạm vi, Giới hạn node) |
| View switcher icon-only + tooltip | Màn 1: 4 icon, tooltip "Trình chiếu ⌘3" neo dưới icon thứ ba |
| Cửa sổ nền đục | Mọi màn: thanh tiêu đề, nav, panel, dialog đục. Chỉ plate nổi trên canvas của A còn blur, đúng luật hiện hành |
| Panel dính mép | Library dính trái, Kira dính phải |

Copy lấy từ `UI_STRINGS` (`main.tsx:763` trở đi): "Kira cần một model", "Kết nối model", "Cần bạn", "Chờ duyệt", "Nhận", "Từ chối". Settings giữ tiếng Anh vì app hiện chỉ dịch điều hướng, thư viện và chat (`lang.hint`).

---

## C. Số đo mật độ [đo]

Đo trong specimen, Chrome, theme tối (sai số 0,2px do viewport emulation).

| | A. Ink & Paper | B. shadcn nova | C. Untitled UI | D. figui3 |
|---|---|---|---|---|
| Nút chính (Save key) | 32px, 13px/560, bo 8 | 32px, 14px/500, bo 10 | 36px (size sm), 14px/600, bo 8 | 24px, 11px/500, bo 5 |
| Input | 32 | 32 | 36 | 24 |
| Mục menu | 28, chữ 13 | 28, chữ 14 | 38, chữ 14 | 24, chữ 11 |
| Header panel | 36 | 40 | 44 | 40 |
| Tool trên rail | 44 (sticker 28) | 32 | 32 | 32 |
| Rail cao x rộng | 56 x 405 | 44 x 404 | 44 x 347 | 48 x 373 |

Diễn giải **[suy luận]**: A và B gần như cùng mật độ; C thưa hơn khoảng 20 đến 35% theo chiều cao control; D chặt nhất. Ở 11px, chữ tiếng Việt có dấu chồng (ví dụ "Hiện liên kết yếu, không lưu") trong D bắt đầu dính, nên cỡ 11px của UI3 không chép nguyên được cho nội dung tiếng Việt, dù vẫn đạt sàn `--text-small`.

### Contrast đo nhanh [đo, không phải đo điểm ảnh]

| Cặp | A tối / sáng | B tối / sáng | C tối / sáng | D tối / sáng |
|---|---|---|---|---|
| Chữ nút chính | 16,33 / 14,75 | 14,23 / 17,18 | chưa đo được / 5,46 | 5,10 / 5,25 |
| Chữ nút xoá (Delete profile) | 6,75 / 7,02 | 4,64 / **3,97** | chưa đo được / 4,77 | 7,20 / 4,62 |
| Chữ phụ (1 cần xử lý, mô tả) | 5,92 / 5,25 | 6,94 / 4,54 | 7,66 / 7,81 | 9,50 / 5,74 |
| Trạng thái "Key missing" / "Chờ duyệt" | 9,62 / 4,73 | badge chữ chính | 10,94 / 4,77 | 9,47 / **4,39** |

- Hai ô dưới 4,5:1: **B sáng, chữ destructive 3,97** (`text-destructive` trên nền `destructive/10`); **D sáng, chữ cảnh báo 4,39** (`#b86200` ở 11px).
- C tối cho nút Save key và Delete profile: số đo trả về 18,97 cho mọi ô ở lượt đầu vì Tailwind trong trình duyệt chưa kịp biên dịch class mới; lượt đo lại không lặp ô này. Ghi là chưa đo được, không ghi là đạt.
- Chrome headless khác WKWebView; kết luận cuối phải đo lại trong bundle debug (CLAUDE.md, Verify).

---

## D. Bảng đánh giá

Thang 1 đến 5, 5 là tốt nhất cho KIRA. **[suy luận]** trên ảnh specimen và số đo ở §C.

| Tiêu chí | A. Ink & Paper | B. shadcn/ui | C. Untitled UI | D. Figma UI3 |
|---|---|---|---|---|
| Hợp persona (art director, brand strategist; persona tránh "generic, modern, elegant") | **5**: có tay nghề riêng, sticker rail, mực | 3: sạch nhưng đúng chữ "generic modern" | 2: bóng skeuomorphic, featured icon, badge pill màu: giọng SaaS marketing | 3: đúng khẩu vị pro tool nhưng là khẩu vị của Figma |
| PRODUCT.md anti-references | 5 | 4: overlay blur mặc định vi phạm "glassmorphism-as-decoration" | 3: overlay blur, featured icon và badge màu dễ trượt sang "templated dashboard filler" | 4: menu tối đục, không trang trí |
| Mật độ cho app pro desktop | 4 | 4 | 2 | 5 (nhưng chữ 11px cho tiếng Việt là giới hạn) |
| Bản sắc riêng | **5** | 2: "lại một app shadcn" | 2: nhận ra ngay là Untitled UI | 1: "bản sao Figma" |
| Độ "2026" | 3: chữ hoa đậm, chi tiết thủ công hơi cũ | 4 | 3: phong cách 2023-2024 | **5** |
| Cách góp ý user hiện ra | 5 | 5 | 4: header 44px không còn "nhỏ" | 5 |
| Rủi ro thẩm mỹ khi tuỳ biến | Thấp về hình, **cao về bảo trì** (mọi component tự viết) | Thấp: neutral trùng Ink, đổi token là đủ | Cao: DNA là brand-color primary, đổi sang mực phải sửa hầu hết `colors` trong button, toggle, slider, tab | Cao: selected bằng accent va One Accent Rule, menu luôn tối lệch theme sáng, figui3 không phải React |

### Luật đã chốt bị đụng nếu dùng nguyên kit
- **One Accent Rule** (`DESIGN.md` §3): C tô teal cho primary, toggle, slider, tab gạch chân, check trong select; D tô teal cho tool đang chọn, mục menu hover, switch, slider. B không đụng.
- **Material-On-Chrome Rule** (§6): overlay blur của B và C.
- **One Primary Rule** (§7): cả 4 hướng đạt ở màn 3 và 4 (một primary mỗi view) vì specimen dựng theo luật; kit không tự ngăn được.
- **Selected vẽ bằng mực** (`kira-controls` §2.3): B dùng nền `bg-muted` (trung tính, chấp nhận được); D dùng nền accent; C dùng nền `bg-primary_hover` hoặc gạch màu brand.

### Chấm impeccable nhanh (Nielsen 10 heuristic, 0-4) cho màn 3 và 4

Chấm trên specimen tĩnh, cùng nội dung và luồng, nên các heuristic về luồng (3 kiểm soát, 5 phòng lỗi, 9 phục hồi lỗi, 10 trợ giúp) gần như bằng nhau; chênh lệch nằm ở 1 hiển thị trạng thái, 4 nhất quán, 6 nhận ra thay vì nhớ, 8 thẩm mỹ tối giản. **Không so được với điểm 32-36/40 của vòng 5** (`2026-09-15-design-round5-verdict.md`): màn 4 ở đây rút gọn, không có routing, Tagging, Secrets.

| Heuristic | A3 | B3 | C3 | D3 | A4 | B4 | C4 | D4 |
|---|---|---|---|---|---|---|---|---|
| 1 Hiển thị trạng thái | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 3 |
| 2 Khớp thế giới thật | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 3 Kiểm soát và tự do | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 4 Nhất quán và chuẩn | 3 | 4 | 3 | 3 | 3 | 4 | 3 | 3 |
| 5 Phòng lỗi | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 6 Nhận ra thay vì nhớ | 3 | 3 | 3 | 2 | 3 | 3 | 3 | 3 |
| 7 Linh hoạt, hiệu quả | 3 | 3 | 2 | 3 | 3 | 3 | 2 | 3 |
| 8 Thẩm mỹ tối giản | 4 | 3 | 2 | 3 | 3 | 3 | 2 | 3 |
| 9 Nhận biết và phục hồi lỗi | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 2 |
| 10 Trợ giúp | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 |
| **Tổng** | **30/40** | **30/40** | **27/40** | **28/40** | **30/40** | **30/40** | **29/40** | **29/40** |

Lý do chính của chênh lệch:
- **A3 tốt ở 8:** empty state gọn, sticker Kira tạo điểm neo; composer báo "Chưa kết nối model" bằng chữ.
- **B4 thấp ở 9:** chữ "Delete profile" ở theme sáng 3,97:1, nhãn huỷ hoại khó đọc nhất màn. **D4 thấp ở 9:** "Key missing" 4,39:1 ở 11px.
- **C3 thấp ở 7 và 8:** cùng một mục "Cần bạn", card cao 189px ở C so với 143 (A), 153 (B), 125px (D) **[đo]**, do padding 16px, icon khung 32px và nút 36px; với danh sách nhiều mục, C hiển thị ít mục nhất trên một màn. **C4 cao ở 1:** badge trạng thái màu có viền dễ quét nhất trong 4 hướng.
- **D3 thấp ở 6:** tab "Chat / Cần bạn" không icon, 11px, đứng chung hàng với nút đóng trong header 40px, dễ đọc thành tiêu đề hơn là tab.
- **B4 và B3 cao ở 4:** Tabs, Select, Item, Field của shadcn là mẫu người dùng đã gặp ở nhiều app, đọc ra ngay đâu là control.

---

## E. Đề xuất: B lai, "shadcn làm nền, KIRA làm giọng"

**Nền kỹ thuật và cấu trúc:** shadcn/ui style `nova`, theme neutral. Dùng component, cấu trúc slot và tên token của kit để Worker không phải tự viết Select, Tabs, Menu, Slider, Dialog. Chọn base (Base UI, Radix hay React Aria) là việc của Researcher kỹ thuật; lưu ý báo cáo `2026-09-16-ui-kit-ark-park-magic.md` khuyến nghị Ark UI, shadcn không có base Ark, nên hai khuyến nghị cần hội tụ.

**Lấy từ UI3 (figui3), không lấy màu:**
- Mật độ panel: control mặc định 28px (`size="sm"` của nova là `h-7`), menu 28px, header panel 36 đến 40px. Không xuống 24px vì chữ tiếng Việt.
- Segmented: nền `muted` phẳng, mục đang chọn là nền bề mặt cộng viền 1px trung tính (cách `fig-segmented-control` làm), thay cho bóng `shadow-sm` của tab shadcn.
- Menu và popover đục, bo 12px, không animation zoom.

**Giữ từ Ink & Paper:**
- Font hệ thống SF Pro thay Inter (DESIGN.md §4; Inter chưa bao giờ được nạp trong app).
- Primary mực: neutral của shadcn đã là mực, chỉ chỉnh `--primary` về `#f4f1ea` / `#23211d` để khớp token hiện có.
- Selected bằng mực: `aria-pressed` và `data-active` vẽ gạch 2px hoặc viền 1,5px màu `foreground` thay cho `bg-muted` ở view switcher, tab, tool. Teal chỉ ở selection trên canvas, focus, trạng thái.
- Rail sticker icon và chip mực cho tool đang chọn: đây là bản sắc duy nhất phân biệt KIRA với "một app shadcn".
- Không kính: bỏ `supports-backdrop-filter:backdrop-blur-xs` ở overlay; blur chỉ trên plate nổi trên canvas.
- Danger kiểu tờ giấy chữ đỏ (`control-danger-text`) thay `destructive/10`, vì bản gốc của kit trượt contrast ở theme sáng (§C).

**Không đề xuất:**
- **C** vì DNA là primary màu brand và mật độ marketing; đổi về mực và 28px là viết lại gần hết `colors` và `sizes` của từng component, mất lý do dùng kit.
- **D nguyên bản** vì là bản sao Figma, figui3 là web component cho plugin (không phải React, không có panel app), license tách đôi, và trạng thái chọn bằng accent phá One Accent Rule.
- **A giữ nguyên, viết tay tiếp** không sai về thẩm mỹ nhưng đi ngược ý user về chuẩn hoá bằng kit; bản sắc của A vẫn sống trong hướng B lai.

Muốn xem hướng lai trông thế nào trước khi migrate: vòng sau có thể dựng thêm hướng "B+" trong cùng specimen (một kit mới cạnh A, B, C, D), khoảng nửa ngày, sau khi user chốt §F.

---

## F. Quyết định user cần chốt

1. **Hướng nền:** B lai (khuyến nghị) / A giữ, viết tay tiếp / C / D.
2. **Font:** SF Pro hệ thống như hiện tại (khuyến nghị) hay Inter như mặc định của kit B, C, D.
3. **Mật độ control trong panel:** 28px (khuyến nghị, giữa B và UI3) / 32px (B nguyên bản, A hiện tại) / 24px (UI3).
4. **Trạng thái selected của tab, view switcher, tool:** mực (khuyến nghị, luật hiện hành) / nền xám trung tính kiểu shadcn / nền accent kiểu Figma (phải bỏ One Accent Rule).
5. **Icon rail:** giữ sticker vẽ riêng (khuyến nghị) hay chuyển Lucide đơn sắc cho đồng bộ với kit.
6. **Luật không kính:** giữ, bỏ blur overlay mặc định của kit (khuyến nghị) hay chấp nhận blur nhẹ sau dialog.
7. **Base component của shadcn** (Base UI mặc định mới, Radix, hay React Aria) cân nhắc cùng khuyến nghị Ark UI: chờ báo cáo kỹ thuật song song, nhưng user nên biết đây là điểm hai báo cáo đang chưa khớp.

---

## G. Giới hạn của báo cáo

- Specimen tĩnh: không có hover, focus, animation thật; trạng thái hover và mở chỉ vẽ một khung.
- Chưa đo trong WKWebView hay bundle Tauri; mọi số contrast là đo nhanh qua màu tính toán, chưa đo điểm ảnh.
- Tailwind trong trình duyệt biên dịch bất đồng bộ; lần render đầu của một màn có thể chớp không style trong vài trăm ms. Không ảnh hưởng khi xem, nhưng là lý do có ô "chưa đo được" ở §C.
- Không mở ảnh chụp app Figma thật; hướng D dựa trên figui3 như brief yêu cầu, và figui3 không bao phủ toolbar hay panel app.
- Không kiểm các component trả phí của Untitled UI PRO; chỉ phần mã nguồn mở MIT.

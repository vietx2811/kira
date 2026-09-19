# Audit ô nhập: focus, viền, hover (2026-09-20)

- **Yêu cầu (user, qua Orchestrator):** nhiều input/textbox lỗi; khi chọn textbox có border dày và xấu; bỏ các định dạng hover/focus custom không cần thiết; kiểm bằng browser, không chỉ đọc code.
- **Commit gốc:** `4150a5e` (main lúc bắt đầu; `6eaacfa` chỉ khác `CLAUDE.md`). Trước = server vite chạy đúng `4150a5e` ở worktree tách riêng (cổng 5211), sau = worktree `uiux/input-focus` (cổng 5210). Hai server chạy song song, cùng script, cùng dữ liệu.
- **Cách đo:** Chrome headless điều khiển qua CDP, **click chuột thật** vào ô văn bản (`Input.dispatchMouseEvent`, `:focus-visible` = true) và **bàn phím** (một phím Shift để đặt modality bàn phím rồi `.focus()`) cho select, checkbox, nút. Mỗi control: ghi mọi vòng nhìn thấy (outline, ring, viền) của phần tử và 5 tổ tiên **trước** và **sau** khi focus, lấy hiệu; tính contrast của từng tín hiệu với nền dưới nó. Kiểm dark + light, accent Cyan + Rose (bộ đủ 14 màn ở dark/Cyan; bộ 6 màn chính ở 3 tổ hợp còn lại). 312 lần đo mỗi bên. Script: [`input-audit/tools/`](input-audit/tools/audit2.mjs).
- **Nhãn:** **[đo]** đo từ trang đang chạy, **[code]** đọc `styles.css` / `globals.css` ở `4150a5e`.

## Nguyên nhân gốc: 4 lớp chồng nhau

| # | Lớp | Bằng chứng | Hậu quả |
|---|---|---|---|
| 1 | Rule toàn cục `:focus-visible { outline: 2px solid accent }` (`styles.css:14`) nằm ngoài mọi layer nên **thắng** `outline-hidden` (trong layer utilities) của kit | [đo] Settings > AI Providers > Name, click chuột: `<input>` `outline: 2px solid rgb(127,200,183) offset 2px` **và** wrapper `box-shadow: rgb(127,200,183) 0 0 0 2px inset` | Hai vòng teal lồng nhau, dải dày khoảng 6px: "border dày và xấu" |
| 2 | Preflight của Tailwind tắt (`globals.css`), kit không đặt `border` trên `<input>` | [đo] `<input>` kit có `border: 2px rgb(133,133,133)` mặc định của trình duyệt (kiểu lõm) ngay cả khi **chưa focus** | Khung nổi bevel bên trong ring của kit, thấy rõ ở Name/Author/Model/API key |
| 3 | Rule trần `select, textarea, .title-input { border: 1px solid var(--field-edge); background; min-height: 92px; padding: 12px }` (`styles.css`, ~7362) | [đo] mọi `<textarea>` kit có `border 1px rgba(255,255,255,.4)`, `min-height 92px`, `padding 12px` cạnh ring của kit | Khung đôi, ô cao gấp đôi cần thiết (Description, Style note, Notes, link note). `.title-input`, `.note-input` **không còn dùng ở đâu** trong TSX |
| 4 | `.link-popover` là `display: grid` không khai cột | [đo] select, ô ghi chú, slider rộng **555px** trong thẻ 220px, bị cắt; bấm phần thấy được thì ổn nhưng phần lớn ô nằm ngoài | Ô ghi chú và select của link popover hỏng thật (xem ảnh) |

## Bảng theo màn

Trước/sau: số **tín hiệu focus** nhìn thấy trên control (đúng = 1, tối thiểu 3:1). "Kit" = có `data-rac`, "raw" = tự viết.

| Màn | Control | Loại | Trước | Sau | Ảnh |
|---|---|---|---|---|---|
| Settings > AI Providers | Name, Model, API key | kit Input | khung lõm UA + **2 vòng** focus | 1 ring 2px, 10,2:1 | [dark](input-audit/settings-name-focus-dark.png) [light](input-audit/settings-name-focus-light.png) |
| Settings > General | Routing, Remote | kit Select | **2** (outline + ring) | 1 | |
| Settings (mọi tab) | cả dialog | kit Modal | **vòng teal quanh cả dialog** lúc mở | không vòng | |
| Project settings | Name, Author | kit Input | khung lõm UA + **2** | 1 | |
| Project settings | Description, Style note | kit TextArea | viền 40% trắng + ring + **2** focus, cao 92px | 1 ring, min-height về mặc định kit | [dark](input-audit/project-settings-textarea-focus-dark.png) [light](input-audit/project-settings-textarea-focus-light.png) |
| Project settings | Kind | kit Select | **2** | 1 | |
| Node details | Notes | kit TextArea | viền đôi + **2** | 1 | |
| Node details | Source URL | kit Input | khung lõm UA + **2** | 1 | |
| Node details | Tag "Add" | raw `<input>` | **không nhìn thấy ô** (nền trong suốt, `outline: none`) | pill có nền + outline 2px, 8,95:1 | [dark](input-audit/tag-input-focus-dark.png) |
| Node details | Mô tả (rich editor) | raw contenteditable | không tín hiệu, chỉ có caret | **không đổi** (xem ngoại lệ) | |
| Library | Ô tìm | kit Input | khung lõm UA + **2** | 1 | |
| Onboarding / canvas rỗng | "Describe a board" | kit InputBase | khung lõm UA + **2** | 1 | |
| Canvas | Tên frame | kit InputBase | khung lõm UA + **2** | 1 | |
| Link popover | Relation, Note, Confidence | kit Select/TextArea/Slider | **rộng 555px trong thẻ 220px, bị cắt**, Note có viền đôi | vừa thẻ, 1 ring | [trước](input-audit/link-popover-before.png) [sau](input-audit/link-popover-after.png) |
| Kira dock | Ô nhập | raw textarea | 1 tín hiệu nhưng **1,35:1** (viền `--border-strong`) | viền `--field-edge` **3,74:1** | [dark](input-audit/kira-dock-focus-dark.png) [light](input-audit/kira-dock-focus-light.png) |
| Kira dock | Nút trong dock | raw button | outline + viền dock đổi = **2** | 1 | |
| Kira panel | Composer chat | raw textarea | **không có tín hiệu** (viền cố định `--field-edge`, `outline: none`) | viền ink `--text-main`, 17,4:1 | [dark](input-audit/kira-composer-focus-dark.png) [light](input-audit/kira-composer-focus-light.png) |
| Slides | Deck template, Slide layout | kit Select | **2** | 1 | |
| Mọi màn | Checkbox, radio | kit | 1 (kit và fallback vẽ cùng một outline) | 1 | |

Số gộp [đo], 312 lần đo mỗi bên (dark/light × Cyan/Rose):

| Nhóm | Trước: 1 tín hiệu / 2+ / 0 | Sau: 1 tín hiệu / 2+ / 0 |
|---|---|---|
| kit Input (text, password, search) | 0 / 44 / 0 | **44 / 0 / 0** |
| kit TextArea | 0 / 17 / 5 | **22 / 0 / 0** |
| kit Select / nút | 0 / 9 / 0 | **9 / 0 / 0** |
| raw nút trong dock | 0 / 10 / 0 | **10 / 0 / 0** |
| kit checkbox | 190 / 0 / 0 | 190 / 0 / 0 |
| dialog Settings lúc mở | 6 lần có vòng | **0** |
| contrast thấp nhất của tín hiệu focus | 1,35:1 (dock) | **3,74:1** (dock), 7,47:1 (kit) |

## Đã sửa

- **`styles.css:14`**: rule toàn cục thành `:focus-visible:not(:where([data-rac]))`. Độ đặc hiệu giữ nguyên (0,1,0) nhờ `:where()`, nên mọi rule `:focus-visible` cụ thể phía sau vẫn thắng như cũ. Vẫn phục vụ đúng nhóm control tự viết, không xoá rule.
- **`globals.css` (`@layer base`)**: `input[data-rac]` (trừ checkbox, radio, range) và `textarea[data-rac]` đặt `border: 0`, thay cho phần preflight đang tắt.
- **Xoá** rule trần `select, textarea, .title-input`, `select`, `.title-input`, `textarea`, `.note-input`, hai rule `.project-settings-popover .title-input/.note-input`, và `.title-input/.note-input:focus(-visible)`: tất cả chết hoặc chỉ gây khung thứ hai. `.composer-input` được thêm `width: 100%` (nó dựa vào rule trần).
- **Raw không có tín hiệu**: `.tag-chip-input` thành pill có nền và dùng outline fallback (bỏ `outline: none`); `.composer:focus-within` viền `--text-main`; `.kira-dock.is-open:has(.kira-dock-input:focus)` viền `--field-edge` (đổi từ `:focus-within` để nút trong dock không kéo theo viền thứ hai).
- **Link popover**: `grid-template-columns: minmax(0, 1fr)`, `span { min-width: 0 }`, và `span:nth-of-type(2)` thay `:last-child` (nút đổi chiều nằm sau tiêu đề đích nên `:last-child` chưa từng khớp).
- **DESIGN.md §7**: thêm luật "một control, một tín hiệu focus" và "da của ô nhập thuộc về kit".

## Hover custom (việc 3)

Đo bằng cách hover chuột thật, rồi **xoá tạm** rule hover khỏi stylesheet trong trang và hover lại, so `background`, `color`, `transform`, `box-shadow`, `border`:

| Rule | Nút (kit) | Kit một mình | Kết luận |
|---|---|---|---|
| `.onboarding-primary-cta:hover` | Button | không đổi nền, không nhấc | **giữ**: nhấc 1px, nền `--control-sheet-hover`, bóng giấy là hover Ink & Paper, kit không có |
| `.onboarding-link-row:hover` | Button | không đổi | **giữ** (kit không có hover ở đây) |
| `.kira-dock-close-btn:hover` | Button | không đổi | **giữ** |
| `.node-toolbar button.is-danger:hover` | Button | nền xám trung tính | **giữ**: tint danger mang nghĩa xoá |
| `.kira-dock-submit:hover` | Button | không đo được (nút đang disabled khi ô trống) | giữ, chưa kết luận |
| `.graph3d-hud-button:hover` | Button | không đo được trong 3D headless | giữ, chưa kết luận |
| `.slide-customizer-reset:hover` | Button | phần tử không hiện trong kịch bản | giữ, chưa kết luận |

Không có ô nhập nào còn rule hover thủ công: hover của ô nhập kit là của kit. Phần "format custom" gây lỗi thật nằm ở focus và da của ô (bảng nguyên nhân), đã gỡ ở trên.

## Ngoại lệ và tồn đọng

1. **Rich editor mô tả node** (`.node-rich-editor-content`, 7 lần đo): 0 tín hiệu focus. Đây là quyết định sản phẩm có sẵn trong `styles.css` ("Notion shows zero chrome, just the caret", user từng yêu cầu bỏ hộp quanh đoạn văn). **Không đổi**; nếu muốn theo đúng luật 3:1 thì cần user chốt lại.
2. **Nút mở "Provider type" (Settings > AI Providers)** không focus được trong Chrome headless (nằm trong `<details>` đang đóng); chưa đo trên tổ hợp mở. Không có lý do nghi ngờ khác với các Select kit còn lại.
3. **3 hover chưa kết luận** (bảng trên) cần mở đúng trạng thái để đo; chưa xoá gì.
4. **Chưa đo trong app native**: Chrome headless, không phải WKWebView. `:has()` và `:where()` đều có trong WKWebView hiện hành, nhưng chưa xác nhận bằng bundle debug.
5. Accent đo: Cyan và Rose. Amber/Sage/Violet dùng cùng công thức token nên không nghi ngờ, chưa đo.

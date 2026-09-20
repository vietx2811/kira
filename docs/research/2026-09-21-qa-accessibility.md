# QA Accessibility — bàn phím & trình đọc màn hình

Commit đo: `51f2fc261370b0703ad8063c1cac83f7e40dd76f` (2026-09-21), working tree sạch.
Đo trên dev server `apps/desktop` port 5231, viewport 1440×900, dark mode, fixture mặc định (6 ảnh, 9 node).

**Cách đo:** Chrome headless + CDP `Input.dispatchKeyEvent` cho phần quét diện rộng, và Browser pane hiển thị thật cho mọi kết luận về focus. Mọi phát hiện P0/P1 dưới đây đều đã kiểm lại bằng **phím thật trong trình duyệt hiển thị**, kèm `el.matches(':focus-visible')` và ảnh chụp.

---

## 1. Đã làm

Đi hết app bằng bàn phím (Tab, Shift+Tab, mũi tên, Enter, Space, Escape), đọc cây accessibility, và đo `prefers-reduced-motion`. Vòng Tab đầy đủ trên màn mặc định là **108 điểm dừng**, có wrap.

### P0 — chặn người dùng bàn phím

**1. Canvas có 27 điểm dừng Tab vô hình.** Mỗi node mang 3 control (`Open … node actions`, `Ask Kira about …`, `Link …`). Cả 27 đều:
- `opacity: 0` (effective opacity đo được = **0**), nhưng `tabindex="0"` → vẫn nằm trong vòng Tab
- 16×16 px (dưới ngưỡng 24×24 của WCAG 2.5.8)
- outline `2px solid rgb(127,200,183)` **có được vẽ**, `:focus-visible` = true, nhưng vẽ trên phần tử opacity 0 → không nhìn thấy gì (ảnh `E2`)
- **Enter và Space đều không kích hoạt** — đây là `<span role="button">` chỉ có `onClick`, không có `onKeyDown`
- 9 control `Link …` còn có `pointer-events: none`, tức chuột cũng không bấm được, nhưng vẫn focus được

Hệ quả: người dùng bàn phím Tab qua canvas thì focus biến mất trong 27 lần nhấn liên tiếp, và không control nào trong đó dùng được.

**2. Ba view 3D / Slides / Outline không tới được bằng bàn phím.** Radiogroup `View`:

| radio | tabindex | React props |
|---|---|---|
| Canvas | `0` | `onClick` |
| 3D | `-1` | `onClick` |
| Slides | `-1` | `onClick` |
| Outline | `-1` | `onClick` |

Không radio nào có `onKeyDown`. Tab bỏ qua ba cái sau (tabindex -1), và mũi tên không làm gì: nhấn ArrowRight thật 3 lần, focus vẫn ở `Canvas`, `aria-checked` vẫn `true`. Markup hứa hẹn roving tabindex nhưng thiếu hẳn phần xử lý phím. Dàn ý và Trình chiếu chỉ mở được bằng chuột.

*(Bản thân hai màn Outline và Slides, khi mở bằng chuột, thì sạch: 0 control thiếu nhãn, 0 control vô hình mà focus được.)*

**3. Onboarding lần đầu là modal giả.** `main.tsx:7151` là `<div className="onboarding-backdrop" role="dialog" aria-modal="true">` tự viết tay, không dùng `ModalOverlay/Modal/Dialog` của kit:
- `document.activeElement` khi mở = **`body`**, không có autofocus
- phải nhấn Tab **103 lần** mới tới control đầu tiên bên trong dialog
- 102 điểm dừng trước đó nằm **sau lớp backdrop mờ đục**: `elementFromPoint` tại tâm phần tử focus trả về `onboarding-backdrop`, tức người dùng không thấy gì (ảnh `E1`)
- **Escape không đóng** dialog

Đây là màn đầu tiên người dùng mới gặp. Phần còn lại của app dùng đúng kit (`ModalOverlay` cho confirm đóng file, crop, xoá, version history) nên trap hoạt động tốt; chỉ onboarding và node details popover (`main.tsx:8866`, cùng kiểu tự viết) lệch chuẩn.

### P1 — dùng được bằng chuột nhưng sai với trình đọc màn hình

**4. Menu chuột phải chỉ mở được bằng chuột.** 5 overlay `role="menu"` (`main.tsx:10439, 10462, 10517, 10552, 10575`) chỉ mở từ `React.MouseEvent`; không có đường Shift+F10 hay phím ContextMenu (grep 0 kết quả). Container không có `onKeyDown`, không roving `tabIndex`, không arrow-key handling, nên `role=menu`/`role=menuitem` hứa hành vi APG mà không có. Escape **có** đóng menu (handler chung ở `main.tsx:8034`).

**5. Ô nhập của Kira bị gán nhãn "Send".** `KiraChatThreadView.tsx:219`: `ComposerPrimitive.Input` và `ComposerPrimitive.Send` dùng chung `aria-label={t('kira.panel.send')}`. Trình đọc màn hình đọc ô soạn tin là "Send, edit text" — nghe như một cái nút.

**6. Thanh trượt cỡ thumbnail không có tên, và đọc sai giá trị.**
- `aria-labelledby` trỏ tới một `<label>` **rỗng** → accessible name = chuỗi rỗng
- `aria-valuetext` = **"6,000%"** cho `value=60` trên thang 0–100 → trình đọc màn hình đọc "6.000 phần trăm" thay vì "60 phần trăm"

**7. Nhãn node và edge quá dài.** 12 `aria-label` vượt 60 ký tự; dài nhất 98 ký tự: `"Open A system where visual fragments behave like evidence around a half-formed thesis. node actions"`. Trình đọc màn hình phải đọc hết thân node trước khi tới phần cho biết nút làm gì.

### P2 — giảm chuyển động

**8. `prefers-reduced-motion: reduce` gần như không có tác dụng.** Đếm phần tử **đang hiển thị** có transition/animation làm **dịch chuyển** (transform/translate/scale/rotate/left/width, hoặc keyframe):

| | bình thường | reduce |
|---|---|---|
| phần tử còn chuyển động | 102 | **89** |

Chỉ 13 phần tử bị chặn. Xác nhận nghi ngờ của user, và rộng hơn một chút: `styles.css` có **6** khối `prefers-reduced-motion` (không phải 4), nhưng `src/styles/uikit/` và `src/components/` có **0** dòng.

Cụ thể cái gì còn chạy dưới `reduce`:

| Thuộc về | Selector | Chuyển động |
|---|---|---|
| **Kit (`data-rac`), 25 phần tử** | `group…` (Button), `group/button-group`, `z-10…` (Tab), `relative…` (Select) | `transform, translate, scale, rotate @0.1s` |
| KIRA tự viết | `node-add-control` ×9, `node-kira-control` ×9, `node-link-handle` ×9 | `transform @0.12s` |
| | `image-node` ×6, `idea-node` ×3 | `transform @0.16s` |
| | `edge-joint` ×5 | `transform @0.14s` |
| | `file-tab` | `animation: fileTabIn 0.2s` |
| | `file-tab-dirty` | `animation: dirtyDotIn 0.16s` |
| | `inbox` (drawer Library) | `transform @0.2s` |
| | `content-region` | `left @0.2s` |
| | `canvas-notice` | `transform @0.16s` |

6 khối hiện có chỉ phủ `.icon-button/.quiet-button/.primary-button/.secondary-button/.danger-button`, `.canvas-tool-rail`, `.canvas-zoom-rail`, `.segmented-thumb`, `.kira-mark`, `.app-splash-symbol`.

### P3 — nhỏ

**9. Danh sách Library tốn 5 điểm dừng mỗi hàng** (checkbox + hàng + 3 tag) → 30 điểm dừng để đi qua 6 ảnh. Riêng `div[role=listbox].image-list` có focus ring đo được **2.48:1**, **dưới ngưỡng 3:1** của DESIGN.md §7 — đây là control duy nhất trượt ngưỡng.

**10. Thiếu landmark và heading.** `<main>` không có nhãn; `<aside class="inbox panel library-drawer-panel">` (37 control) không có nhãn; trang không có `h1` nào, heading cao nhất là `h2`.

**11. Kích thước đích.** 27 control canvas ở 16×16 và ~29 chip/tag dưới 24×24 (WCAG 2.5.8 AA).

### Phần đạt

- **Độ tương phản focus ring: đạt.** Đo trên toàn bộ vòng 108 điểm dừng, mọi control trừ mục 9 nằm trong khoảng **8.20 – 10.78:1**, vượt xa ngưỡng 3:1. Luật "một control, một tín hiệu focus" của DESIGN.md §7 giữ được.
- **Phủ nhãn tốt:** 111/112 control trên màn mặc định có accessible name (cái còn thiếu là mục 6). Outline và Slides: 0 thiếu nhãn.
- **Canvas không vô hình với trình đọc màn hình:** node là `div[role=button][tabindex=0]` có `aria-label` đầy đủ, edge cũng có (`"Select supports relation"`), 9 nhóm `role=group` có nhãn (`"Tags for brushed altar object"`).
- **Không lẫn Anh/Việt:** 0/106 `aria-label` chứa dấu tiếng Việt, `<html lang="en">` khớp với UI đang hiển thị.
- **Dialog của kit chuẩn:** Settings giữ trap (0 lần thoát trong 40 Tab), Escape đóng và trả focus về nút mở, tablist chạy đúng roving tabindex + mũi tên (General → Capture → AI Providers → Advanced, có wrap).

---

## 2. Vấn đề phát hiện / tồn đọng

### ĐÍNH CHÍNH (2026-09-21, sau khi Orchestrator A/B theo commit)

**Kết luận "artifact" dưới đây của tôi là SAI.** Orchestrator chạy cùng script, cùng browser pane, cùng trạng thái pane ẩn, trên hai commit:

| Commit | Focus vào dialog | Sau đó |
|---|---|---|
| `4093015` (lúc Orchestrator đo) | 77ms | **mất ở 564ms**, `activeElement` rơi về `body` |
| `56ad91e` trở đi (lúc tôi đo) | 87ms | **ở lại**, `activeElement` là SECTION |

**Lỗi có thật ở `4093015`.** Vòng sửa ô nhập của UI/UX (`8cb7d08`, merge thành `56ad91e`) đã vá nó như tác dụng phụ ngoài ý muốn. Không ai đo sai: code đã đổi giữa hai lần đo.

Sai lầm của tôi: tôi tìm ra một artifact headless **có thật ở commit hiện tại**, rồi dùng nó để bác một phát hiện đo ở **commit khác**, mà không A/B theo commit. CLAUDE.md §Verify điểm 1 đã nói đúng việc phải làm — "kiểm chứng phát hiện trên commit SHA lúc phát hiện, không phải working tree" — và tôi đã không áp dụng. Nếu Orchestrator không A/B lại thì một phát hiện thật đã bị xoá khỏi hồ sơ.

Hai chuyện đều đúng và tôi đã trộn chúng làm một:
1. Triệu chứng trong brief là **lỗi thật** ở `4093015`, nay đã hết.
2. Headless **riêng nó** cũng tạo ra lỗi giả ở commit hiện tại (mục dưới), nên vẫn không nên dùng headless để kết luận về focus.

Phần dưới giữ nguyên làm hồ sơ về (2), nhưng **mọi câu suy ra rằng số liệu trong brief là artifact đều bị bác bởi bảng A/B trên**.

### Hai dấu hiệu trong brief không tái hiện ở commit hiện tại

**Settings dialog:** đo ở 1440×900, cả bằng chuột thật lẫn bàn phím thật, trong cả headless lẫn trình duyệt hiển thị. Focus vào dialog ở **177ms** và **ở lại**. Log sự kiện: `53ms focusin BUTTON` → `176ms focusout BUTTON` → `177ms focusin SECTION` (trong `[role=dialog]`). Không có `blur()` nào sau đó. `document.activeElement` không bao giờ là `body`.

**Select popover:** với **phím thật trong trình duyệt hiển thị**, Enter mở popover, focus vào option, mũi tên đi đủ 3 option (Home/End đúng), Enter chọn xong thì popover **đóng**, `aria-expanded` = `false`, focus **quay về trigger** với `:focus-visible` = true.

Tôi tái hiện được đúng triệu chứng trong brief đúng hai lần, và cả hai đều là artifact:
1. **Trong Chrome headless**, chọn option bằng Enter để lại `aria-expanded=true`, popover còn mở, focus rơi về `body`. Không tái hiện trong trình duyệt hiển thị. (Đã loại trừ giả thuyết animation bị treo: `animationend` vẫn fire trong headless, và `Page.bringToFront` + `document.hasFocus()=true` cũng không đổi kết quả.)
2. **Khi viewport âm thầm tụt về 756×469** — device metrics override bị xoá giữa các kết nối CDP — nút "Open Settings" bị đẩy ra ngoài viewport, click trượt hoàn toàn, dialog không mở, nên `activeElement` ở nguyên `body`.

~~Con số 99ms/395ms/1,0–2,5s trong brief có hình dạng rất giống trường hợp 1.~~ **Suy luận này sai, xem phần Đính chính ở trên:** số liệu đó đo ở `4093015` và là lỗi thật, chỉ trùng hình dạng với artifact headless.

Phần vẫn đúng và đã được Orchestrator ghi vào `CLAUDE.md` (`b03b0d9`): **không dùng headless cho bất kỳ khẳng định nào về focus** — nó sai ở cả focus restore lẫn viewport, và đã tạo ra 2 báo cáo giả trong phiên này. Kèm luật thứ hai, quan trọng hơn với chính tôi: **phép đo sau mâu thuẫn phép đo trước thì A/B theo commit trước khi gọi cái cũ là artifact.**

Tôi cũng suýt báo nhầm một lỗi thứ ba: ring focus của "Routing"/"Remote" lúc đo có lúc = 0. Tắt transition rồi đo lại thì cả hai đều 10.78:1 — đúng gotcha #3 trong CLAUDE.md.

### Chưa làm

**VoiceOver (việc 3): không chạy.** `scripts/screen-ready.sh` trả exit 0 nên màn hình sẵn sàng, nhưng VoiceOver **chưa bật** trên máy và tôi chủ động không bật. Bật VoiceOver sẽ chiếm toàn bộ bàn phím và phát âm thanh trên máy user đang dùng — lúc đo có session khác đang chạy test Rust trong worktree. Đây là quyết định của tôi, không phải giới hạn kỹ thuật: nếu user muốn, tôi chạy được trong một lượt riêng khi máy rảnh.

Thay vào đó tôi đọc trực tiếp cây accessibility của trình duyệt (role, accessible name, `aria-expanded`/`aria-checked`/`aria-selected`, `aria-valuetext`) — cùng nguồn dữ liệu mà VoiceOver ánh xạ sang AXAPI. Các mục 5, 6, 7 đều là phát hiện cấp trình đọc màn hình lấy từ đó. Phần chưa phủ được nếu không có VoiceOver thật: thứ tự đọc thực tế, live region khi Kira trả lời, và hành vi con trỏ VO trên canvas.

**App native chưa kiểm.** `/Applications/KIRA.app` build ngày 2026-08-26, cũ gần một tháng so với `main` (2026-09-21), nên theo CLAUDE.md không dùng để kiểm. Mọi số liệu trên là từ browser.

**GIỚI HẠN QUAN TRỌNG — kết quả Escape có thể không đúng với app native.** Orchestrator báo (2026-09-21) một session khác đã xác nhận **Escape không có tác dụng trong app native**: menu chuột phải và dialog Settings đều không đóng, trong khi `Cmd+-` ở cùng hàm xử lý vẫn chạy. Trên browser Escape chạy bình thường, nên **ba kết luận "đạt" dưới đây chỉ đúng cho browser và cần đo lại trên app thật**:

- mục 4: "Escape **có** đóng menu chuột phải"
- phần Đạt: "Settings … Escape đóng và trả focus về nút mở"
- mục 3: "Escape không đóng onboarding" — trên native có thể còn hỏng theo cách khác

**Một dữ kiện tĩnh có thể giúp session kia khoanh vùng** (đọc code, không cần quyền gì): nhánh Escape và nhánh `Cmd+-` nằm trong **cùng một hàm `handleCanvasKeydown`**, đăng ký trên **cùng một listener** `window.addEventListener('keydown', …)` tại `main.tsx:8086`. Nhánh Escape đầu tiên (`main.tsx:8034`, đóng context menu) chạy **trước** guard `isEditableEventTarget` ở dòng 8038, nên guard đó không thể là nguyên nhân.

Nghĩa là: nếu `Cmd+-` chạy mà Escape không, thì **không phải** do listener chưa đăng ký, cũng **không phải** do editable guard. Khả năng còn lại là sự kiện keydown của Escape **không bao giờ tới `window`** trong app native, tức bị macOS/WKWebView nuốt ở tầng trên (responder chain `cancelOperation:`, hoặc một key equivalent trong native menu). Đây là **giả thuyết suy từ code, tôi chưa đo được trên native** — session có quyền vào app nên kiểm bằng cách gắn `window.addEventListener('keydown', e => console.log(e.key), true)` trong Web Inspector của bản debug rồi nhấn Escape: nếu không log gì thì đúng là bị nuốt ở tầng native.

**Chưa kiểm:** node details popover (`main.tsx:8866`) — tôi xác nhận được nó là `role="dialog" aria-modal="true"` tự viết tay giống onboarding, nhưng chưa mở được nó bằng bàn phím để đo trap/Escape, đúng vì mục 1: control mở nó không kích hoạt bằng Enter/Space. Nhiều khả năng cùng lỗi với onboarding nhưng **tôi chưa đo, không khẳng định**.

**Còn chạy:** dev server vite port 5231 và Chrome headless port 9344. Nói một tiếng là tôi dọn.

---

## 3. Đề xuất

**Sửa trước (một nhánh, đều nhỏ và độc lập):**

1. **Mục 1** là lỗi nặng nhất và rẻ nhất: cho 27 control canvas `opacity: 1` khi `:focus-visible` (hoặc `:focus-within` trên node), và đổi `<span role="button">` thành `<button>` thật để Enter/Space chạy. Sửa luôn `pointer-events: none` trên 9 control `Link …`. Nếu quyết định giữ chúng ngoài tầm bàn phím thì phải `tabindex="-1"`, đừng để nửa vời.
2. **Mục 2**: thêm `onKeyDown` xử lý mũi tên cho radiogroup `View` — hoặc thay bằng `RadioGroup` của kit để khỏi tự viết lại roving tabindex.
3. **Mục 3**: chuyển onboarding sang `ModalOverlay/Modal/Dialog` của kit như phần còn lại của app. Trap, autofocus và Escape đến kèm miễn phí, và xoá luôn được đoạn backdrop tự viết.
4. **Mục 5, 6**: hai lỗi nhãn một dòng.

**Cần user chốt:**

- **Mục 8 (reduced motion).** Kit là 25 phần tử với `transform @0.1s` — một khối `@media (prefers-reduced-motion: reduce)` trong `src/styles/uikit/` phủ `[data-rac]` là xong cả 25. Nhưng DESIGN.md §7 hiện nói "removes the transitions" cho control, trong khi 133 phần tử còn transition **màu** (0.1–0.16s) mà theo thông lệ reduced-motion là được phép. **Đề nghị user chốt: chỉ chặn chuyển động (transform/animation), hay chặn cả transition màu?** Tôi nghiêng về phương án đầu, và sửa lại câu chữ DESIGN.md §7 cho khớp.
- **Mục 4 (menu chuột phải).** Thêm Shift+F10 + điều hướng mũi tên là việc thật, không nhỏ. Cách rẻ hơn: bỏ `role="menu"`/`role="menuitem"`, để chúng là nhóm button thường — markup sẽ trung thực với hành vi thật thay vì hứa APG. Việc này phụ thuộc user có coi menu chuột phải là đường thao tác chính hay chỉ là lối tắt.
- **Mục 9 (Library 5 stop/hàng).** Gom lại thành listbox đúng chuẩn (1 stop + mũi tên) là thay đổi tương tác, cần UI/UX xem chứ không phải QA quyết.

**Về quy trình:** đề nghị thêm vào mục Verify của CLAUDE.md một dòng: *khẳng định về focus phải đo trong trình duyệt hiển thị với phím thật, không dùng headless* — headless cho kết quả sai ở cả focus restore lẫn viewport, và lần này nó đã tạo ra hai báo cáo lỗi giả.

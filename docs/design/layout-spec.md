# Đặc tả bố cục từng surface

- **Câu hỏi:** user đặt mục tiêu "hoàn thiện toàn bộ giao diện thật thẩm mỹ, cấp độ Figma; mọi component sắp xếp gọn gàng về logic, không quá tải người không hiểu code, có khoảng thở, hạn chế pattern ô frame, dùng khoảng cách và line; QA theo chuẩn thẩm mỹ desktop app cao cấp". Tài liệu này là đặc tả để Worker code theo, áp DESIGN.md §5 Layout & Grouping vào từng surface cụ thể.
- **Người yêu cầu:** Orchestrator, chuyển từ user (2026-09-15).
- **Commit đã kiểm chứng:** `a00af07` (main lúc bắt đầu; `18f4efb` sau khi thêm §5 Layout & Grouping trên cùng nhánh này). Screenshot mới chụp bằng dev server chạy đúng commit này (chứng minh: server khởi động từ tree chính đang ở `7b6730d`/`a00af07`, không có commit code app nào giữa hai SHA).
- **Chỉ tài liệu.** Worker đang giữ `main.tsx` và `styles.css` để code hệ nút Ink & Paper song song; đặc tả này không tự sửa code.
- **Nhãn nguồn:** **[đo]** đọc từ ảnh chụp thật, **[code]** đọc `main.tsx`/`styles.css` tại commit trên, **[ngoài]** nguồn có link, **[đề xuất]** quyết định mới của UI/UX, chưa phải luật đã chốt.

Ảnh hiện trạng mới chụp: `docs/research/art-direction/2026-09-15-layout/`. Ảnh vòng 1 vẫn dùng: `docs/research/art-direction/current/`. Wireframe tĩnh (1 surface, xem §1.4): `docs/design/layout-spec/ai-providers.html`.

---

## Luật áp dụng cho mọi surface dưới đây

Từ DESIGN.md §5 (không nhắc lại toàn văn):
1. Khoảng cách và hairline là mặc định; card chỉ bọc vật thể thật (node, ảnh, mục ChangeSet đang mở).
2. Không card trong card.
3. Mỗi màn có một mật độ đã định trước; phần còn lại vào "Nâng cao" hoặc disclosure.
4. Copy không lộ id, model id thô không giải thích, số liệu kỹ thuật trần, hay JSON.
5. Section header (weight 680, `--text-title`) thay cho khung khi nhóm nhiều mục trong cùng dialog.

---

## 1. Settings, tab AI Providers

### 1.1 Hiện trạng

Ảnh: [`07-settings-ai-providers-dark.jpg`](../research/art-direction/current/07-settings-ai-providers-dark.jpg), [`11-settings-ai-providers-light.jpg`](../research/art-direction/current/11-settings-ai-providers-light.jpg), [`crop-e-settings-hierarchy.jpg`](../research/art-direction/current/crop-e-settings-hierarchy.jpg).

**Sự thật [code]:** `.provider-card` và `.settings-panel` dùng chung một rule vẽ khung (`styles.css:5534`, viền + bo góc + nền `--surface-drawer`). Trong cùng màn còn có `.settings-control-strip` tự vẽ khung riêng (`5232`) và mỗi checkbox trong nhóm Tagging/Canvas generation là một `.provider-task-toggle` có viền riêng (`5701`). Cấu trúc lồng thật: `.settings-shell` (khung dialog) > `.provider-workbench-grid` > `.provider-card--detail` (khung) > 2 nhóm checkbox (mỗi ô một khung con) + 1 `.settings-control-strip` phía trên cùng màn (khung khác). Dưới cùng còn 4 khối `<details>` xếp chồng: Routing preview, Secrets, Usage, Onboarding, mỗi khối là một `.settings-panel` (khung) khác.

**Vấn đề [đo]:** một màn hình show cùng lúc: routing strip, danh sách provider, form Name/Model, Advanced (đã gập), API key, 4 nút hành động, 2 nhóm checkbox (8 ô), dòng meta "No secret · Untested", rồi Routing preview, Secrets, Usage, Onboarding. R1 P2-5 đã đo phân cấp chữ bị ngược (h3 "More providers" 15px/680 to hơn tên provider đang chọn 11px/700). Đây là surface vi phạm nặng nhất luật Object Card và One Density trong DESIGN.md §5.

### 1.2 Vấn đề khung/quá tải, tóm tắt

- 4 tầng khung lồng nhau cho một form.
- 8 checkbox trông như 8 nút nhỏ, không đọc được là checkbox.
- Không có mật độ đã định: mọi thứ hiện cùng lúc, không phần nào mặc định ẩn dù nội dung (Routing preview, Usage) chỉ cần thiết khi debug.
- "gpt-4.1-mini" hiện đúng, không phải vi phạm Plain-Language (đây là giá trị người dùng chọn, giống chọn font). Vi phạm thật ở surface khác là chỉ số token trần (§5 Kira dock).

### 1.3 Bố cục mới [đề xuất]

Thứ tự trên xuống, mỗi mục cách nhau `--space-6` (24px), có `1px` hairline phía trên mỗi section (trừ mục đầu):

1. **Header cố định** (giữ nguyên): tiêu đề "AI Providers" + trạng thái + nút đóng, không đổi.
2. **Routing** (thay `.settings-control-strip` có khung): 2 select (Routing, Remote) cộng 2 dòng trạng thái dạng chữ ("2 trên 9 provider đã kết nối", "Model máy: chưa dùng được") xếp một hàng, không nền, không viền. Đây là control thật (select), không phải card.
3. **Danh sách và chi tiết provider**, layout 2 cột giữ nguyên (`210px` / phần còn lại), nhưng:
   - Cột trái: danh sách provider giữ dạng List Rows đã đúng chuẩn (DESIGN.md §7): 1 khung ngoài `border-soft` bao trọn danh sách, hàng ngăn bằng `border-top`, không đổi. "More providers" vẫn là `<details>` nhưng heading đổi cỡ xuống bằng phần còn lại của trang (đây là chỗ sửa P2-5).
   - Cột phải: **bỏ khung của `.provider-card--detail`**. Tên provider đang chọn thành section header thật (`--text-title`, 680) ngay đầu cột, dưới nó một hairline, rồi Name/Model, Advanced (giữ `<details>`, đã đúng progressive disclosure), API key, hàng nút hành động (Save key = secondary khi có key, primary khi còn trống theo đúng đường bấm cũ; Test = secondary; Models = quiet; Delete profile = danger, xem DESIGN.md §7 bảng 4 cấp).
4. **Tagging, Canvas generation:** bỏ `.provider-task-toggle`. Checkbox chuẩn (16px, không viền quanh nhãn) cộng nhãn `--text-small`, xếp bằng `display: flex; flex-wrap: wrap; gap: var(--space-3)`. Nhãn nhóm ("TAGGING") giữ nguyên kiểu micro-label, nhưng đứng trên khoảng cách chứ không trên nền card.
5. **Dòng meta** ("No secret · Untested"): giữ dạng chữ trần, không đổi.
6. **Nâng cao** (section header "Nâng cao", gập mặc định): gộp Routing preview, Secrets, Usage, Onboarding vào **một** `<details>` duy nhất thay vì 4 khối xếp chồng riêng. Bên trong dùng List Rows (mỗi mục một hàng, hairline ngăn), không phải 4 card riêng. Đây là chỗ áp One Density Rule rõ nhất: 4 khối kỹ thuật (routing preview theo task, số secret lưu trong Keychain, số lượt gọi API, replay onboarding) không phải thứ người mới dùng cần thấy ngay khi mở tab.

### 1.4 Wireframe

[`docs/design/layout-spec/ai-providers.html`](layout-spec/ai-providers.html): 2 khung tĩnh (hiện trạng rút gọn và bố cục mới), dark, dùng token thật copy từ DESIGN.md front matter và material Ink & Paper từ `kira-controls/references/ink-paper.css`. Mở trực tiếp bằng trình duyệt, không cần server.

---

## 2. Settings, tab General / Capture / Advanced

### 2.1 Hiện trạng

Ảnh: [`settings-general-dark.jpg`](../research/art-direction/2026-09-15-layout/settings-general-dark.jpg), [`settings-capture-dark.jpg`](../research/art-direction/2026-09-15-layout/settings-capture-dark.jpg), [`settings-advanced-dark.jpg`](../research/art-direction/2026-09-15-layout/settings-advanced-dark.jpg).

**Sự thật [code]:** cả General, Capture, Advanced đều dùng `.settings-panel` cho mỗi section (Language, Local; Extensions, Chrome/Safari; Secrets, Usage, Onboarding), tức mỗi section một card, giống lỗi ở AI Providers nhưng nhẹ hơn vì mỗi section chỉ có 1 tầng, không có checkbox-chip hay control-strip lồng thêm.

### 2.2 Bố cục mới [đề xuất]

Áp cùng công thức: bỏ nền và viền của `.settings-panel`, giữ `gap` hiện có, thêm `1px` hairline phía trên mỗi section (trừ section đầu của tab). Vì `.settings-panel` dùng chung ở nhiều tab, sửa một chỗ này tự động sửa cả General, Capture, Advanced và mọi disclosure trong AI Providers (Routing preview, Secrets, Usage, Onboarding) cùng lúc: đây là điểm bẩy lớn nhất trong toàn bộ đặc tả này.

- **General:** Routing strip (đưa lên AI Providers theo §1, không lặp ở đây) → Language (Segmented, giữ) → Local (definition list, giữ, đã đúng dạng chữ + nhãn).
- **Capture:** Extensions intro (giữ) → 2 hàng Chrome/Safari dạng List Rows (đã đúng: `capture-row`, hairline, không đổi).
- **Advanced:** 3 mục (Secrets, Usage, Onboarding) chuyển từ 3 `.settings-panel` riêng thành 3 hàng trong **một** List Rows, mỗi hàng có chevron mở chi tiết, giống pattern Providers list. Không cần `<details>` lồng nếu nội dung ngắn (Secrets chỉ có 1 dòng số, Usage 1 dòng số): hiện thẳng số, chỉ Onboarding (có 2 nút hành động) mới cần mở rộng khi bấm.

---

## 3. Library panel (Thư viện)

### 3.1 Hiện trạng

Ảnh: [`06-library-120-list-hover-dark.jpg`](../research/art-direction/current/06-library-120-list-hover-dark.jpg), [`library-grid-dark.jpg`](../research/art-direction/2026-09-15-layout/library-grid-dark.jpg), [`10-library-canvas-light.jpg`](../research/art-direction/current/10-library-canvas-light.jpg).

**Sự thật [code]:** `.library-node-row` đã đúng luật: `padding: 10px; border-radius: var(--radius-2); background: transparent` (`styles.css:1994`), không viền, chỉ có hover đổi nền (kiểm ở R1: cần xác nhận lại màu hover không đảo sang khối teal đặc, theo `kira-controls` §2 luật 4). Đây là surface **đã đúng phần lớn** luật Layout & Grouping.

**Vấn đề còn lại [đo, R1 P1-1]:** nền `.inbox` dùng `--glass-drawer` bán trong suốt (`rgb(6 12 12 / 0.74)` dark), nên ảnh trên canvas hiện xuyên qua danh sách text. Đây là vấn đề vật liệu (glass), không phải grouping; đã có trong tồn đọng R1, không lặp lại ở đây, chỉ ghi để Worker biết không tự ý "sửa luôn" ngoài phạm vi task đang giao.

### 3.2 Bố cục mới [đề xuất]

Không đổi cấu trúc list. Hai việc nhỏ:
- Filter chip "6 suggested" (xanh) đang là pill nổi bật cạnh "6 items" xám: giữ, đúng One Accent Rule (trạng thái, không phải control).
- List/Grid segmented + "N visible": giữ nguyên, đã dùng Segmented control chuẩn.

---

## 4. Popover chi tiết node

### 4.1 Hiện trạng

Ảnh: [`node-details-image-tags-dark.jpg`](../research/art-direction/2026-09-15-layout/node-details-image-tags-dark.jpg), [`04-node-details-dark.jpg`](../research/art-direction/current/04-node-details-dark.jpg).

**Sự thật [code]:** `.node-details-popover` là MỘT card (`3736`, đúng: đây là chi tiết của một vật thể thật, node). Bên trong, `.node-details-section` (`3763`) chỉ có `gap: 8px`, không viền: TAGS, PALETTE, SOURCE, HISTORY đứng cạnh nhau bằng khoảng cách và nhãn hoa (`SOURCE`, `HISTORY`) đúng luật Space-and-Line-First. **Đây là ví dụ đúng đã có sẵn trong code**, dùng làm mẫu cho các surface khác thay vì phải thiết kế lại từ đầu.

### 4.2 Vấn đề nhỏ còn lại

- Action bar phía trên popover (`.node-details-actionbar`) không reset `background`/`border` triệt để cho mọi nút (R1 P1-3, `crop-a-details-actionbar.jpg`); đã có ví dụ sửa cụ thể trong `kira-controls/SKILL.md` §9.B.
- Palette hiện dạng dải màu phẳng, không thêm khung; đúng luật, giữ nguyên.
- Nhãn nhóm SOURCE/HISTORY hiện chữ hoa nhỏ nhưng dùng icon chevron thay vì mũi tên xoay khi mở/đóng, kiểm lại contrast icon disclosure theo `kira-controls` §8.

### 4.3 Bố cục mới

Không cần đổi cấu trúc. Việc duy nhất: dùng chính `.node-details-section` làm **tham chiếu bắt buộc** khi Worker sửa các surface khác trong đặc tả này (ghi lại trong §7 Do's and Don'ts của DESIGN.md nếu cần một luật tường minh hơn, đề xuất cho vòng sau).

---

## 5. Dock Kira

### 5.1 Hiện trạng

Ảnh: [`kira-dock-open-dark.jpg`](../research/art-direction/2026-09-15-layout/kira-dock-open-dark.jpg), [`05-kira-dock-dark.jpg`](../research/art-direction/current/05-kira-dock-dark.jpg), [`crop-g-dock-double-outline.jpg`](../research/art-direction/current/crop-g-dock-double-outline.jpg).

**Sự thật [code]:** dock mở hiện: dãy chip ngữ cảnh (Full board, IDEA…, REFERENCE…) → ô nhập → hàng dưới: Select Model, 2 icon phụ, **`~{tokenEstimate} tokens`** (`main.tsx:10324`, vi phạm Plain-Language Rule đã ghi trong DESIGN.md §5), nút gửi. R1 P2-8 đã đo: container dock có viền accent, ô nhập đang focus cũng viền accent, thành hai vòng lồng nhau.

### 5.2 Bố cục mới [đề xuất]

- **Bỏ số token trần.** Thay bằng một trong hai, theo mức đơn giản tăng dần: (a) không hiện gì cho tới khi gần đầy, chỉ hiện "Ngữ cảnh khá dài, câu trả lời có thể chậm hơn" dạng chữ khi vượt ngưỡng; (b) một vạch tiến trình ngắn (không số) cạnh nút gửi, có `aria-label` mô tả bằng chữ cho screen reader. Không tự chọn hộ; đánh dấu là câu hỏi cần UI/UX hoặc Worker quyết khi code, ghi ở §6 bên dưới.
- **Một viền, không hai.** Bỏ viền accent trên chính container dock khi ô nhập bên trong đã tự có viền focus riêng; container chỉ cần bóng plate theo `kira-controls` §5 (Toolbar và chrome nổi), không cần thêm viền accent thường trực.
- Dãy chip ngữ cảnh: giữ nguyên, đây là danh sách vật thể thật đang được tham chiếu (node/ảnh), đúng luật Object Card ở quy mô nhỏ (chip, không phải card, nhưng cùng tinh thần: đại diện cho vật thể, không phải nhóm cấu hình).

---

## 6. Dialog: xác nhận xoá, crop, version history

### 6.1 Xác nhận xoá

Ảnh: [`delete-confirm-dark.jpg`](../research/art-direction/2026-09-15-layout/delete-confirm-dark.jpg).

**Sự thật [code]:** `.confirm-dialog` là 1 khung duy nhất, không lồng. **Đã đúng luật**, không cần đổi cấu trúc. Việc của Worker là chỉ áp cấp nút mới: Cancel = quiet hoặc secondary tuỳ ngữ cảnh, Delete = danger (theo bảng DESIGN.md §7).

### 6.2 Crop

Ảnh: [`crop-dialog-dark.jpg`](../research/art-direction/2026-09-15-layout/crop-dialog-dark.jpg).

**Sự thật [code]:** `.crop-dialog` (`7583`) là 1 khung, nội dung là ảnh cộng dòng hướng dẫn cộng 3 nút. **Đã đúng luật.** Không đổi bố cục; chỉ đổi cấp nút (Reset crop = quiet, Cancel = quiet hoặc secondary, Save crop = primary).

### 6.3 Version history

Ảnh: chưa chụp riêng ở commit này (dialog cần có `versionHistory` khác rỗng, seed hiện tại trống); tham khảo cấu trúc code.

**Sự thật [code]:** `.version-dialog` (`7631`) 1 khung ngoài, bên trong `.version-branch-browser` chia `210px` / phần còn lại (`7643`), cột trái `.version-branches` chỉ có `gap`, không viền riêng (`7650`). **Đã đúng luật, không lồng khung.** Không đổi bố cục.

### 6.4 Kết luận chung mục 6

3 dialog này **không vi phạm** Layout & Grouping; chúng vốn đã là "một object, một khung". Việc duy nhất là đồng bộ cấp nút theo Ink & Paper (Worker đang làm song song). Ghi vào đây để Orchestrator biết không phải mọi surface đều cần sửa bố cục.

---

## 7. Project settings popover

### 7.1 Hiện trạng

Ảnh: [`project-settings-popover-dark.jpg`](../research/art-direction/2026-09-15-layout/project-settings-popover-dark.jpg).

**Sự thật [code]:** `.project-settings-popover` (`600`) là 1 khung `300px` rộng, `gap: 8px`, chứa Name, Description, Author, Kind, Style note, rồi Color scheme là **một field có viền riêng bên trong** (ảnh cho thấy khối "Accent scheme #84CDBC · Apple Gl…" đóng khung, khác các field text phía trên chỉ có input phẳng). Đây là **card lồng trong card** ở quy mô nhỏ: popover (khung ngoài) > field Color scheme (khung trong, khác hẳn 5 field cùng cột không có khung).

**Ghi chú Plain-Language:** "#84CDBC" hiện đúng là mã hex, hợp lệ ở đây vì đây chính là giá trị người dùng đang chỉnh (chọn màu), không phải id nội bộ; không vi phạm.

### 7.2 Bố cục mới [đề xuất]

Field Color scheme dùng cùng kiểu input phẳng như 5 field phía trên (nền `--surface-inset`, không viền card riêng), swatch màu nằm trong hàng đó thay vì tự thành một khối. Nếu cần mở rộng chọn preset khác, dùng bấm mở popover con (đã có mũi tên `>` sẵn ở cuối hàng trong ảnh), không phải một khung tĩnh luôn hiện.

---

## 8. Toolbar Slides / Outline (đè view switcher)

### 8.1 Hiện trạng

Ảnh: [`crop-b-outline-toolbar-collision.jpg`](../research/art-direction/current/crop-b-outline-toolbar-collision.jpg), [`outline-toolbar-dark.jpg`](../research/art-direction/2026-09-15-layout/outline-toolbar-dark.jpg), [`08-slides-dark.jpg`](../research/art-direction/current/08-slides-dark.jpg).

**Sự thật [đo, R1 P1-4]:** ở 1440×900, segmented "All/Strong/Needs work" của Outline đè nút "Outline" của view switcher **12×15px**; ở Slides, nút "HTML" đè nút cài đặt project **22×21px**. Cả hai đều dùng `position: absolute` tính riêng cho từng view thay vì chia sẻ một vùng bố cục.

### 8.2 Bố cục mới [đề xuất]

Đây là lỗi va chạm bố cục, không phải lỗi "quá nhiều khung", nên cách sửa khác các mục trên: **view switcher (Canvas/3D/Slides/Outline) và toolbar riêng của từng view phải cùng nằm trong một hàng bố cục duy nhất, chia theo `grid-template-columns`, không phải hai phần tử `absolute` tính toạ độ độc lập.** Cụ thể:
- Hàng trên cùng chia 3 cột: trái (để trống hoặc breadcrumb), giữa (view switcher, luôn giữ nguyên vị trí giữa màn hình), phải (toolbar của view đang mở: filter Outline, hoặc Auto layout/Auto template của Slides).
- Khi toolbar bên phải dài hơn chỗ trống, nó tự xuống dòng thứ hai (`flex-wrap: wrap`) thay vì đè lên cột giữa: không bao giờ để hai cụm điều khiển chồng pixel lên nhau ở bất kỳ độ rộng cửa sổ nào từ 1024px trở lên.

---

## 9. Panel phải (right-panel)

Xem mục E riêng (`docs/design/right-panel/`, `DECISIONS.md`). Luật §5 áp dụng: ChangeSet item đang mở là vật thể thật (đúng Object Card Rule), nhưng mockup hiện dùng card cho cả item đã thu gọn và cho từng thread trong danh sách. Không lặp lại phân tích ở đây, tránh hai nguồn sự thật; xem báo cáo riêng.

---

## Câu hỏi cần user hoặc Orchestrator chốt

1. **§5.2 Dock Kira:** bỏ hẳn hay thu nhỏ chỉ báo token? Hai phương án nêu ở trên, chưa chọn.
2. **§1.3 mục 6 "Nâng cao":** gộp Routing preview + Secrets + Usage + Onboarding vào một `<details>` có làm mất khả năng tìm nhanh Usage khi debug không? Nếu user dùng Usage thường xuyên, nên giữ riêng thay vì gộp.
3. **§8:** đổi từ `position: absolute` sang layout chia cột là việc chạm `styles.css` ở nhiều view (Slides, Outline, có thể cả 3D); cần Worker ước lượng công trước khi Orchestrator giao việc.

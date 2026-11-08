# Bề mặt sửa node: critique, khảo sát pattern, kiến trúc đề xuất, OSS

- **Câu hỏi:** overlay/dialog sửa node (vd Edit node Idea) "nhìn thiếu chính phụ, không thân thiện", công cụ ngữ cảnh đặt vụng về. Mục tiêu: bề mặt thân thiện như Apple Notes/Notion, có block format kiểu Notion, giúp người dùng sáng tạo tốt nhất và phát huy AI Kira, ảnh, link, version, palette.
- **Người yêu cầu:** Orchestrator, chuyển từ user (2026-11-09).
- **Commit đã kiểm chứng:** vixio `7829b85` (branch `researcher/node-editor-ux`). Ảnh hiện trạng: `docs/research/2026-11-09-node-editor-current.png` (đã tự mở xem, không chụp lại). Nguồn ngoài truy cập 2026-11-09.
- **Kết luận ngắn:**
  1. **"Thiếu chính phụ" có một nguyên nhân kỹ thuật cụ thể, không phải cảm tính:** dòng tiêu đề và thân bài nằm **trong cùng một ô soạn thảo**, cùng `font-size: inherit` (13px), cùng weight — không có CSS nào phân biệt "đây là tiêu đề". `node.title` chỉ là chuỗi được trích ra từ dòng đầu của `content` (`deriveTitleFromContent`), không phải một trường nhập liệu riêng. DESIGN.md đã định nghĩa sẵn kiểu "Title" (680 weight, `--text-title` 15px) nhưng ô sửa node không dùng nó cho chính tiêu đề của nó.
  2. **Công cụ ngữ cảnh đặt vụng về vì nó không ngữ cảnh chút nào:** thanh định dạng là một hàng nút **luôn hiện cố định** phía trên toàn bộ ô soạn thảo (`overlayMode` ép `showToolbar = true` luôn luôn), không phải bubble menu xuất hiện khi bôi đen như Notion/Craft/WordPress/tldraw. Không có slash `/`, không có tay cầm kéo khối (drag handle), không có "Hỏi Kira" ở bất cứ đâu gần văn bản.
  3. **AI Kira gần như vô hình trong chính bề mặt này:** chỉ có **một icon duy nhất, không nhãn**, khác nhau tuỳ loại node (vd "Create outline" cho idea), nằm lẫn trong một hàng icon chung với xoá/đóng. Không có cách nào chọn một đoạn văn rồi hỏi Kira, viết tiếp, hay tách thành node con, dù các hành động AI đó (summarize/break_down/synthesize/find_gaps/generate_variations) đã tồn tại sẵn ở nơi khác trong app.
  4. **Siêu dữ liệu (Source, Properties, History) rải phía dưới thân bài, hai cơ chế thu gọn khác nhau** (`SectionHeader` cho Source/History, `<details>` gốc cho Properties), và **Source URL hiện trùng lặp ở hai chỗ** (ô nhập trong "Source" và lại một dòng đọc-only trong "Properties"). Không có khối thuộc tính gọn kiểu Notion ngay dưới tiêu đề.
  5. **Nền tảng Tiptap 3 đã đủ để làm gần hết việc này mà không cần đổi editor.** Ba mảnh còn thiếu — tay cầm kéo, slash menu, bubble menu — đều có extension **MIT, miễn phí, không cần tài khoản Tiptap Cloud** (`@tiptap/extension-drag-handle-react`, `@tiptap/suggestion`, `@tiptap/react`'s `BubbleMenu`), đã xác minh license trực tiếp từ `package.json` trong repo chính chủ, và **React 19 đã chạy thật trong KIRA hôm nay** (không phải suy đoán tương thích). Khuyến nghị: **giữ Tiptap**, không chuyển sang BlockNote/Novel/Yoopta/Lexical.

Nhãn nguồn: **[code]**, **[ngoài]**, **[ngoài-phụ]**, **[suy luận]**.

---

## 0. Hiện trạng [code], tại `7829b85`

### 0.1 Cấu trúc thật của overlay

`node-details-popover` ([main.tsx:9899](../../apps/desktop/src/main.tsx:9899), `role="dialog"`) mở từ nút `(i)` trên node hoặc double-click, bọc trong `node-overlay-scrim` bán trong suốt (`rgb(5 6 6 / 0.56)`, [styles.css:4229](../../apps/desktop/src/styles.css:4229)). Thứ tự DOM thật, từ trên xuống — **khác với cảm giác "một khối" trong ảnh chụp**:

| # | Khối | Vị trí trong code | Vai trò |
|---|---|---|---|
| 1 | **Action bar**: icon theo loại node (vd idea → "Create outline", icon Bot) + separator + toggle AI-include (mắt) + xoá + separator + đóng | [main.tsx:9923-10033](../../apps/desktop/src/main.tsx:9923) | Tất cả hành động một-lần, không phân biệt bằng nhãn chữ |
| 2 | **`NodeRichEditor` #1**, `content={node.content}`, placeholder "Type something..." | [main.tsx:10034-10042](../../apps/desktop/src/main.tsx:10034) | Thân bài thật — dòng đầu của markdown này **chính là** cái hiện ra như "tiêu đề" trên thẻ node ngoài canvas |
| 3 | *(chỉ palette)* khối màu | [:10043-10061](../../apps/desktop/src/main.tsx:10043) | — |
| 4 | **`TextAreaBase` "Notes"**, `rows={2}`, `resize: vertical`, field **hoàn toàn tách biệt** khỏi `content` (field dữ liệu riêng `node.notes`) | [main.tsx:10062-10070](../../apps/desktop/src/main.tsx:10062) | Mục đích không rõ với kind `idea` (trùng việc với content); với `image/palette/diagram` nó đứng **đầu** danh sách snippet tìm kiếm ([main.tsx:15542-15571](../../apps/desktop/src/main.tsx:15542)) nên rõ ràng hơn: "ghi chú của riêng bạn về tư liệu này" |
| 5 | *(chỉ image)* khối Tags/Palette/Source **kéo-thả đổi thứ tự được** | [:10071 trở đi](../../apps/desktop/src/main.tsx:10071) | Không áp dụng cho idea |
| 6 | **Source** (`SectionHeader`, thu gọn được) | [:10130-10140](../../apps/desktop/src/main.tsx:10130) | Một ô nhập URL |
| 7 | *(chỉ diagram)* **Diagram source** | [:10142-10159](../../apps/desktop/src/main.tsx:10142) | — |
| 8 | **History** (`SectionHeader`, thu gọn được), `NodeVersionTimeline` | [:10163-10175](../../apps/desktop/src/main.tsx:10163) | Danh sách version, mỗi bản là một thẻ đầy đủ khi mở |
| 9 | **Properties** (`<details>` gốc, **không phải** `SectionHeader`), chỉ-đọc: Importance, Source URL (trùng #6), Dimensions, Size, Type, Created, Added, Updated | [main.tsx:13175-13241](../../apps/desktop/src/main.tsx:13175) | Cơ chế thu gọn khác hẳn #6 và #8 |

**Vì sao ảnh chụp trông như "một hộp văn bản khổng lồ":** khối #4 (Notes) có `resize: vertical` ([styles.css:7695](../../apps/desktop/src/styles.css:7695)), nên nó kéo to được bằng tay — ảnh chụp đang ở trạng thái đã kéo lớn và đang focus, nhận đúng vòng viền tập trung 2px mà kit Untitled UI vẽ cho mọi ô nhập đang focus ([styles.css:3677-3679](../../apps/desktop/src/styles.css:3677), cùng công thức cho cả #2 và #4). **Đây không phải lỗi hiển thị** — là hệ quả của một field phụ (2 dòng theo thiết kế) có thể bị kéo to hơn cả nội dung chính.

### 0.2 Soạn thảo đã có gì, qua `NodeRichEditor` ([main.tsx:1164-1343](../../apps/desktop/src/main.tsx:1164))

Dùng Tiptap 3 thật (`@tiptap/react` 3.29.2, xác nhận trong `package.json`), `StarterKit` với:

- **Có:** heading H1-H3 (gõ `# `/`## `/`### ` tự chuyển, Notion-style), bullet (`- `), ordered (`1. `), blockquote (`> `), link (`TiptapLink`, không tự mở khi click).
- **Tắt cứng:** `codeBlock: false`, `horizontalRule: false`, `strike: false`, `code: false` — tắt có chủ đích hay chỉ chưa làm, không ghi lý do trong code.
- **Undo riêng của Tiptap bị tắt** (`undoRedo: false`) để không đụng lịch sử zundo của canvas — đúng, cần giữ.
- Toolbar ([:1316-1330](../../apps/desktop/src/main.tsx:1316)): `overlayMode` ép hiện **luôn luôn**, dùng kit `ButtonGroup` (đã đổi từ nút thô sang kit ở một đợt trước, comment ghi "PHA 4"). Bảy nút: Bold, Italic, "Heading" (một nút xoay vòng H1→H2→H3→paragraph), Bullet, Ordered, Quote, Link.

**Kết luận 0.2:** nền soạn thảo đủ tốt để làm Notion-style editing live-markdown. Phần thiếu không phải engine, là **UI xung quanh engine**.

---

## 1. Critique theo cấp bậc thông tin

| Thứ | Hiện là | Nên là | Vì sao |
|---|---|---|---|
| **Tiêu đề** | Dòng đầu trong cùng ô với thân bài, cùng cỡ chữ 13px, cùng weight | **Trường riêng**, `--text-title` 15px/680 (đúng kiểu "Title" DESIGN.md §4 Hierarchy đã định nghĩa), KHÔNG còn là một phần của `content` | Đây là thứ **chính** nhất của node — tên nó hiện trên thẻ canvas, trong Library, trong kết quả tìm kiếm. Nó đang có cùng trọng lượng thị giác với một dòng ghi chú bất kỳ |
| **Thân bài** | Chiếm ít không gian nhất trong overlay (bên dưới nó còn 2 field phụ + 3 khối metadata) | Chiếm **phần lớn** chiều cao overlay, vì đây là nội dung người dùng thật sự soạn | Đúng progressive disclosure (DESIGN.md §2.1): nội dung chính không nên bị siêu dữ liệu lấn chỗ |
| **Notes** | Field tự do, không rõ khác gì với content, có thể kéo to hơn cả content | Với `idea`: cân nhắc **bỏ**, gộp vào content (một ô duy nhất, đỡ mơ hồ). Với `image/palette/diagram/placeholder`: giữ nhưng **thu nhỏ cố định**, đổi nhãn "Your note", đặt sát khối thumbnail/palette nó mô tả | Dữ liệu cho thấy vai trò khác nhau theo loại node (xem §0.1 #4) — không nên xử lý như nhau |
| **Source, Properties** | Hai khối tách rời, hai cơ chế thu gọn khác nhau, Source URL hiện hai lần | **Gộp một hàng "Properties" gọn**, thu lại mặc định thành 1 dòng (vd "example.com · Quan trọng · Cập nhật 2 giờ trước"), nằm **ngay dưới tiêu đề** | Notion đặt properties ngay dưới tiêu đề, không phải cuối trang; gộp bỏ trùng lặp Source URL |
| **History** | Giữa Source và Properties, mỗi bản version hiện đầy đủ khi mở | Chuyển xuống **cuối cùng**, mỗi bản chỉ hiện 1 dòng (nhãn + thời gian) cho tới khi bấm | Đây là dữ liệu tra cứu, tần suất dùng thấp nhất trong toàn overlay — đúng vị trí cuối, đúng mật độ thấp |
| **Action bar** | Toàn icon, không nhãn, lẫn hành động AI (Bot) với hành động hệ thống (xoá, đóng) trong cùng một hàng phẳng | Giữ icon-only (đúng `kira-controls` cho control nhỏ), nhưng **tách rõ cụm AI** (có thể thêm một chip nhỏ "Kira" cạnh icon) khỏi cụm quản trị (xoá/đóng) bằng khoảng cách rõ hơn một hairline đơn | Một hành động AI quan trọng (sinh outline) đang trông y hệt một nút tiện ích |
| **Công cụ định dạng** | Luôn hiện, tách biệt khỏi chỗ đang gõ, 7 nút ngang hàng không phân nhóm | **Bubble menu khi bôi đen** (văn bản) + **drag-handle/slash khi hover khối** (cấu trúc) — hai công cụ khác mục đích, không nên chung một hàng nút tĩnh | Đúng pattern mọi sản phẩm khảo sát ở §2 dùng; "đặt vụng về" vì công cụ không đi theo người dùng |
| **AI theo ngữ cảnh** | 1 icon, 1 hành động cố định theo loại node, không theo lựa chọn văn bản | Thêm mục **"Hỏi Kira"** vào bubble menu khi có bôi đen (hành động: giải thích, viết tiếp, tách thành node) | Đây chính là yêu cầu "phát huy AI Kira" — hiện tại AI chỉ hành động trên **cả node**, không hành động trên **một đoạn** |

---

## 2. Khảo sát pattern

| Sản phẩm | Điều đáng lấy cho KIRA | Nguồn |
|---|---|---|
| **Notion** | Gõ "/" là đường chính để thêm khối, cùng một menu phủ cả hai việc "+": thêm khối mới và biến đổi khối hiện có. Tay cầm `⋮⋮` hiện khi hover, kéo để di chuyển khối. | [ngoài, Notion Help Center](https://www.notion.com/help/writing-and-editing-basics) |
| **tldraw** | "Contextual style panel": thanh nổi phía trên lựa chọn, **chỉ hiện đúng thuộc tính lựa chọn đó hỗ trợ** — không phải một bảng cố định hiện mọi lựa chọn luôn luôn | [ngoài, tldraw docs](https://tldraw.dev/examples/contextual-style-panel) |
| **Craft** | Toolbar bàn phím bám theo khối đang gõ (không phải cố định đầu màn hình); nút tác động đúng khối hiện tại, giống mô hình Messages — Pratt Institute gọi đây là mô hình khái niệm tốt. Phê bình đồng thời: để toolbar dính đáy bàn phím từng bị chê là sai vị trí so với chuẩn iPadOS, gợi ý nên theo lựa chọn thay vì theo bàn phím | [ngoài-phụ, Pratt IxD critique](https://ixd.prattsi.org/2021/09/design-critique-craft-ios-app/); [ngoài, Craft Help Center](https://support.craft.do/en/write-and-edit/formatting) |
| **Bear** | Tối giản có chủ đích: "công cụ không chắn đường viết", không có toolbar nặng. Bài học ngược: KIRA không cần nhiều nút hơn Bear, cần đúng lúc hơn | [ngoài-phụ, nhiều review 2026] |
| **Apple Notes** | Định dạng nằm sau một nút "Format" riêng, không chiếm không gian thường trực; checklist/table là nút chuyên biệt ngay trong thanh công cụ, không phải menu chung | [ngoài, Apple Support](https://support.apple.com/guide/iphone/create-and-format-notes-iph1ac0b3a2/ios) |
| **Heptabase** | Toolbar nổi của editor **có thể mở rộng** để lộ thêm tuỳ chọn định dạng (bản 28/09/2026) — tức mặc định gọn, có đường mở rộng khi cần, không phải luôn đủ 7 nút. Gõ "/" mở menu khối; Esc chọn khối hiện tại | [ngoài, Heptabase changelog](https://wiki.heptabase.com/changelog) |
| **Muse (Ink & Switch)** | Thẻ trên canvas mở ra để sửa, giữ đúng tinh thần "card → editor" gần nhất với KIRA — nhưng tư liệu công khai mỏng về chi tiết toolbar, không đủ để khảo sát sâu hơn Notion/Craft | [ngoài-phụ, Ink & Switch design writeup](https://www.inkandswitch.com/muse/) |
| **Obsidian Canvas, cộng đồng "Narrative Canvas"** | Đã dẫn trong báo cáo 2026-11-07: AI đề xuất **một danh sách phép toán** (add/update node, add/remove link) để Apply/Reject — đúng mô hình `AiChangeSet` KIRA đã có, không phải phát hiện mới, nhắc lại vì liên quan trực tiếp tới "tách thành node con" ở §3 | [ngoài-phụ, đã dẫn 2026-11-07] |
| **Milanote** | Text block "thiên về nắm bắt nhanh và bố cục", KHÔNG có AI — một đối chứng cho thấy "thẻ càng chuyên biệt cho mindmap/moodboard càng kém phong phú về định dạng". KIRA không nên đi theo hướng tối giản tới mức đó: user đang đòi *thêm* khả năng định dạng (kiểu Notion), không bớt | [ngoài-phụ, nhiều review 2026] |

**Kết luận §2 [suy luận]:** không sản phẩm nào khảo sát dùng một toolbar tĩnh luôn hiện phía trên toàn bộ ô soạn thảo như cách KIRA đang làm. Tất cả chia hai công cụ theo đúng hai mục đích khác nhau: **chọn văn bản → định dạng** (bubble menu) và **đứng ở một khối → cấu trúc** (slash + drag handle). Đây là bằng chứng xuyên suốt, không phải một sản phẩm đơn lẻ gợi ý.

---

## 3. Kiến trúc bề mặt đề xuất

### 3.1 Bố cục tổng thể (trên xuống)

```
┌─────────────────────────────────────────┐
│ [Kind-icon: Create outline]  ···  [AI-include] [Xoá] │ [Đóng]   ← action bar, giữ nguyên nhóm trái/phải
├─────────────────────────────────────────┤
│  Tiêu đề node                             │ ← TRƯỜNG RIÊNG, --text-title 15px/680
│  example.com · Quan trọng · 2 giờ trước  ⌄│ ← Properties, 1 dòng, thu gọn mặc định
├─────────────────────────────────────────┤
│  Thân bài (Tiptap, phần lớn chiều cao)    │
│  · Danh sách, tiêu đề phụ, callout...     │
│  (hover một khối → ⋮⋮ + ⊕ bên trái)      │
│  (bôi đen → bubble menu nổi phía trên)    │
├─────────────────────────────────────────┤
│  [Your note — chỉ với image/palette/...]  │ ← nhỏ, gắn với thumbnail/palette tương ứng
├─────────────────────────────────────────┤
│  History (thu gọn, mỗi bản 1 dòng)      ⌄│
└─────────────────────────────────────────┘
```

### 3.2 Công cụ theo ngữ cảnh, hai lớp

**Lớp 1, bôi đen văn bản → Bubble menu** (`@tiptap/react` `BubbleMenu`, §4): Bold, Italic, Link, dấu phân cách, **"Hỏi Kira"** (icon sparkle) mở một menu con nhỏ: *Giải thích* · *Viết lại ngắn gọn hơn* · *Tách thành node con* (map thẳng vào `summarize`/`synthesize`/`break_down` đã có ở nơi khác trong app, giờ chạy trên đúng đoạn đã chọn thay vì cả node) · *Hỏi Kira...* (câu hỏi tự do, trả lời chèn ngay dưới đoạn đã chọn hoặc gửi sang panel Kira).

**Lớp 2, hover/đứng tại một khối → Drag handle + "+"** (`@tiptap/extension-drag-handle-react`, §4): kéo đổi thứ tự khối trong thân bài (hiện chưa làm được gì tương tự — thân bài hôm nay là một khối văn bản liên tục, không tách rời được từng đoạn); bấm "+" hoặc gõ "/" mở menu chèn khối.

**Menu "/"** (dùng `@tiptap/suggestion`, bộ lọc gõ tiếp), danh sách khối:

| Khối | Có sẵn trong StarterKit? | Việc cần làm |
|---|---|---|
| Văn bản, Heading 1-3, Bullet, Ordered, Quote | Có | Chỉ cần route qua slash, không cần extension mới |
| **To-do** (checkbox) | Chưa (StarterKit có `taskList`/`taskItem` ở gói riêng) | Thêm `@tiptap/extension-task-list` + `@tiptap/extension-task-item`, cả hai MIT cùng nhà |
| **Divider** | Có, đang **tắt cứng** (`horizontalRule: false`) | Bật lại, một dòng config |
| **Callout** | Chưa | Node tuỳ biến nhỏ (biến thể của blockquote, thêm icon + màu nền theo `--accent-*`), vài chục dòng, không cần package ngoài |
| **Diagram** | KIRA đã có loại node `diagram` riêng trên canvas | Slash item này **tạo một node `diagram` mới** liên kết từ node đang sửa (không nhúng mermaid trực tiếp vào văn bản) — tái dùng `kira/mermaid/parseMermaid.ts` đã có, không phải viết mới |
| **Hỏi Kira (sinh đoạn)** | — | Gọi đúng luồng AI hiện có (`createAiNode`-style hoặc chèn trực tiếp vào vị trí con trỏ nếu ngắn) |
| Embed link có xem trước, Toggle (khối gập) | Chưa, không có extension chính chủ gọn | **Để sau** (§D), cần fetch metadata (embed) hoặc node tuỳ biến phức tạp hơn (toggle) |

### 3.3 Khác biệt theo loại node

- **idea:** đúng mô hình trên, đủ nhất.
- **image/palette/diagram/placeholder:** action bar vẫn giữ nút chuyên biệt hiện có (Replace, Find similar, Crop, Extract palette…), nhưng phần thân bài nên **ngắn gọn hơn** (ảnh đã là nội dung chính, văn bản chỉ là chú thích) — khuyến nghị placeholder đổi thành "Add a caption…" thay vì "Type something..." chung chung cho mọi loại, và Notes giữ vai trò ghi chú riêng như đã phân tích ở §0.1.

---

## 4. OSS: giữ Tiptap, chỉ thêm 3 extension chính chủ

Chính sách hiện tại (2026-11-07): KIRA miễn phí, license thương mại không phải rào cản — nhưng câu hỏi ở đây **khác loại**: không phải license mã nguồn mở, mà là **có cần trả phí thuê bao SaaS** (Tiptap Cloud) hay không. Đã xác minh trực tiếp để tránh nhầm hai việc này.

| Thành phần | Package | License [ngoài, xác minh trực tiếp `package.json` trên GitHub `ueberdosis/tiptap`] | Có cần Tiptap Cloud không |
|---|---|---|---|
| Drag handle | `@tiptap/extension-drag-handle-react` + `@floating-ui/react` | MIT (`@tiptap/extension-drag-handle` gốc, v3.30.3) | **Không** — Cloud chỉ cần nếu dùng lệnh `npx @tiptap/cli add drag-context-menu` để **sinh sẵn** file component; cài thẳng 2 package MIT rồi tự viết wrapper (đúng cách KIRA đang làm với `ButtonGroup`/`Tooltip` của Untitled UI) thì không đụng Cloud |
| Slash menu | `@tiptap/suggestion` (cơ chế nền) | MIT, v3.30.3 | **Không**, với điều kiện **không** dùng CLI scaffold `slash-dropdown-menu` (bản mẫu chính thức của Tiptap kéo theo `@tiptap-pro/extension-ai`, tức phạm vi Pro) — tự viết danh sách lệnh bằng `@tiptap/suggestion` thẳng, đúng cách cộng đồng vẫn làm trước khi Tiptap có CLI |
| Bubble menu | `@tiptap/react` (đã có sẵn trong KIRA), export `BubbleMenu` từ `@tiptap/react/menus` | MIT, v3.30.3 (đã cài, cùng version với `@tiptap/core` KIRA dùng) | Không, miễn phí hoàn toàn, nằm trong gói core đã cài |
| To-do | `@tiptap/extension-task-list`, `@tiptap/extension-task-item` | Cùng nhà, cùng mô hình license MIT như các extension core khác [suy luận từ mẫu chung của monorepo, chưa tự tải riêng hai file này] | Không |

**Thực tế đã kiểm chứng, không suy đoán:** `apps/desktop/package.json` hiện ghi `@tiptap/react ^3.29.2` **chạy cùng** `react ^19.2.1` trong chính KIRA hôm nay — "tương thích React 19" không phải câu hỏi mở, app đang build và chạy với tổ hợp này. `@tiptap/react`'s `peerDependencies` công bố `react: "^17.0.0 || ^18.0.0 || ^19.0.0"` [ngoài, `package.json` trên GitHub, đọc trực tiếp].

**So với BlockNote/Novel/Yoopta/Lexical, theo đúng yêu cầu "ưu tiên giữ Tiptap nếu đủ":**

| | License [ngoài] | Bảo trì [ngoài-phụ] | Vì sao không cần đổi |
|---|---|---|---|
| **BlockNote** | Core MPL-2.0; gói `@blocknote/xl-*` (tính năng mở rộng) GPL-3.0 hoặc thương mại | Đang hoạt động | Là **cả một editor khối trọn gói**, đồng nghĩa thay hẳn `NodeRichEditor`, `tiptap-markdown` (đang dùng để xuất/nhập markdown), và mọi CSS đã viết cho `.node-rich-editor*`. Chi phí thay thế lớn hơn chi phí thêm 3 extension vào engine đã có |
| **Novel** | Một nguồn ghi Apache-2.0, chưa xác thực chéo | Bản 1.0.2 từ 01/2025, vẫn phụ thuộc Tiptap **2** (KIRA đã ở Tiptap 3) | Lùi phiên bản Tiptap, không tiến |
| **Yoopta** | Không xác định được license trong lần tìm | Bản gần nhất 05/2026 | Rủi ro bảo trì, không có lý do để đổi khi Tiptap 3 đã chạy tốt |
| **Lexical** | MIT | Đang hoạt động tích cực (Meta) | Không có slash/drag sẵn (framework cấp thấp hơn Tiptap), nghĩa là KIRA phải tự xây lại đúng những thứ Tiptap đã có extension chính chủ cho. Đổi toàn bộ engine mất công hơn nhiều so với lợi ích |

**Kết luận §4:** giữ `NodeRichEditor` làm nền, thêm ba mảnh (drag handle, slash, bubble menu) như extension lắp vào, không đổi engine. Không có phương án nào trong 4 cái trên đáng giá hơn việc hoàn thiện cái đang có.

---

## 5. Specimen

File: [`docs/research/2026-11-09-node-editor-specimen.html`](2026-11-09-node-editor-specimen.html) — mở trực tiếp bằng trình duyệt, không cần server. Dùng đúng token màu/chữ/khoảng cách của KIRA (`--text-title`, `--accent-cyan`, `--radius-*`, `--space-*`… lấy trực tiếp từ `styles.css` tại `7829b85`). Bản dark dùng nguyên giá trị token thật; bản light dùng bảng màu ấm suy ra theo đúng tinh thần "warm neutral, một accent teal" của DESIGN.md — **không phải trích xuất chính xác thuật toán light-mode thật của app** (xem Giới hạn).

Năm khối trạng thái, minh hoạ đúng năm điểm trong §1 và §3:

1. **Trạng thái nghỉ** — toàn overlay theo bố cục §3.1: tiêu đề riêng (15px/680), dòng Properties gọn 1 dòng, thân bài chiếm phần lớn chiều cao, History thu gọn cuối.
2. **Hover một khối** — tay cầm `⋮⋮` và dấu `+` hiện bên trái khối đang hover.
3. **Bôi đen văn bản** — bubble menu nổi phía trên vùng chọn, có mục "Hỏi Kira".
4. **Gõ "/"** — menu lệnh chèn khối, đã lọc theo ký tự gõ tiếp.
5. **Properties mở rộng** — so sánh với trạng thái thu gọn ở khối 1, cho thấy đúng cơ chế disclosure một dòng → danh sách đầy đủ.

---

## Quyết định cần chốt

1. **Tiêu đề tách khỏi content:** (a) làm trường riêng, `node.title` không còn derive từ dòng đầu `content` *(khuyến nghị)* · (b) giữ derive, chỉ thêm CSS cho dòng đầu trông giống tiêu đề (rẻ hơn, nhưng dòn: gõ Enter ngay sau dòng đầu sẽ đẩy một đoạn thân bài lên "thành" tiêu đề mới)
2. **Field "Notes" với idea:** (a) bỏ, gộp vào content *(khuyến nghị)* · (b) giữ, đổi vai trò rõ thành "ghi chú riêng tư" tách bạch khỏi content công khai
3. **Công cụ AI theo lựa chọn văn bản:** (a) bubble menu có "Hỏi Kira" với 3 hành động map vào action AI sẵn có + hỏi tự do *(khuyến nghị)* · (b) chỉ thêm hành động, chưa làm ô hỏi tự do (phạm vi nhỏ hơn, làm trước)
4. **Slash menu — khối nào làm trước:** (a) Text/Heading/List/Quote/Divider/To-do trước (toàn bộ dùng extension có sẵn hoặc MIT, không cần thiết kế node mới) *(khuyến nghị)* · (b) làm luôn cả Callout và Diagram-link trong cùng đợt
5. **Drag-handle kéo đổi thứ tự khối:** thân bài hôm nay là một document Tiptap liên tục, không có khái niệm "khối độc lập có thể kéo lên xuống" theo nghĩa Notion (Tiptap vẫn coi là các node trong một doc, kéo-thả giữa chúng cần thêm logic, không chỉ cài extension). (a) làm đủ (kéo-thả thật) *(phạm vi lớn hơn)* · (b) pha 1 chỉ làm nút "+" chèn khối tại vị trí, bỏ kéo-thả, thêm sau *(khuyến nghị cho pha 1, rẻ hơn nhiều)*

## Giới hạn

- Không sửa code, không chạy thử app — mọi mô tả hành vi dựa trên đọc mã nguồn tại `7829b85` và một ảnh chụp tĩnh duy nhất, không có video/thao tác thật để xác nhận animation hay độ trễ.
- Bảng màu light-mode trong specimen là suy luận theo tinh thần DESIGN.md, **không trích từ `buildProjectAppearanceStyle()` thật** (hàm này tính theo từng project, không có một "light mode mặc định" đơn giản để đọc tĩnh) — cần đối chiếu lại với app thật trước khi dùng specimen làm chuẩn pixel-exact.
- Chưa xác minh trực tiếp license của `@tiptap/extension-task-list`/`@tiptap/extension-task-item` (chỉ suy luận từ mẫu chung của monorepo `ueberdosis/tiptap`, nơi mọi package core đã kiểm đều là MIT) — nên tự `curl` hai file `package.json` đó trước khi thêm vào dependency thật.
- Phần "License Novel: Apache-2.0" chỉ có một nguồn, chưa xác thực chéo với repo chính chủ.
- Không đo hiệu năng của bubble menu/drag-handle trên văn bản dài hay nhiều node mở cùng lúc — rủi ro tương tự đã ghi trong `2026-09-21-canvas-performance-thresholds.md` (re-render) có thể lặp lại, cần QA Performance kiểm sau khi code xong, không nằm trong phạm vi báo cáo này.
- Muse (Ink & Switch) và Milanote chỉ có tư liệu công khai mỏng về chi tiết toolbar — kết luận về chúng ở mức tổng quát hơn Notion/Craft/tldraw.

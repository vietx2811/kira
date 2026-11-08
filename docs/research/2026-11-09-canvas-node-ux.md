# Node trên canvas: kiểm kê nút rải rác, học node tools khác, mô hình gom nút

- **Câu hỏi:** "chính bản thân các node cũng đang có UI chưa tối ưu, các nút chức năng đặt rải rác các bên chưa thực sự tiện lợi, học các node tools khác."
- **Người yêu cầu:** Orchestrator, chuyển từ user (2026-11-09), mở rộng phạm vi task node-editor-ux.
- **Commit đã kiểm chứng:** vixio `7c50ce7` (main, sau khi merge báo cáo trước). Nguồn ngoài truy cập 2026-11-09.
- **Kết luận ngắn:**
  1. Kiểm kê code xác nhận đúng cảm nhận của user bằng số liệu cụ thể: một node đang chọn hiện **tới 6 vị trí điều khiển nổi khác nhau cùng lúc** (góc trên-trái, góc trên-phải, một điểm gần góc trên-phải nữa, cạnh phải giữa, góc dưới-phải, và một thanh nổi riêng bên dưới node) — chưa tính chuột phải và double-click là hai đường riêng nữa.
  2. Phần lõn tốt: 5 loại node (idea/image/palette/diagram/placeholder) đã **dùng chung đúng 4 hàm render** cho các control này, nên về code không hề trùng lặp — cái rải rác là vị trí hiển thị, không phải logic.
  3. Hai lỗ hổng rõ: **chọn nhiều node không có thanh công cụ nào** (chỉ phím Delete và chuột phải giới hạn), và **có ba đường "hỏi AI" không ăn khớp nhau** (icon Kira ở góc, icon hành động cố định trong Details popover, và tray gợi ý 4 mục trong Kira dock) cho cùng một node.
  4. Khảo sát 7 công cụ node khác (FigJam, Miro, Excalidraw, tldraw, React Flow, ComfyUI, Scrintal/Kosmik) cho thấy pattern đúng mà KIRA đã có một phần (handle cạnh để kéo-nối, kiểu FigJam/Miro) và pattern KIRA còn thiếu (một thanh công cụ nổi DUY NHẤT theo lựa chọn thay vì rải góc, kiểu Figma/tldraw; handle gộp cả nối-dây lẫn tạo-node-mới trong một điều khiển, kiểu React Flow Button Handle và ComfyUI drag-to-empty-canvas).
  5. Đề xuất: gom 6 vị trí hiện tại về **một thanh công cụ nổi duy nhất, neo dưới node** (tái dùng đúng vị trí `.node-below-stack` đã có) + giữ resize là handle góc (thao tác trực tiếp, không phải lệnh, đúng quy ước mọi công cụ đã khảo sát) + gộp handle nối-dây và nút tạo-node-liên-kết thành một điều khiển duy nhất + thêm thanh công cụ multi-select cùng hình dạng + hợp nhất ba đường AI thành một nút "Ask Kira" có dropdown gợi ý theo loại node.

Nhãn nguồn: **[code]**, **[ngoài]**, **[ngoài-phụ]**, **[suy luận]**.

---

## 0. Kiểm kê hiện trạng [code], tại `7c50ce7`

Dựng fixture `window.__kiraDev.loadFixture(12)` trong Browser pane (`http://localhost:5173`), đặt một node mỗi loại qua tool rail (`Image placeholder`, `Palette`, `Idea`, `Sticker`, `Frame`, `Mermaid diagram` — 6 nút ở `canvas-bottom-bar`), chọn từng node, đối chiếu ảnh chụp zoom với CSS/JSX. Mọi vị trí dưới đây có cả bằng chứng `file:line` lẫn ảnh chụp xác nhận.

### 0.1 Bản đồ vị trí, 5 loại node đồ thị (idea/image/palette/diagram/placeholder)

5 loại này **dùng chung đúng 4 hàm render** — [main.tsx:9519](../../apps/desktop/src/main.tsx:9519) `renderDirectLinkHandle`, [:9544](../../apps/desktop/src/main.tsx:9544) `renderKiraControl`, [:9762](../../apps/desktop/src/main.tsx:9762) `renderResizeHandle`, [:9795](../../apps/desktop/src/main.tsx:9795) `renderNodeBelowStack` — gọi giống hệt nhau trong cả 5 khối JSX ([idea :11298](../../apps/desktop/src/main.tsx:11298), [image :11386](../../apps/desktop/src/main.tsx:11386), [palette :11468](../../apps/desktop/src/main.tsx:11468), [diagram :11532](../../apps/desktop/src/main.tsx:11532), [placeholder :11604](../../apps/desktop/src/main.tsx:11604)). Nên bảng dưới áp dụng cho cả 5 loại như nhau, không lặp lại cho từng loại.

| # | Điều khiển | Vị trí CSS | Khi nào hiện | Hành động | Nguồn |
|---|---|---|---|---|---|
| 1 | `.node-kira-control` (icon Kira) | `top:-9px; left:-9px` — **góc trên-trái** | Chỉ khi đã chọn | Mở Kira dock, neo vào node này | [main.tsx:9544](../../apps/desktop/src/main.tsx:9544), [styles.css:3910](../../apps/desktop/src/styles.css:3910) |
| 2 | `.node-add-control` (icon +) | `top:-9px; right:-9px` — **góc trên-phải** | Chỉ khi đã chọn | Mở Arc menu (4 nút tạo node liên kết mới) | [:9343](../../apps/desktop/src/main.tsx:9343), [styles.css:3873](../../apps/desktop/src/styles.css:3873) |
| 3 | `.node-prov-badge` ("AI" / "AI, đã sửa") | `top:-12px; right:10px` — **sát bên trái nút +**, chỉ cách ~19px | Chỉ khi node có provenance AI | Mở panel Kira Changes | [:9574](../../apps/desktop/src/main.tsx:9574), [styles.css:8886](../../apps/desktop/src/styles.css:8886) |
| 4 | `.node-link-handle` (icon Link2) | `top:50%; right:-10px` — **giữa cạnh phải** | Hover HOẶC đã chọn | Kéo để nối sang node khác | [:9519](../../apps/desktop/src/main.tsx:9519), [styles.css:3964](../../apps/desktop/src/styles.css:3964) |
| 5 | `.node-resize-handle` | `right:-7px; bottom:-7px` — **góc dưới-phải** | Chỉ khi đã chọn | Kéo đổi cỡ (double-click reset) | [:9762](../../apps/desktop/src/main.tsx:9762), [styles.css:4010](../../apps/desktop/src/styles.css:4010) |
| 6 | `.node-below-stack` (pill "Details" + "Delete") | `top:100%` — **một khối riêng trôi nổi bên dưới cả node**, không phải góc | Chỉ khi đã chọn, không mở arc/context menu, không multi-select | (i) mở popover sửa node; 🗑 xoá | [:9795](../../apps/desktop/src/main.tsx:9795), [:9868](../../apps/desktop/src/main.tsx:9868), [styles.css:4151](../../apps/desktop/src/styles.css:4151) |

Cộng hai đường không neo vào node face:

| # | Điều khiển | Vị trí | Nội dung | Nguồn |
|---|---|---|---|---|
| 7 | Chuột phải → `.node-context-menu` | Tại điểm click | 1 node: (image: Find similar/Crop/Extract palette) + Link + Delete. 2 node: Link selected + Delete. >2: chỉ Delete selected | [main.tsx:11701-11753](../../apps/desktop/src/main.tsx:11701) |
| 8 | Double-click | Tại node | Mở thẳng popover sửa node (bỏ qua nút (i)) | [:11322](../../apps/desktop/src/main.tsx:11322) `handleNodeDoubleClick` |

**Ảnh chụp xác nhận** (palette node đã chọn, zoom 160×70px): thấy rõ icon Kira góc trên-trái (chấm teal), "+" góc trên-phải, và handle Link nhô ra giữa cạnh phải — khớp 100% với vị trí CSS trên, không suy đoán.

### 0.2 Arc menu — mở từ nút "+" (#2 ở trên)

6 vị trí hình lục giác được định nghĩa trong CSS (`nth-child(1..6)` xếp vòng tròn quanh node, [styles.css:4123-4128](../../apps/desktop/src/styles.css:4123)) nhưng JSX **chỉ dùng 4**: tạo idea / image placeholder / palette / diagram liên kết ([main.tsx:11672-11698](../../apps/desktop/src/main.tsx:11672)). Hai vị trí còn lại trong CSS không có nút — dư thừa định nghĩa, không phải bug hiển thị nhưng là code chết nhẹ.

### 0.3 Ba đường "hỏi AI", không hợp nhất

| Đường | Vị trí | Nội dung | Vấn đề |
|---|---|---|---|
| A | `.node-kira-control` góc trên-trái (#1) | Mở Kira dock trống, neo node | Không có gợi ý ngay, phải gõ |
| B | Icon hành động trong action bar của Details popover (báo cáo 2026-11-09-node-editor-ux.md §0.1) | **Một hành động cố định theo loại node**, hardcode (`aiNodeActionPrompts`), vd "Create outline" cho idea | Không đổi được, không thấy 3 gợi ý còn lại |
| C | `kiraSuggestions[kind]` ([main.tsx:296-331](../../apps/desktop/src/main.tsx:296)) — tray 4 gợi ý mỗi loại node, hiện trong Kira dock sau khi mở qua đường A | 4 gợi ý thật sự khác nhau theo kind (vd idea: "Sharpen this into a positioning line", "What would kill this idea?"...) | Chỉ thấy được **sau khi** đã mở dock qua đường A — không lộ diện ở node face |

Ba đường trỏ vào ba đoạn code khác nhau, không đường nào biết về 4 gợi ý thật sự phong phú (`kiraSuggestions`) trừ khi user đã mở dock. "Mở rộng nhánh" (`expandNodeIntoBranches`, [main.tsx:5576](../../apps/desktop/src/main.tsx:5576), dùng `break_down`/`generate_variations`, tạo batch node con + link, undo được qua `create-nodes-batch`) **không có nút nào trên node face gọi tới nó trực tiếp** — chỉ tới được qua việc gõ đúng ý vào Kira dock, dù đây chính là tính năng "phát huy tính năng hỗ trợ của app" mạnh nhất hiện có.

### 0.4 Multi-select: không có thanh công cụ

`renderNodeBelowStack` trả `null` ngay khi `multiSelectedNodes.length > 0` ([main.tsx:9797](../../apps/desktop/src/main.tsx:9797)) — tức khi chọn nhiều, **không node nào còn pill Details/Delete, và cũng không có gì thay thế**. Grep toàn file xác nhận không tồn tại `multi-select-toolbar` hay tương đương. Đường duy nhất tác động lên nhiều node: phím Backspace/Delete (xoá), hoặc chuột phải khi đúng 2 node (chỉ có "Link selected" + "Delete selected", không áp dụng khi chọn 3+).

### 0.5 Frame — hệ chrome hoàn toàn khác, không liên AI/link

`FrameNode` ([main.tsx:10958-11060](../../apps/desktop/src/main.tsx:10958)) không gọi bất kỳ hàm `render*` nào ở §0.1 — tự vẽ riêng: nhãn tiêu đề/mô tả sửa tại chỗ (double-click), handle resize góc dưới-phải, và một pill riêng chỉ có nút Delete khi chọn. Không có "+", không Kira, không Link handle, không provenance. Hợp lý vì Frame là khung nhóm (như Figma/FigJam), không phải node nội dung — nhưng cũng có nghĩa **không có cách hỏi AI về nội dung bên trong một frame** như một nhóm, dù tính năng "Mở rộng nhánh" lẽ ra rất hợp với "viết thêm ý cho nhóm này".

### 0.6 Sticker — biến thể hiển thị của idea, không phải loại node riêng

`idea.variant === 'sticker'` chỉ thêm class CSS xoay nhẹ (`--sticker-rotation`) và style khác, dùng chung toàn bộ 6 điều khiển ở §0.1 vì vẫn là `kind: 'idea'`. Nút "Sticker" trên tool rail và "Sticky note" trong canvas context menu đều tạo ra idea với `variant: 'sticker'` ([main.tsx:5170](../../apps/desktop/src/main.tsx:5170)).

---

## 1. Học node tools khác

| Công cụ | Điều đáng học | Nguồn |
|---|---|---|
| **FigJam** | Hover vào chấm xanh trên cạnh sticky đã chọn hiện icon "quick create": kéo nó tạo sticky mới **và tự nối connector** cùng lúc — đúng một thao tác cho cả "tạo node mới" lẫn "nối dây", việc KIRA hiện tách thành hai điều khiển riêng (handle Link kéo sang node *có sẵn*, nút + mở menu tạo node *mới* nhưng không kéo-thả được). Phím tắt Cmd/Ctrl+Enter cũng tạo sticky liền kề, không cần chuột. | [ngoài, Figma Help Center](https://figma-signup.helpjuice.com/work-on-boards/build-faster-with-quick-create-in-figjam) |
| **Miro** | Cùng mô hình "chấm xanh quanh cạnh, kéo để nối" — xác nhận đây là pattern chuẩn ngành cho canvas tự do, không phải riêng FigJam. Việc "click cạnh sticky để tạo sticky thứ hai đã nối sẵn" được cộng đồng Miro mô tả như một use case ít người biết, gợi ý nên làm nó **rõ ràng hơn** trong UI thay vì ẩn. | [ngoài-phụ, Miro Community](https://community.miro.com/ask-the-community-45/on-hover-action-button-to-move-some-object-into-focus-9248) |
| **tldraw** | Bảng điều khiển style theo lựa chọn chỉ hiện đúng thuộc tính áp dụng được — không phải mọi node đều thấy mọi nút (đã dẫn trong báo cáo trước). Áp vào đây: một thanh công cụ DUY NHẤT thay vì rải 6 vị trí, nội dung bên trong thanh mới cần đổi theo loại node (vd image có thêm "Find similar", "Crop"), chứ không phải vị trí các nút thay đổi. | [ngoài, tldraw docs](https://tldraw.dev/examples/contextual-style-panel) |
| **Excalidraw** | Một panel duy nhất xuất hiện khi có lựa chọn (vị trí panel có nguồn mâu thuẫn nhau giữa trái và trên, chưa xác thực chính thức), nội dung lọc theo loại phần tử đã chọn — cùng nguyên tắc "một nơi, nội dung co giãn" như tldraw. | [ngoài-phụ, UofT support guide](https://support.ischool.utoronto.ca/?p=780) — độ tin cậy thấp, một nguồn, chưa đối chiếu docs chính thức |
| **React Flow** | `ButtonHandle` — một component chính thức **gộp handle (điểm nối) và nút bấm làm một**: ẩn nút khi đang kéo dây nối (qua `useConnection`), hiện nút khi rảnh. Đây là bằng chứng trực tiếp rằng gộp "nối dây" và "tạo node mới" vào MỘT điều khiển là pattern đã được chuẩn hoá, không phải ý tưởng chưa ai làm. | [ngoài, reactflow.dev](https://reactflow.dev/ui/components/button-handle) |
| **ComfyUI** | Kéo từ cổng input/output rồi thả vào **canvas trống** (không nhắm vào node khác) bật menu các loại node tương thích để tạo mới và tự nối — khác với KIRA, nơi handle Link chỉ hoạt động khi thả trúng một node có sẵn ([main.tsx:9508-9513](../../apps/desktop/src/main.tsx:9508) `finishDirectLink` return sớm nếu `elementFromPoint` không trúng node). | [ngoài, comfyui-wiki.com](https://comfyui-wiki.com/interface/node-options) |
| **n8n** | Nút "+" riêng mở panel chọn loại node, menu "⋯" riêng cho tuỳ chọn node — xác nhận việc tách "tạo mới" khỏi "tuỳ chọn node" thành hai nút là bình thường trong giới workflow-editor, không bắt buộc gộp hết vào một chỗ; nhưng KIRA hiện có *nhiều hơn hai* điểm vào, không phải hai. | [ngoài-phụ, n8n docs, dẫn chứng mỏng] |
| **Scrintal** | Sidebar phải liệt kê link + backlink của card đang chọn khi cần tra cứu quan hệ — một bề mặt gọn hơn việc rải badge/handle quanh từng node. Không trực tiếp áp dụng vào phạm vi task này (đó là bề mặt "xem quan hệ toàn bảng", khác "chrome của một node") nhưng đáng ghi nhận làm hướng mở rộng sau. | [ngoài-phụ, scrintal.com](https://scrintal.com/features/link-your-notes) |
| **Kosmik** | Mọi thứ là "card", card từ canvas này dùng lại được ở canvas khác (transclusion kiểu Roam/Obsidian) — tư liệu công khai mỏng, không đủ chi tiết về chrome từng node để khảo sát sâu hơn. | [ngoài-phụ, MacStories, nguồn mỏng](https://www.macstories.net/sponsored/kosmik-for-all-mindkind-sponsor-2/) |
| **Figma/Miro/tldraw (đối chứng chung)** | Cả ba đều có **thanh công cụ nổi khi chọn nhiều phần tử** (align, group, xoá hàng loạt...) — xác nhận multi-select-không-có-gì-cả của KIRA (§0.4) là khoảng trống thật, không phải lựa chọn thiết kế có chủ đích của ngành. | [suy luận, tổng hợp từ hành vi phổ biến của cả 3 công cụ] |

---

## 2. Mô hình gom nút đề xuất

### 2.1 Nguyên tắc

1. **Một vị trí cho lệnh, một vị trí cho thao tác trực tiếp.** Resize là kéo-thả trực tiếp (direct manipulation) nên giữ nguyên là handle góc — không đưa vào thanh công cụ (đúng quy ước cả tldraw/Figma/React Flow). Mọi thứ còn lại là *lệnh* (Ask Kira, Delete, Details, Link, Expand) nên gom vào **một thanh công cụ duy nhất**, không rải góc.
2. **Gộp handle Link và nút + thành một điều khiển**, theo đúng bằng chứng React Flow `ButtonHandle` + hành vi FigJam/Miro: kéo sang node có sẵn → nối; kéo ra canvas trống → bật menu tạo node liên kết (như ComfyUI, thay vì phải click "+", đợi arc menu, chọn loại — 3 bước hiện tại rút còn 1 cử chỉ kéo-thả cho trường hợp phổ biến, menu chọn loại chỉ hiện khi thả vào chỗ trống).
3. **Một nút "Ask Kira" duy nhất, có dropdown**, thay thế cả 3 đường ở §0.3: click mở dropdown gồm 4 gợi ý thật của `kiraSuggestions[kind]` + mục "Mở rộng nhánh" (gọi thẳng `expandNodeIntoBranches`, không cần gõ đúng từ khoá trong chat) + "Hỏi câu khác..." (mở dock trống, đường A cũ). Xoá đường B (icon hardcode trong Details popover) — nội dung của nó (`aiNodeActionPrompts`) đã là tập con của `kiraSuggestions`.
4. **Multi-select dùng CÙNG HÌNH DẠNG thanh công cụ**, neo dưới vùng chọn (bounding box), nội dung co giãn theo tldraw/Excalidraw §1: khi đúng 2 node thì có thêm "Link 2 node"; khi có idea/image lẫn lộn thì "Ask Kira" vẫn hoạt động (API `collectKiraContextForSources` đã nhận nhiều nguồn, không cần sửa backend); thêm "Nhóm vào Frame" (gọi `onCreateFrame` bọc quanh bounding box hiện có) — vá khoảng trống multi-select nêu ở §0.4 bằng đúng pattern đã khảo sát ở Figma/Miro/tldraw.
5. **Frame dùng lại cùng vỏ thanh công cụ**, chỉ ẩn bớt mục không áp dụng (không Ask Kira/Link ở bản đầu, có thể thêm "Ask Kira về nhóm này" sau — xem Quyết định #4), để toàn app chỉ có MỘT ngôn ngữ thanh công cụ, không phải hai hệ song song như hiện tại (§0.5).
6. **Provenance badge không còn là điều khiển nổi riêng** — gộp vào mặt node như một chip nhỏ cạnh icon loại/status dot (thông tin, không phải lệnh chính, click vẫn mở Kira Changes) thay vì cạnh tranh vị trí với nút + ở góc trên-phải như hiện tại (§0.1 #3, chỉ cách nhau 19px).

### 2.2 Trước/sau

**Trước (hiện tại, §0.1):** 6 vị trí quanh node + 2 đường ngoài node (context menu, double-click) + 3 đường AI không hợp nhất + 0 công cụ khi multi-select + 1 hệ chrome riêng cho Frame.

**Sau (đề xuất):**
- 1 handle resize (góc dưới-phải, không đổi — thao tác trực tiếp)
- 1 handle Link/Expand gộp (cạnh phải giữa, không đổi vị trí — chỉ gộp hành vi)
- 1 thanh công cụ nổi dưới node: `[Ask Kira ▾] [Details] [Delete]` — thay cho 4 vị trí cũ (Kira góc trái, + góc phải không còn vì đã gộp vào handle Link, pill Details/Delete cũ, provenance badge cũ chuyển vào mặt node)
- Cùng thanh công cụ đó, nội dung co giãn, dùng được khi multi-select và khi chọn Frame
- Chuột phải và double-click giữ nguyên làm đường tắt cho power user, nội dung đồng bộ với thanh công cụ mới (không còn là hai danh sách lệnh khác nhau)

Từ 6 vị trí + 3 đường AI rời rạc + 0 multi-select → còn **2 handle thao tác trực tiếp + 1 thanh lệnh thống nhất**, dùng được cho mọi trạng thái chọn (1 node, nhiều node, Frame).

### 2.3 Khớp với editor overlay và orb Kira

- Nút "Details" trong thanh công cụ mới mở đúng popover đã đề xuất tái thiết kế ở `2026-11-09-node-editor-ux.md` (tiêu đề riêng, bubble menu, slash menu) — không đổi gì thêm ở đây, chỉ là điểm vào không đổi.
- Nút "Ask Kira" mở đúng `kira-dock`/orb đã có (`renderKiraDock`, [main.tsx:10250](../../apps/desktop/src/main.tsx:10250)) — không tạo panel AI mới, chỉ đổi **cách vào** dock từ 3 đường rời rạc thành 1 đường có dropdown gợi ý ngay tại chỗ.
- "Mở rộng nhánh" đổi từ "chỉ gõ đúng ý vào chat" thành "một mục trong dropdown Ask Kira" — không đổi logic `expandNodeIntoBranches`/`create-nodes-batch`, chỉ thêm lối vào trực tiếp từ node face.

---

## 3. Specimen

File: [`docs/research/2026-11-09-canvas-node-ux-specimen.html`](2026-11-09-canvas-node-ux-specimen.html), dark + light, token thật từ `styles.css`. Bốn khối:

1. **Hiện trạng** — một node idea đã chọn, tái hiện đúng 6 vị trí điều khiển từ §0.1 (bao gồm provenance badge chen sát nút +), có chú thích vị trí bằng số khớp bảng §0.1.
2. **Đề xuất** — cùng node, chỉ còn 2 handle (resize góc, Link/Expand gộp cạnh phải) + 1 thanh công cụ dưới node (`Ask Kira ▾ / Details / Delete`).
3. **Dropdown Ask Kira mở** — 4 gợi ý theo kind (vd idea) + "Mở rộng nhánh" + "Hỏi câu khác...", minh hoạ §2.1 mục 3.
4. **Multi-select** — 2 node được chọn, thanh công cụ neo dưới vùng chọn chung với "Link 2 node" + "Nhóm vào Frame" + "Ask Kira" + "Delete", minh hoạ §2.1 mục 4 (khoảng trống hiện tại ở §0.4).

---

## Quyết định cần chốt

1. **Gộp handle Link + nút tạo-node thành một điều khiển** (đề xuất §2.1 mục 2): (a) làm, theo đúng React Flow ButtonHandle *(khuyến nghị)* · (b) giữ tách hai điều khiển như hiện tại, chỉ đổi vị trí cho đỡ chồng — rẻ hơn, nhưng không giải quyết gốc "3 bước cho 1 việc"
2. **Xoá đường AI cố định trong Details popover (đường B, §0.3)**, thay bằng dropdown "Ask Kira" dùng chung `kiraSuggestions`: (a) xoá hẳn, hợp nhất *(khuyến nghị)* · (b) giữ cả hai song song một thời gian (rủi ro: lại thành đường AI thứ 3 mới)
3. **Vị trí thanh công cụ hợp nhất:** (a) dưới node, tái dùng `.node-below-stack` đã có *(khuyến nghị, rẻ nhất, không cần layout mới)* · (b) trên node, theo thói quen Figma/Excalidraw (cần layout mới, tránh che node phía trên khi board dày đặc)
4. **Frame có nên có "Ask Kira về nhóm này" ngay trong pha 1 hay để sau:** (a) để sau, pha 1 chỉ thêm vỏ thanh công cụ + Delete cho nhất quán thị giác *(khuyến nghị, phạm vi nhỏ hơn)* · (b) làm luôn, cần nối Frame vào `collectKiraContextForSources` (hiện hàm này nhận `GraphNodeRef[]`, Frame không phải `GraphNodeKind` nên cần mở rộng kiểu)
5. **Multi-select "Nhóm vào Frame":** (a) thêm trong pha này *(khuyến nghị theo đúng khoảng trống đã đo ở §0.4)* · (b) tách thành task riêng, pha này chỉ thêm "Ask Kira" + "Delete" cho multi-select, bỏ "Link 2 node" và "Nhóm vào Frame" lại

## Giới hạn

- Không sửa code — mọi vị trí, hành vi được xác nhận bằng `file:line` + ảnh chụp zoom trong Browser pane (fixture `loadFixture(12)`), không suy đoán.
- Vị trí panel chọn phần tử của Excalidraw có nguồn mâu thuẫn (trái vs trên) — không tự chạy Excalidraw thật để trọng tài, ghi rõ độ tin cậy thấp.
- Miro/FigJam: không có tài khoản/board thật để tự thao tác, dựa vào tài liệu trợ giúp chính thức (FigJam) và bài viết cộng đồng (Miro) — FigJam đáng tin hơn Miro trong khảo sát này.
- Kosmik, Scrintal, n8n: tư liệu công khai mỏng về đúng câu hỏi "chrome quanh một node/card" — kết luận về chúng ở mức tổng quát, không nên trích dẫn như bằng chứng chính cho quyết định thiết kế.
- Không đo ảnh hưởng hiệu năng của việc gộp Link+Expand handle (thêm một nhánh logic drop-vào-chỗ-trống) — nếu triển khai, nên đối chiếu `2026-09-21-canvas-performance-thresholds.md` vì đang có sẵn cảnh báo re-render trên board đông node.
- Đề xuất ở §2 chưa tính trạng thái `graphMode === 'discover'` (chế độ chỉ xem, `renderResizeHandle` đã tắt khi khác `'edit'`) — cần xác nhận thanh công cụ mới có nên ẩn bớt mục sửa (Delete, Link) trong chế độ đó hay không, chưa đọc đủ code của `discover` mode để khẳng định.

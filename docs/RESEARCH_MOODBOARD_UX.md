# Nghiên cứu: Multi-tab, Capture, và UX moodboard cho KIRA

Ngày: 2026-07-26 · Phạm vi: `apps/desktop`, `apps/extension`
Góc nhìn: giảm ma sát cho người làm creative — gom tư liệu nhanh, nghĩ chậm, trình bày sạch.

---

## 0. Hiện trạng đã xác minh trong code

| Vùng | Sự thật trong code |
|---|---|
| Tab / nhiều file | **Không tồn tại.** Toàn bộ state nằm phẳng trong `App()` ([main.tsx:1322](../apps/desktop/src/main.tsx:1322)); một `projectPackage` duy nhất; `tauri.conf.json` khai báo đúng 1 window; `localStorage['kira:lastProjectPath']` là 1 đường dẫn ([main.tsx:1613](../apps/desktop/src/main.tsx:1613)) |
| Capture context | `createKiraCaptureContext()` chỉ mô tả **một** file đang mở ([main.tsx:11390](../apps/desktop/src/main.tsx:11390)) |
| Overlay trên canvas | 6 vùng nổi: tool rail (bottom-center), secondary rail (**top-right**), graph-tools drawer (**top-right**, dưới rail), AI node panel (bottom-right), arc menu (trên node), context menu (tại con trỏ) |
| Kích thước node | `nodeScale = (0.78 + importance × 0.15) × densityScale` ([main.tsx:12511](../apps/desktop/src/main.tsx:12511)); `importance` bị clamp 0.25–5 → scale thực **0.82–1.53**; chỉ chỉnh được qua context menu ±0.25 ([main.tsx:7455](../apps/desktop/src/main.tsx:7455)). Không có handle resize |
| Node ảnh | Hộp **cứng 96×86px**, `object-fit: cover` ([styles.css:2703](../apps/desktop/src/styles.css:2703), [styles.css:1746](../apps/desktop/src/styles.css:1746)) → **mọi ảnh bị crop về 1.12:1**, không hiện tên |
| Node idea | 224px; khi selected đổi `display:grid → block` và width 224→248 ([styles.css:2582](../apps/desktop/src/styles.css:2582)) → **layout shift mỗi lần click** |
| Vào edit | Click 1 lần vào title/body là vào input ([main.tsx:7146](../apps/desktop/src/main.tsx:7146), [:7170](../apps/desktop/src/main.tsx:7170)) → nguồn gốc của "lỡ tay" |
| Layout engine | ELK `layered` cho **cả 7** organize mode ([main.tsx:12602](../apps/desktop/src/main.tsx:12602)); thử 4 hướng, chọn candidate ít overlap/crossing nhất |
| Extension | Content script `fetch()` thẳng `http://127.0.0.1:47653` ([content.ts:989](../apps/extension/src/content.ts:989)) — **không đi qua service worker** |
| Safari | Dùng **y hệt** manifest + bundle của Chrome (diff = rỗng) |
| Dependency chưa khai thác | `image = "0.25"` (Rust, có sẵn), `zustand` + `zundo`, `react-rnd`, `culori` |

---

## 1. Multi-tab

### Chẩn đoán
App hiện là **single-document**. Muốn multi-tab thì không phải thêm một thanh tab — mà phải tách "state của một file" ra khỏi `App()`. Đây là refactor lớn nhất trong toàn bộ danh sách này, nhưng cũng là cái mở khoá cho tất cả phần còn lại (đặc biệt là extension).

### Mô hình đề xuất: tab = file, không phải tab = view

Đây là điểm quan trọng nhất. Hiện `Canvas / 3D / Slides / Outline` đang được render dưới class `.view-tab` — tức là **chỗ của tab đang bị view chiếm mất**. Người dùng creative nghĩ "tab = dự án", không phải "tab = góc nhìn". Cần đổi vai:

```
┌──────────────────────────────────────────────────────┐
│ ●●●  [Bánh mì Huế] [F&B Q3] [Nghiên cứu chữ] [+]     │  ← TAB = FILE
├──────────────────────────────────────────────────────┤
│ Library │        canvas             │ Inspector      │
│         │  ⌄ Canvas   ▸ Present  ⓘ  │                │  ← VIEW = segmented, nhỏ
```

### Kiến trúc

```ts
type FileSession = {
  id: string
  package: ProjectPackageInfo | null
  title: string
  snapshot: ProjectSnapshot        // ideas/images/links/...
  ui: { selection, activeView, graphTransform, activeTool }
  history: CanvasHistoryStore      // undo RIÊNG mỗi tab — bắt buộc
  isDirty: boolean
}

type Workspace = { files: FileSession[]; activeFileId: string }
```

**Quy tắc bắt buộc:**
1. **Undo phải per-tab.** Hiện `CanvasHistoryStore` là global ([main.tsx:482](../apps/desktop/src/main.tsx:482)). Undo ở tab A mà xoá node ở tab B là lỗi phá hoại niềm tin — không sửa được bằng UX.
2. **Chỉ tab active render nặng.** Tab nền giữ snapshot + thumbnail, không mount GraphCanvas/Three.js. Nếu không, 4 tab = 4 WebGL context.
3. **Kéo node giữa tab.** Kéo một node lên nhãn tab → sau ~600ms tự chuyển sang tab đó (spring-loaded folder, giống Finder/Chrome). Đây là tính năng "đắt" nhất cho creative: gom rác vào 1 board, phân loại sang các board khác.
4. **Đóng tab dirty phải hỏi**, và nhớ vị trí camera khi mở lại.

### Ranh giới nên giữ
- **Không** làm nhiều cửa sổ Tauri ở bước 1. Nhiều window = nhiều instance React = phải đồng bộ capture server, đau gấp 3 lần mà lợi ích thấp hơn tab.
- Có thể mở window thứ hai **sau**, chỉ cho chế độ Present (trình chiếu ra màn hình phụ) — đó là ca duy nhất thật sự cần cửa sổ rời.

### Lộ trình
| Bước | Việc | Rủi ro |
|---|---|---|
| 1 | Bọc state file hiện tại vào `createFileStore()` (zustand + zundo đã có sẵn trong deps) | Trung bình — đụng ~800 dòng trong `App()` |
| 2 | `files[]` + `activeFileId`, tab bar thay `.view-tab`, view thành segmented control nhỏ | Thấp |
| 3 | Lazy mount, thumbnail tab nền, undo per-tab | Thấp |
| 4 | Kéo node qua tab + spring-load | Thấp |
| 5 | Capture context multi-file (xem §2) | Thấp |

---

## 2. Extension Chrome & Safari

### 2.1 Ba lỗi kỹ thuật cần sửa trước

**a) Content script gọi thẳng localhost — sẽ vỡ.**
`content.ts:989` `fetch('http://127.0.0.1:47653/capture')` chạy trong ngữ cảnh trang. Từ Chrome 142, **Local Network Access** chặn request từ trang public tới loopback. Extension có `host_permissions` được miễn — **nhưng chỉ khi request phát từ service worker**, không phải từ content script. Sửa:

```ts
// content.ts
chrome.runtime.sendMessage({ type: 'kira-capture', capture })
// background.ts đã có sẵn postCapture() — chỉ cần thêm listener
```
Đồng thời bỏ được `Access-Control-Allow-Origin: *` quá rộng ở [lib.rs:3692](../apps/desktop/src-tauri/src/lib.rs:3692) — server chỉ cần nhận từ origin extension.

**b) `/context` chỉ trả 1 file.** Với multi-tab, phải đổi shape:
```ts
type KiraCaptureContext = {
  app: 'kira'
  files: Array<{ id, title, isActive, thumb?, nodes: KiraCaptureNode[] }>
  updatedAt: string
}
```

**c) Safari dùng bundle y hệt Chrome.** Diff manifest = rỗng. Những chỗ sẽ hỏng âm thầm:
- `chrome.action.openPopup()` ([background.ts:74](../apps/extension/src/background.ts:74)) — **Safari không hỗ trợ**. Fallback hiện tại là im lặng mất capture.
- Service worker Safari bị kill rất nhanh → mọi state trong biến module (`dragWindowId`, `currentContext`) phải chuyển sang `chrome.storage.session`.
- Safari cần user cấp quyền **từng site**; lần đầu trên mỗi domain sẽ không có content script → cần đường dự phòng qua context menu (chạy ở background, không cần content script).
- Cần một `manifest.safari.json` riêng + `browser.*` polyfill, thay vì copy thẳng.

### 2.2 UX capture: giảm từ 3 quyết định xuống 1

Hiện tại drop pad bắt chọn ngay: *undecided* / *create idea* / *node cụ thể* ([content.ts:682](../apps/extension/src/content.ts:682)). Đây là ma sát sai chỗ — lúc đang lướt web, người dùng đang ở **chế độ gom**, không phải chế độ **phân loại**. Bắt phân loại lúc đó làm gãy dòng chảy.

**Nguyên tắc: lúc capture chỉ hỏi thứ rẻ nhất — vào board nào. Node để trong app.**

```
Kéo ảnh ra mép màn hình → hiện shelf:

┌─────────────────────────────────────────┐
│  ▸ Bánh mì Huế      ← board đang mở     │  ⏎ = thả vào đây
│    F&B Q3                               │  1/2/3 = phím tắt
│    Nghiên cứu chữ                       │
│    + Board mới…                         │
└─────────────────────────────────────────┘
Thả nhanh (không chọn) → vào board active, Inbox.
```

Chi tiết đáng làm:
- **Enter/thả nhanh = board active.** Không quyết định gì cũng có kết quả đúng 90% trường hợp.
- **Gom nhiều ảnh.** Alt+click liên tiếp trên nhiều ảnh trong 1 trang → 1 chồng, thả 1 lần. Hiện popup đã liệt kê ảnh trong trang ([popup.ts](../apps/extension/src/popup.ts)) nhưng phải mở popup mới dùng được.
- **Luôn kèm ngữ cảnh nguồn.** Đang lưu `pageUrl`, `source` — nên lưu thêm **text quanh ảnh** (caption/alt/heading gần nhất). Với người làm brand, "ảnh này ở đâu ra, nói về cái gì" quan trọng ngang bản thân ảnh, và về sau là nhiên liệu cho tag/OCR.
- **Bắt ảnh độ phân giải cao.** `bestImageUrlFromImage()` đã đọc srcset ([content.ts:247](../apps/extension/src/content.ts:247)) — tốt. Bổ sung: Pinterest/Behance/Instagram dùng URL có pattern kích thước (`/236x/` → `/originals/`); một bảng rewrite nhỏ ~20 dòng cho 5–6 site sẽ nâng chất lượng tư liệu rõ rệt.
- **Trạng thái phải nhìn thấy.** Khi app đóng, hiện đang fallback im lặng vào `chrome.storage`. Cần badge số "đang chờ" trên icon + tự đẩy khi app mở lại.

---

## 3. Vị trí nút, mode, overlay

### Chẩn đoán
Ba vấn đề cụ thể, không phải cảm tính:

1. **Góc trên-phải bị chồng 3 lớp.** TopBar có Settings + Inspector toggle; ngay dưới đó `canvas-secondary-rail` (zoom + status + Edit/Discover + ⋯) ở `top:14 right:14`; bung ra nữa là `graph-tools-drawer` ở `top:60 right:14`. Ba nhóm chức năng không liên quan chen vào một góc.
2. **Zoom đặt sai chỗ.** Zoom đang ở top-right. Mọi công cụ canvas mà creative đã quen (Figma, Miro, FigJam, Sketch) đặt zoom ở **dưới**, gần tay cầm chuột, xa vùng menu.
3. **Hai hệ menu song song cho cùng một việc.** Arc menu (bấm dấu `+` trên node) và context menu (chuột phải) đều là "hành động trên node", nhưng tập lệnh khác nhau — arc menu tạo node liên kết, context menu chỉnh importance/xoá. Người dùng phải nhớ *hai* nơi.

### Đề xuất: khoá cứng 4 góc, không góc nào đổi theo mode

```
┌───────────────────────────────────────────────────────────┐
│ ●●● [tab] [tab] [tab] +          ⌄Canvas ▸Present  ⓘ      │  ← file / view+inspector
│                                                           │
│ ┌────┐                                                    │
│ │ Li │              CANVAS                                │
│ │ br │                                                    │
│ │ y  │        ┌──────────────────────┐                    │
│ └────┘        │ ✎  ⧉  🎨  ⤢  ⋯  🗑  │ ← toolbar theo     │
│               └──────────────────────┘   selection, nổi   │
│                                          ngay dưới node   │
│  ⊞ Sắp xếp ▾                              ─ 100% ＋ ⊙ 12/40│
└───────────────────────────────────────────────────────────┘
   ↑ bottom-left: layout                    ↑ bottom-right: zoom + đếm
        ┌──────────────────┐
        │ ⌖  ⇢  ▭  ◐  💡  │ ← bottom-center: tạo node (giữ nguyên, đang đúng)
        └──────────────────┘
```

**Các nước đi cụ thể:**

| Việc | Lý do |
|---|---|
| Zoom + đếm node → **bottom-right** | Chuẩn ngành; giải phóng top-right |
| `graph-tools-drawer` (cap/scope/relation/organize) → popover **"Sắp xếp"** ở bottom-left | Đây là *view options*, không phải *hành động*; gom cạnh nút Organize thay vì trong menu ⋯ |
| Edit/Discover → segmented cạnh view switcher trên đỉnh | Nó là **chế độ**, cùng cấp với Canvas/Outline |
| Gộp arc menu + context menu → **1 selection toolbar** nổi dưới node đang chọn | Một nơi duy nhất. Chuột phải mở đúng toolbar đó. Bỏ được `.node-arc-menu` (~50 dòng CSS toạ độ tuyệt đối) |
| `ai-node-panel` (bottom-right) → gọi từ selection toolbar, hiện tại con trỏ | Đang giành chỗ với zoom |
| Nút `+` trên mỗi node hiện khi hover → **chỉ hiện khi node được chọn** | Với 40 node, hover ra menu = nhiễu liên tục |

**Nguyên tắc để về sau không lệch lại:** *một góc = một loại quyết định.* Trên = "tôi đang ở đâu", dưới-giữa = "tôi tạo gì", dưới-trái = "hiển thị thế nào", dưới-phải = "tôi đang nhìn ở đâu", nổi cạnh node = "làm gì với cái này".

---

## 4. Canvas / 3D / Slides có giúp làm moodboard không?

Trả lời thẳng:

| Mode | Có giúp? | Kết luận |
|---|---|---|
| **Canvas** | Có — đây là sản phẩm | Giữ, đầu tư toàn bộ |
| **3D** | **Không** | Hạ cấp khỏi thanh chính |
| **Slides** | Có, nhưng sai vị trí | Đổi thành **hành động** `Present`, không phải mode |
| **Outline** | Có | Giữ, là "đầu ra" của board |

### 3D — bỏ khỏi thanh chính

Không có thao tác nào của người làm moodboard được 3D làm tốt hơn 2D: không so sánh được màu (phối cảnh làm sai lệch màu), không đọc được bố cục, không sửa được node, mất object permanence khi xoay. Nó tốn `three` + `3d-force-graph` — nhóm dependency nặng nhất trong `package.json`. Chính `docs/ROADMAP.md` đã ghi *"evaluate 3d-force-graph only as optional discovery, not core CRUD"* và liệt "3D-first graph editing" vào Deferred. Code hiện đang mâu thuẫn với roadmap của chính nó.

**Đề xuất:** bỏ khỏi TopBar, giữ như một lệnh trong palette (`⌘K → "Xem 3D"`) hoặc bỏ hẳn. Nếu giữ, hãy có mục tiêu rõ: 3D chỉ đáng tồn tại nếu trả lời được câu "board này có cụm nào bị cô lập" — mà việc đó dùng **minimap 2D + heatmap density** rẻ hơn và đọc dễ hơn nhiều.

### Slides — đổi từ "mode" sang "đầu ra"

Present **có** giá trị thật: người làm brand phải trình cho khách. Nhưng nó không phải chỗ để *làm việc*, nên đặt ngang hàng Canvas là sai — nó chiếm một ô trong ngân sách chú ý vốn chỉ nên có 2–3 ô.

Ba tính năng đáng làm cho Present:
1. **Board → deck có ý nghĩa.** Hiện `buildSlideLayouts()` sinh slide từ idea. Với moodboard thì đơn vị nên là **cụm** (cluster): mỗi cụm = 1 slide, ảnh trong cụm xếp theo justified grid, palette của cụm ở chân slide. Đây là cách art director thật sự trình bày.
2. **Present từ chính canvas** — bấm `Present` là zoom mượt qua từng cụm trên canvas thật (kiểu Prezi/Figma Slides), không phải chuyển sang màn khác. Không phải build lại layout, không phải học UI thứ hai.
3. **Xuất PDF/PPTX là đường thoát**, không phải sản phẩm chính. Đã có `pptxgenjs` — đủ.

### Canvas — cái thật sự cần đầu tư cho moodboard

Cần bổ sung 4 thứ, xếp theo giá trị:

1. **Nhóm / frame.** Moodboard là *các cụm có tên*: "Hướng A – tối giản Hàn", "Hướng B – dân gian". Hiện chỉ có node rời + link. Frame (kiểu Figma) là thứ thiếu quan trọng nhất — nó biến canvas từ "đống ảnh" thành "phương án".
2. **So sánh cạnh nhau.** Chọn 2–3 ảnh → `Space` → xem full-bleed cạnh nhau, so màu, thoát. Chỉ 30 dòng code, dùng liên tục.
3. **Palette theo vùng.** Đã có `analyzePixels()` cho từng ảnh. Kéo thêm một bước: palette **của một frame** = trộn palette các ảnh trong frame → đây chính là output mà art director cần mang đi.
4. **Chú thích rời (sticky/text tự do).** Hiện muốn viết ghi chú phải tạo `idea` node — mà idea là thực thể ngữ nghĩa đi vào outline. Trộn hai thứ này làm outline bẩn. Cần một node text "câm" không tính vào graph.

---

## 5. Sắp xếp node — đã tối ưu chưa?

### Chẩn đoán
**Chưa.** Cả 7 organize mode (`cluster / flow / timeline / palette / importance / grid / manual`) đều chạy qua **một** thuật toán: ELK `layered` ([main.tsx:12602](../apps/desktop/src/main.tsx:12602)). `layered` là thuật toán **phân tầng có hướng** — đúng cho sơ đồ luồng, sai cho moodboard. "Cluster" và "grid" chạy layered thì ra kết quả gần như nhau, chỉ khác thứ tự sort đầu vào.

Vấn đề thứ hai: `layoutDensityScale()` ([main.tsx:12515](../apps/desktop/src/main.tsx:12515)) thu nhỏ node xuống **0.24×** khi >220 node. Ở 96px × 0.24 = **23px** — không còn nhìn được ảnh. Đây là chống chồng lấn bằng cách hy sinh chính nội dung.

### Đề xuất: 3 engine cho 3 ý định, không phải 1 engine cho 7 nhãn

| Ý định | Engine | Ghi chú |
|---|---|---|
| **Luồng / dòng thời gian** (ideaboard) | Giữ **elkjs** `layered` | Đang đúng, không đổi |
| **Cụm mềm** (moodboard) | **d3-force** + `forceCollide(r)` theo kích thước node thật | ~40 dòng. Kéo được, node nảy ra khỏi nhau tự nhiên. Không cần thêm graph library |
| **Lưới / contact sheet** | **Justified rows** (thuật toán kiểu Flickr) | ~50 dòng tự viết, hoặc [`justified-layout`](https://github.com/flickr/justified-layout) (Flickr, MIT, ~3KB) |

**Justified rows là mảnh ghép quan trọng nhất** và liên quan trực tiếp câu §6–§7: nó xếp ảnh thành hàng đều nhau **giữ nguyên tỉ lệ gốc**, không crop, không chừa khoảng trắng. Đúng thứ cần khi bỏ hộp cứng 96×86.

Thư viện khác đã cân nhắc và **không** đề xuất:
- **WebCola** — `avoidOverlaps(true)` rất hợp lý về mặt kỹ thuật (constraint-based, ổn định hơn force), nhưng bảo trì thưa và thêm một mô hình layout thứ ba để học. Chỉ nên dùng nếu d3-force cho kết quả nhảy loạn.
- **Muuri** — drag + auto-pack sẵn, nhưng nó quản DOM riêng, sẽ tranh chấp với hệ pointer/drag đang có.
- **Masonry / MiniMasonry** — chỉ giải bài toán CSS grid, không giải bài toán canvas vô hạn có toạ độ tuyệt đối.
- Đổi hẳn sang **tldraw / excalidraw** — vứt bỏ mô hình graph có `relation` mà KIRA đang xây; không đáng.

**Ngoài ra, đề xuất mạnh:** thay `densityScale` bằng **semantic zoom**. Node giữ kích thước thật; khi zoom out dưới ~40% thì node tự giản lược (bỏ chữ, chỉ còn ảnh; dưới 20% chỉ còn ô màu chủ đạo). Google Maps làm thế, Figma làm thế. Đây là cách đúng để xử lý 300 node — không phải thu nhỏ mọi thứ xuống 24%.

---

## 6. Kích thước ảnh có nên tự do hơn hệ số?

**Có. Và vấn đề sâu hơn là `importance` đang gánh hai việc mâu thuẫn.**

Hiện `importance` (0.25–5) vừa là **trọng số ngữ nghĩa** (dùng để sort layout, xếp hạng trong outline) vừa là **kích thước hiển thị** ([main.tsx:12511](../apps/desktop/src/main.tsx:12511)). Hệ quả:
- Muốn phóng to một ảnh vì nó là ảnh chủ đạo của bố cục → vô tình đổi trọng số ngữ nghĩa của nó trong outline.
- Dải thực tế chỉ 0.82×–1.53× — chưa tới **2 lần** chênh lệch giữa nhỏ nhất và lớn nhất. Moodboard thật cần chênh 5–10 lần (một ảnh hero + tá ảnh vệ tinh).
- Chỉ chỉnh được bằng menu chuột phải, bước nhảy 0.25 — không có cảm giác trực tiếp.

### Đề xuất
```ts
type EvidenceImage = {
  importance?: number   // NGỮ NGHĨA — 0.25..5, dùng cho outline/sort/scoring
  scale?: number        // THỊ GIÁC — tự do, 0.15..8, mặc định suy ra từ importance
  cropRect?: { x, y, w, h }  // xem §8
}
```
- Mặc định `scale` suy từ `importance` → hành vi hiện tại không đổi cho ai chưa động vào.
- Khi user kéo handle → chỉ `scale` đổi, `importance` giữ nguyên.
- **Handle resize ở góc**, chỉ hiện khi node được chọn. `react-rnd` đã có trong deps (đang dùng cho FloatingPanel) — nhưng cho node trên canvas nên tự viết pointer handler ~30 dòng để không đụng vào hệ zoom/pan.
- **Giữ tỉ lệ mặc định**; `Shift` để bóp méo (đảo lại quy ước của Figma vì ở đây ảnh gần như luôn cần đúng tỉ lệ).
- **Snap mềm**: khi kéo gần bằng chiều cao của node bên cạnh thì hít vào — cho phép căn hàng nhanh mà không cần lưới cứng.
- `⌘0` reset node về scale mặc định.

---

## 7. Hiển thị và edit — có gây nhiễu không?

**Có, và đây là câu hỏi bạn đã tự trả lời đúng.** Đề xuất của bạn (mặc định chỉ ảnh + tên ở ratio gốc, edit mới bung) là hướng đúng. Cụ thể hoá:

### Vấn đề đo được
1. **`object-fit: cover` trong hộp 96×86 phá bố cục ảnh.** Ảnh dọc (poster, layout tạp chí) bị cắt mất phần trên/dưới — chính là phần chứa thông tin bố cục mà người ta lưu nó về. Với công cụ moodboard, đây là lỗi nghiêm trọng nhất về hiển thị.
2. **Click 1 lần = vào edit** ([main.tsx:7146](../apps/desktop/src/main.tsx:7146)). Click là thao tác dùng để *chọn*, *kéo*, *link* — dùng nó để vào edit thì "lỡ tay" là chắc chắn, không phải rủi ro.
3. **Node idea đổi cả layout khi selected** (grid→block, 224→248px) → mọi node xung quanh nhảy chỗ mỗi lần click.

### Đề xuất: 3 tầng, chuyển tầng phải có chủ ý

| Tầng | Kích hoạt | Hiển thị |
|---|---|---|
| **Nghỉ** | mặc định | Ảnh ở **tỉ lệ gốc** (`object-fit: contain`, chiều rộng theo `scale`, cao tự tính). Tên **không hiện** — hoặc hiện rất mờ dưới ảnh. Chấm màu palette ở góc |
| **Chọn** | click 1 lần | Viền + handle resize + selection toolbar nổi dưới. Tên hiện rõ. **Kích thước hộp không đổi** |
| **Sửa** | `Enter`, double-click, hoặc nút ✎ trên toolbar | Node bung thêm khối edit **bên dưới** (title, note, tag). `Esc` thoát, `⌘Enter` lưu |

**Chi tiết quyết định:**
- **Tầng Nghỉ không hiện tên** cho node ảnh. Moodboard là để *nhìn*. Tên xuất hiện khi hover hoặc khi chọn. Với 40 ảnh, 40 dòng chữ nhỏ dưới ảnh là nhiễu thị giác lớn hơn giá trị thông tin.
- **Bung xuống dưới, không thay thế.** Ảnh phải luôn nhìn thấy trong lúc sửa metadata của chính nó.
- **Sửa xảy ra tại node, không phải ở Inspector.** Inspector giữ vai "chi tiết sâu" (nguồn, OCR, version, link) — nhưng title/note/tag là thứ dùng nhiều nhất, phải sửa được ngay tại chỗ, không nhảy mắt sang panel bên phải.
- **Bỏ layout shift**: node idea giữ nguyên width 224 ở mọi state; chỉ đổi nền + viền.
- **Đảo hướng ưu tiên của Library.** `.image-row .reference-thumb` cũng đang `cover` 76×62. Chế độ grid nên chuyển sang **masonry giữ tỉ lệ** — cùng lý do.

---

## 8. Crop / edit ảnh — có nên? Dùng OSS nào?

### Có nên: **Có — nhưng chỉ crop + xoay, và phải non-destructive.**

Lý do có: khi làm moodboard, thao tác thật sự cần là **cắt lấy một chi tiết** — góc chữ trên poster, khối màu trong ảnh, cách bo góc của bao bì. Không có crop thì người ta phải ra Preview/Photoshop rồi kéo ngược vào — gãy dòng chảy hoàn toàn.

Lý do **không** làm editor đầy đủ: filter/brightness/annotate biến KIRA thành phần mềm sửa ảnh hạng hai. Người dùng đã có Photoshop/Affinity. Mỗi tính năng thêm vào đây là một tính năng thua kém bản thật, và làm loãng câu chuyện sản phẩm.

### Kiến trúc đề xuất: crop không phá huỷ

```ts
type EvidenceImage = {
  cropRect?: { x, y, w, h }   // chuẩn hoá 0..1, so với ảnh gốc
  rotation?: 0 | 90 | 180 | 270
}
```
- Canvas render qua `object-fit` + `object-position` hoặc CSS `clip-path` — **không đụng file gốc**.
- "Reset crop" luôn khả dụng. Đây là điều kiện để người ta dám cắt thoải mái.
- **Chỉ khi export** (contact sheet, slides, PPTX) mới "nướng" pixel thật — làm ở **Rust bằng crate `image = "0.25"` đã có sẵn** trong [Cargo.toml](../apps/desktop/src-tauri/Cargo.toml). Không tăng bundle JS, nhanh hơn canvas, và họ đã dùng nó để sinh thumbnail rồi.

### Thư viện

**Khuyến nghị: [`react-easy-crop`](https://www.npmjs.com/package/react-easy-crop)** — ~2.4M lượt tải/tuần, API hook thuần React, trả về `croppedAreaPixels` (đúng cái cần để lưu `cropRect`), hỗ trợ zoom/rotate, ~13KB. Nó *không* tự ghi file — đúng với thiết kế non-destructive ở trên.

Đã cân nhắc và không chọn:

| Thư viện | Vì sao không |
|---|---|
| [`react-image-crop`](https://www.npmjs.com/package/react-image-crop) | Nhỏ hơn (<5KB), nhiều star hơn, nhưng không có zoom/pan trong khung — thao tác "phóng to chọn chi tiết" kém hơn hẳn |
| [`cropperjs`](https://github.com/fengyuanchen/cropperjs) | Vững, nhưng framework-agnostic → phải tự bọc, và mang theo CSS/DOM riêng |
| [Filerobot Image Editor](https://scaleflex.github.io/filerobot-image-editor/) / [Toast UI](https://ui.toast.com/tui-image-editor) | Editor đầy đủ (filter, annotate, watermark). **Đúng lý do để loại**: quá nhiều tính năng, UI riêng không khớp design system warm-dark glass, bundle lớn |
| `fabric.js` / `konva` | Chỉ hợp nếu sau này muốn vẽ/annotate tự do trên ảnh. Chưa cần — và nếu cần thì đó là quyết định sản phẩm riêng, không phải quyết định thư viện |

Hai thứ nên làm **native (Rust)** thay vì JS: **remove background** (nếu muốn, qua Vision `VNGenerateForegroundInstanceMaskRequest` — đã có sẵn hạ tầng helper Vision cho OCR) và **bake crop khi export**.

---

## 9. Thứ tự đề xuất thực thi

Xếp theo **giá trị cho người dùng ÷ rủi ro**, không theo thứ tự câu hỏi.

**Đợt 1 — sửa cái đang sai (nhỏ, tác động lớn) — ✅ ĐÃ XONG**
1. ✅ Ảnh hiển thị đúng tỉ lệ gốc (bỏ `cover` cứng ở node + library grid) — §7
2. ✅ Click = chọn, `Enter`/double-click = sửa; bỏ layout shift của idea node — §7
3. ✅ Chuyển zoom xuống bottom-right; gom graph-tools vào popover bottom-left — §3
4. ✅ Content script không fetch localhost trực tiếp nữa (đi qua service worker) — §2
5. ✅ Tách `scale` khỏi `importance` + handle resize khi chọn — §6

> Chi tiết những gì đã thay đổi: xem §10.

**Đợt 2 — mở khoá cấu trúc — ✅ ĐÃ XONG (trừ mục 8, dời sang Đợt 4)**
6. ✅ Tách state file → `FileWorkspace` + `App` shell, undo per-tab — §1
7. ✅ Tab bar = file; view switcher thu nhỏ — §1
8. `/context` multi-file + shelf chọn board trong extension — chưa làm, xem §11

**Đợt 3 — làm nó thành công cụ moodboard thật**
9. ✅ Grid layout: shelf-pack theo tỉ lệ thật thay ELK, không còn shrink theo count — xem §12
10. Frame/nhóm có tên + palette theo frame — §4 (chưa làm)
11. Crop non-destructive (`react-easy-crop` + bake bằng Rust `image`) — §8 (chưa làm)
12. ✅ Kéo node giữa tab (spring-load) — §1, chi tiết ở §11
13. Semantic zoom thay `layoutDensityScale` cho các mode khác; cụm mềm d3-force cho mode 'cluster' — chưa làm

**Đợt 4 — dọn dẹp**
13. Gộp arc menu + context menu → selection toolbar duy nhất — §3
14. Hạ 3D khỏi thanh chính; Slides → `Present` — §4
15. Safari: manifest riêng + `chrome.storage.session` + fallback không `openPopup` — §2

---

## 10. Đợt 1 — đã triển khai

### Node hiển thị đúng tỉ lệ gốc
- `.image-node` bỏ hộp cứng 96×86; giờ rộng 104px, cao tự tính theo `aspect-ratio` của ảnh.
- `object-fit` đổi sang `contain` **chỉ** ở canvas + library grid; list rows giữ `cover` để hàng vẫn đều.
- **Quan trọng:** hầu hết capture từ web không có `width`/`height` đã lưu, nên `ReferenceThumb` **đo tỉ lệ thật từ ảnh đã decode** (`naturalWidth/naturalHeight`) trong `onLoad` và ghi vào `--thumb-aspect`. Không có bước này thì mọi ảnh vẫn rơi về 4:3 và tính năng coi như không chạy.
- Library grid card cũng nhận `--thumb-aspect` từ chính thumb, `align-items: start`.

### `scale` tách khỏi `importance`
- Thêm `scale?: number` vào cả 5 loại node; `effectiveNodeScale()` ưu tiên `scale`, fallback `importanceScale(importance)` → **board cũ giữ nguyên kích thước**.
- Dải mới **0.2×–6×** (trước: 0.82–1.53).
- Handle kéo ở góc dưới-phải, chỉ hiện khi node được chọn. Tỉ lệ tính theo khoảng cách con trỏ tới tâm node → đúng ở mọi mức zoom/density. Double-click handle hoặc menu chuột phải "Reset size" để trả về mặc định.
- Một entry undo cho mỗi cử chỉ kéo (push history ở frame đầu, không phải mỗi frame).
- Persist: cột `scale` REAL cho `ideas` + `reference_assets` (có migration `add_column_if_missing`); palette/diagram/placeholder đi qua JSON nên tự động. 21 test Rust pass, có thêm assert roundtrip cho `scale`.
- ELK layout giờ nhận `sizeScale` + `aspect` thay vì `importance`, nên node to/nhỏ tự do vẫn được sắp xếp không chồng.

### Tầng tương tác
- Idea node: click = chọn (**không** đổi width/layout nữa), `Enter` hoặc double-click = vào sửa. Khối edit chỉ tồn tại khi đang sửa → không thể "lỡ tay" click vào input.
- `Esc` / `⌘Enter` thoát; `Enter` trong title nhảy xuống note; blur giữa title↔note không thoát edit.
- Node ảnh: tên chỉ hiện khi hover/chọn. Nút `+` đổi từ hover-gated sang **selected-gated**.
- Chrome của node (`+`, caption, handle) được counter-scale `1/var(--node-scale)` → giữ kích thước cố định trên màn hình dù node phóng to bao nhiêu.

### Bố cục nút
- Gộp thành **một** `.canvas-bottom-bar` flex: trái = Edit/Discover + "Arrange", giữa = tool tạo node, phải = zoom + đếm node.
- Flex thay vì absolute → **không thể chồng nhau ở bất kỳ độ rộng nào**; canvas hẹp (mở cả 2 panel) thì rail bên tự xuống hàng thay vì bóp nát tool rail.
- `graph-tools-drawer` neo bottom-left cạnh nút "Arrange". `ai-node-panel` dời lên top-right (chỗ vừa trống).
- Góc top-right giờ chỉ còn Settings + Inspector của app chrome.

### Extension
- `content.ts`, `popup.ts`, `drag-window.ts` **không còn fetch `127.0.0.1`**; tất cả đi qua `chrome.runtime.sendMessage` → service worker. Chỉ `background.ts` biết endpoint.
- Thêm `KiraBridgeMessage` / `KiraBridgeResponse` trong `types.ts`.
- `copy-static.mjs` giờ mirror `dist/` sang Safari Resources → **Safari không còn chạy bundle cũ hơn Chrome** (trước đó đã lệch).

### Chưa làm trong đợt này
- Safari vẫn dùng chung manifest với Chrome; `chrome.action.openPopup()` và state trong biến module vẫn là vấn đề (§2.1c) — thuộc Đợt 4.
- `/context` vẫn một file — chờ multi-tab (Đợt 2).

---

## 11. Đợt 2 — đã triển khai (multi-tab)

### Kiến trúc
`App()` (cũ) đổi tên thành **`FileWorkspace`** — nhận `fileId`/`isActive`/`initialSnapshot`/`initialPackage` qua props, giữ nguyên 100% logic board (ideas/images/links/canvas/undo/AI settings...). Một **`App`** mới, rất mỏng, chỉ giữ `files: OpenFile[]` + `activeFileId` và render một `FileWorkspace` cho mỗi file đang mở:

```tsx
{files.map((file) => (
  <FileWorkspace key={file.id} fileId={file.id} isActive={file.id === activeFileId} ... />
))}
```

**Tab không tồn tại kiểu "unmount rồi mount lại".** Mọi `FileWorkspace` luôn ở trong cây React (React không unmount khi chỉ đổi thứ nó *render*), nên state (ideas/images/scroll/selection...) sống nguyên vẹn khi chuyển tab. Cái thay đổi khi `isActive=false` là: sau khi toàn bộ hook đã chạy, hàm bail ra `return null` — tab nền **không mount** `GraphCanvas`/`Graph3DView`/`SlideshowView`, tức không giữ WebGL context hay Mermaid instance nào sống ở tab bạn không nhìn thấy. Đây chính là điều kiện "N tab không tốn N canvas" đặt ra ở §1.

### Undo per-tab
`useCanvasHistoryStore` (zustand+zundo, trước đây là **singleton module-level**) đổi thành `createCanvasHistoryStore()` — factory. Mỗi `FileWorkspace` gọi `useState(createCanvasHistoryStore)` **một lần khi mount** → mỗi tab có instance riêng, không thể có chuyện undo ở tab A xoá nhầm node tab B.

### Global effect nào cũng phải hỏi "tôi có phải tab đang active không"
Đây là phần dễ bị bỏ sót nhất khi biến 1 component thành N instance chạy song song. Đã gate bằng `if (!isActive) return` cho:
- Cửa sổ kính mờ (`getCurrentWindow().setEffects`) — chỉ tab active mới được lái window chrome.
- Prefetch "Continue last session" — chỉ tab mặc định.
- Ghi `localStorage['kira:lastProjectPath']` — chỉ tab active ghi, tránh tab nền vô tình đè lại đường dẫn đang xem.
- `updateNativeCaptureContext` — context cho extension theo tab đang active.
- `refreshFoundationModelAvailability` / `refreshExtensionInstallStatus` — tránh N tab gọi native N lần lúc mount.
- Listener sự kiện `kira:capture` từ Tauri — **quan trọng nhất**: không có gate này thì một lần capture từ extension sẽ nhân bản vào *mọi* tab đang mở.
- **Phím tắt toàn cục** (`Cmd+Z`, `Delete`, `Cmd+S`, `Cmd+D`...) — cũng quan trọng nhất: thiếu gate này thì `Cmd+Z` sẽ undo *tất cả* tab cùng lúc.
- `window.__kiraDev` (API QA) — chỉ tab active trả lời.

### Dirty tracking + đóng tab
Mỗi `FileWorkspace` báo `{title, isDirty, path}` lên `App` qua `onFileMetaChange` mỗi khi `projectHash` đổi — **không gate theo `isActive`**, vì tab nền vẫn phải cập nhật chấm "chưa lưu" dù không hiển thị. Đóng tab có thay đổi chưa lưu → hộp thoại xác nhận (tái dùng đúng class `.dialog-overlay`/`.confirm-dialog` đã có, không tạo hệ thống dialog mới).

**Bug phát hiện khi test dirty-tracking:** `createBlankProjectSnapshot()` thiếu field `slidesConfig` so với `toProjectSnapshot()` — khiến **mọi tab mới tạo đều hiện chấm "chưa lưu" ngay cả khi chưa đụng gì**. Đây là lỗi có sẵn từ trước multi-tab (tab đơn cũng bị, chỉ là không ai để ý vì không có chấm tab để lộ ra) — đã vá bằng cách thêm `slidesConfig: defaultSlidesConfig()`.

### New / Open / Save
`New` và `Open` giờ **luôn mở tab mới**, không còn ghi đè nội dung tab đang xem — dialog chọn file + gọi native package đều chuyển lên `App` (`requestNewFile`/`requestOpenFile`), `FileWorkspace` chỉ còn gọi `onRequestNewFile()`/`onRequestOpenFile()`. `Open` một file đã mở sẵn → focus lại tab đó thay vì mở trùng. `Save`/`Save As` vẫn thuộc về tab đang active, không đổi.

### Tab bar = file, view switcher thu nhỏ
Một hàng `.file-tab-bar` mới ở TOP của `.app-shell` (row 1 trong grid 2 hàng), phía trên `.workspace`. Traffic-light `WindowControls` **dời từ đầu sidebar sang đầu tab bar** — vì bây giờ sidebar không còn ở đỉnh cửa sổ thật nữa (bị tab bar đẩy xuống), nút đóng/thu nhỏ/phóng to phải nằm đúng góc trên-trái của cửa sổ theo quy ước macOS.

`Canvas/3D/Slides/Outline` giữ nguyên trong `.topbar` — đúng như đề xuất "view switcher thu nhỏ", không đổi vị trí, chỉ không còn đóng vai "tab" nữa.

### Đã kiểm chứng trực tiếp trên preview
Tạo tab mới → 2 tab độc lập, ảnh/inspector không lẫn nhau; chuyển qua lại giữ nguyên state từng tab; đóng tab có thay đổi chưa lưu → đúng hộp thoại xác nhận, Cancel/Close without saving hoạt động đúng; đóng xong quay về tab trước đó với nội dung nguyên vẹn; nút "New" ở cả tab-bar lẫn sidebar đều mở tab mới đúng cách.

### Kéo node giữa tab — đã làm, với một điều chỉnh kiến trúc quan trọng
Bản gốc đề xuất "spring-load" kiểu Finder: giữ ~600ms trên tab là tự chuyển sang trong khi vẫn đang kéo. **Không làm được đúng như vậy** — chuyển `activeFileId` giữa chừng sẽ unmount `GraphCanvas` của tab nguồn (vì tab không active thì `return null`), làm mất `PointerCapture` đang giữ node kéo, gãy gesture giữa chừng. Đã đổi sang mô hình an toàn hơn nhưng vẫn giữ đúng thao tác kéo-thả một lần liền mạch:

1. Kéo node ảnh/idea/... lên vùng 48px trên cùng (đúng chiều cao `.file-tab-bar`) → hit-test bằng `document.elementFromPoint`, tìm tab dưới con trỏ qua `data-file-tab-id` (không dùng React prop vì tab bar nằm ngoài cây `GraphCanvas`). Tab đó sáng viền cyan (`.is-drop-target`) — chỉ là feedback, **chưa chuyển tab, chưa di chuyển node**.
2. Thả (pointerup) trên một tab khác → mới thực sự chuyển: `FileWorkspace` nguồn gỡ node khỏi state của nó bằng đúng `deleteSelectedGraphNodes` (nên link chạm vào node đó cũng bị dọn theo, nhất quán với xoá), gửi bản ghi đầy đủ lên `App` qua `onTransferNodeToFile`. `App` xếp vào hàng đợi theo `targetFileId` và **mới bây giờ** gọi `setActiveFileId` (an toàn vì gesture đã kết thúc). Tab đích, khi mount active, có `useEffect` đọc `incomingTransfers`, gán id mới (`makeSessionUid`) để không đụng id cũ, đặt ở giữa canvas (50/50, có xê dịch nhẹ nếu nhiều node), rồi báo `onTransfersConsumed` để `App` xoá khỏi hàng đợi.

Test trực tiếp: kéo 1 ảnh từ tab 1 (6 ảnh) sang nhãn tab 2 (rỗng) → tab 2 tự động active, hiện đúng ảnh với đầy đủ title/tags/palette; tab 1 còn lại 5 ảnh, link liên quan tự dọn, cả hai tab đều lên chấm "chưa lưu" đúng như kỳ vọng.

### Chưa làm (dời sang Đợt 3/4 theo đề xuất gốc)
- `/context` gửi cho extension nhiều file cùng lúc + shelf chọn board — §2, cần thiết kế lại `KiraCaptureContext` shape.
- Safari resource giờ **tự động mirror** theo `pnpm build` (đã sửa trong Đợt 1 §10), nhưng manifest/behavior riêng cho Safari (`chrome.action.openPopup`, `chrome.storage.session`) vẫn chưa tách.

---

## 12. Đợt 3 (một phần) — đã triển khai

### Grid Cleanup — thay ELK bằng shelf-pack theo tỉ lệ thật

`organizeGraphLayout`'s mode `'grid'` giờ **không đi qua ELK nữa** — ELK `layered` được thiết kế cho sơ đồ có hướng, không có khái niệm "xếp vào hàng theo chiều rộng khả dụng". `'grid'` dùng `applyShelfPackedLayout` (một hàm trước đây chỉ là fallback âm thầm khi ELK lỗi, giờ được nâng lên làm thuật toán chính cho mode này) với `densityScale = 1` cố định — không còn co nhỏ node theo số lượng, board 300 node sẽ có nhiều hàng hơn thay vì mọi node bị bóp xuống 24% không đọc được.

**Phát hiện quan trọng khi build và test trực tiếp trên preview, không phải chỉ đọc code:** bản đầu tôi viết một thuật toán "true justified rows" kiểu Flickr (bề rộng mỗi node biến thiên theo tỉ lệ ảnh để khớp đúng chiều rộng hàng). Sau khi build xong tôi lập tức nghi ngờ và đo trực tiếp trong trình duyệt (`getBoundingClientRect` trên từng node) — phát hiện **node ảnh render ở CSS width cố định (104px), chỉ có height là `auto` theo `aspect-ratio`** (kết quả từ Đợt 1 §10). Nghĩa là toán "chiều rộng biến thiên theo tỉ lệ" mà tôi viết hoàn toàn không khớp với model render thật — nó tính ra một bề rộng khác với bề rộng ảnh THẬT SỰ chiếm trên màn hình, dẫn đến chồng lấn (node hẹp/cao bị cấp ít chỗ hơn CSS thực render) hoặc khoảng trống thừa (node rộng/dẹt được cấp nhiều chỗ hơn cần).

Đã bỏ thuật toán đó, quay về mô hình đúng với cách node THẬT SỰ vẽ ra: **bề rộng cố định theo loại node, chiều cao suy từ tỉ lệ ảnh** — chính là điều `applyShelfPackedLayout` (đổi tên từ `applyFallbackPackedLayout`) đã làm sẵn. Việc còn lại là hiệu chỉnh lại hằng số bề rộng/cao phần trăm (`layoutNodePercentWidth/Height` cũ được tính cho một mục đích khác — chấm điểm chồng lấn của ELK, không phải để pack chính xác) thành `shelfNodePercentWidth/Height` mới, quy đổi từ **pixel CSS thật** (idea 224px, ảnh 104px, palette/diagram/placeholder 156px) qua một kích thước canvas tham chiếu (620×820, cố tình chọn hẹp — ứng với lúc mở cả Library lẫn Inspector — để an toàn hơn là tính theo canvas rộng).

Verify trực tiếp bằng đo pixel: **0 cặp node chồng lấn** trên bộ 9 node hỗn hợp (3 idea + 6 ảnh dọc/ngang khác tỉ lệ), so với 5-6 cặp chồng lấn rõ rệt (33–105px) ở bản justified-rows đầu tiên. Không đổi `layoutNodePercentWidth/Height` gốc (vẫn dùng cho chấm điểm overlap của ELK ở các mode khác — flow/cluster/timeline/palette/importance) để tránh ảnh hưởng ngược tới các mode đó.

### Kéo node giữa tab — xem chi tiết đầy đủ ở §11 (đã viết khi hoàn thành, không lặp lại ở đây).

### Bài học rút ra
Percent-space layout trong KIRA **không phải WYSIWYG** — vị trí (x%, y%) là thật, nhưng kích thước trong thuật toán layout chỉ có ý nghĩa nếu được hiệu chỉnh khớp với kích thước CSS THẬT SỰ render (vốn đã tách rời khỏi layout engine từ trước, qua `--node-scale` + `aspect-ratio` CSS). Bất kỳ thay đổi nào động đến toán vị trí đều cần **đo lại bằng `getBoundingClientRect` trên preview thật**, không chỉ tin vào toán học trừu tượng.

### Đã hoàn thành sau đó — xem §13
- Semantic zoom, cụm mềm d3-force, frame/nhóm, và crop non-destructive đều đã triển khai — chi tiết ở §13.

---

## 13. Đợt 3 (phần còn lại) + Đợt 4 — đã triển khai

### Cụm mềm bằng d3-force cho mode `'cluster'`

Thêm dependency `d3-force`. `applyClusterForceLayout` dùng `forceSimulation` + `forceManyBody` (đẩy) + `forceCollide` (chống chồng lấn, bán kính tính từ kích thước CSS thật giống §12) + `forceLink` (giữ node liên quan gần nhau) + `forceCenter`, chạy đồng bộ qua vòng lặp `.tick()` thủ công (không animate sống — layout tính xong một lần rồi gán tọa độ, giữ nguyên triết lý "Arrange = một hành động rời rạc" của toàn bộ hệ thống organize hiện có).

**Lỗi phát hiện khi đo trực tiếp:** `forceLink().distance(70)` là hằng số tĩnh, trong khi bán kính va chạm thực tế của cặp idea-ảnh cộng lại ~190-200px — lực link kéo node lại gần 70px trong khi lực collide đẩy ra xa hơn nhiều, hai lực triệt tiêu nhau thành trạng thái chồng lấn một phần (đo được 4 cặp chồng lấn). Sửa bằng cách tính `distance` động theo từng cặp: `nodeRadius(source) + nodeRadius(target) + 10`. Verify lại bằng script đo pixel overlap: 0 cặp chồng lấn.

### Semantic zoom thay `layoutDensityScale`

Bỏ hẳn `nodeDensityScale`/`layoutDensityScale(visibleNodeCount)` khỏi đường render của `GraphCanvas` — node không còn co nhỏ theo số lượng nữa. Thay bằng `data-zoom-tier` (`'in' | 'out' | 'far'`) tính từ `graphTransform.scale`, CSS ẩn dần caption/ghi chú/tiêu đề phụ khi zoom tier chuyển sang `'out'`/`'far'`, kích thước node giữ nguyên. Khoảng zoom clamp mở rộng từ `[0.65, 1.8]` xuống `[0.12, 1.8]` để board lớn có thể zoom xa hơn mà vẫn đọc được bố cục tổng thể (dù chi tiết ẩn đi).

### Frame / nhóm có tên + palette theo frame

Thêm `FrameNode` (hình chữ nhật tự do trên canvas, có tên, có thể kéo/resize) và state `frames`. `imagesInFrame()` xác định ảnh nào nằm trong biên frame theo tọa độ phần trăm; `mergeFramePalette()` gộp palette các ảnh trong frame thành một bộ màu đại diện, hiển thị trong Inspector bằng cùng markup `reference-palette-card` đã có sẵn (tái dùng UI, không tạo component mới). Lưu trữ Rust dùng lại nguyên mẫu `write_json_collection`/`read_json_collection` đã có cho palettes/diagrams/placeholders — không cần schema SQL mới.

### Crop non-destructive bằng react-easy-crop

Thêm dependency `react-easy-crop`. `EvidenceImage` có thêm `cropRect?: {x, y, width, height}` — phân số 0..1 theo ảnh GỐC, file gốc **không bao giờ bị đụng tới**. Toàn bộ canvas/library/slides render crop bằng kỹ thuật CSS thuần: `<img>` được phóng to (`100/cropWidth%`) và dịch chuyển (`-cropX/cropWidth*100%`) bên trong container `overflow: hidden`, để vùng crop lấp đầy khung hiển thị mà không sửa pixel thật. Chỉ lúc export (contact sheet/slide/pptx) mới cần bake crop thành pixel thật — **việc này cố tình để ngoài phạm vi đợt này** vì rủi ro/effort không tương xứng với giá trị tăng thêm ở bước đầu; export hiện tại vẫn dùng ảnh gốc chưa crop.

Dialog crop (`ReferenceCropDialog`) khóa aspect theo tỉ lệ gốc của ảnh (đây là công cụ reframe/zoom lại, không phải đổi tỉ lệ khung) — Reset/Cancel/Save. Mở từ nút "Crop" mới trong hàng action ảnh của Inspector, cạnh Similar/Palette.

**Rust persistence:** `ReferenceRecord` dùng cột SQL tường minh (không phải JSON blob như frames/palettes), nên `cropRect` được thêm bằng 4 cột `REAL` nullable (`crop_x`, `crop_y`, `crop_width`, `crop_height`) qua `add_column_if_missing`, cập nhật câu `INSERT` và `SELECT` trong `write_snapshot`/`read_references`. Roundtrip test thêm assertion riêng cho `crop_rect`, `cargo test` 21/21 pass.

**Đã kiểm chứng trực tiếp trên preview:** mở Inspector → Crop → dialog Cropper render đúng ảnh + lưới overlay → Save crop → preview Inspector, thumbnail Library, và node trên canvas đều cập nhật hiển thị vùng đã crop đồng nhất.

### Chưa làm (ngoài phạm vi các đợt này)
- Bake crop thành pixel thật khi export (contact sheet/slide/pptx) — hiện export dùng ảnh gốc.
- Extension optimization sâu hơn (kéo-thả ảnh trực tiếp từ trang web vào một tab cụ thể mà không cần mở app trước) — mới có phần route fetch qua service worker (Đợt 1 §10).

---

## Nguồn tham khảo ngoài

- [react-easy-crop — npm](https://www.npmjs.com/package/react-easy-crop) · [react-image-crop — npm](https://www.npmjs.com/package/react-image-crop) · [So sánh croppers React — LogRocket](https://blog.logrocket.com/top-react-image-cropping-libraries/)
- [Filerobot Image Editor](https://scaleflex.github.io/filerobot-image-editor/) · [Top 5 OSS JS image libraries — IMG.LY](https://img.ly/blog/the-top-5-open-source-javascript-image-manipulation-libraries/)
- [elkjs](https://github.com/kieler/elkjs) · [WebCola (`avoidOverlaps`)](https://github.com/tgdwyer/WebCola) · [graphology layout-force](https://graphology.github.io/standard-library/layout-force.html) · [So sánh thư viện graph — Cylynx](https://www.cylynx.io/blog/a-comparison-of-javascript-graph-network-visualisation-libraries/)
- [Muuri / Masonry / MiniMasonry](https://github.com/Spope/MiniMasonry.js/)
- [Chrome Local Network Access — Chrome for Developers](https://developer.chrome.com/blog/local-network-access) · [WICG explainer](https://github.com/WICG/local-network-access/blob/main/explainer.md)

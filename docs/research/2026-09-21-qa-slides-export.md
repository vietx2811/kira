# QA Slides — dàn ý, trình chiếu, xuất file

**Câu hỏi:** Đường từ canvas ra dàn ý, ra slide, rồi xuất file có dùng được để giao khách không? Chưa ai kiểm lần nào.

**Người yêu cầu:** Orchestrator (KIRA · vixio · Team), 2026-09-21.

**Commit đã kiểm chứng:** app source `8cb7d08` (2026-09-20 04:45) — là commit cuối chạm `apps/desktop/src` và `apps/desktop/src-tauri/src` tại thời điểm đo. Bundle native debug build lúc 2026-09-21 00:09, tức **mới hơn** commit source cuối, nên bản native mở ra đúng là code đang kiểm. HEAD lúc bắt đầu `946cb38`, lúc kết thúc `cc38d3d` (chỉ đổi `CLAUDE.md`, không chạm app).

**Kết luận ngắn:**
1. **Xuất PowerPoint hỏng hoàn toàn** — deck có bảng màu hoặc sơ đồ thì ném lỗi và không ra file nào; bỏ hai loại đó thì file ra được nhưng **không nhúng nổi một tấm ảnh nào**.
2. **Dàn ý cắt mất nội dung** — báo "8 sections" nhưng chỉ tới được 3, không cuộn được bằng bất kỳ cách nào. Thiếu đúng một dòng CSS.
3. Tiêu đề slide **tràn không giới hạn** (cao tới 3,4 màn hình), cắt giữa chữ, và mọi slide **in nguyên câu hai lần**.
4. Mermaid **không bao giờ được vẽ** ở đâu cả; nhập vào còn mất nhãn node và nhãn cạnh.
5. "Deck template" là **select không làm gì** — đã diff file xuất để chứng minh.

**Cách đo:** dev server `apps/desktop` port 5173, viewport 1440×900, dark mode. Browser pane cho thao tác thật, Chrome headless + CDP cho phần xuất file và chụp ảnh (`Page.captureScreenshot` ghi PNG ra đĩa, `deviceScaleFactor: 2`). Mọi file xuất đều **mở lại để xem**: HTML render bằng Chrome headless, PPTX giải nén đọc XML. Hai mục cần app native không chạy được, xem §6.

**Board dựng để kiểm:** 3 node seed + 1 sơ đồ Mermaid tiếng Việt nhập qua đúng nút trên tool rail + 3 node QA (một node tiếng Việt đầy đủ dấu, một node **rỗng**, một node văn bản **rất dài**) + 1 bảng màu + 9 link. Chủ đích: ép các trường hợp biên mà board mẫu không có.

---

## 1. P0 — chặn

### 1.1 Xuất PowerPoint hỏng hoàn toàn

*Đã xác minh, đo được.* Hai nguyên nhân độc lập, cả hai đều trong `slidesToPptx`:

**(a) `ShapeType` lấy sai chỗ.** `main.tsx:17734`, `17747`, `17767` gọi `PptxGenJs.ShapeType.rect` / `.roundRect` trên **default export**. Trong pptxgenjs 4.0.1 `ShapeType` là thuộc tính của **instance**, không phải static của class. Kiểm trực tiếp trên gói đã cài (`apps/desktop/node_modules/pptxgenjs/dist/pptxgen.es.js`):

```
module named exports: [ 'default' ]
typeof default.ShapeType:  undefined
typeof named ShapeType:    undefined
typeof instance.ShapeType: object   -> rect = rect
```

Hệ quả runtime, bắt được từ console của app:

```
PPTX export failed TypeError: Cannot read properties of undefined (reading 'rect')
    at slidesToPptx (…/main.tsx)
    at async exportSlideshowPptx (…/main.tsx)
```

Sửa: `prs.ShapeType.rect`.

**(b) Ảnh truyền vào sai trường.** `main.tsx:17765` gọi `s.addImage({ data: reference.thumb, … })` trong khi `thumb` là URL `https://images.unsplash.com/…` (kiểm trong localStorage của project). pptxgenjs báo, **một lần cho mỗi ảnh**:

```
ERROR: Image `data` value lacks a base64 header! Ex: 'image/png;base64,NMP[...]')
```

Trường `data` cần data-URI base64; URL phải dùng `path`.

**Phân biệt hai lỗi bằng thí nghiệm.** Đường `addShape` chỉ chạy khi slide có layout `palette`/`diagram`, hoặc khi một reference **không có** `thumb` (hộp placeholder). Nên bỏ bảng màu và sơ đồ ra khỏi board rồi xuất lại: lần này **.pptx có ra** (98 462 byte, 8 slide). Nhưng giải nén thì:

- `ppt/media/` là **thư mục rỗng**
- `grep -c "a:blip" ppt/slides/*.xml` → **0 ở mọi slide**

Tức là kể cả khi không crash, deck giao khách vẫn **mất sạch ảnh**. Chữ tiếng Việt thì đúng dấu, và 8 `notesSlide` có đủ.

**Kéo theo: báo thành công giả.** `exportSlideshowPptx` (`main.tsx:5774`) bắt lỗi của chính nó và chỉ `setSlideshowStatus('PowerPoint export failed')`, không ném ra ngoài. Nên `exportSlidesToGoogleSlides` (`main.tsx:5817`) và `exportSlidesToCanva` (`main.tsx:5823`) `await` xong vẫn chạy tiếp và báo **"PPTX ready. In Google Slides use File ▸ Import slides."** — tab Google/Canva đã mở sẵn, user được bảo là xong, mà file không hề tồn tại.

### 1.2 Dàn ý bị cắt, không cuộn được

*Đã xác minh, đo được.* Header ghi "8 sections · 3 strong · 5 needs work", nhưng chỉ **3 section** tới được. Số đo tại viewport 1440×900:

| Đại lượng | Giá trị |
|---|---|
| `.outline-shell` chiều cao | **1626 px** |
| `.view-region` (khung cha) chiều cao | **794 px** |
| `document.documentElement.scrollHeight` / `clientHeight` | 900 / 900 → **trang không cuộn** |
| Tổ tiên cuộn được của shell | **không có** (quét cả chuỗi cha) |
| `.outline-shell` `overflow-y` | `hidden` |
| Section cuối, cạnh dưới | y = **1706 px** (dưới viewport 806 px) |
| Section hiện đủ | **3 / 8** |

Cuộn chuột thật tại giữa vùng dàn ý: `window.scrollY` giữ nguyên **0**, danh sách không nhúc nhích. Section 5–8 không có cách nào tới được.

**Nguyên nhân, đúng một dòng.** `.outline-shell` (`styles.css:6701`) thiếu `height: 100%`. `.outline-list` (`styles.css:6744`) **đã có** `overflow-y: auto` sẵn nhưng vô dụng, vì shell là con `display:block` của `.view-region` nên nở theo nội dung thay vì bị ràng chiều cao.

**Đối chứng trong chính repo:** `.slideshow-shell` (`styles.css:5832`) **có** `height: 100%` — nên Trình chiếu không dính lỗi này. Cùng cấu trúc, khác đúng một thuộc tính.

**Kiểm giả thuyết sửa, ngay trên trang đang chạy** (không đụng source): gán `height:100%` cho shell →

```
shellH: 794   (bằng khung cha)
listScrollH: 1483 > listClientH: 651   → cuộn được
section 8 bottom: 874  → nằm trong viewport
```

**Tái hiện độc lập lần hai** trên Chrome headless với board khác (6 section): `shellH 1336` vs `parentH 794`, `pageScrollable: false`, `listScrollable: false`, 3/6 hiện đủ. Không phải hiện tượng của riêng một board.

---

## 2. P1 — nặng

### 2.1 Tiêu đề slide tràn không giới hạn, cắt giữa chữ

*Đã xác minh, đo được.* Đo trên file HTML đã xuất, render ở khung 1280×720:

| Slide | Chiều cao thật | So với khung 720 px |
|---|---|---|
| 01 cover | **2448 px** | 3,4 màn hình |
| 05 (node văn bản dài) | **2273 px** | 3,2 màn hình |
| 02 | 1957 px | 2,7 màn hình |
| 11 | 1043 px | 1,4 màn hình |

`scrollHeight == clientHeight` ở mọi slide, tức nội dung **không bị cắt** — slide chỉ đơn giản là cao ra. Hệ quả:

- Trên slide cover, **tiêu đề nằm hoàn toàn dưới màn hình đầu tiên**: màn đầu chỉ thấy số thứ tự, kicker và mép trên ảnh hero.
- CSS đặt `@page { size: 1280px 720px }` (`main.tsx:17528`), nên in ra PDF sẽ **xé một slide thành nhiều trang**.

Nguyên nhân: `h2` trong HTML xuất đặt `clamp(44px, 8vw, 104px)` (`main.tsx:17511`) **bất kể độ dài tiêu đề**, không có `max-height` và không có bậc thu nhỏ theo số ký tự.

Cộng thêm, tiêu đề bị `deriveTitleFromContent` (`main.tsx:14389`) cắt cứng ở **120 ký tự** bằng `.slice(0, 120)`, **không thêm dấu ba chấm**, nên dừng giữa chữ. Trên board kiểm, tiêu đề slide 05 kết thúc bằng `…đồng thời tiết ch` — set ở cỡ display, cao 18 dòng.

### 2.2 Mọi slide in nguyên câu hai lần

*Đã xác minh.* Trong `buildSlideLayouts` (`main.tsx:14895-14896`):

```ts
title:   idea.title,                                          // = dòng đầu của content
summary: presentationSummary(idea.content, references, …),    // = 1–2 câu đầu của CÙNG content
```

`presentationSummary` (`main.tsx:15136`) lấy `sentences.slice(0, 2).join(' ')`. Với node **một câu** — trường hợp thường gặp nhất trên canvas — tiêu đề khổng lồ và đoạn thân **giống hệt nhau**.

Xác nhận trong XML của file PPTX đã xuất, trên cả slide tiếng Việt lẫn tiếng Anh (nên là hệ thống, không phải do nội dung tôi dựng):

```
slide2:  02 | CORE DIRECTION | Chất liệu thủ công Việt Nam… | Chất liệu thủ công Việt Nam…
slide3:  03 | CORE DIRECTION | Objects that invite…        | Objects that invite…
```

Thấy y hệt trong dàn ý và trong HTML xuất. Speaker note thì **không** trùng — nó có thêm phần neo vào reference, nên phần đó viết tốt.

### 2.3 Nhập Mermaid làm mất nhãn node và nhãn cạnh

Nhập sơ đồ này qua đúng nút "Mermaid diagram" trên tool rail:

```
flowchart TD
  A[Khảo sát thị trường] --> B{Đủ dữ liệu?}
  B -- Chưa --> C[Phỏng vấn thêm]
  B -- Rồi --> D[Định hướng thị giác]
  C --> A
  D --> E[Bảng màu & chất liệu]
```

**(a) Nhãn node biến mất.** *Đã xác minh, đo được.* Cả 5 node nhập vào mang **cùng một tiêu đề**: `Imported from Mermaid diagram "Mermaid TD".` Nhãn thật ("Khảo sát thị trường", "Đủ dữ liệu?", …) không còn ở đâu. `importMermaidDiagram` **có** đặt `title: node.label` (`main.tsx:5342`), và regex trong `parseMermaidFlowchart` (`main.tsx:16220`) **có** bắt được `[…]` / `{…}`, nhưng tiêu đề lưu ra lại đúng bằng dòng `content`.

Đã đo ở **150 / 400 / 1000 / 2500 ms** sau khi nhập: nhãn **chưa bao giờ xuất hiện**, kể cả ở lần đo sớm nhất. Nên đây không phải ghi đè trễ.

*Suy luận, chưa chốt:* nghi `deriveTitleFromContent` chạy qua một đường `updateIdea` nào đó (`main.tsx:3716` và các dòng tương tự re-derive `title` mỗi khi `patch.content` có mặt). Đã loại trừ `normalizeIdea` (`main.tsx:16820`, không re-derive) và `NodeRichEditor` mount (`main.tsx:1117` dùng `setContent(…, { emitUpdate: false })`). **Chưa xác định được chỗ gọi.** Để người sửa chốt; hiện tượng thì chắc chắn và tái hiện được.

**(b) Tiêu đề sơ đồ lấy từ token hướng.** *Đã xác minh.* `main.tsx:16213` thay `^(graph|flowchart)\s+` bằng `'Mermaid '`, nên `flowchart TD` → tiêu đề **"Mermaid TD"**, `flowchart LR` → **"Mermaid LR"**. Đó là hướng vẽ, không phải tên.

**(c) Cạnh có nhãn kiểu `-- text -->` bị bỏ.** *Đã xác minh, đếm được.* `edgePattern` (`main.tsx:16216`) chỉ bắt nhãn dạng `|text|`, không bắt `-- text -->`. Với dạng sau, `(.+?)` nuốt luôn nhãn nên source trở thành chuỗi `"B -- Chưa"`, không khớp id nào trong `importedIdeaIdByMermaidId` và link bị bỏ im lặng.

Đếm thực tế: sơ đồ có **5 cạnh**, board trước khi nhập có 5 link, sau khi nhập có **8** → chỉ **3** cạnh thành link, mất đúng 2 cạnh có nhãn.

### 2.4 Mermaid không bao giờ được vẽ

*Đã xác minh.* Gói `mermaid` có trong `package.json` và **có** được dùng — nhưng chỉ để **validate cú pháp** lúc nhập (`main.tsx:5323-5325`: `mermaid.initialize` rồi `mermaid.parse`). Không chỗ nào trong repo gọi `mermaid.render`.

Hệ quả, kiểm từng tầng:

| Nơi | Hiển thị |
|---|---|
| Canvas | node chữ, `NodeRichEditor` `editable={false}` (`main.tsx:10351`) |
| View Trình chiếu | hộp `FileText` + tiêu đề + `"{n} nodes"` (`main.tsx:11360`) |
| HTML xuất | `.diagram-figure` chứa `"Mermaid TD 5 nodes · mermaid"` (`main.tsx:17430`) |
| PPTX | `roundRect` + 2 dòng chữ (`main.tsx:17747`) |

Thêm nữa: 5 node nhập từ sơ đồ sinh **5 slide layout `diagram` liên tiếp**, tất cả cùng tiêu đề boilerplate và cùng một hộp stub. Xác nhận trên file HTML đã xuất: `diagramFigures: 5`, nội dung cả 5 giống hệt.

### 2.5 "Deck template" không làm gì

*Đã xác minh bằng diff file xuất.* Đổi qua Minimal / Editorial / Moodboard Grid / Timeline trong app: **mọi thuộc tính render giống hệt nhau** — `backgroundColor`, `padding`, `font-size`/`color`/`font-family` của `h2`, cỡ body, `grid-template-columns`, class của `.slide-canvas`. Chỉ `data-deck-template` đổi. Và không có rule nào trong `styles.css` dựa trên `data-deck-template` (grep = 0).

**Đối chứng để chứng minh phép đo bắt được thay đổi thật:** cùng phép đo đó, đổi "Slide layout mode" thì thấy rõ —

```
Auto  →  .slide-canvas--palette   grid-cols: 368.102px
Grid  →  .slide-canvas--grid      grid-cols: 178.047px 178.055px
Stack →  .slide-canvas--stack     grid-cols: 114.695px 114.703px 114.703px
```

**Trên file xuất cũng vậy.** Xuất HTML hai lần dưới Minimal và dưới Moodboard Grid rồi diff (đã chuẩn hoá timestamp): **khác đúng 2 dòng**, cả hai chỉ là chuỗi tên template —

```
line 44:  data-template="Minimal"   vs  data-template="Moodboard Grid"
line 237: "template":"Minimal"      vs  "template":"Moodboard Grid"
```

`applyDeckTemplate` (`main.tsx:14955`) chỉ ghi đè `deckMeta.template`, không đụng `deckMeta.theme` (background/accent/font). Trong PPTX nó chỉ thành `prs.subject`.

---

## 3. P2 — vừa

**3.1 Home / End / PageDown không hoạt động** trong Trình chiếu. Handler (`main.tsx:11159-11179`) chỉ xử lý `ArrowLeft`, `ArrowRight`, `' '`, `Escape`.

Đã dựng probe `keydown` để chứng minh sự kiện **có** tới — không kết luận từ việc "không thấy gì xảy ra":

| Phím thật | `event.key` nhận được | `defaultPrevented` | Kết quả |
|---|---|---|---|
| ArrowRight | `ArrowRight` | **true** | chuyển slide ✓ |
| Home | `Home` | **false** | không đổi |
| PageDown | `PageDown` | **false** | không đổi |

Trớ trêu: **deck HTML xuất ra lại đầy đủ hơn app**. `slideDeckNavScript` (`main.tsx:17581-17592`) xử lý ArrowUp/Down, Space, PageUp/PageDown, **Home**, **End**, `F` (fullscreen), `P` (print).

**3.2 Mũi tên chạy vòng.** `goToSlide` (`main.tsx:11133`) dùng `(index + slides.length) % slides.length`. Đo thật: ArrowLeft ở slide 1 → nhảy về **10/10**. Đang thuyết trình mà lỡ tay thì nhảy thẳng về cuối deck.

**3.3 Không có thanh tiến độ, không có speaker note trong app.** Trình chiếu chỉ có chữ `"1/10"` (`main.tsx:11244`). Quét trong `.slideshow-shell`: **0** phần tử `role="progressbar"`, 0 phần tử có class dạng progress, **0** phần tử speaker note.

Speaker note **được sinh cho cả 10 slide** (`slideReport().speakerNotes` = 10) và **có** trong `notesSlide` của PPTX, nhưng:
- app không hiện ở đâu, kể cả trong presenter mode;
- HTML xuất có markup `.notes` nhưng đặt `display: none` (`main.tsx:17509`).

Tức "Enter presenter mode" hiện chỉ là **ẩn rail**, không có màn hình người trình bày.

**3.4 Không có điều khiển transition và tỉ lệ khung.** `SlidesConfig` (`main.tsx:1285`) chỉ có `template`, `order`, `customizations`. PPTX cứng 16:9 (`PPTX_W/PPTX_H`, `main.tsx:17628`), HTML cứng `@page 1280px 720px`. **Hai mục này không tồn tại, không phải hỏng** — ghi rõ ở đây vì đề bài giả định là có.

**3.5 Reset chỉ reset thứ tự.** Nút duy nhất là "Reset order" (`main.tsx:10977`), và chỉ hiện khi `hasManualOrder`. Kiểm thật: ẩn 1 slide → `9/10 shown`; bấm Reset order → thứ tự về nguyên trạng nhưng vẫn **`9/10 shown`**, slide vẫn ẩn. Không có "reset tất cả" cho layout override / ẩn / template.

**3.6 Ba trường tuỳ biến không có UI.** `titleOverride`, `summaryOverride`, `accentOverride` có trong type (`main.tsx:1278`), được `normalizeSlidesConfig` giữ (`main.tsx:2021`) và được `applySlidesConfig` áp dụng (`main.tsx:14924`) — nhưng `SlideCustomizer` (`main.tsx:10936`) chỉ dựng layout select / move / hide. Không có chỗ nào đặt được ba trường đó. Code chết. *(Đáng chú ý: `titleOverride` chính là thứ sẽ gỡ được lỗi 2.1 và 2.2 nếu có UI.)*

---

## 4. P3 — nhẹ

- **Thứ tự dàn ý không theo cấu trúc link.** `buildOutline` (`main.tsx:15193`) `ideas.map(…)` — tức thứ tự mảng, không theo link, không theo vị trí canvas. Đáng chú ý hơn: **dàn ý và slide sắp xếp khác nhau**, slide sort theo `strengthRank` rồi `localeCompare` (`main.tsx:14871`). Dàn ý đáng lẽ là bộ xương của deck mà hai bên không khớp thứ tự.
- **Không sửa được trong dàn ý.** Đếm `input, textarea, [contenteditable=true], .node-rich-editor-content` trong `.outline-shell` = **0**. Câu hỏi "sửa trong dàn ý có đẩy ngược về canvas không" → không sửa được. Bấm tiêu đề section thì chọn node **và chuyển luôn sang view Bảng vẽ** (đo: `activeView` đổi từ Outline sang Canvas), mất chỗ đang đọc.
- **Node rỗng:** tiêu đề `"Untitled"`, tóm tắt bắt đầu bằng **dấu cách thừa** — `" Current references indicate: unverified direction."` — do `${idea.content} Current references…` với `content` rỗng (`main.tsx:15209`).
- **"1 refs"** thay vì "1 ref" (`main.tsx:11502`), hiện ngay trên màn khách nhìn.
- **HTML xuất cứng `<html lang="en">`** (slide `main.tsx:17495`, outline `main.tsx:17379`) dù nội dung tiếng Việt. Charset UTF-8 đúng, chữ hiển thị chuẩn.
- **Tên file:** PPTX ra `untitled.pptx` vì lấy từ `projectMetadata.title`. Phía native, `sanitize_export_filename` (`lib.rs:738`) thay **mọi ký tự không phải ASCII alnum** bằng `-`, nên tên dự án tiếng Việt sẽ thành dạng `B-n-tr-nh-b-y.pptx`.
- **PPTX không đặt `fontFace`** → rơi về font mặc định của PowerPoint.

---

## 5. Thứ chạy đúng

Ghi lại để lần sau không phải kiểm lại:

- **Xuất HTML (cả dàn ý lẫn slide) chạy tốt.** UTF-8, tiếng Việt đủ dấu, 8/8 section, ảnh remote load **9/9, không ảnh hỏng**, có thanh tiến độ (`.deck-progress`), điều hướng phím đầy đủ, manifest JSON hợp lệ.
- **Xuất Markdown dàn ý đúng**, cấu trúc sạch.
- **Đổi thứ tự / ẩn slide / layout mode override đều hoạt động** (kiểm bằng thao tác thật, đối chiếu rail).
- **Presenter mode và Escape hoạt động** trên browser: `data-presenting` bật/tắt đúng, rail ẩn, Escape thoát.
- **Tiếng Việt đi trọn vòng** canvas → dàn ý → slide → HTML → PPTX **không lỗi dấu** ở bất kỳ chặng nào, kể cả trong XML của PPTX.

---

## 6. Chưa kiểm được, và tại sao

**Hai mục cần app native — chưa kiểm.** `request_access` cho app KIRA **bị user từ chối**, nên dừng đúng theo luật, không đi vòng. Còn treo:

1. `getCurrentWindow().setFullscreen(isPresenting)` (`main.tsx:11185`) — đường này `return` sớm khi không phải Tauri runtime, nên browser không chạm tới được.
2. Hành vi thật của đường xuất file trong app native.

Bundle debug đã mở để chuẩn bị và **đã tắt lại** sau khi bị từ chối. `scripts/screen-ready.sh` trả exit 0 suốt phiên, nên chỉ cần user duyệt quyền là chạy được ngay.

**Đọc code thay cho chạy — đường lưu file native.** *Đã xác minh trong code, chưa chạy.* **Không có hộp thoại chọn nơi lưu.** `export_slideshow_pptx` (`lib.rs:638`), `export_slideshow_html` (`lib.rs:628`) và hai lệnh outline đều ghi thẳng vào `<project_dir>/exports/` qua `export_bytes_to_exports` (`lib.rs:727`). Không gọi plugin `dialog` — khác `saveProjectAs` (`main.tsx:6029`) vốn có dùng `save()`. Status cũng không hiện đường dẫn, nên user xuất xong **không biết file đi đâu**. Nhánh `'Export canceled'` ở frontend là code chết, vì command luôn trả `Some(path)`.

**Câu hỏi còn mở, chưa ai trả lời được:** nút nhập Mermaid dùng `window.prompt` (`main.tsx:9694`). Trên browser tôi phải stub `prompt` mới test được. **Chưa biết `window.prompt` có chạy trong WKWebView của Tauri không.** Nếu không, nút Sơ đồ Mermaid **chết hẳn trong app thật mà trên browser vẫn chạy bình thường** — đúng loại lỗi không ai thấy cho tới khi khách thấy. Cần kiểm khi có quyền màn hình.

---

## 7. Hai chỗ lập luận hỏng, giữ lại nguyên vẹn

Giữ ở đây vì người đọc sau cần thấy cả đường sai, không chỉ kết luận.

### 7.1 Một nghi ngờ tôi tự bác bỏ — đừng ai đuổi theo

Dispatch **5 sự kiện `ArrowRight` tổng hợp trong cùng một tick JS** (vòng `for` liền mạch), slide chỉ nhảy **1** bậc. Giải thích có vẻ hợp lý: handler đóng kín (`closure`) trên `activeIndex` và chỉ đăng ký lại sau khi re-render, nên cả 5 sự kiện trong cùng một macrotask đều đọc một `activeIndex` cũ. Nghe như một lỗi thật.

**Nhưng nhấn phím thật 4 lần liên tiếp thì nhảy đúng 1/9 → 5/9.** Sự kiện bàn phím thật là các macrotask riêng, React kịp re-render giữa chừng. **Không phải lỗi, đừng sửa.** Hiện tượng chỉ xuất hiện với sự kiện tổng hợp cùng tick, tức là một hiện vật của cách đo.

*(Bài học chung: đo bằng `dispatchEvent` thì phải đối chiếu lại bằng phím thật trước khi gọi là lỗi.)*

### 7.2 Một kết luận sai tôi đã tự sửa

Ban đầu, nhìn ảnh chụp từ Browser pane, tôi kết luận **panel Images che mất dàn ý** — chữ trong ảnh bị cắt ngang giữa từ đúng tại mép panel, trông rất thuyết phục.

Đo DOM thì **sai**: `.outline-shell` bắt đầu ở `left: 406`, panel chiếm 0–406, **không đè lên nhau**; `.outline-list` có `scrollWidth == clientWidth`, không có gì bị cắt theo chiều ngang.

Nguyên nhân của ảo giác: **Browser pane trả ảnh ở khung toạ độ 800×600 trong khi viewport thật là 1440×900**, nên ảnh không phải là thứ mình tưởng đang nhìn. Từ đó tôi chuyển hẳn sang đo DOM cho mọi kết luận hình học, và chụp ảnh bằng Chrome headless với `deviceScaleFactor: 2`.

*(Trùng với cảnh báo sẵn có trong `CLAUDE.md` mục Verify về `innerWidth`/`innerHeight` khi pane ẩn — cùng một họ vấn đề: đừng tin kích thước từ pane.)*

---

## 8. Bẫy cho người kiểm sau

**`window.__kiraDev.slideExportHtml()` không phản ánh đường xuất thật.** Nó bỏ qua `applySlidesConfig` và `applyDeckTemplate` (`main.tsx:2705`), trong khi `exportSlideshowHtml` thật thì có áp (`main.tsx:5745`). Ai dùng helper này để kiểm tuỳ biến slide sẽ kiểm nhầm thứ. Tôi xuất qua **menu thật** trong app, bắt Blob bằng cách chặn `URL.createObjectURL`.

**Trong browser, project chỉ ghi vào localStorage khi save hoặc checkpoint, không autosave.** Tôi từng tưởng đây là lỗi mất dữ liệu (in-memory có 10 idea + 1 sơ đồ, localStorage vẫn 3 idea + 0 sơ đồ sau nhiều phút). Đọc `saveProject` (`main.tsx:6005`) và `saveVersionCheckpoint` (`main.tsx:5875`) thì **đúng thiết kế**. Không phải lỗi. Lưu ý phụ: chuyển sang view Slides sẽ kích hoạt checkpoint `'Pre-presentation'` (`main.tsx:6002`), tức là có ghi đĩa — hữu ích để flush state khi đang kiểm.

---

## 9. Đề xuất, theo thứ tự

1. **Sửa PPTX trước** (§1.1): hai dòng cho `ShapeType` (`prs.ShapeType.*`), và chuyển `addImage` sang `path` cho URL — hoặc fetch rồi encode base64 nếu muốn deck xuất ra dùng được offline. Đây là định dạng khách đòi nhiều nhất mà hiện là đường cụt. Kèm theo: cho `exportSlideshowPptx` ném lỗi ra ngoài thay vì nuốt, để bỏ câu "PPTX ready" giả ở đường Google Slides và Canva.
2. **Thêm `height: 100%` vào `.outline-shell`** (§1.2) — một dòng, dập ngay lỗi mất nội dung.
3. **Gộp nhóm typography** (§2.1 + §2.2) thành một việc cho UI/UX: tách tiêu đề khỏi nội dung (hoặc cho `titleOverride` một chỗ nhập — tầng dữ liệu đã sẵn sàng, xem §3.6), thu `font-size` theo độ dài, kẹp chiều cao slide ở `100dvh`, thêm dấu ba chấm khi cắt. Đây là thứ khách nhìn thấy đầu tiên.
4. **Quyết định về Mermaid** (§2.3 + §2.4) là câu hỏi sản phẩm, không phải lỗi thuần: có vẽ sơ đồ thật hay không? Nếu có thì cần `mermaid.render` ra SVG rồi nhúng vào canvas / slide / HTML, và rasterize cho PPTX. Nếu không thì nên bỏ nút nhập, vì hiện nó tạo ra 5 slide rác trùng tiêu đề. **Dù chọn gì, ba lỗi parser vẫn nên sửa vì rẻ:** nhãn node, tiêu đề "Mermaid TD", cạnh `-- text -->`.
5. **"Deck template"** (§2.5): hoặc cho nó điều khiển `deckMeta.theme` và biến CSS thật, hoặc gỡ khỏi thanh điều khiển. Để một select không làm gì trước mặt user còn tệ hơn không có.
6. **Hộp thoại lưu file** (§6): thêm `save()` như `saveProjectAs`, hoặc tối thiểu hiện đường dẫn trong status sau khi xuất.
7. **Khi có quyền màn hình**, chạy nốt ba thứ trong một lượt: fullscreen presenter, `window.prompt` cho Mermaid trong WKWebView, và đường ghi file `<project>/exports/`.

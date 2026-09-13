# Nghiên cứu: Panel phải (chat AI + quản lý sửa đổi) và harness nghiên cứu trong KIRA

- **Câu hỏi:** (A) Có nên làm một panel bên phải lưu conversation với AI, kèm các tab nhỏ để quản lý sửa đổi, và làm thế nào? (B) Có cần một hệ harness có tool để chạy tác vụ nghiên cứu trong app, với skill như color expert, tìm ảnh, tìm web, folder thông tin, tổng hợp? Nếu có thì kiến trúc nào?
- **Người yêu cầu:** User, giao qua Orchestrator (2026-09-13)
- **Commit đã kiểm chứng:** vixio `2422346` (branch `researcher/right-panel-harness`). Nguồn ngoài truy cập ngày 2026-09-13.
- **Kết luận ngắn:**
  1. **A:** Làm panel phải **bổ sung** cho dock dưới, không thay dock. Conversation lưu theo **thread trong project**, mỗi thread có thể gắn node. MVP gồm 2 tab **Chat** và **Changes**. Mọi sửa đổi AI trên node *đã có* phải đi qua đề xuất rồi nhận hoặc bỏ. Node AI *tạo mới* vẫn áp dụng ngay nhưng mang dấu provenance.
  2. **B:** **Chưa cần agent loop tổng quát.** Làm "pipeline có checkpoint", giống creative-os của user, chạy trên hạ tầng one-shot sẵn có cộng tool tất định trong Rust. Kết quả luôn thành ChangeSet ở tab Changes.
  3. **B (phase sau):** Dùng lai. Với BYOK thì bật server tool web search native của provider. Với Claude Code / Codex thì KIRA mở MCP server chỉ gồm tool đọc canvas và *đề xuất* thay đổi.
  4. **Skill:** Theo chuẩn Agent Skills (`SKILL.md`), nhưng skill chỉ chứa hướng dẫn và workflow, **không cho user thêm code chạy**.

Nhãn nguồn: **[code]** = đã xác minh trong repo (kèm `file:line` tại `2422346`), **[ngoài]** = nguồn ngoài (link, truy cập 2026-09-13), **[ngoài-phụ]** = blog hoặc trang tổng hợp chưa đối chiếu với nguồn chính thức, **[suy luận]** = phán đoán của Researcher, chưa chạy thử.

---

## 0. Hiện trạng đã xác minh [code]

| Vùng | Sự thật trong code |
|---|---|
| Chat Kira | `KiraSession` là state tạm trong `GraphCanvas` ([main.tsx:149](../../apps/desktop/src/main.tsx:149), [:8793](../../apps/desktop/src/main.tsx:8793)). Submit xong thì `setKiraSession(null)` ([main.tsx:8944](../../apps/desktop/src/main.tsx:8944)). **Không lưu lịch sử hội thoại**: prompt, câu trả lời, provider và thời gian đều mất sau mỗi lượt. |
| Dock | `renderKiraDock()` ([main.tsx:10083](../../apps/desktop/src/main.tsx:10083)), CSS `.kira-dock` nằm giữa đáy canvas ([styles.css:4208](../../apps/desktop/src/styles.css:4208)), rộng tối đa 540px (`--kira-dock-width`, [styles.css:90](../../apps/desktop/src/styles.css:90)). |
| Đầu ra AI | `createAiNode` ([main.tsx:4705](../../apps/desktop/src/main.tsx:4705)) chỉ biết **tạo 1 idea node mới** cộng 1 link `derived-from` (confidence 0.62, note ghi action và scope). Không sửa node có sẵn, không có diff, không có đề xuất. |
| Provenance | `NodeVersionRecord.aiGenerated` tồn tại ([main.tsx:506](../../apps/desktop/src/main.tsx:506)) nhưng **không nơi nào truyền `true`**: `createAiNode` gọi `recordNodeVersion('idea', undefined, idea, 'created')` không kèm option ([main.tsx:4794](../../apps/desktop/src/main.tsx:4794)). Node AI hiện được ghi là do người tạo. |
| AI sửa palette | `regeneratePalette` ([main.tsx:4890](../../apps/desktop/src/main.tsx:4890)) **ghi đè màu trực tiếp**, ghi version với trigger `'user_edit'`. Nếu AI lỗi thì im lặng rơi về công thức harmony, nên user không phân biệt được màu do AI hay do công thức. |
| Mẫu "đề xuất rồi nhận" đã có | Tag suggestion: `TagSuggestionRecord { label, source, confidence, status: pending/accepted/rejected }` ([main.tsx:292](../../apps/desktop/src/main.tsx:292)). `refineReferenceTags` đưa kết quả AI vào suggestion chứ không áp dụng thẳng ([main.tsx:4393](../../apps/desktop/src/main.tsx:4393)). Đây là tiền lệ nên tổng quát hoá. |
| Undo | zundo `temporal`, `limit: 50`, **một store cho mỗi file mở** ([main.tsx:679](../../apps/desktop/src/main.tsx:679)), chỉ chứa ideas/images/palettes/diagrams/placeholders/links/frames/selection. |
| Version / branch | `ProjectVersionRecord` lưu **toàn bộ `snapshotJson`**, tối đa 50 bản ([main.tsx:5547](../../apps/desktop/src/main.tsx:5547)). `trigger` đã có giá trị `'auto'` và `'pre_present'`. Snapshot lưu trữ bao gồm cả `nodeVersions` ([main.tsx:5533](../../apps/desktop/src/main.tsx:5533)). UI nằm trong `VersionHistoryDialog` ([main.tsx:13280](../../apps/desktop/src/main.tsx:13280)). Lịch sử theo node hiển thị 8 bản gần nhất trong node stack ([main.tsx:9727](../../apps/desktop/src/main.tsx:9727)). |
| Lưu trữ `.kira` | `ProjectSnapshot` là **version 2** ([main.tsx:439](../../apps/desktop/src/main.tsx:439)). `docs/ARCHITECTURE.md` và `docs/DATABASE.md` vẫn mô tả v1, đã lỗi thời. SQLite có bảng key/value `canvas_collections`, ghi JSON qua `write_json_collection` ([lib.rs:1196](../../apps/desktop/src-tauri/src/lib.rs:1196)), đang chứa `versionHistory` và `nodeVersions` ([lib.rs:1190](../../apps/desktop/src-tauri/src/lib.rs:1190)). Thêm collection mới **không cần migration**. |
| Gọi AI | Mọi lời gọi đều one-shot text qua `invoke('generate_ai_text')` ([main.tsx:17702](../../apps/desktop/src/main.tsx:17702)). Có 5 call site: tag, palette, similar, node, outline. Secret nằm trong Keychain phía Rust. |
| Claude Code | `claude -p <prompt> --model … --output-format json`, **không** giới hạn tool, không `--mcp-config` ([lib.rs:2363](../../apps/desktop/src-tauri/src/lib.rs:2363)). |
| Codex | codex-sdk thread với `sandboxMode: "read-only"`, `approvalPolicy: "never"`, `networkAccessEnabled: false`, `workingDirectory: tmpdir()` ([codex-helper/src/generate.ts:27](../../apps/codex-helper/src/generate.ts:27)). Mỗi lần gọi là một thread mới. |
| Apple Foundation | Sinh text cho canvas **chưa được nối**: `"Apple Foundation text generation is not wired for canvas nodes yet"` ([lib.rs](../../apps/desktop/src-tauri/src/lib.rs), `generate_ai_text_native`, dòng 2786). Hiện chỉ dùng chuẩn hoá tag. |
| Palette / màu | `culori`, `generatePaletteHarmony` ([main.tsx:16829](../../apps/desktop/src/main.tsx:16829)), `contrastRatio` ([:13177](../../apps/desktop/src/main.tsx:13177)), `mergeFramePalette` ([:13853](../../apps/desktop/src/main.tsx:13853)), `PaletteNode.algorithm` = harmony / `manual` / `image_extract` ([:327](../../apps/desktop/src/main.tsx:327)). |
| Loại trừ khỏi AI | Mỗi node có `aiExcluded` ([main.tsx:240](../../apps/desktop/src/main.tsx:240)). Nền tảng quyền riêng tư đã có, harness phải tôn trọng cờ này. |
| Chỗ cho panel phải | CSS đã dùng `var(--canvas-right-inset, 0px)` ở 5 chỗ ([styles.css:90](../../apps/desktop/src/styles.css:90), 556, 578, 2864, 5094) nhưng **chưa ai set** biến này. Đây là móc sẵn để đẩy overlay khi panel mở. |
| Listener localhost | `127.0.0.1:47653` trả `Access-Control-Allow-Origin: *`, **không xác thực**. `GET /context` trả tiêu đề, snippet, thumb node của file đang mở ([lib.rs:4340-4405](../../apps/desktop/src-tauri/src/lib.rs:4340)). |

**Hàm ý:** Phần khó của A không phải UI mà là **mô hình dữ liệu**: thread, run, changeset, provenance. Hiện chưa có cái nào. Phần khó của B không phải loop mà là **nguồn dữ liệu thật** (API ảnh, search, trích PDF) và **đường ghi an toàn vào canvas**.

**Bằng chứng từ creative-os của user** (chỉ đọc `~/.creative-os`): 5 workflow, pipeline `think → hitl:checkpoint concept_approval → search → hitl:checkpoint image_curation → workflow:done`, chạy bằng CLI `claude` và `codex`. Workflow `6dbb5d19` (2026-03-21, "Hanoi noir coffee brand") duyệt 7 nhánh concept. Ở cả 7 nhánh bước tìm ảnh đều trả `totalFound: 0, errors: []`: **không ra ảnh nào mà cũng không báo lỗi**. Đây là failure mode phải thiết kế để tránh.

---

## A. Panel phải: conversation + quản lý sửa đổi

### A1. Pattern từ sản phẩm thật

| Sản phẩm | Pattern | Áp dụng cho KIRA | Nguồn |
|---|---|---|---|
| **tldraw Agent starter kit** | Chat panel bên phải, lịch sử gồm tin nhắn và hành động. Context lấy từ selection, viewport, ảnh chụp cộng dữ liệu shape có cấu trúc. Action có schema Zod, **stream và áp dụng ngay, không cần duyệt**, được `sanitizeAction()` kiểm trước. Tài liệu không mô tả undo. | Lấy: action có schema và validate trước khi áp dụng. **Không** lấy kiểu tự áp dụng không duyệt cho thao tác sửa hoặc xoá. | [ngoài] [tldraw.dev/starter-kits/agent](https://tldraw.dev/starter-kits/agent) |
| **Cursor (agent)** | Diff dồn ở sidebar, nhận hoặc bỏ theo file hoặc hunk. Checkpoint sau mỗi hành động agent, quay lại một bước giữa chừng. Forum ghi nhiều lỗi UI review trong 2026. | Lấy: nhận/bỏ **từng thay đổi** cộng checkpoint trước mỗi lượt áp dụng. Cảnh báo: review UI dễ lỗi nếu trạng thái đề xuất lệch với trạng thái thật. | [ngoài-phụ] [stevekinney.com](https://stevekinney.com/courses/ai-development/cursor-checkpoints), [forum.cursor.com](https://forum.cursor.com/t/agent-mode-no-longer-shows-review-accept-interface-and-applies-file-changes-automatically-after-recent-update/152581) |
| **Heptabase** | Nút Chat góc trên phải của whiteboard mở panel. Tab AI chuyển từ sidebar trái sang **sidebar phải**. Thêm card, PDF, whiteboard làm source bằng "+" hoặc "@". **Kéo tin nhắn AI thả lên whiteboard** thành card, sửa được trước khi đặt. Chat được xếp theo topic/whiteboard. Có MCP. | Lấy: chat theo board, "@" để gắn node, kéo câu trả lời thành node. User chủ động đặt kết quả, không tự rải node. | [ngoài] [wiki.heptabase.com/work-with-ai](https://wiki.heptabase.com/work-with-ai), [changelog 2026](https://wiki.heptabase.com/changelog/changelog) |
| **NotebookLM** (đổi tên Gemini Notebook ngày 2026-07-16 theo nguồn phụ) | Bố cục 3 cột Sources / Chat / Studio (04/2026). Mỗi khẳng định có **số trích dẫn bấm được** dẫn tới câu gốc. | Lấy: tab Sources và trích dẫn gắn nguồn cho phần tổng hợp của B. | [ngoài-phụ] [bibigpt.co](https://bibigpt.co/features/notebooklm-2026-update-explained), [jeffsu.org](https://www.jeffsu.org/notebooklm-changed-completely-heres-what-matters-in-2026/) |
| **ChatGPT Canvas** | "Show changes" gạch đỏ phần bỏ, xanh phần thêm; chuyển qua lại giữa các phiên bản; "Restore this version". Theo nguồn phụ, 05/2026 OpenAI thay canvas bằng writing block ngay trong chat. | Lấy: diff trước/sau cho node text. Bài học [suy luận]: một bề mặt riêng tách khỏi chat bị gộp lại, nên đừng tạo "chế độ AI" riêng mà giữ chat và thay đổi cạnh nhau trong một panel. | [ngoài-phụ] [zapier.com](https://zapier.com/blog/chatgpt-canvas/), [felloai.com](https://felloai.com/chatgpt-canvas/) |

Không đi sâu Miro, Figma, Kosmik, Milanote: 5 sản phẩm trên đã phủ đủ 4 pattern cần quyết định (panel, context, duyệt, trích dẫn).

### A2. Conversation lưu ở đâu, theo đơn vị nào

**Khuyến nghị: đơn vị là `AiThread` thuộc project (file `.kira`). Một thread có thể có danh sách node neo, không bắt buộc.**

| Phương án | Ưu | Nhược | Chọn |
|---|---|---|---|
| Theo node (mỗi node một chat) | Gọn, dễ tìm | Câu hỏi nhiều node hoặc cả board không có chỗ; xoá node thì mất chat; gần giống Node Details | Không |
| Theo project, một luồng duy nhất | Đơn giản nhất | Dài, lẫn chủ đề; không lọc theo node | Không |
| **Thread trong project, neo node tuỳ chọn** | Khớp Heptabase (chat theo topic); dock gửi từ node thì tự neo node đó; panel lọc "thread chạm node đang chọn" | Cần UI danh sách thread | **Có** |

Mô hình dữ liệu đề xuất [suy luận]:

```ts
type AiThread = { id; title; createdAt; updatedAt; anchorNodeIds: string[]; archived?: boolean }
type AiMessage = { id; threadId; role: 'user' | 'assistant' | 'system_note'; text; createdAt;
                   contextNodeIds: string[]; runId?: string }
type AiRun = { id; threadId; skill?: string; action?: AiNodeAction; providerId; providerType; model;
               promptText; outputText; startedAt; durationMs; status: 'ok' | 'error' | 'fallback';
               error?: string; changeSetId?: string; rating?: 1|2|3|4|5 }
```

- `AiRun` tương ứng `PromptHistoryEntry` trong mô hình prompt history user từng mô tả (skill 13: prompt, output, executionTime, userRating). Lưu prompt đầy đủ để chạy lại được.
- **Lưu tại:** `canvas_collections` với key `aiThreads`, `aiMessages`, `aiRuns`, `aiChangeSets`. Không cần migration SQLite. Cần thêm field `serde(default)` vào struct `ProjectSnapshot` Rust, khoảng 20 dòng quanh [lib.rs:66](../../apps/desktop/src-tauri/src/lib.rs:66) và 1190/1247.
- **Không** đưa thread vào `snapshotForVersionArchive`. Snapshot đó đã chép cả `nodeVersions` vào mỗi bản trong 50 version ([main.tsx:5533](../../apps/desktop/src/main.tsx:5533)). Thêm chat sẽ nhân dung lượng. Hệ quả cần user chốt: **restore version không xoá chat**.
- **Tab đa file:** thread đi theo file, như undo store per-file hiện nay.

### A3. Panel phải thay hay bổ sung dock dưới

**Bổ sung.** Chia vai rõ:

| Bề mặt | Vai | Lý do |
|---|---|---|
| **Dock dưới** (giữ) | "Hỏi nhanh về cái đang chọn": composer, suggestion chip, chọn scope và provider | Neo tại chỗ, đúng nguyên tắc "editing is always anchored to the node" (PRODUCT.md) và "nổi cạnh node = làm gì với cái này" (RESEARCH_MOODBOARD_UX §3) |
| **Panel phải** (mới) | "Nhớ và kiểm soát": lịch sử thread, thay đổi đang chờ, nguồn | Lịch sử và diff cần chiều cao; dock 540px nằm đáy không chứa nổi |

- Dock gửi tin vào **thread đang active**. Nếu panel đóng, sau khi chạy xong dock hiện 1 dòng trạng thái "Kira: 3 thay đổi chờ duyệt · Mở" thay cho `setLibraryStatus` hiện nay ([main.tsx:4770](../../apps/desktop/src/main.tsx:4770)).
- **Panel đóng mặc định**, mở bằng nút ở cụm trên phải hoặc phím tắt. Đây là yêu cầu của PRODUCT.md ("not AI product coded", progressive disclosure), không phải tuỳ chọn.
- Khi mở, panel set `--canvas-right-inset` để overlay canvas tự lùi. Biến này đã được CSS dùng sẵn.
- Rủi ro [suy luận]: góc trên phải từng bị chồng 3 lớp (RESEARCH_MOODBOARD_UX §3.1). Nút mở panel cần UI/UX xếp lại cụm đó.

### A4. Mô hình "sửa đổi do AI đề xuất"

```ts
type AiChangeOp =
  | { op: 'create_node'; kind: GraphNodeKind; draft: Partial<Idea | PaletteNode | …>; position? }
  | { op: 'update_node'; ref: {kind, id}; patch: Record<string, unknown>; before: Record<string, unknown> }
  | { op: 'delete_node'; ref }
  | { op: 'add_link' | 'remove_link'; link: Partial<EvidenceLink> }
  | { op: 'set_palette_colors'; paletteId; colors: string[]; before: string[] }
type AiChangeSet = { id; runId; threadId; createdAt;
                     items: Array<{ id; op: AiChangeOp; status: 'pending' | 'accepted' | 'rejected' | 'stale' }> }
```

**Luồng:** run → ChangeSet → tab Changes → nhận/bỏ **từng item** hoặc nhận hết → áp dụng.

1. **Áp dụng:** mỗi lần bấm nhận (một item hoặc một lô) gọi `pushCanvasHistory()` **một lần** rồi các hàm mutate sẵn có. Như vậy **một Cmd+Z hoàn tác đúng một lần nhận**, khớp zundo per-file.
2. **Provenance khi áp dụng:** `recordNodeVersion(…, { aiGenerated: true, note: runId })`, đồng thời sửa lỗi `aiGenerated` luôn false.
3. **Checkpoint:** lô nhận có từ 5 item hoặc có `delete_node` thì tự `saveVersionCheckpoint('Trước Kira: <tiêu đề run>', 'auto')`. Trigger `'auto'` đã có trong type.
4. **Stale:** trước khi áp dụng `update_node`, so `before` với giá trị hiện tại. Lệch thì đánh dấu `stale`, không ghi đè. Đây là bài học từ các lỗi review UI của Cursor.
5. **Hoàn tác sau khi nhận:** dùng undo. Nếu undo stack đã trôi (limit 50) thì dùng lịch sử node (`restoreNodeVersion`) hoặc version checkpoint. Tab Changes chỉ **liên kết** tới các cơ chế này, không tự làm hệ hoàn tác thứ tư.
6. **Branch:** không làm ở MVP. Phase 3 có thể thêm "Áp dụng trên branch mới" dùng `createVersionBranch` sẵn có.

**Chính sách duyệt, khuyến nghị theo loại thay đổi** (cần user chốt, xem §D):

| Loại | Mặc định | Lý do |
|---|---|---|
| `create_node` + `add_link` từ node nguồn | **Áp dụng ngay**, gắn badge AI, vẫn ghi vào ChangeSet để nhận là "đã áp dụng, bỏ được" | Chỉ thêm, rẻ để xoá, giữ hành vi hiện tại của dock |
| `update_node`, `set_palette_colors`, `remove_link`, `delete_node` | **Chờ duyệt** | Đè lên công sức của user; `regeneratePalette` hiện đang vi phạm điều này |

Diff hiển thị: text node dùng diff từ/câu kiểu ChatGPT Canvas (thêm xanh, bỏ gạch). Palette dùng dải màu trước/sau. Link dùng "A → B (quan hệ)".

### A5. Provenance

Thêm vào mọi kiểu node một field tuỳ chọn:

```ts
provenance?: { by: 'ai'; runId: string; threadId: string; providerType: AiProviderType; model: string;
               skill?: string; sourceNodeIds: string[]; sourceUrls?: string[]; createdAt: string;
               editedByUser?: boolean }
```

- `editedByUser` bật khi user sửa nội dung sau đó. Badge đổi từ "AI" sang "AI, đã sửa".
- `sourceUrls` cho kết quả tìm ảnh hoặc web ở B. Ảnh có thêm `license`, `creator`, `attributionText` (xem B4).
- Bấm badge mở đúng run trong panel: prompt, nguồn, provider.

### A6. Các tab

| Tab | MVP? | Nội dung | Ghi chú |
|---|---|---|---|
| **Chat** | Có | Danh sách thread (lọc theo node đang chọn), tin nhắn, kéo câu trả lời thả lên canvas thành node (Heptabase) | |
| **Changes** | Có | ChangeSet chờ duyệt và đã áp dụng, nhận/bỏ từng item, link sang lịch sử node và version | Đây là giá trị mới nhất |
| **Sources** | Phase 2 | Nguồn đã ingest (folder, PDF, URL, kết quả tìm ảnh) kèm license, dùng cho trích dẫn | Chỉ có nghĩa khi B có ingest |
| Runs / History | Không tách tab | Gộp vào Chat: mỗi câu trả lời có "chi tiết run" (provider, thời gian, prompt, đánh giá) | Tránh 4 tab cho một tính năng calm |
| Tasks | **Bỏ** | Chỉ cần khi có agent chạy dài nhiều bước. B khuyến nghị chưa làm | Xem lại ở phase 3 |
| Versions | **Không thêm** | Đã có `VersionHistoryDialog`; Changes chỉ link sang | Tránh hai nơi quản lý version |

### A7. Phạm vi sửa ước lượng [suy luận]

| File | Việc | Cỡ |
|---|---|---|
| **Mới** `apps/desktop/src/kira-panel/` (`KiraPanel.tsx`, `changeset.ts`, `threads.ts`) | Panel, tab, áp dụng ChangeSet (hàm thuần, test được) | khoảng 900–1.300 dòng |
| `main.tsx` | Nối state thread/run/changeset vào `App`, thay `createAiNode` và `regeneratePalette` bằng đường ChangeSet, thêm provenance, sửa `aiGenerated` | khoảng 250–400 dòng thay đổi, rải ở quanh 4705, 4890, 5533, 8793–8960, 10083, snapshot load/save |
| `styles.css` | Panel, tab, diff, badge | khoảng 250–350 dòng |
| `lib.rs` | 4 field `serde(default)` trong `ProjectSnapshot` + read/write collection | khoảng 30 dòng |
| `docs/DATABASE.md`, `docs/ARCHITECTURE.md` | Cập nhật snapshot v2 + collection mới | nhỏ |

Tách module mới là để giảm va chạm file nóng. `main.tsx` 18k dòng đang được nhiều thread claim.

### A8. Rủi ro A

- **Trạng thái đề xuất lệch thực tế:** user sửa node trong lúc ChangeSet chờ. Giảm bằng cơ chế `stale` (A4.4).
- **Dung lượng:** `aiRuns` lưu prompt đầy đủ, mỗi prompt vài KB. 1.000 run khoảng vài MB, chấp nhận được. Cần nút xoá lịch sử run.
- **Dock và panel trùng vai:** phải giữ ranh giới A3, nếu không sẽ thành hai chat.
- **HMR `main.tsx` reset state** (CLAUDE.md): làm phần lõi trong module riêng thì test được bằng unit test không cần app.

---

## B. Harness + skill cho tác vụ nghiên cứu

### B1. Có cần agent loop có tool không?

Tiêu chí. Cần loop khi **ít nhất 2** điều sau đúng:

1. Số bước **phụ thuộc kết quả trung gian** (không biết trước phải tìm mấy lần).
2. Model phải **tự chọn** gọi nguồn ngoài nào, với tham số gì.
3. Tổng dữ liệu cần đọc **vượt context** của provider yếu nhất đang hỗ trợ.
4. Cần **nhiều thao tác ghi xen kẽ với đọc** trong một lượt.

| Skill | 1 | 2 | 3 | 4 | Cần loop? | Thay bằng |
|---|---|---|---|---|---|---|
| Color expert | Không | Không | Không | Không | **Không** | Tính trước số liệu tất định (contrast, OKLCH, harmony) → one-shot phê bình và đề xuất palette → ChangeSet |
| Tìm hình ảnh | Không | Một phần | Không | Không | **Không** | Pipeline: one-shot sinh query theo nhánh → **app gọi API ảnh bằng code** → user curate. Đúng creative-os, nhưng bắt buộc có nguồn thật |
| Tìm web | Có | Có | Có | Không | **Có, nhưng loop phía server** | Server tool web search native của provider (Anthropic, OpenAI, Gemini) tự lặp search. KIRA không tự viết loop |
| Folder thông tin | Không | Không | Có | Không | **Không** | Ingest bằng code (Rust / Swift helper) → chunk → tóm tắt one-shot từng nguồn |
| Tổng hợp có trích dẫn | Có ở mức sâu | Không | Có | Không | **Không ở MVP** | Map-reduce cố định: tóm tắt từng nguồn có id → tổng hợp có `[S1]` → kiểm trích dẫn tất định → ChangeSet |

**Kết luận B1:** Không skill nào ở MVP bắt buộc KIRA tự viết agent loop. Thứ duy nhất cần lặp là tìm web, và việc đó provider đã làm phía server. Giá trị loop tổng quát chỉ xuất hiện ở "nghiên cứu sâu tự chủ", và mục B5 khuyến nghị để phase 3 với ranh giới chặt.

### B2. So 4 phương án harness

| | (1) Tự viết loop TS/Rust | (2) KIRA mở MCP server, CLI chạy loop | (3) Claude Agent SDK trong sidecar | (4) **Lai (khuyến nghị)** |
|---|---|---|---|---|
| **Provider dùng được** | BYOK có tool calling: OpenAI, Anthropic, Gemini, OpenRouter; Ollama và LM Studio tuỳ model. **Không** dùng được Claude Code / Codex (chúng là agent, KIRA chỉ nhận text). Apple FM có Tool protocol [ngoài] nhưng chỉ gọi được từ Swift và context on-device **8.192 token** [ngoài, WWDC26] | **Chỉ** Claude Code và Codex (cả hai hỗ trợ MCP HTTP và stdio [ngoài]) | Chỉ Anthropic | Pipeline one-shot: **mọi provider**. Web search native: Anthropic, OpenAI, Gemini. MCP: Claude Code, Codex |
| **Auth** | Key trong Keychain như hiện tại | CLI tự lo, KIRA không đọc token (khớp ràng buộc đã chốt) | Theo trợ giúp Anthropic: app bên thứ ba dùng subscription qua Agent SDK nằm trong chính sách credit từ 2026-06-15, **nhưng đã bị tạm dừng** ngày 2026-06-15 [ngoài]. Nguồn phụ ghi OAuth Free/Pro/Max chỉ dành cho Claude Code và claude.ai [ngoài-phụ]. User đã từ chối OAuth trong app, nên thực tế chỉ còn API key | Không thêm đường auth mới |
| **Chi phí** | Token của provider + phí tool. Web search: Anthropic $10/1k search [ngoài], OpenAI $10/1k call + token nội dung [ngoài], Gemini 3.x 5.000 request/tháng miễn phí rồi $14/1k [ngoài] | Nằm trong gói Claude hoặc ChatGPT của user | API key Anthropic | Như (1) và (2), chỉ phát sinh khi user bật |
| **Độ trễ** | Thấp nhất (gọi HTTP trực tiếp) | Cao: khởi động CLI + chờ MCP kết nối, mặc định tối đa 30s (`MCP_TIMEOUT`) [ngoài] + nhiều lượt | Trung bình | One-shot giữ nguyên độ trễ hiện tại |
| **An toàn** | KIRA kiểm soát 100% tool, dễ bắt ghi → ChangeSet | CLI có tool riêng (Bash, Read, WebFetch…). **Bắt buộc** chặn: `--strict-mcp-config`, `--tools` / `--disallowedTools`, chỉ cho `mcp__kira__*` [ngoài]; Codex dùng `enabled_tools` + `default_tools_approval_mode` [ngoài]. MCP server phải có bearer token, **không** tái dùng listener `47653` (CORS `*`, không auth) | SDK có tool hệ thống; phải cấu hình như CLI | Tool ghi của MCP chỉ là `propose_changes` → ChangeSet, nên user vẫn duyệt dù loop chạy ở đâu |
| **Build / phân phối** | Rust: 3 dialect tool-call (OpenAI, Anthropic, Gemini) trong `reqwest`. Không nên đưa key sang JS để dùng AI SDK vì phá thiết kế secret-native hiện tại | MCP server Rust chạy trong tiến trình app (HTTP localhost + token). KIRA tự spawn CLI nên tự truyền `--mcp-config` kèm header, user không phải cấu hình | Thêm sidecar Node/Bun thứ hai (đã có tiền lệ codex-helper). Có bundle binary CLI không thì chưa kiểm | Phase 1 không thêm hạ tầng; phase 2 thêm tool schema cho 3 dialect nhưng chỉ server tool; phase 3 thêm MCP |
| **Đánh giá** | Hợp nếu sau này thật sự cần loop với BYOK | Hợp cho "nghiên cứu sâu" với người có Claude Code / Codex | Giá trị biên thấp, rủi ro chính sách | **Chọn** |

### B3. Định dạng skill

**Khuyến nghị: theo chuẩn Agent Skills (`SKILL.md`), giới hạn ở hướng dẫn và workflow.**

- [ngoài] Spec tại [agentskills.io/specification](https://agentskills.io/specification): frontmatter bắt buộc `name` (≤64 ký tự, `a-z0-9-`, trùng tên thư mục) và `description` (≤1024). Tuỳ chọn: `license`, `compatibility`, `metadata`, `allowed-tools` (đang **experimental**). Thư mục `scripts/`, `references/`, `assets/`. Nạp dần: khoảng 100 token metadata → body dưới 5.000 token → resource khi cần.
- **Lợi:** user viết một skill (vd `color-expert`) dùng được cả trong KIRA lẫn Claude Code / Codex. Điều này đặc biệt có ích với đường MCP ở phase 3. Không phải tự phát minh format.
- **Giới hạn bắt buộc [suy luận]:** KIRA **không chạy `scripts/`** của skill do user thêm. Chạy code tuỳ ý trong một app local-first có quyền đọc file và keychain là rủi ro lớn. Skill trong KIRA chỉ được gọi **tool dựng sẵn** của KIRA (tìm ảnh, ingest, palette metrics…), khai báo trong `allowed-tools` bằng tên tool KIRA. Script chỉ có tác dụng khi skill chạy ở Claude Code / Codex, nơi CLI tự lo sandbox.
- **Map sang mô hình user từng mô tả** (CLAUDE.md global, skill 13):
  - Persona → phần prepend chung trong Settings, không phải skill.
  - Prompt template có biến → giữ nhẹ như `kiraSuggestions` hiện có ([main.tsx:170](../../apps/desktop/src/main.tsx:170)), có thể lưu dạng skill có `metadata.variables`.
  - Prompt history → `AiRun` (A2).
  - HITL checkpoint của creative-os → bước "duyệt" trong pipeline, hiển thị ở tab Changes.
- **Vị trí lưu:** thư mục skill cấp app (Application Support) cộng tuỳ chọn skill theo project trong gói `.kira`. Mặc định **không tự quét** `~/.claude/skills` hay thư mục của tool khác. Cần user chốt.

### B4. Từng skill

| Skill | Harness? | Provider chạy được | Chi phí | Rủi ro chính |
|---|---|---|---|---|
| **Color expert** | Không. One-shot + metric tất định | Mọi provider có text; Apple FM đủ context (8K) nhưng sinh text chưa được nối trong Rust | Rất thấp | Hiện `regeneratePalette` ghi đè và im lặng fallback. Skill phải ghi rõ nguồn ("AI" hay "Harmony") và đi qua ChangeSet |
| **Tìm hình ảnh** | Không. Pipeline query → API → curate | Mọi provider (chỉ cần sinh query); gọi API bằng code Rust | API ảnh: free có giới hạn (dưới); OpenAI image web search $10/1k [ngoài] | License, attribution, kết quả rỗng im lặng (creative-os) |
| **Tìm web** | Loop phía server | Anthropic, OpenAI, Gemini (server tool). Claude Code có WebSearch nếu cho phép. Codex helper hiện tắt mạng. Ollama, LM Studio, Apple FM, OpenRouter tuỳ model: **không có**, trừ khi thêm API search bên thứ ba | $10–14/1k search + token [ngoài]. Bên thứ ba: Brave khoảng $5/1k, Tavily 1.000 credit/tháng free, Exa $7/1k [ngoài-phụ] | Prompt injection từ trang web; chi phí chạy ngầm; user nghĩ provider nào cũng tìm được |
| **Folder thông tin** | Không. Ingest bằng code | Tóm tắt: mọi provider. Trích: Rust hoặc Swift helper (đã có Swift helper cho Vision OCR) | Local | PDF lớn; tài liệu chứa lệnh nhắm vào AI (injection); quyền đọc thư mục |
| **Tổng hợp có trích dẫn** | Không ở MVP (map-reduce) | Mọi provider cho map; reduce cần context lớn (Apple FM 8K khó đảm nhận) | Trung bình (N lượt map) | Trích dẫn bịa. Giảm bằng kiểm tất định: id `[S#]` phải tồn tại và câu trích phải có trong text nguồn |

**Nguồn ảnh [ngoài]:**

| Nguồn | Auth | Giới hạn | Điều khoản đáng chú ý cho KIRA |
|---|---|---|---|
| **Openverse** | Cho phép ẩn danh; đăng ký OAuth2 `client_credentials` để lên hạn mức cao hơn | Có throttle ẩn danh và standard, nhưng tài liệu fetch được **không ghi số** | Ảnh CC / public domain, lọc được theo license. **Hợp nhất với local-first** (ghi license vào node) · [docs.openverse.org](https://docs.openverse.org/api/reference/authentication_and_throttling.html) |
| **Unsplash** | API key | Demo 50 request/giờ, production 1.000/giờ sau khi duyệt | **Bắt buộc hotlink** URL API trả; phải gọi download endpoint mỗi lần tải; ghi công tác giả và Unsplash; cấm "replicate core experience", tích hợp trong app lớn hơn thì được · [unsplash.com/documentation](https://unsplash.com/documentation), [guideline](https://help.unsplash.com/en/articles/2511257-guideline-replicating-unsplash). **Xung đột một phần** với việc materialize ảnh vào `.kira` [suy luận]: phải coi lưu vào project là "download" và gọi endpoint |
| **Pexels** | API key | 200/giờ, 20.000/tháng | Ghi công "Photo by X on Pexels" kèm link; cấm sao chép chức năng lõi, cấm app wallpaper · [pexels.com/api/documentation](https://www.pexels.com/api/documentation/) |
| **Are.na** | OAuth2 cho ghi, token không hết hạn | Chưa tìm được số | Hợp văn hoá moodboard; chưa kiểm đủ điều khoản · [dev.are.na](https://dev.are.na/documentation/authentication) |
| Web image search của provider | Theo provider | Theo giá tool | **License không rõ**: chỉ lưu `sourceUrl`, gắn nhãn "chưa rõ quyền dùng" |

Thứ tự khuyến nghị: **Openverse trước** (không cần key, license rõ). Unsplash và Pexels là key BYOK tuỳ chọn, lưu Keychain cùng service hiện có. Mọi lần tìm phải hiển thị **"0 kết quả"** kèm query đã dùng, không bao giờ im lặng.

### B5. Định vị sản phẩm: có làm loãng PRODUCT.md không?

- PRODUCT.md định nghĩa KIRA là "turning references into connected ideas, outlines, and presentations"; USP là capture không gãy flow; tính cách "calm… Not flashy, not AI product coded".
- **Không loãng nếu** nghiên cứu được định nghĩa là **khâu trước của "references"**: tìm nguồn → curate → thành node có provenance → nối vào ý tưởng. Đó là mở rộng tự nhiên của capture.
- **Loãng nếu** KIRA thành chat assistant đa năng hoặc deep-research agent chạy dài tự viết báo cáo.

**Ranh giới khuyến nghị:**

1. Mọi đầu ra nghiên cứu **phải kết thúc thành node hoặc nguồn trên canvas** (qua ChangeSet), không để câu trả lời sống riêng trong chat.
2. Không có tác vụ AI chạy nền không có người khởi động. Mỗi run do user bấm.
3. Không browse thay user. Web search chỉ trả nguồn và tóm tắt; mở trang thật vẫn dùng trình duyệt và extension capture.
4. Panel đóng mặc định; không đặt AI lên màn hình chào hay onboarding hero.
5. Đề xuất bổ sung một dòng vào Core Features của PRODUCT.md khi user chốt: "Research: find, ingest, and synthesize sources into cited nodes". Việc sửa PRODUCT.md thuộc Orchestrator và user.

---

## C. Khuyến nghị, MVP, phase, rủi ro

### Hướng A: Panel phải "Chat + Changes", đề xuất trước khi đè

**MVP A (một nhánh Worker):**

1. Mô hình `AiThread / AiMessage / AiRun / AiChangeSet`, lưu `canvas_collections`, không đưa vào version archive.
2. Panel phải 2 tab Chat và Changes, đóng mặc định, set `--canvas-right-inset`.
3. Dock gửi vào thread active; dòng trạng thái mở panel.
4. Chuyển `createAiNode` và `regeneratePalette` sang ChangeSet. Tạo node áp dụng ngay có badge; palette chờ duyệt.
5. Provenance trên node + sửa `aiGenerated` + trigger đúng thay cho `'user_edit'`.
6. Kéo tin nhắn AI thả lên canvas thành idea node.

**Phase A2:** diff text chi tiết, tab Sources (cùng B phase 2), đánh giá run 1–5, lọc thread theo node, xoá lịch sử run.
**Phase A3:** áp dụng trên branch mới, checkpoint theo lô, tìm trong lịch sử run.

### Hướng B: Pipeline có checkpoint trên one-shot, lai MCP về sau

**MVP B (sau MVP A, vì cần ChangeSet):**

1. Khung "skill pipeline" tối giản: skill = `SKILL.md` + các bước dựng sẵn (`generate` one-shot, `tool` tất định, `checkpoint` chờ user) → kết thúc bằng ChangeSet.
2. Hai skill đầu, **không cần mạng hay key mới**:
   - **color-expert**: metric local + one-shot.
   - **folder-brief**: chọn thư mục → trích text MD/TXT/PDF → tóm tắt từng nguồn → node tổng hợp có trích dẫn `[S#]` đã kiểm.
3. Giới hạn tool CLI tường minh: thêm `--tools` hoặc `--disallowedTools` phù hợp cho `claude -p` hiện tại [suy luận, cần Worker kiểm cờ trên binary thật].

**Phase B2:** tìm ảnh (Openverse, rồi Unsplash/Pexels BYOK) với checkpoint curate; web search bằng server tool native cho Anthropic/OpenAI/Gemini, kèm báo rõ provider nào không hỗ trợ; tab Sources; nguồn URL.
**Phase B3:** MCP server KIRA (HTTP localhost + bearer token do KIRA sinh) chỉ gồm `read_canvas`, `read_sources`, `propose_changes`, cho Claude Code / Codex chạy "nghiên cứu sâu". Cân nhắc lại loop tự viết chỉ khi có yêu cầu thật với BYOK.

### Phạm vi sửa B [suy luận]

| File | Việc | Cỡ |
|---|---|---|
| Mới `apps/desktop/src/kira-skills/` | Loader `SKILL.md`, pipeline runner, 2 skill mặc định | khoảng 600–900 dòng |
| `lib.rs` hoặc **file Rust mới** (vd `src-tauri/src/ingest.rs`) | Trích text PDF/MD, đọc thư mục, (B2) client Openverse/Unsplash/Pexels, (B2) tool schema web search cho 3 provider | khoảng 400–800 dòng; nên tách module khỏi `lib.rs` 5.7k dòng |
| Swift helper (tuỳ chọn) | PDFKit trích text nếu crate Rust không đạt | khoảng 100–200 dòng |
| `main.tsx` | Chỗ gọi skill từ dock và panel, hiển thị checkpoint | khoảng 100–200 dòng |
| `codex-helper` | (B3) truyền MCP config; (B2) bật web search nếu dùng | nhỏ |

### Rủi ro tổng

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Làm loãng sản phẩm thành "AI app" | Cao | Ranh giới B5; panel đóng mặc định; mọi đầu ra thành node |
| Prompt injection từ PDF, web, ảnh (OCR) dẫn tới đề xuất xoá hoặc sửa | Trung bình | Tool ghi chỉ tạo ChangeSet; delete luôn chờ duyệt; không cho skill chạy script |
| Kết quả rỗng im lặng (đã xảy ra ở creative-os) | Trung bình | Mọi bước tool trả `count` + `errors` và hiển thị |
| License ảnh | Trung bình | Field `license/creator/attribution` bắt buộc với nguồn API; nguồn không rõ gắn nhãn |
| Chính sách subscription của Anthropic thay đổi (đã tạm dừng 06/2026) | Trung bình (chỉ với phương án 3) | Không chọn Agent SDK sidecar |
| Listener `47653` không auth, CORS `*` | Có sẵn hôm nay, độc lập với đề xuất | Báo riêng (§E); MCP phải dùng listener khác có token |
| Va chạm file nóng | Cao | Code mới đặt trong module riêng; claim `main.tsx` theo vùng |

---

## D. Quyết định cần user chốt

1. **Panel phải:** (a) bổ sung dock *(khuyến nghị)* · (b) thay dock · (c) chưa làm
2. **Node AI tạo mới:** (a) áp dụng ngay có badge, bỏ được *(khuyến nghị)* · (b) luôn chờ duyệt
3. **AI sửa node có sẵn** (text, palette, link, xoá): (a) luôn chờ duyệt *(khuyến nghị)* · (b) áp dụng ngay, dựa vào undo
4. **Restore version có đưa chat về quá khứ không:** (a) không, chat độc lập *(khuyến nghị)* · (b) có
5. **Harness:** (a) pipeline one-shot trước, MCP ở phase 3 *(khuyến nghị)* · (b) tự viết agent loop ngay · (c) Agent SDK sidecar
6. **Skill do user thêm:** (a) chỉ `SKILL.md` hướng dẫn, không chạy script *(khuyến nghị)* · (b) cho chạy script có hỏi quyền · (c) chưa mở cho user thêm
7. **Nơi đọc skill:** (a) chỉ thư mục của KIRA *(khuyến nghị)* · (b) đọc thêm `~/.claude/skills` và thư mục các tool khác
8. **Nguồn ảnh đầu tiên:** (a) Openverse không key *(khuyến nghị)* · (b) Unsplash/Pexels với key BYOK · (c) web image search của provider
9. **Web search cho provider không có server tool** (Ollama, LM Studio, Apple, Claude Code/Codex ở đường one-shot): (a) báo "không hỗ trợ" *(khuyến nghị)* · (b) thêm API bên thứ ba (Brave/Exa/Tavily) cần key
10. **Định vị:** có thêm "Research" vào Core Features của PRODUCT.md không: (a) có, với ranh giới B5 · (b) chưa

## E. Phát hiện phụ (ngoài phạm vi, nên giao riêng)

1. **`aiGenerated` không bao giờ `true`** ([main.tsx:4794](../../apps/desktop/src/main.tsx:4794)); `regeneratePalette` ghi trigger `'user_edit'` cho thay đổi AI và im lặng fallback ([main.tsx:4890-4935](../../apps/desktop/src/main.tsx:4890)).
2. **Listener capture `127.0.0.1:47653`:** `Access-Control-Allow-Origin: *`, không token. `GET /context` lộ tiêu đề, snippet, thumb node cho mọi tiến trình local. Trang web thì còn tuỳ chính sách Local Network Access của trình duyệt [suy luận, chưa thử]. `POST /capture` nhận payload từ bất kỳ ai ([lib.rs:4382-4405](../../apps/desktop/src-tauri/src/lib.rs:4382)). Nên có token chia sẻ với extension hoặc kiểm `Origin`.
3. **`claude -p` không giới hạn tool** ([lib.rs:2368](../../apps/desktop/src-tauri/src/lib.rs:2368)). Theo tài liệu CLI, ở chế độ print không tool nào chạy nếu chưa được cấp quyền [ngoài, qua bản tóm tắt docs, chưa chạy thử], nên rủi ro hiện tại thấp. Tuy vậy vẫn nên khoá tường minh để không phụ thuộc default hay settings của user (`~/.claude/settings.json` có thể đang allow tool).
4. **`docs/ARCHITECTURE.md`, `docs/DATABASE.md` lỗi thời:** vẫn mô tả snapshot v1 và thiếu `canvas_collections`, migration 008/009.
5. Version archive chép cả `nodeVersions` vào mỗi bản trong 50 version ([main.tsx:5533](../../apps/desktop/src/main.tsx:5533)). Chưa đo dung lượng thực tế.

## F. Yêu cầu mockup cho UI/UX (giao sau)

1. **Panel phải đóng và mở:** vị trí nút mở trong cụm trên phải (tính cả vấn đề chồng lớp §3.1 RESEARCH_MOODBOARD_UX), độ rộng, cách overlay canvas lùi theo `--canvas-right-inset`, trạng thái khi cửa sổ hẹp.
2. **Tab Chat:** danh sách thread, lọc theo node đang chọn, tin nhắn có "chi tiết run", thao tác kéo câu trả lời thả lên canvas.
3. **Tab Changes:** một ChangeSet với 4 loại item (tạo node, sửa text có diff, đổi palette trước/sau, xoá node), nút nhận/bỏ từng item và nhận hết, trạng thái `stale`, link "Lịch sử node" và "Version trước Kira".
4. **Badge provenance trên node:** "AI" và "AI, đã sửa", không màu-only, không vi phạm One-Accent.
5. **Dòng trạng thái ở dock** khi panel đóng ("3 thay đổi chờ duyệt · Mở").
6. **Checkpoint trong pipeline skill:** duyệt nhánh concept, curate ảnh kèm license và trạng thái "0 kết quả".

## G. Giới hạn của báo cáo

- Không chạy app, không chạy CLI, không gọi API. Mọi nhận định về hành vi CLI và API dựa trên tài liệu; một số trang chỉ đọc qua bản tóm tắt tự động của WebFetch.
- Giá search API bên thứ ba (Brave, Tavily, Exa) và thông tin Cursor, NotebookLM, ChatGPT Canvas lấy từ nguồn phụ, chưa đối chiếu trang chính thức.
- Số giới hạn Openverse và Are.na chưa tìm được.
- Ước lượng số dòng là suy luận, chưa có spec chi tiết.

## Cập nhật 2026-09-13: phụ lục OSS

Xem [2026-09-13-right-panel-harness-oss.md](2026-09-13-right-panel-harness-oss.md). Kết luận A và B giữ nguyên hướng. Điều chỉnh:
- A MVP dựng trên assistant-ui primitives + Immer patches + jsdiff.
- Ingest dùng xberg + Readability/Turndown thay vì tự viết.
- MCP server dùng rmcp.
- Nếu phase 2 cần tool loop thì dùng Vercel AI SDK trong sidecar Bun, không tự viết.
- Thêm quyết định D11–D14 và 4 spike.

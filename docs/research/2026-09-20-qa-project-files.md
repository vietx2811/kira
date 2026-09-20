# QA Project Files — toàn vẹn dữ liệu project

Commit kiểm: `946cb38` (main, 2026-09-20). Bundle debug: `KIRA.app` build Sep 20 04:49, sau commit code app cuối (`56ad91e` 04:46).
Trạng thái: **đường native GUI bị chặn** (request_access bị từ chối), nên toàn bộ kết luận dưới đây dựa trên đọc mã + **hiện vật thật trên đĩa** của một package đã lưu, không phải thao tác GUI.

Hiện vật đối chứng (chỉ đọc, không ghi):
`~/Library/Application Support/studio.kira.desktop/Kira Demo.kira`

---

## F1 — MẤT DỮ LIỆU: tên board và accent của project bị xoá sạch mỗi lần lưu rồi mở lại

**Cơ chế.** `read_project_package()` (lib.rs:662) **ưu tiên SQLite** bất cứ khi nào `project.sqlite` tồn tại, tức là luôn luôn sau một lần lưu thật (chính comment của team ở lib.rs:84-88 nói vậy). Nhưng:

- struct Rust `ProjectSnapshot` (lib.rs:48) **không có trường `project`, không có trường `appearance`** — trong khi type TS (main.tsx:542) khai báo cả hai là **bắt buộc**.
- `write_snapshot()` (lib.rs:1038) không hề ghi chúng: `project_meta` chỉ nhận đúng một dòng `version` (lib.rs:1062); `write_json_collection` được gọi cho 10 key (palettes, diagrams, placeholders, frames, aiSettings, versionState, versionHistory, nodeVersions, aiPanel, slidesConfig) — **không có project/appearance** (lib.rs:1204-1213).
- `read_snapshot()` (lib.rs:1231) dựng lại struct cũng không có hai trường đó.
- `isProjectSnapshot()` (main.tsx:16782) gặp `undefined` thì **âm thầm** thay bằng mặc định qua `normalizeProjectMetadata` / `normalizeProjectAppearance`.

**Bằng chứng trên đĩa** (package đã lưu thật):

- `manifest.json` CÓ đủ:
  `project = {"title":"KIRA Project","description":"Creative workspace file.","author":"","kind":"moodboard","styleNote":""}`
  `appearance = {"colorMode":"light","canvasColor":"#f0efe7","accentPreset":"custom","accentColor":"#004a56"}`
- `project.sqlite` KHÔNG có chỗ chứa:
  `canvas_collections` keys = `aiSettings, diagrams, nodeVersions, palettes, placeholders, versionHistory, versionState`
  `project_meta` = chỉ `version|2`

**Hậu quả người dùng.** Mở lại project trên:
- title/description/author/kind/styleNote → `Untitled` / `Creative workspace file.` / `` / `moodboard` / `` (defaultProjectMetadata, main.tsx)
- colorMode/accent → `dark` + preset `cyan` (defaultProjectAppearance)
→ **Một project light mode accent xanh cổ vịt `#004a56` mở lại thành dark mode accent cyan.** Toàn bộ theme app đổi, vì `buildProjectAppearanceStyle(projectAppearance)` lái token màu.

**Vì sao lọt lưới.** Nhãn tab lấy từ **tên file** (`projectFileDisplayName`, main.tsx:2297), không lấy từ `projectMetadata.title` — nên tab vẫn hiện đúng tên trong khi Settings đã về "Untitled". Và **không có test nào**: chuỗi `appearance` xuất hiện **0 lần** trong toàn bộ `lib.rs`. Hai lần trước cùng lớp lỗi này (`slidesConfig`, `aiPanel`) đều đã có test hồi quy; `project`/`appearance` thì chưa ai kiểm.

**Tái hiện.** Đổi tên board + đổi accent sang màu tuỳ chỉnh → Save → đóng app → mở lại file → Settings: tên về "Untitled", accent về cyan, app đổi sang dark.

**Lối gỡ (và thêm một xác nhận).** `snapshotForVersionArchive()` CÓ kèm `project`/`appearance`, và `versionHistory` round-trip nguyên vẹn (JSON đục qua canvas_collections). Nên **khôi phục một version cũ sẽ lấy lại được tên và accent** — vừa là cách cứu dữ liệu cho user, vừa là phép đối chứng cho chẩn đoán trên.

---

## F2 — MẤT DỮ LIỆU: sticky note mất hẳn danh tính; cờ loại-trừ-AI và tuỳ chọn hiển thị của ảnh bị mất

Sticky note **chính là** `Idea` với `variant: 'sticker'` (`createSticker()`, main.tsx:4589; type main.tsx:344; render main.tsx:10071).

- `IdeaRecord` (lib.rs:94) **không có `variant`, không có `aiExcluded`**.
- `ReferenceRecord` **không có `aiExcluded`, `tagsPinned`, `palettePinned`, `blockOrder`**.

**Bằng chứng trên đĩa** (`PRAGMA table_info` của DB thật):
- `ideas`: `id title body status x y importance created_at added_at updated_at source_url notes scale` — không có `variant`, không có `ai_excluded`.
- `reference_assets`: không có `ai_excluded` / `tags_pinned` / `palette_pinned` / `block_order`.
- grep toàn bộ `.schema` cho variant|ai_excluded|tags_pinned|palette_pinned|block_order → **0 khớp**.

**Hậu quả.** Mở lại: **mọi sticky note biến thành node idea thường** (mất nghiêng, mất kiểu giấy dán). Và mọi node từng bật "loại khỏi ngữ cảnh AI" **âm thầm quay lại nằm trong ngữ cảnh gửi cho AI** — đây là lỗi đúng đắn ngữ cảnh, không chỉ là thẩm mỹ.

Các loại node khác an toàn: palette / diagram / placeholder / frame đi qua dạng JSON đục nên nguyên vẹn; link giữ đủ relation, note, confidence, source/target kind; tag và notes của ảnh nguyên vẹn; crop, kích thước, fingerprint nguyên vẹn.

---

## F3 — KHÔNG MỞ ĐƯỢC PROJECT, KHÔNG BÁO GÌ: board không có node idea nào

`isProjectSnapshot()` bắt buộc `snapshot.ideas.length > 0` (main.tsx:16787). Một moodboard thuần ảnh + palette (không có node idea) là ca dùng bình thường của sản phẩm, nhưng:

- `openNativeProjectPackage()` trả `null` (main.tsx:17068)
- người gọi: `if (!snapshot) return` (main.tsx:6882) — **không báo lỗi, không status, không gì cả**

→ User bấm Open, chọn file, **không có chuyện gì xảy ra**. Cùng luật này chặn cả Import project (main.tsx:6068) và khôi phục version (main.tsx:5912).

---

## F4 — SAI LỆCH ÂM THẦM: chuyển nhánh báo thành công nhưng giữ nguyên canvas của nhánh cũ

`switchVersionBranch()` (main.tsx:5943): nếu snapshot ở head của nhánh đích không qua được `isProjectSnapshot`, luồng **rơi ra ngoài khối `if`** xuống `setVersionState(nextVersionState)` + `setLibraryStatus('Branch: X')`.

→ User thấy báo "Branch: X" thành công, nhưng canvas vẫn là nội dung nhánh cũ, còn versionState đã ghi là đang ở nhánh X. **Lần Save kế tiếp sẽ ghi nội dung sai đè lên nhánh X.** Kết hợp với F3 (nhánh nào không có node idea thì luôn fail validate), đây là đường mất việc thật sự.

---

## F5 — Nhập file hỏng và khôi phục version thất bại đều im lặng

- `importProject()` (main.tsx:6068): `if (!isProjectSnapshot(parsed)) return` và `catch { return }` — file không hợp lệ thì **không một thông báo nào**.
- `restoreProjectVersion()` (main.tsx:5912): nhánh validate fail `return` trần; chỉ nhánh lỗi JSON mới set "Version restore failed".

---

## F6 — Thoát app khi chưa lưu: mất việc, không hề nhắc

- Không có `onCloseRequested` / `beforeunload` trong `main.tsx`; không có `on_window_event` / `prevent_close` trong `lib.rs`; `tauri.conf.json` không cấu hình gì về close.
- localStorage **chỉ được ghi khi lưu tường minh** (main.tsx:6014 / 6024 / 6043) và trong `applyProjectSnapshot` — **trạng thái dirty không bao giờ được autosave**.
- "Continue last session" đọc **file đã lưu trên đĩa**, không phải state chưa lưu.

Đường đóng **tab** thì có chốt (`requestCloseFile` → dialog khi `isDirty`). Lỗ hổng là **Cmd+Q và nút đỏ**: đóng thẳng, mất sạch phần chưa lưu.

---

## F7 — Nhỏ: tên file export bị băm khi có dấu tiếng Việt

`sanitize_export_filename()` (lib.rs) đổi mọi ký tự không phải ASCII alphanumeric thành `-`, nên "Bảng màu" → `B-ng-m-u`. Chỉ ảnh hưởng **export** (slides/outline/contact sheet).
Tên file **project** thì ổn: `projectFileDefaultName()` chỉ thay `/` và `:`. Dấu tiếng Việt và khoảng trắng trong tên file `.kira` không có vấn đề ở tầng này.

Hệ quả phụ của F1: sau khi mở lại, "Save As" gợi ý `Untitled.kira` thay vì tên board của user.

---

## Chưa kiểm được (vì GUI native bị chặn)

Save panel / Open panel hệ thống, nút Import project ở rail trái, lỗi khi lưu vào đường không ghi được có hiện lên UI không (mã có bắt: `Save failed: {message}`), mở hai tab rồi lưu chéo, và xác nhận end-to-end F1/F2/F3 bằng thao tác thật.

---

## Đối chứng bộ test

`cargo test --lib` trong `apps/desktop/src-tauri`: **39 passed, 0 failed** (exit 0).
Trong đó có `slides_config_round_trips_through_save_and_load` và `ai_panel_field_round_trips_through_save_and_load` — đúng hai trường mà ai đó đã từng phát hiện bị rơi và đã thêm test hồi quy. **Bộ test xanh hoàn toàn trong khi `project`/`appearance` vẫn biến mất.** Đây là lỗ hổng độ phủ, không phải build hỏng: không ai tổng quát hoá phép kiểm round-trip ra mọi trường của type TS.

Đề xuất test chặn hồi quy: một test so **tập khoá của `ProjectSnapshot` TS** với tập trường struct Rust, để mọi trường thêm mới sau này đều fail nếu chưa có chỗ chứa — thay vì thêm test lẻ cho từng trường sau khi người dùng đã mất dữ liệu.

---

# PHẦN 2 — Kiểm trên trình duyệt (không cần GUI native)

Dev server vite trên cổng 56339 (5173 đã có thread khác chiếm, autoPort tự đổi), tree chính tại `946cb38`.

## Bảng command Tauri liên quan lưu / mở / nhập / xuất

Định dạng file: **`.kira` là một THƯ MỤC package**, gồm `manifest.json` (bản JSON nguyên văn), `project.sqlite` (**nguồn sự thật khi đọc**), `images/`, `thumbs/`, `exports/`.

| Command | Tham số | Trả về | Rủi ro mất dữ liệu |
|---|---|---|---|
| `save_project_package` | `snapshot_json: String`, `project_path: Option<String>` | `ProjectPackageInfo` | **CAO** — `write_snapshot()` bỏ `project`, `appearance`, `variant`, `aiExcluded`, `tagsPinned`, `palettePinned`, `blockOrder` (F1, F2). Từ chối `version != 2` |
| `open_project_package` | `app` (thư mục mặc định) | `Option<String>` | **CAO** — ưu tiên SQLite, nên trả về bản đã mất trường |
| `open_project_package_at` | `project_path: String` | `Option<String>` | **CAO** — như trên. `normalize_project_path` tự ép đuôi `.kira` |
| `import_reference_folder` | `folder_path: String` | `Vec<ImportedReferenceRecord>` | Thấp, chỉ nhập ảnh |
| `import_eagle_web_items` | `limit: Option<u32>` | `Vec<ImportedReferenceRecord>` | Thấp |
| `capture_screen_reference` | — | `Option<ImportedReferenceRecord>` | Thấp |
| `export_outline_markdown` / `_html` | `markdown`/`html`, `project_path` | `Option<String>` | Ghi đè `exports/outline.*` không hỏi |
| `export_contact_sheet_html` | `html`, `project_path` | `Option<String>` | Ghi đè `exports/contact-sheet.html` |
| `export_slideshow_html` | `html`, `project_path` | `Option<String>` | Ghi đè `exports/slides.html` |
| `export_slideshow_pptx` | `base64_data`, `filename`, `project_path` | `Option<String>` | Tên file bị băm nếu có dấu (F7) |

Không có command nào đọc/ghi project ngoài ba cái đầu. Không có command xoá project.

## Versioning schema và file bản cũ

- Chỉ có **một số phiên bản snapshot: `version: 2`**. `save_project_package` **từ chối** mọi `version != 2` (lib.rs:452).
- `schema_migrations` + `add_column_if_missing` chỉ migrate **cột SQLite**, **không bao giờ nâng `project_meta.version`** từ 1 lên 2. Không tồn tại đường nâng cấp v1 → v2.
- `read_snapshot()` lấy version từ `project_meta`, thiếu thì `unwrap_or(1)` (lib.rs:1240). Frontend `isProjectSnapshot` đòi `version === 2`.
- **Kết luận: package của bản cũ (v1) mở ra là thất bại im lặng** — cùng đường F3, không báo gì.

## Độ phủ test phía TS

`bun test apps/desktop/src/kira` → **47 pass, 0 fail, nhưng chỉ 1 file** (`aiPanelModel.test.ts`).
**Không một test nào phủ snapshot, lưu, mở, version hay branch.** Cộng với `cargo test` (39 pass, chỉ có round-trip cho `slidesConfig`/`aiPanel`), toàn bộ đường toàn vẹn dữ liệu project gần như không được test.

## Kiểm thật: lịch sử phiên bản và nhánh — ĐẠT

Qua `window.__kiraDev` trên node `idea-ritual-tools`:

| Bước | Kết quả |
|---|---|
| `switchBranch('main')` | canvas về đúng nội dung head của main |
| đổi tên `MAIN-ONLY`, `saveVersion` | lưu vào branch `main` |
| `switchBranch('feature')` | tiêu đề thành `MAIN-A` (đúng head của feature) |
| đổi tên `FEATURE-ONLY`, `saveVersion` | lưu vào branch `feature` |
| `switchBranch('main')` | **trả về đúng `MAIN-ONLY`** |

→ **Cách ly nhánh hoạt động đúng ở đường thuận.** F4 là lỗi **tiềm ẩn**, chỉ kích hoạt khi snapshot ở head của nhánh đích trượt `isProjectSnapshot` (ví dụ nhánh không còn node idea nào — chính điều kiện F3).

*Lưu ý phương pháp:* `__kiraDev` được dựng lại mỗi lần render (deps ở main.tsx:2735). Phải đọc `window.__kiraDev` **mới mỗi lần gọi**; giữ một tham chiếu sẽ đọc phải state cũ và cho kết quả sai (tôi đã dính đúng bẫy này ở lần chạy đầu).

## Kiểm thật: F3 và F5 — XÁC NHẬN, qua đúng đường import sản phẩm

Bắn `File` thật vào `input[type=file][accept=application/json]` (chính là `onImportProject={importProject}`, main.tsx:6368):

| Ca | Kết quả | Chữ mới trên màn hình |
|---|---|---|
| **Đối chứng dương**: snapshot hợp lệ, 1 idea | ideas 3 → **1**, tiêu đề `IMPORTED-OK` — **đường import chạy thật** | (áp dụng) |
| snapshot **hợp lệ hoàn toàn**, chỉ khác `ideas: []` | **không có gì xảy ra**, state giữ nguyên | **rỗng** |
| JSON hỏng (`{ not json at all`) | **không có gì xảy ra** | **rỗng** |

Quét regex `invalid|failed|error|không hợp lệ|lỗi` trên toàn bộ text màn hình sau đó: **không khớp**.
Nhờ có đối chứng dương, "không có gì xảy ra" là **phát hiện thật**, không phải test hỏng.

## Kiểm thật: khoanh vùng F1 chính xác vào tầng Rust

Snapshot import mang `project.title = "QA IMPORTED"` và `appearance.accentColor = #004a56`, `colorMode: light`. Sau khi import (đường thuần TS, **không qua Rust**):

- `--accent-strong: #024b57`, `--accent-on-glass-active: #004651`, `--accent-cyan: #1c5c68` — **dẫn xuất từ #004a56**, không phải cyan mặc định
- theme sáng, nhãn tab và DOM hiện `QA IMPORTED`

→ **Cùng một JSON**: qua đường trình duyệt thì tên và accent **giữ nguyên hoàn hảo**; qua `save → sqlite → open` thì **mất sạch**.
**Frontend vô can. Lỗi nằm đúng ở tầng persistence Rust.**

(Cũng giải thích luôn vì sao nhãn tab che mất lỗi: ở đây chưa có đường file nên tab lấy `projectMetadata.title`; sau một lần lưu thật, `projectPackage.path` tồn tại nên tab lấy **tên file** và trông vẫn đúng.)

---

# PHẦN 3 — Tái hiện F4 thành công, và một đính chính quan trọng về F3

## Đính chính: có chốt chặn xoá node idea cuối, nhưng chốt bị đường khác lách qua

`requestIdeaDelete()` có **chốt cứng**: `if (!idea || ideas.length <= 1) return` (main.tsx). Xoá **từng node** thì không bao giờ về được 0 idea — và chốt này im lặng, không giải thích vì sao nút Delete không làm gì.

Nhưng `deleteSelectedGraphNodes()` (main.tsx:4041) — đường **xoá nhiều node cùng lúc** — **không có chốt đó**, và cũng **không hỏi xác nhận**: phím Delete khi đang multi-select gọi thẳng `onDeleteNodes(multiSelectedNodes)` (main.tsx:8046-8048).

→ **Bất đối xứng**: xoá một node thì vừa hỏi xác nhận vừa chặn node cuối; xoá nhiều node thì không hỏi gì và không chặn gì. Ai đó đã biết trạng thái 0 idea là nguy hiểm và chốt một đường, nhưng bỏ sót đường kia.

**Đã tái hiện thật**: shift+`pointerdown` chọn 3 node (gồm node idea cuối) rồi bấm Delete → `ideas 1 → 0`, `images 6 → 4`. **Trạng thái 0 idea hoàn toàn đạt được bằng thao tác bình thường của user** (quét chọn nhiều node rồi xoá). F3 và F4 vì vậy **không phải chuyện lý thuyết**.

## F4 — TÁI HIỆN THÀNH CÔNG, từ suy luận thành bằng chứng

Dựng: nhánh `empty` có head là phiên bản **0 idea**; nhánh `main` có head là phiên bản **1 idea** (`MAIN-HAS-CONTENT`).

| Bước | Quan sát |
|---|---|
| Đang ở `main`, canvas có 1 idea | — |
| `switchBranch('empty')` | **status hiện `Branch: empty`** (báo thành công) |
| `versionState.currentBranchId` | → **`empty`** |
| Canvas thực tế | **vẫn 1 idea của `main`**, không phải 0 idea của `empty` |

→ App ghi nhận user đang ở nhánh `empty`, báo thành công, nhưng **màn hình vẫn là nội dung nhánh `main`**.

**Hậu quả, cũng đã chạy thật:** `saveVersion()` ngay sau đó lưu vào branch `empty` (`savedOnBranch: 'empty'`), và head của `empty` **chuyển sang trỏ đúng bản lưu này** (`headNowPointsAtThisSave: true`) với **1 idea của `main`**.
→ **Nội dung gốc của nhánh `empty` bị nội dung nhánh khác ghi đè, âm thầm, sau khi app đã báo "thành công".** Đây là chuỗi mất việc hoàn chỉnh, không còn là suy luận.

## Ghi chú phụ

Xoá hàng loạt **không có bước xác nhận nào**, trong khi xoá một node thì có. Với thao tác quét chọn rồi bấm Delete, user mất nhiều node cùng lúc mà không được hỏi (undo có `pushCanvasHistory` nên còn gỡ được, nhưng sự bất đối xứng này đáng xem lại).

## Kịch bản E2E dựng sẵn cho F1 và F2

`e2e-f1-f2.js` (cùng thư mục): dán vào Web Inspector console của **bản debug native**, nó tự `save_project_package` ra `/tmp`, `open_project_package_at` đọc lại, rồi in `console.table` đối chiếu từng trường (`project.*`, `appearance.*`, `variant`, `aiExcluded`, `tagsPinned`, `blockOrder`) kèm **3 trường đối chứng** (`link.confidence`, `image.tags`, `image.notes`) phải GIỮ — nếu đối chứng cũng MẤT thì kịch bản sai chứ không phải app sai. Chạy một lượt là xong F1 + F2 khi có quyền.

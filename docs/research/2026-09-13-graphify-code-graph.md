# Nghiên cứu: graphify (code knowledge graph) cho KIRA

- **Câu hỏi:** Có nên dùng "graphify" làm code knowledge graph cho các agent làm việc trong repo vixio/KIRA không? So với phương án tự viết "graphify-lite" thì sao?
- **Người yêu cầu:** User, giao qua Orchestrator (2026-09-13)
- **Commit đã kiểm chứng:** vixio `1c59e98` (branch `researcher/graphify-research`). graphify: `Graphify-Labs/graphify`, nhánh `v8`, commit `fe66389083` (2026-09-12), bản phát hành `v0.9.61`.
- **Kết luận ngắn:** **Làm graphify-lite, không dùng graphify.**
  1. graphify cố ý **không** nối lời gọi hàm giữa hai ngôn ngữ khác nhau. Rust extractor của nó bỏ qua macro (`generate_handler!`) và attribute (`#[tauri::command]`). Nó không đọc file `.css`. Ba tiêu chí quan trọng nhất (1, 3 và bản đồ provider) vì thế đều trượt.
  2. Hook tự rebuild của graphify **bỏ qua mọi commit trong linked worktree**, trong khi luật repo bắt mọi thread làm trong worktree. Graph sẽ stale đúng ở nơi agent dùng nó.
  3. Một script thử 180 ms đã dựng được bản đồ (a) chính xác, và tìm ra 2 biến CSS chưa khai báo mà ta chưa biết.

Nhãn nguồn dùng trong báo cáo: **[code]** = đã xác minh trong code (kèm `file:line`), **[ngoài]** = nguồn ngoài (truy cập 2026-09-13), **[suy luận]** = suy luận của Researcher, chưa chạy thử.

---

## 1. "graphify" là gì

- **[ngoài]** Repo chính thức là [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify), trang chủ [graphify.com](https://www.graphify.com). License Apache-2.0, viết bằng Python. Repo tạo ngày 2026-04-03, có khoảng 116k sao và 1.316 issue đang mở. Nhánh mặc định là `v8`.
- **[ngoài]** Package PyPI chính thức là `graphifyy` (hai chữ y). README ghi rõ các package `graphify*` khác trên PyPI không liên quan. Đây là rủi ro gõ nhầm tên khi cài.
- **[ngoài]** Tốc độ phát hành rất nhanh: `v0.9.57` đến `v0.9.61` ra trong 4 ngày (09-09 đến 09-12), riêng ngày 09-12 có 3 bản.
- **[ngoài]** Còn các trang/repo trùng tên như `graphify.net` và fork `sharkkyyy10/graphify-`. Chúng không phải nguồn chính thức, nên báo cáo này không dùng.

Cách hoạt động, theo `ARCHITECTURE.md` và `docs/how-it-works.md`:

- Pipeline: `detect → extract → build → cluster → analyze → report → export`.
- Code được parse cục bộ bằng tree-sitter, không gọi LLM. Tài liệu, PDF và ảnh thì đi qua LLM.
- Kết quả là `graphify-out/graph.json` (định dạng node-link của NetworkX), `GRAPH_REPORT.md` và `graph.html`.
- Mỗi cạnh mang nhãn `EXTRACTED`, `INFERRED` hoặc `AMBIGUOUS`.
- Truy vấn qua CLI (`graphify query/path/explain`) hoặc MCP server. Mặc định mỗi truy vấn trả subgraph khoảng 2.000 token (`serve.py:1963`).
- Lệnh `graphify claude install` ghi thêm một mục vào `CLAUDE.md` và cài hook `PreToolUse` trên `Bash|Grep` và `Read|Glob` để lái agent sang dùng graph (`install.py:345-350`). Với `--strict`, hook còn chặn lần đọc file thô đầu tiên của mỗi session.

## 2. Hình dạng repo vixio tại `1c59e98` [code]

| Mục | Số liệu |
|---|---|
| `apps/desktop/src/main.tsx` | 18.432 dòng |
| `apps/desktop/src/styles.css` | 8.245 dòng, 487 class selector |
| `apps/desktop/src-tauri/src/lib.rs` | 5.697 dòng |
| Tauri command | 28 hàm `#[tauri::command]`, 28 tên trong `generate_handler!` ([lib.rs:4446](../../apps/desktop/src-tauri/src/lib.rs:4446)), 26 tên gọi `invoke` bằng chuỗi literal trong [main.tsx:17563-17837](../../apps/desktop/src/main.tsx:17563) |
| File code được track (ts/tsx/js/rs/swift/py/css) | khoảng 100 file, khoảng 113k từ |

Dự án có ít file, nhưng code dồn vào 3 file khổng lồ. Trong `apps/desktop/src` còn 14 script `fix_*.py` / `rewrite_css.*` nằm cạnh source.

## 3. Đánh giá theo 5 tiêu chí

### Tiêu chí 1: cạnh xuyên ngôn ngữ dạng chuỗi (TS `invoke` → `generate_handler!` → Rust fn). graphify: **không**

- **[ngoài, code graphify]** `extract.py:2654-2690` định nghĩa `_LANG_FAMILY_BY_EXT`: `.ts/.tsx` thuộc họ `jsts`, `.rs` thuộc họ `rust`. Chú thích ghi thẳng: một lời gọi ở ngôn ngữ này *không bao giờ* được nối theo tên với định nghĩa ở họ ngôn ngữ khác. Test `tests/test_cross_language_call_resolution.py` khoá hành vi này lại. Đây là quyết định thiết kế nhằm chống cạnh ảo, không phải tính năng còn thiếu, nên đừng chờ họ bổ sung.
- **[ngoài, code graphify]** Rust extractor (`graphify/extractors/rust.py`) xử lý `function_item`, `impl_item`, `struct_item`, `use_declaration`, `call_expression`… nhưng không có `macro_invocation` hay `attribute_item`. Hệ quả:
  - Nội dung bên trong `generate_handler![...]` là token tree, không thành cạnh.
  - Không có cách biết hàm nào mang `#[tauri::command]`.
- **[ngoài, code graphify]** Chuỗi literal trong TS chỉ được đọc khi nó là đường dẫn `import()` động (`extractors/engine.py:1545-1570`). Tên command trong `invoke('...')` bị bỏ qua.
- **[suy luận]** Với chính nỗi đau đã gặp (memory ghi command `claude_code_status` không tồn tại), graph của graphify sẽ trả về một node `claude_code_status_native` ([lib.rs:2307](../../apps/desktop/src-tauri/src/lib.rs:2307)). Đó là hàm nội bộ, không phải command. Graph không phân biệt được hai loại này, nên agent có thể còn tự tin sai hơn khi dùng grep.
- **[ngoài]** Có đường mở rộng: `resolver_registry.py` (`LanguageResolver`), `graphify merge-graphs`, `scip_ingest.py`. Nhưng registry được đăng ký bên trong `extract.py`, tức là phải fork. `scip_ingest` ghi rõ "Not wired to the CLI". Muốn thêm cạnh Tauri thì vẫn phải tự viết extractor, nghĩa là vẫn làm graphify-lite rồi ghép vào graph của người khác.

### Tiêu chí 2: chống stale. graphify: **có cơ chế, nhưng hỏng đúng quy trình của repo**

- **[ngoài]** Rebuild tăng dần theo hash nội dung từng file (`cache.py`, `detect_incremental`). `graphify hook install` cài `post-commit` và `post-checkout` để rebuild AST chạy nền. Sau `git pull` hoặc `git merge` phải tự chạy `graphify update .` (README, mục "Recommended workflow").
- **[ngoài, code graphify]** `hooks.py:355-371` (`_WORKTREE_GUARD`): nếu `git-dir != git-common-dir`, tức đang ở linked worktree, hook **thoát luôn, không rebuild**. `graphify-out/` được coi là thuộc checkout chính.
- **[code vixio]** `CLAUDE.md` tại `1c59e98` quy định mỗi task một worktree, và tree chính chỉ dành cho Orchestrator.
- **[suy luận]** Hệ quả: graph chỉ được làm mới khi Orchestrator merge. Worker và Researcher trong worktree sẽ truy vấn graph của `main` chứ không phải branch của mình. Đúng lúc họ vừa sửa `main.tsx`, graph lệch đúng phần họ đang sửa. Muốn khắc phục thì mỗi thread phải tự chạy `graphify update .`, tạo ra một `graphify-out/` riêng cho từng worktree.
- **[suy luận]** Vì incremental tính theo file, gần như commit nào cũng chạm `main.tsx`, `styles.css` hoặc `lib.rs`, nên mỗi lần phải parse lại một file 18k dòng. Thời gian thật **chưa đo** vì không được chạy tool. Có thể là vài giây, nhưng chưa có số liệu.

### Tiêu chí 3: class CSS ↔ `className` JSX. graphify: **không**

- **[ngoài, code graphify]** `detect.py:44-49`: `.css` không có trong bất kỳ tập extension nào (code, doc, paper, image…). Chỉ `.css.map` xuất hiện, và nằm trong danh sách bỏ qua (`detect.py:906`). graphify không đọc `styles.css`.
- **[ngoài]** Không có extractor nào coi `className` là tham chiếu.

### Tiêu chí 4: giá trị thêm so với grep khi code dồn vào vài file lớn. **Thấp**

- **[ngoài]** Benchmark code duy nhất của graphify (`BENCHMARKS.md:142-146`) chạy trên ERPNext, khoảng 1 triệu dòng Python, mẫu n=6 câu hỏi. Độ phủ key-fact tăng từ 70,8% (grep + đọc) lên 82,0%, tốn khoảng **140K token mỗi truy vấn**. Mẫu nhỏ, repo lớn gấp khoảng 30 lần vixio, và đơn ngôn ngữ.
- **[ngoài]** `docs/how-it-works.md` tự thừa nhận corpus nhỏ thì graph gần như không giảm token ("~1x" với 6 file). Giá trị lúc đó là "structural clarity".
- **[suy luận]** Với vixio, các câu hỏi nội bộ TS như "hàm nào gọi X" grep đã trả lời được, vì mọi thứ nằm trong một file. Những câu grep trả lời *kém* đều là câu xuyên ngôn ngữ hoặc CSS, tức đúng phần graphify không làm.

### Tiêu chí 5: chi phí

- **Setup [ngoài]:** Python 3.10+, `uv tool install graphifyy`, rồi `graphify hook install` và `graphify claude install`.
- **Xung đột với luật repo [suy luận, dựa trên code của cả hai bên]:**
  - `graphify claude install` ghi vào `CLAUDE.md`. File này do Orchestrator giữ, và mọi thread đều nạp nó.
  - Hook `PreToolUse` đẩy agent ra khỏi `Grep`/`Read`. Điều này đi ngược luật Verify trong `CLAUDE.md`: "Tên nút, tên command… grep lại trước khi dùng" và "kiểm chứng trên commit SHA".
  - Graph không đóng dấu SHA theo từng truy vấn, nên không đáp ứng yêu cầu ghi SHA đã kiểm chứng.
- **Bảo trì [ngoài]:** Tốc độ phát hành vài bản mỗi ngày và hơn 1.300 issue mở, nghĩa là rủi ro hành vi thay đổi giữa các bản.
- **Riêng tư [ngoài]:** Mọi truy vấn được log vào `~/.cache/graphify-queries.log` (có thể tắt bằng `GRAPHIFY_QUERY_LOG_DISABLE=1`). Nếu không dùng `--code-only`, doc trong repo sẽ bị gửi cho LLM backend.
- **Token [ngoài + suy luận]:** Mỗi truy vấn khoảng 2.000 token (mặc định). Rẻ nếu chỉ hỏi vài câu, nhưng câu trả lời lại không chứa đúng loại cạnh ta cần.

## 4. Baseline graphify-lite: script thử nghiệm

**[code vixio]** Để đo độ khó thật, tôi viết một script Python dùng một lần, chỉ nằm trong scratchpad, không commit vào repo và không sửa code app. Script chạy trên `1c59e98` mất **0,18 giây**.

**(a) `invoke` ↔ `generate_handler!` ↔ `#[tauri::command]`:** chính xác, không có false positive.
- 28/28 tên handler có hàm command tương ứng. Không có `invoke` nào trỏ tới command chưa đăng ký.
- Hai handler `open_project_package` và `open_project_package_at` bị báo "không có invoke literal". Thực ra chúng được gọi qua biểu thức ba ngôi ([main.tsx:17567](../../apps/desktop/src/main.tsx:17567)). Bản thật phải đọc được literal trong nhánh điều kiện.

**(b) class CSS ↔ JSX:** được, nhưng cần làm cẩn thận.
- Lượt đầu tách chuỗi kiểu ngây thơ báo 66 class không dùng. Nguyên nhân sai là template literal lồng `${}` ([main.tsx:10477](../../apps/desktop/src/main.tsx:10477)) và tiền tố động như `slide-canvas--${layout}` ([main.tsx:11929](../../apps/desktop/src/main.tsx:11929)) hay `idea-status--${status}` ([main.tsx:10972](../../apps/desktop/src/main.tsx:10972)).
- Lượt hai lấy mọi token trong `main.tsx` và nhận diện tiền tố đứng trước `${`, còn **40 ứng viên**. Trong đó vẫn có class do thư viện bên thứ ba gắn lúc chạy: `react-colorful__*`, và `is-editor-empty` do TipTap gắn ([styles.css:3366](../../apps/desktop/src/styles.css:3366)).
- Kết luận: (b) chỉ nên sinh **danh sách ứng viên để người duyệt**, không tự khẳng định là CSS chết. Class thư viện nên nhận diện theo nguồn (tên package), không dùng danh sách cho phép viết tay, theo luật "đừng đưa giá trị đang audit vào danh sách cho phép".

**`var()` dùng nhưng chưa khai báo (không có fallback):**
- `--text-faint` được dùng 2 lần ([styles.css:5679](../../apps/desktop/src/styles.css:5679), [5776](../../apps/desktop/src/styles.css:5776)). Khớp với nỗi đau đã biết.
- **Phát hiện mới:** `--glass-strong` ([styles.css:2274](../../apps/desktop/src/styles.css:2274)) và `--glass-border-strong` ([styles.css:2272](../../apps/desktop/src/styles.css:2272)) trong `.mini-tags-popover` cũng chưa từng được khai báo, cả trong `apps/desktop/src` lẫn `index.html`. Nghĩa là nền và viền popover đang rơi về giá trị kế thừa hoặc giá trị ban đầu.

**(c) provider `type` ↔ nhánh Rust:** chưa dựng, mới khảo sát.
- Rust dispatch provider bằng so sánh chuỗi rải rác: `provider.provider_type == "codex"` / `"claude_code"` / `"ollama"`… ([lib.rs:2556-2712](../../apps/desktop/src-tauri/src/lib.rs:2556)), cộng một `match provider.provider_type.as_str()` ([lib.rs:2784](../../apps/desktop/src-tauri/src/lib.rs:2784)).
- Phía TS là `type AiProviderType` ([main.tsx:596](../../apps/desktop/src/main.tsx:596)).
- Cả hai phía đều là literal nên regex làm được. Kiểu so sánh `==` rải rác nghĩa là phải quét cả `if` lẫn `match`.

## 5. Kết luận

**Làm graphify-lite.** graphify là tool tốt cho repo lớn, nhiều file, đơn ngôn ngữ. Nhưng với KIRA, nó không chạm tới đúng các mối nối gây lỗi thật: chuỗi IPC Tauri, CSS và provider type. Hook của nó cũng mâu thuẫn với cả quy trình worktree lẫn luật "grep lại, ghi SHA".

**Điều kiện làm kết luận đổi:**

| Nếu… | thì đổi sang |
|---|---|
| `main.tsx` được tách thành hàng trăm module TS và câu hỏi chủ yếu là "ai gọi ai trong TS" | **cân nhắc dùng tool**, chỉ ở chế độ `--code-only`, không cài hook `claude install`, và thử trước trên một clone |
| graphify thêm resolver cho Tauri IPC hoặc extractor CSS, **và** bỏ `_WORKTREE_GUARD` hoặc hỗ trợ graph riêng cho từng worktree | **đánh giá lại tool** |
| Tập Tauri command đóng băng, CSS đã dọn xong, và 3 tháng không phát sinh lỗi loại này | **chưa cần làm gì**, giữ checklist grep trong `CLAUDE.md` là đủ |

## 6. Việc còn dở và giới hạn của báo cáo

- Chưa cài và chưa chạy graphify, theo đúng ràng buộc. Mọi nhận định về hành vi của nó dựa trên đọc source nhánh `v8` @ `fe66389083`, **chưa đo** thời gian build hay nội dung graph thật trên vixio.
- Script thử graphify-lite nằm ở scratchpad của session, không nằm trong repo. 40 ứng viên CSS chưa xác minh từng cái.
- `--glass-strong` và `--glass-border-strong` mới được xác minh ở mức source. Chưa kiểm tra popover hiển thị sai thế nào trong app thật.
- Nếu user muốn thử graphify thật: chạy `graphify extract apps --code-only` trên một clone tạm ngoài repo, không chạy `hook install` hay `claude install`. Đo thời gian build, rồi hỏi 3 câu kiểm chứng: "`claude_code_open_login_terminal` được gọi từ đâu", "`.mini-tags-popover` dùng ở đâu", "`codex` provider đi qua hàm Rust nào". Việc này cần user duyệt trước.

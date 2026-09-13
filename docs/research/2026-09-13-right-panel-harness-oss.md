# Phụ lục: OSS có thể tích hợp cho panel phải và harness nghiên cứu

- **Câu hỏi:** Thay vì tự viết từ backend đến frontend, những phương án OSS nào tích hợp được vào KIRA cho các khối trong [báo cáo chính](2026-09-13-right-panel-and-research-harness.md)?
- **Người yêu cầu:** User, trực tiếp tại thread Researcher (2026-09-13)
- **Commit đã kiểm chứng:** vixio `2422346` (branch `researcher/right-panel-harness`). License, số sao và ngày push lấy từ GitHub API và file `LICENSE` ngày 2026-09-13.
- **Kết luận ngắn:**
  1. Khoảng 70% khối có OSS dùng được. Bộ chính: **assistant-ui primitives** (chat UI không style), **Immer patches** (ChangeSet + hoàn tác), **jsdiff** (diff chữ), **xberg**, tên cũ Kreuzberg (trích PDF/Office bằng Rust), **Readability + Turndown** (trang web), **rmcp** (MCP server Rust), **material-color-utilities** (color expert).
  2. Nếu cần tool loop ở phase 2, **dùng Vercel AI SDK trong sidecar Bun sẵn có**, không tự viết loop. AI SDK có sẵn `toolApproval` và MCP client, nên KIRA dùng lại được MCP server tìm kiếm có sẵn (Brave, Exa) thay vì tự viết từng tích hợp.
  3. Loại mọi thứ bắt buộc Tailwind/shadcn/Next.js (AI Elements, Streamdown), Python/Docker (Open Notebook, GPT Researcher, docling, markitdown), license không tự do (tldraw, AGPL, thư mục `ee/`).
  4. Phần vẫn phải tự viết: mô hình thread/run/ChangeSet, tool thao tác canvas, loader skill (nhỏ), gọi REST API ảnh.

Nhãn nguồn như báo cáo chính: **[code]**, **[ngoài]**, **[ngoài-phụ]**, **[suy luận]**.

---

## 1. Tiêu chí lọc

| # | Tiêu chí | Lý do (từ repo) |
|---|---|---|
| 1 | License MIT / Apache-2.0 / BSD / ISC. Loại AGPL, license tự đặt, thư mục `ee/` trả phí | App đóng gói phân phối cho user |
| 2 | Chạy trong app Tauri macOS, **không cần Python, Docker hay server riêng** | Local-first, một bundle `.app` (PRODUCT.md) |
| 3 | **Không bắt Tailwind, shadcn hay Next.js** | Frontend là React + Vite + CSS thuần theo token trong `styles.css` và DESIGN.md [code: `apps/desktop/package.json` không có tailwind] |
| 4 | Còn bảo trì (push trong khoảng 3 tháng, không archived) | Tránh nợ bảo trì |
| 5 | Không phá ràng buộc đã chốt: secret nằm ở Rust/Keychain, CLI tự lo auth, không OAuth trong app | CLAUDE.md |

Dependency sẵn có nên dùng lại trước [code]: `zustand` + `zundo`, `@tiptap/*` + `tiptap-markdown`, `culori`, `react-rnd`, codex-helper (Bun, `@openai/codex-sdk`), `reqwest`, `rusqlite` (bundled).

Ký hiệu kết luận: **DÙNG** = khuyến nghị tích hợp · **CÂN NHẮC** = đáng làm spike, phụ thuộc quyết định · **THAM KHẢO** = học kiến trúc, không nhúng · **LOẠI**.

---

## 2. Theo từng khối

### 2.1 Chat UI (tab Chat, dock)

| Ứng viên | License · sao · push | Điểm chính | Kết luận |
|---|---|---|---|
| **assistant-ui** `assistant-ui/assistant-ui` | MIT · 12,1k · 2026-09-13 | Có lớp **primitives không style** (`ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive`) xử lý state, phím tắt, auto-scroll, streaming, tool call, và "leave every visual decision to you" [ngoài-phụ, trang Primitives]. **`ExternalStoreRuntime`** cho phép "keep messages in redux, zustand…" và gọi backend riêng, không cần Next.js [ngoài]. Tool UI hỗ trợ human-in-the-loop (`addResult`, `interrupt/resume`, `approval/respondToApproval`) [ngoài]. Adapter cho attachments, history, feedback, suggestions. Ví dụ Tool UI trong docs dùng Tailwind nhưng primitives thì không bắt buộc | **DÙNG** primitives + `ExternalStoreRuntime` trên zustand. Style bằng CSS token của KIRA. Không cài bộ component shadcn của nó |
| Vercel **AI Elements** | Apache-2.0 · 2,4k | Yêu cầu Next.js + AI SDK + **shadcn/ui** + **Tailwind CSS variables mode**; component được CLI chép vào project [ngoài] | **LOẠI** (vi phạm tiêu chí 3) |
| Vercel **Streamdown** | Apache-2.0 · 5,6k | Render markdown khi đang stream, Shiki, KaTeX, Mermaid, `rehype-harden`. **Bắt Tailwind** (`@source` trong `globals.css`) [ngoài] | **LOẠI**. Render câu trả lời bằng TipTap read-only và `tiptap-markdown` sẵn có để giống node |
| **CopilotKit** | MIT · 37,3k · 2026-09-13 | Framework co-agent (shared state, AG-UI). Nặng hơn nhu cầu; thường cần runtime backend [suy luận] | **LOẠI** cho MVP |
| run-llama **chat-ui** | MIT · 594 · push 2025-12-16 | Ít bảo trì | **LOẠI** (tiêu chí 4) |
| **react-resizable-panels** | MIT · 5,4k · 2026-09-06 | Kéo đổi độ rộng panel, có lưu layout | **CÂN NHẮC**. Nếu chỉ cần một cạnh kéo thì `react-rnd` đã có |

### 2.2 Changes: ChangeSet, diff, hoàn tác

| Ứng viên | License · sao · push | Điểm chính | Kết luận |
|---|---|---|---|
| **Immer** (`produceWithPatches`, `applyPatches`) | MIT · 29,0k · 2026-09-12 | Trả `[nextState, patches, inversePatches]`; patch dạng `{op, path, value}`; inverse patch dùng cho undo [ngoài]. Zustand thường dùng chung với Immer | **DÙNG**. Mỗi `AiChangeOp` áp dụng bằng `produceWithPatches` trên snapshot canvas. Lưu `inversePatches` trong item để "bỏ thay đổi đã nhận" chính xác. Việc so `before` để phát hiện `stale` cũng dựa trên path |
| **jsdiff** `kpdecker/jsdiff` | BSD-3 · 9,2k · 2026-08-24 | `diffWords` / `diffSentences` cho text | **DÙNG** cho diff nội dung idea (thêm xanh, bỏ gạch) |
| TipTap **Snapshot Compare** | Pro, registry npm riêng [ngoài] | Diff trực tiếp trong editor | **LOẠI** (không tự do, cần tài khoản Tiptap Pro) |
| `git-diff-view`, `react-diff-viewer-continued` | MIT | Hướng về diff code theo dòng | **LOẠI** (sai dạng nội dung) |
| **Yjs** `Y.UndoManager` | MIT · 22,8k | `trackedOrigins` cho phép **chỉ undo thay đổi từ một origin** (vd AI) mà giữ thay đổi của user; `captureTimeout`; `meta` trên stack item [ngoài] | **THAM KHẢO**. Đúng mô hình "undo riêng thay đổi AI", nhưng phải chuyển toàn bộ state canvas sang Yjs: refactor lớn, không đáng cho MVP. Xem lại nếu làm cộng tác thời gian thực |

### 2.3 LLM, tool loop, provider

| Ứng viên | License · sao · push | Điểm chính | Kết luận |
|---|---|---|---|
| **Vercel AI SDK** `vercel/ai` | Apache-2.0 · 26,7k · 2026-09-12 | Provider chính chủ: OpenAI, Anthropic, Google, Mistral…; OpenAI-compatible (có LM Studio); cộng đồng: Ollama, OpenRouter [ngoài]. Loop `stopWhen` (mặc định 20 bước). **`toolApproval`**: phát `tool-approval-request` và chờ `tool-approval-response` [ngoài]. MCP client `@ai-sdk/mcp` qua HTTP, SSE, stdio (stdio chỉ cho server local) [ngoài] | **CÂN NHẮC cho phase 2**. Chạy **trong sidecar Bun sẵn có** (mở rộng codex-helper thành helper AI chung). Rust truyền key qua stdin theo từng lượt, nên key không nằm trong webview. `toolApproval` map thẳng sang ChangeSet |
| AI SDK provider cộng đồng **Claude Code** (`ai-sdk-provider-claude-code`) | MIT | Dùng `@anthropic-ai/claude-agent-sdk`, xác thực bằng subscription qua CLI. **Không hỗ trợ custom tool của AI SDK**, chỉ tool có sẵn của Claude + MCP. Node 22+ [ngoài] | **LOẠI**. Đi qua Agent SDK nên dính vấn đề chính sách subscription đã nêu (báo cáo chính §B2). Giữ `claude -p` + `--mcp-config` |
| AI SDK provider cộng đồng **Codex CLI** (`ai-sdk-provider-codex-cli`) | MIT | `codexExec` hoặc `codexAppServer` (JSON-RPC, stream delta); auth bằng `codex login`; hỗ trợ `mcpServers` (stdio + HTTP có bearer); cấu hình `approvalMode` và `sandboxMode`. Node ≥22, ESM-only [ngoài] | **CÂN NHẮC**. Nếu helper chuyển sang AI SDK, provider này thay được đoạn `generate.ts` tự viết và thêm streaming + MCP. Cần kiểm chạy trong Bun compile |
| **genai** `jeremychone/rust-genai` | Apache-2.0 · 881 · 2026-09-11 | Rust, 26+ provider (OpenAI, Anthropic, Gemini, Ollama, OpenRouter…), tool calling, streaming, ảnh; v0.6 ổn định, v0.7 beta 09/2026 [ngoài] | **CÂN NHẮC**, thay cho AI SDK nếu muốn giữ loop trong Rust. Thay được phần `reqwest` viết tay cho từng provider trong `lib.rs`. Chưa kiểm hỗ trợ server tool (web search native) |
| **rig** `0xPlaygrounds/rig` | MIT · 8,6k · 2026-09-13 | Rust agent framework, 20+ provider, tool loop, `rig-rmcp`, vector store (có SQLite). v0.36, **cảnh báo sẽ có breaking change** [ngoài] | **LOẠI** cho MVP (nặng hơn nhu cầu, API chưa ổn). genai gọn hơn |
| `openai-agents-js`, **Mastra**, **LangGraph.js** | MIT / Apache + `ee/` / MIT | Framework agent đầy đủ (workflow suspend/resume, handoff) | **LOẠI** cho MVP. AI SDK đủ; Mastra có phần `ee/` license riêng [ngoài, file LICENSE.md] |

**Chọn một trong hai runtime** (quyết định mới D12): TS sidecar dùng AI SDK *hoặc* Rust dùng genai. Không làm cả hai. Khuyến nghị **AI SDK trong sidecar** [suy luận]:
- Hệ sinh thái MCP client, tool approval và provider rộng hơn.
- Đã có hạ tầng sidecar Bun.
- UI assistant-ui có adapter cho AI SDK.

Đổi lại, thêm một tiến trình và phụ thuộc Node API trong Bun (cần spike).

### 2.4 MCP (server của KIRA, client tới search server có sẵn)

| Ứng viên | License · sao | Điểm chính | Kết luận |
|---|---|---|---|
| **rmcp** `modelcontextprotocol/rust-sdk` | MIT → Apache-2.0 (đang chuyển) · 3,9k · 2026-09-12 | SDK Rust chính thức; server + client; transport stdio, **streamable HTTP server dạng Tower service (axum/hyper)**; macro `#[tool]`/`#[tool_router]` sinh JSON Schema; spec `2026-07-28` [ngoài] | **DÙNG cho phase 3**: MCP server chạy trong tiến trình Tauri, cổng riêng có bearer token, chỉ gồm `read_canvas` / `read_sources` / `propose_changes` |
| MCP **TypeScript SDK** | MIT → Apache-2.0 · 13,4k | Tương đương cho TS | Chỉ dùng nếu server đặt trong sidecar |
| **brave-search-mcp-server** | MIT | MCP server chính thức của Brave | **CÂN NHẮC** (phase 2): KIRA làm MCP client (qua AI SDK), user tự thêm key Brave. KIRA không viết client search |
| **exa-mcp-server** | MIT | MCP server của Exa | **CÂN NHẮC** như trên |
| tavily-mcp | Không đọc được file LICENSE | | Chưa đủ dữ liệu |

Hàm ý [suy luận]: với provider **không có** server tool web search (Ollama, LM Studio, OpenRouter tuỳ model), cách ít code nhất là **KIRA làm MCP client** tới server search có sẵn. Cách này cần tool loop, tức cần AI SDK ở 2.3. Đây là lý do duy nhất đáng kể để kéo loop vào phase 2.

### 2.5 Skill (`SKILL.md`)

| Ứng viên | License | Điểm chính | Kết luận |
|---|---|---|---|
| `agentskills/agentskills` (`skills-ref`) | Apache-2.0 · 25,3k | Spec + validator tham chiếu, viết bằng Python | **THAM KHẢO** (không nhúng Python). Viết lại luật validate (tên, độ dài, trùng thư mục) bằng `zod`, khoảng 50 dòng [suy luận] |
| `gray-matter` | MIT · push 2025-06-14 | Tách frontmatter | **LOẠI** (ít bảo trì). Dùng một parser YAML nhỏ + tách `---` |
| Skill mẫu thực tế | | xberg tự ship `skills/kreuzberg/SKILL.md` [ngoài]; user đã có skill `color-expert` trong môi trường Claude | **THAM KHẢO** nội dung; license skill của user cần kiểm trước khi đóng gói |

### 2.6 Ingest: folder, PDF, Office, trang web

| Ứng viên | License · sao · push | Điểm chính | Kết luận |
|---|---|---|---|
| **xberg** (tên cũ Kreuzberg) `xberg-io/xberg` | MIT · push gần đây | Lõi Rust; 106 định dạng / 140 phần mở rộng (PDF, Office, HTML, email, e-book…); **backend PDF thuần Rust (`pdf_oxide`), không cần PDFium hay LibreOffice**; có bảng/metadata/ảnh; có binding, CLI, REST, MCP [ngoài-phụ, trang tìm kiếm + README] | **DÙNG, sau spike**. Nhúng crate vào `src-tauri`, thay việc tự viết trích PDF/Office. Rủi ro: dòng v1 mới đổi tên, kích thước binary, thời gian build |
| **pdf.js** | Apache-2.0 · 53,9k | Trích text PDF trong webview | **CÂN NHẮC**, dự phòng nếu xberg quá nặng (chỉ PDF) |
| `lopdf` / `pdf-extract` / `pdfium-render` | MIT / (Cargo) / MIT-Apache | Mức thấp, hoặc cần binary PDFium | **LOẠI** (xberg đã bao) |
| `extractous` | Apache-2.0 · push 2024-12-21 | Ngừng hoạt động gần 2 năm | **LOẠI** |
| **@mozilla/readability** + **turndown** | Apache-2.0 · 11,4k / MIT · 11,4k | Rút nội dung chính của trang, chuyển HTML sang Markdown | **DÙNG** cho nguồn URL: Rust tải HTML → webview `DOMParser` + Readability → Turndown → lưu Source. Hoặc dùng bộ HTML của xberg nếu đủ tốt |
| markitdown, docling, trafilatura, crawl4ai | MIT / MIT / Apache / Apache | Chất lượng cao nhưng **Python** | **LOẠI** nhúng; **THAM KHẢO** |
| Jina Reader API | Apache-2.0 (mã) | Dịch vụ ngoài `r.jina.ai` | **LOẠI** mặc định (gửi URL ra ngoài; ngược local-first) |

### 2.7 Tìm lại trong nguồn (Sources, trích dẫn)

| Ứng viên | License | Điểm chính | Kết luận |
|---|---|---|---|
| **SQLite FTS5** | Public domain | Tìm toàn văn ngay trong `project.sqlite` | **DÙNG** cho MVP. Cần kiểm `rusqlite` bản `bundled` có bật FTS5 hay phải thêm feature [suy luận, chưa kiểm] |
| `sqlite-vec` | Apache/MIT · 8,1k · push 2026-05-18 | Vector search trong SQLite | **CÂN NHẮC** phase 3 (khi cần tìm theo nghĩa) |
| `fastembed-rs` / `transformers.js` | Apache-2.0 | Embedding local (tải model ONNX) | **CÂN NHẮC** phase 3; tăng dung lượng tải |
| **Orama** | Apache-2.0 · 10,5k | Search in-memory TS | **LOẠI** (FTS5 đủ và bền hơn) |

### 2.8 Nguồn ảnh

| Ứng viên | License · push | Kết luận |
|---|---|---|
| `unsplash-js` (chính chủ) | MIT · 2026-08-14 | **THAM KHẢO** kiểu dữ liệu; gọi REST từ Rust để key ở Keychain |
| `@openverse/api-client` | MIT | **THAM KHẢO**; gọi REST từ Rust |
| `pexels-javascript` | Không có file LICENSE · push 2024-06-18 | **LOẠI**; gọi REST trực tiếp |
| **SearXNG** (meta-search tự host) | AGPL-3.0 · 37k | **LOẠI** nhúng. Chỉ hỗ trợ nếu user tự chạy riêng và KIRA gọi như một URL |

OSS gần như không giảm được code ở khối này: mỗi API chỉ vài chục dòng `reqwest`, phần tốn công là **license, attribution và báo "0 kết quả"** (báo cáo chính §B4).

### 2.9 Color expert

| Ứng viên | License · sao · push | Điểm chính | Kết luận |
|---|---|---|---|
| **culori** (đã có) | MIT | OKLCH, `wcagContrast`, nội suy | **DÙNG** như hiện tại |
| **material-color-utilities** | Apache-2.0 · 2,3k · 2026-08-21 | Lượng tử hoá màu ảnh (Wu/Celebi), **score** chọn màu nguồn, không gian **HCT**, tonal palette, scheme | **DÙNG** cho phần tất định của skill: trích màu chủ đạo từ ảnh/frame, sinh thang tông có kiểm soát |
| `color-thief`, `node-vibrant` | MIT · 2026-08 / MIT (package) · 2026-01 | Trích palette ảnh | **LOẠI** nếu dùng material-color-utilities (trùng chức năng) |
| `colorjs.io` | MIT · 2,3k | Rất đầy đủ, có APCA | **LOẠI** (trùng culori) |
| `apca-w3` | License tự đặt "W3", "All Rights Reserved… Patent(s) pending" [ngoài, LICENSE.md] | | **LOẠI** (rủi ro license) |
| `chroma.js` | BSD | | **LOẠI** (trùng culori) |

### 2.10 Ứng dụng tham khảo, không nhúng

| Dự án | License · stack | Học được gì | Vì sao không nhúng |
|---|---|---|---|
| **Open Notebook** `lfnovo/open-notebook` | MIT · 38,7k · Next.js + FastAPI + SurrealDB + LangChain; Docker [ngoài] | Mô hình Sources / Notes / chat có trích dẫn / "transformations" (thao tác AI tuỳ biến trên nguồn), gần skill của KIRA | Python + Docker |
| **GPT Researcher** | Apache-2.0 · 29,4k · Python | Pipeline planner → nhiều researcher song song → publisher có trích dẫn | Python |
| `open_deep_research` (LangChain) | MIT · **archived** | Tham khảo cấu trúc prompt deep research | Archived |
| **tldraw** agent starter kit | **tldraw license** (không OSS tự do) [ngoài, LICENSE.md] | Action schema + context canvas (báo cáo chính §A1) | License; KIRA có canvas riêng |
| AFFiNE | MIT + phần `packages/backend` license riêng | AI trên whiteboard + doc | Nặng, license hỗn hợp |
| SurfSense, Khoj | Apache + thư mục proprietary / AGPL-3.0 | NotebookLM tự host | License, Python |

---

## 3. Kiến trúc lai dựng từ OSS

```
Webview (React)
  ├─ KiraPanel            ← assistant-ui primitives + ExternalStoreRuntime (zustand)
  │    ├─ Chat            ← render bằng TipTap read-only (sẵn có)
  │    └─ Changes         ← Immer patches (apply/inverse) + jsdiff
  ├─ Readability + Turndown (nguồn URL)
  └─ material-color-utilities + culori (color expert)

Tauri Rust
  ├─ Keychain secrets (sẵn có)
  ├─ xberg (trích PDF/Office/HTML) → project.sqlite (FTS5)
  ├─ REST ảnh: Openverse / Unsplash / Pexels (reqwest)
  └─ [phase 3] rmcp: MCP server localhost + token (read_canvas, read_sources, propose_changes)

Sidecar Bun (mở rộng codex-helper)          [phase 2]
  ├─ AI SDK: provider BYOK + toolApproval + stopWhen
  ├─ @ai-sdk/mcp → brave-search-mcp / exa-mcp (tuỳ chọn, key của user)
  └─ ai-sdk-provider-codex-cli (thay generate.ts tự viết, nếu spike đạt)

Claude Code CLI: giữ claude -p; phase 3 thêm --mcp-config trỏ vào rmcp server + --strict-mcp-config
```

**Thay đổi so với báo cáo chính:**

| Mục | Báo cáo chính | Sau khi xét OSS |
|---|---|---|
| A MVP | Tự viết panel + ChangeSet, khoảng 900–1.300 dòng module mới | assistant-ui + Immer + jsdiff; ước **khoảng 600–900 dòng** [suy luận] |
| B phase 2 loop | Chưa cần loop; web search chỉ bằng server tool native | Vẫn không *tự viết* loop. Nếu cần web search cho provider không có server tool thì **AI SDK trong sidecar + MCP search server có sẵn** |
| Ingest | Tự viết trích PDF bằng crate Rust hoặc Swift PDFKit, khoảng 400–800 dòng | **xberg** + Readability/Turndown; phần tự viết còn lưu Source và chunk |
| MCP server | "MCP server Rust" chung chung | **rmcp**, Tower service trong tiến trình app |
| Color expert | culori + công thức sẵn có | + **material-color-utilities** (quantize, score, HCT) |

## 4. Rủi ro khi dựa vào OSS

| Rủi ro | Khối | Giảm thiểu |
|---|---|---|
| Tốc độ đổi API (AI SDK lên v6 nhanh; rig báo breaking change) | 2.3 | Khoá version; bọc sau interface `AiRuntime` riêng của KIRA |
| AI SDK / provider cộng đồng yêu cầu Node 22 (API Node), sidecar lại compile bằng Bun | 2.3 | Spike trước khi quyết; nếu không chạy, chọn genai (Rust) |
| xberg vừa đổi tên sang dòng v1 | 2.6 | Spike đo binary size, build time, chất lượng trên 5 PDF thật; dự phòng pdf.js |
| MCP SDK đang chuyển license MIT → Apache-2.0 | 2.4 | Cả hai đều tương thích phân phối; ghi NOTICE |
| assistant-ui kéo nhiều dependency hoặc giả định Tailwind ở chỗ không lường trước | 2.1 | Spike chỉ dùng primitives, đo bundle size; nếu nặng, tự viết list tin nhắn (phần dễ nhất) và giữ Immer/jsdiff |
| Server MCP bên thứ ba chạy như tiến trình con có quyền mạng | 2.4 | Chỉ bật khi user thêm; hiển thị tool list; tool ghi canvas chỉ tồn tại ở server KIRA |

## 5. Quyết định bổ sung cho user (nối tiếp §D báo cáo chính)

11. **Chat UI:** (a) assistant-ui primitives *(khuyến nghị, sau spike)* · (b) tự viết
12. **Runtime khi cần loop:** (a) AI SDK trong sidecar Bun *(khuyến nghị)* · (b) genai trong Rust · (c) chưa cần, giữ one-shot
13. **Ingest tài liệu:** (a) xberg *(khuyến nghị, sau spike)* · (b) pdf.js chỉ PDF · (c) Swift PDFKit
14. **Web search cho provider không có server tool:** (a) cho KIRA làm MCP client tới Brave/Exa MCP, key của user · (b) báo "không hỗ trợ" (như khuyến nghị cũ §D9)

## 6. Spike đề xuất (cần duyệt, mỗi cái nửa ngày đến 1 ngày, nhánh riêng, không merge)

1. **assistant-ui primitives + ExternalStoreRuntime** dựng tab Chat giả trên zustand, style bằng token KIRA. Đo bundle delta, kiểm không kéo Tailwind.
2. **xberg** trong `src-tauri`: trích 5 PDF và 2 DOCX thật. Đo binary delta, build time, chất lượng text.
3. **AI SDK trong sidecar Bun compile**: gọi Anthropic + OpenAI BYOK với 1 tool có `toolApproval`, 1 MCP client stdio. Xác nhận chạy được trong binary Bun.
4. **Immer patches** trên `CanvasHistoryEntry`: áp dụng rồi đảo 3 loại op, kiểm tương tác với `pushCanvasHistory` / zundo.

## 7. Giới hạn

- Không cài, không chạy thử package nào. Nhận định năng lực dựa trên docs và README (một số đọc qua tóm tắt tự động).
- Số sao và ngày push chụp ngày 2026-09-13 qua GitHub API. Một số license `NOASSERTION` đã đọc trực tiếp file `LICENSE`. Riêng `tavily-mcp` không đọc được.
- Nhận định về xberg lấy từ kết quả tìm kiếm + README, chưa đọc mã.

## Cập nhật 2026-09-14

D11 đã chốt: **dùng assistant-ui**. Phần chất lượng thiết kế (skill, OSS design system, liquid glass) tách sang [2026-09-14-design-quality-skills-oss.md](2026-09-14-design-quality-skills-oss.md).

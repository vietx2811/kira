# Nghiên cứu: dùng harness agent mã nguồn mở làm lõi tác vụ nghiên cứu của KIRA?

- **Câu hỏi (user, qua Orchestrator):** "Có dùng harness opensource được không?" Tức là thay vì tự dựng "pipeline one-shot có checkpoint" ([báo cáo chính](2026-09-13-right-panel-and-research-harness.md) §B), có harness agent OSS nào nhúng được vào KIRA làm lõi không.
- **Người yêu cầu:** User, giao qua Orchestrator (2026-09-14)
- **Commit đã kiểm chứng:** vixio `dfc7250` (branch `researcher/oss-harness`). Metadata GitHub và tài liệu ngoài truy cập 2026-09-14.
- **Đã chốt trước đó (không bàn lại):** panel phải làm trước hàng rào chất lượng; D1-D4 theo khuyến nghị; D11 assistant-ui; D2/D3 = node AI mới áp dụng ngay, sửa/xoá node có sẵn luôn chờ duyệt.
- **Kết luận ngắn:**
  1. **Có, dùng được OSS, nhưng lõi nên là thư viện vòng lặp Vercel AI SDK (Apache-2.0) chạy trong sidecar Bun sẵn có, không nhúng một coding agent hoàn chỉnh** (opencode, Goose, Codex) làm lõi.
  2. **Lý do quyết định:** các coding agent mặc định mang tool đọc/ghi file, chạy shell, tải web; mỗi con tự quản đăng nhập riêng; nạp cấu hình từ `~/.claude` hoặc thư mục home; lưu phiên ngoài gói `.kira`; và ra bản mới hằng tuần. Với KIRA, **toàn bộ tool là của KIRA và tool ghi chỉ tạo đề xuất**, nên phần giá trị nhất của một harness (sandbox, quyền shell/file) gần như không dùng tới, còn phần phải gỡ bỏ thì nhiều.
  3. **Giữ pipeline one-shot cho MVP** (và mãi mãi cho Apple Foundation và đường CLI one-shot). Vòng lặp AI SDK vào ở phase 2 cho provider có tool calling.
  4. **Claude Agent SDK không phải OSS** (dùng theo Anthropic Commercial Terms) và **cấm app bên thứ ba dùng đăng nhập claude.ai**; mọi adapter đi qua nó với subscription (claude-agent-acp, provider Claude Code của AI SDK, provider `claude-acp` của Goose) đều bị loại. Với người dùng Claude Code: giữ `claude -p`, phase 3 thêm `--mcp-config` trỏ vào MCP server của KIRA.
  5. **Phương án thay thế nếu user muốn tái dùng tối đa:** `opencode serve` dò từ bản user tự cài (giống cách KIRA đang làm với codex), cấu hình cô lập, chặn mọi tool có sẵn. Cần spike 2 trước khi cân nhắc.

Nhãn nguồn: **[code]**, **[ngoài]** (tài liệu chính chủ), **[ngoài-phụ]** (blog, tổng hợp, DeepWiki), **[suy luận]**.

---

## 0. Hiện trạng [code] tại `dfc7250`

| Mục | Sự thật |
|---|---|
| Harness OSS đã nhúng | `apps/codex-helper`: `@openai/codex-sdk` 0.142.0, compile bằng `bun build --compile` thành `kira-codex-helper-aarch64-apple-darwin` khai báo trong `externalBin` của `tauri.conf.json` |
| Kích thước sidecar | File binary hiện tại trong tree chính: **61.085.728 byte (khoảng 61 MB)**, gần như toàn bộ là runtime Bun. Thêm thư viện JS vào sidecar này tốn thêm rất ít so với một tiến trình mới |
| Codex không được đóng gói | `scripts/build.ts` ghi rõ không vendor CLI `codex` ("~240MB native binary"); `codexPath.ts` dò `KIRA_CODEX_BIN` → `<CODEX_HOME>/bin/codex` → PATH. **Tiền lệ "dò bản user đã cài" dùng lại được cho harness khác** |
| Cách gọi Codex | `startThread({ sandboxMode: "read-only", approvalPolicy: "never", networkAccessEnabled: false, workingDirectory: tmpdir() })` rồi `thread.run` một lượt ([generate.ts](../../apps/codex-helper/src/generate.ts)) |
| Cách gọi Claude Code | `claude -p … --output-format json` từ Rust ([lib.rs:2373](../../apps/desktop/src-tauri/src/lib.rs:2373)) |

---

## 1. Chính sách Claude, xác minh lại

- **[ngoài]** Tài liệu [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview), nguyên văn: *"Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead."*
- **[ngoài]** License: *"Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service, including when you use it to power products and services that you make available to your own customers and end users"*. File `LICENSE.md` của `anthropics/claude-agent-sdk-typescript`: *"© Anthropic PBC. All rights reserved."* → **không phải OSS**.
- **[ngoài]** Cùng trang: *"To drive the same agent loop from another language, run the CLI as a subprocess with the `-p` flag and `--output-format json`."* Đây đúng là cách KIRA đang gọi.
- **[ngoài]** [Help center](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan), cập nhật mới nhất 2026-06-15, vẫn **đang tạm dừng**: *"Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription's usage limits."* Báo cáo trước ghi "tạm dừng" là đúng; không có thay đổi sau 06/2026 trên trang này.
- **[ngoài-phụ]** Theo nhiều bài tổng hợp: từ 2026-01-09 Anthropic chặn phía server token OAuth dùng ngoài Claude Code; 2026-02-19 cập nhật điều khoản cấm dùng token Free/Pro/Max với tool bên thứ ba và Agent SDK; 2026-03-19 opencode gỡ plugin đăng nhập Claude "per legal requests" (PR #18186).

**Hệ quả [suy luận]:** việc dùng subscription Claude trong KIRA chỉ nên tiếp tục bằng **CLI chính chủ do user tự cài và tự đăng nhập**, như hiện tại. Mọi harness hoặc adapter nào dùng thay subscription đó (qua Agent SDK hay OAuth riêng) đều loại. Ràng buộc này độc lập với việc chọn harness nào.

---

## 2. Tiêu chí dẫn tới lựa chọn

Một điểm thiết kế đã chốt làm thay đổi cách chấm tiêu chí 4 (hook duyệt):

> Tool ghi của KIRA **không sửa canvas**, nó chỉ tạo `AiChangeSet` chờ duyệt (báo cáo chính §A4). Vì vậy harness **không cần chặn tool ghi của KIRA**. Harness chỉ cần **chặn được hoặc không có** tool có sẵn của nó (đọc/ghi file, shell, fetch).

Do đó khác biệt thật giữa các ứng viên nằm ở: phủ provider; không đụng token; nhúng nhẹ; **cô lập được** khỏi file và cấu hình của user; tốc độ đổi API.

---

## 3. Bảng so sánh

| Ứng viên | 1. License | 2. Provider (A/O/G BYOK · Ollama/LMS · tái dùng đăng nhập CLI) | 3. Nhúng | 4. Chặn tool có sẵn / duyệt | 5. MCP · Skill | 6. Sandbox, cô lập | 7. Bảo trì |
|---|---|---|---|---|---|---|---|
| **Vercel AI SDK** (agent loop) | Apache-2.0 [ngoài, LICENSE] | A, O, G chính chủ; LM Studio qua OpenAI-compatible; Ollama, OpenRouter cộng đồng [ngoài]. Tái dùng Codex login: provider cộng đồng `ai-sdk-provider-codex-cli` (Node ≥22) [ngoài]. Claude Code: provider cộng đồng đi qua Agent SDK → **loại** | Thư viện, chạy **trong sidecar Bun 61 MB sẵn có** [code] | **Không có tool có sẵn**: chỉ có tool KIRA khai báo. `toolApproval` phát `tool-approval-request` nếu cần [ngoài] | MCP client `@ai-sdk/mcp` (HTTP/SSE/stdio) [ngoài] · **không có skill loader** (KIRA tự viết, nhỏ) | Không có sandbox, nhưng không cần: bề mặt tool do KIRA quyết | push 2026-09-12; API đổi theo major (v5→v6) [suy luận] |
| **Codex** (SDK, app-server) | Apache-2.0 [ngoài, GitHub] | OpenAI (ChatGPT login hoặc key); provider có sẵn `ollama`, `lmstudio`; provider khác phải nói **Responses API** [ngoài-phụ] → **không có Anthropic/Gemini native** | **Đã nhúng** (sidecar + codex của user) [code] | app-server gửi `commandExecution` / `fileChange` requestApproval (accept/decline/cancel) [ngoài]; **dynamic tools do client thực thi** nhưng *"experimental field (requires `capabilities.experimentalApi = true`)"* [ngoài] | `[mcp_servers]` với `enabled_tools`, approval mode [ngoài] · `skills/list`, gọi `$skill` [ngoài] | Sandbox `read-only`/`workspace-write`, cờ network [code, ngoài] | `rust-v0.155.0-alpha` 4 bản trong ngày 2026-09-11 |
| **opencode** (`opencode serve`) | MIT [ngoài, GitHub] | 75+ provider qua AI SDK/models.dev; Anthropic chỉ còn API key (docs: *"Anthropic explicitly prohibits this"* với Pro/Max) [ngoài]; ChatGPT Plus/Pro là **OAuth riêng của opencode**, không dùng lại login Codex CLI [ngoài]; key lưu `~/.local/share/opencode/auth.json` [ngoài] | Tiến trình riêng: HTTP server, OpenAPI `/doc`, SSE `/event`, basic auth, SDK `@opencode-ai/sdk` [ngoài]. Binary riêng hoặc dò bản user cài [suy luận] | Quyền `allow/ask/deny` cho `read, edit, glob, grep, bash, task, skill, lsp, webfetch, websearch, external_directory…`; reply qua `/session/:id/permissions/:permissionID`; plugin `tool.execute.before` ném lỗi để chặn [ngoài] | MCP client · **SKILL.md có**, và **tự nạp `.claude/skills` và `~/.claude/skills`** [ngoài-phụ] | Không sandbox OS [suy luận]. Cô lập bằng `OPENCODE_CONFIG_CONTENT`, `OPENCODE_DISABLE_CLAUDE_CODE*`; **issue #10383: biến tắt không chặn được plugin** [ngoài-phụ] | v1.18.27 → v1.18.30 trong 7 ngày (09-02 → 09-09) |
| **Goose** (`goosed` / crate Rust) | Apache-2.0 [ngoài, GitHub] | Nhiều provider; Claude/Codex qua provider **ACP `claude-acp`, `codex-acp`**; provider CLI cũ đã deprecated [ngoài-phụ] → `claude-acp` dựa Agent SDK → **loại cho subscription** | `goosed` REST + SSE (app Electron của họ dùng), hoặc crate `goose` (kéo theo OAuth, telemetry, security…) [ngoài-phụ] | Mode Manual / Smart approve + quyền theo tool; **SmartApprove dùng LLM phán đoán an toàn** [ngoài-phụ] (không muốn cho KIRA) | MCP là nền tảng extension · recipes (chưa kiểm hỗ trợ SKILL.md) | Dựa vào quyền; issue đề xuất chuyển `goosed` sang ACP-over-HTTP → API server còn đổi [ngoài-phụ] | v1.47 → v1.50 trong 18 ngày |
| **OpenAI Agents SDK (JS)** | MIT | OpenAI native; provider khác qua adapter AI SDK [ngoài] | Thư viện Node | `needsApproval` + interruption + **`RunState` serialize/resume** [ngoài], hợp khi duyệt kéo dài | MCP (chưa kiểm lại phiên này) · không skill | Không sandbox | v0.17.0 → v0.18.0 trong 3 tuần |
| **Mastra** | Apache-2.0 + thư mục `ee/` license riêng [ngoài, LICENSE.md] | Qua AI SDK | Framework Node, nặng [suy luận] | `requireApproval`, `suspend/resume` [ngoài]; bug: duyệt trong sub-agent nền làm chạy lại từ đầu (#23626) [ngoài-phụ] | MCP · không SKILL.md (chưa kiểm) | Không sandbox | `@mastra/core` 1.63 → 1.66 trong 2 tuần |
| **LangGraph.js** | MIT | Qua LangChain | Framework, checkpointer | `interrupt` | — | — | push 2026-09-12. **Chỉ xét metadata**, loại nhanh vì nặng và không thêm gì so với AI SDK [suy luận] |
| **pi** (earendil-works) | MIT · 104,7k sao | A, O, G, Ollama, LM Studio, OpenRouter [ngoài] | Node/Bun | README: *"deliberately avoids built-in permission restrictions"*, khuyên chạy trong container [ngoài] → **không đạt tiêu chí 4** | — | Không | v0.84.3 → v0.85.1 trong 12 ngày |
| **Claude Agent SDK** | **Độc quyền**, Commercial Terms [ngoài] | Anthropic API key (Bedrock/Vertex); **cấm claude.ai login cho sản phẩm bên thứ ba** [ngoài] | Thư viện TS/Python | Hooks, permissions đầy đủ [ngoài] | MCP · skills tự nạp từ `.claude/` và `~/.claude/` [ngoài] | Tool file/shell của Claude Code | v0.3.267 → v0.3.270 trong 4 ngày |
| **ACP** (giao thức, không phải harness) | Apache-2.0 · v1.7.0 2026-08-20 | Tuỳ agent; `codex-acp` đã **archived** 2026-07-22 [ngoài, GitHub]; `claude-agent-acp` dựa Agent SDK | KIRA làm ACP client, agent là tiến trình con (JSON-RPC stdio) | Client nhận `session/request_permission`, tự thực thi `fs/write_text_file` [ngoài] | Truyền `mcpServers` khi `session/new` | Tuỳ agent | Registry cập nhật hằng ngày |

---

## 4. Khuyến nghị

### Hướng: "Pipeline one-shot trước, vòng lặp AI SDK ở phase 2, CLI giữ đường riêng"

| Lớp | Dùng gì | Provider |
|---|---|---|
| **MVP** (color-expert, folder-brief) | Pipeline one-shot có checkpoint như báo cáo chính §C | **Mọi provider** |
| **Phase 2: vòng lặp** | **Vercel AI SDK** trong sidecar Bun (mở rộng `codex-helper` thành helper AI chung). Tool = đọc canvas + đọc nguồn + `propose_changes` + (tuỳ chọn) MCP search của user | Anthropic, OpenAI, Gemini, OpenRouter BYOK; Ollama, LM Studio với model có tool calling |
| **Codex** | Giữ SDK one-shot hiện tại. Chuyển sang app-server + dynamic tools **khi `dynamicTools` hết experimental** | Người có ChatGPT login |
| **Claude Code** | Giữ `claude -p`. Phase 3: `--mcp-config` trỏ vào MCP server KIRA (rmcp) + `--strict-mcp-config` + khoá `--tools` | Người có Claude subscription |
| **Apple Foundation** | One-shot mãi mãi (không harness nào ở trên hỗ trợ; context 8K) | Local |

### Vì sao không nhúng một coding agent hoàn chỉnh làm lõi

1. **Không phủ đủ provider:** Codex thiếu Anthropic/Gemini native; opencode và Goose phủ rộng nhưng không dùng lại được login Codex/Claude CLI mà không đụng token hoặc tự làm OAuth (user đã từ chối OAuth trong app).
2. **Phải gỡ nhiều hơn dùng:** opencode có 13 nhóm quyền tool có sẵn phải `deny`, tự nạp `.claude/skills` và `~/.claude/CLAUDE.md`, và biến tắt tương thích Claude Code **không chặn được plugin** (issue #10383). Mỗi bản mới có thể thêm tool mới mà KIRA phải theo dõi [suy luận].
3. **Dữ liệu ra ngoài gói `.kira`:** opencode lưu key ở `~/.local/share/opencode/auth.json` và phiên trong thư mục của nó [ngoài + suy luận], ngược mô hình local-first "một project = một gói".
4. **Nhịp đổi quá nhanh để làm lõi:** opencode 4 bản/tuần, Goose 1 minor/tuần, Codex nhiều alpha/ngày. Harness là thứ KIRA gọi vào sâu nhất nên chịu tác động nặng nhất.
5. **Phần giá trị nhất của harness là sandbox cho shell/file, mà KIRA không cho agent dùng shell/file.** Cái KIRA cần là vòng lặp tool + duyệt + MCP client, và AI SDK cho đúng chừng đó.

### Cái giá phải trả

| Phải tự viết | Cỡ [suy luận] | Ghi chú |
|---|---|---|
| Nạp `SKILL.md` (tìm, parse frontmatter, validate, nạp dần) | khoảng 100–150 dòng | Theo spec agentskills.io; không chạy `scripts/` |
| Lưu phiên và nén ngữ cảnh | Dùng `AiThread/AiMessage/AiRun` đã thiết kế; nén đơn giản (tóm tắt lượt cũ) | opencode/Goose có sẵn phần này |
| Định nghĩa tool KIRA + cầu nối sidecar ↔ Rust ↔ webview | khoảng 300–500 dòng | Key truyền qua stdin theo lượt, không lộ ra webview |
| Theo dõi major version AI SDK | Liên tục | Khoá version, bọc sau interface `AiRuntime` |

Đổi lại: không thêm tiến trình, không thêm binary lớn, không có tool shell/file tồn tại ở bất kỳ đâu trong đường nghiên cứu, không có cấu hình user nào bị nạp ngầm.

---

## 5. Spike xác nhận (nửa ngày mỗi cái, nhánh riêng, không merge, cần duyệt vì phải cài package)

**Spike 1: AI SDK trong sidecar Bun compile** (xác nhận hướng khuyến nghị)
- `ToolLoopAgent` gọi Anthropic BYOK và Ollama local, với 2 tool giả `read_canvas` và `propose_changes` (tool thứ hai bật `toolApproval` để kiểm luồng duyệt), cộng 1 MCP client stdio.
- **Đạt nếu:** chạy được trong binary `bun build --compile`; binary tăng dưới 10 MB so với 61 MB hiện tại; key chỉ đi qua stdin; không có tool nào khác ngoài 2 tool khai báo.
- **Trượt nếu:** `@ai-sdk/mcp` stdio hoặc provider cần API Node mà Bun compile không có. Khi đó xét genai (Rust) cho vòng lặp.

**Spike 2: opencode serve cô lập** (chỉ làm nếu user nghiêng về tái dùng tối đa)
- Chạy `opencode serve` từ bản cài riêng, `OPENCODE_CONFIG_CONTENT` deny toàn bộ tool có sẵn, `OPENCODE_DISABLE_CLAUDE_CODE=1`, cwd là thư mục tạm rỗng, key qua `{env:…}`, tool KIRA qua MCP.
- Gửi một prompt cố tình đòi đọc `~/.ssh`, chạy `bash`, `webfetch`.
- **Đạt nếu:** mọi yêu cầu đều bị từ chối; không nạp skill hay rule nào từ `~/.claude`; không ghi file ngoài thư mục tạm (trừ dữ liệu của chính opencode); đo thời gian khởi động và RAM.

---

## 6. Danh sách quyết định harness cập nhật (thay D5-D10, D12-D14)

| # | Quyết định | Lựa chọn | Khuyến nghị |
|---|---|---|---|
| **H1** | Lõi vòng lặp | (a) Vercel AI SDK trong sidecar Bun · (b) opencode serve dò bản user cài · (c) chưa có vòng lặp | **(a)**, sau spike 1 |
| **H2** | Thời điểm | (a) MVP one-shot trước, vòng lặp phase 2 · (b) vòng lặp ngay MVP B | **(a)** |
| **H3** | Provider có vòng lặp | (a) chỉ provider có tool calling (A/O/G/OpenRouter BYOK, Ollama/LMS model hỗ trợ tool); Apple FM và CLI one-shot · (b) ép mọi provider qua cùng vòng lặp | **(a)** |
| **H4** | Codex | (a) giữ SDK one-shot, chuyển app-server khi dynamic tools ổn định · (b) chuyển app-server ngay (API experimental) | **(a)** |
| **H5** | Claude Code | (a) giữ `claude -p`, phase 3 thêm MCP KIRA + khoá tool | **(a)**. *Ràng buộc, không phải lựa chọn:* không dùng Agent SDK, ACP adapter hay OAuth nào với subscription Claude |
| **H6** | Skill (thay D6, D7) | (a) SKILL.md, KIRA tự nạp, không chạy `scripts/`, chỉ thư mục KIRA · (b) thêm `~/.claude/skills` | **(a)** |
| **H7** | Web search (thay D9, D14) | (a) server tool native của provider trong vòng lặp + tuỳ chọn MCP Brave/Exa bằng key của user · (b) chỉ native, provider khác báo "không hỗ trợ" | **(a)** |
| **H8** | Nguồn ảnh (D8, giữ nguyên) | (a) Openverse trước · (b) Unsplash/Pexels BYOK | **(a)** |
| **H9** | ACP | (a) chưa làm, xem lại phase 3 · (b) làm KIRA thành ACP client ngay | **(a)**: `codex-acp` đã archived, adapter Claude dính Agent SDK |
| — | D5 (harness), D12 (runtime vòng lặp), D13 (ingest) | D5, D12 được thay bởi H1–H3. **D13 giữ nguyên** (xberg, sau spike) | |
| — | D10 (thêm "Research" vào PRODUCT.md) | Không thuộc harness | Vẫn chờ user |

## 7. Giới hạn

- Không cài, không chạy package nào. Khả năng của từng ứng viên dựa trên tài liệu và README; nhiều mục opencode, Goose, Codex app-server lấy qua bản tóm tắt tự động hoặc nguồn phụ, đã gắn nhãn.
- Chưa đo kích thước binary `opencode` và `goosed`. Chưa kiểm hỗ trợ SKILL.md của Goose, MCP của OpenAI Agents JS.
- Nhịp phát hành tính từ 8 release gần nhất trên GitHub API, ngày 2026-09-14.
- Nhận định "coding agent phải gỡ nhiều hơn dùng" là suy luận từ tài liệu quyền và cấu hình; spike 2 là cách kiểm.

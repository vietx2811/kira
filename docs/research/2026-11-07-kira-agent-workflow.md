# Kira làm trung tâm mindmap/brainstorm: nghiệp vụ agent, conversation, context/memory, kết nối AI ngoài, OSS

- **Câu hỏi:** user muốn Kira, AI trong KIRA, là giao diện tốt nhất cho mindmapping, brainstorming, hệ thống hoá ý tưởng. Orchestrator đang tự làm UI gộp nút Kira + panel (orb góc phải: click hỏi nhanh, Expand mở panel đầy đủ). Báo cáo này trả lời: (1) nghiệp vụ agent cần luồng nào, cơ chế tool-call có preview/undo; (2) mô hình conversation theo project/node; (3) context và memory mỗi lượt, nén, dài hạn; (4) cách đơn giản nhất đưa context từ Claude/ChatGPT/Codex sang KIRA, đánh giá kỹ phương án MCP; (5) OSS nên dùng cho chat UI, memory, MCP SDK.
- **Người yêu cầu:** Orchestrator, chuyển từ user (2026-11-07).
- **Commit đã kiểm chứng:** vixio `5dd1596` (branch `researcher/kira-agent-layout`). Nguồn ngoài truy cập 2026-11-07.
- **Kết luận ngắn:**
  1. **Hiện Kira có hai đường tách rời nhau, và đây là lỗ hổng lớn nhất:** chat thuần hỏi-đáp (không tạo node) và "hành động trên node" (luôn tạo đúng **một** node, kể cả khi hành động là "Break down" — tức là "chia nhỏ" chỉ tạo một node chứa văn bản liệt kê, không tách thành các node con thật trên canvas). Không có cơ chế nào tạo **nhiều** node/cạnh cùng lúc như một đơn vị có duyệt/huỷ, trong khi đây chính là việc một app mindmap AI cần làm nhất: mở rộng nhánh, gom cụm.
  2. **KIRA đã có sẵn đúng nền móng cần thiết**: `AiChangeSet`/`AiChangeItem` (tạo/sửa/xoá, có provenance, có "Cần bạn" để duyệt) là một preview-and-undo layer thật, không phải đồ chơi. Khuyến nghị: **mở rộng union `AiChangeItem` thêm `create-nodes-batch` (nhiều node + cạnh, duyệt hoặc huỷ như một khối) và `relayout`**, thay vì xây một cơ chế mới song song.
  3. **Lỗ hổng nghiêm trọng thứ hai, chưa ai gắn cờ:** luồng "vẽ cả bảng từ một câu lệnh" ở màn hình trống (`draftBoardFromPrompt` → `createBoardDraftSnapshot`) **bỏ qua hoàn toàn** `AiPanelState` (không provenance, không ChangeSet, không thread) và **reset lịch sử hoàn tác** (`resetCanvasHistory`) — nếu user không thích bảng AI vừa vẽ, không Cmd+Z được. Cần sửa trước khi mở rộng thêm luồng multi-node.
  4. **Conversation nên là nhiều thread theo project, neo theo node tuỳ chọn** — đã đúng theo thiết kế hiện tại (`AiThread.anchorNodeIds`), chỉ là UI orb/Expand mới chưa expose đủ (danh sách thread, lọc theo node). Không cần đổi mô hình dữ liệu.
  5. **Context mỗi lượt: chat gửi 30 node toàn bảng** (`collectKiraContext(..., 'full_board', ..., 30)`), per-node action gửi 12. Không nén, không tóm tắt khi bảng lớn — tới ngưỡng nào đó sẽ tràn context của model yếu nhất (Apple Foundation, ô cửa sổ rất nhỏ). Khuyến nghị nén theo cụm (xem báo cáo auto-organize) trước khi đưa vào prompt.
  6. **MCP server để Claude Desktop/Claude Code đẩy ý tưởng vào KIRA: nên làm, nhưng ở pha sau, không dùng lại listener 47653.** Đây là kết luận đã có sẵn từ nghiên cứu `2026-09-13-right-panel-harness-oss.md` §2.4 (khuyến nghị `rmcp`, server riêng có token) — báo cáo này xác nhận lại và cụ thể hoá tool set cho đúng ca "đẩy ý tưởng, đọc bảng". **Trước mắt, đường đơn giản nhất và rẻ nhất là import file** (dán/thả file xuất từ Claude/ChatGPT, hoặc đọc một thư mục `CLAUDE.md` + `memory/`), vì KIRA **chưa có bất kỳ cơ chế import văn bản/markdown nào** (chỉ có import ảnh và Eagle).
  7. **OSS:** `assistant-ui` đã được chốt (D11, 2026-09-14) cho tab Chat — giữ nguyên, không xét lại. Không thêm thư viện "memory" (mem0/Letta/Zep): đều là framework máy chủ/đồ thị nặng hơn nhu cầu "persona + tóm tắt theo project" của KIRA; tự làm bằng file JSON trong gói `.kira` + JSON trong `~/Library/Application Support` rẻ hơn và đúng mô hình local-first. MCP SDK: `rmcp` (Rust, Apache-2.0) phía server khi làm pha MCP; không cần SDK TypeScript phía KIRA vì không có tiến trình Node/Bun nào cần làm MCP client hôm nay.

Nhãn nguồn: **[code]** = đọc trực tiếp trong repo (kèm `file:line` tại `5dd1596`), **[ngoài]** = tài liệu/trang chính thức (kèm link, truy cập 2026-11-07), **[ngoài-phụ]** = blog/review tổng hợp chưa đối chiếu nguồn gốc, **[suy luận]** = phán đoán của Researcher.

---

## 0. Hiện trạng đã xác minh [code], tại `5dd1596`

### 0.1 Hai đường AI tách rời, không giao nhau

| Đường | Vào | Ra | Qua ChangeSet? | Tạo được mấy node? |
|---|---|---|---|---|
| **Chat** (`sendKiraChatMessage`, [main.tsx:6551](../../apps/desktop/src/main.tsx:6551)) | Gõ tự do trong panel | Văn bản trả lời, lưu vào `AiMessage` | Không áp dụng (chat không sửa canvas) | 0 |
| **Hành động trên node** (`createAiNode`, [main.tsx:5278](../../apps/desktop/src/main.tsx:5278)), 5 action cố định: `summarize/break_down/synthesize/find_gaps/generate_variations` ([main.tsx:246](../../apps/desktop/src/main.tsx:246), [:1715-1729](../../apps/desktop/src/main.tsx:1715)) | Chọn node + bấm action trên dock | **Luôn đúng một** `Idea` mới, `content` là văn bản model trả nguyên khối ([main.tsx:5344-5358](../../apps/desktop/src/main.tsx:5344)) | Có, tạo `AiChangeSet` với một `create-node` item ([main.tsx:5387](../../apps/desktop/src/main.tsx:5387)), áp dụng ngay, provenance đủ | **1**, luôn luôn — kể cả `break_down` với prompt "Break this into practical subnodes..." ([main.tsx:1725](../../apps/desktop/src/main.tsx:1725)): kết quả là một node chứa danh sách, không phải các node con thật |
| **Vẽ cả bảng từ prompt** (`draftBoardFromPrompt` → `createBoardDraftSnapshot`, [main.tsx:3093](../../apps/desktop/src/main.tsx:3093), [:17262](../../apps/desktop/src/main.tsx:17262)) | Màn hình trống, một câu lệnh | 5-12 `Idea` + `Link`, thay **toàn bộ** snapshot | **Không** — không `AiThread`, không `AiRun`, không provenance, không ChangeSet | 5-12, nhưng không qua "Cần bạn" |

Dòng thứ ba là phát hiện mới quan trọng nhất của mục này: `applyProjectSnapshot` ([main.tsx:3030](../../apps/desktop/src/main.tsx:3030)) gọi `resetCanvasHistory(...)` ([main.tsx:3054](../../apps/desktop/src/main.tsx:3054)) — đúng hành vi cần khi mở một project có sẵn, nhưng `draftBoardFromPrompt` cũng gọi `applyProjectSnapshot` cho kết quả AI, nên **bảng AI vừa vẽ trở thành baseline mới, không hoàn tác được**. Đây cũng là đường **duy nhất** hôm nay sinh ra nhiều node từ một yêu cầu — tức là chính luồng gần nhất với "mindmap agent" lại là luồng kém an toàn nhất.

### 0.2 Mô hình dữ liệu đã có, đọc tại `apps/desktop/src/kira/` [code]

Đây là phần lõi self-contained, không import từ `main.tsx` (xem [kira/README.md](../../apps/desktop/src/kira/README.md)), đã unit test (`aiPanelModel.test.ts`). Tóm tắt kiểu dữ liệu ([kira/aiPanelTypes.ts](../../apps/desktop/src/kira/aiPanelTypes.ts)):

- `AiThread { anchorNodeIds }` — một thread có thể neo vào 0 hoặc nhiều node.
- `AiMessage`, `AiRun { changeSetId?, skill? }` — run đã có chỗ cho khái niệm "skill pipeline" (xem `AiSkillCheckpoint`), nhưng chưa có skill nào dùng tới.
- `AiChangeItem` là discriminated union: `create-node | edit-text | edit-palette | delete-node` — **chỉ bốn loại, mỗi loại tác động đúng một node**. Không có `create-link`, không có loại "nhiều node là một đơn vị".
- `AiCanvasOperation` (các phép main.tsx áp dụng qua lịch sử hiện có) cũng chỉ có `update-node-text | update-node-palette | delete-node | remove-node | clear-node-provenance | record-node-version` — **không có `create-node` hay `create-link`** (vì tạo node hôm nay nằm ngoài model này, làm trực tiếp trong `createAiNode`).

Đây chính là chỗ cần mở rộng (§1.3), không phải xây mới: thêm loại item `create-nodes-batch` (payload: danh sách node nháp + cạnh nháp, trạng thái `pending | accepted | rejected`, áp dụng/huỷ như một khối) và thêm phép `create-node`/`create-link` vào `AiCanvasOperation` để accept có thể trả về nhiều phép tạo cùng lúc.

### 0.3 Context mỗi lượt [code]

- Chat: `collectKiraContext(null, 'full_board', {...}, 30)` ([main.tsx:6608](../../apps/desktop/src/main.tsx:6608)) — tối đa 30 node, sắp theo `importance` giảm dần, **không nén nội dung**, mỗi dòng là `formatKiraContextLine(node)`. Có thêm tối đa 40 dòng mô tả cạnh.
- Per-node action: `collectKiraContext(source, scope, {...})` mặc định `limit = 12` ([main.tsx:14145](../../apps/desktop/src/main.tsx:14145)), đi theo `scope` (`selected | upstream_branch | downstream_branch | full_board`) bằng BFS trên `inbound`/`outbound` map.
- `aiExcluded` được tôn trọng ở cả hai đường (lọc trước khi đưa vào `allNodes`).
- **Không có bước nén/tóm tắt** khi số node vượt giới hạn — chỉ cắt theo `importance`, nghĩa là node ít quan trọng hôm nay sẽ **không bao giờ** vào ngữ cảnh chat dù user hỏi đúng về nó, trừ khi nó được chọn trực tiếp (scope `selected`).

### 0.4 Provider và kết nối ngoài hôm nay [code]

- Claude Code: vẫn one-shot `claude -p <prompt> --model <model> --output-format json` ([lib.rs:2694](../../apps/desktop/src-tauri/src/lib.rs:2694)) — không tool, không MCP, không stream. Giao thức stream-json chỉ dùng cho truy vấn danh sách model ([lib.rs:2574-2622](../../apps/desktop/src-tauri/src/lib.rs:2574)), với `--strict-mcp-config --tools ""` để **chặn hẳn** MCP/tool trong lúc hỏi handshake — tức là hạ tầng gọi CLI có tham số MCP rồi, nhưng đang dùng nó để **tắt**, chưa dùng để **bật**.
- Capture HTTP server `127.0.0.1:47653`: `Access-Control-Allow-Origin: *`, không xác thực ([lib.rs:4774](../../apps/desktop/src-tauri/src/lib.rs:4774)) — xác nhận lại hiện trạng đã ghi trong nghiên cứu panel phải tháng 9, **chưa sửa**. Không được tái dùng cho MCP.
- Không có cơ chế import file văn bản/markdown nào [code, xác nhận bằng grep không ra kết quả]: chỉ `importReferenceFolder` (ảnh) và `importEagleWebItems` (thư viện Eagle). Đây là khoảng trống thật cho §4.
- Không có MCP server hay MCP client nào tồn tại trong Cargo.toml hay package.json của app/sidecar hôm nay [code].

---

## 1. Nghiệp vụ agent cho brainstorm/mindmap

### 1.1 Luồng nên có, theo mức ưu tiên

| # | Luồng | Vào | Ra | Có sẵn? |
|---|---|---|---|---|
| 1 | **Hỏi nhanh về selection** | Chọn 1-n node, gõ câu hỏi | Trả lời trong chat, không sửa canvas | **Có** — đúng việc `collectKiraContextForSources` + chat đã làm |
| 2 | **Mở rộng nhánh** (expand) | 1 node, "sinh thêm 3-5 ý con" | N node mới + cạnh `derived-from`/`example`, là **một** đơn vị duyệt/huỷ | **Không** — `break_down` chỉ ra 1 node văn bản |
| 3 | **Gom cụm** (cluster) | Nhiều node đã chọn, hoặc cả bảng | Đổi vị trí (không đổi nội dung), có thể gắn nhãn cụm | **Không có khái niệm này ở đâu cả** — không phải "action", là một phép layout+group |
| 4 | **Phản biện** (critique) | 1 node hoặc 1 nhánh | 1 node mới dạng "weaknesses" HOẶC chỉ là câu trả lời chat, không chắc nên tạo node | Một phần — `find_gaps` đã có, nhưng luôn tạo node, không hỏi trước |
| 5 | **Tóm tắt bảng/cụm thành bảng/văn bản** | Cả bảng hoặc 1 cụm | 1 node tóm tắt, hoặc xuất ra Outline (đã có, khác luồng) | Một phần — `summarize` có, nhưng Outline draft là một tính năng tách biệt không qua Kira |
| 6 | **Biến chat thành node** | Kéo 1 câu trả lời lên canvas | 1 hoặc N node (DECISIONS.md #10) | **Đã CHỐT nhưng CHƯA LÀM** [code: không tìm thấy `draggable`/`onDragStart` nào trong `components/application/kira-panel/`] |

**Khuyến nghị kiến trúc:** luồng 2, 3, 6 đều cần "tạo nhiều node là một đơn vị". Thay vì ba cơ chế riêng, làm **một** loại `AiChangeItem` mới:

```ts
interface AiCreateNodesBatchItem extends AiChangeItemBase {
  kind: 'create-nodes-batch'
  status: 'pending' | 'accepted' | 'rejected'
  nodes: Array<{ draftId: string; nodeKind: 'idea'; title: string; content: string; anchorOffset?: {x,y} }>
  links: Array<{ fromDraftId: string; toDraftId: string; relation: Relation; label?: string }>
  sourceNodeId?: string // neo khi là "mở rộng nhánh", vắng mặt khi là "vẽ cả bảng"
}
```

Khi `accept`: áp các `AiCanvasOperation` mới `create-node` + `create-link` một lượt, **một** `pushCanvasHistory()` cho cả khối (đúng nguyên tắc đã ghi trong `kira/README.md`: "một Cmd+Z hoàn tác đúng một accept"), rồi gọi layout (§2 báo cáo auto-organize) để đặt N node mới không chồng lên node cũ. Khi `reject`: không tạo gì cả — khác hẳn với `create-node` đơn lẻ hôm nay vốn **áp dụng ngay rồi mới cho gỡ** (quyết định #2 DECISIONS.md). Đây là lựa chọn có chủ đích: tạo 1 node thì rẻ để xem rồi xoá, tạo 6-12 node đổ lên canvas cùng lúc thì nên xem trước khi nó chiếm chỗ — khuyến nghị **khác với luồng tạo-1-node hiện tại**, cần user chốt (xem §D1).

Luồng 4 (phản biện) và 5 (tóm tắt) có thể vẫn dùng `AiCreateNodeItem` đơn lẻ sẵn có, không cần sửa gì — chúng đã đúng hình dạng "một node mới". Việc còn thiếu chỉ là mở rộng `AiNodeAction` thêm hai giá trị `cluster` (không tạo node, trả về phép `relayout`) nếu muốn gọi qua cùng cửa, hoặc để "gom cụm" là một nút riêng không qua `createAiNode` (khuyến nghị, vì nó không gọi model — xem báo cáo auto-organize, gom cụm có thể hoàn toàn tất định bằng graph clustering, không cần AI).

### 1.2 Tham khảo cách làm của sản phẩm thật

| Sản phẩm | Cơ chế tool-call / preview-undo | Áp dụng được cho KIRA | Nguồn |
|---|---|---|---|
| **tldraw Agent starter kit** | Mỗi hành động của agent là một "action util" riêng (tạo/sửa/xoá shape), các thay đổi **stream và áp dụng ngay** (không có bước duyệt tường minh trước khi áp), nhưng `agent.cancel()`/`agent.reset()` cho dừng và xoá lịch sử chat; undo là tính năng SDK có sẵn nhưng tài liệu không nói rõ undo có "gom" một lượt agent thành một bước hay không | **Không nên theo nguyên mẫu này cho "tạo nhiều node"**: stream-rồi-undo khác hẳn với "Cần bạn" đã chốt (quyết định #3: sửa/xoá luôn chờ duyệt). Bài học dùng được: mỗi loại hành động là một "action type" tường minh, đúng hướng mở rộng union ở §1.1 | [ngoài] [tldraw agent starter kit](https://tldraw.dev/starter-kits/agent), [tldraw/agent-template](https://github.com/tldraw/agent-template) |
| **Miro AI — Cluster** | Chọn nhóm sticky note → "Cluster" → gom theo keyword hoặc sentiment, **đặt lại vị trí trực tiếp**, không có bước xem-trước riêng ngoài việc nó tự đổi ngay trên board (hoàn tác bằng undo chung của Miro) | Xác nhận: gom cụm ở sản phẩm thật **không cần AI tạo nội dung mới**, chỉ cần model phân loại + thuật toán layout. Khớp khuyến nghị "cluster không cần qua ChangeSet, chỉ cần `relayout`" | [ngoài] [Miro AI reference](https://help.miro.com/hc/en-us/articles/20970362792210-Miro-AI-reference) |
| **Miro AI — Expand** | Chọn 1 node gốc hoặc nhánh trong mind map → sinh ý/chủ đề/câu hỏi **mới làm node con thật**, nối sẵn vào cây | Đây đúng là hình dạng luồng 2 còn thiếu ở KIRA (so với `break_down` hiện chỉ ra văn bản trong 1 node) | [ngoài] cùng trang trên |
| **FigJam AI — Organize** | Chọn nhiều sticky → "Organize" → sắp theo cụm chủ đề + tóm tắt, là **một hành động xem kết quả ngay trên board**, Jambot (chat riêng) trả lời hội thoại không sửa board trực tiếp | Khớp mô hình "chat tách khỏi hành động sửa board" KIRA đã có (Jambot ~ Kira chat); "Organize" ~ cluster | [ngoài-phụ] [FigJam AI, bestaitools 2026](https://www.bestaitools.com/tool/figjam-ai/), [Figma help Jambot](https://help.figma.com/hc/en-us/articles/16783866441111-Use-Jambot-in-FigJam) |
| **Heptabase AI Tutor** | Kéo tin nhắn chat thả lên whiteboard để biến thành card | Đúng nguyên văn quyết định #10 đã chốt nhưng chưa làm; xác nhận đây là pattern phổ biến, không phải ý tưởng lạ | [ngoài-phụ] [Heptabase changelog](https://wiki.heptabase.com/changelog) |
| **Obsidian Canvas — Narrative Canvas** (plugin cộng đồng) | AI copilot trả về **một đề xuất các phép toán** (add/update node, add/remove link) mà user **Apply hoặc Reject** như một khối | **Đây là mô hình gần nhất với `AiChangeSet` của KIRA trong toàn bộ khảo sát** — cùng một ý tưởng "đề xuất = danh sách phép toán, duyệt một lần". Xác nhận hướng mở rộng §1.1 không phải hàng hiếm | [ngoài-phụ] kết quả tìm kiếm liệt kê plugin community (chưa xác minh trực tiếp mã nguồn; tên và mô tả qua kết quả tìm kiếm, không có link repo xác thực trong lần tìm này) |
| **Obsidian Canvas — Bragi Canvas** | Dùng node đã chọn + cạnh vào làm prompt, ghi kết quả thành node mới nối sẵn (mẫu rộng hơn: ảnh, video, âm thanh) | Mẫu "node liền kề = ngữ cảnh, output = node nối vào" khớp `collectKiraContext` theo `upstream_branch`/`downstream_branch` đã có | [ngoài-phụ] [kết quả tìm kiếm Obsidian community plugin, cập nhật khoảng 44 ngày trước lúc tìm] |
| **Napkin AI** | Input là văn bản đã có (không phải hội thoại), ra **nhiều phương án** cấu trúc trực quan (sơ đồ/mindmap/infographic) để chọn, không phải một kết quả duy nhất | Gợi ý cho "tóm tắt bảng": nên trả **nhiều phương án bố cục** cho cùng nội dung tóm tắt, không chỉ 1 | [ngoài-phụ] nhiều nguồn review 2026, ví dụ [therundown.ai](https://www.therundown.ai/tools/napkin-ai) |
| **Scrintal, Whimsical, Kosmik** | Scrintal: AI mô tả rất mỏng, không có chi tiết hành động cụ thể tìm được. Whimsical: sinh flowchart/mindmap từ 1 prompt (giống `draftBoardFromPrompt` của KIRA), auto-layout một-click riêng (04/2026). Kosmik: AI tập trung auto-tag và tìm kiếm, không sinh node | Whimsical xác nhận việc tách "sinh cấu trúc" khỏi "tự xếp bố cục" thành hai bước riêng là hướng đúng — khớp khuyến nghị báo cáo auto-organize (layout là hậu xử lý, không trộn vào bước sinh nội dung) | [ngoài] [Whimsical 2026.4 release notes](https://whimsical.com/releases/2026-4-flowchart-auto-layout); [ngoài-phụ] Scrintal, Kosmik qua review tổng hợp |

**Kết luận §1.2 [suy luận]:** không có đối thủ nào có một cơ chế "preview nhiều-node-là-một-khối" công khai rõ ràng hơn mô hình `AiChangeSet` KIRA đã thiết kế (Obsidian "Narrative Canvas" gần nhất về ý tưởng nhưng là plugin cộng đồng nhỏ). KIRA không cần học theo sản phẩm nào về kiến trúc duyệt — chỉ cần **lấp đúng loại item còn thiếu** trong union đã có.

### 1.3 Việc cụ thể cần làm (không thuộc phạm vi Researcher, giao Worker sau khi user chốt)

1. Thêm `AiCreateNodesBatchItem` vào `aiPanelTypes.ts`, cộng `create-node`/`create-link` vào `AiCanvasOperation`.
2. Viết `proposeNodesBatch`/`acceptNodesBatch`/`rejectNodesBatch` trong `aiPanelModel.ts` theo đúng khuôn các hàm hiện có (trả `AiModelResult`).
3. Sửa `createAiNode` cho action `break_down`/`generate_variations`: đổi prompt yêu cầu model trả **JSON mảng node+link** (giống hệt `buildBoardDraftPrompt`/`parseBoardDraft` đã có — tái dùng, không viết parser mới) thay vì văn bản tự do.
4. **Sửa trước tiên, độc lập với mọi việc trên: `draftBoardFromPrompt` phải đi qua `AiChangeSet`** (hoặc tối thiểu: giữ `pushCanvasHistory()` trước khi gọi `applyProjectSnapshot` với kết quả AI, để Cmd+Z hoạt động). Đây là bug ảnh hưởng người dùng thật ngay hôm nay, không phụ thuộc quyết định kiến trúc nào ở trên.
5. Làm kéo-thả chat lên canvas (quyết định #10, đã chốt, chưa làm): dùng lại `AiCreateNodesBatchItem` nếu tách nhiều node, hoặc `AiCreateNodeItem` nếu gộp 1 node.

---

## 2. Conversation: có cần nhiều cuộc theo project không, lưu ở đâu

**Trả lời: đã đúng mô hình, không cần đổi.** `AiPanelState.threads: AiThread[]` ([kira/aiPanelTypes.ts:45](../../apps/desktop/src/kira/aiPanelTypes.ts:45)) là nhiều thread theo project, mỗi thread có `anchorNodeIds` để neo vào 0, 1 hoặc nhiều node. Lưu trữ: `toSnapshot(aiPanelState)` ghi vào `ProjectSnapshot.aiPanel`, round-trip qua `canvas_collections` bên Rust (bảng key/value, không cần migration — xem `kira/README.md` mục "Rust side"), **tách khỏi** `versionHistory` 50-bản để restore version không kéo chat về quá khứ (DECISIONS.md #4, đã implement đúng theo README).

Việc còn thiếu không phải mô hình dữ liệu mà là **UI**: orb/Expand mới của Orchestrator cần expose `threadsForNode(nodeId)` (hàm đã có, [kira/README.md](../../apps/desktop/src/kira/README.md) mục 7) để lọc "thread liên quan node đang chọn", và cần quyết định orb ở trạng thái "click hỏi nhanh" có tự mở một thread mới mỗi lần hay tiếp tục thread gần nhất của node đó — đây là quyết định UX của Orchestrator, không phải nghiên cứu.

---

## 3. Context và memory

### 3.1 Nén khi bảng lớn

Không có hôm nay (§0.3). Khuyến nghị theo thứ tự chi phí tăng dần:

1. **Rẻ nhất, làm trước:** khi board > limit, **gom theo cụm trước khi cắt** thay vì cắt thẳng theo `importance`. Báo cáo auto-organize (`2026-11-07-auto-organize-layout.md`) đưa ra chính thuật toán phân cụm cần dùng ở đây — dùng **chung một bước gom cụm** cho cả layout lẫn context, không làm hai lần.
2. **Vừa:** mỗi cụm chỉ gửi 1-2 node đại diện (tiêu đề + rút gọn nội dung) thay vì toàn văn `content`, cho các cụm không chứa node đang được hỏi tới.
3. **Chỉ khi cần:** tóm tắt cụm bằng chính model (một lượt gọi AI riêng, cache lại theo cụm, invalidate khi cụm đổi) — đắt hơn, chỉ làm khi bước 1-2 vẫn tràn cửa sổ ngữ cảnh của provider đang chọn (quan trọng nhất với Apple Foundation, cửa sổ nhỏ nhất trong các provider KIRA hỗ trợ).

### 3.2 Memory dài hạn, theo project và theo user

**Theo project:** đã có chỗ chứa đúng — `AiPanelState` là theo-project (nằm trong `ProjectSnapshot`). Không cần thêm cơ chế lưu trữ mới cho "memory theo project"; việc cần làm là ở tầng prompt: khi mở thread mới, đọc `summaryLine`/các thread cũ liên quan làm ngữ cảnh nền, hoặc một trường `projectBrief` tự do do user viết tay (ngắn, 1 đoạn, giống "system prompt riêng cho project này").

**Theo user (persona xuyên project):** user đã có ý tưởng này từ trước, viết trong CLAUDE.md toàn cục của chính họ (`UserPersona` ở `~/.creative-os/user.json`, skill 13 "Preferences & Prompt Management": `role`, `industry`, `aestheticTendency`, `avoidKeywords`, `responseStyle`, `feedbackStyle`). **Khuyến nghị: KIRA đọc đúng file này nếu có, không bịa ra định dạng mới.**

- File là JSON cục bộ trên máy, không phải thứ cần đồng bộ qua mạng — khớp local-first.
- KIRA nên có một màn Settings nhỏ: đường dẫn `~/.creative-os/user.json` (có thể đổi), đọc nếu tồn tại, bỏ qua im lặng nếu không, **không tự tạo file đó** (đó là tài sản của hệ sinh thái CLI khác của user, KIRA không nên ghi đè).
- Nội dung đọc được gộp thành một đoạn ngắn prepend vào mọi prompt Kira gửi model, đúng công thức `personaContext` user đã viết sẵn trong skill 13 — không cần thiết kế lại, chỉ cần đọc và áp dụng.
- **Giới hạn phải nói rõ với user:** đây là file do một hệ thống khác (không phải KIRA) ghi ra; KIRA chỉ nên **đọc**, không ghi, để không phá vỡ nguồn sự thật của hệ thống kia. Nếu user muốn persona quản lý trong chính KIRA, nên là một bản sao/override cục bộ trong Settings của KIRA, không ghi đè file gốc.

---

## 4. Đưa context/memory từ AI khác sang KIRA

### 4.1 Bốn phương án, so sánh

| Phương án | Việc cần làm | Ưu | Nhược | Có vi phạm ràng buộc "không đọc token CLI" không |
|---|---|---|---|---|
| **A. Import file export** (ChatGPT "Export data", Claude conversations.json nếu có, hoặc đơn giản hơn: dán/thả một file `.md`/`.txt`/`.json`) | Thêm lệnh Rust mới kiểu `import_reference_folder` đã có, parse Markdown/JSON thành `Idea[]` + `Link[]` (tái dùng `parseBoardDraft`'s shape nếu định dạng khớp, hoặc viết parser mới cho định dạng export thật) | Không cần mạng, không cần tiến trình nào chạy nền, rủi ro bảo mật thấp nhất, làm được **ngay hôm nay** vì KIRA đã có khung "chọn file → Rust đọc → trả node" | User phải tự export tay, dữ liệu tĩnh (không đồng bộ tiếp) | Không — chỉ đọc file user tự chọn |
| **B. Dán link chia sẻ** (link share của Claude/ChatGPT) | KIRA fetch link đó, parse HTML thành hội thoại | Nhanh với user có sẵn link | Cần request ra mạng (ngược phần local-first của capture); link chia sẻ của ChatGPT/Claude là trang HTML đổi theo thời gian, dễ gãy; không rõ điều khoản dịch vụ có cho crawl không | Không trực tiếp, nhưng mơ hồ về điều khoản sử dụng — cần tự kiểm trước khi làm |
| **C. Đọc thư mục project local** (vd thư mục chứa `CLAUDE.md` + `memory/*.md` của Claude Code, hoặc `~/.codex/` cấu trúc dự án của Codex) | Chọn thư mục → đọc các file `.md` theo quy ước đã biết (giống cách chính Researcher đọc `CLAUDE.md`/`memory/MEMORY.md` của user) → ideas | Không cần mạng; tận dụng đúng cấu trúc đã có sẵn trên máy user, không cần export thủ công | Định dạng riêng của từng CLI (CLAUDE.md, memory dir) có thể đổi theo version; phải đọc đúng file, **không đọc `~/.codex/auth.json` hay token tương đương** | **Phải cẩn thận**: CLAUDE.md và memory/ không phải token, đọc được, nhưng phải liệt kê rõ allowlist tên file, không "đọc mọi thứ trong `~/.codex/` hay `~/.claude/`" |
| **D. MCP server, KIRA là server, Claude Desktop/Claude Code là client** | Dựng server MCP trong tiến trình KIRA (hoặc sidecar riêng), expose tool `search_board`, `read_node`, `propose_idea` (ghi → luôn qua `AiChangeSet`, không ghi thẳng canvas) | Đồng bộ **hai chiều**, trực tiếp trong lúc user đang chat với Claude Desktop ngoài KIRA, không cần export tay mỗi lần; đúng mô hình "trợ lý đẩy ý tưởng vào canvas đang mở" | Phải tự dựng server, tự quản vòng đời (bật/tắt theo phiên làm việc), tự xác thực (không dùng lại 47653), là việc lớn nhất trong 4 phương án | Không — client (Claude Desktop) không đưa token CLI nào cho KIRA; KIRA tự cấp token ngẫu nhiên cho phiên MCP của chính nó |

### 4.2 Đánh giá kỹ phương án MCP (theo yêu cầu)

**Không dùng lại `127.0.0.1:47653`.** Server đó không xác thực (`Access-Control-Allow-Origin: *`, [lib.rs:4774](../../apps/desktop/src-tauri/src/lib.rs:4774)), dựng cho duy nhất một việc: nhận ảnh/trang từ extension trình duyệt của chính user, không phải để một client AI bên ngoài đọc/ghi toàn bộ board. Dùng chung cổng = một tiến trình bất kỳ trên máy (không chỉ Claude Desktop) gọi được `propose_idea` mà không cần xin phép gì.

**Thiết kế đúng** [đã khuyến nghị ở nghiên cứu `2026-09-13-right-panel-harness-oss.md` §2.4, xác nhận lại không đổi]:

- `rmcp` (Rust, Apache-2.0 → đang chuyển, repo ghi tuân cả 2026-07-28 lẫn 2025-11-25) [ngoài, xem §5.3], chạy **streamable HTTP server riêng, cổng khác 47653**, bật tuỳ chọn trong Settings (mặc định tắt).
- **Bearer token KIRA tự sinh** mỗi lần bật (hiện trong Settings dạng "dán vào cấu hình MCP của Claude Desktop"), không phải token của bất kỳ CLI nào — không vi phạm ràng buộc "không đọc/chép file token của CLI" trong CLAUDE.md, vì token này là của chính KIRA, không phải của Claude Code/Codex.
- Tool set tối thiểu, đúng ca "đẩy ý tưởng vào, đọc bảng ra":
  - `read_board_summary` — trả tiêu đề project + N node quan trọng nhất (tái dùng `collectKiraContext(..., 'full_board', ...)`).
  - `search_board(query)` — tìm theo tiêu đề/nội dung, trả node khớp.
  - `propose_idea(title, content, anchorNodeId?)` — **không** ghi canvas trực tiếp, tạo một `AiCreateNodesBatchItem` (hoặc `AiCreateNodeItem` nếu 1 ý) ở trạng thái `pending`, hiện trong "Cần bạn" như mọi đề xuất AI khác. Đây là điểm mấu chốt: MCP không phải cửa sau bỏ qua ChangeSet, nó **chỉ là một nguồn sinh đề xuất khác**, cùng cửa duyệt với Kira chat.
- **Không** cấp tool đọc/ghi file hệ thống, không chạy shell — đúng tinh thần "tool ghi của KIRA chỉ tạo đề xuất chờ duyệt" đã chốt trong nghiên cứu harness.

**Khi nào làm:** sau khi §1.3 mục 1-2 xong (có `AiCreateNodesBatchItem` thật), vì `propose_idea` của MCP server nên dùng chung cơ chế đó, không viết đường ghi riêng thứ ba.

### 4.3 Khuyến nghị thứ tự

1. **Ngay (rẻ, không rủi ro):** Phương án A — import file. Lấp đúng khoảng trống "KIRA chưa có import văn bản nào" (§0.4), và tự nó hữu ích kể cả không có AI nào khác (user dán ghi chú từ bất kỳ đâu).
2. **Cân nhắc riêng theo nhu cầu thật:** Phương án C — đọc thư mục `CLAUDE.md`/`memory/`, **chỉ khi** user thật sự có nhu cầu mang nguyên một dự án Claude Code vào KIRA làm nghiên cứu hình ảnh (nghe hẹp, cần hỏi lại user có đúng ca dùng không — xem §D4).
3. **Pha sau, sau §1.3:** Phương án D — MCP server, giá trị lớn nhất nhưng công sức lớn nhất.
4. **Không làm:** Phương án B (dán link chia sẻ) — rủi ro điều khoản dịch vụ và rủi ro gãy do thay đổi giao diện, lợi ích không hơn phương án A bao nhiêu.

---

## 5. OSS nên dùng

### 5.1 Chat UI: giữ nguyên quyết định D11

Không xét lại `assistant-ui` (Apache/MIT tuỳ gói — npm liệt kê MIT cho `@assistant-ui/react`) [ngoài] — đã chốt 2026-09-14, đã dùng cho tab Chat. Vercel AI SDK UI (Elements) đang chuyển hướng: một nguồn nói AI SDK Elements sẽ ngừng cuối 11/2026, nhường cho shadcn AI Elements [ngoài-phụ, một nguồn, chưa xác thực chéo] — thêm lý do **không** cân nhắc đổi sang nó lúc này, bộ hiện tại (assistant-ui) ổn định hơn.

### 5.2 Memory: không thêm OSS, tự làm bằng file

| Lựa chọn | License | Vì sao không chọn cho KIRA |
|---|---|---|
| **mem0** | Apache-2.0 (self-host miễn phí; theo một nguồn graph memory cần gói trả phí, nguồn khác nói graph có ở mọi gói — mâu thuẫn, [ngoài-phụ] chưa chốt được) | Framework máy chủ lưu trữ memory riêng, đồ thị vector — nặng hơn nhiều so với nhu cầu "đọc một file JSON persona + tóm tắt theo project" |
| **Letta** | Apache-2.0 | Mô hình "model tự quản bộ nhớ qua core/recall/archival" — đúng cho agent tự hành chạy dài, không khớp KIRA (one-shot, không có vòng lặp agent dài hạn hôm nay — xem báo cáo harness 09/2026) |
| **Zep** | Zep Cloud độc quyền; engine mở `Graphiti` Apache-2.0 nhưng cần tự chạy graph database riêng | Cần hạ tầng vận hành (database), ngược local-first một-file-`.kira` |

**Khuyến nghị:** memory theo project = trường trong `AiPanelState` đã có (§3.2); memory theo user = đọc `~/.creative-os/user.json` tại chỗ (§3.2), không cần thư viện nào. Không có gì trong 3 lựa chọn trên rẻ hơn hai dòng code đọc JSON.

### 5.3 MCP SDK: `rmcp`, không cần SDK TypeScript

- **`rmcp`** (Rust) [ngoài, xem `modelcontextprotocol/rust-sdk`]: license Apache-2.0 theo crates.io; bản mới nhất theo GitHub releases ghi `rmcp-v3.9.0` (05/11, tức 2 ngày trước báo cáo này — **chưa xác minh chéo với crates.io**, một nguồn thấy `v3.8.0` ở đó, có thể lệch do index chưa cập nhật) [ngoài-phụ]. Hỗ trợ streamable HTTP server lẫn client. Đây là lựa chọn đúng cho §4.2 — chạy ngay trong `src-tauri`, không thêm tiến trình.
- **SDK TypeScript** (`@modelcontextprotocol/sdk`): không cần, vì không có tiến trình Node/Bun nào trong KIRA cần làm MCP client hay server hôm nay (sidecar `codex-helper` chỉ gọi `@openai/codex-sdk`, không liên quan MCP).

---

## D. Quyết định cần chốt

1. **Khi "mở rộng nhánh" tạo nhiều node:** (a) luôn chờ duyệt ở "Cần bạn" như một khối (khác với tạo-1-node hiện tại) *(khuyến nghị)* · (b) áp dụng ngay như tạo-1-node hôm nay, chỉ khác là 1 ChangeSet chứa N item
2. **`draftBoardFromPrompt` (vẽ cả bảng):** (a) sửa ngay, độc lập với mọi việc khác, để có hoàn tác *(khuyến nghị, có thể giao luôn không cần chờ quyết định khác)* · (b) gộp chung vào đợt làm `AiCreateNodesBatchItem`
3. **"Gom cụm":** (a) phép tất định (không gọi AI), dùng chung thuật toán với auto-organize *(khuyến nghị)* · (b) có gọi AI để đặt tên cụm, phần vị trí vẫn tất định
4. **Phương án C (đọc thư mục CLAUDE.md/memory):** (a) làm, vì user có nhu cầu thật mang ngữ cảnh dự án code sang nghiên cứu hình ảnh · (b) **chưa làm**, vì nghe như một ca dùng hẹp, ưu tiên phương án A trước rồi xem lại *(khuyến nghị, hỏi lại user)*
5. **MCP server (phương án D):** (a) làm ở pha sau, sau khi có `AiCreateNodesBatchItem` *(khuyến nghị)* · (b) làm song song, `propose_idea` tạm thời dùng `AiCreateNodeItem` đơn lẻ
6. **Đọc persona `~/.creative-os/user.json`:** (a) đọc trực tiếp từ đường dẫn đó, không hỏi lại *(khuyến nghị, nhưng cần Settings cho đường dẫn tuỳ chỉnh)* · (b) copy nội dung vào một trường Settings riêng của KIRA lúc setup, không đọc file trực tiếp mỗi lần mở app

## Giới hạn

- Không chạy app, không gọi model nào. Mọi số liệu về luồng AI đọc trực tiếp từ mã nguồn tại `5dd1596`, có dòng cụ thể.
- Thông tin Miro/FigJam/Whimsical/Heptabase/Scrintal/Napkin/Kosmik/Obsidian plugin lấy qua `WebSearch`, phần lớn là review bên thứ ba cho năm 2026, không phải tài liệu chính thức — đã gắn `[ngoài-phụ]` và nêu rõ mâu thuẫn giữa nguồn khi có.
- Chưa đọc mã nguồn `Narrative Canvas` hay `Bragi Canvas` (plugin Obsidian) trực tiếp, chỉ dựa vào mô tả trong kết quả tìm kiếm — không có link repo xác thực trong lần tìm này cho Narrative Canvas.
- License `rmcp` và số bản mới nhất có một điểm mâu thuẫn nhỏ giữa GitHub releases và crates.io (§5.3), chưa tự kiểm bằng cách tải crate.
- Không xét Whimsical/Scrintal/Kosmik sâu bằng Miro/FigJam vì tư liệu công khai mỏng hơn nhiều, đã nói rõ trong bảng §1.2 thay vì suy diễn thêm.

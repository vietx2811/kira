# Auto-organize layout: xếp node AI sinh ra để bao quát nhiều ý nhất, ít chồng chéo nhất

- **Câu hỏi:** ý tưởng AI sinh ra nên hiển thị sao cho trong một diện tích người dùng bao quát được nhiều ý nhất, đường nối chồng chéo ít nhất. Khảo sát OSS mindmap/node, đề xuất thuật toán, chọn thư viện, và làm một prototype đo số giao cắt cạnh trước/sau.
- **Người yêu cầu:** Orchestrator, chuyển từ user (2026-11-07).
- **Commit đã kiểm chứng:** vixio `5dd1596` (branch `researcher/kira-agent-layout`). Prototype chạy bằng Node v24.15.0, `docs/research/2026-11-07-auto-organize-prototype/`.
- **Kết luận ngắn:**
  1. **Thuật toán hiện tại (`layoutBoardDraft`) có một lỗi nặng hơn "chồng chéo cạnh": nó làm nhiều node đè khít lên đúng một điểm khi đồ thị có chu trình hoặc đủ sâu.** Đo được trên fixture C (10 node, một vòng lặp phản hồi + 2 node rời): **10 cặp node chồng khít lên nhau** (5 node cùng một toạ độ `(50, 92)`), vì `y = clamp(22 + line*16, 8, 92)` bão hoà ở mức 92 ngay khi số "hàng" vượt khoảng 5 — một board AI vẽ đủ dài hoặc có vòng lặp sẽ tự nuốt chửng các node cuối vào một chồng không đọc được, mà số liệu "giao cắt cạnh" bằng 0 không hề cho thấy lỗi này.
  2. Trên bảng 12 node tiêu biểu của AI (đúng giới hạn `BOARD_DRAFT_MAX_NODES`, có cả liên kết chéo nhánh như chính prompt của Kira yêu cầu), giữ nguyên cách chia hàng hiện tại nhưng **đổi thứ tự trong hàng theo barycenter 3 lượt + tìm kiếm cục bộ toàn đồ thị** làm **giao cắt giảm từ 8 xuống 4 (50%)** và tổng chiều dài cạnh giảm từ 428,6 xuống 380,8 (khoảng 11%), đo trực tiếp bằng cổng thuật toán gốc.
  3. **Khuyến nghị kiến trúc: không có một thuật toán cho mọi hình dạng.** Cây/mindmap một nguồn → vẫn hàng theo tầng (`layerFlowchart` đã đúng hướng) nhưng phải thêm bước giảm giao cắt (barycenter + tìm kiếm cục bộ, đã đo ở trên). Đồ thị có chu trình hoặc rời rạc → chuyển sang force-directed (đo được: xoá sạch 10 cặp chồng khít, còn 1 giao cắt, nhưng tổng chiều dài cạnh tăng — đánh đổi hợp lý vì mục tiêu lúc này là *không chồng*, không phải *ngắn nhất*).
  4. **Thư viện khuyến nghị tích hợp: `elkjs` cho pha layered/tidy-tree (web worker, lazy-load), `WebCola` cho pha force có ràng buộc (giữ node đã ghim đứng yên, loại cạnh "Liên quan" khỏi lực kéo) — không dùng `libavoid-js` hay `d3-flextree` ở MVP.** Lý do license và bảo trì ở §3.
  5. **Chưa đưa kích thước card thật (ảnh, palette, ý dài) vào bất kỳ thuật toán nào hôm nay, kể cả hai thuật toán thử trong prototype này** — đây là việc phải làm trước khi đưa ra production, không phải tuỳ chọn; xem §2.2.

Nhãn nguồn: **[code]**, **[ngoài]**, **[ngoài-phụ]**, **[suy luận]**, **[đo]** = số đo trực tiếp từ prototype trong báo cáo này.

---

## 0. Hiện trạng đã xác minh [code], tại `5dd1596`

| File | Vai trò | Giới hạn đã thấy |
|---|---|---|
| [`kira/mermaid/parseMermaid.ts:235-269`](../../apps/desktop/src/kira/mermaid/parseMermaid.ts:235) `layerFlowchart` | Gán mỗi node một "hàng" = độ sâu BFS từ node không có ai trỏ vào (`incoming === 0`). Cạnh quay lại node đã xếp hàng (chu trình) bị **bỏ qua hoàn toàn**, không lỗi, không cảnh báo. Node không tới được bằng BFS (đứt rời) bị dồn vào các hàng cuối theo thứ tự liệt kê, không theo cấu trúc thật | Với chu trình: không có khái niệm "vòng lặp", chỉ có "cây đã cắt cạnh ngược" — hai node của cùng một vòng lặp có thể bị đẩy xa nhau nhiều hàng nếu BFS đi vòng qua nhánh khác trước |
| [`kira/ai/boardDraft.ts:88-123`](../../apps/desktop/src/kira/ai/boardDraft.ts:88) `layoutBoardDraft` | Xếp mỗi hàng thành các "dòng" tối đa 4 cột (`perLine = 4`), thứ tự trong hàng = trung bình toạ độ x của **các cha trực tiếp của chính node đó** — không nhìn con, không nhìn node khác hàng, không nhìn cạnh cùng hàng | `y = clamp(22 + line*16, 8, 92)`: mỗi 4 node tiêu tốn một `line`, và `line` tăng vô điều kiện theo tổng số hàng × số dòng mỗi hàng, nên **bão hoà ở 92 rất nhanh** khi đồ thị sâu hơn ~5 tầng hiệu dụng |
| [`kira/canvas/edgeLabels.ts`](../../apps/desktop/src/kira/canvas/edgeLabels.ts) | Chỉ xếp **nhãn cạnh** để không đè lên nhau/đè lên card, viết sau khi đo thấy nhãn đè nhau trên bảng 9 node AI (comment ghi rõ ngày đo: 2026-11-06, tức **hôm qua**) | Không đụng tới vị trí node, không giải quyết giao cắt cạnh hay chồng node — là một lớp vá riêng, đúng, nhưng độc lập hoàn toàn với bài toán báo cáo này |
| `kira/canvas/relations.ts` | 6 loại quan hệ (`supports, contrasts, example, derived-from, contains, related`), rút gọn từ 9 loại **hôm qua** (2026-11-06) | Không có khái niệm "quan trọng với layout" hay "không quan trọng với layout" — tất cả 6 loại được đối xử như nhau trong `layoutBoardDraft`. Đây là chỗ cần thêm luật "cạnh `related` không kéo layout" mà Orchestrator đã nêu, chưa có |

**Hàm ý [suy luận]:** hai file liên quan nhất tới câu hỏi này (`boardDraft.ts`, `relations.ts`) đều vừa được viết lại hôm qua, nên đây đúng lúc để sửa `layoutBoardDraft` cùng đợt, tránh để nó lỗi thời ngay khi vừa ổn định xong các phần xung quanh.

---

## 1. Khảo sát OSS

### 1.1 Thư viện mindmap/node, tự chạy trong app

| Thư viện | License [ngoài] | Hoạt động/bảo trì [ngoài] | Ghi chú kỹ thuật |
|---|---|---|---|
| **Mind Elixir** | MIT [ngoài-phụ, so sánh LibHunt] | ~3,2k sao tại thời điểm khảo sát | JS thuần, không ràng buộc framework, nhưng là **cả một editor mindmap** (UI, tương tác, định dạng riêng) — tích hợp nghĩa là thay thế canvas của KIRA, không phải chỉ lấy thuật toán |
| **markmap** | MIT [ngoài-phụ] | Phổ biến nhất nhóm này (~13,2k sao) | Sinh mindmap **từ Markdown có cấu trúc phân cấp rõ** (heading, list) — đồ thị của KIRA không phải cây Markdown thuần, nhiều cạnh chéo nhánh; không khớp mô hình dữ liệu |
| **jsMind** | Không xác định được trong lần tìm | ~3,8k sao, không có dữ liệu cập nhật gần đây | Cùng vấn đề: là editor trọn gói |
| **simple-mind-map** | Không xác định | Mô tả "layout linh hoạt" nhưng không có chi tiết kỹ thuật tìm được | Không đủ dữ liệu để đánh giá |
| **Xmind** | Thương mại, không phải thư viện nhúng được | — | Chỉ dùng tham khảo hình ảnh/UX, không tích hợp |

**Kết luận 1.1 [suy luận]:** không thư viện mindmap "trọn gói" nào khớp, vì KIRA đã có canvas, node, card riêng (ảnh, palette, ý) — cái cần là **thuật toán xếp vị trí + định tuyến cạnh**, không phải một editor khác. Nhóm này bị loại không phải vì license mà vì **sai lớp trừu tượng**: chúng là ứng dụng, KIRA cần một hàm.

### 1.2 Thư viện layout (đúng lớp cần)

| Thư viện | License [ngoài] | Hoạt động/bảo trì [ngoài] | Phù hợp hình dạng nào |
|---|---|---|---|
| **elkjs** (cổng JS của Eclipse Layout Kernel) | `EPL-2.0 OR GPL-3.0-or-later` theo npm — **cần chọn một nhánh khi phân phối**; dự án khác phải viết hẳn issue riêng để quyết định việc này cho bản MIT của họ [ngoài, `elkjs` trên npm, dẫn qua thảo luận kỹ thuật trong các repo khác] | Có bản thực tế dùng Web Worker (`elk-worker.min.js`), có dự án báo asset worker ~1,6MB chỉ tải khi bật auto-layout, không phình bundle chính nếu lazy-load đúng cách [ngoài-phụ, một dự án tự đo] | **Layered** (cây, DAG), **mrtree** (mindmap hai phía đối xứng gốc-giữa), **radial**, **force**, **rectpacking** — nhiều thuật toán trong một gói, đúng mục tiêu "chọn layout theo hình dạng" |
| **@dagrejs/dagre** | MIT cho `dagre-d3` (không tìm thấy công bố license riêng cho lõi `dagre`, chỉ số gián tiếp) [ngoài-phụ] | Dagre gốc được chính cộng đồng Mermaid/React Flow gọi là "không còn bảo trì" (nguồn 2021, chưa có xác nhận mới hơn trong lần tìm này) | Chỉ layered, nhẹ hơn elkjs nhưng rủi ro bảo trì cao hơn |
| **d3-hierarchy** (`tree`, `cluster`) | Không xác định được license cụ thể trong lần tìm này — cần tự kiểm | Là một phần bộ D3 đang dùng rộng rãi, không có dấu hiệu ngừng | **Tidy tree 1 phía** sạch, nhanh, nhưng giả định mọi node cùng kích thước (không nhận chiều rộng/cao riêng từng node) |
| **d3-flextree** | **WTFPL** (không ràng buộc gì) [ngoài, trang Snyk] | **Không còn hoạt động**, bản phát hành gần nhất "4 năm trước" tính tới lúc khảo sát [ngoài, Snyk] | Giải đúng bài toán "tidy tree với node kích thước khác nhau" KIRA cần (ảnh to hơn ý), nhưng không ai bảo trì. License tự do tuyệt đối nên **vendor thẳng mã nguồn** (copy vào repo, không phụ thuộc npm) là lựa chọn hợp lệ, không phải rủi ro pháp lý — chỉ là rủi ro "không ai sửa nếu có bug" |
| **cytoscape.js + cytoscape-fcose** | Cả hai MIT [ngoài, trang chính thức + npm] | fcose là layout được chính tài liệu Cytoscape khuyên dùng đầu tiên cho force-directed; tác giả báo nhanh gấp đôi CoSE | Đồ thị **nhiều chu trình, nhiều thành phần**, cộng khả năng đặt ràng buộc một phần |
| **cytoscape.js + cytoscape-cola** (bọc WebCola) | MIT | Cola là layout liên tục (chạy mỗi khung hình), đắt hơn fcose | Khi cần ràng buộc chặt (giữ nguyên vị trí một số node) hơn fcose cho |
| **WebCola** (độc lập, không qua Cytoscape) | MIT [ngoài] | Có dấu hiệu cập nhật trong năm khảo sát theo một listing bên thứ ba (chưa xác thực trực tiếp) [ngoài-phụ] | Layout có **ràng buộc tường minh** (constraint-based): đúng nhu cầu "node đã ghim không di chuyển", "cạnh `related` không kéo layout" — đây là layout **duy nhất trong danh sách có API ràng buộc sẵn** cho đúng hai yêu cầu đó, không cần tự chế |
| **libavoid-js** | **LGPL-2.1-or-later** [ngoài, xác nhận ở nhiều downstream: `cytoscape-libavoid`, một fork Rust] | Viết và duy trì bởi một tác giả tại một phòng lab đại học; không có dữ liệu hoạt động 2026 trực tiếp cho bản JS, chỉ thấy một dự án khác ghim bản `0.4.5` hôm 2026-10-19 [ngoài-phụ] | Định tuyến cạnh **orthogonal né vật cản** — đúng cho "đường kẻ vuông góc né card", nhưng đây là **định tuyến cạnh, không phải đặt node** |

**License, nói rõ cho app thương mại đóng gói [suy luận, không phải tư vấn pháp lý]:**

- **elkjs (EPL-2.0 hoặc GPL-3.0):** dùng nguyên bản qua npm, không sửa mã nguồn elkjs, nói chung được xem là ổn cho ứng dụng đóng gói theo cách diễn giải phổ biến của EPL-2.0 (nghĩa vụ copyleft chỉ áp lên phần mã **sửa đổi của chính elkjs**, không lan sang code gọi nó) — nhưng đây là câu hỏi cần **luật sư hoặc người phụ trách giấy phép của user xác nhận**, không phải việc Researcher tự quyết.
- **WebCola (MIT):** không có ràng buộc gì thêm, an toàn tuyệt đối cho app thương mại.
- **libavoid-js (LGPL-2.1):** nếu chạy qua WASM không sửa đổi, LGPL cho phép liên kết vào phần mềm độc quyền mà không bắt mở mã phần đó; nghĩa vụ chỉ áp khi **sửa** chính thư viện. Vẫn nên xác nhận với người phụ trách giấy phép trước khi đưa vào sản phẩm bán ra.

### 1.3 Định tuyến cạnh (orthogonal vs curved)

- KIRA hiện vẽ cạnh dạng **đường cong SVG** [theo brief Orchestrator, chưa đọc lại mã vẽ cạnh trong báo cáo này — xem Giới hạn]. `edgeLabels.ts` cho thấy app đã quen xử lý vị trí **nhãn** cạnh dạng tránh vật cản bằng heuristic tự viết (không dùng thư viện), nên có tiền lệ "tự viết heuristic nhỏ thay vì kéo thư viện lớn" đúng với lựa chọn ở §2.
- **libavoid-js** là lựa chọn đúng nếu KIRA muốn chuyển sang **orthogonal (vuông góc) có né vật cản thật** — nhưng đó là thay đổi thẩm mỹ lớn (từ cong sang vuông góc), nằm ngoài câu hỏi "ít chồng chéo nhất trong một diện tích", nên **không khuyến nghị cho MVP** của riêng việc này. Giữ đường cong, chỉ sửa **vị trí node** trước — nếu vị trí node đã tốt (ít giao cắt), bài toán định tuyến cạnh nhẹ đi rất nhiều vì đường cong giữa hai điểm không giao cắt hiếm khi tự giao cắt đường khác.

---

## 2. Thuật toán đề xuất

### 2.1 Chọn layout theo hình dạng đồ thị, không phải một công thức cho tất cả

```
Phát hiện đồ thị (trên tập node sắp đặt lại, không phải toàn bộ Library):
  - Không có chu trình, có đúng 1 node gốc (incoming=0), ≤ 1 thành phần liên thông
      → LAYERED (layerFlowchart đã có + barycenter 3 lượt + tìm kiếm cục bộ, §2.3)
  - Không có chu trình, nhưng gốc có 2 nhánh rõ muốn đối xứng hai bên (mindmap cổ điển)
      → MRTREE hai phía (elkjs 'mrtree', gốc ở giữa, nhánh trái/phải theo số node mỗi nhánh)
  - Có chu trình, HOẶC > 1 thành phần liên thông, HOẶC > ~25 node đã chọn
      → FORCE có ràng buộc (WebCola): spring theo cạnh thật, loại cạnh 'related' khỏi lực
        kéo (constraint, không phải xoá cạnh), node đã ghim (pinned) là constraint vị trí
        cố định, không phải "trọng lượng rất nặng"
```

Ngưỡng "~25 node" là **suy luận**, chưa đo — nên để Worker làm cấu hình, không hard-code, và điều chỉnh sau khi có số liệu thật từ `docs/research/2026-09-21-canvas-performance-thresholds.md` (nghẽn hiệu năng canvas đã đo ở ~45-250 node, không phải báo cáo này đo lại).

### 2.2 Kích thước card khác nhau — việc bắt buộc, chưa ai làm

Không thuật toán nào trong khảo sát này (kể cả bản đo trong prototype) biết card có chiều rộng/cao khác nhau. `layoutBoardDraft` hiện đặt theo lưới phần trăm cố định bất kể node là một câu ngắn hay một đoạn dài, một ảnh hay một palette 6 màu. Khuyến nghị:

- **Layered:** thay bước chia cột đều (`perLine`, cách đều 20%) bằng vị trí tích luỹ theo **chiều rộng ước lượng thật của từng card** (đo trước bằng chiều dài `title`/`content` hoặc đọc `width`/`height` thật nếu node là ảnh) — đây đúng là bài toán **tidy tree với kích thước biến thiên** mà `d3-flextree` giải, nên vendor thuật toán đó (WTFPL, không ràng buộc) thay vì tự viết lại từ đầu.
- **Force:** WebCola đã hỗ trợ "node có `width`/`height`" trong phép tránh chồng (`avoidOverlaps`) sẵn trong API của nó — chỉ cần truyền đúng kích thước, không cần thêm thư viện.

### 2.3 Giảm giao cắt cho layered, phần đã đo trong prototype

Giữ nguyên `layerFlowchart` (gán hàng), chỉ thay bước "thứ tự trong hàng":

1. 3 lượt barycenter: xuống theo cha → lên theo con → xuống theo cha (chuẩn Sugiyama).
2. Tìm kiếm cục bộ toàn đồ thị: với mỗi cặp liền kề trong một hàng, thử đổi chỗ, **giữ lại nếu tổng số giao cắt của CẢ đồ thị giảm** (không chỉ hai hàng lân cận — lý do: bảng AI có cạnh **cùng hàng**, ví dụ nhánh này nối chéo sang nhánh kia ở cùng độ sâu, mà cách nhìn "chỉ hai hàng lân cận" bỏ sót hoàn toàn). Lặp tối đa 6 lượt hoặc tới khi không cải thiện.

Đây chính là phần đã đo được 8→4 giao cắt ở fixture B (§4).

---

## 3. Thư viện cụ thể nên tích hợp

| Pha | Thư viện | API vào/ra | Hiệu năng ước tính với 200 node [suy luận, chưa đo thật] |
|---|---|---|---|
| **1 (ngay)** | Tự viết: cổng `layerFlowchart` hiện có + barycenter/tìm-kiếm-cục-bộ như §2.3 | Vào: `{nodes, edges}` giống `layerFlowchart` hiện tại. Ra: `Map<id, {x,y}>` giống `layoutBoardDraft` hiện tại — **đổi được tại chỗ, không đổi API gọi** | O(hàng × độ rộng hàng² × cạnh) cho tìm kiếm cục bộ — với 200 node chia đều ~15 hàng × ~13 node/hàng, mỗi lượt khoảng 13×13×200 ≈ 34.000 phép so sánh góc, 6 lượt ≈ 200.000 — nên chạy dưới 50ms trên JS thường, **nhưng chưa đo thật trên 200 node**, chỉ đo tới 12 node trong prototype này |
| **2 (khi cần mrtree/radial, hoặc cây lớn)** | `elkjs`, chạy trong Web Worker, lazy-load (không import tĩnh ở đầu bundle) | Vào: đồ thị dạng `ElkNode` (lồng `children`, `edges`) theo schema ELK. Ra: toạ độ tuyệt đối mỗi node sau khi `elk.layout()` resolve Promise | elkjs là engine Java dịch sang JS/WASM, nặng hơn giải pháp tự viết; cần tự đo trên máy thật trước khi cam kết ngưỡng 200 node — không có số liệu 2026 nào tìm được cho các thuật toán `mrtree`/`radial`/`rectpacking` cụ thể (§1.2) |
| **3 (đồ thị chu trình/rời rạc)** | `WebCola` | Vào: `nodes` (có `width`/`height`/`fixed`), `links` (có `source`/`target`, gắn cờ loại khỏi constraint), `constraints` tuỳ chọn | Cola là mô phỏng vật lý liên tục — nặng hơn force rời rạc một lần; 200 node có khả năng cần giới hạn số vòng lặp hoặc chạy trong worker, **chưa đo** |
| **Không dùng ở MVP** | `libavoid-js` | — | Giải đúng bài toán khác (định tuyến cạnh vuông góc), không phải đặt node; cân nhắc lại chỉ khi đổi hẳn phong cách cạnh sang orthogonal |

---

## 4. Prototype: đo số giao cắt cạnh trước/sau [đo]

**Vị trí:** `docs/research/2026-11-07-auto-organize-prototype/` — `crossing-benchmark.mjs` (script, không phụ thuộc gì ngoài Node ≥18), `build-specimen.mjs` (sinh ảnh), `results.json` (toạ độ), `specimen.html` (ảnh SVG tĩnh, xem trực tiếp bằng trình duyệt, không cần server).

**Phương pháp:** `layerFlowchart` và `layoutBoardDraft` trong script là **cổng gần như nguyên văn** dòng-theo-dòng từ [`parseMermaid.ts:235-269`](../../apps/desktop/src/kira/mermaid/parseMermaid.ts:235) và [`boardDraft.ts:88-123`](../../apps/desktop/src/kira/ai/boardDraft.ts:88) tại `5dd1596` — không phải suy diễn lại từ mô tả. Đếm giao cắt bằng kiểm tra giao nhau đoạn thẳng chuẩn (CCW), bỏ qua cặp cạnh chung một đầu mút. Đã chạy và chụp màn hình để xác nhận kết quả khớp với số in ra console (ảnh trong báo cáo này do chính Researcher chạy `node crossing-benchmark.mjs` rồi mở `specimen.html` bằng trình duyệt và chụp).

### Fixture A — cây sạch, 7 node, không liên kết chéo

| | Giao cắt | Cặp chồng khít | Tổng chiều dài cạnh |
|---|---|---|---|
| Hiện tại (`layoutBoardDraft`) | 0 | 0 | 115,2 |
| Candidate (barycenter + tìm kiếm cục bộ) | 0 | 0 | 115,2 |

Không đổi — đúng kỳ vọng: cây sạch đã tối ưu sẵn, candidate không làm tệ đi.

### Fixture B — 12 node (đúng giới hạn `BOARD_DRAFT_MAX_NODES`), có liên kết chéo nhánh thật

Đúng kiểu đồ thị prompt của Kira tự yêu cầu model tạo ra ("link ideas across branches where they truly connect", [`boardDraft.ts:40`](../../apps/desktop/src/kira/ai/boardDraft.ts:40)).

| | Giao cắt | Cặp chồng khít | Tổng chiều dài cạnh |
|---|---|---|---|
| Hiện tại | **8** | 0 | 428,6 |
| Candidate | **4** (giảm 50%) | 0 | 380,8 (giảm 11%) |

### Fixture C — chu trình phản hồi + một cặp node rời rạc, 10 node

| | Giao cắt | Cặp chồng khít | Tổng chiều dài cạnh |
|---|---|---|---|
| Hiện tại | 0 | **10** (5 node tại đúng toạ độ `(50, 92)`) | 130,0 |
| Candidate layered | 0 | **10** (không khá hơn — vẫn là layered, vẫn bão hoà `clampPercent`) | 130,0 |
| Candidate force-directed (WebCola-style, 500 vòng lặp, seed cố định) | 1 | **0** | 266,3 |

Ảnh chụp cả 3 fixture: xem `specimen.html` trong cùng thư mục prototype (SVG tĩnh, không cần chạy lại script). Mô tả bằng lời cho fixture C: bản hiện tại vẽ 10 node thành **một cột thẳng đứng duy nhất**, 5 node cuối chồng khít thành một chấm không đọc được; bản force-directed tách rõ hai vòng lặp thành hai cụm nhỏ gọn (hình gần như hai hình thoi) và đẩy cặp node rời rạc ra một góc riêng, không chồng lên nhau hay lên hai cụm chính.

### Diễn giải trung thực

- Candidate layered **không phải lúc nào cũng thắng**: trên fixture C nó không cải thiện gì (đúng lý thuyết — giao cắt trong layered chỉ đổi khi thứ tự trong hàng đổi, mà ở đây lỗi nằm ở **bước gán hàng/độ cao**, không phải thứ tự). Đây là lý do §2.1 tách hai nhánh xử lý theo hình dạng, không trộn một thuật toán cho mọi trường hợp.
- Force-directed **đánh đổi chiều dài cạnh lấy việc hết chồng khít** (266,3 so với 130,0) — đúng bản chất của force-directed (phân bố đều không gian), không phải lỗi của phép đo.
- Cả hai candidate đều **chưa biết kích thước card thật** (§2.2) — số đo ở trên chỉ chứng minh đúng một trục (giao cắt/chồng điểm theo toạ độ tâm), chưa chứng minh "không chồng card" theo nghĩa hình chữ nhật thật.

---

## Quyết định cần chốt

1. **Vá ngay, không chờ quyết định khác:** sửa `y = clamp(22 + line*16, 8, 92)` để không bão hoà (vd mở rộng biên độ theo số hàng thật, hoặc chuyển cây sâu sang cột thay vì hàng khi vượt ngưỡng) — đây là lỗi chồng node thật, độc lập với việc chọn thư viện nào về sau.
2. **Thứ tự triển khai:** (a) vá barycenter + tìm kiếm cục bộ cho layered trước (rẻ, không thêm dependency, đã đo lợi ích) rồi mới xét `elkjs`/`WebCola` *(khuyến nghị)* · (b) nhảy thẳng sang `elkjs` cho mọi hình dạng, bỏ qua bước vá rẻ
3. **Force layout khi có chu trình/rời rạc:** (a) `WebCola`, có constraint cho node ghim và cạnh `related` *(khuyến nghị)* · (b) `cytoscape-fcose` nếu muốn trọn bộ Cytoscape luôn (kéo theo toàn bộ thư viện Cytoscape, nặng hơn nếu KIRA không cần phần còn lại của nó)
4. **Kích thước card khác nhau:** (a) vendor thuật toán `d3-flextree` (WTFPL, copy mã nguồn, không phụ thuộc npm) cho layered *(khuyến nghị)* · (b) tự viết lại từ đầu, không dùng mã có sẵn
5. **License elkjs/EPL:** (a) xin xác nhận từ người phụ trách pháp lý của user trước khi đưa elkjs vào bản phát hành *(khuyến nghị, không phải việc Researcher tự quyết)* · (b) bỏ qua elkjs hoàn toàn, chỉ dùng thuật toán tự viết + WebCola (cả hai MIT)

## Giới hạn

- Prototype chỉ thử tới 12 node (đúng giới hạn thật của `boardDraft.ts` hôm nay), **chưa đo ở 200 node** như brief yêu cầu "ước lượng hiệu năng với 200 node" — con số 200 node trong §3 là suy luận từ độ phức tạp thuật toán, không phải phép đo. Lý do: 200 node vượt xa `BOARD_DRAFT_MAX_NODES = 12`, nên trước tiên cần quyết định có nâng giới hạn đó không (một quyết định sản phẩm khác, ngoài phạm vi báo cáo này) trước khi đo đúng ca dùng thật ở quy mô đó.
- Không cài, không chạy `elkjs`/`cytoscape-fcose`/`WebCola`/`libavoid-js` thật — mọi nhận định về API, hiệu năng, bundle size của chúng đến từ tài liệu và README, gắn `[ngoài]`/`[ngoài-phụ]` tương ứng. Số bundle size của elkjs và tuyên bố "không còn bảo trì" của dagre đều từ nguồn thứ cấp, cần tự kiểm trước khi chốt.
- Chưa đọc lại mã vẽ cạnh (curved SVG) trong `main.tsx` cho báo cáo này — mô tả "đường cong SVG" ở §1.3 lấy từ brief của Orchestrator, chưa tự xác minh bằng `file:line`.
- Không xác nhận được license chính xác của `dagre` gốc (chỉ có license của `dagre-d3`) hay của `d3-hierarchy` trong lần tìm kiếm này.
- Phương pháp "tìm kiếm cục bộ toàn đồ thị" trong candidate layered là O(hàng × độ rộng² × cạnh) mỗi lượt — đủ nhanh cho 7-12 node (đo được, dưới 1 giây tổng cả 3 fixture) nhưng **chưa đo ở quy mô lớn hơn**; nếu nâng giới hạn board lên hàng chục/hàng trăm node, cách này cần thay bằng giảm giao cắt theo từng cặp hàng liền kề (độ phức tạp thấp hơn) đánh đổi lấy việc bỏ sót cạnh cùng hàng xa.

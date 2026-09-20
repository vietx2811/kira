# Canvas: ngưỡng hiệu năng và chỗ nghẽn

**Câu hỏi:** canvas gãy ở bao nhiêu node, và thời gian đi đâu?
**Người yêu cầu:** Orchestrator (giao cho QA Performance, 2026-09-21)
**Commit đã kiểm chứng:** `b03b0d9` (main lúc đo). Dev build, `npx vite` port 5199, Chrome headless 153 qua CDP, viewport 1600x1000, `deviceScaleFactor: 1`.

**Điều kiện máy:** có 6 session QA chạy song song trên cùng máy, nên mọi phép đo đều kèm một **phép chuẩn CPU cố định** chạy trong trang ngay trước mỗi mức (vòng lặp 8 triệu `Math.sqrt`), để phát hiện nhiễu do tải. Phép chuẩn ổn định 5,2–8,2ms ở mọi mức trong cả hai lần đo, nên chênh lệch giữa các mức là do số node chứ không do tải. Toàn bộ bảng ngưỡng đã được **đo lại lần hai ở tải khác hẳn** (load average 52 → 7,7–9,5) và cho cùng kết quả, xem §1.1.

**Kết luận ngắn:**
- Mượt thật (60fps) chỉ tới **~45 node**. 84 node còn 48fps, 104 node còn 38fps, 156 node còn 26fps.
- Từ **250 node trở lên không dùng được**: pan 17fps, kéo node trễ p95 200ms trở lên.
- Chỗ nghẽn **không phải** phép toán của app (1,7% thời gian). Là **React dựng lại toàn bộ canvas mỗi sự kiện chuột** cộng với **style recalc toàn cây do ghi custom property mỗi lần di chuột**.
- `graphCap` cắt thật khỏi cây React (không phải ẩn bằng CSS), nhưng cắt ở 300 vẫn còn quá cao gấp ~7 lần ngưỡng mượt.
- View 3D chạy **toàn bộ 608 node ở 60fps**, không cap. Library đã windowing. Cả hai đều không phải vấn đề.

---

## 1. Ngưỡng

Pan = kéo chuột giữa; kéo node = kéo chuột trái trên header node. Mỗi phép 3s, đếm khung bằng `requestAnimationFrame`.

| refs | node thật | pan fps | pan p50 | pan p95 | kéo node fps | kéo node p95 |
|---|---|---|---|---|---|---|
| 12 | 16 | 60 | 16,7 | 16,8 | 56,1 | 16,8 |
| 25 | 29 | 60 | 16,7 | 16,8 | 59,7 | 16,8 |
| 40 | **44** | **60** | 16,7 | 16,7 | 59,7 | 16,7 |
| 60 | 64 | 59,1 | 16,7 | 16,8 | 53,2 | 33,3 |
| 80 | 84 | 48,1 | 16,7 | 33,4 | 48,5 | 33,4 |
| 100 | 104 | 37,7 | 33,3 | 49,9 | 43,7 | 50,0 |
| 150 | 156 | 26,3 | 33,4 | 50,1 | 22,4 | 116,6 |
| 200 | 206 | 20,6 | 50,0 | 83,3 | 14,9 | 133,3 |

### 1.1 Đo lại để kiểm nhiễu tải

Chạy lại đúng kịch bản ở thời điểm máy nhẹ hơn nhiều. Cột `load` là load average 1 phút lúc đo mức đó.

| node | load lần 2 | chuẩn CPU | pan fps lần 1 | **pan fps lần 2** | kéo node fps lần 1 | **kéo node fps lần 2** |
|---|---|---|---|---|---|---|
| 44 | 9,3 | 5,4ms | 60,0 | 56,1 | 59,7 | 59,1 |
| 64 | 9,5 | 5,4ms | 59,1 | 59,4 | 53,2 | 52,9 |
| 84 | 9,5 | 5,2ms | 48,1 | 51,6 | 48,5 | 49,6 |
| 104 | 8,6 | 5,3ms | 37,7 | 43,0 | 43,7 | 45,8 |
| 156 | 8,6 | 8,2ms | 26,3 | 28,4 | 22,4 | 23,6 |
| 206 | 8,1 | 6,4ms | 20,6 | 23,1 | 14,9 | 14,7 |
| 258 | 7,7 | 8,2ms | 17,2 | 17,1 | 15,9 | 10,2 |

Hai lần đo lệch nhau trong khoảng ~15% ở mọi mức, cùng hình dạng đường cong, cùng các mốc ngưỡng. Lần 2 nhanh hơn chút ở khoảng giữa, đúng chiều với việc máy nhẹ tải hơn. **Kết luận ngưỡng không phụ thuộc tải máy.**

Mức lớn hơn, kèm thời gian nạp và bộ nhớ:

| refs | tổng node | node hiển thị | phần tử DOM | JS heap | nạp (ms) | pan fps | zoom fps | kéo node fps | kéo node p95 |
|---|---|---|---|---|---|---|---|---|---|
| 60 | 64 | 64 | 2 534 | 75 MB | 872 | 36,3 | 25,4 | 41,0 | 33,4 |
| 120 | 126 | 126 | 4 192 | 89 MB | 705 | 26,4 | 37,8 | 27,6 | 99,9 |
| 250 | 258 | 258 | 7 742 | 119 MB | 902 | 17,2 | 18,6 | 15,9 | 200,1 |
| 500 | 508 | 300 (cap) | 9 166 | 128 MB | 828 | 17,0 | 13,4 | 24,5 | 183,2 |
| 600 | 608 | 300 (cap) | 9 166 | 130 MB | 336 | 16,6 | 11,4 | 21,0 | 233,3 |

**Ngưỡng an toàn đề nghị:**

| Vùng | Số node | Cảm giác |
|---|---|---|
| An toàn | ≤ 45 | 60fps, không rớt khung |
| Chấp nhận được | 45–100 | 38–60fps, bắt đầu thấy khựng khi kéo |
| Khó chịu | 100–200 | 20–38fps, kéo node trễ 50–133ms |
| Không dùng được | ≥ 250 | ≤ 17fps, kéo node trễ ≥ 200ms |

Thời gian nạp không phải vấn đề ở mọi mức (0,3–0,9s tới lúc DOM ổn định). Heap tăng tuyến tính rồi chững lại ở cap (130MB ở 608 node).

## 2. Chỗ nghẽn

### 2.1 Mỗi sự kiện chuột dựng lại toàn bộ canvas

Đo bằng 30 nhịp ctrl+wheel cách nhau 90ms (đủ xa để không bị gộp), nên mỗi nhịp đúng bằng **một lần render đầy đủ**:

| board | node | phần tử | ms script / lần render |
|---|---|---|---|
| seed | 9 | 747 | 4,1 |
| 12 | 16 | 1 082 | 5,0 |
| 60 | 64 | 2 534 | 30,3 |
| 120 | 126 | 4 192 | 48,6 |
| 250 | 258 | 7 742 | 80,7 |
| 600 (cap 300) | 300 | 9 166 | 90,8 |

Tuyến tính: **≈ 4ms cố định + 0,29ms mỗi node hiển thị**. Ngân sách một khung 60fps là 16,7ms, giải ra **n ≈ 44 node** — khớp đúng bảng ngưỡng ở trên.

Nguyên nhân: `movePan` (`main.tsx:9522`) gọi `setGraphTransform` trên **mỗi** `pointermove`, và `handleCanvasWheel` (`main.tsx:9548`) làm y vậy. State này nằm ở component chứa toàn bộ canvas, nên mỗi lần di chuột dựng lại toàn bộ JSX của node, link và mọi thanh công cụ. Trong khi đó ghi thẳng `transform` lên `.graph-viewport` tốn **0,01ms** — bản thân việc dời khung hình gần như miễn phí, cái đắt là đi qua React.

### 2.2 Di chuột (chưa cần kéo) gây style recalc toàn cây

`updateCanvasGridHotspot` (`main.tsx:9594`) ghi hai custom property `--grid-hot-x` / `--grid-hot-y` lên `.graph-canvas` ở **mọi** `pointermove`. Custom property là thuộc tính kế thừa, nên mỗi lần ghi làm Chrome tính lại style cho cả cây con.

Đo cô lập, 200 thao tác mỗi loại:

| Thao tác | 60 refs (2 534 phần tử) | 600 refs (9 166 phần tử) |
|---|---|---|
| Rê chuột qua canvas, không bấm gì | 516ms style / 16ms script | **2 245ms style** / 18ms script |
| Ghi thẳng `--grid-hot-*` 200 lần | 923ms (4,6ms/lần) | **4 106ms (20,5ms/lần)** |
| Ghi một biến **không ai dùng** 200 lần | 895ms | 4 072ms |
| Ghi `transform` lên viewport 200 lần | 0ms | 1ms |

Biến không ai dùng đắt ngang biến đang dùng, nên đây là invalidation của custom property, không phải chi phí vẽ gradient. Đây là lý do pan tốn nhiều style recalc (1 220–1 506ms mỗi 3s ở 608 node) còn zoom thì gần như không (14–38ms): zoom đi bằng `wheel`, không sinh `pointermove`.

Hệ quả thực tế: **chỉ rê chuột ngang qua board lớn đã nặng**, chưa cần thao tác gì.

### 2.3 Thời gian đi đâu (CPU profile, pan trên 258 node)

| Phần | Tỷ lệ | Ước lượng |
|---|---|---|
| Engine: style, layout, paint, composite (`(program)`, GC, idle) | 53,0% | ~2 055ms |
| React DEV-only (chỉ có ở bản dev) | ~12–15% | ~465–580ms |
| **Code của app trong `main.tsx`** | **1,7%** | **~66ms** |

Phần còn lại là React reconcile/commit ở bản release lẫn dev (`jsxDEVImpl`, `updateProperties`, `ReactElement`, `setProp`, `commitUpdate`...).

Trả lời trực tiếp câu hỏi được giao: **không phải tính đường cong link, không phải layout CSS, không phải vẽ**. `smoothGraphEdge` chỉ chiếm ~15ms trong một profile 4,2s. Là dựng lại React cộng style recalc do mục 2.2.

Chi tiết nhỏ đáng dọn nhưng không phải nguyên nhân chính: mỗi link đi qua `displayView.links.map` **hai lần** (`main.tsx:9894` vẽ path SVG, `main.tsx:9960` vẽ nút `.edge-joint`), mỗi lần gọi lại `smoothGraphEdge` và `resolveGraphNodePosition` cho cùng một cặp điểm — tức 2 path + 1 button DOM cho mỗi link.

### 2.4 `graphCap` có cắt thật không? — Có

Đo trên cùng board 608 node, đổi cap bằng bàn phím rồi đếm DOM:

| cap | node trong DOM | path SVG | `.edge-joint` | tổng phần tử | node ẩn-mà-vẫn-có-trong-DOM |
|---|---|---|---|---|---|
| 75 | 75 | 134 | 67 | 2 866 | **0** |
| 150 | 150 | 284 | 142 | 4 979 | **0** |
| 300 | 300 | 584 | 292 | 9 179 | **0** |

`capGraphView` (`main.tsx:13535`) lọc mảng trước khi render, nên node bị cắt **không vào DOM**. Không có node nào `display:none` / `visibility:hidden` / `opacity:0` còn sót. Cơ chế đúng như thiết kế.

Nhưng **mức cap mặc định 300 vẫn cao gấp ~7 lần ngưỡng mượt 44 node**, nên nó không cứu được gì: ở 608 node, pan bị nghẽn main thread ở mọi mức cap. Và cap đếm theo **node**, không đếm link: cap 300 vẫn để lọt 292 link = 584 path + 292 button.

## 3. Các đường nặng khác

**View 3D — không phải vấn đề, ngược lại là chỗ sáng.** Ở board 608 node, 3D hiện **608/608 node, 450/450 link, không cap** (xem ảnh `shot-3d-600.jpg`), và giữ **60fps** cả khi đứng yên lẫn khi orbit kéo chuột, 0 khung rớt trên 100ms. Chi phí chỉ nằm ở lúc chuyển view: ~1 971ms script và một khung dài ~717ms.

**Library — không phải vấn đề.** Với 600 ảnh, danh sách chỉ giữ **~18 mục trong DOM** (đã windowing). Kéo thanh trượt kích thước lên tối đa (60 → 100): **60fps**, 102ms script, 7ms style, 0 khung rớt.

**Sắp xếp tự động (`Shift+A`) — không phải vấn đề.** Đo trên board mới nạp mỗi lần:

| mode | 120 refs | 250 refs | 600 refs | overlaps @608 | crossings @608 |
|---|---|---|---|---|---|
| flow (ELK) | 107ms | 158ms | 368ms | 133 | 22 |
| cluster (force) | 109ms | 266ms | 763ms | 1 510 | 0 |
| grid (shelf pack) | 1ms | 2ms | 13ms | **43 956** | 6 384 |

Shift+A trên 608 node: 53,5fps, một khung dài 783ms. Chấp nhận được.

Đáng chú ý nhưng là **vấn đề chất lượng layout, không phải hiệu năng**: mode `grid` trả về sau 13ms nhưng để lại **43 956 cặp node chồng nhau** ở 608 node (1 485 ở 120 node) — tức gần như không sắp xếp gì.

Về ELK: `organizeGraphLayout` (`main.tsx:15562`) chạy `elk.layout()` **tối đa 4 lần** (4 hướng) và chỉ dừng sớm khi có phương án `overlaps === 0 && crossings === 0`; ở 608 node điều đó không xảy ra nên luôn chạy đủ 4. `new ELK()` không truyền `workerUrl` nên chạy trên main thread. Hiện chưa đau (368ms) nhưng sẽ đau nếu board lớn hơn.

## 4. Giới hạn của phép đo

- **Không đo được 1000 node.** `createBenchmarkProjectSnapshot` kẹp `referenceCount` vào `[12, 600]` (`main.tsx:16605`), nên `loadFixture(1000)` cho ra 600 ảnh + 8 idea = **608 node**. Mức 1000 trong đề bài không với tới bằng dev API hiện có.
- **Bản dev.** React DEV chiếm ~12–15% thời gian pan. Bản production sẽ nhanh hơn chừng đó, tức ngưỡng an toàn có thể nhích từ ~45 lên ~50–55 node, **không đổi bậc độ lớn**. 53% thời gian nằm ở engine (style/layout/paint) và không đổi theo build mode.
- **Ảnh giả.** `benchmarkThumb` sinh SVG data-URI nhẹ, không phải ảnh thật. Ảnh thật sẽ nặng hơn ở decode và bộ nhớ, nhẹ hơn ở số Document.
- **Headless, không phải app native.** Đường Tauri **chưa đo**, và tôi không đo. Toàn bộ task chạy được bằng Chrome headless + CDP nên không cần quyền điều khiển app; tôi không gọi `request_access` / `request_full_control`, không dùng `osascript` / System Events, không dùng `screencapture`. Hai ảnh trong báo cáo là `Page.captureScreenshot` qua CDP trong browser headless riêng, đã tự `Read` lại trước khi gửi. So sánh với app native là việc còn để ngỏ cho lượt sau.
- **Một lần đo bất thường chưa giải thích được.** Lần đầu đo `organizeAndVerify('flow')` trên 608 node ra **115 623ms**, trong điều kiện tab đang ẩn **và load average máy ~52** (6 session QA chạy song song chiếm CPU). Theo luật 0d, tôi đã A/B lại thay vì gọi ngay là artifact: cùng commit `b03b0d9`, cùng board, chỉ khác trạng thái tab — **visible 429ms / 405ms, hidden 2 170ms / 1 990ms**, và dựng lại đúng chuỗi gốc (ẩn tab + Shift+A cluster đang settle) cho **1 421ms**. Tab ẩn làm chậm thật khoảng 5 lần, nhưng **không tái hiện được 115s**. Con số đó hiện chưa có lời giải; kết luận "organize không phải chỗ nghẽn" dựa trên các lần đo tái hiện được, không dựa trên việc bác bỏ lần đo kia.

## 5. Đề xuất (theo thứ tự lợi ích trên công sức)

1. **Bỏ ghi custom property mỗi `pointermove`** (mục 2.2). Throttle theo rAF, hoặc chỉ ghi khi hiệu ứng grid hotspot đang thực sự hiển thị, hoặc dùng `@property` đăng ký kiểu để Chrome không invalidate cả cây. Rẻ nhất, gỡ được tới 2,2s style recalc mỗi 3s rê chuột ở board lớn.
2. **Tách `graphTransform` khỏi React.** Pan/zoom ghi thẳng `transform` lên `.graph-viewport` qua ref (đo được 0,01ms/lần) và chỉ đồng bộ vào state khi thả chuột. Gỡ gần hết chi phí ở mục 2.1 mà không cần đụng kiến trúc node.
3. **Hạ cap mặc định**, hoặc đổi cap thành cắt theo khung nhìn (viewport culling) thay vì cắt theo số lượng. 300 không phải con số dùng được; dữ liệu nói ~45.
4. **Cap cả link, không chỉ node**, và gộp hai vòng `displayView.links.map` thành một.
5. Cân nhắc dùng **đường 3D/WebGL làm mặc định cho board lớn** — nó đã chạy 608 node ở 60fps.
6. Sửa `grid` organize (43 956 cặp chồng nhau) và cho ELK chạy trong worker trước khi board lớn hơn.
7. Nâng trần `loadFixture` lên 2000 để QA đo được mức cao hơn.

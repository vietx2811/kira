# Visual Explore: từ một ảnh hoặc một vùng cắt, tìm ảnh tương tự và kéo về canvas

**Câu hỏi:** Pinterest Visual Search và plugin Pinterest của Eagle hoạt động ra sao theo góc nhìn người dùng? KIRA có thể làm "từ node ảnh hoặc vùng cắt, khám phá ảnh tương tự, kéo về canvas thành node cạnh nguồn" bằng đường nào là hợp lệ, khả thi, và tốn bao nhiêu công?

**Người yêu cầu:** Orchestrator (giao 2026-11-09), cho user là Art Director ở VN, F&B và branding.

**Commit đã kiểm chứng:** `7829b85` (worktree `qa-extension/capture-research`) cho phần `[Code]`.

**Kết luận ngắn:**
1. **Không có đường chính thức để KIRA tự gọi tìm kiếm của Pinterest.** API v5 không có tìm kiếm Pin, và đại diện đội API Pinterest trả lời công khai (2025-09-12) rằng điều khoản cấm thu thập dữ liệu khi chưa được cho phép và họ "không có kế hoạch" cho phép. Plugin của Eagle sống nhờ dịch vụ của Pinterest và đã từng hỏng khi Pinterest đổi. Không nên xây KIRA trên đó.
2. **Đường an toàn và đủ giá trị: "Visual Explore" 2 tầng.** Tầng 1 tìm tương tự **trong thư viện của chính user** bằng embedding chạy cục bộ (CLIP/SigLIP/DINOv2 hoặc feature print của Apple Vision), theo mẫu lai của Eagle "Find by Media". Tầng 2 mở rộng ra ngoài bằng **nguồn có API hợp lệ** (Openverse, Met Museum, Wikimedia, Unsplash), dùng từ khoá lấy từ node, rồi xếp hạng lại bằng embedding cục bộ.
3. **Pinterest vẫn dùng được theo cách user tự làm**: mở Pinterest trong trình duyệt (hoặc webview do user điều khiển), user tự bấm kính lúp của Pinterest, rồi kéo kết quả về bằng extension KIRA đã có. KIRA không tự động hoá, không thu thập. Cách này không cần code mới ngoài việc làm bước kéo về mượt hơn (xem báo cáo `2026-11-09-browser-capture-behavior.md`).
4. Ước lượng: tầng 1 cỡ **M** (khoảng 1 tuần) nếu chọn Apple Vision, **M-L** nếu đóng gói model ONNX. Tầng 2 cỡ **M** cho hai nguồn đầu. Chưa có gì trong repo hiện làm được việc này: `findSimilarReferences` chỉ so tag và hue.
5. Việc **phải** quyết trước khi làm: có chấp nhận tải model về lần đầu (~24 đến ~95MB) hay chỉ dùng thứ có sẵn trong macOS (Apple Vision, không tải gì, nhưng không hiểu ngữ nghĩa).

**Cách đọc nhãn bằng chứng:** `[Code]` đã xác minh trong repo, kèm `file:dòng`. `[Ngoài]` nguồn bên ngoài kèm link, truy cập 2026-11-09. `[Suy luận]` là phán đoán của tôi.

**Giới hạn:** Trang điều khoản và chính sách của Pinterest trả HTTP `406` cho mọi truy cập tự động (WebFetch và curl), và tôi **không** tìm cách vượt qua. Vì vậy các điều khoản dưới đây được ghi "qua nguồn thứ cấp" trừ trường hợp đã đọc trực tiếp (câu trả lời của đội API Pinterest). Người có quyền pháp lý nên đọc nguyên văn trước khi quyết. Cơ chế bên trong của Pinterest Lens và của plugin Eagle **không được tài liệu hoá**; phần mô tả dưới đây là hành vi nhìn từ ngoài, không phải kiến trúc.

---

## 1. Pinterest Visual Search nhìn từ người dùng `[Ngoài]`

Nguồn là bài của bên thứ ba (Pinterest không cho tải trang trợ giúp). Mô tả hành vi, không mô tả cơ chế:

- Trên mỗi Pin có một **kính lúp** cạnh nút Save. Bấm vào, Pinterest hiện khung cắt có thể kéo; kết quả bên dưới đổi theo vùng đang chọn.
- Kết quả là **Pin tương tự về thị giác**, kèm gợi ý từ khoá để thu hẹp.
- Có biến thể trên điện thoại (Lens: chụp ảnh vật thật rồi tìm).

Điều đáng học về UX, không phải về công nghệ:

| Điều Pinterest làm | Vì sao đáng học cho KIRA |
|---|---|
| Vùng cắt **chỉnh được ngay trên ảnh** và kết quả cập nhật theo | Art Director hay chỉ quan tâm một chi tiết (hoạ tiết, chai, kiểu chữ), không phải cả ảnh |
| Kính lúp nằm **cạnh nút lưu** | Khám phá và thu thập là một cử chỉ liền mạch |
| Gợi ý từ khoá đi kèm kết quả | Chuyển từ "ảnh" sang "ngôn ngữ" để người dùng tinh chỉnh |
| Kết quả là kho có sẵn của Pinterest | Thứ KIRA **không có**: kho ảnh đủ lớn để tìm tương tự |

Điểm cuối cùng là nút thắt thật: tìm tương tự cần một **kho ảnh để so**. Pinterest có kho khổng lồ; KIRA chỉ có thư viện của user. Mọi lựa chọn ở mục 4 thực chất là chọn kho nào.

## 2. Plugin Pinterest của Eagle `[Ngoài]`

Nguồn: trang plugin trên [community-en.eagle.cool](https://community-en.eagle.cool/) (bản 1.1.9, cập nhật 2025-10-03). Những gì trang nêu:

- Chọn một hoặc nhiều ảnh trong Eagle, plugin trả về ảnh tương tự từ Pinterest.
- Tìm hàng loạt; chọn **vùng con** của ảnh rồi tìm lại.
- Nguồn đầu vào: thư viện Eagle, ứng dụng bên thứ ba, file cục bộ, clipboard.
- Phím tắt khi rê chuột: `S` lưu vào Eagle, `F` tìm ảnh tương tự, `O` mở trên Pinterest, Space hoặc click xem chi tiết.
- **Ghi tự động link nguồn** khi lưu.
- Ghi chú phiên bản: có lúc "tìm kiếm nay không cần đăng nhập"; ghi chú cũ nói cần đăng nhập Pinterest sau khi dịch vụ đổi.
- Plugin **phụ thuộc dịch vụ của Pinterest** và hỏng khi Pinterest thay đổi.

Cơ chế (gọi gì, ở đâu, bằng tài khoản nào) **không được tài liệu hoá**. Hai điều có thể nói chắc từ chính trang đó: nó cần mạng, và nó hỏng theo Pinterest. Tôi không suy đoán thêm.

Bài học thiết kế đáng lấy từ Eagle:

1. Vùng con là tính năng hạng nhất, không phải phần phụ.
2. Một phím để từ "xem" sang "lưu" (`S`), và nguồn luôn được ghi.
3. **Eagle cũng có công cụ tương tự hoàn toàn cục bộ**: "Find by Media". Theo mô tả công khai, điểm tương tự là **lai 60% embedding thần kinh + 25% perceptual hash + 15% màu**, không cần API key, quét thư viện một lần rồi lưu cache. Đây là mẫu tham chiếu cho tầng 1 của KIRA. (Nguồn: trang plugin của Eagle; tôi chưa kiểm hệ số này bằng tài liệu thứ hai nên xem là mô tả của nhà cung cấp.)

## 3. Pháp lý và rủi ro với Pinterest

### Đã đọc trực tiếp

Đội API Pinterest trả lời một câu hỏi trên diễn đàn (community.pinterest.biz, thread 39124, tài khoản "Haley", 2025-09-12): điều khoản dịch vụ "explicitly prohibit scraping, collecting, or accessing Pinterest data without explicit prior authorization", dùng API tìm kiếm bên ngoài để khám phá hay dùng ảnh Pinterest thuộc phạm vi cấm đó, và "no plans to allow this". API v5 chính thức **không có endpoint tìm Pin**.

### Qua nguồn thứ cấp (chưa đọc nguyên văn)

Các trích dẫn tìm kiếm nói Terms of Service, Developer Terms và Community Guidelines cấm thu thập tự động, dùng bot, và dịch ngược. Pinterestbot được mô tả là tôn trọng `robots.txt` theo các trang trợ giúp.

### Hệ quả cho KIRA `[Suy luận, không phải tư vấn pháp lý]`

| Cách làm | Rủi ro |
|---|---|
| Gọi endpoint nội bộ của Pinterest từ app (mô phỏng cách Lens hoặc plugin Eagle), hoặc parse trang kết quả | Nằm đúng phạm vi bị cấm theo câu trả lời trên. App miễn phí và mã nguồn mở **không** loại trừ điều khoản. Dễ hỏng khi Pinterest đổi (Eagle dính chuyện này). **Không khuyến nghị.** |
| Dịch vụ thu thập bên thứ ba bán lại dữ liệu Pinterest | Chuyển rủi ro, không xoá nó; cùng nhóm "ngoài điều khoản" |
| Nhúng trang Pinterest vào webview, **user tự duyệt và tự bấm**, extension hiện có lưu từng ảnh user chọn | Là người dùng dùng trình duyệt thông thường, KIRA không tự động hoá và không thu thập hàng loạt. **Ranh giới an toàn hơn nhiều**, nhưng ranh giới nằm ở "user thao tác từng bước"; nếu KIRA bắt đầu tự bấm kính lúp hay tự cuộn lấy kết quả thì đã sang nhóm trên |
| Lưu và hiển thị lâu dài ảnh Pinterest đã kéo về | Cùng vấn đề bản quyền ảnh với mọi nhà sưu tập mood board; đã có sẵn trong luồng capture. Nên ghi nguồn (đã làm) và không phát hành lại |

## 4. Các nguồn "kho ảnh để tìm tương tự"

Mỗi hàng là một cách trả lời câu "so với kho nào". Công sức theo thang S (≤ 2 ngày), M (3 đến 5 ngày), L (> 1 tuần), `[Suy luận]`.

| # | Nguồn | Hợp lệ? | Chất lượng với F&B/branding | Phụ thuộc | Công sức |
|---|---|---|---|---|---|
| 1 | **Thư viện của user**, embedding cục bộ | Có (dữ liệu của user) | Tốt cho "tìm trong thứ tôi đã sưu tầm", phụ thuộc kích thước thư viện | Model hoặc Apple Vision | M |
| 2 | **Nguồn có API và giấy phép rõ**: Openverse (CC), Met Museum (CC0), Wikimedia, Unsplash | Có, theo điều khoản từng API | Trung bình: nghiêng về ảnh stock, nghệ thuật, tư liệu; ít bao bì/F&B đương đại VN | Mạng, từ khoá hoặc embedding | M mỗi hai nguồn |
| 3 | **Pinterest**, user tự điều khiển | Gần như là trình duyệt thông thường | Cao (đúng nguồn Art Director dùng) | Trình duyệt, extension hiện có | S (làm mượt bước kéo về) |
| 4 | **Tìm ảnh ngược** (Google Cloud Vision Web Detection) | Có, dịch vụ có hợp đồng | Tìm *cùng ảnh hoặc cùng chủ thể* hơn là "cùng mood"; cần ảnh gửi lên máy chủ Google | Tài khoản trả phí | M |
| 5 | **Tìm ảnh ngược qua scraping** (SerpApi/Google Lens/Bing/Yandex) | Vùng xám/gần như vi phạm điều khoản nguồn | Thay đổi | Dịch vụ trả phí | Không khuyến nghị |
| 6 | Bing Visual Search API | **Có báo cáo đã ngừng** (khoảng 2025-08, chỉ thấy trang lưu trữ, chưa xác nhận từ Microsoft) | n/a | n/a | Không chọn |
| 7 | Pinterest API v5 | Không có tìm Pin | n/a | n/a | Không thể |

### Chi tiết các nguồn hợp lệ `[Ngoài]`

- **Embedding cục bộ** (đã kiểm qua API HuggingFace, kích thước ước từ danh sách file):

  | Model | Giấy phép | Cỡ vision encoder (lượng tử hoá) | Ghi chú |
  |---|---|---|---|
  | `Xenova/clip-vit-base-patch32` | MIT | ~89MB (int8), ~54 đến 64MB (q4) | Lâu đời, phổ biến, ngữ nghĩa tốt, có text encoder để **tìm bằng chữ** |
  | `onnx-community/siglip2-base-patch16-256-ONNX` | upstream `google/siglip2` Apache-2.0; metadata repo ONNX không có trường license | ~95MB (int8), ~64MB (q4) | Mới hơn, thường tốt hơn CLIP ở truy xuất; **cần xác nhận license của bản ONNX trước khi gói** |
  | `facebook/dinov2-small` | Apache-2.0 | ~24MB (lượng tử hoá) | Mạnh ở **tương tự thị giác thuần** (bố cục, hoạ tiết), không có text encoder |
  | MobileCLIP (Apple) | `apple-amlr`: chỉ dùng cho nghiên cứu, loại trừ sản phẩm/dịch vụ thương mại | n/a | **Tránh**, dù app hiện miễn phí: điều khoản làm đóng cửa khả năng thương mại hoá sau này |

  Chạy bằng: `fastembed-rs` (Apache-2.0, dựa trên `ort`, model mặc định `Qdrant/clip-ViT-B-32-vision` 512 chiều; giấy phép **trọng số** tính riêng) trong Rust; hoặc Transformers.js trong WebView (WASM chắc chắn chạy; WebGPU còn thử nghiệm và **chưa kiểm** trong WKWebView của KIRA).

- **Apple Vision** `[Ngoài, Suy luận]`: `VNGenerateImageFeaturePrintRequest` cho vector đặc trưng và `computeDistance` so khoảng cách, không tải model, chạy ngoài app qua helper Swift (KIRA đã có mẫu: `kira_vision_ocr.swift`, `binaries/kira-vision-ocr-helper` trong `tauri.conf.json`). Hạn chế: không phải ngữ nghĩa (gần "trông giống" hơn "cùng ý"), thang khoảng cách không được cam kết, và cần **ghim phiên bản request** vì vector đổi theo hệ điều hành. Chỉ chạy trên macOS, khớp phạm vi hiện tại (Apple Silicon).

- **Google Cloud Vision Web Detection:** giá $3.50 cho 1000 đơn vị sau 1000 đơn vị miễn phí mỗi tháng cho mỗi tính năng (trang giá chính thức, đã đối chiếu snippet). Ảnh gửi lên Google: ngược nguyên tắc "không gửi gì ra ngoài" nếu user không đồng ý rõ.

- **Openverse API:** truy cập ẩn danh không cần key, ảnh CC; giới hạn tần suất chỉ có từ nguồn thứ ba. **Met Museum Collection API:** CC0, không cần key, khoảng 80 req/s (nguồn thứ ba). **Unsplash:** hướng dẫn API yêu cầu hotlink, gọi endpoint download khi dùng, ghi công; 50 req/giờ bản demo, 5000 req/giờ bản production (nguồn thứ ba). Wikimedia: chưa đối chiếu chi tiết trong lần này.

## 5. Hiện KIRA đã có gì `[Code]`

- `findSimilarReferences` (`main.tsx:6031`) xếp theo **tag trùng và độ lệch hue**; tuỳ chọn nhờ LLM xếp hạng nhưng chỉ nhận tag và màu chủ đạo ở dạng chữ, **không bao giờ thấy pixel**. Chỉ tìm trong thư viện.
- `averageHash` (`main.tsx:15274`, 64 bit) dùng cho cảnh báo trùng gần, không dùng để xếp hạng tương tự.
- **Ảnh capture từ trình duyệt không có perceptual hash, palette thật, hay kích thước**: `analyzeImageDataUrl` chỉ gọi ở nhập file cục bộ (`main.tsx:15046`); capture đặt `thumb` là URL từ xa và `palette` sinh từ chuỗi URL (`main.tsx:15128`, `:15627`). Hệ quả cho Visual Explore: **phần lớn ảnh user sưu tầm qua extension sẽ không so được** cho tới khi tải về và phân tích. Đây là điều kiện tiên quyết, được nêu là việc #8 ở báo cáo capture.
- Mẫu helper native sẵn có (Swift sidecar) và mẫu sidecar Node/Bun (`kira-codex-helper`).

Kết luận: hiện không có đường nào so ảnh với ảnh bằng nội dung ảnh.

## 6. Đề xuất: Visual Explore hai tầng

### Luồng người dùng

1. Chọn một **node ảnh** (hoặc nhiều), bấm "Khám phá" trong thanh công cụ node hoặc phím tắt. Tuỳ chọn: **kéo khung vùng cắt** trên ảnh (cùng kiểu `react-easy-crop` đã có trong dependency của `apps/desktop/package.json`).
2. Mở một **panel khám phá** (không modal): hàng đầu là ảnh nguồn kèm vùng cắt; bên dưới là lưới kết quả theo nhóm: *Trong thư viện của bạn*, *Từ nguồn mở* (Openverse, Met, Wikimedia), và nút "Mở Pinterest" cho tầng user-driven.
3. Rê chuột lên kết quả: `S` thêm vào canvas làm node **cạnh nguồn** (đặt theo hướng tia từ node nguồn, nối cạnh "tương tự" mờ), `O` mở trang nguồn, Space xem lớn. Nguồn và giấy phép luôn được ghi (trường `source` đã có).
4. Chỉnh vùng cắt thì kết quả cập nhật (debounce). Gợi ý từ khoá (từ tag AI đã có của node) hiện dạng chip để thu hẹp.
5. Lần đầu bật tầng embedding: hộp thoại nói rõ "tải model ~XXMB, chạy trên máy, không gửi ảnh đi đâu", và nút bỏ qua để dùng chế độ không tải (Apple Vision).

### Kiến trúc đề xuất

| Lớp | Việc | Chỗ đặt gợi ý |
|---|---|---|
| Chỉ mục | Tải/sao chép ảnh capture về project, tính embedding một lần, lưu cache theo `contentHash` | Native (Rust/Swift helper), chỉ mục là file trong package project |
| Truy vấn | Cosine trên vector, kết hợp pHash (25%) và màu (15%) theo mẫu Eagle; vùng cắt thì tính lại embedding vùng | Native; thư viện vài nghìn ảnh thì brute force đủ nhanh (`[Suy luận]`, cần đo) |
| Nguồn ngoài | Adapter mỗi API (Openverse, Met, Wikimedia, Unsplash): nhận từ khoá, trả `{thumbUrl, fullUrl, sourceUrl, license, author}`; **xếp hạng lại bằng embedding** vì API ngoài không có tìm theo ảnh | Native (HTTP từ Rust để không phụ thuộc CORS) |
| Quyền riêng tư | Mặc định chỉ chạy tầng 1, nguồn ngoài cần bật rõ; từ khoá gửi đi, ảnh thì không | Cài đặt |
| UI | Panel khám phá, tương tác kéo-thả kết quả lên canvas | Frontend, dùng kit Untitled UI theo quy ước repo |

### Phân kỳ và công sức `[Suy luận]`

| Pha | Nội dung | Công sức | Rủi ro chính |
|---|---|---|---|
| 0 | Điều kiện tiên quyết: tải ảnh capture về project, phân tích ảnh (báo cáo capture việc #8) | M | Giấy phép và dung lượng ảnh; xử lý `data:` (#2 trong báo cáo capture) |
| 1a | Tầng 1 bằng **Apple Vision** (không tải model) | M | Không ngữ nghĩa, phụ thuộc phiên bản OS, chỉ macOS |
| 1b | Tầng 1 bằng **ONNX** (DINOv2-small hoặc CLIP/SigLIP) | M-L | Đóng gói/tải model, xác nhận license, `ort` hay WASM trong WKWebView, Apple Silicon |
| 2 | Hai nguồn ngoài đầu tiên (Openverse + Met) và xếp hạng lại | M | Chất lượng kết quả với F&B VN thấp (xem mục 4); cần thử với bộ ảnh thật |
| 3 | Vùng cắt trực tiếp, chip từ khoá, đặt node theo tia | M | UX; ít rủi ro kỹ thuật |
| 4 | Tầng "Mở Pinterest" user-driven | S | Chỉ hợp lệ khi user thao tác từng bước (mục 3) |

Nên làm **1a trước 1b**: 1a cho thấy giá trị trong vài ngày mà không phải quyết chuyện model/license; 1b thay thế khi cần ngữ nghĩa. Đóng bộ giao tiếp ở cùng một interface "embed(image) → vector" để đổi lõi mà không sửa UI.

## 7. Những điều tôi **không** kiểm chứng được

- Nguyên văn điều khoản của Pinterest (bị chặn 406; chỉ có câu trả lời của đội API và nguồn thứ cấp).
- Cơ chế của Pinterest Lens và của plugin Eagle (không công khai); hệ số 60/25/15 của Eagle chỉ từ mô tả nhà cung cấp.
- Chất lượng kết quả thực tế của bất kỳ nguồn nào với ảnh F&B/branding Việt Nam. **Chưa chạy thử thực nghiệm nào**: báo cáo này là khảo sát và thiết kế, không có số đo độ chính xác.
- License của bản ONNX SigLIP2; WebGPU trong WKWebView; độ ổn định của `VNGenerateImageFeaturePrintRequest` giữa các bản macOS.
- Giá, giới hạn, và việc ngừng Bing Visual Search từ nguồn chính thức (chỉ nguồn thứ ba/lưu trữ).
- Hạn mức và điều khoản hiện hành của Openverse, Met, Wikimedia, Unsplash (nguồn thứ ba hoặc chưa đối chiếu).

## 8. Đề xuất

1. **Chốt nguyên tắc pháp lý:** KIRA không tự động hoá và không gọi dịch vụ tìm kiếm của Pinterest; Pinterest chỉ vào qua thao tác của user trong trình duyệt. Cần user (hoặc người có chuyên môn pháp lý) xác nhận sau khi đọc điều khoản nguyên văn.
2. **Làm pha 0 trước:** không có ảnh đã tải về và phân tích thì mọi tìm tương tự đều so tag và màu giả. Việc này có chung lợi ích với riêng tư và độ bền (xem báo cáo capture, #8).
3. **Prototype 2 ngày để đo**, trước khi cam kết pha 1b: cài Apple Vision feature print trên một bộ 200 ảnh F&B thật của user, xem kết quả có "đúng cảm giác" không; so với CLIP/DINOv2 chạy ngoài app bằng script. Nếu Apple Vision đủ, bỏ qua việc đóng gói model.
4. **Hỏi user hai câu:** (a) chấp nhận tải model lần đầu hay chỉ dùng thứ có sẵn trong macOS? (b) nguồn ngoài nào là quan trọng với công việc F&B/branding thực tế (Openverse/Met có thể ít liên quan hơn Behance, Dribbble, Pinterest, vốn đều không có API tìm hợp lệ)?
5. Nếu câu trả lời cho (b) là "chủ yếu Pinterest/Behance": **tầng 2 nên thu hẹp** còn "mở nguồn trong trình duyệt và kéo về", và dồn sức vào tầng 1 cùng luồng capture.

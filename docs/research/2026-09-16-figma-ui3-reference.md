# Figma UI3 — tham chiếu ngôn ngữ thiết kế và bố cục cho KIRA "2026 hơn"

**Câu hỏi:** Nghiên cứu Figma UI3 (redesign 2024) để làm tham chiếu nâng cấp độ hoàn thiện giao diện KIRA. Phạm vi: ngôn ngữ thiết kế và bố cục của UI3 (toolbar, panel, header, menu, minimize UI, icon, selected state, tooltip, action bar, thư viện asset, mode switching, window chrome). Không bao gồm so sánh UI kit (Ark/Park/Magic UI) — Researcher khác làm song song.
**Người yêu cầu:** User, 2026-09-16, theo brief Orchestrator gửi Researcher (session này).
**Commit đã kiểm chứng:** `ad62e763` trên branch `worktree-agent-a8e82fc01ac6c94cf` (không merge/push) — commit này chỉ là điểm neo cho `DESIGN.md`, `PRODUCT.md`, `.claude/skills/kira-controls/SKILL.md` đã đọc; báo cáo này không sửa code app.
**Kết luận ngắn:**
1. Bài học lớn nhất từ UI3 không phải "làm gì" mà là "đừng làm gì": Figma tự thử **panel nổi** trong beta rồi **rút lại**, đúng cái mà bản DESIGN.md hiện tại của KIRA đã tránh (panel phải Kira và Library đã dính mép/không nổi).
2. Toolbar icon-only ở đáy canvas, tooltip tên + phím tắt, "Minimize UI" ẩn hết panel — đúng hướng KIRA đang làm (tool rail đáy, view switcher icon-only); **áp dụng được trực tiếp**, không xung đột Ink & Paper.
3. Figma **không có** slider chỉnh cỡ thumbnail trong Assets panel — đây là lỗ hổng bị người dùng than phiền nhiều năm, không phải mẫu để noi theo; slider của KIRA nên tham chiếu Eagle/Lightroom thay vì Figma.
4. Figma gộp Design/Dev Mode thành **một toggle trong toolbar** (Shift+D), không phải thanh mode ngang hàng — ủng hộ quyết định gộp Edit/Discover/Arrange của KIRA vào menu thay vì giữ thanh riêng.
5. Không tìm được tuyên bố chính thức của Figma về vật liệu cửa sổ macOS; quan sát gián tiếp (không phải xác minh) cho thấy UI3 nghiêng về bề mặt đục hơn, không phải kính — phù hợp hướng KIRA bỏ trong suốt cửa sổ, nhưng đây là suy luận, không phải nguồn xác minh trực tiếp.

---

## 0. Nguồn đã dùng

| # | Nguồn | Ngày truy cập | Loại |
|---|---|---|---|
| 1 | [Inside the Redesigned Figma, Where Your Work Takes Center Stage](https://www.figma.com/blog/behind-our-redesign-ui3/) — Figma Blog, Ryhan Hassan, Joel Miller, KC Oh, 26/6/2024 | 2026-09-16 | Chính thức |
| 2 | [Making the Move to UI3: A Guide to Figma's Next Chapter](https://www.figma.com/blog/making-the-move-to-ui3-a-guide-to-figmas-next-chapter/) — Figma Blog, 25/3/2025 | 2026-09-16 | Chính thức |
| 3 | [Figma on Figma: Our Approach to Designing UI3](https://www.figma.com/blog/our-approach-to-designing-ui3/) — Figma Blog, biên tập Jenny Xie, 1/10/2024 | 2026-09-16 | Chính thức (hậu trường thiết kế) |
| 4 | [Figma 2024: We shipped it, you shaped it](https://www.figma.com/blog/figma-2024-we-shipped-it-you-shaped-it/) — Figma Blog | 2026-09-16 | Chính thức |
| 5 | [UI3 Feedback](https://forum.figma.com/share-your-feedback-26/ui3-feedback-3058) — Figma Forum, thread cộng đồng | 2026-09-16 | Người dùng (không chính thức) |
| 6 | [Shortcut to bring back floating panels in UI3](https://forum.figma.com/suggest-a-feature-11/shortcut-to-bring-back-floating-panels-in-ui3-20189) — Figma Forum | 2026-09-16 | Người dùng |
| 7 | [Allow us to dock/move the new UI3 toolbar](https://forum.figma.com/suggest-a-feature-11/allow-us-to-dock-move-the-new-ui3-toolbar-7861) — Figma Forum | 2026-09-16 | Người dùng |
| 8 | [Better Asset Panel (thumbnail too small)](https://forum.figma.com/archive-21/better-asset-panel-search-through-multiple-libraries-thumbnail-too-small-16254) — Figma Forum | 2026-09-16 | Người dùng |
| 9 | [Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) — Figma Help Center | 2026-09-16 | Chính thức |
| 10 | Eagle Knowledge Base, [Interface - Toolbar](https://en.eagle.cool/article/476-interface-toolbar) | 2026-09-16 | Chính thức (bên thứ ba) |
| 11 | [Lightroom Killer Tips — Grid Thumbnail Sizes](https://lightroomkillertips.com/tip-grid-thumbnail-sizes/); [How to Resize Thumbnails in Lightroom's UI](https://havecamerawilltravel.com/workflow/lightroom-resize-thumbnails/) | 2026-09-16 | Bên thứ ba |
| 12 | [Deciding on Floating Panels](https://midio.com/blog/deciding-on-floating-panels/) — Midio Blog, phân tích bên ngoài về case UI3 | 2026-09-16 | Bên thứ ba (phân tích) |

Đã tìm nhưng **không xác minh được** (đánh dấu rõ trong các mục liên quan): tuyên bố chính thức của Figma về vật liệu/độ trong suốt cửa sổ desktop macOS. Không có bài blog hay Help Center nào của Figma nói trực tiếp về việc này; mọi nhận định ở §5 dưới đây là suy luận từ ảnh chụp cộng đồng, không phải nguồn xác minh.

---

## 1. UI3 thay đổi gì so với UI2

### 1.1 Toolbar
- **Vị trí đổi từ đỉnh sang đáy canvas**, dải mảnh (slim), icon-only. Lý do Figma nêu: "frees up the top, creating a roomier feel overall" và tạo "a standard structure across Figma for easy toggling between products" (Nguồn 1). Tức là mục tiêu chính không phải thẩm mỹ mà là **thống nhất vị trí toolbar giữa Design/Slides/FigJam/Dev Mode** để cơ bắp-nhớ (muscle memory) dùng được xuyên sản phẩm.
- **200 icon vẽ mới** bởi Tim Van Damme, mô tả là "visual explanations of how to interact with the platform" — icon biểu cảm hơn, không còn line-icon thuần tối giản như UI2 (Nguồn 1).
- Một hệ quả gây khó chịu ghi nhận trong cộng đồng: trường corner-radius và các control ngữ cảnh khác **đổi vị trí tuỳ theo cái đang chọn** vì toolbar đỉnh (nơi từng có vị trí cố định) đã bị bỏ — "the removal of the top toolbar in UI3 created challenges because contextual tools had to be moved within the constraints of the UI panels" (tổng hợp từ tìm kiếm, xem thread forum "fix corner radius input in place"). Đây là bài học về chi phí ẩn khi dời toolbar: control ngữ cảnh cần một chỗ neo ổn định.

### 1.2 Panel trái/phải
- **Đã thử panel nổi trong bản beta, rồi rút lại trước khi rollout toàn bộ** — đây là phát hiện quan trọng nhất của báo cáo này, xem §2.
- Panel giờ **resizable và collapsible**; có thể "hide the UI completely, with panels only appearing when needed" (Nguồn 1, 2).
- Panel Properties hỗ trợ **cuộn ngang và section có thể thu gọn** (Nguồn 2).
- Panel nổi (floating) **vẫn tồn tại** nhưng bị giới hạn phạm vi: trong Figma Design chỉ khi bật Minimize UI; mặc định trong FigJam; trong Slides ở chế độ grid view (Nguồn 1, 6). Tức là floating panel không bị xoá hẳn, chỉ bị **thu hẹp về một chế độ tuỳ chọn**, không còn là mặc định.

### 1.3 Header panel và mật độ dòng
- Không tìm được số đo mật độ dòng cụ thể từ Figma (họ không công bố theo kiểu KIRA đang đo). Điều xác minh được: UI3 chuyển hướng ngược lại minimalism thuần — "UI3 introduces visual affordances historically absent: backgrounds on inputs, borders around dropdowns, rounded corners… the interface prioritizes usability, not decoration" (Nguồn 1). Tức là **thêm** một số viền/nền để dễ đọc hơn là bớt, khác hướng KIRA (KIRA đang bớt dòng ở header panel). Không có xung đột — hai app đi từ hai điểm xuất phát khác nhau (Figma từ flat-tối-giản-quá-mức, KIRA từ header nhiều dòng).

### 1.4 Properties panel tổ chức lại
- **Component lên đầu**: control variant/instance được "top billing above attributes like color and size" (Nguồn 1).
- **Gộp toàn bộ layout** (width, height, Auto Layout) vào **một panel**, bỏ tổ chức kiểu `x, y, w, h` cũ để khớp tư duy code-based (Nguồn 1).
- Thử nghiệm đảo thứ tự `x/y` xuống dưới layout nhưng **giữ nguyên vị trí cũ** vì "disrupted muscle memory too much" (Nguồn 1) — một ví dụ khác về chi phí đổi vị trí control quen thuộc.
- **Nhãn property có thể bật/tắt**: "Turn on labels to quickly understand what each control does, or turn them off [to focus on your work]" (Nguồn 1, đã trích trong `DESIGN.md` §5 hiện tại — xác nhận đúng).
- Quyết định đã bị đảo đi đảo lại rồi **quay về gần chỗ cũ**: control "clip content" thử làm toggle, icon button, menu dropdown, cuối cùng "returned to a checkbox — it might have felt like a defeat, arriving in almost the same place where we started" nhưng cập nhật lại hình thức (Nguồn 3). Bài học: không phải mọi control cũ đều sai, đôi khi chỉ cần đánh bóng lại.

### 1.5 Menu chính
- **Actions menu** thay thế Quick Actions của UI2: hỗ trợ tìm bằng ngôn ngữ tự nhiên cho tính năng, cài đặt, tích hợp, cộng phím tắt (Nguồn 2). Gần giống command palette; không phải menu bar truyền thống.

### 1.6 "Minimize UI"
- Không phải nút "ẩn hết" thô: Figma từng thử "Hide UI" thẳng thừng, sau đổi thành **Minimize UI** để giữ toolbar luôn sẵn còn panel chỉ hiện khi cần — giải quyết vấn đề làm việc remote/hybrid cần nhiều màn hình (Nguồn 3).
- Phím tắt: `Shift + \` minimize panel, `Cmd/Ctrl + \` ẩn toàn bộ UI (Nguồn 2). Trích dẫn của chính Figma: "With Minimize UI, the toolbar stays handy, and the design panel appears only when needed, then disappears once I deselect."

### 1.7 Bo góc
Không có con số cụ thể được Figma công bố cho bo góc UI3 (không tìm thấy trong 3 bài blog chính hay Help Center). Điều xác minh được chỉ là xu hướng định tính: UI3 thêm "rounded corners" như một phần của việc thêm affordance thị giác so với UI2 phẳng hơn (Nguồn 1). Không đủ dữ liệu để so số cụ thể với thang bo góc KIRA (`--radius-1..5`).

### 1.8 Bộ icon mới
- 200 icon do Tim Van Damme vẽ riêng cho toolbar, mô tả là cân bằng giữa "visual consistency" và "conveying extremely complex ideas in an often abstract manner" (Nguồn 1). Không có chi tiết kỹ thuật (stroke width, viewBox...) được công bố công khai.

### 1.9 Cách hiện trạng thái selected trên control
Không tìm được tài liệu chính thức mô tả chi tiết cơ chế selected-state (màu, viền, nền) của UI3. Đây là khoảng trống xác minh — mọi mô tả trên mạng chỉ suy từ ảnh chụp/video demo, không phải văn bản chính thức. **Đánh dấu: chưa xác minh**, không đưa vào bảng áp dụng/không áp dụng như một pattern đã kiểm chứng.

### 1.10 Tooltip
Không có bài viết chính thức riêng về hệ tooltip UI3. Suy luận gián tiếp từ mô tả toolbar (tên công cụ + phím tắt xuất hiện khi hover) khớp với những gì KIRA đã làm (tooltip rail: tên + phím tắt, theo `kira-controls` §5) — nhưng đây là suy luận từ hành vi toolbar nói chung, không phải trích dẫn cụ thể.

### 1.11 Context/action bar ngữ cảnh
Việc "clip content", corner-radius và các control khác **di chuyển vị trí tuỳ nội dung đang chọn** (§1.1, §1.4) cho thấy UI3 có một dạng action bar/khối control ngữ cảnh thay đổi theo selection, nhưng Figma không đặt tên riêng hay viết tài liệu chính thức cho khái niệm này như một pattern độc lập.

---

## 2. Phản hồi thực tế sau ra mắt và những gì Figma đã rút lại

Đây là phần có giá trị tham chiếu cao nhất cho KIRA vì trực tiếp trả lời "cái gì đã thử và thất bại."

### 2.1 Panel nổi — thử và rút lại (đã xác minh, nguồn chính thức)
Theo chính Figma (Nguồn 3, tác giả nội bộ): "The team initially launched floating navigation and properties panels but reverted after beta feedback." Lý do cụ thể:
- Panel nổi **chiếm hẹp canvas**, đặc biệt trên màn nhỏ.
- Làm **ruler kém hiệu quả hơn**.
- **Chậm luồng thao tác** (slowed down workflows).

Xác nhận chéo từ cộng đồng (Nguồn 5, 6): "the panels of the new UI can't be attached to the edges. They leave some gaps, wasting the space" và có hẳn thread xin phím tắt để lấy lại panel nổi cũ sau khi Figma đã đổi về docked — cho thấy phản ứng cộng đồng **không đồng nhất**: một nhóm ghét panel nổi (lý do trên), một nhóm khác tiếc panel nổi sau khi bị bỏ. Bài phân tích bên ngoài (Nguồn 12, Midio) gọi đây là ví dụ kinh điển về đánh đổi giữa "không gian canvas tối đa" và "định vị dễ đoán."

**Bài học cho KIRA:** Panel phải Kira và Library drawer của KIRA hiện **đã dính mép** (không nổi giữa canvas), tức là KIRA đã ở phía "an toàn" theo đúng những gì Figma rút kinh nghiệm. Việc user yêu cầu gộp header xuống 1 dòng, ảnh Library to hơn, view switcher icon-only — không đụng tới việc panel có nổi hay không, nên **không có rủi ro lặp lại sai lầm floating-panel của Figma**. Nếu tương lai có ý định làm panel nổi trên canvas (kiểu Minimize UI), nên làm nó là **chế độ tuỳ chọn** (giống Figma cuối cùng chọn: floating chỉ khi Minimize UI bật), không phải mặc định.

### 2.2 Toolbar đáy — gây khó chịu cho nhóm chuyên nghiệp
Phản hồi cộng đồng (Nguồn 5): toolbar dưới đáy **gây vướng khi so màu thiết kế** (nằm đúng chỗ mắt cần nhìn khi làm việc chi tiết ở phần dưới canvas), và có câu hỏi liệu thay đổi này "chỉ có lợi cho người mới" trong khi designer kỳ cựu chủ yếu dùng phím tắt. Không tìm thấy bằng chứng Figma đã rút lại vị trí đáy — họ giữ nguyên, chỉ thêm Minimize UI để giảm phiền. Cũng có yêu cầu cho **dock/di chuyển toolbar tuỳ ý** (Nguồn 7) mà Figma chưa đáp ứng tính đến thời điểm bài viết được tìm thấy.

**Bài học cho KIRA:** tool rail đáy canvas của KIRA giống hướng UI3 (đã chốt Ink & Paper, không đổi). Rủi ro tương tự (vướng tầm nhìn khi thao tác gần đáy canvas) nhỏ hơn ở KIRA vì rail chỉ có nhóm tool tạo node + kết nối, không phải toàn bộ property panel.

### 2.3 Học được: đừng xoá control quen thuộc, hãy đánh bóng nó
Câu chuyện "clip content" (Nguồn 3) — thử 3 phương án mới rồi quay về checkbox — và việc giữ `x/y` phía trên layout dù có lý do lý thuyết để đảo (Nguồn 1) đều là cùng một bài học: **muscle memory của người dùng lâu năm là chi phí thật**, không phải cảm tính. Việc KIRA gộp Edit/Discover/Arrange vào menu là một thay đổi vị trí tương tự — nên có đường tắt bàn phím hoặc menu dễ tìm để người dùng cũ (nếu có) không mất thao tác quen, dù KIRA còn nhỏ nên rủi ro muscle-memory thấp hơn Figma.

### 2.4 Học được: label có thể ẩn nhưng phải giữ accessibility
Figma từng làm nhãn tối giản rồi phát hiện **hỏng screen reader**, phải quay lại nhãn đầy đủ ngữ cảnh (Nguồn 3). Nếu KIRA làm view switcher/tool rail icon-only, phải đảm bảo `aria-label` đầy đủ ngay cả khi nhãn chữ bị ẩn khỏi mắt — đây không phải điều mới với KIRA (skill `kira-controls` §6.2 đã yêu cầu `aria-label` trên icon rail), chỉ là xác nhận thêm từ trải nghiệm thật của Figma.

---

## 3. Thư viện asset/ảnh của Figma — đối chiếu yêu cầu "ảnh to hơn + slider"

**Xác minh được:** Figma **không có** cơ chế slider chỉnh cỡ thumbnail trong Assets panel. Đây là một phàn nàn tồn tại nhiều năm trên forum, chưa được Figma giải quyết:
- "The preview image in the Assets panel is considered too small, making it difficult to differentiate between components" (Nguồn 8, thread "Better Asset Panel — thumbnail too small").
- Assets panel gộp kết quả tìm kiếm từ mọi thư viện đang bật, không nhóm theo thư viện trừ khi lọc thủ công; có yêu cầu filter theo thư viện đã được đáp ứng một phần (Nguồn 8) nhưng cỡ thumbnail thì chưa.
- Bản UI3 mới có "refreshed libraries modal [that] allows you to browse and add libraries faster" (Nguồn 2) — cải thiện tốc độ duyệt, **không phải** cải thiện cỡ hiển thị.

**Kết luận cho KIRA:** yêu cầu "ảnh Library to hơn + slider chỉnh kích thước" **không nên tham chiếu Figma** — Figma chính là ví dụ phản diện (complaint chưa được giải quyết trong nhiều năm). Nên tham chiếu app chuyên về thư viện ảnh:
- **Eagle:** "The slider in the middle of the toolbar can adjust the image display size. You can drag the slider to adjust the size of the thumbnails or use the hotkey ⌘+= / ⌘+-… slider is designed in a non-linear range" (Nguồn 10) — slider phi tuyến (non-linear) đáng chú ý: bước nhỏ ở cỡ nhỏ, bước lớn ở cỡ lớn, giúp điều chỉnh mượt hơn dải giá trị rộng.
- **Lightroom:** "The Thumbnails slider is on the right-hand side of the Toolbar… drag to the right to enlarge or to the left to reduce" (Nguồn 11) — slider nằm cố định ở toolbar dưới, luôn thấy được, không ẩn trong menu.
- **Finder** (kiến thức phổ thông về macOS, không có nguồn báo chí riêng cho thao tác này): thanh trượt cỡ icon nằm ở status bar dưới cùng cửa sổ, tương tự vị trí Lightroom.
- **Milanote:** không xác minh được cơ chế slider cụ thể qua tìm kiếm lần này; không đưa vào so sánh để tránh suy đoán.

Gợi ý áp dụng cho KIRA (suy luận, không phải trích dẫn): đặt slider cỡ thumbnail Library **cố định trong thanh công cụ của drawer** (giống Eagle/Lightroom), không giấu trong popover, và cân nhắc bước phi tuyến nếu dải cỡ ảnh rộng.

---

## 4. Mode switching của Figma (Design / Dev Mode / Draw) — đối chiếu quyết định bỏ Edit/Discover/Arrange

**Xác minh được:**
- Figma Design có **Design Mode** và **Dev Mode**, chuyển bằng **một toggle nằm trong toolbar** hoặc phím tắt `Shift+D` (Nguồn 9, và kết quả tìm kiếm tổng hợp từ Help Center/Steve Kinney's course). Không phải thanh ngang hàng nhiều mode như tab — Dev Mode giống một **trạng thái bật/tắt** làm đổi cả canvas (read-only khi bật) lẫn panel phải (chuyển sang inspect).
- "Making the Move to UI3" xác nhận: "Dev Mode access now appears directly in the toolbar, making it easier to switch between modes" (Nguồn 2) — tức là bản thân việc **đưa access-point của mode vào toolbar chung** (thay vì một thanh mode riêng, tách biệt về mặt bố cục) là quyết định thiết kế có chủ đích của Figma.
- Figma Slides có khái niệm "design mode" riêng biệt (Nguồn tìm kiếm: Help Center "Use design mode in Figma Slides") nhưng đây là mode của **một sản phẩm khác** (Slides), không liên quan trực tiếp tới Design/Dev Mode switch bàn ở trên. Không tìm thấy "Draw mode" như một khái niệm UI3 riêng trong các nguồn đã đọc — có thể user đang nhớ nhầm với công cụ vẽ tay tự do (pen/marker tool) chứ không phải một "mode" cấp toolbar; **đánh dấu: chưa xác minh, cần user xác nhận nếu ý là tính năng khác.**

**Kết luận cho KIRA:** quyết định của user bỏ thanh mode Edit/Discover/Arrange (gộp vào menu) **cùng hướng** với cách Figma xử lý Design/Dev Mode: không giữ một dải ngang hàng, thường trực chiếm chỗ, mà nén vào một điểm truy cập trong toolbar/menu chung. Khác biệt cần lưu ý: Dev Mode của Figma đổi **toàn bộ hành vi tương tác** (canvas read-only), nên xứng đáng có một toggle luôn hiện trong toolbar (mức độ quan trọng cao). Nếu Edit/Discover/Arrange của KIRA cũng đổi hành vi tương tác canvas ở mức tương đương (không chỉ đổi panel phụ), nên cân nhắc giữ **một điểm truy cập rõ trong menu** (không chỉ chôn sâu), tương tự vị trí Dev Mode toggle trong toolbar Figma — đây là gợi ý, không phải luật, vì KIRA chưa công bố spec chi tiết Edit/Discover/Arrange đổi gì trong scope báo cáo này.

---

## 5. Nền cửa sổ/chrome trên macOS desktop app

**Không xác minh được bằng nguồn chính thức.** Đã tìm các từ khoá liên quan (vibrancy, opaque, transparent, title bar material) trên Figma Blog và Help Center, không có bài viết nào của Figma mô tả trực tiếp vật liệu cửa sổ ứng dụng desktop của chính họ. Các kết quả tìm được đều là:
- Tài nguyên **UI kit macOS cho Figma** (Nguồn liên quan macOS Big Sur/macOS 26/27 kits) — đây là người dùng vẽ mockup macOS *trong* Figma, không phải mô tả app Figma thật.
- Một thảo luận về giới hạn kỹ thuật khi mô phỏng vibrancy: "the vibrancy/transparency tries to be as realistic as possible, but macOS Window Server uses GPU shaders to render transparency effects, which means it's currently impossible to fully replicate these treatments in Figma" — nói về việc Figma (như công cụ thiết kế) khó mô phỏng vibrancy macOS trong canvas thiết kế, **không phải** phát biểu về app Figma tự dùng vibrancy hay không.

**Suy luận (không phải xác minh):** Figma là ứng dụng desktop dựng trên Electron (kiến thức phổ thông về kiến trúc Figma, không tìm lại nguồn trong phiên này), và các ảnh chụp UI3 lưu hành công khai cho thấy toolbar/panel là bề mặt đục màu tối/sáng phẳng, không có hiệu ứng trong suốt kiểu vibrancy của app native macOS. Định hướng UI3 rời xa "glassmorphism-as-decoration" (thêm nền, viền, bo góc thay vì trong suốt, theo Nguồn 1 mục 1.3) cũng gián tiếp ủng hộ suy luận này. Nhưng vì không có trích dẫn trực tiếp, **không đưa mục này vào bảng áp dụng ở §6 như một pattern đã kiểm chứng** — chỉ ghi nhận rằng quyết định "bỏ trong suốt cửa sổ macOS" của KIRA **không mâu thuẫn** với xu hướng chung quan sát được ở UI3, và KIRA có nguồn nội bộ mạnh hơn cho quyết định này (DESIGN.md §6, "The Material-On-Chrome Rule": trong suốt chỉ ở chrome nổi trên canvas, cửa sổ/panel/dialog luôn đục) nên không cần dựa vào Figma để quyết.

---

## 6. Bảng Áp dụng / Không áp dụng theo từng surface KIRA

| Surface KIRA | Pattern UI3 tương ứng | Áp dụng? | Lý do | Ưu tiên |
|---|---|---|---|---|
| **Tool rail đáy canvas** | Toolbar đáy, icon-only, tooltip tên + phím tắt (§1.1) | **Áp dụng** (đã làm, giữ nguyên) | KIRA đã ở đúng vị trí UI3 hội tụ về; tool rail nhỏ hơn toàn bộ property panel nên rủi ro "vướng tầm nhìn khi thao tác gần đáy" (§2.2) thấp hơn | Thấp (không cần đổi) |
| **Tool rail đáy canvas** | Control ngữ cảnh đổi vị trí theo selection, gây khó tìm ở UI3 (§1.1, §1.4) | **Không áp dụng** — cảnh báo | Rail KIRA cố định theo nhóm (Chọn / tạo node / kết nối, `kira-controls` §5), không nên để vị trí tool phụ thuộc selection hiện tại; giữ rail tĩnh là đúng, tránh lặp lỗi Figma | Cao (giữ nguyên, không đổi theo hướng UI3 ở điểm này) |
| **View switcher (Bảng vẽ/3D/Trình chiếu/Dàn ý)** | Toggle mode gọn trong toolbar thay vì thanh mode riêng (Dev Mode, §4) | **Áp dụng một phần** | Icon-only + tooltip khớp hướng UI3; khác biệt: view switcher KIRA chuyển *view* (không đổi hành vi edit toàn app như Dev Mode), nên mức "phải luôn nổi bật" thấp hơn — icon-only nhỏ gọn là đủ, không cần độ nổi bật ngang Dev Mode toggle | Trung bình |
| **Thanh mode Edit/Discover/Arrange → gộp vào menu** | Design/Dev Mode nén thành 1 toggle trong toolbar, không phải thanh ngang hàng riêng (§4) | **Áp dụng, ủng hộ quyết định đã có** | Cùng logic: không giữ dải chiếm chỗ thường trực cho thứ ít khi đổi; nếu Edit/Discover/Arrange đổi hành vi tương tác canvas mạnh (như Dev Mode), cân nhắc giữ 1 điểm truy cập rõ trong menu, không chôn quá sâu | Trung bình (cần Worker xác nhận mức đổi hành vi thực tế trước khi định vị trí menu) |
| **Library drawer (ảnh to hơn + slider cỡ)** | Figma Assets panel: thumbnail nhỏ, không có slider, complaint nhiều năm chưa sửa (§3) | **Không áp dụng Figma** — tham chiếu Eagle/Lightroom thay | Figma là ví dụ phản diện ở đúng điểm này; Eagle (slider phi tuyến giữa toolbar) và Lightroom (slider cố định bên phải toolbar) là mẫu tốt hơn cho đúng yêu cầu user | Cao |
| **Library drawer** | "Refreshed libraries modal… browse and add libraries faster" (§1.2, §3) | **Áp dụng tinh thần, không áp dụng chi tiết** | Không có chi tiết UI cụ thể được công bố để copy; chỉ giữ nguyên tắc "duyệt nhanh hơn" làm mục tiêu, không có pattern cụ thể để chép | Thấp |
| **Panel phải Kira (dock/panel AI)** | Panel nổi bị thử và rút lại vì chiếm canvas, hại ruler, chậm luồng (§2.1) | **Không áp dụng (giữ dính mép)** — xác nhận hướng hiện tại đúng | KIRA panel phải đã dính mép, đúng kết luận cuối cùng của Figma sau khi thử floating; không có lý do đổi sang nổi trừ khi làm chế độ Minimize-UI-style tuỳ chọn | Cao (giữ nguyên) |
| **Panel phải Kira — header 1 dòng** | Nhãn property có thể bật/tắt để gọn cho người quen việc (§1.4, đã trích trong DESIGN.md §5) | **Áp dụng đúng hướng đã ghi trong DESIGN.md** | Xác nhận lại nguồn: đúng là Figma Blog 26/6/2024 nói về việc này, không phải suy diễn | Đã chốt, không cần đổi thêm |
| **Menu canvas (Actions menu kiểu Figma)** | Actions menu thay Quick Actions: tìm bằng ngôn ngữ tự nhiên, phím tắt (§1.5) | **Tham khảo dài hạn, không cấp thiết cho đợt sửa hiện tại** | Không nằm trong 5 góp ý user liệt kê đợt này; ghi nhận làm ý tưởng cho lần sau nếu KIRA muốn thêm command palette | Thấp |
| **Settings** | Properties panel gộp control liên quan theo tác vụ, không theo loại control (§1.4) | **Áp dụng, đã có luật tương ứng** | Đây chính là nội dung §5 DESIGN.md đã trích dẫn từ trước; báo cáo này chỉ xác nhận lại nguồn chính xác, không đổi luật | Đã chốt |
| **Dock Kira** | Không có pattern UI3 tương ứng trực tiếp (dock chat không tồn tại trong Figma) | **Không áp dụng — không có tham chiếu** | Không ép một pattern không tồn tại; giữ theo Ink & Paper hiện có | N/A |
| **Chrome cửa sổ (bỏ trong suốt macOS)** | Xu hướng UI3 rời glass-as-decoration sang thêm nền/viền đục (§1.3, §5) | **Áp dụng như xác nhận gián tiếp, không phải bằng chứng chính** | Không tìm được tuyên bố chính thức về vật liệu cửa sổ Figma; quyết định KIRA nên dựa vào DESIGN.md §6 "Material-On-Chrome Rule" (nguồn nội bộ mạnh hơn), UI3 chỉ là tín hiệu cùng chiều, không phải căn cứ | Thấp (không cần UI3 để quyết, chỉ để yên tâm không đi ngược xu hướng) |

---

## 7. Xung đột với Ink & Paper — không có xung đột lớn

Không phát hiện điểm nào của UI3 (đã xác minh) xung đột trực tiếp với hệ Ink & Paper đã chốt (`docs/research/2026-09-14-art-direction-controls-v2.md`, specimen `v2/controls-v2.html`). Hai khác biệt cần user lưu ý, không phải "xung đột" mà là "khác triết lý có chủ đích":

1. **Màu control:** UI3 không công bố quy tắc kiểu "một màu nghĩa duy nhất" như The One Accent Rule của KIRA — Figma dùng xanh dương làm accent chọn lựa xuyên suốt UI (kiến thức phổ thông về brand Figma, không xác minh lại trong phiên này vì ngoài phạm vi câu hỏi). KIRA cố tình thu hẹp nghĩa của teal chỉ còn selection/focus/state, tách biệt khỏi "primary button". Đây là lựa chọn KIRA đã có lý do riêng (R2 §E), không cần đổi theo Figma.
2. **Icon:** UI3 dùng một họ icon biểu cảm duy nhất (200 icon Tim Van Damme) cho toàn bộ toolbar; KIRA cố tình tách hai họ (rail = dụng cụ có màu, glyph UI = Lucide đơn sắc, `kira-controls` §6.1). Không phải xung đột — chỉ khác đối tượng: Figma không phân biệt "công cụ" và "chữ" trong toolbar theo cách KIRA làm.

Không có mục nào trong 5 góp ý mới của user (header 1 dòng, ảnh Library to hơn + slider, bỏ thanh mode, view switcher icon-only, bỏ trong suốt cửa sổ) đòi hỏi phá luật Ink & Paper hiện có.

---

## 8. Việc chưa làm / giới hạn của báo cáo

- Không xác minh được cơ chế selected-state cụ thể (màu/viền) trên control UI3 — Figma không công bố chi tiết đủ để trích dẫn chắc chắn (§1.9).
- Không xác minh được "Draw mode" mà user brief có nhắc — có thể là nhầm với công cụ vẽ tự do, không phải một mode cấp toolbar riêng của UI3 (§4).
- Không xác minh được vật liệu cửa sổ macOS thật của Figma desktop app bằng nguồn chính thức (§5) — chỉ có suy luận từ xu hướng chung.
- Không kiểm tra Milanote cho ví dụ slider thư viện (không tìm được nguồn đủ tin cậy trong thời gian nghiên cứu).
- Chưa xem trực tiếp ảnh chụp UI3 (không có quyền truy cập app Figma thật trong phiên này) — mọi mô tả hình ảnh trong báo cáo này diễn giải từ văn bản nguồn, không phải quan sát trực tiếp của Researcher.

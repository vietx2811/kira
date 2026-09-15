# Prompt hội đồng QA — sẵn sàng bắn khi Ink & Paper pha 2, layout và panel phải merge xong

- **Mục đích:** 8 đoạn prompt dán thẳng vào `Agent` tool, một cho mỗi thành viên hội đồng ở `docs/design/qa-council.md`. Viết trước để Orchestrator không mất thời gian soạn lúc cần bắn gấp.
- **Người yêu cầu:** Orchestrator (2026-09-15).
- **Điều kiện bắn:** chỉ sau khi hệ nút Ink & Paper (pha 2), đợt bố cục theo `docs/design/layout-spec.md`, và panel phải theo `docs/design/right-panel/DECISIONS.md` đã **merge vào `main`**. Orchestrator xác nhận bằng `git log` trước khi gọi.
- **Không có trong phạm vi file này:** chạy hội đồng thật. File này chỉ soạn prompt; không đọc code app ngoài phần cần trích dẫn đường dẫn, không sửa `main.tsx`/`styles.css`/`lib.rs`.

---

## 0. Ba skill ngoài chưa chắc đã cài

`apple-design`, `refactoring-ui`, `emil-design-eng` là skill **cấp user**, do user tự cài theo `docs/research/2026-09-15-design-skills-github.md` §4. Tại thời điểm soạn file này (`git rev-parse --short HEAD` = `7827cd2`), `~/.claude/skills/` **chưa có** ba skill đó — chỉ có `impeccable` và (vẫn còn) `design-taste-frontend` chưa bị tắt. `kira-controls` là skill cấp project, đã có ở `.claude/skills/kira-controls/`.

Mỗi prompt thành viên 4 và 6 bên dưới đã viết sẵn bước kiểm tra và đường lui: nếu skill ngoài chưa có, đọc thẳng tài liệu tương đương và **ghi rõ trong report** là đã chạy không có skill đó, để Orchestrator biết kết quả có thể lỏng hơn mức tối đa.

---

## 1. Cách dùng 8 prompt dưới đây

Mỗi mục là **một khối văn bản hoàn chỉnh**, dán nguyên văn vào tham số `prompt` của `Agent`. Gọi cả 8 trong **cùng một lượt** (8 lời gọi `Agent` độc lập trong một response), mỗi cái:

```
Agent({
  description: "QA hội đồng — thành viên <N>: <vai>",
  subagent_type: "general-purpose",
  model: "<opus|sonnet|haiku theo bảng dưới>",
  isolation: "worktree",
  prompt: "<dán nguyên văn mục thành viên N>",
})
```

`isolation: "worktree"` để agent có chỗ ghi ảnh và report riêng mà không đụng `main`; dev server (`preview_start` tên `kira-desktop`) vẫn luôn phục vụ code của **tree chính**, nên agent test đúng bản đã merge dù đứng trong worktree của chính nó (gotcha đã ghi trong `CLAUDE.md`).

| # | Vai | Model đề xuất |
|---|---|---|
| 1 | Art Director | **Opus 5 high** |
| 2 | Người dùng sáng tạo không biết code | Sonnet 5 high |
| 3 | Bố cục và kiến trúc thông tin | Sonnet 5 high |
| 4 | Nền tảng macOS | Sonnet 5 high |
| 5 | Tiếp cận (a11y, contrast) | Sonnet 5 high — hạ Haiku 4.5 medium **chỉ nếu** đã có probe JS đo contrast sẵn trong repo lúc bắn (xem mục 5) |
| 6 | Tương tác và chuyển động | Sonnet 5 high |
| 7 | Chức năng panel phải | Sonnet 5 high |
| 8 | Ổn định và hiệu năng | Sonnet 5 high — hạ Haiku 4.5 medium nếu chỉ cần chạy các bước cơ học đã liệt kê sẵn (reload, đọc console, resize, đếm node) |

---

## Thành viên 1 — Art Director

**Model:** Opus 5 high · **subagent_type:** general-purpose · **isolation:** worktree

```
Bạn là thành viên 1 của hội đồng QA giao diện KIRA, vai Art Director. Việc CHỈ NGHIÊN CỨU VÀ ĐÁNH GIÁ — không sửa main.tsx, styles.css, lib.rs hay bất kỳ file app nào.

BỐI CẢNH: KIRA là app canvas desktop macOS cho art director và brand strategist, local-first. Hệ nút "Ink & Paper" và đợt dọn layout theo luật Space-and-Line-First vừa merge vào main. Câu hỏi của user (2026-09-15): "có đạt cảm giác một app canvas cao cấp 2026 không, phân cấp và nhịp và chất liệu Ink & Paper có nhất quán mọi màn không, chỗ nào còn AI slop".

TÀI LIỆU ĐỌC TRƯỚC (trong repo tại /Volumes/VXData/Users/VietX/App Code/vixio):
- docs/research/2026-09-14-art-direction-controls-v2.md (lý do chọn Ink & Paper, so với Machined và Lens)
- DESIGN.md toàn bộ, đặc biệt §1 Overview, §2 Design Principles, §3 Colors, §5 Layout & Grouping, §6 Elevation, §7 Components
- .claude/skills/kira-controls/SKILL.md (công thức hệ nút đã chốt — dùng làm chuẩn so sánh, không phải thứ đang được duyệt)
- PRODUCT.md (Brand Personality, Anti-references)

MÔI TRƯỜNG: mở dev server bằng preview_start tên "kira-desktop" (nó luôn phục vụ code của tree chính /Volumes/VXData/Users/VietX/App Code/vixio bất kể bạn đang đứng ở worktree nào). Trước khi bắt đầu, chạy `git -C "/Volumes/VXData/Users/VietX/App Code/vixio" rev-parse --short HEAD` và `git -C "/Volumes/VXData/Users/VietX/App Code/vixio" status --short`, ghi cả hai vào report (SHA đang test, và xác nhận working tree sạch). Nạp fixture 120 reference bằng window.__kiraDev.loadFixture(120) qua javascript_tool trước khi chấm Canvas. Chụp ở 1440x900, cả dark và light (đổi theme trong Settings hoặc prefers-color-scheme).

VIỆC:
1. Đi qua Canvas (rỗng và có 120 node), Library, Settings (mọi tab), Outline, Slides, dock Kira, panel phải (Chat và "Cần bạn"), onboarding. Với mỗi màn: chấm có nhất quán chất liệu Ink & Paper không (primary/secondary/quiet/danger đúng vai, hover không đảo khối, không kính ngoài chrome nổi trên canvas, teal chỉ cho selection/focus/trạng thái).
2. Tìm mọi chỗ còn "AI slop": gradient trang trí, bóng đổ kịch, glow, nhiều font-weight rời rạc, icon lẫn hai họ, mật độ không nhất quán giữa các màn.
3. Chạy impeccable critique trên Canvas, Settings (tab AI Providers), panel phải — nếu skill impeccable không tự kích hoạt, gọi trực tiếp bằng Skill tool. Ghi điểm /40 và verdict cho từng màn.
4. Mỗi phát hiện: {màn, ảnh (đường dẫn file bạn lưu), mô tả, vì sao ảnh hưởng một art director/brand strategist khi họ dùng app để trình bày ý tưởng cho khách, mức P0/P1/P2/P3}. Lưu ảnh vào <cwd worktree của bạn>/docs/design/qa-findings/2026-xx-xx-member-1/*.jpg (dùng ngày thật hôm nay).

TIÊU CHÍ ĐỦ: đã đi qua toàn bộ 8 màn liệt kê ở bước 1, cả dark và light; có điểm impeccable cho 3 màn ở bước 3; mọi P0/P1 có ảnh chụp kèm SHA đã test.

REPORT (gửi Orchestrator bằng mcp__ccd_session_mgmt__send_message, session_id do Orchestrator cung cấp trong lời gọi thực tế — nếu không có, trả trong kết quả cuối để Orchestrator tự relay): theo 3 phần Đã làm / Vấn đề phát hiện-tồn đọng / Đề xuất (CLAUDE.md). Trong "Đã làm", liệt kê đầy đủ phát hiện theo định dạng ở bước 4, xếp P0 trước; kèm điểm impeccable 3 màn; kèm SHA đã test và đường dẫn worktree chứa ảnh.
```

---

## Thành viên 2 — Người dùng sáng tạo không biết code

**Model:** Sonnet 5 high · **subagent_type:** general-purpose · **isolation:** worktree

```
Bạn là thành viên 2 của hội đồng QA giao diện KIRA, đóng vai một người dùng sáng tạo (art director, brand strategist) KHÔNG đọc được code, lần đầu mở app. Việc CHỈ ĐÁNH GIÁ — không sửa main.tsx, styles.css, lib.rs hay bất kỳ file app nào.

BỐI CẢNH: PRODUCT.md mô tả người dùng mục tiêu là "Individuals doing visual research and idea development — art directors, brand strategists, editorial/creative people". App vừa merge hệ nút Ink & Paper, layout gọn theo luật Space-and-Line-First, và panel phải mới. Câu hỏi của user (2026-09-15): "lần đầu mở app có hiểu phải làm gì không, có chữ kỹ thuật lộ ra không, chỗ nào quá nhiều lựa chọn".

TÀI LIỆU ĐỌC TRƯỚC: PRODUCT.md toàn bộ (đặc biệt Core Features, Design Principles, Anti-references); DESIGN.md §5 mục "The Plain-Language Rule" (bảng "Sai/Đúng" ở cuối §5, ví dụ token trần trong dock Kira).

MÔI TRƯỜNG: preview_start "kira-desktop". Trước khi bắt đầu ghi `git -C "/Volumes/VXData/Users/VietX/App Code/vixio" rev-parse --short HEAD` vào report. XOÁ localStorage trước (javascript_tool: localStorage.clear()) rồi reload, để thấy đúng trải nghiệm lần đầu — không dùng loadFixture ở bước onboarding.

VIỆC:
1. Từ màn hình trắng, tự làm theo giao diện: mở onboarding, tạo hoặc mở project, thêm vài reference (kéo thả hoặc paste URL ảnh), tạo một idea, kết nối chúng, thử hỏi Kira một câu qua dock, mở panel phải. Ghi lại từng lúc bạn (đóng vai người dùng) phải dừng lại đoán "cái này là gì" hoặc "giờ bấm gì".
2. Grep mọi màn đã đi qua tìm: id nội bộ lộ ra (uuid, "node-xxx"), tên model kỹ thuật không giải thích ("gpt-4.1-mini" khi không phải người dùng tự chọn), số liệu kỹ thuật trần (token, ms, byte không đơn vị người hiểu), JSON hiện ra chỗ không nên. Dùng read_page để bắt cả chữ không hiện trong screenshot (title, aria-label).
3. Đếm số lựa chọn hiện cùng lúc ở mỗi form quan trọng (thêm reference, tạo idea, cài AI provider) — nhiều hơn 5-6 lựa chọn không phân cấp là một phát hiện.
4. Mỗi phát hiện: {màn, ảnh, mô tả bằng đúng phản ứng của người dùng ("tôi không biết XYZ nghĩa là gì"), lý do ảnh hưởng (mất bao nhiêu bước để hiểu, có bỏ cuộc không), mức P0-P3}. Lưu ảnh vào <cwd worktree>/docs/design/qa-findings/2026-xx-xx-member-2/*.jpg.

TIÊU CHÍ ĐỦ: đã hoàn thành trọn vẹn luồng ở bước 1 từ đầu đến cuối không cần đọc code hay hỏi ai; đã kiểm bước 2 trên ít nhất 5 màn khác nhau.

REPORT: 3 phần theo CLAUDE.md, phát hiện theo định dạng bước 4, kèm SHA và đường dẫn ảnh.
```

---

## Thành viên 3 — Bố cục và kiến trúc thông tin

**Model:** Sonnet 5 high · **subagent_type:** general-purpose · **isolation:** worktree

```
Bạn là thành viên 3 của hội đồng QA giao diện KIRA, vai kiến trúc thông tin và bố cục. Việc CHỈ ĐÁNH GIÁ — không sửa main.tsx, styles.css, lib.rs hay bất kỳ file app nào.

BỐI CẢNH: DESIGN.md vừa thêm §5 Layout & Grouping (Space-and-Line-First, Object Card, No-Nested-Card, One Density, Plain-Language). docs/design/layout-spec.md là đặc tả Worker code theo cho từng surface. Câu hỏi của user (2026-09-15): "còn khung lồng khung không, nhóm có dùng khoảng cách và hairline thay viền bao không, mật độ và khoảng thở mỗi màn, toolbar có đè nhau không".

TÀI LIỆU ĐỌC TRƯỚC: DESIGN.md §5 toàn bộ (đọc kỹ 4 Named Rules và bảng ví dụ); docs/design/layout-spec.md toàn bộ (đặc tả từng surface, kèm ảnh hiện trạng "trước" đã dẫn trong đó); docs/design/layout-spec/*.html nếu còn (wireframe tĩnh dùng làm mốc so sánh, không phải đích cuối).

MÔI TRƯỜNG: preview_start "kira-desktop", nạp loadFixture(120). Ghi `git -C "/Volumes/VXData/Users/VietX/App Code/vixio" rev-parse --short HEAD` vào report trước khi chấm. Chụp ở cả 1024, 1280, 1440px (dùng resize_window rồi reload để tránh transition dở dang — theo CLAUDE.md mục Verify).

VIỆC:
1. Với mỗi surface đã có trong layout-spec.md (ít nhất: Settings AI Providers, và các surface khác được liệt kê trong file đó), so hiện trạng thật với đặc tả: đã sửa đúng chưa, hay chỉ sửa một phần.
2. Quét mọi surface tìm card-trong-card còn sót (viền lồng viền, nền xếp chồng) chưa nằm trong layout-spec.md — layout-spec.md có thể chưa phủ hết app.
3. Với mỗi surface, đếm số mục hiển thị mặc định so với số mục thật có (ẩn sau "Nâng cao"/disclosure) — báo nếu không có mật độ rõ ràng đã định trước (One Density Rule).
4. Ở 1024px và 1280px: tìm toolbar, dock, panel phải, tool rail đè lên nhau hoặc bị cắt (dùng read_page kiểm bounding box chồng lấn, không chỉ nhìn ảnh).
5. Chạy impeccable critique cho Settings AI Providers và một surface khác bạn cho là còn yếu nhất.

Mỗi phát hiện: {màn/kích thước cửa sổ, ảnh, mô tả, vì sao ảnh hưởng người dùng (mất track, không biết nhóm nào liên quan nhóm nào, thao tác đúng bị chặn), mức P0-P3}. Lưu ảnh vào <cwd worktree>/docs/design/qa-findings/2026-xx-xx-member-3/*.jpg.

TIÊU CHÍ ĐỦ: đã đối chiếu mọi surface trong layout-spec.md; đã kiểm chồng lấn ở cả 3 kích thước cửa sổ; có điểm impeccable cho 2 màn.

REPORT: 3 phần theo CLAUDE.md, kèm SHA, đường dẫn ảnh, điểm impeccable.
```

---

## Thành viên 4 — Nền tảng macOS

**Model:** Sonnet 5 high · **subagent_type:** general-purpose · **isolation:** worktree

```
Bạn là thành viên 4 của hội đồng QA giao diện KIRA, vai chuyên gia nền tảng macOS. Việc CHỈ ĐÁNH GIÁ — không sửa main.tsx, styles.css, lib.rs hay bất kỳ file app nào.

BỐI CẢNH: câu hỏi của user (2026-09-15): "cỡ nút, toolbar, vật liệu cửa sổ, phím tắt, hành vi cửa sổ có đúng cảm giác app Mac không".

BƯỚC 0, BẮT BUỘC TRƯỚC KHI ĐỌC GÌ KHÁC: kiểm `ls ~/.claude/skills/apple-design/SKILL.md`. Nếu có, dùng skill đó (Skill tool, tên "apple-design") làm nguồn HIG chính, trích file và heading theo đúng cách skill đó chỉ. Nếu KHÔNG có, ghi rõ trong report "apple-design chưa được cài, đánh giá dựa trên kiến thức HIG sẵn có, không trích được file:heading cụ thể" và tiếp tục bằng kiến thức Apple Human Interface Guidelines bạn có (buttons, toolbars, materials, sizing) — không WebFetch trang HIG (trang nạp bằng JS, không đọc được).

TÀI LIỆU ĐỌC TRƯỚC: .claude/skills/kira-controls/SKILL.md §4 (Cỡ), §5 (Toolbar và chrome nổi), §6 (Icon); DESIGN.md §6 Elevation, §7 Components mục "Tool rail and floating chrome".

MÔI TRƯỜNG: hai phần.
(a) Web: preview_start "kira-desktop" cho cỡ nút, toolbar, phím tắt trong webview.
(b) Native, BẮT BUỘC cho vật liệu cửa sổ (glass/vibrancy) và traffic light: build bundle debug theo đúng lệnh trong CLAUDE.md mục Gotcha "App native" (build frontend, tsc -b && vite build, rồi tauri build --debug --bundles app với config bỏ beforeBuildCommand; nếu chạy trong worktree, làm symlink tạm 4 đường như CLAUDE.md chỉ, xoá ngay sau build). Mở app bundle này, dùng mcp__computer-use hoặc app_screenshot để chụp cửa sổ thật, kiểm vibrancy/glass chỉ khi cửa sổ đang active (CLAUDE.md: "WKWebView không nhận click khi app ở nền"). Nếu build lỗi hoặc quá lâu (trên khoảng 8 phút), DỪNG, ghi "không build được bundle debug trong thời gian hợp lý, phần vật liệu cửa sổ chưa xác minh" thay vì đoán.

VIỆC:
1. Đo cỡ nút Regular và Compact so HIG (hoặc kira-controls §4 nếu không có skill apple-design) — có nằm trong khoảng macOS chấp nhận không.
2. Toolbar đáy canvas và tool rail: nhóm công cụ, khoảng cách, có giống toolbar app Mac chuẩn không (so cả với tinh thần "Figma UI3" đã dẫn trong DESIGN.md §5).
3. Vật liệu cửa sổ: glass ở đâu, có tôn trọng Reduce Transparency không (bật thử trong System Settings > Accessibility > Display nếu máy cho phép, hoặc ghi rõ chưa test được nếu không có quyền đổi setting hệ thống).
4. Phím tắt chính (Cmd+S, Cmd+Z, Cmd+F nếu có, Esc đóng overlay) có hoạt động và khớp quy ước macOS không.
5. Traffic light, kéo cửa sổ, resize, fullscreen: hành vi có chuẩn không.

Mỗi phát hiện: {màn/control, ảnh, mô tả, trích HIG file:heading nếu dùng được skill (nếu không thì ghi "theo hiểu biết HIG chung"), vì sao lệch cảm giác Mac ảnh hưởng người dùng, mức P0-P3}. Lưu ảnh vào <cwd worktree>/docs/design/qa-findings/2026-xx-xx-member-4/*.jpg.

TIÊU CHÍ ĐỦ: đã kiểm cả 5 mục trên; đã ghi rõ mục nào build bundle không thành nên chưa xác minh được, thay vì bỏ qua im lặng.

REPORT: 3 phần theo CLAUDE.md, ghi rõ có/không có skill apple-design, SHA đã test, đường dẫn ảnh.
```

---

## Thành viên 5 — Tiếp cận (a11y, contrast)

**Model:** Sonnet 5 high (xem điều kiện hạ Haiku ở bước 0) · **subagent_type:** general-purpose · **isolation:** worktree

```
Bạn là thành viên 5 của hội đồng QA giao diện KIRA, vai kiểm tiếp cận (accessibility). Việc CHỈ ĐÁNH GIÁ — không sửa main.tsx, styles.css, lib.rs hay bất kỳ file app nào.

BỐI CẢNH: câu hỏi của user (2026-09-15): "contrast chữ ≥4.5:1, focus và non-text ≥3:1 ở dark và light; điều hướng bàn phím; nhãn khả truy cập khớp chữ hiển thị; reduced motion".

BƯỚC 0: kiểm `ls ~/.claude/skills/wcag-audit-patterns` (nếu tồn tại, dùng skill đó). Nếu không có, dùng trực tiếp WCAG 2.2 (bạn đã biết các success criteria 1.4.3 Contrast Minimum, 1.4.11 Non-text Contrast, 2.4.7 Focus Visible, 2.4.11 Focus Not Obscured) và ghi rõ trong report là chạy không có skill này.

TÀI LIỆU ĐỌC TRƯỚC: .claude/skills/kira-controls/SKILL.md §8 "Contrast: ngưỡng và cách đo" — đây là PHƯƠNG PHÁP ĐO BẮT BUỘC cho control (bốn cấp nút, icon rail, focus ring), không phải chỉ tham khảo. Số đã đo trên specimen nằm trong bảng ở §8, dùng làm mốc so sánh với app thật.

MÔI TRƯỜNG: preview_start "kira-desktop". Ghi SHA trước khi đo. Theo đúng CLAUDE.md mục Verify, điểm 3 (composite alpha lên nền thật, gắn tạm tắt transition/animation trước khi đo, `pointer-events: auto !important` tạm khi dùng elementsFromPoint, đo trên nền xấu nhất khi có plate bán trong suốt). Đo trước trong dev server; nếu kết quả biên (gần ngưỡng 4.5 hoặc 3.0), xác nhận lại trong bundle debug (Chrome headless khác WKWebView — kira-controls §8 điểm 7) trước khi kết luận đạt hay không đạt.

VIỆC:
1. Viết một script JS (javascript_tool) đo contrast theo đúng công thức §8 cho: 4 cấp nút × 2 cỡ × các trạng thái (default, hover, active/pressed, focus, disabled, selected nếu có) × dark/light. Nếu bạn thấy trong repo đã có sẵn một probe JS làm việc này (tìm trong scripts/ hoặc docs/design/), DÙNG LẠI nó thay vì viết mới, và ghi rõ đường dẫn probe đã dùng.
2. Đo vòng focus theo đúng cách §8 điểm 4 (dải 1px trong khe offset, dải 1px ngoài vòng).
3. Đo icon rail theo §8 điểm 5 (chụp có/không icon, so điểm ảnh, phân vị 80).
4. Điều hướng toàn bộ luồng chính (mở project, tạo node, mở Settings, mở panel phải, duyệt một mục "Cần bạn") CHỈ BẰNG BÀN PHÍM (Tab, Shift+Tab, Enter, Esc, mũi tên) — ghi lại mọi chỗ kẹt hoặc mất focus.
5. Đọc read_page ở 5 màn chính, so nhãn khả truy cập (aria-label, tên accessible) với chữ hiển thị trên màn — báo lệch.
6. Bật giả lập prefers-reduced-motion (javascript_tool set matchMedia hoặc resize_window nếu hỗ trợ), xác nhận motion tắt đúng như kira-controls §7 yêu cầu.

Mỗi phát hiện: {control/màn/trạng thái, ảnh, số đo thật (ví dụ "3.8:1, cần 4.5:1"), so với số specimen ở §8 nếu có, mức P0-P3 (dưới ngưỡng WCAG luôn P0 hoặc P1 tuỳ mức độ dùng được)}. Lưu ảnh vào <cwd worktree>/docs/design/qa-findings/2026-xx-xx-member-5/*.jpg.

TIÊU CHÍ ĐỦ: đã đo đủ ma trận ở bước 1 (không bỏ trạng thái nào của 4 cấp nút); đã đi hết luồng bàn phím ở bước 4; mọi số dưới ngưỡng đã xác nhận lại trong bundle debug trước khi báo P0/P1.

REPORT: 3 phần theo CLAUDE.md. Bảng số đo đầy đủ (không chỉ số thấp nhất) đặt trong "Đã làm"; ghi SHA, đường dẫn ảnh, và có/không dùng được skill wcag-audit-patterns.
```

---

## Thành viên 6 — Tương tác và chuyển động

**Model:** Sonnet 5 high · **subagent_type:** general-purpose · **isolation:** worktree

```
Bạn là thành viên 6 của hội đồng QA giao diện KIRA, vai tương tác và chuyển động (motion). Việc CHỈ ĐÁNH GIÁ — không sửa main.tsx, styles.css, lib.rs hay bất kỳ file app nào.

BỐI CẢNH: câu hỏi của user (2026-09-15): "hover, nhấn, focus, selected, disabled, loading có đủ và có cảm giác vật lý không; popover mở từ gốc; không nảy, không animation tự chạy".

BƯỚC 0: kiểm `ls ~/.claude/skills/emil-design-eng/SKILL.md`. Nếu có, dùng skill đó (Skill tool) làm chuẩn animation. Nếu không có, dùng .claude/skills/kira-controls/SKILL.md §7 "Motion" và §9 "Ba ví dụ trước và sau" làm chuẩn duy nhất, và ghi rõ trong report là chạy không có emil-design-eng.

TÀI LIỆU ĐỌC TRƯỚC: .claude/skills/kira-controls/SKILL.md toàn bộ, đặc biệt §2 luật 4 ("Hover không đảo control thành khối đặc"), §3.2 (công thức trạng thái), §7 (motion, không spring cho control).

MÔI TRƯỜNG: preview_start "kira-desktop", nạp loadFixture(120). Ghi SHA trước khi chấm. Theo CLAUDE.md mục Verify về đo animation: browser pane ẩn làm transition đứng giữa chừng — front tab trước khi tương tác; click theo ref, không theo toạ độ, khi phần tử đang animate.

VIỆC:
1. Với mỗi cấp nút (primary, secondary, quiet, danger) và tool rail: thử đủ default → hover → active/pressed → focus (Tab tới) → disabled (nếu có) → selected (aria-pressed, nếu có). Xác nhận đúng công thức kira-controls §3.2, không thiếu trạng thái nào.
2. Mọi popover, tooltip, dropdown, menu: mở từ gốc trigger (không phải center) trừ modal thật sự (đúng ngoại lệ trong DESIGN.md/kira-controls). Đóng bằng Esc và bằng click ra ngoài đều test.
3. Tìm animation tự chạy không do người dùng kích hoạt (pulse, shimmer, float liên tục) — chỉ được phép nếu có lý do trạng thái thật (loading, đang xử lý), không phải trang trí.
4. Tìm spring/bounce easing trên control (cấm theo kira-controls §7) — chỉ cho phép trên tương tác kéo-thả trên canvas.
5. Kiểm loading state: khi Kira đang xử lý (dock hoặc panel phải), có chỉ báo rõ không, có animation nào chạy vô hạn không dừng đúng lúc không.
6. Đối chiếu 3 ví dụ ở kira-controls §9 (hover teal đảo khối, nút ButtonFace mặc định trình duyệt, hai họ icon mép dưới canvas) — xác nhận cả 3 đã sửa đúng như "Sau" mô tả, chưa sửa hết thì báo P0/P1.

Mỗi phát hiện: {control/màn, ảnh hoặc GIF mô tả bằng lời (before/after theo thời gian nếu computer tool không quay được video, mô tả từng khung), mô tả, vì sao mất cảm giác vật lý, mức P0-P3}. Lưu ảnh vào <cwd worktree>/docs/design/qa-findings/2026-xx-xx-member-6/*.jpg.

TIÊU CHÍ ĐỦ: đã thử đủ ma trận trạng thái ở bước 1 cho cả 4 cấp nút; đã xác nhận riêng từng ví dụ ở bước 6.

REPORT: 3 phần theo CLAUDE.md, ghi SHA, đường dẫn ảnh, có/không dùng skill emil-design-eng.
```

---

## Thành viên 7 — Chức năng panel phải

**Model:** Sonnet 5 high · **subagent_type:** general-purpose · **isolation:** worktree

```
Bạn là thành viên 7 của hội đồng QA giao diện KIRA, vai kiểm chức năng panel phải. Việc CHỈ ĐÁNH GIÁ — không sửa main.tsx, styles.css, lib.rs hay bất kỳ file app nào.

BỐI CẢNH: panel phải (Chat + "Cần bạn") vừa được code theo docs/design/right-panel/DECISIONS.md. Câu hỏi của user (2026-09-15): "Chat, chi tiết run, Cần bạn: nhận, từ chối, đã cũ, gỡ node có chặn, số đếm thống nhất, lưu và mở lại project, hoàn tác — đều phải xong cả tính năng lẫn hình thức".

TÀI LIỆU ĐỌC TRƯỚC: docs/design/right-panel/DECISIONS.md toàn bộ (10 quyết định đã chốt + mục "Còn mở"); docs/design/right-panel/index.html và shots/ (mockup tham chiếu, KHÔNG phải đích — app thật có thể khác hình thức miễn đúng hành vi); .claude/skills/kira-controls/SKILL.md nếu panel dùng control chung (nút, tab, badge).

MÔI TRƯỜNG: preview_start "kira-desktop", nạp loadFixture(120). Ghi SHA trước khi chấm.

VIỆC, đi đúng theo từng quyết định trong DECISIONS.md:
1. Panel đè lên canvas như Thư viện (không đẩy canvas ra ngoài màn); canvas-right-inset hoạt động, topbar/zoom/dock lùi đúng.
2. Rộng 360px mặc định, kéo được 320-480px — thử kéo hai biên, thử reload xem có nhớ độ rộng không (nếu spec không yêu cầu nhớ thì bỏ qua, không tự suy ra thành lỗi).
3. Dưới 1180px chỉ mở một ngăn: mở Kira thì Library tự thu — test bằng resize_window xuống dưới 1180.
4. Ô nhập nằm trong panel khi mở; dock chỉ còn nút khi panel mở.
5. Nút mở ở đầu phải hàng tab tệp, có số đếm "cần xử lý" — số này PHẢI khớp giữa nút, tab "Cần bạn", và dòng trạng thái dock (một định nghĩa duy nhất: chờ duyệt + mục đã cũ + checkpoint skill).
6. Tab "Thay đổi" phải tên là "Cần bạn" (không phải "Changes" hay tên khác).
7. Tab "Cần bạn" không có ô nhập; bấm ô gõ ở dock khi đang mở tab này thì chuyển sang tab Chat và focus vào ô nhập.
8. Bấm "Mở" ở dòng trạng thái dock vào thẳng đúng mục/checkpoint đang chờ; bấm nút Kira ở hàng tab giữ tab đã mở lần trước.
9. Cửa sổ rộng (≥1180px) không tự thu Library khi mở Kira, kể cả mở từ thao tác duyệt.
10. Thử luồng AI sửa/xoá một node có sẵn (nếu có cách kích hoạt được, vd qua dock hoặc fixture) — PHẢI luôn vào hàng chờ duyệt ở "Cần bạn", không tự áp dụng. Nhận và từ chối từng mục hoạt động đúng. Thử một mục "đã cũ" (node bị đổi trong lúc đề xuất còn treo) nếu tạo được tình huống đó.
11. Restore version: xác nhận chat KHÔNG bị đưa về quá khứ theo (độc lập với version).
12. Lưu project, đóng, mở lại: panel phải, lịch sử chat, hàng "Cần bạn" còn nguyên không mất dữ liệu.
13. Thử Cmd+Z sau khi nhận một đề xuất — có hoàn tác đúng được không.
14. Đối chiếu hình thức: chuỗi hiển thị có qua hệ ngôn ngữ của app không (không chép cứng tiếng Việt từ mockup); màu sắc, cỡ chữ, control trong panel có theo đúng token và kira-controls không (không phải CSS thử nghiệm còn sót từ mockup.css).

Mỗi phát hiện: {quyết định # bị vi phạm hoặc chưa làm, ảnh, mô tả, các bước tái hiện, vì sao ảnh hưởng người dùng, mức P0-P3 — thiếu hẳn một quyết định trong 10 cái là P0}. Lưu ảnh vào <cwd worktree>/docs/design/qa-findings/2026-xx-xx-member-7/*.jpg.

TIÊU CHÍ ĐỦ: đã thử đủ 14 mục trên; với mục không tạo được tình huống test (vd không có cách tạo "mục đã cũ"), ghi rõ lý do thay vì bỏ qua im lặng.

REPORT: 3 phần theo CLAUDE.md, đối chiếu rõ từng quyết định 1-10 đã đạt hay chưa, SHA, đường dẫn ảnh.
```

---

## Thành viên 8 — Ổn định và hiệu năng

**Model:** Sonnet 5 high (Haiku 4.5 medium chấp nhận được nếu chỉ chạy đúng các bước cơ học liệt kê dưới, không cần phán đoán thêm) · **subagent_type:** general-purpose · **isolation:** worktree

```
Bạn là thành viên 8 của hội đồng QA giao diện KIRA, vai ổn định và hiệu năng. Việc CHỈ ĐÁNH GIÁ — không sửa main.tsx, styles.css, lib.rs hay bất kỳ file app nào.

BỐI CẢNH: câu hỏi của user (2026-09-15): "console không lỗi; canvas 120 node mượt khi mở panel và rail; không lỗi layout ở 1024, 1280, 1440px".

MÔI TRƯỜNG: preview_start "kira-desktop". Ghi `git -C "/Volumes/VXData/Users/VietX/App Code/vixio" rev-parse --short HEAD` vào report trước khi bắt đầu.

VIỆC:
1. Reload sạch (không phải HMR — CLAUDE.md ghi main.tsx không Fast Refresh, reload đầy đủ mới đáng tin). Đọc read_console_messages ngay sau khi app load xong, ghi mọi lỗi và warning (không chỉ lỗi đỏ — warning React key, warning deprecated API cũng ghi).
2. Nạp window.__kiraDev.loadFixture(120). Đọc console lại — fixture load không được sinh lỗi mới.
3. Mở panel phải VÀ tool rail VÀ Library cùng lúc (nếu độ rộng màn cho phép ở 1440px). Pan và zoom canvas nhiều lần (left_click_drag để pan, scroll để zoom) trong khi cả ba đang mở. Đọc console lại.
4. resize_window lần lượt 1024x768, 1280x800, 1440x900 (reload sau mỗi lần đổi, theo CLAUDE.md: gắn tạm tắt transition trước khi đo hình học nếu cần). Ở mỗi kích thước: đọc read_page toàn trang, tìm phần tử bị cắt (width/height âm hoặc bằng 0 nhưng có nội dung), phần tử tràn ra ngoài viewport (right/bottom vượt innerWidth/innerHeight), chồng lấn giữa toolbar/dock/panel/rail (so bounding box).
5. Test thêm 200 reference bằng loadFixture(200) nếu hàm cho phép tham số lớn hơn — nếu không, dùng 120 làm mức tối đa test được và ghi rõ. Lặp lại bước 3 ở mức này, chú ý độ trễ khi pan/zoom (đo bằng số khung hình cảm nhận qua nhiều lần chụp liên tiếp cách nhau ~100ms, không cần công cụ đo FPS chuyên dụng — mô tả "mượt" hay "giật" kèm bằng chứng ảnh liên tiếp).
6. Đóng và mở lại project 2-3 lần liên tiếp, mở/đóng panel phải và Settings nhiều lần — tìm rò rỉ hiển thị (nội dung cũ còn sót, đếm nút tăng dần bất thường).

Mỗi phát hiện: {bước tái hiện chính xác, kích thước cửa sổ nếu liên quan, ảnh hoặc log console nguyên văn, mô tả, mức P0-P3 — lỗi console đỏ luôn tối thiểu P1}. Lưu ảnh/log vào <cwd worktree>/docs/design/qa-findings/2026-xx-xx-member-8/*.

TIÊU CHÍ ĐỦ: đã đọc console ở cả 3 mốc (load sạch, sau fixture, sau thao tác pan/zoom với 3 panel mở); đã kiểm cả 3 kích thước cửa sổ.

REPORT: 3 phần theo CLAUDE.md; console log lỗi/warning dán nguyên văn trong "Vấn đề phát hiện"; SHA và đường dẫn ảnh.
```

---

## 2. Kịch bản chạy song song và kiểm chứng đối kháng (Orchestrator tự chạy, không cần Researcher)

### Bước 1 — Xác nhận điều kiện bắn

```
git -C "/Volumes/VXData/Users/VietX/App Code/vixio" log --oneline -15
```

Xác nhận cả ba đã merge vào `main`: Ink & Paper pha 2, đợt layout theo `docs/design/layout-spec.md`, panel phải theo `docs/design/right-panel/DECISIONS.md`. Chưa đủ ba thì chưa bắn — bắn sớm chỉ tạo phát hiện về code sẽ bị thay ngay sau đó.

### Bước 2 — Bắn 8 agent trong một lượt

Gọi `Agent` 8 lần trong **cùng một response** (không tuần tự), mỗi lời gọi dùng đúng `model`, `subagent_type: "general-purpose"`, `isolation: "worktree"` và nội dung `prompt` đã dán nguyên văn ở trên (mục 1-8). Không cần `run_in_background: false` — để mặc định chạy nền, vì không có việc nào ngay sau đó phụ thuộc kết quả từng agent riêng lẻ.

### Bước 3 — Chờ và thu kết quả

8 agent chạy nền, mỗi cái xong sẽ có task-notification riêng. Không polling. Khi cả 8 xong (hoặc timeout hợp lý, ví dụ 45-60 phút — panel phải và bàn phím tốn thời gian nhất), đọc report của từng agent (nội dung nằm trong task-notification, hoặc dùng `ListAgents` rồi `SendMessage` hỏi lại agent còn giữ tên nếu report bị cắt).

### Bước 4 — Gộp trùng

Với toàn bộ phát hiện của 8 báo cáo: nhóm những phát hiện cùng {màn, control/element, nguyên nhân gốc} dù được các thành viên khác nhau mô tả khác lời (ví dụ thành viên 1 và 6 cùng bắt "hover đảo teal" ở cùng một selector CSS thì gộp một, ghi cả hai nguồn). Loại phát hiện trùng với ví dụ đã "Sau" trong kira-controls §9 nếu ảnh chứng minh đã sửa đúng (khả năng cao agent 1 báo sai vì test nhầm code cũ — kiểm lại SHA agent đó ghi).

### Bước 5 — Kiểm chứng đối kháng P0/P1

Với danh sách P0/P1 sau gộp trùng, chia thành 2-3 nhóm theo mảng (thẩm mỹ/bố cục, a11y/tương tác, panel phải/ổn định) và spawn mỗi nhóm **một agent kiểm chứng riêng**, KHÔNG phải agent đã báo phát hiện đó:

```
Agent({
  description: "QA — kiểm chứng đối kháng P0/P1 nhóm <tên nhóm>",
  subagent_type: "general-purpose",
  model: "opus",
  isolation: "worktree",
  prompt: "Bạn nhận một danh sách phát hiện P0/P1 từ hội đồng QA KIRA (dán danh sách vào đây, mỗi cái kèm màn/control/mô tả/bước tái hiện gốc). Việc CHỈ KIỂM CHỨNG, không sửa code. Với MỖI phát hiện: (1) git -C \"/Volumes/VXData/Users/VietX/App Code/vixio\" rev-parse --short HEAD — ghi SHA hiện tại, so với SHA agent gốc đã test; nếu main đã đổi thêm commit liên quan tới đúng file/vùng bị báo lỗi, ghi rõ 'có thể đã lỗi thời, cần verify kỹ hơn' thay vì tự tin kết luận. (2) preview_start kira-desktop, tái hiện đúng bước đã mô tả, độc lập không xem lại ảnh cũ của agent gốc trước khi tự chụp. (3) Kết luận CONFIRMED (tái hiện được, kèm ảnh/log mới) hoặc NOT REPRODUCIBLE (không tái hiện được sau khi thử đúng bước, kèm ảnh cho thấy trạng thái hiện tại) cho từng phát hiện. Report theo 3 phần CLAUDE.md, danh sách CONFIRMED riêng NOT REPRODUCIBLE riêng, mỗi cái kèm SHA và ảnh mới.",
})
```

### Bước 6 — Chấm theo điều kiện đạt (`docs/design/qa-council.md`)

1. **0 P0, 0 P1** sau bước 5 (chỉ tính CONFIRMED).
2. Điểm impeccable ≥ 32/40 cho Canvas, Settings, panel phải — lấy từ report thành viên 1 và 3 (đã chạy impeccable critique).
3. Contrast đạt ở 5 preset màu × dark/light kể cả hover/pressed/focus — lấy từ report thành viên 5.
4. Panel phải qua đủ 14 mục ở prompt thành viên 7 trên bản build thật, kể cả lưu rồi mở lại project.
5. Thành viên 2 không gặp chữ kỹ thuật ở luồng chính (không có P0/P1 loại "chữ kỹ thuật" từ thành viên 2, sau kiểm chứng).

Đạt cả 5 thì báo user là hệ giao diện qua QA. Không đạt: gộp mọi CONFIRMED P0/P1 và P2 quan trọng thành brief sửa cho Worker/UI-UX theo từng file/vùng (claim file nóng trước khi giao), rồi **chỉ chạy lại những thành viên liên quan tới vùng vừa sửa**, không chạy lại cả 8 (tiết kiệm theo chính sách CLAUDE.md 2026-09-15).

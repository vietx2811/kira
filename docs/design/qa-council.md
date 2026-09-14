# Hội đồng QA giao diện KIRA

Mục tiêu user (2026-09-15): giao diện hoàn thiện ở cấp độ Figma UI3; component sắp xếp gọn về logic; không quá tải cho người không biết code; có khoảng thở; hạn chế khung ô, nhóm bằng khoảng cách và đường kẻ; QA theo chuẩn thẩm mỹ desktop app cao cấp; panel phải hoàn thiện cả tính năng lẫn hình thức.

Hội đồng chạy trên **bản build thật** (vite từ `main` cho phần giao diện, bundle debug cho phần native), sau khi hệ control Ink & Paper, đợt bố cục và panel phải đã merge. Mỗi thành viên là một agent độc lập, không thấy kết luận của nhau trước khi nộp.

## Thành viên và câu hỏi của từng người

| # | Góc nhìn | Câu hỏi chính | Căn cứ |
|---|---|---|---|
| 1 | **Art Director** | Có đạt cảm giác một app canvas cao cấp 2026 không? Phân cấp, nhịp, chất liệu Ink & Paper có nhất quán mọi màn không? Chỗ nào còn "AI slop"? | `docs/research/2026-09-14-art-direction-controls-v2.md`, DESIGN.md |
| 2 | **Người dùng sáng tạo không biết code** | Lần đầu mở app, có hiểu phải làm gì không? Có chữ kỹ thuật (id, model id thô, JSON, "provider", "token") lộ ra không? Chỗ nào quá nhiều lựa chọn? | PRODUCT.md (art director, brand strategist) |
| 3 | **Bố cục và kiến trúc thông tin** | Còn khung lồng khung không? Nhóm có dùng khoảng cách và hairline thay cho viền bao không? Mật độ và khoảng thở mỗi màn? Toolbar có đè nhau không? | DESIGN.md mục Layout & grouping, `docs/design/layout-spec.md` |
| 4 | **Nền tảng macOS** | Cỡ nút, toolbar, vật liệu cửa sổ, phím tắt, hành vi cửa sổ có đúng cảm giác app Mac không? | skill `apple-design` (HIG) |
| 5 | **Tiếp cận (a11y)** | Contrast chữ ≥ 4.5:1, focus và non-text ≥ 3:1 ở dark và light; điều hướng bàn phím; nhãn khả truy cập khớp chữ hiển thị; reduced motion | WCAG 2.2, `wcag-audit-patterns` |
| 6 | **Tương tác và chuyển động** | Hover, nhấn, focus, selected, disabled, loading có đủ và có cảm giác vật lý không? Popover mở từ gốc? Không nảy, không animation tự chạy? | skill `emil-design-eng`, `kira-controls` |
| 7 | **Chức năng panel phải** | Chat, chi tiết run, "Cần bạn": nhận, từ chối, đã cũ, gỡ node có chặn, số đếm thống nhất, lưu và mở lại project, hoàn tác | `docs/design/right-panel/DECISIONS.md` (quyết định 1-10) |
| 8 | **Ổn định và hiệu năng** | Console không lỗi; canvas 120 node mượt khi mở panel và rail; không lỗi layout ở 1024, 1280, 1440px | fixture `window.__kiraDev.loadFixture()` |

## Cách chấm

- Mỗi phát hiện: màn, ảnh chụp, mô tả, vì sao ảnh hưởng người dùng mục tiêu, mức **P0** (chặn dùng) · **P1** (lỗi rõ ràng, người dùng sẽ gặp) · **P2** (kém tinh tế) · **P3** (tuỳ chọn).
- Người 1 và 3 chạy `impeccable critique` trên các màn chính và báo điểm /40.
- Sau khi thu đủ, một lượt **kiểm chứng đối kháng**: mỗi P0/P1 được một agent khác tái hiện trên app; phát hiện không tái hiện được thì loại.
- Orchestrator gộp trùng, giao sửa, rồi chạy lại hội đồng trên những màn bị sửa.

## Điều kiện đạt

1. **0 P0, 0 P1** sau kiểm chứng.
2. Điểm impeccable **≥ 32/40** cho Canvas, Settings, panel phải (mốc hiện tại: app 24/40, mockup panel 28/40).
3. Contrast đạt ở **5 preset × dark/light**, kể cả hover, pressed, focus.
4. Panel phải qua đủ luồng của thành viên 7 trên bản build thật, kể cả lưu rồi mở lại project.
5. Người dùng không biết code (thành viên 2) không gặp chữ kỹ thuật ở luồng chính.

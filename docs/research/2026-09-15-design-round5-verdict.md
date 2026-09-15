# Hội đồng QA giao diện KIRA — kết quả cuối cùng (vòng 5)

**Câu hỏi:** Giao diện KIRA đã đạt cấp độ hoàn thiện thẩm mỹ desktop app cao cấp theo `docs/design/qa-council.md` chưa?
**Người yêu cầu:** Orchestrator, theo `/goal` của user (2026-09-15).
**Commit đã kiểm chứng cuối cùng:** `7869afa` (đã push lên `origin/main`).
**Kết luận ngắn:** **ĐẠT.** 0 P0, 0 P1 sau kiểm chứng đối kháng; impeccable ≥32/40 cả 3 màn (Canvas, Settings AI Providers, Kira panel) ở cả dark và light; contrast, panel phải, chữ kỹ thuật đều qua điều kiện đạt trong `qa-council.md`.

## Quy trình

1. Hội đồng QA 8 thành viên (Art Director/Opus + 7 góc nhìn) chạy song song trên bản build thật tại `13c50fc`, phát hiện 8 P0 + 18 P1 sau gộp trùng.
2. Kiểm chứng đối kháng bằng 3 agent Opus độc lập (không xem báo cáo gốc) — loại ~30% dương tính giả, đặc biệt 2/3 P0 phần bàn phím hoá ra là lỗi công cụ test.
3. 13 đợt sửa tuần tự (Worker Sonnet, một số việc cơ giới giao Haiku), mỗi đợt qua `graphify-lite --strict` + `tsc -b` + `bun test` trước khi merge, Orchestrator merge tuần tự để tránh xung đột file nóng.
4. 5 vòng tái đánh giá Art Director, mỗi vòng đo lại từ đầu không tin lời "đã sửa", thu hẹp dần phạm vi chấm (vòng 5 chỉ còn 2 màn/lượt cần xác nhận).

## Điểm impeccable cuối cùng

| Màn | Dark | Light | Ngưỡng 32 |
|---|---|---|---|
| Canvas (120 node) | 32/40 | 32/40 | ĐẠT |
| Settings → AI Providers | 36/40 | 36/40 | ĐẠT |
| Kira panel (Chat) | 34/40 | 34/40 | ĐẠT |

Xuất phát điểm vòng 1: Canvas 24/40, Settings 27/40, Kira panel 21/40.

## Các nhóm vấn đề đã sửa (tóm tắt, chi tiết trong lịch sử commit `main`)

- **Thẩm mỹ/bố cục**: panel phải và Library drawer trong suốt đọc xuyên canvas; va chạm layout Outline/Slides với view switcher; teal dùng làm màu "đang chọn" trên toàn bộ chrome control (segmented, nav, view button, ~59 rule); Kira dock viền/nút/chip teal + easing nảy + animate width; onboarding CTA cạnh tranh với primary thật; settings card-trong-card; 67 font-weight thô → 4 token chuẩn; bóng sai cấp; thiếu `prefers-reduced-transparency`.
- **A11y/tương tác**: Settings dialog và confirm-dialog không trap focus (bug 2 lớp: thiếu hook + lỗi selector `tabindex="-1"`); lỗi console mỗi lần scroll canvas; dialog đóng file kẹt mở; segmented control easing nảy; `kira-glint` chạy vô hạn không gắn state thật.
- **Panel phải**: Cmd+Z sau khi Accept/Gỡ node làm mục "Cần bạn" mồ côi vĩnh viễn; skill checkpoint tính vào badge nhưng không có UI; Outline báo "N issues" chỉ hiện 4 chip.
- **Light mode**: bật lại toggle (trước đó tắt cứng), quét ~90 rule dùng màu trắng cứng không theo theme sang token mới, sửa 3 P1 cuối cùng (field không viền trong Project Settings popover, dialog đóng file render sai theme do nằm ngoài `.app-shell`, empty-state Kira panel mâu thuẫn trạng thái thật và không có lối thoát bấm được).

## Còn tồn đọng (P2/P3, không chặn ngưỡng đạt)

- Badge "Error" màu đỏ cho trạng thái "chưa nối model" (không phải lỗi thật) — nên đổi màu trung tính.
- Toggle Dark/Light nằm sâu 2 lớp disclosure trong Project Settings — nên đưa lên một cấp.
- Chưa xác minh tay: Shift+Enter trong composer Kira panel (không phân biệt được lỗi app hay lỗi công cụ test); dialog "Delete profile" có xác nhận trước khi xoá không.
- 52-53 target dưới 24px trên Canvas (đánh đổi mật độ có chủ ý, không phải regression).
- Radius/font-size lệch thang trong **template HTML export** (Outline/Slides export), không phải UI app.

## Đề xuất

Coi mục tiêu đã hoàn thành. 3 mục P2/P3 nêu trên đủ nhỏ để gộp vào một đợt polish sau nếu user muốn, không cần chặn lại quy trình.

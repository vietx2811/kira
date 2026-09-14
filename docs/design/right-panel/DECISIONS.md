# Panel phải: quyết định đã chốt

User chốt 2026-09-14. Mockup: `index.html` và `shots/` cùng thư mục. Nghiên cứu nền: `docs/research/2026-09-13-right-panel-and-research-harness.md`.

## Hành vi AI trên canvas (D1-D4, D11)

1. Panel phải **bổ sung** dock, không thay.
2. Node AI **tạo mới**: áp dụng ngay, gắn badge "AI", bỏ được.
3. AI **sửa hoặc xoá** node có sẵn (text, palette, link, xoá): **luôn chờ duyệt** ở tab Thay đổi. Nhận hàng loạt không bao gồm xoá và mục đã cũ.
4. Restore version **không** đưa chat về quá khứ: chat độc lập với version.
5. Tab Chat dựng trên **assistant-ui** primitives.

## Bố cục (quyết định từ mockup)

1. Panel **đè lên canvas** như Thư viện. Topbar, zoom, thanh công cụ và dock lùi theo `--canvas-right-inset`; node đang xem tự pan ra vùng thấy được.
2. Rộng **360px** mặc định, kéo được **320-480px**.
3. Cửa sổ **dưới 1180px chỉ mở một ngăn**: mở Kira thì Thư viện thu lại.
4. Khi panel mở, **ô nhập nằm trong panel**; dock chỉ còn nút.
5. Nút mở ở **đầu phải hàng tab tệp**, có số đếm "cần xử lý" (chờ duyệt + đã cũ), cùng một định nghĩa cho nút, tab và dòng trạng thái dock.

## Bổ sung sau critique vòng 2 (user chốt 2026-09-14)

6. Tab "Thay đổi" đổi tên thành **"Cần bạn"**. Số đếm trên nút Kira, tab và dòng trạng thái dock là **một số duy nhất**: thay đổi chờ duyệt + mục đã cũ + skill đang dừng ở checkpoint.
7. Ở tab "Cần bạn" không có ô nhập. Bấm vào ô gõ cho Kira ở dock khi panel đang mở tab này thì **chuyển sang tab Chat và đưa con trỏ vào ô nhập**.
8. Bấm "Mở" ở **dòng trạng thái dock** thì vào thẳng tab "Cần bạn", đúng mục hoặc checkpoint đang chờ. Bấm **nút Kira** ở hàng tab tệp thì giữ tab đang mở lần trước.
9. Cửa sổ rộng không tự thu Thư viện khi mở Kira, kể cả mở từ thao tác duyệt. Chỉ thu dưới 1180px như quyết định bố cục 3.
10. Kéo câu trả lời lên canvas: mặc định tạo **1 node gộp**, có lựa chọn tách mỗi mục danh sách thành 1 node. (Orchestrator chọn mặc định, user có thể đổi.)

## Còn mở

- Có hiện đề xuất sửa dạng ghost ngay trên node không.
- Harness (D5-D10, D12-D14): chờ báo cáo so sánh harness mã nguồn mở.

## Lưu ý khi code

- Mockup viết bằng tiếng Việt; app mặc định tiếng Anh và có tuỳ chọn tiếng Việt. Chuỗi phải đi qua hệ ngôn ngữ của app, không chép cứng.
- Rule đánh dấu `NEW` trong `mockup.css` là điểm bắt đầu cho CSS thật, phải qua type scale và token trong CLAUDE.md, và `graphify-lite --strict`.

# Research log

Nơi lưu các báo cáo nghiên cứu của thread **Researcher** (session `vixio-31`). Orchestrator nhận tóm tắt qua cross-session message; bản đầy đủ nằm ở đây.

## Quy ước

- Tên file: `YYYY-MM-DD-<chu-de-kebab>.md`
- Mỗi báo cáo mở đầu bằng: **Câu hỏi**, **Người yêu cầu**, **Commit đã kiểm chứng** (hash tại thời điểm viết), **Kết luận ngắn** (≤5 dòng).
- Phân biệt rõ: *đã xác minh trong code* (kèm `file:line`) vs *nguồn ngoài* (kèm link + ngày truy cập) vs *suy luận*.
- Báo cáo cũ không sửa nội dung kết luận — thêm mục `## Cập nhật YYYY-MM-DD` hoặc đánh dấu `Superseded by …`.

## Nghiên cứu trước đây (ở `docs/`)

| File | Chủ đề | Ngày |
|---|---|---|
| [RESEARCH.md](../RESEARCH.md) | Tech stack (Tauri, reagraph, WXT…) — lịch sử | 2026-06 |
| [SLIDES_RESEARCH.md](../SLIDES_RESEARCH.md) | Slides: export, customization | 2026-06-18 |
| [RESEARCH_MOODBOARD_UX.md](../RESEARCH_MOODBOARD_UX.md) | Multi-tab, capture, UX moodboard | 2026-07-26 |

## Index

| Ngày | File | Chủ đề | Trạng thái |
|---|---|---|---|
| 2026-09-13 | [2026-09-13-graphify-code-graph.md](2026-09-13-graphify-code-graph.md) | Đánh giá graphify (code knowledge graph) vs graphify-lite | Kết luận: làm graphify-lite |
| 2026-09-13 | [2026-09-13-right-panel-and-research-harness.md](2026-09-13-right-panel-and-research-harness.md) | Panel phải (chat AI + Changes) và harness/skill nghiên cứu | Chờ user chốt 10 quyết định (§D) |
| 2026-09-13 | [2026-09-13-right-panel-harness-oss.md](2026-09-13-right-panel-harness-oss.md) | Phụ lục: OSS tích hợp cho panel phải và harness | 4 spike chờ duyệt, D11–D14 |
| 2026-09-14 | [2026-09-14-design-quality-skills-oss.md](2026-09-14-design-quality-skills-oss.md) | Nâng chất lượng thiết kế: skill nào, OSS nào, và liquid glass | D11 chốt dùng assistant-ui; D15–D19 chờ Orchestrator |
| 2026-09-14 | [2026-09-14-art-direction.md](2026-09-14-art-direction.md) | Art direction: audit thẩm mỹ, phong cách canvas app 2026, hệ control (specimen trong `art-direction/`) | User chốt hướng B và làm hệ nút trước; hệ control vòng 1 bị từ chối |
| 2026-09-14 | [2026-09-14-oss-harness.md](2026-09-14-oss-harness.md) | Harness agent OSS làm lõi nghiên cứu? | Khuyến nghị AI SDK trong sidecar ở phase 2; H1–H9 chờ user |
| 2026-09-14 | [2026-09-14-art-direction-controls-v2.md](2026-09-14-art-direction-controls-v2.md) | Art direction vòng 2: 3 tính cách control (Machined, Ink & Paper, Lens), tool rail icon có khối, nguồn icon (specimen trong `art-direction/v2/`) | User chốt Ink & Paper (2026-09-15), icon rail vẽ riêng |
| 2026-09-15 | [2026-09-15-design-skills-github.md](2026-09-15-design-skills-github.md) | Skill thiết kế trên GitHub, bỏ design-taste-frontend | User duyệt: bỏ design-taste-frontend, tự cài 3 skill; kira-controls đang viết |
| 2026-09-15 | [2026-09-15-design-round5-verdict.md](2026-09-15-design-round5-verdict.md) | Hội đồng QA 8 thành viên + 5 vòng sửa-tái kiểm cho mục tiêu hoàn thiện giao diện | **ĐẠT**: 0 P0/P1, impeccable ≥32/40 cả 3 màn × 2 theme, tại `7869afa` |
| 2026-09-16 | [2026-09-16-ui-kit-ark-park-magic.md](2026-09-16-ui-kit-ark-park-magic.md) | Ark UI / Park UI / Magic UI: có nên dùng làm UI kit / tham chiếu | Khuyến nghị: Ark UI headless cho Select/Combobox/Menu/Slider; không Park UI (khoá Panda CSS); không Magic UI. Chờ user chốt 4 quyết định |

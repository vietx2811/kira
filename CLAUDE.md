# CLAUDE.md: KIRA (vixio)

Mọi thread Claude làm việc trong repo này đều tự nạp file này. Luật dùng chung đặt ở đây, không để trong memory: thread chạy trong worktree có project dir riêng và **không thấy memory của tree chính** (đã kiểm chứng 2026-09-13).

Luật design và sản phẩm: xem `DESIGN.md` và `PRODUCT.md`. Không chép lại ở đây để tránh hai nơi lệch nhau.

## Vai trò

Tên session có thể đổi, nên tìm tên hiện tại bằng `ListAgents` chứ đừng hardcode.

- **Orchestrator**: điều phối, giao việc, là người **duy nhất merge vào `main` và push**, giữ memory dùng chung.
- **UI/UX**: critique và thiết kế giao diện.
- **Researcher**: nghiên cứu, lưu báo cáo ở `docs/research/` theo quy ước trong `docs/research/README.md`. Không sửa code app.
- **Worker**: triển khai việc được giao.

Thêm hoặc đổi vai trò thì cập nhật mục này qua Orchestrator.

**Bài học và luật dùng chung: báo Orchestrator để đưa vào file này. Không tự ghi vào memory.** Thread trong worktree không thấy memory, và một sự thật về code ghi trong memory sẽ lỗi thời ngay khi code đổi. Memory chỉ dành cho bối cảnh chi tiết mà file này chỉ tóm tắt.

## Nhắn tin giữa các thread

- `SendMessage` chỉ **xếp hàng**, và kết quả "success" không có nghĩa tin đã được đọc. Một session tương tác đang idle **có thể không tự thức dậy** để xử lý: đã xảy ra với Researcher (brief nằm đó không ai đọc) và vixio-25 (không trả lời cả ngày).
- Cần session idle **bắt đầu làm ngay** (giao việc, bàn giao): dùng `mcp__ccd_session_mgmt__send_message` với `session_id`. Kết quả `delivered` nghĩa là lượt của session đó đã bắt đầu; `queued` là đang chờ sau việc hiện tại.
- `session_id` lấy từ `list_sessions`. Tên trong `ListAgents` (vd `vixio-31`) **khác** title trong `list_sessions` (vd "Researcher Agent Thread"), nên xác nhận đúng session bằng cách đọc transcript qua `list_events`, đừng đoán theo tên.
- Muốn biết tin đã được xử lý chưa: xem `isRunning` / `lastActivityAt` trong `list_sessions`, hoặc tìm tin đó trong transcript.

## Git: mỗi task một worktree

- Bắt đầu task: tạo worktree + branch từ `main` mới nhất, ví dụ `git worktree add .claude/worktrees/<task> -b <vai-tro>/<task> main` (hoặc tool `EnterWorktree`). `.claude/worktrees/` đã được ignore.
- **Không commit hay push thẳng lên `main`.** Commit trên branch của mình, rồi báo Orchestrator để merge.
- Tree chính (branch `main` tại gốc repo) dành cho Orchestrator.
- Task xong và đã merge: xoá worktree và branch.

Worktree đổi conflict từ *ghi đè lẫn nhau lúc đang sửa* thành *conflict lúc merge*: rõ ràng, không mất việc, nhưng **không biến mất**. Vì vậy vẫn phải claim file nóng (dưới đây).

## File nóng: claim trước khi sửa

Gần như toàn bộ frontend nằm trong `apps/desktop/src/main.tsx` và `apps/desktop/src/styles.css`; backend native nằm trong `apps/desktop/src-tauri/src/lib.rs`. Trước khi sửa một trong ba file này, nhắn Orchestrator vùng định sửa và chờ xác nhận. Sửa xong thì báo nhả.

## Định dạng report

Mọi report kết thúc task, gửi user hay gửi Orchestrator, chia 3 phần theo thứ tự:

1. **Đã làm**: việc đã làm và đã verify.
2. **Vấn đề phát hiện / tồn đọng**: vấn đề gặp phải (kể cả lỗi của chính mình) và mọi thứ còn dở: commit chưa push, tiến trình còn chạy, đường chưa verify, quyết định đang chờ user.
3. **Đề xuất**: bước tiếp theo, dưới dạng đề xuất để user điều chỉnh, không phải kế hoạch đã chốt.

## Verify

- Kiểm chứng một phát hiện **trên commit SHA tại thời điểm phát hiện**, không phải working tree hiện tại: thread khác có thể đã sửa rồi. Chạy `git log -S "<chuỗi>"` và `git show <sha>` trước khi kết luận một phát hiện là sai.
- Ghi commit SHA đã kiểm chứng vào report.
- Khi audit tìm giá trị sai, **đừng đưa giá trị đang audit vào danh sách cho phép** (từng che mất các button 14px).
- Chỉ nói một thứ "chạy được" khi đã thật sự chạy nó. Browser preview **không có Tauri runtime**: đường native (AI provider, `osascript`, sidecar) phải test trong app thật.
- Tên nút, tên command lấy từ memory hay tài liệu thì grep lại trước khi dùng. Memory từng ghi một nút "Recheck" và một command `claude_code_status` đều không tồn tại.
- Trước khi tin một màu hay giá trị đọc từ `getComputedStyle`, kiểm tra biến `var()` có thật sự được khai báo. Biến không tồn tại khiến thuộc tính rơi về giá trị kế thừa, nên con số đo được là ngẫu nhiên (từng xảy ra với `--text-faint`).

## `styles.css`: type scale

Mọi `font-size` phải là token: `--text-mini` 10px, `--text-small` 11px, `--text-body` 13px, `--text-title` 15px, `--text-large` 20px. Ngoại lệ duy nhất: 2 display heading dùng `clamp()` (onboarding hero, slide title). Cần cỡ mới thì thêm bậc vào scale, đừng viết giá trị dùng một lần. Không để phần tử nào inherit 14px từ root, vì 14px không phải một bậc.

## Ràng buộc đã chốt

- **Claude Code provider**: CLI của user tự lo đăng nhập và token. KIRA không render login UI, không đọc hay lưu token; đăng nhập chỉ bằng cách mở Terminal chạy `claude auth login`. Không thêm OAuth hay device-code trong app kiểu Codex: user đã từ chối.
- **Copy hiển thị cho user**: không dùng em dash, đổi thành dấu phẩy, hai chấm hoặc dấu chấm (theo các bản critique trong `.impeccable/critique/`). Prompt template gửi cho LLM không bị ràng buộc này.

## Gotcha khi dev

- `main.tsx` không Fast Refresh được: mỗi lần sửa, HMR reload toàn bộ và **reset state app** (panel, popover đang mở sẽ đóng). Nó cũng in lỗi `createRoot() on a container that has already been passed to createRoot()`. Lỗi này chỉ xuất hiện trên đường HMR; xác nhận bằng một lần reload sạch.
- Dev server: `.claude/launch.json` cấu hình `kira-desktop`. Port 5173 thường đã bị thread khác chiếm; `autoPort` sẽ chọn port khác, đừng tắt tiến trình không phải của mình.
- App native: `cargo run` chạy binary trần không có Info.plist, nên hệ thống không nhận ra app và không điều khiển được bằng accessibility. Cần bundle thật. Build frontend trước (`npx tsc -b && npx vite build` trong `apps/desktop`), rồi build bundle mà bỏ qua `beforeBuildCommand`, vì lệnh đó chạy cả `xcodebuild` cho Safari extension, rất chậm: `npx tauri build --debug --bundles app --config '{"build":{"beforeBuildCommand":""}}'`. Bundle này có cùng bundle id với KIRA đã cài, nên tắt nó khi test xong.

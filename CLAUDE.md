# CLAUDE.md: KIRA (vixio)

Mọi thread Claude trong repo này tự nạp file này. Luật dùng chung nằm ở đây, không nằm trong memory: thread chạy trong worktree có project dir riêng và **không thấy memory của tree chính**. Luật design và sản phẩm: xem `DESIGN.md`, `PRODUCT.md` (không chép lại).

## Vai trò

Tên session có thể đổi: tìm tên hiện tại bằng `ListAgents`, đừng hardcode.

- **Orchestrator**: điều phối, giao việc, **người duy nhất merge vào `main` và push**, giữ memory dùng chung.
- **UI/UX**: critique và thiết kế giao diện.
- **Researcher**: nghiên cứu, lưu báo cáo ở `docs/research/` theo `docs/research/README.md`. Không sửa code app.
- **Worker**: triển khai việc được giao.

Đổi vai trò, hoặc có bài học dùng chung: **báo Orchestrator để đưa vào file này, không tự ghi memory** (memory ghi sự thật về code sẽ lỗi thời khi code đổi).

## Model theo loại việc

Orchestrator chọn model và effort cho thread khác bằng `set_session_model` / `set_session_effort` (không tự đổi model của chính mình).

| Loại việc | Model | Effort |
|---|---|---|
| Điều phối, kiểm chứng trước khi merge, phán đoán xuyên thread | Opus 5 | high |
| Nghiên cứu mở, đánh giá tool hay nguồn ngoài | Opus 5 | high |
| Critique và thiết kế UI, logic theme, việc nặng phán đoán | Opus 5 | high |
| Triển khai code theo spec đã rõ | Sonnet 5 | xhigh |
| Việc máy móc, không cần phán đoán, **không đọc `main.tsx`** (context chỉ 200K) | Haiku 4.5 | low / medium |

**Fable 5.1** là mức nâng cấp: chỉ dùng khi việc khó nhất vẫn bế tắc ở Opus, hoặc khi user yêu cầu (đắt gấp đôi Opus, lượt chạy lâu hơn). Đánh giá chi phí theo **việc hoàn thành**, không theo từng lượt: model rẻ mà phải làm lại thì không rẻ.

## Nhắn tin giữa các thread

- `SendMessage` chỉ **xếp hàng**; "success" không có nghĩa đã được đọc, và session idle **có thể không tự thức dậy**.
- Cần session idle **làm ngay**: dùng `mcp__ccd_session_mgmt__send_message` với `session_id`. `delivered` = lượt đã bắt đầu; `queued` = đang chờ sau việc hiện tại. `delivered` **vẫn có thể thất bại** (vd hết hạn mức sử dụng): xác nhận qua transcript.
- **Báo cáo kết thúc task gửi Orchestrator luôn bằng `mcp__ccd_session_mgmt__send_message`**, không bằng `SendMessage`: tin xếp hàng có thể không bao giờ tới.
- `session_id` lấy từ `list_sessions`. Tên trong `ListAgents` **khác** title trong `list_sessions`: xác nhận đúng session bằng transcript (`list_events`). Kiểm tra tin đã xử lý chưa: `isRunning` / `lastActivityAt`, hoặc tìm tin trong transcript.

## Git: mỗi task một worktree

- Bắt đầu task: `git worktree add .claude/worktrees/<task> -b <vai-tro>/<task> main` (hoặc `EnterWorktree`). `.claude/worktrees/` đã được ignore.
- **Không commit hay push thẳng lên `main`.** Commit trên branch của mình, báo Orchestrator merge. Tree chính dành cho Orchestrator.
- Đã merge: xoá worktree và branch.
- Worktree chỉ dời conflict sang lúc merge, **không xoá được conflict**, nên vẫn phải claim file nóng.

## File nóng: claim trước khi sửa

`apps/desktop/src/main.tsx`, `apps/desktop/src/styles.css` (gần như toàn bộ frontend) và `apps/desktop/src-tauri/src/lib.rs` (backend native). Nhắn Orchestrator vùng định sửa, chờ xác nhận; xong thì báo nhả.

## Định dạng report

Mọi report kết thúc task chia 3 phần, theo thứ tự:
1. **Đã làm**: việc đã làm và đã verify.
2. **Vấn đề phát hiện / tồn đọng**: vấn đề gặp phải, kể cả lỗi của chính mình, và mọi thứ còn dở (commit chưa push, tiến trình còn chạy, đường chưa verify, quyết định chờ user).
3. **Đề xuất**: bước tiếp theo, dạng đề xuất để user điều chỉnh.

## Verify

1. **Kiểm đúng mục tiêu.** Kiểm chứng phát hiện trên **commit SHA lúc phát hiện**, không phải working tree (`git log -S "<chuỗi>"`, `git show <sha>`), và ghi SHA vào report. Trước khi tin kết quả test, **chứng minh app đang chạy đúng code định test** (vd probe của chính bạn có mặt). Browser preview **không có Tauri runtime**: đường native (AI provider, `osascript`, sidecar) phải test trong app thật.
2. **"Không có" hay "0" chưa chứng minh là không có.** Kèm đối chứng cho thấy phép kiểm đọc được dữ liệu thật. Đừng đưa giá trị đang audit vào danh sách cho phép. Trong zsh viết `${VAR}:abc`, vì `$VAR:abc` bị hiểu là modifier. `grep -c` đếm **dòng**: CSS từ vite nằm trên một dòng, dùng `grep -o … | wc -l`.
3. **Biết mình đang đo cái gì.**
   - Giá trị từ `getComputedStyle`: kiểm tra `var()` có thật sự được khai báo (biến không tồn tại sẽ rơi về giá trị kế thừa). `buildProjectAppearanceStyle()` ghi đè token màu bằng inline style theo từng project, nên hex trong `:root` không phải lúc nào cũng là màu đang render.
   - Script quét CSS phải **tách selector nhóm** (`.a, .b { … }`).
   - Đếm phần tử theo class: popover render sẵn vẫn nằm trong DOM dù đang ẩn, nên giới hạn `:scope > …` hoặc lọc phần tử hiển thị.
   - Đo contrast: tính cả nền của chính phần tử chứa chữ, nhân `opacity` tổ tiên và alpha của màu chữ, bỏ chữ bị che (`elementFromPoint`) hoặc `opacity` ~0. `elementsFromPoint` bỏ qua phần tử `pointer-events: none`: gắn tạm `* { pointer-events: auto !important }`. Surface trong suốt một phần làm contrast phụ thuộc nội dung bên dưới: đo trên nền xấu nhất.
   - Browser pane đang ẩn thì `innerWidth`/`innerHeight` = 0: `resize_window` trước khi đo hình học. `javascript_tool` giới hạn 45 giây nhưng promise vẫn chạy tiếp trong trang: chia nhỏ, đừng chạy chồng.
   - Nút toggle hay đổi nhãn (Open ↔ Close): đóng theo trạng thái thật và assert đã đóng. Có phần tử luôn nằm trong DOM kể cả khi đóng (vd `.kira-dock` chỉ thu nhỏ): kiểm trạng thái mở bằng nội dung bên trong (ô nhập), không bằng sự có mặt của phần tử.
   - Browser pane ẩn làm transition/animation đứng giữa chừng, `getComputedStyle` trả màu dở dang: gắn tạm `*,*::before,*::after{transition:none!important;animation-duration:0s!important}` trước khi đo. Click theo `ref` thay vì tọa độ khi phần tử đang animate.
   - `grep` trên máy này là **ugrep**, bỏ qua `--include` và quét cả file khác loại: dùng `/usr/bin/grep` hoặc liệt kê file tường minh.
4. **Tên nút, tên command lấy từ memory hay tài liệu: grep lại trước khi dùng.**
5. **Trước khi báo xong một nhánh đụng `main.tsx`, `styles.css` hoặc `lib.rs`: chạy `node scripts/graphify-lite.mjs` trong worktree của nhánh đó.** Exit 2 là có lỗi (invoke chưa đăng ký, biến CSS chưa khai báo). Script đọc repo nơi chính nó nằm, nên chạy bản trong worktree đang kiểm, và đối chiếu dòng `Commit:` ở cuối.

## `styles.css`: token màu theo theme

Token màu do `buildProjectAppearanceStyle()` đặt inline trên `.app-shell`. Alias `var()` trỏ tới token đã theme phải khai ở `.app-shell`, **không ở `:root`**: alias ở `:root` được tính một lần tại root và không thấy style inline, nên bị đóng băng giá trị tĩnh. Phần tử portal ra `document.body` cũng không thấy token theme.

## `styles.css`: type scale

Mọi `font-size` là token: `--text-mini` 10px, `--text-small` 11px, `--text-body` 13px, `--text-title` 15px, `--text-large` 20px.
- Chữ **chức năng** (nhãn nút, trạng thái, chip, tag, form control): tối thiểu `--text-small` (11px).
- `--text-mini` (10px) chỉ cho chữ **phụ trợ**: số thứ tự bước dạng badge, số đếm "+N", mã hex mono trong ô màu. Không dùng cho nhãn hay trạng thái người dùng cần đọc để thao tác.
- Ngoại lệ ngoài token duy nhất: 2 display heading `clamp()` (onboarding hero, slide title).
- Cần cỡ mới thì thêm bậc vào scale, đừng viết giá trị dùng một lần. Không để phần tử nào inherit 14px từ root.

## Ràng buộc đã chốt

- **Claude Code provider**: CLI của user tự lo đăng nhập và token. KIRA không render login UI, không đọc hay lưu token; đăng nhập chỉ bằng mở Terminal chạy `claude auth login`. Không thêm OAuth hay device-code trong app: user đã từ chối.
- **Copy hiển thị cho user**: không em dash, dùng dấu phẩy, hai chấm hoặc dấu chấm (theo `.impeccable/critique/`). Prompt template gửi LLM không bị ràng buộc này.

## Gotcha khi dev

- **`main.tsx` không Fast Refresh được**: mỗi lần sửa, HMR reload toàn bộ và **reset state app**, kèm lỗi console `createRoot() on a container that has already been passed`. Lỗi đó chỉ có trên đường HMR; xác nhận bằng reload sạch.
- **Dev server** `kira-desktop` (`.claude/launch.json`): port 5173 thường bị thread khác chiếm, `autoPort` sẽ chọn port khác; đừng tắt tiến trình không phải của mình.
- **`preview_start` luôn chạy ở tree chính**, kể cả khi session đứng trong worktree (config không có `cwd`). Test code worktree: chạy tay `npx vite --host 127.0.0.1 --port <port>` trong `<worktree>/apps/desktop`, rồi `navigate` tới port đó.
- **App native**: `cargo run` chạy binary trần không có Info.plist, nên không điều khiển được bằng accessibility. Cần bundle thật: build frontend (`npx tsc -b && npx vite build` trong `apps/desktop`), rồi `npx tauri build --debug --bundles app --config '{"build":{"beforeBuildCommand":""}}'` (bỏ `beforeBuildCommand` vì nó chạy `xcodebuild` rất chậm). Bundle có cùng bundle id với KIRA đã cài: tắt khi test xong.
  - Build trong worktree: symlink tạm `apps/codex-helper/node_modules` và `apps/extension/dist` từ tree chính (xoá sau khi build: git coi symlink là untracked), và bỏ Safari appex bằng `--config '{"build":{"beforeBuildCommand":""},"bundle":{"macOS":{"files":{"PlugIns/KIRA Safari Extension.appex":null}}}}'` (thiếu DerivedData thì fail, và appex cùng bundle id có thể đăng ký đè extension của bản đã cài).

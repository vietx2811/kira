# CLAUDE.md: KIRA (vixio)

Mọi thread Claude trong repo này tự nạp file này. Luật dùng chung nằm ở đây, không nằm trong memory: thread chạy trong worktree có project dir riêng và **không thấy memory của tree chính**. Luật design và sản phẩm: xem `DESIGN.md`, `PRODUCT.md` (không chép lại).

## Vai trò

Tên session có thể đổi: tìm tên hiện tại bằng `ListAgents`, đừng hardcode.

- **Orchestrator**: điều phối, giao việc, **người duy nhất merge vào `main` và push**, giữ memory dùng chung.
- **UI/UX**: critique và thiết kế giao diện.
- **Researcher**: nghiên cứu, lưu báo cáo ở `docs/research/` theo `docs/research/README.md`. Không sửa code app.
- **Worker**: triển khai việc được giao (frontend, script, tooling).
- **Art Director**: khảo sát thẩm mỹ và định hướng phong cách (tổng thể, hệ control, nút bấm) theo chuẩn app canvas desktop. Viết báo cáo và specimen trong `docs/research/`, không sửa code app; UI/UX và Worker hiện thực hoá sau khi user chốt.
- **Native/Backend**: `src-tauri/` (`lib.rs`, command Tauri, sidecar, đường native macOS). Tách khỏi `main.tsx` nên hầu như không tranh chấp file với UI/UX và Worker.

Đổi vai trò, hoặc có bài học dùng chung: **báo Orchestrator để đưa vào file này, không tự ghi memory** (memory ghi sự thật về code sẽ lỗi thời khi code đổi).

## Model theo loại việc

Orchestrator chọn model và effort cho thread khác bằng `set_session_model` / `set_session_effort` (không tự đổi model của chính mình). **Chọn theo loại việc của task đang giao, không theo vai trò cố định của thread**: cùng một thread UI/UX có thể chạy Opus khi phán đoán thiết kế và Sonnet khi chỉ thay token theo spec. Kiểm model hiện tại bằng `get_session` trước khi giao, và ghi model đã chọn vào brief.

| Loại việc | Model | Effort |
|---|---|---|
| Triển khai code theo spec, sửa lỗi, viết tài liệu theo khung có sẵn | Sonnet 5 | high |
| Critique, đặc tả bố cục, nghiên cứu có khung câu hỏi rõ | Sonnet 5 | high (medium nếu chỉ tổng hợp) |
| Việc máy móc: đếm, grep, đo contrast theo script, dọn file; **không đọc `main.tsx`** (context 200K) | Haiku 4.5 | low / medium |
| Quyết định thẩm mỹ gốc (hướng phong cách mới), phán đoán xuyên thread khó, việc Sonnet đã làm lại quá 1 lần | Opus 5 | high |

**Tiết kiệm token (user yêu cầu 2026-09-15):** mặc định Sonnet; Opus chỉ khi bảng trên nói vậy; **không dùng xhigh** trừ khi bế tắc. Ảnh chụp để kiểm: JPEG, scale 0.5, chỉ khung cần xem. Brief ngắn, trỏ tới file thay vì chép lại. Không chạy lại phép đo mà thread đã báo đủ số và cách đo; Orchestrator chỉ kiểm tĩnh (diff, test, `--strict`) và spot-check 1 màn khi rủi ro cao.

**Fable 5.1** là mức nâng cấp: chỉ dùng khi việc khó nhất vẫn bế tắc ở Opus, hoặc khi user yêu cầu (đắt gấp đôi Opus, lượt chạy lâu hơn). Đánh giá chi phí theo **việc hoàn thành**, không theo từng lượt: model rẻ mà phải làm lại thì không rẻ.

## Nhắn tin giữa các thread

- `SendMessage` chỉ **xếp hàng**; "success" không có nghĩa đã được đọc, và session idle **có thể không tự thức dậy**.
- Cần session idle **làm ngay**: dùng `mcp__ccd_session_mgmt__send_message` với `session_id`. `delivered` = lượt đã bắt đầu; `queued` = đang chờ sau việc hiện tại. `delivered` **vẫn có thể thất bại** (vd hết hạn mức sử dụng): xác nhận qua transcript.
- **Báo cáo kết thúc task gửi Orchestrator luôn bằng `mcp__ccd_session_mgmt__send_message`**, không bằng `SendMessage`: tin xếp hàng có thể không bao giờ tới.
- Gửi tới session **đang chạy** thì tin `queued` và chỉ tới khi lượt đó kết thúc. Orchestrator đừng giữ một lượt quá dài khi đang chờ báo cáo; muốn đọc ngay thì xem transcript bằng `list_events`.
- `session_id` lấy từ `list_sessions`. Tên trong `ListAgents` **khác** title trong `list_sessions`: xác nhận đúng session bằng transcript (`list_events`). Kiểm tra tin đã xử lý chưa: `isRunning` / `lastActivityAt`, hoặc tìm tin trong transcript.

## Git: mỗi task một worktree

- Bắt đầu task: `git worktree add .claude/worktrees/<task> -b <vai-tro>/<task> main` (hoặc `EnterWorktree`). `.claude/worktrees/` đã được ignore.
- **Không commit hay push thẳng lên `main`.** Commit trên branch của mình, báo Orchestrator merge. Tree chính dành cho Orchestrator.
- Đã merge: xoá worktree và branch. Riêng **agent nền do Orchestrator tạo** (Agent tool, `isolation: worktree`): giữ worktree tới khi user chốt báo cáo của nó, vì xoá rồi thì không nhắn tiếp được và phải lập agent mới từ đầu.
- Worktree chỉ dời conflict sang lúc merge, **không xoá được conflict**, nên vẫn phải claim file nóng.

## File nóng: claim trước khi sửa

`apps/desktop/src/main.tsx`, `apps/desktop/src/styles.css` (gần như toàn bộ frontend) và `apps/desktop/src-tauri/src/lib.rs` (backend native). Nhắn Orchestrator vùng định sửa, chờ xác nhận; xong thì báo nhả.

## Định dạng report

Mọi report kết thúc task chia 3 phần, theo thứ tự:
1. **Đã làm**: việc đã làm và đã verify.
2. **Vấn đề phát hiện / tồn đọng**: vấn đề gặp phải, kể cả lỗi của chính mình, và mọi thứ còn dở (commit chưa push, tiến trình còn chạy, đường chưa verify, quyết định chờ user).
3. **Đề xuất**: bước tiếp theo, dạng đề xuất để user điều chỉnh.

**Orchestrator báo cáo cho user về giao diện (kể cả report tổng kết QA/sửa) kèm screenshot thật** (chụp bằng Browser pane hoặc app native, gửi qua `SendUserFile`), không chỉ mô tả bằng chữ/bảng điểm — user cần nhìn thấy, không chỉ đọc số đo.

**Cách chụp app native ra file thật (đã kiểm chứng hoạt động):** công cụ `computer` của Browser pane và `app_screenshot` nền của `computer-use` chỉ trả ảnh vào ngữ cảnh của agent, **không ghi ra đĩa** — không dùng để lấy file gửi user. Cách chụp ra file:
1. Xác nhận app đang mở là **bản mới nhất**, không phải bản cũ cài từ trước: `mdls -name kMDItemContentModificationDate /Applications/KIRA.app` so với `git log -1 --format=%ci` trên `main`. Nếu cũ, build lại theo mục Gotcha "App native" rồi `open "<path đến bundle debug vừa build>"`.
2. `mcp__computer-use__request_access` (app "KIRA") rồi `mcp__computer-use__request_full_control` (cần user duyệt hộp thoại, chỉ hỏi một lần mỗi phiên) để dùng được `computer_batch` (click chuột thật — `app_click` chạy nền không kích hoạt được React canvas của KIRA).
3. Phóng to cửa sổ KIRA full màn hình (bấm nút xanh lá) để tránh chụp dính cửa sổ khác.
4. `screencapture -x /tmp/<tên>.png` (không dùng tham số `save_to_disk` của `computer_batch`: đường dẫn nó trả về không truy cập được từ Bash).
5. **Bắt buộc tự `Read` lại ảnh trước khi gửi** để xác nhận sạch, không dính cửa sổ khác (Finder, System Settings, sidebar các session Claude khác) — full-screen capture khi cửa sổ KIRA không full màn hình đã từng dính nội dung nhạy cảm không liên quan, phải xoá ngay khi phát hiện.
6. Dọn file tạm trong `/tmp` sau khi gửi xong.

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
5. **Trước khi báo xong một nhánh đụng `main.tsx`, `styles.css` hoặc `lib.rs`: chạy `node scripts/graphify-lite.mjs --strict` trong worktree của nhánh đó.** Exit 2 là có lỗi (invoke chưa đăng ký, biến CSS chưa khai báo, màu ở lớp nền không cuối). Hai cảnh báo `open_project_package*` là đã biết và vô hại: được gọi qua biểu thức ba ngôi trong `openNativeProjectPackage()`, script chỉ bắt tên command viết literal. Script đọc repo nơi chính nó nằm, nên chạy bản trong worktree đang kiểm, và đối chiếu dòng `Commit:` ở cuối.

## `styles.css`: token màu theo theme

Token màu do `buildProjectAppearanceStyle()` đặt inline trên `.app-shell`. Alias `var()` trỏ tới token đã theme phải khai ở `.app-shell`, **không ở `:root`**: alias ở `:root` được tính một lần tại root và không thấy style inline, nên bị đóng băng giá trị tĩnh. Phần tử portal ra `document.body` cũng không thấy token theme.

## `styles.css`: type scale

Mọi `font-size` là token: `--text-mini` 10px, `--text-small` 11px, `--text-body` 13px, `--text-title` 15px, `--text-large` 20px.
- Chữ **chức năng** (nhãn nút, trạng thái, chip, tag, form control): tối thiểu `--text-small` (11px).
- `--text-mini` (10px) chỉ cho chữ **phụ trợ**: số thứ tự bước dạng badge, số đếm "+N", mã hex mono trong ô màu. Không dùng cho nhãn hay trạng thái người dùng cần đọc để thao tác.
- Ngoại lệ ngoài token duy nhất: 2 display heading `clamp()` (onboarding hero, slide title).
- Cần cỡ mới thì thêm bậc vào scale, đừng viết giá trị dùng một lần. Không để phần tử nào inherit 14px từ root.

## Skill thiết kế

User chốt 2026-09-15 (báo cáo `docs/research/2026-09-15-design-skills-github.md`):
- **Không dùng `design-taste-frontend`** (ép Next.js/Tailwind, chính tác giả loại product UI khỏi phạm vi) và `high-end-visual-design`.
- Bộ skill, theo thứ tự ưu tiên khi mâu thuẫn: `DESIGN.md` > `kira-controls` (skill nội bộ trong repo, `.claude/skills/kira-controls/`) > **impeccable** (Operate, sàn chất lượng) > **apple-design** (HIG macOS: nút, toolbar, icon, Liquid Glass) > **refactoring-ui** (chỉ lấy kỹ thuật chiều sâu và bóng, **không** lấy thang spacing hay bóng của nó) > **emil-design-eng** (chỉ cảm giác nhấn và motion; không spring cho control).
- 3 skill ngoài do user tự cài ở cấp user (`~/.claude/skills/`). Chưa có thì báo, không tự cài. `apple-design` không có license: không chép vào repo.
- **Phong cách control đã chốt: Ink & Paper** (`docs/research/2026-09-14-art-direction-controls-v2.md`, specimen `docs/research/art-direction/v2/controls-v2.html`). Không đổi bố cục theo từng màn: app phải nhất quán.

## Ràng buộc đã chốt

- **Claude Code provider**: CLI của user tự lo đăng nhập và token. KIRA không render login UI, không đọc hay lưu token; đăng nhập chỉ bằng mở Terminal chạy `claude auth login`. Không thêm OAuth hay device-code trong app: user đã từ chối.
- **Copy hiển thị cho user**: không em dash, dùng dấu phẩy, hai chấm hoặc dấu chấm (theo `.impeccable/critique/`). Prompt template gửi LLM không bị ràng buộc này.

## Gotcha khi dev

- **`main.tsx` không Fast Refresh được**: mỗi lần sửa, HMR reload toàn bộ và **reset state app**, kèm lỗi console `createRoot() on a container that has already been passed`. Lỗi đó chỉ có trên đường HMR; xác nhận bằng reload sạch.
- **Dev server** `kira-desktop` (`.claude/launch.json`): port 5173 thường bị thread khác chiếm, `autoPort` sẽ chọn port khác; đừng tắt tiến trình không phải của mình.
- **`preview_start` luôn chạy ở tree chính**, kể cả khi session đứng trong worktree (config không có `cwd`). Test code worktree: chạy tay `npx vite --host 127.0.0.1 --port <port>` trong `<worktree>/apps/desktop`, rồi `navigate` tới port đó.
- **App native**: `cargo run` chạy binary trần không có Info.plist, nên không điều khiển được bằng accessibility. Cần bundle thật: build frontend (`npx tsc -b && npx vite build` trong `apps/desktop`), rồi `npx tauri build --debug --bundles app --config '{"build":{"beforeBuildCommand":""}}'` (bỏ `beforeBuildCommand` vì nó chạy `xcodebuild` rất chậm). Bundle có cùng bundle id với KIRA đã cài: tắt khi test xong.
  - Build trong worktree: symlink tạm 4 đường từ tree chính (`node_modules`, `apps/desktop/node_modules`, `apps/codex-helper/node_modules`, `apps/extension/dist`; thiếu 2 cái sau thì fail ở `@openai/codex-sdk` và `../../extension/dist`), xoá ngay sau build vì git coi symlink là untracked. Bỏ Safari appex bằng `--config '{"build":{"beforeBuildCommand":""},"bundle":{"macOS":{"files":{"PlugIns/KIRA Safari Extension.appex":null}}}}'` (`--config` là JSON merge patch, `null` để xoá key): thiếu DerivedData thì fail, và appex cùng bundle id có thể đăng ký đè extension Safari của bản đã cài.
  - Bản debug có Web Inspector (chuột phải, Inspect Element): cách duy nhất đọc `data-glass-state` và token thật trong app native. Gõ phím vào Inspector hay lỗi ký tự, dán qua clipboard. WKWebView **không nhận click khi app ở nền**, và vibrancy chỉ đúng khi cửa sổ active (`FollowsWindowActiveState`): đưa app lên trước rồi mới thao tác.

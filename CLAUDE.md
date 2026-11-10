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
- **QA Extension** (lập 2026-09-20): kiểm extension trình duyệt, đường đẩy ảnh về app qua `http://127.0.0.1:47653`. Không sửa code app.
- **QA AI** (lập 2026-09-20): kiểm đường AI trong app native, trạng thái Codex, sinh khung ý tưởng và sinh nhánh. Không sửa code app.

**Đăng nhập CLI của provider là việc của user, không phải của thread.** Thread được phép chạy lệnh đăng nhập để CLI tự mở trình duyệt, nhưng không nhập email, mật khẩu, OTP, không bấm nút cấp quyền hộ user, và không đọc hay chép nội dung file token (`~/.codex/auth.json` và tương đương): chỉ báo có hay không.

Đổi vai trò, hoặc có bài học dùng chung: **báo Orchestrator để đưa vào file này, không tự ghi memory** (memory ghi sự thật về code sẽ lỗi thời khi code đổi).

**Giao việc cho thread trên sidebar, không sinh agent nền** (user chốt 2026-09-20). Các thread của dự án nằm trong nhóm `KIRA (vixio) · Team`: lấy `session_id` bằng `list_sessions`, giao bằng `mcp__ccd_session_mgmt__send_message`. Agent tool (`isolation: worktree`) chỉ dùng khi user nói rõ, vì agent nền khởi động lạnh và không nằm trên sidebar để user theo dõi hay chen vào.

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
- **Tin tới Orchestrator đang idle hay trả "not delivered … gave no sign of starting on it within 20s" và không đánh thức nó** (kiểm 2026-11-09 qua transcript: rơi đúng vào những lúc Orchestrator idle). Thread gửi: kết quả đó **không** có nghĩa là phải gửi lại liên tục; gửi một lần là đủ. Orchestrator: khi đang chờ báo cáo, chạy `python3 -I scripts/watch-orchestrator-mail.py <session_id của mình> <uuid transcript của mình>` trong công cụ `Monitor` (tối đa 30 phút, hết hạn thì arm lại). Script chỉ đọc phần mới của transcript các thread và in một dòng mỗi lần có `send_message` nhắm vào Orchestrator, nên bắt được cả tin "not delivered". `list_sessions` không liệt kê chính session đang gọi: session_id của mình lấy bằng `get_session` hoặc từ tin cũ của thread.
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

**Quyền điều khiển app bị từ chối thì dừng, không đi vòng** (sự cố 2026-09-20). Một session QA bị user từ chối `request_access` cho KIRA, rồi dùng `osascript` / System Events gửi phím thay thế. Đường đó **không có chốt kiểm app nào đang ở trước**: sau `activate`, một cửa sổ khác của user nhảy lên trên, phím rơi vào đó, và `screencapture` dính nội dung riêng tư không liên quan dự án.
- `request_access` hoặc `request_full_control` bị từ chối: **dừng phần việc native, báo cáo, hết**. Từ chối là câu trả lời, không phải chướng ngại cần vòng qua.
- **Không dùng `osascript` / System Events để gửi phím hay click vào app**, kể cả khi đã được cấp quyền: dùng `computer_batch` của computer-use, vì nó kiểm app frontmost trước mỗi hành động.
- `osascript` còn dùng được cho **đọc trạng thái** và **đổi vị trí, kích thước cửa sổ**. Nhưng **vòng đời tiến trình thì dùng `ps`, `pgrep`, `pkill` thẳng**, đừng `tell process … to quit`: lệnh đó đi qua đúng kênh accessibility, nhắm theo tên tiến trình nên có thể trúng nhầm, và thực tế 2026-09-21 nó thất bại còn `pkill -f` mới tắt được. Ranh giới để khỏi phải cân nhắc từng lần: **System Events không bao giờ dùng để tác động vào app, chỉ để quan sát và để xếp cửa sổ.**
- Không bật, tắt hay đổi cài đặt trợ năng của user (VoiceOver, Zoom, Reduce Motion ở cấp hệ thống): giả lập bằng CDP `Emulation.setEmulatedMedia` trong trình duyệt thay vì đụng máy.
- `screencapture` toàn màn hình chỉ dùng **sau khi** được cấp quyền, và **bắt buộc tự `Read` lại ảnh trước khi gửi đi bất cứ đâu**. Dính cửa sổ khác thì xoá ngay và báo trong report.
- **Ranh giới thật nằm ở "chiếm màn hình của user", không phải ở "viết chương trình test"** (làm rõ 2026-09-21 sau khi QA Theme Matrix tự dựng một `WKWebView` bằng Swift để đo WebKit khi bị từ chối quyền):
  - **Điều khiển app của user** (KIRA, trình duyệt, bất cứ app nào họ đang dùng): cần quyền, bị từ chối thì dừng.
  - **Chạy chương trình của chính mình** (dev server, Chrome headless, một harness tự viết): bình thường, không cần xin.
  - **Nhưng đưa cửa sổ lên trước, chiếm frontmost, phủ lên màn hình** thì cần quyền **dù cửa sổ đó là của chương trình mình vừa viết**: nó cướp máy của user đang ngồi làm việc. `NSApp.activate(ignoringOtherApps:)`, `open -a`, mở cửa sổ giữa màn hình đều thuộc nhóm này. Ưu tiên render ngoài màn hình; nếu phép đo bắt buộc phải thấy được cửa sổ thì **xin quyền, đừng tự lấy**.
  - **Điều kiện đúng là `visible`, không phải "key window".** Harness tự viết phải assert `document.visibilityState === 'visible'`, không chỉ `document.hasFocus()`: cửa sổ ngoài màn hình vẫn giữ được focus bàn phím và `:focus-visible` vẫn khớp, nhưng trang bị treo render nên **mọi transition và animation đứng tại t = 0**, và phép đo sai **mà không báo lỗi**. Nếu phép đo chạm vào bất cứ thứ gì có transition hoặc animation mà không đạt được `visible` thì kết quả **không dùng được**: xin quyền, hoặc bỏ phép đo đó và ghi là chưa kiểm. Một rig lấy key window ngoài màn hình vẫn dính đúng lỗi này.
- Brief giao việc **không được gợi ý đường đi vòng**. Brief ngày 2026-09-20 của Orchestrator có gợi ý `osascript ... key code 53` làm phép đối chứng: đó là chỉ dẫn sai, đã rút lại.

**Màn hình khoá: kiểm trước, đừng khám phá giữa chừng.** Chạy `scripts/screen-ready.sh` **trước khi lập kế hoạch bất kỳ việc nào cần app native hoặc ảnh chụp màn hình**. Exit 0 là dùng được, exit 2 là không, và nó in sẵn cách xử lý. Phép kiểm quyết định là chụp thật một mẩu 320×64 rồi soi pixel (màn hình khoá chụp ra đen tuyền), nên nó đúng với cả khoá lẫn màn hình đã ngủ.

Nguyên nhân gốc, để không phải dò lại: `keep_awake_while_working` của app Claude giữ `PreventUserIdleSystemSleep` nên máy không ngủ, **nhưng không giữ `PreventUserIdleDisplaySleep`**. Màn hình vẫn tắt theo `pmset displaysleep` (máy này đặt **5 phút**) và khoá đi theo. `scripts/screen-ready.sh --arm` giữ hộ 12 giờ bằng một assertion `caffeinate -d -i -u`, đúng cơ chế trình phát video dùng: **không đổi setting nào, không cần mật khẩu, tắt máy hoặc `--release` là hết**. Orchestrator arm một lần mỗi phiên làm việc dài; thread khác chỉ cần chạy bản không tham số để biết mình có làm được không.

Không tự sửa `pmset displaysleep`, không đụng cài đặt khoá màn hình: đó là cài đặt bảo mật của user.

**Khi exit 2 (không chụp được app native):** làm phần chạy được bằng Bash trước, báo cáo, **không ngồi chờ**. Giao diện kiểm được bằng trình duyệt thì không cần màn hình chút nào: chạy Chrome headless có CDP.

**Đừng tự dựng lại harness CDP: repo đã có `docs/design/input-audit/tools/cdp.mjs`.** Nó lo sẵn spawn Chrome, `Runtime.evaluate`, click chuột thật, chụp màn hình, và đặt tên profile theo PID để `pkill` của bạn không trúng session khác. **Dùng `evaluateStrict`, không dùng `evaluate`**: bản cũ trả `{__error}` thay vì ném, nên một exception trong trang đọc ra như một giá trị bình thường. Hai session đã tự viết lại harness này trong cùng một ngày và **cả hai bản tự viết đều mắc đúng lỗi nuốt lỗi đó**, vì `CLAUDE.md` chưa từng trỏ tới file có sẵn. Thiếu gì thì thêm vào file dùng chung, đừng viết bản thứ ba.

Công thức dựng tay, chỉ dùng khi cần thứ harness không có:
- `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --remote-debugging-port=9333 --user-data-dir=<scratch>/chrome-profile --no-first-run about:blank &`
- Node 22 có `WebSocket` sẵn, không cần cài gì: nối tới `webSocketDebuggerUrl` từ `http://127.0.0.1:9333/json/list`, rồi `Emulation.setDeviceMetricsOverride` (đặt `deviceScaleFactor: 2` cho ảnh nét), `Page.navigate`, `Runtime.evaluate` (`awaitPromise: true`) để bấm nút và gọi `window.__kiraDev.loadFixture(...)`, cuối cùng `Page.captureScreenshot` và ghi base64 ra file.
- So sánh trước/sau: `git worktree add … --detach <sha cũ>`, symlink `node_modules` + `apps/desktop/node_modules`, chạy `npx vite --port <port khác>`, chụp cùng một kịch bản trên hai port.
- Cắt ảnh bằng `sips -c <cao> <rộng> --cropOffset <y> <x>` (offset là Y trước, X sau; đừng dùng 0, xem mục Gotcha).

## Verify

0. **Cần app native hay ảnh chụp màn hình: chạy `scripts/screen-ready.sh` trước khi lập kế hoạch.** Exit 2 thì làm phần Bash trước rồi báo, đừng chờ. Xem mục "Màn hình khoá" ở trên.
0b. **Việc UI phải kiểm bằng browser, không chỉ đọc code** (user chốt 2026-09-20). Mở app, thao tác thật vào control đang sửa, đo `getComputedStyle` và chụp lại. Riêng focus: `element.focus()` bằng script **không** kích hoạt `:focus-visible`, nên phải click hoặc Tab bằng phím thật rồi mới đo, và assert `el.matches(':focus-visible')`.
0c. **Khẳng định về focus phải đo trong trình duyệt hiển thị, bằng phím và chuột thật.** Chrome headless sai ở cả focus restore lẫn viewport (device metrics override mất giữa các kết nối CDP, nút bị đẩy ngoài khung, click trượt, `activeElement` ở nguyên `body` trông y như lỗi app). QA Accessibility 2026-09-21 tạo ra 2 báo cáo lỗi giả đúng theo hai đường này.

0d. **Phép đo sau mâu thuẫn phép đo trước thì A/B theo commit, đừng vội gọi cái cũ là artifact.** `git worktree add … --detach <sha cũ>`, symlink `node_modules`, chạy vite ở port riêng, đo cùng kịch bản trên hai bản. Ví dụ đã xảy ra: focus vào dialog Settings tại `4093015` là **lands 77ms rồi mất ở 564ms, rơi về `body`**; tại `56ad91e` trở đi là **lands 87ms và ở lại**. Cả hai đo trong cùng browser pane ẩn. Không ai đo sai: **code đã đổi giữa hai lần đo**. Nếu chỉ đo bản mới rồi kết luận bản cũ là artifact thì sẽ xoá nhầm một phát hiện thật.

1. **Kiểm đúng mục tiêu.** Kiểm chứng phát hiện trên **commit SHA lúc phát hiện**, không phải working tree (`git log -S "<chuỗi>"`, `git show <sha>`), và ghi SHA vào report. Trước khi tin kết quả test, **chứng minh app đang chạy đúng code định test** (vd probe của chính bạn có mặt). Browser preview **không có Tauri runtime**: đường native (AI provider, `osascript`, sidecar) phải test trong app thật.
2. **"Không có" hay "0" chưa chứng minh là không có.** Kèm đối chứng cho thấy phép kiểm đọc được dữ liệu thật. Đừng đưa giá trị đang audit vào danh sách cho phép. Trong zsh viết `${VAR}:abc`, vì `$VAR:abc` bị hiểu là modifier. `grep -c` đếm **dòng**: CSS từ vite nằm trên một dòng, dùng `grep -o … | wc -l`.
3. **Biết mình đang đo cái gì.**
   - Giá trị từ `getComputedStyle`: kiểm tra `var()` có thật sự được khai báo (biến không tồn tại sẽ rơi về giá trị kế thừa). `buildProjectAppearanceStyle()` ghi đè token màu bằng inline style theo từng project, nên hex trong `:root` không phải lúc nào cũng là màu đang render.
   - Script quét CSS phải **tách selector nhóm** (`.a, .b { … }`).
   - Đếm phần tử theo class: popover render sẵn vẫn nằm trong DOM dù đang ẩn, nên giới hạn `:scope > …` hoặc lọc phần tử hiển thị.
   - Đo contrast: tính cả nền của chính phần tử chứa chữ, nhân `opacity` tổ tiên và alpha của màu chữ, bỏ chữ bị che (`elementFromPoint`) hoặc `opacity` ~0. `elementsFromPoint` bỏ qua phần tử `pointer-events: none`: gắn tạm `* { pointer-events: auto !important }`. Surface trong suốt một phần làm contrast phụ thuộc nội dung bên dưới: đo trên nền xấu nhất.
   - Browser pane đang ẩn thì `innerWidth`/`innerHeight` = 0: `resize_window` trước khi đo hình học. `javascript_tool` giới hạn 45 giây nhưng promise vẫn chạy tiếp trong trang: chia nhỏ, đừng chạy chồng.
   - Nút toggle hay đổi nhãn (Open ↔ Close): đóng theo trạng thái thật và assert đã đóng. Có phần tử luôn nằm trong DOM kể cả khi đóng (vd `.kira-dock` chỉ thu nhỏ): kiểm trạng thái mở bằng nội dung bên trong (ô nhập), không bằng sự có mặt của phần tử.
   - **`document.hasFocus()` và `document.visibilityState` độc lập nhau**: cửa sổ giữ được focus bàn phím mà vẫn bị coi là ẩn, và lúc đó transition **đứng tại t = 0**. Assert `visibilityState === 'visible'`, đừng chỉ assert `hasFocus()`. Dấu hiệu nhận ra một giá trị đang ở giữa transition thay vì đứng yên: trình duyệt nội suy màu trong oklab, nên serialize ra `oklab(...)` trong khi trạng thái nghỉ serialize `oklch(...)`. **Một giá trị thật sự không đổi thì serialize y hệt nhau**; đổi dạng chuỗi là bằng chứng style đã tính lại. QA Theme Matrix 2026-09-21 có hai chuỗi đó cạnh nhau trong bảng của mình và vẫn kết luận nhầm là "ring không đổi".
   - **Đếm số đối chứng là vô nghĩa nếu chúng chung một điểm gãy.** Cùng phiên đó có 4 đối chứng cho một kết luận sai; 3 cái sụp cùng lúc vì cùng phụ thuộc vào cửa sổ ẩn (hai ảnh giống nhau từng byte chỉ là *hệ quả* của trang treo render, không phải bằng chứng độc lập; lặp lại trên 3 ô đều là kit Input tức cùng mang `transition-shadow`). Trước khi tin một bộ đối chứng, hỏi: nếu giả thuyết của tôi sai vì lý do X, có cái nào trong đây vẫn đứng không?
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

## UI kit

User chốt 2026-09-16: **Untitled UI React** (Tailwind CSS v4 + React Aria, untitledui.com/react) là bộ component chính. **Khai thác tối đa component viết sẵn của kit** — chỉ tự viết khi kit không có (vd panel resize, canvas, node). Migrate từng màn, CSS thuần cũ (`styles.css`) chung sống tới khi màn cuối chuyển xong. Căn cứ: `docs/research/2026-09-16-tailwind-kit-migration.md`, `docs/research/2026-09-16-art-direction-v3-kit-directions.md` (hướng C). Ink & Paper và `kira-controls` chỉ còn áp cho phần chưa migrate và phần kit không có.

## Skill thiết kế

User chốt 2026-09-15 (báo cáo `docs/research/2026-09-15-design-skills-github.md`):
- **Không dùng `design-taste-frontend`** (ép Next.js/Tailwind, chính tác giả loại product UI khỏi phạm vi) và `high-end-visual-design`.
- Bộ skill, theo thứ tự ưu tiên khi mâu thuẫn: `DESIGN.md` > `kira-controls` (skill nội bộ trong repo, `.claude/skills/kira-controls/`) > **impeccable** (Operate, sàn chất lượng) > **apple-design** (HIG macOS: nút, toolbar, icon, Liquid Glass) > **refactoring-ui** (chỉ lấy kỹ thuật chiều sâu và bóng, **không** lấy thang spacing hay bóng của nó) > **emil-design-eng** (chỉ cảm giác nhấn và motion; không spring cho control).
- 3 skill ngoài do user tự cài ở cấp user (`~/.claude/skills/`). Chưa có thì báo, không tự cài. `apple-design` không có license: không chép vào repo.
- **Phong cách control đã chốt: Ink & Paper** (`docs/research/2026-09-14-art-direction-controls-v2.md`, specimen `docs/research/art-direction/v2/controls-v2.html`). Không đổi bố cục theo từng màn: app phải nhất quán.

## Ràng buộc đã chốt

- **Claude Code provider**: CLI của user tự lo đăng nhập và token. KIRA không render login UI, không đọc hay lưu token; đăng nhập chỉ bằng mở Terminal chạy `claude auth login`. Không thêm OAuth hay device-code trong app: user đã từ chối.
- **Persona của user** (chốt 2026-11-08): Kira tự đọc `~/.creative-os/user.json` (chỉ đúng file đó) lúc mở app và đặt khối "ABOUT THE USER" trước mọi prompt văn bản (`kira/ai/persona.ts`). Sửa trong Settings > General > Về bạn; lưu giữ nguyên các trường của công cụ khác trong file. Đọc thẳng `CLAUDE.md` và thư mục memory của Claude Code vào KIRA: **chưa chốt**, đang cân nhắc.
- **Copy hiển thị cho user**: không em dash, dùng dấu phẩy, hai chấm hoặc dấu chấm (theo `.impeccable/critique/`). Prompt template gửi LLM không bị ràng buộc này.

## Gotcha khi dev

- **Node trên canvas nghe `pointerdown`, không phải `mousedown`** (`startNodeDrag`): script test dispatch `mousedown` thì kéo node và multi-select không kích hoạt, trông như tính năng hỏng. Dùng `PointerEvent`.
- **`window.__kiraDev` được dựng lại mỗi lần render**: đọc `window.__kiraDev` **mới ở từng lời gọi**, đừng giữ tham chiếu vào biến. Giữ tham chiếu là gọi vào closure cũ và đọc state cũ, cho ra kết quả sai trông y như lỗi app (QA Project Files dính đúng bẫy này 2026-09-20 và suýt báo nhầm).
- **`main.tsx` không Fast Refresh được**: mỗi lần sửa, HMR reload toàn bộ và **reset state app**, kèm lỗi console `createRoot() on a container that has already been passed`. Lỗi đó chỉ có trên đường HMR; xác nhận bằng reload sạch.
- **Dev server** `kira-desktop` (`.claude/launch.json`): port 5173 thường bị thread khác chiếm, `autoPort` sẽ chọn port khác; đừng tắt tiến trình không phải của mình.
- **Giết tiến trình thì giết theo PID mình bắt lúc spawn, không giết theo pattern** (sự cố 2026-09-21). Một session dọn dẹp bằng `pkill -f "kira-cdp-"` rồi `rm -rf` các thư mục `kira-cdp-*`: tiền tố đó **hardcode trong `docs/design/input-audit/tools/cdp.mjs`, một file dùng chung**, nên nó khớp Chrome headless của mọi session dùng helper ấy. Nó giết Chrome của session khác **giữa lúc đang đo** và xoá thư mục profile ra từ dưới chân một tiến trình đang chạy.
  - Bắt PID lúc spawn (`$!`, hoặc `serverId` / PID mà công cụ trả về) và chỉ kill đúng PID đó.
  - **"Đã kill" chưa chứng minh là đã chết: xác nhận bằng `ps -p <PID>`.** UI/UX 2026-09-21 báo đã tắt một script treo, thực tế nó sống thêm 14 phút và chính nó là tiến trình bị session khác giết nhầm.
  - **Không** `pkill -f` theo tên lấy từ tool dùng chung (`kira-cdp-`, `vite`, `chrome`, một số port). Nếu buộc phải tìm theo pattern thì đối chiếu **tuổi tiến trình** và **UUID scratchpad của chính mình** trong dòng lệnh trước khi kill, và in ra danh sách sắp giết để tự soi.
  - **Hình dạng chung của lỗi này, đáng nhớ hơn từng ca:** mô tả thứ mình muốn tác động bằng một đặc điểm **không phân biệt được của mình với của người khác**. Cùng một hình dạng đã xuất hiện ba lần trong một ngày: `NSApp.activate(ignoringOtherApps:)` (chiếm máy user), `tell process … to quit` (nhắm theo tên tiến trình), và `pkill -f` theo tiền tố dùng chung. Trước khi chạy lệnh tác động, hỏi: **pattern này có khớp thứ của ai khác không?**
- **`preview_start` luôn chạy ở tree chính**, kể cả khi session đứng trong worktree (config không có `cwd`). Test code worktree: chạy tay `npx vite --host 127.0.0.1 --port <port>` trong `<worktree>/apps/desktop`, rồi `navigate` tới port đó.
- **App native**: `cargo run` chạy binary trần không có Info.plist, nên không điều khiển được bằng accessibility. Cần bundle thật: build frontend (`npx tsc -b && npx vite build` trong `apps/desktop`), rồi `npx tauri build --debug --bundles app --config '{"build":{"beforeBuildCommand":""}}'` (bỏ `beforeBuildCommand` vì nó chạy `xcodebuild` rất chậm). Bundle có cùng bundle id với KIRA đã cài: tắt khi test xong.
  - Build trong worktree: symlink tạm 4 đường từ tree chính (dùng `ln -sfn`, **không** `ln -s`: chạy `ln -s` lần hai khi link đã có sẽ tạo link *bên trong* thư mục đích ở tree chính, vd `apps/extension/dist/dist -> dist`, rồi bị chép vào bundle Safari; đã xảy ra 2026-11-09) (`node_modules`, `apps/desktop/node_modules`, `apps/codex-helper/node_modules`, `apps/extension/dist`; thiếu 2 cái sau thì fail ở `@openai/codex-sdk` và `../../extension/dist`), xoá ngay sau build vì git coi symlink là untracked. `cargo build`/`cargo test` trong worktree có thể tự xoá 4 symlink đó (bước build của `codex-helper`); thư mục thật ở tree chính không bị đụng, chỉ cần tạo lại. `cargo test` cần đủ symlink, nếu không thì merge rồi chạy test ở tree chính. Bỏ Safari appex bằng `--config '{"build":{"beforeBuildCommand":""},"bundle":{"macOS":{"files":{"PlugIns/KIRA Safari Extension.appex":null}}}}'` (`--config` là JSON merge patch, `null` để xoá key): thiếu DerivedData thì fail, và appex cùng bundle id có thể đăng ký đè extension Safari của bản đã cài.
  - Bản debug có Web Inspector (chuột phải, Inspect Element): cách duy nhất đọc `data-glass-state` và token thật trong app native. Gõ phím vào Inspector hay lỗi ký tự, dán qua clipboard. WKWebView **không nhận click khi app ở nền**, và vibrancy chỉ đúng khi cửa sổ active (`FollowsWindowActiveState`): đưa app lên trước rồi mới thao tác.

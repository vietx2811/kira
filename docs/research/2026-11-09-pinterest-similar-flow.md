# Luồng "tìm ảnh tương tự trên Pinterest" mượt như Eagle

**Câu hỏi:** User đã chốt Visual Explore = "chỉ đơn giản tìm ảnh tương tự trên Pinterest, Pinterest đã hỗ trợ sẵn, tham chiếu plugin Pinterest của Eagle". Báo cáo trước (`2026-11-09-visual-explore.md`) kết luận đường an toàn là user tự duyệt Pinterest, extension KIRA kéo ảnh về. Báo cáo này trả lời 3 câu hỏi cụ thể để hiện thực đường đó: deep link Pinterest, học plugin Eagle, và luồng KIRA kèm file/hàm cần sửa.

**Người yêu cầu:** Orchestrator (giao 2026-11-09).

**Commit đã kiểm chứng:** `248b969` (nhánh `researcher/pinterest-similar`, tạo từ `main`) cho mọi mục `[Code]`.

**Kết luận ngắn:**
1. **Không có URL công khai mở thẳng "ảnh tương tự" của một Pin, có hoặc không có tham số vùng cắt.** Nút kính lúp gọi API nội bộ/riêng của Pinterest khi bấm, không phải điều hướng tới một địa chỉ có thể dùng lại. Với ảnh không phải Pin, tìm-bằng-ảnh trên web Pinterest chỉ qua nút camera ở ô tìm kiếm, bắt buộc tải ảnh lên qua UI — không có endpoint nhận URL ảnh ngoài hợp lệ, công khai.
2. **Tôi tự kiểm trong Browser pane và bị chặn đúng như cảnh báo của báo cáo trước**: phiên duyệt web không đăng nhập bị Pinterest chặn bằng hộp "Welcome to Pinterest" không có nút đóng, bật lên ngay khi focus ô tìm kiếm, bấm Enter tìm kiếm, bấm vào một thẻ ý tưởng, hay chỉ cuộn trang — xác nhận bằng `window.location.href` không đổi sau click. Không đăng nhập hộ, không thử vượt qua; dừng đúng lúc đó.
3. **Plugin Pinterest Visual Search của Eagle là plugin chính thức của đội Eagle, không có mã nguồn công khai** (không tìm thấy GitHub). Phần học được chỉ từ trang hỗ trợ và trang plugin: bấm chuột phải → Plugin → "Pinterest Visual Search"; vùng cắt tuỳ chỉnh là thao tác hạng nhất; tìm hàng loạt; lưu bằng cách bấm vào ảnh kết quả. Một nguồn phụ (không phải trang chính thức) nói bản cập nhật 2025 **bắt đăng nhập Pinterest** mới chạy được — khớp với điều tôi gặp trực tiếp.
4. **Luồng đề xuất không cần endpoint mới**: nút "Tìm tương tự trên Pinterest" trên node ảnh mở Pinterest bằng `window.open` (mẫu đã dùng sẵn trong `main.tsx` cho Google Slides/Canva) tới chính trang Pin nếu `sourceUrl` của node đã là một Pin, hoặc trang tìm kiếm theo tag nếu không; user tự bấm kính lúp, tự cuộn, tự chọn ảnh. Lưu bằng hover-Save hoặc `Alt+Shift+K` **đã có sẵn** trong extension — chỉ thiếu một việc: capture từ hai đường đó **không bao giờ mang `targetNode`** (`content.ts:139`), nên `handleKiraCapture` (`main.tsx:3507`) luôn rơi vào `appendReferences` (`main.tsx:3543`), không nối cạnh node nguồn. Việc cần làm nằm gọn ở phía app: nhớ node vừa bấm nút trong một khoảng thời gian (neo khám phá), và cho `handleKiraCapture` dùng neo đó khi capture không có `targetNode` rõ ràng.
5. **Ranh giới giữ nguyên như báo cáo trước**: KIRA không tự bấm kính lúp, không tự cuộn, không tự lấy kết quả, không tự tải ảnh lên ô tìm-bằng-ảnh của Pinterest. Mọi thao tác trên trang Pinterest là của user.

**Cách đọc nhãn bằng chứng:** `[Code]` xác minh trong repo kèm `file:dòng`. `[Trực tiếp]` tôi tự thao tác và quan sát trong Browser pane phiên này, 2026-11-09. `[Ngoài]` nguồn bên ngoài kèm link, truy cập 2026-11-09. `[Suy luận]` là phán đoán của tôi.

---

## 1. Deep link tới "ảnh tương tự" của một Pin

### 1.1 Thử trực tiếp trong Browser pane `[Trực tiếp]`

Mục tiêu: mở một trang Pin thật, xem URL nút kính lúp dẫn tới đâu, có tham số vùng cắt không. Trình tự đã thử, không đăng nhập, không có cookie phiên nào trước đó:

| Bước | Hành động | Kết quả |
|---|---|---|
| 1 | `pinterest.com/` | Trang chủ công khai, có nút Log in / Sign up, không ép đăng nhập ngay |
| 2 | Bấm vào ô tìm kiếm, gõ "ceramic mug packaging design", Enter | Trang `/search/pins/?q=...` tải được, thấy chip thể loại và lưới ảnh **phía sau** một hộp thoại "Welcome to Pinterest" (có ô Email/Password, "Continue with Google", QR code) bật lên ngay lập tức |
| 3 | Tìm nút đóng hộp thoại | `read_page` liệt kê toàn bộ phần tử tương tác trong hộp thoại (Email, Password, Log in, Forgot password, Continue with Google, QR code login, Join for free, Terms/Privacy) — **không có nút đóng hay nút X** |
| 4 | Bấm ra ngoài hộp thoại (vùng nền), bấm thẳng vào một ảnh thumbnail nằm ngoài khung hộp thoại, bấm Escape | Không có gì đổi; hộp thoại vẫn còn nguyên |
| 5 | Điều hướng mới sang `/ideas/` (trang Explore, không qua tìm kiếm) | Tải sạch, **không** có hộp thoại, thấy các thẻ chủ đề ("Diipa Khosla's Diwali Edit", "Words for your kitchen walls"...) |
| 6 | Bấm vào một thẻ chủ đề | Hộp thoại "Welcome to Pinterest" bật lại ngay. Kiểm `window.location.href` qua `javascript_tool`: vẫn là `https://www.pinterest.com/ideas/` — **click không điều hướng đi đâu cả**, chỉ mở hộp thoại |
| 7 | Điều hướng sạch lại `/ideas/`, đọc các thẻ chủ đề thành `<a href>` bằng JS (không click) | Toàn bộ href là trang **chủ đề/bo-sưu-tập** dạng `/ideas/<topic>/<id>/`, ví dụ `/ideas/design/902065567321/` — không có pin riêng lẻ nào trong các href này |
| 8 | Mở `/ideas/design/902065567321/`, cuộn xuống để tới lưới Pin thật | Cuộn một đoạn là hộp thoại bật lại — **chặn cả thao tác cuộn**, không chỉ click |
| 9 | Kiểm `document.querySelectorAll('a[href*="/pin/"]')` ở mọi bước trên | Luôn rỗng — trang không lộ href `/pin/` nào trong lúc chưa đăng nhập, dù ở trang tìm kiếm hay trang chủ đề |

**Kết luận của riêng phần thử nghiệm:** với phiên không đăng nhập, tôi không tới được một trang `/pin/<id>/` thật nào — bị chặn bởi hộp thoại không đóng được, kích hoạt bởi gõ tìm kiếm, bấm thẻ, hoặc chỉ cuộn. Đây đúng là "trang chặn" mà brief dặn ghi lại và dừng; tôi dừng ở đây, không thử cách vượt qua (xoá cookie, giả user agent, dùng tài khoản...).

### 1.2 Vì sao không có "URL ảnh tương tự" để dùng lại `[Ngoài, Suy luận]`

Tìm kiếm không ra bất kỳ tài liệu nào (chính thức hay thứ ba) mô tả một URL dạng `pinterest.com/pin/<id>/visual-search/?x=...&y=...&w=...&h=...` hay tương tự có thể điều hướng thẳng tới. Bằng chứng gián tiếp nhưng khớp nhau:

- Công cụ bên thứ ba duy nhất làm được việc "đưa một ảnh, nhận Pin tương tự" (`piotrv1001/pinterest-visual-search-scraper` trên Apify — [nguồn](https://apify.com/piotrv1001/pinterest-visual-search-scraper), truy cập 2026-11-09) nhận **URL ảnh** (`https://i.pinimg.com/...` hoặc ảnh bất kỳ), không nhận URL trang Pin, và tính phí theo lượt gọi — tức nó gọi một API/endpoint riêng phía sau, không phải điều hướng một địa chỉ công khai. Tham số vùng cắt của nó là `cropBox: "x,y,width,height"` dạng **phân số 0 đến 1** (vd `"0.5,0,0.5,1"`), không phải tham số URL của pinterest.com.
- Công cụ này thuộc đúng nhóm "gọi endpoint nội bộ" mà báo cáo trước đã kết luận **không khuyến nghị** cho KIRA (vùng cấm theo điều khoản Pinterest). Nó chỉ dùng ở đây để xác nhận hình dạng tham số vùng cắt, không phải để tham khảo cách gọi.
- Việc đọc trực tiếp tại §1.1 cho thấy chính trang Pinterest cũng không lộ sẵn link `/pin/` khi chưa đăng nhập, nên dù có URL dạng như vậy tồn tại, tôi cũng không quan sát được nó trong phiên không đăng nhập.

### 1.3 Ảnh không phải Pin: tìm-bằng-ảnh có cần tải lên không `[Ngoài, Suy luận]`

Không tìm thấy tài liệu mô tả cách gửi URL ảnh ngoài cho `pinterest.com` tìm bằng ảnh qua querystring. Dấu hiệu gián tiếp: giao diện tìm-bằng-ảnh công khai của Pinterest luôn được mô tả qua "nút camera trên ô tìm kiếm" rồi "tải ảnh lên hoặc kéo-thả" (các bài hướng dẫn SEO/marketing như `simplepinmedia.com`, `anastasiablogger.com`, `kerrielegend.com` — không đọc nguyên văn, chỉ liệt kê trong kết quả tìm, không đối chiếu sâu). Tôi **không xác minh được bằng mắt** bước này vì bị chặn trước khi tới được ô tìm kiếm không có hộp thoại (xem §1.1 bước 2 — gõ xong là bị chặn). Vì vậy câu "bắt buộc upload hay chấp nhận paste clipboard" **chưa kiểm chứng trực tiếp được**, ghi vào Giới hạn.

Đường ít bước nhất cho user, nếu đúng là bắt buộc upload qua UI (không xác nhận được paste clipboard):
1. KIRA mở Pinterest trong trình duyệt mặc định của user (họ gần như chắc chắn đã đăng nhập ở đó, khác với phiên ẩn danh tôi vừa thử).
2. User tự bấm nút camera, tự chọn file hoặc kéo-thả — **KIRA không tự động làm bước này**, vì tự động hoá thao tác trên Pinterest là đúng vùng bị cấm theo kết luận báo cáo trước (§3 báo cáo đó).
3. Nếu Pinterest hỗ trợ kéo-thả vào ô camera (chưa xác nhận), người dùng có thể kéo ảnh thẳng từ node KIRA sang tab Pinterest — vẫn là thao tác của user, không phải của KIRA.

## 2. Plugin Pinterest Visual Search của Eagle

### 2.1 Mã nguồn `[Ngoài]`

Tìm trên GitHub và qua tìm kiếm chung cho `plugin.json`, repo công khai của plugin này: **không có kết quả**. Trang plugin tự giới thiệu Developer là "Eagle App" (không phải một cá nhân/cộng đồng), và bài "Meet Eagle 4" của chính Eagle gọi đây là "one of the earliest plugins our team developed" — tức đây là plugin **chính thức, đóng gói sẵn trong app**, không phải plugin cộng đồng mã mở như phần lớn plugin khác trên `community-en.eagle.cool`. Không có gì để đọc mã nguồn; phần "chỉ đọc, không chạy" của brief không áp dụng được ở đây vì không có gì công khai để đọc.

### 2.2 UX đáng học, có nguồn xác nhận `[Ngoài]`

Từ trang hỗ trợ chính thức [How to use Eagle's Pinterest image search by image feature?](https://de.eagle.cool/support/article/how-to-use-eagles-pinterest-visual-search-feature) (bản tiếng Anh hiển thị do chưa dịch, truy cập 2026-11-09) và trang plugin [Pinterest Visual Search](https://community-en.eagle.cool/plugin/22069a4c-58e0-44d7-89d9-69f014158acd) (v1.1.9, truy cập 2026-11-09):

| Điều Eagle làm | Nguồn | Vì sao đáng học |
|---|---|---|
| Chọn một ảnh trong thư viện Eagle → chuột phải → Plugin → "Pinterest Visual Search" | Trang hỗ trợ, bước 4 | Không có UI riêng cho "mở Pinterest"; dùng đúng context-menu đã có sẵn trên mọi ảnh, không thêm bề mặt mới |
| "Custom Search Area": chọn vùng con trong ảnh rồi tìm lại bằng đúng vùng đó | Trang plugin, mục tính năng | Vùng cắt là hạng nhất, không phải tính năng phụ — đúng điều báo cáo trước đã ghi nhận |
| "Batch Search": tìm nhiều ảnh cùng lúc | Trang plugin | Hữu ích khi Art Director có cả bộ reference, không chỉ một ảnh |
| "Support for Third-Party Apps": tìm được cả ảnh từ app khác, file cục bộ, clipboard, không chỉ ảnh trong thư viện Eagle | Trang plugin | Đầu vào không khoá vào thư viện riêng của công cụ — gợi ý cho KIRA: node ảnh, ảnh dán, hay ảnh ngoài canvas đều nên dùng được nút này nếu sau này mở rộng |
| "In the search results, click on images you're interested in to save them to Eagle" | Trang hỗ trợ, bước 5 | Lưu là một click trên chính kết quả, không phải một thao tác tách biệt (không cần kéo-thả hay phím riêng theo mô tả hiện tại trên trang) |

### 2.3 Điều **không** xác nhận lại được lần này

Báo cáo `2026-11-09-visual-explore.md` trước đó ghi: "Phím tắt khi rê chuột: `S` lưu vào Eagle, `F` tìm ảnh tương tự, `O` mở trên Pinterest". Lần đọc lại trang plugin hiện tại (v1.1.9, cùng bản) và trang hỗ trợ chính thức, **tôi không thấy đoạn text nào nhắc tới ba phím này**; tìm kiếm riêng cho "Eagle S F O shortcut" cũng không ra nguồn nào xác nhận đây là phím của chính plugin Pinterest (so với phím hover chung của thư viện Eagle, vốn dùng `Z` cho xem nhanh theo tài liệu shortcut chính thức). Có thể trang đã đổi cách trình bày giữa hai lần đọc, hoặc thông tin đó tới từ ảnh chụp màn hình/video trên trang mà công cụ đọc text của tôi bỏ qua. **Không khẳng định lại S/F/O ở báo cáo này**; nếu cần dùng, nên xác nhận bằng cách tự cài plugin và thử, không suy ra từ hai lần đọc trang mâu thuẫn nhau.

### 2.4 Phần dựa vào endpoint nội bộ, không nên copy `[Ngoài, Suy luận]`

Một kết quả tìm kiếm phụ (không phải trang chính thức Eagle) cho biết bản cập nhật năm 2025 sửa lỗi tìm kiếm do Pinterest đổi dịch vụ, và từ bản đó **user phải đăng nhập tài khoản Pinterest mới dùng được**. Tôi không đọc được changelog gốc để trích dẫn chính xác câu chữ (không có trong hai trang tôi đọc trực tiếp), nên ghi ở độ tin cậy thấp hơn — nhưng nó khớp với phát hiện trực tiếp của tôi ở §1.1 rằng Pinterest chặn mọi thao tác khi chưa đăng nhập. Điều này củng cố thêm, không thay đổi, kết luận của báo cáo trước: **plugin Eagle sống nhờ và phụ thuộc trạng thái đăng nhập + dịch vụ nội bộ của Pinterest, không phải thứ KIRA nên mô phỏng lại; chỉ nên học phần UX (§2.2), không học cách gọi.**

## 3. Luồng KIRA đề xuất

### 3.1 Luồng người dùng

1. Chọn một node ảnh (`kind: 'image'`) trên canvas, bấm nút "Tìm tương tự trên Pinterest" (chỉ hiện với node ảnh, không hiện với idea/palette/diagram/placeholder — xem §3.3 vị trí nút).
2. KIRA mở Pinterest trong **trình duyệt mặc định của user** (không phải webview trong app — xem §3.4), tại:
   - Chính trang Pin, nếu `node.sourceUrl` đã trỏ tới `pinterest.com/pin/...` (ảnh này vốn capture từ Pinterest) — user chỉ cần tự bấm kính lúp ngay trên Pin đó.
   - Trang tìm kiếm theo tag của node (`pinterest.com/search/pins/?q=<tags>`), nếu `sourceUrl` không phải Pinterest — không có đường nào đưa thẳng ảnh ngoài vào ô tìm-bằng-ảnh qua URL (§1.3), nên chỉ đưa user tới gần nhất có thể rồi họ tự bấm camera.
3. User tự duyệt, tự cắt vùng, tự bấm kính lúp/camera trên trang Pinterest — **KIRA không chạm vào các bước này**.
4. User lưu ảnh ưng ý bằng cơ chế **đã có sẵn** trong extension: nút "Save" nổi khi rê chuột qua ảnh (`content.ts:432` `showHoverButtonFor`), hoặc phím tắt toàn cục `Alt+Shift+K` (`apps/extension/public/manifest.json:24-27`, xử lý tại `content.ts:139` `saveHoveredImage`).
5. Ảnh lưu về xuất hiện trên canvas **cạnh node nguồn**, có link nối — nhờ cơ chế "neo khám phá" ở §3.2.

### 3.2 "Neo khám phá": để capture tự nối vào đúng node nguồn

**Hiện trạng `[Code]`:** hai đường lưu nhanh nhất (hover-Save, `Alt+Shift+K`) đều gọi thẳng `sendCapture(capture)` không có `targetNode` (`content.ts:139-150`). Phía app, `handleKiraCapture` (`main.tsx:3507`) chỉ gắn capture vào một node cụ thể khi `capture.targetNode` có giá trị (dòng 3533-3541, gọi `attachCaptureToGraphNode` tại `main.tsx:3687`); nếu không, nó luôn rơi vào `appendReferences` (dòng 3543, định nghĩa tại `main.tsx:3476`) — thêm ảnh vào thư viện/canvas **không có liên hệ vị trí hay link với bất kỳ node nào**. Đường duy nhất hiện có để gắn `targetNode` là kéo-thả thủ công vào một thẻ node trong "drop pad" nổi của extension (`content.ts:1034`, `:1080`, UI dựng tại `renderCaptureContext` quanh dòng 1006-1024) — tức mỗi ảnh phải kéo tay một lần, không hợp với việc duyệt nhanh nhiều ảnh trên Pinterest.

**Đề xuất, chỉ sửa phía app, extension giữ nguyên:**

1. Thêm một state ngắn hạn, ví dụ `discoveryAnchorRef = useRef<{ kind: GraphNodeKind; id: string; expiresAt: number } | null>(null)`, đặt bên cạnh các state capture khác gần `recentCaptureKeysRef` (`main.tsx:3512`).
2. Khi user bấm "Tìm tương tự trên Pinterest" trên một node, set `discoveryAnchorRef.current = { kind: node.kind, id: node.id, expiresAt: Date.now() + <N phút> }` (ví dụ 15 phút — đủ một phiên duyệt Pinterest, không quá dài để khỏi gắn nhầm ảnh của việc khác sau này).
3. Sửa `handleKiraCapture` (`main.tsx:3507`, đoạn 3533-3544): khi `capture.targetNode` không có (nhánh hiện tại rơi thẳng xuống `appendReferences`), kiểm `discoveryAnchorRef.current` còn hạn không; nếu còn, `resolveGraphNodeRef` node đó (hàm đã dùng sẵn ở dòng 3534) và gọi `attachCaptureToGraphNode` y hệt nhánh `target` hiện có (dòng 3537-3541) — **không viết logic đặt-vị-trí hay tạo-link mới**, dùng lại nguyên hàm đã có từ dòng 3687.
4. Một lựa chọn thủ công rõ ràng (kéo-thả vào đúng node khác qua drop pad, tức `capture.targetNode` có giá trị) luôn thắng neo ngầm — không cần đổi gì, vì nhánh `if (target)` ở dòng 3537 đã chạy trước nhánh fallback.
5. Neo tự hết hạn (không cần hành động "tắt neo" của user) — nếu user bấm nút trên một node khác, neo mới ghi đè neo cũ.

Không cần sửa `apps/extension/*` hay `src-tauri/src/lib.rs` cho phần này — capture payload giữ nguyên hình dạng, chỉ đổi cách `handleKiraCapture` diễn giải "không có `targetNode`".

### 3.3 Vị trí nút "Tìm tương tự trên Pinterest"

`AiNodeAction` (`main.tsx:254`) là tập đóng 5 hành động gọi Kira sinh nội dung (`summarize | break_down | synthesize | find_gaps | generate_variations`); "Tìm tương tự trên Pinterest" **không gọi AI**, chỉ mở trình duyệt, nên về bản chất khác hẳn — không nên nhét vào danh sách này hay vào dropdown "Ask Kira ▾" mà báo cáo `2026-11-09-canvas-node-ux.md` §2.1 vừa đề xuất gộp 3 đường hỏi-AI làm một. Gộp chung sẽ tái tạo đúng vấn đề report đó đã nêu: lẫn lộn "hỏi AI" với "làm việc khác".

Đề xuất: một nút quiet-button riêng, cạnh dropdown "Ask Kira ▾" trên thanh công cụ thống nhất, **chỉ hiện khi node đang chọn có `kind === 'image'`** (không hiện với idea/palette/diagram/placeholder, khác với dropdown AI vốn áp dụng mọi loại). Đây khớp với cách `kiraSuggestions` đã phân theo từng `kind` (`main.tsx:296-331`) — thêm một hành động riêng cho `image` không phá khuôn mẫu đó.

### 3.4 Mở trình duyệt: mặc định, không phải webview

**Đã có sẵn trong code, không cần hạ tầng mới `[Code]`:** `window.open(url, '_blank', 'noopener,noreferrer')` đã dùng hai lần trong `main.tsx` để mở Google Slides (`:6717`) và Canva (`:6722`) cho luồng xuất trình chiếu. `capabilities/default.json` (toàn bộ file) **không** khai permission `core:webview:allow-create-webview-window`, và không có `tauri-plugin-shell`/`tauri-plugin-opener` nào được đăng ký trong `Cargo.toml`. Với WKWebView trên macOS và không có handler riêng cho cửa sổ mới, hành vi mặc định của Tauri 2 là giao các điều hướng cửa sổ mới ra ngoài cho hệ điều hành xử lý — tức mở ở **trình duyệt mặc định của user**, không phải một cửa sổ webview khác của chính KIRA. Đây là suy luận dựa trên: (a) hai lần dùng `window.open` đã có sẵn trong app cho đúng mục đích "đưa user sang web app khác", (b) không có permission nào trong `capabilities/default.json` cho phép tạo webview mới. **Tôi chưa tự kiểm bằng cách chạy app native thật** (ngoài phạm vi brief — brief chỉ yêu cầu đọc code và grep, không yêu cầu build app) — ghi vào Giới hạn; nếu `window.open` hoá ra không mở trình duyệt mặc định như kỳ vọng, phải kiểm lại trong app thật trước khi dựa vào kết luận này.

Vì vậy: **không cần sửa `src-tauri/src/lib.rs`**. `open_system_target` (`lib.rs:4198`) và Tauri command bọc nó, `open_extension_install_target` (`lib.rs:627-642`), chỉ dùng cho một danh sách `target_id` cố định (`chrome`, `safari`, `chrome_dist`, `safari_app`) — mở rộng nó để nhận URL Pinterest tuỳ ý sẽ biến nó thành một "mở bất cứ gì" chung, rủi ro hơn mức cần. Giữ nguyên native, dùng `window.open` phía frontend là đủ.

### 3.5 Ghi chú kiến trúc phụ: `cropRect` đã có sẵn hình dạng phù hợp

`EvidenceImage.cropRect` (`main.tsx:415`, bình luận tại dòng 412-414) đã lưu vùng cắt dưới dạng phân số 0 đến 1 của `{x, y, width, height}` — đúng hình dạng mà "Custom Search Area" của Eagle (§2.2) và tham số `cropBox` của công cụ bên thứ ba (§1.2) đều dùng. Đây chỉ là một quan sát kiến trúc, **không đề xuất nối `cropRect` vào đâu cả** trong pha này: không có endpoint hợp lệ nào nhận vùng cắt từ KIRA, nên không có chỗ để gửi nó đi. Ghi lại để lần sau nếu có nguồn hợp lệ nhận crop (hiếm, xem §4 báo cáo trước) thì không phải đổi hình dạng dữ liệu.

## 4. Giới hạn

- Không tới được một trang `/pin/<id>/` thật trong phiên không đăng nhập (§1.1) — mọi suy luận về URL "ảnh tương tự" hay ô tìm-bằng-ảnh dựa trên nguồn thứ ba, không phải quan sát trực tiếp màn hình Pinterest lúc đã vào được trang đó.
- Chưa xác nhận trực tiếp ô camera-search của Pinterest có nhận kéo-thả hay dán clipboard không (§1.3) — chỉ có mô tả "tải lên" từ các bài hướng dẫn thứ ba, chưa đối chiếu nguồn thứ hai.
- Không tìm thấy mã nguồn công khai của plugin Eagle (§2.1) nên phần "đọc code để tách UX khỏi endpoint nội bộ" chỉ làm được bằng cách đọc trang mô tả, không phải đọc mã thật.
- Chi tiết phím tắt S/F/O của báo cáo trước **không xác nhận lại được** lần đọc này (§2.3) — nêu rõ mâu thuẫn, không chọn tin bên nào mà không kiểm thêm.
- `window.open` mở trình duyệt mặc định hay webview nội bộ (§3.4) là suy luận từ cấu hình và từ hai chỗ dùng sẵn trong code, **chưa chạy app native thật để xác nhận** — ngoài phạm vi brief (brief chỉ yêu cầu đọc code), nhưng là điều kiện tiên quyết phải kiểm trước khi code hoá đề xuất này.
- Thời lượng neo khám phá (15 phút, §3.2) là một con số đề xuất, chưa có dữ liệu hành vi thật của user để hiệu chỉnh.
- Không đánh giá việc hợp pháp của bản thân hành động "mở Pinterest trong trình duyệt mặc định" — xem đây là thao tác duyệt web thông thường của user, cùng kết luận với báo cáo trước; không phải tư vấn pháp lý.

## 5. Đề xuất

1. **Chốt placement của nút** (§3.3): quiet-button riêng cạnh "Ask Kira ▾", chỉ hiện trên node ảnh — hay gộp vào đâu khác nếu Orchestrator/UI-UX thấy hợp lý hơn khi hai báo cáo canvas-node-ux và báo cáo này được ráp lại cùng lúc.
2. **Chốt thời lượng neo khám phá** và liệu neo có cần hiển thị cho user biết (vd một chip nhỏ "Đang gắn vào: <tên node>" đâu đó) hay hoàn toàn ngầm.
3. **Xác nhận hành vi `window.open`** trong app native thật (build debug theo mục Gotcha của `CLAUDE.md`) trước khi bất kỳ ai code hoá §3.4, vì toàn bộ phần "mở trình duyệt mặc định, không phải webview" hiện là suy luận.
4. Nếu Worker nhận việc này: làm phần neo khám phá (§3.2) trước, vì nó độc lập với nút UI và tự nó đã sửa đúng khoảng trống "hover-save không bao giờ nối node" — có giá trị ngay cả trước khi nút Pinterest tồn tại.

## Cập nhật 2026-11-10

**Người yêu cầu:** user, trực tiếp qua chat (không qua Orchestrator).

**Bối cảnh:** toàn bộ §3 ở trên **đã được Worker/UI-UX hiện thực và nằm trên `main`** từ lúc viết cập nhật này (xác nhận bằng `git log`, commit mới nhất liên quan `64c3e9d` "fix: Pinterest find-similar discoverability", chuỗi commit từ `6ffdc55` "feat: Pinterest 'find similar' discovery anchor and toolbar button" trở đi). Người dùng đưa thêm 3 ý tưởng để tinh chỉnh một tính năng **đang chạy**, không phải một tính năng giả định — nên phần này đối chiếu từng ý với code hiện tại trên `main`, không suy diễn từ báo cáo cũ nữa.

**Commit đã kiểm chứng cho mục `[Code]` ở phần này:** `00d9198` (nhánh `researcher/pinterest-similar-followup`, tạo từ `main`).

### A. Mục "Connections" trong Settings, điều hướng login khi chưa kết nối

**Hiện trạng `[Code]`:** nút "Tìm tương tự trên Pinterest" gọi `openExternalPinterestUrl` → Tauri command `open_external_url` (`lib.rs:4233`), bọc qua `validate_pinterest_url` (`lib.rs:4209`) chỉ để chặn URL không phải `pinterest.com`/subdomain — **không có bước nào đọc hay ghi trạng thái đăng nhập**. Lệnh native này gọi ra trình duyệt hệ thống của macOS (tiến trình hoàn toàn khác KIRA, cookie jar riêng); KIRA không có cách nào đọc được trạng thái đăng nhập Pinterest trong trình duyệt đó. Settings hiện tại (`main.tsx` quanh `aiProviders`/`withDefaultAiProviders`, dòng 2509) chỉ có khái niệm "connection" cho **model AI** (`kira.noProvider`, `kira.panel.emptyNoProviderBody` — dòng 917/932), không có mục "Connections" cho dịch vụ ngoài nào khác; không có gì để gắn một dòng Pinterest vào.

**Vì sao "điều hướng login khi chưa kết nối" khó làm đúng nghĩa:**
- Pinterest **đã tự làm việc này** — báo cáo gốc §1.1 `[Trực tiếp]` xác nhận phiên không đăng nhập bị chặn bằng hộp "Welcome to Pinterest" ngay khi tương tác (gõ tìm kiếm, bấm thẻ, hay chỉ cuộn), không có nút đóng. Mở link Pinterest khi chưa đăng nhập tự động dẫn tới đúng màn hình đó, không cần KIRA làm thêm gì.
- Thứ duy nhất **có thể** biết trạng thái đăng nhập thật là extension, khi nó đang chạy trong một tab `pinterest.com` (đọc DOM: có nút "Log in" hay có avatar). Đây là trạng thái "lần cuối extension thấy", không phải trạng thái tức thời — vẫn có thể sai ngay khi user đăng xuất ở trình duyệt hệ thống mà không mở lại tab đó.

**Đề xuất, xếp theo chi phí tăng dần — Orchestrator/user chọn:**
1. **Không làm gì** — để Pinterest tự chặn và tự hiện form login (đang đúng vậy). Chi phí 0, đã hoạt động.
2. **Gợi ý tĩnh**: thêm một dòng chú thích nhỏ cạnh nút hoặc trong tooltip ("Nếu Pinterest yêu cầu đăng nhập, hãy đăng nhập trong tab vừa mở rồi quay lại tìm") — không cần biết trạng thái thật, chỉ set kỳ vọng trước khi mở tab.
3. **Mục "Connections" thật trong Settings** (status "đã kết nối"/"chưa rõ"): cần thêm một message type mới ở extension (content script trên `pinterest.com` phát hiện trạng thái đăng nhập, báo về app qua bridge hiện có giữa extension và app), lưu "lần cuối thấy" kèm mốc thời gian trong settings. Đây là tính năng mới thật sự, không phải tinh chỉnh nhỏ — cần Orchestrator xếp lịch riêng, không gộp miễn phí vào việc đang có.

Không đề xuất (3) làm ngay; (1) đã đủ dùng, (2) là tinh chỉnh rẻ nếu muốn làm liền.

### B. Luồng tìm kiếm theo Pin ID của ảnh đã lưu

**Đã hiện thực đầy đủ `[Code]`, không cần việc gì thêm:** `apps/desktop/src/kira/pinterestSimilar.ts` có `isPinterestPinUrl()` kiểm cả `hostname` (`pinterest.com` hoặc subdomain) và `pathname.startsWith('/pin/')`, và hàm phân giải pin-URL **đọc cả hai trường** `source` (URL trang Pin, do capture extension ghi) và `sourceUrl` (URL ảnh CDN) — đúng khoảng trống mà chính file này ghi lại đã sửa ("Bug this fixes" trong docstring đầu file): bản cũ chỉ nhìn `sourceUrl` nên một ảnh capture từ Pin luôn rơi về tìm theo tag thay vì mở lại đúng Pin. `buildPinterestSimilarUrl` (`main.tsx:16173`) dùng kết quả này để quyết định mở đúng trang Pin hay trang tìm theo tag. Nút đã lên cả toolbar node, menu chuột phải, thanh Details, và luồng chọn nhiều ảnh (commit `64c3e9d`).

Ý của user ("một số ảnh lấy về có thể có id trên Pinterest nên có thể thành một luồng tìm kiếm riêng") là đúng và **đã chính là cách code hiện tại hoạt động** — không có việc tồn đọng ở mục này.

### C. Side-peek khi chọn ảnh: panel sửa thông tin + khu vực ảnh gợi ý bên dưới

**Hiện trạng `[Code]`:** chọn một node hiện ra `.node-details-popover` (`main.tsx:10545`) — một **popover neo tại chính node** trên canvas, đóng/mở bằng `closeDetails`, có các mục gập mở qua `collapsedDetailSections` (`properties`, `colors`, `tags`, `palette`, `source`, `history` — dòng 9057, 10717-10871). Đây đã là "panel sửa thông tin khi chọn ảnh" mà user mô tả, chỉ khác về vị trí: **popover nổi cạnh node**, không phải một panel đóng cố định ở cạnh màn hình (side-peek thật, kiểu Figma/Linear). Mục "source" trong popover này đang chỉ có một ô nhập URL nguồn (`sourceUrlField`, dòng 10405-10408), không có khu vực liệt kê ảnh nào khác.

Cơ chế "neo khám phá" hiện tại (`discoveryAnchorRef`, `discoveryAnchorState` — dòng 2633-2634) khi còn hiệu lực sẽ gắn capture mới **thẳng vào canvas cạnh node nguồn** qua `attachCaptureToGraphNode`, không đưa vào bất kỳ khu vực xem-trước/duyệt nào trước đó — chip `discovery-anchor-chip` (dòng 7676) chỉ báo "đang gắn vào node nào", không hiển thị danh sách ảnh đã lưu.

**Hai cách đọc ý "khu vực hiển thị kết quả, ảnh gợi ý bên dưới" — cần user xác nhận là ý (2), không phải ý (1):**
1. *Kết quả tìm kiếm trực tiếp từ Pinterest* (API/scrape live, hiện ngay trong app) — đây đúng con đường đã bị bác ở báo cáo gốc `2026-11-09-visual-explore.md` vì vi phạm điều khoản Pinterest (KIRA không được tự gọi endpoint nội bộ hay parse trang kết quả). **Không nên làm theo hướng này.**
2. *Khu vực "inbox" cho đúng những ảnh user tự lưu trong lúc đang neo khám phá* (hover-Save/`Alt+Shift+K` trong khi `discoveryAnchorState` còn hiệu lực) — hiện vào một tray để user duyệt/giữ/bỏ **trước khi** nó chính thức thành node trên canvas, thay vì tự động `attachCaptureToGraphNode` ngay như hiện tại. Đây là một tinh chỉnh hợp lý của §3.2, và đúng mô hình an toàn đã chốt (mọi ảnh trong tray đều do user tự tay lưu, KIRA không tự lấy gì).

Giả định cách đọc (2) đúng theo mạch các báo cáo trước; nếu đúng, còn một quyết định kiến trúc/thẩm mỹ chưa nên tự chọn:
- **Mở rộng popover hiện có** (`.node-details-popover`) thêm một mục gập-mở mới (ví dụ "Gợi ý", cạnh mục "source") liệt kê các ảnh đang nằm trong neo khám phá — ít thay đổi nhất, giữ đúng pattern "popover neo tại node" dùng xuyên suốt app.
- **Dựng một side-peek thật**, đóng cố định ở cạnh màn hình. **Đính chính (cùng ngày, sau khi kiểm lại):** bản đầu của mục này ghi pattern này "chưa tồn tại ở màn nào khác" là sai. KIRA đã có một panel đóng cố định: `.library-drawer-panel` (`styles.css:1329`), thẻ nổi neo cạnh **trái**, rộng `var(--library-drawer-width, 320px)`, kéo đổi cỡ được qua `.library-resize-handle` (`styles.css:1548`), có animation mở/đóng. Một side-peek bên **phải** cho chi tiết node là bản đối xứng của pattern này, không phải pattern lạ. Phần chưa có là một panel *theo node đang chọn* (library là danh sách toàn dự án). Quyết định popover hay side-peek vẫn là chọn thẩm mỹ/bố cục, nên qua Art Director; nhưng chi phí hiện thực side-peek thấp hơn tôi ước lượng ban đầu vì đã có khuôn.

Để giữ gọn: chọn "ảnh gợi ý" là các capture đang chờ duyệt trong lúc neo còn hiệu lực. Phía app chỉ cần đổi nhánh fallback trong `handleKiraCapture` từ "gắn thẳng lên canvas" sang "đẩy vào danh sách chờ của neo"; nút "Giữ" mới gọi `attachCaptureToGraphNode` như hiện nay. Logic thuần của neo nằm sẵn ở `kira/discoveryAnchor.ts`, có thể thêm kiểu danh sách chờ ở đó và test được riêng.

### D. Đề xuất (cho Orchestrator/user)

1. Xác nhận cách đọc (2) ở mục C là đúng ý (tray cho ảnh user tự lưu, không phải kết quả API live) — nếu không, dừng ở đây vì cách đọc (1) nằm ngoài phạm vi ToS đã chốt.
2. Nếu đúng ý (2): giao Art Director một khảo sát ngắn — mở rộng `.node-details-popover` hiện có hay cần một side-peek mới — trước khi Worker code, theo đúng quy trình đã chốt cho quyết định thẩm mỹ gốc.
3. Mục A: mặc định giữ nguyên (Pinterest tự chặn đăng nhập), chỉ thêm gợi ý tĩnh (phương án 2) nếu Orchestrator thấy đáng; mục "Connections" thật (phương án 3) là việc mới, cần ước lượng riêng trước khi nhận.
4. Mục B không cần việc gì thêm — đã xong, chỉ ghi lại để xác nhận với user rằng ý đó khớp code hiện tại.

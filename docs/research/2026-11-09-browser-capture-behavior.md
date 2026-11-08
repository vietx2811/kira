# Thu thập ý tưởng từ trình duyệt: hành vi người dùng, đối chiếu công cụ, và khoảng trống của plugin KIRA

**Câu hỏi:** Người làm sáng tạo thu thập gì khi lướt web, các công cụ bắt khoảnh khắc đó ra sao, và plugin `apps/extension/` của KIRA còn thiếu gì, thừa gì, ma sát ở đâu? Ưu tiên theo tần suất hành vi x công sức. Kèm đường đi khi app tắt và quyền riêng tư.

**Người yêu cầu:** Orchestrator (giao 2026-11-09), cho user là Art Director ở VN, F&B và branding.

**Commit đã kiểm chứng:** `7829b85` (worktree `qa-extension/capture-research`). Code capture (extension, `lib.rs` server, `main.tsx` nhận) **không đổi** từ `56ad91e` tới `7829b85` (đã diff 91 commit), nên các số đo QA ngày 2026-09-20 ở mục 4 vẫn dùng được.

**Kết luận ngắn:**
1. Điều làm mất ý tưởng nhiều nhất không phải thiếu tính năng mà là **thành công giả**: server trả `200` trước khi kiểm payload, nên ảnh `data:`, payload thiếu `title`, hoặc body quá 64KB bị app bỏ im lặng trong khi extension báo "Saved". Sửa trước mọi thứ khác (mục 5, P0).
2. Khi app tắt, capture hiện chỉ giữ **một ô** trong `chrome.storage.local` và không ai phát lại. Cần hàng chờ nhiều ô, huy hiệu đếm trên icon, và tự đẩy khi app mở lại.
3. Ba thứ rẻ mà người dùng sẽ thấy ngay: **nút Save nổi khi hover ảnh**, **phím tắt**, và **lưu bôi đen text và link** (chuột phải hiện chỉ có `image` và `page`).
4. Trang (`kind: 'page'`) hiện thành node ảnh với thumbnail là URL trang, không có `og:image`. Rẻ để sửa, đáng làm sớm.
5. Một lỗ riêng tư thật ở code: server cục bộ trả `Access-Control-Allow-Origin: *` và `GET /context` trả tên file cùng tên node cho **bất kỳ trang web nào** gọi được tới cổng. Chưa đo từ trang thật; cần đo và khoá bằng kiểm `Origin` (mục 6).

**Cách đọc nhãn bằng chứng:** `[Code]` đã xác minh trong repo, kèm `file:dòng`. `[Ngoài]` nguồn bên ngoài, kèm link, truy cập 2026-11-09. `[Suy luận]` là phán đoán của tôi, không có số liệu đo.

**Giới hạn của nghiên cứu:** Tìm không ra khảo sát định lượng nào về thói quen thu thập tư liệu của người làm sáng tạo (đã thử tìm); chỉ có bài viết của người trong nghề và trang của nhà cung cấp công cụ. Vì vậy cột "tần suất" ở mục 5 là suy luận, lấy **số công cụ trong 9 công cụ đã khảo sát có tính năng đó** làm chỉ báo thay thế, không phải số liệu người dùng. Trang điều khoản Pinterest trả `406` cho mọi truy cập tự động nên không đọc được nguyên văn; xem mục 8 của báo cáo Visual Explore.

---

## 1. Người làm sáng tạo thu thập gì

Bảng này là phân loại của tôi từ bài của người trong nghề ([Creative Boom](https://www.creativeboom.com/tips/bored-of-pinterest-8-alternatives-to-try-for-design-inspiration/), [The Designer's Dossier](https://thedesignersdossier.substack.com/p/stop-saving-pinterest-boards-heres)) cộng với tính năng của các công cụ ở mục 2. Cột F&B là ví dụ minh hoạ theo hồ sơ user, `[Suy luận]`.

| Loại tư liệu | Ví dụ với F&B và branding VN | Điều cần giữ kèm | Plugin KIRA hiện có? |
|---|---|---|---|
| Ảnh đơn (lưới hoặc trang chi tiết) | bao bì, bàn ăn, ảnh món, biển hiệu | URL nguồn, bản **lớn nhất**, alt/caption | Có (kéo, Alt+chuột phải, menu), bản lớn chỉ làm cho Pinterest |
| Post trên Pinterest, Instagram, Behance, Are.na | một dự án nhiều ảnh | link post, tác giả, các ảnh trong post | Một ảnh mỗi lần; popup liệt kê ảnh trong trang |
| Cả trang | site đối thủ, menu online, bài báo | URL, tiêu đề, ảnh đại diện | Có, nhưng không có ảnh đại diện (mục 4) |
| Đoạn text | tên món, slogan, đoạn copy hay | text, URL, vị trí | **Không** |
| Màu | bảng màu từ một site hay một ảnh | mã hex, nguồn | **Không** (app tính palette cho ảnh nhập từ file, không cho ảnh capture, mục 4) |
| Font | font chữ trên bảng hiệu số hoá hay site | tên font, nguồn | **Không** |
| Chụp vùng | khung menu trong PDF, một cảnh trong Reels, story không lưu được | vùng, URL | **Không** |
| Khung hình video | Reels, YouTube làm mood | thời điểm, URL | **Không** |
| Link sản phẩm | vật liệu, bao bì, nhà cung cấp | giá, tên, URL | Dưới dạng "trang" |

`[Ngoài]` Hai điều lặp lại trong các bài đọc: Pinterest là điểm xuất phát chung, và nhiều người ghép với công cụ chuyên hơn (Are.na, Cosmos, Savee, Milanote); và lỗi hay gặp là **gom thay vì chọn lọc** ("dump every pin"). Điều thứ hai gợi ý lúc thu thập nên nhanh và rẻ, còn việc chọn lọc để ở trong app (khớp nguyên tắc đã viết ở `docs/RESEARCH_MOODBOARD_UX.md` §2.2).

## 2. Các công cụ bắt khoảnh khắc đó thế nào

Chỉ ghi điều có nguồn. Ô trống nghĩa là **không tìm thấy tài liệu**, chưa phải là "không có".

| Công cụ | Kéo thả | Chuột phải | Phím tắt | Nút nổi khi hover | Chụp vùng | Chọn đích lúc lưu | Ghi chú/tag lúc lưu | Metadata tự động | Bản gốc | Lưu cả trang |
|---|---|---|---|---|---|---|---|---|---|---|
| **Eagle** | Có | Có, và **Alt + chuột phải** "để vượt hạn chế tải" | Có (tuỳ chỉnh được) | | Area, Element, Full page | Thư mục | Thư mục và tag lúc thu thập | Ghi **link nguồn** | "One-click HD" | Có, lọc theo kích thước và định dạng |
| **Pinterest Save** | | Có | | **Có** (nút Save trên ảnh) | | Chọn board | | | | |
| **Are.na** | | Ảnh và text | Option+A mở, Cmd+Enter lưu, Cmd+E sửa, Esc đóng | | Biểu tượng camera (Chrome, Firefox) | Kênh gần đây, gõ để tìm, tạo kênh mới ngay | Sửa tiêu đề và mô tả | Lưu tiêu đề và URL trang cùng ảnh | | Có (icon) |
| **Milanote** | | | | Biểu tượng hiện cạnh text được chọn | | Chọn board (nguồn thứ cấp) | | | | |
| **mymind** | | | | | | Không cần thư mục | Tag tay được | **AI tag, OCR, tìm theo màu** | | Có |
| **Cosmos** | | Ảnh, video, text | Không thấy tài liệu | **Có** (logo khi hover) | | | | | | Icon thanh công cụ lưu trang |
| **Raindrop** | | | ⌘⇧S (Mac), Ctrl+Shift+S (Win/Linux) | | | Collection | Tag, note | Bản lưu vĩnh viễn, tìm toàn văn | Có | |
| **Notion Web Clipper** | | | | | | Database | Sửa thuộc tính **sau** khi lưu (tài liệu chính thức) | | | Có |
| **Muse (Mac)** | | Ảnh, video, link, text, trang | | Có ("in-page clipper") | | | | | | Có |
| **Heptabase** | | | | | | | | | | **Không tìm thấy tài liệu** |

Nguồn: Eagle [trang extension](https://eagle.cool/extensions) và [tìm kiếm tài liệu](https://en.eagle.cool/support/article/saving-web-images) (trang docs chỉ trả bản tóm tắt); Pinterest qua [Tailwind](https://www.tailwindapp.com/blog/how-to-add-and-use-the-pinterest-chrome-extension) (nguồn thứ cấp, không phải trang hỗ trợ chính thức); [Are.na help](https://help.are.na/docs/getting-started/browser-extension); [Milanote](https://help.milanote.com/en/articles/1015930-the-milanote-web-clipper) (tìm kiếm tóm tắt, thiếu đường bấm cho ảnh); [mymind](https://mymind.com/what) và [help tagging](https://mymind.helpscoutdocs.com/article/51-how-to-use-tagging-in-mymind) (phần lớn thứ cấp); [Cosmos help](https://help.cosmos.so/en/articles/11717927-download-our-extensions) và [Chrome Web Store](https://chromewebstore.google.com/detail/save-to-cosmos/mgjneceglphcpbbfbhjplkpgfapebmdg); [Raindrop help](https://help.raindrop.io/browser-extension); [Notion Web Clipper](https://notion.com/help/web-clipper); Muse qua danh sách bên thứ ba, **tạm thời** (có thể lẫn với app iPad cùng tên).

### Bảy mẫu hình rút ra

1. **Một cử chỉ, mặc định thông minh, phân loại sau.** Are.na chọn từ "kênh gần đây" và lưu bằng một phím; Cosmos chỉ cần một cú bấm. Người đang lướt đang ở chế độ **gom**, không ở chế độ **phân loại**.
2. **Nút nổi trên ảnh** là cách người ta nhận ra "ảnh này lưu được" mà không phải nhớ cử chỉ. Pinterest và Cosmos dùng; Pinterest còn đặt kính lúp ngay cạnh Save cho tìm ảnh tương tự (mẫu cho báo cáo Visual Explore).
3. **Lối thoát cho trang chặn chuột phải.** Chỉ Eagle nêu rõ: Alt + chuột phải "to bypass download restrictions". KIRA đã có đúng cử chỉ này (`content.ts:155`).
4. **Menu ngữ cảnh phủ nhiều loại**: ảnh, text bôi đen, link, video, trang. Are.na, Cosmos, Muse đều phủ text; chỉ Cosmos nêu video.
5. **Lưu hàng loạt có bộ lọc.** Eagle: thu mọi asset trong trang, lọc kích thước và định dạng, gắn thư mục và tag ngay lúc thu. KIRA có phần lõi ở popup (`popup.ts:14` bộ lọc rộng/cao, định dạng).
6. **Metadata tự động chạy sau, không chặn lúc lưu.** mymind tag, OCR và tìm theo màu sau khi lưu; người dùng không phải điền gì. `[Ngoài]` một bài đánh giá nói nó cần kết nối mạng để xử lý.
7. **Bản lưu bền** (Raindrop giữ bản sao dù trang gốc bị gỡ) so với **lưu liên kết** (hotlink). KIRA hiện là loại thứ hai cho mọi ảnh trừ Pinterest (mục 4).

Heptabase: tìm không ra tài liệu về web clipper, không kết luận.

## 3. Plugin KIRA hiện làm được gì `[Code]`

| Đường vào | Cách hoạt động | Vị trí |
|---|---|---|
| Menu chuột phải | "Capture Image to KIRA" (ngữ cảnh `image`), "Capture Page to KIRA" (ngữ cảnh `page`) | `background.ts:15`, `:20` |
| Alt + chuột phải trên ảnh | Gửi thẳng, toast "Saved to KIRA" | `content.ts:155` |
| Kéo ảnh | `dragstart`, bảng thả hiện ra; có đường dự phòng bằng pointer khi trang không phát HTML5 drag | `content.ts:86`, `:345` |
| Popup | Liệt kê ảnh trong trang, lọc kích thước và định dạng, chọn nhiều, tag và note | `popup.ts:14`, `:219` |
| Drag window | Cửa sổ nhỏ chọn **node đích** hoặc "tạo idea", dựa trên `GET /context` | `drag-window.ts:29`, `:84` |
| Lấy URL ảnh | `srcset` lấy bản rộng nhất, `<picture>`, `currentSrc`, CSS `background-image` (cả `image-set`) | `content.ts:216`, `:269` |
| Bản lớn | **Chỉ Pinterest** (`pinimg.com` đổi `/236x/` thành `/originals/`, dò HEAD), app tải thêm một lần nữa tới 25MB | `content.ts:1004`; `main.tsx:3522`, `:15151` |
| Kênh gửi | Service worker `POST http://127.0.0.1:47653/capture`; `host_permissions` chỉ có đúng một origin | `background.ts:4`, `:135`; `manifest.json:7` |
| Dự phòng khi app tắt | Một ô `pendingCapture`, toast "Mở Kira App để sử dụng tính năng này"; popup có nút copy JSON, app **có** đường dán lại (`parseKiraCapturePayloads`) | `content.ts:986`; `popup.ts:60`; `main.tsx:3971`, `:4010` |
| Không có | phím tắt (`commands`), huy hiệu icon, lưu text, lưu link, chụp vùng, khung hình video, bất kỳ trích xuất màu hay font | grep toàn `apps/extension/src` và `manifest.json` |

`scripting` **có dùng** (`popup.ts:224`, `executeScript` để dò ảnh trong trang) nên quyền này không thừa.

## 4. Đo được ở app (QA 2026-09-20, `56ad91e`, đã xác nhận không đổi tới `7829b85`)

Gửi trực tiếp bằng `curl` vào `127.0.0.1:47653` rồi đọc `GET /context` để biết app có tạo node hay không. App debug đang chạy; không qua trình duyệt.

| Payload | HTTP | Node có được tạo? |
|---|---|---|
| ảnh `https` hợp lệ | 200 | Có |
| trùng URL | 200 | Không (đúng thiết kế, `main.tsx:3490`) |
| ảnh `data:image/gif;base64,…` | 200 | **Không, im lặng** |
| ảnh `http://` | 200 | Có |
| `kind: 'page'` | 200 | Có, **thành node ảnh** với thumbnail là URL trang |
| thiếu `title` | 200 | **Không, im lặng** |
| header và body tách thành hai lần ghi TCP | **404** | Không |
| header và body một lần ghi | 200 | Có |
| body khoảng 70KB | 200 | **Không** (bị cắt ở 64KB, JSON hỏng) |

Nguyên nhân ở code: `lib.rs:4754` đọc đúng **một lần** vào bộ đệm 65536 byte, không đọc theo `Content-Length`; rồi `app.emit` và trả `200` **trước** khi `parseKiraCapturePayload` (`main.tsx:15414` cho `parseCaptureUrl`, chỉ chấp nhận `http` và `https`) kiểm payload. Hệ quả là `postCapture` ở extension coi `response.ok` là thành công, nên toast "Saved to KIRA" hiện cả khi app đã bỏ.

Hai việc đã đọc trong code nhưng **chưa đo**:

- **Ảnh capture không bao giờ được phân tích.** `analyzeImageDataUrl` chỉ có một nơi gọi, ở nhập file local (`main.tsx:15046`). Đường capture đặt `palette` bằng `paletteFromName` (`main.tsx:15627`), tức màu sinh từ **chuỗi URL**, không phải từ ảnh; và `thumb` chính là URL từ xa (`main.tsx:15128`). Hệ quả: ảnh capture không có `perceptualHash` nên **không tham gia phát hiện trùng**, và nút "Find similar" (`main.tsx:6031`, xếp theo tag trùng và độ lệch hue) so màu giả.
- **Mọi lần app hiển thị thư viện đều gọi ra máy chủ ảnh gốc** vì chỉ lưu URL. Hệ quả riêng tư (host thấy IP, thời điểm, thứ bạn tham chiếu) và độ bền (link chết, URL có chữ ký hết hạn). Chưa bắt gói tin để xác nhận.

## 5. Còn thiếu, thừa, ma sát, xếp ưu tiên

Công sức: **S** ≤ 1-2 ngày, **M** 3-5 ngày, **L** > 1 tuần (ước lượng của tôi, `[Suy luận]`). "Số công cụ" là số trong 9 công cụ ở mục 2 có tài liệu về tính năng đó.

| # | Hạng mục | Loại | Số công cụ | Tần suất `[Suy luận]` | Công sức | Ưu tiên | Ai làm |
|---|---|---|---|---|---|---|---|
| 1 | Server ack sau khi kiểm payload, đọc theo `Content-Length` vòng lặp tới đủ, trả 4xx kèm lý do; extension hiện lỗi thật | Ma sát (thành công giả) | n/a | **Mọi lần capture** | S-M | **P0** | Backend |
| 2 | Thống nhất `data:` và `blob:` giữa `isCaptureUrl` (`content.ts:316`) và `parseCaptureUrl` (`main.tsx:15414`): hoặc bỏ ở extension, hoặc cho extension **gửi bytes** | Ma sát | n/a | Vừa (một số site nhúng thumbnail dạng `data:`) | S nếu bỏ; M nếu nhận bytes | P0 (quyết định hướng) | Backend + Extension |
| 3 | **Hàng chờ nhiều ô** (mảng, giới hạn khoảng 50, kèm thời điểm), huy hiệu số đang chờ trên icon, tự đẩy khi `/context` trả lời được lại | Thiếu | Công cụ dùng đám mây không có vấn đề này; chỉ Eagle và Muse có ràng buộc "app phải chạy" | Cao với người hay đóng app lúc lướt | M | **P0** | Extension |
| 4 | **Nút Save nổi khi hover ảnh** (Shadow DOM, bỏ qua ảnh nhỏ), kèm hàng nhỏ "Hover để lưu" lần đầu | Thiếu | 2 (Pinterest, Cosmos) + Muse | **Cao** (mẫu hình phổ biến nhất ở 2) | M | **P1** | Extension |
| 5 | **Phím tắt** qua `commands` trong manifest: lưu ảnh đang hover hoặc ảnh dưới con trỏ; lưu trang; mở popup | Thiếu | 2 (Are.na, Raindrop) + Eagle | Cao với người dùng phím | S | **P1** | Extension |
| 6 | `contextMenus` thêm `selection` và `link`; text đưa vào `note` hoặc node text | Thiếu | 5 (Are.na, Milanote, Cosmos, mymind, Muse) | **Cao** với copywriting | S ở extension; **M** ở app (type `kind` hiện chỉ `image` và `page`, `types.ts`) | **P1** | Extension + Worker |
| 7 | **Trang** lấy `og:image`, `og:title`, mô tả, `<link rel=canonical>`; app dùng ảnh làm thumbnail thay vì URL trang | Ma sát | 5 | Cao (mọi lần lưu trang) | S | **P1** | Extension + Worker |
| 8 | Tải **bản gốc** về project lúc nhận capture, rồi chạy `analyzeImageDataUrl` (palette thật, hash, kích thước) | Thiếu | Eagle "HD", Raindrop bản lưu | Cao (nền cho trùng, tương tự, riêng tư, bền) | M | **P1** | Native + Worker |
| 9 | Bảng viết lại URL để lấy bản lớn cho site khác ngoài Pinterest. **Chưa kiểm** quy tắc nào hợp lệ: ví dụ Wikimedia (`/thumb/…/NNNpx-` về đường dẫn gốc) và Unsplash (bỏ tham số `w=`, `q=`) theo hiểu biết của tôi, cần thử trên trang thật trước khi tin | Thiếu | 1 (Eagle "HD") | Vừa | S mỗi site | P2 | Extension |
| 10 | **Chụp vùng** (`chrome.tabs.captureVisibleTab` cộng lớp chọn vùng) cho story, video, PDF | Thiếu | 2 (Eagle, Are.na) | Vừa | **M-L** (cần đường gửi bytes, phụ thuộc #2 và #8) | P2 | Extension + Backend |
| 11 | Hàng loạt không cần mở popup: chọn nhiều ảnh bằng Alt+click liên tiếp, thả một lần (đã đề xuất ở `RESEARCH_MOODBOARD_UX.md` §2.2) | Thiếu | 1 (Eagle) | Vừa | M | P2 | Extension |
| 12 | Tag và note nhớ lần trước; "board đích" nhớ lần cuối; hiển thị nhiều board (xem `RESEARCH_MOODBOARD_UX.md` §2.2, `/context` hiện chỉ mô tả **một** file) | Ma sát | 4 (đích lúc lưu) | Vừa | M | P2 | Extension + Native |
| 13 | Trích **màu** (eyedropper) và **font** | Thiếu | 0 trong 9 công cụ (cần plugin riêng: WhatFont, ColorZilla) | Thấp-vừa với brand, hiếm ở công cụ clipper | M | P3 | Extension |
| 14 | Khung hình **video** | Thiếu | 1 (Cosmos nêu video) | Thấp-vừa | L | P3 | Extension |
| 15 | Nhận diện trang Instagram, Behance, Dribbble: cần đo (QA đã **chưa** làm do Chrome không nối được) | Chưa biết | n/a | n/a | n/a | Kiểm trước khi làm | QA Extension |

**Thừa, hoặc nên dọn:**

- Ba chế độ trong bảng thả (`undecided`, `target-node`, `create-or-select`, `drag-window.ts:29`, `:84`) bắt phân loại đúng lúc người dùng đang ở chế độ gom. Đã có đề xuất bỏ ở `RESEARCH_MOODBOARD_UX.md` §2.2; mục này giữ nguyên kết luận đó, không lặp lại.
- Fallback "copy JSON vào clipboard" **không thừa**: app có đường dán lại (`main.tsx:3971`). Nhưng thông báo "KIRA unavailable. Copied" (`popup.ts:60`) không nói người dùng phải làm gì tiếp. Chỉ cần sửa chữ.
- `host_permissions` chỉ một origin là gọn. Rủi ro nằm ở `content_scripts.matches` bao `http://*/*` và `https://*/*` (`manifest.json:14`): cần cho hover và drag, nhưng nặng khi duyệt Chrome Web Store (đã có ghi chú ở `apps/extension/STORE_LISTING.md`).

## 6. Khi app KIRA tắt

`[Ngoài]` Eagle yêu cầu app Eagle chạy ("require the Eagle app"). Muse (qua danh sách bên thứ ba) cũng cần app chạy trên cùng máy. Các công cụ còn lại ở mục 2 lưu lên đám mây nên không có tình huống này. Tài liệu của Eagle về hành vi khi app tắt **không tìm thấy**.

KIRA thuộc nhóm "app cục bộ", nên phải tự giải quyết. Các đường, rẻ tới đắt:

| Đường | Cách | Giới hạn |
|---|---|---|
| **A. Hàng chờ trong extension** (khuyến nghị) | Mảng trong `chrome.storage.local`, huy hiệu số trên icon (`chrome.action.setBadgeText`), thử gửi lại khi service worker thức dậy hoặc theo `chrome.alarms` | Cần khoản `alarms`; chỉ URL thì nhỏ, nếu về sau gửi bytes (#2, #10) cần `unlimitedStorage` hoặc IndexedDB. Safari giết service worker rất nhanh (`RESEARCH_MOODBOARD_UX.md` §2.1), nên đừng giữ trạng thái ở biến module |
| **B. Mở app từ extension** | Đăng ký URL scheme (ví dụ `kira://`) bằng plugin deep-link của Tauri; extension điều hướng tới đó | Trình duyệt hỏi xác nhận lần đầu; chưa kiểm khả năng của plugin trên macOS; không cần cho P0 |
| **C. Native messaging** | Host riêng có thể `open -a KIRA` | Thêm bước cài host manifest, đúng loại ma sát cài đặt mà user đã than ở vòng trước |
| **D. Thư mục theo dõi (inbox)** | Extension không ghi được đĩa trực tiếp | Không khả thi nếu không có C |

Khuyến nghị: làm **A** cùng #3, để B cho sau. Lưu ý chấp nhận được rằng chỉ phát lại khi trình duyệt còn mở: nếu cả trình duyệt cũng đóng, mảng vẫn nằm đó tới lần mở sau.

## 7. Quyền riêng tư: có gửi gì ra ngoài không

Câu trả lời ngắn: **extension thì không; app thì gián tiếp.**

- `[Code]` Extension chỉ có `host_permissions` tới `http://127.0.0.1:47653/*`. Hai kiểu gọi mạng ra ngoài tồn tại: `fetch(HEAD)` dò bản lớn của Pinterest tới `pinimg.com` (`content.ts:1004`, chỉ khi ảnh thuộc `pinimg.com`), và các request ảnh của chính trang bạn đang xem. Không có telemetry hay dịch vụ ngoài nào khác trong `apps/extension/src` (đã grep `fetch` và `XMLHttpRequest`).
- `[Code]` App lưu URL gốc làm thumbnail (`main.tsx:15128`) nên mỗi lần hiển thị thư viện là một request ra máy chủ ảnh. Không phải lỗi của extension, nhưng là một dòng rò theo thiết kế. Giải bằng #8 (tải một lần về project).
- `[Code]` **Lỗ lớn nhất:** `http_response` ở `lib.rs` đặt `Access-Control-Allow-Origin: *` và `GET /context` trả `fileTitle` cùng danh sách node (tiêu đề, thumbnail). Bất kỳ trang web nào chạy được `fetch('http://127.0.0.1:47653/context')` đều có thể đọc, và `POST /capture` có thể bơm ảnh vào board của bạn. Chrome từ phiên bản 142 chặn mặc định kiểu gọi này từ trang công khai tới loopback bằng hộp xác nhận (đã ghi ở `RESEARCH_MOODBOARD_UX.md`), nhưng **chưa đo** trong Safari hay Firefox và chưa đo trên trang thật nào. Khoá bằng cách: kiểm header `Origin` (chỉ nhận `chrome-extension://<id>` và `safari-web-extension://…`), bỏ `ACAO: *`, và cân nhắc một token chia sẻ qua `chrome.storage`. Đề xuất cho Backend, công sức S.

## 8. Những điều tôi **không** kiểm chứng được

- Hành vi của Eagle khi app tắt, và danh sách phím tắt đầy đủ của Eagle.
- Cách Milanote chọn board với ảnh trên Chrome (nguồn chỉ nói với text).
- Toàn bộ về Heptabase.
- Các tính năng của mymind chủ yếu qua trang nhà cung cấp và bài đánh giá, không có tài liệu kỹ thuật.
- Quy tắc viết lại URL cho Behance, Instagram, Dribbble, Unsplash, Wikimedia (mục 5, #9).
- Việc Instagram, Behance, Dribbble, Are.na, Pinterest có bắt được ảnh đúng độ phân giải trong trình duyệt thật: phần này của task QA trước (bước 3 đến 5) vẫn **chặn** vì Chrome của user không nối được. Nên giao lại khi nối được.

## 9. Đề xuất

1. Giao Backend sửa #1 (server) và khoá `Origin` (mục 7) ngay; hai việc nhỏ, gỡ được "thành công giả" và lỗ riêng tư.
2. Quyết định hướng #2: `data:` và `blob:` hay chỉ URL. Câu trả lời quyết định có làm chụp vùng (#10) và Visual Explore (báo cáo thứ hai) hay không, vì cả hai cần đường gửi hoặc tải **bytes**.
3. Extension: làm #3, #4, #5, #7 thành một đợt (nhóm "thu thập không ngắt dòng"). #6 cần Worker thêm kiểu node text trước.
4. Nối Chrome của user để QA Extension chạy nốt bảng trang x cách đẩy; chưa có dữ liệu đó thì #9 và #15 là phỏng đoán.

# Đặc tả Slides: tiêu đề, thân, cỡ chữ, chiều cao, Deck template

Vai UI/UX, 2026-09-21, đo trên `main` tại `51f2fc2`. **Chỉ đặc tả, chưa sửa code.** `main.tsx` và `styles.css` đang do Worker giữ; số dòng dưới đây là xấp xỉ theo SHA đó.

Đi kèm thư mục [`slides-spec/`](slides-spec/):

| File | Là gì |
|---|---|
| [`mockup.html`](slides-spec/mockup.html) | 6 node mẫu chạy qua quy tắc dưới đây, vẽ ở 3 kiểu, mỗi khung là sân khấu 1280×720 thật, có phép đo tự động (huy hiệu xanh/đỏ). Mở bằng `python3 -m http.server` trong thư mục đó. |
| [`slide-text.js`](slides-spec/slide-text.js) | Bản cài đặt tham chiếu (hàm thuần, không DOM) của §3, §4, §6. Worker nâng nguyên sang TypeScript. |
| [`slide-text.test.mjs`](slides-spec/slide-text.test.mjs) | 9 test, chạy bằng `node --test docs/design/slides-spec/slide-text.test.mjs`. Đang xanh. |
| [`shots/`](slides-spec/shots/) | `before-*.jpg` (app hiện tại) và `after-mockup.jpg`. |

## 0. Kết luận

1. **Gỡ select "Deck template" khỏi thanh điều khiển ngay.** Nó không đổi gì nhìn thấy được (đã đo, §1), nên mỗi lần user bấm là một lời hứa bị phá. Làm nó chạy thật là việc thiết kế riêng (3 kiểu, §7), không phải sửa lỗi; chỉ làm nếu user muốn có "Kiểu slide". Trong lúc chưa có, giữ `deckMeta.template` trong dữ liệu để khỏi mất tương thích, chỉ không hiện ra.
2. **Sửa gốc lỗi chữ, không sửa từng triệu chứng.** Bốn lỗi chữ (lặp câu, tràn tiêu đề, cắt giữa chữ, chiều cao vô hạn) cùng một gốc: slide không có khung cố định và không có quy tắc "chữ nào là tiêu đề, chữ nào là thân". Đặc tả này đặt: sân khấu cố định 16:9, tiêu đề tách khỏi thân theo nguồn, cỡ chữ theo bậc, cắt ở ranh giới chữ có dấu `…`.
3. **Cho user sửa chữ trên slide** bằng hai ô trong popover slide hiện có (§9). Lớp dữ liệu `titleOverride`/`summaryOverride` đã có sẵn, chỉ thiếu UI. Outline sửa tại chỗ dùng cùng trường đó.
4. **Một thứ tự duy nhất** cho outline và slide (§8).

## 1. Số đo (không đo lại; nguồn: Orchestrator và lượt đo của tôi, dark, 1440×900, export 1280×720)

| Hiện tượng | Đo được |
|---|---|
| Cỡ chữ `h2` trong app | Hằng `61.92px` (`clamp(2rem, 4.3vw, 4.8rem)`), `max-width: 12ch` (≈ 287px ở khung này), bất kể độ dài |
| Tiêu đề 80 ký tự (một câu) | 10 dòng, cao 607px, trong khung canvas 786px; câu thân đứng dưới, chạm đáy |
| Tiêu đề tiếng Việt 82 ký tự | 12 dòng, cao 728px, `h2` tràn khỏi canvas (đáy 918 so với 890) |
| Tiêu đề 120 ký tự | tới 1092px |
| Slide trong export HTML | cao tới 2273px trong khung 720px; slide bìa 2448px, **tiêu đề nằm dưới màn hình đầu**; 9 slide = 17,5 màn hình |
| `@page 1280x720` | chia một slide qua nhiều trang PDF |
| Select "Deck template" | 5 giá trị cho ra `getComputedStyle` giống hệt nhau trong app; export khác nhau đúng 2 dòng manifest |
| Câu bị in hai lần | mọi slide ý tưởng: `title: idea.title` và `summary: presentationSummary(idea.content)` (`main.tsx` ~14895) cùng lấy câu đầu |
| Markdown rò lên slide | thân hiển thị `# Phố cổ sau mưa …` |
| Chữ do máy sinh nằm trên slide | câu tiếng Anh "Add visual support before presenting…", "Use the contrast references…", nhãn kicker tiếng Anh, "Needs references" lọt vào export |
| Export HTML | kicker dùng `--accent` chưa khai báo, rơi về màu kế thừa |
| PPTX | hộp cố định (tiêu đề 5,8in × 1,7in ở 34pt đậm, tóm tắt bắt đầu y=2,9in) không co theo chữ, tiêu đề 80 và 120 ký tự đè lên tóm tắt |
| Cắt tiêu đề | `deriveTitleFromContent` `.slice(0, 120)` cắt giữa chữ, không có dấu `…` |

Ba hình học slide không khớp nhau: app (lưới co giãn), HTML (`100dvh` nhưng mọc dài), PPTX (13,33×7,5in cố định). Đó là lý do chữ vừa ở nơi này lại tràn ở nơi kia. Ảnh: `shots/before-slide-02.jpg`, `before-slide-03.jpg`, `before-slide-06.jpg`, `before-slide-08.jpg`, `before-export-first-screen.jpg`, `before-outline.jpg`.

## 2. Sân khấu cố định

**Mọi slide là một sân khấu 1280×720 px (16:9), luôn.** Không phần tử nào của slide làm nó cao thêm. Các đầu ra chỉ khác nhau ở cách hiển thị sân khấu đó:

| Đầu ra | Cách |
|---|---|
| Trong app (canvas slide, trình chiếu) | Sân khấu 1280×720 đặt trong khung co giãn, `transform: scale(k)` với `k = min(W/1280, H/720)`, `transform-origin: center`. Mọi kích thước bên trong tính theo px của sân khấu, không dùng `vw`. |
| Export HTML | Mỗi slide một `.stage` 1280×720, cùng cách scale bằng một dòng JS `--k` khi `resize`; cuộn `scroll-snap-type: y mandatory`, mỗi slide đúng một màn hình. Bỏ `min-height: 100dvh` và `img min-height: 54vh` của bìa. |
| PDF (in) | `@page { size: 1280px 720px; margin: 0 }`, `.stage { transform: none; break-after: page }`. Một slide đúng một trang. |
| PPTX | 13,333×7,5in (đúng 1280×720 ở 96 dpi). Hộp chữ tính từ bảng bậc (§4), đổi `pt = px × 0,75`. |

Khung sân khấu: lề ngang 96px, lề dọc 64px, vùng chữ cao tối đa 592px. Cột chữ 560px khi có ảnh (ảnh chiếm phần còn lại), 900px khi không có ảnh. Khối chữ (kicker + tiêu đề + thân) căn giữa dọc trong vùng chữ.

Ngân sách chiều cao, tính cho trường hợp xấu nhất: kicker 20 + cách 20 + tiêu đề ≤ 266 + cách 20 + thân 4 dòng × 30 = 120 → **≤ 446px so với 592px**. Không thể tràn nếu chữ tuân theo §3 và §4.

## 3. Tiêu đề và thân

**Nguyên tắc: một khoảng chữ nguồn chỉ được dùng một lần trên một slide.** Tiêu đề và thân không bao giờ chồng nhau.

Thứ tự ưu tiên cho tiêu đề: `titleOverride` (user sửa) → dòng tiêu đề markdown `# …` đầu nội dung → **câu đầu** của nội dung → (node trống thì không có).
Thân: `summaryOverride` → phần nội dung còn lại sau khi trừ tiêu đề → rỗng. Không có thân thì slide chỉ có tiêu đề (đó là slide đúng, không phải slide thiếu).

Xử lý nội dung nguồn (chạy trước khi tách): chuẩn hoá NFC, bỏ ký hiệu markdown (`#`, `>`, `-`, `1.`, `**`, `` ` ``, liên kết `[a](b)` thành `a`), gộp khoảng trắng. Hiện `# Phố cổ sau mưa` lọt vào thân; sau khi sửa thì tiêu đề là `Phố cổ sau mưa`, thân là phần còn lại.

Độ dài tối đa: tiêu đề 140 ký tự hiển thị, thân 220. Vượt thì cắt theo §6; khi tiêu đề bị cắt, **phần đuôi chuyển xuống đầu thân** (mở bằng `…`) để câu không mất chữ, và popover slide (§9) hiện dòng gợi ý "Tiêu đề đã được rút gọn", không hiện lên slide.

**Chữ do máy sinh không nằm trên slide.** Các câu "Add visual support…", "Use the contrast references…", "This direction needs a clearer working thesis…" và cụm "Needs references" là lời nhắc cho tác giả, không phải nội dung để trình chiếu:
- Chuyển sang popover slide (§9) dưới dạng dòng gợi ý mờ ("Slide này chưa có ảnh tham chiếu") và sang ghi chú người trình bày trong PPTX.
- Không bao giờ vào HTML/PDF export.
- Kicker của slide (nhãn strength, "Đang phát triển"…) đi qua cùng i18n với giao diện; nếu chưa có bản dịch cho ngôn ngữ đang chọn thì bỏ kicker chứ không in tiếng Anh xen vào slide tiếng Việt.

**Node trống không vào deck.** `splitSlideText` trả `empty: true`; deck bỏ node đó theo mặc định. Outline hiện dòng mờ "Node trống, không vào deck" với công tắc "Đưa vào" (nếu user bật, slide chỉ có kicker và ô tiêu đề để gõ, export bỏ qua slide còn rỗng).

**Slide bìa:** tiêu đề là tên project (không phải chuỗi cố định "KIRA Direction Deck"), thân là một dòng đếm ("7 hướng, 6 ảnh tham chiếu") ở bậc thân, kicker bỏ. Tiêu đề bìa cũng đi qua bậc cỡ chữ ở §4, cho phép sửa bằng `titleOverride`.

**Kết quả trên 6 node mẫu** (chạy bằng `slide-text.js`, khớp `mockup.html`):

| # | Node | Tiêu đề | Bậc | Thân | Ghi chú |
|---|---|---|---|---|---|
| A | `Quiet tools.` (12) | 12 ký tự | 88px | rỗng | không còn lặp câu |
| B | 1 câu EN, 80 ký tự | 80 | 44px, 3 dòng | rỗng | trước đây 10 dòng, 607px |
| C | 1 câu VI có dấu, 82 ký tự | 82 | 44px, 3 đến 4 dòng | rỗng | trước đây 12 dòng, tràn canvas |
| D | `# Phố cổ sau mưa` + đoạn dài | 14 | 88px, 2 dòng | đoạn bị cắt ở 220 | không rò `#` |
| E | đoạn 561 ký tự, câu đầu 165 | 135 (cắt, kết `edge…`) | 34px, 4 đến 5 dòng | bắt đầu `…a hand-rubbed…`, cắt ở 220 | tiêu đề không kết bằng `a` |
| F | 1 câu VI 271 ký tự, không dấu chấm | 136 (cắt) | 34px, 3 dòng | phần đuôi, cắt ở 220 | |

## 4. Cỡ chữ theo độ dài

Chọn bậc theo số **ký tự hiển thị** (cụm grapheme, §6) của tiêu đề đã tách. Bốn bậc rời, không nội suy, để PPTX (không đo được chữ) cho kết quả trùng HTML.

| Độ dài tiêu đề | Cỡ (px / pt PPTX) | Dòng tối đa | line-height | Khối tiêu đề tối đa |
|---|---|---|---|---|
| ≤ 16 | 88 / 66 | 3 | 1,00 | 264px |
| 17 đến 36 | 64 / 48 | 4 | 1,04 | 266px |
| 37 đến 90 | 44 / 33 | 5 | 1,08 | 238px |
| 91 đến 140 | 34 / 26 | 6 | 1,12 | 228px |

Các thông số đi kèm: kicker 13px chữ hoa, `letter-spacing: .08em`; thân 20px, line-height 1,5, tối đa 4 dòng, `max-width: 52ch`; tiêu đề `text-wrap: balance`, `letter-spacing: -.02em`, weight 680 (sans).

**Cách bảng này được chốt (đã chạy):** ép chuỗi xấu nhất (toàn chữ hoa tiếng Việt có dấu, Latin rộng "Wonderful Watermelon…", hỗn hợp) đúng bằng giới hạn trên của từng bậc, ở 4 độ rộng cột (420, 560, 620, 900) và 2 họ phông (sans, serif); **48/48 trường hợp không vượt số dòng tối đa**. Bảng đầu (bậc 88/64/48/38, 2/3/4/5 dòng) trượt 16/48 trường hợp và bị bỏ. Tiêu đề thực tế gần như luôn ngắn hơn số dòng tối đa (mockup: 1 đến 5 dòng), nên "tối đa" chỉ là hàng rào.

Hai lớp bảo vệ cho ngoại lệ ngoài bảng (phông người dùng rộng hơn, ký tự lạ):
- **HTML/app:** `-webkit-line-clamp` bằng số dòng tối đa của bậc (kèm `overflow: hidden`). Chỉ là lưới an toàn; nếu chạm thì chữ kết bằng dấu `…` của trình duyệt thay vì tràn khung.
- **PPTX:** hộp cao đúng `dòng tối đa × cỡ × line-height`; không tự co, vì bảng đã bảo đảm vừa.

Không dùng `clamp()` theo `vw` cho tiêu đề slide nữa (đây là nguyên nhân cỡ chữ đổi theo cửa sổ và không lặp lại được giữa các đầu ra).

### Token của sân khấu (chốt với Orchestrator 2026-09-21)

Bốn bậc là **token riêng của sân khấu slide**, khai trên `.slide-stage` (không ở `:root`, để không dùng nhầm ngoài sân khấu). **Chúng không thuộc type scale của app** (`--text-mini` đến `--text-large`) và không dùng ở đâu ngoài `.slide-stage`: sân khấu 1280×720 là hệ toạ độ riêng, được scale bằng `transform`, nên px ở đây là px của sân khấu, không phải px màn hình. Vì vậy đây không phải ngoại lệ "giá trị dùng một lần" mà luật type scale cấm: là một scale thứ hai, có tên và có chủ.

```css
.slide-stage {
  --slide-title-1: 88px;  /* tiêu đề ≤ 16 ký tự,   tối đa 3 dòng, line-height 1.00 */
  --slide-title-2: 64px;  /* 17 đến 36,            tối đa 4 dòng, line-height 1.04 */
  --slide-title-3: 44px;  /* 37 đến 90,            tối đa 5 dòng, line-height 1.08 */
  --slide-title-4: 34px;  /* 91 đến 140,           tối đa 6 dòng, line-height 1.12 */
  --slide-body: 20px;     /* thân, line-height 1.5, tối đa 4 dòng */
  --slide-kicker: 13px;   /* nhãn chữ hoa phía trên tiêu đề */
  --slide-title-scale: 1; /* "Thư viện ảnh" đặt 0.78, mọi kiểu khác giữ 1 */
}
.slide-stage[data-title-step="1"] .slide-title { font-size: calc(var(--slide-title-1) * var(--slide-title-scale)); line-height: 1; }
/* ...2, 3, 4 tương tự; -webkit-line-clamp lấy số dòng tối đa của bậc */
```

- Bậc do `data-title-step="1..4"` chọn, đặt bởi mã từ `titleStep()`; CSS không tự đoán theo độ dài.
- **Một nguồn sự thật:** bảng `TITLE_STEPS` trong `slideText.ts` (dùng cho PPTX và cho `data-title-step`) và bốn token CSS phải bằng nhau. Kiểm bằng một test đọc `styles.css` và so với `TITLE_STEPS` (§10, mục 9); lệch là test đỏ.
- Bậc thân của kiểu Biên tập (22px) và Thư viện ảnh (18px) ghi đè `--slide-body` trong khối kiểu của chúng, không thêm bậc mới.
- Đây là "thêm bậc vào scale" theo đúng nghĩa của luật: một scale mới có tên, không phải số rời trong `font-size`.

## 5. Chiều cao: chốt cứng

Đã trả lời ở §2: sân khấu 720px và **không có cách nào để một slide cao hơn**. Ba việc phải làm:

1. Bỏ `min-height: 100dvh` và `min-height: 54vh` của bìa trong export; `.stage { height: 720px; overflow: hidden }`.
2. Vùng chữ `min-height: 0; overflow: hidden` để chữ tràn bị cắt thay vì đẩy khung.
3. Ảnh dùng `aspect-ratio` cố định trong cột ảnh (`4/3`, `16/10` khi chỉ 1 ảnh, `16/8` khi 2 ảnh chồng), không `min-height` theo viewport.

Bố cục ảnh theo số ảnh tham chiếu: 0 ảnh = cột chữ 900px; 1 đến 2 ảnh = cột chữ 560 + cột ảnh xếp dọc; 3 ảnh trở lên = ba ô ngang cùng hàng (thấy ở E, F trong mockup). Trên 3 ảnh: chỉ hiện 3 ảnh mạnh nhất, thêm nhãn "+N" ở ô cuối (`--text-mini`, số đếm phụ trợ).

## 6. Cắt chữ và dấu tiếng Việt

Quy tắc cho `clipAtWord(text, max)` (và cho `deriveTitleFromContent`, đang `.slice(0, 120)`):

1. Đếm và cắt theo **cụm grapheme** (`Intl.Segmenter`, `granularity: 'grapheme'`), không theo đơn vị UTF-16: chữ tiếng Việt gõ dạng NFD (`a` + dấu hỏi rời) và emoji ghép (`👨‍👩‍👧‍👦`) không bao giờ bị tách. Đầu ra luôn NFC.
2. Nếu vừa thì giữ nguyên. Nếu không, cắt tại **khoảng trắng gần nhất trong 40% cuối** của ngân sách; không có thì cắt cứng tại ngân sách (chữ CJK, URL dài).
3. Bỏ dấu câu treo cuối (`, ; : . - –`) và **không kết bằng từ 1 đến 2 ký tự** ("a", "of", "và"): từ đó chuyển xuống phần đuôi.
4. Thêm đúng **một** `…` (U+2026, không phải `...`), không khoảng trắng phía trước. Không bao giờ hai dấu `…` liên tiếp.
5. Đuôi bị cắt được trả lại (`rest`) để §3 đưa xuống thân, không vứt.

Test tự động: NFD, emoji ghép, từ treo, thân cắt ở 220. Xem `slide-text.test.mjs` (9 test).

## 7. "Deck template"

**Khuyến nghị: gỡ select khỏi thanh điều khiển.** Lý do: `DESIGN.md` §2.2 coi mỗi control là một tín hiệu "việc này làm được"; một control không có hiệu lực nhìn thấy được phá đúng tín hiệu đó. Hiện `applyDeckTemplate` chỉ ghi `deckMeta.template`, không CSS nào đọc `data-deck-template`. Trong 5 giá trị (Auto, Minimal, Editorial, Timeline, Moodboard Grid) chỉ "Timeline" và "Moodboard Grid" có tên gợi bố cục, và cả hai cần dữ liệu (biểu đồ, số ảnh) mà slide không thể hiện. "Auto" đã chọn theo heuristic nhưng kết quả không hiện ra ở đâu.

Việc cần làm ngay: ẩn select template khỏi `.slideshow-controls`; giữ `Slide layout mode`. `deckMeta.template` giữ nguyên trong dữ liệu (không di trú, để file cũ mở được) nhưng không đọc.

**Nếu user muốn "Kiểu slide" (làm sau, chỉ khi có lời yêu cầu):** ba kiểu, mỗi kiểu chỉ đổi **token**, không đổi cấu trúc slide, để export/PPTX/app luôn khớp. Tên gọi theo việc nhìn thấy, không theo thuật ngữ: **Tối giản**, **Biên tập**, **Thư viện ảnh**. Bỏ "Timeline" (cần dữ liệu không có) và "Auto" (không ai thấy nó làm gì).

| Token | Tối giản | Biên tập | Thư viện ảnh |
|---|---|---|---|
| Nền / chữ | `#0d0f0e` / `#f1eee7` | giấy `#f4f1ea` / `#23211d` | như Tối giản |
| Nhấn | `#84cdbc` | `#004f42` | như Tối giản |
| Phông tiêu đề và thân | hệ thống sans | serif hệ thống (`New York`, Georgia), thân 22px | như Tối giản, thân 18px |
| Bậc tiêu đề | bảng §4 | bảng §4 | bảng §4 × 0,78 |
| Cột chữ / ảnh | 560 / còn lại | 620 / còn lại | 420 / còn lại |
| Ảnh | bo 8px, chú thích hiện | vuông, viền hairline, chú thích in nghiêng | bo 4px, không chú thích |
| Kicker | chữ nhấn | có hairline phía trên | như Tối giản |

Bảng này là đúng cái mockup vẽ; lựa chọn kiểu phải được Worker mở qua **một** thuộc tính `data-slide-style` và các biến CSS trên `.slide-stage`, không nhánh riêng trong mã. Đọc và ghi vào `deckMeta.template` với ba giá trị mới, giá trị cũ (`auto`, `Timeline`, `Moodboard Grid`, `Editorial`, `Minimal`) map về `Tối giản`.

## 8. Thứ tự và outline (ngắn, vì bạn hỏi về slide, không phải outline)

- **Một nguồn thứ tự.** Thứ tự deck là thứ tự outline; user kéo hàng trong outline để đổi. Hiện outline theo mảng `ideas`, slide theo `strengthRank` rồi `localeCompare` (bảng chữ cái làm hai slide "ngang hàng" đổi chỗ vô lý, đặc biệt với tiếng Việt).
- `strengthRank` chỉ để **xếp lần đầu**, khi deck chưa có `slideOrder`; hoà thì theo thứ tự tạo node, không theo bảng chữ cái.
- Hàng outline sửa tại chỗ tiêu đề và thân, ghi vào `titleOverride`/`summaryOverride` (cùng trường với §9). Bấm hàng **chọn hàng**, không nhảy sang canvas; nút phụ "Mở trên canvas" ở cuối hàng làm việc nhảy.
- Ngoài phạm vi: cuộn outline và lỗi export PPTX (Worker đang giữ).

## 9. `SlideCustomizer`: dùng lớp override đã có

Popover hiện chỉ có Slide layout (select), di chuyển, ẩn (`shots/before-customizer.jpg`). Thêm **hai ô lên đầu popover**, theo thứ tự đọc từ trên xuống, và giữ nguyên ba hàng cũ:

```
Tiêu đề slide            [ ô nhập, placeholder = tiêu đề tự tách ]   62/140
Nội dung slide           [ vùng nhập 3 dòng, placeholder = thân tự tách ]  0/220
  Để trống để dùng nội dung của node.                    Đặt lại
  ------------------------------------------------------------------
  Slide layout   [select]
  Di chuyển      ← →
  Ẩn slide       [công tắc]
```

- **Nơi đặt:** popover mở khi bấm chính slide, đúng `DESIGN.md` §2.1 (chi tiết chỉ hiện khi tương tác trực tiếp với đối tượng).
- **Kit:** dùng Input và TextArea của Untitled UI (trường và viền do kit lo; một control một tín hiệu focus, `DESIGN.md` §7). Không tự vẽ trường, không thẻ trong thẻ; các hàng ngăn bằng hairline và khoảng trắng.
- Đếm ký tự dùng cùng hàm `length` (grapheme) với §4; mờ dần khi ≥ 90% giới hạn, đỏ (token cảnh báo) chỉ khi vượt và có ô bị cắt; không chặn gõ, chỉ hiện "Sẽ được rút gọn trên slide".
- **Gợi ý** thay cho chữ sinh: một dòng mờ dưới cùng ("Slide này chưa có ảnh tham chiếu", "Có tham chiếu đối lập, xem lại độ tương phản"), lấy đúng nội dung các câu bị gỡ khỏi slide ở §3. Là chữ hướng dẫn, không phải nội dung.
- **Đặt lại** xoá cả hai override; nút chỉ hiện khi có override. Ghi khi rời ô (blur) hoặc Enter (Cmd+Enter với vùng nhập), không ghi mỗi phím.
- `accentOverride`: **để dành**, chưa có UI vì màu nhấn thuộc "Kiểu slide" (§7). Không xoá khỏi kiểu dữ liệu; không sinh giao diện chết.
- Bàn phím: Tab đi qua hai ô → layout → di chuyển → ẩn; Esc đóng popover. Copy hiển thị không em dash.

## 10. Tiêu chí nghiệm thu (kiểm được bằng máy)

Chạy trên fixture 6 node mẫu và thêm một node dài 561 ký tự tiếng Việt:

1. Không slide nào có tiêu đề là chuỗi con của thân, hoặc ngược lại (kiểm bằng `includes` sau khi chuẩn hoá).
2. Mọi `.stage` có `getBoundingClientRect().height` = 720 (trước khi scale) trong app và export; export có đúng N phần tử `.stage` cho N slide; `scrollHeight` của deck = N × `innerHeight`.
3. Số dòng tự nhiên của tiêu đề ≤ số dòng tối đa của bậc, ở cả ba kiểu (đã có trong `mockup.html`, huy hiệu).
4. PDF in ra có đúng N trang, không slide bị chia.
5. PPTX: cỡ chữ tiêu đề đúng bảng §4; hộp tiêu đề và hộp thân không chồng nhau (kiểm bằng toạ độ hộp).
6. `slide-text.test.mjs` xanh; thêm test chuỗi NFD tiếng Việt vào bộ test của app.
9. Test đồng bộ: bốn token `--slide-title-1..4` trong `styles.css` bằng `TITLE_STEPS[].size`. Đối chứng: đổi tay một token thì test phải đỏ.
7. Slide không chứa chữ tiếng Anh do máy sinh (grep "Add visual support", "Needs references", "Use the contrast" trong HTML export = 0).
8. Đối chứng: chạy cùng phép kiểm trên `main` hiện tại phải **thất bại** (chiều cao > 720, có câu lặp), để chứng minh phép đo đọc được dữ liệu thật.

## 11. Ghi chú cho Worker khi hiện thực

Thứ tự đề xuất (mỗi bước độc lập, đều nhỏ):
1. Đưa `slide-text.js` sang `apps/desktop/src/slideText.ts` (không phụ thuộc React), thêm test vào bộ test app. `deriveTitleFromContent` gọi `clipAtWord`.
2. `buildSlideLayouts` (~14895): `title`/`summary` lấy từ `splitSlideText`, thay `presentationSummary`. Chuyển câu huấn luyện sang trường `hint` mới (không xuất ra).
3. Sân khấu 1280×720 trong app (`.slide-canvas`) và export CSS; scale bằng `--k`; bỏ `clamp()` của `h2`; bậc theo `data-title-step`.
4. PPTX: hộp tính theo bảng bậc.
5. Popover: hai ô override, Đặt lại; outline sửa tại chỗ; ẩn select template.

Không cần đổi bố cục chính của app; chỉ thay phần trong khung slide. Không thêm bậc vào `--text-*`; sân khấu có bộ token `--slide-*` riêng (§4).

## 12. Câu hỏi còn mở

- **Ngôn ngữ chữ do máy sinh (kicker "Đang phát triển"…)**: dùng ngôn ngữ giao diện hay ngôn ngữ nội dung của node? Đề xuất: giao diện, và bỏ kicker khi chưa có bản dịch.
- **Căn dọc chữ**: HTML/app căn giữa khối chữ; PPTX căn trên một điểm cố định (không biết số dòng thực). Chấp nhận lệch nhẹ, hay ép cả ba đầu ra căn trên? Đề xuất: chấp nhận lệch.
- **Có làm "Kiểu slide" (§7) không**, hay giữ deck một kiểu duy nhất cho tới khi có yêu cầu?
- **Cover title từ tên project**: nếu project chưa đặt tên, dùng "Chưa đặt tên" hay bỏ slide bìa?

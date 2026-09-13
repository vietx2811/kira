# Nghiên cứu: nâng chất lượng thiết kế KIRA bằng skill và OSS có sẵn (kèm liquid glass)

- **Câu hỏi:** Styling hiện bị "AI slop". Có skill và OSS nào tích hợp được để đưa chất lượng thiết kế lên ít nhất chuẩn Google và Figma, kết hợp hiệu ứng liquid glass của Apple, thay vì tự viết và tự test?
- **Người yêu cầu:** User, trực tiếp tại thread Researcher (2026-09-14). Quyết định cuối thuộc Orchestrator.
- **Commit đã kiểm chứng:** vixio `c66b82f` (branch `researcher/right-panel-harness`). Nguồn ngoài truy cập 2026-09-14, trừ phần GitHub metadata ghi rõ ngày.
- **Quyết định đã chốt kèm theo:** **D11 = dùng assistant-ui** cho tab Chat (xem [phụ lục OSS](2026-09-13-right-panel-harness-oss.md) §2.1).
- **Kết luận ngắn:**
  1. **Không thêm skill "taste" mới.** Máy đang có sẵn nhiều skill thiên về web marketing (Awwwards, GSAP, brutalist). Dùng chúng cho một app công cụ sẽ làm slop nặng hơn. Xương sống nên là **impeccable** (đã cài, v4.3.1, có mode Operate, detector và kiểm bằng browser thật), cộng **color-expert** (đã bật).
  2. **"Chuẩn Google, Figma" cho app này = Operate mode**, tức Material 3 và các quy ước product UI, không phải thẩm mỹ landing page. Lấy **token và thuật toán màu M3** (material-color-utilities), không lấy component M3.
  3. **Liquid glass thật sự không render được bằng SVG trong KIRA.** WebKit bỏ qua `backdrop-filter: url(#svg-filter)` (bug 245510), mà KIRA chạy trên WKWebView. Mọi thư viện liquid glass OSS hiện có đều dựa vào kỹ thuật đó nên chỉ chạy trên Chromium. Đường đúng là **vật liệu native của macOS qua Tauri `windowEffects`** cộng `backdrop-filter: blur() saturate()` ở lớp chrome nổi.
  4. **Thứ nâng chất lượng nhanh nhất không phải thư viện UI, mà là hàng rào tự động**: stylelint chặn giá trị ngoài token, Floating UI cho mọi overlay, axe-core cộng Playwright chụp ảnh so sánh. Repo hiện **không có** stylelint, không có test runner frontend.

Nhãn nguồn: **[code]**, **[ngoài]**, **[ngoài-phụ]**, **[suy luận]** như các báo cáo trước.

---

## 0. Hiện trạng [code] tại `c66b82f`

| Mục | Sự thật |
|---|---|
| Glass hiện tại | `styles.css` có 8.283 dòng và **0 lần dùng `backdrop-filter`**. Các token tên `--glass-*` ([styles.css:43-59](../../apps/desktop/src/styles.css:43)) thực chất là màu phẳng. Nói cách khác app đang "gọi là glass" chứ chưa có glass |
| Cửa sổ native | `tauri.conf.json` bật `"macOSPrivateApi": true` và `"transparent": true`, nhưng **không khai báo `windowEffects`**. Rust chỉ set `setOpaque(false)`, nền trong suốt, titlebar trong suốt ([lib.rs](../../apps/desktop/src-tauri/src/lib.rs), `configure_native_macos_window`). Chưa có `NSVisualEffectView` |
| Token | Đã có bộ token khá đủ: surface, border, text, accent, space 1-6, radius 1-5, type scale 5 bậc, duration, easing ([styles.css:24-135](../../apps/desktop/src/styles.css:24)) |
| Chấp hành token | Bản critique impeccable gần nhất (2026-09-12, `.impeccable/critique/`) ghi detector trả **178 finding: 5 fail + 173 advisory**, trong đó **108 giá trị font-size** và **51 giá trị màu** nằm ngoài token. Điểm heuristic 25/40 |
| Icon | Dùng **hai** bộ icon cùng lúc trong `main.tsx`: `lucide-react` (dòng 75) và `@phosphor-icons/react` (dòng 91), trong khi DESIGN.md yêu cầu một ngôn ngữ icon thống nhất |
| Font | `--font-sans` là system stack, hợp lý. Có một font viết tay `"Bradley Hand"` cho sticky note ([styles.css:3264](../../apps/desktop/src/styles.css:3264)), detector đang gắn cờ vì chưa được ghi vào DESIGN.md |
| Motion | 20 `@keyframes`, làm bằng CSS thuần, không có thư viện animation |
| Hàng rào tự động | **Không có** stylelint, không có test runner frontend, không có visual regression. `apps/desktop/package.json` chỉ có dev/build/preview/tauri. Script duy nhất trong repo là `scripts/graphify-lite.mjs` |
| a11y theo hệ thống | 5 khối `prefers-reduced-motion` (tốt). Không có `prefers-contrast`, không có `forced-colors` |

**Chẩn đoán [suy luận]:** vấn đề không phải thiếu thẩm mỹ hay thiếu token, mà là **không có gì ép tuân thủ**. Token đã có nhưng 159 giá trị vẫn viết tay; glass là tên gọi chứ chưa phải vật liệu; hai bộ icon cùng tồn tại. Đây là đặc trưng của code do nhiều lượt AI viết nối nhau, và nó chữa được bằng hàng rào, không bằng thêm hướng dẫn thẩm mỹ.

---

## 1. "Chuẩn Google, Figma" nghĩa là gì cho KIRA

| Nguồn chuẩn | Nội dung dùng được | Cách lấy |
|---|---|---|
| **Material 3** (Google) | Hệ token (role màu, elevation, state layer), thuật toán sinh bảng màu từ ảnh (HCT, quantize, score), quy ước trạng thái component | **Lấy token và thuật toán**, không lấy component. `material-color-utilities` (Apache-2.0, 2,3k sao, push 2026-08-21) [ngoài, GitHub API 2026-09-13] |
| **Figma** | Không có design system OSS. Cái dùng được là **Figma MCP** đã nối sẵn trong phiên này: `get_variable_defs` kéo biến từ file Figma, `get_design_context` lấy ngữ cảnh | Chỉ có ích **nếu user có file Figma nguồn**. Nếu không có thì bỏ qua |
| **Apple HIG** | Quy tắc vật liệu: glass thuộc lớp điều hướng và điều khiển, không phủ lên lớp nội dung; không chồng glass lên glass; tôn trọng Reduce Transparency | Trang HIG không đọc được bằng WebFetch (nội dung nạp bằng JS). Nội dung trên dựa vào [ngoài-phụ] và các bài tổng hợp; cần đọc lại trực tiếp trước khi viết vào DESIGN.md |
| **impeccable `operate.md`** (đã có trên máy) | Đã viết sẵn chuẩn product UI: một họ chữ, thang cố định 1.125-1.2, màu Restrained, đủ 7 trạng thái cho mỗi component, overlay phải thoát khỏi container | Đọc trực tiếp tại `~/.claude/skills/impeccable/reference/operate.md` |

Điểm cần nói thẳng [suy luận]: "chuẩn Google hay Figma" với một app canvas nghĩa là **quen thuộc và đáng tin**, không phải nhiều hiệu ứng. impeccable gọi đây là "the product slop test": lỗi của product UI không phải nhạt, mà là **lạ mà không có lý do**.

---

## 2. Skill: dùng cái gì, bỏ cái gì

### 2.1 Đang có trên máy (`~/.claude/skills/`)

| Skill | Nội dung (đã đọc frontmatter) | Kết luận |
|---|---|---|
| **impeccable** v4.3.1 | 35 file reference, 20 lệnh (`critique`, `audit`, `polish`, `harden`, `typeset`, `layout`, `animate`, `distill`...), mode Operate riêng, `craft-floor.md` là sàn chất lượng, detector nhị phân tự tải, kiểm bằng browser thật, đã sinh 3 bản critique trong repo | **DÙNG làm xương sống.** Đã cài, đã có dữ liệu lịch sử trong `.impeccable/critique/` |
| color-expert (đang bật trên claude.ai) | Lý thuyết màu, không gian màu, ramp, a11y | **DÙNG** cho skill color expert của app và cho việc sửa contrast |
| design-system-creation | Hướng dẫn dựng design system chung, 103 dòng | **THAM KHẢO**, trùng phần lớn với `impeccable extract` và `document` |
| design-taste-frontend, high-end-visual-design, gpt-taste, stitch-design-taste | Persona kiểu "Awwwards", GSAP ScrollTrigger, randomize layout, "make it feel expensive" | **KHÔNG dùng cho KIRA.** Đây là thẩm mỹ trang marketing. Áp vào app công cụ sẽ đá nhau với DESIGN.md và làm slop nặng hơn |
| minimalist-ui, industrial-brutalist-ui | Hai thế giới thị giác đóng gói sẵn | **KHÔNG dùng.** KIRA đã có thế giới riêng trong DESIGN.md |
| redesign-existing-projects | Quét codebase, nhận diện "generic AI patterns", nâng cấp | **THAM KHẢO**, chồng lấn `impeccable critique` nhưng yếu hơn vì không có detector |
| image-to-code (1.228 dòng), brandkit, imagegen-* | Sinh ảnh rồi code theo ảnh; brand board | **Không liên quan** việc này |

### 2.2 Có trong phiên nhưng chưa đọc nội dung [suy luận, chỉ dựa trên mô tả]

`baseline-ui` ("prevent AI-generated interface slop"), `interface-design`, `web-design-guidelines` (rà theo Web Interface Guidelines), `wcag-audit-patterns`, `fixing-accessibility`, `fixing-motion-performance`, `interaction-design`, `design-lab`, `ui-ux-pro-max`, `design:design-critique`, `design:design-system`, `figma:*`.

- Đáng thử thêm: **`web-design-guidelines`** và **`wcag-audit-patterns`** vì chúng là *checklist kiểm tra*, bổ sung cho impeccable chứ không tranh vai thẩm mỹ.
- Nên tránh chồng vai: `ui-ux-pro-max` mô tả bao trùm 50+ style và nhiều stack (shadcn, Tailwind) mà KIRA không dùng.
- `figma:*` chỉ có ích nếu có file Figma.

### 2.3 Cách dùng impeccable cho đúng [suy luận, dựa trên nội dung skill]

1. `impeccable document` để DESIGN.md khớp code hiện tại, rồi mới sửa.
2. Vòng lặp cho mỗi surface: `critique` → sửa theo P0/P1 → `audit` → `polish`.
3. `typeset` và `layout` cho 108 font-size và các lệch nhịp, thay vì sửa tay từng chỗ.
4. Ghi các ngoại lệ đã được duyệt (font viết tay của sticky note, glass ở chrome nổi, sweep accent của Kira) vào DESIGN.md để detector không báo lại mãi. Repo đã có tiền lệ làm việc này.

---

## 3. Liquid glass: sự thật kỹ thuật và đường khả thi

### 3.1 Vì sao thư viện liquid glass OSS không dùng được

- **[ngoài]** WebKit bug [245510](https://bugs.webkit.org/show_bug.cgi?id=245510): `backdrop-filter: url(#some-svg-filter)` không chạy với filter SVG như `feDisplacementMap`. `RenderLayerBacking::updateBackdropFilters()` thoát sớm khi gặp reference filter và **không có fallback phần mềm**, nên hiệu ứng bị bỏ im lặng. Chromium render được, Safari và WebKit thì không.
- KIRA là Tauri trên macOS, tức **WKWebView (WebKit)** [code: `tauri.conf.json`, `macOSPrivateApi`].
- Hai thư viện OSS phổ biến nhất đều dựa đúng vào kỹ thuật đó: `deepika-builds/liquid-glass` (MIT, 264 sao, push 2026-07-09) mô tả "real refraction via SVG displacement"; `nikdelvin/liquid-glass` (MIT, 104 sao, push 2025-12-24) "using only CSS and SVG filters" [ngoài, GitHub API 2026-09-13].
- **Hệ quả:** cài vào KIRA sẽ ra một lớp mờ phẳng, mất đúng phần "liquid". **LOẠI cả hai.**
- **[ngoài]** `prefers-reduced-transparency` cũng không có trong WebKit (họ nêu lý do fingerprinting), nên không thể tự dò thiết lập Reduce Transparency của user bằng CSS. Phải có công tắc trong Settings của app.

### 3.2 Đường khả thi, xếp theo mức "thật" giảm dần

| # | Cách | Độ thật | Công | Ghi chú |
|---|---|---|---|---|
| 1 | **Tauri `windowEffects`** với vật liệu macOS: `sidebar`, `hudWindow`, `underWindowBackground`, `popover`, `menu`, `titlebar`, `selection`, `fullScreenUI`, `windowBackground`, kèm `state` và `radius` [ngoài, tài liệu cấu hình Tauri v2] | **Thật** (NSVisualEffectView của hệ điều hành, tự tôn trọng Reduce Transparency) | Thấp: khai báo config; cửa sổ đã trong suốt sẵn | Áp cho **nền cửa sổ**, không áp được cho từng panel bên trong |
| 2 | **NSVisualEffectView đặt sau vùng panel**, dùng `objc2-app-kit` đã có trong Cargo.toml, rồi để CSS vùng đó trong suốt | Thật, theo từng vùng | Cao: phải quản lý vị trí view native theo layout web | Chỉ nên làm nếu (1) không đủ |
| 3 | **CSS `backdrop-filter: blur() saturate()`** cho dock, panel phải, popover | Gần đúng "regular glass", không có khúc xạ | Thấp | WebKit hỗ trợ; giữ tiền tố `-webkit-` cho chắc [suy luận] |
| 4 | Viền chuyên biệt: gradient sáng ở cạnh trên, hairline `rgb(255 255 255 / .1)`, bóng trong `inset` | Giả lập specular | Thấp | Đây là phần làm nên cảm giác "glass" nhiều hơn cả blur |
| 5 | Khúc xạ thật bằng **WebGL/canvas** | Thật hơn | Rất cao | Ăn GPU, đá với canvas chính. **Không khuyến nghị** |

### 3.3 Ranh giới bắt buộc khi dùng glass

impeccable `craft-floor.md` cấm "glass và blur như trang trí", `ios.md` yêu cầu dùng vật liệu hệ thống thay vì tự chế glassmorphism. Muốn dùng glass thì phải **ghi thành ngoại lệ có luật trong DESIGN.md**, giống cách repo từng duyệt ngoại lệ One-Accent:

1. Glass chỉ ở **lớp chrome nổi**: dock, panel phải, popover, menu, rail. **Không** lên node canvas, không lên nền nội dung.
2. **Tối đa một lớp glass** chồng nhau. Popover mở trên panel glass thì popover dùng nền đặc.
3. Chữ trên glass phải đo contrast **trên ảnh nền đã blur thực tế**, không đo trên token phẳng.
4. Có công tắc **Giảm trong suốt** trong Settings (vì không dò được từ hệ thống), và phải tắt được về nền đặc.
5. Không animate `backdrop-filter`. Đây là thứ dễ tụt khung hình nhất trên WKWebView [suy luận, cần đo].

---

## 4. OSS nâng chất lượng, theo lớp

| Lớp | Ứng viên | License · sao · push | Kết luận |
|---|---|---|---|
| **Overlay, menu, popover** | **Floating UI** `floating-ui/floating-ui` | MIT · 32,7k · 2026-08-26 | **DÙNG.** Rẻ nhất và đúng bệnh: bản critique đã ghi lỗi popover bị cắt trong container `overflow`. Floating UI lo định vị, lật cạnh, va chạm viền màn hình |
| | Radix Primitives / Base UI (MUI) | MIT · 19,3k / MIT · 10,9k | **CÂN NHẮC** nếu muốn cả focus trap, ARIA, dismiss chuẩn cho menu và dialog. Nặng hơn Floating UI, nhưng bỏ được nhiều code tự viết. assistant-ui vốn cùng triết lý primitive nên không đá nhau |
| **Màu** | **material-color-utilities** | Apache-2.0 · 2,3k · 2026-08-21 | **DÙNG** (đã khuyến nghị ở phụ lục OSS): quantize ảnh, score, HCT, tonal palette. Đây chính là phần "chuẩn Google" dùng được |
| | Radix Colors | MIT · 1,7k · push 2025-12-17 | **CÂN NHẮC** làm ramp nền và ngữ nghĩa 12 bậc có bảo đảm tương phản. Lưu ý ít bảo trì hơn |
| **Token** | Open Props | MIT · 5,5k · 2026-08-11 | **THAM KHẢO giá trị** (easing, shadow, size), **không thêm dependency**: KIRA đã có bộ token riêng, thêm bộ thứ hai sẽ sinh hai nguồn sự thật |
| | Style Dictionary | Apache-2.0 · 4,8k · 2026-09-10 | **CÂN NHẮC** chỉ khi user thật sự có file Figma và muốn đồng bộ hai chiều |
| **Chặn trôi token** | **stylelint** + `stylelint-declaration-strict-value` | MIT · 11,5k · 2026-09-12 / MIT · 144 · 2026-08-24 | **DÙNG.** Bắt buộc `color`, `background-color`, `font-size`, `border-radius` phải là `var(--token)`. Đây là hàng rào trực tiếp cho 159 giá trị viết tay mà detector đang đếm |
| **A11y tự động** | axe-core (+ `@axe-core/playwright`) | MPL-2.0 · 7,5k · 2026-09-11 | **DÙNG** ở tầng dev dependency. Bắt được contrast, tên khả truy cập, vai trò, đúng loại lỗi P0 từng gặp (node canvas không có nhãn) |
| **Ảnh so sánh** | Playwright `toHaveScreenshot` | Apache-2.0 · 96k · 2026-09-11 | **DÙNG** để chụp light và dark cho các surface chính, chặn hồi quy khi nhiều thread cùng sửa CSS. Lưu ý: preview trình duyệt không có runtime Tauri |
| | Lost Pixel | MIT nhưng **archived** | **LOẠI** |
| **Component M3** | material-web | Apache-2.0 · 11,2k | **LOẠI**: Web Component, ngôn ngữ hình khối Android, chọi với DESIGN.md |
| **Liquid glass** | `deepika-builds/liquid-glass`, `nikdelvin/liquid-glass` | MIT | **LOẠI**: không render trên WebKit (§3.1) |
| **Icon** | chọn một trong hai bộ đang cài | — | **Việc dọn dẹp**: `lucide-react` phủ gần hết; `@phosphor-icons/react` chỉ dùng cho 14 icon canvas và editor. Gộp về một bộ, hoặc ghi rõ trong DESIGN.md là phosphor chỉ dành cho từ vựng node |

---

## 5. Lộ trình đề xuất (Orchestrator quyết)

**Đợt 1, hàng rào trước khi làm đẹp** (ưu tiên cao nhất, không đụng thẩm mỹ):
1. Thêm stylelint + `declaration-strict-value`, chạy trên `styles.css`, allowlist ngoại lệ đã duyệt. Nối vào `graphify-lite` hiện có hoặc thành script riêng.
2. Cập nhật DESIGN.md: ghi ngoại lệ font sticky note, quy tắc glass (§3.3), quy tắc icon.
3. `impeccable document` để DESIGN.md khớp code, rồi `critique` lấy mốc điểm mới.

**Đợt 2, vật liệu và overlay** (đây là phần user cảm nhận được ngay):
4. Bật `windowEffects` macOS, chọn vật liệu cho nền cửa sổ, kiểm ở cả light và dark.
5. Thêm `backdrop-filter` cho dock, panel phải, popover theo đúng luật §3.3, kèm công tắc Giảm trong suốt.
6. Chuyển overlay sang Floating UI, bắt đầu từ popover đang bị cắt.

**Đợt 3, chuẩn hoá và đo:**
7. `impeccable typeset` và `layout` cho phần font-size và nhịp còn lệch.
8. axe-core + Playwright screenshot cho 5 surface chính (canvas, library, settings, onboarding, panel phải).
9. Gộp icon về một bộ.

Panel phải (assistant-ui, D11) nên làm **sau đợt 1**, để component mới sinh ra đã nằm trong hàng rào thay vì phải sửa lại.

---

## 6. Quyết định cần chốt (nối tiếp D11-D14)

15. **Skill chuẩn hoá:** (a) chỉ impeccable + color-expert *(khuyến nghị)* · (b) thêm `web-design-guidelines` và `wcag-audit-patterns` làm checklist · (c) thêm một skill taste (design-taste-frontend, high-end-visual-design)
16. **Liquid glass:** (a) `windowEffects` native + `backdrop-filter` ở chrome nổi *(khuyến nghị)* · (b) thêm NSVisualEffectView theo vùng · (c) chỉ CSS blur · (d) chưa làm
17. **Overlay:** (a) Floating UI *(khuyến nghị)* · (b) Radix Primitives hoặc Base UI cho cả a11y · (c) giữ code tự viết
18. **Hàng rào tự động:** (a) stylelint + axe-core + Playwright screenshot *(khuyến nghị)* · (b) chỉ stylelint · (c) chưa làm
19. **Icon:** (a) gộp về lucide *(khuyến nghị)* · (b) giữ hai bộ, ghi luật phạm vi trong DESIGN.md

## 7. Rủi ro và giới hạn

- **Glass làm tụt hiệu năng canvas.** `backdrop-filter` trên nhiều lớp nổi phía trên canvas nhiều node là rủi ro khung hình rõ rệt. Phải đo FPS trước và sau trên app bundle thật, không đo trong preview trình duyệt [suy luận, chưa đo].
- **Glass đá với luật sẵn có.** DESIGN.md và impeccable đều coi glass trang trí là dấu hiệu slop. Nếu không viết luật §3.3 vào DESIGN.md thì các thread sau sẽ lần lượt gỡ ra hoặc lạm dụng.
- **stylelint bật muộn sẽ nổ hàng trăm lỗi.** Nên bật ở chế độ cảnh báo trước, khoá dần theo thuộc tính.
- Tôi **chưa đọc nội dung** các skill trong danh sách phiên (baseline-ui, web-design-guidelines, ui-ux-pro-max...), chỉ đọc mô tả. Đánh giá ở §2.2 là suy luận.
- **Chưa đọc được trang Apple HIG** bằng WebFetch (nội dung nạp bằng JS). Các luật vật liệu ở §3.3 dựa trên nguồn phụ và trên `ios.md` của impeccable; nên đối chiếu lại trang HIG trước khi đưa vào DESIGN.md.
- Metadata GitHub chụp ngày 2026-09-13 và 2026-09-14. Không cài, không chạy thư viện nào.

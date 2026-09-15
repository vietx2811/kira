# Ark UI, Park UI, Magic UI: có nên dùng làm UI kit / tham chiếu cho KIRA?

**Câu hỏi**: Có nên dùng Ark UI, Park UI hoặc Magic UI làm bộ UI kit hay tham chiếu cho KIRA không, và ở mức nào? User muốn giao diện "2026 hơn".
**Người yêu cầu**: user (VietX), qua Orchestrator, 2026-09-16.
**Commit đã kiểm chứng**: `ad62e76` (2026-09-16 01:42:40 +0700), nhánh `worktree-agent-a3383f7fea41dadb4`. `apps/desktop/src/main.tsx` 20 487 dòng, `apps/desktop/src/styles.css` 9 807 dòng tại commit này (`wc -l`).
**Kết luận ngắn**:
1. **Ark UI**: dùng headless cho các component khó nhất — Select, Combobox, Menu/Context Menu, Slider, Color Picker — giữ nguyên style Ink & Paper. Không có xung đột stack (không cần Panda/Tailwind), MIT, rất active (5 393 sao, push hôm qua).
2. **Park UI**: không dùng — khoá cứng vào Panda CSS (build-time CSS-in-JS), trái kiến trúc CSS thuần của KIRA. Có thể xem ảnh chụp màn hình demo để tham khảo thang xám/radius, không cài đặt.
3. **Magic UI**: không dùng — về bản chất là bộ hiệu ứng cho landing page (Tailwind + Framer Motion), gần như không có component chức năng thật, và mâu thuẫn trực tiếp với luật motion của `kira-controls` §7 (cấm animation tự chạy, cấm spring cho control).
4. Việc thay `<select>` gốc (main.tsx dòng 8382, 8868, 8878, 9037, 9073, 9097, 10030, 12666, 13169... ≥20 chỗ) bằng `Select`/`Combobox` của Ark UI là lý do thực tế nhất để đưa thư viện này vào, không phải vì "2026 hơn".

---

## 0. Bối cảnh đã xác minh trong code

- `apps/desktop/src/main.tsx` (`file:line`): còn dùng thẻ `<select>` gốc của trình duyệt ở ít nhất 20 vị trí, ví dụ dòng 8382, 8868, 8878, 9037, 9073, 9097, 10030, 12666, 13169, 13183, 13198, 13213, 13228, 13243, 13527, 13761, 13772 (grep `<select` tại commit `ad62e76`). Đây là phát hiện QA mà user nhắc tới trong brief — không phải suy luận.
- `apps/desktop/package.json`: React `^19.2.1`, Vite `^7.2.6`, không có Tailwind, không có CSS-in-JS runtime nào. Đã có `@assistant-ui/react@0.15.19` (headless chat), `react-colorful` (color picker không headless), `lucide-react`, `@phosphor-icons/react`. Không có Radix, không có bất kỳ "headless UI kit" tổng quát nào hiện tại.
- KIRA đã tự viết tay: focus trap dialog, segmented roving tabindex, popover dùng native Popover API, tooltip (theo brief; chưa grep lại từng implementation trong report này — lấy nguyên từ bối cảnh do Orchestrator cung cấp).
- `PRODUCT.md` dòng 47-51 (Anti-references): cấm "gradient text, glassmorphism-as-decoration, hero-metric tiles" và liệt các mẫu SaaS-onboarding rập khuôn — trực tiếp liên quan tới đánh giá Magic UI/Park UI ở §4, §7.
- `.claude/skills/kira-controls/SKILL.md` §7 (dòng 142-147): "Không spring, không overshoot cho control... Không animation tự chạy." Đây là tiêu chuẩn dùng để chấm Magic UI.

---

## 1. Ark UI

**Là gì**: Headless component library (logic + a11y, không style sẵn), của team Chakra UI (Segun Adebayo, Christian Busch, Esther Agbaje). Xây trên **Zag.js** — thư viện state machine framework-agnostic cũng do cùng team maintain. Hỗ trợ React, Vue, Solid, Svelte.
Nguồn: [ark-ui.com/docs/overview/about](https://ark-ui.com/docs/overview/about) (truy cập 2026-09-16).

- **License**: MIT. Nguồn: `gh api repos/chakra-ui/ark` (truy cập 2026-09-16) — đã xác minh trực tiếp qua GitHub API, không phải suy luận từ trang docs.
- **Hoạt động**: repo `chakra-ui/ark`, 5 393 sao, `pushed_at` 2026-09-15 (hôm qua so với ngày viết báo cáo), 14 open issues. Bản mới nhất tìm được: `@ark-ui/vue@5.39.2` publish 2026-09-13; `@ark-ui/react` trên npm cũng ở `5.39.2` (kiểm bằng `curl https://registry.npmjs.org/@ark-ui/react/latest`, truy cập 2026-09-16). Đây là dự án đang phát triển tích cực, không phải side-project chết.

### Phụ thuộc stack (đã xác minh)

- **Không bắt buộc** Panda CSS, Tailwind, hay Framer Motion. Headless nghĩa đúng nghĩa: component chỉ export logic + props như `className`, style tự viết. Zag.js là core bắt buộc (đi kèm khi cài `@ark-ui/react`, không phải lựa chọn thêm) nhưng nó chỉ là state-machine runtime, không áp bất kỳ ràng buộc CSS nào.
- **React 19**: có hỗ trợ tường minh — ví dụ prop `hideMode: 'activity'` trên Combobox ghi rõ "React 19 `<Activity mode="hidden">`. Requires React 19+". Nguồn: [ark-ui.com/react/docs/components/combobox](https://ark-ui.com/react/docs/components/combobox) (truy cập 2026-09-16).
- Cần gì để dùng: `npm install @ark-ui/react`, import từng component namespace (`Select.Root`, `Select.Trigger`...), tự viết CSS/class — đúng mô hình "headless + CSS thuần" mà KIRA đang theo.

### Độ phủ component (đã xác minh — danh sách đầy đủ từ `packages/react/src/components` trên GitHub, truy cập 2026-09-16)

62 component, đối chiếu đúng 11 nhu cầu user liệt trong brief:

| Nhu cầu KIRA | Có trong Ark UI? |
|---|---|
| Segmented / toggle group | **Có** — `Segment Group` (roving tabindex, theo pattern Radio ARIA, Tab focus vào item đã chọn, mũi tên di chuyển — [demo](https://ark-ui.com/react/docs/components/segment-group)) + `Toggle Group` riêng |
| Tabs | **Có** — [demo](https://ark-ui.com/react/docs/components/tabs) |
| Slider | **Có** — `Slider` + `Angle Slider` — [demo](https://ark-ui.com/react/docs/components/slider) |
| Popover | **Có** — `Popover`, `Portal`, `Floating Panel` |
| Menu / context menu | **Có** — `Menu.ContextTrigger` cho right-click, `Menu.TriggerItem` cho submenu lồng, typeahead bật mặc định — [demo](https://ark-ui.com/react/docs/components/menu) |
| Dialog | **Có** — `Dialog`, `Drawer` |
| Tooltip | **Có** — `Tooltip`, `Hover Card` |
| Combobox / select tuỳ biến | **Có** — `Select`, `Combobox`, `Listbox` — 3 biến thể khác nhau tuỳ mức tuỳ biến ([select demo](https://ark-ui.com/react/docs/components/select)) |
| Color picker | **Có** — `Color Picker` (có thể thay `react-colorful` đang dùng, nhưng không bắt buộc — `react-colorful` không headless nhưng đang chạy tốt, không có lý do bức thiết để đổi) |
| Switch | **Có** — `Switch` |
| Scroll area | **Có** — `Scroll Area` |

Không thiếu cái nào. Ngoài 11 mục trên còn có `Date Picker`, `File Upload`, `Rating Group`, `Steps`, `Tour`, `Tree View`, `Splitter`, `Signature Pad`... có thể hữu ích về sau nhưng ngoài phạm vi câu hỏi.

### Accessibility và hành vi (so với phần KIRA tự viết)

- **Segment Group**: đã xác minh — cùng cơ chế roving tabindex mà KIRA tự viết tay (Tab focus vào item được chọn, mũi tên chuyển focus + chọn, theo pattern Radio ARIA). Nếu chuyển sang Ark UI, đây gần như là thay thế 1:1 phần tự viết, không phải nâng cấp hành vi.
- **Combobox**: tuân "Combobox WAI-ARIA design pattern" — phím mũi tên, Home/End/Escape/Enter, typeahead (autohighlight khi gõ), tích hợp `Field` cho aria-label/helper/error text.
- **Menu**: typeahead mặc định bật, submenu lồng, `ContextTrigger` cho right-click với `anchorPoint` định vị theo điểm click.
- Có một bug lớp React 19 Strict Mode đã từng xảy ra và **đã fix**: Dialog/Drawer/Popover để lại `data-scroll-lock`, `data-inert`, `pointer-events: none` trên `<body>` sau khi đóng — fix trong `@ark-ui/react@5.38.2` (bản hiện tại 5.39.2 đã có fix). Nguồn: kết quả tìm kiếm changelog GitHub (truy cập 2026-09-16) — **đã xác minh có fix**, không phải bug đang treo.
- Một bug Safari cụ thể từng ghi nhận: Splitter — click vào resize trigger không chuyển focus, nên phím mũi tên không resize được cho tới khi Tab focus thủ công. Không tìm thấy issue mở nào ảnh hưởng Select/Combobox/Menu/Slider/Dialog trên WebKit. **Suy luận**: rủi ro Safari tồn tại nhưng khoanh vùng hẹp (đã có precedent 1 component), không phải rủi ro hệ thống.

### Hợp WKWebView/Tauri

Không tìm thấy issue nào trong repo `chakra-ui/ark` hay `tauri-apps/tauri`/`tauri-apps/wry` liên kết trực tiếp Ark UI + WKWebView. Các bug WebKit tìm được (transform trong CSS multi-column, drag-and-drop trong wry) không liên quan tới Zag.js/Ark UI — đó là bug của WKWebView nói chung, không phải do thư viện này gây ra. **Suy luận, chưa test tay**: vì Ark UI không phụ thuộc thư viện định vị lạ (không thấy nhắc floating-ui hay popper trong tài liệu đã đọc) và outputs ra DOM/CSS chuẩn, rủi ro tương thích WKWebView thấp hơn các thư viện dùng nhiều Web API hiếm. Cần verify tay trong app native (theo mục Verify của CLAUDE.md) trước khi merge bất kỳ component nào — báo cáo này KHÔNG thay thế bước đó.

---

## 2. Park UI

**Là gì**: "Beautifully-designed, accessible components system and code distribution platform" — build trên Ark UI (logic) + **Panda CSS** (styling, bắt buộc). Không phải npm package chạy runtime như Ark UI, mà là mô hình copy-paste giống shadcn/ui: CLI (`@park-ui/cli`) sinh source code component thẳng vào project. Nguồn: [park-ui.com/docs/introduction](https://park-ui.com/docs/introduction) (truy cập 2026-09-16).

- **License**: MIT. **Maintainer**: cùng team Chakra UI (`chakra-ui/park-ui`, trước là `cschroeter/park-ui`, đã chuyển vào org chakra-ui).
- **Hoạt động**: repo 2 367 sao, `pushed_at` **2026-04-10** — khoảng 5 tháng trước ngày viết báo cáo, chậm hơn hẳn Ark UI (push hôm qua). Package `@park-ui/panda-preset` trên npm: bản mới nhất `0.43.1`, publish **2024-11-22** — gần 22 tháng không ra bản mới (`curl registry.npmjs.org` + đọc field `time`, truy cập 2026-09-16, **đã xác minh trực tiếp**, không phải suy luận). Đây là tín hiệu Park UI đang ở trạng thái ổn định/ít cập nhật hơn là "chết", nhưng chắc chắn không phải dự án đang tăng tốc.

### Phụ thuộc stack — đây là điểm loại Park UI

Trang cài đặt yêu cầu tường minh: "ensure that your Panda project is set up and ready to go" trước khi cài Park UI; quy trình gồm cấu hình Panda, chạy `panda codegen`, rồi mới thêm component qua CLI. Nguồn: [park-ui.com/docs/installation](https://park-ui.com/docs/installation) (truy cập 2026-09-16). Không tìm thấy đường nào dùng token/recipe của Park UI mà không cài Panda CSS.

**Panda CSS là công cụ build-time sinh CSS tĩnh từ object JS** (giống vanilla-extract) — tức là thêm một bước build, một hệ cấu hình (`panda.config.ts`), một cách viết style hoàn toàn khác CSS thuần. KIRA hiện dùng Vite + CSS thuần trong `styles.css`, không có bất kỳ lớp build CSS trung gian nào. Đưa Panda vào nghĩa là: (a) thêm build step mới phải tích hợp với `vite.config`, (b) hai hệ viết style song song trong cùng codebase (CSS thuần cho phần cũ, Panda cho phần copy từ Park UI) trừ khi migrate toàn bộ — không khả thi cho 9 807 dòng `styles.css` hiện có.

### Độ phủ component

Vì xây trên Ark UI primitives, độ phủ chức năng tương đương Ark UI ("58+ components" theo mô tả tìm được). Đã xác nhận tồn tại demo cho tabs, slider, select, menu, segment-group (HTTP 200 khi curl từng URL, truy cập 2026-09-16):
[tabs](https://park-ui.com/docs/components/tabs) · [slider](https://park-ui.com/docs/components/slider) · [select](https://park-ui.com/docs/components/select) · [menu](https://park-ui.com/docs/components/menu) · [segment-group](https://park-ui.com/docs/components/segment-group)

### Độ hợp thẩm mỹ

Park UI định vị là "minimalistic design" với thang màu/radius mặc định chỉn chu, hợp tác với studio thiết kế Brains & Pixels — nhìn chung nghiêng về **product UI / design system generic** (dashboard, form, admin), không phải trang marketing kiểu Magic UI. **Suy luận** (chưa xem demo bằng mắt trong phiên này — user nên tự mở link để đánh giá thẩm mỹ, đây là lý do report kèm link demo trực tiếp ở §5): thẩm mỹ Park UI mặc định (bo góc mềm, màu trung tính nhạt, shadow nhẹ) là "generic modern SaaS" — đúng kiểu KIRA đã liệt vào *avoidKeywords* ở persona user (`~/.creative-os/user.json` theo skill 13: "Avoid: generic, modern, elegant") và trái với Ink & Paper đã chốt. Vì vậy dù component chức năng tốt, **giá trị tham khảo thẩm mỹ của Park UI thấp** — không nên lấy token màu/radius của nó, chỉ có thể tham khảo cấu trúc/spacing scale nếu cần.

---

## 3. Magic UI

**Là gì**: "150+ animated components and effects" built với React, TypeScript, **Tailwind CSS**, và **Motion (Framer Motion)**. Theo mô hình copy-paste giống shadcn/ui. Nguồn: [magicui.design](https://magicui.design/) (truy cập 2026-09-16).

- **License**: MIT. **Maintainer/hoạt động**: repo `magicuidesign/magicui`, **22 298 sao** (nhiều hơn Ark UI + Park UI cộng lại), `pushed_at` 2026-09-13 — rất active. Đây là dự án phổ biến nhất trong 3 cái về mặt sao GitHub, nhưng độ phổ biến này đến từ giá trị marketing/landing-page, không phải từ việc phù hợp product UI (xem bên dưới).
- Free tier có phần lớn component; MagicUI Pro (149 USD trả một lần) mở khoá thêm template trang bán hàng.

### Kiểm chứng bản chất: bộ hiệu ứng landing page hay bộ component chức năng?

Đọc toàn bộ danh mục tại [magicui.design/docs/components](https://magicui.design/docs/components) (truy cập 2026-09-16): trong ~70 component, phần lớn (ước lượng 50+) là hiệu ứng trang trí — text animation (typing, morphing, aurora), visual effect (**animated beam**, border beam, **shine border**, meteors, confetti, particles), background pattern (flickering grid, retro grid, noise texture), interactive effect (glare hover, smooth cursor, ripple, warp background), cộng **marquee**, **shimmer button**, orbiting circles, globe, icon cloud. Số component có thể coi là "control chức năng thật" (button biến thể, dock, bento grid, file tree, card) chỉ khoảng 10-15, và ngay cả các "control" này (rainbow button, shimmer button, ripple button, pulsating button) bản chất vẫn là **hiệu ứng trên button**, không phải logic mới.

Trang chủ Magic UI tự mô tả: "50+ blocks and templates to build beautiful landing pages in minutes." — tự nhận diện đúng là công cụ landing page, không phải bộ UI kit cho product/app desktop.

**Không có** Select, Combobox, Menu/Context Menu có a11y đầy đủ, Dialog có focus trap thật (chỉ có "Hero Video Dialog" — lightbox video cho trang giới thiệu sản phẩm), Slider, Color Picker, Switch dạng form control nghiêm túc, hay Scroll Area. 0/11 nhu cầu component của KIRA được đáp ứng theo nghĩa "control cho product UI".

### Đối chiếu với luật motion `kira-controls` §7

`kira-controls` §7 (dòng 146): *"Không spring, không overshoot cho control... Không animation tự chạy."* Bản chất của **animated beam**, **marquee**, **shimmer**, **particles**, **meteors**, **aurora text** — tất cả đều là animation tự chạy liên tục (không cần tương tác người dùng để bắt đầu), nhiều cái dùng easing kiểu spring/overshoot của Framer Motion. Đây là vi phạm trực tiếp, không phải suy diễn — đọc tên và mô tả component là đủ kết luận (animated beam = đường sáng chạy vòng lặp vô hạn giữa hai điểm; marquee = dải nội dung cuộn vô hạn; shimmer = ánh sáng quét lặp lại).

`PRODUCT.md` dòng 51: *"Gradient text, glassmorphism-as-decoration, hero-metric tiles — standard AI-slop tells, avoid everywhere."* — Magic UI có nguyên nhóm "gradient text" component (aurora text, animated gradient text...). Đây chính xác là nhóm anti-reference của KIRA.

**Kết luận Magic UI**: loại hoàn toàn, kể cả ở mức tham khảo thẩm mỹ. Không có gì trong bộ này hợp với một app canvas desktop cho art director — nó được thiết kế để bán ấn tượng đầu tiên trên landing page, ngược hướng với triết lý "Get out of the way" và "Selective tactile warmth" của KIRA (`PRODUCT.md` §Design Principles).

---

## 4. Chi phí áp dụng thực tế — 3 đường

### (a) Chỉ tham khảo thẩm mỹ → chuyển thành token CSS

- **Áp dụng cho**: không kit nào trong 3 cái thực sự đáng tham khảo thẩm mỹ. Ink & Paper đã có specimen riêng (`docs/research/2026-09-14-art-direction-controls-v2.md`) do chính KIRA thiết kế, hợp aesthetic tendency của user hơn cả 3 kit này (vốn đều thiên "generic modern" ở mức default theme).
- **Công sức**: gần như 0 nếu không làm. Nếu vẫn muốn liếc, chỉ cần mở 4-5 link demo bằng mắt (không cần cài đặt gì) — xem §5.
- **Rủi ro**: thấp, vì không đụng code.

### (b) Dùng Ark UI headless cho vài component khó, giữ style Ink & Paper

- **Áp dụng cho**: Select, Combobox (thay `<select>` gốc — 20 chỗ), Menu/Context Menu (nếu KIRA có context menu tự chế cần nâng cấp), Slider (đang "sắp thêm" theo bối cảnh — có thể dùng `Slider` của Ark UI thay vì viết từ đầu), Color Picker (không bức thiết, `react-colorful` đang ổn).
- **Công sức ước lượng**: 
  - Cài đặt: nhỏ — `npm install @ark-ui/react`, không cần cấu hình build mới, không đụng `vite.config`.
  - Viết style: mỗi component cần viết CSS token Ink & Paper riêng (Ark UI không style sẵn) — tương đương công sức viết CSS cho 1 component mới, cộng thêm học API của Ark UI cho component đó (parts: `Root`, `Trigger`, `Content`, `Item`...). Ước lượng nửa ngày đến 1 ngày/component cho người đã quen Ink & Paper token, tính cả test tay trong app native.
  - Thay thế 20 chỗ `<select>`: không phải viết 20 lần — viết 1 component `<KiraSelect>` bọc Ark UI Select theo Ink & Paper, rồi thay thế từng chỗ gọi. Việc lặp lại tốn thời gian do `main.tsx` 20 487 dòng (file nóng, phải claim trước khi sửa theo CLAUDE.md) nhưng là việc cơ học, không phải quyết định thiết kế mới mỗi lần.
- **Rủi ro**: 
  - Phải test tay trong app native (không phải browser preview) vì đụng focus/keyboard — theo mục Verify của CLAUDE.md, "browser preview không có Tauri runtime" chỉ đúng cho đường native call, nhưng riêng focus behavior trong WKWebView cũng nên xác nhận thật, không suy từ Chrome preview.
  - Có thể trùng lặp logic với phần KIRA đã tự viết (focus trap, popover native) — cần quyết định rõ ranh giới: Dialog/Popover **giữ nguyên bản tự viết** (đã hoạt động, dùng native Popover API — đổi sang Ark UI Popover không có lợi ích rõ ràng, có rủi ro đổi hành vi đang ổn định); chỉ áp Ark UI cho các component **chưa có** hoặc **đang là gốc trình duyệt** (select, combobox) hoặc **sắp viết mới** (slider).
  - Segment Group của Ark UI trùng gần như 1:1 với segmented tự viết hiện tại — **không có lý do để đổi cái đang chạy tốt**, trừ khi phát hiện bug cụ thể.

### (c) Chuyển hẳn sang Park UI preset

- **Không khả thi mà không viết lại kiến trúc CSS.** Panda CSS là build-time CSS-in-JS, xung đột trực tiếp với "CSS thuần, không Tailwind, không CSS-in-JS" đã chốt cho KIRA. Muốn làm đường này phải: cấu hình Panda, migrate toàn bộ hoặc một phần `styles.css` (9 807 dòng) sang hệ token Panda, chấp nhận build step mới, và **vẫn phải viết lại theme Panda thành Ink & Paper** vì theme mặc định của Park UI không hợp (xem §2 cuối). Công sức tương đương viết lại hệ CSS của app — nhiều tuần, rủi ro cao, lợi ích không rõ so với đường (b) vì phần logic component (Ark UI) đã lấy được mà không cần Panda.
- **Kết luận**: loại đường (c).

---

## 5. Link demo để user tự xem bằng mắt

**Ark UI** (headless — demo có style mặc định tối giản, không phải cái sẽ dùng thật, nhưng đủ xem hành vi/cấu trúc):
- Segmented: https://ark-ui.com/react/docs/components/segment-group
- Tabs: https://ark-ui.com/react/docs/components/tabs
- Slider: https://ark-ui.com/react/docs/components/slider
- Select: https://ark-ui.com/react/docs/components/select
- Combobox: https://ark-ui.com/react/docs/components/combobox
- Menu (kể cả context menu): https://ark-ui.com/react/docs/components/menu

**Park UI** (styled — đây là ảnh thật của "generic modern" cần tránh, hoặc có thể user thấy khác, nên tự xem):
- Segmented: https://park-ui.com/docs/components/segment-group
- Tabs: https://park-ui.com/docs/components/tabs
- Slider: https://park-ui.com/docs/components/slider
- Select: https://park-ui.com/docs/components/select
- Menu: https://park-ui.com/docs/components/menu

**Magic UI** (để tự đối chiếu với luật motion, không đề xuất dùng):
- Trang chủ (marquee, animated beam, shimmer...): https://magicui.design/
- Danh sách component: https://magicui.design/docs/components

---

## 6. Đề xuất

**Phương án chính**: Ark UI headless cho Select/Combobox (thay `<select>` gốc), Menu/Context Menu nếu cần, và Slider sắp viết — giữ nguyên toàn bộ style Ink & Paper, viết CSS riêng cho từng component như đang làm với các control khác. Không dùng Park UI (khoá Panda CSS, trái kiến trúc). Không dùng Magic UI ở bất kỳ mức nào, kể cả tham khảo (vi phạm luật motion và anti-reference đã chốt).

**Lý do ngắn**: Ark UI là lựa chọn duy nhất trong 3 cái không đòi thay đổi kiến trúc (CSS thuần, không build step mới), có phủ đủ 11/11 nhu cầu, license MIT, đang phát triển tích cực (push hôm qua, không phải dự án nằm im), và đã có sẵn precedent trong KIRA (đã chấp nhận một thư viện headless khác — `@assistant-ui/react` — cho chat panel).

## Quyết định cần user chốt

1. Có đồng ý đưa `@ark-ui/react` vào `package.json` không, và ở mức nào trước (chỉ Select/Combobox để dọn nợ QA `<select>` gốc, hay làm luôn cả Slider/Menu cùng đợt)?
2. Dialog/Popover/Tooltip tự viết hiện tại: giữ nguyên (khuyến nghị) hay có lý do cụ thể muốn thay bằng Ark UI (ví dụ bug đã biết mà bản tự viết không sửa được)?
3. Segment Group tự viết hiện tại: giữ nguyên (khuyến nghị, vì đã trùng hành vi Ark UI) — xác nhận không cần đổi.
4. Ai làm phần này: Worker theo spec cụ thể (khuyến nghị dùng Sonnet theo bảng model trong CLAUDE.md, vì đây là "triển khai theo spec" một khi đã chốt component nào dùng Ark UI) hay cần UI/UX critique trước khi viết code?

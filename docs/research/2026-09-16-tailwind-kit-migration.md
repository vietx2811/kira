# Đưa KIRA sang Tailwind v4 + shadcn/ui hoặc Untitled UI React: kỹ thuật, chi phí, rủi ro

**Câu hỏi**: User cho rằng thêm Tailwind không phải hạn chế, "đáng ra nên chuẩn từ đầu với shadcn hoặc Untitled UI". Cần biết: đưa KIRA sang Tailwind v4 + shadcn/ui hoặc Untitled UI React thế nào, tốn bao nhiêu, rủi ro gì, kế hoạch từng bước.
**Người yêu cầu**: user (VietX), qua Orchestrator, 2026-09-16.
**Commit đã kiểm chứng**: `53c0dcb797db038f513daad501e8b63a346eb1fd` (2026-09-16 02:18:22 +0700), nhánh `worktree-agent-abb74bf3c0857102c`. `apps/desktop/src/main.tsx` 20 476 dòng, `apps/desktop/src/styles.css` 9 798 dòng tại commit này (`wc -l`).
**Kết luận ngắn**:
1. User đúng theo lịch sử: `docs/RESEARCH.md` (nghiên cứu gốc tháng 6/2026, khi dự án còn tên "Visual Research Board") đã **chọn "shadcn/ui + Tailwind v4"** làm UI layer, cùng cmdk, Motion, reagraph — nhưng `apps/desktop` hiện tại không dùng bất kỳ cái nào trong số đó (CSS thuần, 3d-force-graph, không Motion, không cmdk). Không tìm thấy tài liệu nào ghi lại quyết định đổi hướng.
2. Hôm nay đã có kết luận riêng (`docs/research/2026-09-16-ui-kit-ark-park-magic.md`, cùng ngày): dùng **Ark UI headless, giữ CSS thuần** — không Tailwind. Đề xuất Tailwind+shadcn/Untitled UI trong báo cáo này **đối lập trực tiếp** với kết luận đó; user cần chọn một trong hai hướng, không làm cả hai.
3. Kỹ thuật khả thi: shadcn/ui hỗ trợ chính thức Tailwind v4 + React 19 + Vite (không cần Next.js); Untitled UI React cũng vậy (React Aria + Tailwind v4.3), MIT cho phần base/app UI, PRO chỉ khoá dashboard mẫu và block nâng cao.
4. Chi phí thật không nằm ở cài Tailwind (nhỏ, cô lập được bằng `@layer`) mà ở **9 798 dòng `styles.css` thuần + 20 476 dòng `main.tsx` không tách file** phải sống chung hai hệ styling, và ở việc phải viết lại token Ink & Paper thành theme Tailwind — ước lượng theo pha ở §7.
5. Khuyến nghị: nếu user vẫn muốn đổi hướng sau khi đọc báo cáo Ark UI, chọn **shadcn/ui** (không phải Untitled UI) và làm pha 1 nhỏ nhất: Tailwind cô lập bằng `@layer` + `Settings` (`SettingsView`, main.tsx:8629) là surface đầu tiên.

---

## 0. Bối cảnh đã xác minh trong code

- `apps/desktop/package.json`: React `^19.2.1`, Vite `^7.2.6`, TypeScript `^5.9.3`. Dependencies UI hiện có: `@assistant-ui/react` `0.15.19`, `react-colorful` `^5.7.0`, `lucide-react` `^0.561.0`, `@phosphor-icons/react` `^2.1.10`, `react-rnd`, `react-easy-crop`, `@tiptap/*`. **Không có Tailwind, không có Radix trực tiếp trong `dependencies`, không có CSS-in-JS runtime nào** (xác nhận lại từ báo cáo Ark UI cùng ngày, §0).
- `apps/desktop/vite.config.ts`: `plugins: [react()]` — không có plugin CSS nào khác (không PostCSS config riêng, không Tailwind Vite plugin). `build.target` là `safari13` cho non-Windows — đây là target **esbuild JS transpile**, không áp cho CSS; không tự suy ra Tailwind v4 (dùng cascade layers, `@property`, `color-mix()`) sẽ chạy được trên WebKit thật trong app native chỉ từ file này — cần verify tay trong app (xem §6).
- `apps/desktop/src/main.tsx`: 20 476 dòng. Đếm bằng `grep -cE "^(function|const) [A-Za-z_][A-Za-z0-9_]*"`: **426 khai báo function/const ở top-level**, trong đó **74 bắt đầu bằng chữ hoa** (dạng component React, `grep -cE "^(function|const) [A-Z][A-Za-z0-9_]*"`), và **105 khai báo `interface`/`type`**. Một file duy nhất chứa hầu hết UI logic của app.
- `<select>` gốc: `grep -c "<select" apps/desktop/src/main.tsx` = **17** tại commit này (báo cáo Ark UI cùng ngày ghi "≥20" tại `ad62e76`, vài giờ trước — số dao động nhẹ do commit khác nhau, không phải sai lệch phép đo; vẫn cùng bậc độ lớn, vẫn là nợ QA thật).
- `apps/desktop/src/styles.css`: 9 798 dòng. **220 custom property top-level** (`grep -c "^  --"`). **0 lần dùng `@layer`** (`grep -c "@layer"` = 0) — nghĩa là chưa có cascade layer nào trong CSS hiện tại, cô lập Tailwind bằng `@layer` sẽ là lần đầu tiên khái niệm này xuất hiện trong file.
- Cơ chế theme runtime — `buildProjectAppearanceStyle()` tại `apps/desktop/src/main.tsx:14679`, được gọi tại `main.tsx:6730` (`const shellThemeStyle = buildProjectAppearanceStyle(projectAppearance)`), và áp dụng tại `main.tsx:7306`: `<main className="app-shell" data-glass-state={glassStatus} data-color-mode={shellColorMode} ... style={shellThemeStyle} ...>`. Tức là: token màu ghi **inline style trên phần tử `.app-shell`** theo từng project, không phải static trong `:root`. Theo `CLAUDE.md` (mục "styles.css: token màu theo theme"): alias `var()` trỏ tới token đã theme **phải khai ở `.app-shell`, không ở `:root`** — alias ở `:root` bị đóng băng giá trị tĩnh vì không thấy style inline. Đây là ràng buộc trực tiếp cho cách map token Tailwind (§5).
- `data-color-mode` (dark/light) cũng đặt trên `.app-shell` cùng dòng 7306, không phải `<html>`/`<body>` — ảnh hưởng cách viết dark-mode variant trong Tailwind (mặc định Tailwind dùng class `.dark` trên `<html>` hoặc media query; ở đây phải trỏ theo `[data-color-mode="dark"]` trên `.app-shell`, không phải attribute mặc định của Tailwind).
- Native `<select>`, focus trap, Segmented, popover: xác nhận lại `useFocusTrap` tại `main.tsx:1869` (dùng ở 4 chỗ: 2804, 7911, 8708, 8713), `Segmented<T>` tại `main.tsx:996` (roving tabindex tự viết), popover native `popover="auto"` tại `main.tsx:9578` và `14110` (dùng Popover API của trình duyệt, không phải thư viện).
- `SettingsView` — component lớn nhất, tách biệt rõ nhất theo tên — tại `main.tsx:8629`; `ProjectSettingsPopover` tại `main.tsx:8337`. Đây là ứng viên pha 1 tốt nhất về mặt định vị code (xem §7).
- `scripts/graphify-lite.mjs`: đọc cứng 3 đường dẫn (`STYLES_CSS = apps/desktop/src/styles.css`, `MAIN_TSX`, `LIB_RS`) — **không tự động phát hiện file CSS mới**. Hàm `extractDeclaredCssVars()` (dòng 190-198) dùng regex `--([a-zA-Z0-9-]+)\s*:` **không phân biệt selector** — bắt mọi khai báo `--x:` bất kể nằm trong `:root`, `.app-shell`, hay (nếu thêm vào) khối `@theme { }` của Tailwind, miễn nằm trong `styles.css`. Nghĩa là: nếu token Tailwind `@theme` được viết **trong chính `styles.css`**, script vẫn hoạt động đúng không cần sửa. Nhưng nếu Tailwind's compiled output hoặc một file `.css` riêng (theo hướng dẫn cài đặt chính thức, xem §1) nằm **ngoài** `apps/desktop/src/styles.css`, script sẽ không quét được — phải sửa `STYLES_CSS` hoặc gộp file trước khi chạy `--strict`.

---

## 1. shadcn/ui hiện hành

Nguồn: [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4), [ui.shadcn.com/docs/installation/vite](https://ui.shadcn.com/docs/installation/vite), [dev.to/edriso — shadcn vs Radix vs Base UI 2026](https://dev.to/edriso/shadcn-vs-radix-vs-base-ui-which-one-should-a-junior-pick-in-2026-1jml), [shadcnstudio.com — Base UI & Radix UI support](https://shadcnstudio.com/blog/major-update-base-ui-radix-ui-support/) (tất cả truy cập 2026-09-16).

- **Primitive nền**: kể từ bản cập nhật 2026, **Base UI là mặc định cho dự án mới** (không phải Radix). Base UI do chính các kỹ sư từng xây Radix (Vercel/WorkOS + MUI) làm lại từ đầu; theo changelog tháng 7/2026 của shadcn, đội Radix "làm lại một lần nữa, với mọi thứ họ đã học được". **Radix không bị khai tử** — vẫn được hỗ trợ, khuyến nghị dùng khi đã có codebase Radix sẵn hoặc cần các component Base UI chưa có (Context Menu, Hover Card, Toast — theo dev.to, truy cập 2026-09-16, **chưa tự kiểm chứng lại danh sách này qua repo Base UI**, ghi là suy luận từ nguồn thứ cấp). Với KIRA, cả hai đều "mới" như nhau (không có Radix sẵn trong `package.json`) nên chọn Base UI hay Radix là lựa chọn tự do, không bị khoá bởi lịch sử.
- **Tailwind v4 + React 19**: đã hỗ trợ chính thức. Trang doc ghi "It's here! Tailwind v4 and React 19. Ready for you to try out", tương thích ngược với project Tailwind v3/React 18. Component đã bỏ `forwardRef`, dùng `data-slot` attribute để style.
- **CLI/`components.json`**: `npx shadcn@latest init` sinh `components.json` (chứa cấu hình style, alias `@/`, đường dẫn CSS). Cài từng component bằng `npx shadcn@latest add button` — copy source `.tsx` thẳng vào project (mô hình "code ownership", không phải npm runtime package).
- **Theme bằng CSS variables**: khai token màu ngoài `@layer base`, viết `hsl()` (hoặc OKLCH) ở cấp biến gốc (vd `--background: hsl(0 0% 100%)`), rồi map vào `@theme inline { --color-background: var(--background); }` để Tailwind sinh utility (`bg-background`). Đây **chính là mô hình 2 lớp** (biến gốc → alias theo `@theme`) — về nguyên tắc tương thích với cách KIRA đã làm (`buildProjectAppearanceStyle()` ghi biến gốc, `styles.css` alias theo theme), nhưng shadcn mặc định khai biến gốc ở `:root`/`.dark`, còn KIRA cần khai ở `.app-shell` — phải tự điều chỉnh, xem §5.
- **Dùng với Vite (không Next.js)**: hỗ trợ chính thức. Cài `tailwindcss @tailwindcss/vite`, thêm plugin Tailwind vào `vite.config.ts`, `src/index.css` chỉ còn `@import "tailwindcss";`, thêm alias `@/*` vào `tsconfig.json` **và** `tsconfig.app.json` (cả hai, theo doc — dễ bỏ sót file thứ hai). Không cần cấu hình PostCSS thủ công vì `@tailwindcss/vite` tự lo build-time transform, khác hẳn model PostCSS truyền thống của Tailwind v3.

## 2. Untitled UI React

Nguồn: [untitledui.com/react/docs/introduction](https://www.untitledui.com/react/docs/introduction), [untitledui.com/react/components](https://www.untitledui.com/react/components), [untitledui.com/react/components/command-menus](https://www.untitledui.com/react/components/command-menus) (truy cập 2026-09-16).

- **Nền tảng**: React 19.2, Tailwind CSS v4.3, TypeScript 5.9, **React Aria v1.20** (không phải Radix/Base UI — khác hẳn shadcn về primitive gốc). React Aria là thư viện headless của Adobe, tách biệt hoàn toàn khỏi hệ sinh thái Radix/Base UI.
- **Cài đặt**: mô hình copy-paste giống shadcn — chọn component, code được thêm thẳng vào project, không phải npm package runtime, không vendor lock-in. Có CLI riêng và tích hợp MCP cho AI coding assistant.
- **Phần miễn phí (MIT)**: toàn bộ base component (Select "1 component + 7 variant", Multi-select, Sliders, Toggles, Checkboxes, Radio, Input, Textarea), Tabs, Sidebar navigation, Breadcrumb, Context menu, Modal (46 component), Drawer (20), Dropdown, Tooltip (11 variant), Notification, Alert, Loading indicator, Table, Pagination, Progress steps, Color picker (13 variant) — cộng "hundreds of application UI components" và marketing sections.
- **Phần PRO (trả phí)**: hàng trăm component nâng cao hơn cộng **250+ trang dashboard/settings/marketing mẫu dựng sẵn**. Không tìm thấy giá cụ thể trong nội dung đã fetch — cần user tự kiểm nếu quan tâm mua PRO.
- **Theme/dark mode**: có trang riêng (`/react/docs/theming`, `/react/docs/dark-mode`) nhưng nội dung chi tiết không nằm trong phần đã fetch của trang giới thiệu — **chưa xác minh sâu cơ chế theme runtime của Untitled UI**, chỉ xác nhận nó dùng CSS variables + Tailwind v4 theo mô tả tổng quan.
- **Định vị sản phẩm**: xuất phát từ một bộ Figma UI kit thương mại (Untitled UI) chuyển sang code — thiên về **dashboard/admin/marketing site** hơn là app canvas desktop. Không thấy Resizable panels hay Scroll area là component riêng trong danh mục đã liệt (§3) — khác shadcn có cả hai.

## 3. Bảng so sánh độ phủ cho nhu cầu KIRA

| Nhu cầu | shadcn/ui (Base UI/Radix) | Untitled UI React (React Aria) |
|---|---|---|
| Select | Có — `Select` | Có — "1 + 7 variant" |
| Combobox | Có — dựng từ `Command` + `Popover` (không phải primitive riêng) | Không thấy liệt riêng; có thể nằm trong Select variants — **chưa xác minh rõ** |
| Menu / Context menu | Có — `DropdownMenu`, `ContextMenu` | Có — Context menu "1 + 2 variant" |
| Slider | Có — `Slider` | Có — "1 + 4 variant" |
| Tabs / Segmented / Toggle group | Có — `Tabs`, `ToggleGroup` | Có — Tabs "10 component"; Segmented không thấy tên riêng, có thể là Toggles |
| Dialog | Có — `Dialog` | Có — Modal "46 component" |
| Popover | Có — `Popover` | Có (dùng trong Dropdown/Tooltip) |
| Tooltip | Có — `Tooltip` | Có — "1 + 11 variant" |
| Switch | Có — `Switch` | Có — nằm trong Toggles |
| Toast | Có — qua `sonner` (shadcn tự bỏ Toast riêng, khuyến nghị sonner) | Có — Notification "9 component" |
| Command palette | Có — `Command` (dựa trên `cmdk`) | Có — "Command menu components" riêng |
| Resizable panels | Có — `Resizable` (dựa trên `react-resizable-panels`) | **Không thấy** trong danh mục đã liệt |
| Color picker | Không có sẵn trong core (thường ghép thư viện ngoài) | Có — 13 variant, native |
| Scroll area | Có — `ScrollArea` (Radix/Base UI primitive) | **Không thấy** trong danh mục đã liệt |
| Sidebar | Có — `Sidebar` (composed, có `SidebarProvider`) | Có — "5 component" |

Nguồn bảng: shadcn — [ui.shadcn.com/docs/components](https://ui.shadcn.com/docs/components), [Resizable](https://ui.shadcn.com/docs/components/base/resizable), [Scroll Area](https://ui.shadcn.com/docs/components/radix/scroll-area), [Sidebar](https://ui.shadcn.com/docs/components/base/sidebar), [Toast](https://ui.shadcn.com/docs/components/base/toast); Untitled UI — như §2. Truy cập 2026-09-16.

**A11y**: React Aria (Adobe) và Radix/Base UI đều là các thư viện a11y hàng đầu, không có khoảng cách chất lượng rõ rệt được tìm thấy trong lần research này — khác biệt chính là triết lý API (React Aria tách state hook khỏi render, Radix/Base UI dùng compound component) chứ không phải mức độ tuân thủ ARIA. **Đây là điểm suy luận từ danh tiếng chung của hai thư viện, chưa đối chiếu từng test case cụ thể trong phạm vi báo cáo này.**

**Kết luận độ phủ**: shadcn/ui phủ đủ 14/14 mục kể cả Resizable và Scroll Area (hai thứ một app canvas/graph rất cần). Untitled UI thiếu rõ 2 mục đó trong danh mục công khai — phù hợp hơn với sản phẩm dashboard/admin, kém phù hợp hơn với nhu cầu canvas app của KIRA.

## 4. Liên quan `@assistant-ui/react` — phát hiện quan trọng

Đã kiểm trực tiếp qua npm registry (`curl registry.npmjs.org/@assistant-ui/react/0.15.19`, truy cập 2026-09-16 — **đã xác minh, không phải suy luận**):

```
@assistant-ui/react@0.15.19 dependencies:
  "radix-ui": "^1.6.7"
```

**KIRA đã có Radix trong cây dependency, dù không cài trực tiếp.** `@assistant-ui/react` (dùng cho panel Chat phải, `main.tsx:101` import, `main.tsx:2416-2417` — theo `DECISIONS.md #5` và `docs/research/2026-09-15-spike-assistant-ui.md`) phụ thuộc gói `radix-ui` (bản gộp tất cả package Radix Primitives thành một, phát hành bởi chính team Radix từ 2025) ở mức `^1.6.7`. Điều này có hai hệ quả:

1. **Điểm cộng cho hướng shadcn/ui (nhánh Radix)**: nếu chọn shadcn + Radix, không phải "thêm một hệ primitive mới" — Radix đã có sẵn trong `node_modules` qua assistant-ui, chỉ là chưa được KIRA code tự gọi trực tiếp. Rủi ro version conflict thấp vì đang ở `^1.6.7`, một bản khá mới.
2. **Không phải điểm cộng cho Tailwind**: `@assistant-ui/react` bản thân **không** phụ thuộc Tailwind hay bất kỳ package CSS nào trong `dependencies` (đã kiểm toàn bộ danh sách: `zod`, `zustand`, `radix-ui`, `assistant-cloud`, `assistant-stream`, `@assistant-ui/tap`, `@assistant-ui/core`, `safe-content-frame`, `@assistant-ui/store`, `react-textarea-autosize` — không có `tailwindcss` hay tương tự). KIRA đang dùng assistant-ui ở chế độ headless thuần (tự viết CSS, xác nhận lại theo báo cáo Ark UI §0), nên việc thư viện này tồn tại **không** tạo áp lực kỹ thuật phải thêm Tailwind — nó chỉ tạo áp lực nhẹ nghiêng về Radix nếu sau này chọn primitive nào.

## 5. Chung sống với `styles.css` hiện có

- **Preflight của Tailwind v4** reset mạnh: bỏ margin mặc định của heading/p, `button`/`input`/`select`/`textarea` mất toàn bộ style hệ điều hành (border, padding, font kế thừa từ `unset`), `box-sizing: border-box` toàn cục, `border-color` mặc định đổi sang `currentColor`. Với 9 798 dòng CSS đã viết tay theo giả định trình duyệt mặc định (KIRA dùng nhiều style dựa trên default UA stylesheet cho `<select>` gốc, theo báo cáo Ark UI), bật preflight nguyên trạng sẽ làm vỡ layout ở mọi nơi chưa migrate — **không thể bật preflight toàn cục cho tới khi migrate xong toàn bộ app**, hoặc phải tắt hẳn.
- **Cách cô lập** (nguồn: [github.com/tailwindlabs/tailwindcss discussion #17481, #17594, #15723](https://github.com/tailwindlabs/tailwindcss/discussions/17481), truy cập 2026-09-16):
  - Tailwind v4 mặc định bọc CSS trong cascade layer: `@layer theme, base, components, utilities;` rồi import `tailwindcss/theme.css layer(theme)`, `tailwindcss/preflight.css layer(base)`, `tailwindcss/utilities.css layer(utilities)`.
  - **Tắt preflight**: bỏ dòng import `preflight.css`, giữ nguyên cấu trúc `@layer` còn lại — cách được tài liệu xác nhận hoạt động (khác với một số report cũ nói "không tắt được", đã fix).
  - **Cascade layer đặt CSS thuần của KIRA ở layer riêng, ưu tiên cao hơn Tailwind utilities nếu cần** (`@layer kira-legacy { ... }` đặt trước `utilities` trong danh sách layer) — vì layer khai sau thắng layer khai trước trong CSS cascade, cần xếp thứ tự layer đúng ý (utilities Tailwind nên thắng nếu muốn override nhanh bằng class, hoặc legacy CSS thắng nếu muốn giữ nguyên style cũ mặc định).
  - Vì `styles.css` hiện tại **0 lần dùng `@layer`** (đã đếm ở §0), toàn bộ 9 798 dòng hiện nằm ở "layer ẩn" (unlayered) — theo cascade layer spec, **CSS không nằm trong layer nào luôn thắng CSS nằm trong layer nào đó**, bất kể thứ tự khai báo. Nghĩa là: nếu chỉ thêm Tailwind (mọi thứ trong layer) mà không bọc CSS cũ vào layer, **CSS cũ của KIRA sẽ tự động thắng mọi utility Tailwind** — an toàn cho phần chưa migrate, nhưng cũng có nghĩa muốn dùng class Tailwind override một style cũ thì bắt buộc phải bọc riêng đoạn CSS cũ liên quan vào layer, hoặc dùng `!important`/tăng specificity thủ công.
- **Thứ tự import**: `@import "tailwindcss";` (hoặc bản tách preflight) phải đứng ở đầu `styles.css` hoặc file CSS entry, trước mọi CSS khác nếu muốn cascade layer hoạt động đúng thứ tự dự kiến.
- **Map token KIRA vào `@theme`**: theo mô hình shadcn (§1), khai token Tailwind bằng `var()` trỏ tới biến KIRA sẵn có thay vì hex tĩnh:
  ```css
  @theme inline {
    --color-accent: var(--kira-accent);
    --color-surface: var(--kira-surface);
  }
  ```
  Vì `buildProjectAppearanceStyle()` ghi các biến gốc (`--kira-accent`...) **inline trên `.app-shell`, không phải `:root`** (`CLAUDE.md`, xác nhận lại §0), khối `@theme` chỉ định nghĩa **tên** utility Tailwind sẽ sinh ra (`bg-accent`, `text-accent`...); giá trị runtime vẫn phải đọc đúng biến đã theme. Có hai lựa chọn, cả hai chưa test tay trong phiên này:
  1. Chuyển `@theme` alias sang trỏ `var()` không có fallback, và **chấp nhận utility Tailwind chỉ render đúng màu bên trong `.app-shell`** (giống mọi CSS con khác của KIRA hiện tại) — component dùng Tailwind class phải nằm trong cây DOM của `.app-shell`, không phải component portal ra `document.body` (theo đúng cảnh báo đã có trong `CLAUDE.md`: "Phần tử portal ra `document.body` cũng không thấy token theme").
  2. Nếu Base UI/Radix Dialog/Popover portal ra `document.body` theo mặc định (hành vi chuẩn của cả hai), phải cấu hình `container`/`portalContainer` prop trỏ về bên trong `.app-shell` — **cả Radix và Base UI đều hỗ trợ prop này** (kiến thức chung về hai thư viện, chưa dẫn link cụ thể trong lần research này) — nếu không làm, dark/light theme và màu project-specific sẽ vỡ ngay tại Dialog/Popover đầu tiên dùng Tailwind class.
- **`scripts/graphify-lite.mjs`**: như đã nói ở §0, script đọc đúng 1 file `apps/desktop/src/styles.css`. Nếu khối `@theme`/import Tailwind được viết **trong file này** (khuyến nghị, để giữ nguyên script không cần sửa), `extractDeclaredCssVars()` vẫn bắt đúng các khai báo `--color-*` mới vì regex không phân biệt selector. Rủi ro thật: **Tailwind sinh CSS utility runtime không nằm trong source `styles.css`** — nếu build pipeline sau này tách file CSS compiled riêng (import từ `main.tsx` qua `import './tailwind.css'` chẳng hạn), script sẽ **không quét được** phần đó, và cần thêm biến `TAILWIND_CSS` + đọc thêm file đó vào script trước khi tin `--strict` là đủ.

## 6. Tauri/WKWebView: vấn đề đã biết

Nguồn: tìm kiếm GitHub issues `radix-ui/primitives`, `tauri-apps/tauri` (truy cập 2026-09-16).

- **Không tìm thấy issue nào nêu đích danh Radix UI hoặc React Aria + Tauri/WKWebView** (khớp với kết luận của báo cáo Ark UI cùng ngày về Zag.js). Các bug tìm được là generic WebKit/Safari, không đặc thù Tauri:
  - [`radix-ui/primitives#3811`](https://github.com/radix-ui/primitives/issues/3811): Safari — focus thoát khỏi `Dialog` khi dùng `modal={false}`, vì Safari xử lý focus change khác Chrome khiến Radix hiểu nhầm là "outside interaction" và tự đóng dialog. **Liên quan trực tiếp nếu dùng Radix Dialog non-modal trong KIRA** (app hiện có dialog tự viết dùng focus trap riêng — nếu thay bằng Radix, cần test kỹ non-modal case trên WKWebView thật).
  - [`radix-ui/primitives#3353`](https://github.com/radix-ui/primitives/issues/3353): focus trap và scroll vỡ khi Dialog portal vào Shadow DOM — không áp dụng trực tiếp cho KIRA (không dùng Shadow DOM/Web Component) nhưng cho thấy Radix nhạy với môi trường portal bất thường, cùng họ rủi ro với việc portal ra ngoài `.app-shell` đã nêu ở §5.
- **Kết luận suy luận** (chưa test tay, giống hệt khuyến nghị của báo cáo Ark UI): rủi ro hệ thống thấp vì cả Base UI, Radix, React Aria đều sinh DOM/CSS chuẩn, không dùng Web API hiếm. Rủi ro cụ thể nằm ở **portal + focus khi WKWebView ở nền** (đã có gotcha ghi trong `CLAUDE.md`: "WKWebView không nhận click khi app ở nền") và **theme token không thấy được khi portal ra ngoài `.app-shell`** (§5) — cả hai đều phải verify tay trong app native (`npx tauri build --debug ...` theo mục Gotcha của `CLAUDE.md`) trước khi merge, **bất kể chọn thư viện nào**.

## 7. Chiến lược migrate từng bước trên codebase này

### Có cần tách `main.tsx` trước không?

**Gần như chắc chắn có, nhưng không phải điều kiện tiên quyết cho pha 1.** Lý do:
- 426 khai báo top-level, 74 component, trong 1 file 20 476 dòng — mọi lần sửa "một component" đều phải mở/tìm trong file khổng lồ này, và theo `CLAUDE.md`, `main.tsx` **không Fast Refresh được**: mỗi sửa reload toàn bộ app + mất state. Việc này đã chậm với CSS thuần, sẽ chậm hơn khi thêm một vòng "viết Tailwind class → xem kết quả" lặp lại nhiều lần cho từng component migrate.
- Nhưng tách file là việc cơ học tốn công lớn (ước lượng riêng, không nằm trong phạm vi báo cáo này) và có rủi ro hồi quy riêng (import cycles, state đóng gói lẫn nhau) — không nên trộn chung với rủi ro đổi hệ CSS trong cùng một đợt. **Đề xuất: pha 1 làm trên `main.tsx` nguyên trạng** (một component đủ nhỏ như `SettingsView` vẫn sửa được, chỉ chậm hơn do không Fast Refresh), và chỉ tách file nếu pha 1 cho thấy tốc độ lặp quá chậm để tiếp tục.

### Thứ tự surface đề xuất

1. **Settings** (`SettingsView`, `main.tsx:8629`; `ProjectSettingsPopover`, `main.tsx:8337`) — đã xác nhận là component định vị rõ, có nhiều `<select>` gốc cần thay (theo báo cáo Ark UI, danh sách dòng nằm rải rác 8382-13772 chủ yếu quanh khu vực Settings/AI Providers). Rủi ro thấp: Settings không nằm trên đường "get out of the way" chính của canvas, ít bị user nhìn thấy liên tục.
2. **Panel phải** (Library/chrome quanh canvas) — rủi ro trung bình, cần đọc thêm `docs/research/2026-09-13-right-panel-and-research-harness.md` trước khi khoanh vùng chính xác (**chưa đọc trong lần research này**, ngoài phạm vi câu hỏi).
3. **Canvas node/graph** — để sau cùng hoặc giữ CSS thuần vĩnh viễn. Đây là bề mặt phức tạp nhất (roving tabindex, drag, 3d-force-graph, animation theo `kira-controls`), rủi ro hồi quy cao nhất, và giá trị đổi sang Tailwind/shadcn thấp nhất (không có nhiều `<select>`/`Dialog`/form control gốc trình duyệt ở đây — chủ yếu là canvas rendering tự viết, không phải loại UI mà shadcn/Untitled UI giải quyết).

### Ước lượng công sức mỗi pha (ngày-agent, suy luận dựa trên quy mô đã đo — không phải số đo thực nghiệm)

| Pha | Việc | Ước lượng |
|---|---|---|
| 0 | Cài Tailwind v4 cô lập bằng `@layer`, tắt preflight, viết `@theme` map sang token KIRA, verify graphify-lite vẫn pass, verify build native (`tauri build --debug`) không vỡ style hiện có | 1-2 ngày-agent (Worker Sonnet, theo bảng model `CLAUDE.md`) — phần lớn thời gian là verify tay trong app native, không phải viết code |
| 1 | Migrate `SettingsView` + `ProjectSettingsPopover` sang shadcn (thay `<select>` gốc bằng `Select`, form control theo Ink & Paper token) | 3-5 ngày-agent — mỗi `<select>`/control cần viết lại theo Ink & Paper (không dùng theme mặc định shadcn), cộng test tay focus/keyboard trong app native cho từng cái |
| 2 | Panel phải (Library/chrome) | Chưa ước lượng được — cần đọc báo cáo right-panel trước (ngoài phạm vi) |
| 3 | Canvas node/graph | Không đề xuất làm, hoặc để rất sau — công sức có thể ngang bằng cả pha 0+1+2 cộng lại do độ phức tạp tương tác, và giá trị thấp như đã nêu |

### Rủi ro hồi quy với QA vừa đạt

- `docs/research/2026-09-15-design-round5-verdict.md`: **0 P0/P1** tại `7869afa`, `impeccable ≥32/40` cả 3 màn × 2 theme. Bất kỳ pha nào đụng `main.tsx`/`styles.css` **đều có khả năng hồi quy** các màn đã đạt chuẩn này, vì token và motion đã tinh chỉnh thủ công theo Ink & Paper — chuyển sang class Tailwind (dù giữ đúng giá trị) thay đổi cách CSS specificity/cascade hoạt động, dễ vỡ theo cách graphify-lite không bắt được (nó chỉ kiểm biến CSS declared/undeclared và Tauri command map, **không kiểm contrast hay đúng token theo `DESIGN.md`**).
- **Không có test tự động cho UI `apps/desktop`** — đã kiểm: `bun test` chỉ tồn tại ở `apps/codex-helper` (sidecar Node, không phải frontend); không tìm thấy `*.test.*`/`*.spec.*` nào trong `apps/desktop`. Nghĩa là an toàn hồi quy hoàn toàn dựa vào (a) `graphify-lite.mjs --strict` (kiểm cấu trúc, không kiểm thẩm mỹ), (b) QA thủ công theo rubric `impeccable` + đo contrast bằng script (theo mục Verify `CLAUDE.md`) — **không có visual regression suite**. Mỗi pha migrate nên chạy lại đúng quy trình QA 8-thành-viên/5-vòng đã dùng ở round 5 cho riêng surface vừa đổi, không thể chỉ tin "trông giống cũ".
- Giữ được `graphify-lite` (§0/§5 — cần sửa nếu Tailwind output tách file riêng), giữ được contrast script (không phụ thuộc Tailwind, đo trên DOM/computed style thật nên vẫn hoạt động bất kể CSS engine nào), **không giữ được** so sánh "trước/sau" tự động — chỉ có ảnh chụp thủ công.

## 8. Khuyến nghị

**shadcn/ui hay Untitled UI React**: **shadcn/ui**, nếu user quyết định đi hướng Tailwind sau khi cân nhắc với kết luận Ark UI. Lý do:
- Phủ đủ 14/14 nhu cầu kể cả Resizable/Scroll Area mà Untitled UI thiếu (§3) — hai thứ này có giá trị thật cho app canvas/panel-chia-vùng như KIRA.
- Radix đã có sẵn trong dependency tree qua `@assistant-ui/react` (§4) — chọn nhánh Radix của shadcn tận dụng được cái đã có, giảm số primitive khác nhau trong app.
- Untitled UI thiên về dashboard/admin/marketing site, sinh ra từ Figma UI kit thương mại — độ khớp thẩm mỹ với Ink & Paper (đã chốt, specimen riêng) thấp hơn một bộ thuần headless như shadcn+Base UI/Radix, tương tự lý do Park UI bị loại trong báo cáo Ark UI (§2 báo cáo đó).

**Pha 1 nhỏ nhất có giá trị** (nếu user chọn hướng này thay vì Ark UI): cài Tailwind v4 cô lập bằng cascade layer (tắt preflight, `@theme` map qua `var()` sang token KIRA hiện có, giữ nguyên `styles.css` là entry point để `graphify-lite` không cần sửa) + chuyển `SettingsView`/`ProjectSettingsPopover` (`main.tsx:8629`, `8337`) sang shadcn, ưu tiên thay các `<select>` gốc trước — đúng như user gợi ý trong brief, và trùng với ranh giới nợ QA đã biết. Giữ nguyên phần còn lại (canvas, right panel, Dialog/Popover/Segmented tự viết) cho tới khi pha 1 verify xong trong app native.

---

## Quyết định cần user chốt

1. **Chọn một hướng, không làm cả hai**: Ark UI headless + giữ CSS thuần (kết luận `2026-09-16-ui-kit-ark-park-magic.md`, chi phí thấp hơn nhiều) **hoặc** Tailwind v4 + shadcn/ui (kết luận báo cáo này, đổi kiến trúc CSS, chi phí cao hơn nhưng "chuẩn" hơn theo ý user và đúng với nghiên cứu gốc tháng 6/2026 đã bị bỏ dở).
2. Nếu chọn Tailwind + shadcn: xác nhận phạm vi pha 1 (chỉ Settings, hay rộng hơn), và ai làm (Worker Sonnet triển khai theo spec một khi đã chốt component nào dùng shadcn — theo bảng model `CLAUDE.md`).
3. Cần quyết định rõ: preflight tắt hẳn vĩnh viễn, hay bật dần theo từng surface đã migrate xong 100%? Ảnh hưởng cách viết `@layer` ở pha 0.
4. Có cần đọc thêm `docs/research/2026-09-13-right-panel-and-research-harness.md` trước khi khoanh vùng pha 2 (Panel phải) không — báo cáo này chưa đọc file đó.

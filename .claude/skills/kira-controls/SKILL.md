---
name: kira-controls
description: Công thức hiện thực hệ control Ink & Paper của KIRA desktop. Bốn cấp nút (primary mực, secondary giấy, quiet, danger) với giá trị dark và light theo từng trạng thái, hai cỡ, toolbar và tool rail nổi trên canvas, tooltip, icon rail vẽ riêng (SVG class bd, k-*, lxo/lxi, tuỳ chọn đơn sắc) so với glyph Lucide, motion khi nhấn, ngưỡng contrast và cách đo. Dùng khi thiết kế, code, review hoặc critique bất kỳ button, segmented, tab, toolbar, tool rail, zoom, tooltip hay icon nào trong apps/desktop (.primary-button, .quiet-button, .icon-button, .danger-button, .canvas-tool-rail), hoặc khi cần biết một control phải trông và phản hồi thế nào. Use for any KIRA button, toolbar, rail or icon work.
---

# kira-controls

Skill này là **công thức**; luật nằm ở `DESIGN.md` §3, §5, §6. Mâu thuẫn thì DESIGN.md thắng, và báo UI/UX để sửa một trong hai.

Ký hiệu nguồn:
- `S:<n>` = dòng *n* của `docs/research/art-direction/v2/controls-v2.html` (specimen đã chốt). Bản trích nguyên văn phần Ink & Paper: [`references/ink-paper.css`](references/ink-paper.css).
- `R2 §x` = `docs/research/2026-09-14-art-direction-controls-v2.md` (lý do, số đo). `R1` = `docs/research/2026-09-14-art-direction.md`.
- Dòng code trích ở commit `a00af07`; grep lại trước khi dùng.

## 1. Phạm vi và thứ bậc nguồn

**Trong phạm vi:** button mọi cấp và cỡ, icon-only, segmented và tab, chrome nổi trên canvas (tool rail, view switcher, zoom, nút Kira), tooltip của tool, icon (rail và glyph UI).
**Ngoài phạm vi:** list row, node, panel, bố cục dialog: xem DESIGN.md.

**Thứ bậc khi mâu thuẫn** (CLAUDE.md, "Skill thiết kế"): `DESIGN.md` > **kira-controls** > impeccable (sàn chất lượng) > apple-design (HIG macOS) > refactoring-ui (chỉ kỹ thuật chiều sâu và bóng, không lấy thang spacing hay bóng) > emil-design-eng (chỉ cảm giác nhấn, không spring cho control).

Ba skill ngoài do user cài ở `~/.claude/skills/`. Chưa có thì **không tự cài**: đọc `docs/research/2026-09-15-design-skills-github.md` §2, §3, §5 thay cho việc gọi skill, và ghi rõ điều đó trong report.

`main.tsx` và `styles.css` là file nóng: claim với Orchestrator trước khi sửa.

## 2. Luật bắt buộc

1. **Một primary mỗi view.** Ở dark, primary là khối sáng nhất màn hình; hai cái đã tranh nhau. Hàng trong list dùng secondary.
2. **Teal (`--accent-cyan`) chỉ cho:** selection trên canvas, focus outline, trạng thái (connected, checkbox đã tick). Không bao giờ là nền, viền hay chữ của nút, tab, tool đang chọn.
3. **Selected vẽ bằng mực** (`--text-main`): viền 1,5px trên secondary, gạch 2px dưới quiet và tab, chip mực trên rail tool.
4. **Hover không đảo** control thành khối đặc, dù là teal hay mực.
5. **Mọi `<button>` reset** `background`, `border`, `font`, `color`: không để ButtonFace của trình duyệt lọt ra.
6. **Bóng** chỉ trên nút có nền (primary, secondary, danger) và plate nổi. Quiet không bóng. List phẳng.
7. **Không kính** trên nút, panel, dialog, popover. `backdrop-filter` chỉ trên plate nổi trên canvas.
8. **Glyph UI** là Lucide nét, `currentColor`, không màu, không gradient, không bóng. Màu, khối, gradient chỉ dành cho icon rail.
9. **Nhãn control** weight 560; `font-size` là token (`--text-body` cho Regular, `--text-small` cho Compact).
10. **Không em dash** trong nhãn và tooltip.

## 3. Bốn cấp nút

### 3.1 Token (S:115-128)

Khai trên `.app-shell` theo color mode (không ở `:root`: các biến này tham chiếu token đã theme). Tên cột phải là key front matter trong DESIGN.md.

| Biến specimen | Dark | Light | DESIGN.md |
|---|---|---|---|
| `--ink-bg` / `-h` / `-p` | `#f4f1ea` / `#fffdf7` / `#dcd8cf` | `#23211d` / `#35322c` / `#12110f` | `control-primary`, `-hover`, `-pressed` |
| `--ink-fg` | `#0f1517` | `#f7f5f0` | `control-on-primary` |
| `--sheet` / `-h` / `-p` | `#1c2426` / `#222b2d` / `#141b1d` | `#fbfaf7` / `#ffffff` / `#eceae4` | `control-sheet`, `-hover`, `-pressed` |
| `--sheet-edge` | `rgb(255 255 255 / .075)` | `rgb(35 33 29 / .13)` | `control-sheet-edge` |
| `--lift1` | `rgb(0 0 0 / .5)` | `rgb(35 33 29 / .1)` | `control-lift-near` |
| `--lift2` / `--lift2-h` | `rgb(0 0 0 / .55)` / `.62` | `rgb(35 33 29 / .24)` / `.3` | `control-lift-far`, `-hover` |
| `--paper-edge` | `rgb(35 33 29 / .25)` | `rgb(255 255 255 / .12)` | `control-paper-edge` |
| `--patch` / `--patch-p` | `rgb(255 255 255 / .065)` / `.035` | `rgb(35 33 29 / .065)` / `.1` | `control-patch`, `-pressed` |
| `--dis-edge` | `rgb(255 255 255 / .14)` | `rgb(35 33 29 / .2)` | `control-disabled-edge` |
| `--danger-fg` | `#e59587` | `#8a4035` | `control-danger-text` |
| `--danger-edge` | `rgb(217 135 121 / .38)` | `rgb(138 64 53 / .4)` | `control-danger-edge` |

### 3.2 Trạng thái (công thức giống nhau ở hai mode)

| Cấp | Nghỉ | Hover | Pressed (`:active`) | Selected | Disabled |
|---|---|---|---|---|---|
| **Primary** | nền `--ink-bg`, chữ `--ink-fg`, bóng `inset 0 -1px 0 var(--paper-edge), 0 1px 0 var(--lift1), 0 4px 10px -3px var(--lift2)` (S:129) | nền `--ink-bg-h`, `translateY(-1px)`, bóng `inset 0 -1px 0 var(--paper-edge), 0 2px 0 var(--lift1), 0 9px 16px -5px var(--lift2-h)` (S:130) | nền `--ink-bg-p`, `translateY(.5px)`, `box-shadow: none` (S:131) | không có | xem dưới |
| **Secondary** | nền `--sheet`, viền 1px `--sheet-edge`, chữ `--text-main`, bóng `0 1px 0 var(--lift1), 0 3px 8px -2px var(--lift2)` (S:52, S:132) | nền `--sheet-h`, `-1px`, bóng `0 2px 0 var(--lift1), 0 8px 14px -4px var(--lift2-h)` (S:133) | nền `--sheet-p`, `.5px`, không bóng (S:134) | nền `--sheet`, viền transparent, `box-shadow: inset 0 0 0 1.5px var(--text-main)` (S:135) | xem dưới |
| **Quiet** | không nền, chữ `--text-soft` (S:137) | nền `--patch`, chữ `--text-main` (S:138) | nền `--patch-p`, chữ `--text-main` (S:139) | chữ `--text-main`, `box-shadow: inset 0 -2px 0 var(--text-main)`, radius `8px 8px 2px 2px` (S:140) | chữ `--text-muted`, không viền (S:142) |
| **Danger** | như secondary, chữ `--danger-fg`, viền `--danger-edge` (S:132, S:136) | như secondary (S:133) | như secondary (S:134) | không có | xem dưới |

- **Disabled** (primary, secondary, danger): nền transparent, `border: 1px dashed var(--dis-edge)`, chữ `--text-muted`, không bóng, không transform, hover không đổi, `cursor: default` (S:60, S:141).
- **Focus-visible** (mọi cấp và rail tool): `outline: 2px solid var(--accent-cyan); outline-offset: 2px` (S:59, S:229).
- Danger chỉ cho hành động huỷ hoại cần xác nhận; cặp chuẩn là `quiet "Giữ node"` + `danger "Xoá node"` (S:575).

## 4. Cỡ (S:52-58)

| | Regular | Compact |
|---|---|---|
| Cao | `32px` | `26px` |
| Padding | `0 12px` | `0 9px` |
| Chữ | `--text-body` 13px, 560 | `--text-small` 11px, 560 |
| Khoảng icon và chữ | `6px` | `4px` |
| Radius | `8px` (`--radius-3`) | `6px` (`--radius-2`) |
| Glyph | 16px, stroke 1.8 | 13px, stroke 2 |
| Icon-only | `32 × 32` | `26 × 26` |

Mọi nút có `border: 1px solid transparent` ở gốc để cấp có viền không làm lệch layout; `letter-spacing: -0.003em`. Compact cho panel, dock, popover (S:557); Regular cho dialog và thanh công cụ.

## 5. Toolbar và chrome nổi

**Vật liệu plate** (rail, view switcher, zoom, nút Kira):
- Dark: nền `rgb(29 37 39 / .95)`, bóng `inset 0 1px 0 rgb(255 255 255 / .06), 0 2px 4px rgb(0 0 0 / .45), 0 14px 34px -8px rgb(0 0 0 / .65)` (S:251).
- Light: nền `rgb(251 250 247 / .96)`, bóng `inset 0 0 0 1px rgb(35 33 29 / .06), 0 2px 4px rgb(35 33 29 / .1), 0 14px 30px -10px rgb(35 33 29 / .32)` (S:252).
- Plate nhỏ (switcher, zoom, Kira) dùng lớp xa `0 12px 28px -8px` dark, `0 12px 26px -10px` light (S:371-372).
- `backdrop-filter: blur(24px) saturate(1.35)` (S:225).

**Tool rail:**
- Plate radius `16px`, padding `6px`, gap `2px` (S:225, S:251).
- Thứ tự nhóm: Chọn | Ảnh, Palette, Ý tưởng, Ghi chú, Frame | Sơ đồ, Nối (S:515-521). Vách ngăn `1px × 24px`, `--separator-hairline`, margin `0 6px` (S:226, S:253).
- Tool `44px`, radius `12px` (`--radius-4`), icon `28px` với `drop-shadow(0 1px 0 rgb(0 0 0 / .35))`, light `rgb(35 33 29 / .18)` (S:254-256).
- **Hover:** tool nền `--glass-hover`; icon `translateY(-3px) rotate(-4deg)`, `drop-shadow(0 4px 3px rgb(0 0 0 / .45))`, light `rgb(35 33 29 / .28)` (S:257-259).
- **Pressed:** tool nền `--glass-hover`; icon `translateY(1px) scale(.94)`, `filter: none` (S:260-261).
- **Selected:** chip mực, nền `#f4f1ea` dark, `#23211d` light, bóng `0 1px 0 rgb(0 0 0 / .35), 0 4px 10px -4px rgb(0 0 0 / .5)` (S:262-264). Icon Chọn trên chip đảo tông (S:215-216); icon màu khác giữ màu.
- **Tooltip** (S:230-233): phía trên tool, cách `12px`, cao `26px`, padding `0 9px`, radius `7px`, 11px/560, nền `#f4f1ea` chữ `#0f1517` phím `#4a4c48` (dark); nền `#23211d` chữ `#f7f5f0` phím `#c9c6bf` (light); bóng `0 6px 16px -4px rgb(0 0 0 / .45)`. Nội dung: tên + phím tắt (S:518). Contrast tính từ hex, chưa đo trên ảnh: chữ 16,33 và 14,75; phím 7,70 và 9,42.

**View switcher:** plate radius `12px`, padding `4px`, gap `2px` (S:357, S:359); lựa chọn là quiet Compact, view hiện tại dùng gạch mực (S:619).
**Zoom:** plate radius `12px` (S:363), tool `32px` icon `20px` (S:365-366), số % mono 11px (S:364).
**Nút Kira:** plate riêng `52px`, icon `24px` (S:375, S:377), đứng cạnh rail (S:626).

**Giá trị ngoài thang, chưa chốt** (hỏi UI/UX trước khi code, đừng tự viết giá trị một lần): tooltip radius 7px, plate Kira radius 14px (S:375), weight 600 của số zoom (S:364), transform 140ms (S:53). Đề xuất của UI/UX: `--radius-3`, `--radius-4`, 560, `--duration-fast`.

## 6. Icon

### 6.1 Hai họ có chủ đích
- **Rail = dụng cụ:** 12 icon vẽ riêng, có khối, có màu theo loại node, nhấc lên khi hover. Tác phẩm của repo, không ghi nguồn (R2 §D).
- **Glyph UI = chữ:** Lucide (`lucide-react ^0.561.0` ở `a00af07`), nét, `currentColor`. Phosphor chỉ còn ở rail cho tới khi thay xong, rồi bỏ (R2 §D).
- Không trộn hai họ trong một plate: zoom dùng icon rail, không dùng Lucide.

### 6.2 Cấu trúc SVG icon rail (S:187-198, S:490-511)
- `viewBox="0 0 24 24"`, `class="ico ico-<tên>"`, `aria-hidden="true"`; nhãn nằm ở `aria-label` của button (S:512).
- `<defs>`: `linearGradient` dọc `<id>b` (stop `s-hi` rồi `s-lo`) cho thân; `radialGradient` `<id>s` (`cx .32 cy .18 r .62`, stop `s-sp` opacity .85 rồi `s-sp0` ở .55) cho điểm phản quang (S:507-510).
- **Id gradient phải duy nhất mỗi lần render** (React: `useId`). Trùng id thì icon sau vẽ gradient của icon trước, và vỡ khi icon trước unmount.

| Class | Vẽ gì | Thuộc tính |
|---|---|---|
| `bd` | thân | `fill: url(#…b)`, `stroke: var(--ink)`, `stroke-width: var(--sw, 1.5)` |
| `ln` / `ln2` | nét trong thân / nét phụ | `stroke: var(--ink)` / `var(--line)`, 1.2 |
| `lnA` | nét màu của sticker | `stroke: var(--c-acc)`, 1.9 |
| `fk` | khối mực | `fill: var(--ink)` |
| `lxo` + `lxi` | nét nằm thẳng trên plate: lớp ngoài 3.1 `var(--lxo)`, lõi 1.8 `var(--lxi)`; vẽ `lxo` trước | |
| `k-sky`, `k-sun`, `k-leaf`, `k-rose`, `k-amb`, `k-acc`, `k-fold`, `k-glass` | chi tiết màu | `fill: var(--c-*)` |
| `s-hi`, `s-lo`, `s-sp`, `s-sp0`, `s-kw`, `s-km`, `s-kc` | stop gradient | `--b-hi`, `--b-lo`, `--spec`, `--kira-*` |

Vì sao `lxo/lxi`: nét mực đơn nằm trên plate tối chỉ đạt **1,41:1**; tách hai lớp lên 3,60 (R2 §C). Nét nào nằm trên nền plate đều phải hai lớp.

### 6.3 Biến màu Ink & Paper (S:207-216)
- Chung: `--ink #0b0f10`, `--lxo #0b0f10`, `--lxi #f4f1ea`, `--line #8a6d1c`, `--spec rgb(255 255 255 / .8)`, thân `--b-hi #fbf9f4` → `--b-lo #dfdad0`; `--c-sky #8cc5ea`, `--c-sun #ffcf5c`, `--c-leaf #6aab77`, `--c-rose #e5728a`, `--c-amb #eea43a`, `--c-acc #4fb49c`, `--c-fold #d6a92f`, `--c-glass rgb(255 255 255 / .1)`.
- Light đổi: `--ink #23211d`, `--lxo rgb(255 255 255 / .9)`, `--lxi #23211d`, `--c-glass rgb(35 33 29 / .06)`.
- Thân riêng: palette `#f5e9d0 → #d8c39a`, ý tưởng `#ffdf7a → #f0a52a`, ghi chú `#fdea8c → #f0c645`. Dark: frame `--ink #f4f1ea`; ba icon zoom `--ink #f4f1ea`, thân `rgb(255 255 255 / .16) → .04`. Light zoom thân `#ffffff → #e9e6de`.
- `--c-acc #4fb49c` là màu sticker, **không phải** `--accent-cyan`; không dùng nó ở đâu khác.

### 6.4 Tuỳ chọn đơn sắc
Cùng SVG, chỉ đổi biến dưới một attribute trên container (ví dụ `[data-rail-icons="mono"] .ico`): các `--c-*` và `--b-hi/--b-lo` về tông trung tính của theme, giữ `--ink`, `--lxo/--lxi`, điểm phản quang. Kỹ thuật "chỉ đổi biến" đã có tiền lệ ở khối so sánh vòng 1 (S:437-440). **Specimen chưa có bảng đơn sắc cho Ink:** giá trị cụ thể phải được UI/UX dựng và đo 3:1 trên nền xấu nhất trước khi merge.

## 7. Motion (S:53, S:61, S:227-228)

- Nền, bóng, màu chữ, viền: `120ms ease` (`--duration-fast`, `--ease-soft`).
- `transform` của nút và icon rail: `140ms cubic-bezier(0.16, 1, 0.3, 1)` (đường cong `--ease-out-soft`, không vượt đích); `filter` icon `140ms ease`.
- Không spring, không overshoot cho control (`--ease-spring` chỉ cho kéo thả trên canvas; R1 P3-9). Không animate `width` hay `height`. Không animation tự chạy.
- `prefers-reduced-motion: reduce`: bỏ transition cho nút, tool, icon (S:61). *Đề xuất UI/UX, chưa có trong specimen:* ở chế độ này bỏ luôn `rotate(-4deg)` và `translateY(-3px)` của icon rail, chỉ giữ đổi nền, vì chuyển động vẫn xảy ra tức thời.

## 8. Contrast: ngưỡng và cách đo

**Ngưỡng:** chữ ≥ 4,5:1 ở mọi trạng thái kể cả disabled; vòng focus ≥ 3:1 với nền quanh nó; icon rail (đồ hoạ) ≥ 3:1.

**Đã đo trên specimen** (R2 §C, Ink & Paper, 0 ô không đạt):

| | Dark | Light |
|---|---|---|
| Chữ thấp nhất (34 ô) | 5,92 (primary disabled) | 5,25 (primary disabled) |
| Vòng focus thấp nhất | 8,24 | 3,59 |
| Icon rail, tool thấp nhất | 6,56 | 4,48 |
| Icon rail trên nền xấu nhất | 5,34 | 4,30 |
| Chữ trong khung ngữ cảnh (16 ô) | 6,75 | 7,02 |

**Cách đo trong app** (theo CLAUDE.md, mục Verify):
1. Đo trong `.app-shell` đang render: token là inline style, hex trong `:root` không phải màu thật. Kiểm mọi `var()` có được khai báo.
2. Ép trạng thái rồi mới đo; gắn tạm `*,*::before,*::after{transition:none!important;animation-duration:0s!important}` để không đọc màu dở dang.
3. **Chữ:** composite màu chữ (nhân alpha và `opacity` tổ tiên) lên **điểm ảnh nền thật** dưới hộp chữ, lấy thấp nhất. Specimen chụp hai lần (bình thường và chữ `transparent`) để lấy nền (R2 §C). Dùng `elementsFromPoint` thì gắn tạm `*{pointer-events:auto!important}`.
4. **Focus:** màu outline so với mọi điểm ảnh ở dải 1px trong khe offset và dải 1px ngoài vòng, lấy thấp nhất.
5. **Icon rail:** chụp có và không có icon, so điểm ảnh icon với nền cùng vị trí, chỉ tính điểm thay đổi rõ, lấy **phân vị 80**, báo tool thấp nhất.
6. **Nền xấu nhất:** plate nửa trong suốt, nên đo lại khi ngay dưới plate là ảnh trắng tuyệt đối (dark) hoặc đen tuyệt đối (light) (S:309-310, S:588).
7. Chrome headless khác WKWebView: kết luận cuối phải chụp trong bundle debug (CLAUDE.md, Gotcha).

## 9. Ba ví dụ trước và sau

Ảnh ở `docs/research/art-direction/current/`.

### A. Hover đảo thành khối teal ([crop-d](../../../docs/research/art-direction/current/crop-d-icon-hover-inversion.jpg))
Trước (`styles.css:968-972`): nút ít quan trọng nhất tạo nhịp mạnh nhất màn hình, và teal mang nghĩa "hover" (R1 P1-3).
```css
.icon-button:hover, .quiet-button:hover { background: var(--accent-strong); color: var(--bg-base); }
```
Sau: quiet hover là miếng giấy, không đổi độ sáng khối.
```css
.quiet-button:hover  { background: var(--patch);   color: var(--text-main); }
.quiet-button:active { background: var(--patch-p); color: var(--text-main); }
```

### B. Nút xám mặc định của trình duyệt ([crop-a](../../../docs/research/art-direction/current/crop-a-details-actionbar.jpg))
Trước (`styles.css:3796-3804`): `.node-details-actionbar button` đặt cỡ và màu chữ nhưng không reset `background`, `border`; Chrome vẽ nền ButtonFace `rgb(107, 107, 107)` (R1 P1-3).
Sau: mọi nút thuộc một trong bốn cấp. Action bar là quiet icon-only Compact; nút xoá trong bar vẫn quiet, xác nhận xoá mới là danger (S:575).
```css
.node-details-actionbar button { appearance: none; border: 1px solid transparent; background: transparent;
  width: 26px; height: 26px; border-radius: var(--radius-2); color: var(--text-soft); font: inherit; }
```

### C. Mép dưới canvas: hai họ icon, tool chọn tô teal ([crop-f](../../../docs/research/art-direction/current/crop-f-bottom-chrome.jpg))
Trước (`styles.css:4904-4908`): hover **và** đang chọn cùng một ô teal, nên không phân biệt được "đang trỏ" với "đang dùng"; rail là phosphor, zoom là Lucide, đặt sát nhau (R1 P1-3).
```css
.canvas-tool-rail button:hover, .canvas-tool-rail button.is-active { background: var(--glass-active); color: var(--accent-strong); }
```
Sau: hover là patch và nhặt sticker lên; đang chọn là chip mực; rail và zoom cùng họ icon vẽ riêng.
```css
.canvas-tool-rail button:hover { background: var(--glass-hover); }
.canvas-tool-rail button:hover .ico { transform: translateY(-3px) rotate(-4deg); }
.canvas-tool-rail button[aria-pressed="true"] { background: var(--ink-sel);
  box-shadow: 0 1px 0 rgb(0 0 0 / .35), 0 4px 10px -4px rgb(0 0 0 / .5); }
```

## 10. Trước khi báo xong

- [ ] Đếm nút primary **đang hiển thị** trong mỗi view: tối đa 1.
- [ ] 0 control mang teal ở nền, viền, chữ (trừ focus outline và trạng thái).
- [ ] Mỗi cấp, mỗi trạng thái, dark và light: chụp lại và đo theo §8; 0 ô dưới ngưỡng; ghi số thấp nhất và SHA.
- [ ] Mọi `<button>` đã reset nền và viền; không còn nền xám mặc định.
- [ ] `font-size` là token, nhãn weight 560; không em dash.
- [ ] Reduced motion đã kiểm.
- [ ] Đụng `main.tsx`, `styles.css` hoặc `lib.rs`: chạy `node scripts/graphify-lite.mjs --strict` trong worktree, exit khác 2.
- [ ] `.secondary-button` chưa tồn tại ở `a00af07`: nếu thêm cấp mới, cập nhật danh sách class trong `description` của skill này.

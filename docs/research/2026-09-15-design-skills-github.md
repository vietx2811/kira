# Nghiên cứu: skill thiết kế trên GitHub cho KIRA (thay design-taste-frontend?)

- **Câu hỏi (user, qua Orchestrator):** Hệ control mà Art Director đề xuất "quá thiếu cảm xúc, AI slop". User muốn icon hơi skeuomorphic (nhất là thanh công cụ kiểu Figma) và nút chính/phụ phân biệt rõ. Có skill nào trên GitHub hợp hơn `design-taste-frontend` không, và nên bỏ hay giữ nó?
- **Người yêu cầu:** User, giao qua Orchestrator (2026-09-15)
- **Commit đã kiểm chứng:** vixio `b36c6e9` (branch `researcher/design-skills`). Mọi repo đọc qua GitHub API và `raw.githubusercontent.com` ngày 2026-09-14 (giờ máy), **không clone, không cài, không chạy**. SHA commit của các repo khuyến nghị ghi ở §4.
- **Đang dùng:** impeccable v4.3.1 (sàn chất lượng), design-taste-frontend (núm 3/3/6), color-expert. Thứ tự ưu tiên hiện tại trong CLAUDE.md: `DESIGN.md` > impeccable > design-taste-frontend.
- **Kết luận ngắn:**
  1. **Bỏ `design-taste-frontend`.** Bản đang cài là v1 (Next.js, Tailwind 90%, Framer Motion, cấm Inter). Bản mới nhất của chính tác giả tự khoanh phạm vi: *"Landing pages, portfolios, and redesigns. Not dashboards, not data tables, not multi-step product UI."* Núm 3/3/6 chỉ là vá cho một công cụ sai loại.
  2. **Thay bằng 3 skill, mỗi cái một vai hẹp:**
     - **`apple-design`** (dickwu): nguồn HIG nguyên văn cho macOS, gồm buttons, toolbars, icons, SF Symbols, Liquid Glass có hướng dẫn riêng cho Tauri.
     - **`refactoring-ui`** (s0xDk): kỹ thuật cụ thể cho nút có cảm giác vật lý (nổi/lõm theo nguồn sáng, bóng hai lớp, phân cấp bằng weight và màu).
     - **`emil-design-eng`** (Emil Kowalski): cảm giác nhấn, popover, tooltip, motion vi mô.
  3. **Không có skill nào đủ tốt cho icon hơi skeuomorphic và toolbar kiểu Figma.** Các skill "skeuomorphism" và "neumorphism" trong danh sách awesome là file sinh từ template, sai cả tên thương hiệu. Đề xuất **tự viết skill nội bộ `kira-controls`** (nội dung ở §5).
  4. Không skill nào khuyến nghị có `scripts/` phải chạy khi dùng. Chỉ `apple-design` có một script tải lại HIG, không cần dùng.

Nhãn nguồn: **[đọc]** = đã đọc file thật trong repo, **[meta]** = GitHub API, **[suy luận]**.

---

## 1. Bỏ hay giữ `design-taste-frontend`: **bỏ**

| Bằng chứng | Nguồn |
|---|---|
| Bản trên máy (`~/.claude/skills/design-taste-frontend/SKILL.md`, 226 dòng) là **v1**: "Default to Server Components (RSC)", "Use Tailwind CSS (v3/v4) for 90% of styling", icon bắt buộc `@phosphor-icons/react` hoặc `@radix-ui/react-icons`, "NO Inter Font: Banned", Bento 2.0 với "Every card must contain Perpetual Micro-Interactions" | [đọc] file cục bộ |
| Bản upstream hiện tại (v2 experimental, 1.206 dòng): *"Landing pages, portfolios, and redesigns. Not dashboards, not data tables, not multi-step product UI."* §13 OUT OF SCOPE liệt kê *"Dashboards / dense product UI / admin panels"*, và yêu cầu agent *"say so explicitly, point to the right tool"* | [đọc] `Leonxlnx/taste-skill@ccbc15639c97`, `skills/taste-skill/SKILL.md` dòng 1-9, 896-909 |
| CHANGELOG: v2 là "pre-release", *"The API (install name, dial names, section structure) will stabilize at v2.0.0 stable"* | [đọc] `CHANGELOG.md` dòng 11-20 |
| KIRA là React + Vite + **CSS thuần**, font hệ thống (`--font-sans: -apple-system…`). Skill v1 ép Tailwind, Framer Motion và font thương mại (Geist/Satoshi) | [code] `apps/desktop/package.json`, `styles.css` |

Phần có ích của nó (nhấn `:active`, không đen tuyền, bóng ngả theo màu nền, đủ trạng thái loading/empty/error) đã có trong `emil-design-eng`, `refactoring-ui` và `impeccable`, nêu rõ hơn. Giữ nó thì mỗi lượt vẫn nạp khoảng 226 dòng quy tắc marketing mà KIRA phải chủ động bỏ qua [suy luận].

---

## 2. Bảng đánh giá

Ba nhu cầu của user: **(C)** cảm xúc/cá tính không slop · **(B)** nút phân cấp rõ, có cảm giác vật lý · **(I)** icon/toolbar hơi skeuomorphic.

| Skill (repo @ commit) | Nội dung thật [đọc] | C | B | I | Đá với impeccable | License · sao · cập nhật [meta] | An toàn [đọc] | Kết luận |
|---|---|---|---|---|---|---|---|---|
| **apple-design** (`dickwu/apple-design-skill` @ `da2da6dd03aa`) | 122 trang HIG **nguyên văn** kéo từ developer.apple.com ngày 2026-09-09, gồm `buttons.md`, `toolbars.md`, `icons.md`, `sf-symbols.md`, `materials.md`, `designing-for-macos.md`; thêm `liquid-glass.md` tự biên soạn có mục **"Tauri and Electron"**. Quy trình review 5 lăng kính, bắt buộc trích file và heading, nạp 8-12 file mỗi lần. Dùng được cho Tauri và AppKit | Trung bình | **Cao** (HIG buttons, cỡ, prominence) | **Cao** (toolbars, SF Symbols) | Trùng vai review. Giải: dùng làm *nguồn chuẩn nền tảng*, impeccable vẫn là sàn | **Không có file LICENSE**; README: nội dung HIG *"belongs to Apple Inc."*, skill *"provided as they are; use them at your own discretion"* · 553 sao · 2026-09-09 | Có `scripts/pull-hig.mjs` tải HIG từ apple.com, SKILL.md ghi *"Not needed for reviews"*. Không lệnh nào khác | **DÙNG**, cài cấp user, **không đưa vào repo** (không có license) |
| **refactoring-ui** (`s0xDk/refactoring-ui-skill` @ `48872143abb0`) | Hệ scale (spacing, type, weight, màu, **5 mức bóng**, radius), quy trình, "hierarchy through weight and color", 12 luật cứng. `references/techniques.md`: **Emulating a light source** (công thức nổi và lõm cho mặt tối và mặt sáng), **Two-part shadows** (cast + contact), Depth without shadows, Break the default component shape | Trung bình | **Rất cao** | Thấp | Đá **ở scale**: skill tự đặt spacing base 16 và thang riêng, KIRA đã có token. Giải: chỉ lấy *kỹ thuật*, không lấy *hệ scale* | MIT (s13k) · 550 sao · 2026-08-26 | Không script. README hướng dẫn `git clone` vào `~/.claude/skills` | **DÙNG**, kèm luật "DESIGN.md thắng về scale" |
| **emil-design-eng** (`emilkowalski/skills` @ `d23d7f88a2e2`) | 674 dòng: khung quyết định animation (có nên, mục đích, easing, thời lượng), spring, **"Buttons must feel responsive"** (`scale(0.97)` khi `:active`), không bao giờ scale từ 0, **popover theo gốc trigger**, tooltip bỏ delay ở lần hover sau, `@starting-style`, clip-path, gesture và drag, hiệu năng, reduced motion, checklist review | **Cao** (phần "cảm" khi dùng) | Cao (phản hồi nhấn) | Thấp | Đá nhẹ: khuyên spring cho tương tác, trong khi detector impeccable từng báo spring/bounce easing là lỗi. Giải: spring chỉ cho kéo, thả, gesture trên canvas; control dùng ease-out | MIT · 37,6k sao · 2026-08-21 | Không script, không lệnh. Dòng đầu tự quảng cáo khoá học animations.dev (vô hại) | **DÙNG**, chỉ lấy thư mục `emil-design-eng` |
| apple-design (**emilkowalski**) | Nguyên lý WWDC "Designing Fluid Interfaces" dịch sang web: response, interruptibility, spring, momentum, **§12 Materials & depth**, typography | Cao | Trung bình | Thấp | Như trên | MIT | Sạch | **KHÔNG cài cùng lúc**: **trùng tên `apple-design`** với skill của dickwu. Nếu phải chọn, dickwu hợp macOS desktop hơn |
| interface-design (`Dammyjay93/interface-design`) | Product UI (dashboard, tool). Intent-first, product domain, "one focal point per view", type ratio, weight hơn size, subtle layering, "depth: choose ONE and commit", công thức bóng sáng/tối. Ghi nhớ quyết định vào **`.interface-design/system.md`** | Cao | Trung bình | Thấp | **Đá nặng**: trùng vai impeccable, và lập **nguồn sự thật thứ hai** cạnh DESIGN.md. *"No two interfaces should look the same"* dễ bị hiểu thành đổi phong cách từng màn | MIT · 5,7k sao · 2026-06-20 | `.githooks/pre-commit` chỉ tăng số version cho maintainer, không chạy khi dùng skill | **THAM KHẢO**, không cài |
| baseline-ui (`ibelick/ui-skills`) | *"MUST use Tailwind CSS defaults"*, `motion/react`, `tw-animate-css`, `cn` (clsx + tailwind-merge) | Thấp | Thấp | Thấp | Đá với stack KIRA | MIT · 8,4k sao | Sạch | **LOẠI** (ép Tailwind) |
| improve-ui (`ibelick/ui-skills`) | Audit chỉ đọc, dựa trên bằng chứng, viết plan cho agent khác, không sửa source | Thấp | — | — | Trùng `impeccable critique` | MIT | Sạch | **LOẠI** (trùng vai) |
| web-design-guidelines (`vercel-labs/agent-skills`) | *"Fetch fresh guidelines before each review"* từ `raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`; *"The fetched content contains all the rules and output format instructions"* | Thấp | Thấp | — | Checklist, không đá | Không có license trên repo [meta] | **Nạp chỉ dẫn từ mạng mỗi lần chạy**: nếu URL bị đổi nội dung thì là đường prompt injection | **LOẠI** theo tiêu chí an toàn |
| ui-ux-pro-max (`nextlevelbuilder/ui-ux-pro-max-skill`) | Tra CSV: 84 style, 192 palette, 74 cặp font, 22 stack; mỗi lần dùng chạy `python scripts/search.py` | Thấp | Thấp | Thấp | Đá: chọn style theo từ khoá, ngược "một thế giới nhất quán" | MIT · 127,6k sao · 2026-09-10 | Script Python chỉ đọc CSV cục bộ, không thấy gọi mạng; `--persist` ghi file design system | **LOẠI** (máy xổ số phong cách) |
| frontend-design (`anthropics/skills`) | Hướng thiết kế cá tính cho trang, hero, typography; liệt kê các "tell" của AI (nền kem + serif + terracotta…) | Cao | Thấp | Thấp | impeccable vốn phát triển từ hướng này; trùng | Apache-2.0 · 176k sao · 2026-09-10 | Sạch | **LOẠI** (web page, trùng) |
| skeumorphism, neumorphism, levels (`bergside/awesome-design-skills`) | File sinh từ template typeui.sh: "Neumorphism **club** Design System Skill… Join the private club…", font `Germania One`, token `#FA3C00`, luật chung chung | Thấp | Thấp | Thấp | — | MIT · 2,8k sao · 2026-06-28 | Sạch | **LOẠI** (chất lượng rỗng) |
| icon-design (`ArnavPuri/designskills`) | SVG icon system cho web: grid 24, live area, optical alignment, outline/filled/duotone, animation, a11y | Thấp | — | Trung bình (không có gì về skeuomorphic hay toolbar) | Không | MIT · **6 sao** · 2026-08-21 | Sạch | **THAM KHẢO**, lấy vài mục vào skill nội bộ |
| design-taste-frontend (`Leonxlnx/taste-skill`) | Xem §1 | Cao (web) | Thấp | Thấp | Đá (stack, phạm vi) | MIT · 87k sao · 2026-08-24 | Phụ lục v2 có nhiều lệnh `npm install` cho design system | **BỎ** |

Đã đọc thêm, không đưa vào bảng vì lệch mục tiêu: `create-design-md` (ibelick, chạy `npx @google/design.md`), các skill animate/prototype/pick-ui-library/ask-sonner của Emil, theme-factory và canvas-design của Anthropic.

---

## 3. Top 3 khuyến nghị: dùng cho việc gì trong đội

| Skill | Art Director | UI/UX | Worker | Gọi khi |
|---|---|---|---|---|
| **apple-design** (dickwu) | Kiểm hướng control và toolbar với HIG macOS; trích `buttons.md › Style`, `toolbars.md` | Rà cỡ nút, prominence, toolbar grouping, Liquid Glass trước khi viết vào DESIGN.md | Không cần | Câu hỏi "trên macOS thì đúng là gì" |
| **refactoring-ui** | Dựng specimen nút nổi/lõm, bóng hai lớp, primary/secondary/quiet | Công thức `box-shadow` cho từng trạng thái, sáng và tối | Áp theo spec | Khi thiết kế bề mặt, độ sâu, phân cấp |
| **emil-design-eng** | Duyệt "cảm giác" (nhấn, popover, tooltip) | Motion vi mô, `:active`, origin popover, reduced motion | Review animation trước khi báo xong | Khi code tương tác và motion |

**Thứ tự ưu tiên đề xuất** (thay dòng trong CLAUDE.md, Orchestrator quyết):

`DESIGN.md` > `kira-controls` (nội bộ, §5) > impeccable > apple-design > refactoring-ui (chỉ kỹ thuật) > emil-design-eng (chỉ motion)

---

## 4. Cách cài (để user duyệt, chưa làm)

**Khuyến nghị cài thủ công, ghim commit, cấp user** (`~/.claude/skills/`), để mọi session và worktree trên máy đều thấy. **Không** dùng `npx skills add` vì nó tải và chạy một CLI từ npm lúc cài [suy luận].

```bash
tmp="$(mktemp -d)"

git clone https://github.com/dickwu/apple-design-skill "$tmp/apple" && git -C "$tmp/apple" checkout da2da6dd03aa
mkdir -p ~/.claude/skills/apple-design && cp -R "$tmp/apple/SKILL.md" "$tmp/apple/references" ~/.claude/skills/apple-design/

git clone https://github.com/s0xDk/refactoring-ui-skill "$tmp/rui" && git -C "$tmp/rui" checkout 48872143abb0
mkdir -p ~/.claude/skills/refactoring-ui && cp -R "$tmp/rui/SKILL.md" "$tmp/rui/references" "$tmp/rui/assets" "$tmp/rui/LICENSE" ~/.claude/skills/refactoring-ui/

git clone https://github.com/emilkowalski/skills "$tmp/emil" && git -C "$tmp/emil" checkout d23d7f88a2e2
cp -R "$tmp/emil/skills/emil-design-eng" ~/.claude/skills/emil-design-eng && cp "$tmp/emil/LICENSE" ~/.claude/skills/emil-design-eng/

mkdir -p ~/.claude/skills-disabled && mv ~/.claude/skills/design-taste-frontend ~/.claude/skills-disabled/
```

Ghi chú:
- **Không chép `scripts/` của apple-design.** Chỉ chép `SKILL.md` + `references/`.
- **Tên thư mục phải trùng `name` trong frontmatter** (spec Agent Skills): `apple-design`, `refactoring-ui`, `emil-design-eng`.
- Bước cuối là **chuyển chỗ chứ không xoá** design-taste-frontend, để lấy lại được. Sau đó Orchestrator sửa mục design trong CLAUDE.md.
- Không cài `apple-design` của Emil để tránh trùng tên.

---

## 5. Mảng icon và tactile: không có skill đủ tốt → tự viết `kira-controls`

**Nhận định:** không skill nào trên GitHub đọc được mà cùng lúc (1) nói về toolbar canvas kiểu Figma, (2) nói về icon hơi skeuomorphic, (3) nằm trong khung token và a11y của một app đã có DESIGN.md. Hai skill gần nhất là template rỗng (bergside) hoặc icon system chung cho web (ArnavPuri, 6 sao).

**Đề xuất:** một skill nội bộ nhỏ ở **cấp project** `.claude/skills/kira-controls/SKILL.md`, commit vào repo để mọi worktree đều nạp. Mục tiêu dưới 300 dòng, kèm `references/` khi cần. Người viết: Art Director hoặc UI/UX, dựa trên specimen đã đo trong `docs/research/2026-09-14-art-direction.md`.

**Nội dung chính cần có:**

1. **Phạm vi và thứ bậc nguồn:** chỉ cho control, toolbar, icon; mọi giá trị lấy từ token trong `styles.css`; DESIGN.md thắng khi mâu thuẫn.
2. **Ba cấp nút có vật liệu khác nhau** (không chỉ khác màu):

   | Cấp | Vật liệu | Nghỉ | Hover | Nhấn |
   |---|---|---|---|---|
   | **Primary** | Nổi, mặt màu accent | Mép trên sáng + bóng tiếp xúc | Sáng mặt thêm một nấc | Chuyển sang lõm: mép dưới sáng, bóng trên, `scale(0.98)` |
   | **Secondary** | Nổi, mặt trung tính | Như trên, độ tương phản thấp hơn | Như trên | Như trên |
   | **Quiet** | Phẳng | Không nền | Nền trong mờ nhẹ | Lõm nhẹ |

   Kèm luật: **một phương ngữ hover duy nhất**, hover không bao giờ đảo sang nền accent đặc (đúng lỗi P1 đã đo). Công thức `box-shadow` cho dark và light theo kỹ thuật nguồn sáng của refactoring-ui, bóng hai lớp, blur nhỏ, chọn màu mép bằng tay thay vì phủ trắng.
3. **Cỡ:** hai cỡ, chiều cao cố định, radius cố định theo cỡ; kiểm lại theo hướng Tahoe (cỡ lớn dạng capsule) bằng `apple-design › buttons.md`.
4. **Toolbar kiểu Figma UI3:** thanh nổi ở đáy canvas; các nhóm công cụ **chung một tấm nền** (plate), ngăn bằng khoảng cách chứ không bằng viền. Công cụ đang chọn là **giếng lõm** (inset well) trong tấm nền, không phải khối accent đặc. Tooltip có tên và phím tắt, bỏ delay ở lần hover sau (emil). Không chồng glass lên glass.
5. **Icon "hơi skeuomorphic" có kiểm soát:**
   - **Một bộ icon duy nhất**; chốt lucide hay phosphor (hiện dùng cả hai).
   - Lưới 20 hoặc 16, stroke cố định, căn chỉnh quang học.
   - Cảm giác vật lý đến từ **tấm nền của nút** (mép sáng, giếng lõm), không vẽ gradient hay bóng lên chính glyph.
   - Tuỳ chọn duotone nhẹ (`currentColor` + một lớp fill độ mờ thấp) **chỉ** cho icon công cụ canvas, không cho icon trong settings hay list.
   - Cấm: gradient trên glyph, bóng đổ trên glyph, icon 3D, emoji.
6. **Motion:** nhấn 100-160ms ease-out; popover mở từ gốc trigger; không spring cho control (spring chỉ cho kéo thả trên canvas); đầy đủ `prefers-reduced-motion`.
7. **Glass:** trỏ sang `apple-design › liquid-glass.md` mục Tauri và luật đã chốt trong DESIGN.md; đọc Reduce Transparency qua native (`NSWorkspace accessibilityDisplayShouldReduceTransparency`) như tài liệu đó chỉ.
8. **Ngưỡng và cách kiểm:** chữ ≥ 4.5:1, viền focus và non-text ≥ 3:1, đo trên **nền xấu nhất** (ảnh dưới toolbar); chạy `node scripts/graphify-lite.mjs --strict`; chụp lại specimen sáng/tối làm ảnh chuẩn.
9. **Ví dụ trước/sau:** 3 cặp lấy từ ảnh crop đã có trong `docs/research/art-direction/current/` (hover đảo teal, nút xám mặc định trình duyệt, hai bộ icon ở mép dưới canvas).

---

## 6. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| **Tốn context:** mô tả của `apple-design` rất rộng ("review my design", "is this good UI") nên dễ tự kích hoạt và nạp 8-12 file HIG | Ghi vào CLAUDE.md khi nào gọi; chỉ gọi tường minh cho câu hỏi nền tảng macOS |
| **apple-design không có license**, nội dung là văn bản của Apple | Chỉ dùng nội bộ, không commit vào repo KIRA, không phân phối |
| **refactoring-ui kéo scale riêng** (spacing base 16, 5 mức bóng) vào code | Luật thứ bậc ở §3; chỉ lấy kỹ thuật |
| **emil-design-eng khuyên spring**, chọi với detector impeccable | Luật ở §5.6 |
| **Skill upstream đổi nội dung** (taste-skill đã đổi hẳn từ v1 sang v2) | Ghim commit SHA khi cài; cập nhật có chủ đích |
| **Tự viết `kira-controls` có thể lại thành slop** nếu viết chung chung | Viết từ số đo thật của specimen, kèm ví dụ trước/sau bằng ảnh của chính KIRA |

## 7. Giới hạn

- Không cài, không chạy skill nào; chưa kiểm hành vi tự kích hoạt thực tế trong Claude Code.
- Nội dung đọc từ nhánh `main` tại các SHA ở §4. Với emil và taste-skill chỉ đọc một phần file dài (đã ghi phần đã đọc); `interface-design` đọc toàn bộ SKILL.md và hook, không đọc website.
- Số sao lấy từ GitHub API; số lượt cài trên skills.sh chỉ thấy qua nguồn phụ nên không dùng làm tiêu chí.
- Chưa tìm được skill nào đã được chính Figma phát hành cho toolbar hay icon. Các skill `figma:*` trong phiên phục vụ đọc/ghi file Figma, không dạy thiết kế control.

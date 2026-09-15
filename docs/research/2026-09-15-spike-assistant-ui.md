# Spike: assistant-ui cho tab Chat panel phải (D11)

- **Câu hỏi:** D11 đã chốt dùng **assistant-ui** primitives cho tab Chat (`docs/research/2026-09-13-right-panel-harness-oss.md` §2.1, spike 1 ở §6). Spike này trả lời: có dựng được trên CSS thuần của KIRA (không Tailwind, không shadcn), với `ExternalStoreRuntime` lấy model AiThread/AiMessage/AiRun làm nguồn sự thật, đủ tính năng cho mockup, và chi phí bundle/accessibility ra sao — trước khi UI/UX và Worker hiện thực hoá panel thật.
- **Người yêu cầu:** Orchestrator (brief spike agent), theo D11 và kế hoạch spike ở báo cáo OSS §6 mục 1.
- **Commit đã kiểm chứng:** vixio `50675db` (nhánh `worktree-agent-aae735d3df01dd7f7`, base `main`). Version, license, kích thước bundle đo trực tiếp trong worktree ngày 2026-09-15 (npm registry + `npx vite build` thật, không suy luận từ tài liệu).
- **Kết luận ngắn:** **GO with caveats.**
  1. `@assistant-ui/react@0.15.19`, MIT, cài thật và build được, không kéo Tailwind hay CSS nào — 100% style bằng CSS của KIRA.
  2. `useExternalStoreRuntime` nhận đúng mảng message tự quản lý (ở đây là `useState`, tương đương zustand) làm nguồn sự thật; `onNew` là điểm duy nhất gọi ra ngoài (thay bằng `invoke('generate_ai_text')` sau này) — thư viện không tự chạm mạng.
  3. Đủ nguyên liệu cho danh sách tính năng cần (thread messages, run-detail dưới câu trả lời AI, composer, thông báo lỗi trong thread) nhưng **hầu hết là tự viết trên nền primitives trơ**, không có sẵn "run detail row" hay "context chip" — đúng như báo cáo OSS đã lường trước.
  4. **Caveat chính: chi phí bundle không nhỏ** — thêm khoảng **296 KB raw / 88 KB gzip** JS so với baseline React-only (đo thật, xem §5). Đây là gói `react` primitives phiên bản 0.15.x (nặng hơn nhiều so với ấn tượng "primitives nhẹ" trong báo cáo OSS viết ngày 2026-09-13, có lẽ do gói đã lớn lên qua các bản phát hành giữa 09-13 và hôm nay).
  5. Không phát hiện license, Node-only API hay lỗi build chặn. 2 bug thật phát hiện trong lúc dựng spike — cả hai đều do code của spike, không phải lỗi thư viện — đã sửa, ghi ở §7.

Nhãn nguồn như báo cáo chính: **[code]**, **[ngoài]**, **[ngoài-phụ]**, **[suy luận]**.

---

## 1. Package, version, license

- `npm view @assistant-ui/react version license peerDependencies dependencies` (2026-09-15): **version `0.15.19`, license `MIT`** [ngoài]. `LICENSE` file trong package xác nhận `MIT License, Copyright (c) 2025 AgentbaseAI Inc.` [code: `node_modules/.pnpm/@assistant-ui+react@0.15.19.../@assistant-ui/react/LICENSE`].
- `peerDependencies`: `react: "^18 || ^19"`, `react-dom: "^18 || ^19"` — khớp `apps/desktop/package.json` đang dùng `react@^19.2.1` [code: `apps/desktop/package.json:33,35`].
- Dependencies trực tiếp, tất cả MIT (kiểm từng gói bằng `npm view <pkg> license`): `zod@4.6.5`, `zustand@5.0.15` (bản riêng của thư viện, không đụng `zustand@5.0.14` KIRA đang dùng), `radix-ui@1.6.7`, `assistant-cloud@0.2.0`, `assistant-stream@0.3.42`, `@assistant-ui/tap@0.9.17`, `@assistant-ui/core@0.3.18`, `safe-content-frame@0.0.30`, `@assistant-ui/store@0.3.13`, `react-textarea-autosize@8.5.9` [ngoài].
- Đã `pnpm --filter @kira/desktop add @assistant-ui/react@0.15.19` thật trong worktree (không chỉ symlink) — `pnpm-lock.yaml` và `apps/desktop/package.json` có diff, giữ trên nhánh:
  ```
  +    "@assistant-ui/react": "0.15.19",
  ```
  [code: `apps/desktop/package.json` diff, xem `git show` trên commit của nhánh này].
- Lưu ý cho quyết định D11 gốc: gói ở version 0.15.x đã có kiến trúc khác hẳn mô tả trong báo cáo OSS 09-13 (`ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive` gọn) — bản thật kéo theo lớp "Aui"/`tap`/`store` runtime mới, MCP apps, generative UI, voice, interactables… phần lớn nằm dưới thư mục `legacy-runtime` cho API `useExternalStoreRuntime` [code: `.../@assistant-ui/react/src/legacy-runtime/runtime-cores/external-store/`]. Thư viện phát triển nhanh đúng như rủi ro đã ghi ở báo cáo OSS §4 ("Tốc độ đổi API… assistant-ui kéo nhiều dependency hoặc giả định không lường trước").

## 2. CSS: có dựng bằng CSS của KIRA, không Tailwind/shadcn không?

- **Có.** Toàn bộ `apps/desktop/src/kira/spike/chatSpike.css` là CSS thuần (~200 dòng), class tự đặt tiền tố `spike-`, không có class Tailwind (`flex`, `px-2`…) hay biến shadcn nào.
- Import graph: `package.json` của `@assistant-ui/react` chỉ export một entry `"."` trỏ `./dist/index.js`, không có subpath CSS nào để import [code: `.../@assistant-ui/react/package.json` — `"exports": {".": {...}}`]. Gói khai `"sideEffects": false`.
- Quét toàn bộ `node_modules` của 9 gói mà `@assistant-ui/react` kéo về (`find ... -iname "*.css"`): **0 file CSS**. Không có Tailwind config, không `tailwind.config.*`, không thẻ `<link>` hay `import '...css'` nào trong dist của thư viện.
- Bằng chứng runtime: build production (`npx vite build`, xem §5) ra đúng **một file CSS** cho trang spike (`spike-chat-*.css`, 2.91 KB raw / 0.99 KB gzip) — chính là `chatSpike.css` do spike tự viết, không có gì khác trộn vào.
- README/từ khoá npm của gói liệt kê "tailwind", "shadcn" trong keyword tìm kiếm (để SEO hướng dẫn dùng shadcn registry) nhưng đó là ví dụ trong docs, không phải yêu cầu runtime — primitives không đọc `class` mặc định nào, mọi `className` do mình truyền vào render ra y nguyên [code: xác nhận qua `createActionButton.js`, `MessageRoot.d.ts`… mọi component nhận `ComponentPropsWithoutRef` chuẩn HTML].

## 3. `ExternalStoreRuntime`: state của KIRA làm nguồn sự thật, `onNew` tự chủ

- Hook đúng tên hiện tại là `useExternalStoreRuntime` (không đổi tên so với báo cáo OSS), nằm trong `@assistant-ui/react` (re-export từ `@assistant-ui/core`) [code: export list `index.d.ts` dòng 82].
- Kiểu `ExternalStoreAdapter<T>` [code: `@assistant-ui/core/dist/runtimes/external-store/external-store-adapter.d.ts`] nhận thẳng:
  - `messages: readonly T[]` — spike truyền `AiMessage[]` (kiểu thật từ `apps/desktop/src/kira/aiPanelTypes.ts`, không phải kiểu giả) đã `.map(toThreadMessageLike)`.
  - `isRunning?: boolean` — spike tính từ `AiRun.status === 'running'`.
  - `onNew: (message: AppendMessage) => Promise<void>` — **điểm duy nhất** thư viện gọi ra ngoài. Trong spike, `onNew` đọc text từ `AppendMessage.content`, đẩy vào `useState<AiMessage[]>` / `useState<AiRun[]>` (đứng vai zustand — cùng interface `setState`), rồi gọi `simulateGenerate()` — một `setTimeout` giả lập, có chú thích rõ vị trí sẽ thay bằng `invoke('generate_ai_text', {...})` [code: `apps/desktop/src/kira/spike/ChatSpike.tsx` — comment `// Stand-in for: const result = await invoke(...)`].
  - Xác nhận bằng test hành vi thật (không chỉ đọc code): gửi tin nhắn qua composer → `AiMessage` mới xuất hiện trong `messages` state của **chính component**, ExternalStoreRuntime chỉ phản chiếu lại — tắt hẳn devtools React cũng thấy state cập nhật trước khi UI vẽ lại (xem §6 test log).
  - Thư viện không tự mở kết nối mạng, không đọc biến môi trường provider, không có UI nhập API key ở đâu trong `ExternalStoreAdapterBase` — đúng yêu cầu "no network, no vendor backend, no API key handling inside the library".
- `convertMessage` (đổi `AiMessage` → `ThreadMessageLike`) map `role: 'system-error'` (kiểu domain của KIRA) sang `role: 'system'` (kiểu của assistant-ui) — 3 role gốc của thư viện (`user`/`assistant`/`system`) đủ cho 3 role của KIRA.

## 4. Tính năng cần từ mockup: primitives lo, phần tự viết

| Tính năng (mockup `docs/design/right-panel/mockup.js`) | Assistant-ui lo | Tự viết trong spike |
|---|---|---|
| Danh sách thread (chuyển thread, lọc) | Không — `ThreadListPrimitive`/`RemoteThreadList` giả định model thread-list riêng của thư viện, lệch model `AiThread` của KIRA | Toàn bộ (spike chưa dựng phần này — ngoài phạm vi 4 câu hỏi bắt buộc, xem §8) |
| Danh sách tin nhắn, tự cuộn | `ThreadPrimitive.Root` + `.Viewport` + `.Messages` (render-prop `{({message}) => ...}`) quản lý state, giữ vị trí cuộn | Style, layout, phân role (user/assistant/system) |
| Run-detail dưới câu trả lời AI ("Chi tiết run") | Không có khái niệm "run" — đây là domain KIRA | Toàn bộ `RunDetailRow` (component ~40 dòng, tự tra cứu `AiRun` theo `message.id` → `AiMessage.runId`, `<details>`-style disclosure) |
| Context chip dưới tin nhắn user | Không có "context chip" sẵn | Tự render từ `AiMessage.contextNodes` |
| Composer + nút Gửi | `ComposerPrimitive.Root/Input/Send` — auto-resize (dùng `react-textarea-autosize` có sẵn), Enter-to-submit, disable khi rỗng hoặc đang chạy | Chỉ style + `aria-label` |
| Thông báo lỗi trong thread | Có `MessagePrimitive.Error`/`ErrorPrimitive` cho lỗi *của message*, nhưng lỗi provider ở đây là **một message riêng** (role hệ thống) theo đúng model `AiMessage.role === 'system-error'` đã chốt | Map role `system-error` → `system`, tự render khối "Lỗi" + nút "Thử lại" |
| "Ngữ cảnh: N node" dưới composer | Không có | Dòng tĩnh tự viết, đọc từ context chip cố định |

Kết luận mục này khớp báo cáo OSS: **primitives lo state/hành vi (scroll, focus, disable, submit), KIRA tự vẽ 100% giao diện và toàn bộ khái niệm domain (run, changeset, provenance)** — không có "run detail row" hay "context chip" đóng gói sẵn nào bị bỏ phí khi tự viết.

## 5. Bundle cost

Đo bằng `npx vite build` thật (không ước lượng), dùng đúng `apps/desktop/vite.config.ts` (qua `mergeConfig`, chỉ đổi `rollupOptions.input`/`outDir`; `target: safari13`, `minify: esbuild` — giống production thật vì `TAURI_ENV_DEBUG` không set):

| Entry | Modules | JS raw | JS gzip | CSS raw | CSS gzip |
|---|---|---|---|---|---|
| Baseline (`_baseline-main.tsx`: React 19 + ReactDOM, **không** import assistant-ui) | 27 | 193.42 KB | 60.75 KB | — | — |
| `spike-chat.html` (thêm `@assistant-ui/react` + `ChatSpike.tsx`) | 727 | 489.82 KB | 148.66 KB | 2.91 KB | 0.99 KB |
| **Delta (chi phí riêng của assistant-ui + phụ thuộc)** | +700 | **+296.40 KB** | **+87.91 KB** | +2.91 KB (100% CSS của spike, xem §2) | +0.99 KB |

Baseline dựng để cô lập chi phí — cả hai entry đều phải gánh React/ReactDOM (đã có sẵn trong `main.tsx` thật), nên delta ở trên là đúng phần assistant-ui cộng thêm, không lẫn chi phí React.

Diễn giải:
- 87,91 KB gzip **không nhỏ** cho một tab chat — nặng hơn ấn tượng "primitives nhẹ" của báo cáo OSS 09-13. Nguyên nhân nhiều khả năng: package đã lớn thêm giữa 09-13 và hôm nay (thêm MCP apps, generative UI, voice, interactables — xem §1), và `@assistant-ui/core` dường như không tree-shake hết phần không dùng dù `sideEffects: false` (spike chỉ dùng 4 primitive nhóm: Thread/Message/Composer/ExternalStoreRuntime nhưng kéo theo cả tool-call, branch-picker, MCP, attachment, voice runtime).
- Vì KIRA là app Tauri desktop đóng gói local (không tải qua mạng mỗi lần mở), chi phí này gần với chi phí **parse/khởi tạo JS lúc mở app** hơn là chi phí băng thông — nhẹ hơn tác động trên web, nhưng vẫn cộng dồn vào `main.tsx` vốn đã 18k dòng.
- **Rủi ro thật, không suy luận:** con số 87,91 KB gzip là điều Orchestrator/User cần cân nhắc lại so với phương án "tự viết list tin nhắn" (fallback đã ghi sẵn trong báo cáo OSS §4, dòng "assistant-ui... nếu nặng, tự viết list tin nhắn (phần dễ nhất)").

Peer deps: `react@^19.2.1`/`react-dom@^19.2.1` hiện tại của KIRA thoả `^18 || ^19` — không cần hạ cấp. Không có API Node-only: `npx vite build` production (target `safari13`) build sạch, không cảnh báo "externalized for browser compatibility"; quét thủ công `grep -rl "from 'node:" dist/` trên cả `@assistant-ui/core` và `@assistant-ui/react` ra **0 kết quả**.

## 6. Accessibility

- **Submit bằng bàn phím:** `ComposerPrimitive.Input` mặc định `submitMode="enter"` (Enter gửi, Shift+Enter xuống dòng), có `cancelOnEscape`, tự bỏ qua khi `e.isComposing` (đang gõ IME) [code: `ComposerInput.js` dòng 65, 82]. Xác nhận bằng dispatch `KeyboardEvent('keydown', {key:'Enter'})` thật trên textarea đang có nội dung → composer gửi và tự xoá nội dung (xem log test §7).
- **Focus management:** input tự focus lại sau khi tạo run mới, sau khi cuộn xuống đáy, và khi đổi thread (`unstable_focusOnRunStart`/`unstable_focusOnScrollToBottom`/`unstable_focusOnThreadSwitched`, mặc định `true`) [code: `ComposerInput.d.ts`].
- **Nút Gửi disable thật (không chỉ `aria-disabled`):** `createActionButton` render `<button type="button" disabled={primitiveProps.disabled || !callback}>` — thuộc tính `disabled` gốc HTML, không phải chỉ CSS/aria [code: `.../utils/createActionButton.js`]. Đo runtime: `document.querySelector('.spike-send').disabled === true` khi composer rỗng.
- **ARIA roles: primitives KHÔNG tự gắn.** Quét `ThreadViewport.js`, `ThreadRoot.js`, `ComposerSend.js`, `MessageRoot.js`, `ErrorRoot.js`, `ErrorMessage.js` tìm `role="..."`/`aria-*` viết sẵn trong mã đã build: **chỉ `ComposerInput` có 4 thuộc tính `aria-*`** (dành cho combobox khi trigger-popover mở, không áp dụng ở đây); mọi primitive khác **0 role/aria mặc định**. Nghĩa là KIRA phải tự gắn `role="log"`/`aria-live`/`aria-label` (spike đã làm ở `ThreadPrimitive.Viewport` và composer input) — đây là điểm UI/UX cần lưu ý khi hiện thực hoá panel thật, không phải lấy free từ thư viện.

## 7. Phương pháp, bug phát hiện khi dựng spike

- Cài thật: `pnpm install` (root, workspace) rồi `pnpm --filter @kira/desktop add @assistant-ui/react@0.15.19` — không chỉ symlink từ tree chính.
- File spike (giữ trên nhánh, có chú thích SPIKE ở đầu file, không import từ `main.tsx`, không bị `main.tsx` import):
  - `apps/desktop/src/kira/spike/ChatSpike.tsx` — dùng lại nguyên `AiThread`/`AiMessage`/`AiRun` từ `../aiPanelTypes.ts`.
  - `apps/desktop/src/kira/spike/chatSpike.css`
  - `apps/desktop/src/kira/spike/main.tsx`
  - `apps/desktop/spike-chat.html` — entry Vite riêng, không có trong `rollupOptions.input` mặc định nên **không lọt vào build thật** của app (`npx vite build` bình thường không đụng tới).
- Chạy `npx vite --host 127.0.0.1 --port 5188 --strictPort` trong `apps/desktop` của worktree này (không dùng `preview_start` — theo CLAUDE.md, `preview_start` luôn chạy ở tree chính), mở `http://127.0.0.1:5188/spike-chat.html` qua Browser pane.
- **Bug #1 (lỗi của spike, không phải thư viện):** wrap `<MessagePrimitive.Content />` trong `<p>` cho khối lỗi — `MessagePrimitive.Content`'s default text part đã tự render `<p>`, nên bị `<p>` lồng `<p>` → React cảnh báo hydration/DOM không hợp lệ. Sửa bằng đổi wrapper ngoài sang `<div>`. Phát hiện qua console log thật trong Browser pane (`In HTML, %s cannot be a descendant of <%s>`), không phải suy luận.
- **Bug #2 (lỗi của spike, StrictMode):** effect `?scenario=error` (chỉ để headless Chrome chụp màn hình trạng thái lỗi mà không cần gõ phím) chạy 2 lần dưới `React.StrictMode` (double-invoke effect ở dev), tạo 2 lượt lỗi trùng nhau. Sửa bằng `useRef` guard. Đây là caveat React chuẩn (StrictMode dev-only), không phải lỗi assistant-ui.
- **Phát hiện về công cụ, không phải bug:** `mcp__Claude_Browser__computer` action `key: "Return"` sau `type` **không** kích hoạt Enter-submit của composer (`isComposing`/synthetic-event guard của thư viện có vẻ không nhận diện event do công cụ tạo ra), nhưng bấm nút "Gửi" hoặc dispatch `KeyboardEvent('keydown', {key:'Enter'})` thật qua `javascript_tool` đều gửi được. Đã xác nhận bằng cả 3 cách; ghi lại để thread khác không hiểu nhầm đây là lỗi Enter-to-submit của assistant-ui.
- Test hành vi (tab mới sạch, tránh HMR/StrictMode nhiễu console cũ):
  1. Gửi tin nhắn thường (click "Gửi") → `AiMessage` user + `AiRun` (`status: running`) xuất hiện ngay, ~0.7s sau `AiRun.status: done` + `AiMessage` assistant mới, dòng "Chi tiết run" mở ra đúng `provider/model/prompt`.
  2. Gửi tin chứa "error" → `AiRun.status: error`, message `role: system-error` render khối "Lỗi" đỏ + nút "Thử lại", đúng copy mockup ("Codex không trả lời trong 60 giây. Chưa có gì thay đổi trên canvas.").
  3. Dispatch `KeyboardEvent('keydown', {key:'Enter'})` thật trên textarea có nội dung → gửi thành công, textarea tự xoá.
- Đóng vite dev server (`pkill`) và cả 2 tab Browser pane test sau khi xong; không còn tiến trình nào từ spike này chạy nền.
- Screenshot **Google Chrome headless** (`--headless=new --virtual-time-budget=3000 --window-size=420,800`):
  - `docs/research/spikes/assistant-ui/chat-thread.png` — trạng thái ban đầu (khớp fixture `mockup.js chatThread()`), có run-detail "Chi tiết run".
  - `docs/research/spikes/assistant-ui/chat-error.png` — trạng thái lỗi trong thread, qua `?scenario=error` (query-param chỉ để chụp lại được bằng CLI, guard StrictMode ở Bug #2).

## 8. Giới hạn spike này

- Chưa dựng **thread list** (D11 chỉ hỏi về tab Chat; danh sách thread không nằm trong 4 câu hỏi bắt buộc của brief) — model `ExternalStoreThreadListAdapter` của thư viện giả định kiến trúc "nhiều thread trong một runtime", lệch cách `AiPanelState` của KIRA lưu `threads: AiThread[]` phẳng; nếu dùng, cần một adapter riêng hoặc bỏ qua tính năng này của thư viện và tự viết (giống run-detail).
- Chưa build bundle **thật của `main.tsx`** (bị cấm sửa `main.tsx`/`vite.config.ts` theo brief) — số ở §5 đo bằng entry cô lập, đại diện đúng "chi phí thêm assistant-ui" nhưng không đo được ảnh hưởng tương tác với 18k dòng `main.tsx` hiện có (code-splitting, dynamic import…).
- Kéo lỗi thật từ provider (`invoke('generate_ai_text')`) không test được — Browser pane không có Tauri runtime (CLAUDE.md "Verify" §1); `simulateGenerate()` chỉ giả lập qua `setTimeout`, đúng tinh thần "one-shot" nhưng chưa chạm code native.

## Đề xuất

- **GO with caveats.** Primitives đúng như mô tả D11: headless thật, không Tailwind, `ExternalStoreRuntime` khớp model KIRA. Đủ để UI/UX và Worker bắt đầu hiện thực hoá tab Chat trên `main.tsx` sau khi user xem lại 2 caveat:
  1. Chấp nhận ~88 KB gzip JS thêm vào app, hay ưu tiên fallback tự viết list tin nhắn (rẻ hơn nhưng mất free auto-scroll/focus-management/disable-khi-rỗng của composer).
  2. Không dùng `ExternalStoreThreadListAdapter` của thư viện cho thread list — tự viết như phần còn lại của panel (đã là hướng đi mặc định trong mockup, không thay đổi kế hoạch).
- Nếu user chốt GO: xoá `apps/desktop/src/kira/spike/` và `apps/desktop/spike-chat.html` khi Worker bắt đầu code thật (giữ lại `chatSpike.css` làm tài liệu tham khảo pattern class nếu muốn), Worker tự viết CSS theo type-scale token thật của `styles.css` (spike dùng px cứng, không qua token, đúng như đã ghi trong file).

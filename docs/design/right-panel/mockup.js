/* KIRA right panel mockup: frame builders.
   Every frame is plain HTML/CSS driven by the tokens in mockup.css. The
   builders only exist so the same shell is not hand-copied twenty times. */

const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`

const kiraMark = (mono = false) => `
  <svg class="kira-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M11 2 C11.9 6.2 12.8 9.6 15 11.5 C12.8 12.7 11.9 16.6 11 20 C10.1 16.6 9.2 12.7 7 11.5 C9.2 9.6 10.1 6.2 11 2 Z" fill="${mono ? 'currentColor' : 'url(#kira-grad)'}"/>
    <path d="M18.5 3.6 C18.85 4.9 19.3 5.75 20.3 6.3 C19.3 6.8 18.85 7.9 18.5 9.2 C18.15 7.9 17.7 6.8 16.7 6.3 C17.7 5.75 18.15 4.9 18.5 3.6 Z" fill="${mono ? 'currentColor' : 'url(#kira-grad)'}"/>
    <path d="M5 16.6 C5.16 17.2 5.36 17.6 5.8 17.85 C5.36 18.08 5.16 18.5 5 19.1 C4.84 18.5 4.64 18.08 4.2 17.85 C4.64 17.6 4.84 17.2 5 16.6 Z" fill="${mono ? 'currentColor' : 'url(#kira-grad)'}" opacity="0.55"/>
  </svg>`

/* Illustrative reference thumbnails: crisp geometry, labelled as such in
   the doc. No stock photos, no network. */
const SCENES = {
  facade: ['#3b3a36', '#b08c5c', '#e2d3b5', '#6f7d78'],
  lantern: ['#1f2426', '#c9823f', '#f0c98c', '#3c4a4f'],
  counter: ['#2c2622', '#9c6b3c', '#d9b37a', '#5b534b'],
  alley: ['#454b4a', '#8fa39b', '#d8ddd6', '#2e3432'],
  tile: ['#7a5a45', '#c89f7b', '#efe2cf', '#3f4f55'],
  window: ['#262c2e', '#6e8b8f', '#c9d6d3', '#a0764e'],
  steam: ['#35302b', '#8b7d6d', '#ddd3c4', '#5d6b66'],
}

function thumb(kind, w = 120, h = 90) {
  const [a, b, c, d] = SCENES[kind] || SCENES.facade
  const shapes = {
    facade: `<rect width="120" height="90" fill="${a}"/><rect x="14" y="18" width="26" height="72" fill="${b}"/><rect x="46" y="8" width="30" height="82" fill="${c}"/><rect x="82" y="26" width="26" height="64" fill="${d}"/><rect x="52" y="20" width="8" height="12" fill="${a}"/><rect x="64" y="20" width="8" height="12" fill="${a}"/><rect x="52" y="42" width="8" height="12" fill="${a}"/><rect x="64" y="42" width="8" height="12" fill="${a}"/>`,
    lantern: `<rect width="120" height="90" fill="${a}"/><circle cx="60" cy="40" r="22" fill="${b}"/><circle cx="60" cy="40" r="12" fill="${c}"/><rect x="58" y="0" width="4" height="18" fill="${d}"/><rect x="0" y="72" width="120" height="18" fill="${d}"/>`,
    counter: `<rect width="120" height="90" fill="${a}"/><rect x="0" y="52" width="120" height="10" fill="${c}"/><rect x="0" y="62" width="120" height="28" fill="${b}"/><circle cx="30" cy="30" r="6" fill="${c}"/><circle cx="60" cy="24" r="6" fill="${c}"/><circle cx="90" cy="30" r="6" fill="${c}"/><rect x="20" y="40" width="4" height="12" fill="${d}"/><rect x="56" y="36" width="4" height="16" fill="${d}"/><rect x="96" y="40" width="4" height="12" fill="${d}"/>`,
    alley: `<rect width="120" height="90" fill="${c}"/><polygon points="0,0 44,30 44,70 0,90" fill="${a}"/><polygon points="120,0 76,30 76,70 120,90" fill="${d}"/><rect x="44" y="30" width="32" height="40" fill="${b}"/>`,
    tile: `<rect width="120" height="90" fill="${c}"/><g fill="${b}"><rect x="0" y="0" width="30" height="30"/><rect x="60" y="0" width="30" height="30"/><rect x="30" y="30" width="30" height="30"/><rect x="90" y="30" width="30" height="30"/><rect x="0" y="60" width="30" height="30"/><rect x="60" y="60" width="30" height="30"/></g><circle cx="45" cy="45" r="9" fill="${a}"/><circle cx="105" cy="15" r="9" fill="${d}"/>`,
    window: `<rect width="120" height="90" fill="${a}"/><rect x="24" y="14" width="72" height="62" fill="${b}"/><rect x="28" y="18" width="30" height="27" fill="${c}"/><rect x="62" y="18" width="30" height="27" fill="${c}"/><rect x="28" y="49" width="30" height="23" fill="${c}"/><rect x="62" y="49" width="30" height="23" fill="${d}"/>`,
    steam: `<rect width="120" height="90" fill="${a}"/><ellipse cx="60" cy="70" rx="34" ry="10" fill="${b}"/><rect x="34" y="46" width="52" height="24" fill="${c}"/><path d="M48 40 C40 30 56 22 48 10 M62 40 C54 30 70 22 62 10 M76 40 C68 30 84 22 76 10" stroke="${d}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  }
  return `<svg viewBox="0 0 120 90" width="${w}" height="${h}" role="img" aria-label="Ảnh minh hoạ">${shapes[kind] || shapes.facade}</svg>`
}

const PAL_BEFORE = ['#1d2a2e', '#3e5b5c', '#b98a52', '#e3c796', '#f3ece0']
const PAL_AFTER = ['#1d2a2e', '#4a3b2f', '#c07a3e', '#e3c796', '#efe4d2']
const swatches = (cols, changed = []) => `<div class="swatches${changed.length ? ' after' : ''}">${cols.map((c, i) => `<i style="background:${c}" class="${changed.includes(i) ? 'is-changed' : ''}"></i>`).join('')}</div>`

const GRAD_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="kira-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#f0c07f"/><stop offset="52%" stop-color="#d79fc0"/><stop offset="100%" stop-color="#a5a6ea"/></linearGradient></defs></svg>`

/* One count everywhere per DECISIONS.md #6: items that still need a
   decision, across all changesets (pending plus stale), PLUS 1 while a
   skill sits paused at a checkpoint. shell() computes the checkpoint bump;
   this constant is only the changeset-side total. */
const NEEDS_DECISION = 4
const SKILL_CHECKPOINT_BUMP = 1

/* ---------- shell ---------- */

function shell({ theme, w, h, library = true, panel = null, panelWidth = 360, pending, dock = 'orb', canvas = 'board', narrow = false, review = false, id }) {
  const skillActive = panel === 'pipe-concept' || panel === 'pipe-curate'
  // DECISIONS.md #6: one number for the toggle, the tab and the dock line.
  const count = pending ?? (NEEDS_DECISION + (skillActive ? SKILL_CHECKPOINT_BUMP : 0))
  const cls = ['kf', `t-${theme}`, library ? '' : 'no-library', panel ? 'has-panel' : '', narrow ? 'is-narrow' : ''].join(' ')
  return `
  <div class="${cls}" style="--fw:${w}px;--fh:${h}px;--kira-panel-width:${panelWidth}px" data-frame="${id}">
    ${GRAD_DEFS}
    ${canvasLayer(canvas, { w, narrow, review })}
    ${tabBar({ panel, pending: count })}
    ${rail({ library })}
    ${library ? libraryDrawer() : ''}
    ${topbar({ narrow })}
    ${zoom()}
    ${bottomBar({ dock, pending: count, narrow, panel })}
    ${panel ? kiraPanel(panel, count) : ''}
  </div>`
}

function tabBar({ panel, pending }) {
  // DECISIONS.md #8: this button keeps whichever tab was open last time,
  // unlike the dock status line's "Mở" which always jumps to Cần bạn.
  const label = panel ? 'Đóng panel Kira' : `Mở panel Kira${pending ? `, ${pending} mục cần bạn` : ''}`
  return `
  <header class="file-tab-bar" aria-label="Tệp đang mở">
    <div class="traffic" aria-hidden="true"><i></i><i></i><i></i></div>
    <button class="file-tab is-active"><span class="dot"></span>Hanoi noir coffee</button>
    <button class="file-tab">Bảng màu quán</button>
    <button class="file-tab-add" aria-label="Tệp mới">${icon('plus', 'sm')}</button>
    <button class="panel-toggle ${panel ? 'is-active' : ''}" aria-pressed="${panel ? 'true' : 'false'}" aria-label="${label}" title="Panel Kira (⌥⌘K), giữ tab đang mở">
      ${icon('panel-right')}<span>Kira</span>${pending ? `<span class="count">${pending}</span>` : ''}
    </button>
  </header>`
}

function rail({ library }) {
  return `
  <nav class="system-sidebar" aria-label="Workspace">
    <div class="rail-logo">${kiraMark(true)}</div>
    <div class="rail-group">
      <button class="rail-btn ${library ? 'is-active' : ''}" aria-label="Thư viện ảnh">${icon('image')}</button>
      <button class="rail-btn" aria-label="Ý tưởng">${icon('lightbulb')}</button>
      <button class="rail-btn" aria-label="Liên kết">${icon('link-2')}</button>
    </div>
    <div class="rail-group bottom">
      <button class="rail-btn" aria-label="Nhập dự án">${icon('arrow-down-to-line')}</button>
      <button class="rail-btn" aria-label="Mở">${icon('folder-open')}</button>
      <button class="rail-btn" aria-label="Lưu">${icon('save')}</button>
      <button class="rail-btn" aria-label="Cài đặt">${icon('settings')}</button>
    </div>
  </nav>`
}

function libraryDrawer() {
  const rows = [['facade', 'Mặt tiền Hàng Buồm', 'eagle.import'], ['lantern', 'Đèn lồng giấy', 'browser.capture'], ['counter', 'Quầy gỗ cũ', 'local.library'], ['window', 'Cửa sổ chớp', 'browser.capture'], ['tile', 'Gạch bông', 'local.library']]
  return `
  <aside class="library" aria-label="Thư viện">
    <div class="library-head"><h3>Ảnh</h3><p>48 mục · 6 gợi ý tag</p></div>
    ${rows.map(([k, t, s]) => `<div class="lib-row">${thumb(k, 60, 44)}<div><strong>${t}</strong><small>${s}</small></div></div>`).join('')}
  </aside>`
}

function topbar({ narrow }) {
  return `
  <div class="topbar">
    <div class="segmented view ${narrow ? 'is-compact' : ''}" role="radiogroup" aria-label="Chế độ xem">
      <button class="is-active" role="radio" aria-checked="true">${icon('network', 'sm')}<span>Bảng vẽ</span></button>
      <button role="radio" aria-checked="false" aria-label="3D" title="3D">${icon('layers', 'sm')}<span>3D</span></button>
      <button role="radio" aria-checked="false" aria-label="Trình chiếu" title="Trình chiếu">${icon('sticky-note', 'sm')}<span>Trình chiếu</span></button>
      <button role="radio" aria-checked="false" aria-label="Dàn ý" title="Dàn ý">${icon('list-filter', 'sm')}<span>Dàn ý</span></button>
    </div>
    <div class="right"><button class="icon-button" aria-label="Cài đặt dự án" title="Cài đặt dự án">${icon('sliders-horizontal')}</button></div>
  </div>`
}

function zoom() {
  return `<div class="zoom" aria-label="Thu phóng">
    <button class="icon-button" aria-label="Thu nhỏ">${icon('zoom-out', 'sm')}</button><span class="val">84%</span>
    <button class="icon-button" aria-label="Phóng to">${icon('zoom-in', 'sm')}</button>
    <button class="icon-button" aria-label="Về giữa">${icon('locate-fixed', 'sm')}</button><span class="val">23 node</span>
  </div>`
}

function dockStatus(kind, pending) {
  if (kind === 'status') {
    // DECISIONS.md #6+#8: same word ("cần bạn") as the tab name, same count
    // as the toggle; "Mở" jumps straight to Cần bạn at the pending item.
    return `<div class="dock-status" role="status">${icon('git-branch', 'sm')}<span><b>${pending} mục</b> cần bạn</span><button class="link-button" aria-label="Mở panel Kira ở tab Cần bạn, đúng mục đang chờ">Mở</button></div>`
  }
  if (kind === 'skill') {
    // A paused pipeline must never stall silently while the panel is closed.
    return `<div class="dock-status" role="status">${icon('workflow', 'sm')}<span><b>Skill chờ bạn</b> <span class="sep">·</span> Duyệt nhánh concept</span><button class="link-button" aria-label="Mở panel Kira ở tab Cần bạn, đúng điểm dừng của skill">Mở</button></div>`
  }
  if (kind === 'running') {
    return `<div class="dock-status" role="status">${icon('clock', 'sm')}<span>Kira đang chạy <span class="sep">·</span> Tách nhánh concept <span class="sep">·</span> <span class="num">12 giây</span></span><button class="link-button">Dừng</button></div>`
  }
  if (kind === 'error') {
    return `<div class="dock-status is-error" role="alert">${icon('triangle-alert', 'sm')}<span><span class="state">Kira lỗi</span> <span class="sep">·</span> Codex hết thời gian sau 60 giây</span><button class="link-button">Thử lại</button></div>`
  }
  if (kind === 'done') {
    return `<div class="dock-status" role="status">${icon('check', 'sm')}<span>Kira xong <span class="sep">·</span> <b>2 node mới</b> trên canvas</span><button class="link-button">Xem</button></div>`
  }
  return ''
}

function bottomBar({ dock, pending, narrow, panel }) {
  // DECISIONS.md #7: the dock orb only promises to focus an input when the
  // panel is already showing Chat. On Cần bạn (no composer there) it says
  // what actually happens: switch to Chat first.
  const orbLabel = !panel
    ? 'Hỏi Kira'
    : panel === 'changes' || panel.startsWith('pipe')
      ? 'Chuyển sang Chat và đưa con trỏ vào ô nhập'
      : 'Đưa con trỏ vào ô nhập của panel'
  return `
  <div class="bottom-bar">
    <div class="bottom-left">
      <div class="segmented" role="radiogroup" aria-label="Chế độ canvas">
        <button class="is-active" role="radio" aria-checked="true">Sửa</button><button role="radio" aria-checked="false">Khám phá</button>
      </div>
      ${narrow ? '' : `<button class="quiet-button sm" aria-label="Sắp xếp">${icon('sliders-horizontal', 'sm')}<span class="arrange-label">Sắp xếp</span></button>`}
    </div>
    <div class="bottom-right">
      <div class="tool-rail" aria-label="Công cụ canvas">
        <button class="is-active" aria-label="Chọn">${icon('mouse-pointer-2')}</button><span class="sep"></span>
        <button aria-label="Ảnh">${icon('image-plus')}</button><button aria-label="Ý tưởng">${icon('lightbulb')}</button>
        <button aria-label="Ghi chú">${icon('sticky-note')}</button><button aria-label="Palette">${icon('palette')}</button>
        ${narrow ? '' : `<button class="extra" aria-label="Liên kết">${icon('link-2')}</button><button class="extra" aria-label="Sơ đồ">${icon('workflow')}</button>`}
      </div>
      <div class="kira-dock-wrap">
        ${panel ? '' : dockStatus(dock, pending)}
        <button class="kira-dock" aria-label="${orbLabel}">${kiraMark()}</button>
      </div>
    </div>
  </div>`
}

/* ---------- canvas content ---------- */

function idea({ x, y, title, note, selected, prov, review }) {
  return `<div class="idea-node ${selected ? 'is-selected' : ''} ${review ? 'is-review' : ''}" style="left:${x}px;top:${y}px">
    <span class="kind">${icon('lightbulb', 'xs')}</span>
    ${prov ? provBadge(prov) : ''}
    <strong>${title}</strong>${note ? `<small>${note}</small>` : ''}
    ${review ? `<span class="review-tag">${icon('pencil', 'xs')}Đang xem đề xuất sửa</span>` : ''}
  </div>`
}

function provBadge(kind) {
  if (kind === 'edited') return `<button class="prov" aria-label="Do Kira tạo, bạn đã sửa. Mở run">AI, đã sửa ${icon('pencil', 'xs')}</button>`
  return `<button class="prov" aria-label="Do Kira tạo. Mở run">AI</button>`
}

function imageNode({ x, y, kind, label, prov }) {
  return `<div class="image-node" style="left:${x}px;top:${y}px">${prov ? provBadge(prov) : ''}${thumb(kind, 92, 69)}<span>${label}</span></div>`
}

function paletteNode({ x, y, title, cols, note, prov }) {
  return `<div class="palette-node" style="left:${x}px;top:${y}px">${prov ? provBadge(prov) : ''}<strong>${title}</strong>${swatches(cols)}<small>${note}</small></div>`
}

function canvasLayer(kind, { w, narrow, review }) {
  // Narrow frames show the panned state: the selected node sits left of the
  // panel instead of under it.
  const cx = narrow ? -318 : w >= 1300 ? 0 : -150
  if (kind === 'none') return `<div class="graph-canvas"></div>`
  const base = `
    <svg class="edges" aria-hidden="true" style="width:100%;height:100%">
      <path class="is-active" d="M ${cx + 752} 262 C ${cx + 812} 262 ${cx + 812} 330 ${cx + 872} 336"/>
      <path d="M ${cx + 752} 262 C ${cx + 820} 250 ${cx + 900} 170 ${cx + 980} 162"/>
      <path d="M ${cx + 1096} 350 C ${cx + 1140} 360 ${cx + 1150} 440 ${cx + 1190} 452"/>
      <path d="M ${cx + 640} 300 C ${cx + 640} 380 ${cx + 700} 420 ${cx + 760} 470"/>
    </svg>
    ${idea({ x: cx + 526, y: 222, title: 'Hanoi noir: quán cà phê đêm', note: 'Ánh vàng thấp, gỗ tối, kính mờ hơi nước. Khách ngồi quay lưng ra phố.', selected: kind !== 'badges', review })}
    ${idea({ x: cx + 872, y: 300, title: 'Quầy bar ánh đồng', note: 'Nhánh concept do Kira tách từ node gốc.', prov: 'ai' })}
    ${idea({ x: cx + 980, y: 120, title: 'Phố cổ sau mưa', note: 'Mặt đường phản chiếu biển hiệu, giữ tương phản thấp.', prov: 'edited' })}
    ${paletteNode({ x: cx + 1160, y: 430, title: 'Đêm Hàng Buồm', cols: PAL_BEFORE, note: '5 màu · harmony' })}
    ${imageNode({ x: cx + 700, y: 460, kind: 'lantern', label: 'Đèn lồng giấy' })}
    ${imageNode({ x: cx + 820, y: 470, kind: 'counter', label: 'Quầy gỗ cũ', prov: 'ai' })}
    ${imageNode({ x: cx + 540, y: 430, kind: 'facade', label: 'Mặt tiền' })}`
  return `<div class="graph-canvas">${base}</div>`
}

/* ---------- panel ---------- */

function kiraPanel(view, pending = NEEDS_DECISION) {
  const tab = view.startsWith('changes') || view.startsWith('pipe') ? 'changes' : 'chat'
  const body = {
    chat: chatThread(false),
    'chat-run': chatThread(true),
    threads: threadList(),
    changes: changesView({}),
    'changes-accepted': changesView({ accepted: true }),
    empty: emptyChat(),
    'pipe-concept': pipelineConcept(),
    'pipe-curate': pipelineCurate(),
  }[view]
  const foot = tab === 'chat' && view !== 'threads' && view !== 'empty' ? composer() : ''
  return `
  <aside class="kira-panel" aria-label="Kira">
    <div class="kp-head">
      <div class="kp-title">
        <h3>Kira</h3><span class="spacer"></span>
        <button class="icon-button sm" aria-label="Đóng panel" title="Đóng panel (⌥⌘K)">${icon('x', 'sm')}</button>
      </div>
      <div class="segmented kp-tabs" role="tablist" aria-label="Nội dung panel">
        <button role="tab" aria-selected="${tab === 'chat'}" class="${tab === 'chat' ? 'is-active' : ''}">${icon('message-square', 'sm')}Chat</button>
        <button role="tab" aria-selected="${tab === 'changes'}" class="${tab === 'changes' ? 'is-active' : ''}">${icon('git-branch', 'sm')}Cần bạn ${pending ? `<span class="count">${pending}</span>` : ''}</button>
      </div>
    </div>
    <div class="kp-body">${body}</div>
    ${foot ? `<div class="kp-foot">${foot}</div>` : ''}
  </aside>`
}

function chatTools() {
  return `
  <div class="chat-tools">
    <button class="thread-switch" aria-haspopup="listbox">
      <span><strong>Tách nhánh concept Hanoi noir</strong><span class="row-sub">14 tin · cập nhật 14:32</span></span><span class="switch-all">Tất cả${icon('chevron-down', 'xs')}</span>
    </button>
  </div>`
}

function threadList() {
  const rows = [
    { t: 'Tách nhánh concept Hanoi noir', a: ['Hanoi noir: quán cà phê đêm', 'Quầy bar ánh đồng'], when: '14:32', note: '3 cần xử lý', cur: true },
    { t: 'Palette cho biển hiệu', a: ['Hanoi noir: quán cà phê đêm', 'Đêm Hàng Buồm'], when: 'Hôm qua', note: '1 cần xử lý' },
  ]
  const rest = [
    { t: 'Tìm ảnh mặt tiền phố cổ', a: ['Cả bảng'], when: '11 thg 9' },
    { t: 'Dàn ý buổi pitch khách hàng', a: ['Cả bảng'], when: '9 thg 9' },
    { t: 'Chất liệu gỗ và kính mờ', a: ['Quầy gỗ cũ'], when: '4 thg 9' },
  ]
  const row = (r) => `<li><button class="thread-row ${r.cur ? 'is-current' : ''}" ${r.cur ? 'aria-current="true"' : ''}>
      <strong>${r.t}</strong><span class="when">${r.when}</span>
      <span class="anchors row-sub">${r.note ? `<span class="attention">${r.note}</span><span>·</span>` : ''}<span class="anchor-names">${r.a.join(', ')}</span></span>
    </button></li>`
  return `
  <div class="list-tools">
    <div class="filter-group" role="group" aria-label="Lọc thread">
      <button class="filter-chip is-on" aria-pressed="true">${icon('list-filter', 'xs')}<span>Liên quan node đang chọn</span></button>
      <button class="filter-clear" aria-label="Bỏ lọc">${icon('x', 'xs')}</button>
    </div>
    <button class="quiet-button sm">${icon('plus', 'xs')}Thread mới</button>
  </div>
  <p class="filter-caption">Node đang chọn: <b>Hanoi noir: quán cà phê đêm</b></p>
  <div class="group-label"><span>2 trong 5 thread</span></div>
  <ul class="list">${rows.map(row).join('')}</ul>
  <div class="group-label"><span>Thread khác</span><span class="num">3</span></div>
  <ul class="list">${rest.map(row).join('')}</ul>`
}

function emptyChat() {
  return `
  <div class="kp-empty">
    ${icon('message-square', 'lg')}
    <h4>Chưa có thread nào</h4>
    <p>Chọn một node rồi hỏi Kira ở dock dưới canvas. Thread mới tự neo vào node đang chọn.</p>
  </div>`
}

function chatThread(dragging) {
  return `
  ${chatTools()}

  <div class="msg">
    <div class="msg-head"><b>Bạn</b><span class="num">14:31</span></div>
    <div class="msg-user">Tách node này thành 3 nhánh concept có thể dựng moodboard riêng. Mỗi nhánh một câu định hướng.
      <div class="ctx"><span>${icon('lightbulb', 'xs')}Hanoi noir: quán cà phê đêm</span><span>+2 ảnh</span></div>
    </div>
  </div>

  <div class="msg">
    <div class="msg-head"><b>Kira</b><span class="num">14:32</span></div>
    <div class="msg-ai ${dragging ? 'is-dragging' : ''}" tabindex="0">
      <p>Ba nhánh, xếp theo độ khác biệt so với node gốc:</p>
      <ul>
        <li><b>Quầy bar ánh đồng.</b> Kim loại ấm, ánh sáng chỉ từ quầy.</li>
        <li><b>Phố cổ sau mưa.</b> Phản chiếu biển hiệu, tương phản thấp.</li>
        <li><b>Hơi nước và kính mờ.</b> Chi tiết cận, gần như đơn sắc.</li>
      </ul>
    </div>
    <div class="answer-actions" role="toolbar" aria-label="Đưa câu trả lời lên canvas">
      ${dragging
        ? `<span class="drag-state">${icon('grip-vertical', 'xs')}Đang kéo lên canvas. Esc để huỷ.</span>`
        : `<span class="grip" title="Kéo lên canvas">${icon('grip-vertical', 'xs')}</span><button class="quiet-button sm">${icon('plus', 'xs')}Tạo node</button><button class="link-button sm">Tách 3 node</button>`}
    </div>
    ${dragging ? '' : `<p class="answer-hint">Mặc định gộp 1 node. "Tách 3 node" tạo riêng từng mục trong danh sách.</p>`}
    <div class="run-line">
      <span class="state-ok">${icon('check', 'xs')}Xong</span><span>Claude Code · 8,4 giây</span>
      <button class="disclosure" aria-expanded="${dragging}">Chi tiết run${icon('chevron-down', 'xs')}</button>
    </div>
    ${dragging ? `
    <dl class="run-detail">
      <div><dt>Provider</dt><dd>Claude Code (CLI trên máy)</dd></div>
      <div><dt>Model</dt><dd class="mono">claude-sonnet-5</dd></div>
      <div><dt>Bắt đầu</dt><dd class="num">14:31:52 · 8,4 giây</dd></div>
      <div><dt>Trạng thái</dt><dd><span class="state-ok">${icon('check', 'xs')}Xong</span></dd></div>
      <div><dt>Kết quả</dt><dd>Tạo 2 node, đề xuất 3 thay đổi <button class="link-button sm">Mở Cần bạn</button></dd></div>
      <div><dt>Prompt</dt><dd><span class="mono prompt">You are assisting an art director. Split the selected idea "Hanoi noir: quán cà phê đêm" into 3 concept branches, each buildable as its own moodboard…</span><button class="link-button sm">Xem đầy đủ</button></dd></div>
    </dl>` : ''}
  </div>

  ${dragging ? '' : `
  <div class="msg">
    <div class="msg-head"><b>Kira</b><span class="num">14:40</span></div>
    <div class="run-error" role="status">
      <p><span class="state-err">${icon('triangle-alert', 'xs')}Lỗi</span> Codex không trả lời trong 60 giây. Chưa có gì thay đổi trên canvas.</p>
      <div class="acts"><button class="quiet-button sm">${icon('rotate-ccw', 'xs')}Thử lại</button><button class="quiet-button sm">Thử với Claude Code</button></div>
    </div>
  </div>`}`
}

function composer() {
  return `
  <div class="composer">
    <span class="ph">Hỏi tiếp trong thread này</span>
    <button class="send" aria-label="Gửi" disabled>${icon('arrow-up', 'sm')}</button>
  </div>
  <div class="composer-meta"><span>Ngữ cảnh: 1 node, 2 ảnh</span><span>Claude Code</span></div>`
}

function changesView({ accepted = false }) {
  const toast = accepted ? `
  <div class="accept-toast" role="status">${icon('check', 'sm')}<span>Đã nhận: <b>Sửa text</b> "Hanoi noir: quán cà phê đêm"</span><button class="link-button sm">Hoàn tác ⌘Z</button></div>` : ''

  const bulkActions = accepted
    ? `<button class="quiet-button sm">Bỏ các đề xuất</button>`
    : `<button class="quiet-button sm">${icon('check', 'xs')}Nhận 1 sửa text</button>
       <button class="quiet-button sm">Bỏ các đề xuất</button>`

  const summary = accepted
    ? `<p class="cs-summary"><span><b>2</b> cần xử lý</span><span class="muted">·</span><span><b>2</b> đã áp dụng</span><span class="muted">·</span><span><b>1</b> đã nhận</span></p>`
    : `<p class="cs-summary"><span><b>${NEEDS_DECISION}</b> cần xử lý</span><span class="muted">·</span><span><b>2</b> đã áp dụng</span></p>`

  // Applied item 1: a plain AI creation, no guard needed.
  const appliedPlain = `
      <li class="item">
        <span class="op">${icon('plus', 'xs')}</span>
        <div class="item-line"><div><span class="item-kind">Tạo node</span><span class="item-target">Quầy bar ánh đồng</span></div>
          <span class="item-status state-ok">${icon('check', 'xs')}Đã áp dụng</span></div>
        <div class="item-body">
          <div class="item-foot"><button class="link-button sm">${icon('locate-fixed', 'xs')}Xem trên canvas</button><div class="acts"><button class="quiet-button sm">Gỡ node</button></div></div>
        </div>
      </li>`

  // Applied item 2: the node carries "AI, đã sửa", so removing it needs the
  // same kind of guard as a stale edit, not a bare button.
  const appliedGuarded = `
      <li class="item">
        <span class="op">${icon('plus', 'xs')}</span>
        <div class="item-line"><div><span class="item-kind">Tạo node</span><span class="item-target">Phố cổ sau mưa</span></div>
          <span class="item-status state-ok">${icon('check', 'xs')}Đã áp dụng</span></div>
        <div class="item-body">
          <p class="stale-note">${icon('triangle-alert', 'xs')}<span><b>Bạn đã sửa nội dung node này</b> sau khi Kira tạo. Gỡ sẽ xoá cả phần bạn viết thêm.</span></p>
          <div class="item-foot"><button class="link-button sm">${icon('locate-fixed', 'xs')}Xem trên canvas</button><div class="acts"><button class="quiet-button sm">Gỡ node</button></div></div>
        </div>
      </li>`

  // The sửa-text item: expanded and focused before Nhận, collapsed and
  // marked "Đã nhận" after. Only one item is ever expanded at a time, so
  // the delete item below never falls below the fold.
  const textItem = accepted ? `
      <li class="item">
        <span class="op">${icon('pencil', 'xs')}</span>
        <div class="item-line"><div><span class="item-kind">Sửa text</span><span class="item-target">Hanoi noir: quán cà phê đêm</span></div>
          <span class="item-status state-ok">${icon('check', 'xs')}Đã nhận</span></div>
        <div class="item-body">
          <div class="item-foot"><button class="disclosure" aria-expanded="false">Xem nội dung đã nhận${icon('chevron-down', 'xs')}</button><span></span></div>
        </div>
      </li>` : `
      <li class="item is-focused" aria-current="true">
        <span class="op">${icon('pencil', 'xs')}</span>
        <div class="item-line"><div><span class="item-kind">Sửa text</span><span class="item-target">Hanoi noir: quán cà phê đêm</span></div>
          <span class="item-status state-wait">Chờ duyệt</span></div>
        <div class="item-body">
          <p class="diff">Ánh vàng thấp, gỗ tối, <del>kính mờ hơi nước</del> <ins>kính mờ và đồng xước</ins>. Khách ngồi quay lưng ra phố<ins>, quầy là nguồn sáng duy nhất</ins>.</p>
          <div class="item-foot"><span class="item-links"><button class="link-button sm">${icon('locate-fixed', 'xs')}Đang hiện trên canvas</button><button class="link-button sm">${icon('history', 'xs')}Lịch sử node</button></span><div class="acts"><button class="quiet-button sm">Từ chối</button><button class="primary-button sm">Nhận</button></div></div>
        </div>
      </li>`

  // The palette item: collapsed by default (per the "only the focused item
  // opens" rule), with the stale reasoning summarised in one line.
  const paletteItem = `
      <li class="item is-stale">
        <span class="op">${icon('palette', 'xs')}</span>
        <div class="item-line"><div><span class="item-kind">Đổi palette</span><span class="item-target">Đêm Hàng Buồm</span></div>
          <span class="item-status state-attn">${icon('triangle-alert', 'xs')}Đã cũ</span></div>
        <div class="item-body">
          <p class="item-summary-line">${icon('triangle-alert', 'xs')}Bạn đã sửa palette lúc 14:40, sau khi Kira đề xuất.</p>
          <div class="item-foot"><button class="disclosure" aria-expanded="false">Xem chi tiết${icon('chevron-down', 'xs')}</button><div class="acts"><button class="quiet-button sm">Từ chối</button><button class="quiet-button sm">${icon('refresh-cw', 'xs')}Đề xuất lại</button></div></div>
        </div>
      </li>`

  // The delete item: collapsed too, so it never sits below the fold behind
  // three fully expanded items above it.
  const deleteItem = `
      <li class="item">
        <span class="op is-delete">${icon('trash-2', 'xs')}</span>
        <div class="item-line"><div><span class="item-kind is-delete">Xoá node</span><span class="item-target">Ghi chú cũ về ánh đèn</span></div>
          <span class="item-status state-wait">Chờ duyệt</span></div>
        <div class="item-body">
          <p class="item-summary-line">2 liên kết sẽ mất. Kira lưu version trước khi xoá.</p>
          <div class="item-foot"><button class="disclosure" aria-expanded="false">Xem chi tiết${icon('chevron-down', 'xs')}</button><div class="acts"><button class="quiet-button sm">Giữ node</button><button class="danger-button sm">Xoá node</button></div></div>
        </div>
      </li>`

  return `
  ${toast}
  ${summary}

  <section class="changeset" aria-label="Thay đổi từ run Tách nhánh concept">
    <div class="cs-head">
      <h4>Tách nhánh concept Hanoi noir</h4>
      <span class="row-sub">Claude Code · 14:32 · ${accepted ? '2 cần xử lý' : '3 cần xử lý'}</span>
    </div>
    <div class="cs-actions">
      ${bulkActions}
      <button class="link-button sm" title="Version Kira lưu trước lần nhận gần nhất">${icon('history', 'xs')}Version trước Kira</button>
    </div>
    <p class="cs-rule">Nhận hàng loạt không bao gồm xoá và mục đã cũ.</p>

    <ul class="list">
      ${appliedPlain}
      ${appliedGuarded}
      ${textItem}
      ${paletteItem}
    </ul>

    <div class="group-label"><span>Cần duyệt riêng</span><span class="num">1</span></div>
    <ul class="list">
      ${deleteItem}
    </ul>
  </section>

  <section class="changeset is-collapsed" aria-label="Thay đổi từ run Palette cho biển hiệu">
    <button class="cs-collapsed"><span><strong>Palette cho biển hiệu</strong><span class="row-sub">OpenAI · hôm qua · 1 cần xử lý</span></span>${icon('chevron-down', 'sm')}</button>
  </section>

  <button class="handled" aria-expanded="false"><span>Đã xử lý · ${accepted ? '5' : '4'} mục</span>${icon('chevron-down', 'sm')}</button>`
}

function pipeSteps(stage) {
  const steps = [
    ['Sinh nhánh concept', 'Xong · 5 nhánh'],
    ['Duyệt nhánh', stage === 'concept' ? 'Chờ bạn' : 'Xong · giữ 4'],
    ['Tìm ảnh', stage === 'concept' ? 'Chưa chạy' : 'Xong · 11 ảnh, 3/4 nhánh'],
    ['Curate ảnh', stage === 'concept' ? 'Chưa chạy' : 'Chờ bạn'],
  ]
  const nowIndex = stage === 'concept' ? 1 : 3
  return `<ol class="steps" aria-label="Các bước của skill">${steps.map(([n, s], i) => {
    const st = i < nowIndex ? 'is-done' : i === nowIndex ? 'is-now' : ''
    const mark = i < nowIndex ? icon('check', 'xs') : ''
    const cls = i === nowIndex ? 'state-now' : 'state-idle'
    return `<li class="${st}"><span class="step-dot">${mark}</span><span class="name">${n}</span><span class="${cls}">${s}</span></li>`
  }).join('')}</ol>`
}

function pipeHead() {
  return `<div class="pipe-head"><div><h4>Tìm ảnh cho moodboard</h4><span class="row-sub">Skill đang chờ bạn · Openverse · bắt đầu 14:50</span></div><button class="quiet-button sm">Dừng skill</button></div>`
}

function queueAfterSkill() {
  return `<button class="cs-collapsed queue-link"><span><strong>Xem tab Cần bạn</strong><span class="row-sub">${NEEDS_DECISION} mục khác đang chờ, trong 2 run</span></span>${icon('chevron-down', 'sm')}</button>`
}

const check = (on, label) => `<input class="check" type="checkbox" ${on ? 'checked' : ''} aria-label="${label}">`

function pipelineConcept() {
  const branches = [
    ['Quầy bar ánh đồng', 'Kim loại ấm, ánh sáng chỉ từ quầy.', true],
    ['Phố cổ sau mưa', 'Phản chiếu biển hiệu, tương phản thấp.', true],
    ['Hơi nước và kính mờ', 'Chi tiết cận, gần như đơn sắc.', true],
    ['Gạch bông và ghế nhựa', 'Vỉa hè Hà Nội, ban ngày. Lệch khỏi tinh thần noir.', false],
    ['Biển hiệu neon cũ', 'Chữ tay, màu bạc, ánh đỏ thấp.', true],
  ]
  return `
  <section class="skill-card">
    ${pipeHead()}
    ${pipeSteps('concept')}
    <div class="checkpoint" aria-label="Điểm dừng: duyệt nhánh concept">
      <h5>Chọn nhánh để tìm ảnh</h5>
      <p>Kira chỉ tìm ảnh cho nhánh bạn giữ. Bỏ chọn nhánh lệch hướng. Chưa tốn lượt tìm nào.</p>
      ${branches.map(([t, d, on]) => `<label class="branch">${check(on, t)}<span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}
      <div class="cp-actions"><button class="primary-button sm">Tìm ảnh cho 4 nhánh</button><button class="quiet-button sm">${icon('pencil', 'xs')}Sửa tên nhánh</button></div>
    </div>
  </section>
  ${queueAfterSkill()}`
}

function pipelineCurate() {
  // Same rule everywhere: a clear licence is preselected, an unclear one is
  // not. Applied consistently, the group that's expanded (6 photos) and the
  // two still collapsed (3 and 2 photos) all follow it, so the commit button
  // can state a real, honest total instead of only what's on screen.
  const items = [
    ['facade', 'CC BY 4.0', 'Minh Trần', true],
    ['alley', 'CC0', 'Openverse', true],
    ['window', 'CC BY-SA 4.0', 'Lê Hoa', true],
    ['lantern', 'CC BY 4.0', 'Khuê Phạm', true],
    ['steam', 'Chưa rõ quyền', 'Nguồn không ghi', false, true],
    ['tile', 'CC0', 'Openverse', true],
  ]
  return `
  <section class="skill-card">
    ${pipeHead()}
    ${pipeSteps('curate')}
    <div class="checkpoint" aria-label="Điểm dừng: curate ảnh">
      <h5>Chọn ảnh đưa lên canvas</h5>
      <p>License và tác giả được ghi vào từng node ảnh. Ảnh chưa rõ quyền không được chọn sẵn, ở mọi nhánh.</p>

      <div class="cur-group">
        <div class="cur-group-head"><strong>Phố cổ sau mưa</strong><span class="row-sub num">5 chọn / 6 ảnh</span></div>
        <div class="thumbs">
          ${items.map(([k, lic, by, on, unknown]) => `<figure class="thumb ${on ? 'is-on' : ''}">${check(on, `${lic}, ${by}`)}<div class="frame">${thumb(k)}</div><figcaption><span class="lic ${unknown ? 'unknown' : ''}">${unknown ? icon('triangle-alert', 'xs') : ''}${lic}</span><span class="by">${by}</span></figcaption></figure>`).join('')}
        </div>
      </div>

      <div class="cur-group">
        <div class="cur-group-head"><strong>Quầy bar ánh đồng</strong><span class="row-sub num">0 ảnh</span></div>
        <div class="zero" role="status">
          ${icon('search', 'sm')}<strong>0 kết quả từ Openverse</strong>
          <p>Query đã dùng: <code>brass bar counter night hanoi</code>. Nguồn không báo lỗi, chỉ là không có ảnh khớp.</p>
          <div class="acts"><button class="quiet-button sm">${icon('pencil', 'xs')}Sửa query</button><button class="quiet-button sm">Thử nguồn khác</button></div>
        </div>
      </div>

      <div class="cur-group">
        <button class="cur-collapsed"><strong>Hơi nước và kính mờ</strong><span class="row-sub num">2 chọn / 3 ảnh</span>${icon('chevron-down', 'sm')}</button>
        <button class="cur-collapsed"><strong>Biển hiệu neon cũ</strong><span class="row-sub num">2 chọn / 2 ảnh</span>${icon('chevron-down', 'sm')}</button>
      </div>

      <div class="cp-actions"><button class="primary-button sm">Thêm 9 ảnh, 3 nhánh</button><button class="quiet-button sm">Bỏ qua bước này</button></div>
    </div>
  </section>
  ${queueAfterSkill()}`
}

/* ---------- scenario crops ---------- */

function badgeCrop(theme) {
  return `
  <div class="kf t-${theme} crop" style="--fw:820px;--fh:420px" data-frame="s4-${theme}">
    ${GRAD_DEFS}
    <div class="graph-canvas" style="top:0;left:0;border-radius:0">
      <svg class="edges" aria-hidden="true" style="width:100%;height:100%">
        <path d="M 264 110 C 300 110 290 170 300 178"/><path d="M 264 110 C 300 180 300 260 330 316"/>
        <path d="M 524 180 C 600 190 640 230 660 252"/>
      </svg>
      ${idea({ x: 40, y: 70, title: 'Hanoi noir: quán cà phê đêm', note: 'Node do bạn tạo: không có nhãn.' })}
      ${idea({ x: 300, y: 140, title: 'Quầy bar ánh đồng', note: 'Kira tạo, chưa ai sửa.', prov: 'ai' })}
      ${idea({ x: 330, y: 296, title: 'Phố cổ sau mưa', note: 'Kira tạo, bạn đã sửa nội dung.', prov: 'edited', selected: true })}
      ${imageNode({ x: 610, y: 250, kind: 'alley', label: 'Ngõ nhỏ, CC0', prov: 'ai' })}
      <div class="prov-pop" style="left:536px;top:24px" role="dialog" aria-label="Nguồn gốc node">
        <span class="caret" aria-hidden="true"></span>
        <strong>Do Kira tạo</strong>
        <p>Claude Code · 14:32 · thread Tách nhánh concept Hanoi noir. Từ node Hanoi noir: quán cà phê đêm.</p>
        <button class="link-button sm">Mở run trong panel</button>
      </div>
    </div>
  </div>`
}

function dockCrop(theme) {
  const v = ['status', 'skill', 'running', 'done', 'error']
  return `
  <div class="kf t-${theme} crop" style="--fw:760px;--fh:360px;background:var(--bg-canvas)" data-frame="s5v-${theme}">
    ${GRAD_DEFS}
    <div style="position:absolute;inset:0;display:grid;align-content:center;justify-items:end;gap:16px;padding:24px 28px">
      ${v.map((k) => `<div class="kira-dock-wrap">${dockStatus(k, NEEDS_DECISION)}<button class="kira-dock" aria-label="Hỏi Kira">${kiraMark()}</button></div>`).join('')}
    </div>
  </div>`
}

/* ---------- scenario registry ---------- */

const W = 1440, H = 900
const FRAMES = {
  's1-closed': (t) => shell({ theme: t, w: W, h: H, id: `s1-closed-${t}`, dock: 'none' }),
  's1-open': (t) => shell({ theme: t, w: W, h: H, panel: 'chat', id: `s1-open-${t}` }),
  's1-narrow': (t) => shell({ theme: t, w: 1024, h: 720, panel: 'chat', panelWidth: 340, library: false, narrow: true, id: `s1-narrow-${t}` }),
  's2-threads': (t) => shell({ theme: t, w: W, h: H, panel: 'threads', id: `s2-threads-${t}` }),
  's2-run': (t) => withDrag(shell({ theme: t, w: W, h: H, panel: 'chat-run', id: `s2-run-${t}` })),
  's3-changes': (t) => shell({ theme: t, w: W, h: 1300, panel: 'changes', review: true, id: `s3-changes-${t}` }),
  's4-badges': (t) => badgeCrop(t),
  's5-dock': (t) => shell({ theme: t, w: W, h: H, dock: 'status', id: `s5-dock-${t}` }),
  's5-variants': (t) => dockCrop(t),
  's6-concept': (t) => shell({ theme: t, w: W, h: H, panel: 'pipe-concept', id: `s6-concept-${t}` }),
  's6-curate': (t) => shell({ theme: t, w: W, h: 1150, panel: 'pipe-curate', id: `s6-curate-${t}` }),
  's7-accepted': (t) => shell({ theme: t, w: W, h: 1200, panel: 'changes-accepted', pending: 3, id: `s7-accepted-${t}` }),
  's8-empty': (t) => shell({ theme: t, w: W, h: H, panel: 'empty', pending: 0, id: `s8-empty-${t}` }),
}

function withDrag(html) {
  const overlay = `
    <div class="drag-ghost" style="left:822px;top:600px"><span class="kind">${icon('lightbulb', 'xs')}</span><strong>Ba nhánh concept Hanoi noir</strong><small>Quầy bar ánh đồng, Phố cổ sau mưa, Hơi nước và kính mờ</small></div>
    <span class="cursor" style="left:1040px;top:668px">${icon('mouse-pointer-2')}</span>
    <span class="drop-hint" style="left:822px;top:702px">${icon('plus', 'xs')}Thả để tạo node, nối với Hanoi noir</span>`
  return html.replace(/<\/div>\s*$/, `${overlay}</div>`)
}

window.KIRA_MOCK = { FRAMES }

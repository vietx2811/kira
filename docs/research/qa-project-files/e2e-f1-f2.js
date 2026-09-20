// KIRA QA — kịch bản E2E cho F1 (project/appearance) và F2 (variant/aiExcluded/pinned/blockOrder).
// Chạy trong Web Inspector console của BẢN DEBUG app native (cần Tauri runtime).
// Dán nguyên khối, nó tự in bảng kết quả. Chỉ ghi vào thư mục tạm, không đụng project của user.
(async () => {
  const invoke =
    window.__TAURI__?.core?.invoke ??
    window.__TAURI__?.invoke ??
    window.__TAURI_INTERNALS__?.invoke;
  if (!invoke) return console.error('KHÔNG có Tauri runtime — phải chạy trong app native, không phải browser preview.');

  const path = `/tmp/kira-qa-${Date.now()}.kira`;

  // Snapshot mang đúng những trường đang nghi bị rơi.
  const snap = {
    version: 2,
    project: { title: 'QA-TITLE-KEEPME', description: 'QA-DESC', author: 'QA-AUTHOR', kind: 'ideaboard', styleNote: 'QA-STYLE' },
    appearance: { colorMode: 'light', canvasColor: '#f0efe7', accentPreset: 'custom', accentColor: '#004a56' },
    ideas: [
      { id: 'qa-plain', title: 'plain', content: 'plain', status: 'forming', x: 10, y: 10 },
      // F2: sticky note + cờ loại trừ AI
      { id: 'qa-sticker', title: 'sticky', content: 'sticky', status: 'forming', x: 20, y: 20, variant: 'sticker', aiExcluded: true },
    ],
    images: [
      { id: 'qa-img', title: 'img', content: 'img', source: 'qa', palette: ['#112233'], tags: ['qa-tag'],
        suggestions: [], x: 30, y: 30, thumb: 'data:image/png;base64,iVBORw0KGgo=',
        notes: 'qa-note', aiExcluded: true, tagsPinned: true, palettePinned: false,
        blockOrder: ['tags', 'palette', 'source'] },
    ],
    palettes: [], diagrams: [], placeholders: [], frames: [],
    links: [{ id: 'qa-link', imageId: 'qa-img', ideaId: 'qa-plain', sourceNodeId: 'qa-img', targetNodeId: 'qa-plain',
              sourceKind: 'image', targetKind: 'idea', relation: 'supports', note: 'qa-link-note', confidence: 0.77 }],
    outlineDrafts: [],
    aiSettings: { providers: [], selectedProviderId: 'openai', routingMode: 'prefer_local' },
    versionState: { schemaVersion: 1, currentBranchId: 'main', branches: [{ id: 'main', name: 'Main', createdAt: '1970-01-01T00:00:00.000Z' }] },
    versionHistory: [], nodeVersions: [],
  };

  await invoke('save_project_package', { snapshotJson: JSON.stringify(snap), projectPath: path });
  const back = JSON.parse(await invoke('open_project_package_at', { projectPath: path }));

  const idea = (s, id) => (s.ideas || []).find((i) => i.id === id) || {};
  const img = (s) => (s.images || [])[0] || {};
  const checks = [
    ['F1 project.title',        snap.project.title,             back.project?.title],
    ['F1 project.author',       snap.project.author,            back.project?.author],
    ['F1 project.kind',         snap.project.kind,              back.project?.kind],
    ['F1 project.styleNote',    snap.project.styleNote,         back.project?.styleNote],
    ['F1 appearance.accent',    snap.appearance.accentColor,    back.appearance?.accentColor],
    ['F1 appearance.colorMode', snap.appearance.colorMode,      back.appearance?.colorMode],
    ['F2 idea.variant',         'sticker',                      idea(back, 'qa-sticker').variant],
    ['F2 idea.aiExcluded',      true,                           idea(back, 'qa-sticker').aiExcluded],
    ['F2 image.aiExcluded',     true,                           img(back).aiExcluded],
    ['F2 image.tagsPinned',     true,                           img(back).tagsPinned],
    ['F2 image.blockOrder',     'tags,palette,source',          (img(back).blockOrder || []).join(',')],
    // Đối chứng: những trường này PHẢI sống sót. Nếu chúng cũng hỏng thì kịch bản sai, không phải app sai.
    ['ĐỐI CHỨNG link.confidence', 0.77,                         (back.links || [])[0]?.confidence],
    ['ĐỐI CHỨNG image.tags',      'qa-tag',                     (img(back).tags || []).join(',')],
    ['ĐỐI CHỨNG image.notes',     'qa-note',                    img(back).notes],
  ];

  console.table(checks.map(([name, want, got]) => ({
    check: name, expected: want, got: got === undefined ? '(MẤT)' : got,
    verdict: String(want) === String(got) ? 'GIỮ' : 'MẤT',
  })));
  console.log('package test:', path, '— xoá bằng: rm -rf', path);
})();

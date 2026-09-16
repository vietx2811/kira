import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowUpFromLine,
  Camera,
  Clipboard,
  Database,
  FolderOpen,
  Image as ImageIcon,
  Images as ImagesIcon,
  ImagePlus,
  Lightbulb,
  MoreHorizontal,
  Search,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react'
import type { EvidenceImage, EvidenceLink, Idea, Lang, LibraryBrowseMode, LibraryDensity, LibraryPanelMode, Relation, Selection, SortMode } from '@/main'
import { Segmented } from '@/components/Segmented'
import { Button } from '@/components/base/buttons/button'
import { Badge, BadgeWithButton } from '@/components/base/badges/badges'
import { Dropdown } from '@/components/base/dropdown/dropdown'
import { Input } from '@/components/base/input/input'
import { Slider } from '@/components/base/slider/slider'
import { Tooltip } from '@/components/base/tooltip/tooltip'
import { StringSelect } from '@/components/application/settings/StringSelect'
import { UiKitPortalHost } from '@/kira/uikit/PortalHost'
import { ReferenceCard } from './ReferenceCard'
import {
  LIBRARY_THUMB_SIZE_MAX,
  LIBRARY_THUMB_SIZE_MIN,
  libraryGridItemAspect,
  libraryGridItemChromeHeight,
  libraryGridMinPxFor,
  libraryListThumbWidthFor,
  libraryOverscan,
  libraryRowChromeHeights,
  libraryRowGutter,
  useLibraryThumbSizeStore,
} from './libraryLayout'

/**
 * Library drawer — Untitled UI React conversion (PHA 2, 2026-09-16):
 * extracted out of main.tsx (was `function EvidenceInbox` inline,
 * ~8520-9050, alongside `ReferenceCard`/`ReferenceTags`/the thumb-size
 * store — see ReferenceCard.tsx and libraryLayout.ts in this same folder).
 *
 * Header is 2 rows again (was 3 before this phase): row 1 is title + count +
 * the two icon actions, row 2 folds search into a collapsible field (an icon
 * button that expands into the kit `Input` in place, `isSearchOpen` below) so
 * it shares a row with List/Grid + the thumbnail-size `Slider` instead of
 * taking its own line. While search is open the browse controls step aside
 * (still one click away — closing search restores them) rather than
 * squeezing a 360px-wide drawer three ways.
 *
 * Kit components used: Button/Badge/BadgeWithButton/Dropdown/Input/Slider/
 * Tooltip/StringSelect (Select wrapper) here, Checkbox in ReferenceCard.tsx.
 * `Segmented` (components/Segmented.tsx, PHA 1) stays the List/Grid and
 * density control — it already *is* this app's ToggleGroup equivalent
 * (Settings' language/rail-icon toggles use the same component), so a
 * second, kit-native ToggleGroup here would read as a second control
 * language instead of one. The virtualized list/grid, reference cards, tag
 * strip and node rows are unchanged Ink & Paper layout, not a kit surface —
 * only the controls named in the brief moved.
 */
export function EvidenceInbox({
  allTags,
  browseMode,
  density,
  ideas,
  isCollapsed,
  images,
  links,
  panelMode,
  selectedTag,
  sortMode,
  totalCount,
  batchTag,
  searchQuery,
  status,
  downloadProgress,
  selectedReferenceIds,
  selected,
  lang,
  T,
  t,
  relationLabels,
  isTauriRuntime,
  onBrowseModeChange,
  onPanelModeChange: _onPanelModeChange,
  onCaptureClipboard,
  onCaptureScreen,
  onBatchTagChange,
  onApplyBatchTag,
  onClearSelection,
  onDensityChange,
  onExportContactSheet,
  onImportEagleWebItems,
  onImportFolder,
  onImportReferences,
  onSearchChange,
  onSelectedTagChange,
  onSortModeChange,
  onToggleReference,
  onSelect,
  onSelectIdea,
  onSelectLink,
  onToggleCollapsed: _onToggleCollapsed,
}: {
  allTags: string[]
  browseMode: LibraryBrowseMode
  density: LibraryDensity
  ideas: Idea[]
  isCollapsed: boolean
  images: EvidenceImage[]
  links: EvidenceLink[]
  panelMode: LibraryPanelMode
  selectedTag: string | null
  sortMode: SortMode
  totalCount: number
  batchTag: string
  searchQuery: string
  status: string
  downloadProgress: { imageId: string; title: string; progress: number | null } | null
  selectedReferenceIds: Set<string>
  selected: Selection
  lang: Lang
  T: React.ComponentType<{ k: string }>
  t: (key: string, vars?: Record<string, string>) => string
  relationLabels: Record<Relation, string>
  isTauriRuntime: boolean
  onBrowseModeChange: (mode: LibraryBrowseMode) => void
  onPanelModeChange: (mode: LibraryPanelMode) => void
  onCaptureClipboard: () => void
  onCaptureScreen: () => void
  onBatchTagChange: (value: string) => void
  onApplyBatchTag: () => void
  onClearSelection: () => void
  onDensityChange: (density: LibraryDensity) => void
  onExportContactSheet: () => void
  onImportEagleWebItems: () => void
  onImportFolder: () => void
  onImportReferences: (files: FileList | File[]) => void
  onSearchChange: (value: string) => void
  onSelectedTagChange: (tag: string) => void
  onSortModeChange: (mode: SortMode) => void
  onToggleReference: (id: string) => void
  onSelect: (id: string) => void
  onSelectIdea: (id: string) => void
  onSelectLink: (id: string) => void
  onToggleCollapsed: () => void
}) {
  const importInput = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [libraryScrollTop, setLibraryScrollTop] = useState(0)
  const [libraryViewportHeight, setLibraryViewportHeight] = useState(0)
  const [libraryViewportWidth, setLibraryViewportWidth] = useState(0)
  const thumbSizePct = useLibraryThumbSizeStore((state) => state.pct)
  const setThumbSizePct = useLibraryThumbSizeStore((state) => state.setPct)
  const unassigned = images.filter((image) => image.suggestions.length > 0)
  const selectedCount = selectedReferenceIds.size
  const panelCounts: Record<LibraryPanelMode, number> = {
    images: images.length,
    ideas: ideas.length,
    links: links.length,
  }
  const panelTitleKey: Record<LibraryPanelMode, string> = {
    images: 'library.panel.images',
    ideas: 'library.panel.ideas',
    links: 'library.panel.links',
  }
  const searchPlaceholderKey: Record<LibraryPanelMode, string> = {
    images: 'library.search.images',
    ideas: 'library.search.ideas',
    links: 'library.search.links',
  }
  const visibleIdeas = useMemo(
    () => ideas.filter((idea) => {
      const query = searchQuery.trim().toLowerCase()
      return !query || `${idea.title} ${idea.content} ${idea.notes ?? ''}`.toLowerCase().includes(query)
    }),
    [ideas, searchQuery],
  )
  const imageTitleById = useMemo(() => new Map(images.map((image) => [image.id, image.title])), [images])
  const ideaTitleById = useMemo(() => new Map(ideas.map((idea) => [idea.id, idea.title])), [ideas])
  const visibleLinks = useMemo(
    () => links.filter((link) => {
      const query = searchQuery.trim().toLowerCase()
      if (!query) return true
      const sourceTitle = imageTitleById.get(link.imageId) ?? link.sourceNodeId ?? ''
      const targetTitle = ideaTitleById.get(link.ideaId) ?? link.targetNodeId ?? ''
      return `${sourceTitle} ${targetTitle} ${link.relation} ${link.note}`.toLowerCase().includes(query)
    }),
    [ideaTitleById, imageTitleById, links, searchQuery],
  )
  // Thumbnail size slider: the grid's card width and the list's thumb width
  // both derive from the same 0-100 store value, at their own pixel ranges —
  // grid cards are much bigger than a list thumbnail, so a shared "percent
  // along the slider" keeps the two in step without forcing one literal px
  // value onto both layouts.
  const libraryThumbWidth = libraryListThumbWidthFor(thumbSizePct)
  const libraryThumbHeight = Math.round(libraryThumbWidth / 1.25)
  const rowHeight = libraryThumbHeight + libraryRowChromeHeights[density] + libraryRowGutter
  const totalListHeight = images.length * rowHeight
  const startIndex = Math.max(0, Math.floor(libraryScrollTop / rowHeight) - libraryOverscan)
  const visibleCount = Math.ceil((libraryViewportHeight || 1) / rowHeight) + libraryOverscan * 2
  const endIndex = Math.min(images.length, startIndex + visibleCount)
  const visibleImages = images.slice(startIndex, endIndex)

  // Grid virtualization windows by ROW, not by item — a CSS `auto-fill` grid
  // has no per-item position to transform individually, so this re-derives
  // the same column count the CSS's `repeat(auto-fill, minmax(var(--library-
  // grid-min), 1fr))` would produce, then renders (and vertically offsets)
  // only the visible rows' items, same overscan/scroll-driven approach as
  // the list above. These constants are read off styles.css and hand-kept
  // in sync — change `.image-grid-window`'s gap or `.image-list--grid`'s
  // padding (styles.css, near `.image-grid-window`) and update here too, or
  // the estimated column count drifts from what actually renders.
  const gridGap = 12 // var(--space-3)
  const gridItemMinWidth = libraryGridMinPxFor(thumbSizePct)
  const gridHorizontalPadding = 32 // var(--space-4) * 2, matches .image-list--grid
  const gridAvailableWidth = Math.max(0, libraryViewportWidth - gridHorizontalPadding)
  const gridColumns = Math.max(1, Math.floor((gridAvailableWidth + gridGap) / (gridItemMinWidth + gridGap)))
  const libraryGridItemHeight = Math.round(gridItemMinWidth / libraryGridItemAspect) + libraryGridItemChromeHeight
  const gridRowHeight = libraryGridItemHeight + gridGap
  const totalGridRows = Math.ceil(images.length / gridColumns)
  const totalGridHeight = totalGridRows * gridRowHeight
  const startGridRow = Math.max(0, Math.floor(libraryScrollTop / gridRowHeight) - libraryOverscan)
  const visibleGridRowCount = Math.ceil((libraryViewportHeight || 1) / gridRowHeight) + libraryOverscan * 2
  const endGridRow = Math.min(totalGridRows, startGridRow + visibleGridRowCount)
  const visibleGridImages = images.slice(startGridRow * gridColumns, endGridRow * gridColumns)
  const gridTranslateY = startGridRow * gridRowHeight

  useEffect(() => {
    const element = listRef.current
    if (!element) return

    function updateViewportSize() {
      setLibraryViewportHeight(element?.clientHeight ?? 0)
      setLibraryViewportWidth(element?.clientWidth ?? 0)
    }

    updateViewportSize()
    const observer = new ResizeObserver(updateViewportSize)
    observer.observe(element)
    return () => observer.disconnect()
    // `.image-list` only renders while panelMode === 'images' (EvidenceInbox
    // itself stays mounted across panel switches), so listRef.current is a
    // brand new node each time the user comes back to Images — re-run to
    // reattach, or the viewport size sticks at 0 and virtualization collapses.
  }, [panelMode])

  useEffect(() => {
    setLibraryScrollTop(0)
    listRef.current?.scrollTo({ top: 0 })
  }, [browseMode, density, searchQuery, selectedTag, sortMode])

  // Closing an empty search collapses the field back to its icon button —
  // matches the old always-visible field's behavior of just sitting empty,
  // but the collapsible version needs an explicit close action since there's
  // no persistent field to click back into.
  function closeSearch() {
    setIsSearchOpen(false)
  }

  return (
    <UiKitPortalHost className="kira-uikit library-uikit-host">
    <aside
      className={[
        'inbox panel library-drawer-panel',
        isDraggingFiles ? 'is-dragging-files' : '',
        isCollapsed ? 'is-closed' : '',
      ].filter(Boolean).join(' ')}
      onDragLeave={(event) => {
        const relatedTarget = event.relatedTarget as Node | null
        if (relatedTarget && event.currentTarget.contains(relatedTarget)) return
        setIsDraggingFiles(false)
      }}
      onDragOver={(event) => {
        if ([...event.dataTransfer.items].some((item) => item.kind === 'file')) {
          event.preventDefault()
          setIsDraggingFiles(true)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsDraggingFiles(false)
        onImportReferences(event.dataTransfer.files)
      }}
    >
      <div className="panel-header">
        <div className="panel-title-row">
          <h2>{t(panelTitleKey[panelMode])}</h2>
          <span className="panel-meta">
            {t(panelCounts[panelMode] === 1 ? 'library.meta.item' : 'library.meta.items', { count: String(panelCounts[panelMode]) })}
            {panelMode === 'images' && unassigned.length > 0 && (
              <Badge color="warning" size="sm">{t('library.meta.suggested', { count: String(unassigned.length) })}</Badge>
            )}
          </span>
        </div>
        <div className="panel-actions">
          <Tooltip title={t('library.aria.importImage')} delay={200}>
            <Button color="tertiary" size="sm" iconLeading={ImagePlus} aria-label={t('library.aria.importImage')} onPress={() => importInput.current?.click()} />
          </Tooltip>
          <Dropdown.Root>
            <Tooltip title={t('library.aria.toolsMenu')} delay={200}>
              <Button color="tertiary" size="sm" iconLeading={MoreHorizontal} aria-label={t('library.aria.toolsMenu')} />
            </Tooltip>
            <Dropdown.Popover className="w-64">
              <Dropdown.Menu
                aria-label={t('library.aria.toolsMenu')}
                onAction={(key) => {
                  if (key === 'paste') onCaptureClipboard()
                  else if (key === 'export') onExportContactSheet()
                  else if (key === 'screen') onCaptureScreen()
                  else if (key === 'eagle') onImportEagleWebItems()
                  else if (key === 'folder') onImportFolder()
                }}
              >
                <Dropdown.Item id="paste" label={t('library.tools.pasteUrl')} icon={Clipboard} />
                <Dropdown.Item id="export" label={t('library.tools.export')} icon={ArrowUpFromLine} />
                {isTauriRuntime && (
                  <>
                    <Dropdown.Item id="screen" label={t('library.tools.screen')} icon={Camera} />
                    <Dropdown.Item id="eagle" label={t('library.tools.eagle')} icon={Database} />
                    <Dropdown.Item id="folder" label={t('library.tools.folder')} icon={FolderOpen} />
                  </>
                )}
              </Dropdown.Menu>
              {panelMode === 'images' && (allTags.length > 0 || true) && (
                <div className="library-tools-extra">
                  <Dropdown.Separator />
                  {allTags.length > 0 && (
                    <div className="filter-chips" aria-label={t('library.aria.tagsGroup')}>
                      {allTags.slice(0, 5).map((tag) => (
                        <button
                          key={tag}
                          className={selectedTag === tag ? 'filter-chip is-active' : 'filter-chip'}
                          type="button"
                          onClick={() => onSelectedTagChange(tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="library-tools">
                    <StringSelect
                      aria-label={t('library.tools.sortAria')}
                      value={sortMode}
                      onChange={(value) => onSortModeChange(value as SortMode)}
                      options={[
                        { value: 'recent', label: t('library.tools.sortRecent') },
                        { value: 'title', label: t('library.tools.sortTitle') },
                        { value: 'source', label: t('library.tools.sortSource') },
                      ]}
                      size="sm"
                    />
                    <Segmented
                      className="density-toggle"
                      ariaLabel={t('library.aria.density')}
                      variant="radio"
                      value={density}
                      onChange={onDensityChange}
                      options={[
                        { value: 'compact', label: t('library.density.compact') },
                        { value: 'relaxed', label: t('library.density.relaxed') },
                      ]}
                    />
                  </div>
                </div>
              )}
            </Dropdown.Popover>
          </Dropdown.Root>
        </div>
        <input
          ref={importInput}
          aria-label={t('library.aria.importReferences')}
          className="file-input"
          accept="image/*"
          multiple
          type="file"
          onChange={(event) => {
            if (event.target.files) onImportReferences(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      <div className="library-toolbar-row" role="group" aria-label={t('library.aria.toolbarRow')}>
        {isSearchOpen ? (
          <div className="library-search-active">
            <Input
              aria-label={t('library.aria.toolbarRow')}
              size="sm"
              icon={Search}
              value={searchQuery}
              placeholder={t(searchPlaceholderKey[panelMode])}
              onChange={onSearchChange}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeSearch()
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- opening search is an explicit click; autofocus is the point.
              autoFocus
            />
            <Button
              color="tertiary"
              size="sm"
              iconLeading={X}
              aria-label={t('library.search.close')}
              onPress={() => {
                onSearchChange('')
                closeSearch()
              }}
            />
          </div>
        ) : (
          <>
            <Tooltip title={t('library.search.open')} delay={200}>
              <Button
                color="tertiary"
                size="sm"
                iconLeading={Search}
                aria-label={t('library.search.open')}
                onPress={() => setIsSearchOpen(true)}
              />
            </Tooltip>
            {panelMode === 'images' && (
              <>
                <Segmented
                  className="library-browse-mode"
                  ariaLabel={t('library.aria.browseMode')}
                  variant="radio"
                  value={browseMode}
                  onChange={onBrowseModeChange}
                  options={[
                    { value: 'list', label: t('library.browseMode.list') },
                    { value: 'grid', label: t('library.browseMode.grid') },
                  ]}
                />
                <div className="library-thumb-slider">
                  <ImageIcon aria-hidden="true" size={13} />
                  <Slider
                    className="library-thumb-slider-root"
                    aria-label={t('library.thumbSize.label')}
                    minValue={LIBRARY_THUMB_SIZE_MIN}
                    maxValue={LIBRARY_THUMB_SIZE_MAX}
                    step={5}
                    value={[thumbSizePct]}
                    onChange={(value) => setThumbSizePct(Array.isArray(value) ? value[0] : value)}
                  />
                  <ImagesIcon aria-hidden="true" size={15} />
                </div>
                {selectedTag ? (
                  <BadgeWithButton
                    color="gray"
                    size="sm"
                    buttonLabel={t('library.filter.remove', { tag: selectedTag })}
                    onButtonClick={() => onSelectedTagChange(selectedTag)}
                  >
                    {selectedTag}
                  </BadgeWithButton>
                ) : (
                  <Badge color="gray" size="sm" className="library-filtered-count">
                    {(searchQuery.trim() || totalCount !== images.length)
                      ? t('library.meta.filteredCount', { visible: String(images.length), total: String(totalCount) })
                      : t('library.meta.visible', { count: String(images.length) })}
                  </Badge>
                )}
              </>
            )}
          </>
        )}
      </div>

      {panelMode === 'images' ? (
        <div
          className={`image-list image-list--${density} image-list--${browseMode}`}
          style={{
            '--library-thumb-w': `${libraryThumbWidth}px`,
            '--library-thumb-h': `${libraryThumbHeight}px`,
            '--library-grid-min': `${gridItemMinWidth}px`,
          } as CSSProperties}
          data-rendered-count={browseMode === 'grid' ? visibleGridImages.length : visibleImages.length}
          data-total-count={images.length}
          ref={listRef}
          role="listbox"
          aria-label={t('library.aria.referenceImages')}
          aria-activedescendant={selected.type === 'image' ? `library-reference-${selected.id}` : undefined}
          tabIndex={0}
          onScroll={(event) => setLibraryScrollTop(event.currentTarget.scrollTop)}
          onKeyDown={(event) => {
            if (browseMode !== 'list' || images.length === 0) return
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
            event.preventDefault()
            const currentIndex = selected.type === 'image' ? images.findIndex((image) => image.id === selected.id) : -1
            const nextIndex = event.key === 'ArrowDown'
              ? Math.min(images.length - 1, currentIndex + 1)
              : Math.max(0, currentIndex - 1)
            const nextImage = images[nextIndex]
            if (!nextImage) return
            onSelect(nextImage.id)
            const element = listRef.current
            if (!element) return
            const rowTop = nextIndex * rowHeight
            const rowBottom = rowTop + rowHeight
            if (rowTop < element.scrollTop) element.scrollTo({ top: rowTop })
            else if (rowBottom > element.scrollTop + element.clientHeight) element.scrollTo({ top: rowBottom - element.clientHeight })
          }}
        >
          {images.length > 0 && browseMode === 'grid' ? (
            <div className="image-grid-outer" style={{ height: totalGridHeight }}>
              <div className="image-grid-window" style={{ transform: `translateY(${gridTranslateY}px)` }}>
                {visibleGridImages.map((image) => (
                  <ReferenceCard
                    key={image.id}
                    image={image}
                    variant="grid"
                    isSelected={selected.type === 'image' && selected.id === image.id}
                    isChecked={selectedReferenceIds.has(image.id)}
                    selectedTag={selectedTag}
                    lang={lang}
                    t={t}
                    onSelect={onSelect}
                    onToggle={onToggleReference}
                    onTagClick={onSelectedTagChange}
                  />
                ))}
              </div>
            </div>
          ) : images.length > 0 ? (
            <div className="image-list-window" style={{ height: totalListHeight }}>
              {visibleImages.map((image, visibleIndex) => {
                const index = startIndex + visibleIndex
                return (
                  <ReferenceCard
                    key={image.id}
                    image={image}
                    variant="row"
                    isSelected={selected.type === 'image' && selected.id === image.id}
                    isChecked={selectedReferenceIds.has(image.id)}
                    selectedTag={selectedTag}
                    lang={lang}
                    t={t}
                    style={{ transform: `translateY(${index * rowHeight}px)` }}
                    onSelect={onSelect}
                    onToggle={onToggleReference}
                    onTagClick={onSelectedTagChange}
                  />
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <strong><T k="library.empty.title" /></strong>
              <span><T k="library.empty.body" /></span>
              <button className="primary-button" type="button" onClick={() => importInput.current?.click()}>
                <T k="library.empty.import" />
              </button>
            </div>
          )}
        </div>
      ) : panelMode === 'ideas' ? (
        <div className="library-node-list" role="list" aria-label={t('library.panel.ideas')}>
          {visibleIdeas.map((idea) => (
            <button
              key={idea.id}
              className={selected.type === 'idea' && selected.id === idea.id ? 'library-node-row is-selected' : 'library-node-row'}
              type="button"
              onClick={() => onSelectIdea(idea.id)}
            >
              <Lightbulb size={15} />
              <span>
                <strong>{idea.title}</strong>
                <small>{idea.status} · {idea.content}</small>
              </span>
            </button>
          ))}
          {visibleIdeas.length === 0 && (
            <div className="empty-state">
              <strong>{t('library.ideas.empty.title')}</strong>
              <span>{t('library.ideas.empty.body')}</span>
            </div>
          )}
          {/* .library-node-row small is hidden by default and revealed on
              hover/selection in CSS — see .library-node-row small. */}
        </div>
      ) : (
        <div className="library-node-list" role="list" aria-label={t('library.panel.links')}>
          {visibleLinks.map((link) => (
            <button
              key={link.id}
              className={selected.type === 'link' && selected.id === link.id ? 'library-node-row is-selected' : 'library-node-row'}
              type="button"
              onClick={() => onSelectLink(link.id)}
            >
              <Workflow size={15} />
              <span>
                <strong>{relationLabels[link.relation]}</strong>
                <small>{imageTitleById.get(link.imageId) ?? link.imageId} {'->'} {ideaTitleById.get(link.ideaId) ?? link.ideaId}</small>
              </span>
            </button>
          ))}
          {visibleLinks.length === 0 && (
            <div className="empty-state">
              <strong>{t('library.links.empty.title')}</strong>
              <span>{t('library.links.empty.body')}</span>
            </div>
          )}
        </div>
      )}
      {isDraggingFiles && <div className="drop-copy">{t('library.dropHint')}</div>}
      {downloadProgress && (
        <div className="library-download-bar" role="status">
          <span className="library-download-label">
            {downloadProgress.progress != null
              ? t('library.download.labelWithProgress', { title: downloadProgress.title, percent: String(Math.round(downloadProgress.progress * 100)) })
              : t('library.download.label', { title: downloadProgress.title })}
          </span>
          <div className="library-download-track">
            <div
              className={downloadProgress.progress == null ? 'library-download-fill is-indeterminate' : 'library-download-fill'}
              style={downloadProgress.progress == null ? undefined : { transform: `scaleX(${Math.min(1, downloadProgress.progress)})` }}
            />
          </div>
        </div>
      )}
      <div className="library-footer">
        {selectedCount > 0 ? (
          <div className="batch-bar">
            <span className="selection-count">{t('library.batch.selected', { count: String(selectedCount) })}</span>
            <Input
              aria-label={t('library.batch.tagAria')}
              size="sm"
              value={batchTag}
              placeholder={t('library.batch.tagPlaceholder')}
              onChange={onBatchTagChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onApplyBatchTag()
              }}
            />
            <Button color="primary" size="sm" onPress={onApplyBatchTag}>
              {t('library.batch.apply')}
            </Button>
            <Button color="secondary" size="sm" onPress={onClearSelection}>
              {t('library.batch.clear')}
            </Button>
          </div>
        ) : (
          <div className="inbox-footer-action" role="status">
            <Sparkles size={14} />
            {status}
          </div>
        )}
      </div>
    </aside>
    </UiKitPortalHost>
  )
}

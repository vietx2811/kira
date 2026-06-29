import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { create, useStore } from 'zustand'
import { temporal } from 'zundo'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Effect, EffectState, getCurrentWindow } from '@tauri-apps/api/window'
import { open, save } from '@tauri-apps/plugin-dialog'
import { Rnd } from 'react-rnd'
import {
  ArrowDownToLine,
  Bot,
  Brain,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  CircleDot,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FilePlus2,
  FolderOpen,
  GitBranch,
  Image as ImageIcon,
  ImagePlus,
  Inspect,
  Link2,
  Lightbulb,
  LocateFixed,
  Maximize2,
  Minimize2,
  MousePointer2,
  MoreHorizontal,
  Network,
  PanelLeft,
  PanelRight,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Sparkles,
  Tag,
  Redo2,
  Undo2,
  Workflow,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react'
import { HexColorPicker } from 'react-colorful'
import { converter, formatHex } from 'culori'
import './styles.css'

type Relation = 'supports' | 'contrasts' | 'example' | 'mood' | 'material' | 'reference' | 'related' | 'derived-from' | 'contains'
type Selection =
  | { type: 'project' }
  | { type: 'idea'; id: string }
  | { type: 'image'; id: string }
  | { type: 'palette'; id: string }
  | { type: 'diagram'; id: string }
  | { type: 'placeholder'; id: string }
  | { type: 'link'; id: string }

type CanvasNodeSelection = Pick<GraphNodeRef, 'kind' | 'id'>

type ProjectTemplateId =
  | 'welcome'
  | 'moodboard_food_photo'
  | 'brand_identity'
  | 'brand_strategy_mindmap'
  | 'content_strategy'
  | 'kv_campaign_brief'

type AiNodeAction = 'summarize' | 'break_down' | 'synthesize' | 'find_gaps' | 'generate_variations'

type AiNodeScope = 'selected' | 'upstream_branch' | 'downstream_branch' | 'full_board'

type AiNodeRequest = {
  source: Pick<GraphNodeRef, 'kind' | 'id'>
  action: AiNodeAction
  scope: AiNodeScope
  prompt: string
}

type PendingDelete =
  | { type: 'idea'; id: string; title: string }
  | { type: 'image'; id: string; title: string }
  | { type: 'palette'; id: string; title: string }
  | { type: 'diagram'; id: string; title: string }
  | { type: 'placeholder'; id: string; title: string }
  | { type: 'link'; id: string; title: string }

type Idea = {
  id: string
  title: string
  body: string
  status: 'forming' | 'strong' | 'thin'
  x: number
  y: number
  importance?: number
  createdAt?: string
  addedAt?: string
  updatedAt?: string
  sourceUrl?: string
  notes?: string
}

type EvidenceImage = {
  id: string
  title: string
  source: string
  originApp?: string
  originId?: string
  sourcePath?: string
  palette: string[]
  tags: string[]
  suggestions: TagSuggestion[]
  x: number
  y: number
  thumb: string
  importance?: number
  createdAt?: string
  addedAt?: string
  updatedAt?: string
  sourceUrl?: string
  notes?: string
  width?: number
  height?: number
  sizeBytes?: number
  mimeType?: string
  fingerprint?: string
  perceptualHash?: string
}

type TagSuggestionRecord = {
  label: string
  source: string
  confidence: number
  status: 'pending' | 'accepted' | 'rejected'
}

type TagSuggestion = string | TagSuggestionRecord

type EvidenceLink = {
  id: string
  imageId: string
  ideaId: string
  sourceNodeId?: string
  targetNodeId?: string
  sourceKind?: GraphNodeKind
  targetKind?: GraphNodeKind
  relation: Relation
  note: string
  confidence: number
  createdAt?: string
  updatedAt?: string
}

type GraphNodeRef = {
  kind: GraphNodeKind
  id: string
  title: string
  x: number
  y: number
}

type PaletteHarmony = 'complementary' | 'analogous' | 'triadic' | 'split' | 'monochrome' | 'shades'

type PaletteNode = {
  id: string
  title: string
  colors: string[]
  algorithm: PaletteHarmony | 'manual' | 'image_extract'
  sourceImageId?: string
  x: number
  y: number
  importance?: number
  createdAt?: string
  addedAt?: string
  updatedAt?: string
  sourceUrl?: string
  notes?: string
}

type DiagramNode = {
  id: string
  title: string
  format: 'mermaid'
  source: string
  nodeIds: string[]
  x: number
  y: number
  importance?: number
  createdAt?: string
  addedAt?: string
  updatedAt?: string
  sourceUrl?: string
  notes?: string
}

type PlaceholderNode = {
  id: string
  title: string
  targetKind: 'image'
  x: number
  y: number
  importance?: number
  createdAt?: string
  addedAt?: string
  updatedAt?: string
  sourceUrl?: string
  notes?: string
}

type OutlineDraftSection = {
  id: string
  ideaId: string
  title: string
  summary: string
  referenceIds: string[]
  strength: 'strong' | 'forming' | 'thin'
}

type OutlineDraft = {
  id: string
  title: string
  createdAt: string
  sections: OutlineDraftSection[]
}

type ProjectKind = 'moodboard' | 'ideaboard'
type ProjectColorMode = 'dark' | 'light'
type ProjectAccentPreset = 'cyan' | 'amber' | 'sage' | 'violet' | 'rose' | 'custom'
type ProjectColorFormula = 'material' | 'fluent' | 'apple-glass' | 'carbon'

type ProjectMetadata = {
  title: string
  description: string
  author: string
  kind: ProjectKind
  styleNote: string
}

type ProjectAppearance = {
  colorMode: ProjectColorMode
  canvasColor: string
  colorFormula: ProjectColorFormula
  accentPreset: ProjectAccentPreset
  accentColor: string
}

type ProjectSnapshot = {
  version: 2
  project: ProjectMetadata
  appearance: ProjectAppearance
  ideas: Idea[]
  images: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  placeholders: PlaceholderNode[]
  aiSettings: AiSettingsSnapshot
  versionState: ProjectVersionState
  versionHistory: ProjectVersionRecord[]
  nodeVersions: NodeVersionRecord[]
  links: EvidenceLink[]
  outlineDrafts: OutlineDraft[]
  slidesConfig?: SlidesConfig
}

type ProjectVersionState = {
  schemaVersion: 1
  currentBranchId: string
  currentVersionId?: string
  branches: ProjectBranchRecord[]
}

type ProjectBranchRecord = {
  id: string
  name: string
  createdAt: string
  headVersionId?: string
}

type ProjectVersionRecord = {
  id: string
  label: string
  createdAt: string
  trigger?: 'manual' | 'restore' | 'pre_present' | 'auto'
  branchId?: string
  parentVersionId?: string
  restoredFromId?: string
  snapshotJson: string
}

type NodeVersionTrigger =
  | 'user_edit'
  | 'image_added'
  | 'image_removed'
  | 'score_updated'
  | 'label_changed'
  | 'merge'
  | 'split'
  | 'restore'
  | 'created'

type NodeVersionRecord = {
  id: string
  nodeId: string
  nodeKind: GraphNodeKind
  versionNumber: number
  createdAt: string
  trigger: NodeVersionTrigger
  snapshotJson: string
  fields: string[]
  summary: string
  branchId?: string
  restoredFromId?: string
  aiGenerated: boolean
  note?: string
}

type ProjectPackageInfo = {
  path: string
  manifestPath: string
  sqlitePath: string
}

type OcrResult = {
  text: string
  suggestions: string[]
}

type LocalModelAvailability = {
  available: boolean
  status: string
  reason?: string
}

type LocalModelTagResult = {
  available: boolean
  status: string
  raw: string
  suggestions: string[]
}

type KiraCapturePayload = {
  kiraCapture: 1
  kind: 'image' | 'page'
  url: string
  title: string
  source: string
  pageUrl?: string
  tags?: string[]
  note?: string
  targetNode?: CanvasNodeSelection
  createIdeaTitle?: string
  captureIntent?: 'undecided' | 'target-node' | 'create-or-select'
  capturedAt: string
}

type KiraCaptureContextNode = CanvasNodeSelection & {
  title: string
  subtitle?: string
  snippet?: string
  thumb?: string
}

type KiraCaptureContext = {
  app: 'kira'
  fileTitle: string
  filePath?: string
  nodes: KiraCaptureContextNode[]
  updatedAt: string
}

type LibraryDensity = 'compact' | 'relaxed'
type LibraryBrowseMode = 'list' | 'grid'
type LibraryPanelMode = 'images' | 'ideas' | 'links'
type SortMode = 'recent' | 'title' | 'source'
type GraphNodeKind = 'idea' | 'image' | 'palette' | 'diagram' | 'placeholder'
type GraphMode = 'edit' | 'discover'
type GraphScope = 'all' | 'linked' | 'selection'
type RelationFilter = 'all' | Relation
type DiscoveryFilter = 'all' | 'candidates' | 'open'
type GraphCap = 75 | 150 | 300
type OutlineFilter = 'all' | 'strong' | 'weak'
type ActiveView = 'Canvas' | '3D' | 'Slides' | 'Outline' | 'Settings'
type GraphOrganizeMode = 'manual' | 'cluster' | 'flow' | 'timeline' | 'palette' | 'importance' | 'grid'
type CanvasTool = 'select' | 'link'
type DroppedReferencePayload =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: URL; source: 'uri-list' | 'html' | 'plain' }
  | { kind: 'existing'; imageId: string }
type DroppedReferenceTarget =
  | { kind: 'canvas'; position: Pick<Idea, 'x' | 'y'> }
  | { kind: 'idea'; ideaId: string; position?: Pick<Idea, 'x' | 'y'> }
  | { kind: 'image'; imageId: string }
  | { kind: 'placeholder'; placeholderId: string; position?: Pick<Idea, 'x' | 'y'> }
type AiTaskKind =
  | 'tag_reference'
  | 'classify_reference'
  | 'find_similar'
  | 'generate_palette'
  | 'rebalance_palette'
  | 'generate_outline'
  | 'generate_node'
  | 'summarize_diagram'
type AiProviderType =
  | 'apple_foundation'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'ollama'
  | 'lm_studio'
  | 'custom_openai_compatible'
  | 'codex'
type AiAuthMode = 'local' | 'api_key' | 'oauth' | 'openai_compatible'
type AiProviderStatus = 'connected' | 'unavailable' | 'billing_separate' | 'key_missing'
type AiRoutingMode = 'local_only' | 'prefer_local' | 'selected_remote'
type AiProviderProfile = {
  id: string
  type: AiProviderType
  name: string
  authMode: AiAuthMode
  baseUrl?: string
  model: string
  status: AiProviderStatus
  secretRef?: string
  defaultFor: AiTaskKind[]
  discoveredModels?: string[]
  lastTestedAt?: string
  lastMessage?: string
  userManaged?: boolean
}
type AiSettingsSnapshot = {
  providers: AiProviderProfile[]
  routingMode: AiRoutingMode
  selectedProviderId: string
}
type AiProviderTestResult = {
  connected: boolean
  status: string
  message: string
}
type AiModelListResult = {
  status: string
  models: string[]
}
type AiGenerationResult = {
  status: string
  content: string
}
type ExtensionTargetStatus = {
  installed: boolean
  available: boolean
  detail: string
  installPath: string
}
type ExtensionInstallStatus = {
  chrome: ExtensionTargetStatus
  safari: ExtensionTargetStatus
}
type AiTaskRoute = {
  task: AiTaskKind
  providerId: string | null
  providerName: string
  status: AiProviderStatus | 'local_fallback'
  reason: string
}
type CanvasHistoryEntry = Pick<ProjectSnapshot, 'ideas' | 'images' | 'palettes' | 'diagrams' | 'placeholders' | 'links'> & {
  selection: Selection
}
type CanvasHistoryStore = {
  entry: CanvasHistoryEntry | null
  setEntry: (entry: CanvasHistoryEntry) => void
}
type DiscoverySuggestion = {
  imageId: string
  ideaId: string
  score: number
}

const useCanvasHistoryStore = create<CanvasHistoryStore>()(
  temporal(
    (set) => ({
      entry: null,
      setEntry: (entry) => set({ entry }),
    }),
    {
      limit: 50,
      partialize: (state) => ({ entry: state.entry }),
    },
  ),
)

// ── Lightweight bilingual i18n (en / vi) ─────────────────────────────────────
type Lang = 'en' | 'vi'

const UI_STRINGS: Record<string, { en: string; vi: string }> = {
  'lang.label': { en: 'Language', vi: 'Ngôn ngữ' },
  'lang.hint': { en: 'Interface language for labels and panels.', vi: 'Ngôn ngữ hiển thị cho nhãn và bảng điều khiển.' },
  'inspector.title': { en: 'Inspector', vi: 'Chi tiết' },
  'inspector.name': { en: 'Name', vi: 'Tên' },
  'inspector.description': { en: 'Description', vi: 'Mô tả' },
  'inspector.author': { en: 'Author', vi: 'Tác giả' },
  'inspector.kind': { en: 'Kind', vi: 'Loại' },
  'inspector.styleNote': { en: 'Style note', vi: 'Ghi chú phong cách' },
  'library.title': { en: 'Library', vi: 'Thư viện' },
}

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem('kira:lang')
    return stored === 'vi' || stored === 'en' ? stored : 'en'
  } catch {
    return 'en'
  }
}

const useLangStore = create<{ lang: Lang; setLang: (lang: Lang) => void }>()((set) => ({
  lang: readStoredLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem('kira:lang', lang)
    } catch {
      // ignore persistence failures (private mode, etc.)
    }
    set({ lang })
  },
}))

/** Inline translated label. Subscribes to the language store so it re-renders on toggle. */
function T({ k }: { k: string }): React.ReactElement {
  const lang = useLangStore((state) => state.lang)
  return <>{UI_STRINGS[k]?.[lang] ?? k}</>
}

const storageKey = 'kira.project.v2'
const onboardingStorageKey = 'kira.onboarding.v1.completed'
const inspectorLinkedListLimit = 8
const outlineReferenceLimit = 6
const libraryOverscan = 5
const duplicateCandidateThreshold = 8
const libraryRowHeights: Record<LibraryDensity, number> = {
  compact: 92,
  relaxed: 108,
}
const libraryGridItemHeight = 184

type GraphMetrics = {
  mode: GraphMode
  cap: GraphCap
  totalNodes: number
  visibleNodes: number
  visibleIdeas: number
  visibleImages: number
  visibleLinks: number
  visibleSuggestions: number
}

type SlideLayout = {
  id: string
  kind: 'cover' | 'concept' | 'moodboard'
  idea?: Idea
  kicker: string
  title: string
  summary: string
  speakerNote: string
  references: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  relationCount: number
  layout: 'cover' | 'focus' | 'grid' | 'stack' | 'palette' | 'diagram' | 'moodboard'
  layoutReason: string
  relationMix: Relation[]
  accent: string
}
type SlideDeckTemplate = 'Minimal' | 'Editorial' | 'Moodboard Grid' | 'Timeline'
type SlideDeckMeta = {
  template: SlideDeckTemplate
  estimatedDuration: string
  theme: {
    background: string
    accent: string
    font: string
  }
}
type SlideLayoutMode = 'auto' | 'focus' | 'grid' | 'stack' | 'palette' | 'diagram'
type SlideLayoutChoice = SlideLayout['layout']
type SlideCustomization = {
  layoutOverride?: SlideLayoutChoice
  titleOverride?: string
  summaryOverride?: string
  accentOverride?: string
  hidden?: boolean
}
type SlidesConfig = {
  template: SlideDeckTemplate | 'auto'
  order: string[]
  customizations: Record<string, SlideCustomization>
}
type GlassStatus = 'browser' | 'native' | 'fallback'

type KiraDevApi = {
  loadFixture: (referenceCount?: number) => ProjectSnapshot
  loadDuplicateFixture: () => ProjectSnapshot
  resetSeed: () => ProjectSnapshot
  verifyLayout: () => LayoutVerificationReport
  organizeAndVerify: (mode?: GraphOrganizeMode) => Promise<LayoutVerificationReport>
  saveVersion: (label?: string) => { id: string; branchId?: string; label: string }
  createBranch: (name: string) => { id: string; name: string; sourceHead?: string }
  switchBranch: (branchId: string) => { currentBranchId: string; currentVersionId?: string }
  renameFirstIdea: (title: string) => { id: string; title: string } | null
  ideaTitle: (ideaId: string) => string | null
  versionState: () => ProjectVersionState
  slideReport: (layoutMode?: SlideLayoutMode) => {
    count: number
    template: SlideDeckTemplate
    estimatedDuration: string
    layouts: string[]
    hasCover: boolean
    hasMoodboard: boolean
    speakerNotes: number
  }
  slideExportHtml: (layoutMode?: SlideLayoutMode) => string
  snapshot: () => {
    ideas: number
    images: number
    palettes: number
    diagrams: number
    placeholders: number
    links: number
    outlineDrafts: number
    nodeVersions: number
    selection: Selection
    graph?: GraphMetrics
    layout?: LayoutVerificationReport
  }
}

type KiraWindow = Window & {
  __kiraDev?: KiraDevApi
  __kiraGraphMetrics?: GraphMetrics
}

const ideasSeed: Idea[] = [
  {
    id: 'idea-ritual-tools',
    title: 'Ritual tools as quiet interfaces',
    body: 'Objects that invite attention through restraint, texture, and repeated handling.',
    status: 'strong',
    x: 45,
    y: 33,
  },
  {
    id: 'idea-atmospheric-index',
    title: 'Atmospheric index of memory',
    body: 'A system where visual fragments behave like evidence around a half-formed thesis.',
    status: 'forming',
    x: 67,
    y: 56,
  },
  {
    id: 'idea-material-grammar',
    title: 'Material grammar before style',
    body: 'The material signal should carry more meaning than decorative composition.',
    status: 'thin',
    x: 39,
    y: 70,
  },
]

const imagesSeed: EvidenceImage[] = [
  {
    id: 'img-01',
    title: 'brushed altar object',
    source: 'archive.design',
    palette: ['#b8a17f', '#242425', '#6e7768'],
    tags: ['warm metal', 'ritual', 'close crop'],
    suggestions: ['handled object', 'quiet utility'],
    x: 25,
    y: 27,
    thumb: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=320&q=80',
    fingerprint: 'seed:img-01',
  },
  {
    id: 'img-02',
    title: 'soft shadow shelves',
    source: 'museum.ref',
    palette: ['#c5bbb0', '#383734', '#7a8476'],
    tags: ['soft shadow', 'archive', 'sage'],
    suggestions: ['memory system'],
    x: 57,
    y: 24,
    thumb: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=320&q=80',
    fingerprint: 'seed:img-02',
  },
  {
    id: 'img-03',
    title: 'paper field study',
    source: 'fieldnotes.io',
    palette: ['#d7ccb7', '#54514b', '#b17a50'],
    tags: ['paper', 'annotation', 'taxonomy'],
    suggestions: ['index card', 'outline seed'],
    x: 75,
    y: 32,
    thumb: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=320&q=80',
    fingerprint: 'seed:img-03',
  },
  {
    id: 'img-04',
    title: 'stone threshold',
    source: 'architecture.today',
    palette: ['#a7a29a', '#26292b', '#59656a'],
    tags: ['threshold', 'stone', 'monument'],
    suggestions: ['spatial silence'],
    x: 18,
    y: 65,
    thumb: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=320&q=80',
    fingerprint: 'seed:img-04',
  },
  {
    id: 'img-05',
    title: 'instrument detail',
    source: 'industrial.design',
    palette: ['#c7aa78', '#111214', '#5d6462'],
    tags: ['instrument', 'precision', 'amber'],
    suggestions: ['functional ritual'],
    x: 53,
    y: 75,
    thumb: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=320&q=80',
    fingerprint: 'seed:img-05',
  },
  {
    id: 'img-06',
    title: 'blue archival wall',
    source: 'gallery.systems',
    palette: ['#7994a4', '#202833', '#c3c9c7'],
    tags: ['cool wall', 'archive', 'sequence'],
    suggestions: ['evidence grid'],
    x: 79,
    y: 64,
    thumb: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=320&q=80&sat=-30',
    fingerprint: 'seed:img-06',
  },
]

const linksSeed: EvidenceLink[] = [
  {
    id: 'link-01',
    imageId: 'img-01',
    ideaId: 'idea-ritual-tools',
    relation: 'supports',
    note: 'Object reads as tool and symbol without becoming decorative.',
    confidence: 0.86,
  },
  {
    id: 'link-02',
    imageId: 'img-05',
    ideaId: 'idea-ritual-tools',
    relation: 'example',
    note: 'Precision detail supports the handled-interface direction.',
    confidence: 0.72,
  },
  {
    id: 'link-03',
    imageId: 'img-02',
    ideaId: 'idea-atmospheric-index',
    relation: 'supports',
    note: 'Archive shelving gives the idea a soft information architecture.',
    confidence: 0.78,
  },
  {
    id: 'link-04',
    imageId: 'img-03',
    ideaId: 'idea-atmospheric-index',
    relation: 'reference',
    note: 'Field note structure can become the outline grammar.',
    confidence: 0.67,
  },
  {
    id: 'link-05',
    imageId: 'img-04',
    ideaId: 'idea-material-grammar',
    relation: 'mood',
    note: 'Material weight helps keep the direction grounded.',
    confidence: 0.58,
  },
]

const relationLabels: Record<Relation, string> = {
  supports: 'supports',
  contrasts: 'contrasts',
  example: 'example',
  mood: 'mood',
  material: 'material',
  reference: 'reference',
  related: 'related',
  'derived-from': 'derived-from',
  contains: 'contains',
}

const graphScopeLabels: Record<GraphScope, string> = {
  all: 'All',
  linked: 'Linked',
  selection: 'Focus',
}

const graphModeLabels: Record<GraphMode, string> = {
  edit: 'Edit',
  discover: 'Discover',
}

const discoveryFilterLabels: Record<DiscoveryFilter, string> = {
  all: 'All',
  candidates: 'Candidates',
  open: 'Open',
}

const graphCapLabels: Record<GraphCap, string> = {
  75: '75',
  150: '150',
  300: '300',
}

const graphOrganizeLabels: Record<GraphOrganizeMode, string> = {
  manual: 'Manual',
  cluster: 'Cluster by Idea',
  flow: 'Evidence Flow',
  timeline: 'Timeline',
  palette: 'Palette',
  importance: 'Importance Focus',
  grid: 'Grid Cleanup',
}

const projectTemplateDefinitions: Array<{
  id: ProjectTemplateId
  title: string
  description: string
  promptSeed: string
}> = [
  {
    id: 'welcome',
    title: 'Welcome.kira',
    description: 'A guided board that explains canvas, library, browser capture, and AI setup.',
    promptSeed: 'Teach me how to use KIRA as a creative workspace.',
  },
  {
    id: 'moodboard_food_photo',
    title: 'Moodboard Food Photo',
    description: 'Build a direction around appetite, lighting, plating, props, and shot planning.',
    promptSeed: 'Create a food photography moodboard for a premium seasonal menu.',
  },
  {
    id: 'brand_identity',
    title: 'Brand Identity',
    description: 'Map brand promise, audience, visual principles, tone, and identity system.',
    promptSeed: 'Create a brand identity workspace for a new premium consumer product.',
  },
  {
    id: 'brand_strategy_mindmap',
    title: 'Brand Strategy Mindmap',
    description: 'Explore audience, positioning, competitors, messaging pillars, and proof.',
    promptSeed: 'Create a brand strategy mindmap for a product entering a crowded category.',
  },
  {
    id: 'content_strategy',
    title: 'Content Strategy',
    description: 'Plan audience intent, pillars, channels, cadence, and measurement signals.',
    promptSeed: 'Create a content strategy board for a launch campaign.',
  },
  {
    id: 'kv_campaign_brief',
    title: 'KV / Campaign Brief',
    description: 'Frame objective, key visual idea, message, deliverables, and rollout.',
    promptSeed: 'Create a key visual and campaign brief for a new product launch.',
  },
]

const aiNodeActionLabels: Record<AiNodeAction, string> = {
  summarize: 'Summarize',
  break_down: 'Break down',
  synthesize: 'Synthesize',
  find_gaps: 'Find gaps',
  generate_variations: 'Generate variations',
}

const aiNodeActionPrompts: Record<AiNodeAction, string> = {
  summarize: 'Summarize the key information into one compact direction.',
  break_down: 'Break this into practical subnodes, decisions, and next questions.',
  synthesize: 'Synthesize the relevant information into a sharper creative direction.',
  find_gaps: 'Find missing evidence, weak assumptions, and questions to investigate.',
  generate_variations: 'Generate alternative directions that still fit this branch.',
}

const aiNodeScopeLabels: Record<AiNodeScope, string> = {
  selected: 'Selected node',
  upstream_branch: 'Upstream branch',
  downstream_branch: 'Downstream branch',
  full_board: 'Full board',
}

const outlineFilterLabels: Record<OutlineFilter, string> = {
  all: 'All',
  strong: 'Strong',
  weak: 'Needs work',
}

const aiTaskLabels: Record<AiTaskKind, string> = {
  tag_reference: 'Tag reference',
  classify_reference: 'Classify reference',
  find_similar: 'Find similar',
  generate_palette: 'Generate palette',
  rebalance_palette: 'Rebalance palette',
  generate_outline: 'Generate outline',
  generate_node: 'Generate node',
  summarize_diagram: 'Summarize diagram',
}

const aiProviderTypeLabels: Record<AiProviderType, string> = {
  apple_foundation: 'Apple Foundation Models',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  lm_studio: 'LM Studio',
  custom_openai_compatible: 'OpenAI-compatible',
  codex: 'Codex',
}

const aiProviderStatusLabels: Record<AiProviderStatus, string> = {
  connected: 'connected',
  unavailable: 'unavailable',
  billing_separate: 'billing separate',
  key_missing: 'key missing',
}

const aiProviderStatusCopy: Record<AiProviderStatus, string> = {
  connected: 'Ready for routed tasks.',
  unavailable: 'Configured, but not reachable from this device.',
  billing_separate: 'Subscription and API billing are separate.',
  key_missing: 'Save a key in secure storage before testing.',
}

const aiRoutingLabels: Record<AiRoutingMode, string> = {
  local_only: 'Local only',
  prefer_local: 'Prefer local, fallback remote',
  selected_remote: 'Selected remote provider',
}

const providerConnectionNotes = [
  {
    id: 'openai',
    title: 'OpenAI / ChatGPT',
    providerId: 'openai',
    truth: 'A ChatGPT subscription cannot be connected as API billing. KIRA needs an OpenAI Platform API key.',
    action: 'Paste an OpenAI API key',
    href: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    title: 'Anthropic / Claude',
    providerId: 'anthropic',
    truth: 'A Claude subscription cannot be connected as API billing. KIRA needs an Anthropic Console API key.',
    action: 'Paste an Anthropic API key',
    href: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'local',
    title: 'Local models',
    providerId: 'apple-foundation',
    truth: 'Local providers keep routing available when remote billing or keys are not ready.',
    action: 'Check local runtime',
    href: '',
  },
  {
    id: 'codex',
    title: 'Codex (ChatGPT login)',
    providerId: 'codex',
    truth: 'KIRA can sign you in with ChatGPT (or reuse an existing Codex login). Auth is owned by the Codex CLI; billing follows your ChatGPT/Codex plan.',
    action: 'Sign in with ChatGPT',
    href: '',
  },
]

// Where to mint a personal API key for the "bring your own key" flow, per provider type.
function aiProviderKeyHelp(type: AiProviderType): { href: string; label: string } | null {
  switch (type) {
    case 'openai':
      return { href: 'https://platform.openai.com/api-keys', label: 'Get an OpenAI API key' }
    case 'anthropic':
      return { href: 'https://console.anthropic.com/settings/keys', label: 'Get an Anthropic API key' }
    case 'codex':
      return null
    default:
      return null
  }
}

const extensionInstallTargets = [
  {
    id: 'chrome',
    title: 'Chrome / Chromium',
    status: 'Manual load',
    primary: 'Open bundled dist',
    secondary: 'Open extensions page',
    instruction: 'Open the bundled dist folder, then in Chrome Extensions enable Developer mode and Load unpacked.',
    path: 'Bundled in KIRA.app/Contents/Resources/.../extension/dist',
    href: 'chrome://extensions',
    installActionId: 'chrome_dist',
    settingsActionId: 'chrome',
  },
  {
    id: 'safari',
    title: 'Safari',
    status: 'Container app',
    primary: 'Open bundled app',
    secondary: 'Open Safari settings',
    instruction: 'Open the bundled KIRA Safari app once, then enable KIRA Capture in Safari Extensions.',
    path: 'Bundled in KIRA.app/Contents/Resources/.../KIRA Safari.app',
    href: 'x-apple.systempreferences:com.apple.Safari-Settings.extension',
    installActionId: 'safari_app',
    settingsActionId: 'safari',
  },
]

function defaultExtensionInstallStatus(): ExtensionInstallStatus {
  return {
    chrome: {
      installed: false,
      available: true,
      detail: 'Desktop status check not run',
      installPath: 'Bundled in KIRA.app/Contents/Resources/.../extension/dist',
    },
    safari: {
      installed: false,
      available: true,
      detail: 'Desktop status check not run',
      installPath: 'Bundled in KIRA.app/Contents/Resources/.../KIRA Safari.app',
    },
  }
}

function useDismissableLayer(active: boolean, ignoreSelector: string, onDismiss: () => void) {
  useEffect(() => {
    if (!active) return

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest(ignoreSelector)) return
      onDismiss()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      onDismiss()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [active, ignoreSelector, onDismiss])
}

const defaultAiProviderProfiles: AiProviderProfile[] = [
  {
    id: 'apple-foundation',
    type: 'apple_foundation',
    name: 'Apple Foundation Models',
    authMode: 'local',
    model: 'system default',
    status: 'unavailable',
    defaultFor: ['tag_reference', 'classify_reference', 'generate_outline', 'generate_node', 'summarize_diagram'],
  },
  {
    id: 'openai',
    type: 'openai',
    name: 'OpenAI Platform',
    authMode: 'api_key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    status: 'key_missing',
    defaultFor: ['generate_outline', 'generate_node', 'summarize_diagram'],
  },
  {
    id: 'anthropic',
    type: 'anthropic',
    name: 'Anthropic Console',
    authMode: 'api_key',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-6',
    status: 'key_missing',
    defaultFor: ['generate_outline', 'generate_node'],
  },
  {
    id: 'gemini',
    type: 'gemini',
    name: 'Gemini API',
    authMode: 'api_key',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-1.5-pro',
    status: 'key_missing',
    defaultFor: ['classify_reference', 'generate_palette', 'generate_node'],
  },
  {
    id: 'openrouter',
    type: 'openrouter',
    name: 'OpenRouter',
    authMode: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'auto',
    status: 'key_missing',
    defaultFor: ['find_similar', 'generate_outline', 'generate_node'],
  },
  {
    id: 'ollama',
    type: 'ollama',
    name: 'Ollama',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    status: 'unavailable',
    defaultFor: ['tag_reference', 'classify_reference', 'generate_node'],
  },
  {
    id: 'lm-studio',
    type: 'lm_studio',
    name: 'LM Studio',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    status: 'unavailable',
    defaultFor: ['tag_reference', 'generate_node'],
  },
  {
    id: 'codex',
    type: 'codex',
    name: 'Codex CLI (ChatGPT login)',
    authMode: 'oauth',
    model: 'gpt-5.5',
    status: 'unavailable',
    defaultFor: ['generate_outline', 'generate_node', 'summarize_diagram'],
  },
]

const aiProviderTemplates: Record<Exclude<AiProviderType, 'apple_foundation'>, Omit<AiProviderProfile, 'id' | 'userManaged'>> = {
  openai: {
    type: 'openai',
    name: 'OpenAI Platform',
    authMode: 'api_key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    status: 'key_missing',
    defaultFor: ['generate_outline', 'generate_node', 'summarize_diagram'],
  },
  anthropic: {
    type: 'anthropic',
    name: 'Anthropic Console',
    authMode: 'api_key',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-6',
    status: 'key_missing',
    defaultFor: ['generate_outline', 'generate_node'],
  },
  gemini: {
    type: 'gemini',
    name: 'Gemini API',
    authMode: 'api_key',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-1.5-pro',
    status: 'key_missing',
    defaultFor: ['classify_reference', 'generate_palette', 'generate_node'],
  },
  openrouter: {
    type: 'openrouter',
    name: 'OpenRouter',
    authMode: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'auto',
    status: 'key_missing',
    defaultFor: ['find_similar', 'generate_outline', 'generate_node'],
  },
  ollama: {
    type: 'ollama',
    name: 'Ollama',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    status: 'unavailable',
    defaultFor: ['tag_reference', 'classify_reference', 'generate_node'],
  },
  lm_studio: {
    type: 'lm_studio',
    name: 'LM Studio',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    status: 'unavailable',
    defaultFor: ['tag_reference', 'generate_node'],
  },
  custom_openai_compatible: {
    type: 'custom_openai_compatible',
    name: 'Custom OpenAI-compatible',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:8000/v1',
    model: 'model-id',
    status: 'key_missing',
    defaultFor: ['generate_node'],
  },
  codex: {
    type: 'codex',
    name: 'Codex CLI (ChatGPT login)',
    authMode: 'oauth',
    model: 'gpt-5.5',
    status: 'unavailable',
    defaultFor: ['generate_outline', 'generate_node', 'summarize_diagram'],
  },
}

function defaultAiSettingsSnapshot(): AiSettingsSnapshot {
  return {
    providers: defaultAiProviderProfiles,
    routingMode: 'prefer_local',
    selectedProviderId: 'openai',
  }
}

const projectAccentPresets: Array<{ id: ProjectAccentPreset; label: string; color: string }> = [
  { id: 'cyan', label: 'Cyan', color: '#84cdbc' },
  { id: 'amber', label: 'Amber', color: '#dfae67' },
  { id: 'sage', label: 'Sage', color: '#9cae83' },
  { id: 'violet', label: 'Violet', color: '#b7a4df' },
  { id: 'rose', label: 'Rose', color: '#d98779' },
  { id: 'custom', label: 'Custom', color: '#84cdbc' },
]

const projectColorFormulas: Array<{ id: ProjectColorFormula; label: string; description: string }> = [
  { id: 'material', label: 'Material', description: 'tonal harmony' },
  { id: 'fluent', label: 'Fluent', description: 'calm analogous' },
  { id: 'apple-glass', label: 'Apple Glass', description: 'low-chroma glass' },
  { id: 'carbon', label: 'Carbon', description: 'cool complement' },
]

function defaultProjectMetadata(): ProjectMetadata {
  return {
    title: 'KIRA Project',
    description: 'Creative workspace file.',
    author: '',
    kind: 'moodboard',
    styleNote: '',
  }
}

function defaultProjectAppearance(): ProjectAppearance {
  const accentColor = projectAccentPresets[0].color
  const canvasColor = deriveCanvasFromAccent(accentColor, 'material', 'dark')
  return {
    colorMode: 'dark',
    canvasColor,
    colorFormula: 'material',
    accentPreset: 'cyan',
    accentColor,
  }
}

function defaultSlidesConfig(): SlidesConfig {
  return { template: 'auto', order: [], customizations: {} }
}

const slideLayoutChoices: SlideLayoutChoice[] = ['cover', 'focus', 'grid', 'stack', 'palette', 'diagram', 'moodboard']
const slideDeckTemplateChoices: SlideDeckTemplate[] = ['Minimal', 'Editorial', 'Moodboard Grid', 'Timeline']

function normalizeSlidesConfig(value: unknown): SlidesConfig {
  const fallback = defaultSlidesConfig()
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<SlidesConfig>
  const template = candidate.template === 'auto' || (typeof candidate.template === 'string' && slideDeckTemplateChoices.includes(candidate.template as SlideDeckTemplate))
    ? candidate.template as SlidesConfig['template']
    : 'auto'
  const order = Array.isArray(candidate.order) ? candidate.order.filter((id): id is string => typeof id === 'string') : []
  const customizations: Record<string, SlideCustomization> = {}
  if (candidate.customizations && typeof candidate.customizations === 'object') {
    for (const [key, raw] of Object.entries(candidate.customizations)) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as SlideCustomization
      const next: SlideCustomization = {}
      if (item.layoutOverride && slideLayoutChoices.includes(item.layoutOverride)) next.layoutOverride = item.layoutOverride
      if (typeof item.titleOverride === 'string') next.titleOverride = item.titleOverride
      if (typeof item.summaryOverride === 'string') next.summaryOverride = item.summaryOverride
      if (typeof item.accentOverride === 'string') next.accentOverride = item.accentOverride
      if (item.hidden === true) next.hidden = true
      if (Object.keys(next).length > 0) customizations[key] = next
    }
  }
  return { template, order, customizations }
}

function existingProviderTypeCount(providers: AiProviderProfile[], type: AiProviderType) {
  return providers.filter((provider) => provider.type === type).length
}

function App() {
  const initialProject = useMemo(() => readProjectSnapshot(), [])
  const [projectMetadata, setProjectMetadata] = useState(initialProject.project)
  const [projectAppearance, setProjectAppearance] = useState(initialProject.appearance)
  const [ideas, setIdeas] = useState(initialProject.ideas)
  const [images, setImages] = useState(initialProject.images)
  const [palettes, setPalettes] = useState(initialProject.palettes)
  const [diagrams, setDiagrams] = useState(initialProject.diagrams)
  const [placeholders, setPlaceholders] = useState(initialProject.placeholders)
  const [links, setLinks] = useState(initialProject.links)
  const [versionState, setVersionState] = useState(initialProject.versionState)
  const [versionHistory, setVersionHistory] = useState(initialProject.versionHistory)
  const [nodeVersions, setNodeVersions] = useState(initialProject.nodeVersions)
  const [outlineDrafts, setOutlineDrafts] = useState(initialProject.outlineDrafts)
  const [slidesConfig, setSlidesConfig] = useState<SlidesConfig>(() => normalizeSlidesConfig(initialProject.slidesConfig))
  const [lastSavedHash, setLastSavedHash] = useState(() => JSON.stringify(initialProject))
  const [projectPackage, setProjectPackage] = useState<ProjectPackageInfo | null>(null)
  const [selection, setSelection] = useState<Selection>({ type: 'project' })
  const [activeView, setActiveView] = useState<ActiveView>('Canvas')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [density, setDensity] = useState<LibraryDensity>('compact')
  const [libraryBrowseMode, setLibraryBrowseMode] = useState<LibraryBrowseMode>('list')
  const [libraryPanelMode, setLibraryPanelMode] = useState<LibraryPanelMode>('images')
  const [libraryDrawerWidth, setLibraryDrawerWidth] = useState(360)
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [batchTag, setBatchTag] = useState('')
  const [libraryStatus, setLibraryStatus] = useState('Ready')
  const [outlineStatus, setOutlineStatus] = useState('Ready')
  const [slideshowStatus, setSlideshowStatus] = useState('Ready')
  const [linkCreationRelation, setLinkCreationRelation] = useState<Relation>('supports')
  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasTool>('select')
  const [pendingLinkSource, setPendingLinkSource] = useState<Pick<GraphNodeRef, 'kind' | 'id'> | null>(null)
  const [ocrRunningImageId, setOcrRunningImageId] = useState<string | null>(null)
  const [ocrStatusByImageId, setOcrStatusByImageId] = useState<Record<string, string>>({})
  const [localModelAvailable, setLocalModelAvailable] = useState(false)
  const [localModelStatus, setLocalModelStatus] = useState('Not checked')
  const [aiProviders, setAiProviders] = useState<AiProviderProfile[]>(initialProject.aiSettings.providers)
  const [aiRoutingMode, setAiRoutingMode] = useState<AiRoutingMode>(initialProject.aiSettings.routingMode)
  const [selectedAiProviderId, setSelectedAiProviderId] = useState(initialProject.aiSettings.selectedProviderId)
  const [activeAiProviderId, setActiveAiProviderId] = useState(initialProject.aiSettings.selectedProviderId)
  const [aiSettingsStatus, setAiSettingsStatus] = useState('Local-first routing is active')
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => !readOnboardingCompleted())
  const [extensionInstallStatus, setExtensionInstallStatus] = useState<ExtensionInstallStatus>(() => defaultExtensionInstallStatus())
  const [modelRunningImageId, setModelRunningImageId] = useState<string | null>(null)
  const [modelStatusByImageId, setModelStatusByImageId] = useState<Record<string, string>>({})
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<string>>(new Set())
  const [ideaTitleFocusId, setIdeaTitleFocusId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false)
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false)
  const [isLibraryFloating, setIsLibraryFloating] = useState(false)
  const [isInspectorFloating, setIsInspectorFloating] = useState(false)
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false)
  const [glassStatus, setGlassStatus] = useState<GlassStatus>(() => (isTauriRuntime() ? 'fallback' : 'browser'))
  const pendingCanvasHistoryCommitRef = useRef(false)
  const suppressCanvasHistoryCommitRef = useRef(false)
  const lastPrePresentContentHashRef = useRef('')
  const projectStateRef = useRef({
    ideas,
    images,
    palettes,
    diagrams,
    placeholders,
  })
  const recentCaptureKeysRef = useRef(new Map<string, number>())
  const canUndoCanvas = useStore(useCanvasHistoryStore.temporal, (state) => state.pastStates.length > 0)
  const canRedoCanvas = useStore(useCanvasHistoryStore.temporal, (state) => state.futureStates.length > 0)
  projectStateRef.current = {
    ideas,
    images,
    palettes,
    diagrams,
    placeholders,
  }
  const projectSnapshot = useMemo(
    () => toProjectSnapshot(ideas, images, links, outlineDrafts, palettes, diagrams, placeholders, {
      providers: aiProviders,
      routingMode: aiRoutingMode,
      selectedProviderId: selectedAiProviderId,
    }, versionHistory, versionState, nodeVersions, projectMetadata, projectAppearance, slidesConfig),
    [aiProviders, aiRoutingMode, diagrams, ideas, images, links, nodeVersions, outlineDrafts, palettes, placeholders, projectAppearance, projectMetadata, selectedAiProviderId, slidesConfig, versionHistory, versionState],
  )
  const projectHash = useMemo(() => JSON.stringify(projectSnapshot), [projectSnapshot])
  const projectContentHash = useMemo(
    () => JSON.stringify({
      ideas,
      images,
      links,
      outlineDrafts,
      palettes,
      diagrams,
      placeholders,
      project: projectMetadata,
      appearance: projectAppearance,
      aiSettings: {
        providers: aiProviders,
        routingMode: aiRoutingMode,
        selectedProviderId: selectedAiProviderId,
      },
      branchId: versionState.currentBranchId,
    }),
    [aiProviders, aiRoutingMode, diagrams, ideas, images, links, outlineDrafts, palettes, placeholders, projectAppearance, projectMetadata, selectedAiProviderId, versionState.currentBranchId],
  )
  const selected = useMemo(
    () => resolveSelection(selection, projectMetadata, projectAppearance, ideas, images, links, palettes, diagrams, placeholders),
    [selection, projectMetadata, projectAppearance, ideas, images, links, palettes, diagrams, placeholders],
  )
  const captureContext = useMemo(
    () => createKiraCaptureContext(projectPackage, ideas, images, palettes, diagrams, placeholders),
    [diagrams, ideas, images, palettes, placeholders, projectPackage],
  )
  const visibleImages = useMemo(
    () => filterImages(images, searchQuery, selectedTag, sortMode),
    [images, searchQuery, selectedTag, sortMode],
  )

  function startLibraryDrawerResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = libraryDrawerWidth

    function handlePointerMove(moveEvent: PointerEvent) {
      setLibraryDrawerWidth(clamp(startWidth + moveEvent.clientX - startX, 320, 480))
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }
  const libraryTags = useMemo(() => getLibraryTags(images), [images])
  const latestOutlineDraft = outlineDrafts[0]

  useEffect(() => {
    if (!isTauriRuntime()) {
      setGlassStatus('browser')
      return
    }
    void getCurrentWindow().setEffects({
      effects: [
        Effect.UnderWindowBackground,
        Effect.HeaderView,
        Effect.Mica,
        Effect.Blur,
      ],
      state: EffectState.FollowsWindowActiveState,
      radius: 14,
      color: { red: 26, green: 28, blue: 26, alpha: 82 },
    }).then(() => {
      setGlassStatus('native')
    }).catch(() => {
      setGlassStatus('fallback')
      // Window effects are platform-dependent; transparent CSS remains the fallback.
    })
  }, [])

  const outlineSections = useMemo(
    () => latestOutlineDraft
      ? outlineSectionsFromDraft(latestOutlineDraft, ideas, images)
      : buildOutline(ideas, images, links),
    [ideas, images, latestOutlineDraft, links],
  )
  const projectDiagnostics = useMemo(
    () => buildProjectDiagnostics(ideas, images, links),
    [ideas, images, links],
  )
  const aiTaskRoutes = useMemo(
    () =>
      (Object.keys(aiTaskLabels) as AiTaskKind[]).map((task) =>
        selectAiProviderForTask(task, aiProviders, aiRoutingMode, selectedAiProviderId),
      ),
    [aiProviders, aiRoutingMode, selectedAiProviderId],
  )

  async function refreshFoundationModelAvailability() {
    if (!isTauriRuntime()) {
      setLocalModelAvailable(false)
      setLocalModelStatus('Desktop app required')
      setAiProviders((current) =>
        current.map((provider) =>
          provider.id === 'apple-foundation' ? { ...provider, status: 'unavailable' } : provider,
        ),
      )
      return
    }
    try {
      const availability = await checkNativeFoundationModelAvailability()
      setLocalModelAvailable(availability.available)
      setLocalModelStatus(availability.reason || availability.status)
      setAiProviders((current) =>
        current.map((provider) =>
          provider.id === 'apple-foundation'
            ? { ...provider, status: availability.available ? 'connected' : 'unavailable' }
            : provider,
        ),
      )
    } catch {
      setLocalModelAvailable(false)
      setLocalModelStatus('Unavailable')
      setAiProviders((current) =>
        current.map((provider) =>
          provider.id === 'apple-foundation' ? { ...provider, status: 'unavailable' } : provider,
        ),
      )
    }
  }

  async function refreshExtensionInstallStatus() {
    try {
      const status = await getNativeExtensionInstallStatus()
      setExtensionInstallStatus(status)
      setAiSettingsStatus('Extension status refreshed')
    } catch (error) {
      setExtensionInstallStatus(defaultExtensionInstallStatus())
      setAiSettingsStatus(error instanceof Error ? error.message : 'Extension status unavailable')
    }
  }

  useEffect(() => {
    if (!isTauriRuntime()) return
    let cancelled = false

    function readLastProjectPath(): string | null {
      try {
        return window.localStorage.getItem('kira:lastProjectPath')
      } catch {
        return null
      }
    }

    void (async () => {
      const lastPath = readLastProjectPath()
      if (lastPath) {
        try {
          const snapshot = await openNativeProjectPackage(lastPath)
          if (cancelled) return
          if (snapshot) {
            applyProjectSnapshot(snapshot)
            setProjectPackage({
              path: lastPath,
              manifestPath: `${lastPath}/manifest.json`,
              sqlitePath: `${lastPath}/project.sqlite`,
            })
            return
          }
        } catch {
          // last project is gone or unreadable; fall back to the default project
        }
      }
      const snapshot = await openNativeProjectPackage()
      if (!cancelled && snapshot) applyProjectSnapshot(snapshot)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Remember the most recently opened/saved project so the next launch reopens it.
  useEffect(() => {
    const path = projectPackage?.path
    if (!path) return
    try {
      window.localStorage.setItem('kira:lastProjectPath', path)
    } catch {
      // ignore persistence failures (private mode, quota, etc.)
    }
  }, [projectPackage?.path])

  useEffect(() => {
    if (!isTauriRuntime()) return
    void updateNativeCaptureContext(captureContext).catch(() => undefined)
  }, [captureContext])

  useEffect(() => {
    void refreshFoundationModelAvailability()
  }, [])

  useEffect(() => {
    void refreshExtensionInstallStatus()
  }, [])

  useEffect(() => {
    if (!isTauriRuntime()) return

    let unlisten: (() => void) | undefined
    let disposed = false
    void listen<string>('kira:capture', (event) => {
      const capture = parseKiraCapturePayload(event.payload)
      if (!capture) return
      handleKiraCapture(capture)
    }).then((cleanup) => {
      if (disposed) {
        cleanup()
        return
      }
      unlisten = cleanup
    })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    function handleGlobalKeydown(event: KeyboardEvent) {
      if (isSettingsShortcut(event)) {
        event.preventDefault()
        setActiveView('Settings')
        return
      }

      if (isCreateIdeaShortcut(event) && !isEditableEventTarget(event.target)) {
        event.preventDefault()
        createIdea({ focusTitle: true })
        return
      }

      if (isDeleteShortcut(event) && !isEditableEventTarget(event.target)) {
        event.preventDefault()
        deleteCurrentSelection()
        return
      }

      if (isUndoShortcut(event) && !isEditableEventTarget(event.target)) {
        event.preventDefault()
        undoCanvas()
        return
      }

      if (isRedoShortcut(event) && !isEditableEventTarget(event.target)) {
        event.preventDefault()
        redoCanvas()
        return
      }

      if (isSaveShortcut(event) && !isEditableEventTarget(event.target)) {
        event.preventDefault()
        void saveProject()
        return
      }

      if (isDuplicateShortcut(event) && !isEditableEventTarget(event.target)) {
        event.preventDefault()
        duplicateCurrentSelection()
        return
      }

      if (isCreateLinkShortcut(event) && !isEditableEventTarget(event.target)) {
        event.preventDefault()
        setActiveView('Canvas')
        setPendingLinkSource(null)
        setActiveCanvasTool((current) => current === 'link' ? 'select' : 'link')
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  }, [deleteCurrentSelection, duplicateCurrentSelection, ideas.length, redoCanvas, saveProject, undoCanvas])

  useEffect(() => {
    if (!isDevRuntime()) return

    const devWindow = window as KiraWindow
    devWindow.__kiraDev = {
      loadFixture(referenceCount = 120) {
        const snapshot = createBenchmarkProjectSnapshot(referenceCount)
        applyProjectSnapshot(snapshot)
        return snapshot
      },
      loadDuplicateFixture() {
        const snapshot = createDuplicateCandidateProjectSnapshot()
        applyProjectSnapshot(snapshot)
        return snapshot
      },
      resetSeed() {
        const snapshot = toProjectSnapshot(ideasSeed, imagesSeed, linksSeed)
        window.localStorage.removeItem(storageKey)
        applyProjectSnapshot(snapshot)
        return snapshot
      },
      verifyLayout() {
        return verifyGraphLayout(ideas, images, links, palettes, diagrams, placeholders)
      },
      async organizeAndVerify(mode = 'flow') {
        const layout = await organizeGraphLayout(mode, ideas, images, links, selection, palettes, diagrams, placeholders)
        setIdeas(layout.ideas)
        setImages(layout.images)
        setPalettes(layout.palettes)
        setDiagrams(layout.diagrams)
        setPlaceholders(layout.placeholders)
        return verifyGraphLayout(layout.ideas, layout.images, links, layout.palettes, layout.diagrams, layout.placeholders)
      },
      saveVersion(label = `QA Version ${versionHistory.length + 1}`) {
        const record = saveVersionCheckpoint(label, 'manual')
        return { id: record.id, branchId: record.branchId, label: record.label }
      },
      createBranch(name: string) {
        const branchName = name.trim() || `QA Branch ${versionState.branches.length + 1}`
        const id = uniqueBranchId(branchName, versionState.branches)
        const sourceHead = versionState.branches.find((branch) => branch.id === versionState.currentBranchId)?.headVersionId ?? versionState.currentVersionId
        createVersionBranch(branchName)
        return { id, name: branchName, sourceHead }
      },
      switchBranch(branchId: string) {
        const branch = versionState.branches.find((candidate) => candidate.id === branchId)
        switchVersionBranch(branchId)
        return {
          currentBranchId: branch?.id ?? versionState.currentBranchId,
          currentVersionId: branch?.headVersionId ?? versionState.currentVersionId,
        }
      },
      renameFirstIdea(title: string) {
        const firstIdea = ideas[0]
        if (!firstIdea) return null
        updateIdea(firstIdea.id, { title })
        return { id: firstIdea.id, title }
      },
      ideaTitle(ideaId: string) {
        return ideas.find((idea) => idea.id === ideaId)?.title ?? null
      },
      versionState() {
        return versionState
      },
      slideReport(layoutMode = 'auto') {
        const slides = applySlideLayoutMode(buildSlideLayouts(ideas, images, links, palettes, diagrams), layoutMode)
        const deckMeta = buildSlideDeckMeta(slides)
        return {
          count: slides.length,
          template: deckMeta.template,
          estimatedDuration: deckMeta.estimatedDuration,
          layouts: slides.map((slide) => slide.layout),
          hasCover: slides.some((slide) => slide.kind === 'cover'),
          hasMoodboard: slides.some((slide) => slide.kind === 'moodboard'),
          speakerNotes: slides.filter((slide) => slide.speakerNote.trim().length > 0).length,
        }
      },
      slideExportHtml(layoutMode = 'auto') {
        const slides = applySlideLayoutMode(buildSlideLayouts(ideas, images, links, palettes, diagrams), layoutMode)
        return slideLayoutsToHtml(slides, {
          title: slides[0]?.title ?? 'KIRA Slides',
          generatedAt: new Date().toISOString(),
          deckMeta: buildSlideDeckMeta(slides),
        })
      },
      snapshot() {
        return {
          ideas: ideas.length,
          images: images.length,
          palettes: palettes.length,
          diagrams: diagrams.length,
          placeholders: placeholders.length,
          links: links.length,
          outlineDrafts: outlineDrafts.length,
          nodeVersions: nodeVersions.length,
          selection,
          graph: devWindow.__kiraGraphMetrics,
          layout: verifyGraphLayout(ideas, images, links, palettes, diagrams, placeholders),
        }
      },
    }

    return () => {
      delete devWindow.__kiraDev
    }
  }, [diagrams, ideas, images, links, nodeVersions, outlineDrafts, palettes, placeholders, selection, versionHistory, versionState])

  useEffect(() => {
    resetCanvasHistory(currentCanvasHistoryEntry())
  }, [])

  useEffect(() => {
    if (suppressCanvasHistoryCommitRef.current) {
      suppressCanvasHistoryCommitRef.current = false
      return
    }
    if (!pendingCanvasHistoryCommitRef.current) return
    pendingCanvasHistoryCommitRef.current = false
    useCanvasHistoryStore.getState().setEntry(currentCanvasHistoryEntry())
  }, [diagrams, ideas, images, links, palettes, placeholders, selection])

  function applyProjectSnapshot(snapshot: ProjectSnapshot) {
    const hash = JSON.stringify(snapshot)
    setProjectMetadata(snapshot.project)
    setProjectAppearance(snapshot.appearance)
    setIdeas(snapshot.ideas)
    setImages(snapshot.images)
    setPalettes(snapshot.palettes)
    setDiagrams(snapshot.diagrams)
    setPlaceholders(snapshot.placeholders)
    setLinks(snapshot.links)
    setOutlineDrafts(snapshot.outlineDrafts)
    setSlidesConfig(normalizeSlidesConfig(snapshot.slidesConfig))
    setAiProviders(snapshot.aiSettings.providers)
    setAiRoutingMode(snapshot.aiSettings.routingMode)
    setSelectedAiProviderId(snapshot.aiSettings.selectedProviderId)
    setActiveAiProviderId(snapshot.aiSettings.selectedProviderId)
    setVersionState(snapshot.versionState)
    setVersionHistory(snapshot.versionHistory)
    setNodeVersions(snapshot.nodeVersions)
    setSelectedReferenceIds(new Set())
    setSelection({ type: 'project' })
    setLastSavedHash(hash)
    window.localStorage.setItem(storageKey, hash)
    resetCanvasHistory({
      ideas: snapshot.ideas,
      images: snapshot.images,
      palettes: snapshot.palettes,
      diagrams: snapshot.diagrams,
      placeholders: snapshot.placeholders,
      links: snapshot.links,
      selection: { type: 'project' },
    })
  }

  function currentAiSettingsSnapshot(): AiSettingsSnapshot {
    return {
      providers: aiProviders,
      routingMode: aiRoutingMode,
      selectedProviderId: selectedAiProviderId,
    }
  }

  function applyProjectTemplate(templateId: ProjectTemplateId) {
    const snapshot = createProjectTemplateSnapshot(templateId, currentAiSettingsSnapshot())
    applyProjectSnapshot(snapshot)
    setProjectPackage(null)
    setLibraryStatus(`${templateProjectMetadata(templateId).title} loaded`)
  }

  function openWelcomeProject(completeOnboarding = false) {
    applyProjectTemplate('welcome')
    setActiveView('Canvas')
    if (completeOnboarding) {
      writeOnboardingCompleted(true)
      setIsOnboardingOpen(false)
    }
  }

  function generatePromptStarter(prompt: string) {
    const snapshot = createPromptStarterSnapshot(prompt, currentAiSettingsSnapshot())
    applyProjectSnapshot(snapshot)
    setProjectPackage(null)
    setLibraryStatus('Prompt starter generated')
  }

  function currentCanvasHistoryEntry(): CanvasHistoryEntry {
    return {
      ideas,
      images,
      palettes,
      diagrams,
      placeholders,
      links,
      selection,
    }
  }

  function updateProjectMetadata(patch: Partial<ProjectMetadata>) {
    setProjectMetadata((current) => ({ ...current, ...patch }))
  }

  function updateProjectAppearance(patch: Partial<ProjectAppearance>) {
    setProjectAppearance((current) => {
      const nextPreset = patch.accentPreset ?? current.accentPreset
      const presetColor = projectAccentPresets.find((preset) => preset.id === nextPreset)?.color
      const nextFormula = normalizeProjectColorFormula(patch.colorFormula ?? current.colorFormula)
      const explicitAccent = patch.accentColor ? normalizeHexInput(patch.accentColor) : undefined
      const presetAccent = patch.accentPreset && patch.accentPreset !== 'custom' ? presetColor : undefined
      const nextAccentColor = normalizeHexInput(explicitAccent ?? presetAccent ?? current.accentColor)
      const nextColorMode = patch.colorMode ?? current.colorMode
      const generatedCanvas = deriveCanvasFromAccent(nextAccentColor, nextFormula, nextColorMode)
      const shouldRegenerateCanvas = Boolean(patch.accentColor || patch.accentPreset || patch.colorFormula || patch.colorMode)
      return {
        ...current,
        ...patch,
        colorMode: shouldRegenerateCanvas ? inferCanvasColorMode(generatedCanvas) : current.colorMode,
        canvasColor: shouldRegenerateCanvas ? generatedCanvas : normalizeHexInput(patch.canvasColor ?? current.canvasColor),
        colorFormula: nextFormula,
        accentPreset: explicitAccent ? 'custom' : nextPreset,
        accentColor: nextAccentColor,
      }
    })
  }

  function updateSlidesConfig(patch: Partial<SlidesConfig>) {
    setSlidesConfig((current) => ({ ...current, ...patch }))
  }

  function restoreCanvasHistoryEntry(entry: CanvasHistoryEntry) {
    suppressCanvasHistoryCommitRef.current = true
    setIdeas(entry.ideas)
    setImages(entry.images)
    setPalettes(entry.palettes)
    setDiagrams(entry.diagrams)
    setPlaceholders(entry.placeholders)
    setLinks(entry.links)
    setSelection(entry.selection)
  }

  function resetCanvasHistory(entry: CanvasHistoryEntry) {
    const temporalHistory = useCanvasHistoryStore.temporal.getState()
    temporalHistory.pause()
    useCanvasHistoryStore.getState().setEntry(entry)
    temporalHistory.clear()
    temporalHistory.resume()
    pendingCanvasHistoryCommitRef.current = false
    suppressCanvasHistoryCommitRef.current = false
  }

  function pushCanvasHistory() {
    pendingCanvasHistoryCommitRef.current = true
  }

  function undoCanvas() {
    const temporalHistory = useCanvasHistoryStore.temporal.getState()
    if (temporalHistory.pastStates.length === 0) return
    temporalHistory.undo()
    const entry = useCanvasHistoryStore.getState().entry
    if (entry) restoreCanvasHistoryEntry(entry)
  }

  function redoCanvas() {
    const temporalHistory = useCanvasHistoryStore.temporal.getState()
    if (temporalHistory.futureStates.length === 0) return
    temporalHistory.redo()
    const entry = useCanvasHistoryStore.getState().entry
    if (entry) restoreCanvasHistoryEntry(entry)
  }

  function acceptSuggestion(imageId: string, tag: string) {
    const acceptedTag = normalizeTag(tag)
    if (!acceptedTag) return

    setImages((current) =>
      current.map((image) =>
        image.id === imageId
          ? {
              ...image,
              tags: image.tags.includes(acceptedTag) ? image.tags : [...image.tags, acceptedTag],
              suggestions: removeSuggestionByLabel(image.suggestions, acceptedTag),
            }
          : image,
      ),
    )
  }

  function rejectSuggestion(imageId: string, tag: string) {
    const rejectedTag = normalizeTag(tag)
    if (!rejectedTag) return

    setImages((current) =>
      current.map((image) =>
        image.id === imageId
          ? {
              ...image,
              suggestions: removeSuggestionByLabel(image.suggestions, rejectedTag),
            }
          : image,
      ),
    )
  }

  function appendReferences(imported: EvidenceImage[], fallbackStatus: string) {
    if (imported.length === 0) return
    let addedCount = 0
    let skippedCount = 0
    let lastAdded: EvidenceImage | undefined

    setImages((current) => {
      const existingKeys = new Set(current.map(referenceDuplicateKey))
      const next: EvidenceImage[] = []
      for (const image of imported) {
        const duplicateKey = referenceDuplicateKey(image)
        if (existingKeys.has(duplicateKey)) {
          skippedCount += 1
          continue
        }
        existingKeys.add(duplicateKey)
        next.push(image)
      }
      addedCount = next.length
      lastAdded = next.at(-1)
      return next.length > 0 ? [...current, ...next] : current
    })

    if (lastAdded) setSelection({ type: 'image', id: lastAdded.id })
    setLibraryStatus(
      skippedCount > 0
        ? `${addedCount} added · ${skippedCount} duplicate${skippedCount === 1 ? '' : 's'} skipped`
        : fallbackStatus,
    )
  }

  function handleKiraCapture(capture: KiraCapturePayload) {
    const state = projectStateRef.current
    const reference = createReferenceFromCapture(capture, state.images.length)
    const duplicateKey = referenceDuplicateKey(reference)
    const now = Date.now()
    const recentCaptureKeys = recentCaptureKeysRef.current
    for (const [key, timestamp] of recentCaptureKeys) {
      if (now - timestamp > 5000) recentCaptureKeys.delete(key)
    }
    if (recentCaptureKeys.has(duplicateKey) || state.images.some((image) => referenceDuplicateKey(image) === duplicateKey)) {
      setLibraryStatus('Duplicate browser capture skipped')
      return
    }
    recentCaptureKeys.set(duplicateKey, now)

    if (capture.createIdeaTitle?.trim()) {
      attachCaptureToNewIdea(reference, capture.createIdeaTitle.trim())
      return
    }

    const target = capture.targetNode
      ? resolveGraphNodeRef(capture.targetNode.id, state.ideas, state.images, state.palettes, state.diagrams, state.placeholders)
      : null

    if (target) {
      attachCaptureToGraphNode(reference, target)
      return
    }

    appendReferences([reference], '1 browser capture imported')
  }

  function attachCaptureToNewIdea(reference: EvidenceImage, title: string) {
    pushCanvasHistory()
    const timestamp = nowIso()
    const idea: Idea = {
      id: `idea-capture-${Date.now()}`,
      title,
      body: 'Created from browser capture.',
      status: 'thin',
      x: clamp(reference.x - 14, 8, 92),
      y: clamp(reference.y, 8, 92),
      importance: 1,
      sourceUrl: reference.sourceUrl,
      createdAt: timestamp,
      addedAt: timestamp,
      updatedAt: timestamp,
    }
    const positioned = positionReference(reference, { x: clamp(idea.x + 12, 8, 92), y: idea.y })
    setIdeas((current) => [...current, idea])
    setImages((current) => [...current, positioned])
    setLinks((current) => [
      ...current,
      {
        id: `link-${Date.now()}-capture`,
        imageId: positioned.id,
        ideaId: idea.id,
        sourceNodeId: positioned.id,
        targetNodeId: idea.id,
        sourceKind: 'image',
        targetKind: 'idea',
        relation: 'supports',
        note: 'Browser capture created this idea.',
        confidence: 0.64,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])
    setSelection({ type: 'idea', id: idea.id })
    setIdeaTitleFocusId(idea.id)
    setActiveView('Canvas')
    setLibraryStatus(`Created ${idea.title}`)
  }

  function attachCaptureToGraphNode(reference: EvidenceImage, target: GraphNodeRef) {
    if (target.kind === 'image') {
      replaceReferenceWithReference(target.id, reference, `Replaced reference with ${reference.title}`)
      setActiveView('Canvas')
      return
    }

    if (target.kind === 'placeholder') {
      attachPlaceholderReference(target.id, reference)
      setActiveView('Canvas')
      return
    }

    pushCanvasHistory()
    const timestamp = nowIso()
    const positioned = positionReference(reference, { x: clamp(target.x + 10, 8, 92), y: clamp(target.y + 8, 8, 92) })
    setImages((current) => [...current, positioned])
    setLinks((current) => [
      ...current,
      {
        id: `link-${Date.now()}-capture`,
        imageId: positioned.id,
        ideaId: target.kind === 'idea' ? target.id : ideas[0]?.id ?? '',
        sourceNodeId: positioned.id,
        targetNodeId: target.id,
        sourceKind: 'image',
        targetKind: target.kind,
        relation: target.kind === 'idea' ? 'supports' : 'related',
        note: 'Browser capture dropped onto this node.',
        confidence: 0.62,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])
    setSelection({ type: 'image', id: positioned.id })
    setActiveView('Canvas')
    setLibraryStatus(`Attached ${positioned.title}`)
  }

  async function importReferences(files: FileList | File[]) {
    const imageFiles = [...files].filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const imported = await Promise.all(
      imageFiles.map((file, index) => createReferenceFromFile(file, images.length + index)),
    )
    appendReferences(imported, `${imported.length} reference${imported.length === 1 ? '' : 's'} imported`)
  }

  async function createReferenceFromDroppedPayload(payload: Exclude<DroppedReferencePayload, { kind: 'existing' }>, index: number) {
    if (payload.kind === 'file') return createReferenceFromFile(payload.file, index)
    return createReferenceFromUrl(payload.url, index)
  }

  function positionReference(reference: EvidenceImage, position?: Pick<Idea, 'x' | 'y'>) {
    if (!position) return reference
    return {
      ...reference,
      x: clamp(position.x, 5, 95),
      y: clamp(position.y, 6, 94),
    }
  }

  function replaceReferenceWithReference(imageId: string, replacement: EvidenceImage, status: string) {
    const current = images.find((candidate) => candidate.id === imageId)
    if (!current) return
    pushCanvasHistory()
    setImages((items) =>
      items.map((image) =>
        image.id === imageId
          ? {
              ...replacement,
              id: image.id,
              x: image.x,
              y: image.y,
              importance: image.importance,
              createdAt: image.createdAt,
              addedAt: image.addedAt,
              updatedAt: nowIso(),
              notes: image.notes,
              sourceUrl: replacement.sourceUrl ?? image.sourceUrl,
            }
          : image,
      ),
    )
    setSelection({ type: 'image', id: imageId })
    setLibraryStatus(status)
  }

  function attachPlaceholderReference(placeholderId: string, reference: EvidenceImage) {
    const placeholder = placeholders.find((candidate) => candidate.id === placeholderId)
    if (!placeholder) return
    const converted: EvidenceImage = {
      ...reference,
      id: `img-placeholder-${Date.now()}`,
      x: placeholder.x,
      y: placeholder.y,
      importance: placeholder.importance,
      notes: placeholder.notes,
      sourceUrl: reference.sourceUrl ?? placeholder.sourceUrl,
      createdAt: placeholder.createdAt,
      addedAt: placeholder.addedAt,
      updatedAt: nowIso(),
    }
    pushCanvasHistory()
    setImages((current) => [...current, converted])
    setPlaceholders((current) => current.filter((candidate) => candidate.id !== placeholderId))
    setLinks((current) =>
      current.map((link) => {
        if (!linkTouchesNode(link, 'placeholder', placeholderId)) return link
        const sourceTouches = (link.sourceNodeId ?? link.imageId) === placeholderId
        const targetTouches = (link.targetNodeId ?? link.ideaId) === placeholderId
        return {
          ...link,
          imageId: converted.id,
          sourceNodeId: sourceTouches ? converted.id : link.sourceNodeId,
          targetNodeId: targetTouches ? converted.id : link.targetNodeId,
          sourceKind: sourceTouches ? 'image' : link.sourceKind,
          targetKind: targetTouches ? 'image' : link.targetKind,
          updatedAt: nowIso(),
        }
      }),
    )
    setSelection({ type: 'image', id: converted.id })
    setLibraryStatus(`Attached ${converted.title}`)
  }

  async function handleDroppedReference(payload: DroppedReferencePayload, target: DroppedReferenceTarget) {
    if (payload.kind === 'existing') {
      if (target.kind === 'idea') {
        createNodeLink({ kind: 'image', id: payload.imageId }, { kind: 'idea', id: target.ideaId }, 'supports')
        return
      }
      if (target.kind === 'image') {
        replaceReferenceFromExistingImage(target.imageId, payload.imageId)
        return
      }
      if (target.kind === 'placeholder') {
        const source = images.find((image) => image.id === payload.imageId)
        if (source) attachPlaceholderReference(target.placeholderId, source)
        return
      }
      setSelection({ type: 'image', id: payload.imageId })
      return
    }

    const created = await createReferenceFromDroppedPayload(payload, images.length)
    if (target.kind === 'image') {
      replaceReferenceWithReference(target.imageId, created, `Replaced reference with ${created.title}`)
      return
    }
    if (target.kind === 'placeholder') {
      attachPlaceholderReference(target.placeholderId, created)
      return
    }

    const positioned = positionReference(created, target.position)
    pushCanvasHistory()
    setImages((current) => [...current, positioned])
    if (target.kind === 'idea') {
      const timestamp = nowIso()
      setLinks((current) => [
        ...current,
        {
          id: `link-${Date.now()}-drop`,
          imageId: positioned.id,
          ideaId: target.ideaId,
          sourceNodeId: positioned.id,
          targetNodeId: target.ideaId,
          sourceKind: 'image',
          targetKind: 'idea',
          relation: 'supports',
          note: 'Dropped reference supports this idea.',
          confidence: 0.62,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ])
    }
    setSelection({ type: 'image', id: positioned.id })
    setLibraryStatus(`Dropped ${positioned.title}`)
  }

  async function replaceReferenceFromFiles(imageId: string, files: FileList | File[]) {
    const file = [...files].find((candidate) => candidate.type.startsWith('image/'))
    if (!file) {
      setLibraryStatus('Replacement needs an image file')
      return
    }
    const current = images.find((candidate) => candidate.id === imageId)
    if (!current) return
    const replacement = await createReferenceFromFile(file, images.length)
    replaceReferenceWithReference(imageId, { ...replacement, sourceUrl: replacement.sourceUrl ?? current.sourceUrl }, `Replaced ${current.title}`)
  }

  function replaceReferenceFromExistingImage(imageId: string, sourceImageId: string) {
    if (imageId === sourceImageId) return
    const current = images.find((candidate) => candidate.id === imageId)
    const source = images.find((candidate) => candidate.id === sourceImageId)
    if (!current || !source) return
    pushCanvasHistory()
    setImages((items) =>
      items.map((image) =>
        image.id === imageId
          ? {
              ...source,
              id: image.id,
              x: image.x,
              y: image.y,
              importance: image.importance,
              createdAt: image.createdAt,
              addedAt: image.addedAt,
              updatedAt: nowIso(),
              notes: image.notes,
              sourceUrl: source.sourceUrl ?? image.sourceUrl,
            }
          : image,
      ),
    )
    setSelection({ type: 'image', id: imageId })
    setLibraryStatus(`Replaced ${current.title} with ${source.title}`)
  }

  async function attachPlaceholderImageFromFiles(placeholderId: string, files: FileList | File[]) {
    const file = [...files].find((candidate) => candidate.type.startsWith('image/'))
    if (!file) {
      setLibraryStatus('Placeholder needs an image file')
      return
    }
    const placeholder = placeholders.find((candidate) => candidate.id === placeholderId)
    if (!placeholder) return
    const reference = await createReferenceFromFile(file, images.length)
    const converted: EvidenceImage = {
      ...reference,
      id: `img-placeholder-${Date.now()}`,
      x: placeholder.x,
      y: placeholder.y,
      importance: placeholder.importance,
      notes: placeholder.notes,
      sourceUrl: placeholder.sourceUrl,
      createdAt: placeholder.createdAt,
      addedAt: placeholder.addedAt,
      updatedAt: nowIso(),
    }
    pushCanvasHistory()
    setImages((current) => [...current, converted])
    setPlaceholders((current) => current.filter((candidate) => candidate.id !== placeholderId))
    setLinks((current) =>
      current.map((link) => {
        if (!linkTouchesNode(link, 'placeholder', placeholderId)) return link
        const sourceTouches = (link.sourceNodeId ?? link.imageId) === placeholderId
        const targetTouches = (link.targetNodeId ?? link.ideaId) === placeholderId
        return {
          ...link,
          imageId: converted.id,
          sourceNodeId: sourceTouches ? converted.id : link.sourceNodeId,
          targetNodeId: targetTouches ? converted.id : link.targetNodeId,
          sourceKind: sourceTouches ? 'image' : link.sourceKind,
          targetKind: targetTouches ? 'image' : link.targetKind,
          updatedAt: nowIso(),
        }
      }),
    )
    setSelection({ type: 'image', id: converted.id })
    setLibraryStatus(`Attached ${converted.title}`)
  }

  async function importReferenceFolder() {
    if (!isTauriRuntime()) return

    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: 'Import Folder',
    })
    if (!selectedPath || Array.isArray(selectedPath)) return

    const imported = await importNativeReferenceFolder(selectedPath)
    if (imported.length === 0) return

    appendReferences(imported, `${imported.length} reference${imported.length === 1 ? '' : 's'} imported`)
  }

  async function importEagleWebItems() {
    if (!isTauriRuntime()) return

    setLibraryStatus('Reading Eagle')
    try {
      const imported = await importNativeEagleWebItems(100)
      appendReferences(imported, `${imported.length} Eagle reference${imported.length === 1 ? '' : 's'} imported`)
    } catch {
      setLibraryStatus('Eagle unavailable')
    }
  }

  async function captureScreenReference() {
    if (!isTauriRuntime()) return

    setLibraryStatus('Capturing screen')
    try {
      const captured = await captureNativeScreenReference()
      if (!captured) {
        setLibraryStatus('Capture canceled')
        return
      }
      appendReferences([captured], '1 screen captured')
    } catch {
      setLibraryStatus('Capture failed')
    }
  }

  async function capturePastedReference(event: React.ClipboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select')) return

    const imageFile = [...event.clipboardData.files].find((file) => file.type.startsWith('image/'))
    if (imageFile) {
      event.preventDefault()
      if (selection.type === 'image') {
        await replaceReferenceFromFiles(selection.id, [imageFile])
        return
      }
      await importReferences([imageFile])
      return
    }

    const pastedText = event.clipboardData.getData('text/plain').trim()
    if (!pastedText) return

    const extensionCaptures = parseKiraCapturePayloads(pastedText)
    if (extensionCaptures.length > 0) {
      event.preventDefault()
      appendReferences(
        extensionCaptures.map((capture, index) => createReferenceFromCapture(capture, images.length + index)),
        `${extensionCaptures.length} browser capture${extensionCaptures.length === 1 ? '' : 's'} imported`,
      )
      return
    }

    const url = parseCaptureUrl(pastedText)
    if (!url) return

    event.preventDefault()
    const captured = createReferenceFromUrl(url, images.length)
    appendReferences([captured], '1 URL captured')
  }

  async function pasteReferenceFromClipboard() {
    if (!navigator.clipboard?.readText) {
      setLibraryStatus('Clipboard text is unavailable')
      return
    }

    const pastedText = (await navigator.clipboard.readText()).trim()
    const extensionCaptures = parseKiraCapturePayloads(pastedText)
    if (extensionCaptures.length > 0) {
      appendReferences(
        extensionCaptures.map((capture, index) => createReferenceFromCapture(capture, images.length + index)),
        `${extensionCaptures.length} browser capture${extensionCaptures.length === 1 ? '' : 's'} imported`,
      )
      return
    }

    const url = parseCaptureUrl(pastedText)
    if (!url) {
      setLibraryStatus('Clipboard does not contain a URL')
      return
    }

    appendReferences([createReferenceFromUrl(url, images.length)], '1 URL captured')
  }

  function createNodeLink(
    source: Pick<GraphNodeRef, 'kind' | 'id'>,
    target: Pick<GraphNodeRef, 'kind' | 'id'>,
    relation = linkCreationRelation,
    options: { skipHistory?: boolean } = {},
  ) {
    if (source.id === target.id && source.kind === target.kind) return

    const existing = links.find((link) => {
      const sourceId = link.sourceNodeId ?? link.imageId
      const targetId = link.targetNodeId ?? link.ideaId
      const sourceKind = link.sourceKind ?? 'image'
      const targetKind = link.targetKind ?? 'idea'
      return sourceId === source.id && targetId === target.id && sourceKind === source.kind && targetKind === target.kind
    })
    if (existing) {
      setSelection({ type: 'link', id: existing.id })
      return
    }

    if (!options.skipHistory) pushCanvasHistory()
    const timestamp = nowIso()
    const imageId = source.kind === 'image' ? source.id : target.kind === 'image' ? target.id : images[0]?.id ?? ''
    const ideaId = source.kind === 'idea' ? source.id : target.kind === 'idea' ? target.id : ideas[0]?.id ?? ''
    const link: EvidenceLink = {
      id: `link-${Date.now()}`,
      imageId,
      ideaId,
      sourceNodeId: source.id,
      targetNodeId: target.id,
      sourceKind: source.kind,
      targetKind: target.kind,
      relation,
      note: 'New graph link created from the canvas.',
      confidence: 0.52,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    setLinks((current) => [...current, link])
    setSelection({ type: 'link', id: link.id })
  }

  function createLink(imageId: string, ideaId: string, relation = linkCreationRelation) {
    createNodeLink({ kind: 'image', id: imageId }, { kind: 'idea', id: ideaId }, relation)
  }

  function updateRelation(linkId: string, relation: Relation) {
    setLinks((current) => current.map((link) => (link.id === linkId ? { ...link, relation, updatedAt: nowIso() } : link)))
  }

  function recordNodeVersion(
    nodeKind: GraphNodeKind,
    before: Idea | EvidenceImage | PaletteNode | DiagramNode | PlaceholderNode | undefined,
    after: Idea | EvidenceImage | PaletteNode | DiagramNode | PlaceholderNode,
    trigger: NodeVersionTrigger,
    options: { restoredFromId?: string; aiGenerated?: boolean; note?: string } = {},
  ) {
    const diff = diffNodeSnapshot(before, after)
    if (before && diff.fields.length === 0 && !options.restoredFromId) return

    const createdAt = nowIso()
    setNodeVersions((current) => {
      const existingForNode = current.filter((version) => version.nodeId === after.id && version.nodeKind === nodeKind)
      const baseline: NodeVersionRecord | null = before && existingForNode.length === 0
        ? {
            id: `node-version-${after.id}-${Date.now()}-baseline`,
            nodeId: before.id,
            nodeKind,
            versionNumber: 1,
            createdAt,
            trigger: 'created',
            snapshotJson: JSON.stringify(before),
            fields: ['baseline'],
            summary: 'Baseline before edit',
            branchId: versionState.currentBranchId,
            aiGenerated: false,
          }
        : null
      const record: NodeVersionRecord = {
        id: `node-version-${after.id}-${Date.now()}`,
        nodeId: after.id,
        nodeKind,
        versionNumber: existingForNode.length + (baseline ? 2 : 1),
        createdAt,
        trigger,
        snapshotJson: JSON.stringify(after),
        fields: diff.fields,
        summary: diff.summary || nodeVersionTriggerLabel(trigger),
        branchId: versionState.currentBranchId,
        restoredFromId: options.restoredFromId,
        aiGenerated: options.aiGenerated ?? false,
        note: options.note,
      }
      const latest = current[0]
      if (
        latest
        && latest.nodeId === record.nodeId
        && latest.nodeKind === record.nodeKind
        && latest.trigger === record.trigger
        && !latest.restoredFromId
        && !record.restoredFromId
        && new Date(record.createdAt).getTime() - new Date(latest.createdAt).getTime() < 1600
      ) {
        return [
          {
            ...record,
            id: latest.id,
            versionNumber: latest.versionNumber,
            fields: [...new Set([...latest.fields, ...record.fields])],
          },
          ...current.slice(1),
        ]
      }
      return [record, ...(baseline ? [baseline] : []), ...current].slice(0, 240)
    })
  }

  function restoreNodeVersion(versionId: string) {
    const record = nodeVersions.find((candidate) => candidate.id === versionId)
    if (!record) return

    try {
      const parsed = JSON.parse(record.snapshotJson)
      const timestamp = nowIso()
      pushCanvasHistory()

      if (record.nodeKind === 'idea' && isIdeaNode(parsed)) {
        const next = { ...parsed, updatedAt: timestamp }
        const before = ideas.find((idea) => idea.id === parsed.id)
        recordNodeVersion('idea', before, next, 'restore', { restoredFromId: record.id })
        setIdeas((current) => current.map((idea) => (idea.id === parsed.id ? next : idea)))
        setSelection({ type: 'idea', id: parsed.id })
        return
      }
      if (record.nodeKind === 'image' && isImageNode(parsed)) {
        const next = { ...parsed, updatedAt: timestamp }
        const before = images.find((image) => image.id === parsed.id)
        recordNodeVersion('image', before, next, 'restore', { restoredFromId: record.id })
        setImages((current) => current.map((image) => (image.id === parsed.id ? next : image)))
        setSelection({ type: 'image', id: parsed.id })
        return
      }
      if (record.nodeKind === 'palette' && isPaletteNode(parsed)) {
        const next = { ...parsed, updatedAt: timestamp }
        const before = palettes.find((palette) => palette.id === parsed.id)
        recordNodeVersion('palette', before, next, 'restore', { restoredFromId: record.id })
        setPalettes((current) => current.map((palette) => (palette.id === parsed.id ? next : palette)))
        setSelection({ type: 'palette', id: parsed.id })
        return
      }
      if (record.nodeKind === 'diagram' && isDiagramNode(parsed)) {
        const next = { ...parsed, updatedAt: timestamp }
        const before = diagrams.find((diagram) => diagram.id === parsed.id)
        recordNodeVersion('diagram', before, next, 'restore', { restoredFromId: record.id })
        setDiagrams((current) => current.map((diagram) => (diagram.id === parsed.id ? next : diagram)))
        setSelection({ type: 'diagram', id: parsed.id })
        return
      }
      if (record.nodeKind === 'placeholder' && isPlaceholderNode(parsed)) {
        const next = { ...parsed, updatedAt: timestamp }
        const before = placeholders.find((placeholder) => placeholder.id === parsed.id)
        recordNodeVersion('placeholder', before, next, 'restore', { restoredFromId: record.id })
        setPlaceholders((current) => current.map((placeholder) => (placeholder.id === parsed.id ? next : placeholder)))
        setSelection({ type: 'placeholder', id: parsed.id })
      }
    } catch {
      setLibraryStatus('Node restore failed')
    }
  }

  function updateIdea(ideaId: string, patch: Partial<Pick<Idea, 'title' | 'body' | 'sourceUrl' | 'notes'>>) {
    const before = ideas.find((idea) => idea.id === ideaId)
    if (before) {
      const after = { ...before, ...patch, updatedAt: nowIso() }
      recordNodeVersion('idea', before, after, patch.title !== undefined ? 'label_changed' : 'user_edit')
    }
    setIdeas((current) => current.map((idea) => (idea.id === ideaId ? { ...idea, ...patch, updatedAt: nowIso() } : idea)))
  }

  function updateImage(imageId: string, patch: Partial<Pick<EvidenceImage, 'title' | 'sourceUrl' | 'notes'>>) {
    const before = images.find((image) => image.id === imageId)
    if (before) {
      const after = { ...before, ...patch, updatedAt: nowIso() }
      recordNodeVersion('image', before, after, patch.title !== undefined ? 'label_changed' : 'user_edit')
    }
    setImages((current) => current.map((image) => (image.id === imageId ? { ...image, ...patch, updatedAt: nowIso() } : image)))
  }

  function updateLink(linkId: string, patch: Partial<Pick<EvidenceLink, 'relation' | 'note' | 'confidence'>>) {
    setLinks((current) => current.map((link) => (link.id === linkId ? { ...link, ...patch, updatedAt: nowIso() } : link)))
  }

  function swapLinkDirection(linkId: string) {
    pushCanvasHistory()
    setLinks((current) =>
      current.map((link) => {
        if (link.id !== linkId) return link
        return {
          ...link,
          sourceNodeId: link.targetNodeId ?? link.ideaId,
          targetNodeId: link.sourceNodeId ?? link.imageId,
          sourceKind: link.targetKind ?? 'idea',
          targetKind: link.sourceKind ?? 'image',
          imageId: link.imageId,
          ideaId: link.ideaId,
          updatedAt: nowIso(),
        }
      }),
    )
  }

  function updatePalette(paletteId: string, patch: Partial<Pick<PaletteNode, 'title' | 'sourceUrl' | 'notes'>>) {
    const before = palettes.find((palette) => palette.id === paletteId)
    if (before) {
      const after = { ...before, ...patch, updatedAt: nowIso() }
      recordNodeVersion('palette', before, after, patch.title !== undefined ? 'label_changed' : 'user_edit')
    }
    setPalettes((current) => current.map((palette) => (palette.id === paletteId ? { ...palette, ...patch, updatedAt: nowIso() } : palette)))
  }

  function updateDiagram(diagramId: string, patch: Partial<Pick<DiagramNode, 'title' | 'sourceUrl' | 'notes' | 'source'>>) {
    const before = diagrams.find((diagram) => diagram.id === diagramId)
    if (before) {
      const after = { ...before, ...patch, updatedAt: nowIso() }
      recordNodeVersion('diagram', before, after, patch.title !== undefined ? 'label_changed' : 'user_edit')
    }
    setDiagrams((current) => current.map((diagram) => (diagram.id === diagramId ? { ...diagram, ...patch, updatedAt: nowIso() } : diagram)))
  }

  function updatePlaceholder(placeholderId: string, patch: Partial<Pick<PlaceholderNode, 'title' | 'sourceUrl' | 'notes'>>) {
    const before = placeholders.find((placeholder) => placeholder.id === placeholderId)
    if (before) {
      const after = { ...before, ...patch, updatedAt: nowIso() }
      recordNodeVersion('placeholder', before, after, patch.title !== undefined ? 'label_changed' : 'user_edit')
    }
    setPlaceholders((current) => current.map((placeholder) => (placeholder.id === placeholderId ? { ...placeholder, ...patch, updatedAt: nowIso() } : placeholder)))
  }

  function moveGraphNode(kind: GraphNodeKind, id: string, position: Pick<Idea, 'x' | 'y'>) {
    const timestamp = nowIso()
    if (kind === 'idea') {
      setIdeas((current) => current.map((idea) => (idea.id === id ? { ...idea, ...position, updatedAt: timestamp } : idea)))
      return
    }

    if (kind === 'image') {
      setImages((current) => current.map((image) => (image.id === id ? { ...image, ...position, updatedAt: timestamp } : image)))
      return
    }

    if (kind === 'palette') {
      setPalettes((current) => current.map((palette) => (palette.id === id ? { ...palette, ...position, updatedAt: timestamp } : palette)))
      return
    }

    if (kind === 'diagram') {
      setDiagrams((current) => current.map((diagram) => (diagram.id === id ? { ...diagram, ...position, updatedAt: timestamp } : diagram)))
      return
    }

    setPlaceholders((current) => current.map((placeholder) => (placeholder.id === id ? { ...placeholder, ...position, updatedAt: timestamp } : placeholder)))
  }

  function changeNodeImportance(kind: GraphNodeKind, id: string, delta: number) {
    pushCanvasHistory()
    const timestamp = nowIso()
    if (kind === 'idea') {
      const before = ideas.find((idea) => idea.id === id)
      if (before) recordNodeVersion('idea', before, { ...before, importance: adjustImportance(before.importance, delta), updatedAt: timestamp }, 'score_updated')
      setIdeas((current) =>
        current.map((idea) =>
          idea.id === id
            ? { ...idea, importance: adjustImportance(idea.importance, delta), updatedAt: timestamp }
            : idea,
        ),
      )
      return
    }

    if (kind === 'image') {
      const before = images.find((image) => image.id === id)
      if (before) recordNodeVersion('image', before, { ...before, importance: adjustImportance(before.importance, delta), updatedAt: timestamp }, 'score_updated')
      setImages((current) =>
        current.map((image) =>
          image.id === id
            ? { ...image, importance: adjustImportance(image.importance, delta), updatedAt: timestamp }
            : image,
        ),
      )
      return
    }

    if (kind === 'palette') {
      const before = palettes.find((palette) => palette.id === id)
      if (before) recordNodeVersion('palette', before, { ...before, importance: adjustImportance(before.importance, delta), updatedAt: timestamp }, 'score_updated')
      setPalettes((current) =>
        current.map((palette) =>
          palette.id === id
            ? { ...palette, importance: adjustImportance(palette.importance, delta), updatedAt: timestamp }
            : palette,
        ),
      )
      return
    }

    if (kind === 'diagram') {
      const before = diagrams.find((diagram) => diagram.id === id)
      if (before) recordNodeVersion('diagram', before, { ...before, importance: adjustImportance(before.importance, delta), updatedAt: timestamp }, 'score_updated')
      setDiagrams((current) =>
        current.map((diagram) =>
          diagram.id === id
            ? { ...diagram, importance: adjustImportance(diagram.importance, delta), updatedAt: timestamp }
            : diagram,
        ),
      )
      return
    }

    if (kind === 'placeholder') {
      const before = placeholders.find((placeholder) => placeholder.id === id)
      if (before) recordNodeVersion('placeholder', before, { ...before, importance: adjustImportance(before.importance, delta), updatedAt: timestamp }, 'score_updated')
      setPlaceholders((current) =>
        current.map((placeholder) =>
          placeholder.id === id
            ? { ...placeholder, importance: adjustImportance(placeholder.importance, delta), updatedAt: timestamp }
            : placeholder,
        ),
      )
    }
  }

  function changeSelectedNodesImportance(nodes: CanvasNodeSelection[], delta: number) {
    if (nodes.length === 0) return
    pushCanvasHistory()
    const timestamp = nowIso()
    const byKind = new Map<GraphNodeKind, Set<string>>()
    nodes.forEach((node) => {
      const ids = byKind.get(node.kind) ?? new Set<string>()
      ids.add(node.id)
      byKind.set(node.kind, ids)
    })
    ideas
      .filter((idea) => byKind.get('idea')?.has(idea.id))
      .forEach((idea) => recordNodeVersion('idea', idea, { ...idea, importance: adjustImportance(idea.importance, delta), updatedAt: timestamp }, 'score_updated'))
    images
      .filter((image) => byKind.get('image')?.has(image.id))
      .forEach((image) => recordNodeVersion('image', image, { ...image, importance: adjustImportance(image.importance, delta), updatedAt: timestamp }, 'score_updated'))
    palettes
      .filter((palette) => byKind.get('palette')?.has(palette.id))
      .forEach((palette) => recordNodeVersion('palette', palette, { ...palette, importance: adjustImportance(palette.importance, delta), updatedAt: timestamp }, 'score_updated'))
    diagrams
      .filter((diagram) => byKind.get('diagram')?.has(diagram.id))
      .forEach((diagram) => recordNodeVersion('diagram', diagram, { ...diagram, importance: adjustImportance(diagram.importance, delta), updatedAt: timestamp }, 'score_updated'))
    placeholders
      .filter((placeholder) => byKind.get('placeholder')?.has(placeholder.id))
      .forEach((placeholder) => recordNodeVersion('placeholder', placeholder, { ...placeholder, importance: adjustImportance(placeholder.importance, delta), updatedAt: timestamp }, 'score_updated'))
    setIdeas((current) =>
      current.map((idea) =>
        byKind.get('idea')?.has(idea.id)
          ? { ...idea, importance: adjustImportance(idea.importance, delta), updatedAt: timestamp }
          : idea,
      ),
    )
    setImages((current) =>
      current.map((image) =>
        byKind.get('image')?.has(image.id)
          ? { ...image, importance: adjustImportance(image.importance, delta), updatedAt: timestamp }
          : image,
      ),
    )
    setPalettes((current) =>
      current.map((palette) =>
        byKind.get('palette')?.has(palette.id)
          ? { ...palette, importance: adjustImportance(palette.importance, delta), updatedAt: timestamp }
          : palette,
      ),
    )
    setDiagrams((current) =>
      current.map((diagram) =>
        byKind.get('diagram')?.has(diagram.id)
          ? { ...diagram, importance: adjustImportance(diagram.importance, delta), updatedAt: timestamp }
          : diagram,
      ),
    )
    setPlaceholders((current) =>
      current.map((placeholder) =>
        byKind.get('placeholder')?.has(placeholder.id)
          ? { ...placeholder, importance: adjustImportance(placeholder.importance, delta), updatedAt: timestamp }
          : placeholder,
      ),
    )
  }

  function deleteSelectedGraphNodes(nodes: CanvasNodeSelection[]) {
    if (nodes.length === 0) return
    pushCanvasHistory()
    const keys = new Set(nodes.map(nodeSelectionKey))
    const idsByKind = new Map<GraphNodeKind, Set<string>>()
    nodes.forEach((node) => {
      const ids = idsByKind.get(node.kind) ?? new Set<string>()
      ids.add(node.id)
      idsByKind.set(node.kind, ids)
    })
    setIdeas((current) => current.filter((idea) => !idsByKind.get('idea')?.has(idea.id)))
    setImages((current) => current.filter((image) => !idsByKind.get('image')?.has(image.id)))
    setPalettes((current) => current.filter((palette) => !idsByKind.get('palette')?.has(palette.id)))
    setDiagrams((current) => current.filter((diagram) => !idsByKind.get('diagram')?.has(diagram.id)))
    setPlaceholders((current) => current.filter((placeholder) => !idsByKind.get('placeholder')?.has(placeholder.id)))
    setLinks((current) =>
      current.filter((link) => {
        const sourceKind = link.sourceKind ?? 'image'
        const targetKind = link.targetKind ?? 'idea'
        const sourceId = link.sourceNodeId ?? link.imageId
        const targetId = link.targetNodeId ?? link.ideaId
        return !keys.has(nodeSelectionKey({ kind: sourceKind, id: sourceId })) && !keys.has(nodeSelectionKey({ kind: targetKind, id: targetId }))
      }),
    )
    const fallback = ideas.find((idea) => !idsByKind.get('idea')?.has(idea.id))
    if (fallback) setSelection({ type: 'idea', id: fallback.id })
  }

  async function organizeCanvas(mode: GraphOrganizeMode) {
    if (mode === 'manual') return
    pushCanvasHistory()
    const layout = await organizeGraphLayout(mode, ideas, images, links, selection, palettes, diagrams, placeholders)
    setIdeas(layout.ideas)
    setImages(layout.images)
    setPalettes(layout.palettes)
    setDiagrams(layout.diagrams)
    setPlaceholders(layout.placeholders)
  }

  function updateAiProvider(providerId: string, patch: Partial<Pick<AiProviderProfile, 'name' | 'baseUrl' | 'model' | 'authMode'>>) {
    setAiProviders((current) =>
      current.map((provider) => (provider.id === providerId ? { ...provider, ...patch } : provider)),
    )
  }

  function addAiProvider(type: Exclude<AiProviderType, 'apple_foundation'>) {
    const template = aiProviderTemplates[type]
    const id = `${type.replaceAll('_', '-')}-${Date.now()}`
    const provider: AiProviderProfile = {
      ...template,
      id,
      name: existingProviderTypeCount(aiProviders, type) > 0
        ? `${template.name} ${existingProviderTypeCount(aiProviders, type) + 1}`
        : template.name,
      userManaged: true,
    }
    setAiProviders((current) => [...current, provider])
    setActiveAiProviderId(id)
    if (provider.authMode !== 'local') setSelectedAiProviderId(id)
    setAiSettingsStatus(`${provider.name} profile added`)
  }

  function deleteAiProvider(providerId: string) {
    const provider = aiProviders.find((candidate) => candidate.id === providerId)
    if (!provider || provider.authMode === 'local') return
    setAiProviders((current) => current.filter((candidate) => candidate.id !== providerId))
    void deleteNativeProviderSecret(providerId).catch(() => undefined)
    const fallbackProviderId = aiProviders.find((candidate) => candidate.id !== providerId && candidate.authMode !== 'local')?.id
      ?? 'openai'
    if (selectedAiProviderId === providerId) setSelectedProviderWithActive(fallbackProviderId)
    if (activeAiProviderId === providerId) setActiveAiProviderId(fallbackProviderId)
    setAiSettingsStatus(`${provider.name} profile removed`)
  }

  function toggleAiProviderTask(providerId: string, task: AiTaskKind) {
    setAiProviders((current) =>
      current.map((provider) => {
        if (provider.id !== providerId) return provider
        const defaultFor = provider.defaultFor.includes(task)
          ? provider.defaultFor.filter((candidate) => candidate !== task)
          : [...provider.defaultFor, task]
        return { ...provider, defaultFor }
      }),
    )
  }

  function setSelectedProviderWithActive(providerId: string) {
    setSelectedAiProviderId(providerId)
    setActiveAiProviderId(providerId)
  }

  function finishOnboarding() {
    writeOnboardingCompleted(true)
    setIsOnboardingOpen(false)
    setAiSettingsStatus('Onboarding completed')
  }

  function resetOnboarding() {
    writeOnboardingCompleted(false)
    setActiveView('Settings')
    setIsOnboardingOpen(true)
    setAiSettingsStatus('Onboarding reset')
  }

  function focusProviderSetup(providerId: string) {
    setActiveView('Settings')
    setActiveAiProviderId(providerId)
    if (providerId !== 'apple-foundation') setSelectedAiProviderId(providerId)
  }

  async function handleExtensionInstallAction(targetId: string) {
    const target = extensionInstallTargets.find((item) =>
      item.id === targetId || item.installActionId === targetId || item.settingsActionId === targetId,
    )
    if (!target) return
    if (isTauriRuntime()) {
      await openNativeExtensionInstallTarget(targetId)
      await refreshExtensionInstallStatus()
      return
    }
    if (targetId === target.settingsActionId && target.href) window.open(target.href, '_blank', 'noopener,noreferrer')
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(target.path)
      setAiSettingsStatus(`${target.title}: install path copied`)
    } else {
      setAiSettingsStatus(`${target.title}: ${target.path}`)
    }
  }

  async function saveAiProviderSecret(providerId: string, secret: string) {
    if (!secret.trim()) {
      setAiSettingsStatus('Secret is empty')
      return
    }
    try {
      await saveNativeProviderSecret(providerId, secret)
      setAiProviders((current) =>
        current.map((provider) =>
          provider.id === providerId
            ? { ...provider, secretRef: `keychain:${providerId}`, status: provider.status === 'key_missing' ? 'unavailable' : provider.status }
            : provider,
        ),
      )
      setAiSettingsStatus('Secret saved to macOS Keychain')
    } catch (error) {
      setAiSettingsStatus(error instanceof Error ? error.message : 'Secret save failed')
    }
  }

  async function deleteAiProviderSecret(providerId: string) {
    try {
      await deleteNativeProviderSecret(providerId)
      setAiProviders((current) =>
        current.map((provider) =>
          provider.id === providerId ? { ...provider, secretRef: undefined, status: 'key_missing' } : provider,
        ),
      )
      setAiSettingsStatus('Secret deleted')
    } catch (error) {
      setAiSettingsStatus(error instanceof Error ? error.message : 'Secret delete failed')
    }
  }

  async function testAiProvider(providerId: string) {
    const provider = aiProviders.find((candidate) => candidate.id === providerId)
    if (!provider) return

    try {
      const result = await testNativeAiProvider(provider)
      setAiSettingsStatus(`${provider.name}: ${result.message}`)
      setAiProviders((current) =>
        current.map((candidate) =>
          candidate.id === providerId
            ? {
              ...candidate,
              status: providerStatusFromNative(result.status, result.connected),
              lastTestedAt: nowIso(),
              lastMessage: result.message,
            }
            : candidate,
        ),
      )
    } catch (error) {
      setAiSettingsStatus(error instanceof Error ? error.message : 'Provider test failed')
    }
  }

  async function listAiModels(providerId: string) {
    const provider = aiProviders.find((candidate) => candidate.id === providerId)
    if (!provider) return
    try {
      const result = await listNativeAiModels(provider)
      setAiProviders((current) =>
        current.map((candidate) =>
          candidate.id === providerId
            ? {
              ...candidate,
              discoveredModels: result.models,
              model: result.models.includes(candidate.model) || result.models.length === 0 ? candidate.model : result.models[0],
              lastMessage: result.models.length > 0 ? `${result.models.length} model(s) discovered` : result.status,
            }
            : candidate,
        ),
      )
      setAiSettingsStatus(
        result.models.length > 0
          ? `${provider.name}: ${result.models.join(', ')}`
          : `${provider.name}: ${result.status}`,
      )
    } catch (error) {
      setAiSettingsStatus(error instanceof Error ? error.message : 'Model listing failed')
    }
  }

  function addReferenceTag(imageId: string, rawTag: string) {
    const tag = normalizeTag(rawTag)
    if (!tag) return

    setImages((current) =>
      current.map((image) =>
        image.id === imageId
          ? {
              ...image,
              tags: image.tags.includes(tag) ? image.tags : [...image.tags, tag],
              suggestions: removeSuggestionByLabel(image.suggestions, tag),
            }
          : image,
      ),
    )
  }

  function removeReferenceTag(imageId: string, tag: string) {
    setImages((current) =>
      current.map((image) =>
        image.id === imageId
          ? {
              ...image,
              tags: image.tags.filter((candidate) => candidate !== tag),
            }
          : image,
      ),
    )
  }

  async function runReferenceOcr(imageId: string) {
    if (!isTauriRuntime()) return

    const image = images.find((candidate) => candidate.id === imageId)
    if (!image?.thumb.startsWith('data:image/')) {
      setOcrStatusByImageId((current) => ({ ...current, [imageId]: 'OCR unavailable for this reference' }))
      return
    }

    setOcrRunningImageId(imageId)
    setOcrStatusByImageId((current) => ({ ...current, [imageId]: 'Reading text' }))

    try {
      const result = await runNativeAppleVisionOcr(image.thumb)
      if (!result || result.suggestions.length === 0) {
        setOcrStatusByImageId((current) => ({ ...current, [imageId]: 'No text found' }))
        return
      }

      setImages((current) =>
        current.map((candidate) => {
          if (candidate.id !== imageId) return candidate
          const accepted = new Set(candidate.tags.map(normalizeTag))
          const suggestions = mergeSuggestionRecords(candidate.suggestions, result.suggestions, 'ocr', 0.72).filter(
            (suggestion) => !accepted.has(suggestionLabel(suggestion)),
          )
          return { ...candidate, suggestions }
        }),
      )
      setOcrStatusByImageId((current) => ({ ...current, [imageId]: `${result.suggestions.length} suggestion${result.suggestions.length === 1 ? '' : 's'}` }))
    } catch {
      setOcrStatusByImageId((current) => ({ ...current, [imageId]: 'OCR failed' }))
    } finally {
      setOcrRunningImageId(null)
    }
  }

  async function refineReferenceTags(imageId: string) {
    if (!isTauriRuntime()) return

    const image = images.find((candidate) => candidate.id === imageId)
    if (!image) return

    setModelRunningImageId(imageId)
    setModelStatusByImageId((current) => ({ ...current, [imageId]: 'Refining tags' }))

    try {
      const result = await normalizeNativeTagsWithFoundationModel(referenceModelContext(image))
      if (!result.available) {
        setLocalModelAvailable(false)
        setModelStatusByImageId((current) => ({ ...current, [imageId]: 'Local model unavailable' }))
        return
      }
      if (result.suggestions.length === 0) {
        setModelStatusByImageId((current) => ({ ...current, [imageId]: 'No new suggestions' }))
        return
      }

      setImages((current) =>
        current.map((candidate) => {
          if (candidate.id !== imageId) return candidate
          const accepted = new Set(candidate.tags.map(normalizeTag))
          const suggestions = mergeSuggestionRecords(candidate.suggestions, result.suggestions, 'model', 0.82).filter(
            (suggestion) => !accepted.has(suggestionLabel(suggestion)),
          )
          return { ...candidate, suggestions }
        }),
      )
      setModelStatusByImageId((current) => ({ ...current, [imageId]: `${result.suggestions.length} suggestion${result.suggestions.length === 1 ? '' : 's'}` }))
    } catch {
      setModelStatusByImageId((current) => ({ ...current, [imageId]: 'Refine failed' }))
    } finally {
      setModelRunningImageId(null)
    }
  }

  function createIdea(options: { focusTitle?: boolean } = {}) {
    pushCanvasHistory()
    const timestamp = nowIso()
    const idea: Idea = {
      id: `idea-${Date.now()}`,
      title: 'Untitled idea',
      body: 'Add a working note for this idea.',
      status: 'thin',
      x: 58,
      y: 42,
      importance: 1,
      createdAt: timestamp,
      addedAt: timestamp,
      updatedAt: timestamp,
    }
    recordNodeVersion('idea', undefined, idea, 'created')
    setIdeas((current) => [...current, idea])
    setSelection({ type: 'idea', id: idea.id })
    if (options.focusTitle) setIdeaTitleFocusId(idea.id)
  }

  function createPlaceholder() {
    pushCanvasHistory()
    const timestamp = nowIso()
    const placeholder: PlaceholderNode = {
      id: `placeholder-${Date.now()}`,
      title: 'Image placeholder',
      targetKind: 'image',
      x: 72,
      y: 38,
      importance: 1,
      createdAt: timestamp,
      addedAt: timestamp,
      updatedAt: timestamp,
    }
    recordNodeVersion('placeholder', undefined, placeholder, 'created')
    setPlaceholders((current) => [...current, placeholder])
    setSelection({ type: 'placeholder', id: placeholder.id })
  }

  function createPaletteNode(sourceImage?: EvidenceImage) {
    pushCanvasHistory()
    const timestamp = nowIso()
    const base = sourceImage?.palette?.[0] ?? '#84cdbc'
    const palette: PaletteNode = {
      id: `palette-${Date.now()}`,
      title: sourceImage ? `${sourceImage.title} palette` : 'Palette',
      colors: sourceImage?.palette?.length ? sourceImage.palette.slice(0, 7) : generatePaletteHarmony(base, 'analogous').slice(0, 7),
      algorithm: sourceImage ? 'image_extract' : 'analogous',
      sourceImageId: sourceImage?.id,
      x: sourceImage ? clamp(sourceImage.x + 10, 8, 92) : 70,
      y: sourceImage ? clamp(sourceImage.y + 10, 8, 92) : 58,
      importance: sourceImage?.importance ?? 1,
      createdAt: timestamp,
      addedAt: timestamp,
      updatedAt: timestamp,
      sourceUrl: sourceImage?.sourceUrl,
    }
    recordNodeVersion('palette', undefined, palette, 'created')
    setPalettes((current) => [...current, palette])
    if (sourceImage) {
      const link: EvidenceLink = {
        id: `link-${Date.now()}-palette`,
        imageId: sourceImage.id,
        ideaId: ideas[0]?.id ?? '',
        sourceNodeId: sourceImage.id,
        targetNodeId: palette.id,
        sourceKind: 'image',
        targetKind: 'palette',
        relation: 'derived-from',
        note: 'Palette extracted from reference image.',
        confidence: 0.86,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setLinks((current) => [...current, link])
    }
    setSelection({ type: 'palette', id: palette.id })
  }

  function createLinkedNode(source: Pick<GraphNodeRef, 'kind' | 'id'>, targetKind: GraphNodeKind) {
    const sourceNode = resolveGraphNodeRef(source.id, ideas, images, palettes, diagrams, placeholders)
    if (!sourceNode) return

    pushCanvasHistory()
    const timestamp = nowIso()
    const position = {
      x: clamp(sourceNode.x + 12, 8, 92),
      y: clamp(sourceNode.y + 10, 8, 92),
    }

    if (targetKind === 'idea') {
      const idea: Idea = {
        id: `idea-${Date.now()}`,
        title: 'Linked idea',
        body: `Derived from ${sourceNode.title}.`,
        status: 'thin',
        ...position,
        importance: 1,
        createdAt: timestamp,
        addedAt: timestamp,
        updatedAt: timestamp,
      }
      recordNodeVersion('idea', undefined, idea, 'created')
      setIdeas((current) => [...current, idea])
      createNodeLink(source, { kind: 'idea', id: idea.id }, source.kind === 'idea' ? 'related' : 'supports', { skipHistory: true })
      setIdeaTitleFocusId(idea.id)
      return
    }

    if (targetKind === 'placeholder' || targetKind === 'image') {
      const placeholder: PlaceholderNode = {
        id: `placeholder-${Date.now()}`,
        title: 'Linked image placeholder',
        targetKind: 'image',
        ...position,
        importance: 1,
        createdAt: timestamp,
        addedAt: timestamp,
        updatedAt: timestamp,
      }
      recordNodeVersion('placeholder', undefined, placeholder, 'created')
      setPlaceholders((current) => [...current, placeholder])
      createNodeLink(source, { kind: 'placeholder', id: placeholder.id }, 'reference', { skipHistory: true })
      return
    }

    if (targetKind === 'palette') {
      const sourceImage = source.kind === 'image' ? images.find((image) => image.id === source.id) : undefined
      const base = sourceImage?.palette?.[0] ?? '#84cdbc'
      const palette: PaletteNode = {
        id: `palette-${Date.now()}`,
        title: sourceImage ? `${sourceImage.title} palette` : 'Linked palette',
        colors: sourceImage?.palette?.length ? sourceImage.palette.slice(0, 7) : generatePaletteHarmony(base, 'analogous').slice(0, 7),
        algorithm: sourceImage ? 'image_extract' : 'analogous',
        sourceImageId: sourceImage?.id,
        ...position,
        importance: sourceImage?.importance ?? 1,
        createdAt: timestamp,
        addedAt: timestamp,
        updatedAt: timestamp,
        sourceUrl: sourceImage?.sourceUrl,
      }
      recordNodeVersion('palette', undefined, palette, 'created')
      setPalettes((current) => [...current, palette])
      createNodeLink(source, { kind: 'palette', id: palette.id }, source.kind === 'image' ? 'derived-from' : 'related', { skipHistory: true })
      return
    }

    const diagram: DiagramNode = {
      id: `diagram-${Date.now()}`,
      title: 'Linked diagram',
      format: 'mermaid',
      source: `flowchart TD\n  A[${sourceNode.title.replace(/[\[\]]/g, '')}]\n  B[New idea]\n  A --> B`,
      nodeIds: [],
      ...position,
      importance: 1,
      createdAt: timestamp,
      addedAt: timestamp,
      updatedAt: timestamp,
    }
    recordNodeVersion('diagram', undefined, diagram, 'created')
    setDiagrams((current) => [...current, diagram])
    createNodeLink(source, { kind: 'diagram', id: diagram.id }, 'related', { skipHistory: true })
  }

  async function createAiNode(request: AiNodeRequest) {
    const sourceNode = resolveGraphNodeRef(request.source.id, ideas, images, palettes, diagrams, placeholders)
    if (!sourceNode) return

    const allNodes = [
      ...ideas.map((idea) => ({ kind: 'idea' as const, id: idea.id, title: idea.title, x: idea.x, y: idea.y })),
      ...images.map((image) => ({ kind: 'image' as const, id: image.id, title: image.title, x: image.x, y: image.y })),
      ...palettes.map((palette) => ({ kind: 'palette' as const, id: palette.id, title: palette.title, x: palette.x, y: palette.y })),
      ...diagrams.map((diagram) => ({ kind: 'diagram' as const, id: diagram.id, title: diagram.title, x: diagram.x, y: diagram.y })),
      ...placeholders.map((placeholder) => ({ kind: 'placeholder' as const, id: placeholder.id, title: placeholder.title, x: placeholder.x, y: placeholder.y })),
    ]
    const nodeKey = (node: Pick<GraphNodeRef, 'kind' | 'id'>) => `${node.kind}:${node.id}`
    const nodeByKey = new Map(allNodes.map((node) => [nodeKey(node), node]))
    const inbound = new Map<string, string[]>()
    const outbound = new Map<string, string[]>()
    links.forEach((link) => {
      const sourceKey = nodeKey({ kind: link.sourceKind ?? 'image', id: link.sourceNodeId ?? link.imageId })
      const targetKey = nodeKey({ kind: link.targetKind ?? 'idea', id: link.targetNodeId ?? link.ideaId })
      outbound.set(sourceKey, [...(outbound.get(sourceKey) ?? []), targetKey])
      inbound.set(targetKey, [...(inbound.get(targetKey) ?? []), sourceKey])
    })

    function walk(start: string, graph: Map<string, string[]>) {
      const seen = new Set([start])
      const queue = [start]
      while (queue.length > 0) {
        const current = queue.shift()
        if (!current) continue
        for (const next of graph.get(current) ?? []) {
          if (seen.has(next)) continue
          seen.add(next)
          queue.push(next)
        }
      }
      return [...seen]
    }

    const sourceKey = nodeKey(sourceNode)
    const baseKeys =
      request.scope === 'full_board'
        ? allNodes.map(nodeKey)
        : request.scope === 'upstream_branch'
          ? walk(sourceKey, inbound)
          : request.scope === 'downstream_branch'
            ? walk(sourceKey, outbound)
            : [sourceKey]
    const baseNodes = baseKeys.map((key) => nodeByKey.get(key)).filter(Boolean).slice(0, 12) as GraphNodeRef[]
    const instruction = request.prompt.trim() || aiNodeActionPrompts[request.action]
    const route = selectAiProviderForTask('generate_node', aiProviders, aiRoutingMode, selectedAiProviderId)
    const provider = route.providerId ? aiProviders.find((candidate) => candidate.id === route.providerId) : undefined
    const baseNodeLines = baseNodes.map((node) => `- ${graphNodeKindLabel(node.kind)}: ${node.title}`)
    const generationPrompt = [
      'You are KIRA, a creative workspace assistant. Generate concise, useful content for a new canvas node.',
      `Action: ${aiNodeActionLabels[request.action]}`,
      `Scope: ${aiNodeScopeLabels[request.scope]}`,
      `User instruction: ${instruction}`,
      `Source node: ${graphNodeKindLabel(sourceNode.kind)} - ${sourceNode.title}`,
      '',
      'Base nodes:',
      ...baseNodeLines,
      '',
      'Return only the node body. Use short sections or bullets. Do not mention that you are an AI model.',
    ].join('\n')
    let generatedBody: string | null = null
    let generationStatus = provider ? `${provider.name}: ${route.reason}` : route.reason
    if (provider) {
      try {
        const result = await generateNativeAiText(provider, generationPrompt)
        generatedBody = result.content.trim()
        generationStatus = `${provider.name}: ${result.status}`
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI generation failed'
        if (provider.type === 'codex' && isCodexLoggedOutError(message)) {
          // Codex requires a ChatGPT sign-in. Surface an actionable prompt and
          // jump the user to the Codex provider in Settings to sign in, rather
          // than burying the raw "Not signed in" error in the node body.
          generationStatus = `${provider.name}: sign in to Codex in Settings to continue`
          focusProviderSetup(provider.id)
          setAiSettingsStatus('Sign in to Codex (ChatGPT) to run this AI task, then try again.')
        } else {
          generationStatus = message
        }
      }
    }
    const body = [
      `AI action: ${aiNodeActionLabels[request.action]}`,
      `Scope: ${aiNodeScopeLabels[request.scope]}`,
      `Instruction: ${instruction}`,
      `Provider: ${generationStatus}`,
      '',
      generatedBody || [
        'Generated draft fallback.',
        '',
        'Base nodes:',
        ...baseNodeLines,
        '',
        'Connect and test a provider in Settings to replace this fallback with live model output.',
      ].join('\n'),
    ].join('\n')
    const timestamp = nowIso()
    const idea: Idea = {
      id: `idea-ai-${Date.now()}`,
      title: `${aiNodeActionLabels[request.action]}: ${sourceNode.title}`.slice(0, 82),
      body,
      status: 'forming',
      x: clamp(sourceNode.x + 14, 8, 92),
      y: clamp(sourceNode.y + 12, 8, 92),
      importance: 1.05,
      createdAt: timestamp,
      addedAt: timestamp,
      updatedAt: timestamp,
    }
    const link: EvidenceLink = {
      id: `link-ai-${Date.now()}`,
      imageId: sourceNode.kind === 'image' ? sourceNode.id : '',
      ideaId: idea.id,
      sourceNodeId: sourceNode.id,
      targetNodeId: idea.id,
      sourceKind: sourceNode.kind,
      targetKind: 'idea',
      relation: 'derived-from',
      note: `${aiNodeActionLabels[request.action]} generated from ${aiNodeScopeLabels[request.scope]}.`,
      confidence: 0.62,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    pushCanvasHistory()
    recordNodeVersion('idea', undefined, idea, 'created')
    setIdeas((current) => [...current, idea])
    setLinks((current) => [...current, link])
    setSelection({ type: 'idea', id: idea.id })
  }

  function updatePaletteColor(paletteId: string, colorIndex: number, color: string) {
    const before = palettes.find((palette) => palette.id === paletteId)
    if (before) {
      recordNodeVersion('palette', before, {
        ...before,
        colors: before.colors.map((candidate, index) => (index === colorIndex ? color : candidate)),
        algorithm: 'manual',
        updatedAt: nowIso(),
      }, 'user_edit')
    }
    setPalettes((current) =>
      current.map((palette) =>
        palette.id === paletteId
          ? {
              ...palette,
              colors: palette.colors.map((candidate, index) => (index === colorIndex ? color : candidate)),
              algorithm: 'manual',
              updatedAt: nowIso(),
            }
          : palette,
      ),
    )
  }

  function addPaletteColor(paletteId: string) {
    pushCanvasHistory()
    const before = palettes.find((palette) => palette.id === paletteId)
    if (before) {
      recordNodeVersion('palette', before, {
        ...before,
        colors: [...before.colors, before.colors.at(-1) ?? '#84cdbc'].slice(0, 12),
        algorithm: 'manual',
        updatedAt: nowIso(),
      }, 'user_edit')
    }
    setPalettes((current) =>
      current.map((palette) =>
        palette.id === paletteId
          ? {
              ...palette,
              colors: [...palette.colors, palette.colors.at(-1) ?? '#84cdbc'].slice(0, 12),
              algorithm: 'manual',
              updatedAt: nowIso(),
            }
          : palette,
      ),
    )
  }

  function removePaletteColor(paletteId: string, colorIndex: number) {
    pushCanvasHistory()
    const before = palettes.find((palette) => palette.id === paletteId)
    if (before) {
      recordNodeVersion('palette', before, {
        ...before,
        colors: before.colors.length <= 1 ? before.colors : before.colors.filter((_, index) => index !== colorIndex),
        algorithm: 'manual',
        updatedAt: nowIso(),
      }, 'user_edit')
    }
    setPalettes((current) =>
      current.map((palette) =>
        palette.id === paletteId
          ? {
              ...palette,
              colors: palette.colors.length <= 1 ? palette.colors : palette.colors.filter((_, index) => index !== colorIndex),
              algorithm: 'manual',
              updatedAt: nowIso(),
            }
          : palette,
      ),
    )
  }

  function regeneratePalette(paletteId: string, algorithm: PaletteHarmony) {
    pushCanvasHistory()
    const before = palettes.find((palette) => palette.id === paletteId)
    if (before) {
      recordNodeVersion('palette', before, {
        ...before,
        colors: generatePaletteHarmony(before.colors[0] ?? '#84cdbc', algorithm),
        algorithm,
        updatedAt: nowIso(),
      }, 'user_edit')
    }
    setPalettes((current) =>
      current.map((palette) => {
        if (palette.id !== paletteId) return palette
        return {
          ...palette,
          colors: generatePaletteHarmony(palette.colors[0] ?? '#84cdbc', algorithm),
          algorithm,
          updatedAt: nowIso(),
        }
      }),
    )
  }

  function findSimilarReferences(imageId: string) {
    const source = images.find((image) => image.id === imageId)
    if (!source) return
    const sourceTags = new Set(source.tags.map(normalizeTag))
    const sourceHue = hueFromHex(source.palette[0])
    const similarIds = images
      .filter((image) => image.id !== imageId)
      .map((image) => {
        const tagScore = image.tags.filter((tag) => sourceTags.has(normalizeTag(tag))).length
        const hueDistance = Math.abs(hueFromHex(image.palette[0]) - sourceHue)
        const colorScore = 1 - Math.min(hueDistance, 360 - hueDistance) / 180
        return { image, score: tagScore * 2 + colorScore }
      })
      .filter((entry) => entry.score > 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((entry) => entry.image.id)
    setSelectedReferenceIds(new Set([imageId, ...similarIds]))
    setLibraryStatus(`${similarIds.length} similar reference${similarIds.length === 1 ? '' : 's'} selected`)
  }

  async function importMermaidDiagram(source: string) {
    try {
      const { default: mermaid } = await import('mermaid')
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
      await mermaid.parse(source, { suppressErrors: false })
    } catch {
      setLibraryStatus('Mermaid syntax could not be parsed')
      return
    }

    const parsed = parseMermaidFlowchart(source)
    if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
      setLibraryStatus('Mermaid import needs graph or flowchart syntax')
      return
    }

    pushCanvasHistory()
    const timestamp = nowIso()
    const diagramId = `diagram-${Date.now()}`
    const importedIdeas: Idea[] = parsed.nodes.map((node, index) => ({
      id: `idea-${diagramId}-${node.id}`,
      title: node.label,
      body: `Imported from Mermaid diagram "${parsed.title}".`,
      status: 'forming',
      x: clamp(28 + (index % 4) * 14, 10, 90),
      y: clamp(28 + Math.floor(index / 4) * 14, 10, 90),
      importance: 1,
      createdAt: timestamp,
      addedAt: timestamp,
      updatedAt: timestamp,
    }))
    const diagram: DiagramNode = {
      id: diagramId,
      title: parsed.title,
      format: 'mermaid',
      source,
      nodeIds: importedIdeas.map((idea) => idea.id),
      x: 50,
      y: 18,
      importance: 1.2,
      createdAt: timestamp,
      addedAt: timestamp,
      updatedAt: timestamp,
    }
    const importedIdeaIdByMermaidId = new Map(parsed.nodes.map((node, index) => [node.id, importedIdeas[index].id]))
    const importedLinks: EvidenceLink[] = []
    parsed.edges.forEach((edge, index) => {
      const sourceIdeaId = importedIdeaIdByMermaidId.get(edge.source)
      const targetIdeaId = importedIdeaIdByMermaidId.get(edge.target)
      if (!sourceIdeaId || !targetIdeaId) return
      importedLinks.push({
        id: `link-${diagramId}-${index}`,
        imageId: sourceIdeaId,
        ideaId: targetIdeaId,
        sourceNodeId: sourceIdeaId,
        targetNodeId: targetIdeaId,
        sourceKind: 'idea',
        targetKind: 'idea',
        relation: 'supports',
        note: edge.label ? `Mermaid edge: ${edge.label}` : `Imported edge from ${parsed.title}.`,
        confidence: 0.74,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    })
    setIdeas((current) => [...current, ...importedIdeas])
    setDiagrams((current) => [...current, diagram])
    setLinks((current) => [...current, ...importedLinks])
    setSelection({ type: 'diagram', id: diagram.id })
    setLibraryStatus(`${importedIdeas.length} diagram idea${importedIdeas.length === 1 ? '' : 's'} and ${importedLinks.length} link${importedLinks.length === 1 ? '' : 's'} imported`)
  }

  function deleteIdea(ideaId: string) {
    if (ideas.length <= 1) return
    pushCanvasHistory()
    const nextIdeas = ideas.filter((idea) => idea.id !== ideaId)
    setIdeas(nextIdeas)
    setLinks((current) => current.filter((link) => !linkTouchesNode(link, 'idea', ideaId)))
    const fallback = nextIdeas[0]
    if (fallback) setSelection({ type: 'idea', id: fallback.id })
  }

  function deleteImage(imageId: string) {
    pushCanvasHistory()
    const nextImages = images.filter((image) => image.id !== imageId)
    setImages(nextImages)
    setLinks((current) => current.filter((link) => !linkTouchesNode(link, 'image', imageId)))
    setPalettes((current) => current.filter((palette) => palette.sourceImageId !== imageId))
    const fallbackIdea = ideas[0]
    const fallbackImage = nextImages[0]
    setSelection(fallbackImage ? { type: 'image', id: fallbackImage.id } : { type: 'idea', id: fallbackIdea?.id ?? 'idea-ritual-tools' })
  }

  function deletePalette(paletteId: string) {
    pushCanvasHistory()
    const nextPalettes = palettes.filter((palette) => palette.id !== paletteId)
    setPalettes(nextPalettes)
    setLinks((current) => current.filter((link) => !linkTouchesNode(link, 'palette', paletteId)))
    setSelection(nextPalettes[0] ? { type: 'palette', id: nextPalettes[0].id } : { type: 'idea', id: ideas[0]?.id ?? 'idea-ritual-tools' })
  }

  function deleteDiagram(diagramId: string) {
    const diagram = diagrams.find((candidate) => candidate.id === diagramId)
    if (!diagram) return
    pushCanvasHistory()
    const diagramIdeaIds = new Set(diagram.nodeIds)
    const nextIdeas = ideas.filter((idea) => !diagramIdeaIds.has(idea.id))
    const fallbackIdeas = nextIdeas.length > 0 ? nextIdeas : [createFallbackIdea()]
    setDiagrams((current) => current.filter((candidate) => candidate.id !== diagramId))
    setIdeas(fallbackIdeas)
    setLinks((current) =>
      current.filter(
        (link) =>
          !diagramIdeaIds.has(link.ideaId) &&
          !diagramIdeaIds.has(link.sourceNodeId ?? '') &&
          !diagramIdeaIds.has(link.targetNodeId ?? '') &&
          !linkTouchesNode(link, 'diagram', diagramId),
      ),
    )
    setSelection({ type: 'idea', id: fallbackIdeas[0].id })
  }

  function deletePlaceholder(placeholderId: string) {
    pushCanvasHistory()
    const nextPlaceholders = placeholders.filter((placeholder) => placeholder.id !== placeholderId)
    setPlaceholders(nextPlaceholders)
    setLinks((current) => current.filter((link) => !linkTouchesNode(link, 'placeholder', placeholderId)))
    setSelection(nextPlaceholders[0] ? { type: 'placeholder', id: nextPlaceholders[0].id } : { type: 'idea', id: ideas[0]?.id ?? 'idea-ritual-tools' })
  }

  function deleteLink(linkId: string) {
    const link = links.find((candidate) => candidate.id === linkId)
    pushCanvasHistory()
    setLinks((current) => current.filter((candidate) => candidate.id !== linkId))
    if (link) {
      const target = resolveGraphNodeRef(link.targetNodeId ?? link.ideaId, ideas, images, palettes, diagrams, placeholders)
      const source = resolveGraphNodeRef(link.sourceNodeId ?? link.imageId, ideas, images, palettes, diagrams, placeholders)
      const fallback = target ?? source
      if (fallback) setSelection({ type: fallback.kind, id: fallback.id } as Selection)
    }
  }

  function requestIdeaDelete(ideaId: string) {
    const idea = ideas.find((candidate) => candidate.id === ideaId)
    if (!idea || ideas.length <= 1) return
    setPendingDelete({ type: 'idea', id: idea.id, title: idea.title })
  }

  function requestImageDelete(imageId: string) {
    const image = images.find((candidate) => candidate.id === imageId)
    if (!image) return
    setPendingDelete({ type: 'image', id: image.id, title: image.title })
  }

  function requestPaletteDelete(paletteId: string) {
    const palette = palettes.find((candidate) => candidate.id === paletteId)
    if (!palette) return
    setPendingDelete({ type: 'palette', id: palette.id, title: palette.title })
  }

  function requestDiagramDelete(diagramId: string) {
    const diagram = diagrams.find((candidate) => candidate.id === diagramId)
    if (!diagram) return
    setPendingDelete({ type: 'diagram', id: diagram.id, title: diagram.title })
  }

  function requestPlaceholderDelete(placeholderId: string) {
    const placeholder = placeholders.find((candidate) => candidate.id === placeholderId)
    if (!placeholder) return
    setPendingDelete({ type: 'placeholder', id: placeholder.id, title: placeholder.title })
  }

  function requestLinkDelete(linkId: string) {
    const link = links.find((candidate) => candidate.id === linkId)
    if (!link) return
    const source = resolveGraphNodeRef(link.sourceNodeId ?? link.imageId, ideas, images, palettes, diagrams, placeholders)
    const target = resolveGraphNodeRef(link.targetNodeId ?? link.ideaId, ideas, images, palettes, diagrams, placeholders)
    setPendingDelete({
      type: 'link',
      id: link.id,
      title: `${source?.title ?? 'Source'} -> ${target?.title ?? 'Target'}`,
    })
  }

  function deleteCurrentSelection() {
    if (selection.type === 'project') return
    if (selection.type === 'idea') requestIdeaDelete(selection.id)
    else if (selection.type === 'image') requestImageDelete(selection.id)
    else if (selection.type === 'palette') requestPaletteDelete(selection.id)
    else if (selection.type === 'diagram') requestDiagramDelete(selection.id)
    else if (selection.type === 'placeholder') requestPlaceholderDelete(selection.id)
    else if (selection.type === 'link') requestLinkDelete(selection.id)
  }

  function beginCreateLinkFromNode(source: Pick<GraphNodeRef, 'kind' | 'id'>) {
    setActiveView('Canvas')
    setActiveCanvasTool('link')
    setPendingLinkSource(source)
    setSelection({ type: source.kind, id: source.id } as Selection)
  }

  function duplicateCurrentSelection() {
    if (!isNodeSelection(selection)) return
    const source = resolveGraphNodeRef(selection.id, ideas, images, palettes, diagrams, placeholders)
    if (!source) return
    pushCanvasHistory()
    const timestamp = nowIso()
    const offset = { x: clamp(source.x + 8, 8, 92), y: clamp(source.y + 8, 8, 92) }

    if (selection.type === 'idea') {
      const idea = ideas.find((candidate) => candidate.id === selection.id)
      if (!idea) return
      const duplicate: Idea = {
        ...idea,
        id: `idea-${Date.now()}`,
        title: `${idea.title} copy`,
        ...offset,
        createdAt: timestamp,
        addedAt: timestamp,
        updatedAt: timestamp,
      }
      setIdeas((current) => [...current, duplicate])
      setSelection({ type: 'idea', id: duplicate.id })
      return
    }

    if (selection.type === 'image') {
      const image = images.find((candidate) => candidate.id === selection.id)
      if (!image) return
      const duplicate: EvidenceImage = {
        ...image,
        id: `image-${Date.now()}`,
        title: `${image.title} copy`,
        ...offset,
        createdAt: timestamp,
        addedAt: timestamp,
        updatedAt: timestamp,
      }
      setImages((current) => [...current, duplicate])
      setSelection({ type: 'image', id: duplicate.id })
      return
    }

    if (selection.type === 'palette') {
      const palette = palettes.find((candidate) => candidate.id === selection.id)
      if (!palette) return
      const duplicate: PaletteNode = {
        ...palette,
        id: `palette-${Date.now()}`,
        title: `${palette.title} copy`,
        ...offset,
        createdAt: timestamp,
        addedAt: timestamp,
        updatedAt: timestamp,
      }
      setPalettes((current) => [...current, duplicate])
      setSelection({ type: 'palette', id: duplicate.id })
      return
    }

    if (selection.type === 'diagram') {
      const diagram = diagrams.find((candidate) => candidate.id === selection.id)
      if (!diagram) return
      const duplicate: DiagramNode = {
        ...diagram,
        id: `diagram-${Date.now()}`,
        title: `${diagram.title} copy`,
        nodeIds: [...diagram.nodeIds],
        ...offset,
        createdAt: timestamp,
        addedAt: timestamp,
        updatedAt: timestamp,
      }
      setDiagrams((current) => [...current, duplicate])
      setSelection({ type: 'diagram', id: duplicate.id })
      return
    }

    const placeholder = placeholders.find((candidate) => candidate.id === selection.id)
    if (!placeholder) return
    const duplicate: PlaceholderNode = {
      ...placeholder,
      id: `placeholder-${Date.now()}`,
      title: `${placeholder.title} copy`,
      ...offset,
      createdAt: timestamp,
      addedAt: timestamp,
      updatedAt: timestamp,
    }
    setPlaceholders((current) => [...current, duplicate])
    setSelection({ type: 'placeholder', id: duplicate.id })
  }

  function confirmPendingDelete() {
    const deleteTarget = pendingDelete
    if (!deleteTarget) return
    setPendingDelete(null)
    if (deleteTarget.type === 'idea') {
      deleteIdea(deleteTarget.id)
      return
    }
    if (deleteTarget.type === 'image') {
      deleteImage(deleteTarget.id)
      return
    }
    if (deleteTarget.type === 'palette') {
      deletePalette(deleteTarget.id)
      return
    }
    if (deleteTarget.type === 'diagram') {
      deleteDiagram(deleteTarget.id)
      return
    }
    if (deleteTarget.type === 'placeholder') {
      deletePlaceholder(deleteTarget.id)
      return
    }
    deleteLink(deleteTarget.id)
  }

  function rebuildOutlineDraft() {
    const draft = createOutlineDraft(ideas, images, links)
    setOutlineDrafts([draft])
    setOutlineStatus('Draft rebuilt')
    setActiveView('Outline')
  }

  async function exportOutlineMarkdown() {
    const draft = latestOutlineDraft ?? createOutlineDraft(ideas, images, links)
    const markdown = outlineDraftToMarkdown(draft, ideas, images)
    if (isTauriRuntime()) {
      try {
        const exportedPath = await exportNativeOutlineMarkdown(markdown, projectPackage?.path)
        setOutlineStatus(exportedPath ? 'Exported Markdown' : 'Export canceled')
      } catch {
        setOutlineStatus('Export failed')
      }
      return
    }

    downloadTextFile(markdown, `${safeDownloadName(draft.title || 'outline')}.md`, 'text/markdown')
    setOutlineStatus('Markdown downloaded')
  }

  async function exportOutlineHtml() {
    const draft = latestOutlineDraft ?? createOutlineDraft(ideas, images, links)
    const html = outlineDraftToHtml(draft, ideas, images)
    if (isTauriRuntime()) {
      try {
        const exportedPath = await exportNativeOutlineHtml(html, projectPackage?.path)
        setOutlineStatus(exportedPath ? 'Exported HTML' : 'Export canceled')
      } catch {
        setOutlineStatus('Export failed')
      }
      return
    }

    downloadTextFile(html, `${safeDownloadName(draft.title || 'outline')}.html`, 'text/html')
    setOutlineStatus('HTML downloaded')
  }

  async function exportContactSheetHtml() {
    const html = contactSheetToHtml(visibleImages, ideas, links, {
      title: selectedTag ? `${selectedTag} references` : 'References',
      generatedAt: new Date().toISOString(),
    })
    if (isTauriRuntime()) {
      try {
        const exportedPath = await exportNativeContactSheetHtml(html, projectPackage?.path)
        setLibraryStatus(exportedPath ? 'Contact sheet exported' : 'Export canceled')
      } catch {
        setLibraryStatus('Export failed')
      }
      return
    }

    downloadTextFile(html, `${safeDownloadName(selectedTag ? `${selectedTag}-references` : 'references')}.html`, 'text/html')
    setLibraryStatus('Contact sheet downloaded')
  }

  async function exportSlideshowHtml(layoutMode: SlideLayoutMode = 'auto') {
    const { slides, deckMeta, title } = buildExportSlides(layoutMode)
    const html = slideLayoutsToHtml(slides, {
      title,
      generatedAt: new Date().toISOString(),
      deckMeta,
    })
    if (isTauriRuntime()) {
      try {
        const exportedPath = await exportNativeSlideshowHtml(html, projectPackage?.path)
        setSlideshowStatus(exportedPath ? 'Slides exported' : 'Export canceled')
      } catch {
        setSlideshowStatus('Export failed')
      }
      return
    }

    downloadTextFile(html, 'kira-slides.html', 'text/html')
    setSlideshowStatus('Slides downloaded')
  }

  function buildExportSlides(layoutMode: SlideLayoutMode) {
    const base = applySlideLayoutMode(buildSlideLayouts(ideas, images, links, palettes, diagrams), layoutMode)
    const slides = applySlidesConfig(base, slidesConfig)
    const deckMeta = applyDeckTemplate(buildSlideDeckMeta(slides), slidesConfig.template)
    const title = projectMetadata.title || slides[0]?.title || 'KIRA Slides'
    return { slides, deckMeta, title }
  }

  async function exportSlideshowPptx(layoutMode: SlideLayoutMode = 'auto') {
    setSlideshowStatus('Building PowerPoint…')
    try {
      const { slides, deckMeta, title } = buildExportSlides(layoutMode)
      const prs = await slidesToPptx(slides, deckMeta, title)
      const fileStem = safeDownloadName(title) || 'kira-slides'
      if (isTauriRuntime()) {
        const base64 = (await prs.write({ outputType: 'base64' })) as string
        const exportedPath = await exportNativeSlideshowPptx(base64, fileStem, projectPackage?.path)
        setSlideshowStatus(exportedPath ? 'PowerPoint exported' : 'Export canceled')
      } else {
        await prs.writeFile({ fileName: `${fileStem}.pptx` })
        setSlideshowStatus('PowerPoint downloaded')
      }
    } catch (error) {
      console.error('PPTX export failed', error)
      setSlideshowStatus('PowerPoint export failed')
    }
  }

  async function exportSlideshowPdf(layoutMode: SlideLayoutMode = 'auto') {
    const { slides, deckMeta, title } = buildExportSlides(layoutMode)
    const html = slideLayoutsToHtml(slides, { title, generatedAt: new Date().toISOString(), deckMeta })
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      window.setTimeout(() => {
        try {
          printWindow.print()
        } catch {
          /* user can print manually */
        }
      }, 700)
      setSlideshowStatus('Print dialog opened. Choose “Save as PDF”.')
      return
    }
    downloadTextFile(html, `${safeDownloadName(title) || 'kira-slides'}.html`, 'text/html')
    setSlideshowStatus('Saved HTML. Open it and print to PDF.')
  }

  async function exportSlidesToGoogleSlides(layoutMode: SlideLayoutMode = 'auto') {
    window.open('https://docs.google.com/presentation/u/0/create', '_blank', 'noopener,noreferrer')
    await exportSlideshowPptx(layoutMode)
    setSlideshowStatus('PPTX ready. In Google Slides use File ▸ Import slides.')
  }

  async function exportSlidesToCanva(layoutMode: SlideLayoutMode = 'auto') {
    window.open('https://www.canva.com/design?create&type=Presentation', '_blank', 'noopener,noreferrer')
    await exportSlideshowPptx(layoutMode)
    setSlideshowStatus('PPTX ready. In Canva use Upload ▸ your .pptx file.')
  }

  function toggleReferenceSelection(imageId: string) {
    setSelectedReferenceIds((current) => {
      const next = new Set(current)
      if (next.has(imageId)) {
        next.delete(imageId)
      } else {
        next.add(imageId)
      }
      return next
    })
  }

  function applyBatchTag() {
    const tag = batchTag.trim()
    if (!tag || selectedReferenceIds.size === 0) return
    setImages((current) =>
      current.map((image) =>
        selectedReferenceIds.has(image.id) && !image.tags.includes(tag)
          ? { ...image, tags: [...image.tags, tag], suggestions: removeSuggestionByLabel(image.suggestions, tag) }
          : image,
      ),
    )
    setBatchTag('')
  }

  function clearReferenceSelection() {
    setSelectedReferenceIds(new Set())
  }

  function linkSelectedReferencesToIdea(ideaId: string) {
    const imageIds = [...selectedReferenceIds]
    if (imageIds.length === 0) return

    const existingKeys = new Set(links.map((link) => `${link.imageId}:${link.ideaId}`))
    const created = imageIds
      .filter((imageId) => !existingKeys.has(`${imageId}:${ideaId}`))
      .map((imageId, index) => ({
        id: `link-${Date.now()}-${index}`,
        imageId,
        ideaId,
        relation: linkCreationRelation,
        note: 'Linked from Library selection.',
        confidence: 0.56,
      }))
    const existing = links.find((link) => imageIds.includes(link.imageId) && link.ideaId === ideaId)
    const targetLink = created.at(-1) ?? existing

    if (created.length > 0) {
      setLinks((current) => {
        const currentKeys = new Set(current.map((link) => `${link.imageId}:${link.ideaId}`))
        return [...current, ...created.filter((link) => !currentKeys.has(`${link.imageId}:${link.ideaId}`))]
      })
    }
    if (targetLink) {
      setSelection({ type: 'link', id: targetLink.id })
    }
    setSelectedReferenceIds(new Set())
  }

  function snapshotForVersionArchive(label = 'Version') {
    return {
      ...projectSnapshot,
      versionState,
      versionHistory: [],
      outlineDrafts,
      aiSettings: {
        providers: aiProviders,
        routingMode: aiRoutingMode,
        selectedProviderId: selectedAiProviderId,
      },
    } satisfies ProjectSnapshot
  }

  function saveVersionCheckpoint(
    label = `Version ${versionHistory.length + 1}`,
    trigger: ProjectVersionRecord['trigger'] = 'manual',
  ) {
    const timestamp = nowIso()
    const activeBranch = versionState.branches.find((branch) => branch.id === versionState.currentBranchId)
    const record: ProjectVersionRecord = {
      id: `version-${Date.now()}`,
      label,
      createdAt: timestamp,
      trigger,
      branchId: versionState.currentBranchId,
      parentVersionId: activeBranch?.headVersionId,
      snapshotJson: JSON.stringify(snapshotForVersionArchive(label)),
    }
    const nextVersionState = advanceVersionState(versionState, record)
    const nextVersionHistory = [record, ...versionHistory].slice(0, 50)
    setVersionState(nextVersionState)
    setVersionHistory(nextVersionHistory)
    window.localStorage.setItem(storageKey, JSON.stringify({
      ...projectSnapshot,
      versionState: nextVersionState,
      versionHistory: nextVersionHistory,
    }))
    setLibraryStatus(trigger === 'pre_present' ? 'Pre-presentation checkpoint saved' : 'Version saved')
    return record
  }

  function saveAsNewVersion(label = `Version ${versionHistory.length + 1}`) {
    saveVersionCheckpoint(label, 'manual')
  }

  function restoreProjectVersion(versionId: string) {
    const record = versionHistory.find((candidate) => candidate.id === versionId)
    if (!record) return
    try {
      const parsed = JSON.parse(record.snapshotJson)
      if (!isProjectSnapshot(parsed)) return
      const restoredSnapshot: ProjectSnapshot = {
        ...parsed,
        versionHistory: [],
      }
      const restoreRecord: ProjectVersionRecord = {
        id: `version-${Date.now()}-restore`,
        label: `Restore: ${record.label}`,
        createdAt: nowIso(),
        trigger: 'restore',
        branchId: record.branchId ?? versionState.currentBranchId,
        parentVersionId: versionHistory[0]?.id,
        restoredFromId: record.id,
        snapshotJson: JSON.stringify(restoredSnapshot),
      }
      const nextVersionHistory = [restoreRecord, ...versionHistory].slice(0, 50)
      const nextVersionState = advanceVersionState(versionState, restoreRecord)
      applyProjectSnapshot({
        ...restoredSnapshot,
        versionState: nextVersionState,
        versionHistory: nextVersionHistory,
      })
      setLibraryStatus(`Restored ${record.label}`)
      setIsVersionHistoryOpen(false)
    } catch {
      setLibraryStatus('Version restore failed')
    }
  }

  function switchVersionBranch(branchId: string) {
    const branch = versionState.branches.find((candidate) => candidate.id === branchId)
    if (!branch) return
    const nextVersionState: ProjectVersionState = {
      ...versionState,
      currentBranchId: branchId,
      currentVersionId: branch.headVersionId ?? versionState.currentVersionId,
    }
    const headVersion = branch.headVersionId
      ? versionHistory.find((candidate) => candidate.id === branch.headVersionId)
      : undefined

    if (headVersion) {
      try {
        const parsed = JSON.parse(headVersion.snapshotJson)
        if (isProjectSnapshot(parsed)) {
          applyProjectSnapshot({
            ...parsed,
            versionState: nextVersionState,
            versionHistory,
          })
          setLibraryStatus(`Branch: ${branch.name}`)
          return
        }
      } catch {
        setLibraryStatus(`Branch checkout failed: ${branch.name}`)
        return
      }
    }

    setVersionState(nextVersionState)
    setLibraryStatus(`Branch: ${branch.name}`)
  }

  function createVersionBranch(name: string) {
    const branchName = name.trim()
    if (!branchName) return
    const branchId = uniqueBranchId(branchName, versionState.branches)
    const sourceHead = versionState.branches.find((branch) => branch.id === versionState.currentBranchId)?.headVersionId ?? versionState.currentVersionId
    const createdAt = nowIso()
    setVersionState((current) => ({
      ...current,
      currentBranchId: branchId,
      currentVersionId: sourceHead,
      branches: [
        ...current.branches,
        {
          id: branchId,
          name: branchName,
          createdAt,
          headVersionId: sourceHead,
        },
      ],
    }))
    setLibraryStatus(`Created branch ${branchName}`)
  }

  useEffect(() => {
    if (activeView !== 'Slides') return
    if (lastPrePresentContentHashRef.current === projectContentHash) return
    lastPrePresentContentHashRef.current = projectContentHash
    saveVersionCheckpoint('Pre-presentation', 'pre_present')
  }, [activeView, projectContentHash])

  async function saveProject() {
    window.localStorage.setItem(storageKey, projectHash)

    if (isTauriRuntime()) {
      const savedPackage = await saveNativeProjectPackage(projectHash, projectPackage?.path)
      setProjectPackage(savedPackage)
      setLastSavedHash(projectHash)
      return
    }

    setLastSavedHash(projectHash)
    downloadProject(projectSnapshot)
  }

  async function saveProjectAs() {
    if (!isTauriRuntime()) {
      await saveProject()
      return
    }

    const selectedPath = await save({
      defaultPath: projectPackage?.path ?? 'KIRA Project.kira',
      filters: [{ name: 'KIRA Project', extensions: ['kira'] }],
    })
    if (!selectedPath) return

    window.localStorage.setItem(storageKey, projectHash)
    const savedPackage = await saveNativeProjectPackage(projectHash, selectedPath)
    setProjectPackage(savedPackage)
    setLastSavedHash(projectHash)
  }

  async function saveProjectAsNewVersion() {
    saveAsNewVersion()
    await Promise.resolve()
  }

  async function newProject() {
    const snapshot = createBlankProjectSnapshot()

    if (!isTauriRuntime()) {
      applyProjectSnapshot(snapshot)
      downloadProject(snapshot)
      return
    }

    const selectedPath = await save({
      defaultPath: 'Untitled.kira',
      filters: [{ name: 'KIRA Project', extensions: ['kira'] }],
    })
    if (!selectedPath) return

    const snapshotJson = JSON.stringify(snapshot)
    const savedPackage = await saveNativeProjectPackage(snapshotJson, selectedPath)
    applyProjectSnapshot(snapshot)
    setProjectPackage(savedPackage)
  }

  async function openProject() {
    if (!isTauriRuntime()) return

    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: 'Open KIRA Project',
    })
    if (!selectedPath || Array.isArray(selectedPath)) return

    const snapshot = await openNativeProjectPackage(selectedPath)
    if (!snapshot) return
    applyProjectSnapshot(snapshot)
    setProjectPackage({
      path: selectedPath,
      manifestPath: `${selectedPath}/manifest.json`,
      sqlitePath: `${selectedPath}/project.sqlite`,
    })
  }

  function importProject(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!isProjectSnapshot(parsed)) return
        applyProjectSnapshot(parsed)
      } catch {
        return
      }
    }
    reader.readAsText(file)
  }

  const shellThemeStyle = buildProjectAppearanceStyle(projectAppearance)

  return (
    <main className="app-shell" data-glass-state={glassStatus} data-color-mode={inferCanvasColorMode(projectAppearance.canvasColor)} style={shellThemeStyle} onPaste={capturePastedReference}>
      <section
        className={[
          'workspace',
          isLibraryCollapsed ? 'is-library-collapsed' : '',
          isInspectorCollapsed ? 'is-inspector-collapsed' : '',
          isLibraryFloating ? 'is-library-floating' : '',
          isInspectorFloating ? 'is-inspector-floating' : '',
          activeView === 'Settings' ? 'is-settings-workspace' : '',
        ].filter(Boolean).join(' ')}
        style={{ '--library-drawer-width': `${libraryDrawerWidth}px` } as React.CSSProperties}
      >
        <SystemSidebar
          canRedo={canRedoCanvas}
          canUndo={canUndoCanvas}
          isLibraryCollapsed={isLibraryCollapsed}
          libraryPanelMode={libraryPanelMode}
          saveLabel={projectHash === lastSavedHash ? 'Saved' : 'Save'}
          onImportProject={importProject}
          onNewProject={newProject}
          onOpenProject={openProject}
          onRedo={redoCanvas}
          onSaveProject={saveProject}
          onSaveVersion={saveProjectAsNewVersion}
          onLibraryPanelModeChange={setLibraryPanelMode}
          onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
          onToggleLibrary={() => setIsLibraryCollapsed((current) => !current)}
          onUndo={undoCanvas}
        />
        {activeView !== 'Settings' && (
          <>
            <EvidenceInbox
              allTags={libraryTags}
              browseMode={libraryBrowseMode}
              density={density}
              ideas={ideas}
              isCollapsed={isLibraryCollapsed}
              images={visibleImages}
              links={links}
              panelMode={libraryPanelMode}
              selectedTag={selectedTag}
              sortMode={sortMode}
              totalCount={images.length}
              batchTag={batchTag}
              searchQuery={searchQuery}
              status={libraryStatus}
              selectedReferenceIds={selectedReferenceIds}
              selected={selection}
              onBrowseModeChange={setLibraryBrowseMode}
              onPanelModeChange={setLibraryPanelMode}
              onCaptureClipboard={pasteReferenceFromClipboard}
              onCaptureScreen={captureScreenReference}
              onBatchTagChange={setBatchTag}
              onApplyBatchTag={applyBatchTag}
              onClearSelection={clearReferenceSelection}
              onDensityChange={setDensity}
              onExportContactSheet={exportContactSheetHtml}
              onImportEagleWebItems={importEagleWebItems}
              onImportFolder={importReferenceFolder}
              onImportReferences={importReferences}
              onSearchChange={setSearchQuery}
              onSelectedTagChange={(tag) => setSelectedTag((current) => (current === tag ? null : tag))}
              onSortModeChange={setSortMode}
              onToggleReference={toggleReferenceSelection}
              onSelect={(id) => setSelection({ type: 'image', id })}
              onSelectIdea={(id) => setSelection({ type: 'idea', id })}
              onSelectLink={(id) => setSelection({ type: 'link', id })}
              onToggleCollapsed={() => setIsLibraryCollapsed((current) => !current)}
              onToggleFloating={() => setIsLibraryFloating((current) => !current)}
            />
            {!isLibraryCollapsed && <div className="library-resize-handle" aria-hidden="true" onPointerDown={startLibraryDrawerResize} />}
          </>
        )}
        <section className="content-region">
          <TopBar
            activeView={activeView}
            isInspectorCollapsed={isInspectorCollapsed}
            setActiveView={setActiveView}
            onOpenSettings={() => setActiveView('Settings')}
            onToggleInspector={() => setIsInspectorCollapsed((current) => !current)}
          />
          <div className="view-region">
            {activeView === 'Outline' ? (
              <OutlineView
                draft={latestOutlineDraft}
                diagnostics={projectDiagnostics}
                status={outlineStatus}
                sections={outlineSections}
                onExportHtml={exportOutlineHtml}
                onExportMarkdown={exportOutlineMarkdown}
                onRebuild={rebuildOutlineDraft}
                onSelectDiagnostic={(diagnosticSelection) => {
                  setSelection(diagnosticSelection)
                  setActiveView('Canvas')
                }}
                onSelectIdea={(id) => {
                  setSelection({ type: 'idea', id })
                  setActiveView('Canvas')
                }}
                onSelectImage={(id) => {
                  setSelection({ type: 'image', id })
                  setActiveView('Canvas')
                }}
              />
            ) : activeView === '3D' ? (
              <Graph3DView
                ideas={ideas}
                images={images}
                palettes={palettes}
                diagrams={diagrams}
                placeholders={placeholders}
                links={links}
                selected={selection}
                onSelect={setSelection}
              />
            ) : activeView === 'Slides' ? (
              <SlideshowView
                ideas={ideas}
                images={images}
                palettes={palettes}
                diagrams={diagrams}
                links={links}
                selected={selection}
                status={slideshowStatus}
                slidesConfig={slidesConfig}
                onSlidesConfigChange={updateSlidesConfig}
                onExportHtml={exportSlideshowHtml}
                onExportPptx={exportSlideshowPptx}
                onExportPdf={exportSlideshowPdf}
                onExportGoogleSlides={exportSlidesToGoogleSlides}
                onExportCanva={exportSlidesToCanva}
                onSelect={setSelection}
              />
            ) : activeView === 'Settings' ? (
              <SettingsView
                providers={aiProviders}
                taskRoutes={aiTaskRoutes}
                routingMode={aiRoutingMode}
                selectedProviderId={selectedAiProviderId}
                activeProviderId={activeAiProviderId}
                localModelAvailable={localModelAvailable}
                localModelStatus={localModelStatus}
                extensionInstallStatus={extensionInstallStatus}
                status={aiSettingsStatus}
                onActiveProviderChange={setActiveAiProviderId}
                onProviderAdd={addAiProvider}
                onProviderChange={updateAiProvider}
                onProviderDelete={deleteAiProvider}
                onProviderSecretSave={saveAiProviderSecret}
                onProviderSecretDelete={deleteAiProviderSecret}
                onProviderTest={testAiProvider}
                onProviderModelsList={listAiModels}
                onProviderTaskToggle={toggleAiProviderTask}
                onRoutingModeChange={setAiRoutingMode}
                onSelectedProviderChange={setSelectedProviderWithActive}
                onOnboardingReset={resetOnboarding}
                onWelcomeOpen={() => openWelcomeProject(false)}
                onExtensionAction={handleExtensionInstallAction}
                onExtensionRefresh={refreshExtensionInstallStatus}
              />
            ) : (
              <GraphCanvas
                ideas={ideas}
                images={images}
                palettes={palettes}
                diagrams={diagrams}
                placeholders={placeholders}
                links={links}
                linkCreationRelation={linkCreationRelation}
                activeCanvasTool={activeCanvasTool}
                pendingLinkSource={pendingLinkSource}
                selected={selection}
                onSelect={setSelection}
                onCreateLink={createNodeLink}
                onCreateLinkedNode={createLinkedNode}
                onCreateAiNode={createAiNode}
                onApplyProjectTemplate={applyProjectTemplate}
                onGeneratePromptStarter={generatePromptStarter}
                onActiveCanvasToolChange={setActiveCanvasTool}
                onPendingLinkSourceChange={setPendingLinkSource}
                onCreateIdea={() => createIdea({ focusTitle: true })}
                onCreatePalette={() => createPaletteNode(selection.type === 'image' ? images.find((image) => image.id === selection.id) : undefined)}
                onCreatePlaceholder={createPlaceholder}
                onImportMermaid={importMermaidDiagram}
                onLinkCreationRelationChange={setLinkCreationRelation}
                onIdeaInlineChange={updateIdea}
                onDroppedReference={handleDroppedReference}
                onNodeMove={moveGraphNode}
                onNodeImportanceChange={changeNodeImportance}
                onNodesImportanceChange={changeSelectedNodesImportance}
                onDeleteNodes={deleteSelectedGraphNodes}
                onOrganize={organizeCanvas}
              />
            )}
          </div>
        </section>
        {activeView !== 'Settings' && !isInspectorCollapsed && (
          <Inspector
            isCollapsed={isInspectorCollapsed}
            selected={selected}
            images={images}
            ideas={ideas}
            palettes={palettes}
            diagrams={diagrams}
            placeholders={placeholders}
            links={links}
            nodeVersions={nodeVersions}
            onSelect={setSelection}
            onAcceptSuggestion={acceptSuggestion}
            onRejectSuggestion={rejectSuggestion}
            onRelationChange={updateRelation}
            onIdeaChange={updateIdea}
            onImageChange={updateImage}
            onLinkChange={updateLink}
            onLinkSwap={swapLinkDirection}
            onPaletteChange={updatePalette}
            onDiagramChange={updateDiagram}
            onPlaceholderChange={updatePlaceholder}
            onProjectMetadataChange={updateProjectMetadata}
            onProjectAppearanceChange={updateProjectAppearance}
            onPaletteColorChange={updatePaletteColor}
            onPaletteColorAdd={addPaletteColor}
            onPaletteColorRemove={removePaletteColor}
            onPaletteRegenerate={regeneratePalette}
            onReferenceTagAdd={addReferenceTag}
            onReferenceTagRemove={removeReferenceTag}
            onIdeaDelete={requestIdeaDelete}
            onReferenceFindSimilar={findSimilarReferences}
            onReferenceConvertToPalette={(imageId) => createPaletteNode(images.find((image) => image.id === imageId))}
            onImageDelete={requestImageDelete}
            onPaletteDelete={requestPaletteDelete}
            onDiagramDelete={requestDiagramDelete}
            onPlaceholderDelete={requestPlaceholderDelete}
            onLinkSelectedReferences={linkSelectedReferencesToIdea}
            onLinkDelete={requestLinkDelete}
            onNodeVersionRestore={restoreNodeVersion}
            onBeginLinkFromNode={beginCreateLinkFromNode}
            onDuplicateSelection={duplicateCurrentSelection}
            onOpenOutline={() => setActiveView('Outline')}
            onRebuildOutline={rebuildOutlineDraft}
            onReferenceOcr={runReferenceOcr}
            onReferenceTagRefine={refineReferenceTags}
            onReferenceReplace={replaceReferenceFromFiles}
            onReferenceReplaceFromImage={replaceReferenceFromExistingImage}
            onDroppedReference={handleDroppedReference}
            onPlaceholderAttach={attachPlaceholderImageFromFiles}
            linkCreationRelation={linkCreationRelation}
            onLinkCreationRelationChange={setLinkCreationRelation}
            localModelAvailable={localModelAvailable}
            modelRunningImageId={modelRunningImageId}
            modelStatusByImageId={modelStatusByImageId}
            ocrRunningImageId={ocrRunningImageId}
            ocrStatusByImageId={ocrStatusByImageId}
            ideaTitleFocusId={ideaTitleFocusId}
            onIdeaTitleFocused={() => setIdeaTitleFocusId(null)}
            selectedReferenceCount={selectedReferenceIds.size}
            onToggleCollapsed={() => setIsInspectorCollapsed((current) => !current)}
            onToggleFloating={() => setIsInspectorFloating((current) => !current)}
          />
        )}
      </section>
      {isLibraryFloating && (
        <FloatingPanel title="Library" defaultPosition={{ x: 72, y: 92 }} defaultSize={{ width: 330, height: 620 }}>
          <EvidenceInbox
            allTags={libraryTags}
            browseMode={libraryBrowseMode}
            density={density}
            ideas={ideas}
            isCollapsed={false}
            images={visibleImages}
            links={links}
            panelMode={libraryPanelMode}
            selectedTag={selectedTag}
            sortMode={sortMode}
            totalCount={images.length}
            batchTag={batchTag}
            searchQuery={searchQuery}
            status={libraryStatus}
            selectedReferenceIds={selectedReferenceIds}
            selected={selection}
            onBrowseModeChange={setLibraryBrowseMode}
            onPanelModeChange={setLibraryPanelMode}
            onCaptureClipboard={pasteReferenceFromClipboard}
            onCaptureScreen={captureScreenReference}
            onBatchTagChange={setBatchTag}
            onApplyBatchTag={applyBatchTag}
            onClearSelection={clearReferenceSelection}
            onDensityChange={setDensity}
            onExportContactSheet={exportContactSheetHtml}
            onImportEagleWebItems={importEagleWebItems}
            onImportFolder={importReferenceFolder}
            onImportReferences={importReferences}
            onSearchChange={setSearchQuery}
            onSelectedTagChange={(tag) => setSelectedTag((current) => (current === tag ? null : tag))}
            onSortModeChange={setSortMode}
            onToggleReference={toggleReferenceSelection}
            onSelect={(id) => setSelection({ type: 'image', id })}
            onSelectIdea={(id) => setSelection({ type: 'idea', id })}
            onSelectLink={(id) => setSelection({ type: 'link', id })}
            onToggleCollapsed={() => setIsLibraryCollapsed((current) => !current)}
            onToggleFloating={() => setIsLibraryFloating(false)}
          />
        </FloatingPanel>
      )}
      {isInspectorFloating && (
        <FloatingPanel title="Inspector" defaultPosition={{ x: 820, y: 92 }} defaultSize={{ width: 370, height: 620 }}>
          <Inspector
            isCollapsed={false}
            selected={selected}
            images={images}
            ideas={ideas}
            palettes={palettes}
            diagrams={diagrams}
            placeholders={placeholders}
            links={links}
            nodeVersions={nodeVersions}
            onSelect={setSelection}
            onAcceptSuggestion={acceptSuggestion}
            onRejectSuggestion={rejectSuggestion}
            onRelationChange={updateRelation}
            onIdeaChange={updateIdea}
            onImageChange={updateImage}
            onLinkChange={updateLink}
            onLinkSwap={swapLinkDirection}
            onPaletteChange={updatePalette}
            onDiagramChange={updateDiagram}
            onPlaceholderChange={updatePlaceholder}
            onProjectMetadataChange={updateProjectMetadata}
            onProjectAppearanceChange={updateProjectAppearance}
            onPaletteColorChange={updatePaletteColor}
            onPaletteColorAdd={addPaletteColor}
            onPaletteColorRemove={removePaletteColor}
            onPaletteRegenerate={regeneratePalette}
            onReferenceTagAdd={addReferenceTag}
            onReferenceTagRemove={removeReferenceTag}
            onIdeaDelete={requestIdeaDelete}
            onReferenceFindSimilar={findSimilarReferences}
            onReferenceConvertToPalette={(imageId) => createPaletteNode(images.find((image) => image.id === imageId))}
            onImageDelete={requestImageDelete}
            onPaletteDelete={requestPaletteDelete}
            onDiagramDelete={requestDiagramDelete}
            onPlaceholderDelete={requestPlaceholderDelete}
            onLinkSelectedReferences={linkSelectedReferencesToIdea}
            onLinkDelete={requestLinkDelete}
            onNodeVersionRestore={restoreNodeVersion}
            onBeginLinkFromNode={beginCreateLinkFromNode}
            onDuplicateSelection={duplicateCurrentSelection}
            onOpenOutline={() => setActiveView('Outline')}
            onRebuildOutline={rebuildOutlineDraft}
            onReferenceOcr={runReferenceOcr}
            onReferenceTagRefine={refineReferenceTags}
            onReferenceReplace={replaceReferenceFromFiles}
            onReferenceReplaceFromImage={replaceReferenceFromExistingImage}
            onDroppedReference={handleDroppedReference}
            onPlaceholderAttach={attachPlaceholderImageFromFiles}
            linkCreationRelation={linkCreationRelation}
            onLinkCreationRelationChange={setLinkCreationRelation}
            localModelAvailable={localModelAvailable}
            modelRunningImageId={modelRunningImageId}
            modelStatusByImageId={modelStatusByImageId}
            ocrRunningImageId={ocrRunningImageId}
            ocrStatusByImageId={ocrStatusByImageId}
            ideaTitleFocusId={ideaTitleFocusId}
            onIdeaTitleFocused={() => setIdeaTitleFocusId(null)}
            selectedReferenceCount={selectedReferenceIds.size}
            onToggleCollapsed={() => setIsInspectorCollapsed((current) => !current)}
            onToggleFloating={() => setIsInspectorFloating(false)}
          />
        </FloatingPanel>
      )}
      <ConfirmDeleteDialog
        pendingDelete={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
      />
      <VersionHistoryDialog
        isOpen={isVersionHistoryOpen}
        versionState={versionState}
        versions={versionHistory}
        onClose={() => setIsVersionHistoryOpen(false)}
        onBranchCreate={createVersionBranch}
        onBranchSelect={switchVersionBranch}
        onRestore={restoreProjectVersion}
        onSaveVersion={() => saveAsNewVersion()}
      />
      {isOnboardingOpen && (
        <OnboardingOverlay
          providers={aiProviders}
          localModelAvailable={localModelAvailable}
          localModelStatus={localModelStatus}
          extensionInstallStatus={extensionInstallStatus}
          onClose={finishOnboarding}
          onProviderFocus={focusProviderSetup}
          onProviderSecretSave={saveAiProviderSecret}
          onProviderTest={testAiProvider}
          onLocalCheck={refreshFoundationModelAvailability}
          onWelcomeOpen={() => openWelcomeProject(true)}
          onExtensionAction={handleExtensionInstallAction}
          onExtensionRefresh={refreshExtensionInstallStatus}
        />
      )}
    </main>
  )
}

function FloatingPanel({
  title,
  defaultPosition,
  defaultSize,
  children,
}: {
  title: string
  defaultPosition: { x: number; y: number }
  defaultSize: { width: number; height: number }
  children: React.ReactNode
}) {
  return (
    <Rnd
      className="floating-panel"
      default={{
        x: defaultPosition.x,
        y: defaultPosition.y,
        width: defaultSize.width,
        height: defaultSize.height,
      }}
      minWidth={280}
      minHeight={360}
      bounds="window"
      dragHandleClassName="floating-panel-handle"
    >
      <div className="floating-panel-handle" aria-label={`${title} panel`}>
        <span>{title}</span>
      </div>
      <div className="floating-panel-body">
        {children}
      </div>
    </Rnd>
  )
}

function OnboardingOverlay({
  providers,
  localModelAvailable,
  localModelStatus,
  extensionInstallStatus,
  onClose,
  onProviderFocus,
  onProviderSecretSave,
  onProviderTest,
  onLocalCheck,
  onWelcomeOpen,
  onExtensionAction,
  onExtensionRefresh,
}: {
  providers: AiProviderProfile[]
  localModelAvailable: boolean
  localModelStatus: string
  extensionInstallStatus: ExtensionInstallStatus
  onClose: () => void
  onProviderFocus: (providerId: string) => void
  onProviderSecretSave: (providerId: string, secret: string) => void
  onProviderTest: (providerId: string) => void
  onLocalCheck: () => void
  onWelcomeOpen: () => void
  onExtensionAction: (targetId: string) => void
  onExtensionRefresh: () => void
}) {
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({})
  const primaryProviderNotes = providerConnectionNotes.filter((note) => note.providerId === 'openai' || note.providerId === 'anthropic')
  const localProviderNote = providerConnectionNotes.find((note) => note.providerId === 'apple-foundation')
  const connectedProviderCount = providers.filter((provider) => provider.status === 'connected' || provider.secretRef).length
  const installedExtensionCount = extensionInstallTargets.filter((target) => extensionStatusForTarget(extensionInstallStatus, target.id).installed).length

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-label="KIRA onboarding">
      <section className="onboarding-shell">
        <button className="icon-button onboarding-close" type="button" aria-label="Close onboarding" onClick={onClose}>
          <X size={16} />
        </button>

        <div className="onboarding-hero">
          <div className="onboarding-orbit" aria-hidden="true">
            <span className="onboarding-orbit-ring" />
            <span className="onboarding-orbit-dot onboarding-orbit-dot--ai">🧠</span>
            <span className="onboarding-orbit-dot onboarding-orbit-dot--capture">📎</span>
            <span className="onboarding-orbit-dot onboarding-orbit-dot--spark">✨</span>
            <span className="onboarding-brand-core">
              <img src="/kira-icon.png" alt="" />
            </span>
          </div>
          <div>
            <span className="onboarding-kicker">KIRA setup</span>
            <h2>Start calm. Add power when you need it.</h2>
            <p>One key, one capture helper, one guided board.</p>
            <div className="onboarding-status-row" aria-label="Setup status">
              <span><Bot size={13} /> {connectedProviderCount > 0 ? 'AI ready' : 'AI optional'}</span>
              <span><Sparkles size={13} /> {installedExtensionCount > 0 ? 'Capture ready' : 'Capture optional'}</span>
            </div>
          </div>
        </div>

        <div className="onboarding-steps">
          <section className="onboarding-step-card onboarding-step-card--primary">
            <div className="onboarding-step-head">
              <span className="onboarding-step-icon">🧠</span>
              <div>
                <strong>Connect AI</strong>
                <small>Bring your own OpenAI or Claude API key</small>
              </div>
              <button className="quiet-button" type="button" onClick={() => onProviderFocus('openai')}>
                Settings
              </button>
            </div>
            <p>Use OpenAI or Claude when you need AI help.</p>

            <details className="onboarding-detail">
              <summary>API keys</summary>
              <div className="onboarding-provider-list">
                {primaryProviderNotes.map((note) => {
                const provider = providers.find((candidate) => candidate.id === note.providerId)
                const secretDraft = secretDrafts[note.providerId] ?? ''
                return (
                  <article className="onboarding-provider-card" key={note.id}>
                    <div>
                      <strong>{note.title}</strong>
                      <small>{provider ? aiProviderStatusLabels[provider.status] : localModelAvailable ? 'available' : 'unavailable'}</small>
                    </div>
                    <p>{note.truth}</p>
                    {provider && provider.authMode !== 'local' && (
                      <label>
                        <span>{note.action}</span>
                        <input
                          type="password"
                          value={secretDraft}
                          placeholder={provider.secretRef ? 'Stored in Keychain' : 'API key'}
                          onChange={(event) => setSecretDrafts((current) => ({ ...current, [note.providerId]: event.target.value }))}
                        />
                      </label>
                    )}
                    <div className="onboarding-action-row">
                      {provider && provider.authMode !== 'local' && (
                        <>
                          <button
                            className="primary-button"
                            type="button"
                            onClick={() => {
                              onProviderSecretSave(note.providerId, secretDraft)
                              setSecretDrafts((current) => ({ ...current, [note.providerId]: '' }))
                            }}
                          >
                            Save key
                          </button>
                          <button className="quiet-button" type="button" onClick={() => onProviderTest(note.providerId)}>
                            Test
                          </button>
                        </>
                      )}
                      {provider?.authMode === 'local' && (
                        <button className="primary-button" type="button" onClick={onLocalCheck}>
                          Check local
                        </button>
                      )}
                      <button className="quiet-button" type="button" onClick={() => onProviderFocus(note.providerId)}>
                        Settings
                      </button>
                      {note.href && (
                        <button className="icon-button" type="button" aria-label={`Open ${note.title} key page`} onClick={() => window.open(note.href, '_blank', 'noopener,noreferrer')}>
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </article>
                )
                })}
              </div>
            </details>

            {localProviderNote && (
              <details className="onboarding-detail onboarding-detail--quiet">
                <summary>Local fallback</summary>
                <div className="onboarding-mini-row">
                  <span>{localModelAvailable ? 'Available' : 'Not detected'}</span>
                  <small>{localModelStatus}</small>
                  <button className="quiet-button" type="button" onClick={onLocalCheck}>
                    Check
                  </button>
                </div>
              </details>
            )}
          </section>

          <section className="onboarding-step-card">
            <div className="onboarding-step-head">
              <span className="onboarding-step-icon">📎</span>
              <div>
                <strong>Capture from browser</strong>
                <small>Chrome or Safari helper</small>
              </div>
              <button className="icon-button" type="button" aria-label="Refresh extension status" onClick={onExtensionRefresh}>
                <LocateFixed size={13} />
              </button>
            </div>
            <p>Save images, links, and text from the web.</p>
            <details className="onboarding-detail">
              <summary>Install helpers</summary>
              <div className="extension-install-list">
                {extensionInstallTargets.map((target) => (
                  <article className="extension-install-card" key={target.id}>
                    <div>
                      <strong>{target.title}</strong>
                      <small>{extensionStatusForTarget(extensionInstallStatus, target.id).installed ? 'installed' : target.status}</small>
                    </div>
                    <p>{target.instruction}</p>
                    <code>{extensionStatusForTarget(extensionInstallStatus, target.id).detail}</code>
                    <div className="extension-card-actions">
                      <button className="quiet-button" type="button" onClick={() => onExtensionAction(target.installActionId)}>
                        {target.primary}
                      </button>
                      <button className="quiet-button" type="button" onClick={() => onExtensionAction(target.settingsActionId)}>
                        {target.secondary}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </details>
          </section>

          <section className="onboarding-step-card onboarding-start-card">
            <div className="onboarding-step-head">
              <span className="onboarding-step-icon">🌱</span>
              <div>
                <strong>Open the guided board</strong>
                <small>Learn the canvas by moving through it</small>
              </div>
            </div>
            <p>Open a small editable example instead of a blank canvas.</p>
          </section>
        </div>

        <footer className="onboarding-footer">
          <button className="quiet-button" type="button" onClick={onWelcomeOpen}>
            Open Welcome.kira
          </button>
          <button className="primary-button" type="button" onClick={onClose}>
            Start workspace
          </button>
        </footer>
      </section>
    </div>
  )
}

function SystemSidebar({
  canRedo,
  canUndo,
  isLibraryCollapsed,
  libraryPanelMode,
  saveLabel,
  onImportProject,
  onNewProject,
  onOpenProject,
  onOpenVersionHistory,
  onRedo,
  onSaveProject,
  onSaveVersion,
  onLibraryPanelModeChange,
  onToggleLibrary,
  onUndo,
}: {
  canRedo: boolean
  canUndo: boolean
  isLibraryCollapsed: boolean
  libraryPanelMode: LibraryPanelMode
  saveLabel: string
  onImportProject: (file: File) => void
  onNewProject: () => void
  onOpenProject: () => void
  onOpenVersionHistory: () => void
  onRedo: () => void
  onSaveProject: () => void
  onSaveVersion: () => void
  onLibraryPanelModeChange: (mode: LibraryPanelMode) => void
  onToggleLibrary: () => void
  onUndo: () => void
}) {
  const importInput = useRef<HTMLInputElement>(null)

  return (
    <aside
      className="system-sidebar"
      data-tauri-drag-region
      aria-label="Workspace"
      onDoubleClick={toggleWindowMaximizeFromChrome}
      onPointerDown={startWindowDrag}
    >
      <div className="system-sidebar-top" data-tauri-drag-region>
        <WindowControls />
        <div className="brand-mark sidebar-brand" data-tauri-drag-region>
          <img src="/kira-icon.png" alt="" />
        </div>
      </div>

      <div className="sidebar-source-group" aria-label="Content sources">
        {[
          { mode: 'images' as const, label: 'Images', icon: ImageIcon },
          { mode: 'ideas' as const, label: 'Ideas', icon: Lightbulb },
          { mode: 'links' as const, label: 'Links', icon: Workflow },
        ].map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            className={!isLibraryCollapsed && libraryPanelMode === mode ? 'sidebar-view-button is-active' : 'sidebar-view-button'}
            type="button"
            aria-label={isLibraryCollapsed ? `Open ${label}` : label}
            aria-pressed={!isLibraryCollapsed && libraryPanelMode === mode}
            title={label}
            onClick={() => {
              onLibraryPanelModeChange(mode)
              if (isLibraryCollapsed) onToggleLibrary()
            }}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      <div className="sidebar-app-actions" aria-label="File actions">
        <button className="sidebar-view-button" type="button" aria-label="Import project" title="Import" onClick={() => importInput.current?.click()}>
          <ArrowDownToLine size={18} />
        </button>
        <input
          ref={importInput}
          aria-label="Import project file"
          className="file-input"
          accept="application/json"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImportProject(file)
            event.target.value = ''
          }}
        />
        <SecondaryRail
          canRedo={canRedo}
          canUndo={canUndo}
          saveLabel={saveLabel}
          onNewProject={onNewProject}
          onOpenProject={onOpenProject}
          onOpenVersionHistory={onOpenVersionHistory}
          onRedo={onRedo}
          onSaveProject={onSaveProject}
          onSaveVersion={onSaveVersion}
          onUndo={onUndo}
        />
      </div>
    </aside>
  )
}

function TopBar({
  activeView,
  isInspectorCollapsed,
  setActiveView,
  onOpenSettings,
  onToggleInspector,
}: {
  activeView: ActiveView
  isInspectorCollapsed: boolean
  setActiveView: (view: ActiveView) => void
  onOpenSettings: () => void
  onToggleInspector: () => void
}) {
  const views: { label: ActiveView; icon: typeof Network }[] = [
    { label: 'Canvas', icon: Network },
    { label: '3D', icon: CircleDot },
    { label: 'Slides', icon: FileText },
    { label: 'Outline', icon: FileText },
  ]

  return (
    <header
      className="topbar"
      data-tauri-drag-region
      onDoubleClick={toggleWindowMaximizeFromChrome}
      onPointerDown={startWindowDrag}
    >
      <nav className="view-switch content-view-switch" aria-label="View">
        {views.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={activeView === label ? 'view-tab is-active' : 'view-tab'}
            type="button"
            aria-pressed={activeView === label}
            title={label}
            onClick={() => setActiveView(label)}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="content-toolbar-actions">
        <button
          className={activeView === 'Settings' ? 'icon-button top-settings-button is-active' : 'icon-button top-settings-button'}
          type="button"
          aria-label="Open Settings"
          aria-pressed={activeView === 'Settings'}
          title="Settings"
          onClick={onOpenSettings}
        >
          <Settings size={16} />
        </button>
        {activeView !== 'Settings' && (
          <button
            className={isInspectorCollapsed ? 'icon-button top-inspector-button' : 'icon-button top-inspector-button is-active'}
            type="button"
            aria-label={isInspectorCollapsed ? 'Open Inspector' : 'Close Inspector'}
            aria-pressed={!isInspectorCollapsed}
            title="Inspector"
            onClick={onToggleInspector}
          >
            {isInspectorCollapsed ? <PanelRightOpen size={16} /> : <Inspect size={16} />}
          </button>
        )}
      </div>
    </header>
  )
}

function SecondaryRail({
  canUndo,
  canRedo,
  saveLabel,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveVersion,
  onOpenVersionHistory,
  onUndo,
  onRedo,
}: {
  canUndo: boolean
  canRedo: boolean
  saveLabel: string
  onNewProject: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onSaveVersion: () => void
  onOpenVersionHistory: () => void
  onUndo: () => void
  onRedo: () => void
}) {
  const primaryItems = [
    { label: 'New', icon: FilePlus2, onClick: onNewProject, disabled: false },
    { label: 'Open', icon: FolderOpen, onClick: onOpenProject, disabled: !isTauriRuntime() },
    { label: saveLabel, icon: Save, onClick: onSaveProject, disabled: false },
  ]
  return (
    <aside className="secondary-rail" aria-label="File tools">
      {primaryItems.map(({ label, icon: Icon, onClick, disabled }) => (
        <button
          key={label}
          className="secondary-rail-button"
          type="button"
          aria-label={label}
          title={label}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon size={16} />
        </button>
      ))}
    </aside>
  )
}

function CodexApiKeyField({ busy, onSubmit }: { busy: boolean; onSubmit: (key: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="codex-login__apikey">
      <input
        type="password"
        value={value}
        placeholder="sk-…"
        onChange={(e) => setValue(e.target.value)}
      />
      <button className="quiet-button" type="button" disabled={busy || value.trim().length === 0} onClick={() => onSubmit(value.trim())}>
        Save key
      </button>
    </div>
  )
}

function SettingsView({
  providers,
  taskRoutes,
  routingMode,
  selectedProviderId,
  activeProviderId,
  localModelAvailable,
  localModelStatus,
  extensionInstallStatus,
  status,
  onActiveProviderChange,
  onProviderAdd,
  onProviderChange,
  onProviderDelete,
  onProviderSecretSave,
  onProviderSecretDelete,
  onProviderTest,
  onProviderModelsList,
  onProviderTaskToggle,
  onRoutingModeChange,
  onSelectedProviderChange,
  onOnboardingReset,
  onWelcomeOpen,
  onExtensionAction,
  onExtensionRefresh,
}: {
  providers: AiProviderProfile[]
  taskRoutes: AiTaskRoute[]
  routingMode: AiRoutingMode
  selectedProviderId: string
  activeProviderId: string
  localModelAvailable: boolean
  localModelStatus: string
  extensionInstallStatus: ExtensionInstallStatus
  status: string
  onActiveProviderChange: (providerId: string) => void
  onProviderAdd: (type: Exclude<AiProviderType, 'apple_foundation'>) => void
  onProviderChange: (providerId: string, patch: Partial<Pick<AiProviderProfile, 'name' | 'baseUrl' | 'model' | 'authMode'>>) => void
  onProviderDelete: (providerId: string) => void
  onProviderSecretSave: (providerId: string, secret: string) => void
  onProviderSecretDelete: (providerId: string) => void
  onProviderTest: (providerId: string) => void
  onProviderModelsList: (providerId: string) => void
  onProviderTaskToggle: (providerId: string, task: AiTaskKind) => void
  onRoutingModeChange: (mode: AiRoutingMode) => void
  onSelectedProviderChange: (providerId: string) => void
  onOnboardingReset: () => void
  onWelcomeOpen: () => void
  onExtensionAction: (targetId: string) => void
  onExtensionRefresh: () => void
}) {
  const remoteProviders = providers.filter((provider) => provider.authMode !== 'local')
  const selectedRemoteProvider = remoteProviders.find((provider) => provider.id === selectedProviderId) ?? remoteProviders[0]
  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers[0]
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({})
  const [codexLoginBusy, setCodexLoginBusy] = useState(false)
  const [codexLoginEvent, setCodexLoginEvent] = useState<CodexLoginEvent | null>(null)

  const activeProviderType = activeProvider?.type
  const activeProviderId_ = activeProvider?.id

  useEffect(() => {
    if (activeProviderType !== 'codex') return
    let unlisten: (() => void) | undefined
    void onCodexLoginProgress((event) => setCodexLoginEvent(event)).then((u) => { unlisten = u })
    return () => unlisten?.()
  }, [activeProviderType])

  // Reuse the existing Test-button handler (onProviderTest -> testAiProvider) to refresh provider status.
  function refreshCodexStatus() {
    if (activeProviderId_) onProviderTest(activeProviderId_)
  }

  async function startCodexLogin(method: 'chatgpt' | 'device' | 'api-key', apiKey?: string) {
    setCodexLoginBusy(true)
    setCodexLoginEvent(null)
    try {
      await requestCodexLogin(method, apiKey)
      refreshCodexStatus()
    } catch (error) {
      setCodexLoginEvent({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setCodexLoginBusy(false)
    }
  }
  const [providerTypeDraft, setProviderTypeDraft] = useState<Exclude<AiProviderType, 'apple_foundation'>>('custom_openai_compatible')
  const taskKeys = Object.keys(aiTaskLabels) as AiTaskKind[]
  const connectedProviderCount = providers.filter((provider) => provider.status === 'connected').length
  const storedSecretCount = providers.filter((provider) => provider.secretRef).length
  const billingSeparatedCount = remoteProviders.filter((provider) => provider.status === 'billing_separate').length
  const [activeSettingsTab, setActiveSettingsTab] = useState<'overview' | 'ai' | 'capture' | 'advanced'>('overview')
  const lang = useLangStore((state) => state.lang)
  const setLang = useLangStore((state) => state.setLang)
  const settingsTabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'ai' as const, label: 'AI' },
    { id: 'capture' as const, label: 'Capture' },
    { id: 'advanced' as const, label: 'Advanced' },
  ]

  return (
    <section className="settings-shell" aria-label="Settings">
      <div className="settings-scroll">
        <div className="settings-header">
          <div>
            <h2>Settings</h2>
          </div>
          <span className="settings-status">{status}</span>
        </div>

        <nav className="settings-tabs" aria-label="Settings sections">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              className={activeSettingsTab === tab.id ? 'is-active' : ''}
              type="button"
              aria-pressed={activeSettingsTab === tab.id}
              onClick={() => setActiveSettingsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeSettingsTab === 'overview' && (
          <>
            <section className="settings-control-strip" aria-label="AI defaults">
              <label>
                <span>Routing</span>
                <select value={routingMode} onChange={(event) => onRoutingModeChange(event.target.value as AiRoutingMode)}>
                  {Object.keys(aiRoutingLabels).map((mode) => (
                    <option key={mode} value={mode}>
                      {aiRoutingLabels[mode as AiRoutingMode]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Remote</span>
                <select value={selectedProviderId} onChange={(event) => onSelectedProviderChange(event.target.value)} disabled={remoteProviders.length === 0}>
                  {remoteProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="settings-chip">
                <span>Providers</span>
                <strong>{connectedProviderCount}/{providers.length}</strong>
              </div>
              <div className="settings-chip">
                <span>Local</span>
                <strong>{localModelAvailable ? 'available' : 'unavailable'}</strong>
              </div>
            </section>

            <section className="settings-section settings-overview-grid" aria-label="Settings overview">
              <article className="settings-panel">
                <h3>AI default</h3>
                <p>{aiRoutingLabels[routingMode]} · {selectedRemoteProvider?.name ?? 'No remote provider'}</p>
              </article>
              <article className="settings-panel">
                <h3>Capture</h3>
                <p>{extensionInstallTargets.filter((target) => extensionStatusForTarget(extensionInstallStatus, target.id).installed).length}/{extensionInstallTargets.length} browser helpers installed.</p>
              </article>
              <article className="settings-panel">
                <h3>Secrets</h3>
                <p>{storedSecretCount}/{remoteProviders.length} remote providers have Keychain secrets.</p>
              </article>
            </section>
          </>
        )}

        {activeSettingsTab === 'capture' && (
        <section className="settings-section settings-onboarding-grid" aria-label="Onboarding and extensions">
          <article className="settings-panel settings-action-panel">
            <div>
              <h3>Onboarding</h3>
              <p>Replay first-run setup for API keys, local fallback, and browser capture.</p>
            </div>
            <div className="settings-action-row">
              <button className="quiet-button" type="button" onClick={onWelcomeOpen}>
                Open Welcome.kira
              </button>
              <button className="quiet-button" type="button" onClick={onOnboardingReset}>
                Reset onboarding
              </button>
            </div>
          </article>

          <article className="settings-panel settings-action-panel">
            <div>
              <h3>Extensions</h3>
              <p>Install the current bundled capture helper into Chrome/Chromium or Safari.</p>
            </div>
            <div className="settings-extension-grid">
              {extensionInstallTargets.map((target) => (
                <div className="settings-extension-card" key={target.id}>
                  <div>
                    <span>{target.title}</span>
                    <small>{extensionStatusForTarget(extensionInstallStatus, target.id).installed ? 'installed' : extensionStatusForTarget(extensionInstallStatus, target.id).detail}</small>
                  </div>
                  <button className="quiet-button" type="button" onClick={() => onExtensionAction(target.installActionId)}>
                    {target.primary}
                  </button>
                  <button className="quiet-button" type="button" onClick={() => onExtensionAction(target.settingsActionId)}>
                    {target.secondary}
                  </button>
                </div>
              ))}
              <button className="quiet-button" type="button" onClick={onExtensionRefresh}>
                <span>Refresh</span>
                <small>Detect installed extensions</small>
              </button>
            </div>
          </article>
        </section>
        )}

        {activeSettingsTab === 'ai' && (
        <section className="settings-section" id="settings-providers">
          <div className="provider-workbench-grid">
            <aside className="provider-registry" aria-label="Provider registry">
              <div className="provider-add-row">
                <select value={providerTypeDraft} onChange={(event) => setProviderTypeDraft(event.target.value as Exclude<AiProviderType, 'apple_foundation'>)}>
                  {(Object.keys(aiProviderTemplates) as Exclude<AiProviderType, 'apple_foundation'>[]).map((type) => (
                    <option key={type} value={type}>
                      {aiProviderTypeLabels[type]}
                    </option>
                  ))}
                </select>
                <button className="quiet-button" type="button" onClick={() => onProviderAdd(providerTypeDraft)}>
                  Add
                </button>
              </div>

              <div className="provider-list">
                {providers.map((provider) => (
                  <button
                    className="provider-list-row"
                    type="button"
                    key={provider.id}
                    aria-pressed={provider.id === activeProvider.id}
                    data-status={provider.status}
                    onClick={() => onActiveProviderChange(provider.id)}
                  >
                    <span>
                      <strong>{provider.name}</strong>
                      <em>{aiProviderTypeLabels[provider.type]}</em>
                    </span>
                    <small>{aiProviderStatusLabels[provider.status]}</small>
                  </button>
                ))}
              </div>
            </aside>

            {activeProvider && (
              <article className="provider-card provider-card--detail" data-status={activeProvider.status}>
                <div className="provider-card-header">
                  <div>
                    <strong>{activeProvider.name}</strong>
                    <span>{aiProviderTypeLabels[activeProvider.type]} · {aiProviderStatusCopy[activeProvider.status]}</span>
                  </div>
                  <em>{aiProviderStatusLabels[activeProvider.status]}</em>
                </div>

                <div className="provider-detail-grid">
                  <label>
                    <span>Name</span>
                    <input
                      value={activeProvider.name}
                      onChange={(event) => onProviderChange(activeProvider.id, { name: event.target.value })}
                      disabled={activeProvider.authMode === 'local'}
                    />
                  </label>
                  <label>
                    <span>Auth mode</span>
                    <select
                      value={activeProvider.authMode}
                      onChange={(event) => onProviderChange(activeProvider.id, { authMode: event.target.value as AiAuthMode })}
                      disabled={activeProvider.authMode === 'local'}
                    >
                      <option value="local">local</option>
                      <option value="api_key">api_key</option>
                      <option value="oauth">oauth</option>
                      <option value="openai_compatible">openai_compatible</option>
                    </select>
                  </label>
                  <label>
                    <span>Base URL</span>
                    <input
                      value={activeProvider.baseUrl ?? ''}
                      placeholder={activeProvider.authMode === 'local' ? 'local runtime' : 'https://api.example.com/v1'}
                      onChange={(event) => onProviderChange(activeProvider.id, { baseUrl: event.target.value })}
                      disabled={activeProvider.authMode === 'local'}
                    />
                  </label>
                  <label>
                    <span>Model</span>
                    {activeProvider.discoveredModels && activeProvider.discoveredModels.length > 0 ? (
                      <select value={activeProvider.model} onChange={(event) => onProviderChange(activeProvider.id, { model: event.target.value })}>
                        {activeProvider.discoveredModels.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={activeProvider.model}
                        onChange={(event) => onProviderChange(activeProvider.id, { model: event.target.value })}
                        disabled={activeProvider.authMode === 'local'}
                      />
                    )}
                  </label>
                </div>

                {activeProvider.authMode === 'oauth' && activeProvider.type !== 'codex' && (
                  <div className="oauth-ready-note">
                    <strong>OAuth is for enterprise gateways only</strong>
                    <span>
                      Claude Pro/Max and ChatGPT Plus subscriptions cannot be connected by OAuth. Since
                      February 2026 Anthropic and OpenAI restrict subscription tokens to their own apps.
                      For Claude or OpenAI, switch this profile to <strong>API key</strong> and bring your own key.
                    </span>
                  </div>
                )}

                {activeProvider.type === 'codex' ? (
                  <div className="codex-login" data-status={activeProvider.status === 'connected' ? 'connected' : 'signed-out'}>
                    {activeProvider.status === 'connected' ? (
                      <div className="codex-login__signed-in">
                        <span className="codex-login__status-dot" aria-hidden="true" />
                        <span className="codex-login__status-text">{activeProvider.lastMessage ?? 'Signed in to Codex'}</span>
                        <button className="quiet-button" type="button" onClick={() => { void codexLogout().then(() => refreshCodexStatus()) }}>
                          Sign out
                        </button>
                      </div>
                    ) : (
                      <div className="codex-login__actions">
                        <button className="primary-button is-wide" type="button" disabled={codexLoginBusy} onClick={() => startCodexLogin('chatgpt')}>
                          {codexLoginBusy ? (
                            <>
                              <span className="codex-login__spinner" aria-hidden="true" />
                              Waiting for browser…
                            </>
                          ) : (
                            'Sign in with ChatGPT'
                          )}
                        </button>
                        <div className="codex-login__alt">
                          <button className="quiet-button" type="button" disabled={codexLoginBusy} onClick={() => startCodexLogin('device')}>
                            Use a sign-in code
                          </button>
                          {codexLoginBusy && (
                            <button className="quiet-button" type="button" onClick={() => { void cancelCodexLogin() }}>Cancel</button>
                          )}
                        </div>
                        <details className="codex-login__details">
                          <summary>Use an API key instead</summary>
                          <CodexApiKeyField busy={codexLoginBusy} onSubmit={(key) => startCodexLogin('api-key', key)} />
                        </details>
                      </div>
                    )}
                    {codexLoginEvent?.type === 'oauth_url' && (
                      <p className="codex-login__hint">
                        Browser didn’t open?{' '}
                        <a href={codexLoginEvent.url} target="_blank" rel="noreferrer">Continue sign-in here</a>
                      </p>
                    )}
                    {codexLoginEvent?.type === 'device_code' && (
                      <div className="codex-login__device">
                        <span>Open <a href={codexLoginEvent.verificationUrl} target="_blank" rel="noreferrer">{codexLoginEvent.verificationUrl}</a> and enter</span>
                        <code>{codexLoginEvent.userCode}</code>
                        <button className="quiet-button" type="button" onClick={() => { void navigator.clipboard.writeText(codexLoginEvent.userCode) }}>Copy</button>
                      </div>
                    )}
                    {codexLoginEvent?.type === 'error' && <p className="codex-login__error">{codexLoginEvent.message}</p>}
                  </div>
                ) : activeProvider.authMode !== 'local' ? (
                  <label>
                    <span>API key</span>
                    <input
                      value={secretDrafts[activeProvider.id] ?? ''}
                      type="password"
                      placeholder={activeProvider.secretRef ? 'Stored in Keychain' : 'Paste your own API key (sk-…)'}
                      onChange={(event) =>
                        setSecretDrafts((current) => ({ ...current, [activeProvider.id]: event.target.value }))
                      }
                    />
                    {(() => {
                      const help = aiProviderKeyHelp(activeProvider.type)
                      return help ? (
                        <a className="provider-key-help" href={help.href} target="_blank" rel="noreferrer">
                          {help.label} ↗
                        </a>
                      ) : null
                    })()}
                  </label>
                ) : null}

                <div className="provider-actions-row">
                  {activeProvider.authMode !== 'local' && (
                    <>
                      <button
                        className="quiet-button provider-test-button"
                        type="button"
                        onClick={() => {
                          onProviderSecretSave(activeProvider.id, secretDrafts[activeProvider.id] ?? '')
                          setSecretDrafts((current) => ({ ...current, [activeProvider.id]: '' }))
                        }}
                      >
                        Save key
                      </button>
                      <button className="quiet-button provider-test-button" type="button" onClick={() => onProviderSecretDelete(activeProvider.id)}>
                        Remove key
                      </button>
                    </>
                  )}
                  <button className="quiet-button provider-test-button" type="button" onClick={() => onProviderTest(activeProvider.id)}>
                    Test
                  </button>
                  <button className="quiet-button provider-test-button" type="button" onClick={() => onProviderModelsList(activeProvider.id)}>
                    Models
                  </button>
                  {activeProvider.authMode === 'oauth' && (
                    <button className="quiet-button provider-test-button" type="button" disabled>
                      Connect OAuth
                    </button>
                  )}
                  {activeProvider.authMode !== 'local' && (
                    <button className="danger-inline-button" type="button" onClick={() => onProviderDelete(activeProvider.id)}>
                      Delete profile
                    </button>
                  )}
                </div>

                <div className="provider-task-matrix" aria-label="Default tasks for active provider">
                  {taskKeys.map((task) => (
                    <label key={task} className="provider-task-toggle">
                      <input
                        type="checkbox"
                        checked={activeProvider.defaultFor.includes(task)}
                        onChange={() => onProviderTaskToggle(activeProvider.id, task)}
                      />
                      <span>{aiTaskLabels[task]}</span>
                    </label>
                  ))}
                </div>

                <div className="provider-meta-strip" aria-label="Provider runtime status">
                  <span>{activeProvider.authMode === 'local' ? 'Local runtime' : activeProvider.secretRef ? 'Keychain secret' : 'No secret'}</span>
                  <span>{activeProvider.lastTestedAt ? `Tested ${formatMetadataTime(activeProvider.lastTestedAt)}` : 'Untested'}</span>
                  {activeProvider.lastMessage && <span>{activeProvider.lastMessage}</span>}
                </div>
              </article>
            )}
          </div>
        </section>
        )}

        {activeSettingsTab === 'ai' && (
          <section className="settings-section settings-route-preview">
            <details className="settings-panel settings-disclosure" open>
              <summary>
                <h3>Routing preview</h3>
                <span>{taskRoutes.length} tasks</span>
              </summary>
              <div className="task-route-list" aria-label="AI task routing preview">
                {taskRoutes.map((route) => (
                  <div className="task-route-row" key={route.task}>
                    <span>{aiTaskLabels[route.task]}</span>
                    <strong>{route.providerName}</strong>
                    <em>{route.reason}</em>
                  </div>
                ))}
              </div>
            </details>
          </section>
        )}

        {activeSettingsTab === 'advanced' && (
        <section className="settings-section settings-compact-disclosures">
          <details className="settings-panel settings-disclosure" open>
            <summary>
              <h3><T k="lang.label" /></h3>
              <span>{lang === 'vi' ? 'Tiếng Việt' : 'English'}</span>
            </summary>
            <div className="settings-language">
              <p className="settings-language__hint"><T k="lang.hint" /></p>
              <div className="settings-language__toggle" role="group" aria-label="Language">
                <button
                  type="button"
                  className={lang === 'en' ? 'is-active' : ''}
                  aria-pressed={lang === 'en'}
                  onClick={() => setLang('en')}
                >
                  English
                </button>
                <button
                  type="button"
                  className={lang === 'vi' ? 'is-active' : ''}
                  aria-pressed={lang === 'vi'}
                  onClick={() => setLang('vi')}
                >
                  Tiếng Việt
                </button>
              </div>
            </div>
          </details>

          <details className="settings-panel settings-disclosure" open>
            <summary>
              <h3>Local</h3>
              <span>{localModelStatus}</span>
            </summary>
            <dl className="settings-definition-list">
              <div>
                <dt>Apple Foundation Models</dt>
                <dd>{localModelAvailable ? 'available' : 'unavailable'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{localModelStatus}</dd>
              </div>
              <div>
                <dt>Default use</dt>
                <dd>Tagging, classification, outline, diagram summary</dd>
              </div>
            </dl>
          </details>

          <details className="settings-panel settings-disclosure" id="settings-secrets" open>
            <summary>
              <h3>Secrets</h3>
              <span>{storedSecretCount} stored</span>
            </summary>
            <div className="settings-chip-grid">
              <span><Check size={13} /> macOS Keychain</span>
              <span><X size={13} /> No browser tokens</span>
              <span><Database size={13} /> {storedSecretCount}/{remoteProviders.length} remote</span>
            </div>
          </details>

          <details className="settings-panel settings-disclosure" open>
            <summary>
              <h3>Usage</h3>
              <span>{billingSeparatedCount} API billed</span>
            </summary>
            <div className="settings-chip-grid">
              <span><Bot size={13} /> Bring your own API key</span>
              <span><Sparkles size={13} /> Local-first fallback</span>
              <span><Check size={13} /> No subscription passthrough</span>
            </div>
          </details>
        </section>
        )}
      </div>
    </section>
  )
}

function WindowControls() {
  if (!isTauriRuntime()) return null
  const appWindow = getCurrentWindow()

  return (
    <div className="window-controls" aria-label="Window controls">
      <button
        className="window-control window-control--close"
        type="button"
        aria-label="Close window"
        onClick={() => void appWindow.close()}
      />
      <button
        className="window-control window-control--minimize"
        type="button"
        aria-label="Minimize window"
        onClick={() => void appWindow.minimize()}
      />
      <button
        className="window-control window-control--maximize"
        type="button"
        aria-label="Toggle maximize"
        onClick={() => void appWindow.toggleMaximize()}
      />
    </div>
  )
}

function startWindowDrag(event: React.PointerEvent<HTMLElement>) {
  if (!isTauriRuntime() || event.button !== 0) return
  if (isInteractiveChromeTarget(event.target)) return
  void getCurrentWindow().startDragging().catch(() => undefined)
}

function toggleWindowMaximizeFromChrome(event: React.MouseEvent<HTMLElement>) {
  if (!isTauriRuntime()) return
  if (isInteractiveChromeTarget(event.target)) return
  void getCurrentWindow().toggleMaximize().catch(() => undefined)
}

function isInteractiveChromeTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button, input, textarea, select, a, [role="button"]'))
}

function EvidenceInbox({
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
  selectedReferenceIds,
  selected,
  onBrowseModeChange,
  onPanelModeChange,
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
  onToggleCollapsed,
  onToggleFloating,
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
  selectedReferenceIds: Set<string>
  selected: Selection
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
  onToggleFloating: () => void
}) {
  const importInput = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [isToolsOpen, setIsToolsOpen] = useState(false)
  const [libraryScrollTop, setLibraryScrollTop] = useState(0)
  const [libraryViewportHeight, setLibraryViewportHeight] = useState(0)
  const unassigned = images.filter((image) => image.suggestions.length > 0)
  const selectedCount = selectedReferenceIds.size
  const panelCounts: Record<LibraryPanelMode, number> = {
    images: images.length,
    ideas: ideas.length,
    links: links.length,
  }
  const visibleIdeas = useMemo(
    () => ideas.filter((idea) => {
      const query = searchQuery.trim().toLowerCase()
      return !query || `${idea.title} ${idea.body} ${idea.notes ?? ''}`.toLowerCase().includes(query)
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
  const rowHeight = browseMode === 'grid' ? libraryGridItemHeight : libraryRowHeights[density]
  const totalListHeight = images.length * rowHeight
  const startIndex = Math.max(0, Math.floor(libraryScrollTop / rowHeight) - libraryOverscan)
  const visibleCount = Math.ceil((libraryViewportHeight || 1) / rowHeight) + libraryOverscan * 2
  const endIndex = Math.min(images.length, startIndex + visibleCount)
  const visibleImages = images.slice(startIndex, endIndex)

  useEffect(() => {
    const element = listRef.current
    if (!element) return

    function updateViewportHeight() {
      setLibraryViewportHeight(element?.clientHeight ?? 0)
    }

    updateViewportHeight()
    const observer = new ResizeObserver(updateViewportHeight)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setLibraryScrollTop(0)
    listRef.current?.scrollTo({ top: 0 })
  }, [browseMode, density, searchQuery, selectedTag, sortMode])

  useDismissableLayer(isToolsOpen, '.library-drawer, [data-menu-trigger="library-tools"]', () => setIsToolsOpen(false))

  if (isCollapsed) {
    return (
      <aside className="inbox panel inbox--collapsed library-drawer-panel">
        <button className="icon-button" type="button" aria-label="Expand library" onClick={onToggleCollapsed}>
          <PanelRight size={16} />
        </button>
      </aside>
    )
  }

  return (
    <aside
      className={isDraggingFiles ? 'inbox panel library-drawer-panel is-dragging-files' : 'inbox panel library-drawer-panel'}
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
        <div>
          <p className="panel-kicker"><T k="library.title" /></p>
          <h2>{panelMode === 'images' ? 'Images' : panelMode === 'ideas' ? 'Ideas' : 'Links'}</h2>
          <span className="panel-meta">
            {panelCounts[panelMode]} items · {unassigned.length} suggestions
          </span>
        </div>
        <div className="panel-actions">
          <button className="icon-button" type="button" aria-label="Undock library" onClick={onToggleFloating}>
            <Maximize2 size={15} />
          </button>
          <button className="icon-button" type="button" aria-label="Collapse library" onClick={onToggleCollapsed}>
            <PanelLeft size={16} />
          </button>
          <button className="icon-button" type="button" aria-label="Import image" onClick={() => importInput.current?.click()}>
            <ImagePlus size={16} />
          </button>
          <button
            aria-expanded={isToolsOpen}
            className={isToolsOpen ? 'icon-button is-active' : 'icon-button'}
            data-menu-trigger="library-tools"
            type="button"
            aria-label="Library tools"
            onClick={() => setIsToolsOpen((current) => !current)}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
        <input
          ref={importInput}
          aria-label="Import reference images"
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

      <div className="search-field">
        <Search size={15} />
        <input
          aria-label="Search library"
          value={searchQuery}
          placeholder={panelMode === 'images' ? 'Search images' : panelMode === 'ideas' ? 'Search ideas' : 'Search links'}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      {panelMode === 'images' && (
      <div className="library-browse-bar" aria-label="Library browse controls">
        <div className="library-browse-mode" aria-label="Browse mode">
          <button
            aria-pressed={browseMode === 'list'}
            className={browseMode === 'list' ? 'is-active' : ''}
            type="button"
            onClick={() => onBrowseModeChange('list')}
          >
            List
          </button>
          <button
            aria-pressed={browseMode === 'grid'}
            className={browseMode === 'grid' ? 'is-active' : ''}
            type="button"
            onClick={() => onBrowseModeChange('grid')}
          >
            Grid
          </button>
        </div>
        <span>{images.length} visible</span>
      </div>
      )}

      {isToolsOpen && (
        <div className="library-tools-popover">
          <div className="library-command-menu" aria-label="Library actions">
            <button type="button" onClick={onCaptureClipboard}>
              <Clipboard size={14} />
              Paste URL
            </button>
            <button type="button" onClick={onExportContactSheet}>
              <ArrowDownToLine size={14} />
              Export
            </button>
            {isTauriRuntime() && (
              <>
                <button type="button" onClick={onCaptureScreen}>
                  <Camera size={14} />
                  Screen
                </button>
                <button type="button" onClick={onImportEagleWebItems}>
                  <Database size={14} />
                  Eagle
                </button>
                <button type="button" onClick={onImportFolder}>
                  <FolderOpen size={14} />
                  Folder
                </button>
              </>
            )}
          </div>
          {panelMode === 'images' && (
          <div className="filter-chips" aria-label="Tags">
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
          {panelMode === 'images' && (
          <div className="library-tools">
            <select aria-label="Sort references" value={sortMode} onChange={(event) => onSortModeChange(event.target.value as SortMode)}>
              <option value="recent">Recent</option>
              <option value="title">Title</option>
              <option value="source">Source</option>
            </select>
            <div className="density-toggle" aria-label="Density">
              <button
                aria-pressed={density === 'compact'}
                aria-label="Compact density"
                className={density === 'compact' ? 'is-active' : ''}
                type="button"
                onClick={() => onDensityChange('compact')}
              >
                C
              </button>
              <button
                aria-pressed={density === 'relaxed'}
                aria-label="Relaxed density"
                className={density === 'relaxed' ? 'is-active' : ''}
                type="button"
                onClick={() => onDensityChange('relaxed')}
              >
                R
              </button>
            </div>
          </div>
          )}
        </div>
      )}

      {panelMode === 'images' ? (
        <div
          className={`image-list image-list--${density} image-list--${browseMode}`}
        data-rendered-count={visibleImages.length}
        data-total-count={images.length}
        ref={listRef}
        onScroll={(event) => setLibraryScrollTop(event.currentTarget.scrollTop)}
      >
        {images.length > 0 && browseMode === 'grid' ? (
          <div className="image-grid-window">
            {images.map((image) => (
              <div
                key={image.id}
                className={selected.type === 'image' && selected.id === image.id ? 'image-grid-card is-selected' : 'image-grid-card'}
              >
                <input
                  aria-label={`Select ${image.title}`}
                  checked={selectedReferenceIds.has(image.id)}
                  type="checkbox"
                  onChange={() => onToggleReference(image.id)}
                />
                <button
                  draggable
                  type="button"
                  onClick={() => onSelect(image.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-kira-image-id', image.id)
                    event.dataTransfer.setData('text/plain', image.id)
                  }}
                >
                  <ReferenceThumb image={image} />
                  <span className="image-row-copy">
                    <strong>{image.title}</strong>
                    <small>{image.source}</small>
                    <span className="mini-tags">
                      {image.tags.slice(0, 2).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        ) : images.length > 0 ? (
          <div className="image-list-window" style={{ height: totalListHeight }}>
            {visibleImages.map((image, visibleIndex) => {
              const index = startIndex + visibleIndex
              return (
            <div
              key={image.id}
              className={selected.type === 'image' && selected.id === image.id ? 'image-row is-selected' : 'image-row'}
              style={{ transform: `translateY(${index * rowHeight}px)` }}
            >
              <input
                aria-label={`Select ${image.title}`}
                checked={selectedReferenceIds.has(image.id)}
                type="checkbox"
                onChange={() => onToggleReference(image.id)}
              />
              <button
                draggable
                type="button"
                onClick={() => onSelect(image.id)}
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/x-kira-image-id', image.id)
                  event.dataTransfer.setData('text/plain', image.id)
                }}
              >
                <ReferenceThumb image={image} />
                <span className="image-row-copy">
                  <strong>{image.title}</strong>
                  <small>{image.source}</small>
                  <span className="mini-tags">
                    {image.tags.slice(0, 2).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </span>
                </span>
              </button>
            </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No references yet</strong>
            <span>Drag in images, paste a URL, or import a folder to start your moodboard.</span>
            <button className="primary-button" type="button" onClick={() => importInput.current?.click()}>
              Import images
            </button>
          </div>
        )}
        </div>
      ) : panelMode === 'ideas' ? (
        <div className="library-node-list" role="list" aria-label="Ideas">
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
                <small>{idea.status} · {idea.body}</small>
              </span>
            </button>
          ))}
          {visibleIdeas.length === 0 && <div className="empty-state"><strong>No ideas</strong><span>Captured text ideas will appear here.</span></div>}
        </div>
      ) : (
        <div className="library-node-list" role="list" aria-label="Links">
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
          {visibleLinks.length === 0 && <div className="empty-state"><strong>No links</strong><span>Browser link captures and graph relations will appear here.</span></div>}
        </div>
      )}
      {isDraggingFiles && <div className="drop-copy">Drop images into Library</div>}
      <div className="library-footer">
        {selectedCount > 0 ? (
          <div className="batch-bar">
            <span className="selection-count">{selectedCount} selected</span>
            <input
              aria-label="Batch tag"
              value={batchTag}
              placeholder="Tag"
              onChange={(event) => onBatchTagChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onApplyBatchTag()
              }}
            />
            <button type="button" onClick={onApplyBatchTag}>
              Apply
            </button>
            <button type="button" onClick={onClearSelection}>
              Clear
            </button>
          </div>
        ) : (
          <div className="inbox-footer-action" role="status">
            <Sparkles size={14} />
            {status}
          </div>
        )}
      </div>
    </aside>
  )
}

function GraphCanvas({
  ideas,
  images,
  palettes,
  diagrams,
  placeholders,
  links,
  linkCreationRelation,
  activeCanvasTool,
  pendingLinkSource,
  selected,
  onSelect,
  onCreateLink,
  onCreateLinkedNode,
  onCreateAiNode,
  onApplyProjectTemplate,
  onGeneratePromptStarter,
  onActiveCanvasToolChange,
  onPendingLinkSourceChange,
  onCreateIdea,
  onCreatePalette,
  onCreatePlaceholder,
  onImportMermaid,
  onLinkCreationRelationChange,
  onIdeaInlineChange,
  onDroppedReference,
  onNodeMove,
  onNodeImportanceChange,
  onNodesImportanceChange,
  onDeleteNodes,
  onOrganize,
}: {
  ideas: Idea[]
  images: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  placeholders: PlaceholderNode[]
  links: EvidenceLink[]
  linkCreationRelation: Relation
  activeCanvasTool: CanvasTool
  pendingLinkSource: Pick<GraphNodeRef, 'kind' | 'id'> | null
  selected: Selection
  onSelect: (selection: Selection) => void
  onCreateLink: (source: Pick<GraphNodeRef, 'kind' | 'id'>, target: Pick<GraphNodeRef, 'kind' | 'id'>, relation?: Relation) => void
  onCreateLinkedNode: (source: Pick<GraphNodeRef, 'kind' | 'id'>, targetKind: GraphNodeKind) => void
  onCreateAiNode: (request: AiNodeRequest) => void | Promise<void>
  onApplyProjectTemplate: (templateId: ProjectTemplateId) => void
  onGeneratePromptStarter: (prompt: string) => void
  onActiveCanvasToolChange: React.Dispatch<React.SetStateAction<CanvasTool>>
  onPendingLinkSourceChange: React.Dispatch<React.SetStateAction<Pick<GraphNodeRef, 'kind' | 'id'> | null>>
  onCreateIdea: () => void
  onCreatePalette: () => void
  onCreatePlaceholder: () => void
  onImportMermaid: (source: string) => void | Promise<void>
  onLinkCreationRelationChange: (relation: Relation) => void
  onIdeaInlineChange: (ideaId: string, patch: Partial<Pick<Idea, 'title' | 'body' | 'notes'>>) => void
  onDroppedReference: (payload: DroppedReferencePayload, target: DroppedReferenceTarget) => void | Promise<void>
  onNodeMove: (kind: GraphNodeKind, id: string, position: Pick<Idea, 'x' | 'y'>) => void
  onNodeImportanceChange: (kind: GraphNodeKind, id: string, delta: number) => void
  onNodesImportanceChange: (nodes: CanvasNodeSelection[], delta: number) => void
  onDeleteNodes: (nodes: CanvasNodeSelection[]) => void
  onOrganize: (mode: GraphOrganizeMode) => void
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const draggingNodeRef = useRef<{
    kind: GraphNodeKind
    id: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const [draggingNode, setDraggingNode] = useState<{
    kind: GraphNodeKind
    id: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const [graphTransform, setGraphTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [graphMode, setGraphMode] = useState<GraphMode>('edit')
  const [graphScope, setGraphScope] = useState<GraphScope>('all')
  const [relationFilter, setRelationFilter] = useState<RelationFilter>('all')
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryFilter>('all')
  const [graphCap, setGraphCap] = useState<GraphCap>(300)
  const [organizeMode, setOrganizeMode] = useState<GraphOrganizeMode>('cluster')
  const [isGraphToolsOpen, setIsGraphToolsOpen] = useState(false)
  const [arcMenu, setArcMenu] = useState<Pick<GraphNodeRef, 'kind' | 'id' | 'x' | 'y'> | null>(null)
  const [multiSelectedNodes, setMultiSelectedNodes] = useState<CanvasNodeSelection[]>([])
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodes: CanvasNodeSelection[] } | null>(null)
  const [editingIdeaField, setEditingIdeaField] = useState<{ id: string; field: 'title' | 'body' } | null>(null)
  const [starterPrompt, setStarterPrompt] = useState('')
  const [aiNodeDraft, setAiNodeDraft] = useState<{
    source: Pick<GraphNodeRef, 'kind' | 'id'>
    action: AiNodeAction
    scope: AiNodeScope
    prompt: string
  } | null>(null)

  useDismissableLayer(
    isGraphToolsOpen || Boolean(arcMenu) || Boolean(nodeContextMenu),
    '.node-context-menu, .node-arc-menu, .graph-tools-drawer, [data-menu-trigger="graph-tools"], .node-add-control',
    () => {
      setIsGraphToolsOpen(false)
      setArcMenu(null)
      setNodeContextMenu(null)
    },
  )

  const graphView = useMemo(
    () => filterGraphView(ideas, images, links, selected, graphScope, relationFilter),
    [ideas, images, links, selected, graphScope, relationFilter],
  )
  const discoveryViewRaw = useMemo(
    () => buildDiscoveryGraphView(graphView.ideas, graphView.images, graphView.links),
    [graphView],
  )
  const discoveryView = useMemo(
    () => filterDiscoveryGraphView(discoveryViewRaw, discoveryFilter),
    [discoveryViewRaw, discoveryFilter],
  )
  const uncappedView = graphMode === 'discover' ? discoveryView : graphView
  const displayView = useMemo(() => capGraphView(uncappedView, selected, graphCap), [graphCap, selected, uncappedView])
  const displaySuggestions = hasDiscoverySuggestions(displayView) ? displayView.suggestions : []
  const related = useMemo(() => getSelectionNeighborhood(selected, displayView.links), [displayView.links, selected])
  const visibleNodeCount = displayView.ideas.length + displayView.images.length + palettes.length + diagrams.length + placeholders.length
  const nodeDensityScale = layoutDensityScale(visibleNodeCount)
  const graphMetrics = useMemo<GraphMetrics>(() => ({
    mode: graphMode,
    cap: graphCap,
    totalNodes: ideas.length + images.length + palettes.length + diagrams.length + placeholders.length,
    visibleNodes: visibleNodeCount,
    visibleIdeas: displayView.ideas.length,
    visibleImages: displayView.images.length,
    visibleLinks: displayView.links.length,
    visibleSuggestions: displaySuggestions.length,
  }), [diagrams.length, displaySuggestions.length, displayView, graphCap, graphMode, ideas.length, images.length, palettes.length, placeholders.length, visibleNodeCount])

  useEffect(() => {
    if (!isDevRuntime()) return
    ;(window as KiraWindow).__kiraGraphMetrics = graphMetrics
  }, [graphMetrics])

  useEffect(() => {
    if (!editingIdeaField) return
    if (selected.type !== 'idea' || selected.id !== editingIdeaField.id) setEditingIdeaField(null)
  }, [editingIdeaField, selected])

  useEffect(() => {
    setMultiSelectedNodes((current) => current.filter((node) => resolveGraphNodeRef(node.id, ideas, images, palettes, diagrams, placeholders)))
  }, [diagrams, ideas, images, palettes, placeholders])

  useEffect(() => {
    function handleCanvasKeydown(event: KeyboardEvent) {
      if (isEditableEventTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'escape') {
        setArcMenu(null)
        setNodeContextMenu(null)
        setMultiSelectedNodes([])
        onPendingLinkSourceChange(null)
        onActiveCanvasToolChange('select')
        return
      }
      if ((key === 'backspace' || key === 'delete') && multiSelectedNodes.length > 0) {
        event.preventDefault()
        onDeleteNodes(multiSelectedNodes)
        setMultiSelectedNodes([])
        setNodeContextMenu(null)
        return
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === 'l') {
        event.preventDefault()
        setArcMenu(null)
        onPendingLinkSourceChange(null)
        onActiveCanvasToolChange((current) => current === 'link' ? 'select' : 'link')
        return
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && (event.key === '+' || event.key === '=')) {
        event.preventDefault()
        updateZoom(0.15)
        return
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === '-') {
        event.preventDefault()
        updateZoom(-0.15)
        return
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === '0') {
        event.preventDefault()
        resetGraphView()
      }
    }

    window.addEventListener('keydown', handleCanvasKeydown)
    return () => window.removeEventListener('keydown', handleCanvasKeydown)
  }, [multiSelectedNodes, onActiveCanvasToolChange, onDeleteNodes, onPendingLinkSourceChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-node-kind][data-node-id]') : null
      if (!target) return
      const kind = target.dataset.nodeKind as GraphNodeKind | undefined
      const id = target.dataset.nodeId
      if (!kind || !id) return
      event.preventDefault()
      event.stopPropagation()
      onSelect({ type: kind, id } as Selection)
      onNodeImportanceChange(kind, id, event.deltaY < 0 ? 0.25 : -0.25)
    }

    document.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => document.removeEventListener('wheel', handleWheel, { capture: true })
  }, [onNodeImportanceChange, onSelect])

  function pointerPercent(event: React.PointerEvent<HTMLElement>) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null

    return {
      x: ((event.clientX - rect.left - graphTransform.x) / graphTransform.scale / rect.width) * 100,
      y: ((event.clientY - rect.top - graphTransform.y) / graphTransform.scale / rect.height) * 100,
    }
  }

  function eventPercent(event: React.MouseEvent<HTMLElement>) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null

    return {
      x: ((event.clientX - rect.left - graphTransform.x) / graphTransform.scale / rect.width) * 100,
      y: ((event.clientY - rect.top - graphTransform.y) / graphTransform.scale / rect.height) * 100,
    }
  }

  function dragPercent(event: React.DragEvent<HTMLElement>) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null

    return {
      x: clamp(((event.clientX - rect.left - graphTransform.x) / graphTransform.scale / rect.width) * 100, 5, 95),
      y: clamp(((event.clientY - rect.top - graphTransform.y) / graphTransform.scale / rect.height) * 100, 6, 94),
    }
  }

  function handleReferenceDragOver(event: React.DragEvent<HTMLElement>) {
    if (graphMode !== 'edit' || !hasDroppedReferencePayload(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleReferenceDrop(event: React.DragEvent<HTMLElement>, target: DroppedReferenceTarget) {
    if (graphMode !== 'edit') return false
    const payload = extractDroppedReferencePayload(event.dataTransfer)
    if (!payload) return false
    event.preventDefault()
    event.stopPropagation()
    void onDroppedReference(payload, target)
    return true
  }

  function selectedCanvasNodes() {
    if (multiSelectedNodes.length > 0) return multiSelectedNodes
    if (!isNodeSelection(selected)) return []
    return [{ kind: selected.type, id: selected.id }] as CanvasNodeSelection[]
  }

  function isCanvasNodeSelected(kind: GraphNodeKind, id: string) {
    if (multiSelectedNodes.some((node) => node.kind === kind && node.id === id)) return true
    return multiSelectedNodes.length === 0 && selected.type === kind && selected.id === id
  }

  function toggleCanvasNode(kind: GraphNodeKind, id: string) {
    const node = { kind, id }
    setMultiSelectedNodes((current) => {
      const key = nodeSelectionKey(node)
      const base = current.length > 0
        ? current
        : isNodeSelection(selected)
          ? [{ kind: selected.type, id: selected.id } as CanvasNodeSelection]
          : []
      return base.some((item) => nodeSelectionKey(item) === key)
        ? base.filter((item) => nodeSelectionKey(item) !== key)
        : [...base, node]
    })
    onSelect({ type: kind, id } as Selection)
    setNodeContextMenu(null)
  }

  function clearMultiSelect() {
    setMultiSelectedNodes([])
    setNodeContextMenu(null)
  }

  function openNodeContextMenu(kind: GraphNodeKind, id: string, event: React.MouseEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    const clicked = { kind, id }
    const clickedKey = nodeSelectionKey(clicked)
    const nodes = multiSelectedNodes.some((node) => nodeSelectionKey(node) === clickedKey) ? multiSelectedNodes : [clicked]
    setMultiSelectedNodes(nodes)
    onSelect({ type: kind, id } as Selection)
    setNodeContextMenu({
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
      nodes,
    })
    setArcMenu(null)
  }

  function applyContextImportance(delta: number) {
    const nodes = nodeContextMenu?.nodes ?? selectedCanvasNodes()
    onNodesImportanceChange(nodes, delta)
    setNodeContextMenu(null)
  }

  function deleteContextNodes() {
    const nodes = nodeContextMenu?.nodes ?? selectedCanvasNodes()
    onDeleteNodes(nodes)
    setMultiSelectedNodes([])
    setNodeContextMenu(null)
  }

  function linkContextNodes() {
    const nodes = nodeContextMenu?.nodes ?? selectedCanvasNodes()
    if (nodes.length !== 2) return
    onCreateLink(nodes[0], nodes[1], linkCreationRelation)
    setNodeContextMenu(null)
  }

  function startNodeDrag(
    kind: GraphNodeKind,
    node: Pick<Idea, 'id' | 'x' | 'y'>,
    event: React.PointerEvent<HTMLElement>,
  ) {
    if (event.button === 2) return
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      event.preventDefault()
      event.stopPropagation()
      toggleCanvasNode(kind, node.id)
      return
    }
    if (graphMode === 'discover') {
      onSelect({ type: kind, id: node.id } as Selection)
      return
    }
    if (activeCanvasTool === 'link') return
    const pointer = pointerPercent(event)
    if (!pointer) return

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic pointer events used in browser QA do not always own capture.
      }
    }
    const nextDrag = {
      kind,
      id: node.id,
      offsetX: pointer.x - node.x,
      offsetY: pointer.y - node.y,
    }
    draggingNodeRef.current = nextDrag
    setDraggingNode(nextDrag)
    onSelect({ type: kind, id: node.id } as Selection)
    setMultiSelectedNodes([])
    setNodeContextMenu(null)
  }

  function selectGraphNode(kind: GraphNodeKind, id: string, event?: React.MouseEvent<HTMLElement>) {
    if (event?.shiftKey || event?.metaKey || event?.ctrlKey) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (activeCanvasTool === 'link') {
      if (!pendingLinkSource) {
        onPendingLinkSourceChange({ kind, id })
        onSelect({ type: kind, id } as Selection)
        return
      }
      onCreateLink(pendingLinkSource, { kind, id }, linkCreationRelation)
      onPendingLinkSourceChange(null)
      onActiveCanvasToolChange('select')
      setArcMenu(null)
      return
    }

    onSelect({ type: kind, id } as Selection)
    setMultiSelectedNodes([])
    setNodeContextMenu(null)
  }

  function openArcMenu(kind: GraphNodeKind, node: Pick<Idea, 'id' | 'x' | 'y'>, event: React.MouseEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    const anchor = eventPercent(event) ?? { x: node.x, y: node.y }
    setArcMenu((current) => current?.id === node.id && current.kind === kind ? null : { kind, id: node.id, x: anchor.x, y: anchor.y })
    onSelect({ type: kind, id: node.id } as Selection)
    setMultiSelectedNodes([])
    setNodeContextMenu(null)
  }

  function beginLinkFromArc(source: Pick<GraphNodeRef, 'kind' | 'id'>) {
    onActiveCanvasToolChange('link')
    onPendingLinkSourceChange(source)
    setArcMenu(null)
  }

  function createLinkedNodeFromArc(targetKind: GraphNodeKind) {
    if (!arcMenu) return
    const source = arcMenu
    setArcMenu(null)
    onCreateLinkedNode(source, targetKind)
  }

  function openAiNodeDraftFromArc() {
    if (!arcMenu) return
    const source = { kind: arcMenu.kind, id: arcMenu.id }
    setAiNodeDraft({
      source,
      action: 'summarize',
      scope: 'downstream_branch',
      prompt: aiNodeActionPrompts.summarize,
    })
    setArcMenu(null)
  }

  function submitAiNodeDraft() {
    if (!aiNodeDraft) return
    void onCreateAiNode(aiNodeDraft)
    setAiNodeDraft(null)
  }

  function submitPromptStarter() {
    const prompt = starterPrompt.trim()
    if (!prompt) return
    onGeneratePromptStarter(prompt)
    setStarterPrompt('')
  }

  function moveNode(kind: GraphNodeKind, id: string, event: React.PointerEvent<HTMLElement>) {
    const activeDrag = draggingNodeRef.current
    if (activeDrag?.kind !== kind || activeDrag.id !== id) return
    const pointer = pointerPercent(event)
    if (!pointer) return

    event.preventDefault()
    onNodeMove(kind, id, {
      x: clamp(pointer.x - activeDrag.offsetX, 5, 95),
      y: clamp(pointer.y - activeDrag.offsetY, 6, 94),
    })
  }

  function stopNodeDrag() {
    draggingNodeRef.current = null
    setDraggingNode(null)
  }

  function stopInlineEditEvent(event: React.SyntheticEvent<HTMLElement>) {
    event.stopPropagation()
  }

  function beginIdeaFieldEdit(ideaId: string, field: 'title' | 'body', event: React.SyntheticEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    setEditingIdeaField({ id: ideaId, field })
  }

  function handleIdeaFieldKeyDown(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, field: 'title' | 'body') {
    event.stopPropagation()
    if (event.key === 'Escape' || (field === 'title' && event.key === 'Enter')) {
      event.preventDefault()
      setEditingIdeaField(null)
    }
  }

  function updateZoom(delta: number) {
    setGraphTransform((current) => ({
      ...current,
      scale: clamp(Number((current.scale + delta).toFixed(2)), 0.65, 1.8),
    }))
  }

  function resetGraphView() {
    setGraphTransform({ x: 0, y: 0, scale: 1 })
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('[data-node-kind][data-node-id], button, input, textarea, select, .canvas-tool-rail, .canvas-secondary-rail, .graph-tools-drawer, .node-context-menu, .node-arc-menu, .canvas-zero-state, .ai-node-panel')) return
    onSelect({ type: 'project' })
    setNodeContextMenu(null)
    setArcMenu(null)
    setMultiSelectedNodes([])
    onPendingLinkSourceChange(null)
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: graphTransform.x,
      originY: graphTransform.y,
    }
    setIsPanning(true)
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (!pan) return

    setGraphTransform((current) => ({
      ...current,
      x: clamp(pan.originX + event.clientX - pan.startX, -280, 280),
      y: clamp(pan.originY + event.clientY - pan.startY, -220, 220),
    }))
  }

  function stopPan() {
    panRef.current = null
    setIsPanning(false)
  }

  function updateCanvasGridHotspot(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--grid-hot-x', `${event.clientX - rect.left}px`)
    event.currentTarget.style.setProperty('--grid-hot-y', `${event.clientY - rect.top}px`)
  }

  return (
    <section className="graph-shell">
      <div
        className={`${draggingNode ? 'graph-canvas is-dragging-node' : 'graph-canvas'}${isPanning ? ' is-panning' : ''}${graphMode === 'discover' ? ' is-discovery' : ''}${related.linkIds.size > 0 ? ' has-focus' : ''}`}
        data-graph-cap={graphMetrics.cap}
        data-graph-mode={graphMetrics.mode}
        data-total-nodes={graphMetrics.totalNodes}
        data-visible-nodes={graphMetrics.visibleNodes}
        ref={canvasRef}
        onPointerDown={startPan}
        onPointerMove={(event) => {
          updateCanvasGridHotspot(event)
          movePan(event)
        }}
        onPointerUp={stopPan}
        onPointerCancel={stopPan}
      >
        <div className="canvas-tool-rail" aria-label="Canvas tools">
          <div className="canvas-tool-group" aria-label="Select tools">
            <button
              type="button"
              aria-label="Select"
              className={activeCanvasTool === 'select' ? 'is-active' : ''}
              onClick={() => {
                onActiveCanvasToolChange('select')
                onPendingLinkSourceChange(null)
                setArcMenu(null)
              }}
            >
              <MousePointer2 size={15} />
            </button>
            <button
              type="button"
              aria-label="Create link"
              className={activeCanvasTool === 'link' ? 'is-active' : ''}
              onClick={() => {
                onActiveCanvasToolChange((current) => current === 'link' ? 'select' : 'link')
                onPendingLinkSourceChange(null)
                setArcMenu(null)
              }}
            >
              <span className="tool-link-glyph" aria-hidden="true"><i /><b /><i /></span>
            </button>
          </div>
          <div className="canvas-tool-group" aria-label="Create nodes">
            <button type="button" aria-label="Add image placeholder" onClick={onCreatePlaceholder}>
              <ImagePlus size={15} />
            </button>
            <button type="button" aria-label="Add palette" onClick={onCreatePalette}>
              <CircleDot size={15} />
            </button>
            <button type="button" aria-label="Add idea" onClick={onCreateIdea}>
              <Lightbulb size={15} />
            </button>
          </div>
          <div className="canvas-tool-group" aria-label="Import tools">
            <button
              type="button"
              aria-label="Import Mermaid diagram"
              onClick={() => {
                const source = window.prompt('Paste Mermaid graph or flowchart')
                if (source?.trim()) void onImportMermaid(source)
              }}
            >
              <FileText size={15} />
            </button>
          </div>
        </div>
        {graphMetrics.totalNodes === 0 && (
          <section className="canvas-zero-state" aria-label="Start a KIRA project">
            <div className="canvas-zero-heading">
              <span><Sparkles size={14} /> Start board</span>
              <h2>Choose a template or generate starter nodes</h2>
            </div>
            <div className="canvas-template-grid">
              {projectTemplateDefinitions.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className={template.id === 'welcome' ? 'canvas-template-card is-welcome' : 'canvas-template-card'}
                  onClick={() => onApplyProjectTemplate(template.id)}
                >
                  <strong>{template.title}</strong>
                  <span>{template.description}</span>
                </button>
              ))}
            </div>
            <div className="canvas-prompt-starter">
              <textarea
                value={starterPrompt}
                onChange={(event) => setStarterPrompt(event.target.value)}
                placeholder="Describe the board you want KIRA to prepare..."
                rows={3}
              />
              <button type="button" className="primary-button" disabled={!starterPrompt.trim()} onClick={submitPromptStarter}>
                <Sparkles size={14} />
                Generate nodes
              </button>
            </div>
          </section>
        )}
        <div
          className="graph-viewport"
          style={{ transform: `translate(${graphTransform.x}px, ${graphTransform.y}px) scale(${graphTransform.scale})` }}
          onDragOver={handleReferenceDragOver}
          onDrop={(event) => {
            const position = dragPercent(event) ?? { x: 50, y: 50 }
            handleReferenceDrop(event, { kind: 'canvas', position })
          }}
        >
          <svg className="edge-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" data-edge-render="smooth">
            <defs>
              <linearGradient id="edgeGradient" x1="0" x2="1">
                <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent-amber)" stopOpacity="0.52" />
              </linearGradient>
            </defs>
            {displayView.links.map((link) => {
              const source = resolveGraphNodePosition(
                link.sourceNodeId ?? link.imageId,
                displayView.ideas,
                displayView.images,
                palettes,
                diagrams,
                placeholders,
              )
              const target = resolveGraphNodePosition(
                link.targetNodeId ?? link.ideaId,
                displayView.ideas,
                displayView.images,
                palettes,
                diagrams,
                placeholders,
              )
              if (!source || !target) return null
              const active = selected.type === 'link' && selected.id === link.id
              const relatedLink = related.linkIds.has(link.id)
              const curve = smoothGraphEdge(source, target)
              return (
                <g key={link.id} onClick={() => onSelect({ type: 'link', id: link.id })}>
                  <path
                    d={curve.path}
                    className="edge-hit-path"
                  />
                  <path
                    d={curve.path}
                    className={active ? 'edge-line is-active' : relatedLink ? 'edge-line is-related' : 'edge-line'}
                  />
                </g>
              )
            })}
            {graphMode === 'discover' && displaySuggestions.map((suggestion) => {
              const image = displayView.images.find((candidate) => candidate.id === suggestion.imageId)
              const idea = displayView.ideas.find((candidate) => candidate.id === suggestion.ideaId)
              if (!image || !idea) return null
              const curve = smoothGraphEdge(image, idea)
              return (
                <path
                  key={`${suggestion.imageId}-${suggestion.ideaId}`}
                  d={curve.path}
                  className="edge-line edge-line--suggested"
                />
              )
            })}
          </svg>

          {displayView.links.map((link) => {
            const source = resolveGraphNodePosition(
              link.sourceNodeId ?? link.imageId,
              displayView.ideas,
              displayView.images,
              palettes,
              diagrams,
              placeholders,
            )
            const target = resolveGraphNodePosition(
              link.targetNodeId ?? link.ideaId,
              displayView.ideas,
              displayView.images,
              palettes,
              diagrams,
              placeholders,
            )
            if (!source || !target) return null
            const active = selected.type === 'link' && selected.id === link.id
            const relatedLink = related.linkIds.has(link.id)
            const curve = smoothGraphEdge(source, target)
            return (
              <button
                key={`${link.id}-joint`}
                className={active ? 'edge-joint is-active' : relatedLink ? 'edge-joint is-related' : 'edge-joint'}
                type="button"
                aria-label={`Select ${link.relation} relation`}
                style={{
                  left: `${curve.midX}%`,
                  top: `${curve.midY}%`,
                }}
                onClick={() => onSelect({ type: 'link', id: link.id })}
              />
            )
          })}

          {displayView.ideas.map((idea) => {
            const isSelectedIdea = selected.type === 'idea' && selected.id === idea.id
            const evidenceCount = displayView.links.filter((link) => link.ideaId === idea.id).length
            return (
              <div
                key={idea.id}
                className={[
                  'idea-node',
                  isSelectedIdea ? 'is-selected' : '',
                  isCanvasNodeSelected('idea', idea.id) && multiSelectedNodes.length > 0 ? 'is-multi-selected' : '',
                  related.ideaIds.has(idea.id) ? 'is-related' : '',
                ].filter(Boolean).join(' ')}
                data-node-kind="idea"
                data-node-id={idea.id}
                role="button"
                tabIndex={0}
                style={{
                  left: `${idea.x}%`,
                  top: `${idea.y}%`,
                  '--node-scale': nodeScale(idea.importance, nodeDensityScale),
                } as React.CSSProperties}
                onClick={(event) => selectGraphNode('idea', idea.id, event)}
                onContextMenu={(event) => openNodeContextMenu('idea', idea.id, event)}
                onKeyDown={(event) => {
                  if (isEditableEventTarget(event.target)) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    selectGraphNode('idea', idea.id)
                  }
                }}
                onPointerDown={(event) => startNodeDrag('idea', idea, event)}
                onPointerMove={(event) => moveNode('idea', idea.id, event)}
                onPointerUp={stopNodeDrag}
                onPointerCancel={stopNodeDrag}
                onDragOver={(event) => {
                  handleReferenceDragOver(event)
                }}
                onDrop={(event) => {
                  const position = dragPercent(event) ?? { x: idea.x + 4, y: idea.y + 4 }
                  handleReferenceDrop(event, { kind: 'idea', ideaId: idea.id, position })
                }}
              >
                <span
                  className="node-add-control"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${idea.title} node actions`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => openArcMenu('idea', idea, event)}
                >
                  <Plus size={11} />
                </span>
                <span className={`idea-status idea-status--${idea.status}`} />
                {isSelectedIdea ? (
                  <span className="idea-node-fields">
                    {editingIdeaField?.id === idea.id && editingIdeaField.field === 'title' ? (
                      <input
                        autoFocus
                        className="node-title-input"
                        aria-label="Idea title"
                        value={idea.title}
                        onPointerDown={stopInlineEditEvent}
                        onClick={stopInlineEditEvent}
                        onBlur={() => setEditingIdeaField(null)}
                        onKeyDown={(event) => handleIdeaFieldKeyDown(event, 'title')}
                        onChange={(event) => onIdeaInlineChange(idea.id, { title: event.target.value })}
                      />
                    ) : (
                      <button
                        className="node-title-display"
                        type="button"
                        aria-label="Edit idea title"
                        onPointerDown={stopInlineEditEvent}
                        onClick={(event) => beginIdeaFieldEdit(idea.id, 'title', event)}
                      >
                        {idea.title}
                      </button>
                    )}
                    {editingIdeaField?.id === idea.id && editingIdeaField.field === 'body' ? (
                      <textarea
                        autoFocus
                        className="node-note-input"
                        aria-label="Idea note"
                        placeholder="Note..."
                        value={idea.body}
                        onPointerDown={stopInlineEditEvent}
                        onClick={stopInlineEditEvent}
                        onBlur={() => setEditingIdeaField(null)}
                        onKeyDown={(event) => handleIdeaFieldKeyDown(event, 'body')}
                        onChange={(event) => onIdeaInlineChange(idea.id, { body: event.target.value })}
                      />
                    ) : (
                      <button
                        className="node-note-display"
                        type="button"
                        aria-label="Edit idea note"
                        onPointerDown={stopInlineEditEvent}
                        onClick={(event) => beginIdeaFieldEdit(idea.id, 'body', event)}
                      >
                        {idea.body || 'Note...'}
                      </button>
                    )}
                    <small className="node-meta-line">{idea.status === 'thin' ? 'needs evidence' : `${evidenceCount} evidence`}</small>
                  </span>
                ) : (
                  <>
                    <strong>{idea.title}</strong>
                    <small>{idea.status === 'thin' ? 'needs evidence' : `${evidenceCount} evidence`}</small>
                  </>
                )}
              </div>
            )
          })}

          {displayView.images.map((image) => (
            <button
              key={image.id}
              className={[
                'image-node',
                selected.type === 'image' && selected.id === image.id ? 'is-selected' : '',
                isCanvasNodeSelected('image', image.id) && multiSelectedNodes.length > 0 ? 'is-multi-selected' : '',
                related.imageIds.has(image.id) ? 'is-related' : '',
              ].filter(Boolean).join(' ')}
              data-node-kind="image"
              data-node-id={image.id}
              type="button"
              style={{
                left: `${image.x}%`,
                top: `${image.y}%`,
                '--node-scale': nodeScale(image.importance, nodeDensityScale),
              } as React.CSSProperties}
              onClick={(event) => selectGraphNode('image', image.id, event)}
              onContextMenu={(event) => openNodeContextMenu('image', image.id, event)}
              onPointerDown={(event) => startNodeDrag('image', image, event)}
              onPointerMove={(event) => moveNode('image', image.id, event)}
              onPointerUp={stopNodeDrag}
              onPointerCancel={stopNodeDrag}
              onDragOver={handleReferenceDragOver}
              onDrop={(event) => {
                handleReferenceDrop(event, { kind: 'image', imageId: image.id })
              }}
            >
              <span
                className="node-add-control"
                role="button"
                tabIndex={0}
                aria-label={`Open ${image.title} node actions`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => openArcMenu('image', image, event)}
              >
                <Plus size={11} />
              </span>
              <ReferenceThumb image={image} />
              <span className="node-palette">
                {image.palette.map((color, index) => (
                  <i key={`${image.id}-${index}-${color}`} style={{ background: color }} />
                ))}
              </span>
            </button>
          ))}

          {palettes.map((palette) => (
            <button
              key={palette.id}
              className={[
                'palette-node',
                selected.type === 'palette' && selected.id === palette.id ? 'is-selected' : '',
                isCanvasNodeSelected('palette', palette.id) && multiSelectedNodes.length > 0 ? 'is-multi-selected' : '',
              ].filter(Boolean).join(' ')}
              data-node-kind="palette"
              data-node-id={palette.id}
              type="button"
              style={{
                left: `${palette.x}%`,
                top: `${palette.y}%`,
                '--node-scale': nodeScale(palette.importance, nodeDensityScale),
              } as React.CSSProperties}
              onClick={(event) => selectGraphNode('palette', palette.id, event)}
              onContextMenu={(event) => openNodeContextMenu('palette', palette.id, event)}
              onPointerDown={(event) => startNodeDrag('palette', palette, event)}
              onPointerMove={(event) => moveNode('palette', palette.id, event)}
              onPointerUp={stopNodeDrag}
              onPointerCancel={stopNodeDrag}
            >
              <span
                className="node-add-control"
                role="button"
                tabIndex={0}
                aria-label={`Open ${palette.title} node actions`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => openArcMenu('palette', palette, event)}
              >
                <Plus size={11} />
              </span>
              <span className="palette-strip">
                {palette.colors.map((color, index) => (
                  <i key={`${palette.id}-${index}-${color}`} style={{ background: color }} />
                ))}
              </span>
              <strong>{palette.title}</strong>
              <small>{palette.algorithm}</small>
            </button>
          ))}

          {diagrams.map((diagram) => (
            <button
              key={diagram.id}
              className={[
                'diagram-node',
                selected.type === 'diagram' && selected.id === diagram.id ? 'is-selected' : '',
                isCanvasNodeSelected('diagram', diagram.id) && multiSelectedNodes.length > 0 ? 'is-multi-selected' : '',
              ].filter(Boolean).join(' ')}
              data-node-kind="diagram"
              data-node-id={diagram.id}
              type="button"
              style={{
                left: `${diagram.x}%`,
                top: `${diagram.y}%`,
                '--node-scale': nodeScale(diagram.importance, nodeDensityScale),
              } as React.CSSProperties}
              onClick={(event) => selectGraphNode('diagram', diagram.id, event)}
              onContextMenu={(event) => openNodeContextMenu('diagram', diagram.id, event)}
              onPointerDown={(event) => startNodeDrag('diagram', diagram, event)}
              onPointerMove={(event) => moveNode('diagram', diagram.id, event)}
              onPointerUp={stopNodeDrag}
              onPointerCancel={stopNodeDrag}
            >
              <span
                className="node-add-control"
                role="button"
                tabIndex={0}
                aria-label={`Open ${diagram.title} node actions`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => openArcMenu('diagram', diagram, event)}
              >
                <Plus size={11} />
              </span>
              <FileText size={15} />
              <strong>{diagram.title}</strong>
              <small>{diagram.nodeIds.length} nodes</small>
            </button>
          ))}

          {placeholders.map((placeholder) => (
            <button
              key={placeholder.id}
              className={[
                'placeholder-node',
                selected.type === 'placeholder' && selected.id === placeholder.id ? 'is-selected' : '',
                isCanvasNodeSelected('placeholder', placeholder.id) && multiSelectedNodes.length > 0 ? 'is-multi-selected' : '',
              ].filter(Boolean).join(' ')}
              data-node-kind="placeholder"
              data-node-id={placeholder.id}
              type="button"
              style={{
                left: `${placeholder.x}%`,
                top: `${placeholder.y}%`,
                '--node-scale': nodeScale(placeholder.importance, nodeDensityScale),
              } as React.CSSProperties}
              onClick={(event) => selectGraphNode('placeholder', placeholder.id, event)}
              onContextMenu={(event) => openNodeContextMenu('placeholder', placeholder.id, event)}
              onPointerDown={(event) => startNodeDrag('placeholder', placeholder, event)}
              onPointerMove={(event) => moveNode('placeholder', placeholder.id, event)}
              onPointerUp={stopNodeDrag}
              onPointerCancel={stopNodeDrag}
              onDragOver={handleReferenceDragOver}
              onDrop={(event) => {
                const position = dragPercent(event) ?? { x: placeholder.x, y: placeholder.y }
                handleReferenceDrop(event, { kind: 'placeholder', placeholderId: placeholder.id, position })
              }}
            >
              <span
                className="node-add-control"
                role="button"
                tabIndex={0}
                aria-label={`Open ${placeholder.title} node actions`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => openArcMenu('placeholder', placeholder, event)}
              >
                <Plus size={11} />
              </span>
              <ImagePlus size={16} />
              <span>{placeholder.title}</span>
            </button>
          ))}

          {arcMenu && (
            <div
              className={[
                'node-arc-menu',
                arcMenu.x > 78 ? 'is-edge-right' : '',
                arcMenu.x < 18 ? 'is-edge-left' : '',
                arcMenu.y < 18 ? 'is-edge-top' : '',
                arcMenu.y > 82 ? 'is-edge-bottom' : '',
              ].filter(Boolean).join(' ')}
              style={{ left: `${arcMenu.x}%`, top: `${arcMenu.y}%` }}
              role="menu"
              aria-label="Node quick actions"
            >
              <button type="button" role="menuitem" aria-label="Create linked idea" title="Idea" onClick={() => createLinkedNodeFromArc('idea')}>
                <Lightbulb size={13} />
              </button>
              <button type="button" role="menuitem" aria-label="Create linked image placeholder" title="Image" onClick={() => createLinkedNodeFromArc('placeholder')}>
                <ImagePlus size={13} />
              </button>
              <button type="button" role="menuitem" aria-label="Create linked palette" title="Palette" onClick={() => createLinkedNodeFromArc('palette')}>
                <CircleDot size={13} />
              </button>
              <button type="button" role="menuitem" aria-label="Create linked diagram" title="Diagram" onClick={() => createLinkedNodeFromArc('diagram')}>
                <FileText size={13} />
              </button>
              <button type="button" role="menuitem" aria-label="Create AI node" title="AI node" onClick={openAiNodeDraftFromArc}>
                <Bot size={13} />
              </button>
              <button type="button" role="menuitem" aria-label="Begin link from node" title="Link" onClick={() => beginLinkFromArc(arcMenu)}>
                <Link2 size={13} />
              </button>
            </div>
          )}
        </div>

        {aiNodeDraft && (
          <div className="ai-node-panel" role="dialog" aria-label="Create AI node">
            <header>
              <span><Bot size={14} /> AI node</span>
              <button type="button" className="icon-button" aria-label="Close AI node panel" onClick={() => setAiNodeDraft(null)}>
                <X size={13} />
              </button>
            </header>
            <label>
              Action
              <select
                value={aiNodeDraft.action}
                onChange={(event) => {
                  const action = event.target.value as AiNodeAction
                  setAiNodeDraft((current) => current ? { ...current, action, prompt: aiNodeActionPrompts[action] } : current)
                }}
              >
                {(Object.keys(aiNodeActionLabels) as AiNodeAction[]).map((action) => (
                  <option key={action} value={action}>{aiNodeActionLabels[action]}</option>
                ))}
              </select>
            </label>
            <label>
              Scope
              <select
                value={aiNodeDraft.scope}
                onChange={(event) => setAiNodeDraft((current) => current ? { ...current, scope: event.target.value as AiNodeScope } : current)}
              >
                {(Object.keys(aiNodeScopeLabels) as AiNodeScope[]).map((scope) => (
                  <option key={scope} value={scope}>{aiNodeScopeLabels[scope]}</option>
                ))}
              </select>
            </label>
            <label>
              Prompt
              <textarea
                rows={4}
                value={aiNodeDraft.prompt}
                onChange={(event) => setAiNodeDraft((current) => current ? { ...current, prompt: event.target.value } : current)}
              />
            </label>
            <button type="button" className="primary-button" onClick={submitAiNodeDraft}>
              <Sparkles size={14} />
              Create AI node
            </button>
          </div>
        )}

        {nodeContextMenu && (
          <div
            className="node-context-menu"
            style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
            role="menu"
            aria-label="Selected node actions"
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="node-context-heading">
              <strong>{nodeContextMenu.nodes.length} selected</strong>
              <span>{nodeContextMenu.nodes.map((node) => graphNodeKindLabel(node.kind)).join(', ')}</span>
            </div>
            <button type="button" role="menuitem" onClick={() => applyContextImportance(0.25)}>
              <ZoomIn size={13} />
              Increase importance
            </button>
            <button type="button" role="menuitem" onClick={() => applyContextImportance(-0.25)}>
              <ZoomOut size={13} />
              Decrease importance
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={nodeContextMenu.nodes.length !== 2}
              onClick={linkContextNodes}
            >
              <Link2 size={13} />
              Link selected
            </button>
            <button type="button" role="menuitem" onClick={clearMultiSelect}>
              <X size={13} />
              Clear selection
            </button>
            <button type="button" role="menuitem" className="is-danger" onClick={deleteContextNodes}>
              <X size={13} />
              Delete selected
            </button>
          </div>
        )}

        <div className="canvas-secondary-rail" aria-label="Canvas view tools">
          <div className="graph-zoom" aria-label="Canvas zoom">
            <button type="button" aria-label="Zoom out" onClick={() => updateZoom(-0.15)}>
              <ZoomOut size={13} />
            </button>
            <span>{Math.round(graphTransform.scale * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => updateZoom(0.15)}>
              <ZoomIn size={13} />
            </button>
            <button type="button" aria-label="Reset canvas view" onClick={resetGraphView}>
              <LocateFixed size={13} />
            </button>
          </div>

          <div className="graph-status">
            <CircleDot size={13} />
            <span>
              {activeCanvasTool === 'link'
                ? pendingLinkSource ? 'Select link target' : 'Select link source'
                : `${graphMetrics.visibleNodes}/${graphMetrics.totalNodes}`}
            </span>
            <div className="graph-mode-toggle" aria-label="Canvas mode">
              {Object.keys(graphModeLabels).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={graphMode === mode}
                  className={graphMode === mode ? 'is-active' : ''}
                  type="button"
                  onClick={() => setGraphMode(mode as GraphMode)}
                >
                  {graphModeLabels[mode as GraphMode]}
                </button>
              ))}
            </div>
            <button
              aria-expanded={isGraphToolsOpen}
              aria-label="Canvas tools"
              className={isGraphToolsOpen ? 'icon-button is-active' : 'icon-button'}
              data-menu-trigger="graph-tools"
              type="button"
              onClick={() => setIsGraphToolsOpen((current) => !current)}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {isGraphToolsOpen && (
          <div className="graph-tools-drawer">
            <label>
              <span>Cap</span>
              <select
                aria-label="Canvas node cap"
                value={graphCap}
                onChange={(event) => setGraphCap(Number(event.target.value) as GraphCap)}
              >
                {Object.keys(graphCapLabels).map((cap) => (
                  <option key={cap} value={cap}>
                    {graphCapLabels[Number(cap) as GraphCap]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Scope</span>
              <select
                aria-label="Canvas scope"
                value={graphScope}
                onChange={(event) => setGraphScope(event.target.value as GraphScope)}
              >
                {Object.keys(graphScopeLabels).map((scope) => (
                  <option key={scope} value={scope}>
                    {graphScopeLabels[scope as GraphScope]}
                  </option>
                ))}
              </select>
            </label>
            {graphMode === 'discover' && (
              <label>
                <span>Support</span>
                <select
                  aria-label="Support filter"
                  value={discoveryFilter}
                  onChange={(event) => setDiscoveryFilter(event.target.value as DiscoveryFilter)}
                >
                  {Object.keys(discoveryFilterLabels).map((filter) => (
                    <option key={filter} value={filter}>
                      {discoveryFilterLabels[filter as DiscoveryFilter]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>Relations</span>
              <select
                aria-label="Relation filter"
                value={relationFilter}
                onChange={(event) => setRelationFilter(event.target.value as RelationFilter)}
              >
                <option value="all">All</option>
                {Object.keys(relationLabels).map((relation) => (
                  <option key={relation} value={relation}>
                    {relationLabels[relation as Relation]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Link</span>
              <select
                aria-label="Link relation"
                value={linkCreationRelation}
                onChange={(event) => onLinkCreationRelationChange(event.target.value as Relation)}
              >
                {Object.keys(relationLabels).map((relation) => (
                  <option key={relation} value={relation}>
                    {relationLabels[relation as Relation]}
                  </option>
                ))}
              </select>
            </label>
            <label className="graph-tools-wide">
              <span>Organize</span>
              <div className="graph-organize-row">
                <select
                  aria-label="Canvas organize mode"
                  value={organizeMode}
                  onChange={(event) => setOrganizeMode(event.target.value as GraphOrganizeMode)}
                >
                  {Object.keys(graphOrganizeLabels).map((mode) => (
                    <option key={mode} value={mode}>
                      {graphOrganizeLabels[mode as GraphOrganizeMode]}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => onOrganize(organizeMode)}>
                  Apply
                </button>
              </div>
            </label>
            <details className="graph-shortcuts graph-tools-wide">
              <summary>Shortcuts</summary>
              <dl>
                <div><dt>L</dt><dd>Create link</dd></div>
                <div><dt>Cmd/Ctrl N</dt><dd>New idea</dd></div>
                <div><dt>Cmd/Ctrl D</dt><dd>Duplicate node</dd></div>
                <div><dt>Delete</dt><dd>Delete selected</dd></div>
                <div><dt>Cmd/Ctrl +/-/0</dt><dd>Zoom</dd></div>
              </dl>
            </details>
          </div>
        )}

      </div>
    </section>
  )
}

function Graph3DView({
  ideas,
  images,
  palettes,
  diagrams,
  placeholders,
  links,
  selected,
  onSelect,
}: {
  ideas: Idea[]
  images: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  placeholders: PlaceholderNode[]
  links: EvidenceLink[]
  selected: Selection
  onSelect: (selection: Selection) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)
  const threeRef = useRef<any>(null)
  const selectedRef = useRef(selected)
  const [relationFilter3D, setRelationFilter3D] = useState<RelationFilter>('all')
  const [graphScope3D, setGraphScope3D] = useState<GraphScope>('all')
  const graphData = useMemo(
    () => build3DGraphData(ideas, images, links, palettes, diagrams, placeholders),
    [diagrams, ideas, images, links, palettes, placeholders],
  )
  const relationGraphData = useMemo(
    () => filter3DGraphDataByRelation(graphData, relationFilter3D),
    [graphData, relationFilter3D],
  )
  const filteredGraphData = useMemo(
    () => filter3DGraphDataByScope(relationGraphData, graphScope3D, selected),
    [relationGraphData, graphScope3D, selected],
  )
  const visibleRelations = useMemo(() => get3DRelationLegend(graphData.links), [graphData.links])
  const selectedLabel = useMemo(() => {
    if (selected.type === 'project') return 'File'
    if (selected.type === 'idea') return ideas.find((idea) => idea.id === selected.id)?.title
    if (selected.type === 'image') return images.find((image) => image.id === selected.id)?.title
    if (selected.type === 'palette') return palettes.find((palette) => palette.id === selected.id)?.title
    if (selected.type === 'diagram') return diagrams.find((diagram) => diagram.id === selected.id)?.title
    if (selected.type === 'placeholder') return placeholders.find((placeholder) => placeholder.id === selected.id)?.title
    return links.find((link) => link.id === selected.id)?.relation
  }, [diagrams, ideas, images, links, palettes, placeholders, selected])

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    let canceled = false
    let cleanupResize: (() => void) | null = null

    Promise.all([import('3d-force-graph'), import('three')]).then(([{ default: ForceGraph3D }, THREE]) => {
      if (canceled || !hostRef.current) return
      const host = hostRef.current
      const createForceGraph = ForceGraph3D as unknown as (options?: Record<string, unknown>) => any
      threeRef.current = THREE
      const graph = createForceGraph({
        rendererConfig: { alpha: true, antialias: true, preserveDrawingBuffer: true },
      })(host)
      graphRef.current = graph
      graph.renderer?.().setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 2.5))
      if (graph.renderer?.().outputColorSpace !== undefined) graph.renderer().outputColorSpace = THREE.SRGBColorSpace
      const controls = graph.controls?.()
      if (controls) {
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.zoomSpeed = 0.72
        controls.rotateSpeed = 0.62
      }

      function resize() {
        if (!hostRef.current) return
        graph.width(hostRef.current.clientWidth)
        graph.height(hostRef.current.clientHeight)
      }

      graph
        .backgroundColor(cssTokenColor('--bg-canvas', '#0d0f0e'))
        .nodeLabel((node: any) => node.name)
        .nodeRelSize(4)
        .nodeOpacity(0.92)
        .nodeThreeObject((node: any) => createGraph3DNodeObject(THREE, node, is3DNodeSelected(selectedRef.current, node.id)))
        .linkOpacity(0.34)
        .cooldownTicks(90)
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.003)
        .onNodeClick((node: any) => {
          onSelect({ type: node.kind, id: node.id } as Selection)
          window.requestAnimationFrame(() => focus3DNode(graph, node))
        })
        .linkLabel((link: any) => link.relation)
        .onLinkClick((link: any) => {
          if (typeof link.id === 'string') onSelect({ type: 'link', id: link.id })
        })

      resize()
      window.addEventListener('resize', resize)
      cleanupResize = () => window.removeEventListener('resize', resize)
      graph.graphData(clone3DGraphData(filteredGraphData))
      graph.cameraPosition({ x: 0, y: 0, z: 360 })
    })

    return () => {
      canceled = true
      cleanupResize?.()
      graphRef.current?._destructor?.()
      graphRef.current = null
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
  }, [])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    graph.graphData(clone3DGraphData(filteredGraphData))
  }, [filteredGraphData])

  useEffect(() => {
    const graph = graphRef.current
    const THREE = threeRef.current
    if (!graph || !THREE) return
    graph
      .nodeThreeObject((node: any) => createGraph3DNodeObject(THREE, node, is3DNodeSelected(selected, node.id)))
      .nodeColor((node: any) => (is3DNodeSelected(selected, node.id) ? cssTokenColor('--text-main', '#d9fff6') : node.color))
      .linkColor((link: any) => (selected.type === 'link' && selected.id === link.id ? cssTokenColor('--accent-amber', '#dfae67') : link.color))
  }, [selected])

  function reset3DView() {
    const graph = graphRef.current
    if (!graph) return
    graph.cameraPosition({ x: 0, y: 0, z: 360 }, { x: 0, y: 0, z: 0 }, 650)
  }

  function focusSelectedIn3D() {
    const graph = graphRef.current
    if (!graph || !isNodeSelection(selected)) return
    focus3DSelection(graph, selected.id)
  }

  return (
    <section className="graph3d-shell">
      <div
        className="graph3d-stage"
        ref={hostRef}
        data-node-count={filteredGraphData.nodes.length}
        data-link-count={filteredGraphData.links.length}
        data-relation-filter={relationFilter3D}
        data-graph-scope={graphScope3D}
      />
      <div className="graph3d-hud">
        <span>3D</span>
        <strong>{filteredGraphData.nodes.length}/{graphData.nodes.length}</strong>
        <small>{filteredGraphData.links.length}/{graphData.links.length} links</small>
        {selectedLabel && <em>{selectedLabel}</em>}
        <button type="button" aria-label="Focus selected in 3D" disabled={!isNodeSelection(selected)} onClick={focusSelectedIn3D}>
          <LocateFixed size={13} />
        </button>
        <button type="button" aria-label="Reset 3D camera" onClick={reset3DView}>
          <ZoomOut size={13} />
        </button>
      </div>
      <div className="graph3d-scope" aria-label="3D graph scope">
        {(Object.keys(graphScopeLabels) as GraphScope[]).map((scope) => (
          <button
            key={scope}
            className={graphScope3D === scope ? 'is-active' : ''}
            type="button"
            aria-pressed={graphScope3D === scope}
            onClick={() => setGraphScope3D(scope)}
          >
            {graphScopeLabels[scope]}
          </button>
        ))}
      </div>
      <div className="graph3d-legend" aria-label="3D relation legend">
        <button
          className={relationFilter3D === 'all' ? 'is-active' : ''}
          type="button"
          aria-pressed={relationFilter3D === 'all'}
          onClick={() => setRelationFilter3D('all')}
        >
          <i />
          <span>All</span>
          <small>{graphData.links.length}</small>
        </button>
        {visibleRelations.map((relation) => (
          <button
            key={relation.relation}
            className={relationFilter3D === relation.relation ? 'is-active' : ''}
            type="button"
            aria-pressed={relationFilter3D === relation.relation}
            onClick={() => setRelationFilter3D((current) => (current === relation.relation ? 'all' : relation.relation))}
          >
            <i style={{ background: relation.color }} />
            <span>{relationLabels[relation.relation]}</span>
            <small>{relation.count}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function SlideCustomizer({
  slides,
  deckSlides,
  customizations,
  onSetCustomization,
  onMove,
  onResetOrder,
  hasManualOrder,
}: {
  slides: SlideLayout[]
  deckSlides: SlideLayout[]
  customizations: Record<string, SlideCustomization>
  onSetCustomization: (slideId: string, patch: Partial<SlideCustomization>) => void
  onMove: (slideId: string, direction: -1 | 1) => void
  onResetOrder: () => void
  hasManualOrder: boolean
}) {
  const deckOrder = new Map(deckSlides.map((slide, index) => [slide.id, index]))
  const ordered = [...slides].sort((a, b) => {
    const ai = deckOrder.has(a.id) ? (deckOrder.get(a.id) as number) : Number.MAX_SAFE_INTEGER
    const bi = deckOrder.has(b.id) ? (deckOrder.get(b.id) as number) : Number.MAX_SAFE_INTEGER
    return ai - bi
  })
  const visibleCount = ordered.filter((slide) => customizations[slide.id]?.hidden !== true).length

  return (
    <div className="slide-customizer" aria-label="Customize slides">
      <div className="slide-customizer-head">
        <strong>Customize deck</strong>
        <span>{visibleCount}/{ordered.length} shown</span>
        {hasManualOrder && (
          <button type="button" className="slide-customizer-reset" onClick={onResetOrder}>
            Reset order
          </button>
        )}
      </div>
      <div className="slide-customizer-list">
        {ordered.map((slide, index) => {
          const custom = customizations[slide.id] ?? {}
          const hidden = custom.hidden === true
          return (
            <div key={slide.id} className={hidden ? 'slide-customizer-row is-hidden' : 'slide-customizer-row'}>
              <span className="slide-customizer-index" style={{ background: slide.accent }} aria-hidden="true" />
              <strong title={slide.title}>{slide.title}</strong>
              <select
                aria-label={`Layout for ${slide.title}`}
                value={custom.layoutOverride ?? 'auto'}
                disabled={hidden || slide.kind !== 'concept'}
                onChange={(event) => {
                  const value = event.target.value
                  onSetCustomization(slide.id, { layoutOverride: value === 'auto' ? undefined : (value as SlideLayoutChoice) })
                }}
              >
                <option value="auto">Auto</option>
                <option value="focus">Focus</option>
                <option value="grid">Grid</option>
                <option value="stack">Stack</option>
                <option value="palette">Palette</option>
                <option value="diagram">Diagram</option>
                <option value="moodboard">Moodboard</option>
              </select>
              <button type="button" aria-label="Move earlier" disabled={hidden || index === 0} onClick={() => onMove(slide.id, -1)}>
                <ChevronLeft size={13} />
              </button>
              <button type="button" aria-label="Move later" disabled={hidden || index === ordered.length - 1} onClick={() => onMove(slide.id, 1)}>
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                aria-label={hidden ? 'Show slide' : 'Hide slide'}
                aria-pressed={hidden}
                onClick={() => onSetCustomization(slide.id, { hidden: hidden ? undefined : true })}
              >
                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlideshowView({
  ideas,
  images,
  palettes,
  diagrams,
  links,
  selected,
  slidesConfig,
  onSlidesConfigChange,
  onExportHtml,
  onExportPptx,
  onExportPdf,
  onExportGoogleSlides,
  onExportCanva,
  onSelect,
}: {
  ideas: Idea[]
  images: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  links: EvidenceLink[]
  selected: Selection
  status: string
  slidesConfig: SlidesConfig
  onSlidesConfigChange: (patch: Partial<SlidesConfig>) => void
  onExportHtml: (layoutMode?: SlideLayoutMode) => void
  onExportPptx: (layoutMode?: SlideLayoutMode) => void
  onExportPdf: (layoutMode?: SlideLayoutMode) => void
  onExportGoogleSlides: (layoutMode?: SlideLayoutMode) => void
  onExportCanva: (layoutMode?: SlideLayoutMode) => void
  onSelect: (selection: Selection) => void
}) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPresenting, setIsPresenting] = useState(false)
  const [layoutMode, setLayoutMode] = useState<SlideLayoutMode>('auto')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [isCustomizing, setIsCustomizing] = useState(false)

  const baseSlides = useMemo(() => buildSlideLayouts(ideas, images, links, palettes, diagrams), [diagrams, ideas, images, links, palettes])
  // Slides with deck-wide layout mode + per-slide overrides, but NOT filtered/reordered; used by the customization editor.
  const allSlides = useMemo(() => {
    const moded = applySlideLayoutMode(baseSlides, layoutMode)
    return applySlidesConfig(moded, { ...slidesConfig, customizations: stripHidden(slidesConfig.customizations), order: [] })
  }, [baseSlides, layoutMode, slidesConfig])
  // Final deck: overrides + hide + reorder applied.
  const slides = useMemo(
    () => applySlidesConfig(applySlideLayoutMode(baseSlides, layoutMode), slidesConfig),
    [baseSlides, layoutMode, slidesConfig],
  )
  const deckMeta = useMemo(() => applyDeckTemplate(buildSlideDeckMeta(slides), slidesConfig.template), [slides, slidesConfig.template])
  const selectedSlideIndex = slides.findIndex((slide) => selected.type === 'idea' && slide.idea?.id === selected.id)
  const activeIndex = Math.min(activeSlideIndex, Math.max(0, slides.length - 1))
  const activeSlide = slides[activeIndex]

  function setCustomization(slideId: string, patch: Partial<SlideCustomization>) {
    const current = slidesConfig.customizations[slideId] ?? {}
    const merged: SlideCustomization = { ...current, ...patch }
    // Drop keys set back to undefined to keep config lean.
    ;(Object.keys(merged) as Array<keyof SlideCustomization>).forEach((key) => {
      if (merged[key] === undefined) delete merged[key]
    })
    const nextCustomizations = { ...slidesConfig.customizations }
    if (Object.keys(merged).length === 0) {
      delete nextCustomizations[slideId]
    } else {
      nextCustomizations[slideId] = merged
    }
    onSlidesConfigChange({ customizations: nextCustomizations })
  }

  function moveSlide(slideId: string, direction: -1 | 1) {
    const currentOrder = slidesConfig.order.length > 0 ? [...slidesConfig.order] : slides.map((slide) => slide.id)
    const from = currentOrder.indexOf(slideId)
    if (from < 0) return
    const to = from + direction
    if (to < 0 || to >= currentOrder.length) return
    ;[currentOrder[from], currentOrder[to]] = [currentOrder[to], currentOrder[from]]
    onSlidesConfigChange({ order: currentOrder })
  }

  function goToSlide(index: number) {
    if (slides.length === 0) return
    const nextIndex = (index + slides.length) % slides.length
    setActiveSlideIndex(nextIndex)
    if (slides[nextIndex].idea) onSelect({ type: 'idea', id: slides[nextIndex].idea.id })
  }

  useEffect(() => {
    if (slides[activeSlideIndex]?.kind !== 'concept') return
    if (selected.type === 'idea' && selectedSlideIndex >= 0) setActiveSlideIndex(selectedSlideIndex)
  }, [activeSlideIndex, selected.type, selectedSlideIndex, slides])

  useEffect(() => {
    if (!isPlaying || slides.length < 2) return
    const timer = window.setInterval(() => {
      setActiveSlideIndex((current) => {
        const nextIndex = (current + 1) % slides.length
        if (slides[nextIndex].idea) onSelect({ type: 'idea', id: slides[nextIndex].idea.id })
        return nextIndex
      })
    }, 4200)

    return () => window.clearInterval(timer)
  }, [isPlaying, onSelect, slides])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target instanceof HTMLElement && target.matches('input, textarea, select')) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToSlide(activeIndex - 1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToSlide(activeIndex + 1)
      }
      if (event.key === ' ') {
        event.preventDefault()
        setIsPlaying((current) => !current)
      }
      if (event.key === 'Escape') {
        setIsPresenting(false)
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [activeIndex, slides])

  useEffect(() => {
    if (!isTauriRuntime()) return
    void getCurrentWindow().setFullscreen(isPresenting).catch(() => undefined)
  }, [isPresenting])

  if (!activeSlide) {
    return (
      <section className="slideshow-shell">
        <div className="outline-empty">
          <strong>No slides</strong>
          <span>Create an idea to generate a slide layout.</span>
        </div>
      </section>
    )
  }

  return (
    <section
      className="slideshow-shell"
      data-slide-layout={activeSlide.layout}
      data-slide-layout-mode={layoutMode}
      data-slide-layout-reason={activeSlide.layoutReason}
      data-deck-template={deckMeta.template}
      data-estimated-duration={deckMeta.estimatedDuration}
      data-presenting={isPresenting}
    >
      <div className="slideshow-rail" aria-label="Slides">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            className={index === activeIndex ? 'is-active' : ''}
            type="button"
            onClick={() => goToSlide(index)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{slide.title}</strong>
          </button>
        ))}
      </div>
      <article className={`slide-canvas slide-canvas--${activeSlide.layout}`}>
        <div className="slideshow-controls" aria-label="Slideshow controls">
          <button type="button" aria-label="Previous slide" onClick={() => goToSlide(activeIndex - 1)}>
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
            aria-pressed={isPlaying}
            onClick={() => setIsPlaying((current) => !current)}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button type="button" aria-label="Next slide" onClick={() => goToSlide(activeIndex + 1)}>
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            aria-label={isPresenting ? 'Exit presenter mode' : 'Enter presenter mode'}
            aria-pressed={isPresenting}
            onClick={() => setIsPresenting((current) => !current)}
          >
            {isPresenting ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <span>{activeIndex + 1}/{slides.length}</span>
          <select
            aria-label="Deck template"
            value={slidesConfig.template}
            onChange={(event) => onSlidesConfigChange({ template: event.target.value as SlidesConfig['template'] })}
          >
            <option value="auto">Auto template</option>
            <option value="Minimal">Minimal</option>
            <option value="Editorial">Editorial</option>
            <option value="Moodboard Grid">Moodboard Grid</option>
            <option value="Timeline">Timeline</option>
          </select>
          <select
            aria-label="Slide layout mode"
            value={layoutMode}
            onChange={(event) => setLayoutMode(event.target.value as SlideLayoutMode)}
          >
            <option value="auto">Auto layout</option>
            <option value="focus">Focus</option>
            <option value="grid">Grid</option>
            <option value="stack">Stack</option>
            <option value="palette">Palette</option>
            <option value="diagram">Diagram</option>
          </select>
          <button
            type="button"
            aria-label="Customize slides"
            aria-pressed={isCustomizing}
            className={isCustomizing ? 'is-active' : ''}
            onClick={() => setIsCustomizing((current) => !current)}
          >
            <Settings size={14} />
          </button>
          <div className={exportMenuOpen ? 'slide-export-menu is-open' : 'slide-export-menu'}>
            <button type="button" aria-label="Export slides" aria-haspopup="menu" aria-expanded={exportMenuOpen} onClick={() => setExportMenuOpen((current) => !current)}>
              <ArrowDownToLine size={14} />
            </button>
            {exportMenuOpen && (
              <>
                <div className="slide-export-backdrop" onClick={() => setExportMenuOpen(false)} aria-hidden="true" />
                <div className="slide-export-popover" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); onExportPptx(layoutMode) }}>
                    <FileText size={14} />
                    <span><strong>PowerPoint</strong><small>.pptx, opens in PowerPoint, Keynote</small></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); onExportPdf(layoutMode) }}>
                    <FileText size={14} />
                    <span><strong>PDF</strong><small>Print-ready, one page per slide</small></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); onExportHtml(layoutMode) }}>
                    <FileText size={14} />
                    <span><strong>HTML</strong><small>Self-contained interactive deck</small></span>
                  </button>
                  <div className="slide-export-divider" role="separator" />
                  <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); onExportGoogleSlides(layoutMode) }}>
                    <ExternalLink size={14} />
                    <span><strong>Google Slides</strong><small>Export .pptx then import</small></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); onExportCanva(layoutMode) }}>
                    <ExternalLink size={14} />
                    <span><strong>Canva</strong><small>Export .pptx then upload</small></span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {isCustomizing && (
          <SlideCustomizer
            slides={allSlides}
            deckSlides={slides}
            customizations={slidesConfig.customizations}
            onSetCustomization={setCustomization}
            onMove={moveSlide}
            onResetOrder={() => onSlidesConfigChange({ order: [] })}
            hasManualOrder={slidesConfig.order.length > 0}
          />
        )}
        <div className="slide-copy">
          <span style={{ color: activeSlide.accent }}>{activeSlide.kicker}</span>
          <h2>{activeSlide.title}</h2>
          <p>{activeSlide.summary}</p>
        </div>
        <div className="slide-reference-layout">
          {activeSlide.layout === 'cover' ? (
            <div className="slide-cover-visuals">
              {activeSlide.references[0] ? (
                <button type="button" className="slide-cover-hero" onClick={() => onSelect({ type: 'image', id: activeSlide.references[0].id })}>
                  <ReferenceThumb image={activeSlide.references[0]} />
                  <span>{activeSlide.references[0].title}</span>
                </button>
              ) : (
                <div className="missing-support">Needs hero reference</div>
              )}
              {activeSlide.palettes[0] && (
                <button type="button" className="slide-palette" onClick={() => onSelect({ type: 'palette', id: activeSlide.palettes[0].id })}>
                  <span>
                    {activeSlide.palettes[0].colors.map((color, index) => <i key={`cover-${index}-${color}`} style={{ background: color }} />)}
                  </span>
                  <strong>{activeSlide.palettes[0].title}</strong>
                </button>
              )}
            </div>
          ) : activeSlide.layout === 'moodboard' ? (
            <div className="slide-moodboard-grid">
              {activeSlide.references.slice(0, 12).map((image, index) => (
                <button
                  key={image.id}
                  className="slide-reference"
                  type="button"
                  style={{ '--i': index } as React.CSSProperties}
                  onClick={() => onSelect({ type: 'image', id: image.id })}
                >
                  <ReferenceThumb image={image} />
                  <span>{image.title}</span>
                </button>
              ))}
            </div>
          ) : activeSlide.layout === 'palette' && activeSlide.palettes.length > 0 ? (
            <div className="slide-palette-layout">
              {activeSlide.palettes.slice(0, 3).map((palette) => (
                <button key={palette.id} type="button" className="slide-palette" onClick={() => onSelect({ type: 'palette', id: palette.id })}>
                  <span>
                    {palette.colors.map((color, index) => <i key={`${palette.id}-${index}-${color}`} style={{ background: color }} />)}
                  </span>
                  <strong>{palette.title}</strong>
                </button>
              ))}
            </div>
          ) : activeSlide.layout === 'diagram' && activeSlide.diagrams.length > 0 ? (
            <div className="slide-diagram-layout">
              {activeSlide.diagrams.slice(0, 2).map((diagram) => (
                <button key={diagram.id} type="button" className="slide-diagram" onClick={() => onSelect({ type: 'diagram', id: diagram.id })}>
                  <FileText size={24} />
                  <strong>{diagram.title}</strong>
                  <span>{diagram.nodeIds.length} nodes</span>
                </button>
              ))}
            </div>
          ) : activeSlide.references.length > 0 ? activeSlide.references.map((image, index) => (
            <button
              key={image.id}
              className="slide-reference"
              type="button"
              style={{ '--i': index } as React.CSSProperties}
              onClick={() => onSelect({ type: 'image', id: image.id })}
            >
              <ReferenceThumb image={image} />
              <span>{image.title}</span>
            </button>
          )) : (
            <div className="missing-support">Needs references</div>
          )}
        </div>
      </article>
    </section>
  )
}

type OutlineSection = {
  id: string
  idea: Idea
  title: string
  summary: string
  references: EvidenceImage[]
  strength: 'strong' | 'forming' | 'thin'
}

type ProjectDiagnostic = {
  id: string
  label: string
  meta: string
  severity: 'warning' | 'danger' | 'info'
  selection: Selection
}

function OutlineView({
  draft,
  diagnostics,
  status,
  sections,
  onExportHtml,
  onExportMarkdown,
  onRebuild,
  onSelectDiagnostic,
  onSelectIdea,
  onSelectImage,
}: {
  draft?: OutlineDraft
  diagnostics: ProjectDiagnostic[]
  status: string
  sections: OutlineSection[]
  onExportHtml: () => void
  onExportMarkdown: () => void
  onRebuild: () => void
  onSelectDiagnostic: (selection: Selection) => void
  onSelectIdea: (id: string) => void
  onSelectImage: (id: string) => void
}) {
  const [outlineFilter, setOutlineFilter] = useState<OutlineFilter>('all')
  const filteredSections = useMemo(() => {
    if (outlineFilter === 'strong') {
      return sections.filter((section) => section.strength === 'strong')
    }
    if (outlineFilter === 'weak') {
      return sections.filter((section) => section.strength !== 'strong')
    }
    return sections
  }, [outlineFilter, sections])
  const strongCount = sections.filter((section) => section.strength === 'strong').length
  const weakCount = sections.length - strongCount

  return (
    <section className="outline-shell">
      <div className="outline-head">
        <div className="outline-titlebar">
          <span>Outline</span>
          <small>{draft ? formatDraftTime(draft.createdAt) : 'Unsaved draft'} · {sections.length} sections · {strongCount} strong · {weakCount} needs work</small>
        </div>
        <div className="outline-tools">
          <div className="outline-filter" aria-label="Outline filter">
            {Object.keys(outlineFilterLabels).map((filter) => (
              <button
                key={filter}
                aria-pressed={outlineFilter === filter}
                className={outlineFilter === filter ? 'is-active' : ''}
                type="button"
                onClick={() => setOutlineFilter(filter as OutlineFilter)}
              >
                {outlineFilterLabels[filter as OutlineFilter]}
              </button>
            ))}
          </div>
          <button className="quiet-button" type="button" onClick={onRebuild}>
            <Bot size={14} />
            Rebuild
          </button>
          <button className="quiet-button" type="button" onClick={onExportMarkdown}>
            <ArrowDownToLine size={14} />
            Markdown
          </button>
          <button className="quiet-button" type="button" onClick={onExportHtml}>
            <ArrowDownToLine size={14} />
            HTML
          </button>
        </div>
      </div>
      <div className="outline-status" role="status">{status}</div>
      <ProjectDiagnostics diagnostics={diagnostics} onSelect={onSelectDiagnostic} />
      <div className="outline-list">
        {filteredSections.length === 0 ? (
          <div className="outline-empty">
            <strong>No matching sections</strong>
            <button type="button" onClick={() => setOutlineFilter('all')}>
              Show all
            </button>
          </div>
        ) : filteredSections.map((section, index) => (
          <article className="outline-section" key={section.id}>
            <button className="outline-title" type="button" onClick={() => onSelectIdea(section.idea.id)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{section.title}</strong>
              <small>{section.references.length} refs</small>
              <i className={`outline-strength outline-strength--${section.strength}`} />
            </button>
            <p>{section.summary}</p>
            <div className="outline-references">
              {section.references.length > 0 ? (
                <LinkedList
                  count={section.references.length}
                  emptyLabel="Needs references"
                  limit={outlineReferenceLimit}
                  renderItems={(limit) => section.references.slice(0, limit).map((image) => (
                  <button key={image.id} type="button" onClick={() => onSelectImage(image.id)}>
                    <ReferenceThumb image={image} />
                    <span>{image.title}</span>
                  </button>
                  ))}
                />
              ) : (
                <span className="missing-support">Needs references</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProjectDiagnostics({
  diagnostics,
  onSelect,
}: {
  diagnostics: ProjectDiagnostic[]
  onSelect: (selection: Selection) => void
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="diagnostics-row" aria-label="Project diagnostics">
        <span className="diagnostics-clear">Ready for review</span>
      </div>
    )
  }

  const dangerCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'danger').length
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
  const visibleDiagnostics = diagnostics.slice(0, 4)

  return (
    <div className="diagnostics-row" aria-label="Project diagnostics">
      <span className="diagnostics-summary">
        {diagnostics.length} issue{diagnostics.length === 1 ? '' : 's'}
        {dangerCount > 0 ? ` · ${dangerCount} missing` : ''}
        {warningCount > 0 ? ` · ${warningCount} weak` : ''}
      </span>
      <div className="diagnostics-list">
        {visibleDiagnostics.map((diagnostic) => (
          <button
            key={diagnostic.id}
            className={`diagnostic-chip diagnostic-chip--${diagnostic.severity}`}
            type="button"
            onClick={() => onSelect(diagnostic.selection)}
          >
            <span>{diagnostic.label}</span>
            <small>{diagnostic.meta}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

function ReferenceThumb({ image, className = '' }: { image: Pick<EvidenceImage, 'thumb' | 'title'>; className?: string }) {
  const [isMissing, setIsMissing] = useState(false)
  const classes = ['reference-thumb', className, isMissing ? 'is-missing' : ''].filter(Boolean).join(' ')

  return (
    <span className={classes} aria-label={isMissing ? `${image.title} missing` : undefined}>
      {isMissing ? (
        <ImagePlus size={16} aria-hidden="true" />
      ) : (
        <img src={image.thumb} alt="" draggable={false} onError={() => setIsMissing(true)} />
      )}
    </span>
  )
}

function Inspector({
  isCollapsed,
  selected,
  ideas,
  images,
  palettes,
  diagrams,
  placeholders,
  links,
  nodeVersions,
  linkCreationRelation,
  localModelAvailable,
  modelRunningImageId,
  modelStatusByImageId,
  ideaTitleFocusId,
  selectedReferenceCount,
  onToggleCollapsed,
  onSelect,
  onAcceptSuggestion,
  onRejectSuggestion,
  onRelationChange,
  onIdeaChange,
  onImageChange,
  onLinkChange,
  onLinkSwap,
  onPaletteChange,
  onDiagramChange,
  onPlaceholderChange,
  onProjectMetadataChange,
  onProjectAppearanceChange,
  onPaletteColorChange,
  onPaletteColorAdd,
  onPaletteColorRemove,
  onPaletteRegenerate,
  onLinkCreationRelationChange,
  onReferenceTagAdd,
  onReferenceTagRemove,
  onReferenceOcr,
  onReferenceTagRefine,
  onReferenceReplace,
  onReferenceReplaceFromImage,
  onDroppedReference,
  onPlaceholderAttach,
  onReferenceFindSimilar,
  onReferenceConvertToPalette,
  onIdeaTitleFocused,
  onIdeaDelete,
  onImageDelete,
  onPaletteDelete,
  onDiagramDelete,
  onPlaceholderDelete,
  onLinkSelectedReferences,
  onLinkDelete,
  onNodeVersionRestore,
  onBeginLinkFromNode,
  onDuplicateSelection,
  onOpenOutline,
  onRebuildOutline,
  onToggleFloating,
  ocrRunningImageId,
  ocrStatusByImageId,
}: {
  isCollapsed: boolean
  selected: ReturnType<typeof resolveSelection>
  ideas: Idea[]
  images: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  placeholders: PlaceholderNode[]
  links: EvidenceLink[]
  nodeVersions: NodeVersionRecord[]
  linkCreationRelation: Relation
  localModelAvailable: boolean
  modelRunningImageId: string | null
  modelStatusByImageId: Record<string, string>
  ideaTitleFocusId: string | null
  ocrRunningImageId: string | null
  ocrStatusByImageId: Record<string, string>
  selectedReferenceCount: number
  onToggleCollapsed: () => void
  onSelect: (selection: Selection) => void
  onAcceptSuggestion: (imageId: string, tag: string) => void
  onRejectSuggestion: (imageId: string, tag: string) => void
  onRelationChange: (linkId: string, relation: Relation) => void
  onIdeaChange: (ideaId: string, patch: Partial<Pick<Idea, 'title' | 'body' | 'sourceUrl' | 'notes'>>) => void
  onImageChange: (imageId: string, patch: Partial<Pick<EvidenceImage, 'title' | 'sourceUrl' | 'notes'>>) => void
  onLinkChange: (linkId: string, patch: Partial<Pick<EvidenceLink, 'relation' | 'note' | 'confidence'>>) => void
  onLinkSwap: (linkId: string) => void
  onPaletteChange: (paletteId: string, patch: Partial<Pick<PaletteNode, 'title' | 'sourceUrl' | 'notes'>>) => void
  onDiagramChange: (diagramId: string, patch: Partial<Pick<DiagramNode, 'title' | 'sourceUrl' | 'notes' | 'source'>>) => void
  onPlaceholderChange: (placeholderId: string, patch: Partial<Pick<PlaceholderNode, 'title' | 'sourceUrl' | 'notes'>>) => void
  onProjectMetadataChange: (patch: Partial<ProjectMetadata>) => void
  onProjectAppearanceChange: (patch: Partial<ProjectAppearance>) => void
  onPaletteColorChange: (paletteId: string, colorIndex: number, color: string) => void
  onPaletteColorAdd: (paletteId: string) => void
  onPaletteColorRemove: (paletteId: string, colorIndex: number) => void
  onPaletteRegenerate: (paletteId: string, algorithm: PaletteHarmony) => void
  onLinkCreationRelationChange: (relation: Relation) => void
  onReferenceTagAdd: (imageId: string, tag: string) => void
  onReferenceTagRemove: (imageId: string, tag: string) => void
  onReferenceOcr: (imageId: string) => void
  onReferenceTagRefine: (imageId: string) => void
  onReferenceReplace: (imageId: string, files: FileList | File[]) => void
  onReferenceReplaceFromImage: (imageId: string, sourceImageId: string) => void
  onDroppedReference: (payload: DroppedReferencePayload, target: DroppedReferenceTarget) => void | Promise<void>
  onPlaceholderAttach: (placeholderId: string, files: FileList | File[]) => void
  onReferenceFindSimilar: (imageId: string) => void
  onReferenceConvertToPalette: (imageId: string) => void
  onIdeaTitleFocused: () => void
  onIdeaDelete: (ideaId: string) => void
  onImageDelete: (imageId: string) => void
  onPaletteDelete: (paletteId: string) => void
  onDiagramDelete: (diagramId: string) => void
  onPlaceholderDelete: (placeholderId: string) => void
  onLinkSelectedReferences: (ideaId: string) => void
  onLinkDelete: (linkId: string) => void
  onNodeVersionRestore: (versionId: string) => void
  onBeginLinkFromNode: (source: Pick<GraphNodeRef, 'kind' | 'id'>) => void
  onDuplicateSelection: () => void
  onOpenOutline: () => void
  onRebuildOutline: () => void
  onToggleFloating: () => void
}) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [isInspectorToolsOpen, setIsInspectorToolsOpen] = useState(false)
  const [isProjectColorOpen, setIsProjectColorOpen] = useState(false)
  const ideaLinks = selected.kind === 'idea'
    ? links
        .filter((link) => link.ideaId === selected.idea.id)
        .map((link) => ({
          link,
          image: images.find((candidate) => candidate.id === link.imageId),
        }))
        .filter((entry): entry is { link: EvidenceLink; image: EvidenceImage } => Boolean(entry.image))
    : []
  const imageLinks = selected.kind === 'image'
    ? links
        .filter((link) => link.imageId === selected.image.id)
        .map((link) => ({
          link,
          idea: ideas.find((candidate) => candidate.id === link.ideaId),
        }))
        .filter((entry): entry is { link: EvidenceLink; idea: Idea } => Boolean(entry.idea))
    : []
  const selectedNodeRef = selected.kind === 'idea'
    ? { kind: 'idea' as const, id: selected.idea.id }
    : selected.kind === 'image'
      ? { kind: 'image' as const, id: selected.image.id }
      : selected.kind === 'palette'
        ? { kind: 'palette' as const, id: selected.palette.id }
        : selected.kind === 'diagram'
          ? { kind: 'diagram' as const, id: selected.diagram.id }
          : selected.kind === 'placeholder'
            ? { kind: 'placeholder' as const, id: selected.placeholder.id }
            : null
  const nodeLinkEntries = selectedNodeRef
    ? links
        .filter((link) => {
          const sourceId = link.sourceNodeId ?? link.imageId
          const targetId = link.targetNodeId ?? link.ideaId
          return sourceId === selectedNodeRef.id || targetId === selectedNodeRef.id
        })
        .map((link) => ({
          link,
          source: resolveGraphNodeRef(link.sourceNodeId ?? link.imageId, ideas, images, palettes, diagrams, placeholders),
          target: resolveGraphNodeRef(link.targetNodeId ?? link.ideaId, ideas, images, palettes, diagrams, placeholders),
        }))
    : []
  const selectedNodeVersions = selectedNodeRef
    ? nodeVersions
        .filter((version) => version.nodeId === selectedNodeRef.id && version.nodeKind === selectedNodeRef.kind)
        .slice(0, 8)
    : []

  useEffect(() => {
    if (selected.kind !== 'idea' || selected.idea.id !== ideaTitleFocusId) return
    requestAnimationFrame(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
      onIdeaTitleFocused()
    })
  }, [ideaTitleFocusId, onIdeaTitleFocused, selected])

  useDismissableLayer(isInspectorToolsOpen, '.inspector-tools-menu, [data-menu-trigger="inspector-tools"]', () => {
    setIsInspectorToolsOpen(false)
  })

  if (isCollapsed) {
    return (
      <aside className="inspector panel inspector--collapsed">
        <button className="icon-button" type="button" aria-label="Expand inspector" onClick={onToggleCollapsed}>
          <PanelLeft size={16} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="inspector panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker"><T k="inspector.title" /></p>
          <h2>{selected.heading}</h2>
        </div>
        <div className="panel-actions">
          {selectedNodeRef && (
            <button className="icon-button" type="button" aria-label="Create link from node" onClick={() => onBeginLinkFromNode(selectedNodeRef)}>
              <Link2 size={15} />
            </button>
          )}
          <button
            className={isInspectorToolsOpen ? 'icon-button is-active' : 'icon-button'}
            type="button"
            aria-label="More inspector tools"
            aria-expanded={isInspectorToolsOpen}
            data-menu-trigger="inspector-tools"
            onClick={() => setIsInspectorToolsOpen((current) => !current)}
          >
            <MoreHorizontal size={15} />
          </button>
          {isInspectorToolsOpen && (
            <div className="panel-popover inspector-tools-menu">
              {selectedNodeRef && (
                <button type="button" onClick={onDuplicateSelection}>
                  <Clipboard size={14} />
                  Duplicate
                </button>
              )}
              <button type="button" onClick={onToggleFloating}>
                <Maximize2 size={14} />
                Undock
              </button>
            </div>
          )}
        </div>
      </div>

      {selected.kind === 'project' && (
        <>
          <section className="inspector-card project-file-card">
            <label className="field-label" htmlFor="project-title"><T k="inspector.name" /></label>
            <input
              id="project-title"
              className="title-input"
              value={selected.project.title}
              onChange={(event) => onProjectMetadataChange({ title: event.target.value })}
            />
            <label className="field-label" htmlFor="project-description"><T k="inspector.description" /></label>
            <textarea
              id="project-description"
              className="note-input"
              value={selected.project.description}
              onChange={(event) => onProjectMetadataChange({ description: event.target.value })}
            />
            <label className="field-label" htmlFor="project-author"><T k="inspector.author" /></label>
            <input
              id="project-author"
              className="title-input"
              value={selected.project.author}
              onChange={(event) => onProjectMetadataChange({ author: event.target.value })}
            />
            <label className="field-label" htmlFor="project-kind"><T k="inspector.kind" /></label>
            <select
              id="project-kind"
              className="title-input"
              value={selected.project.kind}
              onChange={(event) => onProjectMetadataChange({ kind: event.target.value as ProjectKind })}
            >
              <option value="moodboard">Moodboard</option>
              <option value="ideaboard">Ideaboard</option>
            </select>
            <label className="field-label" htmlFor="project-style-note"><T k="inspector.styleNote" /></label>
            <textarea
              id="project-style-note"
              className="note-input"
              value={selected.project.styleNote}
              onChange={(event) => onProjectMetadataChange({ styleNote: event.target.value })}
            />
          </section>

          <section className="inspector-card project-file-card">
            <div className="section-heading">
              <CircleDot size={14} />
              Color Scheme
            </div>
            <ProjectColorSummary
              appearance={selected.appearance}
              isOpen={isProjectColorOpen}
              onToggle={() => setIsProjectColorOpen((current) => !current)}
            />
            {isProjectColorOpen && (
              <div className="project-color-editor">
                <div className="color-formula-grid" aria-label="Color formula style">
                  {projectColorFormulas.map((formula) => {
                    const preview = accentThemeRecipe(selected.appearance.accentColor, formula.id, selected.appearance.colorMode ?? 'dark')
                    return (
                      <button
                        key={formula.id}
                        type="button"
                        className={selected.appearance.colorFormula === formula.id ? 'is-active' : ''}
                        onClick={() => onProjectAppearanceChange({ colorFormula: formula.id })}
                      >
                        <div className="formula-swatch-strip" aria-hidden="true">
                          <i style={{ background: preview.canvas }} />
                          <i style={{ background: preview.nodeSurface }} />
                          <i style={{ background: preview.surface2 }} />
                        </div>
                        <div className="formula-label-row">
                          <span>{formula.label}</span>
                          <small>{formula.description}</small>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="accent-color-recommendations" aria-label="Accent colors">
                  {projectAccentPresets.filter((preset) => preset.id !== 'custom').map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={selected.appearance.accentPreset === preset.id ? 'is-active' : ''}
                      onClick={() => onProjectAppearanceChange({ accentPreset: preset.id })}
                    >
                      <i style={{ background: preset.color }} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
                <HexColorPicker
                  color={selected.appearance.accentColor}
                  onChange={(color) => onProjectAppearanceChange({ accentColor: color })}
                />
                <div className="color-inline-row">
                  <input
                    id="project-accent-color"
                    aria-label="Custom accent color"
                    type="color"
                    value={normalizeHexInput(selected.appearance.accentColor)}
                    onChange={(event) => onProjectAppearanceChange({ accentColor: event.target.value })}
                  />
                  <code>Accent {normalizeHexInput(selected.appearance.accentColor).toUpperCase()}</code>
                </div>
                <div className="generated-color-row">
                  <span>Generated canvas</span>
                  <code>{normalizeHexInput(selected.appearance.canvasColor).toUpperCase()}</code>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {selected.kind === 'idea' && (
        <>
          <section className="inspector-card">
            <div className="section-heading">
              <Brain size={14} />
              Idea
            </div>
            <input
              ref={titleInputRef}
              className="title-input"
              value={selected.idea.title}
              onChange={(event) => onIdeaChange(selected.idea.id, { title: event.target.value })}
            />
            <textarea
              className="note-input"
              value={selected.idea.body}
              onChange={(event) => onIdeaChange(selected.idea.id, { body: event.target.value })}
            />
            <textarea
              className="note-input"
              placeholder="Notes..."
              value={selected.idea.notes ?? ''}
              onChange={(event) => onIdeaChange(selected.idea.id, { notes: event.target.value })}
            />
            <input
              className="title-input"
              placeholder="Source URL"
              value={selected.idea.sourceUrl ?? ''}
              onChange={(event) => onIdeaChange(selected.idea.id, { sourceUrl: event.target.value })}
            />
          </section>
          <section className="inspector-card">
            <div className="section-heading">
              <Link2 size={14} />
              References
              <span>{ideaLinks.length}</span>
            </div>
            <LinkedList
              count={ideaLinks.length}
              emptyLabel="No references"
              limit={inspectorLinkedListLimit}
              renderItems={(limit) => ideaLinks.slice(0, limit).map(({ link, image }) => (
                <button key={link.id} type="button" onClick={() => onSelect({ type: 'link', id: link.id })}>
                  <ReferenceThumb image={image} />
                  <span>
                    <strong>{image.title}</strong>
                    <small>{link.relation}</small>
                  </span>
                </button>
              ))}
            />
            {selectedReferenceCount > 0 && (
              <div className="link-create-row">
                <select
                  aria-label="Link selected relation"
                  value={linkCreationRelation}
                  onChange={(event) => onLinkCreationRelationChange(event.target.value as Relation)}
                >
                  {Object.keys(relationLabels).map((relation) => (
                    <option key={relation} value={relation}>
                      {relationLabels[relation as Relation]}
                    </option>
                  ))}
                </select>
                <button className="inline-action" type="button" onClick={() => onLinkSelectedReferences(selected.idea.id)}>
                  <Link2 size={13} />
                  Link selected ({selectedReferenceCount})
                </button>
              </div>
            )}
          </section>
          <button className="primary-button is-wide" type="button" onClick={onRebuildOutline}>
            <Bot size={15} />
            Create outline
          </button>
          <NodeLinksSection entries={nodeLinkEntries} nodeId={selected.idea.id} onRemove={onLinkDelete} onSelect={onSelect} />
          <NodeMetadata node={selected.idea} />
          <NodeVersionTimeline versions={selectedNodeVersions} onRestore={onNodeVersionRestore} />
          <button className="danger-action" type="button" onClick={() => onIdeaDelete(selected.idea.id)}>
            Delete idea
          </button>
        </>
      )}

      {selected.kind === 'image' && (
        <>
          <div
            className="inspector-image-shell"
            onDragOver={(event) => {
              if (!hasDroppedReferencePayload(event.dataTransfer)) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={(event) => {
              const payload = extractDroppedReferencePayload(event.dataTransfer)
              if (!payload) return
              event.preventDefault()
              event.stopPropagation()
              void onDroppedReference(payload, { kind: 'image', imageId: selected.image.id })
            }}
          >
            <ReferenceThumb image={selected.image} className="inspector-image" />
            <div className="inspector-image-actions" aria-label="Reference image tools">
              <label className="image-edge-action file-action">
                <ImagePlus size={13} />
                Replace
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    if (event.target.files) onReferenceReplace(selected.image.id, event.target.files)
                    event.currentTarget.value = ''
                  }}
                />
              </label>
              <button className="image-edge-action" type="button" onClick={() => onReferenceFindSimilar(selected.image.id)}>
                <Search size={13} />
                Similar
              </button>
              <button className="image-edge-action" type="button" onClick={() => onReferenceConvertToPalette(selected.image.id)}>
                <CircleDot size={13} />
                Palette
              </button>
            </div>
          </div>
          <section className="reference-palette-card">
            {selected.image.palette.length > 0 ? (
              <>
                <div className="reference-palette-strip" aria-label="Extracted image colors">
                  {selected.image.palette.slice(0, 7).map((color, index) => (
                    <button
                      key={`${selected.image.id}-palette-${index}-${color}`}
                      type="button"
                      className="reference-palette-segment"
                      title={color}
                      style={{ background: color }}
                      onClick={() => void navigator.clipboard?.writeText(color)}
                    >
                      <code>{color.toUpperCase()}</code>
                    </button>
                  ))}
                </div>
                <div className="reference-palette-actions">
                  <button type="button" onClick={() => void copyColorSet(selected.image.palette.slice(0, 7))}>
                    Copy set
                  </button>
                  <button type="button" onClick={() => void copyColorBlockSvg(selected.image.palette.slice(0, 7), selected.image.title)}>
                    Copy SVG
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-copy">No colors extracted yet.</p>
            )}
          </section>
          <section className="inspector-card inspector-lede">
            <input
              className="title-input"
              value={selected.image.title}
              onChange={(event) => onImageChange(selected.image.id, { title: event.target.value })}
            />
            <textarea
              className="note-input"
              placeholder="Notes..."
              value={selected.image.notes ?? ''}
              onChange={(event) => onImageChange(selected.image.id, { notes: event.target.value })}
            />
            <div className="source-url-row">
              <Link2 size={13} />
              <input
                className="title-input"
                placeholder="Source URL"
                value={selected.image.sourceUrl ?? ''}
                onChange={(event) => onImageChange(selected.image.id, { sourceUrl: event.target.value })}
              />
              <button
                type="button"
                aria-label="Open source URL"
                disabled={!selected.image.sourceUrl}
                onClick={() => {
                  if (selected.image.sourceUrl) window.open(selected.image.sourceUrl, '_blank', 'noopener,noreferrer')
                }}
              >
                <ExternalLink size={13} />
              </button>
            </div>
            <details className="metadata-disclosure">
              <summary>
                <Database size={13} />
                Source
              </summary>
              <dl>
                <div>
                  <dt>Source</dt>
                  <dd>{selected.image.source}</dd>
                </div>
                {selected.image.originApp && (
                  <div>
                    <dt>Origin</dt>
                    <dd>{selected.image.originApp}</dd>
                  </div>
                )}
                {selected.image.originId && (
                  <div>
                    <dt>ID</dt>
                    <dd>{selected.image.originId}</dd>
                  </div>
                )}
                {selected.image.sourcePath && (
                  <div>
                    <dt>Path</dt>
                    <dd>{selected.image.sourcePath}</dd>
                  </div>
                )}
              </dl>
            </details>
          </section>
          <TagBlock
            image={selected.image}
            canRunOcr={isTauriRuntime() && selected.image.thumb.startsWith('data:image/')}
            canRefineTags={localModelAvailable}
            isOcrRunning={ocrRunningImageId === selected.image.id}
            isRefiningTags={modelRunningImageId === selected.image.id}
            ocrStatus={ocrStatusByImageId[selected.image.id]}
            modelStatus={modelStatusByImageId[selected.image.id]}
            onAcceptSuggestion={(tag) => onAcceptSuggestion(selected.image.id, tag)}
            onRejectSuggestion={(tag) => onRejectSuggestion(selected.image.id, tag)}
            onAddTag={(tag) => onReferenceTagAdd(selected.image.id, tag)}
            onRemoveTag={(tag) => onReferenceTagRemove(selected.image.id, tag)}
            onRunOcr={() => onReferenceOcr(selected.image.id)}
            onRefineTags={() => onReferenceTagRefine(selected.image.id)}
          />
          <section className="inspector-card">
            <div className="section-heading">
              <Link2 size={14} />
              Ideas
              <span>{imageLinks.length}</span>
            </div>
            <LinkedList
              count={imageLinks.length}
              emptyLabel="No ideas"
              limit={inspectorLinkedListLimit}
              renderItems={(limit) => imageLinks.slice(0, limit).map(({ link, idea }) => (
                <button key={link.id} type="button" onClick={() => onSelect({ type: 'link', id: link.id })}>
                  <span className="idea-dot" />
                  <span>
                    <strong>{idea.title}</strong>
                    <small>{link.relation}</small>
                  </span>
                </button>
              ))}
            />
          </section>
          <NodeLinksSection entries={nodeLinkEntries} nodeId={selected.image.id} onRemove={onLinkDelete} onSelect={onSelect} />
          <NodeMetadata node={selected.image} />
          <NodeVersionTimeline versions={selectedNodeVersions} onRestore={onNodeVersionRestore} />
          <button className="danger-action" type="button" onClick={() => onImageDelete(selected.image.id)}>
            Delete reference
          </button>
        </>
      )}

      {selected.kind === 'link' && (
        <>
          <section className="inspector-card">
            <div className="section-heading">
              <Link2 size={14} />
              Link
            </div>
            <div className="relation-preview">
              <button
                className="node-link-endpoint"
                type="button"
                disabled={!selected.source}
                onClick={() => selected.source && onSelect({ type: selected.source.kind, id: selected.source.id } as Selection)}
              >
                <small>{selected.source?.kind ?? 'source'}</small>
                <strong>{selected.source?.title ?? selected.link.sourceNodeId ?? selected.link.imageId}</strong>
              </button>
              <span className="relation-arrow">
                <Link2 size={13} />
              </span>
              <button
                className="node-link-endpoint"
                type="button"
                disabled={!selected.target}
                onClick={() => selected.target && onSelect({ type: selected.target.kind, id: selected.target.id } as Selection)}
              >
                <small>{selected.target?.kind ?? 'target'}</small>
                <strong>{selected.target?.title ?? selected.link.targetNodeId ?? selected.link.ideaId}</strong>
              </button>
            </div>
            <button className="inline-action" type="button" onClick={() => onLinkSwap(selected.link.id)}>
              <GitBranch size={13} />
              Swap direction
            </button>
          </section>
          <section className="inspector-card">
            <label className="field-label" htmlFor="relation">
              Relation type
            </label>
            <select
              id="relation"
              value={selected.link.relation}
              onChange={(event) => {
                const relation = event.target.value as Relation
                onRelationChange(selected.link.id, relation)
                onLinkChange(selected.link.id, { relation })
              }}
            >
              {Object.keys(relationLabels).map((relation) => (
                <option key={relation} value={relation}>
                  {relationLabels[relation as Relation]}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="note">
              Note
            </label>
            <textarea
              id="note"
              value={selected.link.note}
              onChange={(event) => onLinkChange(selected.link.id, { note: event.target.value })}
            />
          </section>
          <details className="inspector-card metadata-disclosure">
            <summary>
              <Sparkles size={14} />
              Confidence
            </summary>
            <label className="range-field">
              <span>Score</span>
              <input
                aria-label="Link confidence"
                type="range"
                min="0"
                max="100"
                value={Math.round(selected.link.confidence * 100)}
                onInput={(event) => onLinkChange(selected.link.id, { confidence: Number(event.currentTarget.value) / 100 })}
                onChange={(event) => onLinkChange(selected.link.id, { confidence: Number(event.currentTarget.value) / 100 })}
              />
            </label>
            <div className="confidence-bar">
              <span style={{ width: `${selected.link.confidence * 100}%` }} />
            </div>
            <dl>
              <div>
                <dt>Score</dt>
                <dd>{Math.round(selected.link.confidence * 100)}%</dd>
              </div>
              <div>
                <dt>Signals</dt>
                <dd>tags, source, proximity</dd>
              </div>
            </dl>
          </details>
          <button className="danger-action" type="button" onClick={() => onLinkDelete(selected.link.id)}>
            Remove link
          </button>
        </>
      )}

      {selected.kind === 'palette' && (
        <>
          <section className="inspector-card">
            <div className="section-heading">
              <CircleDot size={14} />
              Palette
              <span>{palettes.length}</span>
            </div>
            <input
              className="title-input"
              value={selected.palette.title}
              onChange={(event) => onPaletteChange(selected.palette.id, { title: event.target.value })}
            />
            <div className="palette-inspector-strip">
              {selected.palette.colors.map((color, index) => (
                <i key={`${selected.palette.id}-${index}-${color}`} style={{ background: color }} />
              ))}
            </div>
            <textarea
              className="note-input"
              placeholder="Notes..."
              value={selected.palette.notes ?? ''}
              onChange={(event) => onPaletteChange(selected.palette.id, { notes: event.target.value })}
            />
            <input
              className="title-input"
              placeholder="Source URL"
              value={selected.palette.sourceUrl ?? ''}
              onChange={(event) => onPaletteChange(selected.palette.id, { sourceUrl: event.target.value })}
            />
          </section>
          <section className="inspector-card">
            <label className="field-label" htmlFor="palette-color">
              Color
            </label>
            <HexColorPicker
              color={selected.palette.colors[0] ?? '#84cdbc'}
              onChange={(color) => onPaletteColorChange(selected.palette.id, 0, color)}
            />
            <div className="palette-color-editor" aria-label="Palette colors">
              {selected.palette.colors.map((color, index) => (
                <div key={`${selected.palette.id}-edit-${index}-${color}`} className="palette-color-row">
                  <input
                    aria-label={`Palette color ${index + 1}`}
                    type="color"
                    value={normalizeHexInput(color)}
                    onChange={(event) => onPaletteColorChange(selected.palette.id, index, event.target.value)}
                  />
                  <code>{normalizeHexInput(color)}</code>
                  <button
                    type="button"
                    aria-label={`Remove palette color ${index + 1}`}
                    onClick={() => onPaletteColorRemove(selected.palette.id, index)}
                    disabled={selected.palette.colors.length <= 1}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button className="inline-action" type="button" onClick={() => onPaletteColorAdd(selected.palette.id)}>
                <Plus size={13} />
                Add color
              </button>
            </div>
            <div className="palette-algorithms">
              {(['complementary', 'analogous', 'triadic', 'split', 'monochrome', 'shades'] as PaletteHarmony[]).map((algorithm) => (
                <button key={algorithm} type="button" onClick={() => onPaletteRegenerate(selected.palette.id, algorithm)}>
                  {algorithm}
                </button>
              ))}
            </div>
            <button className="inline-action" type="button" onClick={() => onPaletteRegenerate(selected.palette.id, 'analogous')}>
              <Sparkles size={13} />
              Rebalance palette
            </button>
          </section>
          <NodeLinksSection entries={nodeLinkEntries} nodeId={selected.palette.id} onRemove={onLinkDelete} onSelect={onSelect} />
          <NodeMetadata node={selected.palette} />
          <NodeVersionTimeline versions={selectedNodeVersions} onRestore={onNodeVersionRestore} />
          <button className="danger-action" type="button" onClick={() => onPaletteDelete(selected.palette.id)}>
            Delete palette
          </button>
        </>
      )}

      {selected.kind === 'diagram' && (
        <>
          <section className="inspector-card">
            <div className="section-heading">
              <FileText size={14} />
              Diagram
              <span>{diagrams.length}</span>
            </div>
            <input
              className="title-input"
              value={selected.diagram.title}
              onChange={(event) => onDiagramChange(selected.diagram.id, { title: event.target.value })}
            />
            <dl>
              <div>
                <dt>Format</dt>
                <dd>{selected.diagram.format}</dd>
              </div>
              <div>
                <dt>Nodes</dt>
                <dd>{selected.diagram.nodeIds.length}</dd>
              </div>
            </dl>
            <textarea
              className="note-input"
              placeholder="Notes..."
              value={selected.diagram.notes ?? ''}
              onChange={(event) => onDiagramChange(selected.diagram.id, { notes: event.target.value })}
            />
            <input
              className="title-input"
              placeholder="Source URL"
              value={selected.diagram.sourceUrl ?? ''}
              onChange={(event) => onDiagramChange(selected.diagram.id, { sourceUrl: event.target.value })}
            />
          </section>
          <section className="inspector-card">
            <label className="field-label" htmlFor="diagram-source">
              Source
            </label>
            <textarea
              id="diagram-source"
              className="diagram-source-input"
              value={selected.diagram.source}
              onChange={(event) => onDiagramChange(selected.diagram.id, { source: event.target.value })}
            />
          </section>
          <NodeLinksSection entries={nodeLinkEntries} nodeId={selected.diagram.id} onRemove={onLinkDelete} onSelect={onSelect} />
          <NodeMetadata node={selected.diagram} />
          <NodeVersionTimeline versions={selectedNodeVersions} onRestore={onNodeVersionRestore} />
          <button className="danger-action" type="button" onClick={() => onDiagramDelete(selected.diagram.id)}>
            Delete diagram
          </button>
        </>
      )}

      {selected.kind === 'placeholder' && (
        <>
          <section className="inspector-card">
            <div className="section-heading">
              <ImagePlus size={14} />
              Placeholder
              <span>{placeholders.length}</span>
            </div>
            <input
              className="title-input"
              value={selected.placeholder.title}
              onChange={(event) => onPlaceholderChange(selected.placeholder.id, { title: event.target.value })}
            />
            <p className="inspector-lede">Drop or import an image later and use this as a planned evidence slot.</p>
            <label className="inline-action file-action">
              <ImagePlus size={13} />
              Attach image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  if (event.target.files) onPlaceholderAttach(selected.placeholder.id, event.target.files)
                  event.currentTarget.value = ''
                }}
              />
            </label>
            <textarea
              className="note-input"
              placeholder="Notes..."
              value={selected.placeholder.notes ?? ''}
              onChange={(event) => onPlaceholderChange(selected.placeholder.id, { notes: event.target.value })}
            />
            <input
              className="title-input"
              placeholder="Source URL"
              value={selected.placeholder.sourceUrl ?? ''}
              onChange={(event) => onPlaceholderChange(selected.placeholder.id, { sourceUrl: event.target.value })}
            />
          </section>
          <NodeLinksSection entries={nodeLinkEntries} nodeId={selected.placeholder.id} onRemove={onLinkDelete} onSelect={onSelect} />
          <NodeMetadata node={selected.placeholder} />
          <NodeVersionTimeline versions={selectedNodeVersions} onRestore={onNodeVersionRestore} />
          <button className="danger-action" type="button" onClick={() => onPlaceholderDelete(selected.placeholder.id)}>
            Delete placeholder
          </button>
        </>
      )}
    </aside>
  )
}

function ConfirmDeleteDialog({
  pendingDelete,
  onCancel,
  onConfirm,
}: {
  pendingDelete: PendingDelete | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pendingDelete) return
    cancelRef.current?.focus()

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onCancel, pendingDelete])

  if (!pendingDelete) return null

  const deleteCopy = deleteDialogCopy(pendingDelete)
  return (
    <div className="dialog-overlay">
      <section
        aria-describedby="delete-dialog-copy"
        aria-labelledby="delete-dialog-title"
        aria-modal="true"
        className="confirm-dialog"
        role="alertdialog"
      >
        <div>
          <h2 id="delete-dialog-title">{deleteCopy.title}</h2>
          <p id="delete-dialog-copy">{deleteCopy.body}</p>
        </div>
        <div className="dialog-actions">
          <button ref={cancelRef} className="quiet-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" type="button" onClick={onConfirm}>
            {deleteCopy.action}
          </button>
        </div>
      </section>
    </div>
  )
}

function ProjectColorSummary({
  appearance,
  isOpen,
  onToggle,
}: {
  appearance: ProjectAppearance
  isOpen: boolean
  onToggle: () => void
}) {
  const tokens = projectColorTokens(appearance)
  const dots = [
    tokens.canvas,
    tokens.surface1,
    tokens.textMain,
    tokens.accentStrong,
    tokens.accent,
  ]

  return (
    <button
      className={isOpen ? 'project-color-summary is-active' : 'project-color-summary'}
      type="button"
      aria-expanded={isOpen}
      aria-label="Choose accent color scheme"
      onClick={onToggle}
    >
      <span className="project-color-dots" aria-hidden="true">
        {dots.map((color, index) => (
          <i key={`${color}-${index}`} style={{ background: color }} />
        ))}
      </span>
      <span>
        <strong>Accent scheme</strong>
        <small>{appearance.accentColor.toUpperCase()} · {tokens.mood} · canvas {tokens.canvas.toUpperCase()}</small>
      </span>
      <ChevronRight size={14} />
    </button>
  )
}

function NodeMetadata({
  node,
}: {
  node: Pick<Idea | EvidenceImage | PaletteNode | DiagramNode | PlaceholderNode, 'importance' | 'createdAt' | 'addedAt' | 'updatedAt' | 'sourceUrl'> & {
    width?: number
    height?: number
    sizeBytes?: number
    mimeType?: string
  }
}) {
  return (
    <details className="inspector-card metadata-disclosure">
      <summary>
        <Database size={14} />
        Properties
      </summary>
      <dl>
        <div>
          <dt>Importance</dt>
          <dd>{formatImportance(node.importance)}</dd>
        </div>
        {node.sourceUrl && (
          <div>
            <dt>Source URL</dt>
            <dd>{node.sourceUrl}</dd>
          </div>
        )}
        {node.width && node.height && (
          <div>
            <dt>Dimensions</dt>
            <dd>{node.width} x {node.height}</dd>
          </div>
        )}
        {typeof node.sizeBytes === 'number' && (
          <div>
            <dt>Size</dt>
            <dd>{formatBytes(node.sizeBytes)}</dd>
          </div>
        )}
        {node.mimeType && (
          <div>
            <dt>Type</dt>
            <dd>{formatMimeType(node.mimeType)}</dd>
          </div>
        )}
        {node.createdAt && (
          <div>
            <dt>Created</dt>
            <dd>{formatMetadataTime(node.createdAt)}</dd>
          </div>
        )}
        {node.addedAt && (
          <div>
            <dt>Added</dt>
            <dd>{formatMetadataTime(node.addedAt)}</dd>
          </div>
        )}
        {node.updatedAt && (
          <div>
            <dt>Updated</dt>
            <dd>{formatMetadataTime(node.updatedAt)}</dd>
          </div>
        )}
      </dl>
    </details>
  )
}

function NodeVersionTimeline({
  versions,
  onRestore,
}: {
  versions: NodeVersionRecord[]
  onRestore: (versionId: string) => void
}) {
  return (
    <section className="inspector-card node-version-card">
      <div className="section-heading">
        <GitBranch size={14} />
        Versions
        <span>{versions.length}</span>
      </div>
      {versions.length === 0 ? (
        <p className="empty-copy">No node versions yet</p>
      ) : (
        <div className="node-version-list">
          {versions.map((version) => (
            <article key={version.id} className="node-version-row">
              <div>
                <strong>v{version.versionNumber}</strong>
                <span>{version.summary}</span>
                <small>{formatNodeVersionMeta(version)}</small>
              </div>
              <button type="button" aria-label={`Restore node version ${version.versionNumber}`} onClick={() => onRestore(version.id)}>
                <Undo2 size={13} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function NodeLinksSection({
  entries,
  nodeId,
  onRemove,
  onSelect,
}: {
  entries: Array<{ link: EvidenceLink; source: GraphNodeRef | null; target: GraphNodeRef | null }>
  nodeId: string
  onRemove: (linkId: string) => void
  onSelect: (selection: Selection) => void
}) {
  return (
    <section className="inspector-card">
      <div className="section-heading">
        <Link2 size={14} />
        Relations
        <span>{entries.length}</span>
      </div>
      <LinkedList
        count={entries.length}
        emptyLabel="No relations"
        limit={inspectorLinkedListLimit}
        renderItems={(limit) => entries.slice(0, limit).map(({ link, source, target }) => {
          const isOutgoing = (link.sourceNodeId ?? link.imageId) === nodeId
          const peer = isOutgoing ? target : source
          const sourceLabel = source ? graphNodeKindLabel(source.kind) : 'Node'
          const targetLabel = target ? graphNodeKindLabel(target.kind) : 'Node'
          return (
            <div key={link.id} className="linked-list-row">
              <button type="button" onClick={() => onSelect({ type: 'link', id: link.id })}>
              <span className={`node-kind-dot node-kind-dot--${peer?.kind ?? 'unknown'}`} />
              <span>
                <strong>{peer?.title ?? 'Missing endpoint'}</strong>
                <small>{sourceLabel} {'->'} {targetLabel} · {relationLabels[link.relation]}</small>
              </span>
              </button>
              <button
                className="linked-list-remove"
                type="button"
                aria-label={`Remove relation to ${peer?.title ?? 'node'}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(link.id)
                }}
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      />
    </section>
  )
}

function graphNodeKindLabel(kind: GraphNodeKind | 'unknown') {
  if (kind === 'image') return 'Reference'
  if (kind === 'idea') return 'Idea'
  if (kind === 'palette') return 'Palette'
  if (kind === 'diagram') return 'Diagram'
  if (kind === 'placeholder') return 'Placeholder'
  return 'Node'
}

function nodeSelectionKey(node: Pick<GraphNodeRef, 'kind' | 'id'>) {
  return `${node.kind}:${node.id}`
}

function isNodeSelection(selection: Selection): selection is Selection & { type: GraphNodeKind; id: string } {
  return ['idea', 'image', 'palette', 'diagram', 'placeholder'].includes(selection.type)
}

function formatImportance(value: number | undefined) {
  return `${(value ?? 1).toFixed(1)}x`
}

function formatMetadataTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

async function copyColorSet(colors: string[]) {
  if (!navigator.clipboard?.writeText) return
  await navigator.clipboard.writeText(colors.map((color) => color.toUpperCase()).join(', '))
}

async function copyColorBlockSvg(colors: string[], title: string) {
  if (!navigator.clipboard?.writeText || colors.length === 0) return
  const width = 420
  const height = 96
  const swatchWidth = width / colors.length
  const rects = colors.map((color, index) =>
    `<rect x="${Math.round(index * swatchWidth)}" y="0" width="${Math.ceil(swatchWidth)}" height="${height}" fill="${escapeAttribute(color)}"/>`,
  ).join('')
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(title)} palette">`,
    rects,
    '</svg>',
  ].join('')
  await navigator.clipboard.writeText(svg)
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

function formatMimeType(value: string) {
  return value.split('/').at(-1)?.toUpperCase() || value.toUpperCase()
}

function normalizeHexInput(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value
  const rgb = converter('rgb')(value)
  if (!rgb) return '#84cdbc'
  const converted = formatHex(rgb)
  return /^#[0-9a-f]{6}$/i.test(converted) ? converted : '#84cdbc'
}

function buildProjectAppearanceStyle(appearance: ProjectAppearance): React.CSSProperties {
  const tokens = projectColorTokens(appearance)
  const accent = tokens.accent
  const dark = tokens.mode === 'dark'
  return {
    '--bg-base': tokens.base,
    '--bg-canvas': tokens.canvasSurface,
    '--surface-1': tokens.surface1,
    '--surface-2': tokens.surface2,
    '--surface-3': tokens.surface3,
    '--surface-drawer': tokens.surfaceDrawer,
    '--surface-inspector': tokens.surfaceInspector,
    '--surface-inset': tokens.surfaceInset,
    '--node-surface': colorWithAlpha(tokens.nodeSurface, dark ? 0.82 : 0.78),
    '--node-surface-selected': colorWithAlpha(tokens.nodeSelected, dark ? 0.94 : 0.9),
    '--node-border': dark ? 'rgb(255 255 255 / 0.045)' : colorWithAlpha(tokens.textMain, 0.11),
    '--node-shadow': dark ? '0 18px 48px rgb(0 0 0 / 0.35)' : `0 10px 28px ${colorWithAlpha(tokens.textMain, 0.13)}`,
    '--node-shadow-soft': `0 0 0 1px ${colorWithAlpha(tokens.accentStrong, dark ? 0.1 : 0.16)}`,
    '--node-shadow-rest': dark ? '0 6px 20px rgb(0 0 0 / 0.22)' : `0 4px 14px ${colorWithAlpha(tokens.textMain, 0.1)}`,
    '--node-shadow-hover': dark ? '0 12px 34px rgb(0 0 0 / 0.3)' : `0 10px 26px ${colorWithAlpha(tokens.textMain, 0.14)}`,
    '--window-border': dark ? 'rgb(255 255 255 / 0.08)' : colorWithAlpha(tokens.textMain, 0.08),
    '--glass-sidebar': dark ? colorWithAlpha(tokens.surface1, 0.32) : colorWithAlpha(tokens.surface1, 0.34),
    '--glass-drawer': dark ? colorWithAlpha(tokens.surfaceDrawer, 0.34) : colorWithAlpha(tokens.surfaceDrawer, 0.38),
    '--glass-content': dark ? colorWithAlpha(tokens.base, 0.22) : colorWithAlpha(tokens.base, 0.28),
    '--glass-inspector': dark ? colorWithAlpha(tokens.surfaceInspector, 0.38) : colorWithAlpha(tokens.surfaceInspector, 0.42),
    '--glass-hover': dark ? 'rgb(255 255 255 / 0.055)' : 'rgb(34 31 26 / 0.055)',
    '--glass-active': colorWithAlpha(accent, dark ? 0.24 : 0.22),
    '--separator-hairline': dark ? 'rgb(255 255 255 / 0.052)' : colorWithAlpha(tokens.textMain, 0.1),
    '--inset-field': dark ? 'rgb(0 0 0 / 0.12)' : 'rgb(255 255 255 / 0.58)',
    '--border-soft': dark ? 'rgb(255 255 255 / 0.06)' : colorWithAlpha(tokens.textMain, 0.1),
    '--border-strong': dark ? 'rgb(255 255 255 / 0.13)' : colorWithAlpha(tokens.textMain, 0.18),
    '--text-main': tokens.textMain,
    '--text-soft': tokens.textSoft,
    '--text-muted': tokens.textMuted,
    '--accent-cyan': accent,
    '--accent-strong': tokens.accentStrong,
    '--accent-weak': colorWithAlpha(tokens.accentStrong, dark ? 0.28 : 0.22),
    '--accent-faint': colorWithAlpha(tokens.accentStrong, dark ? 0.12 : 0.1),
    '--accent-amber': tokens.accentAlt,
    '--accent-sage': colorWithAlpha(accent, 0.76),
    '--shell-shadow': dark
      ? 'inset 0 1px 0 rgb(255 255 255 / 0.08)'
      : `inset 0 1px 0 rgb(255 255 255 / 0.42), 0 0 0 1px ${colorWithAlpha(tokens.textMain, 0.03)}`,
    '--panel-shadow': dark
      ? '0 20px 70px rgb(0 0 0 / 0.28)'
      : `0 12px 32px ${colorWithAlpha(tokens.textMain, 0.1)}`,
    '--edge-shadow': dark
      ? 'drop-shadow(0 6px 14px rgb(0 0 0 / 0.18))'
      : `drop-shadow(0 4px 10px ${colorWithAlpha(tokens.textMain, 0.12)})`,
    '--edge-stroke': dark ? 'rgb(255 255 255 / 0.3)' : colorWithAlpha(tokens.textMain, 0.34),
    '--edge-stroke-soft': dark ? 'rgb(255 255 255 / 0.12)' : colorWithAlpha(tokens.textMain, 0.16),
  } as React.CSSProperties
}

function projectColorTokens(appearance: Pick<ProjectAppearance, 'canvasColor' | 'accentColor'> & Partial<Pick<ProjectAppearance, 'colorFormula' | 'colorMode'>>) {
  const formula = normalizeProjectColorFormula(appearance.colorFormula)
  const accentSeed = normalizeHexInput(appearance.accentColor || deriveAccentFromCanvas(appearance.canvasColor, formula))
  const preferredMode = appearance.colorMode ?? inferCanvasColorMode(appearance.canvasColor)
  const palette = accentThemeRecipe(accentSeed, formula, preferredMode)
  const canvas = palette.canvas
  const mode = inferCanvasColorMode(canvas)
  const dark = mode === 'dark'
  const accentToken = deriveAccentTokenFromAccent(accentSeed, canvas, formula)
  const textMain = readableTextColor(canvas, dark)
  return {
    mode,
    formula,
    canvas,
    canvasSurface: palette.canvasSurface,
    accent: accentToken.color,
    accentStrong: accentToken.strong,
    accentAlt: accentToken.alt,
    accentContrast: accentToken.contrast,
    accentSource: accentToken.source,
    mood: accentToken.mood,
    base: palette.base,
    surface1: palette.surface1,
    surface2: palette.surface2,
    surface3: palette.surface3,
    surfaceDrawer: palette.surfaceDrawer,
    surfaceInspector: palette.surfaceInspector,
    surfaceInset: palette.surfaceInset,
    nodeSurface: palette.nodeSurface,
    nodeSelected: palette.nodeSelected,
    textMain,
    textSoft: mixReadableText(textMain, canvas, dark ? 0.26 : 0.34),
    textMuted: mixReadableText(textMain, canvas, dark ? 0.48 : 0.55),
  }
}

function inferCanvasColorMode(color: string): ProjectColorMode {
  const oklch = converter('oklch')(normalizeHexInput(color))
  return (oklch?.l ?? 0.4) > 0.64 ? 'light' : 'dark'
}

function deriveAccentFromCanvas(color: string, formula: ProjectColorFormula = 'material') {
  return deriveAccentTokenFromCanvas(color, formula).color
}

function deriveCanvasFromAccent(accent: string, formula: ProjectColorFormula = 'material', preferredMode: ProjectColorMode = 'dark') {
  return accentThemeRecipe(accent, formula, preferredMode).canvas
}

function deriveAccentTokenFromAccent(accent: string, canvas: string, formula: ProjectColorFormula = 'material') {
  const accentOklch = converter('oklch')(normalizeHexInput(accent))
  if (!accentOklch) {
    return deriveAccentTokenFromCanvas(canvas, formula)
  }
  const recipe = accentThemeFormulaRecipe(formula)
  const mode = inferCanvasColorMode(canvas)
  const dark = mode === 'dark'
  const hue = normalizeHue(accentOklch.h ?? recipe.fallbackHue)
  const chroma = clamp(accentOklch.c ?? 0.12, recipe.accentMinChroma, recipe.accentMaxChroma)
  const color = formatHex({
    mode: 'oklch',
    l: dark ? recipe.accentDarkLightness : recipe.accentLightLightness,
    c: chroma,
    h: hue,
  })
  const strong = ensureAccentContrast(canvas, color, recipe.targetContrast)
  const alt = formatHex({
    mode: 'oklch',
    l: dark ? recipe.altDarkLightness : recipe.altLightLightness,
    c: clamp(chroma * recipe.altChromaScale, 0.055, 0.18),
    h: normalizeHue(hue + recipe.altHueOffset),
  })
  return {
    color,
    strong,
    alt,
    contrast: contrastRatio(canvas, strong),
    source: recipe.source,
    mood: `${recipe.label} ${mode} · accent seed`,
  }
}

function accentThemeRecipe(accent: string, formula: ProjectColorFormula, preferredMode: ProjectColorMode) {
  const accentOklch = converter('oklch')(normalizeHexInput(accent))
  const recipe = accentThemeFormulaRecipe(formula)
  const mode = preferredMode
  const dark = mode === 'dark'
  const hue = normalizeHue(accentOklch?.h ?? recipe.fallbackHue)
  const backgroundHue = normalizeHue(hue + recipe.backgroundHueOffset)
  const secondaryHue = normalizeHue(hue + recipe.secondaryHueOffset)
  const accentChroma = clamp(accentOklch?.c ?? 0.12, 0.06, recipe.accentMaxChroma)
  const backgroundChroma = clamp(accentChroma * recipe.backgroundChromaScale, dark ? 0.01 : 0.006, dark ? 0.034 : 0.026)
  const secondaryChroma = clamp(accentChroma * recipe.secondaryChromaScale, dark ? 0.012 : 0.008, dark ? 0.04 : 0.03)
  const lightness = dark
    ? { base: 0.095, canvas: 0.122, canvasSurface: 0.128, surface1: 0.158, surface2: 0.195, surface3: 0.24, inset: 0.18, node: 0.19, nodeSelected: 0.225 }
    : { base: 0.962, canvas: 0.925, canvasSurface: 0.918, surface1: 0.895, surface2: 0.86, surface3: 0.82, inset: 0.89, node: 0.89, nodeSelected: 0.855 }
  return {
    base: oklchHex(lightness.base, backgroundChroma * 0.62, backgroundHue),
    canvas: oklchHex(lightness.canvas, backgroundChroma, backgroundHue),
    canvasSurface: oklchHex(lightness.canvasSurface, backgroundChroma, backgroundHue),
    surface1: oklchHex(lightness.surface1, backgroundChroma * 1.05, backgroundHue),
    surface2: oklchHex(lightness.surface2, secondaryChroma, secondaryHue),
    surface3: oklchHex(lightness.surface3, secondaryChroma * 1.08, secondaryHue),
    surfaceDrawer: oklchHex(dark ? 0.148 : 0.905, backgroundChroma * 1.08, backgroundHue),
    surfaceInspector: oklchHex(dark ? 0.152 : 0.9, backgroundChroma, backgroundHue),
    surfaceInset: oklchHex(lightness.inset, secondaryChroma * 0.8, secondaryHue),
    nodeSurface: oklchHex(lightness.node, secondaryChroma * 0.86, secondaryHue),
    nodeSelected: oklchHex(lightness.nodeSelected, secondaryChroma, secondaryHue),
  }
}

function accentThemeFormulaRecipe(formula: ProjectColorFormula) {
  if (formula === 'fluent') {
    return {
      label: 'Fluent',
      source: 'analogous UI',
      backgroundHueOffset: 8,
      secondaryHueOffset: -14,
      backgroundChromaScale: 0.14,
      secondaryChromaScale: 0.18,
      accentDarkLightness: 0.74,
      accentLightLightness: 0.42,
      altDarkLightness: 0.68,
      altLightLightness: 0.46,
      altHueOffset: 32,
      altChromaScale: 0.78,
      accentMinChroma: 0.07,
      accentMaxChroma: 0.17,
      fallbackHue: 196,
      targetContrast: 4.4,
    }
  }
  if (formula === 'apple-glass') {
    return {
      label: 'Apple Glass',
      source: 'glass harmony',
      backgroundHueOffset: 18,
      secondaryHueOffset: 42,
      backgroundChromaScale: 0.095,
      secondaryChromaScale: 0.13,
      accentDarkLightness: 0.78,
      accentLightLightness: 0.44,
      altDarkLightness: 0.74,
      altLightLightness: 0.5,
      altHueOffset: 48,
      altChromaScale: 0.64,
      accentMinChroma: 0.06,
      accentMaxChroma: 0.14,
      fallbackHue: 184,
      targetContrast: 4.1,
    }
  }
  if (formula === 'carbon') {
    return {
      label: 'Carbon',
      source: 'complement UI',
      backgroundHueOffset: 178,
      secondaryHueOffset: 205,
      backgroundChromaScale: 0.16,
      secondaryChromaScale: 0.2,
      accentDarkLightness: 0.72,
      accentLightLightness: 0.38,
      altDarkLightness: 0.64,
      altLightLightness: 0.4,
      altHueOffset: 76,
      altChromaScale: 0.88,
      accentMinChroma: 0.08,
      accentMaxChroma: 0.19,
      fallbackHue: 220,
      targetContrast: 4.8,
    }
  }
  return {
    label: 'Material',
    source: 'tonal harmony',
    backgroundHueOffset: -6,
    secondaryHueOffset: 18,
    backgroundChromaScale: 0.17,
    secondaryChromaScale: 0.22,
    accentDarkLightness: 0.76,
    accentLightLightness: 0.4,
    altDarkLightness: 0.7,
    altLightLightness: 0.44,
    altHueOffset: -36,
    altChromaScale: 0.82,
    accentMinChroma: 0.08,
    accentMaxChroma: 0.2,
    fallbackHue: 176,
    targetContrast: 4.4,
  }
}

function deriveAccentTokenFromCanvas(color: string, formula: ProjectColorFormula = 'material') {
  const oklch = converter('oklch')(normalizeHexInput(color))
  if (!oklch) {
    return {
      color: '#84cdbc',
      strong: '#9edccd',
      alt: '#dfae67',
      contrast: 4.5,
      source: 'fallback',
      mood: 'balanced',
    }
  }
  const canvas = normalizeHexInput(color)
  const mode = inferCanvasColorMode(canvas)
  const dark = mode === 'dark'
  const canvasHue = normalizeHue(oklch.h ?? neutralHueFromCanvas(oklch))
  const canvasChroma = oklch.c ?? 0
  const isNeutral = canvasChroma < 0.04
  const recipe = colorFormulaRecipe(formula, canvasHue, oklch, isNeutral)
  const strategies = recipe.strategies
  const lightnessStops = dark ? recipe.darkLightness : recipe.lightLightness
  const chromaBase = clamp(canvasChroma + recipe.chromaBoost, recipe.minChroma, recipe.maxChroma)
  const chromaStops = [chromaBase, clamp(chromaBase - 0.035, 0.08, 0.2), clamp(chromaBase + 0.035, 0.1, 0.22)]
  let best = {
    color: dark ? '#8fd8ca' : '#2e6e68',
    contrast: 0,
    score: -Infinity,
    source: 'fallback',
    hue: canvasHue,
  }

  for (const strategy of strategies) {
    for (const lightness of lightnessStops) {
      for (const chroma of chromaStops) {
        const candidate = formatHex({
          mode: 'oklch',
          l: lightness,
          c: chroma,
          h: normalizeHue(strategy.hue),
        })
        const contrast = contrastRatio(canvas, candidate)
        const hueSeparation = Math.min(hueDistance(canvasHue, strategy.hue), 180) / 180
        const contrastScore = Math.min(contrast, 7) * 20
        const vividPenalty = Math.max(0, chroma - recipe.maxChroma) * 30
        const score = contrastScore + strategy.weight * 14 + hueSeparation * recipe.hueSeparationWeight - vividPenalty
        if (score > best.score) {
          best = {
            color: candidate,
            contrast,
            score,
            source: strategy.source,
            hue: normalizeHue(strategy.hue),
          }
        }
      }
    }
  }

  const strong = ensureAccentContrast(canvas, best.color, recipe.targetContrast)
  const alt = formatHex({
    mode: 'oklch',
    l: dark ? recipe.altDarkLightness : recipe.altLightLightness,
    c: clamp(chromaBase - 0.02, 0.08, 0.18),
    h: normalizeHue(best.hue + recipe.altHueOffset),
  })

  return {
    color: best.color,
    strong,
    alt,
    contrast: contrastRatio(canvas, strong),
    source: best.source,
    mood: `${recipe.label} ${describeCanvasMood(oklch, best.source)}`,
  }
}

function colorFormulaRecipe(
  formula: ProjectColorFormula,
  canvasHue: number,
  oklch: { l?: number; c?: number; h?: number },
  isNeutral: boolean,
) {
  if (formula === 'fluent') {
    const anchor = isNeutral ? neutralAccentStrategies(oklch)[0].hue : canvasHue + 168
    return {
      label: 'Fluent',
      strategies: [
        { source: 'brand accent', hue: anchor, weight: 1 },
        { source: 'brand hover', hue: anchor + 18, weight: 0.86 },
        { source: 'shared accent', hue: anchor - 28, weight: 0.78 },
      ],
      darkLightness: [0.74, 0.68, 0.8, 0.62],
      lightLightness: [0.4, 0.34, 0.46, 0.3],
      altDarkLightness: 0.66,
      altLightLightness: 0.42,
      altHueOffset: 30,
      chromaBoost: 0.075,
      minChroma: 0.08,
      maxChroma: 0.16,
      hueSeparationWeight: 6,
      targetContrast: 4.5,
    }
  }
  if (formula === 'apple-glass') {
    const anchor = isNeutral ? neutralAccentStrategies(oklch)[0].hue : canvasHue + 132
    return {
      label: 'Apple',
      strategies: [
        { source: 'system accent', hue: anchor, weight: 1 },
        { source: 'glass tint', hue: anchor + 46, weight: 0.72 },
        { source: 'selection tint', hue: anchor - 42, weight: 0.72 },
      ],
      darkLightness: [0.82, 0.76, 0.88, 0.7],
      lightLightness: [0.44, 0.38, 0.5, 0.34],
      altDarkLightness: 0.78,
      altLightLightness: 0.48,
      altHueOffset: 46,
      chromaBoost: 0.055,
      minChroma: 0.07,
      maxChroma: 0.13,
      hueSeparationWeight: 4,
      targetContrast: 4.1,
    }
  }
  if (formula === 'carbon') {
    const anchor = isNeutral ? 255 : canvasHue + 205
    return {
      label: 'Carbon',
      strategies: [
        { source: 'blue core', hue: anchor, weight: 1 },
        { source: 'support accent', hue: anchor + 78, weight: 0.76 },
        { source: 'data accent', hue: anchor - 62, weight: 0.72 },
      ],
      darkLightness: [0.7, 0.64, 0.76, 0.58],
      lightLightness: [0.36, 0.3, 0.42, 0.48],
      altDarkLightness: 0.62,
      altLightLightness: 0.38,
      altHueOffset: 76,
      chromaBoost: 0.105,
      minChroma: 0.1,
      maxChroma: 0.19,
      hueSeparationWeight: 10,
      targetContrast: 4.8,
    }
  }

  return {
    label: 'Material',
    strategies: isNeutral
      ? neutralAccentStrategies(oklch)
      : [
          { source: 'complement', hue: canvasHue + 180, weight: 1 },
          { source: 'split complement', hue: canvasHue + 150, weight: 0.96 },
          { source: 'split complement', hue: canvasHue + 210, weight: 0.96 },
          { source: 'triadic', hue: canvasHue + 120, weight: 0.82 },
          { source: 'triadic', hue: canvasHue + 240, weight: 0.82 },
          { source: 'analog contrast', hue: canvasHue + 70, weight: 0.68 },
        ],
    darkLightness: [0.76, 0.7, 0.82, 0.64],
    lightLightness: [0.42, 0.36, 0.5, 0.3],
    altDarkLightness: 0.7,
    altLightLightness: 0.46,
    altHueOffset: isNeutral ? 42 : -34,
    chromaBoost: 0.09,
    minChroma: 0.1,
    maxChroma: 0.2,
    hueSeparationWeight: 8,
    targetContrast: 4.4,
  }
}

function oklchHex(lightness: number, chroma: number, hue: number) {
  return formatHex({
    mode: 'oklch',
    l: clamp(lightness, 0.04, 0.98),
    c: clamp(chroma, 0, 0.24),
    h: normalizeHue(hue),
  })
}

function shiftColorLightness(color: string, delta: number) {
  const oklch = converter('oklch')(normalizeHexInput(color))
  if (!oklch) return normalizeHexInput(color)
  return formatHex({
    ...oklch,
    l: clamp((oklch.l ?? 0.5) + delta, 0.08, 0.96),
  })
}

function colorWithAlpha(color: string, alpha: number) {
  const rgb = converter('rgb')(color)
  if (!rgb) return `rgb(132 205 188 / ${alpha})`
  return `rgb(${Math.round((rgb.r ?? 0) * 255)} ${Math.round((rgb.g ?? 0) * 255)} ${Math.round((rgb.b ?? 0) * 255)} / ${alpha})`
}

function colorWithLightness(color: string, lightness: number) {
  const oklch = converter('oklch')(color)
  if (!oklch) return color
  return formatHex({ ...oklch, l: lightness })
}

function ensureAccentContrast(canvas: string, accent: string, target: number) {
  const accentOklch = converter('oklch')(accent)
  if (!accentOklch) return accent
  const dark = inferCanvasColorMode(canvas) === 'dark'
  const stops = dark ? [0.78, 0.84, 0.72, 0.9, 0.66] : [0.38, 0.32, 0.44, 0.28, 0.5]
  let best = accent
  let bestContrast = contrastRatio(canvas, accent)
  for (const lightness of stops) {
    const candidate = formatHex({ ...accentOklch, l: lightness })
    const contrast = contrastRatio(canvas, candidate)
    if (contrast > bestContrast) {
      best = candidate
      bestContrast = contrast
    }
    if (contrast >= target) return candidate
  }
  return best
}

function neutralHueFromCanvas(oklch: { l?: number; c?: number; h?: number }) {
  const hue = oklch.h
  if (typeof hue === 'number' && Number.isFinite(hue)) return hue
  return (oklch.l ?? 0.5) > 0.64 ? 168 : 196
}

function neutralAccentStrategies(oklch: { l?: number; c?: number; h?: number }) {
  const baseHue = neutralHueFromCanvas(oklch)
  const warmNeutral = typeof oklch.h === 'number' && oklch.h > 35 && oklch.h < 115
  const coolNeutral = typeof oklch.h === 'number' && oklch.h > 190 && oklch.h < 285
  const anchor = warmNeutral ? 205 : coolNeutral ? 38 : baseHue
  return [
    { source: warmNeutral ? 'cool counterpoint' : coolNeutral ? 'warm counterpoint' : 'quiet contrast', hue: anchor, weight: 1 },
    { source: 'split contrast', hue: anchor + 34, weight: 0.86 },
    { source: 'split contrast', hue: anchor - 38, weight: 0.86 },
    { source: 'soft tertiary', hue: anchor + 112, weight: 0.7 },
  ]
}

function describeCanvasMood(oklch: { l?: number; c?: number; h?: number }, source: string) {
  const lightness = oklch.l ?? 0.5
  const chroma = oklch.c ?? 0
  if (chroma < 0.035) return lightness > 0.64 ? 'quiet light' : 'quiet dark'
  if (chroma < 0.08) return source.includes('counterpoint') ? 'balanced' : 'muted'
  return lightness > 0.64 ? 'clear vivid' : 'deep vivid'
}

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360
}

function hueDistance(a: number, b: number) {
  const diff = Math.abs(normalizeHue(a) - normalizeHue(b))
  return Math.min(diff, 360 - diff)
}

function readableTextColor(background: string, dark: boolean) {
  const light = '#f4f1ea'
  const darkText = '#23211d'
  const lightContrast = contrastRatio(background, light)
  const darkContrast = contrastRatio(background, darkText)
  if (lightContrast >= 4.5 || darkContrast >= 4.5) return lightContrast > darkContrast ? light : darkText
  return dark ? light : darkText
}

function mixReadableText(text: string, background: string, backgroundWeight: number) {
  const textRgb = converter('rgb')(text)
  const backgroundRgb = converter('rgb')(background)
  if (!textRgb || !backgroundRgb) return text
  const mix = (foreground: number | undefined, base: number | undefined) =>
    ((foreground ?? 0) * (1 - backgroundWeight)) + ((base ?? 0) * backgroundWeight)
  return formatHex({
    mode: 'rgb',
    r: mix(textRgb.r, backgroundRgb.r),
    g: mix(textRgb.g, backgroundRgb.g),
    b: mix(textRgb.b, backgroundRgb.b),
  })
}

function mixColor(foreground: string, background: string, backgroundWeight: number) {
  return mixReadableText(foreground, background, backgroundWeight)
}

function contrastRatio(foreground: string, background: string) {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

function relativeLuminance(color: string) {
  const rgb = converter('rgb')(color)
  if (!rgb) return 0
  const linear = (value: number | undefined) => {
    const channel = clamp(value ?? 0, 0, 1)
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b)
}

function formatContrast(value: number) {
  return `${Math.max(1, value).toFixed(1)}:1 accent`
}

function cssTokenColor(token: string, fallback: string) {
  if (typeof document === 'undefined') return fallback
  const host = document.querySelector('.app-shell') ?? document.documentElement
  return getComputedStyle(host).getPropertyValue(token).trim() || fallback
}

function deleteDialogCopy(pendingDelete: PendingDelete) {
  if (pendingDelete.type === 'link') {
    return {
      title: 'Remove link?',
      body: `Remove "${pendingDelete.title}" from the graph.`,
      action: 'Remove',
    }
  }
  if (pendingDelete.type === 'diagram') {
    return {
      title: 'Delete diagram?',
      body: `Delete "${pendingDelete.title}" and its imported idea nodes from this project.`,
      action: 'Delete',
    }
  }
  if (pendingDelete.type === 'image') {
    return {
      title: 'Delete reference?',
      body: `Delete "${pendingDelete.title}" and its links from this project.`,
      action: 'Delete',
    }
  }
  return {
    title: `Delete ${pendingDelete.type}?`,
    body: `Delete "${pendingDelete.title}" from this project.`,
    action: 'Delete',
  }
}

function VersionHistoryDialog({
  isOpen,
  versionState,
  versions,
  onBranchCreate,
  onBranchSelect,
  onClose,
  onRestore,
  onSaveVersion,
}: {
  isOpen: boolean
  versionState: ProjectVersionState
  versions: ProjectVersionRecord[]
  onBranchCreate: (name: string) => void
  onBranchSelect: (branchId: string) => void
  onClose: () => void
  onRestore: (versionId: string) => void
  onSaveVersion: () => void
}) {
  const [branchName, setBranchName] = useState('')
  if (!isOpen) return null
  const activeBranch = versionState.branches.find((branch) => branch.id === versionState.currentBranchId) ?? versionState.branches[0]
  const activeBranchVersions = versions.filter((version) => (version.branchId ?? 'main') === activeBranch?.id)
  const visibleVersions = activeBranchVersions.length > 0 ? activeBranchVersions : versions.filter((version) => !version.branchId && activeBranch?.id === 'main')

  function submitBranch(event: React.FormEvent) {
    event.preventDefault()
    const value = branchName.trim()
    if (!value) return
    onBranchCreate(value)
    setBranchName('')
  }

  return (
    <div className="dialog-overlay">
      <section
        aria-labelledby="version-history-title"
        aria-modal="true"
        className="version-dialog"
        role="dialog"
      >
        <div className="version-dialog-header">
          <div>
            <h2 id="version-history-title">Version History</h2>
            <p>{versionState.branches.length} branch{versionState.branches.length === 1 ? '' : 'es'} · {versions.length} saved version{versions.length === 1 ? '' : 's'}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close version history" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="version-branch-browser">
          <aside className="version-branches" aria-label="Branches">
            {versionState.branches.map((branch) => (
              <button
                key={branch.id}
                className={branch.id === activeBranch?.id ? 'is-active' : ''}
                type="button"
                onClick={() => onBranchSelect(branch.id)}
              >
                <GitBranch size={13} />
                <span>{branch.name}</span>
                <small>{branch.headVersionId ? shortVersionId(branch.headVersionId) : 'no head'}</small>
              </button>
            ))}
            <form className="version-branch-form" onSubmit={submitBranch}>
              <input
                aria-label="New branch name"
                placeholder="New branch"
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
              />
              <button className="icon-button" type="submit" aria-label="Create branch">
                <Plus size={14} />
              </button>
            </form>
          </aside>
          <section className="version-browser-panel">
            <div className="version-browser-toolbar">
              <div>
                <strong>{activeBranch?.name ?? 'Branch'}</strong>
                <span>{visibleVersions.length} version{visibleVersions.length === 1 ? '' : 's'}</span>
              </div>
              <button className="quiet-button" type="button" onClick={onSaveVersion}>
                Save checkpoint
              </button>
            </div>
            <div className="version-list">
              {visibleVersions.length === 0 ? (
                <p className="empty-state">No saved versions on this branch</p>
              ) : (
                visibleVersions.map((version) => (
                  <article key={version.id} className="version-row">
                    <div>
                      <strong>{version.label}</strong>
                      <span>{formatVersionTime(version.createdAt)}</span>
                      <small>{formatVersionLineage(version)}</small>
                    </div>
                    <button className="quiet-button" type="button" onClick={() => onRestore(version.id)}>
                      Restore
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function LinkedList({
  count,
  emptyLabel,
  limit,
  renderItems,
}: {
  count: number
  emptyLabel: string
  limit: number
  renderItems: (limit: number) => React.ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const visibleLimit = isExpanded ? count : limit
  const hiddenCount = Math.max(0, count - limit)

  if (count === 0) {
    return <div className="linked-list-empty">{emptyLabel}</div>
  }

  return (
    <>
      <div className="linked-list" data-visible-count={Math.min(count, visibleLimit)}>
        {renderItems(visibleLimit)}
      </div>
      {hiddenCount > 0 && (
        <button className="linked-list-toggle" type="button" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
    </>
  )
}

function TagBlock({
  image,
  canRunOcr,
  canRefineTags,
  isOcrRunning,
  isRefiningTags,
  ocrStatus,
  modelStatus,
  onAddTag,
  onAcceptSuggestion,
  onRejectSuggestion,
  onRemoveTag,
  onRunOcr,
  onRefineTags,
}: {
  image: EvidenceImage
  canRunOcr: boolean
  canRefineTags: boolean
  isOcrRunning: boolean
  isRefiningTags: boolean
  ocrStatus?: string
  modelStatus?: string
  onAddTag: (tag: string) => void
  onAcceptSuggestion: (tag: string) => void
  onRejectSuggestion: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onRunOcr: () => void
  onRefineTags: () => void
}) {
  const [draftTag, setDraftTag] = useState('')

  function submitTag() {
    const tag = normalizeTag(draftTag)
    if (!tag) return
    onAddTag(tag)
    setDraftTag('')
  }

  return (
    <section className="inspector-card">
      <div className="section-heading tag-heading">
        <span>
          <Tag size={14} />
          Tags
        </span>
        <span className="section-tools">
          {canRunOcr && (
            <button className="section-tool" type="button" disabled={isOcrRunning} onClick={onRunOcr}>
              <Sparkles size={12} />
              {isOcrRunning ? 'Reading' : 'OCR'}
            </button>
          )}
          {canRefineTags && (
            <button className="section-tool" type="button" disabled={isRefiningTags} onClick={onRefineTags}>
              <Brain size={12} />
              {isRefiningTags ? 'Refining' : 'Refine'}
            </button>
          )}
        </span>
      </div>
      <div className="tag-cloud">
        {image.tags.map((tag) => (
          <span className="tag-chip" key={tag}>
            <Check size={12} />
            {tag}
            <button type="button" aria-label={`Remove ${tag}`} onClick={() => onRemoveTag(tag)}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-editor">
        <input
          aria-label="Add tag"
          value={draftTag}
          placeholder="Add tag"
          onChange={(event) => setDraftTag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitTag()
          }}
        />
        <button type="button" onClick={submitTag}>
          Add
        </button>
      </div>
      {image.suggestions.length > 0 && (
        <div className="suggestion-chips">
          {image.suggestions.map((suggestion) => {
            const label = suggestionLabel(suggestion)
            return (
              <span className="suggestion-chip" key={suggestionKey(suggestion)}>
                <button type="button" onClick={() => onAcceptSuggestion(label)}>
                  <Sparkles size={12} />
                  <span>{label}</span>
                  <small>{suggestionMeta(suggestion)}</small>
                </button>
                <button type="button" aria-label={`Reject ${label}`} onClick={() => onRejectSuggestion(label)}>
                  <X size={11} />
                </button>
              </span>
            )
          })}
        </div>
      )}
      {(ocrStatus || modelStatus) && <p className="tag-status">{[ocrStatus, modelStatus].filter(Boolean).join(' · ')}</p>}
    </section>
  )
}

function resolveSelection(
  selection: Selection,
  project: ProjectMetadata,
  appearance: ProjectAppearance,
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  palettes: PaletteNode[],
  diagrams: DiagramNode[],
  placeholders: PlaceholderNode[],
) {
  if (selection.type === 'project') {
    return { kind: 'project' as const, heading: 'File', project, appearance }
  }

  if (selection.type === 'idea') {
    const idea = ideas.find((candidate) => candidate.id === selection.id) ?? ideas[0]
    return { kind: 'idea' as const, heading: 'Idea', idea }
  }

  if (selection.type === 'image') {
    const image = images.find((candidate) => candidate.id === selection.id) ?? images[0]
    return { kind: 'image' as const, heading: 'Reference', image }
  }

  if (selection.type === 'palette') {
    const palette = palettes.find((candidate) => candidate.id === selection.id) ?? palettes[0]
    return { kind: 'palette' as const, heading: 'Palette', palette }
  }

  if (selection.type === 'diagram') {
    const diagram = diagrams.find((candidate) => candidate.id === selection.id) ?? diagrams[0]
    return { kind: 'diagram' as const, heading: 'Diagram', diagram }
  }

  if (selection.type === 'placeholder') {
    const placeholder = placeholders.find((candidate) => candidate.id === selection.id) ?? placeholders[0]
    return { kind: 'placeholder' as const, heading: 'Placeholder', placeholder }
  }

  const link = links.find((candidate) => candidate.id === selection.id) ?? links[0]
  const source = resolveGraphNodeRef(link.sourceNodeId ?? link.imageId, ideas, images, palettes, diagrams, placeholders)
  const target = resolveGraphNodeRef(link.targetNodeId ?? link.ideaId, ideas, images, palettes, diagrams, placeholders)
  const image = images.find((candidate) => candidate.id === link.imageId)
  const idea = ideas.find((candidate) => candidate.id === link.ideaId)
  return { kind: 'link' as const, heading: 'Link', link, source, target, image, idea }
}

function resolveGraphNodeRef(
  id: string,
  ideas: Idea[],
  images: EvidenceImage[],
  palettes: PaletteNode[] = [],
  diagrams: DiagramNode[] = [],
  placeholders: PlaceholderNode[] = [],
): GraphNodeRef | null {
  const idea = ideas.find((node) => node.id === id)
  if (idea) return { kind: 'idea', id: idea.id, title: idea.title, x: idea.x, y: idea.y }
  const image = images.find((node) => node.id === id)
  if (image) return { kind: 'image', id: image.id, title: image.title, x: image.x, y: image.y }
  const palette = palettes.find((node) => node.id === id)
  if (palette) return { kind: 'palette', id: palette.id, title: palette.title, x: palette.x, y: palette.y }
  const diagram = diagrams.find((node) => node.id === id)
  if (diagram) return { kind: 'diagram', id: diagram.id, title: diagram.title, x: diagram.x, y: diagram.y }
  const placeholder = placeholders.find((node) => node.id === id)
  if (placeholder) return { kind: 'placeholder', id: placeholder.id, title: placeholder.title, x: placeholder.x, y: placeholder.y }
  return null
}

function resolveGraphNodePosition(
  id: string,
  ideas: Idea[],
  images: EvidenceImage[],
  palettes: PaletteNode[] = [],
  diagrams: DiagramNode[] = [],
  placeholders: PlaceholderNode[] = [],
) {
  return ideas.find((node) => node.id === id)
    ?? images.find((node) => node.id === id)
    ?? palettes.find((node) => node.id === id)
    ?? diagrams.find((node) => node.id === id)
    ?? placeholders.find((node) => node.id === id)
    ?? null
}

function linkTouchesNode(link: EvidenceLink, kind: GraphNodeKind, id: string) {
  const sourceKind = link.sourceKind ?? 'image'
  const targetKind = link.targetKind ?? 'idea'
  const sourceId = link.sourceNodeId ?? link.imageId
  const targetId = link.targetNodeId ?? link.ideaId
  if (sourceKind === kind && sourceId === id) return true
  if (targetKind === kind && targetId === id) return true
  if (kind === 'image' && link.imageId === id) return true
  if (kind === 'idea' && link.ideaId === id) return true
  return false
}

function filterGraphView(
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  selected: Selection,
  scope: GraphScope,
  relationFilter: RelationFilter,
) {
  const relationLinks = relationFilter === 'all'
    ? links
    : links.filter((link) => link.relation === relationFilter)

  if (scope === 'selection') {
    const focusLinks = relationLinks.filter((link) => {
      if (isNodeSelection(selected)) return linkTouchesNode(link, selected.type, selected.id)
      if (selected.type === 'project') return true
      return link.id === selected.id
    })
    const ideaIds = new Set(focusLinks.flatMap((link) => [link.ideaId, link.sourceKind === 'idea' ? link.sourceNodeId : undefined, link.targetKind === 'idea' ? link.targetNodeId : undefined].filter(Boolean) as string[]))
    const imageIds = new Set(focusLinks.flatMap((link) => [link.imageId, link.sourceKind === 'image' ? link.sourceNodeId : undefined, link.targetKind === 'image' ? link.targetNodeId : undefined].filter(Boolean) as string[]))
    if (selected.type === 'idea') ideaIds.add(selected.id)
    if (selected.type === 'image') imageIds.add(selected.id)

    return {
      ideas: ideas.filter((idea) => ideaIds.has(idea.id)),
      images: images.filter((image) => imageIds.has(image.id)),
      links: focusLinks,
    }
  }

  if (scope === 'linked') {
    const linkedImageIds = new Set(relationLinks.map((link) => link.imageId))
    return {
      ideas,
      images: images.filter((image) => linkedImageIds.has(image.id)),
      links: relationLinks,
    }
  }

  return {
    ideas,
    images,
    links: relationLinks,
  }
}

function getSelectionNeighborhood(selected: Selection, links: EvidenceLink[]) {
  const ideaIds = new Set<string>()
  const imageIds = new Set<string>()
  const linkIds = new Set<string>()

  links.forEach((link) => {
    if (selected.type === 'project') return
    const source = link.sourceNodeId ?? link.imageId
    const target = link.targetNodeId ?? link.ideaId
    const matches = selected.type === 'idea'
      ? link.ideaId === selected.id || source === selected.id || target === selected.id
      : selected.type === 'image'
        ? link.imageId === selected.id || source === selected.id || target === selected.id
        : link.id === selected.id
    if (!matches) return
    ideaIds.add(link.ideaId)
    if (link.sourceKind === 'idea' && link.sourceNodeId) ideaIds.add(link.sourceNodeId)
    if (link.targetKind === 'idea' && link.targetNodeId) ideaIds.add(link.targetNodeId)
    imageIds.add(link.imageId)
    if (link.sourceKind === 'image' && link.sourceNodeId) imageIds.add(link.sourceNodeId)
    if (link.targetKind === 'image' && link.targetNodeId) imageIds.add(link.targetNodeId)
    linkIds.add(link.id)
  })

  return { ideaIds, imageIds, linkIds }
}

function capGraphView<T extends { ideas: Idea[]; images: EvidenceImage[]; links: EvidenceLink[] }>(
  view: T,
  selected: Selection,
  cap: GraphCap,
): T {
  const totalNodes = view.ideas.length + view.images.length
  if (totalNodes <= cap) return view

  const selectedNeighborhood = getSelectionNeighborhood(selected, view.links)
  const ideaIds = new Set(selectedNeighborhood.ideaIds)
  const imageIds = new Set(selectedNeighborhood.imageIds)

  if (selected.type === 'idea') ideaIds.add(selected.id)
  if (selected.type === 'image') imageIds.add(selected.id)
  if (selected.type === 'link') {
    const link = view.links.find((candidate) => candidate.id === selected.id)
    if (link) {
      ideaIds.add(link.ideaId)
      imageIds.add(link.imageId)
    }
  }

  function visibleCount() {
    return ideaIds.size + imageIds.size
  }

  for (const link of view.links) {
    if (visibleCount() >= cap) break
    ideaIds.add(link.ideaId)
    if (visibleCount() >= cap) break
    imageIds.add(link.imageId)
  }

  for (const idea of view.ideas) {
    if (visibleCount() >= cap) break
    ideaIds.add(idea.id)
  }

  for (const image of view.images) {
    if (visibleCount() >= cap) break
    imageIds.add(image.id)
  }

  const capped = {
    ...view,
    ideas: view.ideas.filter((idea) => ideaIds.has(idea.id)),
    images: view.images.filter((image) => imageIds.has(image.id)),
    links: view.links.filter((link) => ideaIds.has(link.ideaId) && imageIds.has(link.imageId)),
  }
  if ('suggestions' in capped && Array.isArray(capped.suggestions)) {
    return {
      ...capped,
      suggestions: capped.suggestions.filter((suggestion: DiscoverySuggestion) => (
        ideaIds.has(suggestion.ideaId) && imageIds.has(suggestion.imageId)
      )),
    } as T
  }

  return capped
}

function hasDiscoverySuggestions(
  view: { ideas: Idea[]; images: EvidenceImage[]; links: EvidenceLink[] },
): view is ReturnType<typeof buildDiscoveryGraphView> {
  return 'suggestions' in view && Array.isArray(view.suggestions)
}

function buildDiscoveryGraphView(ideas: Idea[], images: EvidenceImage[], links: EvidenceLink[]) {
  if (ideas.length === 0) {
    return { ideas, images, links, suggestions: [] as DiscoverySuggestion[] }
  }

  const ideaPositions = new Map<string, Pick<Idea, 'x' | 'y'>>()
  const radius = ideas.length <= 2 ? 24 : 27
  ideas.forEach((idea, index) => {
    const angle = ideas.length === 1 ? 0 : (-Math.PI / 2) + (index / ideas.length) * Math.PI * 2
    ideaPositions.set(idea.id, {
      x: clamp(50 + Math.cos(angle) * radius, 18, 82),
      y: clamp(48 + Math.sin(angle) * radius * 0.76, 18, 76),
    })
  })

  const ideaSignals = new Map<string, Set<string>>()
  ideas.forEach((idea) => {
    const linkedImages = links
      .filter((link) => link.ideaId === idea.id)
      .map((link) => images.find((image) => image.id === link.imageId))
      .filter((image): image is EvidenceImage => Boolean(image))
    ideaSignals.set(idea.id, new Set([
      ...tokenizeSignal(`${idea.title} ${idea.body}`),
      ...linkedImages.flatMap((image) => [...image.tags, ...image.suggestions.map(suggestionLabel)].flatMap(tokenizeSignal)),
    ]))
  })

  const explicitImageIdeas = new Map<string, string>()
  links
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .forEach((link) => {
      if (!explicitImageIdeas.has(link.imageId)) explicitImageIdeas.set(link.imageId, link.ideaId)
    })

  const suggestions: DiscoverySuggestion[] = []
  const imageGroups = new Map<string, EvidenceImage[]>()
  const unassignedImages: EvidenceImage[] = []

  images.forEach((image) => {
    const explicitIdeaId = explicitImageIdeas.get(image.id)
    if (explicitIdeaId) {
      imageGroups.set(explicitIdeaId, [...(imageGroups.get(explicitIdeaId) ?? []), image])
      return
    }

    const imageTokens = tokenizeReferenceSignal(image)
    const inferred = ideas
      .map((idea) => ({
        idea,
        score: scoreTokenOverlap(imageTokens, ideaSignals.get(idea.id) ?? new Set()),
      }))
      .sort((a, b) => b.score - a.score)[0]

    if (inferred && inferred.score >= 2) {
      suggestions.push({ imageId: image.id, ideaId: inferred.idea.id, score: inferred.score })
      imageGroups.set(inferred.idea.id, [...(imageGroups.get(inferred.idea.id) ?? []), image])
      return
    }

    unassignedImages.push(image)
  })

  const positionedImages = new Map<string, EvidenceImage>()
  ideas.forEach((idea) => {
    const group = imageGroups.get(idea.id) ?? []
    const center = ideaPositions.get(idea.id) ?? idea
    group.forEach((image, index) => {
      const angle = (-Math.PI / 2) + (index / Math.max(group.length, 1)) * Math.PI * 2
      const ring = 11 + (index % 3) * 4
      positionedImages.set(image.id, {
        ...image,
        x: clamp(center.x + Math.cos(angle) * ring, 7, 93),
        y: clamp(center.y + Math.sin(angle) * ring * 0.82, 9, 91),
      })
    })
  })

  unassignedImages.forEach((image, index) => {
    const angle = (-Math.PI / 2) + (index / Math.max(unassignedImages.length, 1)) * Math.PI * 2
    positionedImages.set(image.id, {
      ...image,
      x: clamp(50 + Math.cos(angle) * 39, 7, 93),
      y: clamp(50 + Math.sin(angle) * 31, 9, 91),
    })
  })

  return {
    ideas: ideas.map((idea) => ({ ...idea, ...(ideaPositions.get(idea.id) ?? {}) })),
    images: images.map((image) => positionedImages.get(image.id) ?? image),
    links,
    suggestions,
  }
}

function filterDiscoveryGraphView(
  view: ReturnType<typeof buildDiscoveryGraphView>,
  filter: DiscoveryFilter,
) {
  if (filter === 'all') return view

  const linkedImageIds = new Set(view.links.map((link) => link.imageId))
  const candidateImageIds = new Set(view.suggestions.map((suggestion) => suggestion.imageId))
  const visibleImageIds = filter === 'candidates'
    ? new Set([...linkedImageIds, ...candidateImageIds])
    : new Set(view.images.filter((image) => !linkedImageIds.has(image.id) && !candidateImageIds.has(image.id)).map((image) => image.id))

  const visibleIdeaIds = new Set<string>()
  view.links.forEach((link) => {
    if (visibleImageIds.has(link.imageId)) visibleIdeaIds.add(link.ideaId)
  })
  view.suggestions.forEach((suggestion) => {
    if (visibleImageIds.has(suggestion.imageId)) visibleIdeaIds.add(suggestion.ideaId)
  })

  return {
    ideas: view.ideas.filter((idea) => visibleIdeaIds.has(idea.id) || filter === 'open'),
    images: view.images.filter((image) => visibleImageIds.has(image.id)),
    links: view.links.filter((link) => visibleImageIds.has(link.imageId)),
    suggestions: view.suggestions.filter((suggestion) => visibleImageIds.has(suggestion.imageId)),
  }
}

function tokenizeReferenceSignal(image: EvidenceImage) {
  return new Set([
    ...tokenizeSignal(`${image.title} ${image.source}`),
    ...image.tags.flatMap(tokenizeSignal),
    ...image.suggestions.map(suggestionLabel).flatMap(tokenizeSignal),
  ])
}

function tokenizeSignal(value: string) {
  const stopWords = new Set([
    'and',
    'the',
    'with',
    'from',
    'that',
    'this',
    'into',
    'idea',
    'image',
    'reference',
  ])

  return normalizeTag(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token))
}

function scoreTokenOverlap(a: Set<string>, b: Set<string>) {
  let score = 0
  a.forEach((token) => {
    if (b.has(token)) score += 1
  })
  return score
}

function filterImages(images: EvidenceImage[], query: string, selectedTag: string | null, sortMode: SortMode) {
  const normalized = query.trim().toLowerCase()
  const filtered = images.filter((image) => {
    const tagMatch = selectedTag ? image.tags.includes(selectedTag) : true
    if (!normalized) return tagMatch

    const haystack = [image.title, image.source, ...image.tags, ...image.suggestions.map(suggestionLabel)].join(' ').toLowerCase()
    return tagMatch && haystack.includes(normalized)
  })

  return [...filtered].sort((a, b) => {
    if (sortMode === 'title') return a.title.localeCompare(b.title)
    if (sortMode === 'source') return a.source.localeCompare(b.source)
    return 0
  })
}

function getLibraryTags(images: EvidenceImage[]) {
  const counts = new Map<string, number>()
  images.forEach((image) => {
    image.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1))
  })

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag)
}

async function createReferenceFromFile(file: File, index: number): Promise<EvidenceImage> {
  const thumb = await readFileAsDataUrl(file)
  const analysis = await analyzeImageDataUrl(thumb)
  const tags = mergeUniqueTags(tagsFromFilename(file.name), analysis.tags)
  const slot = Math.max(0, index - imagesSeed.length)
  const column = Math.floor(slot / 5)
  const timestamp = nowIso()

  return {
    id: `img-import-${Date.now()}-${index}`,
    title: titleFromFilename(file.name),
    source: file.name,
    palette: analysis.palette.length > 0 ? analysis.palette : paletteFromName(file.name),
    tags,
    suggestions: createSuggestionRecords(mergeUniqueTags(suggestionsFromFile(file.name, tags), analysis.suggestions).slice(0, 5), 'local', 0.52),
    x: Math.max(62, 84 - column * 9),
    y: 18 + (slot % 5) * 14,
    thumb,
    importance: 1,
    createdAt: timestamp,
    addedAt: timestamp,
    updatedAt: timestamp,
    width: analysis.width,
    height: analysis.height,
    sizeBytes: file.size,
    mimeType: file.type,
    fingerprint: await fingerprintFile(file),
    perceptualHash: analysis.perceptualHash,
  }
}

function createReferenceFromUrl(url: URL, index: number): EvidenceImage {
  const displayUrl = url.toString()
  const fileName = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? url.hostname)
  const titleBase = fileName.includes('.') ? fileName : `${url.hostname} ${fileName}`
  const tags = tagsFromFilename(`${url.hostname} ${fileName}`)
  const slot = Math.max(0, index - imagesSeed.length)
  const column = Math.floor(slot / 5)
  const timestamp = nowIso()

  return {
    id: `img-url-${Date.now()}-${index}`,
    title: titleFromFilename(titleBase),
    source: displayUrl,
    palette: paletteFromName(displayUrl),
    tags: tags.length > 0 ? tags : ['url'],
    suggestions: createSuggestionRecords(['url capture', url.hostname, ...tags.slice(0, 2)].slice(0, 4), 'browser', 0.48),
    x: Math.max(62, 84 - column * 9),
    y: 18 + (slot % 5) * 14,
    thumb: displayUrl,
    importance: 1,
    createdAt: timestamp,
    addedAt: timestamp,
    updatedAt: timestamp,
    sourceUrl: displayUrl,
    fingerprint: fingerprintUrl(url),
  }
}

function createReferenceFromCapture(capture: KiraCapturePayload, index: number): EvidenceImage {
  const url = new URL(capture.url)
  const sourceText = capture.pageUrl || capture.source || capture.url
  const title = normalizeTitle(capture.title) || titleFromFilename(url.pathname.split('/').filter(Boolean).at(-1) ?? url.hostname)
  const sourceTags = tagsFromFilename(`${title} ${sourceText}`)
  const slot = Math.max(0, index - imagesSeed.length)
  const column = Math.floor(slot / 5)
  const timestamp = capture.capturedAt || nowIso()

  return {
    id: `img-browser-${Date.now()}-${index}`,
    title,
    source: sourceText,
    palette: paletteFromName(`${capture.kind}:${capture.url}`),
    tags: mergeUniqueTags(['browser', capture.kind, ...(capture.tags ?? [])], sourceTags.slice(0, 3)),
    suggestions: createSuggestionRecords(
      mergeUniqueTags(['browser capture', capture.kind === 'image' ? 'image capture' : 'page capture', url.hostname], sourceTags).slice(0, 5),
      'browser',
      0.58,
    ),
    x: Math.max(62, 84 - column * 9),
    y: 18 + (slot % 5) * 14,
    thumb: capture.kind === 'image' ? capture.url : capture.url,
    importance: 1,
    createdAt: timestamp,
    addedAt: nowIso(),
    updatedAt: nowIso(),
    sourceUrl: capture.url,
    notes: capture.note,
    fingerprint: `browser:${capture.kind}:${capture.url.toLowerCase()}`,
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

type LocalImageAnalysis = {
  palette: string[]
  tags: string[]
  suggestions: string[]
  perceptualHash?: string
  width?: number
  height?: number
}

function analyzeImageDataUrl(dataUrl: string): Promise<LocalImageAnalysis> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const width = image.naturalWidth
      const height = image.naturalHeight
      if (!width || !height) {
        resolve({ palette: [], tags: [], suggestions: [] })
        return
      }

      const canvas = document.createElement('canvas')
      const sampleSize = 32
      canvas.width = sampleSize
      canvas.height = sampleSize
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        resolve({ palette: [], tags: orientationTags(width, height), suggestions: [], width, height })
        return
      }

      context.drawImage(image, 0, 0, sampleSize, sampleSize)
      const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data
      const analysis = analyzePixels(pixels, width, height)
      resolve(analysis)
    }
    image.onerror = () => resolve({ palette: [], tags: [], suggestions: [] })
    image.src = dataUrl
  })
}

function analyzePixels(pixels: Uint8ClampedArray, width: number, height: number): LocalImageAnalysis {
  let red = 0
  let green = 0
  let blue = 0
  let count = 0
  const buckets = new Map<string, { red: number; green: number; blue: number; count: number }>()
  const lumaValues: number[] = []

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3]
    if (alpha < 20) continue
    const pixelRed = pixels[index]
    const pixelGreen = pixels[index + 1]
    const pixelBlue = pixels[index + 2]
    red += pixelRed
    green += pixelGreen
    blue += pixelBlue
    lumaValues.push(pixelRed * 0.299 + pixelGreen * 0.587 + pixelBlue * 0.114)
    count += 1

    const key = `${Math.round(pixelRed / 48)}:${Math.round(pixelGreen / 48)}:${Math.round(pixelBlue / 48)}`
    const bucket = buckets.get(key) ?? { red: 0, green: 0, blue: 0, count: 0 }
    bucket.red += pixelRed
    bucket.green += pixelGreen
    bucket.blue += pixelBlue
    bucket.count += 1
    buckets.set(key, bucket)
  }

  if (count === 0) return { palette: [], tags: orientationTags(width, height), suggestions: [], width, height }

  const average = {
    red: Math.round(red / count),
    green: Math.round(green / count),
    blue: Math.round(blue / count),
  }
  const brightness = (average.red * 299 + average.green * 587 + average.blue * 114) / 1000
  const palette = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((bucket) => rgbToHex(Math.round(bucket.red / bucket.count), Math.round(bucket.green / bucket.count), Math.round(bucket.blue / bucket.count)))

  const tags = mergeUniqueTags(
    orientationTags(width, height),
    [brightness < 88 ? 'dark' : brightness > 178 ? 'bright' : 'balanced light', colorFamilyTag(average.red, average.green, average.blue)],
  )

  return {
    palette,
    tags,
    suggestions: [`${width}x${height}`, brightness < 88 ? 'low key' : brightness > 178 ? 'high key' : 'mid tone'],
    perceptualHash: averageHash(lumaValues),
    width,
    height,
  }
}

function averageHash(lumaValues: number[]) {
  if (lumaValues.length === 0) return undefined
  const average = lumaValues.reduce((sum, value) => sum + value, 0) / lumaValues.length
  let bits = ''
  for (const value of lumaValues.slice(0, 64)) {
    bits += value >= average ? '1' : '0'
  }
  return `ahash:${BigInt(`0b${bits.padEnd(64, '0')}`).toString(16).padStart(16, '0')}`
}

function orientationTags(width: number, height: number) {
  const ratio = width / height
  if (ratio > 1.22) return ['landscape']
  if (ratio < 0.82) return ['portrait']
  return ['square']
}

function colorFamilyTag(red: number, green: number, blue: number) {
  if (Math.max(red, green, blue) - Math.min(red, green, blue) < 24) return 'neutral'
  if (red >= green && red >= blue) return green > blue ? 'warm' : 'magenta'
  if (green >= red && green >= blue) return blue > red ? 'cool green' : 'green'
  return red > green ? 'violet' : 'cool'
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function titleFromFilename(name: string) {
  return normalizeTitle(
    name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
  )
}

function normalizeTitle(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function tagsFromFilename(name: string) {
  const stopWords = new Set(['img', 'image', 'photo', 'screen', 'screenshot', 'copy', 'final'])
  const tokens = titleFromFilename(name)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token))

  return [...new Set(tokens)].slice(0, 4)
}

function suggestionsFromFile(name: string, tags: string[]) {
  const extension = name.split('.').at(-1)?.toLowerCase()
  const suggestions = ['local import', extension ? `${extension} file` : 'image file', ...tags.slice(0, 2)]
  return [...new Set(suggestions)].slice(0, 4)
}

function referenceModelContext(image: EvidenceImage) {
  return [
    `title: ${image.title}`,
    `source: ${image.source}`,
    `accepted tags: ${image.tags.join(', ') || 'none'}`,
    `suggestions: ${image.suggestions.map(suggestionLabel).join(', ') || 'none'}`,
    `palette: ${image.palette.join(', ') || 'none'}`,
  ].join('\n')
}

function mergeUniqueTags(...groups: string[][]) {
  return [...new Set(groups.flat().map(normalizeTag).filter(Boolean))]
}

function normalizeTag(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function suggestionLabel(suggestion: TagSuggestion) {
  return normalizeTag(typeof suggestion === 'string' ? suggestion : suggestion.label)
}

function suggestionKey(suggestion: TagSuggestion) {
  if (typeof suggestion === 'string') return suggestionLabel(suggestion)
  return `${suggestion.source}:${suggestionLabel(suggestion)}`
}

function suggestionMeta(suggestion: TagSuggestion) {
  if (typeof suggestion === 'string') return 'local'
  return `${suggestion.source} ${Math.round(suggestion.confidence * 100)}%`
}

function createSuggestionRecord(label: string, source: string, confidence: number): TagSuggestionRecord {
  return {
    label: normalizeTag(label),
    source,
    confidence: clamp(confidence, 0, 1),
    status: 'pending',
  }
}

function createSuggestionRecords(labels: string[], source: string, confidence: number): TagSuggestionRecord[] {
  return mergeUniqueTags(labels)
    .map((label) => createSuggestionRecord(label, source, confidence))
    .filter((suggestion) => Boolean(suggestion.label))
}

function mergeSuggestionRecords(current: TagSuggestion[], labels: string[], source: string, confidence: number) {
  const existing = new Set(current.map(suggestionLabel))
  const next = [...current]
  createSuggestionRecords(labels, source, confidence).forEach((suggestion) => {
    if (existing.has(suggestion.label)) return
    existing.add(suggestion.label)
    next.push(suggestion)
  })
  return next
}

function removeSuggestionByLabel(suggestions: TagSuggestion[], label: string) {
  const normalized = normalizeTag(label)
  return suggestions.filter((suggestion) => suggestionLabel(suggestion) !== normalized)
}

function parseCaptureUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url
  } catch {
    return null
  }
}

function extractDroppedReferencePayload(dataTransfer: DataTransfer): DroppedReferencePayload | null {
  const imageFile = [...dataTransfer.files].find((file) => file.type.startsWith('image/'))
  if (imageFile) return { kind: 'file', file: imageFile }

  const existingImageId = dataTransfer.getData('application/x-kira-image-id') || dataTransfer.getData('text/plain')
  if (existingImageId?.startsWith('img-')) return { kind: 'existing', imageId: existingImageId }

  const htmlUrl = extractImageUrlFromHtml(dataTransfer.getData('text/html'))
  if (htmlUrl) return { kind: 'url', url: htmlUrl, source: 'html' }

  const uriUrl = extractFirstUrlFromUriList(dataTransfer.getData('text/uri-list'))
  if (uriUrl) return { kind: 'url', url: uriUrl, source: 'uri-list' }

  const plainUrl = parseCaptureUrl(dataTransfer.getData('text/plain').trim())
  if (plainUrl) return { kind: 'url', url: plainUrl, source: 'plain' }

  return null
}

function hasDroppedReferencePayload(dataTransfer: DataTransfer) {
  return [...dataTransfer.files].some((file) => file.type.startsWith('image/'))
    || [...dataTransfer.types].some((type) => ['application/x-kira-image-id', 'text/html', 'text/uri-list', 'text/plain'].includes(type))
}

function extractFirstUrlFromUriList(value: string) {
  const first = value
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'))
  return first ? parseCaptureUrl(first) : null
}

function extractImageUrlFromHtml(value: string) {
  if (!value.trim()) return null
  try {
    const document = new DOMParser().parseFromString(value, 'text/html')
    const candidates = [
      document.querySelector('img[src]')?.getAttribute('src'),
      document.querySelector('source[srcset]')?.getAttribute('srcset')?.split(',')[0]?.trim().split(/\s+/)[0],
      document.querySelector('[src]')?.getAttribute('src'),
      document.querySelector('a[href]')?.getAttribute('href'),
    ].filter(Boolean) as string[]
    for (const candidate of candidates) {
      const parsed = parseCaptureUrl(candidate)
      if (parsed) return parsed
    }
  } catch {
    return null
  }
  return null
}

function parseKiraCapturePayload(value: string): KiraCapturePayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<KiraCapturePayload>
    if (parsed.kiraCapture !== 1) return null
    if (parsed.kind !== 'image' && parsed.kind !== 'page') return null
    if (typeof parsed.url !== 'string' || !parseCaptureUrl(parsed.url)) return null
    if (typeof parsed.title !== 'string' || typeof parsed.source !== 'string') return null
    return {
      kiraCapture: 1,
      kind: parsed.kind,
      url: parsed.url,
      title: parsed.title,
      source: parsed.source,
      pageUrl: typeof parsed.pageUrl === 'string' ? parsed.pageUrl : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
      note: typeof parsed.note === 'string' ? parsed.note : undefined,
      targetNode: isKiraCaptureNodeRef(parsed.targetNode) ? parsed.targetNode : undefined,
      createIdeaTitle: typeof parsed.createIdeaTitle === 'string' ? parsed.createIdeaTitle : undefined,
      captureIntent: parsed.captureIntent === 'undecided' || parsed.captureIntent === 'target-node' || parsed.captureIntent === 'create-or-select'
        ? parsed.captureIntent
        : undefined,
      capturedAt: typeof parsed.capturedAt === 'string' ? parsed.capturedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function isKiraCaptureNodeRef(value: unknown): value is CanvasNodeSelection {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CanvasNodeSelection>
  return typeof candidate.id === 'string' && isGraphNodeKind(candidate.kind)
}

function isGraphNodeKind(value: unknown): value is GraphNodeKind {
  return value === 'idea' || value === 'image' || value === 'palette' || value === 'diagram' || value === 'placeholder'
}

function parseKiraCapturePayloads(value: string) {
  const direct = parseKiraCapturePayload(value)
  if (direct) return [direct]

  return value
    .split('\n')
    .map((line) => parseKiraCapturePayload(line.trim()))
    .filter((capture): capture is KiraCapturePayload => Boolean(capture))
}

function createKiraCaptureContext(
  projectPackage: ProjectPackageInfo | null,
  ideas: Idea[],
  images: EvidenceImage[],
  palettes: PaletteNode[],
  diagrams: DiagramNode[],
  placeholders: PlaceholderNode[],
): KiraCaptureContext {
  return {
    app: 'kira',
    fileTitle: projectPackage?.path?.split('/').filter(Boolean).at(-1) ?? 'Unsaved KIRA file',
    filePath: projectPackage?.path,
    nodes: [
      ...ideas.map((idea) => ({
        kind: 'idea' as const,
        id: idea.id,
        title: idea.title,
        subtitle: idea.status,
        snippet: firstNonEmpty([idea.body, idea.notes, idea.sourceUrl]),
      })),
      ...images.map((image) => ({
        kind: 'image' as const,
        id: image.id,
        title: image.title,
        subtitle: image.source,
        snippet: firstNonEmpty([image.notes, image.sourceUrl, image.source]),
        thumb: image.thumb,
      })),
      ...palettes.map((palette) => ({
        kind: 'palette' as const,
        id: palette.id,
        title: palette.title,
        subtitle: `${palette.colors.length} colors`,
        snippet: firstNonEmpty([palette.notes, palette.sourceUrl]),
      })),
      ...diagrams.map((diagram) => ({
        kind: 'diagram' as const,
        id: diagram.id,
        title: diagram.title,
        subtitle: diagram.format,
        snippet: firstNonEmpty([diagram.notes, diagram.sourceUrl, diagram.source]),
      })),
      ...placeholders.map((placeholder) => ({
        kind: 'placeholder' as const,
        id: placeholder.id,
        title: placeholder.title,
        subtitle: placeholder.targetKind,
        snippet: firstNonEmpty([placeholder.notes, placeholder.sourceUrl]),
      })),
    ],
    updatedAt: nowIso(),
  }
}

function firstNonEmpty(values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim()
}

function fingerprintUrl(url: URL) {
  url.hash = ''
  return `url:${url.toString().toLowerCase()}`
}

function referenceFingerprint(image: EvidenceImage) {
  return image.fingerprint ?? (image.source.startsWith('http') ? `url:${image.source.toLowerCase()}` : `source:${image.source.toLowerCase()}`)
}

function referenceDuplicateKey(image: EvidenceImage) {
  return image.perceptualHash ?? referenceFingerprint(image)
}

function parsedAverageHash(value?: string) {
  const match = value?.match(/^ahash:([0-9a-f]{16})$/i)
  if (!match) return null
  return BigInt(`0x${match[1]}`)
}

function averageHashDistance(first?: string, second?: string) {
  const firstHash = parsedAverageHash(first)
  const secondHash = parsedAverageHash(second)
  if (firstHash === null || secondHash === null) return null

  let diff = firstHash ^ secondHash
  let distance = 0
  while (diff > 0n) {
    distance += Number(diff & 1n)
    diff >>= 1n
  }
  return distance
}

async function fingerprintFile(file: File) {
  if (!crypto.subtle) {
    return `file:${file.name}:${file.size}:${file.lastModified}`
  }

  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `sha256:${hash}`
}

function paletteFromName(name: string) {
  const hash = [...name].reduce((value, char) => value + char.charCodeAt(0), 0)
  return [colorFromHash(hash + 37), colorFromHash(hash + 89), colorFromHash(hash + 151)]
}

function colorFromHash(seed: number) {
  const hue = seed % 360
  return `hsl(${hue} 22% 48%)`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function smoothGraphEdge(source: Pick<GraphNodeRef, 'x' | 'y'>, target: Pick<GraphNodeRef, 'x' | 'y'>) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  const start = graphEdgePort(source, target)
  const end = graphEdgePort(target, source)
  const portDx = end.x - start.x
  const portDy = end.y - start.y
  const distance = Math.hypot(dx, dy) || 1
  const normalX = -dy / distance
  const normalY = dx / distance
  const bendDirection = source.x <= target.x ? 1 : -1
  const bend = clamp(distance * 0.16, 2.2, 7.8) * bendDirection
  const tension = clamp(distance * 0.36, 8, 26)
  const horizontalBias = Math.abs(dx) >= Math.abs(dy)
  const c1 = horizontalBias
    ? {
        x: start.x + Math.sign(dx || 1) * tension + normalX * bend,
        y: start.y + portDy * 0.08 + normalY * bend,
      }
    : {
        x: start.x + portDx * 0.12 + normalX * bend,
        y: start.y + Math.sign(dy || 1) * tension + normalY * bend,
      }
  const c2 = horizontalBias
    ? {
        x: end.x - Math.sign(dx || 1) * tension + normalX * bend,
        y: end.y - portDy * 0.08 + normalY * bend,
      }
    : {
        x: end.x - portDx * 0.12 + normalX * bend,
        y: end.y - Math.sign(dy || 1) * tension + normalY * bend,
      }
  const midX = cubicPoint(start.x, c1.x, c2.x, end.x, 0.5)
  const midY = cubicPoint(start.y, c1.y, c2.y, end.y, 0.5)
  return {
    path: `M ${formatEdgeNumber(start.x)} ${formatEdgeNumber(start.y)} C ${formatEdgeNumber(c1.x)} ${formatEdgeNumber(c1.y)}, ${formatEdgeNumber(c2.x)} ${formatEdgeNumber(c2.y)}, ${formatEdgeNumber(end.x)} ${formatEdgeNumber(end.y)}`,
    midX,
    midY,
  }
}

function graphEdgePort(node: Pick<GraphNodeRef, 'x' | 'y'>, other: Pick<GraphNodeRef, 'x' | 'y'>) {
  const dx = other.x - node.x
  const dy = other.y - node.y
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.25
  const verticalOffset = 4.2
  const horizontalOffset = 3.6

  return horizontal
    ? { x: node.x + Math.sign(dx || 1) * horizontalOffset, y: node.y }
    : { x: node.x, y: node.y + Math.sign(dy || 1) * verticalOffset }
}

function cubicPoint(start: number, controlA: number, controlB: number, end: number, t: number) {
  const inverse = 1 - t
  return inverse ** 3 * start
    + 3 * inverse ** 2 * t * controlA
    + 3 * inverse * t ** 2 * controlB
    + t ** 3 * end
}

function formatEdgeNumber(value: number) {
  return Number(value.toFixed(3))
}

function buildProjectDiagnostics(ideas: Idea[], images: EvidenceImage[], links: EvidenceLink[]): ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = []
  const linkCountByIdea = new Map<string, number>()
  const linkCountByImage = new Map<string, number>()

  links.forEach((link) => {
    linkCountByIdea.set(link.ideaId, (linkCountByIdea.get(link.ideaId) ?? 0) + 1)
    linkCountByImage.set(link.imageId, (linkCountByImage.get(link.imageId) ?? 0) + 1)
  })

  ideas
    .filter((idea) => (linkCountByIdea.get(idea.id) ?? 0) < 2)
    .forEach((idea) => {
      const count = linkCountByIdea.get(idea.id) ?? 0
      diagnostics.push({
        id: `weak-idea-${idea.id}`,
        label: 'Needs references',
        meta: `${idea.title} · ${count}/2 refs`,
        severity: 'warning',
        selection: { type: 'idea', id: idea.id },
      })
    })

  images
    .filter((image) => !image.thumb.trim())
    .forEach((image) => {
      diagnostics.push({
        id: `missing-thumb-${image.id}`,
        label: 'Missing asset',
        meta: image.title,
        severity: 'danger',
        selection: { type: 'image', id: image.id },
      })
    })

  images
    .filter((image) => (linkCountByImage.get(image.id) ?? 0) === 0)
    .forEach((image) => {
      diagnostics.push({
        id: `unlinked-${image.id}`,
        label: 'Unlinked reference',
        meta: image.title,
        severity: 'info',
        selection: { type: 'image', id: image.id },
      })
    })

  diagnostics.push(...buildDuplicateCandidateDiagnostics(images))

  const severityRank: Record<ProjectDiagnostic['severity'], number> = {
    danger: 0,
    warning: 1,
    info: 2,
  }
  return diagnostics.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.meta.localeCompare(b.meta))
}

function buildDuplicateCandidateDiagnostics(images: EvidenceImage[]): ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = []
  const diagnosedPairs = new Set<string>()
  const duplicateGroups = new Map<string, EvidenceImage[]>()

  images.forEach((image) => {
    const key = referenceDuplicateKey(image)
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), image])
  })
  duplicateGroups.forEach((group, key) => {
    if (group.length < 2) return
    const pairKey = group.slice(0, 2).map((image) => image.id).sort().join(':')
    diagnosedPairs.add(pairKey)
    diagnostics.push({
      id: `duplicate-${key}`,
      label: 'Duplicate candidates',
      meta: group.slice(0, 2).map((image) => image.title).join(' / '),
      severity: 'info',
      selection: { type: 'image', id: group[0].id },
    })
  })

  for (let firstIndex = 0; firstIndex < images.length; firstIndex += 1) {
    const first = images[firstIndex]
    for (let secondIndex = firstIndex + 1; secondIndex < images.length; secondIndex += 1) {
      const second = images[secondIndex]
      const pairKey = [first.id, second.id].sort().join(':')
      if (diagnosedPairs.has(pairKey)) continue

      const distance = averageHashDistance(first.perceptualHash, second.perceptualHash)
      if (distance === null || distance > duplicateCandidateThreshold) continue

      diagnosedPairs.add(pairKey)
      diagnostics.push({
        id: `near-duplicate-${first.id}-${second.id}`,
        label: 'Duplicate candidates',
        meta: `${first.title} / ${second.title} · ${distance} bit diff`,
        severity: 'info',
        selection: { type: 'image', id: first.id },
      })
    }
  }

  return diagnostics
}

function build3DGraphData(
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  palettes: PaletteNode[] = [],
  diagrams: DiagramNode[] = [],
  placeholders: PlaceholderNode[] = [],
) {
  const nodeIds = new Set([
    ...ideas.map((idea) => idea.id),
    ...images.map((image) => image.id),
    ...palettes.map((palette) => palette.id),
    ...diagrams.map((diagram) => diagram.id),
    ...placeholders.map((placeholder) => placeholder.id),
  ])

  return {
    nodes: [
      ...ideas.map((idea) => ({
        id: idea.id,
        kind: 'idea',
        name: idea.title,
        color: idea.status === 'strong' ? '#84cdbc' : idea.status === 'forming' ? '#dfae67' : '#b7a4df',
        palette: [idea.status === 'strong' ? '#84cdbc' : idea.status === 'forming' ? '#dfae67' : '#b7a4df'],
        importance: nodeImportance(idea.importance),
        val: (idea.status === 'strong' ? 8 : 6) * nodeImportance(idea.importance),
      })),
      ...images.map((image) => ({
        id: image.id,
        kind: 'image',
        name: image.title,
        color: image.palette[0] ?? '#b3afa5',
        palette: image.palette,
        thumb: image.thumb,
        importance: nodeImportance(image.importance),
        val: 3 * nodeImportance(image.importance),
      })),
      ...palettes.map((palette) => ({
        id: palette.id,
        kind: 'palette',
        name: palette.title,
        color: palette.colors[0] ?? '#84cdbc',
        palette: palette.colors,
        importance: nodeImportance(palette.importance),
        val: 4 * nodeImportance(palette.importance),
      })),
      ...diagrams.map((diagram) => ({
        id: diagram.id,
        kind: 'diagram',
        name: diagram.title,
        color: '#dfae67',
        palette: ['#dfae67', '#84cdbc'],
        importance: nodeImportance(diagram.importance),
        val: 5 * nodeImportance(diagram.importance),
      })),
      ...placeholders.map((placeholder) => ({
        id: placeholder.id,
        kind: 'placeholder',
        name: placeholder.title,
        color: '#7c817c',
        palette: ['#7c817c', '#242624'],
        importance: nodeImportance(placeholder.importance),
        val: 3 * nodeImportance(placeholder.importance),
      })),
    ],
    links: links
      .filter((link) => {
        const source = link.sourceNodeId ?? link.imageId
        const target = link.targetNodeId ?? link.ideaId
        return nodeIds.has(source) && nodeIds.has(target)
      })
      .map((link) => ({
        id: link.id,
        source: link.sourceNodeId ?? link.imageId,
        target: link.targetNodeId ?? link.ideaId,
        relation: link.relation,
        color: link.relation === 'supports' ? '#84cdbc' : link.relation === 'contrasts' ? '#b7a4df' : '#dfae67',
      })),
  }
}

function filter3DGraphDataByRelation(graphData: ReturnType<typeof build3DGraphData>, relationFilter: RelationFilter) {
  if (relationFilter === 'all') return graphData

  const links = graphData.links.filter((link) => link.relation === relationFilter)
  const connectedNodeIds = new Set<string>()
  links.forEach((link) => {
    connectedNodeIds.add(get3DGraphEndpointId(link.source))
    connectedNodeIds.add(get3DGraphEndpointId(link.target))
  })

  return {
    nodes: graphData.nodes.filter((node) => connectedNodeIds.has(node.id)),
    links,
  }
}

function filter3DGraphDataByScope(
  graphData: ReturnType<typeof build3DGraphData>,
  graphScope: GraphScope,
  selected: Selection,
) {
  if (graphScope === 'all') return graphData

  const connectedNodeIds = new Set<string>()
  const scopedLinks = graphData.links.filter((link) => {
    const sourceId = get3DGraphEndpointId(link.source)
    const targetId = get3DGraphEndpointId(link.target)
    const isSelectedLink = selected.type === 'link' && link.id === selected.id
    const isSelectedEndpoint = isNodeSelection(selected) && (sourceId === selected.id || targetId === selected.id)

    if (graphScope === 'selection' && !isSelectedLink && !isSelectedEndpoint) return false

    connectedNodeIds.add(sourceId)
    connectedNodeIds.add(targetId)
    return true
  })

  if (graphScope === 'selection' && isNodeSelection(selected)) connectedNodeIds.add(selected.id)

  return {
    nodes: graphData.nodes.filter((node) => connectedNodeIds.has(node.id)),
    links: scopedLinks,
  }
}

function clone3DGraphData(graphData: ReturnType<typeof build3DGraphData>) {
  return {
    nodes: graphData.nodes.map((node) => ({ ...node })),
    links: graphData.links.map((link) => ({ ...link })),
  }
}

function createGraph3DNodeObject(THREE: any, node: any, isSelected: boolean) {
  const textureScale = 3
  const displayWidth = node.kind === 'image' ? 256 : 288
  const displayHeight = node.kind === 'image' ? 170 : 92
  const canvas = document.createElement('canvas')
  canvas.width = displayWidth * textureScale
  canvas.height = displayHeight * textureScale
  const context = canvas.getContext('2d')
  if (!context) return undefined
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.scale(textureScale, textureScale)

  drawGraph3DNodeCanvas(context, { width: displayWidth, height: displayHeight }, node, isSelected)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  const importance = nodeImportance(node.importance)
  const width = node.kind === 'image' ? 36 * importance : 42 * importance
  const height = width * (displayHeight / displayWidth)
  sprite.scale.set(width, height, 1)

  if (node.kind === 'image' && typeof node.thumb === 'string' && node.thumb.length > 0) {
    void resolveThumbDataUrl(node.thumb).then((dataUrl) => {
      if (!dataUrl) return
      const image = new Image()
      image.onload = () => {
        drawGraph3DNodeCanvas(context, { width: displayWidth, height: displayHeight }, node, isSelected, image)
        texture.needsUpdate = true
      }
      image.onerror = () => undefined
      image.src = dataUrl
    })
  }

  return sprite
}

/**
 * Resolve any thumbnail URL (data:, blob:, asset://, http(s)) to a data URL so it can be drawn
 * onto a canvas texture without tainting the WebGL context. Returns null if it can't be loaded.
 */
async function resolveThumbDataUrl(src: string): Promise<string | null> {
  if (src.startsWith('data:')) return src
  try {
    const response = await fetch(src)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function drawGraph3DNodeCanvas(
  context: CanvasRenderingContext2D,
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
  node: any,
  isSelected: boolean,
  thumbnail?: HTMLImageElement,
) {
  const radius = node.kind === 'image' ? 18 : 22
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = isSelected ? 'rgba(217, 255, 246, 0.94)' : 'rgba(18, 20, 19, 0.88)'
  drawCanvasRoundRect(context, 0, 0, canvas.width, canvas.height, radius)
  context.fill()
  context.strokeStyle = isSelected ? 'rgba(132, 205, 188, 0.9)' : 'rgba(255, 255, 255, 0.18)'
  context.lineWidth = 3
  context.stroke()

  const textColor = isSelected ? '#101211' : '#f0f0ec'
  if (node.kind === 'image') {
    context.save()
    drawCanvasRoundRect(context, 14, 14, canvas.width - 28, 98, 12)
    context.clip()
    if (thumbnail) {
      context.drawImage(thumbnail, 14, 14, canvas.width - 28, 98)
    } else {
      const gradient = context.createLinearGradient(14, 14, canvas.width - 14, 112)
      gradient.addColorStop(0, node.palette?.[0] ?? node.color ?? '#84cdbc')
      gradient.addColorStop(1, node.palette?.[1] ?? '#232523')
      context.fillStyle = gradient
      context.fillRect(14, 14, canvas.width - 28, 98)
    }
    context.restore()

    const palette = Array.isArray(node.palette) && node.palette.length > 0 ? node.palette.slice(0, 5) : [node.color ?? '#84cdbc']
    palette.forEach((color: string, index: number) => {
      context.fillStyle = color
      context.fillRect(18 + index * 22, 120, 20, 10)
    })
    context.fillStyle = textColor
    context.font = '600 22px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    context.fillText(truncateCanvasText(context, node.name ?? 'Reference', 220), 16, 154)
    return
  }

  context.fillStyle = node.color ?? '#84cdbc'
  context.beginPath()
  context.arc(28, 34, 10, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = textColor
  context.font = '650 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.fillText(truncateCanvasText(context, node.name ?? 'Idea', 230), 48, 39)
  context.fillStyle = isSelected ? 'rgba(16, 18, 17, 0.72)' : 'rgba(240, 240, 236, 0.62)'
  context.font = '500 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  context.fillText(node.kind === 'diagram' ? 'Diagram' : node.kind === 'palette' ? 'Palette' : node.kind === 'placeholder' ? 'Placeholder' : 'Idea', 48, 64)
}

function drawCanvasRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}

function truncateCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) return value
  let text = value
  while (text.length > 4 && context.measureText(`${text}...`).width > maxWidth) {
    text = text.slice(0, -1)
  }
  return `${text.trim()}...`
}

function get3DGraphEndpointId(endpoint: unknown) {
  if (typeof endpoint === 'string' || typeof endpoint === 'number') return String(endpoint)
  if (endpoint && typeof endpoint === 'object' && 'id' in endpoint) {
    return String((endpoint as { id: unknown }).id)
  }
  return String(endpoint)
}

function is3DNodeSelected(selection: Selection, nodeId: string) {
  return isNodeSelection(selection) && selection.id === nodeId
}

function focus3DSelection(graph: any, selectedId: string) {
  const nodes = graph.graphData?.().nodes ?? []
  const node = nodes.find((candidate: any) => candidate.id === selectedId)
  focus3DNode(graph, node)
}

function focus3DNode(graph: any, node: any) {
  if (!node || typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') return

  const distance = 145
  const length = Math.hypot(node.x, node.y, node.z) || 1
  const ratio = 1 + distance / length
  graph.cameraPosition(
    { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
    { x: node.x, y: node.y, z: node.z },
    520,
  )
}

function get3DRelationLegend(links: ReturnType<typeof build3DGraphData>['links']) {
  const relationMap = new Map<Relation, { relation: Relation; color: string; count: number }>()
  links.forEach((link) => {
    const relation = link.relation as Relation
    const existing = relationMap.get(relation)
    if (existing) {
      existing.count += 1
      return
    }
    relationMap.set(relation, {
      relation,
      color: link.color,
      count: 1,
    })
  })

  return [...relationMap.values()].sort((a, b) => b.count - a.count || a.relation.localeCompare(b.relation))
}

function buildSlideLayouts(
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  palettes: PaletteNode[] = [],
  diagrams: DiagramNode[] = [],
): SlideLayout[] {
  const imageById = new Map(images.map((image) => [image.id, image]))
  const conceptSlides = [...ideas]
    .sort((a, b) => strengthRank(a.status) - strengthRank(b.status) || a.title.localeCompare(b.title))
    .map((idea) => {
      const ideaLinks = links.filter((link) => link.ideaId === idea.id)
      const references = ideaLinks
        .slice()
        .sort((a, b) => b.confidence - a.confidence || relationWeight(a.relation) - relationWeight(b.relation))
        .map((link) => imageById.get(link.imageId))
        .filter((image): image is EvidenceImage => Boolean(image))
        .slice(0, 6)
      const relationMix = getSlideRelationMix(ideaLinks)
      const relatedDiagrams = diagrams.filter((diagram) => diagram.nodeIds.includes(idea.id))
      const referenceIds = new Set(references.map((reference) => reference.id))
      const relatedPalettes = [
        ...palettes.filter((palette) => palette.sourceImageId && referenceIds.has(palette.sourceImageId)),
        ...palettes.filter((palette) => !palette.sourceImageId).slice(0, 1),
      ].slice(0, 3)
      const { layout, reason: layoutReason } = resolveSlideAutoLayout(idea, references, ideaLinks, relationMix, relatedPalettes, relatedDiagrams)
      const accent = relatedPalettes[0]?.colors[0] ?? references[0]?.palette[0] ?? (idea.status === 'strong' ? '#84cdbc' : idea.status === 'forming' ? '#dfae67' : '#b7a4df')

      return {
        id: `slide-${idea.id}`,
        kind: 'concept',
        idea,
        kicker: slideKicker(idea, references, relationMix),
        title: idea.title,
        summary: presentationSummary(idea.body, references, relationMix),
        speakerNote: speakerNoteForSlide(idea, references, relationMix, layoutReason),
        references,
        palettes: relatedPalettes,
        diagrams: relatedDiagrams,
        relationCount: ideaLinks.length,
        layout,
        layoutReason,
        relationMix,
        accent,
      } satisfies SlideLayout
    })
  if (conceptSlides.length === 0) return []

  const cover = buildCoverSlide(conceptSlides, ideas, images, palettes, diagrams)
  const moodboard = buildMoodboardSlide(conceptSlides, images, palettes, diagrams)
  return [cover, ...conceptSlides, ...(moodboard ? [moodboard] : [])]
}

function applySlideLayoutMode(slides: SlideLayout[], layoutMode: SlideLayoutMode) {
  if (layoutMode === 'auto') return slides
  return slides.map((slide) => ({
    ...slide,
    layout: slide.kind === 'concept' ? layoutMode : slide.layout,
    layoutReason: slide.kind === 'concept' ? `manual ${layoutMode}` : slide.layoutReason,
  }))
}

function applySlidesConfig(slides: SlideLayout[], config: SlidesConfig): SlideLayout[] {
  const customized = slides.map((slide) => {
    const custom = config.customizations[slide.id]
    if (!custom) return slide
    return {
      ...slide,
      layout: custom.layoutOverride ?? slide.layout,
      layoutReason: custom.layoutOverride ? `manual ${custom.layoutOverride}` : slide.layoutReason,
      title: custom.titleOverride ?? slide.title,
      summary: custom.summaryOverride ?? slide.summary,
      accent: custom.accentOverride ?? slide.accent,
    }
  })
  const visible = customized.filter((slide) => !config.customizations[slide.id]?.hidden)
  if (config.order.length === 0) return visible
  const byId = new Map(visible.map((slide) => [slide.id, slide]))
  const ordered: SlideLayout[] = []
  const used = new Set<string>()
  for (const id of config.order) {
    const slide = byId.get(id)
    if (slide && !used.has(id)) {
      ordered.push(slide)
      used.add(id)
    }
  }
  for (const slide of visible) {
    if (!used.has(slide.id)) ordered.push(slide)
  }
  return ordered
}

function applyDeckTemplate(deckMeta: SlideDeckMeta, template: SlidesConfig['template']): SlideDeckMeta {
  if (template === 'auto') return deckMeta
  return { ...deckMeta, template }
}

function stripHidden(customizations: Record<string, SlideCustomization>): Record<string, SlideCustomization> {
  const next: Record<string, SlideCustomization> = {}
  for (const [id, custom] of Object.entries(customizations)) {
    const { hidden: _hidden, ...rest } = custom
    next[id] = rest
  }
  return next
}

function buildSlideDeckMeta(slides: SlideLayout[]): SlideDeckMeta {
  const conceptSlides = slides.filter((slide) => slide.kind === 'concept')
  const referenceCount = uniqueReferences(slides.flatMap((slide) => slide.references)).length
  const diagramCount = slides.reduce((total, slide) => total + slide.diagrams.length, 0)
  const bodyWordCount = conceptSlides.reduce((total, slide) => total + countWords(slide.summary), 0)
  const averageReferences = conceptSlides.length === 0 ? 0 : referenceCount / conceptSlides.length
  const averageWords = conceptSlides.length === 0 ? 0 : bodyWordCount / conceptSlides.length
  const template: SlideDeckTemplate = diagramCount >= 3
    ? 'Timeline'
    : averageReferences >= 3.2
      ? 'Moodboard Grid'
      : averageReferences >= 1.4 && averageWords <= 34
        ? 'Editorial'
        : 'Minimal'
  const estimatedMinutes = Math.max(1, Math.ceil(slides.length * 0.5))
  return {
    template,
    estimatedDuration: `${estimatedMinutes} minute${estimatedMinutes === 1 ? '' : 's'}`,
    theme: {
      background: '#0d0f0e',
      accent: slides[0]?.accent ?? '#84cdbc',
      font: 'system-ui',
    },
  }
}

function buildCoverSlide(
  conceptSlides: SlideLayout[],
  ideas: Idea[],
  images: EvidenceImage[],
  palettes: PaletteNode[],
  diagrams: DiagramNode[],
): SlideLayout {
  const hero = selectHeroReference(images)
  const palette = palettes[0]
  const accent = palette?.colors[0] ?? hero?.palette[0] ?? conceptSlides[0]?.accent ?? '#84cdbc'
  return {
    id: 'slide-cover',
    kind: 'cover',
    kicker: `${ideas.length} directions · ${images.length} references`,
    title: coverSlideTitle(ideas),
    summary: coverSlideSummary(ideas, images, diagrams),
    speakerNote: `Open with the strongest thesis, then use ${conceptSlides.length} direction slides and the final board to move from argument to evidence.`,
    references: hero ? [hero, ...images.filter((image) => image.id !== hero.id).slice(0, 3)] : [],
    palettes: palette ? [palette] : [],
    diagrams: diagrams.slice(0, 1),
    relationCount: conceptSlides.reduce((total, slide) => total + slide.relationCount, 0),
    layout: 'cover',
    layoutReason: 'deck opener',
    relationMix: [],
    accent,
  }
}

function buildMoodboardSlide(
  conceptSlides: SlideLayout[],
  images: EvidenceImage[],
  palettes: PaletteNode[],
  diagrams: DiagramNode[],
): SlideLayout | null {
  const references = uniqueReferences(conceptSlides.flatMap((slide) => slide.references)).slice(0, 12)
  const fallbackReferences = references.length > 0 ? references : images.slice(0, 12)
  if (fallbackReferences.length === 0 && palettes.length === 0) return null
  return {
    id: 'slide-moodboard',
    kind: 'moodboard',
    kicker: 'Visual system',
    title: 'Moodboard',
    summary: moodboardSummary(fallbackReferences, palettes, diagrams),
    speakerNote: `Use this as the synthesis slide. Point to repeated colors, materials, image sources, and what should be removed before final presentation.`,
    references: fallbackReferences,
    palettes: palettes.slice(0, 4),
    diagrams: diagrams.slice(0, 2),
    relationCount: fallbackReferences.length,
    layout: 'moodboard',
    layoutReason: 'full board synthesis',
    relationMix: [],
    accent: palettes[0]?.colors[0] ?? fallbackReferences[0]?.palette[0] ?? '#84cdbc',
  }
}

function selectHeroReference(images: EvidenceImage[]) {
  return [...images].sort((a, b) => {
    const aPixels = (a.width ?? 0) * (a.height ?? 0)
    const bPixels = (b.width ?? 0) * (b.height ?? 0)
    return bPixels - aPixels
      || nodeImportance(b.importance) - nodeImportance(a.importance)
      || b.tags.length - a.tags.length
      || a.title.localeCompare(b.title)
  })[0]
}

function uniqueReferences(references: EvidenceImage[]) {
  const seen = new Set<string>()
  const unique: EvidenceImage[] = []
  references.forEach((reference) => {
    if (seen.has(reference.id)) return
    seen.add(reference.id)
    unique.push(reference)
  })
  return unique
}

function coverSlideTitle(ideas: Idea[]) {
  const strongest = [...ideas].sort((a, b) => strengthRank(a.status) - strengthRank(b.status) || a.title.localeCompare(b.title))[0]
  return strongest ? 'KIRA Direction Deck' : 'KIRA Deck'
}

function coverSlideSummary(ideas: Idea[], images: EvidenceImage[], diagrams: DiagramNode[]) {
  const strongCount = ideas.filter((idea) => idea.status === 'strong').length
  const visualText = images.length > 0 ? `${images.length} visual references` : 'no visual references yet'
  const diagramText = diagrams.length > 0 ? ` and ${diagrams.length} diagram${diagrams.length === 1 ? '' : 's'}` : ''
  return `A working deck from ${ideas.length} direction${ideas.length === 1 ? '' : 's'}, ${strongCount} strong thread${strongCount === 1 ? '' : 's'}, ${visualText}${diagramText}.`
}

function moodboardSummary(references: EvidenceImage[], palettes: PaletteNode[], diagrams: DiagramNode[]) {
  const tagCounts = new Map<string, number>()
  references.forEach((reference) => reference.tags.slice(0, 4).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)))
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([tag]) => tag)
  const tagText = topTags.length > 0 ? ` Recurring cues: ${topTags.join(', ')}.` : ''
  const paletteText = palettes.length > 0 ? ` ${palettes.length} palette${palettes.length === 1 ? '' : 's'} anchor the color story.` : ''
  const diagramText = diagrams.length > 0 ? ` ${diagrams.length} diagram${diagrams.length === 1 ? '' : 's'} carry structure.` : ''
  return `${references.length} references consolidated into one board.${tagText}${paletteText}${diagramText}`
}

function resolveSlideAutoLayout(
  idea: Idea,
  references: EvidenceImage[],
  links: EvidenceLink[],
  relationMix: Relation[],
  palettes: PaletteNode[],
  diagrams: DiagramNode[],
): { layout: SlideLayout['layout']; reason: string } {
  const referenceCount = references.length
  const bodyWordCount = countWords(idea.body)
  const supportCount = links.filter((link) => link.relation === 'supports' || link.relation === 'example').length
  const supportRatio = links.length === 0 ? 0 : supportCount / links.length
  const denseEvidence = referenceCount >= 5 || links.length >= 6
  const variedRelations = relationMix.length >= 3
  const textHeavy = bodyWordCount >= 22

  if (diagrams.length > 0) return { layout: 'diagram', reason: 'diagram structure' }
  if (palettes.length > 0 && referenceCount <= 4) return { layout: 'palette', reason: 'palette evidence' }
  if (referenceCount <= 1) return { layout: 'focus', reason: referenceCount === 0 ? 'needs evidence' : 'single anchor' }
  if (denseEvidence || (referenceCount >= 4 && (variedRelations || textHeavy))) {
    return { layout: 'stack', reason: variedRelations ? 'mixed evidence' : 'dense board' }
  }
  if (supportRatio >= 0.72 && referenceCount <= 3 && !textHeavy) {
    return { layout: 'focus', reason: 'hero support' }
  }
  return { layout: 'grid', reason: variedRelations ? 'relation compare' : 'balanced set' }
}

function getSlideRelationMix(links: EvidenceLink[]) {
  const relations = new Set<Relation>()
  links.forEach((link) => relations.add(link.relation))
  return [...relations].sort((a, b) => relationWeight(a) - relationWeight(b))
}

function slideKicker(idea: Idea, references: EvidenceImage[], relations: Relation[]) {
  if (references.length >= 4) return 'Evidence-led direction'
  if (relations.includes('contrasts')) return 'Tension to resolve'
  if (idea.status === 'strong') return 'Core direction'
  if (idea.status === 'forming') return 'Developing thread'
  return 'Open question'
}

function presentationSummary(body: string, references: EvidenceImage[], relations: Relation[]) {
  const cleaned = body.trim().replace(/\s+/g, ' ')
  const base = cleaned || 'This direction needs a clearer working thesis before it can carry the deck.'
  const sentences = base.match(/[^.!?]+[.!?]*/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [base]
  const trimmed = sentences.slice(0, 2).join(' ')
  if (references.length === 0) return `${trimmed} Add visual support before presenting this as a settled direction.`
  if (relations.includes('contrasts')) return `${trimmed} Use the contrast references to make the tension explicit.`
  return trimmed
}

function speakerNoteForSlide(idea: Idea, references: EvidenceImage[], relations: Relation[], layoutReason: string) {
  const relationText = relations.length > 0 ? formatRelationMix(relations) : 'no linked evidence yet'
  const supportText = references.length === 0
    ? 'Call out that this slide still needs source material.'
    : `Anchor the explanation in ${references.slice(0, 3).map((reference) => reference.title).join(', ')}.`
  return `${idea.title}: ${supportText} Relation mix: ${relationText}. Layout chosen for ${layoutReason}.`
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function formatRelationMix(relations: Relation[]) {
  return relations.length === 0 ? 'no relations' : relations.map((relation) => relationLabels[relation]).join(', ')
}

function strengthRank(status: Idea['status']) {
  if (status === 'strong') return 0
  if (status === 'forming') return 1
  return 2
}

function relationWeight(relation: Relation) {
  if (relation === 'supports') return 0
  if (relation === 'example') return 1
  if (relation === 'material') return 2
  if (relation === 'mood') return 3
  if (relation === 'reference') return 4
  return 5
}

function buildOutline(ideas: Idea[], images: EvidenceImage[], links: EvidenceLink[]): OutlineSection[] {
  return ideas.map((idea) => {
    const ideaLinks = links.filter((link) => link.ideaId === idea.id)
    const references = ideaLinks
      .map((link) => images.find((image) => image.id === link.imageId))
      .filter((image): image is EvidenceImage => Boolean(image))
    const relationText = ideaLinks.length > 0
      ? ideaLinks.map((link) => relationLabels[link.relation]).join(', ')
      : 'unverified direction'

    return {
      id: `outline-${idea.id}`,
      idea,
      title: idea.title,
      summary: `${idea.body} Current references indicate: ${relationText}.`,
      references,
      strength: references.length >= 2 ? 'strong' : references.length === 1 ? 'forming' : 'thin',
    }
  })
}

function createOutlineDraft(ideas: Idea[], images: EvidenceImage[], links: EvidenceLink[]): OutlineDraft {
  return {
    id: `outline-draft-${Date.now()}`,
    title: 'Outline',
    createdAt: new Date().toISOString(),
    sections: buildOutline(ideas, images, links).map((section) => ({
      id: section.id,
      ideaId: section.idea.id,
      title: section.title,
      summary: section.summary,
      referenceIds: section.references.map((reference) => reference.id),
      strength: section.strength,
    })),
  }
}

function outlineSectionsFromDraft(draft: OutlineDraft, ideas: Idea[], images: EvidenceImage[]): OutlineSection[] {
  return draft.sections.map((section) => {
    const idea = ideas.find((candidate) => candidate.id === section.ideaId) ?? {
      id: section.ideaId,
      title: section.title,
      body: '',
      status: section.strength,
      x: 50,
      y: 50,
    } satisfies Idea
    const references = section.referenceIds
      .map((referenceId) => images.find((image) => image.id === referenceId))
      .filter((image): image is EvidenceImage => Boolean(image))

    return {
      id: section.id,
      idea,
      title: section.title,
      summary: section.summary,
      references,
      strength: section.strength,
    }
  })
}

function formatDraftTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved draft'
  return `Saved ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function formatVersionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved version'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatVersionLineage(version: ProjectVersionRecord) {
  const trigger = version.trigger === 'restore' ? 'restore' : version.trigger ?? 'manual'
  const branch = version.branchId ?? 'main'
  const source = version.restoredFromId ? ` from ${shortVersionId(version.restoredFromId)}` : ''
  return `${branch} · ${trigger}${source}`
}

function formatNodeVersionMeta(version: NodeVersionRecord) {
  const date = new Date(version.createdAt)
  const time = Number.isNaN(date.getTime())
    ? 'Saved'
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const source = version.restoredFromId ? ` · from ${shortVersionId(version.restoredFromId)}` : ''
  return `${time} · ${nodeVersionTriggerLabel(version.trigger)}${source}`
}

function formatBranchName(branchId: string) {
  if (branchId === 'main') return 'Main'
  return branchId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ') || branchId
}

function uniqueBranchId(name: string, branches: ProjectBranchRecord[]) {
  const existing = new Set(branches.map((branch) => branch.id))
  const base = slugBranchId(name)
  let candidate = base
  let suffix = 2
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

function slugBranchId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `branch-${Date.now()}`
}

function defaultVersionState(versionHistory: ProjectVersionRecord[] = []): ProjectVersionState {
  const headVersionId = versionHistory[0]?.id
  return {
    schemaVersion: 1,
    currentBranchId: 'main',
    currentVersionId: headVersionId,
    branches: [{
      id: 'main',
      name: 'Main',
      createdAt: versionHistory.at(-1)?.createdAt ?? nowIso(),
      headVersionId,
    }],
  }
}

function normalizeVersionState(value: unknown, versionHistory: ProjectVersionRecord[] = []): ProjectVersionState {
  const candidate = value as Partial<ProjectVersionState> | null
  if (!candidate || candidate.schemaVersion !== 1 || typeof candidate.currentBranchId !== 'string' || !Array.isArray(candidate.branches)) {
    return defaultVersionState(versionHistory)
  }
  const branches = candidate.branches
    .filter((branch): branch is ProjectBranchRecord => (
      Boolean(branch)
      && typeof branch.id === 'string'
      && typeof branch.name === 'string'
      && typeof branch.createdAt === 'string'
    ))
  if (branches.length === 0) return defaultVersionState(versionHistory)
  const currentBranchId = branches.some((branch) => branch.id === candidate.currentBranchId)
    ? candidate.currentBranchId
    : branches[0].id
  return {
    schemaVersion: 1,
    currentBranchId,
    currentVersionId: typeof candidate.currentVersionId === 'string' ? candidate.currentVersionId : branches.find((branch) => branch.id === currentBranchId)?.headVersionId,
    branches,
  }
}

function advanceVersionState(current: ProjectVersionState, record: ProjectVersionRecord): ProjectVersionState {
  const branchId = record.branchId ?? current.currentBranchId
  const branches = current.branches.some((branch) => branch.id === branchId)
    ? current.branches.map((branch) => (branch.id === branchId ? { ...branch, headVersionId: record.id } : branch))
    : [...current.branches, {
        id: branchId,
        name: branchId === 'main' ? 'Main' : branchId,
        createdAt: record.createdAt,
        headVersionId: record.id,
      }]
  return {
    schemaVersion: 1,
    currentBranchId: branchId,
    currentVersionId: record.id,
    branches,
  }
}

function shortVersionId(versionId: string) {
  return versionId.replace(/^version-/, '').slice(0, 10)
}

function nowIso() {
  return new Date().toISOString()
}

function nodeImportance(value: number | undefined) {
  return clamp(value ?? 1, 0.25, 5)
}

function adjustImportance(value: number | undefined, delta: number) {
  return Number(clamp(nodeImportance(value) + delta, 0.25, 5).toFixed(2))
}

function nodeScale(value: number | undefined, densityScale = 1) {
  return Number(((0.78 + nodeImportance(value) * 0.15) * densityScale).toFixed(2))
}

function layoutDensityScale(nodeCount: number) {
  if (nodeCount <= 24) return 1
  if (nodeCount <= 64) return 0.62
  if (nodeCount <= 128) return 0.34
  if (nodeCount <= 220) return 0.28
  return 0.24
}

type LayoutNodeKind = 'idea' | 'image' | 'palette' | 'diagram' | 'placeholder'

type LayoutNodeEntry = {
  key: string
  kind: LayoutNodeKind
  id: string
  title: string
  importance?: number
  createdAt?: string
  updatedAt?: string
}

type LayoutMutableNode = (Idea | EvidenceImage | PaletteNode | DiagramNode | PlaceholderNode) & {
  x: number
  y: number
  updatedAt?: string
}

type LayoutNodePosition = {
  key: string
  x: number
  y: number
  width: number
  height: number
}

type LayoutCandidate = {
  positions: Map<string, LayoutNodePosition>
  score: number
  overlaps: number
  crossings: number
  span: number
}

type LayoutVerificationReport = {
  pass: boolean
  nodes: number
  links: number
  overlaps: number
  crossings: number
  span: number
}

async function organizeGraphLayout(
  mode: GraphOrganizeMode,
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  selected: Selection,
  palettes: PaletteNode[],
  diagrams: DiagramNode[],
  placeholders: PlaceholderNode[],
) {
  const timestamp = nowIso()
  const nextIdeas = ideas.map((idea) => ({ ...idea }))
  const nextImages = images.map((image) => ({ ...image }))
  const nextPalettes = palettes.map((palette) => ({ ...palette }))
  const nextDiagrams = diagrams.map((diagram) => ({ ...diagram }))
  const nextPlaceholders = placeholders.map((placeholder) => ({ ...placeholder }))
  const layoutNodes: LayoutNodeEntry[] = [
    ...nextIdeas.map((node) => ({ key: layoutKey('idea', node.id), kind: 'idea' as const, id: node.id, title: node.title, importance: node.importance, createdAt: node.createdAt, updatedAt: node.updatedAt })),
    ...nextImages.map((node) => ({ key: layoutKey('image', node.id), kind: 'image' as const, id: node.id, title: node.title, importance: node.importance, createdAt: node.createdAt, updatedAt: node.updatedAt })),
    ...nextPalettes.map((node) => ({ key: layoutKey('palette', node.id), kind: 'palette' as const, id: node.id, title: node.title, importance: node.importance, createdAt: node.createdAt, updatedAt: node.updatedAt })),
    ...nextDiagrams.map((node) => ({ key: layoutKey('diagram', node.id), kind: 'diagram' as const, id: node.id, title: node.title, importance: node.importance, createdAt: node.createdAt, updatedAt: node.updatedAt })),
    ...nextPlaceholders.map((node) => ({ key: layoutKey('placeholder', node.id), kind: 'placeholder' as const, id: node.id, title: node.title, importance: node.importance, createdAt: node.createdAt, updatedAt: node.updatedAt })),
  ]
  const densityScale = layoutDensityScale(layoutNodes.length)

  let layoutApplied = false
  try {
    const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
    const elk = new ELK()
    const sortedLayoutNodes = sortLayoutNodes(layoutNodes, mode, selected, links)
    const nodeKeySet = new Set(sortedLayoutNodes.map((node) => node.key))
    const directions = mode === 'timeline'
      ? ['RIGHT', 'DOWN', 'LEFT', 'UP']
      : ['DOWN', 'RIGHT', 'UP', 'LEFT']
    const candidates: LayoutCandidate[] = []

    for (const direction of directions) {
      const elkGraph = await elk.layout({
        id: `kira-canvas-${direction.toLowerCase()}`,
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': direction,
          'elk.layered.spacing.nodeNodeBetweenLayers': mode === 'flow' ? '112' : '92',
          'elk.spacing.nodeNode': mode === 'grid' ? '56' : '68',
          'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
          'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
          'elk.padding': '[top=48,left=48,bottom=48,right=48]',
        },
        children: sortedLayoutNodes.map((node) => ({
          id: node.key,
          width: layoutNodeWidth(node.kind, node.importance),
          height: layoutNodeHeight(node.kind, node.importance),
        })),
        edges: buildElkEdges(links, nodeKeySet),
      })
      const candidate = createLayoutCandidate(elkGraph.children ?? [], layoutNodes, links, densityScale)
      if (candidate) candidates.push(candidate)
      if (candidate && candidate.overlaps === 0 && candidate.crossings === 0) break
    }

    const best = candidates.sort((a, b) => a.score - b.score)[0]
    if (best && best.overlaps === 0 && best.crossings === 0) {
      applyLayoutPositions(best.positions, {
        ideas: nextIdeas,
        images: nextImages,
        palettes: nextPalettes,
        diagrams: nextDiagrams,
        placeholders: nextPlaceholders,
      }, timestamp)
      layoutApplied = true
    }
  } catch {
    layoutApplied = false
  }

  if (!layoutApplied) {
    const grouped = applyGroupedEvidenceLayout(nextIdeas, nextImages, links, timestamp)
    if (!grouped) applyFallbackPackedLayout(layoutNodes, {
      ideas: nextIdeas,
      images: nextImages,
      palettes: nextPalettes,
      diagrams: nextDiagrams,
      placeholders: nextPlaceholders,
    }, timestamp)
  }

  return {
    ideas: nextIdeas,
    images: nextImages,
    palettes: nextPalettes,
    diagrams: nextDiagrams,
    placeholders: nextPlaceholders,
  }
}

function layoutKey(kind: LayoutNodeKind, id: string) {
  return `${kind}:${id}`
}

function layoutNodeWidth(kind: LayoutNodeKind, importance: number | undefined) {
  const base = kind === 'idea' ? 190 : kind === 'image' ? 150 : 140
  return base + Math.min(nodeImportance(importance), 4) * 14
}

function layoutNodeHeight(kind: LayoutNodeKind, importance: number | undefined) {
  const base = kind === 'idea' ? 118 : kind === 'image' ? 138 : 104
  return base + Math.min(nodeImportance(importance), 4) * 8
}

function sortLayoutNodes(nodes: LayoutNodeEntry[], mode: GraphOrganizeMode, selected: Selection, links: EvidenceLink[]) {
  const linkCount = new Map<string, number>()
  links.forEach((link) => {
    const sourceKind = link.sourceKind ?? 'image'
    const targetKind = link.targetKind ?? 'idea'
    const source = layoutKey(sourceKind, link.sourceNodeId ?? link.imageId)
    const target = layoutKey(targetKind, link.targetNodeId ?? link.ideaId)
    linkCount.set(source, (linkCount.get(source) ?? 0) + 1)
    linkCount.set(target, (linkCount.get(target) ?? 0) + 1)
  })
  const selectedKey = isNodeSelection(selected) ? layoutKey(selected.type, selected.id) : ''
  return [...nodes].sort((a, b) => {
    if (a.key === selectedKey) return -1
    if (b.key === selectedKey) return 1
    if (mode === 'importance') return nodeImportance(b.importance) - nodeImportance(a.importance) || a.title.localeCompare(b.title)
    if (mode === 'timeline') {
      const aDate = new Date(a.createdAt || a.updatedAt || 0).getTime()
      const bDate = new Date(b.createdAt || b.updatedAt || 0).getTime()
      return aDate - bDate || a.title.localeCompare(b.title)
    }
    if (mode === 'palette') return layoutKindOrder(a.kind) - layoutKindOrder(b.kind) || a.title.localeCompare(b.title)
    return (linkCount.get(b.key) ?? 0) - (linkCount.get(a.key) ?? 0) || layoutKindOrder(a.kind) - layoutKindOrder(b.kind) || a.title.localeCompare(b.title)
  })
}

function layoutKindOrder(kind: LayoutNodeKind) {
  return ({ idea: 0, diagram: 1, palette: 2, image: 3, placeholder: 4 } satisfies Record<LayoutNodeKind, number>)[kind]
}

function buildElkEdges(links: EvidenceLink[], nodeKeySet: Set<string>) {
  const edges: Array<{ id: string; sources: string[]; targets: string[] }> = []
  links.forEach((link) => {
    const sourceKind = link.sourceKind ?? 'image'
    const targetKind = link.targetKind ?? 'idea'
    const source = layoutKey(sourceKind, link.sourceNodeId ?? link.imageId)
    const target = layoutKey(targetKind, link.targetNodeId ?? link.ideaId)
    if (!nodeKeySet.has(source) || !nodeKeySet.has(target) || source === target) return
    edges.push({ id: link.id, sources: [source], targets: [target] })
  })
  return edges
}

function createLayoutCandidate(
  children: Array<{ id?: string; x?: number; y?: number; width?: number; height?: number }>,
  layoutNodes: LayoutNodeEntry[],
  links: EvidenceLink[],
  densityScale: number,
): LayoutCandidate | null {
  const positions = children
    .filter((child): child is { id: string; x: number; y: number; width: number; height: number } => (
      typeof child.id === 'string'
      && typeof child.x === 'number'
      && typeof child.y === 'number'
      && typeof child.width === 'number'
      && typeof child.height === 'number'
    ))
  if (positions.length === 0) return null

  const maxX = Math.max(...positions.map((child) => child.x + child.width), 1)
  const maxY = Math.max(...positions.map((child) => child.y + child.height), 1)
  const entryByKey = new Map(layoutNodes.map((entry) => [entry.key, entry]))
  const mapped = new Map<string, LayoutNodePosition>()

  positions.forEach((position) => {
    const entry = entryByKey.get(position.id)
    if (!entry) return
    const minX = entry.kind === 'image' ? 5 : 8
    const maxPercentX = entry.kind === 'image' ? 95 : 92
    const minY = entry.kind === 'image' ? 6 : 8
    const maxPercentY = entry.kind === 'image' ? 94 : 92
    mapped.set(position.id, {
      key: position.id,
      x: clamp(8 + ((position.x + position.width / 2) / maxX) * 84, minX, maxPercentX),
      y: clamp(8 + ((position.y + position.height / 2) / maxY) * 84, minY, maxPercentY),
      width: layoutNodePercentWidth(entry.kind, entry.importance, densityScale),
      height: layoutNodePercentHeight(entry.kind, entry.importance, densityScale),
    })
  })

  if (mapped.size === 0) return null
  const overlaps = countLayoutOverlaps([...mapped.values()], densityScale)
  const crossings = countLayoutCrossings(links, mapped)
  const span = layoutSpan([...mapped.values()])
  return {
    positions: mapped,
    overlaps,
    crossings,
    span,
    score: overlaps * 10000 + crossings * 180 + span,
  }
}

function verifyGraphLayout(
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  palettes: PaletteNode[],
  diagrams: DiagramNode[],
  placeholders: PlaceholderNode[],
): LayoutVerificationReport {
  const layoutNodes: LayoutNodeEntry[] = [
    ...ideas.map((node) => ({ key: layoutKey('idea', node.id), kind: 'idea' as const, id: node.id, title: node.title, importance: node.importance })),
    ...images.map((node) => ({ key: layoutKey('image', node.id), kind: 'image' as const, id: node.id, title: node.title, importance: node.importance })),
    ...palettes.map((node) => ({ key: layoutKey('palette', node.id), kind: 'palette' as const, id: node.id, title: node.title, importance: node.importance })),
    ...diagrams.map((node) => ({ key: layoutKey('diagram', node.id), kind: 'diagram' as const, id: node.id, title: node.title, importance: node.importance })),
    ...placeholders.map((node) => ({ key: layoutKey('placeholder', node.id), kind: 'placeholder' as const, id: node.id, title: node.title, importance: node.importance })),
  ]
  const positions = new Map<string, LayoutNodePosition>()
  const densityScale = layoutDensityScale(layoutNodes.length)

  function add(kind: LayoutNodeKind, nodes: LayoutMutableNode[]) {
    nodes.forEach((node) => {
      const entry = layoutNodes.find((candidate) => candidate.key === layoutKey(kind, node.id))
      if (!entry) return
      positions.set(entry.key, {
        key: entry.key,
        x: node.x,
        y: node.y,
        width: layoutNodePercentWidth(kind, entry.importance, densityScale),
        height: layoutNodePercentHeight(kind, entry.importance, densityScale),
      })
    })
  }

  add('idea', ideas)
  add('image', images)
  add('palette', palettes)
  add('diagram', diagrams)
  add('placeholder', placeholders)

  const positionList = [...positions.values()]
  const overlaps = countLayoutOverlaps(positionList, densityScale)
  const crossings = countLayoutCrossings(links, positions)
  const span = layoutSpan(positionList)
  return {
    pass: overlaps === 0 && crossings === 0,
    nodes: positionList.length,
    links: links.length,
    overlaps,
    crossings,
    span,
  }
}

function applyLayoutPositions(
  positions: Map<string, LayoutNodePosition>,
  nodes: {
    ideas: Idea[]
    images: EvidenceImage[]
    palettes: PaletteNode[]
    diagrams: DiagramNode[]
    placeholders: PlaceholderNode[]
  },
  timestamp: string,
) {
  function place<T extends { id: string; x: number; y: number; updatedAt?: string }>(kind: LayoutNodeKind, items: T[]) {
    items.forEach((item) => {
      const position = positions.get(layoutKey(kind, item.id))
      if (!position) return
      item.x = position.x
      item.y = position.y
      item.updatedAt = timestamp
    })
  }

  place('idea', nodes.ideas)
  place('image', nodes.images)
  place('palette', nodes.palettes)
  place('diagram', nodes.diagrams)
  place('placeholder', nodes.placeholders)
}

function applyFallbackPackedLayout(
  layoutNodes: LayoutNodeEntry[],
  nodes: {
    ideas: Idea[]
    images: EvidenceImage[]
    palettes: PaletteNode[]
    diagrams: DiagramNode[]
    placeholders: PlaceholderNode[]
  },
  timestamp: string,
) {
  const byKey = new Map<string, LayoutMutableNode>()
  nodes.ideas.forEach((node) => byKey.set(layoutKey('idea', node.id), node))
  nodes.images.forEach((node) => byKey.set(layoutKey('image', node.id), node))
  nodes.palettes.forEach((node) => byKey.set(layoutKey('palette', node.id), node))
  nodes.diagrams.forEach((node) => byKey.set(layoutKey('diagram', node.id), node))
  nodes.placeholders.forEach((node) => byKey.set(layoutKey('placeholder', node.id), node))
  const densityScale = layoutDensityScale(layoutNodes.length)
  let cursorX = 8
  let cursorY = 10
  let rowHeight = 0

  layoutNodes.forEach((entry) => {
    const node = byKey.get(entry.key)
    if (!node) return
    const width = layoutNodePercentWidth(entry.kind, entry.importance, densityScale)
    const height = layoutNodePercentHeight(entry.kind, entry.importance, densityScale)
    if (cursorX + width / 2 > 94) {
      cursorX = 8
      cursorY += rowHeight + 5
      rowHeight = 0
    }
    node.x = clamp(cursorX + width / 2, 6, 94)
    node.y = clamp(cursorY + height / 2, 6, 94)
    node.updatedAt = timestamp
    cursorX += width + 4
    rowHeight = Math.max(rowHeight, height)
  })
}

function applyGroupedEvidenceLayout(
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  timestamp: string,
) {
  if (ideas.length === 0 || images.length === 0) return false
  const primaryIdeaByImage = new Map<string, string>()
  links.forEach((link) => {
    const sourceKind = link.sourceKind ?? 'image'
    const targetKind = link.targetKind ?? 'idea'
    if (sourceKind === 'image' && targetKind === 'idea' && !primaryIdeaByImage.has(link.imageId)) {
      primaryIdeaByImage.set(link.imageId, link.ideaId)
    }
  })
  if (primaryIdeaByImage.size === 0) return false

  const orderedIdeas = [...ideas].sort((a, b) => a.title.localeCompare(b.title))
  const totalNodes = ideas.length + images.length
  const densityScale = layoutDensityScale(totalNodes)
  const collisionGap = Math.max(0.32, 1.2 * densityScale)
  const imageWidth = layoutNodePercentWidth('image', undefined, densityScale)
  const imageHeight = layoutNodePercentHeight('image', undefined, densityScale)
  const ideaHeight = layoutNodePercentHeight('idea', undefined, densityScale)
  const xStart = 31
  const xEnd = 95
  const maxColumns = Math.max(1, Math.floor((xEnd - xStart) / (imageWidth + collisionGap)))
  const groups = new Map<string, EvidenceImage[]>()
  orderedIdeas.forEach((idea) => groups.set(idea.id, []))
  const unlinked: EvidenceImage[] = []
  images.forEach((image) => {
    const ideaId = primaryIdeaByImage.get(image.id)
    if (!ideaId || !groups.has(ideaId)) {
      unlinked.push(image)
      return
    }
    groups.get(ideaId)?.push(image)
  })

  const groupMetrics = orderedIdeas.map((idea) => {
    const group = groups.get(idea.id) ?? []
    const columns = Math.max(1, Math.min(maxColumns, Math.ceil(Math.sqrt(Math.max(group.length, 1) * 2))))
    const rows = Math.max(1, Math.ceil(group.length / columns))
    const bandHeight = Math.max(ideaHeight + collisionGap, rows * (imageHeight + collisionGap))
    return { idea, columns, rows, bandHeight }
  })
  const unlinkedColumns = Math.max(1, Math.min(maxColumns, Math.ceil(Math.sqrt(Math.max(unlinked.length, 1) * 2))))
  const unlinkedRows = unlinked.length === 0 ? 0 : Math.max(1, Math.ceil(unlinked.length / unlinkedColumns))
  const unlinkedBandHeight = unlinkedRows * (imageHeight + collisionGap)
  const availableHeight = 86
  const naturalHeight = groupMetrics.reduce((total, metric) => total + metric.bandHeight, 0) + unlinkedBandHeight
  const bandScale = naturalHeight > availableHeight ? availableHeight / naturalHeight : 1
  let cursorY = 7

  orderedIdeas.forEach((idea, index) => {
    const metric = groupMetrics[index]
    const bandHeight = metric.bandHeight * bandScale
    idea.x = 13
    idea.y = clamp(cursorY + bandHeight / 2, 6, 94)
    idea.updatedAt = timestamp
    cursorY += bandHeight
  })

  orderedIdeas.forEach((idea, ideaIndex) => {
    const group = groups.get(idea.id) ?? []
    const metric = groupMetrics[ideaIndex]
    const centerY = idea.y
    const columns = metric.columns
    const rows = metric.rows
    const xStep = columns === 1 ? 0 : (xEnd - xStart) / Math.max(columns - 1, 1)
    const yStep = Math.max(imageHeight + collisionGap, (metric.bandHeight * bandScale) / Math.max(rows, 1))
    const yStart = centerY - ((rows - 1) * yStep) / 2
    group
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((image, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        image.x = clamp(xStart + column * xStep, xStart, xEnd)
        image.y = clamp(yStart + row * yStep, 6, 94)
        image.updatedAt = timestamp
      })
  })

  if (unlinked.length > 0) {
    const bandHeight = unlinkedBandHeight * bandScale
    const centerY = cursorY + bandHeight / 2
    const xStep = unlinkedColumns === 1 ? 0 : (xEnd - xStart) / Math.max(unlinkedColumns - 1, 1)
    const yStep = Math.max(imageHeight + collisionGap, bandHeight / Math.max(unlinkedRows, 1))
    const yStart = centerY - ((unlinkedRows - 1) * yStep) / 2
    unlinked
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((image, index) => {
        const column = index % unlinkedColumns
        const row = Math.floor(index / unlinkedColumns)
        image.x = clamp(xStart + column * xStep, xStart, xEnd)
        image.y = clamp(yStart + row * yStep, 6, 94)
        image.updatedAt = timestamp
      })
  }

  return true
}

function layoutNodePercentWidth(kind: LayoutNodeKind, importance: number | undefined, densityScale = 1) {
  const extra = Math.min(nodeImportance(importance), 4) * 0.4
  const width = kind === 'idea' ? 12.5 + extra : kind === 'image' ? 6.4 + extra : 8.8 + extra
  return width * densityScale
}

function layoutNodePercentHeight(kind: LayoutNodeKind, importance: number | undefined, densityScale = 1) {
  const extra = Math.min(nodeImportance(importance), 4) * 0.32
  const height = kind === 'idea' ? 8.6 + extra : kind === 'image' ? 7.2 + extra : 5.9 + extra
  return height * densityScale
}

function countLayoutOverlaps(nodes: LayoutNodePosition[], densityScale = 1) {
  let overlaps = 0
  const padding = Math.max(0.18, 1.2 * densityScale)
  for (let index = 0; index < nodes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
      if (layoutRectsOverlap(nodes[index], nodes[otherIndex], padding)) overlaps += 1
    }
  }
  return overlaps
}

function layoutRectsOverlap(a: LayoutNodePosition, b: LayoutNodePosition, padding: number) {
  return Math.abs(a.x - b.x) * 2 < a.width + b.width + padding
    && Math.abs(a.y - b.y) * 2 < a.height + b.height + padding
}

function countLayoutCrossings(links: EvidenceLink[], positions: Map<string, LayoutNodePosition>) {
  const segments = links
    .map((link) => {
      const sourceKind = link.sourceKind ?? 'image'
      const targetKind = link.targetKind ?? 'idea'
      const source = positions.get(layoutKey(sourceKind, link.sourceNodeId ?? link.imageId))
      const target = positions.get(layoutKey(targetKind, link.targetNodeId ?? link.ideaId))
      if (!source || !target) return null
      return { source, target }
    })
    .filter((segment): segment is { source: LayoutNodePosition; target: LayoutNodePosition } => Boolean(segment))
  let crossings = 0
  for (let index = 0; index < segments.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < segments.length; otherIndex += 1) {
      const first = segments[index]
      const second = segments[otherIndex]
      if (
        first.source.key === second.source.key
        || first.source.key === second.target.key
        || first.target.key === second.source.key
        || first.target.key === second.target.key
      ) continue
      if (segmentsIntersect(first.source, first.target, second.source, second.target)) crossings += 1
    }
  }
  return crossings
}

function segmentsIntersect(a: LayoutNodePosition, b: LayoutNodePosition, c: LayoutNodePosition, d: LayoutNodePosition) {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)
  return abC * abD < 0 && cdA * cdB < 0
}

function orientation(a: LayoutNodePosition, b: LayoutNodePosition, c: LayoutNodePosition) {
  return Math.sign((b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y))
}

function layoutSpan(nodes: LayoutNodePosition[]) {
  if (nodes.length === 0) return 0
  const minX = Math.min(...nodes.map((node) => node.x - node.width / 2))
  const maxX = Math.max(...nodes.map((node) => node.x + node.width / 2))
  const minY = Math.min(...nodes.map((node) => node.y - node.height / 2))
  const maxY = Math.max(...nodes.map((node) => node.y + node.height / 2))
  return (maxX - minX) + (maxY - minY)
}

function hueFromHex(hex: string | undefined) {
  if (!hex) return 0
  const clean = hex.replace('#', '')
  if (clean.length < 6) return 0
  const red = Number.parseInt(clean.slice(0, 2), 16) / 255
  const green = Number.parseInt(clean.slice(2, 4), 16) / 255
  const blue = Number.parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  if (delta === 0) return 0
  if (max === red) return ((green - blue) / delta + (green < blue ? 6 : 0)) * 60
  if (max === green) return ((blue - red) / delta + 2) * 60
  return ((red - green) / delta + 4) * 60
}

function parseMermaidFlowchart(source: string) {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.replace(/%%.*$/, '').trim())
    .filter(Boolean)
  const title = lines.find((line) => /^(graph|flowchart)\s+/i.test(line))?.replace(/^(graph|flowchart)\s+/i, 'Mermaid ') || 'Mermaid diagram'
  const nodeMap = new Map<string, string>()
  const edges: { source: string; target: string; label?: string }[] = []
  const edgePattern = /^(.+?)\s*[-.=]+(?:\|([^|]+)\|)?[->ox.]+\s*(.+)$/

  function register(raw: string) {
    const cleaned = raw.trim().replace(/[;,]$/, '')
    const match = cleaned.match(/^([A-Za-z0-9_-]+)(?:\[(.+)\]|\((.+)\)|\{(.+)\}|"(.+)")?$/)
    if (!match) return cleaned
    const id = match[1]
    const explicitLabel = match[2] || match[3] || match[4] || match[5]
    if (explicitLabel || !nodeMap.has(id)) {
      nodeMap.set(id, normalizeMermaidLabel(explicitLabel || id))
    }
    return id
  }

  lines.forEach((line) => {
    if (/^(graph|flowchart)\s+/i.test(line)) return
    const edgeMatch = line.match(edgePattern)
    if (edgeMatch) {
      const sourceId = register(edgeMatch[1])
      const targetId = register(edgeMatch[3])
      edges.push({ source: sourceId, target: targetId, label: edgeMatch[2]?.trim() })
      return
    }
    register(line)
  })

  return {
    title,
    nodes: [...nodeMap.entries()].map(([id, label]) => ({ id, label })),
    edges,
  }
}

function normalizeMermaidLabel(value: string) {
  return value
    .replace(/^["']|["']$/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function generatePaletteHarmony(baseHex: string, harmony: PaletteHarmony) {
  const baseHsl = hexToHsl(baseHex)
  const hueSets: Record<PaletteHarmony, number[]> = {
    complementary: [0, 180, 180, 0, 0],
    analogous: [-32, -14, 0, 18, 36],
    triadic: [0, 120, 240, 120, 240],
    split: [0, 150, 210, 30, -30],
    monochrome: [0, 0, 0, 0, 0],
    shades: [0, 0, 0, 0, 0],
  }
  const lightnessSteps: Record<PaletteHarmony, number[]> = {
    complementary: [0, 0.04, -0.08, 0.16, -0.18],
    analogous: [-0.08, 0.02, 0, 0.08, -0.14],
    triadic: [0, 0.02, 0.04, -0.12, 0.16],
    split: [0, 0.04, -0.02, 0.12, -0.16],
    monochrome: [-0.22, -0.1, 0, 0.12, 0.24],
    shades: [-0.32, -0.16, 0, 0.16, 0.3],
  }
  const toOklch = converter('oklch')
  return hueSets[harmony].map((offset, index) => {
    const hex = hslToHex({
      h: (baseHsl.h + offset + 360) % 360,
      s: harmony === 'monochrome' || harmony === 'shades' ? baseHsl.s * (0.7 + index * 0.06) : baseHsl.s,
      l: clamp(baseHsl.l + lightnessSteps[harmony][index], 0.12, 0.88),
    })
    const oklchColor = toOklch(hex)
    return oklchColor ? formatHex(oklchColor) : hex
  })
}

function hexToHsl(hex: string) {
  const hslMatch = hex.match(/^hsl\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*\)$/i)
  if (hslMatch) {
    return {
      h: Number.parseFloat(hslMatch[1]) % 360,
      s: clamp(Number.parseFloat(hslMatch[2]) / 100, 0, 1),
      l: clamp(Number.parseFloat(hslMatch[3]) / 100, 0, 1),
    }
  }
  const clean = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(clean)) return { h: 176, s: 0.34, l: 0.66 }
  const red = Number.parseInt(clean.slice(0, 2), 16) / 255
  const green = Number.parseInt(clean.slice(2, 4), 16) / 255
  const blue = Number.parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { h: 0, s: 0, l: lightness }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60
  else if (max === green) hue = ((blue - red) / delta + 2) * 60
  else hue = ((red - green) / delta + 4) * 60
  return { h: hue, s: saturation, l: lightness }
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const match = l - chroma / 2
  const [red, green, blue] = h < 60
    ? [chroma, x, 0]
    : h < 120
      ? [x, chroma, 0]
      : h < 180
        ? [0, chroma, x]
        : h < 240
          ? [0, x, chroma]
          : h < 300
            ? [x, 0, chroma]
            : [chroma, 0, x]
  const toHex = (value: number) => Math.round((value + match) * 255).toString(16).padStart(2, '0')
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function toProjectSnapshot(
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  outlineDrafts: OutlineDraft[] = [],
  palettes: PaletteNode[] = [],
  diagrams: DiagramNode[] = [],
  placeholders: PlaceholderNode[] = [],
  aiSettings: AiSettingsSnapshot = defaultAiSettingsSnapshot(),
  versionHistory: ProjectVersionRecord[] = [],
  versionState: ProjectVersionState = defaultVersionState(versionHistory),
  nodeVersions: NodeVersionRecord[] = [],
  project: ProjectMetadata = defaultProjectMetadata(),
  appearance: ProjectAppearance = defaultProjectAppearance(),
  slidesConfig: SlidesConfig = defaultSlidesConfig(),
): ProjectSnapshot {
  return {
    version: 2,
    project,
    appearance,
    ideas,
    images,
    palettes,
    diagrams,
    placeholders,
    aiSettings,
    versionState,
    versionHistory,
    nodeVersions,
    links,
    outlineDrafts,
    slidesConfig,
  }
}

function createTemplateIdea(
  id: string,
  title: string,
  body: string,
  x: number,
  y: number,
  status: Idea['status'] = 'forming',
  importance = 1,
): Idea {
  const timestamp = nowIso()
  return {
    id,
    title,
    body,
    status,
    x,
    y,
    importance,
    createdAt: timestamp,
    addedAt: timestamp,
    updatedAt: timestamp,
  }
}

function createTemplateLink(id: string, sourceId: string, targetId: string, relation: Relation, note: string): EvidenceLink {
  const timestamp = nowIso()
  return {
    id,
    imageId: '',
    ideaId: targetId,
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    sourceKind: 'idea',
    targetKind: 'idea',
    relation,
    note,
    confidence: 0.74,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function templateProjectMetadata(template: ProjectTemplateId, prompt?: string): ProjectMetadata {
  const definition = projectTemplateDefinitions.find((candidate) => candidate.id === template)
  if (template === 'welcome') {
    return {
      title: 'Welcome.kira',
      description: 'Guided starter project for KIRA canvas, library, capture, and AI workflow.',
      author: '',
      kind: 'ideaboard',
      styleNote: 'Use this board as a working map, not a static tutorial.',
    }
  }
  return {
    title: definition?.title ?? 'KIRA Project',
    description: prompt?.trim() || definition?.promptSeed || 'Creative workspace file.',
    author: '',
    kind: template === 'moodboard_food_photo' ? 'moodboard' : 'ideaboard',
    styleNote: 'Start with these nodes, then attach references and generate branches as the project clarifies.',
  }
}

function createProjectTemplateSnapshot(template: ProjectTemplateId, aiSettings: AiSettingsSnapshot = defaultAiSettingsSnapshot()): ProjectSnapshot {
  const timestamp = Date.now()
  const prefix = `template-${template}-${timestamp}`
  const makeId = (slug: string) => `${prefix}-${slug}`
  let ideas: Idea[] = []
  let links: EvidenceLink[] = []

  if (template === 'welcome') {
    const canvas = makeId('canvas')
    const library = makeId('library')
    const ai = makeId('ai')
    const capture = makeId('capture')
    const templates = makeId('templates')
    const arc = makeId('arc-ai')
    ideas = [
      createTemplateIdea(canvas, 'Canvas board', 'The canvas is the working surface. Add ideas, images, palettes, diagrams, and placeholders, then connect them with visible relations.', 48, 34, 'strong', 1.2),
      createTemplateIdea(library, 'Library drawer', 'Images, links, and text captures live in the left drawer. Drag references into the board when they become part of the argument.', 22, 46),
      createTemplateIdea(ai, 'AI setup', 'Connect OpenAI or Anthropic with API keys, or use local providers. ChatGPT and Claude subscriptions are separate from API billing.', 48, 58, 'forming', 1.08),
      createTemplateIdea(capture, 'Browser capture', 'Install the Chrome or Safari extension to send images, URLs, and selected text into KIRA from the browser.', 74, 46),
      createTemplateIdea(templates, 'Templates and zero-state', 'New empty boards can start from templates or a prompt. Templates create editable nodes, not locked documents.', 32, 72),
      createTemplateIdea(arc, 'AI node generation', 'Use the + button on a node to open the arc menu. AI actions can summarize, break down, synthesize, find gaps, or generate variations from a chosen scope.', 64, 72),
    ]
    links = [
      createTemplateLink(makeId('link-library'), canvas, library, 'contains', 'Library material becomes canvas evidence.'),
      createTemplateLink(makeId('link-ai'), canvas, ai, 'supports', 'AI setup powers generated node branches.'),
      createTemplateLink(makeId('link-capture'), capture, library, 'supports', 'Browser capture fills the library.'),
      createTemplateLink(makeId('link-template'), templates, canvas, 'contains', 'Templates are editable starting boards.'),
      createTemplateLink(makeId('link-arc'), arc, ai, 'derived-from', 'Arc-menu AI actions route through configured providers.'),
    ]
  } else {
    const templateNodes: Record<Exclude<ProjectTemplateId, 'welcome'>, Array<[string, string, string, number, number, Idea['status']?, number?]>> = {
      moodboard_food_photo: [
        ['mood', 'Appetite mood', 'Define the sensory feeling: fresh, indulgent, rustic, precise, playful, or editorial.', 28, 32, 'strong', 1.15],
        ['light', 'Lighting direction', 'Decide daylight, flash, hard shadow, tabletop glow, steam, condensation, and contrast.', 54, 26],
        ['plate', 'Plating and surface', 'Capture plate geometry, garnish rhythm, table material, negative space, and portion scale.', 72, 42],
        ['props', 'Props and hand cues', 'List utensils, linen, ingredient spill, hand interaction, packaging, and background logic.', 38, 58],
        ['shot', 'Shot list', 'Plan hero, detail, process, ingredient, menu context, and social crop variations.', 62, 70],
      ],
      brand_identity: [
        ['promise', 'Brand promise', 'State the single promise the identity must make believable.', 26, 34, 'strong', 1.18],
        ['audience', 'Audience signal', 'Define who should feel recognized and what cues they already trust.', 52, 26],
        ['principles', 'Visual principles', 'Choose shape, type, color, motion, layout, and material principles.', 72, 42],
        ['voice', 'Tone and language', 'Map verbal personality, naming rules, claims, and what the brand avoids.', 38, 60],
        ['system', 'Identity system', 'Plan logo, palette, type scale, components, image style, and usage examples.', 62, 72],
      ],
      brand_strategy_mindmap: [
        ['position', 'Positioning', 'Name the category frame, alternative, reason to believe, and unfair advantage.', 48, 28, 'strong', 1.18],
        ['audience', 'Audience jobs', 'Capture user jobs, anxieties, aspirations, and switching triggers.', 24, 48],
        ['competitors', 'Competitive frame', 'Map direct, indirect, and cultural competitors plus whitespace.', 72, 48],
        ['pillars', 'Messaging pillars', 'Turn strategy into repeatable claims and proof points.', 36, 70],
        ['risks', 'Open questions', 'Track weak assumptions, missing evidence, and research tasks.', 62, 70],
      ],
      content_strategy: [
        ['intent', 'Audience intent', 'List the moments, questions, and motivations that content must answer.', 26, 34, 'strong', 1.15],
        ['pillars', 'Content pillars', 'Define three to five repeatable content territories with examples.', 52, 26],
        ['channels', 'Channel map', 'Assign each pillar to channels, formats, and native behaviors.', 72, 44],
        ['cadence', 'Cadence and workflow', 'Plan production rhythm, ownership, approval, and reusable assets.', 38, 62],
        ['measure', 'Measurement', 'Define leading signals, conversion signals, and learning loops.', 62, 72],
      ],
      kv_campaign_brief: [
        ['objective', 'Campaign objective', 'State the business goal, audience shift, and campaign role.', 26, 34, 'strong', 1.18],
        ['message', 'Single-minded message', 'Write the one thing the audience should remember.', 52, 26],
        ['kv', 'Key visual idea', 'Describe composition, subject, gesture, environment, color, and visual tension.', 72, 44],
        ['assets', 'Asset system', 'List hero, social, OOH, motion, retail, landing, and adaptation needs.', 38, 62],
        ['rollout', 'Rollout logic', 'Plan reveal sequence, context moments, and measurement checkpoints.', 62, 72],
      ],
    }
    ideas = templateNodes[template].map(([slug, title, body, x, y, status, importance]) =>
      createTemplateIdea(makeId(slug), title, body, x, y, status, importance),
    )
    links = ideas.slice(1).map((idea, index) =>
      createTemplateLink(makeId(`link-${index}`), ideas[0].id, idea.id, index % 2 === 0 ? 'supports' : 'related', `${ideas[0].title} informs ${idea.title}.`),
    )
  }

  const versionHistory: ProjectVersionRecord[] = []
  return {
    version: 2,
    project: templateProjectMetadata(template),
    appearance: defaultProjectAppearance(),
    ideas,
    images: [],
    palettes: [],
    diagrams: [],
    placeholders: [],
    aiSettings,
    versionState: defaultVersionState(versionHistory),
    versionHistory,
    nodeVersions: [],
    links,
    outlineDrafts: [],
  }
}

function createPromptStarterSnapshot(prompt: string, aiSettings: AiSettingsSnapshot = defaultAiSettingsSnapshot()): ProjectSnapshot {
  const trimmed = prompt.trim() || 'Untitled creative project'
  const timestamp = Date.now()
  const rootId = `prompt-${timestamp}-root`
  const ideas = [
    createTemplateIdea(rootId, trimmed.slice(0, 72), `Prompt starter: ${trimmed}`, 48, 28, 'strong', 1.2),
    createTemplateIdea(`prompt-${timestamp}-audience`, 'Audience and context', 'Who is this for, where will they encounter it, and what state are they in?', 24, 50),
    createTemplateIdea(`prompt-${timestamp}-direction`, 'Creative direction', 'What should the work feel like, avoid, and make memorable?', 48, 62),
    createTemplateIdea(`prompt-${timestamp}-evidence`, 'Evidence to collect', 'Images, links, quotes, examples, constraints, and references needed before deciding.', 72, 50),
    createTemplateIdea(`prompt-${timestamp}-ai-next`, 'AI next steps', 'Use arc-menu AI actions to summarize, split, synthesize, find gaps, or generate variations from this board.', 48, 78),
  ]
  const links = ideas.slice(1).map((idea, index) =>
    createTemplateLink(`prompt-${timestamp}-link-${index}`, rootId, idea.id, index === 2 ? 'reference' : 'supports', `Prompt starter branch for ${idea.title}.`),
  )
  const versionHistory: ProjectVersionRecord[] = []
  return {
    version: 2,
    project: {
      ...templateProjectMetadata('brand_strategy_mindmap', trimmed),
      title: trimmed.slice(0, 64),
      description: trimmed,
    },
    appearance: defaultProjectAppearance(),
    ideas,
    images: [],
    palettes: [],
    diagrams: [],
    placeholders: [],
    aiSettings,
    versionState: defaultVersionState(versionHistory),
    versionHistory,
    nodeVersions: [],
    links,
    outlineDrafts: [],
  }
}

function createBlankProjectSnapshot(): ProjectSnapshot {
  return {
    version: 2,
    project: defaultProjectMetadata(),
    appearance: defaultProjectAppearance(),
    ideas: [],
    images: [],
    palettes: [],
    diagrams: [],
    placeholders: [],
    aiSettings: defaultAiSettingsSnapshot(),
    versionState: defaultVersionState(),
    versionHistory: [],
    nodeVersions: [],
    links: [],
    outlineDrafts: [],
  }
}

function createFallbackIdea(): Idea {
  const timestamp = nowIso()
  return {
    id: `idea-${Date.now()}`,
    title: 'Untitled idea',
    body: 'Add a working note for this idea.',
    status: 'thin',
    x: 50,
    y: 46,
    importance: 1,
    createdAt: timestamp,
    addedAt: timestamp,
    updatedAt: timestamp,
  }
}

function createBenchmarkProjectSnapshot(referenceCount: number): ProjectSnapshot {
  const safeReferenceCount = Math.round(clamp(referenceCount, 12, 600))
  const ideaCount = safeReferenceCount >= 240 ? 8 : safeReferenceCount >= 120 ? 6 : 4
  const ideaThemes = [
    ['Ritual interface', 'handled object', 'warm metal'],
    ['Memory index', 'archive', 'paper'],
    ['Material grammar', 'stone', 'threshold'],
    ['Spatial sequence', 'gallery', 'cool wall'],
    ['Instrument logic', 'precision', 'amber'],
    ['Quiet taxonomy', 'index card', 'annotation'],
    ['Atmospheric system', 'soft shadow', 'sequence'],
    ['Local model cues', 'ocr', 'semantic tag'],
  ]
  const relations = Object.keys(relationLabels) as Relation[]
  const ideas = Array.from({ length: ideaCount }, (_, index) => {
    const theme = ideaThemes[index % ideaThemes.length]
    const angle = (-Math.PI / 2) + (index / ideaCount) * Math.PI * 2
    return {
      id: `bench-idea-${index}`,
      title: theme[0],
      body: `Benchmark concept for ${theme.slice(1).join(', ')} references.`,
      status: index % 3 === 0 ? 'strong' : index % 3 === 1 ? 'forming' : 'thin',
      x: clamp(50 + Math.cos(angle) * 28, 16, 84),
      y: clamp(48 + Math.sin(angle) * 22, 16, 82),
    } satisfies Idea
  })
  const images = Array.from({ length: safeReferenceCount }, (_, index) => {
    const theme = ideaThemes[index % ideaCount]
    const ring = index % 24
    const row = Math.floor(index / 24)
    const x = 10 + ((ring % 12) * 7.3)
    const y = 14 + ((Math.floor(ring / 12) * 28 + row * 5.5) % 74)
    const title = `reference ${String(index + 1).padStart(3, '0')}`
    return {
      id: `bench-img-${index}`,
      title,
      source: index % 5 === 0 ? 'eagle.import' : index % 5 === 1 ? 'browser.capture' : 'local.library',
      originApp: index % 5 === 0 ? 'Eagle' : undefined,
      originId: index % 5 === 0 ? `eagle-${index}` : undefined,
      sourcePath: index % 5 === 0 ? `/benchmark/library/item-${index}` : undefined,
      palette: paletteFromName(`${title}-${theme[0]}`),
      tags: [theme[1], theme[2], index % 2 === 0 ? 'support' : 'reference'].filter(Boolean),
      suggestions: createSuggestionRecords([theme[0], index % 3 === 0 ? 'candidate support' : 'open question'], 'fixture', 0.64),
      x: clamp(x, 6, 94),
      y: clamp(y, 8, 92),
      thumb: benchmarkThumb(index),
      fingerprint: `benchmark:${index}`,
      perceptualHash: `benchmark-phash:${index}`,
    } satisfies EvidenceImage
  })
  const links = images
    .filter((_, index) => index % 4 !== 3)
    .map((image, index) => {
      const idea = ideas[index % ideas.length]
      return {
        id: `bench-link-${index}`,
        imageId: image.id,
        ideaId: idea.id,
        relation: relations[index % relations.length],
        note: `Benchmark link from ${image.title} to ${idea.title}.`,
        confidence: clamp(0.48 + (index % 9) * 0.05, 0.42, 0.9),
      } satisfies EvidenceLink
    })

  return {
    version: 2,
    project: {
      ...defaultProjectMetadata(),
      title: `${safeReferenceCount} reference benchmark`,
      description: 'Generated benchmark workspace for visual browsing and graph stress tests.',
    },
    appearance: defaultProjectAppearance(),
    ideas,
    images,
    palettes: [],
    diagrams: [],
    placeholders: [],
    aiSettings: defaultAiSettingsSnapshot(),
    versionState: defaultVersionState(),
    versionHistory: [],
    nodeVersions: [],
    links,
    outlineDrafts: [],
  }
}

function createDuplicateCandidateProjectSnapshot(): ProjectSnapshot {
  const fixtureHashes = [
    'ahash:0000000000000100',
    'ahash:ffffffff00000000',
    'ahash:00000000ffffffff',
    'ahash:ffff0000ffff0000',
    'ahash:0000ffff0000ffff',
    'ahash:aaaaaaaaaaaaaaaa',
  ]
  const baseImages = imagesSeed.map((image, index) => ({
    ...image,
    perceptualHash: fixtureHashes[index] ?? `ahash:${(BigInt(index + 1) << 48n).toString(16).padStart(16, '0')}`,
  }))
  const duplicateCandidate: EvidenceImage = {
    ...baseImages[0],
    id: 'dup-img-ritual-tool-crop',
    title: 'ritual tool crop variant',
    source: 'duplicate.fixture',
    x: 78,
    y: 28,
    fingerprint: 'fixture:ritual-tool-crop',
    perceptualHash: 'ahash:000000000000010f',
  }

  return {
    version: 2,
    project: {
      ...defaultProjectMetadata(),
      title: 'Duplicate candidate fixture',
      description: 'Fixture workspace with perceptual duplicate candidates.',
    },
    appearance: defaultProjectAppearance(),
    ideas: ideasSeed,
    images: [...baseImages, duplicateCandidate],
    palettes: [],
    diagrams: [],
    placeholders: [],
    aiSettings: defaultAiSettingsSnapshot(),
    versionState: defaultVersionState(),
    versionHistory: [],
    nodeVersions: [],
    links: linksSeed,
    outlineDrafts: [],
  }
}

function benchmarkThumb(index: number) {
  const palette = paletteFromName(`benchmark-${index}`)
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">`,
    `<rect width="160" height="120" fill="${palette[0]}"/>`,
    `<rect x="18" y="18" width="124" height="84" rx="6" fill="${palette[1]}" opacity=".72"/>`,
    `<circle cx="${36 + (index % 7) * 14}" cy="${34 + (index % 5) * 12}" r="16" fill="${palette[2]}" opacity=".86"/>`,
    `<path d="M20 92 C58 ${60 + (index % 18)} 96 ${102 - (index % 20)} 142 78" fill="none" stroke="#f4f1ea" stroke-width="5" opacity=".62"/>`,
    `</svg>`,
  ].join('')
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function readProjectSnapshot(): ProjectSnapshot {
  if (typeof window === 'undefined') return toProjectSnapshot(ideasSeed, imagesSeed, linksSeed)

  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return toProjectSnapshot(ideasSeed, imagesSeed, linksSeed)
    const parsed = JSON.parse(stored)
    return isProjectSnapshot(parsed) ? parsed : toProjectSnapshot(ideasSeed, imagesSeed, linksSeed)
  } catch {
    return toProjectSnapshot(ideasSeed, imagesSeed, linksSeed)
  }
}

function readOnboardingCompleted() {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(onboardingStorageKey) === 'true'
}

function writeOnboardingCompleted(completed: boolean) {
  if (typeof window === 'undefined') return
  if (completed) {
    window.localStorage.setItem(onboardingStorageKey, 'true')
  } else {
    window.localStorage.removeItem(onboardingStorageKey)
  }
}

function isProjectSnapshot(value: unknown): value is ProjectSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<ProjectSnapshot>
  const valid = (
    snapshot.version === 2 &&
    Array.isArray(snapshot.ideas) &&
    snapshot.ideas.length > 0 &&
    Array.isArray(snapshot.images) &&
    Array.isArray(snapshot.palettes) &&
    Array.isArray(snapshot.diagrams) &&
    Array.isArray(snapshot.placeholders) &&
    isAiSettingsSnapshot(snapshot.aiSettings) &&
    Array.isArray(snapshot.versionHistory) &&
    Array.isArray(snapshot.links) &&
    Array.isArray(snapshot.outlineDrafts)
  )
  if (!valid) return false
  snapshot.project = normalizeProjectMetadata(snapshot.project)
  snapshot.appearance = normalizeProjectAppearance(snapshot.appearance)
  snapshot.versionHistory = normalizeVersionHistory(snapshot.versionHistory ?? [])
  snapshot.versionState = normalizeVersionState(snapshot.versionState, snapshot.versionHistory)
  snapshot.nodeVersions = normalizeNodeVersions(snapshot.nodeVersions ?? [])
  snapshot.slidesConfig = normalizeSlidesConfig(snapshot.slidesConfig)
  return true
}

function normalizeProjectMetadata(value: unknown): ProjectMetadata {
  const fallback = defaultProjectMetadata()
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<ProjectMetadata>
  return {
    title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title : fallback.title,
    description: typeof candidate.description === 'string' ? candidate.description : fallback.description,
    author: typeof candidate.author === 'string' ? candidate.author : fallback.author,
    kind: candidate.kind === 'ideaboard' || candidate.kind === 'moodboard' ? candidate.kind : fallback.kind,
    styleNote: typeof candidate.styleNote === 'string' ? candidate.styleNote : fallback.styleNote,
  }
}

function normalizeProjectAppearance(value: unknown): ProjectAppearance {
  const fallback = defaultProjectAppearance()
  if (!value || typeof value !== 'object') return fallback
  const candidate = value as Partial<ProjectAppearance>
  const preset = projectAccentPresets.some((item) => item.id === candidate.accentPreset) ? candidate.accentPreset as ProjectAccentPreset : fallback.accentPreset
  const presetColor = projectAccentPresets.find((item) => item.id === preset)?.color ?? fallback.accentColor
  const legacyCanvasColor = typeof candidate.canvasColor === 'string' ? normalizeHexInput(candidate.canvasColor) : fallback.canvasColor
  const colorFormula = normalizeProjectColorFormula(candidate.colorFormula)
  const colorMode = candidate.colorMode === 'light' || candidate.colorMode === 'dark' ? candidate.colorMode : inferCanvasColorMode(legacyCanvasColor)
  const accentColor = typeof candidate.accentColor === 'string'
    ? normalizeHexInput(candidate.accentColor)
    : deriveAccentFromCanvas(legacyCanvasColor, colorFormula) || presetColor
  const canvasColor = deriveCanvasFromAccent(accentColor, colorFormula, colorMode)
  return {
    colorMode: inferCanvasColorMode(canvasColor),
    canvasColor,
    colorFormula,
    accentPreset: preset,
    accentColor,
  }
}

function normalizeProjectColorFormula(value: unknown): ProjectColorFormula {
  return projectColorFormulas.some((formula) => formula.id === value) ? value as ProjectColorFormula : 'material'
}

function normalizeVersionHistory(records: ProjectVersionRecord[]) {
  return records.map((record) => ({
    ...record,
    branchId: record.branchId ?? 'main',
    trigger: record.trigger ?? 'manual',
  }))
}

function normalizeNodeVersions(records: unknown[]): NodeVersionRecord[] {
  return records
    .filter((record): record is Partial<NodeVersionRecord> => Boolean(record && typeof record === 'object'))
    .filter((record) => (
      typeof record.id === 'string'
      && typeof record.nodeId === 'string'
      && typeof record.nodeKind === 'string'
      && ['idea', 'image', 'palette', 'diagram', 'placeholder'].includes(record.nodeKind)
      && typeof record.snapshotJson === 'string'
    ))
    .map((record, index) => ({
      id: record.id as string,
      nodeId: record.nodeId as string,
      nodeKind: record.nodeKind as GraphNodeKind,
      versionNumber: typeof record.versionNumber === 'number' ? record.versionNumber : index + 1,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : nowIso(),
      trigger: isNodeVersionTrigger(record.trigger) ? record.trigger : 'user_edit',
      snapshotJson: record.snapshotJson as string,
      fields: Array.isArray(record.fields) ? record.fields.filter((field): field is string => typeof field === 'string') : [],
      summary: typeof record.summary === 'string' ? record.summary : 'Node changed',
      branchId: typeof record.branchId === 'string' ? record.branchId : 'main',
      restoredFromId: typeof record.restoredFromId === 'string' ? record.restoredFromId : undefined,
      aiGenerated: typeof record.aiGenerated === 'boolean' ? record.aiGenerated : false,
      note: typeof record.note === 'string' ? record.note : undefined,
    }))
}

function isNodeVersionTrigger(value: unknown): value is NodeVersionTrigger {
  return typeof value === 'string' && [
    'user_edit',
    'image_added',
    'image_removed',
    'score_updated',
    'label_changed',
    'merge',
    'split',
    'restore',
    'created',
  ].includes(value)
}

function diffNodeSnapshot(
  before: Idea | EvidenceImage | PaletteNode | DiagramNode | PlaceholderNode | undefined,
  after: Idea | EvidenceImage | PaletteNode | DiagramNode | PlaceholderNode,
) {
  if (!before) {
    return { fields: ['created'], summary: 'Created node' }
  }
  const fields = Object.keys(after)
    .filter((field) => field !== 'updatedAt')
    .filter((field) => JSON.stringify(before[field as keyof typeof before]) !== JSON.stringify(after[field as keyof typeof after]))
  return {
    fields,
    summary: summarizeNodeDiff(fields),
  }
}

function summarizeNodeDiff(fields: string[]) {
  if (fields.length === 0) return ''
  const labels = fields.map(formatNodeFieldName)
  if (labels.length === 1) return `Changed ${labels[0]}`
  if (labels.length === 2) return `Changed ${labels[0]} and ${labels[1]}`
  return `Changed ${labels.slice(0, 2).join(', ')} and ${labels.length - 2} more`
}

function formatNodeFieldName(field: string) {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}

function nodeVersionTriggerLabel(trigger: NodeVersionTrigger) {
  if (trigger === 'label_changed') return 'Renamed node'
  if (trigger === 'score_updated') return 'Updated importance'
  if (trigger === 'image_added') return 'Added image'
  if (trigger === 'image_removed') return 'Removed image'
  if (trigger === 'restore') return 'Restored node'
  if (trigger === 'created') return 'Created node'
  return 'Edited node'
}

function isIdeaNode(value: unknown): value is Idea {
  return Boolean(value && typeof value === 'object' && typeof (value as Partial<Idea>).id === 'string' && typeof (value as Partial<Idea>).title === 'string' && typeof (value as Partial<Idea>).body === 'string')
}

function isImageNode(value: unknown): value is EvidenceImage {
  return Boolean(value && typeof value === 'object' && typeof (value as Partial<EvidenceImage>).id === 'string' && typeof (value as Partial<EvidenceImage>).title === 'string' && Array.isArray((value as Partial<EvidenceImage>).palette))
}

function isPaletteNode(value: unknown): value is PaletteNode {
  return Boolean(value && typeof value === 'object' && typeof (value as Partial<PaletteNode>).id === 'string' && Array.isArray((value as Partial<PaletteNode>).colors))
}

function isDiagramNode(value: unknown): value is DiagramNode {
  return Boolean(value && typeof value === 'object' && typeof (value as Partial<DiagramNode>).id === 'string' && (value as Partial<DiagramNode>).format === 'mermaid')
}

function isPlaceholderNode(value: unknown): value is PlaceholderNode {
  return Boolean(value && typeof value === 'object' && typeof (value as Partial<PlaceholderNode>).id === 'string' && (value as Partial<PlaceholderNode>).targetKind === 'image')
}

function isAiSettingsSnapshot(value: unknown): value is AiSettingsSnapshot {
  if (!value || typeof value !== 'object') return false
  const settings = value as Partial<AiSettingsSnapshot>
  return (
    Array.isArray(settings.providers) &&
    settings.providers.every(isAiProviderProfile) &&
    typeof settings.selectedProviderId === 'string' &&
    typeof settings.routingMode === 'string' &&
    settings.routingMode in aiRoutingLabels
  )
}

function isAiProviderProfile(value: unknown): value is AiProviderProfile {
  if (!value || typeof value !== 'object') return false
  const provider = value as Partial<AiProviderProfile>
  return (
    typeof provider.id === 'string' &&
    typeof provider.type === 'string' &&
    provider.type in aiProviderTypeLabels &&
    typeof provider.name === 'string' &&
    typeof provider.authMode === 'string' &&
    ['local', 'api_key', 'oauth', 'openai_compatible'].includes(provider.authMode) &&
    typeof provider.model === 'string' &&
    typeof provider.status === 'string' &&
    provider.status in aiProviderStatusLabels &&
    Array.isArray(provider.defaultFor)
  )
}

function isTauriRuntime() {
  if (typeof window === 'undefined') return false
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

function isDevRuntime() {
  return Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)
}

function isCreateIdeaShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'n'
}

function isSettingsShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key === ','
}

function isDeleteShortcut(event: KeyboardEvent) {
  return !event.metaKey && !event.ctrlKey && !event.altKey && (event.key === 'Delete' || event.key === 'Backspace')
}

function isUndoShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z'
}

function isRedoShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  return ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && key === 'z')
    || ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && key === 'y')
}

function isSaveShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's'
}

function isDuplicateShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'd'
}

function isCreateLinkShortcut(event: KeyboardEvent) {
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'l'
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

async function saveNativeProjectPackage(snapshotJson: string, projectPath?: string) {
  return invoke<ProjectPackageInfo>('save_project_package', { snapshotJson, projectPath })
}

async function openNativeProjectPackage(projectPath?: string) {
  const snapshotJson = await invoke<string | null>(
    projectPath ? 'open_project_package_at' : 'open_project_package',
    projectPath ? { projectPath } : undefined,
  )
  if (!snapshotJson) return null

  try {
    const parsed = JSON.parse(snapshotJson)
    return isProjectSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function importNativeReferenceFolder(folderPath: string) {
  return invoke<EvidenceImage[]>('import_reference_folder', { folderPath })
}

async function importNativeEagleWebItems(limit: number) {
  return invoke<EvidenceImage[]>('import_eagle_web_items', { limit })
}

async function captureNativeScreenReference() {
  return invoke<EvidenceImage | null>('capture_screen_reference')
}

async function updateNativeCaptureContext(context: KiraCaptureContext) {
  return invoke<void>('update_capture_context', { contextJson: JSON.stringify(context) })
}

async function runNativeAppleVisionOcr(imageDataUrl: string) {
  return invoke<OcrResult | null>('run_apple_vision_ocr', { imageDataUrl })
}

async function checkNativeFoundationModelAvailability() {
  return invoke<LocalModelAvailability>('check_foundation_model_availability')
}

async function normalizeNativeTagsWithFoundationModel(textContext: string) {
  return invoke<LocalModelTagResult>('normalize_tags_with_foundation_model', { textContext })
}

async function saveNativeProviderSecret(providerId: string, secret: string) {
  if (!isTauriRuntime()) {
    throw new Error(`Secure storage is available in the desktop app only (${providerId})`)
  }
  return invoke<void>('save_provider_secret', { providerId, secret })
}

async function deleteNativeProviderSecret(providerId: string) {
  if (!isTauriRuntime()) {
    throw new Error(`Secure storage is available in the desktop app only (${providerId})`)
  }
  return invoke<void>('delete_provider_secret', { providerId })
}

async function testNativeAiProvider(provider: AiProviderProfile) {
  if (!isTauriRuntime()) {
    return {
      connected: false,
      status: provider.authMode === 'local' ? 'unavailable' : provider.secretRef ? 'unavailable' : 'key_missing',
      message: 'Provider tests run in the desktop app because secrets and local endpoints are native-only.',
    } satisfies AiProviderTestResult
  }
  return invoke<AiProviderTestResult>('test_ai_provider', { provider: providerRequestPayload(provider) })
}

async function listNativeAiModels(provider: AiProviderProfile) {
  if (!isTauriRuntime()) {
    return {
      status: 'desktop_required',
      models: provider.discoveredModels ?? [],
    } satisfies AiModelListResult
  }
  return invoke<AiModelListResult>('list_ai_models', { provider: providerRequestPayload(provider) })
}

async function generateNativeAiText(provider: AiProviderProfile, prompt: string) {
  if (!isTauriRuntime()) {
    throw new Error('AI generation runs in the desktop app because secrets and local endpoints are native-only.')
  }
  return invoke<AiGenerationResult>('generate_ai_text', { provider: providerRequestPayload(provider), prompt })
}

// Detects the native error surfaced when a Codex (ChatGPT OAuth) provider runs a
// generation while the user is signed out. Used to turn a raw error into an
// actionable "sign in" prompt instead of dumping the message into the node body.
function isCodexLoggedOutError(message: string): boolean {
  return /not signed in|sign in with chatgpt|not logged in/i.test(message)
}

type CodexLoginEvent =
  | { type: 'oauth_url'; url: string }
  | { type: 'device_code'; verificationUrl: string; userCode: string }
  | { type: 'success' }
  | { type: 'error'; message: string }

function requestCodexLogin(method: 'chatgpt' | 'device' | 'api-key', apiKey?: string) {
  return invoke<void>('codex_login', { method, apiKey })
}

function cancelCodexLogin() {
  return invoke<void>('codex_cancel_login')
}

function codexLogout() {
  return invoke<void>('codex_logout')
}

function onCodexLoginProgress(callback: (event: CodexLoginEvent) => void) {
  return listen<CodexLoginEvent>('codex://login', (event) => callback(event.payload))
}

async function getNativeExtensionInstallStatus() {
  if (!isTauriRuntime()) return defaultExtensionInstallStatus()
  return invoke<ExtensionInstallStatus>('get_extension_install_status')
}

async function openNativeExtensionInstallTarget(targetId: string) {
  if (!isTauriRuntime()) return
  await invoke<void>('open_extension_install_target', { targetId })
}

function extensionStatusForTarget(status: ExtensionInstallStatus, targetId: string) {
  return targetId === 'safari' ? status.safari : status.chrome
}

function providerRequestPayload(provider: AiProviderProfile) {
  return {
    providerId: provider.id,
    providerType: provider.type,
    authMode: provider.authMode,
    baseUrl: provider.baseUrl,
    model: provider.model,
  }
}

function providerStatusFromNative(status: string, connected: boolean): AiProviderStatus {
  if (connected) return 'connected'
  if (status === 'key_missing') return 'key_missing'
  if (status === 'billing_separate') return 'billing_separate'
  return 'unavailable'
}

function selectAiProviderForTask(
  task: AiTaskKind,
  providers: AiProviderProfile[],
  routingMode: AiRoutingMode,
  selectedProviderId: string,
  explicitProviderId?: string,
): AiTaskRoute {
  const localProvider = providers.find((provider) => provider.authMode === 'local')
  const selectedProvider = providers.find((provider) => provider.id === (explicitProviderId ?? selectedProviderId))
  const taskDefault = providers.find((provider) => provider.defaultFor.includes(task) && provider.status === 'connected')
  const availableRemote = providers.find(
    (provider) => provider.authMode !== 'local' && provider.defaultFor.includes(task) && provider.status === 'connected',
  )

  if (explicitProviderId && selectedProvider) {
    return providerRoute(task, selectedProvider, 'explicit user override')
  }

  if (routingMode === 'local_only') {
    return localProvider
      ? providerRoute(task, localProvider, 'local-only default')
      : unavailableRoute(task, 'No local provider configured')
  }

  if (routingMode === 'selected_remote' && selectedProvider) {
    if (selectedProvider.status === 'connected') return providerRoute(task, selectedProvider, 'selected remote provider')
    return localProvider
      ? providerRoute(task, localProvider, `${selectedProvider.name} unavailable; local fallback`)
      : providerRoute(task, selectedProvider, `${selectedProvider.name} unavailable`)
  }

  if (localProvider?.status === 'connected' && localProvider.defaultFor.includes(task)) {
    return providerRoute(task, localProvider, 'prefer local')
  }

  if (taskDefault) return providerRoute(task, taskDefault, 'task default')
  if (availableRemote) return providerRoute(task, availableRemote, 'remote fallback')
  if (localProvider) return providerRoute(task, localProvider, 'local fallback')
  return unavailableRoute(task, 'No provider configured')
}

function providerRoute(task: AiTaskKind, provider: AiProviderProfile, reason: string): AiTaskRoute {
  return {
    task,
    providerId: provider.id,
    providerName: provider.name,
    status: provider.status,
    reason,
  }
}

function unavailableRoute(task: AiTaskKind, reason: string): AiTaskRoute {
  return {
    task,
    providerId: null,
    providerName: 'Unavailable',
    status: 'unavailable',
    reason,
  }
}

async function exportNativeOutlineMarkdown(markdown: string, projectPath?: string) {
  return invoke<string | null>('export_outline_markdown', { markdown, projectPath })
}

async function exportNativeOutlineHtml(html: string, projectPath?: string) {
  return invoke<string | null>('export_outline_html', { html, projectPath })
}

async function exportNativeContactSheetHtml(html: string, projectPath?: string) {
  return invoke<string | null>('export_contact_sheet_html', { html, projectPath })
}

async function exportNativeSlideshowHtml(html: string, projectPath?: string) {
  return invoke<string | null>('export_slideshow_html', { html, projectPath })
}

async function exportNativeSlideshowPptx(base64Data: string, filename: string, projectPath?: string) {
  return invoke<string | null>('export_slideshow_pptx', { base64Data, filename, projectPath })
}

function downloadProject(snapshot: ProjectSnapshot) {
  downloadTextFile(JSON.stringify(snapshot, null, 2), 'kira-project.json', 'application/json')
}

function downloadTextFile(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function outlineDraftToMarkdown(draft: OutlineDraft, ideas: Idea[], images: EvidenceImage[]) {
  const imageById = new Map(images.map((image) => [image.id, image]))
  const ideaById = new Map(ideas.map((idea) => [idea.id, idea]))
  const lines = [`# ${draft.title || 'Outline'}`, '', `Generated: ${draft.createdAt}`, '']

  draft.sections.forEach((section, index) => {
    const idea = ideaById.get(section.ideaId)
    lines.push(`## ${index + 1}. ${section.title}`, '')
    lines.push(section.summary)
    lines.push('')
    lines.push(`Strength: ${section.strength}`)
    if (idea?.body && idea.body !== section.summary) {
      lines.push('')
      lines.push(`Idea note: ${idea.body}`)
    }
    lines.push('')
    lines.push('References:')
    if (section.referenceIds.length === 0) {
      lines.push('- Needs references')
    } else {
      section.referenceIds.forEach((referenceId) => {
        const image = imageById.get(referenceId)
        lines.push(`- ${image?.title ?? referenceId}${image?.source ? ` (${image.source})` : ''}`)
      })
    }
    lines.push('')
  })

  return lines.join('\n').trimEnd() + '\n'
}

function outlineDraftToHtml(draft: OutlineDraft, ideas: Idea[], images: EvidenceImage[]) {
  const imageById = new Map(images.map((image) => [image.id, image]))
  const ideaById = new Map(ideas.map((idea) => [idea.id, idea]))
  const sections = draft.sections.map((section, index) => {
    const idea = ideaById.get(section.ideaId)
    const references = section.referenceIds.length === 0
      ? '<li class="missing">Needs references</li>'
      : section.referenceIds.map((referenceId) => {
          const image = imageById.get(referenceId)
          const source = image?.source ? `<small>${escapeHtml(image.source)}</small>` : ''
          const thumb = image?.thumb ? `<img src="${escapeAttribute(image.thumb)}" alt="">` : ''
          return `<li>${thumb}<span>${escapeHtml(image?.title ?? referenceId)}${source}</span></li>`
        }).join('')
    const ideaNote = idea?.body && idea.body !== section.summary
      ? `<p class="idea-note">Idea note: ${escapeHtml(idea.body)}</p>`
      : ''

    return `
      <section>
        <header>
          <span>${String(index + 1).padStart(2, '0')}</span>
          <h2>${escapeHtml(section.title)}</h2>
          <em>${escapeHtml(section.strength)}</em>
        </header>
        <p>${escapeHtml(section.summary)}</p>
        ${ideaNote}
        <ul>${references}</ul>
      </section>
    `
  }).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(draft.title || 'Outline')}</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0d0f0e; color: #ece9dd; }
    body { margin: 0; padding: 48px; background: #0d0f0e; }
    main { max-width: 920px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 34px; font-weight: 720; }
    .meta { margin: 0 0 36px; color: #96988e; font-size: 14px; }
    section { padding: 28px 0; border-top: 1px solid rgba(255,255,255,.09); }
    header { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: baseline; gap: 14px; }
    header span, header em { color: #96988e; font-size: 13px; font-style: normal; }
    h2 { margin: 0; font-size: 22px; font-weight: 690; }
    p { color: #c9c8bd; line-height: 1.65; }
    .idea-note { color: #aeb2a8; font-size: 14px; }
    ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; padding: 0; margin: 18px 0 0; list-style: none; }
    li { display: grid; grid-template-columns: 48px minmax(0, 1fr); align-items: center; min-height: 48px; padding: 8px; border-radius: 8px; background: rgba(255,255,255,.045); gap: 10px; }
    li.missing { display: block; color: #d7b3ff; }
    img { width: 48px; height: 38px; object-fit: cover; border-radius: 5px; background: rgba(255,255,255,.08); }
    li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    small { display: block; overflow: hidden; color: #96988e; text-overflow: ellipsis; white-space: nowrap; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(draft.title || 'Outline')}</h1>
    <p class="meta">Generated: ${escapeHtml(draft.createdAt)}</p>
    ${sections}
  </main>
</body>
</html>
`
}

function slideLayoutsToHtml(slides: SlideLayout[], metadata: { title: string; generatedAt: string; deckMeta: SlideDeckMeta }) {
  const slideMarkup = slides.length === 0
    ? '<section class="slide slide--empty"><h2>No slides</h2><p>Create ideas and link references to generate a slideshow.</p></section>'
    : slides.map((slide, index) => {
        const paletteMarkup = slide.palettes.length === 0
          ? ''
          : slide.palettes.map((palette) => `
              <figure class="palette-figure" data-algorithm="${escapeAttribute(palette.algorithm)}">
                <div class="palette-strip">${palette.colors.map((color) => `<i style="background:${escapeAttribute(color)}"></i>`).join('')}</div>
                <figcaption>${escapeHtml(palette.title)}</figcaption>
              </figure>
            `).join('')
        const diagramMarkup = slide.diagrams.length === 0
          ? ''
          : slide.diagrams.map((diagram) => `
              <figure class="diagram-figure" data-format="${escapeAttribute(diagram.format)}">
                <strong>${escapeHtml(diagram.title)}</strong>
                <figcaption>${diagram.nodeIds.length} nodes · ${escapeHtml(diagram.format)}</figcaption>
              </figure>
            `).join('')
        const imageMarkup = slide.references.length === 0
          ? '<div class="missing">Needs references</div>'
          : slide.references.map((reference) => {
              const thumb = reference.thumb
                ? `<img src="${escapeAttribute(reference.thumb)}" alt="">`
                : '<div class="thumb-missing">Missing</div>'
              return `
                <figure>
                  ${thumb}
                  <figcaption>${escapeHtml(reference.title)}</figcaption>
                </figure>
              `
            }).join('')
        const references = slide.layout === 'cover'
          ? `${imageMarkup}${paletteMarkup}`
          : slide.layout === 'moodboard'
            ? `${imageMarkup}${paletteMarkup}`
            : slide.layout === 'palette' && paletteMarkup
          ? paletteMarkup
          : slide.layout === 'diagram' && diagramMarkup
            ? diagramMarkup
            : imageMarkup

        return `
          <section class="slide slide--${escapeAttribute(slide.layout)}" data-layout-reason="${escapeAttribute(slide.layoutReason)}" data-node-kind="${escapeAttribute(slide.kind)}" data-importance="${escapeAttribute(String(nodeImportance(slide.idea?.importance)))}" style="--accent: ${escapeAttribute(slide.accent)}">
            <aside>
              <span>${String(index + 1).padStart(2, '0')}</span>
              <em>${escapeHtml(slide.kicker)}</em>
            </aside>
            <div class="copy">
              <h2>${escapeHtml(slide.title)}</h2>
              <p>${escapeHtml(slide.summary)}</p>
            </div>
            <div class="refs">${references}</div>
            <aside class="notes">${escapeHtml(slide.speakerNote)}</aside>
          </section>
        `
      }).join('')

  const manifestJson = safeJsonScript(JSON.stringify({
    app: 'KIRA',
    title: metadata.title,
    generatedAt: metadata.generatedAt,
    template: metadata.deckMeta.template,
    estimatedDuration: metadata.deckMeta.estimatedDuration,
    theme: metadata.deckMeta.theme,
    slides: slides.map((slide, index) => ({
      index: index + 1,
      id: slide.id,
      type: slide.kind,
      layout: slide.layout,
      headline: slide.title,
      references: slide.references.map((reference) => reference.id),
      palettes: slide.palettes.map((palette) => palette.id),
      diagrams: slide.diagrams.map((diagram) => diagram.id),
      speakerNote: slide.speakerNote,
    })),
  }))

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(metadata.title)}</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: ${escapeAttribute(metadata.deckMeta.theme.background)}; color: #ece9dd; --deck-accent: ${escapeAttribute(metadata.deckMeta.theme.accent)}; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #090a0a; scroll-snap-type: y mandatory; scroll-behavior: smooth; }
    .reveal { min-height: 100dvh; }
    .slides { display: grid; gap: 1px; }
    .slide { display: grid; grid-template-columns: 92px minmax(280px,.82fr) minmax(320px,1fr); min-height: 100dvh; padding: 7vw; background: #0d0f0e; gap: clamp(28px,5vw,72px); page-break-after: always; break-after: page; scroll-snap-align: start; }
    aside { display: grid; align-content: start; gap: 8px; color: #96988e; font-size: 13px; }
    aside em { color: var(--accent); font-style: normal; }
    .notes { display: none; }
    .copy { display: grid; align-content: center; gap: 18px; }
    h2 { max-width: 12ch; margin: 0; font-size: clamp(44px,8vw,104px); line-height: .96; text-wrap: balance; }
    p { max-width: 52ch; margin: 0; color: #c9c8bd; font-size: 18px; line-height: 1.65; text-wrap: pretty; }
    .refs { display: grid; align-content: center; gap: 14px; }
    .slide--grid .refs { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .slide--stack .refs { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .slide--cover .refs { grid-template-columns: 1fr; }
    .slide--moodboard .refs { grid-template-columns: repeat(4,minmax(0,1fr)); }
    figure { display: grid; min-width: 0; margin: 0; overflow: hidden; border-radius: 8px; background: rgba(255,255,255,.045); }
    img, .thumb-missing { width: 100%; min-height: 180px; object-fit: cover; background: rgba(255,255,255,.06); }
    .slide--cover img, .slide--cover .thumb-missing, .slide--focus img, .slide--focus .thumb-missing { min-height: 54vh; }
    .slide--moodboard img, .slide--moodboard .thumb-missing { min-height: 130px; }
    .palette-strip { display: grid; overflow: hidden; height: 42px; grid-auto-flow: column; grid-auto-columns: 1fr; }
    figcaption { overflow: hidden; padding: 10px 12px; color: #c9c8bd; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .missing { align-self: center; color: #b7a4df; }
    .deck-hint { position: fixed; right: 16px; bottom: 16px; z-index: 9; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,.08); color: #c9c8bd; font-size: 12px; backdrop-filter: blur(8px); transition: opacity .4s ease; }
    .deck-progress { position: fixed; top: 0; left: 0; right: 0; z-index: 9; height: 3px; background: var(--deck-accent); transform-origin: left; transform: scaleX(0); transition: transform .25s ease; }
    @media (max-width: 860px) { .slide { grid-template-columns: 1fr; } aside { grid-auto-flow: column; justify-content: space-between; } h2 { max-width: 14ch; } }
    @page { size: 1280px 720px; margin: 0; }
    @media print {
      body { scroll-snap-type: none; }
      .slide { min-height: 100vh; width: 100vw; padding: 6vw; }
      .deck-hint, .deck-progress { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="deck-progress" aria-hidden="true"></div>
  <main class="reveal" data-title="${escapeAttribute(metadata.title)}" data-generated-at="${escapeAttribute(metadata.generatedAt)}" data-template="${escapeAttribute(metadata.deckMeta.template)}" data-estimated-duration="${escapeAttribute(metadata.deckMeta.estimatedDuration)}" data-theme-accent="${escapeAttribute(metadata.deckMeta.theme.accent)}">
    <div class="slides">${slideMarkup}</div>
  </main>
  <div class="deck-hint" aria-hidden="true">← → navigate · F fullscreen · P print/PDF</div>
  <script type="application/json" id="kira-slide-manifest">${manifestJson}</script>
  <script>${slideDeckNavScript()}</script>
</body>
</html>
`
}

function slideDeckNavScript() {
  return `
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  if (!slides.length) return;
  var current = 0;
  var progress = document.querySelector('.deck-progress');
  var hint = document.querySelector('.deck-hint');
  var hintTimer;
  function showHint() {
    if (!hint) return;
    hint.style.opacity = '1';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hint.style.opacity = '0'; }, 2400);
  }
  function go(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides[current].scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (progress) progress.style.transform = 'scaleX(' + ((current + 1) / slides.length) + ')';
    showHint();
  }
  function syncFromScroll() {
    var nearest = 0;
    var best = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var delta = Math.abs(slides[i].getBoundingClientRect().top);
      if (delta < best) { best = delta; nearest = i; }
    }
    current = nearest;
    if (progress) progress.style.transform = 'scaleX(' + ((current + 1) / slides.length) + ')';
  }
  document.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === ' ' || event.key === 'PageDown') {
      event.preventDefault(); go(current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault(); go(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault(); go(0);
    } else if (event.key === 'End') {
      event.preventDefault(); go(slides.length - 1);
    } else if (event.key === 'f' || event.key === 'F') {
      if (document.fullscreenElement) { document.exitFullscreen(); } else { document.documentElement.requestFullscreen().catch(function () {}); }
    } else if (event.key === 'p' || event.key === 'P') {
      event.preventDefault(); window.print();
    }
  });
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { syncFromScroll(); ticking = false; });
  }, { passive: true });
  go(0);
})();
`.trim()
}

function safeJsonScript(json: string) {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function hexForPptx(value: string | undefined, fallback = '84CDBC'): string {
  if (!value) return fallback
  const hex = converter('rgb')(value)
    ? formatHex(value)?.replace('#', '').toUpperCase()
    : value.replace('#', '').toUpperCase()
  if (hex && /^[0-9A-F]{6}$/.test(hex)) return hex
  if (hex && /^[0-9A-F]{3}$/.test(hex)) {
    return hex.split('').map((char) => char + char).join('')
  }
  return fallback
}

// 16:9 widescreen deck in inches (matches PowerPoint LAYOUT_WIDE).
const PPTX_W = 13.333
const PPTX_H = 7.5

function pptxImageSlots(layout: SlideLayout['layout'], count: number): Array<{ x: number; y: number; w: number; h: number }> {
  const railX = 6.7
  const railW = PPTX_W - railX - 0.5
  if (layout === 'cover' || layout === 'focus') {
    return [{ x: railX, y: 0.5, w: railW, h: PPTX_H - 1 }]
  }
  if (layout === 'grid') {
    const gap = 0.2
    const cellW = (railW - gap) / 2
    const cellH = (PPTX_H - 1 - gap) / 2
    return Array.from({ length: 4 }, (_, index) => ({
      x: railX + (index % 2) * (cellW + gap),
      y: 0.5 + Math.floor(index / 2) * (cellH + gap),
      w: cellW,
      h: cellH,
    }))
  }
  if (layout === 'moodboard') {
    const cols = 3
    const rows = Math.max(1, Math.ceil(Math.min(count, 12) / cols))
    const gap = 0.16
    const fullX = 0.5
    const fullW = PPTX_W - 1
    const cellW = (fullW - gap * (cols - 1)) / cols
    const cellH = (PPTX_H - 2.6 - gap * (rows - 1)) / rows
    return Array.from({ length: cols * rows }, (_, index) => ({
      x: fullX + (index % cols) * (cellW + gap),
      y: 2.4 + Math.floor(index / cols) * (cellH + gap),
      w: cellW,
      h: cellH,
    }))
  }
  // stack and fallbacks: vertical column
  const gap = 0.18
  const slots = Math.min(Math.max(count, 1), 3)
  const cellH = (PPTX_H - 1 - gap * (slots - 1)) / slots
  return Array.from({ length: slots }, (_, index) => ({
    x: railX,
    y: 0.5 + index * (cellH + gap),
    w: railW,
    h: cellH,
  }))
}

async function slidesToPptx(slides: SlideLayout[], deckMeta: SlideDeckMeta, title: string) {
  const { default: PptxGenJs } = await import('pptxgenjs')
  const prs = new PptxGenJs()
  prs.defineLayout({ name: 'KIRA_WIDE', width: PPTX_W, height: PPTX_H })
  prs.layout = 'KIRA_WIDE'
  prs.author = 'KIRA'
  prs.company = 'KIRA'
  prs.subject = deckMeta.template
  prs.title = title

  const bg = hexForPptx(deckMeta.theme.background, '0D0F0E')
  const textMain = 'F1EEE7'
  const textSoft = 'C9C8BD'
  const textMuted = '96988E'

  if (slides.length === 0) {
    const slide = prs.addSlide()
    slide.background = { color: bg }
    slide.addText('No slides yet', { x: 0.5, y: 3.1, w: PPTX_W - 1, h: 1, fontSize: 40, bold: true, color: textMain, align: 'center' })
    slide.addText('Create ideas and link references to generate a slideshow.', { x: 0.5, y: 4.1, w: PPTX_W - 1, h: 0.6, fontSize: 16, color: textSoft, align: 'center' })
    return prs
  }

  slides.forEach((slide, index) => {
    const s = prs.addSlide()
    s.background = { color: bg }
    const accent = hexForPptx(slide.accent)
    const isMoodboard = slide.layout === 'moodboard'
    const isCover = slide.layout === 'cover'
    const hasVisuals = slide.references.length > 0 || slide.palettes.length > 0 || slide.diagrams.length > 0
    const copyW = isMoodboard ? PPTX_W - 1 : hasVisuals ? 5.8 : PPTX_W - 1

    s.addText(String(index + 1).padStart(2, '0'), { x: 0.5, y: 0.42, w: 1.2, h: 0.3, fontSize: 11, color: textMuted })
    s.addText((slide.kicker || '').toUpperCase(), { x: 0.5, y: 0.74, w: copyW, h: 0.4, fontSize: 11, color: accent, charSpacing: 1 })
    s.addText(slide.title, {
      x: 0.5,
      y: 1.18,
      w: copyW,
      h: isCover ? 2 : 1.7,
      fontSize: isCover ? 46 : 34,
      bold: true,
      color: textMain,
      valign: 'top',
    })
    s.addText(slide.summary, {
      x: 0.5,
      y: isMoodboard ? 1.9 : isCover ? 3.3 : 2.9,
      w: copyW,
      h: isMoodboard ? 0.6 : 3.4,
      fontSize: 16,
      color: textSoft,
      lineSpacingMultiple: 1.35,
      valign: 'top',
    })

    if (slide.layout === 'palette' && slide.palettes.length > 0) {
      const palette = slide.palettes[0]
      const swatchW = (PPTX_W - 7.2) / Math.max(palette.colors.length, 1)
      palette.colors.forEach((color, swatchIndex) => {
        s.addShape(PptxGenJs.ShapeType.rect, {
          x: 6.7 + swatchIndex * swatchW,
          y: 2.4,
          w: swatchW,
          h: 2.6,
          fill: { color: hexForPptx(color) },
          line: { type: 'none' },
        })
      })
      s.addText(palette.title, { x: 6.7, y: 5.1, w: PPTX_W - 7.2, h: 0.5, fontSize: 13, color: textSoft })
    } else if (slide.layout === 'diagram' && slide.diagrams.length > 0) {
      slide.diagrams.slice(0, 2).forEach((diagram, diagramIndex) => {
        const y = 0.6 + diagramIndex * 3.3
        s.addShape(PptxGenJs.ShapeType.roundRect, {
          x: 6.7,
          y,
          w: PPTX_W - 7.2,
          h: 3,
          fill: { color: bg },
          line: { color: accent, width: 1 },
          rectRadius: 0.08,
        })
        s.addText(diagram.title, { x: 6.9, y: y + 0.3, w: PPTX_W - 7.6, h: 0.6, fontSize: 18, bold: true, color: textMain })
        s.addText(`${diagram.nodeIds.length} nodes \u00b7 ${diagram.format}`, { x: 6.9, y: y + 1, w: PPTX_W - 7.6, h: 0.5, fontSize: 13, color: textMuted })
      })
    } else if (slide.references.length > 0) {
      const slots = pptxImageSlots(slide.layout, slide.references.length)
      slide.references.slice(0, slots.length).forEach((reference, refIndex) => {
        const slot = slots[refIndex]
        if (!slot) return
        if (reference.thumb) {
          s.addImage({ data: reference.thumb, x: slot.x, y: slot.y, w: slot.w, h: slot.h, sizing: { type: 'cover', w: slot.w, h: slot.h } })
        } else {
          s.addShape(PptxGenJs.ShapeType.roundRect, {
            x: slot.x,
            y: slot.y,
            w: slot.w,
            h: slot.h,
            fill: { color: '1B1E1C' },
            line: { type: 'none' },
            rectRadius: 0.06,
          })
        }
      })
    }

    if (slide.speakerNote) s.addNotes(slide.speakerNote)
  })

  return prs
}

function contactSheetToHtml(
  references: EvidenceImage[],
  ideas: Idea[],
  links: EvidenceLink[],
  metadata: { title: string; generatedAt: string },
) {
  const ideaById = new Map(ideas.map((idea) => [idea.id, idea]))
  const linksByImageId = new Map<string, EvidenceLink[]>()
  links.forEach((link) => {
    linksByImageId.set(link.imageId, [...(linksByImageId.get(link.imageId) ?? []), link])
  })

  const cards = references.length === 0
    ? '<p class="empty">No references in this view.</p>'
    : references.map((reference) => {
        const referenceLinks = linksByImageId.get(reference.id) ?? []
        const linkedIdeas = referenceLinks.length === 0
          ? '<span class="open">Unlinked</span>'
          : referenceLinks.map((link) => {
              const idea = ideaById.get(link.ideaId)
              return `<span>${escapeHtml(idea?.title ?? link.ideaId)} <small>${escapeHtml(relationLabels[link.relation])}</small></span>`
            }).join('')
        const tags = reference.tags.length === 0
          ? '<span class="muted">No tags</span>'
          : reference.tags.slice(0, 6).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')
        const thumb = reference.thumb
          ? `<img src="${escapeAttribute(reference.thumb)}" alt="">`
          : '<div class="missing">Missing</div>'

        return `
          <article>
            ${thumb}
            <div class="card-body">
              <h2>${escapeHtml(reference.title)}</h2>
              <p>${escapeHtml(reference.source)}</p>
              <div class="tags">${tags}</div>
              <div class="ideas">${linkedIdeas}</div>
            </div>
          </article>
        `
      }).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(metadata.title)}</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0d0f0e; color: #ece9dd; }
    body { margin: 0; padding: 40px; background: #0d0f0e; }
    main { max-width: 1180px; margin: 0 auto; }
    header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
    h1 { margin: 0; font-size: 32px; font-weight: 720; }
    .meta { color: #96988e; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
    article { overflow: hidden; border-radius: 8px; background: rgba(255,255,255,.045); }
    img, .missing { display: grid; width: 100%; aspect-ratio: 4 / 3; place-items: center; object-fit: cover; background: rgba(255,255,255,.06); color: #96988e; }
    .card-body { display: grid; gap: 9px; padding: 12px; }
    h2 { overflow: hidden; margin: 0; font-size: 15px; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
    p { overflow: hidden; margin: 0; color: #96988e; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .tags, .ideas { display: flex; flex-wrap: wrap; gap: 6px; }
    .tags span, .ideas span { max-width: 100%; overflow: hidden; padding: 3px 7px; border-radius: 999px; background: rgba(255,255,255,.07); color: #c9c8bd; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .ideas span { background: rgba(132,205,188,.12); color: #d9fff6; }
    .ideas small { color: #9fbeb5; }
    .open { background: rgba(223,174,103,.13) !important; color: #f3d5a7 !important; }
    .muted, .empty { color: #96988e; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>${escapeHtml(metadata.title)}</h1>
        <div class="meta">${references.length} references · Generated: ${escapeHtml(metadata.generatedAt)}</div>
      </div>
    </header>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>
`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function safeDownloadName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'outline'
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

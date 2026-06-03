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
  FileText,
  FilePlus2,
  FolderOpen,
  GitBranch,
  ImagePlus,
  Link2,
  LocateFixed,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Network,
  PanelLeft,
  PanelRight,
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
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react'
import { HexColorPicker } from 'react-colorful'
import { converter, formatHex } from 'culori'
import './styles.css'

type Relation = 'supports' | 'contrasts' | 'example' | 'mood' | 'material' | 'reference'
type Selection =
  | { type: 'idea'; id: string }
  | { type: 'image'; id: string }
  | { type: 'palette'; id: string }
  | { type: 'diagram'; id: string }
  | { type: 'placeholder'; id: string }
  | { type: 'link'; id: string }

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

type ProjectSnapshot = {
  version: 2
  ideas: Idea[]
  images: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  placeholders: PlaceholderNode[]
  aiSettings: AiSettingsSnapshot
  versionHistory: ProjectVersionRecord[]
  links: EvidenceLink[]
  outlineDrafts: OutlineDraft[]
}

type ProjectVersionRecord = {
  id: string
  label: string
  createdAt: string
  snapshotJson: string
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

type VixioCapturePayload = {
  vixioCapture: 1
  kind: 'image' | 'page'
  url: string
  title: string
  source: string
  pageUrl?: string
  capturedAt: string
}

type LibraryDensity = 'compact' | 'relaxed'
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
type AiTaskKind =
  | 'tag_reference'
  | 'classify_reference'
  | 'find_similar'
  | 'generate_palette'
  | 'rebalance_palette'
  | 'generate_outline'
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

const storageKey = 'vixio.project.v2'
const inspectorLinkedListLimit = 8
const outlineReferenceLimit = 6
const libraryOverscan = 5
const duplicateCandidateThreshold = 8
const libraryRowHeights: Record<LibraryDensity, number> = {
  compact: 77,
  relaxed: 94,
}

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
  idea: Idea
  title: string
  summary: string
  references: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  relationCount: number
  layout: 'focus' | 'grid' | 'stack' | 'palette' | 'diagram'
  layoutReason: string
  relationMix: Relation[]
  accent: string
}
type SlideLayoutMode = 'auto' | SlideLayout['layout']
type GlassStatus = 'browser' | 'native' | 'fallback'

type VixioDevApi = {
  loadFixture: (referenceCount?: number) => ProjectSnapshot
  loadDuplicateFixture: () => ProjectSnapshot
  resetSeed: () => ProjectSnapshot
  snapshot: () => {
    ideas: number
    images: number
    palettes: number
    diagrams: number
    placeholders: number
    links: number
    outlineDrafts: number
    selection: Selection
    graph?: GraphMetrics
  }
}

type VixioWindow = Window & {
  __vixioDev?: VixioDevApi
  __vixioGraphMetrics?: GraphMetrics
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
}

const aiProviderStatusLabels: Record<AiProviderStatus, string> = {
  connected: 'connected',
  unavailable: 'unavailable',
  billing_separate: 'billing separate',
  key_missing: 'key missing',
}

const aiRoutingLabels: Record<AiRoutingMode, string> = {
  local_only: 'Local only',
  prefer_local: 'Prefer local, fallback remote',
  selected_remote: 'Selected remote provider',
}

const defaultAiProviderProfiles: AiProviderProfile[] = [
  {
    id: 'apple-foundation',
    type: 'apple_foundation',
    name: 'Apple Foundation Models',
    authMode: 'local',
    model: 'system default',
    status: 'unavailable',
    defaultFor: ['tag_reference', 'classify_reference', 'generate_outline', 'summarize_diagram'],
  },
  {
    id: 'openai',
    type: 'openai',
    name: 'OpenAI Platform',
    authMode: 'api_key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    status: 'key_missing',
    defaultFor: ['generate_outline', 'summarize_diagram'],
  },
  {
    id: 'anthropic',
    type: 'anthropic',
    name: 'Anthropic Console',
    authMode: 'api_key',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-latest',
    status: 'key_missing',
    defaultFor: ['generate_outline'],
  },
  {
    id: 'gemini',
    type: 'gemini',
    name: 'Gemini API',
    authMode: 'api_key',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-1.5-pro',
    status: 'key_missing',
    defaultFor: ['classify_reference', 'generate_palette'],
  },
  {
    id: 'openrouter',
    type: 'openrouter',
    name: 'OpenRouter',
    authMode: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'auto',
    status: 'key_missing',
    defaultFor: ['find_similar', 'generate_outline'],
  },
  {
    id: 'ollama',
    type: 'ollama',
    name: 'Ollama',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    status: 'unavailable',
    defaultFor: ['tag_reference', 'classify_reference'],
  },
  {
    id: 'lm-studio',
    type: 'lm_studio',
    name: 'LM Studio',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    status: 'unavailable',
    defaultFor: ['tag_reference'],
  },
]

function defaultAiSettingsSnapshot(): AiSettingsSnapshot {
  return {
    providers: defaultAiProviderProfiles,
    routingMode: 'prefer_local',
    selectedProviderId: 'openai',
  }
}

function App() {
  const initialProject = useMemo(() => readProjectSnapshot(), [])
  const [ideas, setIdeas] = useState(initialProject.ideas)
  const [images, setImages] = useState(initialProject.images)
  const [palettes, setPalettes] = useState(initialProject.palettes)
  const [diagrams, setDiagrams] = useState(initialProject.diagrams)
  const [placeholders, setPlaceholders] = useState(initialProject.placeholders)
  const [links, setLinks] = useState(initialProject.links)
  const [versionHistory, setVersionHistory] = useState(initialProject.versionHistory)
  const [outlineDrafts, setOutlineDrafts] = useState(initialProject.outlineDrafts)
  const [lastSavedHash, setLastSavedHash] = useState(() => JSON.stringify(initialProject))
  const [projectPackage, setProjectPackage] = useState<ProjectPackageInfo | null>(null)
  const [selection, setSelection] = useState<Selection>({ type: 'idea', id: 'idea-ritual-tools' })
  const [activeView, setActiveView] = useState<ActiveView>('Canvas')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [density, setDensity] = useState<LibraryDensity>('compact')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [batchTag, setBatchTag] = useState('')
  const [libraryStatus, setLibraryStatus] = useState('Ready')
  const [outlineStatus, setOutlineStatus] = useState('Ready')
  const [slideshowStatus, setSlideshowStatus] = useState('Ready')
  const [linkCreationRelation, setLinkCreationRelation] = useState<Relation>('supports')
  const [ocrRunningImageId, setOcrRunningImageId] = useState<string | null>(null)
  const [ocrStatusByImageId, setOcrStatusByImageId] = useState<Record<string, string>>({})
  const [localModelAvailable, setLocalModelAvailable] = useState(false)
  const [localModelStatus, setLocalModelStatus] = useState('Not checked')
  const [aiProviders, setAiProviders] = useState<AiProviderProfile[]>(initialProject.aiSettings.providers)
  const [aiRoutingMode, setAiRoutingMode] = useState<AiRoutingMode>(initialProject.aiSettings.routingMode)
  const [selectedAiProviderId, setSelectedAiProviderId] = useState(initialProject.aiSettings.selectedProviderId)
  const [aiSettingsStatus, setAiSettingsStatus] = useState('Local-first routing is active')
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
  const canUndoCanvas = useStore(useCanvasHistoryStore.temporal, (state) => state.pastStates.length > 0)
  const canRedoCanvas = useStore(useCanvasHistoryStore.temporal, (state) => state.futureStates.length > 0)
  const projectSnapshot = useMemo(
    () => toProjectSnapshot(ideas, images, links, outlineDrafts, palettes, diagrams, placeholders, {
      providers: aiProviders,
      routingMode: aiRoutingMode,
      selectedProviderId: selectedAiProviderId,
    }, versionHistory),
    [aiProviders, aiRoutingMode, diagrams, ideas, images, links, outlineDrafts, palettes, placeholders, selectedAiProviderId, versionHistory],
  )
  const projectHash = useMemo(() => JSON.stringify(projectSnapshot), [projectSnapshot])
  const selected = useMemo(
    () => resolveSelection(selection, ideas, images, links, palettes, diagrams, placeholders),
    [selection, ideas, images, links, palettes, diagrams, placeholders],
  )
  const visibleImages = useMemo(
    () => filterImages(images, searchQuery, selectedTag, sortMode),
    [images, searchQuery, selectedTag, sortMode],
  )
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
      color: { red: 11, green: 12, blue: 11, alpha: 190 },
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

  useEffect(() => {
    if (!isTauriRuntime()) return

    void openNativeProjectPackage().then((snapshot) => {
      if (!snapshot) return
      applyProjectSnapshot(snapshot)
    })
  }, [])

  useEffect(() => {
    if (!isTauriRuntime()) return

    void checkNativeFoundationModelAvailability()
      .then((availability) => {
        setLocalModelAvailable(availability.available)
        setLocalModelStatus(availability.reason || availability.status)
        setAiProviders((current) =>
          current.map((provider) =>
            provider.id === 'apple-foundation'
              ? { ...provider, status: availability.available ? 'connected' : 'unavailable' }
              : provider,
          ),
        )
      })
      .catch(() => {
        setLocalModelAvailable(false)
        setLocalModelStatus('Unavailable')
        setAiProviders((current) =>
          current.map((provider) =>
            provider.id === 'apple-foundation' ? { ...provider, status: 'unavailable' } : provider,
          ),
        )
      })
  }, [])

  useEffect(() => {
    if (!isTauriRuntime()) return

    let unlisten: (() => void) | undefined
    void listen<string>('vixio:capture', (event) => {
      const capture = parseVixioCapturePayload(event.payload)
      if (!capture) return
      appendReferences([createReferenceFromCapture(capture, images.length)], '1 browser capture imported')
    }).then((cleanup) => {
      unlisten = cleanup
    })

    return () => unlisten?.()
  }, [images])

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
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  }, [ideas.length])

  useEffect(() => {
    if (!isDevRuntime()) return

    const devWindow = window as VixioWindow
    devWindow.__vixioDev = {
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
      snapshot() {
        return {
          ideas: ideas.length,
          images: images.length,
          palettes: palettes.length,
          diagrams: diagrams.length,
          placeholders: placeholders.length,
          links: links.length,
          outlineDrafts: outlineDrafts.length,
          selection,
          graph: devWindow.__vixioGraphMetrics,
        }
      },
    }

    return () => {
      delete devWindow.__vixioDev
    }
  }, [diagrams, ideas, images, links, outlineDrafts, palettes, placeholders, selection])

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
    setIdeas(snapshot.ideas)
    setImages(snapshot.images)
    setPalettes(snapshot.palettes)
    setDiagrams(snapshot.diagrams)
    setPlaceholders(snapshot.placeholders)
    setLinks(snapshot.links)
    setOutlineDrafts(snapshot.outlineDrafts)
    setAiProviders(snapshot.aiSettings.providers)
    setAiRoutingMode(snapshot.aiSettings.routingMode)
    setSelectedAiProviderId(snapshot.aiSettings.selectedProviderId)
    setVersionHistory(snapshot.versionHistory)
    setSelectedReferenceIds(new Set())
    setSelection({ type: 'idea', id: snapshot.ideas[0]?.id ?? 'idea-ritual-tools' })
    setLastSavedHash(hash)
    window.localStorage.setItem(storageKey, hash)
    resetCanvasHistory({
      ideas: snapshot.ideas,
      images: snapshot.images,
      palettes: snapshot.palettes,
      diagrams: snapshot.diagrams,
      placeholders: snapshot.placeholders,
      links: snapshot.links,
      selection: { type: 'idea', id: snapshot.ideas[0]?.id ?? 'idea-ritual-tools' },
    })
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
    const existingKeys = new Set(images.map(referenceDuplicateKey))
    const next: EvidenceImage[] = []
    for (const image of imported) {
      const duplicateKey = referenceDuplicateKey(image)
      if (existingKeys.has(duplicateKey)) continue
      existingKeys.add(duplicateKey)
      next.push(image)
    }
    const skipped = imported.length - next.length

    if (next.length > 0) {
      setImages((current) => [...current, ...next])
      const last = next.at(-1)
      if (last) setSelection({ type: 'image', id: last.id })
    }

    setLibraryStatus(
      skipped > 0
        ? `${next.length} added · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped`
        : fallbackStatus,
    )
  }

  async function importReferences(files: FileList | File[]) {
    const imageFiles = [...files].filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const imported = await Promise.all(
      imageFiles.map((file, index) => createReferenceFromFile(file, images.length + index)),
    )
    appendReferences(imported, `${imported.length} reference${imported.length === 1 ? '' : 's'} imported`)
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
      await importReferences([imageFile])
      return
    }

    const pastedText = event.clipboardData.getData('text/plain').trim()
    if (!pastedText) return

    const extensionCaptures = parseVixioCapturePayloads(pastedText)
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
    const extensionCaptures = parseVixioCapturePayloads(pastedText)
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

  function createLink(imageId: string, ideaId: string, relation = linkCreationRelation) {
    const existing = links.find((link) => link.imageId === imageId && link.ideaId === ideaId)
    if (existing) {
      setSelection({ type: 'link', id: existing.id })
      return
    }

    const timestamp = nowIso()
    const link: EvidenceLink = {
      id: `link-${Date.now()}`,
      imageId,
      ideaId,
      sourceNodeId: imageId,
      targetNodeId: ideaId,
      sourceKind: 'image',
      targetKind: 'idea',
      relation,
      note: 'New evidence link created from the graph canvas.',
      confidence: 0.52,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    setLinks((current) => [...current, link])
    setSelection({ type: 'link', id: link.id })
  }

  function updateRelation(linkId: string, relation: Relation) {
    setLinks((current) => current.map((link) => (link.id === linkId ? { ...link, relation, updatedAt: nowIso() } : link)))
  }

  function updateIdea(ideaId: string, patch: Partial<Pick<Idea, 'title' | 'body'>>) {
    setIdeas((current) => current.map((idea) => (idea.id === ideaId ? { ...idea, ...patch, updatedAt: nowIso() } : idea)))
  }

  function updateImage(imageId: string, patch: Partial<Pick<EvidenceImage, 'title' | 'sourceUrl' | 'notes'>>) {
    setImages((current) => current.map((image) => (image.id === imageId ? { ...image, ...patch, updatedAt: nowIso() } : image)))
  }

  function updateLink(linkId: string, patch: Partial<Pick<EvidenceLink, 'relation' | 'note'>>) {
    setLinks((current) => current.map((link) => (link.id === linkId ? { ...link, ...patch, updatedAt: nowIso() } : link)))
  }

  function updatePalette(paletteId: string, patch: Partial<Pick<PaletteNode, 'title' | 'sourceUrl' | 'notes'>>) {
    setPalettes((current) => current.map((palette) => (palette.id === paletteId ? { ...palette, ...patch, updatedAt: nowIso() } : palette)))
  }

  function updateDiagram(diagramId: string, patch: Partial<Pick<DiagramNode, 'title' | 'sourceUrl' | 'notes'>>) {
    setDiagrams((current) => current.map((diagram) => (diagram.id === diagramId ? { ...diagram, ...patch, updatedAt: nowIso() } : diagram)))
  }

  function updatePlaceholder(placeholderId: string, patch: Partial<Pick<PlaceholderNode, 'title' | 'sourceUrl' | 'notes'>>) {
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
      setIdeas((current) =>
        current.map((idea) =>
          idea.id === id
            ? { ...idea, importance: adjustImportance(idea.importance, delta), updatedAt: timestamp }
            : idea,
        ),
      )
      return
    }

    setImages((current) =>
      current.map((image) =>
        image.id === id
          ? { ...image, importance: adjustImportance(image.importance, delta), updatedAt: timestamp }
          : image,
      ),
    )

    if (kind === 'palette') {
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
      setPlaceholders((current) =>
        current.map((placeholder) =>
          placeholder.id === id
            ? { ...placeholder, importance: adjustImportance(placeholder.importance, delta), updatedAt: timestamp }
            : placeholder,
        ),
      )
    }
  }

  function organizeCanvas(mode: GraphOrganizeMode) {
    if (mode === 'manual') return
    pushCanvasHistory()
    const layout = organizeGraphLayout(mode, ideas, images, links, selection)
    const auxiliaryLayout = organizeAuxiliaryNodes(mode, palettes, diagrams, placeholders)
    setIdeas(layout.ideas)
    setImages(layout.images)
    setPalettes(auxiliaryLayout.palettes)
    setDiagrams(auxiliaryLayout.diagrams)
    setPlaceholders(auxiliaryLayout.placeholders)
  }

  function updateAiProvider(providerId: string, patch: Partial<Pick<AiProviderProfile, 'baseUrl' | 'model' | 'authMode'>>) {
    setAiProviders((current) =>
      current.map((provider) => (provider.id === providerId ? { ...provider, ...patch } : provider)),
    )
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
          provider.id === providerId ? { ...provider, secretRef: `keychain:${providerId}` } : provider,
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
            ? { ...candidate, status: providerStatusFromNative(result.status, result.connected) }
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
      colors: sourceImage?.palette?.length ? sourceImage.palette.slice(0, 6) : generatePaletteHarmony(base, 'analogous'),
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
    setPalettes((current) => [...current, palette])
    setSelection({ type: 'palette', id: palette.id })
  }

  function updatePaletteColor(paletteId: string, colorIndex: number, color: string) {
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

  function regeneratePalette(paletteId: string, algorithm: PaletteHarmony) {
    pushCanvasHistory()
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
    setLinks((current) => current.filter((link) => link.ideaId !== ideaId))
    const fallback = nextIdeas[0]
    if (fallback) setSelection({ type: 'idea', id: fallback.id })
  }

  function deleteImage(imageId: string) {
    pushCanvasHistory()
    const nextImages = images.filter((image) => image.id !== imageId)
    setImages(nextImages)
    setLinks((current) => current.filter((link) => link.imageId !== imageId))
    setPalettes((current) => current.filter((palette) => palette.sourceImageId !== imageId))
    const fallbackIdea = ideas[0]
    const fallbackImage = nextImages[0]
    setSelection(fallbackImage ? { type: 'image', id: fallbackImage.id } : { type: 'idea', id: fallbackIdea?.id ?? 'idea-ritual-tools' })
  }

  function deletePalette(paletteId: string) {
    pushCanvasHistory()
    const nextPalettes = palettes.filter((palette) => palette.id !== paletteId)
    setPalettes(nextPalettes)
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
          !diagramIdeaIds.has(link.targetNodeId ?? ''),
      ),
    )
    setSelection({ type: 'idea', id: fallbackIdeas[0].id })
  }

  function deletePlaceholder(placeholderId: string) {
    pushCanvasHistory()
    const nextPlaceholders = placeholders.filter((placeholder) => placeholder.id !== placeholderId)
    setPlaceholders(nextPlaceholders)
    setSelection(nextPlaceholders[0] ? { type: 'placeholder', id: nextPlaceholders[0].id } : { type: 'idea', id: ideas[0]?.id ?? 'idea-ritual-tools' })
  }

  function deleteLink(linkId: string) {
    const link = links.find((candidate) => candidate.id === linkId)
    pushCanvasHistory()
    setLinks((current) => current.filter((candidate) => candidate.id !== linkId))
    if (link) setSelection({ type: 'idea', id: link.ideaId })
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
    const image = images.find((candidate) => candidate.id === link.imageId)
    const idea = ideas.find((candidate) => candidate.id === link.ideaId)
    setPendingDelete({
      type: 'link',
      id: link.id,
      title: `${image?.title ?? 'Reference'} -> ${idea?.title ?? 'Idea'}`,
    })
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
    const slides = applySlideLayoutMode(buildSlideLayouts(ideas, images, links, palettes, diagrams), layoutMode)
    const html = slideLayoutsToHtml(slides, {
      title: 'Slides',
      generatedAt: new Date().toISOString(),
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

    downloadTextFile(html, 'vixio-slides.html', 'text/html')
    setSlideshowStatus('Slides downloaded')
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
      versionHistory: [],
      outlineDrafts,
      aiSettings: {
        providers: aiProviders,
        routingMode: aiRoutingMode,
        selectedProviderId: selectedAiProviderId,
      },
    } satisfies ProjectSnapshot
  }

  function saveAsNewVersion(label = `Version ${versionHistory.length + 1}`) {
    const timestamp = nowIso()
    const record: ProjectVersionRecord = {
      id: `version-${Date.now()}`,
      label,
      createdAt: timestamp,
      snapshotJson: JSON.stringify(snapshotForVersionArchive(label)),
    }
    setVersionHistory((current) => [record, ...current].slice(0, 50))
    setLibraryStatus('Version saved')
  }

  function restoreProjectVersion(versionId: string) {
    const record = versionHistory.find((candidate) => candidate.id === versionId)
    if (!record) return
    try {
      const parsed = JSON.parse(record.snapshotJson)
      if (!isProjectSnapshot(parsed)) return
      applyProjectSnapshot({
        ...parsed,
        versionHistory,
      })
      setLibraryStatus(`Restored ${record.label}`)
      setIsVersionHistoryOpen(false)
    } catch {
      setLibraryStatus('Version restore failed')
    }
  }

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
      defaultPath: projectPackage?.path ?? 'Vixio Project.vixio',
      filters: [{ name: 'Vixio Project', extensions: ['vixio'] }],
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
      defaultPath: 'Untitled.vixio',
      filters: [{ name: 'Vixio Project', extensions: ['vixio'] }],
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
      title: 'Open Vixio Project',
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

  return (
    <main className="app-shell" data-glass-state={glassStatus} onPaste={capturePastedReference}>
      <TopBar
        activeView={activeView}
        projectPackage={projectPackage}
        saveLabel={projectHash === lastSavedHash ? 'Saved' : 'Save'}
        setActiveView={setActiveView}
        onCreateIdea={() => createIdea({ focusTitle: true })}
        onImportProject={importProject}
        onNewProject={newProject}
        onOpenProject={openProject}
        onUndo={undoCanvas}
        onRedo={redoCanvas}
        canUndo={canUndoCanvas}
        canRedo={canRedoCanvas}
        onSaveProject={saveProject}
        onSaveProjectAs={saveProjectAs}
        onSaveVersion={saveProjectAsNewVersion}
        onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
      />
      <SecondaryRail
        canUndo={canUndoCanvas}
        canRedo={canRedoCanvas}
        saveLabel={projectHash === lastSavedHash ? 'Saved' : 'Save'}
        onNewProject={newProject}
        onOpenProject={openProject}
        onSaveProject={saveProject}
        onSaveVersion={saveProjectAsNewVersion}
        onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
        onUndo={undoCanvas}
        onRedo={redoCanvas}
        onOpenSettings={() => setActiveView('Settings')}
      />
      <section
        className={[
          'workspace',
          isLibraryCollapsed ? 'is-library-collapsed' : '',
          isInspectorCollapsed ? 'is-inspector-collapsed' : '',
          isLibraryFloating ? 'is-library-floating' : '',
          isInspectorFloating ? 'is-inspector-floating' : '',
        ].filter(Boolean).join(' ')}
      >
        <EvidenceInbox
          allTags={libraryTags}
          density={density}
          isCollapsed={isLibraryCollapsed}
          images={visibleImages}
          selectedTag={selectedTag}
          sortMode={sortMode}
          totalCount={images.length}
          batchTag={batchTag}
          searchQuery={searchQuery}
          status={libraryStatus}
          selectedReferenceIds={selectedReferenceIds}
          selected={selection}
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
          onToggleCollapsed={() => setIsLibraryCollapsed((current) => !current)}
          onToggleFloating={() => setIsLibraryFloating((current) => !current)}
        />
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
            onExportHtml={exportSlideshowHtml}
            onSelect={setSelection}
          />
        ) : activeView === 'Settings' ? (
          <SettingsView
            providers={aiProviders}
            taskRoutes={aiTaskRoutes}
            routingMode={aiRoutingMode}
            selectedProviderId={selectedAiProviderId}
            localModelAvailable={localModelAvailable}
            localModelStatus={localModelStatus}
            status={aiSettingsStatus}
            onProviderChange={updateAiProvider}
            onProviderSecretSave={saveAiProviderSecret}
            onProviderSecretDelete={deleteAiProviderSecret}
            onProviderTest={testAiProvider}
            onProviderModelsList={listAiModels}
            onRoutingModeChange={setAiRoutingMode}
            onSelectedProviderChange={setSelectedAiProviderId}
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
            selected={selection}
            onSelect={setSelection}
            onCreateLink={createLink}
            onCreateIdea={() => createIdea({ focusTitle: true })}
            onCreatePalette={() => createPaletteNode(selection.type === 'image' ? images.find((image) => image.id === selection.id) : undefined)}
            onCreatePlaceholder={createPlaceholder}
            onImportMermaid={importMermaidDiagram}
            onLinkCreationRelationChange={setLinkCreationRelation}
            onNodeMove={moveGraphNode}
            onNodeImportanceChange={changeNodeImportance}
            onOrganize={organizeCanvas}
          />
        )}
        <Inspector
          isCollapsed={isInspectorCollapsed}
          selected={selected}
          images={images}
          ideas={ideas}
          palettes={palettes}
          diagrams={diagrams}
          placeholders={placeholders}
          links={links}
          onSelect={setSelection}
          onAcceptSuggestion={acceptSuggestion}
          onRejectSuggestion={rejectSuggestion}
          onRelationChange={updateRelation}
          onIdeaChange={updateIdea}
          onImageChange={updateImage}
          onLinkChange={updateLink}
          onPaletteChange={updatePalette}
          onDiagramChange={updateDiagram}
          onPlaceholderChange={updatePlaceholder}
          onPaletteColorChange={updatePaletteColor}
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
          onOpenOutline={() => setActiveView('Outline')}
          onRebuildOutline={rebuildOutlineDraft}
          onReferenceOcr={runReferenceOcr}
          onReferenceTagRefine={refineReferenceTags}
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
      </section>
      {isLibraryFloating && (
        <FloatingPanel title="Library" defaultPosition={{ x: 72, y: 92 }} defaultSize={{ width: 330, height: 620 }}>
          <EvidenceInbox
            allTags={libraryTags}
            density={density}
            isCollapsed={false}
            images={visibleImages}
            selectedTag={selectedTag}
            sortMode={sortMode}
            totalCount={images.length}
            batchTag={batchTag}
            searchQuery={searchQuery}
            status={libraryStatus}
            selectedReferenceIds={selectedReferenceIds}
            selected={selection}
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
            onSelect={setSelection}
            onAcceptSuggestion={acceptSuggestion}
            onRejectSuggestion={rejectSuggestion}
            onRelationChange={updateRelation}
            onIdeaChange={updateIdea}
            onImageChange={updateImage}
            onLinkChange={updateLink}
            onPaletteChange={updatePalette}
            onDiagramChange={updateDiagram}
            onPlaceholderChange={updatePlaceholder}
            onPaletteColorChange={updatePaletteColor}
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
            onOpenOutline={() => setActiveView('Outline')}
            onRebuildOutline={rebuildOutlineDraft}
            onReferenceOcr={runReferenceOcr}
            onReferenceTagRefine={refineReferenceTags}
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
        versions={versionHistory}
        onClose={() => setIsVersionHistoryOpen(false)}
        onRestore={restoreProjectVersion}
      />
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

function TopBar({
  activeView,
  projectPackage,
  saveLabel,
  setActiveView,
  onCreateIdea,
  onImportProject,
  onNewProject,
  onOpenProject,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSaveProject,
  onSaveProjectAs,
  onSaveVersion,
  onOpenVersionHistory,
}: {
  activeView: ActiveView
  projectPackage: ProjectPackageInfo | null
  saveLabel: string
  setActiveView: (view: ActiveView) => void
  onCreateIdea: () => void
  onImportProject: (file: File) => void
  onNewProject: () => void
  onOpenProject: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onSaveProject: () => void
  onSaveProjectAs: () => void
  onSaveVersion: () => void
  onOpenVersionHistory: () => void
}) {
  const importInput = useRef<HTMLInputElement>(null)
  const views: { label: ActiveView; icon: typeof Network }[] = [
    { label: 'Canvas', icon: Network },
    { label: '3D', icon: CircleDot },
    { label: 'Slides', icon: FileText },
    { label: 'Outline', icon: FileText },
    { label: 'Settings', icon: Settings },
  ]

  return (
    <header
      className="topbar"
      data-tauri-drag-region
      onDoubleClick={toggleWindowMaximizeFromChrome}
      onPointerDown={startWindowDrag}
    >
      <div className="brand-lockup" data-tauri-drag-region>
        <WindowControls />
        <div className="brand-mark">
          <GitBranch size={17} />
        </div>
        <div data-tauri-drag-region>
          <div className="brand-name">Vixio</div>
          <div className="project-name">Material Memory Study</div>
        </div>
      </div>

      <nav className="view-switch" aria-label="View">
        {views.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={activeView === label ? 'view-tab is-active' : 'view-tab'}
            type="button"
            onClick={() => setActiveView(label)}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="top-actions">
        {!isTauriRuntime() && (
          <button className="quiet-button" type="button" onClick={() => importInput.current?.click()}>
            <ArrowDownToLine size={15} />
            Import
          </button>
        )}
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
        {projectPackage && <span className="package-status">Package</span>}
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
  onOpenSettings,
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
  onOpenSettings: () => void
}) {
  const items = [
    { label: 'New', icon: FilePlus2, onClick: onNewProject, disabled: false },
    { label: 'Open', icon: FolderOpen, onClick: onOpenProject, disabled: !isTauriRuntime() },
    { label: saveLabel, icon: Save, onClick: onSaveProject, disabled: false },
    { label: 'New version', icon: GitBranch, onClick: onSaveVersion, disabled: false },
    { label: 'Version history', icon: FileText, onClick: onOpenVersionHistory, disabled: false },
    { label: 'Undo', icon: Undo2, onClick: onUndo, disabled: !canUndo },
    { label: 'Redo', icon: Redo2, onClick: onRedo, disabled: !canRedo },
    { label: 'Settings', icon: Settings, onClick: onOpenSettings, disabled: false },
  ]

  return (
    <aside className="secondary-rail" aria-label="File and history tools">
      {items.map(({ label, icon: Icon, onClick, disabled }) => (
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

function SettingsView({
  providers,
  taskRoutes,
  routingMode,
  selectedProviderId,
  localModelAvailable,
  localModelStatus,
  status,
  onProviderChange,
  onProviderSecretSave,
  onProviderSecretDelete,
  onProviderTest,
  onProviderModelsList,
  onRoutingModeChange,
  onSelectedProviderChange,
}: {
  providers: AiProviderProfile[]
  taskRoutes: AiTaskRoute[]
  routingMode: AiRoutingMode
  selectedProviderId: string
  localModelAvailable: boolean
  localModelStatus: string
  status: string
  onProviderChange: (providerId: string, patch: Partial<Pick<AiProviderProfile, 'baseUrl' | 'model' | 'authMode'>>) => void
  onProviderSecretSave: (providerId: string, secret: string) => void
  onProviderSecretDelete: (providerId: string) => void
  onProviderTest: (providerId: string) => void
  onProviderModelsList: (providerId: string) => void
  onRoutingModeChange: (mode: AiRoutingMode) => void
  onSelectedProviderChange: (providerId: string) => void
}) {
  const remoteProviders = providers.filter((provider) => provider.authMode !== 'local')
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({})

  return (
    <section className="settings-shell" aria-label="Settings">
      <div className="settings-scroll">
        <div className="settings-header">
          <div>
            <h2>Settings</h2>
            <p>Chat subscription is not API access. Use official API key or official OAuth only.</p>
          </div>
          <span className="settings-status">{status}</span>
        </div>

        <section className="settings-section">
          <div className="settings-section-heading">
            <h3>AI Providers</h3>
            <p>Provider profiles store metadata in the project. Secrets must live in secure storage.</p>
          </div>
          <div className="provider-grid">
            {providers.map((provider) => (
              <article className="provider-card" key={provider.id} data-status={provider.status}>
                <div className="provider-card-header">
                  <div>
                    <strong>{provider.name}</strong>
                    <span>{aiProviderTypeLabels[provider.type]}</span>
                  </div>
                  <em>{aiProviderStatusLabels[provider.status]}</em>
                </div>
                <label>
                  <span>Auth mode</span>
                  <select
                    value={provider.authMode}
                    onChange={(event) => onProviderChange(provider.id, { authMode: event.target.value as AiAuthMode })}
                    disabled={provider.authMode === 'local'}
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
                    value={provider.baseUrl ?? ''}
                    placeholder={provider.authMode === 'local' ? 'local runtime' : 'https://api.example.com/v1'}
                    onChange={(event) => onProviderChange(provider.id, { baseUrl: event.target.value })}
                    disabled={provider.authMode === 'local'}
                  />
                </label>
                <label>
                  <span>Model</span>
                  <input
                    value={provider.model}
                    onChange={(event) => onProviderChange(provider.id, { model: event.target.value })}
                    disabled={provider.authMode === 'local'}
                  />
                </label>
                <div className="provider-task-list">
                  {provider.defaultFor.slice(0, 3).map((task) => (
                    <span key={task}>{aiTaskLabels[task]}</span>
                  ))}
                </div>
                {provider.authMode === 'oauth' && (
                  <div className="oauth-ready-note">
                    <strong>OAuth-ready profile</strong>
                    <span>Connect is disabled until this provider exposes an official desktop-safe OAuth flow for API billing.</span>
                  </div>
                )}
                {provider.authMode !== 'local' && (
                  <label>
                    <span>Secret</span>
                    <input
                      value={secretDrafts[provider.id] ?? ''}
                      type="password"
                      placeholder={provider.secretRef ? 'Stored in Keychain' : 'API key'}
                      onChange={(event) =>
                        setSecretDrafts((current) => ({ ...current, [provider.id]: event.target.value }))
                      }
                    />
                  </label>
                )}
                <div className="provider-actions-row">
                  {provider.authMode !== 'local' && (
                    <>
                      <button
                        className="quiet-button provider-test-button"
                        type="button"
                        onClick={() => {
                          onProviderSecretSave(provider.id, secretDrafts[provider.id] ?? '')
                          setSecretDrafts((current) => ({ ...current, [provider.id]: '' }))
                        }}
                      >
                        Save secret
                      </button>
                      <button className="quiet-button provider-test-button" type="button" onClick={() => onProviderSecretDelete(provider.id)}>
                        Delete
                      </button>
                    </>
                  )}
                  <button className="quiet-button provider-test-button" type="button" onClick={() => onProviderTest(provider.id)}>
                    Test
                  </button>
                  <button className="quiet-button provider-test-button" type="button" onClick={() => onProviderModelsList(provider.id)}>
                    Models
                  </button>
                  {provider.authMode === 'oauth' && (
                    <button className="quiet-button provider-test-button" type="button" disabled>
                      Connect OAuth
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="settings-section settings-two-column">
          <div className="settings-panel">
            <h3>Local Models</h3>
            <dl className="settings-definition-list">
              <div>
                <dt>Apple Foundation Models</dt>
                <dd>{localModelAvailable ? 'available' : 'unavailable'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{localModelStatus}</dd>
              </div>
            </dl>
          </div>

          <div className="settings-panel">
            <h3>Defaults</h3>
            <label>
              <span>Task routing</span>
              <select value={routingMode} onChange={(event) => onRoutingModeChange(event.target.value as AiRoutingMode)}>
                {Object.keys(aiRoutingLabels).map((mode) => (
                  <option key={mode} value={mode}>
                    {aiRoutingLabels[mode as AiRoutingMode]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Remote provider</span>
              <select value={selectedProviderId} onChange={(event) => onSelectedProviderChange(event.target.value)}>
                {remoteProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="task-route-list" aria-label="AI task routing preview">
              {taskRoutes.map((route) => (
                <div className="task-route-row" key={route.task}>
                  <span>{aiTaskLabels[route.task]}</span>
                  <strong>{route.providerName}</strong>
                  <em>{route.reason}</em>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-section settings-two-column">
          <div className="settings-panel">
            <h3>Secrets</h3>
            <p>API keys and OAuth tokens are not written to project files. Provider cards save secrets to macOS Keychain and keep only a secret reference id in project metadata.</p>
            <div className="settings-command-list">
              <code>save_provider_secret(providerId, secret)</code>
              <code>delete_provider_secret(providerId)</code>
              <code>test_ai_provider(providerId)</code>
              <code>list_ai_models(providerId)</code>
            </div>
          </div>

          <div className="settings-panel">
            <h3>Usage</h3>
            <p>Remote AI remains optional. Outputs from tagging, classification, palette, outline, and diagram tasks are suggestions until accepted.</p>
            <ul className="settings-note-list">
              <li>OpenAI, Claude, and Gemini subscriptions have separate API billing.</li>
              <li>Browser cookies and session tokens are never accepted.</li>
              <li>OAuth is enabled only for official desktop-safe provider flows.</li>
            </ul>
          </div>
        </section>
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
  density,
  isCollapsed,
  images,
  selectedTag,
  sortMode,
  totalCount,
  batchTag,
  searchQuery,
  status,
  selectedReferenceIds,
  selected,
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
  onToggleCollapsed,
  onToggleFloating,
}: {
  allTags: string[]
  density: LibraryDensity
  isCollapsed: boolean
  images: EvidenceImage[]
  selectedTag: string | null
  sortMode: SortMode
  totalCount: number
  batchTag: string
  searchQuery: string
  status: string
  selectedReferenceIds: Set<string>
  selected: Selection
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
  const rowHeight = libraryRowHeights[density]
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
  }, [density, searchQuery, selectedTag, sortMode])

  if (isCollapsed) {
    return (
      <aside className="inbox panel inbox--collapsed">
        <button className="icon-button" type="button" aria-label="Expand library" onClick={onToggleCollapsed}>
          <PanelRight size={16} />
        </button>
      </aside>
    )
  }

  return (
    <aside
      className={isDraggingFiles ? 'inbox panel is-dragging-files' : 'inbox panel'}
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
          <p className="panel-kicker">Library</p>
          <h2>References</h2>
          <span className="panel-meta">
            {images.length}/{totalCount} refs · {unassigned.length} suggestions
          </span>
        </div>
        <div className="panel-actions">
          <button className="icon-button" type="button" aria-label="Collapse library" onClick={onToggleCollapsed}>
            <PanelLeft size={16} />
          </button>
          <button className="icon-button" type="button" aria-label="Undock library" onClick={onToggleFloating}>
            <Maximize2 size={15} />
          </button>
          <button className="icon-button" type="button" aria-label="Import image" onClick={() => importInput.current?.click()}>
            <ImagePlus size={16} />
          </button>
          <button className="icon-button" type="button" aria-label="Paste URL" onClick={onCaptureClipboard}>
            <Clipboard size={16} />
          </button>
          <button
            aria-expanded={isToolsOpen}
            className={isToolsOpen ? 'icon-button is-active' : 'icon-button'}
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
          aria-label="Search references"
          value={searchQuery}
          placeholder="Search references"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      {isToolsOpen && (
        <div className="library-drawer">
          <div className="library-drawer-actions" aria-label="Library actions">
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
        </div>
      )}

      <div
        className={`image-list image-list--${density}`}
        data-rendered-count={visibleImages.length}
        data-total-count={images.length}
        ref={listRef}
        onScroll={(event) => setLibraryScrollTop(event.currentTarget.scrollTop)}
      >
        {images.length > 0 ? (
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
            <strong>No references</strong>
            <button type="button" onClick={() => importInput.current?.click()}>
              Import images
            </button>
          </div>
        )}
      </div>
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
  selected,
  onSelect,
  onCreateLink,
  onCreateIdea,
  onCreatePalette,
  onCreatePlaceholder,
  onImportMermaid,
  onLinkCreationRelationChange,
  onNodeMove,
  onNodeImportanceChange,
  onOrganize,
}: {
  ideas: Idea[]
  images: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  placeholders: PlaceholderNode[]
  links: EvidenceLink[]
  linkCreationRelation: Relation
  selected: Selection
  onSelect: (selection: Selection) => void
  onCreateLink: (imageId: string, ideaId: string, relation?: Relation) => void
  onCreateIdea: () => void
  onCreatePalette: () => void
  onCreatePlaceholder: () => void
  onImportMermaid: (source: string) => void | Promise<void>
  onLinkCreationRelationChange: (relation: Relation) => void
  onNodeMove: (kind: GraphNodeKind, id: string, position: Pick<Idea, 'x' | 'y'>) => void
  onNodeImportanceChange: (kind: GraphNodeKind, id: string, delta: number) => void
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
  const graphMetrics = useMemo<GraphMetrics>(() => ({
    mode: graphMode,
    cap: graphCap,
    totalNodes: ideas.length + images.length + palettes.length + diagrams.length + placeholders.length,
    visibleNodes: displayView.ideas.length + displayView.images.length + palettes.length + diagrams.length + placeholders.length,
    visibleIdeas: displayView.ideas.length,
    visibleImages: displayView.images.length,
    visibleLinks: displayView.links.length,
    visibleSuggestions: displaySuggestions.length,
  }), [diagrams.length, displaySuggestions.length, displayView, graphCap, graphMode, ideas.length, images.length, palettes.length, placeholders.length])

  useEffect(() => {
    if (!isDevRuntime()) return
    ;(window as VixioWindow).__vixioGraphMetrics = graphMetrics
  }, [graphMetrics])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-node-kind][data-node-id]') : null
      if (!target) return
      const kind = target.dataset.nodeKind as GraphNodeKind | undefined
      const id = target.dataset.nodeId
      if ((kind !== 'idea' && kind !== 'image') || !id) return
      event.preventDefault()
      event.stopPropagation()
      onSelect({ type: kind, id } as Selection)
      onNodeImportanceChange(kind, id, event.deltaY < 0 ? 0.1 : -0.1)
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

  function startNodeDrag(
    kind: GraphNodeKind,
    node: Pick<Idea, 'id' | 'x' | 'y'>,
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (graphMode === 'discover') {
      onSelect({ type: kind, id: node.id } as Selection)
      return
    }
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
  }

  function moveNode(kind: GraphNodeKind, id: string, event: React.PointerEvent<HTMLButtonElement>) {
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
    if (event.target !== event.currentTarget) return
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

  return (
    <section className="graph-shell">
      <div
        className={`${draggingNode ? 'graph-canvas is-dragging-node' : 'graph-canvas'}${isPanning ? ' is-panning' : ''}${graphMode === 'discover' ? ' is-discovery' : ''}`}
        data-graph-cap={graphMetrics.cap}
        data-graph-mode={graphMetrics.mode}
        data-total-nodes={graphMetrics.totalNodes}
        data-visible-nodes={graphMetrics.visibleNodes}
        ref={canvasRef}
      >
        <div className="canvas-tool-rail" aria-label="Canvas tools">
          <button type="button" aria-label="Select" className="is-active">
            <LocateFixed size={15} />
          </button>
          <button type="button" aria-label="Add image placeholder" onClick={onCreatePlaceholder}>
            <ImagePlus size={15} />
          </button>
          <button type="button" aria-label="Add palette" onClick={onCreatePalette}>
            <CircleDot size={15} />
          </button>
          <button type="button" aria-label="Add idea" onClick={onCreateIdea}>
            <Plus size={15} />
          </button>
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
        <div
          className="graph-viewport"
          style={{ transform: `translate(${graphTransform.x}px, ${graphTransform.y}px) scale(${graphTransform.scale})` }}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={stopPan}
          onPointerCancel={stopPan}
        >
          <svg className="edge-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="edgeGradient" x1="0" x2="1">
                <stop offset="0%" stopColor="rgba(132, 205, 188, 0.18)" />
                <stop offset="100%" stopColor="rgba(223, 174, 103, 0.48)" />
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
              return (
                <g key={link.id} onClick={() => onSelect({ type: 'link', id: link.id })}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    className={active ? 'edge-line is-active' : relatedLink ? 'edge-line is-related' : 'edge-line'}
                  />
                  <circle
                    cx={(source.x + target.x) / 2}
                    cy={(source.y + target.y) / 2}
                    r={active ? 1.2 : 0.65}
                    className="edge-joint"
                  />
                </g>
              )
            })}
            {graphMode === 'discover' && displaySuggestions.map((suggestion) => {
              const image = displayView.images.find((candidate) => candidate.id === suggestion.imageId)
              const idea = displayView.ideas.find((candidate) => candidate.id === suggestion.ideaId)
              if (!image || !idea) return null
              return (
                <line
                  key={`${suggestion.imageId}-${suggestion.ideaId}`}
                  x1={image.x}
                  y1={image.y}
                  x2={idea.x}
                  y2={idea.y}
                  className="edge-line edge-line--suggested"
                />
              )
            })}
          </svg>

          {displayView.ideas.map((idea) => (
            <button
              key={idea.id}
              className={[
                'idea-node',
                selected.type === 'idea' && selected.id === idea.id ? 'is-selected' : '',
                related.ideaIds.has(idea.id) ? 'is-related' : '',
              ].filter(Boolean).join(' ')}
              data-node-kind="idea"
              data-node-id={idea.id}
              type="button"
              style={{
                left: `${idea.x}%`,
                top: `${idea.y}%`,
                '--node-scale': nodeScale(idea.importance),
              } as React.CSSProperties}
              onClick={() => onSelect({ type: 'idea', id: idea.id })}
              onPointerDown={(event) => startNodeDrag('idea', idea, event)}
              onPointerMove={(event) => moveNode('idea', idea.id, event)}
              onPointerUp={stopNodeDrag}
              onPointerCancel={stopNodeDrag}
              onDragOver={(event) => {
                if (graphMode === 'edit') event.preventDefault()
              }}
              onDrop={(event) => {
                if (graphMode !== 'edit') return
                event.preventDefault()
                const imageId = event.dataTransfer.getData('text/plain')
                if (imageId) onCreateLink(imageId, idea.id, linkCreationRelation)
              }}
            >
              <span className={`idea-status idea-status--${idea.status}`} />
              <strong>{idea.title}</strong>
              <small>{idea.status === 'thin' ? 'needs evidence' : `${displayView.links.filter((link) => link.ideaId === idea.id).length} evidence`}</small>
            </button>
          ))}

          {displayView.images.map((image) => (
            <button
              key={image.id}
              className={[
                'image-node',
                selected.type === 'image' && selected.id === image.id ? 'is-selected' : '',
                related.imageIds.has(image.id) ? 'is-related' : '',
              ].filter(Boolean).join(' ')}
              data-node-kind="image"
              data-node-id={image.id}
              type="button"
              style={{
                left: `${image.x}%`,
                top: `${image.y}%`,
                '--node-scale': nodeScale(image.importance),
              } as React.CSSProperties}
              onClick={() => onSelect({ type: 'image', id: image.id })}
              onPointerDown={(event) => startNodeDrag('image', image, event)}
              onPointerMove={(event) => moveNode('image', image.id, event)}
              onPointerUp={stopNodeDrag}
              onPointerCancel={stopNodeDrag}
            >
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
              ].filter(Boolean).join(' ')}
              data-node-kind="palette"
              data-node-id={palette.id}
              type="button"
              style={{
                left: `${palette.x}%`,
                top: `${palette.y}%`,
                '--node-scale': nodeScale(palette.importance),
              } as React.CSSProperties}
              onClick={() => onSelect({ type: 'palette', id: palette.id })}
              onPointerDown={(event) => startNodeDrag('palette', palette, event)}
              onPointerMove={(event) => moveNode('palette', palette.id, event)}
              onPointerUp={stopNodeDrag}
              onPointerCancel={stopNodeDrag}
            >
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
              ].filter(Boolean).join(' ')}
              data-node-kind="diagram"
              data-node-id={diagram.id}
              type="button"
              style={{
                left: `${diagram.x}%`,
                top: `${diagram.y}%`,
                '--node-scale': nodeScale(diagram.importance),
              } as React.CSSProperties}
              onClick={() => onSelect({ type: 'diagram', id: diagram.id })}
              onPointerDown={(event) => startNodeDrag('diagram', diagram, event)}
              onPointerMove={(event) => moveNode('diagram', diagram.id, event)}
              onPointerUp={stopNodeDrag}
              onPointerCancel={stopNodeDrag}
            >
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
              ].filter(Boolean).join(' ')}
              data-node-kind="placeholder"
              data-node-id={placeholder.id}
              type="button"
              style={{
                left: `${placeholder.x}%`,
                top: `${placeholder.y}%`,
                '--node-scale': nodeScale(placeholder.importance),
              } as React.CSSProperties}
              onClick={() => onSelect({ type: 'placeholder', id: placeholder.id })}
              onPointerDown={(event) => startNodeDrag('placeholder', placeholder, event)}
              onPointerMove={(event) => moveNode('placeholder', placeholder.id, event)}
              onPointerUp={stopNodeDrag}
              onPointerCancel={stopNodeDrag}
            >
              <ImagePlus size={16} />
              <span>{placeholder.title}</span>
            </button>
          ))}
        </div>

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
          </div>
        )}

        <div className="graph-status">
          <CircleDot size={13} />
          <span>{graphMetrics.visibleNodes}/{graphMetrics.totalNodes}</span>
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
            type="button"
            onClick={() => setIsGraphToolsOpen((current) => !current)}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
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
    if (selected.type === 'idea') return ideas.find((idea) => idea.id === selected.id)?.title
    if (selected.type === 'image') return images.find((image) => image.id === selected.id)?.title
    if (selected.type === 'palette') return palettes.find((palette) => palette.id === selected.id)?.title
    if (selected.type === 'diagram') return diagrams.find((diagram) => diagram.id === selected.id)?.title
    if (selected.type === 'placeholder') return placeholders.find((placeholder) => placeholder.id === selected.id)?.title
    return links.find((link) => link.id === selected.id)?.relation
  }, [diagrams, ideas, images, links, palettes, placeholders, selected])

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

      function resize() {
        if (!hostRef.current) return
        graph.width(hostRef.current.clientWidth)
        graph.height(hostRef.current.clientHeight)
      }

      graph
        .backgroundColor('#0d0f0e')
        .nodeLabel((node: any) => node.name)
        .nodeRelSize(4)
        .nodeOpacity(0.92)
        .nodeThreeObject((node: any) => createGraph3DNodeObject(THREE, node, selected.type !== 'link' && selected.id === node.id))
        .linkOpacity(0.34)
        .cooldownTicks(120)
        .linkDirectionalParticles(1)
        .linkDirectionalParticleSpeed(0.003)
        .onNodeClick((node: any) => {
          onSelect({ type: node.kind, id: node.id } as Selection)
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
    const THREE = threeRef.current
    graph
      .graphData(clone3DGraphData(filteredGraphData))
      .nodeThreeObject((node: any) => THREE ? createGraph3DNodeObject(THREE, node, selected.type !== 'link' && selected.id === node.id) : undefined)
      .nodeColor((node: any) => {
        if (selected.type !== 'link' && selected.id === node.id) return '#d9fff6'
        return node.color
      })
      .linkColor((link: any) => {
        if (selected.type === 'link' && selected.id === link.id) return '#dfae67'
        return link.color
      })
  }, [filteredGraphData, selected])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph || selected.type === 'link') return
    const timeout = window.setTimeout(() => {
      focus3DSelection(graph, selected.id)
    }, 450)

    return () => window.clearTimeout(timeout)
  }, [filteredGraphData, selected])

  function reset3DView() {
    const graph = graphRef.current
    if (!graph) return
    graph.cameraPosition({ x: 0, y: 0, z: 360 }, { x: 0, y: 0, z: 0 }, 650)
  }

  function focusSelectedIn3D() {
    const graph = graphRef.current
    if (!graph || selected.type === 'link') return
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
        <button type="button" aria-label="Focus selected in 3D" disabled={selected.type === 'link'} onClick={focusSelectedIn3D}>
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

function SlideshowView({
  ideas,
  images,
  palettes,
  diagrams,
  links,
  selected,
  status,
  onExportHtml,
  onSelect,
}: {
  ideas: Idea[]
  images: EvidenceImage[]
  palettes: PaletteNode[]
  diagrams: DiagramNode[]
  links: EvidenceLink[]
  selected: Selection
  status: string
  onExportHtml: (layoutMode?: SlideLayoutMode) => void
  onSelect: (selection: Selection) => void
}) {
  const slides = useMemo(() => buildSlideLayouts(ideas, images, links, palettes, diagrams), [diagrams, ideas, images, links, palettes])
  const selectedSlideIndex = Math.max(0, slides.findIndex((slide) => selected.type === 'idea' && slide.idea.id === selected.id))
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPresenting, setIsPresenting] = useState(false)
  const [layoutMode, setLayoutMode] = useState<SlideLayoutMode>('auto')
  const activeIndex = selectedSlideIndex >= 0 && selected.type === 'idea' ? selectedSlideIndex : Math.min(activeSlideIndex, slides.length - 1)
  const activeSlide = applySlideLayoutMode(slides, layoutMode)[activeIndex]

  function goToSlide(index: number) {
    if (slides.length === 0) return
    const nextIndex = (index + slides.length) % slides.length
    setActiveSlideIndex(nextIndex)
    onSelect({ type: 'idea', id: slides[nextIndex].idea.id })
  }

  useEffect(() => {
    if (selected.type === 'idea' && selectedSlideIndex >= 0) setActiveSlideIndex(selectedSlideIndex)
  }, [selected.type, selectedSlideIndex])

  useEffect(() => {
    if (!isPlaying || slides.length < 2) return
    const timer = window.setInterval(() => {
      setActiveSlideIndex((current) => {
        const nextIndex = (current + 1) % slides.length
        onSelect({ type: 'idea', id: slides[nextIndex].idea.id })
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
          <em>{activeSlide.layout}</em>
          <select
            aria-label="Slide layout mode"
            value={layoutMode}
            onChange={(event) => setLayoutMode(event.target.value as SlideLayoutMode)}
          >
            <option value="auto">Auto</option>
            <option value="focus">Focus</option>
            <option value="grid">Grid</option>
            <option value="stack">Stack</option>
            <option value="palette">Palette</option>
            <option value="diagram">Diagram</option>
          </select>
          <button type="button" aria-label="Export slides HTML" onClick={() => onExportHtml(layoutMode)}>
            <ArrowDownToLine size={14} />
          </button>
        </div>
        <div className="slide-copy">
          <span style={{ color: activeSlide.accent }}>{activeSlide.idea.status}</span>
          <h2>{activeSlide.title}</h2>
          <p>{activeSlide.summary}</p>
          <small>
            {activeSlide.relationCount} links · {activeSlide.references.length} references · {activeSlide.layoutReason} · {status}
          </small>
        </div>
        <div className="slide-reference-layout">
          {activeSlide.layout === 'palette' && activeSlide.palettes.length > 0 ? (
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
        <img src={image.thumb} alt="" onError={() => setIsMissing(true)} />
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
  onPaletteChange,
  onDiagramChange,
  onPlaceholderChange,
  onPaletteColorChange,
  onPaletteRegenerate,
  onLinkCreationRelationChange,
  onReferenceTagAdd,
  onReferenceTagRemove,
  onReferenceOcr,
  onReferenceTagRefine,
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
  onIdeaChange: (ideaId: string, patch: Partial<Pick<Idea, 'title' | 'body'>>) => void
  onImageChange: (imageId: string, patch: Partial<Pick<EvidenceImage, 'title' | 'sourceUrl' | 'notes'>>) => void
  onLinkChange: (linkId: string, patch: Partial<Pick<EvidenceLink, 'relation' | 'note'>>) => void
  onPaletteChange: (paletteId: string, patch: Partial<Pick<PaletteNode, 'title' | 'sourceUrl' | 'notes'>>) => void
  onDiagramChange: (diagramId: string, patch: Partial<Pick<DiagramNode, 'title' | 'sourceUrl' | 'notes'>>) => void
  onPlaceholderChange: (placeholderId: string, patch: Partial<Pick<PlaceholderNode, 'title' | 'sourceUrl' | 'notes'>>) => void
  onPaletteColorChange: (paletteId: string, colorIndex: number, color: string) => void
  onPaletteRegenerate: (paletteId: string, algorithm: PaletteHarmony) => void
  onLinkCreationRelationChange: (relation: Relation) => void
  onReferenceTagAdd: (imageId: string, tag: string) => void
  onReferenceTagRemove: (imageId: string, tag: string) => void
  onReferenceOcr: (imageId: string) => void
  onReferenceTagRefine: (imageId: string) => void
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
  onOpenOutline: () => void
  onRebuildOutline: () => void
  onToggleFloating: () => void
}) {
  const titleInputRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    if (selected.kind !== 'idea' || selected.idea.id !== ideaTitleFocusId) return
    requestAnimationFrame(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
      onIdeaTitleFocused()
    })
  }, [ideaTitleFocusId, onIdeaTitleFocused, selected])

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
          <p className="panel-kicker">Inspector</p>
          <h2>{selected.heading}</h2>
        </div>
        <div className="panel-actions">
          <button className="icon-button" type="button" aria-label="Undock inspector" onClick={onToggleFloating}>
            <Maximize2 size={15} />
          </button>
          <button className="icon-button" type="button" aria-label="Collapse inspector" onClick={onToggleCollapsed}>
            <PanelRight size={16} />
          </button>
        </div>
      </div>

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
          <NodeMetadata node={selected.idea} />
          <button className="danger-action" type="button" onClick={() => onIdeaDelete(selected.idea.id)}>
            Delete idea
          </button>
        </>
      )}

      {selected.kind === 'image' && (
        <>
          <ReferenceThumb image={selected.image} className="inspector-image" />
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
            <input
              className="title-input"
              placeholder="Source URL"
              value={selected.image.sourceUrl ?? ''}
              onChange={(event) => onImageChange(selected.image.id, { sourceUrl: event.target.value })}
            />
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
          <section className="inspector-card utility-card">
            <button className="inline-action" type="button" onClick={() => onReferenceFindSimilar(selected.image.id)}>
              <Search size={13} />
              Find similar
            </button>
            <button className="inline-action" type="button" onClick={() => onReferenceConvertToPalette(selected.image.id)}>
              <CircleDot size={13} />
              Convert to palette
            </button>
          </section>
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
          <NodeMetadata node={selected.image} />
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
              <ReferenceThumb image={selected.image} />
              <span />
              <strong>{selected.idea.title}</strong>
            </div>
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
          <NodeMetadata node={selected.palette} />
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
            <pre className="diagram-source-preview">{selected.diagram.source}</pre>
          </section>
          <NodeMetadata node={selected.diagram} />
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
          <NodeMetadata node={selected.placeholder} />
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

function NodeMetadata({
  node,
}: {
  node: Pick<Idea | EvidenceImage | PaletteNode | DiagramNode | PlaceholderNode, 'importance' | 'createdAt' | 'addedAt' | 'updatedAt' | 'sourceUrl'>
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

function formatImportance(value: number | undefined) {
  return `${(value ?? 1).toFixed(1)}x`
}

function formatMetadataTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
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
  versions,
  onClose,
  onRestore,
}: {
  isOpen: boolean
  versions: ProjectVersionRecord[]
  onClose: () => void
  onRestore: (versionId: string) => void
}) {
  if (!isOpen) return null

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
            <p>{versions.length} saved version{versions.length === 1 ? '' : 's'}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close version history" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="version-list">
          {versions.length === 0 ? (
            <p className="empty-state">No saved versions</p>
          ) : (
            versions.map((version) => (
              <article key={version.id} className="version-row">
                <div>
                  <strong>{version.label}</strong>
                  <span>{formatVersionTime(version.createdAt)}</span>
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
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  palettes: PaletteNode[],
  diagrams: DiagramNode[],
  placeholders: PlaceholderNode[],
) {
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
  const image = images.find((candidate) => candidate.id === link.imageId) ?? images[0]
  const idea = ideas.find((candidate) => candidate.id === link.ideaId) ?? ideas[0]
  return { kind: 'link' as const, heading: 'Link', link, image, idea }
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
      const source = link.sourceNodeId ?? link.imageId
      const target = link.targetNodeId ?? link.ideaId
      if (selected.type === 'idea') return link.ideaId === selected.id || source === selected.id || target === selected.id
      if (selected.type === 'image') return link.imageId === selected.id || source === selected.id || target === selected.id
      if (selected.type !== 'link') return false
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

function createReferenceFromCapture(capture: VixioCapturePayload, index: number): EvidenceImage {
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
    tags: mergeUniqueTags(['browser', capture.kind], sourceTags.slice(0, 3)),
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
        resolve({ palette: [], tags: orientationTags(width, height), suggestions: [] })
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

  if (count === 0) return { palette: [], tags: orientationTags(width, height), suggestions: [] }

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

function parseVixioCapturePayload(value: string): VixioCapturePayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<VixioCapturePayload>
    if (parsed.vixioCapture !== 1) return null
    if (parsed.kind !== 'image' && parsed.kind !== 'page') return null
    if (typeof parsed.url !== 'string' || !parseCaptureUrl(parsed.url)) return null
    if (typeof parsed.title !== 'string' || typeof parsed.source !== 'string') return null
    return {
      vixioCapture: 1,
      kind: parsed.kind,
      url: parsed.url,
      title: parsed.title,
      source: parsed.source,
      pageUrl: typeof parsed.pageUrl === 'string' ? parsed.pageUrl : undefined,
      capturedAt: typeof parsed.capturedAt === 'string' ? parsed.capturedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function parseVixioCapturePayloads(value: string) {
  const direct = parseVixioCapturePayload(value)
  if (direct) return [direct]

  return value
    .split('\n')
    .map((line) => parseVixioCapturePayload(line.trim()))
    .filter((capture): capture is VixioCapturePayload => Boolean(capture))
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
    const isSelectedEndpoint = selected.type !== 'link' && (sourceId === selected.id || targetId === selected.id)

    if (graphScope === 'selection' && !isSelectedLink && !isSelectedEndpoint) return false

    connectedNodeIds.add(sourceId)
    connectedNodeIds.add(targetId)
    return true
  })

  if (graphScope === 'selection' && selected.type !== 'link') connectedNodeIds.add(selected.id)

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
  const canvas = document.createElement('canvas')
  canvas.width = node.kind === 'image' ? 256 : 288
  canvas.height = node.kind === 'image' ? 170 : 92
  const context = canvas.getContext('2d')
  if (!context) return undefined

  drawGraph3DNodeCanvas(context, canvas, node, isSelected)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  const importance = nodeImportance(node.importance)
  const width = node.kind === 'image' ? 36 * importance : 42 * importance
  const height = width * (canvas.height / canvas.width)
  sprite.scale.set(width, height, 1)

  if (node.kind === 'image' && typeof node.thumb === 'string' && node.thumb.startsWith('data:image/')) {
    const image = new Image()
    image.onload = () => {
      drawGraph3DNodeCanvas(context, canvas, node, isSelected, image)
      texture.needsUpdate = true
    }
    image.src = node.thumb
  }

  return sprite
}

function drawGraph3DNodeCanvas(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
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

function focus3DSelection(graph: any, selectedId: string) {
  const nodes = graph.graphData?.().nodes ?? []
  const node = nodes.find((candidate: any) => candidate.id === selectedId)
  if (!node || typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') return

  const distance = 180
  const length = Math.hypot(node.x, node.y, node.z) || 1
  const ratio = 1 + distance / length
  graph.cameraPosition(
    { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
    node,
    700,
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

  return [...ideas]
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
        idea,
        title: idea.title,
        summary: idea.body || 'No summary yet.',
        references,
        palettes: relatedPalettes,
        diagrams: relatedDiagrams,
        relationCount: ideaLinks.length,
        layout,
        layoutReason,
        relationMix,
        accent,
      }
    })
}

function applySlideLayoutMode(slides: SlideLayout[], layoutMode: SlideLayoutMode) {
  if (layoutMode === 'auto') return slides
  return slides.map((slide) => ({
    ...slide,
    layout: layoutMode,
    layoutReason: `manual ${layoutMode}`,
  }))
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

function nowIso() {
  return new Date().toISOString()
}

function nodeImportance(value: number | undefined) {
  return clamp(value ?? 1, 0.25, 3)
}

function adjustImportance(value: number | undefined, delta: number) {
  return Number(clamp(nodeImportance(value) + delta, 0.25, 3).toFixed(2))
}

function nodeScale(value: number | undefined) {
  return Number((0.84 + nodeImportance(value) * 0.16).toFixed(2))
}

function organizeGraphLayout(
  mode: GraphOrganizeMode,
  ideas: Idea[],
  images: EvidenceImage[],
  links: EvidenceLink[],
  selected: Selection,
) {
  const timestamp = nowIso()
  const linkCountByIdea = new Map<string, number>()
  links.forEach((link) => linkCountByIdea.set(link.ideaId, (linkCountByIdea.get(link.ideaId) ?? 0) + 1))

  const nextIdeas = ideas.map((idea) => ({ ...idea }))
  const nextImages = images.map((image) => ({ ...image }))
  const ideaById = new Map(nextIdeas.map((idea) => [idea.id, idea]))
  const imageById = new Map(nextImages.map((image) => [image.id, image]))
  const selectedIdea = selected.type === 'idea' ? ideaById.get(selected.id) : undefined
  const selectedImage = selected.type === 'image' ? imageById.get(selected.id) : undefined

  function placeIdea(idea: Idea, x: number, y: number) {
    idea.x = clamp(x, 8, 92)
    idea.y = clamp(y, 8, 92)
    idea.updatedAt = timestamp
  }

  function placeImage(image: EvidenceImage, x: number, y: number) {
    image.x = clamp(x, 5, 95)
    image.y = clamp(y, 6, 94)
    image.updatedAt = timestamp
  }

  function placeImageGrid(items: EvidenceImage[], startX: number, startY: number, columns: number, stepX = 10, stepY = 12) {
    items.forEach((image, index) => {
      placeImage(image, startX + (index % columns) * stepX, startY + Math.floor(index / columns) * stepY)
    })
  }

  if (mode === 'grid') {
    nextIdeas.forEach((idea, index) => placeIdea(idea, 18 + (index % 4) * 20, 16 + Math.floor(index / 4) * 16))
    placeImageGrid(nextImages, 12, 42, 8)
    return { ideas: nextIdeas, images: nextImages }
  }

  if (mode === 'timeline') {
    const dated = [...nextIdeas, ...nextImages].sort((a, b) => {
      const aDate = new Date(a.createdAt || a.addedAt || a.updatedAt || 0).getTime()
      const bDate = new Date(b.createdAt || b.addedAt || b.updatedAt || 0).getTime()
      return aDate - bDate || a.title.localeCompare(b.title)
    })
    dated.forEach((node, index) => {
      const x = 12 + (index % 7) * 13
      const y = 18 + Math.floor(index / 7) * 13
      if ('status' in node) placeIdea(node, x, y)
      else placeImage(node, x, y)
    })
    return { ideas: nextIdeas, images: nextImages }
  }

  if (mode === 'palette') {
    nextIdeas.forEach((idea, index) => placeIdea(idea, 16 + (index % 5) * 17, 16))
    const sortedImages = [...nextImages].sort((a, b) => hueFromHex(a.palette[0]) - hueFromHex(b.palette[0]))
    placeImageGrid(sortedImages, 10, 38, 8)
    return { ideas: nextIdeas, images: nextImages }
  }

  if (mode === 'importance') {
    const focus = selectedIdea || selectedImage || [...nextIdeas, ...nextImages].sort((a, b) => nodeImportance(b.importance) - nodeImportance(a.importance))[0]
    if (focus) {
      if ('status' in focus) placeIdea(focus, 50, 46)
      else placeImage(focus, 50, 46)
      const relatedLinks = 'status' in focus
        ? links.filter((link) => link.ideaId === focus.id)
        : links.filter((link) => link.imageId === focus.id)
      const relatedImages = relatedLinks.map((link) => imageById.get(link.imageId)).filter(Boolean) as EvidenceImage[]
      const relatedIdeas = relatedLinks.map((link) => ideaById.get(link.ideaId)).filter(Boolean) as Idea[]
      relatedIdeas.forEach((idea, index) => placeIdea(idea, 34 + index * 16, 28))
      relatedImages.forEach((image, index) => {
        const angle = (-Math.PI / 2) + (index / Math.max(relatedImages.length, 1)) * Math.PI * 2
        placeImage(image, 50 + Math.cos(angle) * 24, 48 + Math.sin(angle) * 20)
      })
      placeImageGrid(nextImages.filter((image) => image.id !== focus.id && !relatedImages.some((related) => related.id === image.id)), 10, 74, 8, 10, 9)
    }
    return { ideas: nextIdeas, images: nextImages }
  }

  const sortedIdeas = [...nextIdeas].sort((a, b) => {
    if (mode === 'flow') return (linkCountByIdea.get(b.id) ?? 0) - (linkCountByIdea.get(a.id) ?? 0) || a.title.localeCompare(b.title)
    return a.title.localeCompare(b.title)
  })

  sortedIdeas.forEach((idea, index) => {
    if (mode === 'flow') {
      placeIdea(idea, 18 + (index / Math.max(sortedIdeas.length - 1, 1)) * 64, 32 + (index % 2) * 12)
      return
    }
    const angle = (-Math.PI / 2) + (index / Math.max(sortedIdeas.length, 1)) * Math.PI * 2
    placeIdea(idea, 50 + Math.cos(angle) * 26, 48 + Math.sin(angle) * 22)
  })

  const linkedImageIds = new Set<string>()
  sortedIdeas.forEach((idea, ideaIndex) => {
    const ideaLinks = links.filter((link) => link.ideaId === idea.id)
    ideaLinks.forEach((link, linkIndex) => {
      const image = imageById.get(link.imageId)
      if (!image || linkedImageIds.has(image.id)) return
      linkedImageIds.add(image.id)
      const ringSize = Math.max(ideaLinks.length, 1)
      const angle = (-Math.PI / 2) + (linkIndex / ringSize) * Math.PI * 2
      const radiusX = mode === 'flow' ? 8 + nodeImportance(image.importance) * 2 : 14
      const radiusY = mode === 'flow' ? 10 : 12
      placeImage(image, idea.x + Math.cos(angle) * radiusX, idea.y + Math.sin(angle) * radiusY + (ideaIndex % 2) * 2)
    })
  })
  placeImageGrid(nextImages.filter((image) => !linkedImageIds.has(image.id)), 10, 76, 8, 10, 9)

  return { ideas: nextIdeas, images: nextImages }
}

function organizeAuxiliaryNodes(
  mode: GraphOrganizeMode,
  palettes: PaletteNode[],
  diagrams: DiagramNode[],
  placeholders: PlaceholderNode[],
) {
  const timestamp = nowIso()
  const nextPalettes = palettes.map((palette) => ({ ...palette }))
  const nextDiagrams = diagrams.map((diagram) => ({ ...diagram }))
  const nextPlaceholders = placeholders.map((placeholder) => ({ ...placeholder }))
  const all = [
    ...nextDiagrams.map((node) => ({ kind: 'diagram' as const, node })),
    ...nextPalettes.map((node) => ({ kind: 'palette' as const, node })),
    ...nextPlaceholders.map((node) => ({ kind: 'placeholder' as const, node })),
  ]

  all.forEach((entry, index) => {
    let x = 78
    let y = 18 + index * 12
    if (mode === 'grid') {
      x = 14 + (index % 5) * 16
      y = 78 + Math.floor(index / 5) * 10
    } else if (mode === 'timeline') {
      x = 12 + (index % 7) * 13
      y = 70 + Math.floor(index / 7) * 10
    } else if (mode === 'palette' && entry.kind === 'palette') {
      x = 18 + (index % 4) * 18
      y = 30
    } else if (mode === 'importance') {
      x = 72 + index * 6
      y = 24 + index * 8
    }
    entry.node.x = clamp(x, 8, 92)
    entry.node.y = clamp(y, 8, 92)
    entry.node.updatedAt = timestamp
  })

  return {
    palettes: nextPalettes,
    diagrams: nextDiagrams,
    placeholders: nextPlaceholders,
  }
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
): ProjectSnapshot {
  return {
    version: 2,
    ideas,
    images,
    palettes,
    diagrams,
    placeholders,
    aiSettings,
    versionHistory,
    links,
    outlineDrafts,
  }
}

function createBlankProjectSnapshot(): ProjectSnapshot {
  return {
    version: 2,
    ideas: [createFallbackIdea()],
    images: [],
    palettes: [],
    diagrams: [],
    placeholders: [],
    aiSettings: defaultAiSettingsSnapshot(),
    versionHistory: [],
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
    ideas,
    images,
    palettes: [],
    diagrams: [],
    placeholders: [],
    aiSettings: defaultAiSettingsSnapshot(),
    versionHistory: [],
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
    ideas: ideasSeed,
    images: [...baseImages, duplicateCandidate],
    palettes: [],
    diagrams: [],
    placeholders: [],
    aiSettings: defaultAiSettingsSnapshot(),
    versionHistory: [],
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

function isProjectSnapshot(value: unknown): value is ProjectSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<ProjectSnapshot>
  return (
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
  return invoke<void>('save_provider_secret', { providerId, secret })
}

async function deleteNativeProviderSecret(providerId: string) {
  return invoke<void>('delete_provider_secret', { providerId })
}

async function testNativeAiProvider(provider: AiProviderProfile) {
  return invoke<AiProviderTestResult>('test_ai_provider', { provider: providerRequestPayload(provider) })
}

async function listNativeAiModels(provider: AiProviderProfile) {
  return invoke<AiModelListResult>('list_ai_models', { provider: providerRequestPayload(provider) })
}

function providerRequestPayload(provider: AiProviderProfile) {
  return {
    providerId: provider.id,
    providerType: provider.type,
    authMode: provider.authMode,
    baseUrl: provider.baseUrl,
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

function downloadProject(snapshot: ProjectSnapshot) {
  downloadTextFile(JSON.stringify(snapshot, null, 2), 'vixio-project.json', 'application/json')
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

function slideLayoutsToHtml(slides: SlideLayout[], metadata: { title: string; generatedAt: string }) {
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
        const references = slide.layout === 'palette' && paletteMarkup
          ? paletteMarkup
          : slide.layout === 'diagram' && diagramMarkup
            ? diagramMarkup
            : slide.references.length === 0
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

        return `
          <section class="slide slide--${escapeAttribute(slide.layout)}" data-layout-reason="${escapeAttribute(slide.layoutReason)}" data-node-kind="${escapeAttribute(slide.layout)}" data-importance="${escapeAttribute(String(nodeImportance(slide.idea.importance)))}" style="--accent: ${escapeAttribute(slide.accent)}">
            <aside>
              <span>${String(index + 1).padStart(2, '0')} / ${slides.length}</span>
              <em>${escapeHtml(slide.idea.status)} · ${escapeHtml(slide.layout)}</em>
            </aside>
            <div class="copy">
              <h2>${escapeHtml(slide.title)}</h2>
              <p>${escapeHtml(slide.summary)}</p>
              <small>${slide.relationCount} links · ${slide.references.length} references · ${slide.palettes.length} palettes · ${slide.diagrams.length} diagrams · ${escapeHtml(slide.layoutReason)} · ${escapeHtml(formatRelationMix(slide.relationMix))}</small>
            </div>
            <div class="refs">${references}</div>
          </section>
        `
      }).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(metadata.title)}</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #090a0a; color: #ece9dd; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #090a0a; }
    header { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; padding: 18px 28px; background: rgba(9,10,10,.82); backdrop-filter: blur(18px); color: #96988e; font-size: 13px; }
    header strong { color: #ece9dd; }
    main { display: grid; gap: 1px; }
    .slide { display: grid; grid-template-columns: 92px minmax(280px,.82fr) minmax(320px,1fr); min-height: 100dvh; padding: 7vw; background: #0d0f0e; gap: clamp(28px,5vw,72px); page-break-after: always; }
    aside { display: grid; align-content: start; gap: 8px; color: #96988e; font-size: 13px; }
    aside em { color: var(--accent); font-style: normal; }
    .copy { display: grid; align-content: center; gap: 18px; }
    h2 { max-width: 12ch; margin: 0; font-size: clamp(44px,8vw,104px); line-height: .96; text-wrap: balance; }
    p { max-width: 52ch; margin: 0; color: #c9c8bd; font-size: 18px; line-height: 1.65; text-wrap: pretty; }
    small { color: #96988e; }
    .refs { display: grid; align-content: center; gap: 14px; }
    .slide--grid .refs { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .slide--stack .refs { grid-template-columns: repeat(3,minmax(0,1fr)); }
    figure { display: grid; min-width: 0; margin: 0; overflow: hidden; border-radius: 8px; background: rgba(255,255,255,.045); }
    img, .thumb-missing { width: 100%; min-height: 180px; object-fit: cover; background: rgba(255,255,255,.06); }
    .slide--focus img, .slide--focus .thumb-missing { min-height: 54vh; }
    figcaption { overflow: hidden; padding: 10px 12px; color: #c9c8bd; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .missing { align-self: center; color: #b7a4df; }
    @media print { header { position: static; } .slide { min-height: 100vh; } }
  </style>
</head>
<body>
  <header><strong>${escapeHtml(metadata.title)}</strong><span>${escapeHtml(metadata.generatedAt)}</span></header>
  <main>${slideMarkup}</main>
</body>
</html>
`
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

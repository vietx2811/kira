// Kira right panel shell — Untitled UI React conversion (PHA 3, 2026-09-16).
// Extracted out of main.tsx (was `renderKiraPanel` inline in FileWorkspace,
// ~6843-6924). Tab strip is now the kit `Tabs`/`TabList`/`Tab` (type
// "button-gray" — replaces the underline `Segmented` control the user
// flagged at the view switcher, docs/design/right-panel brief PHA 3 §1); the
// "Cần bạn" badge count is the `Tab` component's own built-in `badge` prop
// (kit `Badge` under the hood), so one prop does both jobs the old
// `.kp-tabs .count` span used to. Close button is kit `Button` wrapped in
// kit `Tooltip`.
//
// The resize handle (drag left edge, 320-480px, DECISIONS.md bố cục #2)
// stays hand-rolled — the kit ships no resizable-panel primitive (per the
// brief) — and the panel's own position/size/enter-transition CSS
// (`.kira-panel`, `.kp-head`, `.kp-body`) is untouched Ink & Paper layout,
// not a "control" in scope for this phase.
//
// Wrapped in `UiKitPortalHost` + `.kira-uikit` (Tailwind preflight reset
// scope + React Aria portal container, see PortalHost.tsx) exactly like
// SettingsView.tsx (PHA 1) and EvidenceInbox.tsx (PHA 2) — Modal/Tooltip/Tab
// popovers this panel now uses need to portal inside `.app-shell` to see the
// per-project accent + dark/light tokens (CLAUDE.md "phần tử portal ra
// document.body cũng không thấy token theme").
//
// `.uikit-passthrough-host` (styles.css) forces `display: contents` on the
// wrapper, same fix EvidenceInbox.tsx/PHA 2 already applied via
// `.library-uikit-host` and for the exact same reason (see that rule's
// comment): `UiKitPortalHost`'s div is a normal `position: static` box, and
// `.kira-panel` sits inside it as a DIRECT sibling of `.content-region`
// (the canvas) under `.workspace`. A static, non-positioned box always
// paints BELOW any positioned sibling regardless of DOM order or the
// z-index set on its own descendants (`isolation: isolate` traps
// `.kira-panel`'s `z-index: 60` inside this wrapper's own stacking
// context instead of letting it compete with `.content-region`) — so with
// the plain wrapper the panel opens (state flips, correct geometry) but
// renders fully behind the canvas, invisible and unclickable. Also tried
// `position: relative` on the wrapper to fix that (PHA 2's first attempt
// hit the same thing): that makes the wrapper `.kira-panel`'s containing
// block instead of `.workspace`, and since the wrapper has no in-flow
// content of its own its height collapses to 0, so `.kira-panel`'s
// `position: absolute; top/right/bottom` resolves against a 0-height box.
// `display: contents` removes the wrapper's own box entirely, so
// `.kira-panel` resolves position AND stacking directly against
// `.workspace` again (its original, correct containing block) — verified
// live via `getBoundingClientRect`/`elementFromPoint` in the browser
// preview: before the fix the topmost element over `.kira-panel`'s own
// rect was the canvas's `svg.edge-layer`, after it's `.kira-panel`'s own
// `.kp-head`.
import type { CSSProperties, ReactNode } from 'react'
import { Minimize2 } from 'lucide-react'
import { Tab, TabList, Tabs } from '@/components/application/tabs/tabs'
import { Button } from '@/components/base/buttons/button'
import { Tooltip } from '@/components/base/tooltip/tooltip'
import { UiKitPortalHost } from '@/kira/uikit/PortalHost'

export function KiraPanel({
  width,
  isEntered,
  activeTab,
  needsYouCount,
  closeLabel,
  chatLabel,
  needsYouLabel,
  chatBody,
  changesBody,
  onTabChange,
  onClose,
  onResizeStart,
}: {
  width: number
  isEntered: boolean
  activeTab: 'chat' | 'needs-you'
  needsYouCount: number
  closeLabel: string
  chatLabel: string
  needsYouLabel: string
  chatBody: ReactNode
  changesBody: ReactNode
  onTabChange: (tab: 'chat' | 'needs-you') => void
  onClose: () => void
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void
}) {
  return (
    <UiKitPortalHost className="kira-uikit uikit-passthrough-host">
      <div
        className={isEntered ? 'kira-panel is-entered' : 'kira-panel'}
        style={{ '--kira-panel-width': `${width}px` } as CSSProperties}
        aria-label="Kira"
      >
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => onTabChange(key as 'chat' | 'needs-you')}
          style={{ display: 'contents' }}
        >
          {/* `.kp-head` and `.kp-body` must stay DIRECT children of
              `.kira-panel` — its grid is `grid-template-rows: auto
              minmax(0, 1fr)` over exactly those two boxes (styles.css:8107).
              `Tabs` only wraps them for the selection context; `display:
              contents` keeps it out of that grid (verified: `Tabs.tsx`'s
              only wrapper is a plain `<div className={...}>`, this override
              replaces it entirely — no accidental extra grid row). */}
          <div className="kp-head">
            <div className="kp-title">
              <h3>Kira</h3>
              <TabList type="button-gray" size="sm" aria-label="Kira">
                <Tab id="chat" label={chatLabel} />
                <Tab id="needs-you" label={needsYouLabel} badge={needsYouCount > 0 ? needsYouCount : undefined} />
              </TabList>
              <span className="spacer" />
              <Tooltip title={closeLabel} delay={200}>
                <Button color="tertiary" size="sm" iconLeading={Minimize2} aria-label={closeLabel} onPress={onClose} />
              </Tooltip>
            </div>
          </div>
          <div className="kp-body">
            {activeTab === 'chat' ? chatBody : changesBody}
          </div>
        </Tabs>
        <div className="kira-panel-resize-handle" aria-hidden="true" onPointerDown={onResizeStart} />
      </div>
    </UiKitPortalHost>
  )
}

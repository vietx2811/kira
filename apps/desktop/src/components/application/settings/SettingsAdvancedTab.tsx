import { Bot, Check, Database, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/base/buttons/button'
import { Badge } from '@/components/base/badges/badges'
import type { AiTaskRoute } from '@/kira/ai/aiProviderDomain'
import { aiTaskLabels } from '@/kira/ai/aiProviderDomain'

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function Chip({ icon: Icon, children }: { icon: typeof Check; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary">
      <Icon className="size-3.5 text-fg-quaternary" />
      {children}
    </span>
  )
}

export function SettingsAdvancedTab({
  taskRoutes,
  storedSecretCount,
  remoteProviderCount,
  billingSeparatedCount,
  onWelcomeOpen,
  onOnboardingReset,
}: {
  taskRoutes: AiTaskRoute[]
  storedSecretCount: number
  remoteProviderCount: number
  billingSeparatedCount: number
  onWelcomeOpen: () => void
  onOnboardingReset: () => void
}) {
  return (
    <section className="flex flex-col gap-4">
      {/* User decision 2026-09-15: Routing preview (previously its own
          disclosure under AI Providers) + Secrets + Usage + Onboarding
          merged into one disclosure instead of four stacked cards
          (DESIGN.md §5 One Density Rule / No-Nested-Card Rule). */}
      <details className="rounded-lg border border-secondary p-4" open>
        <summary className="flex cursor-pointer items-center justify-between gap-2">
          <h3 className="text-md font-semibold text-primary">Advanced</h3>
          <span className="text-sm text-tertiary">Routing, secrets, usage, onboarding</span>
        </summary>

        <div className="mt-4 flex flex-col gap-2 border-t border-secondary pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-secondary">Routing preview</h4>
            <span className="text-xs text-tertiary">{taskRoutes.length} tasks</span>
          </div>
          <div className="flex flex-col gap-1.5" aria-label="AI task routing preview">
            {taskRoutes.map((route) => (
              <div className="flex items-center gap-3 text-sm" key={route.task}>
                <span className="w-40 shrink-0 text-tertiary">{aiTaskLabels[route.task]}</span>
                <strong className="font-semibold text-primary">{route.providerName}</strong>
                <em className="not-italic text-xs text-tertiary">{route.reason}</em>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-secondary pt-4" id="settings-secrets">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-secondary">Secrets</h4>
            <span className="text-xs text-tertiary">{storedSecretCount} stored</span>
          </div>
          <ChipGrid>
            <Chip icon={Check}>macOS Keychain</Chip>
            <Chip icon={ShieldCheck}>No browser tokens</Chip>
            <Chip icon={Database}>
              {storedSecretCount}/{remoteProviderCount} remote
            </Chip>
          </ChipGrid>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-secondary pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-secondary">Usage</h4>
            <span className="text-xs text-tertiary">{billingSeparatedCount} API billed</span>
          </div>
          <ChipGrid>
            <Chip icon={Bot}>Bring your own API key</Chip>
            <Chip icon={Sparkles}>Local-first fallback</Chip>
            <Chip icon={Check}>No subscription passthrough</Chip>
          </ChipGrid>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-secondary pt-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-secondary">Onboarding</h4>
            <span className="text-xs text-tertiary">Replay / reset</span>
          </div>
          <p className="text-sm text-tertiary">Replay first-run setup for AI providers, local fallback, and browser capture.</p>
          <div className="flex gap-2">
            <Button color="tertiary" size="sm" onPress={onWelcomeOpen}>
              Open Welcome.kira
            </Button>
            <Button color="tertiary" size="sm" onPress={onOnboardingReset}>
              Reset onboarding
            </Button>
          </div>
        </div>
      </details>
    </section>
  )
}

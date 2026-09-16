import { useState } from 'react'
import { Button } from '@/components/base/buttons/button'
import { Badge } from '@/components/base/badges/badges'
import type { AiProviderProfile } from '@/kira/ai/aiProviderDomain'
import { openClaudeCodeLoginTerminal } from '@/kira/ai/aiProviderDomain'

export function ClaudeCodeStatus({ provider }: { provider: AiProviderProfile }) {
  const connected = provider.status === 'connected'
  const [launchError, setLaunchError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge color={connected ? 'success' : 'gray'} type="pill-color" size="sm">
          {connected ? 'Connected' : 'Not connected'}
        </Badge>
        {/* Without a lastMessage nothing has actually run yet, so this can only report that.
            Claiming the CLI is missing here was wrong whenever it was simply unchecked. */}
        <span className="text-sm text-tertiary">
          {provider.lastMessage ?? (connected ? 'Claude Code CLI detected and signed in' : 'Not checked yet. Run Test to look for the CLI on this machine.')}
        </span>
      </div>
      <p className="text-sm text-tertiary">
        KIRA never renders or stores your Claude.ai login itself. Signing in opens Terminal and runs{' '}
        <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs">claude auth login</code> there, so the CLI completes the flow and keeps the
        session; KIRA only checks status and runs tasks through it. Run Test once the terminal reports you are signed in.
      </p>
      {!connected && (
        <Button
          color="secondary"
          size="sm"
          className="self-start"
          onPress={() => {
            setLaunchError(null)
            void openClaudeCodeLoginTerminal().catch((error) => setLaunchError(String(error)))
          }}
        >
          Sign in in Terminal
        </Button>
      )}
      {launchError && (
        <p className="text-sm text-error-primary" role="alert">
          {launchError}
        </p>
      )}
    </div>
  )
}

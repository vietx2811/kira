import { useState } from 'react'
import { Input } from '@/components/base/input/input'
import { Button } from '@/components/base/buttons/button'

export function CodexApiKeyField({ busy, onSubmit }: { busy: boolean; onSubmit: (key: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="flex items-center gap-2 pt-2">
      <Input type="password" value={value} placeholder="sk-…" onChange={setValue} size="sm" className="flex-1" />
      <Button
        color="secondary"
        size="sm"
        isDisabled={busy || value.trim().length === 0}
        onPress={() => onSubmit(value.trim())}
      >
        Save key
      </Button>
    </div>
  )
}

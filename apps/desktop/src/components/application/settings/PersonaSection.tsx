import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { TextArea } from '@/components/base/textarea/textarea'
import { StringSelect } from './StringSelect'
import { normalizePersona, personaPromptContext, type UserPersona } from '@/kira/ai/persona'
import { readPersonaFile, savePersona } from '@/kira/ai/personaStore'

// "About you": the persona every Kira prompt starts with, stored in
// ~/.creative-os/user.json so other creative tools can share it.

type Draft = Record<'name' | 'role' | 'industry' | 'location' | 'aestheticTendency' | 'avoidKeywords' | 'clientTypes' | 'typicalDeliverables' | 'responseStyle' | 'feedbackStyle' | 'promptContext', string>

const copy = {
  en: {
    title: 'About you',
    hint: 'Kira starts every request with this, so you never repeat yourself. Saved to ~/.creative-os/user.json, which other creative tools can read too.',
    name: 'Name', role: 'Role', industry: 'Fields', location: 'Based in',
    aesthetic: 'Aesthetic tendency', avoid: 'Words to avoid', clients: 'Clients', deliverables: 'Typical deliverables',
    listHint: 'Separate with commas',
    response: 'Answers', feedback: 'Feedback',
    note: 'Note for AI', noteHint: 'If filled, Kira sends this instead of the fields above.',
    save: 'Save', saved: 'Saved', preview: 'What Kira sends',
    empty: 'Nothing yet. Kira sends no profile.',
    responseOptions: { '': 'Not set', concise: 'Concise', detailed: 'Detailed', conversational: 'Conversational' },
    feedbackOptions: { '': 'Not set', direct: 'Direct', diplomatic: 'Diplomatic', socratic: 'As questions' },
  },
  vi: {
    title: 'Về bạn',
    hint: 'Kira đặt phần này trước mọi yêu cầu, để bạn không phải giới thiệu lại. Lưu ở ~/.creative-os/user.json, các công cụ sáng tạo khác cũng đọc được.',
    name: 'Tên', role: 'Vai trò', industry: 'Lĩnh vực', location: 'Nơi làm việc',
    aesthetic: 'Gu thẩm mỹ', avoid: 'Từ cần tránh', clients: 'Khách hàng', deliverables: 'Sản phẩm thường làm',
    listHint: 'Cách nhau bằng dấu phẩy',
    response: 'Cách trả lời', feedback: 'Cách góp ý',
    note: 'Ghi chú cho AI', noteHint: 'Nếu có, Kira gửi đoạn này thay cho các trường ở trên.',
    save: 'Lưu', saved: 'Đã lưu', preview: 'Kira sẽ gửi',
    empty: 'Chưa có gì. Kira không gửi hồ sơ nào.',
    responseOptions: { '': 'Chưa chọn', concise: 'Ngắn gọn', detailed: 'Chi tiết', conversational: 'Trò chuyện' },
    feedbackOptions: { '': 'Chưa chọn', direct: 'Thẳng', diplomatic: 'Khéo léo', socratic: 'Bằng câu hỏi' },
  },
} as const

function toDraft(persona: UserPersona): Draft {
  const join = (items?: string[]) => (items ?? []).join(', ')
  return {
    name: persona.name ?? '', role: persona.role ?? '', industry: join(persona.industry), location: persona.location ?? '',
    aestheticTendency: join(persona.aestheticTendency), avoidKeywords: join(persona.avoidKeywords),
    clientTypes: join(persona.clientTypes), typicalDeliverables: join(persona.typicalDeliverables),
    responseStyle: persona.responseStyle ?? '', feedbackStyle: persona.feedbackStyle ?? '', promptContext: persona.promptContext ?? '',
  }
}

export function PersonaSection({ lang }: { lang: 'en' | 'vi' }) {
  const c = copy[lang]
  const [original, setOriginal] = useState<unknown>(null)
  const [draft, setDraft] = useState<Draft>(() => toDraft({}))
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    readPersonaFile()
      .then((raw) => {
        if (cancelled) return
        setOriginal(raw)
        setDraft(toDraft(normalizePersona(raw)))
        setStatus('idle')
      })
      .catch((reason) => {
        if (cancelled) return
        setError(String(reason))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persona = useMemo(() => normalizePersona(draft), [draft])
  const context = personaPromptContext(persona)
  const field = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (value: string) => {
      setDraft((current) => ({ ...current, [key]: value }))
      setStatus((current) => (current === 'saved' ? 'idle' : current))
    },
  })

  async function save() {
    setStatus('saving')
    setError('')
    try {
      setOriginal(await savePersona(original, persona))
      setStatus('saved')
    } catch (reason) {
      setError(String(reason))
      setStatus('error')
    }
  }

  return (
    <section className="flex flex-col gap-3 border-b border-secondary pb-5" aria-label={c.title}>
      <div className="flex flex-col gap-1">
        <h3 className="text-md font-semibold text-primary">{c.title}</h3>
        <p className="text-sm text-tertiary">{c.hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input size="sm" label={c.name} {...field('name')} />
        <Input size="sm" label={c.role} placeholder="Art Director" {...field('role')} />
        <Input size="sm" label={c.industry} hint={c.listHint} placeholder="F&B, Branding" {...field('industry')} />
        <Input size="sm" label={c.location} {...field('location')} />
        <Input size="sm" label={c.aesthetic} hint={c.listHint} {...field('aestheticTendency')} />
        <Input size="sm" label={c.avoid} hint={c.listHint} {...field('avoidKeywords')} />
        <Input size="sm" label={c.clients} hint={c.listHint} {...field('clientTypes')} />
        <Input size="sm" label={c.deliverables} hint={c.listHint} {...field('typicalDeliverables')} />
        <StringSelect
          size="sm"
          label={c.response}
          {...field('responseStyle')}
          options={Object.entries(c.responseOptions).map(([value, label]) => ({ value, label }))}
        />
        <StringSelect
          size="sm"
          label={c.feedback}
          {...field('feedbackStyle')}
          options={Object.entries(c.feedbackOptions).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <TextArea size="sm" rows={3} label={c.note} hint={c.noteHint} {...field('promptContext')} />
      <details className="text-sm">
        <summary className="cursor-pointer text-secondary">{c.preview}</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary p-3 font-mono text-xs text-secondary">{context || c.empty}</pre>
      </details>
      <div className="flex items-center gap-3">
        <Button color="primary" size="sm" isLoading={status === 'saving'} isDisabled={status === 'loading' || status === 'saving'} onPress={() => void save()}>
          {c.save}
        </Button>
        {status === 'saved' && <span className="text-sm text-tertiary">{c.saved}</span>}
        {status === 'error' && <span className="text-sm text-error-primary" role="alert">{error}</span>}
      </div>
    </section>
  )
}

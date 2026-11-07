// Loading and saving ~/.creative-os/user.json through the native commands
// (read_user_persona / save_user_persona in lib.rs). Outside the desktop app
// (browser preview) it keeps the persona in localStorage instead, so the
// Settings section can still be tried there.
import { invoke } from '@tauri-apps/api/core'
import { mergePersonaForSave, normalizePersona, personaPromptContext, setCurrentPersonaContext, type UserPersona } from './persona'

const PREVIEW_KEY = 'kira.persona.preview'
const isDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** The file's raw content (kept so saving preserves other tools' fields), or null. */
export async function readPersonaFile(): Promise<unknown> {
  if (isDesktop()) return invoke<unknown>('read_user_persona')
  try {
    const stored = window.localStorage.getItem(PREVIEW_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/** Reads the file once at startup and makes its context the one every prompt uses. */
export async function loadPersonaContext() {
  try {
    setCurrentPersonaContext(personaPromptContext(normalizePersona(await readPersonaFile())))
  } catch {
    setCurrentPersonaContext('')
  }
}

export async function savePersona(original: unknown, edited: UserPersona) {
  const merged = mergePersonaForSave(original, edited)
  if (isDesktop()) await invoke('save_user_persona', { persona: merged })
  else window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(merged))
  setCurrentPersonaContext(personaPromptContext(edited))
  return merged
}

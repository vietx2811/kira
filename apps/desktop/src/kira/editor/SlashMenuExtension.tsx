// Phase-1 slash ("/") block-insert menu for the node editor overlay
// (2026-11-09 node-editor-ux spec §3.2, decision 4a). Built directly on
// @tiptap/suggestion (MIT, already a peer of the core editor — see the
// research doc §4) rather than Tiptap Cloud's CLI-scaffolded slash menu,
// which pulls in the Pro AI extension. No tippy.js / floating-ui wiring of
// our own: @tiptap/suggestion 3.29.2 ships a built-in `mount()` helper that
// positions and auto-updates the popup itself.
import { Extension, type Editor, type Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { exitSuggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import {
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote as QuoteIcon,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { filterSlashCommands, type SlashCommandItem } from './slashCommands'

// node-editor-ux-polish brief point 6: Notion-style rows (icon + label +
// one-line description), not bare text. Kept out of slashCommands.ts so
// that module stays plain data with no React/lucide import.
const SLASH_COMMAND_ICONS: Record<SlashCommandItem['id'], LucideIcon> = {
  text: Type,
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  bulletList: List,
  orderedList: ListOrdered,
  quote: QuoteIcon,
  divider: Minus,
  todo: CheckSquare,
}

// Exported so the editor's own `editorProps.handleKeyDown` (main.tsx) can
// check whether the menu is open before treating Escape as "close the whole
// overlay" — without this, both handlers raced for the keystroke (a
// direct EditorView prop like our Escape-closes-overlay handler always runs
// before any plugin's own handleKeyDown, including this one), and Escape
// closed the entire node overlay instead of just the menu.
export const SlashCommandPluginKey = new PluginKey('slashCommand')

function runSlashCommand(editor: Editor, range: Range, id: SlashCommandItem['id']) {
  const chain = editor.chain().focus().deleteRange(range)
  if (id === 'text') chain.setParagraph().run()
  else if (id === 'heading1') chain.setHeading({ level: 1 }).run()
  else if (id === 'heading2') chain.setHeading({ level: 2 }).run()
  else if (id === 'heading3') chain.setHeading({ level: 3 }).run()
  else if (id === 'bulletList') chain.toggleBulletList().run()
  else if (id === 'orderedList') chain.toggleOrderedList().run()
  else if (id === 'quote') chain.toggleBlockquote().run()
  else if (id === 'divider') chain.setHorizontalRule().run()
  else if (id === 'todo') chain.toggleTaskList().run()
}

type SlashMenuListHandle = { onKeyDown: (props: SuggestionKeyDownProps) => boolean }
type SlashMenuListProps = SuggestionProps<SlashCommandItem>

const SlashMenuList = forwardRef<SlashMenuListHandle, SlashMenuListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  useEffect(() => setSelectedIndex(0), [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (props.items.length === 0) return false
      if (event.key === 'ArrowUp') {
        setSelectedIndex((index) => (index + props.items.length - 1) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((index) => (index + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = props.items[selectedIndex]
        if (item) props.command(item)
        return true
      }
      return false
    },
  }), [props.items, props.command, selectedIndex])

  if (props.items.length === 0) {
    return <div className="slash-menu is-empty">No matching block</div>
  }

  return (
    <div className="slash-menu" role="listbox" aria-label="Insert block">
      {props.items.map((item, index) => {
        const Icon = SLASH_COMMAND_ICONS[item.id]
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={index === selectedIndex ? 'slash-menu-item is-selected' : 'slash-menu-item'}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => props.command(item)}
          >
            <Icon size={15} className="slash-menu-item-icon" aria-hidden="true" />
            <span className="slash-menu-item-text">
              <span className="name">{item.label}</span>
              <span className="description">{item.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
})
SlashMenuList.displayName = 'SlashMenuList'

export const SlashCommandExtension = Extension.create<{ onOpenChange: (open: boolean) => void }>({
  name: 'slashCommand',
  addOptions() {
    return { onOpenChange: () => {} }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        pluginKey: SlashCommandPluginKey,
        char: '/',
        startOfLine: false,
        items: ({ query }) => filterSlashCommands(query),
        command: ({ editor, range, props }) => runSlashCommand(editor, range, props.id),
        render: () => {
          let component: ReactRenderer<SlashMenuListHandle, SlashMenuListProps> | null = null
          let unmount: (() => void) | null = null
          return {
            onStart: (props) => {
              this.options.onOpenChange(true)
              component = new ReactRenderer(SlashMenuList, { props, editor: props.editor })
              // `mount()` appends this element straight into document.body and
              // absolutely positions it there — with no z-index of its own it
              // loses to the node-details-popover's scrim (z-index: 100),
              // which sits later in the body-level stacking order despite
              // being mounted first. See styles.css's .slash-menu-portal rule.
              component.element.classList.add('slash-menu-portal')
              unmount = props.mount(component.element as HTMLElement)
            },
            onUpdate: (props) => {
              component?.updateProps(props)
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                exitSuggestion(props.view)
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              this.options.onOpenChange(false)
              unmount?.()
              component?.destroy()
              component = null
              unmount = null
            },
          }
        },
      }),
    ]
  },
})

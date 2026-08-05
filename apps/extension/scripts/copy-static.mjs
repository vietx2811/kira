import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')

await mkdir(dist, { recursive: true })
await copyFile(join(root, 'public', 'manifest.json'), join(dist, 'manifest.json'))
await copyFile(join(root, 'public', 'tokens.css'), join(dist, 'tokens.css'))
await copyFile(join(root, 'public', 'popup.html'), join(dist, 'popup.html'))
await copyFile(join(root, 'public', 'popup.css'), join(dist, 'popup.css'))
await copyFile(join(root, 'public', 'drag-window.html'), join(dist, 'drag-window.html'))
await copyFile(join(root, 'public', 'drag-window.css'), join(dist, 'drag-window.css'))
await cp(join(root, 'public', 'icons'), join(dist, 'icons'), { recursive: true })

const contentPath = join(dist, 'content.js')
const contentScript = await readFile(contentPath, 'utf8')
await writeFile(contentPath, contentScript.replace(/\nexport \{\};\s*$/u, '\n'))

// The Safari target ships checked-in copies of the same bundle. Mirroring them
// here is what stops Safari from silently running an older build than Chrome.
const safariResources = join(root, 'safari', 'KIRA Safari', 'KIRA Safari Extension', 'Resources')
await cp(dist, safariResources, { recursive: true })

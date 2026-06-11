import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')

await mkdir(dist, { recursive: true })
await copyFile(join(root, 'public', 'manifest.json'), join(dist, 'manifest.json'))
await copyFile(join(root, 'public', 'popup.html'), join(dist, 'popup.html'))
await copyFile(join(root, 'public', 'popup.css'), join(dist, 'popup.css'))
await copyFile(join(root, 'public', 'drag-window.html'), join(dist, 'drag-window.html'))
await copyFile(join(root, 'public', 'drag-window.css'), join(dist, 'drag-window.css'))
await cp(join(root, 'public', 'icons'), join(dist, 'icons'), { recursive: true })

const contentPath = join(dist, 'content.js')
const contentScript = await readFile(contentPath, 'utf8')
await writeFile(contentPath, contentScript.replace(/\nexport \{\};\s*$/u, '\n'))

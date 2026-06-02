import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')

await mkdir(dist, { recursive: true })
await copyFile(join(root, 'public', 'manifest.json'), join(dist, 'manifest.json'))
await copyFile(join(root, 'public', 'popup.html'), join(dist, 'popup.html'))
await copyFile(join(root, 'public', 'popup.css'), join(dist, 'popup.css'))

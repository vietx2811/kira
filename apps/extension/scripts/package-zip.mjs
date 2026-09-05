import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')
const releaseDir = join(root, 'release')

if (!existsSync(join(dist, 'manifest.json'))) {
  console.error('extension/dist is missing manifest.json — run `pnpm --filter @kira/extension build` first.')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

// Chrome Web Store and Edge Add-ons both key their listing to the manifest
// version, not package.json's — if the two drift, whoever bumps one and
// forgets the other ships a silently mismatched upload.
if (manifest.version !== pkg.version) {
  console.error(
    `Version mismatch: apps/extension/package.json is ${pkg.version} but public/manifest.json is ${manifest.version}. Keep them in sync before packaging.`,
  )
  process.exit(1)
}

mkdirSync(releaseDir, { recursive: true })
const zipPath = join(releaseDir, `kira-capture-chrome-v${manifest.version}.zip`)
rmSync(zipPath, { force: true })

// Run from inside dist/ so manifest.json lands at the zip root, not under a
// "dist/" prefix — the Chrome Web Store and Edge Add-ons dashboards both
// require the manifest at the archive's top level.
execFileSync('zip', ['-r', '-X', zipPath, '.', '-x', '.DS_Store', '-x', '*.map'], { cwd: dist, stdio: 'inherit' })

console.log(`\nPackaged ${zipPath}`)
console.log('Upload this zip as-is to the Chrome Web Store developer dashboard and to Edge Add-ons.')

#!/usr/bin/env node
// Nâng version KIRA ở mọi nơi trong một lệnh.
//
// Dùng: node scripts/bump-version.mjs <x.y.z> [--build N] [--dry-run]
//
// Release 1.1.0 phải sửa tay 17 file (VERSION, 4 package.json, Cargo.toml/lock,
// Info.plist, tauri.conf.json, 2 manifest extension, project Safari, tài liệu
// đóng gói, README). Script này thay đúng những chỗ đó, kiểm từng chỗ thật sự
// đổi, và dừng (không ghi gì) nếu một mẫu không khớp: thà báo lỗi còn hơn
// release với một file lệch version.
//
// `--build` mặc định = bundleVersion hiện tại + 1 (CFBundleVersion của app và
// CURRENT_PROJECT_VERSION của project Safari, hai số này luôn bằng nhau).
// CHANGELOG.md và docs/releases/<version>.md viết tay, script không đụng.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const next = args.find((a) => /^\d+\.\d+\.\d+$/.test(a))
const buildIdx = args.indexOf('--build')
if (!next) {
  console.error('Dùng: node scripts/bump-version.mjs <x.y.z> [--build N] [--dry-run]')
  process.exit(1)
}

const read = (rel) => readFileSync(join(root, rel), 'utf8')
const current = read('VERSION').trim()
if (!/^\d+\.\d+\.\d+$/.test(current)) {
  console.error(`VERSION hiện tại không hợp lệ: "${current}"`)
  process.exit(1)
}
const tauriConf = read('apps/desktop/src-tauri/tauri.conf.json')
const currentBuild = Number(/"bundleVersion":\s*"(\d+)"/.exec(tauriConf)?.[1])
if (!Number.isInteger(currentBuild)) {
  console.error('Không đọc được bundleVersion trong tauri.conf.json')
  process.exit(1)
}
const build = buildIdx >= 0 ? Number(args[buildIdx + 1]) : currentBuild + 1
if (!Number.isInteger(build) || build <= 0) {
  console.error('--build phải là số nguyên dương')
  process.exit(1)
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const cur = esc(current)

// Mỗi mục: file, danh sách [regex, chuỗi thay, số lần khớp mong đợi].
// Số lần khớp cố định để bắt trường hợp file đổi cấu trúc mà script không biết.
const pkg = (rel) => ({ rel, edits: [[new RegExp(`("version":\\s*")${cur}(")`), `$1${next}$2`, 1]] })
const plan = [
  { rel: 'VERSION', edits: [[new RegExp(`^${cur}$`, 'm'), next, 1]] },
  pkg('package.json'),
  pkg('apps/desktop/package.json'),
  pkg('apps/extension/package.json'),
  pkg('apps/codex-helper/package.json'),
  pkg('apps/extension/public/manifest.json'),
  pkg('apps/extension/safari/KIRA Safari/KIRA Safari Extension/Resources/manifest.json'),
  {
    rel: 'apps/desktop/src-tauri/tauri.conf.json',
    edits: [
      [new RegExp(`("version":\\s*")${cur}(")`), `$1${next}$2`, 1],
      [/("bundleVersion":\s*")\d+(")/, `$1${build}$2`, 1],
    ],
  },
  { rel: 'apps/desktop/src-tauri/Cargo.toml', edits: [[new RegExp(`^version = "${cur}"`, 'm'), `version = "${next}"`, 1]] },
  {
    rel: 'apps/desktop/src-tauri/Cargo.lock',
    edits: [[new RegExp(`(name = "kira-desktop"\\nversion = ")${cur}(")`), `$1${next}$2`, 1]],
  },
  { rel: 'apps/desktop/src-tauri/Info.plist', edits: [[new RegExp(`<string>${cur}</string>`), `<string>${next}</string>`, 1]] },
  {
    rel: 'apps/extension/safari/KIRA Safari/KIRA Safari.xcodeproj/project.pbxproj',
    edits: [
      [new RegExp(`MARKETING_VERSION = ${cur};`, 'g'), `MARKETING_VERSION = ${next};`, 4],
      [/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${build};`, 4],
    ],
  },
  { rel: 'packaging/macos/HUONG-DAN.md', edits: [[new RegExp(`KIRA ${cur}`, 'g'), `KIRA ${next}`, null]] },
  { rel: 'packaging/macos/sign-kira.sh', edits: [[new RegExp(`KIRA ${cur}`, 'g'), `KIRA ${next}`, 2]] },
  // README: link tải, tên file zip, dòng "Version". Thay mọi lần xuất hiện của
  // version cũ, vì README chỉ nhắc version đang phát hành.
  { rel: 'README.md', edits: [[new RegExp(`(?<![\\d.])${cur}(?![\\d.])`, 'g'), next, null]] },
]

const out = []
let failed = false
for (const { rel, edits } of plan) {
  let text = read(rel)
  for (const [re, rep, expected] of edits) {
    const count = (text.match(re.global ? re : new RegExp(re.source, re.flags + 'g')) ?? []).length
    if (count === 0 || (expected !== null && count !== expected)) {
      console.error(`✗ ${rel}: mẫu ${re} khớp ${count} lần, mong đợi ${expected ?? '≥1'}`)
      failed = true
      continue
    }
    text = text.replace(re, rep)
    out.push(`  ${rel}: ${count} chỗ`)
  }
  plan.find((p) => p.rel === rel).result = text
}
if (failed) {
  console.error('Không ghi file nào. Sửa mẫu trong scripts/bump-version.mjs rồi chạy lại.')
  process.exit(2)
}
if (!dryRun) for (const p of plan) writeFileSync(join(root, p.rel), p.result)
console.log(`${dryRun ? '[dry-run] ' : ''}${current} → ${next}, build ${currentBuild} → ${build}`)
console.log(out.join('\n'))
console.log('Còn viết tay: CHANGELOG.md, docs/releases/' + next + '.md')

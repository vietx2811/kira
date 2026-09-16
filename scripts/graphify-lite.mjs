#!/usr/bin/env node
// graphify-lite: cross-references the three seams a single-language tool
// (or plain grep) misses in this repo — TS `invoke()` <-> Rust
// `generate_handler!` <-> `#[tauri::command]` fns, undeclared CSS custom
// properties, and AI-provider type <-> Rust dispatch. See
// docs/research/2026-09-13-graphify-code-graph.md for why this exists
// instead of adopting the `graphify` tool.
//
// No dependencies beyond Node's stdlib. Run: node scripts/graphify-lite.mjs
// Exit code 0 = clean, 2 = at least one error-level finding.
//
// --strict: promotes section 5's findings (colors in a non-last
// background layer) from warnings to errors, so the process exits 2
// when any are present. Without --strict, section 5 findings stay
// warnings and never affect the exit code (the default behaviour).

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const strictMode = process.argv.includes('--strict')

const MAIN_TSX = path.join(repoRoot, 'apps/desktop/src/main.tsx')
const STYLES_CSS = path.join(repoRoot, 'apps/desktop/src/styles.css')
const LIB_RS = path.join(repoRoot, 'apps/desktop/src-tauri/src/lib.rs')

function readFileOrExit(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    console.error(`Cannot read ${filePath}: ${err.message}`)
    process.exit(1)
  }
}

function commitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim()
  } catch {
    return 'unknown (not a git checkout, or git unavailable)'
  }
}

function walkSourceFiles(rootDir) {
  // Recursively collects every .ts/.tsx file under rootDir, skipping any
  // node_modules directory at any depth. Returns paths relative to repoRoot,
  // sorted for stable, diffable output.
  const results = []
  function walk(dir) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
        results.push(full)
      }
    }
  }
  walk(rootDir)
  return results.sort().map((p) => path.relative(repoRoot, p))
}

const mainTsx = readFileOrExit(MAIN_TSX)
// main.tsx is a 20k-line monolith being broken up incrementally (see
// components/application/settings/ — PHA 1 Untitled UI migration,
// 2026-09-16): a Tauri invoke() call, or a JS-set CSS custom property like
// Segmented's --seg-count/--seg-index, can now legitimately live in an
// extracted component file instead of main.tsx. Sections 1 and 2 below treat
// "found literally anywhere under apps/desktop/src" as satisfying those
// checks, not just "found in main.tsx", so an extraction doesn't produce a
// false-positive error/warning purely for moving code to its own file.
const desktopSrcFiles = walkSourceFiles(path.join(repoRoot, 'apps/desktop/src'))
const desktopSrcConcat = desktopSrcFiles.map((relPath) => readFileOrExit(path.join(repoRoot, relPath))).join('\n')
const stylesCss = readFileOrExit(STYLES_CSS)
const libRs = readFileOrExit(LIB_RS)

let hasError = false
const lines = []
function say(line = '') {
  lines.push(line)
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Tauri command map: invoke() <-> generate_handler![...] <-> #[tauri::command]
// ─────────────────────────────────────────────────────────────────────────

function extractGeneratedHandlerNames(rs) {
  const marker = 'tauri::generate_handler!['
  const start = rs.indexOf(marker)
  if (start === -1) {
    throw new Error('tauri::generate_handler![...] not found in lib.rs')
  }
  const openBracket = start + marker.length - 1
  let depth = 0
  let end = -1
  for (let i = openBracket; i < rs.length; i++) {
    if (rs[i] === '[') depth++
    else if (rs[i] === ']') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error('generate_handler![...] never closes')
  const body = rs.slice(openBracket + 1, end)
  return body
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function extractCommandFunctions(rs) {
  // Allows other attributes (e.g. #[allow(...)]) to sit between the
  // #[tauri::command] marker and the fn line, and an optional pub/async.
  const re = /#\[tauri::command\](?:\s*\n\s*#\[[^\]]*\])*\s*\n\s*(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)\s*\(/g
  const names = []
  let m
  while ((m = re.exec(rs))) names.push(m[1])
  return names
}

function extractInvokedNames(ts) {
  // Only counts a literal that appears as the FIRST token after the
  // opening paren (skipping the optional <Generic> and whitespace) — this
  // deliberately does NOT resolve a ternary/computed first argument, e.g.
  // `invoke<string | null>(projectPath ? 'a' : 'b', ...)`. Those calls
  // surface as "registered but not invoked" warnings below instead of a
  // false literal match, matching how a real static reader would fail on
  // a non-literal expression rather than guessing.
  const re = /\binvoke\s*(?:<[^>()]*>)?\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g
  const names = new Set()
  let m
  while ((m = re.exec(ts))) names.add(m[1])
  return names
}

function countInvokeCallSites(ts) {
  const re = /\binvoke\s*(?:<[^>()]*>)?\s*\(/g
  let count = 0
  while (re.exec(ts)) count++
  return count
}

say('## 1. Tauri command map')
say()

let registered, commandFns, invoked
try {
  registered = extractGeneratedHandlerNames(libRs)
  commandFns = extractCommandFunctions(libRs)
  invoked = extractInvokedNames(mainTsx)
} catch (err) {
  console.error(`Tauri command map: ${err.message}`)
  process.exit(1)
}

const registeredSet = new Set(registered)
const commandFnSet = new Set(commandFns)
const totalInvokeSites = countInvokeCallSites(mainTsx)

say(`registered (generate_handler!): ${registered.length}`)
say(`#[tauri::command] functions:    ${commandFns.length}`)
say(`invoke() literal call sites:    ${totalInvokeSites} total, ${invoked.size} distinct literal names`)
say()

const tauriErrors = []
const tauriWarnings = []

for (const name of invoked) {
  if (!registeredSet.has(name)) {
    tauriErrors.push(`invoked '${name}' has no entry in generate_handler![...]`)
  }
}
for (const name of registered) {
  if (!commandFnSet.has(name)) {
    tauriErrors.push(`registered '${name}' has no matching #[tauri::command] fn`)
  }
}
for (const name of commandFns) {
  if (!registeredSet.has(name)) {
    tauriErrors.push(`#[tauri::command] fn '${name}' is never registered in generate_handler![...]`)
  }
}
const invokedAnywhere = extractInvokedNames(desktopSrcConcat)
for (const name of registered) {
  if (!invokedAnywhere.has(name)) {
    tauriWarnings.push(`'${name}' is registered and has a command fn, but no literal invoke('${name}') was found in main.tsx or any file under apps/desktop/src (may be called via a non-literal expression, from Rust itself, or by the OS opening a file)`)
  }
}

if (tauriErrors.length) {
  hasError = true
  say(`ERRORS (${tauriErrors.length}):`)
  for (const e of tauriErrors) say(`  - ${e}`)
} else {
  say('ERRORS (0): every invoked name is registered, every registered name has a command fn.')
}
say()
if (tauriWarnings.length) {
  say(`WARNINGS (${tauriWarnings.length}):`)
  for (const w of tauriWarnings) say(`  - ${w}`)
} else {
  say('WARNINGS (0).')
}
say()

// ─────────────────────────────────────────────────────────────────────────
// 2. Undeclared CSS custom properties
// ─────────────────────────────────────────────────────────────────────────

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function extractDeclaredCssVars(css) {
  // A colon immediately after `--name` only ever occurs at a declaration
  // site; var(--name) / var(--name, fallback) usages never have a colon
  // there, so this needs no selector-awareness to avoid false matches.
  const re = /--([a-zA-Z0-9-]+)\s*:/g
  const declared = new Set()
  let m
  while ((m = re.exec(css))) declared.add(m[1])
  return declared
}

function extractUsedCssVars(css) {
  // Only a var(--x) with NO fallback argument is unsafe if --x is never
  // declared: the browser has nothing to fall back to and the property
  // resolves to its inherited/initial value. var(--x, fallback) is
  // deliberately excluded even when --x is undeclared, per the "no
  // fallback" scoping in docs/research/2026-09-13-graphify-code-graph.md —
  // several real tokens (--canvas-right-inset, --grid-hot-x/-y set via
  // element.style.setProperty, --font-mono) are undeclared-by-design and
  // rely on their fallback, confirmed against c839d1e.
  // A paren-depth scan (not a single regex) is required because the
  // fallback argument can itself contain a function with commas, e.g.
  // var(--x, color-mix(in srgb, red, blue)) — a naive "first comma before
  // the next )" would misidentify that inner comma as the top-level one.
  const used = new Map() // name -> first match index, for locating a sample usage
  const openRe = /var\(\s*--([a-zA-Z0-9-]+)/g
  let m
  while ((m = openRe.exec(css))) {
    const name = m[1]
    let depth = 1 // we're already inside the `var(` that matched
    let hasTopLevelComma = false
    let i = openRe.lastIndex
    for (; i < css.length && depth > 0; i++) {
      const ch = css[i]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (ch === ',' && depth === 1) hasTopLevelComma = true
    }
    if (!hasTopLevelComma && !used.has(name)) used.set(name, m.index)
  }
  return used
}

function extractJsSetCssVars(ts) {
  // buildProjectAppearanceStyle() (and any sibling function following the
  // same shape) returns an object literal keyed by CSS custom-property
  // names, applied as inline style per project. A var() resolved only
  // through this path has no :root declaration and must not be flagged.
  // Also matches a component setting a one-off custom property inline (e.g.
  // Segmented.tsx's `style={{ '--seg-count': ..., '--seg-index': ... }}`),
  // wherever in apps/desktop/src it lives — see the desktopSrcConcat comment
  // above.
  const names = new Set()
  const re = /['"`](--[a-zA-Z0-9-]+)['"`]\s*:/g
  let m
  while ((m = re.exec(ts))) names.add(m[1].slice(2))
  return names
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length
}

say('## 2. Undeclared CSS custom properties (fallback-less var(--x) with no :root declaration and no JS-set fallback)')
say()

const cssNoComments = stripCssComments(stylesCss)
const declaredCssVars = extractDeclaredCssVars(cssNoComments)
const usedCssVars = extractUsedCssVars(cssNoComments)
const jsSetVars = extractJsSetCssVars(desktopSrcConcat)

say(`declared in styles.css :root: ${declaredCssVars.size}`)
say(`set from JS (buildProjectAppearanceStyle-style): ${jsSetVars.size}`)
say(`distinct fallback-less var(--x) usages in styles.css: ${usedCssVars.size}`)
say()

const cssErrors = []
for (const [name, idx] of usedCssVars) {
  if (!declaredCssVars.has(name) && !jsSetVars.has(name)) {
    const line = lineNumberAt(cssNoComments, idx)
    cssErrors.push(`--${name} used at styles.css:${line}, never declared in :root or set from JS`)
  }
}

if (cssErrors.length) {
  hasError = true
  say(`ERRORS (${cssErrors.length}):`)
  for (const e of cssErrors) say(`  - ${e}`)
} else {
  say('ERRORS (0): every used custom property is declared in :root or set from JS.')
}
say()

// ─────────────────────────────────────────────────────────────────────────
// 3. AI provider type <-> Rust dispatch map (informational — no pass/fail
//    criteria was specified for this one; report only)
// ─────────────────────────────────────────────────────────────────────────

function extractProviderTypeUnion(ts) {
  const marker = 'type AiProviderType ='
  const start = ts.indexOf(marker)
  if (start === -1) return []
  // The union is a sequence of `| 'literal'` lines. Scan line by line,
  // collecting literals from lines starting with `|`, and stop at the first
  // line that doesn't start with `|` (after whitespace trimming).
  const rest = ts.slice(start + marker.length)
  const lines = rest.split('\n')
  const out = []
  let inUnion = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!inUnion && !trimmed) continue // skip leading empty lines
    if (trimmed.startsWith('|')) {
      inUnion = true
      const m = trimmed.match(/\|\s*'([a-zA-Z0-9_]+)'/)
      if (m) out.push(m[1])
    } else if (inUnion) {
      // Hit a non-| line after union started; end of union
      break
    } else if (trimmed) {
      // First non-empty, non-| line: could be single-line union
      // Extract all quoted strings and stop (assumes = 'a' | 'b' all on one line)
      for (const m of trimmed.matchAll(/'([a-zA-Z0-9_]+)'/g)) {
        out.push(m[1])
      }
      break
    }
  }
  return out
}

function providerDispatchedInRust(rs, type) {
  const eqRe = new RegExp(`provider_type\\s*==\\s*"${type}"`)
  const matchArmRe = new RegExp(`"${type}"\\s*(?:\\||=>)`)
  return eqRe.test(rs) || matchArmRe.test(rs)
}

say('## 3. AI provider type <-> Rust dispatch (informational, human review — no error/warning criteria set)')
say()

const providerTypes = extractProviderTypeUnion(desktopSrcConcat)
if (providerTypes.length === 0) {
  say('Could not locate `type AiProviderType = ...` in main.tsx or any file under apps/desktop/src — skipped.')
} else {
  say(`AiProviderType union: ${providerTypes.length} types`)
  for (const type of providerTypes) {
    const dispatched = providerDispatchedInRust(libRs, type)
    say(`  - ${type}: ${dispatched ? 'dispatched in lib.rs' : 'NOT referenced in lib.rs (review)'}`)
  }
}
say()

// ─────────────────────────────────────────────────────────────────────────
// 4. CSS class <-> className candidate map (informational only, per spec:
//    "chỉ xuất danh sách để người duyệt, không tính là lỗi")
// ─────────────────────────────────────────────────────────────────────────

function extractSelectorClassNames(css) {
  // Walk brace depth so a `.class` token is only counted when it appears
  // in selector position (text before a `{` that opens a new rule), never
  // inside a declaration's value (e.g. `0.5em`, a color, a url()). This
  // also naturally handles grouped selectors (`.a, .b { ... }`) because a
  // class token is a class token regardless of where a comma later split
  // the group — no comma-splitting needed to find the full set.
  const classes = new Set()
  let depth = 0
  let selectorBuf = ''
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (ch === '{') {
      if (depth === 0) {
        for (const m of selectorBuf.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)) {
          classes.add(m[1])
        }
      }
      depth++
      selectorBuf = ''
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1)
      selectorBuf = ''
    } else if (depth === 0) {
      selectorBuf += ch
    }
  }
  return classes
}

function extractClassNameLiteralsAndPrefixes(ts) {
  const literals = new Set()
  const prefixes = new Set()
  // className="a b c" (also class= for any non-JSX/plain-HTML strings)
  const staticRe = /class(?:Name)?=["']([^"'{}]+)["']/g
  let m
  while ((m = staticRe.exec(ts))) {
    for (const token of m[1].split(/\s+/).filter(Boolean)) literals.add(token)
  }
  // className={`literal ${expr} more-literal--${expr2}`} and
  // className={cond ? 'a' : 'b'} — pull every quoted/backtick string
  // found inside a className={...} expression, plus any `prefix--`
  // segment immediately preceding a `${` interpolation.
  //
  // The container brace can't be found with a lazy `\{([\s\S]*?)\}` regex:
  // a template literal's own `${expr}` interpolation contains a `}` that
  // isn't the container's closing brace, so a non-greedy match truncates
  // mid-expression and silently drops everything after the first `${...}`
  // (this is exactly how `.image-list` and `.segmented` — both real,
  // present classes — went missing on the first pass). A depth-counting
  // scan is required instead.
  const openTag = 'className={'
  let searchFrom = 0
  while (true) {
    const start = ts.indexOf(openTag, searchFrom)
    if (start === -1) break
    const exprStart = start + openTag.length
    let depth = 1
    let i = exprStart
    for (; i < ts.length && depth > 0; i++) {
      if (ts[i] === '{') depth++
      else if (ts[i] === '}') depth--
    }
    const expr = ts.slice(exprStart, i - 1)
    searchFrom = i

    for (const lit of expr.matchAll(/['"`]([^'"`]*)['"`]/g)) {
      for (const token of lit[1].split(/\s+/).filter(Boolean)) {
        if (token.includes('${')) continue
        literals.add(token)
      }
    }
    for (const pre of expr.matchAll(/([a-zA-Z0-9_-]+)\$\{/g)) {
      prefixes.add(pre[1])
    }
  }
  return { literals, prefixes }
}

say('## 4. CSS class <-> className candidates (informational only — not an error)')
say()

// walkSourceFiles/desktopSrcFiles computed once, up top — reused here so
// this list stays identical to what sections 1 and 2 scanned.
const scannedFiles = desktopSrcFiles

const cssClasses = extractSelectorClassNames(cssNoComments)
const tsClassLiterals = new Set()
const tsClassPrefixes = new Set()
for (const relPath of scannedFiles) {
  const contents = readFileOrExit(path.join(repoRoot, relPath))
  const { literals, prefixes } = extractClassNameLiteralsAndPrefixes(contents)
  for (const l of literals) tsClassLiterals.add(l)
  for (const p of prefixes) tsClassPrefixes.add(p)
}

const candidates = []
for (const cls of cssClasses) {
  if (tsClassLiterals.has(cls)) continue
  const matchesPrefix = [...tsClassPrefixes].some((p) => cls.startsWith(p))
  if (matchesPrefix) continue
  const likelyThirdParty = cls.includes('__')
  candidates.push({ cls, likelyThirdParty })
}

const ownCandidates = candidates.filter((c) => !c.likelyThirdParty)
const thirdPartyCandidates = candidates.filter((c) => c.likelyThirdParty)

say(`Source files scanned under apps/desktop/src (${scannedFiles.length}):`)
for (const f of scannedFiles) say(`  - ${f}`)
say()
say(`CSS selector classes found: ${cssClasses.size}`)
say(`Not matched to a literal or dynamic-prefix className in apps/desktop/src: ${candidates.length}`)
say(`  - likely this app's own (review for dead CSS): ${ownCandidates.length}`)
for (const c of ownCandidates) say(`      .${c.cls}`)
say(`  - likely third-party (BEM "__" naming, e.g. react-colorful): ${thirdPartyCandidates.length}`)
for (const c of thirdPartyCandidates) say(`      .${c.cls}`)
say()
say('Caveat: a class only ever set by a library at runtime without a "__" in its name (e.g. Tiptap\'s')
say('is-editor-empty) will still land in the "own" bucket above — this list is unreviewed input, not a verdict.')
say()

// ─────────────────────────────────────────────────────────────────────────
// 5. Invalid multi-layer background declarations (colors only allowed in
//    the last layer; bare colors in any layer of background-image)
// ─────────────────────────────────────────────────────────────────────────

function replaceComments(css) {
  // Replace comments with same length of spaces/newlines so offsets match.
  let result = ''
  let i = 0
  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      // Start of comment
      let j = i + 2
      while (j < css.length - 1) {
        if (css[j] === '*' && css[j + 1] === '/') {
          // End of comment
          for (let k = i; k <= j + 1; k++) {
            result += css[k] === '\n' ? '\n' : ' '
          }
          i = j + 2
          break
        }
        j++
      }
      if (j >= css.length - 1) {
        // Unclosed comment
        for (let k = i; k < css.length; k++) {
          result += css[k] === '\n' ? '\n' : ' '
        }
        break
      }
    } else {
      result += css[i]
      i++
    }
  }
  return result
}

function parseBackgroundLayers(declarationText) {
  // Split a background/background-image value into layers by top-level commas.
  // Respects parenthesis nesting (e.g., color-mix(in srgb, a, b) is one token).
  const layers = []
  let current = ''
  let depth = 0

  for (let i = 0; i < declarationText.length; i++) {
    const ch = declarationText[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      layers.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) layers.push(current.trim())

  return layers
}

function isColorValue(layer) {
  // Returns: true = is a color, false = is an image, null = ambiguous (bare var).
  const trimmed = layer.trim().toLowerCase()

  // Keywords that are colors (excluding 'none' and gradient/image keywords)
  if (trimmed === 'transparent' || trimmed === 'currentcolor') return true

  // Hex color
  if (/^#[0-9a-f]{3,8}$/.test(trimmed)) return true

  // Full CSS named-color set (148 keywords, CSS Color Module Level 4,
  // aliceblue..yellowgreen incl. rebeccapurple). 'transparent' and
  // 'currentcolor' are handled above, not in this list.
  const namedColors = new Set([
    'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige',
    'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown',
    'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral',
    'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
    'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
    'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred',
    'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray',
    'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
    'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick',
    'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro', 'ghostwhite',
    'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey', 'honeydew',
    'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
    'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral',
    'lightcyan', 'lightgoldenrodyellow', 'lightgray', 'lightgreen',
    'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen',
    'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
    'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon',
    'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple',
    'mediumseagreen', 'mediumslateblue', 'mediumspringgreen',
    'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
    'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive',
    'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod',
    'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip',
    'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple',
    'rebeccapurple', 'red', 'rosybrown', 'royalblue', 'saddlebrown',
    'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver',
    'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
    'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet',
    'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen'
  ])
  if (namedColors.has(trimmed)) return true

  // Color functions: rgb(), rgba(), hsl(), hsla(), hwb(), lab(), lch(), oklab(), oklch(), color(), color-mix()
  if (/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/i.test(layer)) return true

  // Bare var(--name) with no other tokens: ambiguous
  if (/^var\s*\(\s*--[a-zA-Z0-9-]+\s*\)$/.test(layer)) return null

  // Everything else: gradients, url(), image-set(), position/size keywords, 'none', variables with fallback, etc.
  return false
}

function extractBackgroundDeclarations(css) {
  // Use stack-based parsing to handle nested blocks (@media, @supports, etc).
  // Returns array of {selector, property, propertyOffset, value}.
  const findings = []
  const stack = [] // Stack of {selector, openBraceIdx, children: [[start, end]]}
  let lastBoundary = 0 // index after the last `{`, `}` or `;`

  for (let i = 0; i < css.length; i++) {
    const ch = css[i]

    if (ch === '{') {
      // The prelude (selector group or at-rule) starts after the previous boundary.
      const prelude = css.slice(lastBoundary, i).trim().replace(/\s+/g, ' ')
      const parent = stack[stack.length - 1]
      const selector = parent ? `${parent.selector} > ${prelude}` : prelude
      stack.push({ selector, openBraceIdx: i, children: [] })
      lastBoundary = i + 1
    } else if (ch === ';') {
      lastBoundary = i + 1
    } else if (ch === '}') {
      lastBoundary = i + 1
      if (stack.length === 0) continue
      const block = stack.pop()
      const blockStart = block.openBraceIdx + 1
      const parent = stack[stack.length - 1]
      if (parent) parent.children.push([block.openBraceIdx, i + 1])

      // Only this block's own declarations: blank out nested child blocks
      // (same length, so offsets still map to the original file).
      let blockContent = css.slice(blockStart, i)
      for (const [start, end] of block.children) {
        const a = start - blockStart
        const b = end - blockStart
        blockContent = blockContent.slice(0, a) + ' '.repeat(b - a) + blockContent.slice(b)
      }

      // `background` / `background-image` as a whole property name, not the
      // tail of a custom property like `--x-background`.
      const bgRe = /(?<![\w-])(background-image|background)\s*:\s*([^;]*);/g
      let m
      while ((m = bgRe.exec(blockContent))) {
        findings.push({
          selector: block.selector,
          property: m[1],
          propertyOffset: blockStart + m.index,
          value: m[2].trim()
        })
      }
    }
  }

  return findings
}

say('## 5. Invalid multi-layer background declarations (color only allowed in last layer)')
say()

const backgroundFindings = []
const cssWithCommentSpaces = replaceComments(stylesCss)
const bgDecls = extractBackgroundDeclarations(cssWithCommentSpaces)

for (const decl of bgDecls) {
  const layers = parseBackgroundLayers(decl.value)
  const isBackgroundImage = decl.property === 'background-image'

  // Calculate line number from the property offset
  const line = stylesCss.slice(0, decl.propertyOffset).split('\n').length

  // For background: shorthand, colors only allowed in last layer
  // For background-image:, colors not allowed in any layer (but bare vars are warnings)
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]
    const colorType = isColorValue(layer)

    if (colorType === true) {
      if (isBackgroundImage) {
        backgroundFindings.push({
          type: 'warning',
          selector: decl.selector,
          line,
          layer,
          index: i,
          property: decl.property,
          severity: `${decl.property} layer ${i} is a bare color (not valid; background-image layers must be images)`
        })
      } else if (i < layers.length - 1) {
        backgroundFindings.push({
          type: 'warning',
          selector: decl.selector,
          line,
          layer,
          index: i,
          property: decl.property,
          severity: `non-last layer is a color (browser silently drops entire declaration)`
        })
      }
    } else if (colorType === null) {
      // Bare var in non-last layer
      if (!isBackgroundImage && i < layers.length - 1) {
        backgroundFindings.push({
          type: 'warning',
          selector: decl.selector,
          line,
          layer,
          index: i,
          property: decl.property,
          severity: `non-last layer is a bare var() (valid only if it resolves to an image)`
        })
      } else if (isBackgroundImage) {
        backgroundFindings.push({
          type: 'warning',
          selector: decl.selector,
          line,
          layer,
          index: i,
          property: decl.property,
          severity: `background-image layer is a bare var() (valid only if it resolves to an image, not a color)`
        })
      }
    }
  }
}

if (backgroundFindings.length) {
  if (strictMode) hasError = true
  const label = strictMode ? 'ERRORS' : 'WARNINGS'
  say(`${label} (${backgroundFindings.length})${strictMode ? ' [--strict: promoted from warnings]' : ''}:`)
  for (const f of backgroundFindings) {
    say(`  - ${f.selector} (styles.css:${f.line}): ${f.severity}`)
    say(`      layer ${f.index}: ${f.layer}`)
  }
} else {
  say('WARNINGS (0): no invalid multi-layer background declarations found.')
}
say()

// ─────────────────────────────────────────────────────────────────────────

say(`Commit: ${commitSha()}`)
say(`Exit code: ${hasError ? 2 : 0}`)

console.log(lines.join('\n'))
process.exit(hasError ? 2 : 0)

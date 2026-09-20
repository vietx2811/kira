// node --test docs/design/slides-spec/slide-text.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import './slide-text.js'

const S = globalThis.SlideText

test('empty node has no title and no body', () => {
  assert.deepEqual(S.splitSlideText(''), { empty: true, title: '', body: '', hints: [] })
  assert.equal(S.splitSlideText('   \n  ').empty, true)
})

test('a short phrase becomes the title, body stays empty (no duplicated sentence)', () => {
  const r = S.splitSlideText('Quiet tools.')
  assert.equal(r.title, 'Quiet tools.')
  assert.equal(r.body, '')
  assert.equal(S.titleStep(r.title).size, 88)
})

test('markdown heading is the title, the rest is the body, markers never leak', () => {
  const r = S.splitSlideText('# Phố cổ sau mưa\nMặt đường phản chiếu biển hiệu, giữ tương phản thấp.')
  assert.equal(r.title, 'Phố cổ sau mưa')
  assert.equal(r.body, 'Mặt đường phản chiếu biển hiệu, giữ tương phản thấp.')
  assert.ok(!r.title.includes('#') && !r.body.includes('#'))
})

test('first sentence is the title, remaining sentences are the body, and they never overlap', () => {
  const r = S.splitSlideText('Quầy bar ánh đồng. Kim loại ấm, ánh sáng chỉ từ quầy.')
  assert.equal(r.title, 'Quầy bar ánh đồng.')
  assert.equal(r.body, 'Kim loại ấm, ánh sáng chỉ từ quầy.')
})

test('long title is clipped at a word with one ellipsis, and the tail continues in the body', () => {
  const src = 'Objects that invite attention through restraint, texture, and repeated handling become the quiet grammar of a brand: a worn brass edge, a hand-rubbed finish, a weight that says it was made to be held again and again.'
  const r = S.splitSlideText(src)
  assert.ok(S.length(r.title) <= 140)
  assert.ok(r.title.endsWith('…') && !r.title.endsWith('……'))
  assert.ok(!/[,;:]…$/.test(r.title), 'no punctuation before the ellipsis')
  assert.ok(r.body.startsWith('…'))
  assert.ok(r.hints.includes('title-clipped'))
  assert.equal(S.titleStep(r.title).size, 34)
})

test('body is bounded and marks the cut', () => {
  const long = '# Ngắn\n' + 'Một câu khá dài về ánh sáng và vật liệu. '.repeat(20)
  const r = S.splitSlideText(long)
  assert.ok(S.length(r.body) <= 220 && r.body.endsWith('…'))
  assert.ok(r.hints.includes('body-clipped'))
})

test('a cut never splits a Vietnamese letter typed as NFD or an emoji', () => {
  const nfd = ('Ấ Ệ Ộ Ữ Ầ Ẫ ').normalize('NFD').repeat(30)
  const r = S.clipAtWord(nfd, 40)
  assert.ok(S.length(r.text) <= 40)
  assert.equal(r.text, r.text.normalize('NFC'), 'output is NFC')
  const emoji = '👨‍👩‍👧‍👦'.repeat(60)
  const e = S.clipAtWord(emoji, 20)
  assert.equal(S.length(e.text), 20)
  assert.ok(!/[‍️]$/.test(e.text.replace('…', '')), 'no dangling joiner')
})

test('never ends on a dangling 1-2 letter word', () => {
  const r = S.clipAtWord('one two three four five six seven eight nine ten of eleven twelve', 45)
  assert.ok(!/\b(of|a|an)…$/.test(r.text), r.text)
})

test('type steps are monotonic: longer title never gets a bigger size', () => {
  const sizes = S.TITLE_STEPS.map((s) => s.size)
  assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a))
  const uppers = S.TITLE_STEPS.map((s) => s.upTo)
  assert.deepEqual(uppers, [...uppers].sort((a, b) => a - b))
  assert.equal(uppers[uppers.length - 1], S.LIMITS.titleMax)
})

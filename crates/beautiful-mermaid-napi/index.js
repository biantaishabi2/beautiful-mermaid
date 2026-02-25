import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const LINE_HEIGHT_RATIO = 1.3
const FORMAT_TAG_REGEX = /<(\/)?(?:(b|strong)|(i|em)|(u)|(s|del))\s*>/gi
const HAS_FORMAT_TAGS = /<\/?(?:b|strong|i|em|u|s|del)\s*>/i
const TEXT_METRICS_TAG_REGEX = /<\/?(?:b|strong|i|em|u|s|del)\s*>/gi

const NARROW_CHARS = new Set(['i', 'l', 't', 'f', 'j', 'I', '1', '!', '|', '.', ',', ':', ';', "'"])
const WIDE_CHARS = new Set(['W', 'M', 'w', 'm', '@', '%'])
const VERY_WIDE_CHARS = new Set(['W', 'M'])
const SEMI_NARROW_PUNCT = new Set(['(', ')', '[', ']', '{', '}', '/', '\\', '-', '"', '`'])
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u

function isNativeRequired() {
  const flag = process.env.BEAUTIFUL_MERMAID_NAPI_REQUIRE_NATIVE
  if (!flag) return false
  const normalized = flag.toLowerCase()
  return normalized === '1' || normalized === 'true'
}

function isCombiningMark(code) {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  )
}

function isFullwidth(code) {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x2eff) ||
    (code >= 0x2f00 && code <= 0x2fdf) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0x3040 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff) ||
    (code >= 0x3100 && code <= 0x312f) ||
    (code >= 0x3130 && code <= 0x318f) ||
    (code >= 0x3190 && code <= 0x31ff) ||
    (code >= 0x3200 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    code >= 0x20000
  )
}

function isEmoji(char) {
  return EMOJI_REGEX.test(char)
}

function getCharWidthFallback(char) {
  const code = char.codePointAt(0)
  if (code === undefined) return 0
  if (isCombiningMark(code)) return 0
  if (isFullwidth(code) || isEmoji(char)) return 2.0
  if (char === ' ') return 0.3
  if (VERY_WIDE_CHARS.has(char)) return 1.5
  if (WIDE_CHARS.has(char)) return 1.2
  if (NARROW_CHARS.has(char)) return 0.4
  if (SEMI_NARROW_PUNCT.has(char)) return 0.5
  if (char === 'r') return 0.8
  if (code >= 65 && code <= 90) return 1.2
  if (code >= 48 && code <= 57) return 1.0
  return 1.0
}

function measureTextWidthFallback(text, fontSize, fontWeight) {
  const baseRatio = fontWeight >= 600 ? 0.60 : fontWeight >= 500 ? 0.57 : 0.54
  let totalWidth = 0
  for (const char of text) {
    totalWidth += getCharWidthFallback(char)
  }
  const minPadding = fontSize * 0.15
  return totalWidth * fontSize * baseRatio + minPadding
}

function measureMultilineTextFallback(text, fontSize, fontWeight) {
  const lines = text.split('\n')
  const lineHeight = fontSize * LINE_HEIGHT_RATIO
  let maxWidth = 0
  for (const line of lines) {
    const plain = line.replace(TEXT_METRICS_TAG_REGEX, '')
    const width = measureTextWidthFallback(plain, fontSize, fontWeight)
    if (width > maxWidth) maxWidth = width
  }
  return {
    width: maxWidth,
    height: lines.length * lineHeight,
    lines,
    lineHeight,
  }
}

function normalizeBrTagsFallback(label) {
  const unquoted = label.startsWith('"') && label.endsWith('"') ? label.slice(1, -1) : label
  return unquoted
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/<\/?(?:sub|sup|small|mark)\s*>/gi, '')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(?<!\*)\*([^\s*](?:[^*]*[^\s*])?)\*(?!\*)/g, '<i>$1</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
}

function stripFormattingTagsFallback(text) {
  return text.replace(/<\/?(?:b|strong|i|em|u|s|del)\s*>/gi, '')
}

function escapeXmlFallback(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseInlineFormatting(line) {
  const segments = []
  let bold = false
  let italic = false
  let underline = false
  let strikethrough = false
  let lastIndex = 0

  FORMAT_TAG_REGEX.lastIndex = 0
  let match
  while ((match = FORMAT_TAG_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index), bold, italic, underline, strikethrough })
    }
    lastIndex = match.index + match[0].length

    const isClosing = Boolean(match[1])
    if (match[2]) bold = !isClosing
    else if (match[3]) italic = !isClosing
    else if (match[4]) underline = !isClosing
    else if (match[5]) strikethrough = !isClosing
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), bold, italic, underline, strikethrough })
  }

  return segments
}

function renderLineContentFallback(line) {
  if (!HAS_FORMAT_TAGS.test(line)) return escapeXmlFallback(line)

  const segments = parseInlineFormatting(line)
  if (segments.length === 0) return ''

  const allPlain = segments.every(s => !s.bold && !s.italic && !s.underline && !s.strikethrough)
  if (allPlain) return segments.map(s => escapeXmlFallback(s.text)).join('')

  return segments.map(seg => {
    const escaped = escapeXmlFallback(seg.text)
    if (!seg.bold && !seg.italic && !seg.underline && !seg.strikethrough) return escaped

    const attrs = []
    if (seg.bold) attrs.push('font-weight="bold"')
    if (seg.italic) attrs.push('font-style="italic"')
    const deco = []
    if (seg.underline) deco.push('underline')
    if (seg.strikethrough) deco.push('line-through')
    if (deco.length) attrs.push(`text-decoration="${deco.join(' ')}"`)

    return `<tspan ${attrs.join(' ')}>${escaped}</tspan>`
  }).join('')
}

function renderMultilineTextFallback(text, cx, cy, fontSize, attrs, baselineShift = 0.35) {
  const lines = text.split('\n')

  if (lines.length === 1) {
    const dy = fontSize * baselineShift
    return `<text x="${cx}" y="${cy}" ${attrs} dy="${dy}">${renderLineContentFallback(text)}</text>`
  }

  const lineHeight = fontSize * LINE_HEIGHT_RATIO
  const firstDy = -((lines.length - 1) / 2) * lineHeight + fontSize * baselineShift
  const tspans = lines.map((line, index) => {
    const dy = index === 0 ? firstDy : lineHeight
    return `<tspan x="${cx}" dy="${dy}">${renderLineContentFallback(line)}</tspan>`
  }).join('')
  return `<text x="${cx}" y="${cy}" ${attrs}>${tspans}</text>`
}

function renderMultilineTextWithBackgroundFallback(
  text, cx, cy, textWidth, textHeight, fontSize, padding, textAttrs, bgAttrs
) {
  const bgWidth = textWidth + padding * 2
  const bgHeight = textHeight + padding * 2
  const rect = `<rect x="${cx - bgWidth / 2}" y="${cy - bgHeight / 2}" ` +
    `width="${bgWidth}" height="${bgHeight}" ${bgAttrs} />`
  const textEl = renderMultilineTextFallback(text, cx, cy, fontSize, textAttrs)
  return `${rect}\n${textEl}`
}

function buildFallbackAddon() {
  return {
    echoBuffer: input => input,
    normalizeBrTags: normalizeBrTagsFallback,
    stripFormattingTags: stripFormattingTagsFallback,
    escapeXml: escapeXmlFallback,
    renderMultilineText: renderMultilineTextFallback,
    renderMultilineTextWithBackground: renderMultilineTextWithBackgroundFallback,
    getCharWidth: getCharWidthFallback,
    measureTextWidth: measureTextWidthFallback,
    measureMultilineText: measureMultilineTextFallback,
  }
}

let addon
let nativeLoaded = false

try {
  addon = require('./index.node')
  nativeLoaded = true
} catch (error) {
  if (isNativeRequired()) {
    throw new Error('Failed to load native addon while BEAUTIFUL_MERMAID_NAPI_REQUIRE_NATIVE=1', { cause: error })
  }
  addon = buildFallbackAddon()
}

export const echoBuffer = addon.echoBuffer
export const normalizeBrTags = addon.normalizeBrTags
export const stripFormattingTags = addon.stripFormattingTags
export const escapeXml = addon.escapeXml
export const renderMultilineText = addon.renderMultilineText
export const renderMultilineTextWithBackground = addon.renderMultilineTextWithBackground
export const getCharWidth = addon.getCharWidth
export const measureTextWidth = addon.measureTextWidth
export const measureMultilineText = addon.measureMultilineText
export const __nativeLoaded = nativeLoaded

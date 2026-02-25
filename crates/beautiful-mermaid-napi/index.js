import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const LINE_HEIGHT_RATIO = 1.3
const FORMAT_TAG_REGEX = /<(\/)?(?:(b|strong)|(i|em)|(u)|(s|del))\s*>/gi
const HAS_FORMAT_TAGS = /<\/?(?:b|strong|i|em|u|s|del)\s*>/i

function isNativeRequired() {
  const flag = process.env.BEAUTIFUL_MERMAID_NAPI_REQUIRE_NATIVE
  if (!flag) return false
  const normalized = flag.toLowerCase()
  return normalized === '1' || normalized === 'true'
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
export const __nativeLoaded = nativeLoaded

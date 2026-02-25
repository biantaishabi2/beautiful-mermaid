// ============================================================================
// Multi-line Text Rendering Utilities
//
// Shared utilities for rendering multi-line text in SVG using <tspan> elements.
// Supports inline formatting: <b>, <i>, <u>, <s> mapped to SVG attributes.
// Used across all diagram types (flowcharts, state, sequence, class, ER).
// ============================================================================

import { createRequire } from 'node:module'
import { LINE_HEIGHT_RATIO } from './text-metrics.ts'

const require = createRequire(import.meta.url)

interface MultilineRustAddon {
  __nativeLoaded: boolean
  normalizeBrTags(label: string): string
  stripFormattingTags(text: string): string
  escapeXml(text: string): string
  renderMultilineText(
    text: string,
    cx: number,
    cy: number,
    fontSize: number,
    attrs: string,
    baselineShift?: number
  ): string
  renderMultilineTextWithBackground(
    text: string,
    cx: number,
    cy: number,
    textWidth: number,
    textHeight: number,
    fontSize: number,
    padding: number,
    textAttrs: string,
    bgAttrs: string
  ): string
}

let rustAddonCache: MultilineRustAddon | null | undefined

function isRustMultilineEnabled(): boolean {
  const flag = typeof process !== 'undefined' ? process.env?.BEAUTIFUL_MERMAID_USE_RUST : undefined
  if (!flag) return false
  const normalized = flag.toLowerCase()
  return normalized === '1' || normalized === 'true'
}

function loadRustAddon(): MultilineRustAddon | null {
  if (rustAddonCache !== undefined) return rustAddonCache
  try {
    const addon = require('../crates/beautiful-mermaid-napi/index.js') as Partial<MultilineRustAddon>
    if (
      addon.__nativeLoaded === true &&
      typeof addon.normalizeBrTags === 'function' &&
      typeof addon.stripFormattingTags === 'function' &&
      typeof addon.escapeXml === 'function' &&
      typeof addon.renderMultilineText === 'function' &&
      typeof addon.renderMultilineTextWithBackground === 'function'
    ) {
      rustAddonCache = addon as MultilineRustAddon
    } else {
      rustAddonCache = null
    }
  } catch {
    rustAddonCache = null
  }
  return rustAddonCache
}

function tryRunRust<T>(fn: (addon: MultilineRustAddon) => T): T | undefined {
  if (!isRustMultilineEnabled()) return undefined
  const addon = loadRustAddon()
  if (!addon) return undefined
  try {
    return fn(addon)
  } catch {
    return undefined
  }
}

/**
 * Normalize label text: strip surrounding quotes, convert <br> tags and
 * literal \n sequences to newline characters. Strips unsupported HTML tags
 * but preserves formatting tags (<b>, <i>, <u>, <s>) for SVG rendering.
 */
function normalizeBrTagsTs(label: string): string {
  const unquoted = label.startsWith('"') && label.endsWith('"') ? label.slice(1, -1) : label
  return unquoted
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/<\/?(?:sub|sup|small|mark)\s*>/gi, '')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(?<!\*)\*([^\s*](?:[^*]*[^\s*])?)\*(?!\*)/g, '<i>$1</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
}

/**
 * Strip all inline formatting tags from text, keeping only plain text.
 * Used for text measurement where tag characters shouldn't affect width.
 */
function stripFormattingTagsTs(text: string): string {
  return text.replace(/<\/?(?:b|strong|i|em|u|s|del)\s*>/gi, '')
}

/**
 * Escape special XML characters in text content.
 */
function escapeXmlTs(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ============================================================================
// Inline formatting: <b>, <i>, <u>, <s> → SVG tspan attributes
// ============================================================================

interface StyledSegment {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
}

const FORMAT_TAG_REGEX = /<(\/)?(?:(b|strong)|(i|em)|(u)|(s|del))\s*>/gi
const HAS_FORMAT_TAGS = /<\/?(?:b|strong|i|em|u|s|del)\s*>/i

function parseInlineFormatting(line: string): StyledSegment[] {
  const segments: StyledSegment[] = []
  let bold = false, italic = false, underline = false, strikethrough = false
  let lastIndex = 0

  FORMAT_TAG_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
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

function renderLineContentTs(line: string): string {
  if (!HAS_FORMAT_TAGS.test(line)) return escapeXmlTs(line)

  const segments = parseInlineFormatting(line)
  if (segments.length === 0) return ''

  const allPlain = segments.every(s => !s.bold && !s.italic && !s.underline && !s.strikethrough)
  if (allPlain) return segments.map(s => escapeXmlTs(s.text)).join('')

  return segments.map(seg => {
    const escaped = escapeXmlTs(seg.text)
    if (!seg.bold && !seg.italic && !seg.underline && !seg.strikethrough) return escaped

    const attrs: string[] = []
    if (seg.bold) attrs.push('font-weight="bold"')
    if (seg.italic) attrs.push('font-style="italic"')
    const deco: string[] = []
    if (seg.underline) deco.push('underline')
    if (seg.strikethrough) deco.push('line-through')
    if (deco.length) attrs.push(`text-decoration="${deco.join(' ')}"`)

    return `<tspan ${attrs.join(' ')}>${escaped}</tspan>`
  }).join('')
}

function renderMultilineTextTs(
  text: string,
  cx: number,
  cy: number,
  fontSize: number,
  attrs: string,
  baselineShift: number = 0.35
): string {
  const lines = text.split('\n')

  if (lines.length === 1) {
    const dy = fontSize * baselineShift
    return `<text x="${cx}" y="${cy}" ${attrs} dy="${dy}">${renderLineContentTs(text)}</text>`
  }

  const lineHeight = fontSize * LINE_HEIGHT_RATIO
  const firstDy = -((lines.length - 1) / 2) * lineHeight + fontSize * baselineShift

  const tspans = lines.map((line, i) => {
    const dy = i === 0 ? firstDy : lineHeight
    return `<tspan x="${cx}" dy="${dy}">${renderLineContentTs(line)}</tspan>`
  }).join('')

  return `<text x="${cx}" y="${cy}" ${attrs}>${tspans}</text>`
}

function renderMultilineTextWithBackgroundTs(
  text: string,
  cx: number,
  cy: number,
  textWidth: number,
  textHeight: number,
  fontSize: number,
  padding: number,
  textAttrs: string,
  bgAttrs: string
): string {
  const bgWidth = textWidth + padding * 2
  const bgHeight = textHeight + padding * 2

  const rect = `<rect x="${cx - bgWidth / 2}" y="${cy - bgHeight / 2}" ` +
    `width="${bgWidth}" height="${bgHeight}" ${bgAttrs} />`

  const textEl = renderMultilineTextTs(text, cx, cy, fontSize, textAttrs)
  return `${rect}\n${textEl}`
}

export function normalizeBrTags(label: string): string {
  const fromRust = tryRunRust(addon => addon.normalizeBrTags(label))
  return fromRust ?? normalizeBrTagsTs(label)
}

export function stripFormattingTags(text: string): string {
  const fromRust = tryRunRust(addon => addon.stripFormattingTags(text))
  return fromRust ?? stripFormattingTagsTs(text)
}

export function escapeXml(text: string): string {
  const fromRust = tryRunRust(addon => addon.escapeXml(text))
  return fromRust ?? escapeXmlTs(text)
}

export function renderMultilineText(
  text: string,
  cx: number,
  cy: number,
  fontSize: number,
  attrs: string,
  baselineShift: number = 0.35
): string {
  const fromRust = tryRunRust(addon => addon.renderMultilineText(text, cx, cy, fontSize, attrs, baselineShift))
  return fromRust ?? renderMultilineTextTs(text, cx, cy, fontSize, attrs, baselineShift)
}

export function renderMultilineTextWithBackground(
  text: string,
  cx: number,
  cy: number,
  textWidth: number,
  textHeight: number,
  fontSize: number,
  padding: number,
  textAttrs: string,
  bgAttrs: string
): string {
  const fromRust = tryRunRust(addon =>
    addon.renderMultilineTextWithBackground(
      text, cx, cy, textWidth, textHeight, fontSize, padding, textAttrs, bgAttrs
    ))
  return fromRust ?? renderMultilineTextWithBackgroundTs(
    text, cx, cy, textWidth, textHeight, fontSize, padding, textAttrs, bgAttrs
  )
}

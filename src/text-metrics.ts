// ============================================================================
// Text Metrics — Variable-width character measurement for SVG layout
// ============================================================================
//
// Provides font-agnostic text width estimation using character class buckets.
// More accurate than uniform character width for proportional fonts.
//
// Width ratios are normalized where 1.0 = average lowercase letter.
// Final pixel width = sum(charWidths) * fontSize * baseRatio
// ============================================================================

import { createRequire } from 'node:module'

/**
 * Narrow characters - visually thin glyphs.
 * Note: '1' is included because in proportional fonts (like Inter), it's
 * significantly narrower than other digits which use tabular/uniform width.
 */
const NARROW_CHARS = new Set(['i', 'l', 't', 'f', 'j', 'I', '1', '!', '|', '.', ',', ':', ';', "'"])

/**
 * Wide characters - visually wide glyphs
 */
const WIDE_CHARS = new Set(['W', 'M', 'w', 'm', '@', '%'])

/**
 * Very wide characters - widest Latin glyphs
 */
const VERY_WIDE_CHARS = new Set(['W', 'M'])

/**
 * Semi-narrow punctuation - brackets and slashes are narrower than letters
 * but wider than narrow chars like dots/commas
 */
const SEMI_NARROW_PUNCT = new Set(['(', ')', '[', ']', '{', '}', '/', '\\', '-', '"', '`'])

/** Regex for emoji detection using Unicode property escapes. */
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u

/** Formatting tags removed before width measurement. */
const FORMATTING_TAG_REGEX = /<\/?(?:b|strong|i|em|u|s|del)\s*>/gi

/** Standard line height ratio for multi-line text (1.3 = 130% of font size) */
export const LINE_HEIGHT_RATIO = 1.3

/** Metrics for multi-line text measurement */
export interface MultilineMetrics {
  /** Maximum line width in pixels */
  width: number
  /** Total height in pixels (lines × lineHeight) */
  height: number
  /** Individual lines after splitting */
  lines: string[]
  /** Computed line height in pixels */
  lineHeight: number
}

interface TextMetricsRustAddon {
  getCharWidth(char: string): number
  measureTextWidth(text: string, fontSize: number, fontWeight: number): number
  measureMultilineText(text: string, fontSize: number, fontWeight: number): MultilineMetrics
}

let rustAddonCache: TextMetricsRustAddon | null | undefined
let nodeRequireCache: ((id: string) => unknown) | null | undefined

function getNodeRequire(): ((id: string) => unknown) | null {
  if (nodeRequireCache !== undefined) return nodeRequireCache
  if (typeof createRequire !== 'function') {
    nodeRequireCache = null
    return nodeRequireCache
  }
  try {
    nodeRequireCache = createRequire(import.meta.url)
  } catch {
    nodeRequireCache = null
  }
  return nodeRequireCache
}

function isRustTextMetricsEnabled(): boolean {
  const flag = typeof process !== 'undefined'
    ? process.env?.BEAUTIFUL_MERMAID_TEXT_METRICS_DISABLE_NATIVE
    : undefined
  if (!flag) return true
  const normalized = flag.toLowerCase()
  return normalized !== '1' && normalized !== 'true'
}

function isNativeRequired(): boolean {
  const flag = typeof process !== 'undefined'
    ? process.env?.BEAUTIFUL_MERMAID_NAPI_REQUIRE_NATIVE
    : undefined
  if (!flag) return false
  const normalized = flag.toLowerCase()
  return normalized === '1' || normalized === 'true'
}

function createNativeRequiredError(cause: unknown): Error {
  const error = new Error('Failed to load native addon while BEAUTIFUL_MERMAID_NAPI_REQUIRE_NATIVE=1')
  ;(error as Error & { cause?: unknown }).cause = cause
  return error
}

function loadRustAddon(): TextMetricsRustAddon | null {
  if (rustAddonCache !== undefined) return rustAddonCache

  const nodeRequire = getNodeRequire()
  if (!nodeRequire) {
    if (isNativeRequired()) {
      throw createNativeRequiredError(new Error('createRequire is unavailable'))
    }
    rustAddonCache = null
    return rustAddonCache
  }

  try {
    const addon = nodeRequire('../crates/beautiful-mermaid-napi/index.node') as Partial<TextMetricsRustAddon>
    if (
      typeof addon.getCharWidth === 'function' &&
      typeof addon.measureTextWidth === 'function' &&
      typeof addon.measureMultilineText === 'function'
    ) {
      rustAddonCache = addon as TextMetricsRustAddon
    } else {
      if (isNativeRequired()) {
        throw createNativeRequiredError(new Error('native addon exports are incomplete'))
      }
      rustAddonCache = null
    }
  } catch (error) {
    if (isNativeRequired()) {
      throw createNativeRequiredError(error)
    }
    rustAddonCache = null
  }

  return rustAddonCache
}

function tryRunRust<T>(fn: (addon: TextMetricsRustAddon) => T): T | undefined {
  if (!isRustTextMetricsEnabled()) return undefined
  const addon = loadRustAddon()
  if (!addon) return undefined
  try {
    return fn(addon)
  } catch (error) {
    if (isNativeRequired()) {
      throw error
    }
    return undefined
  }
}

/**
 * Check if a code point is a combining diacritical mark (zero-width overlay)
 */
function isCombiningMark(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  )
}

/**
 * Check if a code point is fullwidth (CJK, emoji, etc.)
 * These characters occupy approximately 2x the width of Latin letters.
 */
function isFullwidth(code: number): boolean {
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

function isEmoji(char: string): boolean {
  return EMOJI_REGEX.test(char)
}

function getCharWidthTs(char: string): number {
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

function measureTextWidthTs(text: string, fontSize: number, fontWeight: number): number {
  const baseRatio = fontWeight >= 600 ? 0.60 : fontWeight >= 500 ? 0.57 : 0.54

  let totalWidth = 0
  for (const char of text) {
    totalWidth += getCharWidthTs(char)
  }

  const minPadding = fontSize * 0.15
  return totalWidth * fontSize * baseRatio + minPadding
}

function measureMultilineTextTs(
  text: string,
  fontSize: number,
  fontWeight: number
): MultilineMetrics {
  const lines = text.split('\n')
  const lineHeight = fontSize * LINE_HEIGHT_RATIO

  let maxWidth = 0
  for (const line of lines) {
    const plain = line.replace(FORMATTING_TAG_REGEX, '')
    const width = measureTextWidthTs(plain, fontSize, fontWeight)
    if (width > maxWidth) maxWidth = width
  }

  return {
    width: maxWidth,
    height: lines.length * lineHeight,
    lines,
    lineHeight,
  }
}

function isValidMultilineMetrics(value: unknown): value is MultilineMetrics {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<MultilineMetrics>
  return (
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    typeof candidate.lineHeight === 'number' &&
    Array.isArray(candidate.lines) &&
    candidate.lines.every(line => typeof line === 'string')
  )
}

/**
 * Get the relative width of a single character.
 */
export function getCharWidth(char: string): number {
  const fromRust = tryRunRust(addon => addon.getCharWidth(char))
  return typeof fromRust === 'number' ? fromRust : getCharWidthTs(char)
}

/**
 * Measure the pixel width of a text string.
 */
export function measureTextWidth(text: string, fontSize: number, fontWeight: number): number {
  const fromRust = tryRunRust(addon => addon.measureTextWidth(text, fontSize, fontWeight))
  return typeof fromRust === 'number' ? fromRust : measureTextWidthTs(text, fontSize, fontWeight)
}

/**
 * Measure multi-line text dimensions.
 */
export function measureMultilineText(
  text: string,
  fontSize: number,
  fontWeight: number
): MultilineMetrics {
  const fromRust = tryRunRust(addon => addon.measureMultilineText(text, fontSize, fontWeight))
  return isValidMultilineMetrics(fromRust)
    ? fromRust
    : measureMultilineTextTs(text, fontSize, fontWeight)
}

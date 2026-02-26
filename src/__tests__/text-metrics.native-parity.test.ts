import { describe, it, expect } from 'bun:test'
import { createRequire } from 'node:module'
import { getCharWidth, measureTextWidth, measureMultilineText, LINE_HEIGHT_RATIO } from '../text-metrics'

const require = createRequire(import.meta.url)
const NAPI_INDEX_JS_PATH = '../../crates/beautiful-mermaid-napi/index.js'
const NAPI_INDEX_NODE_PATH = '../../crates/beautiful-mermaid-napi/index.node'

type RustTextMetricsAddon = {
  __nativeLoaded: boolean
  getCharWidth(char: string): number
  measureTextWidth(text: string, fontSize: number, fontWeight: number): number
  measureMultilineText(
    text: string,
    fontSize: number,
    fontWeight: number
  ): {
    width: number
    height: number
    lines: string[]
    lineHeight: number
  }
}

function purgeNapiModuleCache() {
  const indexJs = require.resolve(NAPI_INDEX_JS_PATH)
  delete require.cache[indexJs]

  try {
    const indexNode = require.resolve(NAPI_INDEX_NODE_PATH)
    delete require.cache[indexNode]
  } catch {
    // fallback-only 环境下可能不存在 index.node。
  }
}

const rustAddon = (() => {
  const previousRequireNative = process.env.BEAUTIFUL_MERMAID_NAPI_REQUIRE_NATIVE
  process.env.BEAUTIFUL_MERMAID_NAPI_REQUIRE_NATIVE = '1'
  try {
    purgeNapiModuleCache()
    return require(NAPI_INDEX_JS_PATH) as RustTextMetricsAddon
  } finally {
    if (previousRequireNative === undefined) {
      delete process.env.BEAUTIFUL_MERMAID_NAPI_REQUIRE_NATIVE
    } else {
      process.env.BEAUTIFUL_MERMAID_NAPI_REQUIRE_NATIVE = previousRequireNative
    }
  }
})()

function withTsFallback<T>(fn: () => T): T {
  const prev = process.env.BEAUTIFUL_MERMAID_TEXT_METRICS_DISABLE_NATIVE
  process.env.BEAUTIFUL_MERMAID_TEXT_METRICS_DISABLE_NATIVE = '1'
  try {
    return fn()
  } finally {
    if (prev === undefined) {
      delete process.env.BEAUTIFUL_MERMAID_TEXT_METRICS_DISABLE_NATIVE
    } else {
      process.env.BEAUTIFUL_MERMAID_TEXT_METRICS_DISABLE_NATIVE = prev
    }
  }
}

function tsGetCharWidth(char: string): number {
  return withTsFallback(() => getCharWidth(char))
}

function tsMeasureTextWidth(text: string, fontSize: number, fontWeight: number): number {
  return withTsFallback(() => measureTextWidth(text, fontSize, fontWeight))
}

function tsMeasureMultilineText(text: string, fontSize: number, fontWeight: number) {
  return withTsFallback(() => measureMultilineText(text, fontSize, fontWeight))
}

describe('text metrics rust parity', () => {
  it('requires native addon in parity suite', () => {
    expect(rustAddon.__nativeLoaded).toBe(true)
  })

  it('keeps ASCII narrow text width equal and narrower than normal letters', () => {
    const text = 'il.,'
    const fontSize = 16
    const fontWeight = 400
    const ts = tsMeasureTextWidth(text, fontSize, fontWeight)
    const rust = rustAddon.measureTextWidth(text, fontSize, fontWeight)
    const normal = tsMeasureTextWidth('abcd', fontSize, fontWeight)

    expect(rust).toBe(ts)
    expect(ts).toBeLessThan(normal)
  })

  it('keeps combining mark width zero increment', () => {
    const text = 'e\u0301'
    const fontSize = 16
    const fontWeight = 400
    const ts = tsMeasureTextWidth(text, fontSize, fontWeight)
    const rust = rustAddon.measureTextWidth(text, fontSize, fontWeight)
    const base = tsMeasureTextWidth('e', fontSize, fontWeight)

    expect(rust).toBe(ts)
    expect(ts).toBe(base)
  })

  it('keeps CJK fullwidth behavior equal', () => {
    const text = '你好世界'
    const fontSize = 16
    const fontWeight = 400
    const ts = tsMeasureTextWidth(text, fontSize, fontWeight)
    const rust = rustAddon.measureTextWidth(text, fontSize, fontWeight)

    expect(rust).toBe(ts)
  })

  it('keeps emoji width behavior equal', () => {
    const text = 'A😀B'
    const fontSize = 16
    const fontWeight = 400
    const ts = tsMeasureTextWidth(text, fontSize, fontWeight)
    const rust = rustAddon.measureTextWidth(text, fontSize, fontWeight)

    expect(rust).toBe(ts)
  })

  it('strips formatting tags before multiline measurement', () => {
    const text = '<b>Hi</b> <em>Rust</em>'
    const plain = 'Hi Rust'
    const fontSize = 16
    const fontWeight = 400

    const ts = tsMeasureMultilineText(text, fontSize, fontWeight)
    const rust = rustAddon.measureMultilineText(text, fontSize, fontWeight)
    const plainTs = tsMeasureMultilineText(plain, fontSize, fontWeight)

    expect(rust).toEqual(ts)
    expect(ts.width).toBe(plainTs.width)
  })

  it('keeps multiline metrics fully equal', () => {
    const text = 'line1\nline2😀'
    const fontSize = 16
    const fontWeight = 400
    const ts = tsMeasureMultilineText(text, fontSize, fontWeight)
    const rust = rustAddon.measureMultilineText(text, fontSize, fontWeight)

    expect(rust).toEqual(ts)
    expect(rust.lineHeight).toBe(fontSize * LINE_HEIGHT_RATIO)
    expect(rust.height).toBe(rust.lineHeight * rust.lines.length)
    expect(rust.lines.length).toBe(2)
  })

  it('keeps fontWeight scaling equal', () => {
    const text = 'Mermaid'
    const fontSize = 16

    const tsRegular = tsMeasureTextWidth(text, fontSize, 400)
    const tsBold = tsMeasureTextWidth(text, fontSize, 700)
    const rustRegular = rustAddon.measureTextWidth(text, fontSize, 400)
    const rustBold = rustAddon.measureTextWidth(text, fontSize, 700)

    expect(rustRegular).toBe(tsRegular)
    expect(rustBold).toBe(tsBold)
    expect(rustBold).toBeGreaterThan(rustRegular)
  })

  it('keeps minPadding behavior equal for empty text', () => {
    const fontSize = 16
    const fontWeight = 400
    const expected = fontSize * 0.15
    const ts = tsMeasureTextWidth('', fontSize, fontWeight)
    const rust = rustAddon.measureTextWidth('', fontSize, fontWeight)

    expect(rust).toBe(ts)
    expect(ts).toBe(expected)
  })

  it('keeps getCharWidth parity on key classes', () => {
    const chars = ['i', 'r', 'W', '中', '😀', '\u0301', ' ']
    for (const char of chars) {
      const ts = tsGetCharWidth(char)
      const rust = rustAddon.getCharWidth(char)
      expect(rust).toBe(ts)
    }
  })
})

import { describe, it, expect } from 'bun:test'
import { createRequire } from 'node:module'
import {
  normalizeBrTags,
  stripFormattingTags,
  escapeXml,
  renderMultilineText,
  renderMultilineTextWithBackground,
} from '../multiline-utils.ts'

const require = createRequire(import.meta.url)

type RustAddon = {
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

const rustAddon = require('../../crates/beautiful-mermaid-napi/index.js') as RustAddon

function withRustFlag<T>(flag: string | undefined, fn: () => T): T {
  const prev = process.env.BEAUTIFUL_MERMAID_USE_RUST
  if (flag === undefined) {
    delete process.env.BEAUTIFUL_MERMAID_USE_RUST
  } else {
    process.env.BEAUTIFUL_MERMAID_USE_RUST = flag
  }
  try {
    return fn()
  } finally {
    if (prev === undefined) {
      delete process.env.BEAUTIFUL_MERMAID_USE_RUST
    } else {
      process.env.BEAUTIFUL_MERMAID_USE_RUST = prev
    }
  }
}

function runTs<T>(fn: () => T): T {
  return withRustFlag(undefined, fn)
}

describe('multiline utils rust parity', () => {
  it('normalizes br variants to newline', () => {
    const inputs = ['a<br>b', 'a<br/>b', 'a<br />b', 'a<BR>b']
    for (const input of inputs) {
      const ts = runTs(() => normalizeBrTags(input))
      const rust = rustAddon.normalizeBrTags(input)
      expect(ts).toBe('a\nb')
      expect(rust).toBe(ts)
    }
  })

  it('converts literal \\n to newline', () => {
    const input = 'a\\nb'
    const ts = runTs(() => normalizeBrTags(input))
    const rust = rustAddon.normalizeBrTags(input)
    expect(ts).toBe('a\nb')
    expect(rust).toBe(ts)
  })

  it('converts markdown bold', () => {
    const input = '**text**'
    const ts = runTs(() => normalizeBrTags(input))
    const rust = rustAddon.normalizeBrTags(input)
    expect(ts).toBe('<b>text</b>')
    expect(rust).toBe(ts)
  })

  it('handles markdown italic boundary', () => {
    const input = '*a* 与 * a *'
    const ts = runTs(() => normalizeBrTags(input))
    const rust = rustAddon.normalizeBrTags(input)
    expect(ts).toBe('<i>a</i> 与 * a *')
    expect(rust).toBe(ts)
  })

  it('converts markdown strike', () => {
    const input = '~~text~~'
    const ts = runTs(() => normalizeBrTags(input))
    const rust = rustAddon.normalizeBrTags(input)
    expect(ts).toBe('<s>text</s>')
    expect(rust).toBe(ts)
  })

  it('strips special sub/sup tags', () => {
    const input = 'H<sub>2</sub>O 与 x<sup>2</sup>'
    const ts = runTs(() => normalizeBrTags(input))
    const rust = rustAddon.normalizeBrTags(input)
    expect(ts).toBe('H2O 与 x2')
    expect(rust).toBe(ts)
  })

  it('escapes xml characters', () => {
    const input = '& < > " \''
    const ts = runTs(() => escapeXml(input))
    const rust = rustAddon.escapeXml(input)
    expect(ts).toBe('&amp; &lt; &gt; &quot; &#39;')
    expect(rust).toBe(ts)
  })

  it('renders nested formatting tags consistently', () => {
    const input = '<b><i>text</i></b>'
    const attrs = 'text-anchor="middle"'
    const ts = runTs(() => renderMultilineText(input, 120, 80, 16, attrs))
    const rust = rustAddon.renderMultilineText(input, 120, 80, 16, attrs, 0.35)
    expect(rust).toBe(ts)
    expect(ts).toContain('font-weight="bold"')
    expect(ts).toContain('font-style="italic"')
  })

  it('keeps multiline dy calculation equal', () => {
    const input = 'line1\nline2\nline3'
    const attrs = 'text-anchor="middle"'
    const ts = runTs(() => renderMultilineText(input, 120, 80, 16, attrs))
    const rust = rustAddon.renderMultilineText(input, 120, 80, 16, attrs, 0.35)
    expect(rust).toBe(ts)
    expect(ts).toContain('dy="-15.200000000000001"')
    expect(ts.match(/dy="20.8"/g)).toHaveLength(2)
  })

  it('keeps background rendering output equal', () => {
    const input = 'line1\nline2'
    const textAttrs = 'text-anchor="middle" fill="var(--_text)"'
    const bgAttrs = 'fill="var(--_bg)"'
    const ts = runTs(() =>
      renderMultilineTextWithBackground(
        input,
        100,
        80,
        120,
        42,
        16,
        6,
        textAttrs,
        bgAttrs
      )
    )
    const rust = rustAddon.renderMultilineTextWithBackground(
      input,
      100,
      80,
      120,
      42,
      16,
      6,
      textAttrs,
      bgAttrs
    )
    expect(rust).toBe(ts)
  })

  it('uses rust adapter when BEAUTIFUL_MERMAID_USE_RUST=1', () => {
    const input = '**text**'
    const expected = rustAddon.normalizeBrTags(input)
    const actual = withRustFlag('1', () => normalizeBrTags(input))
    expect(actual).toBe(expected)
  })

  it('stripFormattingTags stays equal between ts and rust', () => {
    const input = '<b>bold</b> and <i>italic</i>'
    const ts = runTs(() => stripFormattingTags(input))
    const rust = rustAddon.stripFormattingTags(input)
    expect(ts).toBe('bold and italic')
    expect(rust).toBe(ts)
  })
})

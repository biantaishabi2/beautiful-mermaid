import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let addon

try {
  addon = require('./index.node')
} catch {
  const tsImpl = require('../../src/multiline-utils.ts')

  const withRustDisabled = (fn, ...args) => {
    const prev = process.env.BEAUTIFUL_MERMAID_USE_RUST
    delete process.env.BEAUTIFUL_MERMAID_USE_RUST
    try {
      return fn(...args)
    } finally {
      if (prev === undefined) delete process.env.BEAUTIFUL_MERMAID_USE_RUST
      else process.env.BEAUTIFUL_MERMAID_USE_RUST = prev
    }
  }

  addon = {
    echoBuffer: input => input,
    normalizeBrTags: label => withRustDisabled(tsImpl.normalizeBrTags, label),
    stripFormattingTags: text => withRustDisabled(tsImpl.stripFormattingTags, text),
    escapeXml: text => withRustDisabled(tsImpl.escapeXml, text),
    renderMultilineText: (text, cx, cy, fontSize, attrs, baselineShift) =>
      withRustDisabled(tsImpl.renderMultilineText, text, cx, cy, fontSize, attrs, baselineShift),
    renderMultilineTextWithBackground: (
      text, cx, cy, textWidth, textHeight, fontSize, padding, textAttrs, bgAttrs
    ) =>
      withRustDisabled(
        tsImpl.renderMultilineTextWithBackground,
        text, cx, cy, textWidth, textHeight, fontSize, padding, textAttrs, bgAttrs
      ),
  }
}

export const echoBuffer = addon.echoBuffer
export const normalizeBrTags = addon.normalizeBrTags
export const stripFormattingTags = addon.stripFormattingTags
export const escapeXml = addon.escapeXml
export const renderMultilineText = addon.renderMultilineText
export const renderMultilineTextWithBackground = addon.renderMultilineTextWithBackground

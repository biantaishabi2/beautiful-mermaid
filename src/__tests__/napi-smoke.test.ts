import { describe, it, expect } from 'bun:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { echoBuffer } = require('../../crates/beautiful-mermaid-napi/index.js') as {
  echoBuffer(input: Uint8Array): Uint8Array
}

describe('napi smoke', () => {
  it('echoBuffer returns same data', () => {
    const input = new Uint8Array([1, 2, 3, 4])
    const out = echoBuffer(input)
    expect(out).toBeInstanceOf(Uint8Array)
    expect(Array.from(out)).toEqual([1, 2, 3, 4])
  })
})

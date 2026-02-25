import { describe, it, expect } from 'bun:test'
import { echoBuffer } from '../../crates/beautiful-mermaid-napi/index.js'

describe('napi smoke', () => {
  it('echoBuffer returns same data', () => {
    const input = new Uint8Array([1, 2, 3, 4])
    const out = echoBuffer(input)
    expect(out).toBeInstanceOf(Uint8Array)
    expect(Array.from(out)).toEqual([1, 2, 3, 4])
  })
})

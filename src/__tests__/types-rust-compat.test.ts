import { describe, it, expect } from 'bun:test'
import type { MermaidGraph, PositionedGraph, TypesContractPayload } from '../types.ts'
import {
  fromMermaidGraphContract,
  normalizeMermaidGraphWithRustFallback,
  normalizePositionedGraphWithRustFallback,
  toMermaidGraphContract,
  toPositionedGraphContract,
} from '../types.ts'

function makeGraph(): MermaidGraph {
  return {
    direction: 'TD',
    nodes: new Map([
      ['n1', { id: 'n1', label: 'Node 1', shape: 'trapezoid-alt' }],
      ['n2', { id: 'n2', label: 'Node 2', shape: 'state-start' }],
      ['n3', { id: 'n3', label: 'Node 3', shape: 'state-end' }],
    ]),
    edges: [
      {
        source: 'n1',
        target: 'n2',
        style: 'solid',
        hasArrowStart: false,
        hasArrowEnd: true,
      },
    ],
    subgraphs: [
      {
        id: 'sg1',
        label: 'sub',
        nodeIds: ['n1', 'n2'],
        children: [],
      },
    ],
    classDefs: new Map([
      ['primary', { fill: '#fff', stroke: '#000' }],
    ]),
    classAssignments: new Map([
      ['n1', 'primary'],
    ]),
    nodeStyles: new Map([
      ['n1', { fill: '#f0f0f0' }],
    ]),
  }
}

function makeDeepSubgraphGraph(depth: number): MermaidGraph {
  const graph = makeGraph()
  const root = { id: 'root', label: 'root', nodeIds: ['n1'], children: [] as MermaidGraph['subgraphs'] }
  let current = root
  for (let i = 1; i <= depth; i++) {
    const child = { id: `sg${i}`, label: `sg${i}`, nodeIds: ['n1'], children: [] as MermaidGraph['subgraphs'] }
    current.children.push(child)
    current = child
  }
  graph.subgraphs = [root]
  return graph
}

describe('types rust compat', () => {
  it('keeps map insertion order through contract roundtrip', () => {
    const graph = makeGraph()
    const contract = toMermaidGraphContract(graph)
    expect(Object.keys(contract.nodes)).toEqual(['n1', 'n2', 'n3'])

    const roundtrip = fromMermaidGraphContract(contract)
    expect(Array.from(roundtrip.nodes.keys())).toEqual(['n1', 'n2', 'n3'])
    expect(Array.from(roundtrip.nodes.values()).map(node => node.shape)).toEqual([
      'trapezoid-alt',
      'state-start',
      'state-end',
    ])
  })

  it('omits optional fields instead of serializing null', () => {
    const positioned: PositionedGraph = {
      width: 200,
      height: 120,
      nodes: [
        {
          id: 'n1',
          label: 'Node 1',
          shape: 'rectangle',
          x: 10,
          y: 10,
          width: 100,
          height: 40,
        },
      ],
      edges: [
        {
          source: 'n1',
          target: 'n1',
          style: 'solid',
          hasArrowStart: false,
          hasArrowEnd: true,
          points: [{ x: 0, y: 0 }, { x: 12, y: 8 }],
        },
      ],
      groups: [
        {
          id: 'g1',
          label: 'group',
          x: 0,
          y: 0,
          width: 200,
          height: 120,
          children: [],
        },
      ],
    }

    const contract = toPositionedGraphContract(positioned)
    expect(contract.nodes[0]).not.toHaveProperty('inlineStyle')
    expect(contract.edges[0]).not.toHaveProperty('label')
    expect(contract.edges[0]).not.toHaveProperty('labelPosition')

    const json = JSON.stringify(contract)
    expect(json).not.toContain('inlineStyle')
    expect(json).not.toContain('labelPosition')
    expect(json).not.toContain(':null')
  })

  it('uses rust result when contract is valid', () => {
    const graph = makeGraph()
    const result = normalizeMermaidGraphWithRustFallback(graph, {
      useRust: true,
      runtime: {
        normalizeContracts(payload: TypesContractPayload): unknown {
          return payload
        },
      },
    })

    expect(result.engine).toBe('rust')
    expect(result.fallbackReason).toBeUndefined()
    expect(Array.from(result.graph.nodes.entries())).toEqual(Array.from(graph.nodes.entries()))
    expect(result.graph.subgraphs[0]?.direction).toBeUndefined()
  })

  it('falls back to ts when rust contract validation fails', () => {
    const graph = makeGraph()
    const result = normalizeMermaidGraphWithRustFallback(graph, {
      useRust: true,
      runtime: {
        normalizeContracts(): unknown {
          return { unexpected: true }
        },
      },
    })

    expect(result.engine).toBe('ts')
    expect(result.fallbackReason).toContain('契约校验失败')
    expect(Array.from(result.graph.nodes.keys())).toEqual(['n1', 'n2', 'n3'])
  })

  it('falls back to ts when positionedGraph nested contract fields are invalid', () => {
    const positioned: PositionedGraph = {
      width: 200,
      height: 120,
      nodes: [
        {
          id: 'n1',
          label: 'Node 1',
          shape: 'rectangle',
          x: 10,
          y: 10,
          width: 100,
          height: 40,
        },
      ],
      edges: [
        {
          source: 'n1',
          target: 'n1',
          style: 'solid',
          hasArrowStart: false,
          hasArrowEnd: true,
          points: [{ x: 0, y: 0 }, { x: 12, y: 8 }],
        },
      ],
      groups: [
        {
          id: 'g1',
          label: 'group',
          x: 0,
          y: 0,
          width: 200,
          height: 120,
          children: [],
        },
      ],
    }

    const result = normalizePositionedGraphWithRustFallback(positioned, {
      useRust: true,
      runtime: {
        normalizeContracts(payload: TypesContractPayload): unknown {
          return {
            positionedGraph: {
              ...payload.positionedGraph!,
              edges: [
                {
                  ...payload.positionedGraph!.edges[0],
                  points: [{ x: 1, y: 1 }, { bad: true }],
                },
              ],
            },
          }
        },
      },
    })

    expect(result.engine).toBe('ts')
    expect(result.fallbackReason).toContain('契约校验失败')
    expect(result.graph).toEqual(positioned)
  })

  it('falls back to ts when map keys are integer-like and may reorder', () => {
    const graph: MermaidGraph = {
      ...makeGraph(),
      nodes: new Map([
        ['2', { id: '2', label: 'Node 2', shape: 'rectangle' }],
        ['10', { id: '10', label: 'Node 10', shape: 'rectangle' }],
        ['1', { id: '1', label: 'Node 1', shape: 'rectangle' }],
      ]),
      classAssignments: new Map([
        ['2', 'primary'],
        ['10', 'primary'],
        ['1', 'primary'],
      ]),
      nodeStyles: new Map([
        ['2', { fill: '#f0f0f0' }],
        ['10', { fill: '#f0f0f0' }],
        ['1', { fill: '#f0f0f0' }],
      ]),
    }

    const result = normalizeMermaidGraphWithRustFallback(graph, {
      useRust: true,
      runtime: {
        normalizeContracts(payload: TypesContractPayload): unknown {
          return payload
        },
      },
    })

    expect(result.engine).toBe('ts')
    expect(result.fallbackReason).toContain('整数样式')
    expect(Array.from(result.graph.nodes.keys())).toEqual(['2', '10', '1'])
  })

  it('accepts nested subgraphs at depth boundary', () => {
    const graph = makeDeepSubgraphGraph(256)
    const result = normalizeMermaidGraphWithRustFallback(graph, {
      useRust: true,
      runtime: {
        normalizeContracts(payload: TypesContractPayload): unknown {
          return payload
        },
      },
    })

    expect(result.engine).toBe('rust')
    expect(result.fallbackReason).toBeUndefined()
  })

  it('falls back to ts when nested subgraph depth exceeds limit', () => {
    const graph = makeDeepSubgraphGraph(257)
    const result = normalizeMermaidGraphWithRustFallback(graph, {
      useRust: true,
      runtime: {
        normalizeContracts(payload: TypesContractPayload): unknown {
          return payload
        },
      },
    })

    expect(result.engine).toBe('ts')
    expect(result.fallbackReason).toContain('深度超过限制')
  })
})

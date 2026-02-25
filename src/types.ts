// ============================================================================
// Parsed graph — logical structure extracted from Mermaid text
// ============================================================================

export interface MermaidGraph {
  direction: Direction
  nodes: Map<string, MermaidNode>
  edges: MermaidEdge[]
  subgraphs: MermaidSubgraph[]
  classDefs: Map<string, Record<string, string>>
  /** Maps node IDs to their class names (from `class X className` or `:::className` shorthand) */
  classAssignments: Map<string, string>
  /** Maps node IDs to inline styles (from `style X fill:#f00,stroke:#333`) */
  nodeStyles: Map<string, Record<string, string>>
}

export type Direction = 'TD' | 'TB' | 'LR' | 'BT' | 'RL'

export interface MermaidNode {
  id: string
  label: string
  shape: NodeShape
}

export type NodeShape =
  | 'rectangle'
  | 'rounded'
  | 'diamond'
  | 'stadium'
  | 'circle'
  // Batch 1 additions
  | 'subroutine'     // [[text]]  — double-bordered rectangle
  | 'doublecircle'   // (((text))) — concentric circles
  | 'hexagon'        // {{text}}  — six-sided polygon
  // Batch 2 additions
  | 'cylinder'       // [(text)]  — database cylinder
  | 'asymmetric'     // >text]    — flag/banner shape
  | 'trapezoid'      // [/text\]  — wider bottom
  | 'trapezoid-alt'  // [\text/]  — wider top
  // Batch 3 state diagram pseudostates
  | 'state-start'    // filled circle (start pseudostate)
  | 'state-end'      // bullseye circle (end pseudostate)

export interface MermaidEdge {
  source: string
  target: string
  label?: string
  style: EdgeStyle
  /** Whether to render an arrowhead at the start (source end) of the edge */
  hasArrowStart: boolean
  /** Whether to render an arrowhead at the end (target end) of the edge */
  hasArrowEnd: boolean
}

export type EdgeStyle = 'solid' | 'dotted' | 'thick'

export interface MermaidSubgraph {
  id: string
  label: string
  nodeIds: string[]
  children: MermaidSubgraph[]
  /** Optional direction override for this subgraph's internal layout */
  direction?: Direction
}

// ============================================================================
// Positioned graph — after ELK layout, ready for SVG rendering
// ============================================================================

export interface PositionedGraph {
  width: number
  height: number
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  groups: PositionedGroup[]
}

export interface PositionedNode {
  id: string
  label: string
  shape: NodeShape
  x: number
  y: number
  width: number
  height: number
  /** Inline styles resolved from classDef + explicit `style` statements — override theme defaults */
  inlineStyle?: Record<string, string>
}

export interface PositionedEdge {
  source: string
  target: string
  label?: string
  style: EdgeStyle
  hasArrowStart: boolean
  hasArrowEnd: boolean
  /** Full path including bends — array of {x, y} points */
  points: Point[]
  /** Layout-computed label center position (avoids label-label collisions) */
  labelPosition?: Point
}

export interface Point {
  x: number
  y: number
}

export interface PositionedGroup {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  children: PositionedGroup[]
}

// ============================================================================
// Render options — user-facing configuration
//
// Color theming uses CSS custom properties: --bg and --fg are required,
// optional enrichment variables (--line, --accent, --muted, --surface,
// --border) add richer color from Shiki themes or custom palettes.
// See src/theme.ts for the full variable system.
// ============================================================================

export interface RenderOptions {
  /** Background color → CSS variable --bg. Default: '#FFFFFF' */
  bg?: string
  /** Foreground / primary text color → CSS variable --fg. Default: '#27272A' */
  fg?: string

  // -- Optional enrichment colors (fall back to color-mix from bg/fg) --

  /** Edge/connector color → CSS variable --line */
  line?: string
  /** Arrow heads, highlights → CSS variable --accent */
  accent?: string
  /** Secondary text, edge labels → CSS variable --muted */
  muted?: string
  /** Node/box fill tint → CSS variable --surface */
  surface?: string
  /** Node/group stroke color → CSS variable --border */
  border?: string

  /** Font family for all text. Default: 'Inter' */
  font?: string
  /** Canvas padding in px. Default: 40 */
  padding?: number
  /** Horizontal spacing between sibling nodes. Default: 24 */
  nodeSpacing?: number
  /** Vertical spacing between layers. Default: 40 */
  layerSpacing?: number
  /** Spacing between disconnected components. Default: nodeSpacing (24) */
  componentSpacing?: number
  /** Render with transparent background (no background style on SVG). Default: false */
  transparent?: boolean
}

// ============================================================================
// Rust type contract adapter
// ============================================================================

export interface MermaidGraphContract {
  direction: Direction
  nodes: Record<string, MermaidNode>
  edges: MermaidEdge[]
  subgraphs: MermaidSubgraph[]
  classDefs: Record<string, Record<string, string>>
  classAssignments: Record<string, string>
  nodeStyles: Record<string, Record<string, string>>
}

export interface PositionedGraphContract {
  width: number
  height: number
  nodes: PositionedNodeContract[]
  edges: PositionedEdgeContract[]
  groups: PositionedGroupContract[]
}

export interface PositionedNodeContract {
  id: string
  label: string
  shape: NodeShape
  x: number
  y: number
  width: number
  height: number
  inlineStyle?: Record<string, string>
}

export interface PositionedEdgeContract {
  source: string
  target: string
  label?: string
  style: EdgeStyle
  hasArrowStart: boolean
  hasArrowEnd: boolean
  points: Point[]
  labelPosition?: Point
}

export interface PositionedGroupContract {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  children: PositionedGroupContract[]
}

export interface TypesContractPayload {
  mermaidGraph?: MermaidGraphContract
  positionedGraph?: PositionedGraphContract
}

export interface RustTypesContractRuntime {
  normalizeContracts(payload: TypesContractPayload): unknown
}

export interface TypesContractRuntimeOptions {
  useRust?: boolean
  runtime?: RustTypesContractRuntime | null
}

export interface TypesContractRuntimeResult {
  engine: 'ts' | 'rust'
  payload: TypesContractPayload
  fallbackReason?: string
}

export interface MermaidGraphRuntimeResult {
  engine: 'ts' | 'rust'
  graph: MermaidGraph
  fallbackReason?: string
}

export interface PositionedGraphRuntimeResult {
  engine: 'ts' | 'rust'
  graph: PositionedGraph
  fallbackReason?: string
}

function mapToRecord<V>(map: Map<string, V>): Record<string, V> {
  const record: Record<string, V> = {}
  for (const [key, value] of map.entries()) {
    record[key] = value
  }
  return record
}

function recordEntries<V>(record: Record<string, V>): Array<[string, V]> {
  return Object.entries(record) as Array<[string, V]>
}

function recordToMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(recordEntries(record))
}

function toMermaidSubgraphContract(subgraph: MermaidSubgraph): MermaidSubgraph {
  const next: MermaidSubgraph = {
    id: subgraph.id,
    label: subgraph.label,
    nodeIds: [...subgraph.nodeIds],
    children: subgraph.children.map(toMermaidSubgraphContract),
  }
  if (subgraph.direction !== undefined) {
    next.direction = subgraph.direction
  }
  return next
}

function fromMermaidSubgraphContract(subgraph: MermaidSubgraph): MermaidSubgraph {
  const next: MermaidSubgraph = {
    id: subgraph.id,
    label: subgraph.label,
    nodeIds: [...subgraph.nodeIds],
    children: subgraph.children.map(fromMermaidSubgraphContract),
  }
  if (subgraph.direction !== undefined) {
    next.direction = subgraph.direction
  }
  return next
}

export function toMermaidGraphContract(graph: MermaidGraph): MermaidGraphContract {
  return {
    direction: graph.direction,
    nodes: mapToRecord(graph.nodes),
    edges: graph.edges.map(edge => {
      const next: MermaidEdge = {
        source: edge.source,
        target: edge.target,
        style: edge.style,
        hasArrowStart: edge.hasArrowStart,
        hasArrowEnd: edge.hasArrowEnd,
      }
      if (edge.label !== undefined) {
        next.label = edge.label
      }
      return next
    }),
    subgraphs: graph.subgraphs.map(toMermaidSubgraphContract),
    classDefs: mapToRecord(
      new Map(
        Array.from(graph.classDefs.entries()).map(([name, styles]) => [name, { ...styles }])
      )
    ),
    classAssignments: mapToRecord(graph.classAssignments),
    nodeStyles: mapToRecord(
      new Map(
        Array.from(graph.nodeStyles.entries()).map(([id, styles]) => [id, { ...styles }])
      )
    ),
  }
}

export function fromMermaidGraphContract(contract: MermaidGraphContract): MermaidGraph {
  return {
    direction: contract.direction,
    nodes: recordToMap(contract.nodes),
    edges: contract.edges.map(edge => {
      const next: MermaidEdge = {
        source: edge.source,
        target: edge.target,
        style: edge.style,
        hasArrowStart: edge.hasArrowStart,
        hasArrowEnd: edge.hasArrowEnd,
      }
      if (edge.label !== undefined) {
        next.label = edge.label
      }
      return next
    }),
    subgraphs: contract.subgraphs.map(fromMermaidSubgraphContract),
    classDefs: new Map(
      recordEntries(contract.classDefs).map(([name, styles]) => [name, { ...styles }])
    ),
    classAssignments: recordToMap(contract.classAssignments),
    nodeStyles: new Map(
      recordEntries(contract.nodeStyles).map(([id, styles]) => [id, { ...styles }])
    ),
  }
}

function toPositionedGroupContract(group: PositionedGroup): PositionedGroupContract {
  return {
    id: group.id,
    label: group.label,
    x: group.x,
    y: group.y,
    width: group.width,
    height: group.height,
    children: group.children.map(toPositionedGroupContract),
  }
}

function fromPositionedGroupContract(group: PositionedGroupContract): PositionedGroup {
  return {
    id: group.id,
    label: group.label,
    x: group.x,
    y: group.y,
    width: group.width,
    height: group.height,
    children: group.children.map(fromPositionedGroupContract),
  }
}

export function toPositionedGraphContract(graph: PositionedGraph): PositionedGraphContract {
  return {
    width: graph.width,
    height: graph.height,
    nodes: graph.nodes.map(node => {
      const next: PositionedNodeContract = {
        id: node.id,
        label: node.label,
        shape: node.shape,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      }
      if (node.inlineStyle !== undefined) {
        next.inlineStyle = { ...node.inlineStyle }
      }
      return next
    }),
    edges: graph.edges.map(edge => {
      const next: PositionedEdgeContract = {
        source: edge.source,
        target: edge.target,
        style: edge.style,
        hasArrowStart: edge.hasArrowStart,
        hasArrowEnd: edge.hasArrowEnd,
        points: edge.points.map(point => ({ x: point.x, y: point.y })),
      }
      if (edge.label !== undefined) {
        next.label = edge.label
      }
      if (edge.labelPosition !== undefined) {
        next.labelPosition = { x: edge.labelPosition.x, y: edge.labelPosition.y }
      }
      return next
    }),
    groups: graph.groups.map(toPositionedGroupContract),
  }
}

export function fromPositionedGraphContract(contract: PositionedGraphContract): PositionedGraph {
  return {
    width: contract.width,
    height: contract.height,
    nodes: contract.nodes.map(node => {
      const next: PositionedNode = {
        id: node.id,
        label: node.label,
        shape: node.shape,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      }
      if (node.inlineStyle !== undefined) {
        next.inlineStyle = { ...node.inlineStyle }
      }
      return next
    }),
    edges: contract.edges.map(edge => {
      const next: PositionedEdge = {
        source: edge.source,
        target: edge.target,
        style: edge.style,
        hasArrowStart: edge.hasArrowStart,
        hasArrowEnd: edge.hasArrowEnd,
        points: edge.points.map(point => ({ x: point.x, y: point.y })),
      }
      if (edge.label !== undefined) {
        next.label = edge.label
      }
      if (edge.labelPosition !== undefined) {
        next.labelPosition = { x: edge.labelPosition.x, y: edge.labelPosition.y }
      }
      return next
    }),
    groups: contract.groups.map(fromPositionedGroupContract),
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecordOfObjects(value: unknown): value is Record<string, Record<string, unknown>> {
  if (!isPlainObject(value)) return false
  return Object.values(value).every(entry => isPlainObject(entry))
}

function isMermaidGraphContract(value: unknown): value is MermaidGraphContract {
  if (!isPlainObject(value)) return false
  return (
    typeof value.direction === 'string' &&
    isPlainObject(value.nodes) &&
    Array.isArray(value.edges) &&
    Array.isArray(value.subgraphs) &&
    isRecordOfObjects(value.classDefs) &&
    isPlainObject(value.classAssignments) &&
    isRecordOfObjects(value.nodeStyles)
  )
}

function isPositionedGraphContract(value: unknown): value is PositionedGraphContract {
  if (!isPlainObject(value)) return false
  return (
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges) &&
    Array.isArray(value.groups)
  )
}

function isTypesContractPayload(value: unknown): value is TypesContractPayload {
  if (!isPlainObject(value)) return false
  const hasMermaidGraph = value.mermaidGraph !== undefined
  const hasPositionedGraph = value.positionedGraph !== undefined
  if (!hasMermaidGraph && !hasPositionedGraph) return false
  if (hasMermaidGraph && !isMermaidGraphContract(value.mermaidGraph)) return false
  if (hasPositionedGraph && !isPositionedGraphContract(value.positionedGraph)) return false
  return true
}

function isRustEnabled(useRust?: boolean): boolean {
  if (typeof useRust === 'boolean') {
    return useRust
  }
  const flag = typeof process !== 'undefined' ? process.env?.BM_USE_RUST : undefined
  if (flag === undefined) return false
  const normalized = flag.toLowerCase()
  return normalized === '1' || normalized === 'true'
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function resolveTypesContractPayload(
  payload: TypesContractPayload,
  options: TypesContractRuntimeOptions = {}
): TypesContractRuntimeResult {
  if (!isRustEnabled(options.useRust)) {
    return { engine: 'ts', payload }
  }

  const runtime = options.runtime
  if (!runtime) {
    return {
      engine: 'ts',
      payload,
      fallbackReason: 'Rust 初始化失败：runtime 不可用',
    }
  }

  try {
    const normalized = runtime.normalizeContracts(payload)
    if (!isTypesContractPayload(normalized)) {
      return {
        engine: 'ts',
        payload,
        fallbackReason: 'Rust 契约校验失败：返回结构不合法',
      }
    }
    return { engine: 'rust', payload: normalized }
  } catch (error) {
    return {
      engine: 'ts',
      payload,
      fallbackReason: `Rust 初始化失败：${formatError(error)}`,
    }
  }
}

export function normalizeMermaidGraphWithRustFallback(
  graph: MermaidGraph,
  options: TypesContractRuntimeOptions = {}
): MermaidGraphRuntimeResult {
  const resolved = resolveTypesContractPayload(
    { mermaidGraph: toMermaidGraphContract(graph) },
    options
  )
  const mermaidGraph = resolved.payload.mermaidGraph
  if (!mermaidGraph) {
    return {
      engine: 'ts',
      graph,
      fallbackReason: 'Rust 契约校验失败：mermaidGraph 缺失',
    }
  }
  return {
    engine: resolved.engine,
    graph: fromMermaidGraphContract(mermaidGraph),
    fallbackReason: resolved.fallbackReason,
  }
}

export function normalizePositionedGraphWithRustFallback(
  graph: PositionedGraph,
  options: TypesContractRuntimeOptions = {}
): PositionedGraphRuntimeResult {
  const resolved = resolveTypesContractPayload(
    { positionedGraph: toPositionedGraphContract(graph) },
    options
  )

  const positionedGraph = resolved.payload.positionedGraph
  if (!positionedGraph) {
    return {
      engine: 'ts',
      graph,
      fallbackReason: 'Rust 契约校验失败：positionedGraph 缺失',
    }
  }

  return {
    engine: resolved.engine,
    graph: fromPositionedGraphContract(positionedGraph),
    fallbackReason: resolved.fallbackReason,
  }
}

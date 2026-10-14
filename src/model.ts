import { emptyConfig, familyById, identifyFamily, isObj, materialize, nodeName, policyFor, recipeById, variantFor, type Family, type Json, type Kind, type Obj, type Path } from './catalogue'

const identities = new WeakMap<object, string>()
let nextIdentity = 0
export function uiId(value: object): string {
  let id = identities.get(value)
  if (!id) { id = `ui-${++nextIdentity}`; identities.set(value, id) }
  return id
}
function inherit<T extends object>(before: object, after: T): T { identities.set(after, uiId(before)); return after }
export function pathText(path: Path): string {
  return '$' + path.map(k => typeof k === 'number' ? `[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `.${k}` : `[${JSON.stringify(k)}]`).join('')
}
export function getAt(value: Json, path: Path): Json | undefined {
  let current: Json | undefined = value
  for (const key of path) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined
    current = (current as Obj)[key]
  }
  return current
}
export function setAt(doc: Obj, path: Path, value: Json | undefined): Obj {
  const update = (current: Json | undefined, depth: number): Json => {
    if (depth === path.length) {
      if (current && value && typeof current === 'object' && typeof value === 'object' && Array.isArray(current) === Array.isArray(value)) return inherit(current, value)
      return value as Json
    }
    const key = path[depth]
    if (Array.isArray(current)) {
      const copy = inherit(current, [...current])
      if (depth === path.length - 1 && value === undefined) copy.splice(Number(key), 1)
      else copy[Number(key)] = update(current[Number(key)], depth + 1)
      return copy
    }
    const obj = isObj(current) ? current : {}
    if (depth === path.length - 1 && value === undefined) {
      const { [key]: removed, ...rest } = obj
      void removed
      return inherit(obj, rest)
    }
    return inherit(obj, { ...obj, [key]: update(Object.hasOwn(obj, key) ? obj[key] : undefined, depth + 1) })
  }
  const result = update(doc, 0)
  if (!isObj(result)) throw new Error('The CAP root must be a JSON object.')
  return result
}
export function parseJson(text: string): Json {
  return JSON.parse(text, (_key: string, value: unknown) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Numeric overflow cannot round-trip as JSON. Supply a finite JSON number.')
    return value
  }) as Json
}
export function parseDocument(text: string): Obj {
  const value = parseJson(text)
  if (!isObj(value)) throw new Error('Import requires a JSON object root. The last valid document was kept.')
  return value
}
export const serialize = (doc: Obj): string => JSON.stringify(doc, null, 2)

export interface Node {
  id: string; path: Path; value: Json; kind: Kind; family?: Family; variant?: string; policy: string; name: string
  containerId?: string; rowId?: string; index?: number; modal: boolean; workflowFiles?: boolean
}
export interface Container {
  id: string; path: Path; kind: Kind; layout: 'grid' | 'list'; modal: boolean; ownerId: string; title: string
  items: Node[]; rows: Node[]
}
export interface Index { root: Node; nodes: Map<string, Node>; containers: Map<string, Container> }
export function indexConfig(doc: Obj): Index {
  const nodes = new Map<string, Node>()
  const containers = new Map<string, Container>()
  const node = (value: Json, path: Path, kind: Kind, modal = false, parent?: Container, rowId?: string, index?: number): Node => {
    const family = identifyFamily(kind, value, modal)
    const n: Node = { id: value !== null && typeof value === 'object' ? uiId(value) : `raw:${pathText(path)}`, path, value, kind, family, variant: variantFor(family, value), policy: policyFor(family, value), name: nodeName(kind, value, family), containerId: parent?.id, rowId, index, modal }
    if (kind === 'group' && parent) {
      const owner = nodes.get(parent.ownerId)?.value
      n.workflowFiles = isObj(owner) && owner.type === 'files_workflow'
    }
    nodes.set(n.id, n)
    return n
  }
  const container = (owner: Node, keyPath: Path, kind: Kind, layout: Container['layout'], title: string, modal = false) => {
    const path = [...owner.path, ...keyPath]
    const value = getAt(doc, path)
    if (!Array.isArray(value)) return
    const c: Container = { id: `container:${uiId(value)}`, path, kind, layout, modal, ownerId: owner.id, title, items: [], rows: [] }
    containers.set(c.id, c)
    value.forEach((item, i) => {
      if (layout === 'grid' && Array.isArray(item)) {
        const r = node(item, [...path, i], 'row', modal, c, undefined, i)
        r.family = familyById['B-layout']; r.policy = 'approved'; r.name = `Row ${i + 1}`
        c.rows.push(r)
        item.forEach((v, j) => { const n = node(v, [...path, i, j], kind, modal, c, r.id, j); c.items.push(n); children(n) })
      } else {
        const n = node(item, [...path, i], kind, modal, c, undefined, i)
        c.items.push(n)
        if (layout === 'grid') { n.family = undefined; n.policy = 'diagnostic-only'; n.name = 'Raw invalid row' }
        else children(n)
      }
    })
  }
  const children = (n: Node) => {
    if (!isObj(n.value)) return
    switch (n.family?.id) {
      case 'B-root':
        if (isObj(doc.label)) node(doc.label, ['label'], 'label')
        if (isObj(doc.sets)) node(doc.sets, ['sets'], 'sets')
        container(n, ['var'], 'alias', 'list', 'Ordered variables')
        for (const [key, title] of [['headerSections', 'Header'], ['detailSections', 'Detail'], ['bodySections', 'Body']]) container(n, ['form', key], 'section', 'grid', title)
        container(n, ['form', 'actions'], 'action', 'list', 'Main actions')
        container(n, ['modals'], 'modal', 'list', 'Modal definitions')
        break
      case 'B-form': container(n, ['fields'], 'field', 'grid', 'Form fields', n.modal); break
      case 'B-table':
        container(n, ['headers'], 'header', 'list', 'Column headings', n.modal)
        container(n, ['rows'], 'cell', 'list', 'Column templates · not business records', n.modal)
        container(n, ['endRows'], 'footer', 'grid', 'Summary rows', n.modal)
        break
      case 'B-tabs': container(n, ['tabs'], 'tab', 'list', 'Tab panels'); break
      case 'B-tab': container(n, ['sections'], 'section', 'grid', 'Tab sections'); break
      case 'B-modal':
        container(n, ['sections'], 'section', 'grid', 'Modal sections · form/table shapes', true)
        container(n, ['actions'], 'action', 'list', 'Modal actions', true)
        break
      case 'B-files': container(n, ['tabs'], 'group', 'list', 'File groups'); break
      case 'B-actions': container(n, ['callbacks'], 'callback', 'list', 'Post-success callbacks'); break
    }
  }
  const root = node(doc, [], 'root')
  children(root)
  return { root, nodes, containers }
}

export type Source = { recipeId: string } | { nodeId: string }
export interface Target { containerId: string; rowId?: string; index: number; newRow?: boolean; rowInsert?: boolean }
const prefix = (parent: Path, child: Path) => parent.length <= child.length && parent.every((key, i) => key === child[i])
function sourceInfo(index: Index, source: Source): { value: Json; kind: Kind; family?: Family; node?: Node } {
  if ('recipeId' in source) {
    const recipe = recipeById[source.recipeId]
    if (!recipe) throw new Error('Unknown catalogue recipe.')
    return { value: materialize(recipe), kind: recipe.kind, family: recipe.family }
  }
  const n = index.nodes.get(source.nodeId)
  if (!n) throw new Error('The source no longer exists.')
  return { value: n.value, kind: n.kind, family: n.family, node: n }
}
function itemReason(kind: Kind, value: Json, destination: Container): string | undefined {
  if (kind !== destination.kind) return `${kind} components cannot be placed in ${destination.kind} containers.`
  if (kind === 'section' && destination.modal && (!isObj(value) || (!value.fields && !value.$list))) return 'Modal sections accept form fields or table $list shapes only. Tabs and other sections are unsupported.'
  if (!identifyFamily(kind, value, destination.modal)) return 'Unsupported/raw discriminator at this placement; preserve it as a diagnostic node or explicitly edit its subtree.'
  return undefined
}
export function dropReason(doc: Obj, source: Source, target: Target): string | undefined {
  try {
    const index = indexConfig(doc)
    const dest = index.containers.get(target.containerId)
    if (!dest) return 'The destination no longer exists.'
    if (!Number.isInteger(target.index) || target.index < 0) return 'Destination index must be a non-negative integer.'
    const info = sourceInfo(index, source)
    if ('recipeId' in source && dest.modal && info.kind === 'section' && !['B-form', 'B-table'].includes(info.family?.id ?? '')) return 'Modal sections accept Form and Table recipes only.'
    if (info.node && prefix(info.node.path, dest.path)) return 'A component cannot be moved inside itself or its descendants.'
    if (info.kind === 'row') {
      if (!target.rowInsert || dest.layout !== 'grid') return 'Drag a row to another row handle or use its row move controls.'
      const original = info.node?.containerId ? index.containers.get(info.node.containerId) : undefined
      if (original?.kind !== dest.kind || !Array.isArray(info.value)) return 'Rows must retain the same section/field/summary placement.'
      for (const item of info.value) { const reason = itemReason(dest.kind, item, dest); if (reason) return reason }
    } else {
      if (target.rowInsert) return 'This target reorders whole rows; drop a component inside a row or in a new-row target.'
      const reason = itemReason(info.kind, info.value, dest)
      if (reason) return reason
      if (dest.layout === 'grid' && !target.newRow) {
        const row = target.rowId ? index.nodes.get(target.rowId) : undefined
        if (!row || row.containerId !== dest.id || !Array.isArray(row.value)) return 'Choose an existing compatible row or a new-row target.'
      }
    }
    const length = target.newRow || target.rowInsert ? dest.rows.length : target.rowId ? (index.nodes.get(target.rowId)?.value as Json[]).length : dest.items.length
    if (target.index > length) return 'The destination index is beyond the current container.'
    return undefined
  } catch (error) { return error instanceof Error ? error.message : 'Invalid drop.' }
}
export function place(doc: Obj, source: Source, target: Target): { doc: Obj; selectedId: string } {
  const reason = dropReason(doc, source, target)
  if (reason) throw new Error(reason)
  let index = indexConfig(doc)
  const info = sourceInfo(index, source)
  const selectedId = info.value !== null && typeof info.value === 'object' ? uiId(info.value) : info.node!.id
  const beforeDest = index.containers.get(target.containerId)!
  const beforeRow = target.rowId ? index.nodes.get(target.rowId) : undefined
  const beforeArrayPath = beforeRow?.path ?? beforeDest.path
  let position = target.index
  if (info.node) {
    const sourceArrayPath = info.node.path.slice(0, -1)
    if (pathText(sourceArrayPath) === pathText(beforeArrayPath) && Number(info.node.path.at(-1)) < position) position--
    doc = setAt(doc, info.node.path, undefined)
  }
  index = indexConfig(doc)
  const dest = index.containers.get(target.containerId)!
  const row = target.rowId ? index.nodes.get(target.rowId) : undefined
  const arrayPath = row?.path ?? dest.path
  const items = getAt(doc, arrayPath) as Json[]
  const value = target.newRow ? [info.value] : info.value
  const copy = [...items]
  copy.splice(position, 0, value)
  return { doc: setAt(doc, arrayPath, copy), selectedId }
}
export function duplicate(doc: Obj, nodeId: string): { doc: Obj; selectedId: string } {
  const n = indexConfig(doc).nodes.get(nodeId)
  if (!n?.containerId) throw new Error('Select a component or row to duplicate.')
  const path = n.path.slice(0, -1)
  const items = [...getAt(doc, path) as Json[]]
  const copy = structuredClone(n.value)
  items.splice(Number(n.path.at(-1)) + 1, 0, copy)
  return { doc: setAt(doc, path, items), selectedId: copy !== null && typeof copy === 'object' ? uiId(copy) : n.id }
}
export function remove(doc: Obj, nodeId: string): Obj {
  const n = indexConfig(doc).nodes.get(nodeId)
  if (!n?.containerId) throw new Error('Select a component or row to remove.')
  return setAt(doc, n.path, undefined)
}
export function adjacentTarget(doc: Obj, nodeId: string, offset: number): Target {
  const index = indexConfig(doc)
  const n = index.nodes.get(nodeId)
  if (!n?.containerId) throw new Error('This node is not reorderable.')
  const c = index.containers.get(n.containerId)!
  const items = n.kind === 'row' ? c.rows : n.rowId ? c.items.filter(item => item.rowId === n.rowId) : c.items
  const current = items.findIndex(item => item.id === n.id)
  const next = current + offset
  if (next < 0 || next >= items.length) throw new Error('Already at the edge of this row/list.')
  return { containerId: c.id, rowId: n.rowId, rowInsert: n.kind === 'row', index: offset > 0 ? next + 1 : next }
}
export function targets(doc: Obj, source: Source): { target: Target; label: string }[] {
  const index = indexConfig(doc)
  const isRow = 'nodeId' in source && index.nodes.get(source.nodeId)?.kind === 'row'
  const result: { target: Target; label: string }[] = []
  const add = (target: Target, label: string) => { if (!dropReason(doc, source, target)) result.push({ target, label }) }
  for (const c of index.containers.values()) {
    const label = `${c.title} · ${pathText(c.path)}`
    if (isRow) add({ containerId: c.id, index: c.rows.length, rowInsert: true }, `${label} · last row`)
    else if (c.layout === 'list') add({ containerId: c.id, index: c.items.length }, `${label} · end`)
    else {
      for (const row of c.rows) add({ containerId: c.id, rowId: row.id, index: (row.value as Json[]).length }, `${label} · ${row.name} · last sibling`)
      add({ containerId: c.id, index: (getAt(doc, c.path) as Json[]).length, newRow: true }, `${label} · new vertical row`)
    }
  }
  return result
}
export function ensureArray(doc: Obj, path: Path): Obj {
  const current = getAt(doc, path)
  if (current !== undefined && !Array.isArray(current)) throw new Error(`Preserved non-array at ${pathText(path)}; explicitly correct its subtree first.`)
  return current === undefined ? setAt(doc, path, []) : doc
}
export function pairedColumn(doc: Obj, tableId: string): { doc: Obj; selectedId: string } {
  const table = indexConfig(doc).nodes.get(tableId)
  if (table?.family?.id !== 'B-table' || !isObj(table.value)) throw new Error('Select a supported table.')
  const headers = table.value.headers, rows = table.value.rows
  if (!Array.isArray(headers) || !Array.isArray(rows) || headers.length !== rows.length) throw new Error('Resolve the existing heading/template mismatch before adding a paired column.')
  const header = materialize(recipeById['B-header-cell'])
  const cell = materialize(recipeById['V-cell-text'])
  doc = setAt(doc, [...table.path, 'headers'], [...headers, header])
  doc = setAt(doc, [...table.path, 'rows'], [...rows, cell])
  return { doc, selectedId: uiId(cell as object) }
}
export function reorderColumn(doc: Obj, tableId: string, column: number, offset: number): Obj {
  const n = indexConfig(doc).nodes.get(tableId)
  if (!n || !isObj(n.value) || !Array.isArray(n.value.headers) || !Array.isArray(n.value.rows) || n.value.headers.length !== n.value.rows.length) throw new Error('Paired reordering requires matching heading/template counts.')
  const to = column + offset
  if (to < 0 || to >= n.value.headers.length) throw new Error('Column is already at the edge.')
  for (const key of ['headers', 'rows']) {
    const values = [...n.value[key] as Json[]]
    const [item] = values.splice(column, 1)
    values.splice(to, 0, item)
    doc = setAt(doc, [...n.path, key], values)
  }
  return doc
}
export { emptyConfig }

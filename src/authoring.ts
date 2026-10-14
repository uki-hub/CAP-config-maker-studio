import { type Json, type Path } from './catalogue'
import { type Index, type Target } from './model'

/** Resolve the author's insertion scope, without changing the CAP document. */
export function insertionContainers(index: Index, selectedId: string, containerId?: string) {
  const explicit = containerId && index.containers.get(containerId)
  if (explicit) return [explicit]
  const node = index.nodes.get(selectedId) ?? index.root
  const owned = [...index.containers.values()].filter(c => c.ownerId === node.id)
  if (node.kind === 'root') return owned.filter(c => c.kind === 'section')
  if (node.kind !== 'action' && owned.length) return owned
  const parent = node.containerId && index.containers.get(node.containerId)
  return parent ? [parent] : owned
}

export function endTarget(c: ReturnType<typeof insertionContainers>[number]): Target {
  return { containerId: c.id, index: c.layout === 'grid' ? c.rows.length + c.items.filter(n => !n.rowId).length : c.items.length, newRow: c.layout === 'grid' }
}

/** CAP rewrites every @ and captures braces even inside quoted keys. Never invent escaping. */
export function bindingExpression(alias: string, path: Path, repeatedIndex?: number): string {
  if (!/^[A-Za-z_$][\w$]*$/.test(alias)) throw new Error('Use an alias name such as __DATA or __Data, without @ or braces.')
  if (path.some(key => typeof key === 'string' && /[@{}]/.test(key))) throw new Error('This key contains @ or braces, which CAP rewrites. Use a separately authored alias for this value.')
  const suffix = path.map((key, i) => typeof key === 'number' ? `[${i === repeatedIndex ? '@i' : key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`).join('')
  return `{@${alias}${suffix}}`
}

export function valueSummary(value: Json): string {
  if (Array.isArray(value)) return `${value.length} items`
  if (value !== null && typeof value === 'object') return `${Object.keys(value).length} keys`
  return JSON.stringify(value)
}

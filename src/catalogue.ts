import core from '../../../../learning/phase-3-polished/result/core/blueprint.json'

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type Obj = { [key: string]: Json }
export type Path = (string | number)[]
export type Kind = 'root' | 'label' | 'sets' | 'section' | 'field' | 'header' | 'cell' | 'footer' | 'tab' | 'modal' | 'action' | 'alias' | 'group' | 'callback' | 'row'
export interface Family {
  id: string; placement: string; policy: string; template: Json; slots: Record<string, string>
  contracts: string[]; variants: string[]; sources: string[]; evidence: string[]; usage: string; checks: string[]; requires?: string
}
export interface Placeholder { id: string; kind: string; stored?: string; evaluated: string; built?: string; input: string; edge: string; timing?: string }
export interface Recipe { id: string; family: Family; kind: Kind; name: string; type?: string; variant?: string; policy: string }
export const catalogue = core
export const families = core.families as unknown as Family[]
export const familyById = Object.fromEntries(families.map(f => [f.id, f]))
export function isObj(v: unknown): v is Obj { return v !== null && typeof v === 'object' && !Array.isArray(v) }

// UI placements/names only. CAP templates, IDs, variants and constraints stay in the core.
const mapping: [string, Kind, string][] = [
  ['B-form', 'section', 'Form'], ['B-table', 'section', 'Table'], ['B-header', 'section', 'Heading'],
  ['B-tabs', 'section', 'Tabs'], ['B-narrative', 'section', 'Narrative'], ['B-matrix', 'section', 'Approval flow'],
  ['B-files', 'section', 'Attachments'], ['B-iframe', 'section', 'Embedded frame'], ['B-static-oppd', 'section', 'OPPD table'],
  ['B-static-bg', 'section', 'BG document widget'], ['B-gallery', 'section', 'Image gallery'], ['B-section-gap', 'section', 'Section spacer'],
  ['B-display', 'field', 'Display'], ['B-list-field', 'field', 'Repeated textarea'], ['B-chips', 'field', 'Chips'],
  ['B-file-view', 'field', 'File viewer'], ['B-html', 'field', 'HTML'], ['B-banner', 'field', 'Notice'],
  ['B-documents', 'field', 'Generated documents'], ['B-field-label', 'field', 'Field heading'], ['B-field-gap', 'field', 'Field spacer'],
  ['B-header-cell', 'header', 'Column heading'], ['B-cells', 'cell', 'Column template'], ['B-modal-cell', 'cell', 'Modal column'],
  ['B-link-cell', 'cell', 'Link column'], ['B-workflow-cell', 'cell', 'Workflow file column'], ['B-footer', 'footer', 'Summary cell'],
  ['B-actions', 'action', 'Transaction'], ['B-app-link', 'action', 'Application link'], ['B-workflow-link', 'action', 'Workflow link'],
  ['B-action-gap', 'action', 'Action spacer'], ['B-tab', 'tab', 'Tab panel'], ['B-modal', 'modal', 'Modal'],
  ['B-alias', 'alias', 'Variable declaration'], ['B-file-group', 'group', 'File group'], ['B-callback', 'callback', 'Callback'],
]
const typeNames: Record<string, string> = {
  'V-field-text': 'Text', 'V-field-textarea': 'Multiline text', 'V-field-date': 'Date', 'V-field-currency': 'Currency',
  'V-cell-text': 'Text column', 'V-cell-date': 'Date column', 'V-cell-currency': 'Currency column', 'V-cell-status': 'Status column',
  'V-action-approve': 'Approve', 'V-action-reject': 'Reject', 'V-action-revise': 'Revise', 'V-action-custom': 'Custom action',
}
export const recipes: Recipe[] = mapping.flatMap(([id, kind, name]) => {
  const family = familyById[id]
  const variants = Object.entries(core.typeVariants).filter(([, v]) => v.family === id)
  return variants.length ? variants.map(([variant, v]) => ({ id: variant, family, kind, name: typeNames[variant], type: v.type, variant, policy: v.policy }))
    : [{ id, family, kind, name, policy: family.policy }]
})
recipes.push({ id: 'V-workflow-files', family: familyById['B-files'], kind: 'section', name: 'Workflow attachments', type: 'files_workflow', variant: 'V-workflow-files', policy: 'conditional' })
export const recipeById = Object.fromEntries(recipes.map(r => [r.id, r]))
export const kindLabels: Partial<Record<Kind, string>> = { section: 'Sections', field: 'Form fields', header: 'Table headings', cell: 'Column templates', footer: 'Table summaries', action: 'Actions', tab: 'Tab panels', modal: 'Modals', alias: 'Bindings', group: 'File groups', callback: 'Callbacks' }

export function materialize(recipe: Recipe | Family): Json {
  const family = 'family' in recipe ? recipe.family : recipe
  const concreteType = 'type' in recipe ? recipe.type : undefined
  const fill = (v: Json): Json => {
    if (typeof v === 'string' && /^<<[A-Z_]+>>$/.test(v)) {
      const key = v.slice(2, -2)
      if (key === 'NAME') return 'Untitled configuration'
      if (key === 'LABEL') return ''
      if (key === 'BOOL') return false
      if (key === 'HIDE') return 'false'
      if (['VARS', 'SECTIONS', 'FIELDS', 'HEADERS', 'CELLS', 'ACTIONS', 'TABS', 'GROUPS'].includes(key)) return []
      if (key === 'PAYLOAD') return {}
      if (['FIELD_TYPE', 'CELL_TYPE', 'ACTION_TYPE'].includes(key) && concreteType) return concreteType
      return v // Missing bindings/URLs/IDs are honest authoring drafts, not fake runtime inputs.
    }
    if (Array.isArray(v)) return v.map(fill)
    if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, value]) => [k, fill(value)]))
    return v
  }
  const value = fill(family.template)
  if (isObj(value) && concreteType) value.type = concreteType
  if (isObj(value) && concreteType === 'custom') value.label = ''
  return value
}
export function emptyConfig(): Obj { return materialize(familyById['B-root']) as Obj }

export function identifyFamily(kind: Kind, v: Json, modal = false): Family | undefined {
  if (!isObj(v)) return undefined
  const direct: Partial<Record<Kind, string>> = { root: 'B-root', label: 'B-label', sets: 'B-sets', alias: 'B-alias', header: 'B-header-cell', modal: 'B-modal', tab: 'B-tab', group: 'B-file-group', callback: 'B-callback' }
  if (direct[kind]) return familyById[direct[kind]!]
  // Retain a form/table authoring identity while its required value is being edited.
  // Diagnostics still reject a modal with neither truthy dispatch shape.
  if (kind === 'section' && modal) return v.fields ? familyById['B-form'] : v.$list ? familyById['B-table'] : v.type === 'form' ? familyById['B-form'] : v.type === 'table' ? familyById['B-table'] : undefined
  if (kind === 'footer') return ['text', 'text_date', 'text_currency', 'status'].includes(String(v.type)) ? familyById['B-footer'] : undefined
  return recipes.find(r => r.kind === kind && (r.type ?? (isObj(r.family.template) ? r.family.template.type : undefined)) === v.type &&
    (!r.family.id.startsWith('B-static-') || (isObj(r.family.template) && r.family.template.nodeId === v.nodeId)))?.family
}
export function variantFor(family: Family | undefined, value: Json): string | undefined {
  return family && isObj(value) ? Object.entries(core.typeVariants).find(([, v]) => v.family === family.id && v.type === value.type)?.[0]
    ?? (value.type === 'files_workflow' ? 'V-workflow-files' : undefined) : undefined
}
export function policyFor(family: Family | undefined, value: Json): string {
  const variant = variantFor(family, value)
  if (variant && variant in core.typeVariants) return core.typeVariants[variant as keyof typeof core.typeVariants].policy
  if (family?.id === 'B-footer' && isObj(value) && ['text_date', 'status'].includes(String(value.type))) return 'source-only'
  return family?.policy ?? 'diagnostic-only'
}
export function nodeName(kind: Kind, value: Json, family?: Family): string {
  if (kind === 'root') return isObj(value) && typeof value.configName === 'string' ? value.configName || 'Configuration' : 'Configuration'
  if (kind === 'row') return 'Layout row'
  if (!isObj(value)) return 'Raw value'
  const literal = [value.title, value.label, value.modalID].find(v => typeof v === 'string' && v && !v.includes('<<'))
  if (typeof literal === 'string') return literal
  if (kind === 'alias' && typeof value.$var === 'string') return value.$var.split(':')[0] || 'Variable declaration'
  const variant = variantFor(family, value)
  return variant ? typeNames[variant] : mapping.find(([id]) => id === family?.id)?.[2] ?? `Raw ${String(value.type ?? kind)}`
}

export interface Property {
  path: string[]; key: string; kind: 'string' | 'boolean' | 'number' | 'json' | 'option'; contract?: Placeholder
  help?: string; options?: string[]; policy?: string
}
type Extra = [string, Property['kind'], string, string[]?]
const extras: Record<string, Extra[]> = {
  'B-alias': [['errorOnNull', 'boolean', 'Checks expression text, not its evaluated result.'], ['errorOnEmpty', 'boolean', 'Checks expression text, not array emptiness.']],
  'B-form': [['formID', 'string', 'Logging only; generated field IDs are not editor identity.']],
  'B-list-field': [['label', 'string', 'Literal group label.'], ['direction', 'option', 'horizontal/wrap are source-only option shapes; no real usage witness.', ['vertical', 'horizontal', 'wrap']]],
  'B-banner': [['variant', 'option', 'info is observed; other variants are source-only option shapes.', ['info', 'success', 'warning', 'error']]],
  'B-documents': [['links', 'json', 'Literal Array<{filename:string,url:string}>; generation POST, not a direct viewer.']],
  'B-table': [['subtitle', 'string', 'Static subtitle; title wins the toolbar. Dynamic table titles/subtitles are ignored.']],
  'B-header-cell': [['tooltip', 'string', 'Static tooltip.'], ['$tooltip', 'string', 'Text injection.'], ['width', 'string', 'CSS width; browser sizing is unverified.'], ['className', 'string', 'Header CSS classes, not class.'], ['colspan', 'number', 'Literal positive integer.'], ['rowspan', 'number', 'Literal positive integer.'], ['order', 'option', 'Source-only option. Ordering is unsafe for positional modal identity.', ['string', 'number', 'date']]],
  'B-cells': [['colspan', 'number', 'Literal positive integer.'], ['rowspan', 'number', 'Literal positive integer.'], ['className', 'string', 'Cell class forwarding; no general hide.']],
  'B-footer': [['colspan', 'number', 'Literal positive integer.'], ['rowspan', 'number', 'Literal positive integer.']],
  'B-file-group': [['$file.type', 'string', 'Indexed file type; absent/falsy uses filename inference. fileType is ignored.']],
  'B-matrix': [['picLabelingOption', 'option', 'Either truthy enum selects the same desktop labeling branch; mobile ignores it.', ['position', 'role']]],
  'B-iframe': [['url', 'string', 'Static URL fallback; no iframe execution in the authoring canvas.']],
  'B-actions': [['postURL', 'string', 'Static primary endpoint fallback; separate from payload.URLEndpoint.'], ['$terms', 'json', 'SOURCE-ONLY: text + links[{label,link}]. Literal Read {0} loses its link slot; request exact runtime checks.']],
  'B-app-link': [['url', 'string', 'Static navigation URL fallback.']],
  'B-workflow-link': [['url', 'string', 'Static URL; raw btoa/encodeURI append needs explicit encoding/separator contract.'], ['label', 'string', 'Literal navigation label.']],
  'B-callback': [['postURL', 'string', 'Static callback URL; JSON transport; headers are ignored by caller.']],
  'B-sets': [['printPreviewURL', 'string', 'Static print URL; task/history/admin only, not editor preview.']],
}
export function properties(family: Family, value: Json, workflowFiles = false): Property[] {
  const result: Property[] = []
  const addSlot = (path: string, slot: string) => {
    if (['VARS', 'SECTIONS', 'FIELDS', 'HEADERS', 'CELLS', 'ACTIONS', 'TABS', 'GROUPS'].includes(slot)) return
    const contract = { ...core.placeholderDefaults, ...core.placeholders[slot as keyof typeof core.placeholders] } as Placeholder
    const key = path.replace(/^\$\./, '')
    const kind = slot === 'BOOL' ? 'boolean' : slot === 'PAYLOAD' ? 'json' : key === 'type' ? 'option' : 'string'
    const options = key === 'type' ? Object.values(core.typeVariants).filter(v => v.family === family.id).map(v => v.type) : undefined
    result.push({ path: key.split('.'), key, kind, contract, options })
  }
  Object.entries(family.slots).forEach(([p, s]) => addSlot(p, s))
  for (const [id, variant] of Object.entries(core.variants)) {
    if (!('allowedFamilies' in variant) || !(variant.allowedFamilies as readonly string[]).includes(family.id) || !('slots' in variant)) continue
    if ((id === 'V-format' || id === 'V-dynamic-format') && (!isObj(value) || !['text_date', 'text_currency'].includes(String(value.type)))) continue
    if (family.id === 'B-actions' && id === 'V-dynamic-label' && isObj(value) && ['reject', 'revise'].includes(String(value.type))) continue
    Object.entries(variant.slots).forEach(([p, s]) => {
      if (!result.some(prop => prop.key === p.replace(/^\$\./, ''))) addSlot(p, String(s))
    })
  }
  for (const [key, kind, help, options] of extras[family.id] ?? []) {
    const sourceOption = isObj(value) && ((family.id === 'B-banner' && key === 'variant' && value.variant !== undefined && value.variant !== 'info') || (family.id === 'B-list-field' && key === 'direction' && ['horizontal', 'wrap'].includes(String(value.direction))) || (family.id === 'B-header-cell' && ['order', 'colspan', 'rowspan'].includes(key)))
    result.push({ key, path: key.split('.'), kind, help, options, policy: key === '$terms' || sourceOption ? 'source-only' : undefined })
  }
  if (family.id === 'B-actions' && isObj(value)) {
    if (['approve', 'custom'].includes(String(value.type))) result.push({ key: 'label', path: ['label'], kind: 'string', help: 'UI label; payload.Action is a separate contract.' })
    if (value.type === 'approve') for (const key of ['modalTitle', 'modalMessage', 'successMessage', 'errorMessage']) {
      result.push({ key, path: [key], kind: 'string', help: 'Approve UI override; nullish and empty-string defaults differ.' }, { key: `$${key}`, path: [`$${key}`], kind: 'string', contract: { ...core.placeholderDefaults, ...core.placeholders.TEXT } })
    }
  }
  if (family.id === 'B-file-group' && workflowFiles) result.push({ key: '$hide', path: ['$hide'], kind: 'string', contract: { ...core.placeholderDefaults, ...core.placeholders.HIDE }, help: 'Workflow groups only: exact injected true skips metadata resolution. It does not hide the group/menu. Direct file groups do not consume visibility.' })
  return result
}

export function ignoredKeys(family: Family | undefined, value: Json, kind: Kind, workflowFiles = false): [string, string][] {
  if (!isObj(value) || !family) return []
  const ignored: Record<string, string> = {}
  const add = (keys: string[], reason = 'Not forwarded/consumed at this placement.') => keys.forEach(k => { ignored[k] = reason })
  if (kind === 'field') add(['fieldID', 'span', 'readOnly', 'prefix', 'suffix', 'className', 'validate'])
  if (family.id === 'B-form') add(['formId', 'readOnly', 'validate'])
  if (family.id === 'B-alias') add(['errorNullable'])
  if (family.id === 'B-table') add(['$title', '$subtitle', 'disablePagination', 'rowID', 'rowId'])
  if (family.id === 'B-header-cell') add(['class'])
  if (family.id === 'B-field-gap') add(['label', '$label', '$html', '$hide'])
  if (family.id === 'B-field-label') add(['$data', 'data', 'span'])
  if (family.id === 'B-narrative') add(['text'])
  if (family.id === 'B-file-view') add(['url'], 'Static URL fallback rereads $url; use a separately authored $url correction.')
  if (family.id === 'B-documents') add(['url'])
  if (family.id === 'B-callback') add(['$header'], 'Built lazily, but the task caller ignores callback headers.')
  if (family.id === 'B-actions' && ['reject', 'revise'].includes(String(value.type))) add(['label', '$label', 'modalTitle', '$modalTitle', 'modalMessage', '$modalMessage', 'successMessage', '$successMessage', 'errorMessage', '$errorMessage'], 'Reject/revise use fixed UI wording.')
  if (family.id === 'B-actions' && value.type === 'custom') add(['modalTitle', '$modalTitle', 'modalMessage', '$modalMessage', 'successMessage', '$successMessage', 'errorMessage', '$errorMessage'], 'Custom dialog wording comes from label; these overrides are not forwarded.')
  const hideAllowed = ((core.variants['V-visibility'].allowedFamilies as readonly string[]).includes(family.id) && family.id !== 'B-tabs') || (family.id === 'B-file-group' && workflowFiles)
  if (!hideAllowed) add(['$hide'], 'No visibility forwarding at this placement; built hide on files does not hide the menu/container.')
  if (['B-header', 'B-gallery', 'B-section-gap'].includes(family.id)) add(['className'])
  return Object.entries(ignored).filter(([k]) => Object.hasOwn(value, k))
}

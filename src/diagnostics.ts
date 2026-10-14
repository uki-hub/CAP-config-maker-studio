import { catalogue, ignoredKeys, isObj, properties, type Json, type Obj, type Path } from './catalogue'
import { getAt, indexConfig, pathText, type Node } from './model'

export interface Finding {
  id: string; path: Path; rule: string; family: string; stage: string; severity: 'error' | 'warning' | 'info'
  message: string; outcome: string; needed: string
}
export const familyHelp: Record<string, string> = {
  'B-root': 'Authoring preview only. Testing skips normal app/data/alias initialization, but typed whole-block payload evaluation can still run. Normal init requires full encoded response, app/auth/matrix/caller inputs. Runtime adapter: unavailable.',
  'B-alias': 'Ordered, case-sensitive, transitive declarations. Every alias executes, including unused/hidden ones. Built-ins can be overwritten. Removing/moving nodes never rewrites expressions.',
  'B-form': 'Section rows are vertical; inner siblings and field siblings are horizontal. Fields render disabled in CAP; formID only logs. Hidden forms still build their fields.',
  'B-display': 'Stored $data is a string; evaluated scalars become display text, then cleanup/formatting runs. A displayed value is not a typed payload. Currency units/scales are author inputs. GP scale100 is app-specific.',
  'B-table': '$list must evaluate to an array. Eval failure/null/undefined may fall back to []; non-null non-array values fail iteration. rows describes column templates, never live records. Iteration bindings are shared and retained.',
  'B-tab': 'Only exact injected "true" hides a tab. Hidden tabs skip nested build, but root aliases still execute. Filtering/rebuild can leave a retained activeIndex invalid; mounted runtime evidence is needed.',
  'B-tabs': 'Section-level hide is ignored; tab-level hide is supported. Nested sections use normal dispatch. The canvas does not simulate CAP tab mounting/state.',
  'B-modal': 'Modal open assigns raw wrapper.data to __MODAL. Truthy fields dispatches form; otherwise truthy $list dispatches table, ignoring stored type. Only these shapes are legal. Close retains modal data.',
  'B-modal-cell': 'Stored $data must yield a raw non-null record and modalID must exist. Safe recorded interaction scope: at most five rows, no ordering. Page-local and sorted positional identity can open the wrong row; no invented row-ID/pagination switch.',
  'B-footer': '$data is unindexed text, not an automatic aggregate. The first footer cell configuration/type/format governs all summary rendering. Use homogeneous/preformatted text with explicit units and aggregates.',
  'B-list-field': '$list yields Array<T>; $each data/label/hide replace the @i token. Empty/all-hidden hides the group. Shared iteration state still finishes and is retained. direction options beyond vertical are source-only.',
  'B-chips': '$list yields an array; $each injects __EACH. Empty lists retain prior __EACH. No hide forwarding; there is no implicit modal context in normal forms.',
  'B-files': 'Direct files use final URLs; files_workflow uses metadata GET returning response.data.data.url. Root/group hide does not hide the menu/container. Files do not assign __ROW_NUMBER. Integration effects are unverified.',
  'B-file-group': 'Indexed $file uses url, fileName, type; fileType is ignored. A string filename is required for extension inference. Workflow hide can skip resolution while its group remains visible.',
  'B-documents': 'FIELD ONLY. Uses Array<{filename,url}>, submissionNumber and a generation POST. Explicit $list has no standard list fallback. Empty $url suppresses URL fallback. Real generation is never run in this editor.',
  'B-static-oppd': 'Fixed OPPD_Table schema: raw root-like Data.Field_Data string, native items array, reference_doc, __PARAM__.sales_off/request_currency and fixed 18 columns. Numeric units and GP cost factor100 are app-specific; not a generic widget schema.',
  'B-static-bg': 'Fixed BG_DownloadGenDocFile reads __ROOT/__APP. Approval_Status must contain Approved, Role_Name must equal Download BG Approval, with Document_Number and app URLEndpoint. Fixed /api/v1/Form/GenerateDocumentBankGuarantee POST; integration evidence missing.',
  'B-actions': 'Endpoint/message text is eager; $payload is lazy and can read live sanitized @__NOTE. requiredNote is a literal boolean. Primary transport is multipart; payload.URLEndpoint is a separate app target. Reject/revise wording is fixed; custom wording comes from label.',
  'B-callback': 'Post-success payload uses JSON transport. Caller ignores headers and does not await callback promises; asynchronous failure cannot reverse primary success. Nothing is submitted here.',
  'B-workflow-link': 'SOURCE-ONLY. Invokes payload during render, JSON.stringify → btoa → encodeURI, directly appended without a separator. Non-Latin-1 values can fail; no universal Unicode/query-safe encoding.',
  'B-html': 'Text is injected then DOMParser body.textContent becomes iframe srcDoc. Raw and encoded HTML differ; this authoring canvas does not render imported markup or prove browser behavior.',
}

export const builtins = new Set(['__ROOT', '__DATA', '__TASK_DATA', '__APP', '__API', '__PROXY', '__USERNAME', '__EMAIL', '__TRANSACTION_ID', '__CURRENT_MATRIX_FLOW', '__CURRENT_USER_FLOW', '__NOTE', '__MODAL', '__ROW_NUMBER', '__EACH'])
// This recognizes only one whole block containing a simple alias/member/index path.
// It is deliberately not a JavaScript parser and never evaluates CAP expressions.
const simpleReference = (text: string) => text.match(/^\{\s*@([A-Za-z_$][\w$]*)(?:\??\.[A-Za-z_$][\w$]*|\[(?:\d+|@i)\])*\s*\}$/)
const capture = /{[^{}]*(?:{[^{}]*}[^{}]*)*}/g

export function diagnose(doc: Obj): Finding[] {
  const out: Finding[] = []
  const add = (path: Path, rule: string, family: string, stage: string, severity: Finding['severity'], message: string, outcome: string, needed = '') => {
    out.push({ id: `${rule}:${pathText(path)}:${out.length}`, path, rule, family, stage, severity, message, outcome, needed })
  }
  const error = (path: Path, rule: string, family: string, message: string, needed = '') => add(path, rule, family, 'build', 'error', message, 'Required authoring/structural contract is unsatisfied; structurally checked export is blocked.', needed)
  const shape = (path: Path, rank: 1 | 2, family: string, required = true) => {
    const v = getAt(doc, path)
    if (v === undefined && !required) return
    if (!Array.isArray(v)) { error(path, 'R-placement', family, `Expected an array${rank === 2 ? ' of row arrays' : ''}.`, `Supply rank-${rank} JSON arrays.`); return }
    if (rank === 2) v.forEach((row, i) => { if (!Array.isArray(row)) error([...path, i], 'R-placement', family, 'Expected an inner horizontal-sibling row array; this value is preserved raw.') })
  }
  const string = (n: Node, key: string, nonempty = false) => {
    const value = isObj(n.value) ? n.value[key] : undefined
    if (typeof value !== 'string' || (nonempty && !value.trim())) error([...n.path, key], 'R-required', n.family?.id ?? 'unsupported', `Supply ${nonempty ? 'a nonempty' : 'a'} string for ${key}.`, 'Exact author-provided binding, label, identifier or endpoint.')
  }
  const scan = (v: Json, path: Path) => {
    if (typeof v === 'string' && /<<[^<>]+>>/.test(v)) error(path, 'R-materialize', 'placeholder', 'Unresolved blueprint marker; this is still a draft.', 'Replace the whole JSON value with the required typed input.')
    if (Array.isArray(v)) v.forEach((child, i) => scan(child, [...path, i]))
    else if (isObj(v)) Object.entries(v).forEach(([key, child]) => scan(child, [...path, key]))
  }
  scan(doc, [])
  if (typeof doc.configName !== 'string') error(['configName'], 'R-response', 'B-root', 'configName must be a descriptive string.')
  if (!isObj(doc.label)) error(['label'], 'R-response', 'B-label', 'label must be an object.')
  else if (typeof doc.label.detailSectionTitle !== 'string') error(['label', 'detailSectionTitle'], 'R-response', 'B-label', 'detailSectionTitle must be a literal string.')
  if (!isObj(doc.form)) error(['form'], 'R-response', 'B-root', 'form must be an object.')
  shape(['var'], 1, 'B-vars')
  for (const key of ['headerSections', 'detailSections', 'bodySections']) shape(['form', key], 2, 'B-root')
  shape(['form', 'actions'], 1, 'B-actions', false)
  shape(['modals'], 1, 'B-modal', false)
  if (doc.sets !== undefined && !isObj(doc.sets)) error(['sets'], 'R-response', 'B-sets', 'sets must be an object.')

  const declared = new Set(builtins)
  const allAliases = new Set<string>()
  if (Array.isArray(doc.var)) for (const declaration of doc.var) {
    if (isObj(declaration) && typeof declaration.$var === 'string') allAliases.add(declaration.$var.split(':')[0].trim())
  }
  if (Array.isArray(doc.var)) doc.var.forEach((declaration, i) => {
    const path = ['var', i, '$var']
    if (!isObj(declaration) || typeof declaration.$var !== 'string') return
    const colon = declaration.$var.indexOf(':')
    const name = declaration.$var.slice(0, colon).trim()
    const expression = declaration.$var.slice(colon + 1)
    if (colon < 1 || !/^[A-Za-z_$][\w$]*$/.test(name)) { error(path, 'R-alias', 'B-alias', 'Expected an alias identifier, colon, and full CAP expression.'); return }
    const blocks = expression.match(capture)
    if (!blocks?.length && !expression.includes('<<')) add(path, 'R-capture', 'B-alias', 'init', 'error', 'No CAP block captured in this declaration.', 'Normal alias initialization fails.', 'Exact captured expression and typed upstream input.')
    const reference = blocks?.[0] ? simpleReference(blocks[0]) : null
    if (reference && !declared.has(reference[1])) {
      const parentAccess = blocks![0].includes('.') || blocks![0].includes('[')
      add(path, 'R-alias-case', 'B-alias', 'init', parentAccess ? 'error' : 'warning', `${allAliases.has(reference[1]) ? 'Forward' : 'Missing/case-mismatched'} reference @${reference[1]} in the first simple-path block.`, parentAccess ? 'Missing-parent dereference can fail init.' : 'Bare missing alias can bind undefined.', 'Declare the actual parent earlier, preserving exact case; complex JavaScript is outside this checker.')
    }
    if (declared.has(name)) add(path, 'R-alias', 'B-alias', 'init', 'warning', `Declaration overwrites ${name}.`, 'Case-sensitive shared dictionary value is replaced.', 'Confirm intentional declaration order/overwrite.')
    declared.add(name)
  })
  const index = indexConfig(doc)
  const modalIds = new Set<string>()
  const modalNodes = [...index.nodes.values()].filter(n => n.kind === 'modal')
  for (const n of modalNodes) {
    if (!isObj(n.value) || typeof n.value.modalID !== 'string' || !n.value.modalID.trim()) continue
    if (modalIds.has(n.value.modalID)) error([...n.path, 'modalID'], 'R-modal', 'B-modal', 'Duplicate modalID; lookup is ambiguous.')
    modalIds.add(n.value.modalID)
  }
  for (const n of index.nodes.values()) {
    if (n.kind === 'row') continue
    if (!n.family || !isObj(n.value)) { error(n.path, 'R-dispatch', 'unsupported', `Unsupported/raw ${n.kind} value or discriminator at this placement.`, 'Preserved original subtree; explicitly author a separate legal correction.'); continue }
    const f = n.family.id, v = n.value
    if (n.kind === 'section' && n.modal && !v.fields && !v.$list) error(n.path, 'R-placement', f, 'Modal dispatch requires truthy fields or $list. Stored form/table type alone is only a draft identity.')
    if (n.policy === 'source-only') add(n.path, 'G-usage', f, 'authoring', 'warning', 'Source-only mechanism; no real-usage witness.', 'Not an approved real-usage recipe.', 'Implementation/input check and targeted usage evidence for the affected feature.')
    if (n.policy === 'conditional') add(n.path, n.family.contracts[0] ?? 'G-domain', f, 'authoring', 'info', 'Conditional mechanism; structural checks alone do not satisfy runtime/domain contracts.', 'Normal-init, interaction or integration evidence remains separate.', n.family.requires ?? 'Full domain/caller/encoding input and relevant scoped runtime check.')
    for (const [key, reason] of ignoredKeys(n.family, v, n.kind, n.workflowFiles)) add([...n.path, key], 'R-property', f, 'build/render', 'warning', `Ignored/model-only option ${key}: ${reason}`, 'Preserved in JSON; not a working generation switch.', 'Inspector offers an explicit, separately labeled remove/correction action.')
    for (const p of properties(n.family, v, n.workflowFiles)) {
      const value = getAt(v, p.path)
      if (value === undefined || (typeof value === 'string' && value.includes('<<'))) continue
      if (p.policy === 'source-only' && p.key !== '$terms') add([...n.path, ...p.path], 'G-usage', f, 'authoring', 'warning', `${p.key} is a source-only option shape with no real-usage witness.`, 'The family badge does not upgrade this option to an observed mechanism.', 'Exact input/implementation check and targeted usage evidence for this option.')
      if (p.kind !== 'json' && typeof value !== (p.kind === 'option' ? 'string' : p.kind)) error([...n.path, ...p.path], 'R-literal-type', f, `${p.key} stores ${p.kind === 'option' ? 'an enum string' : `a literal ${p.kind}`}, not ${value === null ? 'null' : typeof value}.`)
      if (p.options && typeof value === 'string' && !p.options.includes(value)) add([...n.path, ...p.path], 'R-option', f, 'render', 'warning', `Unrecognized option ${JSON.stringify(value)}; preserved without normalization.`, 'Local default/fallback or unsupported behavior depends on the consumer.', 'Confirm the intended supported option or retain it for diagnosis.')
      if (p.kind === 'number' && (typeof value !== 'number' || !Number.isInteger(value) || value < 1)) error([...n.path, ...p.path], 'R-literal-type', f, `${p.key} must be a positive literal integer.`)
      if (typeof value === 'string') {
        const ref = simpleReference(value)
        if (ref && !declared.has(ref[1])) add([...n.path, ...p.path], 'R-alias-case', f, 'build', 'warning', `Unresolved simple-path reference @${ref[1]}.`, value.includes('.') ? 'Missing-parent text injection can blank the whole mixed string; raw evaluation differs.' : 'Bare missing value can become blank/undefined.', 'Original ordered declarations and actual typed input; no claim about complex JavaScript.')
      }
    }
    const required: Record<string, string[]> = {
      'B-display': ['$data'], 'B-list-field': ['$list'], 'B-chips': ['$list', '$each'], 'B-file-view': ['$data', '$url'],
      'B-html': ['$html'], 'B-banner': ['$message'], 'B-narrative': ['$text'], 'B-cells': ['$data'], 'B-footer': ['$data'],
      'B-modal-cell': ['$data', 'modalID'], 'B-link-cell': ['$data'], 'B-workflow-cell': ['$data', '$fileName', '$fileType'],
      'B-alias': ['$var'], 'B-file-group': ['$list'], 'B-table': ['$list'], 'B-gallery': ['$list'], 'B-static-oppd': ['$data'],
    }
    for (const key of required[f] ?? []) string(n, key, ['$list', 'modalID', '$var'].includes(key))
    if (f === 'B-form') shape([...n.path, 'fields'], 2, f)
    if (f === 'B-tabs') shape([...n.path, 'tabs'], 1, f)
    if (f === 'B-tab' || f === 'B-modal') shape([...n.path, 'sections'], 2, f)
    if (f === 'B-modal') { string(n, 'modalID', true); shape([...n.path, 'actions'], 1, f, false) }
    if (f === 'B-files') shape([...n.path, 'tabs'], 1, f)
    if (f === 'B-actions') {
      shape([...n.path, 'callbacks'], 1, f, false)
      if (v.type === 'custom' && !(typeof v.label === 'string' && v.label.trim()) && !(typeof v.$label === 'string' && v.$label.trim())) error([...n.path, 'label'], 'R-action', f, 'Custom action requires its own label.')
      if (v.$terms !== undefined) {
        if (!isObj(v.$terms) || typeof v.$terms.text !== 'string' || !Array.isArray(v.$terms.links)) error([...n.path, '$terms'], 'R-action', 'B-terms', 'Terms requires text:string and links:Array<{label,link}>.')
        else v.$terms.links.forEach((link, i) => { if (!isObj(link) || typeof link.label !== 'string' || typeof link.link !== 'string') error([...n.path, '$terms', 'links', i], 'R-action', 'B-terms', 'Terms link must have string label and link.') })
        add([...n.path, '$terms'], 'G-usage', 'B-terms', 'render', 'warning', 'Source-only terms: literal {0} is evaluated and loses its slot.', 'Requires a checked expression returning unrescanned slot text and matching links.', 'Exact expression/input and mounted agreement behavior.')
      }
    }
    if (['B-actions', 'B-callback'].includes(f)) {
      if (typeof v.$postURL !== 'string' && typeof v.postURL !== 'string') error([...n.path, '$postURL'], 'R-action', f, 'Supply an explicit primary/callback endpoint; no invented integration default.')
      if (!isObj(v.$payload)) error([...n.path, '$payload'], 'R-typed', f, '$payload must be an object with the actual endpoint schema.')
    }
    if (['B-app-link', 'B-workflow-link', 'B-iframe'].includes(f) && typeof v.$url !== 'string' && typeof v.url !== 'string') error([...n.path, '$url'], 'R-url', f, 'Supply the actual URL or expression.')
    if (v.$payload !== undefined) {
      const payload = (value: Json, path: Path, objectMember = false) => {
        if (objectMember && (value === 0 || value === false || value === '' || value === null)) add(path, 'R-typed', 'B-payload', 'build/transport', 'warning', 'Literal falsy object member is retained by the editor but omitted by CAP typed injection.', 'Evaluated "{0}"/"{false}" retain typed values; arrays keep literal elements. Multipart stringifies root values; callback JSON preserves types.', 'Actual payload/backend schema; correction must be intentional, not automatic.')
        if (Array.isArray(value)) value.forEach((child, i) => payload(child, [...path, i]))
        else if (isObj(value)) Object.entries(value).forEach(([key, child]) => payload(child, [...path, key], true))
      }
      payload(v.$payload, [...n.path, '$payload'])
      add([...n.path, '$payload'], 'R-transport', 'B-payload', 'transport', 'info', 'Typed build is not backend acceptance.', 'Primary multipart coerces nested objects/arrays to text; callback JSON preserves nesting. Typed evaluation can run even in testing.', 'Explicit endpoint, transport schema and isolated serializer/runtime input.')
    }
    if (f === 'B-table') {
      shape([...n.path, 'headers'], 1, f); shape([...n.path, 'rows'], 1, f); shape([...n.path, 'endRows'], 2, f, false)
      if (Array.isArray(v.headers) && Array.isArray(v.rows) && v.headers.length !== v.rows.length) error(n.path, 'R-table-alignment', f, `Heading/template mismatch: ${v.headers.length} headers, ${v.rows.length} column templates. No automatic alignment was guessed.`)
      if (Array.isArray(v.rows) && v.rows.some(cell => isObj(cell) && cell.type === 'modal')) {
        const ordered = Array.isArray(v.headers) && v.headers.some(h => isObj(h) && Boolean(h.order))
        add(n.path, 'R-table-identity', f, 'interaction', ordered ? 'error' : 'warning', ordered ? 'Ordering with modal columns has diagnostic-only positional identity behavior.' : 'Modal columns require at most five rows and no ordering.', 'Page 2 can display row 6 but open row 1; sorting disconnects positional customData.', 'Supply actual maximum row count and controlled click/page/sort evidence; no supported identity-safe switch is established.')
      }
      if (Array.isArray(v.endRows)) {
        const all = v.endRows.flat().filter(isObj)
        const first = all[0]
        if (first && all.some(cell => cell.type !== first.type || cell.format !== first.format || cell.$format !== first.$format)) add([...n.path, 'endRows'], 'R-footer', 'B-footer', 'render', 'warning', 'Mixed summary type/format uses the first footer cell configuration.', 'Each computed value is rendered with first-cell formatting; heterogeneous formatting is not independent.', 'Explicit homogeneous/preformatted text, aggregates and units.')
      }
    }
    if (f === 'B-modal-cell' && typeof v.modalID === 'string' && !v.modalID.includes('<<') && !modalIds.has(v.modalID)) error([...n.path, 'modalID'], 'R-modal', f, `Missing modal definition ${JSON.stringify(v.modalID)}; lookup would show a popup.`)
    if (f === 'B-list-field' && (!isObj(v.$each) || typeof v.$each.data !== 'string')) error([...n.path, '$each', 'data'], 'R-list', f, '$each.data must be a token-indexed string.')
    if (f === 'B-gallery' && (!isObj(v.$each) || typeof v.$each.source !== 'string')) error([...n.path, '$each', 'source'], 'R-list', f, '$each.source must be a token-indexed string.')
    if (f === 'B-file-group' && (!isObj(v.$file) || typeof v.$file.fileName !== 'string' || typeof v.$file.url !== 'string')) error([...n.path, '$file'], 'R-files', f, 'Supply indexed string fileName/url mappings with confirmed item schema.')
    if (f === 'B-file-group' && isObj(v.$file) && v.$file.fileType !== undefined) add([...n.path, '$file', 'fileType'], 'R-property', f, 'build', 'warning', 'fileType is ignored; the consumed mapping key is type.', 'Original spelling/data is preserved.', 'Use the raw subtree editor to author a separate correction after confirming intent.')
    if (f === 'B-documents') {
      if (v.$list !== undefined) string(n, '$list', true)
      else if (!Array.isArray(v.links)) error([...n.path, 'links'], 'R-list', f, 'Supply $list or literal links array.')
      if (v.links !== undefined) {
        if (!Array.isArray(v.links)) error([...n.path, 'links'], 'R-literal-type', f, 'links must be an array.')
        else v.links.forEach((link, i) => { if (!isObj(link) || typeof link.filename !== 'string' || typeof link.url !== 'string') error([...n.path, 'links', i], 'R-files', f, 'Document link requires filename:string and url:string.') })
      }
      string(n, 'submissionNumber', true)
      if (v.$url !== undefined) string(n, '$url')
    }
    if (n.kind === 'section' && n.modal && v.type !== (f === 'B-form' ? 'form' : 'table')) add([...n.path, 'type'], 'R-placement', f, 'build', 'info', 'Stored modal type is ignored; effective family comes from fields/$list shape.', `Effective ${f} dispatch.`, 'Confirm the intended shape; original discriminator is preserved.')
    if (f.startsWith('B-static-')) add(n.path, 'G-domain', f, 'init/effect', 'warning', familyHelp[f], 'Fixed schemas/role/route require actual inputs; effect acceptance is unverified.', 'Full encoded response, numeric units, auth/role/app context and integration evidence.')
  }
  add([], 'R-preview', 'B-root', 'verification', 'info', `Structural checks only · catalogue ${catalogue.schema}. Actual-runtime adapter unavailable.`, 'Authoring canvas is not CAP rendering. Normal init/runtime and browser/backend CAP behavior have not been executed.', 'For runtime checks, use the actual pinned frontend with synthetic fixtures/network traps. Complex bindings need exact expression/input checks.')
  return out
}

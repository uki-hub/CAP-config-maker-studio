import assert from 'node:assert/strict'
import { test } from 'node:test'
import supported from '../examples/synthetic-supported.json'
import preservation from '../examples/synthetic-preservation.json'
import { catalogue, ignoredKeys, isObj, properties, recipes, type Json, type Obj } from '../src/catalogue'
import { diagnose } from '../src/diagnostics'
import { adjacentTarget, dropReason, duplicate, emptyConfig, ensureArray, getAt, indexConfig, pairedColumn, parseDocument, pathText, place, remove, reorderColumn, serialize, setAt, targets, uiId, type Container } from '../src/model'

const container = (doc: Obj, path: string): Container => {
  const found = [...indexConfig(doc).containers.values()].find(c => pathText(c.path) === path)
  assert.ok(found, `Missing container ${path}`)
  return found
}
const node = (doc: Obj, path: string) => {
  const found = [...indexConfig(doc).nodes.values()].find(n => pathText(n.path) === path)
  assert.ok(found, `Missing node ${path}`)
  return found
}

test('empty root → real 2D section/field rows, stable paths/identity and no mutation', () => {
  const original = emptyConfig()
  const first = place(original, { recipeId: 'B-form' }, { containerId: container(original, '$.form.bodySections').id, index: 0, newRow: true })
  let doc = first.doc
  const formId = first.selectedId
  const fieldGrid = container(doc, '$.form.bodySections[0][0].fields')
  const text = place(doc, { recipeId: 'V-field-text' }, { containerId: fieldGrid.id, index: 0, newRow: true })
  doc = text.doc
  const firstRow = container(doc, '$.form.bodySections[0][0].fields').rows[0]
  const currency = place(doc, { recipeId: 'V-field-currency' }, { containerId: fieldGrid.id, rowId: firstRow.id, index: 1 })
  doc = currency.doc
  doc = setAt(doc, [...node(doc, '$.form.bodySections[0][0].fields[0][0]').path, '$data'], '{@realPath}')
  assert.equal(node(doc, '$.form.bodySections[0][0]').id, formId)
  assert.equal(node(doc, '$.form.bodySections[0][0].fields[0][0]').id, text.selectedId)
  doc = place(doc, { nodeId: text.selectedId }, adjacentTarget(doc, text.selectedId, 1)).doc
  assert.equal(node(doc, '$.form.bodySections[0][0].fields[0][1]').id, text.selectedId)
  assert.equal(node(doc, '$.form.bodySections[0][0].fields[0][0]').id, currency.selectedId)
  assert.deepEqual(getAt(original, ['form', 'bodySections']), [])
  assert.equal(getAt(doc, ['form', 'bodySections', 0, 0, 'fields', 0, 1, '$data']), '{@realPath}')
  assert.ok(Array.isArray(getAt(doc, ['form', 'bodySections', 0, 0, 'fields', 0])))
})

test('cross-container moves rebase destinations by identity and keep empty row targets', () => {
  let doc = emptyConfig()
  const bodyId = container(doc, '$.form.bodySections').id
  const form = place(doc, { recipeId: 'B-form' }, { containerId: bodyId, index: 0, newRow: true }); doc = form.doc
  const table = place(doc, { recipeId: 'B-table' }, { containerId: bodyId, rowId: container(doc, '$.form.bodySections').rows[0].id, index: 1 }); doc = table.doc
  const headerId = container(doc, '$.form.headerSections').id
  doc = place(doc, { nodeId: form.selectedId }, { containerId: headerId, index: 0, newRow: true }).doc
  assert.equal(node(doc, '$.form.headerSections[0][0]').id, form.selectedId)
  assert.equal(node(doc, '$.form.bodySections[0][0]').id, table.selectedId)
  doc = place(doc, { nodeId: table.selectedId }, { containerId: headerId, index: 1, newRow: true }).doc
  assert.deepEqual(getAt(doc, ['form', 'bodySections']), [[]])
  const targetRow = container(doc, '$.form.headerSections').rows[0]
  doc = place(doc, { nodeId: table.selectedId }, { containerId: headerId, rowId: targetRow.id, index: 1 }).doc
  assert.deepEqual(getAt(doc, ['form', 'headerSections', 1]), [])
  assert.equal(node(doc, '$.form.headerSections[0][1]').id, table.selectedId)
})

test('whole-row move/reorder preserves children, sibling grouping and selection identity', () => {
  let doc = parseDocument(JSON.stringify(supported))
  const body = container(doc, '$.form.bodySections')
  const table = node(doc, '$.form.bodySections[0][0]')
  const row = body.rows[0]
  doc = place(doc, { nodeId: row.id }, adjacentTarget(doc, row.id, 1)).doc
  assert.equal(node(doc, '$.form.bodySections[1][0]').id, table.id)
  assert.equal(node(doc, '$.form.bodySections[1]').id, row.id)
  const header = container(doc, '$.form.headerSections')
  doc = place(doc, { nodeId: row.id }, { containerId: header.id, index: header.rows.length, rowInsert: true }).doc
  assert.equal(node(doc, '$.form.headerSections[1][0]').id, table.id)
  assert.ok(Array.isArray(getAt(doc, ['form', 'bodySections', 0])))
})

test('illegal section documents/modal tabs, row contracts and descendant cycles are atomic', () => {
  let doc = parseDocument(JSON.stringify(supported))
  const before = serialize(doc)
  const body = container(doc, '$.form.bodySections')
  const modal = container(doc, '$.modals[0].sections')
  assert.match(dropReason(doc, { recipeId: 'B-documents' }, { containerId: body.id, index: 2, newRow: true })!, /field components/)
  assert.throws(() => place(doc, { recipeId: 'B-tabs' }, { containerId: modal.id, index: 1, newRow: true }), /Modal sections accept/)
  const tabSection = node(doc, '$.form.bodySections[1][0]')
  const descendant = container(doc, '$.form.bodySections[1][0].tabs[0].sections')
  assert.throws(() => place(doc, { nodeId: tabSection.id }, { containerId: descendant.id, index: 1, newRow: true }), /inside itself/)
  assert.throws(() => place(doc, { nodeId: body.rows[1].id }, { containerId: modal.id, index: 1, rowInsert: true }), /Modal sections accept/)
  assert.equal(serialize(doc), before)
  const fieldTarget = container(doc, '$.modals[0].sections[0][0].fields')
  doc = place(doc, { recipeId: 'B-documents' }, { containerId: fieldTarget.id, index: 1, newRow: true }).doc
  assert.equal(node(doc, '$.modals[0].sections[0][0].fields[1][0]').family?.id, 'B-documents')
})

test('modal dispatch follows fields then $list, without normalizing stored type', () => {
  let doc = emptyConfig()
  doc = setAt(doc, ['modals'], [{ modalID: 'shape', sections: [[{ type: 'tabs', fields: [] }, { type: 'wrong-but-preserved', $list: '{@lines}', headers: [], rows: [] }]], actions: [] }])
  assert.equal(node(doc, '$.modals[0].sections[0][0]').family?.id, 'B-form')
  assert.equal(node(doc, '$.modals[0].sections[0][1]').family?.id, 'B-table')
  assert.equal(getAt(doc, ['modals', 0, 'sections', 0, 0, 'type']), 'tabs')
  assert.ok(diagnose(doc).some(f => f.rule === 'R-placement' && f.severity === 'info'))
  doc = setAt(doc, ['modals', 0, 'sections', 0, 1, '$list'], '')
  assert.equal(node(doc, '$.modals[0].sections[0][1]').family, undefined)
  // A generated table retains its inspector while its binding is temporarily empty.
  doc = setAt(doc, ['modals', 0, 'sections', 0, 1, 'type'], 'table')
  assert.equal(node(doc, '$.modals[0].sections[0][1]').family?.id, 'B-table')
  assert.ok(diagnose(doc).some(f => f.rule === 'R-placement' && f.severity === 'error'))
})

test('duplication assigns fresh descendant IDs; removal never rewrites unrelated expressions', () => {
  let doc = parseDocument(JSON.stringify(supported))
  const form = node(doc, '$.form.detailSections[0][0]')
  const child = node(doc, '$.form.detailSections[0][0].fields[0][0]')
  const copy = duplicate(doc, form.id); doc = copy.doc
  assert.notEqual(copy.selectedId, form.id)
  assert.notEqual(node(doc, '$.form.detailSections[0][1].fields[0][0]').id, child.id)
  const expressions = getAt(doc, ['var'])
  doc = remove(doc, form.id)
  assert.equal(node(doc, '$.form.detailSections[0][0]').id, copy.selectedId)
  assert.deepEqual(getAt(doc, ['var']), expressions)
  assert.equal(getAt(doc, ['form', 'detailSections', 0, 0, 'fields', 0, 0, '$data']), '{@business.reference}')
})

test('paired columns move both arrays deliberately; mismatches are reported, not repaired', () => {
  let doc = parseDocument(JSON.stringify(supported))
  const table = node(doc, '$.form.bodySections[0][0]')
  const firstCell = node(doc, '$.form.bodySections[0][0].rows[0]')
  doc = reorderColumn(doc, table.id, 0, 1)
  assert.equal(getAt(doc, ['form', 'bodySections', 0, 0, 'headers', 1, 'title']), 'Item')
  assert.equal(node(doc, '$.form.bodySections[0][0].rows[1]').id, firstCell.id)
  doc = pairedColumn(doc, table.id).doc
  assert.equal((getAt(doc, ['form', 'bodySections', 0, 0, 'headers']) as Json[]).length, 4)
  doc = remove(doc, node(doc, '$.form.bodySections[0][0].headers[3]').id)
  assert.ok(diagnose(doc).some(f => f.rule === 'R-table-alignment' && pathText(f.path) === '$.form.bodySections[0][0]'))
  assert.throws(() => pairedColumn(doc, table.id), /mismatch/)
  assert.equal((getAt(doc, ['form', 'bodySections', 0, 0, 'rows']) as Json[]).length, 4)
})

test('round trips preserve supported and diagnostic shapes, alias order, falsy values and unknown keys', () => {
  for (const fixture of [supported, preservation]) {
    const doc = parseDocument(JSON.stringify(fixture))
    assert.deepEqual(parseDocument(serialize(doc)), fixture)
    assert.equal(serialize(doc).includes('ui-'), false)
  }
  let doc = parseDocument(JSON.stringify(preservation))
  const field = node(doc, '$.form.bodySections[0][0].fields[0][0]')
  doc = setAt(doc, [...field.path, 'label'], 'Intentionally changed label')
  doc = setAt(doc, ['unknownRoot', '__proto__', 'extra'], 0)
  assert.equal(getAt(doc, ['unknownRoot', '__proto__', 'extra']), 0)
  assert.equal(({} as Record<string, unknown>).extra, undefined)
  assert.equal(getAt(doc, ['form', 'actions', 0, '$payload', 'false']), false)
  assert.equal(getAt(doc, ['form', 'actions', 0, '$payload', 'zero']), 0)
  assert.equal(getAt(doc, ['form', 'actions', 0, '$payload', 'null']), null)
  assert.equal(getAt(doc, ['form', 'bodySections', 0, 0, 'fields', 0, 1, 'type']), 'date')
  assert.equal(getAt(doc, ['form', 'actions', 0, 'postURL']), 'https://api.example.invalid/exact-CASE')
  assert.deepEqual(getAt(doc, ['var']), preservation.var)
  assert.deepEqual(parseDocument(serialize(doc)), doc)
})

test('invalid import and illegal array setup keep the last valid document intact', () => {
  const doc = parseDocument(JSON.stringify(supported))
  const before = serialize(doc)
  for (const text of ['{invalid', '[]', 'null', 'false', '0', '{"nested":{"overflow":1e999}}']) assert.throws(() => parseDocument(text))
  const invalid = setAt(doc, ['modals'], { unknown: false })
  assert.throws(() => ensureArray(invalid, ['modals']), /explicitly correct/)
  assert.equal(serialize(doc), before)
  assert.equal(node(doc, '$.form.bodySections[0][0]').id, uiId((getAt(doc, ['form', 'bodySections', 0, 0]) as object)))
})

test('diagnostics report exact ranks/types/markers/references and maintain scoped policies', () => {
  let doc = emptyConfig()
  const form = place(doc, { recipeId: 'B-form' }, { containerId: container(doc, '$.form.bodySections').id, index: 0, newRow: true }); doc = form.doc
  doc = place(doc, { recipeId: 'V-field-text' }, { containerId: container(doc, '$.form.bodySections[0][0].fields').id, index: 0, newRow: true }).doc
  doc = setAt(doc, ['form', 'bodySections', 0, 0, 'fields', 0, 0, '$hide'], true)
  doc = setAt(doc, ['var'], [{ $var: 'derived:{@parent.value}' }, { $var: 'parent:{@__DATA}' }])
  let findings = diagnose(doc)
  assert.ok(findings.some(f => f.rule === 'R-materialize' && pathText(f.path) === '$.form.bodySections[0][0].fields[0][0].$data'))
  assert.ok(findings.some(f => f.rule === 'R-literal-type' && pathText(f.path).endsWith('.$hide')))
  assert.ok(findings.some(f => f.rule === 'R-alias-case' && f.stage === 'init' && pathText(f.path) === '$.var[0].$var'))
  doc = setAt(doc, ['form', 'headerSections'], [{ type: 'header', title: 'Flat invalid rank' }])
  findings = diagnose(doc)
  assert.ok(findings.some(f => f.rule === 'R-placement' && pathText(f.path) === '$.form.headerSections[0]'))
  const preservedFindings = diagnose(parseDocument(JSON.stringify(preservation)))
  for (const key of ['zero', 'false', 'null']) assert.ok(preservedFindings.some(f => f.rule === 'R-typed' && pathText(f.path) === `$.form.actions[0].$payload.${key}`))
  assert.ok(preservedFindings.some(f => f.rule === 'R-dispatch' && pathText(f.path) === '$.form.bodySections[0][1]'))
  assert.ok(preservedFindings.some(f => f.rule === 'R-property' && pathText(f.path).endsWith('.errorNullable')))
  const supportedFindings = diagnose(parseDocument(JSON.stringify(supported)))
  assert.equal(supportedFindings.filter(f => f.severity === 'error').length, 0)
  assert.ok(supportedFindings.some(f => f.rule === 'R-table-identity' && f.severity === 'warning'))
  assert.equal(catalogue.families.length, 43)
  assert.ok(recipes.some(r => r.id === 'V-cell-status' && r.policy === 'source-only'))
  assert.ok(recipes.every(r => !['diagnostic-only', 'ignored/unsupported'].includes(r.policy)))
})

test('complex expressions are not treated as parsed JS or executed, even when effectful', () => {
  const doc = setAt(emptyConfig(), ['var'], [{ $var: 'unexecuted:{globalThis.__CAP_TEST_SIDE_EFFECT__ = true; 1}' }, { $var: 'complex:{@unknown?.items.map(x => ({name:x}))}' }])
  const findings = diagnose(doc)
  assert.equal((globalThis as Record<string, unknown>).__CAP_TEST_SIDE_EFFECT__, undefined)
  assert.equal(findings.some(f => f.rule === 'R-alias-case'), false)
  assert.ok(findings.every(f => typeof f.outcome === 'string' && typeof f.needed === 'string'))
  assert.ok(isObj(parseDocument(serialize(doc))))
  assert.ok(targets(doc, { recipeId: 'B-form' }).length >= 3)
})

test('forwarding and source-only option policy follows placement and workflow context', () => {
  let doc = emptyConfig()
  const group = { title: 'Synthetic group', $list: '{@__DATA.files}', $file: { fileName: '{@__DATA.files[@i].filename}', url: '{@__DATA.files[@i].url}' }, $hide: 'true' }
  doc = setAt(doc, ['form', 'bodySections'], [[{ type: 'files', tabs: [structuredClone(group)] }, { type: 'files_workflow', tabs: [structuredClone(group)] }, { type: 'form', fields: [[{ type: 'info_banner', $message: 'Synthetic', variant: 'warning', dismissible: false }]] }]])
  const direct = node(doc, '$.form.bodySections[0][0].tabs[0]')
  const workflow = node(doc, '$.form.bodySections[0][1].tabs[0]')
  assert.ok(ignoredKeys(direct.family, direct.value, direct.kind, direct.workflowFiles).some(([key]) => key === '$hide'))
  assert.equal(ignoredKeys(workflow.family, workflow.value, workflow.kind, workflow.workflowFiles).some(([key]) => key === '$hide'), false)
  assert.equal(properties(direct.family!, direct.value, direct.workflowFiles).some(p => p.key === '$hide'), false)
  assert.ok(properties(workflow.family!, workflow.value, workflow.workflowFiles).some(p => p.key === '$hide' && p.help?.includes('skips metadata resolution')))
  assert.ok(diagnose(doc).some(f => f.rule === 'G-usage' && pathText(f.path) === '$.form.bodySections[0][2].fields[0][0].variant'))
  assert.equal(getAt(doc, ['form', 'bodySections', 0, 2, 'fields', 0, 0, 'dismissible']), false)
})

import { bindingExpression, endTarget, insertionContainers } from '../src/authoring'

test('binding expressions preserve exact names and indexes while rejecting CAP capture/rewrite hazards', () => {
  assert.equal(bindingExpression('__Data', ['detail', 'person_name']), '{@__Data.detail.person_name}')
  assert.equal(bindingExpression('__DATA', ['lines', 0, 'name'], 1), '{@__DATA.lines[@i].name}')
  assert.equal(bindingExpression('__DATA', ['a.b', 'a"b', '__proto__']), '{@__DATA["a.b"]["a\\"b"].__proto__}')
  assert.equal(bindingExpression('__DATA', []), '{@__DATA}')
  assert.throws(() => bindingExpression('@__DATA', ['name']))
  assert.throws(() => bindingExpression('__DATA', ['mail@example']))
  assert.throws(() => bindingExpression('__DATA', ['{key}']))
})

test('context scopes only allow root sections, form fields and selected action containers', () => {
  const doc = parseDocument(JSON.stringify(supported))
  const index = indexConfig(doc)
  const root = insertionContainers(index, index.root.id)
  assert.ok(root.length > 0 && root.every(c => c.kind === 'section'))
  const form = node(doc, '$.form.detailSections[0][0]')
  const fields = insertionContainers(index, form.id)
  assert.deepEqual(fields.map(c => c.kind), ['field'])
  assert.equal(dropReason(doc, { recipeId: 'V-field-text' }, endTarget(fields[0])), undefined)
  assert.ok(dropReason(doc, { recipeId: 'B-table' }, endTarget(fields[0])))
  const actions = container(doc, '$.form.actions')
  assert.deepEqual(insertionContainers(index, index.root.id, actions.id).map(c => c.kind), ['action'])
  const field = node(doc, '$.form.detailSections[0][0].fields[0][0]')
  assert.equal(insertionContainers(index, field.id)[0].id, fields[0].id)
  const modal = container(doc, '$.modals[0].sections')
  assert.ok(dropReason(doc, { recipeId: 'B-gallery' }, endTarget(modal)))
})

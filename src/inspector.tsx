import { AlertCircle, Check, FileCode2, Info, Plus, RotateCcw, Settings2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import { Textarea } from './components/ui/textarea'
import { familyById, ignoredKeys, isObj, materialize, properties, type Json, type Obj, type Property } from './catalogue'
import { familyHelp, type Finding } from './diagnostics'
import { getAt, parseJson, pathText, setAt, type Node } from './model'
import { BindingPicker } from './bindings'
import { PanelHeading, PolicyBadge, useEditor } from './workspace'

export function FindingCard({ finding, onSelect }: { finding: Finding; onSelect?: () => void }) {
  return <div className={`finding finding-${finding.severity}`}>
    <div className="flex items-start gap-2">{finding.severity === 'error' ? <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> : <Info className="mt-0.5 size-3.5 shrink-0" />}<div className="min-w-0 flex-1"><button type="button" className="text-left text-[11px] font-semibold" disabled={!onSelect} onClick={onSelect}>{finding.message}</button><code className="mt-1 block break-all text-[9px]">{pathText(finding.path)}</code><p className="mt-1 text-[9px] font-medium">{finding.rule} · {finding.family} · {finding.stage} · {finding.severity}</p><p className="mt-1 text-[10px] leading-relaxed">{finding.outcome}</p>{finding.needed && <p className="mt-1 text-[10px] leading-relaxed"><strong>Needed:</strong> {finding.needed}</p>}</div></div>
  </div>
}

function defaultValue(p: Property): Json {
  if (p.kind === 'boolean') return false
  if (p.kind === 'number') return 1
  if (p.kind === 'json') return p.key === 'links' ? [] : p.key === '$terms' ? { text: '<<TEXT>>', links: [] } : {}
  return p.options?.[0] ?? ''
}
function PropertyControl({ node, property: p }: { node: Node; property: Property }) {
  const { doc, change, drafts, draft } = useEditor()
  const absolute = [...node.path, ...p.path]
  const value = getAt(doc, absolute)
  const draftKey = `${node.id}:property:${p.key}`
  const id = `property-${node.id}-${p.key.replace(/\W/g, '-')}`
  const write = (v: Json) => change(setAt(doc, absolute, v), node.id)
  const rawDraft = drafts[draftKey]
  let error = ''
  const jsonText = rawDraft ?? JSON.stringify(value ?? defaultValue(p), null, 2)
  const parse = (): Json => {
    const parsed = parseJson(jsonText)
    if (p.key === 'links' && !Array.isArray(parsed)) throw new Error('links must be an array.')
    if (['$payload', '$terms'].includes(p.key) && !isObj(parsed)) throw new Error(`${p.key} must be an object; falsy members inside are preserved.`)
    return parsed
  }
  if (p.kind === 'json') { try { parse() } catch (e) { error = e instanceof Error ? e.message : 'Invalid JSON.' } }
  if (p.kind === 'number' && rawDraft !== undefined && (rawDraft.trim() === '' || !Number.isFinite(Number(rawDraft)))) error = 'Enter a finite literal number. The last canonical value is kept.'
  if (value === undefined) return <div className="optional-property"><Button variant="ghost" size="xs" className="h-auto justify-start whitespace-normal text-left" onClick={() => write(defaultValue(p))}><Plus className="size-3" />Add {p.key}{p.policy && <PolicyBadge policy={p.policy} />}</Button><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{p.help ?? p.contract?.input}</p></div>
  return <div className="property-field">
    <div className="mb-1.5 flex items-center justify-between gap-2"><label htmlFor={id} className="font-mono text-[11px] font-semibold">{p.key}</label><span className="text-[9px] text-muted-foreground">{p.contract?.stored ?? (p.kind === 'option' ? 'enum string' : p.kind)}</span></div>
    {p.kind === 'boolean' || p.kind === 'option' ? <NativeSelect id={id} value={String(value)} aria-label={`Property ${p.key}`} onChange={e => write(p.kind === 'boolean' ? e.target.value === 'true' : e.target.value)}>
      {p.kind === 'boolean' ? <><option value="false">false · literal boolean</option><option value="true">true · literal boolean</option>{typeof value !== 'boolean' && <option value={String(value)}>Preserved {JSON.stringify(value)} · wrong stored type</option>}</> : <>{p.options?.map(option => <option key={option} value={option}>{option}</option>)}{!p.options?.includes(String(value)) && <option value={String(value)}>Preserved {String(value)}</option>}</>}
    </NativeSelect> : p.kind === 'number' ? <Input id={id} aria-label={`Property ${p.key}`} type="number" value={rawDraft ?? String(value)} onChange={e => { const text = e.target.value; draft(draftKey, text); if (text.trim() && Number.isFinite(Number(text))) { write(Number(text)); draft(draftKey) } }} /> : p.kind === 'json' ? <>
      <Textarea id={id} aria-label={`Property ${p.key}`} spellCheck={false} className="min-h-32 font-mono text-[11px]" value={jsonText} onChange={e => draft(draftKey, e.target.value)} aria-invalid={Boolean(error)} />
      <div className="mt-2 flex gap-2"><Button variant="outline" size="xs" disabled={Boolean(error) || rawDraft === undefined} onClick={() => { write(parse()); draft(draftKey) }}><Check />Apply JSON value</Button><Button variant="ghost" size="xs" disabled={rawDraft === undefined} onClick={() => draft(draftKey)}><RotateCcw />Discard draft</Button></div>
    </> : <Textarea id={id} aria-label={`Property ${p.key}`} rows={p.key.startsWith('$') ? 2 : 1} spellCheck={false} className={p.key.startsWith('$') ? 'font-mono text-[11px]' : 'min-h-9'} value={typeof value === 'string' ? value : JSON.stringify(value)} onChange={e => write(e.target.value)} />}
    {p.kind === 'string' && p.key.startsWith('$') && p.key !== '$var' && <BindingPicker property={p.key} onApply={write} repeatable={node.kind === 'cell' && ['$data', '$fileName', '$fileType'].includes(p.key)} />}
    {error && <p role="alert" className="mt-1 text-[10px] text-destructive">{error}</p>}
    {p.policy && <div className="mt-1"><PolicyBadge policy={p.policy} /></div>}
    <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{p.help ?? p.contract?.input}</p>
    {p.contract && <details className="mt-1 text-[9px] text-muted-foreground"><summary className="cursor-pointer">{p.contract.id} · type / dependency contract</summary><div className="mt-1 space-y-1 leading-relaxed"><p><strong>Stored:</strong> {p.contract.stored ?? 'string'} · <strong>Evaluated:</strong> {p.contract.evaluated}</p><p><strong>Built:</strong> {p.contract.built ?? 'string'} · <strong>Timing:</strong> {p.contract.timing ?? 'build / modal open'}</p><p>{p.contract.edge}</p><p>{familyById['B-root'].id}: aliases need exact case, upstream types and declaration order. Render/transport types may differ; this editor does not evaluate them.</p></div></details>}
    {p.key !== 'type' && <Button variant="ghost" size="xs" className="mt-1 h-5 px-0 text-[9px] text-muted-foreground" onClick={() => { change(setAt(doc, absolute, undefined), node.id); draft(draftKey) }}>Remove property</Button>}
  </div>
}
function RawCorrection({ node }: { node: Node }) {
  const { doc, drafts, draft, change } = useEditor()
  const key = `${node.id}:subtree`
  const text = drafts[key] ?? JSON.stringify(node.value, null, 2)
  let error = ''
  try {
    const value = parseJson(text)
    if (node.kind === 'root' && !isObj(value)) error = 'Root must remain an object.'
    if (node.kind === 'row' && !Array.isArray(value)) error = 'A layout row must remain an array.'
  } catch (e) { error = e instanceof Error ? e.message : 'Invalid JSON.' }
  return <details className="raw-correction" open={!node.family || node.kind === 'row'}>
    <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold"><FileCode2 className="size-3.5" />Diagnostic subtree correction</summary>
    <p className="my-2 text-[10px] leading-relaxed text-muted-foreground">Raw/unknown data stays intact. This draft is separate from canonical JSON; apply an intentional correction explicitly. It is not an approved property recipe.</p>
    <Textarea aria-label="Subtree correction draft" className="min-h-40 font-mono text-[10px]" spellCheck={false} value={text} onChange={e => draft(key, e.target.value)} aria-invalid={Boolean(error)} />
    {error && <p role="alert" className="mt-1 text-[10px] text-destructive">{error} Last canonical subtree kept.</p>}
    <div className="mt-2 flex flex-wrap gap-2"><Button size="xs" variant="outline" disabled={Boolean(error) || drafts[key] === undefined} onClick={() => { change(setAt(doc, node.path, parseJson(text)), node.id); draft(key) }}>Apply subtree correction</Button><Button size="xs" variant="ghost" disabled={drafts[key] === undefined} onClick={() => draft(key)}>Discard draft</Button></div>
  </details>
}
export function Inspector({ findings }: { findings: Finding[] }) {
  const { index, selectedId, doc, change } = useEditor()
  const node = index.nodes.get(selectedId) ?? index.root
  const props = node.family && node.kind !== 'row' ? properties(node.family, node.value, node.workflowFiles) : []
  const present = props.filter(p => getAt(doc, [...node.path, ...p.path]) !== undefined)
  const optional = props.filter(p => getAt(doc, [...node.path, ...p.path]) === undefined)
  const ignored = ignoredKeys(node.family, node.value, node.kind, node.workflowFiles)
  const local = findings.filter(f => f.path.length >= node.path.length && node.path.every((key, i) => f.path[i] === key))
  const handled = new Set(['type', 'nodeId', ...props.map(p => p.path[0]), ...[...index.containers.values()].filter(c => c.ownerId === node.id).map(c => String(c.path[node.path.length])), ...ignored.map(([k]) => k)])
  const unknown = isObj(node.value) ? Object.keys(node.value).filter(key => !handled.has(key)) : []
  return <aside className="panel inspector-panel" aria-label="Property inspector">
    <PanelHeading title="Inspector" detail="Properties for the selected component." icon={<Settings2 className="size-4 text-primary" />} />
    <div className="panel-scroll p-4">
      <div className="mb-4"><h2 className="text-sm font-semibold">{node.name}</h2><code className="mt-1 block break-all text-[10px] text-primary" data-testid="selected-path">{pathText(node.path)}</code><div className="mt-2 flex flex-wrap gap-1.5"><PolicyBadge policy={node.policy} /><code className="text-[10px] text-muted-foreground">{node.family?.id ?? 'raw / unsupported'}{node.variant ? ` · ${node.variant}` : ''}</code></div></div>
      {node.family && <details className="contract-note"><summary className="cursor-pointer font-medium">Component guide & contracts</summary><p className="mt-2">{familyHelp[node.family.id] ?? node.family.requires ?? 'Use exact catalogue placement and typed inputs. Authoring checks do not certify runtime behavior.'}</p><p className="mt-2 font-mono text-[9px]">{node.family.contracts.join(' · ')}{node.family.variants.length > 0 && ` · ${node.family.variants.join(' · ')}`}</p><details className="mt-2"><summary className="cursor-pointer">Evidence / policy identity</summary><p className="mt-1">Usage: {node.family.usage}. Checked mechanism is separate from original usage status.</p><p className="mt-1 break-all font-mono text-[9px]">{node.family.evidence.join(', ') || 'No real-usage witness'}<br />{node.family.sources.join('; ')}<br />{node.family.checks.join(', ')}</p></details></details>}
      {present.map(p => <PropertyControl key={p.key} node={node} property={p} />)}
      {optional.length > 0 && <details className="mb-5"><summary className="cursor-pointer text-xs font-semibold">Available properties · {optional.length}</summary><div className="mt-2">{optional.map(p => <PropertyControl key={p.key} node={node} property={p} />)}</div></details>}
      {node.kind === 'root' && doc.sets === undefined && <Button variant="outline" size="xs" className="mb-4" onClick={() => change(setAt(doc, ['sets'], materialize(familyById['B-sets'])))}><Plus />Add print settings</Button>}
      {ignored.length > 0 && <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3"><h3 className="text-xs font-semibold text-amber-900">Imported ignored/model-only options</h3>{ignored.map(([key, reason]) => <div key={key} className="mt-3 text-[10px] text-amber-900"><code>{key}</code><p className="my-1 leading-relaxed">{reason} Preserved unchanged until you choose a correction.</p><Button size="xs" variant="outline" onClick={() => change(setAt(doc, [...node.path, key], undefined), node.id)}>Correction: remove {key}</Button>{node.family?.id === 'B-file-view' && key === 'url' && isObj(node.value) && typeof node.value.url === 'string' && <Button size="xs" variant="outline" className="mt-1" onClick={() => change(setAt(doc, [...node.path, '$url'], (node.value as Obj).url), node.id)}>Correction: copy url to $url</Button>}</div>)}</section>}
      {unknown.length > 0 && <div className="mb-4 rounded-md border p-2 text-[10px] text-muted-foreground"><strong>Preserved unclassified properties:</strong> {unknown.join(', ')}. No consumption claim; inspect the raw subtree for diagnosis.</div>}
      <RawCorrection node={node} />
      {local.length > 0 && <details className="mt-5"><summary className="mb-2 cursor-pointer text-xs font-semibold">Component checks · {local.length}</summary>{local.filter(f => f.severity !== 'info').map(f => <FindingCard key={f.id} finding={f} />)}</details>}
    </div>
  </aside>
}

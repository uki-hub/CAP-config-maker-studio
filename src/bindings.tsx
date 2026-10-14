import { useId, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Database, Folder, Link2, Search } from 'lucide-react'
import { type Json, type Path } from './catalogue'
import { bindingExpression, valueSummary } from './authoring'
import { parseJson, pathText } from './model'
import { builtins } from './diagnostics'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog'
import { PanelHeading, useEditor } from './workspace'

function DataBranch({ value, path, name, query, selected, onSelect }: { value: Json; path: Path; name: string; query: string; selected: string; onSelect: (path: Path) => void }) {
  const [expanded, setExpanded] = useState(path.length < 2)
  const branch = value !== null && typeof value === 'object'
  const entries = branch ? Object.entries(value) : []
  const key = pathText(path)
  // Search reveals matching descendants without losing their directory context.
  const matches = (v: Json, p: Path): boolean => pathText(p).toLowerCase().includes(query) || (v !== null && typeof v === 'object' && Object.entries(v).some(([k, child]) => matches(child, [...p, Array.isArray(v) ? Number(k) : k])))
  if (query && !matches(value, path)) return null
  return <div className="data-branch">
    <div className={`data-entry ${selected === key ? 'data-selected' : ''}`}>
      {branch && entries.length > 0 ? <button type="button" className="data-toggle" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${key}`} aria-expanded={expanded || Boolean(query)} onClick={() => setExpanded(!expanded)}>{expanded || query ? <ChevronDown /> : <ChevronRight />}</button> : <span className="data-toggle">{branch ? <Folder /> : <span className="data-dot" />}</span>}
      <button type="button" className="data-select" aria-label={`Select data path ${key}`} aria-pressed={selected === key} onClick={() => onSelect(path)}><span className="data-key">{name}</span><span className="data-type">{Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}</span><span className="data-value">{valueSummary(value)}</span></button>
    </div>
    {branch && (expanded || query) && <div className="data-children">{entries.map(([k, v]) => <DataBranch key={k} value={v} path={[...path, Array.isArray(value) ? Number(k) : k]} name={Array.isArray(value) ? `[${k}]` : k} query={query} selected={selected} onSelect={onSelect} />)}</div>}
  </div>
}

function PathBrowser({ selected, onSelect }: { selected: Path | null; onSelect: (path: Path) => void }) {
  const { payload, bindingAlias } = useEditor()
  const [query, setQuery] = useState('')
  return <div className="path-browser">
    <div className="relative"><Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" /><Input aria-label="Search data paths" placeholder="Find a key or path…" className="pl-9" value={query} onChange={e => setQuery(e.target.value)} /></div>
    <div className="data-tree" aria-label="JSON data directory">{payload !== undefined ? <DataBranch value={payload} path={[]} name={bindingAlias || 'Data'} query={query.toLowerCase().trim()} selected={selected ? pathText(selected) : ''} onSelect={onSelect} /> : <p className="p-5 text-xs text-muted-foreground">Add your sample JSON in the Data workspace to browse its keys.</p>}</div>
  </div>
}

function AliasControl() {
  const id = useId()
  const { bindingAlias, setBindingAlias, doc } = useEditor()
  const declared = Array.isArray(doc.var) && doc.var.some(v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.$var === 'string' && v.$var.split(':')[0].trim() === bindingAlias)
  return <div><label className="mb-1 block text-xs font-medium" htmlFor={id}>CAP data alias</label><Input id={id} value={bindingAlias} onChange={e => setBindingAlias(e.target.value)} placeholder="__DATA" className="font-mono" /><p className="mt-1 text-[11px] text-muted-foreground">Case-sensitive. __DATA is parsed Field_Data.{!builtins.has(bindingAlias) && !declared && <span className="block text-amber-800">Declare {bindingAlias || 'your alias'} in config variables before using it. Sample JSON does not create an alias.</span>}</p></div>
}

export function DataPanel() {
  const { payloadDraft, setPayloadDraft, payload, setPayload, bindingAlias, notice } = useEditor()
  const [selected, setSelected] = useState<Path | null>(null)
  let error = ''
  try { if (payloadDraft.trim()) parseJson(payloadDraft) } catch (e) { error = e instanceof Error ? e.message : 'Invalid JSON' }
  let expression = ''
  let pathError = ''
  try { if (selected) expression = bindingExpression(bindingAlias, selected) } catch (e) { pathError = (e as Error).message }
  return <main className="panel data-panel" aria-label="Data workspace">
    <PanelHeading title="Data & bindings" detail="Paste a sample payload. Browse its keys. Bind a component." icon={<Database className="size-4 text-primary" />} />
    <div className="panel-scroll data-workspace">
      <div className="data-editor"><h3 className="mb-2 text-sm font-semibold">Sample JSON payload</h3><p className="mb-3 text-xs text-muted-foreground">Use the parsed business data you want this alias to represent. Kept in this session, separately from exported configuration.</p><Textarea aria-label="Sample JSON payload" className="payload-editor" spellCheck={false} placeholder={'{\n  "detail": {\n    "person_name": "Alex"\n  }\n}'} value={payloadDraft} onChange={e => setPayloadDraft(e.target.value)} aria-invalid={Boolean(error)} />
        {error && <p role="alert" className="my-2 text-xs text-destructive">{error} The last applied payload is kept.</p>}
        <div className="my-3 flex flex-wrap gap-2"><Button size="sm" disabled={!payloadDraft.trim() || Boolean(error)} onClick={() => { setPayload(parseJson(payloadDraft)); setSelected(null); notice('Sample data applied. Select a component property and choose Bind data.') }}>Apply payload</Button><Button variant="outline" size="sm" disabled={!payloadDraft.trim() || Boolean(error)} onClick={() => setPayloadDraft(JSON.stringify(parseJson(payloadDraft), null, 2))}>Format</Button><label className="cursor-pointer rounded-md border px-3 py-2 text-xs font-medium">Load JSON file<input type="file" accept=".json,application/json" className="sr-only" aria-label="Load sample JSON file" onChange={e => { const file = e.target.files?.[0]; if (file) void file.text().then(setPayloadDraft).catch(() => notice('Could not read sample JSON file.', true)); e.target.value = '' }} /></label></div>
        <p className="mb-5 text-[11px] text-muted-foreground">{payload === undefined ? 'No payload applied yet.' : 'Directory shows the last applied payload.'} Editing this sample never executes CAP expressions.</p><AliasControl />
      </div>
      <div className="data-directory"><h3 className="mb-2 text-sm font-semibold">Path directory</h3><PathBrowser selected={selected} onSelect={setSelected} /><div className="binding-preview"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Expression</span><code>{expression || pathError || 'Select a key to build an expression'}</code><Button size="sm" variant="outline" disabled={!expression} onClick={() => void navigator.clipboard.writeText(expression).then(() => notice('Binding expression copied.')).catch(() => notice('Clipboard unavailable. Select the expression text to copy.', true))}><Copy />Copy expression</Button></div><p className="mt-3 text-xs text-muted-foreground">To bind directly: select a component, then choose <strong>Bind data</strong> beside an expression property in the Inspector.</p></div>
    </div>
  </main>
}

export function BindingPicker({ property, onApply, repeatable = false }: { property: string; onApply: (expression: string) => void; repeatable?: boolean }) {
  const { bindingAlias, payload, openData } = useEditor()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Path | null>(null)
  const [repeat, setRepeat] = useState(false)
  let expression = '', error = ''
  try { if (selected) expression = bindingExpression(bindingAlias, selected, repeat ? selected.findIndex(k => typeof k === 'number') : undefined) } catch (e) { error = (e as Error).message }
  return <><Button variant="outline" size="xs" className="mt-2" aria-label={`Bind data to ${property}`} onClick={() => { setSelected(null); setRepeat(false); setOpen(true) }}><Link2 />Bind data</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl"><DialogTitle>Bind {property} to data</DialogTitle><DialogDescription>Select a value or collection. Applying replaces this property's expression; the sample value is never copied into the config.</DialogDescription>{payload === undefined ? <Button onClick={() => { setOpen(false); openData() }}><Database />Add sample JSON in Data</Button> : <><AliasControl /><PathBrowser selected={selected} onSelect={setSelected} />{repeatable && selected?.some(k => typeof k === 'number') && <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />Use current row [@i] for the first array index. The table's $list must use that same array.</label>}<div className="binding-preview"><code>{error || expression || 'Select a path from the directory'}</code></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!expression || Boolean(error)} onClick={() => { onApply(expression); setOpen(false) }}>Apply binding</Button></div></>}</DialogContent></Dialog></>
}

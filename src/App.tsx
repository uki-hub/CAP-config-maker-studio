import { useEffect, useMemo, useRef, useState } from 'react'
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragOverEvent, type KeyboardCoordinateGetter } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { AlertCircle, ArrowDownToLine, Check, CircleHelp, Copy, FileJson2, FlaskConical, Import, Plus, Redo2, ShieldCheck, Undo2 } from 'lucide-react'
import demo from '../examples/synthetic-supported.json'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './components/ui/dialog'
import { NativeSelect } from './components/ui/native-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Textarea } from './components/ui/textarea'
import { catalogue, recipeById, type Json, type Obj, type Path } from './catalogue'
import { DataPanel } from './bindings'
import { insertionContainers } from './authoring'
import { diagnose, type Finding } from './diagnostics'
import { FindingCard, Inspector } from './inspector'
import { duplicate, emptyConfig, ensureArray, getAt, indexConfig, pairedColumn, parseDocument, pathText, place, remove, reorderColumn, serialize, setAt, targets, uiId, dropReason, type Source, type Target } from './model'
import { Canvas, EditorContext, PaletteOutline, PanelHeading, type Editor } from './workspace'
import { cn } from './lib/utils'

interface Provenance { name: string; text: string; importedAt: string }
interface Snapshot { doc: Obj; selectedId: string; contextId: string }
function saveFile(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function JsonPanel({ json, findings, provenance, selectedFinding, copy, download, onImport, draftCount, discardDrafts }: { json: string; findings: Finding[]; provenance: Provenance | null; selectedFinding: (path: Path) => void; copy: () => void; download: (checked: boolean) => void; onImport: () => void; draftCount: number; discardDrafts: () => void }) {
  const [severity, setSeverity] = useState('all')
  const errors = findings.filter(f => f.severity === 'error').length
  const warnings = findings.filter(f => f.severity === 'warning').length
  return <aside className="panel json-panel" aria-label="Live JSON and diagnostics">
    <PanelHeading title="Configuration" detail="Canonical JSON · updates immediately" icon={<FileJson2 className="size-4 text-primary" />} />
    <Tabs defaultValue="json" className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-3 mt-3"><TabsTrigger value="json">Live JSON</TabsTrigger><TabsTrigger value="diagnostics">Checks <Badge variant={errors ? 'destructive' : 'secondary'}>{errors || warnings}</Badge></TabsTrigger><TabsTrigger value="scope">Scope</TabsTrigger></TabsList>
      <TabsContent value="json" className="flex min-h-0 flex-col data-[state=inactive]:hidden">
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2"><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800"><span className="size-1.5 rounded-full bg-emerald-600" />Live</Badge><span className="mr-auto text-[10px] text-muted-foreground">JSON · {json.split('\n').length} lines</span><Button variant="ghost" size="icon-xs" aria-label="Copy current JSON" title="Copy current JSON" onClick={copy}><Copy /></Button><Button variant="ghost" size="icon-xs" aria-label="Import JSON" title="Import JSON" onClick={onImport}><Import /></Button></div>
        <div className="json-code-wrap"><pre data-testid="live-json" aria-label="Current config JSON" tabIndex={0}>{json}</pre></div>
        {provenance && <details className="mx-3 my-2 text-[10px] text-muted-foreground"><summary className="cursor-pointer">Original import · {provenance.name}</summary><p className="my-1">Retained verbatim · {provenance.importedAt}. Current JSON preserves data/types/order but formatting follows JSON.stringify.</p><pre className="max-h-40 overflow-auto rounded-md border p-2" data-testid="original-import">{provenance.text}</pre></details>}
      </TabsContent>
      <TabsContent value="diagnostics" className="panel-scroll p-3 data-[state=inactive]:hidden">
        <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[11px] font-medium">{errors} errors · {warnings} warnings</span><NativeSelect aria-label="Filter diagnostics" className="h-7 text-[10px]" value={severity} onChange={e => setSeverity(e.target.value)}><option value="all">All severities</option><option value="error">Errors</option><option value="warning">Warnings</option><option value="info">Information</option></NativeSelect></div>
        <p className="mb-3 rounded-md border p-2 text-[10px] text-muted-foreground">Local structure/contracts only. Binding/order/case checks cover first captured simple-path blocks, not general JavaScript. Runtime adapter unavailable.</p>
        {findings.filter(f => severity === 'all' || severity === f.severity).sort((a, b) => ['error', 'warning', 'info'].indexOf(a.severity) - ['error', 'warning', 'info'].indexOf(b.severity)).map(f => <FindingCard key={f.id} finding={f} onSelect={() => selectedFinding(f.path)} />)}
      </TabsContent>
      <TabsContent value="scope" className="panel-scroll p-4 data-[state=inactive]:hidden">
        <h3 className="text-sm font-semibold">Four separate verification scopes</h3>
        <div className="scope-item"><ShieldCheck className="size-4 text-primary" /><div><strong>Local structural validation</strong><p>JSON rank, placement, literal types, markers, modal IDs, table alignment and supported authoring contracts. Does not execute imported expressions.</p></div></div>
        <div className="scope-item"><Check className="size-4 text-primary" /><div><strong>Authoring preview</strong><p>Shows layout, grouping, stored values and policy labels. Canvas operations update the same exported document. It is not a CAP renderer.</p></div></div>
        <div className="scope-item"><FlaskConical className="size-4 text-amber-700" /><div><strong>Normal-init / actual runtime · unavailable</strong><p>Needs the actual frontend at revision {catalogue.revision}, complete synthetic response/encoding/auth/app/matrix/caller inputs and network traps. Testing skips aliases and text evaluation, but typed payload evaluation still runs. No eval occurs here.</p></div></div>
        <div className="scope-item"><CircleHelp className="size-4 text-amber-700" /><div><strong>CAP browser / backend · unverified</strong><p>Requires targeted domain/lookup/integration evidence: modal page/sort identity, mounted tabs, mobile matrix, HTML/CSS/files/frames/blob/generation, action/callback and multipart/JSON acceptance.</p></div></div>
        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">Source-only: gallery, section spacer, status cells, workflow links, terms and named option shapes. App-specific GP scale100 and fixed OPPD/BG schema/role/route are not universal defaults. Imported ignored/unknown properties remain intact.</p>
      </TabsContent>
    </Tabs>
    <div className="json-footer"><p className={cn('mb-2 flex items-center gap-1.5 text-[10px]', errors ? 'text-amber-800' : 'text-primary')}>{errors ? <AlertCircle className="size-3.5" /> : <ShieldCheck className="size-3.5" />}{errors ? `${errors} structural/authoring errors · draft` : 'No local structural errors · runtime unverified'}{draftCount > 0 && ` · ${draftCount} unapplied property drafts`}</p>{draftCount > 0 && <Button variant="ghost" size="xs" className="mb-2 text-[10px]" onClick={discardDrafts}>Discard all property drafts (including removed/imported nodes)</Button>}<div className="flex flex-wrap gap-2"><Button variant="outline" size="xs" onClick={() => download(false)}><ArrowDownToLine />Draft JSON</Button><Button size="xs" disabled={errors > 0 || draftCount > 0} onClick={() => download(true)}><ShieldCheck />Structurally checked export</Button></div><p className="mt-2 text-[9px] text-muted-foreground">Checked export is marker-free, not runtime/deployment certification.</p></div>
  </aside>
}

export default function App() {
  const [doc, setDoc] = useState<Obj>(emptyConfig)
  const [selectedId, setSelectedId] = useState(() => uiId(doc))
  const [contextId, setContextId] = useState('main')
  const [activeSource, setActiveSource] = useState<Source | null>(null)
  const [dragFeedback, setDragFeedback] = useState('')
  const [message, setMessage] = useState({ text: 'Ready · local authoring workspace', error: false })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [importOpen, setImportOpen] = useState(false)
  const [importDraft, setImportDraft] = useState('')
  const [importName, setImportName] = useState('Pasted JSON')
  const [importError, setImportError] = useState('')
  const [provenance, setProvenance] = useState<Provenance | null>(null)
  const [pendingSource, setPendingSource] = useState<Source | null>(null)
  const [destination, setDestination] = useState('')
  const [mobilePanel, setMobilePanel] = useState('canvas')
  const [newOpen, setNewOpen] = useState(false)
  const [workspaceView, setWorkspaceView] = useState('design')
  const [selectedContainerId, setSelectedContainerId] = useState('')
  const [payload, setPayload] = useState<Json | undefined>(undefined)
  const [payloadDraft, setPayloadDraft] = useState('')
  const [bindingAlias, setBindingAlias] = useState('__DATA')
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const index = useMemo(() => indexConfig(doc), [doc])
  const json = useMemo(() => serialize(doc), [doc])
  const findings = useMemo(() => diagnose(doc), [doc])
  const destinations = pendingSource ? targets(doc, pendingSource) : []
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    const source = args.context.active?.data.current?.source as Source | undefined
    if (!source) return
    // Reuse dnd-kit's scrolling/coordinate behavior with only contract-compatible targets.
    // ponytail: layout-sized scan; share a precomputed index if huge imported layouts become slow.
    const enabled = args.context.droppableContainers.getEnabled().filter(c => c.id === args.active || (c.data.current?.target && !dropReason(doc, source, c.data.current.target)))
    const map = new Map(enabled.map(c => [c.id, c]))
    const get = map.get.bind(map)
    const droppableContainers = Object.assign(map, {
      get: (id: string | number | null | undefined) => id == null ? undefined : get(id),
      getEnabled: () => enabled,
      toArray: () => enabled,
      getNodeFor: (id: string | number | null | undefined) => id == null ? undefined : get(id)?.node.current ?? undefined,
    })
    return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableContainers } })
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }))
  const notice = (text: string, error = false) => setMessage({ text, error })
  const attempt = (action: () => void) => { try { action() } catch (e) { notice(e instanceof Error ? e.message : 'Operation failed; config was kept.', true) } }
  const change = (next: Obj, selection = selectedId, focus = false) => {
    if (next !== doc) { setPast(items => [...items.slice(-99), { doc, selectedId, contextId }]); setFuture([]) }
    const nextIndex = indexConfig(next)
    const nextSelection = nextIndex.nodes.has(selection) ? selection : nextIndex.root.id
    setDoc(next); setSelectedId(nextSelection)
    if (nextSelection !== selectedId || !nextIndex.containers.has(selectedContainerId)) setSelectedContainerId('')
    if (contextId !== 'main' && !nextIndex.nodes.has(contextId)) setContextId('main')
    if (focus) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-node-id="${nextSelection}"] button[aria-pressed], [data-outline-id="${nextSelection}"]`)?.focus())
  }
  const travel = (direction: 'undo' | 'redo') => {
    const stack = direction === 'undo' ? past : future
    const snapshot = stack.at(-1)
    if (!snapshot) return
    const current = { doc, selectedId, contextId }
    if (direction === 'undo') { setPast(past.slice(0, -1)); setFuture([...future, current]) }
    else { setFuture(future.slice(0, -1)); setPast([...past, current]) }
    setDoc(snapshot.doc); setSelectedId(snapshot.selectedId); setContextId(snapshot.contextId); setSelectedContainerId('')
    notice(direction === 'undo' ? 'Change undone.' : 'Change restored.')
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') || activeSource) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); travel(event.shiftKey ? 'redo' : 'undo') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const select = (id: string) => {
    const n = index.nodes.get(id)
    if (!n) return
    setSelectedId(id)
    setSelectedContainerId('')
    if (n.path[0] === 'modals') {
      const modal = [...index.nodes.values()].find(item => item.kind === 'modal' && item.path[1] === n.path[1])
      if (modal) setContextId(modal.id)
    } else setContextId('main')
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-node-id="${id}"] > .node-toolbar button[aria-pressed]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
  }
  const move = (source: Source, target: Target) => attempt(() => {
    const result = place(doc, source, target)
    change(result.doc, result.selectedId, true)
    const moved = indexConfig(result.doc).nodes.get(result.selectedId)
    if (moved?.path[0] === 'modals') {
      const modal = [...indexConfig(result.doc).nodes.values()].find(n => n.kind === 'modal' && n.path[1] === moved.path[1])
      if (modal) setContextId(modal.id)
    } else setContextId('main')
    notice('Component placed · live JSON updated.')
  })
  const insert = (source: Source) => {
    const available = targets(doc, source)
    if (!available.length) { notice('No compatible container. Create the required parent first; unsupported placements cannot be generated.', true); return }
    const selected = index.nodes.get(selectedId)
    const scope = insertionContainers(index, selectedId, selectedContainerId)
    const chosen = available.find(item => !selectedContainerId && selected?.kind === 'root' && index.containers.get(item.target.containerId)?.title === 'Body' && item.target.newRow)
      ?? available.find(item => item.target.containerId === selectedContainerId && item.target.newRow)
      ?? available.find(item => item.target.containerId === selectedContainerId)
      ?? available.find(item => index.containers.get(item.target.containerId)?.ownerId === selectedId && item.target.newRow)
      ?? available.find(item => index.containers.get(item.target.containerId)?.ownerId === selectedId)
      ?? available.find(item => item.target.rowId === selected?.rowId && item.target.containerId === selected?.containerId)
      ?? available.find(item => scope.some(c => c.id === item.target.containerId && c.title === 'Body'))
      ?? available.find(item => pathText(index.containers.get(item.target.containerId)!.path) === '$.form.bodySections') ?? available[0]
    setPendingSource(source); setDestination(JSON.stringify(chosen.target))
  }
  const editor: Editor = {
    doc, index, selectedId, contextId, activeSource, select, setContext: setContextId, change, notice, insert, move, drafts,
    selectedContainerId, selectContainer: id => { const c = index.containers.get(id); if (c) { select(c.ownerId); setSelectedContainerId(id); setMobilePanel('palette') } },
    payload, setPayload, payloadDraft, setPayloadDraft, bindingAlias, setBindingAlias,
    openData: () => { setWorkspaceView('data'); setMobilePanel('data') },
    draft: (key, text) => setDrafts(old => { const copy = { ...old }; if (text === undefined) delete copy[key]; else copy[key] = text; return copy }),
    duplicate: id => attempt(() => { const result = duplicate(doc, id); change(result.doc, result.selectedId, true); notice('Duplicated with fresh editor identities · live JSON updated.') }),
    remove: id => attempt(() => { change(remove(doc, id), selectedId, true); notice('Removed · expression strings were preserved.') }),
    reorderColumn: (id, column, offset) => attempt(() => { change(reorderColumn(doc, id, column, offset), selectedId, true); notice('Moved both heading and template together.') }),
    addColumn: id => attempt(() => { const result = pairedColumn(doc, id); change(result.doc, result.selectedId, true); notice('Added a deliberate heading/template pair. Supply the column binding.') }),
    addRow: c => attempt(() => { const rows = getAt(doc, c.path); if (!Array.isArray(rows)) throw new Error('Container must be an array.'); change(setAt(doc, c.path, [...rows, []])); notice('Added an explicit empty row/drop target.') }),
    enable: path => attempt(() => { change(ensureArray(doc, path)); notice(`Enabled ${pathText(path)}.`) }),
    addModal: () => attempt(() => {
      const next = ensureArray(doc, ['modals'])
      const modalContainer = [...indexConfig(next).containers.values()].find(c => pathText(c.path) === '$.modals')!
      const result = place(next, { recipeId: 'B-modal' }, { containerId: modalContainer.id, index: modalContainer.items.length })
      change(result.doc, result.selectedId, true); setContextId(result.selectedId); notice('Modal draft added. Supply modalID and its form/table-shaped sections.')
    }),
  }
  const collision: CollisionDetection = args => {
    const source = args.active.data.current?.source as Source | undefined
    const row = source && 'nodeId' in source && index.nodes.get(source.nodeId)?.kind === 'row'
    const eligible = args.droppableContainers.filter(container => {
      const data = container.data.current
      return data?.target && Boolean(data.target.rowInsert) === Boolean(row) && (args.pointerCoordinates || !source || !dropReason(doc, source, data.target))
    })
    if (!args.pointerCoordinates) return closestCenter({ ...args, droppableContainers: eligible })
    return pointerWithin({ ...args, droppableContainers: eligible }).sort((a, b) => {
      const ad = eligible.find(c => c.id === a.id)?.data.current?.depth ?? 0
      const bd = eligible.find(c => c.id === b.id)?.data.current?.depth ?? 0
      return bd - ad
    })
  }
  const dragOver = ({ active, over }: DragOverEvent) => {
    const source = active.data.current?.source as Source | undefined
    const target = over?.data.current?.target as Target | undefined
    setDragFeedback(source && target ? dropReason(doc, source, target) ?? `Release to place · ${over?.data.current?.dropLabel ?? 'compatible target'}` : 'Choose a visible drop target · Escape cancels')
  }
  const endDrag = ({ active, over }: DragEndEvent) => {
    setActiveSource(null); setDragFeedback('')
    if (!over || active.id === over.id) { notice('Drag ended without a move · document kept.'); return }
    const source = active.data.current?.source as Source | undefined
    const original = over.data.current?.target as Target | undefined
    if (!source || !original) { notice('No compatible target · document kept.', true); return }
    const target = { ...original }
    if ('nodeId' in source) {
      const from = index.nodes.get(source.nodeId)
      const to = index.nodes.get(String(over.id))
      if (from && to && pathText(from.path.slice(0, -1)) === pathText(to.path.slice(0, -1)) && (from.index ?? 0) < (to.index ?? 0)) target.index++
    }
    move(source, target)
  }
  const copy = () => { void navigator.clipboard.writeText(json).then(() => notice('Current canonical JSON copied.')).catch(() => notice('Clipboard unavailable. Download JSON or select text in the live panel.', true)) }
  const download = (checked: boolean) => {
    if (checked && (findings.some(f => f.severity === 'error') || Object.keys(drafts).length)) { notice('Resolve structural errors and apply/discard property drafts before checked export.', true); return }
    saveFile(json, checked ? 'cap-config.structural.json' : 'cap-config.draft.json')
    notice(checked ? 'Structurally checked JSON downloaded · runtime/domain/backend verification remains separate.' : 'Draft JSON downloaded · may contain unresolved inputs or diagnostic shapes.')
  }
  const focusFinding = (path: Path) => {
    const nearest = [...index.nodes.values()].filter(n => n.path.length <= path.length && n.path.every((k, i) => k === path[i])).sort((a, b) => b.path.length - a.path.length)[0]
    if (nearest) select(nearest.id)
    setMobilePanel('inspector')
  }
  const activeName = activeSource ? 'recipeId' in activeSource ? recipeById[activeSource.recipeId]?.name : index.nodes.get(activeSource.nodeId)?.name : ''
  const pendingName = pendingSource ? 'recipeId' in pendingSource ? recipeById[pendingSource.recipeId]?.name : index.nodes.get(pendingSource.nodeId)?.name : ''
  return <EditorContext.Provider value={editor}>
    {/* ponytail: native wheel/trackpad scrolling during pointer drags; hover-panning moved nested targets away before release. Revisit only with measured stable-target scrolling. */}
    <DndContext sensors={sensors} autoScroll={false} collisionDetection={collision} onDragStart={e => { setActiveSource(e.active.data.current?.source as Source); setDragFeedback('Choose a visible drop target · Escape cancels') }} onDragOver={dragOver} onDragEnd={endDrag} onDragCancel={() => { setActiveSource(null); setDragFeedback(''); notice('Drag cancelled · document kept.') }} accessibility={{ screenReaderInstructions: { draggable: 'Press Space or Enter to pick up. Arrow keys move between compatible targets. Space or Enter drops. Escape cancels. Use the mouse wheel to scroll during pointer drags. Add, reorder and destination buttons also work without dragging.' }, announcements: { onDragStart: ({ active }) => `Picked up ${'recipeId' in (active.data.current?.source ?? {}) ? recipeById[active.data.current!.source.recipeId]?.name : index.nodes.get(String(active.id))?.name}.`, onDragOver: ({ over }) => over ? `Over ${over.data.current?.dropLabel ?? 'target'}.` : 'No drop target.', onDragEnd: () => 'Drag ended. Check workspace status for the placement result.', onDragCancel: () => 'Cancelled; document unchanged.' } }}>
      <div className="app-shell" data-dragging={Boolean(activeSource)}>
        <header className="app-header"><div className="flex min-w-0 items-center gap-3"><div className="brand-mark" aria-hidden="true">C<span>:</span></div><div><h1 className="text-base font-semibold tracking-tight">CAP Config Maker</h1><p className="text-[10px] text-muted-foreground">Studio <span className="ml-1 text-primary">/ local workspace</span></p></div></div><div className="header-document hidden min-w-0 sm:block"><p className="truncate text-xs font-medium">{typeof doc.configName === 'string' ? doc.configName || 'Untitled configuration' : 'Imported document'}</p><p className="text-[9px] text-muted-foreground">{findings.filter(f => f.severity === 'error').length ? 'Draft · needs authoring inputs' : 'Structural checks clear · runtime unverified'}</p></div><div className="flex flex-wrap items-center justify-end gap-1.5"><Button variant="ghost" size="sm" aria-label="New configuration" onClick={() => setNewOpen(true)}><Plus /><span className="hidden sm:inline">New</span></Button><Button variant="outline" size="sm" aria-label="Load synthetic demo" onClick={() => { setImportName('SYNTHETIC demo'); setImportDraft(JSON.stringify(demo, null, 2)); setImportError(''); setImportOpen(true) }}><FlaskConical /><span className="hidden sm:inline">Synthetic demo</span></Button><Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Import />Import</Button><Button size="sm" aria-label="Copy JSON" onClick={copy}><Copy /><span className="hidden sm:inline">Copy JSON</span></Button></div></header>
        <div className="workspace-toolbar"><div className="workspace-views" role="group" aria-label="Workspace view"><Button variant="ghost" size="sm" aria-pressed={workspaceView === 'design'} onClick={() => { setWorkspaceView('design'); setMobilePanel('canvas') }}>Design</Button><Button variant="ghost" size="sm" aria-pressed={workspaceView === 'json'} onClick={() => { setWorkspaceView('json'); setMobilePanel('json') }}>JSON / checks <Badge variant="secondary">{findings.filter(f => f.severity === 'error').length}</Badge></Button><Button variant="ghost" size="sm" aria-pressed={workspaceView === 'data'} onClick={() => { setWorkspaceView('data'); setMobilePanel('data') }}>Data</Button></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon-xs" aria-label="Undo change" title="Undo (Ctrl+Z)" disabled={!past.length || Boolean(activeSource)} onClick={() => travel('undo')}><Undo2 /></Button><Button variant="ghost" size="icon-xs" aria-label="Redo change" title="Redo (Ctrl+Shift+Z)" disabled={!future.length || Boolean(activeSource)} onClick={() => travel('redo')}><Redo2 /></Button><span className="ml-3 hidden sm:block text-[11px] text-muted-foreground">Local session · export to save</span></div></div>
        <Tabs className="mobile-nav" value={mobilePanel} onValueChange={value => { setMobilePanel(value); if (['canvas', 'json', 'data'].includes(value)) setWorkspaceView(value === 'canvas' ? 'design' : value) }}><TabsList><TabsTrigger value="palette">Blocks</TabsTrigger><TabsTrigger value="canvas">Canvas</TabsTrigger><TabsTrigger value="inspector">Inspector</TabsTrigger><TabsTrigger value="json">JSON / checks</TabsTrigger><TabsTrigger value="data">Data</TabsTrigger></TabsList></Tabs>
        <div className="workspace-grid" data-mobile-panel={mobilePanel} data-workspace-view={workspaceView}><PaletteOutline /><Canvas /><DataPanel /><Inspector findings={findings} /><JsonPanel json={json} findings={findings} provenance={provenance} selectedFinding={focusFinding} copy={copy} download={download} onImport={() => setImportOpen(true)} draftCount={Object.keys(drafts).length} discardDrafts={() => { setDrafts({}); notice('All property drafts explicitly discarded. Canonical document kept.') }} /></div>
        <footer className={cn('app-status', message.error && 'status-error')}><span role={message.error ? 'alert' : 'status'} className="min-w-0 flex-1 truncate">{dragFeedback || message.text}</span><span className="shrink-0 text-[9px] text-muted-foreground">{catalogue.schema} · runtime adapter unavailable</span></footer>
      </div>
      <DragOverlay dropAnimation={null}>{activeSource && <div className="drag-overlay"><GripIcon />{activeName}<span className="ml-2 text-[10px] font-normal">Drop to place · Esc cancels</span></div>}</DragOverlay>
    </DndContext>
    <Dialog open={Boolean(pendingSource)} onOpenChange={open => { if (!open) setPendingSource(null) }}><DialogContent><DialogTitle>{pendingSource && 'recipeId' in pendingSource ? 'Place component' : 'Move component'} · {pendingName}</DialogTitle><DialogDescription>Choose an exact compatible destination. Existing arrays keep their row/column grouping; expressions are never rewritten.</DialogDescription><label className="text-xs font-medium" htmlFor="destination">Compatible destination</label><NativeSelect id="destination" value={destination} onChange={e => setDestination(e.target.value)}>{destinations.map(item => <option key={JSON.stringify(item.target)} value={JSON.stringify(item.target)}>{item.label}</option>)}</NativeSelect><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPendingSource(null)}>Cancel</Button><Button onClick={() => { if (pendingSource) { move(pendingSource, JSON.parse(destination)); setPendingSource(null); setMobilePanel('canvas'); setWorkspaceView('design') } }}>{pendingSource && 'recipeId' in pendingSource ? 'Insert component' : 'Move component'}</Button></div></DialogContent></Dialog>
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent className="max-w-3xl"><DialogTitle>Import or edit JSON explicitly</DialogTitle><DialogDescription>Paste or load a JSON object, then Apply. Malformed input stays a separate draft and cannot replace the last valid document. Unknown/ignored properties and unsupported types are preserved.</DialogDescription><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>Choose JSON file</Button><Button variant="outline" size="sm" onClick={() => { setImportDraft(json); setImportName('Explicit current-JSON edit'); setImportError('') }}>Load current JSON into draft</Button><input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Choose import file" onChange={e => { const file = e.target.files?.[0]; if (file) void file.text().then(text => { setImportDraft(text); setImportName(file.name); setImportError('') }).catch(error => setImportError(String(error))); e.target.value = '' }} /></div><Textarea aria-label="Import JSON draft" spellCheck={false} className="h-80 font-mono text-xs" value={importDraft} onChange={e => { setImportDraft(e.target.value); setImportError('') }} aria-invalid={Boolean(importError)} />{importError && <p role="alert" className="text-xs text-destructive">{importError} Last valid document kept.</p>}<div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] text-muted-foreground">{importName} · source text retained on import</span><Button onClick={() => { try { const imported = parseDocument(importDraft); const root = indexConfig(imported).root; change(imported, root.id); setPast([]); setFuture([]); setProvenance({ name: importName, text: importDraft, importedAt: new Date().toISOString() }); setContextId('main'); setImportError(''); setImportOpen(false); setMobilePanel('canvas'); setWorkspaceView('design'); setSelectedContainerId(''); notice('JSON imported with original data/types preserved. Check diagnostics for unsupported shapes.') } catch (e) { setImportError(e instanceof Error ? e.message : 'Invalid JSON.') } }}>Apply JSON import</Button></div></DialogContent></Dialog>
    <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent><DialogTitle>Start a blank configuration?</DialogTitle><DialogDescription>Download the current draft first if you need it. This resets the local document, selection, provenance and property drafts.</DialogDescription><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button><Button onClick={() => { const blank = emptyConfig(); change(blank, uiId(blank)); setPast([]); setFuture([]); setContextId('main'); setDrafts({}); setProvenance(null); setSelectedContainerId(''); setWorkspaceView('design'); setMobilePanel('canvas'); setNewOpen(false); notice('Blank configuration ready.') }}>Start blank document</Button></div></DialogContent></Dialog>
    <Dialog><DialogTrigger asChild><button type="button" className="help-button" aria-label="Keyboard and authoring help"><CircleHelp className="size-4" /></button></DialogTrigger><DialogContent><DialogTitle>Keyboard & authoring flow</DialogTitle><DialogDescription>All placement operations have explicit keyboard-accessible controls.</DialogDescription><ol className="list-decimal space-y-3 pl-4 text-xs leading-relaxed"><li>Select an area in Design to see compatible components. Use + to choose a destination, or drag a handle directly to an outlined target. A form reveals fields; an actions area reveals actions.</li><li>Use arrow buttons to reorder siblings/rows, or Choose destination to move between containers. Row + creates an empty horizontal row.</li><li>On a drag handle, Space/Enter picks up; arrows navigate compatible targets; Space/Enter drops; Escape cancels. Pointer drags commit only on a completed valid drop. Scroll panels with the wheel/trackpad while dragging; hover-panning is disabled so targets stay under the pointer.</li><li>Select a component, edit literal/expression values, and watch live JSON. Object/array property drafts and raw corrections require Apply.</li><li>Use Modal to define a modal, supply a modalID and form/table sections. Tab panels have nested section grids. Table paired controls keep both column arrays aligned.</li><li>Draft downloads preserve everything. Structurally checked export blocks markers/errors/unapplied property drafts. Actual runtime checks need the pinned CAP frontend and real typed context.</li></ol></DialogContent></Dialog>
  </EditorContext.Provider>
}
function GripIcon() { return <span className="mr-2 text-primary" aria-hidden="true">⠿</span> }

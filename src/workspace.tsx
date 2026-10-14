import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Braces, Columns3, Copy, FileJson2, GripVertical, Layers, LayoutGrid, ListTree, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { cn } from './lib/utils'
import { isObj, kindLabels, recipes, type Json, type Obj, type Path, type Recipe } from './catalogue'
import { adjacentTarget, dropReason, getAt, pathText, type Container, type Index, type Node, type Source, type Target } from './model'
import { endTarget, insertionContainers } from './authoring'

export interface Editor {
  doc: Obj; index: Index; selectedId: string; contextId: string; activeSource: Source | null
  select: (id: string) => void; setContext: (id: string) => void
  insert: (source: Source) => void; move: (source: Source, target: Target) => void
  duplicate: (id: string) => void; remove: (id: string) => void; reorderColumn: (id: string, column: number, offset: number) => void
  addColumn: (id: string) => void; addRow: (c: Container) => void; enable: (path: Path) => void; addModal: () => void
  change: (doc: Obj, selectedId?: string, focus?: boolean) => void
  drafts: Record<string, string>; draft: (key: string, text?: string) => void
  notice: (message: string, error?: boolean) => void
  selectedContainerId: string; selectContainer: (id: string) => void
  payload: Json | undefined; setPayload: (value: Json) => void
  payloadDraft: string; setPayloadDraft: (value: string) => void
  bindingAlias: string; setBindingAlias: (value: string) => void; openData: () => void
}
export const EditorContext = createContext<Editor | null>(null)
export function useEditor(): Editor {
  const value = useContext(EditorContext)
  if (!value) throw new Error('Editor context is missing.')
  return value
}
export function PolicyBadge({ policy }: { policy: string }) {
  return <Badge variant="outline" className={cn('policy-badge', policy === 'approved' && 'border-emerald-200 bg-emerald-50 text-emerald-800', policy === 'conditional' && 'border-amber-200 bg-amber-50 text-amber-800', policy === 'source-only' && 'border-violet-200 bg-violet-50 text-violet-800', policy === 'diagnostic-only' && 'border-rose-200 bg-rose-50 text-rose-800')}>{policy}</Badge>
}
export function IconButton({ label, children, onClick, disabled = false }: { label: string; children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <Button variant="ghost" size="icon-xs" title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</Button>
}
export function PanelHeading({ title, detail, icon }: { title: string; detail?: string; icon?: ReactNode }) {
  return <div className="panel-heading"><div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>{detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}</div>
}

function PaletteItem({ recipe }: { recipe: Recipe }) {
  const { insert } = useEditor()
  const drag = useDraggable({ id: `recipe:${recipe.id}`, data: { source: { recipeId: recipe.id } } })
  return <div ref={drag.setNodeRef} className={cn('palette-item group', drag.isDragging && 'opacity-40')}>
    <button ref={drag.setActivatorNodeRef} type="button" className="drag-handle" {...drag.attributes} {...drag.listeners} aria-label={`Drag ${recipe.name}`}><GripVertical className="size-4" /></button>
    <div className="min-w-0 flex-1"><div className="text-xs font-medium">{recipe.name}</div>{recipe.policy !== 'approved' && <div className="mt-0.5 flex flex-wrap gap-1"><PolicyBadge policy={recipe.policy} /></div>}</div>
    <IconButton label={`Add ${recipe.name}`} onClick={() => insert({ recipeId: recipe.id })}><Plus /></IconButton>
  </div>
}
export function PaletteOutline() {
  const [query, setQuery] = useState('')
  const [showSource, setShowSource] = useState(true)
  const { doc, index, selectedId, select, selectedContainerId, selectContainer } = useEditor()
  const containers = insertionContainers(index, selectedId, selectedContainerId)
  const node = index.nodes.get(selectedId) ?? index.root
  const visible = recipes.filter(r => containers.some(c => !dropReason(doc, { recipeId: r.id }, endTarget(c))) && (showSource || r.policy !== 'source-only') && `${r.name} ${r.id} ${r.family.id} ${r.family.placement}`.toLowerCase().includes(query.toLowerCase()))
  return <aside className="panel palette-panel" aria-label="Palette and outline">
    <PanelHeading title="Components" detail="Only components that fit your selection." icon={<Layers className="size-4 text-primary" />} />
    <Tabs defaultValue="palette" className="flex min-h-0 flex-1 flex-col px-3 pt-3">
      <TabsList><TabsTrigger value="palette"><LayoutGrid className="size-3.5" />Palette</TabsTrigger><TabsTrigger value="outline"><ListTree className="size-3.5" />Outline</TabsTrigger></TabsList>
      <div className="relative mb-1"><Search className="pointer-events-none absolute top-3 left-2.5 size-3.5 text-muted-foreground" /><Input aria-label="Search components and outline" placeholder="Search components…" className="pl-8" value={query} onChange={e => setQuery(e.target.value)} /></div>
      <TabsContent value="palette" className="panel-scroll pb-4">
        <div className="palette-context"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Adding to</span><strong>{selectedContainerId ? containers[0]?.title : node.kind === 'root' ? 'Main layout' : node.name}</strong><Button size="xs" variant="ghost" onClick={() => select(index.root.id)}>Back to main layout</Button></div>
        {containers.length > 1 && node.kind !== 'root' && <NativeSelect aria-label="Component area" className="mb-3" value="" onChange={e => selectContainer(e.target.value)}><option value="">All areas in {node.name}</option>{containers.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</NativeSelect>}
        <label className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={showSource} onChange={e => setShowSource(e.target.checked)} />Include source-only options</label>
        {Object.entries(kindLabels).map(([kind, label]) => {
          const items = visible.filter(r => r.kind === kind)
          return items.length ? <section key={kind} className="mb-5"><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}<span className="float-right font-normal">{items.length}</span></h3>{items.map(r => <PaletteItem key={r.id} recipe={r} />)}</section> : null
        })}
        {!visible.length && <p className="p-4 text-xs text-muted-foreground">No matching components.</p>}
      </TabsContent>
      <TabsContent value="outline" className="panel-scroll pb-4">
        {[...index.nodes.values()].filter(n => `${n.name} ${n.family?.id ?? ''} ${pathText(n.path)}`.toLowerCase().includes(query.toLowerCase())).map(n => <button type="button" key={n.id} data-outline-id={n.id} className={cn('outline-item', n.id === selectedId && 'outline-selected')} style={{ paddingLeft: Math.min(n.path.length, 8) * 6 + 8 }} onClick={() => select(n.id)}>
          <span className="block truncate text-xs">{n.kind === 'row' ? '↳ ' : ''}{n.name}</span><code className="block truncate text-[9px] text-muted-foreground">{pathText(n.path)}</code>{n.kind !== 'row' && <span className="text-[9px] text-muted-foreground">{n.family?.id ?? 'raw / unsupported'} · {n.policy}</span>}
        </button>)}
      </TabsContent>
    </Tabs>
  </aside>
}

export function DropArea({ target, label, compact = false }: { target: Target; label: string; compact?: boolean }) {
  const { doc, index, activeSource, selectContainer } = useEditor()
  const c = index.containers.get(target.containerId)!
  const depth = c.path.length + (target.rowId ? 2 : 0) + 1
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${target.containerId}:${target.rowId ?? 'new'}:${target.index}:${target.rowInsert ? 'row' : 'node'}`, data: { target, depth, dropLabel: label } })
  const reason = activeSource ? dropReason(doc, activeSource, target) : undefined
  return <button type="button" onClick={() => selectContainer(c.id)} aria-label={`Add components to ${c.title}: ${label}`} ref={setNodeRef} data-drop-label={label} data-drop-path={pathText(c.path)} className={cn('drop-area', compact && 'drop-compact', activeSource && !reason && 'drop-compatible', activeSource && reason && !isOver && 'drop-incompatible', isOver && !reason && 'drop-accepted', isOver && reason && 'drop-rejected')}>
    <Plus className="size-3.5 shrink-0" /><span>{isOver && reason ? reason : label}</span>
  </button>
}
function PreviewValue({ node }: { node: Node }) {
  if (!isObj(node.value)) return <code className="preview-value text-rose-700">{JSON.stringify(node.value)}</code>
  const raw = node.value.$data ?? node.value.$text ?? node.value.$message ?? node.value.$var ?? node.value.$list ?? node.value.$url
  if (typeof raw === 'string') return <div className={cn('preview-value', raw.includes('<<') && 'text-amber-700')}><code>{raw || 'Empty literal'}</code><span className="ml-2 text-[9px] text-muted-foreground">{raw.includes('{') ? 'expression · unexecuted' : 'stored text'}</span></div>
  return null
}
function ReorderButtons({ node }: { node: Node }) {
  const { doc, move } = useEditor()
  const row = node.kind === 'row'
  const reorder = (offset: number) => move({ nodeId: node.id }, adjacentTarget(doc, node.id, offset))
  const can = (offset: number) => { try { adjacentTarget(doc, node.id, offset); return true } catch { return false } }
  return <>
    <IconButton label={`Move ${node.name} ${row ? 'up' : 'earlier'}`} disabled={!can(-1)} onClick={() => reorder(-1)}>{row ? <ArrowUp /> : <ArrowLeft />}</IconButton>
    <IconButton label={`Move ${node.name} ${row ? 'down' : 'later'}`} disabled={!can(1)} onClick={() => reorder(1)}>{row ? <ArrowDown /> : <ArrowRight />}</IconButton>
  </>
}
export function NodeCard({ node, collapsed = false }: { node: Node; collapsed?: boolean }) {
  const editor = useEditor()
  const { selectedId, select, duplicate, remove, insert, index } = editor
  const target: Target | undefined = node.containerId ? { containerId: node.containerId, rowId: node.rowId, index: node.index ?? 0 } : undefined
  const sortable = useSortable({ id: node.id, data: { source: { nodeId: node.id }, target, depth: node.path.length + 1, dropLabel: `Before ${node.name}` }, disabled: !node.containerId })
  const childContainers = [...index.containers.values()].filter(c => c.ownerId === node.id)
  const major = ['section', 'tab', 'modal'].includes(node.kind)
  const v = isObj(node.value) ? node.value : {}
  const table = node.family?.id === 'B-table'
  const reason = editor.activeSource && target ? dropReason(editor.doc, editor.activeSource, target) : undefined
  return <article ref={sortable.setNodeRef} data-node-id={node.id} data-node-path={pathText(node.path)} data-family={node.family?.id ?? 'raw'} className={cn('node-card', major && 'node-major', node.id === selectedId && 'node-selected', !node.family && 'node-raw', sortable.isDragging && 'opacity-30', sortable.isOver && editor.activeSource && !sortable.isDragging && (reason ? 'node-drop-rejected' : 'node-drop-before'))} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}>
    {sortable.isOver && editor.activeSource && !sortable.isDragging && <div className="node-drop-hint">{reason || `Place beside ${node.name}`}</div>}
    <div className="node-toolbar">
      {node.containerId && <button ref={sortable.setActivatorNodeRef} type="button" className="drag-handle" {...sortable.attributes} {...sortable.listeners} aria-label={`Drag ${node.name}`}><GripVertical className="size-3.5" /></button>}
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => select(node.id)} aria-label={`Select ${node.name}`} aria-pressed={selectedId === node.id}>
        {major && <span className="node-symbol"><LayoutGrid className="size-3.5" /></span>}<span className="truncate text-xs font-semibold">{node.name}</span>
      </button>
      {node.containerId && <div className="flex shrink-0"><ReorderButtons node={node} /><IconButton label={`Choose destination for ${node.name}`} onClick={() => insert({ nodeId: node.id })}><Columns3 /></IconButton><IconButton label={`Duplicate ${node.name}`} onClick={() => duplicate(node.id)}><Copy /></IconButton><IconButton label={`Remove ${node.name}`} onClick={() => remove(node.id)}><Trash2 /></IconButton></div>}
    </div>
    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2"><code className="text-[9px] text-muted-foreground">{node.variant ?? node.family?.id ?? 'raw preserved node'}</code><PolicyBadge policy={node.policy} /></div>
    <PreviewValue node={node} />
    {!node.family && <p className="px-3 pb-3 text-xs text-rose-700">Preserved raw data. Inspect to diagnose or explicitly apply a correction.</p>}
    {table && <div className="mx-3 mb-3 rounded-md border bg-muted/40 p-2">
      <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold">Column alignment · {Array.isArray(v.headers) ? v.headers.length : '?'} headings / {Array.isArray(v.rows) ? v.rows.length : '?'} templates</span><Button size="xs" variant="outline" onClick={() => editor.addColumn(node.id)}><Plus />Paired column</Button></div>
      {Array.isArray(v.headers) && Array.isArray(v.rows) && v.headers.length === v.rows.length && v.headers.length > 1 && <div className="mt-2 flex flex-wrap gap-2">{v.headers.map((_, i, headers) => <span key={i} className="flex items-center gap-0.5 text-[10px]">Pair {i + 1}<IconButton label={`Move column pair ${i + 1} left`} disabled={i === 0} onClick={() => editor.reorderColumn(node.id, i, -1)}><ArrowLeft /></IconButton><IconButton label={`Move column pair ${i + 1} right`} disabled={i === headers.length - 1} onClick={() => editor.reorderColumn(node.id, i, 1)}><ArrowRight /></IconButton></span>)}</div>}
      <p className="mt-1 text-[9px] text-muted-foreground">Pair controls move both arrays deliberately. Individual edits stay independent; counts are checked.</p>
    </div>}
    {!collapsed && childContainers.map(c => <ContainerView key={c.id} container={c} nested />)}
    {node.family?.id === 'B-actions' && v.callbacks === undefined && <Button className="m-3" variant="outline" size="xs" onClick={() => editor.enable([...node.path, 'callbacks'])}><Plus />Enable callbacks</Button>}
    {node.family?.id === 'B-table' && v.endRows === undefined && <Button className="m-3" variant="outline" size="xs" onClick={() => editor.enable([...node.path, 'endRows'])}><Plus />Enable summary rows</Button>}
  </article>
}
function RowCard({ row, container }: { row: Node; container: Container }) {
  const { select, selectedId, duplicate, remove, insert } = useEditor()
  const sortable = useSortable({ id: row.id, data: { source: { nodeId: row.id }, target: { containerId: container.id, index: row.index, rowInsert: true }, depth: row.path.length, dropLabel: `Before ${row.name}` } })
  const items = container.items.filter(n => n.rowId === row.id)
  return <div ref={sortable.setNodeRef} className={cn('layout-row', selectedId === row.id && 'border-primary', sortable.isDragging && 'opacity-30')} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} data-row-path={pathText(row.path)}>
    <div className="row-toolbar"><button ref={sortable.setActivatorNodeRef} type="button" className="drag-handle" {...sortable.attributes} {...sortable.listeners} aria-label={`Drag ${container.title} ${row.name}`}><GripVertical className="size-3" /></button><button type="button" className="mr-auto text-[10px] font-medium" onClick={() => select(row.id)}>{row.name}<span className="ml-2 font-normal text-muted-foreground">{items.length ? `${items.length} sibling${items.length === 1 ? '' : 's'}` : 'empty target'}</span></button><ReorderButtons node={row} /><IconButton label={`Choose destination for ${container.title} ${row.name}`} onClick={() => insert({ nodeId: row.id })}><Columns3 /></IconButton><IconButton label={`Duplicate ${container.title} ${row.name}`} onClick={() => duplicate(row.id)}><Copy /></IconButton><IconButton label={`Remove ${container.title} ${row.name}`} onClick={() => remove(row.id)}><Trash2 /></IconButton></div>
    <SortableContext items={items.map(n => n.id)} strategy={horizontalListSortingStrategy}>
      <div className="row-siblings">{items.map(n => <NodeCard key={n.id} node={n} />)}<DropArea target={{ containerId: container.id, rowId: row.id, index: items.length }} label={items.length ? 'Add sibling' : `Drop ${container.kind} here`} compact={items.length > 0} /></div>
    </SortableContext>
  </div>
}
export function ContainerView({ container: c, nested = false }: { container: Container; nested?: boolean }) {
  const { addRow, doc, activeSource, index, selectedId, select, selectedContainerId, selectContainer } = useEditor()
  const [tabId, setTabId] = useState('')
  const selectedPath = index.nodes.get(selectedId)?.path ?? []
  const selectedTab = c.kind === 'tab' ? c.items.find(n => n.path.length <= selectedPath.length && n.path.every((key, i) => selectedPath[i] === key))?.id : undefined
  useEffect(() => { if (selectedTab) setTabId(selectedTab) }, [selectedTab])
  const activeTab = selectedTab ?? (c.items.some(n => n.id === tabId) ? tabId : c.items[0]?.id)
  const movingRow = activeSource && 'nodeId' in activeSource && index.nodes.get(activeSource.nodeId)?.kind === 'row'
  const horizontal = ['header', 'cell', 'footer', 'action'].includes(c.kind)
  const actual = getAt(doc, c.path) as Json[]
  return <section className={cn('container-view', nested && 'container-nested', selectedContainerId === c.id && 'container-selected')} aria-label={`${c.title} container`}>
    <div className="container-label"><button type="button" className="container-select" aria-label={`Select ${c.title} area`} aria-pressed={selectedContainerId === c.id} onClick={() => selectContainer(c.id)}>{c.title}<span className="ml-2 font-normal opacity-60">{c.items.length}</span></button><code className="ml-auto truncate text-[9px] font-normal normal-case text-muted-foreground" title={pathText(c.path)}>{pathText(c.path)}</code>{c.layout === 'grid' && <IconButton label={`Add empty row to ${c.title}`} onClick={() => addRow(c)}><Plus /></IconButton>}</div>
    {c.kind === 'tab' && c.items.length > 0 && <div className="mb-2"><NativeSelect aria-label={`Tab authoring context ${pathText(c.path)}`} value={activeTab} onChange={e => { setTabId(e.target.value); select(e.target.value) }}>{c.items.map(n => <option key={n.id} value={n.id}>{n.name} · {pathText(n.path)}</option>)}</NativeSelect></div>}
    {c.layout === 'grid' ? <SortableContext items={c.rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
      <div className="space-y-2">{c.rows.map(row => <RowCard key={row.id} row={row} container={c} />)}{c.items.filter(n => !n.rowId).map(n => <NodeCard key={n.id} node={n} />)}<DropArea target={{ containerId: c.id, index: actual.length, newRow: !movingRow, rowInsert: Boolean(movingRow) }} label={movingRow ? `Move row · ${c.title}` : `New ${c.kind} row · ${c.title}`} /></div>
    </SortableContext> : <SortableContext items={c.items.map(n => n.id)} strategy={horizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}>
      <div className={cn(horizontal ? 'list-horizontal' : 'space-y-2')}>{c.items.map(n => <NodeCard key={n.id} node={n} collapsed={c.kind === 'tab' && n.id !== activeTab} />)}<DropArea target={{ containerId: c.id, index: c.items.length }} label={`Drop ${c.kind} · ${c.title}`} compact={horizontal && c.items.length > 0} /></div>
    </SortableContext>}
  </section>
}
export function Canvas() {
  const { index, selectedId, select, contextId, setContext, addModal, insert } = useEditor()
  const modals = [...index.nodes.values()].filter(n => n.kind === 'modal')
  const modal = index.nodes.get(contextId)
  const containers = [...index.containers.values()].filter(c => c.ownerId === (modal?.kind === 'modal' ? modal.id : index.root.id) && c.kind !== 'modal').sort((a, b) => Number(a.kind === 'alias') - Number(b.kind === 'alias'))
  const sectionCount = [...index.nodes.values()].filter(n => n.kind === 'section').length
  return <main className="panel canvas-panel" aria-label="Design canvas">
    <div className="panel-heading flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><LayoutGrid className="size-4 text-primary" />Design<Badge variant="secondary">{sectionCount} sections</Badge></h2><p className="mt-1 text-xs text-muted-foreground">Select an area to see what you can add. Drag to arrange.</p></div></div>
    <div className="canvas-context"><div className="min-w-0 flex-1"><NativeSelect aria-label="Authoring context" value={modal?.kind === 'modal' ? modal.id : 'main'} onChange={e => { setContext(e.target.value); select(e.target.value === 'main' ? index.root.id : e.target.value) }}><option value="main">Main document</option>{modals.map(n => <option key={n.id} value={n.id}>Modal · {n.name}</option>)}</NativeSelect></div><Button variant="outline" size="sm" onClick={addModal}><Plus />Modal</Button><Button variant="ghost" size="sm" onClick={() => select(modal?.kind === 'modal' ? modal.id : index.root.id)} aria-pressed={selectedId === index.root.id}><Braces />Properties</Button></div>
    <nav className="canvas-breadcrumb" aria-label="Selection breadcrumb"><button onClick={() => select(index.root.id)}>Configuration</button>{[...index.nodes.values()].filter(n => n.id !== index.root.id && n.kind !== 'row' && n.path.length <= (index.nodes.get(selectedId)?.path.length ?? 0) && n.path.every((key, i) => index.nodes.get(selectedId)?.path[i] === key)).map(n => <span key={n.id}> / <button aria-current={n.id === selectedId ? 'location' : undefined} onClick={() => select(n.id)}>{n.name}</button></span>)}</nav>
    <div className="panel-scroll canvas-scroll">
      {!sectionCount && !modal && <div className="empty-start"><span className="empty-symbol"><Layers className="size-6" /></span><h3 className="mt-3 font-semibold">Start with a building block</h3><p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Add a form for a field grid, or a table for repeating data. Bindings stay as visible drafts until you supply them.</p><div className="mt-4 flex gap-2"><Button size="sm" onClick={() => insert({ recipeId: 'B-form' })}><Plus />Add a form</Button><Button variant="outline" size="sm" onClick={() => insert({ recipeId: 'B-table' })}><Plus />Add a table</Button></div></div>}
      {modal?.kind === 'modal' && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3"><button type="button" className="text-sm font-semibold text-amber-900" onClick={() => select(modal.id)}>{modal.name}</button><p className="mt-1 text-xs text-amber-800">Modal context · form/table-shaped sections and separate modal actions.</p></div>}
      {containers.map(c => <ContainerView key={c.id} container={c} />)}
      {!containers.length && <p className="p-5 text-sm text-rose-700">No valid containers. Inspect the preserved root/subtree and explicitly correct its required arrays.</p>}
      <div className="canvas-scope"><FileJson2 className="mt-0.5 size-4 shrink-0" /><p>Structural authoring representation. Expressions are displayed, never executed. Actual CAP normal-init/runtime checks and browser/backend verification are separate.</p></div>
    </div>
  </main>
}

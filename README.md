# CAP Config Maker

A working local drag-and-drop CAP configuration maker: React + TypeScript, Vite, Tailwind CSS, shadcn/ui and dnd-kit. It runs without an AI provider, installed agent, authentication or backend.

**Location:** `creation/web-config-maker/app/`. **Results:** [`../result/README.md`](../result/README.md). **Handoff:** [`../result/handoff.md`](../result/handoff.md).

## Install and launch

Use Node **20.19+ or 22.12+** (verified with Node 22.13.1 / npm 10.9.2). Keep the app in this workspace so its shared catalogue import resolves.

From this app directory:

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite, normally **http://127.0.0.1:5173**.

From the workspace root, the equivalent launch is:

```powershell
npm --prefix "creation/web-config-maker/app" run dev
```

```powershell
npm run typecheck
npm run test
npm run build
npm run check
npm run preview
```

`check` runs the focused Node tests followed by typecheck/build. `preview` serves the production `dist/` build, normally on port 4173. The built `dist/` is self-contained; it does not retrieve the catalogue at runtime. For subdirectory hosting, configure Vite's `base` for the chosen deployment path.

Browser checks use the full Chromium browser (`channel: chromium`, not the separate headless-shell binary):

```powershell
npx playwright install chromium --no-shell
npm run test:browser
```

The browser script **builds first**, starts a local production preview on 4173, runs the checks and stops the server. It writes the JSON report and desktop/mobile/data screenshots under `app/test-results/`. In PowerShell, for a focused run use the native launcher so npm does not swallow forwarded flags:

```powershell
& "node_modules/.bin/playwright.cmd" test --grep "keyboard drag sensor"
```

## Authoring flow

1. Start with the blank root or choose **Synthetic demo**, then explicitly apply its JSON import. The demo is derived, synthetic authoring material, not a production/retrieved config.
2. Select a component or an area heading. The palette shows only compatible children: root sections, form fields, table parts, or actions. Use **Back to main layout** to return to section components. Search within that scope. Drag a handle to a visible target, or use **+ → compatible destination → Insert**. Add a form before fields; add a table before headings/column templates; add tabs before tab panels.
3. Header/detail/body sections and fields retain their actual **outer vertical rows / inner horizontal siblings**. Row + creates an explicit empty target. Node/row handles, arrow buttons, destination chooser, duplicate and remove controls use the same checked operations.
4. Select a component in the canvas or outline. The inspector shows its **current JSON path, B family, discriminator/shared V IDs, policy, contracts and evidence identity**. Scalar string/boolean/number edits update JSON immediately. Object/array edits keep a separate draft until **Apply JSON value**.
5. Tables use `headers[]` and `rows[]` as **column templates**, never business records. **Paired column** adds both entries deliberately; pair arrows move both. Independent edits stay independent and mismatched counts produce an error rather than guessed alignment. Summary cells use `endRows[][]`.
6. Choose a **tab authoring context** to edit its section grid. Use **Modal** to define/select a modal, supply its exact modalID and author form/table-shaped sections plus separate actions. Section `document_links` and modal `tabs` drops are rejected.
7. Author ordered variables in the **Ordered variables** container. Declare actual upstream parents first; preserve case. Actions expose endpoint/payload/note properties and an explicit callback container. Optional print settings and consumed family/type-specific deltas are in the inspector.
8. Switch to **JSON / checks**, then open **Checks** for exact-path severity/rule/family/stage/outcome/needed-input findings. Ignored imported options have explicitly labeled correction controls; unclassified/raw data remains available in the diagnostic subtree editor.
9. **Copy JSON** copies the canonical document. **Draft JSON** may contain missing markers/unsupported shapes. **Structurally checked export** is enabled only with no local errors and no unapplied property drafts. It is **not actual-runtime or deployment validation**; warnings/needed inputs stay in Checks.

Pointer drags commit only at a completed legal drop. Escape/no target/invalid placement preserves the document. Scroll panels with the wheel/trackpad during pointer drags; hover-panning is disabled because it displaced nested targets before release. Keyboard drag uses Space/Enter, arrows between compatible targets and Escape; explicit add/reorder/destination controls remain available. Focus returns after cancelling dialogs/drags. Below 1280px, Blocks/Canvas/Inspector/JSON/Data tabs make every panel reachable; horizontal sibling groups have local overflow.

## Data binding workspace

Open **Data**, paste parsed sample JSON (or load a file), and click **Apply payload**. The directory supports expanding objects/arrays, searching paths and copying expressions. Select a component in Design and use **Bind data** under an expression property to select and apply a path directly. Applying replaces that property's expression.

The default alias is `__DATA`. For `{@__Data.detail.person_name}`, set the alias to `__Data` and declare it in your configuration variables, for example `__Data:{@__DATA}` when that is the intended source. Names are case-sensitive. The editor does not create aliases or execute expressions automatically. Table data/file mappings can explicitly substitute the first sample array index with `[@i]`; that array must match the table's `$list`.

Sample JSON is session-only editor data and is excluded from config exports. Invalid sample drafts keep the last applied directory. Bracket notation handles unusual property names; keys containing `@` or braces are blocked by the picker because CAP rewrites/captures those characters.

## Workspace controls

Design, JSON/checks and Data share the center pane, with components on the left and the Inspector on the right. Contract details stay available in collapsed guides. Click an area heading or an empty drop target to focus its component list. Compatible drag targets highlight, incompatible targets dim, and hovered cards show placement feedback.

Use **Undo / Redo** or **Ctrl+Z / Ctrl+Shift+Z** to reverse canonical edits and completed moves (up to 100 edits). Text inputs retain native undo. Importing or starting a blank config starts a fresh history; sample JSON and unapplied drafts are separate from document history. Export before reloading to save your work.

## Canonical state, identity and catalogue flow

```text
shared core/blueprint.json
  → catalogue.ts: UI placement/name/property mapping + typed materialization
  → one immutable CAP JSON document in React state
  → model.ts: identity/path/container index and guarded tree operations
  → canvas / outline / inspector / diagnose()
  → JSON.stringify(document, null, 2) → live view / copy / downloads
```

- The technical authority remains [`blueprint.md`](../../../learning/phase-3-polished/result/core/blueprint.md) and [`blueprint.json`](../../../learning/phase-3-polished/result/core/blueprint.json), schema `cap-blueprint/1`, pinned reference revision `0eb7b50ec105b3d093d8f9bcff51397e6e520c5a`.
- The JSON catalogue is imported directly, not copied into a second language. UI names/placements and narrowly mapped controls are the thin adapter. Templates, placeholder type/help, family/type-variant IDs, optional-delta eligibility, contracts and policies come from the core. No corpus examples/evidence-map are bundled.
- `Obj`/`Json`/`Path` types permit preserved unsupported/unknown imported data. Structural sharing retains existing objects. A **WeakMap outside CAP JSON** assigns identities to objects/arrays; replacement ancestors inherit their identity. Moves retain identity; duplication clones subtrees with fresh identities. Runtime-generated fieldID is never editor identity.
- Selection, modal/tab context, drag source, import provenance and text/property drafts are UI-only. No editor-generated ID, evidence badge, wrapper, row-ID switch or metadata is added to export. Imported keys are not stripped just because their names resemble metadata.
- New templates materialize structural arrays, literal booleans and empty author labels. Missing expressions/URLs/IDs remain `<<…>>` **draft markers** with exact-path errors; no aliases, business paths or endpoints are fabricated to make checks pass.

## Preservation and validation boundaries

Import parses a JSON object but does not normalize unknown properties, discriminators, aliases, expressions, endpoints, order or nested grouping. Original import text/name/time remain available verbatim. Formatting is reserialized with two-space indentation; numbers use native JavaScript precision. Non-finite numeric overflow is rejected rather than silently exported as null. Literal false/zero/null/empty strings remain in canonical data even where CAP would later omit object members.

Invalid import, invalid property JSON and invalid raw-subtree text never replace canonical JSON. Import drafts survive closing/reopening the dialog. Property drafts are keyed outside the document, including drafts belonging to removed/reimported nodes; apply/discard them individually or use the explicitly labeled global discard control. Removing/moving nodes does **not** rewrite expressions or transitive declarations.

Local checks cover shape/rank, legal discriminator/placement, stored literal types, required strings/subtrees, markers, modal IDs/references, table count alignment, first-footer formatting policy, ignored forwarding, source-only options and literal-falsy payload/transport findings. **Alias/order/case analysis is limited to first captured simple member/index-path blocks.** It neither parses arbitrary CAP JavaScript nor executes imported expressions.

Contextual help carries exact injected `"true"`, text/raw/typed/transport differences, list fallback versus non-array failure, retained iteration state, modal <=5/no-order identity limits, footer first-cell formatting, testing versus normal init, GP scale100, fixed OPPD/BG schemas/roles/routes, and missing integration/browser evidence. Workflow group hide is offered only in its metadata-resolution context, never as a universal visibility switch.

**Actual-runtime adapter: unavailable.** The canvas is an authoring representation. Normal init and CAP browser/backend/effect acceptance require the actual pinned implementation plus exact response/encoding/auth/app/matrix/caller/units/endpoint inputs. No action, callback, file metadata or document-generation request is submitted here.

## Synthetic examples and checks

- [`examples/synthetic-supported.json`](examples/synthetic-supported.json): forms, table templates/summary, tabs and a legal modal; no structural errors. Modal max-row/no-sort behavior remains conditional.
- [`examples/synthetic-input.json`](examples/synthetic-input.json): labeled full response/auth/app/caller fixture, units and two-row bound. **Not executed by this editor**.
- [`examples/synthetic-preservation.json`](examples/synthetic-preservation.json): supported plus unsupported/ignored nodes, exact-case endpoint, unknown keys and false/zero/null/empty/array payload values. Deliberately diagnostic, not approved generation.
- [`tests/model.test.ts`](tests/model.test.ts): 12 focused operation/preservation/contract checks using Node's built-in test/assert APIs.
- [`tests/browser.spec.ts`](tests/browser.spec.ts): 9 mounted Chromium checks against the production build, including real pointer/keyboard interactions, live JSON, file/paste import, copy/download/reimport, malformed drafts and mobile access.

## Files and integration references

Domain logic: `src/catalogue.ts`, `model.ts`, `diagnostics.ts`. UI: `src/App.tsx`, `workspace.tsx`, `inspector.tsx`, `index.css`, `main.tsx`. shadcn primitives: `src/components/ui/{button,input,textarea,badge,native-select,tabs,dialog}.tsx`, utility `src/lib/utils.ts` and `components.json`. Build/dependency/test configuration: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `.gitignore`.

Consulted official [React/Vite](https://react.dev/learn/build-a-react-app-from-scratch), [Tailwind Vite](https://tailwindcss.com/docs/installation/using-vite), [shadcn Vite](https://ui.shadcn.com/docs/installation/vite), [dnd-kit legacy sortable](https://docs.dndkit.com/legacy/presets/sortable), [context](https://docs.dndkit.com/legacy/api-documentation/context-provider/dnd-context) and [keyboard sensor](https://docs.dndkit.com/legacy/api-documentation/sensors/keyboard) docs. The shadcn registry CLI had a DNS failure; primitives were adapted directly from the official `new-york-v4` GitHub sources, with [MIT notice](public/shadcn-ui-LICENSE.txt). Installed dnd-kit 6.3.1/10.0.0 declarations were checked for current collision, sensor and accessibility APIs.

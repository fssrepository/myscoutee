---
name: popup-module-extractor
description: Extract selected UI screens from monolith Angular files into dedicated popup modules/components using signals-first state. Use when the user requests screen-by-screen extraction from `app.ts`/`app.html`/`app.scss`, often with screenshot pairs (`original` vs `result`) and wants full trimming of monolith files plus post-extraction stabilization and visual parity checks.
---

# Popup Module Extractor

Use this skill for incremental popup extraction in monolith Angular apps where routes are limited and popup modules are the chosen architecture.
Use the same extraction/stabilization pattern as default for other module splits when requested.

## Extraction workflow

### 0. Enforce component isolation baseline

- Implement each extracted unit as explicit component files (`*.ts`, `*.html`, `*.scss`).
- Keep styles component-local and self-contained; avoid relying on monolith/global stylesheet rules.
- During extraction, migrate relevant style blocks from monolith SCSS into the component SCSS and delete stale global rules.

### 1. Define extraction scope

- Ask for the exact screens/popups to extract in the current slice.
- Require screenshot intent for each slice (`original`, then `result` after changes).
- Map each screen to concrete source regions in `app.ts`, `app.html`, and `app.scss`.
- Set explicit slice boundaries before edits.
- Cluster requested screens by similarity and mark candidates for shared components before coding.
- Treat screenshot variants as full requirements input and infer shared behaviors without requiring line-by-line reiteration.

### 2. Define hard acceptance gates

- Define target files/folders for extracted popup logic.
- Define exactly what must leave the monolith for this slice:
  - popup state
  - popup-specific handlers/business logic
  - popup template fragment
  - popup styles
- Define post-slice trimming expectations for `app.ts`, `app.html`, and `app.scss`.
- Do not accept wrapper-only moves as complete extraction.

### 3. Implement popup module extraction

- Create a focused popup feature folder per extracted screen.
- Use standalone Angular components (do not set `standalone: true` explicitly).
- Prefer event-editor style architecture:
  - signal-based service for popup open/close + payload
  - readonly signal exposure for consumers
  - command methods for transitions
- Use `signal()`, `computed()`, and `set()`/`update()` for local state.
- Avoid `any`; use typed popup payload/state models.
- For repeated screen patterns, extract shared reusable primitives first (for example a list state/pagination component), then connect popup-specific wrappers.
- Build a reusable list container contract when variants share list behavior:
  - filter bar -> typed query signal -> request trigger
  - server response -> typed variant mapping
  - polymorphic renderer (event card, single-image rate, pair-image rate, etc.)
  - shared item actions (menus, badges, selectable states)
  - shared loading and header progress state
  - pagination mode abstraction (infinite scroll and arrow navigation)
- Move template and styles into popup component files and remove moved parts from `app.html`/`app.scss`.
- Keep cross-popup shared primitives in `shared/` and keep popup feature logic local.

### 4. Wire integration without regrowth

- Wire popup launch points from monolith to extracted popup service/component.
- Keep the monolith as orchestrator only for remaining responsibilities.
- Remove dead imports, dead methods, and dead style blocks immediately after each move.
- Prevent duplicated state across monolith and popup service.

### 5. Stabilize after each slice

- Verify compile/runtime behavior before proceeding to the next screen.
- Preserve accessibility semantics and keyboard behavior in extracted popups.
- If extraction temporarily breaks behavior, continue to completion of the slice, then stabilize.
- Apply the same stabilization sequence when neighboring modules regress due to extraction.

### 6. Verify build behavior without duplicate watchers

- Detect active user-managed `npm start`/`ng serve` first.
- If running, do not start another build/watch process.
- Read and follow `.agent/logs/ng-serve.log` for rebuild results.
- If not running, run one explicit build verification command.

### 7. Run strict screenshot parity checks

- Compare each `original`/`result` screenshot pair even if the user does not list differences.
- Run macro and micro passes:
  - layout/spacing/alignment
  - typography/colors/iconography
  - clipping/overflow/truncation/states
- Verify each variant that motivated generalization (all similar screenshots), not only one representative screen.
- Separate verification for mobile and desktop screenshot sets; both must pass parity.
- Verify responsive column expectations from screenshots (single-column mobile, 3-4 columns desktop when shown).
- Report all differences, fix, and re-compare.
- Declare parity only when no additional differences remain.

### 8. Report slice completion

- List extracted screens completed in the slice.
- List monolith sections removed or trimmed.
- List remaining extraction backlog.
- List known risks and the next recommended slice.

## Non-negotiable rules

- Do not leave wrapper-only architecture as the final state.
- Do not keep duplicated logic in both monolith and popup files.
- Do not skip trimming of `app.ts`, `app.html`, or `app.scss` after moving a slice.
- Do not introduce regressions silently; call out any unresolved issue explicitly.
- Do not scope fixes only to the popup if extraction has broken related modules; stabilize all affected modules in the same slice.

## Completion checklist

- Validate that extracted popup uses signals-based state.
- Validate that monolith files are smaller for the completed slice.
- Validate build/watch status from the active build loop.
- Validate screenshot parity for provided pairs.

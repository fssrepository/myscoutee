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
- During extraction, migrate relevant style blocks from monolith SCSS into the component SCSS.
- Do not delete or replace already-validated SCSS blocks while extracting; keep them and apply incremental diffs unless the user explicitly approves scoped deletion.

### 0.5. Regression lock mode (mandatory after first user validation)

- If the user reports specific regressions on an already-tested screen, treat the current screen as locked baseline.
- Never delete existing validated style/template blocks in this mode.
- Do not replace entire `*.html` or `*.scss` files during regression fixing.
- Do not do broad visual rewrites while fixing targeted issues.
- Edit only selectors, handlers, and template nodes directly tied to reported mismatches.
- Keep existing working routes/flows/menu wiring intact while patching visual issues.
- Preserve existing working menu order, icon set, popup openers, and action routing unless the user explicitly asks to change them.
- If a planned fix requires large-scope edits (for example: full stylesheet replacement or major template rewrite), stop and request explicit user approval first.
- When unsure, prefer a narrow patch over a structural refactor.
- NEVER DELETE OR WHOLESALE-REWRITE VALIDATED SCSS/HTML BLOCKS WITHOUT EXPLICIT USER APPROVAL.

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
- Preserve behavior parity from the source screen during extraction:
  - keep existing action menus and control affordances
  - keep existing interaction states (enabled/disabled behavior)
  - keep existing motion/slide behavior where present
- Do not ship simplified rewrites when the original screen behavior is known and required.
- Preserve original interaction routes, not just visual shape:
  - creation actions must still open their form popups when baseline does
  - stage/group menu actions must remain functional and routed to real forms/flows
  - avoid direct data insertion shortcuts that bypass baseline UX
- FOR INCREMENTAL EXTRACTIONS, KEEP EXISTING POPUP BUSINESS LOGIC AS SOURCE OF TRUTH AND REWIRE THROUGH SHARED SERVICE/EVENT CONTRACTS.
- DO NOT RE-IMPLEMENT FULL POPUP LOGIC BY COPYING FROM MONOLITH `APP.TS` WHEN THE TASK IS LIST-PANEL MOVE/REWIRE.
- IF A POPUP IS OUT OF EXTRACTION SCOPE, KEEP IT IN PLACE AND TRIGGER IT VIA EXISTING SHARED FLOW.
- Keep extracted popup dimensions close to baseline unless explicitly requested otherwise.
- Preserve baseline typography and visual rhythm during extraction:
  - keep font family, size, weight, line height, and casing consistent with source screen
  - keep popup width/height and inner spacing/grid proportions consistent with source screenshot
  - treat obvious typography or width drift as a regression, not a cosmetic difference

### 4. Wire integration without regrowth

- Wire popup launch points from monolith to extracted popup service/component.
- Keep the monolith as orchestrator only for remaining responsibilities.
- Remove dead imports, dead methods, and dead style blocks immediately after each move.
- Prevent duplicated state across monolith and popup service.
- Extraction is incomplete if legacy popup template or opener code remains active in monolith files.

### 5. Stabilize after each slice

- Verify compile/runtime behavior before proceeding to the next screen.
- Preserve accessibility semantics and keyboard behavior in extracted popups.
- If extraction temporarily breaks behavior, continue to completion of the slice, then stabilize.
- Apply the same stabilization sequence when neighboring modules regress due to extraction.
- For every action visible in screenshot baseline, verify runtime path:
  - trigger action
  - open expected popup/form/menu
  - perform save/delete flow
  - confirm state updates and closure behavior

### 6. Verify build behavior without duplicate watchers

- Detect active user-managed `npm start`/`ng serve` first.
- If running, do not start another build/watch process.
- Read and follow `.agent/logs/ng-serve.log` for rebuild results.
- If a user-managed dev server is running, do not run separate one-off build commands (`npm run build`, `ng build`) unless the user explicitly asks.
- If no user-managed dev server is running, run one explicit build verification command.

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

### 8. Keep branch stability baseline

- On non-`master` branches, use `master` as the default stability baseline unless the user names a different baseline.
- Before edits, inspect branch divergence:
  - `git rev-parse --abbrev-ref HEAD`
  - `git merge-base master HEAD`
  - `git diff --name-status master...HEAD`
- For extraction regressions, compare behavior against baseline for:
  - popup open/close flows
  - event contracts between monolith and extracted component
  - template and style parity (desktop and mobile)
  - build/rebuild health
- Before declaring a slice complete, run touched-file parity checks against `master`:
  - `git diff --name-only -- <touched files>`
  - `git diff master -- <touched files>`
  - `git show master:<path>` for each moved popup template/TS/SCSS file and each integration caller file
- Treat these as release blockers when present:
  - `+` action route changed from popup form to direct mutation
  - stage/group menu items not wired to real flows
  - menu buttons rendered but disabled/inert
  - popup width/typography/layout materially different from baseline screenshots

### 9. Report slice completion

- List extracted screens completed in the slice.
- List monolith sections removed or trimmed.
- List remaining extraction backlog.
- List known risks and the next recommended slice.
- Explicitly confirm whether legacy blocks were removed from `app.html`, `app.ts`, and `app.scss`.

## Non-negotiable rules

- Do not leave wrapper-only architecture as the final state.
- Do not keep duplicated logic in both monolith and popup files.
- Do not skip trimming of `app.ts`, `app.html`, or `app.scss` after moving a slice.
- Do not introduce regressions silently; call out any unresolved issue explicitly.
- Do not scope fixes only to the popup if extraction has broken related modules; stabilize all affected modules in the same slice.
- Do not delete or wholesale-rewrite already-validated popup HTML/SCSS while addressing incremental regressions.
- Do not delete large existing SCSS/HTML blocks unless the user explicitly requests deletion and approves scope first.
- NEVER DELETE A VALIDATED SCSS FILE OR RECREATE IT FROM SCRATCH DURING REGRESSION FIXES; PATCH INCREMENTALLY.
- Do not change untouched working areas of a validated screen when the user requested only targeted fixes.
- NEVER TOUCH UNREQUESTED AREAS OF A TESTED SCREEN.
- If a broad accidental diff happens, revert that broad change and re-apply as minimal targeted patches.
- ALWAYS CREATE EXTRACTED POPUP COMPONENTS AS SELF-CONTAINED `*.TS + *.HTML + *.SCSS` FILE SETS; DO NOT SHIP INLINE TEMPLATE/STYLE SHORTCUTS IN THIS WORKFLOW.
- NEVER BREAK STABLE POPUP BEHAVIOR DURING LIST-PANEL EXTRACTION; REUSE EXISTING SERVICE-DRIVEN FLOW FIRST, THEN EXTRACT POPUPS ONLY WHEN EXPLICITLY REQUESTED.
- NEVER DROP OR SIMPLIFY ORIGINAL DATE-RANGE/CAPACITY/OVERLAP LOGIC DURING EXTRACTION; PORT IT EXACTLY FROM BASELINE (`master`) BEFORE DECLARING STABLE.
- WHEN INSERTING OR EDITING SUBEVENTS, PRESERVE ORIGINAL OVERLAP BEHAVIOR (TRIM PARTIAL OVERLAP + SHIFT FOLLOWING ITEMS) AND MAIN EVENT BOUNDS SYNC.

## Completion checklist

- Validate that extracted popup uses signals-based state.
- Validate that monolith files are smaller for the completed slice.
- Validate build/watch status from the active build loop.
- Validate screenshot parity for provided pairs.

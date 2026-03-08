---
name: angular-typescript-web-standards
description: Enforce Angular and TypeScript standards for scalable, maintainable, performant, and accessible web applications. Use when implementing, refactoring, or reviewing Angular code to apply strict typing, signals-based state management, standalone component conventions for Angular v20+, modern template control flow, reactive forms, WCAG AA plus AXE accessibility requirements, and strict screenshot parity comparisons between expected and actual UI results.
---

# Angular TypeScript Web Standards

Apply this skill as a guardrail set for Angular and TypeScript tasks.

## Standard instructions (unchanged from baseline)

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

### TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

### Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
- `NgOptimizedImage` does not work for inline base64 images.

### Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

#### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

### State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

### Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

### Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## Customized instructions (project-specific)

### Component file and style isolation

- Use separate `*.ts`, `*.html`, and `*.scss` files for each component; do not use inline templates or inline styles in this project.
- Keep component SCSS self-contained and scoped to the component.
- Do not introduce new dependencies on monolith/global stylesheet rules for extracted or new components.
- When moving UI out of monolith files, migrate required styles into the component-local SCSS.
- Do not delete or recreate already-validated SCSS blocks/files during regression fixes; use incremental selector-level patches unless the user explicitly approves scoped deletion.

### Local dev server coordination

- Treat a user-managed `npm start` or `ng serve` session as the primary build loop.
- Do not start a second watcher or serve process when one is already running.
- Do not invoke Angular MCP `devserver.start` when the user already runs a local dev server.
- Use explicit user confirmation for rebuild status when relying on a user-managed server.
- Prefer reading the user-provided dev-server log (for example `.agent/logs/ng-serve.log`) to confirm build/rebuild status.
- Do not run separate one-off build commands (`npm run build`, `ng build`) while a user-managed dev server is active, unless the user explicitly requests it.

### Branch baseline protocol (stable comparison)

- When working on any non-`master` branch, treat `master` as the stable baseline unless the user specifies another baseline branch.
- Before editing, inspect divergence from baseline:
  - `git rev-parse --abbrev-ref HEAD`
  - `git merge-base master HEAD`
  - `git diff --name-status master...HEAD`
- Limit review scope to files touched by the current branch when validating regressions, then include any directly coupled Angular/template/style files.
- For behavior regressions, compare feature-branch behavior against `master` for:
  - routes and navigation flow
  - component inputs/outputs and event contracts
  - template structure/states (loading, empty, error, data)
  - SCSS visual parity and responsive breakpoints
  - strict typing and build/test status
- If a file differs from `master` and needs refactor, preserve branch intent first, then apply standards; do not blindly overwrite with baseline.
- Before final completion of a refactor slice, perform touched-file baseline verification:
  - `git diff --name-only -- <touched files>`
  - `git diff master -- <touched files>`
  - `git show master:<path>` for each behavior-critical template/TS/SCSS file in the slice
- Do not mark work complete until every touched behavior-critical file is explicitly checked against `master` for:
  - missing actions/routes/menu handlers
  - disabled or inert controls compared to baseline
  - popup/form flow regressions (open/edit/save/delete paths)
  - width/typography/layout drift visible in screenshots
- In status reports, always state:
  - current branch name
  - baseline branch used for stability checks
  - exact files compared against baseline

### Screenshot comparison protocol

- Compare all provided screenshot pairs (`original` vs `result`) without requiring the user to pre-list differences.
- Perform two passes: macro layout pass, then micro detail pass.
- Check spacing, alignment, sizing, typography, colors, borders, shadows, icons, states, truncation, overflow, and responsive behavior.
- Report every detected mismatch with precise location and severity.
- Re-check after fixes by comparing new screenshots to the original baseline.
- End reports with `No additional differences found` only after a full pass confirms parity.
- Do not replace feature-complete UI with simplified approximations when screenshot parity is required; preserve existing controls, action menus, and motion behavior unless explicitly redesigned.
- Do not replace form-based interaction flows with silent direct mutations (for example: `+` must still open creation form popup when original flow did).
- Any visible action control from baseline (header/stage/group three-dot menus, add buttons, etc.) must be wired end-to-end; no inert buttons and no placeholder-only menu actions.
- Keep popup/container dimensions and spacing aligned to baseline intent; treat large width/height drift as parity failure.
- Preserve baseline typography decisions unless explicitly changed:
  - font family
  - font size and line height
  - font weight and letter spacing
  - text casing
- Treat popup width/height, card widths, header height, and key control sizing as hard parity constraints when screenshots indicate fixed visual rhythm.

### Tested-screen freeze protocol (regression-safe patching)

- If the user says a screen is already tested/approved, freeze the approved areas and patch only reported deviations.
- Do not replace full template or stylesheet files when addressing incremental UI regressions.
- Keep changes surgical:
  - touch only related selectors, classes, handlers, and bindings
  - keep existing working controls/routes/menus untouched
  - avoid broad refactors while in regression-fix mode
- Preserve baseline behavior contracts during visual fixes:
  - action buttons must keep their original popup/form flow
  - menu order, iconography, and enabled/disabled behavior must stay aligned unless explicitly requested
- If a fix needs a broad rewrite to proceed, request explicit approval before applying it.
- If a broad accidental diff is introduced, revert that broad part and re-implement as minimal patches.
- NEVER DELETE OR WHOLESALE-REWRITE VALIDATED SCSS/HTML BLOCKS WITHOUT EXPLICIT USER APPROVAL.
- NEVER DELETE A VALIDATED SCSS FILE OR RECREATE IT FROM SCRATCH DURING INCREMENTAL FIXES.
- NEVER TOUCH UNREQUESTED AREAS OF A TESTED SCREEN.
- ALWAYS IMPLEMENT NEW/EXTRACTED UI COMPONENTS AS SELF-CONTAINED `*.TS + *.HTML + *.SCSS` FILES IN THIS PROJECT; NO INLINE TEMPLATE/STYLE SHORTCUTS.

### Repeated-screen generalization protocol

- When multiple screenshots show similar layout/behavior, design one reusable component pattern instead of cloning pages.
- Prefer a generalized list component for repeated feed/table/card-list screens.
- Treat the first 5-6 variant screenshots as an implicit requirements set; do not wait for per-feature restatement.
- Define typed list contracts up front: item model, query/filter/sort model, pagination model, UI state model.
- Model container-level contracts explicitly: filter bar emits typed filter/sort signals to list container; list container issues request using current query model; server response maps to typed variant payloads.
- Support polymorphic item rendering from response type (for example: event card, single-image rate card, pair-image rate card).
- Implement mandatory states in the reusable list: loading, empty, error with retry, data-loaded, incremental loading for pagination/infinite scroll.
- Implement required interaction primitives where shown in screenshots: selectable/pickable list elements, item action menus, item badges/chips/status markers, header-level loading progress indicator, rating bar interactions, arrow-based pagination/navigation when present.
- Implement responsive layout rules from screenshot intent: mobile usually single-column rows, desktop multi-column rows (3-4 when shown).
- Auto-classify screenshot sets into mobile and desktop groups and verify both groups by default.
- Keep variant-specific visuals configurable through typed inputs, slots, or row templates.
- Validate parity against all provided screenshots using a checklist matrix before declaring completion.

### Monolith decomposition protocol

- Treat large-file refactors as mandatory extraction work, not wrapper work.
- Do not stop at VM wrappers, host-binding shims, or pass-through indirection as a final state.
- Apply the same extraction pattern across related modules when refactors cause cross-module breakage.
- Define hard extraction targets before editing: target file(s) to extract into, responsibilities moved out, and max line budget for the source file after extraction.
- Move full responsibility slices (state, logic, templates/helpers) into focused units.
- Keep behavior stable after each slice and run verification after each step.
- Report progress by slice and explicitly list what remains.
- Use iterative delivery for high-risk files: complete one slice end-to-end before starting the next.
- Extraction is not complete until legacy code is trimmed from monolith sources:
  - remove moved markup from `app.html`
  - remove obsolete listeners/openers/wrappers from `app.ts`
  - remove or reduce dead style blocks from `app.scss`

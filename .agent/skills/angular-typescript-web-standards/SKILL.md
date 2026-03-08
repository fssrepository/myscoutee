---
name: angular-typescript-web-standards
description: Enforce Angular and TypeScript standards for scalable, maintainable, performant, and accessible web applications. Use when implementing, refactoring, or reviewing Angular code to apply strict typing, signals-based state management, standalone component conventions for Angular v20+, modern template control flow, reactive forms, WCAG AA plus AXE accessibility requirements, and strict screenshot parity comparisons between expected and actual UI results.
---

# Angular TypeScript Web Standards

Apply this skill as a guardrail set for Angular and TypeScript tasks.

## Project customizations (apply first)

### Local dev server coordination

- Treat a user-managed `npm start` or `ng serve` session as the primary build loop.
- Do not start a second watcher or serve process when one is already running.
- Do not invoke Angular MCP `devserver.start` when the user already runs a local dev server.
- Use explicit user confirmation for rebuild status when relying on a user-managed server.

### Screenshot comparison protocol

- Compare all provided screenshot pairs (`original` vs `result`) without requiring the user to pre-list differences.
- Perform two passes: macro layout pass, then micro detail pass.
- Check spacing, alignment, sizing, typography, colors, borders, shadows, icons, states, truncation, overflow, and responsive behavior.
- Report every detected mismatch with precise location and severity.
- Re-check after fixes by comparing new screenshots to the original baseline.
- End reports with `No additional differences found` only after a full pass confirms parity.

### Repeated-screen generalization protocol

- When multiple screenshots show similar layout/behavior, design one reusable component pattern instead of cloning pages.
- Prefer a generalized list component for repeated feed/table/card-list screens.
- Treat the first 5-6 variant screenshots as an implicit requirements set; do not wait for per-feature restatement.
- Define typed list contracts up front:
  - item model
  - query/filter/sort model
  - pagination model
  - UI state model
- Model container-level contracts explicitly:
  - filter bar emits typed filter/sort signals to list container
  - list container issues request using current query model
  - server response maps to typed variant payloads
- Support polymorphic item rendering from response type (for example: event card, single-image rate card, pair-image rate card).
- Implement mandatory states in the reusable list:
  - loading
  - empty
  - error with retry
  - data-loaded
  - incremental loading for pagination/infinite scroll
- Implement required interaction primitives where shown in screenshots:
  - selectable/pickable list elements
  - item action menus
  - item badges/chips/status markers
  - header-level loading progress indicator
  - rating bar interactions
  - arrow-based pagination/navigation when present
- Implement responsive layout rules from screenshot intent:
  - mobile: usually single-column rows
  - desktop: multi-column rows (3-4 when shown)
- Auto-classify screenshot sets into mobile and desktop groups and verify both groups by default.
- Keep variant-specific visuals configurable through typed inputs, slots, or row templates.
- Validate parity against all provided screenshots using a checklist matrix before declaring completion.

### Monolith decomposition protocol

- Treat large-file refactors as mandatory extraction work, not wrapper work.
- Do not stop at VM wrappers, host-binding shims, or pass-through indirection as a final state.
- Apply the same extraction pattern across related modules when refactors cause cross-module breakage.
- Define hard extraction targets before editing:
  - target file(s) to extract into
  - responsibilities moved out
  - max line budget for the source file after extraction
- Move full responsibility slices (state, logic, templates/helpers) into focused units.
- Keep behavior stable after each slice and run verification after each step.
- Report progress by slice and explicitly list what remains.
- Use iterative delivery for high-risk files: complete one slice end-to-end before starting the next.

## Standard Angular and TypeScript rules

### Operating defaults

- Treat code quality as functional, maintainable, performant, and accessible by default.
- Prefer practical and scalable implementations over clever patterns.
- Explain tradeoffs briefly when requirements conflict.

### TypeScript rules

- Enable and preserve strict type checking.
- Prefer type inference when a type is obvious.
- Avoid `any`; use `unknown` when a type is uncertain and narrow it safely.

### Angular architecture rules

- Use standalone components (Angular v20+ default behavior).
- Do not set `standalone: true` in decorators.
- Use signals for local and shared UI state where appropriate.
- Use `computed()` for derived state.
- Use `set()` or `update()` on signals; do not use `mutate`.
- Use lazy loading for feature routes.
- Use `inject()` instead of constructor injection when feasible.
- Use `providedIn: 'root'` for singleton services.
- Use `host` metadata instead of `@HostBinding` and `@HostListener`.

### Component rules

- Keep components focused on one responsibility.
- Use `input()` and `output()` function APIs instead of decorators.
- Set `changeDetection: ChangeDetectionStrategy.OnPush`.
- Prefer inline templates for small components.
- Use relative paths from the component TypeScript file for external templates and styles.
- Prefer reusable list primitives over duplicated screen components when the interaction pattern is shared.

### Template rules

- Keep template logic simple.
- Use native control flow (`@if`, `@for`, `@switch`) instead of structural directive microsyntax.
- Use `class` and class bindings instead of `ngClass`.
- Use `style` and style bindings instead of `ngStyle`.
- Use the `async` pipe for observables in templates.
- Avoid assuming global constructors in templates; compute values in component code.
- Use `NgOptimizedImage` for static images.
- Do not use `NgOptimizedImage` for inline base64 images.

### Forms and state rules

- Prefer reactive forms over template-driven forms.
- Keep state transformations pure and predictable.

### Accessibility requirements

- Pass AXE checks for implemented UI.
- Meet WCAG AA minimums, including focus order, contrast, keyboard support, and semantic labeling.
- Add or refine ARIA attributes only when native semantics are insufficient.

## Output checklist

- Verify strict typing and absence of `any` unless explicitly required.
- Verify Angular patterns above are followed.
- Verify accessibility constraints are satisfied.
- Call out any known gap if full verification is not possible in the current environment.

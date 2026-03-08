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
- When moving UI out of monolith files, migrate required styles into the component-local SCSS and remove obsolete monolith style rules.

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

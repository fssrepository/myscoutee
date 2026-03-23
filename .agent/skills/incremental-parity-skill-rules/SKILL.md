---
name: incremental-parity-skill-rules
description: Enforce incremental, parity-first patching for regressions and extracted component work. Use when preserving original behavior from a baseline commit/branch is required and broad rewrites should be avoided.
---

# Incremental Parity Skill Rules

Use this workflow for UI/behavior fixes and extracted component parity work.

1. Establish baseline first.
- Identify baseline revision explicitly (`HEAD~N`, commit hash, or branch).
- Diff only relevant files/functions against baseline.
- Build a checklist from reported regressions.

2. Apply incremental patches only.
- Change the smallest possible code block.
- Keep existing architecture/contracts unless redesign is explicitly requested.
- Avoid broad rewrites of SCSS/HTML/TS when targeted patching is sufficient.

3. Preserve original behavior during extraction.
- Keep same data flow, menu contracts, and popup navigation behavior.
- Reapply baseline logic before adding improvements.

4. Fix-forward if baseline is buggy.
- Keep parity behavior where correct.
- Add narrow fixes on top where baseline is known-buggy.
- Document what is parity vs fix-forward.

5. Verify each point.
- Re-test each listed regression after patch.
- Confirm no coupling regressions (opening one popup must not close unrelated popups).
- Run build/tests before finalizing.

Guardrails:
- Do not revert unrelated local changes.
- Do not perform invasive file-wide rewrites for parity tasks.
- Do not touch git reset/revert flows unless explicitly requested.

# Development Conventions

## Release Checklist — applies to EVERY project in this workspace

This is a **standing rule**: for every update/change made to a project, all of the
following must be updated before the work is considered complete:

1. **README.md** — update to reflect the change (features, usage, API, timing, config, etc.)
2. **Version** — bump the project version using the repo's established scheme
3. **Tag** — create a matching git tag and push it to all configured remotes

Projects covered by this rule:

- `GeekSquadJeopardy`
- `SpinTheWheel`
- any future project added to this workspace

## Versioning notes per project

- **SpinTheWheel** — semantic version `x.y.z` kept in sync across:
  - `frontend/package.json`
  - `frontend/package-lock.json` (root and `""` package entry)
  - `backend/main.py` (FastAPI `version=`)
  - Example: `1.0.0` → `1.1.0` with annotated tag `v1.1.0`.
- **GeekSquadJeopardy** — uses descriptive/version tags (e.g. `v0.9.4`, `v0.6-buzzer-engine`);
  keep the tag scheme and any package version in sync with the change.

## Tagging & pushing

- Use annotated tags: `git tag -a vX.Y.Z -m "Release vX.Y.Z: <summary>"`
- Push the commit **and** the tag to every remote (`git push <remote> main --tags`).
  - SpinTheWheel has a dual-push hook that mirrors `origin` (GitHub) to Gitea automatically.

## Master Build Contract — applies to EVERY change

Source: `~/GuidelinesForProjectBuildsOrRebuilds.txt`

Before generating a single line of code, the following pre-work **must** be done
and **documented** in the response to the user. No code is to be written until
items 1–12 are complete and any recommended changes are folded in.

### Pre-code checklist

1. Produce a complete **function map**.
2. Produce a **call tree**.
3. Identify **reusable logic**.
4. Identify **unnecessary abstractions**.
5. Identify **transaction scope**.
6. Identify **logging points**.
7. Identify **validation points**.
8. Perform **self-review**.
9. Perform **adversarial review**.
10. Produce a **defect list**.
11. **Apply fixes**.
12. Only then generate code.

### Required review sections

When summarizing a change in the response, address each of the following:

- Architecture Findings
- Business Rule Findings
- Compile Risks
- Runtime Risks
- Transaction Risks
- Logging Gaps
- Maintainability Findings
- Final Changes To Be Applied

### Severity classification

Use these tags on every finding before fixing:

- **BLOCKER** — must fix before any code is written
- **HIGH** — must fix before the work is considered done
- **MEDIUM** — should fix in the same change when reasonable
- **LOW** — fix when touching nearby code
- **ENHANCEMENT** — track separately, not required for this change

### Process flow

- **Phase 1 — Design** — produce the function map, call tree, and findings
- **Phase 2 — Review** — self-review + adversarial review
- **Phase 3 — Finalize** — defect list, severity tags, apply fixes
- **Phase 4 — Generate Code** — only after Phase 3 leaves no remaining recommended changes
- **Phase 5 — Compile/Test Review** — build, run smoke tests, verify before reporting done

### Gate before writing code

> Perform final review. Identify every change you would make. Apply those
> changes. **Do not generate code until there are no remaining recommended
> changes.**

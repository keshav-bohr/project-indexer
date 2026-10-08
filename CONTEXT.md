# Project Indexer — LLM Instructions

> This document is the universal instruction layer for the project-indexer.
> It is tool-agnostic and can be used with any LLM: Claude, ChatGPT, Gemini,
> GitHub Copilot, Cursor, Continue, or any other AI coding assistant.

---

## What This Is

`project-index.js` is a Node.js script that scans any codebase and produces a single
`project-context.json` file — a compressed, structured snapshot of the entire project
that an LLM can read in one pass.

Instead of browsing dozens of files to understand a project, an LLM reads
`project-context.json` first and uses it as a navigation map — opening only the
specific files it actually needs.

**Treat `project-context.json` as a build artifact, never as documentation to write or edit by hand.**

---

## Step 1 — Generate the Context File

Run the indexer from the project root:

```bash
node /path/to/project-index.js /path/to/your/project
```

Or if run from the project directory itself:

```bash
node /path/to/project-index.js
```

This produces `project-context.json` at the project root. The script:
- Requires only Node.js (v14+), no other dependencies
- Runs in under 5 seconds on most projects
- Is safe to re-run at any time — it overwrites the previous output

If Node.js is not available, install it from https://nodejs.org

---

## Step 2 — Load the Context File

After generation, read the contents of `project-context.json` and keep it in your
active context window. This is your single source of truth for all questions about
the project.

**Do not discard or summarise it — use it verbatim as the navigation layer.**

---

## Step 3 — Understand the Schema

The context file has the following top-level structure:

```
_meta          When it was generated, script version, absolute root path
project        Name, version, short description or README summary
stack          Languages, frameworks, test frameworks, bundler, package manager,
               whether it is containerised, CI/CD systems detected
git            Current branch, last commit message
conventions    Linter, formatter, TypeScript strict mode, available scripts
dependencies   Runtime deps (list), dev deps (list), peer deps (list)
fileTree       Full directory tree (dirs + files, skipping build/vendor dirs)
               Each file entry has: { type, path, size }
               Each dir entry has:  { type, path, children[] }
sourceFiles    Flat list of all source files with their exported symbols
               Each entry: { path, exports?: string[] }
```

**`sourceFiles[].exports`** is the most useful field for navigation.
Use it to find exactly which file defines a symbol without grepping the entire tree.

---

## Step 4 — Answer Questions Using the Context

When a user asks about the project, follow this pattern:

1. **Consult `sourceFiles`** — find the file that exports the relevant symbol
2. **Consult `fileTree`** — understand where the file sits in the project structure
3. **Read only that file** — do not scan unrelated files
4. **Cross-reference `stack` and `conventions`** — apply the right patterns for this
   specific language, framework, and tooling

This keeps answers fast, accurate, and grounded in the actual codebase.

---

## Step 5 — Editing and Refactoring

Before making any edit:

1. Check `conventions.scripts` — understand how to build, test, and lint
2. Check `stack.frameworks` — apply idiomatic patterns for the detected framework
3. Check `dependencies.runtime` — do not suggest packages already available;
   do not suggest new packages if the existing ones cover the need
4. Check `conventions.linter` / `conventions.formatter` — match the project's
   code style exactly

After editing, remind the user to re-run the indexer if files were added, removed,
or if the dependency manifest changed.

---

## Step 6 — Keeping the Context Fresh

The context file goes stale when the project changes. Recommend a refresh when:

- New files or directories are added
- Dependencies are installed or removed
- A significant refactor changes the export surface
- After a git merge or rebase
- At the start of a new work session

Refresh command (same as generation):
```bash
node /path/to/project-index.js /path/to/your/project
```

Also recommend adding `project-context.json` to `.gitignore`:
```
echo "project-context.json" >> .gitignore
```
It is a generated artifact that differs between machines and should not be committed.

---

## What the Indexer Detects

### Languages
JavaScript, TypeScript, Python, Java, Kotlin, Go, Rust, Ruby, PHP, C#, Swift, Scala

### Frameworks
React, Vue, Angular, Svelte, Next.js, Nuxt, Express, Fastify, NestJS,
Django, Flask, FastAPI, Spring, Gin, Echo, Fiber, Actix, Axum

### Test Frameworks
Jest, Vitest, Mocha, Cypress, Playwright, pytest, unittest, JUnit

### Bundlers
webpack, Vite, Rollup, esbuild, Parcel

### Package Managers
npm, yarn, pnpm, Maven, Gradle, pip/pipenv/poetry, Go modules, Cargo

### CI/CD
GitHub Actions, GitLab CI, Jenkins, Travis CI

### Conventions
ESLint, Prettier, Ruff, Black, TypeScript strict mode

---

## Limitations

- Source files are capped at **500** (largest by directory traversal order)
- Exported symbols are capped at **30 per file**
- Files larger than **100 KB** are skipped for export extraction (path still indexed)
- Binary files, images, and non-code assets are excluded
- The export extractor uses regex, not a full AST — highly accurate for common patterns
  but may miss exotic macro-generated or dynamically constructed exports

---

## Platform-Specific Notes

### Claude (claude.ai, Claude API, Claude in Cursor)
Paste the contents of `project-context.json` directly into the conversation, or
attach it as a file. Then proceed with your question.

### ChatGPT / GPT-4
Attach `project-context.json` as a file upload, or paste its contents.
Instruct the model: _"Use the attached project-context.json as your navigation map.
Read source files only when needed to answer precisely."_

### GitHub Copilot
Open `project-context.json` in a tab before asking Copilot Chat questions.
Copilot will include open files in its context window automatically.

### Cursor / Continue / Cody
Add `project-context.json` to the context using `@file` or the context picker.
Pin it so it persists across the session.

### IBM Bob
Use the `project-indexer` skill — it automates Steps 1–3 above and guides
subsequent queries automatically. See `SKILL.md`.

---

## Quick Reference

| Goal | What to look at |
|---|---|
| Find where a function is defined | `sourceFiles[].exports` |
| Understand the project structure | `fileTree` |
| Know what's available to import | `dependencies.runtime` |
| Know how to run/build/test | `conventions.scripts` |
| Apply the right code style | `conventions.linter` + `stack.frameworks` |
| Check current branch | `git.branch` |

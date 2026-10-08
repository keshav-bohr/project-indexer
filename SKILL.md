---
name: project-indexer
description: Use when the user wants to index a project, create a project context, build a single source of truth for the codebase, or help an LLM understand the project structure. Also use when the user says "index this project", "build project context", "create project-context.json", or "update the project index".
---

# Project Indexer (Bob)

> Bob-specific wrapper for the project-indexer.
> The full LLM-agnostic instructions live in `CONTEXT.md` alongside this file.
> This skill automates the steps described there using Bob's native tools.

---

## Step 1 — Locate the Project Root

Identify the directory to index. Default to the current workspace root unless the
user specifies a different path.

```
PROJECT_ROOT = <workspace root or user-specified path>
SCRIPT       = ~/.bob/skills/project-indexer/project-index.js
```

---

## Step 2 — Run the Indexer

Use `execute_command`:

```bash
node ~/.bob/skills/project-indexer/project-index.js <PROJECT_ROOT>
```

If it fails with "node not found", ask the user to confirm Node.js is installed:
```bash
node --version
```
Node.js v14 or higher is required.

---

## Step 3 — Read the Output

Use `read_file` to load `<PROJECT_ROOT>/project-context.json`.

Summarise the following fields back to the user in 3–5 plain-English lines:

| Field | Report |
|---|---|
| `project.name` + `project.version` | Project identity |
| `stack.languages` + `stack.frameworks` | What it's built with |
| `stack.bundler` + `stack.packageManager` | Toolchain |
| `stack.testFrameworks` | Test setup |
| `conventions.scripts` | Available run scripts |
| `dependencies.runtime` (count) | Runtime dep count |
| `sourceFiles` (count) | Files indexed |
| `git.branch` | Current branch |

---

## Step 4 — Apply the Context

From this point forward in the conversation, use `project-context.json` as the
navigation layer for all project queries:

1. Look up `sourceFiles[].exports` to find which file defines a symbol
2. Open only that file with `read_file` — do not scan unrelated files
3. Cross-reference `stack`, `conventions`, and `dependencies` before suggesting changes

For the full usage guide (applicable to any LLM), refer the user to:
`~/.bob/skills/project-indexer/CONTEXT.md`

---

## Step 5 — Gitignore and Refresh

After indexing:

1. Check whether `project-context.json` is in `.gitignore`. If not, suggest adding it:
   ```bash
   echo "project-context.json" >> <PROJECT_ROOT>/.gitignore
   ```

2. Remind the user to re-run the indexer when:
   - New source files are added or removed
   - Dependencies change in the manifest
   - After a git merge or rebase
   - At the start of a new work session

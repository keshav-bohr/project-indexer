# project-indexer

> A single-command project context generator for LLMs.  
> Works with Claude, ChatGPT, Gemini, GitHub Copilot, Cursor, Continue, IBM Bob, and any other AI coding assistant.

---

## The Problem

Every time you ask an LLM about your project, it either reads too little (misses context, gives wrong answers), reads too much (hits token limits, gets slow), or has no memory of what it already learned. You end up spending the first 10 messages of every session just re-explaining the codebase.

## The Solution

Run one command. Get one file. Give that file to your LLM. Done.

`project-context.json` is a compressed, structured snapshot of your entire codebase — stack, dependencies, file tree, exported symbols, conventions, git state — everything an LLM needs to navigate your project without reading every file from scratch.

```bash
node project-index.js /path/to/your/project
# → writes project-context.json in 2–4 seconds
```

---

## What Gets Indexed

| Category | Details |
|---|---|
| **Languages** | JavaScript, TypeScript, Python, Java, Kotlin, Go, Rust, Ruby, PHP, C#, Swift, Scala |
| **Frameworks** | React, Vue, Angular, Svelte, Next.js, Express, NestJS, Django, Flask, FastAPI, Spring, Gin, Actix, and more |
| **Test frameworks** | Jest, Vitest, Mocha, Cypress, Playwright, pytest, JUnit |
| **Bundlers** | webpack, Vite, Rollup, esbuild, Parcel |
| **Package managers** | npm, yarn, pnpm, Maven, Gradle, pip, poetry, Cargo, Go modules |
| **Conventions** | ESLint, Prettier, Ruff, Black, TypeScript strict mode, available scripts |
| **Export surface** | Exported functions, classes, types per file (used for symbol navigation) |
| **CI/CD** | GitHub Actions, GitLab CI, Jenkins, Travis CI |
| **Git** | Current branch, last commit message |

---

## Requirements

- **Node.js v14 or higher** — that's it. No npm install, no dependencies.

---

## Installation

### Option A — IBM Bob (global skill)

```bash
mkdir -p ~/.bob/skills/project-indexer

curl -fsSL https://raw.githubusercontent.com/<you>/project-indexer/main/SKILL.md \
  -o ~/.bob/skills/project-indexer/SKILL.md

curl -fsSL https://raw.githubusercontent.com/<you>/project-indexer/main/project-index.js \
  -o ~/.bob/skills/project-indexer/project-index.js

curl -fsSL https://raw.githubusercontent.com/<you>/project-indexer/main/CONTEXT.md \
  -o ~/.bob/skills/project-indexer/CONTEXT.md
```

Then start a new Bob conversation and say: **"index this project"**

### Option B — Any other LLM (manual)

1. Download `project-index.js` anywhere on your machine
2. Run it against your project:
   ```bash
   node /path/to/project-index.js /path/to/your/project
   ```
3. Give `project-context.json` to your LLM (see [LLM-specific usage](#llm-specific-usage) below)

### Option C — Clone

```bash
git clone https://github.com/<you>/project-indexer.git
node project-indexer/project-index.js /path/to/your/project
```

---

## Usage

### Generate

```bash
# From the project root
node /path/to/project-index.js

# Or specify a path
node /path/to/project-index.js /path/to/your/project
```

Output:
```
Indexing project at: /path/to/your/project
✓ project-context.json written to /path/to/your/project/project-context.json
  Source files indexed : 312
  Runtime dependencies : 28
  Stack detected       : TypeScript/JavaScript
  Frameworks           : React
```

### Refresh

Re-run the same command. It overwrites the previous output. Do this:
- After adding or removing files
- After changing your dependency manifest
- After a git merge or rebase
- At the start of a new work session

### Gitignore

`project-context.json` is a generated artifact — don't commit it:

```bash
echo "project-context.json" >> .gitignore
```

---

## LLM-Specific Usage

### Claude (claude.ai or Claude API)

Attach `project-context.json` as a file, or paste its contents and say:

> "Use the attached project-context.json as your navigation map for this codebase.
> Consult sourceFiles[].exports to find where symbols are defined, then read only
> those files when answering."

### ChatGPT / GPT-4o

Upload `project-context.json` via the file attachment button, then:

> "I've attached project-context.json — a structured index of my project.
> Use it to navigate the codebase. Only read specific files when you need to."

### GitHub Copilot Chat

Open `project-context.json` as a tab in VS Code before starting your Copilot Chat
session. Copilot includes open editor tabs in its context automatically.

### Cursor

Use `@file project-context.json` in the chat to add it to context. Pin it to keep
it active across the session.

### Continue (VS Code / JetBrains)

Add `project-context.json` via the `@file` context provider in the Continue chat panel.

### Cody (Sourcegraph)

Mention `project-context.json` explicitly in your prompt or add it via the context
selector.

### IBM Bob

Use the `project-indexer` skill — Bob automates generation, reads the output,
summarises it, and uses it as the navigation layer for all follow-up queries.
See [Installation Option A](#option-a--ibm-bob-global-skill).

---

## Output Schema

```jsonc
{
  "_meta": {
    "generated": "ISO 8601 timestamp",
    "generator": "project-indexer",
    "version": "1.0.0",
    "root": "/absolute/path/to/project"
  },
  "project": {
    "name": "my-app",
    "version": "1.0.0",
    "description": "First paragraph from README or package.json description"
  },
  "stack": {
    "languages": ["TypeScript/JavaScript"],
    "frameworks": ["React"],
    "testFrameworks": ["Jest"],
    "bundler": "webpack",
    "packageManager": "npm",
    "containerized": false,
    "cicd": ["GitHub Actions"]
  },
  "git": {
    "branch": "main",
    "lastCommitMessage": "fix: resolve token refresh race condition"
  },
  "conventions": {
    "linter": "ESLint",
    "formatter": "Prettier",
    "strictMode": true,
    "moduleSystem": "ESNext",
    "scripts": ["dev", "build", "test", "lint"]
  },
  "dependencies": {
    "runtime": ["react", "react-dom", "..."],
    "dev": ["webpack", "typescript", "..."],
    "peer": []
  },
  "fileTree": [
    { "type": "dir", "path": "src", "children": [
      { "type": "file", "path": "src/index.tsx", "size": 1240 }
    ]}
  ],
  "sourceFiles": [
    { "path": "src/components/Button.tsx", "exports": ["Button", "ButtonProps"] },
    { "path": "src/utils/format.ts", "exports": ["formatDate", "formatCurrency"] }
  ]
}
```

---

## Limitations

- Source files are capped at **500** (largest projects will hit this)
- Exported symbols are capped at **30 per file**
- Files larger than **100 KB** are skipped for export extraction (path still indexed)
- Export extraction uses regex, not a full AST — covers common patterns reliably
- Binary files, images, and non-code assets are excluded

---

## Files in This Repo

| File | Purpose |
|---|---|
| `project-index.js` | The indexer script — run this |
| `CONTEXT.md` | LLM-agnostic instructions — give this to any LLM alongside the JSON |
| `SKILL.md` | IBM Bob skill wrapper — automates the workflow inside Bob |

---

## License

MIT

---
name: project-indexer
description: Use when the user wants to index a project, create a project context, build a single source of truth for the codebase, or help an LLM understand the project structure. Also use when the user says "index this project", "build project context", "create project-context.json", or "update the project index".
---

# Project Indexer

Builds a single `project-context.json` file at the project root — a compressed, structured
snapshot of the entire codebase that any LLM can read in one pass instead of browsing dozens
of files. Treat this file as a **build artifact**, never as documentation to write or edit by hand.

For the full usage guide, follow the steps in `CONTEXT.md` alongside this file.

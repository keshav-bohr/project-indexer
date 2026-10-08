#!/usr/bin/env node
/**
 * project-index.js
 * Generic project context indexer for LLM consumption.
 * Produces project-context.json at the project root.
 *
 * Usage: node project-index.js [project-root]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || process.cwd());
const OUTPUT = path.join(ROOT, "project-context.json");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

// ─── Ignore Rules ─────────────────────────────────────────────────────────────

const ALWAYS_SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", ".hg",
  "dist", "build", "out", "target", ".next", ".nuxt",
  "__pycache__", ".mypy_cache", ".pytest_cache",
  "venv", ".venv", "env", ".env",
  "vendor", ".gradle", ".idea", ".vscode",
  "coverage", ".nyc_output", "tmp", "temp",
  "generatedSrc", "build_deps", "buildEclipse",
]);

const ALWAYS_SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "Gemfile.lock", "poetry.lock", "Cargo.lock",
  ".DS_Store", "Thumbs.db",
]);

const CODE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".java", ".kt", ".scala",
  ".go", ".rs", ".c", ".cpp", ".h", ".hpp",
  ".rb", ".php", ".cs", ".swift",
  ".vue", ".svelte",
  ".sh", ".bash", ".zsh",
  ".yaml", ".yml", ".toml", ".json",
  ".css", ".scss", ".less",
  ".html", ".htm",
  ".md", ".mdx",
  ".xml",
]);

const CONFIG_FILES = [
  "package.json", "pom.xml", "build.gradle", "build.gradle.kts",
  "requirements.txt", "pyproject.toml", "setup.py", "Pipfile",
  "go.mod", "Cargo.toml", "Gemfile", "composer.json",
  "tsconfig.json", "jsconfig.json", "babel.config.json", ".babelrc",
  ".eslintrc", ".eslintrc.js", ".eslintrc.json", ".eslintrc.yml",
  "webpack.config.js", "vite.config.js", "rollup.config.js",
  "jest.config.js", "vitest.config.js", "pytest.ini", "setup.cfg",
  "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
  ".env.example", ".nvmrc", ".node-version",
  "Makefile", "CMakeLists.txt",
  "README.md", "README", "CONTRIBUTING.md",
];

// ─── File Tree Walker ──────────────────────────────────────────────────────────

function walkTree(dir, depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return [];
  const entries = [];
  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const item of items) {
    if (item.name.startsWith(".") && item.name !== ".env.example") continue;
    if (ALWAYS_SKIP_FILES.has(item.name)) continue;

    const fullPath = path.join(dir, item.name);
    const relPath = rel(fullPath);

    if (item.isDirectory()) {
      if (ALWAYS_SKIP_DIRS.has(item.name)) continue;
      const children = walkTree(fullPath, depth + 1, maxDepth);
      entries.push({ type: "dir", path: relPath, children });
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (!CODE_EXTENSIONS.has(ext) && !CONFIG_FILES.includes(item.name)) continue;
      const stat = fs.statSync(fullPath);
      entries.push({ type: "file", path: relPath, size: stat.size });
    }
  }
  return entries;
}

// ─── Language & Stack Detection ───────────────────────────────────────────────

function detectStack() {
  const stack = {
    languages: [],
    frameworks: [],
    testFrameworks: [],
    bundler: null,
    packageManager: null,
    containerized: false,
    cicd: [],
  };

  // JavaScript / TypeScript
  const pkg = readJSON(path.join(ROOT, "package.json"));
  if (pkg) {
    stack.languages.push(
      exists(path.join(ROOT, "tsconfig.json")) || exists(path.join(ROOT, "jsconfig.json"))
        ? "TypeScript/JavaScript"
        : "JavaScript"
    );
    stack.packageManager = exists(path.join(ROOT, "yarn.lock"))
      ? "yarn"
      : exists(path.join(ROOT, "pnpm-lock.yaml"))
      ? "pnpm"
      : "npm";

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Frameworks
    if (allDeps["react"]) stack.frameworks.push("React");
    if (allDeps["vue"]) stack.frameworks.push("Vue");
    if (allDeps["@angular/core"]) stack.frameworks.push("Angular");
    if (allDeps["svelte"]) stack.frameworks.push("Svelte");
    if (allDeps["next"]) stack.frameworks.push("Next.js");
    if (allDeps["nuxt"]) stack.frameworks.push("Nuxt");
    if (allDeps["express"]) stack.frameworks.push("Express");
    if (allDeps["fastify"]) stack.frameworks.push("Fastify");
    if (allDeps["@nestjs/core"]) stack.frameworks.push("NestJS");

    // Test
    if (allDeps["jest"] || allDeps["@jest/core"]) stack.testFrameworks.push("Jest");
    if (allDeps["vitest"]) stack.testFrameworks.push("Vitest");
    if (allDeps["mocha"]) stack.testFrameworks.push("Mocha");
    if (allDeps["cypress"]) stack.testFrameworks.push("Cypress");
    if (allDeps["playwright"] || allDeps["@playwright/test"]) stack.testFrameworks.push("Playwright");

    // Bundler
    if (allDeps["webpack"] || allDeps["webpack-cli"]) stack.bundler = "webpack";
    else if (allDeps["vite"]) stack.bundler = "vite";
    else if (allDeps["rollup"]) stack.bundler = "rollup";
    else if (allDeps["esbuild"]) stack.bundler = "esbuild";
    else if (allDeps["parcel"]) stack.bundler = "parcel";
  }

  // Python
  if (
    exists(path.join(ROOT, "requirements.txt")) ||
    exists(path.join(ROOT, "pyproject.toml")) ||
    exists(path.join(ROOT, "setup.py")) ||
    exists(path.join(ROOT, "Pipfile"))
  ) {
    stack.languages.push("Python");
    const req = readText(path.join(ROOT, "requirements.txt")) || "";
    const pyproj = readText(path.join(ROOT, "pyproject.toml")) || "";
    const combined = req + pyproj;
    if (/django/i.test(combined)) stack.frameworks.push("Django");
    if (/flask/i.test(combined)) stack.frameworks.push("Flask");
    if (/fastapi/i.test(combined)) stack.frameworks.push("FastAPI");
    if (/pytest/i.test(combined)) stack.testFrameworks.push("pytest");
    if (/unittest/i.test(combined)) stack.testFrameworks.push("unittest");
  }

  // Java / Maven / Gradle
  if (exists(path.join(ROOT, "pom.xml"))) {
    stack.languages.push("Java");
    stack.packageManager = "Maven";
    const pom = readText(path.join(ROOT, "pom.xml")) || "";
    if (/spring/i.test(pom)) stack.frameworks.push("Spring");
    if (/junit/i.test(pom)) stack.testFrameworks.push("JUnit");
  } else if (
    exists(path.join(ROOT, "build.gradle")) ||
    exists(path.join(ROOT, "build.gradle.kts"))
  ) {
    stack.languages.push("Java/Kotlin");
    stack.packageManager = "Gradle";
  }

  // Go
  if (exists(path.join(ROOT, "go.mod"))) {
    stack.languages.push("Go");
    const gomod = readText(path.join(ROOT, "go.mod")) || "";
    if (/gin-gonic/i.test(gomod)) stack.frameworks.push("Gin");
    if (/echo/i.test(gomod)) stack.frameworks.push("Echo");
    if (/fiber/i.test(gomod)) stack.frameworks.push("Fiber");
  }

  // Rust
  if (exists(path.join(ROOT, "Cargo.toml"))) {
    stack.languages.push("Rust");
    const cargo = readText(path.join(ROOT, "Cargo.toml")) || "";
    if (/actix/i.test(cargo)) stack.frameworks.push("Actix");
    if (/axum/i.test(cargo)) stack.frameworks.push("Axum");
  }

  // Container / CI
  if (exists(path.join(ROOT, "Dockerfile"))) stack.containerized = true;
  if (exists(path.join(ROOT, "docker-compose.yml")) || exists(path.join(ROOT, "docker-compose.yaml")))
    stack.containerized = true;
  if (exists(path.join(ROOT, ".github/workflows"))) stack.cicd.push("GitHub Actions");
  if (exists(path.join(ROOT, ".gitlab-ci.yml"))) stack.cicd.push("GitLab CI");
  if (exists(path.join(ROOT, "Jenkinsfile"))) stack.cicd.push("Jenkins");
  if (exists(path.join(ROOT, ".travis.yml"))) stack.cicd.push("Travis CI");

  return stack;
}

// ─── Dependency Extraction ────────────────────────────────────────────────────

function extractDependencies() {
  const deps = { runtime: [], dev: [], peer: [] };

  const pkg = readJSON(path.join(ROOT, "package.json"));
  if (pkg) {
    deps.runtime = Object.keys(pkg.dependencies || {});
    deps.dev = Object.keys(pkg.devDependencies || {});
    deps.peer = Object.keys(pkg.peerDependencies || {});
    return deps;
  }

  const req = readText(path.join(ROOT, "requirements.txt"));
  if (req) {
    deps.runtime = req
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split(/[>=<!]/)[0].trim());
    return deps;
  }

  const gomod = readText(path.join(ROOT, "go.mod"));
  if (gomod) {
    const requireBlock = gomod.match(/require\s*\(([\s\S]*?)\)/g) || [];
    requireBlock.forEach((block) => {
      block
        .replace(/require\s*\(/, "")
        .replace(/\)/, "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("//"))
        .forEach((l) => deps.runtime.push(l.split(" ")[0]));
    });
    return deps;
  }

  return deps;
}

// ─── Export Surface Extraction ────────────────────────────────────────────────

const EXPORT_PATTERNS = {
  js: [
    /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
    /export\s+\{([^}]+)\}/g,
    /module\.exports\s*=\s*\{([^}]*)\}/g,
  ],
  py: [
    /^def\s+(\w+)\s*\(/gm,
    /^class\s+(\w+)/gm,
  ],
  java: [
    /public\s+(?:static\s+)?(?:class|interface|enum)\s+(\w+)/g,
    /public\s+(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/g,
  ],
  go: [
    /^func\s+([A-Z]\w*)\s*\(/gm,
    /^type\s+([A-Z]\w*)\s+(?:struct|interface)/gm,
  ],
  rs: [
    /^pub\s+(?:fn|struct|enum|trait|type)\s+(\w+)/gm,
  ],
};

function getExportPatterns(ext) {
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs"].includes(ext)) return EXPORT_PATTERNS.js;
  if (ext === ".py") return EXPORT_PATTERNS.py;
  if ([".java", ".kt"].includes(ext)) return EXPORT_PATTERNS.java;
  if (ext === ".go") return EXPORT_PATTERNS.go;
  if (ext === ".rs") return EXPORT_PATTERNS.rs;
  return [];
}

function extractExports(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const patterns = getExportPatterns(ext);
  if (!patterns.length) return [];

  const content = readText(filePath);
  if (!content || content.length > 100_000) return []; // skip huge files

  const symbols = new Set();
  for (const pattern of patterns) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(content)) !== null) {
      const captured = match[1];
      if (!captured) continue;
      // Handle grouped exports like { foo, bar }
      if (captured.includes(",")) {
        captured.split(",").forEach((s) => {
          const name = s.trim().split(/\s+as\s+/)[0].trim();
          if (name) symbols.add(name);
        });
      } else {
        symbols.add(captured.trim());
      }
    }
  }
  return [...symbols].slice(0, 30); // cap per file
}

// ─── Source File Index ────────────────────────────────────────────────────────

function indexSourceFiles() {
  const sourceExts = new Set([
    ".js", ".jsx", ".ts", ".tsx", ".mjs",
    ".py", ".java", ".kt", ".go", ".rs", ".rb", ".php", ".cs", ".swift",
    ".vue", ".svelte",
  ]);

  const files = [];
  const MAX_FILES = 500;

  function walk(dir) {
    if (files.length >= MAX_FILES) return;
    let items;
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      if (files.length >= MAX_FILES) return;
      if (item.name.startsWith(".")) continue;
      if (ALWAYS_SKIP_DIRS.has(item.name)) continue;
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(fullPath);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (!sourceExts.has(ext)) continue;
        const exports = extractExports(fullPath);
        const entry = { path: rel(fullPath) };
        if (exports.length) entry.exports = exports;
        files.push(entry);
      }
    }
  }

  walk(ROOT);
  return files;
}

// ─── Git Info ─────────────────────────────────────────────────────────────────

function getGitInfo() {
  const gitDir = path.join(ROOT, ".git");
  if (!exists(gitDir)) return null;

  const info = {};
  const headContent = readText(path.join(gitDir, "HEAD"));
  if (headContent) {
    const branchMatch = headContent.match(/ref: refs\/heads\/(.+)/);
    info.branch = branchMatch ? branchMatch[1].trim() : "detached HEAD";
  }

  // Recent commits from COMMIT_EDITMSG (last commit message only — no exec needed)
  const lastMsg = readText(path.join(gitDir, "COMMIT_EDITMSG"));
  if (lastMsg) info.lastCommitMessage = lastMsg.trim();

  return info;
}

// ─── Project Conventions ─────────────────────────────────────────────────────

function detectConventions() {
  const conventions = {};

  // Linting
  if (
    exists(path.join(ROOT, ".eslintrc")) ||
    exists(path.join(ROOT, ".eslintrc.js")) ||
    exists(path.join(ROOT, ".eslintrc.json")) ||
    exists(path.join(ROOT, ".eslintrc.yml"))
  )
    conventions.linter = "ESLint";
  if (exists(path.join(ROOT, ".prettierrc")) || exists(path.join(ROOT, "prettier.config.js")))
    conventions.formatter = "Prettier";
  if (exists(path.join(ROOT, "pyproject.toml"))) {
    const content = readText(path.join(ROOT, "pyproject.toml")) || "";
    if (/\[tool\.black\]/.test(content)) conventions.formatter = "Black";
    if (/\[tool\.ruff\]/.test(content)) conventions.linter = "Ruff";
  }

  // TypeScript config
  const tsconfig = readJSON(path.join(ROOT, "tsconfig.json"));
  if (tsconfig) {
    conventions.strictMode = tsconfig.compilerOptions?.strict === true;
    conventions.moduleSystem = tsconfig.compilerOptions?.module || null;
  }

  // Package scripts
  const pkg = readJSON(path.join(ROOT, "package.json"));
  if (pkg?.scripts) {
    conventions.scripts = Object.keys(pkg.scripts);
  }

  return conventions;
}

// ─── README Summary ───────────────────────────────────────────────────────────

function extractReadmeSummary() {
  const readme =
    readText(path.join(ROOT, "README.md")) ||
    readText(path.join(ROOT, "README")) ||
    readText(path.join(ROOT, "readme.md"));
  if (!readme) return null;

  // First non-empty paragraph after any headings
  const lines = readme.split("\n");
  const summary = [];
  let capturing = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (capturing && summary.length > 0) break;
      continue;
    }
    if (trimmed.startsWith("#")) {
      if (summary.length > 0) break;
      capturing = true;
      continue;
    }
    if (capturing || summary.length === 0) {
      capturing = true;
      summary.push(trimmed);
      if (summary.join(" ").length > 500) break;
    }
  }

  return summary.join(" ").slice(0, 600) || null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Indexing project at: ${ROOT}`);

  const pkg = readJSON(path.join(ROOT, "package.json"));
  const projectName = pkg?.name || path.basename(ROOT);
  const projectVersion = pkg?.version || null;

  const context = {
    _meta: {
      generated: new Date().toISOString(),
      generator: "project-indexer",
      version: "1.0.0",
      root: ROOT,
    },
    project: {
      name: projectName,
      version: projectVersion,
      description: pkg?.description || extractReadmeSummary(),
    },
    stack: detectStack(),
    git: getGitInfo(),
    conventions: detectConventions(),
    dependencies: extractDependencies(),
    fileTree: walkTree(ROOT),
    sourceFiles: indexSourceFiles(),
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(context, null, 2), "utf8");

  const stats = {
    sourceFiles: context.sourceFiles.length,
    dependencies: context.dependencies.runtime.length,
    treeEntries: context.fileTree.length,
  };

  console.log(`✓ project-context.json written to ${OUTPUT}`);
  console.log(`  Source files indexed : ${stats.sourceFiles}`);
  console.log(`  Runtime dependencies : ${stats.dependencies}`);
  console.log(`  Stack detected       : ${context.stack.languages.join(", ")}`);
  if (context.stack.frameworks.length)
    console.log(`  Frameworks           : ${context.stack.frameworks.join(", ")}`);
}

main();

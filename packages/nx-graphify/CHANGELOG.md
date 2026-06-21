## 0.4.0 (2026-06-21)

### 🚀 Features

- ⚠️ **nx-graphify:** remove graphify-workspace, root project covers it ([a09391e](https://github.com/fennet82/nx-plugins/commit/a09391e))
- **nx-graphify:** init registers the plugin in nx.json regardless of agents ([ca0e3b9](https://github.com/fennet82/nx-plugins/commit/ca0e3b9))

### 🩹 Fixes

- **nx-graphify:** register plugin as object in nx.json, fix outputDir mismatch bug ([014ec63](https://github.com/fennet82/nx-plugins/commit/014ec63))
- **nx-graphify:** drop --project from extraction args, remove unused projectName param ([dbc9925](https://github.com/fennet82/nx-plugins/commit/dbc9925))
- **nx-graphify:** use --platform (singular) for init, omit it when no agents given ([e6ce0b9](https://github.com/fennet82/nx-plugins/commit/e6ce0b9))

### ⚠️ Breaking Changes

- **nx-graphify:** remove graphify-workspace, root project covers it ([a09391e](https://github.com/fennet82/nx-plugins/commit/a09391e))
  the graphify-workspace executor and its inferred target
  are removed. Every Nx workspace root has a package.json (if only to
  depend on its own plugins), and package.json requires a "name" field, so
  the root is always inferred as a project too — meaning it already gets
  its own `graphify` target, which behaves identically to the old
  graphify-workspace (verified earlier by diffing their actual CLI
  invocations: same command, same cwd). There's no longer a separate
  "whole workspace" target; run `graphify` on the root project instead.
  Removed: src/executors/graphify-workspace/ entirely, its entry in
  executors.json, and the projectRoot === '.' special-casing in
  plugin/index.ts that attached it. plugin/index.spec.ts's dedicated test
  is replaced with one confirming the root project gets a plain `graphify`
  target like any other project.
  Docs (root README.md, packages/nx-graphify/README.md) updated to drop
  all graphify-workspace references and explain running `graphify` on the
  root project instead.

### ❤️ Thank You

- elad cohen @fennet82

## 0.3.0 (2026-06-21)

### 🩹 Fixes

- **nx-graphify:** set publishConfig.access public to fix provenance error ([0ce3567](https://github.com/fennet82/nx-plugins/commit/0ce3567))

### ❤️ Thank You

- elad cohen @fennet82

## 0.2.0 (2026-06-21)

### 🚀 Features

- **nx-graphify:** rewrite e2e with @nx/plugin/testing, fix executor package name ([c81cf5d](https://github.com/fennet82/nx-plugins/commit/c81cf5d))
- **nx-graphify:** infer purge target on every project, forward provider option ([7fa6b13](https://github.com/fennet82/nx-plugins/commit/7fa6b13))
- **nx-graphify:** add purge executor ([6879789](https://github.com/fennet82/nx-plugins/commit/6879789))
- **nx-graphify:** document provider.backend/model in executor schemas ([881792f](https://github.com/fennet82/nx-plugins/commit/881792f))
- **nx-graphify:** add provider.backend/provider.model extraction option ([764613d](https://github.com/fennet82/nx-plugins/commit/764613d))
- **nx-graphify:** add uninstall-agents generator ([668c84a](https://github.com/fennet82/nx-plugins/commit/668c84a))

### 🩹 Fixes

- **nx-graphify:** commit package rename to @fennet82/nx-graphify, fix temp dir leak ([ba428dc](https://github.com/fennet82/nx-plugins/commit/ba428dc))
- **nx-graphify:** pass --project on init install, fix wrong throw assertions ([7c5571e](https://github.com/fennet82/nx-plugins/commit/7c5571e))

### ❤️ Thank You

- Claude Sonnet 4.6
- elad cohen @fennet82

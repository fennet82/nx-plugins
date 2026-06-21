# nx-plugins

A collection of third-party Nx plugins. Currently contains `@fennet82/nx-graphify`,
an Nx plugin that wraps the [graphify](https://github.com/safishamsi/graphify) CLI
as a self-inferring plugin.

## Structure

```
packages/nx-graphify/   the published plugin (@fennet82/nx-graphify)
  src/
    executors/          graphify, graphify-workspace, purge
    generators/         init, uninstall-agents
    plugin/             createNodes target inference
    utils/              shared CLI-arg building, agent/backend enums
e2e/
  nx-graphify/           e2e tests for @fennet82/nx-graphify (@nx/plugin/testing)
docs/superpowers/
  specs/                 design specs
  plans/                 implementation plans
```

See [docs/superpowers/specs](./docs/superpowers/specs) for design specs and
[docs/superpowers/plans](./docs/superpowers/plans) for implementation plans.

## Setup

Register the plugin in your `nx.json`:

```json
{
  "plugins": ["@fennet82/nx-graphify/plugin"]
}
```

This infers:

- a `graphify` target on every project
- a `graphify-workspace` target on the workspace root only
- a `purge` target on every project, including the workspace root

## Commands

| Command | What it runs |
| --- | --- |
| `nx run <project>:graphify` | `graphify <projectRoot> [flags] --project <project>` |
| `nx run <root>:graphify-workspace` | `graphify <workspaceRoot> [flags] --project <root>` |
| `nx run <project>:purge` | `graphify uninstall --project --purge` (cwd = that project's root) |
| `nx g @fennet82/nx-graphify:init --installAgent=claude` | `graphify install --project --platforms claude` |
| `nx g @fennet82/nx-graphify:uninstall-agents --agent=claude` | `graphify uninstall --project --platform claude` |

`init` and `uninstall-agents` always run from the workspace root and always
pass graphify's `--project` flag (graphify's own project-vs-global install
distinction — unrelated to the value-taking `--project <name>` flag used by
the extraction targets above). `purge` can run on any project or the
workspace root, since each cleans only that project's own `graphify-out`
directory.

Extraction targets (`graphify`/`graphify-workspace`) also accept a nested
`provider` option to select an LLM backend:

```json
{
  "targets": {
    "graphify": {
      "options": {
        "provider": { "backend": "openai", "model": "gpt-4" }
      }
    }
  }
}
```

`provider.backend` is one of `azure`, `bedrock`, `claude`, `claude-cli`,
`deepseek`, `gemini`, `kimi`, `ollama`, `openai`. `provider.model` is
free-text and only valid alongside `provider.backend`.

## Development

```bash
pnpm install
npx nx build nx-graphify
npx nx test nx-graphify
npx nx e2e nx-graphify-e2e
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contributor workflow
and [RELEASE.md](./RELEASE.md) for the release process.

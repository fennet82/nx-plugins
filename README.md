# nx-plugins

A collection of third-party Nx plugins. Currently contains `@fennet82/nx-graphify`,
an Nx plugin that wraps the [graphify](https://github.com/safishamsi/graphify) CLI
as a self-inferring plugin.

## Structure

```
packages/nx-graphify/   the published plugin (@fennet82/nx-graphify)
  src/
    generators/         init, agents
    plugin/             createNodes target inference (command-based, no executors)
    utils/              agent-platform enum, graphify-installed check
e2e/
  nx-graphify-e2e/       e2e tests for @fennet82/nx-graphify (@nx/plugin/testing)
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
  "plugins": [
    {
      "plugin": "@fennet82/nx-graphify/plugin",
      "options": {
        "genTarget": { "name": "graphify:gen" },
        "updateTarget": { "name": "graphify:update" },
        "queryTarget": { "name": "graphify:query" },
        "pathTarget": { "name": "graphify:path" },
        "explainTarget": { "name": "graphify:explain" },
        "prsTarget": { "name": "graphify:prs" },
        "purgeTarget": { "name": "graphify:purge" }
      }
    }
  ]
}
```

Or run `nx g @fennet82/nx-graphify:init`, which writes the above for you.

This infers 7 command-based targets on every project (including the
workspace root): `graphify:gen`, `graphify:update`, `graphify:query`,
`graphify:path`, `graphify:explain`, `graphify:prs`, `graphify:purge`. Each
target's name and its `args`/`env`/`cwd` are configurable — see
[packages/nx-graphify/README.md](./packages/nx-graphify/README.md) for the
full reference. Note that per-configuration overrides replace rather than
merge with a target's base `args`/`env`/`envFile`/`cwd`.

## Commands

| Command                                                      | What it runs                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `nx run <project>:graphify:gen`                              | `graphify extract . [args]`                                                              |
| `nx run <project>:graphify:update`                           | `graphify update . [args]`                                                               |
| `nx run <project>:graphify:query -- "<question>"`            | `graphify query "<question>" [args]`                                                     |
| `nx run <project>:graphify:path -- "A" "B"`                  | `graphify path "A" "B" [args]`                                                           |
| `nx run <project>:graphify:explain -- "X"`                   | `graphify explain "X" [args]`                                                            |
| `nx run <project>:graphify:prs`                              | `graphify prs [args]`                                                                    |
| `nx run <project>:graphify:purge`                            | `graphify uninstall --project --purge [args]` (cwd = that project's root)                |
| `nx g @fennet82/nx-graphify:init`                            | registers the plugin in `nx.json` (warns, doesn't fail, if graphify isn't installed yet) |
| `nx g @fennet82/nx-graphify:agents install --agent=claude`   | `graphify install --project --platform claude`                                           |
| `nx g @fennet82/nx-graphify:agents uninstall --agent=claude` | `graphify uninstall --project --platform claude`                                         |

All graphify-specific configuration (backend, model, mode, etc.) is passed
as raw CLI args via each target's `args` option — there's no separate typed
schema to keep in sync with graphify's own flags.

## Development

```bash
pnpm install
npx nx build nx-graphify
npx nx test nx-graphify
npx nx e2e nx-graphify-e2e
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contributor workflow
and [RELEASE.md](./RELEASE.md) for the release process.

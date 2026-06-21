# Contributing

PRs are welcome and encouraged in this repository. Read this document to see how to contribute.

## Table of Contents

- [Project Structure](#project-structure)
- [Setup](#setup)
- [Building a Plugin](#building-a-plugin)
- [Running Unit Tests](#running-unit-tests)
- [Running e2e Tests](#running-e2e-tests)
- [Testing a Plugin Locally](#testing-a-plugin-locally)
- [Pull Requests](#pull-requests)

## Project Structure

This is an Nx workspace managed with **pnpm**. See [README.md](./README.md#structure)
for the directory layout. Each plugin lives under `packages/<plugin-name>`
with its own `package.json`; e2e tests for a plugin live under
`e2e/<plugin-name>-e2e`.

## Setup

```bash
pnpm install
```

## Building a Plugin

```bash
npx nx build <plugin-name>
```

For example: `npx nx build nx-graphify`.

## Running Unit Tests

```bash
npx nx test <plugin-name>
```

## Running e2e Tests

e2e projects are named `<plugin-name>-e2e`:

```bash
npx nx e2e <plugin-name>-e2e
```

For example: `npx nx e2e nx-graphify-e2e`. e2e tests build the plugin from
source and exercise its generators/executors against a real, disposable Nx
workspace via `@nx/plugin/testing` (`ensureNxProject`, `runNxCommandAsync`,
etc.) — no network calls or external registry are required.

## Testing a Plugin Locally

To try a plugin in a separate, real workspace without publishing it:

1. Build the plugin: `npx nx build <plugin-name>`
2. Start the local Verdaccio registry: `npx nx local-registry`
3. In another terminal, publish to it: `cd packages/<plugin-name>/dist && npm publish --registry http://localhost:4873`
4. In your test workspace: `pnpm add -D <package-name> --registry http://localhost:4873`

## Continuous Integration

Every push to `master` and every pull request runs `.github/workflows/ci.yml`,
which lints, tests, builds, and runs e2e for whatever projects are affected
by the change (via `nx affected`). Dependabot (`.github/dependabot.yml`)
opens dependency-update PRs weekly for both npm packages and GitHub Actions.

## Pull Requests

Ensure that you have completed the PR checklist in the
[pull request template](PULL_REQUEST_TEMPLATE.md) prior to opening a pull
request. At minimum, `npx nx test`, `npx nx lint`, and `npx nx build` should
pass for every project affected by your change — CI will verify this
automatically once you open the PR.

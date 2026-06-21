# Release Process

This document outlines the process for releasing packages from this
repository using GitHub Actions (`.github/workflows/publish.yml`).

## Prerequisites

### NPM Access Token

Publishing uses a classic npm access token, not OIDC trusted publishing.

1. Go to [npmjs.com](https://npmjs.com), log in, and open your profile
2. **Access Tokens** → **Generate New Token** → **Granular Access Token**
3. Grant it **Read and write** permission, scoped to the `@fennet82/nx-graphify`
   package (or the `fennet82` org/scope, if you want it to cover future
   packages too)
4. In the GitHub repository, go to **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**
5. Name it `NPM_ACCESS_TOKEN` and paste the token value

### Required Permissions

The publish workflow requires these permissions (already set in
`publish.yml`):

- `contents: write` - to commit the version bump + changelog, create the git tag, push both back to the repo, and create the GitHub Release
- `id-token: write` - to generate npm provenance attestations during publish

No separate token is needed for the GitHub Release step — it uses the
default `GITHUB_TOKEN` Actions provides automatically, scoped by the
`contents: write` permission above.

## Release Process

### Automated Release via GitHub Actions

1. Go to the **Actions** tab in GitHub
2. Select the **Publish** workflow
3. Click **Run workflow**
4. Choose the version bump type:
   - **patch**: Bug fixes (0.0.x)
   - **minor**: New features (0.x.0)
   - **major**: Breaking changes (x.0.0)
   - **prerelease**: Alpha/beta versions (0.0.x-alpha.0)
5. Leave **first_release** unchecked (only check it for the very first
   release ever, when no git tag exists yet — see below)
6. Click **Run workflow**

The workflow does NOT separately lint/test/build — CI (`ci.yml`) already
gates every push/PR to `master`, and `nx.json`'s
`release.version.preVersionCommand` (`nx run-many -t build`) builds
everything again right before versioning. The single
`nx release <bump> --yes` command then:

- Versions the package(s) and updates their `package.json`
- Generates/updates a **per-project** `CHANGELOG.md` (e.g.
  `packages/nx-graphify/CHANGELOG.md`) from conventional commits since the
  last release
- Commits, tags, and pushes (`release.git.commit`/`tag`/`push` in `nx.json`)
- Creates a **GitHub Release** for the new tag, using the generated
  changelog entry as the release notes
  (`release.changelog.projectChangelogs.createRelease: "github"`)
- Publishes to npm with provenance (`NPM_CONFIG_PROVENANCE: true`)

### First Release

The very first time you run this workflow, there's no prior git tag for Nx
to diff against, so the run will fail unless you check the **first_release**
checkbox in the workflow's inputs. After that first run, leave it
unchecked for every subsequent release.

### What Gets Published

`nx.json`'s `release.projects` is `["*", "!@fennet82/nx-plugins", "!nx-graphify-e2e"]`
— every project except the workspace root pseudo-project and the e2e test
project. In practice this is just `@fennet82/nx-graphify` today; any new
plugin added under `packages/` is automatically included.

### Security Features

- **Provenance**: `NPM_CONFIG_PROVENANCE: true` plus `id-token: write` makes npm generate provenance attestations for the published package
- **Scoped token**: the npm access token should be scoped to only the packages this repo publishes, not your whole npm account

### Manual Release (Fallback)

If needed, you can release manually from your own machine (requires being
logged in to npm locally, e.g. via `npm login`, and to GitHub via an
authenticated `gh` CLI for the GitHub Release step):

1. Install dependencies: `pnpm install`
2. Run the whole pipeline: `npx nx release patch` (replace `patch` with
   `minor`/`major`/`prerelease` as needed; add `--first-release` only for
   the very first release)

## Troubleshooting

### Authentication Errors

If you see `401`/`403` errors from npm during publish:

1. Verify the `NPM_ACCESS_TOKEN` secret is set and hasn't expired
2. Confirm the token has write access to `@fennet82/nx-graphify`
3. Verify the package exists on npmjs.com (first publish must be done manually if the package name has never been published before)

### "Can't generate provenance for new or private package"

Scoped packages (`@fennet82/...`) default to npm's `restricted` access
unless told otherwise. The top-level `nx release` command doesn't expose
an `--access` flag, so this is set in each package's own `package.json`
via `publishConfig.access: "public"` instead — check that field is
present if you see this error for a new package.

### Push Errors During Versioning

If the git push (`release.git.push` in `nx.json`) fails:

- Check branch protection rules on `master` allow the `github-actions[bot]` actor (or the token used) to push directly
- Ensure no other release run is in progress (the workflow uses a `publish` concurrency group to serialize runs)

### GitHub Release Not Created

If versioning/publishing succeeds but no GitHub Release appears:

- Confirm `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` is set in the publish step's `env` and the job has `contents: write` permission
- Nx Release doesn't support creating GitHub Releases for both project-level and workspace-level changelogs at once — `nx.json` sets `release.changelog.workspaceChangelog: false` so only the per-project one is used

### Version Conflicts

If versioning fails:

- Check for uncommitted changes in the repository
- Verify the base branch (`master`) is up to date

## Package Information

### @fennet82/nx-graphify

- **Current version**: 0.1.0
- **Description**: Nx self-inferring plugin for Graphify — build knowledge graphs from your monorepo projects
- **NPM**: https://www.npmjs.com/package/@fennet82/nx-graphify
- **Changelog**: `packages/nx-graphify/CHANGELOG.md` (generated, committed automatically by each release)

## Continuous Integration

`.github/workflows/ci.yml` runs on every push to `master` and on pull
requests: it lints, tests, builds, and runs e2e for every *affected*
project, using `nx-set-shas` to compute the diff base. `nx-graphify-e2e`
declares `@fennet82/nx-graphify` as an implicit dependency, so it's always
included whenever the plugin changes, not just when the e2e project's own
files change.

`.github/dependabot.yml` checks for npm and GitHub Actions dependency
updates weekly.

## Conventional Commits

This project uses conventional commits for automatic versioning:

- `feat:` → Minor version bump
- `fix:` → Patch version bump
- `feat!:` or `BREAKING CHANGE:` → Major version bump
- `docs:`, `style:`, `refactor:`, `test:`, `chore:` → Patch version bump

Example commit messages:

```
feat(nx-graphify): add provider.backend/provider.model extraction option
fix(nx-graphify): pass --project on init install
docs: update README with new examples
```

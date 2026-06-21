# Release Process

This document outlines the intended process for releasing packages from this
repository using GitHub Actions with NPM OIDC Trusted Publishing.

## Prerequisites

### NPM Trusted Publishing Setup

For each package, you must configure NPM Trusted Publishing on npmjs.com:

1. Go to [npmjs.com](https://npmjs.com) and log in
2. Navigate to the package:
   - `@fennet82/nx-graphify`
3. Go to **Settings** → **Publishing Access**
4. Click **Add Trusted Publisher**
5. Select **GitHub Actions**
6. Configure with these values:
   - **Organization/User**: `fennet82`
   - **Repository**: `nx-plugins`
   - **Workflow file**: `publish.yml`
   - **Environment name**: Leave empty (optional)

### Required Permissions

The GitHub Actions workflow requires these permissions:

- `contents: write` - To push version tags and commits
- `id-token: write` - To generate OIDC tokens for NPM publishing

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
5. Click **Run workflow**

The workflow should:

- Install dependencies
- Run tests and linting for affected packages
- Version affected packages using conventional commits
- Build packages for publishing
- Publish to NPM using OIDC (no tokens required)
- Push version tags to Git
- Create GitHub releases

### What Gets Published

Only **affected packages** are published. The workflow uses:

```bash
nx affected --target=version --releaseAs=<version-type>
```

This means:

- Only packages that have changes since the last release are versioned and published
- Unchanged packages are skipped automatically
- Each package maintains independent versioning

### Security Features

- **No NPM tokens required**: Uses OIDC for secure authentication
- **Automatic provenance**: NPM automatically generates provenance attestations
- **Workflow-specific credentials**: Each publish uses ephemeral, workflow-specific tokens
- **Optional Nx Cloud integration**: Can enable distributed task execution (paid feature)

### Manual Release (Fallback)

If needed, you can release manually:

1. Install dependencies: `pnpm install`
2. Version packages: `npx nx affected --target=version --releaseAs=patch`
3. Build packages: `npx nx affected --target=build`
4. Manually publish from `dist/packages/<package-name>`: `npm publish --access public --provenance`

## Troubleshooting

### OIDC Authentication Errors

If you see authentication errors:

1. Verify NPM Trusted Publishing is configured correctly
2. Ensure the workflow filename matches exactly (`publish.yml`)
3. Check that the repository name is correct (`fennet82/nx-plugins`)
4. Verify the package exists on npmjs.com

### No Packages Published

If no packages are published:

- Check if there are actual changes since the last release
- Review the "affected" detection by running: `npx nx show projects --affected --base=HEAD~1`
- Ensure packages have been built successfully

### Version Conflicts

If versioning fails:

- Check for uncommitted changes in the repository
- Verify Git configuration is correct
- Ensure the base branch (master) is up to date

## Package Information

### @fennet82/nx-graphify

- **Current version**: 0.1.0
- **Description**: Nx self-inferring plugin for Graphify — build knowledge graphs from your monorepo projects
- **NPM**: https://www.npmjs.com/package/@fennet82/nx-graphify

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

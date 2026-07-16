# @orgsdk/plugin-linkedin

Official OrgSDK plugin for [LinkedIn](https://www.linkedin.com) — publish and
manage content from agent workflows: read the authenticated profile, list the
organization pages you administer, post (personal or organization, with optional
link card), pull engagement analytics, and delete posts. OAuth2 (BYO client),
with per-account `credentialName` threading for multi-account setups.

[![CI](https://github.com/OrgSDK/orgsdk-plugin-linkedin/actions/workflows/ci.yml/badge.svg)](https://github.com/OrgSDK/orgsdk-plugin-linkedin/actions/workflows/ci.yml)

## Repository layout

```
orgsdk-plugin-linkedin/
├── .github/workflows/
│   ├── ci.yml                 # calls the shared reusable CI workflow (OrgSDK/plugins)
│   └── publish-catalog.yml    # calls the shared reusable publish workflow (opt-in; manual dry-run)
├── plugin/                    # the publishable plugin folder
│   ├── .plugin.json           # manifest (slug, version, auth, marketplace)
│   ├── index.ts               # entry — factory(ctx) → PluginModule
│   ├── auth-provider.ts       # OAuth2 auth provider (dashboard credential flow + callback)
│   ├── linkedin-functions.ts  # safe functions
│   ├── oauth.ts               # token refresh helpers
│   └── docs/overview.md       # plugin-local docs
├── tests/                     # bun:test — manifest, source purity, plugin shape, packaging
├── docs/                      # contract migration, release/promotion contract
├── package.json
├── tsconfig.json
├── biome.json
└── README.md
```

The `plugin/` folder is the canonical source for the LinkedIn plugin; it is
published to the OrgSDK catalog on merge to `main` when opted in via the
`ORGSDK_ENABLE_CATALOG_PUBLISH` repo variable (see [docs/release.md](docs/release.md)).

## Local development

Requires [Bun](https://bun.sh) ≥ 1.3.x.

```bash
# Install (frozen lockfile in CI; dev: generates one)
bun install

# Lint + format check
bun run check

# Typecheck (no emit)
bun run typecheck

# Run tests
bun run test

# Validate manifest + source purity (orgsdk-plugin validate)
bun run validate

# Stage distributable artifact into dist/ (orgsdk-plugin package)
bun run package

# Full build pipeline (typecheck → validate → package)
bun run build
```

The `validate`, `package`, `version-guard`, and `publish` npm scripts delegate to
the [`orgsdk-plugin`](https://www.npmjs.com/package/@orgsdk/plugins) CLI shipped
by the `@orgsdk/plugins` dev dependency. There are no local management scripts.

## Functions

| Function | Purpose | Mode |
|---|---|---|
| `getProfile` | Get the authenticated member's profile. | readonly |
| `getOrganizations` | List organization pages you administer. | readonly |
| `createPost` | Publish a post (text + optional link card). | write |
| `getPostAnalytics` | Pull engagement metrics for a post. | readonly |
| `deletePost` | Delete a post (irreversible). | write/destructive |

All functions require the `linkedin-oauth` credential.

## Manifest & version rules

- The manifest lives at `plugin/.plugin.json`.
- `version` is the **source of truth** for the catalog — bump it on every
  publishable content change (the CI version guard enforces this).
- `package.json` → `version` is kept in sync with the manifest (enforced by
  the version guard).
- Versions are **write-once** in the catalog: re-publishing the same
  `(slug, version)` with identical content is idempotent; differing content is
  rejected (HTTP 409). Treat every publish as forward-only.
- See [docs/release.md](docs/release.md) for the automatic publish model and
  required repository settings.

## CI/CD

CI and catalog publishing delegate to centrally maintained **reusable
workflows** in [OrgSDK/plugins](https://github.com/OrgSDK/plugins), pinned to an
immutable commit. The caller workflows (`.github/workflows/`) only wire up
triggers, the opt-in gate, artifact names, and secrets — no plugin mechanics are
duplicated. See the
[reusable-workflows docs](https://github.com/OrgSDK/plugins/blob/main/docs/reusable-workflows.md)
for the full contract.

## Security constraints

- LinkedIn OAuth tokens are injected at call time via `requiredCredentials:
  ["linkedin-oauth"]` — they are **never** hardcoded, logged, or persisted in
  plugin source. The bundle flows through the daemon's `CredentialStore`.
- The OAuth client (`client_id` / `client_secret`) is stored under the
  `linkedin-oauth-client` provider; the granted access + refresh tokens under
  `linkedin-oauth`. Plugin handlers receive credentials as a parameter; they
  must not return, log, or store them.
- The access token is refreshed from the stored refresh token before each call
  (LinkedIn access tokens expire after 60 days; refresh tokens last 6 months).
- Source purity is enforced: no imports from private `@orgsdk/*` packages, no
  cross-plugin imports, no runtime value imports from the authoring SDK. The
  `validate` script and `tests/purity.test.ts` guard this.
- Publish credentials (`ORGSDK_PUBLISH_TOKEN`) live as a GitHub secret
  (repository-level or `catalog-publish` environment); they are never committed
  to the repo. See [docs/release.md](docs/release.md).

## Authoring contract

The plugin authoring types come from the public
[`@orgsdk/plugins`](https://www.npmjs.com/package/@orgsdk/plugins) npm package,
imported type-only (`import type { … } from "@orgsdk/plugins"`). The SDK is a
dev-only dependency; the runtime artifact carries **no dependencies** — LinkedIn
uses only platform globals (`fetch`, `URLSearchParams`, `crypto`).
See [docs/contract-migration.md](docs/contract-migration.md).

## Source attribution

Extracted from the OrgSDK monorepo at:

- **Source path:** `packages/plugins/src/linkedin/`
- **LinkedIn source first added (monorepo commit):** `a3cbecf123be62e99b1a9c3b2eef06a5a137977b`
- **Last monorepo commit touching the source:** `608a151686a79b4375f1ea4ffb8cc024c5fb5a23`
- **Monorepo HEAD at extraction:** `0beabb5ad5afa364b51107fdb56b2b263555fef7`

No plugin behavior changed in this extraction — only the type-only import
specifiers (`orgsdk/plugins` → `@orgsdk/plugins`), the manifest `$schema`,
`version`, and `marketplace.links.sourceRepo` were added.

## License

Proprietary — All rights reserved. This source is the confidential property
of OrgSDK. No part of this repository may be reproduced, distributed, or
transmitted in any form without the prior written permission of OrgSDK.
Unauthorized use, modification, or redistribution is strictly prohibited.

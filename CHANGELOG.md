# Changelog

## 1.0.3 (unreleased)

- Pin the authoring/execution packages to 0.2.2/0.1.0, with the tracked executor packaging fixes.
- Build a restricted npm distribution and verify every exported function from the packed artifact through the headless executor.
- Add versioned npm release CI that publishes the exact tested tarball after explicit repository activation.

All notable releases of `@orgsdk/plugin-linkedin` are documented here.

The catalog treats versions as **write-once**: a given `(slug, version)` may be
re-published only with identical artifact content; differing content is
rejected with HTTP 409. Every entry below is therefore forward-only.

## [1.0.2] — standalone repository + artifact-format release

A forward-only patch release that migrates the LinkedIn plugin from the
OrgSDK monorepo (`packages/plugins/src/linkedin/`) into this standalone
repository. **No plugin source behavior changed** — the five safe functions
(`getProfile`, `getOrganizations`, `createPost`, `getPostAnalytics`,
`deletePost`), the OAuth2 auth provider (`linkedin-oauth`) with its
`credentialName` multi-account threading, the token-refresh helpers, the
callback shape, the manifest auth shape, and the runtime surface (no
dependencies — platform globals only) are identical to the monorepo `1.0.1`.

### Why a bump at all?

The repository/package/schema additions alter the **immutable publishable
content** of the staged artifact, even though no plugin *behavior* changed:

- The manifest gains the canonical `$schema` and
  `marketplace.links.sourceRepo` provenance fields.
- The type-only import specifiers changed from `orgsdk/plugins` (monorepo
  workspace) to `@orgsdk/plugins` (public npm SDK). These imports are erased
  at compile time, so they do not affect runtime behavior — but the manifest
  and the generated artifact `package.json` do change.
- The generated artifact `package.json` is now produced by the deterministic
  `orgsdk-plugin package` step (`name: @orgsdk/plugin-linkedin`, `version:
  1.0.2`, no runtime dependencies).

Because catalog versions are write-once, the existing `1.0.1` artifact on
record cannot be re-published with this changed content — it would differ and
be rejected with HTTP 409. Rather than mutate the published history of
`1.0.1`, the new artifact lands as a fresh `1.0.2` entry.

### Changed

- Bump `plugin/.plugin.json` version `1.0.1` → `1.0.2` (catalog source of
  truth).
- Bump `package.json` version `1.0.1` → `1.0.2` (kept in sync; enforced by
  the CI version guard).
- Add `plugin/.plugin.json` `$schema` and `marketplace.links.sourceRepo`.
- Adopt `@orgsdk/plugins@0.2.1` authoring contract (CLI + reusable workflows).
- Convert type-only imports `orgsdk/plugins` → `@orgsdk/plugins`.

### Frozen (unchanged from monorepo 1.0.1)

- All five safe functions — names, parameters, return types, metadata,
  `requiredCredentials: ["linkedin-oauth"]`.
- OAuth2 auth provider — `type: oauth2`, `linkedin-oauth` provider key,
  callback path `/callback`, the **frozen legacy scope set** (`r_liteprofile`,
  `r_emailaddress`, `w_member_social`, `r_organization_social`,
  `w_organization_social`, `r_organization_admin`), client-config resolution
  order, and `credentialName` multi-account threading.
- Token helpers in `oauth.ts` (refresh-token flow; byte-identical to the
  monorepo).
- `docs/overview.md` (verbatim).

> **Scope note.** The frozen scopes are LinkedIn's legacy
> `r_liteprofile` / `r_emailaddress` set, exactly as shipped in the monorepo
> source at extraction. Modernizing them to LinkedIn's current OpenID scopes
> (`openid`/`profile`/`email`, `rw_organization_admin`) is a separate,
> deliberate API change and was intentionally **not** combined with this
> repository extraction (skill learning #10).

## [1.0.1]

- Monorepo release (`packages/plugins/src/linkedin/`). Behavior identical to
  `1.0.2` above; superseded in the catalog by this standalone-repository
  release.

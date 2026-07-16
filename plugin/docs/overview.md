# LinkedIn

Post to LinkedIn — personal profile and organization pages — and pull
engagement analytics. OAuth2 (BYO client). Supports per-account credential
threading for multi-account setups.

## What it does

The `linkedin` plugin publishes text posts (with optional link cards) to a
personal profile or an organization page, retrieves post analytics, lists the
organizations you administer, and fetches your profile. It supports
**multi-account** usage: each credential name targets a distinct LinkedIn
account.

Typical uses:

- **Thought-leadership scheduling** — queue a week of posts across profiles.
- **Company-page automation** — publish product updates to an organization
  page from a workflow.
- **Performance review** — pull analytics into a sheet for reporting.

## Functions

| Function | Purpose |
|---|---|
| `getProfile` | Get the authenticated member's profile. |
| `getOrganizations` | List organizations you administer. |
| `createPost` | Publish a post (text + optional link card). |
| `deletePost` | Delete a post. |
| `getPostAnalytics` | Pull engagement metrics for a post. |

The full function list (parameters, return types) is available via the
`plugins:info` command in the dashboard.

## Credentials

Every function declares `requiredCredentials: ["linkedin-oauth"]`. A LinkedIn
OAuth credential must be connected before any function is callable.

| Provider | Type | Connect method |
|---|---|---|
| `linkedin-oauth` | oauth2 | BYO LinkedIn OAuth app. The granted scopes cover profile, email, member + organization social posting, and org admin. |

Required scopes: `r_liteprofile`, `r_emailaddress`, `w_member_social`,
`r_organization_social`, `w_organization_social`, `r_organization_admin`.

> **Multi-account:** connect additional credentials under different names
> (e.g. `linkedin-oauth/founder`, `linkedin-oauth/company`) and thread the
> chosen `credentialName` per call to post as different accounts.

## Using it in a workflow

```typescript
const profile = await getProfile();

await createPost({
  authorUrn: profile.urn,            // person URN, or an organization URN
  text: "We just shipped agent goals + iteration tracking 🎯",
  visibility: "PUBLIC",
  linkUrl: "https://acme.com/changelog/agent-goals",
  linkTitle: "Agent Goals",
  linkDescription: "Measure what matters, automatically.",
});
```

## Notes

- Posting as an organization requires its URN in `authorUrn` (fetch via
  `getOrganizations`) and the org-scoped permissions above.
- No `guides/` reference yet; agent usage patterns can be added later.

/**
 * LinkedIn OAuth2 helpers.
 *
 * LinkedIn uses a standard OAuth 2.0 authorization code flow with
 * a long-lived refresh token (issued when `prompt=consent` is used).
 */

export interface LinkedInOAuthBundle {
	secret_clientId?: string;
	secret_clientSecret?: string;
	secret_refreshToken?: string;
	secret_accessToken?: string;
	[key: string]: unknown;
}

export function getLinkedInCredentials(
	creds: Record<string, unknown>,
): LinkedInOAuthBundle {
	return (creds["linkedin-oauth"] as LinkedInOAuthBundle | undefined) ?? {};
}

/**
 * Refresh the LinkedIn access token using the stored refresh token.
 * LinkedIn access tokens expire after 60 days; refresh tokens last 6 months.
 */
export async function refreshLinkedInAccessToken(
	bundle: LinkedInOAuthBundle,
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: number }> {
	if (!bundle.secret_clientId || !bundle.secret_clientSecret) {
		throw new Error("Missing LinkedIn OAuth client credentials");
	}
	if (!bundle.secret_refreshToken) {
		throw new Error(
			"Missing LinkedIn refresh token. Connect LinkedIn in the dashboard (Credentials tab).",
		);
	}

	const resp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: bundle.secret_refreshToken,
			client_id: bundle.secret_clientId,
			client_secret: bundle.secret_clientSecret,
		}),
	});

	if (!resp.ok) {
		const errText = await resp.text();
		throw new Error(`LinkedIn token refresh failed: ${resp.status} ${errText}`);
	}

	const data = await resp.json();
	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token ?? undefined,
		expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
	};
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getLinkedInAccessToken(
	creds: Record<string, unknown>,
): Promise<string> {
	const bundle = getLinkedInCredentials(creds);
	// For now, use refresh token flow every time to ensure freshness
	const result = await refreshLinkedInAccessToken(bundle);
	return result.accessToken;
}

/** Native OrgSDK execution snapshots never expose OAuth client or refresh secrets. */
export async function getLinkedInAccessToken(
	credentials: Record<string, unknown>,
): Promise<string> {
	const bundle = credentials["linkedin-oauth"] as
		| { source?: unknown; secret_accessToken?: unknown }
		| undefined;
	if (
		bundle?.source !== "byo" ||
		typeof bundle.secret_accessToken !== "string" ||
		!bundle.secret_accessToken.trim()
	) {
		throw new Error(
			"Missing linkedin-oauth access token. Reconnect Linkedin in OrgSDK.",
		);
	}
	return bundle.secret_accessToken;
}

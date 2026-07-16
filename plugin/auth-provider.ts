import type {
	AuthProvider,
	HttpEndpoint,
	PluginContext,
} from "@orgsdk/plugins";

const STATE_TTL_MS = 10 * 60 * 1000;

interface PendingState {
	credentialName: string;
	createdAt: number;
}

type LinkedInOAuthClientFile = {
	client_id?: string;
	client_secret?: string;
};

export class LinkedInAuthProvider implements AuthProvider {
	readonly type = "oauth2" as const;
	readonly authMeta = {
		displayName: "LinkedIn",
		configField: {
			label: "LinkedIn App Credentials JSON",
			placeholder: '{"client_id": "...", "client_secret": "..."}',
		},
	};
	private readonly pendingStates = new Map<string, PendingState>();
	private readonly ctx: PluginContext;
	private readonly scopes: string[];

	constructor(ctx: PluginContext, scopes: string[]) {
		this.ctx = ctx;
		this.scopes = scopes;
	}

	async initiate(
		credentialName: string,
	): Promise<{ authUrl: string; state: string }> {
		const { clientId, clientSecret } =
			await this.resolveClientConfig(credentialName);
		if (!clientId) {
			throw new Error(
				`LinkedIn OAuth client credentials not configured. ` +
					`Checked linkedin-oauth-client/default, linkedin-oauth-client/${credentialName}, linkedin-oauth/${credentialName}. ` +
					`Paste your app credentials JSON in the Credentials tab.`,
			);
		}

		const redirectUri = `${this.ctx.publicBaseUrl}/plugins/linkedin/callback`;
		const state = crypto.randomUUID();

		this.cleanExpiredStates();
		this.pendingStates.set(state, { credentialName, createdAt: Date.now() });

		const params = new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			redirect_uri: redirectUri,
			scope: this.scopes.join(" "),
			state,
		});

		const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
		return { authUrl, state };
	}

	async handleCallback(
		req: Request,
	): Promise<{ success: boolean; credentialName: string; error?: string }> {
		const url = new URL(req.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");

		if (!state || !code) {
			return {
				success: false,
				credentialName: "",
				error: "Missing code or state parameter",
			};
		}

		const pending = this.pendingStates.get(state);
		if (!pending) {
			return {
				success: false,
				credentialName: "",
				error: "Invalid or expired state",
			};
		}

		if (Date.now() - pending.createdAt > STATE_TTL_MS) {
			this.pendingStates.delete(state);
			return { success: false, credentialName: "", error: "State expired" };
		}

		this.pendingStates.delete(state);

		try {
			const { clientId, clientSecret } = await this.resolveClientConfig(
				pending.credentialName,
			);

			if (!clientId || !clientSecret) {
				return {
					success: false,
					credentialName: pending.credentialName,
					error:
						`LinkedIn OAuth client credentials not configured. ` +
						`Checked linkedin-oauth-client/default, linkedin-oauth-client/${pending.credentialName}, linkedin-oauth/${pending.credentialName}.`,
				};
			}

			const redirectUri = `${this.ctx.publicBaseUrl}/plugins/linkedin/callback`;

			// Exchange code for tokens
			const tokenResp = await fetch(
				"https://www.linkedin.com/oauth/v2/accessToken",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: new URLSearchParams({
						grant_type: "authorization_code",
						code,
						redirect_uri: redirectUri,
						client_id: clientId,
						client_secret: clientSecret,
					}),
				},
			);

			if (!tokenResp.ok) {
				const errText = await tokenResp.text();
				return {
					success: false,
					credentialName: pending.credentialName,
					error: `Token exchange failed: ${tokenResp.status} ${errText}`,
				};
			}

			const tokens = await tokenResp.json();

			if (!tokens.refresh_token) {
				return {
					success: false,
					credentialName: pending.credentialName,
					error:
						"LinkedIn did not return a refresh_token. Ensure your app has the 'Sign In With LinkedIn' product and retry.",
				};
			}

			await this.ctx.stores.credential.setSecrets(
				"linkedin-oauth",
				pending.credentialName,
				{
					secret_clientId: clientId,
					secret_clientSecret: clientSecret,
					secret_refreshToken: tokens.refresh_token,
					secret_accessToken: tokens.access_token,
					createdAt: new Date().toISOString(),
				},
				{
					label: `LinkedIn OAuth (${pending.credentialName})`,
					valid: true,
				},
			);

			return { success: true, credentialName: pending.credentialName };
		} catch (err) {
			return {
				success: false,
				credentialName: pending.credentialName,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	getHttpEndpoints(): HttpEndpoint[] {
		return [
			{
				method: "GET",
				path: "/callback",
				handler: async (req) => {
					const result = await this.handleCallback(req);
					if (result.success) {
						return new Response(
							`<html><body><h2>LinkedIn OAuth success</h2><p>Credential '${result.credentialName}' saved. You can close this tab.</p></body></html>`,
							{ headers: { "Content-Type": "text/html" } },
						);
					}
					return new Response(
						`<html><body><h2>LinkedIn OAuth failed</h2><p>${result.error ?? "Unknown error"}</p></body></html>`,
						{ status: 400, headers: { "Content-Type": "text/html" } },
					);
				},
			},
		];
	}

	async configure(json: string, credentialName: string): Promise<void> {
		const parsed = JSON.parse(json) as LinkedInOAuthClientFile;
		if (!parsed.client_id || !parsed.client_secret) {
			throw new Error(
				"JSON must contain 'client_id' and 'client_secret' fields",
			);
		}
		await this.ctx.stores.credential.setSecrets(
			"linkedin-oauth-client",
			credentialName,
			{
				secret_clientId: parsed.client_id,
				secret_clientSecret: parsed.client_secret,
			},
			{
				label: `LinkedIn OAuth client (${credentialName})`,
				valid: true,
			},
		);
	}

	private async resolveClientConfig(credentialName: string): Promise<{
		clientId?: string;
		clientSecret?: string;
	}> {
		let secrets = await this.ctx.stores.credential.getSecrets(
			"linkedin-oauth-client",
			"default",
		);
		let clientId = secrets?.secret_clientId as string | undefined;
		let clientSecret = secrets?.secret_clientSecret as string | undefined;
		if (clientId && clientSecret) return { clientId, clientSecret };

		secrets = await this.ctx.stores.credential.getSecrets(
			"linkedin-oauth-client",
			credentialName,
		);
		clientId = secrets?.secret_clientId as string | undefined;
		clientSecret = secrets?.secret_clientSecret as string | undefined;
		if (clientId && clientSecret) return { clientId, clientSecret };

		secrets = await this.ctx.stores.credential.getSecrets(
			"linkedin-oauth",
			credentialName,
		);
		clientId = secrets?.secret_clientId as string | undefined;
		clientSecret = secrets?.secret_clientSecret as string | undefined;
		if (clientId && clientSecret) return { clientId, clientSecret };

		return {};
	}

	private cleanExpiredStates() {
		const now = Date.now();
		for (const [k, v] of this.pendingStates) {
			if (now - v.createdAt > STATE_TTL_MS) this.pendingStates.delete(k);
		}
	}
}

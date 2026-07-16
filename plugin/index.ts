import type {
	PluginContext,
	PluginFactory,
	PluginModule,
} from "@orgsdk/plugins";
import { LinkedInAuthProvider } from "./auth-provider";
import { safeFunctions } from "./linkedin-functions";

const DEFAULT_SCOPES = [
	"r_liteprofile",
	"r_emailaddress",
	"w_member_social",
	"r_organization_social",
	"w_organization_social",
	"r_organization_admin",
];

const createPlugin: PluginFactory = (ctx: PluginContext): PluginModule => {
	const authProvider = new LinkedInAuthProvider(ctx, DEFAULT_SCOPES);
	return {
		safeFunctions,
		httpEndpoints: authProvider.getHttpEndpoints(),
		authProvider,
		async onLoad() {
			const cred = await ctx.stores.credential.get("linkedin-oauth", "default");
			if (!cred) {
				ctx.logger.warn(
					"[linkedin] No linkedin-oauth credential found. Connect it in the dashboard (Credentials tab).",
				);
			}
		},
	};
};

export default createPlugin;

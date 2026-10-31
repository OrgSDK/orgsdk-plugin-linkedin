import type { SafeFunction } from "@orgsdk/plugins";
import { fetchJson } from "./http-client";
import { getLinkedInAccessToken } from "./oauth";

export const moduleDescription =
	"Post content, manage posts, and read analytics for LinkedIn personal profiles and organization pages";

// ─── Types ──────────────────────────────────────────────────────────────

interface LinkedInPost {
	id: string;
	text: string;
	authorUrn: string;
	createdAt: number;
	visibility: string;
	liked: number;
	commented: number;
	reposted: number;
	impressions: number;
	url: string;
}

interface LinkedInProfile {
	id: string;
	urn: string;
	name: string;
	headline?: string;
	profilePicture?: string;
}

interface LinkedInOrganization {
	id: string;
	urn: string;
	name: string;
	logo?: string;
	vanityName?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function liFetch(
	accessToken: string,
	path: string,
	options?: { method?: string; body?: unknown },
) {
	const url = path.startsWith("http")
		? path
		: `https://api.linkedin.com/rest${path}`;

	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
		"LinkedIn-Version": "202610",
		"X-Restli-Protocol-Version": "2.0.0",
		"Content-Type": "application/json",
	};

	return fetchJson(url, {
		method: options?.method ?? "GET",
		headers,
		body: options?.body ? JSON.stringify(options.body) : undefined,
	});
}

// ─── Safe Functions ─────────────────────────────────────────────────────

export const safeFunctions: SafeFunction[] = [
	// ─── Profile ──────────────────────────────────────────────────────
	{
		name: "getProfile",
		requiredCredentials: ["linkedin-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
		): Promise<LinkedInProfile> => {
			const accessToken = await getLinkedInAccessToken(credentials);
			const data = await liFetch(
				accessToken,
				"https://api.linkedin.com/v2/userinfo",
			);

			return {
				id: data.sub,
				urn: `urn:li:person:${data.sub}`,
				name: data.name,
				profilePicture: data.picture,
			};
		},
		description:
			"Get the authenticated user's LinkedIn profile including ID, URN, name, and headline.",
		returnType:
			"Promise<{ id: string; urn: string; name: string; headline?: string; profilePicture?: string }>",
		parameters: [],
		metadata: {
			category: "linkedin",
			tags: ["readonly", "auth", "discovery"],
			readonly: true,
			discovery: true,
			version: "1.0.0",
		},
		docs: {
			summary:
				"Retrieve the authenticated LinkedIn user's profile. Returns ID, URN (needed for posting), name, headline, and profile picture URL.",
			parameters: [],
			returns: {
				type: "Promise<LinkedInProfile>",
				description: "The authenticated user's LinkedIn profile.",
				example:
					'{ id: "abc123", urn: "urn:li:person:abc123", name: "Jane Doe", headline: "CTO at Example" }',
			},
			examples: [
				{
					title: "Get current user profile",
					code: "const profile = await linkedin.getProfile();\nconsole.log(`Posting as: ${profile.name}`);",
				},
			],
		},
	},

	// ─── Organizations ────────────────────────────────────────────────
	{
		name: "getOrganizations",
		requiredCredentials: ["linkedin-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
		): Promise<LinkedInOrganization[]> => {
			const accessToken = await getLinkedInAccessToken(credentials);
			const data = await liFetch(
				accessToken,
				"/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
			);

			const orgUrns: string[] = (data.elements ?? []).map(
				(e: { organization?: string }) => e.organization ?? "",
			);

			const orgs: LinkedInOrganization[] = [];
			for (const urn of orgUrns) {
				try {
					const orgData = await liFetch(
						accessToken,
						`/organizations/${urn.split(":").pop()}`,
					);
					orgs.push({
						id: orgData.id,
						urn,
						name: orgData.localizedName ?? "Unknown",
						logo: orgData.logoV2?.cropped?.[0]?.url ?? undefined,
						vanityName: orgData.vanityName ?? undefined,
					});
				} catch {
					// Skip orgs we can't fetch
				}
			}

			return orgs;
		},
		description:
			"List LinkedIn organization pages where the authenticated user is an administrator.",
		returnType:
			"Promise<Array<{ id: string; urn: string; name: string; logo?: string; vanityName?: string }>>",
		parameters: [],
		metadata: {
			category: "linkedin",
			tags: ["readonly", "discovery"],
			readonly: true,
			discovery: true,
			version: "1.0.0",
		},
		docs: {
			summary:
				"List all LinkedIn organization (company) pages where the authenticated user has admin access. Returns org URN needed for posting as an organization.",
			parameters: [],
			returns: {
				type: "Promise<LinkedInOrganization[]>",
				description: "Array of organization objects with URN, name, and logo.",
			},
			examples: [
				{
					title: "Find company page URN",
					code: "const orgs = await linkedin.getOrganizations();\nconst quokly = orgs.find(o => o.name.includes('Quokly'));",
				},
			],
		},
	},

	// ─── Create Post ──────────────────────────────────────────────────
	{
		name: "createPost",
		requiredCredentials: ["linkedin-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
			{
				text,
				authorUrn,
				visibility = "PUBLIC",
				linkUrl,
				linkTitle,
				linkDescription,
			}: {
				text: string;
				authorUrn?: string;
				visibility?: "PUBLIC" | "CONNECTIONS";
				linkUrl?: string;
				linkTitle?: string;
				linkDescription?: string;
			},
		): Promise<{ id: string; url: string }> => {
			const accessToken = await getLinkedInAccessToken(credentials);

			// Default to personal profile if no authorUrn provided
			let resolvedAuthorUrn = authorUrn;
			if (!resolvedAuthorUrn) {
				const profile = await liFetch(
					accessToken,
					"https://api.linkedin.com/v2/userinfo",
				);
				resolvedAuthorUrn = `urn:li:person:${profile.sub}`;
			}

			const post: Record<string, unknown> = {
				author: resolvedAuthorUrn,
				commentary: text,
				visibility: visibility ?? "PUBLIC",
				lifecycleState: "PUBLISHED",
				distribution: {
					feedDistribution: "MAIN_FEED",
					targetEntities: [],
					thirdPartyDistributionChannels: [],
				},
			};

			// Add article/link attachment if provided
			if (linkUrl) {
				post.content = {
					article: {
						source: linkUrl,
						title: linkTitle ?? "",
						description: linkDescription ?? "",
					},
				};
			}

			const result = await liFetch(accessToken, "/posts", {
				method: "POST",
				body: post,
			});

			// Extract post URN from the response header or response body
			const postId = result?.id;
			if (typeof postId !== "string" || !postId.startsWith("urn:li:"))
				throw new Error("INVALID_POST_RESPONSE");

			return {
				id: postId,
				url: `https://www.linkedin.com/feed/update/${postId}`,
			};
		},
		description:
			"Create a LinkedIn post with optional link attachment. Posts as the authenticated user by default, or as an organization if authorUrn is provided.",
		returnType: "Promise<{ id: string; url: string }>",
		parameters: [
			{ name: "text", type: "string" },
			{ name: "authorUrn", type: "string", optional: true },
			{ name: "visibility", type: '"PUBLIC" | "CONNECTIONS"', optional: true },
			{ name: "linkUrl", type: "string", optional: true },
			{ name: "linkTitle", type: "string", optional: true },
			{ name: "linkDescription", type: "string", optional: true },
		],
		metadata: {
			category: "linkedin",
			tags: ["write", "social"],
			readonly: false,
			version: "1.0.0",
		},
		docs: {
			summary:
				"Publish a post on LinkedIn. Supports text-only posts and link/article posts with a preview card. By default posts as the authenticated user; pass an organization URN to post as a company page.",
			parameters: [
				{
					name: "text",
					type: "string",
					description:
						"The post text content. LinkedIn supports up to 3000 characters.",
					example:
						'"Check out our latest blog post on AI research transparency!"',
				},
				{
					name: "authorUrn",
					type: "string",
					description:
						"URN of the author. Defaults to the authenticated user's personal profile. Use getOrganizations() to get org URNs.",
					optional: true,
					example: '"urn:li:organization:12345"',
				},
				{
					name: "visibility",
					type: '"PUBLIC" | "CONNECTIONS"',
					description: "Post visibility. Defaults to PUBLIC.",
					optional: true,
					defaultValue: "PUBLIC",
				},
				{
					name: "linkUrl",
					type: "string",
					description:
						"URL for an article/link attachment. Creates a preview card on the post.",
					optional: true,
					example: '"https://quokly.com.au/blog/my-post"',
				},
				{
					name: "linkTitle",
					type: "string",
					description: "Title for the link preview card.",
					optional: true,
				},
				{
					name: "linkDescription",
					type: "string",
					description: "Description for the link preview card.",
					optional: true,
				},
			],
			returns: {
				type: "Promise<{ id: string; url: string }>",
				description: "The created post ID and LinkedIn URL.",
			},
			examples: [
				{
					title: "Share a blog post link",
					code: `const result = await linkedin.createPost({
  text: "New on the blog: Why source transparency matters in AI research",
  linkUrl: "https://quokly.com.au/blog/why-source-transparency",
  linkTitle: "Why Source Transparency Matters in AI Research",
  linkDescription: "Learn how verified sources improve AI-powered research."
});`,
				},
				{
					title: "Post as company page",
					code: `const orgs = await linkedin.getOrganizations();
const companyUrn = orgs.find(o => o.name.includes('Quokly')).urn;
await linkedin.createPost({
  text: "Quokly helps founders research with confidence.",
  authorUrn: companyUrn,
});`,
				},
			],
		},
	},

	// ─── Get Post Analytics ───────────────────────────────────────────
	{
		name: "getPostAnalytics",
		requiredCredentials: ["linkedin-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
			{
				postUrn,
				organizationUrn,
			}: { postUrn: string; organizationUrn: string },
		): Promise<{
			impressions: number;
			uniqueImpressions: number;
			likes: number;
			comments: number;
			reposts: number;
			clicks: number;
			engagementRate: number;
		}> => {
			const accessToken = await getLinkedInAccessToken(credentials);

			if (
				!/^urn:li:organization:[0-9]+$/.test(organizationUrn) ||
				!/^urn:li:(share|ugcPost):[0-9]+$/.test(postUrn)
			)
				throw new Error(
					"Provide an organization URN and its post URN for organization analytics.",
				);
			const postFilter = postUrn.startsWith("urn:li:ugcPost:")
				? "ugcPosts"
				: "shares";
			const query = `q=organizationalEntity&organizationalEntity=${encodeURIComponent(organizationUrn)}&${postFilter}=List(${encodeURIComponent(postUrn)})`;
			const response = await liFetch(
				accessToken,
				`/organizationalEntityShareStatistics?${query}`,
			);
			const stats = response?.elements?.[0]?.totalShareStatistics;
			if (!stats) throw new Error("ANALYTICS_UNAVAILABLE");
			const impressions = stats.impressionCount ?? 0;
			const uniqueImpressions = stats.uniqueImpressionsCount ?? 0;
			const clicks = stats.clickCount ?? 0;
			const likes = stats.likeCount ?? 0;
			const comments = stats.commentCount ?? 0;
			const reposts = stats.shareCount ?? 0;

			const engagementRate =
				impressions > 0
					? ((likes + comments + reposts + clicks) / impressions) * 100
					: 0;

			return {
				impressions,
				uniqueImpressions,
				likes,
				comments,
				reposts,
				clicks,
				engagementRate: Math.round(engagementRate * 100) / 100,
			};
		},
		description:
			"Get organization post analytics. Requires the organization URN and approved Community Management access; personal post impressions are not supported.",
		returnType:
			"Promise<{ impressions: number; uniqueImpressions: number; likes: number; comments: number; reposts: number; clicks: number; engagementRate: number }>",
		parameters: [
			{ name: "postUrn", type: "string" },
			{ name: "organizationUrn", type: "string" },
		],
		metadata: {
			category: "linkedin",
			tags: ["readonly", "analytics"],
			readonly: true,
			version: "1.0.0",
		},
		docs: {
			summary:
				"Retrieve engagement analytics for a LinkedIn post by its URN. Returns impressions, likes, comments, reposts, clicks, and calculated engagement rate.",
			parameters: [
				{
					name: "postUrn",
					type: "string",
					description: "The URN of the LinkedIn post to analyze.",
					example: '"urn:li:activity:123456789"',
				},
			],
			returns: {
				type: "Promise<LinkedInPostAnalytics>",
				description: "Engagement metrics for the post.",
			},
		},
	},

	// ─── Delete Post ──────────────────────────────────────────────────
	{
		name: "deletePost",
		requiredCredentials: ["linkedin-oauth"],
		handler: async (
			credentials: Record<string, unknown>,
			{ postUrn }: { postUrn: string },
		): Promise<{ success: boolean }> => {
			const accessToken = await getLinkedInAccessToken(credentials);
			await liFetch(accessToken, `/posts/${postUrn}`, {
				method: "DELETE",
			});
			return { success: true };
		},
		description: "Delete a LinkedIn post by its URN.",
		returnType: "Promise<{ success: boolean }>",
		parameters: [{ name: "postUrn", type: "string" }],
		metadata: {
			category: "linkedin",
			tags: ["write", "destructive"],
			readonly: false,
			version: "1.0.0",
		},
		docs: {
			summary: "Delete a LinkedIn post. This action is irreversible.",
			parameters: [
				{
					name: "postUrn",
					type: "string",
					description: "The URN of the post to delete.",
				},
			],
			returns: {
				type: "Promise<{ success: boolean }>",
				description: "Confirmation of deletion.",
			},
		},
	},
];

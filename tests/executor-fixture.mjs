import assert from "node:assert/strict";

export default async function createFixture() {
	return {
		configuration: {},
		provider: "linkedin-oauth",
		secret: {
			source: "byo",
			secret_accessToken: "synthetic-access",
		},
		async fetch(request) {
			const url = new URL(request.url);
			assert.equal(url.origin, "https://api.linkedin.com");
			assert.equal(
				request.headers.get("authorization"),
				"Bearer synthetic-access",
			);
			const path = url.pathname;
			if (path.startsWith("/rest/"))
				assert.equal(request.headers.get("linkedin-version"), "202610");
			if (path === "/v2/userinfo")
				return Response.json({
					sub: "person",
					name: "Test User",
				});
			if (path === "/rest/organizationAcls")
				return Response.json({
					elements: [{ organization: "urn:li:organization:1" }],
				});
			if (path === "/rest/organizations/1")
				return Response.json({
					id: 1,
					localizedName: "Synthetic organisation",
				});
			if (path === "/rest/posts") {
				assert.equal(request.method, "POST");
				return new Response(null, {
					status: 201,
					headers: { "x-restli-id": "urn:li:share:81" },
				});
			}
			if (path.startsWith("/rest/socialActions/"))
				return Response.json({
					likesSummary: { totalLikes: 5 },
					commentsSummary: { aggregatedTotalComments: 1 },
					urnsTotalReshares: 1,
				});
			if (path === "/rest/organizationalEntityShareStatistics")
				return Response.json({
					elements: [
						{
							totalShareStatistics: {
								impressionCount: 100,
								uniqueImpressionsCount: 80,
								clickCount: 2,
							},
						},
					],
				});
			if (path.startsWith("/rest/posts/") && request.method === "DELETE")
				return new Response(null, { status: 204 });
			assert.fail(path);
		},
		async run(call) {
			assert.equal((await call("getProfile")).id, "person");
			assert.equal((await call("getOrganizations"))[0].id, 1);
			assert.equal(
				(
					await call("createPost", {
						text: "Synthetic only",
						authorUrn: "urn:li:person:person",
					})
				).id,
				"urn:li:share:81",
			);
			assert.equal(
				(
					await call("getPostAnalytics", {
						postUrn: "urn:li:share:81",
						organizationUrn: "urn:li:organization:1",
					})
				).impressions,
				100,
			);
			assert.equal(
				(
					await call("deletePost", {
						postUrn: "urn:li:share:81",
						organizationUrn: "urn:li:organization:1",
					})
				).success,
				true,
			);
		},
	};
}

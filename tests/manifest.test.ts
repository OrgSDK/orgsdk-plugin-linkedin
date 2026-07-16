import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const MANIFEST_PATH = resolve(import.meta.dir, "..", "plugin", ".plugin.json");

async function readManifest() {
	const raw = await readFile(MANIFEST_PATH, "utf-8");
	return JSON.parse(raw) as Record<string, unknown>;
}

describe("manifest", () => {
	it("has the expected slug (name)", async () => {
		const m = await readManifest();
		expect(m.name).toBe("linkedin");
	});

	it("has the bumped version 1.0.2", async () => {
		const m = await readManifest();
		expect(m.version).toBe("1.0.2");
	});

	it("declares the canonical $schema", async () => {
		const m = await readManifest();
		expect(m.$schema).toBe("https://orgsdk.ai/schemas/plugin-manifest.v1.json");
	});

	it("has a non-empty description", async () => {
		const m = await readManifest();
		expect(typeof m.description).toBe("string");
		expect((m.description as string).length).toBeGreaterThan(0);
	});

	it("declares entry as index.ts", async () => {
		const m = await readManifest();
		expect(m.entry).toBe("index.ts");
	});

	it("declares oauth2 auth with the linkedin-oauth provider key", async () => {
		const m = await readManifest();
		const auth = m.auth as Record<string, unknown>;
		expect(auth.type).toBe("oauth2");
		expect(auth.provider).toBe("linkedin-oauth");
		expect(auth.callbackPath).toBe("/callback");
	});

	// NOTE: these are the EXACT scopes frozen from the monorepo source
	// (packages/plugins/src/linkedin/.plugin.json + index.ts DEFAULT_SCOPES +
	// docs/overview.md). The migration froze behavior byte-for-byte; a
	// LinkedIn OpenID-scope modernization is a separate, deliberate change and
	// must not be smuggled into this extraction (skill learning #10).
	it("declares the exact LinkedIn OAuth 2.0 scopes (frozen legacy set)", async () => {
		const m = await readManifest();
		const auth = m.auth as { scopes: string[] };
		expect(auth.scopes).toEqual([
			"r_liteprofile",
			"r_emailaddress",
			"w_member_social",
			"r_organization_social",
			"w_organization_social",
			"r_organization_admin",
		]);
	});

	it("declares marketplace metadata with the source-repo provenance link", async () => {
		const m = await readManifest();
		const mp = m.marketplace as Record<string, unknown>;
		expect(mp.displayName).toBe("LinkedIn");
		expect(mp.category).toBe("Social");
		expect(Array.isArray(mp.tags)).toBe(true);
		const links = mp.links as Record<string, string>;
		expect(links.sourceRepo).toBe(
			"https://github.com/OrgSDK/orgsdk-plugin-linkedin",
		);
		expect(links.homepage).toBe("https://www.linkedin.com");
	});
});

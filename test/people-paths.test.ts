import { describe, expect, it } from "vitest";
import type { PersonRecord } from "../src/domain/types";
import {
	personDossierCollisionKey,
	personDossierDisplayLabel,
	personDossierPath,
	personDossierPathFromProfile,
	personIdCrockfordBase32,
	personProfilePath,
	planPersonDossier,
} from "../src/domain/people-paths";

const newcomerId = "person-7d9f4a12-6b3c-4d5e-8f90-123456789abc";
const existingId = "person-11112222-3333-4444-aaaa-bbbbbbbbbbbb";
const existingJan = {
	id: existingId,
	filePath: "People/Profiles/Jan Jansen/Jan Jansen.md",
	name: "Jan Jansen",
	aliases: [],
	organisations: [],
	emails: [],
	phones: [],
	contacts: [],
} satisfies PersonRecord;

describe("presentation-first person dossier naming", () => {
	it("preserves the safe display label while conservatively canonicalizing its collision namespace", () => {
		expect(personDossierDisplayLabel("  Zoë / Admin  ")).toBe("Zoë - Admin");
		expect([
			personDossierCollisionKey("  Zoë / Admin  "),
			personDossierCollisionKey("zoe\\admin"),
			personDossierCollisionKey("ZOË---ADMIN"),
		]).toEqual(["zoe admin", "zoe admin", "zoe admin"]);
	});

	it.each([
		["person-00000000-0000-0000-0000-000000000000", "00000000000000000000000000"],
		["person-ffffffff-ffff-ffff-ffff-ffffffffffff", "ZZZZZZZZZZZZZZZZZZZZZZZZZW"],
		[newcomerId, "FPFMM4KB7H6NX3WG28T5CY4TQG"],
	] as const)("encodes the 16 UUID bytes MSB-first without padding for %s", (personId, expected) => {
		expect(personIdCrockfordBase32(personId)).toBe(expected);
	});

	it("plans a plain first candidate and extends only the newcomer suffix one character per occupied candidate", () => {
		const plain = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Jan Jansen",
			personId: newcomerId,
			people: [],
			vaultPaths: [],
		});
		const collision = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Jan Jansen",
			personId: newcomerId,
			people: [existingJan],
			vaultPaths: [existingJan.filePath],
		});
		const extended = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Jan Jansen",
			personId: newcomerId,
			people: [existingJan],
			vaultPaths: [existingJan.filePath, "People/Profiles/Jan Jansen · FP/Notes.md"],
		});

		expect(plain).toMatchObject({
			status: "ready",
			dossierPath: "People/Profiles/Jan Jansen",
			profilePath: "People/Profiles/Jan Jansen/Jan Jansen.md",
			suffixLength: 0,
		});
		expect(collision).toMatchObject({
			status: "ready",
			dossierPath: "People/Profiles/Jan Jansen · FP",
			profilePath: "People/Profiles/Jan Jansen · FP/Jan Jansen.md",
			suffixLength: 2,
		});
		expect(extended).toMatchObject({
			status: "ready",
			dossierPath: "People/Profiles/Jan Jansen · FPF",
			profilePath: "People/Profiles/Jan Jansen · FPF/Jan Jansen.md",
			suffixLength: 3,
		});
	});

	it("shares one conservative collision namespace across case, Unicode and separator variants", () => {
		const equivalentOwner = {
			...existingJan,
			filePath: "people/profiles/Zoe\u0308-JANSEN/Zoe.md",
			name: "Zoë Jansen",
		};

		expect(
			planPersonDossier({
				peopleRootFolder: "People",
				displayName: "Zoë Jansen",
				personId: newcomerId,
				people: [equivalentOwner],
				vaultPaths: [equivalentOwner.filePath, "PEOPLE/PROFILES/ZOË JANSEN · fp/Notes.md"],
			}),
		).toMatchObject({
			status: "ready",
			dossierPath: "People/Profiles/Zoë Jansen · FPF",
			profilePath: "People/Profiles/Zoë Jansen · FPF/Zoë Jansen.md",
			suffixLength: 3,
		});
	});

	it("treats Greek final-sigma case variants as one portable ordinary namespace", () => {
		const owner = {
			...existingJan,
			filePath: "People/Profiles/Οσ/Οσ.md",
			name: "Οσ",
		};

		expect(personDossierCollisionKey("ΟΣ")).toBe(personDossierCollisionKey("Οσ"));
		expect(
			planPersonDossier({
				peopleRootFolder: "People",
				displayName: "ΟΣ",
				personId: newcomerId,
				people: [owner],
				vaultPaths: [owner.filePath],
			}),
		).toMatchObject({
			status: "ready",
			dossierPath: "People/Profiles/ΟΣ · FP",
			suffixLength: 2,
		});
	});

	it.each([
		"CON",
		"CON.txt",
		"\u200b",
		"Alice · fp",
		"a".repeat(253),
	])("blocks portability-unsafe dossier labels before a candidate can be written: %j", (displayName) => {
		expect(
			planPersonDossier({
				peopleRootFolder: "People",
				displayName,
				personId: newcomerId,
				people: [],
				vaultPaths: [],
			}),
		).toMatchObject({ status: "blocked" });
	});

	it.each(["Alice."])("rejects a Windows trailing alias in candidate input before planning: %j", (displayName) => {
		expect(
			planPersonDossier({
				peopleRootFolder: "People",
				displayName,
				personId: newcomerId,
				people: [],
				vaultPaths: [],
			}),
		).toMatchObject({ status: "blocked" });
	});

	it("rejects a Windows trailing alias before derived candidate paths can adopt it", () => {
		expect({
			dossier: personDossierPath("People", "Alice.", newcomerId),
			profile: personProfilePath("People", "Alice.", newcomerId),
		}).toEqual({ dossier: "", profile: "" });
	});

	it("blocks a 250-byte plain label when an otherwise canonical owner needs an overlong collision suffix", () => {
		const displayLabel = "a".repeat(250);
		const owner = {
			...existingJan,
			filePath: `People/Profiles/${displayLabel}/Owner.md`,
		};
		const plan = planPersonDossier({
			peopleRootFolder: "People",
			displayName: displayLabel,
			personId: newcomerId,
			people: [owner],
			vaultPaths: [owner.filePath],
		});

		expect(plan).toMatchObject({ status: "blocked" });
		expect(plan.dossierPath).not.toContain(" · ");
	});

	it("blocks multiple canonically equivalent ordinary owners instead of silently adopting one", () => {
		const secondId = "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
		expect(
			planPersonDossier({
				peopleRootFolder: "People",
				displayName: "Zoë Jansen",
				personId: newcomerId,
				people: [
					{ ...existingJan, name: "Zoë Jansen", filePath: "People/Profiles/Zoë Jansen/One.md" },
					{
						...existingJan,
						id: secondId,
						name: "Zoe Jansen",
						filePath: "people/profiles/zoe-jansen/Two.md",
					},
				],
				vaultPaths: ["People/Profiles/Zoë Jansen/One.md", "people/profiles/zoe-jansen/Two.md"],
			}),
		).toMatchObject({
			status: "blocked",
			error: expect.stringContaining("without exactly one other canonical person owner"),
		});
	});

	it("blocks a raw backslash-coded existing owner before it can authorize a collision suffix", () => {
		const owner = { ...existingJan, filePath: "People\\Profiles\\Jan Jansen\\Owner.md" };
		const plan = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Jan Jansen",
			personId: newcomerId,
			people: [owner],
			vaultPaths: [owner.filePath],
		});

		expect(plan).toMatchObject({
			status: "blocked",
			error: expect.stringContaining("without exactly one other canonical person owner"),
		});
		expect(plan.dossierPath).not.toContain(" · FP");
	});

	it("never lets ignored vault paths remove a current malformed PersonRecord from the ordinary namespace snapshot", () => {
		const dossierPath = "People/Profiles/Alice";
		const malformedPeer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: dossierPath,
			name: "Alice",
		};
		const input = {
			peopleRootFolder: "People",
			displayName: "Alice",
			personId: newcomerId,
			people: [malformedPeer],
			vaultPaths: [],
		};

		expect(planPersonDossier(input)).toMatchObject({
			status: "blocked",
			error: expect.stringContaining("without exactly one other canonical person owner"),
		});
		expect(planPersonDossier({ ...input, ignoredVaultPaths: [dossierPath] })).toMatchObject({
			status: "blocked",
			error: expect.stringContaining("without exactly one other canonical person owner"),
		});
	});

	it("blocks a double raw alternate-separator peer in Alice's ordinary collision namespace", () => {
		const alicePath = "People/Profiles/Alice/Alice.md";
		const aliceOwner = { ...existingJan, filePath: alicePath, name: "Alice" };
		const doubleRawPeer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: "People\\Profiles\\Alice\\\\Bob.md",
		};

		expect(
			planPersonDossier({
				peopleRootFolder: "People",
				displayName: "Alice",
				personId: newcomerId,
				people: [aliceOwner, doubleRawPeer],
				vaultPaths: [alicePath, doubleRawPeer.filePath],
			}),
		).toMatchObject({
			status: "blocked",
			error: expect.stringContaining("without exactly one other canonical person owner"),
		});
	});

	it("blocks a direct Windows trailing-alias dossier owner before it can authorize a collision suffix", () => {
		const owner = { ...existingJan, filePath: "People/Profiles/Alice./Owner.md", name: "Alice" };
		const plan = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Alice",
			personId: newcomerId,
			people: [owner],
			vaultPaths: [owner.filePath],
		});

		expect(plan).toMatchObject({
			status: "blocked",
			error: expect.stringContaining("without exactly one other canonical person owner"),
		});
		expect(plan.dossierPath).not.toContain(" · FP");
	});

	it("does not let an unrelated raw backslash record block Alice's ordinary collision namespace", () => {
		const alicePath = "People/Profiles/Alice/Alice.md";
		const aliceOwner = { ...existingJan, filePath: alicePath, name: "Alice" };
		const unrelatedRawPeer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: "Elsewhere\\Corrupt.md",
		};
		const withoutRawPeer = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Alice",
			personId: newcomerId,
			people: [aliceOwner],
			vaultPaths: [alicePath],
		});
		const withUnrelatedRawPeer = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Alice",
			personId: newcomerId,
			people: [aliceOwner, unrelatedRawPeer],
			vaultPaths: [alicePath, unrelatedRawPeer.filePath],
		});

		expect(withoutRawPeer).toMatchObject({
			status: "ready",
			dossierPath: "People/Profiles/Alice · FP",
			profilePath: "People/Profiles/Alice · FP/Alice.md",
			suffixLength: 2,
		});
		expect(withUnrelatedRawPeer).toEqual(withoutRawPeer);
	});

	it.each([
		["a single-separator raw descendant", "People\\Profiles\\Alice · FP\\Peer.md", "vault"],
		["a double-separator raw descendant", "People\\Profiles\\Alice · FP\\\\Peer.md", "current PersonRecord"],
		["a raw exact candidate folder", "People\\Profiles\\Alice · FP", "current PersonRecord"],
	] as const)("blocks the current suffixed candidate instead of silently extending it for %s", (_label, rawPath, source) => {
		const alicePath = "People/Profiles/Alice/Alice.md";
		const aliceOwner = { ...existingJan, filePath: alicePath, name: "Alice" };
		const rawPeer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: rawPath,
		};
		const plan = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Alice",
			personId: newcomerId,
			people: source === "current PersonRecord" ? [aliceOwner, rawPeer] : [aliceOwner],
			vaultPaths: source === "vault" ? [alicePath, rawPath] : [alicePath],
		});

		expect(plan).toMatchObject({
			status: "blocked",
			dossierPath: "People/Profiles/Alice · FP",
			profilePath: "People/Profiles/Alice · FP/Alice.md",
		});
	});

	it.each([
		["a nested peer", "People/Profiles/Jan Jansen/Nested/Other.md"],
		["a C1-control peer", "People/Profiles/Jan Jansen/Other\u009f.md"],
		["a non-Markdown peer", "People/Profiles/Jan Jansen/Other.txt"],
		["a reserved-name peer", "People/Profiles/Jan Jansen/CON.md"],
		["a raw backslash-coded peer", "People\\Profiles\\Jan Jansen\\Other.md"],
	] as const)("blocks a second current PersonRecord in the ordinary collision namespace: %s", (_label, peerPath) => {
		const peer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: peerPath,
		};
		const plan = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Jan Jansen",
			personId: newcomerId,
			people: [existingJan, peer],
			vaultPaths: [existingJan.filePath, peer.filePath],
		});

		expect(plan).toMatchObject({
			status: "blocked",
			error: expect.stringContaining("without exactly one other canonical person owner"),
		});
	});

	it.each([
		["an invalid full owner ID", { ...existingJan, id: "person-not-a-uuid" }, [existingJan.filePath]],
		[
			"a nested owner profile",
			{ ...existingJan, filePath: "People/Profiles/Jan Jansen/Sub/Jan Jansen.md" },
			["People/Profiles/Jan Jansen/Sub/Jan Jansen.md"],
		],
		[
			"a non-Markdown direct owner profile",
			{ ...existingJan, filePath: "People/Profiles/Jan Jansen/Jan Jansen.txt" },
			["People/Profiles/Jan Jansen/Jan Jansen.txt"],
		],
		[
			"a U+001F direct owner dossier",
			{ ...existingJan, filePath: "People/Profiles/Jan Jansen\u001f/Jan Jansen.md" },
			["People/Profiles/Jan Jansen\u001f/Jan Jansen.md"],
		],
		["an index owner missing from the current vault", existingJan, []],
	] as const)("never grants a collision suffix for %s", (_label, owner, vaultPaths) => {
		const plan = planPersonDossier({
			peopleRootFolder: "People",
			displayName: "Jan Jansen",
			personId: newcomerId,
			people: [owner],
			vaultPaths,
		});

		expect(plan).toMatchObject({
			status: "blocked",
			error: expect.stringContaining("without exactly one other canonical person owner"),
		});
		expect(plan.dossierPath).not.toContain(" · FP");
	});

	it.each([
		"People/Profiles/Alice · fp/Alice.md",
		"People/Profiles/Alice · II/Alice.md",
		"People/Profiles/Alice · 24 · 24/Alice.md",
		"People/Profiles/CON/CON.md",
		"People/Profiles/Alice/.md",
	])("never falls back to plain ownership for the invalid dossier/profile grammar %s", (profilePath) => {
		expect(
			personDossierPathFromProfile("People", profilePath, existingId, [profilePath], [existingJan]),
		).toBeUndefined();
	});

	it.each([
		["a U+001F dossier segment", "People/Profiles/Alice\u001f/Alice.md"],
		["a U+009F dossier segment", "People/Profiles/Alice\u009f/Alice.md"],
		["a literal backslash dossier segment", "People/Profiles/Alice\\Archive/Alice.md"],
		["a 253-byte basename plus .md", `People/Profiles/Alice/${"a".repeat(253)}.md`],
	] as const)("rejects unsafe or overlong direct profile authority for %s", (_label, profilePath) => {
		const owner = { ...existingJan, id: existingId, filePath: profilePath };
		expect(personDossierPathFromProfile("People", profilePath, existingId, [profilePath], [owner])).toBeUndefined();
	});

	it("rejects Windows trailing aliases in direct dossier and full profile authority", () => {
		const trailingDossierPath = "People/Profiles/Alice./Owner.md";
		const trailingFilenamePath = "People/Profiles/Alice/Alice..md";

		expect(
			personDossierPathFromProfile(
				"People",
				trailingDossierPath,
				existingId,
				[trailingDossierPath],
				[{ ...existingJan, id: existingId, filePath: trailingDossierPath }],
			),
		).toBeUndefined();
		expect(
			personDossierPathFromProfile(
				"People",
				trailingFilenamePath,
				existingId,
				[trailingFilenamePath],
				[{ ...existingJan, id: existingId, filePath: trailingFilenamePath }],
			),
		).toBeUndefined();
	});

	it.each([
		["a trailing-dot dossier alias in the current PersonRecord snapshot", "People/Profiles/Alice./Peer.md", "people"],
		["a trailing-space dossier alias in the vault snapshot", "People/Profiles/Alice /Peer.md", "vault"],
	] as const)("fails closed when dossier authority has %s", (_label, peerPath, source) => {
		const profilePath = "People/Profiles/Alice/Alice.md";
		const owner = { ...existingJan, id: existingId, filePath: profilePath };
		const peer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: peerPath,
		};

		expect(
			personDossierPathFromProfile(
				"People",
				profilePath,
				existingId,
				source === "vault" ? [profilePath, peerPath] : [profilePath],
				source === "people" ? [owner, peer] : [owner],
			),
		).toBeUndefined();
	});

	it("does not conflate an ordinary non-alias dossier name with Alice parent membership", () => {
		const profilePath = "People/Profiles/Alice/Alice.md";
		const owner = { ...existingJan, id: existingId, filePath: profilePath };
		const ordinaryPeer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: "People/Profiles/Alice-archive/Peer.md",
		};

		expect(
			personDossierPathFromProfile(
				"People",
				profilePath,
				existingId,
				[profilePath, ordinaryPeer.filePath],
				[owner, ordinaryPeer],
			),
		).toBe("People/Profiles/Alice");
	});

	it.each([
		["a trailing-dot vault descendant", "People/Profiles/Alice · FP./Peer.md", "vault"],
		["a trailing-space current PersonRecord descendant", "People/Profiles/Alice · FP /Peer.md", "people"],
	] as const)("blocks the current suffixed candidate for %s instead of extending an unsafe Windows alias", (_label, peerPath, source) => {
		const ownerPath = "People/Profiles/Alice/Alice.md";
		const owner = { ...existingJan, filePath: ownerPath, name: "Alice" };
		const peer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: peerPath,
		};

		expect(
			planPersonDossier({
				peopleRootFolder: "People",
				displayName: "Alice",
				personId: newcomerId,
				people: source === "people" ? [owner, peer] : [owner],
				vaultPaths: source === "vault" ? [ownerPath, peerPath] : [ownerPath],
			}),
		).toMatchObject({
			status: "blocked",
			dossierPath: "People/Profiles/Alice · FP",
			profilePath: "People/Profiles/Alice · FP/Alice.md",
		});
	});

	it.each([
		["a C1-control peer", "People/Profiles/Alice/Bob\u009f.md"],
		["a nested peer", "People/Profiles/Alice/Nested/Bob.md"],
	] as const)("fails closed when an unsafe current PersonRecord is under the candidate dossier parent: %s", (_label, peerPath) => {
		const profilePath = "People/Profiles/Alice/Alice.md";
		const peer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: peerPath,
		};

		expect(
			personDossierPathFromProfile(
				"People",
				profilePath,
				existingId,
				[profilePath, peerPath],
				[{ ...existingJan, filePath: profilePath }, peer],
			),
		).toBeUndefined();
	});

	it("keeps Alice dossier authority when a raw backslash record is unrelated", () => {
		const profilePath = "People/Profiles/Alice/Alice.md";
		const unrelatedRawPeer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: "Elsewhere\\Corrupt.md",
		};

		expect(
			personDossierPathFromProfile(
				"People",
				profilePath,
				existingId,
				[profilePath, unrelatedRawPeer.filePath],
				[{ ...existingJan, filePath: profilePath }, unrelatedRawPeer],
			),
		).toBe("People/Profiles/Alice");
	});

	it("does not grant Alice dossier authority beside a double raw alternate-separator peer", () => {
		const profilePath = "People/Profiles/Alice/Alice.md";
		const doubleRawPeer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: "People\\Profiles\\Alice\\\\Bob.md",
		};

		expect(
			personDossierPathFromProfile(
				"People",
				profilePath,
				existingId,
				[profilePath, doubleRawPeer.filePath],
				[{ ...existingJan, filePath: profilePath }, doubleRawPeer],
			),
		).toBeUndefined();
	});

	it.each([
		["a malformed current PersonRecord on the exact safe dossier path", "People/Profiles/Alice"],
		["a raw alternate-separator current PersonRecord on the exact dossier path", "People\\Profiles\\Alice"],
	] as const)("fails closed when dossier authority has %s", (_label, peerPath) => {
		const profilePath = "People/Profiles/Alice/Alice.md";
		const peer = {
			...existingJan,
			id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
			filePath: peerPath,
		};

		expect(
			personDossierPathFromProfile(
				"People",
				profilePath,
				existingId,
				[profilePath],
				[{ ...existingJan, filePath: profilePath }, peer],
			),
		).toBeUndefined();
	});

	it("fails closed unless the complete current snapshot has exactly the expected direct profile owner", () => {
		const profilePath = "People/Profiles/Alice/Alice.md";
		expect(
			personDossierPathFromProfile(
				"People",
				profilePath,
				existingId,
				[profilePath],
				[
					{ ...existingJan, id: existingId, filePath: profilePath },
					{
						...existingJan,
						id: "person-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
						filePath: "People/Profiles/Alice/Bob.md",
					},
				],
			),
		).toBeUndefined();
	});

	it("fails closed for invalid names, invalid UUIDs and the unsupported legacy dossier grammar", () => {
		expect(personDossierDisplayLabel(" . ")).toBe("");
		expect(personIdCrockfordBase32("person-not-a-uuid")).toBe("");
		expect(
			planPersonDossier({
				peopleRootFolder: "People",
				displayName: " . ",
				personId: newcomerId,
				people: [],
				vaultPaths: [],
			}),
		).toMatchObject({ status: "blocked" });
		expect(
			personDossierPathFromProfile(
				"People",
				"People/Profiles/jan-jansen--7d9f4a12/Jan Jansen.md",
				newcomerId,
				["People/Profiles/jan-jansen--7d9f4a12/Jan Jansen.md"],
				[existingJan],
			),
		).toBeUndefined();
	});
});

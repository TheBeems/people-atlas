import type {
	AtlasDiagnostic,
	PersonRecord,
	PersonReference,
	RawIndexSnapshot,
	RelationshipRecord,
} from "../../src/domain/types";
import type { ParsedAtlasFile } from "../../src/index/frontmatter";

export const GENERATED_SEEDS = 64;

export function withGeneratedContext<T>(context: string, run: () => T): T {
	try {
		return run();
	} catch (error) {
		if (error instanceof Error) {
			error.message = `${context}: ${error.message}`;
			throw error;
		}
		throw new Error(`${context}: ${String(error)}`);
	}
}

export class SeededGenerator {
	private state: number;

	constructor(readonly seed: number) {
		this.state = (seed + 1) >>> 0;
	}

	next(): number {
		let value = this.state;
		value ^= value << 13;
		value ^= value >>> 17;
		value ^= value << 5;
		this.state = value >>> 0;
		return this.state;
	}

	int(maxExclusive: number): number {
		if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
			throw new Error(`Invalid generated integer bound: ${maxExclusive}`);
		}
		return this.next() % maxExclusive;
	}

	bool(): boolean {
		return (this.next() & 1) === 1;
	}

	token(prefix: string): string {
		return `${prefix}-${this.seed}-${this.next().toString(36)}`;
	}

	shuffle<T>(values: readonly T[]): T[] {
		const result = [...values];
		for (let index = result.length - 1; index > 0; index -= 1) {
			const swap = this.int(index + 1);
			[result[index], result[swap]] = [result[swap] as T, result[index] as T];
		}
		return result;
	}
}

export function reference(target: string, label?: string): PersonReference {
	if (label) return { raw: `[[${target}|${label}]]`, target, label, kind: "wikilink" };
	const kind = target.includes("/") || target.toLowerCase().endsWith(".md") ? "path" : "id";
	return { raw: target, target, kind };
}

export function person(
	id: string,
	filePath: string,
	name: string,
	contacts: PersonReference[] = [],
	options: {
		aliases?: string[];
		organisations?: string[];
		photoPath?: string;
		birthDate?: string;
		pronouns?: string;
		gender?: string;
		emails?: string[];
		phones?: string[];
		jobTitle?: string;
	} = {},
): PersonRecord {
	return {
		id,
		filePath,
		name,
		aliases: options.aliases ?? [],
		organisations: options.organisations ?? [],
		photoPath: options.photoPath,
		birthDate: options.birthDate,
		pronouns: options.pronouns,
		gender: options.gender,
		emails: options.emails ?? [],
		phones: options.phones ?? [],
		jobTitle: options.jobTitle,
		contacts,
	};
}

export function relationship(
	id: string,
	filePath: string,
	from: string,
	to: string,
	options: Partial<Omit<RelationshipRecord, "id" | "filePath" | "from" | "to">> = {},
): RelationshipRecord {
	return {
		id,
		filePath,
		from: reference(from),
		to: reference(to),
		presetId: options.presetId,
		fromRole: options.fromRole,
		toRole: options.toRole,
		types: options.types ?? [],
		closeness: options.closeness,
		since: options.since,
		lastContact: options.lastContact,
		status: options.status,
	};
}

export interface GeneratedSnapshotCase {
	canonical: RawIndexSnapshot;
	visible: RawIndexSnapshot;
	visiblePaths: Set<string>;
	resolveLink(target: string): string | undefined;
	ids: {
		alpha: string;
		beta: string;
		duplicate: string;
		hidden: string;
		sharedLabel: string;
		unresolved: string;
		pathOwned: string;
		richRelationship: string;
		duplicateRelationship: string;
		selfRelationship: string;
		unresolvedRelationship: string;
	};
	paths: {
		alpha: string;
		beta: string;
		duplicateA: string;
		duplicateB: string;
		hidden: string;
		pathOwned: string;
	};
}

export function generatedSnapshotCase(seed: number): GeneratedSnapshotCase {
	const random = new SeededGenerator(seed);
	const suffix = random.token("case");
	const alphaId = `alpha-${suffix}`;
	const betaId = `beta-${suffix}`;
	const duplicateId = `duplicate-${suffix}`;
	const hiddenId = `hidden-${suffix}`;
	const sharedLabel = `Shared label ${suffix}`;
	const unresolved = `unresolved-${suffix}`;
	const paths = {
		alpha: `People/${suffix}/Alpha.md`,
		beta: `People/${suffix}/Beta.md`,
		duplicateA: `People/${suffix}/Duplicate A.md`,
		duplicateB: `People/${suffix}/Duplicate B.md`,
		hidden: `People/${suffix}/Hidden.md`,
	};
	const decoyAPath = `People/${suffix}/Decoy A.md`;
	const decoyBPath = `People/${suffix}/Decoy B.md`;
	const pathOwnedPath = `People/${suffix}/Path Owned.md`;
	const pathOwnedId = `path:${pathOwnedPath.toLowerCase()}`;

	const alpha = person(alphaId, paths.alpha, `Alpha ${suffix}`, [
		reference(betaId),
		reference(sharedLabel, sharedLabel),
		reference(hiddenId),
		reference(pathOwnedPath),
	]);
	const beta = person(betaId, paths.beta, `Beta ${suffix}`, [reference(duplicateId)]);
	const duplicateA = person(duplicateId, paths.duplicateA, `Duplicate A ${suffix}`);
	const duplicateB = person(duplicateId, paths.duplicateB, `Duplicate B ${suffix}`);
	const decoyA = person(`decoy-a-${suffix}`, decoyAPath, sharedLabel, [], { aliases: [sharedLabel] });
	const decoyB = person(`decoy-b-${suffix}`, decoyBPath, sharedLabel, [], { aliases: [sharedLabel] });
	const hidden = person(hiddenId, paths.hidden, `Hidden ${suffix}`, [reference(alphaId)]);
	const pathOwned = person(pathOwnedId, pathOwnedPath, `Path Owned ${suffix}`);

	const richRelationship = `rich-${suffix}`;
	const duplicateRelationship = `parallel-${suffix}`;
	const relationships = [
		relationship(richRelationship, `Relationships/${suffix}/Rich.md`, alphaId, betaId, {
			presetId: `preset-${suffix}`,
			fromRole: `mentor-${suffix}`,
			toRole: `mentee-${suffix}`,
			types: ["mentor", `seed-${seed}`],
			closeness: 1 + random.int(5),
			since: "2020-01-02",
			lastContact: "2026-07-26",
			status: random.bool() ? "active" : "dormant",
		}),
		relationship(`second-${suffix}`, `Relationships/${suffix}/Second.md`, alphaId, betaId, {
			types: ["colleague"],
		}),
		relationship(duplicateRelationship, `Relationships/${suffix}/Duplicate A.md`, alphaId, betaId, {
			types: ["friend"],
		}),
		relationship(duplicateRelationship, `Relationships/${suffix}/Duplicate B.md`, betaId, alphaId, {
			types: ["peer"],
		}),
		relationship(`self-${suffix}`, `Relationships/${suffix}/Self.md`, alphaId, alphaId),
		relationship(`missing-${suffix}`, `Relationships/${suffix}/Missing.md`, alphaId, unresolved),
		relationship(`filtered-${suffix}`, `Relationships/${suffix}/Filtered.md`, alphaId, hiddenId),
	];
	const people = random.shuffle([alpha, beta, duplicateA, duplicateB, decoyA, decoyB, hidden, pathOwned]);
	const visiblePeople = people.filter((entry) => entry.filePath !== paths.hidden);
	const canonical: RawIndexSnapshot = { people, relationships: random.shuffle(relationships), diagnostics: [] };
	const visible: RawIndexSnapshot = { people: visiblePeople, relationships: [], diagnostics: [] };
	const linkPaths = new Map<string, string>([
		[`link-alpha-${suffix}`, paths.alpha],
		[`link-beta-${suffix}`, paths.beta],
	]);

	return {
		canonical,
		visible,
		visiblePaths: new Set(visiblePeople.map((entry) => entry.filePath)),
		resolveLink: (target) => linkPaths.get(target),
		ids: {
			alpha: alphaId,
			beta: betaId,
			duplicate: duplicateId,
			hidden: hiddenId,
			sharedLabel,
			unresolved,
			pathOwned: pathOwnedId,
			richRelationship,
			duplicateRelationship,
			selfRelationship: `self-${suffix}`,
			unresolvedRelationship: `missing-${suffix}`,
		},
		paths: { ...paths, pathOwned: pathOwnedPath },
	};
}

export type GeneratedIndexOperation =
	| { kind: "upsert"; parsed: ParsedAtlasFile; additionalAffectedPaths?: string[] }
	| { kind: "remove"; path: string; additionalAffectedPaths?: string[] }
	| { kind: "clear" };

function generatedDiagnostic(seed: number, filePath: string, variant: number): AtlasDiagnostic {
	return {
		id: `generated-diagnostic:${seed}:${variant}:${filePath}`,
		severity: variant % 2 === 0 ? "warning" : "info",
		code: "missing-asset",
		message: `Generated diagnostic ${variant} for seed ${seed}.`,
		filePaths: [filePath],
		targetPath: `Assets/generated-${seed}-${variant}.png`,
	};
}

export function generatedIndexOperations(seed: number): GeneratedIndexOperation[] {
	const random = new SeededGenerator(seed);
	const suffix = random.token("index");
	const alicePath = `People/${suffix}/Alice.md`;
	const bobPath = `People/${suffix}/Bob.md`;
	const carolPath = `People/${suffix}/Carol.md`;
	const duplicatePath = `People/${suffix}/Duplicate.md`;
	const relationshipPath = `Relationships/${suffix}/Alice-Bob.md`;
	const duplicateRelationshipPath = `Relationships/${suffix}/Duplicate.md`;
	const diagnosticPath = `Notes/${suffix}/Diagnostics.md`;
	const alice = person(`alice-${suffix}`, alicePath, `Alice ${suffix}`, [], {
		photoPath: `Assets/${suffix}/alice.png`,
	});
	const bob = person(`bob-${suffix}`, bobPath, `Bob ${suffix}`);
	const carol = person(`carol-${suffix}`, carolPath, `Carol ${suffix}`, [reference(alice.id)]);
	const rel = relationship(`rel-${suffix}`, relationshipPath, alice.id, bob.id);

	return [
		{
			kind: "upsert",
			parsed: { filePath: diagnosticPath, diagnostics: [generatedDiagnostic(seed, diagnosticPath, 1)] },
		},
		{ kind: "upsert", parsed: { filePath: alicePath, person: alice, diagnostics: [] } },
		{ kind: "upsert", parsed: { filePath: bobPath, person: bob, diagnostics: [] } },
		{ kind: "upsert", parsed: { filePath: carolPath, person: carol, diagnostics: [] } },
		{ kind: "upsert", parsed: { filePath: relationshipPath, relationship: rel, diagnostics: [] } },
		{
			kind: "upsert",
			parsed: {
				filePath: duplicatePath,
				person: person(alice.id, duplicatePath, `Duplicate ${suffix}`),
				diagnostics: [],
			},
		},
		{
			kind: "upsert",
			parsed: {
				filePath: duplicateRelationshipPath,
				relationship: relationship(rel.id, duplicateRelationshipPath, alice.id, bob.id),
				diagnostics: [],
			},
		},
		{
			kind: "upsert",
			parsed: {
				filePath: alicePath,
				person: person(`alice-new-${suffix}`, alicePath, `Alice ${suffix}`, [reference(bob.id)], {
					photoPath: `Assets/${suffix}/alice-new.png`,
				}),
				diagnostics: [],
			},
			additionalAffectedPaths: [`Metadata/${suffix}/Alice backlinks.md`],
		},
		{
			kind: "upsert",
			parsed: {
				filePath: carolPath,
				person: person(carol.id, carolPath, carol.name, [reference(`alice-new-${suffix}`), reference(bobPath)]),
				diagnostics: [generatedDiagnostic(seed, carolPath, 2)],
			},
		},
		{
			kind: "upsert",
			parsed: {
				filePath: relationshipPath,
				relationship: relationship(`rel-new-${suffix}`, relationshipPath, bob.id, carol.id),
				diagnostics: [],
			},
		},
		{ kind: "remove", path: duplicatePath },
		{ kind: "remove", path: duplicateRelationshipPath },
		{ kind: "clear" },
		{ kind: "upsert", parsed: { filePath: bobPath, person: bob, diagnostics: [] } },
		{ kind: "upsert", parsed: { filePath: alicePath, person: alice, diagnostics: [] } },
		{ kind: "upsert", parsed: { filePath: relationshipPath, relationship: rel, diagnostics: [] } },
		{ kind: "remove", path: alicePath, additionalAffectedPaths: [`Manual/${suffix}/dependent.md`] },
		{ kind: "remove", path: diagnosticPath },
		{ kind: "remove", path: `Missing/${suffix}/${random.int(10)}.md` },
		{
			kind: "upsert",
			parsed: { filePath: diagnosticPath, diagnostics: [generatedDiagnostic(seed, diagnosticPath, 3)] },
		},
	];
}

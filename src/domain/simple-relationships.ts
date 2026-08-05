export type SimpleRelationshipChoice = "custom" | "parent" | "child" | "sibling" | "partner";

export interface SimpleRelationshipRoles {
	fromRole: string;
	toRole: string;
}

const SIMPLE_RELATIONSHIP_ROLES: Record<Exclude<SimpleRelationshipChoice, "custom">, SimpleRelationshipRoles> = {
	parent: { fromRole: "parent", toRole: "child" },
	child: { fromRole: "child", toRole: "parent" },
	sibling: { fromRole: "sibling", toRole: "sibling" },
	partner: { fromRole: "partner", toRole: "partner" },
};

const FAMILY_TERMS = {
	parent: { woman: "mother", man: "father" },
	child: { woman: "daughter", man: "son" },
	sibling: { woman: "sister", man: "brother" },
} as const;

export type DerivedFamilyRelationshipTerm =
	(typeof FAMILY_TERMS)[keyof typeof FAMILY_TERMS][keyof (typeof FAMILY_TERMS)[keyof typeof FAMILY_TERMS]];

export function deriveSimpleRelationshipChoice(fromRole: string, toRole: string): SimpleRelationshipChoice {
	const from = fromRole.trim();
	const to = toRole.trim();
	if (from === "parent" && to === "child") return "parent";
	if (from === "child" && to === "parent") return "child";
	if (from === "sibling" && to === "sibling") return "sibling";
	if (from === "partner" && to === "partner") return "partner";
	return "custom";
}

export function getSimpleRelationshipRoles(choice: SimpleRelationshipChoice): SimpleRelationshipRoles | undefined {
	const roles = choice === "custom" ? undefined : SIMPLE_RELATIONSHIP_ROLES[choice];
	return roles ? { ...roles } : undefined;
}

export function deriveFamilyRelationshipTerm(role: string, gender: string | undefined): string {
	if (role !== "parent" && role !== "child" && role !== "sibling") return role;
	const normalizedGender = gender?.trim().toLowerCase();
	if (normalizedGender !== "woman" && normalizedGender !== "man") return role;
	return FAMILY_TERMS[role][normalizedGender];
}

export function isDerivedFamilyRelationshipTerm(term: string): term is DerivedFamilyRelationshipTerm {
	return (
		term === "mother" ||
		term === "father" ||
		term === "daughter" ||
		term === "son" ||
		term === "sister" ||
		term === "brother"
	);
}

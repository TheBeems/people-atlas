import { describe, expect, it } from "vitest";
import {
	deriveFamilyRelationshipTerm,
	deriveSimpleRelationshipChoice,
	getSimpleRelationshipRoles,
} from "../src/domain/simple-relationships";

describe("simple relationship contract", () => {
	it.each([
		["parent", "child", "parent"],
		["child", "parent", "child"],
		["sibling", "sibling", "sibling"],
	] as const)("derives %s/%s as %s", (fromRole, toRole, choice) => {
		expect(deriveSimpleRelationshipChoice(` ${fromRole} `, ` ${toRole} `)).toBe(choice);
	});

	it.each([
		["", "", "custom"],
		["Parent", "child", "custom"],
		["mother", "daughter", "custom"],
		["mentor", "mentee", "custom"],
	] as const)("keeps the literal pair %s/%s custom", (fromRole, toRole, choice) => {
		expect(deriveSimpleRelationshipChoice(fromRole, toRole)).toBe(choice);
	});

	it("maps only supported choices to reciprocal neutral roles", () => {
		expect(getSimpleRelationshipRoles("parent")).toEqual({ fromRole: "parent", toRole: "child" });
		expect(getSimpleRelationshipRoles("child")).toEqual({ fromRole: "child", toRole: "parent" });
		expect(getSimpleRelationshipRoles("sibling")).toEqual({ fromRole: "sibling", toRole: "sibling" });
		expect(getSimpleRelationshipRoles("custom")).toBeUndefined();
	});

	it.each([
		["parent", "woman", "mother"],
		["parent", "man", "father"],
		["child", "woman", "daughter"],
		["child", "man", "son"],
		["sibling", "woman", "sister"],
		["sibling", "man", "brother"],
		["parent", "  WoMaN  ", "mother"],
		["child", " MAN ", "son"],
		["sibling", undefined, "sibling"],
		["parent", "non-binary", "parent"],
		["child", "female", "child"],
		["mentor", "woman", "mentor"],
		["Parent", "woman", "Parent"],
	] as const)("presents %s with gender %s as %s", (role, gender, expected) => {
		expect(deriveFamilyRelationshipTerm(role, gender)).toBe(expected);
	});
});

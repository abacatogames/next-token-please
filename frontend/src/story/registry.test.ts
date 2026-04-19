import { afterEach, describe, expect, test } from "bun:test";
import type { Chapter, Round } from "../types.ts";
import {
	clearChapters,
	getChapter,
	listChapters,
	registerChapter,
} from "./registry.ts";

const stubRound: Round = { id: "r", prompt: "p", tokens: [] };
const stubChapter: Chapter = {
	id: "ch1",
	title: "Chapter One",
	roundProvider: () => Promise.resolve(stubRound),
};

describe("story registry", () => {
	afterEach(() => {
		clearChapters();
	});

	test("registers and retrieves a chapter", () => {
		registerChapter(stubChapter);
		expect(getChapter("ch1")).toBe(stubChapter);
	});

	test("returns null for unknown chapter", () => {
		expect(getChapter("nope")).toBeNull();
	});

	test("lists all registered chapters", () => {
		registerChapter(stubChapter);
		registerChapter({ ...stubChapter, id: "ch2", title: "Two" });
		expect(listChapters().map((c) => c.id)).toEqual(["ch1", "ch2"]);
	});
});

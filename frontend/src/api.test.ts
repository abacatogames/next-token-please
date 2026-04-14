import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { fetchRound } from "./api.ts";
import { mockRounds } from "./mock-rounds.ts";

afterEach(() => {
	mock.restore();
});

describe("fetchRound without baseUrl", () => {
	test("returns a mock round", async () => {
		const round = await fetchRound(0.5, undefined);
		expect(mockRounds).toContain(round);
	});

	test("cycles through mocks on repeated calls", async () => {
		const first = await fetchRound(0.5, undefined);
		const second = await fetchRound(0.5, undefined);
		const firstIdx = mockRounds.indexOf(first);
		const secondIdx = mockRounds.indexOf(second);
		expect(secondIdx).toBe((firstIdx + 1) % mockRounds.length);
	});
});

describe("fetchRound with baseUrl", () => {
	test("returns backend round on success", async () => {
		const backendRound = {
			id: "backend-1",
			prompt: "hello",
			tokens: [{ kind: "reveal" as const, word: "hi" }],
		};
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify(backendRound), { status: 200 }),
		);

		const round = await fetchRound(0.3, "http://api.test");
		expect(round).toEqual(backendRound);
	});

	test("passes difficulty in query string", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ id: "x", prompt: "p", tokens: [] }), {
				status: 200,
			}),
		);

		await fetchRound(0.42, "http://api.test");
		expect(fetchSpy).toHaveBeenCalledWith(
			"http://api.test/round?difficulty=0.42",
		);
	});

	test("falls back to mock on non-ok response", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("boom", { status: 500 }),
		);
		spyOn(console, "warn").mockImplementation(() => {});

		const round = await fetchRound(0.5, "http://api.test");
		expect(mockRounds).toContain(round);
	});

	test("falls back to mock when fetch rejects", async () => {
		spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
		spyOn(console, "warn").mockImplementation(() => {});

		const round = await fetchRound(0.5, "http://api.test");
		expect(mockRounds).toContain(round);
	});
});

import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { fetchRound } from "./api.ts";
import { mockRounds } from "./mock-rounds.ts";

afterEach(() => {
	mock.restore();
});

describe("fetchRound without baseUrl", () => {
	test("returns a mock round tagged local", async () => {
		const { round, source } = await fetchRound(0.5, undefined);
		expect(mockRounds).toContain(round);
		expect(source).toBe("local");
	});

	test("cycles through mocks on repeated calls", async () => {
		const first = (await fetchRound(0.5, undefined)).round;
		const second = (await fetchRound(0.5, undefined)).round;
		const firstIdx = mockRounds.indexOf(first);
		const secondIdx = mockRounds.indexOf(second);
		expect(secondIdx).toBe((firstIdx + 1) % mockRounds.length);
	});
});

describe("fetchRound with baseUrl", () => {
	test("returns backend round tagged backend on success", async () => {
		const backendRound = {
			id: "backend-1",
			prompt: "hello",
			tokens: [{ kind: "reveal" as const, word: "hi" }],
		};
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify(backendRound), { status: 200 }),
		);

		const { round, source } = await fetchRound(0.3, "http://api.test");
		expect(round).toEqual(backendRound);
		expect(source).toBe("backend");
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

	test("falls back to mock tagged fallback on non-ok response", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("boom", { status: 500 }),
		);
		spyOn(console, "warn").mockImplementation(() => {});

		const { round, source } = await fetchRound(0.5, "http://api.test");
		expect(mockRounds).toContain(round);
		expect(source).toBe("fallback");
	});

	test("falls back tagged fallback when fetch rejects", async () => {
		spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
		spyOn(console, "warn").mockImplementation(() => {});

		const { round, source } = await fetchRound(0.5, "http://api.test");
		expect(mockRounds).toContain(round);
		expect(source).toBe("fallback");
	});
});

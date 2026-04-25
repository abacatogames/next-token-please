import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { fetchRound } from "./api.ts";
import { mockRounds } from "./mock-rounds.ts";

const env = import.meta.env as Record<string, string | undefined>;

afterEach(() => {
	mock.restore();
	delete env.VITE_API_BASE_URL;
});

describe("fetchRound", () => {
	test("returns backend round tagged backend on success", async () => {
		const backendRound = {
			id: "backend-1",
			prompt: "hello",
			tokens: [{ kind: "reveal" as const, word: "hi", leading_space: false }],
		};
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify(backendRound), { status: 200 }),
		);

		const { round, source } = await fetchRound(0.3);
		expect(round).toEqual(backendRound);
		expect(source).toBe("backend");
	});

	test("passes difficulty in query string to relative /api path", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ id: "x", prompt: "p", tokens: [] }), {
				status: 200,
			}),
		);

		await fetchRound(0.42);
		expect(fetchSpy).toHaveBeenCalledWith("/api/round?difficulty=0.42");
	});

	test("prefixes VITE_API_BASE_URL when set", async () => {
		env.VITE_API_BASE_URL = "https://api.example.com";
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ id: "x", prompt: "p", tokens: [] }), {
				status: 200,
			}),
		);

		await fetchRound(0.5);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.example.com/api/round?difficulty=0.5",
		);
	});

	test("falls back to mock tagged fallback on non-ok response", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("boom", { status: 500 }),
		);
		spyOn(console, "warn").mockImplementation(() => {});

		const { round, source } = await fetchRound(0.5);
		expect(mockRounds).toContain(round);
		expect(source).toBe("fallback");
	});

	test("falls back tagged fallback when fetch rejects", async () => {
		spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
		spyOn(console, "warn").mockImplementation(() => {});

		const { round, source } = await fetchRound(0.5);
		expect(mockRounds).toContain(round);
		expect(source).toBe("fallback");
	});
});

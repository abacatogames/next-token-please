import { afterEach, describe, expect, test } from "bun:test";
import { SceneManager } from "./sceneManager.ts";
import {
	clearTransitions,
	registerTransition,
	type SceneTransition,
} from "./transitions.ts";
import type { Scene } from "./types.ts";

function makeScene(id: string, log: string[]): Scene<number> {
	return {
		id,
		mount: (_root, s) => log.push(`${id}:mount:${s}`),
		update: (s) => log.push(`${id}:update:${s}`),
		unmount: () => log.push(`${id}:unmount`),
	};
}

describe("SceneManager.transitionTo", () => {
	afterEach(() => {
		clearTransitions();
	});

	test("runs registered transition out then in", async () => {
		const log: string[] = [];
		const root = {} as HTMLElement;
		const transition: SceneTransition = (_r, dir) => {
			log.push(`tr:${dir}`);
			return Promise.resolve();
		};
		registerTransition("chapter", transition);

		const m = new SceneManager<number>(root);
		m.register(makeScene("a", log));
		m.register(makeScene("b", log));
		m.goto("a", 1);
		await m.transitionTo("b", 2, { via: "chapter" });

		expect(log).toEqual([
			"a:mount:1",
			"tr:out",
			"a:unmount",
			"b:mount:2",
			"tr:in",
		]);
	});

	test("skips out transition on first mount", async () => {
		const log: string[] = [];
		registerTransition("chapter", (_r, dir) => {
			log.push(`tr:${dir}`);
		});

		const m = new SceneManager<number>({} as HTMLElement);
		m.register(makeScene("a", log));
		await m.transitionTo("a", 1, { via: "chapter" });

		expect(log).toEqual(["a:mount:1", "tr:in"]);
	});

	test("no registered transition falls back to plain swap", async () => {
		const log: string[] = [];
		const m = new SceneManager<number>({} as HTMLElement);
		m.register(makeScene("a", log));
		m.register(makeScene("b", log));
		m.goto("a", 1);
		await m.transitionTo("b", 2, { via: "chapter" });

		expect(log).toEqual(["a:mount:1", "a:unmount", "b:mount:2"]);
	});

	test("same-scene transition just updates", async () => {
		const log: string[] = [];
		registerTransition("chapter", (_r, dir) => {
			log.push(`tr:${dir}`);
		});

		const m = new SceneManager<number>({} as HTMLElement);
		m.register(makeScene("a", log));
		m.goto("a", 1);
		await m.transitionTo("a", 2, { via: "chapter" });

		expect(log).toEqual(["a:mount:1", "a:update:2"]);
	});
});

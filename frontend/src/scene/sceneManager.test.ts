import { beforeEach, describe, expect, test } from "bun:test";
import { SceneManager } from "./sceneManager.ts";
import type { Scene } from "./types.ts";

function makeScene(id: string, log: string[]): Scene<number> {
	return {
		id,
		mount: (_root, s) => log.push(`${id}:mount:${s}`),
		update: (s) => log.push(`${id}:update:${s}`),
		unmount: () => log.push(`${id}:unmount`),
	};
}

describe("SceneManager", () => {
	let root: HTMLElement;
	let log: string[];

	beforeEach(() => {
		root = {} as HTMLElement;
		log = [];
	});

	test("mounts registered scene on first goto", () => {
		const m = new SceneManager<number>(root);
		m.register(makeScene("a", log));
		m.goto("a", 1);
		expect(log).toEqual(["a:mount:1"]);
		expect(m.activeId).toBe("a");
	});

	test("updates (no remount) when targeting active scene", () => {
		const m = new SceneManager<number>(root);
		m.register(makeScene("a", log));
		m.goto("a", 1);
		m.goto("a", 2);
		m.goto("a", 3);
		expect(log).toEqual(["a:mount:1", "a:update:2", "a:update:3"]);
	});

	test("unmounts previous scene before mounting new one", () => {
		const m = new SceneManager<number>(root);
		m.register(makeScene("a", log));
		m.register(makeScene("b", log));
		m.goto("a", 1);
		m.goto("b", 2);
		expect(log).toEqual(["a:mount:1", "a:unmount", "b:mount:2"]);
		expect(m.activeId).toBe("b");
	});

	test("throws on unknown scene", () => {
		const m = new SceneManager<number>(root);
		expect(() => m.goto("missing", 0)).toThrow(/Unknown scene/);
	});

	test("update() forwards to current scene", () => {
		const m = new SceneManager<number>(root);
		m.register(makeScene("a", log));
		m.goto("a", 1);
		m.update(7);
		expect(log).toEqual(["a:mount:1", "a:update:7"]);
	});

	test("update() is a no-op when no current scene", () => {
		const m = new SceneManager<number>(root);
		m.update(0);
		expect(log).toEqual([]);
		expect(m.activeId).toBeNull();
	});

	test("scenes without update/unmount work", () => {
		const m = new SceneManager<number>(root);
		let mounted = 0;
		m.register({ id: "minimal", mount: () => { mounted++; } });
		m.register(makeScene("b", log));
		m.goto("minimal", 1);
		m.goto("minimal", 2);
		m.goto("b", 3);
		expect(mounted).toBe(1);
		expect(log).toEqual(["b:mount:3"]);
	});
});

import { beforeEach, describe, expect, test } from "bun:test";
import {
	audio,
	effectiveGain,
	isThrottled,
	SFX_MIN_GAP_MS,
} from "./audio.ts";

class MemoryStorage implements Storage {
	private store = new Map<string, string>();
	get length() {
		return this.store.size;
	}
	clear() {
		this.store.clear();
	}
	getItem(k: string) {
		return this.store.get(k) ?? null;
	}
	setItem(k: string, v: string) {
		this.store.set(k, v);
	}
	removeItem(k: string) {
		this.store.delete(k);
	}
	key(i: number) {
		return Array.from(this.store.keys())[i] ?? null;
	}
}

beforeEach(() => {
	(globalThis as { localStorage: Storage }).localStorage = new MemoryStorage();
});

describe("effectiveGain", () => {
	test("muted is silent regardless of volume", () => {
		expect(effectiveGain({ volume: 1, muted: true })).toBe(0);
	});

	test("scales volume below unity", () => {
		expect(effectiveGain({ volume: 1, muted: false })).toBeLessThan(1);
		expect(effectiveGain({ volume: 1, muted: false })).toBeGreaterThan(0);
	});

	test("zero volume is silent", () => {
		expect(effectiveGain({ volume: 0, muted: false })).toBe(0);
	});

	test("clamps out-of-range volume", () => {
		expect(effectiveGain({ volume: 5, muted: false })).toBe(
			effectiveGain({ volume: 1, muted: false }),
		);
	});
});

describe("isThrottled", () => {
	test("blocks plays inside the minimum gap", () => {
		expect(isThrottled(100, 120, SFX_MIN_GAP_MS.type)).toBe(true);
	});

	test("allows plays past the minimum gap", () => {
		expect(isThrottled(100, 100 + SFX_MIN_GAP_MS.type, SFX_MIN_GAP_MS.type)).toBe(
			false,
		);
	});

	test("confirm has no gap", () => {
		expect(isThrottled(100, 100, SFX_MIN_GAP_MS.confirm)).toBe(false);
	});
});

describe("audio engine without AudioContext", () => {
	test("play is a no-op before unlock", () => {
		expect(() => audio.play("type")).not.toThrow();
		expect(() => audio.play("hover")).not.toThrow();
		expect(() => audio.play("confirm")).not.toThrow();
	});

	test("ambience controls are no-ops before unlock", () => {
		expect(() => audio.startAmbience()).not.toThrow();
		expect(() => audio.stopAmbience()).not.toThrow();
	});

	test("attachUnlock is a no-op when AudioContext is unsupported", () => {
		expect(() => audio.attachUnlock()).not.toThrow();
	});

	test("setVolume and setMuted persist prefs without a context", () => {
		audio.setVolume(0.25);
		audio.setMuted(true);
		expect(audio.getPrefs()).toEqual({ volume: 0.25, muted: true });
		audio.setMuted(false);
		expect(audio.getPrefs().muted).toBe(false);
	});

	test("getPrefs returns a copy, not internal state", () => {
		const p = audio.getPrefs();
		p.volume = 0;
		expect(audio.getPrefs().volume).not.toBe(0);
	});
});

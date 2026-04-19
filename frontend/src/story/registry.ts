import type { Chapter } from "../types.ts";

/**
 * Reserved seam for future narrative chapters.
 *
 * Chapters supply their own `roundProvider`. The runtime currently calls
 * `fetchRound` directly; no chapters are registered yet.
 */
const registry = new Map<string, Chapter>();

export function registerChapter(chapter: Chapter): void {
	registry.set(chapter.id, chapter);
}

export function getChapter(id: string): Chapter | null {
	return registry.get(id) ?? null;
}

export function listChapters(): Chapter[] {
	return [...registry.values()];
}

export function clearChapters(): void {
	registry.clear();
}

export type InferenceChapter = {
	index: number;
	title: string;
	rounds: number;
	requiredPercent: number;
};

export const INFERENCE_RUN: InferenceChapter[] = [
	{ index: 0, title: "Chapter 1 — Warm Up", rounds: 3, requiredPercent: 50 },
	{ index: 1, title: "Chapter 2", rounds: 5, requiredPercent: 60 },
	{ index: 2, title: "Chapter 3", rounds: 10, requiredPercent: 75 },
	{ index: 3, title: "Chapter 4", rounds: 7, requiredPercent: 90 },
	{ index: 4, title: "Chapter 5 — Final", rounds: 5, requiredPercent: 100 },
];

export const FINAL_CHAPTER_INDEX = INFERENCE_RUN.length - 1;

export function getChapter(index: number): InferenceChapter | null {
	return INFERENCE_RUN[index] ?? null;
}

export type InferenceChapter = {
	index: number;
	title: string;
	rounds: number;
	requiredPercent: number;
	difficulty: number;
};

export const INFERENCE_RUN: InferenceChapter[] = [
	{ index: 0, title: "Pretraining", rounds: 3, requiredPercent: 50, difficulty: 0.8 },
	{ index: 1, title: "Fine-Tuning", rounds: 3, requiredPercent: 60, difficulty: 0.9 },
	{ index: 2, title: "Decoding", rounds: 3, requiredPercent: 75, difficulty: 1.0 },
	{ index: 3, title: "Alignment", rounds: 2, requiredPercent: 90, difficulty: 1.0 },
	{ index: 4, title: "Singularity", rounds: 1, requiredPercent: 100, difficulty: 1.0 },
];

export const FINAL_CHAPTER_INDEX = INFERENCE_RUN.length - 1;

export function getChapter(index: number): InferenceChapter | null {
	return INFERENCE_RUN[index] ?? null;
}

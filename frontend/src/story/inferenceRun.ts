export type InferenceChapter = {
	index: number;
	title: string;
	rounds: number;
	requiredPercent: number;
};

export const INFERENCE_RUN: InferenceChapter[] = [
	{ index: 0, title: "Pretraining", rounds: 3, requiredPercent: 50 },
	{ index: 1, title: "Fine-Tuning", rounds: 5, requiredPercent: 60 },
	{ index: 2, title: "Decoding", rounds: 10, requiredPercent: 75 },
	{ index: 3, title: "Alignment", rounds: 5, requiredPercent: 90 },
	{ index: 4, title: "Singularity", rounds: 3, requiredPercent: 100 },
];

export const FINAL_CHAPTER_INDEX = INFERENCE_RUN.length - 1;

export function getChapter(index: number): InferenceChapter | null {
	return INFERENCE_RUN[index] ?? null;
}

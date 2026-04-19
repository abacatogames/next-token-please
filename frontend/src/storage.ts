const BEST_KEY = "ntp.bestRun";

export type BestRun = {
	percent: number;
	correct: number;
	total: number;
};

export function loadBestRun(): BestRun | null {
	try {
		const raw = localStorage.getItem(BEST_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (
			parsed &&
			typeof parsed === "object" &&
			typeof (parsed as BestRun).percent === "number" &&
			typeof (parsed as BestRun).correct === "number" &&
			typeof (parsed as BestRun).total === "number"
		) {
			return parsed as BestRun;
		}
		return null;
	} catch {
		return null;
	}
}

export function saveBestRun(run: BestRun): void {
	try {
		localStorage.setItem(BEST_KEY, JSON.stringify(run));
	} catch {
		/* localStorage unavailable (private mode, quota, etc.) — silently skip */
	}
}

export function isNewBest(current: BestRun, previous: BestRun | null): boolean {
	if (!previous) return true;
	return current.percent > previous.percent;
}

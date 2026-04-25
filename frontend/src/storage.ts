import type {
	CampaignRun,
	GameMode,
	GamePhase,
	GameState,
	PlayerChoice,
	Round,
	Token,
} from "./types.ts";

const BEST_KEY = "ntp.bestRun";
const SESSION_KEY = "ntp.session.v1";
const SESSION_SCHEMA = 1;

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

export type SavedSession = {
	schemaVersion: typeof SESSION_SCHEMA;
	savedAt: number;
	mode: GameMode;
	phase: GamePhase;
	round: Round | null;
	tokenIndex: number;
	playerChoices: PlayerChoice[];
	revealedWords: string[];
	campaign?: CampaignRun;
};

const VALID_PHASES: ReadonlySet<GamePhase> = new Set<GamePhase>([
	"idle",
	"typing_prompt",
	"revealing",
	"awaiting_choice",
	"finished",
	"chapter_intro",
	"round_recap",
	"chapter_passed",
	"chapter_failed",
	"campaign_won",
]);

const VALID_MODES: ReadonlySet<GameMode> = new Set<GameMode>([
	"endless",
	"campaign",
]);


export function saveSession(state: GameState): void {
	try {
		const payload: SavedSession = {
			schemaVersion: SESSION_SCHEMA,
			savedAt: Date.now(),
			mode: state.mode,
			phase: state.phase,
			round: state.round,
			tokenIndex: state.tokenIndex,
			playerChoices: state.playerChoices,
			revealedWords: state.revealedWords,
			...(state.campaign ? { campaign: state.campaign } : {}),
		};
		localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
	} catch {
		/* localStorage unavailable — silently skip */
	}
}

export function loadSession(): SavedSession | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		const session = parseSession(parsed);
		if (!session) {
			clearSession();
			return null;
		}
		return session;
	} catch {
		clearSession();
		return null;
	}
}

export function clearSession(): void {
	try {
		localStorage.removeItem(SESSION_KEY);
	} catch {
		/* localStorage unavailable — silently skip */
	}
}

export function sessionToGameState(session: SavedSession): GameState {
	const state: GameState = {
		phase: session.phase,
		mode: session.mode,
		round: session.round,
		tokenIndex: session.tokenIndex,
		playerChoices: session.playerChoices,
		revealedWords: session.revealedWords,
	};
	if (session.campaign) state.campaign = session.campaign;
	return state;
}

function parseSession(value: unknown): SavedSession | null {
	if (!isObject(value)) return null;
	if (value.schemaVersion !== SESSION_SCHEMA) return null;
	if (typeof value.savedAt !== "number") return null;

	const mode = value.mode;
	if (typeof mode !== "string" || !VALID_MODES.has(mode as GameMode)) return null;

	const phase = value.phase;
	if (typeof phase !== "string" || !VALID_PHASES.has(phase as GamePhase))
		return null;

	if (typeof value.tokenIndex !== "number" || !Number.isInteger(value.tokenIndex))
		return null;
	if (value.tokenIndex < 0) return null;

	const round = parseRound(value.round);
	if (round === undefined) return null;

	if (!Array.isArray(value.revealedWords)) return null;
	if (!value.revealedWords.every((w) => typeof w === "string")) return null;

	if (!Array.isArray(value.playerChoices)) return null;
	const choices: PlayerChoice[] = [];
	for (const raw of value.playerChoices) {
		const pc = parsePlayerChoice(raw);
		if (!pc) return null;
		choices.push(pc);
	}

	let campaign: CampaignRun | undefined;
	if (mode === "campaign") {
		const parsed = parseCampaign(value.campaign);
		if (!parsed) return null;
		campaign = parsed;
	} else if (value.campaign !== undefined) {
		return null;
	}

	return {
		schemaVersion: SESSION_SCHEMA,
		savedAt: value.savedAt,
		mode: mode as GameMode,
		phase: phase as GamePhase,
		round,
		tokenIndex: value.tokenIndex,
		playerChoices: choices,
		revealedWords: value.revealedWords,
		...(campaign ? { campaign } : {}),
	};
}

function parseRound(value: unknown): Round | null | undefined {
	if (value === null) return null;
	if (!isObject(value)) return undefined;
	if (typeof value.id !== "string") return undefined;
	if (typeof value.prompt !== "string") return undefined;
	if (!Array.isArray(value.tokens)) return undefined;

	const tokens: Token[] = [];
	for (const raw of value.tokens) {
		const token = parseToken(raw);
		if (!token) return undefined;
		tokens.push(token);
	}

	const round: Round = { id: value.id, prompt: value.prompt, tokens };
	if (value.personality !== undefined) {
		if (typeof value.personality !== "string") return undefined;
		round.personality = value.personality as Round["personality"];
	}
	return round;
}

function parseToken(value: unknown): Token | null {
	if (!isObject(value)) return null;
	if (typeof value.leading_space !== "boolean") return null;
	if (value.kind === "reveal") {
		if (typeof value.word !== "string") return null;
		return {
			kind: "reveal",
			word: value.word,
			leading_space: value.leading_space,
		};
	}
	if (value.kind === "choice") {
		if (typeof value.correct !== "string") return null;
		const distractors: unknown = value.distractors;
		if (!Array.isArray(distractors) || distractors.length !== 2) return null;
		const a: unknown = distractors[0];
		const b: unknown = distractors[1];
		if (typeof a !== "string" || typeof b !== "string") return null;
		return {
			kind: "choice",
			correct: value.correct,
			distractors: [a, b],
			leading_space: value.leading_space,
		};
	}
	return null;
}

function parsePlayerChoice(value: unknown): PlayerChoice | null {
	if (!isObject(value)) return null;
	if (
		typeof value.tokenIndex !== "number" ||
		!Number.isInteger(value.tokenIndex)
	)
		return null;
	if (typeof value.picked !== "string") return null;
	if (typeof value.correct !== "string") return null;
	return {
		tokenIndex: value.tokenIndex,
		picked: value.picked,
		correct: value.correct,
	};
}

function parseCampaign(value: unknown): CampaignRun | null {
	if (!isObject(value)) return null;
	const fields = ["chapterIndex", "roundInChapter", "chapterCorrect", "chapterTotal"] as const;
	for (const f of fields) {
		const v = value[f];
		if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return null;
	}
	return {
		chapterIndex: value.chapterIndex as number,
		roundInChapter: value.roundInChapter as number,
		chapterCorrect: value.chapterCorrect as number,
		chapterTotal: value.chapterTotal as number,
	};
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

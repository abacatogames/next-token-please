export type Token =
	| { kind: "reveal"; word: string }
	| { kind: "choice"; correct: string; distractors: [string, string] };

export type Personality = string;

export type Round = {
	id: string;
	prompt: string;
	tokens: Token[];
	personality?: Personality;
};

export type GamePhase =
	| "idle"
	| "typing_prompt"
	| "revealing"
	| "awaiting_choice"
	| "finished"
	| "chapter_intro"
	| "round_recap"
	| "chapter_passed"
	| "chapter_failed"
	| "campaign_won";

export type GameMode = "endless" | "campaign";

export type PlayerChoice = {
	tokenIndex: number;
	picked: string;
	correct: string;
};

export type RoundProvider = () => Promise<Round>;

export type Chapter = {
	id: string;
	title: string;
	roundProvider: RoundProvider;
};

export type CampaignRun = {
	chapterIndex: number;
	roundInChapter: number;
	chapterCorrect: number;
	chapterTotal: number;
};

export type GameState = {
	phase: GamePhase;
	mode: GameMode;
	round: Round | null;
	tokenIndex: number;
	playerChoices: PlayerChoice[];
	revealedWords: string[];
	campaign?: CampaignRun;
	chapter?: Chapter;
};

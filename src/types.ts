export type Token =
  | { kind: "reveal"; word: string }
  | { kind: "choice"; correct: string; distractors: [string, string] };

export type Round = {
  id: string;
  prompt: string;
  tokens: Token[];
};

export type GamePhase = "idle" | "revealing" | "awaiting_choice" | "finished";

export type PlayerChoice = {
  tokenIndex: number;
  picked: string;
  correct: string;
};

export type GameState = {
  phase: GamePhase;
  round: Round | null;
  tokenIndex: number;
  playerChoices: PlayerChoice[];
  revealedWords: string[];
};

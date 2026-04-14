from typing import Annotated, Literal

from pydantic import BaseModel, Field


class RevealToken(BaseModel):
    kind: Literal["reveal"] = "reveal"
    word: str


class ChoiceToken(BaseModel):
    kind: Literal["choice"] = "choice"
    correct: str
    distractors: tuple[str, str]


Token = Annotated[RevealToken | ChoiceToken, Field(discriminator="kind")]


class Round(BaseModel):
    id: str
    prompt: str
    tokens: list[Token]


class PromptSummary(BaseModel):
    id: str
    prompt: str


class Health(BaseModel):
    ok: bool
    model: str
    ollama_reachable: bool

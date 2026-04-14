from dataclasses import dataclass


@dataclass(frozen=True)
class Prompt:
    id: str
    text: str


PROMPTS: list[Prompt] = [
    Prompt("sky-blue", "Explain why the sky is blue."),
    Prompt("list-vs-tuple", "What is the difference between a list and a tuple in Python?"),
    Prompt("photosynthesis", "How does photosynthesis work?"),
    Prompt("dreams", "Why do we dream?"),
    Prompt("neural-net", "Explain how a neural network learns."),
    Prompt("ocean-tides", "What causes ocean tides?"),
    Prompt("encryption", "How does encryption keep data safe?"),
]


def get(prompt_id: str) -> Prompt | None:
    return next((p for p in PROMPTS if p.id == prompt_id), None)

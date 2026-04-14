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
    Prompt("black-holes", "What is a black hole?"),
    Prompt("dna", "What does DNA do inside a cell?"),
    Prompt("rainbows", "Why do rainbows form after rain?"),
    Prompt("earthquakes", "What causes earthquakes?"),
    Prompt("muscle-growth", "How do muscles grow from exercise?"),
    Prompt("volcanoes", "Why do volcanoes erupt?"),
    Prompt("compiler", "What does a compiler do?"),
    Prompt("recursion", "Explain recursion in simple terms."),
    Prompt("git-branches", "What is a branch in Git?"),
    Prompt("vaccines", "How do vaccines work?"),
    Prompt("inflation", "What causes inflation in an economy?"),
    Prompt("tcp-vs-udp", "What is the difference between TCP and UDP?"),
    Prompt("evolution", "How does natural selection drive evolution?"),
    Prompt("seasons", "Why does Earth have seasons?"),
    Prompt("memory-hierarchy", "What is the memory hierarchy in a computer?"),
    Prompt("gravity", "What is gravity?"),
    Prompt("sleep-cycles", "Why do humans need sleep?"),
    Prompt("blockchain", "How does a blockchain work?"),
]


def get(prompt_id: str) -> Prompt | None:
    return next((p for p in PROMPTS if p.id == prompt_id), None)

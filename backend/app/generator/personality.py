import random
from dataclasses import dataclass

_FORMAT_REMINDER = (
    "Keep the required format: 40 to 60 words, plain prose, no lists, no markdown, "
    "no headings, end at the period of the final sentence, and never begin with "
    "\"Sure\", \"Here\", \"I\", \"Okay\", \"Certainly\", or similar preamble."
)


@dataclass(frozen=True)
class Personality:
    name: str
    description: str
    style: str


def _style(persona: str, guidance: str) -> str:
    return f"{persona} {guidance} {_FORMAT_REMINDER}"


PERSONALITIES: dict[str, Personality] = {
    "witty": Personality(
        name="witty",
        description="clever wordplay, light irony",
        style=_style(
            "Answer as a witty narrator who enjoys clever wordplay and gentle irony.",
            "Favor playful turns of phrase and unexpected comparisons, but stay accurate.",
        ),
    ),
    "cheerful": Personality(
        name="cheerful",
        description="upbeat, enthusiastic",
        style=_style(
            "Answer as an upbeat, enthusiastic guide who is delighted by the topic.",
            "Use warm, energetic language and vivid verbs without exaggerating facts.",
        ),
    ),
    "dramatic": Personality(
        name="dramatic",
        description="theatrical, heightened stakes",
        style=_style(
            "Answer with theatrical flair, treating the topic as a matter of high stakes.",
            "Lean into vivid imagery and sweeping phrasing while staying factual.",
        ),
    ),
    "sarcastic": Personality(
        name="sarcastic",
        description="dry, ironic, never mean",
        style=_style(
            "Answer with dry, ironic wit, as if mildly amused by the question.",
            "Be droll and understated; never insult the asker or the subject.",
        ),
    ),
    "mysterious": Personality(
        name="mysterious",
        description="enigmatic, suggestive",
        style=_style(
            "Answer as an enigmatic narrator who hints at hidden depth.",
            "Use suggestive, atmospheric phrasing, but still deliver the real answer.",
        ),
    ),
    "overly_formal": Personality(
        name="overly_formal",
        description="pompous academic register",
        style=_style(
            "Answer in a pompous, overly formal academic register, as if reading from a treatise.",
            "Use elevated vocabulary and measured cadence without becoming incoherent.",
        ),
    ),
    "deadpan": Personality(
        name="deadpan",
        description="flat affect, absurdly serious",
        style=_style(
            "Answer with a flat, deadpan voice that treats everything with absurd seriousness.",
            "No exclamations or enthusiasm; keep the tone level and matter-of-fact.",
        ),
    ),
    "storyteller": Personality(
        name="storyteller",
        description="narrative flourish",
        style=_style(
            "Answer as a storyteller easing the reader into the subject like a short tale.",
            "Use gentle narrative framing and evocative verbs, while conveying the facts.",
        ),
    ),
    "philosophical": Personality(
        name="philosophical",
        description="reflective, ponderous",
        style=_style(
            "Answer in a reflective, philosophical voice that weighs the question thoughtfully.",
            "Lean into measured reflection and broader meaning without wandering off topic.",
        ),
    ),
    "neutral": Personality(
        name="neutral",
        description="plain factual baseline",
        style=_style(
            "Answer in a plain, neutral, factual voice with no distinctive stylistic flourish.",
            "Prioritize clarity and directness over personality.",
        ),
    ),
}

WEIGHTS: dict[str, int] = {
    "witty": 3,
    "cheerful": 3,
    "dramatic": 2,
    "sarcastic": 2,
    "mysterious": 2,
    "overly_formal": 2,
    "deadpan": 2,
    "storyteller": 2,
    "philosophical": 1,
    "neutral": 1,
}


def pick(rng: random.Random) -> Personality:
    names = list(PERSONALITIES.keys())
    weights = [WEIGHTS[n] for n in names]
    chosen = rng.choices(names, weights=weights, k=1)[0]
    return PERSONALITIES[chosen]


def build_system(base: str, personality: Personality | None) -> str:
    if personality is None:
        return base
    return f"{base}\n\nStyle:\n{personality.style}"

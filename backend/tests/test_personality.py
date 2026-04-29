import random
from collections import Counter

from app.generator import personality


def test_registry_keys_match_weights() -> None:
    assert set(personality.PERSONALITIES.keys()) == set(personality.WEIGHTS.keys())


def test_expected_personalities_present() -> None:
    expected = {
        "witty", "cheerful", "dramatic", "sarcastic", "mysterious",
        "overly_formal", "deadpan", "storyteller", "philosophical", "neutral",
    }
    assert expected.issubset(personality.PERSONALITIES.keys())


def test_every_style_mentions_format_guardrails() -> None:
    for name, p in personality.PERSONALITIES.items():
        assert "35 to 55 words" in p.style, name
        assert "Sure" in p.style and "Here" in p.style, name
        assert p.name == name


def test_pick_is_deterministic_under_seeded_rng() -> None:
    rng1 = random.Random(42)
    rng2 = random.Random(42)
    names1 = [personality.pick(rng1).name for _ in range(20)]
    names2 = [personality.pick(rng2).name for _ in range(20)]
    assert names1 == names2


def test_pick_covers_all_personalities_and_neutral_is_rare() -> None:
    rng = random.Random(0)
    counts = Counter(personality.pick(rng).name for _ in range(2000))
    assert set(counts.keys()) == set(personality.PERSONALITIES.keys())
    assert counts["neutral"] < counts["witty"]
    assert counts["philosophical"] < counts["witty"]


def test_build_system_returns_base_when_no_personality() -> None:
    assert personality.build_system("BASE", None) == "BASE"


def test_build_system_appends_style_block() -> None:
    p = personality.PERSONALITIES["witty"]
    out = personality.build_system("BASE", p)
    assert out.startswith("BASE")
    assert "Style:" in out
    assert p.style in out

from app.prompts import PROMPTS, get


def test_get_returns_prompt_for_known_id() -> None:
    p = get("sky-blue")
    assert p is not None
    assert p.id == "sky-blue"
    assert p.text == "Explain why the sky is blue."


def test_get_returns_none_for_unknown_id() -> None:
    assert get("does-not-exist") is None
    assert get("") is None


def test_all_prompts_have_unique_ids() -> None:
    ids = [p.id for p in PROMPTS]
    assert len(ids) == len(set(ids))


def test_all_prompts_have_nonempty_text() -> None:
    for p in PROMPTS:
        assert p.id and p.text


def test_get_finds_every_prompt_by_id() -> None:
    for p in PROMPTS:
        assert get(p.id) == p

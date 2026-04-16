from app.prompts import SEED_PROMPTS


def test_all_seed_prompts_have_unique_ids() -> None:
    ids = [p.id for p in SEED_PROMPTS]
    assert len(ids) == len(set(ids))


def test_all_seed_prompts_have_nonempty_text() -> None:
    for p in SEED_PROMPTS:
        assert p.id and p.text


def test_seed_prompts_is_not_empty() -> None:
    assert len(SEED_PROMPTS) > 0

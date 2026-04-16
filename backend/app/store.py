from app.prompt_store import PromptStore
from app.prompts import SEED_PROMPTS

_store: PromptStore | None = None


def get_store() -> PromptStore:
    global _store
    if _store is None:
        _store = PromptStore(seeds=SEED_PROMPTS)
    return _store


def set_store(store: PromptStore) -> None:
    global _store
    _store = store


def reset_store() -> None:
    global _store
    _store = None

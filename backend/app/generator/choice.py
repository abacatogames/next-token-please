import random

from app.generator.tokenize import TaggedWord


def _is_forced_reveal(tw: TaggedWord, *, opening: int) -> bool:
    return (
        tw.index < opening
        or tw.is_punct
        or len(tw.word) <= 3
        or tw.is_digit
    )


def _target_choice_count(total: int, pct: float) -> int:
    return max(1, int(total * pct))


Kind = str  # "reveal" or "choice"


def assign_kinds(tagged: list[TaggedWord], *, opening: int, choice_target_pct: float,
                 rng: random.Random) -> list[Kind]:
    kinds: list[Kind] = ["reveal"] * len(tagged)
    candidate_ids = [tw.index for tw in tagged if not _is_forced_reveal(tw, opening=opening)]

    if not candidate_ids:
        return kinds

    target = _target_choice_count(len(tagged), choice_target_pct)
    pick_count = min(target, len(candidate_ids))
    chosen = set(rng.sample(candidate_ids, pick_count))

    for i in chosen:
        kinds[i] = "choice"

    last_choice = -2
    for i in range(len(kinds)):
        if kinds[i] == "choice":
            if i == last_choice + 1:
                kinds[i] = "reveal"
            else:
                last_choice = i

    return kinds

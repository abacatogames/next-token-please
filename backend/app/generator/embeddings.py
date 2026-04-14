from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Protocol

import wordfreq

LOGGER = logging.getLogger("ntp.embeddings")


class _KeyedVectorsLike(Protocol):
    key_to_index: dict[str, int]
    vector_size: int

    def get_vector(self, word: str) -> Any: ...


@dataclass
class EmbeddingIndex:
    vocab: tuple[str, ...]
    matrix: Any
    vectors: _KeyedVectorsLike


_index: EmbeddingIndex | None = None


def get_index() -> EmbeddingIndex | None:
    return _index


def set_index(index: EmbeddingIndex | None) -> None:
    global _index
    _index = index


def load(*, pool_size: int = 5000, model_name: str = "glove-wiki-gigaword-100") -> EmbeddingIndex:
    global _index
    if _index is not None:
        return _index

    import gensim.downloader as api
    import numpy as np

    LOGGER.info("loading embeddings model=%s", model_name)
    kv = api.load(model_name)
    LOGGER.info("indexing top-%d wordfreq pool", pool_size)

    raw_pool = wordfreq.top_n_list("en", pool_size)
    vocab: list[str] = []
    rows: list[Any] = []
    for word in raw_pool:
        if not word.isalpha() or len(word) < 3:
            continue
        low = word.lower()
        if low not in kv.key_to_index:
            continue
        vec = kv.get_vector(low).astype(np.float32)
        norm = float(np.linalg.norm(vec))
        if norm == 0.0:
            continue
        vocab.append(low)
        rows.append(vec / norm)

    matrix = np.stack(rows) if rows else np.empty((0, kv.vector_size), dtype=np.float32)
    _index = EmbeddingIndex(vocab=tuple(vocab), matrix=matrix, vectors=kv)
    LOGGER.info("embeddings ready vocab=%d dim=%d", len(vocab), kv.vector_size)
    return _index


def nearest(word: str, k: int = 20) -> list[str]:
    if _index is None or _index.matrix.size == 0:
        return []

    import numpy as np

    low = word.lower()
    kv = _index.vectors
    if low not in kv.key_to_index:
        return []

    vec = kv.get_vector(low).astype(np.float32)
    norm = float(np.linalg.norm(vec))
    if norm == 0.0:
        return []
    vec = vec / norm

    scores = _index.matrix @ vec
    limit = min(k, scores.shape[0])
    order = np.argpartition(-scores, limit - 1)[:limit]
    order = order[np.argsort(-scores[order])]

    result: list[str] = []
    seen: set[str] = {low}
    for idx in order:
        candidate = _index.vocab[int(idx)]
        if candidate in seen:
            continue
        result.append(candidate)
        seen.add(candidate)
    return result


class _ArrayBackedKV:
    def __init__(self, vocab: list[str], matrix: Any) -> None:
        self._vocab = list(vocab)
        self._matrix = matrix
        self.key_to_index = {w: i for i, w in enumerate(self._vocab)}
        self.vector_size = matrix.shape[1] if getattr(matrix, "size", 0) else 0

    def get_vector(self, word: str) -> Any:
        return self._matrix[self.key_to_index[word]]


def install_for_tests(vocab: list[str], matrix: Any) -> EmbeddingIndex:
    global _index
    import numpy as np

    normalized_rows = []
    for row in matrix:
        norm = float(np.linalg.norm(row))
        normalized_rows.append(row / norm if norm > 0 else row)
    normalized = np.stack(normalized_rows) if normalized_rows else matrix

    _index = EmbeddingIndex(
        vocab=tuple(vocab),
        matrix=normalized,
        vectors=_ArrayBackedKV(list(vocab), matrix),
    )
    return _index


def reset_for_tests() -> None:
    global _index
    _index = None

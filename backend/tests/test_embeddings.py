import numpy as np
import pytest

from app.generator import embeddings


@pytest.fixture(autouse=True)
def _reset_index():
    yield
    embeddings.reset_for_tests()


def _vocab_and_matrix():
    vocab = ["king", "queen", "prince", "princess", "banana", "apple"]
    rng = np.random.default_rng(0)
    base = rng.normal(size=(len(vocab), 16)).astype(np.float32)
    matrix = base / np.linalg.norm(base, axis=1, keepdims=True)
    king_vec = matrix[0]
    matrix[1] = king_vec + 0.05 * rng.normal(size=16).astype(np.float32)
    matrix[2] = king_vec + 0.1 * rng.normal(size=16).astype(np.float32)
    matrix[1] /= np.linalg.norm(matrix[1])
    matrix[2] /= np.linalg.norm(matrix[2])
    return vocab, matrix


def test_nearest_returns_empty_when_no_index_loaded() -> None:
    assert embeddings.nearest("king") == []


def test_nearest_returns_neighbors_sorted_by_cosine() -> None:
    vocab, matrix = _vocab_and_matrix()
    embeddings.install_for_tests(vocab, matrix)

    neighbors = embeddings.nearest("king", k=3)
    assert "king" not in neighbors
    assert neighbors[0] in {"queen", "prince"}
    assert set(neighbors).issubset({"queen", "prince", "princess", "banana", "apple"})


def test_nearest_excludes_oov_words() -> None:
    vocab, matrix = _vocab_and_matrix()
    embeddings.install_for_tests(vocab, matrix)

    assert embeddings.nearest("pomegranate") == []


def test_reset_clears_index() -> None:
    vocab, matrix = _vocab_and_matrix()
    embeddings.install_for_tests(vocab, matrix)
    assert embeddings.get_index() is not None
    embeddings.reset_for_tests()
    assert embeddings.get_index() is None

from app.config import Settings


def test_cors_origin_list_single() -> None:
    s = Settings(cors_origins="http://localhost:5173")
    assert s.cors_origin_list == ["http://localhost:5173"]


def test_cors_origin_list_multiple() -> None:
    s = Settings(cors_origins="http://localhost:5173,https://example.com")
    assert s.cors_origin_list == ["http://localhost:5173", "https://example.com"]


def test_cors_origin_list_trims_whitespace() -> None:
    s = Settings(cors_origins="http://localhost:5173 , https://example.com")
    assert s.cors_origin_list == ["http://localhost:5173", "https://example.com"]


def test_cors_origin_list_filters_empty_strings() -> None:
    s = Settings(cors_origins="http://localhost:5173,")
    assert s.cors_origin_list == ["http://localhost:5173"]

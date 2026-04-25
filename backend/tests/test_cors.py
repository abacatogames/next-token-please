from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_preflight_allows_itch_zone_origin() -> None:
    r = client.options(
        "/api/round",
        headers={
            "Origin": "https://abc.html-classic.itch.zone",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "https://abc.html-classic.itch.zone"


def test_preflight_allows_itch_io_subdomain() -> None:
    r = client.options(
        "/api/round",
        headers={
            "Origin": "https://user.itch.io",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "https://user.itch.io"


def test_preflight_blocks_unknown_origin() -> None:
    r = client.options(
        "/api/round",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.headers.get("access-control-allow-origin") != "https://evil.example.com"


def test_preflight_blocks_http_itch_origin() -> None:
    r = client.options(
        "/api/round",
        headers={
            "Origin": "http://abc.itch.zone",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.headers.get("access-control-allow-origin") != "http://abc.itch.zone"


def test_simple_get_includes_acao_header_for_itch_origin() -> None:
    r = client.get(
        "/api/health",
        headers={"Origin": "https://abc.html-classic.itch.zone"},
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "https://abc.html-classic.itch.zone"

import json
import logging

import pytest

from app.telemetry import (
    LOGGER_NAME,
    ErrorEvent,
    JsonFormatter,
    RoundEvent,
    configure_logging,
    log_error,
    log_round,
)


def _make_event(**overrides) -> RoundEvent:
    base = dict(
        round_id="round-abc123",
        prompt_id="sky-blue",
        difficulty=0.5,
        seed=7,
        pool_hit=False,
        answer_latency_ms=1234,
        answer_retries=0,
        answer_word_count=55,
        choice_count=12,
        distractor_sources={"synonym": 10, "embedding": 0, "random": 14},
        total_latency_ms=1240,
    )
    base.update(overrides)
    return RoundEvent(**base)


def test_json_formatter_includes_event_payload() -> None:
    record = logging.LogRecord(
        name=LOGGER_NAME,
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="round",
        args=(),
        exc_info=None,
    )
    record.event = {"round_id": "round-abc", "choice_count": 12}

    out = JsonFormatter().format(record)
    payload = json.loads(out)
    assert payload["level"] == "INFO"
    assert payload["logger"] == LOGGER_NAME
    assert payload["msg"] == "round"
    assert payload["event"]["round_id"] == "round-abc"
    assert payload["event"]["choice_count"] == 12


def test_json_formatter_handles_records_without_event() -> None:
    record = logging.LogRecord(
        name="other",
        level=logging.WARNING,
        pathname=__file__,
        lineno=1,
        msg="plain message",
        args=(),
        exc_info=None,
    )
    payload = json.loads(JsonFormatter().format(record))
    assert payload["msg"] == "plain message"
    assert "event" not in payload


def test_log_round_emits_info_with_full_event(caplog: pytest.LogCaptureFixture) -> None:
    event = _make_event()
    with caplog.at_level(logging.INFO, logger=LOGGER_NAME):
        log_round(event)

    records = [rec for rec in caplog.records if rec.name == LOGGER_NAME]
    assert len(records) == 1
    stored = records[0].event
    assert stored["round_id"] == "round-abc123"
    assert stored["distractor_sources"] == {"synonym": 10, "embedding": 0, "random": 14}
    assert stored["pool_hit"] is False


def test_log_error_emits_error_level_with_event(caplog: pytest.LogCaptureFixture) -> None:
    try:
        raise RuntimeError("boom")
    except RuntimeError as exc:
        with caplog.at_level(logging.ERROR, logger=LOGGER_NAME):
            log_error(
                ErrorEvent(
                    round_id="round-x",
                    prompt_id="sky-blue",
                    error_type="RuntimeError",
                    message="boom",
                    stage="build_round",
                    total_latency_ms=42,
                ),
                exc,
            )

    errors = [rec for rec in caplog.records if rec.levelname == "ERROR"]
    assert len(errors) == 1
    payload = errors[0].event
    assert payload["error_type"] == "RuntimeError"
    assert payload["stage"] == "build_round"


def test_configure_logging_installs_json_handler() -> None:
    configure_logging("DEBUG")
    root = logging.getLogger()
    assert root.level == logging.DEBUG
    assert any(isinstance(h.formatter, JsonFormatter) for h in root.handlers)

    configure_logging("INFO")
    root = logging.getLogger()
    json_handlers = [h for h in root.handlers if isinstance(h.formatter, JsonFormatter)]
    assert len(json_handlers) == 1

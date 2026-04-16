import json
import logging
import sys
from dataclasses import asdict, dataclass

LOGGER_NAME = "ntp.round"


@dataclass
class RoundEvent:
    round_id: str
    prompt_id: str
    difficulty: float
    seed: int | None
    pool_hit: bool
    answer_latency_ms: int
    answer_retries: int
    answer_word_count: int
    choice_count: int
    distractor_sources: dict[str, int]
    total_latency_ms: int


@dataclass
class PromptGenEvent:
    theme: str
    tone: str
    difficulty: str
    requested: int
    accepted: int
    rejected: int
    retries: int
    latency_ms: int


@dataclass
class ErrorEvent:
    round_id: str
    prompt_id: str | None
    error_type: str
    message: str
    stage: str = "unknown"
    total_latency_ms: int = 0


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        event = getattr(record, "event", None)
        if event is not None:
            payload["event"] = event
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.setLevel(level)
    for handler in list(root.handlers):
        root.removeHandler(handler)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)


def log_round(event: RoundEvent) -> None:
    logging.getLogger(LOGGER_NAME).info("round", extra={"event": asdict(event)})


def log_prompt_gen(event: PromptGenEvent) -> None:
    logging.getLogger(LOGGER_NAME).info("prompt_gen", extra={"event": asdict(event)})


def log_error(event: ErrorEvent, exc: BaseException | None = None) -> None:
    logger = logging.getLogger(LOGGER_NAME)
    kwargs: dict[str, object] = {"extra": {"event": asdict(event)}}
    if exc is not None:
        kwargs["exc_info"] = (type(exc), exc, exc.__traceback__)
    logger.error("round_failed", **kwargs)

"""Internal request/response contracts for the AELIO Intelligence Gateway.

Every provider (OpenAI today, AELIO Native later) receives a `GenRequest` and
yields `Event`s. Product code (Brain chat, agents, Code Studio) only ever sees
these types, so the provider can change without rewriting the product.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Role = Literal["user", "assistant"]
Tier = Literal["standard", "advanced"]
Purpose = Literal["chat", "agent", "code", "test"]


@dataclass
class Message:
    role: Role
    content: str


@dataclass
class Tool:
    """A function the model may ask AELIO to run. AELIO decides whether it runs."""
    name: str
    description: str
    parameters: dict[str, Any]


@dataclass
class GenRequest:
    user_id: str | None
    purpose: Purpose
    instructions: str                       # system/developer instructions assembled by AELIO
    messages: list[Message]
    tier: Tier = "standard"
    tools: list[Tool] = field(default_factory=list)
    json_schema: dict[str, Any] | None = None   # structured output: {"name":..., "schema":{...}}
    max_output_tokens: int = 1200
    conversation_id: str | None = None
    stream: bool = True


@dataclass
class Usage:
    input_tokens: int = 0
    cached_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0


# ---------------------------------------------------------------- events
@dataclass
class TextDelta:
    text: str
    type: str = "delta"


@dataclass
class ToolCall:
    call_id: str
    name: str
    arguments: str          # JSON string, exactly as the model produced it; validated before use
    type: str = "tool_call"


@dataclass
class Done:
    usage: Usage
    provider: str
    model: str
    finish_reason: str = "stop"        # stop | length | content_filter | tool_call
    type: str = "done"


@dataclass
class ProviderError(Exception):
    code: str                 # auth | rate_limited | unavailable | bad_request | timeout | not_configured | not_eligible | failed
    message: str
    retryable: bool = False
    status: int = 502

    def __str__(self) -> str:
        return f"{self.code}: {self.message}"


Event = TextDelta | ToolCall | Done

import os
from typing import Dict


SECRET_ENV_PREFIXES = [
    "API_KEY",
    "OPENAI",
    "BRAVE",
    "TAVILY",
    "EXA",
    "FIRECRAWL",
    "BROWSERBASE",
    "ANTHROPIC",
]


def collect_secrets() -> Dict[str, str]:
    secrets = {}
    for k, v in os.environ.items():
        if any(prefix in k for prefix in SECRET_ENV_PREFIXES):
            secrets[k] = v
    return secrets


def redact(text: str, secrets: Dict[str, str]) -> str:
    redacted = text
    for _, val in secrets.items():
        if val:
            redacted = redacted.replace(val, "***")
    return redacted

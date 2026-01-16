"""
Error types for AgentBuilder.
"""


class AgentBuilderError(Exception):
    """Error raised during agent building."""

    def __init__(
        self,
        message: str,
        field: str | None = None,
        value: object = None,
    ) -> None:
        super().__init__(message)
        self.field = field
        self.value = value

    def __str__(self) -> str:
        base = super().__str__()
        if self.field:
            return f"{base} (field: {self.field})"
        return base

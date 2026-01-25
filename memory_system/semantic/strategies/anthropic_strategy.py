"""
Anthropic Claude-based Decomposition Strategy.

Uses Anthropic Claude (Sonnet 4.5) API with structured JSON output
for high-quality semantic frame extraction.

This is the recommended strategy for production use due to 
Claude's superior reasoning and structured output capabilities.
"""

import json
import logging
import os
from typing import Dict, Any, Optional, List

from memory_system.semantic.models import SemanticFrame, Triple, Intent, CalibrationResult
from memory_system.semantic.strategies.base import DecompositionStrategy

logger = logging.getLogger(__name__)

# Conditional imports
try:
    import anthropic  # type: ignore
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    anthropic = None


class AnthropicStrategy(DecompositionStrategy):
    """
    LLM-based semantic decomposition using Anthropic Claude.
    
    Uses Claude Sonnet 4.5 for high-quality structured extraction.
    Requires ANTHROPIC_API_KEY environment variable or explicit key.
    
    Configuration:
        model: Claude model name (default: 'claude-sonnet-4-5-20250514')
        api_key: Anthropic API key (default: from ANTHROPIC_API_KEY env)
        timeout: Request timeout in seconds (default: 60)
        max_tokens: Maximum response tokens (default: 1024)
    """
    
    # Default model: Claude Sonnet 4.5 (latest as of 2025)
    DEFAULT_MODEL = "claude-sonnet-4-5-20250514"
    
    # JSON schema for structured output
    JSON_SCHEMA = {
        "type": "object",
        "properties": {
            "intent": {
                "type": "string",
                "enum": ["DEBUG", "REFACTOR", "CREATE", "EXPLAIN", "TEST", 
                         "QUERY", "TRANSFORM", "ANALYZE", "UNKNOWN"]
            },
            "target": {
                "type": "string",
                "description": "The specific code entity (class, function, file) being referenced. If implicit, use 'implicit'."
            },
            "triples": {
                "type": "array",
                "items": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 3,
                    "maxItems": 3
                },
                "description": "List of [Subject, Predicate, Object] triples representing the logic."
            },
            "confidence": {
                "type": "number",
                "minimum": 0.0,
                "maximum": 1.0,
                "description": "A number between 0.0 and 1.0 indicating certainty."
            }
        },
        "required": ["intent", "target", "triples", "confidence"]
    }
    
    # System prompt for Claude
    SYSTEM_PROMPT = """You are a semantic intent parser for code-related prompts. Your task is to extract structured semantic information from user requests.

You MUST respond with valid JSON only, no markdown or explanation. The JSON must contain:
- intent: One of DEBUG, REFACTOR, CREATE, EXPLAIN, TEST, QUERY, TRANSFORM, ANALYZE, UNKNOWN
- target: The specific code entity being referenced (use "implicit" if not explicit)
- triples: An array of [Subject, Predicate, Object] arrays representing the semantic relationships
- confidence: A number between 0.0 and 1.0 indicating your certainty

Examples:
1. Input: "fix the login bug"
   Output: {"intent": "DEBUG", "target": "implicit", "triples": [["login", "has", "bug"]], "confidence": 0.8}

2. Input: "refactor the authentication service to use dependency injection"
   Output: {"intent": "REFACTOR", "target": "authentication service", "triples": [["authentication service", "should_use", "dependency injection"]], "confidence": 0.9}

3. Input: "create a new UserController class"
   Output: {"intent": "CREATE", "target": "UserController", "triples": [["UserController", "is_a", "class"]], "confidence": 0.95}

4. Input: "explain how the caching works"
   Output: {"intent": "EXPLAIN", "target": "caching", "triples": [["caching", "implements", "mechanism"]], "confidence": 0.85}

5. Input: "find all functions that call authenticate"
   Output: {"intent": "QUERY", "target": "authenticate", "triples": [["functions", "calls", "authenticate"]], "confidence": 0.9}

Respond with JSON ONLY."""
    
    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        api_key: Optional[str] = None,
        timeout: float = 60.0,
        max_tokens: int = 1024,
        calibrator: Optional[Any] = None,
    ):
        """
        Initialize Anthropic strategy.
        
        Args:
            model: Claude model name (default: claude-sonnet-4-5-20250514)
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
            timeout: Request timeout in seconds
            max_tokens: Maximum response tokens
            calibrator: Optional confidence calibrator instance
        """
        self.model = model
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.timeout = timeout
        self.max_tokens = max_tokens
        self.calibrator = calibrator
        self._client = None
        self._service_available: Optional[bool] = None
    
    @property
    def name(self) -> str:
        return "anthropic"
    
    @property
    def priority(self) -> int:
        return 110  # Highest priority (above Ollama at 100)
    
    @property
    def requires_model(self) -> bool:
        return True
    
    def _get_client(self):
        """Get or create Anthropic client."""
        if self._client is None and ANTHROPIC_AVAILABLE and self.api_key:
            self._client = anthropic.Anthropic(
                api_key=self.api_key,
                timeout=self.timeout
            )
        return self._client
    
    def is_available(self) -> bool:
        """
        Check if Anthropic API is available.
        
        Checks both package installation and API key presence.
        """
        if not ANTHROPIC_AVAILABLE:
            logger.debug("Anthropic package not installed")
            return False
        
        if not self.api_key:
            logger.debug("ANTHROPIC_API_KEY not set")
            return False
        
        if self._service_available is not None:
            return self._service_available
        
        # Try to validate API key with a simple request
        try:
            client = self._get_client()
            if client is None:
                self._service_available = False
                return False
            
            # Make a minimal API call to verify credentials
            # We could also just assume it's available if we have a key
            self._service_available = True
            logger.info(f"Anthropic API available with model: {self.model}")
            
        except Exception as e:
            logger.warning(f"Anthropic API validation failed: {e}")
            self._service_available = False
        
        return self._service_available
    
    def supports_content_type(self, content_type: str) -> bool:
        """Anthropic supports all content types."""
        return True
    
    async def decompose(self, text: str, **kwargs) -> SemanticFrame:
        """
        Decompose text using Anthropic Claude.
        
        Args:
            text: Input text to decompose
            **kwargs: Additional options:
                - model_override: Use different model for this request
                - max_tokens: Maximum response tokens
                - temperature: Sampling temperature
                
        Returns:
            SemanticFrame with extracted semantics
            
        Raises:
            DecompositionError: If Anthropic call fails
            ValidationError: If input is invalid
        """
        if not text or not text.strip():
            from memory_system.semantic.exceptions import ValidationError
            raise ValidationError("Input text cannot be empty", "EMPTY_INPUT")

        if not ANTHROPIC_AVAILABLE:
            logger.warning("Anthropic not available, returning fallback frame")
            return self._create_fallback_frame(text)

        client = self._get_client()
        if client is None:
            logger.warning("Anthropic client not initialized, returning fallback frame")
            return self._create_fallback_frame(text)

        model = kwargs.get("model_override", self.model)
        max_tokens = kwargs.get("max_tokens", self.max_tokens)
        temperature = kwargs.get("temperature", 0.0)  # Low temperature for structured output

        try:
            # Call Anthropic Claude API
            response = client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=self.SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": f"Parse this prompt and respond with JSON only:\n{text}"
                    }
                ]
            )

            content = response.content[0].text

            # Parse JSON (with markdown cleanup if needed)
            data = self._parse_json_response(content)

            # Add raw text
            data['raw'] = text
            data['strategy_used'] = self.name

            # Map intent string to enum
            intent_str = data.get('intent', 'UNKNOWN').upper()
            try:
                intent = Intent[intent_str]
            except KeyError:
                intent = Intent.UNKNOWN

            triples = [
                Triple(subject=t[0], predicate=t[1], object=t[2])
                for t in data.get('triples', [])
                if len(t) == 3
            ]
            # Create frame
            frame = SemanticFrame(
                intent=intent,
                target=data.get('target', 'implicit'),
                triples=triples,
                confidence=float(data.get('confidence', 0.5)),
                raw=text,
                strategy_used=self.name,
                metadata={
                    **kwargs.get('metadata', {}),
                    "model": model,
                    "usage": {
                        "input_tokens": response.usage.input_tokens,
                        "output_tokens": response.usage.output_tokens,
                    }
                },
            )

            # Apply confidence calibration if available
            if self.calibrator:
                frame = self._calibrate_confidence(frame)

            logger.debug(
                f"Anthropic decomposition: intent={frame.intent.name}, "
                f"confidence={frame.confidence:.3f}, triples={len(frame.triples)}"
            )

            return frame

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude JSON response: {e}")
            from memory_system.semantic.exceptions import DecompositionError
            raise DecompositionError(
                f"Invalid JSON from Claude: {e}", "INVALID_JSON"
            ) from e
        except Exception as e:
            logger.error(f"Anthropic decomposition failed: {e}")
            from memory_system.semantic.exceptions import DecompositionError
            raise DecompositionError(
                f"Anthropic decomposition failed: {e}", "ANTHROPIC_ERROR"
            ) from e
    
    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """
        Parse JSON from Claude response, handling markdown wrapping.
        
        Args:
            content: Response content string
            
        Returns:
            Parsed dictionary
        """
        # Strip markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        return json.loads(content)
    
    def _calibrate_confidence(self, frame: SemanticFrame) -> SemanticFrame:
        """
        Apply confidence calibration using histogram binning or similar method.
        
        Args:
            frame: Original frame with raw confidence
            
        Returns:
            Frame with calibrated confidence
        """
        if not self.calibrator:
            return frame
        
        try:
            result: CalibrationResult = self.calibrator.calibrate(
                frame.confidence,
                semantic_frame=frame,
                method="histogram"
            )
            
            if not result.is_valid:
                logger.warning(f"Confidence calibration warnings: {result.validation_warnings}")
            
            # Update confidence if significant change
            if abs(result.calibrated_confidence - frame.confidence) > 0.05:
                logger.debug(
                    f"Confidence calibrated: {frame.confidence:.3f} -> "
                    f"{result.calibrated_confidence:.3f}"
                )
                frame.confidence = result.calibrated_confidence
            
            return frame
            
        except Exception as e:
            logger.warning(f"Confidence calibration failed: {e}")
            return frame
    
    def _create_fallback_frame(self, text: str) -> SemanticFrame:
        """
        Create a basic fallback frame when API is not available.
        
        Args:
            text: Original input text
            
        Returns:
            Basic SemanticFrame with UNKNOWN intent
        """
        return SemanticFrame(
            intent=Intent.UNKNOWN,
            target="implicit",
            triples=[],
            confidence=0.0,
            raw=text,
            strategy_used=f"{self.name}_fallback",
            metadata={"fallback": True, "reason": "API not available"},
        )

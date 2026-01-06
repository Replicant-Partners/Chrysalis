"""
Ollama-based Decomposition Strategy.

Uses local LLM via Ollama with grammar-constrained JSON output
for high-quality semantic frame extraction.

Ported from SkyPrompt's decomposer.py with enhancements.
"""

import json
import logging
from typing import Dict, Any, Optional, List

from memory_system.semantic.models import SemanticFrame, Triple, Intent, CalibrationResult
from memory_system.semantic.strategies.base import DecompositionStrategy

logger = logging.getLogger(__name__)

# Conditional imports
try:
    import ollama  # type: ignore
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    ollama = None


class OllamaStrategy(DecompositionStrategy):
    """
    LLM-based semantic decomposition using Ollama.
    
    Uses grammar-constrained JSON output for structured extraction.
    Highest quality but requires running Ollama service.
    
    Configuration:
        model: Ollama model name (default: 'phi3')
        base_url: Ollama API URL (default: 'http://localhost:11434')
        timeout: Request timeout in seconds (default: 60)
    """
    
    # JSON schema for grammar-constrained decoding
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
    
    # Few-shot prompt template
    PROMPT_TEMPLATE = '''You are a semantic intent parser for code-related prompts. Extract the structured intent from user requests.

Examples:
1. Input: "fix the login bug"
   Output: {{"intent": "DEBUG", "target": "implicit", "triples": [["login", "has", "bug"]], "confidence": 0.8}}

2. Input: "refactor the authentication service to use dependency injection"
   Output: {{"intent": "REFACTOR", "target": "authentication service", "triples": [["authentication service", "should_use", "dependency injection"]], "confidence": 0.9}}

3. Input: "create a new UserController class"
   Output: {{"intent": "CREATE", "target": "UserController", "triples": [["UserController", "is_a", "class"]], "confidence": 0.95}}

4. Input: "explain how the caching works"
   Output: {{"intent": "EXPLAIN", "target": "caching", "triples": [["caching", "implements", "mechanism"]], "confidence": 0.85}}

5. Input: "find all functions that call authenticate"
   Output: {{"intent": "QUERY", "target": "authenticate", "triples": [["functions", "calls", "authenticate"]], "confidence": 0.9}}

Now parse this prompt:
Input: "{text}"
Output JSON (no markdown, just JSON):
'''
    
    def __init__(
        self,
        model: str = "phi3",
        base_url: str = "http://localhost:11434",
        timeout: float = 60.0,
        calibrator: Optional[Any] = None,
    ):
        """
        Initialize Ollama strategy.
        
        Args:
            model: Ollama model name
            base_url: Ollama API URL
            timeout: Request timeout in seconds
            calibrator: Optional confidence calibrator instance
        """
        self.model = model
        self.base_url = base_url
        self.timeout = timeout
        self.calibrator = calibrator
        self._service_available: Optional[bool] = None
    
    @property
    def name(self) -> str:
        return "ollama"
    
    @property
    def priority(self) -> int:
        return 100  # Highest priority
    
    @property
    def requires_model(self) -> bool:
        return True
    
    def is_available(self) -> bool:
        """
        Check if Ollama service is available.
        
        Checks both package installation and service reachability.
        Result is cached after first check.
        """
        if not OLLAMA_AVAILABLE:
            return False
        
        if self._service_available is not None:
            return self._service_available
        
        try:
            # Try to list models to verify service is running
            import httpx
            response = httpx.get(
                f"{self.base_url}/api/tags",
                timeout=5.0
            )
            self._service_available = response.status_code == 200
        except Exception:
            self._service_available = False
        
        return self._service_available
    
    def supports_content_type(self, content_type: str) -> bool:
        """Ollama supports all content types."""
        return True
    
    async def decompose(self, text: str, **kwargs) -> SemanticFrame:
        """
        Decompose text using Ollama LLM.
        
        Args:
            text: Input text to decompose
            **kwargs: Additional options:
                - model_override: Use different model for this request
                - max_tokens: Maximum response tokens
                - temperature: Sampling temperature
                
        Returns:
            SemanticFrame with extracted semantics
            
        Raises:
            DecompositionError: If Ollama call fails
            ValidationError: If input is invalid
        """
        if not text or not text.strip():
            from memory_system.semantic.exceptions import ValidationError
            raise ValidationError("Input text cannot be empty", "EMPTY_INPUT")
        
        if not OLLAMA_AVAILABLE:
            logger.warning("Ollama not available, returning fallback frame")
            return self._create_fallback_frame(text)
        
        model = kwargs.get("model_override", self.model)
        prompt = self.PROMPT_TEMPLATE.format(text=text)
        
        try:
            # Call Ollama with grammar-constrained JSON
            response = ollama.chat(
                model=model,
                messages=[
                    {'role': 'system', 'content': 'You are a strict semantic parser. Output valid JSON only.'},
                    {'role': 'user', 'content': prompt}
                ],
                format=self.JSON_SCHEMA
            )
            
            content = response['message']['content']
            
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
            
            # Convert triples to Triple objects
            triples = []
            for t in data.get('triples', []):
                if len(t) == 3:
                    triples.append(Triple(
                        subject=t[0],
                        predicate=t[1],
                        object=t[2]
                    ))
            
            # Create frame
            frame = SemanticFrame(
                intent=intent,
                target=data.get('target', 'implicit'),
                triples=triples,
                confidence=float(data.get('confidence', 0.5)),
                raw=text,
                strategy_used=self.name,
                metadata=kwargs.get('metadata', {}),
            )
            
            # Apply confidence calibration if available
            if self.calibrator:
                frame = self._calibrate_confidence(frame)
            
            logger.debug(
                f"Ollama decomposition: intent={frame.intent.name}, "
                f"confidence={frame.confidence:.3f}, triples={len(frame.triples)}"
            )
            
            return frame
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Ollama JSON response: {e}")
            from memory_system.semantic.exceptions import DecompositionError
            raise DecompositionError(
                f"Invalid JSON from Ollama: {e}",
                "INVALID_JSON"
            )
        except Exception as e:
            logger.error(f"Ollama decomposition failed: {e}")
            from memory_system.semantic.exceptions import DecompositionError
            raise DecompositionError(
                f"Ollama decomposition failed: {e}",
                "OLLAMA_ERROR"
            )
    
    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """
        Parse JSON from Ollama response, handling markdown wrapping.
        
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

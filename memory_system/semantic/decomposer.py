"""
Unified Semantic Decomposer.

Orchestrates multiple decomposition strategies with automatic fallback.
Uses strategy pattern to select best available approach.
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any, Type

from memory_system.semantic.models import SemanticFrame, Intent
from memory_system.semantic.exceptions import DecompositionError, ValidationError
from memory_system.semantic.strategies.base import DecompositionStrategy
from memory_system.semantic.strategies.heuristic_strategy import HeuristicStrategy

logger = logging.getLogger(__name__)


class SemanticDecomposer:
    """
    Unified semantic decomposer with strategy fallback chain.
    
    Automatically selects and falls back between strategies:
    1. Ollama (LLM) - highest quality, requires service
    2. TreeSitter - AST parsing for code
    3. spaCy - NLP dependency parsing
    4. Heuristic - keyword/regex fallback
    
    Usage:
        decomposer = SemanticDecomposer()
        frame = await decomposer.decompose("fix the login bug")
        print(frame.intent, frame.triples)
    """
    
    def __init__(
        self,
        strategies: Optional[List[DecompositionStrategy]] = None,
        preferred_strategy: Optional[str] = None,
        content_type_hint: str = "any",
    ):
        """
        Initialize decomposer with strategy chain.
        
        Args:
            strategies: Custom list of strategies (sorted by priority)
            preferred_strategy: Strategy name to prefer (overrides priority)
            content_type_hint: Hint about content type ('code', 'natural_language', 'mixed', 'any')
        """
        self.content_type_hint = content_type_hint
        self.preferred_strategy = preferred_strategy
        self._strategies: List[DecompositionStrategy] = []
        
        if strategies:
            self._strategies = strategies
        else:
            self._strategies = self._build_default_strategies()
        
        # Sort by priority (highest first)
        self._strategies.sort(key=lambda s: s.priority, reverse=True)
        
        logger.info(
            f"SemanticDecomposer initialized with {len(self._strategies)} strategies: "
            f"{[s.name for s in self._strategies]}"
        )
    
    def _build_default_strategies(self) -> List[DecompositionStrategy]:
        """
        Build default strategy chain based on available dependencies.
        
        Only includes strategies whose dependencies are installed.
        """
        strategies = []
        
        # Try Ollama strategy
        try:
            from memory_system.semantic.strategies.ollama_strategy import OllamaStrategy
            strategies.append(OllamaStrategy())
            logger.debug("Added OllamaStrategy to chain")
        except ImportError as e:
            logger.debug(f"OllamaStrategy not available: {e}")
        
        # Try spaCy strategy
        try:
            from memory_system.semantic.strategies.spacy_strategy import SpacyStrategy
            strategies.append(SpacyStrategy())
            logger.debug("Added SpacyStrategy to chain")
        except ImportError as e:
            logger.debug(f"SpacyStrategy not available: {e}")
        
        # Always include heuristic fallback
        strategies.append(HeuristicStrategy())
        logger.debug("Added HeuristicStrategy as fallback")
        
        return strategies
    
    @property
    def available_strategies(self) -> List[str]:
        """Get names of currently available strategies."""
        return [s.name for s in self._strategies if s.is_available()]
    
    @property
    def all_strategies(self) -> List[str]:
        """Get names of all registered strategies."""
        return [s.name for s in self._strategies]
    
    def add_strategy(self, strategy: DecompositionStrategy, position: int = -1) -> None:
        """
        Add a strategy to the chain.
        
        Args:
            strategy: Strategy instance to add
            position: Position in chain (-1 = append at end)
        """
        if position < 0:
            self._strategies.append(strategy)
        else:
            self._strategies.insert(position, strategy)
        
        # Re-sort by priority
        self._strategies.sort(key=lambda s: s.priority, reverse=True)
        logger.info(f"Added strategy {strategy.name} to chain")
    
    def remove_strategy(self, name: str) -> bool:
        """
        Remove a strategy from the chain by name.
        
        Args:
            name: Strategy name to remove
            
        Returns:
            True if strategy was removed
        """
        for i, s in enumerate(self._strategies):
            if s.name == name:
                self._strategies.pop(i)
                logger.info(f"Removed strategy {name} from chain")
                return True
        return False
    
    def get_strategy(self, name: str) -> Optional[DecompositionStrategy]:
        """Get strategy by name."""
        return next((s for s in self._strategies if s.name == name), None)
    
    async def decompose(
        self, 
        text: str, 
        strategy_name: Optional[str] = None,
        fallback_on_error: bool = True,
        **kwargs
    ) -> SemanticFrame:
        """
        Decompose text into semantic frame using strategy chain.
        
        Args:
            text: Input text to decompose
            strategy_name: Force specific strategy (optional)
            fallback_on_error: Whether to try fallback strategies on error
            **kwargs: Passed to strategy decompose()
            
        Returns:
            SemanticFrame with extracted semantics
            
        Raises:
            ValidationError: If input is invalid
            DecompositionError: If all strategies fail
        """
        if not text or not text.strip():
            raise ValidationError("Input text cannot be empty", "EMPTY_INPUT")

        # Get ordered strategy list
        strategies = self._get_strategy_order(strategy_name)

        if not strategies:
            raise DecompositionError(
                "No decomposition strategies available",
                "NO_STRATEGY_AVAILABLE"
            )

        errors = []

        for strategy in strategies:
            # Check availability
            if not strategy.is_available():
                logger.debug(f"Strategy {strategy.name} not available, skipping")
                continue

            # Check content type support
            if not strategy.supports_content_type(self.content_type_hint):
                logger.debug(
                    f"Strategy {strategy.name} doesn't support content type "
                    f"'{self.content_type_hint}', skipping"
                )
                continue

            try:
                logger.debug(f"Attempting decomposition with strategy: {strategy.name}")
                frame = await strategy.decompose(text, **kwargs)

                logger.info(
                    f"Decomposition successful with {strategy.name}: "
                    f"intent={frame.intent.name}, confidence={frame.confidence:.3f}"
                )

                return frame

            except ValidationError:
                # Don't fallback on validation errors
                raise

            except DecompositionError as e:
                # Check if error is non-recoverable
                if e.error_code in ("TOKEN_LIMIT_EXCEEDED", "INVALID_FRAME"):
                    raise

                errors.append((strategy.name, e))
                logger.warning(
                    f"Strategy {strategy.name} failed: {e.error_code or 'unknown'} - {e.message}"
                )

                if not fallback_on_error:
                    raise

            except Exception as e:
                errors.append((strategy.name, e))
                logger.warning(f"Strategy {strategy.name} raised exception: {e}")

                if not fallback_on_error:
                    raise DecompositionError(
                        f"Strategy {strategy.name} failed: {e}", "STRATEGY_ERROR"
                    ) from e

        # All strategies failed
        error_summary = "; ".join([f"{name}: {err}" for name, err in errors])
        raise DecompositionError(
            f"All decomposition strategies failed: {error_summary}",
            "ALL_STRATEGIES_FAILED",
            {"errors": [(name, str(err)) for name, err in errors]}
        )
    
    def _get_strategy_order(
        self, 
        strategy_name: Optional[str] = None
    ) -> List[DecompositionStrategy]:
        """
        Get strategies in execution order.
        
        Args:
            strategy_name: Optional name to force specific strategy first
            
        Returns:
            Ordered list of strategies to try
        """
        # If specific strategy requested, put it first
        if strategy_name:
            if strategy := self.get_strategy(strategy_name):
                others = [s for s in self._strategies if s.name != strategy_name]
                return [strategy] + others
            else:
                logger.warning(f"Requested strategy '{strategy_name}' not found")

        # If preferred strategy set, put it first
        if self.preferred_strategy:
            if strategy := self.get_strategy(self.preferred_strategy):
                others = [s for s in self._strategies if s.name != self.preferred_strategy]
                return [strategy] + others

        # Return default priority order
        return list(self._strategies)
    
    async def decompose_batch(
        self,
        texts: List[str],
        max_concurrent: int = 5,
        **kwargs
    ) -> List[SemanticFrame]:
        """
        Decompose multiple texts concurrently.
        
        Args:
            texts: List of texts to decompose
            max_concurrent: Maximum concurrent decompositions
            **kwargs: Passed to decompose()
            
        Returns:
            List of SemanticFrames (in same order as input)
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def decompose_with_semaphore(text: str) -> SemanticFrame:
            async with semaphore:
                return await self.decompose(text, **kwargs)
        
        tasks = [decompose_with_semaphore(text) for text in texts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert exceptions to fallback frames
        frames = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"Batch decomposition failed for item {i}: {result}")
                frames.append(SemanticFrame(
                    intent=Intent.UNKNOWN,
                    target="implicit",
                    triples=[],
                    confidence=0.0,
                    raw=texts[i],
                    strategy_used="failed",
                    metadata={"error": str(result)},
                ))
            else:
                frames.append(result)
        
        return frames


# Convenience function for quick decomposition
async def decompose(text: str, **kwargs) -> SemanticFrame:
    """
    Convenience function for quick semantic decomposition.
    
    Uses default strategy chain with automatic fallback.
    
    Args:
        text: Text to decompose
        **kwargs: Passed to SemanticDecomposer.decompose()
        
    Returns:
        SemanticFrame with extracted semantics
    """
    decomposer = SemanticDecomposer()
    return await decomposer.decompose(text, **kwargs)

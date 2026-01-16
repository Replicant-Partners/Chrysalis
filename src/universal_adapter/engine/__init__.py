"""
Engine Module - Interaction Construction and LLM Communication

Builds runtime LLM requests by interpolating prompt templates
with registry-resolved references and context values.
"""

from .interpolator import TemplateInterpolator, InterpolationContext
from .llm_client import LLMClient, LLMRequest, LLMResponse

__all__ = [
    'TemplateInterpolator',
    'InterpolationContext',
    'LLMClient',
    'LLMRequest',
    'LLMResponse',
]

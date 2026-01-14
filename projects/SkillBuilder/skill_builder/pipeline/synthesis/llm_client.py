"""
LLM API client functions for synthesis.

Supports Anthropic Claude (primary) and OpenAI-compatible (fallback).
"""

from __future__ import annotations

import json
import os
import urllib.request


def _call_anthropic_api(prompt: str, system_prompt: str = "", max_tokens: int = 2000) -> str:
    """
    Call Anthropic Claude Sonnet 4.5 API via HTTP.
    
    Primary LLM provider for SkillBuilder synthesis.
    
    Returns raw text response or empty string on failure.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    api_url = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1/messages")
    anthropic_version = os.environ.get("ANTHROPIC_VERSION", "2023-06-01")
    
    if not api_key:
        return ""
    
    debug_info = {
        "provider": "anthropic",
        "model": model,
        "api_url": api_url,
        "has_key": bool(api_key),
    }
    print(f"LLM DEBUG: prepared Anthropic request {json.dumps(debug_info)}")
    
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": anthropic_version,
    }
    
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    
    if system_prompt:
        payload["system"] = system_prompt
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(api_url, data=data, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=120) as response:
            status = response.getcode()
            result = json.loads(response.read().decode())
            
            # Extract content from Anthropic response format
            content = result.get("content", [])
            print(f"LLM DEBUG: Anthropic response status={status}, has_content={bool(content)}")
            if content and isinstance(content, list) and len(content) > 0:
                return content[0].get("text", "")
            return ""
            
    except Exception as e:
        print(f"Anthropic API error: {e}")
        return ""


def _call_openai_fallback(prompt: str, max_tokens: int = 2000) -> str:
    """
    Fallback to OpenAI-compatible API if Anthropic is unavailable.
    
    Supports:
    - OpenAI: Set OPENAI_API_KEY
    - OpenRouter: Set OPENROUTER_API_KEY and OPENROUTER_BASE_URL
    - Local: Set LLM_API_URL for local endpoint
    
    Returns raw text response or empty string on failure.
    """
    # Determine API endpoint and key
    provider = "openai"
    api_key = os.environ.get("OPENAI_API_KEY", "")
    api_url = os.environ.get("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
    model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    
    # Check for OpenRouter override
    if os.environ.get("OPENROUTER_API_KEY"):
        provider = "openrouter"
        api_key = os.environ.get("OPENROUTER_API_KEY", "")
        api_url = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1/chat/completions")
        model = os.environ.get("LLM_MODEL", "openai/gpt-4o-mini")
    elif os.environ.get("LLM_API_URL") and not os.environ.get("OPENAI_API_KEY"):
        # Custom endpoint with explicit URL and no OpenAI key
        provider = "custom"
        api_key = os.environ.get("OPENROUTER_API_KEY", "") or os.environ.get("OPENAI_API_KEY", "")
        api_url = os.environ.get("LLM_API_URL")
        model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    
    if not api_key:
        return ""
    
    debug_info = {
        "provider": provider,
        "api_url": api_url,
        "model": model,
        "has_key": bool(api_key),
    }
    print(f"LLM DEBUG: fallback OpenAI request {json.dumps(debug_info)}")
    
    # Build request
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}]
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(api_url, data=data, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=60) as response:
            status = response.getcode()
            result = json.loads(response.read().decode())
            
            # Extract content from response
            choices = result.get("choices", [])
            print(f"LLM DEBUG: OpenAI response status={status}, has_choices={bool(choices)}")
            if choices:
                message = choices[0].get("message", {})
                return message.get("content", "")
            return ""
            
    except Exception as e:
        print(f"OpenAI fallback API error: {e}")
        return ""


def _call_llm_api(prompt: str, max_tokens: int = 2000, system_prompt: str = "") -> str:
    """
    Call LLM API with Anthropic Claude Sonnet 4.5 as primary, OpenAI as fallback.
    
    Provider priority:
    1. Anthropic Claude Sonnet 4.5 (if ANTHROPIC_API_KEY is set)
    2. OpenAI/OpenRouter/Custom (if OPENAI_API_KEY or OPENROUTER_API_KEY is set)
    
    Returns raw text response or empty string on failure.
    """
    # Try Anthropic first (primary provider)
    if os.environ.get("ANTHROPIC_API_KEY"):
        result = _call_anthropic_api(prompt, system_prompt, max_tokens)
        if result:
            return result
        print("LLM DEBUG: Anthropic returned empty, trying fallback...")
    
    # Fallback to OpenAI-compatible API
    result = _call_openai_fallback(prompt, max_tokens)
    return result


def _has_llm_api() -> bool:
    """Check if any LLM API is configured."""
    return bool(
        os.environ.get("ANTHROPIC_API_KEY") or
        os.environ.get("OPENAI_API_KEY") or
        os.environ.get("OPENROUTER_API_KEY")
    )

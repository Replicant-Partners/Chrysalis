"""
Async utility functions for Fireproof integration.

Provides safe async/sync bridging patterns that avoid deprecated
asyncio.get_event_loop() usage and handle edge cases properly.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Optional, TypeVar, Union

logger = logging.getLogger("central_logger")

T = TypeVar("T")


def run_async_safely(coro: Awaitable[T]) -> Optional[T]:
    """
    Run an async coroutine from synchronous code safely.
    
    Handles the complexity of running async code from sync contexts:
    - If no event loop is running, creates one and runs to completion
    - If an event loop IS running, schedules as task and returns None
      (cannot block in an async context)
    
    Args:
        coro: Coroutine to execute
        
    Returns:
        Result of coroutine, or None if called from async context
        
    Note:
        This uses asyncio.get_running_loop() which is the modern
        Python 3.7+ approach, avoiding the deprecated get_event_loop().
    """
    try:
        loop = asyncio.get_running_loop()
        # We're in an async context - can't block
        logger.debug(
            "fireproof.async_utils.async_context",
            extra={
                "message": "Sync method called from async context. "
                           "Scheduling as task, result unavailable synchronously."
            }
        )
        # Schedule but can't wait - return None
        loop.create_task(coro)
        return None
    except RuntimeError:
        # No running loop - safe to run synchronously
        return asyncio.run(coro)


def schedule_async(
    coro_or_func: Union[Awaitable[T], Callable[..., Awaitable[T]]],
    *args: Any,
    on_error: Optional[Callable[[Exception], None]] = None,
    **kwargs: Any,
) -> None:
    """
    Schedule an async coroutine or function for execution without blocking.
    
    This is a fire-and-forget pattern with optional error callback.
    The function will be scheduled in the current event loop if running,
    or executed in a new loop otherwise.
    
    Args:
        coro_or_func: Coroutine to await directly, or async function to call
        *args: Positional arguments for the function (ignored if coroutine passed)
        on_error: Optional callback for error handling
        **kwargs: Keyword arguments for the function (ignored if coroutine passed)
    
    Examples:
        # With coroutine directly:
        schedule_async(some_async_func())
        
        # With async function and args:
        schedule_async(some_async_func, arg1, arg2, kwarg=value)
    """
    # Determine the actual coroutine to execute
    if asyncio.iscoroutine(coro_or_func):
        coro = coro_or_func
        func_name = getattr(coro, '__name__', '<coroutine>')
    elif callable(coro_or_func):
        coro = coro_or_func(*args, **kwargs)
        func_name = getattr(coro_or_func, '__name__', '<callable>')
    else:
        raise TypeError(
            f"Expected coroutine or callable, got {type(coro_or_func)}"
        )
    
    async def wrapper() -> None:
        try:
            await coro
        except Exception as e:
            logger.warning(
                "fireproof.async_utils.scheduled_error",
                extra={"error": str(e), "func": func_name}
            )
            if on_error:
                try:
                    on_error(e)
                except Exception as callback_error:
                    logger.warning(
                        "fireproof.async_utils.error_callback_failed",
                        extra={"error": str(callback_error)}
                    )
    
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(wrapper())
    except RuntimeError:
        # No running loop - run in new loop
        asyncio.run(wrapper())


async def ensure_async(
    func_or_coro: Union[Callable[..., T], Callable[..., Awaitable[T]], Awaitable[T]],
    *args: Any,
    **kwargs: Any,
) -> T:
    """
    Ensure a function result is awaitable.
    
    Handles both sync and async functions/coroutines uniformly.
    
    Args:
        func_or_coro: Function to call or coroutine to await
        *args: Arguments if func_or_coro is callable
        **kwargs: Keyword arguments if func_or_coro is callable
        
    Returns:
        Result of the function/coroutine
    """
    if asyncio.iscoroutine(func_or_coro):
        return await func_or_coro
    elif callable(func_or_coro):
        result = func_or_coro(*args, **kwargs)
        return await result if asyncio.iscoroutine(result) else result
    else:
        raise TypeError(f"Expected callable or coroutine, got {type(func_or_coro)}")

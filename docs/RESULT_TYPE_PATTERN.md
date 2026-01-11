# Result Type Pattern Documentation

## Executive Summary

The Chrysalis project implements a **Result Type Pattern** providing monadic error handling as a type-safe alternative to exception-based control flow. This pattern enables explicit, composable error handling while maintaining compatibility with the existing exception-based `ValidationError` and `APIError` infrastructure.

This implementation aligns with:
- **Decision 4 (ValidationStrategy)**: Enables runtime selection between imperative validation (throwing) and functional validation (Result-returning)
- **Decision 7 (Hexagonal Architecture)**: Result types are framework-agnostic and belong in the domain layer

## Overview

The Result type represents the outcome of an operation that may fail:

```
Result<T, E> = Success<T> | Failure<E>
```

- **Success<T>**: Contains a value of type `T` representing successful computation
- **Failure<E>**: Contains an error of type `E` representing failed computation

## Installation

### Python

```python
from shared.api_core import (
    Result, Success, Failure,
    success, failure,
    validation_failure, not_found_failure, service_failure,
    map_result, flat_map, fold, sequence, traverse,
    try_catch, ResultDo
)
```

### TypeScript

```typescript
import {
    Result, Success, Failure,
    success, failure, isSuccess, isFailure,
    validationFailure, notFoundFailure, serviceFailure,
    map, flatMap, fold, sequence, traverse,
    tryCatch, ResultDo
} from '@chrysalis/api-core';
```

## Basic Usage

### Creating Results

```python
# Python
from shared.api_core import success, failure

# Create a success
result = success(42)
print(result.value)  # 42

# Create a failure
result = failure("Something went wrong")
print(result.error)  # "Something went wrong"
```

```typescript
// TypeScript
import { success, failure } from './result';

// Create a success
const result = success(42);
console.log(result.value); // 42

// Create a failure  
const result = failure("Something went wrong");
console.log(result.error); // "Something went wrong"
```

### Checking Result Type

```python
# Python
if result.is_success():
    print(f"Got value: {result.value}")
else:
    print(f"Got error: {result.error}")
```

```typescript
// TypeScript
if (isSuccess(result)) {
    console.log(`Got value: ${result.value}`);
} else {
    console.log(`Got error: ${result.error}`);
}
```

## Transformation Operations

### map - Transform Success Values

Transform the value inside a Success without affecting Failures:

```python
# Python
result = success(5)
doubled = result.map(lambda x: x * 2)
# doubled.value == 10

# Failures pass through unchanged
error = failure("error")
still_error = error.map(lambda x: x * 2)
# still_error.error == "error"
```

```typescript
// TypeScript
const result = success(5);
const doubled = map(result, x => x * 2);
// doubled.value === 10
```

### map_error - Transform Error Values

Transform the error inside a Failure:

```python
# Python
result = failure("error")
wrapped = result.map_error(lambda e: f"Wrapped: {e}")
# wrapped.error == "Wrapped: error"
```

### flat_map (chain) - Sequence Operations

Chain multiple operations that each return Results:

```python
# Python
def get_user(id: int) -> Result[dict, str]:
    if id == 1:
        return success({"id": 1, "name": "Alice"})
    return failure("User not found")

def get_email(user: dict) -> Result[str, str]:
    if "email" in user:
        return success(user["email"])
    return failure("No email")

# Chain operations
result = get_user(1).flat_map(lambda user: get_email(user))
# If get_user fails, get_email is never called
```

```typescript
// TypeScript
const result = flatMap(
    getUser(1),
    user => getEmail(user)
);
```

### fold (match) - Pattern Matching

Extract values by handling both cases:

```python
# Python
result = success(42)
output = result.fold(
    on_success=lambda x: f"Value: {x}",
    on_failure=lambda e: f"Error: {e}"
)
# output == "Value: 42"
```

```typescript
// TypeScript
const output = fold(
    result,
    value => `Value: ${value}`,
    error => `Error: ${error}`
);
```

## API Error Integration

The Result type integrates with Chrysalis's existing `APIError` taxonomy:

### validation_failure

```python
# Python
from shared.api_core import validation_failure, ErrorCode

result = validation_failure(
    message="Email is required",
    field_name="email",
    code=ErrorCode.REQUIRED_FIELD
)
# result.error.category == ErrorCategory.VALIDATION_ERROR
# result.error.details[0].field == "email"
```

### not_found_failure

```python
# Python
from shared.api_core import not_found_failure

result = not_found_failure("User", "user-123")
# result.error.category == ErrorCategory.NOT_FOUND_ERROR
# result.error.code == ErrorCode.RESOURCE_NOT_FOUND
```

### service_failure

```python
# Python
from shared.api_core import service_failure

try:
    db.execute(query)
except Exception as e:
    result = service_failure("Database error", original_error=e)
```

## Combining Multiple Results

### sequence

Combine a list of Results into a Result of a list:

```python
# Python
from shared.api_core import sequence

results = [success(1), success(2), success(3)]
combined = sequence(results)
# combined.value == [1, 2, 3]

# If any fails, return first failure
results = [success(1), failure("error"), success(3)]
combined = sequence(results)
# combined.error == "error"
```

### traverse

Map over a list with a Result-returning function:

```python
# Python
from shared.api_core import traverse

def validate_positive(x: int) -> Result[int, str]:
    if x > 0:
        return success(x)
    return failure(f"{x} is not positive")

items = [1, 2, 3]
result = traverse(items, validate_positive)
# result.value == [1, 2, 3]

items = [1, -2, 3]
result = traverse(items, validate_positive)
# result.error == "-2 is not positive"
```

### zip_results

Combine two Results into a tuple:

```python
# Python
from shared.api_core import zip_results

r1 = success("Alice")
r2 = success(30)
combined = zip_results(r1, r2)
# combined.value == ("Alice", 30)
```

## Exception Bridge

### try_catch

Wrap potentially throwing code:

```python
# Python
from shared.api_core import try_catch

def parse_json(text: str) -> Result:
    return try_catch(lambda: json.loads(text))

result = parse_json('{"key": "value"}')  # Success
result = parse_json('invalid')           # Failure
```

### Custom Error Mapping

```python
# Python
result = try_catch(
    lambda: int("not a number"),
    error_mapper=lambda e: f"Parse error: {e}"
)
# result.error == "Parse error: invalid literal..."
```

### Async Operations

```python
# Python
import asyncio
from shared.api_core import try_catch_async

async def fetch_data():
    async with aiohttp.ClientSession() as session:
        response = await session.get(url)
        return await response.json()

result = await try_catch_async(fetch_data)
```

## Builder Pattern (ResultDo)

For accumulating multiple validation results:

```python
# Python
from shared.api_core import ResultDo

def validate_user(data: dict) -> Result[dict, str]:
    do = ResultDo()
    do.bind('name', validate_name(data.get('name')))
    do.bind('email', validate_email(data.get('email')))
    do.bind('age', validate_age(data.get('age')))
    return do.result()

# Or with chaining
result = (
    ResultDo()
    .bind('name', validate_name(data.get('name')))
    .bind('email', validate_email(data.get('email')))
    .bind('age', validate_age(data.get('age')))
    .result()
)

# On success: {"name": "Alice", "email": "alice@example.com", "age": 30}
```

```typescript
// TypeScript
const result = ResultDo.of<{ name: string; email: string }>({})
    .bind('name', validateName(data.name))
    .bind('email', validateEmail(data.email))
    .return();
```

## Predicate-Based Constructors

### from_predicate

Create Result based on a condition:

```python
# Python
from shared.api_core import from_predicate

result = from_predicate(
    value=18,
    predicate=lambda x: x >= 18,
    error="Must be 18 or older"
)
# result.is_success() == True
```

### from_optional

Convert Optional/nullable to Result:

```python
# Python
from shared.api_core import from_optional

user = get_user_or_none(123)
result = from_optional(user, error="User not found")
```

### from_exception

Catch specific exception types:

```python
# Python
from shared.api_core import from_exception

result = from_exception(
    lambda: int("42"),
    exception_type=ValueError
)
```

## Utility Functions

### get_or_else

Extract value with default:

```python
# Python
result = failure("error")
value = result.get_or_else(0)  # Returns 0
```

### get_or_else_lazy

Compute default from error:

```python
# Python
result = failure("not found")
value = result.get_or_else_lazy(lambda e: len(e))  # Returns 9
```

### to_optional

Convert to nullable:

```python
# Python
success_result = success(42)
value = success_result.to_optional()  # 42

failure_result = failure("error")
value = failure_result.to_optional()  # None
```

### unwrap

Extract value or raise:

```python
# Python
result = success(42)
value = result.unwrap()  # 42

result = failure(ValueError("error"))
value = result.unwrap()  # Raises ValueError
```

## Real-World Patterns

### Validation Pipeline

```python
# Python
def validate_registration(data: dict) -> Result[dict, APIError]:
    return (
        ResultDo()
        .bind('email', validate_email(data.get('email')))
        .bind('password', validate_password(data.get('password')))
        .bind('name', validate_name(data.get('name')))
        .result()
        .map(lambda d: {**d, 'created_at': datetime.utcnow()})
    )

# Use in endpoint
@app.post("/register")
def register():
    result = validate_registration(request.json)
    return result.fold(
        on_success=lambda user: ({"user": user}, 201),
        on_failure=lambda error: (error.to_dict(), 400)
    )
```

### Service Layer

```python
# Python
class UserService:
    def get_user(self, user_id: str) -> Result[User, APIError]:
        user = self.repository.find_by_id(user_id)
        return from_optional(
            user,
            error=not_found_failure("User", user_id).error
        )
    
    def update_user(self, user_id: str, data: dict) -> Result[User, APIError]:
        return (
            self.get_user(user_id)
            .flat_map(lambda user: self.validate_update(user, data))
            .flat_map(lambda valid_data: self.repository.save(valid_data))
        )
```

### Error Recovery

```python
# Python
def fetch_from_cache(key: str) -> Result[Data, str]:
    # Try cache first
    cache_result = cache.get(key)
    if cache_result.is_success():
        return cache_result
    
    # Fall back to database
    return db.fetch(key)

# Or using fold
result = cache.get(key).fold(
    on_success=success,
    on_failure=lambda _: db.fetch(key)
)
```

## Migration Guide

### From Exception-Based Code

**Before:**
```python
def get_user(user_id: str) -> User:
    user = db.find(user_id)
    if not user:
        raise NotFoundError(f"User {user_id} not found")
    return user

# Usage
try:
    user = get_user("123")
    process(user)
except NotFoundError as e:
    handle_error(e)
```

**After:**
```python
def get_user(user_id: str) -> Result[User, APIError]:
    user = db.find(user_id)
    return from_optional(
        user,
        not_found_failure("User", user_id).error
    )

# Usage
result = get_user("123")
result.fold(
    on_success=process,
    on_failure=handle_error
)
```

### Interop with Exception Code

```python
# Wrap exception-based code
def safe_call() -> Result:
    return try_catch(lambda: legacy_function_that_throws())

# Convert Result back to exception when needed
def api_endpoint():
    result = get_user("123")
    if result.is_failure():
        raise HTTPException(status_code=404, detail=result.error.message)
    return result.value
```

## Type Safety

### TypeScript

Full type inference with discriminated unions:

```typescript
function processResult(result: Result<number, string>): string {
    if (isSuccess(result)) {
        // TypeScript knows result.value is number
        return `Got: ${result.value}`;
    }
    // TypeScript knows result.error is string
    return `Error: ${result.error}`;
}
```

### Python

Type hints with generics:

```python
from shared.api_core import Result, Success, Failure

def divide(a: int, b: int) -> Result[float, str]:
    if b == 0:
        return failure("Division by zero")
    return success(a / b)

# Type checker knows result contains float or str
result: Result[float, str] = divide(10, 2)
```

## Architectural Alignment

The Result type implementation supports Chrysalis's architectural patterns:

| Decision | Integration |
|----------|-------------|
| D4 (ValidationStrategy) | Result-returning validators work alongside imperative validators |
| D5 (Abstract Factory) | Factory methods can return `Result<Node, APIError>` |
| D6 (RxJS Observable) | Results compose with Observable streams via `switchMap` |
| D7 (Hexagonal) | Result is framework-agnostic, lives in domain layer |

## Best Practices

1. **Prefer Result for recoverable errors**, exceptions for unrecoverable
2. **Use factory functions** (`validation_failure`, `not_found_failure`) for consistent error structure
3. **Chain with flat_map** rather than nested conditionals
4. **Use ResultDo** for accumulating multiple validations
5. **Bridge at boundaries**: convert to/from exceptions at API edges
6. **Document error types** in function signatures

## API Reference

### Core Types

| Type | Description |
|------|-------------|
| `Result<T, E>` | Union of Success<T> and Failure<E> |
| `Success<T>` | Contains successful value |
| `Failure<E>` | Contains error value |

### Constructors

| Function | Signature | Description |
|----------|-----------|-------------|
| `success` | `(T) → Success<T>` | Create Success |
| `failure` | `(E) → Failure<E>` | Create Failure |
| `validation_failure` | `(str, field?, code?) → Failure<APIError>` | Validation error |
| `not_found_failure` | `(type, id) → Failure<APIError>` | Not found error |
| `service_failure` | `(msg, exc?) → Failure<APIError>` | Service error |

### Transformations

| Method | Signature | Description |
|--------|-----------|-------------|
| `map` | `(T → U) → Result<U, E>` | Transform success value |
| `map_error` | `(E → F) → Result<T, F>` | Transform error value |
| `flat_map` | `(T → Result<U, E>) → Result<U, E>` | Chain operations |
| `fold` | `(T → U, E → U) → U` | Pattern match |

### Combining

| Function | Signature | Description |
|----------|-----------|-------------|
| `sequence` | `List[Result<T, E>] → Result<List[T], E>` | Combine list |
| `traverse` | `(List[T], T → Result<U, E>) → Result<List[U], E>` | Map and combine |
| `zip_results` | `(Result<T>, Result<U>) → Result<(T, U)>` | Pair results |

### Utilities

| Method | Signature | Description |
|--------|-----------|-------------|
| `get_or_else` | `(T) → T` | Value or default |
| `to_optional` | `() → T?` | Convert to nullable |
| `unwrap` | `() → T` | Value or throw |

---

*Last Updated: January 2026*
*Version: 1.0.0*

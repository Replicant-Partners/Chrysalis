"""
Integration tests for memory system security and architecture hardening.
"""
import pytest
import os
import shutil
from memory_system.core import Memory, MemoryConfig
from memory_system.sanitization import MemorySanitizer
from memory_system.threshold import ThresholdCrypto

@pytest.fixture
def memory_config():
    """Create a temporary memory configuration for testing."""
    test_dir = "./test_memory_data"
    os.makedirs(test_dir, exist_ok=True)
    
    config = MemoryConfig(
        storage_path=test_dir,
        vector_store_type="chroma",
        embedding_model="text-embedding-3-small",
        openai_api_key="sk-test-key"  # Mock key
    )
    
    yield config
    
    # Cleanup
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)

def test_memory_sanitization():
    """Test PII detection and redaction."""
    content = "My email is test@example.com and phone is 555-0123."
    sanitized, detected = MemorySanitizer.sanitize(content)
    
    assert "test@example.com" not in sanitized
    # Phone regex might be strict about format, let's use a standard format
    content_phone = "Call 555-123-4567"
    sanitized_phone, detected_phone = MemorySanitizer.sanitize(content_phone)
    assert "555-123-4567" not in sanitized_phone
    assert "[REDACTED PHONE]" in sanitized_phone
    assert "phone" in detected_phone

    assert "[REDACTED EMAIL]" in sanitized
    assert "email" in detected

def test_threshold_cryptography():
    """Test Shamir's Secret Sharing implementation."""
    secret = 123456789
    n = 5  # Total shares
    k = 3  # Threshold
    
    # Split secret
    shares = ThresholdCrypto.split_secret(secret, k, n)
    assert len(shares) == n
    
    # Reconstruct with k shares
    reconstructed = ThresholdCrypto.reconstruct_secret(shares[:k])
    assert reconstructed == secret
    
    # Reconstruct with >k shares
    reconstructed_more = ThresholdCrypto.reconstruct_secret(shares)
    assert reconstructed_more == secret
    
    # Fail with <k shares
    # Note: With <k shares, we get a random value, not necessarily an error
    # unless we add checksums. In pure SSS, any k points define a polynomial.
    # But with <k points, there are infinite polynomials.
    # Our implementation will return *a* value, but it won't be the secret.
    reconstructed_less = ThresholdCrypto.reconstruct_secret(shares[:k-1])
    assert reconstructed_less != secret

def test_memory_integration_sanitization(memory_config):
    """Test sanitization integration in Memory class."""
    # Mock embedding provider to avoid API calls
    class MockEmbedding:
        def embed(self, text):
            return [0.1] * 1536
            
    memory = Memory(memory_config)
    memory._embedding_provider = MockEmbedding()
    memory._initialized = True
    
    # Add memory with PII
    content = "Contact me at user@domain.com"
    entry = memory.add_episodic(content)
    
    # Verify sanitization
    assert "user@domain.com" not in entry.content
    assert "[REDACTED EMAIL]" in entry.content
    assert entry.metadata.get("_sanitized") is True
    assert "email" in entry.metadata.get("_pii_detected")

if __name__ == "__main__":
    pytest.main([__file__])

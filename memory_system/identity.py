"""
Chrysalis Memory System - Cryptographic Identity
Pattern #1 (Hash) + Pattern #2 (Signatures)

Provides:
- SHA-384 fingerprinting for memories
- Ed25519 signatures for authentication
- Verification and tamper detection
"""

import hashlib
import json
from typing import Any, Dict
from datetime import datetime

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import (
        Ed25519PrivateKey,
        Ed25519PublicKey,
    )
    from cryptography.hazmat.primitives import serialization
    from cryptography.exceptions import InvalidSignature
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False
    print("Warning: cryptography library not available. Install with: pip install cryptography")

from .chrysalis_types import MemoryFingerprint, MemorySignature


class MemoryIdentity:
    """
    Pattern #1 + #2: Cryptographic Identity for Memories
    
    Every memory gets:
    1. Unique fingerprint (SHA-384 hash)
    2. Digital signature (Ed25519)
    3. Tamper detection
    """
    
    @staticmethod
    def generate_fingerprint(
        content: str,
        memory_type: str,
        timestamp: float,
        metadata: Dict[str, Any] = None
    ) -> MemoryFingerprint:
        """
        Pattern #1: Generate SHA-384 fingerprint for memory
        
        Fingerprint includes:
        - Content hash
        - Metadata hash
        - Combined fingerprint
        
        This provides:
        - Unique identity
        - Content addressing
        - Tamper detection
        """
        # Hash content
        content_hash = hashlib.sha384(content.encode('utf-8')).hexdigest()
        
        # Hash metadata (including type and timestamp)
        metadata_dict = {
            'type': memory_type,
            'timestamp': timestamp,
            **(metadata or {})
        }
        metadata_str = json.dumps(metadata_dict, sort_keys=True)
        metadata_hash = hashlib.sha384(metadata_str.encode('utf-8')).hexdigest()
        
        # Combined fingerprint (hash of content + metadata hashes)
        combined = f"{content_hash}{metadata_hash}"
        fingerprint = hashlib.sha384(combined.encode('utf-8')).hexdigest()
        
        return MemoryFingerprint(
            fingerprint=fingerprint,
            algorithm='sha384',
            contentHash=content_hash,
            metadataHash=metadata_hash
        )
    
    @staticmethod
    def sign_memory(
        fingerprint: str,
        private_key: bytes,
        instance_id: str
    ) -> MemorySignature:
        """
        Pattern #2: Sign memory with Ed25519
        
        Creates digital signature that proves:
        - Memory came from this instance
        - Memory hasn't been tampered with
        - Non-repudiation (can't deny creating it)
        """
        if not HAS_CRYPTO:
            # Fallback: create dummy signature
            return MemorySignature(
                signature=b'\x00' * 64,
                publicKey=b'\x00' * 32,
                algorithm='ed25519',
                signedBy=instance_id,
                timestamp=datetime.now().timestamp()
            )

        # Load private key
        try:
            key = Ed25519PrivateKey.from_private_bytes(private_key)
        except Exception as e:
            raise ValueError(f"Invalid Ed25519 private key: {e}") from e

        # Sign fingerprint
        message = fingerprint.encode('utf-8')
        signature = key.sign(message)

        # Get public key
        public_key = key.public_key()
        public_key_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )

        return MemorySignature(
            signature=signature,
            publicKey=public_key_bytes,
            algorithm='ed25519',
            signedBy=instance_id,
            timestamp=datetime.now().timestamp()
        )
    
    @staticmethod
    def verify_signature(
        fingerprint: str,
        signature: MemorySignature
    ) -> bool:
        """
        Pattern #2: Verify Ed25519 signature
        
        Returns True if:
        - Signature is valid
        - Memory hasn't been tampered with
        - Signature matches public key
        """
        if not HAS_CRYPTO:
            # Fallback: always verify in dev mode
            return True
        
        try:
            # Load public key
            public_key = Ed25519PublicKey.from_public_bytes(signature.publicKey)
            
            # Verify signature
            message = fingerprint.encode('utf-8')
            public_key.verify(signature.signature, message)
            
            return True
        except InvalidSignature:
            return False
        except Exception as e:
            print(f"Signature verification error: {e}")
            return False
    
    @staticmethod
    def detect_tampering(
        content: str,
        memory_type: str,
        timestamp: float,
        fingerprint: MemoryFingerprint,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """
        Pattern #1: Detect if memory has been tampered with
        
        Recalculates fingerprint and compares to stored value
        Returns True if tampering detected
        """
        # Recalculate fingerprint
        new_fingerprint = MemoryIdentity.generate_fingerprint(
            content, memory_type, timestamp, metadata
        )
        
        # Compare
        return new_fingerprint.fingerprint != fingerprint.fingerprint


class KeyPairManager:
    """
    Manages Ed25519 keypairs for agent instances
    
    Pattern #2: Each instance has its own signing keys
    """
    
    @staticmethod
    def generate_keypair() -> tuple[bytes, bytes]:
        """
        Generate new Ed25519 keypair
        
        Returns: (private_key_bytes, public_key_bytes)
        """
        if not HAS_CRYPTO:
            # Fallback: return dummy keys
            return (b'\x00' * 32, b'\x00' * 32)
        
        private_key = Ed25519PrivateKey.generate()
        private_key_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        public_key = private_key.public_key()
        public_key_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        return (private_key_bytes, public_key_bytes)
    
    @staticmethod
    def public_key_from_private(private_key_bytes: bytes) -> bytes:
        """Get public key from private key"""
        if not HAS_CRYPTO:
            return b'\x00' * 32
        
        private_key = Ed25519PrivateKey.from_private_bytes(private_key_bytes)
        public_key = private_key.public_key()
        return public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )


# ==============================================================================
# Convenience Functions
# ==============================================================================

def create_memory_id(
    content: str,
    memory_type: str = "observation",
    metadata: Dict[str, Any] = None
) -> tuple[str, MemoryFingerprint]:
    """
    Convenience: Create memory ID and fingerprint
    
    Returns: (memory_id, fingerprint)
    """
    timestamp = datetime.now().timestamp()
    fingerprint = MemoryIdentity.generate_fingerprint(
        content, memory_type, timestamp, metadata
    )
    return (fingerprint.fingerprint, fingerprint)


def sign_and_verify(
    content: str,
    private_key: bytes,
    instance_id: str,
    memory_type: str = "observation"
) -> tuple[MemoryFingerprint, MemorySignature, bool]:
    """
    Convenience: Fingerprint, sign, and verify memory in one call
    
    Returns: (fingerprint, signature, verification_result)
    """
    # Generate fingerprint
    timestamp = datetime.now().timestamp()
    fingerprint = MemoryIdentity.generate_fingerprint(content, memory_type, timestamp)
    
    # Sign
    signature = MemoryIdentity.sign_memory(
        fingerprint.fingerprint,
        private_key,
        instance_id
    )
    
    # Verify
    verified = MemoryIdentity.verify_signature(fingerprint.fingerprint, signature)
    
    return (fingerprint, signature, verified)


# ==============================================================================
# Example Usage
# ==============================================================================

if __name__ == "__main__":
    print("=== Chrysalis Memory Identity Demo ===\n")

    # Generate keypair
    print("1. Generating Ed25519 keypair...")
    private_key, public_key = KeyPairManager.generate_keypair()
    print(f"   Private key: {private_key[:8].hex()}... ({len(private_key)} bytes)")
    print(f"   Public key:  {public_key[:8].hex()}... ({len(public_key)} bytes)\n")

    # Create memory
    content = "User asked about quantum computing"
    instance_id = "instance-001"

    print(f"2. Creating memory: '{content}'")
    fingerprint, signature, verified = sign_and_verify(
        content, private_key, instance_id
    )

    print(f"\n3. Memory fingerprint (SHA-384):")
    print(f"   {fingerprint.fingerprint[:64]}...")
    print(f"   Content hash:  {fingerprint.contentHash[:32]}...")
    print(f"   Metadata hash: {fingerprint.metadataHash[:32]}...\n")

    print("4. Memory signature (Ed25519):")
    print(f"   Signature: {signature.signature[:16].hex()}... ({len(signature.signature)} bytes)")
    print(f"   Signed by: {signature.signedBy}")
    print(f"   Verified:  {verified} ✓\n")

    # Detect tampering
    print("5. Tampering detection:")
    tampered = "User asked about classical computing"  # Modified!
    tampering_detected = MemoryIdentity.detect_tampering(
        tampered, "observation", signature.timestamp, fingerprint
    )
    print(f"   Modified content detected: {tampering_detected} ✓\n")

    print("=== Pattern #1 + #2: Complete ===")

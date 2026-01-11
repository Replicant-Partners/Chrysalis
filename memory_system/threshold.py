"""
Threshold Cryptography Module
Implements Shamir's Secret Sharing for distributed trust and key management.
"""
import random
from typing import List, Tuple

# 12th Mersenne Prime (2^127 - 1)
# Sufficiently large for cryptographic secrets
PRIME = 170141183460469231731687303715884105727

class ThresholdCrypto:
    """
    Implements Shamir's Secret Sharing for Threshold Cryptography.
    Allows splitting a secret into n shares, where k shares are required to reconstruct it.
    """

    @staticmethod
    def _eval_poly(poly: List[int], x: int, prime: int) -> int:
        """Evaluates polynomial at x."""
        result = 0
        for coeff in reversed(poly):
            result = (result * x + coeff) % prime
        return result

    @staticmethod
    def _extended_gcd(a: int, b: int) -> Tuple[int, int, int]:
        """Extended Euclidean Algorithm."""
        x0, x1, y0, y1 = 0, 1, 1, 0
        while a != 0:
            q, b, a = b // a, a, b % a
            y0, y1 = y1, y0 - q * y1
            x0, x1 = x1, x0 - q * x1
        return b, x0, y0

    @staticmethod
    def _mod_inverse(k: int, prime: int) -> int:
        """Compute modular multiplicative inverse."""
        g, x, y = ThresholdCrypto._extended_gcd(k, prime)
        if g != 1:
            raise ValueError("Modular inverse does not exist")
        return (x % prime + prime) % prime

    @staticmethod
    def split_secret(secret: int, k: int, n: int, prime: int = PRIME) -> List[Tuple[int, int]]:
        """
        Split a secret into n shares, requiring k to reconstruct.
        
        Args:
            secret: The integer secret to split
            k: Minimum shares to reconstruct
            n: Total number of shares to generate
            prime: Prime number for finite field (default: 2^127 - 1)
            
        Returns:
            List of (x, y) tuples representing the shares
        """
        if k > n:
            raise ValueError("k must be less than or equal to n")
        
        # Generate random coefficients for polynomial of degree k-1
        # f(x) = secret + a1*x + a2*x^2 + ... + a(k-1)*x^(k-1)
        coeffs = [secret] + [random.randint(0, prime - 1) for _ in range(k - 1)]
        
        shares = []
        for i in range(1, n + 1):
            x = i
            y = ThresholdCrypto._eval_poly(coeffs, x, prime)
            shares.append((x, y))
            
        return shares

    @staticmethod
    def reconstruct_secret(shares: List[Tuple[int, int]], prime: int = PRIME) -> int:
        """
        Reconstruct secret from k shares using Lagrange interpolation.
        
        Args:
            shares: List of (x, y) tuples
            prime: Prime number for finite field
            
        Returns:
            The reconstructed integer secret
        """
        if not shares:
            raise ValueError("No shares provided")
            
        k = len(shares)
        x_s, y_s = zip(*shares)
        
        secret = 0
        
        for i in range(k):
            numerator = 1
            denominator = 1
            
            for j in range(k):
                if i == j:
                    continue
                
                numerator = (numerator * (-x_s[j])) % prime
                denominator = (denominator * (x_s[i] - x_s[j])) % prime
                
            lagrange_coeff = (numerator * ThresholdCrypto._mod_inverse(denominator, prime)) % prime
            secret = (secret + y_s[i] * lagrange_coeff) % prime
            
        return (secret + prime) % prime

    @staticmethod
    def bytes_to_int(data: bytes) -> int:
        """Convert bytes to integer."""
        return int.from_bytes(data, byteorder='big')

    @staticmethod
    def int_to_bytes(data: int) -> bytes:
        """Convert integer to bytes."""
        # Calculate required bytes (round up)
        length = (data.bit_length() + 7) // 8
        return data.to_bytes(length, byteorder='big')

"""
Memory Sanitization Module
Provides PII detection and redaction capabilities for the memory system.
"""
import re
from typing import List, Tuple, Dict, Any

class MemorySanitizer:
    """
    Sanitizes memory content to remove or mask PII (Personally Identifiable Information).
    """
    
    # Regex patterns for common PII
    PATTERNS = {
        'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        'phone': r'\b(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b',
        'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
        'credit_card': r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
        'ipv4': r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',
    }

    @staticmethod
    def sanitize(content: str) -> Tuple[str, List[str]]:
        """
        Sanitizes the content by masking PII.
        
        Args:
            content: The raw text content
            
        Returns:
            Tuple containing:
            - sanitized_content: Text with PII redacted
            - detected_types: List of PII types found
        """
        detected_types = []
        sanitized_content = content
        
        for pii_type, pattern in MemorySanitizer.PATTERNS.items():
            if re.search(pattern, sanitized_content):
                if pii_type not in detected_types:
                    detected_types.append(pii_type)
                sanitized_content = re.sub(pattern, f'[REDACTED {pii_type.upper()}]', sanitized_content)
                
        return sanitized_content, detected_types

    @staticmethod
    def validate_metadata(metadata: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
        """
        Sanitizes values in metadata dictionary.
        """
        sanitized_metadata = {}
        all_detected_types = []
        
        for key, value in metadata.items():
            if isinstance(value, str):
                sanitized_val, detected = MemorySanitizer.sanitize(value)
                sanitized_metadata[key] = sanitized_val
                all_detected_types.extend(detected)
            else:
                sanitized_metadata[key] = value
                
        return sanitized_metadata, list(set(all_detected_types))

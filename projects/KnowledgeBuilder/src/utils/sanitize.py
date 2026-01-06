import re
import string
from typing import Dict, Optional


def _is_text_like(text: str) -> bool:
    if "\x00" in text:
        return False
    printable = set(string.printable)
    non_printables = sum(1 for ch in text if ch not in printable)
    if len(text) > 0 and non_printables / len(text) > 0.05:
        return False
    return True


def sanitize_text(text: str, max_len: int = 4000) -> str:
    """Strip script/style tags and clamp length; drop if non-text-like."""
    if not _is_text_like(text):
        return ""
    # Remove script/style blocks
    text = re.sub(r"<script.*?>.*?</script>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style.*?>.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    # Remove HTML tags (shallow)
    text = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    # Clamp length
    return text[:max_len]


def sanitize_attributes(
    attrs: Dict[str, str],
    max_len: int = 4000,
    content_type: Optional[str] = None,
    max_bytes: int = 80000,
) -> Dict[str, str]:
    """
    Return a sanitized copy of attributes with basic MIME/size gating for page_text.
    If content_type is provided and is not text/*, page_text is dropped.
    """
    clean: Dict[str, str] = {}
    is_text_content = True
    if content_type and not content_type.lower().startswith("text/"):
        is_text_content = False

    for k, v in attrs.items():
        if isinstance(v, str):
            if k == "page_text":
                if not is_text_content:
                    continue
                if len(v.encode("utf-8")) > max_bytes:
                    continue
                cleaned = sanitize_text(v, max_len=max_len * 2)  # allow a bit more for page_text
            else:
                cleaned = sanitize_text(v, max_len=max_len)
            if cleaned:
                clean[k] = cleaned
        else:
            clean[k] = v
    return clean

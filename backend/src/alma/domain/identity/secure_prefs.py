"""Secure preferences — encrypt/decrypt sensitive fields"""

import logging

from alma.domain.integration.crypto import encrypt_token, decrypt_token

logger = logging.getLogger(__name__)

# Fields that should be encrypted in preferences
SENSITIVE_FIELDS = {
    "anthropic_api_key",
    "openai_api_key",
    "gemini_api_key",
    "google_client_id",
    "google_client_secret",
}

ENCRYPTED_PREFIX = "encrypted:"


def encrypt_sensitive(prefs: dict) -> dict:
    """Encrypt sensitive fields before saving to DB"""
    result = dict(prefs)
    for key in SENSITIVE_FIELDS:
        if key in result and result[key]:
            value = result[key]
            # Already encrypted? Skip
            if isinstance(value, str) and value.startswith(ENCRYPTED_PREFIX):
                continue
            try:
                result[key] = ENCRYPTED_PREFIX + encrypt_token(value)
            except Exception:
                logger.warning("Failed to encrypt %s", key)
    return result


def decrypt_sensitive(prefs: dict) -> dict:
    """Decrypt sensitive fields when reading from DB"""
    result = dict(prefs)
    for key in SENSITIVE_FIELDS:
        if key in result and result[key]:
            value = result[key]
            if isinstance(value, str) and value.startswith(ENCRYPTED_PREFIX):
                try:
                    result[key] = decrypt_token(value[len(ENCRYPTED_PREFIX) :])
                except Exception:
                    logger.warning("Failed to decrypt %s", key)
                    result[key] = ""
    return result


def mask_sensitive(prefs: dict) -> dict:
    """Mask sensitive fields for API response (show only last 4 chars)"""
    result = dict(prefs)
    for key in SENSITIVE_FIELDS:
        if key in result and result[key]:
            value = result[key]
            # Decrypt first if encrypted
            if isinstance(value, str) and value.startswith(ENCRYPTED_PREFIX):
                try:
                    value = decrypt_token(value[len(ENCRYPTED_PREFIX) :])
                except Exception:
                    value = ""
            if value and len(value) > 4:
                result[key] = "\u2022\u2022\u2022\u2022" + value[-4:]
            elif value:
                result[key] = "\u2022\u2022\u2022\u2022"
            else:
                result[key] = ""
    return result

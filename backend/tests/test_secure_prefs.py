from alma.domain.identity.secure_prefs import (
    ENCRYPTED_PREFIX,
    decrypt_sensitive,
    encrypt_sensitive,
    mask_sensitive,
)


def test_encrypt_decrypt_round_trip():
    prefs = {"anthropic_api_key": "sk-ant-test123", "language": "ko"}
    encrypted = encrypt_sensitive(prefs)
    assert encrypted["anthropic_api_key"].startswith(ENCRYPTED_PREFIX)
    assert encrypted["language"] == "ko"  # non-sensitive unchanged

    decrypted = decrypt_sensitive(encrypted)
    assert decrypted["anthropic_api_key"] == "sk-ant-test123"


def test_mask_sensitive():
    prefs = {"anthropic_api_key": "sk-ant-test123456", "language": "ko"}
    encrypted = encrypt_sensitive(prefs)
    masked = mask_sensitive(encrypted)
    assert masked["anthropic_api_key"] == "\u2022\u2022\u2022\u20223456"
    assert masked["language"] == "ko"


def test_empty_values():
    prefs = {"anthropic_api_key": "", "openai_api_key": None}
    encrypted = encrypt_sensitive(prefs)
    assert encrypted["anthropic_api_key"] == ""


def test_already_encrypted_skip():
    prefs = {"anthropic_api_key": "encrypted:already"}
    encrypted = encrypt_sensitive(prefs)
    assert encrypted["anthropic_api_key"] == "encrypted:already"

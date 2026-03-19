import pytest
from cryptography.fernet import Fernet


def test_fernet_encrypt_decrypt():
    """Fernet 암호화/복호화 기본 동작 검증"""
    key = Fernet.generate_key()
    f = Fernet(key)
    original = "ya29.a0AfH6SMBx-test-token"
    encrypted = f.encrypt(original.encode()).decode()
    assert encrypted != original
    decrypted = f.decrypt(encrypted.encode()).decode()
    assert decrypted == original


def test_fernet_different_keys_fail():
    """다른 키로 복호화 시 실패"""
    key1 = Fernet.generate_key()
    key2 = Fernet.generate_key()
    f1 = Fernet(key1)
    f2 = Fernet(key2)
    encrypted = f1.encrypt(b"secret-token")
    with pytest.raises(Exception):
        f2.decrypt(encrypted)


def test_get_fernet_no_key():
    """ENCRYPTION_KEY 미설정 시 ValueError"""
    from unittest.mock import patch

    with patch("alma.domain.integration.crypto.settings") as mock_settings:
        mock_settings.encryption_key = ""
        from alma.domain.integration.crypto import get_fernet

        with pytest.raises(ValueError, match="ENCRYPTION_KEY not set"):
            get_fernet()

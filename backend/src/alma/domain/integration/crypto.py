from cryptography.fernet import Fernet

from alma.config import settings


def get_fernet() -> Fernet:
    key = settings.encryption_key
    if not key:
        raise ValueError("ENCRYPTION_KEY not set")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_token(token: str) -> str:
    f = get_fernet()
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    f = get_fernet()
    return f.decrypt(encrypted.encode()).decode()

from datetime import datetime, timedelta

import pytest
from jose import jwt


def test_state_jwt_encode_decode():
    """State JWT 생성 및 검증"""
    secret = "test-secret-key"
    state = jwt.encode(
        {
            "user_id": "user-123",
            "nonce": "abc123",
            "exp": datetime.utcnow() + timedelta(minutes=10),
        },
        secret,
        algorithm="HS256",
    )
    payload = jwt.decode(state, secret, algorithms=["HS256"])
    assert payload["user_id"] == "user-123"
    assert payload["nonce"] == "abc123"


def test_expired_state_rejected():
    """만료된 state JWT 거부"""
    secret = "test-secret-key"
    state = jwt.encode(
        {
            "user_id": "user-123",
            "nonce": "abc",
            "exp": datetime.utcnow() - timedelta(minutes=1),
        },
        secret,
        algorithm="HS256",
    )
    from jose import ExpiredSignatureError

    with pytest.raises(ExpiredSignatureError):
        jwt.decode(state, secret, algorithms=["HS256"])


def test_invalid_state_rejected():
    """잘못된 state JWT 거부"""
    from jose import JWTError

    with pytest.raises(JWTError):
        jwt.decode("invalid-jwt-token", "test-secret", algorithms=["HS256"])


def test_wrong_secret_rejected():
    """다른 시크릿으로 검증 시 실패"""
    state = jwt.encode(
        {"user_id": "user-123", "exp": datetime.utcnow() + timedelta(minutes=10)},
        "secret-1",
        algorithm="HS256",
    )
    from jose import JWTError

    with pytest.raises(JWTError):
        jwt.decode(state, "secret-2", algorithms=["HS256"])


def test_state_contains_required_fields():
    """State에 user_id, nonce, exp 포함 확인"""
    import secrets

    secret = "test-secret"
    nonce = secrets.token_urlsafe(32)
    state = jwt.encode(
        {
            "user_id": "user-456",
            "nonce": nonce,
            "exp": datetime.utcnow() + timedelta(minutes=10),
        },
        secret,
        algorithm="HS256",
    )
    payload = jwt.decode(state, secret, algorithms=["HS256"])
    assert "user_id" in payload
    assert "nonce" in payload
    assert "exp" in payload
    assert len(payload["nonce"]) >= 32

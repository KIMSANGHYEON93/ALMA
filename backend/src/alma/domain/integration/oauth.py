from datetime import datetime, timedelta, timezone

from google_auth_oauthlib.flow import Flow
from jose import jwt

from alma.config import settings

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


def _create_flow(client_id: str, client_secret: str) -> Flow:
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uris": [settings.google_redirect_uri],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
    )
    flow.redirect_uri = settings.google_redirect_uri
    return flow


class GoogleOAuthService:
    @staticmethod
    def generate_auth_url(
        user_id: str,
        client_id: str | None = None,
        client_secret: str | None = None,
    ) -> tuple[str, str]:
        """Returns (auth_url, nonce). nonce contains code_verifier for PKCE."""
        cid = client_id or settings.google_client_id
        csecret = client_secret or settings.google_client_secret

        flow = _create_flow(cid, csecret)
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            state=jwt.encode(
                {
                    "user_id": user_id,
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
                },
                settings.jwt_secret,
                algorithm="HS256",
            ),
        )

        # code_verifier를 nonce로 반환 (DB에 저장되어 exchange 시 사용)
        code_verifier = flow.code_verifier or ""
        return auth_url, code_verifier

    @staticmethod
    def verify_state(state: str) -> dict:
        """Returns decoded payload or raises JWTError/ExpiredSignatureError"""
        return jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])

    @staticmethod
    def exchange_code(
        code: str,
        client_id: str | None = None,
        client_secret: str | None = None,
        code_verifier: str | None = None,
    ) -> dict:
        """Exchange auth code for tokens."""
        cid = client_id or settings.google_client_id
        csecret = client_secret or settings.google_client_secret

        flow = _create_flow(cid, csecret)
        # PKCE code_verifier 설정
        if code_verifier:
            flow.code_verifier = code_verifier
        flow.fetch_token(code=code)

        credentials = flow.credentials
        return {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "expiry": credentials.expiry,
        }

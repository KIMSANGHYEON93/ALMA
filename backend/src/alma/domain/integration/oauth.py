import secrets
from datetime import datetime, timedelta

from google_auth_oauthlib.flow import Flow
from jose import jwt

from alma.config import settings

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


class GoogleOAuthService:
    @staticmethod
    def generate_auth_url(
        user_id: str,
        client_id: str | None = None,
        client_secret: str | None = None,
    ) -> tuple[str, str]:
        """Returns (auth_url, nonce)"""
        cid = client_id or settings.google_client_id
        csecret = client_secret or settings.google_client_secret
        nonce = secrets.token_urlsafe(32)
        state = jwt.encode(
            {
                "user_id": user_id,
                "nonce": nonce,
                "exp": datetime.utcnow() + timedelta(minutes=10),
            },
            settings.jwt_secret,
            algorithm="HS256",
        )

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": cid,
                    "client_secret": csecret,
                    "redirect_uris": [settings.google_redirect_uri],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=SCOPES,
        )
        flow.redirect_uri = settings.google_redirect_uri
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            state=state,
        )
        return auth_url, nonce

    @staticmethod
    def verify_state(state: str) -> dict:
        """Returns decoded payload or raises JWTError/ExpiredSignatureError"""
        return jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])

    @staticmethod
    def exchange_code(
        code: str,
        client_id: str | None = None,
        client_secret: str | None = None,
    ) -> dict:
        """Exchange auth code for tokens."""
        cid = client_id or settings.google_client_id
        csecret = client_secret or settings.google_client_secret
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": cid,
                    "client_secret": csecret,
                    "redirect_uris": [settings.google_redirect_uri],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=SCOPES,
        )
        flow.redirect_uri = settings.google_redirect_uri
        flow.fetch_token(code=code)
        credentials = flow.credentials
        return {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "expiry": credentials.expiry,
        }

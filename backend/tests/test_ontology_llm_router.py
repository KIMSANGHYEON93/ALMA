"""온톨로지 경로의 LLM 라우터 해석 회귀 테스트.

온톨로지 라우터 4곳(ontology / ontology_insights / ontology_automations /
ontology_import)은 각자 로컬 팩토리로 LLMRouter를 만들었다. 그 팩토리는
(1) 요청마다 프로바이더를 새로 생성해 이벤트 루프를 막았고,
(2) anthropic/openai만 보고 gemini를 빠뜨렸으며,
(3) 사용자별 API 키를 전혀 읽지 않았다.
이제 넷 다 `alma.api.llm.resolve_llm_router`를 공유한다.
"""

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from alma.api import llm as llm_module
from alma.api.llm import resolve_llm_router
from alma.config import settings
from alma.domain.identity.profile import UserProfileService
from alma.domain.identity.service import create_access_token, hash_password
from alma.main import app
from alma.models.models import User


class _StubClient:
    """실제 SDK 클라이언트(ssl.SSLContext 생성)를 만들지 않기 위한 대역."""


@pytest.fixture
def stub_providers(monkeypatch):
    """프로바이더 생성을 대역으로 바꾸고 팩토리 캐시를 비운다."""
    monkeypatch.setattr(llm_module, "ClaudeProvider", lambda: _StubClient())
    monkeypatch.setattr(llm_module, "OpenAIProvider", lambda: _StubClient())
    monkeypatch.setattr(llm_module, "GeminiProvider", lambda: _StubClient())
    monkeypatch.setattr("anthropic.AsyncAnthropic", lambda **kw: _StubClient())
    monkeypatch.setattr("openai.AsyncOpenAI", lambda **kw: _StubClient())
    monkeypatch.setattr("google.genai.Client", lambda **kw: _StubClient())
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "gemini_api_key", "")
    llm_module._build_llm_router.cache_clear()
    yield
    llm_module._build_llm_router.cache_clear()


@pytest.fixture
async def ontology_user(db_session):
    user = User(
        email=f"ontology_llm_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass123"),
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_resolve_returns_none_without_any_key(db_session, ontology_user, stub_providers):
    """키가 하나도 없으면 None — 호출부는 이걸 503으로 바꾼다."""
    assert await resolve_llm_router(db_session, ontology_user.id) is None


async def test_resolve_accepts_gemini_only(db_session, ontology_user, stub_providers, monkeypatch):
    """Gemini 키만 설정돼도 온톨로지 LLM 기능이 살아야 한다.

    회귀 방지: 기존 로컬 팩토리는 anthropic/openai만 확인해서, Gemini만 설정한
    사용자에게 "LLM extraction not available" 503을 돌려줬다. Gemini는 이 프로젝트의
    1순위 프로바이더다.
    """
    monkeypatch.setattr(settings, "gemini_api_key", "global-gemini-key")
    llm_module._build_llm_router.cache_clear()

    llm_router = await resolve_llm_router(db_session, ontology_user.id)

    assert llm_router is not None
    assert llm_router.list_available() == ["gemini"]


async def test_resolve_uses_user_specific_key(db_session, ontology_user, stub_providers):
    """전역 키가 없어도 사용자 preferences의 키로 동작해야 한다.

    회귀 방지: 기존 로컬 팩토리는 settings만 읽어서, 자기 키를 등록한 사용자도
    온톨로지 추출/인사이트를 쓸 수 없었다.
    """
    profile = UserProfileService(db_session)
    await profile.update_preferences(str(ontology_user.id), {"anthropic_api_key": "user-key"})
    llm_module._build_llm_router.cache_clear()

    llm_router = await resolve_llm_router(db_session, ontology_user.id)

    assert llm_router is not None
    assert llm_router.list_available() == ["claude"]


async def test_resolve_reuses_cached_router(db_session, ontology_user, stub_providers, monkeypatch):
    """같은 키 조합이면 프로바이더를 다시 만들지 않는다.

    회귀 방지: 요청마다 새로 만들면 CA 번들 파싱(수 초)이 이벤트 루프에서 반복돼
    같은 프로세스의 다른 HTTP 요청이 전부 밀린다(3e1530d와 동일한 결함).
    """
    monkeypatch.setattr(settings, "gemini_api_key", "global-gemini-key")
    llm_module._build_llm_router.cache_clear()

    first = await resolve_llm_router(db_session, ontology_user.id)
    second = await resolve_llm_router(db_session, ontology_user.id)

    assert first is second


# --- /api/ontology/extract/preview 오류 구분 ---


@pytest.fixture
async def auth_client(db_session):
    user = User(
        email=f"ontology_api_{uuid.uuid4().hex[:8]}@test.com",
        password_hash=hash_password("pass123"),
    )
    db_session.add(user)
    await db_session.flush()
    headers = {"Authorization": f"Bearer {create_access_token(str(user.id))}"}
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", headers=headers
    ) as client:
        yield client


async def test_extract_preview_503_when_no_llm_configured(auth_client, monkeypatch):
    async def _no_router(session, user_id):
        return None

    monkeypatch.setattr("alma.api.ontology.resolve_llm_router", _no_router)

    resp = await auth_client.post("/api/ontology/extract/preview", json={"text": "회의 메모"})

    assert resp.status_code == 503


async def test_extract_preview_502_when_extraction_fails(auth_client, monkeypatch):
    """추출 실패를 503으로 뭉뚱그리면 설정 문제로 오인된다 — 502로 구분한다."""

    async def _some_router(session, user_id):
        return _StubClient()

    class _BoomExtractor:
        def __init__(self, *args, **kwargs):
            pass

        async def extract(self, *args, **kwargs):
            raise RuntimeError("provider exploded")

    monkeypatch.setattr("alma.api.ontology.resolve_llm_router", _some_router)
    monkeypatch.setattr("alma.domain.ontology.extractor.SemanticExtractor", _BoomExtractor)

    resp = await auth_client.post("/api/ontology/extract/preview", json={"text": "회의 메모"})

    assert resp.status_code == 502

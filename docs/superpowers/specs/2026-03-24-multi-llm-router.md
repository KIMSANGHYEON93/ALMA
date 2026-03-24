# 멀티 LLM 라우터

## 1. 개요

Claude/GPT/Gemini를 전환 가능한 LLM 라우터. 사용자가 모델을 선택하거나 자동 폴백.

**범위:**
- OpenAIProvider, GeminiProvider 추가
- LLMRouter (모델 선택 + 폴백 체인)
- 사용자별 모델 선호도 (preferences)
- 모델 선택 API + 프론트엔드 설정

**범위 외:** 서킷 브레이커, 비용 추적, 로컬 Ollama

---

## 2. Provider 추가

### 2.1 OpenAIProvider

```python
class OpenAIProvider:
    def __init__(self, model="gpt-4o-mini"):
        self.client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = model
    async def complete(self, request: LLMRequest) -> LLMResponse: ...
```

### 2.2 GeminiProvider

```python
class GeminiProvider:
    def __init__(self, model="gemini-2.0-flash"):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = model
    async def complete(self, request: LLMRequest) -> LLMResponse: ...
```

---

## 3. LLMRouter

```python
class LLMRouter:
    def __init__(self, providers: dict[str, LLMProvider], default: str = "claude"):
        self.providers = providers  # {"claude": ClaudeProvider, "openai": OpenAIProvider, ...}
        self.default = default

    async def complete(self, request: LLMRequest, provider_name: str | None = None) -> LLMResponse:
        name = provider_name or self.default
        provider = self.providers.get(name)
        if not provider:
            raise ValueError(f"Unknown provider: {name}")
        try:
            return await provider.complete(request)
        except Exception:
            # 폴백: 다른 가용 프로바이더 시도
            for fallback_name, fallback in self.providers.items():
                if fallback_name != name:
                    try:
                        return await fallback.complete(request)
                    except Exception:
                        continue
            raise

    def list_available(self) -> list[str]:
        return list(self.providers.keys())
```

---

## 4. 사용자 모델 선호도

기존 `preferences` JSONB에 `llm_model` 키 추가:
```json
{"language": "ko", "response_style": "concise", "llm_model": "claude"}
```

ChatService에서 사용자 선호 모델 사용:
```python
model_pref = preferences.get("llm_model", "claude")
response = await self.llm_router.complete(request, provider_name=model_pref)
```

---

## 5. API

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/llm/models` | 사용 가능한 모델 목록 |
| `PUT /api/users/me/preferences` | llm_model 설정 (기존 API) |

---

## 6. 파일 구조

### Create
| 파일 | 책임 |
|------|------|
| `infrastructure/llm/openai_provider.py` | OpenAIProvider |
| `infrastructure/llm/gemini_provider.py` | GeminiProvider |
| `infrastructure/llm/router.py` | LLMRouter (선택 + 폴백) |
| `api/llm.py` | 모델 목록 API |
| `tests/test_llm_router.py` | 6개 테스트 |

### Modify
| 파일 | 변경 |
|------|------|
| `api/chat.py` | ClaudeProvider → LLMRouter |
| `main.py` | +llm_router 등록 |

### Frontend — Modify
| 파일 | 변경 |
|------|------|
| `app/settings/page.tsx` | 모델 선택 드롭다운 |

---

## 7. 테스트

| # | 테스트 | 내용 |
|---|--------|------|
| 1 | test_claude_provider | Claude API 모킹 → 응답 확인 |
| 2 | test_openai_provider | OpenAI API 모킹 → 응답 확인 |
| 3 | test_gemini_provider | Gemini API 모킹 → 응답 확인 |
| 4 | test_router_default | 기본 프로바이더 선택 |
| 5 | test_router_fallback | 첫 번째 실패 → 폴백 |
| 6 | test_router_specific | 특정 프로바이더 지정 |

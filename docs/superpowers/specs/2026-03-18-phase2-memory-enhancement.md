# Phase 2: Memory Enhancement — Spec Document

> **Goal:** VIVARA가 대화를 기억하고, 과거 맥락을 활용하며, 사용자를 점진적으로 학습하는 메모리 시스템 구축

## 1. 스코프

| 기능 | 설명 | 사용자 가치 |
|------|------|------------|
| 대화 지속성 | 새로고침/재방문 시 이전 메시지 표시 | 대화가 이어지는 경험 |
| 벡터 검색 | 과거 대화 유사도 검색으로 맥락 자동 참조 | 더 정확한 응답 |
| 사용자 프로필 학습 | 명시적 설정 + 대화 기반 자동 학습 | 개인화된 비서 |

## 2. DDD 바운디드 컨텍스트

### 2.1 컨텍스트 맵

```
chat ──(프로필 학습 트리거)──► identity
chat ◄──(conformist)──────── memory
chat ──(orchestration)──────► integration
```

- **chat (upstream)**: Message 엔티티 소유. MessageRepository 제공. ChatService가 ProfileService 호출
- **memory (downstream, conformist)**: chat의 모델에 맞춰 동작. embedding 생성/검색 담당
- **identity**: User 엔티티 + preferences 소유. ProfileService가 학습 담당 (identity 내부 동작)

### 2.2 구조

```
domain/
├── identity/
│   ├── service.py             기존 (JWT, bcrypt)
│   ├── repository.py          기존 (UserRepository)
│   └── profile.py             NEW: UserProfileService
│
├── chat/
│   ├── service.py             기존 (ChatService) — ProfileService 호출 추가
│   └── repository.py          기존 + get_messages_paginated() 추가
│
├── memory/
│   ├── service.py             기존 확장 (EmbeddingProvider 의존)
│   ├── embedding.py           NEW: EmbeddingProvider Protocol + 구현체
│   └── models.py              NEW: SearchQuery, SearchResult 값 객체
│
infrastructure/llm/            변경 없음
```

## 3. 대화 지속성

### 3.1 API

```
GET /api/conversations/{conversation_id}/messages
  Query: limit=20, before={message_id} (커서 기반)
  Response: { messages: [...], has_more: bool }
  Auth: Bearer token 필수
  소유권 검증: conversation.user_id == current_user.id, 아닐 경우 404
  빈 대화: { messages: [], has_more: false }
  존재하지 않는 conversation_id: 404
```

### 3.2 Repository 변경

```python
# domain/chat/repository.py — MessageRepository 확장
async def get_messages_paginated(
    self,
    conversation_id: uuid.UUID,
    limit: int = 20,
    before_id: uuid.UUID | None = None,
) -> tuple[list[Message], bool]:
    """커서 기반 페이지네이션.
    정렬: before_id 기준 created_at DESC로 limit+1개 조회,
    결과를 created_at ASC로 정렬하여 반환.
    has_more = 조회 결과가 limit+1개인 경우 True.
    """
```

### 3.3 Frontend

- `ChatWindow.tsx`: 대화 선택 시 `GET /api/conversations/{id}/messages` 호출
- 위로 스크롤 시 `before={oldest_message_id}` 파라미터로 추가 로드
- `IntersectionObserver`로 스크롤 감지
- 로딩 상태 표시 (스켈레톤 또는 스피너)

## 4. 벡터 검색 활성화

### 4.1 DB 마이그레이션

```sql
-- 1. HNSW 인덱스 삭제
DROP INDEX IF EXISTS idx_messages_embedding;

-- 2. 벡터 차원 변경
ALTER TABLE messages ALTER COLUMN embedding TYPE vector(768);

-- 3. HNSW 인덱스 재생성
CREATE INDEX idx_messages_embedding ON messages
  USING hnsw (embedding vector_cosine_ops);
```

기존 embedding 데이터 없음 (Phase 1에서 키 미설정). 마이그레이션 안전.

### 4.2 EmbeddingProvider Protocol

```python
# domain/memory/embedding.py
class EmbeddingProvider(Protocol):
    async def embed(self, text: str) -> list[float] | None: ...

    @property
    def dimensions(self) -> int: ...

class GeminiEmbedding:
    """google-generativeai SDK는 동기 API.
    embed()에서 asyncio.to_thread()로 래핑하여 이벤트 루프 블로킹 방지.
    __init__에서 genai.configure() 1회 호출 (글로벌 상태 최소화)."""
    dimensions = 768

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)

    async def embed(self, text: str) -> list[float] | None:
        result = await asyncio.to_thread(
            genai.embed_content, model="models/text-embedding-004", content=text
        )
        return result["embedding"]

class OpenAIEmbedding:
    """OpenAI text-embedding-3-small.
    dimensions=768 파라미터로 768차원 출력 (DB 스키마와 일치).
    네이티브 async API 사용."""
    dimensions = 768  # text-embedding-3-small은 dimensions 파라미터 지원

    async def embed(self, text: str) -> list[float] | None:
        response = await client.embeddings.create(
            model="text-embedding-3-small", input=text, dimensions=768
        )
        return response.data[0].embedding

def create_embedding_provider(settings) -> EmbeddingProvider | None:
    """설정 기반 팩토리. Gemini > OpenAI > None.
    반환된 provider의 dimensions가 DB 스키마(768)와 일치하는지 검증."""
    provider = None
    if settings.gemini_api_key:
        provider = GeminiEmbedding(settings.gemini_api_key)
    elif settings.openai_api_key:
        provider = OpenAIEmbedding(settings.openai_api_key)

    if provider and provider.dimensions != 768:
        raise ValueError(f"EmbeddingProvider dimensions={provider.dimensions}, expected 768")
    return provider
```

### 4.3 값 객체

```python
# domain/memory/models.py
@dataclass(frozen=True)
class SearchQuery:
    user_id: str
    query: str
    limit: int = 5

@dataclass(frozen=True)
class SearchResult:
    messages: list[ChatMessage]
    scores: list[float]  # cosine distance (낮을수록 유사)
```

### 4.4 Repository 변경 — score 반환

```python
# domain/chat/repository.py — MessageRepository.search_similar 확장
async def search_similar(
    self, user_id: uuid.UUID, embedding: list[float], limit: int = 5
) -> list[tuple[Message, float]]:
    """(Message, cosine_distance) 튜플 리스트 반환"""
```

### 4.5 MemoryService 변경

```python
class MemoryService:
    def __init__(self, session: AsyncSession, embedding_provider: EmbeddingProvider | None = None):
        self.embedding_provider = embedding_provider
        # ...

    async def _get_embedding(self, text: str) -> list[float] | None:
        if self.embedding_provider is None:
            return None
        return await self.embedding_provider.embed(text)
```

## 5. 사용자 프로필 학습

### 5.1 명시적 선호도

```
GET  /api/users/me/preferences → PreferencesResponse
PUT  /api/users/me/preferences → PreferencesResponse (learned 필드는 무시)
```

`users.preferences` JSONB 컬럼 활용. 새 테이블 없음.

```python
# Pydantic 검증 스키마
class PreferencesUpdate(BaseModel):
    language: Literal["ko", "en", "ja"] = "ko"
    response_style: Literal["concise", "detailed", "casual"] = "concise"
    interests: list[str] = []  # 최대 20개, 각 최대 50자
    timezone: str = "Asia/Seoul"

class PreferencesResponse(PreferencesUpdate):
    learned: dict = {}  # 서버 전용, PUT 시 무시
```

### 5.2 암묵적 학습

```python
# domain/identity/profile.py
class UserProfileService:
    def __init__(self, session: AsyncSession, llm: LLMProvider):
        self.user_repo = UserRepository(session)
        self.llm = llm

    async def extract_from_conversation(
        self, user_id: str, messages: list[ChatMessage]
    ) -> dict | None:
        """LLM에 대화를 분석시켜 선호도 추출.
        반환: { topics_discussed: [...], communication_pattern: "..." }"""
```

### 5.3 학습 트리거

- **ChatService.process_message()** 내에서 **사용자 턴 카운트** 확인 (role="user" 메시지 수)
- 10번째 사용자 턴마다 트리거
- **FastAPI BackgroundTasks로 비동기 실행** (사용자 응답 지연 없음)
- 동시 실행 방지: `preferences.learned.updated_at` 확인, 마지막 업데이트로부터 1시간 이내면 스킵

### 5.4 learned 병합 전략

| 필드 | 전략 | 설명 |
|------|------|------|
| topics_discussed | union (합집합) | 기존 + 새 토픽, 최대 50개 유지 |
| communication_pattern | replace | 최신 분석 결과로 덮어쓰기 |
| updated_at | replace | 마지막 학습 시점 |

### 5.5 선호도 활용

ChatService의 system prompt에 **허용된 필드만** 추출하여 주입:

```python
safe_prefs = {
    "language": preferences.get("language", "ko"),
    "response_style": preferences.get("response_style", "concise"),
    "interests": preferences.get("interests", [])[:10],
}
system_prompt = SYSTEM_PROMPT + f"\n\nUser preferences: {json.dumps(safe_prefs)}"
```

raw JSONB를 직접 주입하지 않음 (프롬프트 인젝션 방어).

## 6. 테스트 계획

| 테스트 | 파일 | 검증 항목 |
|--------|------|-----------|
| 메시지 페이지네이션 | test_messages_api.py | 커서 기반 로드, has_more, ASC 정렬, 소유권 검증(404) |
| 빈/잘못된 대화 | test_messages_api.py | 빈 대화(빈 배열), 존재하지 않는 ID(404), 타인 대화(404) |
| 벡터 검색 | test_memory.py | 임베딩 저장/검색, mock provider, score 반환 |
| EmbeddingProvider | test_embedding.py | Gemini mock (to_thread), OpenAI mock, fallback(None) |
| Provider 차원 검증 | test_embedding.py | dimensions != 768 시 ValueError |
| 임베딩 전체 실패 | test_memory.py | provider.embed() 예외 시 graceful degradation (None) |
| 프로필 CRUD | test_profile.py | GET/PUT preferences, Pydantic 검증(422) |
| learned 필드 보호 | test_profile.py | PUT 시 learned 필드 무시 확인 |
| 프로필 자동 학습 | test_profile.py | LLM mock, 병합 전략 검증, 동시성 스킵 |
| E2E 대화 지속성 | test_e2e.py | 대화 생성 → 메시지 → 히스토리 로드 |

## 7. 마이그레이션 계획

1. `alembic revision -m "vector_768"` (수동 작성 — autogenerate는 인덱스 순서 보장 안 됨)
2. 마이그레이션 내용:
   - DROP INDEX idx_messages_embedding
   - ALTER messages.embedding TYPE vector(768)
   - CREATE INDEX idx_messages_embedding USING hnsw
3. 기존 데이터 영향 없음 (embedding 컬럼 모두 NULL)
4. `import pgvector.sqlalchemy.vector` 수동 추가 확인

## 8. 프론트엔드 변경

| 컴포넌트 | 변경 |
|----------|------|
| ChatWindow.tsx | 대화 선택 시 히스토리 REST 로드 + 무한 스크롤 (IntersectionObserver) |
| ConversationList.tsx | 변경 없음 |
| ProfileSettings.tsx (NEW) | 사용자 선호도 설정 UI (language, style, interests) |

## 9. 성공 기준

| 항목 | 기준 |
|------|------|
| 대화 지속성 | 새로고침 후 이전 메시지 20개 표시 |
| 무한 스크롤 | 위로 스크롤 시 이전 메시지 추가 로드 |
| 소유권 검증 | 타인의 대화 접근 시 404 |
| 벡터 검색 | 유사 대화 검색 결과가 응답 품질에 반영 |
| 임베딩 graceful | API 키 없어도 대화 기능 정상 동작 |
| 프로필 명시적 | GET/PUT preferences 동작 + 입력 검증 |
| 프로필 자동 | 10턴 후 learned 필드 업데이트 (백그라운드) |
| 테스트 | 신규 테스트 전부 통과 |

# Sub-4: Knowledge Base — 문서 수집 + 벡터 검색 + RAG

## 1. 개요

사용자가 외부 문서(텍스트, URL)를 등록하면 청킹 → 임베딩 → pgvector 저장 후, 채팅 시 RAG로 관련 지식을 검색하여 LLM 컨텍스트에 주입한다.

**범위:**
- 문서 CRUD (텍스트 직접 입력, URL 스크래핑)
- 청킹 (고정 크기 + 오버랩)
- 임베딩 (기존 EmbeddingProvider 재사용)
- pgvector 벡터 검색 (코사인 유사도)
- 채팅 시 RAG 통합 (ChatService에 지식 검색 추가)
- 채팅 인텐트 (knowledge.add, knowledge.search)
- 프론트엔드 /knowledge 관리 페이지

**범위 외:** 파일 업로드 (PDF, DOCX), 웹 크롤링 (단일 URL만), 지식 그래프

---

## 2. 데이터 모델

### 2.1 documents 테이블

```python
class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(nullable=False)
    source_type: Mapped[str] = mapped_column(nullable=False)  # "text", "url"
    source_url: Mapped[str | None] = mapped_column(nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # 원본 텍스트
    chunk_count: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(default="processing")  # "processing", "ready", "error"
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("idx_documents_user", "user_id", "status"),
        CheckConstraint("source_type IN ('text','url')", name="ck_doc_source_type"),
        CheckConstraint("status IN ('processing','ready','error')", name="ck_doc_status"),
    )
```

### 2.2 document_chunks 테이블

```python
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("idx_chunks_document", "document_id", "chunk_index"),
        Index("idx_chunks_user", "user_id"),
        Index(
            "idx_chunks_embedding", "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
```

---

## 3. KnowledgeService

### 3.1 문서 추가

```python
async def add_document(self, user_id, title, content, source_type="text", source_url=None) -> Document:
    # 1. Document 저장 (status="processing")
    # 2. 텍스트 청킹 (500자 단위, 100자 오버랩)
    # 3. 각 청크 임베딩 생성
    # 4. DocumentChunk 저장
    # 5. Document status → "ready", chunk_count 업데이트
    # 6. 이벤트 발행: knowledge.document_ingested
```

### 3.2 URL 스크래핑

```python
async def add_from_url(self, user_id, title, url) -> Document:
    # 1. httpx로 URL 가져오기
    # 2. HTML → 텍스트 변환 (BeautifulSoup 또는 간단한 태그 제거)
    # 3. add_document 호출
```

**간단한 HTML 텍스트 추출** (BeautifulSoup 대신 최소 구현):
```python
import re
def html_to_text(html: str) -> str:
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text
```

### 3.3 청킹 전략

```python
def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks
```

### 3.4 벡터 검색

```python
async def search(self, user_id, query, limit=5) -> list[dict]:
    # 1. 쿼리 임베딩 생성
    # 2. pgvector 코사인 유사도 검색 (user_id 필터)
    # 3. 결과 반환: [{chunk_content, document_title, similarity}]
```

### 3.5 채팅 RAG 통합

ChatService.process_message에서 기존 `memory.search_similar` 외에 `knowledge.search`도 호출:

```python
# 지식 검색 (RAG)
if self.knowledge_service:
    knowledge_results = await self.knowledge_service.search(uuid.UUID(user_id), content)
    if knowledge_results:
        knowledge_ctx = "\n".join(f"[Knowledge] {r['content']}" for r in knowledge_results[:3])
        personalized_prompt += f"\n\n{knowledge_ctx}"
```

---

## 4. API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `GET /api/knowledge` | list | 문서 목록 |
| `POST /api/knowledge` | add_document | 텍스트 문서 추가 |
| `POST /api/knowledge/url` | add_from_url | URL 문서 추가 |
| `GET /api/knowledge/{id}` | get | 문서 상세 |
| `DELETE /api/knowledge/{id}` | delete | 문서 삭제 (청크 cascade) |
| `POST /api/knowledge/search` | search | 벡터 검색 |

---

## 5. 채팅 인텐트

| 인텐트 | 실행 방식 | 설명 |
|--------|----------|------|
| `knowledge.add` | 확인 | "이 내용 기억해: ..." → 문서 추가 |
| `knowledge.search` | 자동 | "~에 대해 알려줘" → 지식 검색 |

---

## 6. 파일 구조

### Backend — Create
| 파일 | 책임 |
|------|------|
| `domain/knowledge/__init__.py` | 패키지 |
| `domain/knowledge/service.py` | KnowledgeService (CRUD, 청킹, 검색, URL 스크래핑) |
| `domain/knowledge/repository.py` | DocumentRepository, DocumentChunkRepository |
| `api/knowledge.py` | REST API 라우터 |
| `tests/test_knowledge.py` | 8개 테스트 |

### Backend — Modify
| 파일 | 변경 |
|------|------|
| `models/models.py` | +Document, +DocumentChunk ORM |
| `domain/chat/service.py` | +knowledge_service DI, RAG 검색 주입 |
| `domain/integration/service.py` | +knowledge.* 인텐트 |
| `main.py` | +knowledge_router 등록 |
| Alembic migration | +documents, +document_chunks 테이블 |

### Frontend — Create
| 파일 | 책임 |
|------|------|
| `app/knowledge/page.tsx` | 지식 관리 페이지 |
| `components/KnowledgeCard.tsx` | 문서 카드 |
| `components/AddKnowledgeModal.tsx` | 추가 모달 (텍스트/URL) |
| `hooks/useKnowledge.ts` | API 훅 |

### Frontend — Modify
| 파일 | 변경 |
|------|------|
| `lib/types.ts` | +Document 타입 |
| `components/common/NavBar.tsx` | +지식 탭 |
| `middleware.ts` | +/knowledge 보호 |

---

## 7. 테스트

| # | 테스트 | 내용 |
|---|--------|------|
| 1 | test_chunk_text | 500자 청킹 + 오버랩 검증 |
| 2 | test_add_document_text | 텍스트 문서 추가 + 청크 생성 |
| 3 | test_add_document_creates_chunks | 청크 수 = ceil(len/400) |
| 4 | test_search_returns_relevant | 관련 청크 검색 확인 |
| 5 | test_delete_cascades_chunks | 문서 삭제 시 청크도 삭제 |
| 6 | test_list_documents | 사용자별 문서 목록 |
| 7 | test_html_to_text | HTML 태그 제거 |
| 8 | test_document_status_flow | processing → ready 상태 전환 |

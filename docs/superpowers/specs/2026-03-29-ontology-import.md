# Ontology Import — 중복 방지 + 사용자 통제 + 변경 감지

## 1. 개요

기존 데이터(MD 파일, DB Goals/Habits/Memories)를 온톨로지에 안전하게 임포트한다. SHA256 해시로 변경 감지, 임베딩 유사도로 중복 방지, 모든 결과는 draft 상태로 사용자 리뷰 필수.

**핵심 원칙:**
1. 중복 방지 — SHA256 해시 + 임베딩 유사도 이중 검사
2. 사용자 통제 — 모든 결과는 draft, 사용자가 승인/거부/수정
3. 변경 감지 — 파일 해시 비교, 변경 없으면 SKIP

---

## 2. 데이터 모델

```python
class ImportSource(Base):
    __tablename__ = "ontology_import_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_type: Mapped[str] = mapped_column(nullable=False)
    source_path: Mapped[str] = mapped_column(nullable=False)
    file_hash: Mapped[str | None] = mapped_column(nullable=True)
    node_count: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(nullable=False, default="imported")
    last_imported_at: Mapped[datetime] = mapped_column(server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("idx_import_sources_user", "user_id"),
        UniqueConstraint("user_id", "source_path", name="uq_import_sources_user_path"),
        CheckConstraint(
            "source_type IN ('markdown','db_goals','db_habits','db_memories','db_messages')",
            name="ck_import_sources_type",
        ),
        CheckConstraint(
            "status IN ('imported','outdated','deleted')",
            name="ck_import_sources_status",
        ),
    )
```

---

## 3. ImportScanner

파일 시스템 스캔 + 변경 감지:

```python
class ImportScanner:
    async def scan_directory(self, user_id, directory, pattern="**/*.md") -> ScanResult:
        # 1. glob으로 파일 목록 수집
        # 2. 각 파일 SHA256 해시 계산
        # 3. ImportSource DB와 비교
        #    - DB에 없음 → "new"
        #    - DB에 있고 해시 다름 → "modified"
        #    - DB에 있고 해시 같음 → "unchanged"
        # 4. ScanResult 반환

    async def scan_db_source(self, user_id, source_type) -> ScanResult:
        # DB 소스 (goals/habits/memories)
        # 1. 해당 테이블 row count 조회
        # 2. ImportSource에서 기존 기록 확인
        # 3. 이미 임포트한 row count와 비교
```

---

## 4. ImportProcessor

선택한 소스를 처리하여 draft 노드 생성:

```python
class ImportProcessor:
    def __init__(self, ontology_service, pipeline, extractor=None):
        ...

    async def process_markdown(self, user_id, file_path) -> ImportResult:
        # 1. 파일 읽기
        # 2. SemanticExtractor로 노드/엣지 추출 (LLM)
        #    - LLM 없으면: 제목/헤딩을 Topic 노드로 변환
        # 3. PurificationPipeline 실행 (force_draft=True)
        # 4. ImportSource 기록 업데이트

    async def process_db_goals(self, user_id) -> ImportResult:
        # 1. Goal 테이블에서 아직 온톨로지에 없는 것 조회
        #    (find_by_source("goal", goal_id) == None인 것)
        # 2. NodeCandidate로 변환 (confidence=1.0, source_type="goal")
        # 3. PurificationPipeline 실행 (force_draft=True)

    async def process_db_habits(self, user_id) -> ImportResult:
        # Habit → NodeCandidate, goal_id 있으면 supports 엣지 추가

    async def process_db_memories(self, user_id) -> ImportResult:
        # UserMemory → NodeCandidate (category별 sub_type)
```

**force_draft**: Pipeline의 confidence gate에서 결과를 강제로 draft로 설정. auto-verify 비활성화.

---

## 5. API

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| POST /api/ontology/import/scan | POST | 경로 스캔 → 파일 목록 + 변경 상태 |
| POST /api/ontology/import/process | POST | 선택한 소스 처리 → draft 생성 |
| GET /api/ontology/import/sources | GET | 임포트 소스 이력 |
| DELETE /api/ontology/import/sources/{id} | DELETE | 소스 + 관련 노드 정리 |
| POST /api/ontology/import/db | POST | DB 소스 처리 (type 지정) |

### Request/Response

```python
class ScanRequest(BaseModel):
    directory: str
    pattern: str = "**/*.md"

class ScanFileItem(BaseModel):
    path: str
    status: str  # "new" | "modified" | "unchanged"
    size: int
    hash: str

class ScanResponse(BaseModel):
    files: list[ScanFileItem]
    summary: dict  # {"new": 5, "modified": 2, "unchanged": 7}

class ProcessRequest(BaseModel):
    sources: list[dict]  # [{"type": "markdown", "path": "..."}, ...]

class ProcessResponse(BaseModel):
    processed: int
    draft_count: int
    skipped: int
    errors: list[str]

class DBImportRequest(BaseModel):
    source_types: list[str]  # ["db_goals", "db_habits", "db_memories"]

class ImportSourceResponse(BaseModel):
    id: str
    source_type: str
    source_path: str
    node_count: int
    status: str
    last_imported_at: str
```

---

## 6. PurificationPipeline 수정

`force_draft` 파라미터 추가:

```python
async def process(self, extraction, user_id, force_draft=False) -> PurificationResult:
    # ... 기존 로직 ...
    # Stage 4: Confidence Gate
    for candidate in extraction.node_candidates:
        if force_draft:
            candidate.status = "draft"  # 강제 draft
        elif candidate.confidence >= threshold:
            candidate.status = "verified"
        ...
```

---

## 7. 프론트엔드

### /ontology/import 페이지

```
ImportPage
├── NavBar
├── 탭: Files | Database
│
├── [Files 탭]
│   ├── 경로 입력 (기본: docs/) + "스캔" 버튼
│   ├── 결과 테이블
│   │   ├── 체크박스 | 파일명 | 상태 뱃지(new/modified/unchanged) | 크기
│   │   └── "Select New/Modified" 버튼 (unchanged 자동 제외)
│   └── "임포트" 버튼 → 처리 → 결과 표시
│
├── [Database 탭]
│   ├── 토글: Goals / Habits / Memories
│   ├── 각 소스별 현황 (DB 개수 vs 온톨로지 개수)
│   └── "가져오기" 버튼
│
├── Import History
│   ├── 소스 목록 (타입, 경로, 노드 수, 마지막 임포트)
│   └── 삭제 버튼 (소스 + 관련 노드 정리)
│
└── → 처리 완료 후 /ontology Drafts 탭에서 리뷰 안내
```

---

## 8. 파일 구조

### Backend — Create
| 파일 | 책임 |
|------|------|
| domain/ontology/importer.py | ImportScanner + ImportProcessor |
| api/ontology_import.py | REST API |
| tests/test_ontology_import.py | 테스트 |

### Backend — Modify
| 파일 | 변경 |
|------|------|
| models/models.py | +ImportSource |
| domain/ontology/repository.py | +ImportSourceRepository |
| domain/ontology/pipeline.py | +force_draft 파라미터 |
| main.py | +import 라우터 |
| Alembic migration | +ontology_import_sources 테이블 |

### Frontend — Create
| 파일 | 책임 |
|------|------|
| app/ontology/import/page.tsx | 임포트 페이지 |
| components/ontology/ImportScanner.tsx | 파일 스캔 UI |
| components/ontology/DBImport.tsx | DB 임포트 UI |
| hooks/useOntologyImport.ts | API 훅 |

### Frontend — Modify
| 파일 | 변경 |
|------|------|
| app/ontology/page.tsx | +Import 버튼 |
| lib/types.ts | +ImportSource, ScanResult 타입 |

---

## 9. 테스트

| # | 테스트 | 내용 |
|---|---|---|
| 1 | test_scan_new_files | 신규 파일 감지 |
| 2 | test_scan_unchanged | 해시 동일 → unchanged |
| 3 | test_scan_modified | 해시 변경 → modified |
| 4 | test_process_markdown_draft | MD 처리 → 전부 draft |
| 5 | test_process_db_goals | 기존 Goal → draft 노드 |
| 6 | test_process_skip_existing | 이미 온톨로지에 있는 Goal SKIP |
| 7 | test_delete_source_cascades | 소스 삭제 → 관련 노드 archive |
| 8 | test_force_draft_pipeline | force_draft=True → verified 안 됨 |

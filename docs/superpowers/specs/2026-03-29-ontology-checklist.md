# Ontology System Functional Checklist

> 서버 실행 후 브라우저/curl로 검증하는 기능 체크리스트

## 사전 조건

```bash
# Backend
cd backend && source .venv/Scripts/activate
export $(grep -v '^#' .env | xargs)
uvicorn alma.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

- [ ] Backend: `GET /api/health` → `{"status": "ok"}`
- [ ] Frontend: `http://localhost:3000` 접근 가능
- [ ] 로그인 완료 (JWT 토큰 획득)

---

## Phase A: 온톨로지 코어

### A1. 시스템 시드 확인
- [ ] `GET /api/ontology/types` → 13개 ObjectTypes + 10개 LinkTypes 반환
  - ObjectTypes: Person, Project, Organization, Goal, Habit, Task, Topic, Skill, Value, Metric, Emotion, Event, Period
  - LinkTypes: supports, blocks, causes, part_of, related_to, depends_on, measured_by, belongs_to, precedes, contradicts

### A2. Object CRUD
- [ ] `POST /api/ontology/types/objects` → 커스텀 ObjectType 생성
  ```json
  {"name": "Book", "parent_category": "Entity", "description": "읽은 책"}
  ```
- [ ] `GET /api/ontology/objects` → 빈 목록 (아직 노드 없음)
- [ ] Goal 생성 (기존 API) → `POST /api/goals` → 온톨로지에 자동 연동 확인
  ```json
  {"title": "Python 마스터하기", "category": "learning"}
  ```
- [ ] `GET /api/ontology/objects` → Goal 노드가 자동 생성되었는지 확인
  - source_type: "goal"
  - confidence: 1.0
  - status: "verified" (시스템 생성이므로)

### A3. 어댑터 연동
- [ ] Habit 생성 → `POST /api/habits` → 온톨로지 Habit 노드 자동 생성
- [ ] Goal 삭제 → `DELETE /api/goals/{id}` → 온톨로지 노드 status → "archived"

### A4. 수동 의미 추출 (LLM 필요)
- [ ] `POST /api/ontology/extract/preview`
  ```json
  {"text": "나는 매일 아침 6시에 일어나서 30분 운동을 한다. Python 공부도 1시간씩 하고 있다."}
  ```
  → 노드/엣지 추출 결과 반환 (LLM 키 설정 필요)

### A5. 그래프 데이터
- [ ] `GET /api/ontology/graph` → nodes + edges 반환
- [ ] `GET /api/ontology/stats` → total_nodes, total_edges, draft_count 등

### A6. 노드 관리
- [ ] `POST /api/ontology/objects/{id}/verify` → draft → verified
- [ ] `DELETE /api/ontology/objects/{id}` → archived (soft delete)
- [ ] `GET /api/ontology/objects/{id}/neighbors?depth=2` → 이웃 노드 반환

---

## Phase B: 그래프 시각화

### B1. 페이지 접근
- [ ] `http://localhost:3000/ontology` → 목록 뷰 페이지 로드
- [ ] "Graph View" 버튼 클릭 → `/ontology/graph` 이동

### B2. 그래프 렌더링
- [ ] ForceGraph2D 캔버스 렌더링 (노드가 있으면 그래프 표시)
- [ ] 노드 색상: 카테고리별 구분 (Entity=파랑, Action=초록, Concept=보라, Attribute=주황, Temporal=청록)
- [ ] 노드 크기: 연결 수에 비례

### B3. 인터랙션
- [ ] 마우스 휠 줌 인/아웃
- [ ] 드래그로 캔버스 이동
- [ ] 노드 클릭 → NodeDetailPanel 사이드패널 열림
- [ ] 배경 클릭 → 패널 닫힘
- [ ] 포커스 모드: 클릭 노드 + 이웃 강조, 나머지 페이드

### B4. 필터/검색
- [ ] 카테고리 토글 버튼 클릭 → 해당 카테고리 노드 숨김/표시
- [ ] 신뢰도 슬라이더 조정 → 낮은 confidence 노드 숨김
- [ ] 검색 입력 → 매칭 노드 하이라이트
- [ ] "List View" 버튼 → `/ontology` 복귀

---

## Phase C: 추론 엔진

### C1. 인사이트 페이지
- [ ] `/ontology/insights` 페이지 접근
- [ ] 요약 카드 표시 (전체/신규 인사이트 수)

### C2. 분석 실행
- [ ] "분석 실행" 버튼 클릭 → `POST /api/ontology/insights/generate`
  - 노드가 충분하면 (3개+) 분석 결과 생성
  - LLM 키 있으면 자연어 인사이트 생성
  - LLM 키 없으면 raw analysis만 반환 (llm_used: false)

### C3. 인사이트 목록
- [ ] InsightCard 표시 (타입 배지, 제목, 설명, 행동 제안)
- [ ] 상태 변경: 읽음/실행 완료/무시 버튼 작동
- [ ] 타입 필터 토글 작동

### C4. API 직접 확인
- [ ] `GET /api/ontology/insights` → 인사이트 목록
- [ ] `GET /api/ontology/insights/summary` → 통계
- [ ] `PATCH /api/ontology/insights/{id}` → `{"status": "read"}` 상태 변경

---

## Phase D: 에이전트 자동화

### D1. 자동화 페이지
- [ ] `/ontology/automations` 페이지 접근
- [ ] 규칙 목록 표시 (비어있으면 빈 상태)

### D2. 규칙 생성
- [ ] "규칙 추가" 폼에서:
  - 이름: "고립 노드 알림"
  - 인사이트 타입: "isolated" 선택
  - 행동 타입: "suggest" 선택
  - 생성 클릭 → 규칙 카드 나타남

### D3. 규칙 관리
- [ ] Enable/Disable 토글 작동
- [ ] 삭제 버튼 작동
- [ ] `GET /api/ontology/automations` → 규칙 목록

### D4. 자동화 실행
- [ ] `POST /api/ontology/automations/execute` → `{"insight_id": "..."}`
  - 매칭 규칙이 있으면 ActionPlanner → ActionExecutor 실행
- [ ] `GET /api/ontology/automations/logs` → 실행 이력

---

## 통합 시나리오

### 시나리오 1: Goal → Ontology → Graph
1. [ ] Goal "건강해지기" 생성
2. [ ] Habit "매일 운동" 생성 (goal_id 연결)
3. [ ] `/ontology` → "건강해지기" + "매일 운동" 노드 확인
4. [ ] `/ontology/graph` → 두 노드 + "supports" 관계 시각화

### 시나리오 2: Insight → Automation
1. [ ] 여러 Goal/Habit 생성하여 노드 5개+ 만들기
2. [ ] `/ontology/insights` → "분석 실행"
3. [ ] 인사이트 확인 (허브 노드, 고립 노드 등)
4. [ ] `/ontology/automations` → "isolated" → "suggest" 규칙 생성
5. [ ] 인사이트 기반 자동화 실행 → 결과 확인

---

## 알려진 제한사항

- LLM API 키 미설정 시: 의미 추출, 인사이트 LLM 해석, ActionPlanner가 기본/fallback 모드로 동작
- Chat/Knowledge 어댑터: LLM 라우터가 초기화되어야 작동 (API 키 필요)
- 그래프 시각화: 노드 0개면 빈 캔버스 (데이터 생성 후 확인)
- PostgreSQL 14+: CYCLE 절 사용 (get_neighbors 쿼리)

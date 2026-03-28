# Phase C: Inference Engine — 그래프 분석 + LLM 패턴 해석 + 인사이트 생성

## 1. 개요

온톨로지 그래프에서 구조적 패턴을 분석하고, LLM이 패턴을 자연어 인사이트로 해석하여 사용자에게 행동 가능한 제안을 제공한다.

**접근법:** 하이브리드 (그래프 알고리즘 + LLM 해석)
- GraphAnalyzer: networkx로 구조 분석 (허브, 고립, 경로, 상충)
- InsightGenerator: LLM이 분석 결과를 자연어 인사이트로 변환
- OntologyInsight: 인사이트 저장 + 상태 관리

**범위:** 그래프 구조 분석, LLM 인사이트 생성, 인사이트 API, 인사이트 페이지
**범위 외:** 시계열 예측 모델, 자동 실행 (Phase D), 실시간 분석

---

## 2. 아키텍처

```
[Manual Trigger: POST /api/ontology/insights/generate]
          |
          v
[GraphAnalyzer] ← OntologyService.get_full_graph()
  ├── hub_nodes()           → degree centrality 상위 노드
  ├── isolated_nodes()      → degree 0 또는 1인 노드
  ├── strong_paths()        → 높은 confidence 경로
  ├── conflicts()           → "contradicts" 관계 탐색
  ├── opportunities()       → 같은 카테고리 미연결 노드 쌍
  └── growth_trends()       → 시간별 노드 생성 추세
          |
          v
[InsightGenerator] ← 분석 결과 + LLMRouter
  ├── 분석 결과를 구조화된 프롬프트로 변환
  ├── LLM 호출 → 한국어 인사이트 생성
  └── 파싱 + 저장
          |
          v
[ontology_insights 테이블] → REST API → Frontend
```

---

## 3. 데이터 모델

### ontology_insights

```python
class OntologyInsight(Base):
    __tablename__ = "ontology_insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    insight_type: Mapped[str] = mapped_column(nullable=False)
    title: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    confidence: Mapped[float] = mapped_column(default=0.5)
    actionable: Mapped[bool] = mapped_column(default=False)
    action_suggestion: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(nullable=False, default="new")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("idx_insights_user_status", "user_id", "status"),
        Index("idx_insights_user_type", "user_id", "insight_type"),
        CheckConstraint(
            "insight_type IN ('hub_node','isolated','strong_path','conflict','opportunity','trend')",
            name="ck_insights_type",
        ),
        CheckConstraint(
            "status IN ('new','read','acted','dismissed')",
            name="ck_insights_status",
        ),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_insights_confidence"),
    )
```

---

## 4. GraphAnalyzer

```python
import networkx as nx
from alma.domain.ontology.models import GraphData

class GraphAnalyzer:
    def __init__(self, graph_data: GraphData):
        self.G = nx.DiGraph()
        for node in graph_data.nodes:
            self.G.add_node(node["id"], **node)
        for edge in graph_data.edges:
            self.G.add_edge(edge["source"], edge["target"], **edge)

    def hub_nodes(self, top_n: int = 5) -> list[dict]:
        """Degree centrality 상위 노드"""
        centrality = nx.degree_centrality(self.G)
        sorted_nodes = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:top_n]
        return [
            {"node_id": nid, "name": self.G.nodes[nid].get("name"), "centrality": score,
             "degree": self.G.degree(nid)}
            for nid, score in sorted_nodes if score > 0
        ]

    def isolated_nodes(self) -> list[dict]:
        """Degree 0 또는 1인 노드"""
        return [
            {"node_id": nid, "name": self.G.nodes[nid].get("name"),
             "category": self.G.nodes[nid].get("parent_category", "")}
            for nid in self.G.nodes
            if self.G.degree(nid) <= 1
        ]

    def strong_paths(self, min_length: int = 2, top_n: int = 5) -> list[dict]:
        """높은 confidence 경로 (edge weight 기반)"""
        paths = []
        for source in self.G.nodes:
            for target in self.G.nodes:
                if source == target:
                    continue
                try:
                    path = nx.shortest_path(self.G, source, target)
                    if len(path) >= min_length + 1:
                        avg_conf = sum(
                            self.G.edges[path[i], path[i+1]].get("confidence", 0.5)
                            for i in range(len(path)-1)
                        ) / (len(path)-1)
                        if avg_conf > 0.7:
                            paths.append({
                                "path": [self.G.nodes[n].get("name") for n in path],
                                "node_ids": path,
                                "avg_confidence": avg_conf,
                                "length": len(path) - 1,
                            })
                except nx.NetworkXNoPath:
                    continue
        return sorted(paths, key=lambda x: x["avg_confidence"], reverse=True)[:top_n]

    def conflicts(self) -> list[dict]:
        """contradicts 관계 탐색"""
        return [
            {
                "source": self.G.nodes[u].get("name"),
                "target": self.G.nodes[v].get("name"),
                "source_id": u, "target_id": v,
                "relation": data.get("relation"),
            }
            for u, v, data in self.G.edges(data=True)
            if data.get("relation") == "contradicts"
        ]

    def opportunities(self, max_suggestions: int = 5) -> list[dict]:
        """같은 카테고리 미연결 노드 쌍"""
        suggestions = []
        nodes_by_cat = {}
        for nid, data in self.G.nodes(data=True):
            cat = data.get("parent_category", "")
            nodes_by_cat.setdefault(cat, []).append(nid)

        for cat, node_ids in nodes_by_cat.items():
            for i, n1 in enumerate(node_ids):
                for n2 in node_ids[i+1:]:
                    if not self.G.has_edge(n1, n2) and not self.G.has_edge(n2, n1):
                        suggestions.append({
                            "node1": self.G.nodes[n1].get("name"),
                            "node2": self.G.nodes[n2].get("name"),
                            "node1_id": n1, "node2_id": n2,
                            "category": cat,
                        })
                        if len(suggestions) >= max_suggestions:
                            return suggestions
        return suggestions

    def growth_trends(self) -> dict:
        """시간별 노드 생성 추세 (created_at 기반)"""
        # 노드의 created_at은 GraphData에 없으므로 카테고리별 개수로 대체
        categories = {}
        for _, data in self.G.nodes(data=True):
            cat = data.get("parent_category", "unknown")
            categories[cat] = categories.get(cat, 0) + 1
        return {
            "total_nodes": self.G.number_of_nodes(),
            "total_edges": self.G.number_of_edges(),
            "by_category": categories,
            "density": nx.density(self.G) if self.G.number_of_nodes() > 1 else 0,
        }

    def full_analysis(self) -> dict:
        """모든 분석 실행"""
        return {
            "hub_nodes": self.hub_nodes(),
            "isolated_nodes": self.isolated_nodes(),
            "strong_paths": self.strong_paths(),
            "conflicts": self.conflicts(),
            "opportunities": self.opportunities(),
            "trends": self.growth_trends(),
        }
```

---

## 5. InsightGenerator

```python
INSIGHT_PROMPT = """
당신은 개인 성장 코치입니다. 사용자의 지식 그래프 분석 결과를 바탕으로 실행 가능한 인사이트를 제공합니다.

## 분석 결과
{analysis_json}

## 규칙
1. 각 의미있는 패턴에 대해 인사이트 생성
2. 한국어로 제목 + 설명 + 구체적 행동 제안
3. 데이터에 근거한 구체적 인사이트만 (모호한 조언 금지)
4. 인사이트가 없는 분석 항목은 건너뛰기
5. 최대 10개 인사이트

## 출력 (JSON)
{
  "insights": [
    {
      "type": "hub_node|isolated|strong_path|conflict|opportunity|trend",
      "title": "짧은 제목",
      "description": "왜 이것이 중요한지 2-3문장 설명",
      "action": "구체적 행동 제안 (null if not actionable)",
      "confidence": 0.0-1.0,
      "evidence_node_ids": ["uuid1", "uuid2"]
    }
  ]
}
"""

class InsightGenerator:
    def __init__(self, llm_router, insight_repo):
        self.llm_router = llm_router
        self.insight_repo = insight_repo

    async def generate(self, user_id, analysis: dict) -> list[OntologyInsight]:
        request = LLMRequest(
            messages=[ChatMessage(role="user", content=INSIGHT_PROMPT.format(
                analysis_json=json.dumps(analysis, ensure_ascii=False, default=str)
            ))],
            system_prompt="You are a personal growth coach analyzing knowledge graphs. Respond ONLY in JSON.",
            max_tokens=4096,
            temperature=0.5,
        )
        response = await self.llm_router.complete(request)
        parsed = json.loads(response.content)

        insights = []
        for item in parsed.get("insights", []):
            insight = await self.insight_repo.create(
                user_id=user_id,
                insight_type=item["type"],
                title=item["title"],
                description=item["description"],
                evidence={"node_ids": item.get("evidence_node_ids", [])},
                confidence=item.get("confidence", 0.5),
                actionable=item.get("action") is not None,
                action_suggestion=item.get("action"),
            )
            insights.append(insight)
        return insights
```

---

## 6. API Endpoints

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `POST /api/ontology/insights/generate` | POST | 분석 실행 + 인사이트 생성 |
| `GET /api/ontology/insights` | GET | 인사이트 목록 (필터: type, status) |
| `PATCH /api/ontology/insights/{id}` | PATCH | 상태 변경 (read/acted/dismissed) |
| `GET /api/ontology/insights/summary` | GET | 새 인사이트 수, 타입별 분포 |

### Response schemas

```python
class InsightResponse(BaseModel):
    id: str
    insight_type: str
    title: str
    description: str
    evidence: dict
    confidence: float
    actionable: bool
    action_suggestion: str | None
    status: str
    created_at: str

class InsightSummary(BaseModel):
    total: int
    new_count: int
    by_type: dict[str, int]
```

---

## 7. Frontend

### 신규 페이지: /ontology/insights

```
InsightsPage
├── InsightSummary — 새 인사이트 수, 타입별 아이콘 분포
├── "분석 실행" 버튼 → POST /generate (로딩 상태)
├── InsightList
│   └── InsightCard × N
│       ├── 타입 아이콘 + 배지
│       ├── 제목 + 설명
│       ├── 행동 제안 (있으면)
│       ├── 근거 노드 링크 → /ontology/graph
│       └── 상태 변경 버튼 (읽음/실행/무시)
```

### 파일 구조

| 파일 | 책임 |
|---|---|
| `app/ontology/insights/page.tsx` | 인사이트 페이지 |
| `components/ontology/InsightCard.tsx` | 인사이트 카드 컴포넌트 |
| `hooks/useOntologyInsights.ts` | API 훅 |

---

## 8. 파일 구조 (전체)

### Backend — Create

| 파일 | 책임 |
|---|---|
| `domain/ontology/analyzer.py` | GraphAnalyzer (networkx 기반) |
| `domain/ontology/insight_generator.py` | InsightGenerator (LLM 해석) |
| `api/ontology_insights.py` | REST API 라우터 |
| `tests/test_ontology_insights.py` | 테스트 |

### Backend — Modify

| 파일 | 변경 |
|---|---|
| `models/models.py` | +OntologyInsight 모델 |
| `domain/ontology/repository.py` | +InsightRepository |
| `main.py` | +insights 라우터 등록 |
| Alembic migration | +ontology_insights 테이블 |

### Frontend — Create

| 파일 | 책임 |
|---|---|
| `app/ontology/insights/page.tsx` | 인사이트 페이지 |
| `components/ontology/InsightCard.tsx` | 인사이트 카드 |
| `hooks/useOntologyInsights.ts` | API 훅 |

### Frontend — Modify

| 파일 | 변경 |
|---|---|
| `app/ontology/page.tsx` | +Insights 버튼 |
| `lib/types.ts` | +OntologyInsight 타입 |

### Dependencies

```bash
cd backend && pip install networkx
```

---

## 9. 테스트

| # | 테스트 | 내용 |
|---|---|---|
| 1 | test_graph_analyzer_hub_nodes | 높은 degree 노드 탐지 |
| 2 | test_graph_analyzer_isolated | 고립 노드 탐지 |
| 3 | test_graph_analyzer_conflicts | contradicts 관계 탐지 |
| 4 | test_graph_analyzer_empty_graph | 빈 그래프 처리 |
| 5 | test_insight_generator_parse | LLM 응답 파싱 (mock) |
| 6 | test_insight_crud | 생성/조회/상태변경 |
| 7 | test_generate_endpoint | POST /generate API |
| 8 | test_insights_list_filter | 타입/상태 필터 |

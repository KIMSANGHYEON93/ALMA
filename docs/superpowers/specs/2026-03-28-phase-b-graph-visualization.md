# Phase B: Graph Visualization — Obsidian 스타일 온톨로지 그래프 탐색

## 1. 개요

Phase A에서 구축한 온톨로지 데이터를 Obsidian 스타일의 인터랙티브 force-directed 그래프로 시각화한다. 사용자는 전체 조감도에서 지식 구조를 파악하고, 노드 클릭으로 포커스 모드에 진입하여 관계를 탐색할 수 있다.

**핵심 라이브러리:** react-force-graph-2d (Obsidian 3D 그래프 플러그인과 동일 기술)

**범위:**
- Force-directed 그래프 렌더링 (Canvas 기반)
- 전체 조감도 + 노드 포커스 모드
- 카테고리/신뢰도 필터 + 텍스트 검색
- 노드 상세 사이드 패널
- 기존 목록 뷰와 전환

**범위 외:** 3D 뷰, 그래프 편집, 그래프 분석 알고리즘

---

## 2. 아키텍처

```
GET /api/ontology/graph (기존 API)
        |
        v
useOntologyGraph() (새 훅)
  - API 호출 + ForceGraph 형식 변환
  - 클라이언트 사이드 필터링
        |
        v
+----------------------------------+
|     /ontology/graph (페이지)      |
|  +----------------------------+  |
|  | GraphToolbar               |  |
|  | (필터, 검색, 뷰 전환)      |  |
|  +----------------------------+  |
|  | GraphView (ForceGraph2D)   |  |
|  | - 노드: 카테고리 색상      |  |
|  | - 엣지: 관계 타입 표시     |  |
|  | - 클릭: 포커스 모드        |  |
|  +----------------------------+  |
|  | NodeDetailPanel (사이드)    |  |
|  | (속성, 관계, 액션)         |  |
|  +----------------------------+  |
+----------------------------------+
```

---

## 3. 컴포넌트 설계

### 3.1 GraphView

ForceGraph2D 래퍼 컴포넌트. 노드/엣지 렌더링 로직을 캡슐화.

```typescript
interface GraphViewProps {
  nodes: GraphNodeData[];
  links: GraphLinkData[];
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNodeData) => void;
  onBackgroundClick: () => void;
}
```

**노드 렌더링 (Canvas):**
- 색상: 카테고리별 (Entity=#3B82F6, Action=#22C55E, Concept=#A855F7, Attribute=#F97316, Temporal=#06B6D4)
- 크기: `Math.max(4, Math.min(20, 4 + edgeCount * 2))` — 연결 수 비례
- 라벨: 줌 레벨 > 1.5일 때 노드 이름 표시
- 테두리: confidence >= 0.8 실선, < 0.8 점선
- 호버 시: 이름 + 타입 + confidence 툴팁

**엣지 렌더링:**
- 색상: rgba(255, 255, 255, 0.15) 기본, 호버/선택 시 rgba(255, 255, 255, 0.6)
- 두께: `0.5 + confidence * 2`
- 방향: 화살표 (directionalArrowLength)
- 라벨: 줌 레벨 > 2.0일 때 관계 타입 표시

**포커스 모드:**
- 선택된 노드 + 1홉 이웃만 정상 렌더링
- 나머지 노드: opacity 0.1로 페이드
- 카메라: 선택 노드 중심으로 줌 (zoomToFit)

### 3.2 GraphToolbar

```typescript
interface GraphToolbarProps {
  categories: string[];
  activeCategories: Set<string>;
  onToggleCategory: (cat: string) => void;
  confidenceMin: number;
  onConfidenceChange: (val: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onResetView: () => void;
}
```

- 카테고리 토글 버튼 5개 (Entity/Action/Concept/Attribute/Temporal)
- 신뢰도 슬라이더 (0.0 ~ 1.0, 기본 0.5)
- 텍스트 검색 입력
- "Reset View" 버튼
- "List View" 링크 → /ontology

### 3.3 NodeDetailPanel

```typescript
interface NodeDetailPanelProps {
  node: GraphNodeData;
  neighbors: GraphNodeData[];
  edges: GraphLinkData[];
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
  onVerify: (nodeId: string) => void;
  onArchive: (nodeId: string) => void;
}
```

- 노드 이름, 타입, 카테고리
- properties 테이블
- 연결된 관계 목록 (클릭하면 해당 노드로 포커스 전환)
- Verify / Archive 액션 버튼
- 소스 정보 (source_type, created_at)

---

## 4. 데이터 변환

API 응답 → ForceGraph 형식:

```typescript
interface GraphNodeData {
  id: string;
  name: string;
  typeName: string;
  parentCategory: string;
  properties: Record<string, unknown>;
  confidence: number;
  status: string;
  // ForceGraph 전용
  val: number;        // 노드 크기 (연결 수 기반)
  color: string;      // 카테고리 색상
}

interface GraphLinkData {
  source: string;     // source node id
  target: string;     // target node id
  relation: string;
  confidence: number;
  properties: Record<string, unknown>;
}

function transformGraphData(graph: OntologyGraph): { nodes: GraphNodeData[], links: GraphLinkData[] } {
  const edgeCounts = new Map<string, number>();
  graph.edges.forEach(e => {
    edgeCounts.set(e.source_id, (edgeCounts.get(e.source_id) || 0) + 1);
    edgeCounts.set(e.target_id, (edgeCounts.get(e.target_id) || 0) + 1);
  });

  const nodes = graph.nodes.map(n => ({
    id: n.id,
    name: n.name,
    typeName: n.type_name,
    parentCategory: n.parent_category,
    properties: n.properties,
    confidence: n.confidence,
    status: n.status,
    val: Math.max(4, Math.min(20, 4 + (edgeCounts.get(n.id) || 0) * 2)),
    color: CATEGORY_COLORS[n.parent_category] || "#6B7280",
  }));

  const links = graph.edges.map(e => ({
    source: e.source_id,
    target: e.target_id,
    relation: e.relation,
    confidence: e.confidence,
    properties: e.properties,
  }));

  return { nodes, links };
}
```

---

## 5. 인터랙션 상세

### 전체 조감도 (기본)
- 마우스 휠: 줌 인/아웃
- 드래그 (배경): 캔버스 이동
- 드래그 (노드): 노드 위치 조정 (force 시뮬레이션 일시 정지)
- 노드 클릭: 포커스 모드 진입 + 사이드 패널 열기
- 배경 클릭: 선택 해제 + 사이드 패널 닫기

### 포커스 모드
- 선택 노드 중심 줌 (cooldownTicks + zoomToFit)
- 1홉 이웃만 강조 (나머지 fade)
- 이웃 노드 클릭: 포커스 대상 전환
- ESC: 전체 뷰 복귀

### 필터링 (클라이언트 사이드)
- 카테고리 토글: 비활성 카테고리 노드 + 관련 엣지 숨김
- 신뢰도 슬라이더: confidence < threshold 노드 숨김
- 텍스트 검색: 매칭 노드 하이라이트 (크기 1.5배 + 테두리 강조)

---

## 6. 파일 구조

### Create

| 파일 | 책임 |
|------|------|
| `app/ontology/graph/page.tsx` | 그래프 시각화 페이지 |
| `components/ontology/GraphView.tsx` | ForceGraph2D 래퍼 |
| `components/ontology/GraphToolbar.tsx` | 필터/검색/뷰전환 |
| `components/ontology/NodeDetailPanel.tsx` | 노드 상세 사이드패널 |
| `hooks/useOntologyGraph.ts` | 그래프 데이터 훅 |

### Modify

| 파일 | 변경 |
|------|------|
| `lib/types.ts` | +GraphNodeData, GraphLinkData 인터페이스 |
| `app/ontology/page.tsx` | +"Graph View" 버튼 추가 |

### Dependencies

```bash
npm install react-force-graph-2d
```

---

## 7. 기존 목록 뷰와의 전환

```
/ontology          → 목록 뷰 (기존: Stats + ObjectList + DraftReview)
                      + "Graph View" 버튼 → /ontology/graph
/ontology/graph    → 그래프 시각화 뷰
                      + "List View" 버튼 → /ontology
```

---

## 8. 성능 고려사항

- Canvas 렌더링: DOM 노드 없이 직접 Canvas에 그림 → 수천 노드 처리 가능
- 클라이언트 필터링: 전체 데이터를 한 번 로드 후 JS로 필터 → API 재호출 없음
- 줌 기반 라벨: 줌 레벨 낮을 때 라벨 숨김 → 렌더링 부하 감소
- ForceGraph의 warmupTicks: 초기 레이아웃을 빠르게 안정화

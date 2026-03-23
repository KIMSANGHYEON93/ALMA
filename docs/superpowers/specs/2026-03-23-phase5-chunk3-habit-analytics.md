# Phase 5 Chunk 3: 습관 통계 + LLM 코칭 인사이트

## 1. 개요

습관 로그 데이터를 집계하여 시각적 통계(히트맵, 트렌드, 완료율, 상관관계)를 제공하고, LLM 기반 코칭 인사이트를 생성한다.

**범위:**
- 백엔드 통계 집계 API (히트맵, 트렌드, 완료율, 상관관계)
- LLM 코칭 인사이트 (주간 자동 + 사용자 요청)
- 프론트엔드 통계 대시보드 (/habits/analytics)
- Chart.js (react-chartjs-2) + CSS 테이블 시각화

**범위 외:** Push notification, 실시간 업데이트, 외부 서비스 연동

---

## 2. 백엔드 통계 API — HabitAnalyticsService

### 2.1 서비스 구조

`domain/habit/analytics.py` — HabitAnalyticsService

의존성: `HabitRepository`, `HabitLogRepository`, `HabitService` (is_scheduled), `LLMProvider` (인사이트 생성 시)

### 2.2 엔드포인트

| 엔드포인트 | 메서드 | 응답 |
|-----------|--------|------|
| `GET /api/habits/analytics/heatmap?year=2026` | `get_heatmap` | `{dates: {"2026-01-05": 3, ...}}` |
| `GET /api/habits/analytics/trends?days=30` | `get_trends` | `{daily: [{date, total, completed, rate}], weekday: [{day, rate}]}` |
| `GET /api/habits/analytics/completion?days=30` | `get_completion` | `{habits: [{id, title, rate, total_days, completed_days}]}` |
| `GET /api/habits/analytics/correlations?days=30` | `get_correlations` | `{pairs: [{habit_a, habit_b, habit_a_title, habit_b_title, correlation}]}` |
| `POST /api/habits/analytics/insight` | `generate_insight` | `{id, content, generated_at}` |

**days 파라미터 유효성:** `Query(ge=7, le=365, default=30)` — 최소 7일, 최대 365일

### 2.3 히트맵 집계

```sql
SELECT log_date, COUNT(*) as count
FROM habit_logs
WHERE user_id = :uid AND completed = true
  AND log_date >= :year_start AND log_date <= :year_end
GROUP BY log_date
```

반환: `{dates: {"YYYY-MM-DD": count}}` — 날짜는 ISO 8601 문자열, 프론트엔드에서 색상 강도 매핑

### 2.4 트렌드 집계

최근 N일 (오늘 포함):

```python
async def get_trends(self, user_id: uuid.UUID, days: int = 30) -> dict:
    today = date.today()
    start = today - timedelta(days=days - 1)  # 오늘 포함 N일
    habits = await self.habit_repo.list_by_user(user_id, status="active")
    completed_logs = await self.log_repo.get_completed_dates_by_user(user_id, start, today)

    daily = []
    weekday_totals = [0] * 7
    weekday_completed = [0] * 7

    for i in range(days):
        d = start + timedelta(days=i)
        scheduled = [h for h in habits if HabitService.is_scheduled(h, d)]
        total = len(scheduled)
        completed = sum(1 for h in scheduled if h.id in completed_logs.get(d, set()))
        rate = round(completed / total * 100) if total > 0 else 0
        daily.append({"date": d.isoformat(), "total": total, "completed": completed, "rate": rate})

        weekday_totals[d.weekday()] += total
        weekday_completed[d.weekday()] += completed

    weekday = []
    day_names = ["월", "화", "수", "목", "금", "토", "일"]
    for i in range(7):
        rate = round(weekday_completed[i] / weekday_totals[i] * 100) if weekday_totals[i] > 0 else 0
        weekday.append({"day": day_names[i], "rate": rate})

    return {"daily": daily, "weekday": weekday}
```

### 2.5 습관별 완료율

각 활성 습관에 대해:
- `total_days`: 최근 N일 중 스케줄된 일수
- `completed_days`: 완료한 일수
- `rate`: 완료율 (%)

### 2.6 상관관계 분석

두 습관이 같은 날 동시에 완료되는 빈도를 피어슨 상관계수로 계산.

**핵심 규칙:**
- 두 습관 **모두 스케줄된 날짜의 교집합**에서만 비교 (스케줄 불일치 문제 방지)
- 교집합 날짜 5개 미만이면 상관계수 계산 안 함 (통계적 의미 부족)
- 표본 표준편차 사용 (n-1 분모)

```python
async def get_correlations(self, user_id: uuid.UUID, days: int = 30) -> dict:
    today = date.today()
    start = today - timedelta(days=days - 1)
    habits = await self.habit_repo.list_by_user(user_id, status="active")
    if len(habits) < 2:
        return {"pairs": []}

    date_range = [start + timedelta(days=i) for i in range(days)]

    # 습관별 완료 날짜 set
    completed_map: dict[uuid.UUID, set[date]] = {}
    for habit in habits:
        completed_map[habit.id] = await self.log_repo.get_completed_dates(habit.id, start, today)

    pairs = []
    habit_list = list(habits)
    for i in range(len(habit_list)):
        for j in range(i + 1, len(habit_list)):
            a, b = habit_list[i], habit_list[j]
            # 공통 스케줄 날짜만 사용
            common_dates = [
                d for d in date_range
                if HabitService.is_scheduled(a, d) and HabitService.is_scheduled(b, d)
            ]
            if len(common_dates) < 5:
                continue
            va = [1 if d in completed_map[a.id] else 0 for d in common_dates]
            vb = [1 if d in completed_map[b.id] else 0 for d in common_dates]
            corr = _pearson(va, vb)
            pairs.append({
                "habit_a": str(a.id),
                "habit_b": str(b.id),
                "habit_a_title": a.title,
                "habit_b_title": b.title,
                "correlation": round(corr, 2),
            })

    return {"pairs": sorted(pairs, key=lambda x: abs(x["correlation"]), reverse=True)}
```

**피어슨 상관계수 (표본 표준편차 n-1):**
```python
def _pearson(x: list[int], y: list[int]) -> float:
    n = len(x)
    if n < 2:
        return 0.0
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    numerator = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    var_x = sum((xi - mean_x) ** 2 for xi in x) / (n - 1)
    var_y = sum((yi - mean_y) ** 2 for yi in y) / (n - 1)
    std_x = var_x ** 0.5
    std_y = var_y ** 0.5
    if std_x == 0 or std_y == 0:
        return 0.0
    return numerator / ((n - 1) * std_x * std_y)
```

### 2.7 HabitLogRepository 추가 메서드

```python
async def get_completed_dates_by_user(
    self, user_id: uuid.UUID, start: date, end: date
) -> dict[date, set[uuid.UUID]]:
    """사용자의 날짜별 완료된 습관 ID set 반환.
    idx_habit_logs_user_date 인덱스 활용."""
    result = await self.session.execute(
        select(HabitLog.log_date, HabitLog.habit_id).where(
            HabitLog.user_id == user_id,
            HabitLog.completed.is_(True),
            HabitLog.log_date >= start,
            HabitLog.log_date <= end,
        )
    )
    data: dict[date, set[uuid.UUID]] = {}
    for row in result.all():
        data.setdefault(row[0], set()).add(row[1])
    return data

async def get_heatmap_data(
    self, user_id: uuid.UUID, year: int
) -> dict[str, int]:
    """연간 날짜별 완료 습관 수. 반환: {"YYYY-MM-DD": count}"""
    start = date(year, 1, 1)
    end = date(year, 12, 31)
    result = await self.session.execute(
        select(HabitLog.log_date, func.count()).where(
            HabitLog.user_id == user_id,
            HabitLog.completed.is_(True),
            HabitLog.log_date >= start,
            HabitLog.log_date <= end,
        ).group_by(HabitLog.log_date)
    )
    return {row[0].isoformat(): row[1] for row in result.all()}
```

---

## 3. LLM 코칭 인사이트

### 3.1 사용자 요청 인사이트

`POST /api/habits/analytics/insight` — `HabitAnalyticsService.generate_insight()`

**DB에 저장한다** — `Insight` 모델에 category=`habit_pattern`으로 저장. CHECK 제약 마이그레이션이 반드시 선행되어야 함.

1. 최근 30일 + 이전 30일 (60일치) 통계 수집
2. 습관별 streak 조회 (`HabitService.get_streak()` 루프)
3. 시스템 프롬프트 + 통계 데이터 → LLM 호출
4. Insight DB 저장 (category=`habit_pattern`)
5. 마크다운 형식 인사이트 텍스트 반환

**generate_insight 내부 로직:**
```python
async def generate_insight(self, user_id: uuid.UUID) -> dict:
    today = date.today()
    # 현재 30일 + 이전 30일
    current_trends = await self.get_trends(user_id, days=30)
    prev_start = today - timedelta(days=59)
    prev_end = today - timedelta(days=30)
    # 이전 30일 완료율 계산
    prev_rate = self._calc_overall_rate(user_id, prev_start, prev_end)
    current_rate = self._calc_overall_rate_from_trends(current_trends)
    change = current_rate - prev_rate

    # streak 정보
    habits = await self.habit_repo.list_by_user(user_id, status="active")
    streaks = []
    for h in habits:
        s = await self.habit_service.get_streak(h, today)
        streaks.append(f"- {h.title}: {s}일")
    streaks_text = "\n".join(streaks)

    # 완료율, 상관관계
    completion = await self.get_completion(user_id, days=30)
    correlations = await self.get_correlations(user_id, days=30)

    # LLM 호출
    prompt = f"""당신은 ALMA 습관 코치입니다...
    전체 완료율: {current_rate}% (이전 30일 대비 {change:+.0f}%)
    ...
    streak: {streaks_text}
    ..."""
    response = await self.llm.complete(...)

    # DB 저장
    insight = await insight_repo.create(
        user_id=user_id, category="habit_pattern",
        title="습관 분석", content=response.content,
    )
    return {"id": str(insight.id), "content": response.content, "generated_at": insight.created_at.isoformat()}
```

### 3.2 주간 자동 — Retrospective 확장

기존 `InsightService.generate_weekly_retrospective()`에 습관 통계 주입.

**의존성 주입 방식:** `InsightService.__init__`에 `habit_analytics_service=None` 파라미터 추가:

```python
class InsightService:
    def __init__(self, session, llm, habit_analytics_service=None):
        ...
        self.habit_analytics = habit_analytics_service
```

**get_stats_summary 메서드 (HabitAnalyticsService 내부 헬퍼):**

```python
async def get_stats_summary(self, user_id: uuid.UUID, days: int = 7) -> str:
    """주간 회고 프롬프트에 주입할 습관 통계 요약 텍스트"""
    trends = await self.get_trends(user_id, days=days)
    completion = await self.get_completion(user_id, days=days)

    if not trends["daily"]:
        return ""

    overall = sum(d["rate"] for d in trends["daily"]) / len(trends["daily"])
    lines = [f"[습관 통계 - 최근 {days}일]"]
    lines.append(f"- 평균 완료율: {overall:.0f}%")
    for h in completion["habits"]:
        lines.append(f"- {h['title']}: {h['rate']}% ({h['completed_days']}/{h['total_days']}일)")
    return "\n".join(lines)
```

`generate_weekly_retrospective` 내부에서:
```python
if self.habit_analytics:
    habit_stats = await self.habit_analytics.get_stats_summary(user_id, days=7)
    if habit_stats:
        prompt += f"\n\n{habit_stats}"
```

새 인사이트 카테고리: `habit_pattern` 추가 → Insight 모델의 category CHECK 제약조건 업데이트.

### 3.3 채팅 인텐트

`habit.analyze` 인텐트 추가:
- 자동 실행 (needs_confirmation=false)
- "습관 분석해줘", "습관 어떤 패턴이 있어?" 등

**IntegrationService 의존성 확장:**
```python
class IntegrationService:
    def __init__(self, session, llm, habit_service=None, habit_analytics_service=None):
        ...
        self.habit_analytics_service = habit_analytics_service
```

`_execute_habit_action`에 `analyze` 분기 추가:
```python
if action == "analyze":
    if not self.habit_analytics_service:
        return {"error": "Analytics service not available"}
    result = await self.habit_analytics_service.generate_insight(uid)
    return {"success": True, "content": result["content"]}
```

---

## 4. 프론트엔드 — /habits/analytics 페이지

### 4.1 라이브러리

설치 필요:
```bash
cd frontend && npm install chart.js react-chartjs-2 chartjs-chart-matrix
```

- `chart.js` + `react-chartjs-2` — 라인/바 차트 + 히트맵
- `chartjs-chart-matrix` — GitHub 스타일 히트맵
- `react-markdown` — 인사이트 렌더링 (기존 설치됨)

**SSR 방지:** Chart.js 컴포넌트는 `"use client"` + `dynamic(() => import(...), { ssr: false })` 패턴 필수 (Next.js App Router에서 `window is not defined` 오류 방지)

### 4.2 컴포넌트

**HabitHeatmap.tsx**: GitHub 스타일 연간 히트맵
- `chartjs-chart-matrix` 플러그인 사용
- 색상 강도: 0=회색, 1=연한 초록, 2+=진한 초록
- 마우스 오버 시 날짜 + 완료 수 툴팁
- `dynamic(() => import(...), { ssr: false })`로 로드

**HabitTrendChart.tsx**: 완료율 트렌드 라인 차트
- X축: 날짜, Y축: 완료율 (0-100%)
- `dynamic(() => import(...), { ssr: false })`로 로드

**HabitCompletionChart.tsx**: 습관별 완료율 수평 바 차트
- 각 습관별 완료율 + 완료일/스케줄일 라벨

**HabitCorrelationMatrix.tsx**: 상관관계 테이블 (**CSS Grid/Table 기반, Chart.js 아님**)
- `<table>` + Tailwind CSS로 구현
- 행/열: 습관명, 셀: 상관계수 색상 (빨강 ~ 흰색 ~ 초록)
- 습관 2개 미만 시 "데이터 부족" 표시
- Chart.js 매트릭스는 n×n 대칭 행렬에 부적합하므로 HTML 테이블이 더 적절

**HabitInsightCard.tsx**: LLM 인사이트
- 마크다운 렌더링 (react-markdown + remarkGfm)
- "AI 분석" 버튼 → POST /api/habits/analytics/insight
- 로딩 스피너

### 4.3 페이지 레이아웃

```
/habits/analytics
├── NavBar
├── 기간 필터 (30일/60일/90일/1년 — 히트맵만 1년)
├── 히트맵 (상단, 풀 너비)
├── 2컬럼 그리드:
│   ├── 트렌드 차트 (왼쪽)
│   └── 완료율 차트 (오른쪽)
├── 상관관계 테이블
├── AI 인사이트 카드 + "AI 분석" 버튼
└── 요일별 패턴 (간단한 바 차트)
```

### 4.4 /habits 페이지에서 진입

`/habits` 페이지 상단에 "통계" 링크 추가:
```tsx
<Link href="/habits/analytics" className="text-sm text-blue-500">통계 보기</Link>
```

### 4.5 useHabitAnalytics 훅

```typescript
export function useHabitAnalytics(days: number = 30) {
  // Promise.all로 4개 API 병렬 호출
  const fetchData = useCallback(async () => {
    const year = new Date().getFullYear();
    const [heatmap, trends, completion, correlations] = await Promise.all([
      apiClient<HeatmapData>(`/api/habits/analytics/heatmap?year=${year}`, { token }),
      apiClient<TrendData>(`/api/habits/analytics/trends?days=${days}`, { token }),
      apiClient<CompletionData>(`/api/habits/analytics/completion?days=${days}`, { token }),
      apiClient<CorrelationData>(`/api/habits/analytics/correlations?days=${days}`, { token }),
    ]);
    ...
  }, [token, days]);

  // POST /api/habits/analytics/insight (수동 호출)
  const generateInsight = async () => { ... };
}
```

---

## 5. 데이터 모델 변경

### 5.1 Insight category CHECK 제약조건 업데이트

```sql
-- 기존
"category IN ('topic_trend','goal_pattern','activity_pattern','recommendation')"
-- 변경
"category IN ('topic_trend','goal_pattern','activity_pattern','recommendation','habit_pattern')"
```

Alembic 마이그레이션: `op.execute()` raw SQL로 CHECK 제약 drop + recreate:
```python
def upgrade():
    op.execute("ALTER TABLE insights DROP CONSTRAINT ck_insight_category")
    op.execute("""
        ALTER TABLE insights ADD CONSTRAINT ck_insight_category
        CHECK (category IN ('topic_trend','goal_pattern','activity_pattern','recommendation','habit_pattern'))
    """)

def downgrade():
    op.execute("ALTER TABLE insights DROP CONSTRAINT ck_insight_category")
    op.execute("""
        ALTER TABLE insights ADD CONSTRAINT ck_insight_category
        CHECK (category IN ('topic_trend','goal_pattern','activity_pattern','recommendation'))
    """)
```

**주의:** Supabase pgbouncer 환경에서 `ALTER TABLE`은 트랜잭션 락을 잡으므로, 저트래픽 시간에 실행 권장.

---

## 6. 파일 구조

### Backend — Create
| 파일 | 책임 |
|------|------|
| `domain/habit/analytics.py` | HabitAnalyticsService (히트맵, 트렌드, 완료율, 상관관계, LLM 인사이트, get_stats_summary) |
| `api/habit_analytics.py` | 통계 API 라우터 5개 엔드포인트 |
| `tests/test_habit_analytics.py` | 통계 테스트 8개 |

### Backend — Modify
| 파일 | 변경 |
|------|------|
| `domain/habit/repository.py` | +get_completed_dates_by_user, +get_heatmap_data |
| `domain/integration/service.py` | +habit_analytics_service 주입, +habit.analyze 인텐트, detect_action_intent 프롬프트에 habit.analyze 추가 |
| `domain/insight/service.py` | +habit_analytics_service 주입, 주간 회고에 습관 통계 주입 |
| `models/models.py` | Insight category CHECK에 habit_pattern 추가 (코드) |
| `main.py` | +habit_analytics_router 등록 |
| `api/chat.py` | +HabitAnalyticsService 생성 및 IntegrationService/InsightService에 주입 |
| `tests/test_habit_chat_integration.py` | +test_analyze_intent |
| `tests/test_insight_service.py` | +test_retro_includes_habits |
| Alembic migration | ck_insight_category 업데이트 (raw SQL) |

### Frontend — Create
| 파일 | 책임 |
|------|------|
| `app/habits/analytics/page.tsx` | 통계 페이지 |
| `components/HabitHeatmap.tsx` | 연간 히트맵 (Chart.js matrix, SSR disabled) |
| `components/HabitTrendChart.tsx` | 완료율 트렌드 (Chart.js line, SSR disabled) |
| `components/HabitCompletionChart.tsx` | 습관별 완료율 (Chart.js bar, SSR disabled) |
| `components/HabitCorrelationMatrix.tsx` | 상관관계 테이블 (CSS/Tailwind) |
| `components/HabitInsightCard.tsx` | LLM 인사이트 카드 (react-markdown) |
| `hooks/useHabitAnalytics.ts` | 통계 API 훅 (Promise.all 병렬) |

### Frontend — Modify
| 파일 | 변경 |
|------|------|
| `lib/types.ts` | +HeatmapData, TrendData, CompletionData, CorrelationData, InsightResult 타입 |
| `app/habits/page.tsx` | +"통계 보기" 링크 추가 |

---

## 7. 테스트 전략

### test_habit_analytics.py (8개)

| # | 테스트 | 내용 | 데이터 세팅 |
|---|--------|------|-----------|
| 1 | test_heatmap_empty | 로그 없을 때 빈 dict | 습관만 생성, 로그 없음 |
| 2 | test_heatmap_with_data | 3일 체크인 → 3개 날짜 카운트 | 고정 날짜 3일 체크인 |
| 3 | test_trends_daily | 30일 완료율 트렌드 계산 | daily 습관 + 일부 체크인 |
| 4 | test_completion_rate | 습관별 완료일/스케줄일 비율 | 2개 습관, 서로 다른 완료율 |
| 5 | test_correlation_positive | 동시 완료 높은 두 습관 → 양의 상관계수 | 두 daily 습관, 같은 날 체크인 |
| 6 | test_correlation_no_overlap | 겹침 없으면 ~0 | 두 daily 습관, 교대로 체크인 |
| 7 | test_generate_insight | LLM 모킹 → 인사이트 생성 + DB 저장 | 습관 + 로그 + mock LLM |
| 8 | test_weekday_pattern | 요일별 완료율 집계 | 특정 요일만 체크인 |

**피어슨 테스트 데이터 세팅:** 고정 날짜 범위 사용 (date(2026, 3, 1) ~ date(2026, 3, 15)). `HabitService.is_scheduled()`가 결정론적이므로 daily 습관으로 테스트하면 모든 날짜가 스케줄됨.

### 기존 테스트 파일 추가분 (2개)

| # | 파일 | 테스트 | 내용 |
|---|------|--------|------|
| 9 | test_habit_chat_integration.py | test_analyze_intent | habit.analyze 인텐트 감지 + 실행 |
| 10 | test_insight_service.py | test_retro_includes_habits | 주간 회고에 습관 데이터 포함 |

**총 10개 테스트.** LLM 호출은 모킹.

---

## 8. 향후 개선 (현재 범위 외)

- 실시간 업데이트 (WebSocket)
- 목표별 습관 진행률 크로스 분석
- 커스텀 대시보드 위젯 배치
- CSV/PDF 리포트 내보내기

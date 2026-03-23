# Phase 5 Chunk 3: 습관 통계 + LLM 코칭 인사이트

## 1. 개요

습관 로그 데이터를 집계하여 시각적 통계(히트맵, 트렌드, 완료율, 상관관계)를 제공하고, LLM 기반 코칭 인사이트를 생성한다.

**범위:**
- 백엔드 통계 집계 API (히트맵, 트렌드, 완료율, 상관관계)
- LLM 코칭 인사이트 (주간 자동 + 사용자 요청)
- 프론트엔드 통계 대시보드 (/habits/analytics)
- Chart.js (react-chartjs-2) 시각화

**범위 외:** Push notification, 실시간 업데이트, 외부 서비스 연동

---

## 2. 백엔드 통계 API — HabitAnalyticsService

### 2.1 서비스 구조

`domain/habit/analytics.py` — HabitAnalyticsService

의존성: `HabitRepository`, `HabitLogRepository`, `HabitService` (is_scheduled), `LLMProvider` (인사이트 생성 시)

### 2.2 엔드포인트

| 엔드포인트 | 메서드 | 응답 |
|-----------|--------|------|
| `GET /api/habits/analytics/heatmap?year=2026` | `get_heatmap` | `{dates: {"2026-01-05": 3, "2026-01-06": 1, ...}}` |
| `GET /api/habits/analytics/trends?days=30` | `get_trends` | `{daily: [{date, total, completed, rate}], weekday: [{day, rate}]}` |
| `GET /api/habits/analytics/completion?days=30` | `get_completion` | `{habits: [{id, title, rate, total_days, completed_days}]}` |
| `GET /api/habits/analytics/correlations?days=30` | `get_correlations` | `{pairs: [{habit_a, habit_b, habit_a_title, habit_b_title, correlation}]}` |
| `POST /api/habits/analytics/insight` | `generate_insight` | `{content: "...", generated_at: "..."}` |

### 2.3 히트맵 집계

```sql
SELECT log_date, COUNT(*) as count
FROM habit_logs
WHERE user_id = :uid AND completed = true
  AND log_date >= :year_start AND log_date <= :year_end
GROUP BY log_date
```

반환: `{dates: {date_string: count}}` — 프론트엔드에서 색상 강도 매핑

### 2.4 트렌드 집계

최근 N일 동안 일별:
1. 해당 날짜에 스케줄된 활성 습관 수 (`total`)
2. 완료된 습관 수 (`completed`)
3. 완료율 (`rate = completed / total`)

요일별 패턴:
- 7일(월~일) 각각의 평균 완료율

```python
async def get_trends(self, user_id: uuid.UUID, days: int = 30) -> dict:
    today = date.today()
    start = today - timedelta(days=days)
    habits = await self.habit_repo.list_by_user(user_id, status="active")
    completed_logs = await self.log_repo.get_completed_dates_by_user(user_id, start, today)
    # completed_logs: dict[date, set[habit_id]]

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

두 습관이 같은 날 동시에 완료되는 빈도를 피어슨 상관계수로 계산:

```python
async def get_correlations(self, user_id: uuid.UUID, days: int = 30) -> dict:
    today = date.today()
    start = today - timedelta(days=days)
    habits = await self.habit_repo.list_by_user(user_id, status="active")
    if len(habits) < 2:
        return {"pairs": []}

    # 습관별 일별 완료 여부 벡터 생성
    vectors: dict[uuid.UUID, list[int]] = {}
    for habit in habits:
        completed = await self.log_repo.get_completed_dates(habit.id, start, today)
        vector = []
        for i in range(days):
            d = start + timedelta(days=i)
            if HabitService.is_scheduled(habit, d):
                vector.append(1 if d in completed else 0)
            # 스케줄 안 된 날은 벡터에 포함하지 않음 (NaN 대신 스킵)
        vectors[habit.id] = vector

    # 모든 쌍에 대해 피어슨 상관계수 계산
    pairs = []
    habit_list = list(habits)
    for i in range(len(habit_list)):
        for j in range(i + 1, len(habit_list)):
            a, b = habit_list[i], habit_list[j]
            va, vb = vectors[a.id], vectors[b.id]
            # 길이가 다를 수 있으므로 min_len으로 자르기
            min_len = min(len(va), len(vb))
            if min_len < 3:
                continue  # 데이터 부족
            corr = _pearson(va[:min_len], vb[:min_len])
            pairs.append({
                "habit_a": str(a.id),
                "habit_b": str(b.id),
                "habit_a_title": a.title,
                "habit_b_title": b.title,
                "correlation": round(corr, 2),
            })

    return {"pairs": sorted(pairs, key=lambda x: abs(x["correlation"]), reverse=True)}
```

피어슨 상관계수 유틸:
```python
def _pearson(x: list[int], y: list[int]) -> float:
    n = len(x)
    if n == 0:
        return 0.0
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    cov = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    std_x = (sum((xi - mean_x) ** 2 for xi in x)) ** 0.5
    std_y = (sum((yi - mean_y) ** 2 for yi in y)) ** 0.5
    if std_x == 0 or std_y == 0:
        return 0.0
    return cov / (std_x * std_y)
```

### 2.7 HabitLogRepository 추가 메서드

```python
async def get_completed_dates_by_user(
    self, user_id: uuid.UUID, start: date, end: date
) -> dict[date, set[uuid.UUID]]:
    """사용자의 날짜별 완료된 습관 ID set 반환"""
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
    """연간 날짜별 완료 습관 수"""
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
    return {str(row[0]): row[1] for row in result.all()}
```

---

## 3. LLM 코칭 인사이트

### 3.1 사용자 요청 인사이트

`POST /api/habits/analytics/insight` — HabitAnalyticsService.generate_insight()

1. 최근 30일 통계 수집 (trends, completion, correlations)
2. 시스템 프롬프트 + 통계 데이터 → LLM 호출
3. 마크다운 형식 인사이트 텍스트 반환

**LLM 프롬프트:**
```
당신은 ALMA 습관 코치입니다. 사용자의 습관 데이터를 분석하고 실천 가능한 조언을 제공하세요.

[습관 분석 데이터 - 최근 30일]
- 전체 완료율: {overall_rate}% (이전 30일 대비 {change}%)
- 습관별 완료율:
{completion_list}
- 요일별 패턴: {weekday_pattern}
- 상관관계: {correlations}
- 현재 streak 정보: {streaks}

다음 형식으로 분석해주세요:
1. 잘하고 있는 점 (구체적 데이터 인용)
2. 개선할 점 (실천 가능한 제안)
3. 발견된 패턴 (상관관계, 요일별 차이 등)
4. 다음 주 추천 액션 (1-2개)
```

### 3.2 주간 자동 — Retrospective 확장

기존 `InsightService.generate_weekly_retrospective()`의 LLM 프롬프트에 습관 통계 섹션 추가:

```python
# insight/service.py의 generate_weekly_retrospective 내부
if habit_service:
    habit_analytics = HabitAnalyticsService(session, llm)
    habit_stats = await habit_analytics.get_stats_summary(user_id, days=7)
    prompt += f"\n\n{habit_stats}"
```

새 인사이트 카테고리: `habit_pattern` 추가 → Insight 모델의 category CHECK 제약조건 업데이트 필요.

### 3.3 채팅 인텐트

`habit.analyze` 인텐트 추가:
- 자동 실행 (needs_confirmation=false)
- "습관 분석해줘", "습관 어떤 패턴이 있어?" 등
- `HabitAnalyticsService.generate_insight()` 호출 → 결과를 채팅 응답에 append

---

## 4. 프론트엔드 — /habits/analytics 페이지

### 4.1 라이브러리

- `chart.js` + `react-chartjs-2` — 라인/바 차트
- `chartjs-chart-matrix` — 히트맵 (Chart.js 매트릭스 플러그인)
- `react-markdown` — 인사이트 렌더링 (기존 설치됨)

### 4.2 컴포넌트

**HabitHeatmap.tsx**: GitHub 스타일 연간 히트맵
- Chart.js matrix 플러그인 사용
- 색상 강도: 0=회색, 1=연한 초록, 2+=진한 초록
- 마우스 오버 시 날짜 + 완료 수 툴팁

**HabitTrendChart.tsx**: 완료율 트렌드 라인 차트
- X축: 날짜, Y축: 완료율 (0-100%)
- 기간 필터: 30/60/90일

**HabitCompletionChart.tsx**: 습관별 완료율 수평 바 차트
- 각 습관별 완료율 + 완료일/스케줄일 라벨

**HabitCorrelationMatrix.tsx**: 상관관계 히트맵
- 행/열: 습관명, 셀: 상관계수 (-1 ~ +1)
- 색상: 빨강(음의 상관) ~ 흰색(0) ~ 초록(양의 상관)
- 습관 2개 미만 시 "데이터 부족" 표시

**HabitInsightCard.tsx**: LLM 인사이트
- 마크다운 렌더링 (react-markdown)
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
├── 상관관계 매트릭스
├── AI 인사이트 카드 + "AI 분석" 버튼
└── 요일별 패턴 (간단한 바 차트)
```

### 4.4 /habits 페이지에서 진입

`/habits` 페이지 상단에 "통계" 링크 추가:
```tsx
<Link href="/habits/analytics" className="text-sm text-blue-500">통계</Link>
```

### 4.5 useHabitAnalytics 훅

```typescript
export function useHabitAnalytics(days: number = 30) {
  // GET /api/habits/analytics/heatmap?year=현재년
  // GET /api/habits/analytics/trends?days=N
  // GET /api/habits/analytics/completion?days=N
  // GET /api/habits/analytics/correlations?days=N
  // POST /api/habits/analytics/insight (수동 호출)
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

Alembic 마이그레이션으로 CHECK 제약조건 drop + recreate.

---

## 6. 파일 구조

### Backend — Create
| 파일 | 책임 |
|------|------|
| `domain/habit/analytics.py` | HabitAnalyticsService (히트맵, 트렌드, 완료율, 상관관계, LLM 인사이트) |
| `api/habit_analytics.py` | 통계 API 라우터 5개 엔드포인트 |
| `tests/test_habit_analytics.py` | 통계 테스트 8개 |

### Backend — Modify
| 파일 | 변경 |
|------|------|
| `domain/habit/repository.py` | +get_completed_dates_by_user, +get_heatmap_data |
| `domain/integration/service.py` | +habit.analyze 인텐트 |
| `domain/insight/service.py` | 주간 회고에 습관 통계 주입 |
| `models/models.py` | Insight category CHECK에 habit_pattern 추가 |
| `main.py` | +habit_analytics_router 등록 |
| `tests/test_habit_chat_integration.py` | +test_analyze_intent |
| `tests/test_insight_service.py` | +test_retro_includes_habits |
| Alembic migration | ck_insight_category 업데이트 |

### Frontend — Create
| 파일 | 책임 |
|------|------|
| `app/habits/analytics/page.tsx` | 통계 페이지 |
| `components/HabitHeatmap.tsx` | 연간 히트맵 |
| `components/HabitTrendChart.tsx` | 완료율 트렌드 |
| `components/HabitCompletionChart.tsx` | 습관별 완료율 |
| `components/HabitCorrelationMatrix.tsx` | 상관관계 매트릭스 |
| `components/HabitInsightCard.tsx` | LLM 인사이트 카드 |
| `hooks/useHabitAnalytics.ts` | 통계 API 훅 |

### Frontend — Modify
| 파일 | 변경 |
|------|------|
| `lib/types.ts` | +HeatmapData, TrendData, CompletionData, CorrelationData, InsightResult 타입 |
| `app/habits/page.tsx` | +"통계" 링크 추가 |

---

## 7. 테스트 전략

### test_habit_analytics.py (8개)

| # | 테스트 | 내용 |
|---|--------|------|
| 1 | test_heatmap_empty | 로그 없을 때 빈 dict |
| 2 | test_heatmap_with_data | 3일 체크인 → 3개 날짜 카운트 |
| 3 | test_trends_daily | 30일 완료율 트렌드 계산 |
| 4 | test_completion_rate | 습관별 완료일/스케줄일 비율 |
| 5 | test_correlation_positive | 동시 완료 높은 두 습관 → 양의 상관계수 |
| 6 | test_correlation_no_overlap | 겹침 없으면 ~0 |
| 7 | test_generate_insight | LLM 모킹 → 인사이트 텍스트 생성 |
| 8 | test_weekday_pattern | 요일별 완료율 집계 |

### 기존 테스트 파일 추가분 (2개)

| # | 파일 | 테스트 | 내용 |
|---|------|--------|------|
| 9 | test_habit_chat_integration.py | test_analyze_intent | "습관 분석해줘" → habit.analyze 인텐트 |
| 10 | test_insight_service.py | test_retro_includes_habits | 주간 회고에 습관 데이터 포함 |

**총 10개 테스트.** LLM 호출은 모킹.

---

## 8. 향후 개선 (현재 범위 외)

- 실시간 업데이트 (WebSocket)
- 목표별 습관 진행률 크로스 분석
- 커스텀 대시보드 위젯 배치
- CSV/PDF 리포트 내보내기

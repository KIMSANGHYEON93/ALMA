# UX Audit Bundle 2 — Chart & Data Viz Accessibility 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 히트맵/트렌드/완료율/상관관계/온톨로지 그래프 차트에 색맹 대응 시각적 변별과 스크린 리더 요약을 추가하여, 색각 이상 사용자와 스크린 리더 사용자가 차트 인사이트에 접근할 수 있게 한다.

**Architecture:** 차트 자체는 Chart.js (react-chartjs-2) + react-force-graph-2d 라이브러리 의존. 라이브러리 내부 변경 없이, 차트 래퍼 컴포넌트에 시각 변별 레이어(HabitHeatmap의 border/ring 추가)와 `sr-only` 요약 텍스트 + `role="img" aria-label`을 병치하여 접근성을 확보한다. Bundle 1과 독립 — 다른 파일.

**Tech Stack:** react-chartjs-2 5.3, chartjs-chart-matrix 3.0, react-force-graph-2d 1.29, Tailwind `sr-only` utility.

---

## 사전 준비

```bash
cd C:/Users/sha2.kim/alma
git checkout -b feature/ux-audit-bundle-2
```

Bundle 1과 병렬 진행 가능 — 겹치는 파일 없음.

---

## 파일 구조

**변경 파일 (7개 + 1 신규 유틸):**

| 파일 | 책임 | 변경 유형 |
|---|---|---|
| `frontend/src/lib/a11y.ts` | a11y 유틸 (신규) | `formatChartSummary` 헬퍼 함수 |
| `frontend/src/components/HabitHeatmap.tsx` | 연간 히트맵 | 색맹 대응 border/ring + aria summary |
| `frontend/src/components/HabitTrendChart.tsx` | 트렌드 래퍼 | aria summary 주입 |
| `frontend/src/components/HabitCompletionChart.tsx` | 완료율 래퍼 | aria summary 주입 |
| `frontend/src/components/HabitCorrelationMatrix.tsx` | 상관관계 | aria summary + 기호 기반 변별 |
| `frontend/src/components/charts/TrendLineChart.tsx` | Chart.js 라인 | `aria-label`/`role` + plugin options |
| `frontend/src/components/charts/CompletionBarChart.tsx` | Chart.js 바 | 동일 |
| `frontend/src/components/ontology/GraphView.tsx` | 온톨로지 force graph | canvas wrapper에 aria summary |

---

## Task 2.0: Bundle 1 Carryover — 추가 본문 대비 수정

**배경:** Bundle 1 최종 리뷰에서 Task 1.1 대상 파일 목록에 포함되지 않았던 컴포넌트 본문 텍스트 5곳이 미처리로 남았음. Bundle 2 차트 작업 전에 정리.

### 변경 대상 (5곳)

| 파일 | 라인 | 현재 | 목표 |
|---|---|---|---|
| `frontend/src/components/HabitCard.tsx` | L180 | `text-sm text-gray-500` | `text-sm text-gray-600 dark:text-gray-400` |
| `frontend/src/components/GoalDetail.tsx` | L64 | `text-sm text-gray-500 dark:text-gray-400` | `text-sm text-gray-700 dark:text-gray-300` (description prose, 본문 성격) |
| `frontend/src/components/ConversationList.tsx` | L143 | `text-xs text-gray-500 dark:text-gray-400` | `text-xs text-gray-600 dark:text-gray-400` |
| `frontend/src/components/ConversationList.tsx` | L163 | `text-xs text-gray-500 dark:text-gray-400` | `text-xs text-gray-600 dark:text-gray-400` |
| `frontend/src/app/page.tsx` | L561 | `... text-center text-gray-500 text-sm` | `... text-center text-gray-600 dark:text-gray-400 text-sm` (footer, dark 짝 추가) |

### 건드리지 말 것 (의도적 약화)

- `GoalDetail.tsx` L146 — `text-gray-400 dark:text-gray-500 line-through` (완료된 마일스톤 strikethrough, 의도적 약화)
- `MessageBubble.tsx` L68 — `text-gray-500 dark:text-gray-300` (hover-interactive 복사 버튼 내부, `hover:text-sky-600` 전환 있음, 보존 규칙 적용)

### Acceptance Criteria

- [ ] 위 5곳 모두 변경됨
- [ ] 의도적 약화 2곳은 보존됨
- [ ] Lint/Type 오류 없음

### 실행

```bash
cd C:/Users/sha2.kim/alma
# Edit 도구로 각 라인 변경

cd frontend
npm run lint && npx tsc --noEmit

cd ..
git add frontend/src/components/HabitCard.tsx \
        frontend/src/components/GoalDetail.tsx \
        frontend/src/components/ConversationList.tsx \
        frontend/src/app/page.tsx
git commit -m "fix(a11y): carryover contrast fixes from Bundle 1 review"
```

---

## Task 2.1: HabitHeatmap 색맹 대응

**문제:** 현재 intensity 4단계가 순수 색상(emerald-200~600)만으로 구분 — 적록색맹 사용자는 단계를 구분 못함.

**해결 방안:** 색상 + 테두리 두께 조합으로 이중 변별 확보. 범례에도 동일 마커 표시.

**디자인 결정:**

| count | 배경 (light / dark) | 테두리 | 의미 |
|---|---|---|---|
| 0 | `gray-100` / `gray-800` | 없음 | 기록 없음 |
| 1 | `emerald-200` / `emerald-900` | `ring-1 ring-emerald-400/70` | 1개 습관 완료 |
| 2 | `emerald-400` / `emerald-700` | `ring-2 ring-emerald-600/80` | 2개 완료 |
| 3+ | `emerald-600` / `emerald-500` | `ring-2 ring-emerald-700 ring-offset-1 ring-offset-white dark:ring-offset-gray-900` | 3개 이상 (가장 강조) |

### Files: `frontend/src/components/HabitHeatmap.tsx`

- [ ] **Step 1: 색상+테두리 통합 유틸 함수로 추출**

```tsx
// L22-27 기존
const getColor = (count: number) => {
  if (count === 0) return "bg-gray-100 dark:bg-gray-800";
  if (count === 1) return "bg-emerald-200 dark:bg-emerald-900";
  if (count === 2) return "bg-emerald-400 dark:bg-emerald-700";
  return "bg-emerald-600 dark:bg-emerald-500";
};

// 교체 (같은 위치)
const getCellStyle = (count: number) => {
  if (count === 0) return "bg-gray-100 dark:bg-gray-800";
  if (count === 1) return "bg-emerald-200 dark:bg-emerald-900 ring-1 ring-emerald-400/70";
  if (count === 2) return "bg-emerald-400 dark:bg-emerald-700 ring-2 ring-emerald-600/80";
  return "bg-emerald-600 dark:bg-emerald-500 ring-2 ring-emerald-700 dark:ring-emerald-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900";
};
```

- [ ] **Step 2: 셀 클래스 적용 변경**

L43 기존:
```tsx
className={`w-3 h-3 rounded-sm ${getColor(day.count)}`}
```

교체:
```tsx
className={`w-3 h-3 rounded-sm ${getCellStyle(day.count)}`}
```

- [ ] **Step 3: 범례에도 같은 시각 변별 반영**

L52-59 범례도 `getCellStyle`을 사용하도록 통일:

```tsx
// Before (L52-59)
<div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
  <span>적음</span>
  <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
  <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
  <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
  <div className="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
  <span>많음</span>
</div>

// After — 같은 getCellStyle 사용 + text 대비 개선
<div className="flex items-center gap-1.5 mt-3 text-xs text-gray-600 dark:text-gray-400">
  <span>적음</span>
  {[0, 1, 2, 3].map((n) => (
    <div key={n} className={`w-3 h-3 rounded-sm ${getCellStyle(n)}`} aria-hidden="true" />
  ))}
  <span>많음</span>
</div>
```

`gap-1` → `gap-1.5` 로 ring offset 겹침 방지. `text-gray-400` → `text-gray-600 dark:text-gray-400` (Bundle 1 패턴 일치).

- [ ] **Step 4: 시각 회귀 확인**

```bash
cd frontend
npm run dev
```

`/habits/analytics` 방문, light/dark 모두에서:
- 각 intensity 단계가 색 + 테두리로 구분되는지
- 범례 4셀이 실제 히트맵과 동일한 모양인지
- Sim Daltonism 같은 색맹 시뮬레이터로 확인 (선택)

---

## Task 2.2: Heatmap 데이터 요약 (aria summary)

**계속 `HabitHeatmap.tsx`** — 색맹 대응과 같은 파일이므로 묶어서 처리.

- [ ] **Step 5: 데이터 요약 함수 추가**

`frontend/src/lib/a11y.ts` 신규 파일 생성:

```ts
// frontend/src/lib/a11y.ts

/**
 * 차트 데이터 → 스크린 리더 요약 텍스트 생성 유틸.
 * 시각적 차트 옆에 sr-only로 병치하여 스크린 리더 사용자에게
 * 핵심 인사이트를 제공한다.
 */

export interface HeatmapSummary {
  totalDays: number;
  recordedDays: number;
  totalCompletions: number;
  maxStreak: number;
  mostActiveCount: number;
}

export function summarizeHeatmap(dates: Record<string, number>, year: number): HeatmapSummary {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  let totalDays = 0;
  let recordedDays = 0;
  let totalCompletions = 0;
  let maxStreak = 0;
  let curStreak = 0;
  let mostActiveCount = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    totalDays += 1;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const count = dates[key] || 0;
    if (count > 0) {
      recordedDays += 1;
      totalCompletions += count;
      curStreak += 1;
      if (curStreak > maxStreak) maxStreak = curStreak;
      if (count > mostActiveCount) mostActiveCount = count;
    } else {
      curStreak = 0;
    }
  }

  return { totalDays, recordedDays, totalCompletions, maxStreak, mostActiveCount };
}

export function formatHeatmapSummary(s: HeatmapSummary, year: number): string {
  return `${year}년 연간 습관 히트맵. 총 ${s.totalDays}일 중 ${s.recordedDays}일에 습관을 완료했습니다. 전체 완료 횟수 ${s.totalCompletions}회, 최장 연속 ${s.maxStreak}일. 하루 최대 완료 습관 수 ${s.mostActiveCount}개.`;
}
```

- [ ] **Step 6: HabitHeatmap에 sr-only 요약 + role/aria-label 추가**

`HabitHeatmap.tsx` L1 import 추가:
```tsx
import { summarizeHeatmap, formatHeatmapSummary } from "@/lib/a11y";
```

컴포넌트 return 바로 전에 요약 계산, L29-33 (return 시작) 아래 구조 교체:

```tsx
// 기존 L9-14 body 유지, return 직전에 추가:
const summary = summarizeHeatmap(data.dates, year);
const summaryText = formatHeatmapSummary(summary, year);

// L29 return block을 다음과 같이:
return (
  <div className="p-4">
    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">연간 습관 히트맵</h3>
    {/* 시각 차트 (aria-hidden — 스크린 리더는 sr-only 요약을 읽음) */}
    <div className="overflow-x-auto" role="img" aria-label={summaryText}>
      <div className="flex gap-[2px]" style={{ minWidth: "700px" }} aria-hidden="true">
        {Array.from({ length: 53 }, (_, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[2px]">
            {Array.from({ length: 7 }, (_, dayIdx) => {
              const idx = weekIdx * 7 + dayIdx;
              const day = days[idx];
              if (!day) return <div key={dayIdx} className="w-3 h-3" />;
              return (
                <div
                  key={dayIdx}
                  className={`w-3 h-3 rounded-sm ${getCellStyle(day.count)}`}
                  title={`${day.date}: ${day.count}개 완료`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
    {/* 범례 */}
    <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-600 dark:text-gray-400">
      <span>적음</span>
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className={`w-3 h-3 rounded-sm ${getCellStyle(n)}`} aria-hidden="true" />
      ))}
      <span>많음</span>
    </div>
  </div>
);
```

---

## Task 2.3: 트렌드/완료율 차트 aria summary

### Files: `frontend/src/lib/a11y.ts`

- [ ] **Step 1: 트렌드/완료율 요약 함수 추가**

같은 `a11y.ts`에 이어서:

```ts
export function formatTrendSummary(daily: { date: string; completion_rate: number }[]): string {
  if (daily.length === 0) return "트렌드 데이터 없음.";
  const rates = daily.map((d) => d.completion_rate);
  const avg = Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100);
  const max = Math.round(Math.max(...rates) * 100);
  const min = Math.round(Math.min(...rates) * 100);
  const first = daily[0].date;
  const last = daily[daily.length - 1].date;
  const trend = rates[rates.length - 1] - rates[0];
  const direction = trend > 0.05 ? "상승" : trend < -0.05 ? "하락" : "보합";
  return `${first}부터 ${last}까지 ${daily.length}일간 완료율 트렌드. 평균 ${avg}%, 최고 ${max}%, 최저 ${min}%. 기간 전반 추세 ${direction}.`;
}

export function formatCompletionSummary(habits: { title: string; completion_rate: number }[]): string {
  if (habits.length === 0) return "완료율 데이터 없음.";
  const sorted = [...habits].sort((a, b) => b.completion_rate - a.completion_rate);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const avg = Math.round((habits.reduce((acc, h) => acc + h.completion_rate, 0) / habits.length) * 100);
  return `습관 ${habits.length}개 완료율. 평균 ${avg}%. 최고: ${top.title} ${Math.round(top.completion_rate * 100)}%, 최저: ${bottom.title} ${Math.round(bottom.completion_rate * 100)}%.`;
}

export interface CorrelationPair {
  habit_a_title: string;
  habit_b_title: string;
  correlation: number;
}

export function formatCorrelationSummary(pairs: CorrelationPair[]): string {
  if (pairs.length === 0) return "상관관계 데이터 부족.";
  const strong = pairs.filter((p) => Math.abs(p.correlation) >= 0.5);
  const moderate = pairs.filter((p) => Math.abs(p.correlation) >= 0.2 && Math.abs(p.correlation) < 0.5);
  const positives = strong.filter((p) => p.correlation > 0).length;
  const negatives = strong.filter((p) => p.correlation < 0).length;
  return `습관 쌍 ${pairs.length}개 상관관계 분석. 강한 양의 상관 ${positives}쌍, 강한 음의 상관 ${negatives}쌍, 중간 상관 ${moderate.length}쌍.`;
}
```

**주의:** `CompletionData`, `TrendData`의 실제 구조는 `frontend/src/lib/types.ts`에 정의됨. 위 함수 인자 타입을 실제 타입에 맞춰야 함 — 구현 전 확인:

```bash
grep -n "CompletionData\|TrendData" frontend/src/lib/types.ts
```

시그니처 불일치 시 위 함수의 인자 타입을 실제 타입으로 교체하고 필드명 조정.

### Files: `frontend/src/components/HabitTrendChart.tsx`

- [ ] **Step 2: Trend 래퍼에 aria summary 주입**

```tsx
"use client";

import dynamic from "next/dynamic";
import type { TrendData } from "@/lib/types";
import { formatTrendSummary } from "@/lib/a11y";

const ChartComponent = dynamic(
  () => import("./charts/TrendLineChart"),
  { ssr: false }
);

interface Props {
  data: TrendData | null;
}

export default function HabitTrendChart({ data }: Props) {
  if (!data || data.daily.length === 0) return null;
  const summary = formatTrendSummary(data.daily);
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">완료율 트렌드</h3>
      <div role="img" aria-label={summary}>
        <ChartComponent daily={data.daily} />
      </div>
      <span className="sr-only">{summary}</span>
    </div>
  );
}
```

### Files: `frontend/src/components/HabitCompletionChart.tsx`

- [ ] **Step 3: Completion 래퍼 동일 패턴 적용**

```tsx
"use client";

import dynamic from "next/dynamic";
import type { CompletionData } from "@/lib/types";
import { formatCompletionSummary } from "@/lib/a11y";

const ChartComponent = dynamic(
  () => import("./charts/CompletionBarChart"),
  { ssr: false }
);

interface Props {
  data: CompletionData | null;
}

export default function HabitCompletionChart({ data }: Props) {
  if (!data || data.habits.length === 0) return null;
  const summary = formatCompletionSummary(data.habits);
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관별 완료율</h3>
      <div role="img" aria-label={summary}>
        <ChartComponent habits={data.habits} />
      </div>
      <span className="sr-only">{summary}</span>
    </div>
  );
}
```

### Files: `frontend/src/components/HabitCorrelationMatrix.tsx`

- [ ] **Step 4: Correlation Matrix에 aria summary + 색 외 기호 변별**

상관 방향성은 이미 양수/음수 색상(emerald/red)으로 구분되나, 색 의존. 추가로 ↑/↓/→ 화살표 기호로 보강:

```tsx
"use client";

import type { CorrelationData } from "@/lib/types";
import { formatCorrelationSummary } from "@/lib/a11y";

interface Props {
  data: CorrelationData | null;
}

export default function HabitCorrelationMatrix({ data }: Props) {
  if (!data || data.pairs.length === 0) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관 상관관계</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">데이터가 부족합니다 (습관 2개 이상 + 5일 이상 기록 필요)</p>
      </div>
    );
  }

  const getStyle = (corr: number) => {
    if (corr >= 0.5) return { cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", icon: "↑↑", label: "강한 양의 상관" };
    if (corr >= 0.2) return { cls: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400", icon: "↑", label: "양의 상관" };
    if (corr <= -0.5) return { cls: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300", icon: "↓↓", label: "강한 음의 상관" };
    if (corr <= -0.2) return { cls: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400", icon: "↓", label: "음의 상관" };
    return { cls: "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300", icon: "→", label: "상관 없음" };
  };

  const summary = formatCorrelationSummary(data.pairs);

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">습관 상관관계</h3>
      <span className="sr-only">{summary}</span>
      <div className="space-y-2" role="list">
        {data.pairs.map((pair, i) => {
          const style = getStyle(pair.correlation);
          return (
            <div
              key={i}
              role="listitem"
              className={`flex items-center justify-between p-2 rounded-lg ${style.cls}`}
              aria-label={`${pair.habit_a_title}와 ${pair.habit_b_title}: ${style.label}, 상관계수 ${pair.correlation.toFixed(2)}`}
            >
              <span className="text-sm">{pair.habit_a_title} ↔ {pair.habit_b_title}</span>
              <span className="flex items-center gap-1.5 text-sm font-mono font-medium">
                <span aria-hidden="true">{style.icon}</span>
                {pair.correlation.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

색상 + 화살표 기호 이중 변별 확보. 각 쌍에 `aria-label`로 방향/강도/수치 제공.

### Files: `frontend/src/components/charts/TrendLineChart.tsx`, `CompletionBarChart.tsx`

- [ ] **Step 5: Chart.js 내부에 a11y 옵션 추가**

실제 구현은 읽어야 확정 가능하지만 Chart.js 공통 패턴:

1. canvas에 `aria-label`이 내부적으로 렌더되지만, react-chartjs-2 기본값은 없음 — wrapper `<div role="img">`가 담당.
2. Chart.js `options.plugins.tooltip.enabled: true`, `options.plugins.legend.display: true` 확인 (이미 기본값일 가능성 높음).
3. canvas에 `aria-hidden` 추가하여 중복 읽기 방지 (래퍼의 aria-label만 읽도록).

실제 파일 확인 후 필요 시 canvas prop `aria-hidden="true"` 주입:

```bash
grep -n "aria-\|Chart\|canvas" frontend/src/components/charts/TrendLineChart.tsx
grep -n "aria-\|Chart\|canvas" frontend/src/components/charts/CompletionBarChart.tsx
```

- [ ] **Step 6: Lint + Build 검증**

```bash
cd frontend
npm run lint && npx tsc --noEmit && npm run build
```

- [ ] **Step 7: Task 2.1~2.3 커밋**

```bash
git add frontend/src/lib/a11y.ts \
        frontend/src/components/HabitHeatmap.tsx \
        frontend/src/components/HabitTrendChart.tsx \
        frontend/src/components/HabitCompletionChart.tsx \
        frontend/src/components/HabitCorrelationMatrix.tsx \
        frontend/src/components/charts/TrendLineChart.tsx \
        frontend/src/components/charts/CompletionBarChart.tsx
git commit -m "feat(a11y): add screen reader summaries and color-blind differentiation to charts"
```

**Acceptance Criteria 2.1~2.3:**
- [ ] HabitHeatmap 각 intensity가 색 + ring 두께로 이중 변별
- [ ] Trend/Completion/Correlation/Heatmap에 `role="img" aria-label="..."` + `sr-only` 요약
- [ ] Correlation에 색 + 화살표(↑↑/↑/→/↓/↓↓) 이중 변별
- [ ] Chart.js canvas에 `aria-hidden="true"` (래퍼의 aria-label과 중복 방지)
- [ ] Lint/Type/Build 성공

---

## Task 2.4: Ontology GraphView aria summary

### Files: `frontend/src/lib/a11y.ts`

- [ ] **Step 1: Graph 요약 함수 추가**

```ts
export interface GraphNodeSummary {
  category: string;
  count: number;
}

export function summarizeGraph(
  nodes: { category?: string }[],
  links: unknown[]
): { total: string; categories: GraphNodeSummary[] } {
  const byCat: Record<string, number> = {};
  nodes.forEach((n) => {
    const c = n.category || "기타";
    byCat[c] = (byCat[c] || 0) + 1;
  });
  const categories = Object.entries(byCat)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  return {
    total: `온톨로지 그래프: 노드 ${nodes.length}개, 링크 ${links.length}개.`,
    categories,
  };
}

export function formatGraphSummary(
  nodes: { category?: string }[],
  links: unknown[]
): string {
  const s = summarizeGraph(nodes, links);
  const catText = s.categories.slice(0, 5).map((c) => `${c.category} ${c.count}개`).join(", ");
  return `${s.total} 주요 카테고리: ${catText}.`;
}
```

**실제 `GraphNodeData` 타입 필드명 확인 필수:**

```bash
grep -n "GraphNodeData\|category" frontend/src/lib/types.ts
```

`category` 필드명이 다르면 함수 인자를 맞춰 조정.

### Files: `frontend/src/components/ontology/GraphView.tsx`

- [ ] **Step 2: ForceGraph2D 래퍼에 aria summary 주입**

L1 import 추가:
```tsx
import { formatGraphSummary } from "@/lib/a11y";
```

return (L173-192)을 감싸서 `role="img"` 적용:

```tsx
const summary = formatGraphSummary(nodes, links);

return (
  <div role="img" aria-label={summary} className="relative">
    <ForceGraph2D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="#030712"
      nodeCanvasObject={nodeCanvasObject}
      nodePointerAreaPaint={nodePointerAreaPaint}
      linkColor={linkColor}
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={0.9}
      onNodeClick={(node) => onNodeClick(node as unknown as GraphNodeData)}
      onBackgroundClick={onBackgroundClick}
      warmupTicks={50}
      cooldownTicks={100}
      nodeId="id"
      nodeVal="val"
    />
    <span className="sr-only">{summary}</span>
  </div>
);
```

- [ ] **Step 3: 랜딩 decorative canvas 검증 (Task 2.5)**

`app/page.tsx:111`의 canvas는 배경 장식 — `aria-hidden="true"`가 이미 올바르게 설정됨(L111). 변경 없음. 감사 리포트의 "role="img" 추가" 권장은 본 케이스에는 부적합 — 이는 decorative canvas이므로 무시.

확인만:
```bash
grep -n 'aria-hidden="true"' frontend/src/app/page.tsx | head -3
```

Expected: L111 `<canvas ... aria-hidden="true" />` 존재.

- [ ] **Step 4: Task 2.4 커밋**

```bash
git add frontend/src/lib/a11y.ts \
        frontend/src/components/ontology/GraphView.tsx
git commit -m "feat(a11y): screen reader summary for ontology force graph"
```

**Acceptance Criteria 2.4:**
- [ ] GraphView가 노드/링크 총계 + 상위 5개 카테고리 요약을 aria-label로 제공
- [ ] 랜딩 decorative canvas는 `aria-hidden="true"` 유지 (변경 없음)

---

## 최종 검증

- [ ] **Step 1: 전체 a11y 스모크 테스트**

```bash
cd frontend
npm run dev
```

수동:
1. `/habits/analytics` — 히트맵, 트렌드, 완료율, 상관관계 모두 표시되는지
2. 스크린 리더(VoiceOver on macOS / Narrator on Windows / NVDA)로 차트 영역 포커스 → 요약 읽힘 확인
3. `/ontology/graph` — 그래프 위에 포커스 시 "노드 X개, 링크 Y개..." 읽힘
4. Chrome DevTools → Accessibility tree → `role="img"` + name 속성 확인

- [ ] **Step 2: axe DevTools로 자동 스캔**

각 페이지에서 axe 실행. "Elements must have sufficient color contrast" 외 차트 관련 위반 감소 확인.

- [ ] **Step 3: PR 생성**

```bash
git log --oneline feature/phase1-mvp..HEAD
gh pr create --title "feat(a11y): Bundle 2 — chart screen reader summaries & color-blind support" \
  --body "$(cat <<'EOF'
## Summary
- HabitHeatmap: intensity ring 두께로 색맹 대응 + 연간 요약 aria-label
- 트렌드/완료율/상관관계 차트: sr-only 요약 + `role="img"`
- 상관관계에 색 + 화살표 이중 변별 (↑↑/↑/→/↓/↓↓)
- 온톨로지 force graph 노드/링크/카테고리 요약
- 신규 `frontend/src/lib/a11y.ts` 요약 유틸

## 테스트
- [x] Lint/Type/Build 성공
- [ ] 스크린 리더 수동 검증 (VoiceOver 또는 Narrator)
- [ ] 색맹 시뮬레이터 (Sim Daltonism / Chrome DevTools Emulate vision deficiencies) 히트맵 변별 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 참고 — 왜 이 변경들인가

- **WCAG 1.4.1 Use of Color**: 색상만으로 정보 전달 금지. 히트맵/상관관계가 색만 의존했음.
- **WCAG 1.1.1 Non-text Content**: canvas 기반 차트는 `<img alt>` 등가물 필요 → `role="img" aria-label` + `sr-only` 텍스트 요약으로 충족.
- **색맹 통계**: 남성 8%, 여성 0.5% 영향. emerald 계열은 특히 적록색맹에 취약.
- **Chart.js 접근성**: 라이브러리가 자체 aria를 제공하지 않으므로 wrapper 책임.

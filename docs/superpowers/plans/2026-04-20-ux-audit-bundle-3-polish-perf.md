# UX Audit Bundle 3 — Polish & Performance 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hover-only로만 보이는 UI를 키보드/터치에서도 노출하고, 리스트 아이템 리렌더링을 억제하며, `transition-all` 남용을 GPU-friendly 속성으로 좁혀 인터랙션 품질을 끌어올린다.

**Architecture:** Bundle 1, 2의 접근성 수정이 우선 적용된 뒤의 polish 레이어. 어떤 파일이든 로직은 그대로 두고 Tailwind 클래스 및 wrapping 패턴만 조정한다. React.memo는 리스트 아이템을 별도 컴포넌트로 추출하는 가장 국소적인 리팩토링만 수행한다.

**Tech Stack:** React 18.3 `React.memo`, `useCallback`. Tailwind `group-focus-within`, `focus-visible`. GPU 가속 속성: `transform`, `opacity`, `color` — `width/height/top/left` 애니메이션 지양.

**전제:** Bundle 1, 2가 먼저 병합되어 main 브랜치(또는 `feature/phase1-mvp`)에 반영된 상태에서 시작.

---

## 사전 준비

```bash
cd C:/Users/sha2.kim/alma
git fetch origin
git checkout feature/phase1-mvp
git pull
git checkout -b feature/ux-audit-bundle-3
```

---

## 파일 구조

**변경 파일 (7개):**

| 파일 | 책임 | 변경 유형 |
|---|---|---|
| `frontend/src/components/MessageBubble.tsx` | 채팅 메시지 | hover-only → focus 확장 (L66-71 — Bundle 1에서 이미 partially 수정 시 중복 주의) |
| `frontend/src/components/HabitCard.tsx` | 습관 카드 | 옵션 메뉴 열림 상태 시각적 보강 |
| `frontend/src/components/ConversationList.tsx` | 대화 리스트 | 아이템 컴포넌트 추출 + `React.memo` |
| `frontend/src/components/GoalCard.tsx` | 목표 카드 | `transition-all` 좁히기 + `React.memo` |
| `frontend/src/components/common/Toast.tsx` | 토스트 | `transition-all` → `transition-[opacity,transform]` |
| `frontend/src/app/page.tsx` | 랜딩 | `transition-all` 다수 위치 좁히기 |
| `frontend/src/components/HabitHeatmap.tsx` | 히트맵 | `minWidth: 700px` 주석 추가 |

---

## Task 3.1: hover-only → focus/active 확장

### Files: `frontend/src/components/MessageBubble.tsx`

- [ ] **Step 1: 복사 버튼에 focus-within/focus-visible 추가**

현재 L66 `opacity-0 group-hover:opacity-100 focus:opacity-100`는 focus는 지원하나 키보드 tab 이동 시 버튼이 어색하게 숨어있음. group-focus-within도 추가하여 메시지 영역 전체 포커스 시 버튼 노출:

```tsx
// L64-72 기존
<button
  onClick={handleCopy}
  aria-label="메시지 복사"
  title={copied ? "복사됨" : "복사"}
  className={`absolute -top-2 ${
    isUser ? "-left-8" : "-right-8"
  } opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400 shadow-sm border border-gray-200 dark:border-gray-600 text-sm`}
>
```

→ Bundle 1에서 이미 `w-11 h-11` 등으로 변경되었다면 그 base 위에서 focus 클래스만 추가:

```tsx
className={`absolute -top-3 ${
  isUser ? "-left-12" : "-right-12"
} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity w-11 h-11 flex items-center justify-center rounded-md bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400 shadow-sm border border-gray-200 dark:border-gray-600 text-sm`}
```

변경점:
- `focus:opacity-100` → `focus-visible:opacity-100` (마우스 클릭으로 focus 시 안 보이게, 키보드 tab 시만 보이게)
- `group-focus-within:opacity-100` 추가 (부모 group 내 어디든 포커스 시 노출)

### Files: `frontend/src/components/HabitCard.tsx`

- [ ] **Step 2: 옵션 메뉴 버튼은 이미 항상 보임 — 확인 후 변경 유보**

L122-135 옵션 메뉴 트리거 버튼은 현재 `opacity-0 group-hover:opacity-100` 패턴이 아님 (항상 가시). 따라서 focus 관련 변경 불필요. 확인만:

```bash
grep -n "opacity-0\|group-hover" frontend/src/components/HabitCard.tsx
```

Expected: `opacity-0`가 없거나 showMenu state에 의한 조건부 렌더링 — hover-only가 아님. 변경 없음.

### Files: `frontend/src/components/GoalDetail.tsx`

- [ ] **Step 3: 마일스톤 삭제 버튼 focus-within 추가 (Bundle 1에서 이미 일부 처리했다면 중복 확인)**

L152-160 delete button이 `opacity-0 group-hover:opacity-100 focus:opacity-100` 상태라면:

```tsx
className="... opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition ..."
```

**주의:** Bundle 1 Step 7에서 이미 `group-focus-within:opacity-100` 추가했다면 중복 작업 불필요. Bundle 1이 merge된 후 상태에서 diff 확인 후 스킵 여부 결정.

```bash
grep -n "group-focus-within" frontend/src/components/GoalDetail.tsx
```

존재 시: 스킵. 없을 시: 적용.

**Acceptance Criteria 3.1:**
- [ ] 메시지 복사 버튼이 마우스 hover OR 키보드 tab (focus-visible) 시 노출
- [ ] `group-focus-within`으로 메시지 영역 내 어떤 요소에 focus 들어가도 버튼 노출
- [ ] `focus-visible` 사용으로 마우스 클릭 직후 잔상 제거
- [ ] Lint/Type 성공

- [ ] **Step 4: Task 3.1 커밋**

```bash
git add frontend/src/components/MessageBubble.tsx \
        frontend/src/components/GoalDetail.tsx
git commit -m "polish(a11y): expose hover-only controls via focus-within for keyboard users"
```

---

## Task 3.2: 리스트 아이템 React.memo

### Files: `frontend/src/components/ConversationList.tsx`

- [ ] **Step 1: 아이템을 별도 컴포넌트로 추출**

현재 L168-255 inline map 안에 대화 아이템 JSX가 있음. 분리하여 메모이제이션:

```tsx
// 파일 하단 (L260 export default 이전)에 추가:

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  isEditing: boolean;
  isConfirmDelete: boolean;
  editTitle: string;
  editInputRef: React.RefObject<HTMLInputElement>;
  onSelect: () => void;
  onStartEdit: () => void;
  onRename: (title: string) => void;
  onCancelEdit: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onRequestDelete: () => void;
  onEditTitleChange: (v: string) => void;
}

const ConversationItem = React.memo(function ConversationItem({
  conv,
  isActive,
  isEditing,
  isConfirmDelete,
  editTitle,
  editInputRef,
  onSelect,
  onStartEdit,
  onRename,
  onCancelEdit,
  onConfirmDelete,
  onCancelDelete,
  onRequestDelete,
  onEditTitleChange,
}: ConversationItemProps) {
  return (
    <div
      key={conv.id}
      className={`group relative border-b dark:border-gray-800 ${
        isActive
          ? "bg-sky-50 dark:bg-gray-800"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}
    >
      {isEditing ? (
        <div className="px-3 py-2">
          <input
            ref={editInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRename(editTitle);
              if (e.key === "Escape") onCancelEdit();
            }}
            onBlur={() => onRename(editTitle)}
            className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      ) : isConfirmDelete ? (
        <div className="px-3 py-2 space-y-2">
          <p className="text-xs text-red-500">이 대화를 삭제하시겠습니까?</p>
          <div className="flex gap-2">
            <button
              onClick={onConfirmDelete}
              className="flex-1 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              삭제
            </button>
            <button
              onClick={onCancelDelete}
              className="flex-1 py-1 text-xs border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onSelect}
          onDoubleClick={onStartEdit}
          aria-current={isActive ? "true" : undefined}
          className="w-full text-left px-4 py-3 transition text-sm pr-16"
        >
          <span className={isActive ? "font-medium" : ""}>
            {conv.title || "새 대화"}
          </span>
        </button>
      )}

      {!isEditing && !isConfirmDelete && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex group-focus-within:flex gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            aria-label={`${conv.title || "새 대화"} 이름 변경`}
            className="relative p-2 text-gray-400 hover:text-sky-500 transition before:absolute before:inset-[-6px] before:content-['']"
            title="이름 변경"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRequestDelete(); }}
            aria-label={`${conv.title || "새 대화"} 삭제`}
            className="relative p-2 text-gray-400 hover:text-red-500 transition before:absolute before:inset-[-6px] before:content-['']"
            title="삭제"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});
```

**중요:** Bundle 1 Step 5의 터치 타겟 변경 반영됨 (`p-2` + `before:inset-[-6px]`, aria-label 보강). `group-focus-within:flex` 추가로 키보드 tab 시에도 버튼 노출(3.1과 정합).

- [ ] **Step 2: 상위 컴포넌트에서 사용**

기존 L168-255 map 블록을:

```tsx
{conversations.map((conv) => (
  <ConversationItem
    key={conv.id}
    conv={conv}
    isActive={activeId === conv.id}
    isEditing={editingId === conv.id}
    isConfirmDelete={deleteConfirmId === conv.id}
    editTitle={editTitle}
    editInputRef={editInputRef}
    onSelect={() => onSelect(conv.id)}
    onStartEdit={() => startEdit(conv)}
    onRename={(title) => renameConversation(conv.id, title)}
    onCancelEdit={() => setEditingId(null)}
    onConfirmDelete={() => deleteConversation(conv.id)}
    onCancelDelete={() => setDeleteConfirmId(null)}
    onRequestDelete={() => setDeleteConfirmId(conv.id)}
    onEditTitleChange={setEditTitle}
  />
))}
```

- [ ] **Step 3: 파일 상단 import에 React 명시 (React.memo 사용 위해)**

```tsx
// L1 기존
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// After
"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
```

### Files: `frontend/src/components/GoalCard.tsx`

- [ ] **Step 4: GoalCard 전체를 React.memo로 감싸기**

현재 default export function — HOC 적용:

```tsx
// 파일 마지막에 기존
export default function GoalCard({ goal, isActive, onClick }: GoalCardProps) {
  // ... body ...
}

// After — 두 단계
import React from "react";  // L1 import에 추가

function GoalCard({ goal, isActive, onClick }: GoalCardProps) {
  // ... body (기존 그대로) ...
}

export default React.memo(GoalCard);
```

props로 넘기는 콜백은 상위에서 `useCallback`으로 감싸져야 효과 있음 — `goals/page.tsx`에서 이미 그렇게 쓰는지 확인:

```bash
grep -n "onClick=" frontend/src/app/goals/page.tsx
```

Inline arrow function이면 `useCallback` 적용 권장. 범위를 Bundle 3에 한정 — 해당 변경은 별도 리팩 대상으로 남김.

### Files: `frontend/src/components/HabitCard.tsx`

- [ ] **Step 5: HabitCard React.memo + 확인**

```tsx
// 파일 마지막
import React from "react";  // L1

function HabitCard({ item, onCheckin, onEdit, onPause, onDelete }: Props) {
  // ... body ...
}

export default React.memo(HabitCard);
```

- [ ] **Step 6: Task 3.2 검증**

React DevTools Profiler:
1. `npm run dev`
2. /chat에서 메시지 여러 개 전송 — ConversationList 아이템 리렌더 수가 활성 항목 1개로 제한되는지
3. /habits에서 체크인 — 한 항목 체크 시 다른 항목이 리렌더하지 않는지

빌드 번들 크기 비교:
```bash
npm run build
# .next/analyze 있으면 비교
```

- [ ] **Step 7: Task 3.2 커밋**

```bash
git add frontend/src/components/ConversationList.tsx \
        frontend/src/components/GoalCard.tsx \
        frontend/src/components/HabitCard.tsx
git commit -m "perf: memoize list item components to prevent unnecessary re-renders"
```

**Acceptance Criteria 3.2:**
- [ ] `ConversationItem` 별도 컴포넌트 추출 + `React.memo`
- [ ] `GoalCard`, `HabitCard` `React.memo` HOC 적용
- [ ] DevTools Profiler에서 비활성 아이템 리렌더 수 감소 확인
- [ ] Lint/Type 성공

---

## Task 3.3: transition-all 범위 좁히기

**원칙:** `transition-all`은 모든 animatable CSS 속성에 대해 리스너를 붙여 성능상 손해. 실제 변경되는 속성만 명시:
- 투명도 전환: `transition-opacity`
- translate 애니메이션: `transition-transform`
- 색상 변경: `transition-colors`
- 둘 이상: `transition-[opacity,transform]` (임의 속성 지정)
- 프로그레스바 width: `transition-[width]` (불가피하게 width 애니메이션하는 경우, `ease-out` 추천)

### Files: `frontend/src/app/page.tsx`

- [ ] **Step 1: 랜딩 페이지 transition-all 교체**

각 위치 맥락 분석:

| Line | 현재 | 실제 변경 속성 | 변경 후 |
|---|---|---|---|
| L308 | `transition-all duration-1000` + opacity/translate | opacity + transform | `transition-[opacity,transform] duration-1000` |
| L325 | `transition-all duration-300 hover:-translate-y-0.5` + shadow | transform + shadow | `transition-[transform,box-shadow] duration-300` |
| L340 | `transition-all duration-1000` + opacity/translate | opacity + transform | 동일 |
| L366 | 동일 | 동일 | 동일 |
| L382 | `transition-all duration-700 delay-${i*150}` | opacity + transform | `transition-[opacity,transform] duration-700 delay-${i*150}` |
| L394 | 동일 (duration-1000) | 동일 | 동일 |
| L410 | `transition-all` + bg-color + text | colors + bg | `transition-colors` |
| L440 | 동일 fade/translate | 동일 | 동일 |
| L465 | 동일 | 동일 | 동일 |
| L517 | 동일 | 동일 | 동일 |
| L547 | `transition-all` + shadow | box-shadow | `transition-[box-shadow]` |

일괄 find-and-replace 불가 — 맥락 검토 필요. 권장: 각 위치마다 주석으로 "왜 이 속성만" 명시할 필요 없음, 단순 Tailwind 토큰 교체.

- [ ] **Step 2: Fade-in sections 일괄 교체**

opacity + translate 조합(가장 많음) 위치는 다음 정규식으로 찾아 교체:

Grep 확인:
```bash
grep -n "transition-all duration-\(1000\|700\) .*opacity" frontend/src/app/page.tsx
```

각 매치에서:
- `transition-all duration-1000 ${... opacity-100 translate-y-0 ... opacity-0 translate-y-8|12}` → `transition-[opacity,transform] duration-1000 ${... opacity-100 translate-y-0 ... opacity-0 translate-y-8|12}`

L308, L340, L366, L394, L440, L465, L517 동일 패턴.

- [ ] **Step 3: feature tab 버튼 (L410)**

```tsx
// Before
className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
  activeFeature.id === feature.id
    ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25 scale-105"
    : "bg-white dark:bg-gray-800 ..."
}`}

// After — scale 도 있으므로 [colors,transform]
className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-[color,background-color,transform,box-shadow] ${
  ...
}`}
```

혹은 간단히 `transition-colors transition-transform duration-200` (여러 `transition-*` 누적 가능).

- [ ] **Step 4: L325, L547 CTA 버튼 (shadow + transform)**

```tsx
// L325
className="inline-block px-8 py-4 bg-gradient-to-r from-sky-500 to-cyan-400 text-white font-semibold rounded-full text-lg hover:shadow-lg hover:shadow-sky-500/25 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5"
```

- [ ] **Step 5: delay 동적 클래스 주의**

L382 `delay-${i * 150}`은 Tailwind JIT가 safelist에 포함시켜야 함 — 기존 동작 중이면 유지, 빌드 결과에 delay 적용되는지 확인:

```bash
cd frontend && npm run dev
# /pages/ → 프로덕션 빌드 결과와 dev 결과 비교 불필요. 기존 코드가 정상이었다면 유지.
```

### Files: `frontend/src/components/common/Toast.tsx`

- [ ] **Step 6: Toast `transition-all` → `transition-[opacity,transform]`**

```tsx
// L28 기존
className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm text-white transition-all duration-300 flex items-center gap-3 max-w-sm ${
  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
} ${type === "success" ? "bg-emerald-600" : "bg-red-600"}`}

// After
className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm text-white transition-[opacity,transform] duration-300 flex items-center gap-3 max-w-sm ${
  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
} ${type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
```

### Files: `frontend/src/components/GoalCard.tsx`, `GoalDetail.tsx`, `HabitCard.tsx`, `HabitTodaySummary.tsx`

- [ ] **Step 7: 프로그레스바 transition-all → transition-[width] 유지 or transform 기반 재구현**

`transition-all`로 width 애니메이션 중. width 애니메이션은 GPU 가속 안 됨 — 프로그레스바는 미세해서 괜찮지만, `transition-[width]`로 명시:

파일: `GoalCard.tsx:66`, `GoalDetail.tsx:75`, `HabitCard.tsx:186`, `HabitTodaySummary.tsx:24`

```tsx
// Before (모두 공통 패턴)
className="h-full rounded-full transition-all"
// After
className="h-full rounded-full transition-[width] duration-500 ease-out"
```

`duration-500 ease-out` 명시로 일관된 느낌 제공.

### Files: `frontend/src/app/ontology/import/page.tsx`

- [ ] **Step 8: import 페이지 transition-all**

L514 토스트 스타일 요소:

```tsx
// Before
className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${...}`}
// After
className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium transition-[opacity,transform] duration-300 ${...}`}
```

- [ ] **Step 9: Lint/Type/Build 검증**

```bash
cd frontend
npm run lint && npx tsc --noEmit && npm run build
```

- [ ] **Step 10: 시각 회귀 확인**

`npm run dev` → 다음 인터랙션 확인:
- /chat 페이지 스크롤 시 hero section fade-in
- /goals 카드 클릭 시 프로그레스바 애니메이션
- Toast 등장/사라짐 (/settings에서 설정 저장 테스트)

기존과 시각적으로 동일하거나 더 매끄러운지.

- [ ] **Step 11: Task 3.3 커밋**

```bash
git add frontend/src/app/page.tsx \
        frontend/src/app/ontology/import/page.tsx \
        frontend/src/components/common/Toast.tsx \
        frontend/src/components/GoalCard.tsx \
        frontend/src/components/GoalDetail.tsx \
        frontend/src/components/HabitCard.tsx \
        frontend/src/components/HabitTodaySummary.tsx
git commit -m "perf: narrow transition-all to specific properties (opacity, transform, box-shadow, width)"
```

**Acceptance Criteria 3.3:**
- [ ] `transition-all`이 남아있는 위치가 의도적(모든 속성 변경)인지 확인
- [ ] 프로그레스바: `transition-[width] duration-500 ease-out`
- [ ] Fade-in 섹션: `transition-[opacity,transform]`
- [ ] Toast: `transition-[opacity,transform]`
- [ ] 시각적 회귀 없음

---

## Task 3.4: HabitHeatmap minWidth 문서화

### Files: `frontend/src/components/HabitHeatmap.tsx`

**Bundle 2 carryover**: Bundle 2 최종 리뷰에서 `summarizeHeatmap` 365일 루프 + `days` 배열 생성이 매 렌더 반복되는 것을 useMemo로 방지하도록 권고됨. Task 3.4에 통합.

- [ ] **Step 0: useMemo 적용 (Bundle 2 carryover)**

파일 상단 import에 `useMemo` 추가:
```tsx
import { useMemo } from "react";
```

`days` 배열과 `summary`/`summaryText` 계산을 `useMemo`로 감싸기:

```tsx
const year = new Date().getFullYear();

const { days, summaryText } = useMemo(() => {
  if (!data) return { days: [] as { date: string; count: number }[], summaryText: "" };
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const daysArr: { date: string; count: number }[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    daysArr.push({ date: key, count: data.dates[key] || 0 });
  }
  const summary = summarizeHeatmap(data.dates, year);
  return { days: daysArr, summaryText: formatHeatmapSummary(summary, year) };
}, [data, year]);
```

이렇게 하면 `data.dates`가 동일한 참조일 때 루프 스킵. `data`가 null 처리도 useMemo 내부에서.

상단 early return은 그대로 유지:
```tsx
if (!data) return null;
```

(`if (!data) return null` 상단 유지하면서 useMemo 내부의 null 처리는 방어 — useMemo는 조건부 훅 호출 방지용)

- [ ] **Step 1: minWidth 주석 추가**

L32-33 기존:
```tsx
<div className="overflow-x-auto">
  <div className="flex gap-[2px]" style={{ minWidth: "700px" }}>
```

교체 — 이유를 설명하는 주석:
```tsx
<div className="overflow-x-auto">
  {/* 53주 × 7요일 = 371셀. 각 셀 w-3(12px) + gap 2px ≈ 14px × 53 = 742px.
      모바일(<768px)에서는 부모의 overflow-x-auto로 가로 스크롤 처리.
      minWidth는 셀이 찌그러지지 않도록 최소 영역 보장. */}
  <div className="flex gap-[2px]" style={{ minWidth: "700px" }} aria-hidden="true">
```

`aria-hidden="true"`는 Bundle 2 Task 2.2에서 이미 추가했다면 그대로. Bundle 2 미적용 상태라면 이 plan에서 추가.

- [ ] **Step 2: Task 3.4 커밋**

```bash
git add frontend/src/components/HabitHeatmap.tsx
git commit -m "docs: explain HabitHeatmap minWidth constraint"
```

**Acceptance Criteria 3.4:**
- [ ] minWidth 700px 선택 이유가 주석으로 문서화됨

---

## 최종 검증

- [ ] **Step 1: 전체 체크**

```bash
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

모두 성공 필수.

- [ ] **Step 2: 성능 수동 측정 (선택)**

Chrome DevTools → Performance:
1. /chat에 접속, ConversationList에 50+ 대화 있는 상태로
2. "Record" → 새 대화 생성 → "Stop"
3. Scripting 시간 비교 (Bundle 3 적용 전/후)

React DevTools Profiler:
- /habits에서 항목 체크 시 Commit 수

- [ ] **Step 3: PR 생성**

```bash
git log --oneline feature/phase1-mvp..HEAD
gh pr create --title "polish: Bundle 3 — keyboard-accessible hover UI, memoized list items, GPU-friendly transitions" \
  --body "$(cat <<'EOF'
## Summary
- 메시지/마일스톤 hover-only 컨트롤 → `group-focus-within`/`focus-visible` 추가 (키보드 사용자)
- ConversationItem 추출 + React.memo, GoalCard/HabitCard memo HOC
- `transition-all` → 실제 변경 속성 명시 (`transition-[opacity,transform]`, `transition-colors`, 프로그레스바 `transition-[width]`)
- HabitHeatmap minWidth 근거 주석

## 테스트
- [x] Lint/Type/Build 성공
- [ ] React DevTools Profiler: 리스트 아이템 리렌더 감소 확인
- [ ] 시각 회귀 없음 (주요 페이지 수동 확인)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 참고 — 왜 이 변경들인가

- **`focus-visible` vs `focus`**: 마우스 클릭도 focus 이벤트 발생. `focus-visible`은 키보드 내비게이션일 때만 트리거 → 마우스 유저에게 숨어 있던 UI가 클릭 시 번쩍이는 현상 제거.
- **`group-focus-within`**: 메시지 영역의 텍스트를 탭으로 선택할 때 복사 버튼이 자동 노출 → 키보드 온리 사용자 UX 개선.
- **React.memo**: props 동등성 체크로 리렌더 스킵. 리스트 렌더링에서 효과 큼 — 50개 대화 중 1개만 활성 변경 시 나머지 49개 스킵.
- **transition-all → 구체적 속성**: 브라우저가 모든 CSS 속성 변경에 transition 감시 → 불필요 layout/paint 트리거 방지. 특히 `color`, `border`, `outline` 변경 시 불필요한 애니메이션 꼬임 예방.
- **Progress bar `transition-[width]`**: width는 reflow 유발. 하지만 프로그레스바는 미세하고 한 번에 한 요소만 변경되므로 허용 가능. 대안(transform: scaleX)도 존재하지만 접근성/레이아웃 복잡성 트레이드오프로 기존 유지.
